with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Define the old block starting at "if (effectiveProvider === 'opensource') {"
old_block_start = "    // 3. MOTEUR VOCAL HYBRIDE DE HAUTE QUALITÉ : OOLEL-VOICES (WOLOF NATIF) & EDGE-TTS (FRANÇAIS HD)\n    if (effectiveProvider === 'opensource') {"

old_block_end = "      // 2. Repli Piper local si indisponible\n      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts';"

new_block = """    // 3. MOTEUR VOCAL HYBRIDE DE HAUTE QUALITÉ : GALSENAI (WOLOF NATIF 100% SÉNÉGALAIS) & EDGE-TTS (FRANÇAIS HD)
    if (effectiveProvider === 'opensource') {
      // ── A. GALSENAI POCKET-TTS (VOIX FÉMININE WOLOF AUTHENTIQUE ET NATIVE) ──
      // Véritable voix sénégalaise entraînée sur le corpus wolof. Jamais d'accent français !
      if (isWolof) {
        // 1. Vérification prioritaire du cache WAV natif
        if (fs.existsSync(wavCacheFile) && fs.statSync(wavCacheFile).size > 1000) {
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('X-TTS-Cache', 'GALSENAI_NATIVE_HIT');
          return res.sendFile(wavCacheFile);
        }

        // 2. Synthèse dynamique native via le modèle GalsenAI Pocket-TTS
        try {
          console.log(`[GalsenAI Wolof TTS] Synthèse vocale native pour: "${cleanText.substring(0, 45)}..."`);
          const pocketCall = await fetch('https://abdazizsall-wolof-pocket-tts-demo.hf.space/gradio_api/call/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [cleanText, 'Voice 1 (galsenai, female)'] }),
            signal: AbortSignal.timeout(18000)
          });
          if (pocketCall.ok) {
            const callData = await pocketCall.json();
            if (callData.event_id) {
              const streamRes = await fetch(`https://abdazizsall-wolof-pocket-tts-demo.hf.space/gradio_api/call/synthesize/${callData.event_id}`, {
                signal: AbortSignal.timeout(22000)
              });
              const streamText = await streamRes.text();
              const match = streamText.match(/"url":\\s*"([^"]+)"/);
              if (match && match[1]) {
                const audioRes = await fetch(match[1], { signal: AbortSignal.timeout(12000) });
                if (audioRes.ok) {
                  const buf = Buffer.from(await audioRes.arrayBuffer());
                  console.log(`[GalsenAI Wolof TTS] Succès audio natif (${buf.length} octets) - mis en cache`);
                  try { fs.writeFileSync(wavCacheFile, buf); } catch (e) {}
                  res.setHeader('Content-Type', 'audio/wav');
                  res.setHeader('X-TTS-Cache', 'GALSENAI_NATIVE_DYNAMIC');
                  return res.send(buf);
                }
              }
            }
          }
        } catch (galsenErr) {
          console.warn('[GalsenAI Wolof TTS] Erreur synthèse dynamique :', galsenErr.message);
        }

        // Si la synthèse dynamique échoue, et qu'un WAV de salutation existe, le renvoyer plutôt qu'une voix française
        const defaultWolofWav = path.join(ttsCacheDir, '28fed49d538d52d122cc37e03ae52df2.wav');
        if (fs.existsSync(defaultWolofWav)) {
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('X-TTS-Cache', 'GALSENAI_DEFAULT_FALLBACK');
          return res.sendFile(defaultWolofWav);
        }
      }

      // ── B. MICROSOFT NEURAL DENISE (STRICTEMENT RÉSERVÉ AU FRANÇAIS) ──
      if (!isWolof) {
        try {
          console.log(`[Neural HD TTS (fr)] Synthèse vocale naturelle Denise : "${cleanText.substring(0, 45)}..."`);
          const { execFile } = require('child_process');
          await new Promise((resolve, reject) => {
            execFile('C:/Python313/python.exe', ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', cleanText, '--write-media', mp3CacheFile], { timeout: 15000 }, (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
          if (fs.existsSync(mp3CacheFile) && fs.statSync(mp3CacheFile).size > 1000) {
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('X-TTS-Cache', 'NEURAL_HD');
            return res.sendFile(mp3CacheFile);
          }
        } catch (neuralErr) {
          console.warn('[Neural HD TTS] Erreur Edge-TTS :', neuralErr.message);
        }
      }

      // 2. Repli Piper local si indisponible
      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts';"""

start_pos = content.find(old_block_start)
end_pos = content.find(old_block_end)

if start_pos != -1 and end_pos != -1:
    content = content[:start_pos] + new_block + content[end_pos + len("      // 2. Repli Piper local si indisponible\n      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts';"):]
    with open(r'C:\Users\hp\Downloads\MUTUALIS DAKAR\backend\server.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: server.js patched with GalsenAI native Wolof voice!")
else:
    print(f"FAILED: start_pos={start_pos}, end_pos={end_pos}")
