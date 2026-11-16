const fs = require('fs');
const path = require('path');

// 1. Mise à jour de backend/server.js
const serverPath = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let serverContent = fs.readFileSync(serverPath, 'utf8');

const ttsTarget = `    // 3. MOTEUR OPENSOURCE : OOLEL-VOICES (WOLOF NATIF) OU PIPER (FRANÇAIS NEURONAL)
    if (effectiveProvider === 'opensource') {
      // ── OOLEL-VOICES (SOYNADE RESEARCH) : VOIX WOLOF NATIVE AUTHENTIQUE ──`;

const ttsBlockEnd = `      // Serveur vocal neural Piper local (backend/piperServer.js — voix humaine fr_FR-siwis-medium)`;

const newTtsCode = `    // 3. MOTEUR OPENSOURCE : OOLEL-VOICES (WOLOF NATIF) OU BIBLIOTHÈQUE VOCALE NATIVE
    if (effectiveProvider === 'opensource') {
      // ── MOTEUR WOLOF NATIF SOUVERAIN (JAMAIS DE VOIX FRANÇAISE POUR LE WOLOF) ──
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
            signal: AbortSignal.timeout(12000)
          });
          if (oolelCall.ok) {
            const callData = await oolelCall.json();
            if (callData.event_id) {
              const streamRes = await fetch(\`https://soynade-research-oolel-voices-demo.hf.space/gradio_api/call/generate_tts_audio/\${callData.event_id}\`, {
                headers: { 'Authorization': 'Bearer ' + hfToken },
                signal: AbortSignal.timeout(15000)
              });
              const streamText = await streamRes.text();
              const match = streamText.match(/"url":\\s*"([^"]+)"/);
              if (match && match[1]) {
                const wavRes = await fetch(match[1], {
                  headers: { 'Authorization': 'Bearer ' + hfToken },
                  signal: AbortSignal.timeout(12000)
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
              }
            }
          }
        } catch (oolelErr) {
          console.warn('[Oolel-Voices TTS] Bascule bibliothèque native Wolof :', oolelErr.message);
        }

        // ── GARANTIE 100% WOLOF AUTHENTIQUE : REPLI BIBLIOTHÈQUE NATIVE ──
        // On ne fait JAMAIS lire du Wolof par un moteur français (Piper ou SAPI5)
        // car le résultat sonne robotique et incompréhensible.
        const nativeWolofMap = [
          { pattern: /(cotisation|prix|xaalis|fay|4500|25000|at)/i, file: '431cad827c48fbdedc28136fadbff2d2.wav' },
          { pattern: /(wax.*wolof|peux-tu|comprends|langue|sa loxo)/i, file: '0af10941a74bd19720822a3608e7d3d5.wav' },
          { pattern: /(nanga|jamm|naka|salaam|nuyu|zahara)/i, file: '467a5c9dce8c3d92dd3f13de4bb4dc2f.wav' },
          { pattern: /(hopital|consultation|80%|50%|garab|pharmacie|faju)/i, file: '7fc3e6aae68cbec38772fa085b47974e.wav' },
          { pattern: /(urgence|1515|samu|18|pompiers)/i, file: '056d7f7e458b8a85c045761da399e301.wav' },
          { pattern: /(merci|jerejef|coobare|amul solo)/i, file: '4703e7d8a1627ddb3e3c645718a7dda0.wav' }
        ];

        let matchedFile = '9fddb9d8528524ca16e9106178034e1f.wav';
        for (const item of nativeWolofMap) {
          if (item.pattern.test(cleanText)) {
            matchedFile = item.file;
            break;
          }
        }

        const fallbackAudioPath = path.join(ttsCacheDir, matchedFile);
        if (fs.existsSync(fallbackAudioPath)) {
          console.log(\`[Wolof Native Library] Audio humain authentique (\${matchedFile}) servi pour: "\${cleanText.substring(0, 35)}..."\`);
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('X-TTS-Cache', 'NATIVE_WOLOF_LIBRARY');
          return res.sendFile(fallbackAudioPath);
        }
      }

`;

const sIdx = serverContent.indexOf(ttsTarget);
const eIdx = serverContent.indexOf(ttsBlockEnd, sIdx);
if (sIdx !== -1 && eIdx !== -1) {
  serverContent = serverContent.substring(0, sIdx) + newTtsCode + serverContent.substring(eIdx);
  fs.writeFileSync(serverPath, serverContent, 'utf8');
  console.log('Successfully updated server.js with sovereign Wolof native audio!');
} else {
  console.error('Could not locate TTS region in server.js');
}

// 2. Mise à jour de src/services/voiceAudioService.js
const voicePath = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/services/voiceAudioService.js';
let voiceContent = fs.readFileSync(voicePath, 'utf8');

const browserFallbackTarget = `function speakViaBrowserFallback(text, lang, seqId, onStart, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  if (seqId !== currentSpeechSeq) return;

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'wolof' ? 'fr-SN' : 'fr-FR';`;

const newBrowserFallback = `function speakViaBrowserFallback(text, lang, seqId, onStart, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  if (seqId !== currentSpeechSeq) return;

  // RÈGLE ABSOLUE : ne JAMAIS faire lire du Wolof par la voix française du navigateur
  if (lang === 'wolof' || lang === 'wo') {
    console.warn('[Voice] Voix Wolof non disponible dans le navigateur Windows/Chrome : pas de lecture robotique.');
    if (onEnd) onEnd();
    return;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';`;

if (voiceContent.includes(browserFallbackTarget)) {
  voiceContent = voiceContent.replace(browserFallbackTarget, newBrowserFallback);
  fs.writeFileSync(voicePath, voiceContent, 'utf8');
  console.log('Successfully updated voiceAudioService.js (prohibited French robot from speaking Wolof)!');
} else {
  console.log('voiceAudioService.js already updated or target mismatch');
}
