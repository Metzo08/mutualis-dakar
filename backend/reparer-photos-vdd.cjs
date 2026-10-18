/* ═══════════════
   RÉPARATION PHOTOS — fiches EXISTANTES lot 030 sans photo (4 décisions sûres)
   ═══════════════
   Applique la table de décision diag-vdd-decision.cjs :
   variantes orthographiques confirmées (distance ≤ 2 sur identité complète,
   aucun homonyme en conflit dans le même ménage, fichier unique).
   1 transaction : tout ou rien.
   ═══════════════ */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const DIR = path.join(__dirname, '..', 'Photos AMEVI ville de Dakar');
const PLAN = [
  { code: 'DKR_2600027.0', file: '1.0 Irsule Diamètre.jpeg',      justification: 'URSULE/IRSULE DIAME — validé par Ahmed Tall (portrait mal transcrit)' },
  { code: 'DKR_2600010.1', file: '1.1 Abdoul Aziz Diallo.jpeg',   justification: 'ABDOU AZIZ / ABDOUL AZIZ DIALLO — dist=1, même ménage 010' },
  { code: 'DKR_2600011.1', file: '1.1 Binta Rassoul Faye.jpeg',   justification: 'BINTOU/BINTA RASSOUL FAYE — dist=2, même ménage 011' },
  { code: 'DKR_2600021.1', file: '1.1 Seydina Mouhamed Doussou Guin.jpeg', justification: 'DOSSOU/DOUSSOU GOUIN — dist=2, même ménage 021' },
  { code: 'DKR_2600021.2', file: '1.2 Sokhna Marie Doussou Gouin.jpeg',    justification: 'DOSSOU/DOUSSOU GOUIN — dist=1, même ménage 021' },
  { code: 'DKR_2600024.1', file: '1.1 Sophietou Mboup.jpeg',      justification: 'SOPHIIETOU/SOPHIETOU MBOUP — dist=1, même ménage 024' },
  { code: 'DKR_2600030.5', file: '1.5 Mame Sidy Sall.jpeg',       justification: 'SARR/SALL — dist=2, même ménage 030' }
];

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const p of PLAN) {
      const fiche = await client.query(
        `SELECT id, cmu_number, first_name, last_name,
                (photo_url IS NOT NULL AND photo_url <> '') AS photo
         FROM beneficiaries WHERE cmu_number=$1 AND merged_into IS NULL`,
        [p.code]
      );
      if (fiche.rows.length !== 1) throw new Error(`${p.code} : ${fiche.rows.length} fiches (attendu 1)`);
      const f = fiche.rows[0];
      if (f.photo) { console.log(`↷ ${p.code} a déjà une photo — ignoré`); continue; }

      const buf = fs.readFileSync(path.join(DIR, p.file));
      if (buf.length < 5000) throw new Error(`fichier trop petit : ${p.file}`);
      const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

      await client.query(`UPDATE beneficiaries SET photo_url=$1 WHERE id=$2`, [dataUrl, f.id]);
      console.log(`✅ ${p.code} ${f.first_name} ${f.last_name} ← ${p.file} (${(buf.length / 1024).toFixed(0)} Ko) — ${p.justification}`);
    }

    await client.query('COMMIT');
    const ctrl = await client.query(
      `SELECT count(*) n, count(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url<>'') ph
       FROM beneficiaries WHERE lot_code='LOT-2026-030' AND merged_into IS NULL`
    );
    console.log(`\nLot 030 : ${ctrl.rows[0].n} fiches, ${ctrl.rows[0].ph} avec photo.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ROLLBACK — aucune écriture :', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
