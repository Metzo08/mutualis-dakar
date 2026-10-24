/**
 * SecurityCenter.jsx — Centre de sécurité et surveillance (Module 4)
 *
 * Route frontend : 'security-center'
 * Routes backend :
 *   GET   /api/security/overview            — indicateurs + état des contrôles
 *   GET   /api/security/alerts              — alertes déduites des données
 *   PATCH /api/security/alerts/:id          — traiter une alerte (acquitter/clôturer)
 *   GET   /api/security/sessions            — sessions actives (jamais de jeton)
 *   DELETE /api/security/sessions/:id       — révoquer une session suspecte
 *   GET   /api/security/privileged          — revue des comptes privilégiés
 *   GET   /api/security/audit               — journal d'audit paginé
 *   GET   /api/security/export              — rapport Excel de sécurité
 *   POST  /api/cards/:cmu/block|unblock|revoke|replace — opérations de carte
 *   POST  /api/accounts/:cmu/reset-password — code à usage unique (15 min)
 *
 * Le serveur est l'autorité : le statut de la carte est vérifié en base à
 * chaque action, jamais dans l'interface. Aucun secret n'est affiché.
 * Aucune alerte ne supprime automatiquement un compte ou une carte.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_BADGE = {
  active: { bg: 'rgba(5,150,105,.12)', color: '#047857', label: 'Active' },
  blocked: { bg: 'rgba(217,119,6,.12)', color: '#b45309', label: 'Bloquée' },
  revoked: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c', label: 'Révoquée' },
};

const SEVERITY = {
  CRITICAL: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c', label: 'Critique' },
  WARNING: { bg: 'rgba(217,119,6,.12)', color: '#b45309', label: 'Avertissement' },
  INFO: { bg: 'rgba(37,99,235,.12)', color: '#1d4ed8', label: 'Information' },
};

const ALERT_STATUS = {
  OUVERTE: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c' },
  ACQUITTEE: { bg: 'rgba(217,119,6,.12)', color: '#b45309' },
  CLOTUREE: { bg: 'rgba(5,150,105,.12)', color: '#047857' },
};

const CONTROL_STATUS = {
  OK: '#047857',
  PARTIEL: '#b45309',
  A_VERIFIER: '#b45309',
  NON_VERIFIE: '#64748b',
  NON_DISPONIBLE: '#b91c1c',
};

function Chip({ style, children }) {
  const s = style || { bg: 'rgba(100,116,139,.12)', color: '#475569' };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, fontSize: '.7rem', fontWeight: 800 }}>
      {children}
    </span>
  );
}

export default function SecurityCenter() { // props historiques conservées par App.jsx
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [audit, setAudit] = useState({ data: [], pagination: null });
  const [auditFilters, setAuditFilters] = useState({ action: '', actor: '', page: 1 });
  const [sessions, setSessions] = useState({ data: [], pagination: null, error: '' });
  const [privileged, setPrivileged] = useState({ data: [], error: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadOverview = useCallback(async () => {
    try {
      const res = await apiFetch('/api/security/overview');
      const payload = res && res.ok ? await res.json().catch(() => ({})) : {};
      if (res && res.ok) setOverview(payload);
      else setError(payload.error || 'Indicateurs indisponibles.');
    } catch {
      setError('Indicateurs indisponibles.');
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await apiFetch('/api/security/alerts');
      const payload = res && res.ok ? await res.json().catch(() => ({})) : {};
      setAlerts(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setAlerts([]);
    }
  }, []);

  const loadAudit = useCallback(async (filters = { action: '', actor: '', page: 1 }) => {
    try {
      const params = new URLSearchParams({ page: String(filters.page || 1), limit: '20' });
      if (filters.action) params.set('action', filters.action);
      if (filters.actor) params.set('actor', filters.actor);
      const res = await apiFetch(`/api/security/audit?${params.toString()}`);
      const payload = res && res.ok ? await res.json().catch(() => ({})) : {};
      setAudit({ data: Array.isArray(payload.data) ? payload.data : [], pagination: payload.pagination || null });
    } catch {
      setAudit({ data: [], pagination: null });
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const res = await apiFetch('/api/security/sessions?limit=50');
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) {
        setSessions({ data: [], pagination: null, error: payload.error || 'Sessions indisponibles (réservé aux administrateurs).' });
        return;
      }
      setSessions({ data: Array.isArray(payload.data) ? payload.data : [], pagination: payload.pagination || null, error: '' });
    } catch {
      setSessions({ data: [], pagination: null, error: 'Sessions indisponibles.' });
    }
  }, []);

  const loadPrivileged = useCallback(async () => {
    try {
      const res = await apiFetch('/api/security/privileged');
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) {
        setPrivileged({ data: [], error: payload.error || 'Revue réservée aux administrateurs.' });
        return;
      }
      setPrivileged({ data: Array.isArray(payload.data) ? payload.data : [], error: '' });
    } catch {
      setPrivileged({ data: [], error: 'Comptes privilégiés indisponibles.' });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      await Promise.all([loadOverview(), loadAlerts(), loadAudit(), loadSessions(), loadPrivileged()]);
      setLoading(false);
    }, 0);
    return () => clearTimeout(id);
  }, [loadOverview, loadAlerts, loadAudit, loadSessions, loadPrivileged]);

  const handleAlert = async (id, status) => {
    let note = '';
    if (status === 'CLOTUREE') {
      note = window.prompt('Note de clôture (obligatoire, 5 caractères minimum) :') || '';
      if (note.trim().length < 5) {
        setNotice({ type: 'error', text: 'Clôture annulée : la note est obligatoire.' });
        return;
      }
    } else if (!window.confirm(`Marquer cette alerte comme « ${status} » ? L'action est journalisée.`)) {
      return;
    }
    setBusy(`alert-${id}`);
    setNotice(null);
    try {
      const res = await apiFetch(`/api/security/alerts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setNotice({ type: 'ok', text: `Alerte marquée « ${status} ».` });
      await loadAlerts();
      await loadAudit({ ...auditFilters, page: 1 });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const revokeSession = async (id) => {
    if (!window.confirm('Révoquer cette session ? Le porteur devra se reconnecter. Action journalisée.')) return;
    setBusy(`session-${id}`);
    try {
      const res = await apiFetch(`/api/security/sessions/${id}`, { method: 'DELETE' });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setNotice({ type: 'ok', text: 'Session révoquée.' });
      await loadSessions();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const exportSecurity = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const res = await apiFetch('/api/security/export');
      if (!res || !res.ok) throw new Error('Rapport de sécurité indisponible.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securite-mutualis-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setNotice({ type: 'ok', text: 'Rapport de sécurité téléchargé.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5">
        <div className="card text-center fade-in-up" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '600px' }}>
          <div className="spinner-border text-primary" role="status" />
          <p className="mt-2">Chargement du centre de sécurité…</p>
        </div>
      </div>
    );
  }

  const s = overview ? overview.stats : {};
  const controls = (overview && overview.controls) || [];

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h1 className="h4 mb-1">🛡️ Centre de sécurité et surveillance</h1>
          <p className="text-muted small mb-0">
            Périmètre : <strong>{overview ? overview.scope : '—'}</strong> · fenêtre d'analyse {overview ? overview.windowMinutes : '—'} min ·
            chaque indicateur est calculé sur des données réelles ; aucun « 100 % sécurisé » n'est affiché.
          </p>
        </div>
        <button className="btn btn-sm btn-outline-danger" onClick={exportSecurity} disabled={exporting}>
          {exporting ? '⏳ Génération…' : '📊 Rapport Excel de sécurité'}
        </button>
      </div>

      {error && <div className="alert alert-danger small">{error}</div>}
      {notice && <div className={`alert ${notice.type === 'ok' ? 'alert-success' : 'alert-danger'} small`}>{notice.text}</div>}

      {/* 4.1 — Indicateurs */}
      <div className="card mb-3">
        <h5 className="mb-3">📊 Indicateurs de sécurité</h5>
        <div className="row g-2 text-center">
          {[
            { label: 'Comptes actifs', val: s.comptesActifs, color: '#047857' },
            { label: 'Comptes désactivés/bloqués', val: s.comptesDesactives, color: '#b91c1c' },
            { label: 'Comptes verrouillés', val: s.comptesVerrouilles, color: '#b45309' },
            { label: 'Sessions actives', val: s.sessionsActives, color: '#1d4ed8' },
            { label: 'Connexions échouées (fenêtre)', val: s.tentativesEchouees, color: '#b45309' },
            { label: 'Réinitialisations MDP (7 j)', val: s.reinitialisationsMdp7j, color: '#6d28d9' },
            { label: 'Cartes actives', val: s.cartesActives, color: '#047857' },
            { label: 'Cartes bloquées', val: s.cartesBloquees, color: '#b45309' },
            { label: 'Cartes révoquées', val: s.cartesRevoquees, color: '#b91c1c' },
            { label: 'Cartes remplacées', val: s.cartesRemplacees, color: '#475569' },
            { label: 'Demandes en attente', val: s.demandesEnAttente, color: '#6d28d9' },
            { label: 'Événements critiques (24 h)', val: s.evenementsCritiques, color: '#b91c1c' },
          ].map((k) => (
            <div className="col-6 col-md-3 col-lg-2" key={k.label}>
              <div className="p-2 rounded h-100" style={{ background: `${k.color}0d` }}>
                <div style={{ fontWeight: 900, fontSize: '1.15rem', color: k.color }}>{k.val ?? 0}</div>
                <div className="small text-muted">{k.label}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="row g-2 mt-2">
          {controls.map((c) => (
            <div className="col-md-6" key={c.id}>
              <div className="d-flex gap-2 align-items-start p-2 rounded" style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
                <span style={{ color: CONTROL_STATUS[c.status] || '#475569', fontWeight: 900 }}>●</span>
                <div>
                  <div className="small fw-bold">
                    {c.label}{' '}
                    <span className="badge" style={{ background: `${CONTROL_STATUS[c.status] || '#475569'}18`, color: CONTROL_STATUS[c.status] || '#475569' }}>
                      {c.status}
                    </span>
                  </div>
                  <div className="small text-muted">{c.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4.3 — Alertes */}
      <div className="card mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0">🚨 Alertes de sécurité ({alerts.filter((a) => a.status === 'OUVERTE').length} ouverte(s))</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadAlerts}>🔄 Recalculer</button>
        </div>
        {alerts.length === 0 ? (
          <div className="small text-muted mt-2">
            Aucune alerte ne dépasse les seuils configurés. Cela ne signifie pas « aucune vulnérabilité » : les contrôles
            non encore effectués sont indiqués comme tels ci-dessus.
          </div>
        ) : (
          <div className="table-responsive mt-2">
            <table className="table table-sm align-middle small">
              <thead>
                <tr><th>Gravité</th><th>Catégorie</th><th>Alerte</th><th>Description</th><th>Statut</th><th>Action corrective</th><th>Traitement</th></tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td><Chip style={SEVERITY[a.severity]}>{SEVERITY[a.severity] ? SEVERITY[a.severity].label : a.severity}</Chip></td>
                    <td>{a.category}</td>
                    <td className="fw-bold">{a.title}</td>
                    <td>{a.description}</td>
                    <td><Chip style={ALERT_STATUS[a.status]}>{a.status}</Chip></td>
                    <td className="text-muted">{a.correctiveAction}</td>
                    <td className="text-nowrap">
                      {a.status !== 'CLOTUREE' && (
                        <div className="btn-group">
                          {a.status === 'OUVERTE' && (
                            <button className="btn btn-sm btn-outline-warning" disabled={!!busy}
                              onClick={() => handleAlert(a.id, 'ACQUITTEE')}>Acquitter</button>
                          )}
                          <button className="btn btn-sm btn-outline-success" disabled={!!busy}
                            onClick={() => handleAlert(a.id, 'CLOTUREE')}>Clôturer</button>
                        </div>
                      )}
                      {a.status === 'CLOTUREE' && <span className="text-muted">{a.handledBy || ''} {a.handledAt ? formatDate(a.handledAt) : ''}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4.5 — Sessions */}
      <div className="card mb-3">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h5 className="mb-0">🔐 Sessions actives</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadSessions}>🔄 Actualiser</button>
        </div>
        {sessions.error ? (
          <div className="small text-muted mt-2">{sessions.error}</div>
        ) : sessions.data.length === 0 ? (
          <div className="small text-muted mt-2">Aucune session active enregistrée.</div>
        ) : (
          <div className="table-responsive mt-2">
            <table className="table table-sm align-middle small">
              <thead>
                <tr><th>Utilisateur</th><th>Rôle</th><th>MSD</th><th>Type</th><th>Ouverte le</th><th>Expire le</th><th>Dernier accès</th><th>Empreinte</th><th></th></tr>
              </thead>
              <tbody>
                {sessions.data.map((x) => (
                  <tr key={x.id}>
                    <td className="fw-bold">{x.utilisateur}</td>
                    <td>{x.role}</td>
                    <td>{x.msdCode || '—'}</td>
                    <td>{x.type}</td>
                    <td className="text-nowrap">{formatDate(x.ouverteLe)}</td>
                    <td className="text-nowrap">{formatDate(x.expireLe)}</td>
                    <td>{x.dernierAcces ? formatDate(x.dernierAcces) : 'non suivi'}</td>
                    <td><code>{x.empreinte}…</code></td>
                    <td>
                      <button className="btn btn-sm btn-outline-danger" disabled={!!busy}
                        onClick={() => revokeSession(x.id)}>Révoquer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4.4 — Comptes privilégiés */}
      <div className="card mb-3">
        <h5 className="mb-2">👑 Revue des comptes privilégiés</h5>
        {privileged.error ? (
          <div className="small text-muted">{privileged.error}</div>
        ) : privileged.data.length === 0 ? (
          <div className="small text-muted">Aucun compte privilégié dans votre périmètre.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle small">
              <thead>
                <tr><th>Utilisateur</th><th>Nom</th><th>Rôle</th><th>MSD</th><th>Statut</th><th>MFA disponible</th><th>Dernière activité</th><th>Revue</th></tr>
              </thead>
              <tbody>
                {privileged.data.map((p) => (
                  <tr key={p.id}>
                    <td className="fw-bold">{p.utilisateur}</td>
                    <td>{p.nom || '—'}</td>
                    <td>{p.role}</td>
                    <td>{p.msdCode || '—'}</td>
                    <td>{p.statut}</td>
                    <td>{p.mfaDisponible ? '✅ canal e-mail configuré' : '❌ aucun canal'}</td>
                    <td>{p.derniereActivite ? formatDate(p.derniereActivite) : 'jamais'}</td>
                    <td>{p.revueRecommandee ? <Chip style={SEVERITY.WARNING}>inactivité à revoir</Chip> : 'à jour'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="small text-muted">
          La revue de compte ne modifie rien automatiquement : désactiver un accès reste une décision humaine journalisée.
        </div>
      </div>

      {/* 4.2 — Journal d'audit */}
      <div className="card">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h5 className="mb-0">📜 Journal d'audit</h5>
          <div className="d-flex gap-2 flex-wrap">
            <input className="form-control form-control-sm" placeholder="Filtrer par action" value={auditFilters.action}
              onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })} style={{ maxWidth: 180 }} />
            <input className="form-control form-control-sm" placeholder="Filtrer par acteur" value={auditFilters.actor}
              onChange={(e) => setAuditFilters({ ...auditFilters, actor: e.target.value })} style={{ maxWidth: 160 }} />
            <button className="btn btn-sm btn-outline-primary"
              onClick={() => { const f = { ...auditFilters, page: 1 }; setAuditFilters(f); loadAudit(f); }}>
              Filtrer
            </button>
          </div>
        </div>
        {audit.data.length === 0 ? (
          <div className="text-muted small">Aucun événement à afficher.</div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-sm small">
                <thead><tr><th>Date</th><th>Action</th><th>Acteur</th><th>Détails</th></tr></thead>
                <tbody>
                  {audit.data.map((ev) => (
                    <tr key={ev.id}>
                      <td className="text-nowrap">{formatDate(ev.created_at)}</td>
                      <td className="text-nowrap fw-bold">{ev.action}</td>
                      <td className="text-nowrap">{ev.actor || '—'}</td>
                      <td className="text-truncate" style={{ maxWidth: 420 }} title={ev.details}>{ev.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {audit.pagination && (
              <div className="d-flex justify-content-between align-items-center small">
                <span className="text-muted">{audit.pagination.total} événement(s)</span>
                <div className="btn-group">
                  <button className="btn btn-sm btn-outline-secondary" disabled={!audit.pagination.hasPrev}
                    onClick={() => { const f = { ...auditFilters, page: auditFilters.page - 1 }; setAuditFilters(f); loadAudit(f); }}>
                    ← Précédent
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" disabled={!audit.pagination.hasNext}
                    onClick={() => { const f = { ...auditFilters, page: auditFilters.page + 1 }; setAuditFilters(f); loadAudit(f); }}>
                    Suivant →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
