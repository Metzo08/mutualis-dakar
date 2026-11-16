/* Renommage des lots de masse génériques en dénominations claires.
   Lecture du fichier source de chaque lot, libellé explicite.
   1 transaction : tout ou rien. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

// Dénominations explicites : source de collecte claire pour l'admin.
const RENOMMAGES = {
  'LOT-2026-010': 'Ville de Dakar — AMEVI (assurés sociaux)',
  'LOT-2026-011': 'ASS LONASE — fichiers nominatifs',
  'LOT-2026-015': 'Grand Yoff — collecte MSD (fichier fusionné)',
  'LOT-2026-030': 'AMEVI Ville de Dakar — collecte de masse (lot 030)',
  'LOT-2026-031': 'Grand Yoff — collecte MSD (lot 31, vide)',
  'LOT-2026-033': 'Grand Yoff — collecte MSD (lot 33, vide)',
  'LOT-2026-034': 'Grand Yoff — collecte MSD (adhesions de masse)'
};

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lots = await client.query('SELECT code, label, source_file FROM campaign_lots ORDER BY code');
    for (const l of lots.rows) {
      const nouveau = RENOMMAGES[l.code];
      if (!nouveau || (l.label && l.label.includes('—'))) {
        // Pas de renommage prévu, ou libellé déjà explicite (contient « — »).
        console.log(`↷ ${l.code} conservé : « ${l.label || '(sans libellé)'} »`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await client.query('UPDATE campaign_lots SET label = $2 WHERE code = $1', [l.code, nouveau]);
      console.log(`✅ ${l.code} : « ${l.label || '(sans libellé)'} » → « ${nouveau} »`);
    }
    await client.query('COMMIT');
    console.log('\nLibellés mis à jour.');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
