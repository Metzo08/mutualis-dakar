/* Recherche KHADY POUYE avec variantes d'accents/espaces + numéros autour de 260058/260060 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code, photo_url IS NOT NULL AND photo_url<>'' AS photo FROM beneficiaries WHERE cmu_number IN ('DKR_2600058.1','DKR_2600060.1') OR first_name ILIKE '%POUYE%' OR last_name ILIKE '%POUY%'");
  console.log(JSON.stringify(r.rows, null, 1));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
