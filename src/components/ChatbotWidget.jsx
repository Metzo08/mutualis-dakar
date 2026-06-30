import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isWolofText, convertWolofToFrenchPhonetics, cleanTextForTTS } from '../utils/phonetics';

const mariamaAvatar = '/mariama_avatar.png';

export default function ChatbotWidget({ lang, setView }) {
  const [chatLang, setChatLang] = useState(lang);
  const [speechLang, setSpeechLang] = useState(lang);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [hasNewMessage, setHasNewMessage] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceProvider, setVoiceProvider] = useState(() => localStorage.getItem('cmu-voice-provider') || 'local');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const recognitionRef = useRef(null);

  // Sync with prop changes
  useEffect(() => {
    setChatLang(lang);
    setSpeechLang(lang);
  }, [lang]);

  const dict = {
    fr: {
      botName: 'Zahara — Assistant IA',
      welcome: 'Bonjour ! 😊 Je suis Zahara, votre assistante intelligente MUTUALIS DAKAR. Je parle Français et Wolof. Comment puis-je vous aider aujourd\'hui ?',
      placeholder: 'Posez votre question à Zahara...',
      suggestNear: 'Quelle est la mutuelle la plus proche ?',
      suggestJoin: 'Comment adhérer en ligne ?',
      suggestCost: 'Combien coûte la cotisation ?',
      suggestHospital: 'Où se trouve l\'hôpital conventionné ?',
      suggestWolof: 'Parlez-moi en Wolof',
      voiceOn: 'Voix activée',
      voiceOff: 'Voix désactivée',
      typing: 'Zahara écrit...',
      online: 'En ligne — Gemini 1.5',
      voiceEngine: 'Voix :',
      voicePremium: 'ElevenLabs',
      voiceOpenSource: 'Open-Source',
      voiceBrowser: 'Navigateur'
    },
    wo: {
      botName: 'Zahara — Woyofal IA',
      welcome: 'Dalal ak jamm ! 😊 Man la Zahara, sa woyofal bu MUTUALIS DAKAR. Mën naa wax Wolof ak Français. Naka la la mëné jafal ?',
      placeholder: 'Bindal sa laaj fii...',
      suggestNear: 'Fan la mutuelle bi ma gënë jege nekk ?',
      suggestJoin: 'Naka laay bokke ci internet ?',
      suggestCost: 'Ñata la fay bi ci at mi ?',
      suggestHospital: 'Fan la fajukaay bu conventionné bi nekk ?',
      suggestWolof: 'Waxal ma ci Wolof',
      voiceOn: 'Baat bi dafa jëm',
      voiceOff: 'Baat bi dafa tëdd',
      typing: 'Zahara mungi bind...',
      online: 'Ci internet — Gemini 1.5',
      voiceEngine: 'Baat :',
      voicePremium: 'ElevenLabs',
      voiceOpenSource: 'Open-Source',
      voiceBrowser: 'Navigateur'
    }
  };

  const t = dict[chatLang] || dict.fr;

  // Initialize welcome message
  useEffect(() => {
    setMessages([
      { sender: 'bot', text: t.welcome }
    ]);
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [chatLang]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 300);
    }
  }, [isOpen]);

  // Stop speech and listening when chat closes
  useEffect(() => {
    if (!isOpen) {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (window.activeAudioChatbot) {
        window.activeAudioChatbot.pause();
        window.activeAudioChatbot = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsSpeaking(false);
      setIsListening(false);
    }
  }, [isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessage(false);
    }
  };

  const fallbackWebSpeech = useCallback((cleanText) => {
    if (!synthRef.current) {
      console.warn('SpeechSynthesis non supporté par ce navigateur.');
      return;
    }
    const isWolof = isWolofText(cleanText);
    const textToSpeak = isWolof ? convertWolofToFrenchPhonetics(cleanText) : cleanText;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = isWolof ? 0.9 : 0.95;
    utterance.pitch = 1.1;
    utterance.volume = 1;
    utterance.lang = 'fr-FR';

    const voices = synthRef.current.getVoices();
    const frenchVoice = voices.find(v => v.lang.startsWith('fr') && v.name.toLowerCase().includes('female'))
      || voices.find(v => v.lang.startsWith('fr'));
    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  // Text-to-Speech function
  const speakText = useCallback((text) => {
    if (!voiceEnabled) return;

    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (window.activeAudioChatbot) {
      window.activeAudioChatbot.pause();
      window.activeAudioChatbot = null;
    }
    setIsSpeaking(false);

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) return;

    if (voiceProvider === 'local') {
      fallbackWebSpeech(cleanText);
    } else {
      setIsSpeaking(true);
      const isWolof = isWolofText(cleanText);
      const langParam = isWolof ? 'wo' : 'fr';
      
      const ttsUrl = `http://localhost:5000/api/tts?text=${encodeURIComponent(cleanText)}&provider=${voiceProvider}&lang=${langParam}`;
      const audio = new Audio(ttsUrl);
      window.activeAudioChatbot = audio;
      
      audio.play()
        .then(() => {
          setIsSpeaking(true);
        })
        .catch(err => {
          console.warn("Échec de la lecture TTS distante, repli sur Web Speech...", err.message);
          fallbackWebSpeech(cleanText);
        });

      audio.onended = () => {
        setIsSpeaking(false);
        window.activeAudioChatbot = null;
      };

      audio.onerror = () => {
        console.warn("Erreur lecture audio TTS distante, repli sur Web Speech...");
        fallbackWebSpeech(cleanText);
      };
    }
  }, [voiceEnabled, voiceProvider, fallbackWebSpeech]);

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (window.activeAudioChatbot) {
      window.activeAudioChatbot.pause();
      window.activeAudioChatbot = null;
    }
    setIsSpeaking(false);
  };

  const startListening = () => {
    if (isSpeaking) {
      stopSpeaking();
    }

    if (!navigator.onLine) {
      alert(chatLang === 'fr' 
        ? "La reconnaissance vocale nécessite une connexion Internet active." 
        : "Déglou baat bi laaj na connexion internet.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(chatLang === 'fr' 
        ? "La reconnaissance vocale n'est pas supportée par votre navigateur." 
        : "Déglou baat bi meunoul liggéey ci sa navigateur.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = speechLang === 'wo' ? 'fr-SN' : 'fr-FR';

      rec.onstart = () => setIsListening(true);
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setInputVal(transcript);
          setTimeout(() => handleSend(transcript, true), 500);
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const toggleListening = () => isListening ? stopListening() : startListening();

  const handleSend = useCallback((textToSend, isVoiceInput = false) => {
    if (!textToSend.trim()) return;

    const detectedIsWolof = isWolofText(textToSend);
    let messageLang = chatLang;

    const cleanMsg = textToSend.toLowerCase().trim();
    if (cleanMsg.includes('en wolof') || cleanMsg.includes('waxal ci wolof') || cleanMsg.includes('parle wolof') || cleanMsg.includes('parler wolof')) {
      messageLang = 'wo';
    } else if (chatLang === 'wo' && !detectedIsWolof) {
      // Do not auto-switch to French if this is a voice input in Wolof mode, to prevent false positive switches due to phonetic misrecognition
      if (!isVoiceInput) {
        const words = textToSend.normalize('NFC').toLowerCase().split(/[^a-zA-Z0-9àéèëñâôîûç'’-]+/);
        const wolofWordsList = [
          'jamm', 'jerejef', 'jërejëf', 'nanga', 'dalal', 'yeneen', 'laaj', 'tontu',
          'firi', 'leeral', 'nuyu', 'fajj', 'fébar', 'fajukaay', 'fajuway', 'wér-gi-yaram',
          'yomb', 'lool', 'bees', 'bopp', 'waaw', 'waw', 'yaw', 'yow', 'tànn',
          'tannal', 'ngir', 'ndakaaru', 'kër', 'léegi', 'liggéey', 'liggeeyal', 'mooy',
          'mën', 'mëna', 'mënë', 'mënu', 'sunu', 'suñu', 'alla', 'wallu', 'xalis',
          'xaalis', 'xam', 'yaram', 'ñaar', 'ñaata', 'ñata', 'ñakk', 'ñent',
          'ñett', 'dëgëral', 'dëgg', 'dëkk', 'bëgg', 'gën', 'gëna', 'gënë', 'gëstu',
          'ndax', 'ndaw', 'ndimbal', 'nekk', 'ñoo', 'ñooy', 'sañ', 'sàkk',
          'seet', 'seetal', 'soxna', 'tëdd', 'wacc', 'wàññi', 'weer', 'wér', 'wuti',
          'xéwal', 'xévale', 'xéwalé', 'yakaar', 'yakk', 'yeugle', 'dimbali', 'faye',
          'ak', 'yi', 'gi', 'wi', 'ngi', 'lay', 'ngeen', 'nga', 'gnu', 'gu', 'bu', 'yu', 'ci',
          'wax', 'waxal', 'waxe', 'di', 'na', 'da', 'dama', 'danga', 'dafa', 'dañu', 'laajal', 
          'tontul', 'faj', 'paj', 'faju', 'fajjuku', 'mangi', 'yangi', 'mungi', 'nongi', 'ñoongi',
          'la', 'ma', 'salam', 'salaam', 'salamalekoum', 'salamalékoum', 'def', 'defal', 'sama', 'samay'
        ];
        const frenchWordsList = [
          'le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'est', 'a', 'à',
          'pour', 'dans', 'par', 'sur', 'avec', 'sans', 'sous', 'ce', 'cette', 'ces',
          'mon', 'mes', 'ton', 'ta', 'tes', 'son', 'ses', 'notre', 'votre', 'leur',
          'nos', 'vos', 'leurs', 'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
          'se', 'y', 'ne', 'pas', 'plus', 'tout', 'tous', 'toute', 'toutes', 'mais', 'ou',
          'donc', 'or', 'ni', 'car', 'si', 'bien', 'très', 'alors', 'qui', 'que', 'quoi',
          'dont', 'où', 'comment', 'pourquoi', 'quand', 'quel', 'quelle', 'quels', 'quelles',
          'oui', 'non', 'merci', 'bonjour', 'salut', 'monsieur', 'madame', 'mademoiselle',
          'sante', 'santé', 'mutuelle', 'mutuelles', 'cotisation', 'cotisations', 'adhésion',
          'adhesion', 'inscription', 'structures', 'conventionné', 'conventionnée', 'prise',
          'charge', 'frais', 'remboursement', 'taux', 'assistant', 'assistante', 'officiel',
          'officielle', 'portail', 'régional', 'régionale', 'sénégal', 'senegal'
        ];
        const hasWolofIndicator = words.some(w => w && (wolofWordsList.includes(w) || w.includes('ë') || w.includes('ñ')));
        const hasFrenchIndicator = words.some(w => w && frenchWordsList.includes(w));
        
        if (!hasWolofIndicator && hasFrenchIndicator) {
          messageLang = 'fr';
        }
      }
    } else if (chatLang === 'fr' && detectedIsWolof) {
      // Current language is French, but text is detected as Wolof.
      // Switch to Wolof since the user is starting to type in Wolof.
      messageLang = 'wo';
    }

    if (messageLang !== chatLang) {
      setChatLang(messageLang);
      setSpeechLang(messageLang);
    }

    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    const historyForAPI = messages.slice(-10).map(m => ({
      sender: m.sender,
      text: m.text
    }));

    fetch('http://localhost:5000/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: textToSend, lang: messageLang, history: historyForAPI, isVoiceInput })
    })
    .then(res => res.json())
    .then(data => {
      setIsTyping(false);
      if (data.response) {
        const botMsg = { sender: 'bot', text: data.response };
        if (data.decodedText) {
          setMessages(prev => {
            const next = [...prev];
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].sender === 'user') {
                next[i].text = data.decodedText;
                break;
              }
            }
            return [...next, botMsg];
          });
        } else {
          setMessages(prev => [...prev, botMsg]);
        }
        speakText(data.response);
      } else {
        throw new Error('No response');
      }
    })
    .catch(err => {
      setIsTyping(false);
      const botResponse = generateLocalResponse(textToSend, messageLang);
      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
      speakText(botResponse);
    });
  }, [messages, chatLang, speakText]);

  const generateLocalResponse = (userText, detectedLang) => {
    const text = userText.toLowerCase().trim();
    const isWolof = isWolofText(text) || detectedLang === 'wo';

    if (isWolof) {
      if (text.includes('bopp') || text.includes('fébar') || text.includes('malade')) {
        return "Mutuelle de santé day fajj sa fébar. Boo bokkee, mutuelle bi day fay 50% ba 80%. Fayal sa cotisation tey ngir wér-gi-yaram ! 💪";
      }
      if (text.includes('naka') || text.includes('bokk') || text.includes('adhérer')) {
        return "Ngir bokk ci mutuelle, cuq bouton 'Services en ligne', tan 'Nouvelle adhésion'. Bind sa tour, sa sant, dugal sa photo ak sa carte d'identité. Yomb na lool ! 📝";
      }
      if (text.includes('ñata') || text.includes('combien') || text.includes('cotisation')) {
        return "Formule Individuel: 4 500 FCFA ci at mi. Formule Familial: 1 000 FCFA ngir carte bi + 3 500 FCFA par membre ci at mi. Mën nga fay ci Orange Money walla Wave. 💰";
      }
      return "Jërejëf ! Man la Zahara, woyofal bu MUTUALIS DAKAR. Mën nga ma laaj lépp ci mutuelles yi, fay sa cotisation walla fajukaay yi. 🙏";
    }

    if (text.includes('proche') || text.includes('adresse') || text.includes('localiser')) {
      return "Pour trouver la mutuelle la plus proche, consultez l'onglet 'Cartographie'. Nous couvrons Médina, Pikine, Guédiawaye, Keur Massar et Rufisque. 📍";
    }
    if (text.includes('adhérer') || text.includes('inscrire') || text.includes('rejoindre')) {
      return "L'adhésion se fait en 8 étapes simples via 'Services en Ligne' > 'Nouvelle Adhésion'. Paiement sécurisé par Orange Money ou Wave. 📝";
    }
    if (text.includes('cotisation') || text.includes('prix') || text.includes('combien')) {
      return "Formule individuelle : 4 500 FCFA/an. Formule Familiale : 1 000 FCFA pour la carte + 3 500 FCFA par membre. Prise en charge de 50% à 80%. 💰";
    }
    return "Bonjour ! 😊 Je suis Zahara, votre assistante MUTUALIS DAKAR. Comment puis-je vous aider ?";
  };

  const escalateToHuman = () => {
    const userMsg = { sender: 'user', text: chatLang === 'fr' ? 'Je souhaite parler à un conseiller.' : 'Dama beugue wajal ak conseiller.' };
    setMessages(prev => [...prev, userMsg]);
    
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: chatLang === 'fr' ? 'Demande de transfert prise en compte... Connexion en cours avec un conseiller URMSCD 👥' : 'Dañu lay jokkoo ak conseiller bu MUTUALIS DAKAR 👥' 
      }]);
    }, 1000);

    setTimeout(() => {
      const msg = lang === 'fr' ? 'Bonjour ! Ici Ousmane Kane, conseiller client URMSCD. Comment puis-je vous aider ?' : 'Dalal ak jamm ! Man la Ousmane Kane, conseiller URMSCD. Naka la la mëné jafal ?';
      setMessages(prev => [...prev, { sender: 'bot', text: msg }]);
      speakText(msg);
    }, 2500);
  };

  // Woman silhouette SVG for the toggle button
  const WomanSilhouette = () => (
    <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Head */}
      <circle cx="32" cy="16" r="10" fill="currentColor"/>
      {/* Hair flowing */}
      <path d="M22 14C22 14 20 8 24 4C28 0 36 0 40 4C44 8 42 14 42 14" stroke="currentColor" strokeWidth="2" fill="currentColor"/>
      <path d="M22 14C20 18 18 24 20 26C22 28 22 16 22 14Z" fill="currentColor"/>
      <path d="M42 14C44 18 46 24 44 26C42 28 42 16 42 14Z" fill="currentColor"/>
      {/* Neck */}
      <rect x="29" y="26" width="6" height="4" rx="2" fill="currentColor"/>
      {/* Body/Dress */}
      <path d="M20 60L26 32H38L44 60H20Z" fill="currentColor" rx="4"/>
      {/* Shoulders */}
      <path d="M26 32C26 32 22 33 18 36C16 38 16 42 16 42L22 40L26 34Z" fill="currentColor"/>
      <path d="M38 32C38 32 42 33 46 36C48 38 48 42 48 42L42 40L38 34Z" fill="currentColor"/>
      {/* Headscarf/wrap accent */}
      <path d="M23 10C23 10 26 6 32 6C38 6 41 10 41 10C41 10 38 8 32 8C26 8 23 10 23 10Z" fill="rgba(255,255,255,0.3)"/>
      {/* Smile indicator */}
      <path d="M28 19C28 19 30 21 32 21C34 21 36 19 36 19" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" fill="none"/>
      {/* Necklace */}
      <ellipse cx="32" cy="28" rx="5" ry="2" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" fill="none"/>
    </svg>
  );

  return (
    <div className="chatbot-container">
      {/* Toggle Button — Zahara Avatar Image */}
      <button className="chatbot-toggle" onClick={toggleChat} aria-label="Parler avec Zahara" style={{ padding: 0, overflow: 'hidden' }}>
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <img src={mariamaAvatar} alt="Zahara" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        )}
        {hasNewMessage && !isOpen && <span className="notification-dot"></span>}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window glass-effect">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-brand">
              <div className="chatbot-avatar" style={{ overflow: 'hidden' }}>
                <img src={mariamaAvatar} alt="Zahara" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="chatbot-info">
                <h4>{t.botName}</h4>
                <span>{t.online}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Voice Toggle */}
              <button 
                className="chatbot-voice-btn" 
                onClick={() => {
                  if (isSpeaking) {
                    stopSpeaking();
                  } else {
                    setVoiceEnabled(!voiceEnabled);
                  }
                }}
                title={voiceEnabled ? t.voiceOn : t.voiceOff}
                aria-label="Toggle voice"
              >
                {isSpeaking ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                    <rect x="14" y="4" width="4" height="16" rx="1"></rect>
                  </svg>
                ) : voiceEnabled ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                  </svg>
                )}
              </button>
              <button className="chatbot-close" onClick={toggleChat} aria-label="Fermer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Sub-header or Settings bar */}
          {voiceEnabled && (
            <div className="chatbot-settings-bar" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.4rem 1rem',
              backgroundColor: 'rgba(5, 150, 105, 0.08)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              <span>{t.voiceEngine}</span>
              <select 
                value={voiceProvider}
                onChange={(e) => {
                  const val = e.target.value;
                  setVoiceProvider(val);
                  localStorage.setItem('cmu-voice-provider', val);
                  if (isSpeaking) {
                    stopSpeaking();
                  }
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="local">{t.voiceBrowser}</option>
                <option value="elevenlabs">{t.voicePremium}</option>
                <option value="opensource">{t.voiceOpenSource}</option>
              </select>
            </div>
          )}

          {/* Messages body */}
          <div className="chatbot-messages">
            {messages.map((m, idx) => (
              <div key={idx} className={`chatbot-msg ${m.sender}`}>
                {m.sender === 'bot' && (
                  <div className="chatbot-msg-header">
                    <span className="chatbot-msg-name">Zahara</span>
                    {/* Individual message speak button */}
                    <button 
                      className="chatbot-msg-speak"
                      onClick={() => speakText(m.text)}
                      title="Écouter"
                      aria-label="Écouter ce message"
                    >
                      🔊
                    </button>
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
              </div>
            ))}
            
            {/* Typing indicator */}
            {isTyping && (
              <div className="chatbot-msg bot">
                <div className="chatbot-msg-header">
                  <span className="chatbot-msg-name">Zahara</span>
                </div>
                <div className="chatbot-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Suggestions footer */}
          <div style={{ padding: '0 0.75rem', backgroundColor: 'var(--card-bg)' }}>
            <div className="chatbot-suggestions" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', paddingBottom: '0.5rem' }}>
              <button className="suggestion-btn" onClick={() => handleSend(t.suggestNear)}>{chatLang === 'fr' ? '📍 La plus proche' : '📍 Gënë jege'}</button>
              <button className="suggestion-btn" onClick={() => handleSend(t.suggestJoin)}>{chatLang === 'fr' ? '📝 Adhérer' : '📝 Bokk'}</button>
              <button className="suggestion-btn" onClick={() => handleSend(t.suggestCost)}>{chatLang === 'fr' ? '💰 Tarifs' : '💰 Ñata'}</button>
              <button className="suggestion-btn" onClick={escalateToHuman}>{chatLang === 'fr' ? '👥 Conseiller' : '👥 Conseiller'}</button>
              <button className="suggestion-btn" onClick={() => handleSend(t.suggestWolof)}>🇸🇳 Wolof</button>
            </div>
          </div>

          {/* Input field */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(inputVal); }} 
            className="chatbot-input-area"
          >
            {/* Microphone Button */}
            <button 
              type="button" 
              className={`chatbot-mic ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              title={isListening ? (chatLang === 'fr' ? 'Écoute active... Cliquez pour stopper' : 'Mungi déglu... Cuq ngir teggi') : (chatLang === 'fr' ? 'Parler par voix' : 'Waxal ci baat')}
              aria-label="Microphone"
            >
              {isListening ? (
                <span className="mic-pulse"></span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              )}
            </button>

            {/* Language toggle button next to mic */}
            <button
              type="button"
              className={`chatbot-lang-toggle ${speechLang}`}
              onClick={() => {
                const newLang = speechLang === 'fr' ? 'wo' : 'fr';
                setSpeechLang(newLang);
                setChatLang(newLang);
              }}
              title={chatLang === 'fr' ? "Changer la langue d'écoute (Français / Wolof)" : 'Soppi lakku déglu bi (Wolof / Français)'}
            >
              {speechLang.toUpperCase()}
            </button>

            <input 
              ref={inputRef}
              type="text" 
              className="chatbot-input" 
              placeholder={isListening ? (chatLang === 'fr' ? "Écoute en cours..." : "Mungi lay déglu...") : t.placeholder}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isListening}
            />
            <button type="submit" className="chatbot-send" aria-label="Envoyer" disabled={!inputVal.trim() || isListening}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
