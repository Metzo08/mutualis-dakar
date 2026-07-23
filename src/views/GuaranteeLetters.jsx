import React, { useState, useEffect } from 'react';

export default function GuaranteeLetters({ lang = 'fr', userRole = 'citizen' }) {
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
      agent_note: 'Dossier complet. Devis d\'hospitalisation vérifié conforme au barème national SÉN-CSU par l\'UNAMUSC.'
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
      agent_note: 'Accordé à 100% au titre de la gratuité hospitalière maternité & soins d\'urgence (UNAMUSC / SÉN-CSU).'
    }
  ];

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Formulaire de demande (Assuré)
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
  const [agentNote, setAgentNote] = useState('Prise en charge validée par l\'agent UNAMUSC sous le régime du tiers-payant SÉN-CSU.');

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

  // Impression ciblée
  const handlePrintCertificate = () => {
    window.print();
  };

  // Téléchargement / Impression de la lettre officielle sous forme de fenêtre PDF dédiée
  const handleDownloadPDF = () => {
    if (!selectedLetter) return;
    const element = document.getElementById('printable-certificate');
    if (!element) return;

    const printWin = window.open('', '_blank', 'width=950,height=1100');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificat_Garantie_${selectedLetter.validation_code}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            body { background: #ffffff; color: #0f172a; padding: 2rem; font-family: 'Inter', system-ui, sans-serif; }
            .badge { border: 1px solid #047857; }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print text-center mb-4">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2">📥 Imprimer / Enregistrer en PDF</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer la fenêtre</button>
          </div>
          ${element.outerHTML}
          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  // Calcul du montant garanti et du reste à charge patient
  const calculatedGuaranteeAmount = selectedLetter 
    ? (parseFloat(maxAmount) || (selectedLetter.estimated_amount * (guaranteedPct / 100)))
    : 0;
  
  const calculatedPatientRest = selectedLetter
    ? Math.max(0, selectedLetter.estimated_amount - calculatedGuaranteeAmount)
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medicalAct || !estimatedAmount) return;
    setSubmitting(true);
    setSuccessMsg('');

    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const estVal = parseFloat(estimatedAmount) || 0;
    const gVal = estVal * 0.8;

    const newLetter = {
      id: Date.now(),
      first_name: citizenData.firstName || 'Amadou',
      last_name: citizenData.lastName || 'Sow',
      cmu_number: citizenData.cmuNumber || 'CMU-DKR-2026-8812',
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
      agent_note: 'Demande en attente de vérification du devis par l\'agent UNAMUSC.'
    };

    try {
      await fetch('/api/guarantees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          medical_act: newLetter.medical_act,
          estimated_amount: newLetter.estimated_amount
        })
      });
    } catch (err) {
      console.warn(err);
    }

    setLetters([newLetter, ...letters]);
    setSuccessMsg(lang === 'wo' ? 'Demande bi yónnee nañu ko ak jamm.' : 'Votre demande de lettre de garantie a été émise avec succès. L\'UNAMUSC procède à l\'instruction sous 24h.');
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
    setAgentNote(item.agent_note || 'Devis et dossier médical vérifiés conformes par l\'UNAMUSC (SÉN-CSU).');
    setModalTab('instruction');
  };

  // KPIs
  const totalPending = letters.filter(l => l.status === 'pending').length;
  const totalApproved = letters.filter(l => l.status === 'approved').length;
  const totalGuaranteedSum = letters.filter(l => l.status === 'approved').reduce((acc, l) => acc + (l.max_amount || 0), 0);

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique (Titre & Boutons centrés) */}
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
            🇸🇳 UNAMUSC Sénégal — Prise en charge hospitalière (80% à 100%)
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Bataaxal yoxu garansi (Lettres de garantie)' : 'Lettres de garantie & hospitalisation'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez votre prise en charge hospitalière en ligne avec homologation 100% humaine par l\'UNAMUSC (SÉN-CSU).'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm"
              style={{
                background: activeTab === 'list' ? '#059669' : 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                border: activeTab === 'list' ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                boxShadow: activeTab === 'list' ? '0 4px 14px rgba(5, 150, 105, 0.5)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveTab('list')}
            >
              📋 {lang === 'wo' ? 'Lim bi' : 'Mes demandes & instructions'} ({letters.length})
            </button>

            <button 
              type="button"
              className="btn fw-bold text-white shadow-sm"
              style={{
                background: activeTab === 'new' ? '#059669' : 'rgba(255, 255, 255, 0.18)',
                color: '#ffffff',
                border: activeTab === 'new' ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                boxShadow: activeTab === 'new' ? '0 4px 14px rgba(5, 150, 105, 0.5)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveTab('new')}
            >
              ➕ {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle demande de prise en charge'}
            </button>
          </div>
        </div>
      </section>

      {/* RANGÉE KPIS EXÉCUTIF GARANTIES */}
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

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{successMsg}</div>
        </div>
      )}

      {/* FORMULAIRE NOUVELLE DEMANDE (ASSURÉ / CITOYEN) */}
      {activeTab === 'new' && (
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
            <span>➕</span> Nouvelle demande de prise en charge hospitalière UNAMUSC
          </h4>
          <p className="small text-muted mb-4">
            Remplissez ce formulaire pour solliciter une lettre de garantie sous le régime tiers-payant SÉN-CSU délivrée par l'UNAMUSC.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-semibold">Établissement de santé conventionné récepteur *</label>
                <select 
                  className="form-select input fw-bold" 
                  value={structureName} 
                  onChange={(e) => setStructureName(e.target.value)}
                  style={{ borderRadius: '10px' }}
                >
                  <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                  <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec</option>
                  <option value="Hôpital Général Idrissa Pouye (Pikine)">Hôpital Général Idrissa Pouye (Pikine)</option>
                  <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                  <option value="Hôpital d'Enfants Albert Royer">Hôpital d'Enfants Albert Royer</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-semibold">Devis estimatif soumis par l'hôpital (FCFA) *</label>
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
              <label className="form-label small fw-semibold">Description de l'acte médical / hospitalisation prescrite *</label>
              <textarea 
                className="form-control input" 
                rows="3" 
                placeholder="Ex: Intervention chirurgicale ORL, hospitalisation 5 jours en médecine interne..."
                value={medicalAct}
                onChange={(e) => setMedicalAct(e.target.value)}
                style={{ borderRadius: '10px' }}
                required
              />
            </div>

            <div className="p-3 rounded-3 border mb-4" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong className="d-block small text-success">Estimation automatique UNAMUSC / SÉN-CSU (80%) :</strong>
                  <span className="small text-muted">Sous réserve d'instruction et d'homologation par l'agent.</span>
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

      {/* LISTE DES DEMANDES DE GARANTIE */}
      {activeTab === 'list' && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
            <span>📋</span> Demandes & Lettres de Garantie d'Hospitalisation UNAMUSC
          </h4>

          {loading ? (
            <div className="text-center py-5 text-muted">Chargement des dossiers de garantie...</div>
          ) : letters.length === 0 ? (
            <div className="text-center py-5 text-muted">Aucune demande de garantie enregistrée.</div>
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
                    <th style={{ padding: '0.85rem', textAlign: 'right' }}>Actions Agent / Assuré</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((item) => (
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
                        <button 
                          type="button"
                          className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm"
                          onClick={() => openInstructionModal(item)}
                          style={{ background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          {item.status === 'approved' ? '📄 Certificat PDF / Garanties' : '⚙️ Instruire le dossier'}
                        </button>
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
                    🇸🇳 UNAMUSC (SÉN-CSU) — DOSSIER DE PRISE EN CHARGE #{selectedLetter.validation_code}
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
                            src="/senegal_flag.jpg" 
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
                              PROGRAMME NATIONAL DE COUVERTURE SANTÉ UNIVERSELLE (SÉN-CSU)
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
                        <small className="text-muted fw-semibold">Émise sous le régime du Tiers-Payant SÉN-CSU — Homologuée par l'UNAMUSC Sénégal</small><br />
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
                            Organisme Émetteur : Union Nationale UNAMUSC Sénégal (SÉN-CSU)
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
                            Conventionné Tiers-Payant SÉN-CSU / UNAMUSC (Validation 100% Humaine)
                          </div>
                        </div>

                        <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                          <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            📋 ACTE MÉDICAL / HOSPITALISATION PRESCRITE :
                          </span>
                          <strong className="d-block" style={{ color: '#0f172a', fontSize: '0.95rem' }}>{selectedLetter.medical_act}</strong>
                          <small className="text-muted d-block mt-1">
                            Devis d'hospitalisation estimé : <strong style={{ color: '#0f172a' }}>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong>
                          </small>
                        </div>

                        <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                          <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            💰 MONTANT GARANTI ET PRIS EN CHARGE PAR L'UNAMUSC :
                          </span>
                          <h4 className="fw-bold mb-0" style={{ color: '#047857', fontSize: '1.4rem' }}>
                            {Number(selectedLetter.max_amount).toLocaleString()} FCFA ({selectedLetter.guaranteed_percentage}%)
                          </h4>
                          <span className="small fw-bold d-block mt-1" style={{ color: '#b45309' }}>
                            Ticket modérateur (reste à la charge du patient) : {Number(selectedLetter.patient_rest || 0).toLocaleString()} FCFA
                          </span>
                        </div>
                      </div>

                      {/* Observations & Signatures */}
                      <div className="row g-4 align-items-center">
                        <div className="col-md-8">
                          <div className="p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                            <strong className="small d-block text-success mb-1 fw-bold">Clause officielle d'engagement financier UNAMUSC :</strong>
                            <p className="small mb-0 text-dark" style={{ lineHeight: '1.5', color: '#0f172a' }}>
                              {selectedLetter.agent_note || 'L\'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) s\'engage sous le programme SÉN-CSU à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture finale conforme.'}
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
                          <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Homologué SÉN-CSU — Signature Agent Habilité</small>
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
