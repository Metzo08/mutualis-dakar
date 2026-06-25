import React, { useState, useEffect } from 'react';

const staticData = {
  regions: [
    { id: 1, name: 'Dakar' },
    { id: 2, name: 'Diourbel' },
    { id: 3, name: 'Fatick' },
    { id: 4, name: 'Kaffrine' },
    { id: 5, name: 'Kaolack' },
    { id: 6, name: 'Kédougou' },
    { id: 7, name: 'Kolda' },
    { id: 8, name: 'Louga' },
    { id: 9, name: 'Matam' },
    { id: 10, name: 'Saint-Louis' },
    { id: 11, name: 'Sédhiou' },
    { id: 12, name: 'Tambacounda' },
    { id: 13, name: 'Thiès' },
    { id: 14, name: 'Ziguinchor' }
  ],
  departements: {
    1: [
      { id: 101, name: 'Dakar' },
      { id: 102, name: 'Guédiawaye' },
      { id: 103, name: 'Pikine' },
      { id: 104, name: 'Rufisque' },
      { id: 105, name: 'Keur Massar' }
    ],
    2: [
      { id: 201, name: 'Diourbel' },
      { id: 202, name: 'Bambey' },
      { id: 203, name: 'Mbacké' }
    ],
    3: [
      { id: 301, name: 'Fatick' },
      { id: 302, name: 'Foundiougne' },
      { id: 303, name: 'Gossas' }
    ],
    4: [
      { id: 401, name: 'Kaffrine' },
      { id: 402, name: 'Birkelane' },
      { id: 403, name: 'Koungheul' },
      { id: 404, name: 'Malem Hodar' }
    ],
    5: [
      { id: 501, name: 'Kaolack' },
      { id: 502, name: 'Guinguinéo' },
      { id: 503, name: 'Nioro du Rip' }
    ],
    6: [
      { id: 601, name: 'Kédougou' },
      { id: 602, name: 'Salémata' },
      { id: 603, name: 'Saraya' }
    ],
    7: [
      { id: 701, name: 'Kolda' },
      { id: 702, name: 'Médina Yoro Koula' },
      { id: 703, name: 'Vélingara' }
    ],
    8: [
      { id: 801, name: 'Louga' },
      { id: 802, name: 'Kébémer' },
      { id: 803, name: 'Linguère' }
    ],
    9: [
      { id: 901, name: 'Matam' },
      { id: 902, name: 'Kanel' },
      { id: 903, name: 'Ranérou Ferlo' }
    ],
    10: [
      { id: 1001, name: 'Saint-Louis' },
      { id: 1002, name: 'Dagana' },
      { id: 1003, name: 'Podor' }
    ],
    11: [
      { id: 1101, name: 'Sédhiou' },
      { id: 1102, name: 'Bounkiling' },
      { id: 1103, name: 'Goudomp' }
    ],
    12: [
      { id: 1201, name: 'Tambacounda' },
      { id: 1202, name: 'Bakel' },
      { id: 1203, name: 'Goudiry' },
      { id: 1204, name: 'Koumpentoum' }
    ],
    13: [
      { id: 1301, name: 'Thiès' },
      { id: 1302, name: 'Mbour' },
      { id: 1303, name: 'Tivaouane' }
    ],
    14: [
      { id: 1401, name: 'Ziguinchor' },
      { id: 1402, name: 'Bignona' },
      { id: 1403, name: 'Oussouye' }
    ]
  },
  communes: {
    // Dakar
    101: [{ id: 10101, name: 'Dakar Plateau' }, { id: 10102, name: 'Médina' }, { id: 10103, name: 'Fann-Point E-Amitié' }, { id: 10104, name: 'Ouakam' }, { id: 10105, name: 'Ngor' }, { id: 10106, name: 'Yoff' }, { id: 10107, name: 'Grand Yoff' }, { id: 10108, name: 'Parcelles Assainies' }],
    102: [{ id: 10201, name: 'Wakhinane Nimzatt' }, { id: 10202, name: 'Ndiarème Limamoulaye' }, { id: 10203, name: 'Médina Gounass' }, { id: 10204, name: 'Golf Sud' }],
    103: [{ id: 10301, name: 'Pikine Ouest' }, { id: 10302, name: 'Pikine Est' }, { id: 10303, name: 'Pikine Nord' }, { id: 10304, name: 'Mbao' }, { id: 10305, name: 'Yeumbeul Nord' }, { id: 10306, name: 'Yeumbeul Sud' }],
    104: [{ id: 10401, name: 'Rufisque Est' }, { id: 10402, name: 'Rufisque Ouest' }, { id: 10403, name: 'Rufisque Nord' }, { id: 10404, name: 'Bargny' }, { id: 10405, name: 'Sébikotane' }],
    105: [{ id: 10501, name: 'Keur Massar Nord' }, { id: 10502, name: 'Keur Massar Sud' }, { id: 10503, name: 'Malika' }, { id: 10504, name: 'Jaxaay-Parcelles' }],
    // Diourbel
    201: [{ id: 20101, name: 'Diourbel Commune' }, { id: 20102, name: 'Ndindy' }, { id: 20103, name: 'Ndoulo' }],
    202: [{ id: 20201, name: 'Bambey Commune' }, { id: 20202, name: 'Baba Garage' }, { id: 20203, name: 'Lambaye' }],
    203: [{ id: 20301, name: 'Touba Mosquée' }, { id: 20302, name: 'Mbacké Commune' }, { id: 20303, name: 'Taïf' }],
    // Fatick
    301: [{ id: 30101, name: 'Fatick Commune' }, { id: 30102, name: 'Fimela' }, { id: 30103, name: 'Niakhar' }],
    302: [{ id: 30201, name: 'Foundiougne Commune' }, { id: 30202, name: 'Sokone' }, { id: 30203, name: 'Passy' }],
    303: [{ id: 30301, name: 'Gossas Commune' }, { id: 30302, name: 'Colobane' }, { id: 30303, name: 'Mbar' }],
    // Thiès
    1301: [{ id: 130101, name: 'Thiès Est' }, { id: 130102, name: 'Thiès Ouest' }, { id: 130103, name: 'Thiès Nord' }, { id: 130104, name: 'Khombole' }, { id: 130105, name: 'Pout' }],
    1302: [{ id: 130201, name: 'Mbour Commune' }, { id: 130202, name: 'Saly Portudal' }, { id: 130203, name: 'Nianing' }, { id: 130204, name: 'Joal-Fadiouth' }, { id: 130205, name: 'Sandiara' }],
    1303: [{ id: 130301, name: 'Tivaouane Commune' }, { id: 130302, name: 'Meckhe' }, { id: 130303, name: 'Pir Goureye' }, { id: 130304, name: 'Taïba Ndiaye' }]
  }
};

export default function Departements({ lang }) {
  const [regions, setRegions] = useState([]);
  const [activeRegionId, setActiveRegionId] = useState(null);
  const [departements, setDepartements] = useState([]);
  const [activeDeptId, setActiveDeptId] = useState(null);
  const [communes, setCommunes] = useState([]);
  const [loading, setLoading] = useState(true);

  const dict = {
    fr: {
      title: 'Découpage administratif',
      subtitle: 'Explorez la couverture de la mutualité de santé à travers les régions, départements et communes du Sénégal.',
      statsTitle: 'Statistiques (simulées)',
      communesTitle: 'Communes du département',
      deptTitle: 'Départements de la région',
      bureauTitle: 'Coordination régionale',
      activeMutuelles: 'Mutuelles affiliées',
      beneficiaires: 'Bénéficiaires actifs',
      structures: 'Centres agréés',
      initiatives: 'Initiatives',
      loading: 'Chargement des données API...',
      error: 'Erreur lors du chargement des données.',
      selectDept: 'Sélectionnez un département pour voir ses communes.'
    },
    wo: {
      title: 'Diiwaan yi, département yi ak commune yi',
      subtitle: 'Xoolal liggéeyu mutuelle bi ci gox yëpp ci Sénégal.',
      statsTitle: 'Chiffres yi',
      communesTitle: 'Commune yi ci département bi',
      deptTitle: 'Département yi ci diiwaan bi',
      bureauTitle: 'Bureau régional',
      activeMutuelles: 'Mutuelle yi ci book',
      beneficiaires: 'Bénéficiaires yi fay',
      structures: 'Fajukaay yi',
      initiatives: 'Liy xew',
      loading: 'Xaaral, mungi wut xibaar yi...',
      error: 'Am na luy xat.',
      selectDept: 'Tannal benn département ngir xool commune yi ci biir.'
    }
  };

  const t = dict[lang] || dict.fr;

  // Load Regions
  useEffect(() => {
    fetch('https://decoupage-administratif-api.onrender.com/api/v1/regions')
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        if (data.success && data.data && data.data.length > 0) {
          setRegions(data.data);
          setActiveRegionId(data.data[0].id);
        } else {
          throw new Error('Invalid structure or empty data');
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('Regions API failed, falling back to static data:', err);
        setRegions(staticData.regions);
        if (staticData.regions.length > 0) {
          setActiveRegionId(staticData.regions[0].id);
        }
        setLoading(false);
      });
  }, []);

  // Load Departements when Region changes
  useEffect(() => {
    if (activeRegionId) {
      setDepartements([]);
      setCommunes([]);
      setActiveDeptId(null);
      fetch(`https://decoupage-administratif-api.onrender.com/api/v1/regions/${activeRegionId}/departements`)
        .then(res => {
          if (!res.ok) throw new Error('API Error');
          return res.json();
        })
        .then(data => {
          if (data.success && data.data && data.data.length > 0) {
            setDepartements(data.data);
            setActiveDeptId(data.data[0].id);
          } else {
            throw new Error('Invalid structure or empty departments');
          }
        })
        .catch(err => {
          console.warn(`Departments API failed for region ${activeRegionId}, falling back to static data:`, err);
          const fallbackDepts = staticData.departements[activeRegionId] || [];
          setDepartements(fallbackDepts);
          if (fallbackDepts.length > 0) {
            setActiveDeptId(fallbackDepts[0].id);
          }
        });
    }
  }, [activeRegionId]);

  // Load Communes when Dept changes
  useEffect(() => {
    if (activeDeptId) {
      setCommunes([]);
      fetch(`https://decoupage-administratif-api.onrender.com/api/v1/departements/${activeDeptId}/communes`)
        .then(res => {
          if (!res.ok) throw new Error('API Error');
          return res.json();
        })
        .then(data => {
          if (data.success && data.data) {
            setCommunes(data.data);
          } else {
            throw new Error('Invalid structure');
          }
        })
        .catch(err => {
          console.warn(`Communes API failed for department ${activeDeptId}, falling back to static data:`, err);
          const fallbackCommunes = staticData.communes[activeDeptId] || [];
          setCommunes(fallbackCommunes);
        });
    }
  }, [activeDeptId]);

  const activeRegion = regions.find(r => r.id === activeRegionId);
  const activeDept = departements.find(d => d.id === activeDeptId);

  // Generate pseudo-random stats based on region id to keep UI looking rich
  const getSimulatedStats = (id) => {
    const seed = id || 1;
    return {
      mutuelles: 5 + (seed % 15),
      beneficiaries: (10000 + (seed * 5000)).toLocaleString('fr-FR'),
      structures: 10 + (seed % 20),
      president: seed === 1 ? 'Mamadou Diallo' : (seed === 2 ? 'Aminata Ndiaye' : 'Ousmane Sall'),
      initiative: lang === 'fr' 
        ? 'Campagne de sensibilisation itinérante dans les marchés locaux et inscriptions massives.' 
        : 'Liggéey ngir jox xibaar ci marse yi ak dugal nit ñi ci mutuelle bi.'
    };
  };

  const stats = getSimulatedStats(activeRegionId);

  return (
    <div className="departements-view fade-in-up">
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/bg_stats_stock.jpg") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '600px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <section className="container" style={{ padding: '2rem 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <span className="notification-dot" style={{ display: 'inline-block', width: '15px', height: '15px', position: 'static' }}></span>
            <p style={{ marginTop: '1rem', color: 'var(--neutral-dark)' }}>{t.loading}</p>
          </div>
        ) : (
          <>
            <div className="dept-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
              {regions.map((region) => (
                <button
                  key={region.id}
                  className={`dept-tab-btn ${activeRegionId === region.id ? 'active' : ''}`}
                  onClick={() => setActiveRegionId(region.id)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  {region.name}
                </button>
              ))}
            </div>

            {activeRegion && (
              <div className="dept-grid-layout">
                {/* Main Info */}
                <div className="card dept-detail-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                    <h2 style={{ color: 'var(--primary)', margin: 0 }}>
                      Région de {activeRegion.name}
                    </h2>
                    {/* Show MSDD Logo if region is Dakar (Assuming ID 1 is Dakar or name is Dakar) */}
                    {activeRegion.name.toLowerCase() === 'dakar' && (
                      <img src="/msdd_logo_corrected.png" alt="MSDD Logo" style={{ height: '50px', objectFit: 'contain' }} />
                    )}
                  </div>
                  
                  <p style={{ fontSize: '1.1rem', color: 'var(--neutral-dark)' }}>
                    {lang === 'fr' 
                      ? `La région de ${activeRegion.name} couvre plusieurs départements. Cliquez sur un département pour explorer ses communes.` 
                      : `Diiwaanu ${activeRegion.name} am na ay département yu bari. Bësal ci benn département ngir gis commune yi ci biir.`}
                  </p>
                  
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--neutral-dark)' }}>🏢 {t.deptTitle}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {departements.length > 0 ? departements.map((dept) => (
                        <button 
                          key={dept.id} 
                          className={`badge ${activeDeptId === dept.id ? 'badge-primary' : 'badge-info'}`} 
                          style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', border: 'none', cursor: 'pointer' }}
                          onClick={() => setActiveDeptId(dept.id)}
                        >
                          {dept.name}
                        </button>
                      )) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--neutral-gray)' }}>Chargement...</span>
                      )}
                    </div>
                  </div>

                  {activeDeptId && (
                    <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '12px', marginTop: '0.5rem', border: '1px solid var(--border-color)' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary)' }}>📍 {t.communesTitle} : {activeDept?.name}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {communes.length > 0 ? communes.map((commune) => (
                          <span key={commune.id} style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '20px', color: 'var(--text-main)' }}>
                            {commune.name}
                          </span>
                        )) : (
                          <span style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--neutral-gray)' }}>Chargement des communes...</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ backgroundColor: 'var(--card-bg-subtle)', padding: '1.5rem', borderRadius: '12px', marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: 'var(--secondary)' }}>🌟 {t.initiatives}</h3>
                    <p style={{ fontStyle: 'italic', fontWeight: '500' }}>{stats.initiative}</p>
                  </div>
                </div>

                {/* Stats Sidebar & Bureau */}
                <div className="map-sidebar">
                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>📊 {t.statsTitle}</h3>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{t.activeMutuelles}</span>
                      <span className="badge badge-info" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{stats.mutuelles}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{t.beneficiaires}</span>
                      <span className="badge badge-success" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{stats.beneficiaries}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '500' }}>{t.structures}</span>
                      <span className="badge badge-warning" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{stats.structures}</span>
                    </div>
                  </div>

                  <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>👥 {t.bureauTitle}</h3>
                    
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--neutral-gray)', textTransform: 'uppercase' }}>Président / coordinateur</div>
                      <div style={{ fontWeight: '700', color: 'var(--neutral-dark)' }}>{stats.president}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
