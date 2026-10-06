// ─────────────────────────────────────────────
// <SecurePhoto> — image de bénéficiaire, y compris protégée
//
// Une balise <img> ordinaire échoue sur les photos servies par une route
// authentifiée : le navigateur n'attache jamais l'en-tête Authorization aux
// sous-ressources. Ce composant télécharge l'image AVEC le jeton puis rend
// une URL locale. Tant que ce composant n'était pas utilisé, chaque fiche
// affichait une image cassée alors que la donnée existait.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { loadProtectedPhoto, isProtectedPhotoUrl } from '../utils/photoLoader';

/**
 * @param {string|null} photoUrl   URL de la photo (API protégée, data:, chemin).
 * @param {number|string} serverId Clé de cache — l'identifiant serveur de la fiche.
 * @param {object} style           Styles appliqués à l'<img>.
 * @param {string} alt             Texte alternatif.
 * @param {string} fallbackSrc     Image par défaut si la photo est indisponible.
 */
export default function SecurePhoto({ photoUrl, serverId, style, alt = '', fallbackSrc = '/csu_profile_hero_real.png', onError }) {
  const [resolved, setResolved] = useState(() =>
    // Photo non protégée : utilisable immédiatement, sans état d'attente.
    !photoUrl || !isProtectedPhotoUrl(photoUrl) ? photoUrl : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    if (!photoUrl) {
      setResolved(null);
      return;
    }
    if (!isProtectedPhotoUrl(photoUrl)) {
      setResolved(photoUrl);
      return;
    }

    loadProtectedPhoto(photoUrl, serverId).then(({ url, error }) => {
      if (cancelled) return;
      if (url) {
        setResolved(url);
      } else {
        console.warn(`[SecurePhoto] photo de ${serverId} indisponible (${error})`);
        setFailed(true);
      }
    });

    return () => { cancelled = true; };
  }, [photoUrl, serverId]);

  if (!resolved || failed) {
    // Pas d'image par défaut pour une photo manquante : afficher une
    // silhouette neutre plutôt qu'une photo d'une AUTRE personne, ce qui
    // serait grave sur une carte d'assurance santé.
    if (onError) { try { onError(); } catch (e) { /* ignoré */ } }
    return (
      <div
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8' }}
        title="Photo non disponible"
      >
        <span style={{ fontSize: '1.6rem' }}>👤</span>
      </div>
    );
  }

  return <img src={resolved} alt={alt} style={style} onError={() => setFailed(true)} />;
}
