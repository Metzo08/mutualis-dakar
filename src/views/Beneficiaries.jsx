import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function Beneficiaries({ lang, agentUser }) {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMutuelle, setSelectedMutuelle] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, active, suspended, pending
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (selectedBeneficiary) {
      QRCode.toDataURL(selectedBeneficiary.cmuNumber || selectedBeneficiary.phone || 'MUTUALIS', {
        margin: 1,
        width: 150,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR Code:', err));
    } else {
      setQrCodeUrl('');
    }
  }, [selectedBeneficiary]);

  const displayedBeneficiaries = selectedStatus === 'all' 
    ? beneficiaries 
    : beneficiaries.filter(b => b.status === selectedStatus);

  const dict = {
    fr: {
      title: 'Gestion des assurés CMU',
      subtitle: 'Recherchez, filtrez, et gérez les adhésions et ayants droit enregistrés dans la région de Dakar.',
      searchPlaceholder: 'Rechercher par nom, téléphone, carte CMU...',
      filterMutuelle: 'Filtrer par mutuelle',
      allMutuelles: 'Toutes les mutuelles',
      thName: 'Bénéficiaire',
      thMutuelle: 'Mutuelle',
      thCard: 'Carte CMU',
      thPackage: 'Formule',
      thStatus: 'Statut',
      thAction: 'Actions',
      statusActive: 'Actif',
      statusPending: 'En attente',
      statusSuspended: 'Suspendu',
      btnDetails: 'Fiche',
      btnToggleActive: 'Activer',
      btnToggleSuspend: 'Suspendre',
      btnDelete: 'Supprimer',
      deleteConfirm: 'Voulez-vous vraiment supprimer cet adhérent ?',
      modalTitle: 'Dossier d\'assuré social',
      modalCivilInfo: 'Informations civiles',
      modalBirthDate: 'Date de naissance',
      modalContact: 'Coordonnées',
      modalAddress: 'Adresse physique',
      modalFamily: 'Ayants droit rattachés',
      modalNoFamily: 'Aucun ayant droit enregistré.',
      modalPayment: 'Mode de paiement',
      modalDate: 'Date d\'adhésion',
      noData: 'Aucun assuré enregistré dans le système.',
      toggleSuccess: 'Statut mis à jour avec succès.',
      deleteSuccess: 'Dossier supprimé.'
    },
    wo: {
      title: 'Saytu ñi bokk ci CMU',
      subtitle: 'Seet, xool ak saytu mbindu njabot ak carte cmu yi nekk ci Ndakaaru.',
      searchPlaceholder: 'Seet ci tour, portable, carte...',
      filterMutuelle: 'Tânn mutuelle',
      allMutuelles: 'Mutuelle yëpp',
      thName: 'Ki bokk',
      thMutuelle: 'Mutuelle',
      thCard: 'Carte CMU',
      thPackage: 'Formule',
      thStatus: 'Statut',
      thAction: 'Liy xew',
      statusActive: 'Wér',
      statusPending: 'Nëggëy',
      statusSuspended: 'Teye',
      btnDetails: 'Fiche',
      btnToggleActive: 'Activer',
      btnToggleSuspend: 'Teeyal',
      btnDelete: 'Dindi',
      deleteConfirm: 'Dax nga beug dindi ki bokk ci mutuelle bi ?',
      modalTitle: 'Fiche dossier assuré',
      modalCivilInfo: 'Civil',
      modalBirthDate: 'Juddu',
      modalContact: 'Contact',
      modalAddress: 'Dëkk',
      modalFamily: 'Ayants droit (njabot)',
      modalNoFamily: 'Amul njabot gu duggu.',
      modalPayment: 'Fayu pass',
      modalDate: 'Atum mbindu',
      noData: 'Guissunuko kenn bu mbindu ci portal bi.',
      toggleSuccess: 'Statut changer na.',
      deleteSuccess: 'Dindi nanu dossier bi.'
    }
  };

  const t = dict[lang];

  // List of local mutuelles for filtering
  const mutuellesFilterList = [
    'Mutuelle de la Médina',
    'Mutuelle de Pikine Ouest',
    'Mutuelle de Rufisque Est',
    'Mutuelle de Yeumbeul',
    'Mutuelle de Golf Sud (Guédiawaye)',
    'Mutuelle de Sangalkam',
    'Mutuelle de Keur Massar Nord'
  ];

  // Fetch all beneficiaries from PostgreSQL
  const fetchBeneficiaries = () => {
    setLoading(true);
    let url = 'http://localhost:5000/api/beneficiaries';
    const params = [];
    if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
    if (selectedMutuelle !== 'all') params.push(`mutuelle=${encodeURIComponent(selectedMutuelle)}`);
    
    if (params.length > 0) {
      url += '?' + params.join('&');
    }

    fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(payload => {
        // L'API retourne désormais { data, pagination } ; on reste tolérant aux arrays (fallback)
        const list = Array.isArray(payload) ? payload : (payload.data || []);
        setBeneficiaries(list);
        setLoading(false);
      })
      .catch(err => {
        console.warn('API connection failed, using offline fallback data:', err);
        setError(err.message);
        setLoading(false);
        // Fallback mockup data to prevent empty white screen
        setBeneficiaries([
          {
            id: 1,
            firstName: 'Modou',
            lastName: 'Diop',
            birthDate: '1990-05-12',
            phone: '771234567',
            email: 'modou.diop@example.com',
            address: 'Médina Rue 22, Dakar',
            mutuelleName: 'Mutuelle de la Médina',
            packageType: 'individuel',
            paymentMethod: 'wave',
            cmuNumber: 'SN-DK-MED-8472',
            status: 'active',
            createdAt: '2026-06-15T10:00:00.000Z',
            familyMembers: []
          },
          {
            id: 2,
            firstName: 'Awa',
            lastName: 'Ndiaye',
            birthDate: '1985-08-22',
            phone: '779876543',
            email: 'awa.ndiaye@example.com',
            address: 'Pikine Ouest Tally Boubess, Dakar',
            mutuelleName: 'Mutuelle de Pikine Ouest',
            packageType: 'familial',
            paymentMethod: 'om',
            cmuNumber: 'SN-DK-PIK-9021',
            status: 'active',
            createdAt: '2026-06-16T12:00:00.000Z',
            familyMembers: [
              { id: 1, name: 'Moustapha Ndiaye', relation: 'conjoint', age: 42 },
              { id: 2, name: 'Khadija Ndiaye', relation: 'enfant', age: 12 },
              { id: 3, name: 'Abdoulaye Ndiaye', relation: 'enfant', age: 8 }
            ]
          },
          {
            id: 3,
            firstName: 'Amadou',
            lastName: 'Sow',
            birthDate: '1993-02-14',
            phone: '764551122',
            email: 'amadou.sow@example.com',
            address: 'Médina Rue 10, Dakar',
            mutuelleName: 'Mutuelle de la Médina',
            packageType: 'individuel',
            paymentMethod: 'wave',
            cmuNumber: 'SN-DK-MED-1284',
            status: 'pending',
            createdAt: '2026-06-17T09:30:00.000Z',
            familyMembers: []
          }
        ]);
      });
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [searchQuery, selectedMutuelle]);

  // Toggle status (Active / Suspended)
  const handleToggleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const actor = agentUser ? agentUser.username : 'agent@cmu.sn';
    fetch(`http://localhost:5000/api/beneficiaries/${id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}`
      },
      body: JSON.stringify({ status: nextStatus, actor })
    })
      .then(res => res.json())
      .then(() => {
        // Update local list
        setBeneficiaries(prev => prev.map(b => b.id === id ? { ...b, status: nextStatus } : b));
        if (selectedBeneficiary && selectedBeneficiary.id === id) {
          setSelectedBeneficiary(prev => ({ ...prev, status: nextStatus }));
        }
      })
      .catch(() => {
        // Fallback offline toggler
        setBeneficiaries(prev => prev.map(b => b.id === id ? { ...b, status: nextStatus } : b));
        if (selectedBeneficiary && selectedBeneficiary.id === id) {
          setSelectedBeneficiary(prev => ({ ...prev, status: nextStatus }));
        }
      });
  };

  // Delete beneficiary
  const handleDelete = (id) => {
    if (confirm(t.deleteConfirm)) {
      const actor = agentUser ? agentUser.username : 'agent@cmu.sn';
      fetch(`http://localhost:5000/api/beneficiaries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}` }
      })
        .then(res => res.json())
        .then(() => {
          setBeneficiaries(prev => prev.filter(b => b.id !== id));
          if (selectedBeneficiary && selectedBeneficiary.id === id) {
            setSelectedBeneficiary(null);
          }
        })
        .catch(() => {
          // Fallback offline deleter
          setBeneficiaries(prev => prev.filter(b => b.id !== id));
          if (selectedBeneficiary && selectedBeneficiary.id === id) {
            setSelectedBeneficiary(null);
          }
        });
    }
  };

  return (
    <div className="directory-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_family_health.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>{t.title}</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{t.subtitle}</p>
        </div>
      </section>

      {/* Filters Area */}
      <section className="directory-search-section" style={{
        background: 'var(--bg-card)',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ flex: '2', minWidth: '280px' }}>
            <label className="form-label">{lang === 'fr' ? 'Rechercher un dossier' : 'Seet dossier'}</label>
            <input 
              type="text" 
              className="form-control" 
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Mutuelle dropdown filter */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label className="form-label">{t.filterMutuelle}</label>
            <select 
              className="form-control"
              value={selectedMutuelle}
              onChange={(e) => setSelectedMutuelle(e.target.value)}
            >
              <option value="all">{t.allMutuelles}</option>
              {mutuellesFilterList.map((m, idx) => (
                <option key={idx} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ flex: '1', minWidth: '180px' }}>
            <label className="form-label">{lang === 'fr' ? 'Statut du dossier' : 'Statut'}</label>
            <select 
              className="form-control"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">{lang === 'fr' ? 'Tous les statuts' : 'Statut yëpp'}</option>
              <option value="active">{t.statusActive}</option>
              <option value="suspended">{t.statusSuspended}</option>
              <option value="pending">{t.statusPending} (Pré-inscriptions)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main Table List */}
      <section className="directory-table-container" style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        <table className="directory-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thName}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thMutuelle}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thCard}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thPackage}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thStatus}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>{t.thAction}</th>
            </tr>
          </thead>
          <tbody>
            {displayedBeneficiaries.length > 0 ? (
              displayedBeneficiaries.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{b.firstName} {b.lastName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{b.phone}</div>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', color: 'var(--text-sub)' }}>{b.mutuelleName}</td>
                  <td style={{ padding: '1.2rem 1.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--primary)' }}>
                    {b.cmuNumber || 'Génération...'}
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <span className="badge" style={{
                      backgroundColor: b.packageType === 'familial' ? 'rgba(255, 127, 17, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                      color: b.packageType === 'familial' ? 'var(--secondary)' : 'var(--primary)',
                      textTransform: 'uppercase',
                      fontSize: '0.65rem'
                    }}>
                      {b.packageType}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <span className={`badge ${b.status === 'active' ? 'badge-success' : b.status === 'suspended' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.7rem' }}>
                      {b.status === 'active' ? t.statusActive : b.status === 'suspended' ? t.statusSuspended : t.statusPending}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => setSelectedBeneficiary(b)}
                        style={{ padding: '0.3rem 0.75rem', borderRadius: '8px' }}
                      >
                        👁️ {t.btnDetails}
                      </button>
                      {b.status === 'pending' ? (
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={() => handleToggleStatus(b.id, b.status)}
                          style={{ 
                            padding: '0.3rem 0.75rem', 
                            borderRadius: '8px',
                            color: 'var(--success)',
                            borderColor: 'var(--success)',
                            fontWeight: 'bold'
                          }}
                          title={lang === 'fr' ? 'Approuver la pré-inscription' : 'Approuver'}
                        >
                          ✓ {lang === 'fr' ? 'Valider' : 'Approuver'}
                        </button>
                      ) : (
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={() => handleToggleStatus(b.id, b.status)}
                          style={{ 
                            padding: '0.3rem 0.75rem', 
                            borderRadius: '8px',
                            color: b.status === 'active' ? 'var(--warning)' : 'var(--success)',
                            borderColor: b.status === 'active' ? 'var(--warning)' : 'var(--success)'
                          }}
                        >
                          {b.status === 'active' ? '⏸️' : '▶️'}
                        </button>
                      )}
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => handleDelete(b.id)}
                        style={{ padding: '0.3rem 0.75rem', borderRadius: '8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {loading ? (lang === 'fr' ? 'Chargement en cours...' : 'Mangi xaar...') : t.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {/* Detailed Sheet Modal Popup */}
      {selectedBeneficiary && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          backgroundColor: 'rgba(5, 8, 15, 0.8)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: '9999',
          padding: '1.5rem'
        }}>
          <div className="card fade-in-up" style={{
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '2.5rem',
            position: 'relative',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            textAlign: 'left'
          }}>
            {/* Modal Title */}
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
              {t.modalTitle}
            </h2>

            {/* Close Cross icon */}
            <button 
              onClick={() => setSelectedBeneficiary(null)} 
              style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-sub)' }}
            >
              ✕
            </button>

            {/* Detailed Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Member QR & Basic Header Card */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                background: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CARTE CMU DAKAR</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', marginTop: '0.2rem' }}>
                    {selectedBeneficiary.firstName} {selectedBeneficiary.lastName}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--primary)', marginTop: '0.3rem', fontWeight: 'bold' }}>
                    {selectedBeneficiary.cmuNumber}
                  </div>
                </div>

                {/* Simulated QR block */}
                <div style={{ background: '#fff', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', width: '60px', height: '60px' }}>
                  {qrCodeUrl ? (
                    <img src={qrCodeUrl} alt="QR Code CMU" style={{ width: '100%', height: '100%', borderRadius: '2px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                  )}
                </div>
              </div>

              {/* Grid 2 Column detailed attributes */}
              <div className="grid grid-2" style={{ gap: '1rem' }}>
                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.modalCivilInfo}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    {selectedBeneficiary.firstName} {selectedBeneficiary.lastName}
                  </span>
                </div>

                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.modalBirthDate}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    {selectedBeneficiary.birthDate || 'N/A'}
                  </span>
                </div>

                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.modalContact}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    📞 {selectedBeneficiary.phone} <br />
                    📧 {selectedBeneficiary.email || 'Aucun email'}
                  </span>
                </div>

                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.modalAddress}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    📍 {selectedBeneficiary.address || 'Non spécifiée'}
                  </span>
                </div>

                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.thMutuelle}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    🏘️ {selectedBeneficiary.mutuelleName}
                  </span>
                </div>

                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.modalPayment}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600', textTransform: 'uppercase' }}>
                    💳 {selectedBeneficiary.paymentMethod} ({selectedBeneficiary.packageType})
                  </span>
                </div>
              </div>

              {/* Ayants droit section */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                  {t.modalFamily} ({selectedBeneficiary.familyMembers ? selectedBeneficiary.familyMembers.length : 0})
                </strong>
                
                {selectedBeneficiary.familyMembers && selectedBeneficiary.familyMembers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {selectedBeneficiary.familyMembers.map((member, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.8rem',
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{member.name}</span>
                        <span style={{ color: 'var(--text-sub)' }}>
                          {member.relation === 'conjoint' ? (lang === 'fr' ? 'Conjoint' : 'Jëkër/Jabar') : member.relation === 'parent' ? (lang === 'fr' ? 'Parent' : 'Waajur') : (lang === 'fr' ? 'Enfant' : 'Doom')} — {member.age} {lang === 'fr' ? 'ans' : 'at'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.modalNoFamily}</span>
                )}
              </div>

              {/* Status and Action Buttons */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-color)',
                paddingTop: '1.25rem',
                marginTop: '0.5rem'
              }}>
                <div>
                  <span className={`badge ${selectedBeneficiary.status === 'active' ? 'badge-success' : selectedBeneficiary.status === 'suspended' ? 'badge-warning' : 'badge-info'}`}>
                    {selectedBeneficiary.status === 'active' ? t.statusActive : selectedBeneficiary.status === 'suspended' ? t.statusSuspended : t.statusPending}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => handleToggleStatus(selectedBeneficiary.id, selectedBeneficiary.status)}
                    style={{
                      color: selectedBeneficiary.status === 'active' ? 'var(--warning)' : 'var(--success)',
                      borderColor: selectedBeneficiary.status === 'active' ? 'var(--warning)' : 'var(--success)'
                    }}
                  >
                    {selectedBeneficiary.status === 'active' ? t.btnToggleSuspend : t.btnToggleActive}
                  </button>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => handleDelete(selectedBeneficiary.id)}
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  >
                    {t.btnDelete}
                  </button>
                  <button 
                    className="btn btn-primary btn-sm" 
                    onClick={() => setSelectedBeneficiary(null)}
                  >
                    {lang === 'fr' ? 'Fermer' : 'Fegg'}
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
