/**
 * Attachement des photos du lot ASS DERKLE DIEUP2 (LOT-2026-001).
 *
 * Les 48 fichiers portent un nom « 1.0 Prénom NOM.jpeg » (numéro d'ordre du
 * classeur). La correspondance se fait sur le NOM NORMALISÉ (sans accents,
 * sans espaces) contre (prénom + nom) de la fiche. Aucune photo n'écrase une
 * photo déjà enregistrée (idempotent).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

const DOSSIER = 'C:\\Users\\hp\\Downloads\\Photos ASS DERKLE DIEUP2';

const norm = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z]/g, '');

(async () => {
  const client = await pool.connect();
  try {
    const fiches = await client.query(
      `SELECT id, cmu_number, first_name, last_name, (photo_url IS NOT NULL) AS a_photo
       FROM beneficiaries WHERE lot_code = 'LOT-2026-001'`
    );

    const fichiers = fs.readdirSync(DOSSIER).filter(f => /\.(jpe?g|png)$/i.test(f));
    console.log(`${fichiers.length} fichiers photos, ${fiches.rows.length} fiches.`);

    // Index des fiches par clé nom normalisé (prénom+nom), prénom seul, nom seul
    const idxNom = new Map();
    for (const f of fiches.rows) {
      const cle = norm(`${f.first_name} ${f.last_name}`);
      if (cle) idxNom.set(cle, f);
    }

    let attachees = 0, deja = 0, nonTrouvees = [];
    const parNomSeul = new Map();
    for (const f of fiches.rows) {
      const nomSeul = norm(f.last_name);
      if (nomSeul && !parNomSeul.has(nomSeul)) parNomSeul.set(nomSeul, []);
      if (nomSeul) parNomSeul.get(nomSeul).push(f);
    }
    for (const fichier of fichiers) {
      const base = fichier.replace(/\.[^.]+$/, '');
      // Retire le préfixe d'ordre « 1.0 », « 1.1 »…
      const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
      const cle = norm(sansRang);
      let fiche = idxNom.get(cle);
      if (!fiche) {
        // Prénoms abrégés : « Ndeye M Sy » → « NDEYE MARIAMA SY ».
        // Chaque mot de la photo correspond soit au mot de la fiche, soit à
        // son INITIALE (même lettre).
        const motsPhoto = sansRang.split(/\s+/).map(norm).filter(Boolean);
        const candidats = (parNomSeul.get(motsPhoto[motsPhoto.length - 1]) || []);
        fiche = candidats.find((f) => {
          const motsFiche = `${f.first_name} ${f.last_name}`.split(/\s+/).map(norm);
          if (motsFiche.length !== motsPhoto.length) return false;
          return motsPhoto.every((mp, i) =>
            mp === motsFiche[i] || (mp.length === 1 && motsFiche[i].startsWith(mp))
          );
        }) || null;
      }
      if (!fiche) {
        // Appariements explicites (variantes orthographiques du dossier photo,
        // validés par Ahmed Tall) : DIOGAYE→DIOGAL, MBEUGUE→MBENGUE,
        // « Kh »→KHADIDIATOU, « A Ch »→AMY CHARLOTTE.
        const explicites = {
          'diogayendoye': 2944,
          'marianneachdacosta': 2958,
          'mbenguediallo': 2979,
          'ndeyekhsy': 2964
        };
        const idForce = explicites[cle];
        if (idForce) fiche = fiches.rows.find((f) => f.id === idForce) || null;
      }
      if (!fiche) { nonTrouvees.push(sansRang); continue; }
      if (fiche.a_photo) { deja++; continue; }

      const dataUrl = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DOSSIER, fichier)).toString('base64');
      await client.query(`UPDATE beneficiaries SET photo_url = $1 WHERE id = $2`, [dataUrl, fiche.id]);
      attachees++;
    }

    console.log(`✅ ${attachees} photo(s) attachée(s), ${deja} déjà présente(s).`);
    if (nonTrouvees.length) console.log('⚠️ Sans fiche correspondante :', nonTrouvees.join(' | '));
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
