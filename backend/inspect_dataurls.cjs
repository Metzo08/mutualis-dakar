// Les photo_url de la base sont des data-URL — inspectons leur forme réelle.
// Une data-URL cassée (tronquée, mauvais préfixe) affiche une image brisée
// sur la carte exactement comme un fichier manquant, mais se répare autrement.
const { query } = require('./db');

const run = async () => {
  const rows = await query("SELECT cmu_number, length(photo_url) AS size, left(photo_url, 40) AS head FROM beneficiaries WHERE photo_url LIKE 'data:%' ORDER BY length(photo_url) LIMIT 5");
  console.log('=== 5 PLUS PETITES data-URL (suspectes : trop courtes = tronquées) ===');
  rows.rows.forEach(r => console.log(`${r.cmu_number} | ${r.size} octets | ${r.head}...`));

  const big = await query("SELECT cmu_number, length(photo_url) AS size, left(photo_url, 40) AS head FROM beneficiaries WHERE photo_url LIKE 'data:%' ORDER BY length(photo_url) DESC LIMIT 3");
  console.log('\n=== 3 PLUS GRANDES ===');
  big.rows.forEach(r => console.log(`${r.cmu_number} | ${(r.size / 1024).toFixed(0)} Ko | ${r.head}...`));

  // Une data-URL valide JPEG fait au moins ~2 Ko encodés. En dessous,
  // l'image est certainement tronquée et ne s'affichera pas.
  const tiny = await query("SELECT count(*) AS n FROM beneficiaries WHERE photo_url LIKE 'data:%' AND length(photo_url) < 2000");
  console.log(`\nData-URLs de moins de 2 Ko (probablement tronquées) : ${tiny.rows[0].n}`);

  const badPrefix = await query("SELECT count(*) AS n FROM beneficiaries WHERE photo_url LIKE 'data:%' AND photo_url !~* '^data:image/(jpeg|jpg|png|webp|gif|svg\\+xml);base64,[A-Za-z0-9+/=]+'");
  console.log(`Data-URLs au format invalide : ${badPrefix.rows[0].n}`);

  process.exit(0);
};

run().catch(e => { console.log('ERR ' + e.message); process.exit(1); });
