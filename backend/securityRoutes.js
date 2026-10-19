const express = require('express');
const { query } = require('./db');
const { authenticateToken, requireRole, normalizeRole } = require('./rbac');

const router = express.Router();

const msdOfUser = (user) => {
  if (!user) return null;
  if (normalizeRole(user.role) === 'admin') return null; // Super Admin : tout
  return user.msdCode ? String(user.msdCode).toUpperCase() : undefined;
};

// ════════════════════════════════════════════════════════════════════════════════
// CENTRE DE SÉCURITÉ — Dashboard consolidé
// ════════════════════════════════════════════════════════════════════════════════
// GET /api/security/dashboard — statistiques de sécurité cloisonnées par MSD
// ════════════════════════════════════════════════════════════════════════════════
router.get('/api/security/dashboard', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const user = req.user;
  const msd = msdOfUser(user);
  const msdFilter = msd ? `AND UPPER(b.msd_code) = $${1}` : '';
  const params = msd ? [msd] : [];

  try {
    // Cartes bloquées
    const blocked = await query(
      `SELECT COUNT(*) AS n FROM beneficiaries b
       WHERE b.card_status = 'blocked' ${msdFilter}`,
      params
    );
    // Cartes révoquées
    const revoked = await query(
      `SELECT COUNT(*) AS n FROM beneficiaries b
       WHERE b.card_status = 'revoked' ${msdFilter}`,
      params
    );
    // Cartes actives
    const active = await query(
      `SELECT COUNT(*) AS n FROM beneficiaries b
       WHERE b.card_status = 'active' ${msdFilter}`,
      params
    );
    // Réinitialisations de mot de passe récentes (7j)
    const resets = await query(
      `SELECT COUNT(*) AS n FROM password_resets pr
       WHERE pr.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
         ${msd ? `AND EXISTS (SELECT 1 FROM beneficiaries b WHERE b.cmu_number = pr.cmu_number AND UPPER(b.msd_code) = $${params.length + 1})` : ''}`,
      [...params, msd].filter((_, i) => i < params.length || msd)
    );
    // Événements cycle de vie récents (7j)
    const events = await query(
      `SELECT COUNT(*) AS n FROM card_lifecycle_events cle
       WHERE cle.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
         ${msd ? `AND UPPER(cle.msd_code) = $${params.length + 1}` : ''}`,
      [...params, msd].filter((_, i) => i < params.length || msd)
    );
    // Connexions suspectes récentes (audit_logs catégorie SECURITY, 7j)
    const securityEvents = await query(
      `SELECT COUNT(*) AS n FROM audit_logs al
       WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
         ${msd ? `AND al.details ILIKE $${params.length + 1}` : ''}`,
      [...params, msd ? `%${msd}%` : ''].filter((_, i) => i < params.length || msd)
    );

    res.json({
      success: true,
      msd: msd || 'TOUTES (Super Admin)',
      stats: {
        cartesBloquees: Number(blocked.rows[0]?.n || 0),
        cartesRevoquees: Number(revoked.rows[0]?.n || 0),
        cartesActives: Number(active.rows[0]?.n || 0),
        reinitialisationsMdp7j: Number(resets.rows[0]?.n || 0),
        evenementsCycleVie7j: Number(events.rows[0]?.n || 0),
        evenementsSecurite7j: Number(securityEvents.rows[0]?.n || 0),
      },
    });
  } catch (err) {
    console.error('[Security] dashboard error:', err.message);
    res.status(500).json({ error: 'Indisponible.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// GET /api/security/audit — journal d'audit filtré (événements sensibles)
// ════════════════════════════════════════════════════════════════════════════════
router.get('/api/security/audit', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const user = req.user;
  const msd = msdOfUser(user);
  const { page = 1, limit = 50, action, actor, from, to } = req.query;

  const p = parseInt(page, 10) || 1;
  const l = Math.min(parseInt(limit, 10) || 50, 200);
  const offset = (p - 1) * l;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (msd) {
    conditions.push(`al.details ILIKE $${paramIdx++}`);
    params.push(`%${msd}%`);
  }
  if (action) {
    conditions.push(`al.action ILIKE $${paramIdx++}`);
    params.push(`%${action}%`);
  }
  if (actor) {
    conditions.push(`al.actor ILIKE $${paramIdx++}`);
    params.push(`%${actor}%`);
  }
  if (from) {
    conditions.push(`al.created_at >= $${paramIdx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`al.created_at <= $${paramIdx++}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await query(
      `SELECT id, action, actor, details, created_at
       FROM audit_logs al
       ${where}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, l, offset]
    );
    const countRes = await query(
      `SELECT COUNT(*) AS n FROM audit_logs al ${where}`,
      params
    );
    const total = Number(countRes.rows[0]?.n || 0);

    res.json({
      data: rows,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
        hasNext: p * l < total,
        hasPrev: p > 1,
      },
    });
  } catch (err) {
    console.error('[Security] audit error:', err.message);
    res.status(500).json({ error: 'Indisponible.' });
  }
});

module.exports = { router };