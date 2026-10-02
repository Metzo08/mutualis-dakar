// Personnalisation des cartes CSU — logos des parrains (sponsors solidaires).
//
// Le logo d'un parrain est enregistré côté backend (colonne
// beneficiaries.sponsor_logo via /api/parrainages/sponsors/:phone/logo) puis mis
// en cache dans localStorage afin de rester disponible en mode hors-ligne
// (terrain, Wi-Fi local sans accès à l'API).
//
// Deux mémoires locales :
//  - cmu-sponsor-logos  : { [téléphoneParrain]: dataUrlOuChemin }
//  - cmu-card-sponsors  : { [cmuNumber]: téléphoneParrain }  (attribution carte → parrain)
import { apiFetch, API_BASE, getAccessToken } from './api';

export const SPONSOR_LOGO_MAX_BYTES = 500 * 1024;
const LOGO_STORE_KEY = 'cmu-sponsor-logos';
const ASSIGN_STORE_KEY = 'cmu-card-sponsors';

// --- Helpers de stockage local ---------------------------------------------

const readStore = (key, fallback) => {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

// @returns {boolean} true si l'écriture a abouti. Un quota dépassé ou un
//   stockage indisponible renvoie false : l'appelant DOIT le savoir, sinon il
//   afficherait « logo appliqué » alors que rien n'a été enregistré.
const writeStore = (key, value) => {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Stockage indisponible ou saturé : le backend reste la source de vérité.
    return false;
  }
};

// Clé d'identification d'un contact ou d'un parrain.
//
// Elle ne doit PAS supprimer les lettres : un sponsor peut être identifié
// par un code non numérique (ex. « MAIRIE_DAKAR »). Retirer les lettres
// réduirait la clé à une chaîne vide et ferait échouer silencieusement la
// recherche du logo ET sa propagation aux cartes du parrain — exactement ce
// qui se produisait. On ne retire donc que les séparateurs de présentation.
export const normalizePhoneKey = (phone) =>
  String(phone || '').replace(/[\s.\-/\\()_]/g, '').toUpperCase();

// --- Logos des parrains -----------------------------------------------------

export const getLocalSponsorLogos = () => readStore(LOGO_STORE_KEY, {});

export const getLocalSponsorLogo = (phone) => {
  const key = normalizePhoneKey(phone);
  if (!key) return null;
  return getLocalSponsorLogos()[key] || null;
};

export const setLocalSponsorLogo = (phone, logoUrl) => {
  const key = normalizePhoneKey(phone);
  if (!key) return;
  const store = getLocalSponsorLogos();
  if (logoUrl) store[key] = logoUrl;
  else delete store[key];
  writeStore(LOGO_STORE_KEY, store);
};

export const removeLocalSponsorLogo = (phone) => setLocalSponsorLogo(phone, null);

// --- Attribution carte → parrain -------------------------------------------

export const getCardSponsorAssignments = () => readStore(ASSIGN_STORE_KEY, {});

export const getAssignedSponsorPhone = (cmuNumber) => {
  if (!cmuNumber) return '';
  return getCardSponsorAssignments()[cmuNumber] || '';
};

export const assignSponsorToCard = (cmuNumber, phone) => {
  if (!cmuNumber) return;
  const store = getCardSponsorAssignments();
  if (phone) store[cmuNumber] = phone;
  else delete store[cmuNumber];
  writeStore(ASSIGN_STORE_KEY, store);
};

// --- Logo personnalisé par carte (fonctionne même sans parrain enregistré) -

const CARD_LOGO_STORE_KEY = 'cmu-card-logos';
// Logo partagé par un lot entier : une seule entrée, quel que soit le nombre
// de cartes du lot (le quota localStorage est vite atteint sinon).
const LOT_LOGO_STORE_KEY = 'cmu-lot-logos';

export const getCardLogo = (cmuNumber) => {
  if (!cmuNumber) return null;
  return readStore(CARD_LOGO_STORE_KEY, {})[String(cmuNumber)] || null;
};

export const setCardLogo = (cmuNumber, logoUrl) => {
  if (!cmuNumber) return;
  const store = readStore(CARD_LOGO_STORE_KEY, {});
  if (logoUrl) store[String(cmuNumber)] = logoUrl;
  else delete store[String(cmuNumber)];
  writeStore(CARD_LOGO_STORE_KEY, store);
};

// --- Propagation automatique du logo à toutes les cartes du parrain ---------
// Un parrain (sponsor) parraine souvent plusieurs dizaines d'élèves :
// choisir son logo une seule fois doit suffire. Dès qu'un logo est
// enregistré pour un téléphone de parrain, il est répliqué sur TOUTES les
// cartes qui lui sont attribuées — sans jamais ouvrir chaque carte.

/** Toutes les cartes (numéros CMU) attribuées à un parrain. */
export const getCardsSponsoredBy = (phone) => {
  const key = normalizePhoneKey(phone);
  if (!key) return [];
  const assignments = getCardSponsorAssignments();
  return Object.keys(assignments)
    .filter((cmu) => normalizePhoneKey(assignments[cmu]) === key);
};

/**
 * Réplique un logo sur toutes les cartes d'un parrain.
 * @returns {number} nombre de cartes mises à jour
 */
export const applySponsorLogoToAllCards = (phone, logoUrl) => {
  const cards = getCardsSponsoredBy(phone);
  if (!logoUrl) return 0;
  const store = readStore(CARD_LOGO_STORE_KEY, {});
  cards.forEach((cmu) => { store[String(cmu)] = logoUrl; });
  if (cards.length > 0) writeStore(CARD_LOGO_STORE_KEY, store);
  return cards.length;
};

/**
 * Logo effectif d'une carte : logo d'un parrain explicitement attribué,
 * sinon logo personnalisé de la carte. Ne dépend JAMAIS de la MSD.
 */
export const resolveEffectiveCardLogo = (cmuNumber, sponsorPhone) => {
  const sponsorLogo = sponsorPhone ? getLocalSponsorLogo(sponsorPhone) : null;
  if (sponsorLogo) return sponsorLogo;
  return getCardLogo(cmuNumber);
};

// --- Logo de LOT ------------------------------------------------------------
// Une campagne (Grand Yoff, une MSD, une classe) porte souvent le même logo
// sur TOUTES ses cartes. L'écrire carte par carte en base64 dépasserait le quota
// localStorage (211 cartes × 30 Ko ≈ 6 Mo). On le stocke donc une seule fois
// sous la clé du lot, et les cartes de ce lot le reprennent.

/** Logo attribué à un lot (identifiant de lot). */
export const getLotLogo = (lotId) => {
  if (!lotId || lotId === 'ALL') return null;
  const store = readStore(LOT_LOGO_STORE_KEY, {});
  return store[normalizePhoneKey(lotId)] || null;
};

/** Enregistre le logo d'un lot. Un logo vide retire celui-ci. */
export const setLotLogo = (lotId, logoUrl) => {
  if (!lotId || lotId === 'ALL') return false;
  const store = readStore(LOT_LOGO_STORE_KEY, {});
  if (logoUrl) store[normalizePhoneKey(lotId)] = logoUrl;
  else delete store[normalizePhoneKey(lotId)];
  return writeStore(LOT_LOGO_STORE_KEY, store);
};

// --- Lecture, redimensionnement et compression d'un logo -------------------
//
// Un logo de parrain peut faire plusieurs mégaoctets (scan haute résolution,
// export d'un graphiste). Le conserver tel quel alourdirait le localStorage du
// navigateur ET la colonne beneficiaries.sponsor_logo en base.
//
// On applique donc systématiquement, AVANT stockage :
//   1. un redimensionnement à 512 px sur son plus grand côté ;
//   2. une compression JPEG progressive, avec repli WebP si nécessaire.
// Résultat : quelques dizaines de kilo-octets, quel que soit le fichier source.

/** Côté maximal retenu pour un logo de parrain (en pixels). */
export const LOGO_MAX_DIMENSION = 512;
/** Côté minimal du repli si la compression JPEG ne suffit pas. */
const LOGO_MIN_DIMENSION = 192;
/** Paliers de qualité JPEG essayés dans l'ordre. */
const LOGO_QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5];

/** Poids réel (en octets) d'une data URL — la charge utile est en base64. */
export const dataUrlBytes = (dataUrl) => {
  if (!dataUrl) return 0;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.ceil((base64.length * 3) / 4);
};

/** Formate un poids en octets pour l'affichage. */
export const formatBytes = (bytes) => {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} Ko`;
  return `${(kb / 1024).toFixed(1).replace('.', ',')} Mo`;
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible ou corrompue.'));
    img.src = src;
  });

/** Redimensionne une image dans un canvas (fond blanc : un PNG transparent
    deviendrait noir une fois encodé en JPEG). */
const drawScaled = (img, maxDimension) => {
  const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Compression impossible sur cet appareil.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
};

/** Encode un canvas en descendant les paliers de qualité jusqu'à tenir
    dans le budget, avec rétrécissement puis WebP en dernier recours. */
const encodeUnderBudget = (canvas, maxBytes) => {
  for (const quality of LOGO_QUALITY_STEPS) {
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlBytes(jpeg) <= maxBytes) return jpeg;
  }
  // JPEG insuffisant : on rétrécit franchement, puis on réessaie.
  const small = document.createElement('canvas');
  const factor = LOGO_MIN_DIMENSION / Math.max(1, canvas.width, canvas.height);
  small.width = Math.max(1, Math.round(canvas.width * factor));
  small.height = Math.max(1, Math.round(canvas.height * factor));
  const ctx = small.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, small.width, small.height);
    ctx.drawImage(canvas, 0, 0, small.width, small.height);
    for (const quality of [0.5, 0.4, 0.3]) {
      const jpeg = small.toDataURL('image/jpeg', quality);
      if (dataUrlBytes(jpeg) <= maxBytes) return jpeg;
    }
    // Dernier recours : WebP, bien plus dense à qualité égale.
    const webp = small.toDataURL('image/webp', 0.6);
    if (dataUrlBytes(webp) <= maxBytes) return webp;
    return small.toDataURL('image/jpeg', 0.25);
  }
  return canvas.toDataURL('image/jpeg', 0.3);
};

/**
 * Lit un fichier logo, le RÉDUIT et le COMPRESSE avant de le renvoyer.
 * Toute taille de fichier est acceptée : la limite de 500 Ko porte sur le
 * RÉSULTAT, plus jamais sur le fichier source.
 *
 * @returns {Promise<{dataUrl: string, originalBytes: number, finalBytes: number,
 *                    width: number, height: number, format: string}>}
 */
export const readLogoFileOptimized = async (file) => {
  if (!file) throw new Error('Aucun fichier sélectionné.');
  if (!/^image\//.test(file.type)) {
    throw new Error('Le fichier doit être une image (PNG, JPEG, WEBP ou SVG).');
  }

  const originalBytes = file.size;

  // Le SVG est déjà vectoriel et léger : conservé intact pour la netteté.
  if (file.type === 'image/svg+xml') {
    if (originalBytes > SPONSOR_LOGO_MAX_BYTES) {
      throw new Error(`Logo SVG trop volumineux : ${formatBytes(originalBytes)} (${formatBytes(SPONSOR_LOGO_MAX_BYTES)} maximum).`);
    }
    return {
      dataUrl: await readFileAsDataUrl(file),
      originalBytes,
      finalBytes: originalBytes,
      width: 0,
      height: 0,
      format: 'SVG'
    };
  }

  const source = await readFileAsDataUrl(file);
  const img = await loadImage(source);
  const canvas = drawScaled(img, LOGO_MAX_DIMENSION);
  const dataUrl = encodeUnderBudget(canvas, SPONSOR_LOGO_MAX_BYTES);

  return {
    dataUrl,
    originalBytes,
    finalBytes: dataUrlBytes(dataUrl),
    width: canvas.width,
    height: canvas.height,
    format: dataUrl.startsWith('data:image/webp') ? 'WEBP' : 'JPEG'
  };
};

/** Variante simplifiée : renvoie directement la data URL compressée. */
export const readImageFileAsDataUrl = async (file) =>
  (await readLogoFileOptimized(file)).dataUrl;

const normalizeSponsor = (sponsor) => ({
  id: sponsor.id ?? null,
  firstName: sponsor.firstName || sponsor.first_name || '',
  lastName: sponsor.lastName || sponsor.last_name || '',
  name:
    sponsor.name ||
    `${sponsor.firstName || sponsor.first_name || ''} ${sponsor.lastName || sponsor.last_name || ''}`.trim(),
  phone: sponsor.phone || '',
  cmuNumber: sponsor.cmuNumber || sponsor.cmu_number || '',
  mutuelleName: sponsor.mutuelleName || sponsor.mutuelle_name || '',
  filleulCount: Number(sponsor.filleulCount ?? sponsor.filleulsCount ?? 0) || 0,
  sponsorLogo: sponsor.sponsorLogo || null
});

// --- Synchronisation backend ------------------------------------------------

// Liste des parrains disponibles avec leur logo.
// 1) endpoint public /api/parrainages/demo-sponsors
// 2) repli authentifié /api/parrainages/sponsors
// 3) repli hors-ligne : parrains déjà mémorisés localement
export const fetchSponsorsWithLogos = async () => {
  const localLogos = getLocalSponsorLogos();
  const mergeLocal = (list) =>
    list.map((s) => ({
      ...s,
      sponsorLogo: s.sponsorLogo || localLogos[normalizePhoneKey(s.phone)] || null
    }));

  try {
    const res = await fetch(`${API_BASE}/api/parrainages/demo-sponsors`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { sponsors: mergeLocal(data.map(normalizeSponsor)), source: 'server' };
      }
    }
  } catch {
    /* API indisponible : on tente le repli authentifié puis le local */
  }

  try {
    const res = await apiFetch('/api/parrainages/sponsors');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return { sponsors: mergeLocal(data.map(normalizeSponsor)), source: 'server' };
      }
    }
  } catch {
    /* repli local */
  }

  const offline = Object.entries(localLogos).map(([phone, logo]) => ({
    id: null,
    firstName: '',
    lastName: '',
    name: `Parrain ${phone}`,
    phone,
    cmuNumber: '',
    mutuelleName: '',
    filleulCount: 0,
    sponsorLogo: logo
  }));

  return { sponsors: offline, source: offline.length > 0 ? 'local' : 'empty' };
};

// Enregistre le logo d'un parrain : backend d'abord, cache local dans tous les cas.
export const saveSponsorLogo = async (phone, logoUrl) => {
  setLocalSponsorLogo(phone, logoUrl);
  // Sans jeton, la route serveur renverrait 401 : inutile d'aller jusqu'à la
  // requête. On le dit tout de suite, et surtout on ne laisse pas croire à un
  // échec serveur.
  if (!getAccessToken()) {
    return {
      saved: 'local',
      sponsorLogo: logoUrl,
      warning: 'Vous n\'êtes pas connecté : logo conservé sur cet appareil uniquement. Connectez-vous (agent ou admin) pour l\'enregistrer aussi en base.'
    };
  }
  try {
    const res = await apiFetch(`/api/parrainages/sponsors/${encodeURIComponent(phone)}/logo`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logoUrl: logoUrl || '' })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.sponsorLogo) setLocalSponsorLogo(phone, data.sponsorLogo);
      return { saved: 'server', sponsorLogo: (data && data.sponsorLogo) || logoUrl || null };
    }
    if (res.status === 404) {
      return {
        saved: 'local',
        sponsorLogo: logoUrl,
        warning: 'Parrain absent de la base : logo conservé localement.'
      };
    }
    // Diagnostic précis : un message générique masque la vraie cause
    // (session expirée, rôle insuffisant, base injoignable, image refusée).
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return { saved: 'local', sponsorLogo: logoUrl, warning: 'Session expirée : reconnectez-vous pour enregistrer le logo en base.' };
    }
    if (res.status === 403) {
      return { saved: 'local', sponsorLogo: logoUrl, warning: 'Droits insuffisants (agent ou admin requis) : logo conservé localement.' };
    }
    if (res.status === 400 || res.status === 422) {
      return { saved: 'local', sponsorLogo: logoUrl, warning: `Image refusée par le serveur : ${body.error || 'format non accepté'}.` };
    }
    return {
      saved: 'local',
      sponsorLogo: logoUrl,
      warning: `Serveur indisponible (erreur ${res.status}) : logo conservé localement.`
    };
  } catch (err) {
    return {
      saved: 'local',
      sponsorLogo: logoUrl,
      warning: 'Serveur injoignable : logo conservé localement (hors-ligne).'
    };
  }
};

// Supprime le logo d'un parrain (serveur + cache local).
export const deleteSponsorLogo = async (phone) => {
  removeLocalSponsorLogo(phone);
  try {
    const res = await apiFetch(`/api/parrainages/sponsors/${encodeURIComponent(phone)}/logo`, {
      method: 'DELETE'
    });
    if (res.ok) return { removed: 'server' };
    return { removed: 'local' };
  } catch {
    return { removed: 'local' };
  }
};
