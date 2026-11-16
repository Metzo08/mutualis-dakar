/* Les 18 restantes : fichiers candidats « sans préfixe » (Prénom Nom.jpeg) */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

const DIRS = [
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar',
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES',
];
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  // Fichiers SANS préfixe
  const nus = [];
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      if (/^(DKR_2600\d+\.\d+|\d+\.\d+)\s/i.test(f)) continue;
      nus.push({ dir, f, mots: norm(f.replace(/\.(jpe?g|png|webp)$/i, '')).split(' ').filter(Boolean) });
    }
  }
  console.log('Fichiers sans préfixe :', nus.length);
  nus.forEach((x) => console.log('  ', `${x.dir.split('/').pop()}/${x.f}`));

  // Fiches restantes
  const fiches = await query(
    `SELECT cmu_number, first_name, last_name, birth_date
       FROM beneficiaries WHERE lot_code='LOT-2026-030' AND merged_into IS NULL
       AND (photo_url IS NULL OR photo_url='') ORDER BY cmu_number`
  );
  console.log('\nFiches restantes :', fiches.rows.length);
  for (const fiche of fiches.rows) {
    const motsF = norm(`${fiche.first_name} ${fiche.last_name}`).split(' ').filter(Boolean);
    const nomFamille = motsF[motsF.length - 1];
    const cands = nus.filter((img) => {
      if (img.mots.some((w) => !motsF.some((mf) => mf.startsWith(w) || w.startsWith(mf)))) return false;
      if (!img.mots.some((w) => w === nomFamille || nomFamille.startsWith(w) || w.startsWith(nomFamille))) return false;
      return true;
    });
    console.log(`${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} -> ${cands.length ? cands.map((c) => c.f).join(' | ') : 'AUCUN'}`);
  }
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
