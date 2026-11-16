/* VDD : apparier les 47 fiches sans photo avec les fichiers AMEVI (par nom + date)
 * Dossiers : 'Photos AMEVI ville de Dakar' (nommage par nom) et 'RENOMMEES' (1.x nom)
 * Règle de sécurité : date de naissance trouvée dans le nom de fichier = OBLIGATOIREMENT
 * identique. Sinon, nom de famille + prénom proches seulement (à valider).
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const DIRS = [
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar',
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES',
];
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const levenshtein = (a, b) => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

(async () => {
  // 1. index des fichiers (nom normalisé → liste de fichiers avec dates extraites)
  const index = [];
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      const sansExt = f.replace(/\.(jpe?g|png|webp)$/i, '');
      const dates = [...sansExt.matchAll(/(\d{1,2})[-\/ ](\d{1,2})[-\/ ](\d{2,4})/g)].map((m) => {
        let y = m[3]; if (y.length === 2) y = '19' + y;
        return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      });
      const identite = norm(sansExt.replace(/\d{1,2}[-\/ ]\d{1,2}[-\/ ]\d{2,4}/g, ''));
      index.push({ dir, f, identite, dates });
    }
  }

  // 2. fiches LOT-2026-030 sans photo
  const fiches = await query(`SELECT cmu_number, first_name, last_name, birth_date
    FROM beneficiaries WHERE merged_into IS NULL AND lot_code='LOT-2026-030'
    AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number`);

  let rapproches = 0, ambigus = 0;
  const reste = [];
  for (const fiche of fiches.rows) {
    const nomFiche = norm(`${fiche.first_name} ${fiche.last_name}`);
    const motsFiche = nomFiche.split(' ').filter(Boolean);
    const nomFamille = motsFiche[motsFiche.length - 1] || '';
    const prenoms = motsFiche.slice(0, -1);
    const birth = String(fiche.birth_date || '');

    // candidats : partagent le nom de famille ET au moins un prénom
    const cands = index.filter((x) => {
      if (!x.identite.includes(nomFamille)) return false;
      const motsF = x.identite.split(' ');
      return prenoms.some((p) => motsF.includes(p) || motsF.some((mf) => levenshtein(mf, p) <= 2 && Math.min(mf.length, p.length) >= 4));
    });

    if (cands.length === 0) { reste.push(fiche); continue; }

    // filtre par date si les fichiers en portent une
    const avecDate = cands.filter((c) => c.dates.length > 0);
    if (avecDate.length > 0) {
      const exact = avecDate.filter((c) => c.dates.every((d) => d === birth));
      const autres = avecDate.filter((c) => !c.dates.every((d) => d === birth));
      if (exact.length === 1 && autres.length === 0) {
        rapproches++;
        console.log(`OK   ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] <- ${exact[0].f}`);
        continue;
      }
      if (exact.length === 1 && autres.length > 0) {
        console.log(`??   ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] candidats exact : ${exact.map((e) => e.f).join(', ')} | dates différentes : ${autres.map((e) => `${e.f}(${e.dates.join(',')})`).join(', ')}`);
        ambigus++;
        continue;
      }
      if (exact.length === 0) {
        console.log(`X    ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] fichiers même nom mais dates : ${avecDate.map((e) => `${e.f}(${e.dates.join(',')})`).join(', ')}`);
        ambigus++;
        continue;
      }
      console.log(`??   ${fiche.cmu_number} PLUSIEURS exact : ${exact.map((e) => e.f).join(', ')}`);
      ambigus++;
      continue;
    }
    // fichiers sans date
    if (cands.length === 1) {
      rapproches++;
      console.log(`OK*  ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] <- ${cands[0].f} (sans date dans le fichier)`);
    } else {
      console.log(`??   ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] candidats sans date : ${cands.map((e) => e.f).join(', ')}`);
      ambigus++;
    }
  }

  console.log(`\n=== SYNTHÈSE : rapprochés ${rapproches}, ambigus ${ambigus}, sans candidat ${reste.length} ===`);
  reste.forEach((f) => console.log(`  RESTE ${f.cmu_number} ${f.first_name} ${f.last_name} [${f.birth_date}]`));

  // 3. autres lots (015 : 1 fiche, 034 : 21) — rappel
  const autres = await query(`SELECT cmu_number, first_name, last_name, birth_date, lot_code
    FROM beneficiaries WHERE merged_into IS NULL AND lot_code IN ('LOT-2026-011','LOT-2026-015')
    AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number`);
  console.log(`\nAutres lots sans photo : ${autres.rows.length}`);
  autres.rows.forEach((f) => console.log(`  ${f.lot_code} ${f.cmu_number} ${f.first_name} ${f.last_name} [${f.birth_date}]`));
  await pool.end();
})().catch((e) => { console.error('ERREUR :', e.stack); pool.end().catch(() => { }); process.exit(1); });
