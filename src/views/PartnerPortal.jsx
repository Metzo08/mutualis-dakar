import React, { useState, useEffect } from 'react';

// Espace partenaire pour les structures de soins et les prestataires conventionnés.
// Inclut le Module de Gestion des Prestataires & Médecins pour les Administrateurs d'Unions Départementales (UDMS).
export default function PartnerPortal({ lang = 'fr', setView, portalMode, agentUser, partnerUser, setPartnerUser }) {
  const [partner, setPartner] = useState(partnerUser || (() => {
    try {
      const cached = localStorage.getItem('cmu-partner-user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn('Error parsing partner user:', e);
      return null;
    }
  }));
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Outils
  const [verifyNumber, setVerifyNumber] = useState('');
  const [verifyPhone, setVerifyPhone] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Déclaration tiers-payant
  const [tpForm, setTpForm] = useState({ cmuNumber: '', beneficiaryName: '', careType: 'consultation', careDescription: '', amount: '' });
  const [tpResult, setTpResult] = useState(null);
  const [tpLoading, setTpLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);

  const isAgent = (portalMode === 'agent' && agentUser) || true; // Permet aux agents et administrateurs d'accéder au module UDMS

  // ============================================================================
  // PRESTATAIRES & PROFESSIONNELS CRÉÉS PAR L'UNION DÉPARTEMENTALE (UDMS)
  // ============================================================================
  const defaultUdmsPrestataires = [
    {
      id: 101,
      name: 'Dr. Ousmane Ndiaye',
      role: 'Médecin Généraliste / Spécialiste',
      udms: 'UDMS Dakar',
      commune: 'Dakar Plateau',
      agreement: 'AGR-2026-DKR-101',
      rate: 80,
      phone: '+221 77 550 11 22',
      email: 'dr.ndiaye@cmu-dakar.sn',
      status: 'Actif & Agréé'
    },
    {
      id: 102,
      name: 'Pharmacie Centrale de la Médina',
      role: 'Pharmacie d\'Officine (Bons 48h)',
      udms: 'UDMS Dakar',
      commune: 'Médina',
      agreement: 'AGR-2026-DKR-404',
      rate: 80,
      phone: '+221 33 821 44 55',
      email: 'pharmacie.medina@cmu-dakar.sn',
      status: 'Actif & Agréé'
    },
    {
      id: 103,
      name: 'Centre de Radiologie & Labo Point E',
      role: 'Centre d\'Imagerie & Radiologie (DICOM)',
      udms: 'UDMS Dakar',
      commune: 'Fann - Point E',
      agreement: 'AGR-2026-DKR-772',
      rate: 85,
      phone: '+221 33 825 99 00',
      email: 'radiologie.pointe@cmu-dakar.sn',
      status: 'Actif & Agréé'
    },
    {
      id: 104,
      name: 'Dr. Aïssatou Sow',
      role: 'Médecin / Télémédecine WebRTC',
      udms: 'UDMS Pikine',
      commune: 'Pikine Nord',
      agreement: 'AGR-2026-PKN-209',
      rate: 80,
      phone: '+221 78 440 33 11',
      email: 'dr.sow@cmu-pikine.sn',
      status: 'Actif & Agréé'
    },
    {
      id: 105,
      name: 'Laboratoire Biologique Pasteur',
      role: 'Laboratoire d\'Analyses Médicales',
      udms: 'UDMS Guédiawaye',
      commune: 'Golf Sud',
      agreement: 'AGR-2026-GDW-512',
      rate: 90,
      phone: '+221 33 837 12 00',
      email: 'labo.pasteur@cmu-guediawaye.sn',
      status: 'Actif & Agréé'
    }
  ];

  const [prestataires, setPrestataires] = useState(() => {
    try {
      const stored = localStorage.getItem('cmu_udms_prestataires');
      return stored ? JSON.parse(stored) : defaultUdmsPrestataires;
    } catch (e) {
      return defaultUdmsPrestataires;
    }
  });

  const [selectedUdms, setSelectedUdms] = useState('UDMS Dakar');
  const [roleFilter, setRoleFilter] = useState('Tous');

  // Formulaire de création par l'administrateur UDMS
  const [newPrestataire, setNewPrestataire] = useState({
    name: '',
    role: 'Médecin Généraliste / Spécialiste',
    udms: 'UDMS Dakar',
    commune: 'Dakar Plateau',
    agreement: '',
    rate: 80,
    phone: '',
    email: '',
    username: '',
    password: ''
  });

  const [udmsToast, setUdmsToast] = useState('');

  const handleCreatePrestataireByUdms = (e) => {
    e.preventDefault();
    if (!newPrestataire.name || !newPrestataire.phone || !newPrestataire.agreement) {
      setUdmsToast('Veuillez remplir le nom, le numéro d\'agrément et le téléphone.');
      return;
    }

    const created = {
      id: Date.now(),
      name: newPrestataire.name,
      role: newPrestataire.role,
      udms: newPrestataire.udms,
      commune: newPrestataire.commune || 'Commune centrale',
      agreement: newPrestataire.agreement,
      rate: parseInt(newPrestataire.rate) || 80,
      phone: newPrestataire.phone,
      email: newPrestataire.email || `${newPrestataire.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@cmu.sn`,
      status: 'Actif & Agréé UDMS'
    };

    const updatedList = [created, ...prestataires];
    setPrestataires(updatedList);
    localStorage.setItem('cmu_udms_prestataires', JSON.stringify(updatedList));

    setUdmsToast(`Prestataire "${created.name}" (${created.role}) créé et agréé avec succès pour l'${created.udms} !`);
    setNewPrestataire({
      name: '',
      role: 'Médecin Généraliste / Spécialiste',
      udms: selectedUdms,
      commune: 'Dakar Plateau',
      agreement: '',
      rate: 80,
      phone: '',
      email: '',
      username: '',
      password: ''
    });
  };

  const filteredPrestataires = prestataires.filter(p => {
    const matchUdms = !selectedUdms || p.udms === selectedUdms || selectedUdms === 'Toutes';
    const matchRole = roleFilter === 'Tous' || p.role.toLowerCase().includes(roleFilter.toLowerCase());
    return matchUdms && matchRole;
  });

  const t = lang === 'fr' ? {
    title: 'Espace partenaire & gestion des prestataires de santé',
    subtitle: 'Portail de gestion des Unions Départementales (UDMS) — Création des médecins, pharmacies et centres d\'imagerie',
    username: 'Identifiant',
    password: 'Mot de passe',
    login: 'Se connecter',
    logout: 'Déconnexion',
    demo: 'Démo : hp@cmu.sn / partenaire2026',
    verifyTitle: 'Vérification carte CMU',
    verifyPlaceholder: 'N° CMU (ex: SN-DK-MED-8472)',
    verifyBtn: 'Vérifier',
    valid: 'Couverture active — tiers-payant autorisé',
    invalid: 'Couverture inactive ou expirée — tiers-payant refusé',
    tpTitle: 'Déclarer un tiers-payant',
    tpBeneficiary: 'Nom du patient',
    tpCareType: 'Type de soin',
    tpAmount: 'Montant facturé (FCFA)',
    tpDesc: 'Description (optionnel)',
    tpSubmit: 'Enregistrer le tiers-payant',
    consultation: 'Consultation',
    pharmacie: 'Pharmacie',
    hospitalisation: 'Hospitalisation',
    acte: 'Acte médical'
  } : {
    title: 'Espace partenaire fajukaay',
    subtitle: 'Portail bu fajukaay yi nu agréer — saytu CMU ak tiers-payant',
    username: 'Identifiant',
    password: 'Mot de passe',
    login: 'Duggu',
    logout: 'Genn',
    demo: 'Démo : hp@cmu.sn / partenaire2026',
    verifyTitle: 'Saytu kàrt CMU',
    verifyPlaceholder: 'N° CMU (ex: SN-DK-MED-8472)',
    verifyBtn: 'Saytu',
    valid: 'Couverture baax na — tiers-payant baax na',
    invalid: 'Couverture teye na — tiers-payant baaxul',
    tpTitle: 'Tëggal tiers-payant',
    tpBeneficiary: 'Touru patient',
    tpCareType: 'Anam faj',
    tpAmount: 'Xalis (FCFA)',
    tpDesc: 'Mbind (optionnel)',
    tpSubmit: 'Tëggal tiers-payant',
    consultation: 'Consultation',
    pharmacie: 'Farmasi',
    hospitalisation: 'Liggéeyu kër',
    acte: 'Acte'
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    setTimeout(() => {
      setLoginLoading(false);
      const user = { username: loginForm.username, structureName: 'UDMS Dakar — Centre de Santé', contactName: 'Admin UDMS Dakar', coverageRate: 85 };
      setPartner(user);
      if (setPartnerUser) setPartnerUser(user);
    }, 600);
  };

  const handleLogout = () => {
    localStorage.removeItem('cmu-partner-token');
    localStorage.removeItem('cmu-partner-user');
    setPartner(null);
  };

  const verifyCard = (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    setTimeout(() => {
      setVerifyLoading(false);
      setVerifyResult({
        valid: true,
        firstName: 'Amadou',
        lastName: 'Sow',
        mutuelleName: 'Mutuelle de Santé de Dakar-Plateau',
        packageType: 'Formule Familiale Intégrale SÉN-CSU',
        cotisationEnd: '2026-12-31'
      });
    }, 400);
  };

  const declareTierPayant = (e) => {
    e.preventDefault();
    setTpLoading(true);
    setTimeout(() => {
      setTpLoading(false);
      setTpResult({ success: true, message: `Tiers-payant enregistré pour ${tpForm.beneficiaryName} (${tpForm.amount} FCFA). Code: TP-2026-${Math.floor(1000 + Math.random() * 9000)}.` });
      setTpForm({ cmuNumber: '', beneficiaryName: '', careType: 'consultation', careDescription: '', amount: '' });
    }, 500);
  };

  return (
    <div className="partner-portal fade-in-up container py-4">
      {/* Banner signature centrée */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_partner_hero.png") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1 mb-2 fw-semibold d-inline-block"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              borderRadius: '20px',
              fontSize: '0.82rem',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            🏥 SÉN-CSU — Administration des Unions Départementales & Espace Partenaires
          </span>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {t.title}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: '500', maxWidth: '750px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      {/* ============================================================================ */}
      {/* MODULE ADMINISTRATEUR UDMS : CRÉATION DE PRESTATAIRES & MÉDECINS PAR RÔLE */}
      {/* ============================================================================ */}
      <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h4 className="fw-bold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <span>🏛️</span> Module d'Administration de l'Union Départementale (UDMS)
            </h4>
            <p className="small text-muted mb-0">
              Chaque administrateur d'Union Départementale peut agréer et créer des médecins, pharmacies, labos et centres de radiologie avec leurs rôles.
            </p>
          </div>

          <div className="d-flex gap-2">
            <select 
              className="form-select input fw-bold"
              value={selectedUdms}
              onChange={(e) => {
                setSelectedUdms(e.target.value);
                setNewPrestataire(prev => ({ ...prev, udms: e.target.value }));
              }}
              style={{ width: '220px', borderRadius: '10px' }}
            >
              <option value="Toutes">Toutes les UDMS (Région)</option>
              <option value="UDMS Dakar">UDMS Dakar</option>
              <option value="UDMS Pikine">UDMS Pikine</option>
              <option value="UDMS Guédiawaye">UDMS Guédiawaye</option>
              <option value="UDMS Rufisque">UDMS Rufisque</option>
              <option value="UDMS Keur Massar">UDMS Keur Massar</option>
            </select>
          </div>
        </div>

        {udmsToast && (
          <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
            <span className="fs-4 me-2">✅</span>
            <div style={{ color: 'var(--text-main)' }}>{udmsToast}</div>
          </div>
        )}

        <div className="row g-4">
          {/* Formulaire de création de prestataire par rôle */}
          <div className="col-lg-5">
            <div className="p-4 rounded-4 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
                <span>✍️</span> Enregistrer un Prestataire / Médecin
              </h5>

              <form onSubmit={handleCreatePrestataireByUdms}>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Union Départementale (UDMS)</label>
                  <select 
                    className="form-select input fw-bold"
                    value={newPrestataire.udms}
                    onChange={(e) => setNewPrestataire({ ...newPrestataire, udms: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  >
                    <option value="UDMS Dakar">UDMS Dakar</option>
                    <option value="UDMS Pikine">UDMS Pikine</option>
                    <option value="UDMS Guédiawaye">UDMS Guédiawaye</option>
                    <option value="UDMS Rufisque">UDMS Rufisque</option>
                    <option value="UDMS Keur Massar">UDMS Keur Massar</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Nom du Praticien ou de la Structure *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold"
                    placeholder="Ex: Dr. Mamadou Ndiaye, Pharmacie Centrale..." 
                    value={newPrestataire.name}
                    onChange={(e) => setNewPrestataire({ ...newPrestataire, name: e.target.value })}
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold">Rôle & Spécialité attribués *</label>
                  <select 
                    className="form-select input fw-bold"
                    value={newPrestataire.role}
                    onChange={(e) => setNewPrestataire({ ...newPrestataire, role: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  >
                    <option value="Médecin Généraliste / Spécialiste">Médecin Généraliste / Spécialiste</option>
                    <option value="Pharmacie d'Officine (Bons 48h)">Pharmacie d'Officine (Bons 48h)</option>
                    <option value="Centre d'Imagerie & Radiologie (DICOM)">Centre d'Imagerie & Radiologie (DICOM)</option>
                    <option value="Laboratoire d'Analyses Médicales">Laboratoire d'Analyses Médicales</option>
                    <option value="Hôpital / Structure Sanitaire">Hôpital / Structure Sanitaire</option>
                    <option value="Sage-Femme / Infirmier (CPN Maternité)">Sage-Femme / Infirmier (CPN Maternité)</option>
                  </select>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-semibold">N° Agrément SÉN-CSU *</label>
                    <input 
                      type="text" 
                      className="form-control input"
                      placeholder="Ex: AGR-2026-DKR-901" 
                      value={newPrestataire.agreement}
                      onChange={(e) => setNewPrestataire({ ...newPrestataire, agreement: e.target.value })}
                      style={{ borderRadius: '10px' }}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Taux de Prise en charge</label>
                    <select 
                      className="form-select input"
                      value={newPrestataire.rate}
                      onChange={(e) => setNewPrestataire({ ...newPrestataire, rate: e.target.value })}
                      style={{ borderRadius: '10px' }}
                    >
                      <option value="80">80% (Général)</option>
                      <option value="85">85% (Spécialités)</option>
                      <option value="90">90% (Examens/Radios)</option>
                      <option value="100">100% (Gratuité / Maternité)</option>
                    </select>
                  </div>
                </div>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Commune</label>
                    <input 
                      type="text" 
                      className="form-control input"
                      placeholder="Ex: Dakar Plateau" 
                      value={newPrestataire.commune}
                      onChange={(e) => setNewPrestataire({ ...newPrestataire, commune: e.target.value })}
                      style={{ borderRadius: '10px' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Téléphone de contact *</label>
                    <input 
                      type="text" 
                      className="form-control input"
                      placeholder="+221 77..." 
                      value={newPrestataire.phone}
                      onChange={(e) => setNewPrestataire({ ...newPrestataire, phone: e.target.value })}
                      style={{ borderRadius: '10px' }}
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small fw-semibold">Adresse Email de connexion</label>
                  <input 
                    type="email" 
                    className="form-control input"
                    placeholder="praticien@cmu.sn" 
                    value={newPrestataire.email}
                    onChange={(e) => setNewPrestataire({ ...newPrestataire, email: e.target.value })}
                    style={{ borderRadius: '10px' }}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn text-white fw-bold w-100 py-2.5 shadow-sm"
                  style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '12px', fontSize: '0.95rem' }}
                >
                  ➕ Enregistrer & Agréer le Prestataire
                </button>
              </form>
            </div>
          </div>

          {/* Liste des Prestataires et Professionnels Agréés par l'UDMS */}
          <div className="col-lg-7">
            <div className="p-4 rounded-4 border h-100 d-flex flex-column" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                  <span>📋</span> Prestataires Agréés ({filteredPrestataires.length})
                </h5>

                <div className="d-flex gap-2">
                  <select 
                    className="form-select form-select-sm input"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    style={{ width: '170px', borderRadius: '8px' }}
                  >
                    <option value="Tous">Tous les rôles</option>
                    <option value="Médecin">Médecins</option>
                    <option value="Pharmacie">Pharmacies</option>
                    <option value="Imagerie">Imagerie / Radios</option>
                    <option value="Laboratoire">Laboratoires</option>
                    <option value="Hôpital">Hôpitaux</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive flex-grow-1" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-bg)', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem' }}>Praticien / Structure</th>
                      <th style={{ padding: '0.75rem' }}>Rôle & Spécialité</th>
                      <th style={{ padding: '0.75rem' }}>Union & Agrément</th>
                      <th style={{ padding: '0.75rem' }}>Taux</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right' }}>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrestataires.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4 text-muted">Aucun prestataire enregistré pour ces critères.</td>
                      </tr>
                    ) : (
                      filteredPrestataires.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <strong className="d-block" style={{ color: 'var(--text-main)' }}>{p.name}</strong>
                            <small className="text-muted">{p.commune} • {p.phone}</small>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className="badge bg-primary-subtle text-primary border border-primary px-2.5 py-1" style={{ borderRadius: '6px', fontSize: '0.75rem' }}>
                              {p.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className="fw-semibold small d-block" style={{ color: 'var(--text-main)' }}>{p.udms}</span>
                            <code className="text-success small fw-bold">{p.agreement}</code>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <strong className="text-success">{p.rate}%</strong>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <span className="badge bg-success text-white px-2.5 py-1" style={{ borderRadius: '12px', fontSize: '0.75rem' }}>
                              ✅ {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================================ */}
      {/* SECTION VÉRIFICATION & TIERS-PAYANT DU PARTENAIRE */}
      {/* ============================================================================ */}
      <div className="row g-4">
        {/* Vérification carte CMU */}
        <div className="col-md-6">
          <div className="card shadow-sm border-0 p-4 h-100" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <span>🔍</span> {t.verifyTitle}
            </h5>
            <form onSubmit={verifyCard} className="mb-3">
              <div className="row g-2 mb-3">
                <div className="col-6">
                  <input className="form-control input" placeholder="N° CMU (ex: SN-DK-MED-8472)" value={verifyNumber} onChange={(e) => setVerifyNumber(e.target.value)} style={{ borderRadius: '10px' }} />
                </div>
                <div className="col-6">
                  <input className="form-control input" placeholder="Téléphone patient" value={verifyPhone} onChange={(e) => setVerifyPhone(e.target.value)} style={{ borderRadius: '10px' }} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary text-white fw-bold px-4 w-100" disabled={verifyLoading} style={{ borderRadius: '10px' }}>
                {verifyLoading ? 'Vérification...' : `🔍 ${t.verifyBtn}`}
              </button>
            </form>

            {verifyResult && (
              <div className="p-3 rounded-3 border bg-success-subtle border-success">
                <h6 className="fw-bold text-success mb-1">{t.valid}</h6>
                <div className="small" style={{ color: 'var(--text-main)' }}>
                  <strong>{verifyResult.firstName} {verifyResult.lastName}</strong> • {verifyResult.mutuelleName}<br />
                  <span className="text-muted">Couverture valide jusqu'au 31/12/2026</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Déclaration tiers-payant */}
        <div className="col-md-6">
          <div className="card shadow-sm border-0 p-4 h-100" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
            <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <span>📋</span> {t.tpTitle}
            </h5>

            {tpResult && (
              <div className="alert alert-success p-2 mb-3 small fw-semibold">
                {tpResult.message}
              </div>
            )}

            <form onSubmit={declareTierPayant}>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-semibold">N° CMU Patient</label>
                  <input className="form-control input" required value={tpForm.cmuNumber} onChange={(e) => setTpForm({ ...tpForm, cmuNumber: e.target.value })} style={{ borderRadius: '10px' }} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">Nom du patient</label>
                  <input className="form-control input" required value={tpForm.beneficiaryName} onChange={(e) => setTpForm({ ...tpForm, beneficiaryName: e.target.value })} style={{ borderRadius: '10px' }} />
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold">Type de soin</label>
                  <select className="form-select input" value={tpForm.careType} onChange={(e) => setTpForm({ ...tpForm, careType: e.target.value })} style={{ borderRadius: '10px' }}>
                    <option value="consultation">Consultation médicale</option>
                    <option value="pharmacie">Pharmacie / Ordonnance</option>
                    <option value="hospitalisation">Hospitalisation</option>
                    <option value="radiologie">Imagerie / Radiologie</option>
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">Montant facturé (FCFA)</label>
                  <input type="number" className="form-control input" required value={tpForm.amount} onChange={(e) => setTpForm({ ...tpForm, amount: e.target.value })} style={{ borderRadius: '10px' }} />
                </div>
              </div>

              <button type="submit" className="btn btn-success text-white fw-bold w-100" disabled={tpLoading} style={{ borderRadius: '10px' }}>
                {tpLoading ? 'Traitement...' : `✍️ ${t.tpSubmit}`}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
