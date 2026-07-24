import React, { useState, useEffect, useRef } from 'react';

// Design Premium Haut de Gamme — Télémédecine & Téléconsultation Live WebRTC
export default function Telemedicine({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);

  // Assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Awa';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Ndiaye';

  // Mode de rôle (Assuré ou Médecin de Garde)
  const [roleMode, setRoleMode] = useState(isAgent ? 'doctor' : 'citizen');

  // Liste des Praticiens Agrés
  const doctorsList = [
    {
      id: 1,
      name: 'Dr. Ousmane Sow',
      specialty: 'Médecine Générale',
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

  const [activeCategory, setActiveCategory] = useState('all');

  // Modale Inscription Salle d'attente
  const [showJoinQueueModal, setShowJoinQueueModal] = useState(false);
  const [consultReason, setConsultReason] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('routine');
  const [selectedDoctor, setSelectedDoctor] = useState(doctorsList[0]);

  // Modale Paiement Ticket Modérateur (2 500 FCFA)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState('orange'); // 'orange' or 'wave'
  const [phoneNum, setPhoneNum] = useState('77 602 67 83');

  // Session Visioconférence Live WebRTC
  const [inLiveSession, setInLiveSession] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState(doctorsList[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [audioLevel, setAudioLevel] = useState(55);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'Dr. Ousmane Sow', text: 'Bonjour Awa. Je consulte vos antécédents médicaux. Parlez-moi de vos symptômes.' }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Modales Certifications & QR Code
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Soumettre inscription file d'attente
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
    setShowJoinQueueModal(false);
    setConsultReason('');
    alert("✅ Vous êtes inscrit(e) dans la file d'attente du médecin ! Accès direct sécurisé UNAMUSC.");
  };

  // Traiter paiement Orange Money / Wave
  const handleProcessPayment = (e) => {
    e.preventDefault();
    setShowPaymentModal(false);
    alert(`✅ Règlement de 2 500 FCFA effectué avec succès via ${paymentProvider === 'orange' ? 'Orange Money' : 'Wave'} ! Ticket modérateur validé.`);
  };

  const handleStartCall = (doc) => {
    setActiveDoctor(doc);
    setInLiveSession(true);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;
    setChatMessages([...chatMessages, { sender: `${activeFirstName} ${activeLastName}`, text: inputMsg }]);
    setInputMsg('');
  };

  return (
    <div className="telemed-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#0f172a', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>Télémédecine</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.75rem' }}>
              ● SALLE D'ATTENTE VIRTUELLE LIVE
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              type="button" 
              style={{ background: roleMode === 'citizen' ? '#10b981' : '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              onClick={() => setRoleMode('citizen')}
            >
              Espace Assuré
            </button>
            <button 
              type="button" 
              style={{ background: roleMode === 'doctor' ? '#10b981' : '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}
              onClick={() => setRoleMode('doctor')}
            >
              Espace Médecin de Garde
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-4 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.5rem' }}>
                ● SALLE D'ATTENTE VIRTUELLE LIVE
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.2rem', letterSpacing: '-0.02em' }}>Consultation Instantanée 24h/7</h1>
              <p className="text-white-50 mb-4" style={{ fontSize: '0.98rem', maxWidth: '650px', lineHeight: '1.5' }}>
                Accédez à un réseau de médecins agréés en moins de 10 minutes. Vidéoconférence HD WebRTC sécurisée et cryptée.
              </p>
              
              <div className="d-flex gap-3 flex-wrap">
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', cursor: 'pointer' }}
                  onClick={() => setShowJoinQueueModal(true)}
                >
                  ⚡ Entrer en salle d'attente
                </button>

                <button 
                  type="button"
                  style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                  onClick={() => setShowPaymentModal(true)}
                >
                  💳 Régler Ticket Modérateur (2 500 FCFA)
                </button>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="p-3.5 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="d-flex" style={{ marginLeft: '10px' }}>
                      {doctorsList.map((d, i) => (
                        <img key={i} src={d.avatar} alt={d.name} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #10b981', marginLeft: '-10px', objectFit: 'cover' }} />
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
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.15rem' }}>👨‍⚕️ Praticiens Disponibles</h5>
                
                {/* Category Buttons (Explicit Dark Styles - NO WHITE ON WHITE!) */}
                <div style={{ display: 'flex', gap: '0.4rem', background: '#1e293b', padding: '0.25rem', borderRadius: '12px' }}>
                  <button 
                    type="button"
                    style={{ 
                      background: activeCategory === 'all' ? '#10b981' : 'transparent', 
                      color: activeCategory === 'all' ? '#ffffff' : '#94a3b8', 
                      border: 'none', 
                      borderRadius: '10px', 
                      padding: '0.35rem 0.85rem', 
                      fontWeight: '700', 
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }} 
                    onClick={() => setActiveCategory('all')}
                  >
                    Généraliste
                  </button>

                  <button 
                    type="button"
                    style={{ 
                      background: activeCategory === 'pediatrie' ? '#10b981' : 'transparent', 
                      color: activeCategory === 'pediatrie' ? '#ffffff' : '#94a3b8', 
                      border: 'none', 
                      borderRadius: '10px', 
                      padding: '0.35rem 0.85rem', 
                      fontWeight: '700', 
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }} 
                    onClick={() => setActiveCategory('pediatrie')}
                  >
                    Pédiatrie
                  </button>

                  <button 
                    type="button"
                    style={{ 
                      background: activeCategory === 'cardio' ? '#10b981' : 'transparent', 
                      color: activeCategory === 'cardio' ? '#ffffff' : '#94a3b8', 
                      border: 'none', 
                      borderRadius: '10px', 
                      padding: '0.35rem 0.85rem', 
                      fontWeight: '700', 
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }} 
                    onClick={() => setActiveCategory('cardio')}
                  >
                    Cardiologue
                  </button>
                </div>
              </div>

              <div className="row g-3">
                {doctorsList.map((doc) => (
                  <div key={doc.id} className="col-md-6">
                    <div className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                      <div>
                        <div className="d-flex gap-3 align-items-center mb-3">
                          <img src={doc.avatar} alt={doc.name} style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover' }} />
                          <div>
                            <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1.02rem' }}>{doc.name}</h6>
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
                  onClick={() => setShowPrescriptionModal(true)}
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
                  onClick={() => setShowQrModal(true)}
                >
                  Afficher QR Code Assuré
                </button>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* JOIN QUEUE MODAL */}
      {showJoinQueueModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleJoinQueue} className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-3">🚪 Inscription en Salle d'Attente Virtuelle</h5>
              
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
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowJoinQueueModal(false)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Entrer dans la file</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYMENT MODAL (ORANGE MONEY / WAVE) */}
      {showPaymentModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleProcessPayment} className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-2">💳 Paiement Mobile Téléconsultation (2 500 FCFA)</h5>
              <p className="text-white-50 small mb-3">Ticket modérateur restant. Prise en charge UNAMUSC à 80% garantie.</p>

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
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowPaymentModal(false)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Payer 2 500 FCFA</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEBRTC LIVE SESSION MODAL */}
      {inLiveSession && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#0f172a' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-success mb-0">🎥 Consultation Visioconférence HD — {activeDoctor.name}</h5>
                <button className="btn-close btn-close-white" onClick={() => setInLiveSession(false)}></button>
              </div>

              <div className="row g-4">
                <div className="col-lg-8">
                  <div className="rounded-4 p-4 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: '420px', background: '#1e293b', position: 'relative', border: '2px solid #10b981' }}>
                    <img src={activeDoctor.avatar} alt={activeDoctor.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #10b981' }} />
                    <h4 className="fw-bold mt-3 mb-1">{activeDoctor.name}</h4>
                    <span style={{ background: '#10b981', color: '#ffffff', padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>{activeDoctor.specialty}</span>
                    <small className="text-white-50 mt-2">Visioconférence chiffrée de bout en bout (WebRTC 1080p)</small>
                  </div>

                  <div className="d-flex justify-content-center gap-3 mt-3 p-3 rounded-4 bg-dark">
                    <button type="button" style={{ background: isMuted ? '#dc2626' : '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.25rem', fontWeight: '700' }} onClick={() => setIsMuted(!isMuted)}>
                      {isMuted ? '🎙️ Micro Coupé' : '🎙️ Micro Actif'}
                    </button>
                    <button type="button" style={{ background: isCamOff ? '#dc2626' : '#0284c7', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.25rem', fontWeight: '700' }} onClick={() => setIsCamOff(!isCamOff)}>
                      {isCamOff ? '📹 Activer Caméra' : '📹 Caméra Active'}
                    </button>
                    <button type="button" style={{ background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.25rem', fontWeight: '700' }} onClick={() => setInLiveSession(false)}>
                      Quitter la consultation
                    </button>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="p-3 rounded-4 bg-dark h-100 d-flex flex-column justify-content-between">
                    <h6 className="fw-bold text-info mb-3">💬 Messagerie Directe</h6>
                    <div className="p-2 rounded-3 mb-3 flex-grow-1" style={{ maxHeight: '280px', overflowY: 'auto', background: '#0f172a', fontSize: '0.85rem' }}>
                      {chatMessages.map((m, idx) => (
                        <div key={idx} className="mb-2">
                          <strong className="text-success">{m.sender} : </strong>
                          <span className="text-white-50">{m.text}</span>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="d-flex gap-2">
                      <input type="text" className="form-control form-control-sm bg-dark text-white border-secondary" placeholder="Écrire..." value={inputMsg} onChange={(e) => setInputMsg(e.target.value)} />
                      <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.8rem', fontWeight: '700' }}>Envoyer</button>
                    </form>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {showQrModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white text-center p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-2">📲 QR Code CMU Assuré</h5>
              <div className="p-3 bg-white rounded-3 d-inline-block mx-auto my-3" style={{ width: '180px', height: '180px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeCmuNumber}`} alt="QR Code CMU" style={{ width: '100%', height: '100%' }} />
              </div>
              <strong className="d-block text-warning mb-3">{activeCmuNumber}</strong>
              <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1.5rem', fontWeight: '700' }} onClick={() => setShowQrModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* PRESCRIPTION MODAL */}
      {showPrescriptionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-3">💊 Ordonnance Médicale Certifiée (Bon Pharmacie 50%)</h5>
              <div className="p-4 rounded-3 bg-dark mb-3 border border-success">
                <strong className="text-success d-block mb-1">Dr. Ousmane Sow (Médecin Généraliste)</strong>
                <p className="small text-white-50 mb-0">• Amoxicilline 500mg (2 boîtes) • Paracétamol 1g (1 boîte)</p>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowPrescriptionModal(false)}>Fermer</button>
                <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }} onClick={() => window.print()}>🖨️ Imprimer PDF A4</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
