// Routes API pour les modules additionnels MUTUALIS DAKAR :
// 1. Suivi des cotisations + rappels automatiques
// 2. Espace partenaire (structures de soins conventionnées)
// 3. Statistiques comparatives inter-régions
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query, pool } = require('./db');
const { validate } = require('./validateMiddleware');
const { parsePagination } = require('./pagination');
const { authenticateToken, requireRole } = require('./rbac');
const {
  cotisationCreateSchema,
  partnerLoginSchema,
  partnerStructureCreateSchema,
  tierPayantDeclareSchema,
  notificationSendSchema
} = require('./validators');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';
const PARTNER_TOKEN_TTL = '12h';

// Middleware d'authentification partenaire (structures de soins)
function authenticatePartner(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès refusé. Jeton manquant.' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Jeton invalide ou expiré.' });
    if (user.role !== 'partner') return res.status(403).json({ error: 'Compte partenaire requis.' });
    req.user = user;
    next();
  });
}

// ============================================================================
// 1. SUIVI DES COTISATIONS + RAPPELS AUTOMATIQUES
// ============================================================================

// Enregistrer une cotisation (agent/admin ou auto via paiement)
router.post('/api/cotisations', authenticateToken, requireRole('agent', 'admin'), validate(cotisationCreateSchema), async (req, res) => {
  try {
    const { beneficiaryId, cmuNumber, phone, amount, paymentMethod, paymentReference, periodStart, periodEnd } = req.body;
    const result = await query(
      `INSERT INTO cotisations (beneficiary_id, cmu_number, phone, amount, payment_method, payment_reference, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid') RETURNING id`,
      [beneficiaryId || null, cmuNumber || null, phone, amount, paymentMethod, paymentReference || null, periodStart, periodEnd]
    );
    // Active le bénéficiaire si lié
    if (beneficiaryId) {
      await query("UPDATE beneficiaries SET status = 'active' WHERE id = $1", [beneficiaryId]);
    }
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['ENREGISTREMENT_COTISATION', req.user.username || 'agent', `Cotisation de ${amount} FCFA enregistrée pour ${phone} (${periodStart} → ${periodEnd}).`]
    );
    res.status(201).json({ success: true, cotisationId: result.rows[0].id });
  } catch (err) {
    console.error('Erreur enregistrement cotisation :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Liste des cotisations (agent/admin : tout ; citoyen : seulement les siennes)
router.get('/api/cotisations', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const { page, limit, offset } = parsePagination(req);
    const isAgent = ['agent', 'admin'].includes(req.user.role);
    let whereSql = ' WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (!isAgent) {
      // Citoyen : par téléphone ou beneficiary_id
      whereSql += ` AND (beneficiary_id = $${paramIdx} OR phone = $${paramIdx + 1})`;
      params.push(req.user.id, req.user.phone || '');
      paramIdx += 2;
    }
    if (status) {
      whereSql += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM cotisations${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);
    const dataRes = await query(
      `SELECT * FROM cotisations${whereSql} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur liste cotisations :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Rappels de renouvellement : détecte les cotisations expirant dans ≤ 60 jours ou déjà expirées,
// et génère une relance uniquement si aucun rappel n'a été envoyé au cours des 7 derniers jours.
router.post('/api/cotisations/send-reminders', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const toRemind = await query(
      `SELECT id, beneficiary_id, phone, cmu_number, period_end, amount
       FROM cotisations c1
       WHERE status = 'paid'
         AND period_end <= NOW() + INTERVAL '60 days'
         AND NOT EXISTS (
           SELECT 1 FROM cotisations c2
           WHERE c2.beneficiary_id = c1.beneficiary_id
             AND c2.status = 'paid'
             AND c2.period_end > NOW() + INTERVAL '60 days'
         )
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.beneficiary_id = c1.beneficiary_id
             AND n.type = 'rappel'
             AND n.created_at > NOW() - INTERVAL '7 days'
         )
       ORDER BY period_end ASC LIMIT 500`
    );

    let sentCount = 0;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const c of toRemind.rows) {
        const isExpired = new Date(c.period_end) < new Date();
        const msg = isExpired
          ? `Votre cotisation CMU a expiré le ${new Date(c.period_end).toLocaleDateString('fr-FR')}. Renouvelez-la via le portail MUTUALIS DAKAR pour maintenir votre couverture.`
          : `Rappel : votre cotisation CMU expire le ${new Date(c.period_end).toLocaleDateString('fr-FR')}. Pensez à la renouveler en ligne.`;
        
        await client.query(
          `INSERT INTO notifications (beneficiary_id, channel, recipient, type, title, body, status)
           VALUES ($1, 'sms', $2, 'rappel', 'Rappel cotisation', $3, 'pending')`,
          [c.beneficiary_id, c.phone, msg]
        );
        sentCount++;
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const actor = req.user.username || 'agent';
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['ENVOI_RAPPELS_COTISATION', actor, `${sentCount} rappels hebdomadaires de cotisation générés.`]
    );

    res.json({
      success: true,
      remindersSent: sentCount,
      expiringSoon: toRemind.rows.filter(r => new Date(r.period_end) >= new Date()).length,
      expired: toRemind.rows.filter(r => new Date(r.period_end) < new Date()).length,
      message: `${sentCount} rappels hebdomadaires envoyés avec succès.`
    });
  } catch (err) {
    console.error('Erreur envoi rappels :', err);
    res.status(500).json({ error: 'Erreur lors de la génération des rappels.' });
  }
});

// ============================================================================
// 2. ESPACE PARTENAIRE (structures de soins conventionnées)
// ============================================================================

// Connexion partenaire
router.post('/api/auth/partner/login', validate(partnerLoginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    const userRes = await query(
      `SELECT pu.*, ps.name AS structure_name, ps.coverage_rate, ps.type AS structure_type
       FROM partner_users pu JOIN partner_structures ps ON pu.structure_id = ps.id
       WHERE pu.username = $1 LIMIT 1`,
      [username]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Compte partenaire introuvable.' });
    }
    const p = userRes.rows[0];
    const match = await bcrypt.compare(password, p.password_hash);
    if (!match) return res.status(401).json({ error: 'Mot de passe incorrect.' });

    const token = jwt.sign(
      { id: p.id, role: 'partner', username: p.username, structureId: p.structure_id, structureName: p.structure_name },
      JWT_SECRET,
      { expiresIn: PARTNER_TOKEN_TTL }
    );
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CONNEXION_PARTENAIRE', username, `Connexion partenaire (${p.structure_name}).`]
    );
    res.json({
      success: true,
      token,
      partner: {
        id: p.id,
        username: p.username,
        contactName: p.contact_name,
        structureId: p.structure_id,
        structureName: p.structure_name,
        structureType: p.structure_type,
        coverageRate: p.coverage_rate
      }
    });
  } catch (err) {
    console.error('Erreur login partenaire :', err);
    res.status(500).json({ error: 'Erreur interne de connexion.' });
  }
});

// Vérification de carte CMU (partenaire authentifié) — enrichi avec couverture
router.get('/api/partner/verify-card/:cmuNumber', authenticatePartner, async (req, res) => {
  try {
    const { cmuNumber } = req.params;
    const bRes = await query(
      `SELECT id, first_name, last_name, phone, mutuelle_name, package_type, cmu_number, status, photo_url
       FROM beneficiaries WHERE cmu_number = $1 LIMIT 1`,
      [cmuNumber]
    );
    if (bRes.rows.length === 0) return res.status(404).json({ valid: false, error: 'Carte introuvable.' });
    const b = bRes.rows[0];
    // Vérifie la cotisation active
    const cotRes = await query(
      `SELECT * FROM cotisations WHERE beneficiary_id = $1 AND status = 'paid' AND period_end >= NOW() ORDER BY period_end DESC LIMIT 1`,
      [b.id]
    );
    const hasActiveCotisation = cotRes.rows.length > 0;
    res.json({
      valid: b.status === 'active' && hasActiveCotisation,
      status: b.status,
      hasActiveCotisation,
      cotisationEnd: cotRes.rows[0]?.period_end || null,
      firstName: b.first_name,
      lastName: b.last_name,
      phone: b.phone,
      mutuelleName: b.mutuelle_name,
      packageType: b.package_type,
      cmuNumber: b.cmu_number,
      structureCoverageRate: req.user.coverageRate || 80,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erreur vérification partenaire :', err);
    res.status(500).json({ valid: false, error: 'Erreur interne.' });
  }
});

// Déclaration de tiers-payant (la structure déclare un soin pris en charge)
router.post('/api/partner/tier-payant', authenticatePartner, validate(tierPayantDeclareSchema), async (req, res) => {
  try {
    const { cmuNumber, beneficiaryName, careType, careDescription, amount } = req.body;
    // Vérifie la validité de la carte
    const bRes = await query('SELECT id, status FROM beneficiaries WHERE cmu_number = $1 LIMIT 1', [cmuNumber]);
    if (bRes.rows.length === 0) return res.status(404).json({ error: 'Carte CMU introuvable.' });
    const b = bRes.rows[0];
    const cotRes = await query(
      `SELECT id FROM cotisations WHERE beneficiary_id = $1 AND status = 'paid' AND period_end >= NOW() LIMIT 1`,
      [b.id]
    );
    if (b.status !== 'active' || cotRes.rows.length === 0) {
      return res.status(403).json({ error: 'Couverture inactive ou cotisation expirée. Tiers-payant refusé.' });
    }
    // Crée une claim au nom de la structure
    const coverageRate = req.user.coverageRate || 80;
    const reimbursedAmount = Math.round((amount * coverageRate) / 100);
    const claimRes = await query(
      `INSERT INTO claims (beneficiary_id, beneficiary_name, phone, structure_name, care_type, care_description, amount, coverage_rate, reimbursed_amount, status, treatment_date, processed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved', CURRENT_DATE, $10) RETURNING id`,
      [b.id, beneficiaryName, '', req.user.structureName || 'Structure', careType, careDescription || '', amount, coverageRate, reimbursedAmount, req.user.username]
    );
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['DECLARATION_TIERS_PAYANT', req.user.username, `Tiers-payant déclaré par ${req.user.structureName} pour ${beneficiaryName} (${amount} FCFA, prise en charge ${reimbursedAmount} FCFA).`]
    );
    res.status(201).json({
      success: true,
      claimId: claimRes.rows[0].id,
      reimbursedAmount,
      message: 'Tiers-payant enregistré et approuvé automatiquement.'
    });
  } catch (err) {
    console.error('Erreur déclaration tiers-payant :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Statistiques d'activité de la structure partenaire
router.get('/api/partner/stats', authenticatePartner, async (req, res) => {
  try {
    const structureName = req.user.structureName;
    const totalDeclarations = await query(
      `SELECT COUNT(*) FROM claims WHERE structure_name = $1`,
      [structureName]
    );
    const totalReimbursed = await query(
      `SELECT COALESCE(SUM(reimbursed_amount),0) AS sum FROM claims WHERE structure_name = $1 AND status IN ('approved','paid')`,
      [structureName]
    );
    const byCareType = await query(
      `SELECT care_type, COUNT(*) AS count, SUM(reimbursed_amount) AS total FROM claims WHERE structure_name = $1 GROUP BY care_type`,
      [structureName]
    );
    const recent = await query(
      `SELECT * FROM claims WHERE structure_name = $1 ORDER BY submitted_at DESC LIMIT 10`,
      [structureName]
    );
    res.json({
      structureName,
      totalDeclarations: parseInt(totalDeclarations.rows[0].count || '0', 10),
      totalReimbursed: parseInt(totalReimbursed.rows[0].sum || '0', 10),
      byCareType: byCareType.rows,
      recent
    });
  } catch (err) {
    console.error('Erreur stats partenaire :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// Gestion des structures (admin/agent)
router.get('/api/partners/structures', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query('SELECT * FROM partner_structures ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur liste structures :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

router.post('/api/partners/structures', authenticateToken, requireRole('admin'), validate(partnerStructureCreateSchema), async (req, res) => {
  try {
    const { name, type, commune, phone, email, address, agreementNumber, coverageRate } = req.body;
    const result = await query(
      `INSERT INTO partner_structures (name, type, commune, phone, email, address, agreement_number, coverage_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, type, commune || null, phone, email || '', address || null, agreementNumber, coverageRate]
    );
    res.status(201).json({ success: true, structure: result.rows[0] });
  } catch (err) {
    console.error('Erreur création structure :', err);
    if (err.code === '23505') return res.status(400).json({ error: 'N° agrément déjà utilisé.' });
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ============================================================================
// 3. STATISTIQUES COMPARATIVES INTER-RÉGIONS
// ============================================================================

// Comparaison des indicateurs CSU entre départements/régions de Dakar
router.get('/api/dashboard/regional-comparison', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    // Bénéficiaires par mutuelle avec commune + région
    const byRegion = await query(
      `SELECT m.region, COUNT(b.id) AS beneficiaries,
              COUNT(DISTINCT b.mutuelle_name) AS mutuelles,
              COUNT(*) FILTER (WHERE b.status = 'active') AS active
       FROM beneficiaries b
       LEFT JOIN mutuelles m ON b.mutuelle_name = m.name
       GROUP BY m.region ORDER BY beneficiaries DESC`
    );

    // Demandes de prise en charge par région (via la mutuelle du bénéficiaire)
    const claimsByRegion = await query(
      `SELECT m.region, COUNT(c.id) AS claims,
              COALESCE(SUM(c.reimbursed_amount),0) AS reimbursed
       FROM claims c
       LEFT JOIN beneficiaries b ON c.beneficiary_id = b.id
       LEFT JOIN mutuelles m ON b.mutuelle_name = m.name
       GROUP BY m.region ORDER BY claims DESC`
    );

    // Taux de pénétration par commune (bénéficiaires / nb mutuelles)
    const penetrationByCommune = await query(
      `SELECT m.commune, COUNT(b.id) AS beneficiaries,
              COUNT(DISTINCT b.mutuelle_name) AS mutuelles
       FROM beneficiaries b
       LEFT JOIN mutuelles m ON b.mutuelle_name = m.name
       WHERE m.commune IS NOT NULL
       GROUP BY m.commune ORDER BY beneficiaries DESC LIMIT 20`
    );

    // Cotisations par statut (pour identifier les retards)
    const cotisationsByStatus = await query(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount),0) AS total
       FROM cotisations GROUP BY status`
    );

    // Top 5 mutuelles par nombre d'adhérents (avec région)
    const topMutuelles = await query(
      `SELECT m.name, m.region, m.commune, COUNT(b.id) AS beneficiaries
       FROM mutuelles m LEFT JOIN beneficiaries b ON b.mutuelle_name = m.name
       GROUP BY m.name, m.region, m.commune
       ORDER BY beneficiaries DESC LIMIT 10`
    );

    res.json({
      byRegion: byRegion.rows,
      claimsByRegion: claimsByRegion.rows,
      penetrationByCommune: penetrationByCommune.rows,
      cotisationsByStatus: cotisationsByStatus.rows,
      topMutuelles: topMutuelles.rows
    });
  } catch (err) {
    console.error('Erreur comparaison régionale :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
