/* Debug : pourquoi DKR_2600010.12 ne trouve pas 1.1 Zeinabou T Sow.jpeg */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

(async () => {
  const dir = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES';
  const f = fs.readdirSync(dir).find((x) => /zeinabou/i.test(x));
  console.log('fichier trouvé :', f);
  const sansExt = f.replace(/\.(jpe?g|png|webp)$/i, '');
  const mi = sansExt.match(/^(\d+)\.(\d+)\s+(.+)$/);
  console.log('regex match :', mi);
  const nomPart = mi ? mi[3] : sansExt;
  const mots = norm(nomPart).split(' ').filter(Boolean);
  console.log('mots :', mots);

  const fiches = await query("SELECT cmu_number, first_name, last_name, birth_date FROM beneficiaries WHERE cmu_number IN ('DKR_2600010.12','DKR_2600010.3','DKR_2600010.6','DKR_2600010.7','DKR_2600013.0','DKR_2600013.1')");
  fiches.rows.forEach((b) => {
    const motsF = norm(`${b.first_name} ${b.last_name}`).split(' ').filter(Boolean);
    const ok = !mots.some((w) => !motsF.some((mf) => mf.startsWith(w) || w.startsWith(mf)));
    console.log(b.cmu_number, JSON.stringify(motsF), 'tous mots du fichier présents :', ok);
  });
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
