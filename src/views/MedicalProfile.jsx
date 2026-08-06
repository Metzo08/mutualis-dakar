import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Dossier Médical & Radiographies Certifiées
export default function MedicalProfile({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null }) {
  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isAgent      = (userRole === 'agent' || !!agentUser) && !isSuperAdmin;
  const isDoctor     = userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin'));
  const isMidwife    = userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage'));
  const isPharmacist = userRole === 'pharmacist';
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && !!citizenUser;

  // Droits d'édition clinique : uniquement médecin, sage-femme et superadmin
  const canEditMedical  = isDoctor || isMidwife || isSuperAdmin;
  // Vue administrative (sans accès au contenu médical détaillé)
  const isAdminView     = isAgent && !isSuperAdmin;
  // Accès total
  const hasFullAccess   = canEditMedical || isSuperAdmin;
  // Ancien alias pour rétro-compatibilité des blocs existants
  const isDoctorOrAgent = canEditMedical || isSuperAdmin;

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'history', 'lab'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Nom et N° CSU dynamique
  const activeFirstName = citizenUser?.firstName || citizenUser?.first_name || 'Modou';
  const activeLastName = citizenUser?.lastName || citizenUser?.last_name || 'Diop';
  const activeCmuNumber = citizenUser?.cmuNumber || citizenUser?.cmu_number || 'SN-DK-MED-8472';

  const isStudent = (citizenUser?.packageType === 'scolaire' || (citizenUser?.firstName || '').toLowerCase().includes('ibrahima'));
  const isBsf = (citizenUser?.packageType === 'gratuité' || (citizenUser?.firstName || '').toLowerCase().includes('fatou'));

  // Modales
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [editingAntecedents, setEditingAntecedents] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyShareLink = () => {
    const shareUrl = `https://mutualis.sn/dossier-partage/${activeCmuNumber.slice(-4)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleShareWhatsApp = (e) => {
    if (e) e.preventDefault();
    const shareText = `Bonjour Docteur, voici l'accès sécurisé au dossier médical certifié UNAMUSC de ${activeFirstName} ${activeLastName} (${activeCmuNumber}) : https://mutualis.sn/dossier-partage/${activeCmuNumber.slice(-4)}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Dossier Médical UNAMUSC',
        text: shareText,
        url: `https://mutualis.sn/dossier-partage/${activeCmuNumber.slice(-4)}`
      }).catch(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      });
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Générateurs de données médicales propres à chaque assuré
  const getAntecedentsForUser = (cmuNum, isStud, isBsfUser, fName) => {
    if (isStud || (fName || '').toLowerCase().includes('ibrahima')) {
      return {
        bloodGroup: 'O+',
        rhesus: 'positif',
        allergies: 'Aucune allergie connue (Bilan médical UCAD 2026)',
        chronicConditions: 'Aucune affection de longue durée : Aptitude sportive UCAD validée',
        surgeries: 'Aucune chirurgie antérieure',
        emergencyContact: 'Papa Sarr (Père) : +221 77 654 32 10'
      };
    }
    if (isBsfUser || (fName || '').toLowerCase().includes('fatou')) {
      return {
        bloodGroup: 'B+',
        rhesus: 'positif',
        allergies: 'Pénicilline (Modérée)',
        chronicConditions: 'Hypertension artérielle (Suivi programme gratuité BSF)',
        surgeries: 'Césarienne (2018)',
        emergencyContact: 'Mamadou Diallo (Époux) : +221 77 123 99 88'
      };
    }
    return {
      bloodGroup: 'A+',
      rhesus: 'positif',
      allergies: 'Pollen de graminées (Médina)',
      chronicConditions: 'Bilan de santé annuel régulier à la Médina',
      surgeries: 'Appendicectomie (2021)',
      emergencyContact: 'Sokhna Diop (Épouse) : +221 77 987 65 43'
    };
  };

  const getExamsForUser = (cmuNum, isStud, isBsfUser, fName) => {
    if (isStud || (fName || '').toLowerCase().includes('ibrahima')) {
      return [
        {
          id: 601,
          title: 'Radiographie thoracique d\'incorporate UCAD',
          exam_type: 'Radiographie',
          badge: 'BILAN UCAD',
          facility: 'Centre médical universitaire (Fann)',
          doctor: 'Dr. Ousmane Sow | Pavillon santé UCAD',
          date: '02 Fév 2026',
          conclusion: 'Cliché pulmonaire normal. Absence d\'anomalie parenchymateuse. Aptitude physique universitaire validée.',
          cliches: 2,
          preview: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'
        },
        {
          id: 602,
          title: 'Échographie abdominale de contrôle sportif',
          exam_type: 'Échographie',
          badge: 'SPORTS MED',
          facility: 'Hôpital universitaire de Fann',
          doctor: 'Dr. Cheikh Anta Diop',
          date: '10 Janv 2026',
          conclusion: 'Organes abdominaux de morphologie et d\'écho-structure normales. Examen satisfaisant.',
          cliches: 3,
          preview: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=400'
        }
      ];
    }
    if (isBsfUser || (fName || '').toLowerCase().includes('fatou')) {
      return [
        {
          id: 701,
          title: 'Échographie maternelle & pelvienne BSF',
          exam_type: 'Échographie',
          badge: 'GRATUITÉ BSF',
          facility: 'Hôpital Aristide Le Dantec (Dakar)',
          doctor: 'Dr. Mariama Ba | Service maternité Le Dantec',
          date: '14 Avril 2026',
          conclusion: 'Examen gynécologique et pelvien satisfaisant. Bilan de gratuité 100% BSF validé.',
          cliches: 3,
          preview: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400'
        }
      ];
    }
    return [
      {
        id: 501,
        title: 'Scanner thoracique médina',
        exam_type: 'Scanner',
        badge: 'HD DICOM',
        facility: 'Polyclinique de la Médina',
        doctor: 'Dr. Cheikh Anta Diop | Abass Ndao',
        date: '12 Mars 2026',
        conclusion: 'Examen de contrôle pulmonaire satisfaisant sans anomalie évolutive. Recommandation : suivi annuel.',
        cliches: 4,
        preview: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'
      },
      {
        id: 502,
        title: 'Échocardiographie de contrôle',
        exam_type: 'Échographie',
        badge: 'CARDIOLOGIE',
        facility: 'Centre médical SOS Médina',
        doctor: 'Dr. Sy | Cardiologue',
        date: '15 Janv 2026',
        conclusion: 'Fonction ventriculaire droite et gauche conservées. Bilan tensionnel satisfaisant.',
        cliches: 3,
        preview: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=400'
      }
    ];
  };

  const getHistoryForUser = (cmuNum, isStud, isBsfUser, fName) => {
    if (isStud || (fName || '').toLowerCase().includes('ibrahima')) {
      return [
        { id: 1, date: '02/02/2026', acte: 'Bilan de Santé Universitaire & Aptitude', praticien: 'Dr. Ousmane Sow (Pavillon Santé UCAD)', conclusion: 'Aptitude physique & sportive confirmée.' },
        { id: 2, date: '10/01/2026', acte: 'Consultation Médecine du Sport UCAD', praticien: 'Dr. Cheikh Anta Diop', conclusion: 'Examen clinique sans anomalie.' }
      ];
    }
    if (isBsfUser || (fName || '').toLowerCase().includes('fatou')) {
      return [
        { id: 1, date: '14/04/2026', acte: 'Consultation Suivi Filet Social BSF', praticien: 'Dr. Mariama Ba (Le Dantec)', conclusion: 'Examen gynécologique et ordonnance gratuite émise.' },
        { id: 2, date: '12/03/2026', acte: 'Prise de Sang & Bilan Biologique BSF', praticien: 'Laboratoire Bio24 Pikine', conclusion: 'Paramètres biologiques dans les normes.' }
      ];
    }
    return [
      { id: 1, date: '12/05/2026', acte: 'Consultation généraliste Médina', praticien: 'Dr. Cheikh Anta Diop (Abass Ndao)', conclusion: 'Contrôle tensionnel satisfaisant.' },
      { id: 2, date: '15/01/2026', acte: 'Échocardiographie de contrôle', praticien: 'Dr. Sy (Cardiologue)', conclusion: 'Fonction ventriculaire conservée.' }
    ];
  };

  const [antecedents, setAntecedents] = useState(() => getAntecedentsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
  const [exams, setExams] = useState(() => getExamsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
  const [historyEntries, setHistoryEntries] = useState(() => getHistoryForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));

  useEffect(() => {
    try {
      const savedAnt = localStorage.getItem(`cmu-antecedents-${activeCmuNumber}`);
      setAntecedents(savedAnt ? JSON.parse(savedAnt) : getAntecedentsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));

      const savedExams = localStorage.getItem(`cmu-exams-${activeCmuNumber}`);
      setExams(savedExams ? JSON.parse(savedExams) : getExamsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));

      const savedHist = localStorage.getItem(`cmu-history-${activeCmuNumber}`);
      setHistoryEntries(savedHist ? JSON.parse(savedHist) : getHistoryForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
    } catch (e) {
      console.warn("Storage load error:", e);
    }
  }, [activeCmuNumber, activeFirstName, isStudent, isBsf]);

  const handleUpdateAntecedents = (updated) => {
    setAntecedents(updated);
    try {
      localStorage.setItem(`cmu-antecedents-${activeCmuNumber}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleUpdateExams = (updatedExams) => {
    setExams(updatedExams);
    try {
      localStorage.setItem(`cmu-exams-${activeCmuNumber}`, JSON.stringify(updatedExams));
    } catch (e) {}
  };

  const handleUpdateHistory = (updatedHistory) => {
    setHistoryEntries(updatedHistory);
    try {
      localStorage.setItem(`cmu-history-${activeCmuNumber}`, JSON.stringify(updatedHistory));
    } catch (e) {}
  };

  // Modale Visionneuse DICOM
  const [viewingExam, setViewingExam] = useState(null);
  const [dicomZoom, setDicomZoom] = useState(1);
  const [dicomInvert, setDicomInvert] = useState(false);
  const [activeCliche, setActiveCliche] = useState(1);

  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamType, setNewExamType] = useState('Scanner');
  const [newExamFacility, setNewExamFacility] = useState('Laboratoire Bio24');
  const [newExamDoctor, setNewExamDoctor] = useState('');

  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [newHistoryActe, setNewHistoryActe] = useState('');
  const [newHistoryPraticien, setNewHistoryPraticien] = useState('');
  const [newHistoryConclusion, setNewHistoryConclusion] = useState('');

  const handleAddHistory = (e) => {
    e.preventDefault();
    if (!newHistoryActe) return;
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fr-FR'),
      acte: newHistoryActe,
      praticien: newHistoryPraticien || 'Non spécifié',
      conclusion: newHistoryConclusion || 'En attente de conclusions.'
    };
    handleUpdateHistory([newEntry, ...historyEntries]);
    setShowAddHistoryModal(false);
    setNewHistoryActe(''); setNewHistoryPraticien(''); setNewHistoryConclusion('');
    alert('✅ Entrée ajoutée à l\'historique médical !');
  };

  // Résultats Laboratoire Persistés & Isolés par assuré
  const getLabResultsForUser = (cmuNum, isStud, isBsfUser) => {
    if (isStud) {
      return [
        { id: 1, examen: 'Bilan sanguin de santé UCAD', resultat: '14.5 g/dL', reference: '12.0 - 16.0 g/dL', statut: 'Normal (Bilan UCAD)' },
        { id: 2, examen: 'Glycémie à jeun', resultat: '0.90 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' }
      ];
    }
    if (isBsfUser) {
      return [
        { id: 1, examen: 'Profil lipidique & BSF', resultat: '1.80 g/L', reference: '< 2.00 g/L', statut: 'Normal' },
        { id: 2, examen: 'Glycémie à jeun', resultat: '0.98 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal (Suivi BSF)' }
      ];
    }
    return [
      { id: 1, examen: 'Glycémie à jeun', resultat: '0.95 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' },
      { id: 2, examen: 'Hémoglobine (NFS)', resultat: '14.2 g/dL', reference: '12.0 - 16.0 g/dL', statut: 'Normal' }
    ];
  };

  const [labResults, setLabResults] = useState(() => getLabResultsForUser(activeCmuNumber, isStudent, isBsf));

  useEffect(() => {
    try {
      const savedLab = localStorage.getItem(`cmu-lab-${activeCmuNumber}`);
      setLabResults(savedLab ? JSON.parse(savedLab) : getLabResultsForUser(activeCmuNumber, isStudent, isBsf));
    } catch (e) {
      setLabResults(getLabResultsForUser(activeCmuNumber, isStudent, isBsf));
    }
  }, [activeCmuNumber, isStudent, isBsf]);

  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [newLabExamen, setNewLabExamen] = useState('');
  const [newLabResultat, setNewLabResultat] = useState('');
  const [newLabReference, setNewLabReference] = useState('');
  const [newLabStatut, setNewLabStatut] = useState('Normal');

  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExamTitle) return;
    const added = {
      id: Date.now(),
      title: newExamTitle,
      exam_type: newExamType,
      badge: 'HD DICOM',
      facility: newExamFacility,
      doctor: newExamDoctor || 'Non spécifié',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      conclusion: 'Examen enregistré et certifié.',
      cliches: 1,
      preview: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=400'
    };
    setExams([...exams, added]);
    setShowAddExamModal(false);
    setNewExamTitle('');
    setNewExamDoctor('');
    alert("✅ Examen DICOM / Rapport PDF ajouté avec succès !");
  };

  const handleSaveAntecedents = (e) => {
    e.preventDefault();
    setEditingAntecedents(false);
    alert("✅ Antécédents médicaux mis à jour et certifiés !");
  };

  const handleDownloadFullBooklet = () => {
    generateOfficialPdf({
      filename: `dossier_medical_partage_${activeLastName.toLowerCase()}.pdf`,
      docType: 'DOSSIER MÉDICAL PARTAGÉ CERTIFIÉ',
      title: 'Carnet de Santé Numérique & Bilan Médical',
      referenceNo: `DOSSIER-MED-${activeCmuNumber}`,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: 'Réseau Établissements Agréés Sénégal',
      details: [
        { label: 'Assurée Bénéficiaire', value: `${activeFirstName} ${activeLastName}` },
        { label: 'Groupe sanguin', value: `${antecedents.bloodGroup} (Rhésus positif)` },
        { label: 'Allergies & Alertes', value: antecedents.allergies },
        { label: 'Affections Longue Durée (ALD)', value: antecedents.chronicConditions },
        { label: 'Interventions Chirurgicales', value: antecedents.surgeries },
        { label: 'Examens DICOM Enregistrés', value: `${exams.length} examens certifiés (Scanner thoracique, IRM Cérébrale, Échocardiographie)` }
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
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
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

  // ── PHARMACIEN : accès refusé au dossier médical ──
  if (isPharmacist) {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="p-5 rounded-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 100%)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💊</div>
            <span className="badge mb-3 d-inline-block" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>Pharmacien Agréé UNAMUSC</span>
            <h2 className="fw-bold mb-3" style={{ color: '#fff', fontSize: '1.8rem' }}>Dossier Médical : Accès Non Autorisé</h2>
            <p className="mb-4" style={{ color: '#bfdbfe', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              En tant que pharmacien, vous n'avez pas accès au dossier médical de l'assuré. Votre espace est dédié à la validation et la délivrance des bons de commande médicaments.
            </p>
            <button className="btn btn-light fw-bold px-4 py-3" style={{ borderRadius: '12px', color: '#1e40af' }} onClick={() => (window.location.hash = '#/purchase-orders')}>
              💊 Accéder à mes Bons de Commande
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── AGENT (non superadmin) : vue administrative uniquement ──
  if (isAdminView) {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Bannière agent */}
          <div className="p-4 rounded-4 mb-4 d-flex align-items-center gap-3" style={{ background: 'linear-gradient(90deg, #1e3a5f 0%, #1d4ed8 100%)', borderRadius: '18px', color: '#fff' }}>
            <span style={{ fontSize: '2.2rem' }}>🛡️</span>
            <div className="d-flex flex-column gap-1">
              <strong className="d-block fw-bold" style={{ fontSize: '1.1rem' }}>Mode Agent Administratif : UNAMUSC</strong>
              <small className="d-block" style={{ opacity: 0.85, fontSize: '0.85rem' }}>Accès restreint : contrôle administratif uniquement. Le contenu médical détaillé est protégé par le secret médical.</small>
            </div>
          </div>

          {/* Statistiques administratives */}
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-card)', border: '2px solid #1d4ed8', borderRadius: '18px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📂</div>
                <h3 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Dossier</h3>
                <span className="badge bg-success px-3 py-2">CSU ACTIF</span>
                <div className="mt-2 small" style={{ color: 'var(--text-sub)' }}>Ref: {activeCmuNumber}</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
                <h3 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Examens</h3>
                <span className="fw-bold text-success" style={{ fontSize: '1.8rem' }}>{exams.length}</span>
                <div className="small" style={{ color: 'var(--text-sub)' }}>Certifiés CNOM/UNAMUSC</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                <h3 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Historique</h3>
                <span className="fw-bold text-success" style={{ fontSize: '1.8rem' }}>{historyEntries.length}</span>
                <div className="small" style={{ color: 'var(--text-sub)' }}>Consultations enregistrées</div>
              </div>
            </div>
          </div>

          {/* Infos administratives assuré */}
          <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
            <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📄 Informations administratives assuré</h5>
            <div className="row g-3">
              <div className="col-md-6">
                <small className="text-muted d-block">Assuré</small>
                <strong style={{ color: 'var(--text-main)' }}>{activeFirstName} {activeLastName}</strong>
              </div>
              <div className="col-md-6">
                <small className="text-muted d-block">N° Carte CSU</small>
                <code className="text-success fw-bold">{activeCmuNumber}</code>
              </div>
              <div className="col-12">
                <div className="p-3 rounded-3" style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderLeft: '4px solid #3b82f6' }}>
                  <strong className="d-block small text-primary">🔒 Contenu médical protégé</strong>
                  <small style={{ color: 'var(--text-sub)' }}>Le groupe sanguin, les allergies, les radiographies DICOM et résultats de laboratoire sont protégés par le secret médical. Seuls les professionnels de santé habilités peuvent y accéder.</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── NON CONNECTÉ : écran d'accès sécurisé ──
  if (!citizenUser && !agentUser && !partnerUser && userRole !== 'agent' && userRole !== 'partner' && userRole !== 'doctor' && userRole !== 'midwife' && userRole !== 'superadmin') {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header Banner */}
          <div className="p-5 rounded-4 text-center text-white mb-4" style={{
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.82) 0%, rgba(4, 120, 87, 0.88) 100%), url("/csu_profile_hero_real.png") center/cover no-repeat',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🩺</div>
            <span className="badge mb-2" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>
              Dossier médical partagé & radiographies DICOM
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#fff', fontSize: '2rem' }}>
              Espace confidentialité — données médicales protégées
            </h2>
            <p className="small mb-4" style={{ color: '#ecfdf5', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
              Les données contenues dans le dossier médical partagé (groupe sanguin, allergies, radiographies certifiées, examens de laboratoire) sont protégées par le secret médical. Veuillez vous connecter ou saisir votre code d'accès sécurisé.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-light fw-bold px-4 py-3" 
                style={{ borderRadius: '14px', color: '#047857', fontSize: '0.98rem', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                onClick={() => (window.location.hash = '#/login')}
              >
                🔐 Se connecter à mon dossier médical
              </button>
            </div>
          </div>

          {/* Quick OTP / CMU Card Verification */}
          <div className="card p-4 p-md-5 mb-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '2.25rem 2rem' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.75rem' }}>
              🔑 Accès praticien avec code OTP 24h ou n° CMU
            </h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-sub)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Si un patient vous a transmis un code de partage temporaire, saisissez son matricule d'assuré et le jeton OTP pour accéder à ses examens.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input 
                type="text" 
                className="form-control fw-bold" 
                placeholder="N° CMU (ex: CMU-DKR-2026-8812)"
                style={{ flex: 1, minWidth: '220px', height: '52px', fontSize: '0.95rem', borderRadius: '12px' }}
              />
              <input 
                type="text" 
                className="form-control fw-bold" 
                placeholder="Code OTP (ex: 849-201)"
                style={{ width: '180px', height: '52px', fontSize: '0.95rem', borderRadius: '12px' }}
              />
              <button 
                className="btn btn-success fw-bold px-4 py-3"
                style={{ borderRadius: '12px', background: '#059669', height: '52px', fontSize: '0.95rem' }}
                onClick={() => (window.location.hash = '#/login')}
              >
                🔓 Déverrouiller le dossier
              </button>
            </div>
          </div>

          {/* Standards & Certifications Grid */}
          <div className="grid grid-3" style={{ gap: '1.25rem' }}>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📁</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Interopérabilité DHIS2</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Dossier synchronisé avec le Système National d'Information Sanitaire du Ministère de la Santé du Sénégal.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🩻</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Clichés HD DICOM 3.0</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Visualisation haute définition des scanners, IRM et radiographies certifiées par des praticiens agréés.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🛡️</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Chiffrement AES-256</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Vos données personnelles de santé sont cryptées et inaccessibles sans votre autorisation préalable.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSuspended = (
    userRole === 'citizen_suspended' || 
    citizenUser?.status === 'suspended' || 
    citizenUser?.status === 'inactif' || 
    citizenUser?.status === 'suspendu' || 
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  if (isCitizen && isSuspended) {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès au dossier restreint : Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. La consultation de votre dossier médical partagé et la délivrance d'actes sont suspendues.
              <br />
              <strong className="d-block mt-2 text-danger">Veuillez régulariser votre cotisation et celui des membres de votre famille pour un montant de 10 500 FCFA.</strong>
            </p>

            <div className="d-flex justify-content-center gap-3">
              <button 
                type="button" 
                className="btn btn-emerald btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-2 shadow"
                style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', borderRadius: '16px', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)' }}
                onClick={() => {
                  localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                    cmuNumber: activeCmuNumber,
                    amount: 10500,
                    familyCount: 3,
                    firstName: activeFirstName,
                    lastName: activeLastName
                  }));
                  window.location.hash = '#payments';
                }}
              >
                💳 Renouveler ma cotisation (10 500 FCFA)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card Banner */}
        <div className="p-5 rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.35) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_profile_hero_real.png") center/cover no-repeat', padding: '3rem 2.5rem', minHeight: '220px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.25)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.18)', overflow: 'hidden' }}>
          <div className="d-flex flex-wrap gap-4" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 320px' }}>
              <span style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '0.4rem 0.95rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.85rem', border: '1px solid rgba(255,255,255,0.3)' }}>
                🇸🇳 Certifié CNOM & UNAMUSC Sénégal
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.1rem', letterSpacing: '-0.015em' }}>Dossier médical & radiographies certifiées</h1>
              <p className="text-white mb-0" style={{ fontSize: '1.02rem', maxWidth: '720px', lineHeight: '1.7', opacity: 0.95 }}>
                {isCitizen && 'Accédez en toute sécurité à vos antécédents, vos résultats de radiologie et téléchargez votre carnet de santé numérique certifié.'}
                {(isDoctor || isMidwife) && `Mode ${isDoctor ? 'médecin prescripteur' : 'sage-femme'} : Vous pouvez consulter, annoter et enrichir le dossier de votre patient.`}
                {isSuperAdmin && 'SuperAdmin : Accès total et contrôle complet du dossier médical partagé UNAMUSC.'}
              </p>
            </div>

            {/* Boutons d'action selon le rôle */}
            <div className="d-flex flex-column gap-3 w-100 mt-3" style={{ flex: '1 1 100%' }}>
              <div className="d-flex flex-wrap align-items-center" style={{ gap: '1rem', rowGap: '0.85rem' }}>
                {/* Télécharger PDF — disponible à tous les profils autorisés */}
                <button
                  type="button"
                  style={{ background: '#ffffff', color: '#047857', border: 'none', borderRadius: '12px', padding: '0.85rem 1.4rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={handleDownloadFullBooklet}
                >
                  📥 Télécharger le carnet PDF
                </button>

                {/* Partager avec médecin — citoyen et médecin seulement */}
                {(isCitizen || isDoctor || isMidwife || isSuperAdmin) && (
                  <button
                    type="button"
                    style={{ background: 'rgba(255,255,255,0.22)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '12px', padding: '0.85rem 1.4rem', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowShareModal(true)}
                  >
                    🔗 Partager avec mon médecin
                  </button>
                )}

                {/* Ajouter un examen — médecin, sage-femme, superadmin uniquement (l'assuré est en lecture seule) */}
                {canEditMedical && (
                  <button
                    type="button"
                    style={{ background: 'rgba(255,255,255,0.22)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '12px', padding: '0.85rem 1.4rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowAddExamModal(true)}
                  >
                    ➕ Ajouter un examen DICOM
                  </button>
                )}

                {/* Badge de rôle (lecture seule / mode médecin / superadmin) */}
                {isCitizen && (
                  <span style={{ background: 'rgba(0,0,0,0.3)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '12px', padding: '0.65rem 1.1rem', fontSize: '0.82rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    🔒 Lecture seule : modifications par votre médecin
                  </span>
                )}

                {(isDoctor || isMidwife) && (
                  <span style={{ background: 'rgba(0,0,0,0.3)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '12px', padding: '0.65rem 1.1rem', fontSize: '0.82rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    📝 Mode {isDoctor ? 'médecin prescripteur' : 'sage-femme'} : édition autorisée
                  </span>
                )}

                {isSuperAdmin && (
                  <span style={{ background: 'rgba(234,179,8,0.35)', color: '#fef08a', border: '1px solid rgba(234,179,8,0.5)', borderRadius: '12px', padding: '0.65rem 1.1rem', fontSize: '0.82rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    👑 SuperAdmin : accès total
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: VUE D'ENSEMBLE */}
        {activeTab === 'overview' && (
          <div className="row g-4 mb-4">
            
            {/* Left Column Cards */}
            <div className="col-lg-4">
              <div className="d-flex flex-column gap-4">
                
                {/* Groupe sanguin Card */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="d-flex align-items-center gap-2 text-danger">
                      <span style={{ fontSize: '1.2rem' }}>🩸</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Groupe sanguin</h6>
                    </div>
                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>Urgent</span>
                  </div>

                  <div className="d-flex align-items-center justify-content-center gap-3 my-3 p-3 rounded-3" style={{ background: 'rgba(239, 68, 68, 0.06)' }}>
                    <h1 className="fw-black text-danger mb-0" style={{ fontSize: '3rem', letterSpacing: '-0.03em', lineHeight: 1 }}>{antecedents.bloodGroup}</h1>
                    <div>
                      <div className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Rhésus {antecedents.rhesus}</div>
                      <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>Groupe sanguin certifié</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
                    <span style={{ fontSize: '0.85rem' }}>🏥</span>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                      Certifié par : <strong style={{ color: 'var(--text-main)' }}>Laboratoire Bio24, Dakar</strong>
                    </small>
                  </div>
                </div>

                {/* Allergies & alertes Card */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2 text-warning">
                      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Allergies & alertes</h6>
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
                      <div>
                        <label className="small fw-bold d-block mb-1" style={{ color: 'var(--text-sub)' }}>⚠️ Allergies (médicaments, aliments, environnement) :</label>
                        <textarea className="form-control small" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} value={antecedents.allergies} onChange={(e) => setAntecedents({ ...antecedents, allergies: e.target.value })} placeholder="Ex: Pénicilline (sévère), Pollen, Arachide..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-1" style={{ color: 'var(--text-sub)' }}>🏥 Affections longue durée (ALD) :</label>
                        <textarea className="form-control small" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} value={antecedents.chronicConditions} onChange={(e) => setAntecedents({ ...antecedents, chronicConditions: e.target.value })} placeholder="Ex: HTA, Diabète type 2, Drépanocytose..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-1" style={{ color: 'var(--text-sub)' }}>🔧 Interventions chirurgicales :</label>
                        <textarea className="form-control small" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} value={antecedents.surgeries || ''} onChange={(e) => setAntecedents({ ...antecedents, surgeries: e.target.value })} placeholder="Ex: Appendicectomie (2021), Césarienne (2018)..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-1" style={{ color: 'var(--text-sub)' }}>💊 Traitement en cours :</label>
                        <textarea className="form-control small" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} value={antecedents.currentTreatment || ''} onChange={(e) => setAntecedents({ ...antecedents, currentTreatment: e.target.value })} placeholder="Ex: Amlodipine 5mg (HTA), Metformine 500mg..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-1" style={{ color: 'var(--text-sub)' }}>💉 Vaccinations à jour :</label>
                        <input type="text" className="form-control small" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} value={antecedents.vaccinations || ''} onChange={(e) => setAntecedents({ ...antecedents, vaccinations: e.target.value })} placeholder="Ex: VAT à jour, Grippe 2025, COVID-3 doses" />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-1" style={{ color: 'var(--text-sub)' }}>📞 Contact d'urgence :</label>
                        <input type="text" className="form-control small" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} value={antecedents.emergencyContact || ''} onChange={(e) => setAntecedents({ ...antecedents, emergencyContact: e.target.value })} placeholder="Ex: Sokhna Diop (Épouse) : +221 77 987 65 43" />
                      </div>
                      <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.5rem', fontWeight: '700', marginTop: '0.5rem' }}>💾 Sauvegarder et certifier</button>
                    </form>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {antecedents.allergies.split(',').map((alg, idx) => (
                        <div key={`alg-${idx}`} className="p-3 rounded-3 d-flex align-items-center gap-2.5" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                          <span className="text-warning font-monospace" style={{ fontSize: '1.2rem' }}>●</span>
                          <span className="fw-bold small" style={{ color: 'var(--text-main)' }}>{alg.trim()}</span>
                        </div>
                      ))}
                      {antecedents.chronicConditions && (
                        <div className="p-3.5 rounded-3" style={{ background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                          <span className="fw-bold text-danger d-inline-block me-1" style={{ fontSize: '0.82rem' }}>🩺 Affection Longue Durée (ALD) : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{antecedents.chronicConditions}</span>
                        </div>
                      )}
                      {antecedents.surgeries && (
                        <div className="p-3.5 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                          <span className="fw-bold text-secondary d-inline-block me-1" style={{ fontSize: '0.82rem' }}>🔧 Interventions chirurgicales : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{antecedents.surgeries}</span>
                        </div>
                      )}
                      {antecedents.currentTreatment && (
                        <div className="p-3.5 rounded-3" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <span className="fw-bold text-primary d-inline-block me-1" style={{ fontSize: '0.82rem' }}>💊 Traitements en cours : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{antecedents.currentTreatment}</span>
                        </div>
                      )}
                      {antecedents.vaccinations && (
                        <div className="p-3.5 rounded-3" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          <span className="fw-bold text-success d-inline-block me-1" style={{ fontSize: '0.82rem' }}>💉 Statut vaccinal : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{antecedents.vaccinations}</span>
                        </div>
                      )}
                      {antecedents.emergencyContact && (
                        <div className="p-3.5 rounded-3 d-flex align-items-center gap-3" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid rgba(239, 68, 68, 0.25)' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#ef4444', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, boxShadow: '0 3px 10px rgba(239,68,68,0.3)' }}>
                            📞
                          </div>
                          <div>
                            <small className="fw-extrabold text-danger d-block text-uppercase mb-1" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                              Contact d'urgence :
                            </small>
                            <span className="small fw-bold d-block" style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: '1.4' }}>
                              {antecedents.emergencyContact}
                            </span>
                          </div>
                        </div>
                      )}
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
                        <div style={{ width: '36px', height: '36px', background: '#059669', color: '#ffffff', fontWeight: '700', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>F</div>
                        <div>
                          <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>Hôpital Fann</strong>
                          <small className="fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>ID DHIS2 : FANN-77291</small>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: '8px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: '700' }}>✓ Synchronisé</span>
                    </div>

                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '36px', height: '36px', background: '#dc2626', color: '#ffffff', fontWeight: '700', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>LD</div>
                        <div>
                          <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>Le Dantec</strong>
                          <small className="fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>ID DHIS2 : LD-091823</small>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: '8px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: '700' }}>✓ Synchronisé</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Radiographies & examens certifiés Grid */}
            <div className="col-lg-8">
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.3rem' }}>🩻</span>
                    <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Radiographies & examens certifiés</h5>
                  </div>
                </div>

                {/* Exam Cards Grid */}
                <div className="row g-3">
                  {exams.filter(ex => {
                    if (!searchTerm.trim()) return true;
                    const q = searchTerm.toLowerCase();
                    return ex.title.toLowerCase().includes(q) || ex.exam_type.toLowerCase().includes(q) || ex.facility.toLowerCase().includes(q) || (ex.doctor && ex.doctor.toLowerCase().includes(q));
                  }).map(ex => (
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
                          <small className="text-muted d-block mb-2">{ex.facility} • {ex.doctor}</small>
                          <p className="small text-secondary mb-0" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>{ex.conclusion}</p>
                        </div>

                        <div className="p-3 border-top d-flex align-items-center justify-content-between" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-success fw-bold"
                            style={{ borderRadius: '8px', fontSize: '0.8rem' }}
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
                      <div className="d-flex flex-column align-items-center gap-1 text-center">
                        <strong className="fw-extrabold d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>
                          Ajouter un examen :
                        </strong>
                        <span className="small text-muted d-block fw-semibold" style={{ fontSize: '0.88rem' }}>
                          (Fichier PDF ou DICOM)
                        </span>
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
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>📜 Historique Médical Complet</h5>
              <button 
                type="button" 
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                onClick={() => setShowAddHistoryModal(true)}
              >
                ➕ Ajouter une entrée
              </button>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th>DATE</th>
                    <th>ACTE / CONSULTATION</th>
                    <th>PRATICIEN / STRUCTURE</th>
                    <th>CONCLUSION</th>
                    <th className="text-end">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map(h => (
                    <tr key={h.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ color: 'var(--text-sub)' }}>{h.date}</td>
                      <td className="fw-bold" style={{ color: 'var(--text-main)' }}>{h.acte}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{h.praticien}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{h.conclusion}</td>
                      <td className="text-end">
                        <button 
                          type="button" 
                          style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                          onClick={() => {
                            if (window.confirm('Supprimer cette entrée de l\'historique ?')) {
                              setHistoryEntries(historyEntries.filter(item => item.id !== h.id));
                            }
                          }}
                        >
                          🗑 Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyEntries.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4" style={{ color: 'var(--text-sub)' }}>Aucune entrée dans l'historique médical.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LABORATOIRE */}
        {activeTab === 'lab' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🧪 Résultats d'Analyses Biologiques</h5>
              <button 
                type="button" 
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                onClick={() => setShowAddLabModal(true)}
              >
                ➕ Ajouter un résultat
              </button>
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th>EXAMEN</th>
                    <th>RÉSULTAT</th>
                    <th>VALEURS DE RÉFÉRENCE</th>
                    <th>STATUT</th>
                    <th className="text-end">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {labResults.map(lr => (
                    <tr key={lr.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="fw-bold" style={{ color: 'var(--text-main)' }}>{lr.examen}</td>
                      <td className={lr.statut === 'Normal' ? 'text-success fw-bold' : 'text-danger fw-bold'}>{lr.resultat}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{lr.reference}</td>
                      <td>
                        <span style={{ 
                          background: lr.statut === 'Normal' ? 'rgba(16,185,129,0.2)' : lr.statut === 'Élevé' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', 
                          color: lr.statut === 'Normal' ? '#10b981' : lr.statut === 'Élevé' ? '#ef4444' : '#f59e0b', 
                          padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' 
                        }}>
                          {lr.statut}
                        </span>
                      </td>
                      <td className="text-end">
                        <button 
                          type="button" 
                          style={{ background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: 'none', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                          onClick={() => {
                            if (window.confirm('Supprimer ce résultat ?')) {
                              setLabResults(labResults.filter(item => item.id !== lr.id));
                            }
                          }}
                        >
                          🗑 Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {labResults.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4" style={{ color: 'var(--text-sub)' }}>Aucun résultat d'analyse enregistré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* DICOM VIEWING MODAL (React Portal — Centered on Screen) */}
      {viewingExam && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1100px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
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
        </div>,
        document.body
      )}

      {/* SHARE MODAL (React Portal — Centered on Screen) */}
      {showShareModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
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
        </div>,
        document.body
      )}

      {/* ADD EXAM MODAL (React Portal — Centered on Screen) */}
      {showAddExamModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddExam} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
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

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Médecin Prescripteur</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newExamDoctor} onChange={(e) => setNewExamDoctor(e.target.value)} placeholder="Ex: Dr. Aminata Ndiaye" />
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: '700' }} onClick={() => setShowAddExamModal(false)}>Annuler</button>
              <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>Ajouter l'examen</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ADD HISTORY MODAL (React Portal) */}
      {showAddHistoryModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddHistory} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">➕ Ajouter une entrée à l'Historique</h5>
              <button type="button" className="btn-close" onClick={() => setShowAddHistoryModal(false)}></button>
            </div>
            
            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Acte / Consultation *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newHistoryActe} onChange={(e) => setNewHistoryActe(e.target.value)} placeholder="Ex: Consultation Généraliste" required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Praticien / Structure</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newHistoryPraticien} onChange={(e) => setNewHistoryPraticien(e.target.value)} placeholder="Ex: Dr. Ousmane Sow" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Conclusion</label>
              <textarea className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} rows={3} value={newHistoryConclusion} onChange={(e) => setNewHistoryConclusion(e.target.value)} placeholder="Ex: Bilan normal. Ordonnance émise." />
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: '700' }} onClick={() => setShowAddHistoryModal(false)}>Annuler</button>
              <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>Ajouter</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ADD LAB RESULT MODAL (React Portal) */}
      {showAddLabModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!newLabExamen) return;
            setLabResults([{ id: Date.now(), examen: newLabExamen, resultat: newLabResultat, reference: newLabReference, statut: newLabStatut }, ...labResults]);
            setShowAddLabModal(false);
            setNewLabExamen(''); setNewLabResultat(''); setNewLabReference(''); setNewLabStatut('Normal');
            alert('✅ Résultat d\'analyse ajouté avec succès !');
          }} style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">➕ Ajouter un Résultat d'Analyse</h5>
              <button type="button" className="btn-close" onClick={() => setShowAddLabModal(false)}></button>
            </div>
            
            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Nom de l'examen *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newLabExamen} onChange={(e) => setNewLabExamen(e.target.value)} placeholder="Ex: Créatinine, Cholestérol..." required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Résultat</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newLabResultat} onChange={(e) => setNewLabResultat(e.target.value)} placeholder="Ex: 0.95 g/L" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Valeurs de référence</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newLabReference} onChange={(e) => setNewLabReference(e.target.value)} placeholder="Ex: 0.70 - 1.10 g/L" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Statut</label>
              <select className="form-select" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }} value={newLabStatut} onChange={(e) => setNewLabStatut(e.target.value)}>
                <option value="Normal">🟢 Normal</option>
                <option value="Élevé">🔴 Élevé</option>
                <option value="Bas">🟡 Bas</option>
              </select>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: '700' }} onClick={() => setShowAddLabModal(false)}>Annuler</button>
              <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>Ajouter</button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
}
