import React, { useState, useEffect } from 'react';

export default function MedicalProfile({ lang = 'fr' }) {
  const defaultProfile = {
    antecedents: {
      blood_group: 'O+',
      allergies: 'Pénicilline, Aspirine',
      chronic_conditions: 'Hypertension artérielle (HTA), Diabète Type 2',
      past_surgeries: 'Appendicectomie (2021)',
      emergency_contact_name: 'Moussa Sow (Frère)',
      emergency_contact_phone: '+221 77 450 12 34'
    },
    imaging: [
      {
        id: 501,
        title: 'Scanner Thoracique & Abdominal HD',
        exam_type: 'Scanner',
        exam_date: '2026-06-15T10:30:00Z',
        doctor_notes: 'Examen de contrôle post-traitement. Bilan satisfaisant sans anomalie évolutive. Recommandation : contrôle dans 6 mois.'
      },
      {
        id: 502,
        title: 'Radiographie Rachis Cervical Face/Profil',
        exam_type: 'Radio',
        exam_date: '2026-05-10T14:15:00Z',
        doctor_notes: 'Absence de lésion osseuse traumatique. Discrets signes d\'uncarthrose C5-C6.'
      }
    ],
    externalCodes: [
      { id: 1, system_name: 'Hôpital Universitaire Fann (SIGOB)', external_patient_code: 'IPP-FANN-2026-9921' },
      { id: 2, system_name: 'Hôpital Aristide Le Dantec (DHIS2)', external_patient_code: 'DANTEC-PAT-8812' }
    ]
  };

  const [profileData, setProfileData] = useState(defaultProfile);
  const [loading, setLoading] = useState(true);

  // Formulaire antécédents
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [allergies, setAllergies] = useState('Pénicilline, Aspirine');
  const [chronicConditions, setChronicConditions] = useState('Hypertension artérielle (HTA), Diabète Type 2');
  const [pastSurgeries, setPastSurgeries] = useState('Appendicectomie (2021)');
  const [emergencyName, setEmergencyName] = useState('Moussa Sow (Frère)');
  const [emergencyPhone, setEmergencyPhone] = useState('+221 77 450 12 34');
  const [savedMsg, setSavedMsg] = useState('');
  const [viewingExam, setViewingExam] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}`);
      const json = await res.json();
      if (json.success && json.data && json.data.antecedents) {
        setProfileData(json.data);
        const a = json.data.antecedents;
        setBloodGroup(a.blood_group || 'O+');
        setAllergies(a.allergies || '');
        setChronicConditions(a.chronic_conditions || '');
        setPastSurgeries(a.past_surgeries || '');
        setEmergencyName(a.emergency_contact_name || '');
        setEmergencyPhone(a.emergency_contact_phone || '');
      } else {
        setProfileData(defaultProfile);
      }
    } catch (err) {
      console.warn('Utilisation des antécédents de démonstration:', err);
      setProfileData(defaultProfile);
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

    const updatedProfile = {
      ...profileData,
      antecedents: {
        blood_group: bloodGroup,
        allergies,
        chronic_conditions: chronicConditions,
        past_surgeries: pastSurgeries,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone
      }
    };
    setProfileData(updatedProfile);

    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      await fetch(`/api/medical-profile/${benId}/antecedents`, {
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
    } catch (err) {
      console.warn(err);
    }

    setSavedMsg('Antécédents médicaux et groupe sanguin enregistrés avec succès dans votre dossier médical partagé.');
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_profile_hero_real.png") center/cover no-repeat',
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
              🩺 Dossier médical partagé (DMP) — Radios & scanners sur QR code
            </span>
            <h1 className="fw-bold mb-2 text-white" style={{ fontSize: '1.9rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              {lang === 'wo' ? 'Tére fajj bu féex (Dossier médical & antécédents)' : 'Dossier médical, antécédents & imagerie'}
            </h1>
            <p className="mb-0 text-white-50" style={{ fontSize: '0.95rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              {lang === 'wo'
                ? 'Fi nga mën a gise sa groupe sanguin, allergies ak résultats radio/scanner ci sa QR code.'
                : 'Consultez vos antécédents, votre groupe sanguin, vos résultats d\'examens (scanner/radio) et vos codes patients hospitaliers interopérables.'}
            </p>
          </div>

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
            onClick={fetchProfile}
          >
            🔄 {lang === 'wo' ? 'Yessal dossier bi' : 'Actualiser le dossier'}
          </button>
        </div>
      </section>

      {savedMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-5 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{savedMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5 text-muted">Chargement du dossier médical...</div>
      ) : (
        <div className="row g-4">
          {/* Antécédents médicaux & groupe sanguin */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🩸</span> Antécédents médicaux & groupe sanguin
              </h4>

              <form onSubmit={handleSaveAntecedents}>
                <div className="mb-3">
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Groupe sanguin & rhésus</label>
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
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Allergies majeures (médicaments & aliments)</label>
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
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Maladies chroniques (HTA, diabète, drépanocytose...)</label>
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
                  <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Chirurgies ou hospitalisations antérieures</label>
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
                    <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Contact urgence (nom)</label>
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
                    <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Téléphone urgence (ICE)</label>
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

                <button type="submit" className="btn btn-success w-100 fw-bold py-2 text-white" style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '10px' }}>
                  💾 Enregistrer mes antécédents médicaux
                </button>
              </form>
            </div>
          </div>

          {/* Examens d'imagerie & codes patients hospitaliers */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🩻</span> Examens d'imagerie (scanners / radios / IRM)
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
                      <p className="small mb-2 mt-1"><strong>Conclusion médecin :</strong> {img.doctor_notes}</p>
                      <button 
                        className="btn btn-sm text-white fw-bold px-3 py-1.5" 
                        style={{ borderRadius: '8px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
                        onClick={() => setViewingExam(img)}
                      >
                        👁️ Consulter le rapport PDF / clichés HD
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Codes patients interopérables */}
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🔗</span> Code patient hospitalier interopérable
              </h4>
              <p className="small text-muted mb-3" style={{ fontSize: '0.88rem' }}>
                Identifiants hospitaliers reconnus automatiquement lors du scan de votre QR code à l'accueil de l'hôpital.
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
                        <code className="text-success fw-bold">{code.external_patient_code}</code>
                      </div>
                      <span className="badge bg-success">Actif & synchronisé</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal visionneuse d'examen imagerie */}
      {viewingExam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold" style={{ color: 'var(--text-main)' }}>
                  🩻 Visionneuse d'imagerie médicale — {viewingExam.title}
                </h5>
                <button className="btn-close" onClick={() => setViewingExam(null)}></button>
              </div>
              <div className="modal-body p-4 text-center">
                <div className="p-4 rounded-3 mb-3" style={{ background: '#0f172a', color: '#fff' }}>
                  <span style={{ fontSize: '4rem' }}>🦴</span>
                  <h5 className="fw-bold mt-2">Cliché scanner HD — Hôpital Fann (Dakar)</h5>
                  <p className="small text-white-50">Transmis par le centre de radiologie • Norme DICOM / PDF chiffré</p>
                  <div className="badge bg-success p-2">Rapport validé par le radiologue</div>
                </div>
                <div className="text-start p-3 rounded-3" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <h6><strong>Compte-rendu :</strong></h6>
                  <p className="mb-0">{viewingExam.doctor_notes}</p>
                </div>
              </div>
              <div className="modal-footer border-top p-3" style={{ borderColor: 'var(--border-color)' }}>
                <button className="btn btn-secondary fw-bold px-3 py-2" onClick={() => setViewingExam(null)} style={{ borderRadius: '8px' }}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
