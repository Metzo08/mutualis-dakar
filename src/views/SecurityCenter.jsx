/**
 * Centré sur la gestion par MSD :
 * les actions (blocage, révocation, remplacement, reset MDP) et
 * l'historique sont filtrés par code MSD de l'utilisateur connecté.
 *
 * Route Frontend : 'security-center'
 * Route Backend  : GET /api/security/dashboard  ·  GET /api/security/audit
 */
import { useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function SecurityCenter({ lang, agentUser, setView, setViewTab }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [cmu, setCmu] = useState('');
  const [newCmu, setNewCmu] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [msdCode, setMsdCode] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams({ status: statusFilter === 'all' ? '' : statusFilter });
        if (msdCode) params.append('msdCode', msdCode);
        const data = await apiFetch(/api/cards?);
        setCards(data || []);
      } catch (err) {
        setError(' Impossible de charger les cartes.');
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter, msdCode]);

  const runAction = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      let payload;
      switch (action) {
        case 'block':
          payload = { reason };
          break;
        case 'unblock':
          payload = { reason };
          break;
        case 'revoke':
          payload = { reason };
          break;
        case 'replace':
          if (!newCmu) throw new Error('Numéro de nouvelle carte obligatoire.');
          payload = { newCmu };
          break;
        case 'reset-password':
          payload = { cmuNumber: cmu };
          break;
        default:
          throw new Error('Action non reconnue.');
      }
      const data = await apiFetch(/api/cards//block, { method: 'POST', body: JSON.stringify(payload) });
      setResult(data);
      setHistory((h) => [{ action, target, detail: payload, date: new Date().toISOString() }, ...h]);
      setCmu('');
      setNewCmu('');
      setReason('');
      setTarget('');
      setAction('');
    } catch (err) {
      setError(err.message || ' Erreur côté serveur.');
    }
  };

  if (loading) {
    return (
      <div className="container py-5">
        <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '600px' }}>
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2">Chargement du centre de sécurité…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">🛡️ Centre de Sécurité</h1>
          <p className="text-muted small">Gestion des cartes, blocages, révocations et réinitialisation de mot de passe.</p>
        </div>
      </div>

      {/* Filtres de cloisonnement */}
      <div className="card mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-3">
            <label className="form-label small text-muted">Filtrer par statut</label>
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Tous</option>
              <option value="blocked">Bloquées</option>
              <option value="active">Actives</option>
              <option value="revoked">Révoquées</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Code MSD (optionnel)</label>
            <input className="form-control" value={msdCode} onChange={(e) => setMsdCode(e.target.value)} placeholder="ex: CSU-DAKAR-01" />
          </div>
        </div>
      </div>

      {/* Actions rapide */}
      <div className="card mb-3">
        <h5 className="mb-2">Actions rapides</h5>
        <div className="row g-2">
          <div className="col-md-4">
            <select className="form-select" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">— Choisir —</option>
              <option value="block">🛑 Bloquer une carte</option>
              <option value="unblock">🔓 Débloquer une carte</option>
              <option value="revoke">⛔ Révoquer définitivement</option>
              <option value="replace">🔄 Remplacer une carte</option>
              <option value="reset-password">🔑 Réinitialiser MDP</option>
            </select>
          </div>
          <div className="col-md-4">
            <input
              className="form-control"
              placeholder="Numéro cmu (ou card_number)"
              value={target}
              onChange={(e) => setTarget(e.target.value.toUpperCase())}
              disabled={!action}
            />
          </div>
          <div className="col-md-4">
            <input
              className="form-control"
              placeholder="Motif (obligatoire pour bloquer/révoquer)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!action}
            />
          </div>
          {action === 'replace' && (
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Nouveau numéro carte"
                value={newCmu}
                onChange={(e) => setNewCmu(e.target.value.toUpperCase())}
                disabled={!action}
              />
            </div>
          )}
          {action === 'reset-password' && (
            <div className="col-md-4">
              <input
                className="form-control"
                placeholder="Numéro cmu"
                value={cmu}
                onChange={(e) => setCmu(e.target.value.toUpperCase())}
                disabled={!action}
              />
            </div>
          )}
          <div className="col-12">
            <button className="btn btn-danger" onClick={runAction} disabled={!action || !target}>
              Exécuter
            </button>
          </div>
        </div>
        {error && <div className="alert alert-danger mt-2">{error}</div>}
        {result && <div className="alert alert-success mt-2">{result.message}</div>}
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="card mb-3">
          <h5 className="mb-2">Historique des actions</h5>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Action</th><th>Cible</th><th>Date</th><th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((h, i) => (
                  <tr key={i}>
                    <td className="text-nowrap">{h.action}</td>
                    <td className="text-nowrap">{h.target}</td>
                    <td>{formatDate(h.date)}</td>
                    <td className="text-truncate" title={h.detail}>{JSON.stringify(h.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Liste des cartes */}
      <div className="card">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>cmu_number</th><th>Status</th><th>Motif</th><th>Date blocage</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.cmu_number}>
                  <td className="text-nowrap">{c.cmu_number}</td>
                  <td className="text-nowrap">
                    <span className={adge }>
                      {c.card_status}
                    </span>
                  </td>
                  <td className="text-truncate" title={c.notes}>{c.notes || '—'}</td>
                  <td>{formatDate(c.blocked_at)}</td>
                  <td>
                    <button className="btn btn-sm btn-outline-secondary">Détails</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SecurityCenter;
