// ─────────────────────────────────────────────
// CHARGEMENT DES PHOTOS SÉCURISÉES
//
// Le problème : les photos sont servies par /api/beneficiaries/:id/photo,
// une route authentifiée. Une balise <img src="..."> ne peut PAS envoyer
// l'en-tête Authorization — le navigateur ne le permet pas sur les
// sous-ressources. Résultat : chaque photo renvoyait 401 et s'affichait
// cassée, alors que la donnée existait bien en base.
//
// La solution : télécharger l'image AVEC le jeton via apiFetch (qui gère
// le renouvellement de session), puis créer une URL locale (blob:) que la
// balise <img> peut consommer sans en-tête.
//
// Le blob reste en mémoire jusqu'à fermeture de l'onglet — pas de fuite :
// on révoque les anciennes URLs quand on recharge une même fiche.
// ─────────────────────────────────────────────

const blobCache = new Map(); // serverId -> { url, blobUrl }
let inflight = new Map();

/** Détecte une URL de photo protégée (route API authentifiée). */
export const isProtectedPhotoUrl = (url) =>
  typeof url === 'string' && url.includes('/api/beneficiaries/') && url.endsWith('/photo');

/** Révoque un blob quand on le remplace — évite l'accumulation en mémoire. */
const revokeOld = (serverId) => {
  const old = blobCache.get(serverId);
  if (old && old.blobUrl && old.blobUrl.startsWith('blob:')) {
    try { URL.revokeObjectURL(old.blobUrl); } catch (e) { /* déjà révoquée */ }
  }
};

/**
 * Charge une photo potentiellement protégée et retourne une URL utilisable
 * dans <img src>.
 *
 * @param {string} photoUrl   URL de la photo (API protégée, data: ou chemin).
 * @param {number|string} serverId  Identifiant de la fiche (clé de cache).
 * @returns {Promise<{url: string|null, error?: string}>}
 */
export async function loadProtectedPhoto(photoUrl, serverId) {
  if (!photoUrl) return { url: null };

  // Photo non protégée : rien à faire, le navigateur la charge directement.
  if (!isProtectedPhotoUrl(photoUrl)) return { url: photoUrl };

  // Déjà en cache : réutilisable immédiatement.
  const cached = blobCache.get(serverId);
  if (cached && cached.url === photoUrl) return { url: cached.blobUrl };

  // Requête déjà en cours : on la partage (évite N téléchargements d'un coup).
  const pending = inflight.get(serverId);
  if (pending) return pending;

  inflight.set(serverId, (async () => {
    try {
      const { apiFetch } = await import('./api');
      const res = await apiFetch(photoUrl);
      if (!res || !res.ok) {
        return { url: null, error: res ? `HTTP_${res.status}` : 'INJOIGNABLE' };
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      revokeOld(serverId);
      blobCache.set(serverId, { url: photoUrl, blobUrl });
      return { url: blobUrl };
    } catch (e) {
      return { url: null, error: e.message };
    } finally {
      inflight.delete(serverId);
    }
  })());

  return inflight.get(serverId);
}

/** Purge le cache (déconnexion, changement de compte). */
export function clearPhotoCache() {
  for (const [id] of blobCache) revokeOld(id);
  blobCache.clear();
}
