/* Recherche plus large : KHADY POUYE et codes 260059 dans toute la base */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code, merged_into, photo_url IS NOT NULL AND photo_url<>'' AS photo FROM beneficiaries WHERE cmu_number LIKE '%0059%' OR (first_name ILIKE 'KHADY%' AND last_name ILIKE 'POUYE%') OR last_name ILIKE '%POUYE%'");
  console.log(JSON.stringify(r.rows, null, 1));
  const r2 = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code, photo_url IS NOT NULL AND photo_url<>'' AS photo FROM beneficiaries WHERE merged_into IS NULL AND lot_code='LOT-2026-011' ORDER BY cmu_number");
  console.log('Fiches lot 011 :', r2.rows.length);
  r2.rows.slice(0, 8).forEach((x) => console.log('  ', x.cmu_number, x.first_name, x.last_name, 'photo=' + x.photo));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
