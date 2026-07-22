const express = require('express');
const router = express.Router();
const { query } = require('./db');
const crypto = require('crypto');

// ==========================================
// 1. LETTRES DE GARANTIE (Prise en charge hospitalière)
// ==========================================

// Liste des lettres de garantie
router.get('/guarantees', async (req, res) => {
  try {
    const { beneficiary_id, status } = req.query;
    let sql = `
      SELECT g.*, b.first_name, b.last_name, b.cmu_number, b.phone, s.name as structure_name
      FROM guarantee_letters g
      JOIN beneficiaries b ON g.beneficiary_id = b.id
      LEFT JOIN partner_structures s ON g.partner_structure_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (beneficiary_id) {
      params.push(beneficiary_id);
      sql += ` AND g.beneficiary_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND g.status = $${params.length}`;
    }
    sql += ` ORDER BY g.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /guarantees:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des lettres de garantie.' });
  }
});

// Demande d'une nouvelle lettre de garantie (Assuré)
router.post('/guarantees', async (req, res) => {
  try {
    const { beneficiary_id, partner_structure_id, medical_act, estimated_amount, document_url } = req.body;
    if (!beneficiary_id || !medical_act) {
      return res.status(400).json({ error: 'Le bénéficiaire et l\'acte médical sont requis.' });
    }

    const validationCode = `GAR-DK-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const result = await query(`
      INSERT INTO guarantee_letters 
      (beneficiary_id, partner_structure_id, medical_act, estimated_amount, status, validation_code, document_url)
      VALUES ($1, $2, $3, $4, 'pending', $5, $6)
      RETURNING *
    `, [beneficiary_id, partner_structure_id || null, medical_act, estimated_amount || 0, validationCode, document_url || null]);

    res.status(201).json({ success: true, message: 'Demande de lettre de garantie soumise avec succès.', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /guarantees:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la lettre de garantie.' });
  }
});

// Validation 100% humaine par un Agent CMU
router.put('/guarantees/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, guaranteed_percentage, max_amount, agent_note } = req.body;

    if (!['approved', 'rejected', 'used'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const result = await query(`
      UPDATE guarantee_letters
      SET status = $1, guaranteed_percentage = COALESCE($2, guaranteed_percentage), max_amount = COALESCE($3, max_amount), agent_note = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [status, guaranteed_percentage || 80, max_amount || 0, agent_note || '', id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lettre de garantie introuvable.' });
    }

    res.json({ success: true, message: `Lettre de garantie mise à jour (${status}).`, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur PUT /guarantees/:id/status:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la lettre de garantie.' });
  }
});

// ==========================================
// 2. BONS DE COMMANDE (Pharmacie / Tiers-payant 48h)
// ==========================================

router.get('/purchase-orders', async (req, res) => {
  try {
    const { beneficiary_id } = req.query;
    let sql = `
      SELECT p.*, b.first_name, b.last_name, b.cmu_number
      FROM purchase_orders p
      JOIN beneficiaries b ON p.beneficiary_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (beneficiary_id) {
      params.push(beneficiary_id);
      sql += ` AND p.beneficiary_id = $${params.length}`;
    }
    sql += ` ORDER BY p.created_at DESC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /purchase-orders:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/purchase-orders', async (req, res) => {
  try {
    const { beneficiary_id, items, total_amount, partner_structure_id } = req.body;
    if (!beneficiary_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Données invalides pour le bon de commande.' });
    }

    const result = await query(`
      INSERT INTO purchase_orders (beneficiary_id, prescription_date, items_json, total_amount, partner_structure_id, status)
      VALUES ($1, CURRENT_DATE, $2, $3, $4, 'active')
      RETURNING *
    `, [beneficiary_id, JSON.stringify(items), total_amount || 0, partner_structure_id || null]);

    res.status(201).json({ success: true, message: 'Bon de commande généré avec succès (valide 48h).', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /purchase-orders:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/purchase-orders/:id/redeem', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      UPDATE purchase_orders
      SET status = 'used', used_at = NOW()
      WHERE id = $1 AND status = 'active'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Bon de commande déjà utilisé, expiré ou inexistant.' });
    }

    res.json({ success: true, message: 'Bon de commande validé avec succès en pharmacie.', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /purchase-orders/:id/redeem:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ==========================================
// 3. TÉLÉMÉDECINE & RENDEZ-VOUS EN LIGNE
// ==========================================

router.get('/telemedicine/sessions', async (req, res) => {
  try {
    const { beneficiary_id } = req.query;
    let sql = `
      SELECT t.*, b.first_name, b.last_name, b.cmu_number
      FROM telemedicine_sessions t
      JOIN beneficiaries b ON t.beneficiary_id = b.id
      WHERE 1=1
    `;
    const params = [];
    if (beneficiary_id) {
      params.push(beneficiary_id);
      sql += ` AND t.beneficiary_id = $${params.length}`;
    }
    sql += ` ORDER BY t.scheduled_at ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /telemedicine/sessions:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/telemedicine/sessions', async (req, res) => {
  try {
    const { beneficiary_id, doctor_name, specialty, scheduled_at } = req.body;
    const roomToken = `TELE-ROOM-${Date.now().toString().slice(-6)}`;

    const result = await query(`
      INSERT INTO telemedicine_sessions (beneficiary_id, doctor_name, specialty, scheduled_at, room_token)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [beneficiary_id, doctor_name || 'Dr. Médecin Conseil', specialty || 'Médecine Générale', scheduled_at || new Date(), roomToken]);

    res.status(201).json({ success: true, message: 'Téléconsultation planifiée.', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /telemedicine/sessions:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/appointments', async (req, res) => {
  try {
    const { beneficiary_id } = req.query;
    let sql = `
      SELECT a.*, b.first_name, b.last_name, s.name as structure_name
      FROM appointments a
      JOIN beneficiaries b ON a.beneficiary_id = b.id
      LEFT JOIN partner_structures s ON a.partner_structure_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (beneficiary_id) {
      params.push(beneficiary_id);
      sql += ` AND a.beneficiary_id = $${params.length}`;
    }
    sql += ` ORDER BY a.appointment_date ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Erreur GET /appointments:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/appointments', async (req, res) => {
  try {
    const { beneficiary_id, partner_structure_id, doctor_name, specialty, appointment_date, notes } = req.body;
    const accessCode = `RDV-${Date.now().toString().slice(-6)}`;

    const result = await query(`
      INSERT INTO appointments (beneficiary_id, partner_structure_id, doctor_name, specialty, appointment_date, notes, qr_access_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [beneficiary_id, partner_structure_id || null, doctor_name, specialty, appointment_date, notes || '', accessCode]);

    res.status(201).json({ success: true, message: 'Rendez-vous confirmé.', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /appointments:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ==========================================
// 4. DOSSIER MÉDICAL, ANTÉCÉDENTS & IMAGERIE (Scanner/Radio)
// ==========================================

router.get('/medical-profile/:beneficiaryId', async (req, res) => {
  try {
    const { beneficiaryId } = req.params;

    const anteRes = await query('SELECT * FROM medical_antecedents WHERE beneficiary_id = $1', [beneficiaryId]);
    const extCodes = await query('SELECT * FROM external_patient_codes WHERE beneficiary_id = $1', [beneficiaryId]);
    const imagingRes = await query('SELECT * FROM medical_imaging_results WHERE beneficiary_id = $1 ORDER BY exam_date DESC', [beneficiaryId]);
    const maternalRes = await query('SELECT * FROM maternal_health_records WHERE beneficiary_id = $1 AND is_active = TRUE LIMIT 1', [beneficiaryId]);

    res.json({
      success: true,
      data: {
        antecedents: anteRes.rows[0] || null,
        externalCodes: extCodes.rows,
        imaging: imagingRes.rows,
        maternal: maternalRes.rows[0] || null
      }
    });
  } catch (err) {
    console.error('Erreur GET /medical-profile:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/medical-profile/:beneficiaryId/antecedents', async (req, res) => {
  try {
    const { beneficiaryId } = req.params;
    const { blood_group, allergies, chronic_conditions, past_surgeries, emergency_contact_name, emergency_contact_phone } = req.body;

    const existing = await query('SELECT id FROM medical_antecedents WHERE beneficiary_id = $1', [beneficiaryId]);

    let result;
    if (existing.rows.length > 0) {
      result = await query(`
        UPDATE medical_antecedents
        SET blood_group = $1, allergies = $2, chronic_conditions = $3, past_surgeries = $4, emergency_contact_name = $5, emergency_contact_phone = $6, updated_at = NOW()
        WHERE beneficiary_id = $7
        RETURNING *
      `, [blood_group, allergies, chronic_conditions, past_surgeries, emergency_contact_name, emergency_contact_phone, beneficiaryId]);
    } else {
      result = await query(`
        INSERT INTO medical_antecedents (beneficiary_id, blood_group, allergies, chronic_conditions, past_surgeries, emergency_contact_name, emergency_contact_phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [beneficiaryId, blood_group, allergies, chronic_conditions, past_surgeries, emergency_contact_name, emergency_contact_phone]);
    }

    res.json({ success: true, message: 'Antécédents médicaux mis à jour.', data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /medical-profile/antecedents:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ==========================================
// 5. GRANDES INSTITUTIONS & COUD UCAD
// ==========================================

router.get('/institutions/coud/summary', async (req, res) => {
  try {
    const instRes = await query(`SELECT * FROM institutional_tenants WHERE code = 'COUD_UCAD' LIMIT 1`);
    const countRes = await query(`SELECT COUNT(*) as total FROM beneficiaries WHERE region = 'Dakar'`);

    res.json({
      success: true,
      institution: instRes.rows[0] || { name: 'COUD - UCAD Dakar', code: 'COUD_UCAD', total_members: 85000 },
      active_students_covered: parseInt(countRes.rows[0].total) || 1240,
      center_name: 'Centre Médical du COUD - UCAD',
      budget_allocated: 150000000,
      budget_consumed: 42800000
    });
  } catch (err) {
    console.error('Erreur GET /institutions/coud/summary:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
