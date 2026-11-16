/* Diagnostic ASS LONASE complet : fiches du lot 011/015 vs fichiers photos */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE';
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

(async () => {
  // Fiches des lots LONASE
  const r = await query("SELECT DISTINCT lot_code, count(*) FROM beneficiaries WHERE merged_into IS NULL GROUP BY 1 ORDER BY 1");
  console.log('Tous les lots :', JSON.stringify(r.rows));

  const fiches = await query("SELECT cmu_number, first_name, last_name, birth_date, lot_code FROM beneficiaries WHERE merged_into IS NULL AND lot_code IN ('LOT-2026-011','LOT-2026-015') AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number");
  console.log(`\nFiches lots 011+015 sans photo : ${fiches.rows.length}`);

  // Index fichiers LONASE : par code (norm) et par nom
  const fs_ = fs.readdirSync(DIR);
  const parCode = new Map(), parNom = new Map();
  for (const f of fs_) {
    const base = f.replace(/\.(jpe?g|png|webp)$/i, '');
    const m = base.match(/^(DKR_26\d+\.?\d*)/);
    if (m) parCode.set(norm(m[1]), base);
    const nomPart = base.replace(/^DKR_26\d+\.?\d*\s*/, '').replace(/\.(jpe?g|png|webp)$/i, '');
    parNom.set(norm(nomPart), base);
  }
  const parNomFiche = new Map();
  for (const f of fiches.rows) parNomFiche.set(norm(`${f.first_name}${f.last_name}`), f);

  // Rattachables par CODE
  let okCode = [];
  for (const [code, file] of parCode) {
    const fiche = fiches.rows.find((x) => norm(x.cmu_number) === code);
    if (fiche) okCode.push({ fiche, file });
  }
  console.log(`\nAppariables par CODE : ${okCode.length}`);
  okCode.slice(0, 10).forEach((x) => console.log(`   ${x.fiche.cmu_number} ${x.fiche.first_name} ${x.fiche.last_name} <- ${x.file}`));

  // Rattachables par NOM (date à vérifier après)
  let okNom = [];
  for (const [nom, file] of parNom) {
    const fiche = parNomFiche.get(nom);
    if (fiche && !okCode.some((x) => x.fiche === fiche)) okNom.push({ fiche, file });
  }
  console.log(`\nAppariables par NOM (hors code) : ${okNom.length}`);
  okNom.slice(0, 20).forEach((x) => console.log(`   ${x.fiche.cmu_number} ${x.fiche.first_name} ${x.fiche.last_name} <- ${x.file}`));

  console.log(`\nResteraient sans photo : ${fiches.rows.length - okCode.length - okNom.length}`);
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
