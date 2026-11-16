const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/piperServer.js';
let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
lines.splice(247, 7,
  'server.listen(PORT, "0.0.0.0", () => {',
  '  waitForEngine(90);',
  '  console.log("🎙️  Serveur Piper TTS démarré sur http://127.0.0.1:" + PORT);',
  '  console.log("    Moteur persistant : port " + PIPER_HTTP_PORT + " (modèle en RAM)");',
  '  console.log("    Endpoint : POST http://127.0.0.1:" + PORT + "/api/tts");',
  '});'
);
fs.writeFileSync(p, lines.join('\n'), 'utf8');
console.log('Successfully repaired piperServer.js');
