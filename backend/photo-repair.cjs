/**
 * ═══════════════════════════════════════════════════════════════════════
 *  RÉPARATION DES PHOTOS — LIMITÉE À UNE SOURCE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PROBLÈME
 * L'import navigateur ne peut pas relire `C:\Users\hp\Downloads\ASS LONASE`
 * sans sélection manuelle du dossier : le navigateur interdit l'accès
 * silencieux à un chemin disque. Résultat : les fiches ASS LONASE sont en
 * base (121 sur 122 codes) mais 120 d'entre elles n'ont aucune photo, alors
 * que 66 fichiers attendent sur le disque.
 *
 * PRINCIPE DE SÉCURITÉ
 * La réparation ne touche QUE les fiches dont le code figure dans le
 * classeur de la source visée. Les codes des trois sources sont disjoints
 * (vérifié : LONASE ∩ AMEVI = ∅, LONASE ∩ YOFF = ∅, AMEVI ∩ YOFF = ∅),
 * donc une réparation ASS LONASE ne peut structurellement pas altérer une
 * photo de Ville de Dakar ou de Grand Yoff. Aucune suppression, aucun
 * ré-import, aucun matricule régénéré : un simple UPDATE de photo_url.
 *
 * Appariement : backend/photo-matching.cjs (aligné sur bulkImport.js).
 * Une photo n'est écrite que si l'appariement est EXPLICITE et qu'aucune
 * autre fiche ne revendique le même fichier.
 */
const fs = require('fs');
const path = require('path');
const { clean, normalizeName, buildPhotoIndex, matchPhotos } = require('./photo-matching.cjs');
const { encodeWithBudget, isImage } = require('./photo-encode.cjs');

/** Budget de poids des photos pour un lot (aligné sur PHOTO_BUDGET_BYTES). */
const PHOTO_BUDGET_BYTES = 2 * 1024 * 1024;

const listPhotoFiles = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => isImage(f)).sort() : [];

/**
 * Charge les fiches d'une source, restreintes aux codes de son classeur.
 *
 * @param {import('pg').PoolClient|import('pg').Pool} db
 * @param {Set<string>} codeSet — codes (MAJUSCULES) du classeur de la source
 * @returns {Promise<Array>} fiches retenues
 */
const loadRecordsForCodes = async (db, codeSet) => {
  const codes = [...codeSet];
  if (codes.length === 0) return [];
  const { rows } = await db.query(
    `select id, cmu_number, source_code, first_name, last_name, phone, birth_date, photo_url
       from beneficiaries
      where merged_into is null
        and (upper(btrim(coalesce(cmu_number,''))) = any($1::text[])
          or upper(btrim(coalesce(source_code,''))) = any($1::text[]))
      order by cmu_number`,
    [codes]
  );
  return rows.map((r) => ({
    id: r.id,
    code: clean(r.cmu_number),
    prenom: clean(r.first_name),
    nom: clean(r.last_name),
    telephone: clean(r.phone),
    birthDate: clean(r.birth_date),
    currentPhoto: r.photo_url,
  }));
};

/**
 * Prépare le plan de réparation SANS écrire quoi que ce soit.
 *
 * @param {object} params
 * @param {string} params.photoDir      dossier des photos de la source
 * @param {Set<string>} params.codeSet  codes du classeur de la source
 * @param {Array} params.records        fiches déjà filtrées sur codeSet
 * @returns {{plan: Array, unused: string[], stats: object}}
 */
const planRepair = ({ photoDir, codeSet, records }) => {
  const files = listPhotoFiles(photoDir);
  const index = buildPhotoIndex(files);
  const { results, used } = matchPhotos(records, index);

  const plan = [];
  const sansPhoto = [];
  for (const r of results) {
    if (!r.photo) {
      sansPhoto.push(r.record);
      continue;
    }
    plan.push({
      record: r.record,
      file: r.photo,
      filePath: path.join(photoDir, r.photo),
      rule: r.rule,
      // Une fiche déjà pourvue garde sa photo : on ne remplace jamais un
      // portrait déjà validé par un fichier trouvé plus tard.
      overwrite: !r.record.currentPhoto,
      currentPhoto: r.record.currentPhoto,
    });
  }

  const unused = files.filter((f) => !used.has(f));

  // Garde-fou : un fichier ne doit servir qu'une seule fois, et toute fiche
  // hors du périmètre de la source doit être ignorée.
  const seenFiles = new Set();
  for (const p of plan) {
    if (seenFiles.has(p.file)) throw new Error(`Fichier photo attribué deux fois : ${p.file}`);
    seenFiles.add(p.file);
    if (!codeSet.has(p.record.code.toUpperCase())) {
      throw new Error(`Fiche hors périmètre pour ${p.file} : ${p.record.code}`);
    }
  }

  const stats = {
    photosDisponibles: files.length,
    fichesPerimetre: records.length,
    appariees: plan.length,
    parCode: plan.filter((p) => p.rule === 'code-complet').length,
    aEcrire: plan.filter((p) => p.overwrite).length,
    dejaPhotos: plan.filter((p) => !p.overwrite).length,
    sansPhoto: sansPhoto.length,
    fichiersInutilises: unused.length,
  };

  return { plan, sansPhoto, unused, stats, files };
};

/**
 * Exécute le plan : encode les photos puis écrit `photo_url` en base.
 * Tout est encodé AVANT la première écriture — si une photo est illisible,
 * rien n'est modifié (une réparation à moitié appliquée est pire qu'un
 * échec franc).
 *
 * @param {object} params
 * @param {import('pg').Pool} params.db
 * @param {Array} params.plan        sortie de planRepair()
 * @param {boolean} [params.dryRun]
 * @returns {Promise<{ecrits:number, ignores:Array, octets:number}>}
 */
const applyRepair = async ({ db, plan, dryRun = false }) => {
  const state = { budgetRestant: PHOTO_BUDGET_BYTES, step: 0, bytes: 0 };
  const encoded = [];
  const ignores = [];

  for (const item of plan) {
    if (!item.overwrite) continue; // fiche déjà pourvue : on n'y touche pas
    const dataUrl = await encodeWithBudget(item.filePath, state);
    if (!dataUrl) {
      ignores.push({ code: item.record.code, file: item.file, raison: 'image illisible' });
      continue;
    }
    encoded.push({ ...item, dataUrl });
  }

  if (dryRun) {
    return {
      dryRun: true,
      ecrits: 0,
      preview: encoded.map((e) => ({
        code: e.record.code,
        nom: `${e.record.prenom} ${e.record.nom}`,
        file: e.file,
        rule: e.rule,
        octets: e.dataUrl.length,
      })),
      ignores,
      octets: state.bytes,
    };
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const e of encoded) {
      await client.query(
        'update beneficiaries set photo_url = $1 where id = $2',
        [e.dataUrl, e.record.id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { dryRun: false, ecrits: encoded.length, ignores, octets: state.bytes };
};

/**
 * Rendu texte du rapport d'une réparation (affiché au Super Admin).
 */
const formatReport = ({ source, photoDir, codeSet, plan, sansPhoto, unused, stats }) => {
  const L = [];
  const line = (t = '') => L.push(t);
  const pct = (n, d) => (d ? ` (${Math.round((n / d) * 100)} %)` : '');

  line('═'.repeat(74));
  line(`RÉPARATION PHOTOS — ${source}`);
  line('═'.repeat(74));
  line(`dossier photos    : ${photoDir}`);
  line(`codes du classeur : ${codeSet.size}`);
  line('');
  line('--- SYNTHÈSE ---');
  line(`  fichiers photo disponibles : ${stats.photosDisponibles}`);
  line(`  fiches de la source en base: ${stats.fichesPerimetre}`);
  line(`  fiches ayant trouvé une photo : ${stats.appariees}${pct(stats.appariees, stats.fichesPerimetre)}`);
  line(`     dont par CODE COMPLET     : ${stats.parCode}  ← appariement de confiance`);
  line(`  à écrire (fiche sans photo) : ${stats.aEcrire}`);
  line(`  déjà pourvues (non touchées): ${stats.dejaPhotos}`);
  line(`  fiches sans photo           : ${stats.sansPhoto}`);
  line(`  fichiers non utilisés        : ${stats.fichiersInutilises}`);

  line('');
  line('--- APPARIEMENTS (fiche → fichier) ---');
  plan.forEach((p) => {
    line(`  ${p.record.code.padEnd(18)} ${(p.record.prenom + ' ' + p.record.nom).padEnd(38)} <- ${p.file}`);
    line(`      règle=${p.rule}  ${p.overwrite ? 'À ÉCRIRE' : 'déjà pourvue (inchangée)'}`);
  });

  line('');
  line(`--- FICHES SANS PHOTO (${sansPhoto.length}) ---`);
  sansPhoto.forEach((r) => {
    line(`  ${r.code.padEnd(18)} ${(r.prenom + ' ' + r.nom).padEnd(38)} naissance=${r.birthDate || '(vide)'}`);
  });

  line('');
  line(`--- FICHIERS NON UTILISÉS (${unused.length}) ---`);
  unused.forEach((f) => line(`  ${f}`));
  return L.join('\n');
};

module.exports = {
  PHOTO_BUDGET_BYTES,
  listPhotoFiles,
  loadRecordsForCodes,
  planRepair,
  applyRepair,
  formatReport,
  normalizeName,
};
