/**
 * cardLifecycleRoutes.js — Cycle de vie des cartes (Module 3 du cahier des charges)
 *
 * RˆGLE FONDAMENTALE : la carte et le dossier sont deux objets distincts.
 *   • Bloquer une carte ne suspend PAS les droits de l'assuré (status reste 'active').
 *   • Révoquer une carte n'efface NI l'historique NI le dossier.
 *   • La révocation est vérifiée par le SERVEUR à chaque vérification de carte —
 *     masquer dans l'interface ne suffit pas.
 *
 * Source de vérité du statut courant : colonnes dédiées sur `beneficiaries`
 * (une seule requête pour la vérification de carte). L'historique immuable
 * vit dans `card_lifecycle_events`.
 *
 * Transitions autorisées :
 *   active  †’ blocked   (perte, vol, fraude suspectée, demande assuré)
 *   blocked †’ active    (déblocage, motif obligatoire)
 *   active|blocked †’ revoked (révocation logique, historique conservé)
 *   revoked †’ replaced  (nouvelle carte créée, lien ancien†’nouveau)
 *
 * Cloisonnement MSD : un agent ne peut agir que sur les cartes de SA MSD.
 * Le Super Admin (sans msdCode) supervise tout. Les actions sont journalisées
 * dans audit_logs ET card_lifecycle_events.
 */

const express = require('express');
const crypto = require('crypto');
const { query } = require('./db');
const { normalizeRole } = require('./rbac');
const { authenticateToken } = require('./rbac');
const { recordAudit, actorOf } = require('./auditTrail');
const { scopeOf, canPerform } = require('./accountCardService');

/**
 * Motifs de destruction (destruction LOGIQUE d'une carte, distincte de la
 * destruction physique du PVC et de la révocation : §3.8).
 */
const DESTROY_REASONS = ['CARTE_ERRONEE', 'CARTE_NON_RECUPEREE', 'CARTE_ENDOMMAGEE', 'FIN_DE_VALIDITE', 'ERREUR_ADMIN'];

const router = express.Router();

// Authentification portée par le router, LIMIT‰E aux préfixes du module :
// le router est monté à la racine avec des chemins complets ; un
// `router.use(authenticateToken)` global bloquerait toutes les routes de
// l'application (dont les routes publiques /api/csu/*).
const MODULE_PREFIXES = /^\/api\/(imports|studio|excel|security|accounts|cards|admin-requests)(\/|$)/;
router.use((req, res, next) => {
  if (!MODULE_PREFIXES.test(req.path)) return next();
  return authenticateToken(req, res, next);
});

// Motifs de blocage autorisés (validation serveur — jamais libre)
const BLOCK_REASONS = ['PERTE', 'VOL', 'FRAUDE_SUSPECTEE', 'DEMANDE_ASSURE', 'ERREUR_ADMIN'];
const REVOKE_REASONS = ['FRAUDE_CONFIRMEE', 'DOUBLON', 'DOSSIER_CLOSE', 'DEMANDE_ASSURE', 'ERREUR_ADMIN'];

const clean = (v) => String(v || '').trim();

const msdOfUser = (user) => scopeOf(user);

// Charge la carte + son dossier, avec cloisonnement MSD.
const loadCard = async (cmuNumber, msd) => {
  const r = await query(
    `SELECT id, cmu_number, first_name, last_name, msd_code, card_status,
            card_blocked_at, card_blocked_reason, card_revoked_at, card_replaced_by,
            status
       FROM beneficiaries WHERE cmu_number = $1 LIMIT 1`,
    [clean(cmuNumber)]
  );
  if (r.rows.length === 0) return { error: 404, message: 'Carte introuvable.' };
  const card = r.rows[0];
  if (msd && String(card.msd_code || '').toUpperCase() !== msd) {
    return { error: 403, message: 'Carte hors de votre périmètre MSD.' };
  }
  return { card };
};


/**
 * Contrôle d'une demande administrative associée à une action (§3.2).
 * @returns {Promise<{ok:true}|{ok:false, error:number, message:string}>}
 */
const checkRequestRef = async (requestRef, cmuNumber) => {
  const ref = clean(requestRef);
  if (!ref) return { ok: true };
  try {
    const r = await query(
      'SELECT reference, cmu_number, status, identity_verified FROM admin_requests WHERE reference = $1',
      [ref]
    );
    const req = r.rows && r.rows[0];
    if (!req) return { ok: false, error: 404, message: 'Référence de demande introuvable.' };
    if (String(req.cmu_number || '') && String(req.cmu_number) !== String(cmuNumber)) {
      return { ok: false, error: 409, message: 'La demande ne concerne pas cet assuré.' };
    }
    if (!req.identity_verified) {
      return { ok: false, error: 409, message: "L'identité du demandeur n'a pas été vérifiée pour cette demande." };
    }
    if (!['EN_COURS', 'TRAITEE', 'EN_ATTENTE_VALIDATION'].includes(req.status)) {
      return { ok: false, error: 409, message: `Demande ${req.status} : elle doit être prise en charge avant exécution.` };
    }
    return { ok: true, request: req };
  } catch {
    return { ok: false, error: 500, message: 'Vérification de la demande impossible.' };
  }
};

// Journal d'événements du cycle de vie (immuable) + audit_logs.
const logEvent = async (cmuNumber, event, actor, role, msd, reason, details, requestRef, replacementCmu) => {
  await query(
    `INSERT INTO card_lifecycle_events
        (cmu_number, event, reason, details, actor, actor_role, msd_code, request_ref, replacement_cmu)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [cmuNumber, event, reason || null, details || null, actor, role || null, msd || null, requestRef || null, replacementCmu || null]
  );
  await query(
    `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
    [`CARD_${event}`, actor, `${cmuNumber} — motif : ${reason || 'n/a'}${details ? ' — ' + details : ''}`]
  );
};

// ”€”€ Bloquer une carte ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/cards/:cmuNumber/block { reason, details, requestRef }
router.post('/api/cards/:cmuNumber/block', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { reason, details, requestRef } = req.body || {};
  if (!BLOCK_REASONS.includes(clean(reason))) {
    return res.status(400).json({ error: `Motif invalide. Autorisés : ${BLOCK_REASONS.join(', ')}.` });
  }
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }

  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const card = found.card;
    const reqCheck = await checkRequestRef(requestRef, card.cmu_number);
    if (!reqCheck.ok) return res.status(reqCheck.error).json({ error: reqCheck.message });
    if (card.card_status === 'revoked') {
      return res.status(409).json({ error: 'Une carte révoquée ne peut plus être bloquée : elle est définitivement hors service.' });
    }
    if (card.card_status === 'blocked') {
      return res.status(409).json({ error: 'Carte déjà bloquée.' });
    }
    await query(
      `UPDATE beneficiaries SET card_status = 'blocked',
              card_blocked_at = CURRENT_TIMESTAMP,
              card_blocked_reason = $2, card_blocked_by = $3
         WHERE id = $1`,
      [card.id, clean(reason), clean(user.username || user.id)]
    );
    await logEvent(card.cmu_number, 'BLOCKED', clean(user.username || user.id), role, msd, clean(reason), clean(details), clean(requestRef), null);
    return res.json({
      success: true,
      cardStatus: 'blocked',
      cmuNumber: card.cmu_number,
      message: 'Carte bloquée : elle est refusée par toutes les vérifications serveur.'
    });
  } catch (err) {
    console.error('[Cards] blocage impossible :', err.message);
    return res.status(500).json({ error: 'Blocage impossible.' });
  }
});

// ”€”€ Débloquer une carte ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/cards/:cmuNumber/unblock { reason, details }
router.post('/api/cards/:cmuNumber/unblock', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  if (!canPerform('DEBLOCAGE_CARTE', user)) {
    return res.status(403).json({ error: 'Le déblocage est réservé aux administrateurs habilités.' });
  }
  const { reason, details, requestRef } = req.body || {};
  if (!clean(reason)) {
    return res.status(400).json({ error: 'Motif de déblocage obligatoire.' });
  }
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }

  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const card = found.card;
    const reqCheck = await checkRequestRef(requestRef, card.cmu_number);
    if (!reqCheck.ok) return res.status(reqCheck.error).json({ error: reqCheck.message });
    if (card.card_status !== 'blocked') {
      return res.status(409).json({ error: `Seule une carte bloquée peut être débloquée (statut actuel : ${card.card_status}).` });
    }
    await query(
      `UPDATE beneficiaries SET card_status = 'active',
              card_blocked_at = NULL, card_blocked_reason = NULL, card_blocked_by = NULL
         WHERE id = $1`,
      [card.id]
    );
    await logEvent(card.cmu_number, 'UNBLOCKED', clean(user.username || user.id), role, msd, clean(reason), clean(details), null, null);
    return res.json({ success: true, cardStatus: 'active', cmuNumber: card.cmu_number });
  } catch (err) {
    console.error('[Cards] déblocage impossible :', err.message);
    return res.status(500).json({ error: 'Déblocage impossible.' });
  }
});

// ”€”€ Révoquer une carte ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/cards/:cmuNumber/revoke { reason, details, requestRef }
router.post('/api/cards/:cmuNumber/revoke', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { reason, details, requestRef } = req.body || {};
  if (!REVOKE_REASONS.includes(clean(reason))) {
    return res.status(400).json({ error: `Motif invalide. Autorisés : ${REVOKE_REASONS.join(', ')}.` });
  }
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }

  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const card = found.card;
    const reqCheck = await checkRequestRef(requestRef, card.cmu_number);
    if (!reqCheck.ok) return res.status(reqCheck.error).json({ error: reqCheck.message });
    if (card.card_status === 'revoked') {
      return res.status(409).json({ error: 'Carte déjà révoquée.' });
    }
    if (card.card_replaced_by) {
      return res.status(409).json({ error: 'Carte déjà remplacée : sa révocation est déjà enregistrée via le remplacement.' });
    }
    await query(
      `UPDATE beneficiaries SET card_status = 'revoked',
              card_revoked_at = CURRENT_TIMESTAMP,
              card_revoked_reason = $2, card_revoked_by = $3
         WHERE id = $1`,
      [card.id, clean(reason), clean(user.username || user.id)]
    );
    await logEvent(card.cmu_number, 'REVOKED', clean(user.username || user.id), role, msd, clean(reason), clean(details), clean(requestRef), null);
    return res.json({
      success: true,
      cardStatus: 'revoked',
      cmuNumber: card.cmu_number,
      message: 'Carte révoquée : son identifiant n\u2019est plus accepté comme carte active. Historique conservé.'
    });
  } catch (err) {
    console.error('[Cards] révocation impossible :', err.message);
    return res.status(500).json({ error: 'Révocation impossible.' });
  }
});

// ”€”€ Remplacer une carte (ancienne †’ nouvelle) ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/cards/:cmuNumber/replace { newCmuNumber, reason, details }
// Révoque l'ancienne et relie les deux via card_replaced_by.
router.post('/api/cards/:cmuNumber/replace', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  if (!canPerform('REMPLACEMENT_CARTE', user)) {
    return res.status(403).json({ error: 'Le remplacement est réservé aux administrateurs habilités.' });
  }
  const { newCmuNumber, reason, details, requestRef } = req.body || {};
  const newCmu = clean(newCmuNumber);
  if (!newCmu) return res.status(400).json({ error: 'Matricule de la nouvelle carte requis.' });
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }

  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const oldCard = found.card;
    const reqCheck = await checkRequestRef(requestRef, oldCard.cmu_number);
    if (!reqCheck.ok) return res.status(reqCheck.error).json({ error: reqCheck.message });
    if (oldCard.card_status === 'revoked') {
      return res.status(409).json({ error: 'Carte déjà révoquée : impossible de la remplacer à nouveau.' });
    }
    const newFound = await loadCard(newCmu, msd);
    if (newFound.error) return res.status(newFound.error).json({ error: newFound.message });
    const newCard = newFound.card;
    if (newCard.id === oldCard.id) {
      return res.status(400).json({ error: 'La nouvelle carte doit être différente de l\u2019ancienne.' });
    }
    if (newCard.card_status !== 'active') {
      return res.status(409).json({ error: `La carte de remplacement doit être active (statut : ${newCard.card_status}).` });
    }
    // 1. Révoquer l'ancienne, avec le lien vers la nouvelle.
    await query(
      `UPDATE beneficiaries SET card_status = 'revoked',
              card_revoked_at = CURRENT_TIMESTAMP,
              card_revoked_reason = 'REMPLACEE',
              card_revoked_by = $2,
              card_replaced_by = $3
         WHERE id = $1`,
      [oldCard.id, clean(user.username || user.id), newCard.cmu_number]
    );
    // 2. Enregistrer les deux événements (ancien REVOKED/REMPLACEE + nouveau REPLACED).
    await logEvent(oldCard.cmu_number, 'REVOKED', clean(user.username || user.id), role, msd, 'REMPLACEE', clean(details) || `Remplacée par ${newCard.cmu_number}`, null, newCard.cmu_number);
    await logEvent(newCard.cmu_number, 'REPLACED', clean(user.username || user.id), role, msd, clean(reason) || 'REMPLACEMENT', `Remplace ${oldCard.cmu_number}`, null, oldCard.cmu_number);
    return res.json({
      success: true,
      oldCmu: oldCard.cmu_number,
      newCmu: newCard.cmu_number,
      message: 'Ancienne carte révoquée, nouvelle carte active. Lien de remplacement enregistré.'
    });
  } catch (err) {
    console.error('[Cards] remplacement impossible :', err.message);
    return res.status(500).json({ error: 'Remplacement impossible.' });
  }
});

// ”€”€ Historique du cycle de vie d'une carte ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// GET /api/cards/:cmuNumber/history — fiche complète, auth + cloisonnement.
router.get('/api/cards/:cmuNumber/history', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }
  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const events = await query(
      `SELECT event, reason, details, actor, actor_role, msd_code, request_ref, replacement_cmu, created_at
         FROM card_lifecycle_events WHERE cmu_number = $1 ORDER BY created_at DESC, id DESC`,
      [found.card.cmu_number]
    );
    return res.json({ success: true, card: found.card, events: events.rows });
  } catch (err) {
    console.error('[Cards] historique indisponible :', err.message);
    return res.status(500).json({ error: 'Historique indisponible.' });
  }
});

/**
 * ‰met un code de réinitialisation à usage unique (haché SHA-256, 15 min).
 * Aucun mot de passe n'est jamais généré, lu ni stocké en clair ; l'agent ne
 * connaît QUE le code temporaire, que l'assuré doit changer à sa connexion.
 * @returns {Promise<{code:string, expiresAt:Date, hash:string}>}
 */
async function issueResetCode(cmuNumber, actor) {
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const insert = () => query(
    `INSERT INTO password_resets (cmu_number, code_hash, expires_at, requested_by, used, created_at)
     VALUES ($1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)`,
    [cmuNumber, hash, expiresAt, actor]
  );
  try {
    await insert();
  } catch {
    await query(`CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      cmu_number VARCHAR(60) NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      requested_by VARCHAR(100),
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`).catch(() => {});
    await insert();
  }
  // Marque le compte comme « réinitialisation en attente » (sans écraser
  // l'état d'un compte inexistant : la table est optionnelle).
  await query(
    `INSERT INTO beneficiary_accounts (beneficiary_id, cmu_number, password_reset_pending, last_reset_at)
     SELECT id, cmu_number, TRUE, CURRENT_TIMESTAMP FROM beneficiaries WHERE cmu_number = $1
     ON CONFLICT (beneficiary_id) DO UPDATE SET password_reset_pending = TRUE, updated_at = CURRENT_TIMESTAMP`,
    [cmuNumber]
  ).catch(() => {});
  // Invalidation des sessions existantes : un changement de mot de passe
  // révoque tous les jetons de rafraîchissement de l'assuré (§3.4).
  await query(
    `UPDATE refresh_tokens SET revoked = TRUE
      WHERE revoked = FALSE AND user_id IN (SELECT id FROM beneficiaries WHERE cmu_number = $1)`,
    [cmuNumber]
  ).catch(() => {});
  return { code, expiresAt, hash };
}

/**
 * Verrouille un compte assuré le temps qu'il utilise son code (5 tentatives).
 */
async function lockAccountBriefly(cmuNumber, attempts = 5, minutes = 15) {
  await query(
    `INSERT INTO beneficiary_accounts (beneficiary_id, cmu_number, account_status, password_reset_pending)
     SELECT id, cmu_number, 'VERROUILLE_TEMPORAIRE', TRUE FROM beneficiaries WHERE cmu_number = $1
     ON CONFLICT (beneficiary_id) DO UPDATE SET account_status = 'VERROUILLE_TEMPORAIRE', updated_at = CURRENT_TIMESTAMP`,
    [cmuNumber]
  ).catch(() => {});
  return { attempts, minutes };
}

// ”€”€ Réinitialisation forcée du mot de passe compte assuré ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/accounts/:cmuNumber/reset-password — ne JAMAIS accepter ni
// renvoyer un mot de passe. Génère un code temporaire à usage unique,
// expirable, hashé en base. L'agent ne connaît jamais le mot de passe final.
router.post('/api/accounts/:cmuNumber/reset-password', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { requestRef } = req.body || {};
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }
  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const card = found.card;
    const action = 'DESTRUCTION_CARTE';
    void action;
    const { code, expiresAt } = await issueResetCode(card.cmu_number, clean(user.username || user.id));
    await recordAudit({
      action: 'PASSWORD_RESET', actor: actorOf(user),
      details: `Réinitialisation forcée demandée pour ${card.cmu_number} — code temporaire émis (jamais journalisé)${requestRef ? ' (réf. ' + clean(requestRef) + ')' : ''}`,
      objectType: 'ACCOUNT', objectRef: card.cmu_number, requestRef: clean(requestRef) || null,
      msdCode: card.msd_code, result: 'SUCCESS', severity: 'WARNING',
    });
    // š ï¸ Le code est renvoyé UNE SEULE fois à l'agent habilité, qui le transmet
    // à l'assuré en face-à-face. Jamais stocké en clair en base.
    return res.json({
      success: true,
      oneTimeCode: code,
      expiresAt: expiresAt.toISOString(),
      message: "Code temporaire à usage unique, valable 15 minutes. L'assuré devra le changer à sa prochaine connexion. Ne jamais le stocker."
    });
  } catch (err) {
    console.error('[Accounts] réinitialisation impossible :', err.message);
    return res.status(500).json({ error: 'Réinitialisation impossible.' });
  }
});


// ”€”€ Détruire (logiquement) une carte ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/cards/:cmuNumber/destroy { reason, details, requestRef }
//
// DISTINCTION (§3.8) :
//   • révocation  †’ la carte ne vaut plus comme carte ACTIVE, remplaçable ;
//   • destruction †’ la carte est retirée du service (PVC détruit), mais la
//     fiche et le compte RESTENT. L'identifiant n'est jamais réattribué.
// Ne supprime JAMAIS le compte de l'assuré.
router.post('/api/cards/:cmuNumber/destroy', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  if (!canPerform('SUPPRESSION_CARTE', user)) {
    return res.status(403).json({ error: 'La destruction est réservée aux administrateurs habilités.' });
  }
  const { reason, details, requestRef } = req.body || {};
  if (!DESTROY_REASONS.includes(clean(reason))) {
    return res.status(400).json({ error: `Motif invalide. Autorisés : ${DESTROY_REASONS.join(', ')}.` });
  }
  const msd = msdOfUser(user);
  if (msd === undefined) {
    return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  }
  try {
    const found = await loadCard(req.params.cmuNumber, msd);
    if (found.error) return res.status(found.error).json({ error: found.message });
    const card = found.card;
    const reqCheck = await checkRequestRef(requestRef, card.cmu_number);
    if (!reqCheck.ok) return res.status(reqCheck.error).json({ error: reqCheck.message });
    if (card.card_status === 'revoked') {
      return res.status(409).json({ error: 'Carte déjà révoquée : la destruction est enregistrée dans son historique.' });
    }
    // La carte est révoquée côté serveur (aucune vérification ne l'accepte)
    // ET marquée détruite dans l'historique immuable.
    await query(
      `UPDATE beneficiaries SET card_status = 'revoked',
              card_revoked_at = CURRENT_TIMESTAMP,
              card_revoked_reason = 'DETRUITE', card_revoked_by = $2
         WHERE id = $1`,
      [card.id, clean(user.username || user.id)]
    );
    await logEvent(card.cmu_number, 'DESTROYED', clean(user.username || user.id), role, msd, clean(reason), clean(details), clean(requestRef), null);
    await recordAudit({
      action: 'CARD_DESTROYED', actor: actorOf(user),
      details: `Carte ${card.cmu_number} détruite (motif ${clean(reason)}). Dossier et compte conservés.`,
      objectType: 'CARD', objectRef: card.cmu_number, requestRef: clean(requestRef) || null,
      msdCode: card.msd_code || msd, result: 'SUCCESS', severity: 'CRITICAL',
    });
    return res.json({
      success: true,
      cardStatus: 'revoked',
      cmuNumber: card.cmu_number,
      message: 'Carte détruite et révoquée côté serveur. Le dossier et le compte de l\'assuré sont conservés.',
    });
  } catch (err) {
    console.error('[Cards] destruction impossible :', err.message);
    return res.status(500).json({ error: 'Destruction impossible.' });
  }
});

module.exports = { router, BLOCK_REASONS, REVOKE_REASONS };


module.exports.DESTROY_REASONS = DESTROY_REASONS;
module.exports.issueResetCode = issueResetCode;
module.exports.checkRequestRef = checkRequestRef;
