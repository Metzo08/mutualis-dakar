import React, { useState, useEffect } from 'react';

export default function MaternalHealth({ lang = 'fr' }) {
  const [maternalData, setMaternalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [declaring, setDeclaring] = useState(false);

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

  const handleSimulateDeclaration = () => {
    setDeclaring(true);
    setTimeout(() => {
      setMaternalData({
        pregnancy_start_date: new Date(Date.now() - 90 * 86400000).toISOString(),
        expected_delivery_date: new Date(Date.now() + 180 * 86400000).toISOString(),
        cpn1_date: new Date(Date.now() - 60 * 86400000).toISOString(),
        cpn2_date: new Date(Date.now() - 15 * 86400000).toISOString(),
        risk_level: 'normal',
        notes: 'Grossesse évolutive normale. Prise en charge 100% accouchement active au Centre de Santé Gaspart Camara.'
      });
      setDeclaring(false);
    }, 1000);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Header avec Bannière Stylisée */}
      <div 
        className="p-4 mb-4 rounded-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-3"
        style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #db2777 50%, #be185d 100%)',
          boxShadow: '0 10px 25px -5px rgba(236, 72, 153, 0.3)'
        }}
      >
        <div>
          <span className="badge bg-white text-pink fw-bold px-3 py-1 mb-2" style={{ fontSize: '0.75rem', borderRadius: '20px', color: '#be185d' }}>
            🤱 Programme National de Gratuité Maternité CMU — 100% Pris en Charge
          </span>
          <h2 className="fw-bold mb-1 text-white">
            {lang === 'wo' ? 'Tére wéru yaramu jégen ji ak doom ji (Carnet Maternité)' : 'Carnet de Santé Maternelle & Suivi Périnatal Intelligent'}
          </h2>
          <p className="mb-0 text-white-50" style={{ fontSize: '0.9rem' }}>
            {lang === 'wo'
              ? 'Suivi bu mat seuk ngir CPN1 ba CPN4+, echographies ak prise en charge accouchement 100% gratuit.'
              : 'Suivi numérique des consultations prénatales (CPN), échographies, vaccins et prise en charge de l\'accouchement à 100%.'}
          </p>
        </div>

        <button className="btn btn-light text-pink fw-bold px-4 py-2" style={{ borderRadius: '12px', color: '#be185d' }} onClick={fetchMaternalData}>
          🔄 Actualiser le Carnet
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">Chargement du carnet de maternité...</div>
      ) : !maternalData ? (
        <div className="card p-5 text-center shadow-sm border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <span style={{ fontSize: '4rem' }}>👶</span>
          <h4 className="fw-bold mt-3" style={{ color: 'var(--text-main)' }}>Aucune Grossesse Déclarée en Cours</h4>
          <p className="text-muted max-w-xl mx-auto">
            Déclarez une grossesse auprès de votre mutuelle de santé pour débloquer votre carnet de santé maternelle numérique, recevoir les rappels automatiques de CPN et bénéficier de la <strong>gratuité totale (100%) de l'accouchement et de la césarienne</strong>.
          </p>
          <div className="mt-3">
            <button className="btn btn-pink px-4 py-2 text-white fw-bold" style={{ background: '#be185d', borderRadius: '12px' }} onClick={handleSimulateDeclaration} disabled={declaring}>
              {declaring ? 'Enregistrement...' : '🤰 Déclarer une Grossesse en Ligne'}
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Suivi des CPN */}
          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🤰 Suivi de Grossesse Évolutive</h4>
                <span className="badge bg-success px-3 py-1">Gratuité Accouchement 100% Active</span>
              </div>

              <div className="p-3 rounded-3 mb-4" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                <div className="row g-3">
                  <div className="col-6">
                    <span className="text-muted small">Date de Début :</span>
                    <p className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{new Date(maternalData.pregnancy_start_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="col-6">
                    <span className="text-muted small">Terme Prévu (DPA) :</span>
                    <p className="fw-bold text-pink mb-0" style={{ color: '#be185d' }}>{new Date(maternalData.expected_delivery_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📋 Consultations Prénatales (CPN 1 à CPN 4+)</h5>
              
              <div className="list-group mb-4">
                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>CPN 1 (1er Trimestre - Datation)</h6>
                    <small className="text-muted">Bilan global, échographie précoce & supplémentation en Fer</small>
                  </div>
                  <span className="badge bg-success">✅ Effectuée ({new Date(maternalData.cpn1_date).toLocaleDateString('fr-FR')})</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>CPN 2 (2ème Trimestre - Morphologie)</h6>
                    <small className="text-muted">Tension artérielle, vaccination Tétanos VAT 1</small>
                  </div>
                  <span className="badge bg-success">✅ Effectuée ({new Date(maternalData.cpn2_date).toLocaleDateString('fr-FR')})</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>CPN 3 (3ème Trimestre - Bilan sanguin)</h6>
                    <small className="text-muted">Échographie 3ème trimestre & contrôle biologique</small>
                  </div>
                  <span className="badge bg-warning text-dark">⏳ Prévue ce mois</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>CPN 4+ (Préparation Accouchement)</h6>
                    <small className="text-muted">Attribution de la maternité et fiche de liaison</small>
                  </div>
                  <span className="badge bg-secondary">Programmée</span>
                </div>
              </div>

              <div className="alert alert-info d-flex align-items-center rounded-3 border-0">
                <span className="fs-4 me-3">ℹ️</span>
                <div>
                  <strong>Programme Gratuité Maternité CMU Sénégal :</strong>
                  <br />
                  Votre accouchement simple ou par césarienne est pris en charge à <strong>100% sans aucun frais</strong> dans les maternités et centres de santé publics agréés.
                </div>
              </div>
            </div>
          </div>

          {/* Vaccins & Pédiatrie */}
          <div className="col-md-5">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>💉 Vaccins & Suppléments Maternels</h4>
              
              <ul className="list-group mb-3">
                <li className="list-group-item d-flex justify-content-between align-items-center p-3 mb-1 border rounded" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span>Vaccin Antitétanique (VAT 1)</span>
                  <span className="badge bg-success">Réalisé</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center p-3 mb-1 border rounded" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span>Vaccin Antitétanique (VAT 2)</span>
                  <span className="badge bg-warning text-dark">Prévu CPN 3</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center p-3 mb-1 border rounded" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span>Fer + Acide Folique (Anémie)</span>
                  <span className="badge bg-success">Délivré 100%</span>
                </li>
              </ul>
            </div>

            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>👶 Carnet de Vaccination Enfant</h4>
              <p className="small text-muted mb-3">Après la naissance, le carnet de votre enfant est automatiquement créé pour le suivi des vaccins BCG, Polio et Pentavalent.</p>
              <button className="btn btn-outline-pink w-100 fw-bold py-2" style={{ color: '#be185d', borderColor: '#be185d', borderRadius: '10px' }} onClick={() => alert('Ouverture du carnet pédiatrique enfant...')}>
                📋 Voir Carnet Pédiatrique Enfant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
