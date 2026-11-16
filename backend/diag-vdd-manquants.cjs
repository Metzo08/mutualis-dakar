/* ═══════════════
   CODES DU CLASSEUR AMEVI ABSENTS DE LA BASE + résolution des 80 orphelins
   ═══════════════
   1. Classeur AMEVI.xlsx : liste des codes DKR_2600* uniques.
   2. Base : codes présents (actifs ET fusionnés).
   3. Codes manquants → avec identité, pour insertion (comme Grand Yoff).
   4. Les 80 fichiers orphelins → recherche tolérante (Levenshtein) dans le
      classeur ET la base pour distinguer variante orthographique vs fiche absente.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const ROOT = path.join(__dirname, '..');
const EXCEL = path.join(ROOT, 'MSD DAKAR', 'AMEVI.xlsx');
const DIR = path.join(ROOT, 'Photos AMEVI ville de Dakar');

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).replace(/ /g, '');
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

const levenshtein = (a, b) => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

const isImg = (f) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(f);
const isoOf = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(d).slice(0, 10);
};

(async () => {
  // ── 1. Classeur ──────────────────────────────────────────────────────
  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => clean(r.CODE_BENEFICIAIRE));
  console.log(`Classeur AMEVI : ${lignes.length} lignes avec code`);

  // Dédoublonne par code (dernière ligne gagnante)
  const byCode = new Map();
  for (const r of lignes) byCode.set(clean(r.CODE_BENEFICIAIRE).toUpperCase(), r);

  // ── 2. Base ──────────────────────────────────────────────────────────
  const base = await query(`
    SELECT cmu_number, first_name, last_name, birth_date, merged_into, lot_code
    FROM beneficiaries WHERE cmu_number LIKE 'DKR\\_2600%'
  `);
  const baseCodes = new Map();
  for (const r of base.rows) baseCodes.set(clean(r.cmu_number).toUpperCase(), r);

  // ── 3. Codes manquants ───────────────────────────────────────────────
  const manquants = [...byCode.keys()].filter((c) => !baseCodes.has(c));
  console.log(`Codes classeur absents de la base : ${manquants.length}`);
  for (const c of manquants) {
    const r = byCode.get(c);
    console.log(`  ${c}  ${clean(r.PRENOM_BENEFICIAIRE)} ${clean(r.NOM_BENEFICIAIRE)}  né=${isoOf(r.DATE_NAISSANCE)}  lieu=${clean(r.LIEU_NAISSANCE)}`);
  }

  // Codes en base absents du classeur (importés d'où ?)
  const horsClasseur = [...baseCodes.keys()].filter((c) => !byCode.has(c));
  console.log(`\nCodes en base ABSENTS du classeur : ${horsClasseur.length}`);
  horsClasseur.slice(0, 10).forEach((c) => {
    const r = baseCodes.get(c);
    console.log(`  ${c}  ${r.first_name} ${r.last_name} lot=${r.lot_code} merged=${r.merged_into || '-'}`);
  });

  // ── 4. Résolution des orphelins ──────────────────────────────────────
  console.log('\n═══ RÉSOLUTION DES 80 FICHIERS ORPHELINS ═══');
  const orphelins = [];
  for (const f of fs.readdirSync(DIR).filter(isImg).sort()) {
    const base0 = f.replace(/\.[^.]+$/, '');
    const idPart = base0.replace(/^\s*\d+\.\d+\s+/, '').split(/ né | née |Ne le|Née le/i)[0];
    const k = key(idPart);
    if (!byCode.has(k) && !baseCodes.has(k)) {
      // cherche par identité complète dans le classeur et la base
      let excelMatch = null, baseMatch = null;
      for (const r of lignes) {
        const rk = key(`${r.PRENOM_BENEFICIAIRE} ${r.NOM_BENEFICIAIRE}`);
        if (!rk) continue;
        const d = levenshtein(k, rk);
        if (d <= 3 && (!excelMatch || d < excelMatch.d)) excelMatch = { d, rk, r };
      }
      for (const r of base.rows) {
        const rk = key(`${r.first_name} ${r.last_name}`);
        if (!rk) continue;
        const d = levenshtein(k, rk);
        if (d <= 3 && (!baseMatch || d < baseMatch.d)) baseMatch = { d, rk, r };
      }
      orphelins.push({ file: f, k, excelMatch, baseMatch });
    }
  }
  console.log(`Orphelins à résoudre : ${orphelins.length}\n`);
  for (const o of orphelins) {
    const ex = o.excelMatch ? `EXCEL(${o.excelMatch.d}): ${o.excelMatch.rk} code=${clean(o.excelMatch.r.CODE_BENEFICIAIRE)}` : 'EXCEL:Ø';
    const bs = o.baseMatch ? `BASE(${o.baseMatch.d}): ${o.baseMatch.rk} ${o.baseMatch.r.cmu_number}` : 'BASE:Ø';
    console.log(`  ${o.file}\n    clé=${o.k}\n    ${ex}\n    ${bs}`);
  }

  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => { }); process.exit(1); });
