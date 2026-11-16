const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/services/voiceAudioService.js';
let content = fs.readFileSync(p, 'utf8');

// 1. TTS_BACKEND_URL: ensure /api/tts is used when on Vite dev or localhost:5173
const oldTtsUrl = `const TTS_BACKEND_URL = (() => {
  // Base dynamique : suit le hostname courant (PC ou IP LAN pour le mobile)
  if (typeof window !== 'undefined' && window.location.port) {
    return (window.API_BASE_URL || 'http://' + window.location.hostname + ':5000') + '/api/tts';
  }
  return '/api/tts';
})();`;

const newTtsUrl = `const TTS_BACKEND_URL = (() => {
  // En mode Vite (port 5173) ou même origine, utiliser le chemin relatif /api/tts
  // pour bénéficier du proxy Vite et éviter tout blocage CORS / CORP
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173' || window.location.port === '5000') {
      return '/api/tts';
    }
    return (window.API_BASE_URL || 'http://' + window.location.hostname + ':5000') + '/api/tts';
  }
  return '/api/tts';
})();`;

if (content.includes(oldTtsUrl)) {
  content = content.replace(oldTtsUrl, newTtsUrl);
}

// 2. In speakViaBackendTTS: use fetch(url) -> blob -> createObjectURL
const oldSpeakBackend = `async function speakViaBackendTTS(text, provider, lang, seqId, onStart, onEnd) {
  try {
    if (seqId !== currentSpeechSeq) return false;
    const url = \`\${TTS_BACKEND_URL}?text=\${encodeURIComponent(text)}&provider=\${encodeURIComponent(provider)}&lang=\${encodeURIComponent(lang || 'fr')}\`;
    // Élément audio PERSISTANT réutilisé : s'il a été déverrouillé par un clic
    // (primeAudioPlayback), la lecture est autorisée même sans activation
    // utilisateur récente (politique autoplay de Chrome).
    const audio = getSharedAudioEl();
    audio.volume = 1;
    audio.muted = false;
    audio.src = url;
    currentAudio = audio;`;

const newSpeakBackend = `async function speakViaBackendTTS(text, provider, lang, seqId, onStart, onEnd) {
  try {
    if (seqId !== currentSpeechSeq) return false;
    const url = \`\${TTS_BACKEND_URL}?text=\${encodeURIComponent(text)}&provider=\${encodeURIComponent(provider)}&lang=\${encodeURIComponent(lang || 'fr')}\`;
    
    // Récupération par fetch en amont : garantit le statut HTTP (200),
    // contourne les restrictions CORP/CORS des balises <audio>
    // et produit un Blob local en mémoire 100% lisible par le navigateur.
    const response = await fetch(url, { signal: AbortSignal.timeout(18000) });
    if (!response.ok) {
      console.warn(\`[TTS] Serveur vocal \${provider} a retourné le statut \${response.status}\`);
      return false;
    }
    const blob = await response.blob();
    if (!blob || blob.size < 100) {
      console.warn(\`[TTS] Flux audio vide reçu (\${blob ? blob.size : 0} octets)\`);
      return false;
    }
    const blobUrl = URL.createObjectURL(blob);

    const audio = getSharedAudioEl();
    audio.volume = 1;
    audio.muted = false;
    audio.src = blobUrl;
    currentAudio = audio;`;

if (content.includes(oldSpeakBackend)) {
  content = content.replace(oldSpeakBackend, newSpeakBackend);
}

// 3. Natural pitch & rate in fallback
content = content.replace("utterance.pitch = 1.10;", "utterance.pitch = 1.0;");
content = content.replace("utterance.pitch = 1.12;", "utterance.pitch = 1.0;");
content = content.replace("utterance.rate = 0.95;", "utterance.rate = 1.0;");

fs.writeFileSync(p, content, 'utf8');
console.log('voiceAudioService updated successfully!');
