import React, { useState, useEffect } from 'react';

export default function GuaranteeLetters({ lang = 'fr', userRole = 'citizen' }) {
  const defaultLetters = [
    {
      id: 201,
      first_name: 'Amadou',
      last_name: 'Sow',
      cmu_number: 'CMU-DKR-2026-8812',
      medical_act: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)',
      estimated_amount: 250000,
      guaranteed_percentage: 80,
      max_amount: 200000,
      status: 'pending',
      validation_code: 'GAR-2026-FANN-88'
    },
    {
      id: 202,
      first_name: 'Fatou',
      last_name: 'Diop',
      cmu_number: 'CMU-DKR-2026-4401',
      medical_act: 'Hospitalisation soins intensifs 5 jours — (Hôpital Aristide Le Dantec)',
      estimated_amount: 450000,
      guaranteed_percentage: 100,
      max_amount: 450000,
      status: 'approved',
      validation_code: 'GAR-2026-DANTEC-12'
    }
  ];

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Formulaire de demande (Assuré)
  const [medicalAct, setMedicalAct] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [structureName, setStructureName] = useState('Hôpital Universitaire de Fann (Dakar)');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Instruction Agent
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [guaranteedPct, setGuaranteedPct] = useState(80);
  const [maxAmount, setMaxAmount] = useState('');
  const [agentNote, setAgentNote] = useState('');

  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guarantees');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setLetters(json.data);
      } else {
        setLetters(defaultLetters);
      }
    } catch (err) {
      console.warn('Utilisation des garanties de démonstration:', err);
      setLetters(defaultLetters);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medicalAct || !estimatedAmount) return;
    setSubmitting(true);
    setSuccessMsg('');

    const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
    const newLetter = {
      id: Date.now(),
      first_name: citizenData.firstName || 'Bénéficiaire',
      last_name: citizenData.lastName || 'Assuré CMU',
      cmu_number: citizenData.cmuNumber || 'CMU-DKR-2026-9900',
      medical_act: `${medicalAct} — (${structureName})`,
      estimated_amount: parseFloat(estimatedAmount) || 0,
      guaranteed_percentage: 80,
      max_amount: parseFloat(estimatedAmount) * 0.8,
      status: 'pending',
      validation_code: `GAR-2026-${Math.floor(1000 + Math.random() * 9000)}`
    };

    try {
      await fetch('/api/guarantees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          medical_act: newLetter.medical_act,
          estimated_amount: newLetter.estimated_amount
        })
      });
    } catch (err) {
      console.warn(err);
    }

    setLetters([newLetter, ...letters]);
    setSuccessMsg(lang === 'wo' ? 'Demande bi yónnee nañu ko ak jamm.' : 'Votre demande de lettre de garantie a été soumise avec succès et est en attente d\'instruction agent.');
    setMedicalAct('');
    setEstimatedAmount('');
    setActiveTab('list');
    setSubmitting(false);
  };

  const handleValidateAgent = async (status) => {
    if (!selectedLetter) return;
    const updated = letters.map(l => l.id === selectedLetter.id ? {
      ...l,
      status,
      guaranteed_percentage: parseFloat(guaranteedPct),
      max_amount: parseFloat(maxAmount) || (l.estimated_amount * (guaranteedPct / 100))
    } : l);
    setLetters(updated);

    try {
      await fetch(`/api/guarantees/${selectedLetter.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          guaranteed_percentage: parseFloat(guaranteedPct),
          max_amount: parseFloat(maxAmount) || selectedLetter.estimated_amount,
          agent_note: agentNote
        })
      });
    } catch (err) {
      console.warn(err);
    }

    setSelectedLetter(null);
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme avec fond vert et image thématique (Titre & Boutons centrés) */}
      <section 
        className="banner-mini text-white mb-4 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.93), rgba(4, 120, 87, 0.88)), url("/csu_claims_hero.png") center/cover no-repeat',
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
            📜 SÉN-CSU — Prise en charge hospitalière (80% à 100%)
          </span>
          <h1 className="fw-bold mb-2 text-white text-center" style={{ fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {lang === 'wo' ? 'Bataaxal yoxu garansi (Lettres de garantie)' : 'Lettres de garantie & hospitalisation'}
          </h1>
          <p className="mb-3 text-white-50 text-center mx-auto" style={{ fontSize: '0.98rem', lineHeight: '1.6', textShadow: '0 1px 2px rgba(0,0,0,0.2)', maxWidth: '750px' }}>
            {lang === 'wo'
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez votre prise en charge hospitalière en ligne avec validation 100% humaine par nos agents.'}
          </p>

          <div className="d-flex justify-content-center align-items-center gap-3 flex-wrap mt-2 w-100">
            <button 
              type="button"
              className="btn fw-semibold"
              style={{
                background: activeTab === 'list' ? '#ffffff' : 'rgba(255, 255, 255, 0.18)',
                color: activeTab === 'list' ? '#047857' : '#ffffff',
                border: activeTab === 'list' ? 'none' : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                boxShadow: activeTab === 'list' ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveTab('list')}
            >
              📋 {lang === 'wo' ? 'Lim bi' : 'Mes demandes'}
            </button>

            <button 
              type="button"
              className="btn fw-semibold"
              style={{
                background: activeTab === 'new' ? '#ffffff' : 'rgba(255, 255, 255, 0.18)',
                color: activeTab === 'new' ? '#047857' : '#ffffff',
                border: activeTab === 'new' ? 'none' : '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '12px',
                padding: '0.65rem 1.4rem',
                fontSize: '0.92rem',
                boxShadow: activeTab === 'new' ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s'
              }}
              onClick={() => setActiveTab('new')}
            >
              ➕ {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle demande'}
            </button>
          </div>
        </div>
      </section>

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-5 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{successMsg}</div>
        </div>
      )}

      {/* Onglet : Nouvelle demande */}
      {activeTab === 'new' && (
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <div className="d-flex align-items-center gap-3 mb-4 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
            <span className="fs-3">📝</span>
            <div>
              <h4 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>
                {lang === 'wo' ? 'Bindal sa demande' : 'Formulaire de demande de prise en charge'}
              </h4>
              <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                Remplissez les détails du devis ou de l'acte médical prescrit par votre médecin.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row g-4">
              <div className="col-md-6">
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  🏥 Établissement sanitaire partenaire
                </label>
                <select 
                  className="form-select input"
                  value={structureName}
                  onChange={(e) => setStructureName(e.target.value)}
                  style={{ borderRadius: '10px', height: '48px' }}
                >
                  <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                  <option value="Hôpital Aristide Le Dantec (Dakar)">Hôpital Aristide Le Dantec (Dakar)</option>
                  <option value="Hôpital Général Idrissa Pouye (HOGIP)">Hôpital Général Idrissa Pouye (HOGIP Pikine)</option>
                  <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                  <option value="Clinique de la Madeleine (Dakar)">Clinique de la Madeleine (Dakar)</option>
                  <option value="Centre de Santé Gaspard Camara">Centre de Santé Gaspard Camara</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  💰 Montant estimé du devis / acte (FCFA)
                </label>
                <input 
                  type="number"
                  className="form-control input"
                  placeholder="ex: 250000"
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(e.target.value)}
                  style={{ borderRadius: '10px', height: '48px' }}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  🩺 Acte médical ou motif d'hospitalisation prescrit
                </label>
                <textarea 
                  className="form-control input"
                  rows="3"
                  placeholder="ex: Intervention chirurgicale ORL, Hospitalisation en soins intensifs, Bilan scanner..."
                  value={medicalAct}
                  onChange={(e) => setMedicalAct(e.target.value)}
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                  📎 Pièce justificative / ordonnance (PDF, image)
                </label>
                <input 
                  type="file" 
                  className="form-control input" 
                  style={{ borderRadius: '10px', height: '48px' }}
                />
                <small className="text-muted mt-2 d-block" style={{ fontSize: '0.82rem' }}>
                  Téléversez une copie lisible du devis signé par l'établissement hospitalier récepteur.
                </small>
              </div>
            </div>

            <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-3" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-muted small">
                🛡️ Validation humaine obligatoire par un agent de la mutuelle sous 2h à 24h.
              </span>
              <button 
                type="submit" 
                className="btn btn-success px-4 py-2 fw-bold text-white"
                style={{ borderRadius: '12px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
                disabled={submitting}
              >
                {submitting ? 'Transmission en cours...' : '📤 Soumettre la demande'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Onglet : Liste des demandes */}
      {activeTab === 'list' && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
            <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>
              📋 Historique des demandes de garantie
            </h4>
            <button 
              className="btn btn-sm text-white px-3 py-1.5 fw-semibold" 
              onClick={fetchLetters}
              style={{ borderRadius: '8px', background: 'var(--primary)' }}
            >
              🔄 Actualiser
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-success mb-2" role="status"></div>
              <div>Chargement des demandes de garantie...</div>
            </div>
          ) : letters.length === 0 ? (
            <div className="text-center py-5">
              <span style={{ fontSize: '3rem' }}>📄</span>
              <h5 className="fw-bold mt-2" style={{ color: 'var(--text-main)' }}>Aucune demande enregistrée</h5>
              <p className="text-muted" style={{ fontSize: '0.9rem' }}>Vous n'avez actuellement aucune demande de prise en charge hospitalière en cours.</p>
              <button className="btn btn-primary btn-sm fw-bold px-3 py-2 text-white" onClick={() => setActiveTab('new')} style={{ borderRadius: '8px', background: 'var(--primary)' }}>
                ➕ Faire une demande
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle" style={{ color: 'var(--text-main)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Assuré / Bénéficiaire</th>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Acte médical</th>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Montant estimé</th>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Taux accordé</th>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Statut instruction</th>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem' }}>Code garantie</th>
                    <th style={{ color: 'var(--text-main)', padding: '0.85rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="fw-bold" style={{ padding: '0.85rem' }}>
                        <div style={{ color: 'var(--text-main)' }}>{item.first_name} {item.last_name}</div>
                        <small className="text-muted" style={{ fontSize: '0.8rem' }}>N° CMU : {item.cmu_number}</small>
                      </td>
                      <td style={{ color: 'var(--text-main)', padding: '0.85rem' }}>{item.medical_act}</td>
                      <td className="fw-bold text-primary" style={{ padding: '0.85rem' }}>
                        {item.estimated_amount ? `${Number(item.estimated_amount).toLocaleString()} FCFA` : '-'}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span className="badge bg-success px-2.5 py-1" style={{ fontSize: '0.8rem', borderRadius: '6px' }}>
                          {item.guaranteed_percentage}% ({item.max_amount ? `${Number(item.max_amount).toLocaleString()} FCFA` : 'Plafond standard'})
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {item.status === 'approved' && (
                          <span className="badge bg-success-subtle text-success border border-success px-2.5 py-1" style={{ borderRadius: '6px' }}>
                            ✅ Validée par agent
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="badge bg-warning-subtle text-warning border border-warning px-2.5 py-1" style={{ borderRadius: '6px' }}>
                            ⏳ En instruction agent
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="badge bg-danger-subtle text-danger border border-danger px-2.5 py-1" style={{ borderRadius: '6px' }}>
                            ❌ Rejetée
                          </span>
                        )}
                        {item.status === 'used' && (
                          <span className="badge bg-secondary px-2.5 py-1" style={{ borderRadius: '6px' }}>
                            🔒 Validée à l'hôpital
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <code className="px-2 py-1 bg-dark text-success border border-success rounded fw-bold">
                          {item.validation_code}
                        </code>
                      </td>
                      <td style={{ textAlign: 'right', padding: '0.85rem' }}>
                        <button 
                          type="button"
                          className="btn btn-sm text-white fw-bold px-3 py-1.5 shadow-sm"
                          onClick={() => setSelectedLetter(item)}
                          style={{ background: '#059669', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          🔍 Consulter / instruire
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal d'instruction 100% humaine par l'agent */}
      {selectedLetter && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom p-3" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h5 className="modal-title fw-bold" style={{ color: 'var(--primary)' }}>
                    📄 Instruction de garantie #{selectedLetter.validation_code}
                  </h5>
                  <small className="text-muted">Validation humaine obligatoire par l'agent de la mutuelle.</small>
                </div>
                <button className="btn-close" onClick={() => setSelectedLetter(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4 p-3 rounded-3" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <div className="col-md-6">
                    <span className="text-muted small">Assuré bénéficiaire :</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h6>
                    <small className="text-muted">N° Carte CMU : {selectedLetter.cmu_number}</small>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted small">Acte / hospitalisation prescrite :</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{selectedLetter.medical_act}</h6>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted small">Devis estimé :</span>
                    <h5 className="fw-bold text-primary mb-0">{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</h5>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted small">Statut de la demande :</span>
                    <div>
                      <span className="badge bg-warning text-dark">{selectedLetter.status}</span>
                    </div>
                  </div>
                </div>

                <div className="card p-3 border-0" style={{ background: 'rgba(5, 150, 105, 0.05)', borderLeft: '4px solid var(--primary)' }}>
                  <h6 className="fw-bold mb-3" style={{ color: 'var(--primary)' }}>⚙️ Paramètres d'approbation de l'agent</h6>
                  
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Taux de prise en charge (%)</label>
                      <input 
                        type="number" 
                        className="form-control input"
                        value={guaranteedPct}
                        onChange={(e) => setGuaranteedPct(e.target.value)}
                        min="10"
                        max="100"
                        style={{ borderRadius: '8px' }}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Montant plafond garanti (FCFA)</label>
                      <input 
                        type="number" 
                        className="form-control input"
                        placeholder="ex: 200000"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                        style={{ borderRadius: '8px' }}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.4rem' }}>Note / recommandation de l'agent</label>
                      <textarea 
                        className="form-control input"
                        rows="2"
                        value={agentNote}
                        onChange={(e) => setAgentNote(e.target.value)}
                        placeholder="Motif d'acceptation ou de réajustement du plafond..."
                        style={{ borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top d-flex justify-content-between p-3" style={{ borderColor: 'var(--border-color)' }}>
                <button className="btn btn-outline-danger fw-bold px-3 py-2" onClick={() => handleValidateAgent('rejected')} style={{ borderRadius: '10px' }}>
                  ❌ Rejeter la demande
                </button>
                <button className="btn btn-success fw-bold px-4 py-2 text-white" onClick={() => handleValidateAgent('approved')} style={{ background: 'var(--primary)', borderColor: 'var(--primary)', borderRadius: '10px' }}>
                  ✅ Émettre la lettre de garantie officielle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
