/* ═══════════════
   RÉPARATION PHOTOS — fiches Grand Yoff portant une photo D'UN AUTRE.
   Les 56 fiches 2300+ (ex-méga-ménage 0067) partagent la même photo (bug
   d'appariement à l'import : les lignes sans CODE_BENEFICIAIRE recevaient
   la photo du dernier ménage traité).
   Méthode : fiche (nom + naissance) → ligne Excel (PRENOM/NOM/DATE_NAISSANCE)
   → colonne PHOTO (nom du fichier image) → fichier dans « MSD de Grand Yoff »
   → compression JPEG → UPDATE photo_url. 1 transaction, tout ou rien.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const sharp = require('sharp');
const { query, pool } = require('./db');

const DIR_PHOTOS = path.join(__dirname, '..', 'MSD de Grand Yoff');
const EXCEL = path.join(__dirname, '..', 'MSD de Grand Yoff.xlsx');

/** Clé d'identité : nom normalisé + date ISO (la même logique que l'import). */
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
const isoDate = (v) => {
  if (!v) return '';
  const s = v instanceof Date ? v.toISOString() : String(v);
  return s.slice(0, 10);
};

(async () => {
  // 1. Index Excel : clé (nom, naissance) → nom de fichier photo.
  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const excelIndex = new Map();
  rows.forEach((r) => {
    const photo = String(r.PHOTO || '').trim();
    if (!photo) return;
    const prenom = norm(r.PRENOM_BENEFICIAIRE);
    const nom = norm(r.NOM_BENEFICIAIRE);
    const date = isoDate(r.DATE_NAISSANCE);
    if (!prenom && !nom) return;
    excelIndex.set(`${prenom}|${nom}|${date}`, photo);
    // Variante sans prénom composé.
    const prenomCourt = prenom.split(/\s+/)[0] || '';
    if (prenomCourt !== prenom) excelIndex.set(`${prenomCourt}|${nom}|${date}`, photo);
  });
  console.log(`Lignes Excel avec photo : ${excelIndex.size}`);

  // 2. Index disque : nom de fichier → chemin (recherche insensible à la casse).
  const disque = new Map();
  fs.readdirSync(DIR_PHOTOS).forEach((f) => {
    if (/\.(jpe?g|png)$/i.test(f)) disque.set(norm(path.basename(f, path.extname(f))), path.join(DIR_PHOTOS, f));
  });
  console.log(`Photos sur disque : ${disque.size}`);

  // 3. Les fiches à réparer : tout le lot 034 dont la photo est partagée
  //    (la photo fausse) ou absente — appariées par identité.
  const fiches = await query(`
    SELECT id, cmu_number, first_name, last_name, birth_date,
           LENGTH(photo_url) AS photo_len
      FROM beneficiaries
     WHERE lot_code = 'LOT-2026-034' AND merged_into IS NULL
     ORDER BY cmu_number`);
  console.log(`Fiches lot 034 : ${fiches.rows.length}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let reparees = 0, dejaBonnes = 0, introuvables = [];

    for (const f of fiches.rows) {
      const cle = `${norm(f.first_name)}|${norm(f.last_name)}|${isoDate(f.birth_date)}`;
      const nomFichier = excelIndex.get(cle);
      if (!nomFichier) { introuvables.push(`${f.cmu_number} ${f.first_name} ${f.last_name} (cle:${cle})`); continue; }
      const chemin = disque.get(norm(path.basename(nomFichier, path.extname(nomFichier))))
        || disque.get(norm(nomFichier));
      if (!chemin) { introuvables.push(`${f.cmu_number} → fichier absent : ${nomFichier}`); continue; }

      // Compression : 320 px, JPEG 80 (même règle que l'import).
      // eslint-disable-next-line no-await-in-loop
      const buf = await sharp(chemin).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

      // eslint-disable-next-line no-await-in-loop
      await client.query('UPDATE beneficiaries SET photo_url = $1 WHERE id = $2', [dataUrl, f.id]);
      reparees++;
      if (reparees % 20 === 0) console.log(`  … ${reparees} photo(s) réassignée(s)`);
    }

    await client.query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['REAPARIEMENT_PHOTOS_GY', 'maintenance-script',
        `Lot LOT-2026-034 : ${reparees} photo(s) réassignées au bon assuré via le fichier Excel (colonne PHOTO) et le dossier de photos.`]
    );
    await client.query('COMMIT');

    console.log(`\n✅ Réparées : ${reparees}`);
    console.log(`⚠️ Sans correspondance : ${introuvables.length}`);
    introuvables.slice(0, 15).forEach((x) => console.log('   ', x));
    if (introuvables.length > 15) console.log(`   … et ${introuvables.length - 15} autres`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
