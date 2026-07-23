import React, { useState, useEffect } from 'react';

export default function MaternalHealth({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null }) {
  // Identification du rôle et accès
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);

  // Onglet actif : 'maternity' | 'infant' | 'toddler' | 'adolescent'
  const [activeTab, setActiveTab] = useState('maternity');

  // Praticiens / Sages-femmes d'État / Pédiatres habilités (Super Admin)
  const defaultMaternalPractitioners = [
    { id: 1, name: 'Sage-Femme d\'État Fatou Kiné Diop', specialty: 'Maternité & Suivi Périscolaire', cnom: 'SFE-SN-2026-4412' },
    { id: 2, name: 'Dr. Mariama Ba', specialty: 'Gynécologie-Obstétrique', cnom: 'CNOM-SN-2026-3310' },
    { id: 3, name: 'Dr. Cheikh Tidiane Ndiaye', specialty: 'Pédiatrie & Médecine Infantile 0-18 ans', cnom: 'CNOM-SN-2026-8819' }
  ];

  const [practitioners, setPractitioners] = useState(() => {
    try {
      const stored = localStorage.getItem('cmu_telemed_doctors');
      return stored ? JSON.parse(stored) : defaultMaternalPractitioners;
    } catch (e) {
      return defaultMaternalPractitioners;
    }
  });

  const [activePractitioner, setActivePractitioner] = useState(practitioners[0]?.name || 'Sage-Femme d\'État Fatou Kiné Diop');

  // Données du Carnet de Maternité & de Santé Numérique de l'Enfant (0 - 18 ans)
  const defaultMaternalData = {
    mother_name: citizenUser ? `${citizenUser.first_name || citizenUser.firstName || 'Awa'} ${citizenUser.last_name || citizenUser.lastName || 'Ndiaye'}` : 'Awa Ndiaye',
    child_name: 'Moussa Ndiaye',
    child_dob: '2026-05-14',
    child_gender: 'M',
    cmu_number: citizenUser?.cmu_number || citizenUser?.cmuNumber || 'CMU-DKR-2026-8812',
    pregnancy_start_date: new Date(Date.now() - 110 * 86400000).toISOString(),
    expected_delivery_date: new Date(Date.now() + 160 * 86400000).toISOString(),
    blood_group: 'O Rhésus Positif (O+)',
    child_blood_group: 'O Rhésus Positif (O+)',
    assigned_maternity: 'Maternité du Centre de Santé Gaspard Camara (Dakar)',
    birth_hospital: 'Hôpital Abass Ndao (Dakar)',
    birth_weight: 3.4, // kg
    birth_height: 50, // cm
    apgar_score: '9/10 (1mn) • 10/10 (5mn)',
    risk_level: 'low',
    current_weight: 68.5,
    blood_pressure: '11/7 mmHg',
    
    // Suivi CPN Prénatal
    cpn_records: [
      { id: 1, name: 'CPN 1 (1er Trimestre - Datation & Sérologies)', done: true, date: '2026-04-10', doctor: 'Sage-Femme Fatou Kiné Diop', notes: 'Grossesse intra-utérine évolutive 8 SA. Bilan biologique initial normal, groupe O+.' },
      { id: 2, name: 'CPN 2 (2ème Trimestre - Morphologie & VAT 1)', done: true, date: '2026-06-05', doctor: 'Dr. Mariama Ba (Gynécologue)', notes: 'Hauteur utérine 21 cm. Bruit du cœur fœtal régulier (145 bpm). Injection VAT 1 réalisée.' },
      { id: 3, name: 'CPN 3 (28-32 SA - Dépistage Anémie & TPI-SP 1)', done: false, date: '2026-08-12', doctor: 'Sage-Femme Fatou Kiné Diop', notes: 'Prévue : Contrôle hémoglobine, 1ère dose TPI-SP (Prévention Paludisme) & VAT 2.' },
      { id: 4, name: 'CPN 4+ (36-38 SA - Préparation Accouchement 100% Gratuit)', done: false, date: '2026-09-25', doctor: 'Dr. Mariama Ba (Gynécologue)', notes: 'Prévue : Présentation céphalique, vérification bassin maternel & fiche de liaison.' }
    ],
    
    // Vaccins Maternels VAT & Prévention
    vaccinations: {
      vat1: { done: true, date: '2026-06-05' },
      vat2: { done: false, date: '2026-08-12' },
      vat3: { done: false, date: '2027-02-10' }
    },
    prevention: {
      tpi_sp1: { done: false, date: '2026-08-12' },
      tpi_sp2: { done: false, date: '2026-09-25' },
      milda_net: { delivered: true, date: '2026-04-10' },
      iron_folic: { delivered: true, dose: '1 comprimé par jour' }
    },
    ultrasounds: [
      { id: 1, title: 'Échographie Obstétricale T1 (Datation)', date: '2026-04-12', doctor: 'Dr. Mariama Ba', conclusion: 'Fœtus unique, activité cardiaque présente (152 bpm). LCR conforme à la date de début de grossesse.' }
    ],

    // Programme Élargi de Vaccination (PEV Sénégal 0 - 12 Mois)
    pev_vaccines_0_12m: [
      { code: 'BCG', name: 'BCG (Tuberculose)', target_age: 'Naissance', done: true, date: '2026-05-14', doctor: 'Centre de Santé Gaspard Camara' },
      { code: 'VPO0', name: 'VPO 0 (Polio oral naissance)', target_age: 'Naissance', done: true, date: '2026-05-14', doctor: 'Centre de Santé Gaspard Camara' },
      { code: 'VHB0', name: 'Hépatite B (VHB 0)', target_age: 'Naissance (< 24h)', done: true, date: '2026-05-14', doctor: 'Centre de Santé Gaspard Camara' },
      { code: 'PENTA1', name: 'Pentavalent 1 (DTC-HepB-Hib 1) + VPO1 + Pneumo 1 + Rota 1', target_age: '6 Semaines (1 mois 1/2)', done: true, date: '2026-06-28', doctor: 'Dispensaire Point E' },
      { code: 'PENTA2', name: 'Pentavalent 2 + VPO2 + Pneumo 2 + Rota 2', target_age: '10 Semaines (2 mois 1/2)', done: false, date: '2026-07-30', doctor: 'Dr. Cheikh Tidiane Ndiaye' },
      { code: 'PENTA3', name: 'Pentavalent 3 + VPO3 + VPI (Polio Injectable) + Pneumo 3', target_age: '14 Semaines (3 mois 1/2)', done: false, date: '2026-08-30', doctor: 'Pédiatrie Fann' },
      { code: 'VAA_RR1', name: 'VAA (Fièvre Jaune) + RR 1 (Rougeole-Rubéole 1)', target_age: '9 Mois', done: false, date: '2027-02-14', doctor: 'Centre de Santé' },
      { code: 'RR2', name: 'RR 2 (Rougeole-Rubéole 2) + Rappel Pentavalent', target_age: '15 Mois', done: false, date: '2027-08-14', doctor: 'Centre de Santé' }
    ],

    // Suivi de Croissance Poids / Taille (0 - 5 Ans)
    growth_chart_0_5y: [
      { month: 0, weight: 3.4, height: 50, notes: 'Poids de naissance normal' },
      { month: 1, weight: 4.2, height: 53, notes: 'Allaitement maternel exclusif recommandation OMS' },
      { month: 2, weight: 5.1, height: 56.5, notes: 'Croissance régulière' },
      { month: 3, weight: 6.0, height: 59.5, notes: 'Périmètre crânien 40 cm normal' },
      { month: 6, weight: 7.8, height: 66, notes: 'Début diversification alimentaire douce (bouille enrichie)' },
      { month: 12, weight: 9.8, height: 75, notes: 'Marche acquise, 1er rappel déparasitant' }
    ],

    // Suivi Scolaire & Adolescence (6 ans à 18 ans)
    school_health_6_18y: [
      { age: '6 ans (CI / Éléments)', visit_type: 'Bilan d\'incorporation scolaire', done: true, vision: '10/10 ODG', audition: 'Normale', dental: 'Saine sans carie', drepanocytose_test: 'AA (Négatif Drépanocytose)', sports_aptitude: 'Aptitude Totale EPS', doctor: 'Dr. Cheikh Tidiane Ndiaye' },
      { age: '9-14 ans (Jeunes Filles)', visit_type: 'Vaccination HPV (Anti-Papillomavirus)', done: false, vision: 'À vérifier', audition: 'À vérifier', dental: 'Contrôle annuel', hpv_dose: 'Programme National Sénégal (2 doses)', sports_aptitude: 'Aptitude Totale', doctor: 'Service Médecine Scolaire' },
      { age: '10-12 ans (Collège)', visit_type: 'Visite systématique 6ème & Rappel dT', done: false, vision: 'Acouphènes / Vue', audition: 'Normale', dental: 'Détartrage recommandation', dt_booster: 'Rappel Diphtérie-Tétanos', sports_aptitude: 'Aptitude EPS', doctor: 'Pédiatre Scolaire' },
      { age: '15-18 ans (Lycée / Bac)', visit_type: 'Bilan de santé pubertaire & EPS Bac', done: false, vision: 'Contrôle acuité', audition: 'Normale', dental: 'Dents de sagesse', dt_booster: 'Rappel dT 18 ans', sports_aptitude: 'Aptitude Épreuves Sportives Bac', doctor: 'Médecin Généraliste' }
    ]
  };

  const [maternalData, setMaternalData] = useState(defaultMaternalData);
  const [savedMsg, setSavedMsg] = useState('');

  // Modale Saisie CPN Prénatale
  const [showAddCpnModal, setShowAddCpnModal] = useState(false);
  const [newCpnData, setNewCpnData] = useState({ cpn_id: 3, weight: 68.5, blood_pressure: '12/7', doctor_notes: '', vat_administered: false, tpi_sp_administered: false });

  // Modale Saisie Vaccin PEV (0-18 ans)
  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);
  const [selectedVaccineCode, setSelectedVaccineCode] = useState('PENTA2');

  const fetchMaternalData = async () => {
    try {
      const stored = localStorage.getItem('cmu_maternal_data_0_18');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') {
          setMaternalData(prev => ({
            ...defaultMaternalData,
            ...parsed,
            cpn_records: Array.isArray(parsed.cpn_records) && parsed.cpn_records.length > 0 ? parsed.cpn_records : defaultMaternalData.cpn_records,
            pev_vaccines_0_12m: Array.isArray(parsed.pev_vaccines_0_12m) ? parsed.pev_vaccines_0_12m : defaultMaternalData.pev_vaccines_0_12m,
            growth_chart_0_5y: Array.isArray(parsed.growth_chart_0_5y) ? parsed.growth_chart_0_5y : defaultMaternalData.growth_chart_0_5y,
            school_health_6_18y: Array.isArray(parsed.school_health_6_18y) ? parsed.school_health_6_18y : defaultMaternalData.school_health_6_18y
          }));
        }
      } else {
        localStorage.setItem('cmu_maternal_data_0_18', JSON.stringify(defaultMaternalData));
      }
    } catch (err) {
      console.warn('Erreur chargement carnet 0-18 ans:', err);
    }
  };

  useEffect(() => {
    fetchMaternalData();
  }, []);

  // Validation / Saisie d'un vaccin PEV par le Pédiatre / Sage-Femme
  const handleValidatePevVaccine = (e) => {
    e.preventDefault();
    if (!isAgent) {
      alert('🔒 Seul le Praticien Pédiatre ou la Sage-Femme peut valider un vaccin du PEV.');
      return;
    }

    const updatedPev = maternalData.pev_vaccines_0_12m.map(vac => {
      if (vac.code === selectedVaccineCode) {
        return { ...vac, done: true, date: new Date().toISOString().slice(0, 10), doctor: activePractitioner };
      }
      return vac;
    });

    const updatedData = { ...maternalData, pev_vaccines_0_12m: updatedPev };
    setMaternalData(updatedData);
    localStorage.setItem('cmu_maternal_data_0_18', JSON.stringify(updatedData));
    setShowAddVaccineModal(false);
    setSavedMsg(`✅ Vaccin ${selectedVaccineCode} validé et certifié dans le Carnet de Santé de l'Enfant par ${activePractitioner}.`);
  };

  // Validation CPN Prénatale par le praticien
  const handleUpdateCpnByPractitioner = (e) => {
    e.preventDefault();
    if (!isAgent) {
      alert('🔒 Seule la Sage-Femme d\'État ou le Gynécologue peut valider une CPN.');
      return;
    }

    const currentRecords = maternalData?.cpn_records || defaultMaternalData.cpn_records;
    const updatedCpnRecords = currentRecords.map(cpn => {
      if (cpn.id === parseInt(newCpnData.cpn_id)) {
        return {
          ...cpn,
          done: true,
          date: new Date().toISOString().slice(0, 10),
          doctor: activePractitioner,
          notes: newCpnData.doctor_notes || cpn.notes
        };
      }
      return cpn;
    });

    const updatedData = {
      ...maternalData,
      current_weight: newCpnData.weight || maternalData?.current_weight || 68.5,
      blood_pressure: newCpnData.blood_pressure || maternalData?.blood_pressure || '12/7',
      cpn_records: updatedCpnRecords
    };

    setMaternalData(updatedData);
    localStorage.setItem('cmu_maternal_data_0_18', JSON.stringify(updatedData));
    setShowAddCpnModal(false);
    setSavedMsg(`✅ Consultation CPN validée et certifiée par ${activePractitioner}.`);
  };

  // Impression / Téléchargement du Carnet de Maternité & Santé Enfant 0 - 18 ans A4 PDF
  const handlePrintMaternalChildPassportPDF = () => {
    const data = maternalData || defaultMaternalData;
    const records = data?.cpn_records || defaultMaternalData.cpn_records;
    const cpnRowsHtml = records.map(cpn => {
      const statusBadge = cpn.done ? '<span class="badge bg-success">✅ Validée</span>' : '<span class="badge bg-warning text-dark">⏳ En attente</span>';
      const cpnDateStr = cpn.date ? new Date(cpn.date).toLocaleDateString('fr-FR') : 'À venir';
      return '<tr><td><strong>' + cpn.name + '</strong></td><td style="text-align: center;">' + statusBadge + '</td><td><small>' + cpnDateStr + '<br />' + cpn.doctor + '</small></td><td><small>' + cpn.notes + '</small></td></tr>';
    }).join('');

    const pevVaccines = data?.pev_vaccines_0_12m || defaultMaternalData.pev_vaccines_0_12m;
    const pevRowsHtml = pevVaccines.map(vac => {
      const statusBadge = vac.done ? '<span class="badge bg-success">✅ Administré</span>' : '<span class="badge bg-warning text-dark">⏳ Prévu</span>';
      return '<tr><td><strong>' + vac.name + '</strong><br /><small class="text-muted">Âge : ' + vac.target_age + '</small></td><td style="text-align: center;">' + statusBadge + '</td><td><small>' + (vac.date ? new Date(vac.date).toLocaleDateString('fr-FR') : 'En attente') + '</small></td><td><small>' + vac.doctor + '</small></td></tr>';
    }).join('');

    const schoolHealth = data?.school_health_6_18y || defaultMaternalData.school_health_6_18y;
    const schoolRowsHtml = schoolHealth.map(sch => `
      <tr>
        <td><strong>${sch.age}</strong><br /><small>${sch.visit_type}</small></td>
        <td><small>Vision: <strong>${sch.vision}</strong><br />Audition: <strong>${sch.audition}</strong></small></td>
        <td><small>Drépanocytose: <strong>${sch.drepanocytose_test || 'Négatif'}</strong><br />Dentaire: ${sch.dental}</small></td>
        <td style="text-align: center;"><span class="badge bg-success">${sch.sports_aptitude || 'Aptitude EPS'}</span></td>
      </tr>
    `).join('');

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Carnet_Maternite_Sante_Enfant_0_18ans_${data.cmu_number || 'CMU-8812'}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.2rem; }
            .cert-box { border: 2.5px solid #059669; border-radius: 16px; padding: 1.8rem; background: #ffffff; }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer le Carnet Maternité & Santé Enfant (0 à 18 ans) A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="cert-box">
            <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0 text-uppercase" style="color: #059669;">RÉPUBLIQUE DU SÉNÉGAL</h6>
                  <small class="text-muted">MINISTÈRE DE LA SANTÉ ET DE L'ACTION SOCIALE</small><br />
                  <strong class="small text-uppercase" style="color: #0f172a;">CARNET DE SANTÉ MATERNELLE & INFANTILE NUMÉRIQUE (0 À 18 ANS)</strong>
                </div>
              </div>
              <img src="/unamusc_logo.png" alt="UNAMUSC" style="width: 85px; height: auto;" />
            </div>

            <div class="text-center my-3 p-2.5 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h5 class="fw-bold text-uppercase mb-0" style="color: #059669;">CARNET NUMÉRIQUE OFFICIEL PÉRINATAL & SUIVI DE L'ENFANT 0-18 ANS</h5>
              <small class="text-muted">Gratuité Totale CMU Accouchement + Gratuité des Soins Pédiatriques 0-5 ans au Sénégal</small>
            </div>

            <div class="row g-2 mb-3 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <small class="text-muted d-block fw-bold">MÈRE ASSURÉE : <strong>${data.mother_name || 'Awa Ndiaye'}</strong></small>
                <small class="text-muted d-block">ENFANT : <strong>${data.child_name || 'Moussa Ndiaye'}</strong> (${data.child_gender === 'M' ? 'Garçon' : 'Fille'})</small>
                <small class="text-muted">Date de Naissance : <strong>${data.child_dob ? new Date(data.child_dob).toLocaleDateString('fr-FR') : '14/05/2026'}</strong></small>
              </div>
              <div class="col-6 text-end">
                <small class="text-muted d-block">N° CARTE CMU : <strong class="text-success">${data.cmu_number || 'CMU-DKR-8812'}</strong></small>
                <small class="text-muted d-block">Poids & Taille Naissance : <strong>${data.birth_weight || 3.4} kg • ${data.birth_height || 50} cm</strong></small>
                <small class="text-muted">Score APGAR : <strong>${data.apgar_score || '10/10'}</strong></small>
              </div>
            </div>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #059669;">1. CONSULTATIONS PRÉNATALES (CPN 1 À CPN 4+) :</h6>
            <table class="table table-bordered mb-3 small">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Examen CPN</th>
                  <th>Statut</th>
                  <th>Date & Praticien</th>
                  <th>Observations</th>
                </tr>
              </thead>
              <tbody>
                ${cpnRowsHtml}
              </tbody>
            </table>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #059669;">2. VACCINATIONS du PEV SÉNÉGAL (0 À 12 MOIS) :</h6>
            <table class="table table-bordered mb-3 small">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Vaccin PEV</th>
                  <th>Statut</th>
                  <th>Date d'Administration</th>
                  <th>Centre / Praticien</th>
                </tr>
              </thead>
              <tbody>
                ${pevRowsHtml}
              </tbody>
            </table>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #059669;">3. SUIVI DE SANTÉ SCOLAIRE & ADOLESCENCE (6 À 18 ANS) :</h6>
            <table class="table table-bordered mb-3 small">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Classe / Tranche d'Âge</th>
                  <th>Examen Visuel & Auditif</th>
                  <th>Drépanocytose & Dentaire</th>
                  <th>Aptitude EPS / Sport</th>
                </tr>
              </thead>
              <tbody>
                ${schoolRowsHtml}
              </tbody>
            </table>

            <div class="row align-items-center border-top pt-3">
              <div class="col-8">
                <strong class="small text-success d-block mb-1">Authentification Nationale UNAMUSC & Ministère de la Santé :</strong>
                <p class="small text-muted mb-0">Ce carnet certifié garantit la gratuité des soins de santé 0-5 ans et le suivi médical obligatoire scolaire jusqu'à 18 ans.</p>
              </div>
              <div class="col-4 text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`HEALTH-0-18Y-${data.cmu_number || '8812'}`)}" alt="QR Code" style="width: 75px; height: 75px;" />
                <div class="small fw-bold text-success mt-1">Visa Pédiatre / Ministère</div>
              </div>
            </div>
          </div>
          <script>setTimeout(() => { window.print(); }, 400);</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const safeData = maternalData || defaultMaternalData;

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(4, 120, 87, 0.92)), url("/csu_kids_real.png") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 15px 30px -10px rgba(5, 150, 105, 0.4)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '900px' }}>
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
            🤱 Carnet Numérique Officiel de Santé Maternelle & Infantile (de la Naissance à 18 ans) — UNAMUSC
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2.2rem', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Tére wéru yaramu jégen ji ak doom ji (0-18 ans)' : 'Carnet de Santé Maternelle & Suivi de l\'Enfant (0 à 18 ans)'}
          </h1>
          <p className="mb-4 text-white-50 text-center mx-auto" style={{ fontSize: '1.02rem', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)', maxWidth: '800px' }}>
            {isAgent
              ? 'Mode Praticien Habilité (Sage-Femme d\'État / Pédiatre) : Enregistrez et validez les CPN, le PEV (0-12m), le suivi de croissance et la santé scolaire 6-18 ans.'
              : 'Espace Maman / Parents (Mode Lecture Seule) : Consultez le carnet de santé numérique complet de votre enfant, ses vaccins PEV et téléchargez son livret certifié A4.'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            {isAgent && (
              <>
                <button 
                  type="button"
                  className="btn fw-bold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', borderRadius: '12px', padding: '0.7rem 1.4rem', fontSize: '0.92rem' }}
                  onClick={() => setShowAddCpnModal(true)}
                >
                  ➕ Valider une CPN Prénatale (Sage-Femme)
                </button>
                <button 
                  type="button"
                  className="btn fw-bold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none', borderRadius: '12px', padding: '0.7rem 1.4rem', fontSize: '0.92rem' }}
                  onClick={() => setShowAddVaccineModal(true)}
                >
                  💉 Administrer Vaccin PEV (Pédiatre)
                </button>
              </>
            )}

            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm"
              style={{ background: 'rgba(255, 255, 255, 0.22)', border: '1.5px solid rgba(255, 255, 255, 0.4)', borderRadius: '12px', padding: '0.7rem 1.4rem', fontSize: '0.92rem' }}
              onClick={handlePrintMaternalChildPassportPDF}
            >
              🖨️ Télécharger le Carnet Maternité & Santé Enfant (0-18 ans) A4
            </button>
          </div>
        </div>
      </section>

      {/* SÉLECTEUR DE COMPTE PRATICIEN SI MODE AGENT / MÉDECIN */}
      {isAgent && (
        <div className="card p-3 mb-4 rounded-4 shadow-sm border" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary px-3 py-2 fw-bold">👩‍⚕️ COMPTE PRATICIEN / PÉDIATRE / SAGE-FEMME (SUPER ADMIN)</span>
              <span className="small text-muted">Praticien actuellement connecté pour la validation :</span>
            </div>
            <select 
              className="form-select form-select-sm fw-bold border-primary"
              value={activePractitioner}
              onChange={(e) => setActivePractitioner(e.target.value)}
              style={{ borderRadius: '10px', maxWidth: '340px' }}
            >
              {practitioners.map(doc => (
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

      {/* NAVIGATION EN 4 ONGLETS PÉDIATRIQUES 0 À 18 ANS */}
      <div className="d-flex justify-content-center gap-2 mb-4 flex-wrap">
        <button 
          className={`btn fw-bold px-3.5 py-2.5 shadow-sm ${activeTab === 'maternity' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('maternity')}
          style={{ borderRadius: '12px' }}
        >
          🤰 1. Prénatal & Accouchement (CPN 1-4+)
        </button>
        <button 
          className={`btn fw-bold px-3.5 py-2.5 shadow-sm ${activeTab === 'infant' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('infant')}
          style={{ borderRadius: '12px' }}
        >
          👶 2. Nourrisson & PEV (0 - 12 Mois)
        </button>
        <button 
          className={`btn fw-bold px-3.5 py-2.5 shadow-sm ${activeTab === 'toddler' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('toddler')}
          style={{ borderRadius: '12px' }}
        >
          👦 3. Petite Enfance (1 an - 5 ans)
        </button>
        <button 
          className={`btn fw-bold px-3.5 py-2.5 shadow-sm ${activeTab === 'adolescent' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('adolescent')}
          style={{ borderRadius: '12px' }}
        >
          🎒 4. Santé Scolaire & Adolescence (6 - 18 ans)
        </button>
      </div>

      {/* ONGLET 1 : GROSSESSE & CPN PRÉNATALES */}
      {activeTab === 'maternity' && (
        <div className="row g-4 fade-in">
          <div className="col-lg-7">
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🤰 Suivi de Grossesse & CPN (1er au 3ème Trimestre)</h4>
                  <small className="text-muted">Bénéficiaire : <strong>{safeData.mother_name || 'Awa Ndiaye'}</strong> ({safeData.cmu_number || 'CMU-DKR-8812'})</small>
                </div>
                {isAgent ? (
                  <span className="badge bg-success px-3 py-2 fw-semibold">✏️ Écriture Praticien</span>
                ) : (
                  <span className="badge bg-secondary text-white px-3 py-2 fw-semibold">🔒 Lecture Seule (Maman)</span>
                )}
              </div>

              <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                <div className="row g-4 text-center">
                  <div className="col-6 border-end">
                    <span className="text-muted d-block mb-1 small fw-bold">GROUPE SANGUIN :</span>
                    <strong className="text-danger fs-5 d-block">{safeData.blood_group || 'O+'}</strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block mb-1 small fw-bold">TERME PRÉVU (DPA) :</span>
                    <strong className="text-success fs-5 d-block">
                      👶 {safeData.expected_delivery_date ? new Date(safeData.expected_delivery_date).toLocaleDateString('fr-FR') : '15/10/2026'}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="d-flex flex-column gap-3 mb-4">
                {(safeData?.cpn_records || defaultMaternalData.cpn_records).map(cpn => (
                  <div key={cpn.id} className="p-3.5 rounded-4 border d-flex justify-content-between align-items-center flex-wrap gap-2 shadow-sm" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                    <div style={{ flex: 1 }}>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{cpn.name}</h6>
                        {cpn.done ? <span className="badge bg-success">✅ Validée</span> : <span className="badge bg-warning text-dark">⏳ En attente</span>}
                      </div>
                      <p className="text-muted mb-1 small" style={{ lineHeight: '1.5' }}>{cpn.notes}</p>
                      <small className="text-muted">👩‍⚕️ Praticien référent : <strong>{cpn.doctor}</strong> • Date : {cpn.date ? new Date(cpn.date).toLocaleDateString('fr-FR') : 'À planifier'}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="alert alert-success d-flex align-items-center rounded-4 border-0 p-3.5 shadow-sm">
                <span className="fs-2 me-3">ℹ️</span>
                <div style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: '1.6' }}>
                  <strong>Prise en charge à 100% de la Maternité sous Tiers-Payant UNAMUSC :</strong>
                  <br />
                  L'accouchement simple et la césarienne d'urgence sont pris en charge à <strong>100% sans aucune avance de frais</strong> dans toutes les maternités et centres de santé publics du Sénégal.
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card shadow-sm border-0 p-4 mb-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span>💉</span> Vaccin Anti-Tétanique (VAT) & Prévention
              </h4>
              
              <div className="d-flex flex-column gap-2.5 mb-3">
                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Vaccin Anti-Tétanique (VAT 1)</strong>
                    <small className="text-muted">1ère injection</small>
                  </div>
                  {safeData?.vaccinations?.vat1?.done ? <span className="badge bg-success px-2.5 py-1">✅ Administré</span> : <span className="badge bg-warning text-dark px-2.5 py-1">⏳ Prévu</span>}
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Vaccin Anti-Tétanique (VAT 2)</strong>
                    <small className="text-muted">1 mois après VAT 1</small>
                  </div>
                  {safeData?.vaccinations?.vat2?.done ? <span className="badge bg-success px-2.5 py-1">✅ Administré</span> : <span className="badge bg-warning text-dark px-2.5 py-1">⏳ Prévu CPN 3</span>}
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Traitement Préventif Paludisme (TPI-SP)</strong>
                    <small className="text-muted">Sulfadoxine-Pyriméthamine 2ème Trimestre</small>
                  </div>
                  {safeData?.prevention?.tpi_sp1?.done ? <span className="badge bg-success px-2.5 py-1">✅ Reçu</span> : <span className="badge bg-info text-dark px-2.5 py-1">⏳ Prévu CPN 3</span>}
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Moustiquaire MILDA + Fer/Folique</strong>
                    <small className="text-muted">Distribution gratuite nationale</small>
                  </div>
                  <span className="badge bg-success px-2.5 py-1">Délivré 100% Gratuit</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : NOURRISSON & PROGRAMME ÉLARGI DE VACCINATION PEV (0 - 12 MOIS) */}
      {activeTab === 'infant' && (
        <div className="row g-4 fade-in">
          <div className="col-lg-7">
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h4 className="fw-bold mb-0 text-success">👶 Programme Élargi de Vaccination (PEV Sénégal 0-12m)</h4>
                  <small className="text-muted">Enfant : <strong>{safeData.child_name}</strong> • Né le {new Date(safeData.child_dob).toLocaleDateString('fr-FR')}</small>
                </div>
                {isAgent && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-primary fw-bold px-3 py-1.5" 
                    style={{ borderRadius: '10px' }}
                    onClick={() => setShowAddVaccineModal(true)}
                  >
                    💉 Administrer un Vaccin PEV
                  </button>
                )}
              </div>

              {/* Fiche de Naissance */}
              <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-body)', border: '1.5px solid var(--border-color)' }}>
                <h6 className="fw-bold text-success mb-3">👶 Fiche Médicale de Naissance :</h6>
                <div className="row g-3 text-center small">
                  <div className="col-3 border-end">
                    <span className="text-muted d-block">Poids Naissance</span>
                    <strong className="fs-6 text-success">{safeData.birth_weight} kg</strong>
                  </div>
                  <div className="col-3 border-end">
                    <span className="text-muted d-block">Taille Naissance</span>
                    <strong className="fs-6 text-success">{safeData.birth_height} cm</strong>
                  </div>
                  <div className="col-3 border-end">
                    <span className="text-muted d-block">Score APGAR</span>
                    <strong className="fs-6 text-success">{safeData.apgar_score}</strong>
                  </div>
                  <div className="col-3">
                    <span className="text-muted d-block">Groupe Bébé</span>
                    <strong className="fs-6 text-danger">{safeData.child_blood_group}</strong>
                  </div>
                </div>
              </div>

              {/* Calendrier PEV Sénégal */}
              <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>💉 Calendrier Vaccinal Obligatoire (PEV) :</h5>
              <div className="list-group">
                {(safeData?.pev_vaccines_0_12m || defaultMaternalData.pev_vaccines_0_12m).map((vac, idx) => (
                  <div key={idx} className="list-group-item p-3 mb-2 rounded-3 border d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                    <div>
                      <strong className="d-block text-success">{vac.name}</strong>
                      <small className="text-muted">Échéance : <strong>{vac.target_age}</strong> • Structure : {vac.doctor}</small>
                    </div>
                    <div>
                      {vac.done ? (
                        <span className="badge bg-success px-3 py-1.5 fw-bold">✅ Administré ({new Date(vac.date).toLocaleDateString('fr-FR')})</span>
                      ) : (
                        <span className="badge bg-warning text-dark px-3 py-1.5 fw-bold">⏳ Prochain Vaccin</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            {/* Courbe de Poids & Malnutrition */}
            <div className="card shadow-sm border-0 p-4 mb-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span>📈</span> Suivi de Croissance Poids / Taille (0-12 Mois)
              </h4>
              <p className="small text-muted mb-3">Pesée mensuelle et dépistage de la malnutrition aiguë (Périmètre Brachial PB / Ruban de Shakir).</p>

              <div className="table-responsive">
                <table className="table table-bordered table-sm text-center small">
                  <thead style={{ background: 'var(--bg-body)' }}>
                    <tr>
                      <th>Âge</th>
                      <th>Poids (kg)</th>
                      <th>Taille (cm)</th>
                      <th>Observations</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(safeData?.growth_chart_0_5y || defaultMaternalData.growth_chart_0_5y).map((g, i) => (
                      <tr key={i}>
                        <td><strong>{g.month} mois</strong></td>
                        <td className="text-success fw-bold">{g.weight} kg</td>
                        <td>{g.height} cm</td>
                        <td><small>{g.notes}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 3 : PETITE ENFANCE (1 AN À 5 ANS - GRATUITÉ CMU 100%) */}
      {activeTab === 'toddler' && (
        <div className="row g-4 fade-in">
          <div className="col-lg-7">
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h4 className="fw-bold mb-0 text-success">🧒 Petite Enfance (1 an à 5 ans) — Gratuité CMU 100%</h4>
                  <small className="text-muted">Prise en charge médicale intégrale et gratuite pour les enfants de 0 à 5 ans au Sénégal.</small>
                </div>
                <span className="badge bg-success px-3 py-2 fw-bold">100% Pris en charge CMU</span>
              </div>

              <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold text-success mb-2">💊 Supplémentation Nationale Semestrielle :</h6>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex justify-content-between p-2 border rounded bg-white">
                    <span>Vitamine A 200 000 UI (Tous les 6 mois dès 6 mois)</span>
                    <span className="badge bg-success">✅ Administrée (Juin 2026)</span>
                  </div>
                  <div className="d-flex justify-content-between p-2 border rounded bg-white">
                    <span>Mebendazole 500mg (Déparasitant semestriel)</span>
                    <span className="badge bg-success">✅ Administré (Juin 2026)</span>
                  </div>
                </div>
              </div>

              <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>📋 Étapes du Développement Psychomoteur (1 à 5 ans) :</h5>
              <div className="d-flex flex-column gap-2.5">
                <div className="p-3 border rounded-3 bg-light">
                  <strong className="d-block text-primary small">1 an (12 Mois) :</strong>
                  <span className="small">Marche autonome ou avec soutien, premiers mots ("Papa", "Maman"), dentition (4 à 8 incisives).</span>
                </div>
                <div className="p-3 border rounded-3 bg-light">
                  <strong className="d-block text-primary small">2 ans (24 Mois) :</strong>
                  <span className="small">Association de 2 mots, course, propreté diurne en apprentissage.</span>
                </div>
                <div className="p-3 border rounded-3 bg-light">
                  <strong className="d-block text-primary small">3 à 5 ans (Maternelle) :</strong>
                  <span className="small">Langage structuré, sociabilisation en école maternelle, examen bucco-dentaire annuel.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span>🏥</span> Prise en Charge Médicale 0-5 ans
              </h4>
              <p className="small text-muted mb-3">En cas de fièvre, toux ou diarrhée, votre enfant bénéficie d'une consultation, d'examens de biologie et de médicaments <strong>100% gratuits</strong> dans les postes et centres de santé.</p>
              
              <div className="p-3 border rounded-3 bg-success text-white mb-3">
                <strong className="d-block mb-1">Pass Sanitaire Pédiatrique CMU :</strong>
                <small>Zéro avance de frais sous présentation de la carte CMU parentale.</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 4 : SANTÉ SCOLAIRE & ADOLESCENCE (6 ANS À 18 ANS) */}
      {activeTab === 'adolescent' && (
        <div className="row g-4 fade-in">
          <div className="col-lg-12">
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h4 className="fw-bold mb-0 text-primary">🎒 Carnet de Santé Scolaire & Adolescence (6 ans à 18 ans)</h4>
                  <small className="text-muted">Suivi médical d'incorporation scolaire, dépistage drépanocytose, vaccination HPV et aptitudes sportives.</small>
                </div>
                <span className="badge bg-primary px-3 py-2 fw-bold">Suivi Scolaire Certifié CNOM</span>
              </div>

              <div className="table-responsive mb-4">
                <table className="table table-bordered align-middle text-center">
                  <thead style={{ background: 'var(--bg-body)' }}>
                    <tr>
                      <th>Étape / Classe</th>
                      <th>Nature du Bilan</th>
                      <th>Contrôle Visuel & Auditif</th>
                      <th>Drépanocytose & Dentition</th>
                      <th>Vaccination & Rappels</th>
                      <th>Aptitude EPS / Sport</th>
                      <th>Praticien Referent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(safeData?.school_health_6_18y || defaultMaternalData.school_health_6_18y).map((sch, i) => (
                      <tr key={i}>
                        <td><strong className="text-primary">{sch.age}</strong></td>
                        <td><small className="fw-semibold">{sch.visit_type}</small></td>
                        <td><small>Vision: <strong>{sch.vision}</strong><br />Audition: {sch.audition}</small></td>
                        <td><small>Drépanocytose: <strong className="text-danger">{sch.drepanocytose_test || 'Négatif (AA)'}</strong><br />Dentaire: {sch.dental}</small></td>
                        <td><small>{sch.hpv_dose || sch.dt_booster || 'Vaccins à jour'}</small></td>
                        <td><span className="badge bg-success px-2.5 py-1">{sch.sports_aptitude || 'Aptitude EPS'}</span></td>
                        <td><small>{sch.doctor}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <div className="p-3.5 border rounded-3 bg-light">
                    <h6 className="fw-bold text-primary mb-2">🩸 Dépistage National de la Drépanocytose (Sénégal) :</h6>
                    <p className="small mb-0 text-muted" style={{ lineHeight: '1.6' }}>
                      Le test de Emmel et l'électrophorèse de l'hémoglobine sont réalisés lors de l'incorporation scolaire au CI (6 ans) pour prémunir les enfants contre les crises vaso-occlusives.
                    </p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="p-3.5 border rounded-3 bg-light">
                    <h6 className="fw-bold text-primary mb-2">🎀 Vaccination HPV (Anti-Papillomavirus 9-14 ans) :</h6>
                    <p className="small mb-0 text-muted" style={{ lineHeight: '1.6' }}>
                      Dans le cadre du Programme National du Sénégal, les jeunes filles bénéficient de 2 doses de vaccin HPV administrées gratuitement en milieu scolaire pour la prévention du cancer du col de l'utérus.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 1 : VALIDATION / SAISIE CPN (SAGE-FEMME) */}
      {showAddCpnModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)', background: '#059669', color: '#ffffff' }}>
                <h5 className="modal-title fw-bold">➕ Valider une Consultation CPN (Sage-Femme)</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowAddCpnModal(false)}></button>
              </div>

              <form onSubmit={handleUpdateCpnByPractitioner} className="modal-body p-4">
                <div className="p-2.5 bg-light text-dark rounded-3 mb-3 small border">
                  Sage-Femme / Praticien Valideur : <strong>{activePractitioner}</strong>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold">Consultation CPN à valider *</label>
                  <select 
                    className="form-select input fw-bold p-2.5"
                    value={newCpnData.cpn_id}
                    onChange={(e) => setNewCpnData({ ...newCpnData, cpn_id: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  >
                    {(safeData?.cpn_records || defaultMaternalData.cpn_records).map(cpn => (
                      <option key={cpn.id} value={cpn.id}>
                        {cpn.name} ({cpn.done ? 'Déjà validée' : 'En attente'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold">Observations & Bruits du Cœur Fœtal (BDCF) *</label>
                  <textarea 
                    className="form-control input p-2.5"
                    rows="3"
                    placeholder="Rédigez les observations CPN..."
                    value={newCpnData.doctor_notes}
                    onChange={(e) => setNewCpnData({ ...newCpnData, doctor_notes: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddCpnModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-success fw-bold px-4 text-white" style={{ background: '#059669' }}>
                    ✅ Certifier la CPN
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODALE 2 : VALIDATION / VACCIN PEV 0-18 ANS (PÉDIATRE) */}
      {showAddVaccineModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)', background: '#2563eb', color: '#ffffff' }}>
                <h5 className="modal-title fw-bold">💉 Administrer un Vaccin du PEV (Pédiatre)</h5>
                <button className="btn-close btn-close-white" onClick={() => setShowAddVaccineModal(false)}></button>
              </div>

              <form onSubmit={handleValidatePevVaccine} className="modal-body p-4">
                <div className="p-2.5 bg-light text-dark rounded-3 mb-3 small border">
                  Pédiatre / Praticien : <strong>{activePractitioner}</strong>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-bold">Sélectionner le Vaccin PEV à certifier *</label>
                  <select 
                    className="form-select input fw-bold p-2.5"
                    value={selectedVaccineCode}
                    onChange={(e) => setSelectedVaccineCode(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  >
                    {(safeData?.pev_vaccines_0_12m || defaultMaternalData.pev_vaccines_0_12m).map(vac => (
                      <option key={vac.code} value={vac.code}>
                        {vac.name} ({vac.target_age}) - {vac.done ? 'Déjà administré' : 'À administrer'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddVaccineModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-primary fw-bold px-4 text-white">
                    💉 Valider l'Administration
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
