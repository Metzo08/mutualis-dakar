/* Vérification des photos déjà écrites pour le ménage 2600010 (fiches .6 et .7) */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const r = await query(`SELECT cmu_number, first_name, last_name, birth_date,
      (photo_url IS NOT NULL AND photo_url<>'') AS photo, LENGTH(photo_url) AS len
    FROM beneficiaries WHERE cmu_number LIKE 'DKR_2600010.%' AND merged_into IS NULL
    ORDER BY cmu_number`);
  r.rows.forEach((x) => console.log(x.cmu_number, x.first_name, x.last_name, x.birth_date, 'photo=' + x.photo, 'len=' + x.len));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
