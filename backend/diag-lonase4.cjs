/* ASS LONASE : analyse complète 65 fiches sans photo
 * Les fichiers du dossier ASS LONASE ont tous une photo en base (déjà rattachées).
 * Les 65 fiches sans photo : où sont-elles au classeur ?
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const XLSX = require('xlsx');
const { query, pool } = require('./db');
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

(async () => {
  const wb = XLSX.readFile('C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE.xlsx', { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const excel = new Map();
  lignes.forEach((r) => excel.set(clean(r.CODE_BENEFICIAIRE).toUpperCase(), r));

  // Fichiers du dossier : tous ont déjà une photo. Vérifions qu'aucun ne cible les 65.
  const fiches = await query("SELECT cmu_number, first_name, last_name, birth_date, birth_place, lot_code FROM beneficiaries WHERE merged_into IS NULL AND lot_code IN ('LOT-2026-011','LOT-2026-015') AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number");
  console.log('Fiches sans photo :', fiches.rows.length);

  // Parmi ces 65 : combien sont ADHÉRENTS avec PHOTO='OUI' au classeur (photo jamais fournie) vs PHOTO vide ?
  let photoOui = 0, photoVide = 0, absentClasseur = 0;
  const resume = [];
  for (const f of fiches.rows) {
    const e = excel.get(String(f.cmu_number).toUpperCase());
    if (!e) { absentClasseur++; resume.push([f, null]); continue; }
    const p = clean(e.PHOTO);
    if (/oui|true|1/i.test(p)) photoOui++; else photoVide++;
    resume.push([f, p]);
  }
  console.log(`  PHOTO=OUI au classeur : ${photoOui}`);
  console.log(`  PHOTO vide/autre      : ${photoVide}`);
  console.log(`  absentes du classeur  : ${absentClasseur}`);

  // Les fichiers photos portent des codes : vérifier s'il existe des fiches AVEC photo dont le fichier est le même que des fiches sans photo
  // (non : fichiers déjà utilisés). Vérifions plutôt : les 65 sont-elles majoritairement du lot 015 (fiches déjà importées + photos du dossier 015 utilisées) ?
  const parLot = {};
  fiches.rows.forEach((f) => parLot[f.lot_code] = (parLot[f.lot_code] || 0) + 1);
  console.log('  par lot :', JSON.stringify(parLot));

  // Contrôle : le classeur 122 lignes, base 121 — quelle ligne manque ?
  const base011 = await query("SELECT cmu_number FROM beneficiaries WHERE merged_into IS NULL AND lot_code='LOT-2026-011'");
  const codesBase = new Set(base011.rows.map((r) => String(r.cmu_number).toUpperCase()));
  const absents = [...excel.keys()].filter((c) => !codesBase.has(c));
  console.log('\nCodes classeur absents de la base :', absents.length);
  absents.forEach((c) => {
    const e = excel.get(c);
    console.log('  ', c, clean(e.PRENOM_BENEFICIAIRE), clean(e.NOM_BENEFICIAIRE), 'PHOTO=' + clean(e.PHOTO));
  });
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
