import React, { useState, useEffect } from 'react';

export default function PurchaseOrders({ lang = 'fr' }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeemSuccess, setRedeemSuccess] = useState('');

  // Formulaire d'ajout de médicament
  const [medicineName, setMedicineName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/purchase-orders');
      const json = await res.json();
      if (json.success) {
        setOrders(json.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement bons de commande:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!medicineName) return;
    const newItem = {
      name: medicineName,
      qty: parseInt(quantity) || 1,
      price: parseFloat(estimatedPrice) || 0
    };
    setItems([...items, newItem]);
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
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const totalAmount = items.reduce((acc, i) => acc + (i.price * i.qty), 0);

      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          items,
          total_amount: totalAmount
        })
      });
      const json = await res.json();
      if (json.success) {
        setItems([]);
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRedeem = async (orderId) => {
    setRedeemSuccess('');
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}/redeem`, {
        method: 'POST'
      });
      const json = await res.json();
      if (json.success) {
        setRedeemSuccess('Bon de commande validé avec succès en pharmacie ! Le régime tiers-payant (80% pris en charge par la mutuelle) a été appliqué.');
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/meds_hero_real.png") center/cover no-repeat',
          padding: '2.5rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 position-relative" style={{ zIndex: 2 }}>
          <div style={{ maxWidth: '650px' }}>
            <span 
              className="badge px-3 py-1 mb-2 fw-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.22)',
                color: '#ffffff',
                backdropFilter: 'blur(4px)',
                borderRadius: '20px',
                fontSize: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              💊 Tiers-payant pharmacie agréée — Validité 48 heures
            </span>
            <h1 className="fw-bold mb-2 text-white" style={{ fontSize: '1.9rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              {lang === 'wo' ? 'Keuyit u am garab (Bons de commande pharmacie)' : 'Bons de commande & tiers-payant pharmacie'}
            </h1>
            <p className="mb-0 text-white-50" style={{ fontSize: '0.95rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              {lang === 'wo'
                ? 'Bon de commande bu 48 heures d\'utilisation ci pharmacie partenaires yi.'
                : 'Générez des bons de commande de médicaments valides 48h pour un retrait direct sous le régime du tiers-payant en pharmacie.'}
            </p>
          </div>

          <button 
            type="button"
            className="btn fw-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '12px',
              padding: '0.65rem 1.3rem',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={fetchOrders}
          >
            🔄 {lang === 'wo' ? 'Yessal lim bi' : 'Actualiser la liste'}
          </button>
        </div>
      </section>

      {redeemSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{redeemSuccess}</div>
        </div>
      )}

      {/* Formulaire de création de bon de commande */}
      <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <span>🛒</span> Nouveau bon de commande / ordonnance médicale
        </h4>

        <form onSubmit={handleAddItem}>
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-5">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Nom du médicament prescrit</label>
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
                className="btn btn-outline-primary w-100 fw-bold"
                style={{ height: '48px', borderRadius: '10px' }}
              >
                ➕ Ajouter
              </button>
            </div>
          </div>
        </form>

        {items.length > 0 && (
          <div className="border rounded-3 p-3 mb-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)' }}>
            <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>💊 Produits sur ce bon :</h6>
            <div className="list-group mb-3">
              {items.map((it, idx) => (
                <div key={idx} className="list-group-item d-flex justify-content-between align-items-center p-2 rounded-2 mb-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <span className="fw-bold" style={{ color: 'var(--text-main)' }}>{it.name}</span>
                    <span className="badge bg-secondary ms-2">Quantité: {it.qty}</span>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <span className="fw-bold text-primary">{(it.price * it.qty).toLocaleString()} FCFA</span>
                    <button className="btn btn-sm btn-outline-danger py-0 px-2" onClick={() => handleRemoveItem(idx)}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <span className="fw-bold fs-6" style={{ color: 'var(--text-main)' }}>
                Total ordonnance : <span className="text-primary">{items.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()} FCFA</span>
              </span>
              <button className="btn btn-success px-4 py-2 fw-bold" onClick={handleCreateOrder} disabled={creating} style={{ borderRadius: '12px', background: 'var(--primary)', borderColor: 'var(--primary)' }}>
                {creating ? 'Génération...' : '✅ Valider & émettre le bon (valide 48h)'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des bons de commande */}
      <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📋 Vos bons de commande de médicaments</h4>

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
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Date d'émission</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Assuré</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Médicaments prescrits</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Montant total</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Durée de validité</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Statut</th>
                  <th style={{ color: 'var(--text-main)', padding: '0.85rem', textAlign: 'right' }}>Action pharmacie</th>
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
                      <td style={{ padding: '0.85rem' }}>{new Date(ord.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="fw-bold" style={{ color: 'var(--text-main)', padding: '0.85rem' }}>{ord.first_name} {ord.last_name}</td>
                      <td style={{ padding: '0.85rem' }}>
                        {itemsList.map((i, idx) => (
                          <span key={idx} className="badge bg-dark-subtle text-body border me-1 my-1 p-2" style={{ borderRadius: '6px' }}>
                            💊 {i.name} (x{i.qty})
                          </span>
                        ))}
                      </td>
                      <td className="fw-bold text-primary" style={{ padding: '0.85rem' }}>{Number(ord.total_amount).toLocaleString()} FCFA</td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="badge bg-info-subtle text-info border border-info px-2.5 py-1" style={{ borderRadius: '6px' }}>
                          ⏳ 48h par défaut
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {ord.status === 'active' && <span className="badge bg-success px-2.5 py-1" style={{ borderRadius: '6px' }}>✅ Actif (Prêt)</span>}
                        {ord.status === 'used' && <span className="badge bg-secondary px-2.5 py-1" style={{ borderRadius: '6px' }}>🔒 Délivré en pharmacie</span>}
                        {ord.status === 'expired' && <span className="badge bg-danger px-2.5 py-1" style={{ borderRadius: '6px' }}>⚠️ Expiré</span>}
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem' }}>
                        {ord.status === 'active' ? (
                          <button 
                            className="btn btn-sm btn-success fw-bold px-3 py-1"
                            onClick={() => handleRedeem(ord.id)}
                            style={{ borderRadius: '8px' }}
                          >
                            📲 Valider tiers-payant
                          </button>
                        ) : (
                          <span className="text-muted small">Terminé</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
