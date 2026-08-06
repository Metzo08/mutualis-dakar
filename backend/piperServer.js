/**
 * Serveur HTTP Piper TTS — Open-Source, gratuit, illimité, hors-ligne.
 *
 * Expose un endpoint POST /api/tts qui prend { text, language } en JSON
 * et retourne un fichier audio WAV généré par Piper (modèle voix française).
 *
 * Démarrage : node piperServer.js
 * Port par défaut : 5001
 *
 * Configuration backend/.env :
 *   OPEN_SOURCE_TTS_URL=http://127.0.0.1:5001/api/tts
 */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

const PORT = process.env.PIPER_PORT || 5001;
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
const MAX_TEXT_LENGTH = 2000; // Limite anti-abus

/**
 * Génère un WAV via Piper CLI.
 */
function generateWithPiper(text) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(require('os').tmpdir(), `piper_${Date.now()}_${requestCounter++}.wav`);
    // Piper lit le texte sur stdin et écrit le WAV dans -f
    const args = ['-m', MODEL_FILE, '-f', tmpFile, '--length-scale', '1.05'];
    const piper = spawn('python', ['-m', 'piper', ...args], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stderr = '';
    piper.stderr.on('data', (d) => { stderr += d.toString(); });

    piper.on('error', (err) => {
      reject(new Error(`Piper non exécutable : ${err.message}. Installez avec : pip install piper-tts`));
    });

    piper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Piper a échoué (code ${code}): ${stderr}`));
        return;
      }
      try {
        const audioBuffer = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile); // Nettoyer le fichier temporaire
        resolve(audioBuffer);
      } catch (e) {
        reject(new Error(`Lecture du fichier audio échouée: ${e.message}`));
      }
    });

    // Envoyer le texte sur stdin
    piper.stdin.write(text);
    piper.stdin.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS permissif (dev local)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Endpoint santé
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', engine: 'piper', model: 'fr_FR-siwis-medium' }));
    return;
  }

  // Endpoint POST /api/tts
  if (req.url === '/api/tts' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) req.destroy(); });
    req.on('end', async () => {
      try {
        const { text, language } = JSON.parse(body);
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

        console.log(`[Piper TTS] Synthèse (${(language || 'fr')}): "${text.substring(0, 50)}..."`);
        const audioBuffer = await generateWithPiper(text);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': audioBuffer.length
        });
        res.end(audioBuffer);
      } catch (err) {
        console.error('[Piper TTS] Erreur:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Erreur génération vocale Piper.', detail: err.message }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint inconnu. Utilisez POST /api/tts.' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`🎙️  Serveur Piper TTS démarré sur http://127.0.0.1:${PORT}`);
  console.log(`    Modèle : fr_FR-siwis-medium (voix féminine française)`);
  console.log(`    Endpoint : POST http://127.0.0.1:${PORT}/api/tts  { "text": "...", "language": "fr" }`);
});
