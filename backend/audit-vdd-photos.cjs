/* ═══════════════
   AUDIT PHOTOS VILLE DE DAKAR (LOT-2026-030) — lecture seule
   ═══════════════
   Répond à 4 questions avant toute écriture :
   1. État du lot 030 en base (total, avec photo, sans photo).
   2. Inventaire EXACT des dossiers photos AMEVI (2 dossiers).
   3. Classeur AMEVI.xlsx : quels codes y figurent ?
   4. Croisement : chaque fiche sans photo a-t-elle des fichiers candidats ?
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const ROOT = path.join(__dirname, '..');
const DIR_RENOMMEES = path.join(ROOT, 'Photos AMEVI ville de Dakar RENOMMEES');
const DIR_ORIGINAL = path.join(ROOT, 'Photos AMEVI ville de Dakar');
const EXCEL = path.join(ROOT, 'MSD DAKAR', 'AMEVI.xlsx');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

(async () => {
  // ── 1. État du lot 030 ──────────────────────────────────────────────
  const lot = await query(`
    SELECT cmu_number, first_name, last_name, birth_date, birth_place, numero_adherent,
           (photo_url IS NOT NULL AND photo_url <> '') AS photo
    FROM beneficiaries
    WHERE merged_into IS NULL AND lot_code='LOT-2026-030'
    ORDER BY cmu_number
  `);
  const total = lot.rows.length;
  const avecPhoto = lot.rows.filter((r) => r.photo).length;
  console.log(`═══ LOT-2026-030 : ${total} fiches, ${avecPhoto} avec photo, ${total - avecPhoto} SANS photo ═══`);
  console.log('\nFiches SANS photo :');
  lot.rows.filter((r) => !r.photo).forEach((r) =>
    console.log(`  ${clean(r.cmu_number).padEnd(16)} ${clean(r.first_name)} ${clean(r.last_name)} né=${clean(r.birth_date)} lieu=${clean(r.birth_place)}`));

  // ── 2. Inventaire des dossiers photos ───────────────────────────────
  const isImg = (f) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(f);
  const listRenom = fs.existsSync(DIR_RENOMMEES) ? fs.readdirSync(DIR_RENOMMEES).filter(isImg) : [];
  const listOrig = fs.existsSync(DIR_ORIGINAL) ? fs.readdirSync(DIR_ORIGINAL).filter(isImg) : [];
  console.log(`\n═══ PHOTOS SUR DISQUE ═══`);
  console.log(`  "Photos AMEVI ville de Dakar RENOMMEES" : ${listRenom.length} fichiers`);
  console.log(`  "Photos AMEVI ville de Dakar" (original) : ${listOrig.length} fichiers`);

  // ── 3. Classeur AMEVI ────────────────────────────────────────────────
  let lignesExcel = [];
  if (fs.existsSync(EXCEL)) {
    const wb = XLSX.readFile(EXCEL, { cellDates: true });
    lignesExcel = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  }
  console.log(`  AMEVI.xlsx : ${lignesExcel.length} lignes`);
  const cols = lignesExcel.length > 0 ? Object.keys(lignesExcel[0]) : [];
  console.log(`  Colonnes : ${cols.join(' | ')}`);

  // Échantillon des 5 premières lignes
  lignesExcel.slice(0, 5).forEach((r) =>
    console.log('  ', JSON.stringify(Object.fromEntries(Object.entries(r).slice(0, 8)))));

  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => {}); process.exit(1); });
