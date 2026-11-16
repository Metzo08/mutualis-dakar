/* ASS LONASE : classeur vs base vs fichiers */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const XLSX = require('xlsx');
const { query, pool } = require('./db');
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

(async () => {
  const wb = XLSX.readFile('C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE.xlsx', { cellDates: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  const lignes = XLSX.utils.sheet_to_json(sh, { defval: '' });
  console.log('Feuille :', wb.SheetNames[0], '| colonnes :', Object.keys(lignes[0] || {}).join(', '));
  console.log('Lignes :', lignes.length);

  // Codes du classeur
  const colCode = Object.keys(lignes[0] || {}).find((k) => /CODE/i.test(k));
  console.log('Colonne code :', colCode);
  const codesClasseur = new Set();
  lignes.forEach((r) => { const c = clean(r[colCode]).toUpperCase(); if (c) codesClasseur.add(c); });
  console.log('Codes distincts :', codesClasseur.size);

  // Base : fiches sans photo des lots 011/015
  const fiches = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code, numero_adherent FROM beneficiaries WHERE merged_into IS NULL AND lot_code IN ('LOT-2026-011','LOT-2026-015') AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number");
  let dansClasseur = 0;
  const echantillon = fiches.rows.slice(0, 15);
  echantillon.forEach((f) => {
    const present = codesClasseur.has(String(f.cmu_number).toUpperCase());
    const numAd = codesClasseur.has(String(f.numero_adherent).toUpperCase());
    if (present || numAd) dansClasseur++;
    console.log(`  ${f.cmu_number} ${f.first_name} ${f.last_name} née=${f.birth_date} lot=${f.lot_code} | classeur: code=${present} numAdh=${numAd}`);
  });
  console.log('\nÉchantillon présents au classeur :', dansClasseur, '/', echantillon.length);

  // fichiers LONASE : lister les codes
  const fsx = fs.readdirSync('C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE');
  const codesFichiers = fsx.map((f) => (f.match(/^(DKR_26\d+\.?\d*)/) || [])[1]).filter(Boolean).map((c) => c.toUpperCase());
  console.log('Fichiers photos :', fsx.length, '| avec code :', codesFichiers.length);

  // Combien de codes fichiers présents dans la base (avec ou sans photo) ?
  for (const c of codesFichiers.slice(0, 12)) {
    const b = await query("SELECT cmu_number, first_name, last_name, photo_url IS NOT NULL AND photo_url<>'' AS photo, lot_code FROM beneficiaries WHERE UPPER(cmu_number)=$1", [c]);
    console.log('   fichier', c, '->', b.rows[0] ? `${b.rows[0].first_name} ${b.rows[0].last_name} photo=${b.rows[0].photo} lot=${b.rows[0].lot_code}` : 'ABSENT DE LA BASE');
  }
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
