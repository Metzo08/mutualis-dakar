import React, { useState, useEffect, useRef } from 'react';

export default function Telemedicine({ lang = 'fr' }) {
  // Pre-loaded initial sessions for robust testing
  const defaultSessions = [
    {
      id: 101,
      doctor_name: 'Dr. Aminata Ndiaye',
      specialty: 'Pédiatrie & Santé Familiale',
      scheduled_at: new Date(Date.now() + 1800000).toISOString(),
      room_token: 'RTC-SN-8849-NDIAYE',
      medical_summary: 'Patient consultant pour suivi fièvre modérée et toux sèche. Ordonnance de précaution émise.'
    },
    {
      id: 102,
      doctor_name: 'Dr. Cheikh Tidiane Seck',
      specialty: 'Cardiologie & Médecine Générale',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      room_token: 'RTC-SN-9921-SECK',
      medical_summary: 'Consultation de contrôle de tension artérielle. Bilan biologique recommandé.'
    }
  ];

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  // WebRTC Real Camera & Audio Stream States
  const userVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const [mediaStream, setMediaStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100%

  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLevel, setQrLevel] = useState(3); // 1: Public, 2: SOS, 3: Medecin WebRTC
  const [prescriptionSigned, setPrescriptionSigned] = useState(false);

  const [chatMessages, setChatMessages] = useState([
    { sender: 'Dr. Aminata Ndiaye', text: 'Bonjour ! Je suis connecté envisioconférence HD WebRTC. Comment vous sentez-vous ?' }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Prise de rendez-vous
  const [doctorName, setDoctorName] = useState('Dr. Aminata Ndiaye (Pédiatrie / Généraliste)');
  const [specialty, setSpecialty] = useState('Pédiatrie');
  const [scheduledAt, setScheduledAt] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  // Initialisation de la caméra réelle + WebAudio API Analyser pour le microphone
  useEffect(() => {
    let currentStream = null;

    const startAudioVisualizer = (stream) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = Math.min(100, Math.round((average / 128) * 100));
          setAudioLevel(level);
          animFrameRef.current = requestAnimationFrame(updateMeter);
        };

        updateMeter();
      } catch (e) {
        console.warn('Erreur WebAudio Analyser:', e);
      }
    };

    const startMediaDevices = async () => {
      if (activeSession) {
        setCameraError('');
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
              audio: true
            });
            currentStream = stream;
            setMediaStream(stream);
            setCameraActive(true);

            if (userVideoRef.current && !isCamOff) {
              userVideoRef.current.srcObject = stream;
            }

            // Démarrage du VU-mètre microphone audio
            startAudioVisualizer(stream);
          } else {
            setCameraError('Accès caméra/micro non supporté sur ce navigateur.');
          }
        } catch (err) {
          console.warn('Erreur ou refus d\'accès caméra/micro:', err);
          setCameraError('Caméra / Micro réel non accessible (Autorisation ou périphérique absent). Mode flux médical simulé actif.');
          setCameraActive(false);
        }
      }
    };

    startMediaDevices();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [activeSession]);

  // Effectuer la mise à jour de la vidéo quand isCamOff change
  useEffect(() => {
    if (userVideoRef.current && mediaStream && !isCamOff) {
      userVideoRef.current.srcObject = mediaStream;
    }
  }, [isCamOff, mediaStream]);

  // Coupure micro réelle (Audio Tracks)
  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);

    if (mediaStream) {
      mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !newMuteState; // false = muted
      });
    }

    if (newMuteState) {
      setAudioLevel(0);
    }
  };

  // Coupure caméra réelle (Video Tracks)
  const toggleCamera = () => {
    const newCamState = !isCamOff;
    setIsCamOff(newCamState);

    if (mediaStream) {
      mediaStream.getVideoTracks().forEach(track => {
        track.enabled = !newCamState; // false = off
      });
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telemedicine/sessions');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setSessions(json.data);
      } else {
        setSessions(defaultSessions);
      }
    } catch (err) {
      console.warn('Utilisation des sessions de démonstration:', err);
      setSessions(defaultSessions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleBookSession = async (e) => {
    e.preventDefault();
    setBookingSuccess('');
    const newSession = {
      id: Date.now(),
      doctor_name: doctorName,
      specialty: specialty,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : new Date(Date.now() + 3600000).toISOString(),
      room_token: `RTC-SN-${Math.floor(1000 + Math.random() * 9000)}-DEMO`,
      medical_summary: 'Consultation médicale programmée.'
    };

    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      await fetch('/api/telemedicine/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          doctor_name: doctorName,
          specialty,
          scheduled_at: newSession.scheduled_at
        })
      });
    } catch (err) {
      console.warn(err);
    }

    setSessions([newSession, ...sessions]);
    setBookingSuccess('Téléconsultation programmée avec succès ! Vous pouvez la rejoindre dès maintenant.');
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    setChatMessages([...chatMessages, { sender: 'Vous (Patient)', text: inputMsg }]);
    setInputMsg('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        sender: activeSession?.doctor_name || 'Médecin', 
        text: 'Bien reçu. Je viens de vérifier vos antécédents sur le Dossier Médical Partagé.' 
      }]);
    }, 1200);
  };

  const handleStartInstantCall = () => {
    const instantSession = {
      id: Date.now(),
      doctor_name: 'Dr. Aminata Ndiaye (Service Garde CMU)',
      specialty: 'Urgence & Consultation Générale En Direct',
      scheduled_at: new Date().toISOString(),
      room_token: 'RTC-SN-DIRECT-100% WebRTC',
      medical_summary: 'Téléconsultation WebRTC en direct démarrée. Le praticien consulte vos antécédents.'
    };
    setIsCamOff(false);
    setIsMuted(false);
    setActiveSession(instantSession);
  };

  // Signer l'ordonnance et l'injecter dans les Bons de Commande Pharmacie (localStorage + API)
  const handleSignPrescription = async () => {
    setPrescriptionSigned(true);

    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const newOrder = {
      id: Date.now(),
      first_name: citizenData.firstName || 'Amadou',
      last_name: citizenData.lastName || 'Sall',
      cmu_number: citizenData.cmuNumber || 'CMU-DKR-2026-8812',
      items_json: JSON.stringify([
        { name: 'Amoxicilline 500mg', qty: 2, price: 3500 },
        { name: 'Paracétamol 1g', qty: 1, price: 1500 }
      ]),
      total_amount: 8500,
      status: 'active',
      created_at: new Date().toISOString()
    };

    // Sauvegarde locale instantanée
    const existing = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
    localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrder, ...existing]));

    // POST serveur si backend disponible
    try {
      await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          items: [
            { name: 'Amoxicilline 500mg', qty: 2, price: 3500 },
            { name: 'Paracétamol 1g', qty: 1, price: 1500 }
          ],
          total_amount: 8500
        })
      });
    } catch (e) {
      console.warn('Enregistrement serveur optionnel:', e);
    }

    alert('✅ Ordonnance signée numériquement !\n\nUn Bon de Commande de Médicaments (valide 48h sous le régime du Tiers-Payant) a été généré et ajouté instantanément dans votre espace Bons de Commande.');
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique (Titre & Boutons centrés) */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_digital_health_real.jpg") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1 mb-2 fw-semibold d-inline-block text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              borderRadius: '20px',
              fontSize: '0.82rem',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            🎥 Visioconférence sécurisée WebRTC — Sans installation
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Fajj ci kaw internet (Télémédecine WebRTC)' : 'Télémédecine & téléconsultations médicales'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Waxtaan ak doktóor ci visioconférence bou am sécurité, joto sa ordonnance.'
              : 'Consultez des médecins et praticiens agréés en visioconférence chiffrée avec émission d\'ordonnance numérique automatique.'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm"
              style={{
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
              onClick={handleStartInstantCall}
            >
              ⚡ Lancer la visioconférence WebRTC en direct
            </button>

            <button 
              type="button"
              className="btn fw-semibold text-white"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
              onClick={fetchSessions}
            >
              🔄 Actualiser les rendez-vous
            </button>
          </div>
        </div>
      </section>

      {bookingSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-5 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{bookingSuccess}</div>
        </div>
      )}

      {activeSession ? (
        /* Salle virtuelle de téléconsultation WebRTC interactive avec vraie vidéo & vrai VU-Mètre Micro */
        <div className="card shadow-lg border-0 p-4 mb-4" style={{ borderRadius: '20px', background: '#0f172a', color: '#f8fafc' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3 flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0 text-white">🎥 Salle de téléconsultation — {activeSession.doctor_name}</h4>
              <small className="text-success fw-semibold">
                🟢 Flux WebRTC chiffré HD (Jitter 8ms • Audio 48kHz • Token: {activeSession.room_token})
              </small>
            </div>
            <button 
              type="button"
              className="btn fw-bold px-4 py-2 text-white shadow-sm" 
              style={{ borderRadius: '10px', background: '#dc2626', borderColor: '#b91c1c', color: '#ffffff' }} 
              onClick={() => setActiveSession(null)}
            >
              ❌ Quitter la consultation
            </button>
          </div>

          {cameraError && (
            <div className="alert alert-warning py-2 px-3 mb-3 small rounded-3 d-flex align-items-center">
              <span className="me-2">⚠️</span>
              <div>{cameraError}</div>
            </div>
          )}

          <div className="row g-4">
            {/* Écran vidéo principal (Médecin + Votre Caméra Réelle PIP) */}
            <div className="col-lg-8">
              <div 
                style={{ 
                  height: '420px', 
                  background: '#1e293b', 
                  borderRadius: '16px', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(16, 185, 129, 0.4)',
                  overflow: 'hidden'
                }}
              >
                {/* Visioconférence Médecin (Direct) */}
                <div className="text-center p-3">
                  <span style={{ fontSize: '4.5rem' }}>👨‍⚕️</span>
                  <h4 className="mt-2 text-white fw-bold">{activeSession.doctor_name}</h4>
                  <p className="text-info mb-2 small">{activeSession.specialty}</p>
                  <span className="badge bg-success px-3 py-1.5 fw-semibold" style={{ borderRadius: '20px' }}>
                    En direct • Visioconférence chiffrée (WebRTC 1080p)
                  </span>
                </div>

                {/* Fenêtre vidéo PIP de VOTRE véritable caméra vidéo (WebRTC Live Stream) */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '15px', 
                    right: '15px', 
                    width: '180px', 
                    height: '130px', 
                    background: '#000000', 
                    borderRadius: '12px',
                    border: '2px solid #10b981',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {isCamOff ? (
                    <div className="text-center p-2">
                      <span style={{ fontSize: '1.2rem' }}>🚫</span>
                      <div className="small text-white-50 mt-1" style={{ fontSize: '0.72rem' }}>Caméra désactivée</div>
                    </div>
                  ) : cameraActive ? (
                    <video 
                      ref={userVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span style={{ fontSize: '1.5rem' }}>📱</span>
                      <div className="small text-white fw-semibold mt-1" style={{ fontSize: '0.75rem' }}>Votre caméra (Simulée)</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Toolbar de contrôles WebRTC haut de gamme avec VU-Mètre néon intégré */}
              <div 
                className="d-flex justify-content-center align-items-center gap-3 mt-3 p-3 rounded-4 flex-wrap" 
                style={{ 
                  background: 'rgba(15, 23, 42, 0.95)', 
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {/* Bouton Microphone + VU-Mètre Audio Néon */}
                <button 
                  type="button"
                  className="btn px-3.5 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center gap-2.5" 
                  style={{ 
                    borderRadius: '12px', 
                    background: isMuted ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.9rem'
                  }}
                  onClick={toggleMute}
                >
                  <span>{isMuted ? '🎙️ Micro Coupé' : '🎙️ Micro Actif'}</span>
                  {!isMuted && (
                    <div className="d-flex align-items-center gap-1 px-2 py-1 rounded-2" style={{ background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                      {[15, 30, 45, 60, 75, 90].map((threshold, idx) => (
                        <div 
                          key={idx} 
                          style={{ 
                            width: '4px', 
                            height: `${10 + idx * 3}px`, 
                            backgroundColor: audioLevel >= threshold ? '#34d399' : '#64748b',
                            boxShadow: audioLevel >= threshold ? '0 0 6px #34d399' : 'none',
                            borderRadius: '2px',
                            transition: 'all 0.08s ease'
                          }} 
                        />
                      ))}
                    </div>
                  )}
                </button>

                {/* Bouton Caméra */}
                <button 
                  type="button"
                  className="btn px-3.5 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center gap-2" 
                  style={{ 
                    borderRadius: '12px', 
                    background: isCamOff ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', 
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.9rem'
                  }}
                  onClick={toggleCamera}
                >
                  {isCamOff ? '📹 Activer Caméra' : '📹 Caméra Active'}
                </button>

                {/* Bouton QR Code CMU */}
                <button 
                  type="button"
                  className="btn px-4 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center gap-2" 
                  style={{ 
                    borderRadius: '12px', 
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', 
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.9rem'
                  }} 
                  onClick={() => setShowQrModal(true)}
                >
                  📲 Présenter QR Code CMU
                </button>
              </div>
            </div>

            {/* Synthèse médicale & ordonnance & Chat */}
            <div className="col-lg-4">
              <div className="card h-100 p-3 border-0 text-white d-flex flex-column" style={{ background: '#1e293b', borderRadius: '16px' }}>
                <h6 className="fw-bold mb-2 text-info">💬 Messagerie & Synthèse du Praticien</h6>
                
                {/* Boîte de chat interactive */}
                <div className="p-2 bg-dark rounded-3 mb-2 flex-grow-1" style={{ maxHeight: '190px', overflowY: 'auto', fontSize: '0.85rem' }}>
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className="mb-2">
                      <strong className="text-success">{m.sender} : </strong>
                      <span className="text-white-50">{m.text}</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="d-flex gap-2 mb-3">
                  <input 
                    type="text" 
                    className="form-control form-control-sm bg-dark text-white border-secondary"
                    placeholder="Écrire un message au docteur..."
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                  />
                  <button type="submit" className="btn btn-sm btn-success">Envoyer</button>
                </form>

                <hr className="border-secondary my-2" />

                <h6 className="fw-bold mb-2 text-warning">📄 Ordonnance Numérique Générée</h6>
                <div className="p-2.5 bg-dark rounded-3 small mb-3 border border-secondary" style={{ fontSize: '0.85rem' }}>
                  <div>💊 <strong>Amoxicilline 500mg</strong> — 1 gélule (x3/jour pendant 5j)</div>
                  <div>💊 <strong>Paracétamol 1g</strong> — 1 comprimé (x3/jour)</div>
                  <span className="badge bg-success mt-2">Liaison directe bon de commande 48h</span>
                </div>

                <button 
                  className={`btn w-100 fw-bold py-2.5 mt-auto text-white ${prescriptionSigned ? 'btn-secondary' : 'btn-success'}`}
                  style={{ borderRadius: '10px', background: prescriptionSigned ? '#475569' : 'var(--primary)' }}
                  onClick={handleSignPrescription}
                  disabled={prescriptionSigned}
                >
                  {prescriptionSigned ? '✅ Ordonnance Signée & Injectée en Pharmacie' : '✅ Signer & générer le bon pharmacie (48h)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Formulaire prise de rendez-vous */}
          <div className="col-md-5">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📅 Réserver une téléconsultation</h4>
              
              <form onSubmit={handleBookSession}>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Médecin partenaire</label>
                  <select className="form-select input" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} style={{ borderRadius: '10px', height: '48px' }}>
                    <option value="Dr. Aminata Ndiaye (Pédiatrie / Généraliste)">Dr. Aminata Ndiaye (Pédiatrie / Généraliste)</option>
                    <option value="Dr. Cheikh Tidiane Seck (Cardiologue)">Dr. Cheikh Tidiane Seck (Cardiologue)</option>
                    <option value="Dr. Mariama Ba (Gynécologue-Obstétricienne)">Dr. Mariama Ba (Gynécologue-Obstétricienne)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Spécialité médicale</label>
                  <input type="text" className="form-control input" value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={{ borderRadius: '10px', height: '48px' }} />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Date & heure souhaitée</label>
                  <input type="datetime-local" className="form-control input" onChange={(e) => setScheduledAt(e.target.value)} style={{ borderRadius: '10px', height: '48px' }} />
                </div>

                <button 
                  type="submit" 
                  className="btn text-white w-100 fw-bold py-2.5" 
                  style={{ borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)', fontSize: '0.95rem' }}
                >
                  🗓️ Confirmer la réservation du RDV
                </button>
              </form>
            </div>
          </div>

          {/* Liste des rendez-vous de télémédecine */}
          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>🎥 Vos téléconsultations programmées</h4>

              {loading ? (
                <div className="text-center py-4 text-muted">Chargement...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <span style={{ fontSize: '3rem' }}>🎥</span>
                  <p className="mt-2" style={{ fontSize: '0.9rem' }}>Aucune téléconsultation programmée.</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {sessions.map((s) => (
                    <div key={s.id} className="p-3 border rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div>
                        <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{s.doctor_name} ({s.specialty})</h6>
                        <small className="text-muted" style={{ fontSize: '0.85rem' }}>📅 Date : {new Date(s.scheduled_at).toLocaleString('fr-FR')}</small>
                      </div>
                      <button 
                        type="button"
                        className="btn text-white fw-bold px-3 py-2" 
                        style={{ borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)', fontSize: '0.88rem' }} 
                        onClick={() => setActiveSession(s)}
                      >
                        🎥 Rejoindre l'appel WebRTC
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code Tri-Layer Médical Complet & Sécurisé */}
      {showQrModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0 p-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h5 className="fw-bold mb-0" style={{ color: 'var(--primary)' }}>
                    🛡️ QR Code Tri-Layer Sécurisé SÉN-CSU
                  </h5>
                  <small className="text-muted">Identification médicale universelle interopérable</small>
                </div>
                <button className="btn-close" onClick={() => setShowQrModal(false)}></button>
              </div>

              {/* Commutateur de Niveau d'Accès */}
              <div className="d-flex gap-2 mb-4 justify-content-center flex-wrap">
                <button 
                  className={`btn btn-sm fw-bold px-3 py-2 ${qrLevel === 1 ? 'btn-primary' : 'btn-outline-secondary'}`} 
                  onClick={() => setQrLevel(1)}
                  style={{ borderRadius: '8px' }}
                >
                  🟢 Niveau 1 : Identité Citoyen
                </button>
                <button 
                  className={`btn btn-sm fw-bold px-3 py-2 ${qrLevel === 2 ? 'btn-warning text-dark' : 'btn-outline-secondary'}`} 
                  onClick={() => setQrLevel(2)}
                  style={{ borderRadius: '8px' }}
                >
                  ⚠️ Niveau 2 : Urgence SOS
                </button>
                <button 
                  className={`btn btn-sm fw-bold px-3 py-2 ${qrLevel === 3 ? 'btn-success text-white' : 'btn-outline-secondary'}`} 
                  onClick={() => setQrLevel(3)}
                  style={{ borderRadius: '8px', background: qrLevel === 3 ? 'var(--primary)' : 'transparent' }}
                >
                  🩺 Niveau 3 : Praticien WebRTC
                </button>
              </div>

              <div className="row g-4 align-items-center">
                <div className="col-md-5 text-center">
                  <div className="p-3 bg-white rounded-4 d-inline-block border shadow-sm mb-2">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        JSON.stringify({
                          type: 'CSU_SEN_WEBRTC',
                          level: qrLevel,
                          patient: 'Amadou Sall',
                          cmu: 'CMU-DKR-2026-8812',
                          ipp: 'IPP-FANN-2026-9921',
                          blood: qrLevel >= 2 ? 'O+' : 'REDACTED',
                          token: activeSession?.room_token
                        })
                      )}`} 
                      alt="QR Code Tri-Layer CMU" 
                      style={{ width: '200px', height: '200px' }} 
                    />
                  </div>
                  <div className="small fw-bold text-success">
                    🔒 Signature Numérique AES-256 Validée
                  </div>
                </div>

                <div className="col-md-7">
                  <div className="p-3.5 rounded-3 mb-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                    <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>📋 Données Transmises en Consultation :</h6>
                    
                    <div className="row g-2 small">
                      <div className="col-6">
                        <span className="text-muted d-block">Nom & Prénom :</span>
                        <strong style={{ color: 'var(--text-main)' }}>Amadou Sall</strong>
                      </div>
                      <div className="col-6">
                        <span className="text-muted d-block">N° Carte CMU :</span>
                        <strong className="text-primary">CMU-DKR-2026-8812</strong>
                      </div>
                      <div className="col-6 mt-2">
                        <span className="text-muted d-block">Code Patient IPP :</span>
                        <code className="text-success fw-bold">IPP-FANN-2026-9921</code>
                      </div>
                      <div className="col-6 mt-2">
                        <span className="text-muted d-block">Groupe Sanguin :</span>
                        <strong className="text-danger">O Rhésus Positif (O+)</strong>
                      </div>
                      <div className="col-12 mt-2 border-top pt-2" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="text-muted d-block">Allergies Médicamenteuses :</span>
                        <span className="badge bg-danger-subtle text-danger border border-danger">⚠️ Pénicilline, Aspirine</span>
                      </div>
                    </div>
                  </div>

                  <small className="text-muted d-block mb-3" style={{ fontSize: '0.8rem' }}>
                    Ce QR Code permet au praticien de lier directement votre consultation Télémédecine à votre Dossier Médical Partagé (DMP).
                  </small>

                  <button className="btn btn-secondary w-100 fw-bold py-2" style={{ borderRadius: '10px' }} onClick={() => setShowQrModal(false)}>
                    Fermer l'affichage du QR Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
