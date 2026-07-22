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
        notes: 'Grossesse évolutive normale. Prise en charge 100% accouchement active au Centre de Santé Gaspard Camara.'
      });
      setDeclaring(false);
    }, 1000);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_kids_real.png") center/cover no-repeat',
          padding: '2.5rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 position-relative" style={{ zIndex: 2 }}>
          <div style={{ maxWidth: '650px' }}>
            <span 
              className="badge px-3 py-1 mb-2 fw-semibold"
              style={{
                background: 'rgba(255, 255, 255, 0.22)',
                color: '#ffffff',
                backdropFilter: 'blur(4px)',
                borderRadius: '20px',
                fontSize: '0.8rem',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              🤱 Programme national de gratuité maternité CMU — 100% pris en charge
            </span>
            <h1 className="fw-bold mb-2 text-white" style={{ fontSize: '1.9rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              {lang === 'wo' ? 'Tére wéru yaramu jégen ji ak doom ji (Carnet maternité)' : 'Carnet de santé maternelle & suivi périnatal'}
            </h1>
            <p className="mb-0 text-white-50" style={{ fontSize: '0.95rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              {lang === 'wo'
                ? 'Suivi bu mat seuk ngir CPN1 ba CPN4+, echographies ak prise en charge accouchement 100% gratuit.'
                : 'Suivi numérique des consultations prénatales (CPN), échographies, vaccins et prise en charge de l\'accouchement à 100%.'}
            </p>
          </div>

          <button 
            type="button"
            className="btn fw-semibold"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              borderRadius: '12px',
              padding: '0.65rem 1.3rem',
              fontSize: '0.9rem',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
            onClick={fetchMaternalData}
          >
            🔄 {lang === 'wo' ? 'Yessal carnet bi' : 'Actualiser le carnet'}
          </button>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-5 text-muted">Chargement du carnet de maternité...</div>
      ) : !maternalData ? (
        <div className="card p-5 text-center shadow-sm border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <span style={{ fontSize: '4rem' }}>👶</span>
          <h4 className="fw-bold mt-3" style={{ color: 'var(--text-main)' }}>Aucune grossesse déclarée en cours</h4>
          <p className="text-muted max-w-xl mx-auto" style={{ fontSize: '0.92rem', lineHeight: '1.6' }}>
            Déclarez une grossesse auprès de votre mutuelle de santé pour débloquer votre carnet de santé maternelle numérique, recevoir les rappels automatiques de CPN et bénéficier de la <strong>gratuité totale (100%) de l'accouchement et de la césarienne</strong>.
          </p>
          <div className="mt-3">
            <button className="btn btn-success px-4 py-2 text-white fw-bold" style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '12px' }} onClick={handleSimulateDeclaration} disabled={declaring}>
              {declaring ? 'Enregistrement...' : '🤰 Déclarer une grossesse en ligne'}
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Suivi des CPN */}
          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🤰 Suivi de grossesse évolutive</h4>
                <span className="badge bg-success px-3 py-1.5" style={{ borderRadius: '20px' }}>Gratuité accouchement 100% active</span>
              </div>

              <div className="p-3 rounded-3 mb-4" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                <div className="row g-3">
                  <div className="col-6">
                    <span className="text-muted small">Date de début :</span>
                    <p className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{new Date(maternalData.pregnancy_start_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="col-6">
                    <span className="text-muted small">Terme prévu (DPA) :</span>
                    <p className="fw-bold text-success mb-0">{new Date(maternalData.expected_delivery_date).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              </div>

              <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📋 Consultations prénatales (CPN 1 à CPN 4+)</h5>
              
              <div className="list-group mb-4">
                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>CPN 1 (1er trimestre - datation)</h6>
                    <small className="text-muted">Bilan global, échographie précoce & supplémentation en fer</small>
                  </div>
                  <span className="badge bg-success px-2.5 py-1" style={{ borderRadius: '6px' }}>✅ Effectuée ({new Date(maternalData.cpn1_date).toLocaleDateString('fr-FR')})</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>CPN 2 (2ème trimestre - morphologie)</h6>
                    <small className="text-muted">Tension artérielle, vaccination tétanos VAT 1</small>
                  </div>
                  <span className="badge bg-success px-2.5 py-1" style={{ borderRadius: '6px' }}>✅ Effectuée ({new Date(maternalData.cpn2_date).toLocaleDateString('fr-FR')})</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>CPN 3 (3ème trimestre - bilan sanguin)</h6>
                    <small className="text-muted">Échographie 3ème trimestre & contrôle biologique</small>
                  </div>
                  <span className="badge bg-warning text-dark px-2.5 py-1" style={{ borderRadius: '6px' }}>⏳ Prévue ce mois</span>
                </div>

                <div className="list-group-item d-flex justify-content-between align-items-center p-3 mb-2 rounded-3 border" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>CPN 4+ (préparation accouchement)</h6>
                    <small className="text-muted">Attribution de la maternité et fiche de liaison</small>
                  </div>
                  <span className="badge bg-secondary px-2.5 py-1" style={{ borderRadius: '6px' }}>Programmée</span>
                </div>
              </div>

              <div className="alert alert-success d-flex align-items-center rounded-3 border-0">
                <span className="fs-4 me-3">ℹ️</span>
                <div style={{ color: 'var(--text-main)' }}>
                  <strong>Programme gratuité maternité CMU Sénégal :</strong>
                  <br />
                  Votre accouchement simple ou par césarienne est pris en charge à <strong>100% sans aucun frais</strong> dans les maternités et centres de santé publics agréés.
                </div>
              </div>
            </div>
          </div>

          {/* Vaccins & pédiatrie */}
          <div className="col-md-5">
            <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>💉 Vaccins & suppléments maternels</h4>
              
              <ul className="list-group mb-3">
                <li className="list-group-item d-flex justify-content-between align-items-center p-3 mb-1 border rounded" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span>Vaccin antitétanique (VAT 1)</span>
                  <span className="badge bg-success">Réalisé</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center p-3 mb-1 border rounded" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span>Vaccin antitétanique (VAT 2)</span>
                  <span className="badge bg-warning text-dark">Prévu CPN 3</span>
                </li>
                <li className="list-group-item d-flex justify-content-between align-items-center p-3 mb-1 border rounded" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span>Fer + acide folique (anémie)</span>
                  <span className="badge bg-success">Délivré 100%</span>
                </li>
              </ul>
            </div>

            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>👶 Carnet de vaccination enfant</h4>
              <p className="small text-muted mb-3" style={{ fontSize: '0.88rem' }}>Après la naissance, le carnet de votre enfant est automatiquement créé pour le suivi des vaccins BCG, Polio et Pentavalent.</p>
              <button className="btn btn-outline-success w-100 fw-bold py-2" style={{ borderRadius: '10px' }} onClick={() => alert('Ouverture du carnet pédiatrique enfant...')}>
                📋 Voir carnet pédiatrique enfant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
