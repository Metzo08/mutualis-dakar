// Diagnostic structure ménage LOT-2026-002 (DERKLE) (scratch — supprimable)
require('dotenv').config();
const { query } = require('../db');
(async () => {
  try {
    const r = await query(
      `SELECT id, cmu_number, first_name, last_name, nin, numero_adherent
       FROM beneficiaries WHERE lot_code = 'LOT-2026-002' ORDER BY id LIMIT 60`
    );
    console.table(r.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();
