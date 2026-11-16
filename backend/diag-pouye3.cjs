/* Où sont les fiches LONASE ? Chercher le nom de classeur KHADY POUYE partout */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  // Tous les formats de code dans la base
  const r = await query("SELECT substring(cmu_number from '^[A-Z]+') AS prefixe, count(*) FROM beneficiaries WHERE merged_into IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20");
  console.log('Préfixes de codes :', JSON.stringify(r.rows));
  const r2 = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code, msd_code FROM beneficiaries WHERE merged_into IS NULL AND UPPER(last_name)='POUYE'");
  console.log('POUYE :', JSON.stringify(r2.rows));
  const r3 = await query("SELECT DISTINCT msd_code, count(*) FROM beneficiaries WHERE merged_into IS NULL GROUP BY 1");
  console.log('MSD :', JSON.stringify(r3.rows));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
