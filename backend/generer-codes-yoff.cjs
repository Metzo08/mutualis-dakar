/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CODES GRAND YOFF — numérotation continue par ménage
 * ═══════════════════════════════════════════════════════════════════════
 *
 * DÉCISION DE L'AGENT
 * Toutes les fiches reçoivent un matricule `DKR-DKR-2026-<adhérent>.<rang>`.
 * Un numéro d'adhérent par MÉNAGE, attribué dans l'ordre du fichier :
 *   2151  MAFOU DIEDHIOU        → .1
 *   2152  BABACAR DIOP          → .1
 *   …
 *   2178  ABDOULAYE DIOUF
 * Le rang repart à .1 : l'adhérent est .1, son 1ᵉʳ bénéficiaire .2, etc.
 *
 * ⚠️ Conséquence assumée : les 28 cartes DÉJÀ IMPRIMÉES changent de code.
 * Elles devront être réimprimées, sans quoi le scan ne les retrouvera pas.
 *
 * DÉDOUBLONNAGE : un code répété dans le fichier conserve la ligne la plus
 * riche — une personne, une fiche, jamais deux.
 *
 * Usage : node backend/generer-codes-yoff.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');

const SOURCE = 'C:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx';
const SORTIE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/GRAND-YOFF-CODES.xlsx';
const NB_IMPRIMEES = 28;
const ADHERENT_DEPART = 2151;

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

const wb = XLSX.readFile(SOURCE, { cellDates: true });
const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
  .filter((r) => clean(r.CODE_BENEFICIAIRE));

// ── Dédoublonnage : la ligne la plus riche gagne ────────────────────────
const richesse = (r) => Object.values(r || {}).filter((v) => clean(v)).length;
const parCode = new Map();
lignes.forEach((r) => {
  const c = clean(r.CODE_BENEFICIAIRE).toUpperCase();
  if (!parCode.has(c) || richesse(r) > richesse(parCode.get(c))) parCode.set(c, r);
});

// ── Familles : le code sans rang identifie un ménage ─────────────────────
const familles = new Map();
[...parCode.entries()].forEach(([code, r]) => {
  const base = code.replace(/\.\d+$/, '');
  if (!familles.has(base)) familles.set(base, []);
  familles.get(base).push({ code, r });
});

console.log(`Personnes : ${parCode.size}   Familles : ${familles.size}`);
console.log('Tous les codes sont regénérés (aucun ancien code conservé).\n');

const resultat = [];
let adherentCourant = ADHERENT_DEPART;

// Un numéro d'adhérent par ménage, dans l'ordre du fichier : MAFOU en premier.
[...familles.entries()].forEach(([base, membres]) => {
  const adherent = adherentCourant;
  adherentCourant += 1;
  membres
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .forEach(({ code, r }, j) => {
      resultat.push({
        'Code final': `DKR-DKR-2026-${adherent}.${j + 1}`,
        'Ancien code': code,
        'Code adherent': `DKR-DKR-2026-${adherent}`,
        'Rang': j + 1,
        'Prenom': clean(r.PRENOM_BENEFICIAIRE),
        'Nom': clean(r.NOM_BENEFICIAIRE),
        'Telephone': clean(r.CONTACT) || '—',
        'NIN': clean(r.NIN) || '—',
        'Origine': 'NOUVEAU CODE SYSTEME',
      });
    });
});

console.log(`  ${resultat.length} fiches codées\n`);

// ── CONTRÔLES ───────────────────────────────────────────────────────────
const finaux = resultat.map((r) => r['Code final']);
const sys = finaux.filter((c) => /^DKR-DKR-2026-\d{4}\.\d+$/.test(c));
const nums = sys.map((c) => Number(c.split('-')[3]));

console.log('=== CONTROLES ===');
console.log(`  fiches                  : ${finaux.length}`);
console.log(`  codes uniques           : ${new Set(finaux).size === finaux.length ? 'OUI' : 'NON — COLLISION'}`);
console.log(`  format DKR-DKR-2026-N.R : ${sys.length}/${finaux.length}`);
console.log(`  adherent de depart      : ${ADHERENT_DEPART}`);
console.log(`  adherent final          : ${adherentCourant - 1}`);
console.log(`  sequence continue       : ${(Math.max(...nums) - Math.min(...nums) + 1) === familles.size ? 'OUI' : 'NON'}`);

// Les points de contrôle demandés par l'agent.
const chercher = (pred) => resultat.find(pred);
const mafou = chercher((r) => /MAFOU/i.test(r.Prenom));
const babacar = chercher((r) => /BABACAR/i.test(r.Prenom) && /DIOP/i.test(r.Nom));
const abdoulaye = chercher((r) => /ABDOULAYE/i.test(r.Prenom) && /DIOUF/i.test(r.Nom));
console.log('\n=== POINTS DE CONTROLE ===');
console.log(`  MAFOU DIEDHIOU      : ${mafou ? mafou['Code final'] : '(absent)'}`);
console.log(`  BABACAR DIOP        : ${babacar ? babacar['Code final'] : '(absent)'}`);
console.log(`  ABDOULAYE DIOUF     : ${abdoulaye ? abdoulaye['Code final'] : '(absent)'}`);

console.log('\n=== LES 28 PREMIERES ===');
resultat.slice(0, NB_IMPRIMEES).forEach((r, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${r['Code final'].padEnd(22)} ${r.Prenom} ${r.Nom}`);
});

console.log('\n=== MENAGES A PLUSIEURS BENEFICIAIRES ===');
const parAdherent = new Map();
resultat.forEach((r) => {
  const a = r['Code adherent'];
  if (!parAdherent.has(a)) parAdherent.set(a, []);
  parAdherent.get(a).push(r);
});
[...parAdherent.values()].filter((l) => l.length > 1).forEach((l) => {
  console.log(`  ${l[0]['Code adherent']}`);
  l.forEach((r) => console.log(`      ${r['Code final']}  ${r.Prenom} ${r.Nom}`));
});

const ws = XLSX.utils.json_to_sheet(resultat);
ws['!cols'] = Object.keys(resultat[0]).map((c) => ({ wch: Math.min(26, c.length + 6) }));
const classeur = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(classeur, ws, 'CODES');
XLSX.writeFile(classeur, SORTIE);
console.log(`\nClasseur écrit : ${SORTIE}`);