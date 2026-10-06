// Vérifie que le bus temps réel fonctionne et bascule correctement.
//
// Deux scénarios qui comptent en production :
//   1. Redis disponible → les messages traversent.
//   2. Redis INJOIGNABLE → l'application bascule sur PostgreSQL au lieu
//      de rester muette. C'est ce qui évite qu'une coupure Redis fasse
//      tomber toutes les téléconsultations en cours.
const Redis = require('ioredis');
const {
  initRealtime,
  closeRealtime,
  publishRealtime,
  subscribeRealtime,
  realtimeStatus
} = require('./realtimeBus');

// L'URL par défaut vise l'interieur du reseau Docker (nom de service) :
// c'est le seul endroit ou le conteneur Redis est joignable — il n'expose
// volontairement aucun port vers l'hote. Un test lance hors Docker passe
// REDIS_URL explicitement.
const URL_REDIS = process.env.REDIS_URL || 'redis://redis:6379';
const results = [];

const record = (label, pass, detail) => {
  results.push({ label, pass, detail });
  console.log(`${pass ? 'OK   ' : 'ECHEC'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log('\n=== BUS TEMPS RÉEL — REDIS ET REPLI ===\n');

  // ── Redis est-il joignable sur cette machine ?
  const probe = new Redis(URL_REDIS, { maxRetriesPerRequest: 1, retryStrategy: () => null });
  let redisUp = false;
  try {
    await probe.ping();
    redisUp = true;
  } catch (err) {
    console.log(`(Redis injoignable sur ${URL_REDIS} : ${err.message})`);
  }
  probe.disconnect();

  console.log('--- Scénario 1 : Redis en service ---');
  process.env.REALTIME_DRIVER = 'redis';
  process.env.REDIS_URL = URL_REDIS;

  if (redisUp) {
    const driver = await initRealtime();
    record('le bus démarre sur Redis', driver === 'redis', `driver=${driver}`);

    let received = null;
    subscribeRealtime((event) => { if (event && event.type === 'test-ping') received = event; });

    await publishRealtime({ type: 'test-ping', payload: 'salut' });
    await wait(700);
    record('un message publié est reçu en abonné', !!received && received.payload === 'salut');

    // Charge : un SDP réel fait plusieurs kilo-octets. C'est précisément
    // ce que PostgreSQL NOTIFY ne supporte pas de façon fiable.
    const bigSdp = 'v=0\r\n' + 'a=rtpmap:96 H264/90000\r\n'.repeat(400);
    let bigReceived = null;
    subscribeRealtime((event) => { if (event && event.type === 'telemed-signal') bigReceived = event; });
    await publishRealtime({ type: 'telemed-signal', room: 'test', message: { description: { sdp: bigSdp } } });
    await wait(700);
    const bigOk = bigReceived && bigReceived.message?.description?.sdp?.length === bigSdp.length;
    record(`un SDP de ${Math.round(bigSdp.length / 1024)} Ko traverse sans troncature`, !!bigOk);

    const st = realtimeStatus();
    record('le diagnostic expose le pilote Redis', st.driver === 'redis' && st.redis_healthy === true);
    await closeRealtime();
  } else {
    record('scénario Redis ignoré (service absent)', true, 'non applicable');
  }

  console.log('\n--- Scénario 2 : Redis injoignable, repli PostgreSQL ---');
  process.env.REALTIME_DRIVER = 'redis';
  process.env.REDIS_URL = 'redis://127.0.0.1:6399'; // port fermé

  const started = Date.now();
  const driver = await initRealtime();
  const elapsed = Date.now() - started;
  record(
    "l'instance démarre malgré Redis injoignable",
    driver === 'postgres',
    `driver=${driver} en ${elapsed} ms`
  );
  record(
    'le repli est rapide (une consultation ne doit pas attendre)',
    elapsed < 10000,
    `${elapsed} ms`
  );

  const st2 = realtimeStatus();
  record('le diagnostic signale le repli', st2.driver === 'postgres');

  await closeRealtime();

  console.log('\n--- Bilan ---');
  const ok = results.filter((r) => r.pass).length;
  console.log(`\n${ok}/${results.length} tests réussis`);
  console.log(ok === results.length ? 'RESULTAT: OK' : 'RESULTAT: ECHEC');
  process.exit(ok === results.length ? 0 : 1);
})().catch((err) => {
  console.error('ERREUR FATALE: ' + err.message);
  process.exit(1);
});