/**
 * auditTrail.js — Journal d'audit structuré (Module 4.2 du cahier des charges).
 *
 * Le journal historique `audit_logs (action, actor, details)` est CONSERVÉ tel
 * quel : toute la plateforme, les rapports et les tests s'appuient dessus.
 * Ce module le COMPLÈTE par des colonnes d'enquête optionnelles (migration
 * douce et idempotente), sans jamais changer la forme des anciennes lignes :
 *
 *   correlation_id  — identifiant technique de corrélation (req-id)
 *   object_type     — type d'objet concerné (CARD, ACCOUNT, BENEFICIARY…)
 *   object_ref      — référence de l'objet (matricule, demande…)
 *   result          — SUCCESS | FAILURE | DENIED
 *   request_ref     — référence de la demande administrative liée
 *   msd_code        — MSD de l'acteur (cloisonnement des lectures)
 *   severity        — INFO | WARNING | CRITICAL
 *
 * RÈGLES :
 *   • jamais de mot de passe, de jeton ni de donnée médicale dans `details` ;
 *   • l'écriture ne doit JAMAIS faire échouer l'opération métier qui la
 *     déclenche : `recordAudit` n'échoue pas, il replie sur la colonne
 *     historique si les colonnes d'enquête ne sont pas encore migrées.
 */

const crypto = require('crypto');
const { query } = require('./db');

const CACHE = { extended: null, migrated: false };

/** Retire les secrets les plus évidents d'un texte libre. */
function scrub(text) {
  if (text === null || text === undefined) return null;
  return String(text)
    .replace(/(password|mot de passe|pin|code[_ ]?pin)\s*[:=]\s*\S+/gi, '$1: [masqué]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jeton masqué]')
    .slice(0, 2000);
}

/**
 * Les colonnes d'enquête existent-elles ? (une seule vérification par
 * processus, la migration douce de server.js les crée au démarrage).
 */
async function supportsExtendedColumns() {
  if (CACHE.extended !== null) return CACHE.extended;
  // Migration déjà posée dans CE processus (server.js) : on l'utilise sans
  // requête de catalogue — indispensable aux tests où la DB est simulée.
  if (CACHE.migrated) {
    CACHE.extended = true;
    return true;
  }
  try {
    const r = await query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_name = 'audit_logs' AND column_name = 'correlation_id' LIMIT 1`
    );
    CACHE.extended = (r.rows || []).length > 0;
  } catch {
    CACHE.extended = false;
  }
  return CACHE.extended;
}

/** Force la re-détection (après migration dans le même processus). */
function resetSchemaCache() {
  CACHE.extended = null;
}

/**
 * Signale que la migration des colonnes d'enquête vient d'être appliquée par
 * server.js : le module les utilisera pour toutes les écritures suivantes.
 */
function markExtendedColumnsReady() {
  CACHE.migrated = true;
  CACHE.extended = true;
}

/** Identifiant de corrélation court (8 octets hexadécimaux). */
function newCorrelationId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Écrit une ligne d'audit.
 * @param {object} ev
 * @param {string} ev.action — code d'action (MAJUSCULES, ex. CARD_BLOCKED)
 * @param {string} [ev.actor] — identifiant de l'acteur
 * @param {string} [ev.details] — description lisible (scrubbée)
 * @param {string} [ev.result] — SUCCESS | FAILURE | DENIED
 * @param {string} [ev.objectType] — CARD | ACCOUNT | BENEFICIARY | REPORT…
 * @param {string} [ev.objectRef] — référence de l'objet
 * @param {string} [ev.requestRef] — référence de demande administrative
 * @param {string} [ev.msdCode] — MSD de l'acteur
 * @param {string} [ev.severity] — INFO | WARNING | CRITICAL
 * @param {string} [ev.correlationId]
 * @returns {Promise<{ok:boolean, correlationId:string}>}
 */
async function recordAudit(ev = {}) {
  const correlationId = ev.correlationId || newCorrelationId();
  const action = String(ev.action || 'ACTION_INCONNUE').slice(0, 80);
  const actor = String(ev.actor || 'systeme').slice(0, 100);
  const details = scrub(ev.details);
  const payload = {
    correlationId,
    objectType: ev.objectType || null,
    objectRef: ev.objectRef ? String(ev.objectRef).slice(0, 120) : null,
    result: ['SUCCESS', 'FAILURE', 'DENIED'].includes(ev.result) ? ev.result : null,
    requestRef: ev.requestRef ? String(ev.requestRef).slice(0, 60) : null,
    msdCode: ev.msdCode ? String(ev.msdCode).toUpperCase().slice(0, 30) : null,
    severity: ['INFO', 'WARNING', 'CRITICAL'].includes(ev.severity) ? ev.severity : 'INFO',
  };
  const extended = await supportsExtendedColumns();
  try {
    if (extended) {
      await query(
        `INSERT INTO audit_logs
           (action, actor, details, correlation_id, object_type, object_ref, result, request_ref, msd_code, severity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [action, actor, details, payload.correlationId, payload.objectType, payload.objectRef,
          payload.result, payload.requestRef, payload.msdCode, payload.severity]
      );
    } else {
      // Repli : la table historique n'a que (action, actor, details). La
      // référence de corrélation est conservée DANS le texte pour ne pas
      // perdre la piste d'enquête.
      await query(
        `INSERT INTO audit_logs (action, actor, details) VALUES ($1,$2,$3)`,
        [action, actor, [details, `[corr:${payload.correlationId}]`].filter(Boolean).join(' ')]
      );
    }
    return { ok: true, correlationId: payload.correlationId };
  } catch (err) {
    // Un journal qui tombe ne doit jamais casser l'opération métier.
    // (Aucune donnée personnelle dans ce log applicatif.)
    console.warn('[Audit] écriture impossible :', err.message);
    return { ok: false, correlationId: payload.correlationId };
  }
}

/** Acteur lisible depuis un jeton (jamais un secret). */
function actorOf(user) {
  if (!user) return 'systeme';
  return String(user.username || user.phone || user.id || 'systeme');
}

module.exports = {
  recordAudit, scrub, newCorrelationId, supportsExtendedColumns, resetSchemaCache,
  markExtendedColumnsReady, actorOf,
};
