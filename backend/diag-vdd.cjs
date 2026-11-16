/* Diagnostic Ville de Dakar (LOT-2026-030) : fiches sans photo vs dossiers photos */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

(async () => {
  const fiches = await query("SELECT cmu_number, first_name, last_name, birth_date, birth_place, numero_adherent FROM beneficiaries WHERE merged_into IS NULL AND lot_code='LOT-2026-030' AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number");
  console.log('Fiches LOT-2026-030 sans photo :', fiches.rows.length);
  fiches.rows.slice(0, 60).forEach((x) => console.log('  ', x.cmu_number, `${x.first_name} ${x.last_name}`, x.birth_date, x.birth_place));

  const r2 = await query("SELECT count(*) n, count(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url<>'') ph FROM beneficiaries WHERE lot_code='LOT-2026-030' AND merged_into IS NULL");
  console.log('Lot 030 :', r2.rows[0].n, 'fiches,', r2.rows[0].ph, 'avec photo');
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
