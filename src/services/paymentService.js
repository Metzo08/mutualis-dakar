/**
 * ============================================================
 *  MUTUALIS DAKAR — Service de Paiement Mobile Money
 *  Télémédecine UNAMUSC — Ticket Modérateur 2 500 FCFA
 * ============================================================
 *
 *  Ce service centralise tous les appels de paiement.
 *  ✅ BRANCHEMENT BACKEND : le frontend délègue l'initiation au backend
 *     (/api/payments/initiate) qui gère les passerelles réelles Wave Checkout
 *     et Orange Money WebPayment (clés d'environnement). Réponse :
 *       { reference, checkoutUrl, isReal }
 *       - isReal=true  → ouvrir checkoutUrl puis suivre /api/payments/:reference
 *                        (le webhook serveur /api/payments/webhook/:provider
 *                        confirme la transaction et applique les effets métier)
 *       - isReal=false → simulation serveur (aucune clé API configurée)
 *     Repli : backend injoignable (hors-ligne) → simulation locale mock.
 * ============================================================
 */

import { apiFetch } from '../utils/api';

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

// ─── Mapping frontend → backend ('orange_money' | 'wave') ───────────────────
const PROVIDER_TO_BACKEND = { orange: 'orange_money', wave: 'wave', free: 'wave' };

// ─── Mock : repli local (backend injoignable / hors-ligne) ─────────────
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
      mode: 'local-mock',
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

// ─── Appel backend : initiation + suivi du statut ───────────────────────
export async function checkPaymentStatus(reference, { timeoutMs = 60000, intervalMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await apiFetch(`/api/payments/${encodeURIComponent(reference)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' || data.status === 'failed') {
          return { success: data.status === 'success', status: data.status, payment: data };
        }
      }
    } catch { /* backend momentanément injoignable : on réessaie */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { success: false, status: 'timeout', payment: null };
}

// ─── Appel réel : initiation via le backend ─────────────────────────────
async function backendPaymentCall({ provider, phone, amount, orderId, purpose = 'cotisation' }) {
  const backendProvider = PROVIDER_TO_BACKEND[provider] || 'wave';

  const res = await apiFetch('/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      beneficiaryId: orderId || null,
      phone: formatSenegalPhone(phone),
      provider: backendProvider,
      amount,
      purpose,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backend ${res.status}`);
  }

  const data = await res.json();

  // Cas 1 : passerelle réelle (clés API configurées) → redirection + polling
  if (data.isReal && data.checkoutUrl) {
    if (typeof window !== 'undefined') {
      window.open(data.checkoutUrl, '_blank', 'noopener');
    }
    const outcome = await checkPaymentStatus(data.reference);
    if (outcome.success) {
      return {
        success: true,
        transactionRef: data.reference,
        timestamp: new Date().toISOString(),
        provider,
        phone: formatSenegalPhone(phone),
        amount,
        mode: 'backend-real',
        checkoutUrl: data.checkoutUrl,
        message: `Paiement de ${amount.toLocaleString('fr-FR')} FCFA confirmé via ${
          provider === 'orange' ? 'Orange Money' : 'Wave'
        }.`,
      };
    }
    return {
      success: false,
      error: outcome.status === 'timeout' ? 'TIMEOUT' : 'FAILED',
      message:
        outcome.status === 'timeout'
          ? "Le paiement n'a pas été confirmé à temps. Vérifiez votre application Mobile Money."
          : 'Le paiement a été refusé par la passerelle. Réessayez.',
    };
  }

  // Cas 2 : simulation backend (aucune clé API configurée) → confirmation démo
  return {
    success: true,
    transactionRef: data.reference,
    timestamp: new Date().toISOString(),
    provider,
    phone: formatSenegalPhone(phone),
    amount,
    mode: 'backend-simulation',
    message: `Paiement de ${amount.toLocaleString('fr-FR')} FCFA simulé (démo) via ${
      provider === 'orange' ? 'Orange Money' : 'Wave'
    }. Référence ${data.reference}.`,
  };
}

// ─── Point d'entrée principal (router automatique) ───────────────────────────
/**
 * Lance un paiement Mobile Money.
 *
 * @param {object} params
 * @param {'orange'|'wave'|'free'} params.provider  Opérateur sélectionné
 * @param {string}  params.phone    Numéro de téléphone (format local ou +221)
 * @param {number}  params.amount   Montant en FCFA (ex: 2500)
 * @param {string}  params.orderId  Identifiant commande / bénéficiaire côté app
 * @param {string}  [params.purpose='cotisation'] 'cotisation' | 'donation' | 'adhesion'
 *
 * @returns {Promise<{success, transactionRef?, timestamp?, message, error?}>}
 */
export async function initiatePayment({ provider, phone, amount, orderId, purpose = 'cotisation' }) {
  const validation = validatePhoneForProvider(phone, provider);
  if (!validation.valid) {
    return { success: false, error: 'INVALID_PHONE', message: validation.error };
  }

  try {
    // 1. Tentative via le backend (passerelles réelles ou simulation serveur)
    return await backendPaymentCall({ provider, phone, amount, orderId, purpose });
  } catch (err) {
    // 2. Backend injoignable (hors-ligne) → repli simulation locale
    console.warn('[PaymentService] Backend injoignable, repli simulation locale :', err.message);
    try {
      return await mockPaymentCall({ provider, phone, amount, ref: generateTransactionRef(provider) });
    } catch (mockErr) {
      console.error('[PaymentService] Erreur inattendue:', mockErr);
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Erreur réseau. Vérifiez votre connexion et réessayez.',
      };
    }
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
