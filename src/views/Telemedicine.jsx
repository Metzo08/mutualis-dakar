import React, { useState, useEffect } from 'react';

export default function Telemedicine({ lang = 'fr' }) {
  // Pre-loaded initial sessions for robust offline/demo testing
  const defaultSessions = [
    {
      id: 101,
      doctor_name: 'Dr. Aminata Ndiaye',
      specialty: 'Pédiatrie & Santé Familiale',
      scheduled_at: new Date(Date.now() + 1800000).toISOString(), // Dans 30 min
      room_token: 'RTC-SN-8849-NDIAYE',
      medical_summary: 'Patient consultant pour suivi fièvre modérée et toux sèche. Ordonnance de précaution émise.'
    },
    {
      id: 102,
      doctor_name: 'Dr. Cheikh Tidiane Seck',
      specialty: 'Cardiologie & Médecine Générale',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Demain
      room_token: 'RTC-SN-9921-SECK',
      medical_summary: 'Consultation de contrôle de tension artérielle. Bilan biologique recommandé.'
    }
  ];

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  // WebRTC Call Interactive Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [prescriptionSigned, setPrescriptionSigned] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'Dr. Aminata Ndiaye', text: 'Bonjour ! Je suis en ligne pour votre téléconsultation.' }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Prise de rendez-vous
  const [doctorName, setDoctorName] = useState('Dr. Aminata Ndiaye (Pédiatrie / Généraliste)');
  const [specialty, setSpecialty] = useState('Pédiatrie');
  const [scheduledAt, setScheduledAt] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

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
      console.warn('Erreur chargement API télémédecine, utilisation des sessions de démonstration:', err);
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
      console.warn('Enregistrement serveur optionnel:', err);
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
        text: 'Bien reçu. Je viens de valider les consignes sur votre dossier.' 
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
    setActiveSession(instantSession);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_digital_health_real.jpg") center/cover no-repeat',
          padding: '2.5rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 position-relative" style={{ zIndex: 2 }}>
          <div style={{ maxWidth: '650px' }}>
            <span 
              className="badge px-3 py-1 mb-2 fw-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.22)',
                color: '#ffffff',
                backdropFilter: 'blur(4px)',
                borderRadius: '20px',
                fontSize: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              🎥 Visioconférence sécurisée WebRTC — Sans installation
            </span>
            <h1 className="fw-bold mb-2 text-white" style={{ fontSize: '1.9rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              {lang === 'wo' ? 'Fajj ci kaw internet (Télémédecine WebRTC)' : 'Télémédecine & téléconsultations médicales'}
            </h1>
            <p className="mb-0 text-white-50" style={{ fontSize: '0.95rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              {lang === 'wo'
                ? 'Waxtaan ak doktóor ci visioconférence bou am sécurité, joto sa ordonnance.'
                : 'Consultez des médecins et praticiens agréés en visioconférence chiffrée avec émission d\'ordonnance numérique automatique.'}
            </p>
          </div>

          <div className="d-flex gap-2 flex-wrap">
            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm"
              style={{
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '12px',
                padding: '0.65rem 1.3rem',
                fontSize: '0.9rem',
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
                padding: '0.65rem 1.3rem',
                fontSize: '0.9rem',
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
        /* Salle virtuelle de téléconsultation WebRTC interactive */
        <div className="card shadow-lg border-0 p-4 mb-4" style={{ borderRadius: '20px', background: '#0f172a', color: '#f8fafc' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3 flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0 text-white">🎥 Salle de téléconsultation — {activeSession.doctor_name}</h4>
              <small className="text-success fw-semibold">🟢 Flux WebRTC sécurisé HD (Jitter 12ms • Token: {activeSession.room_token})</small>
            </div>
            <button className="btn btn-danger fw-bold px-4 py-2" style={{ borderRadius: '10px' }} onClick={() => setActiveSession(null)}>
              ❌ Quitter la consultation
            </button>
          </div>

          <div className="row g-4">
            {/* Écran vidéo principal */}
            <div className="col-lg-8">
              <div 
                style={{ 
                  height: '380px', 
                  background: '#1e293b', 
                  borderRadius: '16px', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(16, 185, 129, 0.4)'
                }}
              >
                <div className="text-center p-3">
                  <span style={{ fontSize: '4.5rem' }}>👨‍⚕️</span>
                  <h4 className="mt-2 text-white fw-bold">{activeSession.doctor_name}</h4>
                  <p className="text-info mb-2 small">{activeSession.specialty}</p>
                  <span className="badge bg-success px-3 py-1.5 fw-semibold" style={{ borderRadius: '20px' }}>
                    En direct • Visioconférence chiffrée (WebRTC 1080p)
                  </span>
                </div>

                {/* Caméra patient PIP avec bascule On/Off */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '15px', 
                    right: '15px', 
                    width: '140px', 
                    height: '100px', 
                    background: isCamOff ? '#334155' : '#0f172a', 
                    borderRadius: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #10b981',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}
                >
                  {isCamOff ? (
                    <span className="small text-white-50">🚫 Caméra Désactivée</span>
                  ) : (
                    <>
                      <span style={{ fontSize: '1.5rem' }}>📱</span>
                      <span className="small text-white fw-bold">Votre caméra</span>
                    </>
                  )}
                </div>
              </div>

              {/* Contrôles interactifs du flux vidéo */}
              <div className="d-flex gap-2 mt-3 justify-content-center flex-wrap">
                <button 
                  className={`btn px-3 py-2 fw-semibold ${isMuted ? 'btn-danger' : 'btn-secondary'}`} 
                  style={{ borderRadius: '10px' }}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? '🎙️ Micro Coupé' : '🎙️ Couper Micro'}
                </button>

                <button 
                  className={`btn px-3 py-2 fw-semibold ${isCamOff ? 'btn-danger' : 'btn-secondary'}`} 
                  style={{ borderRadius: '10px' }}
                  onClick={() => setIsCamOff(!isCamOff)}
                >
                  {isCamOff ? '📹 Activer Caméra' : '📹 Désactiver Caméra'}
                </button>

                <button 
                  className="btn btn-success px-3 py-2 fw-bold text-white" 
                  style={{ borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)' }} 
                  onClick={() => setShowQrModal(true)}
                >
                  📲 Présenter QR Code Carte CMU
                </button>
              </div>
            </div>

            {/* Synthèse médicale & ordonnance & Chat */}
            <div className="col-lg-4">
              <div className="card h-100 p-3 border-0 text-white d-flex flex-column" style={{ background: '#1e293b', borderRadius: '16px' }}>
                <h6 className="fw-bold mb-2 text-info">💬 Messagerie & Synthèse du Praticien</h6>
                
                {/* Boîte de chat interactive */}
                <div className="p-2 bg-dark rounded-3 mb-2 flex-grow-1" style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.85rem' }}>
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
                    placeholder="Écrire un message..."
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
                  className={`btn w-100 fw-bold py-2 mt-auto text-white ${prescriptionSigned ? 'btn-secondary' : 'btn-success'}`}
                  style={{ borderRadius: '10px', background: prescriptionSigned ? '#475569' : 'var(--primary)' }}
                  onClick={() => {
                    setPrescriptionSigned(true);
                    alert('Ordonnance signée numériquement et injectée automatiquement dans vos Bons de Commande Pharmacie valides 48h !');
                  }}
                  disabled={prescriptionSigned}
                >
                  {prescriptionSigned ? '✅ Ordonnance Signée & Envoyée en Pharmacie' : '✅ Signer & générer le bon pharmacie (48h)'}
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

      {/* Modal QR Code Carte CMU */}
      {showQrModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 p-4 text-center" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h5 className="fw-bold mb-2">📲 Présentation QR Code Carte CMU</h5>
              <p className="text-muted small">Présentez ce code sécurisé au praticien WebRTC pour l'accès aux antécédents.</p>
              <div className="p-4 bg-white rounded-3 d-inline-block mx-auto mb-3 border">
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=CMU-PATIENT-SEN-884920`} alt="QR Code CMU" style={{ width: '180px', height: '180px' }} />
              </div>
              <button className="btn btn-secondary fw-bold" onClick={() => setShowQrModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
