/**
 * Source de vérité des bénéficiaires : la BASE, pas le navigateur.
 *
 * Historique du problème : le studio cartes, les statistiques régionales et
 * les dossiers médicaux lisaient tous `getStoredMembers()`, c'est-à-dire un
 * extrait figé de 41 fiches embarqué dans le bundle (src/data/msdDakarMembers.js)
 * et recopié dans le localStorage. La base, elle, contenait 1 003
 * bénéficiaires réellement enregistrés : ils étaient invisibles partout, et
 * les 41 fiches affichées pouvaient ne correspondre à personne.
 *
 * Ce module branche le registre du navigateur sur `GET /api/beneficiaries` :
 * une seule requête remonte le registre réel, et toutes les vues qui lisent
 * `getStoredMembers()` le voient immédiatement — sans les modifier une par une.
 */

import { getStoredMembers, saveStoredMembers } from './beneficiaryStore';
import { getAccessToken, API_BASE } from './api';

/** Registre mis en cache : évite N requêtes quand plusieurs vues montent. */
let cache = null;
let inflight = null;
let lastSyncAt = 0;

/** Au-delà de ce délai, la prochaine lecture repart de la base. */
const FRESH_TTL = 60 * 1000; // 1 minute

/** Vrai lorsqu'un agent est connecté : condition pour lire les données perso. */
export const isAuthenticated = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(localStorage.getItem('cmu-token'));
};

/**
 * Traduit une ligne de la base vers la forme attendue par les vues.
 * Les noms de colonnes diffèrent (snake_case en base, camelCase côté UI) :
 * cette fonction est l'UNIQUE endroit qui fait la traduction.
 */
const fromApi = (b) => {
  const cmuNumber = (b.cmuNumber || '').toString().trim();
  const adherentCode = (b.numeroAdherent || cmuNumber || '').toString().trim();
  const packageType = (b.packageType || '').toString();
  const isSchool = Boolean(b.ine || b.schoolName || b.studentType);

  return {
    // `SRV-<id>` : identifiant serveur. Le studio s'en sert pour cibler
    // PUT/DELETE /api/beneficiaries/:id sans ambiguïté.
    id: `SRV-${b.id}`,
    serverId: b.id,
    cmuNumber,
    adherentCode,
    rawCode: cmuNumber,
    firstName: (b.firstName || '').toString().toUpperCase(),
    lastName: (b.lastName || '').toString().toUpperCase(),
    birthDate: b.birthDate || '',
    birthPlace: (b.birthPlace || '').toString().toUpperCase(),
    gender: (b.gender || '').toString().toUpperCase().startsWith('F') ? 'F' : 'M',
    bloodGroup: b.bloodGroup || '',
    address: b.address || '',
    commune: b.commune || '',
    department: b.department || '',
    departmentUnionId: b.departmentUnionId || '',
    mutuelleOrigine: b.mutuelleName || '',
    phone: b.phone || '',
    package: packageType,
    cardTypeLabel: b.cardTypeLabel || packageType,
    cardProgram: b.cardProgram || (isSchool ? 'CMU_ELEVES' : 'CLASSIC'),
    academicData: isSchool
      ? {
          academicYear: b.academicYear || '',
          classLevel: b.schoolClass || '',
          schoolName: b.schoolName || '',
          ine: b.ine || '',
          ia: b.iaIef || ''
        }
      : undefined,
    tuteurName: b.tutorName || '',
    tuteurPhone: b.tutorPhone || '',
    status: b.status || 'active',
    photoUrl: b.photoUrl || '',
    hasOfficialPhoto: Boolean(b.photoUrl),
    photoStatus: b.photoUrl ? 'OFFICIAL' : 'MISSING',
    verificationStatus: 'VERIFIED_SERVER',
    // Aucun antécédent n'est inventé : le dossier médical reste vide tant
    // qu'un praticien n'a rien saisi.
    allergies: b.allergies || '',
    antecedents: b.antecedents || '',
    sponsorName: b.sponsorName || '',
    sponsorPhone: b.sponsorPhone || '',
    lotCode: b.lotCode || '',
    // Codes historiques fusionnés lors de la consolidation des ré-imports.
    // Une carte déjà imprimée avec l'un d'eux doit retrouver CE porteur : le
    // scan du QR passe par ici (getCardByCode).
    mergedCodes: Array.isArray(b.mergedCodes) ? b.mergedCodes : [],
    dependents: Array.isArray(b.dependents) ? b.dependents : []
  };
};

/**
 * Récupère TOUS les bénéficiaires depuis l'API (pagination automatique).
 * @returns {Promise<Array|null>} null si l'agent n'est pas habilité.
 */
const fetchAll = async () => {
  const pageSize = 200;
  const collected = [];
  let page = 1;
  let totalPages = 1;

  do {
    const res = await fetch(
      `${API_BASE}/api/beneficiaries?page=${page}&limit=${pageSize}`,
      { headers: { Authorization: `Bearer ${getAccessToken() || ''}` } }
    );
    if (!res.ok) {
      // 401/403 : session expirée ou rôle insuffisant. L'appelant conservera
      // son registre local — on ne remplace jamais des données par du vide.
      if (res.status === 401 || res.status === 403) return null;
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : payload.data || [];
    collected.push(...rows);
    totalPages = (payload.pagination && payload.pagination.totalPages) || 1;
    page += 1;
  } while (page <= totalPages);

  return collected;
};

/**
 * Registre synchronisé avec la base. À appeler au démarrage de l'application
 * ou au montage du studio.
 *
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<Array|null>} registre réel, ou null si la base est
 *   injoignable (l'appelant conserve alors son registre local, intact).
 */
export const syncBeneficiariesFromServer = async ({ force = false } = {}) => {
  if (typeof window === 'undefined') return null;
  if (!isAuthenticated()) return null;

  if (!force && cache && Date.now() - lastSyncAt < FRESH_TTL) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const rows = await fetchAll();
      if (!rows) return null; // session expirée : on ne touche à rien

      const mapped = rows.map(fromApi).filter((m) => m.cmuNumber);

      // Le registre du navigateur est remplacé par celui de la base : c'est
      // la source de vérité. Une fiche locale absente de la base a été
      // supprimée côté serveur, ou n'a jamais existé (profil de
      // démonstration) — la conserver réintroduirait des bénéficiaires
      // fictifs sur les cartes imprimées.
      // saveStoredMembers émet déjà `unamusc_store_change` : les statistiques
      // et les dossiers médicaux se rechargent donc automatiquement.
      const saved = saveStoredMembers(mapped);
      if (!saved.ok) {
        // Registre volumineux (photos base64) : le plafond local est atteint.
        // La base fait foi — l'agent peut continuer, les fiches reviendront au
        // prochain chargement depuis le serveur.
        console.warn('[syncBeneficiaries] Registre non écrit en local :', saved.error);
      }
      cache = getStoredMembers();
      lastSyncAt = Date.now();
      return cache;
    } catch (err) {
      console.warn('[syncBeneficiaries] Base injoignable, registre local conservé :', err.message);
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

/**
 * Registre à afficher par les vues : celui de la base s'il est disponible,
 * sinon le registre local. Ne remplace jamais des données par du vide.
 */
export const getLiveMembers = () => {
  if (cache && Date.now() - lastSyncAt < FRESH_TTL) return cache;
  return getStoredMembers();
};

/** Invalide le cache après une modification (import, suppression, adhésion). */
export const invalidateBeneficiariesCache = () => {
  cache = null;
  lastSyncAt = 0;
};

export const isServerSynced = () => Boolean(cache) && Date.now() - lastSyncAt < FRESH_TTL;
