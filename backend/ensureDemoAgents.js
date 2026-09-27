/**
 * Vérifie (et répare) la présence des comptes agents de démonstration.
 * Utile après l'ajout du compte Super Admin ANACSU : le seed complet
 * `npm run init-db` étant long et potencialmente destructif, ce script
 * applique uniquement l'ajout manquant, sans toucher au reste des données.
 */
const bcrypt = require('bcrypt');
const { query, pool } = require('./db');

const COMPTES = [
  { username: 'agent@cmu.sn', password: 'senecarte', first: 'Amadou', last: 'Sall', role: 'Admin Régional', dept: 'Pikine' },
  { username: 'superadmin@cmu.sn', password: 'superadmin2026', first: 'Moussa', last: 'Ndiaye', role: 'Super Admin', dept: null },
  { username: 'superadmin@anacsu.sn', password: 'SuperAdmin2026!', first: 'Mamadou', last: 'Ba', role: 'Super Admin', dept: null }
];

(async () => {
  try {
    for (const c of COMPTES) {
      const existing = await query('SELECT id FROM agents WHERE username = $1', [c.username]);
      if (existing.rows.length > 0) {
        console.log(`= ${c.username} (déjà présent)`);
        continue;
      }
      const hash = await bcrypt.hash(c.password, 10);
      await query(
        'INSERT INTO agents (username, password_hash, first_name, last_name, role, department) VALUES ($1,$2,$3,$4,$5,$6)',
        [c.username, hash, c.first, c.last, c.role, c.dept]
      );
      console.log(`+ ${c.username} créé (${c.role})`);
    }
    const all = await query('SELECT username, role FROM agents ORDER BY username');
    console.log('\nComptes agents en base :');
    all.rows.forEach((r) => console.log(`  - ${r.username} [${r.role}]`));
  } catch (err) {
    console.error('ÉCHEC :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
