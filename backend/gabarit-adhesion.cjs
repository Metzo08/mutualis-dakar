/**
 * ═══════════════════════════════════════════════════════════════════════
 *  GABARIT D'ADHÉSION EN MASSE — fichier Excel fourni par le Super Admin
 * ═══════════════════════════════════════════════════════════════════════
 *  Le Super Admin télécharge ce gabarit et le remet à la MSD qui doit
 *  effectuer une ADHÉSION EN MASSE + COTISATION. La MSD remplit les lignes
 *  (une par assuré), puis réimporte le fichier dans le Studio Cartes.
 *
 *  Colonnes = exactement celles reconnues par l'import du Studio
 *  (src/utils/bulkImport.js). Le CODE_BENEFICIAIRE est laissé VIDE :
 *  la plateforme génère automatiquement les codes au format officiel
 *  RÉGION-DÉPARTEMENT-ANNÉE-SÉQUENCE, uniques (règle porteur, oct. 2026).
 *
 *  Contenu :
 *   1. feuille « Adhésion en masse » : gabarit + 3 lignes d'exemple grisées
 *      (à supprimer par la MSD avant usage) ;
 *   2. feuille « Notice » : consignes de remplissage, règle mineurs < 18 ans,
 *      liste des colonnes obligatoires.
 *
 *  Usage :
 *   node backend/gabarit-adhesion.cjs                       → gabarit générique
 *   node backend/gabarit-adhesion.cjs DKR "MSD Dakar"       → pré-rempli pour une MSD
 *   node backend/gabarit-adhesion.cjs DKR "MSD Dakar" 2026 50000 15000
 *        (50000 = cotisation annuelle, 15000 = adhésion)
 */
const XLSX = require('xlsx');

// ── Colonnes du gabarit (dans l'ordre) ─────────────────────────────────
// Elles reprennent le modèle déjà reconnu par le Studio (« ASS LONASE » /
// « MSD de Grand Yoff ») : aucune adaptation de l'import n'est nécessaire.
const COLONNES = [
  'NUMERO ORDRE',            // rempli automatiquement à l'import (optionnel)
  'NUMERO_ADHERENT',         // n° de dossier du ménage (optionnel, sinon auto)
  'CODE_BENEFICIAIRE',       // LAISSER VIDE : codes générés automatiquement
  'PRENOM_BENEFICIAIRE',     // obligatoire
  'NOM_BENEFICIAIRE',        // obligatoire
  'DATE_NAISSANCE',          // obligatoire (JJ/MM/AAAA)
  'LIEU_NAISSANCE',          // obligatoire
  'NIN',                     // 13 chiffres, ou « EXT. NAISSANCE » si non fourni
  'SEXE',                    // M ou F
  'ADRESSE',                 // quartier / rue
  'CONTACT',                 // téléphone (7XXXXXXXX)
  'PRENOM_ADHERENT',         // chef de ménage (pour un ayant droit)
  'NOM_ADHERENT',            // chef de ménage
  'NOM_ORGANISATION',        // MSD émettrice (pré-rempli)
  'COTISATION_ANNUELLE',     // montant en FCFA (pré-rempli, modifiable)
  'ECHEANCE',                // fin de validité (pré-rempli)
  'VALIDITE_CARTE_DEBUT',    // début de couverture (pré-rempli)
  'VALIDITE_CARTE_FIN',      // fin de couverture (pré-rempli)
  'TYPE_CARTE',              // individuel / familial
  'OBSERVATIONS',            // libre
  'PHOTO',                   // nom du fichier photo si déjà disponible (optionnel)
  'DATE_CREATION',           // rempli par la MSD
  'DATE_MODIFICATION',       // rempli par la MSD
  'MUTUELLE_D_ORIGINE',      // mutuelle antérieure (optionnel)
  'GROUPE_SANGUIN',          // optionnel
];

// ── Valeurs pré-remplies (arguments optionnels) ────────────────────────
const [, , msdArg, nomMsdArg, cotisationArg, adhesionArg] = process.argv;
const CODE_MSD = (msdArg || 'DKR').toUpperCase().slice(0, 3);
const NOM_MSD = nomMsdArg || `MSD ${CODE_MSD}`;
const ANNEE = new Date().getFullYear();
const COTISATION = Number(cotisationArg) || 6000;
const ADHESION = Number(adhesionArg) || 15000;

const finAnnee = `${ANNEE}-12-31`;

// ── Lignes d'exemple (à supprimer par la MSD avant usage) ──────────────
const exemples = [
  ['1', 'FOY-0001', '', 'AMINATA', 'NDIAYE', '15/03/1985', 'DAKAR', '1650198500123', 'F', 'GRAND YOFF - ARAFAT', '771234567', '', '', NOM_MSD, COTISATION, finAnnee, `${ANNEE}-01-01`, finAnnee, 'individuel', 'EXEMPLE À SUPPRIMER', '', `${ANNEE}-01-01`, '', ''],
  ['2', 'FOY-0002', '', 'MOUSSA', 'FALL', '22/07/1979', 'THIES', '1660197900456', 'M', 'KHAR YALLAH', '782345678', '', '', NOM_MSD, COTISATION, finAnnee, `${ANNEE}-01-01`, finAnnee, 'familial', 'ADHÉRENT : son code finira par .1', '', `${ANNEE}-01-01`, '', ''],
  ['3', 'FOY-0002', '', 'ABDOULAYE', 'FALL', '05/12/2008', 'DAKAR', 'EXT. NAISSANCE', 'M', 'KHAR YALLAH', '782345678', 'MOUSSA', 'FALL', NOM_MSD, COTISATION, finAnnee, `${ANNEE}-01-01`, finAnnee, 'familial', 'MINEUR < 18 ans : PRIS EN CHARGE sur la carte de son adhérent — PAS de carte propre', '', `${ANNEE}-01-01`, '', ''],
];

// ── Feuille 1 : gabarit ────────────────────────────────────────────────
const dataAdhesion = [
  COLONNES,
  ...exemples,
  // 100 lignes vides prêtes à remplir
  ...Array.from({ length: 100 }, () => Array(COLONNES.length).fill('')),
];
const wsAdhesion = XLSX.utils.aoa_to_sheet(dataAdhesion);

// Ligne 1 (titres) en gras + largeur des colonnes
wsAdhesion['!cols'] = COLONNES.map((c) => ({ wch: Math.max(c.length + 2, 12) }));
wsAdhesion['!freeze'] = { xSplit: 0, ySplit: 1 };

// ── Feuille 2 : notice ────────────────────────────────────────────────
const notice = [
  [`GABARIT D'ADHÉSION EN MASSE — ${NOM_MSD} (code MSD : ${CODE_MSD})`],
  [`Année de campagne : ${ANNEE}   |   Cotisation annuelle : ${COTISATION} FCFA   |   Frais d'adhésion : ${ADHESION} FCFA`],
  [''],
  ['RÈGLES DE REMPLISSAGE'],
  ['1. UNE LIGNE = UNE PERSONNE (adhérent OU ayant droit).'],
  ['2. Laisser CODE_BENEFICIAIRE VIDE : la plateforme génère automatiquement les'],
  ['   codes au format RÉGION-DÉPARTEMENT-ANNÉE-SÉQUENCE (ex. DKR-DKR-2026-0001.1),'],
  ['   chaque code est UNIQUE et jamais réattribué.'],
  ['3. RÈGLE D OR : un bénéficiaire de MOINS DE 18 ANS ne possède PAS de carte.'],
  ['   Il figure comme PRIS EN CHARGE sur la carte de son adhérent :'],
  ['   renseigner PRENOM_ADHERENT et NOM_ADHERENT = le chef de ménage.'],
  ['4. Un adhérent SEUL a un code se terminant par .1 ; sa femme et les membres'],
  ['   adultes de sa famille ont chacun leur carte (.2, .3…).'],
  ['5. COLONNES OBLIGATOIRES : PRENOM_BENEFICIAIRE, NOM_BENEFICIAIRE,'],
  ['   DATE_NAISSANCE (JJ/MM/AAAA), LIEU_NAISSANCE, SEXE (M/F), ADRESSE, CONTACT.'],
  ['6. NIN : 13 chiffres. Si la personne ne l a pas encore, saisir EXT. NAISSANCE.'],
  ['7. SUPPRIMER les 3 lignes d EXEMPLE avant de saisir les assurés.'],
  ['8. Enregistrer le fichier en .xlsx et le réimporter dans le Studio Cartes'],
  ['   (sélectionner d abord le dossier de photos, puis le fichier Excel).'],
  ['9. Après l import, télécharger la liste des assurés SANS photo (bouton CSV)'],
  ['   pour photographier exactement ces personnes.'],
  [''],
  ['COLONNE PAR COLONNE'],
  ...COLONNES.map((c, i) => [c, [
    'N° d ordre de la ligne (optionnel, recalculé à l import)',
    'N° de dossier du ménage (optionnel : la plateforme regroupe le foyer)',
    'LAISSER VIDE — généré automatiquement par la plateforme',
    'Prénom(s) de l assuré (obligatoire)',
    'Nom de famille de l assuré (obligatoire)',
    'Date de naissance JJ/MM/AAAA (obligatoire)',
    'Lieu de naissance (obligatoire)',
    'NIN à 13 chiffres ou EXT. NAISSANCE',
    'M ou F (obligatoire)',
    'Quartier / rue (obligatoire)',
    'Téléphone 7XXXXXXXX',
    'Prénom du chef de ménage (pour un ayant droit)',
    'Nom du chef de ménage (pour un ayant droit)',
    'MSD émettrice (pré-rempli)',
    'Montant annuel en FCFA (pré-rempli, modifiable)',
    'Fin de validité de la cotisation (pré-rempli)',
    'Début de couverture (pré-rempli)',
    'Fin de couverture (pré-rempli)',
    'individuel ou familial',
    'Remarques libres',
    'Nom du fichier photo si déjà disponible',
    'Date de saisie',
    'Date de dernière modification',
    'Mutuelle antérieure (optionnel)',
    'Groupe sanguin (optionnel)',
  ][i] || '']),
];
const wsNotice = XLSX.utils.aoa_to_sheet(notice);
wsNotice['!cols'] = [{ wch: 30 }, { wch: 95 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsAdhesion, 'Adhésion en masse');
XLSX.utils.book_append_sheet(wb, wsNotice, 'Notice');

const sortie = `GABARIT-ADHESION-MASSE-${CODE_MSD}-${ANNEE}.xlsx`;
XLSX.writeFile(wb, sortie);
console.log(`✅ Gabarit créé : ${sortie}`);
console.log(`   MSD : ${NOM_MSD} (${CODE_MSD}) — campagne ${ANNEE}`);
console.log(`   Cotisation annuelle : ${COTISATION} FCFA — Adhésion : ${ADHESION} FCFA`);
console.log(`   Colonnes : ${COLONNES.length} — 100 lignes prêtes à remplir`);
console.log(`   Le Super Admin remet ce fichier à la MSD ; elle le remplit puis le`);
console.log(`   réimporte dans le Studio Cartes : les codes sont générés automatiquement.`);
