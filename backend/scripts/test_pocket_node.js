async function test() {
  const text = 'Na nga def ! Man la Zahara, assistante bu Mutualis Dakar.';
  console.log('Posting to pocket-tts API...');
  const t0 = Date.now();
  const res = await fetch('https://abdazizsall-wolof-pocket-tts-demo.hf.space/gradio_api/call/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [text, 'Voice 1 (galsenai, female)'] })
  });
  const data = await res.json();
  console.log('Event ID:', data.event_id, 'in', Date.now() - t0, 'ms');
  const streamRes = await fetch('https://abdazizsall-wolof-pocket-tts-demo.hf.space/gradio_api/call/synthesize/' + data.event_id);
  const streamText = await streamRes.text();
  console.log('Stream output (first 200 chars):', streamText.substring(0, 200));
  const match = streamText.match(/"url":\s*"([^"]+)"/);
  if (match) {
    console.log('Audio URL:', match[1]);
    const wavRes = await fetch(match[1]);
    const buf = await wavRes.arrayBuffer();
    console.log('SUCCESS! Downloaded Native Wolof audio:', buf.byteLength, 'bytes in', Date.now() - t0, 'ms!');
  } else {
    console.log('Match failed. Full stream:', streamText);
  }
}
test().catch(console.error);
