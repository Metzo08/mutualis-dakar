import React, { useState } from 'react';

// Design Premium Haut de Gamme (Dark Emerald DICOM Medical Profile Platform)
export default function MedicalProfile({ lang = 'fr', userRole = 'citizen', citizenUser = null }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'history', 'lab'
  
  // Imagerie & Examens DICOM
  const [exams, setExams] = useState([
    {
      id: 501,
      title: 'Scanner Thoracique',
      exam_type: 'Scanner',
      badge: 'HD DICOM',
      facility: 'Clinique Pasteur',
      doctor: 'Dr. Coumba Diop — Hôpital Fann',
      date: '12 Mars 2024',
      conclusion: 'Examen de contrôle post-traitement. Bilan satisfaisant sans anomalie évolutive. Recommandation : contrôle dans 6 mois.',
      cliches: 4,
      preview: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'
    },
    {
      id: 502,
      title: 'IRM Cérébrale',
      exam_type: 'IRM',
      badge: '3D RENDERING',
      facility: 'Centre Médical SOS',
      doctor: 'Dr. Cheikh Tidiane Ndiaye',
      date: '02 Fév 2024',
      conclusion: 'Structure cérébrale d\'aspect normal. Pas de lésion récente identifiée.',
      cliches: 2,
      preview: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400'
    },
    {
      id: 503,
      title: 'Échocardiographie',
      exam_type: 'Écho',
      badge: 'HD ULTRASOUND',
      facility: 'Cabinet Dr. Sy',
      doctor: 'Dr. Sy',
      date: '15 Jan 2024',
      conclusion: 'Fonction ventriculaire gauche conservée. Fraction d\'éjection à 65%.',
      cliches: 3,
      preview: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=400'
    }
  ]);

  // Modale Visionneuse DICOM
  const [viewingExam, setViewingExam] = useState(null);
  const [dicomZoom, setDicomZoom] = useState(1);
  const [dicomInvert, setDicomInvert] = useState(false);
  const [activeCliche, setActiveCliche] = useState(1);

  // Modale Ajout d'Examen
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamType, setNewExamType] = useState('Scanner');

  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExamTitle) return;
    const added = {
      id: Date.now(),
      title: newExamTitle,
      exam_type: newExamType,
      badge: 'HD DICOM',
      facility: 'Laboratoire Pasteur Dakar',
      doctor: 'Dr. Aminata Ndiaye',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'Short', year: 'numeric' }),
      conclusion: 'Examen enregistré et certifié.',
      cliches: 1,
      preview: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'
    };
    setExams([...exams, added]);
    setShowAddExamModal(false);
    setNewExamTitle('');
  };

  return (
    <div className="medical-profile-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', padding: '0.75rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>Dossier Médical Partagé</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            
            <div className="d-flex gap-2">
              <button className={`btn btn-sm fw-bold ${activeTab === 'overview' ? 'text-success border-bottom border-success' : 'text-white-50'}`} style={{ borderRadius: 0, fontSize: '0.85rem' }} onClick={() => setActiveTab('overview')}>Vue d'ensemble</button>
              <button className={`btn btn-sm fw-bold ${activeTab === 'history' ? 'text-success border-bottom border-success' : 'text-white-50'}`} style={{ borderRadius: 0, fontSize: '0.85rem' }} onClick={() => setActiveTab('history')}>Historique</button>
              <button className={`btn btn-sm fw-bold ${activeTab === 'lab' ? 'text-success border-bottom border-success' : 'text-white-50'}`} style={{ borderRadius: 0, fontSize: '0.85rem' }} onClick={() => setActiveTab('lab')}>Laboratoire</button>
            </div>
          </div>

          <div className="input-group input-group-sm" style={{ width: '250px' }}>
            <input type="text" className="form-control bg-dark text-white border-secondary small" placeholder="Rechercher un examen..." style={{ borderRadius: '10px 0 0 10px', fontSize: '0.8rem' }} />
            <button className="btn btn-outline-secondary" type="button" style={{ borderRadius: '0 10px 10px 0' }}>🔍</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-4 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)' }}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <span className="badge bg-success text-white px-3 py-1.5 rounded-pill mb-2 fw-semibold" style={{ fontSize: '0.75rem' }}>✔ Certifié CNOM - Sénégal</span>
              <h2 className="fw-extrabold text-white mb-2" style={{ fontSize: '1.9rem', letterSpacing: '-0.02em' }}>Dossier médical & radiographies certifiées</h2>
              <p className="text-white-50 mb-0" style={{ fontSize: '0.95rem', maxWidth: '680px', lineHeight: '1.5' }}>
                Accédez en toute sécurité à vos antécédents, vos résultats de radiologie et téléchargez votre carnet de santé numérique certifié.
              </p>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-success px-3.5 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center gap-2" style={{ background: '#10b981', borderRadius: '12px', border: 'none', fontSize: '0.85rem' }} onClick={() => alert("Impression du carnet de santé PDF A4...")}>
                <span>🖨 Imprimer le carnet PDF</span>
              </button>
              <button className="btn btn-dark px-3.5 py-2.5 fw-bold text-white shadow-sm" style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem' }} onClick={() => alert("Lien de partage sécurisé généré.")}>
                Partager avec mon médecin
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid (Left Sidebar Cards + Right DICOM Grid) */}
        <div className="row g-4 mb-4">
          
          {/* Left Column Cards */}
          <div className="col-lg-4">
            <div className="d-flex flex-column gap-4">
              
              {/* Groupe Sanguin Card */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-2 text-danger">
                    <span style={{ fontSize: '1.2rem' }}>🩸</span>
                    <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Groupe Sanguin</h6>
                  </div>
                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle" style={{ fontSize: '0.72rem' }}>Urgent</span>
                </div>

                <div className="d-flex align-items-baseline gap-2 my-2">
                  <h1 className="fw-black text-success mb-0" style={{ fontSize: '3.2rem', letterSpacing: '-0.03em' }}>A+</h1>
                  <span className="fw-bold text-white-50" style={{ fontSize: '1.1rem' }}>Rhésus Positif</span>
                </div>

                <small className="text-muted d-block pt-2 border-top border-secondary border-opacity-25" style={{ fontSize: '0.75rem' }}>
                  Certifié par : <strong className="text-white-50">Laboratoire Bio24, Dakar</strong>
                </small>
              </div>

              {/* Allergies & Alertes Card */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div className="d-flex align-items-center gap-2 mb-3 text-warning">
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Allergies & Alertes</h6>
                </div>

                <div className="d-flex flex-column gap-2">
                  <div className="p-3 rounded-3 d-flex align-items-center gap-2.5" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <span className="text-warning font-monospace" style={{ fontSize: '1.2rem' }}>●</span>
                    <span className="fw-bold text-white small">Pénicilline (Sévère)</span>
                  </div>

                  <div className="p-3 rounded-3 d-flex align-items-center gap-2.5" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <span className="text-muted font-monospace" style={{ fontSize: '1.2rem' }}>●</span>
                    <span className="fw-bold text-white-50 small">Pollen de Graminées</span>
                  </div>
                </div>
              </div>

              {/* Interopérabilité Card */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div className="d-flex align-items-center gap-2 mb-3 text-success">
                  <span style={{ fontSize: '1.2rem' }}>🌐</span>
                  <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Interopérabilité</h6>
                </div>

                <div className="d-flex flex-column gap-2.5">
                  <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="d-flex align-items-center gap-2.5">
                      <div className="p-2 rounded-2 bg-dark text-primary fw-bold" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>F</div>
                      <div>
                        <strong className="d-block text-white small">Hôpital Fann</strong>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>ID: FANN-77291</small>
                      </div>
                    </div>
                    <span className="badge bg-success rounded-circle p-1">✓</span>
                  </div>

                  <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div className="d-flex align-items-center gap-2.5">
                      <div className="p-2 rounded-2 bg-dark text-danger fw-bold" style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LD</div>
                      <div>
                        <strong className="d-block text-white small">Le Dantec</strong>
                        <small className="text-muted" style={{ fontSize: '0.72rem' }}>ID: LD-091823</small>
                      </div>
                    </div>
                    <span className="badge bg-success rounded-circle p-1">✓</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Right Column: Radiographies & Examens DICOM Grid */}
          <div className="col-lg-8">
            <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div className="d-flex align-items-center gap-2">
                  <span style={{ fontSize: '1.3rem' }}>🩻</span>
                  <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.2rem' }}>Radiographies & Examens</h5>
                </div>

                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-dark text-white-50 p-2" style={{ borderRadius: '8px' }}>🔲</button>
                  <button className="btn btn-sm btn-dark text-white-50 p-2" style={{ borderRadius: '8px' }}>☰</button>
                </div>
              </div>

              {/* Exam Cards Grid */}
              <div className="row g-3">
                {exams.map(ex => (
                  <div key={ex.id} className="col-md-6">
                    <div className="rounded-4 overflow-hidden h-100 d-flex flex-column justify-content-between" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      
                      {/* Image Thumbnail Banner */}
                      <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
                        <img src={ex.preview} alt={ex.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                        <span className="badge bg-dark text-success border border-success position-absolute top-0 end-0 m-2" style={{ fontSize: '0.7rem' }}>
                          {ex.badge}
                        </span>
                      </div>

                      <div className="p-3.5 flex-grow-1">
                        <h6 className="fw-bold text-white mb-1" style={{ fontSize: '1.02rem' }}>{ex.title}</h6>
                        <small className="text-muted d-block mb-2" style={{ fontSize: '0.78rem' }}>
                          {ex.date} • {ex.facility}
                        </small>
                      </div>

                      <div className="p-3 border-top border-secondary border-opacity-25 d-flex gap-2">
                        <button 
                          className="btn btn-success btn-sm flex-fill fw-bold text-white d-flex align-items-center justify-content-center gap-1.5"
                          style={{ background: '#10b981', border: 'none', borderRadius: '10px' }}
                          onClick={() => setViewingExam(ex)}
                        >
                          <span>👁 Voir DICOM</span>
                        </button>
                        <button className="btn btn-dark btn-sm text-white-50 px-3" style={{ borderRadius: '10px' }} onClick={() => alert(`Téléchargement de l'examen #${ex.id}`)}>
                          📥
                        </button>
                      </div>

                    </div>
                  </div>
                ))}

                {/* Add New Exam Card (Dashed Border) */}
                <div className="col-md-6">
                  <div 
                    className="rounded-4 p-4 h-100 d-flex flex-column align-items-center justify-content-center gap-3 text-center"
                    style={{ 
                      background: 'rgba(15, 23, 42, 0.5)', 
                      border: '2px dashed rgba(16, 185, 129, 0.4)', 
                      cursor: 'pointer',
                      minHeight: '230px'
                    }}
                    onClick={() => setShowAddExamModal(true)}
                  >
                    <div className="p-3 rounded-circle text-success" style={{ background: 'rgba(16, 185, 129, 0.15)', fontSize: '1.8rem' }}>
                      ➕
                    </div>
                    <div>
                      <strong className="d-block text-white small">Ajouter un examen</strong>
                      <small className="text-muted" style={{ fontSize: '0.75rem' }}>Fichier PDF ou DICOM</small>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

      </div>

      {/* DICOM VIEWING MODAL */}
      {viewingExam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 text-white" style={{ borderRadius: '24px', background: '#0f172a' }}>
              <div className="modal-header border-bottom border-secondary p-3 d-flex justify-content-between">
                <h5 className="modal-title fw-bold text-success d-flex align-items-center gap-2">
                  <span>🩻 Visionneuse DICOM 3.0 HD — {viewingExam.title}</span>
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setViewingExam(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-4">
                  <div className="col-lg-8">
                    <div className="rounded-4 p-3 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: '440px', background: '#1e293b', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                      <img 
                        src={viewingExam.preview} 
                        alt={viewingExam.title} 
                        style={{ 
                          maxHeight: '100%', 
                          maxWidth: '100%', 
                          objectFit: 'contain',
                          transform: `scale(${dicomZoom})`,
                          filter: dicomInvert ? 'invert(100%)' : 'none',
                          transition: 'all 0.2s ease'
                        }} 
                      />

                      <div className="position-absolute bottom-0 start-0 m-3 p-2 rounded-3 bg-dark text-white-50 small">
                        Cliché {activeCliche} / {viewingExam.cliches}
                      </div>
                    </div>

                    <div className="d-flex justify-content-center gap-3 mt-3 p-2.5 rounded-4 bg-dark">
                      <button className="btn btn-sm btn-dark text-white border border-secondary" onClick={() => setDicomZoom(dicomZoom + 0.2)}>🔍 Zoom +</button>
                      <button className="btn btn-sm btn-dark text-white border border-secondary" onClick={() => setDicomZoom(1)}>🔄 Reset</button>
                      <button className={`btn btn-sm ${dicomInvert ? 'btn-warning' : 'btn-dark text-white border border-secondary'}`} onClick={() => setDicomInvert(!dicomInvert)}>🌗 Négatif</button>
                      <button className="btn btn-sm btn-success fw-bold" onClick={() => setActiveCliche((activeCliche % viewingExam.cliches) + 1)}>🖼 Cliché suivant</button>
                    </div>
                  </div>

                  <div className="col-lg-4">
                    <div className="p-4 rounded-4 bg-dark h-100 d-flex flex-column justify-content-between">
                      <div>
                        <h6 className="fw-bold text-success mb-2">📋 Conclusion Diagnostique</h6>
                        <p className="text-white-50 small mb-3" style={{ lineHeight: '1.6' }}>{viewingExam.conclusion}</p>
                        <small className="text-muted d-block border-top border-secondary pt-2">Prescrit / Validé par : <strong className="text-white">{viewingExam.doctor}</strong></small>
                      </div>

                      <div className="d-flex flex-column gap-2 mt-4">
                        <button className="btn btn-success fw-bold py-2" style={{ borderRadius: '10px' }} onClick={() => alert("Téléchargement du rapport PDF certifié...")}>📥 Rapport PDF Certifié</button>
                        <button className="btn btn-dark text-white border border-secondary py-2" style={{ borderRadius: '10px' }} onClick={() => setViewingExam(null)}>Fermer</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD EXAM MODAL */}
      {showAddExamModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <form onSubmit={handleAddExam} className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-3">➕ Ajouter un Examen DICOM / PDF</h5>
              
              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Titre de l'examen *</label>
                <input type="text" className="form-control text-white border-0" style={{ background: '#0f172a' }} value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} placeholder="Ex: Scanner Abdominal HD" required />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold text-white-50">Type d'imagerie *</label>
                <select className="form-select text-white border-0" style={{ background: '#0f172a' }} value={newExamType} onChange={(e) => setNewExamType(e.target.value)}>
                  <option value="Scanner">Scanner</option>
                  <option value="IRM">IRM</option>
                  <option value="Radio">Radio</option>
                  <option value="Analyse">Analyse</option>
                </select>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" className="btn btn-dark text-white-50" onClick={() => setShowAddExamModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-success fw-bold">Ajouter l'examen</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
