/* Debug 2 : quelles fiches revendiquent les fichiers 1.x en premier ? */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
const extraireDates = (txt) => {
  const out = [];
  for (const m of txt.matchAll(/(\d{1,2})[-\/ ](\d{1,2})[-\/ ](\d{2,4})/g)) {
    let y = m[3]; if (y.length === 2) y = (Number(y) > 30 ? '19' : '20') + y;
    out.push(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  }
  return out;
};

(async () => {
  const dir = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES';
  const fichiers = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
    const m = f.match(/^(\d+)\.(\d+)\s+(.+)$/);
    if (!m) continue;
    const sansExt = m[3].replace(/\.(jpe?g|png|webp)$/i, '');
    fichiers.push({
      cle: `L${parseInt(m[1], 10)}.${parseInt(m[2], 10)}`,
      menage: parseInt(m[1], 10), membre: parseInt(m[2], 10), f,
      mots: norm(sansExt.replace(/\d{1,2}[-\/ ]\d{1,2}[-\/ ]\d{2,4}/g, '')).split(' ').filter(Boolean),
      dates: extraireDates(sansExt),
    });
  }
  console.log('Fichiers index locaux :', fichiers.length);

  // Toutes les fiches LOT-2026-030 SANS photo, dans l'ordre du plan (cmu_number)
  const fiches = await query(
    `SELECT cmu_number, first_name, last_name, birth_date
       FROM beneficiaries WHERE lot_code='LOT-2026-030' AND merged_into IS NULL
       AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number`
  );

  const utilise = new Set();
  for (const fiche of fiches.rows) {
    const motsF = norm(`${fiche.first_name} ${fiche.last_name}`).split(' ').filter(Boolean);
    const birth = String(fiche.birth_date || '');
    const cands = fichiers.filter((img) => {
      if (utilise.has(img.cle)) return false;
      if (img.mots.some((w) => !motsF.some((mf) => mf.startsWith(w) || w.startsWith(mf)))) return false;
      const nomFamille = motsF[motsF.length - 1];
      if (!img.mots.some((w) => w === nomFamille || nomFamille.startsWith(w) || w.startsWith(nomFamille))) return false;
      if (img.dates.length > 0 && img.dates.every((d) => d !== birth)) return false;
      return true;
    });
    if (cands.length >= 1) {
      cands.forEach((c) => utilise.add(c.cle));
      console.log(`${fiche.cmu_number.padEnd(18)} ${(`${fiche.first_name} ${fiche.last_name}`).padEnd(30)} <- ${cands.map((c) => c.f).join(' | ')}`);
    } else {
      console.log(`${fiche.cmu_number.padEnd(18)} ${(`${fiche.first_name} ${fiche.last_name}`).padEnd(30)} -> aucun`);
    }
  }
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
