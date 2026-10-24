// Diagnostic photos manquantes LOT-2026-002 + correspondance noms du dossier photo
require('dotenv').config();
const { query } = require('../db');
(async () => {
  try {
    const p = await query(
      `SELECT id, cmu_number, first_name, last_name FROM beneficiaries
       WHERE lot_code = 'LOT-2026-002' AND (photo_url IS NULL OR photo_url = '')
       ORDER BY cmu_number`
    );
    console.table(p.rows);

    // source_code du lot
    const s = await query(
      `SELECT DISTINCT source_code FROM beneficiaries WHERE lot_code = 'LOT-2026-002'`
    );
    console.table(s.rows);

    // codes dupliqués? séquence attendue 288→335 continue?
    const g = await query(
      `SELECT cmu_number FROM beneficiaries WHERE lot_code = 'LOT-2026-002' ORDER BY cmu_number`
    );
    console.log('codes:', g.rows.map(r => r.cmu_number).join(', '));
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();
