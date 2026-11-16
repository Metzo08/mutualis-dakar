/* Vérification ciblée : doublon BABACAR DJIRE NGOM */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query("SELECT id, cmu_number, first_name, last_name, birth_date, lot_code, merged_into, photo_url IS NOT NULL AND photo_url<>'' AS photo FROM beneficiaries WHERE first_name LIKE 'BABACAR%' AND last_name='NGOM'");
  console.log(JSON.stringify(r.rows, null, 1));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
