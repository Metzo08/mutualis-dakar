/**
 * ============================================================
 *  Réparation ciblée de la base (idempotente)
 * ============================================================
 *
 *  Le seed complet (`npm run init-db`) est long et potentiellement
 *  destructif : on ne le relance pas pour ajouter un élément. Ce script
 *  applique uniquement ce qui manque :
 *
 *   1. la table `merchant_accounts` et les colonnes de répartition des
 *      paiements (absentes si la base a été initialisée avant
 *      l'introduction de l'encaissement multi-MSD) ;
 *   2. les comptes agents de démonstration dont le Super Admin ANACSU ;
 *   3. un compte de paiement par MSD, pour que chaque mutuelle encaisse
 *      ses cotisations sur son PROPRE moyen de paiement Kadev.
 *
 *  Tout est idempotent : des clés déjà déclarées ne sont jamais écrasées.
 */
const bcrypt = require('bcrypt');
const { query, pool } = require('./db');

const COMPTES = [
  { username: 'agent@cmu.sn', password: 'senecarte', first: 'Amadou', last: 'Sall', role: 'Admin Régional', dept: 'Pikine' },
  { username: 'superadmin@cmu.sn', password: 'superadmin2026', first: 'Moussa', last: 'Ndiaye', role: 'Super Admin', dept: null },
  { username: 'superadmin@anacsu.sn', password: 'SuperAdmin2026!', first: 'Mamadou', last: 'Ba', role: 'Super Admin', dept: null }
];

const MSDS = [
  ['DKR', 'Mutuelle de Santé Départementale de Dakar', 'Dakar'],
  ['PKN', 'Mutuelle de Santé Départementale de Pikine', 'Dakar'],
  ['GDW', 'Mutuelle de Santé Départementale de Guédiawaye', 'Dakar'],
  ['RFS', 'Mutuelle de Santé Départementale de Rufisque', 'Dakar'],
  ['THS', 'Mutuelle de Santé Départementale de Thiès', 'Thiès'],
  ['MBR', 'Mutuelle de Santé Départementale de Mbour', 'Thiès'],
  ['STL', 'Mutuelle de Santé Départementale de Saint-Louis', 'Saint-Louis'],
  ['KLC', 'Mutuelle de Santé Départementale de Kaolack', 'Kaolack'],
  ['ZGC', 'Mutuelle de Santé Départementale de Ziguinchor', 'Ziguinchor'],
  ['DRB', 'Mutuelle de Santé Départementale de Diourbel', 'Diourbel']
];

// DDL de l'encaissement multi-MSD : idempotent, sans risque sur les données.
const DDL = [
  `CREATE TABLE IF NOT EXISTS merchant_accounts (
     id SERIAL PRIMARY KEY,
     union_code VARCHAR(10) UNIQUE NOT NULL,
     union_name VARCHAR(200) NOT NULL,
     region VARCHAR(100),
     provider VARCHAR(50) NOT NULL DEFAULT 'kadev',
     public_key VARCHAR(255),
     secret_key VARCHAR(255),
     account_number VARCHAR(100),
     bank_name VARCHAR(150),
     commission_bps INTEGER NOT NULL DEFAULT 0,
     is_active BOOLEAN NOT NULL DEFAULT TRUE,
     is_default BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_accounts_union ON merchant_accounts(union_code)',
  'ALTER TABLE payments ADD COLUMN IF NOT EXISTS union_code VARCHAR(10)',
  'ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_account_id INTEGER REFERENCES merchant_accounts(id) ON DELETE SET NULL',
  'ALTER TABLE payments ADD COLUMN IF NOT EXISTS gross_amount INTEGER',
  'ALTER TABLE payments ADD COLUMN IF NOT EXISTS platform_fee INTEGER',
  'ALTER TABLE payments ADD COLUMN IF NOT EXISTS net_amount INTEGER',
  'CREATE INDEX IF NOT EXISTS idx_payments_union ON payments(union_code)'
];

(async () => {
  try {
    // 1. Schéma de l'encaissement multi-MSD
    for (const sql of DDL) await query(sql);
    console.log('+ Schéma multi-MSD vérifié (merchant_accounts + répartition)');

    // 2. Comptes agents de démonstration
    for (const c of COMPTES) {
      const existing = await query('SELECT id FROM agents WHERE username = $1', [c.username]);
      if (existing.rows.length > 0) {
        console.log(`= agent ${c.username} (déjà présent)`);
        continue;
      }
      const hash = await bcrypt.hash(c.password, 10);
      await query(
        'INSERT INTO agents (username, password_hash, first_name, last_name, role, department) VALUES ($1,$2,$3,$4,$5,$6)',
        [c.username, hash, c.first, c.last, c.role, c.dept]
      );
      console.log(`+ agent ${c.username} créé (${c.role})`);
    }

    // 3. Un compte de paiement par MSD
    for (const [code, name, region] of MSDS) {
      const r = await query(
        `INSERT INTO merchant_accounts (union_code, union_name, region, is_default, provider)
         VALUES ($1,$2,$3,FALSE,'kadev')
         ON CONFLICT (union_code) DO NOTHING
         RETURNING id`,
        [code, name, region]
      );
      console.log(r.rows.length > 0 ? `+ compte ${code} créé` : `= compte ${code} déjà présent`);
    }
    await query(
      `INSERT INTO merchant_accounts (union_code, union_name, region, is_default, provider)
       VALUES ('AGG','Compte agrégateur MUTUALIS DAKAR','National',TRUE,'kadev')
       ON CONFLICT (union_code) DO NOTHING`
    );

    const list = await query(
      `SELECT union_code, union_name, is_default,
              (secret_key IS NOT NULL AND secret_key <> '') AS configure
         FROM merchant_accounts ORDER BY union_code`
    );
    console.log('\nComptes de paiement par MSD :');
    list.rows.forEach((r) => console.log(
      `  - ${r.union_code}  ${r.union_name}${r.is_default ? '  (par défaut)' : ''}${r.configure ? '  [configuré]' : '  [à configurer]'}`
    ));
  } catch (err) {
    console.error('ÉCHEC :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
