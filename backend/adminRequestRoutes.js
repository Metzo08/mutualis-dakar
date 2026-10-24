/**
 * adminRequestRoutes.js — Tableau de suivi des demandes administratives
 * (Module 3.9 du cahier des charges — « Gestion des comptes et des cartes »)
 *
 * Chaque opération sensible de l'assuré (blocage, déblocage, révocation,
 * remplacement, réinitialisation de mot de passe, modification de fiche)
 * peut être enregistrée comme DEMANDE avant d'être exécutée :
 *
 *   EN_ATTENTE †’ IDENTITE_A_VERIFIER †’ EN_COURS †’ TRAITEE | REFUSEE | ANNULEE
 *
 * La vérification d'identité est une étape OBLIGATOIRE avant toute action
 * sensible : le nom + la pièce d'identité ne suffisent JAMAIS à authentifier
 * une personne (§3.2). L'agent consigne la méthode de vérification utilisée
 * (présence agent habilité, pièce + question secrète MSD, etc.).
 *
 * Cloisonnement MSD + audit_logs sur toute écriture. Lecture pure côté
 * assuré : aucun secret, aucun jeton, aucun mot de passe dans les réponses.
 */

const express = require('express');
const { query } = require('./db');
const { normalizeRole } = require('./rbac');

const router = express.Router();

const clean = (v) => String(v || '').trim();

const STATUSES = [
  'EN_ATTENTE', 'IDENTITE_A_VERIFIER', 'EN_COURS',
  'EN_ATTENTE_VALIDATION', 'TRAITEE', 'REFUSEE', 'ANNULEE'
];

const OPERATION_TYPES = [
  'BLOCAGE_CARTE', 'DEBLOCAGE_CARTE', 'REVOCATION_CARTE', 'REMPLACEMENT_CARTE',
  'SUPPRESSION_CARTE', 'RESET_MOT_DE_PASSE', 'MODIFICATION_FICHE',
  'CHANGEMENT_MSD', 'AUTRE'
];

const IDENTITY_METHODS = [
  'AGENT_HABILITE_PRESENT', 'PIECE_PLUS_VERIFICATION_MSD',
  'TEMOIN_COMMUNAUTE', 'NON_VERIFIEE'
];

const msdOfUser = (user) => {
  if (!user) return null;
  if (normalizeRole(user.role) === 'admin') return null; // Super Admin : tout
  return user.msdCode ? String(user.msdCode).toUpperCase() : null; // Super Admin sans MSD = portï¿½e totale (son rï¿½le)
};

/** Migration douce de la table si absente (idempotent). */
async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS admin_requests (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(40) UNIQUE NOT NULL,
    cmu_number VARCHAR(60),
    operation_type VARCHAR(40) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'EN_ATTENTE',
    reason TEXT,
    identity_method VARCHAR(40),
    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    requested_by VARCHAR(100) NOT NULL,
    requested_by_role VARCHAR(30),
    msd_code VARCHAR(30),
    resolution_note TEXT,
    resolved_by VARCHAR(100),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

// ”€”€ Créer une demande ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// POST /api/admin-requests { cmuNumber, operationType, reason, identityMethod }
router.post('/api/admin-requests', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { cmuNumber, operationType, reason, identityMethod } = req.body || {};
  if (!OPERATION_TYPES.includes(clean(operationType))) {
    return res.status(400).json({ error: `Type d'opération invalide. Autorisés : ${OPERATION_TYPES.join(', ')}.` });
  }
  if (!clean(reason)) {
    return res.status(400).json({ error: 'Motif obligatoire.' });
  }
  const msd = msdOfUser(user);

  try {
    await ensureTable();
    const identMethod = clean(identityMethod);
    if (identMethod && !IDENTITY_METHODS.includes(identMethod)) {
      return res.status(400).json({ error: `Méthode de vérification d'identité invalide. Autorisées : ${IDENTITY_METHODS.join(', ')}.` });
    }
    // Une demande sensible n'est JAMAIS considérée vérifiée d'office :
    // seule une méthode explicite approuvée par la MSD la marque vérifiée.
    const verified = identMethod && identMethod !== 'NON_VERIFIEE';

    // Référence lisible et unique : REQ-YYYYMMDD-HHMMSS-xxxx
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    const reference = `REQ-${stamp}-${suffix}`;

    const status = verified ? 'EN_COURS' : 'IDENTITE_A_VERIFIER';
    await query(
      `INSERT INTO admin_requests
        (reference, cmu_number, operation_type, status, reason, identity_method,
         identity_verified, requested_by, requested_by_role, msd_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [reference, clean(cmuNumber) || null, clean(operationType), status,
       clean(reason), identMethod || null, verified,
       clean(user.username || user.id), role, msd || null]
    );
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1,$2,$3)`,
      ['DEMANDE_ADMIN_CREEE', clean(user.username || user.id),
       `${reference} — ${clean(operationType)} — assuré ${clean(cmuNumber) || 'n/a'} — identité : ${verified ? 'vérifiée (' + (identMethod) + ')' : 'NON vérifiée'}`]
    );
    return res.json({ success: true, reference, status });
  } catch (err) {
    console.error('[AdminRequests] création impossible :', err.message);
    return res.status(500).json({ error: 'Création de la demande impossible.' });
  }
});

// ”€”€ Lister / rechercher les demandes (paginé, cloisonné MSD) ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// GET /api/admin-requests?status=&type=&q=&page=&limit=
router.get('/api/admin-requests', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const msd = msdOfUser(user);
  const { status, type, q } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let pi = 1;
  if (msd) { conditions.push(`msd_code = $${pi++}`); params.push(msd); }
  if (clean(status)) { conditions.push(`status = $${pi++}`); params.push(clean(status)); }
  if (clean(type)) { conditions.push(`operation_type = $${pi++}`); params.push(clean(type)); }
  if (clean(q)) {
    conditions.push(`(reference ILIKE $${pi} OR cmu_number ILIKE $${pi} OR reason ILIKE $${pi})`);
    params.push(`%${clean(q)}%`);
    pi++;
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    await ensureTable();
    const rows = await query(
      `SELECT reference, cmu_number, operation_type, status, reason, identity_method,
              identity_verified, requested_by, requested_by_role, msd_code,
              resolution_note, resolved_by, resolved_at, created_at, updated_at
         FROM admin_requests ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${pi} OFFSET $${pi + 1}`,
      [...params, limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*)::int AS n FROM admin_requests ${where}`, params);
    const total = countRes.rows[0]?.n || 0;
    return res.json({
      data: rows.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[AdminRequests] lecture impossible :', err.message);
    return res.status(500).json({ error: 'Lecture des demandes impossible.' });
  }
});

// ”€”€ Faire évoluer le statut d'une demande ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// PATCH /api/admin-requests/:reference { status, resolutionNote }
router.patch('/api/admin-requests/:reference', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { status, resolutionNote } = req.body || {};
  const newStatus = clean(status);
  if (!STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: `Statut invalide. Autorisés : ${STATUSES.join(', ')}.` });
  }
  const msd = msdOfUser(user);
  try {
    await ensureTable();
    const sel = msd
      ? await query(`SELECT id, msd_code FROM admin_requests WHERE reference = $1`, [clean(req.params.reference)])
      : await query(`SELECT id, msd_code FROM admin_requests WHERE reference = $1`, [clean(req.params.reference)]);
    if (sel.rows.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });
    if (msd && String(sel.rows[0].msd_code || '').toUpperCase() !== msd) {
      return res.status(403).json({ error: 'Demande hors de votre périmètre MSD.' });
    }
    const closed = ['TRAITEE', 'REFUSEE', 'ANNULEE'].includes(newStatus);
    await query(
      `UPDATE admin_requests
          SET status = $2,
              resolution_note = CASE WHEN $3::text = '' THEN resolution_note ELSE $3 END,
              resolved_by = CASE WHEN $4 THEN $5 ELSE resolved_by END,
              resolved_at = CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE resolved_at END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [sel.rows[0].id, newStatus, clean(resolutionNote), closed, clean(user.username || user.id)]
    );
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1,$2,$3)`,
      ['DEMANDE_ADMIN_MAJ', clean(user.username || user.id), `${clean(req.params.reference)} †’ ${newStatus}${clean(resolutionNote) ? ' — ' + clean(resolutionNote) : ''}`]
    );
    return res.json({ success: true, reference: clean(req.params.reference), status: newStatus });
  } catch (err) {
    console.error('[AdminRequests] mise à jour impossible :', err.message);
    return res.status(500).json({ error: 'Mise à jour impossible.' });
  }
});

// ”€”€ Statistiques (pour le centre de sécurité) ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// GET /api/admin-requests/stats
router.get('/api/admin-requests/stats', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const msd = msdOfUser(user);
  try {
    await ensureTable();
    const pending = msd
      ? await query(`SELECT COUNT(*)::int AS n FROM admin_requests WHERE status NOT IN ('TRAITEE','REFUSEE','ANNULEE') AND msd_code = $1`, [msd])
      : await query(`SELECT COUNT(*)::int AS n FROM admin_requests WHERE status NOT IN ('TRAITEE','REFUSEE','ANNULEE')`);
    return res.json({ success: true, pending: pending.rows[0]?.n || 0 });
  } catch (err) {
    console.error('[AdminRequests] stats impossibles :', err.message);
    return res.status(500).json({ error: 'Statistiques indisponibles.' });
  }
});

module.exports = { router, STATUSES, OPERATION_TYPES, IDENTITY_METHODS };
