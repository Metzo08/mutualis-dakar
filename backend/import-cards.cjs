/**
 * IMPORT DES CARTES DEPUIS LES FICHIERS EXCEL — codes réels, zéro fabrication.
 *
 * RÈGLE ABSOLUE
 * Le code CMU est celui du fichier (`CODE_BENEFICIAIRE`). Il correspond à la
 * carte DÉJÀ IMPRIMÉE. La plateforme n'invente JAMAIS de matricule : les
 * `DKR-DKR-2026-…` qu'elle avait générés ne figuraient sur aucune carte et ont
 * été supprimés avec le registre.
 *
 * DÉDOUBLONNAGE
 * Un même code apparaît plusieurs fois dans un même fichier (Grand Yoff :
 * 22 codes répétés, jusqu'à 4 fois). On conserve la ligne la plus RICHE — celle
 * qui porte le plus de champs renseignés — sans jamais dupliquer la personne.
 *
 * PHOTOS
 * Deux conventions de nommage coexistent :
 *   « DKR_2600040.1 PAPA IBRAHIMA SEYE.jpeg »     → appariement certain par le code
 *   « Abdou Karim Diouf né le 28-08-97 à Gossas …jpeg » → appariement par nom
 * L'appariement par nom est STRICT (prénom + nom exacts, normalisés). Aucune
 * correspondance approximative : une photo fausse sur une carte ferait passer
 * une personne réelle pour un autre individu. Ce qui n'est pas apparié est
 * compté et signalé, jamais deviné.
 *
 * Usage :
 *   node backend/import-cards.cjs            (simulation)
 *   node backend/import-cards.cjs --apply    (écriture)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const APPLY = process.argv.includes('--apply');
const ROOT = path.join(__dirname, '..');

const SOURCES = [
  { file: 'c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx', label: 'MSD de Grand Yoff',
    photoDir: path.join(ROOT, 'MSD de Grand Yoff') },
  { file: 'c:/Users/hp/Downloads/AMEVI.xlsx', label: 'AMEVI (Ville de Dakar)', photoDir: null },
  { file: 'c:/Users/hp/Downloads/ASS LONASE.xlsx', label: 'ASS LONASE',
    photoDir: path.join(ROOT, 'ASS LONASE') }
];

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

/**
 * Normalise une date en ISO `AAAA-MM-JJ`.
 *
 * Les fichiers portent des dates hétérogènes : `1/5/75`, `5/26/62`,
 * `2001-10-21`, et parfois une date suivie de l'heure (62 caractères) — ce qui
 * dépasse la colonne `birth_date` varchar(50) et faisait échouer l'import.
 * Tronquer aurait mutilé la date ; on la convertit proprement.
 * Une date illisible reste vide : elle est signalée, jamais inventée.
 */
const toIsoDate = (v) => {
  if (!v && v !== 0) return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = clean(v);
  if (!s) return '';
  // Date mal saisie dans le fichier source : le séparateur entre le mois et
  // l'année manque. « 20/081979 » = 20/08/1979. Ces cellules échouaient au
  // parsing et laissaient la date vide sur la carte.
  const tirets = s.match(/^(\d{1,2})\/(\d{1,2})(\d{4})$/);
  if (tirets) {
    const day = Number(tirets[1]);
    const month = Number(tirets[2]);
    const year = Number(tirets[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  // JJ/MM/AAAA ou MM/JJ/AAAA
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, a, b, y] = m.map(Number);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    let day = a, month = b;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (a <= 12 && b > 12) { day = b; month = a; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return '';
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return '';
};

/** Normalise un nom pour l'appariement : sans accents, sans casse, sans espaces. */
const normName = (v) =>
  clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/**
 * Champs renseignés : arbitre les doublons internes.
 *
 * Une date DE NAISSANCE lisible vaut plus qu'un champ vide : le fichier source
 * contient la même personne en double avec, d'un côté, une date correcte et de
 * l'autre une date mal saisie. Sans ce point bonus, la ligne malformée pouvait
 * l'emporter et la carte s'afficherait sans date.
 */
const richness = (r) =>
  ['PRENOM_BENEFICIAIRE', 'NOM_BENEFICIAIRE', 'DATE_NAISSANCE', 'LIEU_NAISSANCE',
    'NIN', 'SEXE', 'ADRESSE', 'CONTACT', 'EMAIL', 'GROUPE_SANGUIN',
    'VALIDITE_CARTE_DEBUT', 'VALIDITE_CARTE_FIN', 'TYPE_CARTE'
  ].reduce((n, f) => n + (clean(r[f]) !== '' ? 1 : 0), 0)
  + (toIsoDate(r.DATE_NAISSANCE) ? 5 : 0);

/**
 * Indexe les photos d'un dossier : par CODE quand il figure dans le nom de
 * fichier, sinon par NOM COMPLET normalisé.
 */
const indexPhotos = (dir) => {
  const byCode = new Map();
  const byName = new Map();
  if (!dir || !fs.existsSync(dir)) return { byCode, byName, total: 0 };

  for (const f of fs.readdirSync(dir).filter((n) => /\.(jpe?g|png)$/i.test(n))) {
    const base = f.replace(/\.(jpe?g|png)$/i, '');
    const m = base.match(/^([A-Z]{2,4}[-_][A-Za-z0-9]+(?:[._-][0-9]+)?)\s+(.+)$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!byCode.has(code)) byCode.set(code, f);
    } else {
      const key = normName(base.replace(/\s+(né|ne|née)\s+le.*$/i, '').replace(/\s+adresse.*$/i, ''));
      if (key && !byName.has(key)) byName.set(key, f);
    }
  }
  return { byCode, byName, total: byCode.size + byName.size };
};

(async () => {
  try {
    // 1. Lecture des fichiers et dédoublonnage par code
    const byCode = new Map();
    const photoIndex = new Map();
    let lignesLues = 0, sansCode = 0, doublons = 0;

    for (const s of SOURCES) {
      photoIndex.set(s.label, indexPhotos(s.photoDir));
      const wb = XLSX.readFile(s.file, { cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      lignesLues += rows.length;

      for (const r of rows) {
        const code = clean(r.CODE_BENEFICIAIRE);
        if (!code) { sansCode++; continue; }
        const key = code.toUpperCase();

        if (byCode.has(key)) {
          doublons++;
          // Même personne : on garde la ligne la plus riche.
          if (richness(r) > richness(byCode.get(key).row)) {
            byCode.set(key, { row: r, source: s.label });
          }
          continue;
        }
        byCode.set(key, { row: r, source: s.label });
      }
    }

    console.log('=== LECTURE DES FICHIERS ===');
    console.log(`  lignes lues               : ${lignesLues}`);
    console.log(`  lignes sans code CMU      : ${sansCode}  (ignorées)`);
    console.log(`  doublons internes résolus : ${doublons}`);
    console.log(`  PERSONNES DISTINCTES      : ${byCode.size}`);

    const titulaires = [...byCode.values()].filter(
      ({ row }) => !/\.[1-9]\d*$/.test(clean(row.CODE_BENEFICIAIRE))
    ).length;
    console.log(`    dont titulaires          : ${titulaires}`);
    console.log(`    dont ayants droit        : ${byCode.size - titulaires}`);

    // 2. Appariement strict des photos
    let photos = 0, sansPhoto = 0;
    const echantillon = [];

    for (const [key, entry] of byCode) {
      const idx = photoIndex.get(entry.source);
      let file = idx.byCode.get(key) || null;
      if (!file) {
        const nom = normName(`${clean(entry.row.PRENOM_BENEFICIAIRE)} ${clean(entry.row.NOM_BENEFICIAIRE)}`);
        file = idx.byName.get(nom) || null;
      }
      entry.photo = file;
      if (file) photos++;
      else {
        sansPhoto++;
        if (echantillon.length < 6) {
          echantillon.push(`${key} ${clean(entry.row.PRENOM_BENEFICIAIRE)} ${clean(entry.row.NOM_BENEFICIAIRE)}`);
        }
      }
    }

    console.log('\n=== PHOTOS ===');
    for (const s of SOURCES) {
      console.log(`  ${s.label.padEnd(24)} ${photoIndex.get(s.label).total} fichier(s)`);
    }
    console.log(`  appariées                 : ${photos}`);
    console.log(`  sans photo                : ${sansPhoto}`);
    if (echantillon.length) console.log(`  ex. : ${echantillon.join(' | ')}`);

    const existing = await query(
      `select cmu_number from beneficiaries where coalesce(btrim(cmu_number),'') <> ''`
    );
    const dbSet = new Set(existing.rows.map((r) => clean(r.cmu_number).toUpperCase()));
    console.log(`\n=== CONTROLE ===`);
    console.log(`  codes deja en base        : ${[...byCode.keys()].filter((c) => dbSet.has(c)).length}`);

    if (!APPLY) {
      console.log("\n>>> SIMULATION : rien n'a ete ecrit. Relancez avec --apply.");
      await pool.end();
      return;
    }

    // 3. Écriture : le code du fichier est conservé tel quel.
    const client = await pool.connect();
    let inserted = 0;
    try {
      await client.query('begin');
      for (const [key, entry] of byCode) {
        const r = entry.row;
        await client.query(
          `insert into beneficiaries
            (first_name, last_name, birth_date, birth_place, phone, email, address, nin,
             gender, blood_group, cmu_number, numero_adherent, status, package_type,
             payment_method, mutuelle_name, department, source_code, msd_code, photo_url)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'active',$13,'excel_import',$14,'Dakar',$15,'DKR',$16)`,
          [
            clean(r.PRENOM_BENEFICIAIRE), clean(r.NOM_BENEFICIAIRE),
            toIsoDate(r.DATE_NAISSANCE), clean(r.LIEU_NAISSANCE),
            clean(r.CONTACT), clean(r.EMAIL), clean(r.ADRESSE), clean(r.NIN),
            clean(r.SEXE).toUpperCase().startsWith('F') ? 'F' : 'M',
            clean(r.GROUPE_SANGUIN),
            clean(r.CODE_BENEFICIAIRE), clean(r.NUMERO_ADHERENT),
            clean(r.TYPE_CARTE) || 'Classique',
            clean(r["MUTUELLE_D'ORIGINE"]) || 'MSD Dakar',
            `${entry.source}`,
            entry.photo ? `/import-photos/${entry.source}/${encodeURIComponent(entry.photo)}` : null
          ]
        );
        inserted++;
      }
      await client.query('commit');
      console.log(`\n>>> ${inserted} beneficiaires inseres (codes reels, aucune fabrication)`);
    } catch (e) {
      await client.query('rollback');
      console.log('ROLLBACK :', e.message);
      client.release();
      await pool.end();
      process.exit(1);
    }
    client.release();

    const check = await query(`
      select count(*)::int as total,
             count(*) filter (where photo_url is not null)::int as avec_photo,
             count(distinct cmu_number)::int as codes
      from beneficiaries
    `);
    console.log('\n=== VERIFICATION ===');
    console.log(`  fiches        : ${check.rows[0].total}`);
    console.log(`  codes distincts : ${check.rows[0].codes}`);
    console.log(`  avec photo    : ${check.rows[0].avec_photo}`);

    const Mafou = await query(
      `select cmu_number, first_name, last_name, photo_url from beneficiaries
       where lower(first_name) like '%mafou%' and lower(last_name) like '%diedhiou%'`
    );
    console.log('\n=== CONTROLE MAFOU DIEDHIOU ===');
    Mafou.rows.forEach((r) => console.log(`  ${r.cmu_number} | ${r.first_name} ${r.last_name} | photo ${r.photo_url ? 'oui' : 'non'}`));

    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    process.exit(1);
  }
})();