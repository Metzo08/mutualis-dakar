// Vérification finale des rangs du lot LOT-2026-001 (scratch — supprimable)
require('dotenv').config();
const { query } = require('../db');
(async () => {
  try {
    const r = await query(
      `SELECT cmu_number, first_name, last_name
       FROM beneficiaries WHERE lot_code = 'LOT-2026-001'
       ORDER BY cmu_number LIMIT 3`
    );
    console.table(r.rows);

    // Convention : le chef porte TOUJOURS .1, les pris en charge .2, .3…
    const chefs = await query(
      `SELECT COUNT(*)::int chefs_en_point_un FROM beneficiaries
       WHERE lot_code = 'LOT-2026-001' AND cmu_number LIKE '%.1'`
    );
    console.table(chefs.rows);

    const autres = await query(
      `SELECT COUNT(*)::int autres_rangs FROM beneficiaries
       WHERE lot_code = 'LOT-2026-001' AND cmu_number NOT LIKE '%.1'`
    );
    console.table(autres.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();
