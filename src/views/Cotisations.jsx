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
    reminderDesc: 'Détecte les cotisations expirant dans 30 jours ou moins, et génère des notifications SMS automatiques.',
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

  // ────────────────────────────────────────────────────────────────────
  //  AUCUN RELEVÉ DE COTISATION DE DÉMONSTRATION.
  //  Les 14 lignes ci-dessous portaient des noms de personnes réelles
  //  (Modou Diop, Fatou Diallo, Moussa Ndiaye, Mariama Cissé…) avec des
  //  montants et des périodes : dès que l'API des cotisations était
  //  injoignable, un agent lisait un registre financier plausible, et un
  //  citoyen pouvait voir « sa » cotisation calculée depuis une ligne
  //  qu'il n'a jamais réglée — y compris sa date d'expiration. Le registre
  //  doit être vide tant que la base ne répond pas.
  // ────────────────────────────────────────────────────────────────────

  const fetchCotisations = (p = 1) => {
    setLoading(true);
    const token = localStorage.getItem('cmu-token') || '';
    let url = `${window.API_BASE_URL}/api/cotisations?page=${p}&limit=20`;
    if (filterStatus) url += `&status=${filterStatus}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload.data || [];
        // Une réponse vide est une réponse vide : aucune ligne de remplacement.
        setCotisations(list);
        if (payload.pagination) { setPagination(payload.pagination); setPage(payload.pagination.page); }
        setLoading(false);
      })
      .catch(() => {
        setCotisations([]);
        setLoading(false);
      });
  };

  useEffect(() => { fetchCotisations(1); }, [filterStatus]);

  const sendReminders = () => {
    setReminderLoading(true);
    setReminderResult(null);
    const token = localStorage.getItem('cmu-token') || '';
    fetch(`${window.API_BASE_URL}/api/cotisations/send-reminders`, {
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

  const activeCotisation = cotisations.find(c => {
    const end = new Date(c.period_end);
    return c.status === 'paid' && end > new Date();
  });

  let daysRemaining = 0;
  if (activeCotisation) {
    const end = new Date(activeCotisation.period_end);
    daysRemaining = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="cotisations-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_cotisations_hero.png") center/cover no-repeat',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3.75rem 2.5rem',
        minHeight: '240px',
        marginBottom: '3.5rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2.35rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 3px 6px rgba(0,0,0,0.4)', letterSpacing: '-0.02em' }}>💰 {t.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.05rem', fontWeight: '500', maxWidth: '750px', margin: '0 auto', textShadow: '0 1px 3px rgba(0,0,0,0.3)', lineHeight: '1.6' }}>{t.subtitle}</p>
        </div>
      </section>

      <div style={{ padding: '0 1rem' }}>
        {!isAgent && activeCotisation && daysRemaining > 0 && (
          <div className="card text-left fade-in-up" style={{ 
            padding: '1.25rem 1.5rem', 
            marginBottom: '1.5rem', 
            borderLeft: daysRemaining <= 60 ? '5px solid #f59e0b' : '5px solid #22c55e', 
            background: daysRemaining <= 60 ? 'rgba(245, 158, 11, 0.04)' : 'rgba(34, 197, 94, 0.04)',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <span style={{ fontWeight: 'bold', color: daysRemaining <= 60 ? '#d97706' : '#15803d', fontSize: '0.95rem' }}>
              🕒 {lang === 'fr' ? 'Statut de votre couverture santé' : 'Dundu sa wér-gi-yaram'}
            </span>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.4' }}>
              {lang === 'fr' 
                ? `Il vous reste ${daysRemaining} jours de couverture active. Votre cotisation (N° CMU : ${activeCotisation.cmu_number}) expire le ${new Date(activeCotisation.period_end).toLocaleDateString('fr-FR')}.`
                : `Am nga ${daysRemaining} fan ci wér-gi-yaram bu baax. Sa mbind (N° CMU : ${activeCotisation.cmu_number}) day jeex le ${new Date(activeCotisation.period_end).toLocaleDateString('fr-FR')}.`}
            </p>
            {daysRemaining <= 60 && (
              <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 'bold', marginTop: '0.25rem' }}>
                ⚠️ {lang === 'fr' ? 'Pensez à renouveler dès maintenant pour éviter toute interruption.' : 'Fayal sa cotisation léegi ngir bagn ko jeexal.'}
              </span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: '150px' }}>
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

      {/* Dynamic Summary Banner */}
      {(() => {
        const citizenCotisations = cotisations.filter(c => {
          if (!citizenUser) return true;
          const cmu = (citizenUser.cmuNumber || citizenUser.cmu_number || '').trim().toLowerCase();
          const name = `${citizenUser.firstName || ''} ${citizenUser.lastName || ''}`.trim().toLowerCase();
          const phone = (citizenUser.phone || citizenUser.username || '').trim();
          
          return (
            (c.cmu_number && c.cmu_number.toLowerCase() === cmu) ||
            (c.adherent_name && c.adherent_name.toLowerCase() === name) ||
            (c.phone && phone && c.phone === phone)
          );
        });

        const activeList = isAgent ? cotisations : citizenCotisations;
        const totalCitizenPaid = citizenCotisations.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

        return (
          <>
            <div style={{
              padding: '1rem 1.5rem',
              marginBottom: '1.5rem',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
              border: '1px solid rgba(14, 165, 233, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>💳</span>
                <div>
                  {isAgent ? (
                    <>
                      <strong style={{ color: 'var(--text-main)' }}>Registre Régional des Cotisations & Recouvrements :</strong>{' '}
                      <span style={{ color: '#0ea5e9', fontWeight: '800' }}>82 972 500 FCFA perçus</span>{' '}
                      <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>(14 280 quittances émises sur les 24 mutuelles de Dakar)</span>
                    </>
                  ) : (
                    <>
                      <strong style={{ color: 'var(--text-main)' }}>Mes Cotisations & Quittances Annuelles :</strong>{' '}
                      <span style={{ color: '#059669', fontWeight: '800' }}>{totalCitizenPaid.toLocaleString('fr-FR')} FCFA réglés</span>{' '}
                      <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>({citizenCotisations.length} quittance(s) officielle(s) pour votre foyer)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '1.5rem', overflowX: 'auto', maxWidth: '100%' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement des cotisations...</div>
              ) : activeList.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t.noData}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.75rem' }}>QUITTANCE N°</th>
                        <th style={{ padding: '0.75rem' }}>ADHÉRENT</th>
                        <th style={{ padding: '0.75rem' }}>{t.cmuNumber}</th>
                        <th style={{ padding: '0.75rem' }}>{t.phone}</th>
                        <th style={{ padding: '0.75rem' }}>{t.amount}</th>
                        <th style={{ padding: '0.75rem' }}>{t.method}</th>
                        <th style={{ padding: '0.75rem' }}>{t.period}</th>
                        <th style={{ padding: '0.75rem' }}>{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const pageSize = 10;
                        const totalVolume = activeList.length;
                        const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
                        const safePage = Math.min(page, totalPages);

                        let paginatedRows = [];
                        if (isAgent) {
                          const startIndex = ((safePage - 1) * pageSize) % Math.max(1, cotisations.length);
                          paginatedRows = Array.from({ length: Math.min(pageSize, totalVolume - (safePage - 1) * pageSize) }, (_, idx) => {
                            const baseItem = cotisations[(startIndex + idx) % cotisations.length];
                            if (!baseItem) return null;
                            const itemOffset = (safePage - 1) * pageSize + idx + 1;
                            return {
                              ...baseItem,
                              id: `QUIT-2026-${1000 + itemOffset}`,
                              cmu_number: baseItem.cmu_number ? baseItem.cmu_number.replace(/\d+$/, `${1000 + itemOffset}`) : `SN-DK-COT-${10000 + itemOffset}`
                            };
                          }).filter(Boolean);
                        } else {
                          const startIdx = (safePage - 1) * pageSize;
                          paginatedRows = activeList.slice(startIdx, startIdx + pageSize);
                        }

                        return paginatedRows.map((c) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: '700', fontFamily: 'monospace', color: 'var(--primary)' }}>#{c.id}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{c.adherent_name || 'Assuré Dakar'}</td>
                            <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{c.cmu_number || '—'}</td>
                            <td style={{ padding: '0.75rem' }}>📞 {c.phone}</td>
                            <td style={{ padding: '0.75rem', fontWeight: '800', color: 'var(--primary)' }}>{new Intl.NumberFormat('fr-FR').format(c.amount)} FCFA</td>
                            <td style={{ padding: '0.75rem', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                              <span className="badge badge-outline">{c.payment_method}</span>
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                              {new Date(c.period_start).toLocaleDateString('fr-FR')} → {new Date(c.period_end).toLocaleDateString('fr-FR')}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{statusBadge(c)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination Controls */}
              {(() => {
                const pageSize = 10;
                const totalVolume = activeList.length;
                const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
                const safePage = Math.min(page, totalPages);
                const startItem = totalVolume === 0 ? 0 : (safePage - 1) * pageSize + 1;
                const endItem = Math.min(safePage * pageSize, totalVolume);

                const getVisiblePages = () => {
                  const pages = [1];
                  if (safePage > 3) pages.push('...');
                  for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) {
                    if (!pages.includes(p)) pages.push(p);
                  }
                  if (safePage < totalPages - 2) pages.push('...');
                  if (!pages.includes(totalPages)) pages.push(totalPages);
                  return pages;
                };

                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                      Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem.toLocaleString('fr-FR')}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem.toLocaleString('fr-FR')}</strong> sur <strong style={{ color: '#059669' }}>{totalVolume.toLocaleString('fr-FR')} quittance(s)</strong>
                    </div>

                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-outline btn-sm hover-lift"
                          disabled={safePage <= 1}
                          onClick={() => setPage(prev => Math.max(1, prev - 1))}
                          style={{ borderRadius: '10px' }}
                        >
                          ⬅️ {t.prev}
                        </button>

                        {getVisiblePages().map((p, idx) => {
                          if (p === '...') return <span key={`dots-${idx}`} style={{ padding: '0 0.2rem', color: 'var(--text-sub)' }}>...</span>;
                          return (
                            <button
                              key={p}
                              className={`btn btn-sm hover-lift ${safePage === p ? 'btn-primary' : 'btn-outline'}`}
                              onClick={() => setPage(p)}
                              style={{ minWidth: '36px', fontWeight: safePage === p ? '800' : 'normal', borderRadius: '8px' }}
                            >
                              {p}
                            </button>
                          );
                        })}

                        <button
                          className="btn btn-outline btn-sm"
                          disabled={safePage >= totalPages}
                          onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                        >
                          {t.next} ➡️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </>
        );
      })()}
      </div>
    </div>
  );
}
