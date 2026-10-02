/**
 * Consolidation des bénéficiaires : 1 personne = 1 fiche.
 *
 * POURQUOI
 * La table `beneficiaries` contenait 1 003 lignes pour ~546 personnes réelles :
 * des ré-imports successifs (ancien Excel MSD, import LONASE, adhésion en
 * ligne) avaient créé plusieurs lignes par personne, parfois dans deux MSD
 * différentes. Le studio cartes affiche autant de fiches qu'il y a de
 * personnes : afficher 1 003 lignes ferait annoncer ~457 cartes de trop.
 *
 * RÈGLE D'IDENTITÉ
 * nom + prénom + date de naissance. Le code CMU est EXCLU de la clé : c'est
 * justement lui qui diffère entre deux lignes de la même personne (c'est la
 * trace du ré-import).
 *
 * CONSERVATION DES CARTES DÉJÀ IMPRIMÉES  ⚠️ le point critique
 * Chaque code CMU absorbé est enregistré dans `beneficiary_code_aliases`.
 * À la lecture, la plateforme résout ces codes vers la fiche canonique : une
 * carte imprimée avec `DKR_2600098.0` continue donc de retrouver MAFOU
 * Diedhiou, même après la consolidation. Supprimer les lignes aurait rendu
 * ces cartes orphelines et fait afficher « bénéficiaire inconnu » au guichet.
 *
 * LA CONSOLIDATION EST RÉVERSIBLE : les lignes sources sont marquées
 * `merged_into` (et non supprimées) tant que la migration n'est pas validée.
 *
 * Usage :
 *   node backend/consolidate-beneficiaries.cjs            (simulation)
 *   node backend/consolidate-beneficiaries.cjs --apply    (écriture)
 */
require('dotenv').config();
const { query, pool } = require('./db');

const APPLY = process.argv.includes('--apply');

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Clé d'identité : nom + prénom + naissance (le code CMU est exclu). */
const identityKey = (r) =>
  `${norm(r.last_name)}|${norm(r.first_name)}|${norm(r.birth_date)}`;

/** Un champ « rempli » vaut mieux qu'un champ vide à la fusion. */
const richness = (r) =>
  ['first_name', 'last_name', 'birth_date', 'birth_place', 'phone', 'email', 'address',
    'nin', 'mutuelle_name', 'numero_adherent', 'cmu_number', 'blood_group',
    'gender', 'school_name', 'school_class', 'academic_year', 'ine', 'ia_ief',
    'tutor_name', 'tutor_phone', 'status', 'package_type', 'sponsor_logo'
  ].reduce((n, f) => n + (r[f] !== null && r[f] !== undefined && String(r[f]).trim() !== '' ? 1 : 0), 0)
  // Une photo vaut beaucoup : c'est elle qui rend une carte présentable.
  + (r.photo_url ? 10 : 0);

/**
 * Un code « personnel » (`DKR_2600099` ou `DKR_2600099.0`) prime sur un suffixe
 * d'ayant droit (`.1`, `.2`…). À qualité de fiche égale, le code retenu doit
 * être celui de la personne elle-même : c'est le code porté par SA carte, pas
 * celui de son rang dans le ménage. Sans cette règle, MAFOU Diedhiou aurait
 * gardé `DKR-26000165` comme canonique alors que ses autres fiches sont en
 * `DKR_2600…`.
 */
const isOwnCode = (code) => !/\.[1-9]\d*$/.test(String(code || '').trim());

/** Ordre de choix de la fiche canonique (décroissant). */
const canonicalRank = (r) => richness(r) * 10 + (isOwnCode(r.cmu_number) ? 5 : 0);

(async () => {
  try {
    // 1. Structures de traçabilité (idempotent)
    await query(`
      create table if not exists beneficiary_code_aliases (
        alias_code     varchar(100) primary key,
        canonical_code varchar(100) not null,
        merged_at      timestamptz not null default now()
      )
    `);
    await query('alter table beneficiaries add column if not exists merged_into varchar(100)');
    console.log('Structures prêtes (beneficiary_code_aliases, merged_into).\n');

    // 2. Regrouper par identité
    const rows = await query(`
      select id, first_name, last_name, birth_date, cmu_number, numero_adherent, photo_url
      from beneficiaries
      where merged_into is null
      order by id
    `);
    console.log(`Lignes à consolider : ${rows.rows.length}`);

    const groups = new Map();
    for (const r of rows.rows) {
      const key = identityKey(r);
      if (!key.replace(/\|/g, '')) continue; // identité inexploitable
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }

    const multi = [...groups.values()].filter((g) => g.length > 1);
    console.log(`Personnes distinctes              : ${groups.size}`);
    console.log(`Personnes ayant plusieurs fiches : ${multi.length}`);
    console.log(`Lignes fusionnees (absorbees)    : ${multi.reduce((n, g) => n + g.length - 1, 0)}\n`);

    const aliasRows = [];
    const updates = [];
    const preview = [];

    for (const g of multi) {
      // Fiche canonique : la plus riche ; à égalité, celle au code « personnel »
      // ; à égalité encore, la plus ancienne (plus petit id).
      const sorted = [...g].sort((a, b) => canonicalRank(b) - canonicalRank(a) || a.id - b.id);
      const keep = sorted[0];
      const drop = sorted.slice(1);

      const keepCode = (keep.cmu_number || '').trim();
      for (const d of drop) {
        const oldCode = (d.cmu_number || '').trim();
        if (oldCode && oldCode !== keepCode) aliasRows.push([oldCode, keepCode]);
        updates.push([keepCode || d.cmu_number, d.id]);
      }

      if (preview.length < 12) {
        preview.push({
          personne: `${keep.first_name} ${keep.last_name} (${keep.birth_date})`,
          canonique: keepCode,
          absorbés: drop.map((d) => (d.cmu_number || '(sans code)')).join(', ')
        });
      }
    }

    console.log('--- APERCU DES 12 PREMIERES FUSIONS ---');
    preview.forEach((p) => {
      console.log(`  ${p.personne}`);
      console.log(`     canonique : ${p.canonique}`);
      console.log(`     absorbés  : ${p.absorbés}`);
    });
    console.log(`\nAlias de codes a creer : ${aliasRows.length}`);

    if (!APPLY) {
      console.log("\n>>> SIMULATION : rien n'a ete ecrit. Relancez avec --apply pour appliquer.");
      await pool.end();
      return;
    }

    // 3. Écriture dans une transaction unique : tout ou rien.
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const [alias, canonical] of aliasRows) {
        await client.query(
          `insert into beneficiary_code_aliases (alias_code, canonical_code)
           values ($1, $2)
           on conflict (alias_code) do update set canonical_code = excluded.canonical_code`,
          [alias, canonical]
        );
      }
      for (const [canonical, id] of updates) {
        await client.query(
          'update beneficiaries set merged_into = $1 where id = $2',
          [canonical, id]
        );
      }
      await client.query('commit');
      console.log(`\n${aliasRows.length} alias enregistres, ${updates.length} lignes marquees merged_into`);
      console.log('>>> CONSOLIDATION APPLIQUEE');
    } catch (e) {
      await client.query('rollback');
      console.log('ROLLBACK :', e.message);
      client.release();
      await pool.end();
      process.exit(1);
    }
    client.release();

    // 4. Vérification
    const after = await query(`
      select count(*)::int as actives,
             count(distinct upper(btrim(cmu_number)))::int as codes
      from beneficiaries where merged_into is null
    `);
    console.log(`\nRegistre actif apres consolidation : ${after.rows[0].actives} fiches / ${after.rows[0].codes} codes`);
    const al = await query('select count(*)::int as n from beneficiary_code_aliases');
    console.log(`Aliases disponibles pour le scan  : ${al.rows[0].n}`);

    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();