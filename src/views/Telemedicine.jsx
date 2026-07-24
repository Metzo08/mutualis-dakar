import React, { useState, useEffect, useRef } from 'react';

// Design Premium Haut de Gamme (Dark Emerald WebRTC Telemedicine Platform)
export default function Telemedicine({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);

  // Assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Awa';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Ndiaye';

  // Liste des Médecins Agrés
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

  // Historique des consultations
  const [consultHistory] = useState([
    { id: 101, date: '12 Mai 2024', doctor: 'Dr. Sow', reason: 'Suivi Grippe', status: 'Certifié' },
    { id: 102, date: '28 Avril 2024', doctor: 'Dr. Diop', reason: 'Consultation Maternité', status: 'Certifié' }
  ]);

  const [activeCategory, setActiveCategory] = useState('all');

  // Modal WebRTC Session Live
  const [inLiveSession, setInLiveSession] = useState(false);
  const [activeDoctor, setActiveDoctor] = useState(doctorsList[0]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [audioLevel, setAudioLevel] = useState(45);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'Dr. Ousmane Sow', text: 'Bonjour Awa, je consulte votre dossier médical. Comment vous sentez-vous ?' }
  ]);
  const [inputMsg, setInputMsg] = useState('');

  // Modale Ordonnance & QR
  const [showQrModal, setShowQrModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

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
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', padding: '0.75rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>Télémédecine</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600', padding: '0.25rem 0.65rem' }}>
              ● SALLE D'ATTENTE VIRTUELLE LIVE
            </span>
          </div>

          <div className="input-group input-group-sm" style={{ width: '260px' }}>
            <input type="text" className="form-control bg-dark text-white border-secondary small" placeholder="Chercher un praticien..." style={{ borderRadius: '10px 0 0 10px', fontSize: '0.8rem' }} />
            <button className="btn btn-outline-secondary" type="button" style={{ borderRadius: '0 10px 10px 0' }}>🔍</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-4 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span className="badge bg-success text-white px-3 py-1.5 rounded-pill mb-2 fw-semibold" style={{ fontSize: '0.75rem' }}>● SALLE D'ATTENTE VIRTUELLE LIVE</span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.3rem', letterSpacing: '-0.02em' }}>Consultation Instantanée 24h/7</h1>
              <p className="text-white-50 mb-4" style={{ fontSize: '1rem', maxWidth: '650px', lineHeight: '1.5' }}>
                Accédez à un réseau de médecins agréés en moins de 10 minutes. Vidéoconférence HD WebRTC sécurisée et cryptée.
              </p>
              
              <div className="d-flex gap-3 flex-wrap">
                <button className="btn btn-success px-4 py-2.5 fw-bold text-white shadow-lg d-flex align-items-center gap-2" style={{ background: '#10b981', borderRadius: '12px', border: 'none' }} onClick={() => handleStartCall(doctorsList[0])}>
                  <span>⚡ Entrer maintenant</span>
                </button>
                <button className="btn btn-dark px-4 py-2.5 fw-bold text-white shadow-sm" style={{ borderRadius: '12px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => alert("Prise de rendez-vous ouverte.")}>
                  Prendre RDV
                </button>
              </div>
            </div>

            <div className="col-lg-4">
              <div className="p-3.5 rounded-4" style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <div className="d-flex" style={{ marginLeft: '10px' }}>
                      {doctorsList.map((d, i) => (
                        <img key={i} src={d.avatar} alt={d.name} style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid #10b981', marginLeft: '-10px', objectFit: 'cover' }} />
                      ))}
                      <div className="d-flex align-items-center justify-content-center bg-dark text-white fw-bold small rounded-circle" style={{ width: '36px', height: '36px', border: '2px solid #10b981', marginLeft: '-10px', fontSize: '0.75rem' }}>+12</div>
                    </div>
                  </div>
                </div>
                <h6 className="fw-bold text-white mb-1" style={{ fontSize: '0.9rem' }}>Médecins en ligne</h6>
                <small className="text-muted d-block">Temps d'attente estimé: <span className="text-success fw-bold">4 min</span></small>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Content (Left Main + Right Sidebar) */}
        <div className="row g-4 mb-4">
          
          {/* Main Area: Doctors + History */}
          <div className="col-lg-8">
            
            {/* Section Praticiens Disponibles */}
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.15rem' }}>👨‍⚕️ Praticiens Disponibles</h5>
                
                <div className="d-flex gap-2">
                  <button className={`btn btn-sm fw-bold ${activeCategory === 'all' ? 'btn-success text-white' : 'btn-dark text-white-50'}`} style={{ borderRadius: '20px', fontSize: '0.78rem' }} onClick={() => setActiveCategory('all')}>Généraliste</button>
                  <button className={`btn btn-sm fw-bold ${activeCategory === 'pediatrie' ? 'btn-success text-white' : 'btn-dark text-white-50'}`} style={{ borderRadius: '20px', fontSize: '0.78rem' }} onClick={() => setActiveCategory('pediatrie')}>Pédiatrie</button>
                  <button className={`btn btn-sm fw-bold ${activeCategory === 'cardio' ? 'btn-success text-white' : 'btn-dark text-white-50'}`} style={{ borderRadius: '20px', fontSize: '0.78rem' }} onClick={() => setActiveCategory('cardio')}>Cardiologue</button>
                </div>
              </div>

              <div className="row g-3">
                {doctorsList.map((doc) => (
                  <div key={doc.id} className="col-md-6">
                    <div className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
                      <div>
                        <div className="d-flex gap-3 align-items-center mb-3">
                          <div style={{ position: 'relative' }}>
                            <img src={doc.avatar} alt={doc.name} style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover' }} />
                            <span className="badge bg-success rounded-circle p-1 position-absolute bottom-0 end-0 border border-dark" style={{ width: '14px', height: '14px' }}></span>
                          </div>

                          <div>
                            <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1.02rem' }}>{doc.name}</h6>
                            <span className="badge px-2 py-1 rounded-2 mb-1" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.75rem', fontWeight: '600' }}>{doc.specialty}</span>
                            <div className="small text-warning fw-bold" style={{ fontSize: '0.78rem' }}>★ {doc.rating}</div>
                          </div>
                        </div>

                        <div className="d-flex gap-2 mb-3 flex-wrap">
                          <span className="badge bg-dark text-white-50 border border-secondary" style={{ fontSize: '0.7rem' }}>🆔 {doc.cnom}</span>
                          {doc.langs.map((l, idx) => (
                            <span key={idx} className="badge bg-dark text-white-50 border border-secondary" style={{ fontSize: '0.7rem' }}>🌐 {l}</span>
                          ))}
                        </div>
                      </div>

                      <button className="btn btn-dark w-100 fw-bold py-2 text-white shadow-sm d-flex align-items-center justify-content-center gap-1" style={{ background: '#0f172a', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem' }} onClick={() => handleStartCall(doc)}>
                        <span>Consulter</span>
                        <span>›</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section Mes Dernières Consultations Table */}
            <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' }}>
              <h5 className="fw-bold text-white mb-3" style={{ fontSize: '1.15rem' }}>🔄 Mes dernières consultations</h5>

              <div className="table-responsive">
                <table className="table table-dark table-hover align-middle mb-0" style={{ background: 'transparent' }}>
                  <thead>
                    <tr className="text-muted small border-bottom border-secondary border-opacity-25" style={{ fontSize: '0.78rem' }}>
                      <th scope="col">DATE</th>
                      <th scope="col">PRATICIEN</th>
                      <th scope="col">MOTIF</th>
                      <th scope="col">DOCUMENTS</th>
                      <th scope="col" className="text-end">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultHistory.map((item) => (
                      <tr key={item.id} className="border-bottom border-secondary border-opacity-10">
                        <td className="py-3 text-white-50 small">{item.date}</td>
                        <td className="fw-bold text-white" style={{ fontSize: '0.88rem' }}>{item.doctor}</td>
                        <td className="text-white-50 small">{item.reason}</td>
                        <td>
                          <span className="badge bg-dark text-success border border-success me-1">📑 Ordonnance</span>
                        </td>
                        <td className="text-end">
                          <button className="btn btn-link text-success p-0 fw-bold text-decoration-none small" onClick={() => alert(`Revoir la consultation du ${item.date}`)}>Revoir</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                  Retrouvez vos prescriptions certifiées. Scannez le QR Code directement en pharmacie agréée UNAMUSC.
                </p>

                <div className="p-3 rounded-3 mb-3 d-flex align-items-center justify-content-between" style={{ background: '#0f172a', border: '1px dashed rgba(16, 185, 129, 0.4)' }}>
                  <div>
                    <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Dernière ordonnance</small>
                    <strong className="text-white small">REF: #ORD-9982</strong>
                  </div>
                  <button className="btn btn-sm btn-dark text-success" onClick={() => setShowPrescriptionModal(true)}>📥</button>
                </div>

                <button className="btn btn-dark w-100 fw-bold py-2 text-white" style={{ background: '#0f172a', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.82rem' }} onClick={() => setShowPrescriptionModal(true)}>
                  VOIR TOUT LE CARNET
                </button>
              </div>

              {/* Card Besoin d'assistance */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h6 className="fw-bold text-white mb-3">Besoin d'assistance ?</h6>

                <div className="d-flex flex-column gap-2.5">
                  <div className="p-3 rounded-3 d-flex align-items-center gap-3" style={{ background: '#0f172a', cursor: 'pointer' }} onClick={() => alert("Ouverture du Chat Assistance...")}>
                    <span style={{ fontSize: '1.3rem' }}>🎧</span>
                    <div>
                      <strong className="d-block text-white small">Chat avec un conseiller</strong>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>Réponse moyenne: <span className="text-success fw-bold">2 min</span></small>
                    </div>
                  </div>

                  <div className="p-3 rounded-3 d-flex align-items-center gap-3" style={{ background: '#0f172a', cursor: 'pointer' }} onClick={() => alert("Ouverture du Guide d'utilisation...")}>
                    <span style={{ fontSize: '1.3rem' }}>❓</span>
                    <div>
                      <strong className="d-block text-white small">Guide d'utilisation</strong>
                      <small className="text-muted" style={{ fontSize: '0.72rem' }}>Comment se préparer pour sa vidéo-conférence</small>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-3 mt-3 text-center" style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem', color: '#94a3b8' }}>
                  "Awa, notre équipe technique est disponible pour vous aider."
                </div>
              </div>

              {/* Card Statut du réseau */}
              <div className="p-3.5 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="small fw-bold text-muted" style={{ fontSize: '0.75rem' }}>STATUT DU RÉSEAU</span>
                  <span className="badge bg-success-subtle text-success" style={{ fontSize: '0.7rem' }}>● Haute disponibilité</span>
                </div>

                <div className="row text-center g-2">
                  <div className="col-4">
                    <strong className="d-block text-white fw-bold fs-6">99.8%</strong>
                    <small className="text-muted" style={{ fontSize: '0.68rem' }}>UPTIME VIDÉO</small>
                  </div>
                  <div className="col-4">
                    <strong className="d-block text-white fw-bold fs-6">4.2k</strong>
                    <small className="text-muted" style={{ fontSize: '0.68rem' }}>RDV CE MOIS</small>
                  </div>
                  <div className="col-4">
                    <strong className="d-block text-white fw-bold fs-6">128</strong>
                    <small className="text-muted" style={{ fontSize: '0.68rem' }}>PHARMACIES SYNC</small>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Footer info bar */}
        <div className="pt-4 border-top border-secondary border-opacity-25 text-center text-muted small">
          <div className="d-flex justify-content-center gap-4 mb-2">
            <span style={{ cursor: 'pointer' }}>Mentions Légales</span>
            <span style={{ cursor: 'pointer' }}>Confidentialité</span>
            <span style={{ cursor: 'pointer' }}>Support Technique</span>
          </div>
          <p className="mb-0" style={{ fontSize: '0.78rem' }}>
            © 2024 UNAMUSC Sénégal - Union Nationale des Mutuelles de Santé. Design par HealthTech Solutions.
          </p>
        </div>

      </div>

      {/* WEBRTC LIVE SESSION MODAL */}
      {inLiveSession && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 text-white" style={{ borderRadius: '24px', background: '#0f172a' }}>
              <div className="modal-header border-bottom border-secondary p-3 d-flex justify-content-between">
                <h5 className="modal-title fw-bold text-success d-flex align-items-center gap-2">
                  <span>🎥 Consultation Visioconférence HD — {activeDoctor.name}</span>
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setInLiveSession(false)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-4">
                  
                  {/* Video Stream Screen */}
                  <div className="col-lg-8">
                    <div className="rounded-4 p-4 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: '420px', background: '#1e293b', position: 'relative', border: '2px solid #10b981' }}>
                      <img src={activeDoctor.avatar} alt={activeDoctor.name} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '4px solid #10b981' }} />
                      <h4 className="fw-bold mt-3 mb-1">{activeDoctor.name}</h4>
                      <span className="badge bg-success px-3 py-1.5 rounded-pill mb-2">{activeDoctor.specialty}</span>
                      <small className="text-white-50">Visioconférence chiffrée de bout en bout (WebRTC 1080p)</small>

                      {/* PIP Self Camera Mock */}
                      <div className="position-absolute bottom-0 end-0 m-3 p-2 rounded-3 bg-dark border border-success" style={{ width: '140px', height: '100px' }}>
                        <small className="d-block text-center text-white-50" style={{ fontSize: '0.7rem' }}>Caméra Assuré</small>
                        <div className="d-flex align-items-center justify-content-center h-75 text-success font-monospace small">
                          {isCamOff ? '🚫 Off' : '📷 On'}
                        </div>
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="d-flex justify-content-center gap-3 mt-3 p-3 rounded-4 bg-dark">
                      <button className={`btn fw-bold px-3.5 py-2 text-white ${isMuted ? 'btn-danger' : 'btn-success'}`} style={{ borderRadius: '12px' }} onClick={() => setIsMuted(!isMuted)}>
                        {isMuted ? '🎙️ Micro Coupé' : '🎙️ Micro Actif'}
                      </button>
                      <button className={`btn fw-bold px-3.5 py-2 text-white ${isCamOff ? 'btn-danger' : 'btn-primary'}`} style={{ borderRadius: '12px' }} onClick={() => setIsCamOff(!isCamOff)}>
                        {isCamOff ? '📹 Activer Caméra' : '📹 Caméra Active'}
                      </button>
                      <button className="btn btn-warning fw-bold px-4 py-2 text-dark" style={{ borderRadius: '12px' }} onClick={() => setShowQrModal(true)}>
                        📲 QR Code CMU
                      </button>
                      <button className="btn btn-danger fw-bold px-4 py-2 text-white" style={{ borderRadius: '12px' }} onClick={() => setInLiveSession(false)}>
                        Quitter la Consultation
                      </button>
                    </div>
                  </div>

                  {/* Right Chat Panel */}
                  <div className="col-lg-4">
                    <div className="p-3 rounded-4 bg-dark h-100 d-flex flex-column justify-content-between" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
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
                        <button type="submit" className="btn btn-sm btn-success fw-bold">Envoyer</button>
                      </form>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE CMU MODAL */}
      {showQrModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white text-center p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-2">📲 QR Code CMU — Validation Présentielle</h5>
              <p className="text-muted small mb-3">Présentez ce QR code au praticien pour la prise en charge à 100%.</p>
              <div className="p-3 bg-white rounded-3 d-inline-block mx-auto mb-3" style={{ width: '180px', height: '180px' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeCmuNumber}`} alt="QR Code CMU" style={{ width: '100%', height: '100%' }} />
              </div>
              <strong className="d-block text-warning mb-3">{activeCmuNumber}</strong>
              <button className="btn btn-secondary fw-bold" style={{ borderRadius: '12px' }} onClick={() => setShowQrModal(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* PRESCRIPTION MODAL */}
      {showPrescriptionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-success mb-0">💊 Ordonnance Médicale Certifiée</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowPrescriptionModal(false)}></button>
              </div>

              <div className="p-4 rounded-3 bg-dark mb-3 border border-secondary">
                <div className="d-flex justify-content-between mb-3 border-bottom border-secondary pb-2">
                  <div>
                    <strong className="text-success d-block">Dr. Ousmane Sow (Médecin Généraliste)</strong>
                    <small className="text-muted">CNOM: 4522-SN • Hôpital Fann Dakar</small>
                  </div>
                  <div className="text-end">
                    <small className="text-muted d-block">Date: 12/05/2026</small>
                    <small className="text-success fw-bold">REF: #ORD-9982</small>
                  </div>
                </div>

                <h6 className="fw-bold text-white mb-2">Prescriptions :</h6>
                <ul className="text-white-50 small mb-0">
                  <li>• Amoxicilline 500mg (2 boîtes) — 1 gélule 3x/jour pendant 7 jours</li>
                  <li>• Paracétamol 1g (1 boîte) — 1 comprimé en cas de fièvre</li>
                </ul>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button className="btn btn-outline-secondary text-white" onClick={() => setShowPrescriptionModal(false)}>Fermer</button>
                <button className="btn btn-success fw-bold" onClick={() => alert("Téléchargement du PDF A4 de l'ordonnance certifiée...")}>🖨️ Télécharger PDF A4</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
