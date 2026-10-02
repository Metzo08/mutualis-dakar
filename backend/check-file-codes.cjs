/**
 * Contrôle des CODES CMU présents dans les fichiers Excel.
 *
 * Ces fichiers sont la source de vérité : le code qu'ils portent est celui
 * gravé sur la carte DÉJÀ IMPRIMÉE. Il doit donc être repris tel quel par
 * l'import, jamais recalculé.
 *
 * Vérifie pour chaque fichier :
 *  - le nombre de codes et leur format ;
 *  - la présence des suffixes .0/.1/.2 (structure du ménage) ;
 *  - les codes absents ou atypiques qui pourraient être écartés à l'import.
 *
 * Usage : node backend/check-file-codes.cjs
 */
const XLSX = require('xlsx');

const SOURCES = [
  { file: 'c:/Users/hp/Downloads/AMEVI.xlsx', label: 'Ville de Dakar (AMEVI)' },
  { file: 'c:/Users/hp/Downloads/ASS LONASE.xlsx', label: 'ASS LONASE' },
  { file: 'c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx', label: 'MSD de Grand Yoff' }
];

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

for (const s of SOURCES) {
  const wb = XLSX.readFile(s.file, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const withCode = rows.filter((r) => clean(r.CODE_BENEFICIAIRE));

  const titulaires = withCode.filter((r) => !/\.[1-9]\d*$/.test(clean(r.CODE_BENEFICIAIRE)));
  const ayants = withCode.filter((r) => /\.[1-9]\d*$/.test(clean(r.CODE_BENEFICIAIRE)));

  console.log(`\n=== ${s.label} ===`);
  console.log(`  lignes totales               : ${rows.length}`);
  console.log(`  lignes AVEC code             : ${withCode.length}`);
  console.log(`    dont titulaires (.0)       : ${titulaires.length}`);
  console.log(`    dont ayants droit          : ${ayants.length}`);

  // Format des codes : c'est ce que l'import doit reproduire à l'identique.
  const formats = new Map();
  withCode.forEach((r) => {
    const f = clean(r.CODE_BENEFICIAIRE).replace(/\d/g, '#');
    formats.set(f, (formats.get(f) || 0) + 1);
  });
  console.log('  formats rencontres          :');
  [...formats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .forEach(([f, n]) => console.log(`     ${f.padEnd(22)} x${n}`));

  // Codes atypiques : préfixe inattendu ou longueur anormale.
  const atypiques = withCode.filter((r) =>
    !/^[A-Z]{2,4}[-_][A-Za-z0-9]+(\.\d+)?$/.test(clean(r.CODE_BENEFICIAIRE)));
  console.log(`  codes atypiques             : ${atypiques.length}`);
  atypiques.slice(0, 5).forEach((r) => console.log(`     ${JSON.stringify(clean(r.CODE_BENEFICIAIRE))}`));

  // Ménages : un ayants droit dont le titulaire n'est pas dans le même fichier.
  const titBases = new Set(titulaires.map((r) =>
    clean(r.CODE_BENEFICIAIRE).replace(/\.\d+$/, '').toUpperCase()));
  const bases = new Set(withCode.map((r) =>
    clean(r.CODE_BENEFICIAIRE).replace(/\.\d+$/, '').toUpperCase()));
  const orphelins = [...bases].filter((b) => !titBases.has(b));
  console.log(`  menages distincts            : ${bases.size}`);
  console.log(`  sans titulaire dans le fichier: ${orphelins.length}`);
  if (orphelins.length) console.log(`     ex. ${orphelins.slice(0, 4).join(', ')}`);

  console.log(`  exemples                    : ${withCode.slice(0, 4).map((r) => clean(r.CODE_BENEFICIAIRE)).join(' | ')}`);
}