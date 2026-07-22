import React, { useState, useEffect } from 'react';

export default function InstitutionPortal({ lang = 'fr' }) {
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
    fetchCoudSummary();
  }, []);

  const handleSimulateImport = (e) => {
    e.preventDefault();
    setFileImported(true);
    setTimeout(() => {
      setFileImported(false);
      alert('Importation en masse réussie : 1 450 nouveaux étudiants inscrits et cartes numériques générées avec succès !');
    }, 1500);
  };

  return (
    <div className="container py-4">
      {/* Header Portail Institutionnel COUD */}
      <div className="d-flex justify-content-between align-items-center mb-4 p-4 rounded-3 text-white" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #0369a1 100%)', boxShadow: 'var(--shadow-lg)' }}>
        <div>
          <span className="badge bg-warning text-dark mb-2">🏛️ Portail Grand Compte Institutionnel</span>
          <h2 className="fw-bold mb-1">COUD — Centre des Œuvres Universitaires de Dakar</h2>
          <p className="mb-0 text-white-50">Gestion intégrée de la Couverture Santé des Étudiants de l'Université Cheikh Anta Diop (UCAD)</p>
        </div>
        <div className="text-end">
          <span className="fs-3 fw-bold">85 000</span>
          <br />
          <small className="text-white-50">Étudiants Bénéficiaires</small>
        </div>
      </div>

      {loading ? (
        <div>Chargement du tableau de bord COUD...</div>
      ) : (
        <div>
          {/* KPI Dashboard COUD */}
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Étudiants Actifs Couverts</span>
                <h3 className="fw-bold text-success mt-1 mb-0">{coudData?.active_students_covered?.toLocaleString() || '1 240'}</h3>
                <small className="text-success">🟢 100% Cartes QR Générées</small>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Centre Médical Dédié</span>
                <h5 className="fw-bold text-primary mt-2 mb-0">{coudData?.center_name || 'Centre Médical UCAD'}</h5>
                <small className="text-muted">Campus Universitaire</small>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Budget Santé Alloué (Annéé)</span>
                <h3 className="fw-bold text-primary mt-1 mb-0">{Number(coudData?.budget_allocated || 150000000).toLocaleString()} FCFA</h3>
                <small className="text-muted">Subvention État / COUD</small>
              </div>
            </div>

            <div className="col-md-3">
              <div className="card border-0 p-3 shadow-sm text-center" style={{ borderRadius: '14px', background: 'var(--card-bg)' }}>
                <span className="text-muted small">Budget Consommé (Tiers-Payant)</span>
                <h3 className="fw-bold text-danger mt-1 mb-0">{Number(coudData?.budget_consumed || 42800000).toLocaleString()} FCFA</h3>
                <small className="text-success">28.5% du Budget Total</small>
              </div>
            </div>
          </div>

          <div className="row g-4">
            {/* Importation en masse d'étudiants */}
            <div className="col-md-6">
              <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
                <h4 className="fw-bold mb-3">📥 Inscription & Importation en Masse (Fichier Excel/CSV)</h4>
                <p className="small text-muted mb-3">
                  Importez directement les listes d'étudiants inscrits à l'UCAD avec leur matricule. Les cartes de santé numériques avec Code Patient Universel seront générées et envoyées automatiquement par SMS.
                </p>

                <form onSubmit={handleSimulateImport}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Faculté / UFR d'Origine</label>
                    <select className="form-select">
                      <option value="FST">Faculté des Sciences et Techniques (FST)</option>
                      <option value="FMPO">Faculté de Médecine, Pharmacie et d'Odonto-Stomatologie (FMPO)</option>
                      <option value="FLSH">Faculté des Lettres et Sciences Humaines (FLSH)</option>
                      <option value="FSJP">Faculté des Sciences Juridiques et Politiques (FSJP)</option>
                      <option value="FASEG">Faculté des Sciences Économiques et de Gestion (FASEG)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Sélectionner le fichier d'étudiants (.xlsx, .csv)</label>
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
                <h4 className="fw-bold mb-3">📊 Top 5 des Soins Médicaux Consommés à l'UCAD</h4>
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>💊 Consultations Médecine Générale & Paludisme</span>
                    <span className="fw-bold">42%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-success" style={{ width: '42%' }}></div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>🦷 Soins Dentaires & Odontologie</span>
                    <span className="fw-bold">24%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-primary" style={{ width: '24%' }}></div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>👓 Consultation Ophtalmologie & Lunetterie</span>
                    <span className="fw-bold">18%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-info" style={{ width: '18%' }}></div>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>🔬 Examens de Biologie & Analyses de Sang</span>
                    <span className="fw-bold">16%</span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-warning" style={{ width: '16%' }}></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center">
                  <span className="text-muted small">Interconnexion directe avec le SÉN-CSU Ministère de la Santé</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => alert('Exportation du rapport financier COUD au format PDF...')}>
                    📥 Rapport Financier PDF
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
