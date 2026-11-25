import { useState, useEffect, Component, lazy, Suspense } from 'react';
import Header from './components/Header';
import ChatbotWidget from './components/ChatbotWidget';
import AudioReader from './components/AudioReader';
import MobileTabBar from './components/MobileTabBar';
import MaintenanceScreen from './components/MaintenanceScreen';
import NotFound from './components/NotFound';

// Import Views
import Home from './views/Home';
const Institutionnel = lazy(() => import('./views/Institutionnel'));
const Departements = lazy(() => import('./views/Departements'));
const Cartographie = lazy(() => import('./views/Cartographie'));
const BaseNationale = lazy(() => import('./views/BaseNationale'));
const ServicesEnLigne = lazy(() => import('./views/ServicesEnLigne'));
const Beneficiaries = lazy(() => import('./views/Beneficiaries'));
const Login = lazy(() => import('./views/Login'));
const Medicaments = lazy(() => import('./views/Medicaments'));
const AuditLogs = lazy(() => import('./views/AuditLogs'));
const Complaints = lazy(() => import('./views/Complaints'));
const Profile = lazy(() => import('./views/Profile'));
const ProgrammesCSU = lazy(() => import('./views/ProgrammesCSU'));
const GalerieCSU = lazy(() => import('./views/GalerieCSU'));
const InfosCSU = lazy(() => import('./views/InfosCSU'));
const BlogExperts = lazy(() => import('./views/BlogExperts'));
const ParrainageCSU = lazy(() => import('./views/ParrainageCSU'));
const Partnership = lazy(() => import('./views/Partnership'));
const VerifyCard = lazy(() => import('./views/VerifyCard'));
const AgentDashboard = lazy(() => import('./views/AgentDashboard'));
const Claims = lazy(() => import('./views/Claims'));
const Notifications = lazy(() => import('./views/Notifications'));
const Cotisations = lazy(() => import('./views/Cotisations'));
const PartnerPortal = lazy(() => import('./views/PartnerPortal'));
const RegionalStats = lazy(() => import('./views/RegionalStats'));
const Loyalty = lazy(() => import('./views/Loyalty'));
const Payments = lazy(() => import('./views/Payments'));
const RsePortal = lazy(() => import('./views/RsePortal'));
const GuaranteeLetters = lazy(() => import('./views/GuaranteeLetters'));
const PurchaseOrders = lazy(() => import('./views/PurchaseOrders'));
const Telemedicine = lazy(() => import('./views/Telemedicine'));
const MedicalProfile = lazy(() => import('./views/MedicalProfile'));
const MaternalHealth = lazy(() => import('./views/MaternalHealth'));
const InstitutionPortal = lazy(() => import('./views/InstitutionPortal'));
const SuperAdminGovernance = lazy(() => import('./views/SuperAdminGovernance'));
const CardStudio = lazy(() => import('./views/CardStudio'));
const AccountsAndCards = lazy(() => import('./views/AccountsAndCards'));
const SecurityCenter = lazy(() => import('./views/SecurityCenter'));
const ExcelReports = lazy(() => import('./views/ExcelReports'));
const ImportControl = lazy(() => import('./views/ImportControl'));
import { syncOutbox, outboxCount, cacheSet, cacheGet } from './utils/offline';
import ProIcon from './components/ProIcon';

// Import Styles
import './index.css';
import './styles/components.css';
import './styles/views.css';
// Socle utilitaire (compatibilité Bootstrap 5) — DOIT rester en dernier
// pour pouvoir corriger les correctifs !important hérités de index.css.
import './styles/utilities.css';

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
    fetch(`${window.API_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message || 'Unknown render error', stack: error.stack || '' })
    }).catch(() => {});
  }
  render() {
    if (this.state.hasError) {
      // Le message technique est DÉROULABLE : un utilisateur qui signale un
      // bug peut copier le détail sans qu'il soit exposé à la première vue.
      // Avant, la stack s'affichait en gros sur tous les écrans, y compris
      // devant l'assuré — mauvais pour la confiance, inutile pour lui.
      return (
        <div className="card text-center" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '640px', borderRadius: '24px', borderLeft: '6px solid var(--danger)', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: '0.75rem' }}><ProIcon name="wrench" /></div>
          <h2 style={{ color: 'var(--danger)', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.6rem' }}>
            Une erreur inattendue est survenue
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-sub)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Cette section n'a pas pu s'afficher. Vos autres données restent accessibles.
            L'incident a été automatiquement signalé à l'équipe technique.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <button
              className="btn btn-primary fw-bold px-4 py-2.5"
              style={{ borderRadius: '12px', background: '#059669', border: 'none' }}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <ProIcon name="refresh" /> Réessayer
            </button>
            <button
              className="btn btn-outline-secondary fw-bold px-4 py-2.5"
              style={{ borderRadius: '12px' }}
              onClick={() => { window.location.hash = '#home'; window.location.reload(); }}
            >
              <ProIcon name="home" /> Retour à l'accueil
            </button>
          </div>
          <details style={{ textAlign: 'left' }}>
            <summary style={{ fontSize: '0.8rem', color: 'var(--text-sub)', cursor: 'pointer', userSelect: 'none' }}>
              Détails techniques (pour le signalement)
            </summary>
            <pre style={{
              background: 'var(--bg-card-subtle)', padding: '1rem', borderRadius: '8px',
              overflowX: 'auto', fontSize: '0.75rem', fontFamily: 'monospace',
              color: 'var(--text-main)', border: '1px solid var(--border-color)',
              marginTop: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
            }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Expiration des sessions locales ──
// Sans cela, la dernière session (ex. Super Admin de démonstration) était
// restaurée silencieusement à CHAQUE rechargement, même après plusieurs jours :
// l'usager croyait être « non connecté » alors que l'application le considérait
// authentifié — d'où l'affichage de données sensibles. Une session inactive
// depuis plus de 12 h est désormais purgée au démarrage.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const isSessionFresh = () => {
  try {
    const ts = Number(localStorage.getItem('cmu-session-ts') || 0);
    return ts > 0 && (Date.now() - ts) < SESSION_TTL_MS;
  // eslint-disable-next-line no-unused-vars -- session illisible = session invalide : le garde-fou est volontaire.
  } catch (e) {
    return false;
  }
};
const purgeStaleSessions = () => {
  try {
    if (!isSessionFresh()) {
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-partner-user');
    } else if (localStorage.getItem('cmu-agent-user') && !localStorage.getItem('cmu-token')) {
      // Empêcher une session fantôme agent/Super Admin sans jeton JWT valide
      localStorage.removeItem('cmu-agent-user');
    }
    // eslint-disable-next-line no-unused-vars -- purge best-effort : un stockage indisponible ne doit pas empêcher le rendu.
  } catch (e) {}
};
purgeStaleSessions();

export default function App() {
  // Liste des vues valides (pour valider le hash URL)
  const validViews = ['home','login','beneficiaries','services','map','directory','depts','programmes','about','medicaments','audit-logs','galerie','infos-csu','blog-experts','parrainage-solidaire','partnership','complaints','profile','verify','dashboard','claims','notifications','cotisations','partner','regional-stats','loyalty','payments','guarantees','purchase-orders','telemedicine','medical-profile','maternity','superadmin-governance','rse','institution-coud','card-studio','security-center','excel-reports','accounts-cards','import-control'];

  // Initialise la vue depuis le hash URL (#/beneficiaries) pour le deep-linking.
  // Un hash inconnu n'est PLUS silencieusement remplacé par l'accueil : il est
  // conservé dans `unknownView` et la page 404 s'affiche — l'utilisateur voit
  // ainsi pourquoi son lien ne fonctionne pas (favori périmé, QR code obsolète).
  const extractRouteSegment = () => {
    const hash = (window.location.hash || '').replace(/^#\/?/, '');
    if (hash) {
      return hash.split('?')[0].split('/')[0];
    }
    const pathname = (window.location.pathname || '').replace(/^\/+/, '');
    if (pathname.startsWith('verify')) {
      return 'verify';
    }
    return '';
  };

  const [unknownView, setUnknownView] = useState(() => {
    const firstSegment = extractRouteSegment();
    return validViews.includes(firstSegment) ? null : (firstSegment || null);
  });

  const initialViewFromHash = () => {
    const firstSegment = extractRouteSegment();
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
      localStorage.setItem('cmu-citizen-user', JSON.stringify(user));
      localStorage.setItem('cmu-portal-mode', 'citizen');
      localStorage.setItem('cmu-session-ts', String(Date.now()));
      rawSetAgentUser(null);
      rawSetPartnerUser(null);
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-partner-user');
    }
  };

  const setAgentUser = (user) => {
    rawSetAgentUser(user);
    if (user) {
      localStorage.setItem('cmu-agent-user', JSON.stringify(user));
      localStorage.setItem('cmu-session-ts', String(Date.now()));
      const mode = (user.role && (user.role.toLowerCase().includes('admin') || user.role.toLowerCase().includes('super'))) ? 'superadmin' : 'agent';
      localStorage.setItem('cmu-portal-mode', mode);
      rawSetCitizenUser(null);
      rawSetPartnerUser(null);
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-partner-user');
    }
  };

  const setPartnerUser = (user) => {
    rawSetPartnerUser(user);
    if (user) {
      localStorage.setItem('cmu-partner-user', JSON.stringify(user));
      localStorage.setItem('cmu-session-ts', String(Date.now()));
      localStorage.setItem('cmu-portal-mode', 'partner');
      rawSetCitizenUser(null);
      rawSetAgentUser(null);
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-agent-user');
    }
  };

  // Persistance continue & garde de session au rafraichissement de page (F5).
  // L'horodatage est rafraîchi à chaque visite : la session expire seulement
  // après 12 h d'inactivité (expiration glissante).
  useEffect(() => {
    if (!isSessionFresh()) {
      localStorage.removeItem('cmu-agent-user');
      localStorage.removeItem('cmu-citizen-user');
      localStorage.removeItem('cmu-partner-user');
      return;
    }
    localStorage.setItem('cmu-session-ts', String(Date.now()));

    try {
      const storedCitizen = localStorage.getItem('cmu-citizen-user');
      if (storedCitizen && !citizenUser) {
        rawSetCitizenUser(JSON.parse(storedCitizen));
      }
    // eslint-disable-next-line no-unused-vars -- session illisible : on l'ignore plutôt que de purger l'écran (garde existant).
    } catch (e) {}

    try {
      const storedAgent = localStorage.getItem('cmu-agent-user');
      if (storedAgent && !agentUser) {
        rawSetAgentUser(JSON.parse(storedAgent));
      }
    // eslint-disable-next-line no-unused-vars -- session illisible : on l'ignore plutôt que de purger l'écran (garde existant).
    } catch (e) {}

    try {
      const storedPartner = localStorage.getItem('cmu-partner-user');
      if (storedPartner && !partnerUser) {
        rawSetPartnerUser(JSON.parse(storedPartner));
      }
    // eslint-disable-next-line no-unused-vars -- session illisible : on l'ignore plutôt que de purger l'écran (garde existant).
    } catch (e) {}

    const storedMode = localStorage.getItem('cmu-portal-mode');
    if (storedMode && storedMode !== portalMode) {
      setPortalMode(storedMode);
    }
  }, [view]);

  // Dynamic document title update for SPA SEO and usability
  useEffect(() => {
    const titles = {
      fr: {
        home: 'Accueil - SenMutuelles',
        login: 'Connexion - SenMutuelles',
        beneficiaries: 'Bénéficiaires & Affiliations - SenMutuelles',
        services: 'Services en ligne - SenMutuelles',
        map: 'Cartographie sanitaire & structures de santé - SenMutuelles',
        directory: 'Annuaire des structures sanitaires - SenMutuelles',
        depts: 'Unions & Mutuelles de Dakar - SenMutuelles',
        programmes: 'Programmes & Offres - SenMutuelles',
        about: 'À propos - SenMutuelles',
        medicaments: 'Recherche de médicaments - SenMutuelles',
        galerie: 'Galerie média - SenMutuelles',
        'infos-csu': 'Informations CSU & Couverture Maladie - SenMutuelles',
        'blog-experts': 'Espace Blog & Experts - SenMutuelles',
        'parrainage-solidaire': 'Parrainage en masse - SenMutuelles',
        partnership: 'Espace Partenariat - SenMutuelles',
        complaints: 'Réclamations & Plaintes - SenMutuelles',
        profile: 'Profil utilisateur - SenMutuelles',
        verify: 'Vérification d\'affiliation - SenMutuelles',
        dashboard: 'Tableau de bord Agent - SenMutuelles',
        claims: 'Gestion des sinistres - SenMutuelles',
        notifications: 'Alertes & Notifications - SenMutuelles',
        cotisations: 'Cotisations & Paiements - SenMutuelles',
        partner: 'Portail Partenaire - SenMutuelles',
        'regional-stats': 'Statistiques Régionales - SenMutuelles',
        loyalty: 'Programme fidélité - SenMutuelles',
        payments: 'Paiements - SenMutuelles',
        guarantees: 'Lettres de Garantie - SenMutuelles',
        'purchase-orders': 'Bons de Commande Pharmacie - SenMutuelles',
        telemedicine: 'Télémédecine & Téléconsultation - SenMutuelles',
        'medical-profile': 'Dossier Médical & Antécédents - SenMutuelles',
        maternity: 'Pôle Spécialités Médicales & Pathologies - SenMutuelles',
        'institution-coud': 'Portail Institutionnel COUD UCAD - SenMutuelles'
      },
      wo: {
        home: 'Kër - SenMutuelles',
        login: 'Duggal - SenMutuelles',
        beneficiaries: 'Bénéficiaires & Affiliations - SenMutuelles',
        services: 'Services en ligne - SenMutuelles',
        map: 'Cartographie sanitaire - SenMutuelles',
        directory: 'Annuaire - SenMutuelles',
        depts: 'Unions & Mutuelles - SenMutuelles',
        about: 'À propos - SenMutuelles',
        partnership: 'Partenariat - SenMutuelles'
      }
    };
    const defaultTitle = 'SenMutuelles — Portail de la Mutualité de Santé Communautaire';
    const langTitles = titles[lang] || titles.fr;
    document.title = langTitles[view] || defaultTitle;
  }, [view, lang]);

  const [theme, setTheme] = useState(localStorage.getItem('cmu-theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile hamburger toggle state
  const [servicesTab, setServicesTab] = useState('register'); // track tab of services (register, renew, donate)
  const [showNotifications, setShowNotifications] = useState(false);

  // Notifications RÉELLES : fil calculé par le backend selon le profil connecté
  // (citoyen : ses dossiers ; agent : sa MSD ; Super Admin : toutes les MSD).
  // Aucune donnée fictive : visiteur non connecté = liste vide.
  const notifUserKey = portalMode === 'agent'
    ? (agentUser ? `agent-${agentUser.id || agentUser.username}` : null)
    : (citizenUser ? `citizen-${citizenUser.id || citizenUser.cmuNumber}` : null);
  // Le fil reçu est rattaché à l'utilisateur qui l'a demandé : un changement
  // de compte n'affiche jamais les notifications du précédent.
  const [notifFeed, setNotifFeed] = useState({ key: null, items: [], fetchedAt: 0 });
  const notifications = notifUserKey && notifFeed.key === notifUserKey ? notifFeed.items : [];
  const [notifSeen, setNotifSeen] = useState({ key: null, at: 0 });
  const notifSeenAt = !notifUserKey ? 0
    : (notifSeen.key === notifUserKey ? notifSeen.at : Number(localStorage.getItem(`cmu-notif-seen-${notifUserKey}`) || 0));

  useEffect(() => {
    if (!notifUserKey) return undefined;
    let cancelled = false;
    const load = () => {
      const token = localStorage.getItem('cmu-token');
      if (!token) return;
      fetch(`${window.API_BASE_URL || ''}/api/notifications/feed`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((payload) => {
          if (cancelled) return;
          const data = Array.isArray(payload) ? payload : (payload.data || []);
          setNotifFeed({ key: notifUserKey, items: data, fetchedAt: Date.now() });
        })
        .catch(() => { /* hors ligne : on conserve la dernière liste reçue */ });
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [notifUserKey]);

  const unreadNotifications = notifications.filter((n) => new Date(n.at).getTime() > notifSeenAt).length;
  const formatNotifTime = (at) => {
    const d = new Date(at);
    if (Number.isNaN(d.getTime())) return '';
    // Référence = heure de réception du fil (rendu pur, rafraîchi chaque minute)
    const diffMin = Math.round(((notifFeed.fetchedAt || d.getTime()) - d.getTime()) / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffMin < 1440) return `Il y a ${Math.round(diffMin / 60)} h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const toggleNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next && notifUserKey) {
      const now = Date.now();
      localStorage.setItem(`cmu-notif-seen-${notifUserKey}`, String(now));
      setNotifSeen({ key: notifUserKey, at: now });
    }
  };

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

  // Mode maintenance : déclenché par apiFetch quand une requête reçoit
  // 503 { error: 'MAINTENANCE' }. On affiche l'écran dédié (pas une erreur
  // générique) avec le message de l'admin, et le bouton « Réessayer »
  // relance la page — le retour du service est ainsi immédiat.
  const [maintenanceInfo, setMaintenanceInfo] = useState(null);

  useEffect(() => {
    const handleMaintenance = (e) => {
      setMaintenanceInfo({
        message: e.detail?.message || null,
        since: e.detail?.since || null
      });
    };
    window.addEventListener('cmu-maintenance', handleMaintenance);
    return () => window.removeEventListener('cmu-maintenance', handleMaintenance);
  }, []);

  // Mode hors-ligne : synchronisation automatique de la file d'attente au retour de connexion.
  // Met aussi en cache les données critiques (mutuelles, carte CMU) quand en ligne.
  // eslint-disable-next-line no-unused-vars -- compteur d'attente synchronisé (outbox) mais pas encore rendu : l'état et son setter restent en place.
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
  // (déclarés AVANT les rendus conditionnels : les hooks ne doivent jamais
  // suivre un return conditionnel, sinon React déclenche une erreur d'ordre.)
  useEffect(() => {
    const currentHash = window.location.hash;
    const expectedHash = `#/${view}`;
    // Si on est en train de vérifier une carte (via #/verify/..., #verify/..., #/verify?... ou /verify/...), on ne l'écrase jamais
    if (
      view === 'verify' &&
      (/^#\/?verify(\/|\?)/i.test(currentHash) || /^\/verify\//i.test(window.location.pathname || ''))
    ) {
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
      const firstSegment = hash.split('?')[0].split('/')[0];
      if (!validViews.includes(firstSegment)) {
        // Vue inconnue → page 404 (au lieu d'un retour silencieux à l'accueil).
        setUnknownView(firstSegment || null);
        return;
      }
      if (unknownView) setUnknownView(null);
      if (firstSegment !== view) {
        setView(firstSegment);
        setSidebarOpen(false);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [view]);

  // RENDUS CONDITIONNELS (tous les hooks ont été appelés ci-dessus — les
  // returns conditionnels doivent venir APRÈS la déclaration de tous les
  // hooks, sinon React déclenche une erreur de hooks conditionnels).

  // Mode maintenance : écran dédié (pas une erreur générique).
  if (maintenanceInfo) {
    return (
      <MaintenanceScreen
        message={maintenanceInfo.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // Page 404 : hash inconnu (lien périmé, faute de frappe, QR obsolète).
  // Un wrapper sur setView purge `unknownView` dès que l'utilisateur choisit
  // une destination — sinon la 404 resterait collée à l'écran.
  if (unknownView) {
    const navigateFrom404 = (v) => {
      setUnknownView(null);
      setView(v);
    };
    return (
      <div className="app-layout">
        <Header
          lang={lang}
          setLang={setLang}
          currentView={view}
          setView={navigateFrom404}
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
        <div className="main-content">
          <div className="view-container">
            <NotFound requestedView={unknownView} setView={navigateFrom404} />
          </div>
        </div>
      </div>
    );
  }

  // Mode hors-ligne : synchronisation automatique de la file d'attente au retour de connexion.
  // Met aussi en cache les données critiques (mutuelles, carte CMU) quand en ligne.
  // (hooks déclarés plus haut, avant les rendus conditionnels)

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

      // 🔒 Garde données sensibles : ces vues affichent des données d'assurés
      // (noms, dossiers médicaux, montants, encaissements) ou d'administration —
      // elles exigent une session authentifiée (citoyen, agent ou partenaire).
      // Sans connexion, on redirige vers la page de connexion.
      const SENSITIVE_DATA_VIEWS = [
        'guarantees',
        'purchase-orders',
        'telemedicine',
        'medical-profile',
        'maternity',
        'partner',
        'security-center',
        'accounts-cards',
        'excel-reports',
        'import-control',
      ];
      if (SENSITIVE_DATA_VIEWS.includes(view) && !citizenUser && !agentUser && !partnerUser) {
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
          return <BaseNationale lang={lang} setView={setView} setViewTab={handleSetViewTab} />;
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
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="ban" color="#dc2626" /></div>
                <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès refusé</h2>
                <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>Seul le super admin est autorisé à consulter le journal d'audit complet de la plateforme.</p>
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
              partnerUser={partnerUser}
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
          return <VerifyCard lang={lang} setView={setView} citizenUser={citizenUser} setCitizenUser={setCitizenUser} />;
        case 'dashboard':
          if (!agentUser && portalMode !== 'agent' && portalMode !== 'superadmin') {
            return (
              <div className="container py-5 text-center">
                <div className="card shadow-lg border-0 p-5 mx-auto" style={{ maxWidth: '500px', borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="shield-check" /></div>
                  <h4 className="fw-bold mb-2">Accès restreint : espace agent & administration</h4>
                  <p className="small text-muted mb-4">Cette section est réservée aux agents mutualistes et administrateurs d'unions régionales (URMSCD).</p>
                  <button
                    className="btn btn-primary fw-bold py-2 px-4 text-white"
                    style={{ borderRadius: '12px' }}
                    onClick={() => {
                      setPortalMode('agent');
                      setView('login');
                    }}
                  >
                    <ProIcon name="lock" /> Se connecter comme agent
                  </button>
                </div>
              </div>
            );
          }
          return <AgentDashboard lang={lang} agentUser={agentUser} setView={setView} />;
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
          return (
            <Payments
              lang={lang}
              citizenUser={citizenUser}
              agentUser={agentUser}
              portalMode={portalMode}
              setView={setView}
            />
          );
        case 'complaints':
          return (
            <Complaints
              lang={lang}
              portalMode={portalMode}
              citizenUser={citizenUser}
              agentUser={agentUser}
              partnerUser={partnerUser}
            />
          );
        case 'superadmin-governance': {
          // 🔒 Garde d'accès : la Gouvernance Super Admin (comptes, KPI,
          // habilitations) est réservée au Super Administrateur authentifié.
          const isSuperAdmin = agentUser && (agentUser.role === 'Super Admin' || agentUser.role === 'SuperAdmin');
          if (isSuperAdmin) {
            return (
              <SuperAdminGovernance
                lang={lang}
                setView={setView}
                agentUser={agentUser}
                citizenUser={citizenUser}
                partnerUser={partnerUser}
              />
            );
          }
          return (
            <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '600px', borderRadius: '16px', borderTop: '4px solid var(--danger)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="ban" color="#dc2626" /></div>
              <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès réservé au super admin</h2>
              <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>
                Le tableau de bord de gouvernance (comptes utilisateurs, statistiques financières, habilitations médicales)
                n'est accessible qu'après authentification avec un compte super administrateur (anacsu / Ministère).
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ fontWeight: 'bold' }}
                  onClick={() => { setPortalMode('agent'); setView('login'); }}
                >
                  <ProIcon name="lock" /> Se connecter en super admin
                </button>
                <button className="btn btn-outline" style={{ fontWeight: 'bold' }} onClick={() => setView('home')}>
                  Retour à l'accueil
                </button>
              </div>
            </div>
          );
        }
        case 'accounts-cards': {
          // 🗂️ Gestion des comptes et des cartes (Module 3.9) : agent & admin.
          if (portalMode === 'agent' && agentUser && (agentUser.role === 'agent' || agentUser.role === 'admin' || agentUser.role === 'Super Admin')) {
            return <AccountsAndCards lang={lang} agentUser={agentUser} setView={setView} />;
          }
          return (
            <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '700px', borderRadius: '16px', borderTop: '4px solid var(--danger)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="archive" /></div>
              <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès réservé à l'administration</h2>
              <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>
                La gestion des comptes et des cartes est réservée aux agents MSD et administrateurs habilités.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary fw-bold py-2 px-4 text-white" style={{ borderRadius: '12px' }} onClick={() => { setPortalMode('agent'); setView('login'); }}>
                  <ProIcon name="lock" /> Se connecter en agent
                </button>
                <button className="btn btn-outline" style={{ fontWeight: 'bold' }} onClick={() => setView('home')}>
                  Retour à l'accueil
                </button>
              </div>
            </div>
          );
        }
        case 'security-center': {
          // 🔒 Centre de sécurité : confinement MSD + audit_logs côté serveur.
          // Seuls agent & admin (Super Admin) peuvent y accéder.
          if (portalMode === 'agent' && agentUser && (agentUser.role === 'agent' || agentUser.role === 'admin' || agentUser.role === 'Super Admin')) {
            return (
              <SecurityCenter
                lang={lang}
                agentUser={agentUser}
                citizenUser={citizenUser}
                setView={setView}
                setViewTab={handleSetViewTab}
              />
            );
          }
          return (
            <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '700px', borderRadius: '16px', borderTop: '4px solid var(--danger)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="shield-check" /></div>
              <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès réservé à l'administration</h2>
              <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>
                Le centre de sécurité est accessible par les agents et administrateurs de l'union régionale (URMSCD).
                Super admin : vous pouvez aussi utiliser la gouvernance super admin.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary fw-bold py-2 px-4 text-white"
                  style={{ borderRadius: '12px' }}
                  onClick={() => {
                    setPortalMode('agent');
                    setView('login');
                  }}
                >
                  <ProIcon name="lock" /> Se connecter en agent
                </button>
                <button className="btn btn-outline" style={{ fontWeight: 'bold' }} onClick={() => setView('home')}>
                  Retour à l'accueil
                </button>
              </div>
            </div>
          );
        }
        case 'import-control': {
          // 📥 Importation contrôlée (Module 2) : aucune écriture avant
          // prévisualisation + validation explicite. Réservé aux agents/admins.
          if (portalMode === 'agent' && agentUser && (agentUser.role === 'agent' || agentUser.role === 'admin' || agentUser.role === 'Super Admin')) {
            return <ImportControl lang={lang} agentUser={agentUser} setView={setView} setViewTab={handleSetViewTab} />;
          }
          return <Login lang={lang} setView={setView} portalMode={portalMode} setPortalMode={setPortalMode} setCitizenUser={setCitizenUser} setAgentUser={setAgentUser} setPartnerUser={setPartnerUser} />;
        }
        case 'excel-reports': {
          // 📊 Rapports Excel : export au format .xlsx (bénéficiaires, cartes, production, audit).
          // Disponible pour agent, admin et Super Admin.
          if (portalMode === 'agent' && agentUser && (agentUser.role === 'agent' || agentUser.role === 'admin' || agentUser.role === 'Super Admin')) {
            return <ExcelReports lang={lang} agentUser={agentUser} setView={setView} setViewTab={handleSetViewTab} />;
          }
          return (
            <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '700px', borderRadius: '16px', borderTop: '4px solid var(--danger)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="bar-chart" /></div>
              <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès réservé à l'administration</h2>
              <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>
                Les rapports Excel sont générés côté serveur (backend) et exportés en fichier .XLSX cloisonné par MSD.
                Disponibles pour les agents, administrateurs et super admin.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary fw-bold py-2 px-4 text-white"
                  style={{ borderRadius: '12px' }}
                  onClick={() => {
                    setPortalMode('agent');
                    setView('login');
                  }}
                >
                  <ProIcon name="lock" /> Se connecter en agent
                </button>
                <button className="btn btn-outline" style={{ fontWeight: 'bold' }} onClick={() => setView('home')}>
                  Retour à l'accueil
                </button>
              </div>
            </div>
          );
        }
        case 'profile':
          return (
            <Profile
              lang={lang}
              portalMode={portalMode}
              setPortalMode={setPortalMode}
              citizenUser={citizenUser}
              setCitizenUser={setCitizenUser}
              agentUser={agentUser}
              setAgentUser={setAgentUser}
              partnerUser={partnerUser}
              setPartnerUser={setPartnerUser}
              setView={setView}
              setViewTab={handleSetViewTab}
            />
          );
        case 'guarantees':
          return (
            <GuaranteeLetters 
              lang={lang} 
              userRole={portalMode} 
              citizenUser={citizenUser} 
              agentUser={agentUser} 
              partnerUser={partnerUser} 
              setView={setView} 
            />
          );
        case 'purchase-orders':
          return (
            <PurchaseOrders 
              lang={lang} 
              userRole={portalMode} 
              citizenUser={citizenUser} 
              agentUser={agentUser} 
              partnerUser={partnerUser} 
              setView={setView} 
            />
          );
        case 'telemedicine':
          return (
            <Telemedicine 
              lang={lang} 
              userRole={portalMode} 
              citizenUser={citizenUser} 
              agentUser={agentUser} 
              partnerUser={partnerUser} 
              setView={setView} 
            />
          );
        case 'medical-profile':
          return <MedicalProfile lang={lang} userRole={portalMode} citizenUser={citizenUser} agentUser={agentUser} partnerUser={partnerUser} setView={setView} />;
        case 'maternity':
          return <MaternalHealth lang={lang} userRole={portalMode} citizenUser={citizenUser} agentUser={agentUser} partnerUser={partnerUser} setView={setView} />;
        case 'institution-coud':
          return <InstitutionPortal lang={lang} portalMode={portalMode} agentUser={agentUser} setView={setView} />;
        case 'card-studio':
          if ((portalMode === 'agent' || portalMode === 'superadmin') && agentUser && agentUser.role === 'Super Admin') {
            return <CardStudio lang={lang} />;
          } else {
            return (
              <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '600px', borderRadius: '16px', borderTop: '4px solid var(--danger)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}><ProIcon name="ban" color="#dc2626" /></div>
                <h2 style={{ color: 'var(--danger)', fontWeight: '850' }}>Accès réservé au super admin</h2>
                <p style={{ color: 'var(--text-sub)', marginTop: '0.5rem' }}>Le studio de conception et d'impression des cartes d'assurés CSU est strictement réservé à la gouvernance super admin.</p>
                <button className="btn btn-primary" style={{ marginTop: '1.5rem', fontWeight: 'bold' }} onClick={() => setView('home')}>
                  Retour à l'accueil
                </button>
              </div>
            );
          }
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
              <ProIcon name="menu" />
            </button>
            <div className="top-navbar-title">
              {view === 'home' && (
                portalMode === 'citizen'
                  ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>Portail citoyen <ProIcon name="senegal-flag" size={15} /></span>)
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
              {view === 'parrainage-solidaire' && (lang === 'fr' ? 'Parrainage solidaire' : 'Dimbalé (parrainage) 🤝')}
              {view === 'galerie' && (lang === 'fr' ? 'Galerie des activités CSU' : 'Natalu CSU')}
              {view === 'infos-csu' && (lang === 'fr' ? 'Informations CSU Sénégal' : 'Xibaari CSU Sénégal')}
              {view === 'blog-experts' && (lang === 'fr' ? 'Espace blog & paroles d\'experts' : 'Waxu docteur yi')}
              {view === 'partnership' && (lang === 'fr' ? 'Espace partenariat' : 'Pekou partenariat')}
              {view === 'programmes' && (lang === 'fr' ? 'Programmes CSU' : 'Përogaraam CSU')}
              {view === 'verify' && (lang === 'fr' ? 'Vérification carte CSU' : 'Saytu kàrt CSU')}
              {view === 'dashboard' && (lang === 'fr' ? 'Tableau de bord CSU' : 'Tableau CSU')}
              {view === 'claims' && (lang === 'fr' ? 'Prise en charge & remboursements' : 'Prise en charge')}
              {view === 'notifications' && (lang === 'fr' ? 'Notifications SMS / WhatsApp' : 'Notifications')}
              {view === 'cotisations' && (lang === 'fr' ? 'Suivi des cotisations' : 'Cotisation')}
              {view === 'partner' && (lang === 'fr' ? 'Espace partenaire' : 'Espace partenaire')}
              {view === 'regional-stats' && (lang === 'fr' ? 'Statistiques inter-régions' : 'Stats région')}
              {view === 'loyalty' && (lang === 'fr' ? 'Programme fidélité' : 'Fidélité')}
              {view === 'payments' && (lang === 'fr' ? 'Paiement en ligne' : 'Fay')}
              {view === 'superadmin-governance' && (lang === 'fr' ? 'Gouvernance & Supervision Super Admin' : 'Gouvernance Super Admin 👑')}
              {view === 'guarantees' && (lang === 'fr' ? 'Lettres de garantie & prises en charge (80%)' : 'Bataaxalu garantie')}
              {view === 'purchase-orders' && (lang === 'fr' ? 'Bons de commande pharmacie (50%)' : 'Bonu garab pharmacie')}
              {view === 'telemedicine' && (lang === 'fr' ? 'Télémédecine & consultations vidéo' : 'Téléconsultation')}
              {view === 'medical-profile' && (lang === 'fr' ? 'Dossier médical partagé (DMP)' : 'Dossier médical')}
              {view === 'maternity' && (lang === 'fr' ? 'Suivi maternité & CPN' : 'Maternité & CPN')}
              {view === 'rse' && (lang === 'fr' ? 'Partenariats RSE & mécénat' : 'RSE & mécénat')}
              {view === 'institution-coud' && (lang === 'fr' ? 'Guichet institutionnel COUD / UCAD' : 'COUD / UCAD')}
              {view === 'card-studio' && (lang === 'fr' ? 'Studio d\'impression des cartes CSU' : 'Studio cartes CSU')}
              {view === 'security-center' && (lang === 'fr' ? 'Centre de sécurité & surveillance' : 'Centre de sécurité')}
              {view === 'excel-reports' && (lang === 'fr' ? 'Rapports & exports Excel' : 'Rapports Excel')}
              {view === 'accounts-cards' && (lang === 'fr' ? 'Gestion des comptes & cartes CSU' : 'Comptes & cartes CSU')}
              {view === 'import-control' && (lang === 'fr' ? 'Importation contrôlée des lots' : 'Importation contrôlée')}
            </div>
          </div>

          <div className="top-navbar-actions">
            {/* Display logged in status quick indicator */}
            {portalMode === 'citizen' && citizenUser && (
              <span className="badge badge-success topbar-user-badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                <ProIcon name="heart" color="#059669" /> {citizenUser.firstName} {citizenUser.lastName} (Connecté)
              </span>
            )}

            {portalMode === 'agent' && agentUser && (
              <span className="badge badge-success topbar-user-badge" style={{ fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                <ProIcon name="briefcase" /> {agentUser.firstName} {agentUser.lastName} (Agent)
              </span>
            )}

            {/* Offline Indicator */}
            {isOffline && (
              <span className="badge badge-danger" style={{ fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: 'var(--danger)', color: '#fff', animation: 'pulse 2s infinite' }}>
                <ProIcon name="alert-triangle" color="#d97706" /> Mode hors ligne
              </span>
            )}

            {/* Quick theme toggle */}
            <button 
              className="top-navbar-icon-btn" 
              onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'}
              style={{ fontSize: '1.15rem' }}
            >
              {theme === 'light' ? <ProIcon name="moon" /> : <ProIcon name="sun" />}
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
              <span><ProIcon name="search" /></span>
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
                onClick={toggleNotifications}
              >
                <ProIcon name="bell" />
                {unreadNotifications > 0 && <span className="top-navbar-dot"></span>}
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
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>{notifications.length} {notifications.length > 1 ? 'éléments' : 'élément'}</span>
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <p style={{ padding: '1rem', textAlign: 'center', margin: 0, fontSize: '0.85rem' }}>{notifUserKey ? 'Aucune notification pour le moment.' : 'Connectez-vous pour voir vos notifications.'}</p>
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
                            // Redirection vers le module réel du dossier concerné
                            if (notif.view) setView(notif.view);
                            setShowNotifications(false);
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <div style={{ fontSize: '1.25rem' }}>
                              {({ complaint: '📝', alert: '⚠️', guarantee: '🏥', order: '💊', claim: '🧾', adhesion: '🪪', security: '🔐', message: '💬' })[notif.type] || '🔔'}
                            </div>
                            <div style={{ flex: 1, textAlign: 'left' }}>
                              <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>{notif.title}</h5>
                              <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.8rem', color: 'var(--text-sub)' }}>{notif.desc}</p>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatNotifTime(notif.at)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {agentUser && (agentUser.role === 'SuperAdmin' || agentUser.role === 'Super Admin') && (
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
          <Suspense fallback={<div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>Chargement…</div>}>
            {renderView()}
          </Suspense>

          {/* Global Footer */}
          <footer style={{
            marginTop: 'auto',
            paddingTop: '3rem',
            paddingBottom: '2.5rem',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}>
            <p style={{ margin: 0 }}>
              &copy; {new Date().getFullYear()} SenMutuelles. Solution développée par <a href="https://www.senecarte.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>Sen-E-Carte</a>. 
              {' '}&bull; Contact développeur : <a href="tel:+221776026783" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>77 602 67 83</a>
            </p>
          </footer>
        </div>
      </div>

      {/* Mobile Tab Bar (Bottom Navigation for Mobile UX) */}
      <MobileTabBar view={view} setView={setView} lang={lang} />

      {/* Accessibility Voice Reader (Bottom Left Float) */}
      <AudioReader lang={lang} />

      {/* Intelligent Chatbot (Bottom Right Float) */}
      <ChatbotWidget lang={lang} setView={setView} />
    </div>
  );
}
