// Diagnostic lot ASS DERKLE DIEUP2 (scratch — supprimable)
require('dotenv').config();
const { query } = require('../db');
(async () => {
  try {
    const r = await query(
      `SELECT lot_code, COUNT(*)::int AS n, MIN(cmu_number) AS premier, MAX(cmu_number) AS dernier
       FROM beneficiaries WHERE lot_code IS NOT NULL GROUP BY lot_code ORDER BY lot_code`
    );
    console.table(r.rows);

    const d2 = await query(
      `SELECT lot_code, COUNT(*)::int n, MIN(cmu_number) premier, MAX(cmu_number) dernier
       FROM beneficiaries WHERE cmu_number LIKE 'DKR_26002%' GROUP BY lot_code`
    );
    console.table(d2.rows);

    const c = await query(
      `SELECT lot_code, COUNT(*)::int n, MIN(cmu_number) premier, MAX(cmu_number) dernier
       FROM beneficiaries WHERE cmu_number LIKE 'DKR_26003%' GROUP BY lot_code`
    );
    console.table(c.rows);

    const t = await query(
      `SELECT id, cmu_number, first_name, last_name, lot_code, (photo_url IS NOT NULL) a_photo
       FROM beneficiaries WHERE cmu_number >= 'DKR_2600288' AND cmu_number <= 'DKR_2600340'
       ORDER BY cmu_number LIMIT 10`
    );
    console.table(t.rows);

    const p = await query(
      `SELECT COUNT(*)::int sans_photo FROM beneficiaries
       WHERE lot_code = 'LOT-2026-002' AND (photo_url IS NULL OR photo_url = '')`
    );
    console.table(p.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();
