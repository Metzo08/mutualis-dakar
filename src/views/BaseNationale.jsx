import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';

export default function BaseNationale({ lang, setView }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMutuelle, setSelectedMutuelle] = useState(null); // Detailed modal state
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
      name: 'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC)',
      region: 'Dakar',
      commune: 'Dakar Plateau',
      status: 'active',
      agreement: 'UN-NAT-001-2015',
      manager: 'Président Demba Mame Ndiaye',
      phone: '+221 33 823 45 67',
      email: 'contact@unamusc.sn',
      rates: 'Faitière Nationale',
      services: 'Coordination nationale, représentation politique, réassurance',
      certified: true,
      lastUpdate: '20/06/2026',
      lat: 14.6685,
      lng: -17.4375,
      landmark: 'Près du Ministère de la Santé, Immeuble administratif du Plateau, Dakar.',
      localInfo: 'Organe faîtier national représentant l\'ensemble des mutuelles de santé communautaires du Sénégal.'
    },
    {
      id: 2,
      name: 'Union Régionale des Mutuelles de Santé de Dakar (URMSCD)',
      region: 'Dakar',
      commune: 'Mermoz-Sacré Coeur',
      status: 'active',
      agreement: 'UR-DK-001-2016',
      manager: 'Mamadou Saliou Diallo',
      phone: '+221 33 859 15 15',
      email: 'contact@urmscd.sn',
      rates: 'Faitière Régionale',
      services: 'Administration régionale, coordination des départements, appui technique',
      certified: true,
      lastUpdate: '15/06/2026',
      lat: 14.7008,
      lng: -17.4651,
      landmark: 'Cité Keur Gorgui, Immeuble Serigne Mérina SYLLA, Dakar.',
      localInfo: 'Union régionale qui coordonne les activités et la réassurance des mutuelles des 5 départements de Dakar.'
    },
    {
      id: 3,
      name: 'Union Départementale de Dakar (UDMS Dakar)',
      region: 'Dakar',
      commune: 'Dakar Plateau',
      status: 'active',
      agreement: 'UD-DK-001-2018',
      manager: 'Assane Diop',
      phone: '+221 33 821 10 10',
      email: 'ud.dakar@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale des mutuelles de Dakar, audit',
      certified: true,
      lastUpdate: '10/06/2026',
      lat: 14.6865,
      lng: -17.4475,
      landmark: 'Avenue Blaise Diagne, près de l\'Hôtel de Ville de Dakar.',
      localInfo: 'Coordination des mutuelles de santé communales du département de Dakar. Accompagnement technique.'
    },
    {
      id: 4,
      name: 'Union Départementale de Pikine (UDMS Pikine)',
      region: 'Dakar',
      commune: 'Pikine Ouest',
      status: 'active',
      agreement: 'UD-DK-002-2018',
      manager: 'Idrissa Wade',
      phone: '+221 33 851 44 22',
      email: 'ud.pikine@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale, formation des gérants locaux',
      certified: true,
      lastUpdate: '12/06/2026',
      lat: 14.7523,
      lng: -17.4011,
      landmark: 'Pikine Ouest, Centre d\'Appui local, près du complexe culturel Léopold Sédar Senghor.',
      localInfo: 'Point focal pour la gestion des mutuelles et du parrainage social dans le département de Pikine.'
    },
    {
      id: 5,
      name: 'Union Départementale de Guédiawaye (UDMS Guédiawaye)',
      region: 'Dakar',
      commune: 'Golf Sud',
      status: 'active',
      agreement: 'UD-DK-004-2019',
      manager: 'Cheikh Sarr',
      phone: '+221 33 862 33 44',
      email: 'ud.guediawaye@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale des mutuelles de Guédiawaye, formation',
      certified: true,
      lastUpdate: '20/05/2026',
      lat: 14.7812,
      lng: -17.4124,
      landmark: 'Quartier Golf Sud, à 300m du grand stade de Guédiawaye Amadou Barry.',
      localInfo: 'Coordonne les actions des mutuelles de la zone de Guédiawaye et aide à la numérisation des cartes CMU.'
    },
    {
      id: 6,
      name: 'Union Départementale de Rufisque (UDMS Rufisque)',
      region: 'Dakar',
      commune: 'Rufisque Est',
      status: 'active',
      agreement: 'UD-DK-003-2018',
      manager: 'Amadou Diop',
      phone: '+221 33 871 12 12',
      email: 'ud.rufisque@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale, gestion des subventions étatiques',
      certified: true,
      lastUpdate: '15/06/2026',
      lat: 14.7154,
      lng: -17.2721,
      landmark: 'Rufisque Est, à côté de la gare TER, près de la préfecture de Rufisque.',
      localInfo: 'Structure faîtière regroupant toutes les mutuelles de santé communautaires du département de Rufisque.'
    },
    {
      id: 7,
      name: 'Union Départementale de Keur Massar (UDMS Keur Massar)',
      region: 'Dakar',
      commune: 'Keur Massar Nord',
      status: 'active',
      agreement: 'UD-DK-005-2022',
      manager: 'Ousmane Ndiaye',
      phone: '+221 33 892 20 20',
      email: 'ud.keurmassar@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination du réseau, développement communautaire',
      certified: true,
      lastUpdate: '08/06/2026',
      lat: 14.7891,
      lng: -17.3012,
      landmark: 'Keur Massar Nord, quartier Cité Ouvrière, en face du poste de police.',
      localInfo: 'Support technique et coordination pour les mutuelles du nouveau département de Keur Massar.'
    },
    {
      id: 8,
      name: 'Union Départementale de Thiès (UDMS Thiès)',
      region: 'Thiès',
      commune: 'Thiès Nord',
      status: 'active',
      agreement: 'UD-TH-001-2017',
      manager: 'Ibrahima Fall',
      phone: '+221 33 951 00 11',
      email: 'ud.thies@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale, supervision des mutuelles locales',
      certified: true,
      lastUpdate: '05/01/2026',
      lat: 14.7932,
      lng: -16.9295,
      landmark: 'Thiès Nord, près de la Place de France, à côté de l\'ancienne Gare de Thiès.',
      localInfo: 'Bureau central d\'appui pour toutes les mutuelles de la région et du département de Thiès.'
    },
    {
      id: 9,
      name: 'Union Départementale de Mbour (UDMS Mbour)',
      region: 'Thiès',
      commune: 'Mbour',
      status: 'active',
      agreement: 'UD-TH-002-2018',
      manager: 'Saliou Diallo',
      phone: '+221 33 957 88 99',
      email: 'ud.mbour@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale de la Petite Côte',
      certified: true,
      lastUpdate: '14/02/2026',
      lat: 14.4162,
      lng: -16.9641,
      landmark: 'Près de la préfecture de département de Mbour, non loin du rond-point du stade.',
      localInfo: 'Coordination départementale pour la Petite Côte, gestion de la réassurance.'
    },
    {
      id: 10,
      name: 'Union Départementale de Saint-Louis (UDMS Saint-Louis)',
      region: 'Saint-Louis',
      commune: 'Saint-Louis Sor',
      status: 'active',
      agreement: 'UD-SL-001-2017',
      manager: 'Abdoulaye Sow',
      phone: '+221 33 961 45 45',
      email: 'ud.saintlouis@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale, formation des agents CMU',
      certified: true,
      lastUpdate: '18/04/2026',
      lat: 16.0221,
      lng: -16.4885,
      landmark: 'À Sor, près de la préfecture de Saint-Louis et du pont Faidherbe.',
      localInfo: 'Coordonne le réseau des mutuelles de la région Nord, facilitant le tiers-payant hospitalier.'
    },
    {
      id: 11,
      name: 'Union Départementale de Ziguinchor (UDMS Ziguinchor)',
      region: 'Ziguinchor',
      commune: 'Ziguinchor',
      status: 'active',
      agreement: 'UD-ZG-001-2018',
      manager: 'Lamine Sané',
      phone: '+221 33 991 22 33',
      email: 'ud.ziguinchor@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Gestion des risques, appui technique, réassurance',
      certified: true,
      lastUpdate: '10/02/2026',
      lat: 12.5768,
      lng: -16.2731,
      landmark: 'Ziguinchor, non loin de la préfecture, près du rond-point Aline Sitoé Diatta.',
      localInfo: 'Appui à la structuration des mutuelles communautaires en zone rurale dans toute la Casamance.'
    },
    {
      id: 12,
      name: 'Union Départementale de Kaolack (UDMS Kaolack)',
      region: 'Kaolack',
      commune: 'Kaolack',
      status: 'active',
      agreement: 'UD-KL-001-2018',
      manager: 'Modou Gueye',
      phone: '+221 33 941 55 66',
      email: 'ud.kaolack@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination du bassin arachidier, statistiques locales',
      certified: true,
      lastUpdate: '12/03/2026',
      lat: 14.1528,
      lng: -16.0755,
      landmark: 'Kaolack Centre, près de la gouvernance et de la grande mosquée.',
      localInfo: 'Coordination des mutuelles de santé du département de Kaolack.'
    },
    {
      id: 13,
      name: 'Union Départementale de Louga (UDMS Louga)',
      region: 'Louga',
      commune: 'Louga',
      status: 'active',
      agreement: 'UD-LG-001-2019',
      manager: 'Mor Ndiaye',
      phone: '+221 33 967 44 55',
      email: 'ud.louga@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale du Ndiambour',
      certified: true,
      lastUpdate: '02/01/2026',
      lat: 15.6152,
      lng: -16.2238,
      landmark: 'Louga Centre, derrière la préfecture départementale.',
      localInfo: 'Coordination départementale et promotion de la Couverture Maladie Universelle dans les zones rurales de Louga.'
    },
    {
      id: 14,
      name: 'Union Départementale de Diourbel (UDMS Diourbel)',
      region: 'Diourbel',
      commune: 'Diourbel',
      status: 'active',
      agreement: 'UD-DB-001-2019',
      manager: 'Serigne Fallou Diop',
      phone: '+221 33 971 77 88',
      email: 'ud.diourbel@unamusc.sn',
      rates: 'Cotisation Faitière',
      services: 'Coordination départementale, plaidoyer mutualiste',
      certified: true,
      lastUpdate: '24/05/2026',
      lat: 14.6558,
      lng: -16.2225,
      landmark: 'Diourbel Centre, près de la Mairie de Diourbel.',
      localInfo: 'Coordonne le réseau départemental des mutuelles de santé communautaires.'
    },
    {
      id: 15,
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
      lat: 14.6851,
      lng: -17.4523,
      landmark: "Située en face du dispensaire Blaise Diagne, Rue 22 angle Blaise Diagne.",
      localInfo: "La Médina propose des permanences d'accueil pour la CMU tous les matins de 8h à 12h."
    },
    {
      id: 16,
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
      lat: 14.7562,
      lng: -17.4082,
      landmark: "À côté du bureau de poste principal de Pikine, près de l'ancien cinéma.",
      localInfo: "Idéale pour les résidents de Pikine Ouest. Permet le remboursement à 90% pour les soins de maternité de proximité."
    },
    {
      id: 17,
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
      lat: 14.4125,
      lng: -16.9615,
      landmark: "Près du grand carrefour d'Escale, à côté de la gare routière de Mbour.",
      localInfo: "Offre une couverture maladie élargie sur toute la Petite Côte. Facile d'accès pour les commerçants du centre."
    },
    {
      id: 18,
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
      lat: 14.1512,
      lng: -16.0782,
      landmark: "Quartier Ndangane, près du poste de santé local, en face du collège franco-arabe.",
      localInfo: "Propose une prise en charge rapide au centre de santé et à l'hôpital régional de Kaolack."
    },
    {
      id: 19,
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
      lat: 16.0245,
      lng: -16.4862,
      landmark: "Quartier Sor, en face de la gare ferroviaire historique, à 100m du pont Faidherbe.",
      localInfo: "Conventionnée avec l'hôpital régional de Saint-Louis et les pharmacies partenaires de l'île de Saint-Louis."
    },
    {
      id: 20,
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
      lat: 14.8690,
      lng: -15.8752,
      landmark: "À 200m du grand minaret de la Grande Mosquée de Touba, en face du marché central.",
      localInfo: "Facilite l'orientation médicale et la prise en charge à 85% dans les hôpitaux Matlaboul Fawzaini et dispensaires de Touba."
    },
    {
      id: 21,
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
      lat: 12.5710,
      lng: -16.2755,
      landmark: "Quartier Boudody, juste derrière le quai de pêche de Ziguinchor.",
      localInfo: "Très active auprès des coopératives de transformation des produits de la mer. Propose des facilités d'adhésion."
    },
    {
      id: 22,
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
      lat: 15.6172,
      lng: -16.2255,
      landmark: "Centre-ville de Louga, derrière la préfecture de département.",
      localInfo: "Cette mutuelle est actuellement en restructuration. Pour toute question urgente, veuillez vous rapprocher de l'Union Départementale de Louga."
    },
    {
      id: 23,
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
      lat: 14.7832,
      lng: -17.4105,
      landmark: "Golf Sud, en face de la mosquée de la Cité des Enseignants.",
      localInfo: "Prise en charge très avantageuse pour les consultations de maternité à la clinique locale conventionnée."
    }
  ];

  const [showMap, setShowMap] = useState(true);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeInstructions, setRouteInstructions] = useState([]);
  const [showInstructions, setShowInstructions] = useState(false);

  // Fetch mutuelles with caching
  const { data: mutuelles = dataset } = useQuery({
    queryKey: ['mutuellesList'],
    queryFn: async () => {
      try {
        const res = await fetch('http://localhost:5000/api/mutuelles');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        if (data && data.length > 0) {
          const mapped = data.map(item => {
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
              localInfo: item.local_info || item.localInfo || (localMatch ? localMatch.localInfo : ''),
              lat: item.lat || (localMatch ? localMatch.lat : null),
              lng: item.lng || item.longitude || (localMatch ? localMatch.lng : null)
            };
          });
          const missingLocals = dataset.filter(d => !mapped.some(m => m.name === d.name || m.id === d.id));
          return [...mapped, ...missingLocals];
        }
      } catch (err) {
        console.warn('Erreur API (utilisation du fallback local) :', err);
      }
      return dataset;
    },
    initialData: dataset
  });

  // Fetch Communes Data with caching
  const { data: communesData = [] } = useQuery({
    queryKey: ['nationalCommunesList'],
    queryFn: async () => {
      try {
        const res = await fetch('https://decoupage-administratif-api.onrender.com/api/v1/communes');
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        if (data && data.data) {
          return data.data;
        }
      } catch (e) {
        console.error('Erreur récupération communes API:', e);
      }
      return [];
    }
  });

  // Filtering logic
  const filteredData = useMemo(() => {
    return mutuelles.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.commune.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRegion = regionFilter === 'all' || item.region === regionFilter;
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [mutuelles, searchQuery, regionFilter, statusFilter]);

  // Leaflet Map Initialization and Marker Update
  const routingControlRef = useRef(null);

  const clearRoute = () => {
    setRouteInfo(null);
    setRouteInstructions([]);
    setShowInstructions(false);
    if (routingControlRef.current && mapRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
  };

  const handleCalculateRoute = (mutuelle) => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    let lat = mutuelle.lat;
    let lon = mutuelle.lng || mutuelle.lon;

    if (!lat || !lon) {
      const communeName = mutuelle.commune.toLowerCase().trim();
      const communeInfo = communesData.find(c => c.name.toLowerCase().trim() === communeName);
      lat = communeInfo?.lat;
      lon = communeInfo?.lon;
    }

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
            show: false, // Hidden Leaflet text instructions panel to avoid blocking the map
            collapsible: true,
            language: 'fr',
            lineOptions: {
              styles: [{ color: '#059669', opacity: 0.8, weight: 6 }]
            }
          }).addTo(mapRef.current);

          routingControlRef.current.on('routesfound', function(e) {
            const routes = e.routes;
            const summary = routes[0].summary;
            const distKm = (summary.totalDistance / 1000).toFixed(1);
            const timeMin = Math.round(summary.totalTime / 60);

            setRouteInfo({
              distance: distKm + ' km',
              duration: timeMin + ' min',
              details: lang === 'fr' ? 'Itinéraire tracé avec succès en vert.' : 'Yoon bi wone nanu ko ci bir kàrt bi.'
            });

            if (routes[0].instructions) {
              setRouteInstructions(routes[0].instructions.map(inst => ({
                text: inst.text,
                distance: inst.distance,
                time: inst.time
              })));
            } else {
              setRouteInstructions([]);
            }
          });

          routingControlRef.current.on('routingerror', function(e) {
            setRouteInfo({ error: true, details: lang === 'fr' ? "Impossible de calculer l'itinéraire." : "Mënu noo xayma yoon bi." });
            setRouteInstructions([]);
          });
          
          setSelectedMutuelle(null);
          document.getElementById('annuaire-map')?.scrollIntoView({ behavior: 'smooth' });
        }
      },
      (err) => {
        console.error("Erreur GPS: ", err);
        alert("Impossible d'obtenir votre position. Vérifiez vos paramètres GPS.");
        clearRoute();
      }
    );
  };

  const handleShowDetails = (item) => {
    setSelectedMutuelle(item);
    clearRoute();
    
    let lat = item.lat;
    let lon = item.lng || item.lon;
    
    if (!lat || !lon) {
      const communeName = item.commune.toLowerCase().trim();
      const communeInfo = communesData.find(c => c.name.toLowerCase().trim() === communeName);
      lat = communeInfo?.lat;
      lon = communeInfo?.lon;
    }
    
    if (!lat || !lon) {
      if (item.region === 'Dakar') { lat = 14.7167; lon = -17.4677; }
      else if (item.region === 'Thiès') { lat = 14.791; lon = -16.926; }
      else if (item.region === 'Kaolack') { lat = 14.133; lon = -16.253; }
      else if (item.region === 'Saint-Louis') { lat = 16.032; lon = -16.481; }
      else if (item.region === 'Ziguinchor') { lat = 12.558; lon = -16.273; }
    }
    
    if (lat && lon && mapRef.current) {
      mapRef.current.flyTo([lat, lon], 14, {
        animate: true,
        duration: 1.5
      });
      
      // Open popup manually after the transition
      setTimeout(() => {
        if (markersGroupRef.current) {
          markersGroupRef.current.eachLayer(layer => {
            if (layer.getLatLng && layer.getLatLng().lat === lat && layer.getLatLng().lng === lon) {
              layer.openPopup();
            }
          });
        }
      }, 800);
      
      const mapElem = document.getElementById('annuaire-map');
      if (mapElem) {
        mapElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
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
      let lat = mutuelle.lat;
      let lon = mutuelle.lng || mutuelle.lon;

      if (!lat || !lon) {
        // Clean string matching for commune
        const communeName = mutuelle.commune.toLowerCase().trim();
        const communeInfo = communesData.find(c => c.name.toLowerCase().trim() === communeName);
        lat = communeInfo?.lat;
        lon = communeInfo?.lon;
      }

      // Some hardcoded fallback if API misses (optional)
      if (!lat || !lon) {
        if (mutuelle.region === 'Dakar') { lat = 14.7167; lon = -17.4677; }
        else if (mutuelle.region === 'Thiès') { lat = 14.791; lon = -16.926; }
        else if (mutuelle.region === 'Kaolack') { lat = 14.133; lon = -16.253; }
        else if (mutuelle.region === 'Saint-Louis') { lat = 16.032; lon = -16.481; }
        else if (mutuelle.region === 'Ziguinchor') { lat = 12.558; lon = -16.273; }
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
              <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 0.95rem; font-weight: 800;">${mutuelle.name}</h4>
              <p style="margin: 0 0 4px 0; font-size: 0.78rem; color: #475569;">📍 ${mutuelle.commune} (${mutuelle.region})</p>
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
        
        // Hover interaction: robust open on hover, close gracefully when mouse leaves marker and popup
        let hoverTimeout;
        marker.on('mouseover', function () {
          clearTimeout(hoverTimeout);
          this.openPopup();
          
          // Wait for the popup to be added to the DOM before attaching event listeners
          setTimeout(() => {
            const popupNode = this.getPopup()?.getElement();
            if (popupNode) {
              popupNode.addEventListener('mouseenter', () => clearTimeout(hoverTimeout));
              popupNode.addEventListener('mouseleave', () => {
                 hoverTimeout = setTimeout(() => this.closePopup(), 200);
              });
            }
          }, 50);
        });
        
        marker.on('mouseout', function () {
          hoverTimeout = setTimeout(() => {
            this.closePopup();
          }, 200);
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
            className="annuaire-map-container"
            style={{ 
              display: showMap ? 'block' : 'none'
            }}
          ></div>

          {/* Route Summary Card */}
          {routeInfo && (
            <div style={{
              marginTop: '1rem',
              padding: '1.25rem',
              backgroundColor: 'var(--card-bg-subtle)',
              borderRadius: '10px',
              borderLeft: '4px solid var(--success)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                    {lang === 'fr' ? 'Distance' : 'Yaram bi'}
                  </span>
                  <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--success)' }}>{routeInfo.distance}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                    {lang === 'fr' ? 'Durée estimée' : 'Diir ak yëgël'}
                  </span>
                  <div style={{ fontWeight: '800', fontSize: '1.3rem', color: 'var(--success)' }}>{routeInfo.duration}</div>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--neutral-dark)', margin: '0 0 0.75rem 0' }}>
                🚙 {routeInfo.details}
              </p>

              {routeInstructions.length > 0 && (
                <>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => setShowInstructions(!showInstructions)}
                  >
                    {showInstructions
                      ? (lang === 'fr' ? '🔼 Masquer l\'itinéraire détaillé' : '🔼 Nëbb yoon bi')
                      : (lang === 'fr' ? '🔽 Afficher l\'itinéraire détaillé' : '🔽 Wone yoon bi')}
                  </button>

                  {showInstructions && (
                    <div style={{
                      marginTop: '0.75rem',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      padding: '0.5rem',
                      fontSize: '0.82rem'
                    }}>
                      {routeInstructions.map((inst, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 4px',
                          borderBottom: idx < routeInstructions.length - 1 ? '1px solid var(--border-color)' : 'none',
                          color: 'var(--text-main)'
                        }}>
                          <span>{idx + 1}. {inst.text}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                            {inst.distance >= 1000
                              ? `${(inst.distance / 1000).toFixed(1)} km`
                              : `${Math.round(inst.distance)} m`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <button
                className="btn btn-outline btn-sm"
                style={{ marginTop: '0.75rem', width: '100%' }}
                onClick={clearRoute}
              >
                ✕ {lang === 'fr' ? 'Effacer l\'itinéraire' : 'Rëy yoon bi'}
              </button>
            </div>
          )}
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
                        onClick={() => handleShowDetails(item)}
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
      {selectedMutuelle && createPortal(
        <div style={{ position: 'fixed', top: '0', left: '0', right: '0', bottom: '0', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '2000', padding: '1rem', backdropFilter: 'blur(4px)' }}>
          <div className="card fade-in-up" style={{ width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2.5rem', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
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
                    <strong className="info-box-title" style={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>Conseil aux assurés de la zone</strong>
                    <span className="info-box-text" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>{selectedMutuelle.localInfo}</span>
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
        </div>,
        document.body
      )}
    </div>
  );
}
