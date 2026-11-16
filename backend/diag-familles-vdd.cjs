/* État des familles Ville de Dakar : regroupement par ménage + mineurs. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

const baseOf = (code) => (String(code || '').match(/^(DKR_\d+)/i) || [])[1] || null;
const rankOf = (code) => {
  const m = String(code || '').match(/\.(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

(async () => {
  const r = await query(`
    SELECT cmu_number, first_name, last_name, birth_date, numero_adherent, lot_code,
           (photo_url IS NOT NULL AND photo_url <> '') AS photo
    FROM beneficiaries
    WHERE merged_into IS NULL AND cmu_number LIKE 'DKR\_2600%'
    ORDER BY cmu_number
  `);
  console.log('Total fiches DKR_2600* :', r.rows.length);

  // Regroupe par ménage
  const groups = new Map();
  for (const row of r.rows) {
    const base = baseOf(row.cmu_number);
    if (!base) continue;
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(row);
  }

  const today = new Date();
  const ageOf = (bd) => {
    if (!bd) return null;
    const m = String(bd).match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return Math.floor((today - d) / 31557600000);
  };

  let famillesOk = 0, famillesKo = 0, mineursAvecCode = 0;
  for (const [base, members] of groups) {
    const head = members.find((m) => rankOf(m.cmu_number) === 0);
    const others = members.filter((m) => m !== head);
    const mineurs = others.filter((m) => {
      const a = ageOf(m.birth_date);
      return a !== null && a < 18;
    });
    if (head && others.length > 0) famillesOk++;
    else if (others.length > 0 && !head) famillesKo++;
    mineursAvecCode += mineurs.length;
  }

  console.log('Ménages regroupables :', famillesOk);
  console.log('Ménages SANS adhérent .0 (regroupement cassé) :', famillesKo);
  console.log('Fiches mineures (<18 ans) portant un code :', mineursAvecCode);

  // Échantillon : 10 ménages avec leurs membres
  let shown = 0;
  for (const [base, members] of groups) {
    if (shown >= 8) break;
    if (members.length < 2) continue;
    shown++;
    console.log(`\n--- Ménage ${base} ---`);
    for (const m of members) {
      const a = ageOf(m.birth_date);
      console.log(`  ${m.cmu_number}  ${m.first_name} ${m.last_name}  né=${m.birth_date} (${a === null ? 'age?' : a + ' ans'})  photo=${m.photo}`);
    }
  }

  // Mineurs : liste des 15 premiers
  console.log('\n--- Échantillon mineurs ---');
  let mc = 0;
  for (const [base, members] of groups) {
    for (const m of members) {
      const a = ageOf(m.birth_date);
      if (mc >= 15) break;
      if (a !== null && a < 18) { mc++; console.log(`  ${m.cmu_number}  ${m.first_name} ${m.last_name}  ${a} ans`); }
    }
  }

  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => { }); process.exit(1); });
