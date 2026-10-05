// ─────────────────────────────────────────────
// SIGNALISATION TÉLÉMEDECINE — client
//
// Remplace un BroadcastChannel qui ne-dialoguait qu'entre onglets du MÊME
// navigateur : un médecin au poste 1 et un assuré au poste 2 n'avaient
// aucun canal commun, donc aucune offre ne partait, aucune réponse
// n'arrivait, et les deux écrans restaient sur un flux simulé.
//
// Le serveur relaie les offres, réponses et candidats ICE entre toutes les
// instances (via PostgreSQL), donc deux postes distincts s'entendent
// réellement. La vidéo reste pair-à-pair : le serveur ne voit jamais les
// images ni le son.
//
// Reconnexion : une coupure réseau ou un redémarrage d'instance ne doit
// pas clore la consultation. La reconnexion est automatique avec un délai
// croissant, et l'information circule dans les deux sens — on prévient
// l'utilisateur si le canal est rompu, plutôt que d'afficher un écran figé
// qui laisserait croire à une consultation en cours.
// ─────────────────────────────────────────────

const WS_PATH = '/ws/telemed';
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/**
 * Ouvre une connexion de signalisation sur une salle de consultation.
 *
 * @param {object} options
 * @param {string} options.room        Identifiant de la consultation.
 * @param {string} options.role        'doctor' | 'patient'.
 * @param {string} [options.participantId]
 * @param {string} [options.name]
 * @param {(msg: object) => void} options.onMessage   Message reçu du pair.
 * @param {(status: object) => void} [options.onStatus] Changement d'état du canal.
 * @returns {() => void} fermeture et déconnexion.
 */
export function openSignaling({ room, role, participantId, name, onMessage, onStatus }) {
  const token = (typeof window !== 'undefined' && localStorage.getItem('cmu-token')) || '';

  let ws = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer = null;
  let heartbeat = null;

  const emit = (status) => {
    try { onStatus?.(status); } catch (e) { /* l'appelant peut ne rien faire */ }
  };

  const clearTimers = () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  };
const connect = () => {
    if (closed) return;
    if (!token) {
      // Sans jeton, aucune connexion authentifiée n'est possible. On le
      // dit explicitement : l'interface affichera « non authentifié »
      // plutôt qu'un écran de consultation bloqué sans explication.
      emit({ state: 'unauthenticated' });
      return;
    }

    // En développement, le Vite tourne sur un autre port que l'API : on
    // déduit l'hôte de la requête plutôt que de coder une URL en dur.
    const apiBase = (typeof window !== 'undefined' && window.API_BASE_URL) || '';
    let wsUrl;
    try {
      const base = new URL(apiBase || window.location.origin, window.location.href);
      wsUrl = `${base.protocol === 'https:' ? 'wss:' : 'ws:'}//${base.host}${WS_PATH}`;
    } catch (e) {
      wsUrl = `${window.location.origin.replace(/^http/, 'ws')}${WS_PATH}`;
    }

    emit({ state: attempt === 0 ? 'connecting' : 'reconnecting', attempt });

    try {
      ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      attempt = 0;
      emit({ state: 'open', instance: null });
      // Annonce notre arrivée : le praticien déjà dans la salle déclenche
      // alors son offre. Sans cela, qui arrive en second attend
      // indéfiniment que l'autre parle.
      try {
        ws.send(JSON.stringify({ type: 'join', room, role, participantId: participantId || null, name: name || null }));
      } catch (e) { /* socket refermée entre-temps */ }

      // Battement d'application : détecte une connexion silencieusement
      // morte (réseau coupé sans fermeture de socket) et garde ouverts
      // les proxys qui ferment les connexions inactives.
      heartbeat = setInterval(() => {
        if (ws && ws.readyState === 1) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { /* ignoré */ }
        }
      }, 25000);
    };

    ws.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      if (!msg) return;
      if (msg.type === 'ping') return;
      if (msg.type === 'ready') {
        emit({ state: 'open', instance: msg.instance || null });
        return;
      }
      try { onMessage?.(msg); } catch (e) { /* message invalide : on l'ignore */ }
    };

    ws.onerror = () => {
      // `onclose` suit toujours `onerror` : la reconnexion est gérée là.
      emit({ state: 'error' });
    };

    ws.onclose = () => {
      clearTimers();
      if (closed) return;
      // 1001 = arrêt volontaire du serveur. On tente quand même de
      // revenir : en blue-green, l'instance va être remplacée et la
      // session doit survivre au changement.
      emit({ state: 'closed' });
      scheduleReconnect();
    };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    // Délai croissant borné : évite de marteler un serveur qui redémarre,
    // sans laisser l'utilisateur bloqué trop longtemps si la coupure est
    // brève.
    const delay = Math.min(RECONNECT_MIN_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    attempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  connect();

  return () => {
    closed = true;
    clearTimers();
    if (ws) {
      // On prévient le pair pour qu'il ne reste pas sur « connexion en
      // cours » : sans ce message, l'autre écran reste figé.
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'bye' }));
        }
      } catch (e) { /* socket déjà fermée */ }
      try { ws.close(1000, 'Fin de consultation'); } catch (e) { /* ignoré */ }
      ws = null;
    }
  };
}

export { WS_PATH };