/* Les 18 restantes : candidats préfixés 1.x avec tolérance de 1 caractère */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

const DIRS = [
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES',
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar',
];
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
const lev = (a, b) => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 9;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};
const proche = (a, b) => (a === b) || (a.length >= 4 && b.length >= 4 && lev(a, b) <= 1);

(async () => {
  // fichiers préfixés 1.x (clé = préfixe + nom, comme reparer-vdd)
  const fichiers = [];
  const vu = new Set();
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      const m = f.match(/^(\d+)\.(\d+)\s+(.+)$/);
      if (!m) continue;
      const nomPart = m[3].replace(/\.(jpe?g|png|webp)$/i, '');
      const cle = `L${parseInt(m[1], 10)}.${parseInt(m[2], 10)} ${norm(nomPart.replace(/\d{1,2}[-\/ ]\d{1,2}[-\/ ]\d{2,4}/g, ''))}`.trim();
      if (vu.has(cle)) continue;
      vu.add(cle);
      fichiers.push({ dir, f, menage: parseInt(m[1], 10), membre: parseInt(m[2], 10), mots: norm(nomPart.replace(/\d{1,2}[-\/ ]\d{1,2}[-\/ ]\d{2,4}/g, '')).split(' ').filter(Boolean) });
    }
  }
  console.log('Fichiers locaux :', fichiers.length);

  const fiches = await query(
    `SELECT cmu_number, first_name, last_name, birth_date
       FROM beneficiaries WHERE lot_code='LOT-2026-030' AND merged_into IS NULL
       AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number`
  );
  for (const fiche of fiches.rows) {
    const motsF = norm(`${fiche.first_name} ${fiche.last_name}`).split(' ').filter(Boolean);
    const nomFamille = motsF[motsF.length - 1];
    const cands = fichiers.filter((img) => {
      // nom de famille obligatoire (exact ou 1 caractère d'écart)
      if (!img.mots.some((w) => proche(w, nomFamille))) return false;
      // tous les mots du fichier proches d'un mot de la fiche
      const etranger = img.mots.filter((w) => !motsF.some((mf) => proche(w, mf)));
      return etranger.length === 0;
    });
    console.log(`${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} -> ${cands.length ? cands.map((c) => `${c.f}`).join(' | ') : 'AUCUN'}`);
  }
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
