// Inspection lecture seule de la base PostgreSQL — SELECT uniquement.
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const LOG = path.join(__dirname, '_inspect_db.log');
const out = [];
const log = (s) => out.push(s);

(async () => {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'MUTUALIS DAKAR',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    connectionTimeoutMillis: 6000,
  });
  try {
    const db = await pool.query('SELECT current_database() as db, current_user as usr');
    log(`CONNECTE : base="${db.rows[0].db}" utilisateur="${db.rows[0].usr}"`);

    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
    log(`TABLES PUBLIC (${tables.rows.length}) :`);
    for (const t of tables.rows) {
      const n = await pool.query(`SELECT COUNT(*) as n FROM "${t.table_name}"`);
      log(`  ${t.table_name} : ${n.rows[0].n} lignes`);
    }

    const hasB = tables.rows.some(t => t.table_name === 'beneficiaries');
    if (hasB) {
      const c = await pool.query('SELECT COUNT(*) as n FROM public.beneficiaries');
      log(`BENEFICIAIRES : ${c.rows[0].n} lignes`);
      const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='beneficiaries' ORDER BY ordinal_position`);
      log(`  Colonnes : ${cols.rows.map(r => r.column_name).join(', ')}`);
      if (c.rows[0].n > 0) {
        const sample = await pool.query('SELECT * FROM public.beneficiaries LIMIT 2');
        sample.rows.forEach((r, i) => {
          const flat = Object.entries(r).map(([k, v]) => `${k}=${String(v).slice(0, 30)}`).join(' | ');
          log(`  Exemple ${i + 1} : ${flat}`);
        });
      }
    }

    const hasC = tables.rows.some(t => t.table_name === 'cards');
    if (hasC) {
      const c = await pool.query('SELECT COUNT(*) as n FROM public.cards');
      log(`CARTES : ${c.rows[0].n} lignes`);
      if (c.rows[0].n > 0) {
        const sample = await pool.query('SELECT * FROM public.cards LIMIT 2');
        sample.rows.forEach((r, i) => {
          const flat = Object.entries(r).map(([k, v]) => `${k}=${String(v).slice(0, 30)}`).join(' | ');
          log(`  Exemple ${i + 1} : ${flat}`);
        });
      }
    }

    const sf = path.join(__dirname, 'data', 'store.json');
    if (fs.existsSync(sf)) {
      const st = fs.statSync(sf);
      log(`Fallback store.json : ${st.size} octets, modifié ${st.lastWriteTime.toISOString()}`);
    } else {
      log(`Fallback store.json : ABSENT`);
    }
  } catch (e) {
    log(`ERREUR : ${e.message.split('\n')[0]}`);
  } finally {
    await pool.end().catch(() => {});
    fs.writeFileSync(LOG, out.join('\n'), 'utf8');
    console.log('OK — résultat écrit dans backend/_inspect_db.log');
  }
})();
