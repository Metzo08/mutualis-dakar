/* VDD : toutes les fiches sans photo, tous lots 2600x */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const r = await query(`SELECT cmu_number, first_name, last_name, birth_date, lot_code, numero_adherent
    FROM beneficiaries WHERE merged_into IS NULL AND (photo_url IS NULL OR photo_url='')
    AND cmu_number LIKE '%2600%' ORDER BY lot_code, cmu_number`);
  console.log('Total sans photo :', r.rows.length);
  r.rows.forEach((x) => console.log(x.lot_code, x.cmu_number, `${x.first_name} ${x.last_name}`, x.birth_date, '| adh:', x.numero_adherent));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
