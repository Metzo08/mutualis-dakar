import React, { useState, useEffect } from 'react';

export default function Telemedicine({ lang = 'fr' }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);

  // Prise de rendez-vous
  const [doctorName, setDoctorName] = useState('Dr. Aminata Ndiaye');
  const [specialty, setSpecialty] = useState('Pédiatrie');
  const [scheduledAt, setScheduledAt] = useState('');

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
        fetchSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
          🩺 {lang === 'wo' ? 'Fajj ci kaw internet (Télémédecine WebRTC)' : 'Télémédecine & Téléconsultations Médicales'}
        </h2>
        <p className="text-muted mb-0">
          {lang === 'wo'
            ? 'Waxtaan ak doktóor ci visioconférence bou am sécurité, joto sa ordonnance.'
            : 'Consultez des médecins et praticiens agréés en visioconférence sécurisée avec ordonnance numérique intégrée.'}
        </p>
      </div>

      {activeSession ? (
        <div className="card shadow-lg border-0 p-4" style={{ borderRadius: '16px', background: '#1e293b', color: '#fff' }}>
          <div className="d-flex justify-content-between align-items-center mb-3 border-bottom border-secondary pb-3">
            <div>
              <h4 className="fw-bold mb-0">🎥 Teleconsultation en cours — {activeSession.doctor_name}</h4>
              <small className="text-success">🟢 Salle Virtuelle Chiffrée (WebRTC Token: {activeSession.room_token})</small>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => setActiveSession(null)}>
              ❌ Quitter l'Appel
            </button>
          </div>

          <div className="row g-3">
            {/* Simulation flux vidéo médecin & patient */}
            <div className="col-md-8">
              <div 
                style={{ 
                  height: '350px', 
                  background: '#0f172a', 
                  borderRadius: '12px', 
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="text-center">
                  <span style={{ fontSize: '4rem' }}>👨‍⚕️</span>
                  <h5 className="mt-2">{activeSession.doctor_name}</h5>
                  <span className="badge bg-success">Flux Vidéo HD En Direct (1080p)</span>
                </div>

                {/* Petit retour caméra patient */}
                <div 
                  style={{ 
                    position: 'absolute', 
                    bottom: '15px', 
                    right: '15px', 
                    width: '120px', 
                    height: '90px', 
                    background: '#334155', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--primary)'
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>📱 Vous</span>
                </div>
              </div>

              <div className="d-flex gap-2 mt-3 justify-content-center">
                <button className="btn btn-secondary">🎙️ Mute Micro</button>
                <button className="btn btn-secondary">📹 Caméra On</button>
                <button className="btn btn-info text-white">📋 Présenter QR Code Carte CMU</button>
              </div>
            </div>

            {/* Chat & Ordonnance */}
            <div className="col-md-4">
              <div className="card h-100 p-3 bg-dark border-secondary text-white">
                <h6>💬 Notes & Synthèse du Praticien</h6>
                <p className="small text-muted mb-2">{activeSession.medical_summary || 'Le médecin rédige la synthèse médicale...'}</p>
                <hr className="border-secondary" />
                <h6>📄 Ordonnance Numérique Générée</h6>
                <div className="p-2 bg-secondary rounded small mb-3">
                  - Paracétamol 1g (x3/jour)<br />
                  - Sirop Toux Sèche (x2/jour)<br />
                  <span className="badge bg-warning text-dark mt-1">Lien direct vers Bon de Commande 48h</span>
                </div>
                <button className="btn btn-success w-100 btn-sm" onClick={() => alert('Ordonnance signée numériquement et injectée dans vos Bons de Commande !')}>
                  ✅ Valider & Télécharger Ordonnance
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-md-5">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">📅 Réserver une Téléconsultation</h4>
              <form onSubmit={handleBookSession}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Médecin Partenaire</label>
                  <select className="form-select" value={doctorName} onChange={(e) => setDoctorName(e.target.value)}>
                    <option value="Dr. Aminata Ndiaye">Dr. Aminata Ndiaye (Pédiatre / Généraliste)</option>
                    <option value="Dr. Cheikh Tidiane Seck">Dr. Cheikh Tidiane Seck (Cardiologue)</option>
                    <option value="Dr. Mariama Ba">Dr. Mariama Ba (Gynécologue-Obstétricienne)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Spécialité</label>
                  <input type="text" className="form-control" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold">Date & Heure Souhaitée</label>
                  <input type="datetime-local" className="form-control" onChange={(e) => setScheduledAt(e.target.value)} />
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  🗓️ Confirmer la Réservation
                </button>
              </form>
            </div>
          </div>

          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">🎥 Vos Rendez-vous de Télémédecine</h4>
              {loading ? (
                <div>Chargement...</div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-4 text-muted">Aucune téléconsultation programmée.</div>
              ) : (
                <div className="list-group">
                  {sessions.map((s) => (
                    <div key={s.id} className="list-group-item d-flex justify-content-between align-items-center p-3">
                      <div>
                        <h6 className="fw-bold mb-1">{s.doctor_name} ({s.specialty})</h6>
                        <small className="text-muted">📅 {new Date(s.scheduled_at).toLocaleString('fr-FR')}</small>
                      </div>
                      <button className="btn btn-success btn-sm px-3" onClick={() => setActiveSession(s)}>
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
