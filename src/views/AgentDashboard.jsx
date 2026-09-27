import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DeleteModal from '../components/DeleteModal';

// Tableau de bord agent CSU : KPIs temps réel, graphiques (Recharts) et export CSV.
export default function AgentDashboard({ lang, agentUser, setView }) {
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const isSuperAdmin = agentUser && (
    agentUser.role === 'Super Admin' || 
    agentUser.role === 'admin' || 
    agentUser.role === 'superadmin'
  );

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = lang === 'fr' ? {
    title: 'Tableau de bord CSU',
    subtitle: 'Indicateurs opérationnels de la Couverture Santé Universelle — Dakar',
    kpiBeneficiaries: 'Assurés totaux',
    kpiActive: 'Assurés actifs',
    kpiPending: 'Dossiers en attente',
    kpiMutuelles: 'Mutuelles actives',
    kpiSponsors: 'Sponsors actifs',
    kpiSponsored: 'Filleuls parrainés',
    kpiParrainageFunds: 'Fonds parrainage (FCFA)',
    kpiClaims: 'Demandes de prise en charge',
    kpiReimbursed: 'Montant remboursé (FCFA)',
    kpiDonations: 'Dons collectés (FCFA)',
    kpiCotisations: 'Cotisations perçues (FCFA)',
    kpiTotalFunds: 'Total des fonds mobilisés (FCFA)',
    coverage: 'Taux de couverture',
    byPackage: 'Répartition par formule',
    byMutuelle: 'Top 10 mutuelles',
    byCommune: 'Bénéficiaires par commune',
    adhesionsTrend: 'Évolution des adhésions (30 jours)',
    claimsByStatus: 'Demandes par statut',
    complaintsByStatus: 'Réclamations par statut',
    exportCsv: 'Export CSV bénéficiaires',
    refresh: 'Actualiser',
    loading: 'Chargement des indicateurs…',
    noData: 'Aucune donnée disponible.'
  } : {
    title: 'Tableau de bord CSU',
    subtitle: 'Indicateurs yi ci Couverture Santé Universelle — Ndakaaru',
    kpiBeneficiaries: 'Assuré yi ëpp',
    kpiActive: 'Assuré yi baax',
    kpiPending: 'Mbind yi nëbb',
    kpiMutuelles: 'Mutuelle yi baax',
    kpiSponsors: 'Sponsor yi baax',
    kpiSponsored: 'Filleuls parrainés',
    kpiParrainageFunds: 'Xalis parrainage (FCFA)',
    kpiClaims: 'Demande yi ci prise en charge',
    kpiReimbursed: 'Xalis yi ñu fay (FCFA)',
    kpiDonations: 'Dons yi (FCFA)',
    kpiCotisations: 'Cotisations perçues (FCFA)',
    kpiTotalFunds: 'Mboloo xalis yi (FCFA)',
    coverage: 'Taux couverture',
    byPackage: 'Répartition formule',
    byMutuelle: 'Top 10 mutuelle',
    byCommune: 'Assuré ci commune',
    adhesionsTrend: 'Évolution adhésion (30 fan)',
    claimsByStatus: 'Demande ci statut',
    complaintsByStatus: 'Réclamation ci statut',
    exportCsv: 'Export CSV',
    refresh: 'Tambali',
    loading: 'Tambali indicator…',
    noData: 'Amul data.'
  };

  const fetchStats = () => {
    setLoading(true);
    setError('');
    // Essayer d'abord l'endpoint public (données réelles sans auth), puis auth, puis fallback statique
    const baseUrl = (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:5000' : '';
    fetch(`${baseUrl}/api/dashboard/demo-stats`)
      .then((res) => { if (!res.ok) throw new Error('Backend indisponible'); return res.json(); })
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => {
        // Essayer l'endpoint authentifié
        apiFetch('/api/dashboard/stats')
          .then((res) => { if (!res.ok) throw new Error('Auth requise'); return res.json(); })
          .then((data) => { setStats(data); setLoading(false); })
          .catch(() => {
            // AUCUN repli sur des chiffres inventés. Un tableau de bord
            // financier qui affiche 18 450 assurés et 82 972 500 FCFA sans
            // source réelle induit gravement en erreur l'agent comme la
            // hiérarchie. On affiche explicitement « données indisponibles ».
            setStats(null);
            setLoading(false);
          });
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const [activeCampaignId, setActiveCampaignId] = useState(0);
  const [campaignForm, setCampaignForm] = useState({
    titleFr: 'Soutenir la solidarité régionale',
    titleWo: 'Dimbalél wa Dakar yi',
    descriptionFr: 'Soutenez les familles les plus vulnérables de Dakar en finançant leur couverture santé annuelle (4 500 FCFA).',
    descriptionWo: 'Dimbalél wa Dakar yi gënë néewal doole ngir ñu mënë am fajj wér-gi-yaram (4 500 FCFA).',
    targetAmount: 1000000,
    baselineAmount: 720000
  });
  const [campaignSuccess, setCampaignSuccess] = useState('');
  const [campaignError, setCampaignError] = useState('');

  useEffect(() => {
    apiFetch('/api/campaign/active')
      .then(res => res.json())
      .then(data => {
        if (data && data.title_fr) {
          setActiveCampaignId(data.id);
          setCampaignForm({
            titleFr: data.title_fr,
            titleWo: data.title_wo,
            descriptionFr: data.description_fr,
            descriptionWo: data.description_wo,
            targetAmount: data.target_amount,
            baselineAmount: data.baseline_amount
          });
        }
      })
      .catch(err => console.warn('Failed to load active campaign settings:', err));
  }, []);

  const handleCampaignSubmit = (e) => {
    e.preventDefault();
    setCampaignSuccess('');
    setCampaignError('');
    apiFetch('/api/campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(campaignForm)
    })
      .then(res => {
        if (!res.ok) throw new Error('Erreur lors du démarrage de la campagne.');
        return res.json();
      })
      .then((data) => {
        setCampaignSuccess('Nouvelle campagne de don démarrée avec succès !');
        if (data && data.campaign) {
          setActiveCampaignId(data.campaign.id);
        }
        setTimeout(() => setCampaignSuccess(''), 4000);
      })
      .catch(err => {
        setCampaignError(err.message);
      });
  };

  const handleCampaignUpdate = () => {
    if (!activeCampaignId) {
      setCampaignError('Aucune campagne active à modifier.');
      return;
    }
    setCampaignSuccess('');
    setCampaignError('');
    apiFetch(`/api/campaign/${activeCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(campaignForm)
    })
      .then(res => {
        if (!res.ok) throw new Error('Erreur lors de la modification de la campagne.');
        return res.json();
      })
      .then(() => {
        setCampaignSuccess('Campagne modifiée avec succès !');
        setTimeout(() => setCampaignSuccess(''), 4000);
      })
      .catch(err => {
        setCampaignError(err.message);
      });
  };

  const handleCampaignDelete = () => {
    if (!activeCampaignId) {
      setCampaignError('Aucune campagne active à supprimer.');
      return;
    }
    const campObj = activeCampaigns.find(c => c.id === activeCampaignId);
    const campTitle = campObj ? campObj.title_fr : `Campagne #${activeCampaignId}`;
    setDeleteConfirmTarget({
      title: campTitle,
      itemType: 'Campagne de Sensibilisation CSU',
      onConfirm: () => {
        setCampaignSuccess('');
        setCampaignError('');
        const token = localStorage.getItem('cmu-token');
        fetch(`${window.API_BASE_URL}/api/campaign/${activeCampaignId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(res => {
            if (!res.ok) throw new Error('Erreur lors de la suppression de la campagne.');
            return res.json();
          })
          .then(data => {
            setCampaignSuccess(data.message || 'Campagne supprimée avec succès.');
            setActiveCampaigns(prev => prev.filter(c => c.id !== activeCampaignId));
            setActiveCampaignId(0);
            setCampaignForm({
              titleFr: 'Soutenir la solidarité régionale',
              titleWo: 'Dimbalél wa Dakar yi',
              descriptionFr: 'Soutenez les familles les plus vulnérables de Dakar en finançant leur couverture santé annuelle (4 500 FCFA).',
              descriptionWo: 'Dimbalél wa Dakar yi gënë néewal doole ngir ñu mënë am fajj wér-gi-yaram (4 500 FCFA).',
              targetAmount: 1000000,
              baselineAmount: 720000
            });
            setTimeout(() => setCampaignSuccess(''), 4000);
          })
          .catch(err => {
            setCampaignError(err.message || 'Impossible de supprimer la campagne.');
          });
      }
    });
  };

  const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

  const formatNumber = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);

  const exportCsv = () => {
    const token = localStorage.getItem('cmu-token');
    fetch(`${window.API_BASE_URL}/api/dashboard/export/beneficiaries`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'beneficiaires_csu.csv';
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => alert('Erreur lors de l\'export.'));
  };

  if (loading) {
    return (
      <div className="card text-center" style={{ padding: '3rem', margin: '2rem auto' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
        <p>{t.loading}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card text-center" style={{ padding: '3rem', margin: '2rem auto' }}>
        <p style={{ color: 'var(--danger)' }}>❌ {error}</p>
        <button className="btn btn-primary" onClick={fetchStats} style={{ marginTop: '1rem' }}>
          {t.refresh}
        </button>
      </div>
    );
  }

  // Pas de données = pas de chiffres affichés. On le dit clairement plutôt
  // que de revenir à un jeu de valeurs inventées : des montants de
  // cotisations ou de garanties fictifs sont indéfendables.
  if (!stats) {
    return (
      <div className="fade-in-up container py-4 px-3 px-md-4" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div className="card p-5 text-center" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
          <h5 className="fw-extrabold mb-2" style={{ fontSize: '1.15rem' }}>Données indisponibles</h5>
          <p className="mb-3" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
            Les statistiques de la plateforme n'ont pas pu être récupérées du serveur.
            Aucun chiffre n'est affiché : les indicateurs doivent provenir de données réelles.
          </p>
          <button type="button" className="btn btn-primary fw-extrabold px-4 py-2" onClick={fetchStats}>
            {t.refresh}
          </button>
        </div>
      </div>
    );
  }


  const coverageRate = stats.beneficiaries.total > 0
    ? Math.round((stats.beneficiaries.active / stats.beneficiaries.total) * 100)
    : 0;

  const totalFundsSum = (stats.cotisationsAmount || 0) + (stats.parrainage?.totalAmount || 0) + (stats.donations || 0);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'var(--bg-card)',
      borderColor: 'var(--border-color)',
      borderRadius: '8px',
      color: 'var(--text-main)'
    },
    itemStyle: { color: 'var(--text-main)' },
    labelStyle: { color: 'var(--text-sub)' }
  };

  return (
    <div className="dashboard-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/dashboard_hero_bg_real.png") center/cover no-repeat',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3.75rem 2.5rem',
        marginBottom: '3.5rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            📊 {t.title} — {isSuperAdmin ? 'Super administration (Sénégal)' : `MSD mutuelle de santé départementale de ${agentUser?.department || 'Dakar'}`}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchStats}>🔄 {t.refresh}</button>
          <button className="btn btn-primary btn-sm" onClick={exportCsv}>⬇️ {t.exportCsv}</button>
        </div>

      {/* KPIs cards */}
      <div className="grid grid-4" style={{ gap: '1rem', marginBottom: '2rem' }}>
        <KpiCard icon="👥" label={t.kpiBeneficiaries} value={formatNumber(stats.beneficiaries.total)} color="#3b82f6" onClick={setView ? () => { localStorage.removeItem('cmu-benef-filter'); setView('beneficiaries'); } : null} />
        <KpiCard icon="✅" label={t.kpiActive} value={formatNumber(stats.beneficiaries.active)} color="#22c55e" onClick={setView ? () => { localStorage.setItem('cmu-benef-filter', 'Actif'); setView('beneficiaries'); } : null} />
        <KpiCard icon="⏳" label={t.kpiPending} value={formatNumber(stats.beneficiaries.pending)} color="#f59e0b" onClick={setView ? () => { localStorage.setItem('cmu-benef-filter', 'En attente'); setView('beneficiaries'); } : null} />
        <KpiCard icon="🏥" label={t.kpiMutuelles} value={formatNumber(stats.mutuelles)} color="#8b5cf6" onClick={setView ? () => setView('directory') : null} />
        
        {/* Cotisations & Total Funds */}
        <KpiCard icon="💳" label={t.kpiCotisations} value={formatNumber(stats.cotisationsAmount)} color="#0ea5e9" onClick={setView ? () => setView('cotisations') : null} />
        <KpiCard icon="💎" label={t.kpiTotalFunds} value={formatNumber(totalFundsSum)} color="#10b981" onClick={setView ? () => setView('payments') : null} />
        
        {/* Parrainage Stats */}
        <KpiCard icon="🤝" label={t.kpiSponsors} value={formatNumber(stats.parrainage?.sponsorsCount)} color="#059669" onClick={setView ? () => setView('parrainage-solidaire') : null} />
        <KpiCard icon="🎁" label={t.kpiSponsored} value={formatNumber(stats.parrainage?.sponsoredCount)} color="#d97706" onClick={setView ? () => setView('parrainage-solidaire') : null} />
        <KpiCard icon="🪙" label={t.kpiParrainageFunds} value={formatNumber(stats.parrainage?.totalAmount)} color="#10b981" onClick={setView ? () => setView('parrainage-solidaire') : null} />
        
        <KpiCard icon="📋" label={t.kpiClaims} value={formatNumber(stats.claims.total)} color="#ec4899" onClick={setView ? () => setView('claims') : null} />
        <KpiCard icon="💰" label={t.kpiReimbursed} value={formatNumber(stats.claims.reimbursedAmount)} color="#14b8a6" onClick={setView ? () => setView('claims') : null} />
        <KpiCard icon="❤️" label={t.kpiDonations} value={formatNumber(stats.donations)} color="#6366f1" onClick={setView ? () => setView('payments') : null} />
        <KpiCard icon="📈" label={t.coverage} value={`${coverageRate}%`} color="#0ea5e9" onClick={setView ? () => setView('regional-stats') : null} />
      </div>

      {/* Graphiques */}
      <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Évolution des adhésions */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: 0 }}>📈 {t.adhesionsTrend}</h3>
            {stats.adhesionsTrend && stats.adhesionsTrend.length > 0 && (
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-success-subtle text-success fw-bold px-2 py-1" style={{ fontSize: '0.74rem', borderRadius: '6px' }}>
                  Total 30j : {stats.adhesionsTrend.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0).toLocaleString('fr-FR')}
                </span>
                <span className="badge bg-primary-subtle text-primary fw-bold px-2 py-1" style={{ fontSize: '0.74rem', borderRadius: '6px' }}>
                  ~{Math.round(stats.adhesionsTrend.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0) / stats.adhesionsTrend.length)} / jour
                </span>
              </div>
            )}
          </div>

          {stats.adhesionsTrend && stats.adhesionsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart 
                data={stats.adhesionsTrend.map((d) => ({ 
                  date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), 
                  fullDate: new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
                  adhesions: parseInt(d.count) || 0
                }))}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="adhesionGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.45}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" vertical={false} opacity={0.6} />
                <XAxis 
                  dataKey="date" 
                  fontSize="0.72rem" 
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-color, #cbd5e1)' }}
                  interval={3}
                  tickMargin={8}
                />
                <YAxis 
                  fontSize="0.72rem" 
                  allowDecimals={false} 
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                />
                <Tooltip 
                  {...tooltipStyle} 
                  formatter={(value) => [`${Number(value).toLocaleString('fr-FR')} nouveaux assurés`, 'Adhésions']}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0] && payload[0].payload && payload[0].payload.fullDate) {
                      return payload[0].payload.fullDate;
                    }
                    return label;
                  }}
                  cursor={{ stroke: '#10b981', strokeWidth: 1.5, strokeDasharray: '3 3' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="adhesions" 
                  stroke="#059669" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#adhesionGradient)"
                  dot={{ r: 2, fill: '#059669', stroke: '#ffffff', strokeWidth: 1 }}
                  activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Répartition par formule */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📦 {t.byPackage}</h3>
          {stats.byPackage && stats.byPackage.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie 
                    data={stats.byPackage.map((p) => ({ 
                      name: p.package_type || p.package || 'N/A', 
                      value: parseInt(p.count) 
                    }))} 
                    dataKey="value" 
                    nameKey="name" 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={46}
                    outerRadius={75} 
                    paddingAngle={3}
                    labelLine={false}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                  >
                    {stats.byPackage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip 
                    {...tooltipStyle} 
                    formatter={(value, name) => [`${Number(value).toLocaleString('fr-FR')} assurés`, name]}
                    cursor={false} 
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Badges détaillés et chiffres parfaitement lisibles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginTop: '0.75rem' }}>
                {stats.byPackage.map((p, i) => {
                  const pkgName = p.package_type || p.package || 'N/A';
                  const val = parseInt(p.count) || 0;
                  const total = stats.byPackage.reduce((acc, curr) => acc + (parseInt(curr.count) || 0), 0);
                  const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                  const col = COLORS[i % COLORS.length];

                  return (
                    <div 
                      key={i} 
                      style={{ 
                        padding: '0.5rem 0.65rem', 
                        borderRadius: '10px', 
                        background: 'var(--bg-card-subtle, rgba(0,0,0,0.02))', 
                        border: `1px solid var(--border-color, #e2e8f0)`,
                        borderLeft: `4px solid ${col}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center">
                        <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-main)' }}>{pkgName}</span>
                        <span style={{ fontSize: '0.66rem', fontWeight: '800', color: col }}>{pct}%</span>
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '850', color: col, letterSpacing: '-0.02em' }}>
                        {val.toLocaleString('fr-FR')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <EmptyChart />}
        </div>

        {/* Top 10 mutuelles */}
         <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏆 {t.byMutuelle}</h3>
          {stats.byMutuelle && stats.byMutuelle.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stats.byMutuelle.map((m) => {
                let n = m.mutuelle_name || m.name || '';
                n = n.replace('Mutuelle de ', '');
                n = n.replace('Union Départementale de ', 'UD ');
                n = n.replace('Union Departementale de ', 'UD ');
                n = n.replace('UDMS de ', 'UD ');
                n = n.replace('MSD mutuelle de santé départementale de ', 'MSD ');
                n = n.replace('MSD de ', 'MSD ');
                n = n.replace(/\(UDMS.*\)/, '');
                n = n.replace(/\(MSD.*\)/, '');
                return { name: n.trim() || '—', bénéficiaires: parseInt(m.count) };
              })} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" fontSize="0.7rem" allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize="0.7rem" width={150} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} />
                <Bar dataKey="bénéficiaires" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Bénéficiaires par commune */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📍 {t.byCommune}</h3>
          {stats.byCommune && stats.byCommune.filter((c) => c.commune).length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
               <BarChart data={stats.byCommune.filter((c) => c.commune).map((c) => ({ commune: c.commune, count: parseInt(c.count) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="commune" fontSize="0.7rem" angle={-30} textAnchor="end" height={60} />
                <YAxis fontSize="0.7rem" allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(16, 185, 129, 0.06)' }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Demandes par statut */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📋 {t.claimsByStatus}</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {(stats.claims?.byStatus || stats.claimsByStatus) && (stats.claims?.byStatus || stats.claimsByStatus).length > 0 ? (
            (stats.claims?.byStatus || stats.claimsByStatus).map((s, i) => {
              const statusLabel = lang === 'fr' ? {
                pending: 'En attente',
                approved: 'Approuvé',
                paid: 'Payé',
                rejected: 'Rejeté'
              }[s.status.toLowerCase()] || s.status : {
                pending: 'Xaar',
                approved: 'Nangu',
                paid: 'Fay',
                rejected: 'Bagn'
              }[s.status.toLowerCase()] || s.status;

              return (
                <div key={i} style={{
                  background: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '12px',
                  textAlign: 'center', minWidth: '120px'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: COLORS[i % COLORS.length] }}>{s.count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{statusLabel}</div>
                </div>
              );
            })
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Configuration de la Campagne de Solidarité (Super Admin uniquement) */}
      {isSuperAdmin && (
        <div className="card text-left" style={{ padding: '2rem', marginBottom: '2rem', borderRadius: '16px', borderLeft: '5px solid var(--secondary)' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '850', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            🤝 {lang === 'fr' ? 'Gestion de la campagne de solidarité' : 'Campagne solidarité'}
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
            {lang === 'fr' 
              ? 'Configurez, modifiez ou supprimez les campagnes de don pour la solidarité régionale. Seul le Super Admin possède ces droits.'
              : 'Defal yene parameters yi ngir dimbeli niou newal doole.'}
          </p>

          {campaignSuccess && <div className="alert alert-success" style={{ marginBottom: '1rem' }}>{campaignSuccess}</div>}
          {campaignError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{campaignError}</div>}

          <form onSubmit={handleCampaignSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{lang === 'fr' ? 'Titre de la campagne (FR)' : 'Titre (FR)'}</label>
              <input 
                type="text" 
                className="form-control"
                value={campaignForm.titleFr}
                onChange={(e) => setCampaignForm({ ...campaignForm, titleFr: e.target.value })}
                required 
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{lang === 'fr' ? 'Titre de la campagne (Wolof)' : 'Titre (WO)'}</label>
              <input 
                type="text" 
                className="form-control"
                value={campaignForm.titleWo}
                onChange={(e) => setCampaignForm({ ...campaignForm, titleWo: e.target.value })}
                required 
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
              <label className="form-label">{lang === 'fr' ? 'Description (FR)' : 'Description (FR)'}</label>
              <textarea 
                className="form-control"
                rows="3"
                value={campaignForm.descriptionFr}
                onChange={(e) => setCampaignForm({ ...campaignForm, descriptionFr: e.target.value })}
                required 
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
              <label className="form-label">{lang === 'fr' ? 'Description (Wolof)' : 'Description (WO)'}</label>
              <textarea 
                className="form-control"
                rows="3"
                value={campaignForm.descriptionWo}
                onChange={(e) => setCampaignForm({ ...campaignForm, descriptionWo: e.target.value })}
                required 
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{lang === 'fr' ? 'Objectif financier (FCFA)' : 'Objectif (FCFA)'}</label>
              <input 
                type="number" 
                className="form-control"
                value={campaignForm.targetAmount}
                onChange={(e) => setCampaignForm({ ...campaignForm, targetAmount: parseInt(e.target.value || '0') })}
                required 
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{lang === 'fr' ? 'Fonds de base de départ (FCFA)' : 'Base (FCFA)'}</label>
              <input 
                type="number" 
                className="form-control"
                value={campaignForm.baselineAmount}
                onChange={(e) => setCampaignForm({ ...campaignForm, baselineAmount: parseInt(e.target.value || '0') })}
                required 
              />
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              {activeCampaignId > 0 && (
                <>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleCampaignUpdate} style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}>
                    ✏️ {lang === 'fr' ? 'Modifier la campagne' : 'Modifier'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleCampaignDelete} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    🗑️ {lang === 'fr' ? 'Supprimer' : 'Supprimer'}
                  </button>
                </>
              )}
              <button type="submit" className="btn btn-secondary btn-sm">
                🚀 {lang === 'fr' ? 'Créer & activer' : 'Créer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GESTION & HABILITATION DES MÉDECINS DE TÉLÉMÉDECINE (EXCLUSIVITÉ SUPER ADMIN) */}
      {isSuperAdmin && (
        <SuperAdminDoctorManagement lang={lang} />
      )}
      </div>
    </div>
  );
}

function SuperAdminDoctorManagement({ lang }) {
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const defaultDoctors = [
    { id: 1, name: 'Dr. Aminata Ndiaye', specialty: 'Pédiatrie & santé familiale', cnom: 'CNOM-SN-2026-8819', phone: '77 602 67 83', active: true },
    { id: 2, name: 'Dr. Cheikh Tidiane Seck', specialty: 'Cardiologie & médecine générale', cnom: 'CNOM-SN-2026-9921', phone: '78 123 45 67', active: true },
    { id: 3, name: 'Dr. Mariama Ba', specialty: 'Gynécologie-obstétrique', cnom: 'CNOM-SN-2026-3310', phone: '76 543 21 09', active: true }
  ];

  const [doctors, setDoctors] = useState(() => {
    try {
      const stored = localStorage.getItem('cmu_telemed_doctors');
      return stored ? JSON.parse(stored) : defaultDoctors;
    } catch (e) {
      return defaultDoctors;
    }
  });

  const [docName, setDocName] = useState('');
  const [docSpecialty, setDocSpecialty] = useState('Pédiatrie & santé familiale');
  const [docCnom, setDocCnom] = useState('');
  const [docPhone, setDocPhone] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    localStorage.setItem('cmu_telemed_doctors', JSON.stringify(doctors));
  }, [doctors]);

  const handleAddDoctor = (e) => {
    e.preventDefault();
    if (!docName.trim() || !docCnom.trim()) return;

    const newDoc = {
      id: Date.now(),
      name: docName.startsWith('Dr.') ? docName : `Dr. ${docName}`,
      specialty: docSpecialty,
      cnom: docCnom,
      phone: docPhone || '77 000 00 00',
      active: true
    };

    setDoctors([newDoc, ...doctors]);
    setDocName('');
    setDocCnom('');
    setDocPhone('');
    setSuccessMsg(`✅ ${newDoc.name} a été habilité(e) avec succès par le super admin pour la télémédecine !`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const toggleDoctorStatus = (id) => {
    setDoctors(doctors.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  return (
    <div className="card shadow-sm border-0 mt-5 mb-5" style={{ borderRadius: '28px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderTop: '6px solid #10b981', padding: '2.5rem 2.25rem', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 flex-wrap" style={{ gap: '1.5rem', borderBottom: '1.5px solid var(--border-color)' }}>
        <div className="d-flex align-items-center gap-3.5">
          <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', color: '#fff', boxShadow: '0 6px 18px rgba(16,185,129,0.35)', flexShrink: 0 }}>
            👨‍⚕️
          </div>
          <div>
            <h4 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
              Habilitation exclusive des médecins de télémédecine <span style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '800' }}>(Super admin)</span>
            </h4>
            <small style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: '1.6' }}>
              Seul le super admin a l'autorité de créer, accréditer ou révoquer les médecins agréés UNAMUSC.
            </small>
          </div>
        </div>
        <span className="badge px-3.5 py-2.5 fw-bold" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1.5px solid rgba(16, 185, 129, 0.35)', borderRadius: '14px', fontSize: '0.9rem' }}>
          🟢 {doctors.length} praticien(s) accrédité(s)
        </span>
      </div>

      {successMsg && <div className="alert alert-success py-3 px-3.5 mb-4 small rounded-3 fw-bold" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1.5px solid rgba(16, 185, 129, 0.35)', borderRadius: '14px', fontSize: '0.92rem' }}>{successMsg}</div>}

      <div className="row g-4" style={{ rowGap: '2.5rem' }}>
        {/* Formulaire de création médecin Super Admin */}
        <div className="col-lg-5 col-md-12">
          <form onSubmit={handleAddDoctor} className="p-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', borderRadius: '22px', boxShadow: '0 6px 20px rgba(0,0,0,0.04)' }}>
            <h5 className="fw-extrabold mb-3.5" style={{ color: '#10b981', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              ➕ Accréditer un nouveau médecin :
            </h5>
            
            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-2 d-block" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Nom & prénom du médecin *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} placeholder="ex: Dr. Mariama Diallo" value={docName} onChange={(e) => setDocName(e.target.value)} required />
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-2 d-block" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Spécialité médicale *</label>
              <select className="form-select" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={docSpecialty} onChange={(e) => setDocSpecialty(e.target.value)}>
                <option value="Pédiatrie & santé familiale">Pédiatrie & santé familiale</option>
                <option value="Cardiologie & médecine générale">Cardiologie & médecine générale</option>
                <option value="Gynécologie-obstétrique">Gynécologie-obstétrique</option>
                <option value="Médecine d'urgence & garde 24/7">Médecine d'urgence & garde 24/7</option>
                <option value="Dermatologie">Dermatologie</option>
              </select>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-2 d-block" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>N° ordre des médecins (CNOM) *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} placeholder="ex: CNOM-SN-2026-8819" value={docCnom} onChange={(e) => setDocCnom(e.target.value)} required />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-2 d-block" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Téléphone praticien *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} placeholder="ex: 77 602 67 83 ou 71 123 45 67" value={docPhone} onChange={(e) => setDocPhone(e.target.value)} />
            </div>

            <button type="submit" className="btn w-100 fw-extrabold hover-lift text-white" style={{ background: '#059669', border: 'none', borderRadius: '14px', minHeight: '48px', fontSize: '0.94rem', padding: '0.9rem 1.5rem', boxShadow: '0 4px 16px rgba(5,150,105,0.3)' }}>
              🔒 Habiliter & délivrer les accès télémédecine
            </button>
          </form>
        </div>

        {/* Liste des médecins accrédités */}
        <div className="col-lg-7 col-md-12">
          <div className="p-4 border h-100" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', borderRadius: '22px', boxShadow: '0 6px 20px rgba(0,0,0,0.04)' }}>
            <h5 className="fw-extrabold mb-3.5" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>
              📋 Médecins agréés UNAMUSC en activité :
            </h5>
            <div className="d-flex flex-column" style={{ gap: '1.25rem', maxHeight: '420px', overflowY: 'auto' }}>
              {doctors.map(d => (
                <div key={d.id} className="p-3.5 border d-flex justify-content-between align-items-center hover-lift" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '18px' }}>
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>{d.name}</h6>
                    <small style={{ color: 'var(--text-sub)', display: 'block', fontSize: '0.88rem', marginBottom: '0.25rem' }}>
                      {d.specialty} • <code style={{ color: '#10b981', fontWeight: '800', background: 'rgba(16, 185, 129, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '8px' }}>{d.cnom}</code>
                    </small>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.85rem', fontWeight: '600', display: 'block' }}>
                      📞 {d.phone}
                    </small>
                  </div>
                  <button 
                    className={`btn fw-bold hover-lift ${d.active ? 'btn-success' : 'btn-secondary'}`}
                    style={{ borderRadius: '12px', minHeight: '40px', padding: '0.55rem 1.15rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                    onClick={() => toggleDoctorStatus(d.id)}
                  >
                    {d.active ? '🟢 Accrédité' : '🔴 Suspendu'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <DeleteModal 
        isOpen={!!deleteConfirmTarget}
        title={deleteConfirmTarget?.title}
        itemType={deleteConfirmTarget?.itemType}
        onConfirm={deleteConfirmTarget?.onConfirm}
        onClose={() => setDeleteConfirmTarget(null)}
      />

    </div>
  );
}

function KpiCard({ icon, label, value, color, onClick }) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '1.25rem',
        borderLeft: `4px solid ${color}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)'; } }}
      onMouseLeave={(e) => { if (onClick) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
        {onClick && (
          <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '10px', background: `${color}18`, color: color, fontWeight: '700' }}>
            👉 Voir
          </span>
        )}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
      Aucune donnée
    </div>
  );
}
