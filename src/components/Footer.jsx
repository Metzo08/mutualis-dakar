import React, { useState } from 'react';

export default function Footer({ lang, setView }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const dict = {
    fr: {
      desc: 'Portail régional de l\'Union Régionale des Mutuelles de Santé Communautaires de Dakar. Œuvrer ensemble pour l\'accès aux soins de santé de qualité pour tous.',
      quickLinks: 'Liens rapides',
      home: 'Accueil',
      about: 'L\'Union régionale',
      depts: 'Départements de Dakar',
      map: 'Cartographie sanitaire',
      directory: 'Base nationale des mutuelles',
      services: 'Services en ligne',
      contacts: 'Nos contacts',
      phone: 'Téléphone : +221 33 859 15 15',
      address: 'Adresse : Cité Keur Gorgui, immeuble Serigne Mérina SYLLA, Dakar',
      newsletter: 'Lettre d\'information',
      newsletterPlaceholder: 'Votre adresse email...',
      subscribe: 'S\'abonner',
      subsSuccess: 'Merci pour votre abonnement !',
      copyright: '© 2026 MUTUALIS DAKAR - URMSCD. Tous droits réservés.',
      legal: 'Mentions légales | CGU | confidentialité'
    },
    wo: {
      desc: 'Mbootaay bu réew mi bu Mutuels yi ci Dakar. Liggéeyandoo ngir wér-gi-yaramu ñëpp ci gox bi.',
      quickLinks: 'Liy Tënk',
      home: 'Kay',
      about: 'Mbootaay bi',
      depts: 'Diiwaan yi',
      map: 'Kàrt bi',
      directory: 'Répertoire bi',
      services: 'Cofel yi',
      contacts: 'Jokkoo',
      phone: 'Ordinatër : +221 33 859 15 15',
      address: 'Kër gi : Cité Keur Gorgui, immeuble Serigne Mérina SYLLA, Ndakaaru',
      newsletter: 'Xibaar yi',
      newsletterPlaceholder: 'Sa email...',
      subscribe: 'Bokk',
      subsSuccess: 'Jërëjëf, dugal nanu la !',
      copyright: '© 2026 MUTUALIS DAKAR - URMSCD. Ñëpp am nanu sañ-sañ.',
      legal: 'Sart yi | Sutura | Yoon'
    }
  };

  const t = dict[lang];

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    }
  };

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          {/* Column 1: Description & Logo */}
          <div className="footer-col">
            <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--secondary)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Mutualis
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>{t.desc}</p>
            {/* Social handles mockup */}
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span style={{ cursor: 'pointer', color: '#64748b' }}>🌐</span>
              <span style={{ cursor: 'pointer', color: '#64748b' }}>📘</span>
              <span style={{ cursor: 'pointer', color: '#64748b' }}>🐦</span>
              <span style={{ cursor: 'pointer', color: '#64748b' }}>💬</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="footer-col">
            <h3>{t.quickLinks}</h3>
            <ul className="footer-links">
              <li><button onClick={() => setView('home')}>{t.home}</button></li>
              <li><button onClick={() => setView('about')}>{t.about}</button></li>
              <li><button onClick={() => setView('depts')}>{t.depts}</button></li>
              <li><button onClick={() => setView('map')}>{t.map}</button></li>
              <li><button onClick={() => setView('directory')}>{t.directory}</button></li>
              <li><button onClick={() => setView('services')}>{t.services}</button></li>
            </ul>
          </div>

          {/* Column 3: Contact details */}
          <div className="footer-col">
            <h3>{t.contacts}</h3>
            <ul className="footer-contact-info">
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>{t.phone}</span>
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span>Email : contact@mutualisdakar.sn</span>
              </li>
              <li>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>{t.address}</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div className="footer-col">
            <h3>{t.newsletter}</h3>
            <form onSubmit={handleSubscribe} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input 
                type="email" 
                className="form-control" 
                placeholder={t.newsletterPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                required
              />
              <button type="submit" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>{t.subscribe}</button>
            </form>
            {subscribed && <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{t.subsSuccess}</p>}
          </div>
        </div>

        <div className="footer-bottom">
          <p>{t.copyright}</p>
          <div className="footer-bottom-links">
            <a href="#legal" onClick={(e) => { e.preventDefault(); alert("Mentions Légales simulées pour MUTUALIS DAKAR."); }}>{t.legal}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
