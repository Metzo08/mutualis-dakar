import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';

const generateMockMutuelle = (communeName, regionName) => {
  let hash = 0;
  for (let i = 0; i < communeName.length; i++) {
    hash = communeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const id = Math.abs(hash);
  const managers = [
    'Mamadou Ndiaye', 'Awa Diop', 'Cheikh Tidiane Sy', 'Fatou Sow', 
    'Abdoulaye Wade', 'Ousmane Sonko', 'Mariama Ba', 'Idrissa Seck',
    'Youssou Ndour', 'Aminata Toure', 'Boubacar Kamara', 'Khady Diene'
  ];
  const manager = managers[id % managers.length];
  const phone = `+221 33 8${(id % 900) + 100} ${(id % 90) + 10} ${(id % 90) + 10}`;
  const agreement = `AG-COMM-${regionName.substring(0, 3).toUpperCase()}-${(id % 9000) + 1000}`;
  const email = `mutuelle.${communeName.toLowerCase().replace(/[^a-z0-9]/g, '')}@mutualis.sn`;
  
  let lat = 14.6937;
  let lng = -17.4474;
  if (regionName.toLowerCase() === 'dakar') {
    lat = 14.68 + ((id % 15) * 0.01);
    lng = -17.5 + ((id % 20) * 0.01);
  } else {
    lat = 12.5 + ((id % 40) * 0.1);
    lng = -16.5 + ((id % 40) * 0.1);
  }

  const structures = [
    `Poste de santé de ${communeName}`,
    `Centre de santé de ${communeName}`,
    `Pharmacie de la commune de ${communeName}`
  ];

  return {
    name: `Mutuelle de Santé Communautaire de ${communeName}`,
    region: regionName,
    commune: communeName,
    status: 'active',
    agreement,
    manager,
    phone,
    email,
    rates: '4 500 FCFA / an par bénéficiaire',
    services: `Tiers-payant à 80% pour les consultations, 50% pour les médicaments essentiels. Conventionné avec : ${structures.join(', ')}.`,
    certified: true,
    lastUpdate: '28/06/2026',
    lat,
    lng,
    landmark: `Près de la Mairie de la commune de ${communeName}.`,
    localInfo: `Cette mutuelle assure la couverture maladie universelle pour les résidents de la commune de ${communeName}. Elle facilite l'accès aux soins de santé de base.`
  };
};

const generateMockUnion = (deptName, regionName) => {
  let hash = 0;
  for (let i = 0; i < deptName.length; i++) {
    hash = deptName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const id = Math.abs(hash);
  const managers = ['Assane Diop', 'Cheikh Sarr', 'Idrissa Wade', 'Amadou Diop', 'Ousmane Ndiaye', 'Ibrahima Fall', 'Saliou Diallo', 'Lamine Sané'];
  const manager = deptName.toLowerCase() === 'dakar' ? 'Moustapha Mbengue' : managers[id % managers.length];
  const phone = `+221 33 8${(id % 900) + 100} ${(id % 90) + 10} ${(id % 90) + 10}`;
  const email = `ud.${deptName.toLowerCase().replace(/[^a-z0-9]/g, '')}@unamusc.sn`;
  const agreement = `UD-${regionName.substring(0, 2).toUpperCase()}-${(id % 900) + 100}-${(id % 90) + 10}`;
  
  let mapLink = null;
  if (deptName.toLowerCase() === 'dakar') {
    mapLink = 'https://maps.app.goo.gl/R9A7mhL9jxArCXUU8';
  }

  return {
    name: `MSD mutuelle de santé départementale de ${deptName}`,
    region: regionName,
    commune: deptName,
    manager,
    phone,
    email,
    agreement,
    map_link: mapLink,
    landmark: `Près de la préfecture de ${deptName}.`,
    local_info: `La MSD regroupe l'ensemble des mutuelles communales du département de ${deptName} et en assure la supervision administrative.`
  };
};

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

export default function Departements({ lang, setView }) {
  const [activeRegionId, setActiveRegionId] = useState(null);
  const [activeDeptId, setActiveDeptId] = useState(null);
  const [selectedMutuelle, setSelectedMutuelle] = useState(null);
  const [hoveredCommuneId, setHoveredCommuneId] = useState(null);
  const [hoveredDeptId, setHoveredDeptId] = useState(null);

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
      selectDept: 'Sélectionnez un département pour voir ses communes.',
      modalManager: 'Président / Gérant',
      modalContact: 'Contact téléphone',
      modalEmail: 'Email',
      modalRates: 'Tarif / Cotisation',
      modalServices: 'Structures & Services conventionnés',
      modalCertified: 'Agréée par l\'état',
      modalLastUpdate: 'Dernière mise à jour',
      yes: 'Oui',
      no: 'Non',
      viewOnMap: 'Voir sur la carte',
      close: 'Fermer'
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
      selectDept: 'Tannal benn département ngir xool commune yi ci biir.',
      modalManager: 'Njiit li / Gérant bi',
      modalContact: 'Téléphone',
      modalEmail: 'Email',
      modalRates: 'Fay bi',
      modalServices: 'Fajukaay yi conventionné',
      modalCertified: 'Agréer na ko nguur gi',
      modalLastUpdate: 'Mise à jour mudj',
      yes: 'Waaw',
      no: 'Déet',
      viewOnMap: 'Xool ci kàrt bi',
      close: 'Tëj'
    }
  };

  const t = dict[lang] || dict.fr;

  const handleCommuneClick = async (commune) => {
    // 1. Chercher dans la base de données réelle d'abord
    try {
      const response = await fetch(`http://localhost:5000/api/mutuelles?search=${encodeURIComponent(commune.name)}`);
      if (response.ok) {
        const data = await response.json();
        // Chercher une correspondance exacte sur la commune
        const match = data.find(m => m.commune.toLowerCase() === commune.name.toLowerCase());
        if (match) {
          setSelectedMutuelle({
            name: match.name,
            region: match.region,
            commune: match.commune,
            manager: match.manager,
            phone: match.phone,
            email: match.email,
            rates: match.rates || '4 500 FCFA / an',
            services: match.services,
            certified: match.certified,
            lastUpdate: match.last_update,
            landmark: match.landmark,
            localInfo: match.local_info,
            lat: match.lat,
            lng: match.lng
          });
          return;
        }
      }
    } catch (e) {
      console.warn("Erreur fetch mutuelle, utilisation du fallback mock:", e);
    }

    // 2. Si non trouvée, générer des données de test réalistes et déterministes
    const regionName = activeRegion ? activeRegion.name : 'Dakar';
    const mock = generateMockMutuelle(commune.name, regionName);
    setSelectedMutuelle(mock);
  };

  // 1. Fetch Regions
  const { data: regions = [], isLoading: loading } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => {
      const res = await fetch('https://decoupage-administratif-api.onrender.com/api/v1/regions');
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        return data.data;
      }
      return staticData.regions;
    },
    initialData: staticData.regions
  });

  // Set initial active region when regions data is loaded
  useEffect(() => {
    if (regions.length > 0 && !activeRegionId) {
      setActiveRegionId(regions[0].id);
    }
  }, [regions, activeRegionId]);

  // 2. Fetch Departements when Region changes
  const { data: departements = [] } = useQuery({
    queryKey: ['departements', activeRegionId],
    queryFn: async () => {
      if (!activeRegionId) return [];
      try {
        const res = await fetch(`https://decoupage-administratif-api.onrender.com/api/v1/regions/${activeRegionId}/departements`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        if (data.success && data.data && data.data.length > 0) {
          return data.data;
        }
      } catch (err) {
        console.warn(`Departments API failed for region ${activeRegionId}, falling back to static data:`, err);
      }
      return staticData.departements[activeRegionId] || [];
    },
    enabled: !!activeRegionId
  });

  // Set initial active department when departments data is loaded
  useEffect(() => {
    if (departements.length > 0) {
      const belongs = departements.some(d => d.id === activeDeptId);
      if (!belongs) {
        setActiveDeptId(departements[0].id);
      }
    } else {
      setActiveDeptId(null);
    }
  }, [departements, activeDeptId]);

  // 3. Fetch Communes when Dept changes
  const { data: communes = [] } = useQuery({
    queryKey: ['communes', activeDeptId],
    queryFn: async () => {
      if (!activeDeptId) return [];
      try {
        const res = await fetch(`https://decoupage-administratif-api.onrender.com/api/v1/departements/${activeDeptId}/communes`);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        if (data.success && data.data) {
          return data.data;
        }
      } catch (err) {
        console.warn(`Communes API failed for department ${activeDeptId}, falling back to static data:`, err);
      }
      return staticData.communes[activeDeptId] || [];
    },
    enabled: !!activeDeptId
  });

  // Lookup active objects
  const activeRegion = regions.find(r => r.id === activeRegionId);
  const activeDept = departements.find(d => d.id === activeDeptId);

  // 4. Fetch Union Départementale when Dept changes
  const { data: activeDeptUnion = null } = useQuery({
    queryKey: ['deptUnion', activeDeptId, activeDept?.name, activeRegion?.name],
    queryFn: async () => {
      if (!activeDeptId || !activeDept) return null;
      try {
        const queryName = `MSD mutuelle de santé départementale de ${activeDept.name}`;
        const response = await fetch(`http://localhost:5000/api/mutuelles?search=${encodeURIComponent(queryName)}`);
        if (response.ok) {
          const data = await response.json();
          const match = data.find(m => m.name.toLowerCase().includes(activeDept.name.toLowerCase()) && (m.name.toLowerCase().includes('union') || m.name.toLowerCase().includes('udms') || m.name.toLowerCase().includes('msd') || m.name.toLowerCase().includes('mutuelle')));
          if (match) {
            return match;
          }
        }
      } catch (e) {
        console.warn("Erreur fetch union départementale, fallback mock:", e);
      }
      return generateMockUnion(activeDept.name, activeRegion ? activeRegion.name : 'Dakar');
    },
    enabled: !!activeDeptId && !!activeDept
  });


  // Generate pseudo-random stats based on region id to keep UI looking rich
  const getSimulatedStats = (id) => {
    const seed = id || 1;
    const regionName = activeRegion ? activeRegion.name.toLowerCase() : 'dakar';
    return {
      mutuelles: 5 + (seed % 15),
      beneficiaries: (10000 + (seed * 5000)).toLocaleString('fr-FR'),
      structures: 10 + (seed % 20),
      president: regionName === 'dakar' ? 'Moustapha Mbengue' : (seed === 2 ? 'Aminata Ndiaye' : 'Ousmane Sall'),
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
                      <img src="/udmsdk_logo.png" alt="MSD mutuelle de santé départementale de Dakar" style={{ height: '50px', objectFit: 'contain' }} />
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
                      {departements.length > 0 ? departements.map((dept) => {
                        const isActive = activeDeptId === dept.id;
                        return (
                          <button 
                            key={dept.id} 
                            onClick={() => setActiveDeptId(dept.id)}
                            onMouseEnter={() => setHoveredDeptId(dept.id)}
                            onMouseLeave={() => setHoveredDeptId(null)}
                            style={{
                              fontSize: '0.85rem',
                              padding: '0.5rem 1.25rem',
                              borderRadius: '30px',
                              border: isActive ? '1px solid var(--primary)' : (hoveredDeptId === dept.id ? '1px solid var(--text-main)' : '1px solid var(--border-color)'),
                              backgroundColor: isActive ? 'var(--primary)' : (hoveredDeptId === dept.id ? 'rgba(5, 150, 105, 0.08)' : 'var(--bg-card-subtle)'),
                              color: isActive ? '#ffffff' : 'var(--text-main)',
                              cursor: 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: isActive ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}
                          >
                            🏢 {dept.name}
                          </button>
                        );
                      }) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Chargement...</span>
                      )}
                    </div>
                  </div>

                  {activeDeptId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                      {/* Union Départementale Card */}
                      {activeDeptUnion && (
                        <div style={{ 
                          backgroundColor: 'var(--bg-card)', 
                          padding: '1.5rem', 
                          borderRadius: '12px', 
                          border: '1px solid var(--border-color)',
                          borderLeft: '4px solid var(--primary)',
                          boxShadow: 'var(--shadow-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {activeDeptUnion.name.toLowerCase().includes('dakar') && (
                                <img src="/udmsdk_logo.png" alt="Logo MSD Dakar" style={{ height: '35px', objectFit: 'contain' }} />
                              )}
                              <h3 style={{ fontSize: '1.15rem', color: 'var(--primary)', margin: 0, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                🛡️ {activeDeptUnion.name}
                              </h3>
                            </div>
                            <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>Union Agréée ✅</span>
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                            <div>
                              <strong style={{ color: 'var(--neutral-gray)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.modalManager}</strong>
                              <span style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{activeDeptUnion.manager}</span>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--neutral-gray)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.modalContact}</strong>
                              <span style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{activeDeptUnion.phone}</span>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--neutral-gray)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.modalEmail}</strong>
                              <span style={{ fontWeight: '600', color: 'var(--neutral-dark)', fontFamily: 'monospace' }}>{activeDeptUnion.email}</span>
                            </div>
                            <div>
                              <strong style={{ color: 'var(--neutral-gray)', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase' }}>Agrément Faitière</strong>
                              <span style={{ fontWeight: '600', color: 'var(--secondary)' }}>{activeDeptUnion.agreement}</span>
                            </div>
                          </div>

                          {(activeDeptUnion.map_link || activeDeptUnion.landmark) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.4' }}>
                                📍 <strong style={{ color: 'var(--text-main)' }}>Repère :</strong> {activeDeptUnion.landmark}
                              </span>
                              {(activeDeptUnion.map_link || activeDeptUnion.name.toLowerCase().includes('dakar')) && (
                                <a 
                                  href={activeDeptUnion.map_link || 'https://maps.app.goo.gl/R9A7mhL9jxArCXUU8'} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-xs"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: '600', borderRadius: '6px' }}
                                >
                                  🗺️ Google Maps
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Communes de ce département */}
                      <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.1rem', color: 'var(--primary)', fontWeight: '700' }}>📍 {t.communesTitle} : {activeDept?.name}</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {communes.length > 0 ? communes.map((commune) => (
                            <button
                              key={commune.id}
                              onClick={() => handleCommuneClick(commune)}
                              onMouseEnter={() => setHoveredCommuneId(commune.id)}
                              onMouseLeave={() => setHoveredCommuneId(null)}
                              style={{
                                fontSize: '0.85rem',
                                padding: '0.4rem 1rem',
                                backgroundColor: hoveredCommuneId === commune.id ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-card)',
                                border: hoveredCommuneId === commune.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                borderRadius: '20px',
                                color: hoveredCommuneId === commune.id ? 'var(--primary)' : 'var(--text-main)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: hoveredCommuneId === commune.id ? '0 2px 6px rgba(5, 150, 105, 0.15)' : 'none',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              🏢 {commune.name}
                            </button>
                          )) : (
                            <span style={{ fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--neutral-gray)' }}>Chargement des communes...</span>
                          )}
                        </div>
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

      {/* Detailed Modal Popup for Communes Mutuelle */}
      {selectedMutuelle && createPortal(
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '2000', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in-up" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem', paddingRight: '2rem', margin: 0, fontWeight: '700' }}>
              {selectedMutuelle.name}
            </h2>
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedMutuelle(null)} 
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--neutral-gray)' }}
            >
              ✕
            </button>

            <div>
              <span className="badge badge-info" style={{ marginRight: '0.5rem' }}>{selectedMutuelle.region}</span>
              <span className="badge badge-success">{selectedMutuelle.commune}</span>
              <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>Active ✅</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--neutral-gray)', textTransform: 'uppercase', display: 'block' }}>{t.modalManager}</strong>
                <span style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{selectedMutuelle.manager}</span>
              </div>
              
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--neutral-gray)', textTransform: 'uppercase', display: 'block' }}>{t.modalContact}</strong>
                <span style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{selectedMutuelle.phone}</span>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--neutral-gray)', textTransform: 'uppercase', display: 'block' }}>{t.modalEmail}</strong>
                <span style={{ fontWeight: '600', color: 'var(--neutral-dark)', fontFamily: 'monospace' }}>{selectedMutuelle.email}</span>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--neutral-gray)', textTransform: 'uppercase', display: 'block' }}>{t.modalRates}</strong>
                <span style={{ fontWeight: '600', color: 'var(--secondary)' }}>{selectedMutuelle.rates}</span>
              </div>

              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--neutral-gray)', textTransform: 'uppercase', display: 'block' }}>{t.modalServices}</strong>
                <span style={{ fontSize: '0.9rem', color: 'var(--neutral-dark)', lineHeight: '1.4' }}>{selectedMutuelle.services}</span>
              </div>

              {selectedMutuelle.landmark && (
                <div className="info-box-landmark" style={{ padding: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>📍</span>
                  <div>
                    <strong className="info-box-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Point de repère</strong>
                    <span className="info-box-text" style={{ fontSize: '0.85rem', fontWeight: '500' }}>{selectedMutuelle.landmark}</span>
                  </div>
                </div>
              )}

              {selectedMutuelle.localInfo && (
                <div className="info-box-tips" style={{ padding: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.25rem', borderRadius: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>💡</span>
                  <div>
                    <strong className="info-box-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Infos zone</strong>
                    <span className="info-box-text" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{selectedMutuelle.localInfo}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span>{t.modalCertified} : <strong>{t.yes}</strong></span>
                <span style={{ color: 'var(--neutral-gray)' }}>{t.modalLastUpdate} : {selectedMutuelle.lastUpdate}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => {
                  setSelectedMutuelle(null);
                  if (typeof setView === 'function') {
                    setView('map');
                  }
                }}
              >
                🗺️ {t.viewOnMap}
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setSelectedMutuelle(null)}>
                {t.close}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
