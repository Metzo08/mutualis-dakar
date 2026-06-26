import React, { useState, useEffect, useRef } from 'react';

export default function BaseNationale({ lang, setView }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMutuelle, setSelectedMutuelle] = useState(null); // Detailed modal state
  const [communesData, setCommunesData] = useState([]);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  const dict = {
    fr: {
      title: 'Répertoire national des mutuelles',
      subtitle: 'Accédez à l\'annuaire complet de toutes les mutuelles de santé communautaires agréées au Sénégal.',
      searchPlaceholder: 'Rechercher par nom de mutuelle, commune...',
      filterRegion: 'Filtrer par région',
      filterStatus: 'Statut',
      allRegions: 'Toutes les régions',
      allStatus: 'Tous les statuts',
      exportPdf: 'Exporter en PDF',
      exportExcel: 'Exporter en Excel',
      thName: 'Nom de la mutuelle',
      thRegion: 'Région',
      thCommune: 'Commune',
      thStatus: 'Statut',
      thAgreement: 'N° agrément',
      thAction: 'Actions',
      btnJoin: 'Bokk / adhérer',
      btnDetails: 'Détails',
      exportSuccess: 'Exportation réussie ! Fichier enregistré dans vos téléchargements.',
      modalTitle: 'Fiche détaillée de la mutuelle',
      modalManager: 'Responsable',
      modalContact: 'Contact portable',
      modalEmail: 'Adresse e-mail',
      modalRates: 'Tarif cotisation',
      modalServices: 'Services offerts',
      modalCertified: 'Certifiée UNAMUSC',
      modalLastUpdate: 'Dernière mise à jour',
      yes: 'Oui (agréée)',
      no: 'Non certifiée'
    },
    wo: {
      title: 'Répertoire Mutuelle yi ci Sénégal',
      subtitle: 'Xoolal répertoire bi tënk mutuelle wér-gi-yaram yi nekk ci réew mi.',
      searchPlaceholder: 'Seet ci tour bi, commune...',
      filterRegion: 'Tânn région',
      filterStatus: 'Statut',
      allRegions: 'Région yëpp',
      allStatus: 'Statut yëpp',
      exportPdf: 'Yóbbu PDF',
      exportExcel: 'Yóbbu Excel',
      thName: 'Touru mutuelle bi',
      thRegion: 'Région',
      thCommune: 'Commune',
      thStatus: 'Statut',
      thAgreement: 'N° agrément',
      thAction: 'Liy xew',
      btnJoin: 'Bokk',
      btnDetails: 'Xoolal',
      exportSuccess: 'Yóbbu nanu ko ! Fichier bi duggal na ci sa téléchargements.',
      modalTitle: 'Details mutuelle bi',
      modalManager: 'Njiit bi',
      modalContact: 'Portable',
      modalEmail: 'Email',
      modalRates: 'Fay bi',
      modalServices: 'Fajukaay yi',
      modalCertified: 'Certifiée UNAMUSC',
      modalLastUpdate: 'Mise à jour',
      yes: 'Waw (agréée)',
      no: 'Baaxul'
    }
  };

  const t = dict[lang];

  // Simulated national dataset with complete details
  const dataset = [
    { 
      id: 1, 
      name: 'Mutuelle de la Médina', 
      region: 'Dakar', 
      commune: 'Médina', 
      status: 'active', 
      agreement: 'DK-012-2022',
      manager: 'Moussa Fall',
      phone: '+221 77 500 11 22',
      email: 'medina@mutualisdakar.sn',
      rates: '4 500 FCFA / an (Individuel) | 1 000 FCFA carte + 3 500 FCFA/membre (Famille)',
      services: 'Prise en charge consultations (80%), pharmacie (50%), hôpital (70%)',
      certified: true,
      lastUpdate: '18/05/2026',
      landmark: "Située en face du dispensaire Blaise Diagne, Rue 22 angle Blaise Diagne.",
      localInfo: "La Médina propose des permanences d'accueil pour la CMU tous les matins de 8h à 12h."
    },
    { 
      id: 2, 
      name: 'Mutuelle de Pikine Ouest', 
      region: 'Dakar', 
      commune: 'Pikine Ouest', 
      status: 'active', 
      agreement: 'DK-088-2023',
      manager: 'Fatou Wade',
      phone: '+221 77 622 33 44',
      email: 'pikineouest@mutualisdakar.sn',
      rates: '4 500 FCFA / an (Individuel) | 1 000 FCFA carte + 3 500 FCFA/membre (Famille)',
      services: 'Consultations de maternité (90%), pharmacie (60%), hospitalisation (75%)',
      certified: true,
      lastUpdate: '10/06/2026',
      landmark: "À côté du bureau de poste principal de Pikine, près de l'ancien cinéma.",
      localInfo: "Idéale pour les résidents de Pikine Ouest. Permet le remboursement à 90% pour les soins de maternité de proximité."
    },
    { 
      id: 3, 
      name: 'Mutuelle de Mbour Escale', 
      region: 'Thiès', 
      commune: 'Mbour', 
      status: 'active', 
      agreement: 'TH-023-2020',
      manager: 'Ousmane Sene',
      phone: '+221 77 411 99 88',
      email: 'mbour.escale@unamusc.sn',
      rates: '4 500 FCFA / an',
      services: 'Soins de base (80%), pharmacie (50%)',
      certified: true,
      lastUpdate: '04/04/2026',
      landmark: "Près du grand carrefour d'Escale, à côté de la gare routière de Mbour.",
      localInfo: "Offre une couverture maladie élargie sur toute la Petite Côte. Facile d'accès pour les commerçants du centre."
    },
    { 
      id: 4, 
      name: 'Mutuelle de Kaolack Ndangane', 
      region: 'Kaolack', 
      commune: 'Kaolack', 
      status: 'active', 
      agreement: 'KL-045-2021',
      manager: 'Ami Diop',
      phone: '+221 77 810 20 30',
      email: 'kaolack.nd@unamusc.sn',
      rates: '8 000 FCFA / an',
      services: 'Consultations (80%), soins pédiatriques (90%), pharmacie (60%)',
      certified: true,
      lastUpdate: '12/03/2026',
      landmark: "Quartier Ndangane, près du poste de santé local, en face du collège franco-arabe.",
      localInfo: "Propose une prise en charge rapide au centre de santé et à l'hôpital régional de Kaolack."
    },
    { 
      id: 5, 
      name: 'Mutuelle de Saint-Louis Sor', 
      region: 'Saint-Louis', 
      commune: 'Saint-Louis Sor', 
      status: 'active', 
      agreement: 'SL-010-2019',
      manager: 'Cheikh Diallo',
      phone: '+221 77 912 34 56',
      email: 'sl.sor@unamusc.sn',
      rates: '7 500 FCFA / an',
      services: 'Consultations (80%), pharmacie (50%), soins spécialisés (60%)',
      certified: true,
      lastUpdate: '20/05/2026',
      landmark: "Quartier Sor, en face de la gare ferroviaire TER historique, à 100m du pont Faidherbe.",
      localInfo: "Conventionnée avec l'hôpital régional de Saint-Louis et les pharmacies partenaires de l'île de Saint-Louis."
    },
    { 
      id: 6, 
      name: 'Mutuelle de Ziguinchor Boudody', 
      region: 'Ziguinchor', 
      commune: 'Ziguinchor', 
      status: 'active', 
      agreement: 'ZG-052-2022',
      manager: 'Mariama Sané',
      phone: '+221 77 567 89 01',
      email: 'boudody@unamusc.sn',
      rates: '6 000 FCFA / an',
      services: 'Soins infirmiers (80%), pharmacie (50%), maternité (80%)',
      certified: false,
      lastUpdate: '14/02/2026',
      landmark: "Quartier Boudody, juste derrière le quai de pêche de Ziguinchor.",
      localInfo: "Très active auprès des coopératives de transformation des produits de la mer. Propose des facilités d'adhésion."
    },
    { 
      id: 7, 
      name: 'Mutuelle de Touba Mosquée', 
      region: 'Diourbel', 
      commune: 'Touba', 
      status: 'active', 
      agreement: 'DB-211-2024',
      manager: 'Serigne Fallou Mbacké',
      phone: '+221 77 400 55 66',
      email: 'toubamosquee@unamusc.sn',
      rates: '8 000 FCFA / an',
      services: 'Prise en charge complète dans les dispensaires de Touba (85%)',
      certified: true,
      lastUpdate: '17/06/2026',
      landmark: "À 200m du grand minaret de la Grande Mosquée de Touba, en face du marché central.",
      localInfo: "Facilite l'orientation médicale et la prise en charge à 85% dans les hôpitaux Matlaboul Fawzaini et dispensaires de Touba."
    },
    { 
      id: 8, 
      name: 'Mutuelle de Louga Centre', 
      region: 'Louga', 
      commune: 'Louga', 
      status: 'en_sommeil', 
      agreement: 'LG-015-2020',
      manager: 'Babacar Cissé',
      phone: '+221 77 234 56 78',
      email: 'louga.c@unamusc.sn',
      rates: '4 500 FCFA / an',
      services: 'Soins de base (70%)',
      certified: false,
      lastUpdate: '02/01/2025',
      landmark: "Centre-ville de Louga, derrière la préfecture de département.",
      localInfo: "Cette mutuelle est actuellement en restructuration. Pour toute question urgente, veuillez vous rapprocher de l'Union Départementale de Louga."
    },
    { 
      id: 9, 
      name: 'Union départementale de Rufisque', 
      region: 'Dakar', 
      commune: 'Rufisque Est', 
      status: 'active', 
      agreement: 'UD-DK-003-2018',
      manager: 'Amadou Diop',
      phone: '+221 33 871 12 12',
      email: 'ud.rufisque@unamusc.sn',
      rates: 'Cotisation des mutuelles (Fétière)',
      services: 'Coordination, appui technique, réassurance',
      certified: true,
      lastUpdate: '15/06/2026',
      landmark: "Rufisque Est, à côté de la gare TER, près de la préfecture de Rufisque.",
      localInfo: "Structure faîtière regroupant toutes les mutuelles de santé communautaires du département de Rufisque."
    },
    { 
      id: 10, 
      name: 'Mutuelle de Rufisque Nord', 
      region: 'Dakar', 
      commune: 'Rufisque Nord', 
      status: 'active', 
      agreement: 'DK-105-2021',
      manager: 'Awa Ndiaye',
      phone: '+221 77 123 45 67',
      email: 'rufisquenord@mutualisdakar.sn',
      rates: '4 500 FCFA / an',
      services: 'Prise en charge consultations (80%), pharmacie (50%)',
      certified: true,
      lastUpdate: '01/04/2026',
      landmark: "Près du rond-point colobane de Rufisque, à côté du centre de santé de Rufisque.",
      localInfo: "Propose des permanences d'information tous les samedis matin pour les familles vulnérables."
    },
    { 
      id: 11, 
      name: 'Union départementale de Guédiawaye', 
      region: 'Dakar', 
      commune: 'Golf Sud', 
      status: 'active', 
      agreement: 'UD-DK-004-2019',
      manager: 'Cheikh Sarr',
      phone: '+221 33 862 33 44',
      email: 'ud.guediawaye@unamusc.sn',
      rates: 'Cotisation des mutuelles (Fétière)',
      services: 'Coordination départementale, formation',
      certified: true,
      lastUpdate: '20/05/2026',
      landmark: "Quartier Golf Sud, à 300m du grand stade de Guédiawaye Amadou Barry.",
      localInfo: "Coordonne les actions des mutuelles de la zone de Guédiawaye et aide à la numérisation des cartes CMU."
    },
    { 
      id: 12, 
      name: 'Mutuelle de Golf Sud', 
      region: 'Dakar', 
      commune: 'Golf Sud', 
      status: 'active', 
      agreement: 'DK-092-2022',
      manager: 'Khady Ba',
      phone: '+221 77 987 65 43',
      email: 'golfsud@mutualisdakar.sn',
      rates: '6 500 FCFA / an',
      services: 'Consultations (80%), Maternité (90%)',
      certified: true,
      lastUpdate: '11/06/2026',
      landmark: "Golf Sud, en face de la mosquée de la Cité des Enseignants.",
      localInfo: "Prise en charge très avantageuse pour les consultations de maternité à la clinique locale conventionnée."
    },
    { 
      id: 13, 
      name: 'Union Départementale de Thiès', 
      region: 'Thiès', 
      commune: 'Thiès Nord', 
      status: 'active', 
      agreement: 'UD-TH-001-2017',
      manager: 'Ibrahima Fall',
      phone: '+221 33 951 00 11',
      email: 'ud.thies@unamusc.sn',
      rates: 'Cotisation des mutuelles (Fétière)',
      services: 'Coordination départementale, supervision',
      certified: true,
      lastUpdate: '05/01/2026',
      landmark: "Thiès, près de la Place de France, à côté de l'ancienne Gare de Thiès.",
      localInfo: "Bureau central d'appui pour toutes les mutuelles de la région et du département de Thiès."
    },
    { 
      id: 14, 
      name: 'Union Départementale de Ziguinchor', 
      region: 'Ziguinchor', 
      commune: 'Ziguinchor', 
      status: 'active', 
      agreement: 'UD-ZG-001-2018',
      manager: 'Lamine Sané',
      phone: '+221 33 991 22 33',
      email: 'ud.ziguinchor@unamusc.sn',
      rates: 'Cotisation des mutuelles (Fétière)',
      services: 'Gestion des risques, appui technique',
      certified: true,
      lastUpdate: '10/02/2026',
      landmark: "Ziguinchor, non loin de la préfecture, près du rond-point Aline Sitoé Diatta.",
      localInfo: "Appui à la structuration des mutuelles communautaires en zone rurale dans toute la Casamance."
    }
  ];

  const [mutuelles, setMutuelles] = useState(dataset);
  const [showMap, setShowMap] = useState(true);

  useEffect(() => {
    // Récupération des mutuelles depuis l'API avec fusion des données locales détaillées
    fetch('http://localhost:5000/api/mutuelles')
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          const mapped = data.map(item => {
            // Fusion avec les données locales enrichies si l'API ne fournit pas tous les champs
            const localMatch = dataset.find(d => d.name === item.name || d.id === item.id);
            return {
              id: item.id,
              name: item.name,
              region: item.region || (localMatch ? localMatch.region : ''),
              commune: item.commune || (localMatch ? localMatch.commune : ''),
              status: item.status || (localMatch ? localMatch.status : 'active'),
              agreement: item.agreement || (localMatch ? localMatch.agreement : ''),
              manager: item.manager || (localMatch ? localMatch.manager : ''),
              phone: item.phone || (localMatch ? localMatch.phone : ''),
              email: item.email || (localMatch ? localMatch.email : ''),
              rates: item.rates || (localMatch ? localMatch.rates : ''),
              services: item.services || (localMatch ? localMatch.services : ''),
              certified: item.certified !== undefined ? item.certified : (localMatch ? localMatch.certified : false),
              lastUpdate: item.last_update || item.lastUpdate || (localMatch ? localMatch.lastUpdate : ''),
              landmark: item.landmark || (localMatch ? localMatch.landmark : ''),
              localInfo: item.local_info || item.localInfo || (localMatch ? localMatch.localInfo : '')
            };
          });
          // Fusion : on ajoute les mutuelles du dataset local qui ne sont pas renvoyées par l'API
          const missingLocals = dataset.filter(d => !mapped.some(m => m.name === d.name || m.id === d.id));
          setMutuelles([...mapped, ...missingLocals]);
        }
      })
      .catch(err => {
        console.warn('Erreur API (utilisation du fallback local) :', err);
      });
  }, []);

  // Fetch Communes Data from Administrative API
  useEffect(() => {
    fetch('https://decoupage-administratif-api.onrender.com/api/v1/communes')
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setCommunesData(data.data);
        }
      })
      .catch(err => console.error('Erreur récupération communes API:', err));
  }, []);

  // Filtering logic
  const filteredData = mutuelles.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.commune.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = regionFilter === 'all' || item.region === regionFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesRegion && matchesStatus;
  });

  // Leaflet Map Initialization and Marker Update
  const routingControlRef = useRef(null);

  const handleCalculateRoute = (mutuelle) => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    const communeName = mutuelle.commune.toLowerCase().trim();
    const communeInfo = communesData.find(c => c.name.toLowerCase().trim() === communeName);
    
    let lat = communeInfo?.lat;
    let lon = communeInfo?.lon;

    if (!lat || !lon) {
      if (mutuelle.region === 'Dakar') { lat = 14.7167; lon = -17.4677; }
      else if (mutuelle.region === 'Thiès') { lat = 14.791; lon = -16.926; }
      else if (mutuelle.region === 'Kaolack') { lat = 14.133; lon = -16.253; }
      else if (mutuelle.region === 'Saint-Louis') { lat = 16.032; lon = -16.481; }
      else if (mutuelle.region === 'Ziguinchor') { lat = 12.583; lon = -16.273; }
      else if (mutuelle.region === 'Diourbel') { lat = 14.656; lon = -16.234; }
      else if (mutuelle.region === 'Louga') { lat = 15.618; lon = -16.224; }
    }

    if (!lat || !lon) {
      alert("Coordonnées de la mutuelle introuvables.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        if (routingControlRef.current && mapRef.current) {
          mapRef.current.removeControl(routingControlRef.current);
        }

        if (window.L && window.L.Routing) {
          routingControlRef.current = window.L.Routing.control({
            waypoints: [
              window.L.latLng(userLat, userLng),
              window.L.latLng(lat, lon)
            ],
            routeWhileDragging: true,
            addWaypoints: true,
            show: true,
            collapsible: true,
            language: 'fr',
            lineOptions: {
              styles: [{ color: '#059669', opacity: 0.8, weight: 6 }]
            }
          }).addTo(mapRef.current);
          
          setSelectedMutuelle(null);
          document.getElementById('annuaire-map')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
      (err) => {
        console.error("Erreur GPS: ", err);
        alert("Impossible d'obtenir votre position. Vérifiez vos paramètres GPS.");
      }
    );
  };

  useEffect(() => {
    return () => {
      if (routingControlRef.current && mapRef.current) {
        mapRef.current.removeControl(routingControlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!window.L) return;

    if (!mapRef.current) {
      mapRef.current = window.L.map('annuaire-map', {
        center: [14.6928, -17.4467], // Default center on Dakar
        zoom: 11,
        zoomControl: true
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapRef.current);

      markersGroupRef.current = window.L.featureGroup().addTo(mapRef.current);
    }

    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }

    // Call invalidateSize if map is shown to prevent rendering bugs
    if (showMap && mapRef.current) {
      setTimeout(() => mapRef.current.invalidateSize(), 100);
    }

    let bounds = [];

    // Add markers for filtered data
    filteredData.forEach(mutuelle => {
      // Clean string matching for commune
      const communeName = mutuelle.commune.toLowerCase().trim();
      const communeInfo = communesData.find(c => c.name.toLowerCase().trim() === communeName);
      
      let lat = communeInfo?.lat;
      let lon = communeInfo?.lon;

      // Some hardcoded fallback if API misses (optional)
      if (!lat || !lon) {
        if (mutuelle.region === 'Dakar') { lat = 14.7167; lon = -17.4677; }
        else if (mutuelle.region === 'Thiès') { lat = 14.791; lon = -16.926; }
        else if (mutuelle.region === 'Kaolack') { lat = 14.133; lon = -16.253; }
        else if (mutuelle.region === 'Saint-Louis') { lat = 16.032; lon = -16.481; }
      }

      if (lat && lon) {
        const markerColor = mutuelle.status === 'active' ? 'var(--success)' : 'var(--danger)';
        const svgIcon = `
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="${markerColor}" />
            <circle cx="12" cy="12" r="4" fill="white" />
          </svg>
        `;

        const customIcon = window.L.divIcon({
          html: svgIcon,
          className: 'custom-map-icon',
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const marker = window.L.marker([lat, lon], { icon: customIcon })
          .bindPopup(`
            <div style="font-family: var(--font-body); padding: 10px; min-width: 220px; text-align: left; line-height: 1.4;">
              <div style="font-size: 0.65rem; color: #fff; background: ${markerColor}; display: inline-block; padding: 2px 6px; border-radius: 4px; margin-bottom: 5px; font-weight: bold;">
                ${mutuelle.status === 'active' ? 'AGRÉÉE' : 'EN SOMMEIL'}
              </div>
              <h4 style="margin: 0 0 4px 0; color: var(--neutral-dark); font-size: 0.95rem; font-weight: 800;">${mutuelle.name}</h4>
              <p style="margin: 0 0 4px 0; font-size: 0.78rem; color: var(--text-sub);">📍 ${mutuelle.commune} (${mutuelle.region})</p>
              ${mutuelle.landmark ? `
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 2.5px solid #f59e0b; padding: 4px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.72rem; color: #b45309;">
                  📍 <strong>Repère :</strong> ${mutuelle.landmark}
                </div>
              ` : ''}
              <p style="margin: 4px 0 0 0; font-size: 0.78rem; font-weight: bold; color: var(--primary);">
                📞 ${mutuelle.phone}
              </p>
            </div>
          `);
        
        marker.on('click', () => {
          handleCalculateRoute(mutuelle); // Tracer automatiquement l'itinéraire au clic sur le marqueur
        });
        
        markersGroupRef.current.addLayer(marker);
        bounds.push([lat, lon]);
      }
    });

    if (bounds.length > 0 && mapRef.current) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }

  }, [filteredData, communesData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Exportation PDF via impression du navigateur
  const handleExportPdf = () => {
    window.print();
  };

  // Exportation CSV avec téléchargement via Blob
  const handleExportCsv = () => {
    const csvEscape = (val) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };
    const header = `${t.thName},${t.thRegion},${t.thCommune},${t.thStatus},${t.thAgreement}`;
    const rows = filteredData.map(item =>
      [item.name, item.region, item.commune, item.status === 'active' ? 'Active' : 'En sommeil', item.agreement].map(csvEscape).join(',')
    );
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `repertoire_mutuelles_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const regions = [...new Set(mutuelles.map(item => item.region))];

  return (
    <div className="directory-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/bg_annuaire_stock.jpg") center/cover no-repeat',
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

      {/* Directory search options */}
      <section className="container">
        <div className="directory-search-section">
          <div className="grid grid-3" style={{ alignItems: 'flex-end' }}>
            {/* Search Input */}
            <div className="form-group" style={{ margin: '0' }}>
              <label className="form-label">{lang === 'fr' ? 'Recherche par mots-clés' : 'Seet ci baat'}</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Region Filter */}
            <div className="form-group" style={{ margin: '0' }}>
              <label className="form-label">{t.filterRegion}</label>
              <select 
                className="form-control" 
                value={regionFilter} 
                onChange={(e) => setRegionFilter(e.target.value)}
              >
                <option value="all">{t.allRegions}</option>
                {regions.map((reg, i) => (
                  <option key={i} value={reg}>{reg}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="form-group" style={{ margin: '0' }}>
              <label className="form-label">{t.filterStatus}</label>
              <select 
                className="form-control" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{t.allStatus}</option>
                <option value="active">Active</option>
                <option value="en_sommeil">En sommeil</option>
              </select>
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="card" style={{ marginBottom: '2rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>
              {lang === 'fr' ? 'Cartographie des mutuelles' : 'Kàrtu Mutuelle yi'}
            </h3>
            <button 
              className="btn btn-outline btn-sm" 
              onClick={() => setShowMap(!showMap)}
            >
              {showMap 
                ? (lang === 'fr' ? 'Masquer la carte' : 'Nëbb kàrt bi') 
                : (lang === 'fr' ? 'Afficher la carte' : 'Wone kàrt bi')}
            </button>
          </div>
          <div 
            id="annuaire-map" 
            style={{ 
              width: '100%', 
              height: '400px', 
              borderRadius: '12px', 
              zIndex: 1, 
              backgroundColor: '#e2e8f0',
              display: showMap ? 'block' : 'none'
            }}
          ></div>
        </div>

        {/* Actions & Summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <button className="btn btn-outline btn-sm" onClick={handleExportPdf}>
              📄 {t.exportPdf}
            </button>
            <button className="btn btn-outline btn-sm" onClick={handleExportCsv}>
              📊 {t.exportExcel}
            </button>
          </div>

        {/* Directory Table */}
        <div className="directory-table-container">
          <table className="directory-table">
            <thead>
              <tr>
                <th>{t.thName}</th>
                <th>{t.thRegion}</th>
                <th>{t.thCommune}</th>
                <th>{t.thStatus}</th>
                <th>{t.thAgreement}</th>
                <th>{t.thAction}</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? (
                filteredData.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: '600', color: 'var(--neutral-dark)' }}>{item.name}</td>
                    <td>{item.region}</td>
                    <td>{item.commune}</td>
                    <td>
                      <span className={`badge ${item.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                        {item.status === 'active' ? (lang === 'fr' ? 'Active' : 'Laxu') : (lang === 'fr' ? 'En sommeil' : 'Teey')}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{item.agreement}</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-outline btn-sm"
                        onClick={() => setSelectedMutuelle(item)}
                      >
                        {t.btnDetails}
                      </button>
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => setView('services')}
                      >
                        {t.btnJoin}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>
                    {lang === 'fr' ? 'Aucune mutuelle trouvée avec ces critères.' : 'Guissunuko mutuelle bu am critères yii.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detailed Modal Popup */}
      {selectedMutuelle && (
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '2000', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in-up" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--primary)', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.75rem', paddingRight: '2rem' }}>
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
                <span style={{ fontSize: '0.9rem', color: 'var(--neutral-dark)' }}>{selectedMutuelle.services}</span>
              </div>

              {selectedMutuelle.landmark && (
                <div style={{
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.04) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginTop: '0.25rem'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>📍</span>
                  <div>
                    <strong style={{ fontSize: '0.75rem', color: '#b45309', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Point de repère</strong>
                    <span style={{ fontSize: '0.85rem', color: '#78350f', fontWeight: '500' }}>{selectedMutuelle.landmark}</span>
                  </div>
                </div>
              )}

              {selectedMutuelle.localInfo && (
                <div style={{
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(37, 99, 235, 0.03) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.15)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  marginTop: '0.25rem'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>💡</span>
                  <div>
                    <strong style={{ fontSize: '0.75rem', color: '#1d4ed8', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Conseil aux assurés de la zone</strong>
                    <span style={{ fontSize: '0.85rem', color: '#1e3a8a', lineHeight: '1.4' }}>{selectedMutuelle.localInfo}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span>{t.modalCertified} : <strong>{selectedMutuelle.certified ? t.yes : t.no}</strong></span>
                <span style={{ color: 'var(--neutral-gray)' }}>{t.modalLastUpdate} : {selectedMutuelle.lastUpdate}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleCalculateRoute(selectedMutuelle)}>
                {lang === 'fr' ? 'Y aller (itinéraire)' : 'Yoon wi'}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedMutuelle(null)}>{lang === 'fr' ? 'Fermer' : 'Fegg'}</button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setSelectedMutuelle(null);
                  setView('services');
                }}
              >
                {t.btnJoin}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
