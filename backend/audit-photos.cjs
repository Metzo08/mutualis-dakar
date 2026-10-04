/**
 * AUDIT PHOTOS <-> BASE (lecture seule, aucune écriture en base)
 *
 * Produit un rapport par source dans backend/reports/ :
 *   - fiches sans photo
 *   - fichiers photo non utilisés
 *   - écarts exacts nom de fichier / code / identité
 *
 * Usage : node backend/audit-photos.cjs
 */
// backend/.env porte la configuration PostgreSQL ; le .env racine est celui
// de Vite (frontend) et ne définit aucune variable DB.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const REPORTS = path.join(__dirname, 'reports');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const hasPhoto = (p) => typeof p === 'string' && p.trim() !== '' && p !== 'PHOTO EN ATTENTE';

const SOURCES = [
  {
    key: 'ASS LONASE',
    file: 'c:/Users/hp/Downloads/ASS LONASE.xlsx',
    photoDir: 'C:\\Users\\hp\\Downloads\\ASS LONASE',
    org: ['ASS LONASE'],
  },
  {
    key: 'Ville de Dakar',
    file: 'c:/Users/hp/Downloads/AMEVI.xlsx',
    photoDir: 'C:\\Users\\hp\\Downloads\\Photos ville de Dakar',
    org: ['AMEVI (Ville de Dakar)', 'AMEVI', 'Ville de Dakar'],
  },
];

/** Reprend EXACTEMENT la règle d'appariement de src/utils/bulkImport.js. */
const buildPhotoIndex = (files) => files.map((name) => {
  const base = name.replace(/\.[^.]+$/, '');
  const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
  const cm = base.match(/^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/);
  return {
    name,
    base,
    sansRang,
    personNorm: norm(sansRang),
    codeNorm: cm ? norm(cm[1] + cm[2]) : '',
    codeBaseNorm: cm ? norm(base.slice(0, cm[0].length)) : '',
  };
});

const photoIndexFind = (index, used, test) => index.find((p) => !used.has(p.name) && test(p)) || null;

/** Rejoue matchPhotosToRows pour une liste de fiches {code, prenom, nom, tel}. */
const matchPhotos = (records, index) => {
  const used = new Set();
  const result = [];
  for (const r of records) {
    const codeNorm = norm(r.code);
    const lastNorm = norm(r.nom);
    let firstNorm = norm(r.prenom);
    if (lastNorm && firstNorm !== lastNorm && firstNorm.endsWith(lastNorm)) {
      firstNorm = firstNorm.slice(0, firstNorm.length - lastNorm.length);
    }
    const nameNorm = firstNorm + lastNorm;
    const phoneNorm = norm(r.tel);
    const match =
      (codeNorm ? photoIndexFind(index, used, (p) => p.codeBaseNorm && p.codeBaseNorm === codeNorm) : null) ||
      (nameNorm.length >= 6 && photoIndexFind(index, used, (p) => p.personNorm && p.personNorm === nameNorm)) ||
      (nameNorm.length >= 6 && photoIndexFind(index, used, (p) => p.personNorm && p.personNorm.startsWith(nameNorm))) ||
      (nameNorm.length >= 6 && lastNorm.length >= 2 && photoIndexFind(index, used, (p) =>
        p.personNorm && p.personNorm.startsWith(firstNorm) && p.personNorm.endsWith(lastNorm) && p.personNorm.length > nameNorm.length)) ||
      (nameNorm.length >= 6 && photoIndexFind(index, used, (p) => p.personNorm && nameNorm.startsWith(p.personNorm) && p.personNorm.length >= 6)) ||
      photoIndexFind(index, used, (p) => p.personNorm && p.personNorm === firstNorm) ||
      (phoneNorm ? photoIndexFind(index, used, (p) => p.phoneNorm && p.phoneNorm === phoneNorm) : null) ||
      (codeNorm ? photoIndexFind(index, used, (p) => p.codeNorm && p.codeNorm === codeNorm) : null);
    if (match) used.add(match.name);
    result.push({ record: r, photo: match ? match.name : null });
  }
  return { result, used };
};

(async () => {
  try {
    fs.mkdirSync(REPORTS, { recursive: true });
    const summary = [];

    for (const s of SOURCES) {
      const L = [];
      const line = (t = '') => L.push(t);
      const whereOrgs = s.org.map((_, i) => `$${i + 1}`).join(',');

      const { rows: orgs } = await query(
        'select distinct mutuelle_name from beneficiaries where merged_into is null'
      );
      const allOrgs = orgs.map((o) => clean(o.mutuelle_name)).filter(Boolean);
      const present = allOrgs.filter((o) => s.org.includes(o));

      const { rows: dbRows } = await query(
        `select id, cmu_number, source_code, first_name, last_name, birth_date, phone, photo_url, mutuelle_name
         from beneficiaries
         where merged_into is null and mutuelle_name in (${whereOrgs})
         order by cmu_number nulls last`,
        s.org
      );

      line('================================================================');
      line(`SOURCE : ${s.key}`);
      line('================================================================');
      line(`mutuelle_name distinctes en base : ${allOrgs.length}`);
      line(`  retenues pour ${s.key} : ${present.join(' | ') || '(aucune)'}`);
      line(`fiches en base (merged_into is null) : ${dbRows.length}`);
      const avecPhoto = dbRows.filter((r) => hasPhoto(r.photo_url));
      line(`  dont avec photo_url non vide   : ${avecPhoto.length}`);
      line(`  SANS photo                     : ${dbRows.length - avecPhoto.length}`);

      const byCode = new Map();
      dbRows.forEach((r) => {
        const k = clean(r.cmu_number).toUpperCase();
        if (!byCode.has(k)) byCode.set(k, []);
        byCode.get(k).push(r);
      });
      const dupCodes = [...byCode.entries()].filter(([, v]) => v.length > 1);
      line(`codes distincts                 : ${byCode.size}`);
      line(`codes en doublon                : ${dupCodes.length}`);
      dupCodes.slice(0, 20).forEach(([k, v]) => {
        line(`   ${k} x${v.length} : ${v.map((r) => `${clean(r.first_name)} ${clean(r.last_name)}`).join(' || ')}`);
      });

      const byId = new Map();
      dbRows.forEach((r) => {
        const k = norm(clean(r.first_name) + '|' + clean(r.last_name) + '|' + clean(r.birth_date));
        if (!byId.has(k)) byId.set(k, []);
        byId.get(k).push(r);
      });
      const dupIds = [...byId.entries()].filter(([, v]) => v.length > 1 && clean(v[0].first_name));
      line(`identites (prenom+nom+naissance) en doublon : ${dupIds.length}`);

      const files = fs.existsSync(s.photoDir)
        ? fs.readdirSync(s.photoDir).filter((f) => /\.(jpe?g|png)$/i.test(f))
        : [];
      line('');
      line(`dossier photos : ${s.photoDir}`);
      line(`  existe        : ${fs.existsSync(s.photoDir) ? 'oui' : 'NON'}`);
      line(`  fichiers image: ${files.length}`);

      const index = buildPhotoIndex(files);
      const { result, used } = matchPhotos(
        dbRows.map((r) => ({
          id: r.id,
          code: clean(r.cmu_number),
          prenom: clean(r.first_name),
          nom: clean(r.last_name),
          tel: clean(r.phone),
          dbPhoto: r.photo_url,
          naive: hasPhoto(r.photo_url),
        })),
        index
      );

      const matchParCode = result.filter((x) => x.photo).length;
      const sansApresMatch = result.filter((x) => !x.photo);
      line('');
      line('=== APPARIEMENT (regle bulkImport.js) ===');
      line(`  fiches ayant trouve un fichier photo : ${matchParCode} / ${dbRows.length}`);
      line(`  fichiers reellement consommes        : ${used.size} / ${files.length}`);

      const divergents = result.filter((x) => x.photo && x.record.naive && x.record.dbPhoto !== x.photo);
      if (divergents.length) {
        line(`  ATTENTION : ${divergents.length} fiche(s) ont une photo en base DIFFERENTE du fichier trouve :`);
        divergents.slice(0, 40).forEach((x) => {
          line(`     ${x.record.code} ${x.record.prenom} ${x.record.nom}`);
          line(`        base   : ${String(x.record.dbPhoto).slice(0, 60)}`);
          line(`        fichier: ${x.photo}`);
        });
      }

      line('');
      line(`=== FICHES SANS PHOTO (${sansApresMatch.length}) ===`);
      sansApresMatch.forEach((x) => {
        const r = dbRows.find((d) => d.id === x.record.id) || {};
        line(`  ${String(x.record.code).padEnd(18)} | ${String(x.record.prenom).padEnd(22)} ${String(x.record.nom).padEnd(22)} | naissance=${clean(r.birth_date) || '(vide)'} | tel=${x.record.tel || '-'}`);
      });

      const inutiles = files.filter((f) => !used.has(f));
      line('');
      line(`=== FICHIERS PHOTO NON UTILISES (${inutiles.length}) ===`);
      inutiles.forEach((f) => line(`  ${f}`));

      line('');
      line('=== ECARTS NOM DE FICHIER (fichier non apparie) ===');
      const codesDb = new Set(dbRows.map((r) => clean(r.cmu_number).toUpperCase()).filter(Boolean));
      const nomsDb = dbRows.map((r) => `${clean(r.first_name)} ${clean(r.last_name)}`);
      inutiles.forEach((f) => {
        const base = f.replace(/\.[^.]+$/, '');
        const cm = base.match(/^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/);
        const codeFichier = cm ? `${cm[1].toUpperCase()}_${cm[2]}${(cm[3] || '').toUpperCase()}` : '';
        const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
        const nomFichier = norm(sansRang);
        const baseSansCode = cm ? norm(base.slice(cm[0].length)) : '';
        const nomTrouve = nomFichier
          ? nomsDb.find((n) => {
            const nn = norm(n);
            return nn && (nn === nomFichier || nomFichier.startsWith(nn) || nn.startsWith(nomFichier));
          })
          : null;
        const raison = [];
        if (codeFichier) {
          raison.push(`code ${codeFichier} ${codesDb.has(codeFichier) ? 'PRESENT' : 'ABSENT'} en base`);
          if (cm && cm[3]) {
            const sansSuffixe = `${cm[1].toUpperCase()}_${cm[2]}`;
            raison.push(`(variante sans suffixe ${sansSuffixe} : ${codesDb.has(sansSuffixe) ? 'presente' : 'absente'})`);
          }
        }
        if (nomTrouve) raison.push(`nom trouve en base : "${nomTrouve}"`);
        else if (baseSansCode) {
          const hit = nomsDb.find((n) => norm(n) === baseSansCode);
          raison.push(hit ? `nom exact en base : "${hit}"` : `nom "${baseSansCode}" INCONNU en base`);
        }
        line(`  ${f}`);
        line(`     -> ${raison.join(' | ') || 'aucun indice exploitable'}`);
      });

      if (fs.existsSync(s.file)) {
        const wb = XLSX.readFile(s.file, { cellDates: true });
        const xlRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
          .filter((r) => clean(r.CODE_BENEFICIAIRE));
        const xlCodes = xlRows.map((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase());
        line('');
        line(`=== FICHIER EXCEL ${path.basename(s.file)} ===`);
        line(`  lignes avec CODE_BENEFICIAIRE : ${xlRows.length}`);
        line(`  codes presents en base        : ${xlCodes.filter((c) => codesDb.has(c)).length}`);
        const absents = [...new Set(xlCodes)].filter((c) => !codesDb.has(c));
        line(`  codes ABSENTS de la base      : ${absents.length}`);
        absents.slice(0, 40).forEach((c) => line(`     ${c}`));
      }

      const out = path.join(REPORTS, `audit-photos-${s.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`);
      fs.writeFileSync(out, L.join('\n'), 'utf8');
      summary.push({
        source: s.key, db: dbRows.length, photo: avecPhoto.length,
        match: matchParCode, files: files.length, used: used.size, report: out,
      });
    }

    console.log('=== SYNTHESE ===');
    summary.forEach((s) => {
      console.log(`  ${s.source.padEnd(18)} base=${String(s.db).padStart(4)}  photo_en_base=${String(s.photo).padStart(4)}  appariement=${String(s.match).padStart(4)}  fichiers=${String(s.files).padStart(4)}  utilises=${String(s.used).padStart(4)}`);
      console.log(`     rapport : ${s.report}`);
    });
    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.stack);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();
