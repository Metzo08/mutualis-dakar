/* ═══════════════
   MINEURS ATTENDUS (classeur AMEVI) vs MINEURS PRÉSENTS (base), par ménage
   ═══════════════
   Détecte tous les ménages où la carte de l'adhérent devrait afficher plus
   de mineurs qu'elle n'en a, parce que les fiches mineures manquent en base.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const XLSX = require('xlsx');
const path = require('path');
const { query, pool } = require('./db');

const EXCEL = path.join(__dirname, '..', 'MSD DAKAR', 'AMEVI.xlsx');
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const isoOf = (d) => {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(d).slice(0, 10);
};
const ageOf = (iso) => {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Math.floor((Date.now() - new Date(+m[1], +m[2] - 1, +m[3]).getTime()) / 31557600000);
};
const baseOf = (code) => (String(code || '').match(/^(DKR_\d+)/i) || [])[1] || null;

(async () => {
  // ── Classeur : tous les DKR_2600*, mineurs par ménage ────────────────
  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => baseOf(clean(r.CODE_BENEFICIAIRE)));
  const excelMineurs = new Map(); // base → [{code, nom, né}]
  const excelTous = new Set();
  for (const r of lignes) {
    const code = clean(r.CODE_BENEFICIAIRE).toUpperCase();
    excelTous.add(code);
    const a = ageOf(isoOf(r.DATE_NAISSANCE));
    if (a !== null && a < 18) {
      const b = baseOf(code);
      if (!excelMineurs.has(b)) excelMineurs.set(b, []);
      excelMineurs.get(b).push({ code, nom: `${clean(r.PRENOM_BENEFICIAIRE)} ${clean(r.NOM_BENEFICIAIRE)}`.trim(), né: isoOf(r.DATE_NAISSANCE), âge: a });
    }
  }

  // ── Base : fiches DKR_2600* actives ──────────────────────────────────
  const r = await query(`
    SELECT cmu_number, first_name, last_name, birth_date FROM beneficiaries
    WHERE merged_into IS NULL AND cmu_number LIKE 'DKR\\_2600%'
  `);
  const baseTous = new Set(r.rows.map((x) => clean(x.cmu_number).toUpperCase()));

  // ── Compare ──────────────────────────────────────────────────────────
  console.log('Ménages avec mineurs manquants en base :\n');
  let totalManquants = 0;
  for (const [b, mineurs] of excelMineurs) {
    const manquants = mineurs.filter((m) => !baseTous.has(m.code));
    if (manquants.length === 0) continue;
    totalManquants += manquants.length;
    const adhe = r.rows.find((x) => clean(x.cmu_number).toUpperCase() === `${b}.0`);
    console.log(`${b} (adhérent ${adhe ? adhe.first_name + ' ' + adhe.last_name : 'ABSENT'}):`);
    for (const m of manquants) console.log(`   ❌ ABSENT  ${m.code}  ${m.nom}  né=${m.né} (${m.âge} ans)`);
    for (const m of mineurs.filter((x) => baseTous.has(x.code))) console.log(`   ✅ présent ${m.code}  ${m.nom}`);
  }
  console.log(`\nTotal mineurs manquants (DKR_2600*) : ${totalManquants}`);

  // ── Inventaire complet des codes DKR_2600* manquants (tous âges) ─────
  const manquantsTous = [...excelTous].filter((c) => !baseTous.has(c) && baseOf(c));
  console.log(`\nTotal codes DKR_2600* manquants (tous âges) : ${manquantsTous.length}`);

  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => { }); process.exit(1); });
