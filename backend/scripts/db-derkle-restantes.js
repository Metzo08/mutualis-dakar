// Fiches candidates pour les 4 photos restantes (scratch)
require('dotenv').config();
const { query } = require('../db');
(async () => {
  try {
    const r = await query(
      `SELECT id, cmu_number, first_name, last_name, (photo_url IS NOT NULL) AS a_photo
       FROM beneficiaries WHERE lot_code = 'LOT-2026-001'
         AND (first_name ILIKE '%diogal%' OR first_name ILIKE '%diogaye%'
           OR last_name ILIKE '%dacosta%' OR first_name ILIKE '%mbeugue%'
           OR first_name ILIKE '%mbengue%' OR (first_name ILIKE 'ndeye%' AND last_name ILIKE 'sy%'))
       ORDER BY cmu_number`
    );
    console.table(r.rows);
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();
