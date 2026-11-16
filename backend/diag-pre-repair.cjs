/* Vérifications pré-réparation Grand Yoff
 * 1. Fichiers avec date 08-08-1972 (Mame Penda DIAWO vs DIAO)
 * 2. Fatou FAYE (2282.1) : fichier "Fatou Faye ... 09-09-1961 Dagana" appartient à 2190.1 ?
 * 3. Doublon de classement : 2161.2 AWA CISSE en base vs ASTOU KOITA au classeur
 * Usage : node backend/diag-pre-repair.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { query, pool } = require('./db');

const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD de Grand Yoff';

(async () => {
  console.log('--- 1. Fichiers contenant 08-08-1972 (Mame Penda) ---');
  for (const f of fs.readdirSync(DIR)) {
    if (/0?8-0?8-1972|08081972/.test(f)) console.log('  ', f);
  }

  console.log('--- 2. Fichiers contenant Fatou Faye ---');
  for (const f of fs.readdirSync(DIR)) {
    if (/fatou\s*faye/i.test(f)) console.log('  ', f);
  }

  console.log('--- 3. Base : 2282.1 vs 2190.1 (Fatou Faye) ---');
  const r = await query("SELECT cmu_number, first_name, last_name, birth_date, birth_place, photo_url IS NOT NULL AND photo_url<>'' AS photo FROM beneficiaries WHERE cmu_number IN ('DKR-DKR-2026-2282.1','DKR-DKR-2026-2190.1')");
  r.rows.forEach((x) => console.log('  ', x.cmu_number, x.first_name, x.last_name, x.birth_date, x.birth_place, 'photo=' + x.photo));

  console.log('--- 4. Base : 2161.2 (en base AWA CISSE / classeur ASTOU KOITA) ---');
  const r2 = await query("SELECT cmu_number, first_name, last_name, birth_date, photo_url IS NOT NULL AND photo_url<>'' AS photo, numero_adherent, source_code FROM beneficiaries WHERE cmu_number LIKE 'DKR-DKR-2026-2161.%'");
  r2.rows.forEach((x) => console.log('  ', JSON.stringify(x)));

  await pool.end();
})().catch((e) => { console.error('ERREUR :', e.stack); pool.end().catch(() => { }); process.exit(1); });
