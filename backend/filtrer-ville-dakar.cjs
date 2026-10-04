/**
 * ═══════════════════════════════════════════════════════════════════════
 *  FILTRAGE DU CLASSEUR VILLE DE DAKAR
 * ═══════════════════════════════════════════════════════════════════════
 *
 * POURQUOI
 * `MSD DAKAR\AMEVI.xlsx` compte 314 lignes, dont les 122 assurés d'ASS LONASE
 * (mêmes noms, mêmes dates de naissance, mêmes téléphones ET mêmes NIN).
 * L'importer tel quel créerait les fiches ASS LONASE dans le lot Ville de
 * Dakar, puis l'import ASS LONASE les recréerait : doublons et photos mélangées.
 *
 * CE QUE FAIT CE SCRIPT
 * Il retire les lignes dont le code figure dans `ASS LONASE.xlsx` — sur le
 * CODE, puis recoupé par l'IDENTITÉ (nom + naissance + NIN). Une ligne ne
 * survit que si elle n'appartient à personne d'ASS LONASE.
 *
 * Il n'invente rien et ne modifie aucune donnée : il produit un classeur
 * Ville de Dakar filtré, à vérifier par l'agent.
 *
 * Usage :
 *   node backend/filtrer-ville-dakar.cjs            (simulation)
 *   node backend/filtrer-ville-dakar.cjs --apply    (écrit le classeur)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');

const SOURCE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/AMEVI.xlsx';
const ASS_LONASE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE.xlsx';
const SORTIE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/AMEVI-VILLE-DE-DAKAR.xlsx';

const APPLY = process.argv.includes('--apply');
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (s) => clean(s).toUpperCase().replace(/[^A-Z]/g, '');
const dateIso = (v) => (v instanceof Date && !Number.isNaN(v.getTime())
  ? v.toISOString().slice(0, 10)
  : clean(v).slice(0, 10));

const lire = (f) => {
  const wb = XLSX.readFile(f, { cellDates: true });
  return { noms: wb.SheetNames, lignes: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }) };
};

/** Identité stable d'une personne : NIN sinon nom + naissance. */
const identite = (r) => {
  const nin = norm(r.NIN);
  if (nin && nin !== 'EXTNASSAANCE' && nin.length >= 8) return `nin:${nin}`;
  return `nom:${norm(r.PRENOM_BENEFICIAIRE)}${norm(r.NOM_BENEFICIAIRE)}|${dateIso(r.DATE_NAISSANCE)}`;
};

const src = lire(SOURCE);
const lon = lire(ASS_LONASE);

const codesLonase = new Set();
const identitesLonase = new Set();
lon.lignes.filter((r) => clean(r.CODE_BENEFICIAIRE)).forEach((r) => {
  codesLonase.add(clean(r.CODE_BENEFICIAIRE).toUpperCase());
  identitesLonase.add(identite(r));
});

console.log(`Source       : ${path.basename(SOURCE)} — ${src.lignes.length} lignes`);
console.log(`ASS LONASE   : ${lon.lignes.filter((r) => clean(r.CODE_BENEFICIAIRE)).length} codes\n`);

const gardes = [];
const retirees = { code: [], identite: [] };
src.lignes.forEach((r) => {
  const code = clean(r.CODE_BENEFICIAIRE).toUpperCase();
  // Une ligne SANS code n'appartient à personne : elle reste.
  if (!code) { gardes.push(r); return; }
  if (codesLonase.has(code)) { retirees.code.push(r); return; }
  // Filet supplémentaire : même identité, code différent (erreur de saisie).
  if (identitesLonase.has(identite(r))) { retirees.identite.push(r); return; }
  gardes.push(r);
});

console.log('=== RESULTAT DU FILTRAGE ===');
console.log(`  lignes conservées (Ville de Dakar) : ${gardes.length}`);
console.log(`  retirées — code ASS LONASE          : ${retirees.code.length}`);
console.log(`  retirées — identité ASS LONASE      : ${retirees.identite.length}`);

// Contrôle : aucune ligne conservée ne doit appartenir à ASS LONASE.
const fuite = gardes.filter((r) => codesLonase.has(clean(r.CODE_BENEFICIAIRE).toUpperCase())
  || identitesLonase.has(identite(r)));
console.log(`\n  FUITES vers ASS LONASE : ${fuite.length}`);
if (fuite.length) fuite.slice(0, 5).forEach((r) => console.log(`      ${clean(r.CODE_BENEFICIAIRE)}`));

const codesGardes = gardes.map((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase()).filter(Boolean);
console.log(`  codes distincts conservés : ${new Set(codesGardes).size}`);
console.log(`  sans code                 : ${gardes.filter((r) => !clean(r.CODE_BENEFICIAIRE)).length}`);

console.log('\n=== EXEMPLE DE LIGNES RETIREES ===');
retirees.code.slice(0, 5).forEach((r) => console.log(
  `  ${clean(r.CODE_BENEFICIAIRE).padEnd(16)} ${clean(r.PRENOM_BENEFICIAIRE)} ${clean(r.NOM_BENEFICIAIRE)}`));
retirees.identite.slice(0, 5).forEach((r) => console.log(
  `  [identite] ${clean(r.CODE_BENEFICIAIRE).padEnd(12)} ${clean(r.PRENOM_BENEFICIAIRE)} ${clean(r.NOM_BENEFICIAIRE)}`));

if (!APPLY) {
  console.log('\nSIMULATION — aucun classeur écrit. Relancez avec --apply.');
  return;
}
if (fuite.length) {
  console.log('\nÉCRITURE REFUSÉE : des lignes ASS LONASE subsistent.');
  return;
}

const ws = XLSX.utils.json_to_sheet(gardes);
ws['!cols'] = Object.keys(src.lignes[0] || {}).map((c) => ({ wch: Math.min(34, c.length + 4) }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'VILLE DE DAKAR');
XLSX.writeFile(wb, SORTIE);
console.log(`\nClasseur écrit : ${SORTIE}`);
console.log(`  ${gardes.length} lignes — aucun assuré ASS LONASE.`);