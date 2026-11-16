const hfToken = (process.env.HUGGINGFACE_API_KEY || '');
async function test() {
  const sentence = 'Léegi 19h20 jot na ci Ndakaaru. Ngoon ak jàmm ! Lan laa la mënee dimbali tey ?';
  console.log('Testing Oolel-Voices for:', sentence);
  const t0 = Date.now();
  const call = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + hfToken
    },
    body: JSON.stringify({
      data: [sentence, null, 0.3, 0.2, 0, 0.5]
    })
  });
  console.log('Call status:', call.status);
  const data = await call.json();
  const stream = await fetch(`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/${data.event_id}`, {
    headers: { 'Authorization': 'Bearer ' + hfToken }
  });
  const text = await stream.text();
  const match = text.match(/"url":\s*"([^"]+)"/);
  if (match) {
    const wav = await fetch(match[1], { headers: { 'Authorization': 'Bearer ' + hfToken } });
    const buf = await wav.arrayBuffer();
    console.log('Audio received:', buf.byteLength, 'octets en', Date.now() - t0, 'ms');
  } else {
    console.log('Stream result:', text);
  }
}
test().catch(console.error);
