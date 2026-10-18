/* ═══════════════
   FUSION v2 — doublon BINTA/BINETA OUMOU DIALLO (NIN 2758201202437).
   Preuve Excel : ligne 163 (BINTA, sans code) et ligne 207 (BINETA, code
   DKR-DKR-2026-2287.1) = une seule enfant, deux saisies.
   ⚠️ Photo : AUCUN fichier terrain pour celle née en 2012 (le seul fichier
   « Bineta Oumou Diallo » du dossier porte 05-02-1957 = la DAME de 2199.1,
   personne DIFFÉRENTE — jamais affecté à l'enfant).
   Action : 2339.1 → merged_into 2287.1 + alias de scan. 1 transaction.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(`
      UPDATE beneficiaries
         SET merged_into = 'DKR-DKR-2026-2287.1',
             photo_url = NULL
       WHERE cmu_number = 'DKR-DKR-2026-2339.1'
         AND merged_into IS NULL
         AND nin = '2758201202437'
       RETURNING cmu_number`);
    if (r.rows.length === 0) throw new Error('Doublon introuvable ou déjà fusionné / NIN non concordant');

    // Table existante : colonnes réelles alias_code / canonical_code / merged_at.
    await client.query(`
      INSERT INTO beneficiary_code_aliases (alias_code, canonical_code)
      VALUES ('DKR-DKR-2026-2339.1', 'DKR-DKR-2026-2287.1')
      ON CONFLICT (alias_code) DO NOTHING`);

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['FUSION_DOUBLON_BINTA_BINETA', 'maintenance-script',
       `Doublon confirmé par NIN 2758201202437 : DKR-DKR-2026-2339.1 (BINTA, Excel ligne 163, sans code) fusionnée dans DKR-DKR-2026-2287.1 (BINETA, Excel ligne 207, code réel). Photo terrain absente du dossier — en attente de collecte.`]
    );
    await client.query('COMMIT');
    console.log('Fusion : 2339.1 -> 2287.1 (alias de scan enregistre)');

    const ctrl = await query(`
      SELECT cmu_number, first_name, merged_into FROM beneficiaries
       WHERE cmu_number IN ('DKR-DKR-2026-2287.1','DKR-DKR-2026-2339.1')`);
    ctrl.rows.forEach((x) => console.log(`  ${x.cmu_number} | ${x.first_name} | merged_into=${x.merged_into || '—'}`));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ROLLBACK :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
