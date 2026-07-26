import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Télémédecine Visioconférence Bidirectionnelle & Vu-mètre Micro Réel
export default function Telemedicine({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, setView = null }) {
  const isAgent = (userRole === 'agent' || !!agentUser);

  // Assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Awa';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Ndiaye';

  // Mode de rôle (Assuré ou Médecin de Garde)
  const [roleMode, setRoleMode] = useState(isAgent ? 'doctor' : 'citizen');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  // Swap Main Screen vs PIP Screen
  const [swappedViews, setSwappedViews] = useState(false);

  // Liste des Praticiens Agréés (Persistée localement pour chaque Union Départementale)
  const defaultDoctorsList = [
    {
      id: 1,
      name: 'Dr. Ousmane Sow',
      specialty: 'Médecine Générale & Urgences',
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
      specialty: 'Gynécologie & Obstétrique',
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
      specialty: 'Cardiologie & Médecine Interne',
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

  // File d'attente Télémédecine
  const [queue, setQueue] = useState([
    {
      id: 1,
      patient_name: 'Awa Ndiaye',
      cmu_number: 'CMU-DKR-2026-8812',
      reason: 'Migraine pulsatile aiguë & toux sèche depuis 48h',
      urgency: 'high',
      joined_at: new Date(Date.now() - 5 * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      requested_doctor: 'Dr. Ousmane Sow',
      payment_status: 'paid',
      payment_method: 'Orange Money',
      amount: 2500
    },
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

  // Modale Inscription
  const [consultReason, setConsultReason] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('routine');
  const [selectedDoctor, setSelectedDoctor] = useState(doctorsList[0]);

  // Modale Paiement
  const [paymentProvider, setPaymentProvider] = useState('orange');
  const [phoneNum, setPhoneNum] = useState('77 602 67 83');

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

  const handleJoinQueue = (e) => {
    e.preventDefault();
    if (!consultReason.trim()) return;
    const providerName = paymentProvider === 'orange' ? 'Orange Money' : paymentProvider === 'wave' ? 'Wave' : 'Free Money';
    const targetDoc = selectedDoctor || doctorsList[0];
    const newPatient = {
      id: Date.now(),
      patient_name: `${activeFirstName} ${activeLastName}`,
      cmu_number: activeCmuNumber,
      reason: consultReason,
      urgency: urgencyLevel,
      joined_at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      requested_doctor: targetDoc.name,
      payment_status: 'paid',
      payment_method: providerName,
      amount: 2500,
      status: 'called'
    };
    setQueue([newPatient, ...queue]);
    setActiveDoctor(targetDoc);
    setConsultReason('');
    
    // Lancement IMMÉDIAT de la salle de Visioconférence HD WebRTC en direct avec le Médecin !
    startCamera();
    setActiveModal('webrtc');
  };

  const handleProcessPayment = (e) => {
    e.preventDefault();
    setActiveModal(null);
    alert(`✅ Règlement du ticket modérateur de 2 500 FCFA effectué avec succès via ${paymentProvider === 'orange' ? 'Orange Money' : paymentProvider === 'wave' ? 'Wave' : 'Free Money'} !`);
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

  const filteredDoctors = doctorsList.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || d.category === activeCategory;
    return matchSearch && matchCat;
  });

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

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {!isAgent ? (
              <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.8rem' }}>
                🟢 Espace Assuré (Connecté)
              </span>
            ) : (
              <>
                <button 
                  type="button" 
                  style={{ background: roleMode === 'citizen' ? '#10b981' : 'var(--bg-card)', color: roleMode === 'citizen' ? '#ffffff' : 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                  onClick={() => setRoleMode('citizen')}
                >
                  Espace Assuré
                </button>
                <button 
                  type="button" 
                  style={{ background: roleMode === 'doctor' ? '#10b981' : 'var(--bg-card)', color: roleMode === 'doctor' ? '#ffffff' : 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
                  onClick={() => setRoleMode('doctor')}
                >
                  Espace Médecin de Garde
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-5 rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat', padding: '3.75rem 2.5rem', minHeight: '240px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }}>
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span style={{ background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.85rem', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                🇸🇳 SALLE D'ATTENTE VIRTUELLE UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.4rem', letterSpacing: '-0.02em', textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>Consultation instantanée 24h/7</h1>
              <p className="text-white mb-4" style={{ fontSize: '1.08rem', maxWidth: '740px', lineHeight: '1.6', textShadow: '0 2px 4px rgba(0,0,0,0.3)', opacity: 0.95 }}>
                Accédez à un réseau de médecins agréés en moins de 10 minutes. Vidéoconférence HD WebRTC sécurisée et cryptée.
              </p>
              
              <div className="d-flex gap-3 flex-wrap">
                <button 
                  type="button"
                  style={{ background: '#ffffff', color: '#047857', border: 'none', borderRadius: '12px', padding: '0.8rem 1.75rem', fontWeight: '800', fontSize: '0.95rem', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', cursor: 'pointer' }}
                  onClick={() => setActiveModal('join_queue')}
                >
                  ⚡ Entrer en salle d'attente
                </button>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="p-4 rounded-4" style={{ background: 'rgba(255, 255, 255, 0.22)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span 
                    className="fw-bold text-white" 
                    style={{ fontSize: '0.88rem', letterSpacing: '0.5px', cursor: 'pointer' }}
                    onClick={() => setActiveModal('all_doctors')}
                    title="Cliquer pour voir la liste complète des 15 médecins"
                  >
                    🟢 15 MÉDECINS EN LIGNE 🔍
                  </span>
                  <span className="badge" style={{ background: '#10b981', color: '#ffffff', fontSize: '0.72rem', fontWeight: '800' }}>Disponible 24/7</span>
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
                  <small className="text-white d-block fw-semibold" style={{ fontSize: '0.82rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                    {doctorsList.map((d, idx) => (
                      <span 
                        key={d.id || idx} 
                        style={{ cursor: 'pointer', textDecoration: 'underline text-decoration-color: rgba(255,255,255,0.4)', marginRight: '6px' }}
                        onClick={() => {
                          setSelectedDoctor(d);
                          setActiveModal('join_queue');
                        }}
                      >
                        {d.name}{idx < doctorsList.length - 1 ? ' • ' : ''}
                      </span>
                    ))}
                  </small>
                  <small className="text-white-50 d-block mt-1" style={{ fontSize: '0.78rem' }}>Temps d'attente estimé : <span className="fw-bold text-warning" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>⚡ 4 min</span></small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BANNER RECONNECT / APPAREIL ACTIF APRÈS PAIEMENT ASSURÉ */}
        {(() => {
          const myItem = queue.find(q => q.cmu_number === activeCmuNumber || q.patient_name.includes(activeLastName));
          if (!myItem) return null;
          return (
            <div className="p-4 rounded-4 mb-5 text-white shadow-lg position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderRadius: '20px', border: '2px solid #10b981', boxShadow: '0 10px 30px rgba(16,185,129,0.3)' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="spinner-grow spinner-grow-sm text-warning" role="status"></span>
                    <span className="badge bg-white text-success fw-bold px-3 py-1" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
                      ● CONSULTATION EN DIRECT PRÊTE (PAYÉ 2 500 FCFA)
                    </span>
                  </div>
                  <h4 className="fw-extrabold mb-1 text-white">
                    Médecin Consultant : {myItem.requested_doctor || 'Dr. Ousmane Sow'}
                  </h4>
                  <p className="mb-0 text-white-50 small">
                    Règlement effectué via <strong>{myItem.payment_method}</strong> | Motif : {myItem.reason}
                  </p>
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-light text-success fw-extrabold px-4 py-2.5 shadow"
                    style={{ borderRadius: '12px', fontSize: '0.95rem', cursor: 'pointer' }}
                    onClick={() => {
                      const docObj = doctorsList.find(d => d.name === myItem.requested_doctor) || doctorsList[0];
                      setActiveDoctor(docObj);
                      startCamera();
                      setActiveModal('webrtc');
                    }}
                  >
                    🎥 Ouvrir / Reconnecter la Visioconférence Directe
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SECTION MÉDECINS DE GARDE / FILE D'ATTENTE */}
        {roleMode === 'doctor' && (
          <div className="p-4 rounded-4 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>📋 File d'attente Télémédecine (Mode Médecin de Garde)</h5>
              <button 
                type="button" 
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                onClick={() => setActiveModal('add_doctor')}
              >
                ➕ Ajouter un Médecin (Union Départementale)
              </button>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th>ASSURÉ</th>
                    <th>N° CMU</th>
                    <th>MOTIF & SYMPTÔMES</th>
                    <th>ARRIVÉE</th>
                    <th>RÈGLEMENT</th>
                    <th className="text-end">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(p => (
                    <tr key={p.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="fw-bold" style={{ color: 'var(--text-main)' }}>{p.patient_name}</td>
                      <td className="text-success small fw-mono">{p.cmu_number}</td>
                      <td className="small" style={{ color: 'var(--text-sub)' }}>{p.reason}</td>
                      <td className="small" style={{ color: 'var(--text-sub)' }}>{p.joined_at}</td>
                      <td>
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
                          ✅ Reglé ({p.payment_method || 'Wave'})
                        </span>
                      </td>
                      <td className="text-end">
                        <button 
                          type="button" 
                          style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                          onClick={() => handleStartCall(doctorsList[0])}
                        >
                          🎥 Démarrer l'appel HD
                        </button>
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
                <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>👨‍⚕️ Praticiens Disponibles</h5>
                
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
                      Cardiologue
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
                        {roleMode === 'citizen' ? '🏥 Entrer en Salle d\'Attente (2 500 FCFA) ›' : 'Consulter ›'}
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
              
              {/* Card Ordonnances Digitales */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-center gap-2 mb-2 text-success">
                  <span style={{ fontSize: '1.3rem' }}>💊</span>
                  <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Ordonnances Digitales</h6>
                </div>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                  Retrouvez vos prescriptions certifiées. Scannez le QR Code directement en pharmacie agréée (50% Tiers-Payant).
                </p>

                <div className="d-flex flex-column gap-2">
                  <button 
                    type="button"
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                    onClick={() => setActiveModal('prescription')}
                  >
                    💊 Consulter mon Ordonnance Digital (PDF & QR)
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

              {/* Card QR Code CMU */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>📲 Présentation QR Code CMU</h6>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>Présentez votre pass sanitaire numérique au médecin lors de l'appel.</p>
                
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                  onClick={() => setActiveModal('qr')}
                >
                  Afficher QR Code Assuré
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* JOIN QUEUE & PAYMENT INTEGRATED MODAL (React Portal — Centered on Screen) */}
      {activeModal === 'join_queue' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>🚪</span> Entrée en Salle d'Attente Virtuelle
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-3 mb-3 border border-success" style={{ background: 'var(--bg-card-subtle)' }}>
              <small className="text-muted d-block fw-semibold mb-1">Médecin Consultant Sélectionné :</small>
              <h6 className="fw-bold mb-0 text-success">{selectedDoctor?.name || 'Dr. Ousmane Sow'} ({selectedDoctor?.specialty || 'Médecine Générale'})</h6>
              <small className="text-muted d-block mt-1">Prise en charge UNAMUSC à 80% — Ticket modérateur restant : <strong>2 500 FCFA</strong></small>
            </div>
            
            <form onSubmit={handleJoinQueue}>
              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Symptômes & Motif de consultation *</label>
                <textarea 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} 
                  rows={3} 
                  value={consultReason} 
                  onChange={(e) => setConsultReason(e.target.value)}
                  placeholder="Ex: Fièvre, toux sèche, maux de tête depuis 48h..."
                  required 
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Niveau d'urgence *</label>
                <select 
                  className="form-select" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                >
                  <option value="routine">🟢 Consultation de routine (faible)</option>
                  <option value="medium">🟡 Symptômes modérés (moyenne)</option>
                  <option value="high">🟠 Douleurs / fièvre forte (élevée)</option>
                  <option value="critical">🔴 Urgence vitale (priorité absolue)</option>
                </select>
              </div>

              {/* RÈGLEMENT OBLIGATOIRE DU TICKET MODÉRATEUR */}
              <div className="mb-3">
                <label className="form-label small fw-bold text-success">Mode de Règlement Mobile Money (2 500 FCFA) *</label>
                <div className="d-flex gap-2 mb-3">
                  <button 
                    type="button" 
                    style={{ 
                      flex: 1, 
                      padding: '0.75rem 0.35rem', 
                      borderRadius: '12px', 
                      background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.18)' : 'var(--bg-card-subtle)', 
                      color: 'var(--text-main)', 
                      border: paymentProvider === 'orange' ? '2px solid #ff7900' : '1px solid var(--border-color)',
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onClick={() => setPaymentProvider('orange')}
                  >
                    <img src="/logo_orange_money.png" alt="Orange Money" style={{ height: '22px', borderRadius: '4px', background: '#ffffff', padding: '1px' }} />
                    <span>Orange Money</span>
                  </button>

                  <button 
                    type="button" 
                    style={{ 
                      flex: 1, 
                      padding: '0.75rem 0.35rem', 
                      borderRadius: '12px', 
                      background: paymentProvider === 'wave' ? 'rgba(29,196,255,0.18)' : 'var(--bg-card-subtle)', 
                      color: 'var(--text-main)', 
                      border: paymentProvider === 'wave' ? '2px solid #1dc4ff' : '1px solid var(--border-color)',
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onClick={() => setPaymentProvider('wave')}
                  >
                    <img src="/logo_wave.png" alt="Wave" style={{ height: '22px', borderRadius: '4px' }} />
                    <span>Wave</span>
                  </button>

                  <button 
                    type="button" 
                    style={{ 
                      flex: 1, 
                      padding: '0.75rem 0.35rem', 
                      borderRadius: '12px', 
                      background: paymentProvider === 'free' ? 'rgba(225,29,72,0.18)' : 'var(--bg-card-subtle)', 
                      color: 'var(--text-main)', 
                      border: paymentProvider === 'free' ? '2px solid #e11d48' : '1px solid var(--border-color)',
                      fontWeight: '700',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onClick={() => setPaymentProvider('free')}
                  >
                    <img src="/logo_free_money.svg" alt="Free Money" style={{ height: '22px', borderRadius: '4px' }} />
                    <span>Free Money</span>
                  </button>
                </div>

                <input 
                  type="text" 
                  className="form-control fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  value={phoneNum} 
                  onChange={(e) => setPhoneNum(e.target.value)} 
                  placeholder="Numéro de téléphone Mobile Money"
                  required 
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem 1.25rem' }} onClick={() => setActiveModal(null)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.5rem', fontWeight: '800' }}>
                  💳 Payer 2 500 FCFA & Entrer en Salle d'Attente
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* PAYMENT MODAL (ORANGE MONEY / WAVE — React Portal — Centered on Screen) */}
      {activeModal === 'payment' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '480px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h5 className="fw-bold text-success mb-0">💳 Paiement Mobile Téléconsultation (2 500 FCFA)</h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>
            <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>Ticket modérateur restant. Prise en charge UNAMUSC à 80% garantie.</p>

            <form onSubmit={handleProcessPayment}>
              <div className="d-flex gap-2 mb-4">
                <button 
                  type="button" 
                  style={{ 
                    flex: 1, 
                    padding: '0.85rem 0.5rem', 
                    borderRadius: '12px', 
                    background: paymentProvider === 'orange' ? '#ff7900' : 'var(--bg-card-subtle)', 
                    color: paymentProvider === 'orange' ? '#ffffff' : 'var(--text-main)', 
                    border: paymentProvider === 'orange' ? '2px solid #ff7900' : '1px solid var(--border-color)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPaymentProvider('orange')}
                >
                  Orange Money
                </button>

                <button 
                  type="button" 
                  style={{ 
                    flex: 1, 
                    padding: '0.85rem 0.5rem', 
                    borderRadius: '12px', 
                    background: paymentProvider === 'wave' ? '#1dc4ff' : 'var(--bg-card-subtle)', 
                    color: paymentProvider === 'wave' ? '#ffffff' : 'var(--text-main)', 
                    border: paymentProvider === 'wave' ? '2px solid #1dc4ff' : '1px solid var(--border-color)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPaymentProvider('wave')}
                >
                  Wave
                </button>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Numéro Mobile Money *</label>
                <input 
                  type="text" 
                  className="form-control fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  value={phoneNum} 
                  onChange={(e) => setPhoneNum(e.target.value)} 
                  required 
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setActiveModal(null)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Payer 2 500 FCFA</button>
              </div>
            </form>
          </div>
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
              <button className="btn-close" onClick={() => setActiveModal(null)}></button>
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
                    style={{ background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }} 
                    onClick={() => setActiveModal(null)}
                  >
                    Raccrocher
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
                <span>📲</span> QR Code CMU Assuré
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>
            
            <p className="small text-muted mb-2 text-center" style={{ fontSize: '0.82rem' }}>Présentez ce QR Code lors de votre prise en charge médicale ou en pharmacie agréée</p>

            <div className="p-3 bg-white rounded-4 border border-success d-flex align-items-center justify-content-center my-2 shadow-sm" style={{ width: '210px', height: '210px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${activeCmuNumber}`} alt="QR Code CMU" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div className="my-2 px-3 py-1.5 rounded-pill border border-success text-center" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <small className="d-block text-muted fw-bold" style={{ fontSize: '0.68rem' }}>N° CMU TITULAIRE</small>
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
                <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>Ordonnance Médicale Certifiée UNAMUSC 🇸🇳</h5>
              </div>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-4 rounded-4 mb-3 border border-success" style={{ background: 'var(--bg-card-subtle)' }}>
              <div className="d-flex justify-content-between align-items-start mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <strong className="text-success d-block" style={{ fontSize: '0.98rem' }}>Dr. Ousmane Sow</strong>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Médecin Généraliste — CNOM: 4522-SN</small>
                </div>
                <span className="badge bg-success-subtle text-success border border-success px-2.5 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.72rem' }}>
                  ● BON PHARMACIE 50% VALIDE
                </span>
              </div>

              <div className="mb-3 p-3 rounded-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <small className="d-block text-muted fw-bold mb-1" style={{ fontSize: '0.72rem' }}>PATIENT(E) BÉNÉFICIAIRE :</small>
                <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{activeFirstName} {activeLastName}</strong>
                <small className="d-block text-success fw-bold" style={{ fontSize: '0.78rem' }}>N° CMU : {activeCmuNumber}</small>
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

    </div>
  );
}
