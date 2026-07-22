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
    setSubmitting(true);
    setSuccessMsg('');
    try {
      const citizenData = JSON.parse(localStorage.getItem('cmu-citizen') || '{}');
      const res = await fetch('/api/guarantees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beneficiary_id: citizenData.id || 1,
          medical_act: medicalAct,
          estimated_amount: parseFloat(estimatedAmount) || 0
        })
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(lang === 'wo' ? 'Demande bi yónnee nañu ko ak jamm.' : 'Votre demande de prise en charge a été soumise avec succès.');
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
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h2 style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.25rem' }}>
            📜 {lang === 'wo' ? 'Bataaxal yoxu garansi (Lettres de Garantie)' : 'Lettres de Garantie & Prise en Charge Hospitalière'}
          </h2>
          <p className="text-muted mb-0">
            {lang === 'wo' 
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez une prise en charge hospitalière en ligne avec validation 100% humaine par nos agents.'}
          </p>
        </div>

        <div className="d-flex gap-2">
          <button 
            className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('list')}
          >
            📋 {lang === 'wo' ? 'Lim bi' : 'Mes Demandes'}
          </button>
          <button 
            className={`btn ${activeTab === 'new' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setActiveTab('new')}
          >
            ➕ {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle Demande'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4">
          <span className="me-2">✅</span> {successMsg}
        </div>
      )}

      {activeTab === 'new' && (
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
          <h4 className="fw-bold mb-3" style={{ color: 'var(--text-color)' }}>
            📝 {lang === 'wo' ? 'Bindal sa demande prise en charge' : 'Formulaire de Demande de Lettre de Garantie'}
          </h4>
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-semibold">Établissement Sanitaire Partenaire</label>
                <select 
                  className="form-select"
                  value={structureName}
                  onChange={(e) => setStructureName(e.target.value)}
                >
                  <option value="Hôpital Fann">Hôpital Universitaire de Fann (Dakar)</option>
                  <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec (Dakar)</option>
                  <option value="Hôpital Général Idrissa Pouye (Dantec/Pikine)">Hôpital Général de Grand Yoff (HOGIP)</option>
                  <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                  <option value="Clinique de la Madeleine">Clinique de la Madeleine (Dakar)</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label fw-semibold">Montant Estimé du Devis / Acte (FCFA)</label>
                <input 
                  type="number"
                  className="form-input"
                  placeholder="ex: 250000"
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(e.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold">Acte Médical ou Motif d'Hospitalisation</label>
                <textarea 
                  className="form-textarea"
                  rows="3"
                  placeholder="ex: Intervention chirurgicale ORL, Hospitalisation 5 jours..."
                  value={medicalAct}
                  onChange={(e) => setMedicalAct(e.target.value)}
                  required
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-semibold">Pièce Justificative / Prescription (PDF, Image)</label>
                <input type="file" className="form-control" />
                <small className="text-muted">Joignez le devis médical fourni par l'établissement hospitalier.</small>
              </div>
            </div>

            <div className="mt-4 text-end">
              <button type="submit" className="btn btn-success px-4" disabled={submitting}>
                {submitting ? 'Envoi en cours...' : '📤 Soumettre la Demande'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '16px', background: 'var(--card-bg)' }}>
          {loading ? (
            <div className="text-center py-4">Chargement des lettres de garantie...</div>
          ) : letters.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <span style={{ fontSize: '2.5rem' }}>📑</span>
              <p className="mt-2">Aucune demande de lettre de garantie enregistrée pour le moment.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Bénéficiaire</th>
                    <th>Acte Médical</th>
                    <th>Montant Devis</th>
                    <th>Prise en Charge</th>
                    <th>Statut</th>
                    <th>Code Garantie</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {letters.map((item) => (
                    <tr key={item.id}>
                      <td className="fw-bold">{item.first_name} {item.last_name}</td>
                      <td>{item.medical_act}</td>
                      <td>{item.estimated_amount ? `${Number(item.estimated_amount).toLocaleString()} FCFA` : '-'}</td>
                      <td>
                        <span className="badge bg-success">
                          {item.guaranteed_percentage}% ({item.max_amount ? `${Number(item.max_amount).toLocaleString()} FCFA` : 'Plafond normal'})
                        </span>
                      </td>
                      <td>
                        {item.status === 'approved' && <span className="badge bg-success">✅ Validée par Agent</span>}
                        {item.status === 'pending' && <span className="badge bg-warning text-dark">⏳ En Instruction Agent</span>}
                        {item.status === 'rejected' && <span className="badge bg-danger">❌ Rejetée</span>}
                        {item.status === 'used' && <span className="badge bg-secondary">🔒 Utilisée à l'hôpital</span>}
                      </td>
                      <td>
                        <code className="px-2 py-1 bg-light text-primary border rounded fw-bold">
                          {item.validation_code}
                        </code>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-outline-info"
                          onClick={() => setSelectedLetter(item)}
                        >
                          👁️ Détails
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

      {/* Modal Détails & Instruction Agent */}
      {selectedLetter && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ borderRadius: '16px' }}>
              <div className="modal-header">
                <h5 className="modal-header-title fw-bold">
                  📄 Instruction de la Lettre de Garantie #{selectedLetter.validation_code}
                </h5>
                <button className="btn-close" onClick={() => setSelectedLetter(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <p className="mb-1 text-muted">Assuré :</p>
                    <p className="fw-bold">{selectedLetter.first_name} {selectedLetter.last_name} (N° {selectedLetter.cmu_number})</p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1 text-muted">Acte Médical :</p>
                    <p className="fw-bold">{selectedLetter.medical_act}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1 text-muted">Montant Estimé :</p>
                    <p className="fw-bold text-primary">{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</p>
                  </div>
                  <div className="col-md-6">
                    <p className="mb-1 text-muted">Statut Actuel :</p>
                    <p className="fw-bold">{selectedLetter.status}</p>
                  </div>
                </div>

                <hr />

                {/* Formulaire de validation par l'agent */}
                <h6 className="fw-bold mb-3">🛠️ Espace de Décision de l'Agent CMU</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Taux de Prise en Charge (%)</label>
                    <input 
                      type="number" 
                      className="form-control"
                      value={guaranteedPct}
                      onChange={(e) => setGuaranteedPct(e.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Montant Plafond Garanti (FCFA)</label>
                    <input 
                      type="number" 
                      className="form-control"
                      placeholder="ex: 200000"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Note / Motif de la Décision</label>
                    <textarea 
                      className="form-control"
                      rows="2"
                      value={agentNote}
                      onChange={(e) => setAgentNote(e.target.value)}
                      placeholder="Note d'instruction..."
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer d-flex justify-content-between">
                <button className="btn btn-outline-danger" onClick={() => handleValidateAgent('rejected')}>
                  ❌ Rejeter la Demande
                </button>
                <button className="btn btn-success px-4" onClick={() => handleValidateAgent('approved')}>
                  ✅ Valider & Émettre la Lettre de Garantie
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
