import React, { useState, useEffect, useRef } from 'react';

export default function Cartographie({ lang }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  const dict = {
    fr: {
      title: 'Cartographie sanitaire & mutuelles',
      subtitle: 'Localisez les mutuelles de santé et les structures sanitaires conventionnées de la région de Dakar.',
      searchPlaceholder: 'Rechercher par commune, nom, service...',
      filterAll: 'Tous les points',
      filterMutuelle: 'Mutuelles & bureaux',
      filterHospital: 'Hôpitaux & cliniques',
      filterProx: 'Soins de proximité',
      filterPharmacy: 'Pharmacies agréées',
      filterTradi: 'Tradipraticiens',
      resultsTitle: 'Points à proximité',
      distanceLabel: 'Distance',
      timeLabel: 'Durée estimée',
      routeBtn: 'Calculer itinéraire',
      routingText: 'Itinéraire simulé : emprunter l\'Avenue Bourguiba puis la voie rapide locale.',
    },
    wo: {
      title: 'Kàrtu fajukaay yi ak mutuelle yi',
      subtitle: 'Wëral mutuelle wér-gi-yaram yi ak dispensaires yi nu agréer ci Dakar.',
      searchPlaceholder: 'Wër ci tour, commune, service...',
      filterAll: 'Lépp',
      filterMutuelle: 'Mutuelle & bureaux',
      filterHospital: 'Hôpitaux & cliniques',
      filterProx: 'Dispensaires / postes',
      filterPharmacy: 'Pharmacies yi',
      filterTradi: 'Tradipraticiens yi',
      resultsTitle: 'Dëkk yu jege',
      distanceLabel: 'Soreway',
      timeLabel: 'Waxtu bi',
      routeBtn: 'Itinéraire',
      routingText: 'Yoon wi : jaar Avenue Bourguiba ba yegg fa.',
    }
  };

  const t = dict[lang];

  // Simulated coordinates of key nodes in Dakar
  const locations = [
    { id: 1, name: 'Siège régional URMSCD', type: 'office', subtype: 'régional', lat: 14.7008, lng: -17.4651, desc: 'Cité Keur Gorgui, immeuble Serigne Mérina SYLLA', phone: '+221 33 859 15 15', commune: 'Mermoz-Sacré Coeur', hours: '8h-17h', services: 'Administration régionale, support mutuelles', coverage: 'N/A' },
    { id: 2, name: 'Union départementale de Dakar', type: 'office', subtype: 'départemental', lat: 14.6865, lng: -17.4475, desc: 'Dakar Plateau, immeuble municipal', phone: '+221 33 821 10 10', commune: 'Dakar Plateau', hours: '8h-16h', services: 'Bureau départemental de coordination', coverage: 'N/A' },
    { id: 3, name: 'Union départementale de Pikine', type: 'office', subtype: 'départemental', lat: 14.7523, lng: -17.4011, desc: 'Pikine Ouest, Centre d\'Appui local', phone: '+221 33 851 44 22', commune: 'Pikine Ouest', hours: '8h-16h', services: 'Bureau départemental de coordination', coverage: 'N/A' },
    { id: 4, name: 'Union départementale de Guédiawaye', type: 'office', subtype: 'départemental', lat: 14.7812, lng: -17.4124, desc: 'Golf Sud, cité des enseignants', phone: '+221 33 862 33 44', commune: 'Golf Sud', hours: '8h-16h', services: 'Bureau départemental de coordination', coverage: 'N/A' },
    { id: 5, name: 'Union départementale de Rufisque', type: 'office', subtype: 'départemental', lat: 14.7154, lng: -17.2721, desc: 'Rufisque Nord, siège administratif', phone: '+221 33 871 12 12', commune: 'Rufisque Nord', hours: '8h-16h', services: 'Bureau départemental de coordination', coverage: 'N/A' },
    { id: 6, name: 'Union départementale de Keur Massar', type: 'office', subtype: 'départemental', lat: 14.7891, lng: -17.3012, desc: 'Keur Massar Nord, cité ouvrière', phone: '+221 33 892 20 20', commune: 'Keur Massar Nord', hours: '8h-16h', services: 'Bureau départemental de coordination', coverage: 'N/A' },
    { id: 7, name: 'Mutuelle de la Médina', type: 'mutuelle', subtype: 'mutuelle', lat: 14.6851, lng: -17.4523, desc: 'Commune de la Médina, rue 22', phone: '+221 77 500 11 22', commune: 'Médina', hours: '8h-18h', services: 'Adhésion, renouvellement, conseil', coverage: 'N/A' },
    { id: 8, name: 'Mutuelle de Pikine Ouest', type: 'mutuelle', subtype: 'mutuelle', lat: 14.7562, lng: -17.4082, desc: 'Pikine Ouest, rue de la poste', phone: '+221 77 622 33 44', commune: 'Pikine Ouest', hours: '8h-18h', services: 'Adhésion, renouvellement, conseil', coverage: 'N/A' },
    { id: 9, name: 'Mutuelle de Rufisque Est', type: 'mutuelle', subtype: 'mutuelle', lat: 14.7161, lng: -17.2681, desc: 'Rufisque Est, quartier Mérina', phone: '+221 77 411 55 66', commune: 'Rufisque Est', hours: '8h-18h', services: 'Adhésion, renouvellement, conseil', coverage: 'N/A' },
    { id: 10, name: 'Hôpital principal de Dakar', type: 'hospital', subtype: 'hôpital', lat: 14.6645, lng: -17.4328, desc: 'Avenue Nelson Mandela, Dakar', phone: '+221 33 839 50 50', commune: 'Dakar Plateau', hours: '24h/24', services: 'Urgences, chirurgie, cardiologie, pédiatrie, maternité', coverage: 'Tiers-payant CMU : 80%' },
    { id: 11, name: 'Hôpital de Fann', type: 'hospital', subtype: 'hôpital', lat: 14.6912, lng: -17.4721, desc: 'Avenue Cheikh Anta Diop, Fann', phone: '+221 33 869 18 18', commune: 'Fann-Point E', hours: '24h/24', services: 'Neurologie, cardiologie, maladies infectieuses, urgences', coverage: 'Tiers-payant CMU : 80%' },
    { id: 12, name: 'Hôpital Dalal Jamm', type: 'hospital', subtype: 'hôpital', lat: 14.7678, lng: -17.3821, desc: 'Guédiawaye, voie de contournement', phone: '+221 33 879 40 40', commune: 'Guédiawaye', hours: '24h/24', services: 'Oncologie, dialyse, médecine générale, urgences', coverage: 'Tiers-payant CMU : 80%' },
    { id: 13, name: 'Hôpital Albert Royer', type: 'hospital', subtype: 'hôpital', lat: 14.6930, lng: -17.4750, desc: 'Avenue Cheikh Anta Diop (Fann)', phone: '+221 33 869 18 00', commune: 'Fann', hours: '24h/24', services: 'Pédiatrie spécialisée, urgences pédiatriques', coverage: 'Tiers-payant CMU : 80%' },
    { id: 14, name: 'Centre de santé de la Médina', type: 'hospital', subtype: 'centre', lat: 14.6890, lng: -17.4560, desc: 'Avenue Blaise Diagne, Médina', phone: '+221 33 822 24 24', commune: 'Médina', hours: '24h/24', services: 'Médecine générale, maternité, vaccination, soins infirmiers', coverage: 'Tiers-payant CMU : 80%' },
    { id: 15, name: 'Centre de santé Philippe M. Senghor', type: 'hospital', subtype: 'centre', lat: 14.7580, lng: -17.4720, desc: 'Yoff, Route de l\'Aéroport', phone: '+221 33 820 02 02', commune: 'Yoff', hours: '24h/24', services: 'Médecine générale, pédiatrie, gynécologie, urgences', coverage: 'Tiers-payant CMU : 80%' },
    { id: 16, name: 'Centre de santé de Pikine', type: 'hospital', subtype: 'centre', lat: 14.7585, lng: -17.4040, desc: 'Pikine Est, quartier Darou Salam', phone: '+221 33 852 11 11', commune: 'Pikine Est', hours: '24h/24', services: 'Maternité, médecine générale, laboratoire d\'analyses', coverage: 'Tiers-payant CMU : 80%' },
    { id: 17, name: 'Poste de santé de Fass', type: 'hospital', subtype: 'poste', lat: 14.6895, lng: -17.4605, desc: 'Fass Delorme, rue 2B', phone: '+221 33 821 45 45', commune: 'Fass-Colobane', hours: '8h-18h', services: 'Soins primaires, consultations, pansements', coverage: 'Tiers-payant CMU : 50%' },
    { id: 18, name: 'Poste de santé de Grand Yoff', type: 'hospital', subtype: 'poste', lat: 14.7390, lng: -17.4580, desc: 'Grand Yoff, près de la mairie', phone: '+221 33 827 99 99', commune: 'Grand Yoff', hours: '8h-18h', services: 'Soins infirmiers, consultations générales', coverage: 'Tiers-payant CMU : 50%' },
    { id: 19, name: 'Poste de santé de Keur Massar', type: 'hospital', subtype: 'poste', lat: 14.7830, lng: -17.2990, desc: 'Keur Massar Centre, route de Boune', phone: '+221 33 893 11 11', commune: 'Keur Massar', hours: '8h-18h', services: 'Soins généraux, maternité de proximité', coverage: 'Tiers-payant CMU : 50%' },
    { id: 20, name: 'Pharmacie du Plateau', type: 'pharmacy', subtype: 'pharmacie', lat: 14.6710, lng: -17.4385, desc: 'Avenue Albert Sarraut, Dakar', phone: '+221 33 823 23 23', commune: 'Dakar Plateau', hours: '24h/24', services: 'Médicaments prescrits, parapharmacie', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 21, name: 'Pharmacie de Pikine', type: 'pharmacy', subtype: 'pharmacie', lat: 14.7510, lng: -17.4030, desc: 'Tally Boubess, Pikine', phone: '+221 33 851 15 15', commune: 'Pikine', hours: '8h-23h', services: 'Médicaments prescrits, parapharmacie', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 22, name: 'Pharmacie Nation', type: 'pharmacy', subtype: 'pharmacie', lat: 14.6920, lng: -17.4480, desc: 'Avenue Blaise Diagne, Colobane', phone: '+221 33 822 55 55', commune: 'Colobane', hours: '8h-22h', services: 'Médicaments prescrits, parapharmacie', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 23, name: 'Pharmacie Guédiawaye', type: 'pharmacy', subtype: 'pharmacie', lat: 14.7790, lng: -17.4100, desc: 'Golf Sud, près du stade de Guédiawaye', phone: '+221 33 861 22 22', commune: 'Guédiawaye', hours: '8h-22h', services: 'Médicaments prescrits, parapharmacie', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 24, name: 'Clinique de la Madeleine', type: 'hospital', subtype: 'clinique', lat: 14.6725, lng: -17.4410, desc: 'Avenue Hassan II (ex Sarraut), Dakar', phone: '+221 33 889 94 94', commune: 'Dakar Plateau', hours: '24h/24', services: 'Chirurgie, médecine spécialisée, maternité privée, pédiatrie', coverage: 'Tiers-payant conventionné (mutuelles privées)' },
    { id: 25, name: 'Clinique du Cap', type: 'hospital', subtype: 'clinique', lat: 14.6780, lng: -17.4690, desc: 'Avenue de la Corniche Ouest, Dakar', phone: '+221 33 889 02 02', commune: 'Fann-Corniche', hours: '24h/24', services: 'Urgences privées, chirurgie esthétique, cardiologie', coverage: 'Tiers-payant conventionné (mutuelles privées)' },
    { id: 26, name: 'Centre de tradithérapie de Dakar', type: 'hospital', subtype: 'tradipraticien', lat: 14.7040, lng: -17.4520, desc: 'Fann-Hock, route de la Corniche', phone: '+221 77 344 55 66', commune: 'Fann-Hock', hours: '8h-18h', services: 'Médecine par les plantes, soins traditionnels des articulations', coverage: 'Tiers-payant CMU : prise en charge 30% (conventionné)' },
    { id: 27, name: 'Cabinet traditionnel Serigne Fallou', type: 'hospital', subtype: 'tradipraticien', lat: 14.7550, lng: -17.3980, desc: 'Pikine, près du marché aux poissons', phone: '+221 77 655 44 33', commune: 'Pikine', hours: '8h-17h', services: 'Consultations phytothérapiques, remèdes traditionnels', coverage: 'Tiers-payant CMU : prise en charge 30% (conventionné)' },
    { id: 28, name: 'Cabinet Keur Massar tradipratique', type: 'hospital', subtype: 'tradipraticien', lat: 14.7920, lng: -17.2910, desc: 'Keur Massar Sud, quartier Aladji Pathe', phone: '+221 77 522 11 00', commune: 'Keur Massar', hours: '8h-17h', services: 'Traitements à base de plantes locales, tradithérapie', coverage: 'Tiers-payant CMU : prise en charge 30% (conventionné)' },
    { id: 29, name: 'Hôpital Aristide Le Dantec', type: 'hospital', subtype: 'hôpital', lat: 14.6616, lng: -17.4323, desc: 'Avenue Pasteur, Dakar Plateau', phone: '+221 33 889 38 00', commune: 'Dakar Plateau', hours: '24h/24', services: 'Maternité, chirurgie générale, pédiatrie, oncologie', coverage: 'Tiers-payant CMU : 80%' },
    { id: 30, name: 'Hôpital Abass Ndao', type: 'hospital', subtype: 'hôpital', lat: 14.6853, lng: -17.4589, desc: 'Avenue Cheikh Anta Diop, Gueule Tapée', phone: '+221 33 849 78 00', commune: 'Fann-Point E-Amitié', hours: '24h/24', services: 'Diabétologie, pédiatrie, médecine interne, urgences', coverage: 'Tiers-payant CMU : 80%' },
    { id: 31, name: 'Hôpital militaire de Ouakam', type: 'hospital', subtype: 'hôpital', lat: 14.7224, lng: -17.4891, desc: 'Route de la Corniche Ouest, Ouakam', phone: '+221 33 820 08 30', commune: 'Ouakam', hours: '24h/24', services: 'Chirurgie, médecine d\'urgence, radiologie, traumatologie', coverage: 'Tiers-payant CMU : 80%' },
    { id: 32, name: 'Hôpital de Grand Yoff (HOGIP)', type: 'hospital', subtype: 'hôpital', lat: 14.7431, lng: -17.4503, desc: 'Grand Yoff, voie de dégagement Nord (VDN)', phone: '+221 33 869 40 50', commune: 'Grand Yoff', hours: '24h/24', services: 'Urgences médicales, traumatologie, cardiologie, chirurgie', coverage: 'Tiers-payant CMU : 80%' },
    { id: 33, name: 'Centre de santé de Nabil Choucair', type: 'hospital', subtype: 'centre', lat: 14.7475, lng: -17.4423, desc: 'Patte d\'Oie Builders, Dakar', phone: '+221 33 855 12 12', commune: 'Patte d\'Oie', hours: '24h/24', services: 'Médecine générale, gynécologie, pédiatrie, maternité, urgences', coverage: 'Tiers-payant CMU : 80%' },
    { id: 34, name: 'Centre de santé de Yeumbeul', type: 'hospital', subtype: 'centre', lat: 14.7795, lng: -17.3450, desc: 'Yeumbeul Nord, Route de Boune', phone: '+221 33 874 15 15', commune: 'Yeumbeul Nord', hours: '24h/24', services: 'Médecine générale, maternité, pédiatrie, vaccination, pharmacie d\'urgence', coverage: 'Tiers-payant CMU : 80%' },
    { id: 35, name: 'Centre de santé de Mbao', type: 'hospital', subtype: 'centre', lat: 14.7392, lng: -17.3195, desc: 'Mbao, route nationale 1', phone: '+221 33 836 20 20', commune: 'Mbao', hours: '24h/24', services: 'Consultations, maternité, soins infirmiers, pédiatrie, laboratoire', coverage: 'Tiers-payant CMU : 80%' },
    { id: 36, name: 'Poste de santé de Ouakam', type: 'hospital', subtype: 'poste', lat: 14.7245, lng: -17.4920, desc: 'Ouakam Centre, rue des Mamelles', phone: '+221 33 860 11 11', commune: 'Ouakam', hours: '8h-18h', services: 'Soins infirmiers, consultations de base, planification familiale', coverage: 'Tiers-payant CMU : 50%' },
    { id: 37, name: 'Poste de santé de Hann Bel-Air', type: 'hospital', subtype: 'poste', lat: 14.7120, lng: -17.4280, desc: 'Hann Bel-Air, route de la pyrotechnie', phone: '+221 33 832 40 40', commune: 'Hann Bel-Air', hours: '8h-18h', services: 'Consultations de médecine générale, soins de proximité, vaccination', coverage: 'Tiers-payant CMU : 50%' },
    { id: 38, name: 'Poste de santé de Yoff Tonghor', type: 'hospital', subtype: 'poste', lat: 14.7610, lng: -17.4810, desc: 'Yoff Tonghor, près du port de pêche', phone: '+221 33 820 44 44', commune: 'Yoff', hours: '8h-18h', services: 'Consultations générales, petite chirurgie, pharmacie de garde', coverage: 'Tiers-payant CMU : 50%' },
    { id: 39, name: 'Pharmacie Guigon', type: 'pharmacy', subtype: 'pharmacie', lat: 14.6698, lng: -17.4344, desc: '1 Avenue Georges Pompidou, Dakar Plateau', phone: '+221 33 823 03 33', commune: 'Dakar Plateau', hours: '24h/24', services: 'Médicaments prescrits, parapharmacie, matériel médical', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 40, name: 'Pharmacie Atlantique', type: 'pharmacy', subtype: 'pharmacie', lat: 14.6865, lng: -17.4764, desc: 'Avenue Cheikh Anta Diop, Fann', phone: '+221 33 825 21 00', commune: 'Fann-Point E-Amitié', hours: '24h/24', services: 'Médicaments prescrits, homéopathie, parapharmacie', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 41, name: 'Pharmacie de la République', type: 'pharmacy', subtype: 'pharmacie', lat: 14.6675, lng: -17.4363, desc: 'Avenue de la République, Dakar Plateau', phone: '+221 33 822 20 80', commune: 'Dakar Plateau', hours: '8h-23h', services: 'Médicaments prescrits, parapharmacie, produits orthopédiques', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 42, name: 'Pharmacie des Almadies', type: 'pharmacy', subtype: 'pharmacie', lat: 14.7482, lng: -17.5147, desc: 'Route des Almadies, Ngor', phone: '+221 33 820 78 88', commune: 'Ngor-Almadies', hours: '24h/24', services: 'Médicaments prescrits, produits vétérinaires, parapharmacie', coverage: 'Tiers-payant CMU : 50% sur génériques' },
    { id: 43, name: 'Clinique Casahous', type: 'hospital', subtype: 'clinique', lat: 14.6653, lng: -17.4370, desc: 'Rue Amadou Assane Ndoye, Dakar Plateau', phone: '+221 33 821 21 50', commune: 'Dakar Plateau', hours: '24h/24', services: 'Gynécologie-obstétrique, pédiatrie, chirurgie esthétique', coverage: 'Tiers-payant conventionné (mutuelles privées)' },
    { id: 44, name: 'Clinique du Cap', type: 'hospital', subtype: 'clinique', lat: 14.6898, lng: -17.4735, desc: 'Rue Aimé Césaire, Fann Résidence', phone: '+221 33 824 24 24', commune: 'Fann-Point E-Amitié', hours: '24h/24', services: 'Cardiologie, chirurgie cardiaque, réanimation, urgences 24h', coverage: 'Tiers-payant conventionné (mutuelles privées)' },
    { id: 45, name: 'Cabinet GIE ethnobotanique', type: 'hospital', subtype: 'tradipraticien', lat: 14.7850, lng: -17.3050, desc: 'Keur Massar Nord, cité ouvrière', phone: '+221 77 430 11 22', commune: 'Keur Massar', hours: '8h-18h', services: 'Médecine traditionnelle holistique, tisanes, traitements cutanés', coverage: 'Tiers-payant CMU : prise en charge 30% (conventionné)' },
    { id: 46, name: 'Pharmacopée traditionnelle de la Médina', type: 'hospital', subtype: 'tradipraticien', lat: 14.6860, lng: -17.4510, desc: 'Avenue Blaise Diagne, Médina rue 11', phone: '+221 77 580 99 88', commune: 'Médina', hours: '8h-17h', services: 'Consultations par les plantes, remèdes articulaires, huiles naturelles', coverage: 'Tiers-payant CMU : prise en charge 30% (conventionné)' }
  ];

  const [pointsOfInterest, setPointsOfInterest] = useState(locations);

  useEffect(() => {
    fetch('http://localhost:5000/api/locations')
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          const mapped = data.map(item => ({
            id: item.id,
            name: item.name,
            type: item.type,
            subtype: item.subtype,
            lat: item.lat,
            lng: item.lng,
            desc: item.description,
            phone: item.phone,
            commune: item.commune,
            hours: item.hours,
            services: item.services,
            coverage: item.coverage,
            landmark: item.landmark,
            localInfo: item.local_info || item.localInfo
          }));
          setPointsOfInterest(mapped);
        }
      })
      .catch(err => {
        console.warn('Erreur API locations (utilisation du fallback) :', err);
      });
  }, []);

  // Filter locations
  const filteredLocations = pointsOfInterest.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          loc.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (loc.commune && loc.commune.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (loc.services && loc.services.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;
    
    if (filter === 'all') return true;
    if (filter === 'mutuelle') return loc.type === 'mutuelle' || loc.type === 'office';
    if (filter === 'hospital') return loc.type === 'hospital' && (loc.subtype === 'hôpital' || loc.subtype === 'clinique');
    if (filter === 'prox') return loc.type === 'hospital' && (loc.subtype === 'centre' || loc.subtype === 'poste');
    if (filter === 'pharmacy') return loc.type === 'pharmacy';
    if (filter === 'tradi') return loc.type === 'hospital' && loc.subtype === 'tradipraticien';
    
    return true;
  });

  // Initialize and update Leaflet Map
  const routingControlRef = useRef(null);

  const calculateRoute = (item) => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setRouteInfo({ loading: true, details: "Calcul de l'itinéraire en cours..." });

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
              window.L.latLng(item.lat, item.lng)
            ],
            routeWhileDragging: true,
            addWaypoints: true,
            show: true, // Affiche le panneau d'instructions étape par étape comme Google Maps
            collapsible: true, // Permet de réduire/fermer le panneau
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
              details: 'L\'itinéraire a été tracé sur la carte en vert.'
            });
          });

          routingControlRef.current.on('routingerror', function(e) {
            setRouteInfo({ error: true, details: "Impossible de calculer l'itinéraire." });
          });
        }
      },
      (err) => {
        console.error("Erreur GPS: ", err);
        alert("Impossible d'obtenir votre position. Vérifiez vos paramètres GPS.");
        setRouteInfo(null);
      }
    );
  };

  useEffect(() => {
    // Only initialize Leaflet map if window.L (Leaflet) exists
    if (!window.L) return;

    if (!mapRef.current) {
      // Create Map
      mapRef.current = window.L.map('leaflet-map-root', {
        center: [14.72, -17.38],
        zoom: 12,
        zoomControl: true
      });

      // Add Tile Layer (OpenStreetMap)
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapRef.current);

      // Create Markers Group
      markersGroupRef.current = window.L.featureGroup().addTo(mapRef.current);
    }

    // Clear old markers
    if (markersGroupRef.current) {
      markersGroupRef.current.clearLayers();
    }

    // Add new markers based on filter & search
    filteredLocations.forEach(loc => {
      // Determine Icon Color
      let color = '#0066cc'; // default blue
      if (loc.type === 'office') color = '#1e3a8a'; // deep blue
      if (loc.type === 'mutuelle') color = '#ff7f11'; // orange
      if (loc.type === 'pharmacy') color = '#10b981'; // green
      if (loc.type === 'hospital') {
        if (loc.subtype === 'hôpital') color = '#ef4444'; // red
        else if (loc.subtype === 'clinique') color = '#a855f7'; // purple
        else if (loc.subtype === 'tradipraticien') color = '#854d0e'; // olive/brown
        else color = '#ec4899'; // pink for centers and health posts
      }

      const svgIcon = `
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <circle cx="12" cy="12" r="10" fill="${color}" />
          <circle cx="12" cy="12" r="4" fill="white" />
        </svg>
      `;

      const customIcon = window.L.divIcon({
        html: svgIcon,
        className: 'custom-map-icon',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = window.L.marker([loc.lat, loc.lng], { icon: customIcon })
        .bindPopup(`
          <div style="font-family: var(--font-body); padding: 10px; min-width: 240px; text-align: left; line-height: 1.4;">
            <div style="display: flex; gap: 4px; margin-bottom: 6px; flex-wrap: wrap;">
              <span style="background-color: ${color}20; color: ${color}; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">
                ${loc.subtype || loc.type}
              </span>
              ${loc.coverage && loc.coverage !== 'N/A' ? `
                <span style="background-color: rgba(16, 185, 129, 0.12); color: var(--success); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;">
                  ✓ CMU
                </span>
              ` : ''}
            </div>
            <h4 style="margin: 0 0 4px 0; color: var(--neutral-dark); font-size: 0.95rem; font-weight: 800; line-height: 1.2;">${loc.name}</h4>
            <p style="font-size: 0.75rem; color: var(--text-sub); margin: 0 0 4px 0;">📍 ${loc.commune || 'Dakar'} - ${loc.desc}</p>
            ${loc.landmark ? `
              <div style="background: rgba(245, 158, 11, 0.08); border-left: 2.5px solid #f59e0b; padding: 4px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.72rem; color: #b45309;">
                📍 <strong>Repère :</strong> ${loc.landmark}
              </div>
            ` : ''}
            <p style="font-size: 0.72rem; color: var(--text-sub); margin: 0 0 4px 0;">🕐 ${loc.hours || '8h-18h'}</p>
            <p style="font-size: 0.75rem; font-weight: bold; margin: 0; color: var(--primary);">📞 ${loc.phone}</p>
          </div>
        `, { closeButton: false });

      // Hover interaction: open on hover, close on mouseout
      marker.on('mouseover', function () {
        this.openPopup();
      });
      marker.on('mouseout', function () {
        this.closePopup();
      });

      marker.on('click', () => {
        setSelectedItem(loc);
        setRouteInfo(null); // Reset route when click
        calculateRoute(loc); // Tracer l'itinéraire automatiquement au clic
      });

      if (markersGroupRef.current) {
        markersGroupRef.current.addLayer(marker);
      }
    });

    // Fit bounds if markers exist
    if (markersGroupRef.current && filteredLocations.length > 0) {
      mapRef.current.fitBounds(markersGroupRef.current.getBounds(), { padding: [50, 50] });
    }

  }, [filteredLocations]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (routingControlRef.current && mapRef.current) {
        mapRef.current.removeControl(routingControlRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setRouteInfo(null);
    if (routingControlRef.current && mapRef.current) {
      mapRef.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    if (mapRef.current) {
      mapRef.current.setView([item.lat, item.lng], 15);
      // Open popup manually if possible
      markersGroupRef.current.eachLayer(layer => {
        if (layer.getLatLng().lat === item.lat && layer.getLatLng().lng === item.lng) {
          layer.openPopup();
        }
      });
    }
  };

  return (
    <div className="cartographie-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_map_hero_real.png") center/cover no-repeat',
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

      {/* Main Interactive Grid */}
      <section className="container section-padding" style={{ paddingTop: '1rem' }}>
        <div className="map-view-layout">
          {/* Sidebar controls */}
          <div className="map-sidebar">
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Filtres & recherche</h3>
              
              {/* Search */}
              <form className="map-search-bar" onSubmit={(e) => e.preventDefault()}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>

              {/* Filters list */}
              <div className="map-filter-options" style={{ marginTop: '1.25rem' }}>
                <button className={`map-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                  <span>{t.filterAll}</span>
                  <span className="badge badge-info">{pointsOfInterest.length}</span>
                </button>
                <button className={`map-filter-btn ${filter === 'mutuelle' ? 'active' : ''}`} onClick={() => setFilter('mutuelle')}>
                  <span>{t.filterMutuelle}</span>
                  <span className="badge badge-warning">{pointsOfInterest.filter(l => l.type === 'mutuelle' || l.type === 'office').length}</span>
                </button>
                <button className={`map-filter-btn ${filter === 'hospital' ? 'active' : ''}`} onClick={() => setFilter('hospital')}>
                  <span>{t.filterHospital}</span>
                  <span className="badge badge-success">{pointsOfInterest.filter(l => l.type === 'hospital' && (l.subtype === 'hôpital' || l.subtype === 'clinique')).length}</span>
                </button>
                <button className={`map-filter-btn ${filter === 'prox' ? 'active' : ''}`} onClick={() => setFilter('prox')}>
                  <span>{t.filterProx}</span>
                  <span className="badge badge-warning">{pointsOfInterest.filter(l => l.type === 'hospital' && (l.subtype === 'centre' || l.subtype === 'poste')).length}</span>
                </button>
                <button className={`map-filter-btn ${filter === 'pharmacy' ? 'active' : ''}`} onClick={() => setFilter('pharmacy')}>
                  <span>{t.filterPharmacy}</span>
                  <span className="badge badge-info">{pointsOfInterest.filter(l => l.type === 'pharmacy').length}</span>
                </button>
                <button className={`map-filter-btn ${filter === 'tradi' ? 'active' : ''}`} onClick={() => setFilter('tradi')}>
                  <span>{t.filterTradi}</span>
                  <span className="badge badge-success">{pointsOfInterest.filter(l => l.type === 'hospital' && l.subtype === 'tradipraticien').length}</span>
                </button>
              </div>
            </div>

            {/* List Results */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>{t.resultsTitle}</h3>
              <div className="map-list-results">
                {filteredLocations.map(loc => (
                  <div key={loc.id} className="map-result-item" onClick={() => handleItemSelect(loc)}>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{loc.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--neutral-gray)' }}>{loc.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Map Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="map-card-wrapper">
              <div id="leaflet-map-root" className="map-container-mock"></div>
            </div>

            {/* Selection Card & Route Details */}
            {selectedItem && (
              <div className="card fade-in-up" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'stretch', textAlign: 'left', padding: '1.5rem' }}>
                <div style={{ flex: '2', minWidth: '280px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ 
                          backgroundColor: 'rgba(0, 102, 204, 0.1)', 
                          color: 'var(--primary)', 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          fontSize: '0.75rem', 
                          fontWeight: '700', 
                          textTransform: 'uppercase',
                          marginRight: '0.5rem',
                          display: 'inline-block',
                          marginBottom: '0.5rem'
                        }}>
                          {selectedItem.subtype || selectedItem.type}
                        </span>
                        {selectedItem.commune && (
                          <span style={{ 
                            backgroundColor: 'rgba(107, 114, 128, 0.1)', 
                            color: 'var(--neutral-dark)', 
                            padding: '3px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.75rem', 
                            fontWeight: '600',
                            display: 'inline-block',
                            marginBottom: '0.5rem'
                          }}>
                            📍 {selectedItem.commune}
                          </span>
                        )}
                        <h3 style={{ color: 'var(--neutral-dark)', fontSize: '1.45rem', fontWeight: '800', margin: '0.25rem 0 0.5rem 0' }}>{selectedItem.name}</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => calculateRoute(selectedItem)}>
                          {t.routeBtn}
                        </button>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${selectedItem.lat},${selectedItem.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline btn-sm"
                          style={{ textDecoration: 'none' }}
                        >
                          🧭 Google Maps
                        </a>
                        {selectedItem.phone && (
                          <a
                            href={`tel:${selectedItem.phone.replace(/\s+/g, '')}`}
                            className="btn btn-outline btn-sm"
                            style={{ textDecoration: 'none' }}
                          >
                            📞 Appeler
                          </a>
                        )}
                      </div>
                    </div>

                    <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-sub)' }}>
                      <strong>Adresse:</strong> {selectedItem.desc}
                    </p>
                    
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', margin: '0.75rem 0', fontSize: '0.9rem' }}>
                      <p style={{ margin: 0 }}>
                        ⏰ <strong>Horaires:</strong> {selectedItem.hours || '8h-18h'}
                      </p>
                      <p style={{ margin: 0 }}>
                        📞 <strong>Téléphone:</strong> {selectedItem.phone}
                      </p>
                    </div>

                    {/* Landmark / Point de repère */}
                    {selectedItem.landmark && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.04) 100%)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <span style={{ fontSize: '1.5rem', marginTop: '-2px' }}>📍</span>
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: '#b45309', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Point de repère pour s'orienter</strong>
                          <span style={{ fontSize: '0.9rem', color: '#78350f', fontWeight: '500' }}>{selectedItem.landmark}</span>
                        </div>
                      </div>
                    )}

                    {/* Citizen Tips / Conseils utiles */}
                    {selectedItem.localInfo && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(37, 99, 235, 0.03) 100%)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <span style={{ fontSize: '1.5rem', marginTop: '-2px' }}>💡</span>
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: '#1d4ed8', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Conseils utiles aux Sénégalais</strong>
                          <span style={{ fontSize: '0.9rem', color: '#1e3a8a', lineHeight: '1.45', display: 'block' }}>{selectedItem.localInfo}</span>
                        </div>
                      </div>
                    )}

                    {/* Coverage info */}
                    {selectedItem.coverage && selectedItem.coverage !== 'N/A' && (
                      <div style={{ 
                        margin: '1rem 0', 
                        padding: '0.75rem 1rem', 
                        backgroundColor: 'rgba(16, 185, 129, 0.08)', 
                        border: '1px solid rgba(16, 185, 129, 0.2)', 
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#065f46' }}>
                          Prise en charge : <span style={{ color: 'var(--success)', fontWeight: '700' }}>{selectedItem.coverage}</span>
                        </span>
                      </div>
                    )}

                    {/* Services / Specialities */}
                    {selectedItem.services && (
                      <div style={{ marginTop: '1rem' }}>
                        <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--neutral-gray)', textTransform: 'uppercase' }}>Services & spécialités</strong>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {selectedItem.services.split(',').map((service, idx) => (
                            <span key={idx} style={{ 
                              backgroundColor: 'rgba(0, 102, 204, 0.05)', 
                              color: 'var(--primary)', 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '0.8rem', 
                              fontWeight: '500',
                              border: '1px solid rgba(0, 102, 204, 0.1)'
                            }}>
                              {service.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {routeInfo && (
                    <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: 'var(--card-bg-subtle)', borderRadius: '8px', borderLeft: '3px solid var(--success)' }}>
                      <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--neutral-gray)', textTransform: 'uppercase' }}>{t.distanceLabel}</span>
                          <div style={{ fontWeight: '700', fontSize: '1.2rem', color: 'var(--success)' }}>{routeInfo.distance}</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--neutral-gray)', textTransform: 'uppercase' }}>{t.timeLabel}</span>
                          <div style={{ fontWeight: '700', fontSize: '1.2rem', color: 'var(--success)' }}>{routeInfo.duration}</div>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--neutral-dark)' }}>🚙 {routeInfo.details}</p>
                    </div>
                  )}
                </div>

                {/* Right side clinic image */}
                <div style={{ flex: '1', minWidth: '220px', minHeight: '180px', borderRadius: '16px', overflow: 'hidden', border: '3px solid rgba(0, 102, 204, 0.15)', boxShadow: 'var(--shadow-sm)' }}>
                  <img src={
                    selectedItem.type === 'office' || selectedItem.type === 'mutuelle'
                      ? 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=400&q=80'
                      : selectedItem.type === 'pharmacy'
                      ? 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=400&q=80'
                      : selectedItem.subtype === 'tradipraticien'
                      ? 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=400&q=80'
                      : selectedItem.subtype === 'clinique'
                      ? 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=400&q=80'
                      : 'https://images.unsplash.com/photo-1586773860418-d3b3de97e663?auto=format&fit=crop&w=400&q=80'
                  } alt={selectedItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
