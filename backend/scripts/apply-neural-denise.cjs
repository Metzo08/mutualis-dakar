const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/backend/server.js';
let content = fs.readFileSync(p, 'utf8');

const targetStr = `      // Serveur vocal neural Piper local (backend/piperServer.js — voix humaine fr_FR-siwis-medium)
      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts';

      console.log(\`[Piper TTS] Envoi à \${ttsUrl} pour: "\${cleanText.substring(0, 30)}..."\`);
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, language: langKey }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(\`Piper TTS returned status \${response.status}\`);
      }

      const buffer = await response.arrayBuffer();
      const nodeBuf = Buffer.from(buffer);
      try { fs.writeFileSync(cacheFile, nodeBuf); } catch (e) {}
      res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/wav');
      res.setHeader('X-TTS-Cache', 'GENERATED');
      return res.send(nodeBuf);`;

const replacementStr = `      // 1. VOIX FÉMININE HUMAINE NATURELLE HD (MICROSOFT NEURAL DENISE — ZÉRO ROBOTIQUE)
      const mp3CacheFile = path.join(ttsCacheDir, hashKey + '.mp3');
      if (fs.existsSync(mp3CacheFile)) {
        const stats = fs.statSync(mp3CacheFile);
        if (stats.size > 1000) {
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('X-TTS-Cache', 'HIT_NEURAL');
          return res.sendFile(mp3CacheFile);
        }
      }

      try {
        console.log(\`[Neural HD TTS] Synthèse voix humaine féminine Denise pour: "\${cleanText.substring(0, 40)}..."\`);
        const { execFile } = require('child_process');
        await new Promise((resolve, reject) => {
          execFile('python', ['-m', 'edge_tts', '--voice', 'fr-FR-DeniseNeural', '--text', cleanText, '--write-media', mp3CacheFile], { timeout: 12000 }, (err) => {
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
        console.warn('[Neural HD TTS] Repli Piper local :', neuralErr.message);
      }

      // 2. Repli Piper local si indisponible
      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts';
      console.log(\`[Piper TTS] Envoi à \${ttsUrl} pour: "\${cleanText.substring(0, 30)}..."\`);
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, language: langKey }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(\`Piper TTS returned status \${response.status}\`);
      }

      const buffer = await response.arrayBuffer();
      const nodeBuf = Buffer.from(buffer);
      try { fs.writeFileSync(cacheFile, nodeBuf); } catch (e) {}
      res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/wav');
      res.setHeader('X-TTS-Cache', 'GENERATED_PIPER');
      return res.send(nodeBuf);`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(p, content, 'utf8');
  console.log('Successfully upgraded backend TTS with Neural HD Denise voice!');
} else {
  console.error('Target string not found in server.js');
}
