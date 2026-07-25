import React, { useState } from 'react';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Dossier Médical & Radiographies Certifiées
export default function MedicalProfile({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null }) {
  const isDoctorOrAgent = (userRole === 'agent' || userRole === 'partner' || userRole === 'doctor' || !!agentUser || !!partnerUser);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'history', 'lab'
  
  // Modales
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [editingAntecedents, setEditingAntecedents] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyShareLink = () => {
    const shareUrl = `https://mutualis.sn/dossier-partage/849-201`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleShareWhatsApp = (e) => {
    if (e) e.preventDefault();
    const shareText = `Bonjour Docteur, voici l'accès sécurisé à mon dossier médical certifié UNAMUSC Sénégal (Code OTP 24h : 849-201) : https://mutualis.sn/dossier-partage/849-201`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Dossier Médical UNAMUSC',
        text: shareText,
        url: 'https://mutualis.sn/dossier-partage/849-201'
      }).catch(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      });
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

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
    <div className="medical-profile-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Dossier Médical Partagé 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'var(--border-color)' }} />
            
            <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-card)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                style={{ 
                  background: activeTab === 'overview' ? '#10b981' : 'transparent', 
                  color: activeTab === 'overview' ? '#ffffff' : 'var(--text-sub)', 
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
                  color: activeTab === 'history' ? '#ffffff' : 'var(--text-sub)', 
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
                  color: activeTab === 'lab' ? '#ffffff' : 'var(--text-sub)', 
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
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '200px' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-5 rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_profile_hero_real.png") center/cover no-repeat', padding: '3.75rem 2.5rem', minHeight: '240px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-4">
            <div>
              <span style={{ background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.75rem', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                🇸🇳 CERTIFIÉ CNOM & UNAMUSC SÉNÉGAL
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.35rem', letterSpacing: '-0.02em', textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>Dossier médical & radiographies certifiées</h1>
              <p className="text-white mb-0" style={{ fontSize: '1.05rem', maxWidth: '720px', lineHeight: '1.6', textShadow: '0 2px 4px rgba(0,0,0,0.3)', opacity: 0.95 }}>
                Accédez en toute sécurité à vos antécédents, vos résultats de radiologie et téléchargez votre carnet de santé numérique certifié.
              </p>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              <button 
                type="button"
                style={{ background: '#ffffff', color: '#047857', border: 'none', borderRadius: '12px', padding: '0.7rem 1.25rem', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)' }} 
                onClick={handleDownloadFullBooklet}
              >
                📥 Télécharger le carnet PDF (🇸🇳)
              </button>

              <button 
                type="button"
                style={{ background: 'rgba(255,255,255,0.25)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '12px', padding: '0.7rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', backdropFilter: 'blur(6px)' }} 
                onClick={() => setShowShareModal(true)}
              >
                🔗 Partager avec mon médecin
              </button>

              <button 
                type="button"
                style={{ background: 'rgba(16, 185, 129, 0.9)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '12px', padding: '0.7rem 1.25rem', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer' }} 
                onClick={() => setShowAddExamModal(true)}
              >
                ➕ Ajouter un examen
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
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2 text-danger">
                      <span style={{ fontSize: '1.2rem' }}>🩸</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Groupe Sanguin</h6>
                    </div>
                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>Urgent</span>
                  </div>

                  <div className="d-flex align-items-baseline gap-2 my-2">
                    <h1 className="fw-black text-success mb-0" style={{ fontSize: '3.2rem', letterSpacing: '-0.03em' }}>{antecedents.bloodGroup}</h1>
                    <span className="fw-bold" style={{ color: 'var(--text-sub)', fontSize: '1.1rem' }}>Rhésus {antecedents.rhesus}</span>
                  </div>

                  <small className="d-block pt-2 border-top" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)', fontSize: '0.75rem' }}>
                    Certifié par : <strong style={{ color: 'var(--text-main)' }}>Laboratoire Bio24, Dakar</strong>
                  </small>
                </div>

                {/* Allergies & Alertes Card */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2 text-warning">
                      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Allergies & Alertes</h6>
                    </div>
                    {isDoctorOrAgent ? (
                      <button 
                        type="button" 
                        style={{ background: 'transparent', color: '#10b981', border: 'none', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => setEditingAntecedents(!editingAntecedents)}
                      >
                        {editingAntecedents ? '✕ Fermer' : '✏️ Éditer (Médecin)'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem', fontStyle: 'italic' }}>
                        🔒 Mis à jour par le Médecin
                      </span>
                    )}
                  </div>

                  {editingAntecedents ? (
                    <form onSubmit={handleSaveAntecedents} className="d-flex flex-column gap-2">
                      <label className="small" style={{ color: 'var(--text-sub)' }}>Allergies :</label>
                      <input 
                        type="text" 
                        className="form-control small" 
                        style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} 
                        value={antecedents.allergies} 
                        onChange={(e) => setAntecedents({ ...antecedents, allergies: e.target.value })} 
                      />
                      <label className="small mt-1" style={{ color: 'var(--text-sub)' }}>Affections / ALD :</label>
                      <input 
                        type="text" 
                        className="form-control small" 
                        style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }} 
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
                          <span className="fw-bold small" style={{ color: 'var(--text-main)' }}>{alg.trim()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interopérabilité Card */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2 mb-3 text-success">
                    <span style={{ fontSize: '1.2rem' }}>🌐</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Interopérabilité DHIS2</h6>
                  </div>

                  <div className="d-flex flex-column gap-2.5">
                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '32px', height: '32px', background: '#059669', color: '#ffffff', fontWeight: '700', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>F</div>
                        <div>
                          <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Hôpital Fann</strong>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>ID: FANN-77291</small>
                        </div>
                      </div>
                      <span style={{ background: '#10b981', color: '#ffffff', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>✓</span>
                    </div>

                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '32px', height: '32px', background: '#dc2626', color: '#ffffff', fontWeight: '700', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>LD</div>
                        <div>
                          <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Le Dantec</strong>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>ID: LD-091823</small>
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
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.3rem' }}>🩻</span>
                    <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Radiographies & Examens Certifiés</h5>
                  </div>
                </div>

                {/* Exam Cards Grid */}
                <div className="row g-3">
                  {exams.map(ex => (
                    <div key={ex.id} className="col-md-6">
                      <div className="rounded-4 overflow-hidden h-100 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                        
                        {/* Image Thumbnail Banner */}
                        <div style={{ height: '140px', position: 'relative', overflow: 'hidden' }}>
                          <img src={ex.preview} alt={ex.title} onError={(e) => { e.target.src = '/csu_digital_health_real.jpg'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                          <span style={{ background: 'var(--bg-card)', color: '#10b981', border: '1px solid #10b981', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '700', position: 'absolute', top: '8px', end: '8px' }}>
                            {ex.badge}
                          </span>
                        </div>

                        <div className="p-3.5 flex-grow-1">
                          <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.02rem' }}>{ex.title}</h6>
                          <small className="d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                            {ex.date} • {ex.facility}
                          </small>
                        </div>

                        <div className="p-3 border-top d-flex gap-2" style={{ borderColor: 'var(--border-color)' }}>
                          <button 
                            type="button"
                            style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem', fontWeight: '700', flex: 1, fontSize: '0.82rem', cursor: 'pointer' }}
                            onClick={() => setViewingExam(ex)}
                          >
                            👁 Voir DICOM
                          </button>
                          
                          <button 
                            type="button" 
                            style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.8rem', cursor: 'pointer' }}
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
                        background: 'var(--bg-card-subtle)', 
                        border: '2px dashed var(--primary)', 
                        cursor: 'pointer',
                        minHeight: '230px'
                      }}
                      onClick={() => setShowAddExamModal(true)}
                    >
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '700' }}>
                        ➕
                      </div>
                      <div>
                        <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Ajouter un examen</strong>
                        <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>Fichier PDF ou DICOM</small>
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
          <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📜 Historique Médical Complet</h5>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th>DATE</th>
                    <th>ACTE / CONSULTATION</th>
                    <th>PRATICIEN / STRUCTURE</th>
                    <th>CONCLUSION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <td style={{ color: 'var(--text-sub)' }}>12/05/2026</td>
                    <td className="fw-bold" style={{ color: 'var(--text-main)' }}>Téléconsultation Généraliste</td>
                    <td style={{ color: 'var(--text-sub)' }}>Dr. Ousmane Sow</td>
                    <td style={{ color: 'var(--text-sub)' }}>Grippe saisonnière. Ordonnance émise.</td>
                  </tr>
                  <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <td style={{ color: 'var(--text-sub)' }}>15/03/2026</td>
                    <td className="fw-bold" style={{ color: 'var(--text-main)' }}>Consultation Prénatale CPN 2</td>
                    <td style={{ color: 'var(--text-sub)' }}>Dr. Mariama Ba</td>
                    <td style={{ color: 'var(--text-sub)' }}>Tension 12/8. Évolution normale.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LABORATOIRE */}
        {activeTab === 'lab' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>🧪 Résultats d'Analyses Biologiques</h5>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th>EXAMEN</th>
                    <th>RÉSULTAT</th>
                    <th>VALEURS DE RÉFÉRENCE</th>
                    <th>STATUT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="fw-bold" style={{ color: 'var(--text-main)' }}>Glycémie à jeun</td>
                    <td className="text-success fw-bold">0.95 g/L</td>
                    <td style={{ color: 'var(--text-sub)' }}>0.70 - 1.10 g/L</td>
                    <td><span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>Normal</span></td>
                  </tr>
                  <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="fw-bold" style={{ color: 'var(--text-main)' }}>Hémoglobine (NFS)</td>
                    <td className="text-success fw-bold">14.2 g/dL</td>
                    <td style={{ color: 'var(--text-sub)' }}>12.0 - 16.0 g/dL</td>
                    <td><span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>Normal</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* DICOM VIEWING MODAL (Centered on Screen) */}
      {viewingExam && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1100px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">🩻 Visionneuse DICOM 3.0 HD — {viewingExam.title}</h5>
              <button type="button" className="btn-close" onClick={() => setViewingExam(null)}></button>
            </div>

              <div className="row g-4">
                <div className="col-lg-8">
                  <div className="rounded-4 p-3 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: '420px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
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
                    <div className="position-absolute bottom-0 start-0 m-3 p-2 rounded-3 small" style={{ background: 'var(--bg-card)', color: 'var(--text-sub)', border: '1px solid var(--border-color)' }}>
                      Cliché {activeCliche} / {viewingExam.cliches}
                    </div>
                  </div>

                  <div className="d-flex justify-content-center gap-2 mt-3 p-2 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                    <button type="button" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDicomZoom(dicomZoom + 0.2)}>🔍 Zoom +</button>
                    <button type="button" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDicomZoom(1)}>🔄 Reset</button>
                    <button type="button" style={{ background: dicomInvert ? '#f59e0b' : 'var(--bg-card)', color: dicomInvert ? '#ffffff' : 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => setDicomInvert(!dicomInvert)}>🌗 Négatif</button>
                    <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => setActiveCliche(prev => (prev >= viewingExam.cliches ? 1 : prev + 1))}>🖼 Cliché suivant</button>
                  </div>
                </div>

                <div className="col-lg-4">
                  <div className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <h6 className="fw-bold text-success mb-2">📋 Conclusion Diagnostique</h6>
                      <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>{viewingExam.conclusion}</p>
                      <small className="d-block border-top pt-2" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>Prescrit par : <strong style={{ color: 'var(--text-main)' }}>{viewingExam.doctor}</strong></small>
                    </div>

                    <div className="d-flex flex-column gap-2 mt-4">
                      <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem', fontWeight: '700', cursor: 'pointer' }} onClick={() => handleDownloadExam(viewingExam)}>📥 Télécharger Rapport PDF Certifié (🇸🇳)</button>
                      <button type="button" style={{ background: 'var(--bg-card)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem' }} onClick={() => setViewingExam(null)}>Fermer</button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
      )}

      {/* SHARE MODAL */}
      {showShareModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-2">
                <span style={{ fontSize: '1.3rem' }}>🔗</span>
                <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>Partager mon Dossier Médical (UNAMUSC)</h5>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowShareModal(false)}></button>
            </div>

            <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
              Générez un jeton d'accès sécurisé temporaire (Valable 24h) pour autoriser votre médecin ou établissement partenaire à consulter vos antécédents et radiographies.
            </p>

            <div className="p-3.5 rounded-4 mb-3 text-center border border-success" style={{ background: 'var(--bg-card-subtle)' }}>
              <small className="d-block mb-1 text-muted fw-bold" style={{ fontSize: '0.75rem' }}>CODE D'ACCÈS TEMPORAIRE SÉCURISÉ (OTP 24H) :</small>
              <h2 className="fw-bold text-warning letter-spacing-2 my-1" style={{ fontSize: '2rem' }}>849-201</h2>
              <small className="d-block text-success fw-bold" style={{ fontSize: '0.75rem' }}>● ACCÈS SÉCURISÉ CHIFFRÉ DHIS2 & UNAMUSC</small>
            </div>

            {/* QR CODE FOR DOCTOR SCAN */}
            <div className="d-flex align-items-center gap-3 p-3 rounded-4 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="p-1.5 bg-white rounded-3 border border-success flex-shrink-0">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://mutualis.sn/dossier-partage/849-201" alt="QR Code Partage" style={{ width: '80px', height: '80px' }} />
              </div>
              <div>
                <strong className="d-block text-success small fw-bold">Scan QR Code en Consultation</strong>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem', lineHeight: '1.4' }}>
                  Votre médecin peut directement scanner ce QR Code avec son smartphone pour ouvrir votre dossier médical certifié.
                </small>
              </div>
            </div>

            {copiedLink && (
              <div className="alert alert-success py-2 px-3 small fw-bold mb-3 rounded-3 text-center">
                ✅ Lien d'accès au dossier médical copié dans le presse-papier !
              </div>
            )}

            <div className="d-flex flex-column gap-2">
              <button 
                type="button" 
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} 
                onClick={handleCopyShareLink}
              >
                📋 Copier le lien sécurisé (https://mutualis.sn/dossier/849-201)
              </button>

              <button 
                type="button" 
                style={{ background: '#25D366', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,211,102,0.3)', width: '100%' }}
                onClick={handleShareWhatsApp}
              >
                💬 Partager directement via WhatsApp au Médecin
              </button>

              <button 
                type="button" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }} 
                onClick={() => setShowShareModal(false)}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADD EXAM MODAL (Centered on Screen) */}
      {showAddExamModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddExam} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">➕ Ajouter un Examen DICOM / PDF</h5>
              <button type="button" className="btn-close" onClick={() => setShowAddExamModal(false)}></button>
            </div>
            
            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Titre de l'examen *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} placeholder="Ex: Scanner Abdominal HD" required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Type d'imagerie *</label>
              <select className="form-select" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newExamType} onChange={(e) => setNewExamType(e.target.value)}>
                <option value="Scanner">Scanner</option>
                <option value="IRM">IRM</option>
                <option value="Radio">Radio</option>
                <option value="Analyse">Analyse</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Établissement / Structure de santé *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newExamFacility} onChange={(e) => setNewExamFacility(e.target.value)} placeholder="Ex: Hôpital Principal de Dakar" required />
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: '700' }} onClick={() => setShowAddExamModal(false)}>Annuler</button>
              <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>Ajouter l'examen</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
