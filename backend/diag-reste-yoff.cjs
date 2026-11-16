/* Contrôle final : fiches du lot Grand Yoff encore sans photo */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query("SELECT cmu_number, first_name, last_name, birth_date FROM beneficiaries WHERE lot_code='LOT-2026-034' AND merged_into IS NULL AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number");
  r.rows.forEach((x) => console.log(x.cmu_number, `${x.first_name} ${x.last_name}`, x.birth_date));
  console.log('Total sans photo :', r.rows.length);
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
