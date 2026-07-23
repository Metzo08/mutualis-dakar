import React, { useState, useEffect } from 'react';

export default function MaternalHealth({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null }) {
  // Identification du rôle et accès
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);

  // Praticiens / Sages-femmes d'État habilités par le Super Admin (synchro localStorage)
  const defaultMaternalPractitioners = [
    { id: 1, name: 'Sage-Femme d\'État Fatou Kiné Diop', specialty: 'Maternité & Suivi Périscolaire', cnom: 'SFE-SN-2026-4412' },
    { id: 2, name: 'Dr. Mariama Ba', specialty: 'Gynécologie-Obstétrique', cnom: 'CNOM-SN-2026-3310' },
    { id: 3, name: 'Dr. Aminata Ndiaye', specialty: 'Pédiatrie & Santé Familiale', cnom: 'CNOM-SN-2026-8819' }
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

  // Données du Carnet de Maternité Numérique (Sénégal)
  const defaultMaternalData = {
    mother_name: citizenUser ? `${citizenUser.first_name || citizenUser.firstName || 'Awa'} ${citizenUser.last_name || citizenUser.lastName || 'Ndiaye'}` : 'Awa Ndiaye',
    cmu_number: citizenUser?.cmu_number || citizenUser?.cmuNumber || 'CMU-DKR-2026-8812',
    pregnancy_start_date: new Date(Date.now() - 110 * 86400000).toISOString(),
    expected_delivery_date: new Date(Date.now() + 160 * 86400000).toISOString(),
    blood_group: 'O Rhésus Positif (O+)',
    assigned_maternity: 'Maternité du Centre de Santé Gaspard Camara (Dakar)',
    risk_level: 'low', // 'low' | 'medium' | 'high'
    weight_before_pregnancy: 62, // kg
    current_weight: 68.5, // kg
    blood_pressure: '11/7 mmHg',
    cpn_records: [
      { id: 1, name: 'CPN 1 (1er Trimestre - Datation & Sérologies)', done: true, date: '2026-04-10', doctor: 'Sage-Femme Fatou Kiné Diop', notes: 'Grossesse intra-utérine évolutive 8 SA. Bilan biologique initial normal, groupe O+.' },
      { id: 2, name: 'CPN 2 (2ème Trimestre - Morphologie & VAT 1)', done: true, date: '2026-06-05', doctor: 'Dr. Mariama Ba (Gynécologue)', notes: 'Hauteur utérine 21 cm. Bruit du cœur fœtal régulier (145 bpm). Injection VAT 1 réalisée.' },
      { id: 3, name: 'CPN 3 (28-32 SA - Dépistage Anémie & TPI-SP 1)', done: false, date: '2026-08-12', doctor: 'Sage-Femme Fatou Kiné Diop', notes: 'Prévue : Contrôle hémoglobine, 1ère dose TPI-SP (Prévention Paludisme) & VAT 2.' },
      { id: 4, name: 'CPN 4+ (36-38 SA - Préparation Accouchement 100% Gratuit)', done: false, date: '2026-09-25', doctor: 'Dr. Mariama Ba (Gynécologue)', notes: 'Prévue : Présentation céphalique, vérification bassin maternel & fiche de liaison.' }
    ],
    vaccinations: {
      vat1: { done: true, date: '2026-06-05' },
      vat2: { done: false, date: '2026-08-12' },
      vat3: { done: false, date: '2027-02-10' }
    },
    prevention: {
      tpi_sp1: { done: false, date: '2026-08-12' },
      tpi_sp2: { done: false, date: '2026-09-25' },
      milda_net: { delivered: true, date: '2026-04-10' }, // Moustiquaire Imprégnée
      iron_folic: { delivered: true, dose: '1 comprimé par jour' }
    },
    ultrasounds: [
      { id: 1, title: 'Échographie Obstétricale T1 (Datation)', date: '2026-04-12', doctor: 'Dr. Mariama Ba', conclusion: 'Fœtus unique, activité cardiaque présente (152 bpm). LCR conforme à la date de début de grossesse.' }
    ]
  };

  const [maternalData, setMaternalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedMsg, setSavedMsg] = useState('');

  // Saisie CPN / Mise à jour par le praticien
  const [showAddCpnModal, setShowAddCpnModal] = useState(false);
  const [newCpnData, setNewCpnData] = useState({
    cpn_id: 3,
    weight: 68.5,
    blood_pressure: '12/7',
    doctor_notes: '',
    vat_administered: false,
    tpi_sp_administered: false
  });

  const fetchMaternalData = async () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem('cmu_maternal_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.cpn_records && Array.isArray(parsed.cpn_records) && parsed.vaccinations) {
          setMaternalData({
            ...defaultMaternalData,
            ...parsed,
            cpn_records: parsed.cpn_records.length > 0 ? parsed.cpn_records : defaultMaternalData.cpn_records,
            vaccinations: { ...defaultMaternalData.vaccinations, ...(parsed.vaccinations || {}) },
            prevention: { ...defaultMaternalData.prevention, ...(parsed.prevention || {}) },
            ultrasounds: Array.isArray(parsed.ultrasounds) ? parsed.ultrasounds : defaultMaternalData.ultrasounds
          });
        } else {
          setMaternalData(defaultMaternalData);
          localStorage.setItem('cmu_maternal_data', JSON.stringify(defaultMaternalData));
        }
      } else {
        setMaternalData(defaultMaternalData);
        localStorage.setItem('cmu_maternal_data', JSON.stringify(defaultMaternalData));
      }
    } catch (err) {
      console.warn(err);
      setMaternalData(defaultMaternalData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaternalData();
  }, []);

  // Validation / Mise à jour CPN par la Sage-Femme / Gynécologue
  const handleUpdateCpnByPractitioner = (e) => {
    e.preventDefault();
    if (!isAgent) {
      alert('🔒 Seule la Sage-Femme d\'État ou le Gynécologue peut valider une consultation prénatale.');
      return;
    }

    const updatedCpnRecords = maternalData.cpn_records.map(cpn => {
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
      current_weight: newCpnData.weight || maternalData.current_weight,
      blood_pressure: newCpnData.blood_pressure || maternalData.blood_pressure,
      cpn_records: updatedCpnRecords,
      vaccinations: {
        ...maternalData.vaccinations,
        vat2: newCpnData.vat_administered ? { done: true, date: new Date().toISOString().slice(0, 10) } : maternalData.vaccinations.vat2
      },
      prevention: {
        ...maternalData.prevention,
        tpi_sp1: newCpnData.tpi_sp_administered ? { done: true, date: new Date().toISOString().slice(0, 10) } : maternalData.prevention.tpi_sp1
      }
    };

    setMaternalData(updatedData);
    localStorage.setItem('cmu_maternal_data', JSON.stringify(updatedData));
    setShowAddCpnModal(false);
    setSavedMsg(`✅ Consultation CPN valide et enregistrée avec succès dans le carnet par ${activePractitioner}.`);
  };

  // Impression / Téléchargement du Carnet de Maternité A4 PDF (Future Maman)
  const handlePrintMaternalPassportPDF = () => {
    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Carnet_Maternite_${maternalData.cmu_number}.pdf</title>
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
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669;">🖨️ Imprimer le Carnet de Maternité A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer</button>
          </div>

          <div class="cert-box">
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0 text-uppercase" style="color: #059669;">RÉPUBLIQUE DU SÉNÉGAL</h6>
                  <small class="text-muted">MINISTÈRE DE LA SANTÉ ET DE L'ACTION SOCIALE</small><br />
                  <strong class="small text-uppercase" style="color: #0f172a;">UNAMUSC SÉNÉGAL — CARNET DE SANTÉ MATERNELLE & PÉRINATALE NUMÉRIQUE</strong>
                </div>
              </div>
              <img src="/unamusc_logo.png" alt="UNAMUSC" style="width: 85px; height: auto;" />
            </div>

            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold text-uppercase mb-1" style="color: #059669;">CARNET OFFICIEL DE LA FUTURE MAMAN — GRATUITÉ 100% CMU</h4>
              <small class="text-muted">Prise en Charge Totale Accouchement & Césarienne dans toute maternité agréée au Sénégal</small>
            </div>

            <div class="row g-3 mb-4 p-3 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block text-muted">FUTURE MAMAN :</span>
                <h5 class="fw-bold mb-0">${maternalData.mother_name}</h5>
                <small class="text-muted">N° Carte CMU : <strong>${maternalData.cmu_number}</strong></small>
              </div>
              <div class="col-6 text-end">
                <span class="small fw-bold d-block text-muted">TERME PRÉVU D'ACCOUCHEMENT (DPA) :</span>
                <h4 class="fw-bold text-success mb-0">${new Date(maternalData.expected_delivery_date).toLocaleDateString('fr-FR')}</h4>
                <span class="badge bg-success">Groupe Sanguin : ${maternalData.blood_group}</span>
              </div>
            </div>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #059669;">📋 CONSULTATIONS PRÉNATALES (CPN 1 À CPN 4+) :</h6>
            <table class="table table-bordered mb-4">
              <thead style="background: #f1f5f9;">
                <tr>
                  <th>Consultation Prénatale</th>
                  <th>Statut</th>
                  <th>Date & Praticien</th>
                  <th>Compte-rendu & Observations</th>
                </tr>
              </thead>
              <tbody>
                ${maternalData.cpn_records.map(cpn => `
                  <tr>
                    <td><strong>${cpn.name}</strong></td>
                    <td align="center">${cpn.done ? '<span class="badge bg-success">✅ Validée</span>' : '<span class="badge bg-warning text-dark">⏳ En attente</span>'}</td>
                    <td><small>${cpn.date ? new Date(cpn.date).toLocaleDateString('fr-FR') : 'À venir'}<br />${cpn.doctor}</small></td>
                    <td><small>${cpn.notes}</small></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <h6 class="fw-bold text-uppercase mb-2" style="color: #059669;">💉 VACCINATION anti-tétanique (vat) & préventions :</h6>
            <div class="row g-2 mb-4">
              <div class="col-6">
                <div class="p-2 border rounded-3 bg-light">
                  <small class="d-block text-muted">Vaccin Anti-Tétanique (VAT) :</small>
                  • VAT 1 : <strong>${maternalData.vaccinations.vat1.done ? `✅ Fait le ${new Date(maternalData.vaccinations.vat1.date).toLocaleDateString('fr-FR')}` : '⏳ Prévu'}</strong><br />
                  • VAT 2 : <strong>${maternalData.vaccinations.vat2.done ? `✅ Fait le ${new Date(maternalData.vaccinations.vat2.date).toLocaleDateString('fr-FR')}` : '⏳ Prévu CPN 3'}</strong>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 border rounded-3 bg-light">
                  <small class="d-block text-muted">Prévention Paludisme (TPI-SP) & Fer :</small>
                  • TPI-SP 1 : <strong>${maternalData.prevention.tpi_sp1.done ? '✅ Administré' : '⏳ À administrer'}</strong><br />
                  • Moustiquaire MILDA : <strong>${maternalData.prevention.milda_net.delivered ? '✅ Délivrée 100% Gratuit' : 'En attente'}</strong>
                </div>
              </div>
            </div>

            <div class="row align-items-center border-top pt-4">
              <div class="col-8">
                <strong class="small text-success d-block mb-1">Droit à la Gratuité Sanitaire Nationale (UNAMUSC) :</strong>
                <p class="small text-muted mb-0">Ce document certifié garantit zéro avance de frais pour la future maman et son nouveau-né lors de l'accouchement dans toutes les maternités publiques du Sénégal.</p>
              </div>
              <div class="col-4 text-center">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(`MATERNITY-${maternalData.cmu_number}`)}" alt="QR Code" style="width: 75px; height: 75px;" />
                <div class="small fw-bold text-success mt-1">Visa Sage-Femme d'État</div>
              </div>
            </div>
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
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.95), rgba(4, 120, 87, 0.92)), url("/csu_kids_real.png") center/cover no-repeat',
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
            🤱 Programme National de Gratuité Maternité CMU Sénégal — Accouchement 100% Pris en Charge
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2.2rem', textShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Tére wéru yaramu jégen ji ak doom ji (Carnet Maternité)' : 'Carnet de Santé Maternelle & Suivi Périnatal'}
          </h1>
          <p className="mb-4 text-white-50 text-center mx-auto" style={{ fontSize: '1.02rem', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)', maxWidth: '750px' }}>
            {isAgent
              ? 'Mode Praticien Habilité (Sage-Femme d\'État / Gynécologue) : Enregistrez et validez les CPN, la vaccination VAT et les échographies obstétricales.'
              : 'Espace Future Maman (Mode Lecture Seule) : Consultez le calendrier de vos consultations CPN, vos vaccins VAT et téléchargez votre carnet certifié PDF A4.'}
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
                onClick={() => setShowAddCpnModal(true)}
              >
                ➕ Valider une Consultation CPN (Sage-Femme / Gynécologue)
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
              onClick={handlePrintMaternalPassportPDF}
            >
              🖨️ Imprimer / Télécharger le Carnet de Maternité PDF A4
            </button>
          </div>
        </div>
      </section>

      {/* SÉLECTEUR DE COMPTE PRATICIEN SI MODE AGENT / MÉDECIN */}
      {isAgent && (
        <div className="card p-3 mb-4 rounded-4 shadow-sm border" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary px-3 py-2 fw-bold">👩‍⚕️ COMPTE PRATICIEN / SAGE-FEMME D'ÉTAT (SUPER ADMIN)</span>
              <span className="small text-muted">Praticien actuellement connecté pour la validation CPN :</span>
            </div>
            <select 
              className="form-select form-select-sm fw-bold border-primary"
              value={activePractitioner}
              onChange={(e) => setActivePractitioner(e.target.value)}
              style={{ borderRadius: '10px', maxWidth: '300px' }}
            >
              {practitioners.map(doc => (
                <option key={doc.id} value={doc.name}>
                  👩‍⚕️ {doc.name} ({doc.specialty})
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
        <div className="text-center py-5 text-muted">Chargement du carnet de maternité...</div>
      ) : (
        <div className="row g-4">
          {/* Suivi des CPN (Consultations Prénatales 1 à 4+) */}
          <div className="col-lg-7">
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🤰 Suivi de Grossesse & CPN (1er à 3ème Trimestre)</h4>
                  <small className="text-muted">Bénéficiaire : <strong>{maternalData.mother_name}</strong> ({maternalData.cmu_number})</small>
                </div>
                {isAgent ? (
                  <span className="badge bg-success px-3 py-2 fw-semibold">✏️ Écriture Praticien</span>
                ) : (
                  <span className="badge bg-secondary text-white px-3 py-2 fw-semibold">🔒 Lecture Seule (Future Maman)</span>
                )}
              </div>

              {/* Dates clés de la grossesse */}
              <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                <div className="row g-4 text-center">
                  <div className="col-6 border-end">
                    <span className="text-muted d-block mb-1 small fw-bold">GROUPE SANGUIN :</span>
                    <strong className="text-danger fs-5 d-block">{maternalData.blood_group}</strong>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block mb-1 small fw-bold">TERME PRÉVU (DPA) :</span>
                    <strong className="text-success fs-5 d-block">
                      👶 {new Date(maternalData.expected_delivery_date).toLocaleDateString('fr-FR')}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>📋 Calendrier Officiel CPN 1 à CPN 4+</h5>
                {isAgent && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-success fw-bold text-white px-3"
                    style={{ borderRadius: '10px', background: '#059669' }}
                    onClick={() => setShowAddCpnModal(true)}
                  >
                    ➕ Enregistrer une CPN
                  </button>
                )}
              </div>
              
              <div className="d-flex flex-column gap-3 mb-4">
                {(maternalData?.cpn_records || defaultMaternalData.cpn_records).map(cpn => (
                  <div key={cpn.id} className="p-3.5 rounded-4 border d-flex justify-content-between align-items-center flex-wrap gap-2 shadow-sm" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                    <div style={{ flex: 1 }}>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{cpn.name}</h6>
                        {cpn.done ? (
                          <span className="badge bg-success">✅ Validée</span>
                        ) : (
                          <span className="badge bg-warning text-dark">⏳ Prochaine Échéance</span>
                        )}
                      </div>
                      <p className="text-muted mb-1 small" style={{ lineHeight: '1.5' }}>{cpn.notes}</p>
                      <small className="text-muted">
                        👩‍⚕️ Praticien référent : <strong>{cpn.doctor}</strong> • Date : {cpn.date ? new Date(cpn.date).toLocaleDateString('fr-FR') : 'À planifier'}
                      </small>
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

          {/* Vaccins VAT, Prévention Paludisme & Examens Échographiques */}
          <div className="col-lg-5">
            {/* Vaccins VAT & Suppléments Maternels */}
            <div className="card shadow-sm border-0 p-4 mb-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span>💉</span> Vaccin Anti-Tétanique (VAT) & Prévention
              </h4>
              
              <div className="d-flex flex-column gap-2.5 mb-3">
                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Vaccin Anti-Tétanique (VAT 1)</strong>
                    <small className="text-muted">1ère injection de protection</small>
                  </div>
                  {maternalData?.vaccinations?.vat1?.done ? (
                    <span className="badge bg-success px-2.5 py-1">✅ Administré ({new Date(maternalData.vaccinations.vat1.date).toLocaleDateString('fr-FR')})</span>
                  ) : (
                    <span className="badge bg-warning text-dark px-2.5 py-1">⏳ À faire CPN 1</span>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Vaccin Anti-Tétanique (VAT 2)</strong>
                    <small className="text-muted">1 mois après VAT 1</small>
                  </div>
                  {maternalData?.vaccinations?.vat2?.done ? (
                    <span className="badge bg-success px-2.5 py-1">✅ Administré ({new Date(maternalData.vaccinations.vat2.date).toLocaleDateString('fr-FR')})</span>
                  ) : (
                    <span className="badge bg-warning text-dark px-2.5 py-1">⏳ Prévu CPN 3</span>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Traitement Préventif Paludisme (TPI-SP)</strong>
                    <small className="text-muted">Sulfadoxine-Pyriméthamine 2ème Trimestre</small>
                  </div>
                  {maternalData?.prevention?.tpi_sp1?.done ? (
                    <span className="badge bg-success px-2.5 py-1">✅ Reçu</span>
                  ) : (
                    <span className="badge bg-info text-dark px-2.5 py-1">⏳ Prévu CPN 3</span>
                  )}
                </div>

                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <strong className="d-block small" style={{ color: 'var(--text-main)' }}>Supplémentation Fer + Acide Folique</strong>
                    <small className="text-muted">Prévention de l'anémie maternelle</small>
                  </div>
                  <span className="badge bg-success px-2.5 py-1">Délivré 100% Gratuit</span>
                </div>
              </div>
            </div>

            {/* Suivi Échographique & Carnet Enfant */}
            <div className="card shadow-sm border-0 p-4 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>
                <span>👶</span> Échographies Obstétricales & Carnet Bébé
              </h4>

              {maternalData.ultrasounds.map(echo => (
                <div key={echo.id} className="p-3 border rounded-3 mb-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <strong className="d-block text-success small mb-1">{echo.title}</strong>
                  <p className="small mb-1" style={{ color: 'var(--text-main)', lineHeight: '1.5' }}>{echo.conclusion}</p>
                  <small className="text-muted">Praticien : {echo.doctor} • Date : {new Date(echo.date).toLocaleDateString('fr-FR')}</small>
                </div>
              ))}

              <button 
                type="button"
                className="btn w-100 fw-bold py-2.5 text-white shadow-sm mt-1" 
                style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', border: 'none', borderRadius: '12px', fontSize: '0.92rem' }} 
                onClick={() => alert('📋 Carnet de Santé Pédiatrique du Nouveau-Né (BCG, Polio VPO0) synchronisé avec le dossier de la mère.')}
              >
                📋 Consulter le Carnet Pédiatrique du Nouveau-Né
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE VALIDATION / SAISIE CPN (PRATICIEN / SAGE-FEMME D'ÉTAT) */}
      {showAddCpnModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)', background: '#059669', color: '#ffffff' }}>
                <h5 className="modal-title fw-bold">
                  ➕ Valider / Enregistrer une Consultation CPN (Sage-Femme d'État)
                </h5>
                <button className="btn-close btn-close-white" onClick={() => setShowAddCpnModal(false)}></button>
              </div>

              <form onSubmit={handleUpdateCpnByPractitioner} className="modal-body p-4">
                <div className="p-2.5 bg-light text-dark rounded-3 mb-3 small border">
                  Sage-Femme / Praticien Valideur : <strong>{activePractitioner}</strong>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold">Sélectionner la Consultation CPN à valider *</label>
                  <select 
                    className="form-select input fw-bold p-2.5"
                    value={newCpnData.cpn_id}
                    onChange={(e) => setNewCpnData({ ...newCpnData, cpn_id: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  >
                    {maternalData.cpn_records.map(cpn => (
                      <option key={cpn.id} value={cpn.id}>
                        {cpn.name} ({cpn.done ? 'Déjà validée' : 'En attente'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row g-3 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-bold">Poids actuel (kg)</label>
                    <input 
                      type="number" 
                      step="0.1" 
                      className="form-control input p-2.5 fw-bold"
                      value={newCpnData.weight}
                      onChange={(e) => setNewCpnData({ ...newCpnData, weight: parseFloat(e.target.value) })}
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-bold">Tension Artérielle (mmHg)</label>
                    <input 
                      type="text" 
                      className="form-control input p-2.5 fw-bold"
                      value={newCpnData.blood_pressure}
                      onChange={(e) => setNewCpnData({ ...newCpnData, blood_pressure: e.target.value })}
                      placeholder="Ex: 12/7"
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold">Compte-rendu & Bruits du Cœur Fœtal (BDCF) *</label>
                  <textarea 
                    className="form-control input p-2.5"
                    rows="3"
                    placeholder="Rédigez les observations de la CPN (hauteur utérine, BDCF, recommandations...)"
                    value={newCpnData.doctor_notes}
                    onChange={(e) => setNewCpnData({ ...newCpnData, doctor_notes: e.target.value })}
                    required
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <div className="p-3 border rounded-3 mb-4 bg-light text-dark">
                  <div className="form-check mb-2">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="vatCheck"
                      checked={newCpnData.vat_administered}
                      onChange={(e) => setNewCpnData({ ...newCpnData, vat_administered: e.target.checked })}
                    />
                    <label className="form-check-label small fw-bold" htmlFor="vatCheck">
                      Injecter le Vaccin Anti-Tétanique (VAT 2) aujourd'hui
                    </label>
                  </div>

                  <div className="form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="tpiCheck"
                      checked={newCpnData.tpi_sp_administered}
                      onChange={(e) => setNewCpnData({ ...newCpnData, tpi_sp_administered: e.target.checked })}
                    />
                    <label className="form-check-label small fw-bold" htmlFor="tpiCheck">
                      Administrer le Traitement Préventif Paludisme (TPI-SP)
                    </label>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary fw-bold" onClick={() => setShowAddCpnModal(false)}>
                    Annuler
                  </button>
                  <button type="submit" className="btn btn-success fw-bold px-4 text-white" style={{ background: '#059669', borderColor: '#059669' }}>
                    ✅ Valider & Certifier la CPN
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
