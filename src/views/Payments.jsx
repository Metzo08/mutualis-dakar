import React, { useState, useEffect } from 'react';
import { getAdherentCode } from '../utils/csuFormatter';

// Interface de paiement Orange Money / Wave avec suivi du statut en temps réel.
export default function Payments({ lang, citizenUser, setView = null }) {
  const [form, setForm] = useState({
    phone: citizenUser?.phone || '',
    provider: 'wave',
    amount: '3500',
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
    purposes: { cotisation: 'Cotisation annuelle', donation: 'Don', adhesion: 'Adhésion', renouvellement: 'Renouvellement cotisation famille' },
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
    purposes: { cotisation: 'Cotision annuel', donation: 'Don', adhesion: 'Adhésion', renouvellement: 'Yeesal cotision wër' },
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

  const [pendingRenewal, setPendingRenewal] = useState(null);

  // Données famille pour le récapitulatif de renouvellement
  const familyMembers = [
    { name: citizenUser?.firstName || 'Awa', lastName: citizenUser?.lastName || 'Ndiaye', relation: 'Titulaire', suffix: '.1' },
    { name: 'Amadou', lastName: 'Sow', relation: 'Conjoint / Ayant droit', suffix: '.2' },
    { name: 'Fatou', lastName: 'Sow', relation: 'Enfant 1', suffix: '.3' }
  ];
  const COTISATION_PAR_PERSONNE = 3500;
  const adherentCode = getAdherentCode(citizenUser?.cmuNumber || citizenUser?.cmu_number || 'CMU-DKR-2026-8812');

  useEffect(() => {
    fetchPayments();

    try {
      const stored = localStorage.getItem('cmu-pending-renewal');
      if (stored) {
        const parsed = JSON.parse(stored);
        setPendingRenewal(parsed);
        setForm(prev => ({
          ...prev,
          amount: String(parsed.amount || 10500),
          purpose: 'renouvellement'
        }));
      }
    } catch (e) {}

    // Analyse de l'URL hash pour détecter le retour d'une passerelle de paiement
    const hash = window.location.hash;
    const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryPart);
    const refParam = params.get('ref');

    if (refParam) {
      setLoading(true);
      fetch(`http://localhost:5000/api/payments/${refParam}`)
        .then((r) => r.json())
        .then((p) => {
          setLoading(false);
          setResult(p);

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
        purpose: form.purpose,
        csuCode: adherentCode
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setLoading(false);
        setResult(data);
        if (data.success && data.reference) {
          if (data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
            return;
          }

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

          // Simulation démo
          setTimeout(() => {
            fetch(`http://localhost:5000/api/payments/${ref}`)
              .then((r) => r.json())
              .then((p) => {
                if (p.status === 'initiated' || p.status === 'pending') {
                  fetch(`http://localhost:5000/api/payments/webhook/${form.provider}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: ref, status: 'success', provider_transaction_id: 'SIM-' + Date.now() })
                  }).then(() => {
                    setResult((prev) => ({ ...prev, status: 'success' }));
                    // Réactiver le compte
                    localStorage.setItem('cmu-portal-mode', 'citizen');
                    localStorage.removeItem('cmu-pending-renewal');
                    localStorage.removeItem('cmu-cotisation-suspended');
                    if (pollRef) { clearInterval(pollRef); setPollRef(null); }
                    fetchPayments();
                  }).catch(() => {});
                }
              });
          }, 6000);
        }
      })
      .catch(() => { setLoading(false); setResult({ error: 'Erreur de connexion au serveur de paiement. Veuillez réessayer.' }); });
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
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_payments_hero.png") center/cover no-repeat',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3.75rem 2.5rem',
        minHeight: '240px',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2.35rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 3px 6px rgba(0,0,0,0.4)', letterSpacing: '-0.02em' }}>💳 {t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '0 1rem' }}>

        {/* ENCART DE RENOUVELLEMENT COTISATION FAMILLE */}
        {pendingRenewal && (
          <div className="card shadow-sm" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: '20px', border: '2px solid #f59e0b', background: 'var(--bg-card)' }}>
            <div className="d-flex align-items-center gap-2 mb-3">
              <span style={{ fontSize: '1.4rem' }}>🔔</span>
              <h5 className="fw-bold mb-0" style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>Renouvellement de cotisation — Régularisation famille</h5>
            </div>

            <div className="mb-3 p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <small className="text-uppercase fw-bold" style={{ fontSize: '0.72rem', color: 'var(--text-sub)', letterSpacing: '0.04em' }}>Code adhérent :</small>
                <code className="fw-bold" style={{ fontSize: '0.88rem', color: '#10b981' }}>{adherentCode}</code>
              </div>

              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {familyMembers.map((m, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-body)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        background: i === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.12)', 
                        color: i === 0 ? '#059669' : '#3b82f6', 
                        fontSize: '0.72rem', fontWeight: '700', 
                        padding: '0.2rem 0.55rem', borderRadius: '6px',
                        border: i === 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.25)',
                        whiteSpace: 'nowrap'
                      }}>
                        {m.relation}
                      </span>
                      <span className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{m.name} {m.lastName}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
                      <code style={{ fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.15rem 0.45rem', borderRadius: '6px', whiteSpace: 'nowrap' }}>
                        {adherentCode}{m.suffix}
                      </code>
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        {new Intl.NumberFormat('fr-FR').format(COTISATION_PAR_PERSONNE)} FCFA
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="d-flex justify-content-between align-items-center pt-2.5 mt-2.5" style={{ borderTop: '2px solid var(--border-color)' }}>
                <span className="fw-bold" style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>Total famille ({familyMembers.length} personnes) :</span>
                <span className="fw-bold" style={{ fontSize: '1.2rem', color: '#ef4444' }}>
                  {new Intl.NumberFormat('fr-FR').format(familyMembers.length * COTISATION_PAR_PERSONNE)} FCFA
                </span>
              </div>
            </div>

            <small className="d-block text-muted" style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
              💡 Le montant total de <strong>{new Intl.NumberFormat('fr-FR').format(familyMembers.length * COTISATION_PAR_PERSONNE)} FCFA</strong> couvre la cotisation annuelle de l'adhérent principal et de tous les bénéficiaires rattachés ({COTISATION_PAR_PERSONNE.toLocaleString('fr-FR')} FCFA / personne / an).
            </small>
          </div>
        )}

        {/* FORMULAIRE DE PAIEMENT */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderRadius: '20px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <img 
                        src={p === 'wave' ? '/logo_wave.png' : '/logo_orange_money.png'} 
                        alt={t.providers[p]} 
                        style={{ height: '20px', borderRadius: '4px' }}
                      />
                      <span>{t.providers[p]}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {pendingRenewal && (
              <div className="mb-3 p-2 rounded-3 d-flex align-items-center gap-2" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.82rem' }}>
                <span>🆔</span>
                <span>Code bénéficiaire : <strong style={{ color: '#10b981' }}>{adherentCode}</strong></span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.phone}</label>
                <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="77 602 67 83 ou 71 123 45 67" />
                <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>Indicatifs acceptés : Orange (77, 78, 71), Free (76), Expresso (70), Promobile (75).</small>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.amount}</label>
                <input 
                  className="input" 
                  type="number" 
                  required 
                  value={form.amount} 
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                  readOnly={!!pendingRenewal}
                  style={pendingRenewal ? { background: 'var(--bg-card-subtle)', fontWeight: '700', color: '#ef4444' } : {}}
                />
                {pendingRenewal && (
                  <small className="text-danger d-block mt-1" style={{ fontSize: '0.72rem', fontWeight: '600' }}>
                    ⚠️ Montant fixé pour la régularisation famille
                  </small>
                )}
              </div>
            </div>

            {!pendingRenewal && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600' }}>{t.purpose}</label>
                <select className="input" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                  <option value="cotisation">{t.purposes.cotisation}</option>
                  <option value="donation">{t.purposes.donation}</option>
                  <option value="adhesion">{t.purposes.adhesion}</option>
                </select>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: '700', borderRadius: '14px' }}>
              {loading ? '⏳ Traitement en cours...' : `💳 ${t.pay} ${new Intl.NumberFormat('fr-FR').format(form.amount)} FCFA`}
            </button>
          </form>

          {result && (
            <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: '14px', background: result.error ? 'rgba(239,68,68,0.1)' : (result.status === 'success' ? 'rgba(34,197,94,0.08)' : 'var(--bg-secondary)'), border: result.status === 'success' ? '1px solid rgba(34,197,94,0.3)' : '1px solid var(--border-color)' }}>
              {result.error ? (
                <span style={{ color: '#ef4444', fontWeight: '600' }}>❌ {result.error}</span>
              ) : (
                <>
                  <div style={{ fontWeight: '700', marginBottom: '0.5rem', fontSize: '1.05rem' }}>
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
                    <div style={{ marginTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.92rem', color: '#22c55e', fontWeight: '700', marginBottom: '0.5rem' }}>
                        ✅ {t.success} ({new Intl.NumberFormat('fr-FR').format(result.amount || form.amount)} FCFA)
                      </div>
                      {pendingRenewal && (
                        <div className="p-2 rounded-3 mt-2" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', fontSize: '0.85rem' }}>
                          <strong>🎉 Cotisation régularisée !</strong><br />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                            Tous vos droits et ceux de votre famille sont rétablis. Vous pouvez maintenant accéder à l'ensemble des services UNAMUSC.
                          </span>
                          <div className="mt-2">
                            <button 
                              type="button" 
                              className="btn btn-primary btn-sm fw-bold px-3"
                              style={{ borderRadius: '10px', fontSize: '0.82rem' }}
                              onClick={() => {
                                localStorage.setItem('cmu-portal-mode', 'citizen');
                                localStorage.removeItem('cmu-pending-renewal');
                                localStorage.removeItem('cmu-cotisation-suspended');
                                if (setView) setView('guarantees');
                                else window.location.hash = '#guarantees';
                              }}
                            >
                              ✅ Accéder à mes services
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Historique */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '20px' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <img 
                            src={p.provider === 'wave' ? '/logo_wave.png' : '/logo_orange_money.png'} 
                            alt={p.provider} 
                            style={{ height: '14px', borderRadius: '2px' }}
                          />
                          <span>{new Intl.NumberFormat('fr-FR').format(p.amount)} FCFA</span>
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
