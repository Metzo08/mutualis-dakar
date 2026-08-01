import React from 'react';

/**
 * MobileTabBar Component — Bottom Tab Bar for Mobile Navigation
 * Conforme au Cahier des Charges Section 3 : Ergonomie Mobile
 */
export default function MobileTabBar({ view, setView, lang = 'fr', setChatOpen = null }) {
  const tabs = [
    { id: 'home', icon: '🏠', labelFr: 'Accueil', labelWo: 'Kër' },
    { id: 'verify', icon: '💳', labelFr: 'Ma Carte', labelWo: 'Samay Karte' },
    { id: 'payments', icon: '📲', labelFr: 'Paiement', labelWo: 'Fay' },
    { id: 'chatbot', icon: '💬', labelFr: 'Aide Zahara', labelWo: 'Dimbali' }
  ];

  return (
    <nav className="mobile-tab-bar" style={{
      display: 'none',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: '64px',
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-color)',
      zIndex: 990,
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '0 0.5rem'
    }}>
      {tabs.map((tab) => {
        const isActive = view === tab.id;
        const label = lang === 'fr' ? tab.labelFr : tab.labelWo;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              if (tab.id === 'chatbot') {
                if (setChatOpen) setChatOpen(true);
              } else {
                setView(tab.id);
              }
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '0.72rem',
              fontWeight: isActive ? '700' : '500',
              cursor: 'pointer',
              padding: '0.35rem 0',
              gap: '0.15rem',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{tab.icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
