/**
 * Rattache les AGENTS à leur MSD, et vérifie que chaque MSD a bien un agent.
 *
 * RÈGLE MÉTIER
 *  - Un Super Admin n'appartient à aucune MSD : il supervise toutes les MSD et
 *    est le seul habilité à en créer une nouvelle.
 *  - Un agent de MSD est cantonné à SA MSD. Il doit y avoir un accès complet :
 *    ses assurés, leurs cartes, leurs cotisations, leurs garanties, leurs bons
 *    de commande, leurs statistiques. Le cloisonnement protège la vie privée
 *    des assurés d'une autre MSD, il ne doit jamais empêcher un agent de
 *    produire les actes de prise en charge de SES propres assurés.
 *
 * AUCUN RATTACHEMENT DEVINÉ
 * Un libellé de département qui ne correspond à aucune MSD du registre laisse
 * l'agent SANS rattachement plutôt que de l'affecter au hasard : le Super Admin
 * voit alors la liste des comptes à corriger et tranche.
 *
 * Usage :
 *   node backend/link-agents-msd.cjs           (simulation)
 *   node backend/link-agents-msd.cjs --apply   (écriture)
 */
// Le .env vit dans backend/ : lancé depuis la racine du dépôt, `dotenv` ne le
// trouve pas et la connexion part avec des identifiants vides. Même correctif
// que `link-beneficiaries-msd.cjs`.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { query, pool } = require('./db');
const { msdFromAgentLabel } = require('./msdScope');

const APPLY = process.argv.includes('--apply');

(async () => {
  try {
    await query('alter table agents add column if not exists msd_code varchar(20)');
    // La colonne `beneficiaries.msd_code` est utilisée par l'INSERT et l'UPDATE
    // de `POST /api/beneficiaries/bulk` : si elle manque, TOUT import échoue et
    // bascule silencieusement sur le fichier de secours (donc aucune photo en
    // base). On la garantit ici, au même endroit que pour les agents, afin que
    // ce script suffise à rendre une instance opérationnelle.
    await query('alter table beneficiaries add column if not exists msd_code varchar(20)');
    await query('create index if not exists idx_beneficiaries_msd on beneficiaries(msd_code)');
    console.log('Colonnes prêtes : agents.msd_code, beneficiaries.msd_code\n');

    const msds = await query(
      'select union_code, union_name, region from merchant_accounts order by union_code'
    );

    const agents = await query(
      'select id, username, role, department, msd_code from agents order by id'
    );

    const updates = [];
    const unresolved = [];

    console.log('=== RATTACHEMENT DES AGENTS ===');
    for (const a of agents.rows) {
      const isSuper = String(a.role) === 'Super Admin';

      if (isSuper) {
        console.log(`  ${String(a.username).padEnd(28)} Super Admin  -> aucune MSD (supervise tout)`);
        if (a.msd_code) updates.push([null, a.id]);
        continue;
      }

      const code = msdFromAgentLabel(a.department, msds.rows);
      if (code) {
        const name = msds.rows.find((m) => m.union_code === code);
        console.log(`  ${String(a.username).padEnd(28)} ${String(a.department).padEnd(16)} -> ${code} (${name ? name.union_name : ''})`);
        if (a.msd_code !== code) updates.push([code, a.id]);
      } else {
        unresolved.push(a);
        console.log(`  ${String(a.username).padEnd(28)} ${String(a.department).padEnd(16)} -> >>> NON RATTACHÉ`);
      }
    }

    // Couverture : chaque MSD doit-elle avoir au moins un agent ?
    const counts = await query(`
      select msd_code, count(*)::int as n from beneficiaries
      where merged_into is null and msd_code is not null group by 1
    `);
    const withAgents = new Set(updates.map((u) => u[0]).filter(Boolean));
    const realAgents = await query(
      "select distinct msd_code from agents where msd_code is not null"
    );
    const agentCodes = new Set(realAgents.rows.map((r) => r.msd_code));

    console.log('\n=== COUVERTURE DES MSD ===');
    for (const m of msds.rows) {
      const ben = counts.rows.find((c) => c.msd_code === m.union_code);
      const n = ben ? ben.n : 0;
      if (m.union_code === 'AGG') continue; // compte agrégateur, pas une MSD
      const hasAgent = agentCodes.has(m.union_code);
      console.log(
        `  ${m.union_code} : ${String(n).padStart(4)} assuré(s)` +
        (hasAgent ? '  [agent rattaché]' : '  [AUCUN AGENT]')
      );
    }

    if (unresolved.length) {
      console.log('\n=== COMPTES À CORRIGER PAR LE SUPER ADMIN ===');
      unresolved.forEach((a) => {
        console.log(`  ${a.username} : département « ${a.department} » ne correspond à aucune MSD du registre`);
      });
    }

    if (!APPLY) {
      console.log('\n>>> SIMULATION : rien n\'a ete ecrit. Relancez avec --apply.');
      await pool.end();
      // ⚠️ Code de sortie 1 si des comptes restent sans rattachement : un
      // déploiement automatisé doit pouvoir GATER la mise en production sur ce
      // script. Sans rattachement, `POST /api/beneficiaries/bulk` répond 403 à
      // l'agent (fail-clos) et il ne peut plus importer.
      process.exit(unresolved.length > 0 ? 1 : 0);
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const [code, id] of updates) {
        await client.query('update agents set msd_code = $1 where id = $2', [code, id]);
      }
      await client.query('commit');
      console.log(`\n${updates.length} agents rattachés`);
    } catch (e) {
      await client.query('rollback');
      console.log('ROLLBACK :', e.message);
      client.release();
      await pool.end();
      process.exit(1);
    }
    client.release();

    const check = await query('select username, role, department, msd_code from agents order by id');
    console.log('\n=== VERIFICATION ===');
    const encoreSansMsd = [];
    check.rows.forEach((a) => {
      const superviseur = String(a.role || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin';
      // Un superviseur SANS MSD est normal (il supervise toutes les MSD) ; un
      // agent SANS MSD est un blocage : il recevra 403 sur l'import en masse.
      if (!superviseur && !a.msd_code) encoreSansMsd.push(a.username);
      console.log(`  ${String(a.username).padEnd(28)} ${String(a.role).padEnd(14)} ${a.msd_code || (superviseur ? '(superviseur — toutes MSD)' : '(AUCUNE MSD)')}`);
    });

    await pool.end();

    if (encoreSansMsd.length > 0) {
      console.error(`\n✗ ${encoreSansMsd.length} compte(s) agent restent SANS rattachement : ${encoreSansMsd.join(', ')}`);
      console.error('  Leur import en masse répondra 403 jusqu\'à affectation par le Super Admin.');
      process.exit(1);
    }
    console.log('\n✓ Tous les comptes agents sont rattachés à une MSD (ou superviseurs).');
  } catch (err) {
    console.log('ERREUR :', err.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();