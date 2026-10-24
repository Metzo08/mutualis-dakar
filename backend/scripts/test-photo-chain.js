// Test bout-en-bout de la chaîne photo du Studio Cartes (scratch — supprimable)
require('dotenv').config();
const { pool, query } = require('../db');

(async () => {
  try {
    // 1. Un bénéficiaire qui a une photo (les 3 premiers)
    const r = await pool.query(
      `SELECT id, cmu_number, msd_code, LEFT(photo_url, 30) AS apercu, LENGTH(photo_url) AS taille
       FROM beneficiaries WHERE photo_url IS NOT NULL AND merged_into IS NULL ORDER BY id LIMIT 5`
    );
    console.table(r.rows);

    // 2. Login Super Admin ?
    const u = await pool.query(`SELECT username, role FROM agents WHERE role ILIKE '%super%' LIMIT 3`);
    console.table(u.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  } finally { await pool.end(); }
})();
