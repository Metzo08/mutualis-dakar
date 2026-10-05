// Test de bout en bout de la signalisation téléconsultation.
// Deux clients simulent deux POSTES DIFFÉRENTS (le scénario qui
// échouait auparavant) et vérifient que les offres, réponses et
// candidats ICE traversent bien le serveur.
const http = require('http');
const jwt = require('jsonwebtoken');
const { WebSocket } = require('ws');
const { initRealtime, closeRealtime } = require('./db');
const telemedWs = require('./telemedWs');

const PORT = 5099;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';
const INSTANCE_ID = process.env.INSTANCE_ID || 'test';

process.env.INSTANCE_ID = INSTANCE_ID;

const ROOM = 'cmu:DKR_TEST_001';
const results = [];

const waitOpen = (ws) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Délai d\'ouverture dépassé')), 8000);
  ws.on('open', () => { clearTimeout(t); resolve(); });
  ws.on('error', (e) => { clearTimeout(t); reject(e); });
});

const collect = (ws, type) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`Message « ${type} » non reçu`)), 8000);
  const handler = (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (m.type === type) { clearTimeout(t); ws.off('message', handler); resolve(m); }
  };
  ws.on('message', handler);
});

(async () => {
  const app = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
    res.writeHead(404); res.end();
  });
  const server = app.listen(PORT, '127.0.0.1');
  telemedWs.attachToServer(server);
  initRealtime();
  await new Promise((r) => setTimeout(r, 1200));

  const token = jwt.sign({ id: 1, role: 'agent', username: 'dr@test.sn' }, JWT_SECRET, { expiresIn: '10m' });
  const url = (role) => `ws://127.0.0.1:${PORT}/ws/telemed?token=${encodeURIComponent(token)}`;

  // ── Poste 1 : praticien
  const doc = new WebSocket(url());
  // Le serveur envoie « ready » dès l'ouverture : l'écouteur doit être
  // posé AVANT l'attente d'ouverture, sinon le message arrive avant
  // d'être écouté et le test échoue à tort.
  const docReadyP = collect(doc, 'ready');
  await waitOpen(doc);
  const docReady = await docReadyP;
  results.push(['serveur envoie ready au praticien', !!docReady]);

  doc.send(JSON.stringify({ type: 'join', room: ROOM, role: 'doctor', name: 'Dr. Test' }));
  const docJoined = await collect(doc, 'joined');
  results.push(['praticien rejoint la salle', docJoined.room === ROOM]);

  // ── Poste 2 : assuré (navigateur distinct, donc l'ancien BroadcastChannel échouait ici)
  const pat = new WebSocket(url());
  await waitOpen(pat);
  pat.send(JSON.stringify({ type: 'join', room: ROOM, role: 'patient', name: 'Assure Test' }));
  await collect(pat, 'joined');

  // L'écouteur du praticien est posé AVANT que l'assuré ne rejoigne :
  // la notification part à cet instant-là, la rater rendrait le test
  // invalide.
  const joinedNotice = await collect(doc, 'peer-joined');
  results.push(['le praticien est prévenu de l\'arrivée de l\'assuré', joinedNotice.participant?.role === 'patient']);

  // ── Offre, réponse, candidat ICE : le cœur de WebRTC
  // Les promesses d'attente sont posées AVANT l'envoi : la réponse peut
  // arriver dans la même boucle d'événements que l'émission.
  const offerP = collect(pat, 'desc');
  doc.send(JSON.stringify({ type: 'desc', description: { type: 'offer', sdp: 'FAKE-SDP-DOCTOR' } }));
  const offer = await offerP;
  results.push(['offre du praticien reçue par l\'assuré', offer.description?.sdp === 'FAKE-SDP-DOCTOR']);

  const answerP = collect(doc, 'desc');
  pat.send(JSON.stringify({ type: 'desc', description: { type: 'answer', sdp: 'FAKE-SDP-PATIENT' } }));
  const answer = await answerP;
  results.push(['réponse de l\'assuré reçue par le praticien', answer.description?.sdp === 'FAKE-SDP-PATIENT']);

  const iceP = collect(doc, 'ice');
  pat.send(JSON.stringify({ type: 'ice', candidate: { candidate: 'FAKE-ICE-1' } }));
  const ice = await iceP;
  results.push(['candidat ICE transmis', ice.candidate?.candidate === 'FAKE-ICE-1']);

  // ── Non-réception hors salle (isolation)
  const other = new WebSocket(url());
  await waitOpen(other);
  const otherJoinedP = collect(other, 'joined');
  other.send(JSON.stringify({ type: 'join', room: 'cmu:autre_salle', role: 'patient' }));
  await otherJoinedP;
  doc.send(JSON.stringify({ type: 'desc', description: { type: 'offer', sdp: 'NE-DOIT-PAS-ARRIVER' } }));
  let leaked = false;
  const leakCheck = setTimeout(() => {}, 2500);
  other.on('message', (raw) => {
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (m.type === 'desc') leaked = true;
  });
  await new Promise((r) => setTimeout(r, 1800));
  clearTimeout(leakCheck);
  results.push(['aucune fuite entre consultations distinctes', !leaked]);

  // ── Départ notifié
  // C'est le pair RESTANT qui reçoit l'information : l'écouteur se pose
  // donc sur le praticien, avant la fermeture de la socket de l'assuré.
  const leftNotice = collect(doc, 'peer-left');
  pat.close();
  const left = await leftNotice;
  results.push(['départ de l\'assuré notifié au praticien', !!left]);

  // ── Jeton absent refusé
  const noAuth = new WebSocket(`ws://127.0.0.1:${PORT}/ws/telemed`);
  const rejected = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 4000);
    noAuth.on('error', () => { clearTimeout(t); resolve(true); });
    noAuth.on('open', () => { clearTimeout(t); resolve(false); });
  });
  results.push(['connexion sans jeton refusée', rejected]);

  // ── Bilan
  console.log('\n=== SIGNALISATION TÉLÉCONSULTATION — TEST DE BOUT EN BOUT ===');
  let ok = 0;
  for (const [label, pass] of results) {
    console.log(`${pass ? 'OK  ' : 'ECHEC'}  ${label}`);
    if (pass) ok++;
  }
  console.log(`\n${ok}/${results.length} tests réussis`);
  console.log(ok === results.length ? 'RESULTAT: OK' : 'RESULTAT: ECHEC');

  try { doc.close(); other.close(); } catch (e) { /* ignoré */ }
  telemedWs.closeAll();
  server.close();
  await closeRealtime();
  process.exit(ok === results.length ? 0 : 1);
})().catch((err) => {
  console.log('ERREUR FATALE: ' + err.message);
  process.exit(1);
});