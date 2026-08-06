/**
 * Service de Synthèse Vocale Médicale UNAMUSC (Sénégal)
 *
 * Architecture hybride 3 niveaux (du plus naturel au repli robotique) :
 *   1. ElevenLabs (voix neuronale naturelle premium) via backend /api/tts
 *   2. Open-Source TTS (voix naturelle auto-hébergée) via backend /api/tts
 *   3. speechSynthesis navigateur (repli offline — voix robotique, dernier recours)
 *
 * Le texte est nettoyé phonétiquement avant envoi pour garantir une prononciation
 * fluide, débarrassée des émojis, symboles et caractères parasites.
 */

const TTS_BACKEND_URL = (() => {
  // En dev : backend sur localhost:5000 ; en prod : même origine via proxy
  if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
    return 'http://127.0.0.1:5000/api/tts';
  }
  return '/api/tts';
})();

// Provider préféré, mémorisé. 'opensource' = Piper TTS (gratuit, illimité).
// Bascule sur 'elevenlabs' si une clé API est configurée plus tard.
const PREFERRED_PROVIDER = (() => {
  try {
    return localStorage.getItem('cmu-voice-provider') || 'opensource';
  } catch {
    return 'opensource';
  }
})();

// Audio en cours de lecture (pour pouvoir l'arrêter)
let currentAudio = null;

/**
 * Nettoyage phonétique strict : supprime émojis, symboles, crochets, tirets.
 * Le texte propre améliore drastiquement la prononciation des moteurs TTS.
 */
export function sanitizeSpeechText(text) {
  if (!text) return '';
  let str = String(text);
  return str
    .replace(/100%/g, 'cent pour cent')
    .replace(/%/g, ' pour cent')
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/[!?,;:\-\—•]/g, ' ')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // émojis
    .replace(/[^\w\sàâäéèêëîïôöùûüçñŋɛɛɔɔÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ']/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Carillon Médical Sonore d'Attention (Signal 587Hz -> 880Hz)
 */
export function playMedicalChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.warn('Chime error:', e);
  }
}

/**
 * Arrêter toute lecture vocale en cours.
 */
export function stopAllVoicePlayback() {
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = ''; } catch (e) {}
    currentAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Synthèse vocale via le backend TTS (ElevenLabs ou Open-Source).
 * Retourne true si l'audio a pu être généré et lu, false sinon (repli requis).
 */
async function speakViaBackendTTS(text, provider, lang, onStart, onEnd) {
  try {
    const url = `${TTS_BACKEND_URL}?text=${encodeURIComponent(text)}&provider=${encodeURIComponent(provider)}&lang=${encodeURIComponent(lang || 'fr')}`;
    const audio = new Audio(url);
    currentAudio = audio;

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (ok) => {
        if (resolved) return;
        resolved = true;
        if (currentAudio === audio) currentAudio = null;
        if (onEnd) onEnd();
        resolve(ok);
      };

      audio.onplay = () => { if (onStart) onStart(); };
      audio.onended = () => finish(true);
      audio.onerror = () => {
        console.warn(`[TTS] Provider ${provider} a échoué (audio error).`);
        finish(false);
      };

      audio.play().then(() => {
        if (onStart) onStart();
      }).catch((err) => {
        console.warn(`[TTS] Lecture audio ${provider} impossible:`, err.message);
        finish(false);
      });

      // Timeout de sécurité (15s) — si l'API ne répond pas
      setTimeout(() => finish(false), 15000);
    });
  } catch (e) {
    console.warn(`[TTS] Erreur backend ${provider}:`, e.message);
    return false;
  }
}

/**
 * Repli final : speechSynthesis navigateur (voix robotique, dernier recours).
 */
function speakViaBrowserFallback(text, lang, onStart, onEnd) {
  if (!('speechSynthesis' in window)) {
    console.warn('[TTS] speechSynthesis indisponible. Aucune voix possible.');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  if (lang === 'wolof') { utterance.rate = 0.85; utterance.pitch = 1.08; }
  else if (lang === 'pulaar') { utterance.rate = 0.84; utterance.pitch = 1.06; }
  else { utterance.rate = 0.90; utterance.pitch = 1.02; }

  const voices = window.speechSynthesis.getVoices();
  const bestVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Amélie')))
    || voices.find(v => v.lang.startsWith('fr') && v.name.toLowerCase().includes('female'))
    || voices.find(v => v.lang.startsWith('fr'));
  if (bestVoice) utterance.voice = bestVoice;

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

/**
 * Moteur de Parole Vocale — voix NATURELLE prioritaire (ElevenLabs/Open-Source),
 * avec repli automatique sur speechSynthesis si le backend est indisponible.
 */
export async function speakCleanText(textToSpeak, lang = 'fr', onStart = null, onEnd = null) {
  stopAllVoicePlayback();

  const cleanedText = sanitizeSpeechText(textToSpeak);
  if (!cleanedText) return;

  // Chaîne de providers à essayer dans l'ordre (du plus naturel au repli)
  const providers = PREFERRED_PROVIDER === 'opensource'
    ? ['opensource', 'elevenlabs']
    : ['elevenlabs', 'opensource'];

  for (const provider of providers) {
    const ok = await speakViaBackendTTS(cleanedText, provider, lang, onStart, onEnd);
    if (ok) return; // Succès : voix naturelle jouée
  }

  // Repli final : voix robotique navigateur (dernier recours)
  console.warn('[TTS] Tous les providers backend ont échoué. Repli speechSynthesis.');
  speakViaBrowserFallback(cleanedText, lang, onStart, onEnd);
}

/**
 * Relances Vocales Maternité Trilingues (Wolof, Pulaar, Français)
 */
export function playHybridVoiceReminder({
  lang = 'fr',
  motherName = 'Fatou Diallo',
  babyName = 'Moussa Ndiaye',
  prestation = 'Consultation prénatale et vaccination PEV',
  customMessage = null,
  onStart = null,
  onEnd = null
}) {
  playMedicalChime();

  let textToSpeak = customMessage;
  if (!textToSpeak) {
    if (lang === 'wolof') {
      textToSpeak = `Nanga def ${motherName} ! Rappel UNAMUSC : consultation ak vaccins bu bébé ${babyName} am na ci centre de santé. Fajj gi gratuit cent pour cent la.`;
    } else if (lang === 'pulaar') {
      textToSpeak = `Jam waali ${motherName} ! Degindagol UNAMUSC : cellal mamin e bimbintagol fayɓe ${babyName} am na e nokkuur cellal. Prise en charge gratuit cent pour cent.`;
    } else {
      textToSpeak = `Bonjour ${motherName} ! Rappel officiel UNAMUSC : La consultation de suivi et la vaccination de votre bébé ${babyName} sont programmées au centre de santé. Prise en charge cent pour cent gratuite.`;
    }
  }

  speakCleanText(textToSpeak, lang, onStart, onEnd);
}

/**
 * Consignes d'Urgence Obstétricale Vocale (Wolof / Pulaar / FR)
 */
export function playEmergencyVoiceInstruction(dangerSign, lang = 'wolof', onEnd = null) {
  playMedicalChime();

  let msg = '';
  if (lang === 'wolof') {
    msg = `Alerte urgence maternité ! Signe constaté : ${dangerSign}. Demal légui légui ci maternité bu hôpital Abass Ndao walla CHU de Fann. Numéro SAMU moy 15 15.`;
  } else if (lang === 'pulaar') {
    msg = `Alerte urgence maternité ! Signe constaté : ${dangerSign}. Yaaw no feewi e hospital Abass Ndao walla CHU Fann. Numéro SAMU ko 15 15.`;
  } else {
    msg = `Alerte urgence maternité ! Signe constaté : ${dangerSign}. Veuillez vous rendre immédiatement à la maternité de l'hôpital Abass Ndao ou du CHU de Fann. Téléphone SAMU 15 15.`;
  }

  speakCleanText(msg, lang, null, onEnd);
}
