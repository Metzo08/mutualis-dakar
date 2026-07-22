import React, { useState, useEffect } from 'react';

export default function MedicalProfile({ lang = 'fr' }) {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulaire antécédents
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');
  const [pastSurgeries, setPastSurgeries] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [viewingExam, setViewingExam] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProfileData(json.data);
        if (json.data.antecedents) {
          const a = json.data.antecedents;
          setBloodGroup(a.blood_group || 'O+');
          setAllergies(a.allergies || '');
          setChronicConditions(a.chronic_conditions || '');
          setPastSurgeries(a.past_surgeries || '');
          setEmergencyName(a.emergency_contact_name || '');
          setEmergencyPhone(a.emergency_contact_phone || '');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSaveAntecedents = async (e) => {
    e.preventDefault();
    setSavedMsg('');
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}/antecedents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blood_group: bloodGroup,
          allergies,
          chronic_conditions: chronicConditions,
          past_surgeries: pastSurgeries,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone
        })
      });
      const json = await res.json();
      if (json.success) {
        setSavedMsg('Antécédents médicaux et groupe sanguin enregistrés avec succès dans votre Dossier Médical Partagé.');
        fetchProfile();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Header avec Bannière Stylisée */}
      <div 
        className="p-4 mb-4 rounded-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-3"
        style={{
          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 50%, #115e59 100%)',
          boxShadow: '0 10px 25px -5px rgba(13, 148, 136, 0.3)'
        }}
      >
        <div>
          <span className="badge bg-white text-teal fw-bold px-3 py-1 mb-2" style={{ fontSize: '0.75rem', borderRadius: '20px', color: '#0d9488' }}>
            🩺 Dossier Médical Partagé (DMP) — Radios & Scanners sur QR Code
          </span>
          <h2 className="fw-bold mb-1 text-white">
            {lang === 'wo' ? 'Tére fajj bu féex (Dossier Médical & Antécédents)' : 'Dossier Médical, Antécédents & Examens d\'Imagerie'}
          </h2>
          <p className="mb-0 text-white-50" style={{ fontSize: '0.9rem' }}>
            {lang === 'wo'
              ? 'Fi nga mën a gise sa groupe sanguin, allergies ak résultats radio/scanner ci sa QR code.'
              : 'Consultez vos antécédents, votre groupe sanguin, vos résultats d\'examens (scanner/radio) et vos codes patients hospitaliers interopérables.'}
          </p>
        </div>

        <button className="btn btn-light text-teal fw-bold px-4 py-2" style={{ borderRadius: '12px', color: '#0d9488' }} onClick={fetchProfile}>
          🔄 Actualiser le Dossier
        </button>
      </div>

      {savedMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-5 me-2">✅</span>
          <div>{savedMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5 text-muted">Chargement du dossier médical...</div>
      ) : (
        <div className="row g-4">
          {/* Antécédents médicaux & Groupe Sanguin */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🩸</span> Antécédents Médicaux & Groupe Sanguin
              </h4>

              <form onSubmit={handleSaveAntecedents}>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Groupe Sanguin & Rhésus</label>
                  <select 
                    className="form-select input fw-bold text-danger" 
                    value={bloodGroup} 
                    onChange={(e) => setBloodGroup(e.target.value)}
                    style={{ borderRadius: '10px', height: '48px' }}
                  >
                    <option value="O+">O Rhésus Positif (O+)</option>
                    <option value="O-">O Rhésus Négatif (O-)</option>
                    <option value="A+">A Rhésus Positif (A+)</option>
                    <option value="A-">A Rhésus Négatif (A-)</option>
                    <option value="B+">B Rhésus Positif (B+)</option>
                    <option value="B-">B Rhésus Négatif (B-)</option>
                    <option value="AB+">AB Rhésus Positif (AB+)</option>
                    <option value="AB-">AB Rhésus Négatif (AB-)</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Allergies Majeures (Médicamenteuses & Alimentaires)</label>
                  <input 
                    type="text" 
                    className="form-control input" 
                    placeholder="ex: Pénicilline, Aspirine..." 
                    value={allergies} 
                    onChange={(e) => setAllergies(e.target.value)}
                    style={{ borderRadius: '10px', height: '48px' }} 
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Maladies Chroniques (HTA, Diabète, Drépanocytose...)</label>
                  <input 
                    type="text" 
                    className="form-control input" 
                    placeholder="ex: Diabète Type 2, HTA" 
                    value={chronicConditions} 
                    onChange={(e) => setChronicConditions(e.target.value)}
                    style={{ borderRadius: '10px', height: '48px' }} 
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Chirurgies ou Hospitalisations Antérieures</label>
                  <input 
                    type="text" 
                    className="form-control input" 
                    placeholder="ex: Appendicectomie 2021" 
                    value={pastSurgeries} 
                    onChange={(e) => setPastSurgeries(e.target.value)}
                    style={{ borderRadius: '10px', height: '48px' }} 
                  />
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Contact Urgence (Nom)</label>
                    <input 
                      type="text" 
                      className="form-control input" 
                      placeholder="ex: Moussa Sow" 
                      value={emergencyName} 
                      onChange={(e) => setEmergencyName(e.target.value)}
                      style={{ borderRadius: '10px', height: '48px' }} 
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Téléphone Urgence (ICE)</label>
                    <input 
                      type="text" 
                      className="form-control input" 
                      placeholder="ex: +221 77 450 12 34" 
                      value={emergencyPhone} 
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      style={{ borderRadius: '10px', height: '48px' }} 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-teal w-100 fw-bold py-2 text-white" style={{ background: '#0d9488', borderRadius: '10px' }}>
                  💾 Enregistrer mes Antécédents Médicaux
                </button>
              </form>
            </div>
          </div>

          {/* Examens d'Imagerie (Scanners/Radios) & Codes Patients Hospitaliers */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🩻</span> Examens d'Imagerie (Scanners / Radios / IRM)
              </h4>

              {profileData?.imaging?.length === 0 ? (
                <div className="text-center py-4 text-muted">Aucun résultat de radio ou scanner téléversé.</div>
              ) : (
                <div className="list-group">
                  {profileData?.imaging?.map((img) => (
                    <div key={img.id} className="list-group-item p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{img.title}</h6>
                        <span className="badge bg-info">{img.exam_type}</span>
                      </div>
                      <small className="text-muted">📅 Date d'examen : {new Date(img.exam_date).toLocaleDateString('fr-FR')}</small>
                      <p className="small mb-2 mt-1"><strong>Conclusion Médecin :</strong> {img.doctor_notes}</p>
                      <button 
                        className="btn btn-sm btn-outline-teal fw-bold" 
                        style={{ color: '#0d9488', borderColor: '#0d9488' }}
                        onClick={() => setViewingExam(img)}
                      >
                        👁️ Consulter le Rapport PDF / Clichés HD
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Codes Patients Interopérables (SIGOB / DHIS2 / Hôpitaux) */}
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🔗</span> Code Patient Hospitalier Interopérable
              </h4>
              <p className="small text-muted mb-3">
                Identifiants hospitaliers reconnus automatiquement lors du scan de votre QR Code à l'accueil de l'hôpital.
              </p>

              {profileData?.externalCodes?.length === 0 ? (
                <div className="badge bg-secondary p-2">Aucun code externe associé pour le moment.</div>
              ) : (
                <ul className="list-group">
                  {profileData?.externalCodes?.map((code) => (
                    <li key={code.id} className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>{code.system_name}</strong>
                        <br />
                        <code className="text-teal fw-bold" style={{ color: '#0d9488' }}>{code.external_patient_code}</code>
                      </div>
                      <span className="badge bg-success">Actif & Synchronisé</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Visionneuse d'Examen Imagerie (Scanner/Radio) */}
      {viewingExam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold" style={{ color: 'var(--text-main)' }}>
                  🩻 Visionneuse d'Imagerie Médicale — {viewingExam.title}
                </h5>
                <button className="btn-close" onClick={() => setViewingExam(null)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="p-4 rounded-3 mb-3" style={{ background: '#0f172a', color: '#fff' }}>
                  <span style={{ fontSize: '4rem' }}>🦴</span>
                  <h5 className="fw-bold mt-2">Cliché Scanner HD — Hôpital Fann (Dakar)</h5>
                  <p className="small text-white-50">Transmis par le centre de radiologie • Norme DICOM / PDF Chiffré</p>
                  <div className="badge bg-success p-2">Rapport validé par le Radiologue</div>
                </div>
                <div className="text-start p-3 rounded-3" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <h6><strong>Compte-Rendu :</strong></h6>
                  <p className="mb-0">{viewingExam.doctor_notes}</p>
                </div>
              </div>
              <div className="modal-footer border-top p-3" style={{ borderColor: 'var(--border-color)' }}>
                <button className="btn btn-secondary fw-bold" onClick={() => setViewingExam(null)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
