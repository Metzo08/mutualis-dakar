import React, { useState, useEffect } from 'react';

export default function ProgrammesCSU({ lang, setViewTab }) {
  const [activeAccordion, setActiveAccordion] = useState(null);
  const [dbPrograms, setDbPrograms] = useState([]);

  // Récupère les programmes CSU dynamiques depuis l'API (avec fallback statique)
  useEffect(() => {
    fetch('http://localhost:5000/api/csu/programs')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setDbPrograms(data);
      })
      .catch(() => { /* fallback statique conservé */ });
  }, []);

  const toggleAccordion = (index) => {
    if (activeAccordion === index) {
      setActiveAccordion(null);
    } else {
      setActiveAccordion(index);
    }
  };

  const dict = {
    fr: {
      heroTitle: 'Protégez votre santé et celle de vos proches. Inscrivez-vous dès aujourd\'hui !',
      heroCta: 'Je m\'inscris à la CSU',
      whyTitle: 'Pourquoi s\'inscrire ?',
      whyFeatures: [
        { icon: '🩺', title: 'Accès aux soins', desc: 'Accès rapide dans tous les postes, centres de santé et hôpitaux du Sénégal.' },
        { icon: '💰', title: 'Prix accessibles', desc: 'Soins de santé subventionnés et tarifs réduits pour tous les membres.' },
        { icon: '🌿', title: 'Démarches simples', desc: 'Inscription claire, rapide et décentralisée dans votre commune.' },
        { icon: '🛡️', title: 'Protection prioritaire', desc: 'Couverture totale pour les enfants de moins de 5 ans et les personnes vulnérables.' }
      ],
      gratuiteTitle: 'Les programmes de gratuité',
      gratuitePrograms: [
        {
          title: 'Prise en charge de la dialyse',
          icon: '🩸',
          img: '/csu_dialysis_real.png',
          desc: 'La Couverture Sanitaire Universelle garantit la gratuité totale de la dialyse pour tous les insuffisants rénaux dans les structures de santé publiques. Ce programme soulage considérablement les familles d\'un lourd fardeau financier.'
        },
        {
          title: 'Plan Sésame (plus de 60 ans)',
          icon: '👴🏾',
          img: '/csu_sesame_real.png',
          desc: 'Le Plan Sésame offre une prise en charge gratuite des soins de santé pour toutes les personnes âgées de 60 ans et plus dans les structures sanitaires publiques du Sénégal.'
        },
        {
          title: 'Gratuité enfants 0-5 ans & césarienne',
          icon: '👶🏾',
          img: '/csu_kids_real.png',
          desc: 'Les soins sont entièrement gratuits pour les enfants de moins de cinq ans. De plus, la césarienne est prise en charge pour réduire la mortalité maternelle et infantile.'
        },
        {
          title: 'CSU élèves & daaras',
          icon: '📚',
          img: '/csu_students_real.png',
          desc: 'Assurance maladie dédiée aux élèves et aux talibés. Pour seulement 1 000 FCFA par an, le ticket modérateur est entièrement couvert pour les consultations et soins en milieu scolaire.'
        },
        {
          title: 'Bourses de sécurité familiale & CEC',
          icon: '💳',
          img: '/csu_bsf_real.png',
          desc: 'Prise en charge à 100 % dans les mutuelles de santé communautaires pour les bénéficiaires des BSF et les personnes vivant avec un handicap détentrices de la Carte d\'Égalité des Chances (CEC).'
        }
      ],
      howTitle: 'Comment s\'inscrire ?',
      howSteps: [
        { title: '1. Trouver sa mutuelle', desc: 'Rendez-vous à la mutuelle de santé communautaire de votre localité (commune ou département) affiliée à l\'UNAMUSC.' },
        { title: '2. Fournir ses informations', desc: 'Présentez une pièce d\'identité (Carte Nationale d\'Identité, Extrait de naissance pour les enfants).' },
        { title: '3. Payer la cotisation', desc: 'Acquittez-vous de la cotisation annuelle (généralement 4 500 FCFA par personne et par an, comprenant 1 000 FCFA pour la carte et 3 500 FCFA de cotisation).' },
        { title: '4. Délai d\'observation', desc: 'Un délai de carence (souvent 1 à 3 mois) est appliqué avant de pouvoir bénéficier de la couverture totale des soins.' },
        { title: '5. Profitez de vos soins', desc: 'Présentez votre carte de membre ou utilisez notre portail citoyen lors de vos consultations pour bénéficier des réductions.' }
      ],
      unamuscTitle: 'Le rôle de l\'UNAMUSC',
      unamuscDesc: 'L\'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) coordonne le réseau de toutes les mutuelles de santé réparties dans les 46 départements du Sénégal. Elle incarne la solidarité nationale, facilite l\'adhésion locale et milite pour une gestion communautaire transparente et efficace de la couverture maladie.',
      learnMore: 'En savoir plus sur l\'UNAMUSC'
    },
    wo: {
      heroTitle: 'Aaral sa wér-gi-yaram ak bu sa njaboot. Mbindu ci saasi !',
      heroCta: 'Ma mbindu ci CSU',
      whyTitle: 'Lu tax ñu mbindu ?',
      whyFeatures: [
        { icon: '🩺', title: 'Faju bu yomb', desc: 'Mën a faju ci poste, centre de santé ak hôpital yi ci Sénégal yëpp.' },
        { icon: '💰', title: 'Njeeg yu woyof', desc: 'Faju gu ñu jàppale ngir ñëpp ñi bokk ci mutuelle bi.' },
        { icon: '🌿', title: 'Yoon wu leer', desc: 'Mbindu gu gaaw te yomb ci sa gox.' },
        { icon: '🛡️', title: 'Aar ñi gën a ñàkk', desc: 'Faju bu mat sëkk ngir xale yi amul 5 at ak ñi gën a waayadi.' }
      ],
      gratuiteTitle: 'Përogaraam Faju yu Amul Fay',
      gratuitePrograms: [
        {
          title: 'Dialyse bu amul fay',
          icon: '🩸',
          img: '/csu_dialysis_real.png',
          desc: 'Couverture Sanitaire Universelle dafay fajj ñiy def dialyse ci hôpital lëétat yi te duñu fay dara. Lii dafay wàññi bu baax coonoy njaboot yi.'
        },
        {
          title: 'Plan Sésame (Ñi am 60 at ak lu tegu)',
          icon: '👴🏾',
          img: '/csu_sesame_real.png',
          desc: 'Plan Sésame dafay may mag ñi am 60 at jëm kaw ñu faju ci yoon te duñu fay ci kër-doctoor yi lëétat.'
        },
        {
          title: 'Xale yi 0-5 at & Césarienne',
          icon: '👶🏾',
          img: '/csu_kids_real.png',
          desc: 'Xale yi amagul 5 at duñu fay dara ci faju. Jigéen ñiy am doom ci césarienne tamit seen faju lëétat mokoy jël.'
        },
        {
          title: 'CSU Ndongo Daara ak Élèves',
          icon: '📚',
          img: '/csu_students_real.png',
          desc: 'Mutuelle ngir ndongo ekool yi ak daara yi. 1 000 FCFA kese nga fay ci at mi, ñu fajj la sa yaram tawfeex.'
        },
        {
          title: 'Bourses de Sécurité Familiale & CEC',
          icon: '💳',
          img: '/csu_bsf_real.png',
          desc: 'Faju 100% ci mutuelle yi ngir ñiy jël BSF ak ñi am yàq-yàq ci yaram te yore Carte Égalité des Chances (CEC).'
        }
      ],
      howTitle: 'Naka lañuy mbindu ?',
      howSteps: [
        { title: '1. Seet mutuelle', desc: 'Demal ci mutuelle de santé bi nekk ci sa gox (commune walla département) bi bokk ci UNAMUSC.' },
        { title: '2. Joxe sa kayit', desc: 'Indil sa Kàrtu-Bàkkan (CNI) walla extrait de naissance ngir xale yi.' },
        { title: '3. Fay sa abonnement', desc: 'Fayal li ñu la laaj ci at mi (4 500 FCFA ngir nit ki ci at mi: 1 000 FCFA ngir carte bi ak 3 500 FCFA ngir cotisation bi).' },
        { title: '4. Xaar yàgg-yàgg bi', desc: 'Ding xaar tuuti (1 ba 3 weer) bala ngay mën a faju bu mat sëkk.' },
        { title: '5. Faju ci nu yomb', desc: 'Woneel sa kàrt walla portal citoyen bi sa yoonu kër-doctoor ngir ñu waññil la sa faju.' }
      ],
      unamuscTitle: 'Liggéeyu UNAMUSC',
      unamuscDesc: 'UNAMUSC mooy mbootaay gi mboolem mutuelle yi ci 46 départements yi ci Sénégal bokk ngir jàppalante ak gën a yombal faju gi ci anam bu leer.',
      learnMore: 'Gën a xam ci UNAMUSC'
    }
  };

  const t = dict[lang] || dict.fr;

  return (
    <div className="programmes-csu-wrapper fade-in-up">
      {/* Premium Hero Section */}
      <section className="csu-hero">
        <div className="csu-hero-content container">
          <h1 className="csu-hero-title">{t.heroTitle}</h1>
          <button 
            className="btn btn-primary csu-btn-cta" 
            onClick={() => {
              if (setViewTab) setViewTab('services', 'register');
            }}
          >
            {t.heroCta}
          </button>
        </div>
      </section>

      {/* Pourquoi s'inscrire Grid */}
      <section className="container section-padding">
        <div className="csu-section-header">
          <h2 className="csu-section-title">{t.whyTitle}</h2>
        </div>
        <div className="csu-features-grid">
          {t.whyFeatures.map((feat, idx) => (
            <div key={idx} className="csu-feature-card card hover-lift">
              <div className="csu-feature-icon">{feat.icon}</div>
              <h3 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>{feat.title}</h3>
              <p style={{ color: 'var(--text-sub)' }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Les Programmes de Gratuité */}
      <section className="csu-gratuite-section" style={{ backgroundColor: 'var(--bg-card-subtle)' }}>
        <div className="container section-padding">
          <div className="csu-section-header">
            <h2 className="csu-section-title">{t.gratuiteTitle}</h2>
          </div>
          <div className="csu-gratuite-grid">
            {(dbPrograms.length > 0
              ? dbPrograms.map((p) => ({
                  title: lang === 'wo' && p.title_wo ? p.title_wo : p.title_fr,
                  icon: p.icon || '📋',
                  img: null,
                  desc: lang === 'wo' && p.description_wo ? p.description_wo : p.description_fr,
                  audience: p.target_audience,
                  rate: p.coverage_rate
                }))
              : t.gratuitePrograms
            ).map((prog, idx) => (
              <div key={idx} className="csu-gratuite-card card" style={{ padding: prog.img ? 0 : '1.5rem', overflow: 'hidden', flexDirection: prog.img ? 'column' : 'row' }}>
                {prog.img ? (
                  <>
                    <img src={prog.img} alt={prog.title} style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                    <div className="csu-gratuite-text" style={{ padding: '1.5rem' }}>
                      <h3 style={{ marginBottom: '0.5rem', color: 'var(--secondary)' }}>{prog.icon} {prog.title}</h3>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{prog.desc}</p>
                      {prog.audience && <ProgramMeta audience={prog.audience} rate={prog.rate} />}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="csu-gratuite-icon-wrapper">
                      <span className="csu-gratuite-icon">{prog.icon}</span>
                    </div>
                    <div className="csu-gratuite-text">
                      <h3 style={{ marginBottom: '0.5rem', color: 'var(--secondary)' }}>{prog.title}</h3>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{prog.desc}</p>
                      {prog.audience && <ProgramMeta audience={prog.audience} rate={prog.rate} />}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment s'inscrire Accordion */}
      <section className="container section-padding">
        <div className="csu-section-header">
          <h2 className="csu-section-title csu-bg-green">{t.howTitle}</h2>
        </div>
        <div className="csu-accordion-wrapper">
          {t.howSteps.map((step, index) => {
            const isActive = activeAccordion === index;
            return (
              <div key={index} className={`csu-accordion-item ${isActive ? 'active' : ''}`}>
                <div className="csu-accordion-header" onClick={() => toggleAccordion(index)}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{step.title}</h3>
                  <span className="csu-accordion-icon">{isActive ? '−' : '+'}</span>
                </div>
                {isActive && (
                  <div className="csu-accordion-body">
                    <p style={{ margin: 0 }}>{step.desc}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* UNAMUSC Section */}
      <section className="container section-padding" style={{ paddingBottom: '4rem' }}>
        <div className="csu-unamusc-banner card">
          <div className="csu-unamusc-logo" style={{ flex: '0 0 150px', textAlign: 'center' }}>
            <img src="/unamusc_logo.jpg" alt="UNAMUSC" style={{ width: '100%', maxWidth: '120px', borderRadius: '10px' }} />
          </div>
          <div className="csu-unamusc-content" style={{ flex: 1 }}>
            <h2 className="csu-section-title" style={{ textAlign: 'left', marginBottom: '1rem' }}>{t.unamuscTitle}</h2>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{t.unamuscDesc}</p>
            <a href="https://www.unamusc.sn/" target="_blank" rel="noreferrer" className="btn btn-outline" style={{ display: 'inline-block' }}>{t.learnMore}</a>
          </div>
        </div>
      </section>
    </div>
  );
}

// Affiche les métadonnées d'un programme CSU (public cible + taux de couverture)
function ProgramMeta({ audience, rate }) {
  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {audience && (
        <span style={{ background: 'rgba(5,150,105,0.1)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
          🎯 {audience}
        </span>
      )}
      {rate != null && (
        <span style={{ background: 'rgba(34,197,94,0.1)', color: '#16a34a', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
          ✅ Prise en charge {rate}%
        </span>
      )}
    </div>
  );
}
