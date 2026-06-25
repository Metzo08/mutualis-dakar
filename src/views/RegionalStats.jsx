import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

// Statistiques comparatives inter-régions : compare les indicateurs CSU
// entre les régions/départements couverts par MUTUALIS DAKAR.
export default function RegionalStats({ lang }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = lang === 'fr' ? {
    title: 'Statistiques inter-régions',
    subtitle: 'Comparaison des indicateurs CSU entre les régions de Dakar',
    byRegion: 'Bénéficiaires par région',
    claimsByRegion: 'Demandes de prise en charge par région',
    penetration: 'Taux de pénétration par commune (top 20)',
    cotisations: 'Cotisations par statut',
    topMutuelles: 'Top 10 mutuelles par adhérents',
    beneficiaries: 'Bénéficiaires',
    active: 'Actifs',
    mutuelles: 'Mutuelles',
    claims: 'Demandes PC',
    reimbursed: 'Remboursé (FCFA)',
    refresh: 'Actualiser',
    loading: 'Chargement…',
    noData: 'Aucune donnée.'
  } : {
    title: 'Statistiques inter-région',
    subtitle: 'Comparaison indicateurs CSU ci région yi Dakar',
    byRegion: 'Assuré ci région',
    claimsByRegion: 'Demande PC ci région',
    penetration: 'Taux pénétration ci commune (top 20)',
    cotisations: 'Cotisation ci statut',
    topMutuelles: 'Top 10 mutuelle',
    beneficiaries: 'Assuré',
    active: 'Baax',
    mutuelles: 'Mutuelle',
    claims: 'Demande PC',
    reimbursed: 'Ñu fay (FCFA)',
    refresh: 'Tambali',
    loading: 'Tambali…',
    noData: 'Amul data.'
  };

  const fetchStats = () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/dashboard/regional-comparison', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError('Erreur'); setLoading(false); });
  };

  useEffect(() => { fetchStats(); }, []);

  const COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316'];

  if (loading) return <div className="card text-center" style={{ padding: '3rem' }}>📊 {t.loading}</div>;
  if (error) return (
    <div className="card text-center" style={{ padding: '3rem' }}>
      <p style={{ color: 'var(--danger)' }}>❌ {error}</p>
      <button className="btn btn-primary" onClick={fetchStats} style={{ marginTop: '1rem' }}>{t.refresh}</button>
    </div>
  );
  if (!data) return null;

  const fmt = (n) => new Intl.NumberFormat('fr-FR').format(n || 0);

  return (
    <div className="regional-stats fade-in-up" style={{ padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>🗺️ {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchStats}>🔄 {t.refresh}</button>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Bénéficiaires par région */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📍 {t.byRegion}</h3>
          {data.byRegion && data.byRegion.filter((r) => r.region).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byRegion.filter((r) => r.region).map((r) => ({ région: r.region, bénéficiaires: parseInt(r.beneficiaries), actifs: parseInt(r.active) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="région" fontSize="0.7rem" angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize="0.7rem" allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Bar dataKey="bénéficiaires" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actifs" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Demandes PC par région */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>💊 {t.claimsByRegion}</h3>
          {data.claimsByRegion && data.claimsByRegion.filter((r) => r.region).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.claimsByRegion.filter((r) => r.region).map((r) => ({ région: r.region, demandes: parseInt(r.claims), remboursé: parseInt(r.reimbursed) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" fontSize="0.7rem" allowDecimals={false} />
                <YAxis type="category" dataKey="région" fontSize="0.7rem" width={100} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Bar dataKey="demandes" fill="#ec4899" radius={[0, 4, 4, 0]} />
                <Bar dataKey="remboursé" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Top 10 mutuelles */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏆 {t.topMutuelles}</h3>
          {data.topMutuelles && data.topMutuelles.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topMutuelles.map((m) => ({ name: m.name?.replace('Mutuelle de ', '') || '—', adhérents: parseInt(m.beneficiaries) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" fontSize="0.7rem" allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize="0.7rem" width={120} />
                <Tooltip />
                <Bar dataKey="adhérents" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

        {/* Cotisations par statut */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>💰 {t.cotisations}</h3>
          {data.cotisationsByStatus && data.cotisationsByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.cotisationsByStatus.map((c) => ({ name: c.status, value: parseInt(c.count), total: parseInt(c.total) }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {data.cotisationsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>
      </div>

      {/* Taux de pénétration par commune */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏘️ {t.penetration}</h3>
        {data.penetrationByCommune && data.penetrationByCommune.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {data.penetrationByCommune.map((c, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{c.commune}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: '800', color: COLORS[i % COLORS.length] }}>{fmt(c.beneficiaries)}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.mutuelles} mutuelle(s)</div>
              </div>
            ))}
          </div>
        ) : <Empty />}
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Aucune donnée</div>;
}
