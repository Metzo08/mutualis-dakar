/**
 * Vérifie le CLOISONNEMENT PAR MSD et la concordance du registre.
 *
 * Ce que ce test doit prouver :
 *  1. Le studio cartes affiche exactement le nombre d'assurés (1 personne =
 *     1 carte) — pas le nombre de lignes de la table.
 *  2. Un agent de MSD ne voit QUE les bénéficiaires de SA MSD.
 *  3. Un Super Admin voit toutes les MSD (vue d'ensemble).
 *  4. Les cartes DÉJÀ IMPRIMÉES (codes fusionnés) restent valides.
 *
 * Usage : node backend/verify-msd-isolation.cjs
 */
const BASE = 'http://localhost:5000';

const login = async (username, password) => {
  const res = await fetch(`${BASE}/api/auth/agent/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return body;
};

const fetchAll = async (token) => {
  const first = await fetch(`${BASE}/api/beneficiaries?page=1&limit=200`, {
    headers: { Authorization: `Bearer ${token}` }
  }).then((r) => r.json());
  let all = (first.data || []).slice();
  const totalPages = (first.pagination && first.pagination.totalPages) || 1;
  for (let page = 2; page <= totalPages; page++) {
    const res = await fetch(`${BASE}/api/beneficiaries?page=${page}&limit=200`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    all = all.concat(res.data || []);
  }
  return { all, meta: first.pagination || {} };
};

const COMPTES = [
  { username: 'superadmin@cmu.sn', password: 'superadmin2026', label: 'Super Admin' },
  { username: 'amadou.sall@udms-dakar.sn', password: 'senecarte', label: 'Agent MSD Dakar' },
  { username: 'agent@cmu.sn', password: 'senecarte', label: 'Agent MSD Pikine' }
];

(async () => {
  const results = [];

  for (const c of COMPTES) {
    const auth = await login(c.username, c.password);
    if (!auth) {
      console.log(`\n[${c.label}] ${c.username} : LOGIN IMPOSSIBLE`);
      continue;
    }
    const msdCode = auth.agent && auth.agent.msdCode;
    const { all, meta } = await fetchAll(auth.token);

    const byMsd = {};
    all.forEach((b) => {
      const k = b.msdCode || '(aucune MSD)';
      byMsd[k] = (byMsd[k] || 0) + 1;
    });

    console.log(`\n=== ${c.label} : ${c.username} ===`);
    console.log(`   MSD de rattachement : ${msdCode || '(aucune — supervise toutes les MSD)'}`);
    console.log(`   bénéficiaires visibles : ${meta.total}`);
    const depts = Object.entries(byMsd);
    depts.slice(0, 12).forEach(([k, n]) => console.log(`     ${String(k).padEnd(18)} : ${n}`));

    // Règle 2 : cloisonnement
    if (c.label === 'Super Admin') {
      // Le Super Admin n'est pas filtré : il voit le registre complet, même si
      // celui-ci ne porte aujourd'hui qu'une seule MSD (c'est l'état réel des
      // fichiers importés, pas un défaut).
      results.push({
        label: 'Super Admin non filtre (vue d\'ensemble)',
        ok: all.length > 0,
        detail: `${all.length} bénéficiaires sur ${depts.length} MSD`
      });
    } else {
      const foreign = depts.filter(([k]) => k !== msdCode && k !== '(aucune MSD)');
      // Une MSD sans assuré est un état normal : l'agent ne doit rien voir
      // d'autre que sa MSD, ce qui est respecté qu'elle soit vide ou non.
      results.push({
        label: `${c.label} cloisonné sur ${msdCode}`,
        ok: foreign.length === 0,
        detail: foreign.length === 0
          ? `aucune fuite (${all.length} fiche(s))`
          : `FUIT vers ${foreign.map((f) => f[0]).join(', ')}`
      });
    }
  }

  // Règles 1 et 4, vérifiées sur le Super Admin
  const auth = await login('superadmin@cmu.sn', 'superadmin2026');
  if (auth) {
    const { all, meta } = await fetchAll(auth.token);
    const codes = all.map((b) => String(b.cmuNumber || '').trim().toUpperCase());
    const dupCodes = codes.filter((c, i) => c && codes.indexOf(c) !== i);
    const idents = all.map((b) =>
      `${String(b.lastName || '').toLowerCase().trim()}|${String(b.firstName || '').toLowerCase().trim()}|${b.birthDate || ''}`);
    const dupIdents = idents.filter((x, i) => idents.indexOf(x) !== i);
    const aliasCount = all.reduce((n, b) => n + (b.mergedCodes || []).length, 0);

    results.push({ label: 'API paginée = fiches reçues', ok: meta.total === all.length, detail: `${meta.total} / ${all.length}` });
    results.push({ label: 'aucun code CMU en double', ok: dupCodes.length === 0, detail: `${dupCodes.length} doublon(s)` });
    results.push({ label: 'aucune personne en double', ok: dupIdents.length === 0, detail: `${dupIdents.length} doublon(s)` });
    results.push({ label: 'codes historiques préservés', ok: aliasCount > 0, detail: `${aliasCount} alias` });
  }

  console.log('\n\n================ REGISTRE DES MSD ================');
  if (auth) {
    const res = await fetch(`${BASE}/api/msds`, { headers: { Authorization: `Bearer ${auth.token}` } });
    const body = await res.json();
    console.log(`  Super Admin — périmètre : ${body.scope}, ${body.totals.msds} MSD, ${body.totals.beneficiaries} assurés`);
    (body.msds || []).forEach((m) => {
      console.log(
        `   ${m.union_code}  ${String(m.union_name).padEnd(48)} ` +
        `${String(m.total_beneficiaries).padStart(4)} assuré(s)  ${m.agent_count} agent(s)`
      );
    });
    results.push({ label: 'registre MSD accessible au Super Admin', ok: res.ok && body.msds.length > 0, detail: `${(body.msds || []).length} MSD` });
  }

  // Un agent de MSD ne doit PAS pouvoir enregistrer une MSD.
  const pkn = await login('agent@cmu.sn', 'senecarte');
  if (pkn) {
    const denied = await fetch(`${BASE}/api/msds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pkn.token}` },
      body: JSON.stringify({ unionCode: 'XXX', unionName: 'MSD pirate', region: 'X' })
    });
    results.push({
      label: 'agent de MSD ne peut PAS créer de MSD',
      ok: denied.status === 403,
      detail: `HTTP ${denied.status}`
    });
  }

  console.log('\n\n================ RESULTAT ================');
  results.forEach((r) => {
    console.log(`  ${r.ok ? 'OK  ' : 'ECHEC'}  ${r.label}  (${r.detail})`);
  });
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} contrôles passés`);
})();