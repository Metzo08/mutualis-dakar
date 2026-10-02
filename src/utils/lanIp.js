/**
 * Détection automatique de l'IP LAN du PC serveur.
 *
 * Les QR codes des cartes CSU doivent encoder une URL joignable depuis les
 * smartphones du réseau Wi-Fi (ex. http://192.168.1.100:5173/#/verify/…).
 * Depuis le PC (localhost), le navigateur ne connaît pas sa propre IP LAN :
 * on interroge donc le backend (/api/lan-ip) qui lit les interfaces réseau.
 * Résultat mis en cache 1 h dans localStorage.
 *
 * AUCUNE IP de repli codée en dur : l'adresse du PC change quand il rejoint un
 * autre réseau (Wi-Fi du cabinet, partage de connexion 4G…). Un repli figé
 * produisait des QR pointant vers une IP inexistante — le téléphone affichait
 * alors « site inaccessible » au moment du scan. Ne vaut mieux pas d'IP
 * qu'une IP fausse : l'appelant affiche un champ à saisir.
 */

const CACHE_KEY = 'cmu-lan-ip-detected';
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

let inflight = null;

/** Une IP d'adresse privée (RFC 1918) utilisable par un téléphone du LAN. */
export const isValidLanIp = (ip) => {
  if (typeof ip !== 'string') return false;
  const m = ip.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (m.slice(1).some((part) => Number(part) > 255)) return false;
  if (a === 127 || a === 0) return false; // loopback / réservé
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

/**
 * IP LAN connue à l'instant présent, sans appel réseau.
 * @returns {string|null} null si aucune IP exploitable n'est connue.
 */
export const getCachedLanIp = () => {
  if (typeof window === 'undefined') return null;
  // L'app est déjà ouverte via l'IP LAN : c'est par définition la bonne.
  if (isValidLanIp(window.location.hostname)) return window.location.hostname;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ip, ts } = JSON.parse(raw);
    if (isValidLanIp(ip) && Date.now() - ts < CACHE_TTL) return ip;
  } catch (e) { /* cache corrompu */ }
  return null;
};

/** Oublie l'IP mémorisée (bouton « Actualiser IP » après un changement de réseau). */
export const clearLanIpCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('cmu-wifi-ip');
    localStorage.removeItem('cmu-server-ip');
  } catch (e) { /* stockage indisponible */ }
};

/**
 * Mémorise l'IP dans le cache et dans les deux clés lues par CmuCard et
 * CardStudio, pour que tous les écrans utilisent la même adresse.
 * Exporté pour le préchauffage effectué au démarrage (main.jsx).
 */
export const rememberLanIp = (ip) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ip, ts: Date.now() }));
    // Les deux autres clés sont lues par CmuCard et CardStudio : on les
    // synchronise pour que les QR déjà générés et les écrans ouverts
    // ailleurs dans l'application utilisent la même adresse.
    localStorage.setItem('cmu-wifi-ip', ip);
    localStorage.setItem('cmu-server-ip', ip);
  } catch (e) { /* stockage indisponible */ }
  return ip;
};

/**
 * Demande au backend l'IP LAN réelle du PC.
 * @param {{ force?: boolean }} [options] force=true ignore le cache (réseau changé).
 * @returns {Promise<string|null>} null si le backend est injoignable.
 */
export const detectLanIp = async ({ force = false } = {}) => {
  if (!force) {
    const cached = getCachedLanIp();
    if (cached) return cached;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const base = (typeof window !== 'undefined' && window.API_BASE_URL) ||
        (typeof window !== 'undefined' && window.location.port
          ? `http://${window.location.hostname}:5000`
          : '');
      const res = await fetch(`${base}/api/lan-ip`, { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      if (isValidLanIp(data?.ip)) return rememberLanIp(data.ip.trim());
    } catch (e) { /* backend injoignable */ }
    return null;
  })().finally(() => { inflight = null; });
  return inflight;
};
