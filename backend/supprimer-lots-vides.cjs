/* Supprime les lots VIDES de campaign_lots (aucune fiche rattachée).
   Sécurité : refus si le lot porte des fiches actives, ou s'il est marqué
   imprimé (historique comptable). Journal d'audit pour chaque suppression. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lots vides : aucune fiche active, non imprimés.
    const vides = await client.query(`
      SELECT l.code, l.label
        FROM campaign_lots l
        LEFT JOIN beneficiaries b
               ON b.lot_code = l.code AND b.merged_into IS NULL
       WHERE l.printed IS NOT TRUE
         AND l.code <> 'LOT-2026-INDIV'
       GROUP BY l.id
      HAVING COUNT(b.id) = 0`);

    if (vides.rows.length === 0) {
      console.log('Aucun lot vide à supprimer.');
      await client.query('COMMIT');
    } else {
      for (const l of vides.rows) {
        // eslint-disable-next-line no-await-in-loop
        await client.query('DELETE FROM campaign_lots WHERE code = $1', [l.code]);
        console.log(`✅ Supprimé : ${l.code} — « ${l.label || '(sans libellé)'} » (lot vide)`);
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
          ['SUPPRESSION_LOT_VIDE', 'maintenance-script', `Lot vide supprimé : ${l.code} (${l.label || 'sans libellé'}).`]
        );
      }
      await client.query('COMMIT');
    }

    // Contrôle final.
    const reste = await client.query(`
      SELECT l.code, l.label, COUNT(b.id) AS fiches
        FROM campaign_lots l
        LEFT JOIN beneficiaries b ON b.lot_code = l.code AND b.merged_into IS NULL
       GROUP BY l.id ORDER BY l.code`);
    console.log('\n=== LOTS RESTANTS ===');
    reste.rows.forEach((r) =>
      console.log(`  ${r.code} — « ${r.label || '(sans libellé)'} » — ${r.fiches} fiche(s)`)
    );
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK — aucune écriture :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
