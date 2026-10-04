/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CLASSEUR GRAND YOFF PRÊT À IMPORTER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * OBJECTIF
 * Remplacer la colonne CODE_BENEFICIAIRE du classeur source par les matricules
 * `DKR-DKR-2026-N.R` calculés dans GRAND-YOFF-CODES.xlsx.
 *
 * POURQUOI
 * Le Studio conserve le code du FICHIER (mode FILE) — c'est la règle du
 * projet : le code est celui gravé sur le PVC. Or les 154 cartes Grand Yoff
 * doivent être réimprimées avec les nouveaux matricules : il faut donc que le
 * classeur porte ces matricules, sans quoi l'import réinstallerait les anciens
 * codes et il faudrait lever le garde-fou de l'interface.
 *
 * SÛRETÉ
 *   • le fichier SOURCE n'est jamais modifié : la sortie est un nouveau classeur ;
 *   • les AUTRES colonnes sont copiées à l'identique (aucune donnée perdue) ;
 *   • une fiche sans correspondance est signalée, jamais codée au hasard ;
 *   • les lignes vides du tableur sont conservées telles quelles.
 *
 * Usage :
 *   node backend/preparer-yoff-import.cjs            (simulation)
 *   node backend/preparer-yoff-import.cjs --apply    (écriture)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');

const SOURCE = 'C:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx';
const CODES = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/GRAND-YOFF-CODES.xlsx';
const SORTIE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD de Grand Yoff.xlsx';
const APPLY = process.argv.includes('--apply');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

if (!fs.existsSync(SOURCE)) { console.log(`Source absente : ${SOURCE}`); process.exit(1); }

const wbSrc = XLSX.readFile(SOURCE, { cellDates: true });
const feuilleSrc = wbSrc.SheetNames[0];
const lignesSrc = XLSX.utils.sheet_to_json(wbSrc.Sheets[feuilleSrc], { defval: '' });
console.log(`Source : ${lignesSrc.length} lignes`);

const wbCod = XLSX.readFile(CODES);
const codes = XLSX.utils.sheet_to_json(wbCod.Sheets.CODES, { defval: '' });
const parAncien = new Map();
codes.forEach((r) => {
  const a = clean(r['Ancien code']).toUpperCase();
  if (a) parAncien.set(a, clean(r['Code final']).toUpperCase());
});
console.log(`Correspondances : ${parAncien.size}`);

// ── Application, ligne par ligne ────────────────────────────────────────
// Un code RÉPÉTÉ dans le fichier (22 cas) décrivait la même personne sur
// plusieurs lignes. On n'en garde qu'UNE — la plus riche — sinon la même
// personne apparaîtrait plusieurs fois avec le même matricule.
const richesse = (r) => Object.values(r || {}).filter((v) => clean(v)).length;
const plusRiche = (a, b) => (richesse(b) > richesse(a) ? b : a);
const meilleureParCode = new Map();
lignesSrc.forEach((r, i) => {
  const c = clean(r.CODE_BENEFICIAIRE).toUpperCase();
  if (!c) return;
  const precedent = meilleureParCode.get(c);
  if (!precedent) meilleureParCode.set(c, { r, i });
  else if (richesse(r) > richesse(precedent.r)) meilleureParCode.set(c, { r, i });
});

const sorties = [];
let recodes = 0;
let sansCode = 0;
let doublonsIgnores = 0;
const poses = new Set();

lignesSrc.forEach((r, i) => {
  const copie = { ...r };
  const ancien = clean(r.CODE_BENEFICIAIRE).toUpperCase();

  if (!ancien) { sansCode += 1; sorties.push(copie); return; }

  // Doublon strict : ligne déjà traitée pour ce code → on l'écarte.
  const gagnante = meilleureParCode.get(ancien);
  if (gagnante && gagnante.i !== i) {
    doublonsIgnores += 1;
    copie.CODE_BENEFICIAIRE = '';
    sorties.push(copie);
    return;
  }

  const nouveau = parAncien.get(ancien);
  if (!nouveau) { sorties.push(copie); return; }
  copie.CODE_BENEFICIAIRE = nouveau;
  // NUMERO_ADHERENT garde sa valeur D'ORIGINE (`DKR_010126`) : c'est un
  // identifiant administratif du fichier source, pas un matricule. Lui donner
  // le nouveau code créait deux colonnes au même sens, ambiguës à la lecture.
  // Le regroupement en ménage se fait sur la BASE de CODE_BENEFICIAIRE.
  recodes += 1;
  poses.add(nouveau);
  sorties.push(copie);
});

// Richeur mémorisée : évite de la recalculer à chaque comparaison.
function richer(r) { return richesse(r); }

console.log('\n=== RESULTAT ===');
console.log(`  lignes recodees             : ${recodes}`);
console.log(`  codes distincts poses       : ${poses.size}`);
console.log(`  doublons ignores (meme code): ${doublonsIgnores}`);
console.log(`  lignes vides conservees     : ${sansCode}`);

console.log('\n=== APERCU ===');
sorties.filter((r) => clean(r.CODE_BENEFICIAIRE)).slice(0, 8).forEach((r) => {
  console.log(`  ${String(r.CODE_BENEFICIAIRE).padEnd(22)} adherent=${String(r.NUMERO_ADHERENT).padEnd(20)} ${clean(r.PRENOM_BENEFICIAIRE)} ${clean(r.NOM_BENEFICIAIRE)}`);
});

// ── Contrôles ───────────────────────────────────────────────────────────
const posesListe = sorties.map((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase()).filter(Boolean);
const uniques = new Set(posesListe).size === posesListe.length;
const formatOk = posesListe.every((c) => /^DKR-DKR-2026-\d{4}\.\d+$/.test(c));
console.log('\n=== CONTROLES ===');
console.log(`  codes uniques           : ${uniques ? 'OUI' : 'NON — COLLISION'}`);
console.log(`  format DKR-DKR-2026-N.R : ${formatOk ? 'OUI' : 'NON'}`);
console.log(`  fiches avec code        : ${posesListe.length}`);

if (!APPLY) {
  console.log('\nSIMULATION — aucun fichier ecrit. Relancez avec --apply.');
  return;
}

const ws = XLSX.utils.json_to_sheet(sorties);
ws['!cols'] = Object.keys(lignesSrc[0] || {}).map((c) => ({ wch: Math.min(26, c.length + 4) }));
const classeur = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(classeur, ws, wbSrc.SheetNames[0]);
XLSX.writeFile(classeur, SORTIE);
console.log(`\nClasseur ecrit : ${SORTIE}`);
console.log(`  ${recodes} fiches recodees, ${posesListe.length} avec code.`);
console.log(`  ${doublonsIgnores} doublons ignores (meme personne, code repete).`);
console.log('\n  Le fichier SOURCE est intact.');