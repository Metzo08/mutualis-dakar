/**
 * securityCenterRoutes.js — Centre de sécurité et surveillance (Module 4).
 *
 *   GET   /api/security/overview          — indicateurs + état des contrôles (4.1)
 *   GET   /api/security/alerts            — alertes déduites des données (4.3)
 *   PATCH /api/security/alerts/:id        — traiter une alerte (acquitter/clôturer)
 *   GET   /api/security/sessions          — sessions actives, SANS jeton (4.5)
 *   DELETE /api/security/sessions/:id     — révoquer une session suspecte
 *   GET   /api/security/privileged        — revue des comptes privilégiés (4.4)
 *   GET   /api/security/export            — rapport Excel de sécurité (5.5)
 *
 * Aucune de ces routes ne supprime un compte ni une carte : le traitement
 * d'une alerte est une décision HUMAINE et journalisée.
 */

const express = require('express');
const { query } = require('./db');
const { authenticateToken, normalizeRole } = require('./rbac');
const { parsePagination } = require('./pagination');
const { scopeOf } = require('./accountCardService');
const { recordAudit, actorOf } = require('./auditTrail');
const { securityOverview, securityAlerts, THRESHOLDS } = require('./securityMonitor');
const {
  buildKpiSheet, buildTableSheet, buildWorkbook, reportReference,
} = require('./excelWorkbook');

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

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

/** Garde commune : agent/admin authentifié ET rattaché à une MSD (sauf Super Admin).
 *  Renvoie la MSD (string), `null` pour un Super Admin (périmètre TOTAL — valeur
 *  légitime), ou `false` si la requête a déjà été refusée (403 envoyé). */
function guard(req, res) {
  const role = normalizeRole(req.user && req.user.role);
  if (role !== 'agent' && role !== 'admin') {
    res.status(403).json({ error: 'Réservé aux agents et administrateurs habilités.' });
    return false;
  }
  const scope = scopeOf(req.user);
  if (scope === undefined) {
    res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
    return false;
  }
  return scope;
}

/** Garde renforcée : seuls les administrateurs (sessions, comptes privilégiés). */
function guardAdmin(req, res) {
  if (normalizeRole(req.user && req.user.role) !== 'admin') {
    res.status(403).json({ error: 'Opération réservée aux administrateurs.' });
    return false;
  }
  return true;
}

/** ‰tats de traitement des alertes (persistés dans platform_settings). */
async function loadAlertStates() {
  try {
    const r = await query(`SELECT value FROM platform_settings WHERE key = 'alert_states' LIMIT 1`);
    const v = r.rows && r.rows[0] && r.rows[0].value;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function saveAlertStates(states) {
  // Bornage : 500 états les plus récents suffisent, on ne grossit pas indéfiniment.
  const kept = states.slice(-500);
  await query(
    `INSERT INTO platform_settings (key, value, updated_at)
     VALUES ('alert_states', $1::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(kept)]
  );
}

// ”€”€ 4.1 Vue d'ensemble ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/security/overview', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const overview = await securityOverview(scope);
    const alerts = await securityAlerts(scope, await loadAlertStates());
    res.json({
      ...overview,
      visits: {
        derniereRevision: await lastSecurityReview(),
      },
      alertsSummary: {
        total: alerts.length,
        critiques: alerts.filter((a) => a.severity === 'CRITICAL').length,
        avertissements: alerts.filter((a) => a.severity === 'WARNING').length,
        ouvertes: alerts.filter((a) => a.status === 'OUVERTE').length,
      },
      thresholds: THRESHOLDS,
    });
  } catch (err) {
    console.error('[SecurityCenter] overview impossible :', err.message);
    res.status(500).json({ error: 'Indicateurs de sécurité indisponibles.' });
  }
});

/** Date du dernier contrôle de sécurité réellement exécuté (audit). */
async function lastSecurityReview() {
  try {
    const r = await query(
      `SELECT created_at FROM audit_logs WHERE action IN ('CONTR”LE_SECURITE','CONTROLE_SECURITE') ORDER BY created_at DESC LIMIT 1`
    );
    return (r.rows && r.rows[0] && r.rows[0].created_at) || null;
  } catch {
    return null;
  }
}

// ”€”€ 4.3 Alertes ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/security/alerts', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const alerts = await securityAlerts(scope, await loadAlertStates());
    const status = clean(req.query.status).toUpperCase();
    const severity = clean(req.query.severity).toUpperCase();
    const filtered = alerts.filter((a) =>
      (!status || a.status === status) && (!severity || a.severity === severity));
    res.json({
      data: filtered,
      thresholds: THRESHOLDS,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[SecurityCenter] alertes impossibles :', err.message);
    res.status(500).json({ error: 'Alertes indisponibles.' });
  }
});

router.patch('/api/security/alerts/:id', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  const id = clean(req.params.id);
  const status = clean(req.body && req.body.status).toUpperCase();
  const note = clean(req.body && req.body.note).slice(0, 500);
  if (!['ACQUITTEE', 'CLOTUREE', 'OUVERTE'].includes(status)) {
    return res.status(400).json({ error: 'Statut d\'alerte invalide (ACQUITTEE, CLOTUREE ou OUVERTE).' });
  }
  if (status === 'CLOTUREE' && note.length < 5) {
    return res.status(400).json({ error: 'Une note de clôture est obligatoire (5 caractères minimum).' });
  }
  try {
    const states = await loadAlertStates();
    const entry = { id, status, by: actorOf(req.user), at: new Date().toISOString(), note: note || null };
    const idx = states.findIndex((s) => s.id === id);
    if (idx >= 0) states[idx] = entry; else states.push(entry);
    await saveAlertStates(states);
    await recordAudit({
      action: 'ALERTE_SECURITE_TRAITEE', actor: actorOf(req.user),
      details: `Alerte ${id} †’ ${status}${note ? ` — ${note}` : ''}`,
      objectType: 'ALERT', objectRef: id, msdCode: scope, result: 'SUCCESS',
      severity: status === 'OUVERTE' ? 'WARNING' : 'INFO',
    });
    res.json({ success: true, alert: entry });
  } catch (err) {
    console.error('[SecurityCenter] traitement alerte impossible :', err.message);
    res.status(500).json({ error: 'Traitement de l\'alerte impossible.' });
  }
});

// ”€”€ 4.5 Sessions ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// Les jetons ne sont JAMAIS exposés : seule l'empreinte SHA-256 (8 car.) et
// les métadonnées utiles à l'enquête sont renvoyées.
router.get('/api/security/sessions', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  const scope = scopeOf(req.user);
  if (scope === undefined) return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  try {
    const { page, limit, offset } = parsePagination(req);
    const params = [];
    let where = 'WHERE rt.revoked = FALSE AND rt.expires_at > NOW()';
    // Une MSD ne voit que les sessions de SES agents (jointure sur agents).
    if (scope) {
      params.push(scope);
      where += ` AND EXISTS (SELECT 1 FROM agents a WHERE a.id = rt.user_id
                 AND LOWER(TRIM(a.role)) NOT IN ('admin','super admin','superadmin')
                 AND UPPER(COALESCE(a.msd_code,'')) = $${params.length})`;
    }
    const countRes = await query(`SELECT COUNT(*) FROM refresh_tokens rt ${where}`, params);
    const total = parseInt((countRes.rows[0] && countRes.rows[0].count) || '0', 10) || 0;
    const rows = await query(
      `SELECT rt.id, rt.user_id, rt.user_role, rt.created_at, rt.expires_at,
              LEFT(rt.token_hash, 8) AS empreinte,
              a.username, a.first_name, a.last_name, a.msd_code
         FROM refresh_tokens rt
         LEFT JOIN agents a ON a.id = rt.user_id
         ${where}
        ORDER BY rt.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json({
      data: rows.rows.map((r) => ({
        id: r.id,
        utilisateur: r.username || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : `#${r.user_id}`),
        role: r.user_role,
        msdCode: r.msd_code,
        ouverteLe: r.created_at,
        dernierAcces: null, // non suivi : annoncé indisponible plutôt qu'inventé
        expireLe: r.expires_at,
        type: r.user_role === 'citizen' ? 'Assuré' : 'Agent',
        empreinte: r.empreinte,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (err) {
    console.error('[SecurityCenter] sessions impossibles :', err.message);
    res.status(500).json({ error: 'Sessions indisponibles.' });
  }
});

router.delete('/api/security/sessions/:id', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Identifiant de session invalide.' });
  try {
    const own = await query(
      `SELECT rt.id, rt.user_id, a.username, a.msd_code FROM refresh_tokens rt
         LEFT JOIN agents a ON a.id = rt.user_id
        WHERE rt.id = $1 AND rt.revoked = FALSE`,
      [id]
    );
    if (own.rows.length === 0) return res.status(404).json({ error: 'Session introuvable ou déjà close.' });
    const s = own.rows[0];
    if (normalizeRole(req.user.role) !== 'admin' && String(s.msd_code || '').toUpperCase() !== String(req.user.msdCode || '').toUpperCase()) {
      return res.status(403).json({ error: 'Session hors de votre périmètre MSD.' });
    }
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [id]);
    await recordAudit({
      action: 'SESSION_REVOQUEE', actor: actorOf(req.user),
      details: `Session #${id} de ${s.username || s.user_id} révoquée.`,
      objectType: 'SESSION', objectRef: String(id), msdCode: s.msd_code, result: 'SUCCESS',
      severity: 'WARNING',
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[SecurityCenter] révocation session impossible :', err.message);
    res.status(500).json({ error: 'Révocation de session impossible.' });
  }
});

// ”€”€ 4.4 Revue des comptes privilégiés ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/security/privileged', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  const scope = scopeOf(req.user);
  if (scope === undefined) return res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
  try {
    const rows = await query(
      `SELECT a.id, a.username, a.first_name, a.last_name, a.role, a.msd_code, a.status,
              a.created_at, a.locked_until, (COALESCE(a.email,'') <> '') AS has_email,
              (SELECT MAX(rt.created_at) FROM refresh_tokens rt WHERE rt.user_id = a.id) AS dernier_jeton
         FROM agents a
        WHERE LOWER(TRIM(a.role)) IN ('admin', 'super admin', 'superadmin')
          ${scope ? "AND UPPER(COALESCE(a.msd_code,'')) = $1" : ''}
        ORDER BY a.created_at`,
      scope ? [scope] : []
    );
    const now = Date.now();
    res.json({
      data: rows.rows.map((a) => {
        const lastActivity = a.dernier_jeton ? new Date(a.dernier_jeton).getTime() : new Date(a.created_at).getTime();
        const inactifDepuisJours = Math.floor((now - lastActivity) / 86400000);
        return {
          id: a.id,
          utilisateur: a.username,
          nom: [a.last_name, a.first_name].filter(Boolean).join(' '),
          role: a.role,
          msdCode: a.msd_code,
          statut: a.status || 'active',
          creeLe: a.created_at,
          verrouilleJusqua: a.locked_until,
          mfaDisponible: Boolean(a.has_email),
          derniereActivite: a.dernier_jeton,
          inactifDepuisJours,
          revueRecommandee: inactifDepuisJours > THRESHOLDS.staleAccountDays,
        };
      }),
    });
  } catch (err) {
    console.error('[SecurityCenter] comptes privilégiés impossibles :', err.message);
    res.status(500).json({ error: 'Comptes privilégiés indisponibles.' });
  }
});

// ”€”€ 5.5 Rapport Excel de sécurité ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/security/export', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const overview = await securityOverview(scope);
    const alerts = await securityAlerts(scope, await loadAlertStates());
    const ref = reportReference('SEC');
    const audit = await query(
      `SELECT id, action, actor, details, result, object_ref, msd_code, created_at
         FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '30 days'
          ${scope ? "AND UPPER(COALESCE(msd_code,'')) = $1" : ''}
        ORDER BY created_at DESC, id DESC LIMIT 5000`,
      scope ? [scope] : []
    ).catch(() => ({ rows: [] }));
    const lifecycle = await query(
      `SELECT cmu_number, event, reason, actor, actor_role, msd_code, request_ref, created_at
         FROM card_lifecycle_events
        WHERE created_at >= NOW() - INTERVAL '90 days'
          ${scope ? 'AND UPPER(COALESCE(msd_code,\'\')) = $1' : ''}
        ORDER BY created_at DESC LIMIT 5000`,
      scope ? [scope] : []
    ).catch(() => ({ rows: [] }));
    const s = overview.stats;
    const sheets = [
      {
        name: 'Synthese securite',
        sheet: buildKpiSheet([
          ['Périmètre', scope || 'TOUTES (Super Admin)'],
          ['Référence du rapport', ref],
          ['Date de génération', new Date().toISOString()],
          ['Comptes actifs', s.comptesActifs],
          ['Comptes désactivés', s.comptesDesactives],
          ['Comptes verrouillés', s.comptesVerrouilles],
          ['Sessions actives', s.sessionsActives],
          ['Tentatives échouées (fenêtre)', s.tentativesEchouees],
          ['Réinitialisations MDP (7 j)', s.reinitialisationsMdp7j],
          ['Cartes actives', s.cartesActives],
          ['Cartes bloquées', s.cartesBloquees],
          ['Cartes révoquées', s.cartesRevoquees],
          ['Demandes en attente', s.demandesEnAttente],
          ['‰vénements critiques', s.evenementsCritiques],
        ]),
      },
      {
        name: 'Alertes',
        sheet: buildTableSheet(
          ['id', 'category', 'severity', 'title', 'description', 'status', 'handledBy', 'handledAt'],
          alerts.map((a) => ({ ...a, id: a.id.slice(0, 60) })),
          { labels: { id: 'Identifiant', category: 'Catégorie', severity: 'Gravité', title: 'Alerte', description: 'Description', status: 'Statut', handledBy: 'Traité par', handledAt: 'Traité le' } }
        ),
      },
      {
        name: 'Evenements audit',
        sheet: buildTableSheet(
          ['id', 'created_at', 'action', 'actor', 'result', 'object_ref', 'msd_code', 'details'],
          audit.rows || [],
          { labels: { id: 'N°', created_at: 'Date', action: 'Action', actor: 'Acteur', result: 'Résultat', object_ref: 'Objet', msd_code: 'MSD', details: 'Détails' } }
        ),
      },
      {
        name: 'Cartes bloquees/revoquees',
        sheet: buildTableSheet(
          ['cmu_number', 'event', 'reason', 'actor', 'actor_role', 'msd_code', 'request_ref', 'created_at'],
          lifecycle.rows || [],
          { labels: { cmu_number: 'Matricule', event: '‰vénement', reason: 'Motif', actor: 'Acteur', actor_role: 'Rôle', msd_code: 'MSD', request_ref: 'Réf. demande', created_at: 'Date' } }
        ),
      },
      {
        name: 'Controle',
        sheet: buildTableSheet(
          ['label', 'status', 'detail'],
          overview.controls,
          { labels: { label: 'Contrôle', status: '‰tat', detail: 'Détail' } }
        ),
      },
    ];
    const buffer = buildWorkbook(sheets);
    await recordAudit({
      action: 'EXPORT_RAPPORT', actor: actorOf(req.user),
      details: `Rapport Excel de sécurité ${ref} exporté (5 feuilles).`,
      objectType: 'REPORT', objectRef: ref, msdCode: scope, result: 'SUCCESS', severity: 'WARNING',
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="securite-mutualis-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error('[SecurityCenter] export impossible :', err.message);
    res.status(500).json({ error: 'Rapport de sécurité indisponible.' });
  }
});

// ── Sauvegardes vérifiables (§ sauvegardes automatiques et test de restauration) ─
// Une sauvegarde n'est déclarée fiable qu'après une restauration de contrôle
// réussie. Le statut du centre de sécurité reflète l'état RÉEL, jamais une
// promesse.

router.get('/api/security/backups', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  try {
    const backupService = require('./backupService');
    const status = await backupService.backupStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    console.error('[SecurityCenter] état sauvegardes impossible :', err.message);
    res.status(500).json({ error: 'État des sauvegardes indisponible.' });
  }
});

router.post('/api/security/backups/run', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  const verify = !(req.body && req.body.verify === false);
  try {
    const backupService = require('./backupService');
    const result = await backupService.runBackup({ verify, actor: actorOf(req.user) });
    if (!result.ok) return res.status(500).json({ success: false, error: result.message });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[SecurityCenter] sauvegarde impossible :', err.message);
    res.status(500).json({ error: 'Sauvegarde impossible.' });
  }
});

router.post('/api/security/backups/verify/:file', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  try {
    const backupService = require('./backupService');
    const file = String(req.params.file || '');
    // Garde anti-traversée : uniquement le nom, jamais un chemin.
    if (!/^[\w.-]+\.dump$/.test(file)) {
      return res.status(400).json({ error: 'Nom de sauvegarde invalide.' });
    }
    const full = require('path').join(backupService.BACKUP_DIR, file);
    if (!require('fs').existsSync(full)) {
      return res.status(404).json({ error: 'Sauvegarde introuvable.' });
    }
    const cfg = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || '5432',
      user: process.env.DB_USER || 'postgres',
      db: process.env.DB_NAME || 'MUTUALIS DAKAR',
    };
    const result = await backupService.verifyRestore(full, cfg, actorOf(req.user));
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[SecurityCenter] vérification impossible :', err.message);
    res.status(500).json({ error: 'Vérification de restauration impossible.' });
  }
});

// ── MFA des comptes privilégiés (§4.4) ──────────────────────────────────────

router.get('/api/security/mfa/:agentId', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  try {
    const mfa = require('./mfaService');
    const state = await mfa.mfaState(parseInt(req.params.agentId, 10));
    if (!state) return res.status(404).json({ error: 'Compte introuvable.' });
    res.json({ success: true, mfa: state });
  } catch (err) {
    console.error('[SecurityCenter] état MFA impossible :', err.message);
    res.status(500).json({ error: 'État MFA indisponible.' });
  }
});

router.post('/api/security/mfa/:agentId/enable', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  try {
    const mfa = require('./mfaService');
    const result = await mfa.enableMfa(parseInt(req.params.agentId, 10), actorOf(req.user));
    if (!result.ok) return res.status(result.status || 400).json({ error: result.message });
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[SecurityCenter] activation MFA impossible :', err.message);
    res.status(500).json({ error: 'Activation MFA impossible.' });
  }
});

router.post('/api/security/mfa/:agentId/disable', async (req, res) => {
  if (!guardAdmin(req, res)) return;
  const reason = clean(req.body && req.body.reason).slice(0, 300);
  if (!reason) {
    return res.status(400).json({ error: 'Un motif est obligatoire pour désactiver la MFA (opération sensible).' });
  }
  try {
    const mfa = require('./mfaService');
    const result = await mfa.disableMfa(parseInt(req.params.agentId, 10), actorOf(req.user), reason);
    if (!result.ok) return res.status(result.status || 400).json({ error: result.message });
    res.json({ success: true, message: result.message });
  } catch (err) {
    console.error('[SecurityCenter] désactivation MFA impossible :', err.message);
    res.status(500).json({ error: 'Désactivation MFA impossible.' });
  }
});

module.exports = { router };
