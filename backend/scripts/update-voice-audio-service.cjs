const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/services/voiceAudioService.js';
let content = fs.readFileSync(p, 'utf8');

// 1. Accents Wolof complets dans sanitizeSpeechText
content = content.replace(
  ".replace(/[^\\w\\sàâäéèêëîïôöùûüçñŋɛɛɔɔÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ']/gi, ' ')",
  ".replace(/[^\\w\\sàâäáéèêëíîïóôöúùûüçñŋɛɔÀÂÄÁÉÈÊËÍÎÏÓÔÖÚÙÛÜÇÑŊ']/gi, ' ')"
);

// 2. Watchdog timeout et Blob fetch dans speakViaBackendTTS
const targetBackendTTS = `async function speakViaBackendTTS(text, provider, lang, seqId, onStart, onEnd) {
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
    currentAudio = audio;

    return new Promise((resolve) => {
      let resolved = false;
      let started = false;
      let startWatchdog = null;

      const finish = (ok) => {
        if (resolved) return;
        resolved = true;
        if (startWatchdog) clearTimeout(startWatchdog);
        if (currentAudio === audio) {
          if (!ok) {
            // Échec de démarrage : on interrompt vraiment le flux pour ne
            // jamais laisser un audio orphelin jouer en arrière-plan.
            // eslint-disable-next-line no-unused-vars -- nettoyage réel du flux best-effort : le watchdog ne doit jamais laisser d'audio orphelin.
            try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (e) {}
          }
          currentAudio = null;
        }
        if (seqId === currentSpeechSeq && ok && onEnd) onEnd();
        resolve(ok);
      };

      // Watchdog de DÉMARRAGE uniquement (jamais pendant la lecture)
      startWatchdog = setTimeout(() => {
        if (!started) finish(false);
      }, 12000);`;

const newBackendTTS = `async function speakViaBackendTTS(text, provider, lang, seqId, onStart, onEnd) {
  try {
    if (seqId !== currentSpeechSeq) return false;
    const isWolof = lang === 'wolof' || lang === 'wo';
    const langCode = isWolof ? 'wo' : (lang || 'fr');
    const url = \`\${TTS_BACKEND_URL}?text=\${encodeURIComponent(text)}&provider=\${encodeURIComponent(provider)}&lang=\${encodeURIComponent(langCode)}\`;

    // Récupération par fetch Blob pour isoler complètement des politiques CORS/CORP
    let audioSrc = url;
    let blobUrl = null;
    try {
      const fetchTimeout = isWolof ? 28000 : 15000;
      const res = await fetch(url, { signal: AbortSignal.timeout(fetchTimeout) });
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 1000) {
          blobUrl = URL.createObjectURL(blob);
          audioSrc = blobUrl;
        }
      } else {
        return false;
      }
    } catch (e) {
      console.warn(\`[TTS] Échec fetch audio (\${langCode}):\`, e.message);
      return false;
    }

    if (seqId !== currentSpeechSeq) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      return false;
    }

    // Élément audio PERSISTANT déverrouillé au premier geste utilisateur
    const audio = getSharedAudioEl();
    audio.volume = 1;
    audio.muted = false;
    audio.src = audioSrc;
    currentAudio = audio;

    return new Promise((resolve) => {
      let resolved = false;
      let started = false;
      let startWatchdog = null;

      const finish = (ok) => {
        if (resolved) return;
        resolved = true;
        if (startWatchdog) clearTimeout(startWatchdog);
        if (currentAudio === audio) {
          if (!ok) {
            try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch (e) {}
          }
          currentAudio = null;
        }
        if (blobUrl) {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 35000);
        }
        if (seqId === currentSpeechSeq && ok && onEnd) onEnd();
        resolve(ok);
      };

      // Watchdog sur le démarrage de lecture du Blob
      startWatchdog = setTimeout(() => {
        if (!started) finish(false);
      }, 10000);`;

content = content.replace(targetBackendTTS, newBackendTTS);

// 3. Ne pas altérer le wolof en pseudo-français
content = content.replace(
  "const phoneticText = lang === 'wolof' ? convertWolofToFrenchPhonetics(text) : text;",
  "const phoneticText = text;"
);

fs.writeFileSync(p, content, 'utf8');
console.log('Successfully updated voiceAudioService.js with Wolof accents, Blob fetch, and natural phonetics!');
