import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// Tableau de bord agent CSU : KPIs temps réel, graphiques (Recharts) et export CSV.
export default function AgentDashboard({ lang, agentUser }) {
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
    kpiClaims: 'Demandes de prise en charge',
    kpiReimbursed: 'Montant remboursé (FCFA)',
    kpiDonations: 'Dons collectés (FCFA)',
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
    kpiClaims: 'Demande yi ci prise en charge',
    kpiReimbursed: 'Xalis yi ñu fay (FCFA)',
    kpiDonations: 'Dons yi (FCFA)',
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
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>📊 {t.title}</h1>
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
        <KpiCard icon="📋" label={t.kpiClaims} value={formatNumber(stats.claims.total)} color="#ec4899" />
        <KpiCard icon="💰" label={t.kpiReimbursed} value={formatNumber(stats.claims.reimbursedAmount)} color="#14b8a6" />
        <KpiCard icon="🎁" label={t.kpiDonations} value={formatNumber(stats.donations)} color="#6366f1" />
        <KpiCard icon="📈" label={t.coverage} value={`${coverageRate}%`} color="#059669" />
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
                <Tooltip />
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
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        {/* Top 10 mutuelles */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏆 {t.byMutuelle}</h3>
          {stats.byMutuelle && stats.byMutuelle.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.byMutuelle.map((m) => ({ name: m.mutuelle_name?.replace('Mutuelle de ', '') || '—', bénéficiaires: parseInt(m.count) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" fontSize="0.7rem" allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize="0.7rem" width={100} />
                <Tooltip />
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
                <Tooltip />
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
            stats.claims.byStatus.map((s, i) => (
              <div key={i} style={{
                background: 'var(--bg-secondary)', padding: '1rem 1.5rem', borderRadius: '12px',
                textAlign: 'center', minWidth: '120px'
              }}>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: COLORS[i % COLORS.length] }}>{s.count}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s.status}</div>
              </div>
            ))
          ) : <EmptyChart />}
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
