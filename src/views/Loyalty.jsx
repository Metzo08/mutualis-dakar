import React, { useState, useEffect } from 'react';

// Module fidélité : points, niveaux, badges et classement.
export default function Loyalty({ lang, citizenUser, agentUser, portalMode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const isAgent = portalMode === 'agent' && agentUser;
  const beneficiaryId = citizenUser?.id || agentUser?.id;

  const t = lang === 'fr' ? {
    title: 'Programme fidélité',
    subtitle: 'Vos points, vos badges et vos récompenses',
    points: 'Points',
    level: 'Niveau',
    history: 'Historique des points',
    badges: 'Badges',
    unlocked: 'Débloqués',
    locked: 'À débloquer',
    nextBadge: 'Prochain badge',
    leaderboard: 'Classement',
    reason: 'Raison',
    date: 'Date',
    noData: 'Aucun point pour le moment.',
    loading: 'Chargement…',
    reasons: {
      cotisation_a_temps: 'Cotisation payée à temps',
      parrainage: 'Parrainage solidaire',
      sans_reclamation: 'Aucune réclamation (1 an)',
      annee_fidelite: 'Année de fidélité'
    },
    levels: { Or: 'Or 🥇', Argent: 'Argent 🥈', Bronze: 'Bronze 🥉', Nouveau: 'Nouveau 🌱' }
  } : {
    title: 'Programme fidélité',
    subtitle: 'Sa point, sa badge ak sa récompense',
    points: 'Point',
    level: 'Niveau',
    history: 'Historique point',
    badges: 'Badge',
    unlocked: 'Ñu ubbi',
    locked: 'Buggë ubbi',
    nextBadge: 'Badge bu gënë topp',
    leaderboard: 'Classement',
    reason: 'Ngir',
    date: 'Date',
    noData: 'Amul point.',
    loading: 'Tambali…',
    reasons: {
      cotisation_a_temps: 'Cotision ci diiru',
      parrainage: 'Parrainage solidaire',
      sans_reclamation: 'Amul réclamation (1 at)',
      annee_fidelite: 'Atu fidélité'
    },
    levels: { Or: 'Or 🥇', Argent: 'Argent 🥈', Bronze: 'Bronze 🥉', Nouveau: 'Bees 🌱' }
  };

  const fetchData = () => {
    if (!beneficiaryId) { setLoading(false); return; }
    setLoading(true);
    const token = localStorage.getItem('cmu-token') || '';
    fetch(`http://localhost:5000/api/loyalty/${beneficiaryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    if (isAgent) {
      fetch('http://localhost:5000/api/loyalty/leaderboard', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then(setLeaderboard)
        .catch(() => {});
    }
  };

  useEffect(() => { fetchData(); }, [beneficiaryId]);

  if (loading) {
    return <div className="card text-center" style={{ padding: '3rem' }}>⭐ {t.loading}</div>;
  }

  if (!data) {
    return <div className="card text-center" style={{ padding: '3rem' }}>{t.noData}</div>;
  }

  return (
    <div className="loyalty-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_loyalty_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>⭐ {t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
        {isAgent && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowLeaderboard(!showLeaderboard)}>
              🏆 {t.leaderboard}
            </button>
          </div>
        )}

      {/* Carte solde de points + niveau */}
      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#fff', textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>{t.points}</div>
        <div style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '0.5rem' }}>{data.totalPoints}</div>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', padding: '0.4rem 1.5rem', borderRadius: '20px', fontWeight: '700' }}>
          {t.levels[data.level] || data.level}
        </div>
      </div>

      {/* Prochain badge */}
      {data.nextBadge && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.5 }}>{data.nextBadge.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>{data.nextBadge.name}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{data.nextBadge.description}</div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                <div style={{ background: '#f59e0b', height: '100%', width: `${data.nextBadge.progress}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                {data.totalPoints} / {data.nextBadge.threshold} points ({data.nextBadge.progress}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏅 {t.badges}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
          {data.badges.map((b, i) => (
            <div key={i} style={{
              padding: '1rem', borderRadius: '12px', textAlign: 'center',
              background: b.unlocked ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))' : 'var(--bg-secondary)',
              border: b.unlocked ? '2px solid #22c55e' : '2px dashed var(--border-color)',
              opacity: b.unlocked ? 1 : 0.6
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', filter: b.unlocked ? 'none' : 'grayscale(100%)' }}>{b.icon}</div>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{b.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.description}</div>
              {!b.unlocked && <div style={{ fontSize: '0.65rem', color: '#f59e0b', marginTop: '0.25rem' }}>{b.progress}%</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Historique */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📜 {t.history}</h3>
        {data.history && data.history.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{t.reasons[h.reason] || h.reason}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(h.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
                <div style={{ fontWeight: '800', color: '#22c55e' }}>+{h.points}</div>
              </div>
            ))}
          </div>
        ) : <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>}
      </div>

      {/* Classement (agent) */}
      {isAgent && showLeaderboard && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏆 {t.leaderboard}</h3>
          {leaderboard.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaderboard.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontWeight: '900', fontSize: '1.2rem', color: i < 3 ? ['#f59e0b', '#94a3b8', '#cd7f32'][i] : 'var(--text-muted)', minWidth: '2rem' }}>#{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.first_name} {p.last_name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.mutuelle_name}</div>
                  </div>
                  <div style={{ fontWeight: '800', color: 'var(--primary)' }}>{p.total} pts</div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: 'var(--text-muted)' }}>{t.noData}</p>}
        </div>
      )}
      </div>
    </div>
  );
}
