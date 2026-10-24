const { pool } = require('../db');
(async () => {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1");
  console.log(r.rows.map((x) => x.table_name).join('\n'));
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
