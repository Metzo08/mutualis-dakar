import React, { useState, useEffect } from 'react';

export default function PurchaseOrders({ lang = 'fr' }) {
  const defaultOrders = [
    {
      id: 101,
      first_name: 'Amadou',
      last_name: 'Sow',
      cmu_number: 'CMU-DKR-2026-8812',
      items_json: JSON.stringify([
        { name: 'Amoxicilline 500mg (Gélules)', qty: 2, price: 3500 },
        { name: 'Paracétamol 1000mg', qty: 1, price: 1500 }
      ]),
      total_amount: 8500,
      cmu_covered: 6800,
      patient_pay: 1700,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      order_code: 'ORD-2026-PHARM-881'
    },
    {
      id: 102,
      first_name: 'Fatou',
      last_name: 'Diop',
      cmu_number: 'CMU-DKR-2026-4401',
      items_json: JSON.stringify([
        { name: 'Sirop Toux Enfant', qty: 1, price: 2800 },
        { name: 'Sérum Physiologique (Boîte)', qty: 2, price: 1200 }
      ]),
      total_amount: 5200,
      cmu_covered: 4160,
      patient_pay: 1040,
      status: 'used',
      created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      order_code: 'ORD-2026-PHARM-440'
    }
  ];

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [medicineName, setMedicineName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const storedLocal = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      const res = await fetch('/api/purchase-orders');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setOrders([...storedLocal, ...json.data]);
      } else {
        setOrders([...storedLocal, ...defaultOrders]);
      }
    } catch (err) {
      console.warn('Utilisation des bons de commande de démonstration:', err);
      const storedLocal = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      setOrders([...storedLocal, ...defaultOrders]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!medicineName || !estimatedPrice) return;
    setItems([
      ...items,
      {
        name: medicineName,
        qty: parseInt(quantity) || 1,
        price: parseFloat(estimatedPrice) || 0
      }
    ]);
    setMedicineName('');
    setQuantity(1);
    setEstimatedPrice('');
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async () => {
    if (items.length === 0) return;
    setCreating(true);
    setRedeemSuccess('');

    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const totalSum = items.reduce((a, b) => a + (b.price * b.qty), 0);
    const cmuCovered = totalSum * 0.8;
    const patientPay = totalSum * 0.2;

    const newOrder = {
      id: Date.now(),
      first_name: citizenData.firstName || 'Amadou',
      last_name: citizenData.lastName || 'Sow',
      cmu_number: citizenData.cmuNumber || 'CMU-DKR-2026-8812',
      items_json: JSON.stringify(items),
      total_amount: totalSum,
      cmu_covered: cmuCovered,
      patient_pay: patientPay,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
    };

    try {
      await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          items: items,
          total_amount: totalSum
        })
      });
    } catch (err) {
      console.warn(err);
    }

    const storedLocal = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
    localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrder, ...storedLocal]));

    setOrders([newOrder, ...orders]);
    setItems([]);
    setRedeemSuccess('Bon de commande émis avec succès ! Présentez ce bon ou son QR Code dans n\'importe quelle pharmacie agréée sous 48 heures pour bénéficier du tiers-payant (80%).');
    setCreating(false);
  };

  const handleRedeem = (id) => {
    const updated = orders.map(o => o.id === id ? { ...o, status: 'used' } : o);
    setOrders(updated);
    localStorage.setItem('cmu_purchase_orders', JSON.stringify(updated));
    setRedeemSuccess('Bon de commande validé avec succès en pharmacie sous le Tiers-Payant UNAMUSC !');
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature centrée */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/meds_hero_real.png") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1 mb-2 fw-semibold d-inline-block text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              borderRadius: '20px',
              fontSize: '0.82rem',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            💊 Tiers-Payant UNAMUSC pharmacie agréée — Validité 48h
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Keuyit u am garab (Bons de commande pharmacie)' : 'Bons de commande & Tiers-Payant UNAMUSC'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Bon de commande bu 48 heures d\'utilisation ci pharmacie partenaires yi.'
              : 'Générez des bons de commande de médicaments valides 48h pour un retrait direct sous le Tiers-Payant UNAMUSC en pharmacie.'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            <button 
              type="button"
              className="btn fw-semibold text-white"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                cursor: 'pointer'
              }}
              onClick={fetchOrders}
            >
              🔄 {lang === 'wo' ? 'Yessal lim bi' : 'Actualiser la liste'}
            </button>
          </div>
        </div>
      </section>

      {redeemSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{redeemSuccess}</div>
        </div>
      )}

      {/* Formulaire de création de bon de commande */}
      <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <span>🛒</span> Nouveau bon de commande / ordonnance médicale
        </h4>

        <form onSubmit={handleAddItem}>
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-5">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Nom du médicament prescrit *</label>
              <input 
                type="text" 
                className="form-control input"
                placeholder="ex: Amoxicilline 500mg, Paracétamol..."
                value={medicineName}
                onChange={(e) => setMedicineName(e.target.value)}
                style={{ borderRadius: '10px', height: '48px' }}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Quantité</label>
              <input 
                type="number" 
                className="form-control input"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ borderRadius: '10px', height: '48px' }}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Prix unitaire estimé (FCFA)</label>
              <input 
                type="number" 
                className="form-control input"
                placeholder="ex: 3500"
                value={estimatedPrice}
                onChange={(e) => setEstimatedPrice(e.target.value)}
                style={{ borderRadius: '10px', height: '48px' }}
                required
              />
            </div>
            <div className="col-md-2">
              <button 
                type="submit" 
                className="btn text-white w-100 fw-bold"
                style={{ height: '48px', borderRadius: '10px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
              >
                ➕ Ajouter
              </button>
            </div>
          </div>
        </form>

        {items.length > 0 && (
          <div className="border rounded-3 p-3.5 mb-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>💊 Médicaments sur ce bon de commande :</h6>
            <div className="list-group mb-3">
              {items.map((it, idx) => (
                <div key={idx} className="list-group-item d-flex justify-content-between align-items-center p-3 rounded-3 mb-2" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <strong className="d-block" style={{ color: 'var(--text-main)' }}>{it.name}</strong>
                    <span className="badge bg-secondary">Quantité: {it.qty}</span>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <div>
                      <span className="fw-bold text-primary d-block">{(it.price * it.qty).toLocaleString()} FCFA</span>
                      <small className="text-success">Pris en charge CMU (80%): {((it.price * it.qty) * 0.8).toLocaleString()} FCFA</small>
                    </div>
                    <button className="btn btn-sm btn-outline-danger py-1 px-2" onClick={() => handleRemoveItem(idx)}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-dark text-white rounded-3 mb-3 border border-success">
              <div className="row g-2 text-center">
                <div className="col-4">
                  <span className="small text-white-50 d-block">Prix Public Total</span>
                  <strong className="fs-6">{items.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()} FCFA</strong>
                </div>
                <div className="col-4 border-start border-end border-secondary">
                  <span className="small text-success d-block">Prise en charge CMU (80%)</span>
                  <strong className="fs-5 text-success">{(items.reduce((a, b) => a + (b.price * b.qty), 0) * 0.8).toLocaleString()} FCFA</strong>
                </div>
                <div className="col-4">
                  <span className="small text-warning d-block">Reste à payer pharmacie</span>
                  <strong className="fs-6 text-warning">{(items.reduce((a, b) => a + (b.price * b.qty), 0) * 0.2).toLocaleString()} FCFA</strong>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2">
              <span className="small text-muted">Valide pendant 48 heures dans toutes les pharmacies agréées du Sénégal.</span>
              <button className="btn btn-success px-4 py-2.5 fw-bold text-white shadow-sm" onClick={handleCreateOrder} disabled={creating} style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}>
                {creating ? 'Émission...' : '✅ Émettre le bon pharmacie 48h certifié'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des bons de commande */}
      <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📋 Vos bons de commande de médicaments en cours</h4>

        {loading ? (
          <div className="text-center py-5 text-muted">Chargement des bons de commande...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <span style={{ fontSize: '3rem' }}>💊</span>
            <p className="mt-2" style={{ fontSize: '0.9rem' }}>Aucun bon de commande disponible.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle" style={{ color: 'var(--text-main)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Code & Date</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Assuré</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Médicaments prescrits</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Prise en charge CMU</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Chrono Validité</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Statut</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem', textAlign: 'right' }}>Actions Pharmacie</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => {
                  let itemsList = [];
                  try {
                    itemsList = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : (ord.items_json || []);
                  } catch (e) {}

                  return (
                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <code className="px-2 py-1 bg-dark text-success border border-success rounded-3 fw-bold d-inline-block mb-1">
                          {ord.order_code || `ORD-2026-${ord.id}`}
                        </code>
                        <small className="text-muted d-block">{new Date(ord.created_at).toLocaleDateString('fr-FR')}</small>
                      </td>
                      <td className="fw-bold" style={{ color: 'var(--text-main)', padding: '0.85rem' }}>
                        {ord.first_name} {ord.last_name}
                        <small className="text-muted d-block">{ord.cmu_number}</small>
                      </td>
                      <td style={{ padding: '0.85rem', maxWidth: '240px' }}>
                        {itemsList.map((i, idx) => (
                          <span key={idx} className="badge bg-dark-subtle text-body border me-1 my-1 p-2" style={{ borderRadius: '6px' }}>
                            💊 {i.name} (x{i.qty})
                          </span>
                        ))}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="fw-bold text-success d-block">{Number(ord.total_amount * 0.8).toLocaleString()} FCFA (80%)</span>
                        <small className="text-muted">Total: {Number(ord.total_amount).toLocaleString()} FCFA</small>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="badge bg-warning text-dark px-2.5 py-1 fw-bold" style={{ borderRadius: '6px' }}>
                          ⏳ Validité 48 heures
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {ord.status === 'active' && <span className="badge bg-success px-3 py-1.5" style={{ borderRadius: '12px' }}>✅ Actif (Prêt)</span>}
                        {ord.status === 'used' && <span className="badge bg-secondary px-3 py-1.5" style={{ borderRadius: '12px' }}>🔒 Délivré en pharmacie</span>}
                        {ord.status === 'expired' && <span className="badge bg-danger px-3 py-1.5" style={{ borderRadius: '12px' }}>⚠️ Expiré</span>}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem' }}>
                        <div className="d-flex justify-content-end gap-2">
                          <button 
                            type="button"
                            className="btn btn-sm btn-outline-success fw-bold"
                            onClick={() => setSelectedVoucher(ord)}
                            style={{ borderRadius: '8px' }}
                          >
                            📄 Bon PDF
                          </button>

                          {ord.status === 'active' && (
                            <button 
                              type="button"
                              className="btn btn-sm text-white fw-bold px-3 py-1.5"
                              onClick={() => handleRedeem(ord.id)}
                              style={{ background: '#059669', border: 'none', borderRadius: '8px' }}
                            >
                              📲 Valider pharmacie
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALE AFFICHAGE DU VOUCHER DE COMMANDE PAR PHARMACIE */}
      {selectedVoucher && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)' }}>
                <h5 className="modal-title fw-bold" style={{ color: 'var(--text-main)' }}>
                  💊 Bon Pharmacie Tiers-Payant — #{selectedVoucher.order_code || `ORD-${selectedVoucher.id}`}
                </h5>
                <button className="btn-close" onClick={() => setSelectedVoucher(null)}></button>
              </div>

              <div className="modal-body p-4 text-center">
                <div className="p-4 rounded-4 border bg-white text-dark text-start mb-3" style={{ border: '2px solid #047857' }}>
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-3 mb-3">
                    <div>
                      <h6 className="fw-bold text-success mb-0">BON DE COMMANDE DE MÉDICAMENTS (48H)</h6>
                      <small className="text-muted">Tiers-Payant UNAMUSC (SÉN-CSU)</small>
                    </div>
                    <code className="bg-dark text-success p-2 rounded fw-bold">
                      {selectedVoucher.order_code || `ORD-${selectedVoucher.id}`}
                    </code>
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <span className="small text-muted d-block">Bénéficiaire :</span>
                      <strong>{selectedVoucher.first_name} {selectedVoucher.last_name}</strong>
                    </div>
                    <div className="col-6 text-end">
                      <span className="small text-muted d-block">Code Carte CMU :</span>
                      <strong>{selectedVoucher.cmu_number}</strong>
                    </div>
                  </div>

                  <h6 className="fw-bold mb-2">Prescriptions :</h6>
                  <ul className="list-group mb-3">
                    {(() => {
                      try {
                        const items = typeof selectedVoucher.items_json === 'string' ? JSON.parse(selectedVoucher.items_json) : selectedVoucher.items_json;
                        return items.map((it, idx) => (
                          <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                            <span>💊 {it.name} (x{it.qty})</span>
                            <strong>{(it.price * it.qty).toLocaleString()} FCFA</strong>
                          </li>
                        ));
                      } catch (e) {
                        return <li className="list-group-item">Prescription médicamenteuse</li>;
                      }
                    })()}
                  </ul>

                  <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded-3">
                    <div>
                      <span className="small text-muted d-block">Montant pris en charge CMU (80%) :</span>
                      <h5 className="fw-bold text-success mb-0">{(selectedVoucher.total_amount * 0.8).toLocaleString()} FCFA</h5>
                    </div>
                    <div className="text-end">
                      <span className="small text-muted d-block">Ticket patient (20%) :</span>
                      <h6 className="fw-bold text-warning mb-0">{(selectedVoucher.total_amount * 0.2).toLocaleString()} FCFA</h6>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-center gap-2">
                  <button type="button" className="btn btn-success fw-bold px-4" onClick={() => alert('Bon de commande PDF certifié imprimé / téléchargé !')}>
                    📥 Télécharger le Bon PDF
                  </button>
                  <button type="button" className="btn btn-secondary fw-bold" onClick={() => setSelectedVoucher(null)}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
