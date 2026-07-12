import React from 'react';
import { cacheSet } from '../utils/offline';

export default function Header({ 
  lang, 
  currentView, 
  setView, 
  setViewTab,
  servicesTab,
  portalMode, 
  setPortalMode, 
  citizenUser, 
  setCitizenUser,
  agentUser,
  setAgentUser,
  partnerUser,
  setPartnerUser,
  sidebarOpen,
  setSidebarOpen
}) {
  // Translations dictionary for the sidebar navigation
  const dict = {
    fr: {
      tagline: 'Minsanté Sénégal',
      home: 'Tableau de bord',
      homeCitizen: 'Espace citoyen',
      beneficiaries: 'Bénéficiaires',
      map: 'Structures de santé',
      directory: 'Annuaire mutuelles',
      services: 'Adhésions & dons',
      servicesCitizen: 'Mon adhésion',
      depts: 'Unions & stats',
      profileGuest: 'Visiteur',
      profileGuestRole: 'Non connecté',
      profileCitizenRole: 'Assuré cmu',
      profileName: 'Agent cmu',
      profileRole: 'Superviseur régional',
      portalLabel: 'Portail actif',
      portalCitizen: 'Citoyen 🇸🇳',
      portalAgent: 'Agent 💼',
      btnLogout: 'Déconnexion',
      medicaments: 'Médicaments & soins',
      auditLogs: 'Journal d\'audit',
      complaints: 'Réclamations',
      dashboard: 'Tableau de bord CSU',
      claims: 'Prise en charge',
      notifications: 'Notifications',
      myClaims: 'Mes remboursements',
      cotisations: 'Cotisations',
      myCotisations: 'Mes cotisations',
      partner: 'Espace partenaire',
      regionalStats: 'Stats inter-régions',
      loyalty: 'Fidélité',
      payments: 'Paiement',
      profileNavCitizen: 'Mon compte',
      profileNavAgent: 'Mon profil',
      donateMenu: 'Faire un don',
      programmes: 'Programmes CSU'
    },
    wo: {
      tagline: 'Minsanté Sénégal',
      home: 'Tableau de bord',
      homeCitizen: 'Espace citoyen',
      beneficiaries: 'Ñi bokk',
      map: 'Fajukaay yi',
      directory: 'Annuaire mutuelle',
      services: 'Mbindu ak dons',
      servicesCitizen: 'Sa mbindu',
      depts: 'Diiwaan yi',
      profileGuest: 'Gan',
      profileGuestRole: 'Amul compte',
      profileCitizenRole: 'Ki bokk',
      profileName: 'Woyofal cmu',
      profileRole: 'Njiit gobal',
      portalLabel: 'Portail',
      portalCitizen: 'Citoyen 🇸🇳',
      portalAgent: 'Agent 💼',
      btnLogout: 'Genn',
      medicaments: 'Garab & fajj',
      auditLogs: 'Registre audit',
      complaints: 'Réclamations',
      dashboard: 'Tableau CSU',
      claims: 'Prise en charge',
      notifications: 'Notifications',
      myClaims: 'Sama remboursement',
      cotisations: 'Cotisation',
      myCotisations: 'Sama cotisation',
      partner: 'Espace partenaire',
      regionalStats: 'Stats région',
      loyalty: 'Fidélité',
      payments: 'Fay',
      profileNavCitizen: 'Sama compte',
      profileNavAgent: 'Sama profil',
      donateMenu: 'Mayé (dons)',
      programmes: 'Përogaraam CSU'
    }
  };

  const t = dict[lang];

  const navigateTo = (viewName, tabName) => {
    setView(viewName);
    if (setViewTab && tabName) {
      setViewTab(viewName, tabName);
    }
  };

  // Déconnexion : révoque le refresh token côté serveur puis purge la session locale
  const handleLogout = () => {
    const refreshToken = localStorage.getItem('cmu-refresh-token');
    const accessToken = localStorage.getItem('cmu-token');
    // Appel best-effort : on ne bloque pas la déconnexion locale en cas d'échec réseau
    fetch('http://localhost:5000/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    }).catch(() => {});
    localStorage.removeItem('cmu-token');
    localStorage.removeItem('cmu-refresh-token');
    localStorage.removeItem('cmu-citizen-user');
    localStorage.removeItem('cmu-agent-user');
    localStorage.removeItem('cmu-partner-user');
    localStorage.removeItem('cmu-partner-token');
    localStorage.removeItem('cmu-portal-mode');
    cacheSet('citizenUser', null).catch(() => {});
    setCitizenUser(null);
    setAgentUser(null);
    if (setPartnerUser) setPartnerUser(null);
    setView('home');
  };

  // Determine current profile credentials based on portal mode and login session
  const getProfileInfo = () => {
    if (partnerUser) {
      return {
        name: partnerUser.contactName || partnerUser.structureName || 'Partenaire',
        role: partnerUser.structureName || 'Structure de soins',
        avatar: '🏥'
      };
    }
    if (portalMode === 'citizen') {
      if (citizenUser) {
        return {
          name: `${citizenUser.firstName} ${citizenUser.lastName}`,
          role: t.profileCitizenRole,
          avatar: '👤'
        };
      } else {
        return {
          name: t.profileGuest,
          role: t.profileGuestRole,
          avatar: '🔑'
        };
      }
    } else {
      if (agentUser) {
        return {
          name: `${agentUser.firstName} ${agentUser.lastName}`,
          role: agentUser.role || t.profileRole,
          avatar: '💼'
        };
      } else {
        return {
          name: 'Agent de santé',
          role: 'Non connecté',
          avatar: '🔒'
        };
      }
    }
  };

  const profile = getProfileInfo();

  return (
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      {/* Sidebar Logo */}
      <div className="sidebar-logo" style={{ cursor: 'pointer', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }} onClick={() => setView('home')}>
        <img src="/msdd_logo_corrected.png" alt="Mutuelle de santé départementale de Dakar" style={{ width: '100%', maxWidth: '200px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '0 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <img src="/sencsu_logo.png" alt="SEN CSU logo" style={{ height: '40px', objectFit: 'contain' }} />
      </div>

      {/* Sidebar Profile Card */}
      <div className="sidebar-profile" onClick={() => (citizenUser || agentUser) && setView('profile')} style={{ cursor: (citizenUser || agentUser) ? 'pointer' : 'default', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="sidebar-logo-icon" style={{ 
            background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            width: '40px',
            height: '40px',
            fontSize: '1rem',
            borderRadius: '50%',
            flexShrink: 0
          }}>
            {profile.avatar}
          </div>
          <div className="sidebar-profile-info" style={{ overflow: 'hidden' }}>
            <span className="sidebar-profile-name" style={{ fontWeight: '700', fontSize: '0.85rem' }}>{profile.name}</span>
            <span className="sidebar-profile-role" style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>{profile.role}</span>
          </div>
        </div>
        
        {portalMode === 'citizen' && citizenUser && (
          <button 
            className="btn btn-outline btn-sm" 
            onClick={() => handleLogout() }
            style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
          >
            {t.btnLogout}
          </button>
        )}

        {portalMode === 'agent' && agentUser && (
          <button 
            className="btn btn-outline btn-sm" 
            onClick={() => handleLogout() }
            style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
          >
            {t.btnLogout}
          </button>
        )}

        {partnerUser && (
          <button 
            className="btn btn-outline btn-sm" 
            onClick={() => handleLogout() }
            style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '6px' }}
          >
            {t.btnLogout}
          </button>
        )}
      </div>

      {/* Sidebar Navigation Links (Filtered by Portal Mode) */}
      <nav className="sidebar-nav">
        {/* Home option */}
        <button 
          className={`nav-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={() => navigateTo('home')}
        >
          <span className="nav-icon">📊</span>
          {portalMode === 'citizen' ? t.homeCitizen : t.home}
        </button>

        {/* Programmes CSU (Public) */}
        <button 
          className={`nav-item ${currentView === 'programmes' ? 'active' : ''}`}
          onClick={() => navigateTo('programmes')}
        >
          <span className="nav-icon">🛡️</span>
          {t.programmes}
        </button>

        {/* Parrainage solidaire (Public Dedicated Page) */}
        <button 
          className={`nav-item ${currentView === 'parrainage-solidaire' ? 'active' : ''}`}
          onClick={() => navigateTo('parrainage-solidaire')}
        >
          <span className="nav-icon">🤝</span>
          {lang === 'fr' ? 'Parrainage solidaire' : 'Dimbalé (parrainage)'}
        </button>

        {/* Galerie CSU (Public) */}
        <button 
          className={`nav-item ${currentView === 'galerie' ? 'active' : ''}`}
          onClick={() => navigateTo('galerie')}
        >
          <span className="nav-icon">🖼️</span>
          {lang === 'fr' ? 'Galerie CSU' : 'Natalu CSU'}
        </button>

        {/* Infos Sénégal (Public) */}
        <button 
          className={`nav-item ${currentView === 'infos-csu' ? 'active' : ''}`}
          onClick={() => navigateTo('infos-csu')}
        >
          <span className="nav-icon">ℹ️</span>
          {lang === 'fr' ? 'Infos Sénégal' : 'Xibaari Sénégal'}
        </button>

        {/* Blog experts (Public) */}
        <button 
          className={`nav-item ${currentView === 'blog-experts' ? 'active' : ''}`}
          onClick={() => navigateTo('blog-experts')}
        >
          <span className="nav-icon">✍️</span>
          {lang === 'fr' ? 'Espace blog & paroles d\'experts' : 'Waxu docteur'}
        </button>

        {/* Espace partenariat (Public) */}
        <button 
          className={`nav-item ${currentView === 'partnership' ? 'active' : ''}`}
          onClick={() => navigateTo('partnership')}
        >
          <span className="nav-icon">🤝</span>
          {lang === 'fr' ? 'Espace partenariat' : 'Pekou partenariat'}
        </button>

        {/* Espace RSE (Public) */}
        <button 
          className={`nav-item ${currentView === 'rse' ? 'active' : ''}`}
          onClick={() => navigateTo('rse')}
        >
          <span className="nav-icon">🏢</span>
          {lang === 'fr' ? 'Espace RSE' : 'Espace RSE'}
        </button>

        {/* Mon compte / Connexion (Always visible) */}
        <button 
          className={`nav-item ${currentView === 'profile' || currentView === 'login' ? 'active' : ''}`}
          onClick={() => {
            if (citizenUser || agentUser) {
              navigateTo('profile');
            } else {
              navigateTo('login');
            }
          }}
        >
          <span className="nav-icon">👤</span>
          {citizenUser || agentUser 
            ? (portalMode === 'citizen' ? t.profileNavCitizen : t.profileNavAgent) 
            : (lang === 'fr' ? 'Mon compte' : 'Sama compte')}
        </button>

        {/* Option 2: Beneficiaries list (Agent mode only) */}
        {portalMode === 'agent' && agentUser && (
          <button 
            className={`nav-item ${currentView === 'beneficiaries' ? 'active' : ''}`}
            onClick={() => navigateTo('beneficiaries')}
          >
            <span className="nav-icon">👥</span>
            {t.beneficiaries}
          </button>
        )}

        {/* Option 3: Registration / cotisations (Citizen / Agent specific text) */}
        <button 
          className={`nav-item ${currentView === 'services' && servicesTab !== 'donate' ? 'active' : ''}`}
          onClick={() => navigateTo('services', 'register')}
        >
          <span className="nav-icon">💳</span>
          {portalMode === 'citizen' ? t.servicesCitizen : t.services}
        </button>

        {/* Dedicated: Faire un don (Public) */}
        <button 
          className={`nav-item ${currentView === 'services' && servicesTab === 'donate' ? 'active' : ''}`}
          onClick={() => navigateTo('services', 'donate')}
        >
          <span className="nav-icon">❤️</span>
          {t.donateMenu}
        </button>

        {/* Option 4: Medicaments Directory (Public) */}
        <button 
          className={`nav-item ${currentView === 'medicaments' ? 'active' : ''}`}
          onClick={() => navigateTo('medicaments')}
        >
          <span className="nav-icon">💊</span>
          {t.medicaments}
        </button>

        {/* Option 5: Complaints (Citizen if logged in, or Agent) */}
        {(portalMode === 'agent' || citizenUser) && (
          <button 
            className={`nav-item ${currentView === 'complaints' ? 'active' : ''}`}
            onClick={() => navigateTo('complaints')}
          >
            <span className="nav-icon">📣</span>
            {t.complaints}
          </button>
        )}

        {/* Option 6: Structures de sante map */}
        <button 
          className={`nav-item ${currentView === 'map' ? 'active' : ''}`}
          onClick={() => navigateTo('map')}
        >
          <span className="nav-icon">🏥</span>
          {t.map}
        </button>

        {/* Option 7: Directory list */}
        <button 
          className={`nav-item ${currentView === 'directory' ? 'active' : ''}`}
          onClick={() => navigateTo('directory')}
        >
          <span className="nav-icon">📁</span>
          {t.directory}
        </button>

        {/* Option 8: Departmental stats (Agent & Citizen modes) */}
        {((portalMode === 'agent' && agentUser) || (portalMode === 'citizen' && citizenUser)) && (
          <button 
            className={`nav-item ${currentView === 'depts' ? 'active' : ''}`}
            onClick={() => navigateTo('depts')}
          >
            <span className="nav-icon">📍</span>
            {t.depts}
          </button>
        )}

        {/* Option 9: Journal d'Audit (Super Admin only) */}
        {portalMode === 'agent' && agentUser && agentUser.role === 'Super Admin' && (
          <button 
            className={`nav-item ${currentView === 'audit-logs' ? 'active' : ''}`}
            onClick={() => setView('audit-logs')}
          >
            <span className="nav-icon">🔒</span>
            {t.auditLogs}
          </button>
        )}

        {/* Option 10: Tableau de bord CSU (Agent mode only) */}
        {portalMode === 'agent' && agentUser && (
          <button
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setView('dashboard')}
          >
            <span className="nav-icon">📊</span>
            {t.dashboard}
          </button>
        )}

        {/* Option 11: Prise en charge (Agent & Citizen modes) */}
        {(portalMode === 'agent' ? agentUser : citizenUser) && (
          <button
            className={`nav-item ${currentView === 'claims' ? 'active' : ''}`}
            onClick={() => setView('claims')}
          >
            <span className="nav-icon">💊</span>
            {portalMode === 'agent' ? t.claims : t.myClaims}
          </button>
        )}

        {/* Option 12: Notifications (Agent mode only) */}
        {portalMode === 'agent' && agentUser && (
          <button
            className={`nav-item ${currentView === 'notifications' ? 'active' : ''}`}
            onClick={() => setView('notifications')}
          >
            <span className="nav-icon">🔔</span>
            {t.notifications}
          </button>
        )}

        {/* Option 13: Cotisations (Agent & Citizen modes) */}
        {(portalMode === 'agent' ? agentUser : citizenUser) && (
          <button
            className={`nav-item ${currentView === 'cotisations' ? 'active' : ''}`}
            onClick={() => setView('cotisations')}
          >
            <span className="nav-icon">💰</span>
            {portalMode === 'agent' ? t.cotisations : t.myCotisations}
          </button>
        )}

        {/* Option 14: Stats inter-régions (Super Admin only) */}
        {portalMode === 'agent' && agentUser && agentUser.role === 'Super Admin' && (
          <button
            className={`nav-item ${currentView === 'regional-stats' ? 'active' : ''}`}
            onClick={() => setView('regional-stats')}
          >
            <span className="nav-icon">🗺️</span>
            {t.regionalStats}
          </button>
        )}

        {/* Option 15: Espace partenaire (accessible aux agents/partenaires, et visiteurs non connectés) */}
        {(portalMode !== 'citizen' || !citizenUser) && (
          <button
            className={`nav-item ${currentView === 'partner' ? 'active' : ''}`}
            onClick={() => setView('partner')}
          >
            <span className="nav-icon">🏥</span>
            {t.partner}
          </button>
        )}

        {/* Option 16: Paiement en ligne (citoyen connecté) */}
        {citizenUser && (
          <button
            className={`nav-item ${currentView === 'payments' ? 'active' : ''}`}
            onClick={() => setView('payments')}
          >
            <span className="nav-icon">💳</span>
            {t.payments}
          </button>
        )}

        {/* Option 17: Programme fidélité (citoyen connecté) */}
        {citizenUser && (
          <button
            className={`nav-item ${currentView === 'loyalty' ? 'active' : ''}`}
            onClick={() => setView('loyalty')}
          >
            <span className="nav-icon">⭐</span>
            {t.loyalty}
          </button>
        )}
      </nav>

      {/* Portal switcher controls */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t.portalLabel}
        </label>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button 
            className="portal-switch-btn"
            onClick={() => { setPortalMode('citizen'); setView('home'); }}
            style={{
              flex: '1',
              padding: '0.45rem 0.2rem',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: portalMode === 'citizen' ? 'var(--primary)' : 'transparent',
              color: portalMode === 'citizen' ? '#fff' : 'var(--text-sub)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {t.portalCitizen}
          </button>
          <button 
            className="portal-switch-btn"
            onClick={() => { setPortalMode('agent'); setView('home'); }}
            style={{
              flex: '1',
              padding: '0.45rem 0.2rem',
              fontSize: '0.72rem',
              fontWeight: 'bold',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: portalMode === 'agent' ? 'var(--primary)' : 'transparent',
              color: portalMode === 'agent' ? '#fff' : 'var(--text-sub)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {t.portalAgent}
          </button>
        </div>
      </div>
    </aside>
  );
}
