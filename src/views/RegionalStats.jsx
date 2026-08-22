import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';

// 1. BASE DE DONNÉES RÉGIONALE DÉTAILLÉE DU SÉNÉGAL (14 RÉGIONS + 5 DÉPARTEMENTS DE DAKAR)
const FULL_REGIONS_DATA = [
  // DAKAR (DÉTAILLÉ EN SES 5 DÉPARTEMENTS QUAND DAKAR EST SÉLECTIONNÉ)
  { id: 'dakar', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 380000, mutuelles: 110, active: 355000, claims: 24500, reimbursed: 365000000, rate: 93.4 },
  { id: 'pikine', region: 'Dakar', zone: 'dakar', departement: 'Pikine', beneficiaries: 320000, mutuelles: 85, active: 288000, claims: 16800, reimbursed: 242000000, rate: 90.0 },
  { id: 'guediawaye', region: 'Dakar', zone: 'dakar', departement: 'Guédiawaye', beneficiaries: 210000, mutuelles: 60, active: 189000, claims: 11200, reimbursed: 165000000, rate: 90.0 },
  { id: 'rufisque', region: 'Dakar', zone: 'dakar', departement: 'Rufisque', beneficiaries: 195000, mutuelles: 55, active: 172000, claims: 9800, reimbursed: 138000000, rate: 88.2 },
  { id: 'keur-massar', region: 'Dakar', zone: 'dakar', departement: 'Keur Massar', beneficiaries: 135000, mutuelles: 40, active: 116000, claims: 6100, reimbursed: 75000000, rate: 85.9 },

  // CENTRE-OUEST (THIÈS & DIOURBEL)
  { id: 'thies', region: 'Thiès', zone: 'centre-ouest', departement: 'Thiès / Mbour', beneficiaries: 820000, mutuelles: 140, active: 710000, claims: 42100, reimbursed: 540000000, rate: 86.5 },
  { id: 'diourbel', region: 'Diourbel', zone: 'centre-ouest', departement: 'Diourbel / Touba', beneficiaries: 650000, mutuelles: 95, active: 540000, claims: 31500, reimbursed: 395000000, rate: 83.1 },

  // ZONE NORD
  { id: 'saint-louis', region: 'Saint-Louis', zone: 'nord', departement: 'Saint-Louis / Podor', beneficiaries: 510000, mutuelles: 80, active: 430000, claims: 26800, reimbursed: 310000000, rate: 84.3 },
  { id: 'louga', region: 'Louga', zone: 'nord', departement: 'Louga / Linguère', beneficiaries: 340000, mutuelles: 50, active: 270000, claims: 15100, reimbursed: 175000000, rate: 79.4 },
  { id: 'matam', region: 'Matam', zone: 'nord', departement: 'Matam / Kanel', beneficiaries: 240000, mutuelles: 38, active: 190000, claims: 9800, reimbursed: 115000000, rate: 79.1 },

  // ZONE CENTRE
  { id: 'kaolack', region: 'Kaolack', zone: 'centre', departement: 'Kaolack / Nioro', beneficiaries: 480000, mutuelles: 75, active: 390000, claims: 23400, reimbursed: 275000000, rate: 81.2 },
  { id: 'fatick', region: 'Fatick', zone: 'centre', departement: 'Fatick / Gossas', beneficiaries: 390000, mutuelles: 60, active: 320000, claims: 18900, reimbursed: 215000000, rate: 82.0 },
  { id: 'kaffrine', region: 'Kaffrine', zone: 'centre', departement: 'Kaffrine / Koungheul', beneficiaries: 220000, mutuelles: 35, active: 175000, claims: 8900, reimbursed: 98000000, rate: 79.5 },

  // ZONE SUD & EST
  { id: 'ziguinchor', region: 'Ziguinchor', zone: 'sud', departement: 'Ziguinchor / Oussouye', beneficiaries: 360000, mutuelles: 55, active: 290000, claims: 16200, reimbursed: 190000000, rate: 80.5 },
  { id: 'tambacounda', region: 'Tambacounda', zone: 'est', departement: 'Tambacounda / Bakel', beneficiaries: 280000, mutuelles: 45, active: 220000, claims: 12400, reimbursed: 145000000, rate: 78.5 },
  { id: 'kolda', region: 'Kolda', zone: 'sud', departement: 'Kolda / Vélingara', beneficiaries: 260000, mutuelles: 40, active: 200000, claims: 11200, reimbursed: 130000000, rate: 76.9 },
  { id: 'sedhiou', region: 'Sédhiou', zone: 'sud', departement: 'Sédhiou / Goudomp', beneficiaries: 190000, mutuelles: 30, active: 150000, claims: 7400, reimbursed: 82000000, rate: 78.9 },
  { id: 'kedougou', region: 'Kédougou', zone: 'est', departement: 'Kédougou / Saraya', beneficiaries: 130000, mutuelles: 22, active: 105000, claims: 5200, reimbursed: 58000000, rate: 80.7 }
];

const FULL_MUTUELLES_DATA = [
  { name: 'MSD Dakar Plateau', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 12450, claims: 3420, reimbursed: 52000000 },
  { name: 'MSD Grand-Dakar', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 10820, claims: 2890, reimbursed: 44000000 },
  { name: 'MSD Guédiawaye Centre', region: 'Dakar', zone: 'dakar', departement: 'Guédiawaye', beneficiaries: 9430, claims: 2450, reimbursed: 37500000 },
  { name: 'MSD Pikine Nord', region: 'Dakar', zone: 'dakar', departement: 'Pikine', beneficiaries: 8760, claims: 2180, reimbursed: 33000000 },
  { name: 'MSD Rufisque Centre', region: 'Dakar', zone: 'dakar', departement: 'Rufisque', beneficiaries: 7910, claims: 1950, reimbursed: 29800000 },
  { name: 'MSD Médina', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 7340, claims: 1820, reimbursed: 27500000 },
  { name: 'MSD Keur Massar Sud', region: 'Dakar', zone: 'dakar', departement: 'Keur Massar', beneficiaries: 6920, claims: 1710, reimbursed: 25400000 },
  { name: 'MSD Thiès Urbaine', region: 'Thiès', zone: 'centre-ouest', departement: 'Thiès', beneficiaries: 6890, claims: 1650, reimbursed: 24500000 },
  { name: 'MSD Mbour Littoral', region: 'Thiès', zone: 'centre-ouest', departement: 'Mbour', beneficiaries: 6210, claims: 1480, reimbursed: 22000000 },
  { name: 'MSD Saint-Louis Nord', region: 'Saint-Louis', zone: 'nord', departement: 'Saint-Louis', beneficiaries: 5870, claims: 1340, reimbursed: 19800000 },
  { name: 'MSD Touba Mosquée', region: 'Diourbel', zone: 'centre-ouest', departement: 'Diourbel', beneficiaries: 5420, claims: 1250, reimbursed: 18200000 },
  { name: 'MSD Kaolack Centre', region: 'Kaolack', zone: 'centre', departement: 'Kaolack', beneficiaries: 4950, claims: 1100, reimbursed: 16400000 },
  { name: 'MSD Ziguinchor Ville', region: 'Ziguinchor', zone: 'sud', departement: 'Ziguinchor', beneficiaries: 4520, claims: 980, reimbursed: 14500000 },
  { name: 'MSD Louga Centre', region: 'Louga', zone: 'nord', departement: 'Louga', beneficiaries: 4120, claims: 890, reimbursed: 13200000 },
  { name: 'MSD Tambacounda Ouest', region: 'Tambacounda', zone: 'est', departement: 'Tambacounda', beneficiaries: 3840, claims: 790, reimbursed: 11600000 }
];

const FULL_COMMUNES_DATA = [
  { commune: 'Dakar Plateau', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 12450, mutuelles: 3, taux: 94.2 },
  { commune: 'Médina', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 9800, mutuelles: 2, taux: 91.5 },
  { commune: 'Grand-Yoff', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 8500, mutuelles: 2, taux: 88.7 },
  { commune: 'Pikine Est', region: 'Dakar', zone: 'dakar', departement: 'Pikine', beneficiaries: 7600, mutuelles: 2, taux: 86.4 },
  { commune: 'Guédiawaye', region: 'Dakar', zone: 'dakar', departement: 'Guédiawaye', beneficiaries: 6900, mutuelles: 2, taux: 87.2 },
  { commune: 'Rufisque Ouest', region: 'Dakar', zone: 'dakar', departement: 'Rufisque', beneficiaries: 6200, mutuelles: 2, taux: 85.0 },
  { commune: 'Yoff', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 5800, mutuelles: 2, taux: 89.3 },
  { commune: 'Keur Massar Sud', region: 'Dakar', zone: 'dakar', departement: 'Keur Massar', beneficiaries: 5300, mutuelles: 2, taux: 84.1 },
  { commune: 'Parcelles Assainies', region: 'Dakar', zone: 'dakar', departement: 'Dakar Centre', beneficiaries: 4900, mutuelles: 2, taux: 88.0 },
  { commune: 'Mbour', region: 'Thiès', zone: 'centre-ouest', departement: 'Mbour', beneficiaries: 4400, mutuelles: 2, taux: 82.5 },
  { commune: 'Thiès Nord', region: 'Thiès', zone: 'centre-ouest', departement: 'Thiès', beneficiaries: 4100, mutuelles: 2, taux: 83.9 },
  { commune: 'Saint-Louis', region: 'Saint-Louis', zone: 'nord', departement: 'Saint-Louis', beneficiaries: 3800, mutuelles: 2, taux: 84.8 },
  { commune: 'Touba', region: 'Diourbel', zone: 'centre-ouest', departement: 'Diourbel', beneficiaries: 3500, mutuelles: 2, taux: 81.2 },
  { commune: 'Kaolack', region: 'Kaolack', zone: 'centre', departement: 'Kaolack', beneficiaries: 3200, mutuelles: 2, taux: 80.4 },
  { commune: 'Ziguinchor', region: 'Ziguinchor', zone: 'sud', departement: 'Ziguinchor', beneficiaries: 2900, mutuelles: 2, taux: 81.0 },
  { commune: 'Louga', region: 'Louga', zone: 'nord', departement: 'Louga', beneficiaries: 2600, mutuelles: 2, taux: 79.5 },
  { commune: 'Tambacounda', region: 'Tambacounda', zone: 'est', departement: 'Tambacounda', beneficiaries: 2400, mutuelles: 2, taux: 78.0 },
  { commune: 'Kolda', region: 'Kolda', zone: 'sud', departement: 'Kolda', beneficiaries: 2200, mutuelles: 2, taux: 77.5 }
];

const PERIOD_MULTIPLIERS = {
  '2026': { benef: 1.0, claims: 1.0, cotisPaidRate: 0.76, label: 'Année 2026 (En cours)' },
  '2025': { benef: 0.88, claims: 0.84, cotisPaidRate: 0.72, label: 'Année 2025' },
  'Q1_2026': { benef: 0.28, claims: 0.25, cotisPaidRate: 0.82, label: '1er Trimestre 2026' },
  'Q2_2026': { benef: 0.31, claims: 0.28, cotisPaidRate: 0.79, label: '2e Trimestre 2026' },
  'MONTH': { benef: 0.09, claims: 0.085, cotisPaidRate: 0.85, label: 'Mois en cours (Août 2026)' },
  'ALL': { benef: 1.25, claims: 1.35, cotisPaidRate: 0.74, label: 'Historique Global (Cumul)' }
};

export default function RegionalStats({ lang }) {
  const [selectedPeriod, setSelectedPeriod] = useState('2026');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [chartType, setChartType] = useState('BAR'); // 'BAR' | 'AREA'
  const [sortBy, setSortBy] = useState('BENEF'); // 'BENEF' | 'REIMB' | 'RATE' | 'NAME'
  const [searchCommune, setSearchCommune] = useState('');
  const [selectedRegionDetail, setSelectedRegionDetail] = useState(null);
  const [localDbCount, setLocalDbCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Charger les adhérents réels enregistrés localement
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cmu_members');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          let count = parsed.length;
          parsed.forEach(m => {
            if (m.dependents && Array.isArray(m.dependents)) count += m.dependents.length;
          });
          setLocalDbCount(count);
        }
      }
    } catch (e) {
      console.warn("Lecture locale des membres :", e);
    }
  }, []);

  const t = lang === 'fr' ? {
    title: 'Statistiques inter-régions',
    subtitle: 'Tableau de bord dynamique et comparatif des indicateurs CSU du Sénégal',
    byRegion: 'Bénéficiaires par région / département',
    claimsByRegion: 'Prises en charge & Remboursements',
    penetration: 'Taux de pénétration par commune',
    cotisations: 'Répartition des cotisations par statut',
    topMutuelles: 'Top mutuelles par effectif',
    totalBenef: 'Total Assurés',
    activeBenef: 'Assurés Actifs & Couverts',
    totalReimbursed: 'Total Remboursé (CSU)',
    activeMutuelles: 'Mutuelles Déployées',
    coverageScope: 'Périmètre Actif',
    refresh: 'Actualiser',
    filterZone: 'Filtrer par zone géographique :',
    filterPeriod: 'Période d\'analyse :',
    searchPlaceholder: '🔍 Rechercher une commune ou mutuelle...',
    exportData: '📥 Exporter les données (CSV)',
    allZones: '🌍 Toutes les régions (14)',
    dakarZone: '📍 Dakar (5 Départements)',
    centreOuestZone: '🌾 Thiès & Diourbel',
    nordZone: '🌊 Zone Nord (Saint-Louis, Louga, Matam)',
    centreZone: '☀️ Zone Centre (Kaolack, Fatick, Kaffrine)',
    sudEstZone: '🌴 Zone Sud & Est (Ziguinchor, Kolda, Tamba...)'
  } : {
    title: 'Statistiques inter-région',
    subtitle: 'Saytu ak nattate mbirum CSU ci Sénégal gu lépp',
    byRegion: 'Assuré yi ci région / département',
    claimsByRegion: 'Demande PC ak fay ci région',
    penetration: 'Taux pénétration ci commune',
    cotisations: 'Cotisation ci statut',
    topMutuelles: 'Top mutuelle yi',
    totalBenef: 'Mbooleem Assuré yi',
    activeBenef: 'Ñi baax te am kàrt',
    totalReimbursed: 'Koparu CSU bi ñu fay',
    activeMutuelles: 'Mutuelle yi am ci réew mi',
    coverageScope: 'Zone bi ñu tann',
    refresh: 'Tambali',
    filterZone: 'Tann zone bi :',
    filterPeriod: 'Jamono bi :',
    searchPlaceholder: '🔍 Seet commune mbaa mutuelle...',
    exportData: '📥 Yeb data yi (CSV)',
    allZones: '🌍 Région yépp (14)',
    dakarZone: '📍 Dakar (5 Départements)',
    centreOuestZone: '🌾 Thiès & Diourbel',
    nordZone: '🌊 Zone Nord',
    centreZone: '☀️ Zone Centre',
    sudEstZone: '🌴 Zone Sud & Est'
  };

  const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316'];
  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));

  // Dynamic calculations based on selected filters (Period, Zone, Sort)
  const dynamicData = useMemo(() => {
    const mult = PERIOD_MULTIPLIERS[selectedPeriod] || PERIOD_MULTIPLIERS['2026'];

    // If ALL is selected: consolidate Dakar's 5 departments into 1 "Dakar" entry for national chart
    let rawRegions = [];
    if (selectedZone === 'ALL') {
      const dakarDepts = FULL_REGIONS_DATA.filter(r => r.region === 'Dakar');
      const dakarConsolidated = {
        id: 'dakar',
        region: 'Dakar',
        zone: 'dakar',
        beneficiaries: dakarDepts.reduce((sum, d) => sum + d.beneficiaries, 0) + (localDbCount * 10),
        active: dakarDepts.reduce((sum, d) => sum + d.active, 0) + localDbCount,
        mutuelles: dakarDepts.reduce((sum, d) => sum + d.mutuelles, 0),
        claims: dakarDepts.reduce((sum, d) => sum + d.claims, 0),
        reimbursed: dakarDepts.reduce((sum, d) => sum + d.reimbursed, 0),
        rate: 90.3
      };
      const otherRegions = FULL_REGIONS_DATA.filter(r => r.region !== 'Dakar');
      rawRegions = [dakarConsolidated, ...otherRegions];
    } else if (selectedZone === 'dakar') {
      // Zoom into Dakar's 5 departments
      rawRegions = FULL_REGIONS_DATA.filter(r => r.zone === 'dakar').map(d => ({
        ...d,
        region: d.departement // Show department name on chart axis
      }));
    } else if (selectedZone === 'sud-est') {
      rawRegions = FULL_REGIONS_DATA.filter(r => r.zone === 'sud' || r.zone === 'est');
    } else {
      rawRegions = FULL_REGIONS_DATA.filter(r => r.zone === selectedZone);
    }

    // Apply period multiplier
    let calculatedRegions = rawRegions.map(r => ({
      ...r,
      beneficiaries: Math.round(r.beneficiaries * mult.benef),
      active: Math.round(r.active * mult.benef),
      claims: Math.round(r.claims * mult.claims),
      reimbursed: Math.round(r.reimbursed * mult.claims)
    }));

    // Apply sorting
    if (sortBy === 'BENEF') calculatedRegions.sort((a, b) => b.beneficiaries - a.beneficiaries);
    else if (sortBy === 'REIMB') calculatedRegions.sort((a, b) => b.reimbursed - a.reimbursed);
    else if (sortBy === 'RATE') calculatedRegions.sort((a, b) => b.rate - a.rate);
    else if (sortBy === 'NAME') calculatedRegions.sort((a, b) => a.region.localeCompare(b.region));

    // Filter mutuelles
    let filteredMutuelles = FULL_MUTUELLES_DATA;
    if (selectedZone !== 'ALL') {
      filteredMutuelles = FULL_MUTUELLES_DATA.filter(m => m.zone === selectedZone || (selectedZone === 'sud-est' && (m.zone === 'sud' || m.zone === 'est')));
    }
    const calculatedMutuelles = filteredMutuelles.map(m => ({
      ...m,
      beneficiaries: Math.round(m.beneficiaries * mult.benef),
      claims: Math.round(m.claims * mult.claims),
      reimbursed: Math.round(m.reimbursed * mult.claims)
    })).sort((a, b) => b.beneficiaries - a.beneficiaries);

    // Filter communes
    let filteredCommunes = FULL_COMMUNES_DATA;
    if (selectedZone !== 'ALL') {
      filteredCommunes = FULL_COMMUNES_DATA.filter(c => c.zone === selectedZone || (selectedZone === 'sud-est' && (c.zone === 'sud' || c.zone === 'est')));
    }
    if (searchCommune.trim() !== '') {
      const q = searchCommune.toLowerCase();
      filteredCommunes = filteredCommunes.filter(c => 
        c.commune.toLowerCase().includes(q) || 
        c.region.toLowerCase().includes(q) ||
        (c.departement && c.departement.toLowerCase().includes(q))
      );
    }
    const calculatedCommunes = filteredCommunes.map(c => ({
      ...c,
      beneficiaries: Math.round(c.beneficiaries * mult.benef)
    })).sort((a, b) => b.beneficiaries - a.beneficiaries);

    // Totals for KPIs
    const totalBenef = calculatedRegions.reduce((sum, r) => sum + r.beneficiaries, 0);
    const totalActive = calculatedRegions.reduce((sum, r) => sum + r.active, 0);
    const totalClaims = calculatedRegions.reduce((sum, r) => sum + r.claims, 0);
    const totalReimbursed = calculatedRegions.reduce((sum, r) => sum + r.reimbursed, 0);
    const totalMutuelles = calculatedRegions.reduce((sum, r) => sum + r.mutuelles, 0);
    const avgRate = totalBenef > 0 ? ((totalActive / totalBenef) * 100).toFixed(1) : 0;

    // Cotisations by status dynamically calculated
    const totalCotisCount = Math.round(totalBenef * 0.002);
    const totalCotisAmount = Math.round(totalReimbursed * 0.35);
    const paidRate = mult.cotisPaidRate || 0.76;
    const pendingRate = 0.17;
    const overdueRate = 1 - (paidRate + pendingRate);

    const cotisationsByStatus = [
      { name: 'Payées', count: Math.round(totalCotisCount * paidRate), total: Math.round(totalCotisAmount * paidRate), color: '#10b981' },
      { name: 'En attente', count: Math.round(totalCotisCount * pendingRate), total: Math.round(totalCotisAmount * pendingRate), color: '#3b82f6' },
      { name: 'En retard', count: Math.round(totalCotisCount * overdueRate), total: Math.round(totalCotisAmount * overdueRate), color: '#f59e0b' }
    ];

    // Scope label for 4th KPI
    let scopeLabel = '14 Régions';
    if (selectedZone === 'dakar') scopeLabel = '5 Départements';
    else if (selectedZone === 'centre-ouest') scopeLabel = '2 Régions (Thiès, Diourbel)';
    else if (selectedZone === 'nord') scopeLabel = '3 Régions (Nord)';
    else if (selectedZone === 'centre') scopeLabel = '3 Régions (Centre)';
    else if (selectedZone === 'sud-est') scopeLabel = '5 Régions (Sud/Est)';

    return {
      regions: calculatedRegions,
      mutuelles: calculatedMutuelles,
      communes: calculatedCommunes,
      cotisations: cotisationsByStatus,
      kpis: {
        totalBenef,
        totalActive,
        totalClaims,
        totalReimbursed,
        totalMutuelles,
        avgRate,
        scopeLabel
      }
    };
  }, [selectedPeriod, selectedZone, sortBy, searchCommune, localDbCount]);

  // Refresh trigger
  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 300);
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = "Entite,Beneficiaires,Actifs,Mutuelles,Demandes_PC,Rembourse_FCFA,Taux_Activite\n";
    const rows = dynamicData.regions.map(r => 
      `"${r.region}",${r.beneficiaries},${r.active},${r.mutuelles},${r.claims},${r.reimbursed},${r.rate}%`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `statistiques_csu_${selectedZone}_${selectedPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'var(--bg-card)',
      borderColor: 'var(--border-color)',
      borderRadius: '12px',
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      color: 'var(--text-main)',
      fontSize: '0.86rem'
    },
    itemStyle: { color: 'var(--text-main)', fontWeight: 'bold' },
    labelStyle: { color: 'var(--text-sub)', fontWeight: 'extrabold', marginBottom: '4px' }
  };

  return (
    <div className="regional-stats fade-in-up">
      {/* 1. HERO BANNER */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.45) 0%, rgba(16, 185, 129, 0.22) 100%), url("/dir_hero_real.png") center/cover no-repeat',
        border: '1.5px solid rgba(255, 255, 255, 0.4)',
        borderRadius: '28px',
        padding: '3.5rem 2rem',
        marginBottom: '2.5rem',
        color: '#fff',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.3)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2.2rem', fontWeight: '900', marginBottom: '0.6rem', textShadow: '0 2px 6px rgba(0,0,0,0.35)' }}>
            🗺️ {t.title}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1.05rem', fontWeight: '600', maxWidth: '750px', margin: '0 auto', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '1260px', margin: '0 auto', padding: '0 1rem' }}>

        {/* 2. BARRE DE CONTRÔLE DYNAMIQUE (FILTRES TEMPORELS & GÉOGRAPHIQUES ULTRA-AÉRÉS) */}
        <div className="card p-4 p-md-5 rounded-4 mb-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
          
          {/* SECTION A : PÉRIODE D'ANALYSE */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
              <label className="fw-extrabold text-sub small m-0" style={{ fontSize: '0.92rem' }}>
                📅 {t.filterPeriod}
              </label>
              
              {/* Actions Rapides Export + Refresh */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  className="btn fw-extrabold px-3.5 py-2 shadow-sm hover-lift d-flex align-items-center gap-2"
                  style={{ borderRadius: '14px', fontSize: '0.84rem', minHeight: '44px', background: '#059669', color: '#fff', border: '1.5px solid #10b981' }}
                  onClick={handleExportCSV}
                >
                  <span>📥</span> Exporter CSV
                </button>
                <button 
                  type="button" 
                  className="btn fw-extrabold px-3.5 py-2 shadow-sm hover-lift d-flex align-items-center gap-2"
                  style={{ borderRadius: '14px', fontSize: '0.84rem', minHeight: '44px', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}
                  onClick={handleRefresh}
                >
                  <span className={loading ? 'spinner-border spinner-border-sm' : ''}>🔄</span> {t.refresh}
                </button>
              </div>
            </div>

            {/* Boutons Période avec row-gap et column-gap explicites et marges de sécurité */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', rowGap: '1rem', width: '100%', alignItems: 'center' }}>
              {[
                { id: '2026', label: '2026' },
                { id: '2025', label: '2025' },
                { id: 'Q1_2026', label: 'T1 2026' },
                { id: 'Q2_2026', label: 'T2 2026' },
                { id: 'MONTH', label: 'Ce mois' },
                { id: 'ALL', label: 'Cumul Global' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="btn fw-extrabold shadow-sm hover-lift"
                  style={{
                    borderRadius: '14px',
                    fontSize: '0.86rem',
                    minHeight: '46px',
                    padding: '0.65rem 1.3rem',
                    margin: '0.2rem 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    background: selectedPeriod === p.id ? '#059669' : 'var(--bg-card-subtle)',
                    color: selectedPeriod === p.id ? '#ffffff' : 'var(--text-main)',
                    border: selectedPeriod === p.id ? '2px solid #10b981' : '1.5px solid var(--border-color)',
                    boxShadow: selectedPeriod === p.id ? '0 4px 14px rgba(5,150,105,0.3)' : 'none'
                  }}
                  onClick={() => setSelectedPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* SECTION B : FILTRE PAR ZONE GÉOGRAPHIQUE ULTRA-AÉRÉ */}
          <div className="pt-4 border-top" style={{ borderColor: 'var(--border-color)' }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
              <label className="fw-extrabold text-sub small m-0" style={{ fontSize: '0.92rem' }}>
                📍 {t.filterZone}
              </label>
              
              {/* Tri Dynamique des Graphiques */}
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small" style={{ fontSize: '0.78rem' }}>Trier par :</span>
                <select 
                  className="form-select form-select-sm fw-bold py-1 px-2.5" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', fontSize: '0.78rem', width: 'auto' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="BENEF">👥 Effectif Assurés (Décroissant)</option>
                  <option value="REIMB">💰 Remboursements (FCFA)</option>
                  <option value="RATE">⚡ Taux d'activité (%)</option>
                  <option value="NAME">🔤 Nom Région (A-Z)</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', rowGap: '1rem', width: '100%', alignItems: 'center' }}>
              {[
                { id: 'ALL', label: t.allZones },
                { id: 'dakar', label: t.dakarZone },
                { id: 'centre-ouest', label: t.centreOuestZone },
                { id: 'nord', label: t.nordZone },
                { id: 'centre', label: t.centreZone },
                { id: 'sud-est', label: t.sudEstZone }
              ].map(z => (
                <button
                  key={z.id}
                  type="button"
                  className="btn fw-extrabold shadow-sm hover-lift"
                  style={{
                    borderRadius: '14px',
                    fontSize: '0.85rem',
                    minHeight: '46px',
                    padding: '0.65rem 1.3rem',
                    margin: '0.2rem 0',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    background: selectedZone === z.id ? '#0f172a' : 'var(--bg-card-subtle)',
                    color: selectedZone === z.id ? '#10b981' : 'var(--text-main)',
                    border: selectedZone === z.id ? '2px solid #10b981' : '1.5px solid var(--border-color)',
                    boxShadow: selectedZone === z.id ? '0 4px 14px rgba(16,185,129,0.25)' : 'none'
                  }}
                  onClick={() => setSelectedZone(z.id)}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. CARTES KPI DYNAMIQUES ALIGNÉES SUR 4 COLONNES ÉQUILIBRÉES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          
          {/* KPI 1 : Assurés */}
          <div className="card p-4 rounded-4 shadow-sm hover-lift" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '22px' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-sub fw-bold" style={{ fontSize: '0.84rem' }}>{t.totalBenef}</span>
              <span style={{ fontSize: '1.4rem' }}>👥</span>
            </div>
            <div className="fw-black text-primary" style={{ fontSize: '1.8rem' }}>
              {fmt(dynamicData.kpis.totalBenef)}
            </div>
            <div className="d-flex align-items-center gap-2 mt-2">
              <span className="badge bg-success-subtle text-success fw-extrabold px-2.5 py-1" style={{ fontSize: '0.76rem', borderRadius: '8px' }}>
                🟢 {dynamicData.kpis.avgRate}% actifs
              </span>
              <small className="text-muted" style={{ fontSize: '0.74rem' }}>{fmt(dynamicData.kpis.totalActive)} couverts</small>
            </div>
          </div>

          {/* KPI 2 : Remboursements */}
          <div className="card p-4 rounded-4 shadow-sm hover-lift" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '22px' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-sub fw-bold" style={{ fontSize: '0.84rem' }}>{t.totalReimbursed}</span>
              <span style={{ fontSize: '1.4rem' }}>💰</span>
            </div>
            <div className="fw-black text-emerald" style={{ fontSize: '1.8rem', color: '#10b981' }}>
              {fmt(dynamicData.kpis.totalReimbursed)} <span style={{ fontSize: '0.95rem' }}>FCFA</span>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2">
              <span className="badge bg-primary-subtle text-primary fw-extrabold px-2.5 py-1" style={{ fontSize: '0.76rem', borderRadius: '8px' }}>
                🏥 {fmt(dynamicData.kpis.totalClaims)} actes
              </span>
              <small className="text-muted" style={{ fontSize: '0.74rem' }}>pris en charge</small>
            </div>
          </div>

          {/* KPI 3 : Réseau Mutuelles */}
          <div className="card p-4 rounded-4 shadow-sm hover-lift" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '22px' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-sub fw-bold" style={{ fontSize: '0.84rem' }}>{t.activeMutuelles}</span>
              <span style={{ fontSize: '1.4rem' }}>🏛️</span>
            </div>
            <div className="fw-black text-warning" style={{ fontSize: '1.8rem' }}>
              {fmt(dynamicData.kpis.totalMutuelles)}
            </div>
            <div className="d-flex align-items-center gap-2 mt-2">
              <span className="badge bg-warning-subtle text-warning fw-extrabold px-2.5 py-1" style={{ fontSize: '0.76rem', borderRadius: '8px' }}>
                ⚡ 100% connectées
              </span>
              <small className="text-muted" style={{ fontSize: '0.74rem' }}>via MUTUALIS</small>
            </div>
          </div>

          {/* KPI 4 : Périmètre de Couverture */}
          <div className="card p-4 rounded-4 shadow-sm hover-lift" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '22px' }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-sub fw-bold" style={{ fontSize: '0.84rem' }}>{t.coverageScope}</span>
              <span style={{ fontSize: '1.4rem' }}>🇸🇳</span>
            </div>
            <div className="fw-black text-info" style={{ fontSize: '1.8rem' }}>
              {dynamicData.regions.length} <span style={{ fontSize: '0.92rem', color: 'var(--text-sub)' }}>{dynamicData.kpis.scopeLabel}</span>
            </div>
            <div className="d-flex align-items-center gap-2 mt-2">
              <span className="badge bg-info-subtle text-info fw-extrabold px-2.5 py-1" style={{ fontSize: '0.76rem', borderRadius: '8px' }}>
                🌍 557 Communes
              </span>
              <small className="text-muted" style={{ fontSize: '0.74rem' }}>interopérables</small>
            </div>
          </div>
        </div>

        {/* 4. GRAPHIQUES PRINCIPAUX (GRID 2) */}
        <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* Graphique 1 : Bénéficiaires par région avec Toggle Bar / Area */}
          <div className="card p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>📍 {t.byRegion}</h3>
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {selectedZone === 'dakar' ? 'Détail des 5 départements de Dakar' : 'Répartition régionale active'}
                </small>
              </div>
              
              {/* Toggle sans aucun fond blanc */}
              <div className="d-flex gap-1.5 p-1 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn btn-sm py-1.5 px-3 fw-bold"
                  style={{ 
                    fontSize: '0.78rem', 
                    borderRadius: '8px',
                    background: chartType === 'BAR' ? '#059669' : 'transparent',
                    color: chartType === 'BAR' ? '#ffffff' : 'var(--text-sub)',
                    border: 'none'
                  }}
                  onClick={() => setChartType('BAR')}
                >
                  📊 Barres
                </button>
                <button 
                  type="button" 
                  className="btn btn-sm py-1.5 px-3 fw-bold"
                  style={{ 
                    fontSize: '0.78rem', 
                    borderRadius: '8px',
                    background: chartType === 'AREA' ? '#059669' : 'transparent',
                    color: chartType === 'AREA' ? '#ffffff' : 'var(--text-sub)',
                    border: 'none'
                  }}
                  onClick={() => setChartType('AREA')}
                >
                  📈 Aire
                </button>
              </div>
            </div>

            {dynamicData.regions.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                {chartType === 'BAR' ? (
                  <BarChart data={dynamicData.regions.map(r => ({ région: r.region, bénéficiaires: r.beneficiaries, actifs: r.active, raw: r }))} onClick={(state) => state && state.activePayload && setSelectedRegionDetail(state.activePayload[0].payload.raw)}>
                    <defs>
                      <linearGradient id="gradBeneficiaries" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.25}/>
                      </linearGradient>
                      <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.9}/>
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.25}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
                    <XAxis dataKey="région" fontSize="0.72rem" angle={-25} textAnchor="end" height={60} stroke="var(--text-sub)" />
                    <YAxis fontSize="0.72rem" allowDecimals={false} stroke="var(--text-sub)" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} formatter={(val) => [fmt(val), '']} />
                    <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />
                    <Bar dataKey="bénéficiaires" name="Bénéficiaires Totaux" fill="url(#gradBeneficiaries)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actifs" name="Assurés Actifs" fill="url(#gradActive)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <AreaChart data={dynamicData.regions.map(r => ({ région: r.region, bénéficiaires: r.beneficiaries, actifs: r.active, raw: r }))}>
                    <defs>
                      <linearGradient id="gradAreaBenef" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
                      </linearGradient>
                      <linearGradient id="gradAreaActive" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.7}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
                    <XAxis dataKey="région" fontSize="0.72rem" angle={-25} textAnchor="end" height={60} stroke="var(--text-sub)" />
                    <YAxis fontSize="0.72rem" stroke="var(--text-sub)" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip {...tooltipStyle} cursor={{ stroke: 'rgba(16, 185, 129, 0.3)', strokeWidth: 1.5, strokeDasharray: '3 3' }} formatter={(val) => [fmt(val), '']} />
                    <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="bénéficiaires" stroke="#3b82f6" fillOpacity={1} fill="url(#gradAreaBenef)" strokeWidth={2.5} />
                    <Area type="monotone" dataKey="actifs" stroke="#10b981" fillOpacity={1} fill="url(#gradAreaActive)" strokeWidth={2.5} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            ) : <Empty />}
            <small className="text-muted d-block text-center mt-2" style={{ fontSize: '0.74rem' }}>
              💡 Cliquez sur une barre pour inspecter les détails de la région
            </small>
          </div>

          {/* Graphique 2 : Prises en charge & Remboursements */}
          <div className="card p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '1rem' }}>💊 {t.claimsByRegion}</h3>
            {dynamicData.regions.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dynamicData.regions.map(r => ({ région: r.region, demandes: r.claims, remboursé: r.reimbursed }))} layout="vertical">
                  <defs>
                    <linearGradient id="gradDemandes" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#ec4899" stopOpacity={0.25}/>
                    </linearGradient>
                    <linearGradient id="gradRembourse" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.25}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
                  <XAxis type="number" fontSize="0.72rem" stroke="var(--text-sub)" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <YAxis type="category" dataKey="région" fontSize="0.72rem" width={95} stroke="var(--text-sub)" />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} formatter={(val, name) => [name === 'Montant Remboursé' ? `${fmt(val)} FCFA` : fmt(val), name]} />
                  <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />
                  <Bar dataKey="demandes" name="Demandes PC (Actes)" fill="url(#gradDemandes)" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="remboursé" name="Montant Remboursé" fill="url(#gradRembourse)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          {/* Graphique 3 : Top Mutuelles */}
          <div className="card p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '1rem' }}>🏆 {t.topMutuelles}</h3>
            {dynamicData.mutuelles.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={dynamicData.mutuelles.slice(0, 8)} layout="vertical">
                  <defs>
                    <linearGradient id="gradAdherents" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.6} />
                  <XAxis type="number" fontSize="0.72rem" stroke="var(--text-sub)" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" fontSize="0.72rem" width={140} stroke="var(--text-sub)" />
                  <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} formatter={(val) => [`${fmt(val)} adhérents`, 'Effectif']} />
                  <Bar dataKey="beneficiaries" name="Adhérents" fill="url(#gradAdherents)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>

          {/* Graphique 4 : Cotisations par statut */}
          <div className="card p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '1rem' }}>💰 {t.cotisations}</h3>
            {dynamicData.cotisations.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie 
                    data={dynamicData.cotisations} 
                    dataKey="count" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={65} 
                    outerRadius={110} 
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {dynamicData.cotisations.map((c, i) => (
                      <Cell key={i} fill={c.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} cursor={false} formatter={(val, name, props) => [`${fmt(val)} cotisations (${fmt(props.payload.total)} FCFA)`, name]} />
                  <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </div>
        </div>

        {/* 5. TIROIR DÉTAIL RÉGION SÉLECTIONNÉE (INTERACTIF) */}
        {selectedRegionDetail && (
          <div className="card p-4 rounded-4 mb-4 shadow-lg border-2 border-emerald fade-in-up" style={{ background: 'var(--bg-card)', borderRadius: '24px', borderColor: '#10b981' }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 pb-3 mb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '2rem' }}>📍</span>
                <div>
                  <h4 className="fw-black mb-0 text-success" style={{ fontSize: '1.3rem' }}>
                    Détail : {selectedRegionDetail.region}
                  </h4>
                  <small className="text-sub">Indicateurs de performance CSU synchronisés</small>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-sm fw-bold px-3.5 py-2 shadow-sm"
                style={{ borderRadius: '12px', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}
                onClick={() => setSelectedRegionDetail(null)}
              >
                ✕ Fermer le détail
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)' }}>
                <span className="text-sub small d-block mb-1">Adhérents Totaux</span>
                <strong className="text-primary" style={{ fontSize: '1.2rem' }}>{fmt(selectedRegionDetail.beneficiaries)}</strong>
              </div>
              <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)' }}>
                <span className="text-sub small d-block mb-1">Assurés Actifs</span>
                <strong className="text-success" style={{ fontSize: '1.2rem' }}>{fmt(selectedRegionDetail.active)}</strong>
              </div>
              <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)' }}>
                <span className="text-sub small d-block mb-1">Taux d'activité</span>
                <strong className="text-warning" style={{ fontSize: '1.2rem' }}>{selectedRegionDetail.rate}%</strong>
              </div>
              <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)' }}>
                <span className="text-sub small d-block mb-1">Remboursements</span>
                <strong className="text-emerald" style={{ fontSize: '1.2rem' }}>{fmt(selectedRegionDetail.reimbursed)} FCFA</strong>
              </div>
              <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)' }}>
                <span className="text-sub small d-block mb-1">Mutuelles Référencées</span>
                <strong className="text-info" style={{ fontSize: '1.2rem' }}>{selectedRegionDetail.mutuelles}</strong>
              </div>
            </div>
          </div>
        )}

        {/* 6. TAUX DE PÉNÉTRATION PAR COMMUNE (AVEC RECHERCHE EN TEMPS RÉEL) */}
        <div className="card p-4 rounded-4 mb-5 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>🏘️ {t.penetration}</h3>
              <small className="text-sub">Répartition des effectifs et taux de couverture locale ({dynamicData.communes.length} communes affichées)</small>
            </div>
            
            {/* Barre de recherche instantanée */}
            <div style={{ maxWidth: '320px', width: '100%' }}>
              <input 
                type="text" 
                className="form-control py-2.5 px-3 fw-bold"
                placeholder={t.searchPlaceholder}
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.85rem' }}
                value={searchCommune}
                onChange={(e) => setSearchCommune(e.target.value)}
              />
            </div>
          </div>

          {dynamicData.communes.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1rem' }}>
              {dynamicData.communes.map((c, i) => (
                <div 
                  key={i} 
                  className="p-3.5 rounded-4 border hover-lift" 
                  style={{ 
                    background: 'var(--bg-card-subtle)', 
                    borderColor: 'var(--border-color)', 
                    borderRadius: '16px',
                    textAlign: 'center',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onClick={() => setSelectedRegionDetail({
                    region: `${c.commune} (${c.region})`,
                    beneficiaries: c.beneficiaries,
                    active: Math.round(c.beneficiaries * ((c.taux || 85) / 100)),
                    rate: c.taux || 85,
                    reimbursed: Math.round(c.beneficiaries * 18000),
                    mutuelles: c.mutuelles
                  })}
                  role="button"
                >
                  <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{c.commune}</div>
                  <small className="text-sub d-block mb-2" style={{ fontSize: '0.76rem' }}>Région {c.region}</small>
                  
                  <div style={{ fontSize: '1.45rem', fontWeight: '900', color: COLORS[i % COLORS.length], marginBottom: '0.25rem' }}>
                    {fmt(c.beneficiaries)}
                  </div>
                  
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-2" style={{ borderColor: 'var(--border-color)', fontSize: '0.76rem' }}>
                    <span className="text-muted">{c.mutuelles} mutuelle(s)</span>
                    <span className="badge bg-success-subtle text-success fw-bold px-2 py-0.5" style={{ borderRadius: '6px' }}>
                      {c.taux || '85'}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted" style={{ background: 'var(--bg-card-subtle)', borderRadius: '16px' }}>
              🔍 Aucune commune ne correspond à votre recherche "{searchCommune}".
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Aucune donnée disponible</div>;
}

