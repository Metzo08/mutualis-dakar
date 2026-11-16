/* Diagnostic ASS LONASE : fiches sans photo vs fichiers du dossier */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE';

(async () => {
  // 1. Fiches LONASE sans photo (par lot)
  const sansPhoto = await query(
    "SELECT lot_code, count(*) n FROM beneficiaries WHERE merged_into IS NULL AND msd_code='DKR' AND (photo_url IS NULL OR photo_url='') AND (cmu_number LIKE 'DKR\\_26%' OR last_name ILIKE ANY(ARRAY['%'])) GROUP BY 1 ORDER BY 1"
  );
  // mieux : les fiches dont le code ressemble aux photos LONASE
  const fiches = await query(
    "SELECT cmu_number, first_name, last_name, birth_date, lot_code, numero_adherent FROM beneficiaries WHERE merged_into IS NULL AND cmu_number LIKE 'DKR\\_26%' AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number"
  );
  console.log(`Fiches DKR_26* sans photo : ${fiches.rows.length}`);
  const fichiers = new Set(fs.readdirSync(DIR).map((f) => f.replace(/\.(jpe?g|png|webp)$/i, '')));

  let matchCode = 0, nomatch = [];
  for (const f of fiches.rows) {
    if (fichiers.has(f.cmu_number)) matchCode++;
    else nomatch.push(f);
  }
  console.log(`  avec fichier de même code : ${matchCode}`);
  console.log(`  sans fichier              : ${nomatch.length}`);
  nomatch.slice(0, 30).forEach((x) => console.log(`    ${x.cmu_number} ${x.first_name} ${x.last_name} ${x.birth_date} lot=${x.lot_code}`));

  // 2. Fichiers jamais utilisés
  const utilises = new Set(fiches.rows.map((x) => x.cmu_number));
  const inutilises = [...fichiers].filter((f) => !utilises.has(f) && /^DKR_26/.test(f));
  console.log(`\nFichiers codes jamais rattachés : ${inutilises.length}`);
  inutilises.slice(0, 20).forEach((f) => console.log('   ', f));

  // 3. Fiches LOT-2026-011 / 015 sans photo (autres schémas de code ?)
  const autres = await query("SELECT DISTINCT lot_code FROM beneficiaries WHERE merged_into IS NULL AND cmu_number NOT LIKE 'DKR\\_26%' AND msd_code='DKR'");
  console.log('\nAutres formats de code (msd DKR) :', autres.rows.map((r) => r.lot_code).join(', '));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
