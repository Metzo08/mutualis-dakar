/**
 * Convertit « ASS LONASE.xlsx » en fichier TEXTE lisible (.csv) afin que le
 * contenu puisse être inspecté ligne par ligne. Un .xlsx est un ZIP binaire :
 * seul un CSV permet la relecture et la comparaison avec les noms de fichiers
 * photo.
 *
 * Usage :  node scripts/lonase-to-csv.mjs
 * Sortie : LONASE_dump.csv  (à la racine du projet)
 */
import { createRequire } from 'node:module';
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.LONASE_XLSX || 'C:/Users/hp/Downloads/ASS LONASE.xlsx';
const OUT = process.env.LONASE_OUT || join(ROOT, 'LONASE_dump.csv');

if (!existsSync(SRC)) {
  console.error('❌ Excel introuvable : ' + SRC);
  process.exit(1);
}

const XLSX = require('xlsx');
const wb = XLSX.readFile(SRC);
const lines = [];

lines.push('# Fichier   : ' + SRC);
lines.push('# Feuilles  : ' + wb.SheetNames.join(' | '));
lines.push('');

for (const name of wb.SheetNames) {
  const sh = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sh, { defval: '' });
  const cols = rows.length ? Object.keys(rows[0]) : [];
  lines.push('===== FEUILLE : ' + name + ' (' + rows.length + ' ligne(s)) =====');
  lines.push('COLONNES: ' + cols.join(' | '));
  lines.push('');
  rows.forEach((r, i) => {
    lines.push('L' + (i + 2) + ': ' + cols.map((c) => (r[c] === undefined ? '' : String(r[c]))).join(' ; '));
  });
  lines.push('');
}

writeFileSync(OUT, lines.join('\n'), 'utf8');
console.log('✅ Fichier texte écrit : ' + OUT);
console.log('   ' + lines.length + ' lignes — ouvrez-le ou collez son contenu.');
