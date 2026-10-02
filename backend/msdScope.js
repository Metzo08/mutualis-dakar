/**
 * Cloisonnement par MSD (Mutuelle de Santé Départementale).
 *
 * MODÈLE
 *  - Une MSD = une ligne du registre `merchant_accounts` (union_code).
 *  - Un Super Admin voit TOUTES les MSD et peut seul en créer une nouvelle.
 *  - Un agent de MSD ne voit QUE les données de SA MSD : ses assurés, leurs
 *    cartes, leurs cotisations, leurs garanties, ses bons de commande, ses
 *    statistiques. Rien d'autre, et c'est un droit, pas une consequence :
 *    il doit pouvoir produire tous les actes de prise en charge de son assuré.
 *
 * LE PROBLÈME RÉSOLU ICI
 * La MSD d'un assuré n'était stockée nulle part de façon exploitable :
 *  - `department` ne contient que 3 valeurs (Dakar, Pikine, Rufisque) alors
 *    que les assurés relèvent de 12 MSD ;
 *  - `mutuelle_name` est un texte libre : la MSD de Dakar y apparaît sous six
 *    graphies (« MSD Dakar » 435 fiches, « Mutuelle de santé départementale de
 *    Dakar » 58, « Mutuelle De Santé Départementale De Dakar » 37…) ;
 *  - `agents.department` porte « UDMS Dakar » ou « Pikine », des libellés qui
 *    ne correspondent à aucune des colonnes ci-dessus.
 * Résultat : le filtre `WHERE department = 'Pikine'` ne renvoyait qu'une fiche,
 * et `WHERE department = 'UDMS Dakar'` n'en renvoyait aucune — un agent
 * « aveugle », privé de SES propres assurés.
 *
 * SOLUTION
 * On rattache chaque fiche à un CODE DE MSD (`msd_code`) déduit du préfixe du
 * code CMU, qui est la donnée la plus fiable : il est normé par la plateforme
 * (« DKR… », « DRB… », « KLC… »). Ce rattachement est calculé une fois, stocké
 * en colonne, donc indexable — contrairement à un LIKE sur du texte libre.
 * Le code CMU prime, car la MSD émettrice EST celle qui a attribué le matricule.
 */

/**
 * Préfixe de code CMU → code de MSD.
 *
 * Les préfixes historiques sont heterogènes ; ce tableau couvre ceux
 * réellement présents en base. Toute entrée est confronting à `merchant_accounts`
 * par le script `backend/link-beneficiaries-msd.cjs`, qui refuse d'affecter un
 * code absent du registre plutôt que d'inventer une MSD.
 */
const CMU_PREFIX_TO_MSD = {
  DKR: 'DKR',            // Dakar
  PKN: 'PKN',            // Pikine
  GDW: 'GDW',            // Guédiawaye
  RFS: 'RFS',            // Rufisque
  DRB: 'DRB',            // Diourbel
  MBR: 'MBR',            // Mbour
  THS: 'THS',            // Thiès
  STL: 'STL',            // Saint-Louis
  KLC: 'KLC',            // Kaolack
  ZGC: 'ZGC'             // Ziguinchor
};

/** Variantes historiques rencontrées dans les imports. */
const PREFIX_ALIASES = {
  KRM: 'PKN',   // anciennement « Keur Massar »
  GUED: 'GDW',  // anciennement « Guediawaye »
  THI: 'THS',
  RUF: 'RFS',
  KLK: 'KLC',
  ZIG: 'ZGC',
  MBK: 'MBR',   // « Mbour » (ancienne graphie)
  FTK: 'KLC',   // Fatick
  // Codes « SN-DK-xx-… » : leur 3e segment est une ABRÉVIATION de MSD, pas
  // un code d'union. Ces abréviations viennent de l'ancien système.
  DAK: 'DKR',   // DAKAR
  DIO: 'DRB',   // DIOURBEL
  DBL: 'DRB',   // Diourbel (Mbacké)
  MED: 'DKR',   // La Médina, commune de Dakar
  PIK: 'PKN',   // Pikine
  KEM: 'PKN'    // Keur Massar (rattachée à Pikine)
  // Volontairement ABSENTS, car ces MSD n'existent pas au registre :
  //   LGA → Louga, KDA → Kolda, TBA → Tamba
  // On n'invente pas de MSD : ces fiches restent non rattachées et le Super
  // Admin doit créer la MSD manquante pour les accueillir.
};

/**
 * Extrait le préfixe alphabétique d'un code CMU.
 * `DKR_2600041.1` → `DKR` ; `DKR-DKR-2026-0012` → `DKR` ; `SN-DK-KAO-8497` → `SN`.
 * @param {string} cmuNumber
 * @returns {string|null}
 */
const cmuPrefix = (cmuNumber) => {
  const m = String(cmuNumber || '').toUpperCase().match(/^([A-Z]{2,4})(?=[-_]|\d)/);
  return m ? m[1] : null;
};

/**
 * Code de MSD déduit d'un code CMU.
 * @param {string} cmuNumber
 * @returns {string|null} code MSD, ou null si le préfixe est inconnu.
 */
const msdFromCmuNumber = (cmuNumber) => {
  const prefix = cmuPrefix(cmuNumber);
  if (!prefix) return null;
  if (CMU_PREFIX_TO_MSD[prefix]) return CMU_PREFIX_TO_MSD[prefix];
  if (PREFIX_ALIASES[prefix]) return PREFIX_ALIASES[prefix];
  // Préfixe composite « SN-DK-… » : le 2e segment porte souvent la MSD.
  const seg = String(cmuNumber || '').toUpperCase().split(/[-_]/).filter(Boolean);
  for (const s of seg) {
    if (CMU_PREFIX_TO_MSD[s]) return CMU_PREFIX_TO_MSD[s];
    if (PREFIX_ALIASES[s]) return PREFIX_ALIASES[s];
  }
  return null;
};

/** Fragment SQL : restreint `beneficiaries` aux bénéficiaires d'une MSD. */
const msdScope = (msdCode, paramIndex) => `AND b.msd_code = $${paramIndex}`;

/**
 * Nom lisible d'une MSD → code de MSD.
 *
 * Les comptes d'agents portent des libellés libres : « UDMS Dakar »,
 * « MSD Dakar », « Dakar », « Pikine ». On les ramène au code du registre.
 * Un libellé inconnu renvoie `null` — on ne devine pas : un agent dont le
 * rattachement est ambigu doit être corrigé par le Super Admin, plutôt que
 * d'être plaçaté arbitrairement dans une MSD.
 *
 * @param {string} label libellé de l'agent
 * @param {Array<{union_code:string,union_name:string}>} msds registre
 * @returns {string|null}
 */
const msdFromAgentLabel = (label, msds) => {
  const raw = String(label || '').trim().toUpperCase();
  if (!raw) return null;
  // Le compte de l'agrégateur n'est PAS une MSD : il encaisse pour toutes.
  // Il ne doit jamais capter un agent — « UDMS Dakar » contient « DAKAR »,
  // ce qui le faisait win par défaut et rattachait l'agent à l'agrégateur.
  const msdList = msds.filter((m) => String(m.union_code).toUpperCase() !== 'AGG');
  // Correspondance exacte sur le code, puis sur le nom lisible.
  const byCode = msdList.find((m) => String(m.union_code).toUpperCase() === raw);
  if (byCode) return byCode.union_code;

  const words = raw.replace(/[^A-Z]+/g, ' ').split(' ').filter(Boolean);
  for (const m of msdList) {
    const name = String(m.union_name || '').toUpperCase();
    const nameWords = name.replace(/[^A-Z]+/g, ' ').split(' ').filter(Boolean);
    // La MSD est nommée si son appellation apparaît dans le libellé de l'agent,
    // en mots significatifs (« MUTUELLE DE SANTE DEPARTEMENTALE DE DAKAR »
    // contient « DAKAR »).
    if (nameWords.some((w) => w.length > 2 && words.includes(w))) return m.union_code;
  }
  return null;
};

module.exports = {
  CMU_PREFIX_TO_MSD,
  PREFIX_ALIASES,
  cmuPrefix,
  msdFromCmuNumber,
  msdFromAgentLabel,
  msdScope
};