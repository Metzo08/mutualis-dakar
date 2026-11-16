/* Liste les comptes Super Admin (sans révéler de secret : juste username/rôle) */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
(async () => {
  const r = await query(`SELECT username, role, msd_code FROM agents WHERE role ILIKE '%super%' OR role ILIKE '%admin%' ORDER BY role LIMIT 10`);
  r.rows.forEach((x) => console.log(x.username, '|', x.role, '|', x.msd_code || '-'));
  await pool.end();
})().catch((e) => { console.error(e.message); pool.end().catch(() => { }); process.exit(1); });
