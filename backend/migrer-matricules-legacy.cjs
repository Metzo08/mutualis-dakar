/**
 * ============================================================
 *  MIGRATION DES MATRICULES LEGACY VERS LE FORMAT OFFICIEL
 * ============================================================
 *
 *  Les anciens générateurs produisaient des codes JAMAIS reconnus par
 *  VerifyCard (isOfficialCode = false) ni gravés sur les PVC :
 *   - ancien générateur séquentiel   : `DKR-2600001`    (regex legacy frontend)
 *   - générateur fallbackStore       : `CMU-DKR-0000042`,
 *     `EDU-DKR-0000007`, `DARA-DRB-0000012`… (PREFIX-UNION-7 chiffres)
 *
 *  Ils sont réattribués au format OFFICIEL :
 *      REGION-MSD-ANNEE-SEQUENCE.1   ex. DKR-DKR-2026-0001.1
 *
 *  NE SONT PAS TOUCHÉS (cartes déjà imprimées / imports de masse) :
 *   - les codes officiels déjà conformes ;
 *   - les codes à underscore des lots    : `DKR_2600027.0` ;
 *   - les codes de programmes imprimés   : `EDU_DKR_26000163`,
 *     `DAARA-2025-0078`.
 *
 *  USAGE :
 *    node migrer-matricules-legacy.cjs          → simulation (dry-run)
 *    node migrer-matricules-legacy.cjs --apply  → écriture réelle
 *
 *  ⚠️ Prendre une sauvegarde (pg_dump ou backend/data/backups/) avant --apply.
 * ============================================================
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { query, pool } = require('./db');
const fallbackStore = require('./fallbackStore');

const APPLY = process.argv.includes('--apply');

// — Mêmes tables que server.js (générateur officiel inline) —
const REGION_CODES = { Dakar: 'DKR', 'Thiès': 'THS', 'Saint-Louis': 'STL', Kaolack: 'KLC', Ziguinchor: 'ZGC', Diourbel: 'DRB' };
const UNION_REGIONS = { DKR: 'Dakar', PKN: 'Dakar', GDW: 'Dakar', RFS: 'Dakar', THS: 'Thiès', MBR: 'Thiès', STL: 'Saint-Louis', KLC: 'Kaolack', ZGC: 'Ziguinchor', DRB: 'Diourbel' };

// Anciens formats à migrer (jamais imprimés sur PVC, jamais reconnus au scan).
const LEGACY_SEQUENTIAL = /^[A-Z]{3}-26\d{5}$/;                 // DKR-2600001
const LEGACY_PREFIXED = /^(CMU|EDU|DARA|SPN|HH|COL|GRP)-[A-Z]{3}-\d{7}$/; // CMU-DKR-0000042

const isLegacy = (code) => {
  const c = String(code || '').trim().toUpperCase();
  return LEGACY_SEQUENTIAL.test(c) || LEGACY_PREFIXED.test(c);
};


(async () => {
  // 1. Fiches legacy en base, dans l'ordre de création.
  const res = await query(
    `SELECT id, cmu_number, first_name, last_name, mutuelle_name, msd_code, created_at
       FROM beneficiaries
      ORDER BY id ASC`
  );
  const rows = res.rows || [];
  const legacy = rows.filter((r) => isLegacy(r.cmu_number));

  if (legacy.length === 0) {
    console.log('Aucun matricule legacy trouvé — rien à migrer.');
    await pool.end();
    return;
  }
  console.log(`${legacy.length} fiche(s) legacy à migrer (sur ${rows.length}).\n`);

  // 2. Dernière séquence déjà attribuée par (région, MSD, année), pour
  //    poursuivre la numérotation au lieu de collisionner.
  const lastByScope = new Map(); // "R-U-ANNEE" → seq max
  for (const r of rows) {
    const m = String(r.cmu_number || '').match(/^([A-Z]{3})-([A-Z]{3})-(\d{4})-(\d{4})(?:\.\d+)?$/);
    if (!m) continue;
    const key = `${m[1]}-${m[2]}-${m[3]}`;
    const seq = parseInt(m[4], 10);
    if (!lastByScope.has(key) || lastByScope.get(key) < seq) lastByScope.set(key, seq);
  }

  // 3. Attribution des nouveaux codes, dans l'ordre de création.
  const mapping = []; // { id, oldCode, newCode }
  const used = new Set(rows.filter((r) => !isLegacy(r.cmu_number)).map((r) => String(r.cmu_number)));

  for (const r of legacy) {
    const unionId = fallbackStore.unionCodeFrom(r.mutuelle_name) || 'DKR';
    const region = REGION_CODES[UNION_REGIONS[unionId]] || unionId || 'DKR';
    const year = (r.created_at && new Date(r.created_at).getFullYear()) || new Date().getFullYear();
    const scopeKey = `${region}-${unionId}-${year}`;

    let seq = lastByScope.get(scopeKey) || 0;
    let newCode = null;
    for (let attempt = 0; attempt < 200 && !newCode; attempt++) {
      seq += 1;
      const candidate = `${region}-${unionId}-${year}-${String(seq).padStart(4, '0')}.1`;
      if (!used.has(candidate)) newCode = candidate;
    }
    if (!newCode) {
      console.error(`  ✗ ${r.cmu_number} : séquence épuisée pour ${scopeKey}, fiche IGNORÉE.`);
      continue;
    }
    used.add(newCode);
    lastByScope.set(scopeKey, seq);
    mapping.push({ id: r.id, oldCode: String(r.cmu_number), newCode });
    console.log(`  ${String(r.cmu_number).padEnd(18)} → ${newCode}   (${r.first_name} ${r.last_name})`);
  }

  if (!APPLY) {
    console.log(`\n[dry-run] ${mapping.length} migration(s) simulée(s). Relancer avec --apply pour écrire.`);
    await pool.end();
    return;
  }

  // 4. Écriture en base, une par une (chaque UPDATE est indépendante :
  //    un conflit d'unicité n'interrompt pas la migration du reste).
  let ok = 0;
  for (const m of mapping) {
    try {
      await query('UPDATE beneficiaries SET cmu_number = $1 WHERE id = $2', [m.newCode, m.id]);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${m.oldCode} → ${m.newCode} : ${err.message}`);
    }
  }

  // 5. Le fichier secours (store.json) porte les mêmes anciens codes : on
  //    applique le même mapping, sinon un futur flush réintégrerait l'ancien.
  const storePath = path.join(__dirname, 'data', 'store.json');
  try {
    const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const byOld = new Map(mapping.map((m) => [m.oldCode, m.newCode]));
    let patched = 0;
    for (const c of ['adhesions', 'beneficiaries']) {
      for (const rec of (store[c] || [])) {
        const cur = rec.cmuNumber || rec.cmu_number || '';
        const next = byOld.get(String(cur));
        if (next) {
          if (rec.cmuNumber) rec.cmuNumber = next;
          if (rec.cmu_number) rec.cmu_number = next;
          patched++;
        }
      }
    }
    if (patched) fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    console.log(`\nstore.json : ${patched} occurrence(s) mise(s) à jour.`);
  } catch (err) {
    console.warn(`\nstore.json non mis à jour (${err.message}) — à vérifier manuellement.`);
  }

  console.log(`\nMigration terminée : ${ok}/${mapping.length} fiche(s) réattribuée(s).`);
  await pool.end();
})().catch((err) => { console.error(err.stack); pool.end().catch(() => {}); process.exit(1); });
