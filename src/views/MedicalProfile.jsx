import React, { useState } from 'react';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Dossier Médical & Radiographies Certifiées
export default function MedicalProfile({ lang = 'fr', userRole = 'citizen', citizenUser = null }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'history', 'lab'
  
  // Modales
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [editingAntecedents, setEditingAntecedents] = useState(false);

  // Antécédents Médicaux Éditables
  const [antecedents, setAntecedents] = useState({
    bloodGroup: 'A+',
    rhesus: 'Positif',
    allergies: 'Pénicilline (Sévère), Pollen de Graminées',
    chronicConditions: 'Hypertension artérielle (HTA), Diabète Type 2',
    surgeries: 'Appendicectomie (2021)',
    emergencyContact: 'Moussa Sow (Frère) — +221 77 450 12 34'
  });

  // Imagerie & Examens DICOM
  const [exams, setExams] = useState([
    {
      id: 501,
      title: 'Scanner Thoracique',
      exam_type: 'Scanner',
      badge: 'HD DICOM',
      facility: 'Clinique Pasteur (Dakar)',
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

  // Formulaire d'ajout
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamType, setNewExamType] = useState('Scanner');
  const [newExamFacility, setNewExamFacility] = useState('Laboratoire Bio24');

  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExamTitle) return;
    const added = {
      id: Date.now(),
      title: newExamTitle,
      exam_type: newExamType,
      badge: 'HD DICOM',
      facility: newExamFacility,
      doctor: 'Dr. Aminata Ndiaye',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      conclusion: 'Examen enregistré et certifié.',
      cliches: 1,
      preview: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'
    };
    setExams([...exams, added]);
    setShowAddExamModal(false);
    setNewExamTitle('');
    alert("✅ Examen DICOM / Rapport PDF ajouté avec succès !");
  };

  const handleSaveAntecedents = (e) => {
    e.preventDefault();
    setEditingAntecedents(false);
    alert("✅ Antécédents médicaux mis à jour et certifiés !");
  };

  const handleDownloadFullBooklet = () => {
    generateOfficialPdf({
      filename: 'dossier_medical_partage_awa_ndiaye.pdf',
      docType: 'DOSSIER MÉDICAL PARTAGÉ CERTIFIÉ',
      title: 'Carnet de Santé Numérique & Bilan Médical',
      referenceNo: 'DOSSIER-MED-2026-8812',
      beneficiaryName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-8812',
      structureName: 'Réseau Établissements Agréés Sénégal',
      details: [
        { label: 'Assurée Bénéficiaire', value: 'Awa Ndiaye' },
        { label: 'Groupe Sanguin', value: `${antecedents.bloodGroup} (Rhésus ${antecedents.rhesus})` },
        { label: 'Allergies & Alertes', value: antecedents.allergies },
        { label: 'Affections Longue Durée (ALD)', value: antecedents.chronicConditions },
        { label: 'Interventions Chirurgicales', value: antecedents.surgeries },
        { label: 'Examens DICOM Enregistrés', value: `${exams.length} examens certifiés (Scanner Thoracique, IRM Cérébrale, Échocardiographie)` }
      ],
      notes: 'Ce dossier médical numérique est conforme aux normes d\'interopérabilité sanitaire du Sénégal (DHIS2 & CNOM).'
    });
  };

  const handleDownloadExam = (ex) => {
    generateOfficialPdf({
      filename: `examen_dicom_${ex.id}.pdf`,
      docType: 'COMPTE-RENDU D\'IMAGERIE RADIOLOGIQUE DICOM',
      title: `Rapport Radiologique Certifié — ${ex.title}`,
      referenceNo: `EXAM-DICOM-#${ex.id}`,
      beneficiaryName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-8812',
      structureName: ex.facility,
      details: [
        { label: 'Intitulé de l\'Examen', value: ex.title },
        { label: 'Établissement Emetteur', value: ex.facility },
        { label: 'Praticien Radiologue', value: ex.doctor },
        { label: 'Date de réalisation', value: ex.date },
        { label: 'Nombre de clichés HD', value: `${ex.cliches} clichés téléchargeables` },
        { label: 'Conclusion Diagnostique', value: ex.conclusion }
      ],
      notes: 'Rapport validé électroniquement sous le standard DICOM 3.0 HD par le médecin radiologue agréé.'
    });
  };

  return (
    <div className="medical-profile-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: '#0f172a', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>Dossier Médical Partagé 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            
            <div style={{ display: 'flex', gap: '0.4rem', background: '#1e293b', padding: '0.25rem', borderRadius: '10px' }}>
              <button 
                type="button"
                style={{ 
                  background: activeTab === 'overview' ? '#10b981' : 'transparent', 
                  color: activeTab === 'overview' ? '#ffffff' : '#94a3b8', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '0.35rem 0.85rem', 
                  fontWeight: '700', 
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }} 
                onClick={() => setActiveTab('overview')}
              >
                Vue d'ensemble
              </button>

              <button 
                type="button"
                style={{ 
                  background: activeTab === 'history' ? '#10b981' : 'transparent', 
                  color: activeTab === 'history' ? '#ffffff' : '#94a3b8', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '0.35rem 0.85rem', 
                  fontWeight: '700', 
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }} 
                onClick={() => setActiveTab('history')}
              >
                Historique
              </button>

              <button 
                type="button"
                style={{ 
                  background: activeTab === 'lab' ? '#10b981' : 'transparent', 
                  color: activeTab === 'lab' ? '#ffffff' : '#94a3b8', 
                  border: 'none', 
                  borderRadius: '8px', 
                  padding: '0.35rem 0.85rem', 
                  fontWeight: '700', 
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }} 
                onClick={() => setActiveTab('lab')}
              >
                Laboratoire
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Rechercher un examen..." 
              style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '200px' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-4 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)' }}>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
            <div>
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.5rem' }}>
                🇸🇳 CERTIFIÉ CNOM & UNAMUSC SÉNÉGAL
              </span>
              <h2 className="fw-extrabold text-white mb-2" style={{ fontSize: '1.9rem', letterSpacing: '-0.02em' }}>Dossier médical & radiographies certifiées</h2>
              <p className="text-white-50 mb-0" style={{ fontSize: '0.95rem', maxWidth: '680px', lineHeight: '1.5' }}>
                Accédez en toute sécurité à vos antécédents, vos résultats de radiologie et téléchargez votre carnet de santé numérique certifié.
              </p>
            </div>

            <div className="d-flex gap-2">
              <button 
                type="button"
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.15rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }} 
                onClick={handleDownloadFullBooklet}
              >
                📥 Télécharger le carnet PDF (🇸🇳)
              </button>

              <button 
                type="button"
                style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '0.65rem 1.15rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }} 
                onClick={() => setShowShareModal(true)}
              >
                Partager avec mon médecin
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: VUE D'ENSEMBLE */}
        {activeTab === 'overview' && (
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
                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>Urgent</span>
                  </div>

                  <div className="d-flex align-items-baseline gap-2 my-2">
                    <h1 className="fw-black text-success mb-0" style={{ fontSize: '3.2rem', letterSpacing: '-0.03em' }}>{antecedents.bloodGroup}</h1>
                    <span className="fw-bold text-white-50" style={{ fontSize: '1.1rem' }}>Rhésus {antecedents.rhesus}</span>
                  </div>

                  <small className="text-muted d-block pt-2 border-top border-secondary border-opacity-25" style={{ fontSize: '0.75rem' }}>
                    Certifié par : <strong className="text-white-50">Laboratoire Bio24, Dakar</strong>
                  </small>
                </div>

                {/* Allergies & Alertes Card */}
                <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2 text-warning">
                      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                      <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Allergies & Alertes</h6>
                    </div>
                    <button 
                      type="button" 
                      style={{ background: 'transparent', color: '#34d399', border: 'none', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => setEditingAntecedents(!editingAntecedents)}
                    >
                      {editingAntecedents ? '✕ Fermer' : '✏️ Éditer'}
                    </button>
                  </div>

                  {editingAntecedents ? (
                    <form onSubmit={handleSaveAntecedents} className="d-flex flex-column gap-2">
                      <label className="small text-white-50">Allergies :</label>
                      <input 
                        type="text" 
                        className="form-control text-white border-0 small" 
                        style={{ background: '#0f172a' }} 
                        value={antecedents.allergies} 
                        onChange={(e) => setAntecedents({ ...antecedents, allergies: e.target.value })} 
                      />
                      <label className="small text-white-50 mt-1">Affections / ALD :</label>
                      <input 
                        type="text" 
                        className="form-control text-white border-0 small" 
                        style={{ background: '#0f172a' }} 
                        value={antecedents.chronicConditions} 
                        onChange={(e) => setAntecedents({ ...antecedents, chronicConditions: e.target.value })} 
                      />
                      <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem', fontWeight: '700', marginTop: '0.5rem' }}>Sauvegarder</button>
                    </form>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {antecedents.allergies.split(',').map((alg, idx) => (
                        <div key={idx} className="p-3 rounded-3 d-flex align-items-center gap-2.5" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                          <span className="text-warning font-monospace" style={{ fontSize: '1.2rem' }}>●</span>
                          <span className="fw-bold text-white small">{alg.trim()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interopérabilité Card */}
                <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <div className="d-flex align-items-center gap-2 mb-3 text-success">
                    <span style={{ fontSize: '1.2rem' }}>🌐</span>
                    <h6 className="fw-bold text-white mb-0" style={{ fontSize: '1rem' }}>Interopérabilité DHIS2</h6>
                  </div>

                  <div className="d-flex flex-column gap-2.5">
                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '32px', height: '32px', background: '#059669', color: '#ffffff', fontWeight: '700', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>F</div>
                        <div>
                          <strong className="d-block text-white small">Hôpital Fann</strong>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>ID: FANN-77291</small>
                        </div>
                      </div>
                      <span style={{ background: '#10b981', color: '#ffffff', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>✓</span>
                    </div>

                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '32px', height: '32px', background: '#dc2626', color: '#ffffff', fontWeight: '700', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LD</div>
                        <div>
                          <strong className="d-block text-white small">Le Dantec</strong>
                          <small className="text-muted" style={{ fontSize: '0.72rem' }}>ID: LD-091823</small>
                        </div>
                      </div>
                      <span style={{ background: '#10b981', color: '#ffffff', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>✓</span>
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
                    <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.2rem' }}>Radiographies & Examens Certifiés</h5>
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
                          <span style={{ background: '#0f172a', color: '#34d399', border: '1px solid #10b981', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', position: 'absolute', top: '8px', end: '8px' }}>
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
                            type="button"
                            style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem', fontWeight: '700', flex: 1, fontSize: '0.82rem', cursor: 'pointer' }}
                            onClick={() => setViewingExam(ex)}
                          >
                            👁 Voir DICOM
                          </button>
                          
                          <button 
                            type="button" 
                            style={{ background: '#1e293b', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '0.5rem 0.8rem', cursor: 'pointer' }}
                            onClick={() => handleDownloadExam(ex)}
                            title="Télécharger l'examen PDF Certifié (🇸🇳)"
                          >
                            📥
                          </button>
                        </div>

                      </div>
                    </div>
                  ))}

                  {/* Add New Exam Card */}
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
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700' }}>
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
        )}

        {/* TAB 2: HISTORIQUE MÉDICAL */}
        {activeTab === 'history' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h5 className="fw-bold text-white mb-3">📜 Historique Médical Complet</h5>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr className="text-muted small">
                    <th>DATE</th>
                    <th>ACTE / CONSULTATION</th>
                    <th>PRATICIEN / STRUCTURE</th>
                    <th>CONCLUSION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-white-50">12/05/2026</td>
                    <td className="fw-bold text-white">Téléconsultation Généraliste</td>
                    <td>Dr. Ousmane Sow</td>
                    <td className="text-white-50">Grippe saisonnière. Ordonnance émise.</td>
                  </tr>
                  <tr>
                    <td className="text-white-50">15/03/2026</td>
                    <td className="fw-bold text-white">Consultation Prénatale CPN 2</td>
                    <td>Dr. Mariama Ba</td>
                    <td className="text-white-50">Tension 12/8. Évolution normale.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LABORATOIRE */}
        {activeTab === 'lab' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <h5 className="fw-bold text-white mb-3">🧪 Résultats d'Analyses Biologiques</h5>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0">
                <thead>
                  <tr className="text-muted small">
                    <th>EXAMEN</th>
                    <th>RÉSULTAT</th>
                    <th>VALEURS DE RÉFÉRENCE</th>
                    <th>STATUT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-bold text-white">Glycémie à jeun</td>
                    <td className="text-success fw-bold">0.95 g/L</td>
                    <td className="text-white-50">0.70 - 1.10 g/L</td>
                    <td><span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>Normal</span></td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-white">Hémoglobine (NFS)</td>
                    <td className="text-success fw-bold">14.2 g/dL</td>
                    <td className="text-white-50">12.0 - 16.0 g/dL</td>
                    <td><span style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>Normal</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* DICOM VIEWING MODAL */}
      {viewingExam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#0f172a' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold text-success mb-0">🩻 Visionneuse DICOM 3.0 HD — {viewingExam.title}</h5>
                <button className="btn-close btn-close-white" onClick={() => setViewingExam(null)}></button>
              </div>

              <div className="row g-4">
                <div className="col-lg-8">
                  <div className="rounded-4 p-3 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: '420px', background: '#1e293b', position: 'relative', overflow: 'hidden' }}>
                    <img 
                      src={viewingExam.preview} 
                      alt={viewingExam.title} 
                      style={{ 
                        maxHeight: '100%', 
                        maxWidth: '100%', 
                        objectFit: 'contain',
                        transform: `scale(${dicomZoom})`,
                        filter: dicomInvert ? 'invert(100%)' : 'none'
                      }} 
                    />
                    <div className="position-absolute bottom-0 start-0 m-3 p-2 rounded-3 bg-dark text-white-50 small">
                      Cliché {activeCliche} / {viewingExam.cliches}
                    </div>
                  </div>

                  <div className="d-flex justify-content-center gap-2 mt-3 p-2 rounded-4 bg-dark">
                    <button type="button" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDicomZoom(dicomZoom + 0.2)}>🔍 Zoom +</button>
                    <button type="button" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDicomZoom(1)}>🔄 Reset</button>
                    <button type="button" style={{ background: dicomInvert ? '#f59e0b' : '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDicomInvert(!dicomInvert)}>🌗 Négatif</button>
                    <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => setActiveCliche((activeCliche % viewingExam.cliches) + 1)}>🖼 Cliché suivant</button>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="p-4 rounded-4 bg-dark h-100 d-flex flex-column justify-content-between">
                    <div>
                      <h6 className="fw-bold text-success mb-2">📋 Conclusion Diagnostique</h6>
                      <p className="text-white-50 small mb-3">{viewingExam.conclusion}</p>
                      <small className="text-muted d-block border-top border-secondary pt-2">Prescrit par : <strong className="text-white">{viewingExam.doctor}</strong></small>
                    </div>

                    <div className="d-flex flex-column gap-2 mt-4">
                      <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem', fontWeight: '700', cursor: 'pointer' }} onClick={() => handleDownloadExam(viewingExam)}>📥 Télécharger Rapport PDF Certifié (🇸🇳)</button>
                      <button type="button" style={{ background: '#1e293b', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0.65rem' }} onClick={() => setViewingExam(null)}>Fermer</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content text-white p-4" style={{ borderRadius: '24px', background: '#1e293b' }}>
              <h5 className="fw-bold text-success mb-2">🔗 Partager le dossier médical avec un médecin</h5>
              <p className="text-white-50 small mb-3">Générez un lien d'accès sécurisé temporaire (Valable 24h) pour votre praticien.</p>
              
              <div className="p-3 bg-dark rounded-3 mb-3 text-center border border-success">
                <small className="text-muted d-block mb-1">Code d'accès temporaire OTP :</small>
                <h3 className="fw-bold text-warning letter-spacing-2 mb-0">849-201</h3>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowShareModal(false)}>Fermer</button>
                <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }} onClick={() => alert("Lien copié dans le presse-papier !")}>📋 Copier le lien</button>
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
                <button type="button" style={{ background: '#0f172a', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowAddExamModal(false)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700' }}>Ajouter l'examen</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
