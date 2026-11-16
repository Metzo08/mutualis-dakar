/* Vérification finale Grand Yoff : photos du dossier non rattachées en base */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

(async () => {
  const dir = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD de Grand Yoff';
  const photos = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f));
  console.log('Photos dans le dossier :', photos.length);

  const r = await query(`SELECT cmu_number, first_name, last_name, photo_url, lot_code
    FROM beneficiaries WHERE merged_into IS NULL AND photo_url IS NOT NULL AND photo_url <> ''
    AND (photo_url ILIKE '%grand%yoff%' OR lot_code = 'LOT-2026-034')`);
  console.log('Fiches actives avec photo (lot Yoff) :', r.rows.length);

  const used = new Set(r.rows.map((x) => path.basename(x.photo_url).toLowerCase()));
  const nonRatt = photos.filter((p) => !used.has(p.toLowerCase()));
  console.log('\nPhotos NON rattachées :', nonRatt.length);
  nonRatt.forEach((p) => console.log(' -', p));

  // fiches avec photo_url qui pointe vers un fichier inexistant
  for (const x of r.rows) {
    const f = path.basename(x.photo_url);
    if (!fs.existsSync(path.join(dir, f)) && !fs.existsSync(path.join('C:/Users/hp/Downloads/MUTUALIS DAKAR/public/msd_photos', f))) {
      console.log('⚠ photo introuvable pour', x.cmu_number, x.photo_url);
    }
  }
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
