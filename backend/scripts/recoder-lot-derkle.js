/**
 * Recodage du lot ASS DERKLE DIEUP2 (LOT-2026-002 → LOT-2026-001).
 *
 * ⚠️ DÉCISION AHMED TALL : les codes du fichier Excel (DKR_2600288.0 …)
 * ne sont PAS l'identité officielle. Le matricule est généré par le système
 * au format REGION-MSD-ANNÉE-SÉQUENCE, en poursuivant la numérotation réelle
 * de la base (dernier code DKR-DKR-2026-2355.1 → démarrer à 2356).
 *
 * 48 fiches : DKR_2600288.0 → DKR-DKR-2026-2356.1 … DKR_2600335.0 → 2403.1.
 * L'ancien code est conservé dans beneficiary_code_aliases (traçabilité des
 * cartes éventuellement déjà imprimées). Idempotent : rejouer ne fait rien.
 */
require('dotenv').config();
const { pool, query } = require('../db');

const LOT_ANCIEN = 'LOT-2026-002';
const LOT_NOUVEAU = 'LOT-2026-001';
const SEQ_DEPART = 2356;      // après DKR-DKR-2026-2355.1
const RANG_CHEF = 1;          // .1 = chef du foyer (convention Grand Yoff)

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Contrôle préalable : séquence réellement libre ?
    const last = await client.query(
      `SELECT MAX((substring(cmu_number from '^DKR-DKR-2026-(\\d{4})'))::int) AS max_seq
       FROM beneficiaries
       WHERE cmu_number ~ '^DKR-DKR-2026-\\d{4}'`
    );
    const dernierReel = last.rows[0].max_seq || 0;
    if (dernierReel >= SEQ_DEPART) {
      throw new Error(`La base contient déjà un code DKR-DKR-2026-${dernierReel} : SEQ_DEPART=${SEQ_DEPART} invalide. Utilisez ${dernierReel + 1}.`);
    }

    const rows = await client.query(
      `SELECT id, cmu_number FROM beneficiaries
       WHERE lot_code = $1 ORDER BY cmu_number`,
      [LOT_ANCIEN]
    );
    if (rows.rows.length === 0) {
      console.log('Aucune fiche à recoder (déjà fait ?).');
      await client.query('COMMIT');
      return;
    }

    let seq = SEQ_DEPART;
    for (const r of rows.rows) {
      const ancien = r.cmu_number;
      // Rang du ménage conservé : « .0 » = chef → on réécrit « .1 ».
      const suffixe = (ancien.match(/\.(\d+)$/) || [null, String(RANG_CHEF)])[1];
      const rang = suffixe === '0' ? RANG_CHEF : Number(suffixe);
      const nouveau = `DKR-DKR-2026-${String(seq).padStart(4, '0')}.${rang}`;

      await client.query(
        `UPDATE beneficiaries SET cmu_number = $1, numero_adherent = $1, lot_code = $2 WHERE id = $3`,
        [nouveau, LOT_NOUVEAU, r.id]
      );
      // Alias : l'ancien code (carte déjà imprimée éventuelle) reste traçable.
      await client.query(
        `INSERT INTO beneficiary_code_aliases (alias_code, canonical_code)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [ancien, nouveau]
      );
      console.log(`${ancien} → ${nouveau}`);
      seq += 1;
    }

    await client.query('COMMIT');
    console.log(`\n✅ ${rows.rows.length} fiche(s) recodée(s). Nouveau lot : ${LOT_NOUVEAU}.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
