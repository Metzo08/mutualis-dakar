/* Audit lecture seule : quelles colonnes existent réellement ? (aucune écriture) */
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
(async () => {
  const tables = ['beneficiaries', 'campaign_lots', 'production_events', 'card_lifecycle_events', 'admin_requests', 'password_resets', 'audit_logs', 'agents', 'mutuelles', 'refresh_tokens', 'platform_settings'];
  for (const t of tables) {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
      [t]
    ).catch((e) => ({ rows: [{ column_name: 'ERR: ' + e.message }] }));
    console.log(`\n## ${t} (${r.rows.length})`);
    console.log(r.rows.map((x) => x.column_name).join(', '));
  }
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
