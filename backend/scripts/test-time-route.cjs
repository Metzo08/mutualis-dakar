const app = require('../server');
const http = require('http');

async function testTime() {
  const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log('Test server running on port', port);

    // 1. Demande d'heure en Français
    const res1 = await fetch(`http://127.0.0.1:${port}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Quelle heure est-il s'il vous plaît ?" })
    });
    const d1 = await res1.json();
    console.log('[FR Time Request]:', d1.response);

    // 2. Demande d'heure en Wolof
    const res2 = await fetch(`http://127.0.0.1:${port}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Zahara, waxtu bi ñaata la ?", lang: "wo" })
    });
    const d2 = await res2.json();
    console.log('[WO Time Request]:', d2.response);

    server.close();
    process.exit(0);
  });
}

testTime().catch(e => { console.error(e); process.exit(1); });
