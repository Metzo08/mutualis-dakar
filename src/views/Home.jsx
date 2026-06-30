import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function Home({ lang, setView, setViewTab, portalMode, setPortalMode, citizenUser, setCitizenUser }) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (citizenUser) {
      QRCode.toDataURL(citizenUser.cmuNumber || citizenUser.phone || 'MUTUALIS', {
        margin: 1,
        width: 150,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR Code:', err));
    } else {
      setQrCodeUrl('');
    }
  }, [citizenUser]);

  const [recentActivities, setRecentActivities] = useState([
    { id: 1, type: 'join', text: 'Nouvelle adhésion famille', detail: 'Famille Fall, mutuelle de la Médina', time: 'Il y a 3 min', source: 'OM PAY' },
    { id: 2, type: 'payment', text: 'Paiement de cotisation', detail: 'Modou Diop, renouvellement 2026', time: 'Il y a 12 min', source: 'WAVE PAY' },
    { id: 3, type: 'donation', text: 'Don en ligne enregistré', detail: 'Donateur anonyme, 10 000 FCFA', time: 'Il y a 32 min', source: 'DON MUTUELLE' }
  ]);

  const [stats, setStats] = useState({
    beneficiariesCount: 0,
    activeBeneficiariesCount: 0,
    mutuellesCount: 0,
    donationsSum: 0
  });

  const [loginPhone, setLoginPhone] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [rufisqueTotal, setRufisqueTotal] = useState(720000);

  const [hoveredRegion, setHoveredRegion] = useState(null);

  const defaultRegionsMapData = [
    { id: 'dakar', name: 'Dakar', x: 80, y: 180, couv: 89.4, color: 'var(--primary)', mutuelles: 52, assures: '1 240 000', structures: 128 },
    { id: 'thies', name: 'Thiès', x: 120, y: 170, couv: 75.2, color: 'var(--success)', mutuelles: 38, assures: '850 000', structures: 74 },
    { id: 'diourbel', name: 'Diourbel', x: 150, y: 180, couv: 71.0, color: 'var(--success)', mutuelles: 24, assures: '620 000', structures: 42 },
    { id: 'fatick', name: 'Fatick', x: 150, y: 205, couv: 64.2, color: 'var(--success)', mutuelles: 18, assures: '310 000', structures: 28 },
    { id: 'kaolack', name: 'Kaolack', x: 190, y: 210, couv: 62.3, color: 'var(--success)', mutuelles: 22, assures: '450 000', structures: 35 },
    { id: 'kaffrine', name: 'Kaffrine', x: 230, y: 215, couv: 58.7, color: 'var(--secondary)', mutuelles: 14, assures: '210 000', structures: 18 },
    { id: 'saintlouis', name: 'Saint-Louis', x: 180, y: 110, couv: 68.5, color: 'var(--success)', mutuelles: 29, assures: '530 000', structures: 49 },
    { id: 'louga', name: 'Louga', x: 160, y: 140, couv: 60.1, color: 'var(--success)', mutuelles: 16, assures: '340 000', structures: 22 },
    { id: 'matam', name: 'Matam', x: 300, y: 120, couv: 49.8, color: 'var(--danger)', mutuelles: 12, assures: '180 000', structures: 15 },
    { id: 'tambacounda', name: 'Tambacounda', x: 340, y: 230, couv: 53.1, color: 'var(--secondary)', mutuelles: 15, assures: '290 000', structures: 19 },
    { id: 'kedougou', name: 'Kédougou', x: 420, y: 280, couv: 45.2, color: 'var(--danger)', mutuelles: 8, assures: '95 000', structures: 9 },
    { id: 'kolda', name: 'Kolda', x: 200, y: 280, couv: 55.6, color: 'var(--secondary)', mutuelles: 14, assures: '240 000', structures: 16 },
    { id: 'sedhiou', name: 'Sédhiou', x: 150, y: 290, couv: 51.3, color: 'var(--secondary)', mutuelles: 10, assures: '150 000', structures: 12 },
    { id: 'ziguinchor', name: 'Ziguinchor', x: 110, y: 300, couv: 65.4, color: 'var(--success)', mutuelles: 20, assures: '380 000', structures: 31 }
  ];

  const [regionsMapData, setRegionsMapData] = useState(defaultRegionsMapData);

  useEffect(() => {
    fetch('http://localhost:5000/api/coverage/regions')
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          setRegionsMapData(data);
        }
      })
      .catch(err => console.warn('Failed to fetch regional coverage, using local fallback:', err));
  }, []);

  useEffect(() => {
    fetch('http://localhost:5000/api/donations/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          const rufStats = data.stats.find(item => item.target === 'rufisque');
          if (rufStats) {
            setRufisqueTotal(720000 + parseInt(rufStats.total || 0));
          }
        }
      })
      .catch(err => console.warn('Failed to fetch donation stats:', err));
  }, [citizenUser]);

  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (citizenUser) {
      const token = localStorage.getItem('cmu-token') || '';
      fetch(`http://localhost:5000/api/loyalty/${citizenUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.totalPoints !== undefined) {
            setLoyalty(data);
          }
        })
        .catch(err => console.warn('Error fetching loyalty in home:', err));
    } else {
      setLoyalty(null);
    }
  }, [citizenUser]);

  const dict = {
    fr: {
      heroTitle: 'Santé pour tous, partout au Sénégal.',
      heroSub: 'Gérez et suivez l\'évolution de la couverture maladie universelle au Sénégal en temps réel. Assurez l\'accès aux soins de chaque famille.',
      btnNew: 'Nouveau bénéficiaire',
      btnStats: 'Voir les statistiques',
      stat1Title: 'Bénéficiaires actifs',
      stat2Title: 'Structures conventionnées',
      stat3Title: 'Cotisations perçues',
      stat4Title: 'Mutuelles de santé',
      card1Title: 'Couverture par type de mutuelle',
      card2Title: 'Activité récente',
      card3Title: 'Couverture par région',
      printBtn: 'Imprimer',
      viewAll: 'Voir l\'historique complet',
      showMonth: 'Ce mois',
      citizenLoginTitle: 'Accéder à mon espace assuré',
      citizenLoginDesc: 'Saisissez votre numéro de portable pour consulter votre dossier, télécharger votre carte QR de santé et payer votre cotisation annuelle.',
      phoneLabel: 'Numéro de portable',
      pinLabel: 'Code PIN (4 chiffres)',
      loginBtn: 'Se connecter',
      loginDemoHint: 'Indice démo : connectez-vous avec 771234567 (PIN: 1234)',
      citizenCardTitle: 'Votre carte QR CMU',
      citizenWelcome: 'Espace assuré de',
      statusActiveMsg: 'Votre couverture CMU est active. Vous bénéficiez du tiers-payant jusqu\'à 80% dans les hôpitaux agréés.',
      statusSuspendedMsg: 'Votre couverture est suspendue. Veuillez régulariser votre cotisation annuelle pour réactiver vos droits.',
      btnRenewCot: 'Renouveler ma cotisation (4 500 FCFA)',
      familyTitle: 'Membres de ma famille couverts',
      btnNewMember: 'Ajouter un ayant droit'
    },
    wo: {
      heroTitle: 'Wér-gi-yaram ngir ñëpp, fan yëpp ci Sénégal.',
      heroSub: 'Saytu ak topal couverture maladie universelle ci Sénégal ci internet. Dimbalé ñëpp ñu am fajj gu baax.',
      btnNew: 'Bokk bu bees',
      btnStats: 'Xool statistiques yi',
      stat1Title: 'Ñi bokk te fay',
      stat2Title: 'Fajukaay yu nu agréer',
      stat3Title: 'Xalis bi nu jël',
      stat4Title: 'Mutuelle wér-gi-yaram',
      card1Title: 'Couverture par type de mutuelle',
      card2Title: 'Liy xew tey',
      card3Title: 'Couverture ci région yi',
      printBtn: 'Imprimer',
      viewAll: 'Xool lépp',
      showMonth: 'Weer bi',
      citizenLoginTitle: 'Ubbil sa espace assuré',
      citizenLoginDesc: 'Duggalal sa portable ngir xool sa carte CMU, sa cotisation ak sa njabot.',
      phoneLabel: 'Portable',
      pinLabel: 'Code PIN (4 chiffres)',
      loginBtn: 'Duggu',
      loginDemoHint: 'Indice démo : portable 771234567 (PIN: 1234)',
      citizenCardTitle: 'Sa carte QR CMU',
      citizenWelcome: 'Espace assuré bu',
      statusActiveMsg: 'Sa wér-gi-yaram baax na. Mën nga fajjoo ba 80% ci fajukaay yi nu agréer.',
      statusSuspendedMsg: 'Sa wér-gi-yaram teye nanu ko. Fayal sa cotisation annuel ngir réactiver say droits.',
      btnRenewCot: 'Fayal sa cotisation (4 500 FCFA)',
      familyTitle: 'Sa njabot gu bokk',
      btnNewMember: 'Duggal sa bokk'
    }
  };

  const t = dict[lang];

  // Fetch stats dynamically from backend
  useEffect(() => {
    setStatsLoading(true);
    setStatsError(false);
    fetch('http://localhost:5000/api/stats')
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        if (data) setStats(data);
        setStatsLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching stats, using fallback:', err);
        setStatsError(true);
        setStatsLoading(false);
        setStats({
          beneficiariesCount: 245080,
          activeBeneficiariesCount: 210450,
          mutuellesCount: 42,
          donationsSum: 845000
        });
      });
  }, [citizenUser]);

  // Fetch recent activities from audit logs (réservé aux agents/admins)
  useEffect(() => {
    if (portalMode !== 'agent') return; // les citoyens n'ont pas accès aux logs
    const token = localStorage.getItem('cmu-token');
    if (!token) return;
    fetch('http://localhost:5000/api/audit-logs?limit=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(payload => {
        // L'API retourne { data, pagination } ; on reste tolérant aux arrays (fallback)
        const data = Array.isArray(payload) ? payload : (payload.data || []);
        if (data && Array.isArray(data)) {
          const mapped = data.slice(0, 5).map(log => {
            let type = 'join';
            if (log.action.includes('COTISATION') || log.action.includes('PAYMENT')) {
              type = 'payment';
            } else if (log.action.includes('DON')) {
              type = 'donation';
            }
            
            const logDate = new Date(log.created_at);
            const timeStr = isNaN(logDate.getTime()) 
              ? 'Récemment' 
              : logDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            
            const formattedText = log.action 
              ? log.action.charAt(0).toUpperCase() + log.action.slice(1).toLowerCase().replace(/_/g, ' ')
              : '';
            
            return {
              id: log.id,
              type,
              text: formattedText,
              detail: log.details,
              time: timeStr,
              source: log.actor || 'Système'
            };
          });
          setRecentActivities(mapped);
        }
      })
      .catch(err => console.error('Error fetching activities:', err));
  }, [citizenUser]);

  // Citizen Authentication (POST-based with PIN code)
  const handleCitizenLogin = (e) => {
    e.preventDefault();
    if (!loginPhone || !loginPin) return;
    setLoginLoading(true);
    setLoginError(null);

    fetch('http://localhost:5000/api/auth/citizen/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: loginPhone, pinCode: loginPin })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.error || 'Login Error'); });
        }
        return res.json();
      })
      .then(data => {
        setLoginLoading(false);
        if (data.success && data.citizen) {
          if (data.token) {
            localStorage.setItem('cmu-token', data.token);
          }
          setCitizenUser(data.citizen);
        } else {
          throw new Error('Invalid response structure');
        }
      })
      .catch((err) => {
        setLoginLoading(false);
        // Fallback local matching for demo stability
        const cleaned = loginPhone.replace(/\s+/g, '');
        if (cleaned === '771234567' && loginPin === '1234') {
          setCitizenUser({
            id: 1,
            firstName: 'Modou',
            lastName: 'Diop',
            birthDate: '1990-05-12',
            phone: '771234567',
            email: 'modou.diop@example.com',
            address: 'Médina Rue 22, Dakar',
            mutuelleName: 'Mutuelle de la Médina',
            packageType: 'individuel',
            paymentMethod: 'wave',
            cmuNumber: 'SN-DK-MED-8472',
            status: 'active',
            familyMembers: []
          });
        } else if (cleaned === '779876543' && loginPin === '1234') {
          setCitizenUser({
            id: 2,
            firstName: 'Awa',
            lastName: 'Ndiaye',
            birthDate: '1985-08-22',
            phone: '779876543',
            email: 'awa.ndiaye@example.com',
            address: 'Pikine Ouest Tally Boubess, Dakar',
            mutuelleName: 'Mutuelle de Pikine Ouest',
            packageType: 'familial',
            paymentMethod: 'om',
            cmuNumber: 'SN-DK-PIK-9021',
            status: 'active',
            familyMembers: [
              { id: 1, name: 'Moustapha Ndiaye', relation: 'conjoint', age: 42 },
              { id: 2, name: 'Khadija Ndiaye', relation: 'enfant', age: 12 },
              { id: 3, name: 'Abdoulaye Ndiaye', relation: 'enfant', age: 8 }
            ]
          });
        } else {
          setLoginError(lang === 'fr' 
            ? err.message || "Aucun assuré trouvé ou code PIN incorrect." 
            : err.message || "Guissunuko assuré walla PIN code bi baaxul."
          );
        }
      });
  };

  return (
    <div className="dashboard-view fade-in-up">
      {/* Hero Banner Area */}
      <div className="hero-banner" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.8)), url("/dashboard_hero_bg_real.png") center/cover no-repeat',
        borderRadius: '24px',
        padding: '2.5rem 3rem',
        boxShadow: '0 10px 30px rgba(5, 150, 105, 0.15)',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Dynamic Glowing background orb */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: '750px', textAlign: 'left' }}>
          <span className="badge badge-info" style={{ marginBottom: '1rem', background: 'rgba(255, 255, 255, 0.15)', color: '#fff' }}>
            ✨ Couverture sanitaire universelle
          </span>
          <h1 style={{ fontSize: '2.3rem', fontWeight: '800', marginBottom: '1rem', color: '#fff' }}>
            {t.heroTitle}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            {t.heroSub}
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setView('services')}>
              <span style={{ fontSize: '1.2rem', marginRight: '0.2rem' }}>+</span> {t.btnNew}
            </button>
            <button className="btn btn-success" style={{ backgroundColor: 'var(--success)', border: 'none', color: '#fff' }} onClick={() => setView('parrainage-solidaire')}>
              🤝 {lang === 'fr' ? 'Parrainage solidaire' : 'Dimbalé (parrainage)'}
            </button>
            <button className="btn btn-outline" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }} onClick={() => setView('directory')}>
              {lang === 'fr' ? 'Trouver une mutuelle' : 'Mutuelle yi'}
            </button>
          </div>
        </div>
      </div>

      {/* ======================= PORTAL MODE CITIZEN ======================= */}
      {portalMode === 'citizen' && (
        <div className="fade-in-up">
          {/* Guest State (Not Connected) */}
          {!citizenUser ? (
            <>
              <div className="grid grid-3" style={{ gap: '2rem' }}>
              {/* Login card */}
              <div className="card text-left citizen-login-card">
                <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '0.5rem', position: 'relative', zIndex: 2 }}>
                  🔑 {t.citizenLoginTitle}
                </h2>
                <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                  {t.citizenLoginDesc}
                </p>

                {loginError && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: '500'
                  }}>
                    ⚠️ {loginError}
                  </div>
                )}

                <form onSubmit={handleCitizenLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label className="form-label">{t.phoneLabel}</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      placeholder="e.g. 771234567" 
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: '0' }}>
                    <label className="form-label">{t.pinLabel}</label>
                    <input 
                      type="password" 
                      maxLength={4}
                      pattern="\d{4}"
                      className="form-control" 
                      placeholder="e.g. 1234" 
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loginLoading}>
                    {loginLoading ? '...' : t.loginBtn}
                  </button>
                </form>

                <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'var(--bg-card-subtle)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-sub)', border: '1px dashed var(--border-color)' }}>
                  💡 {t.loginDemoHint}
                </div>
              </div>

              {/* Informative card */}
              <div className="card text-left" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', color: 'var(--secondary)', marginBottom: '1rem' }}>
                    📢 Des questions sur la CMU ?
                  </h2>
                  <p style={{ color: 'var(--text-sub)', lineHeight: '1.6', marginBottom: '1rem' }}>
                    La Couverture Maladie Universelle vous permet de bénéficier d'une prise en charge des frais de consultations, de médicaments et d'hospitalisations.
                  </p>
                  <p style={{ color: 'var(--text-sub)', lineHeight: '1.6' }}>
                    Utilisez le **Chatbot IA** en bas à droite pour poser vos questions en français ou en **Wolof**. Notre assistant répond instantanément à toutes vos interrogations.
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setView('map')}>🏥 Carte structures</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setView('directory')}>📁 Annuaire mutuelles</button>
                </div>
              </div>

              {/* Donation Card */}
              <div className="card text-left" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '5px solid var(--secondary)' }}>
                <div>
                  <span className="badge badge-warning" style={{ marginBottom: '1rem', backgroundColor: 'rgba(217, 119, 6, 0.12)', color: 'var(--secondary)' }}>
                    ❤️ {lang === 'fr' ? 'Solidarité nationale' : 'Mayé & dimbelé'}
                  </span>
                  <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                    {lang === 'fr' ? 'Faire un don pour la santé' : 'Faire un don'}
                  </h2>
                  <p style={{ color: 'var(--text-sub)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                    {lang === 'fr' 
                      ? 'Soutenez les familles les plus vulnérables de Dakar en finançant leur couverture santé annuelle (4 500 FCFA).'
                      : 'Dimbalél wa Dakar yi gënë néewal doole ngir ñu mënë am fajj wér-gi-yaram.'}
                  </p>
                  {/* Goal Progress bar */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                      <span>{lang === 'fr' ? 'Fonds de solidarité régionale' : 'Fonds de solidarité'}</span>
                      <span>{Math.min(100, Math.round((rufisqueTotal / 1000000) * 100))}% ({rufisqueTotal.toLocaleString('fr-FR')} / 1 000 000 FCFA)</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (rufisqueTotal / 1000000) * 100)}%`, height: '100%', backgroundColor: 'var(--secondary)' }}></div>
                    </div>
                  </div>
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ width: '100%' }} 
                  onClick={() => {
                    if (setViewTab) {
                      setViewTab('services', 'donate');
                    } else {
                      setView('services');
                    }
                  }}
                >
                  ❤️ {lang === 'fr' ? 'Faire un don maintenant' : 'Mayé tey'}
                </button>
              </div>
            </div>

            {/* Premium Parrainage solidaire Banner */}
            <div className="card text-left parrainage-teaser-banner">
              <div style={{ position: 'relative', zIndex: 2 }}>
                <span className="badge" style={{ marginBottom: '0.75rem', padding: '0.35rem 0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}>
                  🤝 {lang === 'fr' ? 'Solidarité active' : 'Dimbelé sa réew'}
                </span>
                <h3 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#ffffff' }}>
                  {lang === 'fr' ? 'Parrainage solidaire : Offrez la santé à ceux qui en ont besoin' : 'Dimbalé ak Parrainage : Fayal wér-gi-yaram gni ko yelloo'}
                </h3>
                <p style={{ color: '#f1f5f9', fontSize: '0.95rem', lineHeight: '1.6', maxWidth: '800px', margin: '0 0 1.5rem 0' }}>
                  {lang === 'fr' 
                    ? "En tant que bienfaiteur, vous pouvez financer la couverture maladie universelle (carte de membre + cotisation annuelle de 12 mois) pour des bénéficiaires vulnérables. Parrainez des élèves de Daara ou d'écoles élémentaires au tarif collectif de 1 000 FCFA/an, ou sélectionnez des ménages complets et des filleuls individuels."
                    : "Fayal assurance wér-gi-yaram ay élève daara walla école (1 000 FCFA/at) walla ay njaboot yu néewal doole ci Dakar ngir ñu mënë fajjoo ci wér-gi-yaram gu woor."}
                </p>
                
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>👤</span>
                    <div>
                      <strong style={{ display: 'block', color: '#a7f3d0' }}>{lang === 'fr' ? 'Individuel' : 'Individuel'}</strong>
                      <span style={{ color: '#cbd5e1' }}>4 500 FCFA / pers.</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>👨‍👩‍👧‍👦</span>
                    <div>
                      <strong style={{ display: 'block', color: '#fde047' }}>{lang === 'fr' ? 'Ménages' : 'Njaboot'}</strong>
                      <span style={{ color: '#cbd5e1' }}>1 000 FCFA + 3 500 FCFA / pers.</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🎓</span>
                    <div>
                      <strong style={{ display: 'block', color: '#a5f3fc' }}>{lang === 'fr' ? 'Écoles & daaras' : 'Daara & Écoles'}</strong>
                      <span style={{ color: '#cbd5e1' }}>1 000 FCFA / élève</span>
                    </div>
                  </div>
                </div>

                <button 
                  className="btn" 
                  style={{ backgroundColor: '#ffffff', border: 'none', color: '#047857', alignSelf: 'flex-start', padding: '0.8rem 1.75rem', fontWeight: 'bold', borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: 'pointer', transition: 'all 0.2s' }} 
                  onClick={() => setView('parrainage-solidaire')}
                >
                  🤝 {lang === 'fr' ? 'Accéder à l\'espace parrainage' : 'Parrainer des bénéficiaires'}
                </button>
              </div>
            </div>
          </>
        ) : (
            /* Connected Assuré Espace */
            <div className="grid grid-2" style={{ gap: '2rem' }}>
              {/* Digital Member Card & Basic detail */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="digital-health-card" style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  boxShadow: '0 10px 25px rgba(30, 58, 138, 0.25)',
                  margin: '0',
                  maxWidth: '100%',
                  textAlign: 'left'
                }}>
                  <div className="digital-card-pattern"></div>
                  <div className="digital-card-logo">
                    <span style={{ fontWeight: '800', fontSize: '1.2rem', letterSpacing: '1px' }}>MUTUALIS DAKAR</span>
                    <div className="digital-card-chip"></div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="digital-card-label">Adhérent</div>
                      <div className="digital-card-value" style={{ fontSize: '1.3rem', textTransform: 'uppercase' }}>
                        {citizenUser.firstName} {citizenUser.lastName}
                      </div>
                      <div className="digital-card-label" style={{ marginTop: '0.75rem' }}>Mutuelle</div>
                      <div className="digital-card-value">{citizenUser.mutuelleName}</div>
                    </div>
                    
                    <div className="digital-card-qr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '4px', borderRadius: '6px', width: '74px', height: '74px' }}>
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="QR Code CMU" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                      )}
                    </div>
                  </div>

                  <div className="digital-card-details">
                    <div>
                      <div className="digital-card-label">ID CMU</div>
                      <div className="digital-card-value" style={{ fontFamily: 'monospace' }}>{citizenUser.cmuNumber}</div>
                    </div>
                    <div>
                      <div className="digital-card-label">Validité</div>
                      <div className="digital-card-value">12 / 2027</div>
                    </div>
                  </div>
                </div>

                {loyalty && (
                  <div className="card text-left" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '5px solid var(--primary)', cursor: 'pointer', margin: '0' }} onClick={() => setView('loyalty')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontSize: '2rem' }}>⭐</div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold' }}>
                          Fidélité : {loyalty.totalPoints} points
                        </h4>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                          Rang : {loyalty.level} — Cliquez pour voir vos badges
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>→</span>
                  </div>
                )}

              </div>

              {/* Status and Family list column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
                {/* Status indicator banner */}
                <div className={`card`} style={{ 
                  borderLeft: citizenUser.status === 'active' ? '5px solid var(--success)' : '5px solid var(--danger)',
                  padding: '1.5rem'
                }}>
                  <h3 style={{ color: citizenUser.status === 'active' ? 'var(--success)' : 'var(--danger)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                    {citizenUser.status === 'active' ? '✓ Couverture active' : '⚠️ Couverture inactive'}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.25rem' }}>
                    {citizenUser.status === 'active' ? t.statusActiveMsg : t.statusSuspendedMsg}
                  </p>
                  
                  {citizenUser.status !== 'active' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setView('services')}>
                      💳 {t.btnRenewCot}
                    </button>
                  )}
                </div>

                {/* Family member card lists */}
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>👨‍👩‍👧‍ {t.familyTitle}</h3>
                  
                  {citizenUser.familyMembers && citizenUser.familyMembers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {citizenUser.familyMembers.map((member, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          fontSize: '0.85rem'
                        }}>
                          <span style={{ fontWeight: '700' }}>{member.name}</span>
                          <span style={{ color: 'var(--text-sub)' }}>
                            {member.relation === 'conjoint' ? 'Conjoint' : 'Enfant'} — {member.age} ans
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Aucun ayant droit (famille) rattaché à votre carte.
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setViewTab('services', 'register', 'familial')}>
                      + {t.btnNewMember}
                    </button>
                     <button className="btn btn-success btn-sm" style={{ flex: 1, backgroundColor: 'var(--success)', border: 'none', color: '#fff' }} onClick={() => setViewTab('parrainage-solidaire')}>
                       🤝 {lang === 'fr' ? 'Parrainer' : 'Parrainer'}
                     </button>
                  </div>
                </div>

                {/* Donation Card (Connected User) */}
                <div className="card text-left" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderLeft: '5px solid var(--secondary)' }}>
                  <div>
                    <span className="badge badge-warning" style={{ marginBottom: '0.75rem', backgroundColor: 'rgba(217, 119, 6, 0.12)', color: 'var(--secondary)' }}>
                      ❤️ {lang === 'fr' ? 'Solidarité nationale' : 'Mayé & dimbelé'}
                    </span>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                      {lang === 'fr' ? 'Soutenir la solidarité régionale' : 'Mayé ngir dimbelé'}
                    </h3>
                    <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem', lineHeight: '1.5', marginBottom: '1rem' }}>
                      {lang === 'fr' 
                        ? 'Soutenez les familles les plus vulnérables de Dakar en finançant leur couverture santé annuelle (4 500 FCFA).'
                        : 'Dimbalél wa Dakar yi gënë néewal doole ngir ñu mënë am fajj wér-gi-yaram.'}
                    </p>
                    {/* Goal Progress bar */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        <span>{lang === 'fr' ? 'Fonds régional' : 'Fonds de solidarité'}</span>
                        <span>{Math.min(100, Math.round((rufisqueTotal / 1000000) * 100))}% ({rufisqueTotal.toLocaleString('fr-FR')} / 1 000 000 FCFA)</span>
                      </div>
                      <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (rufisqueTotal / 1000000) * 100)}%`, height: '100%', backgroundColor: 'var(--secondary)' }}></div>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ width: '100%', borderRadius: '8px' }} 
                    onClick={() => {
                      if (setViewTab) {
                        setViewTab('services', 'donate');
                      } else {
                        setView('services');
                      }
                    }}
                  >
                    ❤️ {lang === 'fr' ? 'Faire un don maintenant' : 'Mayé tey'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================= PORTAL MODE AGENT ======================= */}
      {portalMode === 'agent' && (
        <div className="fade-in-up">
          {/* Main KPI Stats Row */}
          <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
            {/* Card 1 */}
            <div className="card text-left" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="stat-label">{t.stat1Title}</div>
              <div className="stat-number" style={{ color: 'var(--text-main)', margin: '0.5rem 0' }}>
                {statsLoading ? '...' : (stats.activeBeneficiariesCount ? stats.activeBeneficiariesCount.toLocaleString('fr-FR') : '--')}
              </div>
              <span className="badge badge-success" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                ▲ +1.2% {lang === 'fr' ? 'ce mois' : 'weer bi'}
              </span>
              <div style={{ height: '3px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.75rem' }}>
                <div style={{ width: '85%', height: '100%', backgroundColor: 'var(--primary)' }}></div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="card text-left" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="stat-label">{t.stat2Title}</div>
              <div className="stat-number" style={{ color: 'var(--text-main)', margin: '0.5rem 0' }}>
                {statsLoading ? '...' : (stats.structuresCount || stats.mutuellesCount || '--')}
              </div>
              <span className="badge badge-success" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                ✓ 97% {lang === 'fr' ? 'de couverture' : 'couverture'}
              </span>
              <div style={{ height: '3px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.75rem' }}>
                <div style={{ width: '97%', height: '100%', backgroundColor: 'var(--success)' }}></div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="card text-left" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="stat-label">{t.stat3Title}</div>
              <div className="stat-number" style={{ color: 'var(--text-main)', margin: '0.5rem 0' }}>
                {statsLoading ? '...' : (stats.donationsSum ? `${stats.donationsSum.toLocaleString('fr-FR')} FCFA` : '0 FCFA')}
              </div>
              <span className="badge badge-info" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem', color: 'var(--secondary)', backgroundColor: 'rgba(255, 127, 17, 0.12)' }}>
                💳 Wave & OM
              </span>
              <div style={{ height: '3px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.75rem' }}>
                <div style={{ width: '74%', height: '100%', backgroundColor: 'var(--secondary)' }}></div>
              </div>
            </div>

            {/* Card 4 */}
            <div className="card text-left" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              <div className="stat-label">{t.stat4Title}</div>
              <div className="stat-number" style={{ color: 'var(--text-main)', margin: '0.5rem 0' }}>
                {statsLoading ? '...' : (stats.mutuellesCount || '--')}
              </div>
              <span className="badge badge-success" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }}>
                ▲ +5 {lang === 'fr' ? 'nouvelles' : 'bees'}
              </span>
              <div style={{ height: '3px', backgroundColor: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.75rem' }}>
                <div style={{ width: '90%', height: '100%', backgroundColor: 'var(--warning)' }}></div>
              </div>
            </div>
          </div>

          {/* Grid Dashboard Widgets */}
          <div className="grid grid-2">
            {/* Left Widget Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Card: Coverage Type */}
              <div className="card" style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{t.card1Title}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="badge" style={{ backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-sub)' }}>{t.showMonth}</span>
                    <button className="btn-text" style={{ fontSize: '0.8rem', padding: '0 0.5rem', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--primary)' }} onClick={() => window.print()}>{t.printBtn}</button>
                  </div>
                </div>

                {/* Coverage bars list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span>Mutuelles communautaires</span>
                      <strong>1,720,480 <span style={{ color: 'var(--text-muted)' }}>(49.9%)</span></strong>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '49.9%', height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, var(--primary-hover) 100%)' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span>IPM-Tiers (entreprises)</span>
                      <strong>650,290 <span style={{ color: 'var(--text-muted)' }}>(18.8%)</span></strong>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '18.8%', height: '100%', background: 'linear-gradient(90deg, var(--success) 0%, var(--success-dark) 100%)' }}></div>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                      <span>Reste des mutuelles (scolaires, etc.)</span>
                      <strong>432,180 <span style={{ color: 'var(--text-muted)' }}>(12.5%)</span></strong>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '12.5%', height: '100%', background: 'linear-gradient(90deg, var(--secondary) 0%, #d85c00 100%)' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: Recent Activity */}
              <div className="card" style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem' }}>{t.card2Title}</h3>
                  <button className="btn-text" style={{ fontSize: '0.8rem', padding: '0', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--primary)' }} onClick={() => setView('services')}>{t.viewAll} →</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {recentActivities.map(act => (
                    <div key={act.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: act.type === 'join' ? 'rgba(59,130,246,0.1)' : act.type === 'payment' ? 'rgba(16,185,129,0.1)' : 'rgba(255,127,17,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem'
                        }}>
                          {act.type === 'join' ? '👤' : act.type === 'payment' ? '💰' : '❤️'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{act.text}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{act.detail}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                        <span className="badge" style={{
                          fontSize: '0.65rem',
                          padding: '0.1rem 0.4rem',
                          backgroundColor: 'rgba(0,0,0,0.03)',
                          color: 'var(--text-muted)'
                        }}>{act.source}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{act.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Widget Column - Senegal Map Coverage */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>{t.card3Title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
                Visualisation de la couverture maladie universelle par région sanitaire (points chauds).
              </p>

              {/* SVG Map of Senegal - Stylized Vector Layout */}
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem',
                position: 'relative',
                minHeight: '280px'
              }}>
                <svg viewBox="0 0 500 350" style={{ width: '100%', height: '100%', maxHeight: '300px' }}>
                  {/* Stylized background paths representing Senegal outline map */}
                  <path d="M 50,150 L 150,100 L 250,120 L 350,160 L 450,140 L 480,240 L 380,320 L 280,260 L 230,300 L 150,220 L 70,260 Z" fill="none" stroke="rgba(15, 23, 42, 0.06)" strokeWidth="3" />
                  <path d="M 50,150 L 150,100 L 250,120 L 350,160 L 450,140 L 480,240 L 380,320 L 280,260 L 230,300 L 150,220 L 70,260 Z" fill="rgba(10, 88, 202, 0.02)" />
                  
                  {/* Dynamic Regions */}
                  {regionsMapData.map(reg => {
                    const isHovered = hoveredRegion === reg.id;
                    const rBase = reg.couv > 80 ? 6 : reg.couv > 60 ? 4 : 3;
                    const rOuter = reg.couv > 80 ? 18 : reg.couv > 60 ? 12 : 10;
                    
                    return (
                      <g 
                        key={reg.id} 
                        onMouseEnter={() => setHoveredRegion(reg.id)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        onClick={() => setHoveredRegion(hoveredRegion === reg.id ? null : reg.id)}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          setHoveredRegion(hoveredRegion === reg.id ? null : reg.id);
                        }}
                        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                      >
                        <circle 
                          cx={reg.x} 
                          cy={reg.y} 
                          r={isHovered ? rOuter + 4 : rOuter} 
                          fill={reg.color} 
                          opacity="0.15" 
                          stroke={reg.color} 
                          strokeWidth={isHovered ? "2" : "1"} 
                          style={{ transition: 'all 0.3s ease' }}
                        />
                        <circle 
                          cx={reg.x} 
                          cy={reg.y} 
                          r={isHovered ? rBase + 2 : rBase} 
                          fill={reg.color} 
                          style={{ transition: 'all 0.3s ease' }}
                        />
                        <text 
                          x={reg.x + 12} 
                          y={reg.y - 4} 
                          fill="var(--text-main)" 
                          fontSize={isHovered ? "12" : "9"} 
                          fontWeight={isHovered ? "bold" : "normal"}
                          style={{ transition: 'all 0.2s ease', pointerEvents: 'none' }}
                        >
                          {reg.name}
                        </text>
                        {(isHovered || reg.couv > 80) && (
                          <text 
                            x={reg.x + 12} 
                            y={reg.y + 8} 
                            fill={reg.color} 
                            fontSize={isHovered ? "10" : "8"} 
                            fontWeight="bold"
                            style={{ transition: 'all 0.2s ease', pointerEvents: 'none' }}
                          >
                            {reg.couv}% de couv.
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {hoveredRegion && (() => {
                  const reg = regionsMapData.find(r => r.id === hoveredRegion);
                  if (!reg) return null;
                  return (
                    <div style={{
                      position: 'absolute',
                      left: `${(reg.x / 500) * 100}%`,
                      top: `${(reg.y / 350) * 100}%`,
                      transform: 'translate(-50%, -110%)',
                      background: 'var(--bg-card)',
                      border: '2px solid var(--primary)',
                      borderRadius: '12px',
                      padding: '0.75rem 1rem',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 10,
                      pointerEvents: 'none',
                      width: '180px',
                      fontSize: '0.8rem',
                      color: 'var(--text-main)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: 'var(--primary)' }}>📍 {reg.name}</span>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: reg.color, color: '#fff' }}>{reg.couv}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Assurés' : 'Assuré yi'} :</span>
                        <span style={{ fontWeight: 'bold' }}>{reg.assures}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Mutuelles' : 'Mutuelle'} :</span>
                        <span style={{ fontWeight: 'bold' }}>{reg.mutuelles}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Structures' : 'Fajukaay'} :</span>
                        <span style={{ fontWeight: 'bold' }}>{reg.structures}</span>
                      </div>
                    </div>
                  );
                })()}

                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  backgroundColor: 'var(--bg-card)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.65rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }}></span>
                    <span>Excellent (&gt;80%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
                    <span>Bon (60%-80%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--secondary)' }}></span>
                    <span>Moyen (50%-60%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)' }}></span>
                    <span>Faible (&lt;50%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
