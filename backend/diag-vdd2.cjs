/* VILLE DE DAKAR : fiches sans photo vs fichiers AMEVI (nommage "N.M Prénom Nom") */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

(async () => {
  const fiches = await query("SELECT cmu_number, first_name, last_name, birth_date, numero_adherent FROM beneficiaries WHERE merged_into IS NULL AND lot_code='LOT-2026-030' AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number");
  console.log('Sans photo :', fiches.rows.length);

  // index fichiers AMEVI par "numéro adhérent" (le préfixe 1.x du fichier)
  const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar';
  const parNum = new Map();
  for (const f of fs.readdirSync(DIR)) {
    const m = f.match(/^(\d+\.\d+)\s/);
    if (m) parNum.set(m[1], f);
  }

  // les fiches du lot 030 : leurs codes DKR_26000X.Y ↔ préfixe X.Y ?
  let ok = [];
  for (const f of fiches.rows) {
    const m = String(f.cmu_number).match(/DKR_2600(\d+)\.(\d+)/);
    if (!m) continue;
    const cle = `${parseInt(m[1], 10)}.${parseInt(m[2], 10)}`;
    const file = parNum.get(cle);
    if (file) ok.push({ fiche: f, cle, file });
  }
  console.log('Appariables par numérotation :', ok.length);
  ok.forEach((x) => console.log(`   ${x.fiche.cmu_number} ${x.fiche.first_name} ${x.fiche.last_name} [${x.cle}] <- ${x.file}`));

  // vérification identité : nom du fichier contient-il prénom/nom ?
  let verif = 0, suspects = [];
  for (const x of ok) {
    const nf = norm(`${x.fiche.first_name}${x.fiche.last_name}`);
    const fn = norm(x.file.replace(/^\d+\.\d+\s*/, '').replace(/\.jpe?g$/i, ''));
    // le fichier commence par le prénom ?
    const nomFichierMots = fn.replace(/\d+/g, '');
    if (nomFichierMots.startsWith(norm(x.fiche.first_name).replace(/\s/g, ''))) verif++;
    else suspects.push(`${x.fiche.cmu_number} [${x.cle}] ${x.fiche.first_name} ${x.fiche.last_name}  vs fichier "${x.file}"`);
  }
  console.log(`\nPrénom en tête du fichier : ${verif}/${ok.length}`);
  console.log('Suspects :');
  suspects.forEach((s) => console.log('  ', s));

  // fiches restantes sans correspondance
  const trouves = new Set(ok.map((x) => x.fiche.cmu_number));
  const reste = fiches.rows.filter((f) => !trouves.has(f.cmu_number));
  console.log('\nSans correspondance :', reste.length);
  reste.forEach((f) => console.log('  ', f.cmu_number, `${f.first_name} ${f.last_name}`, f.birth_date));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
