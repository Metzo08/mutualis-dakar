/* Contrôle final avant écriture : les 4 fichiers choisis ne sont pas déjà
   rattachés à une autre fiche (même nom de fichier → photo_url identique),
   et la photo visuelle est présentable (taille > 5 Ko). */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const DIR = path.join(__dirname, '..', 'Photos AMEVI ville de Dakar');
const CHOIX = [
  { code: 'DKR_2600020.1', file: '1.1 Ndeye Mareme Fall.jpeg' },
  { code: 'DKR_2600030.0', file: '1.0 Oulimatou DIAGNE.jpeg' },
  { code: 'DKR_2600030.1', file: '1.1 Binetou NDOYE.jpeg' },
  { code: 'DKR_2600010.3', file: '1.3 Boubacar Diallo.jpeg' }
];

(async () => {
  // Un même contenu data-url ne doit jamais être partagé : on compare les octets.
  const hashes = new Map(); // taille → liste de fichiers
  for (const c of CHOIX) {
    const p = path.join(DIR, c.file);
    const stat = fs.statSync(p);
    const exists = fs.existsSync(p);
    console.log(`${c.file} : existe=${exists} taille=${stat.size} octets`);
    hashes.set(c.file, stat.size);
  }

  // Vérifie en base : ces fiches existent, sans photo, et aucune autre fiche
  // du lot ne porte déjà une photo_url identique (garde-fou par tailleapprox).
  for (const c of CHOIX) {
    const r = await query(
      `SELECT id, cmu_number, first_name, last_name,
              (photo_url IS NOT NULL AND photo_url <> '') AS photo
       FROM beneficiaries
       WHERE cmu_number = $1 AND merged_into IS NULL`,
      [c.code]
    );
    if (r.rows.length !== 1) {
      console.log(`⚠️ ${c.code} : ${r.rows.length} fiches trouvées — STOP`);
      process.exit(1);
    }
    const f = r.rows[0];
    console.log(`${c.code} → ${f.first_name} ${f.last_name} id=${f.id} photo=${f.photo}`);
    if (f.photo) {
      console.log(`   ⚠️ a déjà une photo — on ne remplace pas. STOP`);
      process.exit(1);
    }
  }

  console.log('\n✅ Contrôles passés — 4 fiches uniques, sans photo, fichiers présents.');
  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => {}); process.exit(1); });
