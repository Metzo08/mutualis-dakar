import { useState, useEffect } from 'react';
import ProIcon from '../components/ProIcon';

export default function InstitutionPortal({ portalMode = 'citizen', agentUser = null, setView = null }) {
  // ═══════════════════════════════════════════════════════
  // RBAC — Réservé au SuperAdmin DSI UNAMUSC (gouvernance nationale des prestataires)
  // L'agent UDMS n'a PAS accès : il gère son union mais n'agrée pas les prestataires.
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = portalMode === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const canAccess = isSuperAdmin;

  const [coudData, setCoudData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fileImported, setFileImported] = useState(false);

  const fetchCoudSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/institutions/coud/summary');
      const json = await res.json();
      if (json.success) {
        setCoudData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) fetchCoudSummary();
  }, [canAccess]);

  const handleSimulateImport = (e) => {
    e.preventDefault();
    setFileImported(true);
    setTimeout(() => {
      setFileImported(false);
      alert('Importation en masse réussie : 1 450 nouveaux étudiants inscrits et cartes numériques générées avec succès !');
    }, 1500);
  };

  // ── Accès refusé pour les profils non autorisés ──
  if (!canAccess) {
    return (
      <div className="container py-5 fade-in-up">
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="p-5 rounded-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #312e81 0%, #4338ca 100%)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}><ProIcon name="lock" /></div>
            <span className="badge mb-3 d-inline-block" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>
              {portalMode === 'agent' ? 'Agent UDMS' : 'Espace réservé'}
            </span>
            <h2 className="fw-bold mb-3" style={{ color: '#fff', fontSize: '1.8rem' }}>Espace prestataire & coud — Accès restreint</h2>
            <p className="mb-4" style={{ color: '#c7d2fe', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              Cet espace de gouvernance institutionnelle (agrément des prestataires, importation en masse coud, gestion des conventions) Est réservé exclusivement au <strong>Superadmin dsi UNAMUSC</strong>. Les agents UDMS gèrent leur union mais n'agrèent pas les prestataires au niveau national.
            </p>
            <button className="btn btn-light fw-bold px-4 py-3" style={{ borderRadius: '12px', color: '#312e81' }} onClick={() => { if (setView) setView('home'); else window.location.hash = '#/home'; }}>
              ← retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Header Portail Institutionnel COUD */}
      <div className="d-flex justify-content-between align-items-center mb-4 p-4 rounded-3 text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #0369a1 100%)', boxShadow: 'var(--shadow-lg)' }}>
        <div>
          <span className="badge bg-warning text-dark mb-2"><ProIcon name="landmark" /> Portail grand compte institutionnel</span>
          <h2 className="fw-bold mb-1">Coud — Centre des œuvres universitaires de Dakar</h2>
          <p className="mb-0 text-white-50">Gestion intégrée de la couverture santé des étudiants de l'université cheikh anta diop (ucad)</p>
        </div>
        <div className="text-end">
          <span className="fs-3 fw-bold">85 000</span>
          <br />
          <small className="text-white-50">Étudiants bénéficiaires</small>
        </div>
      </div>

      {loading ? (
        <div>Chargement du tableau de bord coud...</div>
      ) : (
        <div>
          {/* KPI Dashboard COUD */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Étudiants actifs couverts</span>
                <h3 className="fw-bold text-success mt-1 mb-0">{coudData?.active_students_covered?.toLocaleString() || '1 240'}</h3>
                <small className="text-success"><ProIcon name="status-green" color="#10b981" fill="#10b981" size={10} /> 100% cartes QR générées</small>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Centre médical dédié</span>
                <h5 className="fw-bold text-primary mt-2 mb-0">{coudData?.center_name || 'Centre Médical UCAD'}</h5>
                <small className="text-muted">Campus universitaire</small>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Budget santé alloué (annéé)</span>
                <h3 className="fw-bold text-primary mt-1 mb-0">{Number(coudData?.budget_allocated || 150000000).toLocaleString()} FCFA</h3>
                <small className="text-muted">Subvention état / Coud</small>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Budget consommé (tiers-payant)</span>
                <h3 className="fw-bold text-danger mt-1 mb-0">{Number(coudData?.budget_consumed || 42800000).toLocaleString()} FCFA</h3>
                <small className="text-success">28.5% du budget total</small>
              </div>
            </div>
          </div>

          <div className="row g-4">
            {/* Importation en masse d'étudiants */}
            <div className="col-md-6">
              <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
                <h4 className="fw-bold mb-3"><ProIcon name="download" /> Inscription & importation en masse (fichier Excel/CSV)</h4>
                <p className="small text-muted mb-3">
                  Importez directement les listes d'étudiants inscrits à l'ucad avec leur matricule. Les cartes de santé numériques avec code patient universel seront générées et envoyées automatiquement par SMS.
                </p>

                <form onSubmit={handleSimulateImport}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Faculté / Ufr d'origine</label>
                    <select className="form-select">
                      <option value="FST">Faculté des sciences et techniques (fst)</option>
                      <option value="FMPO">Faculté de médecine, pharmacie et d'odonto-stomatologie (fmpo)</option>
                      <option value="FLSH">Faculté des lettres et sciences humaines (flsh)</option>
                      <option value="FSJP">Faculté des sciences juridiques et politiques (fsjp)</option>
                      <option value="FASEG">Faculté des sciences économiques et de gestion (faseg)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Sélectionner le fichier d'étudiants (.XLSX, .CSV)</label>
                    <input type="file" className="form-control" accept=".csv, .xlsx" required />
                  </div>

                  <button type="submit" className="btn btn-primary w-100" disabled={fileImported}>
                    {fileImported ? 'Traitement en masse en cours...' : '🚀 Lancer l\'Importation & Générer les Cartes QR'}
                  </button>
                </form>
              </div>
            </div>

            {/* Statistiques d'actes médicaux fréquents chez les étudiants */}
            <div className="col-md-6">
              <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
                <h4 className="fw-bold mb-3"><ProIcon name="bar-chart" /> Top 5 des soins médicaux consommés à l'ucad</h4>
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span><ProIcon name="pill" /> Consultations médecine générale & paludisme</span>
                    <span className="fw-bold">42%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-success" style={{ width: '42%' }}></div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span><ProIcon name="stethoscope" /> Soins dentaires & odontologie</span>
                    <span className="fw-bold">24%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-primary" style={{ width: '24%' }}></div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>👓 consultation ophtalmologie & lunetterie</span>
                    <span className="fw-bold">18%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-info" style={{ width: '18%' }}></div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span><ProIcon name="microscope" /> Examens de biologie & analyses de sang</span>
                    <span className="fw-bold">16%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-warning" style={{ width: '16%' }}></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Interconnexion directe avec le programme national de la couverture sanitaire — Ministère de la santé</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => alert('Exportation du rapport financier COUD au format PDF...')}>
                    <ProIcon name="download" /> Rapport financier PDF
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
