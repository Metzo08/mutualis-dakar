// ─────────────────────────────────────────────
// IDENTIFIANTS TURN pour les navigateurs
//
// Le navigateur a besoin des iceServers AVANT de créer la
// RTCPeerConnection. Sans serveur TURN, la téléconsultation ne fonctionne
// que si les deux postes arrivent à se voir directement : en 4G ou derrière
// un NAT d'entreprise, ils n'y arrivent pas et la vidéo reste bloquée.
//
// Le backend dérive des identifiants éphémères (HMAC-SHA1, RFC 5766 §14.3)
// et ne donne jamais le secret. Le cache local évite de redemander à chaque
// consultation : ils sont valables 6 h, on les garde 5 h pour garder une
// marge sur l'horloge.
//
// Un cache incorrect ici est silencieux et grave : la consultation échoue
// chez le patient sans explication. On invalide donc volontairement trop tôt
// plutôt que trop tard.
// ─────────────────────────────────────────────

const CACHE_KEY = 'cmu-turn-credentials';
const CACHE_MAX_AGE_MS = 5 * 60 * 60 * 1000; // 5 h — les serveurs vivent 6 h

let inflight = null;

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !Array.isArray(cached.iceServers) || cached.iceServers.length === 0) return null;
    if (Date.now() - cached.fetchedAt > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return cached.iceServers;
  } catch (e) {
    return null;
  }
};

const writeCache = (iceServers) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ iceServers, fetchedAt: Date.now() }));
  } catch (e) { /* quota : la requête suivante refetchera */ }
};

/**
 * Retourne les iceServers pour les RTCPeerConnection.
 *
 * @param {object} [apiFetchRef]  fonction apiFetch (injectée pour éviter une
 *                                dépendance circulaire en tests).
 * @returns {Promise<{iceServers: Array, source: 'cache'|'server'|'stun-only', error?: string}>}
 */
export async function getIceServers(apiFetch) {
  const cached = readCache();
  if (cached) return { iceServers: cached, source: 'cache' };

  // Une seule requête même si plusieurs consultations démarrent en même
  // temps : les résultats partagent la promesse en cours.
  if (!inflight) {
    inflight = (async () => {
      try {
        const fetcher = apiFetch || ((path, opts) => fetch(path, opts));
        const res = await fetcher('/api/turn-credentials');
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          // Le backend a répondu explicitement : TURN non configuré. On
          // transmet, l'interface doit pouvoir expliquer la cause réelle.
          return {
            iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
            source: 'stun-only',
            error: err.code === 'TURN_NOT_CONFIGURED' ? 'TURN_NOT_CONFIGURED' : `HTTP_${res.status}`
          };
        }
        const data = await res.json();
        if (!Array.isArray(data.iceServers) || data.iceServers.length === 0) {
          return { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }], source: 'stun-only', error: 'EMPTY_SERVER_RESPONSE' };
        }
        writeCache(data.iceServers);
        return { iceServers: data.iceServers, source: 'server' };
      } catch (e) {
        // Backend injoignable : on tente quand même STUN. La téléconsultation
        // peut fonctionner en réseau local, elle ne doit pas être bloquée
        // par une panne de l'API.
        return { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }], source: 'stun-only', error: `NETWORK_${e.message}` };
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/** Vide le cache — à appeler si la négociation échoue de façon répétée. */
export function invalidateTurnCredentials() {
  try { localStorage.removeItem(CACHE_KEY); } catch (e) { /* ignoré */ }
}
