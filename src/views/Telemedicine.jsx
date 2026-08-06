import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { initiatePayment, getProviderInfo, validatePhoneForProvider } from '../services/paymentService';
import { speakCleanText } from '../services/voiceAudioService';

// Design Premium Haut de Gamme — Télémédecine Visioconférence Bidirectionnelle & Vu-mètre Micro Réel
export default function Telemedicine({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles (cohérent avec MedicalProfile)
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isDoctor     = userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin'));
  const isMidwife    = userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage'));
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isSuperAdmin)) && !isSuperAdmin;
  const isPharmacist = userRole === 'pharmacist';
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && (!!citizenUser && (userRole === 'citizen' || userRole === 'citizen_suspended'));
  // Alias rétro-compatibilité
  const isDoctorOrPartner = isDoctor || isMidwife;
  // Peut démarrer une consultation / émettre ordonnance numérique
  const canConsult = isDoctor || isMidwife || isSuperAdmin;
  // Peut gérer la file d'attente / planning (administratif)
  const canManageQueue = isAgent || isSuperAdmin;
  // Vérification cotisation payée pour le citoyen (salle d'attente)
  const isSuspended = (
    userRole === 'citizen_suspended' ||
    citizenUser?.status === 'suspended' ||
    citizenUser?.status === 'inactif' ||
    citizenUser?.status === 'suspendu' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  // Assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Awa';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Ndiaye';

  // Mode de rôle (Assuré, Médecin/Sage-femme de garde). L'agent reste en vue administrative.
  const [roleMode, setRoleMode] = useState((isDoctor || isMidwife) ? 'doctor' : (isSuperAdmin ? 'doctor' : 'citizen'));
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Swap Main Screen vs PIP Screen
  const [swappedViews, setSwappedViews] = useState(false);

  // Liste des Praticiens Agréés (Persistée localement pour chaque Union Départementale)
  const defaultDoctorsList = [
    {
      id: 1,
      name: 'Dr. Ousmane Sow',
      specialty: 'Médecine générale & urgences',
      category: 'generaliste',
      rating: '4.9 (124 avis)',
      cnom: 'CNOM: 4522-SN',
      langs: ['FR', 'WO', 'EN'],
      department: 'Dakar Centre (Médina / Plateau)',
      avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180',
      available: true
    },
    {
      id: 2,
      name: 'Dr. Fatou Diop',
      specialty: 'Gynécologie & obstétrique',
      category: 'pediatrie',
      rating: '5.0 (89 avis)',
      cnom: 'CNOM: 3108-SN',
      langs: ['FR', 'WO'],
      department: 'Pikine & Guédiawaye',
      avatar: '/dr_fatou_diop.png',
      available: true
    },
    {
      id: 3,
      name: 'Dr. Cheikh Tidiane Seck',
      specialty: 'Cardiologie & médecine interne',
      category: 'cardio',
      rating: '4.8 (96 avis)',
      cnom: 'CNOM: 9921-SN',
      langs: ['FR', 'WO'],
      department: 'Rufisque & Bargny',
      avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=180',
      available: true
    }
  ];

  const [doctorsList, setDoctorsList] = useState(() => {
    try {
      const saved = localStorage.getItem('cmu-doctors-list');
      return saved ? JSON.parse(saved) : defaultDoctorsList;
    } catch (e) {
      return defaultDoctorsList;
    }
  });

  // Sauvegarde automatique de la liste des médecins
  useEffect(() => {
    try {
      localStorage.setItem('cmu-doctors-list', JSON.stringify(doctorsList));
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  }, [doctorsList]);

  // Formulaire d'ajout Médecin par l'Agent de l'Union Départementale
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpecialty, setNewDocSpecialty] = useState('Médecine Générale');
  const [newDocCategory, setNewDocCategory] = useState('generaliste');
  const [newDocCnom, setNewDocCnom] = useState('');
  const [newDocDept, setNewDocDept] = useState('Union Départementale Dakar');
  const [newDocLangs, setNewDocLangs] = useState('FR, WO');
  const [newDocAvatar, setNewDocAvatar] = useState('https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=180');

  // Détails CNOM Médecin pour la modale d'accréditation
  const [selectedCnomDoctor, setSelectedCnomDoctor] = useState(null);

  // File d'attente Télémédecine (Vide pour l'utilisateur tant qu'il n'a pas payé)
  const [queue, setQueue] = useState([
    {
      id: 2,
      patient_name: 'Moussa Diallo',
      cmu_number: 'CMU-DKR-2026-3392',
      reason: 'Oppression thoracique & fièvre 39.2°C',
      urgency: 'critical',
      joined_at: new Date(Date.now() - 12 * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      requested_doctor: 'Dr. Cheikh Tidiane Seck',
      payment_status: 'paid',
      payment_method: 'Wave',
      amount: 2500
    }
  ]);

  // Modales uniques
  const [activeModal, setActiveModal] = useState(null); // 'join_queue', 'payment', 'webrtc', 'qr', 'prescription'

  // Toast de notification
  const [notifToast, setNotifToast] = useState(null); // { type, title, message, icon }
  const toastTimerRef = useRef(null);
  const lastQueueStatusRef = useRef(null);

  // Carillon sonore Web Audio API
  const playAlertChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Ré (D5)
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // La (A5)
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Chime audio non disponible:", e);
    }
  };

  // Annonce vocale + Carillon sonore + Toast (Web Speech API + Web Audio API)
  const speakAndToast = (toast) => {
    // Jouer le carillon sonore
    playAlertChime();

    // Afficher le beau toast
    setNotifToast(toast);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setNotifToast(null), 5000);

    // Voix naturelle via backend TTS (ElevenLabs/Open-Source) avec repli speechSynthesis
    speakCleanText(toast.speech || toast.message, 'fr');
  };

  // Modale Inscription
  const [consultReason, setConsultReason] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('routine');
  const [selectedDoctor, setSelectedDoctor] = useState(doctorsList[0]);

  // Modale Paiement
  const [paymentProvider, setPaymentProvider] = useState('orange');
  const [phoneNum, setPhoneNum] = useState('77 602 67 83');

  // ── Pipeline de Paiement Multi-Étapes ──────────────────────────────────────
  // 'form' | 'processing' | 'success' | 'error'
  const [payStep, setPayStep] = useState('form');
  const [txnResult, setTxnResult] = useState(null); // { ref, provider, phone, amount, timestamp, message }
  const [phoneError, setPhoneError] = useState('');

  // Session WebRTC
  const [activeDoctor, setActiveDoctor] = useState(doctorsList[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [useSimulatedFeed, setUseSimulatedFeed] = useState(false);

  // Vu-mètre Niveau Audio Microphone (0 - 100%)
  const [micVolume, setMicVolume] = useState(0);

  const [chatMessages, setChatMessages] = useState([
    { sender: 'Dr. Ousmane Sow', text: 'Bonjour Awa. Je vous entends très bien. Je consulte votre dossier médical.' }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Refs WebRTC
  const userVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Démarrage WebRTC physique
  const startCamera = async () => {
    setCameraActive(false);
    setUseSimulatedFeed(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("API WebRTC non disponible");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
        audio: true 
      });
      streamRef.current = stream;
      setCameraActive(true);
      setIsCamOff(false);
      setIsMuted(false);

      // Liaison avec le composant vidéo <video>
      const attachInterval = setInterval(() => {
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
          userVideoRef.current.play().catch(e => console.warn(e));
          clearInterval(attachInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(attachInterval), 3000);

    } catch (err) {
      console.warn("Hardware camera blocked, fallback to HD Canvas Simulator:", err);
      setUseSimulatedFeed(true);
      setCameraActive(true);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (activeModal === 'webrtc') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeModal]);

  // Analyseur Web Audio API en Temps Réel (VU-mètre Microphone)
  useEffect(() => {
    if (activeModal === 'webrtc' && cameraActive && streamRef.current && !isMuted) {
      let audioCtx = null;
      let animId = null;

      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        const microphone = audioCtx.createMediaStreamSource(streamRef.current);
        microphone.connect(analyser);
        analyser.fftSize = 128;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          setMicVolume(Math.min(100, Math.round((avg / 100) * 100)));
          animId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (e) {
        console.warn("AudioContext error:", e);
      }

      return () => {
        if (animId) cancelAnimationFrame(animId);
        if (audioCtx) audioCtx.close().catch(() => {});
      };
    } else {
      setMicVolume(0);
    }
  }, [activeModal, cameraActive, isMuted]);

  // Suivi dynamique automatique de la file d'attente pour tous les assurés
  useEffect(() => {
    if (!activeCmuNumber && !activeFirstName) return;
    const myQueueEntry = queue.find(p => p.cmu_number === activeCmuNumber || (p.patient_name && p.patient_name.includes(activeFirstName)));
    if (!myQueueEntry) return;

    if (myQueueEntry.status === 'next' && lastQueueStatusRef.current !== 'next') {
      speakAndToast({
        type: 'warning',
        icon: '🔔',
        title: 'Alerte préalable salle d\'attente',
        message: 'Vous êtes le prochain patient. Préparez votre casque, votre micro et votre caméra.',
        speech: `Attention ${activeFirstName} ${activeLastName}. Vous êtes le prochain patient dans la salle d'attente virtuelle. Veuillez préparer votre casque, votre micro et votre caméra. Le médecin va vous recevoir dans un instant.`
      });
      lastQueueStatusRef.current = 'next';
    } else if (myQueueEntry.status === 'called' && lastQueueStatusRef.current !== 'called') {
      speakAndToast({
        type: 'success',
        icon: '🏥',
        title: "C'est votre tour !",
        message: 'Le médecin vous appelle en visioconférence HD.',
        speech: `${activeFirstName}, c'est votre tour. Le médecin est prêt à vous recevoir. La consultation de télémédecine commence maintenant. Bienvenue.`
      });
      lastQueueStatusRef.current = 'called';
    }
  }, [queue, activeCmuNumber, activeFirstName, activeLastName]);

  // Canvas Rendu Vidéo Médical HD (60fps) quand la webcam physique est absente
  useEffect(() => {
    if (activeModal === 'webrtc' && useSimulatedFeed && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      let angle = 0;

      const render = () => {
        angle += 0.05;
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Grille de fond
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Onde ECG
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let x = 0; x < canvas.width; x += 5) {
          const y = canvas.height / 2 + Math.sin((x * 0.02) + angle) * 35;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Overlay Texte
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.fillText('● FLUX VISIOCONFÉRENCE HD (EN DIRECT)', 20, 35);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px Inter, sans-serif';
        ctx.fillText(`Patient : ${activeFirstName} ${activeLastName} (CMU: ${activeCmuNumber})`, 20, 60);

        animFrameRef.current = requestAnimationFrame(render);
      };

      render();

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }
  }, [activeModal, useSimulatedFeed, activeFirstName, activeLastName, activeCmuNumber]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
    }
  };

  const toggleCamera = () => {
    const next = !isCamOff;
    setIsCamOff(next);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => t.enabled = !next);
    }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!consultReason.trim()) return;

    // Validation du numéro de téléphone
    const validation = validatePhoneForProvider(phoneNum, paymentProvider);
    if (!validation.valid) {
      setPhoneError(validation.error);
      return;
    }
    setPhoneError('');

    const providerInfo = getProviderInfo(paymentProvider);
    const targetDoc = selectedDoctor || doctorsList[0];

    // Étape 1 : afficher le spinner de traitement
    setPayStep('processing');

    // Étape 2 : appeler le service de paiement (mock ou réel)
    const result = await initiatePayment({
      provider: paymentProvider,
      phone: phoneNum,
      amount: 2500,
      orderId: activeCmuNumber,
    });

    if (result.success) {
      // Étape 3 : paiement réussi — enregistrer dans la file
      const positionNum = queue.length + 1;
      const newPatient = {
        id: Date.now(),
        patient_name: `${activeFirstName} ${activeLastName}`,
        cmu_number: activeCmuNumber,
        reason: consultReason,
        urgency: urgencyLevel,
        joined_at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        requested_doctor: targetDoc.name,
        payment_status: 'paid',
        payment_method: providerInfo.name,
        payment_ref: result.transactionRef,
        amount: 2500,
        status: 'waiting',
      };
      setQueue([...queue, newPatient]);
      setActiveDoctor(targetDoc);
      setTxnResult({ ...result, positionNum });
      setPayStep('success');

      // Toast vocal de confirmation
      speakAndToast({
        type: 'success',
        icon: '✅',
        title: 'Paiement confirmé !',
        message: `2 500 FCFA réglés via ${providerInfo.name}. Position n°${positionNum}.`,
        speech: `Paiement confirmé. Référence ${result.transactionRef}. Vous êtes en position numéro ${positionNum} dans la salle d'attente.`
      });
    } else {
      // Étape 3 : paiement échoué
      setTxnResult(result);
      setPayStep('error');
    }
  };

  const resetPaymentModal = () => {
    setPayStep('form');
    setTxnResult(null);
    setPhoneError('');
    setActiveModal(null);
    setConsultReason('');
  };

  // Simulation d'avancement de la file d'attente pour test rapide
  const handleAdvanceMyQueue = (patientId) => {
    setQueue(prevQueue => prevQueue.map(p => {
      if (p.id === patientId || p.cmu_number === activeCmuNumber) {
        if (p.status === 'waiting') {
          speakAndToast({
            type: 'warning',
            icon: '🔔',
            title: 'Alerte préalable',
            message: 'Vous êtes le prochain patient. Préparez votre micro et votre caméra.',
            speech: `Attention ${activeFirstName}. Vous êtes le prochain patient. Veuillez préparer votre micro et votre caméra. Le médecin va vous recevoir dans un instant.`
          });
          return { ...p, status: 'next' };
        }
        if (p.status === 'next') {
          speakAndToast({
            type: 'success',
            icon: '🏥',
            title: "C'est votre tour !",
            message: 'Le médecin est prêt à vous recevoir. La consultation commence maintenant.',
            speech: `${activeFirstName}, c'est votre tour. Le médecin est prêt à vous recevoir. La consultation de télémédecine commence maintenant. Bienvenue.`
          });
          return { ...p, status: 'called' };
        }
        return { ...p, status: 'called' };
      }
      return p;
    }));
  };


  const handleStartCall = (doc) => {
    setActiveDoctor(doc);
    setActiveModal('webrtc');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    setChatMessages([...chatMessages, { sender: `${activeFirstName} ${activeLastName}`, text: inputMsg }]);
    setInputMsg('');
  };

  const handleDownloadPrescription = () => {
    generateOfficialPdf({
      filename: 'ordonnance_telemedecine_bon_pharmacie_50.pdf',
      docType: 'ORDONNANCE MÉDICALE DE TÉLÉMÉDECINE CERTIFIÉE',
      title: 'Ordonnance Électronique & Bon Pharmacie 50%',
      referenceNo: 'ORD-TELEMED-2026-9912',
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: 'Pharmacies Agréées Tiers-Payant UNAMUSC',
      details: [
        { label: 'Patient(e) Bénéficiaire', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'Médecin Prescripteur', value: 'Dr. Ousmane Sow (Médecin Généraliste - CNOM: 4522-SN)' },
        { label: 'Médicaments Prescrits', value: '1. Amoxicilline 500mg (2 boîtes) — 1 gélule 3x/jour pendant 7 jours\n2. Paracétamol 1g (1 boîte) — 1 comprimé en cas de fièvre' },
        { label: 'Couverture Pharmacie UNAMUSC', value: '50% Remboursement / Prise en charge directe Tiers-Payant' },
        { label: 'Validité de l\'Ordonnance', value: 'Valable 30 jours dans toutes les pharmacies agréées du Sénégal' }
      ],
      notes: 'Cette ordonnance médicale numérique numérotée comporte la signature et le visa CNOM du médecin prescripteur.'
    });
  };

  const handleAddDoctor = (e) => {
    e.preventDefault();
    if (!newDocName) return;
    const newDoc = {
      id: Date.now(),
      name: newDocName,
      specialty: newDocSpecialty,
      category: newDocCategory,
      rating: '5.0 (Nouveau)',
      cnom: newDocCnom || 'CNOM: 2026-SN',
      langs: newDocLangs.split(',').map(s => s.trim()),
      department: newDocDept,
      avatar: newDocAvatar,
      available: true
    };
    setDoctorsList([newDoc, ...doctorsList]);
    setActiveModal(null);
    setNewDocName('');
    alert('✅ Nouveau médecin praticien ajouté au réseau UNAMUSC avec succès !');
  };

  const filteredDoctors = doctorsList.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || d.category === activeCategory;
    return matchSearch && matchCat;
  });

  // Guard de confidentialité : si l'utilisateur n'est pas connecté, masquer les données de santé
  if (!citizenUser && !agentUser && !partnerUser && userRole !== 'agent' && userRole !== 'partner' && userRole !== 'doctor') {
    return (
      <div className="telemed-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header Banner */}
          <div className="p-5 rounded-4 text-center text-white mb-4" style={{
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.82) 0%, rgba(4, 120, 87, 0.88) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
            <span className="badge mb-2" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>
              Protection du secret médical & données de santé
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#fff', fontSize: '2rem' }}>
              Accès sécurisé — télémédecine UNAMUSC 24h/7
            </h2>
            <p className="small mb-4" style={{ color: '#ecfdf5', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
              Afin de préserver la confidentialité absolue des consultations médicales, des ordonnances numérisées et du secret professionnel au Sénégal, la salle d'attente virtuelle et le réseau de médecins agréés sont réservés aux assurés et professionnels identifiés.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-light fw-bold px-4 py-3" 
                style={{ borderRadius: '14px', color: '#047857', fontSize: '0.98rem', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                onClick={() => setView ? setView('login') : (window.location.hash = '#/login')}
              >
                🔐 Se connecter à mon espace assuré / agent
              </button>
            </div>
          </div>

          {/* Quick Search Card */}
          <div className="card p-4 mb-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.75rem' }}>
              🔎 Accès rapide avec mon n° de carte CMU
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.25rem' }}>
              Saisissez votre matricule d'assuré social pour vérifier vos droits à la téléconsultation prise en charge à 80% par l'UNAMUSC.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ex: CMU-DKR-2026-8812"
                style={{ flex: 1, minWidth: '240px', fontSize: '0.9rem' }}
              />
              <button 
                className="btn btn-primary fw-bold px-4"
                style={{ borderRadius: '10px' }}
                onClick={() => setView ? setView('login') : (window.location.hash = '#/login')}
              >
                Vérifier mes droits & consulter
              </button>
            </div>
          </div>

          {/* Service Features Grid */}
          <div className="grid grid-3" style={{ gap: '1.25rem' }}>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🩺</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Médecins agréés CNOM</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Consultation vidéo WebRTC en moins de 10 min avec des praticiens inscrits au Conseil National de l'Ordre des Médecins.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📜</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Ordonnances certifiées QR code</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Délivrance instantanée de prescriptions valables dans toutes les pharmacies partenaires de Dakar avec Tiers-Payant.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>💳</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Tiers-payant 80% CMU</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Tarif réglementé de 2 500 FCFA pris en charge par l'Union Régionale des Mutuelles de Santé de Dakar.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PHARMACIEN : non concerné par la télémédecine ──
  if (isPharmacist) {
    return (
      <div className="telemed-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="p-5 rounded-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💊</div>
            <span className="badge mb-3 d-inline-block" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>Pharmacien Agréé UNAMUSC</span>
            <h2 className="fw-bold mb-3" style={{ color: '#fff', fontSize: '1.8rem' }}>Télémédecine — Non concerné</h2>
            <p className="mb-4" style={{ color: '#d1fae5', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              La télémédecine est réservée aux assurés et aux médecins/sage-femmes agréés. Votre espace pharmacien est dédié à la validation des bons de commande médicaments.
            </p>
            <button className="btn btn-light fw-bold px-4 py-3" style={{ borderRadius: '12px', color: '#047857' }} onClick={() => (window.location.hash = '#/purchase-orders')}>
              💊 Accéder à mes Bons de Commande
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCitizen && isSuspended) {
    return (
      <div className="telemed-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès aux soins refusé — Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. Tous vos droits et accès aux services de télémédecine sont suspendus.
              <br />
              <strong className="d-block mt-2 text-danger">Veuillez régulariser votre cotisation et celui des membres de votre famille pour un montant de 10 500 FCFA.</strong>
            </p>

            <div className="d-flex justify-content-center gap-3">
              <button 
                type="button" 
                className="btn btn-emerald btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-2 shadow"
                style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', borderRadius: '16px', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)' }}
                onClick={() => {
                  localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                    cmuNumber: activeCmuNumber,
                    amount: 10500,
                    familyCount: 3,
                    firstName: activeFirstName,
                    lastName: activeLastName
                  }));
                  if (setView) setView('payments');
                  window.location.hash = '#payments';
                }}
              >
                💳 Renouveler ma cotisation (10 500 FCFA)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="telemed-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Télémédecine UNAMUSC 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'var(--border-color)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.75rem' }}>
              ● SALLE D'ATTENTE VIRTUELLE LIVE
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Badge / toggle selon le rôle */}
            {isCitizen && (
              <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.8rem' }}>
                🟢 Espace assuré (connecté)
              </span>
            )}
            {isPharmacist && (
              <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.8rem' }}>
                💊 Pharmacien — Accès limité
              </span>
            )}
            {isSuperAdmin && (
              <span className="badge px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.8rem', background: 'rgba(234,179,8,0.2)', color: '#92400e', border: '1px solid rgba(234,179,8,0.4)' }}>
                👑 SuperAdmin
              </span>
            )}
            {canManageQueue && !isSuperAdmin && (
              <span className="badge px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.8rem', background: 'rgba(30,58,95,0.15)', color: '#1e3a5f', border: '1px solid rgba(30,58,95,0.3)' }}>
                🛡️ Agent — Gestion file d'attente
              </span>
            )}
            {/* Toggle disponible seulement si l'utilisateur peut réellement consulter (médecin/sage-femme/superadmin) */}
            {canConsult && (
              <>
                {isSuperAdmin && (
                  <button
                    type="button"
                    style={{ background: roleMode === 'citizen' ? '#10b981' : 'var(--bg-card)', color: roleMode === 'citizen' ? '#ffffff' : 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                    onClick={() => setRoleMode('citizen')}
                  >
                    Vue assuré
                  </button>
                )}
                <button
                  type="button"
                  style={{ background: roleMode === 'doctor' ? '#10b981' : 'var(--bg-card)', color: roleMode === 'doctor' ? '#ffffff' : 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                  onClick={() => setRoleMode('doctor')}
                >
                  Espace {isMidwife ? 'sage-femme' : 'médecin'} de garde
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-4 p-md-5 rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat', padding: '3.75rem 2.5rem', minHeight: '240px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }}>
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span style={{ background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.85rem', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                🇸🇳 SALLE D'ATTENTE VIRTUELLE UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.4rem', letterSpacing: '-0.02em', textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>Consultation instantanée 24h/7</h1>
              <p className="text-white mb-4" style={{ fontSize: '1.08rem', maxWidth: '740px', lineHeight: '1.6', textShadow: '0 2px 4px rgba(0,0,0,0.3)', opacity: 0.95 }}>
                Accédez à un réseau de médecins agréés en moins de 10 minutes. Vidéoconférence HD WebRTC sécurisée et cryptée.
              </p>
              
              <div className="d-flex gap-3 flex-wrap mt-3">
                <button
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '14px', padding: '0.9rem 1.85rem', fontWeight: '800', fontSize: '0.98rem', boxShadow: '0 4px 20px rgba(16,185,129,0.45)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                  onClick={() => setActiveModal('join_queue')}
                >
                  ⚡ Entrer en salle d'attente
                </button>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="p-4 rounded-4" style={{ background: 'rgba(255, 255, 255, 0.22)', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)', backdropFilter: 'blur(10px)' }}>
                <div className="d-flex align-items-center justify-content-between gap-2 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.6rem' }}>
                  <span
                    className="fw-bold text-white d-inline-flex align-items-center gap-1.5"
                    style={{ fontSize: '0.92rem', letterSpacing: '0.3px', cursor: 'pointer' }}
                    onClick={() => setActiveModal('all_doctors')}
                    title="Cliquer pour voir la liste complète des 15 médecins"
                  >
                    🟢 15 médecins en ligne
                  </span>
                  <span style={{ background: '#10b981', color: '#ffffff', fontSize: '0.75rem', fontWeight: '700', padding: '0.35rem 0.75rem', borderRadius: '20px', whiteSpace: 'nowrap', display: 'inline-block' }}>
                    Disponible 24/7
                  </span>
                </div>

                <div className="d-flex align-items-center gap-2 my-2">
                  <div className="d-flex" style={{ marginLeft: '10px' }}>
                    {doctorsList.map((d, i) => (
                      <img 
                        key={d.id || i} 
                        src={d.avatar} 
                        onError={(e) => { e.target.src = '/mariama_avatar.png'; }} 
                        alt={d.name} 
                        title={`Consulter ${d.name}`} 
                        style={{ width: '38px', height: '38px', borderRadius: '50%', border: '2px solid #ffffff', marginLeft: '-10px', objectFit: 'cover', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedDoctor(d);
                          setActiveModal('join_queue');
                        }} 
                      />
                    ))}
                    <div 
                      style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#047857', border: '2px solid #ffffff', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '-10px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', cursor: 'pointer' }}
                      onClick={() => setActiveModal('all_doctors')}
                      title="Voir les 15 médecins disponibles de la région"
                    >
                      +12
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-top border-white border-opacity-25">
                  <div className="text-white fw-semibold" style={{ fontSize: '0.88rem', lineHeight: '1.7', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {doctorsList.map((d, idx) => (
                      <span
                        key={d.id || idx}
                        style={{ cursor: 'pointer', marginRight: '0.5rem', marginBottom: '0.35rem', display: 'inline-block', padding: '0.2rem 0.55rem', background: 'rgba(255,255,255,0.12)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}
                        onClick={() => {
                          setSelectedDoctor(d);
                          setActiveModal('join_queue');
                        }}
                      >
                        {d.name}
                      </span>
                    ))}
                  </div>
                  <small className="text-white-50 d-block mt-2" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>Temps d'attente estimé : <span className="fw-bold text-warning" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>⚡ 4 min</span></small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SALLE D'ATTENTE VIRTUELLE & BANNER NOTIFICATION PATIENT */}
        {(() => {
          const myIndex = queue.findIndex(q => q.cmu_number === activeCmuNumber || q.patient_name.includes(activeLastName));
          if (myIndex === -1) return null;
          
          const myItem = queue[myIndex];
          const positionInQueue = myIndex + 1;
          const status = myItem.status || 'waiting';

          // Cas 1 : En attente dans la file (Position > 1 ou Attente simple)
          if (status === 'waiting' && positionInQueue > 1) {
            return (
              <div className="p-4 rounded-4 mb-5 text-white shadow-lg position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '24px', border: '2px solid #059669', boxShadow: '0 10px 30px rgba(5,150,105,0.2)' }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-success text-white fw-bold px-3 py-1.5" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
                        🟢 EN SALLE D'ATTENTE VIRTUELLE (RÈGLEMENT EFFECTUÉ - 2 500 FCFA)
                      </span>
                    </div>
                    <h4 className="fw-extrabold mb-1 text-white">
                      Vous êtes à la Position <span className="text-warning">n°{positionInQueue}</span> dans l'ordre d'arrivée
                    </h4>
                    <p className="mb-0 text-white-50 small">
                      Médecin demandé : <strong>{myItem.requested_doctor}</strong> | Motif : {myItem.reason} | Mode de règlement : {myItem.payment_method}
                    </p>
                    <small className="text-emerald-400 d-block mt-1 fw-semibold" style={{ color: '#34d399' }}>
                      ⚡ Temps d'attente estimé : ~{positionInQueue * 4} minutes. Vous serez notifié(e) automatiquement avant votre passage.
                    </small>
                  </div>

                  <div className="d-flex flex-column gap-2 align-items-end">
                    <button
                      type="button"
                      className="btn btn-secondary text-white fw-bold px-4 py-2 opacity-75"
                      style={{ borderRadius: '12px', fontSize: '0.88rem', cursor: 'not-allowed' }}
                      disabled
                    >
                      ⏳ En attente de votre tour (Position n°{positionInQueue})
                    </button>
                    
                    {/* Bouton de simulation pour test utilisateur */}
                    <button
                      type="button"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => handleAdvanceMyQueue(myItem.id)}
                      title="Cliquer pour simuler le passage du temps et recevoir la notification du médecin"
                    >
                      ⏩ Simuler l'avancement de mon tour (Test Démo)
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Cas 2 : Prochain patient (Position 1 ou Statut 'next') — NOTIFICATION PRÉALABLE
          if (status === 'next' || (status === 'waiting' && positionInQueue === 1)) {
            return (
              <div className="p-4 rounded-4 mb-5 text-white shadow-lg position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', borderRadius: '24px', border: '2px solid #f59e0b', boxShadow: '0 12px 35px rgba(245,158,11,0.35)' }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="spinner-grow spinner-grow-sm text-white" role="status"></span>
                      <span className="badge bg-white text-dark fw-extrabold px-3 py-1.5" style={{ borderRadius: '20px', fontSize: '0.82rem' }}>
                        🔔 ALERTE PRÉALABLE : VOUS ÊTES LE PROCHAIN PATIENT !
                      </span>
                    </div>
                    <h4 className="fw-extrabold mb-1 text-white">
                      Préparez votre micro et votre caméra 📹
                    </h4>
                    <p className="mb-0 text-white-50 small">
                      Le <strong>{myItem.requested_doctor}</strong> termine la consultation précédente et va vous recevoir d'un instant à l'autre.
                    </p>
                  </div>

                  <div className="d-flex flex-column gap-2 align-items-end">
                    <button
                      type="button"
                      className="btn btn-light text-warning fw-extrabold px-4 py-2.5 shadow"
                      style={{ borderRadius: '12px', fontSize: '0.9rem', cursor: 'pointer' }}
                      onClick={() => handleAdvanceMyQueue(myItem.id)}
                    >
                      📞 Simuler l'Appel du Médecin (C'est votre tour)
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Cas 3 : C'est votre tour ! (Statut 'called') — ACCÈS DIRECT À LA VISIOCONFÉRENCE
          return (
            <div className="p-4 rounded-4 mb-5 text-white shadow-lg position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', borderRadius: '24px', border: '2px solid #34d399', boxShadow: '0 15px 40px rgba(16,185,129,0.4)' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="spinner-grow spinner-grow-sm text-warning" role="status"></span>
                    <span className="badge bg-white text-success fw-extrabold px-3 py-1.5" style={{ borderRadius: '20px', fontSize: '0.85rem' }}>
                      🔔 C'EST VOTRE TOUR ! LE MÉDECIN VOUS APPELLE
                    </span>
                  </div>
                  <h4 className="fw-extrabold mb-1 text-white">
                    Le {myItem.requested_doctor} est prêt et vous attend en Salle de Consultation HD
                  </h4>
                  <p className="mb-0 text-white-50 small">
                    Règlement validé ({myItem.payment_method}) | Motif : {myItem.reason}
                  </p>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light text-success fw-extrabold px-4 py-3 shadow-lg"
                    style={{ borderRadius: '14px', fontSize: '1.05rem', cursor: 'pointer', border: '2px solid #ffffff' }}
                    onClick={() => {
                      const docObj = doctorsList.find(d => d.name === myItem.requested_doctor) || doctorsList[0];
                      setActiveDoctor(docObj);
                      startCamera();
                      setActiveModal('webrtc');
                    }}
                  >
                    🎥 ENTRER EN VISIOCONFÉRENCE DIRECTE ›
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SECTION GESTION ADMINISTRATIVE — Agent / SuperAdmin (file d'attente + planning) */}
        {canManageQueue && roleMode !== 'doctor' && (
          <div className="p-4 rounded-4 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
            <div className="d-flex align-items-center gap-2 mb-4">
              <span style={{ fontSize: '1.4rem' }}>🛡️</span>
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>
                Gestion administrative — File d'attente & planning Télémédecine
              </h5>
            </div>

            {/* KPIs administratifs */}
            <div className="row g-3 mb-4">
              <div className="col-md-3 col-6">
                <div className="p-3 rounded-4 text-center" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '1.6rem' }}>⏳</div>
                  <strong className="d-block fs-4 text-warning" style={{ color: '#f59e0b' }}>7</strong>
                  <small style={{ color: 'var(--text-sub)' }}>Patients en attente</small>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="p-3 rounded-4 text-center" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '1.6rem' }}>🩺</div>
                  <strong className="d-block fs-4 text-success">12</strong>
                  <small style={{ color: 'var(--text-sub)' }}>Consultations aujourd'hui</small>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="p-3 rounded-4 text-center" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '1.6rem' }}>👨‍⚕️</div>
                  <strong className="d-block fs-4" style={{ color: 'var(--text-main)' }}>5</strong>
                  <small style={{ color: 'var(--text-sub)' }}>Médecins de garde</small>
                </div>
              </div>
              <div className="col-md-3 col-6">
                <div className="p-3 rounded-4 text-center" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '1.6rem' }}>📅</div>
                  <strong className="d-block fs-4" style={{ color: 'var(--text-main)' }}>23</strong>
                  <small style={{ color: 'var(--text-sub)' }}>RDV planifiés (semaine)</small>
                </div>
              </div>
            </div>

            {/* Note administrative */}
            <div className="p-3 rounded-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderLeft: '4px solid #3b82f6' }}>
              <strong className="d-block small text-primary">📋 Vue administrative UNAMUSC</strong>
              <small style={{ color: 'var(--text-sub)' }}>
                Vous gérez le planning, l'historique et la supervision de la file d'attente. Les consultations cliniques sont réservées aux médecins et sage-femmes agréés.
              </small>
            </div>
          </div>
        )}

        {/* SECTION MÉDECINS DE GARDE / FILE D'ATTENTE */}
        {roleMode === 'doctor' && (
          <div className="p-4 rounded-4 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', borderRadius: '20px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
              <div>
                <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                  📋 File d'attente télémédecine (Ordre d'arrivée des patients)
                </h5>
                <small className="text-muted d-block" style={{ fontSize: '0.85rem' }}>
                  Ordre d'arrivée en temps réel des patients ayant réglé leur ticket modérateur
                </small>
              </div>

              {canManageQueue && (
                <button
                  type="button"
                  style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.6rem 1.1rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setActiveModal('add_doctor')}
                  title="Réservé à l'agent UDMS et au SuperAdmin — gestion du réseau de praticiens agréés"
                >
                  ➕ Ajouter un médecin (Union Départementale)
                </button>
              )}
            </div>

            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)', fontSize: '0.8rem', letterSpacing: '0.3px' }}>
                    <th style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>Position</th>
                    <th style={{ padding: '0.85rem' }}>Assuré</th>
                    <th style={{ padding: '0.85rem' }}>N° CSU</th>
                    <th style={{ padding: '0.85rem' }}>Motif & symptômes</th>
                    <th style={{ padding: '0.85rem' }}>Heure d'arrivée</th>
                    <th style={{ padding: '0.85rem' }}>Règlement</th>
                    <th style={{ padding: '0.85rem' }}>Statut</th>
                    <th style={{ padding: '0.85rem', textAlign: 'right' }}>Actions médecin</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((p, idx) => (
                    <tr key={p.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          background: idx === 0 ? 'linear-gradient(135deg, #059669, #10b981)' : 'var(--bg-card-subtle)', 
                          color: idx === 0 ? '#ffffff' : 'var(--text-main)', 
                          border: idx === 0 ? 'none' : '1px solid var(--border-color)',
                          width: '34px', 
                          height: '34px', 
                          borderRadius: '50%', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: '800', 
                          fontSize: '0.85rem',
                          boxShadow: idx === 0 ? '0 3px 10px rgba(16,185,129,0.35)' : 'none'
                        }}>
                          #{idx + 1}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <div className="fw-extrabold" style={{ color: 'var(--text-main)', fontSize: '0.96rem', marginBottom: '0.2rem' }}>
                          {p.patient_name}
                        </div>
                        <div style={{ color: 'var(--text-sub)', fontSize: '0.78rem', lineHeight: '1.3' }}>
                          Bénéficiaire certifié CSU
                        </div>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <code className="px-2.5 py-1 bg-dark text-success border border-success rounded-3 fw-bold" style={{ fontSize: '0.8rem' }}>
                          {p.cmu_number}
                        </code>
                      </td>

                      <td style={{ padding: '1rem 0.85rem', maxWidth: '240px' }}>
                        <div style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.84rem', lineHeight: '1.4' }}>
                          🩺 {p.reason}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <span className="fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                          🕒 {p.joined_at}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700', display: 'inline-block' }}>
                          ✅ Réglé ({p.payment_method || 'Wave'})
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        {p.status === 'called' ? (
                          <span className="badge bg-success text-white px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>🟢 En consultation</span>
                        ) : p.status === 'next' ? (
                          <span className="badge bg-warning text-dark px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>🔔 Prochain notifié</span>
                        ) : (
                          <span className="badge bg-secondary text-white px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>⏳ En attente (n°{idx + 1})</span>
                        )}
                      </td>

                      <td className="text-end" style={{ padding: '1rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <div className="d-flex align-items-center justify-content-end" style={{ gap: '0.75rem', whiteSpace: 'nowrap' }}>
                          <button 
                            type="button" 
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '10px', padding: '0.45rem 0.85rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              setQueue(queue.map(item => item.id === p.id ? { ...item, status: 'next' } : item));
                              speakAndToast({
                                type: 'warning',
                                icon: '🔔',
                                title: 'Notification envoyée',
                                message: `${p.patient_name} a été notifié(e) : vous êtes le prochain patient.`,
                                speech: `${p.patient_name}, c'est bientôt votre tour. Veuillez préparer votre micro et votre caméra. Le médecin va vous recevoir dans un instant.`
                              });
                            }}
                            title="Notifier à l'avance que le tour du patient approche"
                          >
                            🔔 Notifier
                          </button>
                          
                          <button 
                            type="button" 
                            style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.45rem 0.85rem', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(5,150,105,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                            onClick={() => {
                              setQueue(queue.map(item => item.id === p.id ? { ...item, status: 'called' } : item));
                              handleStartCall(doctorsList.find(d => d.name === p.requested_doctor) || doctorsList[0]);
                            }}
                            title="Recevoir le patient en Visioconférence HD"
                          >
                            🎥 Recevoir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Grid Content (Doctors List + Right Sidebar) */}
        <div className="row g-4 mb-4">
          
          {/* Main Area: Doctors */}
          <div className="col-lg-8">
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>👨‍⚕️ Praticiens disponibles</h5>
                
                {/* Search & Category Filter Bar */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Filtrer un médecin..." 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: '160px' }} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', padding: '0.2rem', borderRadius: '10px' }}>
                    <button 
                      type="button"
                      style={{ background: activeCategory === 'all' ? '#10b981' : 'transparent', color: activeCategory === 'all' ? '#ffffff' : 'var(--text-sub)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                      onClick={() => setActiveCategory('all')}
                    >
                      Tous
                    </button>

                    <button 
                      type="button"
                      style={{ background: activeCategory === 'pediatrie' ? '#10b981' : 'transparent', color: activeCategory === 'pediatrie' ? '#ffffff' : 'var(--text-sub)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                      onClick={() => setActiveCategory('pediatrie')}
                    >
                      Pédiatrie
                    </button>

                    <button 
                      type="button"
                      style={{ background: activeCategory === 'cardio' ? '#10b981' : 'transparent', color: activeCategory === 'cardio' ? '#ffffff' : 'var(--text-sub)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                      onClick={() => setActiveCategory('cardio')}
                    >
                      Cardiologie
                    </button>
                  </div>
                </div>
              </div>

              <div className="row g-3">
                {filteredDoctors.map((doc) => (
                  <div key={doc.id} className="col-md-6">
                    <div className="p-3.5 rounded-4 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                      <div>
                        <div className="d-flex gap-3 align-items-center mb-3">
                          <img src={doc.avatar} onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }} alt={doc.name} style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} />
                          <div>
                            <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{doc.name}</h6>
                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>{doc.specialty}</span>
                            <div className="small text-warning fw-bold mt-1" style={{ fontSize: '0.78rem' }}>★ {doc.rating}</div>
                          </div>
                        </div>

                        <div className="d-flex gap-2 mb-3 flex-wrap">
                          <span 
                            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedCnomDoctor(doc);
                              setActiveModal('cnom_info');
                            }}
                            title="Cliquer pour vérifier l'accréditation Ordre des Médecins"
                          >
                            🆔 {doc.cnom} 🔍
                          </span>
                          {doc.langs.map((l, idx) => (
                            <span 
                              key={idx} 
                              style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer' }}
                              onClick={() => setSearchQuery(l)}
                              title={`Filtrer par la langue ${l}`}
                            >
                              🌐 {l}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button 
                        type="button"
                        style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.55rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }} 
                        onClick={() => {
                          setSelectedDoctor(doc);
                          if (roleMode === 'citizen') {
                            setActiveModal('join_queue');
                          } else {
                            handleStartCall(doc);
                          }
                        }}
                      >
                        {roleMode === 'citizen' ? '🏥 Entrer en salle d\'attente (2 500 FCFA) ›' : 'Consulter ›'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar Column */}
          <div className="col-lg-4">
            <div className="d-flex flex-column gap-4">
              
              {/* Card Ordonnances digitales */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-center gap-2 mb-2 text-success">
                  <span style={{ fontSize: '1.3rem' }}>💊</span>
                  <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Ordonnances digitales</h6>
                </div>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                  Retrouvez vos prescriptions certifiées. Scannez le QR Code directement en pharmacie agréée (50% Tiers-Payant).
                </p>

                <div className="d-flex flex-column" style={{ gap: '0.75rem' }}>
                  <button 
                    type="button"
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)', marginBottom: '0.4rem' }}
                    onClick={() => setActiveModal('prescription')}
                  >
                    💊 Consulter mon ordonnance digitale (PDF & QR)
                  </button>

                  <button 
                    type="button"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                    onClick={() => {
                      if (typeof setView === 'function') {
                        setView('medical-profile');
                      } else {
                        window.location.hash = '#/medical-profile';
                      }
                    }}
                  >
                    📂 VOIR TOUT LE CARNET DE SANTÉ
                  </button>
                </div>
              </div>

              {/* Card QR Code CSU */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>📲 Présentation QR code CSU</h6>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>Présentez votre pass sanitaire numérique au médecin lors de l'appel.</p>
                
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                  onClick={() => setActiveModal('qr')}
                >
                  Afficher QR code assuré
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* JOIN QUEUE & PAYMENT INTEGRATED MODAL (React Portal — Centered on Screen) */}
      {activeModal === 'join_queue' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>

          {/* ════════ ÉTAPE : TRAITEMENT EN COURS ════════ */}
          {payStep === 'processing' && (
            <div style={{ maxWidth: '420px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', margin: 'auto', padding: '3rem 2rem', textAlign: 'center' }}>
              <style>{`
                @keyframes spinPay { to { transform: rotate(360deg); } }
                @keyframes pulsePay { 0%,100%{opacity:1} 50%{opacity:0.4} }
              `}</style>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `${getProviderInfo(paymentProvider).bgColor}`, border: `3px solid ${getProviderInfo(paymentProvider).color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', position: 'relative' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `3px solid transparent`, borderTopColor: getProviderInfo(paymentProvider).color, position: 'absolute', top: '-3px', left: '-3px', animation: 'spinPay 1s linear infinite' }} />
                <img src={getProviderInfo(paymentProvider).logo} alt="" style={{ width: '44px', height: '32px', objectFit: 'contain' }} />
              </div>
              <h5 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem' }}>Traitement en cours...</h5>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', animation: 'pulsePay 1.5s ease-in-out infinite' }}>
                En attente de confirmation {getProviderInfo(paymentProvider).name}<br/>
                <strong style={{ color: getProviderInfo(paymentProvider).color }}>Ne fermez pas cette fenêtre</strong>
              </p>
              <div style={{ marginTop: '1.5rem', background: 'var(--bg-card-subtle)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Montant</span>
                <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>2 500 FCFA</span>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-sub)', opacity: 0.6 }}>🔒 Transaction sécurisée • Conforme BCEAO</p>
            </div>
          )}

          {/* ════════ ÉTAPE : SUCCÈS ════════ */}
          {payStep === 'success' && txnResult && (
            <div style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 30px 80px rgba(16,185,129,0.2)', margin: 'auto', overflow: 'hidden' }}>
              {/* En-tête succès */}
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', padding: '2rem', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.3)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>✅</div>
                <h4 style={{ color: '#ffffff', fontWeight: '800', margin: '0 0 0.25rem' }}>Paiement Confirmé !</h4>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: 0 }}>Vous êtes en salle d'attente virtuelle</p>
              </div>
              {/* Reçu */}
              <div style={{ padding: '1.5rem 2rem' }}>
                {/* Référence */}
                <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Référence Transaction</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '800', color: '#10b981', letterSpacing: '0.08em' }}>{txnResult.transactionRef}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>{new Date(txnResult.timestamp).toLocaleString('fr-FR')}</div>
                </div>
                {/* Détails paiement */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                  {[{l:'Opérateur', v: getProviderInfo(paymentProvider).name},{l:'Téléphone', v: txnResult.phone},{l:'Montant payé', v: '2 500 FCFA'},{l:'Position file', v: `N°${txnResult.positionNum}`}].map(item => (
                    <div key={item.l} style={{ background: 'var(--bg-card-subtle)', borderRadius: '10px', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: '600' }}>{item.l}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.15rem' }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                {/* Médecin */}
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <img src={selectedDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180'} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Médecin assigné</div>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{selectedDoctor?.name || 'Dr. Ousmane Sow'}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.55rem', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.35)', whiteSpace: 'nowrap' }}>Prise en charge 80%</span>
                </div>
                <button
                  onClick={resetPaymentModal}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}
                >
                  ✅ Fermer et rejoindre la salle d'attente
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '0.75rem', opacity: 0.6 }}>Conservez la référence {txnResult.transactionRef} comme preuve de paiement</p>
              </div>
            </div>
          )}

          {/* ════════ ÉTAPE : ERREUR ════════ */}
          {payStep === 'error' && txnResult && (
            <div style={{ maxWidth: '420px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 30px 80px rgba(239,68,68,0.15)', margin: 'auto', padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem' }}>❌</div>
              <h5 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem' }}>Paiement échoué</h5>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{txnResult.message}</p>
              <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Causes possibles :</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.7' }}>
                  <li>Solde insuffisant sur votre compte</li>
                  <li>Numéro de téléphone incorrect</li>
                  <li>Connexion réseau instable</li>
                  <li>Plafond journalier atteint</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={resetPaymentModal}
                  style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >Annuler</button>
                <button onClick={() => setPayStep('form')}
                  style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.35)' }}
                >🔄 Réessayer</button>
              </div>
            </div>
          )}

          {/* ════════ ÉTAPE : FORMULAIRE ════════ */}
          {payStep === 'form' && (
            <div style={{ maxWidth: '600px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', margin: 'auto' }}>
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', padding: '1.75rem 2rem', borderRadius: '28px 28px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Télémédecine UNAMUSC</div>
                    <h5 style={{ color: '#ffffff', fontWeight: '800', margin: 0, fontSize: '1.2rem' }}>🏥 Entrer en salle d'attente virtuelle</h5>
                    <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>Prise en charge UNAMUSC 80% — Ticket modérateur : <strong style={{ color: '#6ee7b7' }}>2 500 FCFA</strong></p>
                  </div>
                  <button type="button" onClick={resetPaymentModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
                <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <img src={selectedDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180'} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.9rem' }}>{selectedDoctor?.name || 'Dr. Ousmane Sow'}</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>{selectedDoctor?.specialty || 'Médecine générale & urgences'} • Disponible maintenant</div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.3)', color: '#6ee7b7', padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid rgba(16,185,129,0.4)' }}>⚡ En ligne</span>
                </div>
              </div>

            {/* Corps du formulaire */}
            <div style={{ padding: '1.75rem 2rem' }}>
              <form onSubmit={handleJoinQueue}>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Symptômes &amp; motif de consultation *</label>
                  <textarea
                    style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    rows={3} value={consultReason} onChange={(e) => setConsultReason(e.target.value)}
                    placeholder="Ex : Fièvre, toux sèche, maux de tête depuis 48h..." required
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Niveau d'urgence *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[{v:'routine',l:'🟢 Routine',s:'Consultation de routine'},{v:'medium',l:'🟡 Modéré',s:'Symptômes modérés'},{v:'high',l:'🟠 Élevé',s:'Douleurs / fièvre forte'},{v:'critical',l:'🔴 Urgence',s:'Priorité absolue'}].map(u => (
                      <button key={u.v} type="button" onClick={() => setUrgencyLevel(u.v)}
                        style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', border: urgencyLevel === u.v ? '2px solid #10b981' : '1px solid var(--border-color)', background: urgencyLevel === u.v ? 'rgba(16,185,129,0.15)' : 'var(--bg-card-subtle)', color: urgencyLevel === u.v ? '#10b981' : 'var(--text-sub)', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
                        <div>{u.l}</div><div style={{ fontSize: '0.7rem', fontWeight: '400', opacity: 0.7 }}>{u.s}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '0 0 1.25rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-0.6rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', padding: '0 0.75rem', fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Règlement mobile money</span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.75rem' }}>Choisissez votre opérateur *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>

                    <button type="button" onClick={() => { setPaymentProvider('orange'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'orange' ? '2px solid #ff7900' : '1px solid var(--border-color)', background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', overflow: 'hidden' }}>
                        <img src="/logo_orange_money.png" alt="Orange Money" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'orange' ? '#ff7900' : 'var(--text-sub)', textAlign: 'center' }}>Orange Money</span>
                      {paymentProvider === 'orange' && <span style={{ fontSize: '0.62rem', color: '#ff7900', fontWeight: '800' }}>✓ Sélectionné</span>}
                    </button>

                    <button type="button" onClick={() => { setPaymentProvider('wave'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'wave' ? '2px solid #1dc4ff' : '1px solid var(--border-color)', background: paymentProvider === 'wave' ? 'rgba(29,196,255,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo_wave.png" alt="Wave" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'wave' ? '#1dc4ff' : 'var(--text-sub)', textAlign: 'center' }}>Wave</span>
                      {paymentProvider === 'wave' && <span style={{ fontSize: '0.62rem', color: '#1dc4ff', fontWeight: '800' }}>✓ Sélectionné</span>}
                    </button>

                    <button type="button" onClick={() => { setPaymentProvider('free'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'free' ? '2px solid #e11d48' : '1px solid var(--border-color)', background: paymentProvider === 'free' ? 'rgba(225,29,72,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', overflow: 'hidden' }}>
                        <img src="/logo_free_money.svg" alt="Free Money" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'free' ? '#e11d48' : 'var(--text-sub)', textAlign: 'center' }}>Free Money</span>
                      {paymentProvider === 'free' && <span style={{ fontSize: '0.62rem', color: '#e11d48', fontWeight: '800' }}>✓ Sélectionné</span>}
                    </button>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>N° de téléphone mobile money *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>📱</span>
                    <input type="tel"
                      style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: phoneError ? '1px solid #ef4444' : '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.5rem', fontSize: '0.95rem', fontWeight: '700', outline: 'none', letterSpacing: '0.05em', boxSizing: 'border-box' }}
                      value={phoneNum} onChange={(e) => { setPhoneNum(e.target.value); setPhoneError(''); }}
                      placeholder="Ex : 77 602 67 83" required
                    />
                  </div>
                  {phoneError && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: '600' }}>⚠️ {phoneError}</p>}

                  <div style={{ marginTop: '1rem', background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.08)' : paymentProvider === 'wave' ? 'rgba(29,196,255,0.08)' : 'rgba(225,29,72,0.08)', border: `1px solid ${paymentProvider === 'orange' ? 'rgba(255,121,0,0.3)' : paymentProvider === 'wave' ? 'rgba(29,196,255,0.3)' : 'rgba(225,29,72,0.3)'}`, borderRadius: '12px', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)', fontWeight: '600' }}>Ticket modérateur (20%)</span>
                      <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)' }}>2 500 FCFA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>Prise en charge UNAMUSC (80%)</span>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#10b981' }}>10 000 FCFA couverts</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: '600' }}>Via {getProviderInfo(paymentProvider).name} → {phoneNum || '---'}</span>
                      <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>🔒 Sécurisé</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button"
                    style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }}
                    onClick={resetPaymentModal}>Annuler</button>
                  <button type="submit"
                    style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    💳 Payer 2 500 FCFA &amp; entrer en salle d'attente
                  </button>
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-sub)', marginTop: '0.85rem', opacity: 0.7 }}>🔒 Paiement sécurisé • Aucun partage de vos données bancaires • Conforme BCEAO</p>
              </form>
            </div>
          </div>
          )}

        </div>,
        document.body
      )}



      {/* WEBRTC LIVE SESSION MODAL WITH RESPONSIVE DUAL VIEW & REAL MIC VU-METER (React Portal — Centered on Screen) */}
      {activeModal === 'webrtc' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1000px', width: '95%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.25rem', border: '1px solid var(--border-color)', maxHeight: '94vh', overflowY: 'auto', margin: 'auto' }}>
            
            {/* Header Status Bar */}
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="fw-bold text-success mb-0" style={{ fontSize: '1rem' }}>
                  🎥 Visioconférence Bidirectionnelle — {activeDoctor.name}
                </h6>
                <span className="badge bg-danger text-white" style={{ fontSize: '0.72rem' }}>● EN DIRECT (1080p WebRTC)</span>
              </div>
              <button 
                type="button" 
                className="btn btn-sm btn-danger fw-bold d-flex align-items-center gap-1 shadow-sm"
                style={{ borderRadius: '10px', padding: '0.4rem 0.9rem', fontSize: '0.82rem', background: '#dc2626', border: 'none' }}
                onClick={() => {
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(t => t.stop());
                  }
                  setActiveModal(null);
                }}
              >
                <span>❌ Terminer & Fermer</span>
              </button>
            </div>

            <div className="row g-3">
              
              {/* Main Responsive Screen Box */}
              <div className="col-lg-8">
                <div className="rounded-4 text-center d-flex flex-column align-items-center justify-content-center" style={{ width: '100%', height: '360px', background: '#050911', position: 'relative', border: '2px solid #10b981', overflow: 'hidden' }}>
                  
                  {/* MAIN VIEW: PATIENT WEBCAM OR DOCTOR STREAM */}
                  {!swappedViews ? (
                    /* Default: Patient Webcam Main View */
                    !useSimulatedFeed ? (
                      <video 
                        ref={userVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCamOff ? 'none' : 'block' }} 
                      />
                    ) : (
                      <canvas 
                        ref={canvasRef} 
                        width={640} 
                        height={360} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: isCamOff ? 'none' : 'block' }} 
                      />
                    )
                  ) : (
                    /* Swapped: Doctor Main View */
                    <div className="d-flex flex-column align-items-center justify-content-center p-3" style={{ height: '100%' }}>
                      <img src={activeDoctor.avatar} alt={activeDoctor.name} style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #10b981', marginBottom: '0.75rem' }} />
                      <h5 className="fw-bold text-white mb-1">{activeDoctor.name}</h5>
                      <span style={{ background: '#10b981', color: '#ffffff', padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{activeDoctor.specialty}</span>
                    </div>
                  )}

                  {/* CAMERA OFF PLACEHOLDER */}
                  {isCamOff && !swappedViews && (
                    <div className="d-flex flex-column align-items-center justify-content-center p-4" style={{ height: '100%' }}>
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', marginBottom: '0.5rem' }}>📷</div>
                      <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Caméra désactivée</h6>
                    </div>
                  )}

                  {/* PIP SECONDARY OVERLAY BOX (CLICK TO SWAP) */}
                  <div 
                    className="position-absolute bottom-0 end-0 m-3 p-2 rounded-3 border border-success d-flex align-items-center gap-2" 
                    style={{ background: 'var(--bg-card)', boxShadow: '0 8px 20px rgba(0,0,0,0.7)', zIndex: 10, cursor: 'pointer' }}
                    onClick={() => setSwappedViews(!swappedViews)}
                    title="Cliquer pour inverser les vues"
                  >
                    {!swappedViews ? (
                      <>
                        <img src={activeDoctor.avatar} alt={activeDoctor.name} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div className="text-start">
                          <small className="d-block fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.72rem' }}>{activeDoctor.name}</small>
                          <small className="text-success d-block" style={{ fontSize: '0.65rem' }}>⇄ Inverser la vue</small>
                        </div>
                      </>
                    ) : (
                      <div className="text-start p-1">
                        <small className="d-block fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.72rem' }}>{activeFirstName} {activeLastName}</small>
                        <small className="text-success d-block" style={{ fontSize: '0.65rem' }}>⇄ Vue Assuré (Caméra)</small>
                      </div>
                    )}
                  </div>

                </div>

                {/* REAL MICROPHONE AUDIO VU-METER BAR (VISUAL AUDIO TEST) */}
                <div className="p-2.5 mt-3 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '0.9rem' }}>🕪</span>
                      <small className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.78rem' }}>
                        Niveau du Micro (Audio Live) : <span className={isMuted ? "text-danger" : "text-success"}>{isMuted ? "COUPE" : `${micVolume}% (Opérationnel)`}</span>
                      </small>
                    </div>

                    {/* Animated Volume Pulse Bars */}
                    <div className="d-flex align-items-end gap-1" style={{ height: '16px' }}>
                      {[20, 40, 60, 80, 100].map((step, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            width: '4px', 
                            height: `${Math.max(4, (micVolume >= step ? (idx + 1) * 3 + 4 : 4))}px`, 
                            background: isMuted ? '#dc2626' : (micVolume >= step ? '#10b981' : 'var(--border-color)'), 
                            borderRadius: '2px',
                            transition: 'height 0.1s ease'
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Controls Bar */}
                <div className="d-flex justify-content-center gap-2 mt-3 p-2.5 rounded-4 flex-wrap" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <button 
                    type="button" 
                    style={{ background: isMuted ? '#dc2626' : '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }} 
                    onClick={toggleMute}
                  >
                    {isMuted ? '🎙️ Micro Coupé' : '🎙️ Micro Actif'}
                  </button>

                  <button 
                    type="button" 
                    style={{ background: isCamOff ? '#dc2626' : '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }} 
                    onClick={toggleCamera}
                  >
                    {isCamOff ? '📹 Activer Caméra' : '📹 Caméra Active'}
                  </button>

                  <button 
                    type="button" 
                    style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.85rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }} 
                    onClick={() => setSwappedViews(!swappedViews)}
                  >
                    ⇄ Inverser Vues
                  </button>

                  <button 
                    type="button" 
                    style={{ background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.55rem 1.25rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(220,38,38,0.35)' }} 
                    onClick={() => {
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach(t => t.stop());
                      }
                      setActiveModal(null);
                    }}
                  >
                    🛑 Raccrocher & Fermer
                  </button>
                </div>
              </div>

              {/* Chat Panel */}
              <div className="col-lg-4">
                <div className="p-3 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ minHeight: '360px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <h6 className="fw-bold text-info mb-2" style={{ fontSize: '0.9rem' }}>💬 Messagerie Directe</h6>
                  <div className="p-2 rounded-3 mb-2 flex-grow-1" style={{ maxHeight: '250px', overflowY: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className="mb-2">
                        <strong className="text-success">{m.sender} : </strong>
                        <span style={{ color: 'var(--text-sub)' }}>{m.text}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="d-flex gap-2">
                    <input type="text" className="form-control form-control-sm" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} placeholder="Écrire un message..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} />
                    <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.8rem' }}>Envoyer</button>
                  </form>
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* QR CODE MODAL (React Portal — Centered on Screen) */}
      {activeModal === 'qr' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '440px', width: '92%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="d-flex justify-content-between align-items-center w-100 mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>📲</span> QR code CSU assuré
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>
            
            <p className="small text-muted mb-2 text-center" style={{ fontSize: '0.82rem' }}>Présentez ce QR Code lors de votre prise en charge médicale ou en pharmacie agréée</p>

            <div className="p-3 bg-white rounded-4 border border-success d-flex align-items-center justify-content-center my-2 shadow-sm" style={{ width: '210px', height: '210px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${activeCmuNumber}`} alt="QR code CSU" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div className="my-2 px-3 py-1.5 rounded-pill border border-success text-center" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <small className="d-block text-muted fw-bold" style={{ fontSize: '0.68rem' }}>N° CSU TITULAIRE</small>
              <strong className="fs-6 fw-mono">{activeCmuNumber}</strong>
            </div>

            <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700', width: '100%', marginTop: '0.75rem', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}

      {/* PRESCRIPTION MODAL (React Portal — Centered on Screen) */}
      {activeModal === 'prescription' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '1.4rem' }}>💊</span>
                <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>Ordonnance médicale certifiée UNAMUSC 🇸🇳</h5>
              </div>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-4 rounded-4 mb-3 border border-success" style={{ background: 'var(--bg-card-subtle)' }}>
              <div className="d-flex justify-content-between align-items-start mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <strong className="text-success d-block" style={{ fontSize: '0.98rem' }}>Dr. Ousmane Sow</strong>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Médecin généraliste — CNOM: 4522-SN</small>
                </div>
                <span className="badge bg-success-subtle text-success border border-success px-2.5 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.72rem' }}>
                  ● BON PHARMACIE 50% VALIDE
                </span>
              </div>

              <div className="mb-3 p-3 rounded-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <small className="d-block text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>PATIENT(E) BÉNÉFICIAIRE :</small>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{activeFirstName} {activeLastName}</strong>
                <small className="d-block text-success fw-bold" style={{ fontSize: '0.78rem' }}>N° CSU : {activeCmuNumber}</small>
              </div>

              <div className="mb-3">
                <small className="d-block text-muted fw-bold mb-2" style={{ fontSize: '0.75rem' }}>MÉDICAMENTS PRESCRITS & POSOLOGIE :</small>
                <div className="d-flex flex-column gap-2">
                  <div className="p-2.5 rounded-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>1. Amoxicilline 500mg (2 boîtes)</strong>
                    <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Posologie : 1 gélule 3 fois par jour pendant 7 jours</small>
                  </div>
                  <div className="p-2.5 rounded-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>2. Paracétamol 1g (1 boîte)</strong>
                    <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Posologie : 1 comprimé en cas de fièvre (max 3/jour)</small>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-3 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
                <div className="p-1.5 bg-white rounded-3 border" style={{ borderColor: '#10b981', flexShrink: 0 }}>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent('ORD-TELEMED-2026-9912')}`} alt="QR Code Ordonnance" style={{ width: '70px', height: '70px' }} />
                </div>
                <div>
                  <strong className="d-block text-success small fw-bold">QR Code Tiers-Payant Pharmacie (50%)</strong>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem', lineHeight: '1.4' }}>
                    Présentez ce QR Code dans n'importe quelle pharmacie partenaire agréée du Sénégal pour bénéficier de la prise en charge 50% UNAMUSC.
                  </small>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: '700', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>Fermer</button>
              <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }} onClick={handleDownloadPrescription}>📥 Télécharger Ordonnance PDF Officielle (🇸🇳)</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL AJOUT MÉDECIN DE GARDE (UNION DÉPARTEMENTALE) */}
      {activeModal === 'add_doctor' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>👨‍⚕️</span> Enregistrement d'un Médecin de Garde
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-4">
              Réservé aux Agents d'Unions Départementales UNAMUSC. Ajoutez un praticien assermenté au réseau régional de garde.
            </p>

            <form onSubmit={handleAddDoctor}>
              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Nom Complet du Médecin *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  placeholder="Ex: Dr. Mariama Bâ" 
                  value={newDocName} 
                  onChange={(e) => setNewDocName(e.target.value)} 
                  required 
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Spécialité Médicale *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: Pédiatrie & Néonatologie" 
                    value={newDocSpecialty} 
                    onChange={(e) => setNewDocSpecialty(e.target.value)} 
                    required 
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Catégorie *</label>
                  <select 
                    className="form-select" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                  >
                    <option value="generaliste">Médecine Générale</option>
                    <option value="pediatrie">Pédiatrie</option>
                    <option value="cardio">Cardiologie</option>
                    <option value="gyneco">Gynécologie</option>
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>N° d'Ordre CNOM *</label>
                  <input 
                    type="text" 
                    className="form-control fw-mono" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: CNOM: 7812-SN" 
                    value={newDocCnom} 
                    onChange={(e) => setNewDocCnom(e.target.value)} 
                    required 
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Union Départementale / Secteur *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: Union Départementale Pikine" 
                    value={newDocDept} 
                    onChange={(e) => setNewDocDept(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Langues Parlées (séparées par virgules) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  placeholder="Ex: FR, WO, PULAAR" 
                  value={newDocLangs} 
                  onChange={(e) => setNewDocLangs(e.target.value)} 
                  required 
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem 1.25rem' }} onClick={() => setActiveModal(null)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.5rem', fontWeight: '800' }}>
                  💾 Enregistrer le Médecin dans le Réseau
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL VÉRIFICATION ACCRÉDITATION CNOM */}
      {activeModal === 'cnom_info' && selectedCnomDoctor && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>🆔</span> Accréditation Ordre des Médecins 🇸🇳
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="text-center my-3">
              <img src={selectedCnomDoctor.avatar} onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }} alt={selectedCnomDoctor.name} style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'cover', border: '3px solid #10b981' }} />
              <h5 className="fw-bold mt-2 mb-0" style={{ color: 'var(--text-main)' }}>{selectedCnomDoctor.name}</h5>
              <span className="badge bg-success-subtle text-success border border-success px-3 py-1 mt-1" style={{ borderRadius: '12px' }}>
                {selectedCnomDoctor.specialty}
              </span>
            </div>

            <div className="p-3 rounded-4 mb-3 border border-success" style={{ background: 'var(--bg-card-subtle)', fontSize: '0.85rem' }}>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">N° Ordre des Médecins :</span>
                <strong className="text-success fw-mono">{selectedCnomDoctor.cnom}</strong>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">Statut d'Assermentation :</span>
                <span className="badge bg-success text-white">● Praticien Agréé & Validé</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">Secteur / Union :</span>
                <strong>{selectedCnomDoctor.department || 'Dakar Centre'}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted fw-semibold">Langues de Consultation :</span>
                <strong>{selectedCnomDoctor.langs.join(', ')}</strong>
              </div>
            </div>

            <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700', width: '100%', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL RÉSEAU DES 15 MÉDECINS EN LIGNE (+12) */}
      {activeModal === 'all_doctors' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>🟢</span> Réseau National des 15 Médecins de Garde UNAMUSC 🇸🇳
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="row g-3 my-2">
              {doctorsList.map((doc) => (
                <div key={doc.id} className="col-md-6">
                  <div className="p-3 rounded-4 border d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                    <div className="d-flex align-items-center gap-3">
                      <img src={doc.avatar} onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }} alt={doc.name} style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
                      <div>
                        <strong className="d-block text-success" style={{ fontSize: '0.9rem' }}>{doc.name}</strong>
                        <small className="text-muted d-block" style={{ fontSize: '0.74rem' }}>{doc.specialty}</small>
                        <small className="text-success fw-mono d-block" style={{ fontSize: '0.68rem' }}>{doc.cnom}</small>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setActiveModal('join_queue');
                      }}
                    >
                      Consulter
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-end mt-4">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700' }} onClick={() => setActiveModal(null)}>Fermer</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOAST DE NOTIFICATION (Portal centré en haut à droite) */}
      {notifToast && createPortal(
        <div
          onClick={() => setNotifToast(null)}
          style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999999,
            maxWidth: '400px', width: '100%',
            animation: 'slideInToast 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
            cursor: 'pointer'
          }}
        >
          <style>{`
            @keyframes slideInToast {
              from { opacity: 0; transform: translateX(120%) scale(0.85); }
              to   { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes toastProgress {
              from { width: 100%; }
              to   { width: 0%; }
            }
          `}</style>
          <div style={{
            background: notifToast.type === 'success'
              ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
              : 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
            borderRadius: '20px',
            padding: '1.25rem 1.5rem 0.75rem 1.5rem',
            boxShadow: notifToast.type === 'success'
              ? '0 20px 60px rgba(16,185,129,0.45), 0 4px 20px rgba(0,0,0,0.4)'
              : '0 20px 60px rgba(245,158,11,0.4), 0 4px 20px rgba(0,0,0,0.4)',
            border: notifToast.type === 'success'
              ? '1px solid rgba(16,185,129,0.5)'
              : '1px solid rgba(245,158,11,0.5)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Barre de progression */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: '3px',
              background: notifToast.type === 'success' ? '#10b981' : '#f59e0b',
              borderRadius: '0 0 20px 20px',
              animation: 'toastProgress 5s linear forwards'
            }} />

            {/* Contenu */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              {/* Icône */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                background: notifToast.type === 'success'
                  ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', border: notifToast.type === 'success'
                  ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)'
              }}>
                {notifToast.icon}
              </div>
              {/* Texte */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '800', fontSize: '1rem', color: '#ffffff',
                  marginBottom: '0.3rem', letterSpacing: '-0.01em'
                }}>
                  {notifToast.title}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
                  {notifToast.message}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.4rem' }}>
                  🔊 Message vocal diffusé • Cliquez pour fermer
                </div>
              </div>
              {/* Bouton fermer */}
              <button
                onClick={(e) => { e.stopPropagation(); setNotifToast(null); }}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer',
                  fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >✕</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
