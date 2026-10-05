// ─────────────────────────────────────────────────────────────────────────
// BUS TEMPS RÉEL MULTI-INSTANCE
//
// Pourquoi ce module existe
// -----------------------
// Une connexion WebSocket appartient à l'instance qui l'a acceptée. Le
// praticien peut être sur l'instance A et l'assuré sur l'instance B : il
// faut un canal de signalisation PARTAGÉ, sinon aucune offre ne traverse et
// la téléconsultation reste muette.
//
// Pourquoi Redis plutôt que PostgreSQL LISTEN/NOTIFY
// -------------------------------------------------
// PostgreSQL NOTIFY plafonne la taille du payload (environ 8 000 octets, et
// jusqu'à ~32 Ko selon la version). Une offre WebRTC avec sa description
// SDP complète dépasse facilement ce plafond quand la connexion ICE est
// riche en candidats. Le message serait alors tronqué ou refusé : la
// négociation échoue et le praticien voit une consultation qui ne démarre
// pas.
//
// Redis Pub/Sub accepte des messages de 512 Mo. La marge est qualitative,
// et non un seuil à surveiller de près.
//
// Redis apporte en plus ce dont on a besoin à l'échelle :
//   • un compteur de présence distribué, sans table à écrire à chaque
//     battement de cœur ;
//   • un rate limiting distribué (les limites en mémoire par instance
//     laissent passer dix fois plus de requêtes que la limite annoncée) ;
//   • un cache pour les données identiques entre tous les utilisateurs.
//
// DÉGRADATION
// ----------
// Si Redis est injoignable, on bascule automatiquement sur le bus
// PostgreSQL. Une coupure de Redis ne doit pas rendre l'application
// inutilisable : elle reste dégradée, mais elle reste debout.
//
// PILOTAGE
// --------
//   REALTIME_DRIVER=redis     → Redis Pub/Sub (production, multi-instance)
//   REALTIME_DRIVER=postgres  → PostgreSQL LISTEN/NOTIFY (mono-instance)
//   REALTIME_DRIVER=auto      → Redis si REDIS_URL est défini, sinon PostgreSQL
//
// `auto` est le défaut : la même image fonctionne en local sans Redis et en
// production avec.
// ─────────────────────────────────────────────────────────────────────────

const pg = require('pg');

// ─────────────────────────────────────────────────────────────────────────
// BACKEND POSTGRESQL (secours + mode mono-instance)
// ─────────────────────────────────────────────────────────────────────────

const CHANNEL = process.env.REALTIME_CHANNEL || 'unamusc_presence';

let listenerClient = null;
let reconnectDelay = 1000;
let isShuttingDown = false;
const listeners = new Set();

const scheduleReconnect = () => {
  if (isShuttingDown) return;
  const delay = Math.min(reconnectDelay, 30000);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  setTimeout(connectListener, delay).unref?.();
};

const dispatch = (event) => {
  for (const fn of listeners) {
    try { fn(event); } catch (err) {
      console.warn('[Realtime] Abonné en erreur:', err.message);
    }
  }
};

const connectListener = async () => {
  if (isShuttingDown || listenerClient) return;
  const client = new pg.Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    keepAlive: true
  });
  client.on('error', (err) => {
    console.warn('[Realtime:pg] Connexion écoute perdue:', err.message);
    listenerClient = null;
    scheduleReconnect();
  });
  client.on('end', () => { listenerClient = null; scheduleReconnect(); });
  client.on('notification', (msg) => {
    if (!msg.payload) return;
    try { dispatch(JSON.parse(msg.payload)); } catch (err) {
      console.warn('[Realtime:pg] Payload illisible:', err.message);
    }
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listenerClient = client;
    reconnectDelay = 1000;
    console.log(`[Realtime:pg] Écoute active sur le canal « ${CHANNEL} »`);
  } catch (err) {
    console.warn('[Realtime:pg] Connexion écoute impossible:', err.message);
    client.end().catch(() => {});
    scheduleReconnect();
  }
};

const pgPublish = async (event) => {
  const { pool } = require('./db');
  try {
    await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(event)]);
  } catch (err) {
    console.warn('[Realtime:pg] Publication impossible:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────
// BACKEND REDIS (production)
// ─────────────────────────────────────────────────────────────────────────

let Redis = null;
let subscriber = null;
let publisher = null;
let redisHealthy = false;

// Canal de signalisation distinct de celui de la présence : les volumes
// sont très différents et les messages n'ont pas la même durée de vie. Un
// canal unique obligerait chaque instance à décoder des SDP qu'elle ne
// relayera pas.
const PRESENCE_CHANNEL = process.env.REALTIME_PRESENCE_CHANNEL || 'unamusc:presence';
const SIGNAL_CHANNEL = process.env.REALTIME_SIGNAL_CHANNEL || 'unamusc:signal';

const loadRedis = () => {
  if (Redis) return Redis;
  try {
    Redis = require('ioredis');
  } catch (err) {
    console.warn('[Realtime:redis] ioredis absent, repli PostgreSQL.');
    return null;
  }
  return Redis;
};

/**
 * Options communes.
 *
 * `maxRetriesPerRequest: null` est exigé par ioredis sur une connexion
 * d'abonnement : sans ce réglage, la connexion est prête à abandonner dès
 * qu'une commande échoue, ce qui casse la résilience.
 */
const redisOptions = () => ({
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy: (times) => {
    // Plafonné à 10 s : au-delà, on attend trop longtemps la reconnexion
    // après une coupure.
    const delay = Math.min(times * 500, 10000);
    console.warn(`[Realtime:redis] Reconnexion dans ${delay} ms (tentative ${times})`);
    return delay;
  }
});

const redisUrl = () => process.env.REDIS_URL || 'redis://localhost:6379';

// Délai d'attente de la PREMIÈRE connexion. Court : on veut basculer
// rapidement sur le repli plutôt que faire attendre le démarrage de
// l'instance. La valeur par défaut (5 s) laisse le temps à un Redis lent
// de démarrer en parallèle, sans faire perdre plus d'une seconde à une
// consultation en cas d'indisponibilité franche.
const REDIS_CONNECT_TIMEOUT_MS = parseInt(
  process.env.REDIS_CONNECT_TIMEOUT_MS || '5000', 10
);

const subscribeRedis = async () => {
  if (!subscriber) return;
  await subscriber.subscribe(PRESENCE_CHANNEL, SIGNAL_CHANNEL);
};

/** Branche la réception : chaque message est dispatché vers les abonnés. */
const wireSubscriber = () => {
  if (!subscriber) return;
  subscriber.on('message', (channel, payload) => {
    if (channel !== PRESENCE_CHANNEL && channel !== SIGNAL_CHANNEL) return;
    if (!payload) return;
    let event;
    try {
      event = JSON.parse(payload);
    } catch (err) {
      console.warn('[Realtime:redis] Payload illisible:', err.message);
      return;
    }
    dispatch(event);
  });
};

const initRedis = async () => {
  const Lib = loadRedis();
  if (!Lib) return false;

  publisher = new Lib(redisUrl(), redisOptions());
  subscriber = new Lib(redisUrl(), redisOptions());

  publisher.on('error', (err) => {
    redisHealthy = false;
    console.warn('[Realtime:redis] Éditeur en erreur:', err.message);
  });
  publisher.on('ready', () => { redisHealthy = true; });
  publisher.on('end', () => { redisHealthy = false; });

  subscriber.on('error', (err) => {
    redisHealthy = false;
    console.warn('[Realtime:redis] Abonné en erreur:', err.message);
  });
  subscriber.on('ready', () => {
    redisHealthy = true;
    console.log('[Realtime:redis] Bus Redis actif.');
    // On (re)pose les abonnements : un abonnement perdu après reconnexion
    // silence toute la signalisation sans la moindre erreur visible.
    subscribeRedis().catch((err) =>
      console.warn('[Realtime:redis] Abonnement impossible:', err.message));
  });
  subscriber.on('end', () => { redisHealthy = false; });

  wireSubscriber();

  // ── Échec rapide ─────────────────────────────────────────────────────────
  // On attend la PREMIÈRE connexion avec un délai court. Sans cela,
  // `initRedis()` resterait suspendue sur une URL injoignable pendant toute
  // la durée de la politique de reconnexion (jusqu'à 10 s par tentative),
  // et le démarrage serait retardé à chaque tour.
  //
  // Ce que cela évite aussi : une fois `initRealtime` résolu en repli
  // PostgreSQL, les clients ioredis continuaient de tenter de se
  // reconnecter en arrière-plan, ce qui remplissait les journaux d'erreurs
  // alors que l'application fonctionnait normalement. À l'échelle, ce
  // journal saturé masque les vrais incidents.
  await Promise.race([
    waitForRedisReady(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('délai de connexion dépassé')), REDIS_CONNECT_TIMEOUT_MS)
        .unref?.())
  ]);

  return true;
};

/** Résolue dès que l'abonné est prêt, rejetée à la première erreur. */
const waitForRedisReady = () => new Promise((resolve, reject) => {
  if (!subscriber) { reject(new Error('abonné absent')); return; }
  if (subscriber.status === 'ready') { resolve(); return; }
  const onReady = () => { cleanup(); resolve(); };
  const onError = () => {
    cleanup();
    reject(new Error('connexion Redis refusée'));
  };
  const cleanup = () => {
    subscriber.off('ready', onReady);
    subscriber.off('error', onError);
  };
  subscriber.once('ready', onReady);
  subscriber.once('error', onError);
});

const redisPublish = async (event) => {
  if (!publisher) return false;
  // Le canal dépend du type : la signalisation ne doit pas réveiller les
  // abonnés à la présence, qui se contentent de refléter un état.
  const channel = event && event.type === 'telemed-signal' ? SIGNAL_CHANNEL : PRESENCE_CHANNEL;
  try {
    await publisher.publish(channel, JSON.stringify(event));
    return true;
  } catch (err) {
    redisHealthy = false;
    console.warn('[Realtime:redis] Publication impossible:', err.message);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// API PUBLIQUE
//
// L'interface reste identique à celle utilisée ailleurs
// (telemedWs.js, extendedRoutes.js). Seul le moteur change, et aucun
// appelant n'a à le savoir : c'est ce qui permet de passer de PostgreSQL à
// Redis sans toucher à la logique métier.
// ─────────────────────────────────────────────────────────────────────────

/** Pilote actif, connu au démarrage et susceptible de basculer en secours. */
let driver = 'postgres';

const resolveDriver = () => {
  const requested = String(process.env.REALTIME_DRIVER || 'auto').toLowerCase();
  if (requested === 'postgres') return 'postgres';
  if (requested === 'redis') return 'redis';
  // `auto` : Redis si une URL est fournie, PostgreSQL sinon. Permet à la
  // même image de tourner en local sans Redis et en production avec.
  return process.env.REDIS_URL ? 'redis' : 'postgres';
};

/**
 * Publie un événement sur le bus partagé.
 *
 * En cas d'échec Redis, on bascule sur PostgreSQL plutôt que de perdre
 * l'événement : la cohérence entre instances reste assurée.
 */
const publishRealtime = async (event) => {
  if (driver === 'redis') {
    const ok = await redisPublish(event);
    if (ok) return;
    console.warn('[Realtime] Bascule en secours PostgreSQL (publication).');
    driver = 'postgres';
    if (!listenerClient) connectListener();
    return pgPublish(event);
  }
  return pgPublish(event);
};

/** Abonne un handler. Retourne la fonction de désabonnement. */
const subscribeRealtime = (handler) => {
  listeners.add(handler);
  return () => listeners.delete(handler);
};

/**
 * Démarre le bus.
 *
 * En mode Redis, un échec de connexion n'est pas fatal : on bascule sur
 * PostgreSQL. Une application qui démarre malgré un Redis indisponible
 * vaut mieux qu'une application qui ne démarre pas — surtout au premier
 * lancement, quand l'ordre de démarrage des conteneurs n'est pas garanti.
 */
const initRealtime = async () => {
  driver = resolveDriver();

  if (driver === 'redis') {
    try {
      await initRedis();
      console.log('[Realtime] Bus temps réel : REDIS');
      return 'redis';
    } catch (err) {
      console.warn('[Realtime] Redis injoignable, repli PostgreSQL :', err.message);
      driver = 'postgres';
    }
  }

  // Le canal PostgreSQL n'est ouvert que si on l'utilise réellement : sinon
  // chaque instance consomme inutilement un slot de connexion, la ressource
  // la plus rare sur PostgreSQL.
  connectListener();
  console.log(`[Realtime] Bus temps réel : POSTGRESQL (canal « ${CHANNEL} »)`);
  return 'postgres';
};

const closeRealtime = async () => {
  isShuttingDown = true;
  listeners.clear();

  // L'ordre compte : on coupe l'abonné et l'éditeur AVEC la connexion
  // PostgreSQL, sinon une reconnexion programmée survivrait à l'arrêt et
  // rouvrirait une connexion sur une instance déjà arrêtée.
  if (subscriber) {
    const s = subscriber; subscriber = null;
    try { await s.quit(); } catch (e) { s.disconnect(); }
  }
  if (publisher) {
    const p = publisher; publisher = null;
    try { await p.quit(); } catch (e) { p.disconnect(); }
  }
  if (listenerClient) {
    const c = listenerClient;
    listenerClient = null;
    await c.end().catch(() => {});
  }
};

/** Diagnostic : exposé par /health/ready pour savoir quel bus répond. */
const realtimeStatus = () => ({
  driver,
  redis_healthy: redisHealthy,
  subscribers: listeners.size,
  presence_channel: PRESENCE_CHANNEL,
  signal_channel: SIGNAL_CHANNEL,
  pg_channel: CHANNEL
});

module.exports = {
  publishRealtime,
  subscribeRealtime,
  initRealtime,
  closeRealtime,
  realtimeStatus,
  getRealtimeDriver: () => driver,
  // Conservé pour compatibilité : le canal PostgreSQL historique.
  REALTIME_CHANNEL: CHANNEL
};