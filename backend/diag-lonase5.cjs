/* Vérifie que les photo_url en base correspondent bien au contenu des fichiers LONASE */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE';

(async () => {
  const files = fs.readdirSync(DIR);
  let ok = 0, diff = 0, absents = [];
  for (const f of files) {
    const code = (f.match(/^(DKR_26\d+\.?\d*)/i) || [])[1];
    if (!code) continue;
    const b = await query("SELECT cmu_number, photo_url FROM beneficiaries WHERE UPPER(cmu_number)=UPPER($1)", [code]);
    if (!b.rows[0]) { absents.push(code); continue; }
    const stored = String(b.rows[0].photo_url || '');
    const buf = fs.readFileSync(path.join(DIR, f));
    // comparer la taille décodée et un extrait
    const m = stored.match(/^data:image\/[a-z]+;base64,(.{20})/);
    const headFile = buf.slice(0, 10).toString('base64').slice(0, 20);
    const matches = m ? (m[1].slice(0, 10) === headFile.slice(0, 10)) : false;
    // fallback : comparaison des longueurs
    const b64len = Math.round(buf.length * 4 / 3);
    const lenClose = Math.abs(stored.length - b64len) < b64len * 0.2;
    if (matches || lenClose) ok++;
    else { diff++; console.log('DIFF', code, 'stockée:', stored.length, 'fichier~', b64len, stored.slice(0, 30)); }
  }
  console.log(`Fichiers LONASE : identiques en base = ${ok}, différents = ${diff}, codes absents = ${absents.length}`);
  absents.forEach((c) => console.log('  absent :', c));
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => { }); process.exit(1); });
