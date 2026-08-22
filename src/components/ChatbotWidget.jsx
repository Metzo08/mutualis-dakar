import React, { useState, useEffect, useRef, useCallback } from 'react';
import { isWolofText, cleanTextForTTS, decodeWolofSpeechInput, looksLikeMisheardWolof } from '../utils/phonetics';
import { sanitizeSpeechText, playMedicalChime, speakCleanText, stopAllVoicePlayback, primeAudioPlayback } from '../services/voiceAudioService';

const mariamaAvatar = '/mariama_avatar.png';

// Base de données de vérification instantanée des médicaments et actes CMU/UNAMUSC
const COVERAGE_DATABASE = [
  { name: 'Paracétamol', dci: 'Paracétamol 500mg / 1g', covered: true, rate: 50, category: 'Antalgique / Fièvre', desc: 'Pris en charge à 50% sur Bon de Commande Pharmacie (UNAMUSC 50% / Assuré 50%).' },
  { name: 'Amoxicilline', dci: 'Amoxicilline 500mg / 1g (Gélules & Sirop)', covered: true, rate: 50, category: 'Antibiotique', desc: 'Antibiotique essentiel couvert à 50% en officine agréée sur ordonnance (50% restant assuré).' },
  { name: 'Ibuprofène', dci: 'Ibuprofène 200mg / 400mg', covered: true, rate: 50, category: 'Anti-inflammatoire', desc: 'Pris en charge à 50% sur Bon de Commande en pharmacie conventionnée (50% assuré).' },
  { name: 'Insuline', dci: 'Insuline Humaine Rapide / NPH', covered: true, rate: 50, category: 'Diabète', desc: 'Traitement du diabète pris en charge à 50% par l\'UNAMUSC (50% assuré).' },
  { name: 'Métformine', dci: 'Métformine 500mg / 850mg / 1000mg', covered: true, rate: 50, category: 'Diabète', desc: 'Antidiabétique oral de première intention, couvert à 50% sur Bon de Commande Pharmacie.' },
  { name: 'Amlodipine', dci: 'Amlodipine 5mg / 10mg', covered: true, rate: 50, category: 'Cardiologie / HTA', desc: 'Antihypertenseur de référence couvert à 50% en pharmacie.' },
  { name: 'Ciprofloxacine', dci: 'Ciprofloxacine 500mg', covered: true, rate: 50, category: 'Antibiotique', desc: 'Fluoroquinolone antibiotique couverte à 50% sur Bon de Commande.' },
  { name: 'Oméprazole', dci: 'Oméprazole 20mg (Gélules)', covered: true, rate: 50, category: 'Gastro-entérologie', desc: 'Traitement anti-ulcéreux et reflux gastrique, pris en charge à 50%.' },
  { name: 'Azithromycine', dci: 'Azithromycine 250mg / 500mg', covered: true, rate: 50, category: 'Antibiotique', desc: 'Macrolide antibiotique pris en charge à 50% sur ordonnance.' },
  { name: 'ACT Paludisme', dci: 'Artéméther + Luméfantrine (ACT)', covered: true, rate: 100, category: 'Antipaludéen', desc: 'Traitement du paludisme simple pris en charge à 100% (Gratuité PNLP).' },
  { name: 'Fer + Acide Folique', dci: 'Sulfate ferreux + Acide folique', covered: true, rate: 100, category: 'Maternité / Grossesse', desc: 'Supplémentation de grossesse prise en charge à 100% (Gratuité Maternité).' },
  { name: 'Sérum Physiologique', dci: 'Chlorure de sodium 0.9%', covered: true, rate: 50, category: 'Soins / Pédiatrie', desc: 'Couvert à 50% en pharmacie (ou 100% pour les nourrissons de moins de 5 ans).' },
  { name: 'Compléments alimentaires', dci: 'Vitamines de confort / Fortifiants sans ordonnance', covered: false, rate: 0, category: 'Confort / Parapharmacie', desc: 'Non pris en charge par le panier officiel des soins CSU (100% à la charge du patient).' },
  { name: 'Chirurgie esthétique', dci: 'Actes esthétiques de confort non reconstructeurs', covered: false, rate: 0, category: 'Chirurgie de confort', desc: 'Non pris en charge par les garanties mutualistes UNAMUSC.' },
  { name: 'Implants dentaires de luxe', dci: 'Prothèses dentaires cosmétiques haut de gamme', covered: false, rate: 0, category: 'Dentaire cosmétique', desc: 'Non pris en charge (seuls les soins dentaires de base sont couverts).' }
];

// Structures sanitaires et points clés de Dakar
const SANITARY_STRUCTURES = [
  { id: 1, name: 'Hôpital Principal de Dakar', type: 'hospital', typeLabel: 'Hôpital Militaire & Public', rate: '80% Lettre de Garantie (20% assuré)', commune: 'Dakar Plateau', address: 'Avenue Nelson Mandela', phone: '+221 33 839 50 50', hours: '24h/24' },
  { id: 2, name: 'CHU de Fann (Dakar)', type: 'hospital', typeLabel: 'Centre Hospitalier Universitaire', rate: '80% Lettre de Garantie (20% assuré)', commune: 'Fann-Point E', address: 'Avenue Cheikh Anta Diop', phone: '+221 33 869 18 18', hours: '24h/24' },
  { id: 3, name: 'Hôpital Aristide Le Dantec', type: 'hospital', typeLabel: 'Centre Hospitalier Universitaire', rate: '80% Lettre de Garantie (20% assuré)', commune: 'Dakar Plateau', address: 'Avenue Pasteur', phone: '+221 33 889 38 00', hours: '24h/24' },
  { id: 4, name: 'CHU Abass Ndao', type: 'hospital', typeLabel: 'Centre Hospitalier Universitaire', rate: '80% Lettre de Garantie (20% assuré)', commune: 'Gueule Tapée', address: 'Avenue Cheikh Anta Diop', phone: '+221 33 849 78 00', hours: '24h/24' },
  { id: 5, name: 'Hôpital Dalal Jamm', type: 'hospital', typeLabel: 'Hôpital National', rate: '80% Lettre de Garantie (20% assuré)', commune: 'Guédiawaye', address: 'Voie de contournement', phone: '+221 33 879 40 40', hours: '24h/24' },
  { id: 6, name: 'Hôpital Roi Baudouin', type: 'hospital', typeLabel: 'Hôpital Départemental', rate: '80% Lettre de Garantie (20% assuré)', commune: 'Guédiawaye', address: 'Guédiawaye Centre', phone: '+221 33 877 10 10', hours: '24h/24' },
  { id: 7, name: 'Pharmacie du Plateau', type: 'pharmacy', typeLabel: 'Pharmacie Agréée UNAMUSC', rate: '50% Bon de Commande (50% assuré)', commune: 'Dakar Plateau', address: 'Avenue Albert Sarraut', phone: '+221 33 823 23 23', hours: '24h/24' },
  { id: 8, name: 'Pharmacie Guigon', type: 'pharmacy', typeLabel: 'Pharmacie Agréée UNAMUSC', rate: '50% Bon de Commande (50% assuré)', commune: 'Dakar Plateau', address: '1 Avenue Georges Pompidou', phone: '+221 33 823 03 33', hours: '24h/24' },
  { id: 9, name: 'Pharmacie Nation', type: 'pharmacy', typeLabel: 'Pharmacie Agréée UNAMUSC', rate: '50% Bon de Commande (50% assuré)', commune: 'Colobane', address: 'Avenue Blaise Diagne', phone: '+221 33 822 55 55', hours: '8h-22h' },
  { id: 10, name: 'Pharmacie de Pikine', type: 'pharmacy', typeLabel: 'Pharmacie Agréée UNAMUSC', rate: '50% Bon de Commande (50% assuré)', commune: 'Pikine', address: 'Tally Boubess', phone: '+221 33 851 15 15', hours: '8h-23h' },
  { id: 11, name: 'MSD Dakar Plateau (Mutuelle Départementale)', type: 'msd', typeLabel: 'Bureau Départemental MSD', rate: 'Coordination & Adhésion', commune: 'Dakar Plateau', address: 'Immeuble Municipal, Dakar', phone: '+221 33 821 10 10', hours: '8h-16h' },
  { id: 12, name: 'MSD Pikine Ouest', type: 'msd', typeLabel: 'Bureau Départemental MSD', rate: 'Coordination & Adhésion', commune: 'Pikine Ouest', address: 'Centre d\'Appui Local', phone: '+221 33 851 44 22', hours: '8h-16h' },
  { id: 13, name: 'MSD Guédiawaye', type: 'msd', typeLabel: 'Bureau Départemental MSD', rate: 'Coordination & Adhésion', commune: 'Golf Sud', address: 'Cité des Enseignants', phone: '+221 33 862 33 44', hours: '8h-16h' },
  { id: 14, name: 'MSD Keur Massar', type: 'msd', typeLabel: 'Bureau Départemental MSD', rate: 'Coordination & Adhésion', commune: 'Keur Massar Nord', address: 'Cité Ouvrière', phone: '+221 33 892 20 20', hours: '8h-16h' },
  { id: 15, name: 'MSD Rufisque', type: 'msd', typeLabel: 'Bureau Départemental MSD', rate: 'Coordination & Adhésion', commune: 'Rufisque Nord', address: 'Siège Administratif', phone: '+221 33 871 12 12', hours: '8h-16h' }
];

export default function ChatbotWidget({ lang, setView }) {
  const [chatLang, setChatLang] = useState(lang || 'fr');
  const [speechLang, setSpeechLang] = useState(lang || 'fr');
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [hasNewMessage, setHasNewMessage] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  // Onglet filtre de la carte interactive intégrée
  const [mapFilter, setMapFilter] = useState('all'); // 'all', 'hospital', 'pharmacy', 'msd'
  
  // Conversation orale mains libres
  const [oralMode, setOralMode] = useState(false);
  const oralModeRef = useRef(false);
  const pendingResumeRef = useRef(false);
  const startListeningRef = useRef(null);
  const handleSendRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const isHandlingSendRef = useRef(false);
  const didInitMessagesRef = useRef(false);

  // Sync with prop changes
  useEffect(() => {
    setChatLang(lang || 'fr');
    setSpeechLang(lang || 'fr');
  }, [lang]);

  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      setHasNewMessage(false);
    };
    window.addEventListener('open-zahara-chat', handleOpenChat);
    return () => window.removeEventListener('open-zahara-chat', handleOpenChat);
  }, []);

  const dict = {
    fr: {
      botName: 'Zahara • Agent Conseiller Assuré',
      roleBadge: 'Agent Dédié Assuré à jour',
      welcomeMsg: 'Bonjour ! Je suis Zahara, votre Agent Personnel MUTUALIS DAKAR.\n\nEn tant qu\'assuré(e) à jour de vos cotisations, vous bénéficiez de :\n• 🧾 50% de prise en charge sur les Bons de commande de médicaments en pharmacie (50% restant à votre charge).\n• 🏥 80% de prise en charge sur les Lettres de garantie hospitalières (20% restant à votre charge).\n\nComment puis-je vous guider aujourd\'hui ?',
      placeholder: 'Posez votre question ou nom de médicament...',
      sendBtn: 'Envoyer',
      quickActions: 'Actions Rapides de l\'Assuré :',
      actMeds: '💊 Vérifier un médicament (50%)',
      actOrder: '🧾 Bon de commande (50%)',
      actGuarantee: '🏥 Lettre de garantie (80%)',
      actMap: '🗺️ Carte des structures & pharmacies',
      actCard: '🪪 Ma Carte CSU & Ayants droit',
      actCotis: '💳 Mes Cotisations & Attestation',
      online: 'Agent Actif • Tiers-Payant 2026',
      resetBtn: 'Recommencer',
      voiceOn: 'Voix activée',
      voiceOff: 'Voix désactivée',
      typing: 'Zahara analyse...',
      oralOn: 'Conversation orale active — cliquez pour couper',
      oralOff: 'Conversation orale mains libres (parlez, Zahara répond puis réécoute)',
      oralListening: '🎧 Je vous écoute…',
      oralThinking: '💭 Zahara prépare la réponse…',
      oralSpeaking: '💬 Zahara vous parle…'
    },
    wo: {
      botName: 'Zahara • Agent bu Assuré bi',
      roleBadge: 'Agent bu Assuré bu à jour',
      welcomeMsg: 'Na nga def ! Man la Zahara, sa Agent Personnel bu MUTUALIS DAKAR.\n\nBoo fekkee yaangi à jour ci say cotisations, mutuelle bi day fay :\n• 🧾 50% ci say garab ci pharmacie (Bon de commande — 50% ci sa loxo).\n• 🏥 80% ci say hospitalisations ak opérations (Lettre de garantie — 20% ci sa loxo).\n\nNaka la la mënee dimbali tey ci sa wér-gi-yaram ?',
      placeholder: 'Laajal garab walla laaj ci CMU...',
      sendBtn: 'Yónnee',
      quickActions: 'Jëf yu gaaw yu Assuré bi :',
      actMeds: '💊 Seet garab (50%)',
      actOrder: '🧾 Bon de commande (50%)',
      actGuarantee: '🏥 Lettre de garantie (80%)',
      actMap: '🗺️ Kàrtu fajukaay ak pharmacie',
      actCard: '🪪 Sama Carte CSU ak ayants droit',
      actCotis: '💳 Samay Fayut ak Attestation',
      online: 'Agent bi mungi fi • 2026',
      resetBtn: 'Dëkkal',
      oralOn: 'Waxtaan ci baat bi dafa yegg',
      oralOff: 'Waxtaan ci baat, loxo yu neen',
      oralListening: '🎧 Mungi lay déglu…',
      oralThinking: '💭 Zahara di xalaat…',
      oralSpeaking: '💬 Zahara mungi wax…',
      voiceOn: 'Baat bi dafa jëm',
      voiceOff: 'Baat bi dafa tëdd',
      typing: 'Zahara mungi bind...'
    }
  };

  const t = dict[chatLang] || dict.fr;

  // Initialize welcome message — UNE SEULE FOIS.
  // Ne jamais réinitialiser la conversation quand la langue bascule
  // (sinon le dialogue est effacé en plein échange dès qu'on parle Wolof).
  useEffect(() => {
    if (didInitMessagesRef.current) return;
    didInitMessagesRef.current = true;
    setMessages([
      { sender: 'bot', text: t.welcomeMsg, isWelcome: true }
    ]);
  }, [chatLang]);

  // Nettoyage au démontage uniquement
  useEffect(() => () => {
    stopAllVoicePlayback();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  // Focus input when chat opens (sécurisé avec vérification de montage)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Stop speech when chat closes
  useEffect(() => {
    if (!isOpen) {
      stopAllVoicePlayback();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsSpeaking(false);
      setIsListening(false);
      oralModeRef.current = false;
      pendingResumeRef.current = false;
      setOralMode(false);
    }
  }, [isOpen]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setHasNewMessage(false);
      // Déverrouille la lecture audio pendant le clic (politique autoplay Chrome)
      primeAudioPlayback();
    }
  };

  // Text-to-Speech universel sans doublon
  const speakText = useCallback((text, onEnd) => {
    if (!voiceEnabled) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const isWolof = isWolofText(cleanText);
    // Réponse Wolof (détectée ou par langue du chat) → conversion phonétique TTS
    const langParam = (isWolof || chatLang === 'wo') ? 'wolof' : 'fr';

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

  const resumeListeningAfterSpeech = () => {
    pendingResumeRef.current = false;
    if (oralModeRef.current) {
      setTimeout(() => {
        if (oralModeRef.current) startListeningRef.current();
      }, 350);
    }
  };

  const speakAndMaybeResume = (text, resume) => {
    if (resume) {
      pendingResumeRef.current = true;
      setTimeout(() => {
        if (pendingResumeRef.current) resumeListeningAfterSpeech();
      }, 25000);
    }
    speakText(text, resume ? resumeListeningAfterSpeech : undefined);
  };

  const startListening = () => {
    // 0. Déverrouille l'audio PENDANT le clic (autoplay Chrome) : la réponse
    //    vocale arrivera plusieurs secondes plus tard, quand le geste aura expiré.
    primeAudioPlayback();

    // 1. Coupe immédiatement toute voix en cours de lecture pour ne pas que le micro s'auto-écoute
    stopSpeaking();
    stopAllVoicePlayback();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setIsSpeaking(false);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const typed = prompt(chatLang === 'wo' ? "Waxal walla nga bind sa laaj ci Wolof :" : "Posez votre question à Zahara :");
      if (typed && typed.trim()) {
        handleSendRef.current(typed.trim(), true, false);
      }
      return;
    }

    // Si une écoute précédente traîne encore, on la stoppe proprement d'abord
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      // Le navigateur n'a pas de modèle Wolof : on transcrit TOUJOURS avec le
      // modèle français (fiable sur Chrome/Edge), puis on décode la phonétique
      // Wolof dans onresult. fr-SN provoquait des erreurs 'language-not-supported'.
      rec.lang = 'fr-FR';

      let capturedTranscript = '';
      let autoStopTimer = null;

      rec.onstart = () => {
        setIsListening(true);
        // Timeout de sécurité : si aucun son après 8s, arrêter l'écoute sans bloquer
        autoStopTimer = setTimeout(() => {
          if (rec) {
            try { rec.stop(); } catch (e) {}
          }
          setIsListening(false);
        }, 8000);
      };

      rec.onresult = (e) => {
        if (autoStopTimer) clearTimeout(autoStopTimer);
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            final += e.results[i][0].transcript;
          } else {
            interim += e.results[i][0].transcript;
          }
        }

        // Décodage phonétique Wolof en temps réel : si l'UI est en mode Wolof on
        // force le décodage ; sinon il se déclenche sur détection de Wolof mal entendu.
        const forceWolof = speechLang === 'wo' || chatLang === 'wo';

        if (final && !isHandlingSendRef.current) {
          isHandlingSendRef.current = true;
          setIsListening(false);
          const finalDecoded = decodeWolofSpeechInput(final.trim(), forceWolof);
          capturedTranscript = finalDecoded;
          setInputVal(finalDecoded);
          handleSendRef.current(finalDecoded, true, oralModeRef.current);
          setTimeout(() => { isHandlingSendRef.current = false; }, 600);
        } else if (interim) {
          const interimDecoded = decodeWolofSpeechInput(interim, forceWolof);
          if (interimDecoded) {
            capturedTranscript = interimDecoded;
            setInputVal(interimDecoded);
          }
        }
      };

      rec.onerror = (event) => {
        if (autoStopTimer) clearTimeout(autoStopTimer);
        console.warn('SpeechRecognition info:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMessages(prev => [...prev, {
            sender: 'bot',
            text: chatLang === 'wo'
              ? '🎤 Micro bi dañu ko togg. Ngir mana wax ak Zahara, mayal micro bi ci navigateur bi (icône 🔒 ci barre d\'adresse bi) te pareela.'
              : '🎤 Le micro est bloqué par le navigateur. Pour parler à Zahara, autorisez le micro dans les permissions du navigateur (icône 🔒 dans la barre d\'adresse), puis réessayez.'
          }]);
        } else if (event.error === 'no-speech' && capturedTranscript && !isHandlingSendRef.current) {
          isHandlingSendRef.current = true;
          handleSendRef.current(capturedTranscript, true, oralModeRef.current);
          setTimeout(() => { isHandlingSendRef.current = false; }, 600);
        }
      };

      rec.onend = () => {
        if (autoStopTimer) clearTimeout(autoStopTimer);
        setIsListening(false);
        if (capturedTranscript && !isHandlingSendRef.current) {
          isHandlingSendRef.current = true;
          handleSendRef.current(capturedTranscript, true, oralModeRef.current);
          setTimeout(() => { isHandlingSendRef.current = false; }, 600);
        } else if (oralModeRef.current && !pendingResumeRef.current) {
          setTimeout(() => {
            if (oralModeRef.current && !pendingResumeRef.current) {
              startListeningRef.current();
            }
          }, 350);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('SpeechRecognition catch:', err);
      setIsListening(false);
    }
  };
  startListeningRef.current = startListening;

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    primeAudioPlayback();
    if (isListening) stopListening(); else startListening();
  };

  const toggleOralMode = () => {
    primeAudioPlayback();
    const next = !oralMode;
    oralModeRef.current = next;
    setOralMode(next);
    if (next) {
      if (!voiceEnabled) setVoiceEnabled(true);
      startListeningRef.current();
    } else {
      pendingResumeRef.current = false;
      stopListening();
      stopSpeaking();
    }
  };

  // Moteur de recherche et verdict de médicament (OUI / NON)
  const detectMedicineQuery = (text) => {
    const lower = text.toLowerCase();
    for (const item of COVERAGE_DATABASE) {
      const nameLower = item.name.toLowerCase();
      if (lower.includes(nameLower) || (item.dci && lower.includes(item.dci.split(' ')[0].toLowerCase()))) {
        return item;
      }
    }
    if (lower.includes('paracetamol') || lower.includes('doliprane') || lower.includes('efferalgan')) return COVERAGE_DATABASE[0];
    if (lower.includes('amoxi') || lower.includes('clamoxyl') || lower.includes('augmentin')) return COVERAGE_DATABASE[1];
    if (lower.includes('ibuprofene') || lower.includes('advil') || lower.includes('antarene')) return COVERAGE_DATABASE[2];
    if (lower.includes('insuline') || lower.includes('lantus') || lower.includes('novorapid')) return COVERAGE_DATABASE[3];
    if (lower.includes('metformine') || lower.includes('glucophage')) return COVERAGE_DATABASE[4];
    if (lower.includes('amlodipine') || lower.includes('amlor')) return COVERAGE_DATABASE[5];
    if (lower.includes('omeprazole') || lower.includes('mopral') || lower.includes('inipomp')) return COVERAGE_DATABASE[7];
    if (lower.includes('palu') || lower.includes('coartem') || lower.includes('lumartem')) return COVERAGE_DATABASE[9];
    if (lower.includes('vitamine') || lower.includes('complement') || lower.includes('fortifiant')) return COVERAGE_DATABASE[12];
    return null;
  };

  // Moteur de détection de demande de carte / localisation
  const isMapQuery = (text) => {
    const lower = text.toLowerCase();
    return lower.includes('carte') || lower.includes('map') || lower.includes('trouver') ||
           lower.includes('où est') || lower.includes('localisation') || lower.includes('structure') ||
           lower.includes('hôpital') || lower.includes('hopital') || lower.includes('pharmacie') ||
           lower.includes('msd') || lower.includes('mutuelle') || lower.includes('proche') ||
           lower.includes('adresse') || lower.includes('fajukaay') || lower.includes('garabukaay');
  };

  const handleSend = useCallback((textToSend, isVoiceInput = false, resumeVoiceAfter = false) => {
    if (!textToSend || !String(textToSend).trim()) return;
    textToSend = String(textToSend);

    // Déverrouille l'audio au clic « Envoyer » (inoffensif si déjà déverrouillé)
    primeAudioPlayback();
    stopSpeaking();

    // ── Décodage phonétique des entrées vocales ──
    // Le STT du navigateur transcrit le Wolof avec le modèle français
    // (« nanga def » → « non pas de ») : on reconstruit le Wolof réel ici,
    // quel que soit le mode de langue actif de l'interface.
    let processedText = textToSend;
    let wolofFromVoice = false;
    if (isVoiceInput) {
      const forceWolof = speechLang === 'wo' || chatLang === 'wo';
      const decoded = decodeWolofSpeechInput(textToSend, forceWolof);
      if (decoded && decoded.trim()) {
        wolofFromVoice = looksLikeMisheardWolof(textToSend) || forceWolof;
        processedText = decoded.trim();
      }
    }

    const detectedIsWolof = isWolofText(processedText) || wolofFromVoice;
    let messageLang = chatLang;

    const cleanMsg = processedText.toLowerCase().trim();
    if (cleanMsg.includes('en wolof') || cleanMsg.includes('waxal ci wolof') || cleanMsg.includes('parle wolof') || cleanMsg.includes('wax wolof')) {
      messageLang = 'wo';
    } else if (isVoiceInput && detectedIsWolof) {
      // On a parlé Wolof au micro → Zahara répond en Wolof, même si l'UI était en FR
      messageLang = 'wo';
    } else if (chatLang === 'wo' && !detectedIsWolof && !isVoiceInput) {
      messageLang = 'fr';
    } else if (chatLang === 'fr' && detectedIsWolof) {
      messageLang = 'wo';
    }

    if (messageLang !== chatLang) {
      setChatLang(messageLang);
      setSpeechLang(messageLang);
    }

    const userMsg = { sender: 'user', text: processedText };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    const matchedMed = detectMedicineQuery(processedText);
    if (matchedMed) {
      setTimeout(() => {
        setIsTyping(false);
        const isWo = messageLang === 'wo';
        let responseText = '';
        if (matchedMed.covered) {
          if (matchedMed.rate === 100) {
            responseText = isWo
              ? `✅ WAAW (OUI) — Garab bi (${matchedMed.name}) dafa gratuit 100% ci UNAMUSC (0 FCFA sa loxo) !`
              : `✅ OUI — Le médicament "${matchedMed.name}" (${matchedMed.dci}) est pris en charge à 100% par l'UNAMUSC (Gratuité intégrale, 0 FCFA à votre charge) !`;
          } else {
            responseText = isWo
              ? `✅ WAAW (OUI) — Garab bi (${matchedMed.name}) pris en charge la à 50% ci Bon de Commande Pharmacie (UNAMUSC day fay 50%, 50% des ci sa loxo).`
              : `✅ OUI — Le médicament "${matchedMed.name}" (${matchedMed.dci}) est PRIS EN CHARGE à 50% sur Bon de Commande Pharmacie (UNAMUSC prend en charge 50%, le reste de 50% est à votre charge).`;
          }
        } else {
          responseText = isWo
            ? `❌ DÉEDÉET (NON) — Garab bi (${matchedMed.name}) bokkul ci panier de base CSU bi. Dafa nekk produit de confort (100% ci sa loxo).`
            : `❌ NON — Le produit "${matchedMed.name}" n'est PAS pris en charge par le panier de base CMU (produit de confort / sans ordonnance, 100% à la charge du patient).`;
        }

        const botMsg = { 
          sender: 'bot', 
          text: responseText,
          medicineCard: matchedMed 
        };
        setMessages(prev => [...prev, botMsg]);
        speakAndMaybeResume(responseText, resumeVoiceAfter);
      }, 500);
      return;
    }

    if (isMapQuery(processedText)) {
      setTimeout(() => {
        setIsTyping(false);
        const isWo = messageLang === 'wo';
        const responseText = isWo
          ? "🗺️ Kàrtu fajukaay yi : Xoolal hôpitaux conventionnés yi (80% garantie), pharmacies agréées yi (50% bon de commande) ak bureaux MSD yi ci région Ndakaaru !"
          : "🗺️ Carte interactive des structures : Voici les hôpitaux conventionnés (80% pris en charge par lettre de garantie, 20% à votre charge), pharmacies agréées (50% bon de commande) et bureaux MSD de Dakar :";

        const botMsg = {
          sender: 'bot',
          text: responseText,
          showMap: true
        };
        setMessages(prev => [...prev, botMsg]);
        speakAndMaybeResume(responseText, resumeVoiceAfter);
      }, 500);
      return;
    }

    const historyForAPI = messages.slice(-8).map(m => ({
      sender: m.sender,
      text: m.text
    }));

    const apiUrl = (typeof window !== 'undefined' && window.API_BASE_URL) || 'http://localhost:5000';

    fetch(`${apiUrl}/api/chatbot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: processedText, lang: messageLang, history: historyForAPI, isVoiceInput }),
      // 12 s : laisse le temps à Gemini de répondre (2-8 s). Si le serveur
      // est simplement éteint, la connexion échoue immédiatement → repli local.
      signal: AbortSignal.timeout(12000)
    })
    .then(res => res.json())
    .then(data => {
      setIsTyping(false);
      if (data.response) {
        // Le backend (Gemini) a reconstruit la vraie phrase Wolof : on
        // remplace le transcript décodé approximatif affiché chez l'utilisateur.
        if (data.decodedText && String(data.decodedText).trim()) {
          const refined = String(data.decodedText).trim();
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
        speakAndMaybeResume(data.response, resumeVoiceAfter);
      } else {
        throw new Error('No response');
      }
    })
    .catch(() => {
      setIsTyping(false);
      const botResponse = generateLocalResponse(processedText, messageLang);
      setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
      speakAndMaybeResume(botResponse, resumeVoiceAfter);
    });
  }, [messages, chatLang, speechLang, speakText, speakAndMaybeResume]);
  handleSendRef.current = handleSend;

  const generateLocalResponse = (userText, detectedLang) => {
    const text = userText.toLowerCase().trim();
    const isWolof = isWolofText(text) || detectedLang === 'wo';

    if (isWolof) {
      // Intentions métier d'abord — la salutation ne doit pas masquer une vraie question
      // (« nanga def, ñaata la cotisation ? » doit répondre le tarif, pas un bonjour).
      if (text.includes('bon de commande') || text.includes('pharmacie') || text.includes('garab') || text.includes('ordonnance') || text.includes('faj')) {
        return "Bons de commande pharmacie (48h) yi dañuy fay 50% ci prix garab génériques yi ci ordonnance bi (50% ci sa loxo). Pharmacien agréé bi day scanner sa pass CSU te nàntu 50% bi sur-le-champ ! 💊";
      }
      if (text.includes('garantie') || text.includes('hôpital') || text.includes('chirurgie') || text.includes('opération') || text.includes('hospitalisation') || text.includes('hopital')) {
        return "Lettres de garantie hospitalières yi dañuy fay 80% ci say frais d'hospitalisation ak opération ci hôpitaux conventionnés (20% des ci sa loxo). Mën nga ko demander direct ci tab 'Lettres de garantie' ! 🏥";
      }
      if (text.includes('maternité') || text.includes('bir') || text.includes('cpn') || text.includes('vaccin') || text.includes('accouchement') || text.includes('dom')) {
        return "Programme Gratuité Maternité & BSF bi dafa gratuit 100% ci UNAMUSC (CPN 1-4+, accouchement, fer/acide folique ak vaccins PEV yépp ci 0 FCFA) ! 👶";
      }
      if (text.includes('cotisation') || text.includes('tarif') || text.includes('prix') || text.includes('fay') || text.includes('fayal') || text.includes('xalis') || text.includes('xaalis') || text.includes('ñaata') || text.includes('ñata')) {
        return "Tarif d'adhésion UNAMUSC : Formule Individuelle mooy 4 500 FCFA ci at mi (1 000 FCFA carte + 3 500 FCFA cotisation). Formule Familiale mooy 1 000 FCFA carte njiitu kër bi + 3 500 FCFA par membre. Fayal ci Orange Money walla Wave ! 💰";
      }
      if (text.includes('carte') || text.includes('ayant') || text.includes('enfant') || text.includes('keur') || text.includes('kër')) {
        return "Sa carte CSU numérique sécurisée ak say ayants droit (enfants mineurs à 100% gratuité) mungi ci tab 'Card Studio' / 'Vérifier Carte' ! 🪪";
      }
      if (text.includes('salaam') || text.includes('naka') || text.includes('bonjour') || text.includes('nanga def') || text.includes('nuyul') || text.includes('kuy')) {
        return "Salamaalekum ! Nanga def ! Man la Zahara, sa Agent Dédié bu MUTUALIS DAKAR. Ci sa qualité d'assuré à jour, am nga 50% prise en charge ci pharmacies (Bon de commande) ak 80% ci hôpitaux (Lettre de garantie — 20% ci sa loxo). Naka la la mënee jàppale tey ? 😊";
      }
      return "Jërëjëf ci sa laaj ! En tant qu'assuré à jour, am nga 50% ci pharmacie (Bon de commande), 80% ci hôpital (Lettre de garantie — 20% ci sa loxo) ak gratuité maternité 100%. Am nga yeneen laaj ? 😊";
    }

    if (text.includes('bon de commande') || text.includes('pharmacie') || text.includes('ordonnance') || text.includes('médicament') || text.includes('medicament')) {
      return "Les Bons de Commande Pharmacie (valables 48h) vous font bénéficier d'un Tiers-Payant officiel de 50% pris en charge par l'UNAMUSC (les 50% restants constituent le ticket modérateur à votre charge). Le pharmacien conventionné scanne votre QR Code et applique la réduction immédiatement. 💊";
    }
    if (text.includes('garantie') || text.includes('hôpital') || text.includes('chirurgie') || text.includes('hospitalisation') || text.includes('opération') || text.includes('devis') || text.includes('hopital')) {
      return "Les Lettres de Garantie Hospitalières couvrent 80% du montant des devis pour vos hospitalisations, chirurgies et examens lourds dans tous les hôpitaux conventionnés de Dakar (Fann, Principal, Le Dantec, Abass Ndao, Dalal Jamm...). Les 20% restants sont à la charge de l'assuré (ou 0 FCFA pour le Plan SESAME 60 ans+ et Maternité). 🏥";
    }
    if (text.includes('maternité') || text.includes('enceinte') || text.includes('accouchement') || text.includes('bébé') || text.includes('cpn')) {
      return "Le Programme Gratuité Maternité & Pédiatrique garantit une prise en charge à 100% intégrale (0 FCFA pour vous) sur l'ensemble des consultations prénatales CPN 1-4+, l'accouchement, le kit d'accouchement et les vaccins PEV. 👶";
    }
    if (text.includes('tarif') || text.includes('cotisation') || text.includes('prix') || text.includes('combien') || text.includes('payer')) {
      return "Tarifs officiels UNAMUSC : Formule Individuelle à 4 500 FCFA/an (1 000 FCFA carte + 3 500 FCFA cotisation). Formule Familiale à 1 000 FCFA pour le titulaire + 3 500 FCFA par membre inscrit. Paiement sécurisé via Orange Money ou Wave ! 💰";
    }
    if (text.includes('carte') || text.includes('ayant') || text.includes('enfant') || text.includes('attestation')) {
      return "Votre Carte CSU numérique sécurisée et vos ayants droit rattachés sont consultables et imprimables en haute définition via l'onglet 'Card Studio'. Vos enfants mineurs bénéficient de la gratuité pédiatrique à 100%. 🪪";
    }
    if (text.includes('bonjour') || text.includes('salut') || text.includes('qui es-tu') || text.includes('aide') || text.includes('coucou')) {
      return "Bonjour ! Je suis Zahara, votre Agent Conseiller Personnel MUTUALIS DAKAR. En tant qu'assuré(e) à jour, vos prestations sont actives : 50% sur vos ordonnances en pharmacie (Bon de commande, 50% restant à votre charge) et 80% sur vos hospitalisations (Lettre de garantie, 20% à votre charge). Comment puis-je vous assister ? 😊";
    }

    return "Je suis à votre entière disposition en tant qu'Agent de l'assuré ! Je peux vérifier la couverture d'un médicament (OUI/NON à 50%), générer un Bon de commande pharmacie (50%), préparer une Lettre de garantie hospitalière (80% UNAMUSC / 20% assuré), ou vous guider sur la carte interactive des structures conventionnées. 😊";
  };

  const handleActionClick = (actionType) => {
    if (actionType === 'meds') {
      handleSend('Quels sont les médicaments pris en charge et comment vérifier un médicament ?');
    } else if (actionType === 'order') {
      if (setView) setView('purchase-orders');
      handleSend('Je souhaite générer un bon de commande de médicaments à 50%');
    } else if (actionType === 'guarantee') {
      if (setView) setView('guarantee-letters');
      handleSend('Comment obtenir une lettre de garantie hospitalière prise en charge à 80% (20% à ma charge) ?');
    } else if (actionType === 'map') {
      handleSend('Montre-moi la carte interactive des structures de santé et pharmacies');
    } else if (actionType === 'card') {
      if (setView) setView('studio');
      handleSend('Je souhaite voir ma carte CSU et mes ayants droit rattachés');
    } else if (actionType === 'cotis') {
      if (setView) setView('cotisations');
      handleSend('Comment vérifier mes cotisations et télécharger mon attestation à jour ?');
    }
  };

  const [isActionsCollapsed, setIsActionsCollapsed] = useState(false);

  const filteredStructures = SANITARY_STRUCTURES.filter(st => {
    if (mapFilter === 'all') return true;
    if (mapFilter === 'hospital') return st.type === 'hospital';
    if (mapFilter === 'pharmacy') return st.type === 'pharmacy';
    if (mapFilter === 'msd') return st.type === 'msd';
    return true;
  });

  return (
    <div className="chatbot-container">
      {/* Bouton Flottant d'ouverture */}
      <button 
        className="chatbot-toggle shadow-lg" 
        onClick={toggleChat} 
        aria-label="Ouvrir l'Agent Zahara" 
        style={{ 
          padding: 0, 
          overflow: 'hidden', 
          border: '2.5px solid #10b981',
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 99998,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
        }}
      >
        {isOpen ? (
          <span style={{ fontSize: '1.4rem', color: '#ffffff', lineHeight: 1 }}>✕</span>
        ) : (
          <img src={mariamaAvatar} alt="Zahara" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        )}
        {hasNewMessage && !isOpen && <span className="notification-dot"></span>}
      </button>

      {/* Fenêtre de Chat — Toujours 100% visible dans la fenêtre écran */}
      {isOpen && (
        <div 
          className="chatbot-window glass-effect" 
          style={{ 
            position: 'fixed',
            right: '20px',
            bottom: '86px',
            width: '390px', 
            maxWidth: 'calc(100vw - 32px)', 
            height: 'min(530px, calc(100vh - 105px))', 
            maxHeight: 'calc(100vh - 105px)', 
            display: 'flex', 
            flexDirection: 'column', 
            borderRadius: '20px', 
            overflow: 'hidden', 
            boxShadow: '0 16px 48px rgba(0,0,0,0.35)', 
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            zIndex: 99999,
            background: 'var(--bg-card, #ffffff)'
          }}
        >
          {/* Header Compact */}
          <div className="chatbot-header" style={{ padding: '0.65rem 0.9rem', background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div className="chatbot-brand d-flex align-items-center gap-2">
              <div className="chatbot-avatar" style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid #10b981', flexShrink: 0 }}>
                <img src={mariamaAvatar} alt="Zahara" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="chatbot-info">
                <h4 style={{ margin: 0, fontSize: '0.90rem', fontWeight: '800', color: '#ffffff', lineHeight: 1.2 }}>{t.botName}</h4>
                <span className="badge bg-success-subtle text-success fw-bold px-1.5 py-0.5" style={{ fontSize: '0.64rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.3)', color: '#a7f3d0' }}>
                  🟢 {t.roleBadge}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <button 
                type="button"
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
                style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {isSpeaking ? '⏹️' : voiceEnabled ? '🔊' : '🔇'}
              </button>
              <button 
                type="button"
                className="chatbot-close" 
                onClick={toggleChat} 
                aria-label="Fermer" 
                style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Bandeau d'état mode oral */}
          {oralMode && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              margin: '0.3rem 0.6rem 0', padding: '0.35rem 0.6rem', borderRadius: '8px',
              background: isListening ? 'rgba(16,185,129,0.15)' : isSpeaking ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)',
              border: `1px solid ${isListening ? 'rgba(16,185,129,0.5)' : isSpeaking ? 'rgba(56,189,248,0.5)' : 'rgba(245,158,11,0.5)'}`,
              fontSize: '0.74rem', fontWeight: '700', flexShrink: 0
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isListening ? '#10b981' : isSpeaking ? '#38bdf8' : '#f59e0b', display: 'inline-block' }} />
              <span style={{ color: isListening ? '#10b981' : isSpeaking ? '#38bdf8' : '#f59e0b' }}>
                {isListening ? t.oralListening : isSpeaking ? t.oralSpeaking : t.oralThinking}
              </span>
            </div>
          )}

          {/* Corps des messages — Défilement fluide & Lisibilité Maximale */}
          <div className="chatbot-messages" style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {messages.map((m, idx) => (
              <div key={idx} className={`chatbot-msg ${m.sender}`} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                {m.sender === 'bot' && (
                  <div className="chatbot-msg-header d-flex justify-content-between align-items-center mb-1">
                    <span className="chatbot-msg-name fw-bold" style={{ fontSize: '0.74rem', color: '#047857' }}>Zahara</span>
                    <button
                      type="button"
                      className="chatbot-msg-speak"
                      onClick={() => {
                        primeAudioPlayback();
                        speakText(m.text);
                      }}
                      title="Écouter"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.80rem', opacity: 0.8 }}
                    >
                      🔊
                    </button>
                  </div>
                )}
                
                <div style={{ whiteSpace: 'pre-line', fontSize: '0.84rem', lineHeight: '1.4', background: m.sender === 'user' ? '#059669' : 'var(--bg-card, #ffffff)', color: m.sender === 'user' ? '#ffffff' : 'var(--text-main, #0f172a)', padding: '0.65rem 0.85rem', borderRadius: '12px', border: m.sender === 'user' ? 'none' : '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  {m.text}
                </div>

                {/* Fiche médicament interactif */}
                {m.medicineCard && (
                  <div className="mt-2 p-2.5 rounded-3" style={{ background: m.medicineCard.covered ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)', border: `1.5px solid ${m.medicineCard.covered ? '#10b981' : '#ef4444'}`, borderRadius: '10px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <strong style={{ fontSize: '0.84rem', color: m.medicineCard.covered ? '#065f46' : '#991b1b' }}>
                        💊 {m.medicineCard.name}
                      </strong>
                      <span className={`badge ${m.medicineCard.covered ? 'bg-success' : 'bg-danger'} fw-bold px-1.5 py-0.5`} style={{ fontSize: '0.68rem' }}>
                        {m.medicineCard.covered ? `✅ Couvert : ${m.medicineCard.rate}%` : '❌ 0% (Non couvert)'}
                      </span>
                    </div>
                    <div className="small text-muted mb-1" style={{ fontSize: '0.74rem' }}>
                      <strong>DCI :</strong> {m.medicineCard.dci}
                    </div>
                    <p className="small mb-2" style={{ fontSize: '0.76rem', lineHeight: '1.3', color: 'var(--text-main)' }}>
                      {m.medicineCard.desc}
                    </p>
                    {m.medicineCard.covered && (
                      <button 
                        type="button"
                        className="btn btn-sm btn-success fw-bold w-100 py-1"
                        style={{ fontSize: '0.74rem', borderRadius: '6px', background: '#059669', border: 'none' }}
                        onClick={() => {
                          if (setView) setView('purchase-orders');
                          setIsOpen(false);
                        }}
                      >
                        🧾 Générer Bon de commande (50%) ➔
                      </button>
                    )}
                  </div>
                )}

                {/* Carte Interactive des Structures */}
                {m.showMap && (
                  <div className="mt-2 p-2 rounded-3 shadow-sm" style={{ background: 'var(--bg-card, #ffffff)', border: '1.5px solid #10b981', borderRadius: '12px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1.5 pb-1 border-bottom">
                      <strong style={{ fontSize: '0.80rem', color: '#047857' }}>🗺️ Réseau conventionné Dakar</strong>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success py-0 px-1.5 fw-bold"
                        style={{ fontSize: '0.68rem', borderRadius: '4px' }}
                        onClick={() => {
                          if (setView) setView('cartographie');
                          setIsOpen(false);
                        }}
                      >
                        Plein écran ↗
                      </button>
                    </div>

                    <div className="d-flex gap-1 mb-1.5 overflow-x-auto pb-1">
                      <button type="button" className={`btn btn-sm px-1.5 py-0.5 fw-bold ${mapFilter === 'all' ? 'btn-success' : 'btn-outline-secondary'}`} style={{ fontSize: '0.66rem', borderRadius: '4px', whiteSpace: 'nowrap' }} onClick={() => setMapFilter('all')}>Tous</button>
                      <button type="button" className={`btn btn-sm px-1.5 py-0.5 fw-bold ${mapFilter === 'hospital' ? 'btn-success' : 'btn-outline-secondary'}`} style={{ fontSize: '0.66rem', borderRadius: '4px', whiteSpace: 'nowrap' }} onClick={() => setMapFilter('hospital')}>🏥 Hôpitaux (80%)</button>
                      <button type="button" className={`btn btn-sm px-1.5 py-0.5 fw-bold ${mapFilter === 'pharmacy' ? 'btn-success' : 'btn-outline-secondary'}`} style={{ fontSize: '0.66rem', borderRadius: '4px', whiteSpace: 'nowrap' }} onClick={() => setMapFilter('pharmacy')}>💊 Pharmacies (50%)</button>
                      <button type="button" className={`btn btn-sm px-1.5 py-0.5 fw-bold ${mapFilter === 'msd' ? 'btn-success' : 'btn-outline-secondary'}`} style={{ fontSize: '0.66rem', borderRadius: '4px', whiteSpace: 'nowrap' }} onClick={() => setMapFilter('msd')}>🏢 MSD</button>
                    </div>

                    <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {filteredStructures.slice(0, 8).map(st => (
                        <div key={st.id} className="p-1.5 rounded-2 border" style={{ background: 'var(--bg-card-subtle, #f8fafc)', borderColor: 'var(--border-color, #e2e8f0)', fontSize: '0.72rem' }}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <strong style={{ color: '#0f172a' }}>{st.name}</strong>
                              <div className="text-muted" style={{ fontSize: '0.66rem' }}>📍 {st.commune}</div>
                            </div>
                            <span className="badge bg-success-subtle text-success fw-bold" style={{ fontSize: '0.60rem' }}>
                              {st.rate.includes('80%') ? '80% Hôpital' : st.rate.includes('50%') ? '50% Pharm' : 'MSD'}
                            </span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center mt-1 pt-1 border-top" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                            <span className="text-muted" style={{ fontSize: '0.66rem' }}>📞 {st.phone}</span>
                            <a href={`tel:${st.phone.replace(/[^0-9+]/g, '')}`} className="badge bg-primary text-white text-decoration-none px-1.5 py-0.5" style={{ fontSize: '0.62rem' }}>
                              Appeler
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            {isTyping && (
              <div className="chatbot-msg bot" style={{ alignSelf: 'flex-start' }}>
                <div className="chatbot-msg-header">
                  <span className="chatbot-msg-name fw-bold" style={{ fontSize: '0.72rem', color: '#047857' }}>Zahara</span>
                </div>
                <div className="chatbot-typing p-1.5 bg-light rounded-3 d-flex gap-1 align-items-center">
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Raccourcis Compacts (Repliables pour gain d'espace maximal) */}
          <div style={{ padding: '0.35rem 0.65rem', backgroundColor: 'var(--bg-card, #ffffff)', borderTop: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-bold text-muted" style={{ fontSize: '0.68rem' }}>
                ⚡ Raccourcis Assuré :
              </span>
              <button 
                type="button" 
                className="btn btn-sm p-0 text-muted" 
                style={{ fontSize: '0.66rem', textDecoration: 'underline', border: 'none', background: 'none' }}
                onClick={() => setIsActionsCollapsed(!isActionsCollapsed)}
              >
                {isActionsCollapsed ? 'Afficher +' : 'Masquer −'}
              </button>
            </div>

            {!isActionsCollapsed && (
              <div style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '2px' }}>
                <button type="button" className="btn btn-sm btn-outline-success py-0.5 px-2 fw-bold text-nowrap" style={{ fontSize: '0.68rem', borderRadius: '6px' }} onClick={() => handleActionClick('meds')}>💊 Médicament (50%)</button>
                <button type="button" className="btn btn-sm btn-outline-success py-0.5 px-2 fw-bold text-nowrap" style={{ fontSize: '0.68rem', borderRadius: '6px' }} onClick={() => handleActionClick('order')}>🧾 Bon (50%)</button>
                <button type="button" className="btn btn-sm btn-outline-success py-0.5 px-2 fw-bold text-nowrap" style={{ fontSize: '0.68rem', borderRadius: '6px' }} onClick={() => handleActionClick('guarantee')}>🏥 Garantie (80%)</button>
                <button type="button" className="btn btn-sm btn-outline-success py-0.5 px-2 fw-bold text-nowrap" style={{ fontSize: '0.68rem', borderRadius: '6px' }} onClick={() => handleActionClick('map')}>🗺️ Carte</button>
                <button type="button" className="btn btn-sm btn-outline-secondary py-0.5 px-2 fw-bold text-nowrap" style={{ fontSize: '0.68rem', borderRadius: '6px' }} onClick={() => handleActionClick('card')}>🪪 Carte CSU</button>
                <button type="button" className="btn btn-sm btn-outline-secondary py-0.5 px-2 fw-bold text-nowrap" style={{ fontSize: '0.68rem', borderRadius: '6px' }} onClick={() => handleActionClick('cotis')}>💳 Cotisation</button>
              </div>
            )}
          </div>

          {/* Barre de Saisie & Envoi */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(inputVal); }}
            className="chatbot-input-area"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.65rem', background: 'var(--bg-card, #ffffff)', borderTop: '1px solid var(--border-color, #e2e8f0)', flexShrink: 0 }}
          >
            <button
              type="button"
              className={`chatbot-mic ${oralMode ? 'listening' : ''}`}
              onClick={toggleOralMode}
              title={oralMode ? t.oralOn : t.oralOff}
              aria-label="Conversation orale mains libres"
              style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #10b981', background: oralMode ? '#059669' : 'transparent', color: oralMode ? '#ffffff' : '#059669', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}
            >
              🎧
            </button>

            <button 
              type="button" 
              className={`chatbot-mic ${isListening ? 'listening' : ''}`}
              onClick={toggleListening}
              title={isListening ? 'Écoute active' : 'Parler au micro'}
              aria-label="Microphone"
              style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #cbd5e1', background: isListening ? '#dc2626' : 'transparent', color: isListening ? '#ffffff' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}
            >
              {isListening ? '🛑' : '🎤'}
            </button>

            <button
              type="button"
              onClick={() => {
                const newLang = speechLang === 'fr' ? 'wo' : 'fr';
                setSpeechLang(newLang);
                setChatLang(newLang);
              }}
              style={{ width: '30px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-color, #cbd5e1)', background: 'transparent', color: '#047857', fontWeight: '800', fontSize: '0.68rem', cursor: 'pointer', flexShrink: 0 }}
            >
              {speechLang.toUpperCase()}
            </button>

            <input 
              ref={inputRef}
              type="text" 
              className="chatbot-input form-control form-control-sm" 
              placeholder={isListening ? (chatLang === 'fr' ? "🎤 Écoute en cours... (ou tapez ici)" : "🎤 Mungi déglu... (walla bindal fi)") : t.placeholder}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{ borderRadius: '8px', fontSize: '0.80rem', height: '32px' }}
            />

            <button 
              type="submit" 
              className="btn btn-success btn-sm fw-bold px-2.5 shadow-sm" 
              aria-label="Envoyer" 
              disabled={!inputVal.trim()}
              style={{ borderRadius: '10px', minHeight: '38px', background: '#059669', borderColor: '#059669' }}
            >
              ➔
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
