/**
 * ============================================================
 *  MUTUALIS DAKAR — Passerelle de paiement Kadev Pay
 * ============================================================
 *
 *  RÔLE
 *  ----
 *  Kadev Pay est un agrégateur de paiement mobile money (Wave, Orange).
 *  Sur notre plateforme, chaque MSD est un COMMERCANT INDÉPENDANT :
 *
 *     lsx  MSD Dakar    encaisse → compte marchand Kadev de la MSD Dakar
 *      MSD Diourbel    encaisse → compte marchand Kadev de la MSD Diourbel
 *      MSD Thiès       encaisse → compte marchand Kadev de la MSD Thiès
 *
 *  La commission de l'agrégateur est à la charge de la PLATEFORME : elle
 *  est calculée et enregistrée à part (`platform_fee`), et n'est jamais
 *  déduite du montant reversé à la MSD (`net_amount`).
 *
 *  SÉCURITÉ
 *  --------
 *  - Les clés secrètes ne quittent JAMAIS le serveur.
 *  - Les secrets MSD sont lus depuis les variables d'environnement
 *    (KADEV_SECRET_AGG pour l'agrégateur, KADEV_SECRET_<UNION> par MSD,
 *    ex. KADEV_SECRET_DKR / KADEV_SECRET_DRB) ou depuis la table
 *    `merchant_accounts`.
 *  - Aucune clé n'est écrite en clair dans le dépôt.
 */

const crypto = require('crypto');

// URL de l'API Kadev — surchargeable pour le bac à sable.
const KADEV_API_BASE = (
  process.env.KADEV_API_BASE ||
  process.env.KADEV_BASE_URL ||
  'https://api.kadev.ci'
).replace(/\/+$/, '');

// Clés de l'AGRÉGATEUR (compte plateforme) : elles servent à signer les
// appels et à recevoir les notifications/webhooks.
const AGGREGATOR_PUBLIC_KEY = process.env.KADEV_PUBLIC_KEY || '';
const AGGREGATOR_SECRET_KEY = process.env.KADEV_SECRET_KEY || process.env.KADEV_SECRET_AGG || '';

/** Le compte agrégateur est-il exploitable ? */
const isAggregatorConfigured = () => Boolean(AGGREGATOR_PUBLIC_KEY && AGGREGATOR_SECRET_KEY);

/**
 * Secret Kadev du compte d'une MSD, déduit de son code d'union.
 * Exemple : union 'DKR' → process.env.KADEV_SECRET_DKR
 *
 * @param {string} unionCode  code d'union ('DKR', 'DRB', 'AGG'…)
 * @returns {string} secret ou chaîne vide
 */
const resolveUnionSecret = (unionCode) => {
  const code = String(unionCode || 'AGG').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return process.env[`KADEV_SECRET_${code}`] || '';
};

/**
 * Clé publique du compte d'une MSD (utile pour l'affichage / le checkout).
 */
const resolveUnionPublicKey = (unionCode) => {
  const code = String(unionCode || 'AGG').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return process.env[`KADEV_PUBLIC_${code}`] || AGGREGATOR_PUBLIC_KEY;
};

/**
 * Répartition d'un montant entre la plateforme et la MSD émettrice.
 *
 * @param {number} amount       montant total payé par l'adhérent (FCFA)
 * @param {number} commissionBps commission de l'agrégateur en centièmes de %
 * @returns {{gross:number, platformFee:number, net:number}}
 */
const splitAmount = (amount, commissionBps = 0) => {
  const gross = Math.max(0, Math.round(Number(amount) || 0));
  const bps = Math.max(0, Math.min(10000, Number(commissionBps) || 0));
  // Arrondi au franc CFA inférieur : la MSD ne perd jamais un franc.
  const platformFee = Math.floor((gross * bps) / 10000);
  return { gross, platformFee, net: gross - platformFee };
};

/**
 * Signature HMAC-SHA256 canonique d'une charge utile.
 * Utilisée pour authentifier les appels sortants ET pour vérifier
 * les webhooks entrants (le même algorithme des deux côtés).
 *
 * @param {string} payload    corps sérialisé de façon stable
 * @param {string} secret     clé secrète
 * @returns {string} signature hexadécimale
 */
const signPayload = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

/**
 * Construit un corps JSON de façon déterministe (clés triées) : deux
 * exécutions sur le même objet produisent la même signature.
 */
const canonicalize = (obj) => {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalize).join(',')}]`;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
};

/**
 * Vérifie la signature d'un webhook entrant (comparaison à temps constant).
 *
 * @param {string} rawBody  corps BRUT de la requête (tel que reçu)
 * @param {string} signature  signature fournie dans l'en-tête
 * @param {string} secret   secret de la MSD concernée
 */
const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!signature || !secret) return false;
  const provided = String(signature).replace(/^sha256=/i, '').trim().toLowerCase();
  const expected = signPayload(rawBody, secret).toLowerCase();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

module.exports = {
  KADEV_API_BASE,
  AGGREGATOR_PUBLIC_KEY: () => AGGREGATOR_PUBLIC_KEY,
  isAggregatorConfigured,
  resolveUnionSecret,
  resolveUnionPublicKey,
  splitAmount,
  signPayload,
  canonicalize,
  verifyWebhookSignature
};