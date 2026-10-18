/* ═══════════
 REGROUPEMENT — toutes les fiches qui ne sont PAS des adhésions de masse
 vont dans le lot permanent « Adhésions individuelles (en ligne) ».

 Critères de masse (conservés tels quels) : un lot existant déclaré dans
 campaign_lots avec plus d'une fiche est un import de masse. Seules les
 fiches SANS lot (lot_code NULL, adhésions en ligne) migrent.

 1 transaction : tout ou rien.
 ═══════════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

const LOT_CODE = 'LOT-2026-INDIV';
const LOT_LABEL = 'Adhésions individuelles (en ligne)';

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lot permanent, créé s'il n'existe pas (idempotent).
    const lot = await client.query(
      `INSERT INTO campaign_lots (code, label, source_file, union_id, card_count)
       VALUES ($1, $2, 'Adhésion en ligne', 'DKR', 0)
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
       RETURNING code, label`,
      [LOT_CODE, LOT_LABEL]
    );
    console.log(`Lot : ${lot.rows[0].code} — « ${lot.rows[0].label} »`);

    // 2. Fiches candidates : sans lot (adhésions en ligne jamais rattachées).
    const cibles = await client.query(
      `SELECT id, cmu_number, first_name, last_name
         FROM beneficiaries
        WHERE lot_code IS NULL AND merged_into IS NULL
        ORDER BY cmu_number`
    );

    if (cibles.rows.length === 0) {
      console.log('Aucune fiche sans lot — rien à migrer.');
    } else {
      for (const f of cibles.rows) {
        // eslint-disable-next-line no-await-in-loop
        await client.query('UPDATE beneficiaries SET lot_code = $1 WHERE id = $2', [LOT_CODE, f.id]);
        console.log(`✅ ${f.cmu_number} — ${f.first_name} ${f.last_name} → ${LOT_CODE}`);
      }
    }

    // 3. Mise à jour du compteur du lot.
    await client.query(
      `UPDATE campaign_lots SET card_count = (
         SELECT COUNT(*) FROM beneficiaries WHERE lot_code = $1 AND merged_into IS NULL
       ) WHERE code = $1`,
      [LOT_CODE]
    );

    await client.query('COMMIT');
    const ctrl = await client.query(
      `SELECT b.lot_code, COUNT(*) AS n FROM beneficiaries b
        WHERE b.merged_into IS NULL GROUP BY b.lot_code ORDER BY n DESC`
    );
    console.log('\n=== RÉPARTITION FINALE ===');
    ctrl.rows.forEach((r) => console.log(`  ${r.lot_code || 'HORS-LOT'} : ${r.n} fiche(s)`));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ROLLBACK — aucune écriture :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
