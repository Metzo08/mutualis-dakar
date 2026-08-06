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
  const isAuthenticated = !!partner || (portalMode === 'superadmin') || (portalMode === 'agent' && !!agentUser) || portalMode === 'doctor' || portalMode === 'midwife' || portalMode === 'pharmacist' || portalMode === 'partner';
  
  // Seuls les Agents UDMS et le SuperAdmin (non connectés comme médecins/hôpitaux partenaires) peuvent administrer
  const isSuperAdmin = portalMode === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isUdmsAgentOrAdmin = (isSuperAdmin || (portalMode === 'agent' && !!agentUser) || agentUser?.role === 'Agent Instructeur') && !partner && portalMode !== 'doctor' && portalMode !== 'partner' && portalMode !== 'midwife' && portalMode !== 'pharmacist';
  
  // Le prestataire / médecin (ex: Centre Hospitalier Abass Ndao) accède EXCLUSIVEMENT en lecteur aux informations qui le concernent
  const isPartner = !isUdmsAgentOrAdmin && (!!partner || portalMode === 'doctor' || portalMode === 'midwife' || portalMode === 'pharmacist' || portalMode === 'partner');

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
      agreement: 'AGR-2026-PKN-088',
      rate: 80,
      phone: '+221 78 221 99 88',
      email: 'dr.sow@cmu-pikine.sn',
      status: 'Actif & Agréé'
    }
  ];

  const [prestataires, setPrestataires] = useState(() => {
    try {
      const saved = localStorage.getItem('cmu_udms_prestataires');
      return saved ? JSON.parse(saved) : defaultUdmsPrestataires;
    } catch (e) {
      return defaultUdmsPrestataires;
    }
  });

  const [selectedUdms, setSelectedUdms] = useState('UDMS Dakar');
  const [roleFilter, setRoleFilter] = useState('Tous');

  // Nouveau prestataire par l'UDMS
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
    title: 'Espace prestataire & gestion des praticiens de santé',
    subtitle: 'Portail de gestion des Unions Départementales (UDMS) — Création des médecins, pharmacies et centres d\'imagerie',
    username: 'Identifiant',
    password: 'Mot de passe',
    login: 'Se connecter',
    logout: 'Déconnexion',
    demo: 'Démo : partenaire@unamusc.sn / partenaire2026',
    verifyTitle: 'Vérifier l\'éligibilité d\'un assuré',
    verifyPlaceholder: 'N° CMU (ex: SN-DK-MED-8472)',
    verifyBtn: 'Vérifier',
    valid: 'Couverture active — Tiers-payant autorisé (80%)',
    invalid: 'Couverture inactive — Tiers-payant non autorisé',
    tpTitle: 'Déclarer un acte Tiers-Payant',
    tpBeneficiary: 'Nom du patient',
    tpCareType: 'Type de soin',
    tpAmount: 'Montant facturé (FCFA)',
    tpDesc: 'Description de l\'acte',
    tpSubmit: 'Valider la prise en charge Tiers-Payant',
    consultation: 'Consultation',
    pharmacie: 'Pharmacie',
    hospitalisation: 'Hospitalisation',
    acte: 'Acte technique'
  } : {
    title: 'Péku partenaire ak fajukaay yi',
    subtitle: 'Portail UDMS — Saytu docteur, farmasi ak imagerie',
    username: 'Identifiant',
    password: 'Mot de passe',
    login: 'Duggu',
    logout: 'Genn',
    demo: 'Démo : partenaire@unamusc.sn / partenaire2026',
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
      // Le prestataire est un PRESTATAIRE (pas un agent) — son espace lui est propre.
      const user = {
        username: loginForm.username || 'partenaire@unamusc.sn',
        structureName: 'Centre de Santé Conventionné UNAMUSC',
        contactName: loginForm.username || 'Praticien agréé',
        coverageRate: 80,
        isPartner: true,      // prestataire de soins
        role: 'Prestataire de santé',
        grantedBy: 'SuperAdmin DSI UNAMUSC'
      };
      setPartner(user);
      localStorage.setItem('cmu-partner-user', JSON.stringify(user));
      localStorage.setItem('cmu-partner-token', 'demo-token-2026');
      if (setPartnerUser) setPartnerUser(user);
    }, 600);
  };

  const handleLogout = () => {
    localStorage.removeItem('cmu-partner-token');
    localStorage.removeItem('cmu-partner-user');
    setPartner(null);
    if (setPartnerUser) setPartnerUser(null);
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
        packageType: 'Formule Familiale Intégrale UNAMUSC',
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
        className="banner-mini text-white mb-5 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.35) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_partner_hero.png") center/cover no-repeat',
          padding: '3.75rem 2.5rem',
          minHeight: '240px',
          borderRadius: '24px',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          marginBottom: '3.5rem'
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
            🏥 UNAMUSC — Administration des unions départementales & espace partenaires
          </span>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {t.title}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: '500', maxWidth: '750px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      {!isAuthenticated ? (
        <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* GRANDE SECTION SPLIT EN 2 COLONNES (Présentation + Connexion) */}
          <div className="row g-4 g-xl-5 align-items-stretch">
            {/* Colonne Gauche : Présentation du Portail Prestataires UNAMUSC */}
            <div className="col-xl-7 col-lg-6">
              <div className="card shadow-lg border-0 p-4 p-md-5 h-100 rounded-4 text-left d-flex flex-column justify-content-between" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderTop: '6px solid #059669', padding: '3rem 2.5rem' }}>
                <div>
                  <span className="badge bg-success-subtle text-success border border-success px-3.5 py-2 fw-bold mb-4 d-inline-block" style={{ borderRadius: '20px', fontSize: '0.85rem' }}>
                    🏥 PORTAIL OFFICIEL DES STRUCTURES DE SANTÉ CONVENTIONNÉES
                  </span>
                  
                  <h2 className="fw-extrabold mb-3.5" style={{ color: 'var(--primary)', fontSize: '2rem', lineHeight: '1.3', letterSpacing: '-0.01em' }}>
                    Espace prestataires de santé & administration UDMS 🇸🇳
                  </h2>
                  
                  <p className="text-muted mb-4" style={{ lineHeight: '1.7', fontSize: '1.02rem', opacity: 0.9 }}>
                    Cet espace est réservé aux hôpitaux publics, cliniques privées, officines de pharmacie, centres d'imagerie et praticiens médicaux agréés par l'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC).
                  </p>

                  <div className="d-flex flex-column gap-3.5 mb-4">
                    <div className="d-flex gap-3.5 align-items-start p-3.5 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '1.85rem', color: '#059669', minWidth: '40px' }}>💳</div>
                      <div>
                        <h5 className="fw-bold mb-1.5" style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>Télétransmission & Tiers-Payant (80% à 100%)</h5>
                        <p className="text-muted mb-0" style={{ fontSize: '0.88rem', lineHeight: '1.55' }}>Validation en temps réel des cartes CMU et remboursement sous 72h des bordereaux d'actes médicaux.</p>
                      </div>
                    </div>

                    <div className="d-flex gap-3.5 align-items-start p-3.5 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '1.85rem', color: '#059669', minWidth: '40px' }}>🏛️</div>
                      <div>
                        <h5 className="fw-bold mb-1.5" style={{ color: 'var(--primary)', fontSize: '1.05rem' }}>Habilitation des Unions Départementales (UDMS)</h5>
                        <p className="text-muted mb-0" style={{ fontSize: '0.88rem', lineHeight: '1.55' }}>Gestion du conventionnement local des médecins, des tarifs réglementés et du contrôle médical.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comptes Démo Rapides */}
                <div className="p-4 rounded-4 border mt-4" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                  <span className="small text-muted fw-bold d-block mb-3 text-uppercase" style={{ fontSize: '0.8rem', letterSpacing: '0.5px' }}>
                    💡 COMPTES DÉMO PRÉ-REMPLIS (CLIQUEZ POUR TESTER INSTANTANÉMENT) :
                  </span>
                  <div className="d-flex flex-wrap gap-2.5">
                    <button 
                      type="button" 
                      className="btn btn-outline-success fw-bold px-3 py-2"
                      style={{ fontSize: '0.82rem', borderRadius: '10px' }}
                      onClick={() => setLoginForm({ username: 'AGR-2026-DKR-101', password: 'partenaire2026' })}
                    >
                      🩺 Dr. Ousmane Ndiaye (AGR-2026-DKR-101)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-success fw-bold px-3 py-2"
                      style={{ fontSize: '0.82rem', borderRadius: '10px' }}
                      onClick={() => setLoginForm({ username: 'AGR-2026-DKR-404', password: 'partenaire2026' })}
                    >
                      💊 Pharmacie de la Médina (AGR-2026-DKR-404)
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-success fw-bold px-3 py-2"
                      style={{ fontSize: '0.82rem', borderRadius: '10px' }}
                      onClick={() => setLoginForm({ username: 'partenaire@unamusc.sn', password: 'partenaire2026' })}
                    >
                      🏛️ UDMS Dakar (partenaire@unamusc.sn)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Colonne Droite : Formulaire de Connexion SÉCURISÉ */}
            <div className="col-xl-5 col-lg-6">
              <div className="card shadow-lg border-0 p-4 p-md-5 h-100 rounded-4 text-left d-flex flex-column justify-content-center" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '3rem 2.5rem' }}>
                <div className="text-center mb-4 pb-2">
                  <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto 1.25rem', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)' }}>
                    🔐
                  </div>
                  <h3 className="fw-bold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.5rem' }}>Connexion espace prestataires</h3>
                  <p className="small text-muted mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>Accès réservé aux praticiens de santé agréés et administrateurs d'Unions Départementales (UDMS).</p>
                </div>

                {loginError && <div className="alert alert-danger py-2.5 px-3 small mb-4 rounded-3 fw-bold">{loginError}</div>}

                <form onSubmit={handleLogin}>
                  <div className="mb-4">
                    <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Identifiant / Code agrément *</label>
                    <input 
                      type="text" 
                      className="form-control fw-bold fs-6" 
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', height: '54px', padding: '0.85rem 1.25rem' }} 
                      placeholder="Ex: AGR-2026-DKR-101 ou partenaire@unamusc.sn" 
                      value={loginForm.username} 
                      onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} 
                      required 
                    />
                  </div>

                  <div className="mb-4 pb-2">
                    <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Mot de passe *</label>
                    <input 
                      type="password" 
                      className="form-control fw-bold fs-6" 
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', height: '54px', padding: '0.85rem 1.25rem' }} 
                      placeholder="••••••••" 
                      value={loginForm.password} 
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} 
                      required 
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-success fw-bold w-100 py-3 text-white shadow-md" 
                    disabled={loginLoading}
                    style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', fontSize: '1.05rem', height: '56px', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)' }}
                  >
                    {loginLoading ? 'Vérification...' : '🔑 Se connecter au portail prestataire'}
                  </button>
                </form>

                <div className="mt-4 pt-4 border-top text-center" style={{ borderColor: 'var(--border-color)' }}>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>
                    Besoin d'un agrément UDMS ? Contactez l'Union Nationale au <strong className="text-success">+221 77 602 67 83</strong>.
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* GRILLE DES 4 GRANDS AXES PRESTATAIRES */}
          <div className="grid grid-4" style={{ gap: '1.5rem' }}>
            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>🏥</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Hôpitaux & cliniques</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Prise en charge directe des lettres de garantie (80%) et télé-admission des urgences médicales.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>💊</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Officines de pharmacie</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Saisie des bons de commande pharmacie (50%) et remboursement direct du Tiers-Payant.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>🩻</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Imagerie & laboratoires</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Télétransmission des clichés radiologiques DICOM HD et des comptes-rendus d'examens biologiques.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '16px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>🏛️</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Unions départementales</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Agrément local des praticiens, enregistrement des conventions régionales et audits de réclamations.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* User Status Bar with Logout */}
          <div className="d-flex justify-content-between align-items-center mb-4 p-3 rounded-4" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-success text-white p-2" style={{ borderRadius: '10px' }}>⚡ Connecté</span>
              <div>
                <strong className="d-block" style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>
                  {partner?.structureName || agentUser?.firstName + ' ' + agentUser?.lastName || 'Prestataire Agréé UNAMUSC'}
                </strong>
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>Identifiant : {partner?.username || agentUser?.email || 'hp@cmu.sn'}</small>
              </div>
            </div>
            <button 
              type="button" 
              className="btn btn-sm btn-outline-danger fw-bold" 
              style={{ borderRadius: '10px', padding: '0.4rem 0.9rem' }}
              onClick={handleLogout}
            >
              🚪 Déconnexion
            </button>
          </div>

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
              {/* Formulaire de création réservé EXCLUSIVEMENT aux AGENTS UDMS et SUPERADMIN */}
              {isUdmsAgentOrAdmin ? (
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
                          <label className="form-label small fw-semibold">N° Agrément UNAMUSC *</label>
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
              ) : (
                <div className="col-12 mb-2">
                  <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)', borderLeft: '6px solid var(--primary)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div>
                        <span className="badge bg-primary-subtle text-primary border border-primary px-3 py-1 fw-bold mb-2 d-inline-block" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
                          🔒 ACCÈS PRATICIEN & STRUCTURE SANTÉ (MODE LECTEUR SEUL)
                        </span>
                        <h4 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.35rem' }}>
                          Convention & Agrément UNAMUSC — {partner?.structureName || 'Centre Hospitalier Abass Ndao'}
                        </h4>
                        <p className="small text-muted mb-0">
                          Renseignements officiels de conventionnement de votre structure avec l'Union Départementale (UDMS Dakar). Seuls les Agents UDMS et le SuperAdmin modifient les agréments.
                        </p>
                      </div>
                      <span className="badge bg-success text-white px-3 py-2 fw-bold" style={{ borderRadius: '12px', fontSize: '0.88rem' }}>
                        ✅ Structure Agréée UNAMUSC
                      </span>
                    </div>

                    <div className="row g-3 my-1">
                      <div className="col-md-3 col-6">
                        <div className="p-3 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                          <small className="text-muted fw-semibold d-block">Structure Sanitaire</small>
                          <strong className="text-primary d-block mt-1">{partner?.structureName || 'Centre Hospitalier Abass Ndao'}</strong>
                          <small className="text-sub">{partner?.name || 'Dr. Cheikh Anta Diop'}</small>
                        </div>
                      </div>
                      <div className="col-md-3 col-6">
                        <div className="p-3 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                          <small className="text-muted fw-semibold d-block">Code Agrément Officiel</small>
                          <code className="text-success fw-bold d-block mt-1 fs-6">{partner?.cnom || 'AGR-2026-DKR-101'}</code>
                          <small className="text-sub">UDMS : UDMS Dakar</small>
                        </div>
                      </div>
                      <div className="col-md-3 col-6">
                        <div className="p-3 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                          <small className="text-muted fw-semibold d-block">Taux Tiers-Payant Accordé</small>
                          <strong className="text-success d-block mt-1 fs-5">80% à 100%</strong>
                          <small className="text-sub">Remboursement direct 72h</small>
                        </div>
                      </div>
                      <div className="col-md-3 col-6">
                        <div className="p-3 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
                          <small className="text-muted fw-semibold d-block">Rôle d'Accès Système</small>
                          <span className="badge bg-secondary-subtle text-secondary fw-bold mt-1 d-inline-block px-2.5 py-1" style={{ borderRadius: '6px' }}>
                            👁️ Lecteur Seul (Praticien)
                          </span>
                          <small className="text-muted d-block mt-1">Modifications réservées à UDMS</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Liste des Prestataires et Professionnels Agréés par l'UDMS */}
              <div className={isUdmsAgentOrAdmin ? "col-lg-7" : "col-12"}>
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
        </>
      )}
    </div>
  );
}
