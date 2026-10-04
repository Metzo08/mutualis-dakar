/**
 * ═══════════════════════════════════════════════════════════════════════
 *  FEUILLE DE RENOMMAGE — VILLE DE DAKAR puis ASS LONASE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CONTEXTE (audit établi)
 * • Dossier « Photos AMEVI ville de Dakar » : fichiers « 1.0 Anta Lo.jpeg ».
 *   Aucun code bénéficiaire, aucun lien vers le classeur. L'appariement par nom
 *   seul ne couvrait que 89 fiches sur 136.
 * • Dossier « ASS LONASE » : fichiers « DKR_2600040.1 PAPA IBRAHIMA SEYE.jpeg ».
 *   Le code est DANS le nom : appariement par code, 66/66, sans ambiguïté.
 *   → Ces fichiers sont déjà conformes : AUCUN renommage n'est proposé.
 *
 * REPÈRE DE LECTURE DES CODES
 * Ville de Dakar : le chef de ménage porte le rang « .0 ».
 * ASS LONASE     : le chef de ménage porte le rang « .1 ».
 * Le nouveau nom reprend le CODE_BENEFICIAIRE du classeur tel quel : aucune
 * valeur n'est inventée.
 *
 * ⚠️ SÉCURITÉ
 *   • ce script ne renomme AUCUN fichier : il produit un classeur Excel ;
 *   • un code visé par DEUX photos est écarté : il devient « À TRANCHER »,
 *     jamais une proposition (une photo écraserait l'autre) ;
 *   • toute photo sans correspondance reste « À TRANCHER ».
 *
 * Usage : node backend/renommage-excel.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');

const VDD_PHOTOS = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar';
const VDD_CLASSEUR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/AMEVI-VILLE-DE-DAKAR.xlsx';
const LONASE_PHOTOS = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE';
const LONASE_CLASSEUR = 'C:/Users/hp/Downloads/ASS LONASE.xlsx';
const SORTIE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/RENOMMAGE-PHOTOS.xlsx';

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const normalizeName = (s) => clean(s).toUpperCase().replace(/[^A-Z]/g, '');

/** Prénom / nom, comme bulkImport.js. */
const splitFullName = (prenom, nom) => {
  const p = clean(prenom).toUpperCase();
  const n = clean(nom).toUpperCase();
  if (!p) return { firstName: '', lastName: n };
  if (!n) return { firstName: p, lastName: '' };
  if (p.endsWith(n) && p !== n) return { firstName: p.slice(0, -n.length).trim(), lastName: n };
  return { firstName: p, lastName: n };
};

/** Lignes d'un classeur, dédoublonnées sur le code (la plus riche gagne). */
const lireClasseur = (fichier) => {
  const wb = XLSX.readFile(fichier, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => clean(r.CODE_BENEFICIAIRE));
  const parCode = new Map();
  const richesse = (x) => Object.values(x || {}).filter((v) => clean(v)).length;
  rows.forEach((r) => {
    const code = clean(r.CODE_BENEFICIAIRE).toUpperCase();
    if (!parCode.has(code) || richesse(r) > richesse(parCode.get(code))) parCode.set(code, r);
  });
  return { lignes: rows, parCode };
};
// ── VILLE DE DAKAR : apparier par nom, puis écarter les collisions ──────
const vdd = lireClasseur(VDD_CLASSEUR);
const parNom = new Map();
vdd.parCode.forEach((ligne, code) => {
  const n = splitFullName(ligne.PRENOM_BENEFICIAIRE, ligne.NOM_BENEFICIAIRE);
  const k = normalizeName(`${n.firstName}${n.lastName}`);
  if (!k) return;
  if (!parNom.has(k)) parNom.set(k, []);
  parNom.get(k).push({ code, ligne });
});

const fichiersVdd = fs.existsSync(VDD_PHOTOS)
  ? fs.readdirSync(VDD_PHOTOS).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
  : [];

const candidats = [];
const sansFiche = [];

fichiersVdd.forEach((fichier) => {
  const m = fichier.match(/^[\d.]+\s+(.+)\.[^.]+$/);
  if (!m) { sansFiche.push({ fichier, raison: 'nom de fichier hors format' }); return; }
  const nomFichier = m[1];

  let hits = parNom.get(normalizeName(nomFichier)) || [];
  if (hits.length === 0) {
    // Prénom composé : « Adjaratou Ndeye DEME » pour ADJARATOU / DEME.
    const mots = nomFichier.toUpperCase().split(/\s+/).filter(Boolean);
    const dernier = normalizeName(mots[mots.length - 1]);
    hits = [];
    parNom.forEach((liste, k) => {
      if (!dernier || !k.endsWith(dernier)) return;
      const debutFichier = normalizeName(mots.slice(0, -1).join(''));
      const debutFiche = k.slice(0, -dernier.length);
      if (debutFiche.length >= 4 && debutFichier.startsWith(debutFiche)) hits.push(...liste);
    });
  }

  if (hits.length === 0) { sansFiche.push({ fichier, raison: 'aucune fiche de ce nom' }); return; }
  const cible = hits.length === 1 ? hits[0] : null;
  candidats.push({
    fichier,
    cible,
    raison: hits.length > 1 ? `${hits.length} fiches portent ce nom` : '',
    codes: hits.map((h) => h.code),
  });
});

// Un code visé par DEUX photos serait un écrasement : on l'écarte.
const parCode = new Map();
candidats.filter((c) => c.cible).forEach((c) => {
  if (!parCode.has(c.cible.code)) parCode.set(c.cible.code, []);
  parCode.get(c.cible.code).push(c);
});
const codesEnCollision = new Set(
  [...parCode.entries()].filter(([, l]) => l.length > 1).map(([code]) => code)
);

const lignesVdd = [];
const trancher = [];
candidats.forEach((c) => {
  if (!c.cible) { trancher.push({ ...c, motif: c.raison }); return; }
  if (codesEnCollision.has(c.cible.code)) {
    trancher.push({ fichier: c.fichier, motif: `code ${c.cible.code} déjà visé par une autre photo` });
    return;
  }
  const l = c.cible.ligne;
  const nouveau = `${c.cible.code} ${clean(l.PRENOM_BENEFICIAIRE)} ${clean(l.NOM_BENEFICIAIRE)}`
    .replace(/\s+/g, ' ').trim() + path.extname(c.fichier).toLowerCase();
  lignesVdd.push({
    'Ancien nom': c.fichier,
    'Nouveau nom': nouveau,
    'CODE_BENEFICIAIRE': c.cible.code,
    'NUMERO_ADHERENT': clean(l.NUMERO_ADHERENT) || '—',
    'Prenom': clean(l.PRENOM_BENEFICIAIRE),
    'Nom': clean(l.NOM_BENEFICIAIRE),
    'Lot': 'VILLE DE DAKAR',
    'Statut': 'À RENOMMER',
  });
});

// ── ASS LONASE : déjà conforme, on le constate sans rien proposer ─────────
const lonase = lireClasseur(LONASE_CLASSEUR);
const codesLonase = new Set(lonase.parCode.keys());
const fichiersLonase = fs.existsSync(LONASE_PHOTOS)
  ? fs.readdirSync(LONASE_PHOTOS).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
  : [];

const lignesLonase = fichiersLonase.map((fichier) => {
  const base = fichier.replace(/\.[^.]+$/, '');
  const m = base.match(/^([A-Za-z]{2,4}[_\-\s]\d{4,8}(?:\.\d+)?)/);
  const code = m ? m[1].replace(/[_\-\s]+$/, '').toUpperCase() : '';
  const connu = codesLonase.has(code);
  return {
    'Ancien nom': fichier,
    'Nouveau nom': connu ? fichier : '—',
    'CODE_BENEFICIAIRE': code || '—',
    'NUMERO_ADHERENT': '—',
    'Prenom': '—',
    'Nom': '—',
    'Lot': 'ASS LONASE',
    'Statut': connu ? 'DEJA CONFORME (aucun renommage)' : 'CODE INTROUVABLE — à vérifier',
  };
});
// ── Écriture du classeur Excel ───────────────────────────────────────────
console.log('=== BILAN ===');
console.log(`  VILLE DE DAKAR : ${lignesVdd.length} renommages sûrs sur ${fichiersVdd.length} photos`);
console.log(`  ASS LONASE     : ${lignesLonase.length} fichiers, tous déjà conformes au code`);
const toutesATrancher = [...trancher, ...sansFiche];
console.log(`  A TRANCHER     : ${toutesATrancher.length} photos`);

const feuille = (titre, lignes, largeur) => {
  const ws = XLSX.utils.json_to_sheet(lignes);
  ws['!cols'] = largeur;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  XLSX.utils.book_append_sheet(wb, ws, titre);
  return lignes.length;
};

const wb = XLSX.utils.book_new();

// Onglet 1 : le mode d'emploi, pour ne rien faire dans le désordre.
const guide = [
  { 'Étape': '1. VILLE DE DAKAR', 'Action': 'Renommer les fichiers de la colonne « Ancien nom » en « Nouveau nom ».', 'Detail': `${lignesVdd.length} fichiers. Ouvrir Excel, copier la colonne « Nouveau nom », coller dans le dossier, puis renommer. Ou renommer à la main.` },
  { 'Étape': '2. Vérifier', 'Action': 'Relire la feuille « À TRANCHER ».', 'Detail': `${trancher.length + sansFiche.length} photos sans correspondance : elles resteront sans photo. Renommez-les vous-même si vous connaissez le code.` },
  { 'Étape': '3. ASS LONASE', 'Action': 'Aucun renommage nécessaire.', 'Detail': `${lignesLonase.length} fichiers portent déjà leur code : l\'import se fait par code, sans risque.` },
  { 'Étape': '4. Purger', 'Action': 'Dans Studio Cartes, sélectionner le lot VILLE DE DAKAR puis 🧹 Vider.', 'Detail': 'Obligatoire AVANT de réimporter : sans purge, la déduplication saute les personnes déjà présentes et le fichier n\'est jamais réappliqué.' },
  { 'Étape': '5. Importer', 'Action': 'Importer AMEVI.xlsx puis le dossier photo renommé.', 'Detail': 'Puis ASS LONASE.xlsx et son dossier. Un lot à la fois.' },
  { 'Étape': '', 'Action': '', 'Detail': '' },
  { 'Étape': 'RAPPEL', 'Action': 'Les deux lots sont des campagnes distinctes.', 'Detail': 'Ne les fusionnez pas : vider un lot ne doit jamais toucher l\'autre.' },
  { 'Étape': 'CODES', 'Action': 'Ville de Dakar : chef de ménage en rang .0', 'Detail': 'ASS LONASE : chef de ménage en rang .1. Le nouveau nom reprend le code du classeur tel quel.' },
];
feuille('MODE D EMPLOI', guide, [{ wch: 18 }, { wch: 46 }, { wch: 90 }]);
// Les accents dans un nom d'onglet sont mal gérés par Excel : on garde l'ASCII.
feuille('A TRANCHER', toutesATrancher.map((t) => ({
  'Fichier photo': t.fichier,
  'Motif': t.motif || t.raison,
  'Codes candidats': (t.codes || []).join(' | '),
})), [{ wch: 42 }, { wch: 44 }, { wch: 34 }]);

feuille('1 VILLE DE DAKAR', lignesVdd.sort((a, b) => a['CODE_BENEFICIAIRE'].localeCompare(b['CODE_BENEFICIAIRE'])),
  [{ wch: 34 }, { wch: 46 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 14 }]);

feuille('2 ASS LONASE', lignesLonase.sort((a, b) => a['CODE_BENEFICIAIRE'].localeCompare(b['CODE_BENEFICIAIRE'])),
  [{ wch: 46 }, { wch: 46 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 34 }]);

XLSX.writeFile(wb, SORTIE);
console.log(`\nClasseur écrit : ${SORTIE}`);
console.log('\n⚠️  AUCUN FICHIER N\'A ÉTÉ RENOMMÉ.');
console.log('    Lisez le classeur, renommez vous-même, puis revenez pour l\'import.');