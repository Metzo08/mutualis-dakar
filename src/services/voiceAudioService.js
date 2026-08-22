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
  // Base dynamique : suit le hostname courant (PC ou IP LAN pour le mobile)
  if (typeof window !== 'undefined' && window.location.port) {
    return (window.API_BASE_URL || 'http://' + window.location.hostname + ':5000') + '/api/tts';
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
let currentSpeechSeq = 0;

// ── Élément audio PERSISTANT, déverrouillé au premier clic ──
// La politique autoplay de Chrome bloque audio.play() dès que le « user
// activation » (≈5 s) a expiré — typiquement quand la réponse du chatbot
// arrive après un délai d'API. Un élément joué une fois PENDANT un clic reste
// déverrouillé pour toutes les lectures futures : on en garde un seul.
let sharedAudioEl = null;
let audioUnlocked = false;

// Référence forte à l'utterance en cours : sans elle, le garbage collector
// peut la collecter en cours de lecture et couper le son (bug connu Chrome).
let activeUtterance = null;

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

function getSharedAudioEl() {
  if (!sharedAudioEl) {
    sharedAudioEl = new Audio();
    sharedAudioEl.preload = 'auto';
  }
  return sharedAudioEl;
}

/**
 * À appeler sur CHAQUE interaction utilisateur (clic micro, envoi, ouverture
 * du chat…) : lit un silence inaudible pendant le geste, ce qui déverrouille
 * définitivement l'élément audio pour les synthèses vocales futures.
 */
export function primeAudioPlayback() {
  if (audioUnlocked) return;
  try {
    const el = getSharedAudioEl();
    el.src = SILENT_WAV;
    el.volume = 0;
    const p = el.play();
    if (p && p.then) {
      p.then(() => { audioUnlocked = true; }).catch(() => {});
    } else {
      audioUnlocked = true;
    }
    // Pré-charge aussi la liste des voix du navigateur
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.getVoices(); } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Nettoyage phonétique strict : supprime émojis, symboles, crochets, tirets.
 * Le texte propre améliore drastiquement la prononciation des moteurs TTS.
 */
export function sanitizeSpeechText(text) {
  if (!text) return '';
  let str = String(text);
  return str
    .replace(/100%/g, 'cent pour cent')
    .replace(/80%/g, 'quatre-vingts pour cent')
    .replace(/50%/g, 'cinquante pour cent')
    .replace(/20%/g, 'vingt pour cent')
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
  currentSpeechSeq++; // Invalide tout callback en attente
  activeUtterance = null; // Libère la référence anti-GC
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.removeAttribute('src');
      currentAudio.load();
      currentAudio.onended = null;
      currentAudio.onerror = null;
    } catch (e) {}
    currentAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

import { convertWolofToFrenchPhonetics } from '../utils/phonetics';

/**
 * Synthèse vocale via le backend TTS (ElevenLabs ou Open-Source).
 * Retourne true si l'audio a pu être généré et lu, false sinon (repli requis).
 *
 * ⚠️ Le watchdog n'annule QUE le démarrage : si l'audio n'a pas commencé à
 * jouer dans le délai imparti, on nettoie réellement le flux (pause + src='')
 * avant de rendre la main. Une fois la lecture lancée, plus aucun timeout ne
 * peut l'interrompre — c'est ce qui provoquait auparavant des voix superposées.
 */
async function speakViaBackendTTS(text, provider, lang, seqId, onStart, onEnd) {
  try {
    if (seqId !== currentSpeechSeq) return false;
    const url = `${TTS_BACKEND_URL}?text=${encodeURIComponent(text)}&provider=${encodeURIComponent(provider)}&lang=${encodeURIComponent(lang || 'fr')}`;
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
      }, 4000);

      audio.onplay = () => {
        started = true;
        if (startWatchdog) clearTimeout(startWatchdog);
        if (seqId === currentSpeechSeq && onStart) onStart();
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);

      audio.play().catch((err) => {
        console.warn(`[TTS] Lecture bloquée pour ${provider}:`, err && err.name ? err.name : err);
        finish(false);
      });
    });
  } catch (e) {
    return false;
  }
}

/**
 * Repli final : speechSynthesis navigateur (voix claire, naturelle et instantanée).
 *
 * Trois pièges connus de Chrome sont contournés ici :
 * 1. cancel() immédiatement suivi de speak() → silence total : on attend 120 ms.
 * 2. L'utterance doit rester référencée (sinon le GC la collecte → voix coupée).
 * 3. La synthèse peut rester « en pause » après un cancel : on force resume().
 */
function speakViaBrowserFallback(text, lang, seqId, onStart, onEnd) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  if (seqId !== currentSpeechSeq) return;

  try {
    // Le texte Wolof a déjà été converti en phonétique française : on utilise
    // fr-FR (locale toujours disponible) plutôt que fr-SN (voix souvent absente).
    const phoneticText = lang === 'wolof' ? convertWolofToFrenchPhonetics(text) : text;
    const utterance = new SpeechSynthesisUtterance(phoneticText);
    utterance.lang = 'fr-FR';

    if (lang === 'wolof') {
      utterance.rate = 0.88;
      utterance.pitch = 1.05;
    } else if (lang === 'pulaar') {
      utterance.rate = 0.86;
      utterance.pitch = 1.04;
    } else {
      utterance.rate = 0.95;
      utterance.pitch = 1.02;
    }

    let utterStarted = false;
    let utterDone = false;

    const finishUtterance = () => {
      if (utterDone) return;
      utterDone = true;
      if (activeUtterance === utterance) activeUtterance = null;
      if (seqId === currentSpeechSeq && onEnd) onEnd();
    };

    utterance.onstart = () => {
      utterStarted = true;
      activeUtterance = utterance; // Référence forte pendant toute la lecture
      if (seqId === currentSpeechSeq && onStart) onStart();
    };
    utterance.onend = finishUtterance;
    utterance.onerror = finishUtterance;

    const startSpeaking = () => {
      if (seqId !== currentSpeechSeq) return;
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const bestVoice = voices.find(v => (v.lang.startsWith('fr') || v.lang.startsWith('wo')) && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Amélie') || v.name.includes('Denise') || v.name.includes('Céline')))
          || voices.find(v => v.lang.startsWith('fr') && v.name.toLowerCase().includes('female'))
          || voices.find(v => v.lang.startsWith('fr'));
        if (bestVoice) utterance.voice = bestVoice;
      }
      try {
        window.speechSynthesis.speak(utterance);
        // Sort l'éventuel état « paused » hérité d'un cancel précédent
        try { window.speechSynthesis.resume(); } catch (e) {}
      } catch (err) {
        console.warn('SpeechSynthesis speak error:', err);
        finishUtterance();
        return;
      }
      // Filet de sécurité : si la synthèse ne démarre jamais (voix absente),
      // on libère le flux conversationnel au bout de 2,5 s.
      setTimeout(() => {
        if (!utterStarted && !utterDone && seqId === currentSpeechSeq) {
          console.warn('[TTS] speechSynthesis n\'a pas démarré (aucune voix disponible ?)');
          finishUtterance();
        }
      }, 2500);
    };

    activeUtterance = utterance; // Anti-GC dès maintenant
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    // Chrome : un speak() immédiat après cancel() est avalé en silence → 120 ms
    setTimeout(startSpeaking, 120);
  } catch (e) {
    if (onEnd) onEnd();
  }
}

/**
 * Moteur de Parole Vocale — voix NATURELLE prioritaire (ElevenLabs/Open-Source),
 * avec repli automatique sur speechSynthesis si le backend est indisponible.
 */
export async function speakCleanText(textToSpeak, lang = 'fr', onStart = null, onEnd = null) {
  stopAllVoicePlayback();
  const thisSeq = currentSpeechSeq;

  const cleanedText = sanitizeSpeechText(textToSpeak);
  if (!cleanedText) {
    if (onEnd) onEnd();
    return;
  }

  // Chaîne de providers à essayer dans l'ordre (du plus naturel au repli)
  const providers = PREFERRED_PROVIDER === 'opensource'
    ? ['opensource', 'elevenlabs']
    : ['elevenlabs', 'opensource'];

  for (const provider of providers) {
    if (thisSeq !== currentSpeechSeq) return;
    const ok = await speakViaBackendTTS(cleanedText, provider, lang, thisSeq, onStart, onEnd);
    if (ok && thisSeq === currentSpeechSeq) return;
  }

  // Repli final : voix synthèse navigateur (instantanée)
  if (thisSeq === currentSpeechSeq) {
    speakViaBrowserFallback(cleanedText, lang, thisSeq, onStart, onEnd);
  }
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
