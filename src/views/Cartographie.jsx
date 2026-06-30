import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function Cartographie({ lang }) {
  const [filter, setFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeInstructions, setRouteInstructions] = useState([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isImmersive, setIsImmersive] = useState(false);
  const [activeTab, setActiveTab] = useState('category');
  const [activeSpecialty, setActiveSpecialty] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const mapRef = useRef(null);
  const markersGroupRef = useRef(null);

  const dict = {
    fr: {
      title: 'Cartographie sanitaire & mutuelles',
      subtitle: 'Localisez les mutuelles de santé et les structures sanitaires conventionnées du Sénégal.',
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
      toggleImmersive: 'Mode Immersif',
      toggleNormal: 'Vue Normale'
    },
    wo: {
      title: 'Kàrtu fajukaay yi ak mutuelle yi',
      subtitle: 'Wëral mutuelle wér-gi-yaram yi ak dispensaires yi nu agréer ci Sénégal.',
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
      toggleImmersive: 'Wone Yaatu',
      toggleNormal: 'Dëppale'
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

  const { data: dbLocations = [] } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const res = await fetch('http://localhost:5000/api/locations');
      if (!res.ok) throw new Error('Failed to fetch locations');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: dbPharmacies = [] } = useQuery({
    queryKey: ['pharmacies'],
    queryFn: async () => {
      const res = await fetch('http://localhost:5000/api/pharmacies');
      if (!res.ok) throw new Error('Failed to fetch pharmacies');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const pointsOfInterest = useMemo(() => {
    let combined = [];

    // 1. Process DB Locations
    if (dbLocations && dbLocations.length > 0) {
      combined = dbLocations.map(item => ({
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
    } else {
      combined = [...locations];
    }

    // Filter out old hardcoded pharmacies to avoid duplicates
    combined = combined.filter(l => l.type !== 'pharmacy');

    // 2. Process ARP Pharmacies
    if (dbPharmacies && dbPharmacies.length > 0) {
      const fetchedPharmacies = dbPharmacies.map((item, index) => ({
        id: `pharm-${item.id || index}`,
        name: item.nom,
        type: 'pharmacy',
        subtype: 'pharmacie',
        lat: item.lat,
        lng: item.lng,
        desc: item.adresse,
        phone: '',
        commune: item.commune,
        hours: '8h-22h (selon officine)',
        services: 'Médicaments prescrits, parapharmacie',
        coverage: 'Tiers-payant CMU : 50% sur génériques',
        titulaire: item.titulaire,
        region: item.region
      }));
      combined = [...combined, ...fetchedPharmacies];
    } else {
      const hardcodedPharmacies = locations.filter(l => l.type === 'pharmacy');
      combined = [...combined, ...hardcodedPharmacies];
    }

    return combined;
  }, [dbLocations, dbPharmacies]);

  // Filter locations
  const removeAccents = (str) => {
    return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
  };

  const medicalSpecialties = [
    { key: 'cardiologie', label: 'Cardiologie', icon: '🫀' },
    { key: 'urologie', label: 'Urologie', icon: '💧' },
    { key: 'dermatologie', label: 'Dermatologie', icon: '🧼' },
    { key: 'pediatrie', label: 'Pédiatrie', icon: '👶' },
    { key: 'maternite', label: 'Gynécologie & Maternité', icon: '🤰' },
    { key: 'ophtalmologie', label: 'Ophtalmologie', icon: '👁️' },
    { key: 'dentaire', label: 'Dentaire', icon: '🦷' },
    { key: 'neurologie', label: 'Neurologie', icon: '🧠' },
    { key: 'oncologie', label: 'Oncologie', icon: '🎗️' },
    { key: 'chirurgie', label: 'Chirurgie', icon: '🔪' },
    { key: 'biologie', label: 'Biologie (Labo)', icon: '🔬' },
    { key: 'radiologie', label: 'Radiologie', icon: '🩻' },
    { key: 'generale', label: 'Médecine Générale', icon: '🩺' }
  ];

  const matchesSpecialty = (loc, specKey) => {
    if (!specKey) return true;
    
    const textToSearch = [
      loc.name || '',
      loc.desc || '',
      loc.services || '',
      loc.subtype || '',
      loc.type || ''
    ].join(' ').toLowerCase();
    
    const normalizedText = removeAccents(textToSearch);
    
    if (specKey === 'dentaire') {
      return normalizedText.includes('dent') || normalizedText.includes('odont') || normalizedText.includes('imhotep') || normalizedText.includes('absaj');
    }
    if (specKey === 'maternite') {
      return normalizedText.includes('mater') || normalizedText.includes('gyn') || normalizedText.includes('obstet') || normalizedText.includes('accouch') || loc.subtype === 'poste' || loc.subtype === 'centre' || loc.subtype === 'hôpital';
    }
    if (specKey === 'biologie') {
      return normalizedText.includes('bio') || normalizedText.includes('lab') || normalizedText.includes('analys');
    }
    if (specKey === 'radiologie') {
      return normalizedText.includes('radio') || normalizedText.includes('imag') || normalizedText.includes('x-ray') || normalizedText.includes('magnetika');
    }
    if (specKey === 'ophtalmologie') {
      return normalizedText.includes('opht') || normalizedText.includes('yeux') || normalizedText.includes('vision') || normalizedText.includes('opt') || normalizedText.includes('lunette') || normalizedText.includes('voir');
    }
    if (specKey === 'urologie') {
      return normalizedText.includes('urol') || loc.subtype === 'hôpital' || loc.subtype === 'clinique';
    }
    if (specKey === 'dermatologie') {
      return normalizedText.includes('derm') || loc.subtype === 'hôpital' || loc.subtype === 'clinique';
    }
    if (specKey === 'cardiologie') {
      return normalizedText.includes('cardio') || normalizedText.includes('coeur') || normalizedText.includes('cœur') || loc.subtype === 'hôpital' || loc.subtype === 'clinique';
    }
    if (specKey === 'pediatrie') {
      return normalizedText.includes('pedia') || normalizedText.includes('enfant') || loc.subtype === 'poste' || loc.subtype === 'centre' || loc.subtype === 'hôpital';
    }
    if (specKey === 'neurologie') {
      return normalizedText.includes('neuro') || loc.subtype === 'hôpital';
    }
    if (specKey === 'oncologie') {
      return normalizedText.includes('onco') || normalizedText.includes('cancer') || loc.subtype === 'hôpital';
    }
    if (specKey === 'chirurgie') {
      return normalizedText.includes('chir') || loc.subtype === 'hôpital' || loc.subtype === 'clinique';
    }
    if (specKey === 'generale') {
      return normalizedText.includes('gener') || normalizedText.includes('primair') || loc.subtype === 'poste' || loc.subtype === 'centre' || loc.subtype === 'hôpital';
    }
    
    return normalizedText.includes(removeAccents(specKey.toLowerCase()));
  };

  const pointsSearched = useMemo(() => {
    return pointsOfInterest.filter(loc => {
      if (!searchQuery.trim()) return true;
      
      const queryTokens = removeAccents(searchQuery.toLowerCase()).split(/\s+/).filter(t => t.length > 0);
      const combinedText = removeAccents([
        loc.name, loc.desc, loc.commune, loc.services, loc.titulaire, loc.region
      ].join(" ").toLowerCase());
      
      return queryTokens.every(token => combinedText.includes(token));
    });
  }, [pointsOfInterest, searchQuery]);

  const filteredLocations = useMemo(() => {
    if (activeTab === 'specialty' && !activeSpecialty) {
      return [];
    }
    if (activeTab === 'category' && !filter) {
      return [];
    }
    
    return pointsSearched.filter(loc => {
      if (activeTab === 'specialty') {
        return matchesSpecialty(loc, activeSpecialty);
      }
      
      if (filter === 'all') return true;
      if (filter === 'mutuelle') return loc.type === 'mutuelle' || loc.type === 'office';
      if (filter === 'hospital') return loc.type === 'hospital' && (loc.subtype === 'hôpital' || loc.subtype === 'clinique');
      if (filter === 'prox') return loc.type === 'hospital' && (loc.subtype === 'centre' || loc.subtype === 'poste');
      if (filter === 'pharmacy') return loc.type === 'pharmacy';
      if (filter === 'tradi') return loc.type === 'hospital' && loc.subtype === 'tradipraticien';
      
      return false;
    });
  }, [pointsSearched, filter, activeTab, activeSpecialty]);

  // Initialize and update Leaflet Map
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

  const calculateRoute = (item) => {
    if (!navigator.geolocation) {
      setRouteInfo({ error: true, details: "La géolocalisation n'est pas supportée par votre navigateur." });
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
              details: 'L\'itinéraire a été tracé sur la carte en vert.'
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
            setRouteInfo({ error: true, details: "Impossible de calculer l'itinéraire." });
            setRouteInstructions([]);
          });
        }
      },
      (err) => {
        console.error("Erreur GPS: ", err);
        setRouteInfo({ error: true, details: "Impossible d'obtenir votre position. Veuillez vérifier vos paramètres GPS." });
        clearRoute();
      }
    );
  };

  useEffect(() => {
    // Only initialize Leaflet map if window.L (Leaflet) exists
    if (!window.L) return;

    // Cache unique icons to avoid creating thousands of identical L.divIcon instances
    const getCachedIcon = (type, subtype) => {
      let color = '#0066cc'; // default blue
      if (type === 'office') color = '#1e3a8a'; // deep blue
      if (type === 'mutuelle') color = '#ff7f11'; // orange
      if (type === 'pharmacy') color = '#10b981'; // green
      if (type === 'hospital') {
        if (subtype === 'hôpital') color = '#ef4444'; // red
        else if (subtype === 'clinique') color = '#a855f7'; // purple
        else if (subtype === 'tradipraticien') color = '#854d0e'; // olive/brown
        else color = '#ec4899'; // pink for centers and health posts
      }

      const cacheKey = `${type}-${subtype}`;
      window.L._iconCache = window.L._iconCache || {};
      if (window.L._iconCache[cacheKey]) {
        return window.L._iconCache[cacheKey];
      }

      let iconHtml = '';
      let iconSize = [30, 30];
      let iconAnchor = [15, 15];
      let popupAnchor = [0, -15];

      if (type === 'pharmacy') {
        iconHtml = `<div style="
          background: linear-gradient(135deg, #059669, #10b981);
          color: white;
          width: 32px; height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 3px 10px rgba(5,150,105,0.5);
          border: 2px solid white;
          font-size: 14px;
        "><span style="transform:rotate(45deg)">💊</span></div>`;
        iconSize = [32, 32];
        iconAnchor = [16, 32];
        popupAnchor = [0, -35];
      } else {
        iconHtml = `
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <circle cx="12" cy="12" r="10" fill="${color}" />
            <circle cx="12" cy="12" r="4" fill="white" />
          </svg>
        `;
      }

      const icon = window.L.divIcon({
        html: iconHtml,
        className: type === 'pharmacy' ? '' : 'custom-map-icon',
        iconSize: iconSize,
        iconAnchor: iconAnchor,
        popupAnchor: popupAnchor
      });

      window.L._iconCache[cacheKey] = icon;
      return icon;
    };

    // Lazy popup content generator to avoid formatting thousands of strings on startup
    const getPopupContent = (loc) => {
      let color = '#0066cc';
      if (loc.type === 'office') color = '#1e3a8a';
      if (loc.type === 'mutuelle') color = '#ff7f11';
      if (loc.type === 'pharmacy') color = '#10b981';
      if (loc.type === 'hospital') {
        if (loc.subtype === 'hôpital') color = '#ef4444';
        else if (loc.subtype === 'clinique') color = '#a855f7';
        else if (loc.subtype === 'tradipraticien') color = '#854d0e';
        else color = '#ec4899';
      }

      if (loc.type === 'pharmacy') {
        return `
          <div style="min-width:240px; font-family:'Outfit',sans-serif; color:#0f172a; padding:4px;">
            <div style="font-weight:800; font-size:1rem; color:#059669; margin-bottom:6px;">💊 ${loc.name}</div>
            <div style="font-size:0.8rem; background:#f0fdf4; border-radius:6px; padding:6px 8px; margin-bottom:8px; color:#065f46;">
              ✓ Pharmacies Agréées CMU
            </div>
            <table style="font-size:0.78rem; width:100%; border-collapse:collapse;">
              ${loc.titulaire ? `<tr><td style="color:#64748b; padding:2px 4px 2px 0; white-space:nowrap;">👤</td><td style="color:#0f172a; padding:2px 0;">${loc.titulaire}</td></tr>` : ''}
              <tr><td style="color:#64748b; padding:2px 4px 2px 0;">📍</td><td style="color:#0f172a; padding:2px 0;">${loc.desc || '—'}</td></tr>
              <tr><td style="color:#64748b; padding:2px 4px 2px 0;">🏘️</td><td style="color:#0f172a; padding:2px 0;">${loc.commune || '—'}</td></tr>
              ${loc.region ? `<tr><td style="color:#64748b; padding:2px 4px 2px 0;">🗺️</td><td style="color:#0f172a; padding:2px 0;">${loc.region}</td></tr>` : ''}
              <tr><td style="color:#64748b; padding:2px 4px 2px 0;">🕐</td><td style="color:#0f172a; padding:2px 0;">${loc.hours || '8h – 22h (selon officine)'}</td></tr>
              <tr><td style="color:#64748b; padding:2px 4px 2px 0;">💳</td><td style="color:#059669; padding:2px 0; font-weight:600;">${loc.coverage || '50% génériques CMU'}</td></tr>
            </table>
          </div>
        `;
      } else {
        return `
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
            <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 0.95rem; font-weight: 800; line-height: 1.2;">${loc.name}</h4>
            <p style="font-size: 0.75rem; color: #475569; margin: 0 0 4px 0;">📍 ${loc.commune || 'Dakar'} - ${loc.desc}</p>
            ${loc.landmark ? `
              <div style="background: rgba(245, 158, 11, 0.08); border-left: 2.5px solid #f59e0b; padding: 4px 8px; border-radius: 4px; margin: 6px 0; font-size: 0.72rem; color: #b45309;">
                📍 <strong>Repère :</strong> ${loc.landmark}
              </div>
            ` : ''}
            <p style="font-size: 0.72rem; color: #475569; margin: 0 0 4px 0;">🕐 ${loc.hours || '8h-18h'}</p>
            <p style="font-size: 0.75rem; font-weight: bold; margin: 0; color: var(--primary);">📞 ${loc.phone}</p>
          </div>
        `;
      }
    };

    try {
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

        // Reset markers group ref to ensure it gets recreated and added to the new map!
        markersGroupRef.current = null;
      }

      // Upgrade to MarkerClusterGroup if cluster script loaded late
      const hasClusterGroup = markersGroupRef.current && typeof markersGroupRef.current.addLayers === 'function';
      if (window.L.markerClusterGroup && !hasClusterGroup) {
        if (markersGroupRef.current) {
          mapRef.current.removeLayer(markersGroupRef.current);
        }
        markersGroupRef.current = window.L.markerClusterGroup({
          maxClusterRadius: 45, // Group markers within 45px radius
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          spiderfyOnMaxZoom: true
        }).addTo(mapRef.current);
      } else if (!markersGroupRef.current) {
        // First initialization fallback if cluster group not loaded yet
        markersGroupRef.current = window.L.featureGroup().addTo(mapRef.current);
      }

      // Clear old markers
      if (markersGroupRef.current) {
        markersGroupRef.current.clearLayers();
      }

      const markerList = [];

      // Add new markers based on filter & search
      filteredLocations.forEach(loc => {
        // GPS coordinates safety check
        if (!loc || !loc.lat || !loc.lng || isNaN(parseFloat(loc.lat)) || isNaN(parseFloat(loc.lng))) {
          console.warn(`Structure de santé ignorée car les coordonnées GPS sont invalides : ${loc ? loc.name : 'Inconnue'}`);
          return;
        }

        const marker = window.L.marker([loc.lat, loc.lng], { icon: getCachedIcon(loc.type, loc.subtype) })
          .bindPopup(() => getPopupContent(loc), { closeButton: false });

        // Hover interaction: open on hover, close gracefully when mouse leaves marker and popup
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

        marker.on('click', function () {
          this.openPopup();
          setSelectedItem(loc);
          clearRoute(); // Reset route when click
          calculateRoute(loc); // Tracer l'itinéraire automatiquement au clic
        });

        markerList.push(marker);
      });

      if (markersGroupRef.current && markerList.length > 0) {
        if (typeof markersGroupRef.current.addLayers === 'function') {
          markersGroupRef.current.addLayers(markerList);
        } else {
          markerList.forEach(m => {
            if (m) markersGroupRef.current.addLayer(m);
          });
        }
      }

      // Fit bounds if markers exist
      if (markersGroupRef.current && markerList.length > 0 && mapRef.current) {
        mapRef.current.fitBounds(markersGroupRef.current.getBounds(), { padding: [50, 50] });
      }
    } catch (err) {
      console.error("Erreur lors du rendu de la carte Leaflet :", err);
      fetch('http://localhost:5000/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: err.message, stack: err.stack })
      }).catch(() => {});
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

  // Invalidate map size on immersive mode toggle
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 200);
    }
  }, [isImmersive]);

  // Invalidate map size on mobileView toggle
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 200);
    }
  }, [mobileView]);

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    clearRoute();
    
    // On mobile, switch to map view when an item is selected so they see where it is
    setMobileView('map');
    
    if (mapRef.current && markersGroupRef.current) {
      let foundLayer = null;
      markersGroupRef.current.eachLayer(layer => {
        if (typeof layer.getLatLng === 'function') {
          const latLng = layer.getLatLng();
          if (latLng && latLng.lat === item.lat && latLng.lng === item.lng) {
            foundLayer = layer;
          }
        }
      });
      
      if (foundLayer) {
        if (markersGroupRef.current.zoomToShowLayer) {
          markersGroupRef.current.zoomToShowLayer(foundLayer, () => {
            foundLayer.openPopup();
          });
        } else {
          mapRef.current.setView([item.lat, item.lng], 16);
          foundLayer.openPopup();
        }
      } else {
        mapRef.current.setView([item.lat, item.lng], 16);
      }
    }
  };

  return (
    <div className="cartographie-view fade-in-up">
      {/* CSS media queries injected dynamically */}
      <style>
        {`
          .map-view-layout {
            display: flex;
            flex-direction: column;
            gap: 2rem;
            width: 100%;
          }
          
          .map-container-mock {
            height: 500px;
            width: 100%;
            transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          }

          @media (max-width: 991px) {
            .map-sidebar-visible {
              display: ${mobileView === 'list' ? 'flex' : 'none'} !important;
              width: 100% !important;
            }
            .map-container-visible {
              display: ${mobileView === 'map' ? 'flex' : 'none'} !important;
              width: 100% !important;
            }
            .mobile-toggle-btn {
              display: flex !important;
            }
          }
          
          @media (min-width: 992px) {
            .map-view-layout {
              flex-direction: row !important;
              align-items: stretch !important;
              gap: 1.5rem !important;
            }
            .map-sidebar-visible {
              display: flex !important;
              width: 360px !important;
              flex-shrink: 0 !important;
            }
            .map-container-visible {
              display: flex !important;
              flex: 1 !important;
              min-width: 0 !important;
            }
            .map-container-mock {
              height: 680px !important;
            }
            .map-container-mock.immersive {
              height: 780px !important;
            }
            .mobile-toggle-btn {
              display: none !important;
            }
          }
          
          /* Custom Cluster styles */
          .marker-cluster-small {
            background-color: rgba(16, 185, 129, 0.4) !important;
          }
          .marker-cluster-small div {
            background-color: rgba(5, 150, 105, 0.95) !important;
            color: white !important;
            font-weight: 800;
          }
          .marker-cluster-medium {
            background-color: rgba(59, 130, 246, 0.4) !important;
          }
          .marker-cluster-medium div {
            background-color: rgba(37, 99, 235, 0.95) !important;
            color: white !important;
            font-weight: 800;
          }
          .marker-cluster-large {
            background-color: rgba(245, 158, 11, 0.4) !important;
          }
          .marker-cluster-large div {
            background-color: rgba(217, 119, 6, 0.95) !important;
            color: white !important;
            font-weight: 800;
          }
          
          /* Card hover effect */
          .map-result-card {
            border: 1px solid var(--border-color);
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .map-result-card:hover {
            border-color: var(--primary) !important;
            transform: translateY(-2px);
            box-shadow: var(--shadow-md) !important;
          }
          
          /* Custom scrollbar */
          .custom-scrollbar::-webkit-scrollbar {
            width: 5px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.15);
            border-radius: 4px;
          }
        `}
      </style>

      {/* Banner with Animated Background like PharmaciesAgrees */}
      <section className="banner-mini" style={{
        position: 'relative',
        background: 'linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%)',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center',
        overflow: 'hidden'
      }}>
        {/* Animated Background Icons */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.2, overflow: 'hidden' }}>
          {[...Array(20)].map((_, i) => (
            <span key={i} style={{
              position: 'absolute',
              fontSize: `${Math.random() * 24 + 12}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float-banner ${Math.random() * 8 + 6}s linear infinite`,
              animationDelay: `-${Math.random() * 10}s`
            }}>
              {i % 2 === 0 ? '💊' : '➕'}
            </span>
          ))}
          <style>
            {`
              @keyframes float-banner {
                0% { transform: translateY(120px) rotate(0deg); opacity: 0; }
                10% { opacity: 0.7; }
                90% { opacity: 0.7; }
                100% { transform: translateY(-30px) rotate(360deg); opacity: 0; }
              }
            `}
          </style>
        </div>
 
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{t.title}</h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1rem', fontWeight: '500', maxWidth: '600px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>{t.subtitle}</p>
        </div>
      </section>

      {/* Main Interactive Grid */}
      <section className="container section-padding" style={{ paddingTop: '1rem' }}>
        <div className={`map-view-layout ${isImmersive ? 'immersive' : ''}`}>
          {/* Sidebar controls (only when not immersive) */}
          {!isImmersive && (
            <div className="map-sidebar map-sidebar-visible" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.15rem', fontWeight: '800' }}>Filtres & recherche</h3>
                
                {/* Search */}
                <form className="map-search-bar" onSubmit={(e) => e.preventDefault()} style={{ marginBottom: '1.25rem' }}>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </form>

                {/* Tabs for Category vs Specialty */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                  <button 
                    style={{
                      flex: 1,
                      padding: '0.75rem 0.5rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'category' ? '2.5px solid var(--primary)' : 'none',
                      color: activeTab === 'category' ? 'var(--primary)' : 'var(--text-sub)',
                      fontWeight: '800',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      setActiveTab('category');
                      setActiveSpecialty(null);
                    }}
                  >
                    📂 Catégories
                  </button>
                  <button 
                    style={{
                      flex: 1,
                      padding: '0.75rem 0.5rem',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === 'specialty' ? '2.5px solid var(--primary)' : 'none',
                      color: activeTab === 'specialty' ? 'var(--primary)' : 'var(--text-sub)',
                      fontWeight: '800',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => {
                      setActiveTab('specialty');
                      setFilter('all');
                    }}
                  >
                    🩺 Spécialités
                  </button>
                </div>

                {/* TAB 1: Category filter buttons */}
                {activeTab === 'category' && (
                  <div className="map-filter-options">
                    <button className={`map-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                      <span>{t.filterAll}</span>
                      <span className="badge badge-info">{pointsSearched.length}</span>
                    </button>
                    <button className={`map-filter-btn ${filter === 'mutuelle' ? 'active' : ''}`} onClick={() => setFilter('mutuelle')}>
                      <span>{t.filterMutuelle}</span>
                      <span className="badge badge-warning">{pointsSearched.filter(l => l.type === 'mutuelle' || l.type === 'office').length}</span>
                    </button>
                    <button className={`map-filter-btn ${filter === 'hospital' ? 'active' : ''}`} onClick={() => setFilter('hospital')}>
                      <span>{t.filterHospital}</span>
                      <span className="badge badge-success">{pointsSearched.filter(l => l.type === 'hospital' && (l.subtype === 'hôpital' || l.subtype === 'clinique')).length}</span>
                    </button>
                    <button className={`map-filter-btn ${filter === 'prox' ? 'active' : ''}`} onClick={() => setFilter('prox')}>
                      <span>{t.filterProx}</span>
                      <span className="badge badge-warning">{pointsSearched.filter(l => l.type === 'hospital' && (l.subtype === 'centre' || l.subtype === 'poste')).length}</span>
                    </button>
                    <button className={`map-filter-btn ${filter === 'pharmacy' ? 'active' : ''}`} onClick={() => setFilter('pharmacy')}>
                      <span>{t.filterPharmacy}</span>
                      <span className="badge badge-info">{pointsSearched.filter(l => l.type === 'pharmacy').length}</span>
                    </button>
                    <button className={`map-filter-btn ${filter === 'tradi' ? 'active' : ''}`} onClick={() => setFilter('tradi')}>
                      <span>{t.filterTradi}</span>
                      <span className="badge badge-success">{pointsSearched.filter(l => l.type === 'hospital' && l.subtype === 'tradipraticien').length}</span>
                    </button>
                  </div>
                )}

                {/* TAB 2: Specialty Selector */}
                {activeTab === 'specialty' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                    {medicalSpecialties.map(spec => {
                      const count = pointsSearched.filter(loc => matchesSpecialty(loc, spec.key)).length;
                      const isActive = activeSpecialty === spec.key;
                      return (
                        <button
                          key={spec.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.6rem',
                            borderRadius: '8px',
                            border: isActive ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: isActive ? 'rgba(0, 102, 204, 0.08)' : 'var(--card-bg-subtle)',
                            color: isActive ? 'var(--primary)' : 'var(--text-main)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            textAlign: 'left',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onClick={() => setActiveSpecialty(isActive ? null : spec.key)}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                            <span>{spec.icon}</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spec.label}</span>
                          </span>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            padding: '1px 5px', 
                            borderRadius: '4px', 
                            backgroundColor: isActive ? 'var(--primary)' : 'var(--border-color)',
                            color: isActive ? 'white' : 'var(--text-sub)'
                          }}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* List Results */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.15rem', fontWeight: '800' }}>
                  {activeSpecialty 
                    ? `Structures (${filteredLocations.length})` 
                    : t.resultsTitle}
                </h3>
                
                <div className="map-list-results custom-scrollbar" style={{ maxHeight: '380px', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                  {filteredLocations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                      {activeTab === 'specialty' && !activeSpecialty ? (
                        <>
                          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🩺</span>
                          Veuillez choisir une spécialité médicale ci-dessus pour localiser les structures correspondantes.
                        </>
                      ) : activeTab === 'category' && !filter ? (
                        <>
                          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📂</span>
                          Veuillez choisir une catégorie ci-dessus pour localiser les structures correspondantes.
                        </>
                      ) : (
                        "Aucune structure ne correspond à votre recherche."
                      )}
                    </div>
                  ) : (
                    filteredLocations.map(loc => {
                      const isSelected = selectedItem && selectedItem.id === loc.id;
                      
                      // Type color mapping
                      let typeLabel = loc.subtype || loc.type;
                      let badgeBg = 'rgba(107, 114, 128, 0.1)';
                      let badgeColor = 'var(--text-sub)';
                      
                      if (loc.type === 'office') {
                        badgeBg = 'rgba(30, 58, 138, 0.12)';
                        badgeColor = '#1e3a8a';
                        typeLabel = 'Bureau';
                      } else if (loc.type === 'mutuelle') {
                        badgeBg = 'rgba(249, 115, 22, 0.12)';
                        badgeColor = '#ea580c';
                        typeLabel = 'Mutuelle';
                      } else if (loc.type === 'pharmacy') {
                        badgeBg = 'rgba(16, 185, 129, 0.12)';
                        badgeColor = '#059669';
                        typeLabel = 'Pharmacie';
                      } else if (loc.type === 'hospital') {
                        if (loc.subtype === 'hôpital') {
                          badgeBg = 'rgba(239, 68, 68, 0.12)';
                          badgeColor = '#dc2626';
                          typeLabel = 'Hôpital Public';
                        } else if (loc.subtype === 'clinique') {
                          badgeBg = 'rgba(168, 85, 247, 0.12)';
                          badgeColor = '#7c3aed';
                          typeLabel = 'Clinique Privée';
                        } else if (loc.subtype === 'tradipraticien') {
                          badgeBg = 'rgba(133, 77, 14, 0.12)';
                          badgeColor = '#854d0e';
                          typeLabel = 'Tradipraticien';
                        } else if (loc.subtype === 'centre') {
                          badgeBg = 'rgba(236, 72, 153, 0.12)';
                          badgeColor = '#db2777';
                          typeLabel = 'Centre de santé';
                        } else {
                          badgeBg = 'rgba(236, 72, 153, 0.12)';
                          badgeColor = '#db2777';
                          typeLabel = 'Poste de santé';
                        }
                      }

                      return (
                        <div 
                          key={loc.id} 
                          style={{
                            padding: '0.85rem',
                            borderRadius: '10px',
                            border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'rgba(0, 102, 204, 0.03)' : 'var(--bg-card)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            textAlign: 'left'
                          }}
                          onClick={() => handleItemSelect(loc)}
                          className="map-result-card"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.2' }}>{loc.name}</div>
                            <span style={{ 
                              fontSize: '0.65rem', 
                              fontWeight: '700', 
                              padding: '1px 5px', 
                              borderRadius: '4px',
                              backgroundColor: badgeBg,
                              color: badgeColor,
                              whiteSpace: 'nowrap'
                            }}>
                              {typeLabel}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📍</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                              {loc.commune || 'Dakar'} - {loc.desc}
                            </span>
                          </div>

                          {loc.services && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                              {loc.services.split(',').slice(0, 3).map((serv, sIdx) => (
                                <span key={sIdx} style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '10px', backgroundColor: 'var(--card-bg-subtle)', color: 'var(--text-sub)' }}>
                                  {serv.trim()}
                                </span>
                              ))}
                              {loc.services.split(',').length > 3 && (
                                <span style={{ fontSize: '0.65rem', padding: '1px 4px', color: 'var(--primary)', fontWeight: '600' }}>
                                  +{loc.services.split(',').length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                            <button 
                              className="btn btn-primary btn-xs" 
                              style={{ padding: '2px 8px', fontSize: '0.68rem', minHeight: 'auto', height: '22px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemSelect(loc);
                              }}
                            >
                              👁️ Carte
                            </button>
                            <button 
                              className="btn btn-outline btn-xs" 
                              style={{ padding: '2px 8px', fontSize: '0.68rem', minHeight: 'auto', height: '22px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(loc);
                                calculateRoute(loc);
                              }}
                            >
                              🚙 Itinéraire
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Map Box */}
          <div className="map-container-visible" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div className={`map-card-wrapper ${isImmersive ? 'immersive' : ''}`} style={{ position: 'relative' }}>
              
              {/* Floating Immersive Mode Button */}
              <button 
                className="btn btn-primary btn-sm"
                style={{
                  position: 'absolute',
                  top: '1.25rem',
                  right: '1.25rem',
                  zIndex: 1001,
                  boxShadow: 'var(--shadow-md)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.5rem 1rem',
                  fontWeight: '700'
                }}
                onClick={() => setIsImmersive(!isImmersive)}
              >
                {isImmersive ? '🌐 ' + t.toggleNormal : '🖥️ ' + t.toggleImmersive}
              </button>

              {/* Floating control panel when in immersive mode */}
              {isImmersive && (
                <div className="map-floating-controls fade-in-up">
                  <h3 style={{ margin: '0', fontSize: '1.05rem', fontWeight: '800', color: 'var(--neutral-dark)' }}>Filtres & recherche</h3>
                  
                  {/* Search inside floating panel */}
                  <form className="map-search-bar" onSubmit={(e) => e.preventDefault()}>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </form>

                  {/* Tabs inside floating panel */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '0.25rem' }}>
                    <button 
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'category' ? '2px solid var(--primary)' : 'none',
                        color: activeTab === 'category' ? 'var(--primary)' : 'var(--text-sub)',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      onClick={() => {
                        setActiveTab('category');
                        setActiveSpecialty(null);
                      }}
                    >
                      📂 Catégories
                    </button>
                    <button 
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'specialty' ? '2px solid var(--primary)' : 'none',
                        color: activeTab === 'specialty' ? 'var(--primary)' : 'var(--text-sub)',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      onClick={() => {
                        setActiveTab('specialty');
                        setFilter('all');
                      }}
                    >
                      🩺 Spécialités
                    </button>
                  </div>

                  {/* Floating TAB 1: Category filter buttons */}
                  {activeTab === 'category' && (
                    <div className="map-filter-options">
                      <button className={`map-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                        <span>{t.filterAll}</span>
                        <span className="badge badge-info">{pointsSearched.length}</span>
                      </button>
                      <button className={`map-filter-btn ${filter === 'mutuelle' ? 'active' : ''}`} onClick={() => setFilter('mutuelle')}>
                        <span>{t.filterMutuelle}</span>
                        <span className="badge badge-warning">{pointsSearched.filter(l => l.type === 'mutuelle' || l.type === 'office').length}</span>
                      </button>
                      <button className={`map-filter-btn ${filter === 'hospital' ? 'active' : ''}`} onClick={() => setFilter('hospital')}>
                        <span>{t.filterHospital}</span>
                        <span className="badge badge-success">{pointsSearched.filter(l => l.type === 'hospital' && (l.subtype === 'hôpital' || l.subtype === 'clinique')).length}</span>
                      </button>
                      <button className={`map-filter-btn ${filter === 'prox' ? 'active' : ''}`} onClick={() => setFilter('prox')}>
                        <span>{t.filterProx}</span>
                        <span className="badge badge-warning">{pointsSearched.filter(l => l.type === 'hospital' && (l.subtype === 'centre' || l.subtype === 'poste')).length}</span>
                      </button>
                      <button className={`map-filter-btn ${filter === 'pharmacy' ? 'active' : ''}`} onClick={() => setFilter('pharmacy')}>
                        <span>{t.filterPharmacy}</span>
                        <span className="badge badge-info">{pointsSearched.filter(l => l.type === 'pharmacy').length}</span>
                      </button>
                    </div>
                  )}

                  {/* Floating TAB 2: Specialty selector */}
                  {activeTab === 'specialty' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', maxHeight: '160px', overflowY: 'auto' }} className="custom-scrollbar">
                      {medicalSpecialties.map(spec => {
                        const count = pointsSearched.filter(loc => matchesSpecialty(loc, spec.key)).length;
                        const isActive = activeSpecialty === spec.key;
                        return (
                          <button
                            key={spec.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.4rem 0.5rem',
                              borderRadius: '6px',
                              border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isActive ? 'rgba(0, 102, 204, 0.08)' : 'var(--card-bg-subtle)',
                              color: isActive ? 'var(--primary)' : 'var(--text-main)',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              textAlign: 'left'
                            }}
                            onClick={() => setActiveSpecialty(isActive ? null : spec.key)}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden' }}>
                              <span>{spec.icon}</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>{spec.label}</span>
                            </span>
                            <span style={{ fontSize: '0.65rem', padding: '1px 3px', borderRadius: '3px', backgroundColor: isActive ? 'var(--primary)' : 'var(--border-color)', color: isActive ? 'white' : 'var(--text-sub)' }}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Filtered list results in floating panel */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.resultsTitle}</h4>
                    <div className="map-list-results custom-scrollbar" style={{ maxHeight: '180px', display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto' }}>
                      {filteredLocations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-sub)', fontSize: '0.75rem', lineHeight: '1.3' }}>
                          {activeTab === 'specialty' && !activeSpecialty ? (
                            "Choisissez une spécialité ci-dessus."
                          ) : activeTab === 'category' && !filter ? (
                            "Choisissez une catégorie ci-dessus."
                          ) : (
                            "Aucun résultat."
                          )}
                        </div>
                      ) : (
                        filteredLocations.map(loc => {
                          const isSelected = selectedItem && selectedItem.id === loc.id;
                          return (
                            <div 
                              key={loc.id} 
                              className="map-result-item" 
                              onClick={() => handleItemSelect(loc)} 
                              style={{ 
                                padding: '0.5rem 0.65rem',
                                borderRadius: '6px',
                                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                                backgroundColor: isSelected ? 'rgba(0, 102, 204, 0.03)' : 'var(--bg-card)'
                              }}
                            >
                              <div style={{ fontWeight: '800', fontSize: '0.78rem', color: 'var(--text-main)' }}>{loc.name}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {loc.commune || 'Dakar'} - {loc.desc}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div id="leaflet-map-root" className={`map-container-mock ${isImmersive ? 'immersive' : ''}`}></div>
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
                      <div className="info-box-landmark" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '1.5rem', marginTop: '-2px' }}>📍</span>
                        <div>
                          <strong className="info-box-title" style={{ fontSize: '0.8rem', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Point de repère pour s'orienter</strong>
                          <span className="info-box-text" style={{ fontSize: '0.9rem', fontWeight: '500' }}>{selectedItem.landmark}</span>
                        </div>
                      </div>
                    )}

                    {/* Citizen Tips / Conseils utiles */}
                    {selectedItem.localInfo && (
                      <div className="info-box-tips" style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                        <span style={{ fontSize: '1.5rem', marginTop: '-2px' }}>💡</span>
                        <div>
                          <strong className="info-box-title" style={{ fontSize: '0.8rem', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>Conseils utiles aux Sénégalais</strong>
                          <span className="info-box-text" style={{ fontSize: '0.9rem', lineHeight: '1.45', display: 'block' }}>{selectedItem.localInfo}</span>
                        </div>
                      </div>
                    )}

                    {/* Coverage info */}
                    {selectedItem.coverage && selectedItem.coverage !== 'N/A' && (
                      <div className="info-box-coverage" style={{ margin: '1rem 0', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>🛡️</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600' }} className="info-box-text">
                          Prise en charge : <span style={{ fontWeight: '700' }} className="info-box-value">{selectedItem.coverage}</span>
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
                      <p style={{ fontSize: '0.9rem', color: 'var(--neutral-dark)', margin: '0 0 0.5rem 0' }}>🚙 {routeInfo.details}</p>
                      
                      {routeInstructions.length > 0 && (
                        <>
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ marginTop: '0.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            onClick={() => setShowInstructions(!showInstructions)}
                          >
                            {showInstructions ? '🔼 Masquer l\'itinéraire détaillé' : '🔽 Afficher l\'itinéraire détaillé'}
                          </button>

                          {showInstructions && (
                            <div style={{ 
                              marginTop: '0.75rem', 
                              maxHeight: '200px', 
                              overflowY: 'auto', 
                              padding: '0.5rem', 
                              backgroundColor: 'var(--bg-card)', 
                              borderRadius: '6px', 
                              border: '1px solid var(--border-color)',
                              fontSize: '0.8rem'
                            }} className="custom-scrollbar">
                              {routeInstructions.map((inst, idx) => (
                                <div key={idx} style={{ 
                                  padding: '6px 0', 
                                  borderBottom: idx < routeInstructions.length - 1 ? '1px solid var(--border-color)' : 'none',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  color: 'var(--text-main)'
                                }}>
                                  <span>{idx + 1}. {inst.text}</span>
                                  <span style={{ color: 'var(--neutral-gray)', fontSize: '0.75rem', whiteSpace: 'nowrap', marginLeft: '10px' }}>
                                    {inst.distance >= 1000 ? `${(inst.distance / 1000).toFixed(1)} km` : `${Math.round(inst.distance)} m`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
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

      {/* Floating Action Button for Mobile View Toggle */}
      <button
        onClick={() => setMobileView(mobileView === 'list' ? 'map' : 'list')}
        className="btn btn-primary mobile-toggle-btn"
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'none',
          alignItems: 'center',
          gap: '8px',
          padding: '0.75rem 1.5rem',
          borderRadius: '50px',
          boxShadow: '0 4px 20px rgba(0, 102, 204, 0.4)',
          fontWeight: '800',
          fontSize: '0.95rem'
        }}
      >
        {mobileView === 'list' ? '🗺️ Afficher la Carte' : '📋 Afficher la Liste'}
      </button>
    </div>
  );
}
