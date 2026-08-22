/**
 * Détection automatique de l'IP LAN du PC serveur.
 *
 * Les QR codes des cartes CSU doivent encoder une URL joignable depuis les
 * smartphones du réseau Wi-Fi (ex. http://192.168.1.52:5173/#/verify/…).
 * Depuis le PC (localhost), le navigateur ne connaît pas sa propre IP LAN :
 * on interroge donc le backend (/api/lan-ip) qui lit les interfaces réseau.
 * Résultat mis en cache 1 h dans localStorage.
 */

const CACHE_KEY = 'cmu-lan-ip-detected';
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

let inflight = null;

const isValidLanIp = (ip) =>
  typeof ip === 'string' &&
  (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip));

export const getCachedLanIp = () => {
  if (typeof window !== 'undefined' && isValidLanIp(window.location.hostname)) {
    return window.location.hostname;
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return '192.168.1.42';
    const { ip, ts } = JSON.parse(raw);
    if (ip && isValidLanIp(ip) && Date.now() - ts < CACHE_TTL) return ip;
  } catch (e) { /* cache corrompu */ }
  return '192.168.1.42';
};

export const detectLanIp = async () => {
  const cached = getCachedLanIp();
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const base = (typeof window !== 'undefined' && window.API_BASE_URL) ||
        (typeof window !== 'undefined' && window.location.port
          ? `http://${window.location.hostname}:5000`
          : '');
      const res = await fetch(`${base}/api/lan-ip`, { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      if (isValidLanIp(data.ip)) {
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ ip: data.ip, ts: Date.now() }));
        } catch (e) { /* stockage indisponible */ }
        return data.ip;
      }
    } catch (e) { /* backend injoignable */ }
    return null;
  })().finally(() => { inflight = null; });
  return inflight;
};
