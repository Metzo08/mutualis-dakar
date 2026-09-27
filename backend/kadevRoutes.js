/**
 * ============================================================
 *  MUTUALIS DAKAR — Routes d'encaissement multi-MSD (Kadev Pay)
 * ============================================================
 *
 *  Chaque MSD est un commerçant indépendant : elle encaisse ses
 *  cotisations, renouvellements, dons et parrainages sur SON compte
 *  marchand. La commission de l'agrégateur est enregistrée à part
 *  (`platform_fee`) et n'est jamais prélevée sur le reversement de
 *  la MSD (`net_amount`).
 *
 *  Routeur autonome : il n'empiète pas sur les routes historiques
 *  Wave / Orange Money, qui restent inchangées.
 */

const express = require('express');
const { query, pool } = require('./db');
const { validate } = require('./validateMiddleware');
const { authenticateToken, requireRole } = require('./rbac');
const z = require('zod');
const kadev = require('./kadevGateway');

const router = express.Router();

/** Montant entier positif en FCFA. */
const amountSchema = z
  .union([z.string(), z.number()])
  .transform((v) => parseInt(v, 10))
  .refine((n) => Number.isInteger(n) && n > 0, { message: 'Montant invalide.' });

const kadevInitSchema = z.object({
  unionCode: z.string().trim().min(2).max(10).optional(),
  phone: z.string().trim().min(9, { message: 'Numéro de téléphone invalide.' }),
  amount: amountSchema,
  beneficiaryId: z.coerce.number().int().positive().optional(),
  purpose: z.enum(['cotisation', 'donation', 'adhesion', 'renouvellement', 'parrainage'], {
    message: 'Objet de paiement invalide.'
  }),
  orderId: z.string().trim().max(100).optional()
});

/**
 * Retrouve le compte marchand d'une MSD.
 * Repli sur le compte « par défaut » (agrégateur) tant que la MSD n'a
 * pas déclaré son propre compte : l'encaissement reste possible, il
 * sera simplement à rattacher au compte définitif.
 */
const findMerchantAccount = async (unionCode) => {
  if (unionCode) {
    const byCode = await query(
      'SELECT * FROM merchant_accounts WHERE UPPER(union_code) = UPPER($1) AND is_active = TRUE LIMIT 1',
      [unionCode]
    );
    if (byCode.rows.length > 0) return byCode.rows[0];
  }
  const fallback = await query(
    'SELECT * FROM merchant_accounts WHERE is_default = TRUE AND is_active = TRUE LIMIT 1'
  );
  return fallback.rows[0] || null;
};

/** Initier un paiement : les fonds sont destinés au compte de la MSD émettrice. */
router.post('/api/kadev/initiate', validate(kadevInitSchema), async (req, res) => {
  try {
    const { unionCode, phone, amount, beneficiaryId, purpose, orderId } = req.body;

    if (!kadev.isAggregatorConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'KADEV_NOT_CONFIGURED',
        message: 'Passerelle Kadev non configurée sur ce serveur (clés API manquantes).'
      });
    }

    const merchant = await findMerchantAccount(unionCode);
    const resolvedUnion = (merchant && merchant.union_code) || unionCode || 'AGG';
    const split = kadev.splitAmount(amount, merchant ? merchant.commission_bps : 0);

    // La référence encode la MSD émettrice : le webhook peut ainsi être
    // routé sans information supplémentaire.
    const ref = `KDV-${resolvedUnion}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const inserted = await query(
      `INSERT INTO payments
         (reference, beneficiary_id, phone, provider, amount, purpose, status,
          union_code, merchant_account_id, gross_amount, platform_fee, net_amount, metadata)
       VALUES ($1,$2,$3,'kadev',$4,$5,'initiated',$6,$7,$8,$9,$10,$11)
       RETURNING id, reference`,
      [
        ref, beneficiaryId || null, phone, amount, purpose,
        resolvedUnion, merchant ? merchant.id : null,
        split.gross, split.platformFee, split.net,
        JSON.stringify({ aggregator: 'kadev', orderId: orderId || null, destination: resolvedUnion })
      ]
    );

    const secret = kadev.resolveUnionSecret(resolvedUnion) || kadev.resolveUnionSecret('AGG');
    const payload = {
      amount: split.gross,
      currency: 'XOF',
      reference: ref,
      phone,
      purpose,
      merchant: resolvedUnion,
      callback_url: `${process.env.SERVER_PUBLIC_URL || 'http://localhost:5000'}/api/kadev/webhook`
    };

    let checkoutUrl = null;
    let isReal = false;
    try {
      const response = await fetch(`${kadev.KADEV_API_BASE}/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Public-Key': kadev.resolveUnionPublicKey(resolvedUnion),
          'X-Secret-Key': secret,
          'X-Signature': kadev.signPayload(kadev.canonicalize(payload), secret)
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      checkoutUrl = data.checkout_url || data.payment_url || data.url || null;
      isReal = Boolean(checkoutUrl);
      if (isReal) {
        await query('UPDATE payments SET provider_transaction_id = $1 WHERE reference = $2',
          [data.id || data.transaction_id || null, ref]);
      }
    } catch (kadevErr) {
      console.error("[KADEV] Échec de l'appel à l'agrégateur :", kadevErr.message);
    }

    res.status(201).json({
      success: true,
      paymentId: inserted.rows[0].id,
      reference: inserted.rows[0].reference,
      provider: 'kadev',
      amount: split.gross,
      status: 'initiated',
      isReal,
      checkoutUrl,
      // Traçabilité de l'encaissement
      unionCode: resolvedUnion,
      unionName: merchant ? merchant.union_name : null,
      platformFee: split.platformFee,
      netToMsd: split.net,
      message: isReal
        ? `Paiement redirigé vers la MSD ${resolvedUnion}.`
        : 'Mode démonstration : aucune clé Kadev exploitable pour cette MSD.'
    });
  } catch (err) {
    console.error('Erreur initiation Kadev :', err);
    res.status(500).json({ error: "Erreur lors de l'initiation du paiement." });
  }
});

/** Statut d'un paiement (utilisé par le polling du frontend). */
router.get('/api/kadev/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await query(
      `SELECT reference, status, amount, gross_amount, platform_fee, net_amount,
              union_code, provider, provider_transaction_id, purpose, created_at
         FROM payments WHERE reference = $1 LIMIT 1`,
      [reference]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Paiement introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erreur statut Kadev :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

/**
 * Webhook unique Kadev : la MSD concernée est déduite de la référence,
 * le secret de vérification est celui de CETTE MSD, puis les effets
 * métier sont appliqués comme pour Wave / Orange.
 */
router.post('/api/kadev/webhook', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const rawBody = req.body && req.body.__raw ? req.body.__raw : JSON.stringify(req.body || {});
    const { reference, status, transaction_id, union_code: unionCodeBody } = req.body || {};

    if (!reference) return res.status(400).json({ error: 'Référence manquante.' });

    const lookup = await client.query('SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [reference]);
    if (lookup.rows.length === 0) return res.status(404).json({ error: 'Paiement introuvable.' });
    const payment = lookup.rows[0];

    const targetUnion = payment.union_code || unionCodeBody || 'AGG';
    const secret = kadev.resolveUnionSecret(targetUnion) || kadev.resolveUnionSecret('AGG');
    const signature = req.headers['x-signature'] || req.headers['x-kadev-signature'];
    if (secret && !kadev.verifyWebhookSignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Signature webhook invalide.' });
    }

    const finalStatus = status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending';
    await client.query(
      `UPDATE payments SET status = $1,
         provider_transaction_id = COALESCE($2, provider_transaction_id),
         webhook_received = TRUE, webhook_payload = $3,
         completed_at = CASE WHEN $1::text IN ('success','failed') THEN NOW() ELSE completed_at END
       WHERE reference = $4`,
      [finalStatus, transaction_id || null, JSON.stringify(req.body || {}), reference]
    );

    if (finalStatus === 'success' && payment.purpose === 'cotisation' && payment.beneficiary_id) {
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      await client.query(
        `INSERT INTO cotisations (beneficiary_id, phone, amount, payment_method, payment_reference, period_start, period_end, status)
         VALUES ($1,$2,$3,'kadev',$4,NOW(),$5,'paid')`,
        [payment.beneficiary_id, payment.phone, payment.amount, reference, periodEnd]
      );
      await client.query("UPDATE beneficiaries SET status = 'active' WHERE id = $1", [payment.beneficiary_id]);
    }

    if (finalStatus === 'success') {
      await client.query(
        'INSERT INTO audit_logs (action, actor, details) VALUES ($1,$2,$3)',
        ['PAIEMENT_CONFIRME', payment.phone,
          `Paiement ${reference} (${payment.amount} FCFA via Kadev) confirmé pour ${payment.purpose} — reversé à la MSD ${targetUnion}.`]
      );
    }

    res.json({ success: true, reference, status: finalStatus, unionCode: targetUnion });
  } catch (err) {
    console.error('Erreur webhook Kadev :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  } finally {
    if (client) client.release();
  }
});

/**
 * Comptes marchands : chaque MSD déclare SON moyen de paiement
 * (clés Kadev, RIB, commission). Les secrets ne sont jamais renvoyés.
 */
router.get('/api/merchants', authenticateToken, requireRole('admin', 'agent'), async (req, res) => {
  try {
    const result = await query(
      `SELECT id, union_code, union_name, region, provider, public_key,
              (secret_key IS NOT NULL AND secret_key <> '') AS has_secret,
              account_number, bank_name, commission_bps, is_active, is_default
         FROM merchant_accounts ORDER BY union_code`
    );
    res.json({ success: true, merchants: result.rows });
  } catch (err) {
    console.error('Erreur liste marchands :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

/** Création / mise à jour du compte de paiement d'une MSD. */
router.put('/api/merchants/:unionCode', authenticateToken, requireRole('admin'), validate(
  z.object({
    unionName: z.string().trim().min(2).max(200).optional(),
    region: z.string().trim().max(100).optional(),
    publicKey: z.string().trim().max(255).optional(),
    secretKey: z.string().trim().max(255).optional(),
    accountNumber: z.string().trim().max(100).optional(),
    bankName: z.string().trim().max(150).optional(),
    commissionBps: z.coerce.number().int().min(0).max(10000).optional(),
    isActive: z.coerce.boolean().optional(),
    isDefault: z.coerce.boolean().optional()
  })
), async (req, res) => {
  try {
    const { unionCode } = req.params;
    const { unionName, region, publicKey, secretKey, accountNumber, bankName, commissionBps, isActive, isDefault } = req.body;

    if (isDefault) {
      await query('UPDATE merchant_accounts SET is_default = FALSE WHERE is_default = TRUE');
    }

    const result = await query(
      `INSERT INTO merchant_accounts
         (union_code, union_name, region, public_key, secret_key, account_number, bank_name, commission_bps, is_active, is_default)
       VALUES ($1, COALESCE($2,$1), $3, $4, $5, $6, $7, COALESCE($8,0), COALESCE($9,TRUE), COALESCE($10,FALSE))
       ON CONFLICT (union_code) DO UPDATE SET
         union_name = COALESCE($2, merchant_accounts.union_name),
         region = COALESCE($3, merchant_accounts.region),
         public_key = COALESCE($4, merchant_accounts.public_key),
         secret_key = COALESCE($5, merchant_accounts.secret_key),
         account_number = COALESCE($6, merchant_accounts.account_number),
         bank_name = COALESCE($7, merchant_accounts.bank_name),
         commission_bps = COALESCE($8, merchant_accounts.commission_bps),
         is_active = COALESCE($9, merchant_accounts.is_active),
         is_default = COALESCE($10, merchant_accounts.is_default),
         updated_at = NOW()
       RETURNING id, union_code, union_name, region, provider, public_key, account_number,
                 bank_name, commission_bps, is_active, is_default`,
      [unionCode.toUpperCase(), unionName, region, publicKey, secretKey, accountNumber, bankName, commissionBps, isActive, isDefault]
    );
    res.json({ success: true, merchant: result.rows[0] });
  } catch (err) {
    console.error('Erreur mise à jour marchand :', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;