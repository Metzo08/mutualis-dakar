/**
 * REMISE À ZÉRO DU REGISTRE BÉNÉFICIAIRES — avec sauvegarde préalable.
 *
 * POURQUOI
 * Le registre contenait des matricules FABRIQUÉS par la plateforme
 * (`DKR-DKR-2026-…`) : ils ne figurent sur aucune carte, puisque toutes les
 * cartes ont DÉJÀ été imprimées. Pour MAFOU DIEDHIOU, le système avait attribué
 * `DKR-DKR-2026-2151.1` alors que la carte imprimée porte `DKR_2600111.0`
 * (fichier « MSD de Grand Yoff »). Tout le registre doit repartir des fichiers
 * Excel, qui font foi.
 *
 * SÉCURITÉ
 * La sauvegarde est systématique : aucun effacement n'a lieu tant que l'export
 * n'a pas réussi et produit un fichier non vide. Sans `--apply`, rien n'est
 * supprimé.
 *
 * CE QUI N'EST JAMAIS TOUCHÉ
 * Les comptes agents, le registre des MSD (`merchant_accounts`), les mutuelles
 * et le journal d'audit : ce sont des données de gouvernance, pas le registre
 * des assurés.
 *
 * Usage :
 *   node backend/reset-register.cjs            (simulation)
 *   node backend/reset-register.cjs --apply    (sauvegarde + purge)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');

// Tables purgées dans l'ordre des dépendances : les clés étrangères pointent
// vers `beneficiaries`, donc les enfants d'abord.
const PURGE = [
  'family_members',
  'beneficiary_code_aliases',
  'cotisations',
  'payments',
  'beneficiaries'
];

(async () => {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const tableExists = async (t) => {
      const r = await query(
        `select 1 from information_schema.tables where table_schema='public' and table_name=$1`,
        [t]
      );
      return r.rows.length > 0;
    };

    console.log('=== ETAT AVANT ===');
    for (const t of PURGE) {
      if (!(await tableExists(t))) { console.log(`  ${t.padEnd(28)} : (table absente)`); continue; }
      const r = await query(`select count(*)::int as n from ${t}`);
      console.log(`  ${t.padEnd(28)} : ${r.rows[0].n} ligne(s)`);
    }
    if (await tableExists('beneficiaries')) {
      const gen = await query(
        `select count(*)::int as n from beneficiaries where cmu_number like '%DKR-DKR-2026-%'`
      );
      console.log(`\n  dont codes FABRIQUES (DKR-DKR-2026-…) : ${gen.rows[0].n}`);
    }

    if (!APPLY) {
      console.log("\n>>> SIMULATION : rien n'a ete efface. Relancez avec --apply.");
      await pool.end();
      return;
    }

    // ── 1. SAUVEGARDE ──────────────────────────────────────────────────────
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backup = {};
    for (const t of PURGE) {
      if (!(await tableExists(t))) continue;
      const r = await query(`select * from ${t}`);
      backup[t] = r.rows;
    }
    const file = path.join(BACKUP_DIR, `registre-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2), 'utf8');

    const written = Object.entries(backup).map(([t, rows]) => `${t}=${rows.length}`).join(', ');
    const size = fs.statSync(file).size;
    console.log(`\n=== SAUVEGARDE ===`);
    console.log(`  ${path.basename(file)}`);
    console.log(`  ${written}`);
    console.log(`  taille : ${(size / 1024).toFixed(0)} Ko`);

    if (size === 0) {
      console.log('\n  SAUVEGARDE VIDE — purge annulee.');
      await pool.end();
      return;
    }

    // ── 2. PURGE ───────────────────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const t of PURGE) {
        if (!(await tableExists(t))) continue;
        const res = await client.query(`delete from ${t}`);
        console.log(`  purge ${t.padEnd(28)} : ${res.rowCount} ligne(s)`);
      }
      await client.query('commit');
      console.log('\n>>> PURGE EFFECTUEE');
    } catch (e) {
      await client.query('rollback');
      console.log('\nROLLBACK :', e.message);
      console.log(`Sauvegarde intacte : ${path.basename(file)}`);
      client.release();
      await pool.end();
      process.exit(1);
    }
    client.release();

    console.log('\n=== ETAT APRES ===');
    for (const t of PURGE) {
      const r = await query(`select count(*)::int as n from ${t}`).catch(() => ({ rows: [{ n: 0 }] }));
      console.log(`  ${t.padEnd(28)} : ${r.rows[0].n}`);
    }
    const kept = await query('select count(*)::int as n from agents');
    console.log(`  agents (conserves)      : ${kept.rows[0].n}`);
    const msds = await query('select count(*)::int as n from merchant_accounts');
    console.log(`  MSD (conservees)        : ${msds.rows[0].n}`);

    console.log(`\nRestauration : node backend/restore-register.cjs "${path.basename(file)}"`);
    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    process.exit(1);
  }
})();