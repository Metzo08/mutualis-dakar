import React, { useState } from 'react';

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

  const galleryItems = [
    {
      id: 1,
      image: '/csu_sesame_real.png',
      category: 'programmes',
      title: lang === 'fr' ? 'Plan Sésame - personnes âgées' : 'Plan Sésame - magg ñi',
      description: lang === 'fr' 
        ? 'Consultations, soins et médicaments gratuits octroyés au troisième âge (60 ans et plus) dans le cadre de l\'initiative de solidarité nationale.' 
        : 'Fajj ak garab yu gratuit ngir mag ñi am 60 at walla lu ko ko raw ci bir Sénégal.',
      location: 'Hôpital Fann, Dakar',
      date: 'Mai 2026',
      impact: lang === 'fr' ? '12 500+ aînés couverts' : '12 500+ magg ñi fajjoo',
      tags: ['Sésame', 'Gratuité', 'Séniors']
    },
    {
      id: 2,
      image: '/csu_bsf_real.png',
      category: 'communautaire',
      title: lang === 'fr' ? 'Bourse de sécurité familiale (BSF)' : 'Mbindu BSF',
      description: lang === 'fr' 
        ? 'Campagne massive d\'enrôlement gratuit des ménages vulnérables bénéficiaires du programme national de Bourses de Sécurité Familiale.' 
        : 'Duggalal njabot yu amul doole yi nekk ci përogaraam national bourses de sécurité familiale.',
      location: 'Pikine, Dakar',
      date: 'Avril 2026',
      impact: lang === 'fr' ? '45 000+ familles affiliées' : '45 000+ njabot yu duggu',
      tags: ['Social', 'Enrôlement', 'Solidarité']
    },
    {
      id: 3,
      image: '/csu_dialysis_real.png',
      category: 'cliniques',
      title: lang === 'fr' ? 'Gratuité des séances de dialyse' : 'Dialyse bu gratuit',
      description: lang === 'fr' 
        ? 'Prise en charge intégrale des séances de dialyse pour les malades d\'insuffisance rénale dans les centres publics conventionnés.' 
        : 'Fajj dialyse bi amul benn fay ngir ñi yore insuffisance rénale ci hôpitaux publics yi.',
      location: 'Hôpital Général Idrissa Pouye de Grand Yoff',
      date: 'Juin 2026',
      impact: lang === 'fr' ? '1 800+ patients réguliers' : '1 800+ patients ñi fajjoo',
      tags: ['Dialyse', 'Néphrologie', 'Haut niveau']
    },
    {
      id: 4,
      image: '/csu_kids_real.png',
      category: 'programmes',
      title: lang === 'fr' ? 'Soins gratuits pour les moins de 5 ans' : 'Fajj xale yu amul 5 at',
      description: lang === 'fr' 
        ? 'Politique de gratuité des soins de santé essentiels pour tous les enfants de moins de cinq ans dans les postes et centres de santé.' 
        : 'Politique de gratuité ngir xale yi amul 5 at ci consultation, vaccin ak fajj.',
      location: 'Districts sanitaires de Guédiawaye',
      date: 'Mars 2026',
      impact: lang === 'fr' ? '30 000+ consultations pédiatriques' : '30 000+ consultation xale',
      tags: ['Pédiatrie', 'Enfance', 'Vaccins']
    },
    {
      id: 5,
      image: '/csu_students_real.png',
      category: 'programmes',
      title: lang === 'fr' ? 'CSU élèves & daaras' : 'CSU élèves ak daara',
      description: lang === 'fr' 
        ? 'Campagne de sensibilisation et d\'affiliation collective des élèves et des talibés des Daaras de la région de Dakar sous l\'égide du Ministère.' 
        : 'Mbindu élèves yi ak talibé daara yi ci Dakar ngir ñu am assurance wér-gi-yaram.',
      location: 'Keur Massar, Dakar',
      date: 'Février 2026',
      impact: lang === 'fr' ? '18 écoles & 24 Daaras enrôlés' : '18 écoles ak 24 Daara yu duggu',
      tags: ['Éducation', 'Daara', 'Jeunesse']
    },
    {
      id: 6,
      image: '/inst_hero_real.png',
      category: 'communautaire',
      title: lang === 'fr' ? 'Inauguration des unions départementales' : 'Ubbi bureau CSU',
      description: lang === 'fr' 
        ? 'Cérémonie officielle d\'ouverture des bureaux départementaux de la CSU pour rapprocher l\'administration sanitaire des populations.' 
        : 'Ubbi bureau départemental cmu ngir diapalé askan wi ci séni mbindu.',
      location: 'Dakar Plateau',
      date: 'Janvier 2026',
      impact: lang === 'fr' ? '4 départements opérationnels' : '4 département yu ubbi',
      tags: ['Institutionnel', 'Dakar', 'Administration']
    }
  ];

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
            maxWidth: '800px',
            width: '100%',
            padding: 0,
            overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-2xl)',
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-2" style={{ gap: 0 }}>
              {/* Modal Left: Image */}
              <div style={{ height: '100%', minHeight: '350px', position: 'relative' }}>
                <img 
                  src={selectedItem.image} 
                  alt={selectedItem.title} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Modal Right: Details */}
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
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
