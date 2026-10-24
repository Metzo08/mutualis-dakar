/**
 * ExcelReports.jsx — Rapports Excel (Module 5 du cahier des charges)
 *
 * Le format XLSX est le format de référence des rapports opérationnels et
 * financiers : tout est généré CÔTÉ SERVEUR (calculs vérifiés, permissions
 * appliquées, export journalisé). Aucun fichier n'est servi depuis une URL
 * publique : chaque téléchargement repasse par l'authentification.
 *
 *   1. Rapports historiques   /api/excel/report/:type
 *   2. Studio Cartes complet  /api/excel/studio/:scope   (7 feuilles)
 *   3. Rapport par MSD        /api/excel/msd/:code       (5 feuilles)
 *   4. Gestion des cartes     /api/excel/cards-report    (4 feuilles)
 *   5. Sécurité               /api/security/export       (5 feuilles)
 *   6. Importation            /api/imports/:id/report    (6 feuilles)
 */
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const REPORT_TYPES = [
  { value: 'beneficiaries', label: '📋 Bénéficiaires (champs principaux)' },
  { value: 'cards', label: '🃏 Cartes (état courant)' },
  { value: 'production', label: '🏭 Production (cartes délivrées)' },
  { value: 'audit', label: '📜 Audit (journal récent)' },
  { value: 'studio', label: '🪪 Studio Cartes (synthèse historique)' },
  { value: 'lifecycle', label: '🔁 Cycle de vie des cartes' },
  { value: 'security', label: '🛡️ Sécurité (événements)' },
];

/** Déclenche le téléchargement d'un blob .xlsx. */
function saveBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export default function ExcelReports() { // props historiques conservées par App.jsx
  const [type, setType] = useState('beneficiaries');
  const [msdCode, setMsdCode] = useState('');
  const [imports, setImports] = useState([]);
  const [importId, setImportId] = useState('');
  const [downloading, setDownloading] = useState('');
  const [status, setStatus] = useState(null); // { type: 'ok'|'error', text }

  const loadImports = useCallback(async () => {
    try {
      const res = await apiFetch('/api/imports?limit=25');
      const payload = res && res.ok ? await res.json().catch(() => ({})) : {};
      const rows = Array.isArray(payload.data) ? payload.data : [];
      setImports(rows);
      if (rows.length > 0) setImportId((prev) => prev || String(rows[0].id));
    } catch {
      setImports([]);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(loadImports, 0);
    return () => clearTimeout(id);
  }, [loadImports]);

  const download = async (key, url, fileName) => {
    setDownloading(key);
    setStatus(null);
    try {
      const res = await apiFetch(url);
      if (!res || !res.ok) {
        const payload = res ? await res.json().catch(() => ({})) : {};
        throw new Error(payload.error || `Erreur ${res ? res.status : 'réseau'}`);
      }
      const blob = await res.blob();
      saveBlob(blob, fileName);
      setStatus({ type: 'ok', text: `Fichier « ${fileName} » téléchargé. Ouvrez-le avec Excel ou LibreOffice.` });
    } catch (err) {
      setStatus({ type: 'error', text: err.message || 'Génération impossible.' });
    } finally {
      setDownloading('');
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const scope = (msdCode || 'national').toUpperCase();

  return (
    <div className="container py-4">
      <h1 className="h4 mb-1">📊 Rapports Excel</h1>
      <p className="text-muted small mb-3">
        Tous les rapports sont générés côté serveur, filtrés selon votre périmètre MSD et journalisés.
        Le format <strong>.xlsx</strong> est le format de référence ; les montants sont calculés et vérifiés par le serveur.
      </p>

      {status && (
        <div className={`alert ${status.type === 'ok' ? 'alert-success' : 'alert-danger'} small`}>{status.text}</div>
      )}

      <div className="row g-3">
        {/* 1 — Rapports historiques */}
        <div className="col-md-6">
          <div className="card h-100">
            <h5 className="mb-2">Rapports de données</h5>
            <label className="form-label small text-muted">Type de rapport</label>
            <select className="form-select form-select-sm mb-2" value={type} onChange={(e) => setType(e.target.value)}>
              {REPORT_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" disabled={!!downloading}
              onClick={() => download('type', `/api/excel/report/${type}`, `mutualis-${type}-${stamp}.xlsx`)}>
              {downloading === 'type' ? '⏳ Génération…' : '⬇️ Télécharger le .xlsx'}
            </button>
          </div>
        </div>

        {/* 2 — Studio Cartes */}
        <div className="col-md-6">
          <div className="card h-100">
            <h5 className="mb-2">Studio Cartes — synthèse complète</h5>
            <p className="small text-muted mb-2">
              7 feuilles : Synthèse, Régions, Départements, MSD, Adhésions de masse, Production des cartes,
              Revenus Sen-E-Carte.
            </p>
            <label className="form-label small text-muted">Périmètre (vide = national / votre MSD)</label>
            <input className="form-control form-control-sm mb-2" placeholder="Code MSD (ex. DKR)" value={msdCode}
              onChange={(e) => setMsdCode(e.target.value.toUpperCase())} />
            <button className="btn btn-outline-primary btn-sm" disabled={!!downloading}
              onClick={() => download('studio', `/api/excel/studio/${encodeURIComponent(scope)}`, `studio-cartes-${scope}-${stamp}.xlsx`)}>
              {downloading === 'studio' ? '⏳ Génération…' : '⬇️ Rapport Studio Cartes'}
            </button>
          </div>
        </div>

        {/* 3 — Rapport par MSD */}
        <div className="col-md-6">
          <div className="card h-100">
            <h5 className="mb-2">Rapport d'une MSD</h5>
            <p className="small text-muted mb-2">
              5 feuilles : Synthèse, Adhésions de masse, Cartes imprimées, Revenus, Dossiers restant à traiter.
            </p>
            <label className="form-label small text-muted">Code MSD</label>
            <input className="form-control form-control-sm mb-2" placeholder="Ex. DKR" value={msdCode}
              onChange={(e) => setMsdCode(e.target.value.toUpperCase())} />
            <button className="btn btn-outline-primary btn-sm"
              disabled={!!downloading || !msdCode.trim()}
              onClick={() => download('msd', `/api/excel/msd/${encodeURIComponent(msdCode.trim())}`, `msd-${msdCode.trim()}-${stamp}.xlsx`)}>
              {downloading === 'msd' ? '⏳ Génération…' : '⬇️ Rapport MSD'}
            </button>
          </div>
        </div>

        {/* 4 — Rapport de gestion des cartes */}
        <div className="col-md-6">
          <div className="card h-100">
            <h5 className="mb-2">Gestion des cartes</h5>
            <p className="small text-muted mb-2">
              4 feuilles : Synthèse, Cartes (statuts, blocages, révocations, remplacements), Opérations carte,
              Réinitialisations.
            </p>
            <button className="btn btn-outline-primary btn-sm" disabled={!!downloading}
              onClick={() => download('cards', '/api/excel/cards-report', `gestion-cartes-${stamp}.xlsx`)}>
              {downloading === 'cards' ? '⏳ Génération…' : '⬇️ Rapport de gestion des cartes'}
            </button>
          </div>
        </div>

        {/* 5 — Rapport de sécurité */}
        <div className="col-md-6">
          <div className="card h-100">
            <h5 className="mb-2">Rapport de sécurité</h5>
            <p className="small text-muted mb-2">
              5 feuilles : Synthèse, Alertes, Événements d'audit, Cartes bloquées/révoquées, Contrôles.
              Jamais de secret, de jeton ni de mot de passe.
            </p>
            <button className="btn btn-outline-danger btn-sm" disabled={!!downloading}
              onClick={() => download('security', '/api/security/export', `securite-mutualis-${stamp}.xlsx`)}>
              {downloading === 'security' ? '⏳ Génération…' : '⬇️ Rapport de sécurité'}
            </button>
          </div>
        </div>

        {/* 6 — Rapport d'importation */}
        <div className="col-md-6">
          <div className="card h-100">
            <h5 className="mb-2">Rapport d'importation</h5>
            <p className="small text-muted mb-2">
              6 feuilles : Résumé, Dossiers conformes, Anomalies, Photos non associées, Doublons et conflits,
              Résultat de l'intégration.
            </p>
            <label className="form-label small text-muted">Lot d'importation</label>
            <select className="form-select form-select-sm mb-2" value={importId} onChange={(e) => setImportId(e.target.value)}>
              <option value="">— Sélectionner un lot —</option>
              {imports.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.reference} · {x.status}{x.createdAt ? ` · ${new Date(x.createdAt).toLocaleDateString('fr-FR')}` : ''}
                </option>
              ))}
            </select>
            <button className="btn btn-outline-primary btn-sm" disabled={!!downloading || !importId}
              onClick={() => {
                const lot = imports.find((x) => String(x.id) === String(importId));
                download('import', `/api/imports/${importId}/report`, `import-${lot ? lot.reference : importId}.xlsx`);
              }}>
              {downloading === 'import' ? '⏳ Génération…' : '⬇️ Rapport d\'importation'}
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <h5 className="mb-2">Bon à savoir</h5>
        <ul className="small text-muted mb-0">
          <li>Les rapports sont cloisonnés par MSD : un agent ne télécharge que son périmètre.</li>
          <li>Chaque export est journalisé (acteur, référence du rapport, date).</li>
          <li>Les montants Sen-E-Carte proviennent d'événements de production figés : un changement de tarif ne réécrit pas le passé.</li>
          <li>Les cellules issues de saisies utilisateur sont neutralisées pour empêcher les formules Excel malveillantes.</li>
        </ul>
      </div>
    </div>
  );
}
