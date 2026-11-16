/* ═══════════════
   TABLE DE DÉCISION FINALE — 13 fiches VDD sans photo
   ═══════════════
   Pour chaque fiche : recherche flou (Levenshtein ≤ 4) parmi les 167
   fichiers AMEVI, puis VALIDATION par date de naissance quand le fichier
   en porte une. Un fichier ne peut servir qu'une seule fiche.
   LECTURE SEULE — c'est la table de décision.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'Photos AMEVI ville de Dakar');

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).replace(/ /g, '');

const levenshtein = (a, b) => {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

const extractDates = (name) => {
  const out = [];
  const re = /(\d{1,2})-(\d{1,2})-(\d{2,4})/g;
  let m;
  while ((m = re.exec(name)) !== null) {
    let [, d, mo, y] = m;
    y = y.length === 2 ? (parseInt(y, 10) > 30 ? 1900 + +y : 2000 + +y) : +y;
    out.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
};

const isImg = (f) => /\.(jpe?g|png|webp|gif|bmp)$/i.test(f);

(async () => {
  const fiches = await query(`
    SELECT cmu_number, first_name, last_name, birth_date
    FROM beneficiaries
    WHERE merged_into IS NULL AND lot_code='LOT-2026-030'
      AND (photo_url IS NULL OR photo_url='')
    ORDER BY cmu_number
  `);

  const files = fs.readdirSync(DIR).filter(isImg).sort().map((f) => {
    const base = f.replace(/\.[^.]+$/, '');
    const idPart = base.replace(/^\s*\d+\.\d+\s+/, '').split(/ né | née |Ne le|Née le/i)[0];
    return { file: f, k: key(idPart), dates: extractDates(base) };
  });

  console.log(`Fiches sans photo : ${fiches.rows.length} | fichiers : ${files.length}\n`);

  const used = new Set(); // un fichier ne sert qu'une fiche
  const decisions = [];

  for (const f of fiches.rows) {
    const code = String(f.cmu_number).trim();
    const fk = key(`${f.first_name} ${f.last_name}`);
    const born = String(f.birth_date || '').slice(0, 10);

    // Tous les fichiers triés par distance
    const ranked = files
      .filter((x) => !used.has(x.file))
      .map((x) => ({ ...x, d: levenshtein(fk, x.k) }))
      .filter((x) => x.d <= Math.max(4, Math.round(fk.length * 0.2)))
      .sort((a, b) => a.d - b.d);

    console.log(`${code}  ${f.first_name} ${f.last_name}  né=${born}  (clé=${fk})`);
    if (ranked.length === 0) {
      console.log('   => AUCUN fichier à moins de la tolérance. Photo introuvable sur disque.\n');
      decisions.push({ code, file: null });
      continue;
    }
    for (const c of ranked.slice(0, 4)) {
      const dateVerdict = c.dates.length === 0
        ? '(fichier sans date — nom seul)'
        : (c.dates.includes(born) ? '✅ date exacte' : `❌ date fichier=${c.dates.join(',')}`);
      console.log(`   dist=${c.d}  ${c.file}  ${dateVerdict}`);
    }
    // Décision : le meilleur candidat doit être exact sur la date si le fichier en porte une,
    // sinon distance 0-2 sur un nom assez long pour éviter l'homonymie.
    const best = ranked.find((c) =>
      c.dates.length === 0 ? (c.d <= 2 && fk.length >= 10) : c.dates.includes(born)
    );
    if (best) {
      used.add(best.file);
      decisions.push({ code, file: best.file, d: best.d, date: best.dates.includes(born) ? 'exact' : 'n-a' });
      console.log(`   => DÉCISION : ${best.file}\n`);
    } else {
      decisions.push({ code, file: null });
      console.log('   => AUCUNE correspondance sûre (conflit de date ou nom trop court).\n');
    }
  }

  console.log('\n═══ RÉSUMÉ ═══');
  decisions.forEach((d) => console.log(`  ${d.code}  →  ${d.file || '(aucune photo)'}`));

  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => { }); process.exit(1); });
