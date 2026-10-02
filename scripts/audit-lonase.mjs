/**
 * ═══════════════════════════════════════════════════════════════
 *  AUDIT « ASS LONASE » — rapprochement Excel ↔ photos ↔ registre
 * ═══════════════════════════════════════════════════════════════
 *  Usage :  node scripts/audit-lonase.mjs
 *  Lecture seule : n'écrit rien.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = process.env.LONASE_XLSX || 'C:/Users/hp/Downloads/ASS LONASE.xlsx';
const PHOTO_DIR = process.env.LONASE_PHOTOS || join(ROOT, 'ASS LONASE');

/* Normalisation identique à l'import : casse, accents et séparateurs ignorés */
const norm = (v) =>
  String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '').toUpperCase();

const IMG = /\.(jpe?g|png|webp|bmp|gif)$/i;

/** Découpe un nom complet : le DERNIER mot est le patronyme
 *  (convention sénégalaise). « ELHADJI MALICK FALL » → ELHADJI MALICK / FALL */
const splitFullName = (full) => {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { prenom: parts[0] || '', nom: '' };
  return { prenom: parts.slice(0, -1).join(' '), nom: parts[parts.length - 1] };
};

if (!existsSync(XLSX_PATH)) {
  console.error(`❌ Excel introuvable : ${XLSX_PATH}`);
  console.error('   Variable d\'environnement LONASE_XLSX pour forcer le chemin.');
  process.exit(1);
}
if (!existsSync(PHOTO_DIR)) {
  console.error(`❌ Dossier photos introuvable : ${PHOTO_DIR}`);
  console.error('   Variable d\'environnement LONASE_PHOTOS pour forcer le chemin.');
  process.exit(1);
}

const XLSX = require('xlsx');
const wb = XLSX.readFile(XLSX_PATH);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
const photos = readdirSync(PHOTO_DIR).filter((f) => IMG.test(f));

console.log('═'.repeat(78));
console.log(`EXCEL   : ${XLSX_PATH}`);
console.log(`FEUILLE : ${wb.SheetNames[0]}`);
console.log(`LIGNES  : ${rows.length}`);
console.log(`COLONNES: ${Object.keys(rows[0] || {}).join(' | ')}`);
console.log(`PHOTOS  : ${photos.length}`);
console.log('═'.repeat(78));

/* ── Index des photos par CODE BÉNÉFICIAIRE ───────────────────────────── */
const photoByCode = new Map();
for (const f of photos) {
  const m = f.match(/^(DKR[_\-]?\d+)/i);
  if (!m) continue;
  const code = m[1].toUpperCase().replace(/[_\-]/g, '_');
  const namePart = f.replace(/\.[^.]+$/, '').replace(/^DKR[_\-]?\d+(\.\d+)?[\s_]*/i, '').trim();
  if (!photoByCode.has(code)) photoByCode.set(code, { files: [], name: namePart });
  photoByCode.get(code).files.push(f);
}

/* ── Extraction code + nom depuis l'Excel ──────────────────────────────── */
/* Recherche de colonne en deux passes — même logique que bulkImport.js :
 * 1) correspondance EXACTE  2) correspondance partielle.
 * Indispensable : « PRENOM_BENEFICIAIRE » contient la sous-chaîne
 * « NOM_BENEFICIAIRE », et une recherche naïve renvoie le prénom comme nom. */
const pick = (row, pats) => {
  const keys = Object.keys(row || {});
  const nk = keys.map((k) => norm(k));
  const np = pats.map((p) => norm(p));
  for (let i = 0; i < np.length; i++) {
    const idx = nk.indexOf(np[i]);
    if (idx !== -1) return String(row[keys[idx]] ?? '');
  }
  for (let i = 0; i < np.length; i++) {
    for (let j = 0; j < nk.length; j++) {
      if (nk[j] && nk[j].includes(np[i])) return String(row[keys[j]] ?? '');
    }
  }
  return '';
};

const excelRows = rows.map((r, i) => {
  const rawCode = pick(r, ['CODE_BENEFICIAIRE', 'CODEBENEF', 'NUMEROCARTE', 'CODE']);
  const code = rawCode.toUpperCase().replace(/[_\-]/g, '_').trim();
  const baseCode = code.split('.')[0];
  const fullName = pick(r, ['NOM', 'NOMS ET PRENOM', 'IDENTITE', 'NOMCOMPLET']);
  let prenom = pick(r, ['PRENOM', 'FIRST']);
  let nom = pick(r, ['NOMFAMILLE', 'NOMDE', 'LASTNAME']);
  if (!prenom || !nom) {
    const s = splitFullName(fullName);
    prenom = prenom || s.prenom;
    nom = nom || s.nom;
  }
  return { line: i + 2, code, baseCode, fullName, prenom, nom };
});

const sep = (t) => console.log(`\n▶ ${t}`);

sep('1. DOUBLONS DE PHOTOS (même code, plusieurs fichiers)');
let dups = 0;
for (const [code, v] of [...photoByCode].sort()) {
  if (v.files.length > 1) {
    dups++;
    console.log(`  ⚠ ${code} → ${v.files.length} fichiers`);
    v.files.forEach((f) => console.log(`      · ${f}`));
  }
}
if (!dups) console.log('  ✓ aucun doublon');

sep('2. LIGNES EXCEL SANS PHOTO');
let sansPhoto = 0;
for (const r of excelRows) {
  if (!r.baseCode) { sansPhoto++; console.log(`  ⚠ ligne ${r.line} : code vide`); continue; }
  if (!photoByCode.has(r.baseCode)) { sansPhoto++; console.log(`  ⚠ ${r.baseCode} — ${r.prenom} ${r.nom}`); }
}
if (!sansPhoto) console.log('  ✓ toutes les lignes ont une photo');

sep('3. PHOTOS SANS LIGNE EXCEL');
const excelCodes = new Set(excelRows.map((r) => r.baseCode).filter(Boolean));
const orph = [...photoByCode].filter(([code]) => !excelCodes.has(code));
orph.forEach(([code, v]) => console.log(`  ⚠ ${code} — ${v.files[0]}`));
if (!orph.length) console.log('  ✓ aucune photo orpheline');

sep('4. NOMS DIVERGENTS EXCEL ↔ PHOTO (cause du bug « Nom : ELHADJI »)');
let div = 0;
for (const r of excelRows) {
  const photo = r.baseCode ? photoByCode.get(r.baseCode) : null;
  if (!photo) continue;
  const s = splitFullName(photo.name);
  if (norm(r.nom) && norm(s.nom) && norm(r.nom) !== norm(s.nom)) {
    div++;
    console.log(`  ⚠ ${r.baseCode}`);
    console.log(`      Excel : ${r.prenom} ${r.nom}`);
    console.log(`      Photo : ${s.prenom} ${s.nom}`);
  }
}
if (!div) console.log('  ✓ aucun écart de patronyme');

sep('5. DÉCOUPAGE PRÉNOM / NOM (contrôle du parseur)');
let ko = 0;
for (const r of excelRows.slice(0, 10)) {
  const bad = !r.nom || !r.prenom;
  if (bad) ko++;
  console.log(`${bad ? '  ⚠' : '  ✓'} ${r.baseCode} → prénom="${r.prenom}" nom="${r.nom}"`);
}
if (ko) console.log(`  ⚠ ${ko} ligne(s) sur 10 incomplètes`);

console.log('\n' + '═'.repeat(78));
console.log('FIN DU RAPPORT');
