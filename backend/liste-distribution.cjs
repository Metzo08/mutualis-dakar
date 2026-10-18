/**
 * ═══════════════════════════════════════════════════════════════════════
 *  LISTE NOMINATIVE PAR MSD — assurés sans photo (pour délégation terrain)
 * ═══════════════════════════════════════════════════════════════════════
 *  Sortie : backend/reports/distribution-sans-photo-par-msd.txt
 *  Usage : node backend/liste-distribution.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const { query, pool } = require('./db');

(async () => {
  const r = await query(`
    SELECT COALESCE(msd_code,'(non rattaché)') AS msd, lot_code, cmu_number,
           first_name, last_name, birth_date, birth_place, phone, address
      FROM beneficiaries
     WHERE merged_into IS NULL AND (photo_url IS NULL OR photo_url='')
     ORDER BY msd, cmu_number`);

  const parMsd = new Map();
  for (const x of r.rows) {
    if (!parMsd.has(x.msd)) parMsd.set(x.msd, []);
    parMsd.get(x.msd).push(x);
  }

  const L = [];
  L.push('═'.repeat(90));
  L.push('DISTRIBUTION TERRAIN — ASSURÉS SANS PHOTO (à photographier par les délégués)');
  L.push(`Généré le ${new Date().toLocaleString('fr-FR')} — ${r.rows.length} personnes au total`);
  L.push('═'.repeat(90));
  for (const [msd, liste] of parMsd) {
    L.push('');
    L.push(`─── MSD ${msd} : ${liste.length} assuré(s) ───`);
    L.push('CODE BÉNÉFICIAIRE            NOM COMPLET                            NAISSANCE           TÉLÉPHONE');
    L.push('-'.repeat(90));
    for (const x of liste) {
      const nom = `${x.first_name} ${x.last_name}`.padEnd(38);
      const nais = `${x.birth_date || '?'} à ${(x.birth_place || '?').slice(0, 14)}`.padEnd(20);
      L.push(`${x.cmu_number.padEnd(28)} ${nom} ${nais} ${x.phone || '-'}`);
    }
  }
  const txt = L.join('\n');
  fs.writeFileSync('backend/reports/distribution-sans-photo-par-msd.txt', txt, 'utf8');
  console.log(txt);
  console.log('\n→ backend/reports/distribution-sans-photo-par-msd.txt');
  await pool.end();
})().catch((e) => { console.error(e.stack); pool.end().catch(() => {}); process.exit(1); });
