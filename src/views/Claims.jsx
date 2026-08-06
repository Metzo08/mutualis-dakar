import React, { useState } from 'react';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { formatFCFA } from '../utils/formatters';

// Design Premium Haut de Gamme — Bons & Garanties (Prises en charge Tiers-Payant)
export default function Claims({ lang = 'fr', portalMode, citizenUser, agentUser }) {
  const [careTypeTab, setCareTypeTab] = useState('hospitalisation'); // 'hospitalisation' or 'pharmacie'
  const [filterStatus, setFilterStatus] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(null);

  // Demandes
  const [claims, setClaims] = useState([
    {
      id: 'GAR-2026-8812',
      care_type: 'hospitalisation',
      beneficiary_name: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Awa Ndiaye',
      structure_name: 'Hôpital Universitaire de Fann (Dakar)',
      amount: 45000,
      reimbursed_amount: 36000,
      status: 'approved',
      submitted_at: '12/10/2026',
      coverage_rate: 80,
      desc: 'Intervention chirurgicale herniaire & hospitalisation 48h'
    },
    {
      id: 'BON-2026-9041',
      care_type: 'pharmacie',
      beneficiary_name: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Abdoulaye Ndiaye',
      structure_name: 'Pharmacie Cheikh Anta Diop',
      amount: 12500,
      reimbursed_amount: 6250,
      status: 'pending',
      submitted_at: '08/10/2026',
      coverage_rate: 50,
      desc: 'Ordonnance antibiotiques & anti-inflammatoires'
    }
  ]);
  
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
    alert(`✅ Demande #${id} mise à jour : ${newStatus.toUpperCase()}`);
  };

  const handleDownloadClaimDoc = (claim) => {
    const isHosp = claim.care_type === 'hospitalisation';
    generateOfficialPdf({
      filename: `prise_en_charge_${claim.id}.pdf`,
      docType: isHosp ? 'LETTRE DE GARANTIE HOSPITALIÈRE (80%)' : 'BON DE COMMANDE PHARMACIE (50%)',
      title: isHosp ? 'Lettre de Garantie Hospitalière Tiers-Payant' : 'Bon de Commande Pharmacie UNAMUSC',
      referenceNo: claim.id,
      beneficiaryName: claim.beneficiary_name,
      cmuNumber: 'CMU-DKR-2026-8812',
      structureName: claim.structure_name,
      details: [
        { label: 'Bénéficiaire d\'Ayant droit', value: claim.beneficiary_name },
        { label: 'Établissement / Pharmacie Agréée', value: claim.structure_name },
        { label: 'Montant devis soumis', value: formatFCFA(claim.amount) },
        { label: 'Prise en charge UNAMUSC', value: `${formatFCFA(claim.reimbursed_amount)} (${claim.coverage_rate}%)` },
        { label: 'Ticket Modérateur Assuré', value: formatFCFA(claim.amount - claim.reimbursed_amount) },
        { label: 'Date d\'émission officielle', value: claim.submitted_at }
      ],
      notes: isHosp 
        ? 'La présente lettre de garantie autorise l\'admission immédiate du bénéficiaire avec prise en charge directe de 80% des soins d\'hospitalisation.'
        : 'Le présent bon de commande donne droit au remboursement ou à la délivrance directe avec 50% de réduction en pharmacie agréée.'
    });
  };

  const filteredClaims = filterStatus ? claims.filter(c => c.status === filterStatus) : claims;

  return (
    <div className="claims-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>Bons & Garanties 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'var(--border-color)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600', padding: '0.25rem 0.75rem' }}>
              ● SESSION SÉCURISÉE UNAMUSC
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              <option value="">🔍 Filtrer par statut (Tous)</option>
              <option value="pending">⏳ En attente</option>
              <option value="approved">✅ Validé</option>
              <option value="rejected">❌ Refusé</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card & Stats Grid */}
        <div className="row g-4 mb-5">
          <div className="col-lg-8">
            <div className="p-5 rounded-4 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_claims_hero.png") center/cover no-repeat', padding: '3.75rem 2.5rem', minHeight: '240px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }}>
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.75rem', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                🇸🇳 UNAMUSC SÉNÉGAL
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.35rem', letterSpacing: '-0.02em', textShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>Gestion des prises en charge</h1>
              <p className="text-white-50 mb-0" style={{ fontSize: '1.05rem', maxWidth: '720px', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                Effectuez vos demandes de bons de commande pharmacie (50%) et lettres de garantie hospitalisation (80%) en quelques clics sous le Tiers-Payant UNAMUSC.
              </p>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="small d-block fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>Demandes en cours</span>
                  <h3 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.8rem' }}>02</h3>
                </div>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                  📑
                </div>
              </div>

              <div className="pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--border-color)' }}>
                <span className="small fw-semibold" style={{ color: 'var(--text-sub)' }}>Crédit disponible</span>
                <span className="fw-bold text-success" style={{ fontSize: '1.05rem' }}>125 000 FCFA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid (Form + Sidebar) */}
        <div className="row g-4 mb-4">
          
          {/* Main Form Section */}
          <div className="col-lg-8">
            <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                  <h4 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>Nouvelle Demande</h4>
                  <p className="small mb-0" style={{ color: 'var(--text-sub)' }}>Remplissez les détails pour votre prise en charge immédiate.</p>
                </div>

                {/* Segmented Control Switcher */}
                <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', padding: '0.3rem', borderRadius: '12px', display: 'flex', gap: '0.4rem' }}>
                  <button 
                    type="button" 
                    style={{ 
                      background: careTypeTab === 'hospitalisation' ? '#10b981' : 'transparent', 
                      color: careTypeTab === 'hospitalisation' ? '#ffffff' : 'var(--text-sub)', 
                      border: 'none', 
                      borderRadius: '8px', 
                      padding: '0.5rem 1rem', 
                      fontWeight: '700', 
                      fontSize: '0.82rem',
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
                    style={{ 
                      background: careTypeTab === 'pharmacie' ? '#10b981' : 'transparent', 
                      color: careTypeTab === 'pharmacie' ? '#ffffff' : 'var(--text-sub)', 
                      border: 'none', 
                      borderRadius: '8px', 
                      padding: '0.5rem 1rem', 
                      fontWeight: '700', 
                      fontSize: '0.82rem',
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
                <div className="p-3 mb-4 rounded-3 small fw-bold" style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981' }}>
                  {submitMsg}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Prénom & Nom de l'assuré *</label>
                    <input 
                      type="text" 
                      className="form-control fw-semibold" 
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                      value={form.beneficiaryName}
                      onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>
                      {careTypeTab === 'hospitalisation' ? "Établissement d'accueil récepteur *" : "Pharmacie partenaire agréée UNAMUSC *"}
                    </label>
                    {careTypeTab === 'hospitalisation' ? (
                      <select 
                        className="form-select" 
                        style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
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
                        className="form-select" 
                        style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
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
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Devis estimatif soumis (FCFA) *</label>
                    <input 
                      type="number" 
                      className="form-control fw-bold" 
                      style={{ background: 'var(--bg-card-subtle)', color: '#10b981', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Date d'admission ou de soin *</label>
                    <input 
                      type="date" 
                      className="form-control fw-semibold" 
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                      value={form.treatmentDate}
                      onChange={(e) => setForm({ ...form, treatmentDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Description de l'acte / Ordonnance *</label>
                  <textarea 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    rows={2} 
                    value={form.careDescription} 
                    onChange={(e) => setForm({ ...form, careDescription: e.target.value })}
                    placeholder="Détails de l'intervention ou liste des médicaments..."
                  />
                </div>

                {/* Estimation automatique UNAMUSC */}
                <div className="p-3 mb-4 rounded-3 d-flex justify-content-between align-items-center" style={{ background: 'var(--bg-card-subtle)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div>
                    <small className="d-block" style={{ color: 'var(--text-sub)' }}>Estimation automatique UNAMUSC ({careTypeTab === 'hospitalisation' ? '80%' : '50%'}) :</small>
                    <strong className="small" style={{ color: 'var(--text-main)' }}>Prise en charge directe sous le Tiers-Payant UNAMUSC.</strong>
                  </div>
                  <div className="text-end">
                    <small className="d-block" style={{ color: 'var(--text-sub)' }}>Montant pris en charge :</small>
                    <h4 className="fw-bold text-success mb-0">
                      {formatFCFA((parseFloat(form.amount) || 0) * (careTypeTab === 'hospitalisation' ? 0.8 : 0.5))}
                    </h4>
                  </div>
                </div>

                {/* Upload Dropzone */}
                <div className="mb-4">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Pièce Justificative (Devis ou Ordonnance)</label>
                  <div 
                    className="p-4 text-center rounded-4 d-flex flex-column align-items-center justify-content-center gap-2"
                    style={{ 
                      border: '2px dashed var(--primary)', 
                      background: 'var(--bg-card-subtle)', 
                      cursor: 'pointer'
                    }}
                    onClick={() => document.getElementById('claim-file-input').click()}
                  >
                    <input 
                      type="file" 
                      id="claim-file-input" 
                      className="d-none" 
                      onChange={(e) => setUploadedFile(e.target.files[0])} 
                    />
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                      ☁️
                    </div>
                    <div>
                      <span className="fw-bold text-success small d-block">Cliquez pour télécharger l'ordonnance ou le devis</span>
                      <small style={{ color: 'var(--text-sub)' }}>PDF, JPG, PNG (Max 5MB) — {uploadedFile ? uploadedFile.name : 'Aucun fichier sélectionné'}</small>
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="d-flex justify-content-end gap-3 pt-2">
                  <button 
                    type="button" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.25rem', fontWeight: '700', cursor: 'pointer' }}
                    onClick={() => alert("Brouillon enregistré.")}
                  >
                    Enregistrer Brouillon
                  </button>

                  <button 
                    type="submit" 
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}
                    disabled={submitLoading}
                  >
                    {submitLoading ? 'Envoi...' : '📤 Soumettre la demande à l\'UNAMUSC'}
                  </button>
                </div>
              </form>

            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-lg-4">
            <div className="d-flex flex-column gap-4">
              
              {/* Card Informations Importantes */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>
                  <span className="text-warning">❓</span> Informations Importantes
                </h6>

                <div className="d-flex flex-column gap-3 small" style={{ color: 'var(--text-sub)' }}>
                  <div className="d-flex gap-2.5 align-items-start">
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '700', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                    <span>Les lettres de garantie couvrent <strong>80% des frais d'hospitalisation</strong> dans les structures partenaires.</span>
                  </div>

                  <div className="d-flex gap-2.5 align-items-start">
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '700', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
                    <span>Le bon de pharmacie est valable <strong>48h</strong> après validation pour un remboursement direct de 50%.</span>
                  </div>

                  <div className="d-flex gap-2.5 align-items-start">
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', fontWeight: '700', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</span>
                    <span>En cas d'urgence, contactez le numéro vert gratuit CMU au <strong>112</strong>.</span>
                  </div>
                </div>
              </div>

              {/* Card Besoin d'aide */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>Besoin d'aide ?</h6>

                <div className="d-flex flex-column gap-2">
                  <button 
                    type="button" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1rem', fontWeight: '700', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => alert("Mise en relation avec un agent UNAMUSC...")}
                  >
                    <span>🎧 Contacter un agent</span>
                    <span>›</span>
                  </button>

                  <button 
                    type="button" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1rem', fontWeight: '700', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                    onClick={() => window.location.hash = '#/directory'}
                  >
                    <span>🗺️ Structures agréées</span>
                    <span>›</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Historique Récent Table Card */}
        <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
          <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Historique Récent des Demandes</h5>

          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
              <thead>
                <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)', fontSize: '0.78rem' }}>
                  <th scope="col" className="fw-bold">TYPE / N° DEMANDE</th>
                  <th scope="col" className="fw-bold">BÉNÉFICIAIRE</th>
                  <th scope="col" className="fw-bold">STRUCTURE</th>
                  <th scope="col" className="fw-bold">MONTANT</th>
                  <th scope="col" className="fw-bold">STATUT</th>
                  <th scope="col" className="fw-bold text-end">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map(c => (
                  <tr key={c.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="py-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: c.care_type === 'hospitalisation' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)', color: c.care_type === 'hospitalisation' ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.care_type === 'hospitalisation' ? '🏥' : '💊'}
                        </div>
                        <div>
                          <strong className="d-block" style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                            #{c.id}
                          </strong>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>{c.submitted_at}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{c.beneficiary_name}</span></td>
                    <td><span className="small" style={{ color: 'var(--text-sub)' }}>{c.structure_name}</span></td>
                    <td>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                        {formatFCFA(c.amount)}
                      </strong>
                      <small className="text-success d-block" style={{ fontSize: '0.72rem' }}>({formatFCFA(c.reimbursed_amount)} pris en charge)</small>
                    </td>
                    <td>
                      <span style={{ 
                        background: c.status === 'approved' ? 'rgba(16, 185, 129, 0.2)' : c.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', 
                        color: c.status === 'approved' ? '#10b981' : c.status === 'rejected' ? '#ef4444' : '#d97706', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: '700' 
                      }}>
                        {c.status === 'approved' ? '✅ Validé' : c.status === 'rejected' ? '❌ Refusé' : '⏳ En attente'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end">
                        <button 
                          type="button" 
                          style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.3rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer' }} 
                          onClick={() => setShowDetailModal(c)}
                        >
                          👁️ Voir
                        </button>
                        
                        {isAgent && c.status === 'pending' && (
                          <>
                            <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: '700' }} onClick={() => handleAgentProcess(c.id, 'approved')}>Approuver</button>
                            <button type="button" style={{ background: '#ef4444', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: '700' }} onClick={() => handleAgentProcess(c.id, 'rejected')}>Refuser</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* CLAIM DETAIL MODAL */}
      {showDetailModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content p-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-3">📄 Détails Prise en Charge #{showDetailModal.id}</h5>
              <div className="p-3 rounded-3 mb-3 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                <small className="d-block" style={{ color: 'var(--text-sub)' }}>Bénéficiaire : <strong style={{ color: 'var(--text-main)' }}>{showDetailModal.beneficiary_name}</strong></small>
                <small className="d-block" style={{ color: 'var(--text-sub)' }}>Structure : <strong style={{ color: 'var(--text-main)' }}>{showDetailModal.structure_name}</strong></small>
                <small className="d-block" style={{ color: 'var(--text-sub)' }}>Montant Devis : <strong style={{ color: 'var(--text-main)' }}>{formatFCFA(showDetailModal.amount)}</strong></small>
                <small className="d-block" style={{ color: 'var(--text-sub)' }}>Prise en charge UNAMUSC ({showDetailModal.coverage_rate}%) : <strong className="text-success">{formatFCFA(showDetailModal.reimbursed_amount)}</strong></small>
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 1rem' }} onClick={() => setShowDetailModal(null)}>Fermer</button>
                <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1.25rem', fontWeight: '700', cursor: 'pointer' }} onClick={() => handleDownloadClaimDoc(showDetailModal)}>📥 Télécharger le document PDF (🇸🇳)</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
