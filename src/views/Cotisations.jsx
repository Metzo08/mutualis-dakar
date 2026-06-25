import React, { useState, useEffect } from 'react';

// Suivi des cotisations annuelles + rappels automatiques.
// - Citoyen : voit son historique de cotisations + statut (payé/expiré)
// - Agent : voit toutes les cotisations + peut générer les rappels automatiques
export default function Cotisations({ lang, portalMode, citizenUser, agentUser }) {
  const [cotisations, setCotisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [reminderResult, setReminderResult] = useState(null);
  const [reminderLoading, setReminderLoading] = useState(false);

  const isAgent = portalMode === 'agent' && agentUser;

  const t = lang === 'fr' ? {
    title: 'Suivi des cotisations',
    subtitle: 'Historique des cotisations annuelles et rappels automatiques',
    status: 'Statut',
    all: 'Tous',
    paid: 'Payée',
    pending: 'En attente',
    expired: 'Expirée',
    cmuNumber: 'N° CMU',
    phone: 'Téléphone',
    amount: 'Montant (FCFA)',
    method: 'Moyen',
    period: 'Période',
    date: 'Date',
    sendReminders: 'Générer les rappels',
    reminderTitle: 'Rappels automatiques',
    reminderDesc: 'Détecte les cotisations expirant dans ≤ 30 jours ou expirées et génère des notifications SMS.',
    noData: 'Aucune cotisation trouvée.',
    prev: 'Précédent',
    next: 'Suivant',
    active: 'Active',
    expiringSoon: 'Expire bientôt',
    daysLeft: 'jours restants'
  } : {
    title: 'Tëggali cotisation',
    subtitle: 'Registre cotisation ak rappel automatique',
    status: 'Statut',
    all: 'Yëpp',
    paid: 'Fay na',
    pending: 'Ci nëbb',
    expired: 'Tëdd na',
    cmuNumber: 'N° CMU',
    phone: 'Portable',
    amount: 'Xalis (FCFA)',
    method: 'Moyen',
    period: 'Période',
    date: 'Date',
    sendReminders: 'Tambali rappel',
    reminderTitle: 'Rappel automatique',
    reminderDesc: 'Say cotisation yi ñuy tëdd ak yi nëbb, tambali notification SMS.',
    noData: 'Amul cotisation.',
    prev: 'Bu njëk',
    next: 'Bu gënë topp',
    active: 'Baax na',
    expiringSoon: 'Mën na tëdd',
    daysLeft: 'fan ci yërmaale'
  };

  const fetchCotisations = (p = 1) => {
    setLoading(true);
    const token = localStorage.getItem('cmu-token') || '';
    let url = `http://localhost:5000/api/cotisations?page=${p}&limit=20`;
    if (filterStatus) url += `&status=${filterStatus}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((payload) => {
        setCotisations(Array.isArray(payload) ? payload : payload.data || []);
        if (payload.pagination) { setPagination(payload.pagination); setPage(payload.pagination.page); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchCotisations(1); }, [filterStatus]);

  const sendReminders = () => {
    setReminderLoading(true);
    setReminderResult(null);
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/cotisations/send-reminders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        setReminderLoading(false);
        setReminderResult(data);
        if (data.success) fetchCotisations(page);
      })
      .catch(() => { setReminderLoading(false); setReminderResult({ error: 'Erreur de connexion' }); });
  };

  const statusBadge = (c) => {
    const now = new Date();
    const end = new Date(c.period_end);
    const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    let label, color, icon;
    if (c.status === 'expired' || end < now) {
      label = t.expired; color = '#ef4444'; icon = '❌';
    } else if (daysLeft <= 30) {
      label = `${t.expiringSoon} (${daysLeft} ${t.daysLeft})`; color = '#f59e0b'; icon = '⚠️';
    } else {
      label = t.active; color = '#22c55e'; icon = '✅';
    }
    return <span style={{ background: color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap' }}>{icon} {label}</span>;
  };

  return (
    <div className="cotisations-view fade-in-up" style={{ padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>💰 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="">{t.all}</option>
          <option value="paid">{t.paid}</option>
          <option value="pending">{t.pending}</option>
          <option value="expired">{t.expired}</option>
        </select>
      </div>

      {/* Bloc rappels automatiques (agent) */}
      {isAgent && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>🔔 {t.reminderTitle}</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{t.reminderDesc}</p>
          <button className="btn btn-primary btn-sm" onClick={sendReminders} disabled={reminderLoading}>
            {reminderLoading ? '...' : `📨 ${t.sendReminders}`}
          </button>
          {reminderResult && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: reminderResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }}>
              {reminderResult.error ? (
                <span style={{ color: '#ef4444' }}>❌ {reminderResult.error}</span>
              ) : (
                <span style={{ color: '#22c55e' }}>
                  ✅ {reminderResult.message}<br />
                  <small>{reminderResult.expiringSoon} expirant bientôt · {reminderResult.expired} expirées</small>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>...</div>
        ) : cotisations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t.noData}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>#</th>
                  <th style={{ padding: '0.75rem' }}>{t.cmuNumber}</th>
                  <th style={{ padding: '0.75rem' }}>{t.phone}</th>
                  <th style={{ padding: '0.75rem' }}>{t.amount}</th>
                  <th style={{ padding: '0.75rem' }}>{t.method}</th>
                  <th style={{ padding: '0.75rem' }}>{t.period}</th>
                  <th style={{ padding: '0.75rem' }}>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {cotisations.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: '700' }}>#{c.id}</td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.cmu_number || '—'}</td>
                    <td style={{ padding: '0.75rem' }}>{c.phone}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>{new Intl.NumberFormat('fr-FR').format(c.amount)}</td>
                    <td style={{ padding: '0.75rem', textTransform: 'uppercase' }}>{c.payment_method}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem' }}>
                      {new Date(c.period_start).toLocaleDateString('fr-FR')} → {new Date(c.period_end).toLocaleDateString('fr-FR')}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{statusBadge(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => fetchCotisations(page - 1)}>‹ {t.prev}</button>
            <span style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>{page} / {pagination.totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={!pagination.hasNext} onClick={() => fetchCotisations(page + 1)}>{t.next} ›</button>
          </div>
        )}
      </div>
    </div>
  );
}
