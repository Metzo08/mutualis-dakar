import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';

export default function RsePortal({ lang, setView, portalMode, agentUser }) {
  const [beneficiariesCount, setBeneficiariesCount] = useState(50);
  const [corporateRevenue, setCorporateRevenue] = useState(50000000); // 50M FCFA
  const [selectedDept, setSelectedDept] = useState('Dakar');
  
  // Simulated pledges submitted in session
  const [pledges, setPledges] = useState([]);
  const [pledgeForm, setPledgeForm] = useState({
    companyName: '',
    contactEmail: '',
    phone: '',
    notes: '',
    agreed: false
  });
  const [showPledgeModal, setShowPledgeModal] = useState(null); // stores the advocacy item if active

  // Mock list of UNAMUSC advocacy campaigns
  const initialAdvocacyCampaigns = [
    {
      id: 1,
      title: "Enrôlement de 100 Ndongo Daaras à Mbao",
      targetDept: "Dakar",
      initiator: "Imam Moussa Ndiaye (UNAMUSC Mbao)",
      description: "Le Daara Sopé Nabil de Mbao compte plus de 100 jeunes talibés vivant dans des conditions précaires. Ce plaidoyer vise à leur offrir une couverture maladie complète de 12 mois.",
      countNeeded: 100,
      annualCost: 450000,
      fulfilled: false
    },
    {
      id: 2,
      title: "Couverture Mutuelle pour 150 élèves à Keur Massar",
      targetDept: "Keur Massar",
      initiator: "Fatou Kiné Sow (UNAMUSC Keur Massar)",
      description: "Soutien aux enfants de l'école primaire publique Keur Massar 2. Une couverture maladie leur permettra de suivre l'année scolaire sans interruption liée aux frais médicaux.",
      countNeeded: 150,
      annualCost: 675000,
      fulfilled: false
    },
    {
      id: 3,
      title: "Parrainage Solidaire des Familles Vulnérables de Rufisque Est",
      targetDept: "Rufisque",
      initiator: "Ousmane Diop (UDMS Rufisque)",
      description: "Plaidoyer pour l'enrôlement de 200 mères célibataires et leurs enfants dans la mutuelle de Rufisque Est.",
      countNeeded: 200,
      annualCost: 900000,
      fulfilled: false
    },
    {
      id: 4,
      title: "Couverture Sanitaire pour les Jeunes Pêcheurs de Guet Ndar",
      targetDept: "Saint-Louis",
      initiator: "Moustapha Fall (UNAMUSC Saint-Louis)",
      description: "Enrôlement de 120 jeunes apprentis pêcheurs n'ayant aucune couverture sociale contre les accidents professionnels.",
      countNeeded: 120,
      annualCost: 540000,
      fulfilled: false
    }
  ];

  const [advocacyList, setAdvocacyList] = useState(initialAdvocacyCampaigns);

  const isAgentOrAdmin = portalMode === 'agent' && (agentUser?.role === 'Super Admin' || agentUser?.role === 'Admin Régional');

  const [showCreateAdvocacy, setShowCreateAdvocacy] = useState(false);
  const [newAdvocacy, setNewAdvocacy] = useState({
    title: '',
    targetDept: 'Dakar',
    initiator: '',
    description: '',
    countNeeded: 100
  });

  const handleCreateAdvocacy = (e) => {
    e.preventDefault();
    if (!newAdvocacy.title || !newAdvocacy.initiator || !newAdvocacy.description) {
      alert("Veuillez remplir tous les champs.");
      return;
    }
    const created = {
      id: Date.now(),
      title: newAdvocacy.title,
      targetDept: newAdvocacy.targetDept,
      initiator: newAdvocacy.initiator,
      description: newAdvocacy.description,
      countNeeded: parseInt(newAdvocacy.countNeeded) || 100,
      annualCost: (parseInt(newAdvocacy.countNeeded) || 100) * 4500,
      fulfilled: false
    };
    setAdvocacyList([created, ...advocacyList]);
    setNewAdvocacy({ title: '', targetDept: 'Dakar', initiator: '', description: '', countNeeded: 100 });
    setShowCreateAdvocacy(false);
    alert("Le plaidoyer a été créé avec succès.");
  };

  // Constants
  const ANNUAL_UNIT_COST = 4500; // 4500 FCFA per beneficiary per year for CMU

  const totalCost = beneficiariesCount * ANNUAL_UNIT_COST;
  const maxTaxDeductionLimit = corporateRevenue * 0.005; // 0.5% of revenue in Senegal
  const actualTaxDeduction = Math.min(totalCost, maxTaxDeductionLimit);
  const netCorporateCost = totalCost - (actualTaxDeduction * 0.3); // assuming 30% corporate tax rate in Senegal

  const handlePledgeSubmit = (e) => {
    e.preventDefault();
    if (!pledgeForm.companyName || !pledgeForm.contactEmail) {
      alert("Veuillez remplir les informations obligatoires.");
      return;
    }

    const newPledge = {
      id: Date.now(),
      companyName: pledgeForm.companyName,
      targetDept: showPledgeModal ? showPledgeModal.targetDept : selectedDept,
      beneficiariesCount: showPledgeModal ? showPledgeModal.countNeeded : beneficiariesCount,
      amount: showPledgeModal ? showPledgeModal.annualCost : totalCost,
      advocacyTitle: showPledgeModal ? showPledgeModal.title : "Parrainage direct",
      date: new Date().toLocaleDateString('fr-FR')
    };

    // If answering a specific advocacy, mark it as fulfilled in local state
    if (showPledgeModal) {
      setAdvocacyList(advocacyList.map(a => a.id === showPledgeModal.id ? { ...a, fulfilled: true } : a));
    }

    setPledges([newPledge, ...pledges]);
    setPledgeForm({ companyName: '', contactEmail: '', phone: '', notes: '', agreed: false });
    setShowPledgeModal(null);
    alert("Merci pour votre engagement RSE ! Votre promesse de parrainage a été enregistrée avec succès. Un conseiller de l'UDMS vous contactera sous 24h.");
  };

  return (
    <div className="rse-portal fade-in-up" style={{ color: 'var(--text-color)', fontFamily: 'inherit' }}>
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.95), rgba(4, 120, 87, 0.85)), url("/csu_verify_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '3rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-lg)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '0.35rem 1rem',
            borderRadius: '50px',
            fontSize: '0.8rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '1rem',
            display: 'inline-block'
          }}>
            Espace RSE & impact social 🇸🇳
          </span>
          <h1 style={{ color: '#fff', fontSize: '2.25rem', fontWeight: '800', marginBottom: '0.75rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Responsabilité sociétale des entreprises
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '1.05rem', fontWeight: '500', lineHeight: '1.6' }}>
            Associez la performance de votre entreprise à la solidarité nationale. Financez la couverture maladie universelle des populations vulnérables et profitez d'incitations fiscales attractives.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        
        {/* Core Value Proposition cards */}
        {isAgentOrAdmin && (
          <div className="grid grid-3" style={{ gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '4px solid #10b981' }}>
              <div style={{ fontSize: '2rem' }}>🎯</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Impact direct</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.5' }}>
                Enrôlez directement des enfants talibés, des élèves du primaire ou des familles à faible revenu dans les mutuelles de santé UDMS locales.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '2rem' }}>⚖️</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Déduction fiscale</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.5' }}>
                Selon la législation fiscale sénégalaise, les dons RSE aux structures de santé et mutuelles de CMU sont 100% déductibles du bénéfice imposable.
              </p>
            </div>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '2rem' }}>🤝</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>Valorisation RSE</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.5' }}>
                Obtenez un label "Partenaire Solidaire National" décerné par l'UNAMUSC pour valoriser votre impact social auprès de vos clients et partenaires.
              </p>
            </div>
          </div>
        )}

        {/* Dynamic Simulator & Form */}
        {isAgentOrAdmin ? (
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '2rem', marginBottom: '3rem' }}>
            
            {/* Left: Simulator */}
            <div className="card" style={{ padding: '2rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📊 Simulateur de contribution RSE
              </h2>
              
              {/* Step 1: Beneficiaries Count */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Nombre de personnes à enrôler (1 an)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      className="input" 
                      value={beneficiariesCount} 
                      onChange={(e) => setBeneficiariesCount(Math.max(0, parseInt(e.target.value) || 0))} 
                      style={{ width: '100px', padding: '0.25rem 0.5rem', fontSize: '0.9rem', fontWeight: '700', textAlign: 'right', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                    <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '0.9rem' }}>bénéficiaires</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="10000" 
                  step="10"
                  value={Math.min(10000, beneficiariesCount)} 
                  onChange={(e) => setBeneficiariesCount(parseInt(e.target.value))} 
                  style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--primary)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
                  <span>10 (PME)</span>
                  <span>1 000 (ETI)</span>
                  <span>10 000 (Grande Entreprise)</span>
                </div>
              </div>

              {/* Step 2: Revenue for tax deduction limit */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Chiffre d'affaires annuel de l'entreprise</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input 
                      type="number" 
                      className="input" 
                      value={corporateRevenue} 
                      onChange={(e) => setCorporateRevenue(Math.max(0, parseInt(e.target.value) || 0))} 
                      style={{ width: '150px', padding: '0.25rem 0.5rem', fontSize: '0.9rem', fontWeight: '700', textAlign: 'right', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                    />
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>FCFA</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="10000000" 
                  max="100000000000" 
                  step="50000000"
                  value={Math.min(100000000000, corporateRevenue)} 
                  onChange={(e) => setCorporateRevenue(parseInt(e.target.value))} 
                  style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
                  <span>10 millions FCFA</span>
                  <span>10 milliards FCFA</span>
                  <span>100 milliards FCFA</span>
                </div>
              </div>

              {/* Financial Results Table */}
              <div style={{ backgroundColor: 'var(--bg-alt)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-color)' }}>💡 Détail financier & avantages fiscaux</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-sub)' }}>Coût unitaire d'enrôlement par personne / an</span>
                    <span style={{ fontWeight: '600' }}>4 500 FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-sub)' }}>Don RSE global (investissement de départ)</span>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{new Intl.NumberFormat('fr-FR').format(totalCost)} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ color: 'var(--text-sub)' }}>Plafond de déduction fiscale RSE (0.5% du CA)</span>
                    <span style={{ fontWeight: '600', color: '#3b82f6' }}>{new Intl.NumberFormat('fr-FR').format(maxTaxDeductionLimit)} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-sub)' }}>Montant déductible fiscalement</span>
                    <span style={{ fontWeight: '600', color: '#10b981' }}>{new Intl.NumberFormat('fr-FR').format(actualTaxDeduction)} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-color)' }}>Coût réel net pour l'entreprise (après impôt)</span>
                    <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '1.1rem' }}>
                      {new Intl.NumberFormat('fr-FR').format(Math.max(0, netCorporateCost))} FCFA
                    </span>
                  </div>
                </div>
              </div>

              {/* Geo targeting */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>🎯 Cibler un département spécifique</label>
                <select className="input" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} style={{ width: '100%' }}>
                  <option value="Dakar">UDMS de Dakar</option>
                  <option value="Pikine">UDMS de Pikine</option>
                  <option value="Guédiawaye">UDMS de Guédiawaye</option>
                  <option value="Rufisque">UDMS de Rufisque</option>
                  <option value="Keur Massar">UDMS de Keur Massar</option>
                  <option value="Thiès">UDMS de Thiès</option>
                  <option value="Mbour">UDMS de Mbour</option>
                  <option value="Saint-Louis">UDMS de Saint-Louis</option>
                  <option value="Louga">UDMS de Louga</option>
                  <option value="Kaolack">UDMS de Kaolack</option>
                </select>
              </div>
            </div>

            {/* Right: Pledge Form */}
            <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✍️ Promesse de parrainage
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
                  Soumettez votre intention de parrainage pour initier la convention RSE officielle avec les représentants nationaux.
                </p>
                
                <form onSubmit={handlePledgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Nom de l'entreprise *</label>
                    <input 
                      className="input" 
                      required 
                      placeholder="Ex: Sonatel, ICS, Orange..." 
                      value={pledgeForm.companyName}
                      onChange={(e) => setPledgeForm({ ...pledgeForm, companyName: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Email Contact *</label>
                      <input 
                        className="input" 
                        type="email" 
                        required 
                        placeholder="rse@entreprise.sn" 
                        value={pledgeForm.contactEmail}
                        onChange={(e) => setPledgeForm({ ...pledgeForm, contactEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Téléphone</label>
                      <input 
                        className="input" 
                        placeholder="+221 77..." 
                        value={pledgeForm.phone}
                        onChange={(e) => setPledgeForm({ ...pledgeForm, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Notes / Instructions spécifiques</label>
                    <textarea 
                      className="input" 
                      rows={3} 
                      placeholder="Cibler des écoles primaires rurales, des daaras coraniques, etc."
                      value={pledgeForm.notes}
                      onChange={(e) => setPledgeForm({ ...pledgeForm, notes: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      id="rse-agree"
                      required
                      checked={pledgeForm.agreed}
                      onChange={(e) => setPledgeForm({ ...pledgeForm, agreed: e.target.checked })}
                      style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                    />
                    <label htmlFor="rse-agree" style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                      Je confirme notre intérêt d'enrôler <strong>{beneficiariesCount}</strong> bénéficiaires pour un montant de <strong>{new Intl.NumberFormat('fr-FR').format(totalCost)} FCFA</strong> à destination de l'<strong>UDMS de {selectedDept}</strong>.
                    </label>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: '700', marginTop: '0.5rem' }}
                  >
                    🚀 Envoyer la promesse RSE
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: '650px', margin: '0 auto 3rem auto' }}>
            <div className="card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                ✍️ Promesse de parrainage
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                Soumettez votre intention de parrainage pour initier la convention RSE officielle avec les représentants nationaux.
              </p>
              
              <form onSubmit={handlePledgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Nom de l'entreprise *</label>
                  <input 
                    className="input" 
                    required 
                    placeholder="Ex: Sonatel, ICS, Orange..." 
                    value={pledgeForm.companyName}
                    onChange={(e) => setPledgeForm({ ...pledgeForm, companyName: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Nombre de personnes à enrôler *</label>
                    <input 
                      className="input" 
                      type="number" 
                      required 
                      min="1"
                      value={beneficiariesCount} 
                      onChange={(e) => setBeneficiariesCount(Math.max(1, parseInt(e.target.value) || 1))} 
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Département ciblé *</label>
                    <select className="input" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} style={{ width: '100%' }}>
                      <option value="Dakar">UDMS de Dakar</option>
                      <option value="Pikine">UDMS de Pikine</option>
                      <option value="Guédiawaye">UDMS de Guédiawaye</option>
                      <option value="Rufisque">UDMS de Rufisque</option>
                      <option value="Keur Massar">UDMS de Keur Massar</option>
                      <option value="Thiès">UDMS de Thiès</option>
                      <option value="Mbour">UDMS de Mbour</option>
                      <option value="Saint-Louis">UDMS de Saint-Louis</option>
                      <option value="Louga">UDMS de Louga</option>
                      <option value="Kaolack">UDMS de Kaolack</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Email Contact *</label>
                    <input 
                      className="input" 
                      type="email" 
                      required 
                      placeholder="rse@entreprise.sn" 
                      value={pledgeForm.contactEmail}
                      onChange={(e) => setPledgeForm({ ...pledgeForm, contactEmail: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Téléphone</label>
                    <input 
                      className="input" 
                      placeholder="+221 77..." 
                      value={pledgeForm.phone}
                      onChange={(e) => setPledgeForm({ ...pledgeForm, phone: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Notes / Instructions spécifiques</label>
                  <textarea 
                    className="input" 
                    rows={3} 
                    placeholder="Cibler des écoles primaires rurales, des daaras coraniques, etc."
                    value={pledgeForm.notes}
                    onChange={(e) => setPledgeForm({ ...pledgeForm, notes: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="rse-agree-public"
                    required
                    checked={pledgeForm.agreed}
                    onChange={(e) => setPledgeForm({ ...pledgeForm, agreed: e.target.checked })}
                    style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="rse-agree-public" style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    Je confirme notre intérêt d'enrôler <strong>{beneficiariesCount}</strong> bénéficiaires pour un montant de <strong>{new Intl.NumberFormat('fr-FR').format(totalCost)} FCFA</strong> à destination de l'<strong>UDMS de {selectedDept}</strong>.
                  </label>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: '700', marginTop: '0.5rem' }}
                >
                  🚀 Envoyer la promesse RSE
                </button>
              </form>
            </div>
          </div>
        )}

        {/* UNAMUSC Advocacy Section */}
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📢 Campagnes de plaidoyer actives (UNAMUSC)
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', margin: '0.25rem 0 0 0' }}>
                Les membres et agents régionaux de l'UNAMUSC sollicitent l'appui des entreprises pour parrainer des communautés ciblées.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.8rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.35rem 0.75rem', borderRadius: '50px', fontWeight: '700' }}>
                {advocacyList.filter(a => !a.fulfilled).length} plaidoyers en attente
              </span>
              {isAgentOrAdmin && (
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCreateAdvocacy(!showCreateAdvocacy)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.75rem', fontWeight: 'bold' }}
                >
                  {showCreateAdvocacy ? '✕ Fermer' : '➕ Créer un plaidoyer'}
                </button>
              )}
            </div>
          </div>

          {showCreateAdvocacy && (
            <div className="card text-left fade-in-up" style={{ padding: '2rem', marginBottom: '2rem', borderLeft: '4px solid var(--secondary)', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.2rem', fontWeight: '850', color: 'var(--secondary)' }}>➕ Lancer une nouvelle campagne de plaidoyer (UNAMUSC)</h3>
              <form onSubmit={handleCreateAdvocacy} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Titre du plaidoyer *</label>
                    <input 
                      className="input" 
                      required 
                      placeholder="Ex: Enrôlement de 100 Ndongo Daaras à Pikine" 
                      value={newAdvocacy.title}
                      onChange={(e) => setNewAdvocacy({ ...newAdvocacy, title: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Initié par *</label>
                    <input 
                      className="input" 
                      required 
                      placeholder="Ex: Oustaz Alioune (Maitre Daara)" 
                      value={newAdvocacy.initiator}
                      onChange={(e) => setNewAdvocacy({ ...newAdvocacy, initiator: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Nombre de personnes à enrôler *</label>
                    <input 
                      className="input" 
                      type="number"
                      required 
                      min="1"
                      value={newAdvocacy.countNeeded}
                      onChange={(e) => setNewAdvocacy({ ...newAdvocacy, countNeeded: parseInt(e.target.value) || 0 })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Département ciblé *</label>
                    <select 
                      className="input" 
                      value={newAdvocacy.targetDept} 
                      onChange={(e) => setNewAdvocacy({ ...newAdvocacy, targetDept: e.target.value })}
                      style={{ width: '100%' }}
                    >
                      <option value="Dakar">Dakar</option>
                      <option value="Pikine">Pikine</option>
                      <option value="Guédiawaye">Guédiawaye</option>
                      <option value="Rufisque">Rufisque</option>
                      <option value="Keur Massar">Keur Massar</option>
                      <option value="Thiès">Thiès</option>
                      <option value="Mbour">Mbour</option>
                      <option value="Saint-Louis">Saint-Louis</option>
                      <option value="Louga">Louga</option>
                      <option value="Kaolack">Kaolack</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)', display: 'block', marginBottom: '0.35rem' }}>Description détaillée du plaidoyer *</label>
                  <textarea 
                    className="input" 
                    required 
                    rows={3} 
                    placeholder="Expliquez la situation de vulnérabilité de la communauté et pourquoi ils ont besoin de parrainage..."
                    value={newAdvocacy.description}
                    onChange={(e) => setNewAdvocacy({ ...newAdvocacy, description: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowCreateAdvocacy(false)}>Annuler</button>
                  <button type="submit" className="btn btn-secondary">Publier le plaidoyer</button>
                </div>
              </form>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {advocacyList.map((campaign) => (
              <div 
                key={campaign.id} 
                className="card" 
                style={{ 
                  padding: '1.5rem', 
                  position: 'relative', 
                  borderLeft: campaign.fulfilled ? '4px solid #10b981' : '4px solid #3b82f6',
                  opacity: campaign.fulfilled ? 0.75 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                {campaign.fulfilled && (
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    fontSize: '0.7rem',
                    fontWeight: '800',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    En cours de signature ✅
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-alt)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
                    📍 UDMS {campaign.targetDept}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                    Par {campaign.initiator}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-color)' }}>
                  {campaign.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.5', marginBottom: '1.25rem' }}>
                  {campaign.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-alt)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block' }}>Besoins d'enrôlement</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-color)' }}>{campaign.countNeeded} personnes</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)', display: 'block' }}>Financement annuel requis</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>
                      {new Intl.NumberFormat('fr-FR').format(campaign.annualCost)} FCFA
                    </strong>
                  </div>
                </div>

                {!campaign.fulfilled ? (
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => {
                      setShowPledgeModal(campaign);
                      // Pre-fill simulator count to match this campaign
                      setBeneficiariesCount(campaign.countNeeded);
                      setSelectedDept(campaign.targetDept);
                    }}
                    style={{ marginTop: '1rem', width: '100%', padding: '0.5rem' }}
                  >
                    🤝 Répondre à ce plaidoyer
                  </button>
                ) : (
                  <div style={{ color: '#10b981', fontSize: '0.8rem', fontWeight: '700', marginTop: '1rem', textAlign: 'center' }}>
                    Soutenu par un mécène RSE. Merci !
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Corporate Pledge History */}
        {pledges.length > 0 && (
          <section style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>
              📜 Vos engagements enregistrés ({pledges.length})
            </h2>
            <div className="card" style={{ padding: '0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-alt)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Entreprise</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '1rem', textAlign: 'left' }}>UDMS Cible</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Bénéficiaires</th>
                    <th style={{ padding: '1rem', textAlign: 'right' }}>Montant Annuel</th>
                    <th style={{ padding: '1rem', textAlign: 'center' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {pledges.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem', fontWeight: '700' }}>{p.companyName}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-sub)' }}>{p.advocacyTitle}</td>
                      <td style={{ padding: '1rem' }}>UDMS de {p.targetDept}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>{p.beneficiariesCount}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '700', color: 'var(--primary)' }}>
                        {new Intl.NumberFormat('fr-FR').format(p.amount)} FCFA
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.7rem', fontWeight: '700', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                          Validation en cours
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>

      {/* Modal for Answer Advocacy */}
      {showPledgeModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '90%', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', color: 'var(--text-color)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>🤝 Répondre au plaidoyer</h3>
              <button 
                onClick={() => setShowPledgeModal(null)} 
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-sub)' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ backgroundColor: 'var(--bg-alt)', padding: '1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
              <strong>Campagne :</strong> {showPledgeModal.title}<br />
              <strong>Cible :</strong> UDMS de {showPledgeModal.targetDept}<br />
              <strong>Montant annuel :</strong> {new Intl.NumberFormat('fr-FR').format(showPledgeModal.annualCost)} FCFA ({showPledgeModal.countNeeded} enfants)
            </div>

            <form onSubmit={handlePledgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Nom de votre entreprise *</label>
                <input 
                  className="input" 
                  required 
                  placeholder="Ex: Sonatel..." 
                  value={pledgeForm.companyName}
                  onChange={(e) => setPledgeForm({ ...pledgeForm, companyName: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Email Contact *</label>
                <input 
                  className="input" 
                  type="email" 
                  required 
                  placeholder="nom@entreprise.sn" 
                  value={pledgeForm.contactEmail}
                  onChange={(e) => setPledgeForm({ ...pledgeForm, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-sub)' }}>Téléphone</label>
                <input 
                  className="input" 
                  placeholder="+221..." 
                  value={pledgeForm.phone}
                  onChange={(e) => setPledgeForm({ ...pledgeForm, phone: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input 
                  type="checkbox" 
                  id="modal-agree"
                  required
                  checked={pledgeForm.agreed}
                  onChange={(e) => setPledgeForm({ ...pledgeForm, agreed: e.target.checked })}
                  style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                />
                <label htmlFor="modal-agree" style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                  Je confirme l'intérêt d'enrôler <strong>{showPledgeModal.countNeeded}</strong> bénéficiaires pour un montant de <strong>{new Intl.NumberFormat('fr-FR').format(showPledgeModal.annualCost)} FCFA</strong>.
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPledgeModal(null)} style={{ flex: 1 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>Confirmer le plaidoyer</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
