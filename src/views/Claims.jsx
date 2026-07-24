import React, { useState, useEffect } from 'react';

// Suivi des demandes de prise en charge (claims / remboursements / tiers-payant).
// Design Premium Haut de Gamme (Dark Emerald Glassmorphism)
export default function Claims({ lang = 'fr', portalMode, citizenUser, agentUser }) {
  const [claims, setClaims] = useState([
    {
      id: 'GAR-2026-8812',
      care_type: 'hospitalisation',
      beneficiary_name: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Awa Ndiaye',
      structure_name: 'Hôpital universitaire de Fann',
      amount: 45000,
      reimbursed_amount: 36000,
      status: 'approved',
      submitted_at: '2026-10-12T09:45:00Z',
      coverage_rate: 80
    },
    {
      id: 'BON-2026-9041',
      care_type: 'pharmacie',
      beneficiary_name: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Abdoulaye Ndiaye',
      structure_name: 'Pharmacie Cheikh Anta Diop',
      amount: 12500,
      reimbursed_amount: 6250,
      status: 'pending',
      submitted_at: '2026-10-08T14:20:00Z',
      coverage_rate: 50
    }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [careTypeTab, setCareTypeTab] = useState('hospitalisation'); // 'hospitalisation' or 'pharmacie'
  const [filterStatus, setFilterStatus] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  // Formulaire
  const [form, setForm] = useState({
    beneficiaryName: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Awa Ndiaye',
    phone: citizenUser?.phone || '+221 77 602 67 83',
    structureName: 'Hôpital universitaire de Fann',
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
      const newClaim = {
        id: careTypeTab === 'hospitalisation' ? `GAR-2026-${Math.floor(1000 + Math.random() * 9000)}` : `BON-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        care_type: careTypeTab,
        beneficiary_name: form.beneficiaryName,
        structure_name: form.structureName,
        amount: parseFloat(form.amount) || 0,
        reimbursed_amount: (parseFloat(form.amount) || 0) * (careTypeTab === 'hospitalisation' ? 0.8 : 0.5),
        status: 'pending',
        submitted_at: new Date().toISOString(),
        coverage_rate: careTypeTab === 'hospitalisation' ? 80 : 50
      };

      setClaims([newClaim, ...claims]);
      setSubmitLoading(false);
      setSubmitMsg(`✅ Demande #${newClaim.id} soumise avec succès au Tiers-Payant UNAMUSC.`);
    }, 600);
  };

  const statusBadge = (status) => {
    const map = { pending: 'En attente', approved: 'Validé', rejected: 'Refusé', paid: 'Remboursé' };
    const bgColors = {
      pending: 'rgba(245, 158, 11, 0.18)',
      approved: 'rgba(16, 185, 129, 0.18)',
      rejected: 'rgba(239, 68, 68, 0.18)',
      paid: 'rgba(20, 184, 166, 0.18)'
    };
    const textColors = {
      pending: '#f59e0b',
      approved: '#10b981',
      rejected: '#ef4444',
      paid: '#14b8a6'
    };
    return (
      <span style={{
        background: bgColors[status] || 'rgba(148, 163, 184, 0.15)',
        color: textColors[status] || '#94a3b8',
        padding: '0.35rem 0.85rem',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: '700',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        border: `1px solid ${textColors[status] || '#94a3b8'}33`
      }}>
        <span>●</span> {map[status] || status}
      </span>
    );
  };

  return (
    <div className="claims-view fade-in-up" style={{ minHeight: '100vh', background: '#0b1120', color: '#f8fafc', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(12px)', padding: '0.75rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0 text-white" style={{ fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Bons & Garanties</h5>
            <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '600', padding: '0.25rem 0.65rem' }}>
              ● SESSION SÉCURISÉE
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="input-group input-group-sm" style={{ width: '240px' }}>
              <input 
                type="text" 
                className="form-control bg-dark text-white border-secondary small" 
                placeholder="Rechercher une demande..." 
                style={{ borderRadius: '10px 0 0 10px', fontSize: '0.8rem', background: '#1e293b' }}
              />
              <button className="btn btn-outline-secondary" type="button" style={{ borderRadius: '0 10px 10px 0' }}>🔍</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>
        
        {/* Top Hero Card & Stats Grid */}
        <div className="row g-4 mb-4">
          <div className="col-lg-8">
            <div className="p-4 rounded-4" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(16, 185, 129, 0.25)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)' }}>
              <span className="badge bg-success text-white px-3 py-1.5 rounded-pill mb-2 fw-semibold" style={{ fontSize: '0.75rem' }}>TABLEAU DE BORD</span>
              <h2 className="fw-extrabold text-white mb-2" style={{ fontSize: '1.85rem', letterSpacing: '-0.02em' }}>Gestion des Prises en Charge</h2>
              <p className="text-white-50 mb-0" style={{ fontSize: '0.95rem', maxWidth: '640px', lineHeight: '1.5' }}>
                Effectuez vos demandes de bons de commande pharmacie (50%) et lettres de garantie hospitalisation (80%) en quelques clics sous le Tiers-Payant UNAMUSC.
              </p>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' }}>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <span className="small text-muted d-block fw-semibold" style={{ fontSize: '0.78rem' }}>Demandes en cours</span>
                  <h3 className="fw-bold text-white mb-0" style={{ fontSize: '1.8rem' }}>02</h3>
                </div>
                <div className="p-2.5 rounded-3 text-success" style={{ background: 'rgba(16, 185, 129, 0.15)', fontSize: '1.4rem' }}>
                  📑
                </div>
              </div>

              <div className="pt-3 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                <span className="small text-muted fw-semibold">Crédit disponible</span>
                <span className="fw-bold text-success" style={{ fontSize: '1.05rem' }}>125 000 FCFA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid (Form + Sidebar) */}
        <div className="row g-4 mb-4">
          
          {/* Main Form Section */}
          <div className="col-lg-8">
            <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                <div>
                  <h4 className="fw-bold text-white mb-1" style={{ fontSize: '1.25rem' }}>Nouvelle Demande</h4>
                  <p className="text-muted small mb-0">Remplissez les détails pour votre prise en charge immédiate.</p>
                </div>

                {/* Segmented Control Switcher */}
                <div className="p-1 rounded-3 d-flex gap-1" style={{ background: '#0f172a', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <button 
                    type="button" 
                    className={`btn btn-sm fw-bold px-3 py-2 rounded-3 transition-all ${careTypeTab === 'hospitalisation' ? 'btn-success text-white shadow-sm' : 'text-white-50'}`}
                    onClick={() => {
                      setCareTypeTab('hospitalisation');
                      setForm({ ...form, structureName: 'Hôpital universitaire de Fann', amount: '45000' });
                    }}
                    style={{ fontSize: '0.82rem', background: careTypeTab === 'hospitalisation' ? '#10b981' : 'transparent', border: 'none' }}
                  >
                    🏥 Hôpital (80%)
                  </button>
                  
                  <button 
                    type="button" 
                    className={`btn btn-sm fw-bold px-3 py-2 rounded-3 transition-all ${careTypeTab === 'pharmacie' ? 'btn-success text-white shadow-sm' : 'text-white-50'}`}
                    onClick={() => {
                      setCareTypeTab('pharmacie');
                      setForm({ ...form, structureName: 'Pharmacie Cheikh Anta Diop', amount: '12500' });
                    }}
                    style={{ fontSize: '0.82rem', background: careTypeTab === 'pharmacie' ? '#10b981' : 'transparent', border: 'none' }}
                  >
                    💊 Pharmacie (50%)
                  </button>
                </div>
              </div>

              {submitMsg && (
                <div className="alert alert-success py-2.5 px-3 rounded-3 small mb-4 fw-semibold d-flex align-items-center gap-2">
                  <span>ℹ️</span> {submitMsg}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-white-50">Bénéficiaire (Assuré)</label>
                    <input 
                      type="text" 
                      className="form-control text-white border-0 fw-semibold" 
                      style={{ background: '#0f172a', borderRadius: '12px', padding: '0.75rem 1rem' }} 
                      value={form.beneficiaryName}
                      onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-white-50">
                      {careTypeTab === 'hospitalisation' ? "Établissement de Santé" : "Pharmacie Partenaire Agréée"}
                    </label>
                    <input 
                      type="text" 
                      className="form-control text-white border-0 fw-semibold" 
                      style={{ background: '#0f172a', borderRadius: '12px', padding: '0.75rem 1rem' }} 
                      value={form.structureName}
                      onChange={(e) => setForm({ ...form, structureName: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-white-50">Montant Estimé (FCFA)</label>
                    <input 
                      type="number" 
                      className="form-control text-white border-0 fw-bold" 
                      style={{ background: '#0f172a', borderRadius: '12px', padding: '0.75rem 1rem', color: '#10b981' }} 
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-bold text-white-50">Date Prévue</label>
                    <input 
                      type="date" 
                      className="form-control text-white border-0 fw-semibold" 
                      style={{ background: '#0f172a', borderRadius: '12px', padding: '0.75rem 1rem' }} 
                      value={form.treatmentDate}
                      onChange={(e) => setForm({ ...form, treatmentDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Upload Dropzone */}
                <div className="mb-4">
                  <label className="form-label small fw-bold text-white-50">Pièce Justificative (Devis ou Ordonnance)</label>
                  <div 
                    className="p-4 text-center rounded-4 d-flex flex-column align-items-center justify-content-center gap-2"
                    style={{ 
                      border: '2px dashed rgba(16, 185, 129, 0.4)', 
                      background: 'rgba(15, 23, 42, 0.6)', 
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => document.getElementById('claim-file-input').click()}
                  >
                    <input 
                      type="file" 
                      id="claim-file-input" 
                      className="d-none" 
                      onChange={(e) => setUploadedFile(e.target.files[0])} 
                    />
                    <div className="p-3 rounded-circle" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '1.5rem' }}>
                      ☁️
                    </div>
                    <div>
                      <span className="fw-bold text-success small d-block">Cliquez pour télécharger</span>
                      <small className="text-muted">PDF, JPG, PNG (Max 5MB) — {uploadedFile ? uploadedFile.name : 'Aucun fichier sélectionné'}</small>
                    </div>
                  </div>
                </div>

                {/* Submit Actions */}
                <div className="d-flex justify-content-end gap-3 pt-2">
                  <button 
                    type="button" 
                    className="btn px-4 py-2.5 fw-bold text-white-50"
                    style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    onClick={() => alert("Brouillon enregistré.")}
                  >
                    Enregistrer Brouillon
                  </button>

                  <button 
                    type="submit" 
                    className="btn btn-success px-4 py-2.5 fw-bold text-white shadow-sm d-flex align-items-center gap-2"
                    style={{ background: '#10b981', borderRadius: '12px', border: 'none' }}
                    disabled={submitLoading}
                  >
                    <span>{submitLoading ? 'Envoi...' : 'Envoyer la Demande'}</span>
                    <span>→</span>
                  </button>
                </div>
              </form>

            </div>
          </div>

          {/* Right Sidebar */}
          <div className="col-lg-4">
            <div className="d-flex flex-column gap-4">
              
              {/* Card Informations Importantes */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h6 className="fw-bold text-white mb-3 d-flex align-items-center gap-2" style={{ fontSize: '0.95rem' }}>
                  <span className="text-warning">❓</span> Informations Importantes
                </h6>

                <div className="d-flex flex-column gap-3 small text-white-50">
                  <div className="d-flex gap-2.5 align-items-start">
                    <span className="badge bg-dark text-white rounded-circle p-1.5" style={{ width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyCenter: 'center' }}>1</span>
                    <span>Les lettres de garantie couvrent <strong>80% des frais d'hospitalisation</strong> dans les structures partenaires agréées.</span>
                  </div>

                  <div className="d-flex gap-2.5 align-items-start">
                    <span className="badge bg-dark text-white rounded-circle p-1.5" style={{ width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyCenter: 'center' }}>2</span>
                    <span>Le bon de pharmacie est valable <strong>48h</strong> après validation pour un remboursement direct de 50%.</span>
                  </div>

                  <div className="d-flex gap-2.5 align-items-start">
                    <span className="badge bg-dark text-white rounded-circle p-1.5" style={{ width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyCenter: 'center' }}>3</span>
                    <span>En cas d'urgence vitale, contactez directement le numéro vert gratuit CMU au <strong>112</strong>.</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-top border-secondary border-opacity-25 text-center">
                  <small className="text-success fw-semibold">Union Nationale des Mutuelles de Santé du Sénégal</small>
                </div>
              </div>

              {/* Card Besoin d'aide */}
              <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <h6 className="fw-bold text-white mb-3">Besoin d'aide ?</h6>

                <div className="d-flex flex-column gap-2">
                  <button 
                    type="button" 
                    className="btn w-100 py-2.5 px-3 text-start fw-bold text-white d-flex justify-content-between align-items-center"
                    style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.85rem' }}
                    onClick={() => alert("Mise en relation avec un agent UNAMUSC...")}
                  >
                    <span>🎧 Contacter un agent</span>
                    <span>›</span>
                  </button>

                  <button 
                    type="button" 
                    className="btn w-100 py-2.5 px-3 text-start fw-bold text-white d-flex justify-content-between align-items-center"
                    style={{ background: '#0f172a', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.85rem' }}
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
        <div className="p-4 rounded-4" style={{ background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)' }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-white mb-0" style={{ fontSize: '1.15rem' }}>Historique Récent</h5>
            <button className="btn btn-link text-success p-0 text-decoration-none fw-bold small">Voir tout l'historique</button>
          </div>

          <div className="table-responsive">
            <table className="table table-dark table-hover align-middle mb-0" style={{ background: 'transparent' }}>
              <thead>
                <tr className="text-muted small border-bottom border-secondary border-opacity-25" style={{ fontSize: '0.78rem' }}>
                  <th scope="col" className="fw-bold">TYPE / DATE</th>
                  <th scope="col" className="fw-bold">BÉNÉFICIAIRE</th>
                  <th scope="col" className="fw-bold">MONTANT</th>
                  <th scope="col" className="fw-bold">STATUT</th>
                  <th scope="col" className="fw-bold text-end">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {claims.map(c => (
                  <tr key={c.id} className="border-bottom border-secondary border-opacity-10">
                    <td className="py-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <div className="p-2 rounded-3" style={{ background: c.care_type === 'hospitalisation' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: c.care_type === 'hospitalisation' ? '#10b981' : '#f59e0b' }}>
                          {c.care_type === 'hospitalisation' ? '🏥' : '💊'}
                        </div>
                        <div>
                          <strong className="d-block text-white" style={{ fontSize: '0.9rem' }}>
                            {c.care_type === 'hospitalisation' ? 'Garantie Hosp.' : 'Bon Pharmacie'}
                          </strong>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {new Date(c.submitted_at).toLocaleDateString('fr-FR')}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="fw-semibold text-white-50" style={{ fontSize: '0.88rem' }}>{c.beneficiary_name}</span>
                    </td>
                    <td>
                      <strong className="text-white" style={{ fontSize: '0.9rem' }}>
                        {c.amount.toLocaleString('fr-FR')} FCFA
                      </strong>
                    </td>
                    <td>
                      {statusBadge(c.status)}
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-dark rounded-circle" style={{ width: '32px', height: '32px', padding: 0 }} onClick={() => alert(`Détails de la demande #${c.id}`)}>
                        👁️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
