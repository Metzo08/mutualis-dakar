/* Liste nominative des assurés SANS photo — tous lots, toutes MSD */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

(async () => {
  const r = await query(`
    SELECT msd_code, lot_code, cmu_number, first_name, last_name, birth_date, birth_place, phone, address
      FROM beneficiaries
     WHERE merged_into IS NULL AND (photo_url IS NULL OR photo_url='')
     ORDER BY lot_code, cmu_number`);
  console.log(`=== ASSURÉS SANS PHOTO : ${r.rows.length} ===\n`);
  r.rows.forEach((x) => {
    console.log(`${x.lot_code} | ${x.cmu_number} | ${x.first_name} ${x.last_name} | né(e) ${x.birth_date} à ${x.birth_place} | tél ${x.phone}`);
  });
  fs.writeFileSync(
    'backend/reports/assures-sans-photo.txt',
    r.rows.map((x) =>
      `${x.lot_code}\t${x.cmu_number}\t${x.first_name} ${x.last_name}\tné(e) ${x.birth_date} à ${x.birth_place}\ttél ${x.phone}`
    ).join('\n'),
    'utf8'
  );
  console.log(`\nListe écrite dans backend/reports/assures-sans-photo.txt`);
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => {}); process.exit(1); });
