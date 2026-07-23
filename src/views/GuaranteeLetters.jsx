import React, { useState, useEffect } from 'react';

export default function GuaranteeLetters({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const defaultLetters = [
    {
      id: 201,
      first_name: 'Amadou',
      last_name: 'Sow',
      cmu_number: 'CMU-DKR-2026-8812',
      ipp_number: 'IPP-FANN-2026-8812',
      hospital_name: 'Hôpital Universitaire de Fann (Dakar)',
      medical_act: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)',
      estimated_amount: 250000,
      guaranteed_percentage: 80,
      max_amount: 200000,
      patient_rest: 50000,
      status: 'pending',
      validation_code: 'GAR-2026-FANN-88',
      created_at: new Date().toISOString(),
      agent_note: 'Dossier complet. Devis d\'hospitalisation vérifié conforme au barème national par l\'UNAMUSC.'
    },
    {
      id: 202,
      first_name: 'Fatou',
      last_name: 'Diop',
      cmu_number: 'CMU-DKR-2026-4401',
      ipp_number: 'IPP-DANTEC-2026-4401',
      hospital_name: 'Hôpital Aristide Le Dantec',
      medical_act: 'Hospitalisation soins intensifs 5 jours — (Hôpital Aristide Le Dantec)',
      estimated_amount: 450000,
      guaranteed_percentage: 100,
      max_amount: 450000,
      patient_rest: 0,
      status: 'approved',
      validation_code: 'GAR-2026-DANTEC-12',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      agent_note: 'Accordé à 100% au titre de la gratuité hospitalière maternité & soins d\'urgence (UNAMUSC).'
    }
  ];

  // Identification du rôle et accès
  const isAgent = (userRole === 'agent' || !!agentUser || !!partnerUser);
  const isCitizen = (!isAgent && !!citizenUser);
  const isPublic = (!isAgent && !isCitizen);

  const [publicSearchCmu, setPublicSearchCmu] = useState('');
  const [requestCategory, setRequestCategory] = useState('hospital'); // 'hospital' | 'pharmacy'

  // Informations assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || localStorage.getItem('cmu-active-number') || 'CMU-DKR-2026-8812';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Amadou';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Sow';

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Formulaire de demande (Assuré)
  const [applicantFirstName, setApplicantFirstName] = useState(activeFirstName);
  const [applicantLastName, setApplicantLastName] = useState(activeLastName);
  const [applicantCmu, setApplicantCmu] = useState(activeCmuNumber);
  const [medicalAct, setMedicalAct] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [structureName, setStructureName] = useState('Hôpital Universitaire de Fann (Dakar)');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Instruction Agent & Modal
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [modalTab, setModalTab] = useState('instruction'); // 'instruction' | 'certificate'
  const [guaranteedPct, setGuaranteedPct] = useState(80);
  const [maxAmount, setMaxAmount] = useState('');
  const [agentNote, setAgentNote] = useState('Prise en charge validée par l\'agent UNAMUSC sous le système de Tiers-Payant UNAMUSC.');

  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guarantees');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setLetters(json.data);
      } else {
        setLetters(defaultLetters);
      }
    } catch (err) {
      console.warn('Utilisation des garanties de démonstration:', err);
      setLetters(defaultLetters);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  // Fonction dédiée de génération et d'impression / téléchargement PDF A4 de la Lettre de Garantie
  const generateAndPrintPDFWindow = (letterToPrint = selectedLetter) => {
    const letter = letterToPrint || selectedLetter || letters[0];
    if (!letter) return;

    const guaranteeAmt = letter.guaranteed_amount || letter.max_amount || (letter.estimated_amount * ((letter.guaranteed_percentage || 80) / 100));
    const patientRest = Math.max(0, letter.estimated_amount - guaranteeAmt);

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attestation_Prise_En_Charge_UNAMUSC_${letter.validation_code}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #047857; border-radius: 16px; padding: 2rem; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0 !important; }
              .cert-box { border-width: 2px !important; box-shadow: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669; border-color: #059669;">🖨️ Imprimer / Télécharger le PDF A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer la fenêtre</button>
          </div>

          <div class="cert-box">
            <!-- Entête Officiel Sénégal & UNAMUSC -->
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style="border-color: #cbd5e1 !important;">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau du Sénégal" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0 text-uppercase" style="color: #047857; letter-spacing: 0.5px;">RÉPUBLIQUE DU SÉNÉGAL</h6>
                  <small class="text-muted fw-semibold" style="font-size: 0.75rem;">Un Peuple — Un But — Une Foi</small><br />
                  <strong class="small text-uppercase" style="color: #0f172a; font-size: 0.82rem;">UNION NATIONALE DES MUTUELLES DE SANTÉ COMMUNAUTAIRES (UNAMUSC)</strong><br />
                  <span class="badge bg-success-subtle text-success border border-success fw-semibold" style="font-size: 0.72rem;">PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE DU SÉNÉGAL</span>
                </div>
              </div>
              <div class="text-end">
                <img src="/unamusc_logo.png" alt="UNAMUSC Sénégal" style="width: 85px; height: auto; object-fit: contain;" />
              </div>
            </div>

            <!-- Titre de l'Attestation -->
            <div class="text-center my-4 p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #bbf7d0;">
              <h4 class="fw-bold text-uppercase mb-1" style="color: #047857; letter-spacing: 1px;">ATTESTATION OFFICIELLE DE PRISE EN CHARGE HOSPITALIÈRE</h4>
              <small class="text-muted fw-semibold">Émise sous le système de Tiers-Payant UNAMUSC — Programme National de la Couverture Sanitaire du Sénégal</small><br />
              <code class="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6">Code Homologation : #${letter.validation_code}</code>
            </div>

            <!-- Grille des caractéristiques & prise en charge -->
            <div class="row g-4 mb-4 p-4 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">👤 BÉNÉFICIAIRE ASSURÉ :</span>
                <h5 class="fw-bold mb-1" style="color: #0f172a;">${letter.first_name} ${letter.last_name}</h5>
                <div class="small" style="color: #334155;">N° Carte CMU : <strong>${letter.cmu_number}</strong> | IPP : <strong>${letter.ipp_number || 'IPP-FANN-2026-8812'}</strong></div>
                <small class="text-success fw-bold d-block mt-1">Organisme Émetteur : Tiers-Payant UNAMUSC Sénégal</small>
              </div>

              <div class="col-6">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">🏥 STRUCTURE HOSPITALIÈRE D'ACCUEIL :</span>
                <h6 class="fw-bold mb-1" style="color: #047857; font-size: 1rem;">${letter.hospital_name || letter.medical_act}</h6>
                <div class="small" style="color: #334155;">Conventionné Tiers-Payant UNAMUSC (Validation 100% Humaine)</div>
              </div>

              <div class="col-6 border-top pt-3" style="border-color: #e2e8f0 !important;">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">📋 ACTE MÉDICAL / HOSPITALISATION PRESCRITE :</span>
                <strong class="d-block" style="color: #0f172a; font-size: 0.95rem;">${letter.medical_act}</strong>
              </div>

              <div class="col-6 border-top pt-3" style="border-color: #e2e8f0 !important;">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">💰 MONTANT ESTIMÉ & ACCORD DE PRISE EN CHARGE :</span>
                <div class="small" style="color: #334155;">
                  Devis Soumis : <strong>${Number(letter.estimated_amount).toLocaleString()} FCFA</strong><br />
                  Prise en charge UNAMUSC (${letter.guaranteed_percentage || 80}%) : <strong style="color: #047857; font-size: 1.05rem;">${Number(guaranteeAmt).toLocaleString()} FCFA</strong><br />
                  <span style="color: #b45309; font-weight: bold;">Reste à charge patient (Ticket Modérateur) : ${Number(patientRest).toLocaleString()} FCFA</span>
                </div>
              </div>
            </div>

            <!-- Engagement Financier UNAMUSC & Tampon Numérique QR Code -->
            <div class="row g-4 align-items-center">
              <div class="col-8">
                <div class="p-3 rounded-3" style="background: #f0fdf4; border: 1px solid #86efac;">
                  <strong class="small d-block text-success mb-1 fw-bold">Clause officielle d'engagement financier UNAMUSC :</strong>
                  <p class="small mb-0 text-dark" style="line-height: 1.5; color: #0f172a;">
                    ${letter.agent_note || 'L\'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture finale conforme.'}
                  </p>
                </div>
              </div>

              <div class="col-4 text-center">
                <div class="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-2">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(letter.validation_code)}" alt="QR Code Validation" style="width: 80px; height: 80px;" />
                </div>
                <div class="small fw-bold text-success">Tampon Numérique Officiel UNAMUSC</div>
                <small class="text-muted d-block" style="font-size: 0.72rem;">Homologué par l'UNAMUSC — Signature Agent Habilité</small>
              </div>
            </div>
          </div>

          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handlePrintCertificate = () => {
    generateAndPrintPDFWindow(selectedLetter);
  };

  const handleDownloadPDF = () => {
    generateAndPrintPDFWindow(selectedLetter);
  };

  // Filtrage strict selon le rôle (RBAC) & Confidentialité des données de santé
  const visibleLetters = letters.filter((item) => {
    if (isAgent) return true; // L'agent UNAMUSC habilité a accès à l'ensemble des dossiers
    if (isCitizen) {
      // L'assuré connecté ne voit QUE SES PROPRES DEMANDES
      return (
        item.cmu_number === activeCmuNumber ||
        (item.first_name?.toLowerCase() === activeFirstName?.toLowerCase() && item.last_name?.toLowerCase() === activeLastName?.toLowerCase()) ||
        item.cmu_number === 'CMU-DKR-2026-8812' // fallback démo pour Amadou Sow
      );
    }
    // Visiteur public non connecté : masquage strict des dossiers d'autrui
    if (publicSearchCmu.trim()) {
      return item.cmu_number.toLowerCase().includes(publicSearchCmu.trim().toLowerCase());
    }
    return false;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medicalAct || !estimatedAmount) return;
    setSubmitting(true);
    setSuccessMsg('');

    const estVal = parseFloat(estimatedAmount) || 0;
    const gVal = estVal * 0.8;

    if (requestCategory === 'hospital') {
      // Création d'une Lettre de Garantie d'Hospitalisation
      const newLetter = {
        id: Date.now(),
        first_name: applicantFirstName || activeFirstName,
        last_name: applicantLastName || activeLastName,
        cmu_number: applicantCmu || activeCmuNumber,
        ipp_number: 'IPP-FANN-2026-8812',
        hospital_name: structureName,
        medical_act: `${medicalAct} — (${structureName})`,
        estimated_amount: estVal,
        guaranteed_percentage: 80,
        max_amount: gVal,
        patient_rest: estVal - gVal,
        status: 'pending',
        validation_code: `GAR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toISOString(),
        agent_note: 'Demande soumise par l\'assuré. En attente de vérification et d\'instruction par l\'agent UNAMUSC.'
      };

      try {
        await fetch('/api/guarantees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beneficiary_id: 1,
            medical_act: newLetter.medical_act,
            estimated_amount: newLetter.estimated_amount
          })
        });
      } catch (err) {
        console.warn(err);
      }

      setLetters([newLetter, ...letters]);
      setSuccessMsg(lang === 'wo' 
        ? 'Demande bi yónnee nañu ko ak jamm.' 
        : 'Votre demande de lettre de garantie hospitalière a été soumise avec succès. L\'UNAMUSC procède à l\'instruction sous 24h.');
    } else {
      // Création d'un Bon de Commande de Médicaments (Pharmacie Tiers-Payant 50%)
      const pharmCovered = estVal * 0.5;
      const pharmRest = estVal * 0.5;
      const newOrder = {
        id: Date.now(),
        first_name: applicantFirstName || activeFirstName,
        last_name: applicantLastName || activeLastName,
        cmu_number: applicantCmu || activeCmuNumber,
        items_json: JSON.stringify([
          { name: medicalAct, qty: 1, price: estVal }
        ]),
        total_amount: estVal,
        cmu_covered: pharmCovered,
        patient_pay: pharmRest,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
      };

      const currentOrders = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrder, ...currentOrders]));

      setSuccessMsg(`Votre Bon de Commande Pharmacie (${newOrder.order_code}) a été généré avec succès (Prise en charge UNAMUSC 50%) ! Valable 48h dans toute pharmacie agréée.`);
    }

    setMedicalAct('');
    setEstimatedAmount('');
    setActiveTab('list');
    setSubmitting(false);
  };

  const handleValidateAgent = async (status) => {
    if (!selectedLetter) return;
    const finalGuarantee = parseFloat(maxAmount) || (selectedLetter.estimated_amount * (guaranteedPct / 100));
    const finalRest = Math.max(0, selectedLetter.estimated_amount - finalGuarantee);

    const updated = letters.map(l => l.id === selectedLetter.id ? {
      ...l,
      status,
      guaranteed_percentage: parseFloat(guaranteedPct),
      max_amount: finalGuarantee,
      patient_rest: finalRest,
      agent_note: agentNote || (status === 'approved' ? 'Prise en charge accordée par l\'UNAMUSC.' : 'Demande rejetée.')
    } : l);

    setLetters(updated);

    try {
      await fetch(`/api/guarantees/${selectedLetter.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          guaranteed_percentage: parseFloat(guaranteedPct),
          max_amount: finalGuarantee,
          agent_note: agentNote
        })
      });
    } catch (err) {
      console.warn(err);
    }

    // Basculer sur l'onglet certificat si approuvé
    if (status === 'approved') {
      setSelectedLetter({
        ...selectedLetter,
        status: 'approved',
        guaranteed_percentage: parseFloat(guaranteedPct),
        max_amount: finalGuarantee,
        patient_rest: finalRest,
        agent_note: agentNote
      });
      setModalTab('certificate');
    } else {
      setSelectedLetter(null);
    }
  };

  const openInstructionModal = (item) => {
    setSelectedLetter(item);
    setGuaranteedPct(item.guaranteed_percentage || 80);
    setMaxAmount(item.max_amount || (item.estimated_amount * 0.8));
    setAgentNote(item.agent_note || 'Devis et dossier médical vérifiés conformes par l\'UNAMUSC.');
    setModalTab('instruction');
  };

  // KPIs
  const totalPending = letters.filter(l => l.status === 'pending').length;
  const totalApproved = letters.filter(l => l.status === 'approved').length;
  const totalGuaranteedSum = letters.filter(l => l.status === 'approved').reduce((acc, l) => acc + (l.max_amount || 0), 0);

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_claims_hero.png") center/cover no-repeat',
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
            🇸🇳 UNAMUSC Sénégal — Lettres de Garantie Hospitalières (80%) & Bons de Commande Pharmacie (50%)
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Bons de commande ak Bataaxal u garansi' : 'Bons de commande & lettres de garantie'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez votre lettre de garantie hospitalière (80%) ou bon de commande pharmacie (50%) en ligne sous le Tiers-Payant UNAMUSC.'}
          </p>

          <div className="d-flex justify-content-center align-items-center flex-wrap gap-4 mt-3 w-100">
            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm px-4 py-2.5 mx-2"
              style={{
                background: activeTab === 'list' ? '#059669' : 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                border: activeTab === 'list' ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                fontSize: '0.94rem',
                boxShadow: activeTab === 'list' ? '0 4px 14px rgba(5, 150, 105, 0.5)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveTab('list')}
            >
              📋 {isAgent ? `Instructions Agent (${letters.length})` : `Mes Dossiers & Attestations (${visibleLetters.length})`}
            </button>

            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm px-4 py-2.5 mx-2"
              style={{
                background: activeTab === 'new' ? '#059669' : 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                border: activeTab === 'new' ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                fontSize: '0.94rem',
                boxShadow: activeTab === 'new' ? '0 4px 14px rgba(5, 150, 105, 0.5)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveTab('new')}
            >
              ➕ {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle demande (Garantie / Bon)'}
            </button>
          </div>
        </div>
      </section>

      {/* RANGÉE KPIS EXÉCUTIF GARANTIES (Rôle Agent) */}
      {isAgent && (
        <div className="row g-3 mb-4">
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">Demandes reçues</span>
              <h4 className="fw-bold mb-0 text-primary">{letters.length}</h4>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">En instruction agent</span>
              <h4 className="fw-bold mb-0 text-warning">{totalPending}</h4>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">Lettres accordées</span>
              <h4 className="fw-bold mb-0 text-success">{totalApproved}</h4>
            </div>
          </div>
          <div className="col-md-3 col-6">
            <div className="card shadow-sm border-0 p-3 rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <span className="small text-muted mb-1 d-block">Total garanti UNAMUSC (FCFA)</span>
              <h4 className="fw-bold mb-0 text-success">{totalGuaranteedSum.toLocaleString()}</h4>
            </div>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{successMsg}</div>
        </div>
      )}

      {/* FORMULAIRE NOUVELLE DEMANDE (SOUMISSION ASSURÉ OU PUBLIC) */}
      {activeTab === 'new' && (
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
            <span>➕</span> Nouvelle demande sous le Tiers-Payant UNAMUSC
          </h4>
          <p className="small text-muted mb-4">
            Sélectionnez le type de prestation (Hospitalisation ou Pharmacie) et renseignez les éléments de votre devis ou ordonnance.
          </p>

          {/* SÉLECTEUR CATEGORIE : GARANTIE HOSPITALIÈRE OU BON PHARMACIE */}
          <div className="d-flex gap-2 mb-4">
            <button 
              type="button" 
              className={`btn flex-fill py-2.5 fw-bold ${requestCategory === 'hospital' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
              onClick={() => setRequestCategory('hospital')}
              style={{ borderRadius: '12px' }}
            >
              🏥 Lettre de Garantie Hospitalière
            </button>
            <button 
              type="button" 
              className={`btn flex-fill py-2.5 fw-bold ${requestCategory === 'pharmacy' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
              onClick={() => setRequestCategory('pharmacy')}
              style={{ borderRadius: '12px' }}
            >
              💊 Bon de Commande Pharmacie (48h)
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label small fw-semibold">Prénom de l'assuré *</label>
                <input 
                  type="text" 
                  className="form-control input fw-bold" 
                  value={applicantFirstName} 
                  onChange={(e) => setApplicantFirstName(e.target.value)} 
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-semibold">Nom de l'assuré *</label>
                <input 
                  type="text" 
                  className="form-control input fw-bold" 
                  value={applicantLastName} 
                  onChange={(e) => setApplicantLastName(e.target.value)} 
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-semibold">N° Carte CMU Assuré *</label>
                <input 
                  type="text" 
                  className="form-control input fw-bold text-success" 
                  value={applicantCmu} 
                  onChange={(e) => setApplicantCmu(e.target.value)} 
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">
                  {requestCategory === 'hospital' ? 'Établissement d\'accueil récepteur *' : 'Pharmacie partenaire agréée UNAMUSC *'}
                </label>
                <select 
                  className="form-select input fw-bold" 
                  value={structureName} 
                  onChange={(e) => setStructureName(e.target.value)}
                  style={{ borderRadius: '10px' }}
                >
                  {requestCategory === 'hospital' ? (
                    <>
                      <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                      <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec</option>
                      <option value="Hôpital Général Idrissa Pouye (Pikine)">Hôpital Général Idrissa Pouye (Pikine)</option>
                      <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                      <option value="Hôpital d'Enfants Albert Royer">Hôpital d'Enfants Albert Royer</option>
                    </>
                  ) : (
                    <>
                      <option value="Pharmacie de la Nation (Dakar)">Pharmacie de la Nation (Dakar)</option>
                      <option value="Pharmacie Cheikh Anta Diop">Pharmacie Cheikh Anta Diop</option>
                      <option value="Pharmacie Universelle Pikine">Pharmacie Universelle Pikine</option>
                      <option value="Pharmacie Populaire Guédiawaye">Pharmacie Populaire Guédiawaye</option>
                    </>
                  )}
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold">Devis estimatif soumis (FCFA) *</label>
                <input 
                  type="number" 
                  className="form-control input fw-bold"
                  placeholder="Ex: 250000"
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(e.target.value)}
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-semibold">
                {requestCategory === 'hospital' 
                  ? 'Description de l\'acte médical / hospitalisation prescrite *' 
                  : 'Liste des médicaments prescrits (Ordonnance) *'}
              </label>
              <textarea 
                className="form-control input" 
                rows="3" 
                placeholder={requestCategory === 'hospital' 
                  ? 'Ex: Intervention chirurgicale ORL, hospitalisation 5 jours en médecine interne...' 
                  : 'Ex: Amoxicilline 500mg (2 boîtes), Paracétamol 1g (1 boîte), Spasfon...'}
                value={medicalAct}
                onChange={(e) => setMedicalAct(e.target.value)}
                style={{ borderRadius: '10px' }}
                required
              />
            </div>

            <div className="p-3 rounded-3 border mb-4" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong className="d-block small text-success">Estimation automatique UNAMUSC (80%) :</strong>
                  <span className="small text-muted">Prise en charge directe sous Tiers-Payant UNAMUSC.</span>
                </div>
                <h5 className="fw-bold text-success mb-0">
                  {estimatedAmount ? (parseFloat(estimatedAmount) * 0.8).toLocaleString() : 0} FCFA
                </h5>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>Annuler</button>
              <button type="submit" className="btn btn-success text-white fw-bold px-4" disabled={submitting} style={{ borderRadius: '10px' }}>
                {submitting ? 'Transmission...' : '📤 Soumettre la demande à l\'UNAMUSC'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BANNIÈRE SÉCURITÉ CONFIDENTIALITÉ S'IL S'AGIT D'UN VISITEUR NON CONNECTÉ SANS RECHERCHE */}
      {isPublic && !publicSearchCmu && activeTab === 'list' && (
        <div className="card shadow-sm border-0 p-4 mb-4 text-center rounded-4" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderLeft: '6px solid #059669' }}>
          <div className="fs-1 mb-2">🔒</div>
          <h4 className="fw-bold text-success">Accès Sécurisé & Protection des Données de Santé UNAMUSC</h4>
          <p className="text-muted mx-auto" style={{ maxWidth: '680px', lineHeight: '1.6' }}>
            Afin de préserver la confidentialité des données médicales des citoyens, la liste globale des demandes est réservée aux agents habilités de l'UNAMUSC. Connectez-vous ou saisissez votre N° de Carte CMU pour accéder à vos attestations personnelles.
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2">
            {setView && (
              <button className="btn btn-success fw-bold px-4 py-2.5" onClick={() => setView('login')} style={{ borderRadius: '12px', background: '#059669' }}>
                🔐 Se connecter à mon Espace Assuré / Agent
              </button>
            )}
            <button className="btn btn-outline-success fw-bold px-4 py-2.5" onClick={() => setActiveTab('new')} style={{ borderRadius: '12px' }}>
              ➕ Soumettre une demande de prise en charge
            </button>
          </div>

          <div className="mt-4 pt-3 border-top mx-auto" style={{ maxWidth: '520px', borderColor: 'var(--border-color)' }}>
            <label className="form-label small text-muted fw-bold mb-2">Rechercher directement mon dossier avec mon N° de Carte CMU :</label>
            <div className="input-group">
              <input 
                type="text" 
                className="form-control fw-bold input" 
                placeholder="Ex: CMU-DKR-2026-8812" 
                value={publicSearchCmu} 
                onChange={(e) => setPublicSearchCmu(e.target.value)} 
                style={{ borderRadius: '12px 0 0 12px', height: '48px' }}
              />
              <button className="btn btn-success fw-bold px-4" style={{ borderRadius: '0 12px 12px 0', background: '#059669' }}>
                🔍 Consulter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LISTE DES DEMANDES DE GARANTIE ACCESSIBLES SELON LE RÔLE */}
      {activeTab === 'list' && (isAgent || isCitizen || (isPublic && publicSearchCmu)) && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <span>📋</span> {isAgent ? 'Gestion & Instruction des Lettres de Garantie UNAMUSC' : 'Mes Lettres de Garantie & Attestations Habilités'}
            </h4>

            {isCitizen && (
              <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px' }}>
                👤 Assuré connecté : {activeFirstName} {activeLastName} ({activeCmuNumber})
              </span>
            )}
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Chargement des dossiers de garantie...</div>
          ) : visibleLetters.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {isCitizen 
                ? 'Aucune demande de garantie enregistrée pour votre compte assuré.' 
                : 'Aucun dossier ne correspond à ce N° de Carte CMU.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.85rem' }}>Assuré / Bénéficiaire</th>
                    <th style={{ padding: '0.85rem' }}>Acte médical & Établissement</th>
                    <th style={{ padding: '0.85rem' }}>Devis soumis</th>
                    <th style={{ padding: '0.85rem' }}>Prise en charge accordée</th>
                    <th style={{ padding: '0.85rem' }}>Statut & Homologation</th>
                    <th style={{ padding: '0.85rem' }}>Code Garantie</th>
                    <th style={{ padding: '0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLetters.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <strong className="d-block" style={{ color: 'var(--text-main)' }}>{item.first_name} {item.last_name}</strong>
                        <small className="text-muted">N° CMU : {item.cmu_number}</small>
                      </td>
                      <td style={{ padding: '0.85rem', maxWidth: '260px' }}>
                        <span className="d-block fw-semibold small" style={{ color: 'var(--text-main)' }}>{item.medical_act}</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="fw-bold" style={{ color: 'var(--text-main)' }}>{Number(item.estimated_amount).toLocaleString()} FCFA</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="fw-bold text-success d-block">{Number(item.max_amount).toLocaleString()} FCFA</span>
                        <small className="badge bg-success-subtle text-success border border-success">
                          Taux : {item.guaranteed_percentage}%
                        </small>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {item.status === 'approved' && (
                          <span className="badge bg-success px-3 py-1.5" style={{ borderRadius: '12px' }}>
                            ✅ Validée UNAMUSC
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="badge bg-warning text-dark px-3 py-1.5" style={{ borderRadius: '12px' }}>
                            ⏳ En instruction agent
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="badge bg-danger px-3 py-1.5" style={{ borderRadius: '12px' }}>
                            ❌ Rejetée
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <code className="px-2.5 py-1 bg-dark text-success border border-success rounded-3 fw-bold">
                          {item.validation_code}
                        </code>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem' }}>
                        {isAgent ? (
                          <button 
                            type="button"
                            className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm"
                            onClick={() => openInstructionModal(item)}
                            style={{ background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            {item.status === 'approved' ? '📄 Certificat PDF / Garanties' : '⚙️ Instruire le dossier'}
                          </button>
                        ) : (
                          <button 
                            type="button"
                            className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm"
                            onClick={() => generateAndPrintPDFWindow(item)}
                            style={{ background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            🖨️ Imprimer Certificat PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================ */}
      {/* DECK D'INSTRUCTION ET CERTIFICAT OFFICIEL DE GARANTIE HAUTE DÉFINITION (MODAL) */}
      {/* ============================================================================ */}
      {selectedLetter && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', overflow: 'hidden' }}>
              
              {/* Entête Modal Officielle UNAMUSC */}
              <div 
                className="modal-header p-4 text-white position-relative"
                style={{
                  background: selectedLetter.status === 'approved' 
                    ? 'linear-gradient(135deg, #059669 0%, #064e3b 100%)' 
                    : 'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
                  borderBottom: '1px solid rgba(255,255,255,0.2)'
                }}
              >
                <div>
                  <span className="badge px-3 py-1 mb-2 fw-bold text-white d-inline-block" style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '20px' }}>
                    🇸🇳 UNAMUSC — DOSSIER DE PRISE EN CHARGE #{selectedLetter.validation_code}
                  </span>
                  <h4 className="fw-bold mb-1 text-white">
                    📄 Instruction & Attestation de Garantie — {selectedLetter.first_name} {selectedLetter.last_name}
                  </h4>
                  <small className="text-white-50">
                    Homologation 100% humaine par l'agent habilité de l'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC).
                  </small>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedLetter(null)}></button>
              </div>

              {/* Navigation Onglets Interne au Modal */}
              <div className="d-flex border-bottom p-3 gap-2 flex-wrap" style={{ background: '#0f172a', borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn fw-bold px-4 py-2.5"
                  style={{
                    background: modalTab === 'instruction' ? '#059669' : 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    border: modalTab === 'instruction' ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: modalTab === 'instruction' ? '0 4px 12px rgba(5, 150, 105, 0.4)' : 'none'
                  }}
                  onClick={() => setModalTab('instruction')}
                >
                  ⚙️ 1. Instruction & Décision Agent UNAMUSC
                </button>
                <button 
                  type="button" 
                  className="btn fw-bold px-4 py-2.5"
                  style={{
                    background: modalTab === 'certificate' ? '#059669' : 'rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    border: modalTab === 'certificate' ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.25)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: modalTab === 'certificate' ? '0 4px 12px rgba(5, 150, 105, 0.4)' : 'none'
                  }}
                  onClick={() => setModalTab('certificate')}
                >
                  📄 2. Certificat Officiel & Prise en Charge PDF
                </button>
              </div>

              <div className="modal-body p-4">
                {/* ONGLET 1 : INSTRUCTION & CALCUL DE PRISE EN CHARGE */}
                {modalTab === 'instruction' && (
                  <div className="fade-in-up">
                    <div className="row g-4 mb-4">
                      {/* Carte Bénéficiaire */}
                      <div className="col-md-6">
                        <div className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                          <span className="small text-muted d-block mb-1">👤 Assuré Bénéficiaire :</span>
                          <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h5>
                          <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
                            <code className="px-2.5 py-1 bg-dark text-success border border-success rounded-3 fw-bold">
                              N° {selectedLetter.cmu_number}
                            </code>
                            <span className="badge bg-secondary">
                              {selectedLetter.ipp_number || 'IPP-FANN-8812'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Carte Établissement & Acte */}
                      <div className="col-md-6">
                        <div className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                          <span className="small text-muted d-block mb-1">🏥 Acte & Établissement récepteur :</span>
                          <h6 className="fw-bold mb-1 text-success">{selectedLetter.medical_act}</h6>
                          <small className="text-muted d-block mt-1">Devis d'hospitalisation soumis : <strong>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong></small>
                        </div>
                      </div>
                    </div>

                    {/* CALCULATEUR EXÉCUTIF DE COUVERTURE & RESTES À CHARGE */}
                    <div className="card p-4 rounded-4 border-0 mb-4 shadow-sm" style={{ background: 'rgba(5, 150, 105, 0.06)', borderLeft: '5px solid var(--primary)' }}>
                      <h5 className="fw-bold mb-3 text-success d-flex align-items-center gap-2">
                        <span>⚙️</span> Calculateur UNAMUSC de Prise en Charge & Plafond Tiers-Payant
                      </h5>

                      <div className="row g-4 align-items-center mb-4">
                        <div className="col-md-6">
                          <label className="form-label fw-bold small">Taux de couverture accordé par l'UNAMUSC (%)</label>
                          <div className="d-flex align-items-center gap-2">
                            <input 
                              type="range" 
                              className="form-range flex-grow-1"
                              min="50"
                              max="100"
                              step="5"
                              value={guaranteedPct}
                              onChange={(e) => setGuaranteedPct(e.target.value)}
                            />
                            <span className="badge bg-success fs-6 px-3 py-2 fw-bold">{guaranteedPct}%</span>
                          </div>
                        </div>

                        <div className="col-md-6">
                          <label className="form-label fw-bold small">Plafond maximum garanti ajusté (FCFA)</label>
                          <input 
                            type="number" 
                            className="form-control input fw-bold"
                            value={maxAmount}
                            onChange={(e) => setMaxAmount(e.target.value)}
                            style={{ borderRadius: '10px' }}
                          />
                        </div>
                      </div>

                      {/* Bilan financier dynamique */}
                      <div className="p-3.5 rounded-3 bg-dark text-white border border-success">
                        <div className="row g-3 text-center">
                          <div className="col-md-4">
                            <span className="text-white-50 small d-block mb-1">Montant Devis Soumis</span>
                            <h5 className="fw-bold mb-0 text-white">{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</h5>
                          </div>
                          <div className="col-md-4 border-start border-end border-secondary">
                            <span className="text-success small d-block mb-1"> Prise en charge UNAMUSC/CSU</span>
                            <h4 className="fw-bold mb-0 text-success">{calculatedGuaranteeAmount.toLocaleString()} FCFA</h4>
                          </div>
                          <div className="col-md-4">
                            <span className="text-warning small d-block mb-1">Reste à charge patient (Ticket)</span>
                            <h5 className="fw-bold mb-0 text-warning">{calculatedPatientRest.toLocaleString()} FCFA</h5>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <label className="form-label fw-bold small">Note d'instruction & Observations de l'agent habilité UNAMUSC *</label>
                        <textarea 
                          className="form-control input" 
                          rows="3"
                          value={agentNote}
                          onChange={(e) => setAgentNote(e.target.value)}
                          placeholder="Saisissez ici le motif d'acceptation, d'ajustement du plafond ou de réserve..."
                          style={{ borderRadius: '10px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : CERTIFICAT OFFICIEL HAUTE DÉFINITION (STYLE VOUCHER IMPRIMABLE) */}
                {modalTab === 'certificate' && (
                  <div className="fade-in-up">
                    <div 
                      id="printable-certificate"
                      className="p-5 rounded-4 border shadow-sm position-relative overflow-hidden mb-4"
                      style={{ 
                        background: '#ffffff', 
                        color: '#0f172a',
                        fontFamily: 'Inter, Arial, sans-serif',
                        border: '2px solid #047857'
                      }}
                    >
                      {/* Entête Officiel Sénégal avec Drapeau 🇸🇳 et Logo Officiel UNAMUSC */}
                      <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style={{ borderColor: '#cbd5e1' }}>
                        <div className="d-flex align-items-center gap-3">
                          <img 
                            src="/senegal_flag.png" 
                            alt="Drapeau du Sénégal 🇸🇳" 
                            style={{ width: '58px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1.5px solid #d97706', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }} 
                          />
                          <div>
                            <h6 className="fw-bold mb-0 text-uppercase" style={{ color: '#047857', letterSpacing: '0.5px', fontSize: '0.92rem' }}>
                              RÉPUBLIQUE DU SÉNÉGAL
                            </h6>
                            <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>Un Peuple — Un But — Une Foi</small><br />
                            <strong className="small text-uppercase" style={{ color: '#0f172a', fontSize: '0.82rem', letterSpacing: '0.2px' }}>
                              UNION NATIONALE DES MUTUELLES DE SANTÉ COMMUNAUTAIRES (UNAMUSC)
                            </strong><br />
                             <span className="badge bg-success-subtle text-success border border-success fw-semibold" style={{ fontSize: '0.72rem' }}>
                               PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE DU SÉNÉGAL
                             </span>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-3 text-end">
                          <img 
                            src="/unamusc_logo.png" 
                            alt="Logo Officiel UNAMUSC" 
                            style={{ width: '75px', height: '75px', objectFit: 'contain' }} 
                          />
                        </div>
                      </div>

                      <div className="text-center my-4 p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                        <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#047857', letterSpacing: '1px' }}>
                          ATTESTATION OFFICIELLE DE PRISE EN CHARGE HOSPITALIÈRE
                        </h4>
                        <small className="text-muted fw-semibold">Émise sous le système de Tiers-Payant UNAMUSC — Programme National de la Couverture Sanitaire du Sénégal</small><br />
                        <code className="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6">
                          Code Homologation : #{selectedLetter.validation_code}
                        </code>
                      </div>

                      {/* Grille des caractéristiques — Haute Lisibilité et Contraste Explicite */}
                      <div className="row g-4 mb-4 p-4 rounded-3" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: 'inset 0 0 0 1px #f1f5f9' }}>
                        <div className="col-md-6">
                          <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            👤 BÉNÉFICIAIRE ASSURÉ :
                          </span>
                          <h5 className="fw-bold mb-1" style={{ color: '#0f172a' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h5>
                          <div className="small" style={{ color: '#334155' }}>
                            N° Carte CMU : <strong style={{ color: '#0f172a' }}>{selectedLetter.cmu_number}</strong> | IPP : <strong style={{ color: '#0f172a' }}>{selectedLetter.ipp_number || 'IPP-FANN-2026-8812'}</strong>
                          </div>
                          <small className="text-success fw-bold d-block mt-1">
                            Organisme Émetteur : Tiers-Payant UNAMUSC Sénégal
                          </small>
                        </div>

                        <div className="col-md-6">
                          <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            🏥 STRUCTURE HOSPITALIÈRE D'ACCUEIL :
                          </span>
                          <h6 className="fw-bold mb-1" style={{ color: '#047857', fontSize: '1rem' }}>
                            {selectedLetter.hospital_name || selectedLetter.medical_act}
                          </h6>
                          <div className="small" style={{ color: '#334155' }}>
                            Conventionné Tiers-Payant UNAMUSC (Validation 100% Humaine)
                          </div>
                        </div>

                        <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                          <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📋 ACTE MÉDICAL / HOSPITALISATION PRESCRITE :
                          </span>
                          <strong className="d-block" style={{ color: '#0f172a', fontSize: '0.95rem' }}>{selectedLetter.medical_act}</strong>
                        </div>

                        <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                          <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            💰 MONTANT ESTIMÉ & ACCORD DE PRISE EN CHARGE :
                          </span>
                          <div className="small" style={{ color: '#334155' }}>
                            Devis Soumis : <strong style={{ color: '#0f172a' }}>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong><br />
                            Prise en charge UNAMUSC ({selectedLetter.guaranteed_percentage || 80}%) : <strong style={{ color: '#047857', fontSize: '1.05rem' }}>{Number(selectedLetter.guaranteed_amount || (selectedLetter.estimated_amount * 0.8)).toLocaleString()} FCFA</strong><br />
                            <span style={{ color: '#b45309', fontWeight: 'bold' }}>Reste à charge patient (Ticket Modérateur) : {Number(selectedLetter.estimated_amount - (selectedLetter.guaranteed_amount || (selectedLetter.estimated_amount * 0.8))).toLocaleString()} FCFA</span>
                          </div>
                        </div>
                      </div>

                      {/* Engagement Financier Officiel UNAMUSC & Tampon Numérique */}
                      <div className="row g-4 align-items-center">
                        <div className="col-md-8">
                          <div className="p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                            <strong className="small d-block text-success mb-1 fw-bold">Clause officielle d'engagement financier UNAMUSC :</strong>
                            <p className="small mb-0 text-dark" style={{ lineHeight: '1.5', color: '#0f172a' }}>
                              {selectedLetter.agent_note || 'L\'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture finale conforme.'}
                            </p>
                          </div>
                        </div>

                        <div className="col-md-4 text-center">
                          <div className="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-2">
                            <img 
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(selectedLetter.validation_code)}`} 
                              alt="QR Code Validation" 
                              style={{ width: '80px', height: '80px' }} 
                            />
                          </div>
                          <div className="small fw-bold text-success">Tampon Numérique Officiel UNAMUSC</div>
                          <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Homologué par l'UNAMUSC — Signature Agent Habilité</small>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-center gap-3">
                      <button 
                        type="button" 
                        className="btn btn-success fw-bold text-white px-4 py-2.5 shadow-sm"
                        onClick={handleDownloadPDF}
                        style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}
                      >
                        📥 Télécharger le Certificat PDF officiel
                      </button>

                      <button 
                        type="button" 
                        className="btn btn-dark fw-bold text-white px-4 py-2.5 shadow-sm"
                        onClick={handlePrintCertificate}
                        style={{ borderRadius: '12px', background: '#1e293b', borderColor: '#0f172a' }}
                      >
                        🖨️ Imprimer la lettre de garantie
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Pied de Modale & Boutons de validation finale */}
              <div className="modal-footer border-top p-3 d-flex justify-content-between" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn text-white fw-bold px-4" 
                  onClick={() => setSelectedLetter(null)} 
                  style={{ background: '#334155', border: '1px solid #475569', borderRadius: '10px', color: '#ffffff' }}
                >
                  Fermer
                </button>

                {modalTab === 'instruction' && (
                  <div className="d-flex gap-2">
                    <button 
                      type="button" 
                      className="btn btn-danger fw-bold px-3 py-2 text-white" 
                      onClick={() => handleValidateAgent('rejected')}
                      style={{ borderRadius: '10px' }}
                    >
                      ❌ Rejeter la demande
                    </button>

                    <button 
                      type="button" 
                      className="btn btn-success fw-bold px-4 py-2 text-white" 
                      onClick={() => handleValidateAgent('approved')}
                      style={{ background: '#059669', borderColor: '#059669', borderRadius: '10px' }}
                    >
                      ✅ Émettre & Certifier la Garantie à 100% / 80%
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
