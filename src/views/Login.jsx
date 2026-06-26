import React, { useState } from 'react';

export default function Login({ lang, setView, portalMode, setPortalMode, setCitizenUser, setAgentUser }) {
  const [activeTab, setActiveTab] = useState(portalMode); // 'citizen' or 'agent'
  
  // Citizen form states
  const [citizenPhone, setCitizenPhone] = useState('');
  const [citizenPin, setCitizenPin] = useState('');
  
  // Agent form states
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dict = {
    fr: {
      title: 'Connexion au portail CMU',
      subtitle: 'Accédez à votre espace sécurisé couverture maladie universelle de Dakar.',
      tabCitizen: 'Espace citoyen 🇸🇳',
      tabAgent: 'Espace agent CMU 💼',
      phoneLabel: 'Numéro de portable',
      pinLabel: 'Code PIN (4 chiffres)',
      emailLabel: 'Adresse e-mail professionnelle',
      passwordLabel: 'Mot de passe',
      btnConnect: 'Se connecter',
      demoHintCitizen: 'Indice citoyen : connectez-vous avec 771234567 ou 779876543 (PIN: 1234)',
      demoHintAgent: 'Indice agent : connectez-vous avec agent@cmu.sn (mot de passe: senecarte)',
      errorEmpty: 'Veuillez remplir tous les champs.',
      errorFail: 'Identifiants incorrects. Veuillez réessayer.'
    },
    wo: {
      title: 'Duggu ci portal CMU',
      subtitle: 'Ubbil sa compte sécurisé couverture maladie universelle bu Ndakaaru.',
      tabCitizen: 'Citoyen 🇸🇳',
      tabAgent: 'Agent CMU 💼',
      phoneLabel: 'Portable',
      pinLabel: 'Code PIN (4 chiffres)',
      emailLabel: 'E-mail agent',
      passwordLabel: 'Mot de passe',
      btnConnect: 'Duggu',
      demoHintCitizen: 'Indice citoyen : duggu ko ak 771234567 walla 779876543 (PIN: 1234)',
      demoHintAgent: 'Indice agent : duggu ko ak agent@cmu.sn (pass: senecarte)',
      errorEmpty: 'Bindal yëf yëpp.',
      errorFail: 'Mbind yi baaxul. Recommencé wat.'
    }
  };

  const t = dict[lang];

  const handleCitizenSubmit = (e) => {
    e.preventDefault();
    if (!citizenPhone || !citizenPin) {
      setError(t.errorEmpty);
      return;
    }
    setError('');
    setLoading(true);

    fetch('http://localhost:5000/api/auth/citizen/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: citizenPhone, pinCode: citizenPin })
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setLoading(false);
        if (data.success) {
          localStorage.setItem('cmu-token', data.token);
          if (data.refreshToken) localStorage.setItem('cmu-refresh-token', data.refreshToken);
          setPortalMode('citizen');
          setCitizenUser(data.citizen);
          setView('home');
        } else {
          setError(t.errorFail);
        }
      })
      .catch(() => {
        setLoading(false);
        // Offline Fallback for testing
        const cleaned = citizenPhone.replace(/\s+/g, '');
        if ((cleaned === '771234567' || cleaned === '779876543') && citizenPin === '1234') {
          const mockUser = cleaned === '771234567' 
            ? {
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
              }
            : {
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
              };
          setPortalMode('citizen');
          setCitizenUser(mockUser);
          setView('home');
        } else {
          setError(t.errorFail);
        }
      });
  };

  const handleAgentSubmit = (e) => {
    e.preventDefault();
    if (!agentEmail || !agentPassword) {
      setError(t.errorEmpty);
      return;
    }
    setError('');
    setLoading(true);

    fetch('http://localhost:5000/api/auth/agent/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: agentEmail, password: agentPassword })
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setLoading(false);
        if (data.success) {
          localStorage.setItem('cmu-token', data.token);
          if (data.refreshToken) localStorage.setItem('cmu-refresh-token', data.refreshToken);
          setPortalMode('agent');
          setAgentUser(data.agent);
          setView('home');
        } else {
          setError(t.errorFail);
        }
      })
      .catch(() => {
        setLoading(false);
        // Offline Fallback for testing
        if (agentEmail === 'agent@cmu.sn' && agentPassword === 'senecarte') {
          setPortalMode('agent');
          setAgentUser({
            id: 1,
            username: 'agent@cmu.sn',
            firstName: 'Amadou',
            lastName: 'Sall',
            role: 'Superviseur Régional'
          });
          setView('home');
        } else {
          setError(t.errorFail);
        }
      });
  };

  return (
    <div className="login-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_login_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>🔑 {t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ maxWidth: '460px', margin: '2rem auto', padding: '0 1rem' }}>
        <div className="card" style={{
          padding: '2.5rem 2rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-lg)',
          textAlign: 'left',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Senegal Colors Top Border Accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            display: 'flex'
          }}>
            <div style={{ flex: 1, backgroundColor: '#00853f' }}></div>
            <div style={{ flex: 1, backgroundColor: '#fdef42' }}></div>
            <div style={{ flex: 1, backgroundColor: '#e31b23' }}></div>
          </div>

      {/* Auth Tab Buttons */}
      <div style={{
        display: 'flex',
        backgroundColor: 'var(--bg-card-subtle)',
        padding: '0.35rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        gap: '0.25rem'
      }}>
        <button
          onClick={() => { setActiveTab('citizen'); setError(''); }}
          style={{
            flex: 1,
            padding: '0.6rem 0.5rem',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'citizen' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'citizen' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'citizen' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          {t.tabCitizen}
        </button>
        <button
          onClick={() => { setActiveTab('agent'); setError(''); }}
          style={{
            flex: 1,
            padding: '0.6rem 0.5rem',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'agent' ? 'var(--bg-card)' : 'transparent',
            color: activeTab === 'agent' ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: activeTab === 'agent' ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.2s'
          }}
        >
          {t.tabAgent}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          color: 'var(--danger)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          fontWeight: '500',
          marginBottom: '1.5rem',
          borderLeft: '4px solid var(--danger)'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Citizen login form */}
      {activeTab === 'citizen' && (
        <form onSubmit={handleCitizenSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.phoneLabel}</label>
            <input
              type="tel"
              className="form-control"
              placeholder="e.g. 771234567"
              value={citizenPhone}
              onChange={(e) => setCitizenPhone(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.pinLabel}</label>
            <input
              type="password"
              className="form-control"
              maxLength={4}
              placeholder="••••"
              value={citizenPin}
              onChange={(e) => setCitizenPin(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? '...' : t.btnConnect}
          </button>
          <div style={{
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: 'var(--bg-card-subtle)',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-color)',
            lineHeight: '1.4'
          }}>
            💡 {t.demoHintCitizen}
          </div>
        </form>
      )}

      {/* Agent login form */}
      {activeTab === 'agent' && (
        <form onSubmit={handleAgentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.emailLabel}</label>
            <input
              type="email"
              className="form-control"
              placeholder="agent@cmu.sn"
              value={agentEmail}
              onChange={(e) => setAgentEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t.passwordLabel}</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={agentPassword}
              onChange={(e) => setAgentPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? '...' : t.btnConnect}
          </button>
          <div style={{
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: 'var(--bg-card-subtle)',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-color)',
            lineHeight: '1.4'
          }}>
            💡 {t.demoHintAgent}
          </div>
        </form>
      )}
        </div>
      </div>
    </div>
  );
}
