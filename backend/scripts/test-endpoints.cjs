async function testChatbotAndTts() {
  console.log('--- TEST CHATBOT (FRENCH) ---');
  try {
    const r1 = await fetch('http://127.0.0.1:5000/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Bonjour Zahara, comment faire pour adhérer à la mutuelle ?" })
    });
    const d1 = await r1.json();
    console.log('Chatbot FR status:', r1.status);
    console.log('Chatbot FR reply:', d1.response);
  } catch (e) {
    console.error('FR error:', e.message, e.cause);
  }

  console.log('\n--- TEST CHATBOT (WOLOF) ---');
  try {
    const r2 = await fetch('http://127.0.0.1:5000/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: "Nanga def Zahara, ñaata la cotisation bi ?", lang: "wo" })
    });
    const d2 = await r2.json();
    console.log('Chatbot WO status:', r2.status);
    console.log('Chatbot WO reply:', d2.response);
  } catch (e) {
    console.error('WO error:', e.message, e.cause);
  }

  console.log('\n--- TEST TTS (PIPER VOCAL) ---');
  try {
    const r3 = await fetch('http://127.0.0.1:5000/api/tts?text=Bonjour%20et%20bienvenue%20sur%20Mutualis%20Dakar');
    console.log('TTS status:', r3.status);
    console.log('TTS content-type:', r3.headers.get('content-type'));
    const ab = await r3.arrayBuffer();
    console.log('TTS audio size in bytes:', ab.byteLength);
  } catch (e) {
    console.error('TTS error:', e.message, e.cause);
  }
}

testChatbotAndTts();
