// Vérification post-recodage LOT-2026-001 (scratch — supprimable)
require('dotenv').config();
const { query } = require('../db');
(async () => {
  try {
    const r = await query(
      `SELECT COUNT(*)::int n, MIN(cmu_number) premier, MAX(cmu_number) dernier
       FROM beneficiaries WHERE lot_code = 'LOT-2026-001'`
    );
    console.table(r.rows);
    const a = await query(
      `SELECT COUNT(*)::int n FROM beneficiary_code_aliases
       WHERE alias_code LIKE 'DKR_26002%' OR alias_code LIKE 'DKR_26003%'`
    );
    console.table(a.rows);
    const p = await query(
      `SELECT COUNT(*)::int avec_photo FROM beneficiaries
       WHERE lot_code = 'LOT-2026-001' AND photo_url IS NOT NULL`
    );
    console.table(p.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();
