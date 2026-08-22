/**
 * Serveur HTTP Piper TTS — Open-Source, gratuit, illimité, hors-ligne.
 *
 * ARCHITECTURE PERFORMANTE : un processus `piper.http_server` persistant est
 * démarré une seule fois (le modèle ONNX reste chargé en RAM) et ce serveur
 * joue le rôle d'adaptateur de protocole pour le backend Express :
 *
 *   POST /api/tts { text, language }  →  WAV (audio/wav)
 *
 * Latence : ~0,2-1 s par phrase (contre ~30 s en relançant python à chaque
 * requête). Repli automatique : si le moteur persistant meurt, on retombe
 * sur une génération par spawn ponctuel.
 *
 * Démarrage : node piperServer.js   (port par défaut : 5001)
 */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = process.env.PIPER_PORT || 5001;
const PIPER_HTTP_PORT = process.env.PIPER_CORE_PORT || 5002;
const MODEL_DIR = path.join(__dirname, 'piper_models');
const MODEL_FILE = path.join(MODEL_DIR, 'fr_FR-siwis-medium.onnx');

// Vérifier que le modèle existe
if (!fs.existsSync(MODEL_FILE)) {
  console.error(`[Piper] Modèle introuvable : ${MODEL_FILE}`);
  console.error('[Piper] Téléchargez-le avec :');
  console.error('  curl -L -o piper_models/fr_FR-siwis-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx"');
  console.error('  curl -L -o piper_models/fr_FR-siwis-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json"');
  process.exit(1);
}

let requestCounter = 0;
const MAX_TEXT_LENGTH = 2000;

// ── MOTEUR PERSISTANT : le modèle reste chargé en mémoire ──
const piperCore = spawn('python', ['-m', 'piper.http_server', '-m', MODEL_FILE, '--port', String(PIPER_HTTP_PORT)], {
  stdio: ['ignore', 'pipe', 'pipe']
});
piperCore.stdout.on('data', (d) => process.stdout.write('[piper-core] ' + d));
piperCore.stderr.on('data', (d) => process.stderr.write('[piper-core] ' + d));
piperCore.on('exit', (code) => {
  engineReady = false;
  console.error(`[Piper] Moteur persistant arrêté (code ${code}) — repli sur génération par spawn.`);
});

let engineReady = false;
async function waitForEngine(retries = 90) {
  if (engineReady) return true;
  for (let i = 0; i < retries; i++) {
    try {
      // /info renvoie un JSON 200 dès que le modèle est chargé en RAM.
      // (la racine « / » renvoie la page HTML de test, pas un indicateur fiable)
      await fetch(`http://127.0.0.1:${PIPER_HTTP_PORT}/info`, { method: 'GET', signal: AbortSignal.timeout(1500) });
      engineReady = true;
      console.log(`[Piper] Moteur persistant prêt sur le port ${PIPER_HTTP_PORT}.`);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

// ── REPLI : génération par spawn ponctuel (si le moteur persistant est mort) ──
function generateWithPiperSpawn(text) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(require('os').tmpdir(), `piper_${Date.now()}_${requestCounter++}.wav`);
    const args = ['-m', MODEL_FILE, '-f', tmpFile, '--length-scale', '1.05'];
    const piper = spawn('python', ['-m', 'piper', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    piper.stderr.on('data', (d) => { stderr += d.toString(); });
    piper.on('error', (err) => reject(new Error(`Piper non exécutable : ${err.message}`)));
    piper.on('close', (code) => {
      if (code !== 0) { reject(new Error(`Piper code ${code}: ${stderr}`)); return; }
      try {
        const buf = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(buf);
      } catch (e) { reject(e); }
    });
    piper.stdin.write(text);
    piper.stdin.end();
  });
}

// ── SERVEUR ADAPTATEUR (API compatible avec l'ancienne) ──
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', engine: 'piper', model: 'fr_FR-siwis-medium', persistent: engineReady }));
    return;
  }

  // Adaptation phonétique pour prononciation Wolof naturelle par le moteur neural
  const adaptForSpeech = (rawText, lang) => {
    let t = String(rawText || '')
      .replace(/100%/g, 'cent pour cent')
      .replace(/80%/g, 'quatre-vingts pour cent')
      .replace(/50%/g, 'cinquante pour cent')
      .replace(/20%/g, 'vingt pour cent')
      .replace(/%/g, ' pour cent')
      .replace(/FCFA/gi, 'francs cfa')
      .replace(/[\(\)\[\]\{\}]/g, ' ')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // Emojis
      .trim();

    if (lang === 'wo' || lang === 'wolof') {
      t = t
        .replace(/salamaalekum/gi, 'salam aleykoum')
        .replace(/jërejëf|jerejef/gi, 'diéré dieuf')
        .replace(/nanga def/gi, 'nanga def')
        .replace(/ndakaaru/gi, 'dakar')
        .replace(/fajukaay/gi, 'fadiou kay')
        .replace(/garab/gi, 'garap')
        .replace(/wér-gi-yaram/gi, 'wer gui yaram')
        .replace(/kër/gi, 'keur')
        .replace(/mën/gi, 'meune')
        .replace(/ñoo/gi, 'gnio')
        .replace(/ñaar/gi, 'gnar')
        .replace(/xaalis/gi, 'haliss');
    }
    return t;
  };

  const handleTtsRequest = async (text, language, res) => {
    try {
      if (!text || typeof text !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Paramètre "text" requis.' }));
        return;
      }
      if (text.length > MAX_TEXT_LENGTH) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Texte trop long (max ${MAX_TEXT_LENGTH} caractères).` }));
        return;
      }

      const started = Date.now();
      const speechText = adaptForSpeech(text, language);
      console.log(`[Piper TTS] Synthèse (${language || 'fr'}): "${speechText.substring(0, 50)}..."`);

      let audioBuffer = null;
      const ok = await waitForEngine(3);
      if (ok) {
        // API de piper-tts ≥ 1.3 : POST /synthesize avec corps JSON
        // { text }. L'ancien GET /?text= renvoyait la page HTML de test
        // (d'où des « WAV » illisibles que le navigateur refusait de lire).
        const coreRes = await fetch(
          `http://127.0.0.1:${PIPER_HTTP_PORT}/synthesize`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: speechText, length_scale: 1.05 }),
            signal: AbortSignal.timeout(30000)
          }
        );
        if (coreRes.ok) {
          const buf = Buffer.from(await coreRes.arrayBuffer());
          // Validation : un vrai WAV commence par « RIFF »
          if (buf.length > 44 && buf.slice(0, 4).toString('ascii') === 'RIFF') {
            audioBuffer = buf;
          } else {
            console.warn(`[Piper TTS] Réponse non-audio reçue (${buf.length} octets) — repli spawn.`);
          }
        }
      }
      if (!audioBuffer) {
        console.warn('[Piper TTS] Moteur persistant indisponible — repli spawn.');
        audioBuffer = await generateWithPiperSpawn(speechText);
      }

      console.log(`[Piper TTS] OK en ${Date.now() - started} ms (${audioBuffer.length} octets)`);
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audioBuffer.length });
      res.end(audioBuffer);
    } catch (err) {
      console.error('[Piper TTS] Erreur:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Erreur génération vocale Piper.', detail: err.message }));
    }
  };

  if (req.url.startsWith('/api/tts') && req.method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const text = urlObj.searchParams.get('text');
    const language = urlObj.searchParams.get('language') || urlObj.searchParams.get('lang') || 'fr';
    return handleTtsRequest(text, language, res);
  }

  if (req.url === '/api/tts' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        return handleTtsRequest(parsed.text, parsed.language || parsed.lang, res);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON invalide.' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint inconnu. Utilisez POST /api/tts.' }));
});

(async () => {
  await waitForEngine(90);
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`🎙️  Serveur Piper TTS démarré sur http://127.0.0.1:${PORT}`);
    console.log(`    Moteur persistant : port ${PIPER_HTTP_PORT} (modèle en RAM)`);
    console.log(`    Endpoint : POST http://127.0.0.1:${PORT}/api/tts  { "text": "...", "language": "fr" }`);
  });
})();

process.on('SIGINT', () => { try { piperCore.kill(); } catch (e) {} process.exit(0); });
process.on('SIGTERM', () => { try { piperCore.kill(); } catch (e) {} process.exit(0); });
