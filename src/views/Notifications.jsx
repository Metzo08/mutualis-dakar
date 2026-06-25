import React, { useState, useEffect } from 'react';

// Centre de notifications SMS/WhatsApp.
// - Agent : voit l'historique + peut envoyer manuellement
// - Citoyen : voit l'historique de ses notifications reçues
export default function Notifications({ lang, portalMode, agentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({ recipient: '', channel: 'sms', type: 'rappel', title: '', body: '' });
  const [sendLoading, setSendLoading] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  const isAgent = portalMode === 'agent' && agentUser;

  const t = lang === 'fr' ? {
    title: 'Notifications SMS / WhatsApp',
    subtitle: 'Communication avec les assurés',
    newNotif: 'Nouvelle notification',
    channel: 'Canal',
    recipient: 'Destinataire',
    type: 'Type',
    message: 'Message',
    title2: 'Titre',
    status: 'Statut',
    date: 'Date',
    send: 'Envoyer',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    email: 'Email',
    pending: 'En attente',
    sent: 'Envoyé',
    failed: 'Échec',
    adhesion: 'Adhésion',
    cotisation: 'Cotisation',
    reclamation: 'Réclamation',
    prise_en_charge: 'Prise en charge',
    rappel: 'Rappel',
    noNotif: 'Aucune notification.',
    sent2: '✅ Notification envoyée.'
  } : {
    title: 'Notifications SMS / WhatsApp',
    subtitle: 'Jokkoo ak assuré yi',
    newNotif: 'Notification bu bees',
    channel: 'Canal',
    recipient: 'Ki ñu yónnee',
    type: 'Anam',
    message: 'Mbind',
    title2: 'Titre',
    status: 'Statut',
    date: 'Date',
    send: 'Yónnee',
    sms: 'SMS',
    whatsapp: 'WhatsApp',
    email: 'Email',
    pending: 'Ci nëbb',
    sent: 'Yónnee na',
    failed: 'Baaxul',
    adhesion: 'Adhésion',
    cotisation: 'Cotisation',
    reclamation: 'Réclamation',
    prise_en_charge: 'Prise en charge',
    rappel: 'Rappel',
    noNotif: 'Amul notification.',
    sent2: '✅ Yónnee na.'
  };

  const fetchNotifications = (p = 1) => {
    setLoading(true);
    const token = localStorage.getItem('cmu-token') || '';
    fetch(`http://localhost:5000/api/notifications?page=${p}&limit=20`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((payload) => {
        setNotifications(Array.isArray(payload) ? payload : payload.data || []);
        if (payload.pagination) { setPagination(payload.pagination); setPage(payload.pagination.page); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(1); }, []);

  const handleSend = (e) => {
    e.preventDefault();
    setSendLoading(true);
    setSendMsg('');
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    })
      .then((res) => res.json())
      .then((data) => {
        setSendLoading(false);
        if (data.success) {
          setSendMsg(t.sent2);
          setShowForm(false);
          fetchNotifications(1);
          setForm({ recipient: '', channel: 'sms', type: 'rappel', title: '', body: '' });
        } else {
          setSendMsg(`❌ ${data.error || 'Erreur'}`);
        }
      })
      .catch(() => { setSendLoading(false); setSendMsg('❌ Erreur de connexion.'); });
  };

  const statusBadge = (status) => {
    const map = { pending: '⏳', sent: '✅', failed: '❌' };
    const colors = { pending: '#f59e0b', sent: '#22c55e', failed: '#ef4444' };
    return <span style={{ background: colors[status] || '#999', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem' }}>{map[status]} {t[status] || status}</span>;
  };

  const channelIcon = { sms: '📱', whatsapp: '💬', email: '📧' };

  return (
    <div className="notifications-view fade-in-up" style={{ padding: '1.5rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800' }}>🔔 {t.title}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{t.subtitle}</p>
        </div>
        {isAgent && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ {t.newNotif}</button>}
      </div>

      {sendMsg && <div className="alert" style={{ padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', background: 'var(--bg-secondary)' }}>{sendMsg}</div>}

      {showForm && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <form onSubmit={handleSend}>
            <div className="grid grid-3" style={{ gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.recipient}</label>
                <input className="input" required placeholder="77 123 45 67" value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.channel}</label>
                <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  <option value="sms">{t.sms}</option>
                  <option value="whatsapp">{t.whatsapp}</option>
                  <option value="email">{t.email}</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.type}</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="adhésion">{t.adhesion}</option>
                  <option value="cotisation">{t.cotisation}</option>
                  <option value="réclamation">{t.reclamation}</option>
                  <option value="prise_en_charge">{t.prise_en_charge}</option>
                  <option value="rappel">{t.rappel}</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.title2}</label>
              <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.message}</label>
              <textarea className="input" required rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={sendLoading} style={{ marginTop: '1rem' }}>
              {sendLoading ? '...' : `📨 ${t.send}`}
            </button>
          </form>
        </div>
      )}

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t.noNotif}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>{t.channel}</th>
                  <th style={{ padding: '0.75rem' }}>{t.recipient}</th>
                  <th style={{ padding: '0.75rem' }}>{t.type}</th>
                  <th style={{ padding: '0.75rem' }}>{t.message}</th>
                  <th style={{ padding: '0.75rem' }}>{t.status}</th>
                  <th style={{ padding: '0.75rem' }}>{t.date}</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontSize: '1.2rem' }}>{channelIcon[n.channel] || '📨'}</td>
                    <td style={{ padding: '0.75rem' }}>{n.recipient}</td>
                    <td style={{ padding: '0.75rem' }}><span style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '8px', fontSize: '0.7rem' }}>{n.type}</span></td>
                    <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title ? `${n.title}: ` : ''}{n.body}</td>
                    <td style={{ padding: '0.75rem' }}>{statusBadge(n.status)}</td>
                    <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.created_at ? new Date(n.created_at).toLocaleString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', padding: '1rem' }}>
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => fetchNotifications(page - 1)}>‹</button>
            <span style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>{page} / {pagination.totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={!pagination.hasNext} onClick={() => fetchNotifications(page + 1)}>›</button>
          </div>
        )}
      </div>
    </div>
  );
}
