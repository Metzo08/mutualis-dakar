/**
 * MIGRATION ET PARTITIONNEMENT DE LA BASE DE DONNÉES POSTGRESQL (MUTUALIS DAKAR)
 * Conçu par Alioune Badara (Ingénieur Base de Données) & Omar Faye (Architecte)
 *
 * 1. Partitionnement déclaratif par RANGE (annuel) sur `audit_logs` :
 *    - audit_logs_2025
 *    - audit_logs_2026
 *    - audit_logs_2027
 *    - audit_logs_default
 *    Avantage : Pruning automatique des partitions, vacuum ciblé, archivage à froid.
 *
 * 2. Indexation composite & partitionnement logique pour `beneficiaries` :
 *    - Index composite (msd_code, cmu_number)
 *    - Index composite (msd_code, status)
 *    - Index partiel (msd_code, created_at)
 *    Avantage : Évite de rompre les 16 clés étrangères actives tout en apportant
 *    une vitesse d'exécution de requête identique à un partitionnement physique.
 */

const { pool } = require('../db');

async function migratePartitioning() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('[Partitioning] Démarrage de la migration déclarative...');

    // ── 1. AUDIT_LOGS : PARTITIONNEMENT DÉCLARATIF PAR RANGE (created_at) ───────
    // Vérifie si audit_logs est déjà partitionnée
    const isPartitioned = await client.query(`
      SELECT relkind FROM pg_class WHERE relname = 'audit_logs';
    `);

    if (isPartitioned.rows[0]?.relkind !== 'p') {
      console.log('[Partitioning] Migration de audit_logs vers audit_logs_partitioned (RANGE)...');
      
      // Création de la table partitionnée
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
          id SERIAL,
          action VARCHAR(255),
          actor VARCHAR(255),
          details TEXT,
          created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          correlation_id VARCHAR(255),
          object_type VARCHAR(255),
          object_ref VARCHAR(255),
          result VARCHAR(255),
          request_ref VARCHAR(255),
          msd_code VARCHAR(255),
          severity VARCHAR(255),
          PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at);
      `);

      // Création des partitions annuelles
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs_2025 PARTITION OF audit_logs_partitioned
          FOR VALUES FROM ('2025-01-01 00:00:00') TO ('2026-01-01 00:00:00');

        CREATE TABLE IF NOT EXISTS audit_logs_2026 PARTITION OF audit_logs_partitioned
          FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2027-01-01 00:00:00');

        CREATE TABLE IF NOT EXISTS audit_logs_2027 PARTITION OF audit_logs_partitioned
          FOR VALUES FROM ('2027-01-01 00:00:00') TO ('2028-01-01 00:00:00');

        CREATE TABLE IF NOT EXISTS audit_logs_default PARTITION OF audit_logs_partitioned
          DEFAULT;
      `);

      // Copie des données existantes
      await client.query(`
        INSERT INTO audit_logs_partitioned (id, action, actor, details, created_at, correlation_id, object_type, object_ref, result, request_ref, msd_code, severity)
        SELECT id, action, actor, details, COALESCE(created_at, CURRENT_TIMESTAMP), correlation_id, object_type, object_ref, result, request_ref, msd_code, severity
        FROM audit_logs
        ON CONFLICT DO NOTHING;
      `);

      // Synchronisation de la séquence id
      await client.query(`
        SELECT setval(pg_get_serial_sequence('audit_logs_partitioned', 'id'), COALESCE(MAX(id), 1)) FROM audit_logs;
      `);

      // Permutation atomique des tables
      await client.query(`
        ALTER TABLE audit_logs RENAME TO audit_logs_legacy;
        ALTER TABLE audit_logs_partitioned RENAME TO audit_logs;
      `);

      // Index locaux sur chaque partition via la table mère
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_msd ON audit_logs(msd_code);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
      `);
      console.log('[Partitioning] audit_logs partitionnée avec succès par année (2025, 2026, 2027, default).');
    } else {
      console.log('[Partitioning] audit_logs est déjà partitionnée.');
    }

    // ── 2. BENEFICIARIES : INDEXATION MULTI-MSD À ÉCHELLE 1M -> 5M ─────────────
    console.log('[Partitioning] Création des index haute-densité multi-MSD sur beneficiaries...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_beneficiaries_msd_cmu 
        ON beneficiaries(msd_code, cmu_number);

      CREATE INDEX IF NOT EXISTS idx_beneficiaries_msd_status 
        ON beneficiaries(msd_code, status) 
        WHERE status IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_beneficiaries_msd_created 
        ON beneficiaries(msd_code, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_beneficiaries_msd_active 
        ON beneficiaries(msd_code) 
        WHERE card_status = 'ACTIVE' OR status = 'Actif';
    `);

    await client.query('COMMIT');
    console.log('[Partitioning] Migration et partitionnement complétés avec succès.');
    process.exit(0);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Partitioning] Échec de la migration, ROLLBACK exécuté :', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

migratePartitioning();
