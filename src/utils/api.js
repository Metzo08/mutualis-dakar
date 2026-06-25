// Helper HTTP centralisé pour le frontend MUTUALIS DAKAR.
// Gère automatiquement :
//  - l'attachement du header Authorization (access token)
//  - la rotation transparente du refresh token en cas de 401
//  - la déconnexion automatique si le refresh échoue

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const TOKEN_KEY = 'cmu-token';
export const REFRESH_TOKEN_KEY = 'cmu-refresh-token';

// File d'attente pour éviter plusieurs refresh simultanés
let refreshPromise = null;

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Tente de renouveler les jetons via le refresh token.
// Retourne true si réussi, false sinon (et purge les jetons).
export async function refreshAccessToken() {
  // Évite plusieurs appels de refresh en parallèle
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = await res.json();
      if (data.success && data.token) {
        setTokens(data.token, data.refreshToken);
        return true;
      }
      clearTokens();
      return false;
    } catch (err) {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// Wrapper fetch qui :
//  - attache le header Authorization si un access token est présent
//  - en cas de 401, tente un refresh puis rejoue la requête initiale
//  - si le refresh échoue, déclenche un événement de déconnexion
export async function apiFetch(path, options = {}) {
  const accessToken = getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
    ...options,
    headers
  });

  // Si 401 et qu'on a un refresh token, on tente le renouvellement
  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Rejoue la requête initiale avec le nouvel access token
      headers['Authorization'] = `Bearer ${getAccessToken()}`;
      res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
        ...options,
        headers
      });
    } else {
      // Refresh impossible : notifie l'application pour déconnexion
      window.dispatchEvent(new CustomEvent('cmu-session-expired'));
    }
  }

  return res;
}

export { API_BASE };
