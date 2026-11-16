/* DKR_2600059.1 absent : qui est KHADY POUYE dans la base ? */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query("SELECT cmu_number, first_name, last_name, birth_date, birth_place, lot_code, merged_into, photo_url IS NOT NULL AND photo_url<>'' AS photo FROM beneficiaries WHERE last_name ILIKE 'POUYE' OR first_name ILIKE 'KHADY %POUYE%' OR cmu_number LIKE '%260059%'");
  console.log(JSON.stringify(r.rows, null, 1));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
