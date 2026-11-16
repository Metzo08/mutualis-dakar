/* Crée la ligne campaign_lots manquante pour les lots fantômes référencés
   par des fiches mais absents de la table (créés par un ancien import
   navigateur). Dénomination claire appliquée. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

const LIBELLES = {
  'LOT-2026-015': 'ASS LONASE — collecte de masse (lot 015)'
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. Codes de lots portés par des fiches mais absents de campaign_lots.
    const fantomes = await client.query(`
      SELECT DISTINCT b.lot_code AS code, COUNT(*) AS n
        FROM beneficiaries b
       WHERE b.lot_code IS NOT NULL AND b.merged_into IS NULL
         AND NOT EXISTS (SELECT 1 FROM campaign_lots l WHERE l.code = b.lot_code)
       GROUP BY b.lot_code`);
    for (const f of fantomes.rows) {
      const label = LIBELLES[f.code] || `Collecte de masse (${f.code})`;
      // eslint-disable-next-line no-await-in-loop
      const ins = await client.query(
        `INSERT INTO campaign_lots (code, label, source_file, union_id, card_count)
         VALUES ($1, $2, 'Import historique', 'DKR', $3)
         ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label`,
        [f.code, label, f.n]
      );
      console.log(`✅ ${f.code} — « ${label} » — ${f.n} fiche(s)${ins.rowCount ? '' : ' (mis à jour)'}`);
    }
    if (fantomes.rows.length === 0) console.log('Aucun lot fantôme — rien à faire.');
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
