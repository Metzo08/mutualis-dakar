import React, { useState, useEffect } from 'react';

// Interface de paiement Orange Money / Wave avec suivi du statut en temps réel.
export default function Payments({ lang, citizenUser }) {
  const [form, setForm] = useState({
    phone: citizenUser?.phone || '',
    provider: 'wave',
    amount: '4500',
    purpose: 'cotisation'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [payments, setPayments] = useState([]);
  const [pollRef, setPollRef] = useState(null);

  const t = lang === 'fr' ? {
    title: 'Paiement en ligne',
    subtitle: 'Réglez votre cotisation ou faites un don via Orange Money ou Wave',
    phone: 'Numéro de téléphone',
    provider: 'Opérateur',
    amount: 'Montant (FCFA)',
    purpose: 'Objet',
    pay: 'Payer',
    purposes: { cotisation: 'Cotisation annuelle', donation: 'Don', adhesion: 'Adhésion' },
    providers: { orange_money: 'Orange Money', wave: 'Wave' },
    initiated: 'Paiement initié — confirmez sur votre téléphone',
    success: 'Paiement réussi !',
    failed: 'Paiement échoué',
    pending: 'En cours…',
    history: 'Historique des paiements',
    noHistory: 'Aucun paiement effectué.',
    waiting: 'En attente de confirmation USSD…',
    ref: 'Référence'
  } : {
    title: 'Fay ci internet',
    subtitle: 'Fay sa cotision walla def don ci Orange Money walla Wave',
    phone: 'Portable',
    provider: 'Opérateur',
    amount: 'Xalis (FCFA)',
    purpose: 'Ngir',
    pay: 'Fay',
    purposes: { cotisation: 'Cotision annuel', donation: 'Don', adhesion: 'Adhésion' },
    providers: { orange_money: 'Orange Money', wave: 'Wave' },
    initiated: 'Fay bi tambali na — confirmsal ci sa portable',
    success: 'Fay bi baax na !',
    failed: 'Fay bi baaxul',
    pending: 'Ci ñëb…',
    history: 'Historique fay',
    noHistory: 'Amul fay.',
    waiting: 'Ci nëbb confirmation USSD…',
    ref: 'Référence'
  };

  const fetchPayments = () => {
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/payments?limit=10', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((payload) => setPayments(Array.isArray(payload) ? payload : payload.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchPayments();

    // Analyse de l'URL hash pour détecter le retour d'une passerelle de paiement
    const hash = window.location.hash;
    const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);
    const statusParam = params.get('status');
    const refParam = params.get('ref');

    if (refParam) {
      setLoading(true);
      fetch(`http://localhost:5000/api/payments/${refParam}`)
        .then((r) => r.json())
        .then((p) => {
          setLoading(false);
          setResult(p);

          // Si le paiement est initié ou en cours, on active le polling toutes les 3s
          // car le webhook de notification de l'opérateur peut prendre quelques secondes.
          if (p.status === 'initiated' || p.status === 'pending') {
            const interval = setInterval(() => {
              fetch(`http://localhost:5000/api/payments/${refParam}`)
                .then((res) => res.json())
                .then((updated) => {
                  setResult((prev) => ({ ...prev, status: updated.status }));
                  if (updated.status === 'success' || updated.status === 'failed' || updated.status === 'cancelled') {
                    clearInterval(interval);
                    setPollRef(null);
                    fetchPayments();
                  }
                })
                .catch(() => {});
            }, 3000);
            setPollRef(interval);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, []);

  useEffect(() => () => { if (pollRef) clearInterval(pollRef); }, [pollRef]);

  const handlePay = (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    fetch('http://localhost:5000/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiaryId: citizenUser?.id || null,
        phone: form.phone,
        provider: form.provider,
        amount: form.amount,
        purpose: form.purpose
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        setResult(data);
        if (data.success && data.reference) {
          // Si le paiement réel est disponible, rediriger l'utilisateur vers la passerelle de paiement
          if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
            return;
          }

          // Sinon, on bascule en mode simulation locale pour la démonstration
          const ref = data.reference;
          const interval = setInterval(() => {
            fetch(`http://localhost:5000/api/payments/${ref}`)
              .then((r) => r.json())
              .then((p) => {
                setResult((prev) => ({ ...prev, status: p.status }));
                if (p.status === 'success' || p.status === 'failed') {
                  clearInterval(interval);
                  setPollRef(null);
                  fetchPayments();
                }
              })
              .catch(() => {});
          }, 3000);
          setPollRef(interval);

          // Simulation démo : si pas de webhook réel reçu, simuler un succès après 6s
          setTimeout(() => {
            fetch(`http://localhost:5000/api/payments/${ref}`)
              .then((r) => r.json())
              .then((p) => {
                if (p.status === 'initiated' || p.status === 'pending') {
                  // Appel au webhook de simulation (en production, c'est l'opérateur qui l'appelle)
                  fetch(`http://localhost:5000/api/payments/webhook/${form.provider}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: ref, status: 'success', provider_transaction_id: 'SIM-' + Date.now() })
                  }).then(() => {
                    setResult((prev) => ({ ...prev, status: 'success' }));
                    if (pollRef) { clearInterval(pollRef); setPollRef(null); }
                    fetchPayments();
                  }).catch(() => {});
                }
              });
          }, 6000);
        }
      })
      .catch(() => { setLoading(false); setResult({ error: 'Erreur de connexion' }); });
  };

  const statusInfo = (status) => {
    const map = {
      initiated: { label: t.pending, color: '#f59e0b', icon: '⏳' },
      pending: { label: t.pending, color: '#f59e0b', icon: '⏳' },
      success: { label: t.success, color: '#22c55e', icon: '✅' },
      failed: { label: t.failed, color: '#ef4444', icon: '❌' }
    };
    return map[status] || { label: status, color: '#999', icon: '•' };
  };

  return (
    <div className="payments-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/csu_payments_hero.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>💳 {t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 1rem' }}>
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <form onSubmit={handlePay}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.provider}</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {['wave', 'orange_money'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, provider: p })}
                  style={{
                    flex: 1, padding: '0.75rem', borderRadius: '10px', border: form.provider === p ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                    background: form.provider === p ? 'rgba(5,150,105,0.1)' : 'transparent', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                  }}
                >
                  {p === 'wave' ? '🌊' : '🟠'} {t.providers[p]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.phone}</label>
              <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="77 123 45 67" />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.amount}</label>
              <input className="input" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.purpose}</label>
            <select className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              <option value="cotisation">{t.purposes.cotisation}</option>
              <option value="donation">{t.purposes.donation}</option>
              <option value="adhesion">{t.purposes.adhesion}</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? '...' : `💳 ${t.pay} ${new Intl.NumberFormat('fr-FR').format(form.amount)} FCFA`}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '10px', background: result.error ? 'rgba(239,68,68,0.1)' : 'var(--bg-secondary)' }}>
            {result.error ? (
              <span style={{ color: '#ef4444' }}>❌ {result.error}</span>
            ) : (
              <>
                <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>
                  {statusInfo(result.status).icon} {statusInfo(result.status).label}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {t.ref}: <code>{result.reference}</code>
                </div>
                {result.status === 'initiated' && (
                  <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#f59e0b' }}>
                    📱 {t.waiting}
                  </div>
                )}
                {result.status === 'success' && (
                  <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#22c55e' }}>
                    ✅ {t.success} ({new Intl.NumberFormat('fr-FR').format(result.amount)} FCFA)
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Historique */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem' }}>📜 {t.history}</h3>
        {payments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>{t.noHistory}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {payments.map((p) => {
              const si = statusInfo(p.status);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                      {p.provider === 'wave' ? '🌊' : '🟠'} {new Intl.NumberFormat('fr-FR').format(p.amount)} FCFA
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t.purposes[p.purpose] || p.purpose} · {p.initiated_at ? new Date(p.initiated_at).toLocaleDateString('fr-FR') : ''}
                    </div>
                  </div>
                  <span style={{ background: si.color, color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: '700' }}>
                    {si.icon} {si.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
