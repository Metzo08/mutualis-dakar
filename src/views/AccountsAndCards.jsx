/**
 * AccountsAndCards.jsx — Gestion des comptes et des cartes d'assurés (Module 3)
 *
 * La page sépare STRICTEMENT quatre objets que la plateforme confondait :
 *   • le dossier d'adhésion (statut, MSD, cotisation) ;
 *   • le compte numérique (état, dernière connexion, réinitialisation) ;
 *   • la carte (statut serveur : active / bloquée / révoquée / remplacée) ;
 *   • les droits (couverture, forfait).
 * Bloquer une carte ne supprime jamais le compte : c'est le serveur qui fait
 * autorité, l'écran ne décide rien.
 *
 * Parcours :
 *   1. Recherche multicritère (matricule, nom, prénom, téléphone, pièce pour
 *      les agents habilités) — aucune liste déversée sur deux lettres.
 *   2. Fiche détaillée (GET /api/accounts/:cmu) : identité masquée, compte,
 *      carte, historique du cycle de vie et demandes en cours.
 *   3. Vérification d'identité en présence d'un agent avant toute action.
 *   4. Opérations autorisées par rôle (blocage, déblocage, révocation,
 *      destruction, remplacement, réinitialisation, modification de fiche) —
 *      chaque action passe par le serveur, avec motif et référence de demande.
 *   5. Tableau de suivi des demandes administratives (statuts, double
 *      validation).
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

const OPERATIONS = [
  'BLOCAGE_CARTE', 'DEBLOCAGE_CARTE', 'REVOCATION_CARTE', 'REMPLACEMENT_CARTE',
  'SUPPRESSION_CARTE', 'RESET_MOT_DE_PASSE', 'MODIFICATION_FICHE', 'CHANGEMENT_MSD', 'AUTRE',
];
const IDENTITY_METHODS = ['AGENT_HABILITE_PRESENT', 'PIECE_PLUS_VERIFICATION_MSD', 'TEMOIN_COMMUNAUTE', 'NON_VERIFIEE'];
const STATUSES = ['EN_ATTENTE', 'IDENTITE_A_VERIFIER', 'EN_COURS', 'EN_ATTENTE_VALIDATION', 'TRAITEE', 'REFUSEE', 'ANNULEE'];
const BLOCK_REASONS = ['PERTE', 'VOL', 'FRAUDE_SUSPECTEE', 'DEMANDE_ASSURE', 'ERREUR_ADMIN'];
const REVOKE_REASONS = ['FRAUDE_CONFIRMEE', 'DOUBLON', 'DOSSIER_CLOSE', 'DEMANDE_ASSURE', 'ERREUR_ADMIN'];
const DESTROY_REASONS = ['CARTE_ERRONEE', 'CARTE_NON_RECUPEREE', 'CARTE_ENDOMMAGEE', 'FIN_DE_VALIDITE', 'ERREUR_ADMIN'];

const STATUS_STYLE = {
  EN_ATTENTE: { bg: 'rgba(100,116,139,.12)', color: '#475569' },
  IDENTITE_A_VERIFIER: { bg: 'rgba(217,119,6,.12)', color: '#b45309' },
  EN_COURS: { bg: 'rgba(37,99,235,.12)', color: '#1d4ed8' },
  EN_ATTENTE_VALIDATION: { bg: 'rgba(124,58,237,.12)', color: '#6d28d9' },
  TRAITEE: { bg: 'rgba(5,150,105,.12)', color: '#047857' },
  REFUSEE: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c' },
  ANNULEE: { bg: 'rgba(100,116,139,.12)', color: '#64748b' },
};

const CARD_STYLE = {
  active: { bg: 'rgba(5,150,105,.12)', color: '#047857', label: 'Active' },
  blocked: { bg: 'rgba(217,119,6,.12)', color: '#b45309', label: 'Bloquée' },
  revoked: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c', label: 'Révoquée' },
};

function Badge({ status, style = STATUS_STYLE, label }) {
  const s = style[status] || { bg: 'rgba(100,116,139,.12)', color: '#475569' };
  return (
    <span className="badge" style={{ background: s.bg, color: s.color, fontSize: '.7rem', fontWeight: 800 }}>
      {label || (s && s.label) || status || '—'}
    </span>
  );
}

/** Saisie du motif et de la référence de demande, commune aux opérations. */
function ActionForm({ title, description, reasons, confirmLabel, danger, onSubmit, busy, children }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [requestRef, setRequestRef] = useState('');
  return (
    <form
      className="border rounded p-2 mb-2"
      style={{ background: danger ? 'rgba(220,38,38,.03)' : 'var(--bg-subtle, #f8fafc)' }}
      onSubmit={(e) => { e.preventDefault(); onSubmit({ reason, details, requestRef }); }}
    >
      <div className="fw-bold small mb-1" style={{ color: danger ? '#b91c1c' : 'inherit' }}>{title}</div>
      {description && <div className="small text-muted mb-2">{description}</div>}
      {children}
      <div className="row g-2">
        <div className="col-md-4">
          <select className="form-select form-select-sm" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="">— Motif —</option>
            {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <input className="form-control form-control-sm" placeholder="Référence de demande (REQ-…)" value={requestRef}
            onChange={(e) => setRequestRef(e.target.value.toUpperCase())} />
        </div>
        <div className="col-md-4">
          <input className="form-control form-control-sm" placeholder="Précisions (facultatif)" value={details}
            onChange={(e) => setDetails(e.target.value)} />
        </div>
      </div>
      <button className="btn btn-sm mt-2" disabled={busy || !reason}
        style={{ background: danger ? '#dc2626' : '#2563eb', color: '#fff', fontWeight: 700 }}>
        {busy ? '⏳ Traitement…' : confirmLabel}
      </button>
    </form>
  );
}

export default function AccountsAndCards() {
  // Recherche
  const [criteria, setCriteria] = useState({ cmuNumber: '', nom: '', prenom: '', telephone: '', nin: '', msdCode: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchNotice, setSearchNotice] = useState('');

  // Fiche
  const [cmu, setCmu] = useState('');
  const [fiche, setFiche] = useState(null);
  const [ficheLoading, setFicheLoading] = useState(false);
  const [ficheError, setFicheError] = useState('');

  // Vérification d'identité
  const [verif, setVerif] = useState({ method: '', declaredLastName: '', declaredFirstName: '', declaredNin: '' });
  const [verifResult, setVerifResult] = useState(null);
  const [verifBusy, setVerifBusy] = useState(false);

  // Opérations
  const [actionMsg, setActionMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [oneTimeCode, setOneTimeCode] = useState(null);
  const [editForm, setEditForm] = useState({ phone: '', address: '', reason: '' });
  const [newCard, setNewCard] = useState('');

  // Demandes administratives
  const [reqs, setReqs] = useState([]);
  const [reqFilters, setReqFilters] = useState({ status: '', type: '', page: 1 });
  const [reqsLoading, setReqsLoading] = useState(false);
  const [reqTotal, setReqTotal] = useState(0);
  const [reqMsg, setReqMsg] = useState(null);

  const loadRequests = useCallback(async (f = reqFilters) => {
    setReqsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(f.page || 1), limit: '15' });
      if (f.status) params.set('status', f.status);
      if (f.type) params.set('type', f.type);
      const res = await apiFetch(`/api/admin-requests?${params.toString()}`);
      const payload = res && res.ok ? await res.json().catch(() => ({})) : {};
      setReqs(Array.isArray(payload.data) ? payload.data : []);
      setReqTotal(payload.pagination?.total || 0);
    } catch {
      setReqs([]);
    } finally {
      setReqsLoading(false);
    }
  }, [reqFilters]);

  const loadFiche = useCallback(async (code) => {
    if (!code) return;
    setFicheLoading(true);
    setFicheError('');
    setActionMsg(null);
    setOneTimeCode(null);
    try {
      const res = await apiFetch(`/api/accounts/${encodeURIComponent(code)}`);
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setFiche(payload);
      setCmu(code);
      setVerifResult(null);
      setEditForm({ phone: '', address: '', reason: '' });
      setNewCard('');
    } catch (err) {
      setFiche(null);
      setFicheError(err.message || 'Fiche indisponible.');
    } finally {
      setFicheLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadRequests(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (e) => {
    if (e) e.preventDefault();
    setSearchError('');
    setSearchNotice('');
    setSearchLoading(true);
    try {
      const body = {};
      for (const [k, v] of Object.entries(criteria)) if (String(v || '').trim()) body[k] = String(v).trim();
      if (Object.keys(body).length === 0) throw new Error('Renseignez au moins un critère.');
      const res = await apiFetch('/api/accounts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setSearchResults(Array.isArray(payload.data) ? payload.data : []);
      setSearchNotice(payload.notice || '');
    } catch (err) {
      setSearchResults([]);
      setSearchError(err.message || 'Recherche impossible.');
    } finally {
      setSearched(true);
      setSearchLoading(false);
    }
  };

  const runVerify = async (e) => {
    e.preventDefault();
    setVerifResult(null);
    if (!verif.method || !verif.declaredLastName || !verif.declaredNin) {
      setVerifResult({ success: false, message: 'Choisissez la méthode et renseignez le nom et la pièce déclarés.' });
      return;
    }
    setVerifBusy(true);
    try {
      const res = await apiFetch(`/api/accounts/${encodeURIComponent(cmu)}/verify-identity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verif),
      });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setVerifResult(payload);
    } catch (err) {
      setVerifResult({ success: false, message: err.message });
    } finally {
      setVerifBusy(false);
    }
  };

  /** Exécute une opération serveur puis recharge la fiche et les demandes. */
  const perform = async (label, url, method, body) => {
    if (!window.confirm(`${label}\n\nCette opération est journalisée. Confirmer ?`)) return;
    setBusy(true);
    setActionMsg(null);
    setOneTimeCode(null);
    try {
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setActionMsg({ type: 'ok', text: payload.message || 'Opération effectuée.' });
      if (payload.oneTimeCode) setOneTimeCode({ code: payload.oneTimeCode, expiresAt: payload.expiresAt });
      await loadFiche(cmu);
      loadRequests({ ...reqFilters, page: 1 });
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message || 'Opération impossible.' });
    } finally {
      setBusy(false);
    }
  };

  const createRequest = async (e) => {
    e.preventDefault();
    setReqMsg(null);
    if (!cmu) return;
    try {
      // Toute opération sensible commence par une demande tracée.
      const res = await apiFetch('/api/admin-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmuNumber: cmu,
          operationType: e.target.opType.value,
          reason: e.target.reason.value,
          identityMethod: e.target.identityMethod.value || 'NON_VERIFIEE',
        }),
      });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setReqMsg({ type: 'ok', text: `Demande ${payload.reference} créée (${payload.status}). Utilisez cette référence dans l'action.` });
      e.target.reset();
      loadRequests({ ...reqFilters, page: 1 });
    } catch (err) {
      setReqMsg({ type: 'error', text: err.message || 'Création impossible.' });
    }
  };

  const transitionRequest = async (reference, newStatus) => {
    if (!window.confirm(`Faire passer la demande ${reference} à « ${newStatus} » ?`)) return;
    try {
      const res = await apiFetch(`/api/admin-requests/${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      loadRequests();
    } catch (err) {
      alert(err.message || 'Mise à jour impossible.');
    }
  };

  /* ────────────────────────────── Rendu ────────────────────────────── */
  const id = fiche?.identite;
  const carte = fiche?.carte;
  const compte = fiche?.compte;
  const droits = fiche?.droits;
  const cardStatus = carte?.status || 'active';

  return (
    <div className="container py-4">
      <h1 className="h4 mb-1">🗂️ Gestion des comptes et des cartes</h1>
      <p className="text-muted small mb-3">
        Le <strong>dossier</strong>, le <strong>compte</strong>, la <strong>carte</strong> et les <strong>droits</strong> sont
        des objets distincts. Bloquer une carte n'affecte ni le dossier ni le compte de l'assuré. Toute opération sensible
        est vérifiée et journalisée, côté serveur.
      </p>

      {/* 1 — Recherche */}
      <div className="card mb-3">
        <h5 className="mb-2">1 · Rechercher un assuré</h5>
        <form className="row g-2" onSubmit={search}>
          <div className="col-md-4">
            <input className="form-control form-control-sm" placeholder="Matricule (CMU-…)" value={criteria.cmuNumber}
              onChange={(e) => setCriteria({ ...criteria, cmuNumber: e.target.value.toUpperCase() })} />
          </div>
          <div className="col-md-3">
            <input className="form-control form-control-sm" placeholder="Nom" value={criteria.nom}
              onChange={(e) => setCriteria({ ...criteria, nom: e.target.value })} />
          </div>
          <div className="col-md-3">
            <input className="form-control form-control-sm" placeholder="Prénom" value={criteria.prenom}
              onChange={(e) => setCriteria({ ...criteria, prenom: e.target.value })} />
          </div>
          <div className="col-md-2">
            <input className="form-control form-control-sm" placeholder="Téléphone" value={criteria.telephone}
              onChange={(e) => setCriteria({ ...criteria, telephone: e.target.value })} />
          </div>
          <div className="col-md-4">
            <input className="form-control form-control-sm" placeholder="N° de pièce (agents habilités)" value={criteria.nin}
              onChange={(e) => setCriteria({ ...criteria, nin: e.target.value })} />
          </div>
          <div className="col-md-3">
            <input className="form-control form-control-sm" placeholder="MSD" value={criteria.msdCode}
              onChange={(e) => setCriteria({ ...criteria, msdCode: e.target.value.toUpperCase() })} />
          </div>
          <div className="col-md-5">
            <button className="btn btn-primary btn-sm w-100" disabled={searchLoading}>
              {searchLoading ? '⏳ Recherche…' : '🔍 Rechercher (critères combinables)'}
            </button>
          </div>
        </form>
        <div className="small text-muted mt-2">
          Une saisie partielle de nom ne renvoie qu'une page bornée : précisez le matricule avant toute opération.
          La recherche par pièce d'identité est limitée et journalisée.
        </div>
        {searchError && <div className="alert alert-danger mt-2 mb-0 small">{searchError}</div>}
        {searchNotice && <div className="alert alert-warning mt-2 mb-0 small">{searchNotice}</div>}
        {searched && !searchLoading && searchResults.length === 0 && !searchError && (
          <div className="alert alert-light mt-2 mb-0 small">Aucun assuré ne correspond à ces critères.</div>
        )}
        {searchResults.length > 0 && (
          <div className="table-responsive mt-2">
            <table className="table table-hover table-sm align-middle">
              <thead>
                <tr><th>Matricule</th><th>Nom</th><th>Prénom</th><th>MSD</th><th>Dossier</th><th>Carte</th><th>Pièce</th><th></th></tr>
              </thead>
              <tbody>
                {searchResults.map((b) => (
                  <tr key={b.cmuNumber || b.id} style={{ cursor: 'pointer' }} onClick={() => loadFiche(b.cmuNumber)}>
                    <td className="fw-bold">{b.cmuNumber}</td>
                    <td>{b.lastName || '—'}</td>
                    <td>{b.firstName || '—'}</td>
                    <td>{b.msdCode || '—'}</td>
                    <td className="small">{b.dossierStatus || '—'}</td>
                    <td><Badge status={b.cardStatus} style={CARD_STYLE} /></td>
                    <td className="small">{b.ninMasked || '—'}</td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-primary"
                        onClick={(e) => { e.stopPropagation(); loadFiche(b.cmuNumber); }}>
                        Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 2 — Fiche détaillée */}
      {ficheLoading && <div className="text-muted small mb-3">⏳ Chargement de la fiche…</div>}
      {ficheError && <div className="alert alert-danger small">{ficheError}</div>}

      {id && !ficheLoading && (
        <>
          <div className="card mb-3">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h5 className="mb-0">2 · Fiche de {id.cmuNumber}</h5>
              <div className="d-flex gap-2">
                <Badge status={cardStatus} style={CARD_STYLE} />
                {id.merged && <span className="badge bg-secondary">Fiche fusionnée</span>}
              </div>
            </div>
            <div className="row g-3 mt-1">
              <div className="col-md-4">
                <div className="fw-bold small text-uppercase text-muted mb-1">Identité</div>
                <div className="small">{[id.lastName, id.firstName].filter(Boolean).join(' ') || '—'}</div>
                <div className="small">Matricule : <strong>{id.cmuNumber}</strong></div>
                <div className="small">Pièce : {id.ninMasked || 'non renseignée'} <span className="text-muted">(masquée)</span></div>
                <div className="small">Téléphone : {id.phoneMasked || '—'}</div>
                <div className="small">MSD : {id.msdCode || '—'}{id.mutuelleName ? ` · ${id.mutuelleName}` : ''}</div>
                <div className="small">Département : {id.department || '—'}</div>
                <div className="small">Dossier : {id.dossierStatus || '—'} · créé le {formatDate(id.createdAt)}</div>
              </div>
              <div className="col-md-4">
                <div className="fw-bold small text-uppercase text-muted mb-1">Compte numérique</div>
                <div className="small">État : {compte.accountStatus}</div>
                <div className="small">Accès : {compte.accessStatus}</div>
                <div className="small">Créé le : {formatDate(compte.createdAt)}</div>
                <div className="small">Dernière connexion : {compte.lastLoginAt ? formatDate(compte.lastLoginAt) : 'non disponible'}</div>
                <div className="small">Réinitialisation en attente : {compte.passwordResetPending ? 'oui' : 'non'}</div>
                <div className="small">Sessions actives : {compte.activeSessions}</div>
              </div>
              <div className="col-md-4">
                <div className="fw-bold small text-uppercase text-muted mb-1">Carte</div>
                <div className="small">Statut serveur : <Badge status={cardStatus} style={CARD_STYLE} /></div>
                <div className="small">Bloquée le : {formatDate(carte.blockedAt)}{carte.blockedReason ? ` (${carte.blockedReason})` : ''}</div>
                <div className="small">Révoquée le : {formatDate(carte.revokedAt)}{carte.revokedReason ? ` (${carte.revokedReason})` : ''}</div>
                <div className="small">Remplacée par : {carte.replacedBy || '—'}</div>
                <div className="small">QR : {carte.qrState} · NFC : {carte.nfcState === 'NON_APPLICABLE' ? 'non applicable' : carte.nfcState}</div>
                <div className="small">Droits : {droits.statut || '—'} · couverture jusqu'au {formatDate(droits.coverageEnd)}</div>
              </div>
            </div>
          </div>

          {/* 3 — Vérification d'identité */}
          <div className="card mb-3">
            <h5 className="mb-2">3 · Vérification de l'identité (préalable obligatoire)</h5>
            <p className="small text-muted mb-2">
              Le nom et le numéro de pièce saisis par l'assuré ne suffisent pas : l'agent habilité atteste avoir contrôlé
              la pièce physique. Le serveur confronte la déclaration au dossier et journalise le résultat.
            </p>
            <form className="row g-2" onSubmit={runVerify}>
              <div className="col-md-3">
                <select className="form-select form-select-sm" value={verif.method}
                  onChange={(e) => setVerif({ ...verif, method: e.target.value })}>
                  <option value="">— Méthode —</option>
                  <option value="AGENT_HABILITE_PRESENT">Agent habilité en présence</option>
                  <option value="PIECE_PLUS_VERIFICATION_MSD">Pièce + vérification MSD</option>
                  <option value="TEMOIN_COMMUNAUTE">Témoin de la communauté</option>
                </select>
              </div>
              <div className="col-md-3">
                <input className="form-control form-control-sm" placeholder="Nom déclaré" value={verif.declaredLastName}
                  onChange={(e) => setVerif({ ...verif, declaredLastName: e.target.value })} />
              </div>
              <div className="col-md-3">
                <input className="form-control form-control-sm" placeholder="Prénom déclaré (facultatif)" value={verif.declaredFirstName}
                  onChange={(e) => setVerif({ ...verif, declaredFirstName: e.target.value })} />
              </div>
              <div className="col-md-3">
                <input className="form-control form-control-sm" placeholder="N° de pièce déclaré" value={verif.declaredNin}
                  onChange={(e) => setVerif({ ...verif, declaredNin: e.target.value })} />
              </div>
              <div className="col-12">
                <button className="btn btn-sm btn-outline-primary" disabled={verifBusy}>
                  {verifBusy ? '⏳ Vérification…' : '✅ Vérifier l\'identité'}
                </button>
              </div>
            </form>
            {verifResult && (
              <div className={`alert ${verifResult.success ? 'alert-success' : 'alert-danger'} mt-2 mb-0 small`}>
                {verifResult.message}
                {verifResult.success && verifResult.verifiedAt && (
                  <div className="mt-1">Vérifiée le {formatDate(verifResult.verifiedAt)} — mentionnez cette étape dans le motif.</div>
                )}
              </div>
            )}
          </div>

          {/* 4 — Opérations */}
          <div className="card mb-3">
            <h5 className="mb-2">4 · Opérations sur la carte et le compte</h5>
            {actionMsg && (
              <div className={`alert ${actionMsg.type === 'ok' ? 'alert-success' : 'alert-danger'} small`}>{actionMsg.text}</div>
            )}
            {oneTimeCode && (
              <div className="alert alert-warning small">
                <div className="fw-bold">Code de réinitialisation à usage unique — à remettre en main propre</div>
                <div className="mt-1"><code style={{ fontSize: '1.1rem' }}>{oneTimeCode.code}</code></div>
                <div>
                  Expire le {formatDate(oneTimeCode.expiresAt)}. Ne le conservez pas : le mot de passe de l'assuré
                  doit rester inconnu de l'agent.
                </div>
              </div>
            )}

            {cardStatus === 'active' && (
              <ActionForm
                title="🛑 Bloquer la carte"
                description="Refusée à la prochaine vérification serveur. Le dossier et le compte restent intacts. Une copie imprimée hors ligne ne peut pas être invalidée à distance."
                reasons={BLOCK_REASONS}
                confirmLabel="Bloquer la carte"
                danger
                busy={busy}
                onSubmit={({ reason, details, requestRef }) => perform(
                  `Bloquer la carte ${cmu} (motif ${reason})`,
                  `/api/cards/${encodeURIComponent(cmu)}/block`, 'POST', { reason, details, requestRef }
                )}
              />
            )}
            {cardStatus === 'blocked' && (
              <ActionForm
                title="🔓 Débloquer la carte (administrateur)"
                description="Rétablit la carte uniquement si le motif de blocage est levé (carte retrouvée, erreur administrative)."
                reasons={['CARTE_RETROUVEE', 'ERREUR_ADMIN', 'VERIFICATION_LEVEE', 'DEMANDE_ASSURE']}
                confirmLabel="Débloquer"
                busy={busy}
                onSubmit={({ reason, details, requestRef }) => perform(
                  `Débloquer la carte ${cmu}`,
                  `/api/cards/${encodeURIComponent(cmu)}/unblock`, 'POST', { reason, details, requestRef }
                )}
              />
            )}
            {cardStatus !== 'revoked' && (
              <>
                <ActionForm
                  title="⛔ Révoquer la carte"
                  description="Irrécable : l'identifiant et le QR ne sont plus acceptés comme carte active. L'historique est conservé."
                  reasons={REVOKE_REASONS}
                  confirmLabel="Révoquer définitivement"
                  danger
                  busy={busy}
                  onSubmit={({ reason, details, requestRef }) => perform(
                    `Révoquer la carte ${cmu} (motif ${reason})`,
                    `/api/cards/${encodeURIComponent(cmu)}/revoke`, 'POST', { reason, details, requestRef }
                  )}
                />
                <ActionForm
                  title="🔄 Remplacer par une nouvelle carte (administrateur)"
                  description="Révoque l'ancienne carte et relie la nouvelle. La nouvelle carte doit exister et être active."
                  reasons={['PERTE', 'VOL', 'ENDOMMAGEMENT', 'ERREUR_ADMIN']}
                  confirmLabel="Remplacer"
                  busy={busy}
                  onSubmit={({ reason, details, requestRef }) => {
                    if (!newCard.trim()) {
                      setActionMsg({ type: 'error', text: 'Saisissez le matricule de la nouvelle carte.' });
                      return;
                    }
                    perform(
                      `Remplacer ${cmu} par ${newCard.trim().toUpperCase()}`,
                      `/api/cards/${encodeURIComponent(cmu)}/replace`, 'POST',
                      { newCmuNumber: newCard.trim().toUpperCase(), reason, details, requestRef }
                    );
                  }}
                >
                  <input className="form-control form-control-sm mb-2" placeholder="Matricule de la NOUVELLE carte"
                    value={newCard} onChange={(e) => setNewCard(e.target.value.toUpperCase())} />
                </ActionForm>
                <ActionForm
                  title="🗑️ Détruire la carte (administrateur)"
                  description="Destruction logique : la carte sort du service définitivement. Le dossier et le compte de l'assuré sont CONSERVÉS."
                  reasons={DESTROY_REASONS}
                  confirmLabel="Détruire la carte"
                  danger
                  busy={busy}
                  onSubmit={({ reason, details, requestRef }) => perform(
                    `Détruire la carte ${cmu}`,
                    `/api/cards/${encodeURIComponent(cmu)}/destroy`, 'POST', { reason, details, requestRef }
                  )}
                />
              </>
            )}

            <div className="border rounded p-2 mb-2" style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
              <div className="fw-bold small mb-1">🔑 Réinitialiser le mot de passe</div>
              <div className="small text-muted mb-2">
                Aucun mot de passe n'est affiché, défini ni envoyé : un code à usage unique (15 minutes) est généré, les
                sessions sont révoquées, et l'agent ne lit jamais le nouveau mot de passe.
              </div>
              <button className="btn btn-sm btn-outline-warning" disabled={busy}
                onClick={() => perform(
                  `Réinitialiser le mot de passe du compte ${cmu}`,
                  `/api/accounts/${encodeURIComponent(cmu)}/reset-password`, 'POST', {}
                )}>
                Générer un code de réinitialisation
              </button>
            </div>

            <div className="border rounded p-2" style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
              <div className="fw-bold small mb-1">✏️ Modifier les informations administratives</div>
              <div className="small text-muted mb-2">
                Téléphone, adresse et motif obligatoire. Le nom, la pièce et la MSD ne sont modifiables que par un administrateur.
              </div>
              <div className="row g-2">
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Nouveau téléphone" value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="col-md-4">
                  <input className="form-control form-control-sm" placeholder="Nouvelle adresse" value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Motif (obligatoire)" value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <button className="btn btn-sm btn-outline-primary w-100"
                    disabled={busy || editForm.reason.trim().length < 5}
                    onClick={() => {
                      const body = { reason: editForm.reason.trim() };
                      if (editForm.phone.trim()) body.phone = editForm.phone.trim();
                      if (editForm.address.trim()) body.address = editForm.address.trim();
                      perform('Modifier la fiche', `/api/accounts/${encodeURIComponent(cmu)}`, 'PATCH', body);
                    }}>
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 5 — Historique */}
          <div className="card mb-3">
            <h5 className="mb-2">5 · Historique du dossier et de la carte</h5>
            {(fiche.historique.tool || []).length === 0 ? (
              <div className="small text-muted">Aucun événement enregistré.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm small">
                  <thead><tr><th>Date</th><th>Événement</th><th>Motif</th><th>Acteur</th><th>Demande</th></tr></thead>
                  <tbody>
                    {fiche.historique.tool.map((h, i) => (
                      <tr key={`${h.event}-${i}`}>
                        <td className="text-nowrap">{formatDate(h.date)}</td>
                        <td className="fw-bold">{h.event}</td>
                        <td>
                          {h.reason || '—'}
                          {h.details ? <div className="text-muted">{h.details}</div> : null}
                        </td>
                        <td>{h.actor || '—'}</td>
                        <td>{h.requestRef || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(fiche.historique.resetDemandes || []).length > 0 && (
              <div className="small text-muted">
                Réinitialisations : {fiche.historique.resetDemandes
                  .map((r) => `${formatDate(r.demandeLe)}${r.utilise ? ' (utilisée)' : ''}`)
                  .join(' · ')}
              </div>
            )}
          </div>

          {/* 6 — Créer une demande */}
          <div className="card mb-3">
            <h5 className="mb-2">6 · Créer une demande administrative</h5>
            <p className="small text-muted mb-2">
              Pour les opérations critiques, enregistrez d'abord la demande : sa référence (REQ-…) sera exigée par l'action
              correspondante et assure la double validation (identité vérifiée + agent habilité).
            </p>
            <form className="row g-2" onSubmit={createRequest}>
              <div className="col-md-4">
                <select name="opType" className="form-select form-select-sm" required defaultValue="">
                  <option value="" disabled>— Type d'opération —</option>
                  {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <select name="identityMethod" className="form-select form-select-sm" defaultValue="">
                  <option value="">— Vérification d'identité —</option>
                  {IDENTITY_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <input name="reason" className="form-control form-control-sm" placeholder="Motif détaillé (obligatoire)" required />
              </div>
              <div className="col-12">
                <button className="btn btn-primary btn-sm" disabled={busy}>Enregistrer la demande</button>
              </div>
            </form>
            {reqMsg && (
              <div className={`alert ${reqMsg.type === 'ok' ? 'alert-success' : 'alert-danger'} mt-2 mb-0 small`}>{reqMsg.text}</div>
            )}
          </div>
        </>
      )}

      {/* 7 — Tableau de suivi */}
      <div className="card">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h5 className="mb-0">7 · Suivi des demandes ({reqTotal})</h5>
          <div className="d-flex gap-2 flex-wrap">
            <select className="form-select form-select-sm" value={reqFilters.status}
              onChange={(e) => setReqFilters({ ...reqFilters, status: e.target.value })} style={{ maxWidth: 200 }}>
              <option value="">Tous les statuts</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="form-select form-select-sm" value={reqFilters.type}
              onChange={(e) => setReqFilters({ ...reqFilters, type: e.target.value })} style={{ maxWidth: 220 }}>
              <option value="">Tous les types</option>
              {OPERATIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button className="btn btn-sm btn-outline-primary" onClick={() => loadRequests({ ...reqFilters, page: 1 })}>Filtrer</button>
          </div>
        </div>
        {reqsLoading ? (
          <div className="text-muted small">⏳ Chargement…</div>
        ) : reqs.length === 0 ? (
          <div className="text-muted small">Aucune demande pour votre MSD.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-sm align-middle">
              <thead>
                <tr>
                  <th>Référence</th><th>Assuré</th><th>Opération</th><th>Motif</th><th>Statut</th>
                  <th>Identité</th><th>Agent</th><th>Créée le</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reqs.map((r) => {
                  const open = !['TRAITEE', 'REFUSEE', 'ANNULEE'].includes(r.status);
                  return (
                    <tr key={r.reference}>
                      <td className="text-nowrap fw-bold">{r.reference}</td>
                      <td>{r.cmu_number || '—'}</td>
                      <td className="small">{r.operation_type}</td>
                      <td className="small text-truncate" style={{ maxWidth: 200 }} title={r.reason}>{r.reason || '—'}</td>
                      <td><Badge status={r.status} /></td>
                      <td className="small">{r.identity_verified ? '✅ vérifiée' : '⚠️ non vérifiée'}</td>
                      <td className="small">{r.requested_by}</td>
                      <td className="text-nowrap small">{formatDate(r.created_at)}</td>
                      <td className="text-nowrap">
                        {open ? (
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline-primary" title="Démarrer" onClick={() => transitionRequest(r.reference, 'EN_COURS')}>▶</button>
                            <button className="btn btn-sm btn-outline-secondary" title="Attente de double validation" onClick={() => transitionRequest(r.reference, 'EN_ATTENTE_VALIDATION')}>⏸</button>
                            <button className="btn btn-sm btn-outline-success" title="Traitée" onClick={() => transitionRequest(r.reference, 'TRAITEE')}>✔</button>
                            <button className="btn btn-sm btn-outline-danger" title="Refuser" onClick={() => transitionRequest(r.reference, 'REFUSEE')}>✖</button>
                          </div>
                        ) : (
                          <span className="small text-muted">{r.resolved_by ? `clôturée par ${r.resolved_by}` : 'clôturée'}</span>
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
