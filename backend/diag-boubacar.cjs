/* Debug : 1.3 Boubacar Diallo — consommé ? par qui ? */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

(async () => {
  const dir = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES';
  const f = '1.3 Boubacar Diallo.jpeg';
  const b64 = fs.readFileSync(path.join(dir, f)).toString('base64');
  const r = await query(
    `SELECT cmu_number, first_name, last_name, lot_code,
            (photo_url IS NOT NULL AND photo_url<>'') AS photo,
            LENGTH(photo_url) AS len
     FROM beneficiaries WHERE merged_into IS NULL AND LENGTH(photo_url) > $1 - 100 AND LENGTH(photo_url) < $1 + 100`,
    [b64.length + 23]
  );
  console.log('Fiches avec photo de longueur proche (±100) :', r.rows.length);
  r.rows.forEach((x) => console.log(' ', x.cmu_number, x.first_name, x.last_name, 'len=' + x.len, 'target=' + (b64.length + 23)));

  // Vérifier la présence exacte du b64 en base
  const r2 = await query(`SELECT cmu_number, first_name, last_name FROM beneficiaries WHERE photo_url = $1`, [`data:image/jpeg;base64,${b64}`]);
  console.log('Contenu EXACT présent pour :', r2.rows.map((x) => `${x.cmu_number} ${x.first_name} ${x.last_name}`));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
