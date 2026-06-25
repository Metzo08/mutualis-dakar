import React, { useState } from 'react';

export default function InfosCSU({ lang }) {
  const [activePolicy, setActivePolicy] = useState(0);

  const dict = {
    fr: {
      title: 'La couverture maladie universelle au Sénégal',
      subtitle: 'Découvrez les initiatives d\'assurance communautaire, les politiques nationales de gratuité et le développement de la santé numérique au Sénégal.',
      cardPoliciesTitle: 'Les 4 politiques nationales de gratuité',
      cardPoliciesDesc: 'Dans le cadre de l\'ANACMU, l\'État du Sénégal finance la gratuité totale ou partielle de certains actes médicaux prioritaires.',
      timelineTitle: 'Historique et évolutions de la CSU',
      statsTitle: 'Indicateurs clés et objectifs nationaux (Dakar)',
      policySesame: 'Plan Sésame (60 ans +)',
      policyCesarean: 'Césariennes gratuites',
      policyKids: 'Petite enfance (< 5 ans)',
      policyDialysis: 'Dialyse subventionnée',
      btnLearn: 'Voir les détails',
      statRate: 'Taux de couverture régional',
      statDigital: 'Taux d\'adhésions numériques',
      statSatisfaction: 'Satisfaction des bénéficiaires'
    },
    wo: {
      title: 'Couverture maladie universelle bu Sénégal',
      subtitle: 'Xoolal saytu wér-gi-yaram bi, përogaraam gratuit yi ak dundal santé numérique ci Sénégal.',
      cardPoliciesTitle: '4 përogaraam de gratuité yi nekk',
      cardPoliciesDesc: 'Ci bir ANACMU, État bu Sénégal dafa fay fajj yu gratuit ngir dimbalé askan wi.',
      timelineTitle: 'Taariix ak évolutions bu CSU',
      statsTitle: 'Chiffres yi gënë rëy (Ndakaaru)',
      policySesame: 'Plan Sésame (60 at +)',
      policyCesarean: 'Césarienne Gratuit',
      policyKids: 'Xale yu amul 5 at',
      policyDialysis: 'Dialyse gratuit',
      btnLearn: 'Xoolal details yi',
      statRate: 'Taux de couverture gox bi',
      statDigital: 'Mbindu numérique bi',
      statSatisfaction: 'Mbegte askan wi'
    }
  };

  const t = dict[lang] || dict.fr;

  const policies = [
    {
      title: t.policySesame,
      icon: '👴',
      descfr: 'Créé pour garantir la dignité de nos aînés. Il prend en charge à 100% les consultations, les soins hospitaliers d\'urgence et les médicaments essentiels prescrits dans les structures publiques.',
      descwo: 'Ngir dimbalé ak deugeural sounou waajur yi. Day fay 100% consultation, urgent care ak garab ci hôpitaux publics yi.',
      impact: '150 000+ seniors couverts au Sénégal'
    },
    {
      title: t.policyCesarean,
      icon: '🤰',
      descfr: 'Afin de réduire la mortalité maternelle, l\'accouchement par césarienne (simple ou d\'urgence) est entièrement gratuit dans tous les hôpitaux publics agréés.',
      descwo: 'Ngir wanni réy xale ak yaay yi, accouchement césarienne dafa gratuit 100% ci hôpitaux publics yëpp.',
      impact: '40 000+ césariennes prises en charge chaque année'
    },
    {
      title: t.policyKids,
      icon: '👶',
      descfr: 'Les enfants âgés de 0 à 5 ans bénéficient de la gratuité des consultations de médecine générale et pédiatrique, des vaccinations obligatoires et des soins infirmiers de base.',
      descwo: 'Xale yi amul 5 at danguay fajjoo gratuit ci poste de santé yi ci consultation, vaccin ak urgences.',
      impact: '2.5 millions d\'enfants enrôlés au niveau national'
    },
    {
      title: t.policyDialysis,
      icon: '🏥',
      descfr: 'Les séances de dialyse pour l\'insuffisance rénale chronique sont gratuites dans tous les centres publics du Sénégal, soulageant les familles d\'un coût mensuel de plus de 150 000 FCFA.',
      descwo: 'Séance dialyse yi dafa gratuit ci bir hôpitaux public yi ci Sénégal ngir wanni fay bi ci njabot yi.',
      impact: 'Gratuité totale de la dialyse dans les structures publiques'
    }
  ];

  const timelineEvents = [
    {
      year: '2013',
      title: lang === 'fr' ? 'Lancement de la CSU' : 'Lancement CSU',
      desc: lang === 'fr' 
        ? 'Lancement officiel du programme national de Couverture Maladie Universelle au Sénégal par le chef de l\'État.' 
        : 'Ubbi përogaraam national Couverture Maladie Universelle ci Sénégal.'
    },
    {
      year: '2015',
      title: lang === 'fr' ? 'Initiative moins de 5 ans' : 'Moins de 5 ans',
      desc: lang === 'fr' 
        ? 'Introduction de la gratuité des soins de santé primaires pour les enfants de moins de cinq ans dans les structures sanitaires publiques.' 
        : 'Ubbi gratuité fajj xale yi amul 5 at ci district sanitaire yi.'
    },
    {
      year: '2017',
      title: lang === 'fr' ? 'Extension de la césarienne' : 'Césarienne gratuit',
      desc: lang === 'fr' 
        ? 'Généralisation de la gratuité de la césarienne dans toutes les maternités des centres hospitaliers publics.' 
        : 'Fay césarienne gratuit ci maternité hospital public yi.'
    },
    {
      year: '2021',
      title: lang === 'fr' ? 'Gratuité de la dialyse' : 'Dialyse gratuit',
      desc: lang === 'fr' 
        ? 'Prise en charge intégrale des séances de dialyse rénale pour supprimer les listes d\'attente fatales.' 
        : 'Dindi fay bi ci séance dialyse yi ci hôpitaux publics yi.'
    },
    {
      year: '2026',
      title: lang === 'fr' ? 'Lancement de MUTUALIS DAKAR' : 'Plateforme Mutualis',
      desc: lang === 'fr' 
        ? 'Digitalisation complète de l\'enrôlement, paiement mobile des cotisations (Wave/OM) et déploiement de la carte de santé QR à Dakar.' 
        : 'Digitalisé mbindu, fay mobile ak carte QR santé ci région Dakar.'
    }
  ];

  return (
    <div className="infos-view fade-in-up" style={{ padding: '1rem 0' }}>
      {/* Banner */}
      <section className="banner-mini" style={{
        background: `linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_info_hero_real.png") center/cover no-repeat`,
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

      <div className="grid grid-2" style={{ gap: '2rem', alignItems: 'stretch' }}>
        {/* Left Side: National Free Care Policies */}
        <div className="card text-left" style={{ padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            {t.cardPoliciesTitle}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '2rem' }}>
            {t.cardPoliciesDesc}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {policies.map((p, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: activePolicy === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: activePolicy === idx ? 'var(--bg-card-subtle)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => setActivePolicy(idx)}
              >
                <div style={{ fontSize: '2rem' }}>{p.icon}</div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{p.title}</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: activePolicy === idx ? 'block' : 'none' }}>
                    {lang === 'fr' ? p.descfr : p.descwo}
                  </p>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--secondary)', marginTop: '0.5rem' }}>
                    📊 {p.impact}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Key Statistics */}
        <div className="card text-left" style={{ padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '1.5rem' }}>
              {t.statsTitle}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Stat 1 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  <span>{t.statRate}</span>
                  <span style={{ color: 'var(--primary)' }}>78%</span>
                </div>
                <div style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '78%', height: '100%', backgroundColor: 'var(--primary)', borderRadius: '5px' }}></div>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {lang === 'fr' ? 'Objectif d\'atteindre 90% de couverture dans la région de Dakar d\'ici fin 2027.' : 'Objectif bi moy 90% ci atum 2027.'}
                </p>
              </div>

              {/* Stat 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  <span>{t.statDigital}</span>
                  <span style={{ color: 'var(--secondary)' }}>64%</span>
                </div>
                <div style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '64%', height: '100%', backgroundColor: 'var(--secondary)', borderRadius: '5px' }}></div>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {lang === 'fr' ? 'Part des nouvelles adhésions effectuées via le portail Mutualis Dakar.' : 'Mbindu yi soti ci internet bi.'}
                </p>
              </div>

              {/* Stat 3 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  <span>{t.statSatisfaction}</span>
                  <span style={{ color: 'var(--success)' }}>92%</span>
                </div>
                <div style={{ height: '10px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{ width: '92%', height: '100%', backgroundColor: 'var(--success)', borderRadius: '5px' }}></div>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {lang === 'fr' ? 'Mesuré lors de l\'enquête de satisfaction sur la rapidité du tiers-payant.' : 'Mbegte askan wi ci fajj bi.'}
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem', padding: '1.25rem', borderRadius: '12px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
            <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.95rem', display: 'block', marginBottom: '0.5rem' }}>
              💡 {lang === 'fr' ? 'Le saviez-vous ?' : 'Xam nga ko ?'}
            </span>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', margin: 0 }}>
              {lang === 'fr' 
                ? 'La couverture maladie universelle au Sénégal est principalement gérée par les mutuelles de santé communautaires, garantissant que les cotisations restent gérées de façon solidaire au niveau local.' 
                : 'Couverture maladie universelle bi mutuelles de santé gox-gox yi gno ko yore ngir dimbalanté.'}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <section className="card text-left" style={{ padding: '2.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '2rem', textAlign: 'center' }}>
          {t.timelineTitle}
        </h2>

        <div style={{
          position: 'relative',
          maxWidth: '800px',
          margin: '0 auto',
          padding: '1rem 0'
        }}>
          {/* Vertical Center Line */}
          <div style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            bottom: 0,
            width: '2px',
            background: 'var(--border-color)',
            transform: 'translateX(-50%)'
          }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {timelineEvents.map((evt, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: idx % 2 === 0 ? 'flex-start' : 'flex-end',
                  position: 'relative',
                  width: '100%'
                }}
              >
                {/* Center Circle Indicator */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: '15px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: 'var(--secondary)',
                  border: '4px solid var(--bg-card)',
                  transform: 'translateX(-50%)',
                  zIndex: 2
                }}></div>

                {/* Timeline Card */}
                <div style={{
                  width: '45%',
                  background: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--secondary)', display: 'block', marginBottom: '0.25rem' }}>
                    {evt.year}
                  </span>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                    {evt.title}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.4' }}>
                    {evt.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
