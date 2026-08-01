import React, { useState, useEffect, useRef } from 'react';
import { isWolofText, convertWolofToFrenchPhonetics, cleanTextForTTS } from '../utils/phonetics';

export default function AudioReader({ lang }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synth = window.speechSynthesis;
  const audioRef = useRef(null);

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

  const t = dict[lang] || dict.fr;

  // Stop speaking on view changes or unmount
  useEffect(() => {
    return () => {
      if (synth) {
        synth.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [lang]);

  const speakLocal = (textToSpeak, isWolof) => {
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'fr-FR';
    utterance.rate = isWolof ? 0.85 : 1.0;

    const voices = synth.getVoices();
    const frenchVoice = voices.find(v => v.lang.startsWith('fr') && v.name.toLowerCase().includes('female')) 
      || voices.find(v => v.lang.startsWith('fr'));
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synth.speak(utterance);
  };

  const handleToggleSpeak = () => {
    if (!synth) {
      alert("Votre navigateur ne supporte pas la synthèse vocale.");
      return;
    }

    if (isSpeaking) {
      synth.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
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

    // Synthèse vocale native du navigateur (API Web Speech).
    // Remplace l'ancien proxy backend /api/tts qui piratait Google Translate (ToS).
    speakLocal(textToSpeak, isWolof);
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
