// Diagnostic encodage PostgreSQL (scratch — supprimable)
// Réutilise le pool de db.js : même config que le serveur (backend/.env chargé par db.js).
const { pool } = require('../db');
(async () => {
  try {
    const enc = await pool.query('SHOW server_encoding');
    const cc = await pool.query('SHOW client_encoding');
    console.log('server_encoding:', enc.rows[0].server_encoding);
    console.log('client_encoding:', cc.rows[0].client_encoding);
    const t = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
    console.log('tables:', t.rows.map(r => r.table_name).join(', ') || '(aucune)');
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
})();
