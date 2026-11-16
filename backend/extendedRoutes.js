const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query } = require('./db');
// Bus temps réel : Redis en production, PostgreSQL en secours. L'interface
// est identique à celle de `./db`, donc cet import remplace l'ancien.
const { publishRealtime, subscribeRealtime } = require('./realtimeBus');
const { authenticateToken, requireRole, normalizeRole } = require('./rbac');
const { parsePagination } = require('./pagination');
const crypto = require('crypto');

// Même secret que rbac.js : le flux SSE doit valider les jetons émis
// ailleurs. Un secret divergent ici rejetterait tous les clients.
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';

const { storeDocumentImage, getStorageStatus, getMsdWhatsappDirectoryBackend, updateMsdWhatsappCache } = require('./objectStorage');

/**
 * Périmètre MSD d'un agent (AGENTS.md §4) : un agent rattaché à une MSD ne
 * peut agir que sur les dossiers de SA MSD. Admin / Super Admin (sans
 * msdCode dans le jeton) : null = pas de filtre (rôle de supervision).
 */
const agentMsdScope = (req) => {
  const role = normalizeRole(req.user && req.user.role);
  if (role === 'agent' && req.user.msdCode) return String(req.user.msdCode);
  return null;
};

// ==========================================
// 1. LETTRES DE GARANTIE (Prise en charge hospitalière)
// ==========================================

// Liste des lettres de garantie
router.get("/guarantees", authenticateToken, async (req, res) => {
  try {
    const { beneficiary_id, status } = req.query;
    const { page, limit, offset } = parsePagination(req);
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

    // Cloisonnement : un citoyen ne voit que SES lettres, pas la liste globale.
    // (Avant, l'absence de ce filtre exposait les lettres de garantie de tous
    // les assurés à n'importe quel compte connecté — fuite de données.)
    if (normalizeRole(req.user.role) === 'agent' && req.user.msdCode) {
      params.push(req.user.msdCode);
      sql += ` AND b.msd_code = $${params.length}`;
    }
    const role = normalizeRole(req.user.role);
    if (role === 'citizen') {
      params.push(req.user.id);
      sql += ` AND g.beneficiary_id = $${params.length}`;
    }

    // Pagination SQL : la table peut contenir des dizaines de milliers de
    // lettres ; COUNT et SELECT partagent le même WHERE pour des métadonnées
    // de pagination exactes.
    const countRes = await query(
      `SELECT COUNT(*) FROM guarantee_letters g JOIN beneficiaries b ON g.beneficiary_id = b.id WHERE 1=1
        ${beneficiary_id ? ' AND g.beneficiary_id = $1' : ''}
        ${status ? ` AND g.status = $${beneficiary_id ? 2 : 1}` : ''}
        ${role === 'citizen' ? ` AND g.beneficiary_id = $${params.length}` : (role === 'agent' && req.user.msdCode ? ` AND b.msd_code = $${params.length}` : '')}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    sql += ` ORDER BY g.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await query(sql, [...params, limit, offset]);
    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur GET /guarantees:', err);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des lettres de garantie.' });
  }
});

router.post("/guarantees", authenticateToken, async (req, res) => {
  try {
    const { partner_structure_id, medical_act, estimated_amount, document_url } = req.body;
    const beneficiary_id = normalizeRole(req.user.role) === 'citizen' ? req.user.id : req.body.beneficiary_id;
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
router.put("/guarantees/:id/status", authenticateToken, requireRole("agent", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, guaranteed_percentage, max_amount, agent_note } = req.body;

    if (!['approved', 'rejected', 'used', 'emergency_issued'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    const result = await query(`
      UPDATE guarantee_letters
      SET status = $1, guaranteed_percentage = COALESCE($2, guaranteed_percentage), max_amount = COALESCE($3, max_amount), agent_note = $4, updated_at = NOW()
      WHERE id = $5
        AND ($6::text IS NULL OR EXISTS (
          SELECT 1 FROM beneficiaries b WHERE b.id = guarantee_letters.beneficiary_id AND UPPER(b.msd_code) = UPPER($6)
        ))
      RETURNING *
    `, [status, guaranteed_percentage || 80, max_amount || 0, agent_note || '', id, agentMsdScope(req)]);

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
    const { page, limit, offset } = parsePagination(req);
    let sql = `
      SELECT p.*, b.first_name, b.last_name, b.cmu_number, b.phone
      FROM purchase_orders p
      JOIN beneficiaries b ON p.beneficiary_id = b.id
      WHERE 1=1
    `;
    const params = [];

    if (beneficiary_id) {
      params.push(beneficiary_id);
      sql += ` AND p.beneficiary_id = $${params.length}`;
    }

    // Cloisonnement : un citoyen ne voit que ses propres bons de commande.
    if (normalizeRole(req.user.role) === 'agent' && req.user.msdCode) {
      params.push(req.user.msdCode);
      sql += ` AND b.msd_code = $${params.length}`;
    }
    const role = normalizeRole(req.user.role);
    if (role === 'citizen') {
      params.push(req.user.id);
      sql += ` AND p.beneficiary_id = $${params.length}`;
    }

    // COUNT sur le même WHERE, puis page SQL — le COUNT reste cohérent avec
    // les filtres et la table peut croître sans dégrader les réponses.
    const countRes = await query(
      `SELECT COUNT(*) FROM purchase_orders p JOIN beneficiaries b ON p.beneficiary_id = b.id WHERE 1=1
        ${beneficiary_id ? ' AND p.beneficiary_id = $1' : ''}
        ${role === 'citizen' ? ` AND p.beneficiary_id = $${params.length}` : (role === 'agent' && req.user.msdCode ? ` AND b.msd_code = $${params.length}` : '')}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    sql += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await query(sql, [...params, limit, offset]);
    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur GET /purchase-orders:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post("/purchase-orders", authenticateToken, async (req, res) => {
  try {
    const { items, total_amount, partner_structure_id } = req.body;
    const beneficiary_id = normalizeRole(req.user.role) === 'citizen' ? req.user.id : req.body.beneficiary_id;
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
    const { page, limit, offset } = parsePagination(req);
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

    // Cloisonnement : un citoyen ne voit que ses propres sessions.
    const role = normalizeRole(req.user.role);
    if (role === 'citizen') {
      params.push(req.user.id);
      sql += ` AND t.beneficiary_id = $${params.length}`;
    }

    const countRes = await query(
      `SELECT COUNT(*) FROM telemedicine_sessions t WHERE 1=1
        ${beneficiary_id ? ' AND t.beneficiary_id = $1' : ''}
        ${role === 'citizen' ? ` AND t.beneficiary_id = $${params.length}` : ''}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    sql += ` ORDER BY t.scheduled_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await query(sql, [...params, limit, offset]);
    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
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
    const { page, limit, offset } = parsePagination(req);
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

    // Cloisonnement : un citoyen ne voit que ses propres rendez-vous.
    const role = normalizeRole(req.user.role);
    if (role === 'citizen') {
      params.push(req.user.id);
      sql += ` AND a.beneficiary_id = $${params.length}`;
    }

    const countRes = await query(
      `SELECT COUNT(*) FROM appointments a WHERE 1=1
        ${beneficiary_id ? ' AND a.beneficiary_id = $1' : ''}
        ${role === 'citizen' ? ` AND a.beneficiary_id = $${params.length}` : ''}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    sql += ` ORDER BY a.appointment_date ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await query(sql, [...params, limit, offset]);
    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
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
  } catch {
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
    if (normalizeRole(req.user.role) === "citizen" && Number(req.user.id) !== Number(beneficiaryId)) {
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
    if (normalizeRole(req.user.role) === "citizen" && Number(req.user.id) !== Number(beneficiaryId)) {
      return res.status(403).json({ error: "Accès interdit." });
    }

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

router.put("/purchase-orders/:id/status", authenticateToken, requireRole("agent", "admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['active', 'rejected', 'used', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }
    const result = await query(`
      UPDATE purchase_orders
      SET status = $1, used_at = CASE WHEN $1 = 'used' THEN NOW() ELSE used_at END
      WHERE id = $2
        AND ($3::text IS NULL OR EXISTS (
          SELECT 1 FROM beneficiaries b WHERE b.id = purchase_orders.beneficiary_id AND UPPER(b.msd_code) = UPPER($3)
        ))
      RETURNING *
    `, [status, id, agentMsdScope(req)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bon de commande introuvable.' });
    }
    res.json({ success: true, message: `Bon de commande mis à jour (${status}).`, data: result.rows[0] });
  } catch (err) {
    console.error('Erreur PUT /purchase-orders/:id/status:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get("/verify-document/:code", async (req, res) => {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ valid: false, error: 'Code document requis.' });
    }
    if (rawCode.startsWith('GAR-')) {
      const gRes = await query(`
        SELECT g.id, g.validation_code, g.medical_act, g.estimated_amount, g.guaranteed_percentage, g.max_amount, g.status, g.created_at,
               b.first_name, b.last_name, b.cmu_number,
               s.name as structure_name
        FROM guarantee_letters g
        JOIN beneficiaries b ON g.beneficiary_id = b.id
        LEFT JOIN partner_structures s ON g.partner_structure_id = s.id
        WHERE UPPER(g.validation_code) = $1
        LIMIT 1
      `, [rawCode]);
      if (gRes.rows.length === 0) {
        return res.status(404).json({ valid: false, error: 'Lettre de garantie introuvable.' });
      }
      const row = gRes.rows[0];
      const est = Number(row.estimated_amount || 0);
      const pct = Number(row.guaranteed_percentage || 80);
      const covered = Number(row.max_amount || Math.round((est * pct) / 100));
      return res.json({
        valid: row.status === 'approved' || row.status === 'emergency_issued',
        type: 'guarantee',
        code: row.validation_code,
        status: row.status,
        beneficiaryName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        cmuNumber: row.cmu_number,
        structureName: row.structure_name || 'Structure agréée CSU',
        medicalAct: row.medical_act,
        estimatedAmount: est,
        coverageRate: pct,
        coveredAmount: covered,
        patientShare: Math.max(0, est - covered),
        issuedAt: row.created_at
      });
    }
    if (rawCode.startsWith('ORD-')) {
      const numericId = parseInt(rawCode.replace(/[^0-9]/g, ''), 10);
      if (Number.isFinite(numericId)) {
        const pRes = await query(`
          SELECT p.*, b.first_name, b.last_name, b.cmu_number
          FROM purchase_orders p
          JOIN beneficiaries b ON p.beneficiary_id = b.id
          WHERE p.id = $1
          LIMIT 1
        `, [numericId]);
        if (pRes.rows.length > 0) {
          const row = pRes.rows[0];
          const total = Number(row.total_amount || 0);
          const covered = Math.round(total * 0.5);
          return res.json({
            valid: row.status === 'active',
            type: 'purchase_order',
            code: rawCode,
            status: row.status,
            beneficiaryName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            cmuNumber: row.cmu_number,
            structureName: 'Pharmacie Partenaire Agréée CSU',
            estimatedAmount: total,
            coverageRate: 50,
            coveredAmount: covered,
            patientShare: Math.max(0, total - covered),
            issuedAt: row.created_at
          });
        }
      }
      return res.status(404).json({ valid: false, error: 'Bon de commande introuvable.' });
    }
    return res.status(404).json({ valid: false, error: 'Format de code document non reconnu.' });
  } catch (err) {
    console.error('Erreur GET /verify-document/:code:', err);
    res.status(500).json({ valid: false, error: 'Erreur serveur lors de la vérification.' });
  }
});

// =========================================================================
// 7. DEMANDE ENTRANTE DE LETTRE DE GARANTIE / BON DE COMMANDE PAR WHATSAPP
// =========================================================================
// Flux : l'assuré remplit la demande dans le portail → le dossier est créé
// ici (statut « en attente », JAMAIS actif d'office : seul un agent de SA
// MSD valide) → le frontend ouvre WhatsApp vers le guichet de SA MSD.
//
// Sécurité (AGENTS.md §4 / §11) :
//  - citoyen : beneficiary_id forcé à req.user.id (anti-IDOR) ;
//  - agent MSD : le bénéficiaire ciblé doit appartenir à SA MSD ;
//  - autres rôles (pharmacien, médecin…) : refusés, ils ne demandent pas
//    de prise en charge au nom d'un tiers par ce canal ;
//  - la pièce jointe (photo devis/ordonnance) est compressée et externalisée
//    (S3/MinIO ou disque) : aucune image Base64 n'entre dans PostgreSQL.
const WA_ALLOWED_ROLES = new Set(['citizen', 'agent', 'admin', 'superadmin']);
const WA_MAX_ITEMS = 30;

router.get('/whatsapp/msd-directory', async (req, res) => {
  // Numéros de guichets officiels : information publique (affichée sur les
  // cartes). Aucune donnée personnelle. Surcharge dynamique depuis platform_settings.
  try {
    const sRes = await query("SELECT value FROM platform_settings WHERE key = 'msd_whatsapp_directory' LIMIT 1").catch(() => null);
    const dbMap = sRes && sRes.rows && sRes.rows[0] && sRes.rows[0].value ? sRes.rows[0].value : null;
    const dir = getMsdWhatsappDirectoryBackend(dbMap);
    return res.json({ success: true, data: Object.values(dir) });
  } catch {
    const dir = getMsdWhatsappDirectoryBackend();
    return res.json({ success: true, data: Object.values(dir) });
  }
});

router.put('/whatsapp/msd-directory/:msdCode', authenticateToken, requireRole('agent', 'admin', 'superadmin'), async (req, res) => {
  try {
    const targetCode = String(req.params.msdCode || '').toUpperCase().trim();
    const scope = agentMsdScope(req);
    // Cloisonnement strict multi-MSD (AGENTS.md §4) :
    // Un agent MSD ne peut configurer QUE le guichet de SA propre MSD.
    // Le Super Admin (scope null) supervise et peut configurer toute MSD.
    if (scope && scope.toUpperCase() !== targetCode) {
      return res.status(403).json({ error: `Vous êtes rattaché à la MSD ${scope} et ne pouvez pas modifier le guichet de la MSD ${targetCode}.` });
    }

    const { phone } = req.body || {};
    const rawDigits = String(phone || '').replace(/[^0-9]/g, '');
    let cleanPhone = null;
    if (rawDigits) {
      if (rawDigits.startsWith('221') && rawDigits.length === 12) {
        cleanPhone = `+221 ${rawDigits.slice(3, 5)} ${rawDigits.slice(5, 8)} ${rawDigits.slice(8, 10)} ${rawDigits.slice(10, 12)}`;
      } else if (rawDigits.length === 9) {
        cleanPhone = `+221 ${rawDigits.slice(0, 2)} ${rawDigits.slice(2, 5)} ${rawDigits.slice(5, 7)} ${rawDigits.slice(7, 9)}`;
      } else {
        return res.status(400).json({ error: 'Format de numéro sénégalais invalide (ex: +221 77 123 45 67).' });
      }
    }

    let currentMap = {};
    try {
      const curRes = await query("SELECT value FROM platform_settings WHERE key = 'msd_whatsapp_directory' LIMIT 1").catch(() => null);
      if (curRes && curRes.rows && curRes.rows[0] && curRes.rows[0].value) {
        currentMap = curRes.rows[0].value;
      }
    } catch {
      // Table absente lors du premier démarrage
    }

    currentMap[targetCode] = cleanPhone;

    await query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('msd_whatsapp_directory', $1, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `, [JSON.stringify(currentMap)]).catch(() => {});

    updateMsdWhatsappCache(targetCode, cleanPhone);

    const fullDir = getMsdWhatsappDirectoryBackend(currentMap);
    return res.json({
      success: true,
      message: `Guichet WhatsApp de la MSD ${targetCode} mis à jour : ${cleanPhone || 'Non configuré (repli guichet central)'}`,
      data: fullDir[targetCode] || { msdCode: targetCode, whatsapp: cleanPhone }
    });
  } catch (err) {
    console.error('Erreur PUT /whatsapp/msd-directory/:msdCode:', err.message);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour du guichet WhatsApp.' });
  }
});

router.get('/storage/status', authenticateToken, requireRole('admin', 'superadmin'), (req, res) => {
  res.json({ success: true, data: getStorageStatus() });
});

router.post('/whatsapp/request', authenticateToken, async (req, res) => {
  try {
    const role = normalizeRole(req.user.role);
    if (!WA_ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ error: 'Rôle non autorisé pour une demande WhatsApp.' });
    }

    const {
      type = 'guarantee',
      beneficiary_id,
      structure_name,
      medical_act,
      items,
      estimated_amount,
      attachment
    } = req.body || {};

    if (!['guarantee', 'purchase_order'].includes(type)) {
      return res.status(400).json({ error: 'Type de demande invalide.' });
    }

    const targetBeneficiaryId = role === 'citizen' ? req.user.id : Number(beneficiary_id);
    if (!Number.isInteger(Number(targetBeneficiaryId)) || Number(targetBeneficiaryId) <= 0) {
      return res.status(400).json({ error: 'Bénéficiaire requis.' });
    }

    const amountNum = Math.min(50000000, Math.max(0, Number(estimated_amount) || 0));
    const actText = String(medical_act || '').trim().slice(0, 240);
    const structText = String(structure_name || '').trim().slice(0, 200);

    // Bénéficiaire + MSD de rattachement (routage du guichet WhatsApp)
    const bRes = await query('SELECT id, msd_code FROM beneficiaries WHERE id = $1 LIMIT 1', [targetBeneficiaryId]);
    const benef = bRes.rows && bRes.rows[0];
    if (!benef) {
      return res.status(404).json({ error: 'Bénéficiaire introuvable.' });
    }
    const scope = agentMsdScope(req);
    if (scope && String(benef.msd_code || '').toUpperCase() !== scope.toUpperCase()) {
      return res.status(403).json({ error: 'Ce bénéficiaire ne relève pas de votre MSD.' });
    }
    const msdCode = String(benef.msd_code || 'DKR').toUpperCase();
    const desk = getMsdWhatsappDirectoryBackend()[msdCode] || getMsdWhatsappDirectoryBackend().DKR;

    // Pièce jointe optionnelle (devis / ordonnance) → stockage objet
    let documentUrl = null;
    if (attachment) {
      try {
        const stored = await storeDocumentImage({
          dataInput: attachment,
          folder: type === 'purchase_order' ? 'prescriptions' : 'quotes',
          msdCode,
          prefix: type === 'purchase_order' ? 'ord' : 'gar'
        });
        documentUrl = stored ? stored.url : null;
      } catch (e) {
        console.warn('[WhatsApp] Pièce jointe non stockée:', e.message);
      }
    }

    let created;
    let code;
    if (type === 'purchase_order') {
      const safeItems = (Array.isArray(items) && items.length > 0 ? items : [{ name: actText || 'Ordonnance (photo WhatsApp)', qty: 1, price: amountNum }])
        .slice(0, WA_MAX_ITEMS)
        .map((i) => ({
          name: String(i && i.name || '').slice(0, 160) || 'Médicament',
          qty: Math.max(1, Math.min(99, parseInt(i && i.qty, 10) || 1)),
          price: Math.max(0, Number(i && i.price) || 0)
        }));
      if (documentUrl) safeItems.push({ name: 'Pièce jointe ordonnance', qty: 0, price: 0, document_url: documentUrl });
      const pRes = await query(`
        INSERT INTO purchase_orders (beneficiary_id, items_json, total_amount, status)
        VALUES ($1, $2, $3, 'pending_review')
        RETURNING *
      `, [targetBeneficiaryId, JSON.stringify(safeItems), amountNum]);
      created = pRes.rows[0];
      code = `ORD-${created && created.id ? created.id : Date.now()}`;
    } else {
      if (!actText) {
        return res.status(400).json({ error: 'Acte médical requis pour une demande de lettre de garantie.' });
      }
      const validationCode = `GAR-WA-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const gRes = await query(`
        INSERT INTO guarantee_letters (beneficiary_id, medical_act, estimated_amount, status, validation_code, document_url, agent_note)
        VALUES ($1, $2, $3, 'pending', $4, $5, $6)
        RETURNING *
      `, [targetBeneficiaryId, actText, amountNum, validationCode, documentUrl, structText ? `Structure demandée : ${structText} (canal WhatsApp)` : 'Demande reçue via WhatsApp']);
      created = gRes.rows[0];
      code = (created && created.validation_code) || validationCode;
    }

    // Journal de notification : AUCUNE donnée médicale dans le corps (§5)
    try {
      await query(`
        INSERT INTO notifications (beneficiary_id, recipient, channel, type, title, body, status)
        VALUES ($1, $2, 'whatsapp', 'prise_en_charge', $3, $4, 'pending')
      `, [
        targetBeneficiaryId,
        String(desk.whatsapp).replace(/[^0-9]/g, ''),
        `Demande ${type === 'purchase_order' ? 'bon de commande' : 'lettre de garantie'} #${code}`,
        `Nouvelle demande WhatsApp à instruire par la MSD ${msdCode}.`
      ]);
    } catch {
      // Journalisation non bloquante
    }

    return res.status(201).json({
      success: true,
      type,
      code,
      msdCode,
      desk: { msdCode: desk.msdCode, name: desk.name, whatsapp: desk.whatsapp },
      documentUrl,
      data: created
    });
  } catch (err) {
    console.error('Erreur POST /whatsapp/request:', err.message);
    return res.status(500).json({ error: 'Erreur lors de la création de la demande WhatsApp.' });
  }
});

// Lecture d'une pièce jointe stockée en local (repli disque). Jamais servie
// en statique public : ordonnances et devis sont des données de santé.
// Accès : agent de la MSD propriétaire du dossier, ou admin.
router.get('/documents/:folder/:msd/:file', authenticateToken, (req, res) => {
  const role = normalizeRole(req.user && req.user.role);
  if (!['agent', 'admin', 'superadmin', 'doctor', 'pharmacist', 'citizen'].includes(role)) {
    return res.status(403).json({ error: 'Rôle non autorisé à consulter ce document.' });
  }
  const path = require('path');
  const fs = require('fs');
  const { UPLOADS_ROOT } = require('./objectStorage');
  const { folder, msd, file } = req.params;
  if (!/^[a-z0-9_-]+$/.test(folder) || !/^[A-Z0-9_-]+$/.test(msd) || !/^[a-zA-Z0-9._-]+$/.test(file) || file.includes('..')) {
    return res.status(400).json({ error: 'Chemin de document invalide.' });
  }
  const scope = agentMsdScope(req);
  if (scope && scope.toUpperCase() !== msd) {
    return res.status(403).json({ error: 'Document hors de votre MSD.' });
  }
  const fullPath = path.join(UPLOADS_ROOT, folder, msd, file);
  if (!fullPath.startsWith(UPLOADS_ROOT + path.sep) || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Document introuvable.' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(fullPath);
});

module.exports = router;
