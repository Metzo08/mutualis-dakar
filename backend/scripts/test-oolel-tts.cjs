async function testOolelTts() {
  const text = "Dalal ak jamm ci Mutualis Dakar. Man la Zahara.";
  console.log('Sending Wolof text to Oolel-Voices:', text);

  // Gradio client call endpoint
  const res = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        text,
        null, // default audio prompt
        0.3,  // exaggeration
        0.2,  // temperature
        0,    // seed
        0.5   // cfgw
      ]
    })
  });

  console.log('Call status:', res.status);
  const data = await res.json();
  console.log('Event id:', data.event_id);

  if (data.event_id) {
    const streamRes = await fetch(`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/${data.event_id}`);
    const streamText = await streamRes.text();
    console.log('Stream result:', streamText);
  }
}

testOolelTts().catch(e => console.error(e));
