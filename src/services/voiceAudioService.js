/**
 * Service de Synthèse Vocale Médicale UNAMUSC (Sénégal)
 * Supprime la musique et produit une voix parlée fluide, nette et naturelle
 * pour le Wolof, le Pulaar et le Français.
 */

// Nettoyage phonétique strict (supprime les émojis, symboles, crochets, tirets)
export function sanitizeSpeechText(text) {
  if (!text) return '';
  let str = String(text);
  return str
    .replace(/100%/g, 'cent pour cent')
    .replace(/%/g, ' pour cent')
    .replace(/[\(\)\[\]\{\}]/g, ' ')
    .replace(/[!?,;:\-\—•]/g, ' ')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ']/gi, ' ')
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
    console.warn("Chime error:", e);
  }
}

/**
 * Arrêter toute lecture vocale en cours
 */
export function stopAllVoicePlayback() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Moteur de Parole Vocale Parlée (Aucune musique, uniquement la parole parlée nette)
 */
export function speakCleanText(textToSpeak, lang = 'fr', onStart = null, onEnd = null) {
  stopAllVoicePlayback();

  const cleanedText = sanitizeSpeechText(textToSpeak);
  if (!cleanedText) return;

  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'fr-FR';
    
    // Débit et intonation posés pour un rendu naturel et chaleureux
    if (lang === 'wolof') {
      utterance.rate = 0.85;
      utterance.pitch = 1.08;
    } else if (lang === 'pulaar') {
      utterance.rate = 0.84;
      utterance.pitch = 1.06;
    } else {
      utterance.rate = 0.90;
      utterance.pitch = 1.02;
    }

    const voices = window.speechSynthesis.getVoices();
    // Sélection prioritaire de la voix la plus naturelle et fluide
    const bestVoice = voices.find(v => v.lang.startsWith('fr') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Amélie')))
      || voices.find(v => v.lang.startsWith('fr') && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang.startsWith('fr'));

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
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
