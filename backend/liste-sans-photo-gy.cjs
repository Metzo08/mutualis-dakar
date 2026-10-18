/* Liste des assurés du lot Grand Yoff (LOT-2026-034) sans photo. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const r = await query(`
    SELECT cmu_number, first_name, last_name, birth_date, phone, address
      FROM beneficiaries
     WHERE lot_code = 'LOT-2026-034' AND merged_into IS NULL
       AND (photo_url IS NULL OR photo_url = '')
     ORDER BY cmu_number`);
  console.log(`Assurés Grand Yoff SANS PHOTO : ${r.rows.length}\n`);
  r.rows.forEach((x, i) => console.log(
    `${String(i + 1).padStart(2)}. ${x.cmu_number} | ${(x.first_name + ' ' + x.last_name).padEnd(34)} | né ${String(x.birth_date || '').slice(0, 10)} | ${x.phone || '—'} | ${x.address || '—'}`
  ));
  await pool.end();
})().catch((e) => { console.error(e.message); process.exitCode = 1; pool.end(); });
