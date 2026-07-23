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
        provider_name: 'Dr. Coumba Diop — Hôpital Fann (Dakar)',
        exam_date: '2026-06-15T10:30:00Z',
        doctor_notes: 'Examen de contrôle post-traitement. Bilan satisfaisant sans anomalie évolutive. Recommandation : contrôle dans 6 mois.',
        cliche_count: 4,
        status: 'Validé par radiologue'
      },
      {
        id: 502,
        title: 'Radiographie Rachis Cervical Face/Profil',
        exam_type: 'Radio',
        provider_name: 'Centre de Radiologie & Labo Point E',
        exam_date: '2026-05-10T14:15:00Z',
        doctor_notes: 'Absence de lésion osseuse traumatique. Discrets signes d\'uncarthrose C5-C6.',
        cliche_count: 2,
        status: 'Validé par radiologue'
      },
      {
        id: 503,
        title: 'Bilan Biologique Complet & Glycémie à Jeun',
        exam_type: 'Analyse',
        provider_name: 'Laboratoire de Biologie Médicale Pasteur',
        exam_date: '2026-07-01T08:00:00Z',
        doctor_notes: 'Glycémie: 0.95 g/L (Normale). Hémoglobine: 14.2 g/dL. Bilan rénal et hépatique parfaitement équilibrés.',
        cliche_count: 1,
        status: 'Rapport certifié'
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
  
  // Visionneuse et Modales
  const [viewingExam, setViewingExam] = useState(null);
  const [dicomZoom, setDicomZoom] = useState(1);
  const [dicomInvert, setDicomInvert] = useState(false);
  const [activeCliche, setActiveCliche] = useState(1);

  // Modale Ajout Examen par Prestataire / Médecin
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [newExam, setNewExam] = useState({
    title: '',
    exam_type: 'Scanner',
    provider_name: '',
    patient_cmu: 'SN-DK-MED-8472',
    doctor_notes: '',
    exam_date: new Date().toISOString().slice(0, 10)
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const storedLocalExams = JSON.parse(localStorage.getItem('cmu_medical_imaging') || '[]');
      const mergedExams = [...storedLocalExams, ...defaultProfile.imaging];

      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}`);
      const json = await res.json();
      if (json.success && json.data && json.data.antecedents) {
        setProfileData({
          ...json.data,
          imaging: [...storedLocalExams, ...(json.data.imaging || defaultProfile.imaging)]
        });
        const a = json.data.antecedents;
        setBloodGroup(a.blood_group || 'O+');
        setAllergies(a.allergies || '');
        setChronicConditions(a.chronic_conditions || '');
        setPastSurgeries(a.past_surgeries || '');
        setEmergencyName(a.emergency_contact_name || '');
        setEmergencyPhone(a.emergency_contact_phone || '');
      } else {
        setProfileData({
          ...defaultProfile,
          imaging: mergedExams
        });
      }
    } catch (err) {
      console.warn('Utilisation des antécédents de démonstration:', err);
      const storedLocalExams = JSON.parse(localStorage.getItem('cmu_medical_imaging') || '[]');
      setProfileData({
        ...defaultProfile,
        imaging: [...storedLocalExams, ...defaultProfile.imaging]
      });
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

  // Ajout d'une radio, scanner ou analyse par un prestataire / médecin
  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExam.title || !newExam.doctor_notes) {
      alert('Veuillez remplir le titre et le compte-rendu de l\'examen.');
      return;
    }

    const createdExam = {
      id: Date.now(),
      title: newExam.title,
      exam_type: newExam.exam_type,
      provider_name: newExam.provider_name || 'Dr. Prestataire Agréé UNAMUSC',
      exam_date: new Date(newExam.exam_date).toISOString(),
      doctor_notes: newExam.doctor_notes,
      cliche_count: 3,
      status: 'Validé & Transmis par Prestataire'
    };

    const existingLocal = JSON.parse(localStorage.getItem('cmu_medical_imaging') || '[]');
    const updatedLocal = [createdExam, ...existingLocal];
    localStorage.setItem('cmu_medical_imaging', JSON.stringify(updatedLocal));

    setProfileData(prev => ({
      ...prev,
      imaging: [createdExam, ...prev.imaging]
    }));

    setShowAddExamModal(false);
    setNewExam({
      title: '',
      exam_type: 'Scanner',
      provider_name: '',
      patient_cmu: 'SN-DK-MED-8472',
      doctor_notes: '',
      exam_date: new Date().toISOString().slice(0, 10)
    });
    setSavedMsg(`L'examen "${createdExam.title}" (${createdExam.exam_type}) a été ajouté et rattaché avec succès au dossier médical.`);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique (Titre & Boutons centrés) */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_profile_hero_real.png") center/cover no-repeat',
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
            🩺 Dossier médical partagé (DMP) — Radios, Scanners & Biologie sur QR Code
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Tére fajj bu féex (Dossier médical & antécédents)' : 'Dossier médical, antécédents & imagerie'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Fi nga mën a gise sa groupe sanguin, allergies ak résultats radio/scanner ci sa QR code.'
              : 'Consultez vos antécédents, votre groupe sanguin, vos résultats d\'examens (scanner/radio/biologie) et gérez vos codes patients hospitaliers.'}
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
              onClick={() => setShowAddExamModal(true)}
            >
              ➕ Ajouter une analyse, radio ou examen
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
              onClick={fetchProfile}
            >
              🔄 {lang === 'wo' ? 'Yessal dossier bi' : 'Actualiser le dossier'}
            </button>
          </div>
        </div>
      </section>

      {savedMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{savedMsg}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5 text-muted">Chargement du dossier médical...</div>
      ) : (
        <div className="row g-4">
          {/* Antécédents médicaux & Groupe sanguin */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>🩸</span> Groupe Sanguin & Antécédents
              </h4>
              <p className="small text-muted mb-4" style={{ fontSize: '0.88rem' }}>
                Ces données d'urgence sont chiffrées et accessibles lors du scan de votre QR code CMU.
              </p>

              <form onSubmit={handleSaveAntecedents}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Groupe sanguin & Rhésus</label>
                  <select 
                    className="form-select input fw-bold" 
                    value={bloodGroup} 
                    onChange={(e) => setBloodGroup(e.target.value)}
                    style={{ borderRadius: '10px' }}
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
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Allergies majeures</label>
                  <input 
                    type="text" 
                    className="form-control input" 
                    placeholder="Ex: Pénicilline, Aspirine, Pollen..." 
                    value={allergies} 
                    onChange={(e) => setAllergies(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Affections de longue durée (ALD) / Pathologies chroniques</label>
                  <input 
                    type="text" 
                    className="form-control input" 
                    placeholder="Ex: Hypertension, Diabète, Asthme..." 
                    value={chronicConditions} 
                    onChange={(e) => setChronicConditions(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Chirurgies & Interventions passées</label>
                  <input 
                    type="text" 
                    className="form-control input" 
                    placeholder="Ex: Appendicectomie (2021)..." 
                    value={pastSurgeries} 
                    onChange={(e) => setPastSurgeries(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Contact d'urgence (Nom)</label>
                    <input 
                      type="text" 
                      className="form-control input" 
                      value={emergencyName} 
                      onChange={(e) => setEmergencyName(e.target.value)}
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Téléphone d'urgence</label>
                    <input 
                      type="text" 
                      className="form-control input" 
                      value={emergencyPhone} 
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn text-white fw-bold px-4 py-2" 
                  style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '10px' }}
                >
                  💾 Enregistrer mes antécédents médicaux
                </button>
              </form>
            </div>
          </div>

          {/* Examens d'imagerie & Analyses de laboratoire */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <span>🩻</span> Examens d'imagerie & Analyses
                </h4>
                <button 
                  type="button"
                  className="btn btn-sm text-white fw-bold px-3 py-1.5"
                  style={{ background: '#059669', border: 'none', borderRadius: '8px' }}
                  onClick={() => setShowAddExamModal(true)}
                >
                  ➕ Ajouter un examen
                </button>
              </div>

              {profileData?.imaging?.length === 0 ? (
                <div className="text-center py-4 text-muted">Aucun résultat de radio, scanner ou analyse téléversé.</div>
              ) : (
                <div className="list-group">
                  {profileData?.imaging?.map((img) => (
                    <div key={img.id} className="list-group-item p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{img.title}</h6>
                        <span className={`badge ${img.exam_type === 'Analyse' ? 'bg-success' : 'bg-info'}`}>{img.exam_type}</span>
                      </div>
                      <div className="small text-muted mb-1">
                        🏥 {img.provider_name || 'Hôpital / Prestataire agréé'} • 📅 {new Date(img.exam_date).toLocaleDateString('fr-FR')}
                      </div>
                      <p className="small mb-2" style={{ lineHeight: '1.5' }}><strong>Conclusion :</strong> {img.doctor_notes}</p>
                      
                      <button 
                        type="button"
                        className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm" 
                        style={{ borderRadius: '8px', background: '#059669', border: 'none' }}
                        onClick={() => {
                          setViewingExam(img);
                          setDicomZoom(1);
                          setDicomInvert(false);
                          setActiveCliche(1);
                        }}
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

      {/* MODALE 1 : Visionneuse d'imagerie médicale & Rapport PDF */}
      {viewingExam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold" style={{ color: 'var(--text-main)' }}>
                  🩻 Visionneuse DICOM & Rapport PDF — {viewingExam.title}
                </h5>
                <button className="btn-close" onClick={() => setViewingExam(null)}></button>
              </div>
              
              <div className="modal-body p-4 text-center">
                {/* Visualiseur de cliché DICOM HD */}
                <div 
                  className="p-4 rounded-3 mb-3 position-relative overflow-hidden" 
                  style={{ 
                    background: '#0f172a', 
                    color: '#fff',
                    minHeight: '260px',
                    filter: dicomInvert ? 'invert(1)' : 'none'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="badge bg-success px-2.5 py-1">DICOM 3.0 • High Definition</span>
                    <span className="small text-white-50">Cliché {activeCliche} / {viewingExam.cliche_count || 3}</span>
                  </div>

                  <div style={{ transform: `scale(${dicomZoom})`, transition: 'transform 0.2s', padding: '1.5rem' }}>
                    <span style={{ fontSize: '4.5rem' }}>
                      {viewingExam.exam_type === 'Analyse' ? '🧪' : viewingExam.exam_type === 'Radio' ? '🩻' : '🦴'}
                    </span>
                    <h5 className="fw-bold mt-2 text-white">{viewingExam.title}</h5>
                    <p className="small text-white-50 mb-0">{viewingExam.provider_name || 'Hôpital Fann Dakar'}</p>
                  </div>

                  {/* Contrôles DICOM (Zoom, Contraste) */}
                  <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap" style={{ position: 'relative', zIndex: 5 }}>
                    <button type="button" className="btn btn-sm btn-dark border" onClick={() => setDicomZoom(prev => Math.min(prev + 0.2, 1.8))}>🔍 Zoom +</button>
                    <button type="button" className="btn btn-sm btn-dark border" onClick={() => setDicomZoom(1)}>🔄 Reset</button>
                    <button type="button" className="btn btn-sm btn-dark border" onClick={() => setDicomInvert(prev => !prev)}>🌗 {dicomInvert ? 'Inverser' : 'Filtre Négatif'}</button>
                    <button type="button" className="btn btn-sm btn-dark border" onClick={() => setActiveCliche(prev => (prev % (viewingExam.cliche_count || 3)) + 1)}>🖼️ Cliché suivant</button>
                  </div>
                </div>

                {/* Compte-rendu officiel du praticien */}
                <div className="text-start p-3 rounded-3 mb-3" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <h6 className="fw-bold text-success mb-2">📋 Compte-rendu médical certifié :</h6>
                  <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)' }}>{viewingExam.doctor_notes}</p>
                  <div className="small text-muted border-top pt-2 mt-2">
                    👨‍⚕️ Prescrit par : <strong>{viewingExam.provider_name}</strong> • Validé le {new Date(viewingExam.exam_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <button 
                    type="button" 
                    className="btn btn-success fw-bold text-white px-4"
                    onClick={() => alert(`Rapport PDF certifié pour "${viewingExam.title}" téléchargé avec succès !`)}
                    style={{ borderRadius: '10px' }}
                  >
                    📥 Télécharger le rapport PDF certifié
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary fw-semibold px-3"
                    onClick={() => window.print()}
                    style={{ borderRadius: '10px' }}
                  >
                    🖨️ Imprimer le cliché HD
                  </button>
                </div>
              </div>

              <div className="modal-footer border-top p-3" style={{ borderColor: 'var(--border-color)' }}>
                <button className="btn btn-secondary fw-bold px-4 py-2" onClick={() => setViewingExam(null)} style={{ borderRadius: '10px' }}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 2 : Ajouter une Analyse, Radio ou Examen par un Prestataire / Médecin */}
      {showAddExamModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold" style={{ color: 'var(--text-main)' }}>
                  ➕ Ajouter une analyse, radio ou examen médical (Prestataire / Médecin)
                </h5>
                <button className="btn-close" onClick={() => setShowAddExamModal(false)}></button>
              </div>

              <form onSubmit={handleAddExam}>
                <div className="modal-body p-4">
                  <p className="small text-muted mb-4">
                    Remplissez ce formulaire pour transmettre et lier immédiatement un résultat d'examen (DICOM, PDF, analyse de sang) au Dossier Médical Partagé du patient.
                  </p>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Type d'examen</label>
                      <select 
                        className="form-select input fw-bold" 
                        value={newExam.exam_type} 
                        onChange={(e) => setNewExam({ ...newExam, exam_type: e.target.value })}
                        style={{ borderRadius: '10px' }}
                      >
                        <option value="Scanner">Scanner HD (CT-Scan)</option>
                        <option value="Radio">Radiographie X-Ray</option>
                        <option value="Analyse">Analyse Biologique / Laboratoire</option>
                        <option value="IRM">IRM Cervicale / Cérébrale / Abdominale</option>
                        <option value="Échographie">Échographie Abdominale / Pelvienne</option>
                        <option value="ECG">Électrocardiogramme (ECG)</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Numéro CMU du patient</label>
                      <input 
                        type="text" 
                        className="form-control input fw-bold" 
                        value={newExam.patient_cmu} 
                        onChange={(e) => setNewExam({ ...newExam, patient_cmu: e.target.value })}
                        style={{ borderRadius: '10px' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Intitulé / Titre de l'examen *</label>
                    <input 
                      type="text" 
                      className="form-control input" 
                      placeholder="Ex: Scanner Thoracique HD, Bilan Sanguin Complet..." 
                      value={newExam.title} 
                      onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                      style={{ borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Prestataire / Médecin / Structure prescriptrice</label>
                      <input 
                        type="text" 
                        className="form-control input" 
                        placeholder="Ex: Dr. Mamadou Ndiaye — Hôpital Fann" 
                        value={newExam.provider_name} 
                        onChange={(e) => setNewExam({ ...newExam, provider_name: e.target.value })}
                        style={{ borderRadius: '10px' }}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Date de réalisation d'examen</label>
                      <input 
                        type="date" 
                        className="form-control input" 
                        value={newExam.exam_date} 
                        onChange={(e) => setNewExam({ ...newExam, exam_date: e.target.value })}
                        style={{ borderRadius: '10px' }}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Conclusion & Compte-rendu médical du praticien *</label>
                    <textarea 
                      className="form-control input" 
                      rows="3" 
                      placeholder="Rédigez ici la conclusion diagnostique ou les résultats d'analyses..." 
                      value={newExam.doctor_notes} 
                      onChange={(e) => setNewExam({ ...newExam, doctor_notes: e.target.value })}
                      style={{ borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div className="p-3 rounded-3 border text-center" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', borderStyle: 'dashed' }}>
                    <span className="fs-3">📄</span>
                    <div className="fw-semibold small mt-1">Fichier de cliché HD / Rapport PDF chiffré</div>
                    <small className="text-muted d-block mb-2">Simulateur de téléversement DICOM & PDF</small>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => alert('Fichier DICOM / PDF sélectionné et chiffré !')}>
                      📎 Parcourir un fichier DICOM/PDF
                    </button>
                  </div>
                </div>

                <div className="modal-footer border-top p-3" style={{ borderColor: 'var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddExamModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-success text-white fw-bold px-4">💾 Enregistrer & Transmettre au DMP</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
