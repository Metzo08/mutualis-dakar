async function testOolelWorkflow(text) {
  console.log(`[Test] Synthèse Wolof pour : "${text}"`);
  const t0 = Date.now();
  const oolelCall = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [text.substring(0, 450), null, 0.3, 0.2, 0, 0.5]
    }),
    signal: AbortSignal.timeout(12000)
  });

  if (!oolelCall.ok) throw new Error('Oolel call HTTP ' + oolelCall.status);
  const callData = await oolelCall.json();
  console.log('[Test] Event ID reçu:', callData.event_id, `en ${Date.now() - t0} ms`);

  const streamRes = await fetch(`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/${callData.event_id}`, {
    signal: AbortSignal.timeout(12000)
  });
  const streamText = await streamRes.text();
  const match = streamText.match(/"url":\s*"([^"]+)"/);
  if (!match || !match[1]) throw new Error('URL audio introuvable dans le flux SSE: ' + streamText);

  console.log('[Test] Audio URL extraite:', match[1]);
  const wavRes = await fetch(match[1]);
  const buf = await wavRes.arrayBuffer();
  console.log(`[Test] Audio WAV natif Wolof téléchargé avec succès : ${buf.byteLength} octets en ${Date.now() - t0} ms !`);
}

testOolelWorkflow("Nanga def ! Man la Zahara, assistante bu Mutualis Dakar. Cotisation bi mooy 4500 FCFA.")
  .catch(e => console.error('Erreur:', e.message));
