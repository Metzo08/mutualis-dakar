/* PASSE 3 — uniquement les correspondances au NOM COMPLET EXACT (aplati).
   Aucun fuzzy : une photo d'un autre assuré sur une carte CMU est inacceptable. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { query, pool } = require('./db');

const DIR_PHOTOS = path.join(__dirname, '..', 'MSD de Grand Yoff');
const aplat = (s) => String(s || '').toUpperCase().replace(/[^A-ZÀ-Ü]/g, '');

(async () => {
  const fichiers = fs.readdirSync(DIR_PHOTOS).filter((f) => /\.(jpe?g|png)$/i.test(f));
  const disque = fichiers.map((f) => ({
    fichier: f, chemin: path.join(DIR_PHOTOS, f), plat: aplat(path.basename(f, path.extname(f)))
  }));

  const fiches = await query(`
    SELECT id, cmu_number, first_name, last_name, birth_date
      FROM beneficiaries
     WHERE lot_code = 'LOT-2026-034' AND merged_into IS NULL
     ORDER BY cmu_number`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let reparees = 0;
    const details = [];
    for (const f of fiches.rows) {
      const platF1 = `${aplat(f.first_name)}${aplat(f.last_name)}`;
      const platF2 = `${aplat(f.last_name)}${aplat(f.first_name)}`;
      if (!platF1) continue;
      const cands = disque.filter((d) => d.plat === platF1 || d.plat === platF2);
      if (cands.length !== 1) continue; // ambigu ou absent : on ne touche pas
      const buf = await sharp(cands[0].chemin).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      await client.query('UPDATE beneficiaries SET photo_url = $1 WHERE id = $2', [dataUrl, f.id]);
      reparees++;
      details.push(`${f.cmu_number} ← ${cands[0].fichier}`);
    }
    await client.query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['REAPARIEMENT_PHOTOS_GY_V3', 'maintenance-script',
        `Passe 3 (nom exact uniquement) : ${reparees} photo(s). ${details.join(' ; ')}`]
    );
    await client.query('COMMIT');
    console.log(`Passe 3 — réassignées : ${reparees}`);
    details.forEach((x) => console.log('  OK', x));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
