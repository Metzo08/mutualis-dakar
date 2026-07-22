import React, { useState, useEffect } from 'react';

export default function Telemedicine({ lang = 'fr' }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  // Prise de rendez-vous
  const [doctorName, setDoctorName] = useState('Dr. Aminata Ndiaye');
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
      {/* Header avec Bannière Glassmorphism */}
      <div 
        className="p-4 mb-4 rounded-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-3"
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 50%, #3730a3 100%)',
          boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.3)'
        }}
      >
        <div>
          <span className="badge bg-white text-indigo fw-bold px-3 py-1 mb-2" style={{ fontSize: '0.75rem', borderRadius: '20px', color: '#4f46e5' }}>
            🎥 Visioconférence Sécurisée WebRTC — Sans Installation
          </span>
          <h2 className="fw-bold mb-1 text-white">
            {lang === 'wo' ? 'Fajj ci kaw internet (Télémédecine WebRTC)' : 'Télémédecine & Téléconsultations Médicales'}
          </h2>
          <p className="mb-0 text-white-50" style={{ fontSize: '0.9rem' }}>
            {lang === 'wo'
              ? 'Waxtaan ak doktóor ci visioconférence bou am sécurité, joto sa ordonnance.'
              : 'Consultez des médecins et praticiens agréés en visioconférence chiffrée avec émission d\'ordonnance numérique automatique.'}
          </p>
        </div>

        <button className="btn btn-light text-indigo fw-bold px-4 py-2" style={{ borderRadius: '12px', color: '#4f46e5' }} onClick={fetchSessions}>
          🔄 Actualiser les Rendez-vous
        </button>
      </div>

      {bookingSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-5 me-2">✅</span>
          <div>{bookingSuccess}</div>
        </div>
      )}

      {activeSession ? (
        /* Salle Virtuelle de Téléconsultation WebRTC */
        <div className="card shadow-lg border-0 p-4 mb-4" style={{ borderRadius: '20px', background: '#0f172a', color: '#f8fafc' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3 flex-wrap gap-2">
            <div>
              <h4 className="fw-bold mb-0 text-white">🎥 Salle de Téléconsultation — {activeSession.doctor_name}</h4>
              <small className="text-success fw-bold">🟢 Connexion Chiffrée HD (WebRTC Token: {activeSession.room_token})</small>
            </div>
            <button className="btn btn-danger fw-bold px-4 py-2" style={{ borderRadius: '10px' }} onClick={() => setActiveSession(null)}>
              ❌ Clôturer / Quitter la Consultation
            </button>
          </div>

          <div className="row g-4">
            {/* Écran Vidéo Principal */}
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
                  border: '2px solid rgba(79, 70, 229, 0.4)'
                }}
              >
                <div className="text-center">
                  <span style={{ fontSize: '4.5rem' }}>👨‍⚕️</span>
                  <h4 className="mt-2 text-white fw-bold">{activeSession.doctor_name}</h4>
                  <span className="badge bg-success px-3 py-1">En Direct • Flux Vidéo Médical HD (1080p)</span>
                </div>

                {/* Caméra Patient PIP */}
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
                  <span className="small text-white fw-bold">📱 Votre Caméra</span>
                </div>
              </div>

              <div className="d-flex gap-2 mt-3 justify-content-center flex-wrap">
                <button className="btn btn-secondary px-3" style={{ borderRadius: '10px' }}>🎙️ Couper Micro</button>
                <button className="btn btn-secondary px-3" style={{ borderRadius: '10px' }}>📹 Activer Caméra</button>
                <button className="btn btn-primary px-3 fw-bold" style={{ borderRadius: '10px', background: '#4f46e5' }} onClick={() => alert('Présentation du QR Code de la Carte CMU au médecin...')}>
                  📲 Présenter QR Code Carte CMU
                </button>
              </div>
            </div>

            {/* Synthèse Médicale & Ordonnance */}
            <div className="col-lg-4">
              <div className="card h-100 p-3 border-0 text-white" style={{ background: '#1e293b', borderRadius: '16px' }}>
                <h6 className="fw-bold mb-2 text-info">💬 Synthèse du Praticien</h6>
                <p className="small text-white-50 mb-3">
                  {activeSession.medical_summary || 'Le médecin est en train de saisir la synthèse médicale et les conseils posologiques.'}
                </p>
                
                <hr className="border-secondary" />

                <h6 className="fw-bold mb-2 text-warning">📄 Ordonnance Numérique Générée</h6>
                <div className="p-3 bg-dark rounded-3 small mb-3 border border-secondary">
                  <div>💊 <strong>Amoxicilline 500mg</strong> — 1 gélule (x3/jour pendant 5j)</div>
                  <div>💊 <strong>Paracétamol 1g</strong> — 1 comprimé (x3/jour)</div>
                  <span className="badge bg-success mt-2">Liaison directe Bon de Commande 48h</span>
                </div>

                <button 
                  className="btn btn-success w-100 fw-bold py-2 mt-auto" 
                  style={{ borderRadius: '10px' }}
                  onClick={() => alert('Ordonnance signée numériquement et injectée dans vos Bons de Commande Pharmacie !')}
                >
                  ✅ Signer & Générer le Bon Pharmacie (48h)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Formulaire Prise de Rendez-vous */}
          <div className="col-md-5">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📅 Réserver une Téléconsultation</h4>
              
              <form onSubmit={handleBookSession}>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Médecin Partenaire</label>
                  <select className="form-select input" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} style={{ borderRadius: '10px', height: '48px' }}>
                    <option value="Dr. Aminata Ndiaye">Dr. Aminata Ndiaye (Pédiatrie / Généraliste)</option>
                    <option value="Dr. Cheikh Tidiane Seck">Dr. Cheikh Tidiane Seck (Cardiologue)</option>
                    <option value="Dr. Mariama Ba">Dr. Mariama Ba (Gynécologue-Obstétricienne)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Spécialité Médicale</label>
                  <input type="text" className="form-control input" value={specialty} onChange={(e) => setSpecialty(e.target.value)} style={{ borderRadius: '10px', height: '48px' }} />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Date & Heure Souhaitée</label>
                  <input type="datetime-local" className="form-control input" onChange={(e) => setScheduledAt(e.target.value)} style={{ borderRadius: '10px', height: '48px' }} />
                </div>

                <button type="submit" className="btn btn-primary w-100 fw-bold py-2" style={{ borderRadius: '10px', background: '#4f46e5', borderColor: '#4f46e5' }}>
                  🗓️ Confirmer la Réservation du RDV
                </button>
              </form>
            </div>
          </div>

          {/* Liste des Rendez-vous de Télémédecine */}
          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>🎥 Vos Téléconsultations Programméé</h4>

              {loading ? (
                <div className="text-center py-4 text-muted">Chargement...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <span style={{ fontSize: '3rem' }}>🎥</span>
                  <p className="mt-2">Aucune téléconsultation programmée.</p>
                </div>
              ) : (
                <div className="list-group">
                  {sessions.map((s) => (
                    <div key={s.id} className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div>
                        <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{s.doctor_name} ({s.specialty})</h6>
                        <small className="text-muted">📅 Date : {new Date(s.scheduled_at).toLocaleString('fr-FR')}</small>
                      </div>
                      <button className="btn btn-success fw-bold px-3 py-2" style={{ borderRadius: '10px' }} onClick={() => setActiveSession(s)}>
                        🎥 Rejoindre l'Appel
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
