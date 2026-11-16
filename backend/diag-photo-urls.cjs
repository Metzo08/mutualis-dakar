/* Vérifie les valeurs réelles de photo_url pour le lot Grand Yoff */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  // 1. Fiches avec photo dans le lot Grand Yoff
  const withPhoto = await query(`SELECT cmu_number, LEFT(photo_url,90) AS url
    FROM beneficiaries WHERE photo_url IS NOT NULL AND photo_url<>'' AND lot_code='LOT-2026-034' LIMIT 8`);
  console.log('=== Fiches LOT-2026-034 avec photo_url ===');
  withPhoto.rows.forEach((x) => console.log(' ', x.cmu_number, '|', x.url));

  // 2. Répartition des photos par préfixe
  const byPrefix = await query(`SELECT SUBSTRING(cmu_number,1,3) AS pref, COUNT(*) AS n
    FROM beneficiaries WHERE photo_url IS NOT NULL AND photo_url<>'' GROUP BY 1 ORDER BY 2 DESC`);
  console.log('=== Photos par préfixe ===');
  byPrefix.rows.forEach((x) => console.log(' ', x.pref, x.n));

  // 3. Sans photo : par lot
  const noPhoto = await query(`SELECT lot_code, COUNT(*) AS n
    FROM beneficiaries WHERE (photo_url IS NULL OR photo_url='') GROUP BY 1 ORDER BY 2 DESC`);
  console.log('=== Sans photo par lot ===');
  noPhoto.rows.forEach((x) => console.log(' ', x.lot_code || '(null)', x.n));

  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
