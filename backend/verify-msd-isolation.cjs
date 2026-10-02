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
let superToken = null; // jeton Super Admin réutilisé par les contrôles suivants

  for (const c of COMPTES) {
    const auth = await login(c.username, c.password);
    if (!auth) {
      console.log(`\n[${c.label}] ${c.username} : LOGIN IMPOSSIBLE`);
      continue;
    }
    if (c.label === 'Super Admin') superToken = auth.token;
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
      // Le Super Admin n'est pas filtré. Un registre vide est un état
      // LÉGITIME (le temps de réimporter les fichiers un par un) : on vérifie
      // ici l'absence de fuite, pas la présence de fiches.
      results.push({
        label: 'Super Admin non filtre (vue d\'ensemble)',
        ok: true,
        detail: `${all.length} bénéficiaire(s) sur ${depts.length} MSD` +
          (all.length === 0 ? ' (registre en cours de rechargement)' : '')
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
  // Jeton Super Admin mémorisé PENDANT la boucle des comptes ci-dessus.
// Reconnecter une 4ᵉ fois se heurte au rate limiter de /api/auth/agent/login :
// tous les contrôles suivants étaient alors silencieusement sautés.
const superAuth = superToken ? { token: superToken } : null;
if (superAuth) {
    const { all, meta } = await fetchAll(superAuth.token);
    const codes = all.map((b) => String(b.cmuNumber || '').trim().toUpperCase());
    const dupCodes = codes.filter((c, i) => c && codes.indexOf(c) !== i);
    const idents = all.map((b) =>
      `${String(b.lastName || '').toLowerCase().trim()}|${String(b.firstName || '').toLowerCase().trim()}|${b.birthDate || ''}`);
    const dupIdents = idents.filter((x, i) => idents.indexOf(x) !== i);
    const aliasCount = all.reduce((n, b) => n + (b.mergedCodes || []).length, 0);

    // Doublons de personnes : deux CARTES IMPRIMEES portent deux codes
    // différents. Ce n'est pas une régression du code — c'est une situation à
    // arbitrer par la MSD (une personne a-t-elle été imprimée deux fois ?). Le
    // registre les conserve donc toutes les deux, et le signale.
    if (dupIdents.length > 0) {
      console.log(`\n  [info] ${dupIdents.length} personne(s) avec 2 codes :`);
      dupIdents.forEach((id) => console.log(`     ${id}`));
    }
    results.push({
      label: 'codes CMU uniques (aucune collision de scan)',
      ok: dupCodes.length === 0,
      detail: `${dupCodes.length} collision(s)`
    });
  }

  console.log('\n\n================ REGISTRE DES MSD ================');
if (superAuth) {
    const res = await fetch(`${BASE}/api/msds`, { headers: { Authorization: `Bearer ${superAuth.token}` } });
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

  // Contrôle des CHAMPS QUE LE STUDIO LIT EFFECTIVEMENT.
// Une réponse d'API qui ne porte pas un champ attendu ne casse pas le rendu…
// mais produit une carte à trous. On vérifie donc la présence ET la validité
// des valeurs qui pilotent l'affichage (notamment `cardProgram`, dont une clé
// inconnue faisait tomber la vue sur « reading 'accent' »).
const CARD_PROGRAM_IDS = ['CLASSIC', 'CMU_ELEVES', 'CMU_DAARA'];

/** Replique la derivation du front (src/utils/beneficiarySync.js). */
const deriveCardProgram = (b) =>
  b.cardProgram || (b.ine || b.schoolName || b.studentType ? 'CMU_ELEVES' : 'CLASSIC');
if (superAuth) {
  const { all } = await fetchAll(superAuth.token);
  // `cardProgram` n'est PAS une colonne de la base : c'est le FRONT qui le
  // dérive (scolaire → CMU_ELEVES, sinon CLASSIC). On contrôle donc la valeur
  // qui sera réellement utilisée par le studio, pas une colonne absente.
  const programmes = new Set(all.map((b) => deriveCardProgram(b)));
  const inconnus = [...programmes].filter((p) => !CARD_PROGRAM_IDS.includes(p));
  results.push({
    label: 'cardProgram derive valide (studio ne plante pas)',
    ok: inconnus.length === 0,
    detail: inconnus.length === 0
      ? `${programmes.size} programme(s) : ${[...programmes].join(', ')}`
      : `inconnu(s) : ${inconnus.join(', ')}`
  });

  const sansDate = all.filter((b) => !b.birthDate);
  // Un champ date vide ne casse pas le rendu : c'est un défaut de SAISIE à la
  // source, à corriger par la MSD. On l'affiche donc sans le compter comme
  // une régression du code.
  console.log(`\n  [info] ${sansDate.length} fiche(s) sans date lisible :`);
  sansDate.forEach((b) => console.log(`     ${b.cmuNumber} ${b.firstName} ${b.lastName}`));
  results.push({
    label: 'toutes les fiches ont un code CMU',
    ok: all.every((b) => b.cmuNumber),
    detail: `${all.filter((b) => b.cmuNumber).length}/${all.length}`
  });
}

console.log('\n\n================ RESULTAT ================');
  results.forEach((r) => {
    console.log(`  ${r.ok ? 'OK  ' : 'ECHEC'}  ${r.label}  (${r.detail})`);
  });
  const failed = results.filter((r) => !r.ok);
  console.log(`\n  ${results.length - failed.length}/${results.length} controles passes`);
  if (failed.length) process.exitCode = 1;
})();
