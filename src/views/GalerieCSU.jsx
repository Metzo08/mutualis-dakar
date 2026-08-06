import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';

export default function GalerieCSU({ lang }) {
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  const dict = {
    fr: {
      title: 'Galerie d\'activités de la CSU',
      subtitle: 'Retrouvez en images les actions menées sur le terrain, les centres de santé conventionnés et l\'impact de la Couverture Maladie Universelle à Dakar et au Sénégal.',
      filterAll: 'Tout',
      filterProg: 'Programmes spéciaux',
      filterClinic: 'Structures & soins',
      filterComm: 'Communautaire & enrôlement',
      btnClose: 'Fermer',
      location: 'Lieu',
      date: 'Date',
      impact: 'Impact',
      viewLarge: 'Agrandir l\'image'
    },
    wo: {
      title: 'Natalu liggéeyu CSU',
      subtitle: 'Xoolal liggéey bi nu def ci gox-gox yi, fajukaay yi nu bokkal ak njeuritou Couverture Maladie Universelle ci Dakar ak ci Sénégal.',
      filterAll: 'Lépp',
      filterProg: 'Përogaraam spécial',
      filterClinic: 'Fajukaay & fajj',
      filterComm: 'Mbindu ak mbooloo',
      btnClose: 'Tëj',
      location: 'Gox',
      date: 'Date',
      impact: 'Njeurit',
      viewLarge: 'Xoolal bu rëy'
    }
  };

  const t = dict[lang] || dict.fr;

  const defaultGalleryItems = [
    {
      id: 1,
      image: '/csu_claims_hero.png',
      category: 'programmes',
      title_fr: 'Distribution de cartes CMU à Dakar Plateau',
      title_wo: 'Joxé kàrt CMU ci Dakar Plateau',
      description_fr: 'Remise officielle des cartes biométriques CMU aux familles parrainées par la mairie.',
      description_wo: 'Joxé kàrt biométrique CMU ci ndimbalu mairie bi.',
      location_fr: 'Dakar Plateau',
      location_wo: 'Dakar Plateau',
      date_fr: '15 Mai 2026',
      date_wo: '15 Mai 2026',
      impact_fr: '150 familles enrôlées',
      impact_wo: '150 keur mbindu',
      tags: ['Dakar', 'Enrôlement']
    },
    {
      id: 2,
      image: '/wave_mobile_payment_senegal.jpg',
      category: 'cliniques',
      title_fr: 'Conventionnement de la clinique Bel-Air',
      title_wo: 'Convention Bel-Air',
      description_fr: 'Signature du partenariat tiers-payant permettant le remboursement immédiat à 80% des soins.',
      description_wo: 'Signature partenariat tiers-payant ngir fajj 80% gox bi.',
      location_fr: 'Hann Bel-Air',
      location_wo: 'Hann Bel-Air',
      date_fr: '20 Avril 2026',
      date_wo: '20 Avril 2026',
      impact_fr: 'Accès direct pour 5 000 assurés',
      impact_wo: 'Fajj 5 000 assuré yi',
      tags: ['Tiers-payant', 'Bel-Air']
    },
    {
      id: 3,
      image: '/csu_digital_health_real.jpg',
      category: 'communautaire',
      title_fr: 'Sensibilisation sur la santé numérique',
      title_wo: 'Leral santé numérique',
      description_fr: 'Atelier de formation à la Médina pour l\'utilisation de l\'application de paiement Wave/OM.',
      description_wo: 'Atelier formation Médina ngir ubbil askan wi fay bi ci mobile.',
      location_fr: 'Médina',
      location_wo: 'Médina',
      date_fr: '10 Juin 2026',
      date_wo: '10 Juin 2026',
      impact_fr: '300 participants formés',
      impact_wo: '300 bokk ci formation bi',
      tags: ['Digital', 'Formation']
    }
  ];

  const { data: galleryRaw = null, isPending } = useQuery({
    queryKey: ['galleryList'],
    queryFn: async () => {
      const res = await fetch('http://localhost:5000/api/gallery');
      if (!res.ok) throw new Error('API Error');
      return res.json();
    }
  });

  const gallerySource = isPending ? [] : (galleryRaw && galleryRaw.length > 0 ? galleryRaw : defaultGalleryItems);
  const galleryItems = gallerySource.map(item => ({
    id: item.id,
    image: item.image,
    category: item.category,
    title: lang === 'fr' ? item.title_fr : item.title_wo,
    description: lang === 'fr' ? item.description_fr : item.description_wo,
    location: lang === 'fr' ? item.location_fr : item.location_wo,
    date: lang === 'fr' ? item.date_fr : item.date_wo,
    impact: lang === 'fr' ? item.impact_fr : item.impact_wo,
    tags: item.tags || []
  }));

  const filteredItems = filter === 'all' 
    ? galleryItems 
    : galleryItems.filter(item => item.category === filter);

  return (
    <div className="gallery-view fade-in-up" style={{ padding: '1rem 0' }}>
      {/* Banner */}
      <section className="banner-mini" style={{
        background: `linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_gallery_hero_real.png") center/cover no-repeat`,
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3.75rem 2.5rem',
        marginBottom: '3.5rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {t.title}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      {/* Interactive Category Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <button 
          className={`dept-tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t.filterAll}
        </button>
        <button 
          className={`dept-tab-btn ${filter === 'programmes' ? 'active' : ''}`}
          onClick={() => setFilter('programmes')}
        >
          {t.filterProg}
        </button>
        <button 
          className={`dept-tab-btn ${filter === 'cliniques' ? 'active' : ''}`}
          onClick={() => setFilter('cliniques')}
        >
          {t.filterClinic}
        </button>
        <button 
          className={`dept-tab-btn ${filter === 'communautaire' ? 'active' : ''}`}
          onClick={() => setFilter('communautaire')}
        >
          {t.filterComm}
        </button>
      </div>

      {/* Grid of Gallery Cards */}
      {isPending ? (
        <div className="grid grid-3" style={{ gap: '2rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ height: '350px', padding: 0, overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: '200px', width: '100%', backgroundColor: 'rgba(255,255,255,0.03)' }} className="loading-shimmer"></div>
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ height: '20px', width: '80%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }} className="loading-shimmer"></div>
                <div style={{ height: '15px', width: '50%', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }} className="loading-shimmer"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-3" style={{ gap: '2rem' }}>
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className="card fade-in-up" 
              style={{ 
                padding: 0, 
                overflow: 'hidden', 
                cursor: 'pointer', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-card)'
              }}
              onClick={() => setSelectedItem(item)}
            >
              {/* Card Image */}
              <div style={{ width: '100%', height: '200px', overflow: 'hidden', position: 'relative' }}>
                <img 
                  src={item.image} 
                  alt={item.title}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/csu_gallery_hero_real.png'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              <span className="badge badge-info" style={{ position: 'absolute', top: '10px', right: '10px', backdropFilter: 'blur(4px)', background: 'rgba(59, 130, 246, 0.85)', color: '#fff' }}>
                {item.category === 'programmes' ? 'Programme' : item.category === 'cliniques' ? 'Structure' : 'Ménage'}
              </span>
            </div>

            {/* Card Content */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--primary)' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', flex: 1, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.description}
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
                <span>📍 {item.location.split(',')[0]}</span>
                <span>📅 {item.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* Interactive Zoom Modal Centré sur le Viewport (Portal document.body) */}
      {selectedItem && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '1.5rem',
            overflowY: 'auto'
          }} 
          onClick={() => setSelectedItem(null)}
        >
          <div 
            className="card scale-in shadow-lg" 
            style={{
              maxWidth: '960px',
              width: '100%',
              maxHeight: '90vh',
              padding: 0,
              overflow: 'hidden',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '24px',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.6)',
              textAlign: 'left',
              position: 'relative',
              margin: 'auto'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Bouton de fermeture supérieur */}
            <button 
              type="button"
              onClick={() => setSelectedItem(null)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                zIndex: 20,
                background: 'rgba(0, 0, 0, 0.75)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                transition: 'transform 0.2s ease'
              }}
              title="Fermer la vue plein écran"
            >
              ✖
            </button>

            <div style={{
              display: 'grid',
              gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr',
              gap: 0,
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              {/* Modal Left: Photo HD intégrale centrée (sans rogner) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#090d16',
                position: 'relative',
                minHeight: '320px',
                maxHeight: '560px',
                padding: '1rem',
                overflow: 'hidden'
              }}>
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.title}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/csu_gallery_hero_real.png'; }}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '520px',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    display: 'block'
                  }}
                />
              </div>

              {/* Modal Right: Informations détaillées et texte lisible */}
              <div style={{
                padding: '2.25rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'var(--bg-card)',
                maxHeight: '560px',
                overflowY: 'auto'
              }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                    {selectedItem.tags.map((tag, idx) => (
                      <span key={idx} className="badge bg-success-subtle text-success border border-success px-2.5 py-1" style={{ fontSize: '0.75rem', borderRadius: '8px', fontWeight: '700' }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                  
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '1rem', lineHeight: '1.35' }}>
                    {selectedItem.title}
                  </h2>

                  <p style={{ fontSize: '0.96rem', color: 'var(--text-main)', lineHeight: '1.65', marginBottom: '1.5rem', opacity: 0.95 }}>
                    {selectedItem.description}
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.1rem', fontSize: '0.88rem' }}>
                    <div className="d-flex align-items-center gap-2">
                      <strong style={{ color: 'var(--text-sub)' }}>📍 {t.location} : </strong>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{selectedItem.location}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <strong style={{ color: 'var(--text-sub)' }}>📅 {t.date} : </strong>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{selectedItem.date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-card-subtle)', padding: '0.75rem 1rem', borderRadius: '14px', marginTop: '0.5rem', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '1.4rem' }}>📈</span>
                      <div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-sub)', fontWeight: '700', letterSpacing: '0.5px' }}>{t.impact}</div>
                        <div style={{ fontWeight: '850', color: '#10b981', fontSize: '1rem' }}>{selectedItem.impact}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
                  <button 
                    type="button"
                    style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.6rem 1.4rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.3)' }}
                    onClick={() => setSelectedItem(null)}
                  >
                    {t.btnClose}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
