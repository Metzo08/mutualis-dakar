const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

const targetStr = `      // ── OOLEL-VOICES (SOYNADE RESEARCH) : VOIX WOLOF NATIVE AUTHENTIQUE ──
      if (isWolof) {
        try {
          console.log(\`[Oolel-Voices TTS] Synthèse Wolof authentique pour: "\${cleanText.substring(0, 45)}..."\`);
          const oolelCall = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: [cleanText.substring(0, 450), null, 0.3, 0.2, 0, 0.5]
            }),
            signal: AbortSignal.timeout(24000)
          });
          if (oolelCall.ok) {
            const callData = await oolelCall.json();
            if (callData.event_id) {
              const streamRes = await fetch(\`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/\${callData.event_id}\`, {
                signal: AbortSignal.timeout(24000)
              });
              const streamText = await streamRes.text();
              const match = streamText.match(/"url":\\s*"([^"]+)"/);
              if (match && match[1]) {
                const wavRes = await fetch(match[1], { signal: AbortSignal.timeout(12000) });
                if (wavRes.ok) {
                  const wavBuffer = await wavRes.arrayBuffer();
                  const nodeBuf = Buffer.from(wavBuffer);
                  console.log(\`[Oolel-Voices TTS] Succès audio Wolof natif (\${nodeBuf.length} octets) - mis en cache\`);
                  try { fs.writeFileSync(cacheFile, nodeBuf); } catch (e) {}
                  res.setHeader('Content-Type', 'audio/wav');
                  res.setHeader('X-TTS-Cache', 'GENERATED');
                  return res.send(nodeBuf);
                }
              }
            }
          }
        } catch (oolelErr) {
          console.warn('[Oolel-Voices TTS] Repli Piper :', oolelErr.message);
        }
      }`;

const replacementStr = `      // ── OOLEL-VOICES (SOYNADE RESEARCH) : VOIX WOLOF NATIVE AUTHENTIQUE ──
      if (isWolof) {
        const hfToken = process.env.HUGGINGFACE_API_KEY || (process.env.HUGGINGFACE_API_KEY || '');
        try {
          console.log(\`[Oolel-Voices TTS] Synthèse Wolof authentique pour: "\${cleanText.substring(0, 45)}..."\`);
          const oolelCall = await fetch('https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + hfToken
            },
            body: JSON.stringify({
              data: [cleanText.substring(0, 450), null, 0.3, 0.2, 0, 0.5]
            }),
            signal: AbortSignal.timeout(30000)
          });
          if (oolelCall.ok) {
            const callData = await oolelCall.json();
            if (callData.event_id) {
              const streamRes = await fetch(\`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/\${callData.event_id}\`, {
                headers: { 'Authorization': 'Bearer ' + hfToken },
                signal: AbortSignal.timeout(30000)
              });
              const streamText = await streamRes.text();
              const match = streamText.match(/"url":\\s*"([^"]+)"/);
              if (match && match[1]) {
                const wavRes = await fetch(match[1], {
                  headers: { 'Authorization': 'Bearer ' + hfToken },
                  signal: AbortSignal.timeout(15000)
                });
                if (wavRes.ok) {
                  const wavBuffer = await wavRes.arrayBuffer();
                  const nodeBuf = Buffer.from(wavBuffer);
                  console.log(\`[Oolel-Voices TTS] Succès audio Wolof natif (\${nodeBuf.length} octets) - mis en cache\`);
                  try { fs.writeFileSync(cacheFile, nodeBuf); } catch (e) {}
                  res.setHeader('Content-Type', 'audio/wav');
                  res.setHeader('X-TTS-Cache', 'GENERATED');
                  return res.send(nodeBuf);
                }
              } else {
                console.warn('[Oolel-Voices TTS] Pas d URL dans le stream:', streamText.substring(0, 150));
              }
            }
          } else {
            console.warn('[Oolel-Voices TTS] Réponse HTTP:', oolelCall.status);
          }
        } catch (oolelErr) {
          console.warn('[Oolel-Voices TTS] Erreur API :', oolelErr.message);
        }
      }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully updated Oolel-Voices authentication in server.js!');
} else {
  console.error('Target string not found in server.js');
}
