/**
 * ============================================================
 *  Programmes de cartes scolaires CMU — source de vérité unique
 * ============================================================
 *
 *  Les cartes scolaires existent en DEUX variantes officielles :
 *
 *   • CMU-Élèves → élève de l'école publique. Reconnaissable à l'INE
 *     national et à la cartographie scolaire IA / IEF de l'Éducation
 *     nationale qui pilote le programme.
 *
 *   • CMU-Daara  → élève de daara (école coranique). Les daaras ne
 *     relèvent PAS du circuit IA / IEF : l'agent de rattachement est le
 *     sheikh / responsable du daara. Le champ « IA / IEF » n'a donc
 *     AUCUNE signification sur ces cartes et ne doit jamais y figurer.
 *
 *  Toute la carte (recto, verso, QR, export) lit ses libellés ici :
 *  plus aucune chaîne « CMU-Élèves » codée en dur dans CardStudio.
 */

export const CARD_PROGRAMS = {
  CLASSIC: {
    id: 'CLASSIC',
    label: 'Carte classique',
    accent: '#059669',
    isSchool: false
  },
  CMU_ELEVES: {
    id: 'CMU_ELEVES',
    label: 'CMU-Élèves',
    frontBanner: '🎓 Carte scolaire — CMU-Élèves',
    frontFooter: 'CARTE SCOLAIRE OFFICIELLE — CMU-ÉLÈVES SÉNÉGAL',
    backBanner: 'CARTE SANITAIRE — CMU-ÉLÈVES',
    backCodeLabel: 'Code bénéficiaire CMU-Élèves',
    packageLabel: 'CMU-Élèves 100%',
    accent: '#2563eb',
    isSchool: true,
    // Les élèves de l'école publique relèvent du circuit IA / IEF.
    showIef: true,
    idLabel: 'N° INE / IEN (Identifiant Élève)',
    schoolWord: 'Établissement',
    schoolPlaceholder: 'École élémentaire / lycée',
    referralLabel: 'Tuteur / Responsable'
  },
  CMU_DAARA: {
    id: 'CMU_DAARA',
    label: 'CMU-Daara',
    frontBanner: '🕌 Carte scolaire — CMU-Daara',
    frontFooter: 'CARTE SCOLAIRE OFFICIELLE — CMU-DAARA SÉNÉGAL',
    backBanner: 'CARTE SANITAIRE — CMU-DAARA',
    backCodeLabel: 'Code bénéficiaire CMU-Daara',
    packageLabel: 'CMU-Daara 100%',
    accent: '#b45309',
    isSchool: true,
    // ⚠️ Pas de circuit IA / IEF pour les daaras : le champ est masqué.
    showIef: false,
    idLabel: 'N° IEN (Identifiant Daara)',
    schoolWord: 'Daara',
    schoolPlaceholder: 'Daara / école coranique',
    referralLabel: 'Responsable du daara'
  }
};

/** Programme effectif d'une carte, avec repli sûr sur CLASSIC. */
export const resolveCardProgram = (program) =>
  CARD_PROGRAMS[program] || CARD_PROGRAMS.CLASSIC;

/** Programme scolaire (CMU-Élèves / CMU-Daara) ou null pour les cartes classiques. */
export const resolveSchoolProgram = (program) => {
  const resolved = resolveCardProgram(program);
  return resolved.isSchool ? resolved : null;
};

// ── Unions Départementales des Mutuelles de Santé (MSD) ─────────────────────
// Chaque MSD est une entité autonome : elle émet SES cartes et encaisse
// SES propres cotisations. Le téléphone de permanence est donc une donnée
// PROPRE à chaque MSD — les coordonnées d'une MSD ne doivent JAMAIS
// apparaître sur les cartes d'une autre MSD.

/** Secours médical commun à tout le territoire sénégalais. */
export const NATIONAL_EMERGENCY = { samu: '15' };

// Coordonnées vérifiées de la MSD de Dakar (siège régional, Dakar).
const DAKAR_PHONES = {
  samu: '15',
  permanence: '76 845 54 99',
  permanenceAlt: '77 742 90 73',
  switchboard: '33 820 21 11'
};

export const DEPARTMENTAL_UNIONS = [
  { id: 'DKR', name: 'Mutuelle de Santé Départementale de Dakar', region: 'Dakar', codePrefix: 'DKR', phones: DAKAR_PHONES, official: true },
  { id: 'PKN', name: 'Mutuelle de Santé Départementale de Pikine', region: 'Dakar', codePrefix: 'PKN', phones: { samu: '15' } },
  { id: 'GDW', name: 'Mutuelle de Santé Départementale de Guédiawaye', region: 'Dakar', codePrefix: 'GDW', phones: { samu: '15' } },
  { id: 'RFS', name: 'Mutuelle de Santé Départementale de Rufisque', region: 'Dakar', codePrefix: 'RFS', phones: { samu: '15' } },
  { id: 'THS', name: 'Mutuelle de Santé Départementale de Thiès', region: 'Thiès', codePrefix: 'THS', phones: { samu: '15' } },
  { id: 'MBR', name: 'Mutuelle de Santé Départementale de Mbour', region: 'Thiès', codePrefix: 'MBR', phones: { samu: '15' } },
  { id: 'STL', name: 'Mutuelle de Santé Départementale de Saint-Louis', region: 'Saint-Louis', codePrefix: 'STL', phones: { samu: '15' } },
  { id: 'KLC', name: 'Mutuelle de Santé Départementale de Kaolack', region: 'Kaolack', codePrefix: 'KLC', phones: { samu: '15' } },
  { id: 'ZGC', name: 'Mutuelle de Santé Départementale de Ziguinchor', region: 'Ziguinchor', codePrefix: 'ZGC', phones: { samu: '15' } },
  { id: 'DRB', name: 'Mutuelle de Santé Départementale de Diourbel', region: 'Diourbel', codePrefix: 'DRB', phones: { samu: '15' } }
];

/** MSD correspondant à un identifiant d'union (repli : première de la liste). */
export const resolveUnion = (unionId) =>
  DEPARTMENTAL_UNIONS.find((u) => u.id === unionId) || DEPARTMENTAL_UNIONS[0];

/**
 * Lignes de contact affichées au verso d'une carte.
 *
 * Seules les coordonnées RÉELLEMENT renseignées pour la MSD émettrice
 * remontent : une MSD sans permanence propre n'affiche donc que le SAMU
 * national — jamais les numéros d'une autre MSD.
 *
 * @param {string} unionId  identifiant de l'union départementale (ex. 'DRB')
 * @param {object} [overrides]  coordonnées injectées par le studio (saisie MSD)
 * @returns {Array<{kind: string, label: string, value: string}>}
 */
export const buildContactLines = (unionId, overrides = null) => {
  const union = resolveUnion(unionId);
  const phones = union.phones || {};
  const pick = (key) => (overrides && overrides[key]) || phones[key] || '';

  const lines = [];
  const samu = pick('samu') || NATIONAL_EMERGENCY.samu;
  if (samu) lines.push({ kind: 'samu', label: '🚑 Samu', value: samu });

  const permanence = [pick('permanence'), pick('permanenceAlt')].filter(Boolean).join(' • ');
  if (permanence) lines.push({ kind: 'permanence', label: 'Permanence MSD', value: permanence });

  const switchboard = pick('switchboard');
  if (switchboard) lines.push({ kind: 'switchboard', label: 'Standard', value: switchboard });

  return lines;
};

/** Numéro de la solution technique, commun à toutes les cartes. */
export const SOLUTION_PHONE = '77 602 67 83';