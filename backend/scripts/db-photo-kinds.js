// Diagnostic photo_url en base (scratch — supprimable)
require('dotenv').config();
const { pool } = require('../db');
(async () => {
  try {
    const r = await pool.query(`
      SELECT CASE
        WHEN photo_url IS NULL THEN 'NULL'
        WHEN photo_url LIKE 'data:%' THEN 'data-uri'
        WHEN photo_url LIKE 'http%' THEN 'http-url'
        WHEN photo_url LIKE '/api/%' THEN 'api-route'
        ELSE 'chemin: ' || LEFT(photo_url, 60)
      END AS kind, COUNT(*)::int AS n
      FROM beneficiaries GROUP BY 1 ORDER BY 2 DESC`);
    console.table(r.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  } finally { await pool.end(); }
})();
