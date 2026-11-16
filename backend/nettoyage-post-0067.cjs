/* ═══════════════
   NETTOYAGE POST-RÉPARATION 0067 — 1 transaction, tout ou rien.
   1. numero_adherent des ayants droit 2245.2/.3 : DKR_010126 (valeur buguée
      du méga-ménage) → base de leur chef DKR-DKR-2026-2245.1.
   2. Lots : card_count recalé sur l'effectif réel.
   3. Lot 011 orphelin (1 fiche) : la fiche vestige rejoint le lot 015
      (regroupement ASS LONASE complet), le lot 011 est supprimé.
   Tracé dans audit_logs.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Ayants droit 2245 : adherent pointant vers le chef réel.
    const fix1 = await client.query(
      `UPDATE beneficiaries
          SET numero_adherent = 'DKR-DKR-2026-2245.1'
        WHERE cmu_number IN ('DKR-DKR-2026-2245.2','DKR-DKR-2026-2245.3')
          AND numero_adherent = 'DKR_010126' RETURNING cmu_number`
    );
    console.log(`numero_adherent corrigés : ${fix1.rows.map((r) => r.cmu_number).join(', ') || '(aucun)'}`);

    // 2. card_count de chaque lot = effectif réel de fiches actives.
    const fix2 = await client.query(
      `UPDATE campaign_lots l
          SET card_count = (SELECT COUNT(*) FROM beneficiaries b
                             WHERE b.lot_code = l.code AND b.merged_into IS NULL)`
    );
    console.log(`card_count recalés sur ${fix2.rowCount} lot(s).`);

    // 3. Fiche vestige du lot 011 → lot 015, puis suppression du 011.
    const fix3 = await client.query(
      `UPDATE beneficiaries SET lot_code = 'LOT-2026-015'
         WHERE lot_code = 'LOT-2026-011' AND merged_into IS NULL RETURNING cmu_number`
    );
    console.log(`Fiche(s) 011 → 015 : ${fix3.rows.map((r) => r.cmu_number).join(', ') || '(aucune)'}`);
    const del = await client.query(
      `DELETE FROM campaign_lots WHERE code = 'LOT-2026-011' RETURNING code`
    );
    console.log(`Lot supprimé : ${del.rows.map((r) => r.code).join(', ') || '(aucun)'}`);

    await client.query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['NETTOYAGE_POST_0067', 'maintenance-script',
        `Adhérents 2245 réattachés au chef ; card_count recalés ; lot 011 fusionné dans 015.`]
    );

    await client.query('COMMIT');

    // Contrôle final.
    const lots = await client.query(
      `SELECT l.code, l.label, l.card_count,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS fiches
         FROM campaign_lots l
         LEFT JOIN beneficiaries b ON b.lot_code = l.code
        GROUP BY l.id ORDER BY l.code`
    );
    console.log('\n=== LOTS FINAUX ===');
    lots.rows.forEach((l) => console.log(
      `  ${l.code} | ${l.label} | card_count=${l.card_count} | fiches=${l.fiches}`
    ));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
