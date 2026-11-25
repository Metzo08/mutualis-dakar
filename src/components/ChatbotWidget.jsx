import { useState, useEffect, useRef, useCallback } from 'react';
import { isWolofText, cleanTextForTTS, decodeWolofSpeechInput, looksLikeMisheardWolof } from '../utils/phonetics';
import { speakCleanText, stopAllVoicePlayback, primeAudioPlayback } from '../services/voiceAudioService';
import VoiceCloudOrb from './VoiceCloudOrb';
import ProIcon from './ProIcon';

const mariamaAvatar = '/mariama_avatar.png';

// Base de données de vérification instantanée des médicaments et actes CMU/UNAMUSC
const COVERAGE_DATABASE = [
  { name: 'Paracétamol', dci: 'Paracétamol 500mg / 1g', covered: true, rate: 50, category: 'Antalgique / Fièvre', desc: 'Pris en charge à 50% sur bon de commande pharmacie (UNAMUSC 50% / Assuré 50%).' },
  { name: 'Amoxicilline', dci: 'Amoxicilline 500mg / 1g (gélules & sirop)', covered: true, rate: 50, category: 'Antibiotique', desc: 'Antibiotique essentiel couvert à 50% en officine agréée sur ordonnance (50% restant assuré).' },
  { name: 'Ibuprofène', dci: 'Ibuprofène 200mg / 400mg', covered: true, rate: 50, category: 'Anti-inflammatoire', desc: 'Pris en charge à 50% sur bon de commande en pharmacie conventionnée (50% assuré).' },
  { name: 'Insuline', dci: 'Insuline humaine rapide / Nph', covered: true, rate: 50, category: 'Diabète', desc: 'Traitement du diabète pris en charge à 50% par l\'UNAMUSC (50% assuré).' },
  { name: 'Metformine', dci: 'Metformine 500mg / 850mg / 1000mg', covered: true, rate: 50, category: 'Diabète', desc: 'Antidiabétique oral de première intention, couvert à 50% sur bon de commande pharmacie.' },
  { name: 'Amlodipine', dci: 'Amlodipine 5mg / 10mg', covered: true, rate: 50, category: 'Cardiologie / HTA', desc: 'Antihypertenseur de référence couvert à 50% en pharmacie.' },
  { name: 'Ciprofloxacine', dci: 'Ciprofloxacine 500mg', covered: true, rate: 50, category: 'Antibiotique', desc: 'Fluoroquinolone antibiotique couverte à 50% sur bon de commande.' },
  { name: 'Oméprazole', dci: 'Oméprazole 20mg (Gélules)', covered: true, rate: 50, category: 'Gastro-entérologie', desc: 'Traitement anti-ulcéreux et reflux gastrique, pris en charge à 50%.' },
  { name: 'Azithromycine', dci: 'Azithromycine 250mg / 500mg', covered: true, rate: 50, category: 'Antibiotique', desc: 'Macrolide antibiotique pris en charge à 50% sur ordonnance.' },
  { name: 'Act paludisme', dci: 'Artéméther + luméfantrine (act)', covered: true, rate: 100, category: 'Antipaludéen', desc: 'Traitement du paludisme simple pris en charge à 100% (gratuité pnlp).' },
  { name: 'Fer + acide folique', dci: 'Sulfate ferreux + acide folique', covered: true, rate: 100, category: 'Maternité / Grossesse', desc: 'Supplémentation de grossesse prise en charge à 100% (gratuité maternité).' },
  { name: 'Sérum physiologique', dci: 'Chlorure de sodium 0.9%', covered: true, rate: 50, category: 'Soins / Pédiatrie', desc: 'Couvert à 50% en pharmacie (ou 100% pour les nourrissons de moins de 5 ans).' },
  { name: 'Compléments alimentaires', dci: 'Vitamines de confort / Fortifiants sans ordonnance', covered: false, rate: 0, category: 'Confort / Parapharmacie', desc: 'Non pris en charge par le panier officiel des soins CSU (100% à la charge du patient).' },
  { name: 'Chirurgie esthétique', dci: 'Actes esthétiques de confort non reconstructeurs', covered: false, rate: 0, category: 'Chirurgie de confort', desc: 'Non pris en charge par les garanties mutualistes UNAMUSC.' },
  { name: 'Implants dentaires de luxe', dci: 'Prothèses dentaires cosmétiques haut de gamme', covered: false, rate: 0, category: 'Dentaire cosmétique', desc: 'Non pris en charge (seuls les soins dentaires de base sont couverts).' }
];

// Structures sanitaires clés de Dakar
const SANITARY_STRUCTURES = [
  { id: 1, name: 'Hôpital Principal de Dakar', type: 'hospital', typeLabel: 'Hôpital militaire & public', rate: '80% Lettre de Garantie', commune: 'Dakar Plateau', address: 'Avenue nelson mandela', phone: '+221 33 839 50 50', hours: '24h/24' },
  { id: 2, name: 'CHU de Fann (Dakar)', type: 'hospital', typeLabel: 'Centre hospitalier universitaire', rate: '80% Lettre de Garantie', commune: 'Fann-Point E', address: 'Avenue Cheikh anta Diop', phone: '+221 33 869 18 18', hours: '24h/24' },
  { id: 3, name: 'Hôpital Aristide Le Dantec', type: 'hospital', typeLabel: 'Centre hospitalier universitaire', rate: '80% Lettre de Garantie', commune: 'Dakar Plateau', address: 'Avenue pasteur', phone: '+221 33 889 38 00', hours: '24h/24' },
  { id: 4, name: 'CHU Abass Ndao', type: 'hospital', typeLabel: 'Centre hospitalier universitaire', rate: '80% Lettre de Garantie', commune: 'Gueule Tapée', address: 'Avenue Cheikh anta Diop', phone: '+221 33 849 78 00', hours: '24h/24' },
  { id: 5, name: 'Hôpital Dalal Jamm', type: 'hospital', typeLabel: 'Hôpital national', rate: '80% Lettre de Garantie', commune: 'Guédiawaye', address: 'Voie de contournement', phone: '+221 33 879 40 40', hours: '24h/24' },
  { id: 6, name: 'Pharmacie du Plateau', type: 'pharmacy', typeLabel: 'Pharmacie agréée UNAMUSC', rate: '50% Bon de Commande', commune: 'Dakar Plateau', address: 'Avenue Albert sarraut', phone: '+221 33 823 23 23', hours: '24h/24' },
  { id: 7, name: 'Pharmacie guigon', type: 'pharmacy', typeLabel: 'Pharmacie agréée UNAMUSC', rate: '50% Bon de Commande', commune: 'Dakar Plateau', address: '1 Avenue Georges Pompidou', phone: '+221 33 823 03 33', hours: '24h/24' },
  { id: 8, name: 'MSD Dakar Plateau', type: 'msd', typeLabel: 'Bureau départemental MSD', rate: 'Coordination & adhésion', commune: 'Dakar Plateau', address: 'Immeuble municipal, Dakar', phone: '+221 33 821 10 10', hours: '8h-16h' }
];

export default function ChatbotWidget({ lang, setView }) {
  // Langue active (par défaut Wolof pour authenticité sénégalaise)
  const [chatLang, setChatLang] = useState('auto');
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // Mode d'interaction : 'voice' (Nuage Orb animé 3D) ou 'text' (Conversation écrite)
  const [interactionMode, setInteractionMode] = useState('voice');
  
  // Audio analyser pour rythmer le nuage vocal
  const [audioLevel, setAudioLevel] = useState(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const pulseIntervalRef = useRef(null);

  // Derniers échanges pour affichage en mode Nuage
  const [lastUserSpeech, setLastUserSpeech] = useState('');
  const [lastBotReply, setLastBotReply] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isListeningRef = useRef(false);
  const voiceAbortRef = useRef(false);
  const isHandlingSendRef = useRef(false);
  const handleSendRef = useRef(null);
  const startListeningRef = useRef(null);
  const didInitMessagesRef = useRef(false);
  const accumulatedTranscriptRef = useRef('');
  const silenceTimeoutRef = useRef(null);

  // Dictionnaire trilingue (Auto / Wolof / Français / English)
  const dict = {
    auto: {
      botName: 'Zahara',
      roleBadge: 'Auto · WO / FR / EN',
      voiceButton: 'Parler · Wax',
      voiceListening: "Arrêter l'écoute",
      textButton: 'Écrire · Bind',
      backToVoice: 'Nuage vocal / Orb',
      placeholder: 'Wolof, Français, english...',
      send: 'Envoyer',
      listeningState: 'Zahara vous écoute (WO / FR / EN)...',
      speakingState: 'Zahara vous répond...',
      thinkingState: 'Réflexion en cours...',
      idleState: 'Parlez ou écrivez (Wolof, Français, english)',
      welcomeMsg: 'Na nga def ! Bonjour ! Je suis Zahara (auto : Wolof, Français, english). Waxal walla bindal ci làkk bi la neex !'
    },
    en: {
      botName: 'Zahara',
      roleBadge: 'CSU health advisor (senegal)',
      voiceButton: 'Speak out loud',
      voiceListening: 'Stop listening',
      textButton: 'Write a message',
      backToVoice: 'Voice orb',
      placeholder: 'Ask your question here...',
      send: 'Send',
      listeningState: 'Zahara is listening...',
      speakingState: 'Zahara is speaking...',
      thinkingState: 'Thinking...',
      idleState: 'Speak out loud or type your question',
      welcomeMsg: 'Hello! I am Zahara, your SenMutuelles assistant. How can i help you with your health coverage today?'
    },
    wo: {
      botName: 'Zahara',
      roleBadge: 'Ndawu CSU bi (Sénégal)',
      voiceButton: 'Waxal ci kaw',
      voiceListening: 'Arrêter / Dajjeel',
      textButton: 'Bindal / Clavier',
      backToVoice: 'Nuage vocal / Orb',
      placeholder: 'Bindal sa laaj fi...',
      send: 'Yónnee',
      listeningState: 'Zahara màngi lay déglu...',
      speakingState: 'Zahara màngi lay tontu...',
      thinkingState: 'Màngi xalaat...',
      idleState: 'Waxal ci sa bopp walla nga bind',
      welcomeMsg: 'Na nga def ! Man la Zahara, sa agent personnel bu SenMutuelles. Naka la la mënee dimbali tey ci sa wér-gi-yaram ?'
    },
    fr: {
      botName: 'Zahara',
      roleBadge: 'Conseillère santé CSU (Sénégal)',
      voiceButton: 'Parler à haute voix',
      voiceListening: 'Arrêter l\'écoute',
      textButton: 'Écrire un message',
      backToVoice: 'Nuage vocal / Orb',
      placeholder: 'Posez votre question ici...',
      send: 'Envoyer',
      listeningState: 'Zahara vous écoute...',
      speakingState: 'Zahara vous répond...',
      thinkingState: 'En cours de réflexion...',
      idleState: 'Parlez à haute voix ou écrivez votre question',
      welcomeMsg: 'Bonjour ! Je suis Zahara, votre assistante SenMutuelles. Comment puis-je vous accompagner concernant votre santé et vos droits CSU aujourd\'hui ?'
    }
  };

  const t = dict[chatLang] || dict.auto;

  // Initialisation du premier message
  useEffect(() => {
    if (!didInitMessagesRef.current) {
      didInitMessagesRef.current = true;
      const initial = t.welcomeMsg;
      setMessages([{ sender: 'bot', text: initial, isWelcome: true }]);
      setLastBotReply(initial);
    }
  }, [t.welcomeMsg]);

  // Défilement automatique dans la liste des messages
  useEffect(() => {
    if (interactionMode === 'text') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, interactionMode]);

  // Gestion du volume audio simulé quand Zahara parle
  useEffect(() => {
    if (isSpeaking) {
      pulseIntervalRef.current = setInterval(() => {
        setAudioLevel(0.25 + Math.sin(Date.now() / 140) * 0.2 + (Math.random() * 0.15));
      }, 70);
    } else if (!isListening) {
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
      setAudioLevel(0);
    }
    return () => {
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
    };
  }, [isSpeaking, isListening]);

  // Démarrage de l'analyseur micro réel + détection de parole (VAD)
  const startMicAudioMeter = async (existingStream = null, vadCallbacks = null) => {
    try {
      const stream = existingStream || micStreamRef.current || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      micStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') { await ctx.resume().catch(() => {}); }
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let speechStartedAt = 0;
      let lastLoudAt = Date.now();
      const listenStartedAt = Date.now();

      const updateLevel = () => {
        if (!analyserRef.current || !isListeningRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(1.0, (avg / 128) * 1.5));

        if (vadCallbacks) {
          const now = Date.now();
          if ((now - listenStartedAt) > 180 && avg > 8) {
            if (!speechStartedAt) speechStartedAt = now;
            lastLoudAt = now;
          }
          // Fin de phrase détectée : parole > 350ms suivie de 950ms de silence
          if (speechStartedAt && (now - speechStartedAt) > 320 && (now - lastLoudAt) > 1500) {
            vadCallbacks.onSilenceAfterSpeech();
            return;
          }
          // Sécurité : si aucun son après 7s ou enregistrement > 12s
          if ((!speechStartedAt && (now - listenStartedAt) > 7000) || (now - listenStartedAt) > 15000) {
            vadCallbacks.onTimeout(!speechStartedAt);
            return;
          }
        }
        requestAnimationFrame(updateLevel);
      };
      requestAnimationFrame(updateLevel);
    } catch (e) {
      console.warn('Microphone meter warning:', e.message);
    }
  };

  const stopMicAudioMeter = () => {
    isListeningRef.current = false;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Synthèse vocale de Zahara
  const speakText = useCallback((text, onEnd, forcedLang = null) => {
    if (!voiceEnabled) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const isWolof = forcedLang
      ? (forcedLang === 'wo' || forcedLang === 'wolof')
      : (chatLang === 'wo' || isWolofText(cleanText));
    const langParam = isWolof
      ? 'wolof'
      : (forcedLang === 'en' || (!forcedLang && chatLang === 'en'))
        ? 'en'
        : 'fr';

    speakCleanText(
      cleanText,
      langParam,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      }
    );
  }, [voiceEnabled, chatLang]);

  const stopSpeaking = () => {
    stopAllVoicePlayback();
    setIsSpeaking(false);
  };

  // Envoi de message (Voix ou Texte)
  const handleSend = useCallback((textToSend, isVoiceInput = false) => {
    if (!textToSend || !String(textToSend).trim()) return;
    textToSend = String(textToSend).trim();

    primeAudioPlayback();
    stopSpeaking();

    // Enregistre pour affichage direct sous le nuage
    setLastUserSpeech(textToSend);
    const userMsg = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    const historyForAPI = messages.slice(-6).map(m => ({
      sender: m.sender,
      text: m.text
    }));

    const apiUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:5000';

    fetch(`${apiUrl}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: textToSend,
        lang: chatLang,
        history: historyForAPI,
        isVoiceInput: isVoiceInput
      }),
      signal: AbortSignal.timeout(12000)
    })
    .then(res => res.json())
    .then(data => {
      setIsTyping(false);
      if (data.response) {
        // Si le backend a reconstruit le vrai Wolof, corriger la bulle de l'utilisateur
        if (data.decodedText && data.decodedText.trim()) {
          const refined = data.decodedText.trim();
          setLastUserSpeech(refined);
          setMessages(prev => {
            const copy = [...prev];
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].sender === 'user') {
                copy[i] = { ...copy[i], text: refined };
                break;
              }
            }
            return copy;
          });
        }

        const botMsg = { sender: 'bot', text: data.response };
        setMessages(prev => [...prev, botMsg]);
        setLastBotReply(data.response);

        // Lit la réponse à haute voix dans la langue détectée (WO / FR / EN)
        speakText(data.response, () => {
          // Si nous sommes en mode vocal interactif, on peut réactiver l'écoute pour continuer la discussion
          if (isVoiceInput && interactionMode === 'voice') {
            setTimeout(() => {
              if (startListeningRef.current) startListeningRef.current();
            }, 500);
          }
        }, data.replyLang || null);
      }
    })
    .catch((err) => {
      setIsTyping(false);
      console.warn("Erreur chatbot:", err.message);
      const fallbackMsg = chatLang === 'wo' 
        ? "Jërëjëf ! Mën nga fay 4500 FCFA ci CSU ngir jot 50% ci pharmacie ak 80% ci hôpitaux." 
        : "Merci ! Votre mutuelle SenMutuelles prend en charge 50% en pharmacie et 80% à l'hôpital pour 4 500 FCFA/an.";
      setMessages(prev => [...prev, { sender: 'bot', text: fallbackMsg }]);
      setLastBotReply(fallbackMsg);
      speakText(fallbackMsg);
    });
  }, [messages, chatLang, interactionMode, speakText]);

  handleSendRef.current = handleSend;

  // Finalise et envoie la parole enregistrée sans coupure prématurée ni faux bruits
  const finalizeAndSendSpeech = useCallback((forceSend = false) => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    let textToSend = (accumulatedTranscriptRef.current || '').trim();
    accumulatedTranscriptRef.current = '';

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    stopMicAudioMeter();

    if (!textToSend) return;

    // Filtrer les micro-bruits parasites (ex: un claquement ou "la", "si" isolé) si ce n'est pas validé manuellement
    if (!forceSend) {
      const words = textToSend.split(/\s+/).filter(Boolean);
      const isNoise = words.length === 1 && ['la', 'le', 'un', 'si', 'de', 'ah', 'oh', 'euh'].includes(textToSend.toLowerCase());
      if (isNoise || textToSend.length < 3) {
        console.log('[STT] Bruit isolé ignoré pour auto-send:', textToSend);
        return;
      }
    }

    // Normalisation intelligente : si l'usager a seulement prononcé le nom ou une amorce courte
    const lower = textToSend.toLowerCase().replace(/[^a-zA-Z]/g, '');
    if (['zara', 'zahara', 'zaralyon', 'sarah', 'allo', 'all', 'booba'].includes(lower)) {
      textToSend = (chatLang === 'wo' || chatLang === 'auto') ? "Zahara, nanga def ?" : chatLang === 'en' ? "Hello Zahara!" : "Bonjour Zahara !";
    }

    setLastUserSpeech(textToSend);
    handleSendRef.current(textToSend, true);
  }, [chatLang]);

  // Convertit l'audio enregistré en WAV 16kHz mono propre (0 échec décodage + compatible HuBERT Wolof & Whisper)
  const blobToWav16kOrRaw = async (blob, fallbackMime) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const arrBuf = await blob.arrayBuffer();
      const decCtx = new AudioCtx();
      let audioBuf;
      try { audioBuf = await decCtx.decodeAudioData(arrBuf); } finally { decCtx.close().catch(() => {}); }
      const targetRate = 16000;
      const numFrames = Math.max(1, Math.ceil(audioBuf.duration * targetRate));
      const offline = new OfflineAudioContext(1, numFrames, targetRate);
      const src = offline.createBufferSource();
      src.buffer = audioBuf;
      src.connect(offline.destination);
      src.start(0);
      const rendered = await offline.startRendering();
      const samples = rendered.getChannelData(0);
      const wavBuf = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(wavBuf);
      const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
      writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE');
      writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true);
      for (let i = 0, off = 44; i < samples.length; i++, off += 2) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      const bytes = new Uint8Array(wavBuf);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return { base64Audio: btoa(bin), finalMime: 'audio/wav' };
    } catch {
      const rawB64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return { base64Audio: rawB64, finalMime: fallbackMime || 'audio/webm' };
    }
  };

  // Envoi d'un enregistrement audio réel (Auto/WO/EN : HuBERT Wolof + Whisper trilingue)
  const sendRecordedWolofAudio = async (blob, mimeType) => {
    if (!blob || blob.size < 1800) { setIsTyping(false); setLastUserSpeech(''); return; }
    setIsTyping(true);
    setLastUserSpeech('...');

    try {
      const { base64Audio, finalMime } = await blobToWav16kOrRaw(blob, mimeType);

      const historyForAPI = messages.slice(-6).map(m => ({
        sender: m.sender,
        text: m.text
      }));
      const apiUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:5000';

      const res = await fetch(`${apiUrl}/api/chatbot/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType: finalMime || 'audio/wav',
          lang: chatLang,
          history: historyForAPI
        }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      setIsTyping(false);
      if (data.silentRetry) { setLastUserSpeech(''); return; }

      const userShown = (data.decodedText || data.transcript || '').trim();
      if (userShown) {
        setLastUserSpeech(userShown);
        setMessages(prev => [...prev, { sender: 'user', text: userShown }]);
      } else {
        setLastUserSpeech('');
      }

      if (data.response) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.response }]);
        setLastBotReply(data.response);
        speakText(data.response, () => {
          if (userShown && interactionMode === 'voice') {
            setTimeout(() => {
              if (startListeningRef.current) startListeningRef.current();
            }, 450);
          }
        }, data.replyLang || null);
      }
    } catch (err) {
      setIsTyping(false);
      console.warn('Erreur envoi vocal Wolof:', err.message);
      const fallback = "Dégguma bu baax sa wax ji. Mën nga ma laaj ci wallu tarifs, hôpitaux, pharmacie, maternité walla CSU. Lan nga bëgg xam ?";
      setLastBotReply(fallback);
      speakText(fallback);
    }
  };

  // Reconnaissance Vocale :
  // - En WOLOF : capture audio réelle (MediaRecorder + VAD) -> Whisper Wolof serveur
  // - En FRANÇAIS : Chrome Web Speech natif (fr-FR)
  const startListening = async () => {
    primeAudioPlayback();
    stopSpeaking();
    accumulatedTranscriptRef.current = '';
    voiceAbortRef.current = false;

    if (chatLang === 'wo' || chatLang === 'auto' || chatLang === 'en') {
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try { mediaRecorderRef.current.stop(); } catch (e) {}
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        micStreamRef.current = stream;
        audioChunksRef.current = [];

        const mimeType = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            audioChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = () => {
          setIsListening(false);
          stopMicAudioMeter();
          const aborted = voiceAbortRef.current;
          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          if (!aborted && chunks.length > 0) {
            const blob = new Blob(chunks, { type: mimeType });
            sendRecordedWolofAudio(blob, mimeType);
          }
        };

        isListeningRef.current = true;
        setIsListening(true);
        recorder.start();
        startMicAudioMeter(stream, {
          onSilenceAfterSpeech: () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          },
          onTimeout: (wasSilent) => {
            if (wasSilent) voiceAbortRef.current = true;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
          }
        });
      } catch (err) {
        console.warn('Micro Wolof indisponible:', err.message);
        setIsListening(false);
        stopMicAudioMeter();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Votre navigateur ne supporte pas la reconnaissance vocale Web Speech.");
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = 'fr-FR';

    rec.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      startMicAudioMeter();
    };

    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      let hasFinal = false;
      for (let i = 0; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript + ' ';
          hasFinal = true;
        } else {
          interim += e.results[i][0].transcript;
        }
      }

      const fullText = (final + interim).trim();
      if (fullText) {
        accumulatedTranscriptRef.current = fullText;
        setLastUserSpeech(fullText);

        const waitMs = hasFinal ? 300 : 700;
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          finalizeAndSendSpeech(false);
        }, waitMs);
      }
    };

    rec.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      if (e.error !== 'no-speech') {
        setIsListening(false);
        stopMicAudioMeter();
      }
    };

    rec.onend = () => {
      if (accumulatedTranscriptRef.current && accumulatedTranscriptRef.current.trim().length >= 2) {
        finalizeAndSendSpeech(true);
      } else {
        setIsListening(false);
        stopMicAudioMeter();
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
    } catch (e) {
      console.warn('SpeechRecognition start failed:', e.message);
      setIsListening(false);
      stopMicAudioMeter();
    }
  };

  startListeningRef.current = startListening;

  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      voiceAbortRef.current = false;
      mediaRecorderRef.current.stop();
      return;
    }
    if (accumulatedTranscriptRef.current && accumulatedTranscriptRef.current.trim().length >= 2) {
      finalizeAndSendSpeech(false);
    } else {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      stopMicAudioMeter();
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleChat = () => {
    if (!isOpen) {
      primeAudioPlayback();
      setIsOpen(true);
      setHasNewMessage(false);
    } else {
      stopSpeaking();
      stopListening();
      setIsOpen(false);
    }
  };

  return (
    <div className="chatbot-widget-container" style={{ position: 'fixed', right: '20px', bottom: '20px', zIndex: 99999 }}>
      {/* Bouton Flottant Déclencheur avec Avatar Zahara */}
      <button
        type="button"
        className="chatbot-toggle-button"
        onClick={toggleChat}
        aria-label="Ouvrir Zahara"
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          border: '2.5px solid #10b981',
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
          boxShadow: '0 8px 24px rgba(4, 120, 87, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {isOpen ? (
          <span style={{ fontSize: '1.4rem', color: '#ffffff', fontWeight: 'bold' }}><ProIcon name="x" /></span>
        ) : (
          <img src={mariamaAvatar} alt="Zahara" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        )}
      </button>

      {/* MODAL PRINCIPAL ZAHARA (NUAGE VOCAL OU ÉCRIT) */}
      {isOpen && (
        <div 
          className="chatbot-main-window"
          style={{
            position: 'fixed',
            right: '20px',
            bottom: '90px',
            width: '390px',
            maxWidth: 'calc(100vw - 32px)',
            height: 'min(510px, calc(100vh - 100px))',
            boxSizing: 'border-box',
            borderRadius: '24px',
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            color: '#f8fafc'
          }}
        >
          {/* ── EN-TÊTE COMPACT & SÉLECTEUR DE LANGUE RAPIDE ── */}
          <div 
            style={{ 
              padding: '0.75rem 1rem', 
              background: 'rgba(15, 23, 42, 0.85)', 
              backdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #10b981' }}>
                <img src={mariamaAvatar} alt="Zahara" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.01em' }}>
                  {t.botName}
                </h4>
                <span style={{ fontSize: '0.66rem', color: '#34d399', fontWeight: '600' }}>
                  {t.roleBadge}
                </span>
              </div>
            </div>

            {/* Sélecteur de Langue (Auto / WO / FR / EN) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '2px', display: 'flex', gap: '1px' }}>
                {[
                  { id: 'auto', label: 'Auto' },
                  { id: 'wo', label: 'WO' },
                  { id: 'fr', label: 'FR' },
                  { id: 'en', label: 'EN' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setChatLang(opt.id)}
                    style={{
                      border: 'none',
                      borderRadius: '14px',
                      padding: '3px 6px',
                      fontSize: '0.64rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      background: chatLang === opt.id ? '#10b981' : 'transparent',
                      color: chatLang === opt.id ? '#ffffff' : '#94a3b8',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={toggleChat}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem'
                }}
              >
                <ProIcon name="x" />
              </button>
            </div>
          </div>

          {/* ── ZONE CENTRALE : MODE NUAGE VOCAL (DEFAULT) OU CONVERSATION ÉCRITE ── */}
          {interactionMode === 'voice' ? (
            /* MODE NUAGE VOCAL 3D (STYLE CHATGPT VOICE / SIRI) */
            <div 
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.9rem',
                textAlign: 'center',
                overflow: 'hidden'
              }}
            >
              {/* Le Nuage / Orb Vivant */}
              <div style={{ margin: '0.35rem 0', cursor: 'pointer' }} onClick={toggleListening}>
                <VoiceCloudOrb 
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  isThinking={isTyping}
                  audioLevel={audioLevel}
                  size={120}
                  lang={chatLang}
                />
              </div>

              {/* État Dynamique en Direct */}
              <div 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '20px',
                  background: isListening 
                    ? 'rgba(16, 185, 129, 0.2)' 
                    : isSpeaking 
                    ? 'rgba(56, 189, 248, 0.2)' 
                    : isTyping 
                    ? 'rgba(168, 85, 247, 0.2)' 
                    : 'rgba(255, 255, 255, 0.08)',
                  border: `1px solid ${isListening ? '#10b981' : isSpeaking ? '#38bdf8' : isTyping ? '#a855f7' : 'rgba(255, 255, 255, 0.15)'}`,
                  margin: '0.35rem 0',
                  fontSize: '0.80rem',
                  fontWeight: '700',
                  color: isListening ? '#34d399' : isSpeaking ? '#7dd3fc' : isTyping ? '#c084fc' : '#cbd5e1'
                }}
              >
                <span 
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isListening ? '#10b981' : isSpeaking ? '#38bdf8' : isTyping ? '#a855f7' : '#94a3b8',
                    boxShadow: isListening || isSpeaking ? '0 0 10px currentColor' : 'none'
                  }} 
                />
                <span>
                  {isListening 
                    ? t.listeningState 
                    : isSpeaking 
                    ? t.speakingState 
                    : isTyping 
                    ? t.thinkingState 
                    : t.idleState}
                </span>
              </div>

              {/* Transcription & Réponse Affichées en Direct */}
              <div 
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: '75px',
                  maxHeight: '125px',
                  overflowY: 'auto',
                  padding: '0.65rem 0.8rem',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: '0.84rem',
                  lineHeight: '1.45',
                  color: '#e2e8f0',
                  textAlign: 'left'
                }}
              >
                {lastUserSpeech && (
                  <div style={{ marginBottom: '0.4rem', color: '#94a3b8', fontSize: '0.76rem' }}>
                    <strong><ProIcon name="user" /> Vous :</strong> « {lastUserSpeech} »
                  </div>
                )}
                {lastBotReply ? (
                  <div>
                    <strong style={{ color: '#34d399' }}><ProIcon name="status-green" color="#10b981" fill="#10b981" size={10} /> Zahara :</strong> {lastBotReply}
                  </div>
                ) : (
                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                    {chatLang === 'wo' 
                      ? "Bësal bouton 'Waxal' ngir wax ak Zahara ci Wolof..." 
                      : "Appuyez sur 'Parler' pour poser votre question à Zahara..."}
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* MODE CONVERSATION ÉCRITE (CLASSIQUE) */
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {messages.map((m, idx) => (
                  <div key={idx} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                    {m.sender === 'bot' && (
                      <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 'bold', marginBottom: '2px' }}>
                        Zahara <ProIcon name="senegal-flag" />
                      </div>
                    )}
                    <div 
                      style={{
                        padding: '0.6rem 0.85rem',
                        borderRadius: '14px',
                        background: m.sender === 'user' ? '#059669' : 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        lineHeight: '1.4',
                        border: m.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div style={{ alignSelf: 'flex-start', color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    <ProIcon name="zap" /> {t.thinkingState}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Champ d'écriture */}
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(inputVal); }}
                style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(15, 23, 42, 0.7)' }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={t.placeholder}
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  style={{
                    flex: 1,
                    borderRadius: '10px',
                    padding: '0.4rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputVal.trim()}
                  style={{
                    borderRadius: '10px',
                    padding: '0.4rem 0.8rem',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  <ProIcon name="arrow-right" />
                </button>
              </form>
            </div>
          )}

          {/* ── FOOTER : EXACTEMENT DEUX BOUTONS UNIQUES & ÉLÉGANTS ── */}
          <div 
            style={{
              padding: '0.65rem 0.9rem',
              background: 'rgba(15, 23, 42, 0.98)',
              flexShrink: 0,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.65rem'
            }}
          >
            {/* BOUTON 1 : PARLER À HAUTE VOIX (PRINCIPAL) */}
            <button
              type="button"
              onClick={() => {
                if (interactionMode !== 'voice') setInteractionMode('voice');
                toggleListening();
              }}
              style={{
                borderRadius: '14px',
                padding: '0.65rem 0.5rem',
                border: 'none',
                background: isListening 
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' 
                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                boxShadow: isListening 
                  ? '0 0 16px rgba(239, 68, 68, 0.6)' 
                  : '0 4px 14px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>{isListening ? '🛑' : '🎙️'}</span>
              <span>{isListening ? t.voiceListening : t.voiceButton}</span>
            </button>

            {/* BOUTON 2 : ÉCRIRE / BINDAL (SECONDAIRE) */}
            <button
              type="button"
              onClick={() => {
                stopListening();
                setInteractionMode(interactionMode === 'voice' ? 'text' : 'voice');
              }}
              style={{
                borderRadius: '14px',
                padding: '0.65rem 0.5rem',
                border: '1.5px solid rgba(255, 255, 255, 0.2)',
                background: interactionMode === 'text' 
                  ? 'rgba(255, 255, 255, 0.2)' 
                  : 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>{interactionMode === 'text' ? '✨' : '⌨️'}</span>
              <span>{interactionMode === 'text' ? t.backToVoice : t.textButton}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
