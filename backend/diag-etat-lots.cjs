/* État des 3 lots : fiches avec/sans photo */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const r = await query(`
    SELECT msd_code, lot_code, COUNT(*) n,
           SUM(CASE WHEN photo_url IS NOT NULL AND photo_url<>'' THEN 1 ELSE 0 END) ph
    FROM beneficiaries WHERE merged_into IS NULL
    GROUP BY msd_code, lot_code ORDER BY msd_code, lot_code`);
  console.log('msd | lot | total | avec photo | sans photo');
  r.rows.forEach((x) => console.log(`${x.msd_code} | ${x.lot_code} | ${x.n} | ${x.ph} | ${x.n - x.ph}`));

  const fgy = await query(`
    SELECT cmu_number, first_name, last_name, birth_date
    FROM beneficiaries WHERE merged_into IS NULL AND msd_code LIKE '%YOFF%'
    AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number`);
  console.log(`\n=== Grand Yoff sans photo : ${fgy.rows.length} ===`);
  fgy.rows.forEach((x) => console.log(`${x.cmu_number} | ${x.first_name} ${x.last_name} | ${x.birth_date}`));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
