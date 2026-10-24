/**
 * ImportControl.jsx — Importation contrôlée des adhérents et des photos (Module 2)
 *
 * Aucune donnée n'est écrite dans le registre opérationnel avant la
 * prévisualisation ET la validation explicite. Le parcours imposé est :
 *   1. Lot + fichier Excel + photos          (POST /api/imports puis /rows)
 *   2. Contrôles automatiques                (POST /api/imports/:id/controls)
 *   3. Prévisualisation et corrections       (GET/PATCH /api/imports/:id)
 *   4. Validation explicite                  (POST /api/imports/:id/validate)
 *   5. Intégration des seuls conformes       (POST /api/imports/:id/integrate)
 *   6. Rapport Excel de l'importation        (GET /api/imports/:id/report)
 *
 * La lecture du classeur se fait dans le navigateur (SheetJS), mais C'EST LE
 * SERVEUR qui contrôle la conformité : le navigateur ne décide jamais qu'un
 * dossier est valide.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { apiFetch } from '../utils/api';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Extrait les lignes utiles d'un classeur (en-têtes normalisés). */
function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const norm = (k) => String(k || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return json.map((row, idx) => {
    const get = (...keys) => {
      for (const k of keys) {
        for (const rawKey of Object.keys(row)) {
          if (norm(rawKey) === norm(k)) return String(row[rawKey]).trim();
        }
      }
      return '';
    };
    const cmu = get('code beneficiaire', 'code beneficiary', 'cmu', 'matricule', 'cmu_number', 'numero adherent');
    return {
      lineNumber: idx + 2, // ligne Excel (en-tête = 1)
      cmuNumber: cmu,
      lastName: get('nom', 'last name', 'nom de famille'),
      firstName: get('prenom', 'first name'),
      nin: get('nin', 'piece', 'numero piece', 'cni'),
      phone: get('telephone', 'phone', 'tel'),
      birthDate: get('date naissance', 'birth date', 'datenaissance'),
      gender: get('sexe', 'gender'),
      address: get('adresse', 'address', 'quartier'),
      photoKey: cmu ? cmu.replace(/\.\d+$/, '').toLowerCase() : '',
    };
  });
}

const LOT_STYLE = {
  BROUILLON: '#64748b', A_CONTROLE: '#2563eb', A_CORRIGER: '#b45309',
  VALIDE: '#059669', PARTIEL: '#7c3aed', INTEGRE: '#047857', ANNULE: '#b91c1c',
};
const ROW_STYLE = {
  CONFORME: { bg: 'rgba(5,150,105,.10)', color: '#047857' },
  A_CORRIGER: { bg: 'rgba(217,119,6,.12)', color: '#b45309' },
  CONFLIT: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c' },
  REJETE: { bg: 'rgba(220,38,38,.12)', color: '#b91c1c' },
  INTEGRE: { bg: 'rgba(37,99,235,.12)', color: '#1d4ed8' },
};

export default function ImportControl() {
  const [batches, setBatches] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [active, setActive] = useState(null); // { batch, summary, rows, pagination }
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null); // { type, text }
  const [photoCount, setPhotoCount] = useState(0);
  const [lotCode, setLotCode] = useState('');
  const [fileName, setFileName] = useState('');
  const [rowCount, setRowCount] = useState(0);
  const [rowsToSend, setRowsToSend] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [correction, setCorrection] = useState(null); // { row, cmuNumber, lastName, firstName, photoKey, nin }
  const fileRef = useRef(null);
  const photosRef = useRef(null);

  const loadBatches = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await apiFetch('/api/imports?limit=20');
      const payload = res && res.ok ? await res.json().catch(() => ({})) : {};
      setBatches(Array.isArray(payload.data) ? payload.data : []);
    } catch {
      setBatches([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const openBatch = useCallback(async (id, status = '') => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '100' });
      if (status) params.set('status', status);
      const res = await apiFetch(`/api/imports/${id}?${params.toString()}`);
      const payload = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      setActive(payload);
      setCorrection(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadBatches(), 0);
    return () => clearTimeout(id);
  }, [loadBatches]);

  /** Étape 1 — lecture locale du fichier Excel. */
  const onExcel = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const rows = parseWorkbook(buffer);
      setRowsToSend(rows);
      setRowCount(rows.length);
      setMessage({
        type: 'ok',
        text: `${rows.length} ligne(s) lues dans « ${file.name} ». Les contrôles seront exécutés côté serveur.`,
      });
    } catch {
      setRowsToSend([]);
      setRowCount(0);
      setMessage({ type: 'error', text: 'Fichier illisible. Utilisez un classeur .xlsx non protégé.' });
    }
  };

  const onPhotos = (e) => {
    setPhotoCount((e.target.files || []).length);
  };

  /** Étapes 1 & 2 — création du lot, dépôt des lignes, contrôles. */
  const startImport = async () => {
    if (rowsToSend.length === 0) {
      setMessage({ type: 'error', text: 'Sélectionnez d\'abord un fichier Excel contenant des adhérents.' });
      return;
    }
    setBusy('create');
    setMessage(null);
    try {
      const createRes = await apiFetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotCode, sourceFile: fileName, photoCount }),
      });
      const created = createRes ? await createRes.json().catch(() => ({})) : {};
      if (!createRes || !createRes.ok) throw new Error(created.error || 'Création du lot impossible.');

      // Dépôt par tranches : un fichier de plusieurs milliers de lignes ne doit
      // pas dépasser la limite de charge utile de l'API.
      const CHUNK = 400;
      for (let i = 0; i < rowsToSend.length; i += CHUNK) {
        const slice = rowsToSend.slice(i, i + CHUNK);
        // eslint-disable-next-line no-await-in-loop
        const res = await apiFetch(`/api/imports/${created.id}/rows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: slice }),
        });
        // eslint-disable-next-line no-await-in-loop
        const payload = res ? await res.json().catch(() => ({})) : {};
        if (!res || !res.ok) throw new Error(payload.error || 'Dépôt des lignes impossible.');
      }

      const ctrlRes = await apiFetch(`/api/imports/${created.id}/controls`, { method: 'POST' });
      const ctrl = ctrlRes ? await ctrlRes.json().catch(() => ({})) : {};
      if (!ctrlRes || !ctrlRes.ok) throw new Error(ctrl.error || 'Contrôle du lot impossible.');

      setMessage({
        type: 'ok',
        text: `Lot ${created.reference} contrôlé : ${ctrl.summary.conformes} conforme(s), ${ctrl.summary.aCorriger} à corriger, ${ctrl.summary.conflits} conflit(s).`,
      });
      setRowsToSend([]);
      setRowCount(0);
      setFileName('');
      setPhotoCount(0);
      if (fileRef.current) fileRef.current.value = '';
      if (photosRef.current) photosRef.current.value = '';
      await loadBatches();
      await openBatch(created.id);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const runAction = async (label, key, fn) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || `${label} impossible.` });
    } finally {
      setBusy('');
    }
  };

  const relaunchControls = (id) => runAction('Contrôle', 'controls', async () => {
    const res = await apiFetch(`/api/imports/${id}/controls`, { method: 'POST' });
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) throw new Error(payload.error || 'Contrôle impossible.');
    setMessage({ type: 'ok', text: `Contrôles relancés : ${payload.summary.conformes} conforme(s), ${payload.summary.aCorriger} à corriger.` });
    await openBatch(id, statusFilter);
    await loadBatches();
  });

  const validateBatch = (id) => runAction('Validation', 'validate', async () => {
    if (!window.confirm('Valider ce lot ? Seuls les dossiers conformes seront intégrables ; les autres resteront à corriger.')) return;
    const res = await apiFetch(`/api/imports/${id}/validate`, { method: 'POST' });
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) throw new Error(payload.error || 'Validation impossible.');
    setMessage({ type: 'ok', text: `Lot validé : ${payload.integrable} dossier(s) intégrable(s), ${payload.restantATraiter} restant à traiter.` });
    await openBatch(id, statusFilter);
    await loadBatches();
  });

  const integrateBatch = (id) => runAction('Intégration', 'integrate', async () => {
    if (!window.confirm('Intégrer MAINTENANT les dossiers conformes au registre opérationnel ?')) return;
    const res = await apiFetch(`/api/imports/${id}/integrate`, { method: 'POST' });
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) throw new Error(payload.error || 'Intégration impossible.');
    setMessage({
      type: 'ok',
      text: `Intégration terminée : ${payload.inserted} créé(s), ${payload.updated} mis à jour, ${payload.skipped} ignoré(s).`,
    });
    await openBatch(id, statusFilter);
    await loadBatches();
  });

  const downloadReport = async (id, reference) => {
    setBusy('report');
    setMessage(null);
    try {
      const res = await apiFetch(`/api/imports/${id}/report`);
      if (!res || !res.ok) throw new Error('Rapport indisponible.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-${reference}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setMessage({ type: 'ok', text: 'Rapport Excel téléchargé (6 feuilles).' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy('');
    }
  };

  const saveCorrection = () => runAction('Correction', 'correct', async () => {
    if (!correction || !active) return;
    const body = {
      cmuNumber: correction.cmuNumber,
      lastName: correction.lastName,
      firstName: correction.firstName,
      photoKey: correction.photoKey,
    };
    if (correction.nin) body.nin = correction.nin;
    const res = await apiFetch(`/api/imports/${active.batch.id}/rows/${correction.row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) throw new Error(payload.error || 'Correction impossible.');
    setMessage({
      type: 'ok',
      text: `Dossier corrigé et re-contrôlé : statut ${payload.row ? payload.row.status : '—'}.`,
    });
    setCorrection(null);
    await openBatch(active.batch.id, statusFilter);
  });

  const s = active && active.summary;
  const b = active && active.batch;

  return (
    <div className="container py-4">
      <h1 className="h4 mb-1">📥 Importation contrôlée des adhérents</h1>
      <p className="text-muted small mb-3">
        Aucun dossier n'entre dans le registre avant la prévisualisation et la validation explicite. Les photos sont
        associées par le <strong>matricule</strong> présent dans le nom du fichier, jamais par le seul nom ou prénom.
      </p>

      {/* 1 — Préparation */}
      <div className="card mb-3">
        <h5 className="mb-2">1 · Préparer un lot</h5>
        <div className="row g-2">
          <div className="col-md-3">
            <label className="form-label small text-muted">Référence de l'adhésion de masse (facultatif)</label>
            <input className="form-control form-control-sm" value={lotCode} onChange={(e) => setLotCode(e.target.value.toUpperCase())} placeholder="LOT-2026-01" />
          </div>
          <div className="col-md-4">
            <label className="form-label small text-muted">Fichier Excel des adhérents</label>
            <input ref={fileRef} type="file" className="form-control form-control-sm" accept=".xlsx,.xls,.csv" onChange={onExcel} />
          </div>
          <div className="col-md-3">
            <label className="form-label small text-muted">Photos (facultatif)</label>
            <input ref={photosRef} type="file" className="form-control form-control-sm" multiple accept="image/*" onChange={onPhotos} />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-primary btn-sm w-100" onClick={startImport} disabled={!!busy || rowCount === 0}>
              {busy === 'create' ? '⏳ Traitement…' : `Contrôler ${rowCount || ''}`}
            </button>
          </div>
        </div>
        <div className="small text-muted mt-2">
          {fileName ? <>Fichier : <strong>{fileName}</strong> · {rowCount} ligne(s) · {photoCount} photo(s)</> : 'Colonnes reconnues : code bénéficiaire, nom, prénom, NIN, téléphone, date de naissance, sexe, adresse.'}
        </div>
        {message && <div className={`alert ${message.type === 'ok' ? 'alert-success' : 'alert-danger'} mt-2 mb-0 small`}>{message.text}</div>}
      </div>

      {/* 2 — Lots */}
      <div className="card mb-3">
        <div className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">2 · Lots d'importation</h5>
          <button className="btn btn-sm btn-outline-secondary" onClick={loadBatches} disabled={listLoading}>🔄 Actualiser</button>
        </div>
        {listLoading ? (
          <div className="text-muted small mt-2">⏳ Chargement…</div>
        ) : batches.length === 0 ? (
          <div className="small text-muted mt-2">Aucun lot pour le moment.</div>
        ) : (
          <div className="table-responsive mt-2">
            <table className="table table-hover table-sm align-middle">
              <thead>
                <tr><th>Référence</th><th>MSD</th><th>Fichier</th><th>Lignes</th><th>Statut</th><th>Créé par</th><th>Créé le</th><th></th></tr>
              </thead>
              <tbody>
                {batches.map((x) => (
                  <tr key={x.id} style={{ cursor: 'pointer' }} onClick={() => openBatch(x.id)}>
                    <td className="fw-bold text-nowrap">{x.reference}</td>
                    <td>{x.msdCode || '—'}</td>
                    <td className="small text-truncate" style={{ maxWidth: 180 }}>{x.sourceFile || '—'}</td>
                    <td>{x.rowCount}</td>
                    <td>
                      <span className="badge" style={{ background: `${LOT_STYLE[x.status] || '#64748b'}20`, color: LOT_STYLE[x.status] || '#64748b', fontWeight: 800 }}>
                        {x.status}
                      </span>
                    </td>
                    <td className="small">{x.createdBy}</td>
                    <td className="small text-nowrap">{formatDate(x.createdAt)}</td>
                    <td><button className="btn btn-sm btn-outline-primary" onClick={(e) => { e.stopPropagation(); openBatch(x.id); }}>Ouvrir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3 — Prévisualisation */}
      {active && b && (
        <div className="card mb-3">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
            <h5 className="mb-0">3 · Prévisualisation — {b.reference}</h5>
            <div className="d-flex gap-2 flex-wrap">
              <button className="btn btn-sm btn-outline-primary" onClick={() => relaunchControls(b.id)} disabled={!!busy}>
                {busy === 'controls' ? '⏳' : '🔁'} Relancer les contrôles
              </button>
              <button className="btn btn-sm btn-outline-success" onClick={() => validateBatch(b.id)} disabled={!!busy || s.conformes === 0}>
                ✅ Valider le lot
              </button>
              <button className="btn btn-sm btn-success" onClick={() => integrateBatch(b.id)} disabled={!!busy || !b.validatedAt}>
                ⬆️ Intégrer les conformes
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => downloadReport(b.id, b.reference)} disabled={!!busy}>
                📊 Rapport Excel
              </button>
            </div>
          </div>
          <div className="row g-2 text-center mb-2">
            {[
              { label: 'Lignes', val: s.total, color: '#475569' },
              { label: 'Conformes', val: s.conformes, color: '#059669' },
              { label: 'À corriger', val: s.aCorriger, color: '#b45309' },
              { label: 'Conflits', val: s.conflits, color: '#b91c1c' },
              { label: 'Intégrés', val: s.integres, color: '#1d4ed8' },
              { label: 'Photos associées', val: `${s.photos.associees || 0}/${s.photos.total || 0}`, color: '#7c3aed' },
            ].map((k) => (
              <div className="col-6 col-md-2" key={k.label}>
                <div className="p-2 rounded" style={{ background: `${k.color}12` }}>
                  <div style={{ fontWeight: 900, color: k.color }}>{k.val}</div>
                  <div className="small text-muted">{k.label}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="d-flex gap-2 mb-2 flex-wrap">
            <select className="form-select form-select-sm" style={{ maxWidth: 220 }} value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); openBatch(b.id, e.target.value); }}>
              <option value="">Tous les dossiers</option>
              <option value="CONFORME">Conformes</option>
              <option value="A_CORRIGER">À corriger</option>
              <option value="CONFLIT">Conflits</option>
              <option value="INTEGRE">Intégrés</option>
            </select>
            {!b.validatedAt && <span className="badge bg-warning text-dark align-self-center">Validation explicite requise avant intégration</span>}
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle small">
              <thead>
                <tr><th>Ligne</th><th>Matricule</th><th>Nom</th><th>Prénom</th><th>Pièce</th><th>Photo</th><th>Statut</th><th>Anomalies</th><th></th></tr>
              </thead>
              <tbody>
                {(active.rows || []).map((r) => {
                  const st = ROW_STYLE[r.status] || ROW_STYLE.A_CORRIGER;
                  return (
                    <tr key={r.id}>
                      <td>{r.lineNumber}</td>
                      <td className="fw-bold text-nowrap">{r.cmuNumber || '—'}</td>
                      <td>{r.lastName || '—'}</td>
                      <td>{r.firstName || '—'}</td>
                      <td>{r.ninMasked || '—'}</td>
                      <td>{r.hasPhoto || r.photoKey ? `✅ ${r.photoKey || ''}` : '⛔'}</td>
                      <td><span className="badge" style={{ background: st.bg, color: st.color, fontWeight: 800 }}>{r.status}</span></td>
                      <td>
                        {(r.anomalies || []).length === 0 ? '—' : r.anomalies.map((a, i) => (
                          <div key={`${a.type}-${i}`}>
                            <strong>{a.type}</strong> — <span className="text-muted">{a.correction}</span>
                          </div>
                        ))}
                      </td>
                      <td>
                        {r.status !== 'INTEGRE' && (
                          <button className="btn btn-sm btn-outline-primary" onClick={() => setCorrection({
                            row: r, cmuNumber: r.cmuNumber || '', lastName: r.lastName || '',
                            firstName: r.firstName || '', photoKey: r.photoKey || '', nin: '',
                          })}>
                            Corriger
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {correction && (
            <div className="border rounded p-2" style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
              <div className="fw-bold small mb-2">Correction du dossier (ligne {correction.row.lineNumber}) — re-contrôle immédiat après enregistrement</div>
              <div className="row g-2">
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Matricule" value={correction.cmuNumber}
                    onChange={(e) => setCorrection({ ...correction, cmuNumber: e.target.value.toUpperCase() })} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Nom" value={correction.lastName}
                    onChange={(e) => setCorrection({ ...correction, lastName: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Prénom" value={correction.firstName}
                    onChange={(e) => setCorrection({ ...correction, firstName: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="Clé photo (matricule)" value={correction.photoKey}
                    onChange={(e) => setCorrection({ ...correction, photoKey: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <input className="form-control form-control-sm" placeholder="N° de pièce (si connu)" value={correction.nin}
                    onChange={(e) => setCorrection({ ...correction, nin: e.target.value })} />
                </div>
                <div className="col-md-9 d-flex gap-2">
                  <button className="btn btn-sm btn-primary" onClick={saveCorrection} disabled={!!busy}>
                    {busy === 'correct' ? '⏳' : '💾'} Enregistrer et re-contrôler
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => setCorrection(null)}>Annuler</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h5 className="mb-2">Règles appliquées</h5>
        <ul className="small text-muted mb-0">
          <li>Champs obligatoires : matricule, nom, prénom, date de naissance, photo.</li>
          <li>Doublons internes, doublons du registre et conflits d'identité (NIN déjà rattaché) détectés avant écriture.</li>
          <li>Photos ambigües signalées, jamais attribuées au hasard.</li>
          <li>Seuls les dossiers conformes sont intégrés ; les autres restent dans la zone temporaire jusqu'à correction.</li>
          <li>L'intégration est idempotente : la rejouer ne crée aucun doublon.</li>
        </ul>
      </div>
    </div>
  );
}
