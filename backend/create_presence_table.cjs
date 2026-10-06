// Création isolée de la table practitioner_presence.
// N'exécute PAS init_db.js : celui-ci contient des DROP TABLE qui
// effaceraient les 463 bénéficiaires réellement enregistrés.
const { query, pool, closeRealtime } = require('./db');

const DDL_TABLE = `
  CREATE TABLE IF NOT EXISTS practitioner_presence (
    practitioner_username VARCHAR(150) PRIMARY KEY,
    practitioner_name VARCHAR(255),
    specialty VARCHAR(150),
    declared_status VARCHAR(30) NOT NULL DEFAULT 'available',
    last_heartbeat_at TIMESTAMP NOT NULL DEFAULT NOW(),
    session_token VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
  )`;

const DDL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_practitioner_presence_heartbeat
    ON practitioner_presence (last_heartbeat_at DESC)`;

(async () => {
  try {
    await query(DDL_TABLE);
    await query(DDL_INDEX);
    const r = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'practitioner_presence'
      ORDER BY ordinal_position`);

    console.log('COLONNES=' + r.rows.length);
    for (const c of r.rows) {
      console.log(`  - ${c.column_name} (${c.data_type}) nullable=${c.is_nullable}`);
    }

    const b = await query('SELECT COUNT(*)::int AS n FROM beneficiaries');
    console.log('BENEFICIAIRES_INTACTS=' + b.rows[0].n);
    console.log('OK');
  } catch (err) {
    console.log('ERREUR: ' + err.message);
    process.exitCode = 1;
  } finally {
    await closeRealtime();
    await pool.end().catch(() => {});
  }
})();