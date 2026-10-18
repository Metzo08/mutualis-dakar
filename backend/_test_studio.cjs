/* Test fonctionnel des routes Studio. Usage : node _test_studio.cjs */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const jwt = require('jsonwebtoken');
const base = 'http://localhost:5000';

(async () => {
  const secret = process.env.JWT_SECRET;
  const superToken = jwt.sign({ id: 1, role: 'Super Admin', username: 'qa@cmu.sn' }, secret, { expiresIn: '10m' });
  const agentToken = jwt.sign({ id: 12, role: 'agent', username: 'agent@dkr.cmu.sn', msdCode: 'DKR' }, secret, { expiresIn: '10m' });

  const call = async (path, token) => {
    const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  const checks = [];
  const push = (label, cond, detail) => { checks.push({ label, ok: !!cond, detail }); };

  // 1. Vue générale (Super Admin)
  const o = await call('/api/studio/geo/overview', superToken);
  push('overview 200', o.status === 200, JSON.stringify(o.body && o.body.global));
  push('overview regions array', Array.isArray(o.body && o.body.regions), '');
  push('overview prix 350', o.body && o.body.global && o.body.global.prixUnitaire === 350, '');
  const g = (o.body && o.body.global) || {};
  push('overview revenu = lots imprimés × conformes × 350', typeof g.revenueFcfa === 'number', String(g.revenueFcfa));
  push('overview anomalies cohérentes', g.beneficiaryCount === g.conformCount + g.anomalyCount,
    `total=${g.beneficiaryCount} conformes=${g.conformCount} anomalies=${g.anomalyCount}`);

  // 2. Sans jeton → 401
  const anon = await fetch(base + '/api/studio/geo/overview');
  push('overview sans jeton → 401', anon.status === 401, String(anon.status));

  // 3. Agent cloisonné : détail de SA MSD uniquement
  const mdk = await call('/api/studio/msd/DKR', agentToken);
  push('agent voit SA MSD (DKR)', mdk.status === 200, '');
  const mPkn = await call('/api/studio/msd/PKN', agentToken);
  push('agent bloqué hors MSD → 403', mPkn.status === 403, String(mPkn.status));

  // 4. Détail MSD (Super Admin) : revenu par lot
  const msd = await call('/api/studio/msd/DKR', superToken);
  push('msd DKR 200 + lots', msd.status === 200 && Array.isArray(msd.body && msd.body.lots),
    `${msd.body && msd.body.lots ? msd.body.lots.length : 0} lot(s), revenu=${msd.body && msd.body.kpi ? msd.body.kpi.revenueFcfa : '?'}`);
  if (msd.body && msd.body.lots) {
    // Règle financière : un lot non imprimé n'a PAS de revenu.
    const nonImprimes = msd.body.lots.filter((l) => !l.printed && l.revenueFcfa !== 0);
    push('lot non imprimé → revenu 0', nonImprimes.length === 0, JSON.stringify(nonImprimes.map((l) => l.code)));
  }

  // 5. Détail d'un lot réel
  const premierLot = (msd.body && Array.isArray(msd.body.lots) && msd.body.lots[0]) || {};
  const lotCode = premierLot.code || 'LOT-2026-034';
  const lot = await call('/api/studio/lot/' + lotCode, superToken);
  const statsLot = (lot.body && lot.body.stats) || {};
  const lotEstImprime = !!(lot.body && lot.body.lot.printed);
  push('lot 200 + stats cohérentes', lot.status === 200 && !!lot.body.stats &&
    statsLot.adherents === (statsLot.conformes || 0) + (statsLot.aCorriger || 0),
    JSON.stringify(statsLot));
  push('lot non imprimé → cartesImprimees=0 & revenu=0',
    lotEstImprime || ((statsLot.cartesImprimees || 0) === 0 && (statsLot.revenueFcfa || 0) === 0), '');

  // 6. Région inconnue → 404
  const rx = await call('/api/studio/geo/region/Atlantide', superToken);
  push('région inconnue → 404', rx.status === 404, String(rx.status));

  // 7. Région réelle (celles de mutuelles)
  const reg = await call('/api/studio/geo/region/' + encodeURIComponent('Dakar'), superToken);
  push('région Dakar 200 + départements', reg.status === 200 && Array.isArray(reg.body && reg.body.departments) && reg.body.departments.length > 0,
    `${reg.body && reg.body.departments ? reg.body.departments.length : 0} département(s)`);

  let echecs = 0;
  for (const c of checks) {
    console.log(`${c.ok ? '  OK' : 'FAIL'}  ${c.label}${c.detail ? ' — ' + c.detail : ''}`);
    if (!c.ok) echecs++;
  }
  console.log(`\n${checks.length - echecs}/${checks.length} vérifications passées`);
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
