const fs = require('fs');
const defaultAudio = {
  path: '/tmp/gradio/52946abc9f0eeb0a44499fd3ea635b4aabfdff215a6914360a4f627ab00699d9/8_1_c.wav',
  url: 'https://soynade-research-oolel-voices-demo.hf.space/gradio_api/file=/tmp/gradio/52946abc9f0eeb0a44499fd3ea635b4aabfdff215a6914360a4f627ab00699d9/8_1_c.wav',
  orig_name: '8_1_c.wav',
  meta: { _type: 'gradio.FileData' }
};

async function test(text) {
  console.log('Testing with defaultAudio:', text);
  const t0 = Date.now();
  const oolelCall = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [text, defaultAudio, 0.3, 0.2, 0, 0.5] })
  });
  const callData = await oolelCall.json();
  console.log('callData:', callData);
  const streamRes = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/' + callData.event_id);
  const streamText = await streamRes.text();
  const match = streamText.match(/"url":\s*"([^"]+)"/);
  if (match) {
    console.log('SUCCESS! Audio URL:', match[1], 'in', Date.now() - t0, 'ms');
  } else {
    console.log('Error stream:', streamText.substring(0, 200));
  }
}
test('Nanga def ! Man la Zahara, assistante bu Mutualis Dakar. Cotisation bi mooy 4500 FCFA ci at mu nekk.');
