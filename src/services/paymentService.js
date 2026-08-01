/**
 * ============================================================
 *  MUTUALIS DAKAR — Service de Paiement Mobile Money
 *  Télémédecine UNAMUSC — Ticket Modérateur 2 500 FCFA
 * ============================================================
 *
 *  Ce service centralise tous les appels de paiement.
 *  Il tourne actuellement en mode MOCK (simulation).
 *
 *  ✅ POUR BRANCHER UNE API RÉELLE :
 *     1. Remplacer la fonction `mockPaymentCall` par l'appel HTTP correspondant
 *     2. Renseigner les clés API dans les variables d'environnement (.env)
 *     3. Configurer le webhook de confirmation côté serveur
 *
 * ============================================================
 */

// ─── Générateur de Référence Transaction ────────────────────────────────────
export function generateTransactionRef(provider) {
  const prefix = provider === 'orange' ? 'OM' : provider === 'wave' ? 'WV' : 'FM';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

// ─── Formatage numéro de téléphone sénégalais ───────────────────────────────
export function formatSenegalPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('221')) return `+${digits}`;
  if (digits.length === 9) return `+221${digits}`;
  return `+221${digits}`;
}

// ─── Validation numéro par opérateur ────────────────────────────────────────
export function validatePhoneForProvider(phone, provider) {
  const digits = phone.replace(/\D/g, '').replace(/^221/, '');
  if (digits.length < 9) return { valid: false, error: 'Numéro trop court (9 chiffres requis)' };

  const prefixes = {
    orange: ['77', '78', '76'],
    wave:   ['77', '78', '76', '70', '75'], // Wave accepte tous
    free:   ['76', '70', '75'],
  };

  const twoDigits = digits.slice(0, 2);
  const allowed = prefixes[provider] || ['77', '78', '76', '70', '75'];
  if (!allowed.includes(twoDigits)) {
    const names = { orange: 'Orange', wave: 'Wave', free: 'Free' };
    return {
      valid: false,
      error: `Numéro non compatible avec ${names[provider] || provider} Money`
    };
  }
  return { valid: true };
}

// ─── Mock : simulation d'un paiement (à remplacer par vraie API) ─────────────
async function mockPaymentCall({ provider, phone, amount, ref }) {
  // Simule un délai réseau réaliste (2 à 3 secondes)
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Simulation : 90% de succès, 10% d'échec (comme en conditions réelles)
  const success = Math.random() > 0.10;

  if (success) {
    return {
      success: true,
      transactionRef: ref,
      timestamp: new Date().toISOString(),
      provider,
      phone: formatSenegalPhone(phone),
      amount,
      message: `Paiement de ${amount.toLocaleString('fr-FR')} FCFA confirmé via ${
        provider === 'orange' ? 'Orange Money' : provider === 'wave' ? 'Wave' : 'Free Money'
      }.`,
    };
  } else {
    return {
      success: false,
      error: 'TIMEOUT',
      message: 'La transaction n\'a pas abouti. Vérifiez votre solde et réessayez.',
    };
  }
}

// ─── Orange Money Sénégal ────────────────────────────────────────────────────
async function payWithOrangeMoney({ phone, amount, ref, orderId }) {
  // TODO: Remplacer par l'API Orange Money Sénégal
  // Endpoint: POST https://api.orange.com/orange-money-webpay/dev/v1/webpayment
  // Headers: { Authorization: `Bearer ${process.env.VITE_ORANGE_MONEY_TOKEN}` }
  // Body: { merchant_key, currency: "OUV", order_id, amount, return_url, cancel_url, notif_url, reference, lang }
  //
  // Docs: https://developer.orange.com/apis/orange-money-senegal
  // Sandbox: https://api.orange.com/orange-money-webpay/sn/v1

  console.info('[PaymentService] Orange Money — Mode MOCK actif. TODO: brancher API réelle.');
  return mockPaymentCall({ provider: 'orange', phone, amount, ref });
}

// ─── Wave Sénégal ────────────────────────────────────────────────────────────
async function payWithWave({ phone, amount, ref, orderId }) {
  // TODO: Remplacer par l'API Wave Sénégal
  // Endpoint: POST https://api.wave.com/v1/checkout/sessions
  // Headers: { Authorization: `Bearer ${process.env.VITE_WAVE_API_KEY}` }
  // Body: { currency: "XOF", amount, error_url, success_url, client_reference }
  //
  // Docs: https://docs.wave.com/reference/create-checkout-session
  // Wave envoie un lien de paiement que l'utilisateur confirme sur son app Wave

  console.info('[PaymentService] Wave — Mode MOCK actif. TODO: brancher API réelle.');
  return mockPaymentCall({ provider: 'wave', phone, amount, ref });
}

// ─── Free Money Sénégal ──────────────────────────────────────────────────────
async function payWithFreeMoney({ phone, amount, ref, orderId }) {
  // TODO: Remplacer par l'API Free Money Sénégal (Expresso)
  // Endpoint: POST https://paywithfreemoney.com/api/payment
  // Headers: { Authorization: `Bearer ${process.env.VITE_FREE_MONEY_API_KEY}` }
  // Body: { phone, amount, currency: "XOF", reference, callback_url }
  //
  // Docs: Contacter Free Sénégal / Expresso pour accès sandbox

  console.info('[PaymentService] Free Money — Mode MOCK actif. TODO: brancher API réelle.');
  return mockPaymentCall({ provider: 'free', phone, amount, ref });
}

// ─── Point d'entrée principal (router automatique) ───────────────────────────
/**
 * Lance un paiement Mobile Money.
 *
 * @param {object} params
 * @param {'orange'|'wave'|'free'} params.provider  Opérateur sélectionné
 * @param {string}  params.phone    Numéro de téléphone (format local ou +221)
 * @param {number}  params.amount   Montant en FCFA (ex: 2500)
 * @param {string}  params.orderId  Identifiant commande côté app (ex: CMU-DKR-2026-8812)
 *
 * @returns {Promise<{success, transactionRef?, timestamp?, message, error?}>}
 */
export async function initiatePayment({ provider, phone, amount, orderId }) {
  const ref = generateTransactionRef(provider);

  // Validation préliminaire
  const validation = validatePhoneForProvider(phone, provider);
  if (!validation.valid) {
    return { success: false, error: 'INVALID_PHONE', message: validation.error };
  }

  try {
    switch (provider) {
      case 'orange': return await payWithOrangeMoney({ phone, amount, ref, orderId });
      case 'wave':   return await payWithWave({ phone, amount, ref, orderId });
      case 'free':   return await payWithFreeMoney({ phone, amount, ref, orderId });
      default:
        return { success: false, error: 'UNKNOWN_PROVIDER', message: 'Opérateur non reconnu.' };
    }
  } catch (err) {
    console.error('[PaymentService] Erreur inattendue:', err);
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: 'Erreur réseau. Vérifiez votre connexion et réessayez.',
    };
  }
}

// ─── Utilitaire : logo provider ──────────────────────────────────────────────
export function getProviderInfo(provider) {
  const map = {
    orange: { name: 'Orange Money', logo: '/logo_orange_money.png', color: '#ff7900', bgColor: 'rgba(255,121,0,0.12)', borderColor: '#ff7900' },
    wave:   { name: 'Wave',         logo: '/logo_wave.png',         color: '#1dc4ff', bgColor: 'rgba(29,196,255,0.12)', borderColor: '#1dc4ff' },
    free:   { name: 'Free Money',   logo: '/logo_free_money.svg',   color: '#e11d48', bgColor: 'rgba(225,29,72,0.12)',  borderColor: '#e11d48' },
  };
  return map[provider] || map['orange'];
}
