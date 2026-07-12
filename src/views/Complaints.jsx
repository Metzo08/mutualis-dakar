import React, { useState, useEffect } from 'react';

export default function Complaints({ lang, portalMode, citizenUser, agentUser }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states (Citizen)
  const [formName, setFormName] = useState(citizenUser ? `${citizenUser.firstName} ${citizenUser.lastName}` : '');
  const [formPhone, setFormPhone] = useState(citizenUser ? citizenUser.phone : '');
  const [formTitle, setFormTitle] = useState('Refus de tiers-payant');
  const [formDescription, setFormDescription] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  // Agent states
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, open, resolved

  const dict = {
    fr: {
      titleCitizen: 'Signaler une réclamation',
      subtitleCitizen: 'Un problème avec votre mutuelle ou un hôpital ? Déposez une réclamation en ligne. Nos agents régionaux prendront contact sous 48h.',
      titleAgent: 'Suivi des réclamations usagers',
      subtitleAgent: 'Consultez, analysez et résolvez les plaintes déposées par les assurés sociaux de Dakar.',
      nameLabel: 'Votre nom complet',
      phoneLabel: 'Numéro de portable',
      subjectLabel: 'Objet de la réclamation',
      descLabel: 'Description détaillée de l\'incident',
      optionTiersPayant: 'Refus de tiers-payant (hôpital / pharmacie)',
      optionCardError: 'Erreur d\'orthographe sur ma carte CMU',
      optionPaymentError: 'Paiement de cotisation non pris en compte',
      optionOther: 'Autre réclamation administrative',
      btnSubmit: 'Envoyer la réclamation',
      successMsg: 'Votre réclamation a été enregistrée avec succès. Elle sera traitée sous peu par un agent régional.',
      btnNew: 'Déposer une autre réclamation',
      thCitizen: 'Assuré',
      thPhone: 'Téléphone',
      thTitle: 'Objet',
      thDesc: 'Description',
      thStatus: 'Statut',
      thAction: 'Action',
      statusOpen: 'Ouvert',
      statusResolved: 'Résolu',
      btnResolve: 'Résoudre',
      noComplaints: 'Aucune réclamation enregistrée.'
    },
    wo: {
      titleCitizen: 'Bindal réclamation',
      subtitleCitizen: 'Am nga problème ci clinique walla pharmacie ? Bindal réclamation fii. Agent yi di nagn la woo.',
      titleAgent: 'Saytu réclamation yi',
      subtitleAgent: 'Xoolal ak régléel plainte yi assuré yi bind ci portal bi.',
      nameLabel: 'Sa tour ak sant',
      phoneLabel: 'Portable',
      subjectLabel: 'Problème bi',
      descLabel: 'Expliquél incident bi',
      optionTiersPayant: 'Refus tiers-payant (hôpital / pharmacie)',
      optionCardError: 'Erreur ci carte CMU',
      optionPaymentError: 'Cotisation bi duggul',
      optionOther: 'Lénéne plainte administrative',
      btnSubmit: 'Envoyer',
      successMsg: 'Sa réclamation duggu na. Agent yi di nagn ko saytu légui.',
      btnNew: 'Bindal réclamation bu bees',
      thCitizen: 'Ki bokk',
      thPhone: 'Portable',
      thTitle: 'Objet',
      thDesc: 'Détails',
      thStatus: 'Statut',
      thAction: 'Liy xew',
      statusOpen: 'Ubbil',
      statusResolved: 'Réglé',
      btnResolve: 'Réglé ko',
      noComplaints: 'Amul réclamation.'
    }
  };

  const t = dict[lang];

  const fetchComplaints = () => {
    setLoading(true);
    fetch('http://localhost:5000/api/complaints', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}` }
    })
      .then(res => res.json())
      .then(payload => {
        const list = Array.isArray(payload) ? payload : (payload.data || []);
        setComplaints(list);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // Fallback local complaints
        setComplaints([
          { id: 1, beneficiary_name: 'Awa Ndiaye', phone: '779876543', title: 'Refus de tiers-payant', description: 'La pharmacie du Plateau a refusé d\'appliquer le taux de 80% sur mon ordonnance d\'Amoxicilline sous prétexte que le système était hors ligne.', status: 'open', created_at: new Date().toISOString() },
          { id: 2, beneficiary_name: 'Modou Diop', phone: '771234567', title: 'Erreur orthographe prénom', description: 'Mon prénom est enregistré en tant que Moudou au lieu de Modou. Merci de corriger.', status: 'resolved', created_at: new Date().toISOString() }
        ]);
      });
  };

  useEffect(() => {
    if (portalMode === 'agent') {
      fetchComplaints();
    }
  }, [portalMode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!formName || !formPhone || !formDescription) {
      setSubmitError(lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires.' : 'Bindal yëf yëpp.');
      return;
    }

    setSubmitLoading(true);
    fetch('http://localhost:5000/api/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        beneficiaryName: formName,
        phone: formPhone,
        title: formTitle,
        description: formDescription
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Erreur serveur');
        return res.json();
      })
      .then(() => {
        setSubmitSuccess(true);
        setSubmitError('');
        setFormDescription('');
        setSubmitLoading(false);
      })
      .catch((err) => {
        setSubmitLoading(false);
        setSubmitError(lang === 'fr' 
          ? 'Erreur lors de l\'envoi. Vérifiez votre connexion et réessayez.' 
          : 'Jafe na. Saytul sa internet te repantal.');
      });
  };

  const handleResolve = (id) => {
    setResolvingId(id);
    setResolutionNotes('');
  };

  const handleSaveResolution = (e) => {
    e.preventDefault();
    if (!resolvingId) return;
    const actor = agentUser ? agentUser.username : 'agent@cmu.sn';
    fetch(`http://localhost:5000/api/complaints/${resolvingId}/resolve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}`
      },
      body: JSON.stringify({ actor, resolutionNotes })
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setComplaints(prev => prev.map(c => c.id === resolvingId ? { ...c, status: 'resolved', resolution_notes: resolutionNotes, resolved_by: actor } : c));
        setResolvingId(null);
        setResolutionNotes('');
        setSelectedComplaint(null);
      })
      .catch(() => alert('Erreur lors de la résolution.'));
  };

  const handleDeleteComplaint = (id) => {
    if (!window.confirm(lang === 'fr' ? 'Voulez-vous supprimer cette réclamation ?' : 'Dax nga beug dindi plainte bi ?')) return;
    fetch(`http://localhost:5000/api/complaints/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => {
        setComplaints(prev => prev.filter(c => c.id !== id));
        setSelectedComplaint(null);
      })
      .catch(() => alert('Erreur lors de la suppression.'));
  };

  return (
    <div className="complaints-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/bg_complaints_stock.jpg") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
          <span className="badge" style={{ marginBottom: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}>
            {portalMode === 'agent' ? '💼 CMU AGENT QUEUE' : '📣 RÉCLAMATION CITOYENNE'}
          </span>
          <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {portalMode === 'agent' ? t.titleAgent : t.titleCitizen}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', maxWidth: '800px', lineHeight: '1.5', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {portalMode === 'agent' ? t.subtitleAgent : t.subtitleCitizen}
          </p>
        </div>
      </section>

      {/* PORTAL MODE CITIZEN */}
      {portalMode === 'citizen' && (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {submitSuccess ? (
            <div className="card text-center fade-in-up" style={{ padding: '3rem' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>✅</div>
              <h3 style={{ fontSize: '1.4rem', color: 'var(--success)', marginBottom: '1rem' }}>Enregistré !</h3>
              <p style={{ color: 'var(--text-sub)', lineHeight: '1.6', marginBottom: '2rem' }}>
                {t.successMsg}
              </p>
              <button className="btn btn-primary" onClick={() => setSubmitSuccess(false)}>
                {t.btnNew}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card fade-in-up" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t.nameLabel}</label>
                <input
                  type="text"
                  className="form-control"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Modou Diop"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t.phoneLabel}</label>
                <input
                  type="tel"
                  className="form-control"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: 771234567"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t.subjectLabel}</label>
                <select
                  className="form-control"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                >
                  <option value="Refus de tiers-payant">{t.optionTiersPayant}</option>
                  <option value="Erreur d'orthographe sur carte CMU">{t.optionCardError}</option>
                  <option value="Paiement cotisation non validé">{t.optionPaymentError}</option>
                  <option value="Autre plainte administrative">{t.optionOther}</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t.descLabel}</label>
                <textarea
                  className="form-control"
                  rows={5}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="..."
                  required
                  style={{ resize: 'vertical' }}
                ></textarea>
              </div>

              <button type="submit" className="btn btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }}>
                {t.btnSubmit}
              </button>
            </form>
          )}
        </div>
      )}

      {/* PORTAL MODE AGENT */}
      {portalMode === 'agent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Status Filter Bar */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <button 
              className={`dept-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Toutes ({complaints.length})
            </button>
            <button 
              className={`dept-tab-btn ${statusFilter === 'open' ? 'active' : ''}`}
              onClick={() => setStatusFilter('open')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Ouvertes ({complaints.filter(c => c.status !== 'resolved').length})
            </button>
            <button 
              className={`dept-tab-btn ${statusFilter === 'resolved' ? 'active' : ''}`}
              onClick={() => setStatusFilter('resolved')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem' }}
            >
              Résolues ({complaints.filter(c => c.status === 'resolved').length})
            </button>
          </div>

          <div className="directory-table-container">
            <table className="directory-table">
              <thead>
                <tr>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thCitizen}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thPhone}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thTitle}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thDesc}</th>
                  <th style={{ padding: '1rem 1.25rem' }}>{t.thStatus}</th>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>{t.thAction}</th>
                </tr>
              </thead>
              <tbody>
                {complaints.filter(c => statusFilter === 'all' ? true : c.status === statusFilter).length > 0 ? (
                  complaints.filter(c => statusFilter === 'all' ? true : c.status === statusFilter).map((comp) => (
                    <tr key={comp.id}>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {comp.beneficiary_name}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left', fontSize: '0.85rem' }}>
                        {comp.phone}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--primary)', fontWeight: '600', fontSize: '0.85rem' }}>
                        {comp.title}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--text-sub)', fontSize: '0.85rem', maxWidth: '250px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                        {comp.description}
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'left' }}>
                        <span className={`badge ${comp.status === 'resolved' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {comp.status === 'resolved' ? t.statusResolved : t.statusOpen}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} 
                            onClick={() => setSelectedComplaint(comp)}
                          >
                            👁️
                          </button>
                          {comp.status === 'open' && (
                            <button 
                              className="btn btn-outline btn-sm" 
                              style={{ color: 'var(--success)', borderColor: 'var(--success)', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} 
                              onClick={() => handleResolve(comp.id)}
                            >
                              ✓
                            </button>
                          )}
                          <button 
                            className="btn btn-outline btn-sm" 
                            style={{ color: 'var(--danger)', borderColor: 'var(--danger)', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} 
                            onClick={() => handleDeleteComplaint(comp.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                      {loading ? '...' : t.noComplaints}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resolution notes dialog modal popup */}
      {resolvingId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,8,15,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1.5rem' }}>
          <div className="card fade-in-up" style={{ width: '100%', maxWidth: '450px', padding: '2.5rem 2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', textAlign: 'left', position: 'relative' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', fontWeight: '800' }}>
              ✓ Résoudre la réclamation
            </h2>
            <button onClick={() => setResolvingId(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-sub)' }}>
              ✕
            </button>
            <form onSubmit={handleSaveResolution} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Remarques / Notes d'intervention de l'agent</label>
                <textarea 
                  className="form-control" 
                  rows="4" 
                  placeholder="Décrivez les actions menées pour résoudre ce problème (ex: contact de la pharmacie, correction orthographe faite...)"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                Enregistrer la résolution
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Selected complaint details view modal */}
      {selectedComplaint && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5,8,15,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '1.5rem' }}>
          <div className="card fade-in-up" style={{ width: '100%', maxWidth: '500px', padding: '2.5rem 2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px', textAlign: 'left', position: 'relative' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.25rem', fontWeight: '800' }}>
              📋 Fiche de réclamation
            </h2>
            <button onClick={() => setSelectedComplaint(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-sub)' }}>
              ✕
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem' }}>
              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Assuré</strong>
                <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{selectedComplaint.beneficiary_name}</span>
              </div>
              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Téléphone</strong>
                <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{selectedComplaint.phone}</span>
              </div>
              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Objet</strong>
                <span style={{ color: 'var(--primary)', fontWeight: '700' }}>{selectedComplaint.title}</span>
              </div>
              <div>
                <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Description de l'incident</strong>
                <p style={{ color: 'var(--text-sub)', margin: '0.2rem 0 0 0', lineHeight: '1.5' }}>{selectedComplaint.description}</p>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Statut du dossier</strong>
                <span className={`badge ${selectedComplaint.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>
                  {selectedComplaint.status === 'resolved' ? 'Résolu' : 'Ouvert / En cours'}
                </span>
              </div>

              {selectedComplaint.status === 'resolved' && (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid var(--success)', marginTop: '0.5rem' }}>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'block', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Notes d'intervention de l'agent</strong>
                  <p style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    "{selectedComplaint.resolution_notes || 'Aucun détail fourni.'}"
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>
                    Résolu par : {selectedComplaint.resolved_by || 'agent@cmu.sn'}
                  </span>
                </div>
              )}

              {selectedComplaint.status === 'open' && (
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={() => { handleResolve(selectedComplaint.id); }}
                >
                  ✓ Résoudre ce problème
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
