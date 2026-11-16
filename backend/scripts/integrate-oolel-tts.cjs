const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

const target = `    if (effectiveProvider === 'opensource') {
      // Serveur vocal neural Piper local (backend/piperServer.js — voix humaine`;

const replacement = `    if (effectiveProvider === 'opensource') {
      // ── OOLEL-VOICES (SOYNADE RESEARCH) : VOIX WOLOF AUTHENTIQUE NATIVE ──
      // Dès que la langue est Wolof, on fait appel au moteur Oolel-Voices
      // (voix humaine sénégalaise authentique) pour éviter la prononciation francisée.
      if (lang === 'wo' || lang === 'wolof') {
        try {
          console.log(\`[Oolel-Voices TTS] Synthèse Wolof authentique pour: "\${text.substring(0, 40)}..."\`);
          const oolelCall = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: [text.substring(0, 450), null, 0.3, 0.2, 0, 0.5]
            }),
            signal: AbortSignal.timeout(12000)
          });
          if (oolelCall.ok) {
            const callData = await oolelCall.json();
            if (callData.event_id) {
              const streamRes = await fetch(\`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/\${callData.event_id}\`, {
                signal: AbortSignal.timeout(12000)
              });
              const streamText = await streamRes.text();
              const match = streamText.match(/"url":\\s*"([^"]+)"/);
              if (match && match[1]) {
                const wavRes = await fetch(match[1], { signal: AbortSignal.timeout(8000) });
                if (wavRes.ok) {
                  const wavBuffer = await wavRes.arrayBuffer();
                  console.log(\`[Oolel-Voices TTS] Succès audio Wolof natif (\${wavBuffer.byteLength} octets)\`);
                  res.setHeader('Content-Type', 'audio/wav');
                  return res.send(Buffer.from(wavBuffer));
                }
              }
            }
          }
        } catch (oolelErr) {
          console.warn('[Oolel-Voices TTS] Repli local Piper :', oolelErr.message);
        }
      }

      // Serveur vocal neural Piper local (backend/piperServer.js — voix humaine`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully integrated Oolel-Voices into /api/tts!');
} else {
  console.error('Target not found in server.js');
}
