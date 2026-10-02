// Import en masse des bénéficiaires depuis un fichier Excel (format MSD Dakar)
// et appariement automatique des photos par nom / code / téléphone.

import * as XLSX from 'xlsx';

// Règles de codage des matricules : module LÉGER (`cmuCode.js`), sans `xlsx`.
// Elles sont ré-exportées ici pour que tous les appels existants (tests,
// scripts, imports dynamiques) continuent de fonctionner sans changement.
export {
  REGION_CODES,
  regionCodeFor,
  currentCampaignYear,
  buildStructuredCode,
  parseStructuredCode,
  lastSequenceFor,
  householdRank,
  withHouseholdRank,
  LEGACY_GENERATED_RE,
  isLegacyGeneratedCode
} from './cmuCode';
import {
  isLegacyGeneratedCode, currentCampaignYear, regionCodeFor,
  lastSequenceFor, buildStructuredCode, withHouseholdRank
} from './cmuCode';
import { resolveUnion } from './cardPrograms';

/**
 * Recode les fiches produites par l'ancien générateur (`DKR-2600001`) au
 * format structuré (`DKR-DKR-2026-0001`).
 *
 * ⚠️ NON-RÉGRESSION — deux garanties :
 *  1. Seuls les codes correspondant à `LEGACY_GENERATED_RE` sont touchés.
 *     Aucune carte imprimée d'avant ne porte ce motif (elles utilisent `_`
 *     ou un préfixe de programme) : les anciennes cartes sont donc
 *     rigoureusement inchangées.
 *  2. Un code absent ou déjà pris n'est jamais réattribué : la séquence
 *     repart du maximum réellement constaté.
 *
 * @param {Array} members — registre complet (titres + ayants droit)
 * @param {{unionId?:string, year?:number|string}} opts
 * @returns {{members: Array, migrated: number, mapping: Object}} registre
 *          migré, nombre de fiches recodées et ancien→nouveau code
 */
export const migrateLegacyCodes = (members, opts = {}) => {
  const unionId = opts.unionId || 'DKR';
  const year = opts.year || currentCampaignYear();
  const region = regionCodeFor(unionId);
  const union = String(resolveUnion(unionId).id || unionId).toUpperCase().slice(0, 3);

  // 1. Recenser tous les codes déjà en usage (structurés ET anciens).
  const used = new Set();
  for (const m of members || []) {
    if (m.cmuNumber) used.add(String(m.cmuNumber).toUpperCase());
    (m.dependents || []).forEach((d) => {
      if (d.cmuNumber) used.add(String(d.cmuNumber).toUpperCase());
    });
  }

  let seq = lastSequenceFor(used, { region, unionId: union, year });
  let migrated = 0;
  const mapping = {};

  const nextCode = () => {
    for (let i = 1; i <= 20000; i++) {
      const candidate = buildStructuredCode({ region, unionId: union, year, seq: seq + i });
      if (!used.has(candidate)) {
        used.add(candidate);
        seq = seq + i;
        return candidate;
      }
    }
    throw new Error('Impossible d’attribuer un matricule : séquence saturée.');
  };

  const out = (members || []).map((m) => {
    const next = { ...m };
    if (isLegacyGeneratedCode(next.cmuNumber)) {
      mapping[next.cmuNumber] = nextCode();
      next.cmuNumber = mapping[next.cmuNumber];
      next.adherentCode = next.cmuNumber;
      migrated++;
    }
    if (Array.isArray(next.dependents) && next.dependents.length > 0) {
      next.dependents = next.dependents.map((d) => {
        const nd = { ...d };
        if (isLegacyGeneratedCode(nd.cmuNumber)) {
          mapping[nd.cmuNumber] = nextCode();
          nd.cmuNumber = mapping[nd.cmuNumber];
          migrated++;
        }
        return nd;
      });
    }
    return next;
  });

  return { members: out, migrated, mapping };
};

/**
 * Attribue un matricule structuré INÉDIT pour une MSD donnée.
 *
 * Le matricule n'est JAMAIS repris d'un fichier importé : la colonne
 * CODE_BENEFICIAIRE de « MSD de Grand Yoff » porte des suffixes « .0 », « .1 »
 * qui décrivent la structure du ménage, pas l'identité permanente de la
 * personne. Réutiliser ces codes fait collisionner la numérotation d'un
 * fichier avec celle d'un autre.
 *
 * La séquence repart du dernier matricule RÉELLEMENT attribué pour le triplet
 * (région, MSD, année) : un code ne peut donc jamais être resservi.
 *
 * @param {Set<string>|Array<string>} existingCodes — codes déjà pris
 * @param {string} unionId — MSD émettrice (DKR, PKN, GDW, RFS…)
 * @param {number|string} [year] — année d'adhésion (défaut : campagne en cours)
 * @param {number} [minSeq=0] — plancher de séquence : on ne repart jamais
 *        en dessous, ce qui permet de poursuivre une numérotation engagée
 * @returns {string} ex. « DKR-DKR-2026-0272 »
 */
export const generateUniqueCmuCode = (existingCodes, unionId = 'DKR', year = currentCampaignYear(), minSeq = 0) => {
  const taken = new Set(
    (existingCodes instanceof Set ? Array.from(existingCodes) : (existingCodes || []))
      .map((c) => String(c || '').trim().toUpperCase())
  );
  const region = regionCodeFor(unionId);
  const union = String(resolveUnion(unionId).id || unionId || 'DKR').toUpperCase().slice(0, 3);

  let seq = lastSequenceFor(taken, { region, unionId: union, year, minSeq });
  // Boucle bornée + repli temporel : jamais de doublon, même si le registre
  // contient des matricules incohérents.
  for (let i = 1; i <= 20000; i++) {
    const candidate = buildStructuredCode({ region, unionId: union, year, seq: seq + i });
    if (!taken.has(candidate) && !taken.has(candidate.replace(/-/g, '_'))) return candidate;
  }
  return `${buildStructuredCode({ region, unionId: union, year, seq: seq + 1 })}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
};

/**
 * Récupère les bénéficiaires enregistrés côté serveur (PostgreSQL) et les
 * convertit au format du Studio.
 *
 * Rôle : le localStorage est VOLATIL — vider le cache du navigateur ou
 * changer de poste fait disparaître les fiches importées. La base doit être
 * la source de vérité, le store local n'étant plus qu'un cache.
 *
 * Ne lève jamais d'exception : si l'API est injoignable, renvoie [] et
 * l'appelant conserve le registre local intact.
 *
 * @returns {Promise<Array>} membres au format du Studio
 */
export const fetchServerBeneficiaries = async () => {
  try {
    const { apiFetch } = await import('./api');
    // ⚠️ Pagination obligatoire : le serveur plafonne `limit` à 200
    // (backend/pagination.js). Demander « limit=5000 » ne renvoyait que
    // 200 lignes : après un rechargement, les 1 250 autres assurés
    // devenaient invisibles. C'est une deuxième cause — indépendante de la
    // première — de « mes cartes ont disparu ».
    const PAGE = 200;
    const MAX_PAGES = 100;          // garde-fou : 20 000 bénéficiaires
    const rows = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await apiFetch(`/api/beneficiaries?limit=${PAGE}&page=${page}`);
      if (!res || !res.ok) break;            // API fermée : on garde ce qu'on a
      const payload = await res.json();
      const batch = Array.isArray(payload) ? payload : (payload.data || []);
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < PAGE) break;        // dernière page atteinte
    }
    if (rows.length === 0) return [];
    return rows.map((b) => {
      const cmu = b.cmu_number || b.cmuNumber || '';
      const photo = b.photo_url || b.photoUrl || '';
      return {
        id: b.id ? `SRV-${b.id}` : `SRV-${cmu}`,
        cmuNumber: cmu,
        adherentCode: cmu.replace(/\.\d+$/, ''),
        rawCode: cmu,
        firstName: (b.first_name || b.firstName || '').toString().toUpperCase(),
        lastName: (b.last_name || b.lastName || '').toString().toUpperCase(),
        birthDate: b.birth_date || b.birthDate || '',
        birthPlace: b.birth_place || b.birthPlace || '',
        // NIN : clé d'identité stable. Elle doit survivre à l'aller-retour
        // avec la base, sinon la déduplication d'un réimport ne trouve plus
        // jamais la personne déjà enregistrée.
        nin: b.nin || '',
        sourceCode: b.source_code || b.sourceCode || '',
        // Lot de campagne : sans lui, une fiche restaurée depuis la base
        // apparaîtrait « hors lot » alors qu'elle appartient à un import.
        lotCode: b.lot_code || b.lotCode || '',
        gender: String(b.gender || b.sexe || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
        bloodGroup: b.blood_group || b.bloodGroup || 'O+',
        address: b.address || '',
        commune: b.commune || 'Dakar',
        departmentUnionId: 'DKR',
        mutuelleOrigine: b.mutuelle_name || b.mutuelleName || 'Mutuelle de santé départementale de Dakar',
        phone: b.phone || '',
        package: b.package_type || b.packageType || 'UNAMUSC 80%',
        cardTypeLabel: b.card_type || b.cardTypeLabel || 'Classique',
        photoUrl: photo,
        hasOfficialPhoto: !!photo,
        photoStatus: photo ? 'OFFICIAL' : 'PENDING_UPLOAD',
        verificationStatus: 'SERVER',
        allergies: b.allergies || 'Aucune connue',
        antecedents: b.antecedents || '',
        status: b.status || 'active',
        dependents: []
      };
    }).filter((m) => m.cmuNumber);
  } catch {
    return [];
  }
};

/**
 * Normalise une chaîne pour l'appariement de noms :
 * « Achille » → "achille", sans accents, sans espaces parasites.
 */
export const normalizeName = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Normalise un téléphone : "(021) 123-456" → "021123456" */
export const normalizePhone = (value) =>
  (value || '').toString().replace(/[^0-9]/g, '');

/**
 * Code bénéficiaire tel qu'il figure dans le classeur.
 *
 * ⚠️ Le code est désormais conservé À L'IDENTIQUE, suffixe « .0 » compris.
 *
 * Il portait auparavant un retrait du « .0 » (DKR_260001.0 → DKR_260001).
 * Raison alors invoquée : le « .0 » est un suffixe de rôle, et le retirer
 * garantissait une seule fiche par ménage. C'est vrai, mais ce n'est pas le
 * code IMPRIMÉ sur le PVC : l'agent lisait « DKR_260001 » sur sa fiche et
 * « DKR_260001.0 » sur la carte du patient, sans raison apparente.
 *
 * Or le classeur est la source de vérité et la fiche doit porter exactement
 * ce qui est gravé, au caractère près. Une fiche et sa carte ne peuvent pas
 * diverger.
 *
 * Le regroupement en ménage n'est pas affecté : il repose sur la BASE du code
 * (`baseFromCode`), où le suffixe est retiré de toute façon.
 */
export const canonicalCode = (code) => {
  if (code === null || code === undefined) return '';
  return code.toString().trim();
};

/**
 * Convertit une date de naissance en AAAA-MM-JJ.
 * Gère : objet Date (cellDates), « 1972-01-03 », « 03/01/1972 » et la
 * SÉRIE EXCEL (« 26604 » = jours écoulés depuis le 30/12/1899), cas réel
 * du fichier « Ville de Dakar msd Dakar.xlsx ».
 * @param {Date|string|number} value
 * @returns {string} date ISO ou chaîne d'origine si non interprétable
 */
export const toIsoDate = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = value.toString().trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, d, m, y] = fr;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Série Excel : uniquement une plage de dates plausible (1900 → 2119)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const days = Math.floor(Number(s));
    if (days > 1 && days < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return s;
};

/**
 * Recherche d'une colonne, en deux passes.
 *
 * PASSE 1 — correspondance EXACTE (titre normalisé identique) :
 *   C'est elle qui tranche le piège majeur de ce type de fichier.
 *   « PRENOM_BENEFICIAIRE » CONTIENT la sous-chaîne « NOM_BENEFICIAIRE »
 *   (à partir de la 4ᵉ lettre : P-R-E-« NOM_BENEFICIAIRE »). Une simple
 *   recherche par sous-chaîne devolvait donc le PRÉNOM pour la colonne du
 *   NOM : la carte affichait « Nom : PAPA IBRAHIMA » au lieu de « SEYE ».
 *   En cherchant d'abord l'égalité, « NOM_BENEFICIAIRE » est trouvé — et
 *   « PRENOM_BENEFICIAIRE » ne peut plus l'être.
 *
 * PASSE 2 — correspondance partielle (en-têtes libres du type
 *   « N° CARTE CSU », « CODE BENEFICIAIRE »…).
 */
export const pickColumn = (row, patterns) => {
  if (!row) return '';
  const keys = Object.keys(row);
  const normKeys = keys.map((k) => normalizeName(k));
  const normPatterns = patterns.map((p) => normalizeName(p));

  // Passe 1 : correspondance exacte
  for (let i = 0; i < normPatterns.length; i++) {
    const idx = normKeys.indexOf(normPatterns[i]);
    if (idx !== -1) return row[keys[idx]];
  }
  // Passe 2 : correspondance partielle, motif le plus long d'abord
  for (let i = 0; i < normPatterns.length; i++) {
    for (let j = 0; j < normKeys.length; j++) {
      if (normKeys[j] && normKeys[j].includes(normPatterns[i])) return row[keys[j]];
    }
  }
  return '';
};

/**
 * Recherche par titre EXACT (après normalisation).
 *
 * Indispensable ici : la recherche par sous-chaîne confond
 * « PRENOM_BENEFICIAIRE » et « NOM_BENEFICIAIRE » avec « nom » / « prénom »,
 * car « nom » est une sous-chaîne de « PRENOM ». Avec une correspondance
 * exacte, une colonne intitulée « PRENOM_BENEFICIAIRE » ne peut plus être
 * prise pour la colonne du nom de famille.
 */
export const pickColumnExact = (row, names) => {
  if (!row) return '';
  const keys = Object.keys(row);
  for (const n of names) {
    const target = normalizeName(n);
    for (const k of keys) {
      if (normalizeName(k) === target) return row[k];
    }
  }
  return '';
};

/**
 * Transforme les lignes brutes d'un classeur (résultat de sheet_to_json) en
 * bénéficiaires normalisés. Fonction PURE → testable sans navigateur, et
 * utilisée à la fois par parseExcelFile() et par le Studio des cartes afin
 * qu'une seule règle de lecture existe.
 * @param {Array<object>} rawRows
 * @returns {Array<object>} bénéficiaires normalisés
 */
export const parseRowsToRecords = (rawRows) =>
  (rawRows || []).map((row) => {
    // ── Détection des colonnes ─────────────────────────────────────────
    //
    //  BUG CORRIGÉ : le motif générique « nom » matche « PRE·NOM ·
    //  BÉNÉFICIAIRE » (la sous-chaîne « nom » y est présente), et il
    //  matchait aussi « NOM_ORGANISATION ». Résultat sur le fichier
    //  ASS LONASE : la colonne Nom était vide, celle du prénom était
    //  relue comme nom → la carte affichait « Nom : ELHADJI ».
    //
    //  On cherche donc d'abord les colonnes SPÉCIFIQUES du modèle
    //  « ASS LONASE » (PRENOM_BENEFICIAIRE / NOM_BENEFICIAIRE), puis
    //  les variantes génériques, et enfin — en dernier recours — une
    //  colonne dont le titre est EXACTEMENT « nom » / « prénom » (ce qui
    //  exclut « PRENOM_BENEFICIAIRE » et « NOM_ORGANISATION »).
    let prenom = (pickColumn(row, ['prenombeneficiaire', 'prenomassure', 'prenoms', 'prenom', 'firstname', 'first']) || '').toString().trim();
    let nom = (pickColumn(row, ['nombeneficiaire', 'nomassure', 'nomdefamille', 'nomfamille', 'nomde', 'lastname', 'last']) || '').toString().trim();

    // Colonne « NOM » / « PRENOM » exactement (et non un préfixe)
    if (!nom) {
      const exact = pickColumnExact(row, ['nomde', 'nomfamille', 'lastname']);
      if (exact) nom = String(exact).trim();
    }
    if (!prenom) {
      const exact = pickColumnExact(row, ['prenoms', 'firstname']);
      if (exact) prenom = String(exact).trim();
    }
    // Nom complet dans une seule colonne → découpage.
    //
    // Deux conventions coexistent et il faut les distinguer :
    //  • titre EXACT « NOM » (ou « NOM FAMILLE ») : format « NOM Prénom »
    //    → « FALL Mamadou »  ⇒ nom FALL, prénom Mamadou.
    //  • colonne « nom complet » / « NOMS ET PRENOM » : format « Prénom(s) NOM »
    //    → « ELHADJI MALICK FALL » ⇒ prénoms ELHADJI MALICK, nom FALL
    //      (convention sénégalaise : le patronyme est le DERNIER mot).
    //
    // L'ancien code faisait « nom = parts[0] » partout : correct pour
    // « NOM Prénom », mais faux pour « Prénom NOM ». Sur le fichier
    // ASS LONASE (colonnes dédiées NOM_BENEFICIAIRE / PRENOM_BENEFICIAIRE)
    // le découpage n'intervient pas : les deux colonnes sont lues directement.
    if (!prenom || !nom) {
      const nomColonne = pickColumnExact(row, ['nom', 'nomdefamille', 'nomfamille', 'lastname']);
      let complet;
      let nomDAbord = false;
      if (nomColonne) {
        // Colonne « NOM » : le premier mot est le patronyme
        complet = String(nomColonne).trim();
        nomDAbord = true;
      } else {
        complet = (pickColumn(row, ['nomcomplet', 'nomsetsprenom', 'identite', 'fullname']) || '').toString().trim();
      }
      if (complet) {
        const parts = complet.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
          if (nomDAbord) {
            // Colonne « NOM » contenant « NOM Prénom(s) » :
            // « FALL Mamadou » ⇒ nom FALL, prénoms Mamadou.
            // On découpe explicitement (la colonne n'a pas été pré-remplie
            // ci-dessus : elle ne contient pas le seul patronyme).
            nom = parts[0];
            prenom = prenom || parts.slice(1).join(' ');
          } else {
            // Colonne « nom complet » au format « Prénom(s) NOM » :
            // le patronyme est le DERNIER mot (convention sénégalaise).
            const last = parts[parts.length - 1];
            const rest = parts.slice(0, -1).join(' ');
            nom = nom || last;
            prenom = prenom || rest;
          }
        } else {
          nom = nom || parts[0];
          prenom = prenom || parts[0];
        }
      }
    }

    // ── Robustesse sur le modèle ASS LONASE ───────────────────────────
    //  Colonnes réelles observées :
    //    NUMERO ORDRE | NUMERO_ADHERENT | CODE_BENEFICIAIRE |
    //    PRENOM_BENEFICIAIRE | NOM_BENEFICIAIRE | DATE_NAISSANCE |
    //    LIEU_NAISSANCE | NIN | SEXE | ADRESSE | CONTACT |
    //    PRENOM_ADHERENT | NOM_ADHERENT | NOM_ORGANISATION |
    //    COTISATION_ANNUELLE | GROUPE_SANGUIN | MUTUELLE_D'ORIGINE
    //
    //  Piège n°1 : le motif générique « numero » matchait « NUMERO ORDRE »
    //    (l'ordre 1, 2, 3…) au lieu de « NUMERO_ADHERENT » (DKR_010125).
    //  Piège n°2 : le téléphone est dans une colonne intitulée « CONTACT ».
    //  Piège n°3 : le code bénéficiaire est prioritaire sur le numéro
    //    d'adhérent pour retrouver la photo (c'est lui qui figure au nom
    //    du fichier image).
    // 'code' est placé EN DERNIER : il ne peut pas entrer en collision avec
    // « PRENOM_BENEFICIAIRE », « NUMERO ORDRE » ni « NUMERO_ADHERENT »,
    // et reste nécessaire pour les classeurs qui ont une simple colonne CODE.
    const codeBenef = (pickColumn(row, ['codebeneficiaire', 'codebenef', 'cmu']) || '').toString().trim()
      || (pickColumnExact(row, ['code', 'cmu', 'codecarte', 'carte']) || '').toString().trim();
    const numeroAdh = (pickColumn(row, ['numeroadherent', 'numerodossier', 'adherentcode']) || '').toString().trim();

    const sexeRaw = (pickColumn(row, ['sexe', 'gender']) || '').toString().trim().toUpperCase();

    return {
      // Code présent dans le FICHIER. Il ne sert plus de matricule : il ne
      // sert qu'à regrouper le ménage (.0 = chef, .1+ = ayants droit) et à
      // retrouver la photo. Le matricule définitif est attribué par
      // generateUniqueCmuCode() (voir buildStudioMembers).
      codeBeneficiaire: canonicalCode(codeBenef),
      numeroAdherent: canonicalCode(numeroAdh),
      prenom,
      nom,
      birthDate: toIsoDate(pickColumn(row, ['datenaissance', 'birthdate', 'birth'])),
      birthPlace: (pickColumn(row, ['lieunaissance', 'lieudenassance', 'birthplace']) || '').toString().trim(),
      nin: (pickColumn(row, ['nin']) || '').toString().trim(),
      sexe: sexeRaw.startsWith('F') ? 'F' : sexeRaw.startsWith('M') ? 'M' : '',
      telephone: (pickColumn(row, ['contact', 'telephone', 'tel', 'phone', 'portable', 'numerotelephone']) || '').toString().trim(),
      address: (pickColumn(row, ['adresse', 'address', 'quartier']) || '').toString().trim(),
      bloodGroup: (pickColumn(row, ['groupesanguin', 'groupsanguin', 'bloodgroup']) || '').toString().trim(),
      schoolName: (pickColumn(row, ['ecole', 'school', 'daara', 'etablissement']) || '').toString().trim(),
      sponsorPhone: (pickColumn(row, ['sponsor', 'parrain']) || '').toString().trim(),
      mutuelleName: (pickColumn(row, ['mutuelle']) || '').toString().trim() || 'MSD Dakar',
      packageType: (pickColumn(row, ['forfait', 'package']) || '').toString().trim() || 'individuel',
      // Colonne « PHOTO » du classeur MSD Dakar : nom de fichier attendu
      photoHint: (pickColumn(row, ['photo', 'image']) || '').toString().trim(),
      status: 'active'
    };
  });

/**
 * ============================================================
 *  LOTS DE CAMPAGNE D'ENROLEMENT
 * ============================================================
 *
 *  Chaque carte appartient à un LOT : l'import (campagne d'enrôlement)
 *  qui l'a créée. Format : LOT-<ANNÉE>-<N°>  (ex. LOT-2026-001)
 *
 *  Pourquoi c'est indispensable :
 *  un simple numéro de séquence ne dit RIEN sur la provenance d'une carte.
 *  Or une carte importée aujourd'hui et une carte de la même personne
 *  imprimée il y a deux ans portent le même code `DKR_2600111`. Sans lot,
 *  rien ne distingue une carte qu'on peut encore réimprimer d'un PVC déjà
 *  en circulation. Le lot rend l'information explicite :
 *
 *    « cette carte vient du lot LOT-2026-003 (MSD de Grand Yoff) »
 *    « elle n'a jamais été imprimée » → recodable
 *    « elle appartient au lot LOT-2025-001 » → intouchable
 */

const LOT_STORE_KEY = 'unamusc_campaign_lots_v1';
const LOT_SEQ_KEY = 'unamusc_campaign_lot_seq_v1';

/** Lit le registre des lots sans jamais le casser. */
const readLots = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(LOT_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLots = (lots) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(LOT_STORE_KEY, JSON.stringify(lots));
  } catch { /* la session courante conserve l'état en mémoire */ }
};

/** Année de campagne courante. */
const campaignYear = () => new Date().getFullYear();

/** Tous les lots connus, du plus récent au plus ancien. */
export const getCampaignLots = () =>
  readLots().slice().sort((a, b) => String(b.code).localeCompare(String(a.code)));

/**
 * Crée un lot d'enrôlement, en base ET en cache local.
 *
 * La base fait foi : sans elle, l'historique des campagnes resterait propre à
 * un poste et disparaîtrait au changement d'agent. Le localStorage ne sert
 * que de cache, exactement comme pour le registre des bénéficiaires.
 *
 * Si l'API est injoignable, le lot est tout de même créé localement : la
 * campagne ne doit pas être bloquée par une coupure réseau, et la
 * synchronisation pourra se faire au reconnectement.
 *
 * @param {{label?:string, sourceFile?:string, unionId?:string, count?:number}} meta
 * @returns {Promise<object>} fiche du lot
 */
export const createCampaignLot = async (meta = {}) => {
  const year = campaignYear();
  let seq = 0;
  try {
    seq = parseInt(window.localStorage.getItem(LOT_SEQ_KEY) || '0', 10) || 0;
  } catch { seq = 0; }
  seq += 1;
  try {
    window.localStorage.setItem(LOT_SEQ_KEY, String(seq));
  } catch { /* sans stockage : la numérotation repartira à 1 */ }

  const lot = {
    code: `LOT-${year}-${String(seq).padStart(3, '0')}`,
    label: meta.label || `Campagne d'enrôlement ${year} n° ${seq}`,
    sourceFile: meta.sourceFile || '',
    unionId: meta.unionId || 'DKR',
    // Stratégie de codage appliquée : c'est elle qui dit si les codes de ce
    // lot viennent du classeur (lot imprimé) ou du système (lot à venir).
    codeStrategy: meta.codeStrategy || 'FILE',
    count: Number(meta.count) || 0,
    printed: meta.printed !== false ? Boolean(meta.printed) : false,
    createdAt: new Date().toISOString()
  };
  const lots = readLots();
  lots.push(lot);
  writeLots(lots);

  // Persistance en base (non bloquante : le lot local reste valable).
  try {
    const { apiFetch } = await import('./api');
    const res = await apiFetch('/api/campaign-lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: lot.code,
        label: lot.label,
        sourceFile: lot.sourceFile,
        unionId: lot.unionId,
        cardCount: lot.count
      })
    });
    if (res && res.ok) {
      const saved = await res.json().catch(() => null);
      if (saved) {
        const idx = readLots().findIndex((l) => l.code === lot.code);
        if (idx !== -1) {
          const nextLots = readLots();
          nextLots[idx] = { ...nextLots[idx], serverId: saved.id, persisted: true };
          writeLots(nextLots);
        }
      }
    }
  } catch {
    /* API injoignable : le lot reste local, la campagne n'est pas bloquée. */
  }

  return lot;
};

/**
 * Rattache des fiches à un lot, en base.
 * @param {string} lotCode
 * @param {Array<string>} cmuNumbers
 * @returns {Promise<boolean>} true si la base a bien enregistré
 */
export const assignCardsToLotOnServer = async (lotCode, cmuNumbers) => {
  if (!lotCode || !Array.isArray(cmuNumbers) || cmuNumbers.length === 0) return false;
  try {
    const { apiFetch } = await import('./api');
    const res = await apiFetch(`/api/campaign-lots/${lotCode}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmuNumbers })
    });
    return !!res && res.ok;
  } catch {
    return false;
  }
};

/** Marque un lot comme imprimé : verrou de sécurité anti-recodage. */
export const markLotPrintedOnServer = async (lotCode) => {
  if (!lotCode) return false;
  try {
    const { apiFetch } = await import('./api');
    const res = await apiFetch(`/api/campaign-lots/${lotCode}/print`, { method: 'POST' });
    if (res && res.ok) updateCampaignLot(lotCode, { printed: true });
    return !!res && res.ok;
  } catch {
    return false;
  }
};

/** Met à jour un lot (compteur, marquage imprimé…). */
export const updateCampaignLot = (code, patch) => {
  const lots = readLots();
  const idx = lots.findIndex((l) => l.code === code);
  if (idx === -1) return null;
  lots[idx] = { ...lots[idx], ...patch };
  writeLots(lots);
  return lots[idx];
};

/** Fiche d'un lot par son code. */
export const getCampaignLot = (code) => readLots().find((l) => l.code === code) || null;

/**
 * Libellé lisible d'un code de lot, à partir du registre.
 * @param {string} code
 * @returns {string} « LOT-2026-001 · Grand Yoff » ou le code brut
 */
export const describeLot = (code) => {
  if (!code) return '';
  const lot = getCampaignLot(code);
  if (!lot) return code;
  const extra = lot.sourceFile ? ` · ${lot.sourceFile}` : (lot.label || '');
  return `${lot.code}${extra ? ` · ${extra}` : ''}`;
};

/** Les fiches appartiennent-elles à ce lot ? (titre ou ayants droit) */
export const memberBelongsToLot = (member, code) => {
  if (!member || !code) return false;
  if (member.lotCode === code) return true;
  return (member.dependents || []).some((d) => d.lotCode === code);
};

/**
 * Identité stable d'un assuré, indépendante du matricule.
 *
 * Le matricule étant désormais ATTRIBUÉ PAR LE SYSTÈME, il ne peut plus
 * servir à reconnaître un assuré déjà présent : réimporter le même classeur
 * produirait de nouveaux codes pour les mêmes personnes (doublons). Cette
 * clé, elle, ne change pas d'un import à l'autre.
 *
 * @param {{firstName?:string,lastName?:string,birthDate?:string,nin?:string}} m
 * @returns {string} clé de comparaison ('' si la fiche est inexploitable)
 */
export const beneficiaryIdentity = (m) => {
  if (!m) return '';
  const last = normalizeName(m.lastName || m.nom);
  const first = normalizeName(m.firstName || m.prenom);
  if (!last && !first) return '';
  // Le NIN est le plus sûr quand il existe (numéro national d'identification).
  const nin = normalizeName(m.nin);
  if (nin) return `n${nin}`;
  return `${first}|${last}|${String(m.birthDate || '').slice(0, 10)}`;
};

/** Ensemble des identités déjà présentes dans un registre. */
export const collectIdentities = (members) => {
  const set = new Set();
  for (const m of members || []) {
    const key = beneficiaryIdentity(m);
    if (key) set.add(key);
  }
  return set;
};

/**
 * Ne conserve que les lignes exploitables.
 *
 * Un NOM (ou prénom) suffit désormais : le matricule n'est plus lu dans le
 * fichier mais attribué par le système. Avant, une ligne sans code était
 * écartée, ce qui faisait perdre des assurés dont le classeur laissait la
 * colonne CODE_BENEFICIAIRE vide — cas réel sur les fichiers MSD.
 *
 * @param {Array} records
 * @returns {Array} lignes ayant au moins un nom ou prénom
 */
export const filterValidRecords = (records) =>
  (records || []).filter((r) => (r.prenom || r.nom));

/**
 * Lit un fichier Excel et extrait les bénéficiaires.
 * Colonnes reconnues (en-têtes souples, avec ou sans accents) :
 *  - code bénéficiaire / code / cmu / n° adherent
 *  - prénom / nom / nom complet
 *  - date de naissance (Date, JJ/MM/AAAA, ISO ou série Excel) / sexe /
 *    téléphone / adresse
 *  - école / sponsor / parrain / mutuelle / forfait / colonne PHOTO
 * @param {File} file — fichier .xlsx/.xls/.csv
 * @returns {Promise<{rows: Array, columns: string[], fileName: string}>}
 */
export const parseExcelFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (raw.length === 0) return { rows: [], columns: [], fileName: file.name };

  const columns = Object.keys(raw[0]);

  // Lecture normalisée — règles UNIQUES partagées avec le Studio des cartes
  // (codes canoniques « DKR_2600011.0 » → « DKR_2600011 », dates sérielles
  // Excel → ISO), pour qu'un import n'aboutisse jamais à des doublons.
  const rows = parseRowsToRecords(raw);


  return { rows, columns, fileName: file.name };
};

/**
 * Apparie les photos d'un dossier aux bénéficiaires importés :
 * correspondance par prénom normalisé, puis par téléphone, puis code.
 * @param {Array} rows — bénéficiaires extraits de l'Excel
 * @param {FileList} photoFiles — fichiers image du dossier de photos
 * @returns {Array} rows enrichis de photoUrl
 */
export const matchPhotosToRows = (rows, photoFiles) => {
  const photos = Array.from(photoFiles || []).filter((f) => f.type.startsWith('image/'));
  if (photos.length === 0) return rows;

  // Index des photos. Le nom de fichier du dossier ASS LONASE est
  // « DKR_2600040.1 PAPA IBRAHIMA SEYE.jpg » : il COMMANDE par le code
  // bénéficiaire. On extrait donc ce code séparément — comparer le nom
  // de personne au nom de fichier entier ne pouvait jamais aboutir
  // (« DKR26000401PAPAIBRAHIMASEYE » ≠ « PAPAIBRAHIMASEYE »), d'où
  // « photos appariées : 0 ».
  const photoIndex = photos.map((f) => {
    const base = f.name.replace(/\.[^.]+$/, '');
    // Préfixe de RANG en tête de nom : « 1.0 Adjaratou Ndeye DEME ».
    // C'est le format du dossier « Photos ville de Dakar » : le nombre désigne
    // le lot et le rang dans le ménage (1.0 = chef, 1.1 = premier ayants
    // droit…). Sans son retrait, la clé calculée devenait « 10adjaratou… » et
    // n'appariait avec aucune fiche : 0 photo trouvée sur 167.
    const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
    // Code en tête de nom : DKR_2600040.1, KLK_2600149.1, ZIG_2600155.1…
    const codeMatch = base.match(/^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/);
    // Deux formes sont indexées car le code dépend du modèle de fichier :
    //  • avec suffixe   : DKR_2600040.1 (ASS LONASE)
    //  • sans suffixe .0: DKR_2600011    (fichier MSD, chef de ménage)
    const codeComplet = codeMatch ? normalizeName(codeMatch[0]) : '';
    const codeBase = codeMatch ? normalizeName(codeMatch[1] + codeMatch[2]) : '';
    return {
      file: f,
      nameNorm: normalizeName(sansRang),
      codeNorm: codeComplet,
      codeBaseNorm: codeBase,
      // Nom de personne seul (le code et le rang en tête sont retirés)
      personNorm: normalizeName(
        codeMatch ? base.slice(codeMatch[0].length) : sansRang
      ),
      phoneNorm: normalizePhone(base)
    };
  });

  const used = new Set();
  return rows.map((r) => {
    if (r.photoUrl) return r;
    // Le prénom est nettoyé de son nom répété AVANT l'appariement : sinon
    // « MOUSTAPHA NDIONE » chercherait la photo « 1.0 Moustapha Ndione »
    // et ne la trouverait jamais.
    const noms = splitFullName(r.prenom, r.nom);
    const nameNorm = normalizeName(`${noms.firstName}${noms.lastName}`);
    const firstNorm = normalizeName(noms.firstName);
    const lastNorm = normalizeName(noms.lastName);
    const phoneNorm = normalizePhone(r.telephone || '');
    const codeNorm = normalizeName(canonicalCode(r.codeBeneficiaire || ''));
    const hintNorm = normalizeName((r.photoHint || '').toString().replace(/\.[^.]+$/, ''));

    // Ordre de confiance : 0) code bénéficiaire (le plus fiable : c'est
    // l'identifiant imprimé sur la carte et dans le nom du fichier photo),
    // 1) colonne « PHOTO » du classeur, 2) nom complet, 3) prénom seul,
    // 4) téléphone.
    const match =
      (codeNorm && photoIndex.find((p) => !used.has(p.file.name) && p.codeNorm && p.codeNorm === codeNorm)) ||
      (hintNorm && photoIndex.find((p) => !used.has(p.file.name) && p.nameNorm === hintNorm)) ||
      photoIndex.find((p) => !used.has(p.file.name) && p.personNorm && p.personNorm === nameNorm) ||
      // Fichiers photo sans code : « Abdou Karim Diouf né le 28-08-97… »
      // → le nom de la fiche en est le PRÉFIXE. On exige le nom COMPLET
      // (prénom + nom) pour éviter les faux positifs entre homonymes
      // (« Abdoulaye Diallo » ne doit pas matcher « Abdoulaye Diop »).
      (nameNorm.length >= 6 && photoIndex.find((p) => !used.has(p.file.name) && p.personNorm && p.personNorm.startsWith(nameNorm))) ||
      // Nom composé : le fichier photo porte souvent un second prénom que le
      // classeur ignore (« Adjaratou Ndeye DEME.jpeg » pour ADJARATOU/DEME).
      // On exige alors que le nom commence par le prénom ET finisse par le nom,
      // avec le nom complet de la fiche strictement plus court — sans quoi un
      // homonyme proche serait capté.
      (nameNorm.length >= 6 && lastNorm.length >= 2 && photoIndex.find((p) =>
        !used.has(p.file.name) && p.personNorm &&
        p.personNorm.startsWith(firstNorm) && p.personNorm.endsWith(lastNorm) &&
        p.personNorm.length > nameNorm.length
      )) ||
      (nameNorm.length >= 6 && photoIndex.find((p) => !used.has(p.file.name) && p.personNorm && nameNorm.startsWith(p.personNorm) && p.personNorm.length >= 6)) ||
      photoIndex.find((p) => !used.has(p.file.name) && p.personNorm && p.personNorm === firstNorm) ||
      photoIndex.find((p) => !used.has(p.file.name) && phoneNorm && p.phoneNorm === phoneNorm) ||
      // Repli sur la forme sans suffixe : le fichier MSD porte le code du
      // chef de ménage en « DKR_2600011.0 », canonisé en « DKR_2600011 »,
      // alors que la photo conserve le « .0 » dans son nom de fichier.
      (codeNorm && photoIndex.find((p) => !used.has(p.file.name) && p.codeBaseNorm && p.codeBaseNorm === codeNorm));

    if (match) {
      used.add(match.file.name);
      return { ...r, photoUrl: match.file.name };
    }
    return r;
  });
};

/**
 * Pousse les bénéficiaires vers le backend (POST /api/beneficiaries/bulk).
 * ZÉRO PERTE : si la base est indisponible, le backend bascule sur son fichier
 * secours (mode "fallback-file") et le flush sera rejoué automatiquement.
 * @param {Array} rows
 * @param {string} token — access token (optionnel)
 * @returns {Promise<{success: boolean, inserted: number, total: number, mode: string, message?: string}>}
 */
export const pushBeneficiariesToServer = async (rows, token) => {
  const res = await fetch('/api/beneficiaries/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ rows })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Import refusé (${res.status}).`);
  }
  return res.json();
};

/** Hydratation : récupère les bénéficiaires du fichier secours du backend. */
export const hydrateFromServerFallback = async (token) => {
  const res = await fetch('/api/beneficiaries/fallback', {
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  });
  if (!res.ok) return { success: false, records: [] };
  return res.json();
};

// ═══════════════════════════════════════════════════════════════════════
//  STUDIO DES CARTES — construction des fiches bénéficiaires
//  Source UNIQUE de vérité : CardStudio.jsx appelle ces fonctions et ne
//  duplique plus aucune règle de lecture. Toute correction ici s'applique
//  simultanément à l'import et au Studio.
// ═══════════════════════════════════════════════════════════════════════

/** Taille maximale (px) du côté le plus long d'une photo de carte. */
export const PHOTO_MAX_DIMENSION = 300;

/**
 * Convertit un fichier image en data-URL JPEG compressée, bornée à
 * PHOTO_MAX_DIMENSION px. Un dossier de 1 700 photos ne doit pas saturer le
 * localStorage : chaque photo pèse alors quelques kilo-octets.
 * @param {File} file
 * @param {{maxDimension?: number, quality?: number}} [opts] — allows
 *        d_appeler la compression en mode dégradé lorsque le quota
 *        localStorage devient critique.
 * @returns {Promise<string>} data-URL (chaîne vide si l'image est illisible)
 */
export const fileToCompressedDataUrl = (file, opts = {}) => {
  const maxDim = opts.maxDimension || PHOTO_MAX_DIMENSION;
  const quality = typeof opts.quality === 'number' ? opts.quality : 0.82;
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    const img = new Image();
    reader.onerror = () => resolve('');
    reader.onload = () => {
      img.onerror = () => resolve('');
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve('');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve('');
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Budget d'octets réservé aux photos d'un import, en base64 dans le
 * localStorage. Le plafond du navigateur est d'environ 5 Mo TOUT CONFONDU
 * (fiches + photos + designs de carte) : on s'arrête bien en dessous, sinon
 * `setItem` lève QuotaExceededError et l'import entier est perdu.
 */
export const PHOTO_BUDGET_BYTES = 2 * 1024 * 1024;

/**
 * Paliers de compression, du meilleur au plus économe. Un import trop lourd
 * dégrade les photos restantes plutôt que d'échouer en bloc.
 */
const PHOTO_QUALITY_STEPS = [
  { maxDimension: 300, quality: 0.82 },
  { maxDimension: 240, quality: 0.72 },
  { maxDimension: 180, quality: 0.62 },
  { maxDimension: 140, quality: 0.5 }
];


/**
 * Stratégie de codage d'un lot de campagne.
 *
 * C'est LA distinction centrale de l'organisation par lots : un lot déjà
 * imprimé conserve le code de son classeur, un lot à venir reçoit un
 * matricule officiel. Confondre les deux, c'est détacher une carte de son PVC.
 */
export const CODE_STRATEGY = {
  /** Code repris du fichier — réservé aux lots DÉJÀ IMPRIMÉS. */
  FILE: 'FILE',
  /** Matricule attribué par le système — lots à venir. */
  SYSTEM: 'SYSTEM'
};

/**
 * Stratégie par DÉFAUT : celle du fichier.
 *
 * ⚠️ Sûreté : quand un classeur porte un code, ce code est celui qui figure
 * sur la carte du campo. Le remplacer par un matricule calculé détache la
 * fiche de son PVC et casse le scan de toutes les cartes déjà en circulation.
 * Inversement, quand le fichier ne fournit rien, il n'y a rien à préserver et
 * un matricule officiel est le seul choix possible.
 *
 * Le mode SYSTEM est donc une DÉCISION EXPLICITE de l'agent, jamais un
 * hasard. (Il a été imposé par défaut par erreur lors d'un import ASS LONASE
 * : les 122 cartes ont reçu `DKR-DKR-2026-XXXX` au lieu de
 * `DKR_2600040.1` gravé sur le PVC.)
 */
export const DEFAULT_CODE_STRATEGY = CODE_STRATEGY.FILE;

/** Libellé lisible d'une stratégie, pour l'interface. */
export const describeCodeStrategy = (s) => (
  s === CODE_STRATEGY.FILE
    ? 'Conserver le code du fichier (lot déjà imprimé)'
    : 'Attribuer un matricule officiel (nouveau lot)'
);

/**
 * Construit les fiches bénéficiaires exploitables par le Studio des cartes.
 *
 * Règles métier appliquées :
 *  - les lignes sans nom ET sans prénom sont ignorées ;
 *  - le MATRICULE EST TOUJOURS ATTRIBUÉ PAR LE SYSTÈME
 *    (generateUniqueCmuCode) : les colonnes CODE_BENEFICIAIRE et
 *    NUMERO_ADHERENT du fichier ne servent PAS d'identité, uniquement à
 *    reconstituer la structure du ménage ;
 *  - CHAQUE PERSONNE reçoit son propre matricule unique — chef de ménage
 *    comme ayants droit. Deux assurés ne peuvent donc jamais partager le
 *    même code, y compris deux personnes du même foyer ;
 *  - les personnes partageant la même base de code dans le fichier
 *    (DKR_2600111.0 / .1 / .2…) sont regroupées : la première est le chef,
 *    les suivantes ses ayants droit ;
 *  - une personne sans code dans le fichier reste importable : elle est
 *    simplement sa propre fiche.
 *
 * @param {Array} records  — sortie de parseRowsToRecords()
 * @param {object} opts
 * @param {Map<string,string>} opts.photoUrls — code du FICHIER → data-URL
 * @param {Array|Set<string>} [opts.existingCodes] — matricules déjà pris
 * @param {string} [opts.unionId='DKR'] — préfixe MSD
 * @param {string} [opts.unionName]
 * @param {string} [opts.codeStrategy='FILE'] — voir CODE_STRATEGY
 * @param {number} [opts.seqFloor=0] — premier numéro de séquence en mode SYSTEM
 * @returns {Promise<Array>} fiches (une par dossier principal)
 */
/**
 * Retrait du nom de famille répété dans le prénom.
 *
 * Certains classeurs recopient le nom dans la colonne prénom :
 *   PRENOM_BENEFICIAIRE = « MOUSTAPHA NDIONE », NOM_BENEFICIAIRE = « NDIONE »
 * La carte affichait alors « Prénom(s) : MOUSTAPHA NDIONE » et « Nom : NDIONE ».
 * C'est une erreur de saisie à la source, mais elle se propage au PVC
 * imprimé : inutile de la laisser passer.
 *
 * On ne retire que le nom LORSQU'IL EST RÉELLEMENT RÉPÉTÉ, et seulement
 * s'il reste un prénom : « MOUSTAPHA NDIONE » → « MOUSTAPHA », tandis que
 * « MOUSTAPHA » reste « MOUSTAPHA ». Un prénom composé est conservé tel
 * quel (« FATOU BINTA » ne perd rien si son nom est « SOW »).
 */
const splitFullName = (prenom, nom) => {
  const p = String(prenom || '').trim().toUpperCase();
  const n = String(nom || '').trim().toUpperCase();

  if (!p) return { firstName: '', lastName: n };
  if (!n) return { firstName: p, lastName: '' };

  // Comparaison insensible aux accents, à la casse et à la ponctuation :
  // « NDIONE » et « N'DIONE » doivent être reconnus comme le même nom.
  const norm = (s) => s.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const np = norm(p);
  const nn = norm(n);

  if (nn && np !== nn && np.endsWith(nn)) {
    const cut = p.length - [...n].length; // retire le nom à sa longueur réelle
    const first = p.slice(0, cut).trim().replace(/[\s,'-]+$/, '');
    // Il doit RESTER un prénom : sinon on ne touche à rien.
    if (first.length >= 2) return { firstName: first, lastName: n };
  }
  return { firstName: p, lastName: n };
};

export const buildStudioMembers = async (records, opts = {}) => {
  const {
    photoUrls = new Map(),
    unionId = 'DKR',
    unionName = 'Mutuelle de santé départementale de Dakar',
    existingCodes = [],
    codeStrategy = DEFAULT_CODE_STRATEGY,
    seqFloor = 0
  } = opts;

  /**
   * Plancher de séquence pour le mode SYSTEM.
   *
   * On reprend le plus grand numéro de la série « 26XXXX » vue dans les codes
   * du FICHIER : la série officielle démarre ainsi à la suite de la série
   * terrain, au lieu de repartir de 0001 et de faire coexister deux
   * numérotations concurrentes.
   *
   * ⚠️ On ne lit QUE les codes normalisés à 7 chiffres (`DKR_2600271`), et
   * seulement leurs 4 derniers : c'est la seule forme qui porte le numéro
   * d'ordre de la campagne. Le fichier « MSD de Grand Yoff » contient aussi
   * des codes mal saisis à 8 chiffres (`DKR_26002150`) ; les prendre en
   * compte produisait un matricule à 8 digits — invalide — au lieu de 4.
   * Exemple : les codes vont jusqu'à `DKR_2600271`, donc la série officielle
   * commence à `DKR-DKR-2026-0272`.
   */
  const floorFromRecords = (() => {
    let max = 0;
    for (const r of records || []) {
      const m = String(r.codeBeneficiaire || '').match(/(\d{7})$/);
      if (!m) continue;
      const n = parseInt(m[1].slice(-4), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return max;
  })();

  // Matricules déjà pris : ceux du registre local + ceux générés pendant
  // CET import. generateUniqueCmuCode est relu à chaque appel et le code
  // produit est ajouté au Set : deux fiches du même fichier ne peuvent
  // donc pas recevoir le même matricule.
  const taken = existingCodes instanceof Set
    ? new Set(existingCodes)
    : new Set((existingCodes || []).map((c) => String(c || '').toUpperCase()));

  /**
   * Choisit le matricule d'une personne selon la stratégie du lot.
   *
   * - 'FILE'   : on REPREND le code du classeur (`DKR_2600040.1`). C'est le
   *   mode des lots DÉJÀ IMPRIMÉS : le code du fichier est celui gravé sur
   *   le PVC, y compris son suffixe. Le modifier casserait le scan.
   * - 'SYSTEM' : le système attribue un matricule officiel
   *   (`DKR-DKR-2026-0042`). C'est le mode des lots à venir.
   */
  const pickCode = (fileCode) => {
    if (codeStrategy === CODE_STRATEGY.FILE) {
      const fromFile = String(fileCode || '').trim();
      if (!fromFile) return nextCode();          // fichier sans code : on dépanse
      const upper = fromFile.toUpperCase();
      // Deux personnes distinctes ne peuvent pas partager un code : en cas
      // de doublon dans le fichier, on bascule sur un matricule officiel
      // plutôt que de fusionner deux assured au silence.
      if (taken.has(upper)) return nextCode();
      taken.add(upper);
      return fromFile;
    }
    return nextCode();
  };

  const nextCode = () => {
    const code = generateUniqueCmuCode(taken, unionId, undefined, seqFloor || floorFromRecords);
    taken.add(code.toUpperCase());
    return code;
  };

  const households = new Map();   // clé de ménage → fiches
  const standalone = [];

  for (const r of records || []) {
    if (!r.prenom && !r.nom) continue; // ligne vide
    const code = canonicalCode(r.codeBeneficiaire || '');
    const numero = canonicalCode(r.numeroAdherent || '');

    // ── Clé de regroupement en MÉNAGE ────────────────────────────────
    //
    //  Elle repose sur la BASE du code présente dans le fichier, pas sur
    //  NUMERO_ADHERENT. Sur le fichier « MSD de Grand Yoff »,
    //  NUMERO_ADHERENT ne prend que deux valeurs (« DKR_010126 » et
    //  vide) pour 1 451 personnes : tout était rattaché à un seul chef,
    //  d'où « 1 dossier importé (1451 personnes) ».
    //
    //  La numérotation .0 / .1 / .2… du code est la structure du ménage :
    //    DKR_2600111.0 → chef, .1 .2 .3 .4 → ses ayants droit.
    //
    //  ⚠️ Cette clé sert UNIQUEMENT à regrouper les membres d'un foyer.
    //  Elle ne devient JAMAIS le matricule de la personne : celui-ci est
    //  généré par le système (nextCode()), sinon deux fichiers MSD
    //  successifs produiraient les mêmes matricules.
    const baseFromCode = code ? code.replace(/\.\d+$/, '') : '';
    const householdKey = baseFromCode || numero;

    const age = r.birthDate
      ? new Date().getFullYear() - parseInt(String(r.birthDate).slice(0, 4), 10)
      : 30;
    const photoUrl = photoUrls.get(code) || photoUrls.get(numero) || ''
      || photoUrls.get(householdKey) || '';

    const member = {
      // Matricule provisoire : remplacé juste après, par un code unique.
      cmuNumber: '',
      // Code d'origine du fichier, conservé pour la traçabilité uniquement.
      sourceCode: r.codeBeneficiaire || '',
      adherentCode: householdKey || '',
      rawCode: r.codeBeneficiaire || '',
      firstName: splitFullName(r.prenom, r.nom).firstName,
      lastName: splitFullName(r.prenom, r.nom).lastName,
      birthDate: r.birthDate || '',
      // Lieu de naissance : lu dans la colonne LIEU_NAISSANCE du classeur
      // (DAKAR, SAINT LOUIS, LOME…). Il était écrasé par une chaîne vide,
      // d'où une carte affichant « 1948-04-25 » sans « à DAKAR ».
      birthPlace: (r.birthPlace || '').toString().trim().toUpperCase(),
      // NIN : pièce d'identité nationale, seule clé vraiment fiable pour
      // reconnaître un assuré d'un import à l'autre.
      nin: (r.nin || '').toString().trim(),
      gender: r.sexe || 'M',
      bloodGroup: (r.bloodGroup || '').toString().trim() || 'O+',
      address: r.address || 'Dakar',
      commune: 'Dakar',
      departmentUnionId: unionId,
      mutuelleOrigine: r.mutuelleName || unionName,
      phone: r.telephone || '',
      schoolName: r.schoolName || '',
      package: r.packageType || 'UNAMUSC 80%',
      cardTypeLabel: 'Import Excel',
      // Lot de campagne : identifie l'import qui a créé cette fiche. C'est
      // la seule information qui distingue une carte imprimée d'une carte
      // encore recodable.
      lotCode: opts.lotCode || '',
      photoUrl,
      hasOfficialPhoto: !!photoUrl,
      photoStatus: photoUrl ? 'OFFICIAL' : 'PENDING_UPLOAD',
      verificationStatus: 'IMPORT_EXCEL_MSD_DAKAR',
      allergies: 'Aucune connue',
      antecedents: 'À compléter',
      isMajor: age >= 18,
      dependents: []
    };

    if (householdKey) {
      if (!households.has(householdKey)) households.set(householdKey, []);
      households.get(householdKey).push(member);
    } else {
      standalone.push(member);
    }
  }

  // Un ménage = une fiche : le premier membre est le chef, les suivants
  // deviennent ses ayants droit. CHACUN reçoit son propre matricule.
  const stamp = Date.now().toString(36);
  const members = [];
  const pushMember = (m) => {
    members.push({ ...m, id: `IMP-${stamp}-${members.length}` });
  };

  for (const [, group] of households) {
    const [chef, ...deps] = group;
    // Un DOSSIER = un matricule de base, puis un RANG par personne :
    //   DKR-DKR-2026-0001.1  l'adhérent
    //   DKR-DKR-2026-0001.2  bénéficiaire pris en charge n°1
    //   DKR-DKR-2026-0001.3  bénéficiaire pris en charge n°2
    // La famille est ainsi lisible d'un seul coup d'œil sur les cartes.
    //
    // En mode FILE, en revanche, le code du classeur prime : il est gravé
    // sur un PVC déjà imprimé, et sa numérotation interne (`.0`, `.1`…) est
    // celle du terrain.
    const dossierBase = nextCode();
    const rankCode = (rank, fileCode) => {
      if (codeStrategy === CODE_STRATEGY.FILE) {
        const fromFile = String(fileCode || '').trim();
        return fromFile || withHouseholdRank(dossierBase, rank);
      }
      return withHouseholdRank(dossierBase, rank);
    };

    const chefCode = rankCode(1, chef.rawCode || chef.sourceCode);
    chef.cmuNumber = chefCode;
    chef.adherentCode = chefCode;
    chef.dependents = deps.map((d, i) => {
      const fileCode = d.rawCode || d.sourceCode;
      const depCode = rankCode(i + 2, fileCode);
      // Le rang dans le foyer doit être celui du CODE RÉEL de la personne.
      //
      // Auparavant il valait toujours « .(rang + 2) », calculé sur la position
      // dans la liste. Or, en mode FILE, le code vient du classeur : un ayant
      // droit peut porter « .1 » alors qu'il est le premier de la liste. Le
      // Studio recomposant parfois l'identifiant affiché à partir de « code du
      // parent + codeSuffix », il produisait alors « DKR_260001.0.2 » pour une
      // carte qui porte « DKR_260001.1 ».
      //
      // On lit donc le suffixe réel dans le code du fichier ; à défaut (pas de
      // code), on garde le rang calculé.
      const suffixeReel = String(depCode || '').match(/\.(\d+)$/);
      const codeSuffix = suffixeReel
        ? `.${suffixeReel[1]}`
        : `.${i + 2}`;
      // Champ `name` en PLUS de firstName/lastName : le jeu de données
      // historique (msdDakarMembers) ne stocke que `name`, et plusieurs vues
      // (VerifyCard, audit des scans, Studio) le lisaient directement. Sans
      // ce champ, sélectionner un ayant droit importé faisait planter le
      // rendu sur `name.split(...)`.
      const fullName = `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.name || '';
      return {
        ...d,
        name: fullName,
        cmuNumber: depCode,
        // L'ayant droit appartient au MÊME lot que son titulaire : c'est une
        // seule campagne d'enrôlement.
        lotCode: chef.lotCode || d.lotCode || '',
        // Rang dans le foyer. Il doit être EXACTEMENT celui du matricule :
        // le Studio recompose parfois l'identifiant affiché à partir de
        // « code du parent + codeSuffix ». Un suffixe décalé d'un cran
        // produisait « DKR-DKR-2026-2151.1.3 » au lieu de « …-2151.3 ».
        codeSuffix,
        householdCode: withHouseholdRank(chefCode, 1),
        isMajor: d.isMajor !== false,
        bloodGroup: d.bloodGroup || 'O+',
        allergies: d.allergies || 'Aucune connue',
        vaccines: d.vaccines || 'Vaccination à jour',
        antecedents: d.antecedents || 'À compléter'
      };
    });
    pushMember(chef);
  }

  standalone.forEach((m) => {
    m.cmuNumber = withHouseholdRank(nextCode(), 1);
    m.adherentCode = m.cmuNumber;
    pushMember(m);
  });

  return members;
};

/**
 * Détecte et traite les doublons d'un fichier d'import.
 *
 * Un NIN identique ne signifie PAS forcément la même personne : deux fautes de
 * frappe sur le numéro produisent le même texte sans qu'il s'agisse d'un
 * doublon. Sur le fichier « MSD de Grand Yoff », l'analyse a montré :
 *
 *  - 6 lignes portaient la LITTÉRALE « EXT NAISSANCE » dans la colonne NIN
 *    (valeur de gabarit, pas une pièce d'identité) ;
 *  - 3 personnes apparaissaient réellement en double.
 *
 * On ne fusionne donc que si le NIN est RÉELLEMENT un numéro d'identité
 * (13 chiffres) ET que la date de naissance concorde : le nom peut varier
 * d'une faute (`BINTA` / `BINETA`), la date, non.
 *
 * @param {Array} records — sortie de parseRowsToRecords()
 * @returns {{records: Array, merged: number, groups: Array}}
 *          `groups` décrit chaque fusion pour l'affichage à l'agent.
 */
export const dedupeRecordsByIdentity = (records) => {
  const list = (records || []).filter((r) => r.prenom || r.nom);
  if (list.length === 0) return { records: [], merged: 0, groups: [] };

  /** Un NIN exploitable = 13 chiffres (numéro national d'identification). */
  const ninValide = (v) => /^\d{13}$/.test(String(v || '').trim());

  const parNin = new Map();
  for (const r of list) {
    const nin = String(r.nin || '').trim();
    if (!ninValide(nin)) continue;
    if (!parNin.has(nin)) parNin.set(nin, []);
    parNin.get(nin).push(r);
  }

  const groupes = [];
  for (const [nin, lignes] of parNin) {
    if (lignes.length < 2) continue;
    // Même date de naissance = même personne (le nom peut avoir une faute).
    const parNaissance = new Map();
    for (const r of lignes) {
      const d = String(r.birthDate || '').slice(0, 10);
      if (!d) continue;
      if (!parNaissance.has(d)) parNaissance.set(d, []);
      parNaissance.get(d).push(r);
    }
    for (const [naissance, memes] of parNaissance) {
      if (memes.length < 2) continue;
      const [gardien, ...doublons] = memes;
      // Le gardien garde son code de fichier ; les autres perdent leur ligne.
      // En mode SYSTEM, le matricule est de toute façon réattribué.
      for (const d of doublons) {
        // On complète le gardien avec les informations que le doublon
        // était seul à porter (adresse, téléphone, photo).
        if (!gardien.phone && d.telephone) gardien.telephone = d.telephone;
        if (!gardien.address && d.address) gardien.address = d.address;
        if (!gardien.photoHint && d.photoHint) gardien.photoHint = d.photoHint;
        if (!gardien.birthPlace && d.birthPlace) gardien.birthPlace = d.birthPlace;
        d._fuseDans = gardien.codeBeneficiaire || '';
      }
      groupes.push({
        nin,
        naissance,
        nom: `${gardien.prenom} ${gardien.nom}`.trim(),
        code: gardien.codeBeneficiaire || '',
        fusions: doublons.map((d) => d.codeBeneficiaire || '').filter(Boolean)
      });
    }
  }

  if (groupes.length === 0) return { records: list, merged: 0, groups: [] };
  const fusions = new Set();
  // ⚠️ On n'ajoute QUE des codes non vides. Insérer `''` ferait ensuite
  // disparaître TOUTES les lignes du fichier dépourvues de code — c'est-à-dire
  // l'import entier.
  for (const g of groupes) {
    for (const c of g.fusions) {
      const code = String(c || '').trim();
      if (code) fusions.add(code);
    }
  }
  if (fusions.size === 0) return { records: list, merged: 0, groups: groupes };
  // On retire les lignes absorbées (repérées par leur code de fichier).
  const nettoyes = list.filter((r) => !fusions.has(r.codeBeneficiaire) && !r._fuseDans);
  for (const r of list) delete r._fuseDans;

  return { records: nettoyes, merged: fusions.size, groups: groupes };
};

/**
 * Répare le `codeSuffix` des ayants droit déjà enregistrés.
 *
 * ⚠️ Origine du défaut : lors de la création des fiches, le rang du matricule
 * (`.3`) et le `codeSuffix` (`.2`) étaient décalés d'un cran. Le Studio
 * recomposait ensuite l'identifiant affiché à partir du code du parent + ce
 * suffixe, d'où un double point : « DKR-DKR-2026-2151.1.3 ».
 *
 * La correction à l'import existe, mais elle ne rattrape pas les fiches déjà
 * en base : cette migration les reprend.
 *
 * Règle : le `codeSuffix` doit reproduire EXACTEMENT le rang porté par le
 * matricule propre de la personne. À défaut de matricule officiel (fiches
 * historiques), on retombe sur la position dans le foyer : `.2` pour le
 * premier bénéficiaire, puisque `.1` est réservé à l'adhérent.
 *
 * @param {Array} members — registre complet
 * @returns {{members: Array, repaired: number}} registre réparé et nombre de
 *          suffixes corrigés
 */
export const repairDependentCodeSuffix = (members) => {
  let repaired = 0;

  const nettoyes = (members || []).map((m) => {
    if (!m || !Array.isArray(m.dependents) || m.dependents.length === 0) return m;

    const base = (c) => String(c || '').replace(/\.\d+$/, '');
    // Base du dossier : celle du TITULAIRE, sans son propre rang.
    const dossierBase = base(m.cmuNumber || m.adherentCode);

    const dependents = m.dependents.map((d, i) => {
      if (!d) return d;
      const rang = (d.cmuNumber || '').match(/\.(\d+)$/);
      const attendu = rang ? `.${rang[1]}` : `.${i + 2}`;
      const nouveau = {
        ...d,
        codeSuffix: attendu,
        householdCode: dossierBase,
        // La base du dossier est celle du titulaire, jamais le code complet
        // du parent (qui portait son propre rang).
        adherentCode: base(d.adherentCode) === dossierBase ? dossierBase : d.adherentCode
      };
      if (d.codeSuffix !== attendu || d.householdCode !== dossierBase) repaired++;
      return nouveau;
    });

    return { ...m, dependents, householdCode: dossierBase };
  });

  return { members: nettoyes, repaired };
};

/**
 * Pipeline complet d'un import Excel du Studio : lecture du classeur,
 * appariement des photos (colonne PHOTO, nom, prénom, téléphone, code),
 * compression, puis construction des fiches.
 *
 * @param {File} excelFile   — le classeur .xlsx / .xls / .csv
 * @param {FileList} photoFiles — les images du dossier de photos
 * @param {Array|Set<string>} [existingCodes] — matricules déjà pris (registre)
 * @param {object} [opts] — options transmises à buildStudioMembers
 * @returns {Promise<{members: Array, totalPeople: number, matchedPhotos: number, columns: string[]}>}
 */
export const runExcelImport = async (excelFile, photoFiles, existingCodes = [], opts = {}) => {
  if (!excelFile) throw new Error('Aucun fichier Excel sélectionné.');
  const { rows: rowsRaw, columns } = await parseExcelFile(excelFile);

  // Erreur PARLANTE : « aucune ligne exploitable » sans détail est inexploitable
  // pour l'agent. On lui dit ce que le fichier contient réellement.
  if (!rowsRaw || rowsRaw.length === 0) {
    const feuilles = columns && columns.length ? ` Colonnes lues : ${columns.slice(0, 8).join(', ')}.` : '';
    throw new Error(`Le fichier « ${excelFile.name || 'sans nom'} » ne contient aucune ligne lisible dans sa première feuille. Vérifiez que vous avez bien choisi le classeur des bénéficiaires et non un autre onglet.${feuilles}`);
  }

  // Fusion des doublons AVANT tout : deux fiches pour la même personne
  // produiraient deux cartes — et deux matricules distincts — pour un seul
  // assuré. Le rapport est renvoyé à l'agent.
  const { records: rows, merged, groups: dupGroups } = dedupeRecordsByIdentity(rowsRaw);
  if (!rows.length) {
    const avecNom = rowsRaw.filter((r) => r.prenom || r.nom).length;
    throw new Error(`Le fichier « ${excelFile.name || 'sans nom'} » contient ${rowsRaw.length} ligne(s), dont ${avecNom} avec un nom — mais aucune n'a pu être retenue. Contrôlez les colonnes PRENOM_BENEFICIAIRE et NOM_BENEFICIAIRE.`);
  }

  const matched = matchPhotosToRows(rows, photoFiles);

  // Compression : une seule passe, puis index code normalisé → data-URL.
  const byName = new Map();
  for (const f of Array.from(photoFiles || [])) {
    if (f && String(f.type || '').startsWith('image/')) byName.set(f.name, f);
  }
  const photoUrls = new Map();
  // Budget photos : on dégrade la compression progressively plutôt que de
  // laisser le localStorage dépasser son quota. Sans cela, un import de
  // 1 451 personnes avec 195 photos échouait en bloc — et l'échec était
  // silencieux : les fiches s'affichaient puis disparaissaient au
  // rechargement de la page.
  const budget = Number(opts.photoBudgetBytes) || PHOTO_BUDGET_BYTES;
  let photoBytes = 0;
  let step = 0;
  let degradedPhotos = 0;
  for (const r of matched) {
    if (!r.photoUrl) continue;
    const file = byName.get(r.photoUrl);
    if (!file) continue;
    // Palier courant : on descend d'un cran dès que 70 % du budget est atteint.
    while (step < PHOTO_QUALITY_STEPS.length - 1 && photoBytes > budget * 0.7) {
      step += 1;
      degradedPhotos += 1;
    }
    const dataUrl = await fileToCompressedDataUrl(file, PHOTO_QUALITY_STEPS[step]);
    if (dataUrl) {
      photoBytes += dataUrl.length;
      photoUrls.set(canonicalCode(r.codeBeneficiaire || ''), dataUrl);
    }
  }

  const members = await buildStudioMembers(rows, { ...opts, photoUrls, existingCodes });
  if (!members.length) {
    throw new Error('Aucun bénéficiaire exploitable : chaque ligne doit porter au moins un nom ou un prénom.');
  }
  return {
    members,
    totalPeople: rows.length,
    matchedPhotos: photoUrls.size,
    // Doublons fusionnés et détail des groupes, pour un message honnête.
    merged,
    dupGroups,
    // Poids réel des photos retenues et nombre de photos dégradées : l'agent
    // doit savoir si toutes les photos ont bien pu être conservées.
    photoBytes,
    degradedPhotos,
    columns
  };
};

