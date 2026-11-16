/* Rattachement MSD des 6 fiches orphelines :
   - LGA/KDA/TBA/BAM (préfixes de MSD INEXISTANTES, volontairement non mappés
     dans msdScope.js) : leur mutuelle_name = "MSD Dakar" → rattachement DKR.
   - Omar Cisse (DKR-DKR-2026-2295.1, adhésion en ligne) : mutuelle déclarée
     MSD Dakar → DKR.
   Principe : on n'invente PAS de MSD ; on honore la mutuelle DÉCLARÉE. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Omar Cisse (code officiel DKR-…, mutuelle MSD Dakar).
    const r1 = await client.query(`
      UPDATE beneficiaries SET msd_code = 'DKR'
       WHERE merged_into IS NULL AND (msd_code IS NULL OR msd_code = '')
         AND cmu_number LIKE 'DKR-DKR-2026-%'
       RETURNING cmu_number`);
    console.log(`Codes officiels DKR-… rattachés : ${r1.rows.map((x) => x.cmu_number).join(', ') || '(aucun)'}`);

    // 2. Fiches de masse à préfixe inconnu dont la mutuelle déclarée est Dakar.
    const r2 = await client.query(`
      UPDATE beneficiaries b SET msd_code = 'DKR'
       WHERE b.merged_into IS NULL AND (b.msd_code IS NULL OR b.msd_code = '')
         AND (lower(b.mutuelle_name) LIKE '%dakar%')
       RETURNING b.cmu_number`);
    console.log(`Préfixes inconnus (mutuelle Dakar) rattachés : ${r2.rows.map((x) => x.cmu_number).join(', ') || '(aucun)'}`);

    // 3. Les autres sans mutuelle Dakar : rapport (on n'invente pas).
    const rest = await client.query(`
      SELECT cmu_number, mutuelle_name FROM beneficiaries
       WHERE merged_into IS NULL AND (msd_code IS NULL OR msd_code = '')
         AND (lower(mutuelle_name) NOT LIKE '%dakar%' OR mutuelle_name IS NULL)`);
    console.log(`\nRestantes SANS rattachement (à décider par Ahmed Tall) : ${rest.rows.length}`);
    rest.rows.forEach((x) => console.log(`  ${x.cmu_number} | mutuelle="${x.mutuelle_name}"`));

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['RATTACHEMENT_MSD_ORPHELINES', 'maintenance-script',
        `${r1.rowCount + r2.rowCount} fiche(s) rattachées à DKR (mutuelle déclarée). ${rest.rowCount} restent à décider.`]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
