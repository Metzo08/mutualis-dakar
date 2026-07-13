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
    <div className="regional-stats fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_stats_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>🗺️ {t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchStats}>🔄 {t.refresh}</button>
        </div>

      <div className="grid grid-2" style={{ gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Bénéficiaires par région */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📍 {t.byRegion}</h3>
          {data.byRegion && data.byRegion.filter((r) => r.region).length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byRegion.filter((r) => r.region).map((r) => ({ région: r.region, bénéficiaires: parseInt(r.beneficiaries), actifs: parseInt(r.active) }))}>
                <defs>
                  <linearGradient id="gradBeneficiaries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="région" fontSize="0.7rem" angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize="0.7rem" allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Bar dataKey="bénéficiaires" fill="url(#gradBeneficiaries)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actifs" fill="url(#gradActive)" radius={[4, 4, 0, 0]} />
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
                <defs>
                  <linearGradient id="gradDemandes" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0.2}/>
                  </linearGradient>
                  <linearGradient id="gradRembourse" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" fontSize="0.7rem" allowDecimals={false} />
                <YAxis type="category" dataKey="région" fontSize="0.7rem" width={100} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                <Bar dataKey="demandes" fill="url(#gradDemandes)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="remboursé" fill="url(#gradRembourse)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </div>

         <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏆 {t.topMutuelles}</h3>
          {data.topMutuelles && data.topMutuelles.length > 0 ? (
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={data.topMutuelles.map((m) => {
                 let n = m.name || '';
                  n = n.replace('Mutuelle de ', '');
                  n = n.replace('Union Départementale de ', 'UD ');
                  n = n.replace('Union Departementale de ', 'UD ');
                  n = n.replace('UDMS de ', 'UD ');
                  n = n.replace('MSD mutuelle de santé départementale de ', 'MSD ');
                  n = n.replace('MSD de ', 'MSD ');
                  n = n.replace(/\(UDMS.*\)/, '');
                  n = n.replace(/\(MSD.*\)/, '');
                  return { name: n.trim() || '—', adhérents: parseInt(m.beneficiaries) };
              })} layout="vertical">
                <defs>
                  <linearGradient id="gradAdherents" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85}/>
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis type="number" fontSize="0.7rem" allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize="0.7rem" width={150} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="adhérents" fill="url(#gradAdherents)" radius={[0, 4, 4, 0]} />
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
                <Tooltip {...tooltipStyle} />
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
    </div>
  );
}

function Empty() {
  return <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Aucune donnée</div>;
}
