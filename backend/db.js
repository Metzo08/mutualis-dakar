const { Pool, Client } = require('pg');
require('dotenv').config();

const poolConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'MUTUALIS DAKAR',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
};

// ─────────────────────────────────────────────
// Dimensionnement du pool pour déploiement MULTI-INSTANCE
//
// PostgreSQL plafonne le nombre total de connexions par instance serveur.
// Le risque classique en multi-instance : N instances × pool par défaut
// (10) = saturation de `max_connections`, et toutes les requêtes
// échouent en même temps — une panne totale provoquée par une montée en
// charge réussie.
//
// La règle : `DB_POOL_MAX × nombre d'instances < max_connections`, en
// réservant de la marge pour l'administration et les outils.
// Ces valeurs sont pilotées par l'environnement, jamais codées en dur,
// pour qu'un déploiement puisse les ajuster sans redéployer le code.
// ─────────────────────────────────────────────
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10', 10);
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2', 10);

poolConfig.max = POOL_MAX;
poolConfig.min = POOL_MIN;
poolConfig.idleTimeoutMillis = parseInt(process.env.DB_POOL_IDLE_MS || '30000', 10);
poolConfig.connectionTimeoutMillis = parseInt(process.env.DB_POOL_CONNECT_TIMEOUT_MS || '10000', 10);
poolConfig.allowExitOnIdle = false;

const pool = new Pool(poolConfig);

pool.on('error', (err, client) => {
  console.error('Erreur inattendue sur le client PostgreSQL idle', err);
});

// ─────────────────────────────────────────────
// CANAL TEMPS RÉEL MULTI-INSTANCE
//
// Problème résolu : avec un simple `setInterval` de lecture HTTP, chaque
// instance sert l'état qu'elle a en cache. Un praticien connecté sur
// l'instance B est invisible pour un assuré sur l'instance A — chaque
// balayage tombe sur une instance différente au fur et à mesure du
// round-robin du répartiteur de charge.
//
// Solution : PostgreSQL LISTEN/NOTIFY. La notification voyage dans le
// serveur PostgreSQL, donc elle atteint TOUTES les instances, y compris
// celles ajoutées après l'envoi. Aucun service tiers (Redis, broker) à
// maintenir. La source de vérité reste la base, déjà partagée.
//
// `Client` dédié et non `pool.connect()` : une connexion LISTEN reste
// occupée indéfiniment et ne doit jamais revenir au pool.
// ─────────────────────────────────────────────

const CHANNEL = process.env.REALTIME_CHANNEL || 'unamusc_presence';
let listenerClient = null;
let reconnectDelay = 1000;
let isShuttingDown = false;
const listeners = new Set();

/** Publie un événement temps réel. Échec silencieux : la base reste la vérité. */
const publish = async (event) => {
  try {
    await pool.query('SELECT pg_notify($1, $2)', [CHANNEL, JSON.stringify(event)]);
    return true;
  } catch (err) {
    console.warn('[Realtime] Publication impossible:', err.message);
    return false;
  }
};

/** Abonne un callback. Retourne la fonction de désabonnement. */
const subscribe = (handler) => {
  listeners.add(handler);
  return () => listeners.delete(handler);
};

const dispatch = (payload) => {
  for (const handler of listeners) {
    try {
      handler(payload);
    } catch (err) {
      console.error('[Realtime] Abonné en erreur:', err.message);
    }
  }
};

const connectListener = async () => {
  if (isShuttingDown || listenerClient) return;

  const client = new Client(poolConfig);
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);

    client.on('notification', (msg) => {
      if (!msg.payload) return;
      try {
        dispatch(JSON.parse(msg.payload));
      } catch (err) {
        console.warn('[Realtime] Payload illisible:', err.message);
      }
    });

    // Perte de connexion : PostgreSQL ou le réseau a été coupé. On se
    // reconnecte en exponentiel borné, sinon une reconnexion ratée en
    // boucle sature les journaux d'une instance déjà dégradée.
    client.on('error', (err) => {
      console.warn('[Realtime] Connexion écoute perdue:', err.message);
      listenerClient = null;
      scheduleReconnect();
    });
    client.on('end', () => {
      listenerClient = null;
      scheduleReconnect();
    });

    listenerClient = client;
    reconnectDelay = 1000;
    console.log(`[Realtime] Écoute active sur le canal « ${CHANNEL} »`);
  } catch (err) {
    console.warn('[Realtime] Connexion écoute impossible:', err.message);
    client.end().catch(() => {});
    scheduleReconnect();
  }
};

const scheduleReconnect = () => {
  if (isShuttingDown) return;
  const delay = Math.min(reconnectDelay, 30000);
  reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  setTimeout(connectListener, delay).unref?.();
};

const initRealtime = () => {
  connectListener();
};

const closeRealtime = async () => {
  isShuttingDown = true;
  listeners.clear();
  if (listenerClient) {
    const c = listenerClient;
    listenerClient = null;
    await c.end().catch(() => {});
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  // Bus temps réel partagé entre instances
  publishRealtime: publish,
  subscribeRealtime: subscribe,
  initRealtime,
  closeRealtime,
  REALTIME_CHANNEL: CHANNEL
};
