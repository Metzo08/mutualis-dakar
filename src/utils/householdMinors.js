/**
 * ═══════════════════════════════════════════════════════════════════════
 *  AYANTS DROIT MINEURS D'UN ADHÉRENT — résolution multi-formes
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  PROBLÈME RÉSOLU
 *  ---------------
 *  Un adhérent qui prend en charge un enfant mineur doit voir ce mineur
 *  sur SA carte (nombre au verso, informations complètes au recto/QR).
 *
 *  Or les données arrivent sous DEUX formes incompatibles selon le chemin :
 *
 *   A. forme IMBRIQUÉE (import Excel `buildStudioMembers`) :
 *        le chef de ménage porte `dependents = [{ name, isMajor, … }]`.
 *        → mineur = `!d.isMajor`.
 *
 *   B. forme PLATE (API `/api/beneficiaries` via `fromApi`) :
 *        CHAQUE personne est une fiche séparée, SANS `dependents`.
 *        Les mineurs sont des fiches « sœurs » : même code de base +
 *        suffixe (.1 chef, .2/.3 …). `family_members` est vide en base.
 *        → mineur = âge < 18 ans calculé depuis `birthDate`.
 *
 *  Lire uniquement `member.dependents` (comportement historique) renvoie
 *  donc une liste VIDE dans le cas B, et le coupon de garantie affiche
 *  « 0 enfant(s) » alors que des mineurs existent. Ce module unifie les
 *  deux formes et déduplique, pour alimenter :
 *    - le verso de la carte (nombre d'ayants droit mineurs),
 *    - le payload QR (informations complètes de chaque mineur),
 *    - la vérification VerifyCard (via beneficiaryStore).
 *
 *  RÈGLE MÉTIER
 *  ------------
 *  Seul le CHEF DE MÉNAGE (rang de suffixe minimal du groupe de base)
 *  prend en charge les mineurs. Une fiche sœur MAJEURE a sa propre carte
 *  et n'adopte pas les mineurs du ménage. La minorité se déduit TOUJOURS
 *  de l'âge (< 18 ans), jamais du rang du suffixe : `2151.2` (47 ans) est
 *  majeur, `2161.2` (10 ans) est mineur.
 */
import { calculateAge } from './csuFormatter';

/** Âge canonique de la majorité (inclus). En dessous : mineur. */
export const MINOR_AGE = 18;

/**
 * Base d'un matricule : retire le suffixe de rang final.
 *   `DKR-DKR-2026-2251.2` → `DKR-DKR-2026-2251`
 *   `DKR_260002.0`        → `DKR_260002`
 *   `DKR_260002`          → `DKR_260002` (déjà une base)
 */
export const householdBase = (cmuNumber) => {
  const c = String(cmuNumber || '').trim();
  if (!c) return '';
  return c.replace(/\.\d+$/, '');
};

/** Rang du suffixe (.1, .2, .0…). Absent → +∞ (jamais chef). */
const suffixRank = (cmuNumber) => {
  const m = String(cmuNumber || '').match(/\.(\d+)$/);
  return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
};

/** Suffixe littéral (.2) ou '' si aucun. */
const suffixOf = (cmuNumber) => {
  const m = String(cmuNumber || '').match(/\.\d+$/);
  return m ? m[0] : '';
};

/**
 * Un mineur n'est retenu que si sa date de naissance est exploitable.
 * `calculateAge` renvoie `formatted: ''` uniquement quand la date est vide ou
 * illisible ; un nourrisson de moins d'1 an a `years: 0` mais `formatted`
 * renseigné (« 6 mois ») et DOIT être compté (prise en charge pédiatrique).
 * On NE devine donc PAS un mineur sans date fiable.
 * @param {object} person — fiche plate (forme API `fromApi`).
 * @returns {boolean} true si la date est exploitable ET l'âge < MINOR_AGE.
 */
const isFlatMinor = (person) => {
  const age = calculateAge(person.birthDate || person.birth_date || '');
  return age.formatted !== '' && age.years < MINOR_AGE;
};

/** Normalise un mineur issu de la forme IMBRIQUÉE (conserve ses champs riches). */
const normalizeNestedMinor = (d) => ({
  ...d,
  age: calculateAge(d.birthDate || '').years || d.age || 0,
  cmuNumber: (d.cmuNumber || '').trim(),
  codeSuffix: (d.codeSuffix || '').trim(),
  isMajor: false,
  relation: d.relation || (d.gender === 'F' ? 'Fille (Enfant mineur)' : 'Fils (Enfant mineur)')
});

/** Normalise un mineur issu de la forme PLATE (fiche sœur de l'API). */
const normalizeFlatMinor = (m) => {
  const firstName = (m.firstName || '').trim();
  const lastName = (m.lastName || '').trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const code = (m.cmuNumber || '').trim();
  const gender = (m.gender || 'M').toString().toUpperCase().startsWith('F') ? 'F' : 'M';
  return {
    id: m.id,
    name: fullName || m.name || '',
    firstName,
    lastName,
    cmuNumber: code,
    codeSuffix: suffixOf(code),
    birthDate: m.birthDate || '',
    birthPlace: m.birthPlace || '',
    gender,
    age: calculateAge(m.birthDate || '').years,
    phone: m.phone || '',
    photoUrl: m.photoUrl || '',
    hasOfficialPhoto: !!m.photoUrl,
    bloodGroup: m.bloodGroup || 'O+',
    allergies: m.allergies || 'Aucune connue',
    vaccines: m.vaccines || 'PEV 100% à jour',
    antecedents: m.antecedents || 'Antécédents normaux',
    isMajor: false,
    relation: m.relation || (gender === 'F' ? 'Fille (Enfant mineur)' : 'Fils (Enfant mineur)')
  };
};

/**
 * Résout les ayants droit mineurs pris en charge par `currentMember`.
 *
 * @param {Array}  members       — registre complet (toutes les fiches).
 * @param {object} currentMember — fiche dont on imprime/aperçoit la carte.
 * @returns {Array} mineurs normalisés, dédupliqués (par cmuNumber/name).
 *                  Tableau vide si `currentMember` n'est pas chef de ménage
 *                  ou n'a aucun mineur à charge.
 */
export const resolveMinorDependents = (members, currentMember) => {
  if (!currentMember) return [];
  const list = Array.isArray(members) ? members.filter(Boolean) : [];
  const seen = new Set();
  const out = [];

  const push = (minor) => {
    if (!minor) return;
    const key = (minor.cmuNumber || minor.cmuCode || minor.name || '').toString().toUpperCase();
    if (key && seen.has(key)) return; // dédoublonne imbriqué vs plat
    if (key) seen.add(key);
    out.push(minor);
  };

  // ── 1. Mineurs IMBRIQUÉS (import Excel) ──────────────────────────────
  // On respecte le flag `isMajor` historique (rétro-compatibilité) sans le
  // recalculer : c'est la source de vérité de ce chemin d'import.
  for (const d of (currentMember.dependents || [])) {
    if (d && !d.isMajor) push(normalizeNestedMinor(d));
  }

  // ── 2. Mineurs PLATS « sœurs » (API) ─────────────────────────────────
  // Uniquement si `currentMember` est le chef du groupe de base : une fiche
  // sœur majeure a sa propre carte et ne prend pas les mineurs en charge.
  const base = householdBase(currentMember.cmuNumber);
  if (base) {
    const currentRank = suffixRank(currentMember.cmuNumber);
    const siblings = list.filter((m) => householdBase(m.cmuNumber) === base);
    const isHead = siblings.every((s) => suffixRank(s.cmuNumber) >= currentRank);

    if (isHead) {
      for (const sib of siblings) {
        if (sib === currentMember) continue;
        if (String(sib.cmuNumber || '') === String(currentMember.cmuNumber || '')) continue;
        if (sib.isMajor === true) continue;      // ayant droit majeur déclaré
        if (!isFlatMinor(sib)) continue;         // âge < 18 ans uniquement
        push(normalizeFlatMinor(sib));
      }
    }
  }

  return out;
};

/**
 * Identifiants (`id` ET `cmuNumber` normalisé) de TOUTES les fiches mineures
 * rattachées à un adhérent (chef de ménage) du registre — forme PLATE.
 *
 * Sert à RETIRER ces fiches de la liste des cartes IMPRIMABLES : un enfant
 * mineur n'a pas sa propre carte, il est pris en charge sur celle de son
 * adhérent. Reprend EXACTEMENT la règle de `resolveMinorDependents` (chef =
 * rang de suffixe minimal du groupe de base), pour que les deux restent
 * cohérents : une fiche est exclue ⟺ elle est rattachée au chef.
 *
 * @param {Array} members — registre complet.
 * @returns {Set<string>} ids/codes des mineurs rattachés (vide si aucun).
 */
export const collectAttachedMinorIds = (members) => {
  const ids = new Set();
  const list = Array.isArray(members) ? members.filter(Boolean) : [];

  // Regroupe par base de ménage (ex. DKR-DKR-2026-2251 → .1/.2/.3).
  const byBase = new Map();
  for (const m of list) {
    const base = householdBase(m && m.cmuNumber);
    if (!base) continue;
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(m);
  }

  for (const group of byBase.values()) {
    for (const m of group) {
      const rank = suffixRank(m.cmuNumber);
      const isHead = group.every((s) => suffixRank(s.cmuNumber) >= rank);
      if (isHead) continue;          // le chef a sa propre carte
      if (m.isMajor === true) continue; // ayant droit majeur → sa carte
      if (!isFlatMinor(m)) continue;    // >= 18 ans → sa propre carte
      if (m.id) ids.add(m.id);
      if (m.cmuNumber) ids.add(String(m.cmuNumber).toUpperCase());
    }
  }

  return ids;
};

