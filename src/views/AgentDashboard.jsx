import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// Tableau de bord agent CSU : KPIs temps réel, graphiques (Recharts) et export CSV.
export default function AgentDashboard({ lang, agentUser }) {
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
    const token = localStorage.getItem('cmu-token');
    fetch('http://localhost:5000/api/dashboard/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Erreur API');
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
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
    fetch('http://localhost:5000/api/campaign/active')
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
    const token = localStorage.getItem('cmu-token');
    fetch('http://localhost:5000/api/campaign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    const token = localStorage.getItem('cmu-token');
    fetch(`http://localhost:5000/api/campaign/${activeCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette campagne ? Cette action est irréversible.')) {
      return;
    }
    setCampaignSuccess('');
    setCampaignError('');
    const token = localStorage.getItem('cmu-token');
    fetch(`http://localhost:5000/api/campaign/${activeCampaignId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Erreur lors de la suppression de la campagne.');
        return res.json();
      })
      .then(() => {
        setCampaignSuccess('Campagne supprimée avec succès !');
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
        setCampaignError(err.message);
      });
  };

  const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];

  const formatNumber = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);

  const exportCsv = () => {
    const token = localStorage.getItem('cmu-token');
    fetch('http://localhost:5000/api/dashboard/export/beneficiaries', {
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

  if (!stats) return null;

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
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_dashboard_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            📊 {t.title} — {isSuperAdmin ? 'Super Administration (Sénégal)' : `MSD mutuelle de santé départementale de ${agentUser?.department || 'Dakar'}`}
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
        <KpiCard icon="👥" label={t.kpiBeneficiaries} value={formatNumber(stats.beneficiaries.total)} color="#3b82f6" />
        <KpiCard icon="✅" label={t.kpiActive} value={formatNumber(stats.beneficiaries.active)} color="#22c55e" />
        <KpiCard icon="⏳" label={t.kpiPending} value={formatNumber(stats.beneficiaries.pending)} color="#f59e0b" />
        <KpiCard icon="🏥" label={t.kpiMutuelles} value={formatNumber(stats.mutuelles)} color="#8b5cf6" />
        
        {/* Cotisations & Total Funds */}
        <KpiCard icon="💳" label={t.kpiCotisations} value={formatNumber(stats.cotisationsAmount)} color="#0ea5e9" />
        <KpiCard icon="💎" label={t.kpiTotalFunds} value={formatNumber(totalFundsSum)} color="#10b981" />
        
        {/* Parrainage Stats */}
        <KpiCard icon="🤝" label={t.kpiSponsors} value={formatNumber(stats.parrainage?.sponsorsCount)} color="#059669" />
        <KpiCard icon="🎁" label={t.kpiSponsored} value={formatNumber(stats.parrainage?.sponsoredCount)} color="#d97706" />
        <KpiCard icon="🪙" label={t.kpiParrainageFunds} value={formatNumber(stats.parrainage?.totalAmount)} color="#10b981" />
        
        <KpiCard icon="📋" label={t.kpiClaims} value={formatNumber(stats.claims.total)} color="#ec4899" />
        <KpiCard icon="💰" label={t.kpiReimbursed} value={formatNumber(stats.claims.reimbursedAmount)} color="#14b8a6" />
        <KpiCard icon="❤️" label={t.kpiDonations} value={formatNumber(stats.donations)} color="#6366f1" />
        <KpiCard icon="📈" label={t.coverage} value={`${coverageRate}%`} color="#0ea5e9" />
      </div>

      {/* Graphiques */}
      <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Évolution des adhésions */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📈 {t.adhesionsTrend}</h3>
          {stats.adhesionsTrend && stats.adhesionsTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={stats.adhesionsTrend.map((d) => ({ date: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), adhesions: parseInt(d.count) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" fontSize="0.7rem" />
                <YAxis fontSize="0.7rem" allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="adhesions" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Répartition par formule */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📦 {t.byPackage}</h3>
          {stats.byPackage && stats.byPackage.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                 <Pie data={stats.byPackage.map((p) => ({ name: p.package_type, value: parseInt(p.count) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {stats.byPackage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Top 10 mutuelles */}
         <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏆 {t.byMutuelle}</h3>
          {stats.byMutuelle && stats.byMutuelle.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={stats.byMutuelle.map((m) => {
                let n = m.mutuelle_name || '';
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
                <Tooltip {...tooltipStyle} />
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
                <Tooltip {...tooltipStyle} />
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
          {stats.claims.byStatus && stats.claims.byStatus.length > 0 ? (
            stats.claims.byStatus.map((s, i) => {
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
                🚀 {lang === 'fr' ? 'Créer & Activer' : 'Créer'}
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
  const defaultDoctors = [
    { id: 1, name: 'Dr. Aminata Ndiaye', specialty: 'Pédiatrie & Santé Familiale', cnom: 'CNOM-SN-2026-8819', phone: '77 602 67 83', active: true },
    { id: 2, name: 'Dr. Cheikh Tidiane Seck', specialty: 'Cardiologie & Médecine Générale', cnom: 'CNOM-SN-2026-9921', phone: '78 123 45 67', active: true },
    { id: 3, name: 'Dr. Mariama Ba', specialty: 'Gynécologie-Obstétrique', cnom: 'CNOM-SN-2026-3310', phone: '76 543 21 09', active: true }
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
  const [docSpecialty, setDocSpecialty] = useState('Pédiatrie');
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
    setSuccessMsg(`✅ ${newDoc.name} a été habilité(e) avec succès par le Super Admin pour la Télémédecine !`);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const toggleDoctorStatus = (id) => {
    setDoctors(doctors.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  return (
    <div className="card shadow-sm border-0 p-4 mt-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)', borderTop: '6px solid var(--primary)' }}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="fw-bold mb-0 text-primary">👨‍⚕️ Habilitation Exclusive des Médecins de Télémédecine (Super Admin)</h4>
          <small className="text-muted">Seul le Super Admin a l'autorité de créer, accréditer ou révoquer les médecins agréés UNAMUSC.</small>
        </div>
        <span className="badge bg-primary px-3 py-2 fw-bold">{doctors.length} Praticien(s) Accrédité(s)</span>
      </div>

      {successMsg && <div className="alert alert-success py-2 px-3 mb-3 small rounded-3">{successMsg}</div>}

      <div className="row g-4">
        {/* Formulaire de création médecin Super Admin */}
        <div className="col-md-5">
          <form onSubmit={handleAddDoctor} className="p-3 border rounded-3 bg-light text-dark">
            <h6 className="fw-bold mb-3 text-uppercase text-primary">➕ Accréditer un Nouveau Médecin :</h6>
            
            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Nom & Prénom du Médecin *</label>
              <input type="text" className="form-control form-control-sm" placeholder="ex: Dr. Mariama Diallo" value={docName} onChange={(e) => setDocName(e.target.value)} required />
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">Spécialité Médicale *</label>
              <select className="form-select form-select-sm" value={docSpecialty} onChange={(e) => setDocSpecialty(e.target.value)}>
                <option value="Pédiatrie & Santé Familiale">Pédiatrie & Santé Familiale</option>
                <option value="Cardiologie & Médecine Générale">Cardiologie & Médecine Générale</option>
                <option value="Gynécologie-Obstétrique">Gynécologie-Obstétrique</option>
                <option value="Médecine d'Urgence & Garde 24/7">Médecine d'Urgence & Garde 24/7</option>
                <option value="Dermatologie">Dermatologie</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="form-label small fw-bold mb-1">N° Ordre des Médecins (CNOM) *</label>
              <input type="text" className="form-control form-control-sm" placeholder="ex: CNOM-SN-2026-8819" value={docCnom} onChange={(e) => setDocCnom(e.target.value)} required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Téléphone Praticien *</label>
              <input type="text" className="form-control form-control-sm" placeholder="ex: 77 602 67 83 ou 71 123 45 67" value={docPhone} onChange={(e) => setDocPhone(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-sm btn-primary w-100 fw-bold py-2">
              🔒 Habiliter & Délivrer les Accès Télémédecine
            </button>
          </form>
        </div>

        {/* Liste des médecins accrédités */}
        <div className="col-md-7">
          <h6 className="fw-bold mb-2">📋 Médecins Agréés UNAMUSC en Activité :</h6>
          <div className="d-flex flex-column gap-2" style={{ maxHeight: '310px', overflowY: 'auto' }}>
            {doctors.map(d => (
              <div key={d.id} className="p-3 border rounded-3 d-flex justify-content-between align-items-center bg-white text-dark shadow-sm">
                <div>
                  <h6 className="fw-bold mb-0 text-primary">{d.name}</h6>
                  <small className="text-muted d-block">{d.specialty} • <code className="text-success fw-bold">{d.cnom}</code></small>
                  <small className="text-muted">📞 {d.phone}</small>
                </div>
                <button 
                  className={`btn btn-sm fw-bold ${d.active ? 'btn-success' : 'btn-secondary'}`}
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
  );
}

function KpiCard({ icon, label, value, color }) {
  return (
    <div className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
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
