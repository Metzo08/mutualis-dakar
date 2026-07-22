import React, { useState, useEffect } from 'react';

export default function GuaranteeLetters({ lang = 'fr', userRole = 'citizen' }) {
  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Formulaire de demande (Assuré)
  const [medicalAct, setMedicalAct] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [structureName, setStructureName] = useState('Hôpital Fann');
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
      if (json.success) {
        setLetters(json.data || []);
      }
    } catch (err) {
      console.error('Erreur chargement garanties:', err);
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

    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const res = await fetch('/api/guarantees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          medical_act: `${medicalAct} — (${structureName})`,
          estimated_amount: parseFloat(estimatedAmount) || 0
        })
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(lang === 'wo' ? 'Demande bi yónnee nañu ko ak jamm.' : 'Votre demande de Lettre de Garantie a été soumise avec succès et est en attente d\'instruction agent.');
        setMedicalAct('');
        setEstimatedAmount('');
        setActiveTab('list');
        fetchLetters();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidateAgent = async (status) => {
    if (!selectedLetter) return;
    try {
      const res = await fetch(`/api/guarantees/${selectedLetter.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          guaranteed_percentage: parseFloat(guaranteedPct),
          max_amount: parseFloat(maxAmount) || selectedLetter.estimated_amount,
          agent_note: agentNote
        })
      });
      const json = await res.json();
      if (json.success) {
        setSelectedLetter(null);
        fetchLetters();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="container py-4 fade-in-up">
      {/* Header avec Bannière Glassmorphism */}
      <div 
        className="p-4 mb-4 rounded-4 text-white d-flex justify-content-between align-items-center flex-wrap gap-3"
        style={{
          background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.3)'
        }}
      >
        <div>
          <span className="badge bg-white text-success fw-bold px-3 py-1 mb-2" style={{ fontSize: '0.75rem', borderRadius: '20px' }}>
            📜 SÉN-CSU — Prise en Charge Hospitalière 80% à 100%
          </span>
          <h2 className="fw-bold mb-1 text-white">
            {lang === 'wo' ? 'Bataaxal yoxu garansi (Lettres de Garantie)' : 'Lettres de Garantie & Hospitalisation'}
          </h2>
          <p className="mb-0 text-white-50" style={{ fontSize: '0.9rem' }}>
            {lang === 'wo'
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez votre prise en charge hospitalière en ligne avec validation 100% humaine obligatoire par nos agents CMU.'}
          </p>
        </div>

        <div className="d-flex gap-2">
          <button 
            className={`btn px-4 py-2 fw-bold ${activeTab === 'list' ? 'btn-light text-success shadow' : 'btn-outline-light'}`}
            style={{ borderRadius: '12px' }}
            onClick={() => setActiveTab('list')}
          >
            📋 {lang === 'wo' ? 'Lim bi' : 'Mes Demandes'}
          </button>
          <button 
            className={`btn px-4 py-2 fw-bold ${activeTab === 'new' ? 'btn-light text-success shadow' : 'btn-outline-light'}`}
            style={{ borderRadius: '12px' }}
            onClick={() => setActiveTab('new')}
          >
            ➕ {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle Demande'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 shadow-sm border-0">
          <span className="fs-5 me-2">✅</span>
          <div>{successMsg}</div>
        </div>
      )}

      {/* Onglet : Nouvelle Demande */}
      {activeTab === 'new' && (
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <div className="d-flex align-items-center gap-2 mb-3 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
            <span className="fs-3">📝</span>
            <div>
              <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>
                {lang === 'wo' ? 'Bindal sa demande' : 'Formulaire de Demande de Prise en Charge'}
              </h4>
              <small className="text-muted">Remplissez les détails du devis ou de l'acte médical prescrit par le médecin.</small>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>
                  🏥 Établissement Sanitaire Partenaire
                </label>
                <select 
                  className="form-select input"
                  value={structureName}
                  onChange={(e) => setStructureName(e.target.value)}
                  style={{ borderRadius: '10px', height: '48px' }}
                >
                  <option value="Hôpital Fann">Hôpital Universitaire de Fann (Dakar)</option>
                  <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec (Dakar)</option>
                  <option value="Hôpital Général Idrissa Pouye (HOGIP)">Hôpital Général Idrissa Pouye (HOGIP Pikine)</option>
                  <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                  <option value="Clinique de la Madeleine">Clinique de la Madeleine (Dakar)</option>
                  <option value="Centre de Santé Gaspart Camara">Centre de Santé Gaspart Camara</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>
                  💰 Montant Estimé du Devis / Acte (FCFA)
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
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>
                  🩺 Acte Médical ou Motif d'Hospitalisation Prescrit
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
                <label className="form-label fw-semibold" style={{ color: 'var(--text-main)' }}>
                  📎 Joindre la Prescription ou Devis de l'Hôpital (PDF, Photo)
                </label>
                <input 
                  type="file" 
                  className="form-control input" 
                  style={{ borderRadius: '10px', height: '48px' }}
                />
                <small className="text-muted mt-1 d-block">
                  Téléversez une copie lisible du devis signé par l'établissement hospitalier récepteur.
                </small>
              </div>
            </div>

            <div className="mt-4 pt-3 border-top d-flex justify-content-between align-items-center" style={{ borderColor: 'var(--border-color)' }}>
              <span className="text-muted small">
                🛡️ Validation par un Agent de la Mutuelle sous 2h à 24h.
              </span>
              <button 
                type="submit" 
                className="btn btn-success px-4 py-2 fw-bold"
                style={{ borderRadius: '12px', background: 'var(--primary)', borderColor: 'var(--primary)' }}
                disabled={submitting}
              >
                {submitting ? 'Transmission...' : '📤 Soumettre la Demande à l\'Agent'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Onglet : Liste des Demandes */}
      {activeTab === 'list' && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>
              📋 Historique des Demandes de Garantie
            </h4>
            <button className="btn btn-sm btn-outline-secondary" onClick={fetchLetters}>
              🔄 Actualiser
            </button>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-success mb-2" role="status"></div>
              <div>Chargement des lettres de garantie...</div>
            </div>
          ) : letters.length === 0 ? (
            <div className="text-center py-5">
              <span style={{ fontSize: '3rem' }}>📄</span>
              <h5 className="fw-bold mt-2" style={{ color: 'var(--text-main)' }}>Aucune Demande Enregistrée</h5>
              <p className="text-muted">Vous n'avez actuellement aucune demande de prise en charge hospitalière en cours.</p>
              <button className="btn btn-primary btn-sm fw-bold" onClick={() => setActiveTab('new')}>
                ➕ Faire une Demande
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle" style={{ color: 'var(--text-main)' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ color: 'var(--text-main)' }}>Assuré / Bénéficiaire</th>
                    <th style={{ color: 'var(--text-main)' }}>Acte Médical</th>
                    <th style={{ color: 'var(--text-main)' }}>Montant Estimé</th>
                    <th style={{ color: 'var(--text-main)' }}>Taux Accordé</th>
                    <th style={{ color: 'var(--text-main)' }}>Statut Instruction</th>
                    <th style={{ color: 'var(--text-main)' }}>Code Garantie</th>
                    <th style={{ color: 'var(--text-main)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="fw-bold">
                        <div style={{ color: 'var(--text-main)' }}>{item.first_name} {item.last_name}</div>
                        <small className="text-muted">N° CMU : {item.cmu_number}</small>
                      </td>
                      <td style={{ color: 'var(--text-main)' }}>{item.medical_act}</td>
                      <td className="fw-bold text-primary">
                        {item.estimated_amount ? `${Number(item.estimated_amount).toLocaleString()} FCFA` : '-'}
                      </td>
                      <td>
                        <span className="badge bg-success px-2 py-1" style={{ fontSize: '0.8rem' }}>
                          {item.guaranteed_percentage}% ({item.max_amount ? `${Number(item.max_amount).toLocaleString()} FCFA` : 'Plafond standard'})
                        </span>
                      </td>
                      <td>
                        {item.status === 'approved' && (
                          <span className="badge bg-success-subtle text-success border border-success px-2 py-1">
                            ✅ Validée par Agent
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="badge bg-warning-subtle text-warning border border-warning px-2 py-1">
                            ⏳ En Instruction Agent
                          </span>
                        )}
                        {item.status === 'rejected' && (
                          <span className="badge bg-danger-subtle text-danger border border-danger px-2 py-1">
                            ❌ Rejetée
                          </span>
                        )}
                        {item.status === 'used' && (
                          <span className="badge bg-secondary px-2 py-1">
                            🔒 Prise en Charge Validée l'Hôpital
                          </span>
                        )}
                      </td>
                      <td>
                        <code className="px-2 py-1 bg-dark text-success border border-success rounded fw-bold">
                          {item.validation_code}
                        </code>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-sm btn-outline-success fw-bold"
                          onClick={() => setSelectedLetter(item)}
                        >
                          🔍 Consulter / Instruire
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

      {/* Modal d'Instruction 100% Humaine Agent */}
      {selectedLetter && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
              <div className="modal-header border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h5 className="modal-title fw-bold" style={{ color: 'var(--primary)' }}>
                    📄 Instruction de Garantie #{selectedLetter.validation_code}
                  </h5>
                  <small className="text-muted">Validation humaine obligatoire par l'Agent de la Mutuelle.</small>
                </div>
                <button className="btn-close" onClick={() => setSelectedLetter(null)}></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4 p-3 rounded-3" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <div className="col-md-6">
                    <span className="text-muted small">Assuré Bénéficiaire :</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h6>
                    <small className="text-muted">N° Carte CMU : {selectedLetter.cmu_number}</small>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted small">Acte / Hospitalisation Prescrite :</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{selectedLetter.medical_act}</h6>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted small">Devis Estimé :</span>
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
                  <h6 className="fw-bold mb-2" style={{ color: 'var(--primary)' }}>⚙️ Paramètres d'Approbation de l'Agent</h6>
                  
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Taux de Prise en Charge (%)</label>
                      <input 
                        type="number" 
                        className="form-control input"
                        value={guaranteedPct}
                        onChange={(e) => setGuaranteedPct(e.target.value)}
                        min="10"
                        max="100"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Montant Plafond Garanti (FCFA)</label>
                      <input 
                        type="number" 
                        className="form-control input"
                        placeholder="ex: 200000"
                        value={maxAmount}
                        onChange={(e) => setMaxAmount(e.target.value)}
                      />
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-semibold">Note / Recommandation de l'Agent</label>
                      <textarea 
                        className="form-control input"
                        rows="2"
                        value={agentNote}
                        onChange={(e) => setAgentNote(e.target.value)}
                        placeholder="Motif d'acceptation ou de réajustement du plafond..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top d-flex justify-content-between p-3" style={{ borderColor: 'var(--border-color)' }}>
                <button className="btn btn-outline-danger fw-bold" onClick={() => handleValidateAgent('rejected')}>
                  ❌ Rejeter la Demande
                </button>
                <button className="btn btn-success fw-bold px-4" onClick={() => handleValidateAgent('approved')} style={{ background: 'var(--primary)' }}>
                  ✅ Émettre la Lettre de Garantie Officielle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
