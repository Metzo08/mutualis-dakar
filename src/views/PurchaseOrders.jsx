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
        setRedeemSuccess('Bon de commande validé avec succès en pharmacie ! Le régime Tiers-Payant (80% pris en charge par la mutuelle) a été appliqué.');
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Header avec Bannière Stylisée */}
      <div 
        className="p-4 mb-4 rounded-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-3"
        style={{
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #075985 100%)',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.3)'
        }}
      >
        <div>
          <span className="badge bg-white text-info fw-bold px-3 py-1 mb-2" style={{ fontSize: '0.75rem', borderRadius: '20px' }}>
            💊 Tiers-Payant Pharmacie Agréée — Validité 48 Heures
          </span>
          <h2 className="fw-bold mb-1 text-white">
            {lang === 'wo' ? 'Keuyit u am garab (Bons de Commande Pharmacie)' : 'Bons de Commande & Tiers-Payant Pharmacie'}
          </h2>
          <p className="mb-0 text-white-50" style={{ fontSize: '0.9rem' }}>
            {lang === 'wo'
              ? 'Bon de commande bu 48 heures d\'utilisation ci pharmacie partenaires yi.'
              : 'Générez des bons de commande de médicaments valides 48h pour un retrait direct sous le régime du tiers-payant en pharmacie.'}
          </p>
        </div>

        <button className="btn btn-light text-info fw-bold px-4 py-2" style={{ borderRadius: '12px' }} onClick={fetchOrders}>
          🔄 Actualiser la Liste
        </button>
      </div>

      {redeemSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-4 me-2">✅</span>
          <div>{redeemSuccess}</div>
        </div>
      )}

      {/* Formulaire de création de Bon de Commande */}
      <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
          <span>🛒</span> Nouveau Bon de Commande / Ordonnance Médicale
        </h4>

        <form onSubmit={handleAddItem}>
          <div className="row g-3 align-items-end mb-3">
            <div className="col-md-5">
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Nom du Médicament Prescrit</label>
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
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Quantité</label>
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
              <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>Prix Unitaire Estimé (FCFA)</label>
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
            <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>💊 Produits sur ce Bon :</h6>
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
                Total Ordonnance : <span className="text-primary">{items.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()} FCFA</span>
              </span>
              <button className="btn btn-success px-4 py-2 fw-bold" onClick={handleCreateOrder} disabled={creating} style={{ borderRadius: '12px' }}>
                {creating ? 'Génération...' : '✅ Valider & Émettre le Bon (Valide 48h)'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des Bons de Commande Actifs */}
      <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
        <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📋 Vos Bons de Commande de Médicaments</h4>

        {loading ? (
          <div className="text-center py-5 text-muted">Chargement des bons de commande...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <span style={{ fontSize: '3rem' }}>💊</span>
            <p className="mt-2">Aucun bon de commande disponible.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle" style={{ color: 'var(--text-main)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ color: 'var(--text-main)' }}>Date d'émission</th>
                  <th style={{ color: 'var(--text-main)' }}>Assuré</th>
                  <th style={{ color: 'var(--text-main)' }}>Médicaments Prescrits</th>
                  <th style={{ color: 'var(--text-main)' }}>Montant Total</th>
                  <th style={{ color: 'var(--text-main)' }}>Durée de Validité</th>
                  <th style={{ color: 'var(--text-main)' }}>Statut</th>
                  <th style={{ color: 'var(--text-main)', textAlign: 'right' }}>Action Pharmacie</th>
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
                      <td>{new Date(ord.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="fw-bold" style={{ color: 'var(--text-main)' }}>{ord.first_name} {ord.last_name}</td>
                      <td>
                        {itemsList.map((i, idx) => (
                          <span key={idx} className="badge bg-dark-subtle text-body border me-1 my-1 p-2" style={{ borderRadius: '6px' }}>
                            💊 {i.name} (x{i.qty})
                          </span>
                        ))}
                      </td>
                      <td className="fw-bold text-primary">{Number(ord.total_amount).toLocaleString()} FCFA</td>
                      <td>
                        <span className="badge bg-info-subtle text-info border border-info px-2 py-1">
                          ⏳ 48h par défaut
                        </span>
                      </td>
                      <td>
                        {ord.status === 'active' && <span className="badge bg-success px-2 py-1">✅ Actif (Prêt)</span>}
                        {ord.status === 'used' && <span className="badge bg-secondary px-2 py-1">🔒 Délivré en Pharmacie</span>}
                        {ord.status === 'expired' && <span className="badge bg-danger px-2 py-1">⚠️ Expiré</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {ord.status === 'active' ? (
                          <button 
                            className="btn btn-sm btn-success fw-bold px-3 py-1"
                            onClick={() => handleRedeem(ord.id)}
                            style={{ borderRadius: '8px' }}
                          >
                            📲 Valider Tiers-Payant
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
