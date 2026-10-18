/* Inventaire ponctuel des tables et structures existantes. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { Pool } = require('pg');
const p = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
});
(async () => {
  for (const t of ['mutuelles', 'locations', 'campaign_lots', 'regional_coverage']) {
    const r = await p.query(
      `select column_name, data_type from information_schema.columns
        where table_name=$1 and table_schema='public' order by ordinal_position`, [t]);
    console.log(`${t} (${r.rows.length}) :`, r.rows.map((x) => `${x.column_name}:${x.data_type.split(' ')[0]}`).join(', '));
  }
  const m = await p.query('select name, region, department from mutuelles order by id limit 8').catch((e) => ({ rows: [{ err: e.message }] }));
  console.log('ex mutuelles :', JSON.stringify(m.rows, null, 1));
  const loc = await p.query(`select distinct region, count(*) n from locations group by region order by n desc limit 6`).catch((e) => ({ rows: [{ err: e.message }] }));
  console.log('locations par region :', JSON.stringify(loc.rows));
  const lots = await p.query('select code, label, union_id, printed, created_at from campaign_lots order by created_at desc limit 5');
  console.log('lots :', JSON.stringify(lots.rows, null, 1));
  await p.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
