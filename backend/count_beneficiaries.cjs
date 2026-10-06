// Compte réel des bénéficiaires dans la base — la source de vérité.
// Trois chiffres distincts, souvent confondus :
//   - lignes : chaque personne (adhérent OU ayant droit) = 1 ligne
//   - adhérents : chefs de foyer, un code sans suffixe .N
//   - ayants droit : enfants/conjoints rattachés, code avec suffixe .N
const { query } = require('./db');

const run = async () => {
  const total = await query('SELECT count(*) AS n FROM beneficiaries');

  // Chef de foyer : suffixe .0 (les fichiers MSD numérotent ainsi).
  const chefs = await query("SELECT count(*) AS n FROM beneficiaries WHERE cmu_number LIKE '%.0'");
  // Ayants droit : tout autre suffixe.
  const deps = await query("SELECT count(*) AS n FROM beneficiaries WHERE cmu_number LIKE '%.%' AND cmu_number NOT LIKE '%.0'");
  // Sans suffixe du tout (ancien format ou adhésion en ligne).
  const plain = await query("SELECT count(*) AS n FROM beneficiaries WHERE cmu_number NOT LIKE '%.%'");

  // Foyers distincts = préfixes de code uniques.
  const foyers = await query("SELECT count(DISTINCT split_part(cmu_number, '.', 1)) AS n FROM beneficiaries");

  const withPhoto = await query("SELECT count(*) AS n FROM beneficiaries WHERE photo_url IS NOT NULL AND photo_url <> ''");

  console.log('=== SOURCE DE VERITE : base PostgreSQL ===');
  console.log('Personnes totales          : ' + total.rows[0].n);
  console.log('Chefs de foyer (suffixe .0): ' + chefs.rows[0].n);
  console.log('Ayants droit (suffixe .N)  : ' + deps.rows[0].n);
  console.log('Sans suffixe               : ' + plain.rows[0].n);
  console.log('Foyers distincts           : ' + foyers.rows[0].n);
  console.log('Avec photo enregistree     : ' + withPhoto.rows[0].n);

  // Le studio importe par lot : voyons la répartition.
  const lots = await query("SELECT LEFT(cmu_number, 3) AS prefixe, count(*) AS n FROM beneficiaries GROUP BY 1 ORDER BY 2 DESC LIMIT 8");
  console.log('\nRepartition par prefixe de code :');
  lots.rows.forEach(r => console.log('  ' + r.prefixe + ' : ' + r.n));

  process.exit(0);
};

run().catch(e => { console.log('ERR ' + e.message); process.exit(1); });
