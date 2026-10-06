// Diagnostic des photos : quelles URL la base référence-t-elle, et
// lesquelles correspondent à un fichier réellement présent ?
// Sans ce diagnostic, « les photos sont cassées » reste une impression ;
// avec, on sait exactement combien manquent et pourquoi.
const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const PUBLIC_DIRS = [
  path.join(__dirname, '..', 'public', 'msd_photos'),
  path.join(__dirname, 'public', 'msd_photos'),
  path.join(__dirname, '..', 'public')
];

// Résout une URL de photo vers un chemin disque réel.
// Une même URL peut vivre dans public/ (frontend) ou backend/public/ —
// on teste les deux, sinon on déclare « cassée » une photo qui existe.
const resolvePhoto = (url) => {
  if (!url) return { exists: false, url, reason: 'vide' };
  if (url.startsWith('data:')) return { exists: true, url, reason: 'data-url' };
  if (/^https?:\/\//i.test(url)) return { exists: true, url, reason: 'distante' };

  const rel = url.replace(/^\/+/, '');
  for (const dir of PUBLIC_DIRS) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) return { exists: true, url, reason: `fichier: ${rel}` };
  }
  return { exists: false, url, reason: 'fichier absent sur le disque' };
};

const run = async () => {
  const rows = await query("SELECT cmu_number, first_name, last_name, photo_url FROM beneficiaries WHERE photo_url IS NOT NULL AND photo_url <> ''");
  const stats = {};
  const missing = [];

  for (const r of rows.rows) {
    const res = resolvePhoto(r.photo_url);
    const key = res.reason.startsWith('fichier') ? 'fichier présent' : res.reason;
    stats[key] = (stats[key] || 0) + 1;
    if (!res.exists) missing.push(`${r.cmu_number} — ${r.first_name} ${r.last_name} — ${r.photo_url}`);
  }

  console.log(`=== DIAGNOSTIC PHOTOS (${rows.rows.length} fiches avec photo_url) ===`);
  Object.entries(stats).forEach(([k, v]) => console.log(`${String(v).padStart(4)}  ${k}`));

  if (missing.length > 0) {
    console.log(`\n=== ${missing.length} PHOTOS MANQUANTES (échantillon 10) ===`);
    missing.slice(0, 10).forEach(m => console.log('  ' + m));
  }

  // Et les 237 sans photo_url ?
  const none = await query("SELECT count(*) AS n FROM beneficiaries WHERE photo_url IS NULL OR photo_url = ''");
  console.log(`\nSans photo du tout : ${none.rows[0].n}`);

  process.exit(0);
};

run().catch(e => { console.log('ERR ' + e.message); process.exit(1); });
