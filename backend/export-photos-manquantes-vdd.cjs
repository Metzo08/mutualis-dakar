/* ═══════════════
   EXPORT LISTE DE COLLECTE — 15 fiches lot 030 sans photo (décision Ahmed Tall :
   laisser sans photo + relancer une collecte auprès de la MSD).
   Génère lot-030-photos-manquantes.csv (sémicolons, Excel FR) + .json,
   trié par ménage, pour impression / tournée terrain.
   AUCUNE écriture en base — lecture seule.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

(async () => {
  const res = await query(`
    SELECT cmu_number, first_name, last_name, birth_date,
           split_part(cmu_number, '.', 1) AS menage
    FROM beneficiaries
    WHERE merged_into IS NULL AND lot_code='LOT-2026-030'
      AND (photo_url IS NULL OR photo_url='')
    ORDER BY menage, cmu_number
  `);

  if (res.rows.length === 0) { console.log('Aucune fiche sans photo — rien à exporter.'); await pool.end(); return; }

  const header = 'Code CMU;Menage;Prenoms;Nom;Date de naissance';
  const csv = [header, ...res.rows.map((r) =>
    [r.cmu_number, r.menage, r.first_name, r.last_name, String(r.birth_date || '').slice(0, 10)].join(';')
  )].join('\r\n');

  const outCsv = path.join(__dirname, 'lot-030-photos-manquantes.csv');
  const outJson = path.join(__dirname, 'lot-030-photos-manquantes.json');
  fs.writeFileSync(outCsv, '\uFEFF' + csv, 'utf8');
  fs.writeFileSync(outJson, JSON.stringify(res.rows, null, 2), 'utf8');

  console.log(`${res.rows.length} fiches sans photo exportées :`);
  res.rows.forEach((r) => console.log(`  ${r.cmu_number}  ${r.first_name} ${r.last_name}  né=${String(r.birth_date || '').slice(0, 10)}`));
  console.log(`\n→ ${outCsv}`);
  console.log(`→ ${outJson}`);
  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => { }); process.exit(1); });
