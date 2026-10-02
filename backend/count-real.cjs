// ── Comparaison fichiers Excel ↔ base actuelle ────────────────────────────
// Objectif : mesurer ce que la purge ferait gagner/perdre, et vérifier que les
// codes des fichiers Excel (ceux FIGURANT sur les cartes déjà imprimées) ne
// sont pas déjà en base.
require('dotenv').config();
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const SOURCES = [
  { file: 'c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx', org: 'MSD de Grand Yoff' },
  { file: 'c:/Users/hp/Downloads/AMEVI.xlsx', org: 'AMEVI (Ville de Dakar)' },
  { file: 'c:/Users/hp/Downloads/ASS LONASE.xlsx', org: 'ASS LONASE' }
];

(async () => {
  try {
    const union = new Set();
    const perSource = [];

    for (const s of SOURCES) {
      const wb = XLSX.readFile(s.file, { cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const codes = rows
        .map((r) => String(r.CODE_BENEFICIAIRE || '').trim())
        .filter(Boolean);
      const titulaires = codes.filter((c) => !/\.[1-9]\d*$/.test(c)).length;
      const ayants = codes.length - titulaires;
      codes.forEach((c) => union.add(c.toUpperCase()));
      perSource.push({ ...s, total: rows.length, codes: codes.length, titulaires, ayants, unique: new Set(codes.map((c) => c.toUpperCase())).size });
    }

    console.log('=== FICHIERS EXCEL (cartes déjà imprimées) ===');
    perSource.forEach((s) => {
      console.log(`  ${s.org.padEnd(24)} ${String(s.total).padStart(5)} lignes  ${String(s.codes).padStart(5)} codes  (${s.titulaires} titulaires + ${s.ayants} ayants)  ${s.unique} uniques`);
    });
    console.log(`\n  TOTAL fichiers Excel  : ${perSource.reduce((n, s) => n + s.total, 0)} lignes`);
    console.log(`  Codes uniques Excel   : ${union.size}`);

    const db = await query(`
      select count(*)::int as n,
             count(*) filter (where merged_into is null)::int as actives
      from beneficiaries
    `);
    console.log(`\n=== BASE ACTUELLE ===`);
    console.log(`  lignes                 : ${db.rows[0].n}`);
    console.log(`  fiches actives         : ${db.rows[0].actives}`);

    const dbCodes = await query(
      "select distinct upper(btrim(cmu_number)) as c from beneficiaries where coalesce(btrim(cmu_number),'') <> ''"
    );
    const dbSet = new Set(dbCodes.rows.map((r) => r.c));

    const dejaEnBase = [...union].filter((c) => dbSet.has(c));
    const absents = [...union].filter((c) => !dbSet.has(c));
    console.log(`  codes Excel DÉJÀ en base : ${dejaEnBase.length}`);
    console.log(`  codes Excel ABSENTS de la base : ${absents.length}`);
    if (absents.length) console.log(`    ex. ${absents.slice(0, 10).join(', ')}`);

    // Les codes générés par le système : à eliminar sans réserve, ils ne
    // figurent sur aucune carte imprimée.
    const generees = await query(`
      select count(*)::int as n from beneficiaries
      where cmu_number like 'DKR-DKR-2026-%' or cmu_number like '%DKR-DKR-2026-%'
    `);
    const genereesActives = await query(`
      select count(*)::int as n from beneficiaries
      where merged_into is null and (cmu_number like '%DKR-DKR-2026-%')
    `);
    console.log(`\n=== CODES GÉNÉRÉS PAR LE SYSTÈME (DKR-DKR-2026-…) ===`);
    console.log(`  total lignes           : ${generees.rows[0].n}`);
    console.log(`  dont fiches actives    : ${genereesActives.rows[0].n}`);
    console.log(`  → aucun ne figure sur une carte imprimée : à supprimer.`);

    // Doublons À L'INTÉRIEUR des fichiers : Grand Yoff déclare 214 codes pour
    // 154 codes uniques. L'import devra les dédoublonner, sinon le registre
    // réintroduira exactement les doublons qu'on cherche à supprimer.
    console.log('\n=== DOUBLONS INTERNES AUX FICHIERS ===');
    for (const s of perSource) {
      const wb = XLSX.readFile(s.file, { cellDates: true });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const codes = rows.map((r) => String(r.CODE_BENEFICIAIRE || '').trim()).filter(Boolean);
      const seen = new Map();
      codes.forEach((c) => {
        const k = c.toUpperCase();
        seen.set(k, (seen.get(k) || 0) + 1);
      });
      const dup = [...seen.entries()].filter(([, n]) => n > 1);
      const sansCode = rows.filter((r) => !String(r.CODE_BENEFICIAIRE || '').trim()).length;
      console.log(`  ${s.org.padEnd(24)} ${dup.length} code(s) répété(s), ${sansCode} ligne(s) sans code`);
      dup.slice(0, 5).forEach(([c, n]) => console.log(`      ${c} ×${n}`));
    }

    console.log('\n=== MEME IDENTITE, DEUX CODES (a arbitrer) ===');
    const dupId = await query(`
      select lower(btrim(coalesce(first_name,'')))||'|'||lower(btrim(coalesce(last_name,'')))||'|'||coalesce(birth_date,'') as ident,
             count(*)::int as n,
             string_agg(cmu_number, ' | ' order by cmu_number) as codes,
             string_agg(distinct coalesce(source_code,'?'), ' | ') as sources,
             string_agg(distinct coalesce(numero_adherent,'?'), ' | ') as adherents
      from beneficiaries
      group by 1 having count(*) > 1
    `);
    if (!dupId.rows.length) {
      console.log('  aucune');
    } else {
      dupId.rows.forEach((r) => {
        console.log(`  ${r.ident}  x${r.n}`);
        console.log(`     codes     : ${r.codes}`);
        console.log(`     sources   : ${r.sources}`);
        console.log(`     adherents : ${r.adherents}`);
      });
    }
    console.log('\n=== DATES DE NAISSANCE ILLISIBLES ===');
    const badDates = await query(`
      select cmu_number, first_name, last_name, birth_date
      from beneficiaries
      where birth_date is null or btrim(birth_date) = ''
      order by cmu_number
    `);
    if (!badDates.rows.length) {
      console.log('  aucune');
    } else {
      badDates.rows.forEach((r) => {
        console.log(`  ${r.cmu_number.padEnd(18)} ${r.first_name} ${r.last_name}`);
      });
      console.log(`  => ${badDates.rows.length} fiche(s) sans date lisible`);
    }

    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    process.exit(1);
  }
})();

// `family_members` porte un `age` déjà calculé, et non une date de naissance.
// On lit donc `age` en priorité : un âge ne peut pas se déduire sans date.
const ageOf = (row) => {
  if (row.age !== null && row.age !== undefined && String(row.age).trim() !== '') {
    const a = parseInt(row.age, 10);
    return Number.isNaN(a) ? null : a;
  }
  const b = new Date(row.birth_date || row.birthdate || row.birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a -= 1;
  return a;
};

(async () => {
  try {
    const titulaires = await query(`
      select count(*)::int as n from beneficiaries where merged_into is null
    `);
    const parCode = await query(`
      select count(*)::int as n from beneficiaries
      where merged_into is null and cmu_number is not null and btrim(cmu_number) <> ''
    `);

    console.log('=== TITULAIRES (lignes de beneficiaries) ===');
    console.log(`  personnesMN          : ${titulaires.rows[0].n}`);
    console.log(`  dont avec code CMU   : ${parCode.rows[0].n}`);

    const cols = await query(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'family_members' order by ordinal_position
    `);
    console.log('\n=== AYANTS DROIT (family_members) ===');
    console.log('  colonnes : ' + cols.rows.map((r) => r.column_name).join(', '));
    const fm = await query('select count(*)::int as n from family_members');
    console.log(`  nombre total         : ${fm.rows[0].n}`);

    if (fm.rows[0].n > 0) {
      const det = await query('select * from family_members limit 3');
      det.rows.forEach((r) => console.log('    exemple : ' + JSON.stringify(r).slice(0, 200)));

      // Minorité : c'est elle qui justifie la prise en charge à 100 %.
      const rows = await query('select * from family_members');
      let mineurs = 0, majeurs = 0, sansAge = 0;
      for (const r of rows.rows) {
        const a = ageOf(r);
        if (a === null) sansAge++;
        else if (a < 18) mineurs++;
        else majeurs++;
      }
      console.log(`  de moins de 18 ans   : ${mineurs}`);
      console.log(`  de 18 ans et plus    : ${majeurs}`);
      console.log(`  âge indéterminé      : ${sansAge}`);
    }

    const total = titulaires.rows[0].n + fm.rows[0].n;
    console.log('\n=== TOTAL DES PERSONNES COUVERTES ===');
    console.log(`  titulaires           : ${titulaires.rows[0].n}`);
    console.log(`  ayants droit (table) : ${fm.rows[0].n}`);
    console.log(`  TOTAL À COUVRIR      : ${total}`);

    // Les ayants droit importés depuis l'Excel portent leur PROPRE ligne dans
    // `beneficiaries` (code suffixé `.1`, `.2`…) : ils sont donc DÉJÀ dans les
    // 546. Seuls ceux enregistrés via `family_members` s'y ajoutent.
    const suffix = await query(`
      select
        count(*) filter (where cmu_number ~ '\\.[1-9][0-9]*$')::int as ayants,
        count(*) filter (where cmu_number !~ '\\.[1-9][0-9]*$')::int as titulaires
      from beneficiaries where merged_into is null
    `);
    console.log('\n=== SUFFIXE DE CODE (ayants droit avec leur propre ligne) ===');
    console.log(`  titulaires (code nu)         : ${suffix.rows[0].titulaires}`);
    console.log(`  ayants droit (code suffixé)  : ${suffix.rows[0].ayants}`);
    console.log(`  => total fiches carte titulaires + ayants : ${suffix.rows[0].titulaires + suffix.rows[0].ayants}`);
    console.log(`  + ayants droit de family_members (hors table titulaires) : ${fm.rows[0].n}`);

    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();