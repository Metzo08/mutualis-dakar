import React, { useState } from 'react';
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
        background: `linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_gallery_hero_real.png") center/cover no-repeat`,
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
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

      {/* Interactive Zoom Modal */}
      {selectedItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '1.5rem'
        }} onClick={() => setSelectedItem(null)}>
          <div className="card scale-in" style={{
            maxWidth: '850px',
            width: '100%',
            padding: 0,
            overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-2xl)',
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-2" style={{ gap: 0, alignItems: 'stretch' }}>
              {/* Modal Left: Image */}
              <div style={{ display: 'flex', height: '100%', minHeight: '400px', position: 'relative' }}>
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.title}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/csu_gallery_hero_real.png'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>

              {/* Modal Right: Details */}
              <div style={{ padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '400px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    {selectedItem.tags.map((tag, idx) => (
                      <span key={idx} className="badge badge-success" style={{ fontSize: '0.7rem' }}>#{tag}</span>
                    ))}
                  </div>
                  
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--primary)', marginBottom: '1rem' }}>
                    {selectedItem.title}
                  </h2>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                    {selectedItem.description}
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', fontSize: '0.85rem' }}>
                    <div>
                      <strong style={{ color: 'var(--text-muted)' }}>📍 {t.location} : </strong>
                      <span style={{ fontWeight: '600' }}>{selectedItem.location}</span>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-muted)' }}>📅 {t.date} : </strong>
                      <span style={{ fontWeight: '600' }}>{selectedItem.date}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card-subtle)', padding: '0.5rem 0.75rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }}>📈</span>
                      <div>
                        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t.impact}</div>
                        <div style={{ fontWeight: '800', color: 'var(--secondary)', fontSize: '0.95rem' }}>{selectedItem.impact}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => setSelectedItem(null)}
                  >
                    {t.btnClose}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
