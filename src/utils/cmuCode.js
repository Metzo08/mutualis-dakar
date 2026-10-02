/**
 * ============================================================
 *  MATRICULE CSU STRUCTURÉ — règles pures, sans dépendance
 * ============================================================
 *
 *  Format officiel :  REGION - MSD - ANNEE - SEQUENCE
 *  Exemple          :  DKR-DKR-2026-0001
 *                       │    │    │      └─ n° d'ordre d'adhésion
 *                       │    │    └──────── année d'adhésion
 *                       │    └───────────── département (MSD émettrice)
 *                       └────────────────── région où se trouve cette MSD
 *
 *  Le code est AUTO-DOCUMENTANT : à partir de la seule inscription sur le
 *  PVC, un agent sait de quelle région et de quelle MSD vient la carte,
 *  l'année de la campagne, et le rang de la personne.
 *
 *  ⚠️ Module LÉGER, sans `xlsx` : ces règles sont pures et n'ont besoin que
 *  de `cardPrograms`. Les laisser dans bulkImport.js obligeait le Studio à
 *  charger la librairie de lecture Excel (≈ 350 Ko) sur le chemin critique de
 *  chaque écran, pour un simple test de format.
 *
 *  ⚠️ NON-RÉGRESSION : les cartes DÉJÀ imprimées gardent leur code d'origine
 *  (`DKR_2600027.0`, `EDU_DKR_26000163`, `DAARA-2025-0078`…). Ce format ne
 *  s'applique qu'aux nouvelles attributions. Les anciens codes restent
 *  lisibles, et getCardByCode() continue de les résoudre.
 */

import { resolveUnion } from './cardPrograms';

/** Code région à 3 lettres, dérivé de la région administrative de la MSD. */
export const REGION_CODES = {
  'Dakar': 'DKR',
  'Thiès': 'THS',
  'Saint-Louis': 'STL',
  'Kaolack': 'KLC',
  'Ziguinchor': 'ZGC',
  'Diourbel': 'DRB'
};

/**
 * Code de la région d'une MSD. Repli sur le code de l'union elle-même si la
 * région n'est pas dans la table : un code inconnu ne doit jamais empêcher
 * d'attribuer un matricule.
 */
export const regionCodeFor = (unionId) => {
  const union = resolveUnion(unionId);
  return REGION_CODES[union.region] || union.codePrefix || union.id || 'DKR';
};

/** Année d'adhésion par défaut : la campagne en cours. */
export const currentCampaignYear = () => new Date().getFullYear();

/**
 * Assemble un matricule structuré.
 * @param {{region?:string, unionId?:string, year?:number|string, seq?:number|string}} parts
 * @returns {string} ex. « DKR-DKR-2026-0001 »
 */
export const buildStructuredCode = (parts = {}) => {
  const region = String(parts.region || 'DKR').toUpperCase().slice(0, 3);
  const union = String(parts.unionId || 'DKR').toUpperCase().slice(0, 3);
  const year = String(parts.year || currentCampaignYear()).slice(0, 4);
  const seq = String(Number(parts.seq) || 1).padStart(4, '0');
  return `${region}-${union}-${year}-${seq}`;
};

/**
 * Décompose un matricule structuré.
 * @param {string} code
 * @returns {{region:string, unionId:string, year:number, seq:number}|null}
 */
export const parseStructuredCode = (code) => {
  // Suffixe de rang OPTIONNEL : `DKR-DKR-2026-0001.2` est la 2ᵉ personne du
  // dossier 0001. Le suffixe ne change ni la région, ni la MSD, ni l'année,
  // ni le numéro de séquence : il n'est donc pas capturé ici.
  const m = String(code || '').trim().toUpperCase()
    .match(/^([A-Z]{3})-([A-Z]{3})-(\d{4})-(\d{4})(?:\.\d+)?$/);
  if (!m) return null;
  return { region: m[1], unionId: m[2], year: Number(m[3]), seq: Number(m[4]) };
};

/**
 * Rang d'une personne dans son dossier : `.1` = adhérent, `.2` et suivantes
 * = bénéficiaires pris en charge. Absent = carte principale non suffixée.
 */
export const householdRank = (code) => {
  const m = String(code || '').trim().match(/\.(\d+)$/);
  return m ? Number(m[1]) : null;
};

/** Compose le matricule d'une personne : base du dossier + rang. */
export const withHouseholdRank = (baseCode, rank) => {
  const base = String(baseCode || '').replace(/\.\d+$/, '');
  return rank ? `${base}.${rank}` : base;
};

/**
 * Dernier numéro de séquence DÉJÀ ATTRIBUÉ pour un triplet
 * (région, MSD, année). La séquence repart toujours AU-DESSUS : un code ne
 * peut donc jamais être réattribué à quelqu'un d'autre.
 *
 * @param {Array<string>|Set<string>} existingCodes
 * @param {{region:string, unionId:string, year:number|string}} scope
 * @returns {number} 0 si rien n'existe encore pour ce triplet
 */
export const lastSequenceFor = (existingCodes, scope = {}) => {
  const region = String(scope.region || '').toUpperCase();
  const union = String(scope.unionId || '').toUpperCase();
  const year = String(scope.year || '').slice(0, 4);
  // `minSeq` permet de poursuivre une numérotation déjà engagée (lot terrain)
  // au lieu de repartir de 0001 et de faire coexister deux séries.
  const minSeq = Number(scope.minSeq) || 0;
  const codes = existingCodes instanceof Set
    ? Array.from(existingCodes)
    : (existingCodes || []);

  let max = minSeq;
  for (const raw of codes) {
    const parsed = parseStructuredCode(raw);
    if (!parsed) continue;
    if (parsed.region !== region || parsed.unionId !== union) continue;
    if (String(parsed.year) !== year) continue;
    if (parsed.seq > max) max = parsed.seq;
  }
  return max;
};

/**
 * Codes produits par l'ancien générateur séquentiel (`DKR-2600001`).
 *
 * Ce motif est UNIQUE : il n'a jamais été produit que par ce générateur, donc
 * il ne peut correspondre à aucune carte imprimée d'avant (celles-ci
 * utilisent `_` ou un préfixe de programme : `DKR_2600027.0`,
 * `EDU_DKR_26000163`). C'est ce qui rend la migration sûre : elle ne touche
 * que les fiches concernées, et laisse les anciennes cartes intactes.
 */
export const LEGACY_GENERATED_RE = /^[A-Z]{3}-26\d{5}$/;

/** Le code correspond-il à l'ancien format à migrer ou à purger ? */
export const isLegacyGeneratedCode = (code) =>
  LEGACY_GENERATED_RE.test(String(code || '').trim().toUpperCase());

/** Le code est-il déjà au format officiel ? */
export const isOfficialCode = (code) => parseStructuredCode(code) !== null;
