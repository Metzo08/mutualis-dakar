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
        notes: 'Grossesse évolutive normale. Prise en charge 100% accouchement active au Centre de santé Gaspard Camara.'
      });
      setDeclaring(false);
    }, 1000);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique (Titre & Boutons centrés) */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_kids_real.png") center/cover no-repeat',
          padding: '3rem 2rem',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '850px' }}>
          <span 
            className="badge px-3 py-1 mb-2 fw-semibold d-inline-block text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(4px)',
              borderRadius: '20px',
              fontSize: '0.82rem',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            🤱 Programme national de gratuité maternité CMU — 100% pris en charge
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Tére wéru yaramu jégen ji ak doom ji (Carnet maternité)' : 'Carnet de santé maternelle & suivi périnatal'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Suivi bu mat seuk ngir CPN1 ba CPN4+, echographies ak prise en charge accouchement 100% gratuit.'
              : 'Suivi numérique des consultations prénatales (CPN), échographies, vaccins et prise en charge de l\'accouchement à 100%.'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            <button 
              type="button"
              className="btn fw-semibold text-white"
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={fetchMaternalData}
            >
              🔄 {lang === 'wo' ? 'Yessal carnet bi' : 'Actualiser le carnet'}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-5 text-muted">Chargement du carnet de maternité...</div>
      ) : !maternalData ? (
        <div className="card p-5 text-center shadow-sm border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <span style={{ fontSize: '4rem' }}>👶</span>
          <h4 className="fw-bold mt-3 mb-2" style={{ color: 'var(--text-main)' }}>Aucune grossesse déclarée en cours</h4>
          <p className="text-muted max-w-xl mx-auto mb-4" style={{ fontSize: '0.95rem', lineHeight: '1.7' }}>
            Déclarez une grossesse auprès de votre mutuelle de santé pour débloquer votre carnet de santé maternelle numérique, recevoir les rappels automatiques de CPN et bénéficier de la <strong>gratuité totale (100%) de l'accouchement et de la césarienne</strong>.
          </p>
          <div>
            <button 
              className="btn text-white fw-bold px-4 py-2.5" 
              style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '12px', fontSize: '0.95rem' }} 
              onClick={handleSimulateDeclaration} 
              disabled={declaring}
            >
              {declaring ? 'Enregistrement...' : '🤰 Déclarer une grossesse en ligne'}
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {/* Suivi des CPN */}
          <div className="col-md-7">
            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🤰 Suivi de grossesse évolutive</h4>
                <span className="badge bg-success px-3 py-2 fw-semibold" style={{ borderRadius: '20px', fontSize: '0.82rem' }}>Gratuité accouchement 100% active</span>
              </div>

              {/* Dates clés aérées */}
              <div className="p-4 rounded-3 mb-4" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                <div className="row g-4">
                  <div className="col-6">
                    <span className="text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>Date de début de grossesse :</span>
                    <p className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>
                      📅 {new Date(maternalData.pregnancy_start_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="col-6">
                    <span className="text-muted d-block mb-1" style={{ fontSize: '0.85rem' }}>Terme prévu d'accouchement (DPA) :</span>
                    <p className="fw-bold text-success mb-0" style={{ fontSize: '1.05rem' }}>
                      👶 {new Date(maternalData.expected_delivery_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>

              <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>📋 Consultations prénatales (CPN 1 à CPN 4+)</h5>
              
              <div className="d-flex flex-column gap-3 mb-4">
                <div className="p-3.5 rounded-3 border d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)', padding: '1.1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>CPN 1 (1er trimestre - datation)</h6>
                    <p className="text-muted mb-0" style={{ fontSize: '0.88rem', lineHeight: '1.5' }}>Bilan global, échographie précoce & supplémentation en fer</p>
                  </div>
                  <span className="badge bg-success px-3 py-1.5 fw-semibold" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                    ✅ Effectuée ({new Date(maternalData.cpn1_date).toLocaleDateString('fr-FR')})
                  </span>
                </div>

                <div className="p-3.5 rounded-3 border d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)', padding: '1.1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>CPN 2 (2ème trimestre - morphologie)</h6>
                    <p className="text-muted mb-0" style={{ fontSize: '0.88rem', lineHeight: '1.5' }}>Tension artérielle, vaccination tétanos VAT 1</p>
                  </div>
                  <span className="badge bg-success px-3 py-1.5 fw-semibold" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                    ✅ Effectuée ({new Date(maternalData.cpn2_date).toLocaleDateString('fr-FR')})
                  </span>
                </div>

                <div className="p-3.5 rounded-3 border d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)', padding: '1.1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>CPN 3 (3ème trimestre - bilan sanguin)</h6>
                    <p className="text-muted mb-0" style={{ fontSize: '0.88rem', lineHeight: '1.5' }}>Échographie 3ème trimestre & contrôle biologique</p>
                  </div>
                  <span className="badge bg-warning text-dark px-3 py-1.5 fw-semibold" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                    ⏳ Prévue ce mois
                  </span>
                </div>

                <div className="p-3.5 rounded-3 border d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)', padding: '1.1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>CPN 4+ (préparation accouchement)</h6>
                    <p className="text-muted mb-0" style={{ fontSize: '0.88rem', lineHeight: '1.5' }}>Attribution de la maternité et fiche de liaison</p>
                  </div>
                  <span className="badge bg-secondary px-3 py-1.5 fw-semibold" style={{ borderRadius: '8px', fontSize: '0.82rem' }}>
                    Programmée
                  </span>
                </div>
              </div>

              <div className="alert alert-success d-flex align-items-center rounded-3 border-0 p-3.5">
                <span className="fs-3 me-3">ℹ️</span>
                <div style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: '1.6' }}>
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
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>💉 Vaccins & suppléments maternels</h4>
              
              <div className="d-flex flex-column gap-2 mb-3">
                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>Vaccin antitétanique (VAT 1)</span>
                  <span className="badge bg-success px-2.5 py-1" style={{ borderRadius: '6px' }}>Réalisé</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>Vaccin antitétanique (VAT 2)</span>
                  <span className="badge bg-warning text-dark px-2.5 py-1" style={{ borderRadius: '6px' }}>Prévu CPN 3</span>
                </div>
                <div className="d-flex justify-content-between align-items-center p-3 border rounded-3" style={{ background: 'var(--bg-body)', borderColor: 'var(--border-color)', color: 'var(--text-main)' }}>
                  <span className="fw-semibold" style={{ fontSize: '0.9rem' }}>Fer + acide folique (anémie)</span>
                  <span className="badge bg-success px-2.5 py-1" style={{ borderRadius: '6px' }}>Délivré 100%</span>
                </div>
              </div>
            </div>

            <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <h4 className="fw-bold mb-3" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>👶 Carnet de vaccination enfant</h4>
              <p className="text-muted mb-4" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                Après la naissance, le carnet de votre enfant est automatiquement créé pour le suivi des vaccins BCG, Polio et Pentavalent.
              </p>
              <button 
                type="button"
                className="btn w-100 fw-bold py-2.5 text-white" 
                style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '10px', fontSize: '0.92rem' }} 
                onClick={() => alert('Ouverture du carnet pédiatrique enfant...')}
              >
                📋 Voir carnet pédiatrique enfant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
