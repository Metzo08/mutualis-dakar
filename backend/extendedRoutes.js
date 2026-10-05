const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query, pool } = require('./db');
// Bus temps réel : Redis en production, PostgreSQL en secours. L'interface
// est identique à celle de `./db`, donc cet import remplace l'ancien.
const { publishRealtime, subscribeRealtime } = require('./realtimeBus');
const { authenticateToken, requireRole } = require('./rbac');
const crypto = require('crypto');

// Même secret que rbac.js : le flux SSE doit valider les jetons émis
// ailleurs. Un secret divergent ici rejetterait tous les clients.
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';

// ==========================================
// 1. LETTRES DE GARANTIE (Prise en charge hospitalière)
// ==========================================

// Liste des lettres de garantie
router.get("/guarantees", authenticateToken, async (req, res) => {
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

router.post("/guarantees", authenticateToken, async (req, res) => {
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
router.put("/guarantees/:id/status", authenticateToken, requireRole("agent"), async (req, res) => {
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

router.get("/purchase-orders", authenticateToken, async (req, res) => {
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

router.post("/purchase-orders", authenticateToken, async (req, res) => {
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

router.post("/purchase-orders/:id/redeem", authenticateToken, async (req, res) => {
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

router.get("/telemedicine/sessions", authenticateToken, async (req, res) => {
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

router.post("/telemedicine/sessions", authenticateToken, async (req, res) => {
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

router.get("/appointments", authenticateToken, async (req, res) => {
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

// ─────────────────────────────────────────────
// RENDEZ-VOUS GRATUIT + PRÉSENCE RÉELLE DES PRATICIENS
//
// Le modèle précédent forçait l'assuré à payer 2 500 FCFA AVANT d'entrer
// en file, et affichait « Disponible 24/7 » / « En ligne » en dur sur les
// cartes. Deux conséquences : un assuré payait pour la salle d'attente
// d'un médecin peut-être absent, et l'écran affirmait une disponibilité
// qu'aucun serveur ne vérifiait.
//
// Ici :
//  - un rendez-vous se prend SANS paiement (le règlement se fait une seule
//    fois, sur place, à la structure) ;
//  - la présence d'un praticien est dérivée d'un HEART-BEAT daté. Un
//    statut en base n'est jamais lu tel quel : il est recalculé à chaque
//    lecture par rapport à NOW(), donc quelqu'un qui ferme son navigateur
//    devient indisponible sans avoir à envoyer quoi que ce soit.
// ─────────────────────────────────────────────

// Un praticien est considéré hors ligne si son dernier signal est plus
// ancien que ce délai : 75 s = 3 heart-beats consécutifs perdus (25 s).
const PRESENCE_OFFLINE_AFTER_MS = 75 * 1000;

// Créée au démarrage pour qu'un déploiement n'exige pas de rejouer tout
// init_db.js. `CREATE TABLE IF NOT EXISTS` est sans danger en production.
const ensurePresenceTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS practitioner_presence (
      practitioner_username VARCHAR(150) PRIMARY KEY,
      practitioner_name VARCHAR(255),
      specialty VARCHAR(150),
      declared_status VARCHAR(30) NOT NULL DEFAULT 'available',
      last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),
      session_token VARCHAR(128),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_practitioner_presence_heartbeat
      ON practitioner_presence (last_heartbeat_at DESC)
  `);
};

/**
 * Le praticien signale sa présence. Appelé périodiquement par le frontend.
 * Le statut stocké est secondaire : c'est `last_heartbeat_at` qui fait foi.
 */
router.post("/telemedicine/presence/heartbeat", authenticateToken, async (req, res) => {
  try {
    await ensurePresenceTable();

    const practitionerUsername = req.user?.username;
    if (!practitionerUsername) {
      return res.status(400).json({ success: false, error: 'Identifiant de praticien manquant.' });
    }

    const { practitionerName, specialty, declaredStatus = 'available' } = req.body || {};

    // On n'accepte que les trois états prévus : un statut libre permettrait
    // d'injecter une chaîne arbitraire dans l'interface des assurés.
    const allowed = ['available', 'in_call', 'away'];
    const status = allowed.includes(declaredStatus) ? declaredStatus : 'available';

    const result = await query(
      `INSERT INTO practitioner_presence
         (practitioner_username, practitioner_name, specialty, declared_status, last_heartbeat_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (practitioner_username) DO UPDATE SET
         practitioner_name = COALESCE(EXCLUDED.practitioner_name, practitioner_presence.practitioner_name),
         specialty        = COALESCE(EXCLUDED.specialty,        practitioner_presence.specialty),
         declared_status  = EXCLUDED.declared_status,
         last_heartbeat_at = NOW(),
         updated_at       = NOW()
       RETURNING *`,
      [practitionerUsername, practitionerName || null, specialty || null, status]
    );

    // Diffusion temps réel. La notification transite par PostgreSQL : elle
    // atteint donc toutes les instances, y compris celles qui n'ont pas
    // traité la requête ci-dessus. Sans cela, un assuré connecté à une
    // autre instance que le praticien ne verrait jamais son statut changer.
    await publishRealtime({
      type: 'presence',
      practitioner_username: practitionerUsername,
      practitioner_name: practitionerName || null,
      specialty: specialty || null,
      declared_status: status,
      online: status !== 'away',
      at: new Date().toISOString()
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur POST /telemedicine/presence/heartbeat:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * Liste des praticiens avec leur présence RÉELLE, recalculée à l'instant.
 * `online` n'est jamais stocké : il résulte de la comparaison des dates.
 */
router.get("/telemedicine/presence", authenticateToken, async (req, res) => {
  try {
    await ensurePresenceTable();

    const result = await query(`
      SELECT
        practitioner_username,
        practitioner_name,
        specialty,
        declared_status,
        last_heartbeat_at,
        -- Statut RECALCULÉ : jamais lu tel quel depuis la base.
        (last_heartbeat_at > (NOW() - ($1 || ' milliseconds')::interval)
         AND declared_status <> 'away') AS online,
        EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at))::int AS seconds_since_heartbeat
      FROM practitioner_presence
      ORDER BY online DESC, last_heartbeat_at DESC
    `, [PRESENCE_OFFLINE_AFTER_MS]);

    res.json({
      success: true,
      // Le délai est transmis pour que le frontend puisse expliquer
      // « dernière connexion il y a X » sans deviner la règle.
      offline_after_seconds: PRESENCE_OFFLINE_AFTER_MS / 1000,
      data: result.rows
    });
  } catch (err) {
    console.error('Erreur GET /telemedicine/presence:', err);
    res.status(500).json({ success: false, error: 'Erreur serveur.' });
  }
});

/**
 * Flux temps réel de présence (Server-Sent Events).
 *
 * Pourquoi un flux persistant plutôt qu'un balayage périodique :
 * en multi-instance, un `setInterval` HTTP tire des requêtes vers des
 * instances différentes au fil du round-robin du répartiteur. Chaque
 * instance ne connaît que les événements qu'elle a vus passer. Résultat :
 * deux assurés sur deux instances peuvent afficher deux réalités
 * différentes pendant plusieurs minutes.
 *
 * SSE et non WebSocket : le flux est à sens unique (serveur vers client),
 * donc le WebSocket serait inutile ici. SSE repasse par le même port HTTP,
 * traverse les proxys et les répartiteurs existants sans configuration
 * supplémentaire, et se reconnecte seul côté navigateur.
 *
 * Authentification par jeton : EventSource ne permet pas d'envoyer un
 * en-tête `Authorization`, le jeton passe donc en paramètre d'URL. C'est
 * un choix assumé — le flux ne transporte que des statuts de présence,
 * aucune donnée médicale.
 */
router.get("/telemedicine/presence/stream", async (req, res) => {
  // Vérification manuelle du jeton : le middleware standard lit l'en-tête.
  const token = String(req.query.token || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ success: false, error: 'Jeton manquant.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Jeton invalide.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    // Indispensable derrière un proxy : sans cet en-tête, le proxy peut
    // mettre en tampon et l'assuré ne rien voir arriver.
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (eventName, data) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Premier envoi : l'état courant, pour que le client affiche quelque
  // chose tout de suite au lieu d'attendre le prochain changement.
  const pushCurrentState = async () => {
    try {
      await ensurePresenceTable();
      const r = await query(`
        SELECT
          practitioner_username,
          practitioner_name,
          specialty,
          declared_status,
          last_heartbeat_at,
          (last_heartbeat_at > (NOW() - ($1 || ' milliseconds')::interval)
           AND declared_status <> 'away') AS online,
          EXTRACT(EPOCH FROM (NOW() - last_heartbeat_at))::int AS seconds_since_heartbeat
        FROM practitioner_presence
        ORDER BY online DESC, last_heartbeat_at DESC
      `, [PRESENCE_OFFLINE_AFTER_MS]);
      send('state', {
        offline_after_seconds: PRESENCE_OFFLINE_AFTER_MS / 1000,
        practitioners: r.rows
      });
    } catch (err) {
      console.warn("[SSE] Envoi de l'etat initial impossible:", err.message);
    }
  };
  pushCurrentState();

  // Abonnement au bus partagé : les événements reçus ici proviennent
  // de TOUTES les instances, pas seulement de celle-ci.
  const unsubscribe = subscribeRealtime((event) => {
    if (event && event.type === 'presence') send('changed', event);
  });

  // Battement régulier : maintient la connexion ouverte à travers les
  // proxys et les délais d'attente, et laisse le client détecter une
  // coupure réseau même sans changement de statut.
  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  // Nettoyage à la fermeture : sans cela, une instance qui reçoit des
  // reconnexions accumule des abonnements et des minuteries orphelines
  // jusqu'à l'épuisement de la mémoire.
  const cleanup = () => {
    clearInterval(keepAlive);
    unsubscribe();
    res.end();
  };
  req.on('close', cleanup);
  req.on('error', cleanup);
});

/**
 * Prise de rendez-vous — SANS paiement.
 * Le règlement se fait une seule fois, sur place, à la structure de santé.
 * Aucun montant n'est créé ici : pré-remplir un prix ferait exactement
 * l'effet inverse du parcours demandé (faire payer d'avance).
 */
router.post("/appointments", authenticateToken, async (req, res) => {
  try {
    const { beneficiary_id, partner_structure_id, doctor_name, specialty, appointment_date, notes } = req.body;
    const accessCode = `RDV-${Date.now().toString().slice(-6)}`;

    const result = await query(`
      INSERT INTO appointments (beneficiary_id, partner_structure_id, doctor_name, specialty, appointment_date, notes, qr_access_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [beneficiary_id, partner_structure_id || null, doctor_name, specialty, appointment_date, notes || '', accessCode]);

    res.status(201).json({
      success: true,
      // Mention explicite : un rendez-vous ne vaut pas paiement.
      message: 'Rendez-vous enregistré. Le règlement se fait sur place, à la structure.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Erreur POST /appointments:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ==========================================
// 4. DOSSIER MÉDICAL, ANTÉCÉDENTS & IMAGERIE (Scanner/Radio)
// ==========================================

router.get("/medical-profile/:beneficiaryId", authenticateToken, async (req, res) => {
  try {
    const { beneficiaryId } = req.params;
    
    // Un citoyen ne peut consulter que son propre profil médical
    if (req.user.role === "citizen" && req.user.id !== parseInt(beneficiaryId)) {
      return res.status(403).json({ error: "Accès interdit." });
    }

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

router.post("/medical-profile/:beneficiaryId/antecedents", authenticateToken, async (req, res) => {
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

router.get("/institutions/coud/summary", authenticateToken, async (req, res) => {
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
