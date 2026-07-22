import React, { useState, useEffect } from 'react';

export default function MaternalHealth({ lang = 'fr' }) {
  const [maternalData, setMaternalData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMaternalData = async () => {
    setLoading(true);
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const benId = citizenData.id || 1;
      const res = await fetch(`/api/medical-profile/${benId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMaternalData(json.data.maternal);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaternalData();
  }, []);

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
          🤱 {lang === 'wo' ? 'Tére wéru yaramu jégen ji ak doom ji (Carnet Maternité)' : 'Carnet de Santé Maternelle & Suivi Périnatal Intelligent'}
        </h2>
        <p className="text-muted mb-0">
          {lang === 'wo'
            ? 'Suivi bu mat seuk ngir CPN1 ba CPN4+, echographies ak prise en charge accouchement 100% gratuit.'
            : 'Suivi numérique des consultations prénatales (CPN), échographies, vaccins et prise en charge de l\'accouchement à 100%.'}
        </p>
      </div>

      {loading ? (
        <div>Chargement du carnet de maternité...</div>
      ) : !maternalData ? (
        <div className="card p-5 text-center shadow-sm border-0" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
          <span style={{ fontSize: '3.5rem' }}>👶</span>
          <h4 className="fw-bold mt-3">Aucune Grossesse en Cours Déclarée</h4>
          <p className="text-muted">Déclarez une grossesse auprès de votre mutuelle de santé ou de votre centre de santé pour débloquer votre carnet de maternité numérique et la gratuité à 100% de l'accouchement.</p>
          <div>
            <button className="btn btn-success px-4" onClick={() => alert('Déclaration de grossesse soumise au centre de santé...')}>
              🤰 Déclarer une Grossesse en Ligne
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Fiche synthétique du suivi */}
          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0">🤰 Carnet de Grossesse Évolutive</h4>
                <span className="badge bg-success fs-6">Gratuité 100% Active</span>
              </div>

              <div className="p-3 bg-light rounded border mb-4">
                <div className="row g-3">
                  <div className="col-6">
                    <small className="text-muted">Date de Début :</small>
                    <p className="fw-bold mb-0">{new Date(maternalData.pregnancy_start_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="col-6">
                    <small className="text-muted">Terminaison Prévue (DPA) :</small>
                    <p className="fw-bold text-primary mb-0">{new Date(maternalData.expected_delivery_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              <h5 className="fw-bold mb-3">📋 Suivi des Consultations Prénatales (CPN)</h5>
              <div className="list-group mb-4">
                <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                  <div>
                    <h6 className="fw-bold mb-0">CPN 1 (1er Trimestre - Avant 15 SA)</h6>
                    <small className="text-muted">Bilan de santé global, échographie de datation & supplémentation en Fer</small>
                  </div>
                  <span className="badge bg-success">✅ Effectuée ({new Date(maternalData.cpn1_date).toLocaleDateString('fr-FR')})</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                  <div>
                    <h6 className="fw-bold mb-0">CPN 2 (2ème Trimestre - 20-24 SA)</h6>
                    <small className="text-muted">Vérification hauteur utérine & vaccination Tétanos VAT 1</small>
                  </div>
                  <span className="badge bg-success">✅ Effectuée ({new Date(maternalData.cpn2_date).toLocaleDateString('fr-FR')})</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                  <div>
                    <h6 className="fw-bold mb-0">CPN 3 (3ème Trimestre - 28-32 SA)</h6>
                    <small className="text-muted">Échographie morphologique & bilan sanguin</small>
                  </div>
                  <span className="badge bg-warning text-dark">⏳ À venir ce mois</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3">
                  <div>
                    <h6 className="fw-bold mb-0">CPN 4+ (Fin de Grossesse - 36-38 SA)</h6>
                    <small className="text-muted">Préparation à l'accouchement & attribution maternité agréée</small>
                  </div>
                  <span className="badge bg-secondary">Programmée</span>
                </div>
              </div>

              <div className="alert alert-info d-flex align-items-center">
                <span className="me-2 fs-4">ℹ️</span>
                <div>
                  <strong>Programme Gratuité Maternité CMU Sénégal :</strong>
                  <br />
                  Votre accouchement simple ou par césarienne est pris en charge à **100% sans aucun frais à votre charge** dans les structures publiques et centres de santé agréés.
                </div>
              </div>
            </div>
          </div>

          {/* Calendrier de vaccination & Échographies */}
          <div className="col-md-5">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">💉 Vaccins & Suppléments Maternels</h4>
              <ul className="list-group mb-3">
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Vaccin Antitétanique (VAT 1)</span>
                  <span className="badge bg-success">Réalisé</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Vaccin Antitétanique (VAT 2)</span>
                  <span className="badge bg-warning text-dark">Prévu CPN 3</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Fer + Acide Folique (Prévention Anémie)</span>
                  <span className="badge bg-success">Délivré 100%</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center">
                  <span>Traitement Préventif Intermittent Paludisme (TPI)</span>
                  <span className="badge bg-success">Délivré</span>
                </li>
              </ul>
            </div>

            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
              <h4 className="fw-bold mb-3">👶 Carnet de Vaccination du Nouveau-Né</h4>
              <p className="small text-muted">Après la naissance, le carnet de votre bébé sera synchronisé automatiquement pour les vaccins BCG, Polio et Pentavalent.</p>
              <button className="btn btn-outline-primary w-100" onClick={() => alert('Affichage du carnet pédiatrique...')}>
                📋 Voir Carnet Pédiatrique Enfant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
