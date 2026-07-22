import React, { useState, useEffect } from 'react';

export default function PurchaseOrders({ lang = 'fr' }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [redeemSuccess, setRedeemSuccess] = useState('');

  // Génération d'un nouveau bon
  const [medicineName, setMedicineName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [estimatedPrice, setEstimatedPrice] = useState('');
  const [items, setItems] = useState([]);

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

  const handleAddItem = () => {
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

  const handleCreateOrder = async () => {
    if (items.length === 0) return;
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
        setRedeemSuccess('Bon de commande validé avec succès en pharmacie (Tiers-Payant appliqué).');
        fetchOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
          💊 {lang === 'wo' ? 'Keuyit u am garab (Bons de Commande Pharmacie)' : 'Bons de Commande & Tiers-Payant Pharmacie'}
        </h2>
        <p className="text-muted mb-0">
          {lang === 'wo'
            ? 'Bon de commande bu 48 heures d\'utilisation ci pharmacie partenaires yi.'
            : 'Générez des bons de commande de médicaments valides 48h pour un retrait direct sous le régime du tiers-payant.'}
        </p>
      </div>

      {redeemSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-4">
          <span className="me-2">✅</span> {redeemSuccess}
        </div>
      )}

      {/* Générateur de Bon */}
      <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
        <h4 className="fw-bold mb-3">🛒 Nouveau Bon de Commande de Médicaments / Ordonnance</h4>
        <div className="row g-3 align-items-end mb-3">
          <div className="col-md-5">
            <label className="form-label fw-semibold">Nom du Médicament / Produit</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="ex: Amoxicilline 500mg"
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label fw-semibold">Quantité</label>
            <input 
              type="number" 
              className="form-control"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label fw-semibold">Prix Unitaire Estimé (FCFA)</label>
            <input 
              type="number" 
              className="form-control"
              placeholder="ex: 3500"
              value={estimatedPrice}
              onChange={(e) => setEstimatedPrice(e.target.value)}
            />
          </div>
          <div className="col-md-2">
            <button className="btn btn-outline-primary w-100" onClick={handleAddItem}>
              ➕ Ajouter
            </button>
          </div>
        </div>

        {items.length > 0 && (
          <div className="border rounded p-3 bg-light mb-3">
            <h6 className="fw-bold">Produits ajoutés au Bon :</h6>
            <ul className="list-group mb-3">
              {items.map((it, idx) => (
                <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>💊 <strong>{it.name}</strong> x {it.qty}</span>
                  <span className="fw-bold text-primary">{(it.price * it.qty).toLocaleString()} FCFA</span>
                </li>
              ))}
            </ul>
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-bold">Total Estimé : {items.reduce((a, b) => a + (b.price * b.qty), 0).toLocaleString()} FCFA</span>
              <button className="btn btn-success px-4" onClick={handleCreateOrder}>
                ✅ Générer le Bon (Valide 48h)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Liste des Bons */}
      <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
        <h4 className="fw-bold mb-3">📋 Vos Bons de Commande Actifs</h4>
        {loading ? (
          <div>Chargement des bons de commande...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-4 text-muted">Aucun bon de commande disponible.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>Date</th>
                  <th>Assuré</th>
                  <th>Médicaments</th>
                  <th>Total</th>
                  <th>Durée de Validité</th>
                  <th>Statut</th>
                  <th>Action Pharmacie</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord) => {
                  let itemsList = [];
                  try {
                    itemsList = typeof ord.items_json === 'string' ? JSON.parse(ord.items_json) : (ord.items_json || []);
                  } catch (e) {}

                  return (
                    <tr key={ord.id}>
                      <td>{new Date(ord.created_at).toLocaleDateString('fr-FR')}</td>
                      <td className="fw-bold">{ord.first_name} {ord.last_name}</td>
                      <td>
                        {itemsList.map((i, idx) => (
                          <span key={idx} className="badge bg-light text-dark border me-1">
                            {i.name} (x{i.qty})
                          </span>
                        ))}
                      </td>
                      <td className="fw-bold text-primary">{Number(ord.total_amount).toLocaleString()} FCFA</td>
                      <td>
                        <span className="badge bg-info text-dark">
                          ⏳ 48 heures
                        </span>
                      </td>
                      <td>
                        {ord.status === 'active' && <span className="badge bg-success">✅ Actif (Prêt)</span>}
                        {ord.status === 'used' && <span className="badge bg-secondary">🔒 Délivré en pharmacie</span>}
                        {ord.status === 'expired' && <span className="badge bg-danger">⚠️ Expiré</span>}
                      </td>
                      <td>
                        {ord.status === 'active' && (
                          <button 
                            className="btn btn-sm btn-success"
                            onClick={() => handleRedeem(ord.id)}
                          >
                            📲 Valider Tiers-Payant
                          </button>
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
