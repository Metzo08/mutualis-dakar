/**
 * Inspecte la structure d'un classeur Excel sans rien écrire en base.
 * Sert à identifier les colonnes porteuses du CODE CMU RÉEL — le code figurant
 * sur la carte déjà imprimée, qui n'a rien à voir avec les codes
 * `DKR-DKR-2026-…` générés par le système.
 *
 * Usage : node backend/inspect-excel.cjs <chemin.xlsx> [autre...]
 */
const XLSX = require('xlsx');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage : node backend/inspect-excel.cjs <fichier.xlsx> [...]');
  process.exit(1);
}

for (const f of files) {
  console.log(`\n${'='.repeat(78)}\n${path.basename(f)}\n${'='.repeat(78)}`);
  let wb;
  try {
    wb = XLSX.readFile(f, { cellDates: true });
  } catch (e) {
    console.log(`  ERREUR de lecture : ${e.message}`);
    continue;
  }

  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    console.log(`\n  FEUILLE « ${name} » : ${rows.length} ligne(s)`);
    if (rows.length === 0) return;

    const cols = Object.keys(rows[0]);
    console.log(`  COLONNES (${cols.length}) :`);
    cols.forEach((c) => console.log(`     - ${c}`));

    console.log(`  PREMIÈRE LIGNE :`);
    rows.slice(0, 2).forEach((r, i) => {
      const filled = cols
        .map((c) => `${c}=${JSON.stringify(String(r[c]).slice(0, 42))}`)
        .filter((s) => !/:""$/.test(s));
      console.log(`     #${i + 1} ${filled.join(' | ')}`);
    });
  });
}