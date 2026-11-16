/* Vérifie pourquoi la fusion DKR_260001.1 n'a pas eu lieu */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query("SELECT id, cmu_number, first_name, last_name, birth_date, lot_code, msd_code, photo_url IS NOT NULL AND photo_url<>'' AS photo, merged_into FROM beneficiaries WHERE cmu_number LIKE 'DKR\\_2600%'");
  console.log(JSON.stringify(r.rows, null, 1));
  const r2 = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code FROM beneficiaries WHERE cmu_number='DKR-DKR-2026-2270.2'");
  console.log(JSON.stringify(r2.rows, null, 1));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
