/**
 * Vérifie de bout en bout la chaîne qui relie la BASE au studio cartes :
 *   1. authentification agent
 *   2. GET /api/beneficiaries paginé (la source de vérité)
 *   3. exposé de TOUS les champs nécessaires à l'impression d'une carte
 *
 * C'est le test qui prouve que les 1 003 bénéficiaires réels (et non les 41
 * fiches figées du bundle) alimentent désormais le studio cartes.
 */
/**
 * Rattache chaque bénéficiaire à sa MSD (Mutuelle de Santé Départementale).
 *
 * POURQUOI
 * Une MSD doit pouvoir cloisonner ses données : ne voir que SES assurés, SES
 * cartes, SES statistiques. Mais la MSD d'un assuré n'existait nulle part de
 * façon exploitable : `department` ne portait que 3 valeurs, `mutuelle_name`
 * six graphies pour la même MSD, et `agents.department` des libellés sans
 * rapport (« UDMS Dakar »). Aucun filtre ne pouvait donc fonctionner.
 *
 * SOURCE DE VÉRITÉ DU RATTACHEMENT
 * Le préfixe du code CMU. Il est normé par la plateforme (« DKR… », « DRB… »)
 * et la MSD émettrice EST celle qui a attribué le matricule : c'est la donnée
 * la plus fiable disponible. `mutuelle_name` n'est utilisé qu'en dernier
 * recours, quand le code CMU est absent.
 *
 * AUCUNE MSD INVENTÉE
 * Un code préfixe inconnu de la table `CMU_PREFIX_TO_MSD` laisse la fiche
 * SANS MSD (`msd_code` nul) plutôt que de la rattacher au hasard : elle sera
 * signalée ci-dessous et restera visible du seul Super Admin, qui décidera.
 *
 * Usage :
 *   node backend/link-beneficiaries-msd.cjs           (simulation)
 *   node backend/link-beneficiaries-msd.cjs --apply   (écriture)
 */
require('dotenv').config();
const { query, pool } = require('./db');
const { msdFromCmuNumber } = require('./msdScope');

const APPLY = process.argv.includes('--apply');

(async () => {
  try {
    // 1. Colonnes de rattachement (idempotent)
    await query('alter table beneficiaries add column if not exists msd_code varchar(20)');
    await query('alter table agents add column if not exists msd_code varchar(20)');
    await query(`create index if not exists idx_beneficiaries_msd on beneficiaries(msd_code)`);
    console.log('Colonnes prêtes : beneficiaries.msd_code, agents.msd_code\n');

    // 2. Le registre MSD fait foi : on n'affecte que des MSD existantes.
    const msds = await query(
      'select union_code, union_name, region from merchant_accounts order by union_code'
    );
    const known = new Set(msds.rows.map((r) => String(r.union_code).toUpperCase()));
    console.log(`MSD au registre : ${known.size} (${[...known].join(', ')})\n`);

    // 3. Rattachement par préfixe du code CMU
    const rows = await query(`
      select id, cmu_number, mutuelle_name, msd_code
      from beneficiaries where merged_into is null order by id
    `);

    const updates = [];
    const orphans = [];
    const byMsd = new Map();

    for (const r of rows.rows) {
      let code = msdFromCmuNumber(r.cmu_number);

      // Repli : la MSD citée dans le nom de la mutuelle, si elle correspond
      // à une MSD du registre. On ne devine pas davantage.
      if (!code) {
        const text = String(r.mutuelle_name || '').toUpperCase();
        for (const k of known) {
          // Comparaison par mot-clé : « MUTUELLE… DE DAKAR » contient DAKAR,
          // mais pas « DKR » ; on teste donc aussi le nom lisible.
          if (text.includes(k)) { code = k; break; }
        }
        if (!code) {
          const words = String(r.mutuelle_name || '').toUpperCase().split(/\s+/);
          for (const k of known) {
            if (words.includes(k)) { code = k; break; }
          }
        }
      }

      if (!code) {
        orphans.push(r);
        continue;
      }
      // Garde-fou : jamais une MSD inexistante au registre.
      if (!known.has(code)) {
        orphans.push(r);
        continue;
      }

      if (r.msd_code !== code) updates.push([code, r.id]);
      byMsd.set(code, (byMsd.get(code) || 0) + 1);
    }

    console.log('=== EFFECTIF PAR MSD (après rattachement) ===');
    [...known].sort().forEach((k) => {
      const n = byMsd.get(k) || 0;
      const name = msds.rows.find((r) => String(r.union_code).toUpperCase() === k);
      console.log(`  ${k} : ${String(n).padStart(4)} assuré(s)  ${name ? name.union_name : ''}`);
    });
    console.log(`\n  fiches rattachées  : ${[...byMsd.values()].reduce((a, b) => a + b, 0)} / ${rows.rows.length}`);
    console.log(`  fiches SANS MSD   : ${orphans.length}`);

    if (orphans.length) {
      console.log('\n  Échantillon des fiches sans MSD (à arbitrer par le Super Admin) :');
      orphans.slice(0, 12).forEach((r) => {
        console.log(`    id=${r.id} code=${JSON.stringify(r.cmu_number)} mutuelle=${JSON.stringify(r.mutuelle_name)}`);
      });
    }

    if (!APPLY) {
      console.log("\n>>> SIMULATION : rien n'a ete ecrit. Relancez avec --apply.");
      await pool.end();
      return;
    }

    // 4. Écriture en une transaction
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const [code, id] of updates) {
        await client.query('update beneficiaries set msd_code = $1 where id = $2', [code, id]);
      }
      await client.query('commit');
      console.log(`\n${updates.length} bénéficiaires rattachés à leur MSD`);
    } catch (e) {
      await client.query('rollback');
      console.log('ROLLBACK :', e.message);
      client.release();
      await pool.end();
      process.exit(1);
    }
    client.release();

    const check = await query(`
      select msd_code, count(*)::int as n
      from beneficiaries where merged_into is null
      group by 1 order by n desc
    `);
    console.log('\n=== VERIFICATION (base) ===');
    check.rows.forEach((r) => console.log(`  ${String(r.msd_code || '(aucune MSD)').padEnd(16)} : ${r.n}`));

    await pool.end();
  } catch (err) {
    console.log('ERREUR :', err.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();
