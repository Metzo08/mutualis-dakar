import { useState, useEffect } from 'react';
import { isWolofText, convertWolofToFrenchPhonetics, cleanTextForTTS } from '../utils/phonetics';
import { speakCleanText, stopAllVoicePlayback } from '../services/voiceAudioService';

export default function AudioReader({ lang }) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const dict = {
    fr: {
      tooltipPlay: 'Lire la page à haute voix',
      tooltipStop: 'Arrêter la lecture',
      startMsg: 'Démarrage de la lecture vocale.',
      stopMsg: 'Lecture vocale arrêtée.'
    },
    wo: {
      tooltipPlay: 'Dégloo page bi ci baat',
      tooltipStop: 'Taxawal dégloo bi',
      startMsg: 'Tambali nanu dégloo bi.',
      stopMsg: 'Taxawal nanu dégloo bi.'
    }
  };

  // eslint-disable-next-line no-unused-vars -- libellés FR/WO réservés à l'UI du lecteur (le composant rend null : la voix est déclenchée par window.cmuToggleAudio).
  const t = dict[lang] || dict.fr;

  // Stop speaking on view changes or unmount
  useEffect(() => {
    return () => {
      stopAllVoicePlayback();
    };
  }, [lang]);

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      stopAllVoicePlayback();
      setIsSpeaking(false);
      return;
    }

    // Find all readable texts on the current page
    const readableElements = document.querySelectorAll('h1, h2, h3, p:not(.tagline)');
    let textToRead = '';

    readableElements.forEach(el => {
      // Avoid reading hidden elements, header, sidebar, or chatbot
      if (
        el.offsetWidth > 0 &&
        el.offsetHeight > 0 &&
        !el.closest('.chatbot-container') &&
        !el.closest('.site-header') &&
        !el.closest('.top-navbar') &&
        !el.closest('.sidebar-nav') &&
        !el.closest('.hamburger-btn')
      ) {
        textToRead += el.innerText + '. ';
      }
    });

    if (!textToRead.trim()) {
      textToRead = lang === 'fr' ? "Aucun contenu textuel lisible trouvé sur cette page." : "Gissunuko mbind yuñu mënë lire fii.";
    }

    // Clean text and emojis
    let cleanText = cleanTextForTTS(textToRead);

    const isWolof = isWolofText(cleanText) || lang === 'wo';
    const textToSpeak = isWolof ? convertWolofToFrenchPhonetics(cleanText) : cleanText;

    setIsSpeaking(true);
    speakCleanText(textToSpeak, isWolof ? 'wolof' : 'fr', null, () => setIsSpeaking(false));
  };

  // Connect background trigger for programmatic TTS if needed
  useEffect(() => {
    window.cmuToggleAudio = handleToggleSpeak;
    return () => {
      delete window.cmuToggleAudio;
    };
  }, [isSpeaking, lang]);

  // Hidden component — Audio functionality remains active in background without blocking mobile/desktop UI
  return null;
}
