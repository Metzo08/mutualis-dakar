import React, { useState, useEffect } from 'react';

const formatBadgeName = (name) => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

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
    levels: { Or: 'Or 🥇', Argent: 'Argent 🥈', Bronze: 'Bronze 🥉', Nouveau: 'Nouveau 🌱', or: 'Or 🥇', argent: 'Argent 🥈', bronze: 'Bronze 🥉', nouveau: 'Nouveau 🌱' }
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
    levels: { Or: 'Or 🥇', Argent: 'Argent 🥈', Bronze: 'Bronze 🥉', Nouveau: 'Bees 🌱', or: 'Or 🥇', argent: 'Argent 🥈', bronze: 'Bronze 🥉', nouveau: 'Bees 🌱' }
  };

  const defaultLoyaltyData = {
    totalPoints: 450,
    points: 450,
    level: 'Argent 🥈',
    nextBadge: {
      id: 4,
      name: 'Champion Régional Or',
      icon: '👑',
      description: 'Cumuler 1000 points de fidélité pour débloquer le niveau Or',
      threshold: 1000,
      progress: 45
    },
    unlockedCount: 3,
    totalBadges: 4,
    badges: [
      { id: 1, name: 'Assuré Fidèle 2026', icon: '🏆', unlocked: true, description: 'Cotisation 2026 intégralement à jour' },
      { id: 2, name: 'Prévention Santé', icon: '🩺', unlocked: true, description: 'Bilan de santé annuel effectué' },
      { id: 3, name: 'Parrain Solidaire', icon: '🤝', unlocked: true, description: '1 famille parrainée dans le département' },
      { id: 4, name: 'Champion Régional Or', icon: '👑', unlocked: false, description: 'Cumuler 1000 points de fidélité' }
    ],
    history: [
      { id: 1, reason: 'cotisation_a_temps', points: 150, created_at: '2026-01-04T10:15:00Z' },
      { id: 2, reason: 'parrainage', points: 200, created_at: '2026-01-15T12:00:00Z' },
      { id: 3, reason: 'sans_reclamation', points: 100, created_at: '2026-02-01T09:30:00Z' }
    ]
  };

  const fetchData = () => {
    setLoading(true);
    const token = localStorage.getItem('cmu-token') || '';
    if (!beneficiaryId) {
      setData(defaultLoyaltyData);
      setLoading(false);
      return;
    }

    fetch(`http://localhost:5000/api/loyalty/${beneficiaryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then((d) => {
        if (d && !d.error && (d.points !== undefined || d.totalPoints !== undefined || (d.history && d.history.length > 0))) {
          d.totalPoints = d.totalPoints ?? d.points ?? 450;
          d.badges = d.badges || defaultLoyaltyData.badges;
          d.history = d.history || defaultLoyaltyData.history;
          if (typeof d.nextBadge === 'string') {
            d.nextBadge = {
              name: d.nextBadge,
              icon: '👑',
              description: 'Cumuler 1000 points de fidélité',
              threshold: 1000,
              progress: Math.min(100, Math.round((d.totalPoints / 1000) * 100))
            };
          }
          setData(d);
        } else {
          setData(defaultLoyaltyData);
        }
        setLoading(false);
      })
      .catch(() => {
        setData(defaultLoyaltyData);
        setLoading(false);
      });

    if (isAgent) {
      fetch('http://localhost:5000/api/loyalty/leaderboard', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error('API Error');
          return res.json();
        })
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

  const currentPoints = data.totalPoints ?? data.points ?? 450;
  const currentLevel = data.level || 'Argent 🥈';
  const nextBadgeObj = typeof data.nextBadge === 'object' && data.nextBadge !== null ? data.nextBadge : {
    name: typeof data.nextBadge === 'string' ? data.nextBadge : 'Champion Régional Or',
    icon: '👑',
    description: 'Cumuler 1000 points de fidélité',
    threshold: 1000,
    progress: Math.min(100, Math.round((currentPoints / 1000) * 100))
  };
  const progressPercent = nextBadgeObj.progress ?? Math.min(100, Math.round((currentPoints / (nextBadgeObj.threshold || 1000)) * 100));

  return (
    <div className="loyalty-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_loyalty_hero.png") center/cover no-repeat',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3.75rem 2.5rem',
        marginBottom: '3.5rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
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
      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.82) 0%, rgba(4, 120, 87, 0.88) 100%), url("/bg_health_heart.png") center/cover no-repeat', color: '#fff', textAlign: 'center', borderRadius: '16px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.2)' }}>
        <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>{t.points}</div>
        <div style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '0.5rem' }}>{currentPoints}</div>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', padding: '0.4rem 1.5rem', borderRadius: '20px', fontWeight: '700' }}>
          {t.levels[currentLevel] || currentLevel}
        </div>
      </div>

      {/* Prochain badge */}
      {nextBadgeObj && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '2.5rem', opacity: 0.8 }}>{nextBadgeObj.icon || '👑'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '700', fontSize: '1rem' }}>{formatBadgeName(nextBadgeObj.name)}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{nextBadgeObj.description || 'Cumuler des points de fidélité'}</div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                <div style={{ background: '#f59e0b', height: '100%', width: `${progressPercent}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.4rem' }}>
                {currentPoints} / {nextBadgeObj.threshold || 1000} points ({progressPercent}%)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>🏅 {t.badges}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
          {(data.badges || []).map((b, i) => (
            <div key={i} style={{
              padding: '1rem', borderRadius: '12px', textAlign: 'center',
              background: b.unlocked ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))' : 'var(--bg-secondary)',
              border: b.unlocked ? '2px solid #22c55e' : '2px dashed var(--border-color)',
              opacity: b.unlocked ? 1 : 0.6
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', filter: b.unlocked ? 'none' : 'grayscale(100%)' }}>{b.icon}</div>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{formatBadgeName(b.name)}</div>
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
