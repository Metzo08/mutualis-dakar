const { WebSocketServer } = require('ws');
const { URL } = require('url');
const jwt = require('jsonwebtoken');
const { subscribeRealtime, publishRealtime } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';

// ─────────────────────────────────────────────
// SIGNALISATION TÉLÉMEDECINE — multi-instance
//
// Le problème résolu : la signalisation passait par un BroadcastChannel,
// qui ne fonctionne QUE entre onglets du MÊME navigateur sur le MÊME poste.
// Un médecin au poste 1 et un assuré au poste 2 ne pouvaient donc jamais
// s'entendre : chacun attendait un correspondant qui n'existait pas. Chaque
// côté retombait sur son rendu simulé, et l'écran affichait une
// téléconsultation qui n'avait jamais eu lieu.
//
// Ici les offres, réponses et candidats ICE transitent par un serveur
// WebSocket. C'est la mécanique standard de WebRTC : les données ne
// passent que par ce canal, la vidéo reste pair-à-pair.
//
// Multi-instance : une connexion WebSocket appartient à l'instance qui l'a
// acceptée. Si le médecin est sur l'instance A et l'assuré sur l'instance
// B, un relais en mémoire ne suffirait pas. On réutilise donc le bus
// PostgreSQL LISTEN/NOTIFY déjà en place : le message traverse la base et
// atteint l'instance qui détient la connexion distante. Aucune dépendance
// supplémentaire.
//
// Salles : chaque session de consultation a son identifiant. Deux
// consultations simultanées ne se mêlent donc pas, ce qu'un salon unique
// ne permettait pas.
// ─────────────────────────────────────────────

const WSS_PATH = '/ws/telemed';
const INSTANCE_ID = process.env.INSTANCE_ID || 'local';

const wss = new WebSocketServer({ noServer: true });

// roomId -> Set<WebSocket>
const rooms = new Map();

const roomOf = (ws) => ws._telemedRoom;
/** Pairs d'une socket : les AUTRES membres de sa salle, à l'exclusion d'elle-même. */
const peersOf = (ws) => {
  if (ws._telemedPeers) return ws._telemedPeers;
  const room = roomOf(ws);
  const set = room ? rooms.get(room) : null;
  if (!set) return new Set();
  // La socket qui rejoint est déjà membre de la salle : elle ne doit pas
  // se recevoir ses propres messages.
  ws._telemedPeers = new Set(set);
  ws._telemedPeers.delete(ws);
  return ws._telemedPeers;
};

/** Quitte la salle courante ; la salle disparaît quand plus personne n'y est. */
const leaveRoom = (ws) => {
  const room = roomOf(ws);
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
  ws._telemedRoom = null;
  ws._telemedPeers = null;
};

const joinRoom = (ws, room, participant) => {
  leaveRoom(ws);
  ws._telemedRoom = room;
  // `_telemedPeers` reste nul : il est dérivé de la salle au premier accès.
  // Le pré-remplir avec un Set vide masquait les pairs déjà présents, et
  // aucune offre ne partait jamais.
  ws._telemedPeers = null;
  ws._telemedParticipant = participant || null;
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
};

/** Envoie un message au pair situé dans la même salle. */
const sendToPeers = (ws, payload) => {
  const peers = peersOf(ws);
  for (const peer of peers) {
    if (peer.readyState !== 1) continue;
    try {
      peer.send(JSON.stringify(payload));
    } catch (err) {
      console.warn('[TelemedWS] Envoi au pair impossible:', err.message);
    }
  }
};

/**
 * Relais d'un message de signalisation vers les pairs de la salle.
 *
 * Publication via PostgreSQL : c'est ce qui permet à un médecin sur
 * l'instance A de répondre à un assuré sur l'instance B. Le message
 * repart par le canal partagé, et l'instance qui détient la connexion du
 * pair le lui transmet.
 */
const relay = async (ws, message) => {
  const room = roomOf(ws);
  if (!room) return;

  // Livraison locale immédiate : si le pair est sur la même instance, on
  // n'attend pas l'aller-retour par la base.
  sendToPeers(ws, message);

  try {
    await publishRealtime({
      type: 'telemed-signal',
      room,
      exclude_instance: INSTANCE_ID,
      message
    });
  } catch (err) {
    console.warn('[TelemedWS] Relais inter-instances impossible:', err.message);
  }
};

// ─────────────────────────────────────────────
// Réception des messages venus des AUTRES instances.
//
// Chaque instance s'abonne au bus et relaie vers ses propres connexions.
// Le garde sur l'instance expéditrice évite le doublon : l'émetteur a
// déjà servi son message en local, donc se le renvoyer le ferait
// recevoir deux fois — et une offre WebRTC dupliquée fait échouer la
// négociation.
// ─────────────────────────────────────────────
let unsubscribeSignal = null;

const startRealtimeRelay = () => {
  unsubscribeSignal = subscribeRealtime((event) => {
    if (!event || event.type !== 'telemed-signal') return;
    const { room, exclude_instance: sender, message } = event;
    if (sender === INSTANCE_ID) return;
    const set = rooms.get(room);
    if (!set) return;
    for (const peer of set) {
      if (peer.readyState !== 1) continue;
      try {
        peer.send(JSON.stringify({ ...message, relayed: true }));
      } catch (err) {
        console.warn('[TelemedWS] Relais sortant impossible:', err.message);
      }
    }
  });
};

const stopRealtimeRelay = () => {
  if (unsubscribeSignal) {
    unsubscribeSignal();
    unsubscribeSignal = null;
  }
};

/** Un pair rejoint la salle : les présents en sont informés. */
const notifyPeerJoined = (ws) => {
  const me = ws._telemedParticipant || {};
  // `peersOf` exclut `ws` lui-même et met son cache à jour : un pair
  // arrivé ici doit être connu des deux côtés, sans quoi il ne recevrait
  // jamais les offres.
  for (const peer of peersOf(ws)) {
    if (peer.readyState !== 1) continue;
    if (!peer._telemedPeers) peer._telemedPeers = new Set();
    peer._telemedPeers.add(ws);
    try {
      peer.send(JSON.stringify({
        type: 'peer-joined',
        participant: { id: me.id || null, name: me.name || null, role: me.role || null }
      }));
    } catch (err) { /* pair parti entre-temps */ }
  }
};

const handleMessage = async (ws, raw) => {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (err) {
    return; // message illisible : on l'ignore sans répondre
  }
  if (!msg || typeof msg.type !== 'string') return;

  // ── Rejoindre une salle ───────────────────────────────────────────────
  if (msg.type === 'join') {
    const room = String(msg.room || '').slice(0, 100);
    if (!room) return;
    joinRoom(ws, room, {
      id: msg.participantId ? String(msg.participantId).slice(0, 100) : null,
      name: msg.name ? String(msg.name).slice(0, 150) : null,
      role: msg.role ? String(msg.role).slice(0, 30) : null
    });
    ws.send(JSON.stringify({
      type: 'joined',
      room,
      instance: INSTANCE_ID,
      peerCount: peersOf(ws).size
    }));
    notifyPeerJoined(ws);
    return;
  }

  // ── Annoncer sa présence (praticien qui rejoint en retard) ─────────────
  if (msg.type === 'hello') {
    sendToPeers(ws, { type: 'hello', from: msg.role || null });
    return;
  }

  // ── Signalisation WebRTC ──────────────────────────────────────────────
  // desc (offre/réponse) et ice (candidats) sont strictement relayés : le
  // serveur ne lit jamais le contenu, il ne fait qu'acheminer. Le SDP
  // contient des adresses IP locales que le navigateur a déjà exposées à
  // ce canal ; c'est le fonctionnement standard de WebRTC.
  if (msg.type === 'desc' || msg.type === 'ice' || msg.type === 'bye') {
    await relay(ws, { ...msg, to: msg.to || null });
  }
};

const verifyClient = (req) => {
  // Le jeton arrive en paramètre d'URL : le navigateur ne permet pas de
  // définir un en-tête sur l'ouverture d'un WebSocket.
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/** Branche le serveur WebSocket sur le serveur HTTP existant. */
const attachToServer = (server) => {
  server.on('upgrade', (req, socket, head) => {
    let pathname = '';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch (err) {
      socket.destroy();
      return;
    }
    // Autre chemin : on laisse la main. Le serveur HTTP peut gérer autre
    // chose (HMR de Vite en développement, par exemple).
    if (pathname !== WSS_PATH) return;

    const user = verifyClient(req);
    if (!user) {
      // 401 explicite plutôt qu'une fermeture muette : sans cela le
      // navigateur se reconnecte en boucle sans comprendre pourquoi.
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws._telemedUser = user;
      ws._telemedRoom = null;
      ws._telemedPeers = null;
      ws._telemedParticipant = null;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      type: 'ready',
      instance: INSTANCE_ID,
      at: new Date().toISOString()
    }));

    ws.on('message', (raw) => {
      handleMessage(ws, raw).catch((err) => {
        console.warn('[TelemedWS] Message en erreur:', err.message);
      });
    });

    ws.on('close', () => {
      // On prévient les pairs : sans cela l'autre côté reste affiché sur
      // « connexion en cours » alors que la consultation est terminée.
      const room = roomOf(ws);
      if (room) {
        const me = ws._telemedParticipant || {};
        const set = rooms.get(room);
        if (set) {
          for (const peer of set) {
            if (peer === ws || peer.readyState !== 1) continue;
            try {
              peer.send(JSON.stringify({ type: 'peer-left', id: me.id || null }));
            } catch (err) { /* ignoré */ }
          }
        }
      }
      leaveRoom(ws);
    });

    ws.on('error', (err) => {
      console.warn('[TelemedWS] Erreur socket:', err.message);
    });
  });

  startRealtimeRelay();
  console.log(`[TelemedWS] Signalisation activée sur ${WSS_PATH} (instance ${INSTANCE_ID})`);
};

const closeAll = () => {
  stopRealtimeRelay();
  for (const ws of wss.clients) {
    try { ws.close(1001, 'Arrêt du serveur'); } catch (err) { /* ignoré */ }
  }
  wss.close();
};

/** Nombre de participants par salle (diagnostic). */
const roomStats = () => {
  const out = {};
  for (const [room, set] of rooms) out[room] = set.size;
  return out;
};

module.exports = { attachToServer, closeAll, roomStats, WSS_PATH };