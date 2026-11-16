const app = require('../server');

async function testWolofCases() {
  const server = app.listen(0, async () => {
    const port = server.address().port;
    console.log('Testing on port', port);

    // Test 1 : Demande de bascule en Wolof
    const r1 = await fetch(`http://127.0.0.1:${port}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Parle en wolof s'il te plaît" })
    });
    const d1 = await r1.json();
    console.log('\n[Case 1: "Parle en wolof s\'il te plaît"]');
    console.log('Response:', d1.response);

    // Test 2 : Question directe en Wolof
    const r2 = await fetch(`http://127.0.0.1:${port}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Nanga def Zahara, ñaata la cotisation bi ?" })
    });
    const d2 = await r2.json();
    console.log('\n[Case 2: "Nanga def Zahara, ñaata la cotisation bi ?"]');
    console.log('Response:', d2.response);

    // Test 3 : "Peux-tu me répondre en wolof ?"
    const r3 = await fetch(`http://127.0.0.1:${port}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Peux-tu me répondre en wolof ?" })
    });
    const d3 = await r3.json();
    console.log('\n[Case 3: "Peux-tu me répondre en wolof ?"]');
    console.log('Response:', d3.response);

    server.close();
    process.exit(0);
  });
}

testWolofCases().catch(e => { console.error(e); process.exit(1); });
