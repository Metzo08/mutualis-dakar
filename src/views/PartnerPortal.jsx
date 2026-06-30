import React, { useState, useEffect } from 'react';

// Espace partenaire pour les structures de soins conventionnées.
// Connexion dédiée (compte partenaire) → vérification carte CMU + déclaration tiers-payant + stats.
export default function PartnerPortal({ lang, setView, portalMode, agentUser }) {
  const [partner, setPartner] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Outils
  const [verifyNumber, setVerifyNumber] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Déclaration tiers-payant
  const [tpForm, setTpForm] = useState({ cmuNumber: '', beneficiaryName: '', careType: 'consultation', careDescription: '', amount: '' });
  const [tpResult, setTpResult] = useState(null);
  const [tpLoading, setTpLoading] = useState(false);

  // Stats
  const [stats, setStats] = useState(null);

  const isAgent = portalMode === 'agent' && agentUser;

  const [structures, setStructures] = useState([]);
  const [newStructure, setNewStructure] = useState({
    name: '',
    type: 'hopital',
    commune: '',
    phone: '',
    email: '',
    address: '',
    agreementNumber: '',
    coverageRate: 85
  });
  const [structureLoading, setStructureLoading] = useState(false);
  const [agentToast, setAgentToast] = useState('');

  const fetchStructures = () => {
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/partners/structures', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setStructures(data);
      })
      .catch((err) => console.error('Error fetching structures:', err));
  };

  useEffect(() => {
    if (isAgent) {
      fetchStructures();
    }
  }, [isAgent]);

  const handleCreateStructure = (e) => {
    e.preventDefault();
    if (!newStructure.name || !newStructure.agreementNumber || !newStructure.phone) {
      setAgentToast('Veuillez remplir les champs obligatoires.');
      return;
    }
    setStructureLoading(true);
    setAgentToast('');
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/partners/structures', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newStructure)
    })
      .then((res) => res.json())
      .then((data) => {
        setStructureLoading(false);
        if (data.success) {
          setAgentToast('Structure conventionnée créée avec succès !');
          setNewStructure({
            name: '',
            type: 'hopital',
            commune: '',
            phone: '',
            email: '',
            address: '',
            agreementNumber: '',
            coverageRate: 85
          });
          fetchStructures();
        } else {
          setAgentToast(data.error || 'Erreur lors de la création.');
        }
      })
      .catch(() => {
        setStructureLoading(false);
        setAgentToast('Erreur de connexion.');
      });
  };

  const t = lang === 'fr' ? {
    title: 'Espace partenaire structures de soins',
    subtitle: 'Portail dédié aux structures conventionnées — vérification CMU et tiers-payant',
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
    acte: 'Acte médical',
    statsTitle: 'Statistiques de ma structure',
    statsDeclarations: 'Déclarations totales',
    statsReimbursed: 'Total remboursé (FCFA)',
    statsByType: 'Par type de soin',
    statsRecent: 'Dernières déclarations',
    noStats: 'Aucune donnée pour le moment.'
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
    acte: 'Acte',
    statsTitle: 'Statistiques bu sama fajukaay',
    statsDeclarations: 'Déclaration yëpp',
    statsReimbursed: 'Ñu fay (FCFA)',
    statsByType: 'Ci anam faj',
    statsRecent: 'Déclaration yi gënë mujj',
    noStats: 'Amul data.'
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    fetch('http://localhost:5000/api/auth/partner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    })
      .then((res) => res.json())
      .then((data) => {
        setLoginLoading(false);
        if (data.success) {
          localStorage.setItem('cmu-partner-token', data.token);
          setPartner(data.partner);
          fetchStats(data.token);
        } else {
          setLoginError(data.error || 'Erreur');
        }
      })
      .catch(() => { setLoginLoading(false); setLoginError('Erreur de connexion'); });
  };

  const handleLogout = () => {
    localStorage.removeItem('cmu-partner-token');
    setPartner(null);
    setStats(null);
    setVerifyResult(null);
    setTpResult(null);
  };

  const fetchStats = (token) => {
    fetch('http://localhost:5000/api/partner/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {});
  };

  const verifyCard = (e) => {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyResult(null);
    fetch(`http://localhost:5000/api/partner/verify-card/${encodeURIComponent(verifyNumber)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('cmu-partner-token')}` }
    })
      .then((res) => res.json())
      .then((data) => { setVerifyResult(data); setVerifyLoading(false); })
      .catch(() => { setVerifyLoading(false); setVerifyResult({ error: 'Erreur' }); });
  };

  const declareTierPayant = (e) => {
    e.preventDefault();
    setTpLoading(true);
    setTpResult(null);
    fetch('http://localhost:5000/api/partner/tier-payant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('cmu-partner-token')}` },
      body: JSON.stringify(tpForm)
    })
      .then((res) => res.json())
      .then((data) => {
        setTpLoading(false);
        setTpResult(data);
        if (data.success) {
          setTpForm({ cmuNumber: '', beneficiaryName: '', careType: 'consultation', careDescription: '', amount: '' });
          fetchStats(localStorage.getItem('cmu-partner-token'));
        }
      })
      .catch(() => { setTpLoading(false); setTpResult({ error: 'Erreur' }); });
  };

  // ESPACE AGENT : GESTION DES PARTENAIRES CONVENTIONNÉS
  if (isAgent) {
    return (
      <div className="partner-portal fade-in-up">
        {/* Banner */}
        <section className="banner-mini" style={{
          background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_partner_hero.png") center/cover no-repeat',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          marginBottom: '2rem',
          color: '#fff',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center'
        }}>
          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>💼 {lang === 'fr' ? 'Gestion des structures partenaires' : 'Saytu kër gu conventionné'}</h1>
            <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              {lang === 'fr' 
                ? 'Enregistrez de nouvelles structures partenaires ou suivez les conventions de tiers-payant actives.' 
                : 'Mbind ak saytu kër gu conventionné yëpp ci région bi.'}
            </p>
          </div>
        </section>

        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1rem' }}>
          <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
            {/* Formulaire de création */}
            <div className="card text-left" style={{ padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '750', marginBottom: '1rem', color: 'var(--primary)' }}>
                🏥 {lang === 'fr' ? 'Conventionner une structure' : 'Mbind kër gu conventionné'}
              </h3>
              <form onSubmit={handleCreateStructure}>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Nom de la structure *' : 'Tour kër gu *'}</label>
                  <input className="input" required value={newStructure.name} onChange={(e) => setNewStructure({ ...newStructure, name: e.target.value })} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Type *' : 'Anam *'}</label>
                    <select className="input" value={newStructure.type} onChange={(e) => setNewStructure({ ...newStructure, type: e.target.value })}>
                      <option value="hopital">{lang === 'fr' ? 'Hôpital' : 'Hôpital'}</option>
                      <option value="clinique">{lang === 'fr' ? 'Clinique' : 'Clinique'}</option>
                      <option value="centre_de_sante">{lang === 'fr' ? 'Centre de santé' : 'Centre de santé'}</option>
                      <option value="poste_de_sante">{lang === 'fr' ? 'Poste de santé' : 'Poste de santé'}</option>
                      <option value="pharmacie">{lang === 'fr' ? 'Pharmacie' : 'Farmasi'}</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Taux de couverture (%) *' : 'Taux (%) *'}</label>
                    <input className="input" type="number" min="0" max="100" required value={newStructure.coverageRate} onChange={(e) => setNewStructure({ ...newStructure, coverageRate: parseInt(e.target.value) || 85 })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Commune *' : 'Commune *'}</label>
                    <input className="input" required placeholder="Ex: Grand Dakar" value={newStructure.commune} onChange={(e) => setNewStructure({ ...newStructure, commune: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'N° Agrément *' : 'N° Agrément *'}</label>
                    <input className="input" required placeholder="Ex: AGR-2026-DK" value={newStructure.agreementNumber} onChange={(e) => setNewStructure({ ...newStructure, agreementNumber: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Téléphone *' : 'Portable *'}</label>
                    <input className="input" required placeholder="77XXXXXXX" value={newStructure.phone} onChange={(e) => setNewStructure({ ...newStructure, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Email' : 'Email'}</label>
                    <input className="input" type="email" placeholder="contact@structure.sn" value={newStructure.email} onChange={(e) => setNewStructure({ ...newStructure, email: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{lang === 'fr' ? 'Adresse physique' : 'Adresse'}</label>
                  <input className="input" placeholder="Ex: Avenue Bourguiba" value={newStructure.address} onChange={(e) => setNewStructure({ ...newStructure, address: e.target.value })} />
                </div>
                {agentToast && <div style={{ 
                  padding: '0.75rem', 
                  borderRadius: '8px', 
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                  background: agentToast.includes('succès') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: agentToast.includes('succès') ? '#22c55e' : '#ef4444',
                  fontWeight: '600',
                  textAlign: 'left'
                }}>
                  {agentToast.includes('succès') ? '✅' : '❌'} {agentToast}
                </div>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={structureLoading}>
                  {structureLoading ? '...' : `✍️ ${lang === 'fr' ? 'Créer le partenaire' : 'Créer'}`}
                </button>
              </form>
            </div>

            {/* Liste des partenaires */}
            <div className="card" style={{ padding: '1.5rem', alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '750', marginBottom: '1rem', textAlign: 'left' }}>
                🤝 {lang === 'fr' ? 'Partenaires enregistrés' : 'Partenaire conventionné yi'}
              </h3>
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '0.25rem' }}>
                {structures.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '2rem' }}>
                    {lang === 'fr' ? 'Aucune structure partenaire conventionnée.' : 'Amul kër gu conventionné.'}
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>{lang === 'fr' ? 'Nom' : 'Tour'}</th>
                        <th style={{ padding: '0.5rem' }}>Type</th>
                        <th style={{ padding: '0.5rem' }}>Commune</th>
                        <th style={{ padding: '0.5rem' }}>Agrément</th>
                        <th style={{ padding: '0.5rem' }}>Taux</th>
                      </tr>
                    </thead>
                    <tbody>
                      {structures.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', textAlign: 'left' }}>{s.name}</td>
                          <td style={{ padding: '0.6rem 0.5rem', textTransform: 'capitalize', fontSize: '0.75rem', textAlign: 'left' }}>{s.type.replace(/_/g, ' ')}</td>
                          <td style={{ padding: '0.6rem 0.5rem', fontSize: '0.75rem', textAlign: 'left' }}>{s.commune}</td>
                          <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', textAlign: 'left' }}>{s.agreement_number}</td>
                          <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', color: 'var(--primary)', textAlign: 'left' }}>{s.coverage_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ÉCRAN DE CONNEXION
  if (!partner) {
    return (
      <div className="partner-portal fade-in-up">
        {/* Banner */}
        <section className="banner-mini" style={{
          background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_partner_hero.png") center/cover no-repeat',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          marginBottom: '2rem',
          color: '#fff',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center'
        }}>
          <div className="container" style={{ position: 'relative', zIndex: 2 }}>
            <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>🏥 {t.title}</h1>
            <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
          </div>
        </section>

        <div style={{ maxWidth: '450px', margin: '0 auto', padding: '0 1rem' }}>
          <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.username}</label>
              <input className="input" required value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.password}</label>
              <input className="input" type="password" required value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            {loginError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>❌ {loginError}</div>}
            <button type="submit" className="btn btn-primary" disabled={loginLoading} style={{ width: '100%' }}>
              {loginLoading ? '...' : `🔐 ${t.login}`}
            </button>
          </form>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>💡 {t.demo}</p>
        </div>
        </div>
      </div>
    );
  }

  // ESPACE PARTENAIRE CONNECTÉ
  return (
    <div className="partner-portal fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_partner_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>🏥 {partner.structureName}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{partner.contactName} · Tiers-payant {partner.coverageRate}%</p>
        </div>
      </section>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}>{t.logout}</button>
        </div>

      <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Vérification carte CMU */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🔍 {t.verifyTitle}</h3>
          <form onSubmit={verifyCard} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input className="input" placeholder={t.verifyPlaceholder} value={verifyNumber} onChange={(e) => setVerifyNumber(e.target.value)} style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={verifyLoading}>{verifyLoading ? '...' : t.verifyBtn}</button>
          </form>
          {verifyResult && !verifyResult.error && (
            <div style={{ padding: '1rem', borderRadius: '8px', background: verifyResult.valid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
              <div style={{ fontWeight: '700', color: verifyResult.valid ? '#22c55e' : '#ef4444', marginBottom: '0.5rem' }}>
                {verifyResult.valid ? `✅ ${t.valid}` : `⚠️ ${t.invalid}`}
              </div>
              {verifyResult.firstName && (
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>{verifyResult.firstName} {verifyResult.lastName}</strong><br />
                  {verifyResult.mutuelleName} · {verifyResult.packageType}<br />
                  {verifyResult.cotisationEnd && <span style={{ color: 'var(--text-muted)' }}>Cotisation valide jusqu'au {new Date(verifyResult.cotisationEnd).toLocaleDateString('fr-FR')}</span>}
                </div>
              )}
            </div>
          )}
          {verifyResult?.error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>❌ {verifyResult.error}</div>}
        </div>

        {/* Déclaration tiers-payant */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📋 {t.tpTitle}</h3>
          <form onSubmit={declareTierPayant}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>N° CMU</label>
                <input className="input" required value={tpForm.cmuNumber} onChange={(e) => setTpForm({ ...tpForm, cmuNumber: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>{t.tpBeneficiary}</label>
                <input className="input" required value={tpForm.beneficiaryName} onChange={(e) => setTpForm({ ...tpForm, beneficiaryName: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>{t.tpCareType}</label>
                <select className="input" value={tpForm.careType} onChange={(e) => setTpForm({ ...tpForm, careType: e.target.value })}>
                  <option value="consultation">{t.consultation}</option>
                  <option value="pharmacie">{t.pharmacie}</option>
                  <option value="hospitalisation">{t.hospitalisation}</option>
                  <option value="acte">{t.acte}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>{t.tpAmount}</label>
                <input className="input" type="number" required value={tpForm.amount} onChange={(e) => setTpForm({ ...tpForm, amount: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '600' }}>{t.tpDesc}</label>
              <textarea className="input" rows={2} value={tpForm.careDescription} onChange={(e) => setTpForm({ ...tpForm, careDescription: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={tpLoading} style={{ marginTop: '0.75rem' }}>
              {tpLoading ? '...' : `📋 ${t.tpSubmit}`}
            </button>
          </form>
          {tpResult && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '8px', background: tpResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', fontSize: '0.85rem' }}>
              {tpResult.success ? `✅ ${tpResult.message} (Remboursé : ${new Intl.NumberFormat('fr-FR').format(tpResult.reimbursedAmount)} FCFA)` : `❌ ${tpResult.error}`}
            </div>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📊 {t.statsTitle}</h3>
        {!stats ? (
          <p style={{ color: 'var(--text-muted)' }}>{t.noStats}</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)' }}>{stats.totalDeclarations}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.statsDeclarations}</div>
              </div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#14b8a6' }}>{new Intl.NumberFormat('fr-FR').format(stats.totalReimbursed)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.statsReimbursed}</div>
              </div>
            </div>
            {stats.byCareType && stats.byCareType.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem' }}>{t.statsByType}</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {stats.byCareType.map((c, i) => (
                    <span key={i} style={{ background: 'var(--bg-secondary)', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem' }}>
                      {c.care_type}: {c.count} ({new Intl.NumberFormat('fr-FR').format(c.total || 0)} FCFA)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
