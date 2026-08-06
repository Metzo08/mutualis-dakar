/**
 * Service de Synthèse Vocale Hybride UNAMUSC (Sénégal)
 * Combinaison des Packs Audio HD Natifs (Wolof, Pulaar, Français) 
 * et du Moteur IA Dynamique avec Nettoyage Phonétique.
 */

// Nettoyage strict des symboles, émojis et caractères spéciaux
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
 * Générateur de Carillon Médical Web Audio API (Signal Sonore 587Hz -> 880Hz)
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
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    }
  } catch (e) {
    console.warn("Chime playback error:", e);
  }
}

/**
 * Moteur Hybride de Lecture Vocale Trilingue (Français, Wolof, Pulaar)
 * 1. Joue le carillon médical d'attention
 * 2. Utilise la voix de synthèse optimisée sans caractères parasites
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

  let textToSpeak = '';

  if (customMessage) {
    textToSpeak = customMessage;
  } else if (lang === 'wolof') {
    textToSpeak = `Nanga def ${motherName}. Rappel UNAMUSC. Consultation ak vaccins bu bébé ${babyName} am na ci centre de santé. Fajj gi gratuit cent pour cent la.`;
  } else if (lang === 'pulaar') {
    textToSpeak = `Jam waali ${motherName}. Degindagol UNAMUSC. Cellal mamin e bimbintagol fayɓe ${babyName} am na e nokkuur cellal. Prise en charge gratuit cent pour cent.`;
  } else {
    textToSpeak = `Bonjour ${motherName}. Rappel officiel UNAMUSC. La consultation de suivi et la vaccination de votre bébé ${babyName} sont programmées au centre de santé. Prise en charge cent pour cent gratuite.`;
  }

  const cleanedText = sanitizeSpeechText(textToSpeak);

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.88; // Rythme posé et naturel
    utterance.pitch = 1.05; // Intonation chaleureuse

    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.toLowerCase().includes('fr'));
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
  }
}

/**
 * Consignes d'Urgence Obstétricale Vocale (Wolof / Pulaar / FR)
 */
export function playEmergencyVoiceInstruction(dangerSign, lang = 'wolof', onEnd = null) {
  playMedicalChime();

  let msg = '';
  if (lang === 'wolof') {
    msg = `Alerte urgence maternité ! Signe constaté : ${dangerSign}. Demal légui légui ci maternité bu hôpital Abass Ndao walla CHU de Fann. Fajj gi gratuit cent pour cent la. Numéro SAMU moy 15 15.`;
  } else if (lang === 'pulaar') {
    msg = `Alerte urgence maternité ! Signe constaté : ${dangerSign}. Yaaw no feewi e hospital Abass Ndao walla CHU Fann. Fajj gi gratuit cent pour cent la. Numéro SAMU ko 15 15.`;
  } else {
    msg = `Alerte urgence maternité ! Signe constaté : ${dangerSign}. Veuillez vous rendre immédiatement à la maternité de l'hôpital Abass Ndao ou du CHU de Fann. Prise en charge cent pour cent gratuite UNAMUSC. Téléphone SAMU 15 15.`;
  }

  playHybridVoiceReminder({
    customMessage: msg,
    onEnd
  });
}
