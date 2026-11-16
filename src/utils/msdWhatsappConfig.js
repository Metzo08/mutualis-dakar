/**
 * ============================================================================
 *  ANNUAIRE DES GUICHETS WHATSAPP PAR DÉPARTEMENT / MSD (UNAMUSC)
 * ============================================================================
 *  Chaque MSD a son propre guichet WhatsApp pour les Lettres de Garantie
 *  (Hôpital 80 %) et les Bons de Commande (Pharmacie 50 %).
 *
 *  Source de vérité : le backend (`GET /api/whatsapp/msd-directory`, lui-même
 *  alimenté par `WHATSAPP_MSD_<CODE>` dans backend/.env). Ce fichier n'est
 *  que le repli hors-ligne.
 *
 *  ⚠️ RÈGLE : aucun numéro inventé. Seul le guichet de Dakar est vérifié
 *  (cf. cardPrograms.js). Une MSD sans numéro vérifié est routée vers le
 *  guichet central et marquée `configured: false`. Envoyer une demande de
 *  prise en charge à un numéro non vérifié reviendrait à transmettre des
 *  données de santé à un inconnu.
 * ============================================================================
 */

const DAKAR_DESK = '+221 76 845 54 99';

const MSD_LIST = [
  ['DKR', 'MSD Départementale de Dakar', 'Dakar', DAKAR_DESK],
  ['PKN', 'MSD Départementale de Pikine', 'Dakar', null],
  ['GDW', 'MSD Départementale de Guédiawaye', 'Dakar', null],
  ['RFS', 'MSD Départementale de Rufisque', 'Dakar', null],
  ['THS', 'MSD Départementale de Thiès', 'Thiès', null],
  ['MBR', 'MSD Départementale de Mbour', 'Thiès', null],
  ['TVN', 'MSD Départementale de Tivaouane', 'Thiès', null],
  ['STL', 'MSD Départementale de Saint-Louis', 'Saint-Louis', null],
  ['KLC', 'MSD Départementale de Kaolack', 'Kaolack', null],
  ['ZGC', 'MSD Départementale de Ziguinchor', 'Ziguinchor', null],
  ['DRB', 'MSD Départementale de Diourbel', 'Diourbel', null],
  ['MBK', 'MSD Départementale de Mbacké (Touba)', 'Diourbel', null],
  ['LGA', 'MSD Départementale de Louga', 'Louga', null],
  ['TBA', 'MSD Départementale de Tambacounda', 'Tambacounda', null],
  ['KLD', 'MSD Départementale de Kolda', 'Kolda', null],
  ['MTM', 'MSD Départementale de Matam', 'Matam', null],
  ['FTK', 'MSD Départementale de Fatick', 'Fatick', null],
  ['KFR', 'MSD Départementale de Kaffrine', 'Kaffrine', null],
  ['KDG', 'MSD Départementale de Kédougou', 'Kédougou', null],
  ['SDH', 'MSD Départementale de Sédhiou', 'Sédhiou', null]
];

export const DEFAULT_MSD_WHATSAPP_DIRECTORY = MSD_LIST.map(([msdCode, name, region, whatsapp]) => ({
  msdCode,
  name,
  region,
  whatsapp: whatsapp || DAKAR_DESK,
  configured: Boolean(whatsapp)
}));

const CACHE_KEY = 'cmu_msd_whatsapp_directory_v2';

const DEPT_LABEL_TO_CODE = {
  dakar: 'DKR', pikine: 'PKN', guediawaye: 'GDW', 'guédiawaye': 'GDW', rufisque: 'RFS',
  thies: 'THS', 'thiès': 'THS', mbour: 'MBR', tivaouane: 'TVN', 'saint-louis': 'STL',
  kaolack: 'KLC', ziguinchor: 'ZGC', diourbel: 'DRB', mbacke: 'MBK', 'mbacké': 'MBK',
  touba: 'MBK', louga: 'LGA', tambacounda: 'TBA', kolda: 'KLD', matam: 'MTM',
  fatick: 'FTK', kaffrine: 'KFR', kedougou: 'KDG', 'kédougou': 'KDG', sedhiou: 'SDH', 'sédhiou': 'SDH'
};

/** Annuaire courant : cache serveur si disponible, sinon repli intégré. */
export function getMsdWhatsappDirectory() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) return cached;
    }
  } catch {
    // Cache illisible : repli intégré
  }
  return DEFAULT_MSD_WHATSAPP_DIRECTORY;
}

/** Rafraîchit l'annuaire depuis le backend (best-effort, hors-ligne toléré). */
export async function refreshMsdWhatsappDirectory() {
  try {
    const res = await fetch(`${window.API_BASE_URL || ''}/api/whatsapp/msd-directory`);
    if (!res.ok) return getMsdWhatsappDirectory();
    const json = await res.json();
    const list = Array.isArray(json) ? json : (json.data || []);
    if (list.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      return list;
    }
  } catch {
    // Hors-ligne : on garde le cache / repli
  }
  return getMsdWhatsappDirectory();
}

/**
 * Code MSD de l'assuré : msd_code explicite, puis département, puis analyse
 * du matricule (DKR-PKN-2026-0001, PKN_260001.0, SN-DK-PIK-9001…).
 */
export function detectMsdCode({ citizenUser = null, agentUser = null, cmuNumber = '' } = {}) {
  const validCodes = new Set(getMsdWhatsappDirectory().map((d) => d.msdCode));
  const candidates = [
    citizenUser?.msd_code, citizenUser?.msdCode, agentUser?.msd_code, agentUser?.msdCode,
    citizenUser?.department, agentUser?.department
  ].filter(Boolean);

  for (const raw of candidates) {
    const upper = String(raw).trim().toUpperCase();
    if (validCodes.has(upper)) return upper;
    const mapped = DEPT_LABEL_TO_CODE[String(raw).trim().toLowerCase()];
    if (mapped) return mapped;
  }

  const cmu = String(cmuNumber || citizenUser?.cmu_number || citizenUser?.cmuNumber || '').trim().toUpperCase();
  if (cmu) {
    const structured = cmu.match(/^([A-Z]{3})-([A-Z]{3})-\d{4}/);
    if (structured && validCodes.has(structured[2])) return structured[2];
    for (const part of cmu.split(/[-_.]/).filter(Boolean)) {
      if (part === 'PIK') return 'PKN';
      if (validCodes.has(part)) return part;
    }
  }
  return 'DKR';
}

/** Entrée complète d'une MSD (nom, région, numéro WhatsApp, configured). */
export function getMsdWhatsappInfo(msdCode = 'DKR') {
  const dir = getMsdWhatsappDirectory();
  const upper = String(msdCode || 'DKR').trim().toUpperCase();
  return dir.find((d) => d.msdCode === upper) || dir[0];
}

/** Normalise un numéro sénégalais au format wa.me (221XXXXXXXXX). */
export function toWaNumber(phone, fallback = DAKAR_DESK) {
  const digits = String(phone || fallback).replace(/[^0-9]/g, '');
  if (digits.startsWith('221') && digits.length === 12) return digits;
  if (digits.length === 9) return `221${digits}`;
  return String(fallback).replace(/[^0-9]/g, '');
}

/**
 * Compresse une photo (devis / ordonnance) côté navigateur avant envoi :
 * le backend refuse les corps JSON > 1 Mo. 1280 px / JPEG 0,72 garde une
 * ordonnance lisible pour ~150-300 Ko.
 */
export function compressImageFile(file, maxSide = 1280, quality = 0.72) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith('image/')) { resolve(null); return; }
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Garde-fou : ~950 Ko de Base64 maximum
        resolve(dataUrl.length > 950000 ? canvas.toDataURL('image/jpeg', 0.5) : dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
