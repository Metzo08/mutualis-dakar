/**
 * Audit de l'état réel des données : compte les enregistrements effective-
 * ment présents en base par table métier. Sert à distinguer les données
 * réellement saisies des visuels qui masquent une base vide.
 * Usage : node backend/audit-db-real.cjs
 *
 * Le décompte des PERSONNES DISTINCTES (le nombre qui doit apparaître dans le
 * studio cartes) est dans backend/count-real.cjs.
 */
require('dotenv').config();
const { query, pool } = require('./db');

const TABLES = [
  'beneficiaries', 'agents', 'adhesions', 'cotisations', 'payments', 'garanties',
  'beneficiary_dependents', 'structure_routes', 'sponsors'
];

(async () => {
  try {
    const { rows } = await query(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name"
    );
    const present = rows.map((r) => r.table_name);
    console.log('=== TABLES PRESENTES ===');
    console.log(present.join(', '));

    console.log('\n=== EFFECTIF PAR TABLE METIER ===');
    for (const t of TABLES) {
      if (!present.includes(t)) {
        console.log(`${t.padEnd(26)} : (table absente)`);
        continue;
      }
      const r = await query(`select count(*)::int as n from ${t}`);
      console.log(`${t.padEnd(26)} : ${r.rows[0].n}`);
    }

    const cols = await query(
      "select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'beneficiaries' order by ordinal_position"
    );
    console.log('\n=== COLONNES beneficiaries ===');
    console.log(cols.rows.map((c) => `${c.column_name}:${c.data_type}`).join(', '));

    const sample = await query('select * from beneficiaries limit 3');
    console.log('\n=== EXEMPLES ===');
    for (const r of sample.rows) {
      const shown = {};
      for (const [k, v] of Object.entries(r)) {
        if (v !== null && v !== '' && typeof v !== 'object') shown[k] = v;
      }
      console.log(JSON.stringify(shown).slice(0, 400));
    }

    // NB : COALESCE exige au moins DEUX arguments en PostgreSQL (il est réécrit
    // en CASE WHEN). `coalesce(x)` seul produit « syntax error near as ».
    const grp = await query(
      `select nullif(btrim(department), '') as d, count(*)::int as n
       from beneficiaries group by 1 order by n desc limit 20`
    );
    console.log('\n=== DEPARTMENT (colonne filtree par le RBAC agent) ===');
    grp.rows.forEach((r) => console.log(`  ${String(r.d || '(vide)').padEnd(26)} : ${r.n}`));

    const mut = await query(
      `select nullif(btrim(mutuelle_name), '') as m, count(*)::int as n
       from beneficiaries group by 1 order by n desc limit 15`
    );
    console.log('\n=== MUTUELLE_NAME ===');
    mut.rows.forEach((r) => console.log(`  ${String(r.m || '(vide)').padEnd(46)} : ${r.n}`));

    // Comparaison département agent <-> valeurs réelles de la colonne.
    // Un agent dont le département ne correspond à AUCUNE valeur de la colonne
    // ne voit aucun bénéficiaire : c'est un agent « aveugle », pas un agent
    // sans travail. On le signale explicitement.
    const agents = await query('select username, role, department from agents').catch(() => ({ rows: [] }));
    console.log('\n=== COMPARAISON AGENTS <-> DEPARTMENT ===');
    const deptValues = grp.rows.map((r) => String(r.d).trim().toLowerCase());
    for (const a of agents.rows) {
      if (!a.department) {
        console.log(`  ${a.username} (${a.role}) : Super Admin -> aucun filtre`);
        continue;
      }
      const norm = String(a.department).trim().toLowerCase();
      const row = grp.rows.find((r) => String(r.d).trim().toLowerCase() === norm);
      if (row) {
        console.log(`  ${a.username} (${a.role}) dept=${JSON.stringify(a.department)} -> ${row.n} fiche(s)`);
      } else {
        console.log(`  ${a.username} (${a.role}) dept=${JSON.stringify(a.department)}`);
        console.log(`     >>> AUCUNE VALEUR CORRESPONDANTE dans beneficiaries.department`);
        console.log(`     valeurs reelles : ${deptValues.join(' | ')}`);
        console.log(`     => cet agent ne voit AUCUN beneficiaire (agent aveugle)`);
      }
    }

    // ── Isolement par MSD ───────────────────────────────────────────────────
    // `department` ne contient que 3 valeurs alors que les assurés relèvent de
    // 24 MSD (via `mutuelle_name`). Tant que ces deux notions ne se
    // correspondent pas, un agent de MSD ne peut pas être cantonné à SA MSD :
    // le filtre porterait sur des valeurs absentes de la colonne.
    const perMsd = await query(`
      select nullif(btrim(mutuelle_name),'') as m, count(*)::int as n
      from beneficiaries where merged_into is null
      group by 1 order by n desc
    `);
    const perDept = await query(`
      select nullif(btrim(department),'') as d, count(*)::int as n
      from beneficiaries where merged_into is null
      group by 1 order by n desc
    `);
    console.log('\n=== ISOLEMENT PAR MSD ===');
    console.log(`  MSD distinctes (mutuelle_name) : ${perMsd.rows.length}`);
    console.log('  valeurs de department          :');
    perDept.rows.forEach((r) => console.log(`     ${String(r.d || '(vide)').padEnd(22)} : ${r.n}`));
    if (perMsd.rows.length > perDept.rows.length) {
      console.log('  >>> `department` ne permet PAS d isoler une MSD.');
      console.log('      Le rattachement des agents doit passer par la MSD (mutuelle_name).');
    }

    console.log('\n=== LIBELLES DE MUTUELLE (valeurs exactes) ===');
    perMsd.rows.forEach((r) => console.log(`   [${r.n}] ${JSON.stringify(r.m)}`));

    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();