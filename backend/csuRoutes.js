// Routes API CSU (Couverture Santé Universelle) pour MUTUALIS DAKAR.
// Programmes CSU, demandes de prise en charge (claims), notifications SMS/WhatsApp,
// tableau de bord agent (KPIs), et carte CMU numérique vérifiable.
const express = require('express');
const { query } = require('./db');
const { validate } = require('./validateMiddleware');
const { parsePagination } = require('./pagination');
const { authenticateToken, requireRole } = require('./rbac');
const {
  claimCreateSchema,
  claimStatusSchema,
  csuProgramCreateSchema,
  notificationSendSchema
} = require('./validators');

const router = express.Router();

// ============================================================================
// PROGRAMMES CSU (gratuités nationales)
// ============================================================================

// Liste publique des programmes CSU actifs
router.get('/api/csu/programs', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM csu_programs WHERE is_active = TRUE ORDER BY display_order ASC, id ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération programmes CSU :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Détail d'un programme par slug (public)
router.get('/api/csu/programs/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await query('SELECT * FROM csu_programs WHERE slug = $1 LIMIT 1', [slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Programme introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur détail programme CSU :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Création / mise à jour d'un programme (admin uniquement)
router.post('/api/csu/programs', authenticateToken, requireRole('admin'), validate(csuProgramCreateSchema), async (req, res) => {
  try {
    const { slug, titleFr, titleWo, descriptionFr, descriptionWo, icon, targetAudience, coverageRate, displayOrder } = req.body;
    const result = await query(
      `INSERT INTO csu_programs (slug, title_fr, title_wo, description_fr, description_wo, icon, target_audience, coverage_rate, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (slug) DO UPDATE SET title_fr=$2, title_wo=$3, description_fr=$4, description_wo=$5, icon=$6, target_audience=$7, coverage_rate=$8, display_order=$9, updated_at=NOW()
       RETURNING *`,
      [slug, titleFr, titleWo || null, descriptionFr, descriptionWo || null, icon, targetAudience || null, coverageRate, displayOrder]
    );
    res.status(201).json({ success: true, program: result.rows[0] });
  } catch (err) {
    console.error('Erreur création programme CSU :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Désactivation d'un programme (admin)
router.delete('/api/csu/programs/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE csu_programs SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [id]);
    res.json({ success: true, message: 'Programme désactivé.' });
  } catch (err) {
    console.error('Erreur désactivation programme :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ============================================================================
// DEMANDES DE PRISE EN CHARGE (claims / remboursements / tiers-payant)
// ============================================================================

// Dépôt d'une demande de prise en charge (citoyen authentifié ou public pour tierce partie)
router.post('/api/claims', validate(claimCreateSchema), async (req, res) => {
  try {
    const {
      beneficiaryId, beneficiaryName, phone, structureName, careType,
      careDescription, amount, coverageRate, treatmentDate
    } = req.body;
    const reimbursedAmount = Math.round((amount * coverageRate) / 100);
    const result = await query(
      `INSERT INTO claims (beneficiary_id, beneficiary_name, phone, structure_name, care_type, care_description, amount, coverage_rate, reimbursed_amount, status, treatment_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10) RETURNING id, reimbursed_amount`,
      [
        beneficiaryId || null, beneficiaryName, phone, structureName, careType,
        careDescription || '', amount, coverageRate, reimbursedAmount,
        treatmentDate || null
      ]
    );
    // Notification (best-effort)
    try {
      await query(
        `INSERT INTO notifications (beneficiary_id, channel, recipient, type, title, body, status)
         VALUES ($1, 'sms', $2, 'prise_en_charge', 'Demande reçue', $3, 'pending')`,
        [beneficiaryId || null, phone, `Votre demande de prise en charge (#${result.rows[0].id}) a été reçue. Montant estimé pris en charge : ${reimbursedAmount} FCFA.`]
      );
    } catch (nErr) { /* non bloquant */ }

    res.status(201).json({
      success: true,
      claimId: result.rows[0].id,
      reimbursedAmount: result.rows[0].reimbursed_amount,
      message: 'Demande de prise en charge enregistrée. Elle sera traitée par un agent.'
    });
  } catch (err) {
    console.error('Erreur dépôt claim :', err);
    res.status(500).json({ error: 'Erreur lors de la demande de prise en charge.' });
  }
});

// Liste des demandes (agent/admin : tout ; citoyen : seulement les siennes)
router.get('/api/claims', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    const { page, limit, offset } = parsePagination(req);
    const isAgent = ['agent', 'admin'].includes(req.user.role);
    let whereSql = ' WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    // Un citoyen ne voit que ses propres demandes
    if (!isAgent) {
      whereSql += ` AND beneficiary_id = $${paramIdx}`;
      params.push(req.user.id);
      paramIdx++;
    } else if (req.user && req.user.role !== 'Super Admin' && req.user.department) {
      whereSql += ` AND beneficiary_id IN (SELECT id FROM beneficiaries WHERE department = $${paramIdx})`;
      params.push(req.user.department);
      paramIdx++;
    }
    if (status) {
      whereSql += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM claims${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);
    const dataRes = await query(
      `SELECT * FROM claims${whereSql} ORDER BY submitted_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur liste claims :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Traitement d'une demande (agent/admin)
router.put('/api/claims/:id', authenticateToken, requireRole('agent', 'admin'), validate(claimStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reimbursedAmount, rejectionReason } = req.body;
    const processedBy = req.user.username || 'agent';
    const processedAt = new Date();
    const result = await query(
      `UPDATE claims SET status=$1, reimbursed_amount=COALESCE($2, reimbursed_amount), rejection_reason=$3, processed_by=$4, processed_at=$5
       WHERE id=$6 RETURNING beneficiary_id, phone, beneficiary_name`,
      [status, reimbursedAmount ?? null, rejectionReason || null, processedBy, processedAt, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });

    // Notification au bénéficiaire (best-effort)
    const c = result.rows[0];
    try {
      const msg = status === 'approved' || status === 'paid'
        ? `Votre demande de prise en charge #${id} a été ${status === 'paid' ? 'remboursée' : 'approuvée'}.`
        : status === 'rejected'
          ? `Votre demande de prise en charge #${id} a été refusée. Motif : ${rejectionReason || 'non précisé'}.`
          : `Le statut de votre demande #${id} est : ${status}.`;
      await query(
        `INSERT INTO notifications (beneficiary_id, channel, recipient, type, title, body, status)
         VALUES ($1, 'sms', $2, 'prise_en_charge', 'Mise à jour', $3, 'pending')`,
        [c.beneficiary_id, c.phone, msg]
      );
    } catch (nErr) { /* non bloquant */ }

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['TRAITEMENT_PRISE_EN_CHARGE', processedBy, `Demande #${id} (${c.beneficiary_name}) passée au statut ${status}.`]
    );
    res.json({ success: true, message: 'Demande mise à jour.' });
  } catch (err) {
    console.error('Erreur traitement claim :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ============================================================================
// NOTIFICATIONS (SMS / WhatsApp) — envoi simulé, journalisation en DB
// ============================================================================

// Envoi manuel d'une notification (agent/admin)
router.post('/api/notifications', authenticateToken, requireRole('agent', 'admin'), validate(notificationSendSchema), async (req, res) => {
  try {
    const { beneficiaryId, channel, recipient, type, title, body } = req.body;
    // Simulation d'envoi : en production, intégrer l'API d'un opérateur (Orange SMS, Twilio, WhatsApp Business)
    const sentAt = new Date();
    await query(
      `INSERT INTO notifications (beneficiary_id, channel, recipient, type, title, body, status, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', $7)`,
      [beneficiaryId || null, channel, recipient, type, title || null, body, sentAt]
    );
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['ENVOI_NOTIFICATION', req.user.username || 'agent', `Notification ${channel} envoyée à ${recipient} (${type}).`]
    );
    res.status(201).json({ success: true, message: `Notification ${channel.toUpperCase()} envoyée à ${recipient}.` });
  } catch (err) {
    console.error('Erreur envoi notification :', err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi.' });
  }
});

// Historique des notifications (agent/admin : tout ; citoyen : seulement les siennes)
router.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req);
    const isAgent = ['agent', 'admin'].includes(req.user.role);
    let whereSql = ' WHERE 1=1';
    const params = [];
    let paramIdx = 1;
    if (!isAgent) {
      whereSql += ` AND beneficiary_id = $${paramIdx}`;
      params.push(req.user.id);
      paramIdx++;
    } else if (req.user && req.user.role !== 'Super Admin' && req.user.department) {
      whereSql += ` AND beneficiary_id IN (SELECT id FROM beneficiaries WHERE department = $${paramIdx})`;
      params.push(req.user.department);
      paramIdx++;
    }
    const countRes = await query(`SELECT COUNT(*) FROM notifications${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);
    const dataRes = await query(
      `SELECT * FROM notifications${whereSql} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur liste notifications :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ============================================================================
// CARTE CMU NUMÉRIQUE (vérifiable publiquement par le numéro CMU)
// ============================================================================

// Vérification publique d'une carte CMU par son numéro (pour les structures de soins)
router.get('/api/cmu-card/:cmuNumber', async (req, res) => {
  try {
    const { cmuNumber } = req.params;
    const bRes = await query(
      `SELECT id, first_name, last_name, birth_date, phone, mutuelle_name, package_type, cmu_number, status, photo_url
       FROM beneficiaries WHERE cmu_number = $1 LIMIT 1`,
      [cmuNumber]
    );
    if (bRes.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Carte CMU introuvable.' });
    }
    const b = bRes.rows[0];
    const fRes = await query('SELECT name, relation, age FROM family_members WHERE beneficiary_id = $1 ORDER BY id ASC', [b.id]);
    res.json({
      valid: b.status === 'active',
      status: b.status,
      firstName: b.first_name,
      lastName: b.last_name,
      birthDate: b.birth_date,
      phone: b.phone,
      mutuelleName: b.mutuelle_name,
      packageType: b.package_type,
      cmuNumber: b.cmu_number,
      photoUrl: b.photo_url,
      familyMembers: fRes.rows,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erreur vérification carte CMU :', err);
    res.status(500).json({ valid: false, error: 'Erreur interne du serveur.' });
  }
});

// ============================================================================
// TABLEAU DE BORD AGENT — KPIs CSU
// ============================================================================

router.get('/api/dashboard/stats', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const isAgent = ['agent', 'admin'].includes(req.user.role);
    const isSuperAdmin = req.user.role === 'Super Admin';
    const dept = (isAgent && !isSuperAdmin && req.user.department) ? req.user.department : null;

    let totalBeneficiaries, activeBeneficiaries, pendingBeneficiaries, totalMutuelles, totalDonations;
    let claimsByStatus, claimsTotal, claimsAmount, byPackage, byMutuelle, byCommune, adhesionsTrend, complaintsByStatus;

    if (dept) {
      // Filtré par département
      totalBeneficiaries = await query('SELECT COUNT(*) FROM beneficiaries WHERE department = $1', [dept]);
      activeBeneficiaries = await query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'active' AND department = $1", [dept]);
      pendingBeneficiaries = await query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'pending' AND department = $1", [dept]);
      totalMutuelles = await query('SELECT COUNT(*) FROM mutuelles');
      totalDonations = await query('SELECT COALESCE(SUM(amount),0) AS sum FROM donations');

      claimsByStatus = await query(
        `SELECT c.status, COUNT(*) AS count FROM claims c JOIN beneficiaries b ON c.beneficiary_id = b.id WHERE b.department = $1 GROUP BY c.status ORDER BY count DESC`,
        [dept]
      );
      claimsTotal = await query('SELECT COUNT(*) FROM claims c JOIN beneficiaries b ON c.beneficiary_id = b.id WHERE b.department = $1', [dept]);
      claimsAmount = await query(
        "SELECT COALESCE(SUM(c.reimbursed_amount),0) AS sum FROM claims c JOIN beneficiaries b ON c.beneficiary_id = b.id WHERE c.status IN ('approved','paid') AND b.department = $1",
        [dept]
      );

      byPackage = await query(
        `SELECT package_type, COUNT(*) AS count FROM beneficiaries WHERE department = $1 GROUP BY package_type ORDER BY count DESC`,
        [dept]
      );
      byMutuelle = await query(
        `SELECT mutuelle_name, COUNT(*) AS count FROM beneficiaries WHERE department = $1 GROUP BY mutuelle_name ORDER BY count DESC LIMIT 10`,
        [dept]
      );
      byCommune = await query(
        `SELECT m.commune, COUNT(b.id) AS count
         FROM beneficiaries b LEFT JOIN mutuelles m ON b.mutuelle_name = m.name
         WHERE b.department = $1
         GROUP BY m.commune ORDER BY count DESC LIMIT 10`,
        [dept]
      );
      adhesionsTrend = await query(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count
         FROM beneficiaries WHERE created_at >= NOW() - INTERVAL '30 days' AND department = $1
         GROUP BY DATE(created_at) ORDER BY date ASC`,
        [dept]
      );
      complaintsByStatus = await query(
        `SELECT c.status, COUNT(*) AS count FROM complaints c JOIN beneficiaries b ON c.phone = b.phone WHERE b.department = $1 GROUP BY c.status`,
        [dept]
      );
    } else {
      // Super Admin ou Global
      totalBeneficiaries = await query('SELECT COUNT(*) FROM beneficiaries');
      activeBeneficiaries = await query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'active'");
      pendingBeneficiaries = await query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'pending'");
      totalMutuelles = await query('SELECT COUNT(*) FROM mutuelles');
      totalDonations = await query('SELECT COALESCE(SUM(amount),0) AS sum FROM donations');

      claimsByStatus = await query(
        `SELECT status, COUNT(*) AS count FROM claims GROUP BY status ORDER BY count DESC`
      );
      claimsTotal = await query('SELECT COUNT(*) FROM claims');
      claimsAmount = await query("SELECT COALESCE(SUM(reimbursed_amount),0) AS sum FROM claims WHERE status IN ('approved','paid')");

      byPackage = await query(
        `SELECT package_type, COUNT(*) AS count FROM beneficiaries GROUP BY package_type ORDER BY count DESC`
      );
      byMutuelle = await query(
        `SELECT mutuelle_name, COUNT(*) AS count FROM beneficiaries GROUP BY mutuelle_name ORDER BY count DESC LIMIT 10`
      );
      byCommune = await query(
        `SELECT m.commune, COUNT(b.id) AS count
         FROM beneficiaries b LEFT JOIN mutuelles m ON b.mutuelle_name = m.name
         GROUP BY m.commune ORDER BY count DESC LIMIT 10`
      );
      adhesionsTrend = await query(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count
         FROM beneficiaries WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at) ORDER BY date ASC`
      );
      complaintsByStatus = await query(
        `SELECT status, COUNT(*) AS count FROM complaints GROUP BY status`
      );
    }

    res.json({
      beneficiaries: {
        total: parseInt(totalBeneficiaries.rows[0].count || '0', 10),
        active: parseInt(activeBeneficiaries.rows[0].count || '0', 10),
        pending: parseInt(pendingBeneficiaries.rows[0].count || '0', 10),
        coverageRate: 0 // calculé côté frontend
      },
      mutuelles: parseInt(totalMutuelles.rows[0].count || '0', 10),
      donations: parseInt(totalDonations.rows[0].sum || '0', 10),
      claims: {
        total: parseInt(claimsTotal.rows[0].count || '0', 10),
        byStatus: claimsByStatus.rows,
        reimbursedAmount: parseInt(claimsAmount.rows[0].sum || '0', 10)
      },
      byPackage: byPackage.rows,
      byMutuelle: byMutuelle.rows,
      byCommune: byCommune.rows,
      adhesionsTrend: adhesionsTrend.rows,
      complaintsByStatus: complaintsByStatus.rows
    });
  } catch (err) {
    console.error('Erreur dashboard stats :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Export CSV des bénéficiaires (agent/admin)
router.get('/api/dashboard/export/beneficiaries', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, phone, email, mutuelle_name, package_type, cmu_number, status, created_at
       FROM beneficiaries ORDER BY id DESC LIMIT 5000`
    );
    const headers = ['ID', 'Prenom', 'Nom', 'Telephone', 'Email', 'Mutuelle', 'Formule', 'CMU', 'Statut', 'DateAdhesion'];
    const rows = result.rows.map((b) => [
      b.id, b.first_name, b.last_name, b.phone, b.email, b.mutuelle_name, b.package_type, b.cmu_number, b.status,
      b.created_at ? new Date(b.created_at).toISOString() : ''
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="beneficiaires_csu.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Erreur export CSV :', err);
    res.status(500).json({ error: 'Erreur lors de l\'export.' });
  }
});

module.exports = router;
