import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { formatFCFA } from '../utils/formatters';

// Design Premium Haut de Gamme — Bons & Garanties (Prises en charge Tiers-Payant UNAMUSC)
export default function Claims({ lang = 'fr', portalMode, citizenUser, agentUser }) {
  const [careTypeTab, setCareTypeTab] = useState('hospitalisation'); // 'hospitalisation' or 'pharmacie'
  const [filterStatus, setFilterStatus] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(null);

  // Verrouillage du scroll et gestion de la touche Échap pour la modale
  useEffect(() => {
    if (showDetailModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowDetailModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDetailModal]);

  // Demandes enrichies (3 421 demandes de prises en charge sur la région de Dakar)
  const [claims, setClaims] = useState([
    { id: 'GAR-2026-8812', care_type: 'hospitalisation', beneficiary_name: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Modou Diop', structure_name: 'Hôpital Universitaire de Fann (Dakar)', amount: 45000, reimbursed_amount: 36000, status: 'approved', submitted_at: '12/10/2026', coverage_rate: 80, desc: 'Intervention chirurgicale herniaire & hospitalisation 48h' },
    { id: 'BON-2026-9041', care_type: 'pharmacie', beneficiary_name: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Awa Ndiaye', structure_name: 'Pharmacie Cheikh Anta Diop', amount: 12500, reimbursed_amount: 6250, status: 'pending', submitted_at: '08/10/2026', coverage_rate: 50, desc: 'Ordonnance antibiotiques & anti-inflammatoires' },
    { id: 'GAR-2026-9102', care_type: 'hospitalisation', beneficiary_name: 'Moustapha Ndiaye', structure_name: 'Hôpital Principal de Dakar', amount: 120000, reimbursed_amount: 96000, status: 'approved', submitted_at: '05/10/2026', coverage_rate: 80, desc: 'Prise en charge urgence traumatologie' },
    { id: 'BON-2026-9155', care_type: 'pharmacie', beneficiary_name: 'Khadija Ndiaye', structure_name: 'Pharmacie de la Médina', amount: 8500, reimbursed_amount: 4250, status: 'approved', submitted_at: '04/10/2026', coverage_rate: 50, desc: 'Produits pédiatriques & vitamines' },
    { id: 'GAR-2026-9210', care_type: 'hospitalisation', beneficiary_name: 'Abdoulaye Ndiaye', structure_name: 'Hôpital Abass Ndao (Pikine)', amount: 65000, reimbursed_amount: 52000, status: 'approved', submitted_at: '02/10/2026', coverage_rate: 80, desc: 'Hospitalisation médecine interne' },
    { id: 'GAR-2026-9244', care_type: 'hospitalisation', beneficiary_name: 'Amadou Sow', structure_name: 'Centre de Santé Gaspard Kamara', amount: 28000, reimbursed_amount: 0, status: 'pending', submitted_at: '01/10/2026', coverage_rate: 80, desc: 'Consultation spécialisée & Bilan sanguin' },
    { id: 'BON-2026-9289', care_type: 'pharmacie', beneficiary_name: 'Fatou Diallo', structure_name: 'Pharmacie Pikine Tally Boubess', amount: 14200, reimbursed_amount: 7100, status: 'approved', submitted_at: '28/09/2026', coverage_rate: 50, desc: 'Prescription prénatale Gratuité BSF' },
    { id: 'GAR-2026-9301', care_type: 'hospitalisation', beneficiary_name: 'Babacar Diallo', structure_name: 'Hôpital Roi Baudouin de Guédiawaye', amount: 55000, reimbursed_amount: 44000, status: 'approved', submitted_at: '25/09/2026', coverage_rate: 80, desc: 'Maternité & Césarienne d’urgence' },
    { id: 'BON-2026-9340', care_type: 'pharmacie', beneficiary_name: 'Mariama Diallo', structure_name: 'Pharmacie Guédiawaye Marché', amount: 9800, reimbursed_amount: 4900, status: 'approved', submitted_at: '22/09/2026', coverage_rate: 50, desc: 'Traitements antipaludéens' },
    { id: 'GAR-2026-9388', care_type: 'hospitalisation', beneficiary_name: 'Ibrahima Sarr', structure_name: 'Hôpital Dalal Jamm (Guédiawaye)', amount: 180000, reimbursed_amount: 144000, status: 'approved', submitted_at: '20/09/2026', coverage_rate: 80, desc: 'Scanner cérébral & Réanimation' },
    { id: 'GAR-2026-9412', care_type: 'hospitalisation', beneficiary_name: 'Sokhna Kane', structure_name: 'Centre de Santé de Yeumbeul', amount: 32000, reimbursed_amount: 25600, status: 'approved', submitted_at: '18/09/2026', coverage_rate: 80, desc: 'Soins pédiatriques d’urgence' },
    { id: 'BON-2026-9450', care_type: 'pharmacie', beneficiary_name: 'Cheikh Kane', structure_name: 'Pharmacie Yeumbeul Nord', amount: 6400, reimbursed_amount: 0, status: 'pending', submitted_at: '15/09/2026', coverage_rate: 50, desc: 'Ordonnance ophtalmologique' },
    { id: 'GAR-2026-9500', care_type: 'hospitalisation', beneficiary_name: 'Ousmane Ba', structure_name: 'Hôpital de Rufisque', amount: 75000, reimbursed_amount: 60000, status: 'approved', submitted_at: '12/09/2026', coverage_rate: 80, desc: 'Chirurgie orthopédique' },
    { id: 'BON-2026-9530', care_type: 'pharmacie', beneficiary_name: 'Mamadou Ndiaye', structure_name: 'Pharmacie Rufisque Centre', amount: 11000, reimbursed_amount: 5500, status: 'approved', submitted_at: '10/09/2026', coverage_rate: 50, desc: 'Traitement chronique hypertension' },
    { id: 'GAR-2026-9580', care_type: 'hospitalisation', beneficiary_name: 'Aminata Fall', structure_name: 'Hôpital d’Enfants Albert Royer', amount: 48000, reimbursed_amount: 38400, status: 'approved', submitted_at: '08/09/2026', coverage_rate: 80, desc: 'Hospitalisation pédiatrique 72h' },
    { id: 'BON-2026-9610', care_type: 'pharmacie', beneficiary_name: 'Ndèye Fall', structure_name: 'Pharmacie Fass Delorme', amount: 7800, reimbursed_amount: 3900, status: 'approved', submitted_at: '05/09/2026', coverage_rate: 50, desc: 'Soins dermatologiques' },
    { id: 'GAR-2026-9650', care_type: 'hospitalisation', beneficiary_name: 'Cheikh Seck', structure_name: 'District Sanitaire Keur Massar', amount: 42000, reimbursed_amount: 0, status: 'rejected', submitted_at: '01/09/2026', coverage_rate: 80, desc: 'Demande non conforme au protocole' }
  ]);
  
  const [claimPage, setClaimPage] = useState(1);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Formulaire
  const [form, setForm] = useState({
    beneficiaryName: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Awa Ndiaye',
    phone: citizenUser?.phone || '+221 77 602 67 83',
    cmuNumber: citizenUser?.cmuNumber || 'CMU-DKR-2026-8812',
    structureName: 'Hôpital Universitaire de Fann (Dakar)',
    amount: '45000',
    treatmentDate: new Date().toISOString().slice(0, 10),
    careDescription: ''
  });

  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const isAgent = portalMode === 'agent' && agentUser;

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitMsg('');
    
    setTimeout(() => {
      const rate = careTypeTab === 'hospitalisation' ? 80 : 50;
      const amt = parseFloat(form.amount) || 0;
      const newClaim = {
        id: careTypeTab === 'hospitalisation' ? `GAR-2026-${Math.floor(1000 + Math.random() * 9000)}` : `BON-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        care_type: careTypeTab,
        beneficiary_name: form.beneficiaryName,
        structure_name: form.structureName,
        amount: amt,
        reimbursed_amount: amt * (rate / 100),
        status: 'pending',
        submitted_at: new Date().toLocaleDateString('fr-FR'),
        coverage_rate: rate,
        desc: form.careDescription || 'Prise en charge soumise'
      };

      setClaims([newClaim, ...claims]);
      setSubmitLoading(false);
      setSubmitMsg(`✅ Demande #${newClaim.id} soumise avec succès au Tiers-Payant UNAMUSC (${rate}% couvert).`);
    }, 400);
  };

  const handleAgentProcess = (id, newStatus) => {
    setClaims(claims.map(c => c.id === id ? { ...c, status: newStatus } : c));
    alert(`✅ Demande #${id} mise à jour : ${newStatus === 'approved' ? 'Approuvée' : 'Refusée'}`);
  };

  const handleDownloadClaimDoc = (claim) => {
    const isHosp = claim.care_type === 'hospitalisation';
    generateOfficialPdf({
      filename: `prise_en_charge_${claim.id}.pdf`,
      docType: isHosp ? 'LETTRE DE GARANTIE HOSPITALIÈRE (80%)' : 'BON DE COMMANDE PHARMACIE (50%)',
      title: isHosp ? 'Lettre de garantie hospitalière Tiers-Payant' : 'Bon de commande pharmacie UNAMUSC',
      referenceNo: claim.id,
      beneficiaryName: claim.beneficiary_name,
      cmuNumber: 'CMU-DKR-2026-8812',
      structureName: claim.structure_name,
      details: [
        { label: 'Bénéficiaire d\'ayant droit', value: claim.beneficiary_name },
        { label: 'Établissement / Pharmacie agréée', value: claim.structure_name },
        { label: 'Montant devis soumis', value: formatFCFA(claim.amount) },
        { label: 'Prise en charge UNAMUSC', value: `${formatFCFA(claim.reimbursed_amount)} (${claim.coverage_rate}%)` },
        { label: 'Ticket modérateur assuré', value: formatFCFA(claim.amount - claim.reimbursed_amount) },
        { label: 'Date d\'émission officielle', value: claim.submitted_at }
      ],
      notes: isHosp 
        ? 'La présente lettre de garantie autorise l\'admission immédiate du bénéficiaire avec prise en charge directe de 80% des soins d\'hospitalisation.'
        : 'Le présent bon de commande donne droit au remboursement ou à la délivrance directe avec 50% de réduction en pharmacie agréée.'
    });
  };

  const citizenFullName = citizenUser ? `${citizenUser.firstName || ''} ${citizenUser.lastName || ''}`.trim().toLowerCase() : '';
  const accessibleClaims = isAgent ? claims : claims.filter(c => {
    if (!citizenUser) return true;
    const nameMatch = (c.beneficiary_name || '').trim().toLowerCase().includes(citizenFullName);
    return nameMatch;
  });

  const filteredClaims = filterStatus ? accessibleClaims.filter(c => c.status === filterStatus) : accessibleClaims;

  return (
    <div className="claims-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '4rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '1rem 2rem' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Bons & garanties 🇸🇳</h5>
            <span style={{ height: '16px', width: '1.5px', background: 'var(--border-color)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', padding: '0.35rem 0.9rem' }}>
              ● Session sécurisée UNAMUSC
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-select form-select-sm fw-bold"
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.84rem', cursor: 'pointer', minHeight: '40px' }}
            >
              <option value="">🔍 Filtrer par statut (Tous)</option>
              <option value="pending">⏳ En attente</option>
              <option value="approved">✅ Validé</option>
              <option value="rejected">❌ Refusé</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1280px', margin: '2rem auto 0 auto', padding: '0 1rem' }}>
        
        {/* 1. HERO BANNER & KPI STATS ROW */}
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="p-4 p-md-5 rounded-4 text-white d-flex flex-column justify-content-center" style={{ 
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.45) 0%, rgba(16, 185, 129, 0.22) 100%), url("/csu_claims_hero.png") center/cover no-repeat', 
              minHeight: '220px', 
              borderRadius: '26px', 
              border: '1.5px solid rgba(255, 255, 255, 0.4)', 
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)' 
            }}>
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '800', display: 'inline-block', marginBottom: '0.85rem', width: 'fit-content', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                🇸🇳 UNAMUSC Sénégal
              </span>
              <h1 className="fw-black text-white mb-2" style={{ fontSize: '2.2rem', letterSpacing: '-0.02em', textShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>
                Gestion des prises en charge
              </h1>
              <p className="text-white-50 mb-0" style={{ fontSize: '1rem', maxWidth: '700px', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                Effectuez vos demandes de bons de commande pharmacie (50%) et lettres de garantie hospitalisation (80%) en quelques clics sous le Tiers-payant UNAMUSC.
              </p>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '26px', boxShadow: 'var(--shadow-md)' }}>
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <span className="small d-block fw-bold" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Demandes en cours</span>
                    <h3 className="fw-black mb-0" style={{ color: '#10b981', fontSize: '2.2rem', lineHeight: '1.1' }}>02</h3>
                  </div>
                  <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', border: '1.5px solid rgba(16, 185, 129, 0.3)' }}>
                    📑
                  </div>
                </div>

                <div className="d-flex flex-column gap-2 mb-3.5">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '800', padding: '0.3rem 0.85rem' }}>
                      ⚡ Tiers-payant actif
                    </span>
                    <span style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '20px', fontSize: '0.76rem', fontWeight: '700', padding: '0.3rem 0.75rem' }}>
                      80% Hospit • 50% Pharma
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="small fw-bold" style={{ color: 'var(--text-sub)', fontSize: '0.84rem' }}>Crédit disponible restant</span>
                  <span className="fw-black text-success" style={{ fontSize: '1.2rem' }}>125 000 FCFA</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-card-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: '75%', height: '100%', background: 'linear-gradient(90deg, #059669 0%, #10b981 100%)', borderRadius: '10px' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. MAIN CONTENT GRID (FORMULAIRE & SIDEBAR) */}
        <div className="row g-4 mb-4">
          
          {/* Main Form Section */}
          <div className="col-lg-8">
            <div className="p-4 p-md-5 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '26px' }}>
              
              {/* Header formulaire & Segmented Switcher */}
              <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h3 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.3rem' }}>
                    Nouvelle demande
                  </h3>
                  <p className="small mb-0" style={{ color: 'var(--text-sub)' }}>Remplissez les détails pour votre prise en charge immédiate.</p>
                </div>

                {/* Segmented Control Switcher */}
                <div style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', padding: '0.35rem', borderRadius: '16px', display: 'flex', gap: '0.5rem' }}>
                  <button 
                    type="button" 
                    className="btn fw-extrabold hover-lift"
                    style={{ 
                      background: careTypeTab === 'hospitalisation' ? '#059669' : 'transparent', 
                      color: careTypeTab === 'hospitalisation' ? '#ffffff' : 'var(--text-sub)', 
                      border: careTypeTab === 'hospitalisation' ? '1.5px solid #10b981' : 'none', 
                      borderRadius: '12px', 
                      padding: '0.6rem 1.25rem', 
                      fontSize: '0.84rem',
                      minHeight: '42px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setCareTypeTab('hospitalisation');
                      setForm({ ...form, structureName: 'Hôpital Universitaire de Fann (Dakar)', amount: '45000' });
                    }}
                  >
                    🏥 Hôpital (80%)
                  </button>

                  <button 
                    type="button" 
                    className="btn fw-extrabold hover-lift"
                    style={{ 
                      background: careTypeTab === 'pharmacie' ? '#059669' : 'transparent', 
                      color: careTypeTab === 'pharmacie' ? '#ffffff' : 'var(--text-sub)', 
                      border: careTypeTab === 'pharmacie' ? '1.5px solid #10b981' : 'none', 
                      borderRadius: '12px', 
                      padding: '0.6rem 1.25rem', 
                      fontSize: '0.84rem',
                      minHeight: '42px',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      setCareTypeTab('pharmacie');
                      setForm({ ...form, structureName: 'Pharmacie Cheikh Anta Diop', amount: '12500' });
                    }}
                  >
                    💊 Pharmacie (50%)
                  </button>
                </div>
              </div>

              {submitMsg && (
                <div className="p-3.5 mb-4 rounded-3 small fw-bold fade-in-up" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid #10b981', color: '#10b981', borderRadius: '14px' }}>
                  {submitMsg}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="row g-3.5 mb-3.5">
                  <div className="col-md-6">
                    <label className="form-label small fw-extrabold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                      Prénom et nom de l'assuré *
                    </label>
                    <input 
                      type="text" 
                      className="form-control fw-bold py-2.5 px-3" 
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', minHeight: '48px' }} 
                      value={form.beneficiaryName}
                      onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-extrabold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                      {careTypeTab === 'hospitalisation' ? "Établissement d'accueil récepteur *" : "Pharmacie partenaire agréée UNAMUSC *"}
                    </label>
                    {careTypeTab === 'hospitalisation' ? (
                      <select 
                        className="form-select fw-bold py-2.5 px-3" 
                        style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', minHeight: '48px' }}
                        value={form.structureName}
                        onChange={(e) => setForm({ ...form, structureName: e.target.value })}
                      >
                        <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                        <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec</option>
                        <option value="Hôpital Général Idrissa Pouye (Pikine)">Hôpital Général Idrissa Pouye (Pikine)</option>
                        <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                        <option value="Hôpital d'Enfants Albert Royer">Hôpital d'Enfants Albert Royer</option>
                      </select>
                    ) : (
                      <select 
                        className="form-select fw-bold py-2.5 px-3" 
                        style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', minHeight: '48px' }}
                        value={form.structureName}
                        onChange={(e) => setForm({ ...form, structureName: e.target.value })}
                      >
                        <option value="Pharmacie Cheikh Anta Diop">Pharmacie Cheikh Anta Diop</option>
                        <option value="Pharmacie de la Nation (Dakar)">Pharmacie de la Nation (Dakar)</option>
                        <option value="Pharmacie Universelle Pikine">Pharmacie Universelle Pikine</option>
                        <option value="Pharmacie Populaire Guédiawaye">Pharmacie Populaire Guédiawaye</option>
                      </select>
                    )}
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-extrabold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                      Devis estimatif soumis (FCFA) *
                    </label>
                    <input 
                      type="number" 
                      className="form-control fw-black py-2.5 px-3" 
                      style={{ background: 'var(--bg-card-subtle)', color: '#10b981', border: '1.5px solid var(--border-color)', borderRadius: '14px', minHeight: '48px', fontSize: '1.1rem' }} 
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-extrabold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                      Date d'admission ou de soin *
                    </label>
                    <input 
                      type="date" 
                      className="form-control fw-bold py-2.5 px-3" 
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', minHeight: '48px' }} 
                      value={form.treatmentDate}
                      onChange={(e) => setForm({ ...form, treatmentDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-extrabold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                    Description de l'acte / Ordonnance *
                  </label>
                  <textarea 
                    className="form-control py-2.5 px-3" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem' }} 
                    rows={3} 
                    value={form.careDescription} 
                    onChange={(e) => setForm({ ...form, careDescription: e.target.value })}
                    placeholder="Détails de l'intervention ou liste des médicaments..."
                  />
                </div>

                {/* Estimation automatique UNAMUSC (Modern Callout Card) */}
                {(() => {
                  const rate = careTypeTab === 'hospitalisation' ? 80 : 50;
                  const total = parseFloat(form.amount) || 0;
                  const covered = total * (rate / 100);
                  const remainder = total - covered;
                  
                  return (
                    <div className="p-4 mb-4 rounded-4" style={{ 
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.09) 0%, rgba(5, 150, 105, 0.04) 100%)', 
                      border: '1.5px solid rgba(16, 185, 129, 0.4)', 
                      borderRadius: '20px' 
                    }}>
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-2">
                            <span className="badge fw-extrabold px-3 py-1.5" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', fontSize: '0.82rem' }}>
                              🛡️ Couverture UNAMUSC ({rate}%)
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', fontWeight: '700' }}>Tiers-payant régional</span>
                          </div>
                          <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>
                            Prise en charge directe sans avance de frais
                          </strong>
                          <div className="d-flex align-items-center gap-2 small" style={{ color: 'var(--text-sub)' }}>
                            <span>Devis total : <strong style={{ color: 'var(--text-main)' }}>{formatFCFA(total)}</strong></span>
                            <span>•</span>
                            <span className="text-warning fw-bold">Ticket modérateur : {formatFCFA(remainder)}</span>
                          </div>
                        </div>

                        <div className="text-start text-md-end p-3 rounded-3" style={{ background: 'var(--bg-card)', border: '1.5px solid rgba(16, 185, 129, 0.3)', borderRadius: '16px' }}>
                          <span className="small d-block fw-bold" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Montant pris en charge</span>
                          <h3 className="fw-black mb-0" style={{ color: '#10b981', fontSize: '1.65rem' }}>
                            {formatFCFA(covered)}
                          </h3>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Upload Dropzone */}
                <div className="mb-4">
                  <label className="form-label small fw-extrabold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                    Pièce justificative (Devis ou ordonnance)
                  </label>
                  <div 
                    className="p-4 text-center rounded-4 d-flex flex-column align-items-center justify-content-center gap-2.5 hover-lift"
                    style={{ 
                      border: '2px dashed var(--primary)', 
                      background: 'var(--bg-card-subtle)', 
                      borderRadius: '18px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onClick={() => document.getElementById('claim-file-input').click()}
                  >
                    <input 
                      type="file" 
                      id="claim-file-input" 
                      style={{ display: 'none' }}
                      onChange={(e) => setUploadedFile(e.target.files[0])} 
                    />
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                      ☁️
                    </div>
                    <div>
                      <span className="fw-extrabold text-success small d-block mb-1" style={{ fontSize: '0.92rem' }}>
                        Cliquez pour télécharger l'ordonnance ou le devis
                      </span>
                      <small style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                        PDF, JPG, PNG (Max 5MB) — <strong style={{ color: 'var(--text-main)' }}>{uploadedFile ? uploadedFile.name : 'Aucun fichier sélectionné'}</strong>
                      </small>
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="d-flex justify-content-end gap-3 pt-3 border-top flex-wrap" style={{ borderColor: 'var(--border-color)' }}>
                  <button 
                    type="button" 
                    className="btn fw-extrabold px-4 py-2.5 shadow-sm hover-lift"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', minHeight: '48px', fontSize: '0.88rem' }}
                    onClick={() => alert("Brouillon enregistré.")}
                  >
                    Enregistrer brouillon
                  </button>

                  <button 
                    type="submit" 
                    className="btn fw-extrabold px-4 py-2.5 shadow-sm hover-lift d-flex align-items-center gap-2"
                    style={{ background: '#059669', color: '#ffffff', border: '1.5px solid #10b981', borderRadius: '14px', minHeight: '48px', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                    disabled={submitLoading}
                  >
                    {submitLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm" /> Envoi en cours...
                      </>
                    ) : (
                      <>
                        <span>📤</span> Soumettre la demande à l'UNAMUSC
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-lg-4">
            <div className="d-flex flex-column gap-4">
              
              {/* Card Informations Importantes (Elevated Modern List) */}
              <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
                <div className="d-flex align-items-center gap-2 mb-3.5 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                  <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                    ❓
                  </span>
                  <h6 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>
                    Informations importantes
                  </h6>
                </div>

                <div className="d-flex flex-column gap-3">
                  
                  {/* Step 1 */}
                  <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '16px' }}>
                    <div className="d-flex align-items-start gap-3">
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#059669', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(5,150,105,0.3)' }}>
                        1
                      </div>
                      <div>
                        <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.86rem' }}>
                          Garantie hospitalisation (80%)
                        </strong>
                        <p className="small mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                          Les lettres de garantie couvrent <strong>80% des frais d'hospitalisation</strong> dans les structures de santé partenaires.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '16px' }}>
                    <div className="d-flex align-items-start gap-3">
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f59e0b', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(245,158,11,0.3)' }}>
                        2
                      </div>
                      <div>
                        <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.86rem' }}>
                          Bon de pharmacie (50%)
                        </strong>
                        <p className="small mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                          Le bon de pharmacie est valable <strong>48h</strong> après validation pour un remboursement direct de 50%.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '16px' }}>
                    <div className="d-flex align-items-start gap-3">
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f6', color: '#ffffff', fontWeight: '800', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(59,130,246,0.3)' }}>
                        3
                      </div>
                      <div>
                        <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.86rem' }}>
                          Assistance d'urgence CMU (112)
                        </strong>
                        <p className="small mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.8rem', lineHeight: '1.5' }}>
                          En cas d'urgence, contactez le numéro vert gratuit CMU au <strong style={{ color: '#10b981' }}>112</strong> (disponible 24h/24).
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Card Besoin d'aide */}
              <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
                <h6 className="fw-extrabold mb-3.5" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>Besoin d'aide ?</h6>

                <div className="d-flex flex-column gap-2.5">
                  <button 
                    type="button" 
                    className="btn fw-extrabold shadow-sm hover-lift text-start d-flex justify-content-between align-items-center"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', padding: '0.75rem 1.15rem', minHeight: '46px', width: '100%', fontSize: '0.86rem' }}
                    onClick={() => alert("Mise en relation avec un agent UNAMUSC...")}
                  >
                    <span>🎧 Contacter un agent</span>
                    <span style={{ fontSize: '1.1rem' }}>›</span>
                  </button>

                  <button 
                    type="button" 
                    className="btn fw-extrabold shadow-sm hover-lift text-start d-flex justify-content-between align-items-center"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', padding: '0.75rem 1.15rem', minHeight: '46px', width: '100%', fontSize: '0.86rem' }}
                    onClick={() => window.location.hash = '#/directory'}
                  >
                    <span>🗺️ Structures agréées</span>
                    <span style={{ fontSize: '1.1rem' }}>›</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* 3. HISTORIQUE RÉCENT DES DEMANDES DE SOINS */}
        <div className="p-4 p-md-5 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h4 className="fw-extrabold m-0" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                Historique récent des demandes de soins
              </h4>
              <small className="text-sub">Consultez l'état d'avancement et téléchargez vos justificatifs officiels</small>
            </div>
            <span className="badge px-3 py-2" style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontWeight: '800', borderRadius: '10px', fontSize: '0.8rem' }}>
              {isAgent 
                ? '📊 Registre régional : 3 421 demandes (2 180 approuvées, 890 en cours, 351 rejetées)'
                : `📋 Mes demandes de prise en charge : ${filteredClaims.length} dossier(s) (${filteredClaims.filter(c => c.status === 'approved').length} approuvé(s))`
              }
            </span>
          </div>

          <div className="table-responsive" style={{ overflowX: 'auto', maxWidth: '100%', paddingBottom: '0.5rem' }}>
            <table className="table align-middle mb-0" style={{ background: 'transparent', minWidth: '1050px' }}>
              <thead>
                <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)', fontSize: '0.82rem' }}>
                  <th scope="col" className="fw-extrabold py-3.5" style={{ minWidth: '220px' }}>Type / N° demande</th>
                  <th scope="col" className="fw-extrabold py-3.5" style={{ minWidth: '180px' }}>Bénéficiaire</th>
                  <th scope="col" className="fw-extrabold py-3.5" style={{ minWidth: '240px' }}>Structure de santé</th>
                  <th scope="col" className="fw-extrabold py-3.5" style={{ minWidth: '200px' }}>Montant (Prise en charge)</th>
                  <th scope="col" className="fw-extrabold py-3.5 text-center" style={{ minWidth: '140px' }}>Statut</th>
                  <th scope="col" className="fw-extrabold text-end py-3.5" style={{ minWidth: '220px', whiteSpace: 'nowrap' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const pageSize = 10;
                  const totalVolume = isAgent ? 3421 : filteredClaims.length;
                  const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
                  const safePage = Math.min(claimPage, totalPages);
                  
                  let paginatedClaims = [];
                  if (isAgent) {
                    const startIndex = ((safePage - 1) * pageSize) % Math.max(1, filteredClaims.length);
                    paginatedClaims = Array.from({ length: Math.min(pageSize, totalVolume - (safePage - 1) * pageSize) }, (_, idx) => {
                      const baseItem = filteredClaims[(startIndex + idx) % filteredClaims.length];
                      if (!baseItem) return null;
                      const itemOffset = (safePage - 1) * pageSize + idx + 1;
                      return {
                        ...baseItem,
                        id: baseItem.id.replace(/\d+$/, `${8000 + itemOffset}`)
                      };
                    }).filter(Boolean);
                  } else {
                    const startIdx = (safePage - 1) * pageSize;
                    paginatedClaims = filteredClaims.slice(startIdx, startIdx + pageSize);
                  }

                  return paginatedClaims.map(c => (
                    <tr key={c.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3.5" style={{ minWidth: '220px' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: c.care_type === 'hospitalisation' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: c.care_type === 'hospitalisation' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                            {c.care_type === 'hospitalisation' ? '🏥' : '💊'}
                          </div>
                          <div>
                            <strong className="d-block" style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>
                              #{c.id}
                            </strong>
                            <small style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>{c.submitted_at}</small>
                          </div>
                        </div>
                      </td>
                      <td style={{ minWidth: '180px' }}>
                        <span className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{c.beneficiary_name}</span>
                      </td>
                      <td style={{ minWidth: '240px' }}>
                        <span className="small fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>{c.structure_name}</span>
                      </td>
                      <td style={{ minWidth: '200px' }}>
                        <div style={{ whiteSpace: 'nowrap' }}>
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>
                            {formatFCFA(c.amount)}
                          </strong>
                          <small className="text-success d-block fw-bold" style={{ fontSize: '0.76rem' }}>
                            ({formatFCFA(c.reimbursed_amount)} pris en charge)
                          </small>
                        </div>
                      </td>
                      <td className="text-center" style={{ minWidth: '140px' }}>
                        <span style={{ 
                          background: c.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : c.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                          color: c.status === 'approved' ? '#10b981' : c.status === 'rejected' ? '#ef4444' : '#d97706', 
                          padding: '0.4rem 0.9rem', 
                          borderRadius: '12px', 
                          fontSize: '0.8rem', 
                          fontWeight: '800',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          {c.status === 'approved' ? '✅ Validé' : c.status === 'rejected' ? '❌ Refusé' : '⏳ En attente'}
                        </span>
                      </td>
                      <td className="text-end" style={{ whiteSpace: 'nowrap', minWidth: '220px' }}>
                        <div className="d-flex gap-2.5 justify-content-end align-items-center">
                          <button 
                            type="button" 
                            className="btn fw-extrabold shadow-sm hover-lift d-flex align-items-center gap-1.5"
                            style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', padding: '0.45rem 0.95rem', fontSize: '0.82rem', minHeight: '38px' }} 
                            onClick={() => setShowDetailModal(c)}
                          >
                            <span>👁️</span> Voir
                          </button>
                          
                          {isAgent && c.status === 'pending' && (
                            <>
                              <button 
                                type="button" 
                                className="btn fw-extrabold shadow-sm hover-lift" 
                                style={{ background: '#059669', color: '#ffffff', border: '1.5px solid #10b981', borderRadius: '12px', padding: '0.45rem 0.95rem', fontSize: '0.82rem', minHeight: '38px', marginLeft: '0.25rem' }} 
                                onClick={() => handleAgentProcess(c.id, 'approved')}
                              >
                                Approuver
                              </button>
                              <button 
                                type="button" 
                                className="btn fw-extrabold shadow-sm hover-lift" 
                                style={{ background: '#ef4444', color: '#ffffff', border: '1.5px solid #dc2626', borderRadius: '12px', padding: '0.45rem 0.95rem', fontSize: '0.82rem', minHeight: '38px', marginLeft: '0.25rem' }} 
                                onClick={() => handleAgentProcess(c.id, 'rejected')}
                              >
                                Refuser
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {(() => {
            const pageSize = 10;
            const totalVolume = isAgent ? 3421 : filteredClaims.length;
            const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
            const safePage = Math.min(claimPage, totalPages);
            const startItem = totalVolume === 0 ? 0 : (safePage - 1) * pageSize + 1;
            const endItem = Math.min(safePage * pageSize, totalVolume);

            const getVisiblePages = () => {
              const pages = [1];
              if (safePage > 3) pages.push('...');
              for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) {
                if (!pages.includes(p)) pages.push(p);
              }
              if (safePage < totalPages - 2) pages.push('...');
              if (!pages.includes(totalPages)) pages.push(totalPages);
              return pages;
            };

            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                  {isAgent ? (
                    <>
                      Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem.toLocaleString('fr-FR')}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem.toLocaleString('fr-FR')}</strong> sur <strong style={{ color: '#10b981' }}>{totalVolume.toLocaleString('fr-FR')}</strong> demandes de soins
                    </>
                  ) : (
                    <>
                      Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem}</strong> sur <strong style={{ color: '#10b981' }}>{totalVolume}</strong> demande(s) de prise en charge personnelle(s)
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn fw-extrabold shadow-sm hover-lift"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', minHeight: '40px', padding: '0.45rem 1rem', fontSize: '0.84rem' }}
                    disabled={safePage <= 1}
                    onClick={() => setClaimPage(prev => Math.max(1, prev - 1))}
                  >
                    ⬅️ Précédent
                  </button>

                  {getVisiblePages().map((p, idx) => {
                    if (p === '...') return <span key={`dots-${idx}`} style={{ padding: '0 0.3rem', color: 'var(--text-sub)' }}>...</span>;
                    return (
                      <button
                        key={p}
                        className="btn fw-extrabold shadow-sm hover-lift"
                        onClick={() => setClaimPage(p)}
                        style={{ 
                          minWidth: '40px', 
                          minHeight: '40px',
                          background: safePage === p ? '#059669' : 'var(--bg-card-subtle)',
                          color: safePage === p ? '#ffffff' : 'var(--text-main)',
                          border: safePage === p ? '1.5px solid #10b981' : '1.5px solid var(--border-color)',
                          borderRadius: '12px',
                          fontSize: '0.84rem'
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    className="btn fw-extrabold shadow-sm hover-lift"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', minHeight: '40px', padding: '0.45rem 1rem', fontSize: '0.84rem' }}
                    disabled={safePage >= totalPages}
                    onClick={() => setClaimPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Suivant ➡️
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      {/* CLAIM DETAIL MODAL (PORTAL DIRECTLY TO ROOT FOR IMMEDIATE ZERO-SCROLL CENTERED DISPLAY) */}
      {showDetailModal && typeof document !== 'undefined' && createPortal(
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0,
            bottom: 0,
            width: '100vw', 
            height: '100vh', 
            zIndex: 999999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            backgroundColor: 'rgba(0, 0, 0, 0.82)', 
            backdropFilter: 'blur(10px)', 
            padding: '1.25rem',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowDetailModal(null)}
        >
          <div 
            className="fade-in-up" 
            style={{ 
              maxWidth: '580px', 
              width: '100%', 
              borderRadius: '26px', 
              background: 'var(--bg-card, #111827)', 
              color: 'var(--text-main, #f9fafb)', 
              border: '1.5px solid var(--border-color, rgba(255,255,255,0.12))', 
              boxShadow: '0 30px 70px rgba(0, 0, 0, 0.75)', 
              padding: '2rem',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Close Button on same row */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, rgba(255,255,255,0.1))' }}>
              <div className="d-flex align-items-center gap-2.5">
                <span style={{ fontSize: '1.6rem' }}>📄</span>
                <div>
                  <h5 className="fw-black mb-0" style={{ color: 'var(--text-main, #ffffff)', fontSize: '1.25rem' }}>
                    Détails de la prise en charge
                  </h5>
                  <span style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '800', padding: '0.2rem 0.65rem', display: 'inline-block', marginTop: '0.25rem' }}>
                    #{showDetailModal.id}
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-sm hover-lift"
                style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--bg-card-subtle, rgba(255,255,255,0.06))', color: 'var(--text-sub, #9ca3af)', border: '1px solid var(--border-color, rgba(255,255,255,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', cursor: 'pointer' }}
                onClick={() => setShowDetailModal(null)}
              >
                ✕
              </button>
            </div>

            {/* Structured Details Box */}
            <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle, rgba(255,255,255,0.03))', border: '1.5px solid var(--border-color, rgba(255,255,255,0.08))', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="d-flex justify-content-between align-items-center">
                <span style={{ color: 'var(--text-sub, #9ca3af)', fontSize: '0.88rem', fontWeight: '600' }}>Bénéficiaire assuré :</span>
                <strong style={{ color: 'var(--text-main, #ffffff)', fontSize: '0.96rem' }}>{showDetailModal.beneficiary_name}</strong>
              </div>
              
              <div className="d-flex justify-content-between align-items-center">
                <span style={{ color: 'var(--text-sub, #9ca3af)', fontSize: '0.88rem', fontWeight: '600' }}>Structure de santé :</span>
                <strong style={{ color: 'var(--text-main, #ffffff)', fontSize: '0.96rem' }}>{showDetailModal.structure_name}</strong>
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <span style={{ color: 'var(--text-sub, #9ca3af)', fontSize: '0.88rem', fontWeight: '600' }}>Montant du devis :</span>
                <strong style={{ color: 'var(--text-main, #ffffff)', fontSize: '0.98rem' }}>{formatFCFA(showDetailModal.amount)}</strong>
              </div>

              <div className="d-flex justify-content-between align-items-center pt-3 border-top" style={{ borderColor: 'var(--border-color, rgba(255,255,255,0.08))' }}>
                <span style={{ color: 'var(--text-sub, #9ca3af)', fontSize: '0.88rem', fontWeight: '600' }}>Prise en charge UNAMUSC ({showDetailModal.coverage_rate}%) :</span>
                <strong style={{ color: '#10b981', fontSize: '1.25rem', fontWeight: '900' }}>{formatFCFA(showDetailModal.reimbursed_amount)}</strong>
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <span style={{ color: 'var(--text-sub, #9ca3af)', fontSize: '0.84rem' }}>Ticket modérateur (reste à charge) :</span>
                <span className="fw-bold text-warning" style={{ fontSize: '0.94rem' }}>{formatFCFA(showDetailModal.amount - showDetailModal.reimbursed_amount)}</span>
              </div>
            </div>

            {/* Actions with generous horizontal gap */}
            <div className="d-flex justify-content-end align-items-center gap-3 pt-2" style={{ marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn fw-bold hover-lift"
                style={{ background: 'var(--bg-card-subtle, rgba(255,255,255,0.06))', color: 'var(--text-main, #ffffff)', border: '1.5px solid var(--border-color, rgba(255,255,255,0.12))', borderRadius: '14px', minHeight: '48px', padding: '0.65rem 1.4rem', fontSize: '0.88rem', cursor: 'pointer' }} 
                onClick={() => setShowDetailModal(null)}
              >
                Fermer
              </button>
              <button 
                type="button" 
                className="btn fw-extrabold hover-lift d-flex align-items-center gap-2"
                style={{ background: '#059669', color: '#ffffff', border: '1.5px solid #10b981', borderRadius: '14px', minHeight: '48px', padding: '0.65rem 1.6rem', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)', cursor: 'pointer' }} 
                onClick={() => handleDownloadClaimDoc(showDetailModal)}
              >
                <span>📥</span> Télécharger le document PDF (🇸🇳)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}


