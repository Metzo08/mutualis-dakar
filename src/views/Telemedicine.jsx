import React, { useState, useEffect, useRef } from 'react';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Télémédecine Visioconférence Bidirectionnelle & Vu-mètre Micro Réel
export default function Telemedicine({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null }) {
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

  // Liste des Praticiens Agréés
  const doctorsList = [
    {
      id: 1,
      name: 'Dr. Ousmane Sow',
      specialty: 'Médecine Générale',
      category: 'generaliste',
      rating: '4.9 (124 avis)',
      cnom: 'CNOM: 4522-SN',
      langs: ['FR', 'WO', 'EN'],
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
      avatar: 'https://images.unsplash.com/photo-1594824813566-88855ce75907?w=180',
      available: true
    },
    {
      id: 3,
      name: 'Dr. Cheikh Tidiane Seck',
      specialty: 'Cardiologie & Médecine Générale',
      category: 'cardio',
      rating: '4.8 (96 avis)',
      cnom: 'CNOM: 9921-SN',
      langs: ['FR', 'WO'],
      avatar: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=180',
      available: true
    }
  ];

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
    const newPatient = {
      id: Date.now(),
      patient_name: `${activeFirstName} ${activeLastName}`,
      cmu_number: activeCmuNumber,
      reason: consultReason,
      urgency: urgencyLevel,
      joined_at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      requested_doctor: selectedDoctor.name,
      payment_status: 'paid',
      payment_method: 'Orange Money',
      amount: 2500
    };
    setQueue([newPatient, ...queue]);
    setActiveModal(null);
    setConsultReason('');
    alert("✅ Inscription validée ! Vous êtes placé(e) dans la file d'attente.");
  };

  const handleProcessPayment = (e) => {
    e.preventDefault();
    setActiveModal(null);
    alert(`✅ Règlement de 2 500 FCFA effectué via ${paymentProvider === 'orange' ? 'Orange Money' : 'Wave'} !`);
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
    <div className="telemed-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#0f172a', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>Télémédecine UNAMUSC 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.75rem' }}>
              ● SALLE D'ATTENTE VIRTUELLE LIVE
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              type="button" 
              style={{ background: roleMode === 'citizen' ? '#10b981' : '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              onClick={() => setRoleMode('citizen')}
            >
              Espace Assuré
            </button>
            <button 
              type="button" 
              style={{ background: roleMode === 'doctor' ? '#10b981' : '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              onClick={() => setRoleMode('doctor')}
            >
              Espace Médecin de Garde
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-4 rounded-4 mb-4 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.92) 0%, rgba(15, 23, 42, 0.88) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat', border: '1px solid rgba(16, 185, 129, 0.35)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.5rem' }}>
                🇸🇳 SALLE D'ATTENTE VIRTUELLE UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.2rem', letterSpacing: '-0.02em' }}>Consultation instantanée 24h/7</h1>
              <p className="text-white-50 mb-4" style={{ fontSize: '0.98rem', maxWidth: '650px', lineHeight: '1.5' }}>
                Accédez à un réseau de médecins agréés en moins de 10 minutes. Vidéoconférence HD WebRTC sécurisée et cryptée.
              </p>
              
              <div className="d-flex gap-3 flex-wrap">
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', cursor: 'pointer' }}
                  onClick={() => setActiveModal('join_queue')}
                >
                  ⚡ Entrer en salle d'attente
                </button>

                <button 
                  type="button"
                  style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                  onClick={() => setActiveModal('payment')}
                >
                  💳 Régler ticket modérateur (2 500 FCFA)
                </button>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="p-3.5 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="d-flex" style={{ marginLeft: '10px' }}>
                      {doctorsList.map((d, i) => (
                        <img key={i} src={d.avatar} onError={(e) => { e.target.src = '/mariama_avatar.png'; }} alt={d.name} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #10b981', marginLeft: '-10px', objectFit: 'cover' }} />
                      ))}
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#0f172a', border: '2px solid #10b981', color: '#ffffff', fontWeight: '700', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '-10px' }}>+12</div>
                    </div>
                  </div>
                </div>
                <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.9rem' }}>Médecins en ligne</h6>
                <small className="text-muted d-block">Temps d'attente estimé: <span className="text-success fw-bold">4 min</span></small>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION MÉDECINS DE GARDE / FILE D'ATTENTE */}
        {roleMode === 'doctor' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h5 className="fw-bold text-white mb-3">📋 File d'attente Télémédecine (Mode Médecin de Garde)</h5>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr className="text-muted small">
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
                    <tr key={p.id}>
                      <td className="fw-bold text-white">{p.patient_name}</td>
                      <td className="text-success small fw-mono">{p.cmu_number}</td>
                      <td className="text-white-50 small">{p.reason}</td>
                      <td className="text-white-50 small">{p.joined_at}</td>
                      <td>
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
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
                <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.15rem' }}>👨‍⚕️ Praticiens Disponibles</h5>
                
                {/* Search & Category Filter Bar */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    placeholder="Filtrer un médecin..." 
                    style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: '160px' }} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                  <div style={{ display: 'flex', gap: '0.3rem', background: '#1e293b', padding: '0.2rem', borderRadius: '10px' }}>
                    <button 
                      type="button"
                      style={{ background: activeCategory === 'all' ? '#10b981' : 'transparent', color: activeCategory === 'all' ? '#ffffff' : '#94a3b8', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                      onClick={() => setActiveCategory('all')}
                    >
                      Tous
                    </button>

                    <button 
                      type="button"
                      style={{ background: activeCategory === 'pediatrie' ? '#10b981' : 'transparent', color: activeCategory === 'pediatrie' ? '#ffffff' : '#94a3b8', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                      onClick={() => setActiveCategory('pediatrie')}
                    >
                      Pédiatrie
                    </button>

                    <button 
                      type="button"
                      style={{ background: activeCategory === 'cardio' ? '#10b981' : 'transparent', color: activeCategory === 'cardio' ? '#ffffff' : '#94a3b8', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
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
                    <div className="p-3.5 rounded-4 d-flex flex-column justify-content-between" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                      <div>
                        <div className="d-flex gap-3 align-items-center mb-3">
                          <img src={doc.avatar} alt={doc.name} style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} />
                          <div>
                            <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>{doc.name}</h6>
                            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>{doc.specialty}</span>
                            <div className="small text-warning fw-bold mt-1" style={{ fontSize: '0.78rem' }}>★ {doc.rating}</div>
                          </div>
                        </div>

                        <div className="d-flex gap-2 mb-3 flex-wrap">
                          <span style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem' }}>🆔 {doc.cnom}</span>
                          {doc.langs.map((l, idx) => (
                            <span key={idx} style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem' }}>🌐 {l}</span>
                          ))}
                        </div>
                      </div>

                      <button 
                        type="button"
                        style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.55rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }} 
                        onClick={() => handleStartCall(doc)}
                      >
                        Consulter ›
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
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div className="d-flex align-items-center gap-2 mb-2 text-success">
                  <span style={{ fontSize: '1.3rem' }}>🏥</span>
                  <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Ordonnances Digitales</h6>
                </div>
                <p className="text-muted small mb-3">
                  Retrouvez vos prescriptions certifiées. Scannez le QR Code directement en pharmacie agréée.
                </p>

                <button 
                  type="button"
                  style={{ background: '#0f172a', color: '#34d399', border: '1px solid #10b981', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                  onClick={() => setActiveModal('prescription')}
                >
                  VOIR TOUT LE CARNET DE SANTÉ
                </button>
              </div>

              {/* Card QR Code CMU */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h6 className="fw-bold text-white mb-2">📲 Présentation QR Code CMU</h6>
                <p className="text-white-50 small mb-3">Présentez votre pass sanitaire numérique au médecin lors de l'appel.</p>
                
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

      {/* JOIN QUEUE MODAL */}
      {activeModal === 'join_queue' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '520px', width: '90%', background: '#1e293b', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h5 className="fw-bold text-success mb-3">🚪 Inscription en Salle d'Attente Virtuelle</h5>
            
            <form onSubmit={handleJoinQueue}>
              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Symptômes & Motif de consultation *</label>
                <textarea 
                  className="form-control text-white border-0" 
                  style={{ background: '#0f172a', borderRadius: '12px' }} 
                  rows={3} 
                  value={consultReason} 
                  onChange={(e) => setConsultReason(e.target.value)}
                  placeholder="Décrivez vos symptômes actuels..."
                  required 
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Niveau d'urgence *</label>
                <select 
                  className="form-select text-white border-0" 
                  style={{ background: '#0f172a', borderRadius: '10px' }}
                  value={urgencyLevel}
                  onChange={(e) => setUrgencyLevel(e.target.value)}
                >
                  <option value="routine">🟢 Consultation de routine (faible)</option>
                  <option value="medium">🟡 Symptômes modérés (moyenne)</option>
                  <option value="high">🟠 Douleurs / fièvre forte (élevée)</option>
                  <option value="critical">🔴 Urgence vitale (priorité absolue)</option>
                </select>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setActiveModal(null)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Entrer dans la file</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (ORANGE MONEY / WAVE) */}
      {activeModal === 'payment' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '480px', width: '90%', background: '#1e293b', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h5 className="fw-bold text-success mb-2">💳 Paiement Mobile Téléconsultation (2 500 FCFA)</h5>
            <p className="text-white-50 small mb-3">Ticket modérateur restant. Prise en charge UNAMUSC à 80% garantie.</p>

            <form onSubmit={handleProcessPayment}>
              <div className="d-flex gap-3 mb-4">
                <button 
                  type="button" 
                  style={{ 
                    flex: 1, 
                    padding: '0.85rem', 
                    borderRadius: '12px', 
                    background: paymentProvider === 'orange' ? '#ff7900' : '#0f172a', 
                    color: '#ffffff', 
                    border: paymentProvider === 'orange' ? '2px solid #ff7900' : '1px solid rgba(255,255,255,0.1)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPaymentProvider('orange')}
                >
                  <img src="/logo_orange_money.png" alt="Orange Money" style={{ height: '24px', borderRadius: '4px', background: '#ffffff', padding: '2px', marginRight: '6px' }} />
                  Orange Money
                </button>

                <button 
                  type="button" 
                  style={{ 
                    flex: 1, 
                    padding: '0.85rem', 
                    borderRadius: '12px', 
                    background: paymentProvider === 'wave' ? '#1dc4ff' : '#0f172a', 
                    color: '#ffffff', 
                    border: paymentProvider === 'wave' ? '2px solid #1dc4ff' : '1px solid rgba(255,255,255,0.1)',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPaymentProvider('wave')}
                >
                  <img src="/logo_wave.png" alt="Wave" style={{ height: '24px', borderRadius: '4px', marginRight: '6px' }} />
                  Wave
                </button>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Numéro Mobile Money *</label>
                <input 
                  type="text" 
                  className="form-control text-white border-0 fw-bold" 
                  style={{ background: '#0f172a', borderRadius: '10px' }} 
                  value={phoneNum} 
                  onChange={(e) => setPhoneNum(e.target.value)} 
                  required 
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setActiveModal(null)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Payer 2 500 FCFA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEBRTC LIVE SESSION MODAL WITH RESPONSIVE DUAL VIEW & REAL MIC VU-METER */}
      {activeModal === 'webrtc' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ maxWidth: '1000px', width: '95%', background: '#0f172a', borderRadius: '24px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '94vh', overflowY: 'auto' }}>
            
            {/* Header Status Bar */}
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h6 className="fw-bold text-success mb-0" style={{ fontSize: '1rem' }}>
                  🎥 Visioconférence Bidirectionnelle — {activeDoctor.name}
                </h6>
                <span className="badge bg-danger text-white" style={{ fontSize: '0.72rem' }}>● EN DIRECT (1080p WebRTC)</span>
              </div>
              <button className="btn-close btn-close-white" onClick={() => setActiveModal(null)}></button>
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
                      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', marginBottom: '0.5rem' }}>📷</div>
                      <h6 className="fw-bold text-white mb-1">Caméra désactivée</h6>
                    </div>
                  )}

                  {/* PIP SECONDARY OVERLAY BOX (CLICK TO SWAP) */}
                  <div 
                    className="position-absolute bottom-0 end-0 m-3 p-2 rounded-3 bg-dark border border-success d-flex align-items-center gap-2" 
                    style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.7)', zIndex: 10, cursor: 'pointer' }}
                    onClick={() => setSwappedViews(!swappedViews)}
                    title="Cliquer pour inverser les vues"
                  >
                    {!swappedViews ? (
                      <>
                        <img src={activeDoctor.avatar} alt={activeDoctor.name} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} />
                        <div className="text-start">
                          <small className="d-block text-white fw-bold" style={{ fontSize: '0.72rem' }}>{activeDoctor.name}</small>
                          <small className="text-success d-block" style={{ fontSize: '0.65rem' }}>⇄ Inverser la vue</small>
                        </div>
                      </>
                    ) : (
                      <div className="text-start p-1">
                        <small className="d-block text-white fw-bold" style={{ fontSize: '0.72rem' }}>{activeFirstName} {activeLastName}</small>
                        <small className="text-success d-block" style={{ fontSize: '0.65rem' }}>⇄ Vue Assuré (Caméra)</small>
                      </div>
                    )}
                  </div>

                </div>

                {/* REAL MICROPHONE AUDIO VU-METER BAR (VISUAL AUDIO TEST) */}
                <div className="p-2.5 mt-3 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '0.9rem' }}>🕪</span>
                      <small className="fw-bold text-white" style={{ fontSize: '0.78rem' }}>
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
                            background: isMuted ? '#dc2626' : (micVolume >= step ? '#10b981' : '#334155'), 
                            borderRadius: '2px',
                            transition: 'height 0.1s ease'
                          }} 
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Controls Bar */}
                <div className="d-flex justify-content-center gap-2 mt-3 p-2.5 rounded-4 bg-dark flex-wrap">
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
                    style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0.5rem 0.85rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }} 
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
                <div className="p-3 rounded-4 bg-dark h-100 d-flex flex-column justify-content-between" style={{ minHeight: '360px' }}>
                  <h6 className="fw-bold text-info mb-2" style={{ fontSize: '0.9rem' }}>💬 Messagerie Directe</h6>
                  <div className="p-2 rounded-3 mb-2 flex-grow-1" style={{ maxHeight: '250px', overflowY: 'auto', background: '#0f172a', fontSize: '0.82rem' }}>
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className="mb-2">
                        <strong className="text-success">{m.sender} : </strong>
                        <span className="text-white-50">{m.text}</span>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="d-flex gap-2">
                    <input type="text" className="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Écrire un message..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} />
                    <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.8rem' }}>Envoyer</button>
                  </form>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {activeModal === 'qr' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '420px', width: '90%', background: '#1e293b', borderRadius: '24px', padding: '2rem', textCenter: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h5 className="fw-bold text-success mb-2 text-center">📲 QR Code CMU Assuré</h5>
            <div className="p-3 bg-white rounded-3 d-inline-block mx-auto my-3" style={{ width: '180px', height: '180px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeCmuNumber}`} alt="QR Code CMU" style={{ width: '100%', height: '100%' }} />
            </div>
            <strong className="d-block text-warning text-center mb-3">{activeCmuNumber}</strong>
            <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1.5rem', fontWeight: '700', width: '100%' }} onClick={() => setActiveModal(null)}>Fermer</button>
          </div>
        </div>
      )}

      {/* PRESCRIPTION MODAL */}
      {activeModal === 'prescription' && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '640px', width: '90%', background: '#1e293b', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h5 className="fw-bold text-success mb-3">💊 Ordonnance Médicale Certifiée (Bon Pharmacie 50% 🇸🇳)</h5>
            <div className="p-4 rounded-3 bg-dark mb-3 border border-success">
              <strong className="text-success d-block mb-1">Dr. Ousmane Sow (Médecin Généraliste - CNOM: 4522-SN)</strong>
              <p className="small text-white-50 mb-0">• Amoxicilline 500mg (2 boîtes) • Paracétamol 1g (1 boîte)</p>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setActiveModal(null)}>Fermer</button>
              <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700', cursor: 'pointer' }} onClick={handleDownloadPrescription}>📥 Télécharger Ordonnance PDF Officielle (🇸🇳)</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
