/* 2e passe : appariement souple des 86 fiches restantes.
   - comparaison par similarité (longueur commune) sur le nom aplati
   - liste les fichiers encore disponibles pour vérifier le stock */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { query, pool } = require('./db');

const DIR_PHOTOS = path.join(__dirname, '..', 'MSD de Grand Yoff');
const tokens = (s) => String(s || '').toUpperCase().replace(/[^A-ZÀ-Ü ]/g, ' ').split(/\s+/).filter((t) => t.length > 1);
const aplat = (s) => String(s || '').toUpperCase().replace(/[^A-ZÀ-Ü]/g, '');

/** Distance simple : proportion de caractères communs ordonnés (LCS grossier). */
function similarite(a, b) {
  if (!a || !b) return 0;
  let i = 0, j = 0, common = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { common++; i++; j++; }
    else if (a.length > b.length) i++;
    else j++;
  }
  return common / Math.max(a.length, b.length);
}

function dateDepuisNom(base) {
  const m = base.match(/(\d{1,2})[\s._-]+(\d{1,2})[\s._-]+(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const m2 = base.match(/(\d{8})/);
  if (m2) {
    const s = m2[1];
    return `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
  }
  return null;
}

(async () => {
  const fichiers = fs.readdirSync(DIR_PHOTOS).filter((f) => /\.(jpe?g|png)$/i.test(f));
  const disque = fichiers.map((f) => {
    const base = path.basename(f, path.extname(f));
    return { fichier: f, chemin: path.join(DIR_PHOTOS, f), plat: aplat(base), tk: tokens(base), date: dateDepuisNom(base) };
  });
  const occupeeFichiers = new Set();

  // Reconstruire l'occupation : quelles photos sont déjà attribuées (par
  // réassignation v3 — on reconnaît la photo par sa taille compressée, pas
  // fiable) ; on se base plutôt sur les fiches DÉJÀ correctement appariées :
  // trop complexe. Alternative sûre : les 86 restantes = fiches sans
  // correspondance exacte ; les fichiers restants = 195 - (nombre de
  // candidats v3 distincts). On occupe d'abord par nom aplati exact.
  const fichesToutes = await query(`
    SELECT id, cmu_number, first_name, last_name, birth_date
      FROM beneficiaries
     WHERE lot_code = 'LOT-2026-034' AND merged_into IS NULL
     ORDER BY cmu_number`);
  // Simuler v3 pour connaître l'occupation exacte des fichiers.
  const simule = new Set();
  for (const f of fichesToutes.rows) {
    const platF = `${aplat(f.last_name)}${aplat(f.first_name)}`;
    const platF2 = `${aplat(f.first_name)}${aplat(f.last_name)}`;
    const tkF = [...tokens(f.last_name), ...tokens(f.first_name)];
    const dateF = String(f.birth_date || '').slice(0, 10);
    if (tkF.length === 0) continue;
    let cands = disque.filter((d) => !simule.has(d.fichier)
      && (d.plat.includes(platF) || d.plat.includes(platF2)));
    if (cands.length === 0) cands = disque.filter((d) => !simule.has(d.fichier) && tkF.every((t) => d.tk.includes(t)));
    if (cands.length === 0) continue;
    const avecDate = cands.filter((d) => !d.date || !dateF || d.date === dateF);
    const best = (avecDate.length ? avecDate : cands).sort((a, b) => b.plat.length - a.plat.length)[0];
    simule.add(best.fichier);
  }
  simule.forEach((x) => occupeeFichiers.add(x));
  console.log(`Fichiers déjà occupés (v3) : ${occupeeFichiers.size} / ${disque.length}`);

  // Les fiches restantes = celles SANS photo réassignée ET dont la photo
  // actuelle est la photo fausse (partagée) ou absente. On prend les fiches
  // du lot dont la photo actuelle a la longueur de la photo fausse connue
  // (3611 octets) OU est vide — mais après v3, les réassignées ont une
  // longueur variable. On identifie donc les fiches SANS appariement v3
  // (les 86), calculées à l'identique.
  const appariéesV3 = new Set();
  for (const f of fichesToutes.rows) {
    const platF = `${aplat(f.last_name)}${aplat(f.first_name)}`;
    const platF2 = `${aplat(f.first_name)}${aplat(f.last_name)}`;
    const tkF = [...tokens(f.last_name), ...tokens(f.first_name)];
    const dateF = String(f.birth_date || '').slice(0, 10);
    if (tkF.length === 0) continue;
    let cands = disque.filter((d) => !appariéesV3.has(d.fichier)
      && (d.plat.includes(platF) || d.plat.includes(platF2)));
    if (cands.length === 0) cands = disque.filter((d) => !appariéesV3.has(d.fichier) && tkF.every((t) => d.tk.includes(t)));
    if (cands.length === 0) continue;
    const avecDate = cands.filter((d) => !d.date || !dateF || d.date === dateF);
    const best = (avecDate.length ? avecDate : cands).sort((a, b) => b.plat.length - a.plat.length)[0];
    appariéesV3.add(String(f.id));
  }
  const restantes = fichesToutes.rows.filter((f) => !appariéesV3.has(String(f.id)));
  console.log(`Fiches restantes sans appariement exact : ${restantes.length}`);

  const libres = disque.filter((d) => !occupeeFichiers.has(d.fichier));
  console.log(`Fichiers libres : ${libres.length}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let reparees = 0;
    const sansCorrespondance = [];
    for (const f of restantes) {
      const platF = `${aplat(f.last_name)}${aplat(f.first_name)}`;
      const platF2 = `${aplat(f.first_name)}${aplat(f.last_name)}`;
      const tkF = [...tokens(f.last_name), ...tokens(f.first_name)];
      const dateF = String(f.birth_date || '').slice(0, 10);
      // Candidats libres avec similarité minimale 0.7 sur le nom complet.
      // eslint-disable-next-line no-await-in-loop
      const cands = libres
        .map((d) => ({ d, s1: similarite(platF, d.plat), s2: similarite(platF2, d.plat) }))
        .map((x) => ({ ...x, s: Math.max(x.s1, x.s2) }))
        .filter((x) => x.s >= 0.68)
        .sort((a, b) => b.s - a.s);
      // Bonus date exacte.
      const avecDate = cands.filter((x) => x.d.date === dateF);
      const best = (avecDate.length ? avecDate : cands)[0];
      if (!best) { sansCorrespondance.push(`${f.cmu_number} ${f.first_name} ${f.last_name} ${dateF}`); continue; }
      occupeeFichiers.add(best.d.fichier);
      // eslint-disable-next-line no-await-in-loop
      const buf = await sharp(best.d.chemin).resize(320, 320, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer();
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
      // eslint-disable-next-line no-await-in-loop
      await client.query('UPDATE beneficiaries SET photo_url = $1 WHERE id = $2', [dataUrl, f.id]);
      reparees++;
    }
    await client.query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['REAPARIEMENT_PHOTOS_GY_V2', 'maintenance-script',
        `Lot LOT-2026-034 (passe 2, similarité ≥ 0.68) : ${reparees} photo(s) réassignées.`]
    );
    await client.query('COMMIT');
    console.log(`\nPasse 2 — réassignées : ${reparees} · Sans correspondance : ${sansCorrespondance.length}`);
    sansCorrespondance.forEach((x) => console.log('   ', x));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
