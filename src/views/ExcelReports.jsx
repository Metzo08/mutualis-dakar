/**
 * ExcelReports.jsx — Générateur de rapports Excel (format .xlsx)
 *
 * Export de bénéficiaires, cartes, production et audit sous forme de classeur
 * .xlsx téléchargeable. Les données sont cloisonnées côté serveur par MSD.
 *
 * Route Frontend : 'excel-reports'  (App.jsx)
 * Route Backend  : /api/excel/report/:type
 */
import { useState } from 'react';

const REPORT_TYPES = [
  { value: 'beneficiaries', label: '📋 Bénéficiaires (tous champs)' },
  { value: 'cards', label: '🃏 Cartes (état + historique)' },
  { value: 'production', label: '🏭 Production (cartes délivrées)' },
  { value: 'audit', label: '📜 Audit (journal d’audit récent)' },
];

function ExcelReports({ lang, agentUser, setView, setViewTab }) {
  const [type, setType] = useState('beneficiaries');
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState('');

  const handleDownload = async () => {
    setDownloading(true);
    setStatus('');
    try {
      const blob = await apiFetch(`/api/excel/report/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mutualis-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setStatus('Fichier téléchargé. Ouvrez-le avec Excel ou LibreOffice.');
    } catch (err) {
      setStatus('Erreur lors de la génération du rapport.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h4 mb-1">📊 Rapports Excel</h1>
          <p className="text-muted small">
            Export de données au format <b>.xlsx</b> — cloisonné par MSD côté serveur.
            Téléchargez un classeur complet dans Excel ou LibreOffice.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="row g-3 align-items-end">
          <div className="col-md-6">
            <label className="form-label small text-muted">Type de rapport</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
              {REPORT_TYPES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="col-md-6">
            <button
              className="btn btn-primary w-100"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? 'Génération…' : '⬇️ Télécharger le .xlsx'}
            </button>
          </div>
        </div>
        {status && <div className="alert alert-info mt-3">{status}</div>}
      </div>

      <div className="card mt-3">
        <h5 className="mb-2">Note</h5>
        <p className="small text-muted">
          Tous les rapports sont filtrés par MSD selon le compte de l'utilisateur connecté.
          Seuls les agents, administrateurs et Super Admin disposent de cet espace.
        </p>
      </div>
    </div>
  );
}

export default ExcelReports;