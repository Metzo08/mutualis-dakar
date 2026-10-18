/**
 * AUDIT code ↔ identité — lot LOT-2026-034 (Grand Yoff)
 * Compare, pour chaque fiche active du lot, l'identité en base
 * contre l'identité du classeur MSD de Grand Yoff.xlsx pour le même code.
 * Usage : node backend/audit-code-identite.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (s) => clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const toIso = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = clean(v);
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0, 10);
};

(async () => {
  // 1. Classeur
  const wb = XLSX.readFile('C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD de Grand Yoff.xlsx', { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => clean(r.CODE_BENEFICIAIRE));
  const excel = new Map();
  lignes.forEach((r) => {
    const c = clean(r.CODE_BENEFICIAIRE).toUpperCase();
    if (!excel.has(c)) excel.set(c, r); // première ligne gagne (déjà dédupliqué à l'import)
  });

  // 2. Base
  const res = await query(
    "SELECT cmu_number, first_name, last_name, birth_date, birth_place, photo_url IS NOT NULL AND photo_url<>'' AS has_photo FROM beneficiaries WHERE lot_code='LOT-2026-034' AND merged_into IS NULL ORDER BY cmu_number"
  );

  let identiques = 0, diffs = [], absents = [];
  for (const row of res.rows) {
    const code = clean(row.cmu_number).toUpperCase();
    const e = excel.get(code);
    const baseName = norm(`${row.first_name} ${row.last_name}`);
    const baseBirth = toIso(row.birth_date);
    if (!e) { absents.push(code); continue; }
    const exName = norm(`${clean(e.PRENOM_BENEFICIAIRE)} ${clean(e.NOM_BENEFICIAIRE)}`);
    const exBirth = toIso(e.DATE_NAISSANCE);
    const nameOk = baseName === exName;
    const birthOk = baseBirth === exBirth;
    if (nameOk && birthOk) identiques++;
    else diffs.push({ code, base: `${baseName} ${baseBirth}`, excel: `${exName} ${exBirth}`, photo: row.has_photo ? 'oui' : 'NON' });
  }

  console.log(`Fiches actives du lot : ${res.rows.length}`);
  console.log(`  identiques base↔classeur : ${identiques}`);
  console.log(`  DIFFÉRENCES : ${diffs.length}`);
  diffs.forEach((d) => console.log(`    ${d.code}\n      base   : ${d.base} [photo:${d.photo}]\n      excel  : ${d.excel}`));
  console.log(`  codes absents du classeur : ${absents.length}`);
  absents.forEach((c) => console.log(`    ${c}`));

  // 3. Codes du classeur absents de la base
  const codesBase = new Set(res.rows.map((r) => clean(r.cmu_number).toUpperCase()));
  const manquants = [...excel.keys()].filter((c) => !codesBase.has(c));
  console.log(`\nCodes classeur absents de la base : ${manquants.length}`);
  manquants.forEach((c) => {
    const e = excel.get(c);
    console.log(`  ${c} ${norm(`${clean(e.PRENOM_BENEFICIAIRE)} ${clean(e.NOM_BENEFICIAIRE)}`)} ${toIso(e.DATE_NAISSANCE)}`);
  });

  await pool.end();
})().catch((e) => { console.error('ERREUR :', e.stack); pool.end().catch(() => {}); process.exit(1); });
