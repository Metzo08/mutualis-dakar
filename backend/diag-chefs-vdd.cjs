/* Les 59 bases sans .0 : où sont leurs chefs ? */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const r = await query(`
    SELECT cmu_number, first_name, last_name, birth_date, lot_code, merged_into,
           (photo_url IS NOT NULL AND photo_url <> '') AS photo
    FROM beneficiaries
    WHERE cmu_number LIKE 'DKR\\_2600%'
    ORDER BY cmu_number
  `);

  const baseOf = (code) => (String(code || '').match(/^(DKR_\d+)/i) || [])[1] || null;
  const rankOf = (code) => {
    const m = String(code || '').match(/\.(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  // Toutes les fiches y compris fusionnées
  const all = new Map(); // base -> fiches (actives + fusionnées)
  for (const row of r.rows) {
    const base = baseOf(row.cmu_number);
    if (!base) continue;
    if (!all.has(base)) all.set(base, []);
    all.get(base).push(row);
  }

  let ko = 0;
  for (const [base, members] of all) {
    const head = members.find((m) => rankOf(m.cmu_number) === 0 && !m.merged_into);
    const others = members.filter((m) => !m.merged_into && m !== head);
    if (others.length > 0 && !head) {
      ko++;
      if (ko <= 12) {
        console.log(`\n--- ${base} (SANS chef .0 actif) ---`);
        members.forEach((m) => console.log(`  ${m.cmu_number} ${m.first_name} ${m.last_name} lot=${m.lot_code} merged=${m.merged_into || '-'}`));
      }
    }
  }
  console.log(`\nTotal bases sans chef actif : ${ko}`);
  await pool.end();
})().catch((e) => { console.error('ERREUR', e.stack); pool.end().catch(() => { }); process.exit(1); });
