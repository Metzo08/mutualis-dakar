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
import { apiFetch, API_BASE } from './api';

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

const writeStore = (key, value) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible ou saturé : le backend reste la source de vérité */
  }
};

// Clé de téléphone normalisée (chiffres uniquement) pour des correspondances fiables.
export const normalizePhoneKey = (phone) => String(phone || '').replace(/\D/g, '');

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

// --- Lecture d'un fichier image --------------------------------------------

export const readImageFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Aucun fichier sélectionné.'));
      return;
    }
    if (!/^image\//.test(file.type)) {
      reject(new Error('Le fichier doit être une image (PNG, JPEG, WEBP ou SVG).'));
      return;
    }
    if (file.size > SPONSOR_LOGO_MAX_BYTES) {
      reject(new Error(`Logo trop volumineux : ${Math.round(file.size / 1024)} Ko (500 Ko maximum).`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsDataURL(file);
  });

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
    return {
      saved: 'local',
      sponsorLogo: logoUrl,
      warning: 'Enregistrement serveur indisponible : logo conservé localement.'
    };
  } catch {
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
