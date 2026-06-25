import React, { useState, useEffect } from 'react';

export default function Partnership({ lang, portalMode, agentUser }) {
  const [requests, setRequests] = useState([]);
  const [formData, setFormData] = useState({
    companyName: '',
    sector: 'mécénat',
    contactPerson: '',
    email: '',
    phone: '',
    message: ''
  });
  const [toastMessage, setToastMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const dict = {
    fr: {
      title: 'Espace partenariat',
      subtitle: 'Collaborez avec la Couverture Maladie Universelle de Dakar pour élargir l\'accès aux soins.',
      sectorLabel: 'Secteur de collaboration',
      companyLabel: 'Nom de la structure / entreprise *',
      contactLabel: 'Personne de contact *',
      emailLabel: 'Adresse email *',
      phoneLabel: 'Numéro de téléphone *',
      messageLabel: 'Description du projet ou message *',
      submitBtn: 'Soumettre la demande',
      successMsg: 'Votre demande de partenariat a été soumise avec succès !',
      adminTitle: 'Suivi des demandes de partenariat',
      noRequests: 'Aucune demande enregistrée pour le moment.',
      thCompany: 'Structure',
      thSector: 'Secteur',
      thContact: 'Contact',
      thPhone: 'Téléphone',
      thStatus: 'Statut',
      thActions: 'Actions',
      btnApprove: 'Approuver',
      btnReject: 'Rejeter',
      statusPending: 'En attente',
      statusApproved: 'Approuvé',
      statusRejected: 'Rejeté'
    },
    wo: {
      title: 'Espace partenariat',
      subtitle: 'Collaborez ak CMU Dakar ngir yaatal fajj bi ci gox bi.',
      sectorLabel: 'Secteur de collaboration',
      companyLabel: 'Tourou structure bi *',
      contactLabel: 'Ki nuy contacté *',
      emailLabel: 'Adresse email *',
      phoneLabel: 'Portable *',
      messageLabel: 'Sa projet walla message *',
      submitBtn: 'Duggalal demande bi',
      successMsg: 'Sa demande soti na bu baax !',
      adminTitle: 'Saytu demandes de partenariat yi',
      noRequests: 'Amul demande bu nekk fii.',
      thCompany: 'Structure',
      thSector: 'Secteur',
      thContact: 'Contact',
      thPhone: 'Téléphone',
      thStatus: 'Statut',
      thActions: 'Actions',
      btnApprove: 'Approuver',
      btnReject: 'Rejeter',
      statusPending: 'En attente',
      statusApproved: 'Approuvé',
      statusRejected: 'Rejeté'
    }
  };

  const t = dict[lang] || dict.fr;

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Load requests on mount
  useEffect(() => {
    const stored = localStorage.getItem('cmu-partnership-requests');
    if (stored) {
      try {
        setRequests(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading requests:', e);
      }
    } else {
      // Seed default requests for demo
      const seed = [
        {
          id: 1,
          companyName: 'Fondation Orange Sénégal',
          sector: 'mécénat',
          contactPerson: 'Seynabou Diop',
          email: 'sdiop@orange.sn',
          phone: '77 645 32 10',
          message: 'Souhait de financer la CMU pour 500 élèves de Daara à Medina.',
          status: 'approved',
          date: '22/06/2026'
        },
        {
          id: 2,
          companyName: 'Clinique de la Paix',
          sector: 'médical',
          contactPerson: 'Dr. Cheikh Tidiane',
          email: 'contact@cliniquedelapaix.sn',
          phone: '33 822 40 40',
          message: 'Proposition de convention pour appliquer la gratuité du ticket modérateur.',
          status: 'pending',
          date: '23/06/2026'
        }
      ];
      setRequests(seed);
      localStorage.setItem('cmu-partnership-requests', JSON.stringify(seed));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyName || !formData.contactPerson || !formData.email || !formData.phone || !formData.message) {
      triggerToast(lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires.' : 'Remplir yeup.');
      return;
    }

    const newRequest = {
      ...formData,
      id: Date.now(),
      status: 'pending',
      date: new Date().toLocaleDateString('fr-FR')
    };

    const updated = [newRequest, ...requests];
    setRequests(updated);
    localStorage.setItem('cmu-partnership-requests', JSON.stringify(updated));

    setFormData({
      companyName: '',
      sector: 'mécénat',
      contactPerson: '',
      email: '',
      phone: '',
      message: ''
    });

    setSuccess(true);
    triggerToast(t.successMsg);
    setTimeout(() => setSuccess(false), 4000);
  };

  const handleUpdateStatus = (id, newStatus) => {
    const updated = requests.map(req => {
      if (req.id === id) {
        return { ...req, status: newStatus };
      }
      return req;
    });
    setRequests(updated);
    localStorage.setItem('cmu-partnership-requests', JSON.stringify(updated));
    triggerToast(lang === 'fr' ? `Statut mis à jour : ${newStatus}` : `Statut changé : ${newStatus}`);
  };

  return (
    <div className="partnership-view fade-in-up" style={{ padding: '1rem 0' }}>
      {/* Banner */}
      <section className="banner-mini" style={{
        background: `linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_parrainage_hero_real.png") center/cover no-repeat`,
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {t.title}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      {portalMode === 'agent' && agentUser ? (
        // Administrative view of partnerships
        <div className="card text-left fade-in-up" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '850', color: 'var(--primary)', marginBottom: '1.5rem' }}>
            💼 {t.adminTitle}
          </h3>

          <div className="table-responsive">
            <table className="directory-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>{t.thCompany}</th>
                  <th style={{ padding: '0.75rem' }}>{t.thSector}</th>
                  <th style={{ padding: '0.75rem' }}>{t.thContact}</th>
                  <th style={{ padding: '0.75rem' }}>{t.thPhone}</th>
                  <th style={{ padding: '0.75rem' }}>Message</th>
                  <th style={{ padding: '0.75rem' }}>{t.thStatus}</th>
                  <th style={{ padding: '0.75rem' }}>{t.thActions}</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      {t.noRequests}
                    </td>
                  </tr>
                ) : (
                  requests.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{req.date}</td>
                      <td style={{ padding: '0.75rem' }}><strong>{req.companyName}</strong></td>
                      <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>{req.sector}</td>
                      <td style={{ padding: '0.75rem' }}>{req.contactPerson}</td>
                      <td style={{ padding: '0.75rem' }}>{req.phone}</td>
                      <td style={{ padding: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{req.message}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${
                          req.status === 'approved' ? 'badge-success' :
                          req.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                        }`} style={{
                          backgroundColor: req.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : req.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: req.status === 'approved' ? 'var(--success)' : req.status === 'rejected' ? 'var(--danger)' : 'var(--warning)',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px'
                        }}>
                          {req.status === 'approved' ? t.statusApproved :
                           req.status === 'rejected' ? t.statusRejected : t.statusPending}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                        {req.status === 'pending' && (
                          <>
                            <button 
                              className="btn btn-primary btn-sm" 
                              onClick={() => handleUpdateStatus(req.id, 'approved')}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              {t.btnApprove}
                            </button>
                            <button 
                              className="btn btn-outline btn-sm" 
                              onClick={() => handleUpdateStatus(req.id, 'rejected')}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                            >
                              {t.btnReject}
                            </button>
                          </>
                        )}
                        {req.status !== 'pending' && (
                          <button 
                            className="btn btn-outline btn-sm" 
                            onClick={() => handleUpdateStatus(req.id, 'pending')}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Réinitialiser
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Public partnership form & presentation
        <div className="grid grid-3" style={{ gap: '2rem' }}>
          {/* Partnership Form (Span 2) */}
          <div style={{ gridColumn: 'span 2' }}>
            <div className="card text-left" style={{ padding: '2.5rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '850', color: 'var(--primary)', marginBottom: '1.5rem' }}>
                🤝 {lang === 'fr' ? 'Proposer une collaboration' : 'Proposer une collaboration'}
              </h3>

              {success && (
                <div style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: 'var(--success)',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  {t.successMsg}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{t.companyLabel}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Ex: Fondations, Hôpitaux, Entreprises"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ maxWidth: '250px' }}>
                    <label className="form-label">{t.sectorLabel}</label>
                    <select 
                      className="form-control"
                      value={formData.sector}
                      onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    >
                      <option value="mécénat">Mécénat / RSE</option>
                      <option value="médical">Structure médicale</option>
                      <option value="ong">ONG / Association</option>
                      <option value="collectivité">Collectivité locale</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t.contactLabel}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Prénom & Nom"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.emailLabel}</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      placeholder="nom@structure.sn"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t.phoneLabel}</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      placeholder="Ex: 77 123 45 67"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">{t.messageLabel}</label>
                  <textarea 
                    className="form-control" 
                    rows="6" 
                    placeholder="Décrivez votre idée de partenariat ou de collaboration..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  {t.submitBtn}
                </button>
              </form>
            </div>
          </div>

          {/* Context Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card text-left" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>
                🤝 {lang === 'fr' ? 'Pourquoi collaborer ?' : 'Pourquoi collaborer ?'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                <p style={{ margin: 0 }}>
                  <strong>RSE & Impact Social</strong> : Associez l'image de votre entreprise à la santé solidaire à Dakar.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Réseau de soins</strong> : Connectez votre clinique ou hôpital à notre base d'assurés.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Transparence</strong> : Suivi rigoureux de l'utilisation des fonds sur le portail CMU.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Overlay */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--primary)',
          color: '#fff',
          padding: '0.8rem 1.5rem',
          borderRadius: '30px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10000,
          fontWeight: 'bold',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>✅</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
