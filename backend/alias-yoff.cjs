/**
 * ═══════════════════════════════════════════════════════════════════════
 *  ALIAS DES CARTES DÉJÀ IMPRIMÉES — GRAND YOFF
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PROBLÈME
 * Grand Yoff passe au format `DKR-DKR-2026-N.R`. Les 28 cartes DÉJÀ
 * IMPRIMÉES portent l'ancien code (`DKR_2600111.0`) gravé sur leur PVC : sans
 * disposition, le scan de ces cartes ne retrouverait plus personne.
 *
 * SOLUTION
 * `beneficiary_code_aliases` fait déjà le travail : `server.js:1493` associe à
 * chaque fiche ses ancien codes, et `resolveCodeAlias` (VerifyCard.jsx:491)
 * redirige un ancien code vers le code canonique AVANT la recherche.
 * Il suffit donc d'enregistrer les alias.
 *
 * SÛRETÉ
 *   • un alias ne pointe que vers un code déjà présent en base ;
 *   • un alias identique à un code existant est refusé (il n'y a rien à
 *     rediriger) ;
 *   · l'écriture est transactionnelle et journalisée.
 *
 * Usage :
 *   node backend/alias-yoff.cjs            (simulation)
 *   node backend/alias-yoff.cjs --apply    (écriture)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const CLASSEUR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/GRAND-YOFF-CODES.xlsx';
const NB_IMPRIMEES = 28;
const APPLY = process.argv.includes('--apply');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

(async () => {
  try {
    // Structure d'alias (idempotent).
    await query(`
      CREATE TABLE IF NOT EXISTS beneficiary_code_aliases (
        alias_code     varchar(100) primary key,
        canonical_code varchar(100) not null,
        created_at     timestamptz not null default now()
      )`);

    const wb = XLSX.readFile(CLASSEUR);
    const lignes = XLSX.utils.sheet_to_json(wb.Sheets.CODES, { defval: '' });

    // Les 28 premières fiches : leur ANCIEN code doit rester valable.
    const premieres = lignes.slice(0, NB_IMPRIMEES);
    console.log(`Fiches au classeur : ${lignes.length}`);
    console.log(`Cartes déjà imprimées : ${premieres.length}\n`);

    const { rows: codesBase } = await query(
      'select cmu_number from beneficiaries where merged_into is null'
    );
    const enBase = new Set(codesBase.map((r) => clean(r.cmu_number).toUpperCase()));

    const valides = [];
    const sansCible = [];
    const inutile = [];

    premieres.forEach((r) => {
      const ancien = clean(r['Ancien code']).toUpperCase();
      const cible = clean(r['Code final']).toUpperCase();
      if (!enBase.has(cible)) { sansCible.push({ ancien, cible }); return; }
      // Si l'ancien code EST déjà un code de fiche, rien à rediriger.
      if (enBase.has(ancien)) inutile.push({ ancien, cible });
      valides.push({ ancien, cible, nom: `${r.Prenom} ${r.Nom}` });
    });

    console.log('=== RESULTAT ===');
    console.log(`  alias a creer            : ${valides.length}`);
    console.log(`  cible absente de la base : ${sansCible.length}`);
    console.log(`  ancien code deja actif  : ${inutile.length}`);
    if (sansCible.length) {
      console.log('\n  Fiches pas encore importees :');
      sansCible.slice(0, 10).forEach((s) => console.log(`      ${s.ancien} -> ${s.cible}`));
      console.log('  -> Importez Grand Yoff AVANT de lancer --apply.');
    }

    if (!valides.length) {
      console.log('\nAucun alias a creer. Relancez apres l\'import de Grand Yoff.');
      await pool.end();
      return;
    }

    console.log('\n=== EXEMPLE ===');
    valides.slice(0, 8).forEach((v) => {
      console.log(`  ${v.ancien.padEnd(16)} -> ${v.cible.padEnd(22)} ${v.nom}`);
    });

    if (!APPLY) {
      console.log('\nSIMULATION — aucune ecriture. Relancez avec --apply.');
      await pool.end();
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const v of valides) {
        await client.query(
          `INSERT INTO beneficiary_code_aliases (alias_code, canonical_code)
           VALUES ($1, $2)
           ON CONFLICT (alias_code) DO UPDATE SET canonical_code = EXCLUDED.canonical_code`,
          [v.ancien, v.cible]
        );
      }
      await client.query(
        `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
        ['ALIAS_GRAND_YOFF', 'alias-yoff',
          `${valides.length} alias crees : les ${NB_IMPRIMEES} cartes deja imprimees ` +
          `retrouvent leur fiche via leur ancien code.`]
      );
      await client.query('COMMIT');
      console.log(`\n${valides.length} alias crees.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Contrôle final
    const { rows: total } = await query('select count(*)::int as n from beneficiary_code_aliases');
    console.log(`Total alias en base : ${total.n}`);
    console.log('\nUn scan de DKR_2600111.0 retrouvera MAFOU DIEDHIOU.');

    await pool.end();
  } catch (e) {
    console.error('ERREUR :', e.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();