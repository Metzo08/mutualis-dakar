/* Test SANS écriture : vérifie le découpage prénom/nom des 57 lignes. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const XLSX = require('xlsx');
const path = require('path');
const { query, pool } = require('./db');

const EXCEL = path.join(__dirname, '..', 'MSD DAKAR', 'AMEVI.xlsx');
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

(async () => {
  const wb = XLSX.readFile(EXCEL, { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => /^DKR_\d+/.test(clean(r.CODE_BENEFICIAIRE).toUpperCase()));
  const dejaEnBase = new Set(
    (await query(`SELECT upper(btrim(cmu_number)) c FROM beneficiaries WHERE cmu_number LIKE 'DKR\\_2600%'`)).rows.map((r) => r.c)
  );
  const manquantes = lignes.filter((r) => !dejaEnBase.has(clean(r.CODE_BENEFICIAIRE).toUpperCase()));
  console.log(`À insérer : ${manquantes.length}\n`);

  let suspects = 0;
  for (const r of manquantes) {
    const fullName = clean(r.PRENOM_BENEFICIAIRE);
    const colNom = clean(r.NOM_BENEFICIAIRE);
    const toks = fullName.split(/\s+/).filter(Boolean);
    const firstName = toks.length > 1 ? toks.slice(0, -1).join(' ') : (toks[0] || '');
    const lastNameFinal = colNom || toks[toks.length - 1] || '';
    // suspect si NOM_BENEFICIAIRE n'est pas le dernier token de PRENOM_...
    const dernier = toks[toks.length - 1] || '';
    if (colNom && norm(dernier) !== norm(colNom)) {
      suspects++;
      console.log(`⚠️ ${clean(r.CODE_BENEFICIAIRE)} PRENOM="${fullName}" NOM_COL="${colNom}" → first="${firstName}" last="${lastNameFinal}"`);
    }
  }
  console.log(`\nSuspects : ${suspects} / ${manquantes.length}`);

  // Comparaison avec les fiches Grand Yoff déjà insérées (référence de style)
  const gy = await query(`SELECT first_name, last_name, cmu_number FROM beneficiaries WHERE lot_code='LOT-2026-034' AND merged_into IS NULL LIMIT 3`);
  gy.rows.forEach((x) => console.log('  style GY :', JSON.stringify(x)));

  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => {}); process.exit(1); });
function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
