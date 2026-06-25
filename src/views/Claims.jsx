import React, { useState, useEffect } from 'react';

// Suivi des demandes de prise en charge (claims / remboursements / tiers-payant).
// - Citoyen : voit ses propres demandes + peut en déposer une nouvelle
// - Agent : voit toutes les demandes + peut les traiter (approuver/refuser/rembourser)
export default function Claims({ lang, portalMode, citizenUser, agentUser }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);

  // Formulaire
  const [form, setForm] = useState({
    beneficiaryName: citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : '',
    phone: citizenUser?.phone || '',
    structureName: '',
    careType: 'consultation',
    careDescription: '',
    amount: '',
    treatmentDate: ''
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');

  const isAgent = portalMode === 'agent' && agentUser;

  const t = lang === 'fr' ? {
    title: 'Prise en charge & remboursements',
    subtitle: 'Suivez vos demandes de prise en charge et le tiers-payant',
    newClaim: 'Nouvelle demande',
    status: 'Statut',
    all: 'Tous',
    pending: 'En attente',
    approved: 'Approuvée',
    rejected: 'Refusée',
    paid: 'Remboursée',
    beneficiary: 'Bénéficiaire',
    structure: 'Structure',
    careType: 'Type de soin',
    amount: 'Montant (FCFA)',
    reimbursed: 'Remboursé (FCFA)',
    date: 'Date',
    action: 'Action',
    approve: 'Approuver',
    reject: 'Refuser',
    pay: 'Rembourser',
    fStructure: 'Nom de la structure',
    fCareType: 'Type de soin',
    fAmount: 'Montant payé (FCFA)',
    fDate: 'Date du soin',
    fDesc: 'Description (optionnel)',
    fSubmit: 'Soumettre la demande',
    consultation: 'Consultation',
    pharmacie: 'Pharmacie',
    hospitalisation: 'Hospitalisation',
    acte: 'Acte médical',
    noClaims: 'Aucune demande de prise en charge.',
    prev: 'Précédent',
    next: 'Suivant'
  } : {
    title: 'Prise en charge ak remboursement',
    subtitle: 'Tëggal sa demande yi ci prise en charge',
    newClaim: 'Demande bu bees',
    status: 'Statut',
    all: 'Yëpp',
    pending: 'Ci nëbb',
    approved: 'Baax na',
    rejected: 'Baaxul',
    paid: 'Ñu fay na',
    beneficiary: 'Bénéficiaire',
    structure: 'Fajukaay',
    careType: 'Anam faj',
    amount: 'Xalis (FCFA)',
    reimbursed: 'Ñu fay (FCFA)',
    date: 'Date',
    action: 'Liggéey',
    approve: 'Baaxal',
    reject: 'Baaxul',
    pay: 'Fay',
    fStructure: 'Touru fajukaay',
    fCareType: 'Anam faj',
    fAmount: 'Xalis bi (FCFA)',
    fDate: 'Dateu faj',
    fDesc: 'Mbind (optionnel)',
    fSubmit: 'Yónnee demande',
    consultation: 'Consultation',
    pharmacie: 'Farmasi',
    hospitalisation: 'Liggéeyu kër',
    acte: 'Acte',
    noClaims: 'Amul demande.',
    prev: 'Bu njëk',
    next: 'Bu gënë topp'
  };

  const fetchClaims = (p = 1) => {
    setLoading(true);
    const token = localStorage.getItem('cmu-token') || '';
    let url = `http://localhost:5000/api/claims?page=${p}&limit=20`;
    if (filterStatus) url += `&status=${filterStatus}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload.data || [];
        setClaims(list);
        if (payload.pagination) {
          setPagination(payload.pagination);
          setPage(payload.pagination.page);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchClaims(1); }, [filterStatus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    setSubmitMsg('');
    const token = localStorage.getItem('cmu-token') || '';
    fetch('http://localhost:5000/api/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        beneficiaryId: citizenUser?.id || null,
        beneficiaryName: form.beneficiaryName,
        phone: form.phone,
        structureName: form.structureName,
        careType: form.careType,
        careDescription: form.careDescription,
        amount: form.amount,
        coverageRate: 80,
        treatmentDate: form.treatmentDate
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setSubmitLoading(false);
        if (data.success) {
          setSubmitMsg(`✅ Demande #${data.claimId} enregistrée. Montant estimé pris en charge : ${data.reimbursedAmount} FCFA.`);
          setShowForm(false);
          fetchClaims(1);
        } else {
          setSubmitMsg(`❌ ${data.error || 'Erreur'}`);
        }
      })
      .catch(() => { setSubmitLoading(false); setSubmitMsg('❌ Erreur de connexion.'); });
  };

  const processClaim = (id, status) => {
    const token = localStorage.getItem('cmu-token') || '';
    const body = { status };
    if (status === 'paid' || status === 'approved') {
      const claim = claims.find((c) => c.id === id);
      body.reimbursedAmount = claim.reimbursed_amount;
    }
    fetch(`http://localhost:5000/api/claims/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
      .then((res) => res.json())
      .then(() => fetchClaims(page))
      .catch(() => alert('Erreur lors du traitement.'));
  };

  const statusBadge = (status) => {
    const map = { pending: '⏳', approved: '✅', rejected: '❌', paid: '💰' };
    const bgColors = { 
      pending: 'rgba(245, 158, 11, 0.12)', 
      approved: 'rgba(16, 185, 129, 0.12)', 
      rejected: 'rgba(239, 68, 68, 0.12)', 
      paid: 'rgba(20, 184, 166, 0.12)' 
    };
    const textColors = { 
      pending: '#f59e0b', 
      approved: '#10b981', 
      rejected: '#ef4444', 
      paid: '#14b8a6' 
    };
    return (
      <span style={{ 
        background: bgColors[status] || 'rgba(153, 153, 153, 0.12)', 
        color: textColors[status] || '#999', 
        padding: '0.3rem 0.75rem', 
        borderRadius: '20px', 
        fontSize: '0.75rem', 
        fontWeight: '700',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        border: `1px solid ${textColors[status] || '#999'}1a`
      }}>
        <span>{map[status]}</span> {t[status] || status}
      </span>
    );
  };

  return (
    <div className="claims-view fade-in-up" style={{ padding: '1.5rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header section with page meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', fontFamily: 'var(--font-title)', letterSpacing: '-0.5px' }}>
            💊 {t.title}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{t.subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <select 
              className="input" 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)} 
              style={{ 
                width: 'auto', 
                minWidth: '150px',
                cursor: 'pointer',
                fontWeight: '600',
                background: 'var(--bg-card)',
                borderRadius: '10px'
              }}
            >
              <option value="">🔍 {t.all}</option>
              <option value="pending">⏳ {t.pending}</option>
              <option value="approved">✅ {t.approved}</option>
              <option value="rejected">❌ {t.rejected}</option>
              <option value="paid">💰 {t.paid}</option>
            </select>
          </div>
          {!isAgent && (
            <button 
              className="btn btn-primary" 
              onClick={() => setShowForm(!showForm)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                borderRadius: '10px',
                background: showForm 
                  ? 'linear-gradient(135deg, #475569 0%, #334155 100%)' 
                  : 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                boxShadow: showForm 
                  ? 'none' 
                  : '0 4px 12px rgba(5, 150, 105, 0.2)',
                border: 'none',
                padding: '0.65rem 1.25rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
              }}
            >
              {showForm ? '✕ Fermer' : <><span>➕</span> {t.newClaim}</>}
            </button>
          )}
        </div>
      </div>

      {submitMsg && (
        <div className="alert fade-in-up" style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem', 
          borderRadius: '12px', 
          background: 'var(--bg-card-subtle)', 
          borderLeft: '4px solid var(--primary)',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          {submitMsg}
        </div>
      )}

      {/* Glassmorphic Form Card */}
      {showForm && (
        <div className="card fade-in-up" style={{ 
          padding: '2rem', 
          marginBottom: '2rem',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--glass-shadow)',
          borderRadius: '16px'
        }}>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-2" style={{ gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                  <span>👤</span> {t.beneficiaryName || 'Nom'}
                </label>
                <input className="input" required value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                  <span>📞</span> {t.phone || 'Téléphone'}
                </label>
                <input className="input" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                  <span>🏥</span> {t.fStructure}
                </label>
                <input className="input" required value={form.structureName} onChange={(e) => setForm({ ...form, structureName: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                  <span>🩺</span> {t.fCareType}
                </label>
                <select className="input" value={form.careType} onChange={(e) => setForm({ ...form, careType: e.target.value })} style={{ cursor: 'pointer' }}>
                  <option value="consultation">🩺 {t.consultation}</option>
                  <option value="pharmacie">💊 {t.pharmacie}</option>
                  <option value="hospitalisation">🏥 {t.hospitalisation}</option>
                  <option value="acte">🔬 {t.acte}</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                  <span>💰</span> {t.fAmount}
                </label>
                <input className="input" type="number" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                  <span>📅</span> {t.fDate}
                </label>
                <input className="input" type="date" value={form.treatmentDate} onChange={(e) => setForm({ ...form, treatmentDate: e.target.value })} style={{ cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-sub)' }}>
                <span>📝</span> {t.fDesc}
              </label>
              <textarea className="input" rows={2} value={form.careDescription} onChange={(e) => setForm({ ...form, careDescription: e.target.value })} />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={submitLoading} 
              style={{ 
                marginTop: '1.5rem', 
                width: '100%', 
                padding: '0.8rem',
                fontWeight: '700',
                fontSize: '0.95rem',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                boxShadow: '0 4px 15px rgba(5, 150, 105, 0.2)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
              }}
            >
              {submitLoading ? '...' : <><span>📤</span> {t.fSubmit}</>}
            </button>
          </form>
        </div>
      )}

      {/* Main Table / Data list card */}
      <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', background: 'var(--bg-card)' }}>
        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="pulse" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⌛</div>
            {lang === 'fr' ? 'Chargement en cours…' : 'Tambali…'}
          </div>
        ) : claims.length === 0 ? (
          /* Premium Empty State */
          <div style={{ 
            padding: '5rem 2rem', 
            textAlign: 'center', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: '1.25rem' 
          }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '50%', 
              background: 'rgba(5, 150, 105, 0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '2.5rem',
              color: 'var(--primary)',
              boxShadow: '0 8px 24px rgba(5, 150, 105, 0.1)',
              animation: 'pulse 2s infinite'
            }}>
              📄
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem', fontFamily: 'var(--font-title)' }}>
                {lang === 'fr' ? 'Aucune demande enregistrée' : 'Amul demande bu dugg'}
              </h3>
              <p style={{ color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto', fontSize: '0.875rem', lineHeight: '1.5' }}>
                {lang === 'fr' 
                  ? "Vous n'avez pas encore soumis de demande de prise en charge pour vos soins médicaux ou pharmaceutiques." 
                  : "Meleguloo yónnee bénn demande ngir sa wér-gi-yaram."}
              </p>
            </div>
            {!isAgent && !showForm && (
              <button 
                className="btn btn-primary" 
                onClick={() => setShowForm(true)}
                style={{
                  fontWeight: '600',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)',
                  border: 'none',
                  padding: '0.65rem 1.5rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer'
                }}
              >
                📥 {t.newClaim}
              </button>
            )}
          </div>
        ) : (
          /* Premium Styled Table */
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ 
                  background: 'var(--bg-card-subtle)', 
                  borderBottom: '2px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: '600'
                }}>
                  <th style={{ padding: '1rem 1.25rem' }}>#</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.beneficiary}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.structure}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.careType}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.amount}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.reimbursed}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.status}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.date}</th>
                  {isAgent && <th style={{ padding: '1rem 1.25rem' }}>{t.action}</th>}
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr 
                    key={c.id} 
                    style={{ 
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color 0.2s ease',
                      cursor: 'default'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: '1rem 1.25rem', fontWeight: '700', color: 'var(--text-muted)' }}>#{c.id}</td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: '600', color: 'var(--text-main)' }}>{c.beneficiary_name}</td>
                    <td style={{ padding: '1rem 1.25rem' }}>{c.structure_name}</td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ 
                        background: 'var(--bg-card-subtle)', 
                        padding: '0.25rem 0.6rem', 
                        borderRadius: '6px', 
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        border: '1px solid var(--border-color)'
                      }}>
                        {t[c.care_type] || c.care_type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: '500' }}>
                      {new Intl.NumberFormat('fr-FR').format(c.amount)}{' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '400' }}>FCFA</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#10b981' }}>
                      {new Intl.NumberFormat('fr-FR').format(c.reimbursed_amount)}{' '}
                      <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: '400' }}>FCFA</span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>{statusBadge(c.status)}</td>
                    <td style={{ padding: '1rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    {isAgent && (
                      <td style={{ padding: '1rem 1.25rem' }}>
                        {c.status === 'pending' && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm" style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', border: 'none', cursor: 'pointer' }} onClick={() => processClaim(c.id, 'approved')}>{t.approve}</button>
                            <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', border: 'none', cursor: 'pointer' }} onClick={() => processClaim(c.id, 'rejected')}>{t.reject}</button>
                          </div>
                        )}
                        {c.status === 'approved' && (
                          <button className="btn btn-sm" style={{ background: '#14b8a6', color: '#fff', fontSize: '0.75rem', borderRadius: '6px', fontWeight: '600', border: 'none', cursor: 'pointer' }} onClick={() => processClaim(c.id, 'paid')}>{t.pay}</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Section */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)' }}>
            <button className="btn btn-outline btn-sm" disabled={!pagination.hasPrev} onClick={() => fetchClaims(page - 1)} style={{ borderRadius: '8px' }}>{t.prev}</button>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-sub)' }}>{page} / {pagination.totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={!pagination.hasNext} onClick={() => fetchClaims(page + 1)} style={{ borderRadius: '8px' }}>{t.next}</button>
          </div>
        )}
      </div>
    </div>
  );
}
