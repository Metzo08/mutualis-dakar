/* NETTOYAGE : les 10 fiches encore porteuses de la photo fausse (3611 octets)
   reçoivent photo_url = NULL (silhouette « PHOTO EN ATTENTE » au lieu du
   visage d'un autre assuré). Leur photo n'existe pas dans le dossier terrain. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const r = await query(`
    UPDATE beneficiaries
       SET photo_url = NULL
     WHERE lot_code = 'LOT-2026-034' AND merged_into IS NULL
       AND photo_url IS NOT NULL AND photo_url <> ''
       AND LENGTH(photo_url) = 3611
       AND md5(photo_url) IN (
         SELECT md5(photo_url) FROM beneficiaries
          WHERE lot_code = 'LOT-2026-034' AND merged_into IS NULL
            AND photo_url IS NOT NULL AND photo_url <> ''
          GROUP BY md5(photo_url) HAVING COUNT(*) > 1)
     RETURNING cmu_number`);
  console.log(`Photo fausse retirée de ${r.rows.length} fiche(s) : ${r.rows.map((x) => x.cmu_number).join(', ')}`);
  await query(
    `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
    ['PURGE_PHOTO_FAUSSE', 'maintenance-script',
      `Lot LOT-2026-034 : photo générique (bug d'import) retirée de ${r.rows.length} fiche(s) — en attente de photo réelle.`]
  );
  await pool.end();
})().catch((e) => { console.error(e.message); process.exitCode = 1; pool.end(); });
