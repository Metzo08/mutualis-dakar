import React, { useState, useEffect } from 'react';

export default function MedicalProfile({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null }) {
  // Identification du rôle et accès
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);
  const isSuperAdmin = (userRole === 'admin' || userRole === 'superadmin' || agentUser?.role === 'superadmin' || agentUser?.email?.includes('admin'));

  // Praticiens habilités par le Super Admin (synchro localStorage)
  const defaultAccreditedDoctors = [
    { id: 1, name: 'Dr. Aminata Ndiaye', specialty: 'Pédiatrie & Santé Familiale', cnom: 'CNOM-SN-2026-8819' },
    { id: 2, name: 'Dr. Cheikh Tidiane Seck', specialty: 'Cardiologie & Médecine Générale', cnom: 'CNOM-SN-2026-9921' },
    { id: 3, name: 'Dr. Mariama Ba', specialty: 'Gynécologie-Obstétrique', cnom: 'CNOM-SN-2026-3310' }
  ];

  const [accreditedDoctors, setAccreditedDoctors] = useState(() => {
    try {
      const stored = localStorage.getItem('cmu_telemed_doctors');
      return stored ? JSON.parse(stored) : defaultAccreditedDoctors;
    } catch (e) {
      return defaultAccreditedDoctors;
    }
  });

  const [activeDoctorAccount, setActiveDoctorAccount] = useState(accreditedDoctors[0]?.name || 'Dr. Aminata Ndiaye');

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
  const [editingNotes, setEditingNotes] = useState('');

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

  // Modale Super Admin - Code Patient Hospitalier
  const [showAddCodeModal, setShowAddCodeModal] = useState(false);
  const [newHospitalCode, setNewHospitalCode] = useState({
    system_name: '',
    external_patient_code: ''
  });

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const storedLocalExams = JSON.parse(localStorage.getItem('cmu_medical_imaging') || '[]');
      const storedLocalCodes = JSON.parse(localStorage.getItem('cmu_hospital_codes') || '[]');

      const mergedExams = [...storedLocalExams, ...defaultProfile.imaging];
      const mergedCodes = [...storedLocalCodes, ...defaultProfile.externalCodes];

      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}`);
      const json = await res.json();

      if (json.success && json.data && json.data.antecedents) {
        setProfileData({
          ...json.data,
          imaging: [...storedLocalExams, ...(json.data.imaging || defaultProfile.imaging)],
          externalCodes: [...storedLocalCodes, ...(json.data.externalCodes || defaultProfile.externalCodes)]
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
          imaging: mergedExams,
          externalCodes: mergedCodes
        });
      }
    } catch (err) {
      console.warn('Utilisation des antécédents de démonstration:', err);
      const storedLocalExams = JSON.parse(localStorage.getItem('cmu_medical_imaging') || '[]');
      const storedLocalCodes = JSON.parse(localStorage.getItem('cmu_hospital_codes') || '[]');
      setProfileData({
        ...defaultProfile,
        imaging: [...storedLocalExams, ...defaultProfile.imaging],
        externalCodes: [...storedLocalCodes, ...defaultProfile.externalCodes]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Sauvegarde des Antécédents par le Médecin
  const handleSaveAntecedents = async (e) => {
    e.preventDefault();
    if (!isAgent) {
      alert('🔒 Seul le Médecin Habilité peut mettre à jour le dossier médical.');
      return;
    }

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
          emergency_contact_phone: emergencyPhone,
          updated_by: activeDoctorAccount
        })
      });
    } catch (err) {
      console.warn(err);
    }
    setSavedMsg(`✅ Antécédents médicaux certifiés et enregistrés par le ${activeDoctorAccount} dans le Dossier Médical Partagé.`);
  };

  // Ajout d'une radio, scanner ou analyse par un prestataire / médecin
  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExam.title || !newExam.doctor_notes) {
      alert('Veuillez remplir le titre et le compte-rendu de l\'examen.');
      return;
    }

    const doctorNameStr = activeDoctorAccount || newExam.provider_name || 'Dr. Aminata Ndiaye';

    const createdExam = {
      id: Date.now(),
      title: newExam.title,
      exam_type: newExam.exam_type,
      provider_name: doctorNameStr,
      exam_date: new Date(newExam.exam_date).toISOString(),
      doctor_notes: newExam.doctor_notes,
      cliche_count: 3,
      status: 'Validé & Certifié par le Praticien'
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
    setSavedMsg(`L'examen "${createdExam.title}" (${createdExam.exam_type}) a été certifié par ${doctorNameStr} et ajouté au dossier.`);
  };

  // Mise à jour du compte-rendu médical direct par le médecin dans la modale DICOM
  const handleSaveExamNotesByDoctor = () => {
    if (!viewingExam) return;
    const updatedImaging = profileData.imaging.map(img => 
      img.id === viewingExam.id ? { ...img, doctor_notes: editingNotes, provider_name: activeDoctorAccount } : img
    );

    setProfileData(prev => ({ ...prev, imaging: updatedImaging }));
    localStorage.setItem('cmu_medical_imaging', JSON.stringify(updatedImaging));
    setViewingExam(prev => ({ ...prev, doctor_notes: editingNotes, provider_name: activeDoctorAccount }));
    setSavedMsg(`✅ Compte-rendu médical pour "${viewingExam.title}" mis à jour et certifié par ${activeDoctorAccount}.`);
  };

  // Ajout d'un Code Patient Hospitalier Interopérable (Exclusivité Super Admin)
  const handleAddHospitalCodeSuperAdmin = (e) => {
    e.preventDefault();
    if (!newHospitalCode.system_name || !newHospitalCode.external_patient_code) return;

    const createdCode = {
      id: Date.now(),
      system_name: newHospitalCode.system_name,
      external_patient_code: newHospitalCode.external_patient_code
    };

    const existingCodes = JSON.parse(localStorage.getItem('cmu_hospital_codes') || '[]');
    const updatedCodes = [createdCode, ...existingCodes];
    localStorage.setItem('cmu_hospital_codes', JSON.stringify(updatedCodes));

    setProfileData(prev => ({
      ...prev,
      externalCodes: [createdCode, ...prev.externalCodes]
    }));

    setShowAddCodeModal(false);
    setNewHospitalCode({ system_name: '', external_patient_code: '' });
    setSavedMsg(`🔗 Code Patient Hospitalier "${createdCode.external_patient_code}" lié avec succès par le Super Admin.`);
  };

  // Impression / Téléchargement du Carnet de Santé A4 PDF (Assuré)
  const handlePrintMedicalRecordPDF = () => {
    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const name = citizenData.firstName ? `${citizenData.firstName} ${citizenData.lastName}` : 'Awa Ndiaye';
    const cmuNum = citizenData.cmuNumber || 'CMU-DKR-2026-8812';

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dossier_Medical_Certifie_${cmuNum}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #059669; border-radius: 16px; padding: 2rem; background: #ffffff; }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer le Carnet de Santé A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="cert-box">
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0" style="color: #059669;">République du Sénégal</h6>
                  <small class="text-muted">Un Peuple — Un But — Une Foi</small><br />
                  <strong class="small" style="color: #0f172a;">UNAMUSC Sénégal — Dossier médical informatisé (DMI)</strong>
                </div>
              </div>
              <img src="/unamusc_logo.png" alt="UNAMUSC" style="width: 85px; height: auto;" />
            </div>

            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold mb-1" style="color: #059669;">Carnet de santé numérique & antécédents certifiés</h4>
              <small class="text-muted">Extrait officiel certifié au ${new Date().toLocaleDateString('fr-FR')}</small>
            </div>

            <div class="row g-3 mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block text-muted">Assuré bénéficiaire :</span>
                <h5 class="fw-bold mb-0">${name}</h5>
                <small class="text-muted">N° Carte CMU : <strong>${cmuNum}</strong></small>
              </div>
              <div class="col-6 text-end">
                <span class="small fw-bold d-block text-muted">Groupe sanguin & rhésus :</span>
                <h4 class="fw-bold text-danger mb-0">${bloodGroup}</h4>
                <span class="badge bg-success">Antécédents certifiés CNOM</span>
              </div>
            </div>

            <h6 class="fw-bold mb-2" style="color: #059669;">🩺 Synthèse des antécédents médicaux :</h6>
            <table class="table table-bordered mb-4">
              <tbody>
                <tr>
                  <th style="width: 35%; background: #f8fafc;">Allergies majeures :</th>
                  <td><strong class="text-danger">${allergies || 'Aucune connue'}</strong></td>
                </tr>
                <tr>
                  <th style="background: #f8fafc;">Pathologies chroniques (ALD) :</th>
                  <td><strong>${chronicConditions || 'Aucune'}</strong></td>
                </tr>
                <tr>
                  <th style="background: #f8fafc;">Chirurgies & interventions passées :</th>
                  <td>${pastSurgeries || 'Aucune'}</td>
                </tr>
                <tr>
                  <th style="background: #f8fafc;">Contact d'urgence :</th>
                  <td>${emergencyName} (${emergencyPhone})</td>
                </tr>
              </tbody>
            </table>

            <h6 class="fw-bold mb-2" style="color: #059669;">🩻 Historique d'imagerie & analyses certifiées :</h6>
            <table class="table table-striped table-bordered mb-4">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Examen & Intitulé</th>
                  <th>Etablissement / Praticien</th>
                  <th>Date</th>
                  <th>Conclusion médicale</th>
                </tr>
              </thead>
              <tbody>
                ${profileData.imaging.map(img => `
                  <tr>
                    <td><strong>${img.title}</strong> (${img.exam_type})</td>
                    <td>${img.provider_name}</td>
                    <td>${new Date(img.exam_date).toLocaleDateString('fr-FR')}</td>
                    <td><small>${img.doctor_notes}</small></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="row align-items-center border-top pt-4">
              <div class="col-8">
                <strong class="small text-success d-block mb-1">Authentification officielle UNAMUSC :</strong>
                <p class="small text-muted mb-0">Ce document médical chiffré fait foi auprès des structures hospitalières et officines agréées au Sénégal.</p>
              </div>
              <div class="col-4 text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`DMP-2026-${cmuNum}`)}" alt="QR Code" style="width: 75px; height: 75px;" />
                <div class="small fw-bold text-success mt-1">Signature numérique CNOM</div>
              </div>
            </div>
          </div>
          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Téléchargement du Rapport PDF d'Examen Certifié (Modale DICOM)
  const handleDownloadExamReportPDF = (exam) => {
    if (!exam) return;
    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const patientName = citizenData.firstName ? `${citizenData.firstName} ${citizenData.lastName}` : 'Awa Ndiaye';
    const cmuNum = citizenData.cmuNumber || 'CMU-DKR-2026-8812';

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport_Medical_${exam.exam_type}_${cmuNum}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #059669; border-radius: 16px; padding: 2rem; background: #ffffff; }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer le Rapport PDF A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="cert-box">
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0" style="color: #059669;">République du Sénégal</h6>
                  <small class="text-muted">Un Peuple — Un But — Une Foi</small><br />
                  <strong class="small" style="color: #0f172a;">UNAMUSC Sénégal — Rapport médical d'examen & imagerie</strong>
                </div>
              </div>
              <img src="/unamusc_logo.png" alt="UNAMUSC" style="width: 85px; height: auto;" />
            </div>

            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold mb-1" style="color: #059669;">Rapport officiel d'examen : ${exam.title}</h4>
              <small class="text-muted">Type : <strong>${exam.exam_type}</strong> • Réalisé le : <strong>${new Date(exam.exam_date).toLocaleDateString('fr-FR')}</strong></small>
            </div>

            <div class="row g-3 mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block text-muted">Assuré bénéficiaire :</span>
                <h5 class="fw-bold mb-0">${patientName}</h5>
                <small class="text-muted">N° Carte CMU : <strong>${cmuNum}</strong></small>
              </div>
              <div class="col-6 text-end">
                <span class="small fw-bold d-block text-muted">Praticien / structure :</span>
                <h5 class="fw-bold mb-0 text-success">${exam.provider_name}</h5>
                <span class="badge bg-success">Certifié CNOM</span>
              </div>
            </div>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #059669;">📋 COMPTE-RENDU & CONCLUSION DIAGNOSTIQUE DU PRATICIEN :</h6>
            <div class="p-4 border rounded-3 mb-4 bg-light fw-bold" style="font-size: 1.05rem; line-height: 1.8; color: #0f172a;">
              ${exam.doctor_notes || 'Aucun compte-rendu médical disponible.'}
            </div>

            <div class="row align-items-center border-top pt-4">
              <div class="col-8">
                <strong class="small text-success d-block mb-1">Authentification Officielle UNAMUSC :</strong>
                <p class="small text-muted mb-0">Ce document médical fait foi et est archivé de manière chiffrée dans le Dossier Médical Partagé du patient.</p>
              </div>
              <div class="col-4 text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`REPORT-${exam.id}-${cmuNum}`)}" alt="QR Code" style="width: 75px; height: 75px;" />
                <div class="small fw-bold text-success mt-1">Signature Numérique Praticien</div>
              </div>
            </div>
          </div>
          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Impression du Cliché HD DICOM (Modale DICOM)
  const handlePrintDicomClicheHD = (exam, clicheIndex = 1, isInverted = false) => {
    if (!exam) return;
    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const patientName = citizenData.firstName ? `${citizenData.firstName} ${citizenData.lastName}` : 'Awa Ndiaye';
    const cmuNum = citizenData.cmuNumber || 'CMU-DKR-2026-8812';

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cliche_DICOM_${exam.exam_type}_${cmuNum}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1rem; }
            .cliche-box { background: #0f172a; color: #ffffff; border-radius: 16px; padding: 2.5rem; text-align: center; border: 3px solid #059669; filter: ${isInverted ? 'invert(1)' : 'none'}; }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer le Cliché HD A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
            <div class="d-flex align-items-center gap-3">
              <img src="/senegal_flag.png" alt="Drapeau" style="width: 45px; height: 30px; object-fit: cover; border-radius: 4px;" />
              <div>
                <h6 class="fw-bold mb-0 text-uppercase" style="color: #059669;">UNAMUSC SÉNÉGAL — IMAGERIE RADIOLOGIQUE DICOM 3.0</h6>
                <small class="text-muted">Assuré : <strong>${patientName}</strong> (${cmuNum})</small>
              </div>
            </div>
            <span class="badge bg-success px-3 py-2">Cliché HD ${clicheIndex} / ${exam.cliche_count || 3}</span>
          </div>

          <div class="cliche-box my-3">
            <span style="font-size: 6rem;">${exam.exam_type === 'Analyse' ? '🧪' : exam.exam_type === 'Radio' ? '🩻' : '🦴'}</span>
            <h3 class="fw-bold mt-3 text-white">${exam.title}</h3>
            <p className="text-info mb-0">${exam.provider_name}</p>
            <small className="text-white-50">Matrice DICOM 1080p High Resolution • Identifiant Cliché : DICOM-${exam.id}-${clicheIndex}</small>
          </div>

          <div class="p-3 border rounded-3 bg-light mb-3">
            <strong class="text-success d-block mb-1">Conclusion Diagnostique du Radiologue :</strong>
            <p class="mb-0 small">${exam.doctor_notes}</p>
          </div>

          <div class="d-flex justify-content-between align-items-center border-top pt-3">
            <small class="text-muted">Fait le ${new Date(exam.exam_date).toLocaleDateString('fr-FR')} • Signature Numérique Praticien</small>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(`DICOM-${exam.id}-${cmuNum}`)}" alt="QR" style="width: 55px; height: 55px;" />
          </div>
          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(4, 120, 87, 0.92)), url("/csu_profile_hero_real.png") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 15px 30px -10px rgba(5, 150, 105, 0.4)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1.5 mb-3 fw-bold d-inline-block text-center shadow-sm"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(6px)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              border: '1px solid rgba(255, 255, 255, 0.4)'
            }}
          >
            🩺 Dossier Médical Partagé (DMP) — Antécédents, Radios & Biologie Certifiés CNOM
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2.2rem', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Tére fajj bu féex (Dossier médical & antécédents)' : 'Dossier Médical, Antécédents & Radiographies'}
          </h1>
          <p className="mb-4 text-white-50 text-center mx-auto" style={{ fontSize: '1.02rem', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)', maxWidth: '750px' }}>
            {isAgent
              ? 'Mode Praticien Habilité : Enrichissez le dossier médical du patient après consultation et téléversez les examens d\'imagerie.'
              : 'Espace Assuré (Mode Lecture Seule) : Consultez vos antécédents, vos radiographies et téléchargez votre carnet de santé numérique certifié.'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            {isAgent && (
              <button 
                type="button"
                className="btn fw-bold text-white shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0.7rem 1.4rem',
                  fontSize: '0.92rem'
                }}
                onClick={() => setShowAddExamModal(true)}
              >
                ➕ Ajouter une analyse, radio ou rapport médical
              </button>
            )}

            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm"
              style={{
                background: 'rgba(255, 255, 255, 0.22)',
                border: '1.5px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.7rem 1.4rem',
                fontSize: '0.92rem'
              }}
              onClick={handlePrintMedicalRecordPDF}
            >
              🖨️ Imprimer / Télécharger le Carnet de Santé PDF A4
            </button>
          </div>
        </div>
      </section>

      {/* SÉLECTEUR DE COMPTE PRATICIEN SI MODE AGENT / MÉDECIN */}
      {isAgent && (
        <div className="card p-3 mb-4 rounded-4 shadow-sm border" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary px-3 py-2 fw-bold">👨‍⚕️ COMPTE PRATICIEN HABILITÉ (SUPER ADMIN)</span>
              <span className="small text-muted">Praticien actuellement connecté pour la saisie :</span>
            </div>
            <select 
              className="form-select form-select-sm fw-bold border-primary"
              value={activeDoctorAccount}
              onChange={(e) => setActiveDoctorAccount(e.target.value)}
              style={{ borderRadius: '10px', maxWidth: '280px' }}
            >
              {accreditedDoctors.map(doc => (
                <option key={doc.id} value={doc.name}>
                  👨‍⚕️ {doc.name} ({doc.specialty})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
            <div className="card shadow-sm border-0 p-4 mb-4 h-100" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <span>🩸</span> Groupe Sanguin & Antécédents
                </h4>
                {isAgent ? (
                  <span className="badge bg-success">✏️ Écriture Praticien</span>
                ) : (
                  <span className="badge bg-secondary text-white">🔒 Lecture Seule (Assuré)</span>
                )}
              </div>
              
              <p className="small text-muted mb-4" style={{ fontSize: '0.88rem' }}>
                {isAgent 
                  ? 'En tant que médecin accrédité par le Super Admin, vous pouvez enrichir et enregistrer les antécédents médicaux certifiés du patient.' 
                  : 'Ces données d\'urgence sont certifiées par votre médecin et enregistrées dans votre dossier médical partagé.'}
              </p>

              <form onSubmit={handleSaveAntecedents}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Groupe sanguin & Rhésus</label>
                  <select 
                    className="form-select input fw-bold p-2.5" 
                    value={bloodGroup} 
                    onChange={(e) => setBloodGroup(e.target.value)}
                    disabled={!isAgent}
                    style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)' }}
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
                    className="form-control input p-2.5" 
                    placeholder="Ex: Pénicilline, Aspirine, Pollen..." 
                    value={allergies} 
                    onChange={(e) => setAllergies(e.target.value)}
                    disabled={!isAgent}
                    style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Affections de longue durée (ALD) / Pathologies chroniques</label>
                  <input 
                    type="text" 
                    className="form-control input p-2.5" 
                    placeholder="Ex: Hypertension, Diabète, Asthme..." 
                    value={chronicConditions} 
                    onChange={(e) => setChronicConditions(e.target.value)}
                    disabled={!isAgent}
                    style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Chirurgies & Interventions passées</label>
                  <input 
                    type="text" 
                    className="form-control input p-2.5" 
                    placeholder="Ex: Appendicectomie (2021)..." 
                    value={pastSurgeries} 
                    onChange={(e) => setPastSurgeries(e.target.value)}
                    disabled={!isAgent}
                    style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                  />
                </div>

                <div className="row g-2 mb-4">
                  <div className="col-6">
                    <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Contact d'urgence (Nom)</label>
                    <input 
                      type="text" 
                      className="form-control input p-2.5" 
                      value={emergencyName} 
                      onChange={(e) => setEmergencyName(e.target.value)}
                      disabled={!isAgent}
                      style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold" style={{ color: 'var(--text-main)' }}>Téléphone d'urgence</label>
                    <input 
                      type="text" 
                      className="form-control input p-2.5" 
                      value={emergencyPhone} 
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      disabled={!isAgent}
                      style={{ borderRadius: '12px', background: 'var(--bg-body)', color: 'var(--text-main)' }}
                    />
                  </div>
                </div>

                {isAgent ? (
                  <button 
                    type="submit" 
                    className="btn text-white fw-bold px-4 py-2.5 w-100 shadow-sm" 
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', borderRadius: '12px' }}
                  >
                    💾 Enregistrer & Certifier les Antécédents (Praticien)
                  </button>
                ) : (
                  <div className="alert alert-secondary py-2 text-center small mb-0 rounded-3">
                    🔒 Mode Lecture Seule : Seul votre médecin traitant accrédité peut certifier et modifier ces antécédents.
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Examens d'imagerie & Analyses de laboratoire */}
          <div className="col-md-6">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <span>🩻</span> Examens d'imagerie & Analyses
                </h4>
                {isAgent && (
                  <button 
                    type="button"
                    className="btn btn-sm text-white fw-bold px-3 py-1.5"
                    style={{ background: '#059669', border: 'none', borderRadius: '10px' }}
                    onClick={() => setShowAddExamModal(true)}
                  >
                    ➕ Saisir un Examen (Médecin)
                  </button>
                )}
              </div>

              {profileData?.imaging?.length === 0 ? (
                <div className="text-center py-4 text-muted">Aucun résultat de radio, scanner ou analyse téléversé.</div>
              ) : (
                <div className="list-group">
                  {profileData?.imaging?.map((img) => (
                    <div key={img.id} className="list-group-item p-3 mb-2 rounded-4 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
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
                        style={{ borderRadius: '10px', background: '#059669', border: 'none' }}
                        onClick={() => {
                          setViewingExam(img);
                          setDicomZoom(1);
                          setDicomInvert(false);
                          setActiveCliche(1);
                          setEditingNotes(img.doctor_notes || '');
                        }}
                      >
                        👁️ Consulter / Éditer la Visionneuse DICOM & Rapport PDF
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Code Patient Hospitalier Interopérable (EXCLUSIVITÉ SUPER ADMIN) */}
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <span>🔗</span> Code Patient Hospitalier Interopérable
                </h4>
                {isSuperAdmin ? (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-primary fw-bold px-3 py-1.5"
                    style={{ borderRadius: '10px' }}
                    onClick={() => setShowAddCodeModal(true)}
                  >
                    ➕ Lier Code Hospitalier (Super Admin)
                  </button>
                ) : (
                  <span className="badge bg-secondary">🔒 Gestion Exclusive Super Admin</span>
                )}
              </div>

              <p className="small text-muted mb-3" style={{ fontSize: '0.88rem' }}>
                Identifiants hospitaliers uniques (IPP / DHIS2) liés aux structures publiques et privées du Sénégal par la direction du Super Admin.
              </p>

              {profileData?.externalCodes?.length === 0 ? (
                <div className="badge bg-secondary p-2">Aucun code hospitalier associé pour le moment.</div>
              ) : (
                <ul className="list-group">
                  {profileData?.externalCodes?.map((code) => (
                    <li key={code.id} className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                      <div>
                        <strong style={{ color: 'var(--text-main)' }}>{code.system_name}</strong>
                        <br />
                        <code className="text-success fw-bold fs-6">{code.external_patient_code}</code>
                      </div>
                      <span className="badge bg-success px-2.5 py-1">Validé par Super Admin</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODALE 1 : Visionneuse d'imagerie médicale & Rapport PDF (Saisie Médecin & Impression PDF) */}
      {viewingExam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold" style={{ color: 'var(--text-main)' }}>
                  🩻 Visionneuse DICOM & Rapport PDF — {viewingExam.title}
                </h5>
                <button className="btn-close" onClick={() => setViewingExam(null)}></button>
              </div>
              
              <div className="modal-body p-4 text-center">
                {/* Visualiseur de cliché DICOM HD */}
                <div 
                  className="p-4 rounded-4 mb-3 position-relative overflow-hidden" 
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
                </div>

                {/* Contrôles DICOM (Zoom, Contraste) - Non Inversés */}
                <div className="d-flex justify-content-center gap-2 mb-3 flex-wrap">
                  <button 
                    type="button" 
                    className="btn btn-sm text-white fw-bold shadow-sm" 
                    style={{ background: '#0f172a', border: '1.5px solid #059669', borderRadius: '10px', padding: '0.45rem 0.85rem' }} 
                    onClick={() => setDicomZoom(prev => Math.min(prev + 0.2, 1.8))}
                  >
                    🔍 Zoom +
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-sm text-white fw-bold shadow-sm" 
                    style={{ background: '#0f172a', border: '1.5px solid #64748b', borderRadius: '10px', padding: '0.45rem 0.85rem' }} 
                    onClick={() => setDicomZoom(1)}
                  >
                    🔄 Reset
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-sm text-white fw-bold shadow-sm" 
                    style={{ background: dicomInvert ? '#059669' : '#0f172a', border: '1.5px solid #059669', borderRadius: '10px', padding: '0.45rem 0.85rem' }} 
                    onClick={() => setDicomInvert(prev => !prev)}
                  >
                    🌗 {dicomInvert ? 'Inversé (Négatif Actif)' : 'Filtre Négatif'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-sm text-white fw-bold shadow-sm" 
                    style={{ background: '#0f172a', border: '1.5px solid #0284c7', borderRadius: '10px', padding: '0.45rem 0.85rem' }} 
                    onClick={() => setActiveCliche(prev => (prev % (viewingExam.cliche_count || 3)) + 1)}
                  >
                    🖼️ Cliché suivant
                  </button>
                </div>

                {/* Compte-rendu officiel du praticien (Affichage Assuré / Édition Médecin) */}
                <div className="text-start p-3.5 rounded-3 mb-3" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <h6 className="fw-bold text-success mb-2">📋 Compte-rendu médical & Conclusion Diagnostique :</h6>
                  
                  {isAgent ? (
                    <div className="mb-2">
                      <textarea 
                        className="form-control input p-2.5 mb-2 fw-bold" 
                        rows="3"
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        placeholder="Rédigez ou mettez à jour le compte-rendu médical..."
                        style={{ borderRadius: '10px' }}
                      />
                      <button 
                        type="button"
                        className="btn btn-sm btn-success fw-bold text-white px-3"
                        style={{ borderRadius: '8px', background: '#059669' }}
                        onClick={handleSaveExamNotesByDoctor}
                      >
                        💾 Certifier & Sauvegarder la Conclusion (Dr. {activeDoctorAccount})
                      </button>
                    </div>
                  ) : (
                    <p className="mb-2" style={{ fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                      {viewingExam.doctor_notes}
                    </p>
                  )}

                  <div className="small text-muted border-top pt-2 mt-2">
                    👨‍⚕️ Prescrit / Validé par : <strong>{viewingExam.provider_name}</strong> • Date : {new Date(viewingExam.exam_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2 flex-wrap">
                  <button 
                    type="button" 
                    className="btn btn-success fw-bold text-white px-4 py-2 shadow-sm"
                    onClick={() => handleDownloadExamReportPDF(viewingExam)}
                    style={{ borderRadius: '10px', background: '#059669' }}
                  >
                    📥 Télécharger le rapport PDF certifié
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary fw-bold px-4 py-2 shadow-sm"
                    onClick={() => handlePrintDicomClicheHD(viewingExam, activeCliche, dicomInvert)}
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

      {/* MODALE 2 : Ajouter une Analyse, Radio ou Examen par un Prestataire / Médecin Habilité */}
      {showAddExamModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)', background: '#059669', color: '#ffffff' }}>
                <h5 className="modal-title fw-bold">
                  ➕ Enrichissement Dossier Médical — Ajout d'un Examen / Radio (Praticien Habilité)
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowAddExamModal(false)}></button>
              </div>

              <form onSubmit={handleAddExam}>
                <div className="modal-body p-4">
                  <div className="p-3 bg-light text-dark rounded-3 mb-4 small border">
                    Praticien Émetteur : <strong>{activeDoctorAccount}</strong> (Compte habilité Super Admin)
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Type d'examen *</label>
                      <select 
                        className="form-select input fw-bold p-2.5" 
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
                      <label className="form-label small fw-semibold">Numéro CMU du patient *</label>
                      <input 
                        type="text" 
                        className="form-control input fw-bold p-2.5" 
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
                      className="form-control input p-2.5" 
                      placeholder="Ex: Scanner Thoracique HD, Bilan Sanguin Complet..." 
                      value={newExam.title} 
                      onChange={(e) => setNewExam({ ...newExam, title: e.target.value })}
                      style={{ borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Prestataire / Structure médicale</label>
                      <input 
                        type="text" 
                        className="form-control input p-2.5" 
                        placeholder="Ex: Hôpital Fann / Clinique de la Madeleine" 
                        value={newExam.provider_name} 
                        onChange={(e) => setNewExam({ ...newExam, provider_name: e.target.value })}
                        style={{ borderRadius: '10px' }}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Date de réalisation d'examen</label>
                      <input 
                        type="date" 
                        className="form-control input p-2.5" 
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
                      className="form-control input p-2.5" 
                      rows="3" 
                      placeholder="Rédigez ici la conclusion diagnostique ou les résultats d'analyses..." 
                      value={newExam.doctor_notes} 
                      onChange={(e) => setNewExam({ ...newExam, doctor_notes: e.target.value })}
                      style={{ borderRadius: '10px' }}
                      required
                    />
                  </div>

                  <div className="p-3.5 rounded-3 border text-center" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', borderStyle: 'dashed' }}>
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
                  <button type="submit" className="btn btn-success text-white fw-bold px-4" style={{ background: '#059669', borderColor: '#059669' }}>
                    💾 Enregistrer & Certifier au Dossier Médical
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 3 : Ajouter un Code Patient Hospitalier (EXCLUSIVITÉ SUPER ADMIN) */}
      {showAddCodeModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)', background: '#2563eb', color: '#ffffff' }}>
                <h5 className="modal-title fw-bold">
                  🔗 Lier un Code Patient Hospitalier (Super Admin UNAMUSC)
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowAddCodeModal(false)}></button>
              </div>

              <form onSubmit={handleAddHospitalCodeSuperAdmin} className="modal-body p-4">
                <p className="small text-muted mb-3">
                  Seul le Super Admin a le pouvoir d'interconnecter un identifiant hospitalier externe (IPP Fann, DHIS2, Le Dantec, etc.) à la carte CMU.
                </p>

                <div className="mb-3">
                  <label className="form-label small fw-bold">Nom du Système / Hôpital *</label>
                  <input 
                    type="text" 
                    className="form-control input p-2.5 fw-bold" 
                    placeholder="Ex: Hôpital Dalal Jamm (SIGOB)"
                    value={newHospitalCode.system_name}
                    onChange={(e) => setNewHospitalCode({ ...newHospitalCode, system_name: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-bold">Code / Identifiant IPP Externe *</label>
                  <input 
                    type="text" 
                    className="form-control input p-2.5 fw-bold text-success" 
                    placeholder="Ex: IPP-DALAL-2026-4410"
                    value={newHospitalCode.external_patient_code}
                    onChange={(e) => setNewHospitalCode({ ...newHospitalCode, external_patient_code: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary fw-bold" onClick={() => setShowAddCodeModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold px-4 text-white">
                    🔗 Lier le Code IPP
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
