import React, { useState, useEffect, Component } from 'react';
import Header from './components/Header';
import ChatbotWidget from './components/ChatbotWidget';
import AudioReader from './components/AudioReader';

// Import Views
import Home from './views/Home';
import Institutionnel from './views/Institutionnel';
import Departements from './views/Departements';
import Cartographie from './views/Cartographie';
import BaseNationale from './views/BaseNationale';
import ServicesEnLigne from './views/ServicesEnLigne';
import Beneficiaries from './views/Beneficiaries';
import Login from './views/Login';
import Medicaments from './views/Medicaments';
import AuditLogs from './views/AuditLogs';
import Complaints from './views/Complaints';
import Profile from './views/Profile';
import ProgrammesCSU from './views/ProgrammesCSU';
import GalerieCSU from './views/GalerieCSU';
import InfosCSU from './views/InfosCSU';
import BlogExperts from './views/BlogExperts';
import ParrainageCSU from './views/ParrainageCSU';
import Partnership from './views/Partnership';
import VerifyCard from './views/VerifyCard';
import AgentDashboard from './views/AgentDashboard';
import Claims from './views/Claims';
import Notifications from './views/Notifications';
import Cotisations from './views/Cotisations';
import PartnerPortal from './views/PartnerPortal';
import RegionalStats from './views/RegionalStats';
import Loyalty from './views/Loyalty';
import Payments from './views/Payments';
import RsePortal from './views/RsePortal';
import { syncOutbox, outboxCount, cacheSet, cacheGet } from './utils/offline';

// Import Styles
import './index.css';
import './styles/components.css';
import './styles/views.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught rendering exception:", error, errorInfo);
    fetch('http://localhost:5000/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message || 'Unknown render error', stack: error.stack || '' })
    }).catch(() => {});
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card text-center" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '600px', borderLeft: '6px solid var(--danger)' }}>
          <h2 style={{ color: 'var(--danger)', fontSize: '1.4rem', marginBottom: '1rem' }}>⚠️ Erreur d'affichage</h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
            Une erreur inattendue est survenue lors du rendu de cette section. L'incident a été automatiquement signalé à l'équipe technique.
          </p>
          <div style={{ textAlign: 'left', background: 'var(--card-bg-subtle)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-main)', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            {this.state.error?.toString()}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            Actualiser l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Liste des vues valides (pour valider le hash URL)
  const validViews = ['home','login','beneficiaries','services','map','directory','depts','programmes','about','medicaments','audit-logs','galerie','infos-csu','blog-experts','parrainage-solidaire','partnership','complaints','profile','verify','dashboard','claims','notifications','cotisations','partner','regional-stats','loyalty','payments'];

  // Initialise la vue depuis le hash URL (#/beneficiaries) pour le deep-linking
  const initialViewFromHash = () => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const firstSegment = hash.split('/')[0];
    return validViews.includes(firstSegment) ? firstSegment : 'home';
  };

  const [lang, setLang] = useState('fr'); // fr or wo (French or Wolof)
  const [view, setView] = useState(initialViewFromHash()); // home, beneficiaries, services, map, directory, depts, about, medicaments, audit-logs, complaints
  const [portalMode, setPortalMode] = useState(localStorage.getItem('cmu-portal-mode') || 'citizen'); // citizen or agent
  const [citizenUser, rawSetCitizenUser] = useState(() => {
    try {
      const cached = localStorage.getItem('cmu-citizen-user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn('Error parsing citizenUser:', e);
      return null;
    }
  }); // connected citizen record (object or null)
  const [agentUser, rawSetAgentUser] = useState(() => {
    try {
      const cached = localStorage.getItem('cmu-agent-user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn('Error parsing agentUser:', e);
      return null;
    }
  }); // connected agent record (object or null)
  const [partnerUser, rawSetPartnerUser] = useState(() => {
    try {
      const cached = localStorage.getItem('cmu-partner-user');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      console.warn('Error parsing partnerUser:', e);
      return null;
    }
  }); // connected partner record (object or null)

  const setCitizenUser = (user) => {
    rawSetCitizenUser(user);
    if (user) {
      rawSetAgentUser(null);
      rawSetPartnerUser(null);
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-partner-user');
      localStorage.removeItem('cmu-partner-token');
    }
  };

  const setAgentUser = (user) => {
    rawSetAgentUser(user);
    if (user) {
      rawSetCitizenUser(null);
      rawSetPartnerUser(null);
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-partner-user');
      localStorage.removeItem('cmu-partner-token');
    }
  };

  const setPartnerUser = (user) => {
    rawSetPartnerUser(user);
    if (user) {
      rawSetCitizenUser(null);
      rawSetAgentUser(null);
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-token');
      localStorage.removeItem('cmu-refresh-token');
    }
  };

  // Enforce session mutual exclusivity on page mount
  useEffect(() => {
    const activeMode = localStorage.getItem('cmu-portal-mode') || 'citizen';
    if (activeMode === 'citizen') {
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-partner-user');
      localStorage.removeItem('cmu-partner-token');
      rawSetAgentUser(null);
      rawSetPartnerUser(null);
    } else if (activeMode === 'agent') {
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-partner-user');
      localStorage.removeItem('cmu-partner-token');
      rawSetCitizenUser(null);
      rawSetPartnerUser(null);
    } else if (activeMode === 'partner') {
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-token');
      localStorage.removeItem('cmu-refresh-token');
      rawSetCitizenUser(null);
      rawSetAgentUser(null);
    }
  }, []);
  const [theme, setTheme] = useState(localStorage.getItem('cmu-theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile hamburger toggle state
  const [servicesTab, setServicesTab] = useState('register'); // track tab of services (register, renew, donate)
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = portalMode === 'agent' ? [
    { id: 1, type: 'complaint', title: 'Nouvelle réclamation', desc: 'Amadou Sow signale un problème de prise en charge à la polyclinique de Dakar.', time: 'Il y a 5 min' },
    { id: 2, type: 'system', title: 'Adhésion validée', desc: 'La famille Diop a été enregistrée avec succès.', time: 'Il y a 22 min' },
    { id: 3, type: 'alert', title: 'Alerte stock', desc: 'Rupture de stock signalée au point de vente Parcelles Assainies.', time: 'Il y a 2h' }
  ] : [
    { id: 4, type: 'system', title: 'Paiement reçu', desc: 'Votre cotisation annuelle (4 500 FCFA) a bien été reçue.', time: 'Aujourd\'hui, 10:30' },
    { id: 5, type: 'complaint', title: 'Mise à jour réclamation', desc: 'Votre réclamation #REC-42 est actuellement en cours de traitement.', time: 'Hier' }
  ];

  const [servicesPackage, setServicesPackage] = useState('individuel');

  const handleSetViewTab = (v, tab, pack) => {
    if (tab) setServicesTab(tab);
    if (pack) setServicesPackage(pack);
    setView(v);
    setSidebarOpen(false);
  };

  // Persist Light/Dark Theme to Document Root Element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }
    localStorage.setItem('cmu-theme', theme);
  }, [theme]);

  // Scroll to top on view change
  useEffect(() => {
    const container = document.querySelector('.view-container');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [view, servicesTab]);

  // Offline / Online status
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save citizenUser to cache
  useEffect(() => {
    if (citizenUser) {
      cacheSet('citizenUser', citizenUser)
        .catch(err => console.warn('Failed to cache citizen user:', err));
    }
  }, [citizenUser]);

  // Restore citizenUser from cache if offline and not logged in
  useEffect(() => {
    if (!citizenUser && isOffline) {
      cacheGet('citizenUser')
        .then(cached => {
          if (cached) {
            setCitizenUser(cached);
            setPortalMode('citizen');
          }
        })
        .catch(err => console.warn('Failed to load cached user:', err));
    }
  }, [isOffline, citizenUser]);

  // Déconnexion automatique en cas d'expiration de session (refresh token invalide)
  // L'événement est dispatché par le helper apiFetch quand le renouvellement échoue.
  useEffect(() => {
    const handleSessionExpired = () => {
      localStorage.removeItem('cmu-token');
      localStorage.removeItem('cmu-refresh-token');
      setCitizenUser(null);
      setAgentUser(null);
      setPortalMode('citizen');
      setView('login');
    };
    window.addEventListener('cmu-session-expired', handleSessionExpired);
    return () => window.removeEventListener('cmu-session-expired', handleSessionExpired);
  }, []);

  // Mode hors-ligne : synchronisation automatique de la file d'attente au retour de connexion.
  // Met aussi en cache les données critiques (mutuelles, carte CMU) quand en ligne.
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  useEffect(() => {
    const handleBackOnline = async () => {
      const result = await syncOutbox();
      if (result && result.synced > 0) {
        setPendingSyncCount(0);
        // Notification visuelle de synchronisation
        window.dispatchEvent(new CustomEvent('cmu-synced', { detail: result }));
      }
    };
    window.addEventListener('online', handleBackOnline);
    // Au montage, compte les actions en attente
    outboxCount().then(setPendingSyncCount);
    return () => window.removeEventListener('online', handleBackOnline);
  }, []);

  // Synchronise l'URL (hash) avec la vue courante pour le deep-linking et le back/forward navigateur.
  // - Quand `view` change, on met à jour le hash (#/beneficiaries).
  // - Quand l'utilisateur utilise back/forward (hashchange), on met à jour `view`.
  useEffect(() => {
    const currentHash = window.location.hash;
    const expectedHash = `#/${view}`;
    // Si on est en train de vérifier une carte et que le hash contient le paramètre, on ne l'écrase pas
    if (view === 'verify' && currentHash.startsWith('#/verify/')) {
      return;
    }
    if (currentHash !== expectedHash) {
      // Remplace l'entrée d'historique courante pour éviter la duplication
      window.history.replaceState(null, '', expectedHash);
    }
  }, [view]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const firstSegment = hash.split('/')[0];
      if (validViews.includes(firstSegment) && firstSegment !== view) {
        setView(firstSegment);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [view]);

  // View Router with Authentication Guards
  const renderView = () => {
    const getActiveView = () => {
      // Agent Authentication Guard
      if (portalMode === 'agent' && !agentUser && ['home', 'beneficiaries', 'depts', 'audit-logs', 'complaints'].includes(view)) {
        return (
          <Login 
            lang={lang} 
            setView={setView} 
            portalMode={portalMode} 
            setPortalMode={setPortalMode}
            setCitizenUser={setCitizenUser}
            setAgentUser={setAgentUser}
            setPartnerUser={setPartnerUser}
          />
        );
      }

      switch (view) {
        case 'home':
          return (
            <Home 
              lang={lang} 
              setView={setView} 
              setViewTab={handleSetViewTab}
              portalMode={portalMode} 
              setPortalMode={setPortalMode}
              citizenUser={citizenUser}
              setCitizenUser={setCitizenUser}
              agentUser={agentUser}
            />
          );
        case 'login':
          return (
            <Login 
              lang={lang} 
              setView={setView} 
              portalMode={portalMode} 
              setPortalMode={setPortalMode}
              setCitizenUser={setCitizenUser}
              setAgentUser={setAgentUser}
              setPartnerUser={setPartnerUser}
            />
          );
        case 'beneficiaries':
          return <Beneficiaries lang={lang} agentUser={agentUser} />;
        case 'services':
          return (
            <ServicesEnLigne 
              lang={lang} 
              initialTab={servicesTab} 
              initialPackage={servicesPackage} 
              setView={setView}
              setViewTab={handleSetViewTab}
            />
          );
        case 'map':
          return <Cartographie lang={lang} />;
        case 'directory':
          return <BaseNationale lang={lang} setView={setView} />;
        case 'depts':
          return <Departements lang={lang} />;
        case 'programmes':
          return <ProgrammesCSU lang={lang} setViewTab={handleSetViewTab} />;
        case 'about':
          return <Institutionnel lang={lang} />;
        case 'medicaments':
          return <Medicaments lang={lang} />;
        case 'audit-logs':
          if (portalMode === 'agent' && agentUser && agentUser.role === 'Super Admin') {
            return <AuditLogs lang={lang} />;
          } else {
            return (
              <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '600px', borderRadius: '16px', borderTop: '4px solid var(--danger)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⛔</div>
                <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès refusé</h2>
                <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>Seul le Super Admin est autorisé à consulter le journal d'audit complet de la plateforme.</p>
                <button className="btn btn-primary" style={{ marginTop: '1.5rem', fontWeight: 'bold' }} onClick={() => setView('home')}>
                  Retour à l'accueil
                </button>
              </div>
            );
          }
        case 'galerie':
          return <GalerieCSU lang={lang} />;
        case 'infos-csu':
          return <InfosCSU lang={lang} />;
        case 'blog-experts':
          return (
            <BlogExperts 
              lang={lang} 
              portalMode={portalMode} 
              agentUser={agentUser} 
            />
          );
        case 'parrainage-solidaire':
          return (
            <ParrainageCSU 
              lang={lang} 
              initialPackage={servicesPackage} 
              portalMode={portalMode}
              agentUser={agentUser}
              citizenUser={citizenUser}
            />
          );
         case 'partnership':
          return (
            <Partnership 
              lang={lang} 
              portalMode={portalMode} 
              agentUser={agentUser} 
            />
          );
        case 'rse':
          return <RsePortal lang={lang} setView={setView} portalMode={portalMode} agentUser={agentUser} />;
        case 'verify':
          return <VerifyCard lang={lang} />;
        case 'dashboard':
          return <AgentDashboard lang={lang} agentUser={agentUser} />;
        case 'claims':
          return (
            <Claims
              lang={lang}
              portalMode={portalMode}
              citizenUser={citizenUser}
              agentUser={agentUser}
            />
          );
        case 'notifications':
          return (
            <Notifications
              lang={lang}
              portalMode={portalMode}
              agentUser={agentUser}
            />
          );
        case 'cotisations':
          return (
            <Cotisations
              lang={lang}
              portalMode={portalMode}
              citizenUser={citizenUser}
              agentUser={agentUser}
            />
          );
        case 'partner':
          return (
            <PartnerPortal 
              lang={lang} 
              setView={setView} 
              portalMode={portalMode} 
              agentUser={agentUser}
              partnerUser={partnerUser}
              setPartnerUser={setPartnerUser}
            />
          );
        case 'regional-stats':
          return <RegionalStats lang={lang} />;
        case 'loyalty':
          return (
            <Loyalty
              lang={lang}
              citizenUser={citizenUser}
              agentUser={agentUser}
              portalMode={portalMode}
            />
          );
        case 'payments':
          return <Payments lang={lang} citizenUser={citizenUser} />;
        case 'complaints':
          return (
            <Complaints 
              lang={lang} 
              portalMode={portalMode} 
              citizenUser={citizenUser} 
              agentUser={agentUser} 
            />
          );
        case 'profile':
          return (
            <Profile
              lang={lang}
              portalMode={portalMode}
              citizenUser={citizenUser}
              agentUser={agentUser}
              partnerUser={partnerUser}
              setView={setView}
              setViewTab={handleSetViewTab}
            />
          );
        default:
          return (
            <Home 
              lang={lang} 
              setView={setView} 
              portalMode={portalMode} 
              setPortalMode={setPortalMode}
              citizenUser={citizenUser}
              setCitizenUser={setCitizenUser}
            />
          );
      }
    };

    return (
      <ErrorBoundary key={view}>
        {getActiveView()}
      </ErrorBoundary>
    );
  };

  return (
    <div className="app-layout">
      {/* Mobile Sidebar backdrop */}
      <div 
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>

      {/* Sidebar Navigation Component (Header.jsx rewritten as Sidebar) */}
      <Header 
        lang={lang} 
        setLang={setLang} 
        currentView={view} 
        setView={(v) => {
          setView(v);
          setSidebarOpen(false); // Close sidebar on mobile after clicking
        }} 
        setViewTab={handleSetViewTab} 
        servicesTab={servicesTab}
        portalMode={portalMode}
        setPortalMode={setPortalMode}
        citizenUser={citizenUser}
        setCitizenUser={setCitizenUser}
        agentUser={agentUser}
        setAgentUser={setAgentUser}
        partnerUser={partnerUser}
        setPartnerUser={setPartnerUser}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Content Workspace */}
      <div className="main-content">
        {/* Top Navbar */}
        <header className="top-navbar">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Hamburger mobile menu button */}
            <button 
              className="hamburger-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open Menu"
            >
              ☰
            </button>
            <div className="top-navbar-title">
              {view === 'home' && (
                portalMode === 'citizen'
                  ? (lang === 'fr' ? 'Portail citoyen 🇸🇳' : 'Portail citoyen')
                  : (lang === 'fr' ? 'Tableau de bord de couverture' : 'Tableau de bord')
              )}
              {view === 'login' && (lang === 'fr' ? 'Espace connexion' : 'Duggu')}
              {view === 'beneficiaries' && (lang === 'fr' ? 'Base des assurés sociaux' : 'Ñi bokk ci CMU')}
              {view === 'services' && (lang === 'fr' ? 'Espace transactionnel' : 'Mbindu ak dons')}
              {view === 'medicaments' && (lang === 'fr' ? 'Médicaments & soins pris en charge' : 'Garab ak fajj CMU')}
              {view === 'complaints' && (lang === 'fr' ? 'Registre des réclamations' : 'Réclamations')}
              {view === 'map' && (lang === 'fr' ? 'Structures de soins & cliniques' : 'Fajukaay yi')}
              {view === 'directory' && (lang === 'fr' ? 'Annuaire national des mutuelles' : 'Annuaire mutuelle yi')}
              {view === 'depts' && (lang === 'fr' ? 'Unions & statistiques' : 'Diiwaan yi')}
              {view === 'about' && (lang === 'fr' ? 'L\'union régionale (URMSCD)' : 'Union régionale')}
              {view === 'audit-logs' && (lang === 'fr' ? 'Journal d\'audit régional' : 'Registre audit')}
              {view === 'profile' && (lang === 'fr' ? 'Mon compte' : 'Sama compte')}
              {view === 'parrainage-solidaire' && (lang === 'fr' ? 'Parrainage solidaire 🤝' : 'Dimbalé (parrainage) 🤝')}
              {view === 'galerie' && (lang === 'fr' ? 'Galerie des activités CSU' : 'Natalu CSU')}
              {view === 'infos-csu' && (lang === 'fr' ? 'Informations CSU Sénégal' : 'Xibaari CSU Sénégal')}
              {view === 'blog-experts' && (lang === 'fr' ? 'Espace blog & paroles d\'experts' : 'Waxu docteur yi')}
              {view === 'partnership' && (lang === 'fr' ? 'Espace partenariat' : 'Pekou partenariat')}
              {view === 'programmes' && (lang === 'fr' ? 'Programmes CSU' : 'Përogaraam CSU')}
              {view === 'verify' && (lang === 'fr' ? 'Vérification carte CMU' : 'Saytu kàrt CMU')}
              {view === 'dashboard' && (lang === 'fr' ? 'Tableau de bord CSU' : 'Tableau CSU')}
              {view === 'claims' && (lang === 'fr' ? 'Prise en charge & remboursements' : 'Prise en charge')}
              {view === 'notifications' && (lang === 'fr' ? 'Notifications SMS / WhatsApp' : 'Notifications')}
              {view === 'cotisations' && (lang === 'fr' ? 'Suivi des cotisations' : 'Cotisation')}
              {view === 'partner' && (lang === 'fr' ? 'Espace partenaire' : 'Espace partenaire')}
              {view === 'regional-stats' && (lang === 'fr' ? 'Statistiques inter-régions' : 'Stats région')}
              {view === 'loyalty' && (lang === 'fr' ? 'Programme fidélité' : 'Fidélité')}
              {view === 'payments' && (lang === 'fr' ? 'Paiement en ligne' : 'Fay')}
            </div>
          </div>

          <div className="top-navbar-actions">
            {/* Display logged in status quick indicator */}
            {portalMode === 'citizen' && citizenUser && (
              <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                💚 {citizenUser.firstName} {citizenUser.lastName} (Connecté)
              </span>
            )}

            {portalMode === 'agent' && agentUser && (
              <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)' }}>
                💼 {agentUser.firstName} {agentUser.lastName} (Agent)
              </span>
            )}

            {/* Offline Indicator */}
            {isOffline && (
              <span className="badge badge-danger" style={{ fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'var(--danger)', color: '#fff', animation: 'pulse 2s infinite' }}>
                ⚠️ Mode Hors Ligne
              </span>
            )}

            {/* Quick theme toggle */}
            <button 
              className="top-navbar-icon-btn" 
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
              style={{ fontSize: '1.15rem' }}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>

            {/* Language Selection Quick Switch */}
            <button 
              className="top-navbar-icon-btn" 
              onClick={() => setLang(l => l === 'fr' ? 'wo' : 'fr')}
              title={lang === 'fr' ? 'Changer de langue (Wolof)' : 'Changer de langue (Français)'}
              style={{ fontSize: '0.75rem', fontWeight: 'bold' }}
            >
              {lang === 'fr' ? 'WO' : 'FR'}
            </button>
            {/* Search Input Bar */}
            <div className="top-navbar-search">
              <span>🔍</span>
              <input 
                type="text" 
                className="top-navbar-search-input" 
                placeholder={lang === 'fr' ? 'Rechercher un bénéficiaire...' : 'Seet ci tour...'}
                onClick={() => setView(portalMode === 'agent' ? 'beneficiaries' : 'services')}
                onChange={() => setView(portalMode === 'agent' ? 'beneficiaries' : 'services')}
              />
            </div>

            {/* Notifications Alert Icon & Dropdown */}
            <div style={{ position: 'relative' }}>
              <button 
                className="top-navbar-icon-btn" 
                aria-label="Notifications" 
                onClick={() => setShowNotifications(!showNotifications)}
              >
                🔔
                {notifications.length > 0 && <span className="top-navbar-dot"></span>}
              </button>
              
              {showNotifications && (
                <div style={{
                  position: 'absolute',
                  top: '120%',
                  right: 0,
                  width: '320px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 1000,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Notifications</h4>
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{notifications.length} nouvelles</span>
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <p style={{ padding: '1rem', textAlign: 'center', margin: 0, fontSize: '0.85rem' }}>Aucune notification.</p>
                    ) : (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          style={{ 
                            padding: '1rem', 
                            borderBottom: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          onClick={() => {
                            if (notif.type === 'complaint') setView('complaints');
                            setShowNotifications(false);
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.25rem' }}>
                              {notif.type === 'complaint' ? '📝' : notif.type === 'alert' ? '⚠️' : '✅'}
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                              <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{notif.title}</h5>
                              <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', color: 'var(--text-sub)' }}>{notif.desc}</p>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{notif.time}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {agentUser && agentUser.role === 'Super Admin' && (
                    <div 
                      style={{ padding: '0.75rem', textAlign: 'center', backgroundColor: 'var(--bg-card-subtle)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}
                      onClick={() => {
                        setView('audit-logs');
                        setShowNotifications(false);
                      }}
                    >
                      Voir tout l'historique
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Current View Wrapper */}
        <div className="view-container">
          {renderView()}

          {/* Global Footer */}
          <footer style={{
            marginTop: 'auto',
            paddingTop: '3rem',
            paddingBottom: '1rem',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}>
            <p style={{ margin: 0 }}>
              &copy; {new Date().getFullYear()} MUTUALIS. Solution développée par <a href="https://www.senecarte.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>Sen-E-Carte</a>. 
              {' '}&bull; Contact développeur : <a href="tel:+221776026783" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>77 602 67 83</a>
            </p>
          </footer>
        </div>
      </div>

      {/* Accessibility Voice Reader (Bottom Left Float) */}
      <AudioReader lang={lang} />

      {/* Intelligent Chatbot (Bottom Right Float) */}
      <ChatbotWidget lang={lang} setView={setView} />
    </div>
  );
}
