/**
 * cardLifecycleRoutes.js — Cycle de vie des cartes (Module 3 du cahier des charges)
 *
 * RÈGLE FONDAMENTALE : la carte et le dossier sont deux objets distincts.
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
 *   active  → blocked   (perte, vol, fraude suspectée, demande assuré)
 *   blocked → active    (déblocage, motif obligatoire)
 *   active|blocked → revoked (révocation logique, historique conservé)
 *   revoked → replaced  (nouvelle carte créée, lien ancien→nouveau)
 *
 * Cloisonnement MSD : un agent ne peut agir que sur les cartes de SA MSD.
 * Le Super Admin (sans msdCode) supervise tout. Les actions sont journalisées
 * dans audit_logs ET card_lifecycle_events.
 */

const express = require('express');
const { query } = require('./db');
const { normalizeRole } = require('./rbac');

const router = express.Router();

// Motifs de blocage autorisés (validation serveur — jamais libre)
const BLOCK_REASONS = ['PERTE', 'VOL', 'FRAUDE_SUSPECTEE', 'DEMANDE_ASSURE', 'ERREUR_ADMIN'];
const REVOKE_REASONS = ['FRAUDE_CONFIRMEE', 'DOUBLON', 'DOSSIER_CLOSE', 'DEMANDE_ASSURE', 'ERREUR_ADMIN'];

const clean = (v) => String(v || '').trim();

const msdOfUser = (user) => {
  if (!user) return null;
  if (normalizeRole(user.role) === 'admin') return null; // Super Admin : tout
  return user.msdCode ? String(user.msdCode).toUpperCase() : undefined;
};

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

// ── Bloquer une carte ─────────────────────────────────────────────────────
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

// ── Débloquer une carte ───────────────────────────────────────────────────
// POST /api/cards/:cmuNumber/unblock { reason, details }
router.post('/api/cards/:cmuNumber/unblock', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { reason, details } = req.body || {};
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

// ── Révoquer une carte ────────────────────────────────────────────────────
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

// ── Remplacer une carte (ancienne → nouvelle) ─────────────────────────────
// POST /api/cards/:cmuNumber/replace { newCmuNumber, reason, details }
// Révoque l'ancienne et relie les deux via card_replaced_by.
router.post('/api/cards/:cmuNumber/replace', async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Authentification requise.' });
  const role = normalizeRole(user.role);
  if (role !== 'agent' && role !== 'admin') {
    return res.status(403).json({ error: 'Réservé aux agents habilités.' });
  }
  const { newCmuNumber, reason, details } = req.body || {};
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

// ── Historique du cycle de vie d'une carte ────────────────────────────────
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

// ── Réinitialisation forcée du mot de passe compte assuré ─────────────────
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
    const crypto = require('crypto');
    const code = crypto.randomBytes(6).toString('hex').toUpperCase(); // 12 hex
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await query(
      `INSERT INTO password_resets (cmu_number, code_hash, expires_at, requested_by, used, created_at)
       VALUES ($1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)`,
      [card.cmu_number, hash, expiresAt, clean(user.username || user.id)]
    ).catch(async () => {
      // Table absente : créer puis réessayer une fois (migration douce).
      await query(`CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        cmu_number VARCHAR(60) NOT NULL,
        code_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        requested_by VARCHAR(100),
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await query(
        `INSERT INTO password_resets (cmu_number, code_hash, expires_at, requested_by, used, created_at)
         VALUES ($1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)`,
        [card.cmu_number, hash, expiresAt, clean(user.username || user.id)]
      );
    });
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['PASSWORD_RESET', clean(user.username || user.id), `Réinitialisation forcée demandée pour ${card.cmu_number}${requestRef ? ' (réf. ' + clean(requestRef) + ')' : ''}`]
    );
    // ⚠️ Le code est renvoyé UNE SEULE fois à l'agent habilité, qui le transmet
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

module.exports = { router, BLOCK_REASONS, REVOKE_REASONS };
