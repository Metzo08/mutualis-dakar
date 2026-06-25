// Routes API pour les modules avancés MUTUALIS DAKAR :
// 1. Fidélité assurés (points + badges)
// 2. Paiements Orange Money / Wave (+ webhooks)
// 3. Synchronisation hors-ligne (file d'attente)
const express = require('express');
const crypto = require('crypto');
const { query, pool } = require('./db');
const { validate } = require('./validateMiddleware');
const { parsePagination } = require('./pagination');
const { authenticateToken, requireRole } = require('./rbac');
const { phoneSchema } = require('./validators');
const z = require('zod');

const router = express.Router();

// ============================================================================
// 1. FIDÉLITÉ ASSURÉS (points + badges)
// ============================================================================

// Définition des badges disponibles et leurs seuils
const BADGE_DEFINITIONS = [
  { slug: 'assure_fidele', name: 'Assuré Fidèle', nameWo: 'Assuré Fidèle', icon: '🥇', description: 'Cotisation payée à temps 2 années consécutives', threshold: 50, reason: 'cotisation_a_temps' },
  { slug: 'parrain_solidarite', name: 'Parrain Solidaire', nameWo: 'Parrain Bu Solidarité', icon: '🤝', description: 'A parrainé au moins un ménage ou élève', threshold: 40, reason: 'parrainage' },
  { slug: 'citoyen_modele', name: 'Citoyen Modèle', nameWo: 'Citoyen Bu Baax', icon: '🌟', description: 'Aucune réclamation injustifiée pendant 1 an', threshold: 30, reason: 'sans_reclamation' },
  { slug: 'veteran_5ans', name: 'Vétéran 5 ans', nameWo: 'Vétéran 5 at', icon: '🏆', description: 'Assuré depuis 5 ans ou plus', threshold: 100, reason: 'annee_fidelite' }
];

// Classement des assurés par points (agent/admin)
router.get('/api/loyalty/leaderboard', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT lp.beneficiary_id, b.first_name, b.last_name, b.cmu_number, b.mutuelle_name, SUM(lp.points) AS total
       FROM loyalty_points lp JOIN beneficiaries b ON lp.beneficiary_id = b.id
       GROUP BY lp.beneficiary_id, b.first_name, b.last_name, b.cmu_number, b.mutuelle_name
       ORDER BY total DESC LIMIT 20`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur classement :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// Récupère le solde de points + badges d'un bénéficiaire
router.get('/api/loyalty/:beneficiaryId', authenticateToken, async (req, res) => {
  try {
    const { beneficiaryId } = req.params;
    const numId = parseInt(beneficiaryId);
    // Un citoyen ne peut consulter que son propre solde
    if (req.user.role === 'citizen' && req.user.id !== numId) {
      return res.status(403).json({ error: 'Accès interdit.' });
    }

    const pointsRes = await query(
      'SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_points WHERE beneficiary_id = $1',
      [numId]
    );
    const totalPoints = parseInt(pointsRes.rows[0].total || '0', 10);

    const historyRes = await query(
      'SELECT points, reason, created_at FROM loyalty_points WHERE beneficiary_id = $1 ORDER BY created_at DESC',
      [numId]
    );

    const badgesRes = await query(
      'SELECT badge_slug, badge_name, unlocked_at FROM loyalty_badges WHERE beneficiary_id = $1 ORDER BY unlocked_at DESC',
      [numId]
    );
    const unlockedSlugs = new Set(badgesRes.rows.map((b) => b.badge_slug));

    // Liste tous les badges disponibles avec statut débloqué/non
    const badges = BADGE_DEFINITIONS.map((def) => ({
      ...def,
      unlocked: unlockedSlugs.has(def.slug),
      progress: Math.min(100, Math.round((totalPoints / def.threshold) * 100))
    }));

    // Calcule le niveau
    const level = totalPoints >= 200 ? 'Or' : totalPoints >= 100 ? 'Argent' : totalPoints >= 50 ? 'Bronze' : 'Nouveau';

    res.json({
      totalPoints,
      level,
      history: historyRes.rows,
      badges,
      nextBadge: badges.find((b) => !b.unlocked) || null
    });
  } catch (err) {
    console.error('Erreur fidélité :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Attribution de points (interne, appelé par d'autres routes)
async function awardPoints(beneficiaryId, points, reason) {
  if (!beneficiaryId || !points || !reason) return;
  try {
    await query(
      'INSERT INTO loyalty_points (beneficiary_id, points, reason) VALUES ($1, $2, $3)',
      [beneficiaryId, points, reason]
    );
    // Vérifie si un nouveau badge est débloquable
    const totalRes = await query(
      'SELECT COALESCE(SUM(points), 0) AS total FROM loyalty_points WHERE beneficiary_id = $1',
      [beneficiaryId]
    );
    const total = parseInt(totalRes.rows[0].total || '0', 10);
    for (const def of BADGE_DEFINITIONS) {
      if (def.reason === reason && total >= def.threshold) {
        await query(
          `INSERT INTO loyalty_badges (beneficiary_id, badge_slug, badge_name) VALUES ($1, $2, $3)
           ON CONFLICT (beneficiary_id, badge_slug) DO NOTHING`,
          [beneficiaryId, def.slug, def.name]
        );
      }
    }
  } catch (err) {
    console.warn('Erreur attribution points fidélité :', err.message);
  }
}

// ============================================================================
// 2. PAIEMENTS ORANGE MONEY / WAVE (+ webhooks)
// ============================================================================

// Schéma de validation pour initier un paiement
const paymentInitSchema = z.object({
  beneficiaryId: z.union([z.string(), z.number()]).optional().nullable(),
  phone: phoneSchema,
  provider: z.enum(['orange_money', 'wave'], { message: 'Fournisseur invalide.' }),
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n > 0, { message: 'Montant invalide.' }),
  purpose: z.enum(['cotisation', 'donation', 'adhesion'], { message: 'Objet invalide.' })
});

// Initier un paiement (génère une référence + simulation d'initiation API opérateur)
router.post('/api/payments/initiate', validate(paymentInitSchema), async (req, res) => {
  try {
    const { beneficiaryId, phone, provider, amount, purpose } = req.body;
    // Génère une référence unique
    const prefix = provider === 'orange_money' ? 'OM' : 'WAV';
    const ref = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const result = await query(
      `INSERT INTO payments (reference, beneficiary_id, phone, provider, amount, purpose, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'initiated') RETURNING id, reference`,
      [ref, beneficiaryId || null, phone, provider, amount, purpose]
    );

    let checkoutUrl = null;
    let isReal = false;

    // 1. Intégration réelle avec Wave Checkout API si la clé API existe
    if (provider === 'wave' && process.env.WAVE_API_KEY) {
      try {
        const waveResponse = await fetch('https://api.wave.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WAVE_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: amount,
            currency: 'XOF',
            error_url: `${req.headers.origin || 'http://localhost:5180'}/#/payments?status=failed&ref=${ref}`,
            success_url: `${req.headers.origin || 'http://localhost:5180'}/#/payments?status=success&ref=${ref}`,
            client_reference: ref
          })
        });
        const waveData = await waveResponse.json();
        if (waveData && waveData.wave_launch_url) {
          checkoutUrl = waveData.wave_launch_url;
          isReal = true;
          console.log(`[PAIEMENT] Session de paiement Wave créée avec succès. Réf: ${ref}`);
        } else {
          console.error('[PAIEMENT] Réponse invalide de l\'API Wave Checkout :', waveData);
        }
      } catch (waveErr) {
        console.error('[PAIEMENT] Échec de l\'appel API Wave Checkout :', waveErr.message);
      }
    }
    // 2. Intégration réelle avec Orange Money WebPayment API si les clés API existent
    else if (provider === 'orange_money' && process.env.ORANGE_API_KEY && process.env.ORANGE_MERCHANT_KEY) {
      try {
        // Étape A : Authentification OAuth pour récupérer le token temporaire Orange
        const authHeader = Buffer.from(`${process.env.ORANGE_API_KEY}:${process.env.ORANGE_API_SECRET || ''}`).toString('base64');
        const tokenResponse = await fetch('https://api.orange.com/oauth/v2/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (accessToken) {
          // Étape B : Appel de l'API WebPayment pour initier le paiement mobile
          const webpayResponse = await fetch('https://api.orange.com/om-webpay/v1/webpayment', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              merchant_key: process.env.ORANGE_MERCHANT_KEY,
              currency: 'OUV', // Code monnaie de test Orange, changer en 'XOF' en prod réelle
              order_id: ref,
              amount: amount,
              return_url: `${req.headers.origin || 'http://localhost:5180'}/#/payments?status=return&ref=${ref}`,
              cancel_url: `${req.headers.origin || 'http://localhost:5180'}/#/payments?status=cancelled&ref=${ref}`,
              notif_url: `${process.env.SERVER_PUBLIC_URL || 'http://localhost:5000'}/api/payments/webhook/orange_money`
            })
          });
          const webpayData = await webpayResponse.json();
          if (webpayData && webpayData.payment_url) {
            checkoutUrl = webpayData.payment_url;
            isReal = true;
            console.log(`[PAIEMENT] Session de paiement Orange Money créée avec succès. Réf: ${ref}`);
          } else {
            console.error('[PAIEMENT] Réponse invalide de l\'API Orange WebPay :', webpayData);
          }
        }
      } catch (omErr) {
        console.error('[PAIEMENT] Échec de l\'appel API Orange Money :', omErr.message);
      }
    }

    if (!isReal) {
      console.log(`[PAIEMENT] Clés d'API absentes ou invalides pour ${provider}. Utilisation du mode Simulation démo.`);
    }

    res.status(201).json({
      success: true,
      paymentId: result.rows[0].id,
      reference: result.rows[0].reference,
      provider,
      amount,
      status: 'initiated',
      isReal,
      checkoutUrl,
      message: isReal
        ? `Redirection vers la passerelle sécurisée ${provider}…`
        : `Simulation de paiement ${provider} initiée. Composez le code USSD ou laissez la démo valider automatiquement dans 6 secondes.`
    });
  } catch (err) {
    console.error('Erreur initiation paiement :', err);
    res.status(500).json({ error: 'Erreur lors de l\'initiation du paiement.' });
  }
});

// Vérifier le statut d'un paiement
router.get('/api/payments/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await query('SELECT * FROM payments WHERE reference = $1 LIMIT 1', [reference]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur vérification paiement :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// Webhook de confirmation (appelé par Orange Money / Wave)
// NOTE : En production, vérifier la signature du webhook avec le secret partagé.
router.post('/api/payments/webhook/:provider', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { provider } = req.params;
    const { reference, status, provider_transaction_id } = req.body;

    if (!reference) {
      return res.status(400).json({ error: 'Référence manquante.' });
    }

    await client.query('BEGIN');

    const payRes = await client.query('SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [reference]);
    if (payRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Paiement introuvable.' });
    }
    const payment = payRes.rows[0];

    // Vérification de signature (simplifiée — en prod : HMAC-SHA256 avec secret)
    const expectedSig = req.headers['x-signature'];
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev_webhook_secret';
    const computedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (process.env.NODE_ENV === 'production' && expectedSig !== computedSig) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Signature invalide.' });
    }

    const finalStatus = status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending';
    await client.query(
      `UPDATE payments SET status = $1, provider_transaction_id = COALESCE($2, provider_transaction_id), webhook_received = TRUE, webhook_payload = $3, completed_at = CASE WHEN $1 IN ('success','failed') THEN NOW() ELSE completed_at END WHERE reference = $4`,
      [finalStatus, provider_transaction_id || null, JSON.stringify(req.body), reference]
    );

    // Si succès : effets de bord selon l'objet du paiement
    if (finalStatus === 'success') {
      if (payment.purpose === 'cotisation' && payment.beneficiary_id) {
        // Enregistre la cotisation + active le bénéficiaire
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        await client.query(
          `INSERT INTO cotisations (beneficiary_id, phone, amount, payment_method, payment_reference, period_start, period_end, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid')`,
          [payment.beneficiary_id, payment.phone, payment.amount, provider === 'orange_money' ? 'om' : 'wave', payment.reference, periodStart, periodEnd]
        );
        await client.query("UPDATE beneficiaries SET status = 'active' WHERE id = $1", [payment.beneficiary_id]);
        // Points de fidélité
        await client.query(
          `INSERT INTO loyalty_points (beneficiary_id, points, reason) VALUES ($1, 50, 'cotisation_a_temps')
           ON CONFLICT DO NOTHING`,
          [payment.beneficiary_id]
        );
      } else if (payment.purpose === 'donation') {
        await client.query(
          `INSERT INTO donations (amount, target) VALUES ($1, $2)`,
          [payment.amount, 'general']
        );
      }
      // Audit log
      await client.query(
        `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
        ['PAIEMENT_CONFIRME', payment.phone, `Paiement ${payment.reference} (${payment.amount} FCFA via ${provider}) confirmé pour : ${payment.purpose}.`]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, reference, status: finalStatus });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('Erreur webhook paiement :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  } finally {
    if (client) client.release();
  }
});

// Historique des paiements (agent/admin : tout ; citoyen : seulement les siens)
router.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const { status, provider } = req.query;
    const { page, limit, offset } = parsePagination(req);
    const isAgent = ['agent', 'admin'].includes(req.user.role);
    let whereSql = ' WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (!isAgent) {
      whereSql += ` AND beneficiary_id = $${paramIdx}`;
      params.push(req.user.id);
      paramIdx++;
    }
    if (status) {
      whereSql += ` AND status = $${paramIdx}`;
      params.push(status);
      paramIdx++;
    }
    if (provider) {
      whereSql += ` AND provider = $${paramIdx}`;
      params.push(provider);
      paramIdx++;
    }

    const countRes = await query(`SELECT COUNT(*) FROM payments${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);
    const dataRes = await query(
      `SELECT * FROM payments${whereSql} ORDER BY initiated_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur liste paiements :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ============================================================================
// 3. SYNCHRONISATION HORS-LIGNE (file d'attente)
// ============================================================================

const syncItemSchema = z.object({
  deviceId: z.string().max(255).optional().nullable(),
  beneficiaryId: z.union([z.string(), z.number()]).optional().nullable(),
  action: z.enum(['claim', 'complaint', 'donation', 'cotisation', 'adhesion'], { message: 'Action invalide.' }),
  payload: z.record(z.any())
});

// Soumettre une action hors-ligne (le client envoie ses actions en attente au retour de connexion)
router.post('/api/sync/queue', authenticateToken, validate(syncItemSchema), async (req, res) => {
  try {
    const { deviceId, action, payload } = req.body;
    const beneficiaryId = req.body.beneficiaryId || req.user.id;
    const result = await query(
      `INSERT INTO sync_queue (device_id, beneficiary_id, action, payload) VALUES ($1, $2, $3, $4) RETURNING id`,
      [deviceId || null, beneficiaryId, action, JSON.stringify(payload)]
    );
    res.status(201).json({ success: true, syncId: result.rows[0].id });
  } catch (err) {
    console.error('Erreur file de sync :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// Traiter la file de synchronisation (exécuter les actions en attente)
router.post('/api/sync/process', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const pending = await query(
      `SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 100`
    );
    let processed = 0;
    let failed = 0;

    for (const item of pending.rows) {
      try {
        const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
        // Dispatch selon l'action
        if (item.action === 'claim') {
          const reimbursedAmount = Math.round((parseInt(payload.amount || 0) * 80) / 100);
          await query(
            `INSERT INTO claims (beneficiary_id, beneficiary_name, phone, structure_name, care_type, care_description, amount, coverage_rate, reimbursed_amount, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 80, $8, 'pending')`,
            [item.beneficiary_id, payload.beneficiaryName || '', payload.phone || '', payload.structureName || '', payload.careType || 'consultation', payload.careDescription || '', parseInt(payload.amount || 0), reimbursedAmount]
          );
        } else if (item.action === 'complaint') {
          await query(
            `INSERT INTO complaints (beneficiary_name, phone, title, description, status) VALUES ($1, $2, $3, $4, 'open')`,
            [payload.beneficiaryName || '', payload.phone || '', payload.title || '', payload.description || '']
          );
        } else if (item.action === 'donation') {
          await query(
            `INSERT INTO donations (amount, target) VALUES ($1, $2)`,
            [parseInt(payload.amount || 0), payload.target || 'general']
          );
        } else if (item.action === 'cotisation') {
          await query(
            `INSERT INTO cotisations (beneficiary_id, phone, amount, payment_method, period_start, period_end, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'paid')`,
            [item.beneficiary_id, payload.phone || '', parseInt(payload.amount || 4500), payload.paymentMethod || 'wave', payload.periodStart, payload.periodEnd]
          );
          if (item.beneficiary_id) {
            await query("UPDATE beneficiaries SET status = 'active' WHERE id = $1", [item.beneficiary_id]);
          }
        } else if (item.action === 'adhesion') {
          const randNum = Math.floor(1000 + Math.random() * 9000);
          const mSh = (payload.mutuelleName || 'CMU').split(' ').pop().substring(0, 3).toUpperCase();
          const cmuNumber = payload.cmuNumber || `SN-DK-${mSh}-${randNum}`;
          
          const pinCode = payload.pinCode || '1234';
          const salt = await require('bcrypt').genSalt(10);
          const hashedPin = await require('bcrypt').hash(pinCode, salt);
          
          const bRes = await query(
            `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, pin_code, sponsor_phone, school_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11, $12, $13) RETURNING id`,
            [
              payload.firstName, payload.lastName, payload.birthDate, payload.phone, 
              payload.email || '', payload.address || '', payload.mutuelleName || 'Médina', 
              payload.packageType || 'individuel', payload.paymentMethod || 'wave', cmuNumber,
              hashedPin, payload.sponsorPhone || null, payload.schoolName || null
            ]
          );
          
          const newBeneficiaryId = bRes.rows[0].id;
          
          if (payload.familyMembers && Array.isArray(payload.familyMembers)) {
            for (const f of payload.familyMembers) {
              await query(
                `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES ($1, $2, $3, $4)`,
                [newBeneficiaryId, f.name, f.relation, parseInt(f.age || 0)]
              );
            }
          }
          
          // Award welcome points
          await awardPoints(newBeneficiaryId, 50, 'cotisation_a_temps');
        }
        await query('UPDATE sync_queue SET status = $1, processed_at = NOW() WHERE id = $2', ['processed', item.id]);
        processed++;
      } catch (e) {
        await query('UPDATE sync_queue SET status = $1 WHERE id = $2', ['failed', item.id]);
        failed++;
      }
    }
    res.json({ success: true, processed, failed, total: pending.rows.length });
  } catch (err) {
    console.error('Erreur traitement sync :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// État de la file de sync (agent/admin)
router.get('/api/sync/status', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT status, COUNT(*) AS count FROM sync_queue GROUP BY status`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur statut sync :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = { router, awardPoints };
