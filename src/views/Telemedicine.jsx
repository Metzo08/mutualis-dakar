import React, { useState, useEffect } from 'react';

export default function Telemedicine({ lang = 'fr' }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

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
      if (json.success) {
        setSessions(json.data || []);
      }
    } catch (err) {
      console.error(err);
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
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const res = await fetch('/api/telemedicine/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          doctor_name: doctorName,
          specialty,
          scheduled_at: scheduledAt || new Date(Date.now() + 86400000)
        })
      });
      const json = await res.json();
      if (json.success) {
        setBookingSuccess('Téléconsultation programmée avec succès !');
        fetchSessions();
      }
    } catch (err) {
      console.error(err);
    }
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

          <button 
            type="button"
            className="btn fw-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '12px',
              padding: '0.65rem 1.3rem',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={fetchSessions}
          >
            🔄 {lang === 'wo' ? 'Yessal rendez-vous yi' : 'Actualiser les rendez-vous'}
          </button>
        </div>
      </section>

      {bookingSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-5 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{bookingSuccess}</div>
        </div>
      )}

      {activeSession ? (
        /* Salle virtuelle de téléconsultation WebRTC */
        <div className="card shadow-lg border-0 p-4 mb-4" style={{ borderRadius: '20px', background: '#0f172a', color: '#f8fafc' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3 flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0 text-white">🎥 Salle de téléconsultation — {activeSession.doctor_name}</h4>
              <small className="text-success fw-bold">🟢 Connexion chiffrée HD (Token WebRTC: {activeSession.room_token})</small>
            </div>
            <button className="btn btn-danger fw-bold px-4 py-2" style={{ borderRadius: '10px' }} onClick={() => setActiveSession(null)}>
              ❌ Clôturer / quitter la consultation
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
                <div className="text-center">
                  <span style={{ fontSize: '4.5rem' }}>👨‍⚕️</span>
                  <h4 className="mt-2 text-white fw-bold">{activeSession.doctor_name}</h4>
                  <span className="badge bg-success px-3 py-1">En direct • Flux vidéo médical HD (1080p)</span>
                </div>

                {/* Caméra patient PIP */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '15px', 
                    right: '15px', 
                    width: '130px', 
                    height: '95px', 
                    background: '#0f172a', 
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #10b981',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}
                >
                  <span className="small text-white fw-bold">📱 Votre caméra</span>
                </div>
              </div>

              <div className="d-flex gap-2 mt-3 justify-content-center flex-wrap">
                <button className="btn btn-secondary px-3" style={{ borderRadius: '10px' }}>🎙️ Couper micro</button>
                <button className="btn btn-secondary px-3" style={{ borderRadius: '10px' }}>📹 Activer caméra</button>
                <button className="btn btn-success px-3 fw-bold" style={{ borderRadius: '10px', background: 'var(--primary)' }} onClick={() => alert('Présentation du QR code de la carte CMU au médecin...')}>
                  📲 Présenter QR code carte CMU
                </button>
              </div>
            </div>

            {/* Synthèse médicale & ordonnance */}
            <div className="col-lg-4">
              <div className="card h-100 p-3 border-0 text-white" style={{ background: '#1e293b', borderRadius: '16px' }}>
                <h6 className="fw-bold mb-2 text-info">💬 Synthèse du praticien</h6>
                <p className="small text-white-50 mb-3">
                  {activeSession.medical_summary || 'Le médecin est en train de saisir la synthèse médicale et les conseils posologiques.'}
                </p>
                
                <hr className="border-secondary" />

                <h6 className="fw-bold mb-2 text-warning">📄 Ordonnance numérique générée</h6>
                <div className="p-3 bg-dark rounded-3 small mb-3 border border-secondary">
                  <div>💊 <strong>Amoxicilline 500mg</strong> — 1 gélule (x3/jour pendant 5j)</div>
                  <div>💊 <strong>Paracétamol 1g</strong> — 1 comprimé (x3/jour)</div>
                  <span className="badge bg-success mt-2">Liaison directe bon de commande 48h</span>
                </div>

                <button 
                  className="btn btn-success w-100 fw-bold py-2 mt-auto" 
                  style={{ borderRadius: '10px', background: 'var(--primary)' }}
                  onClick={() => alert('Ordonnance signée numériquement et injectée dans vos bons de commande pharmacie !')}
                >
                  ✅ Signer & générer le bon pharmacie (48h)
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

                <button type="submit" className="btn btn-primary w-100 fw-bold py-2" style={{ borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)' }}>
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
                <div className="list-group">
                  {sessions.map((s) => (
                    <div key={s.id} className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div>
                        <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{s.doctor_name} ({s.specialty})</h6>
                        <small className="text-muted">📅 Date : {new Date(s.scheduled_at).toLocaleString('fr-FR')}</small>
                      </div>
                      <button className="btn btn-success fw-bold px-3 py-2" style={{ borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)' }} onClick={() => setActiveSession(s)}>
                        🎥 Rejoindre l'appel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
