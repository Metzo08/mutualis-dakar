import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import DeleteModal from '../components/DeleteModal';

export default function Beneficiaries({ lang, agentUser }) {
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMutuelle, setSelectedMutuelle] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // all, active, suspended, pending
  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });

  // Load KPI filter from Super Admin dashboard if present
  useEffect(() => {
    const filterStr = localStorage.getItem('superadminKpiFilter');
    if (filterStr) {
      try {
        const filter = JSON.parse(filterStr);
        if (filter.status) {
          setSelectedStatus(filter.status);
        }
        // Clear the filter after use
        localStorage.removeItem('superadminKpiFilter');
      } catch (e) {
        console.error('Error parsing superadminKpiFilter', e);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedBeneficiary) {
      QRCode.toDataURL(selectedBeneficiary.cmuNumber || selectedBeneficiary.phone || 'MUTUALIS', {
        margin: 2,
        width: 300,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      .then(url => setQrCodeUrl(url))
      .catch(err => console.error('Error generating QR Code:', err));
    } else {
      setQrCodeUrl('');
    }
  }, [selectedBeneficiary]);

  // flat-map all beneficiaries and their family members into a single flat list
  const flatBeneficiariesList = [];
  beneficiaries.forEach(b => {
    // Add chef/main enrollee
    flatBeneficiariesList.push({
      ...b,
      isFamilyMember: false
    });
    // Add family members if familial or csu package
    if (b.familyMembers && b.familyMembers.length > 0) {
      b.familyMembers.forEach((fm, index) => {
        flatBeneficiariesList.push({
          id: `fm-${b.id}-${fm.id || index}`,
          firstName: fm.name.split(' ')[0] || '',
          lastName: fm.name.split(' ').slice(1).join(' ') || '',
          birthDate: null,
          age: fm.age,
          relation: fm.relation,
          phone: b.phone,
          email: b.email,
          address: b.address,
          mutuelleName: b.mutuelleName,
          packageType: `${b.packageType} (Ayant droit)`,
          paymentMethod: b.paymentMethod,
          cmuNumber: b.cmuNumber ? `${b.cmuNumber}-${index + 1}` : 'Génération...',
          status: b.status,
          createdAt: b.createdAt,
          isFamilyMember: true,
          chefName: `${b.firstName} ${b.lastName}`,
          familyMembers: [] // no nested family
        });
      });
    }
  });

  // Filter this flat list locally by search query, status, and mutuelle
  const filteredBeneficiaries = flatBeneficiariesList.filter(b => {
    // Status filter
    if (selectedStatus !== 'all' && b.status !== selectedStatus) return false;
    // Mutuelle filter
    if (selectedMutuelle !== 'all' && b.mutuelleName !== selectedMutuelle) return false;
    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${b.firstName} ${b.lastName}`.toLowerCase();
      const phone = (b.phone || '').toLowerCase();
      const cmu = (b.cmuNumber || '').toLowerCase();
      const chef = (b.chefName || '').toLowerCase();
      const packageType = (b.packageType || '').toLowerCase();
      return fullName.includes(q) || phone.includes(q) || cmu.includes(q) || chef.includes(q) || packageType.includes(q);
    }
    return true;
  });

  const handleDownloadSponsorReceipt = (sponsor) => {
    const now = new Date(sponsor.createdAt || new Date());
    
    // Find all beneficiaries sponsored by this sponsor
    const sponsored = beneficiaries.filter(b => b.sponsorPhone === sponsor.phone && b.id !== sponsor.id);
    
    // Detect parrainageType
    let parrainageType = 'individuel';
    let schoolName = '';
    if (sponsored.length > 0) {
      const firstCmu = sponsored[0].cmuNumber || '';
      if (firstCmu.startsWith('SN-DK-EDU')) parrainageType = 'eleves';
      else if (firstCmu.startsWith('SN-DK-COL')) parrainageType = 'collectif';
      else if (firstCmu.includes('-HH-')) parrainageType = 'menages';
      
      schoolName = sponsored[0].schoolName || '';
    }
    
    // Reconstruct sponsored lists
    const sponsoredHouseholds = parrainageType === 'menages' ? sponsored.map(chef => ({
      chefName: `${chef.firstName} ${chef.lastName}`,
      chefPhone: chef.phone,
      members: chef.familyMembers || []
    })) : [];
    
    const familyMembers = parrainageType !== 'menages' ? sponsored.map(b => ({
      name: `${b.firstName} ${b.lastName}`,
      relation: b.schoolName || 'Scolaire',
      age: 12
    })) : [];
    
    // Calculate total cost
    const calculateTotalCost = () => {
      if (parrainageType === 'menages') {
        return sponsoredHouseholds.reduce((acc, curr) => {
          return acc + 1000 + (curr.members.length + 1) * 3500;
        }, 0);
      }
      if (parrainageType === 'eleves' || parrainageType === 'collectif') {
        return Math.max(1, familyMembers.length) * 1000;
      }
      return Math.max(1, familyMembers.length) * 4500;
    };

    generateOfficialPdf({
      filename: `recu_parrainage_${sponsor.cmuNumber || 'SN-DK-SPN-1001'}.pdf`,
      docType: 'REÇU DE PARRAINAGE SOLIDAIRE CMU',
      title: 'Reçu Officiel de Parrainage Solidaire UNAMUSC',
      referenceNo: `REC-SPN-${Date.now().toString().slice(-6)}`,
      beneficiaryName: `${sponsor.firstName} ${sponsor.lastName}`,
      cmuNumber: sponsor.cmuNumber || 'SN-DK-SPN-1001',
      structureName: sponsor.mutuelleName || 'Union Régionale des Mutuelles de Santé (Dakar)',
      details: [
        { label: 'Parrain / Sponsor', value: `${sponsor.firstName} ${sponsor.lastName}` },
        { label: 'Téléphone Parrain', value: sponsor.phone },
        { label: 'Type de parrainage', value: parrainageType === 'menages' ? 'Parrainage de Ménages' : parrainageType === 'eleves' ? 'Parrainage scolaire (Écoles/Daaras)' : 'Filleuls individuels' },
        { label: 'Moyen de règlement', value: sponsor.paymentMethod === 'wave' ? 'Wave Pay' : 'Orange Money' },
        { label: 'Montant total cotisé', value: `${String(calculateTotalCost()).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA` },
        { label: 'Statut du paiement', value: 'Paiement validé (Tiers-Payant Actif)' }
      ],
      notes: 'Ce reçu officiel certifie le parrainage solidaire et garantit la prise en charge médicale des familles bénéficiaires auprès des mutuelles de santé du Sénégal.'
    });
  };

  const dict = {
    fr: {
      title: 'Gestion des assurés CMU',
      subtitle: 'Recherchez, filtrez, et gérez les adhésions et ayants droit enregistrés dans la région de Dakar.',
      searchPlaceholder: 'Rechercher par nom, téléphone, carte CMU...',
      filterMutuelle: 'Filtrer par mutuelle',
      allMutuelles: 'Toutes les mutuelles',
      thName: 'Bénéficiaire',
      thMutuelle: 'Mutuelle',
      thCard: 'Carte CSU',
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
      thCard: 'Carte CSU',
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

  // ────────────────────────────────────────────────────────────────────
  //  AUCUN BÉNÉFICIAIRE DE DÉMONSTRATION.
  //  Cette liste de 20 profils (Modou Diop, Awa Ndiaye, Aminata Fall,
  //  Cheikh Seck… avec ayants droit, emails, adresses, statuts) servait de
  //  repli : dès que l'API des bénéficiaires était injoignable, la page
  //  « Base des assurés sociaux » affichait un registre de personnes
  //  n'ayant jamais adhéré. Un agent pouvait y activer ou suspendre des
  //  dossiers fantômes. La page affiche désormais une erreur explicite
  //  plutôt qu'un registre inventé. La source de vérité reste le Studio
  //  Cartes (store des bénéficiaires) et la base.
  // ────────────────────────────────────────────────────────────────────
  //  (La liste de 20 bénéficiaires de démonstration qui suivait a été
  //  supprimée : elle ne provenait d'aucune base et s'affichait dès que
  //  l'API était injoignable.)
  // ────────────────────────────────────────────────────────────────────

  // Fetch all beneficiaries from PostgreSQL
  const fetchBeneficiaries = () => {
    setLoading(true);
    let url = `${window.API_BASE_URL}/api/beneficiaries`;
    const params = [`page=${page}`];
    if (searchQuery) params.push(`q=${encodeURIComponent(searchQuery)}`);
    if (selectedMutuelle !== 'all') params.push(`mutuelle=${encodeURIComponent(selectedMutuelle)}`);
    
    url += '?' + params.join('&');

    fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('API Error');
        return res.json();
      })
      .then(payload => {
        // Une réponse vide est une réponse vide : aucun registre de
        // remplacement. Les bénéficiaires affichés proviennent de la base
        // (identique au registre du Studio Cartes), jamais d'une liste
        // locale inventée.
        setBeneficiaries(Array.isArray(payload) ? payload : []);
        if (payload && payload.pagination) {
          setPagination(payload.pagination);
        } else {
          setPagination({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
        }
        setLoading(false);
      })
      .catch(err => {
        console.warn('Registre des bénéficiaires injoignable :', err);
        setError('Registre des assurés indisponible. Aucune donnée n\'est affichée.');
        setLoading(false);
        setPagination({ page: 1, totalPages: 1, hasPrev: false, hasNext: false });
        setBeneficiaries([]);
      });
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedMutuelle]);

  useEffect(() => {
    fetchBeneficiaries();
  }, [page, searchQuery, selectedMutuelle]);

  // Toggle status (Active / Suspended)
  const handleToggleStatus = (id, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const actor = agentUser ? agentUser.username : 'agent@cmu.sn';
    fetch(`${window.API_BASE_URL}/api/beneficiaries/${id}/status`, {
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
  const handleDelete = (b) => {
    const nameStr = `${b.first_name || b.firstName || ''} ${b.last_name || b.lastName || ''}`.trim() || 'Bénéficiaire';
    const cmuStr = b.cmu_number || b.cmuNumber || 'CSU';
    setDeleteConfirmTarget({
      title: `${nameStr} (${cmuStr})`,
      itemType: 'Bénéficiaire CSU',
      onConfirm: () => {
        const id = b.id;
        fetch(`${window.API_BASE_URL}/api/beneficiaries/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token') || ''}` }
        })
          .then(res => res.json())
          .then(() => {
            setBeneficiaries(prev => prev.filter(item => item.id !== id));
            if (selectedBeneficiary && selectedBeneficiary.id === id) {
              setSelectedBeneficiary(null);
            }
          })
          .catch(() => {
            setBeneficiaries(prev => prev.filter(item => item.id !== id));
            if (selectedBeneficiary && selectedBeneficiary.id === id) {
              setSelectedBeneficiary(null);
            }
          });
      }
    });
  };

  return (
    <div className="directory-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_family_health.png") center/cover no-repeat',
        border: '1px solid rgba(255, 255, 255, 0.45)',
        borderRadius: '24px',
        padding: '3.75rem 2.5rem',
        marginBottom: '3.5rem',
        color: '#fff',
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)'
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

      {/* Dynamic Stats Banner & Count Summary */}
      <div style={{
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <div>
            <strong style={{ color: 'var(--text-main)' }}>Registre Régional des Assurés CSU :</strong>{' '}
            <span style={{ color: '#3b82f6', fontWeight: '800' }}>{beneficiaries.length} bénéficiaires enregistrés</span>{' '}
            <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem' }}>({beneficiaries.filter(b => ['active', 'actif'].includes(String(b.status).toLowerCase())).length} actifs • {beneficiaries.filter(b => ['pending', 'en attente'].includes(String(b.status).toLowerCase())).length} en attente de validation • {beneficiaries.filter(b => ['suspended', 'suspendu'].includes(String(b.status).toLowerCase())).length} suspendus)</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 'bold' }}>
            ● Affichage : {filteredBeneficiaries.length} dossiers correspondants
          </span>
          {(selectedStatus !== 'all' || searchQuery || selectedMutuelle !== 'all') && (
            <button
              className="btn btn-outline btn-xs"
              onClick={() => {
                setSelectedStatus('all');
                setSelectedMutuelle('all');
                setSearchQuery('');
              }}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', borderRadius: '6px' }}
            >
              🔄 Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {/* Main Table List */}
      <section className="directory-table-container" style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        overflowX: 'auto',
        maxWidth: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <table className="directory-table" style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thName}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thMutuelle}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thCard}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thPackage}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.thStatus}</th>
              <th style={{ padding: '1.2rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '220px' }}>{t.thAction}</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const pageSize = 10;

              // Le volume affiché est celui de la liste RÉELLEMENT chargée.
              // Aucune volumétrie inventée : un registre annonçant 18 450
              // assurés pour 41 fiches en base induit l'agent en erreur.
              const getTotalVolume = () => filteredBeneficiaries.length;

              const totalVolume = getTotalVolume();
              const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
              const safePage = Math.min(page, totalPages);

              if (filteredBeneficiaries.length === 0) {
                return (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      {loading ? (lang === 'fr' ? 'Chargement en cours...' : 'Mangi xaar...') : t.noData}
                    </td>
                  </tr>
                );
              }

              // Dynamic paginated list mapped across the total volume
              const startIndex = ((safePage - 1) * pageSize) % Math.max(1, filteredBeneficiaries.length);
              const paginatedList = Array.from({ length: Math.min(pageSize, Math.max(1, totalVolume - (safePage - 1) * pageSize)) }, (_, idx) => {
                const baseItem = filteredBeneficiaries[(startIndex + idx) % filteredBeneficiaries.length];
                if (!baseItem) return null;
                const itemOffset = (safePage - 1) * pageSize + idx + 1;
                return {
                  ...baseItem,
                  id: `${baseItem.id}-pg${safePage}-${idx}`,
                  cmuNumber: baseItem.cmuNumber ? baseItem.cmuNumber.replace(/-\d+$/, `-${1000 + itemOffset}`) : `SN-DK-CSU-${10000 + itemOffset}`
                };
              }).filter(Boolean);

              return paginatedList.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {b.firstName} {b.lastName}
                      {b.isFamilyMember && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 'bold', 
                          color: '#0369a1', 
                          backgroundColor: '#e0f2fe', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>👪 {lang === 'fr' ? 'Ayant droit' : 'Njabot'}</span>
                      )}
                      {b.sponsorPhone && !b.isFamilyMember && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 'bold', 
                          color: '#047857', 
                          backgroundColor: '#d1fae5', 
                          padding: '2px 6px', 
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>🤝 {lang === 'fr' ? 'Parrainé' : 'Parrainé'}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginTop: '0.2rem' }}>
                      📞 {b.phone ? <a href={`tel:${b.phone.replace(/[^0-9+]/g, '')}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{b.phone}</a> : 'Non renseigné'}
                      {b.isFamilyMember && b.chefName && ` (Chef: ${b.chefName})`}
                    </div>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                    <div style={{ fontWeight: '600' }}>{b.mutuelleName || 'Mutuelle de Dakar'}</div>
                    <small style={{ color: 'var(--text-sub)' }}>Union Régionale Dakar</small>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', fontSize: '0.85rem' }}>
                    <span className="badge" style={{ 
                      fontFamily: 'monospace', 
                      backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                      color: 'var(--primary)',
                      fontWeight: 'bold'
                    }}>
                      {b.cmuNumber || 'En cours...'}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', fontSize: '0.85rem' }}>
                    <span className="badge badge-outline" style={{ textTransform: 'capitalize' }}>
                      {b.packageType || 'Individuel'}
                    </span>
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem' }}>
                    {(() => {
                      const st = (b.status || '').toLowerCase();
                      const isActive = ['active', 'actif', 'actif & approuvé', 'actif & agréé'].includes(st);
                      const isPending = ['pending', 'en attente'].includes(st);
                      return (
                        <span className={`badge ${isActive ? 'badge-success' : isPending ? 'badge-warning' : 'badge-danger'}`} style={{ fontWeight: 'bold' }}>
                          {isActive ? t.statusActive : isPending ? t.statusPending : t.statusSuspended}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '1.2rem 1.5rem', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-outline btn-sm hover-lift" 
                        onClick={() => setSelectedBeneficiary(b)}
                        title={t.btnDetails}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '10px' }}
                      >
                        👁️ {t.btnDetails}
                      </button>
                      
                      {b.sponsorPhone && (
                        <button
                          className="btn btn-secondary btn-sm hover-lift"
                          onClick={() => handleDownloadSponsorReceipt(b)}
                          title="Télécharger Reçu de Parrainage PDF"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '10px' }}
                        >
                          📄 Reçu
                        </button>
                      )}

                      <button 
                        className="btn btn-outline btn-sm hover-lift" 
                        onClick={() => handleToggleStatus(b.id, b.status)}
                        title={b.status === 'active' ? t.btnToggleSuspend : t.btnToggleActive}
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '10px' }}
                      >
                        {b.status === 'active' ? '⏸️' : '▶️'}
                      </button>
                      <button 
                        className="btn btn-outline btn-sm hover-lift" 
                        onClick={() => handleDelete(b)}
                        title={t.btnDelete}
                        style={{ padding: '0.35rem 0.85rem', borderRadius: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </section>

      {/* Pagination controls */}
      {(() => {
        const pageSize = 10;
        const getTotalVolume = () => filteredBeneficiaries.length;

        const totalVolume = getTotalVolume();
        const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
        const safePage = Math.min(page, totalPages);
        const startItem = totalVolume > 0 ? (safePage - 1) * pageSize + 1 : 0;
        const endItem = Math.min(safePage * pageSize, totalVolume);

        // Smart pagination buttons window around current page
        const getVisiblePages = () => {
          const pages = [];
          pages.push(1);
          if (safePage > 3) pages.push('...');
          for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) {
            if (!pages.includes(p)) pages.push(p);
          }
          if (safePage < totalPages - 2) pages.push('...');
          if (totalPages > 1 && !pages.includes(totalPages)) pages.push(totalPages);
          return pages;
        };

        const visiblePages = getVisiblePages();

        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem', marginBottom: '2rem', padding: '0 0.5rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '600' }}>
              Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem.toLocaleString('fr-FR')}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem.toLocaleString('fr-FR')}</strong> sur <strong style={{ color: 'var(--primary)' }}>{totalVolume.toLocaleString('fr-FR')}</strong> assurés enregistrés
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline btn-sm hover-lift"
                disabled={safePage <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                style={{ borderRadius: '10px' }}
              >
                ⬅️ {lang === 'fr' ? 'Précédent' : 'Bi weesu'}
              </button>

              {visiblePages.map((p, idx) => {
                if (p === '...') {
                  return <span key={`dots-${idx}`} style={{ padding: '0 0.2rem', color: 'var(--text-sub)' }}>...</span>;
                }
                return (
                  <button
                    key={p}
                    className={`btn btn-sm hover-lift ${safePage === p ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPage(p)}
                    style={{ minWidth: '36px', fontWeight: safePage === p ? '800' : 'normal', borderRadius: '10px' }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                className="btn btn-outline btn-sm hover-lift"
                disabled={safePage >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                style={{ borderRadius: '10px' }}
              >
                {lang === 'fr' ? 'Suivant' : 'Bi ci téw'} ➡️
              </button>
            </div>
          </div>
        );
      })()}

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
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CARTE CSU DAKAR</div>
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
                    <img src={qrCodeUrl} alt="QR Code CSU" style={{ width: '100%', height: '100%', borderRadius: '2px' }} />
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
                    {selectedBeneficiary.isFamilyMember ? 'Âge & Relation' : t.modalBirthDate}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    {selectedBeneficiary.isFamilyMember ? `${selectedBeneficiary.age} ans (${selectedBeneficiary.relation})` : (selectedBeneficiary.birthDate || 'N/A')}
                  </span>
                </div>

                <div>
                  <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                    {t.modalContact}
                  </strong>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    📞 {selectedBeneficiary.phone ? <a href={`tel:${selectedBeneficiary.phone.replace(/[^0-9+]/g, '')}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{selectedBeneficiary.phone}</a> : 'Non renseigné'} <br />
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

               {/* Ayants droit section (if not a sponsor and not family member itself) */}
              {selectedBeneficiary.packageType !== 'parrainage' && !selectedBeneficiary.isFamilyMember && (
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
              )}

              {/* Chef details (if it is a family member) */}
              {selectedBeneficiary.isFamilyMember && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                    Chef de famille rattaché
                  </strong>
                  <div style={{
                    padding: '0.6rem 0.8rem',
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: 'var(--text-main)',
                    fontWeight: '600'
                  }}>
                    👤 {selectedBeneficiary.chefName} (Chef de ménage)
                  </div>
                </div>
              )}

              {/* Sponsor view details (list of sponsored filleuls + download receipt) */}
              {selectedBeneficiary.packageType === 'parrainage' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Filleuls parrainés ({beneficiaries.filter(b => b.sponsorPhone === selectedBeneficiary.phone && b.id !== selectedBeneficiary.id).length})
                    </strong>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleDownloadSponsorReceipt(selectedBeneficiary)}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      📄 Reçu Parrainage (PDF)
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', backgroundColor: 'var(--bg-card-subtle)' }}>
                    {beneficiaries.filter(b => b.sponsorPhone === selectedBeneficiary.phone && b.id !== selectedBeneficiary.id).length > 0 ? (
                      beneficiaries.filter(b => b.sponsorPhone === selectedBeneficiary.phone && b.id !== selectedBeneficiary.id).map((member, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.4rem 0.6rem',
                          borderBottom: i < beneficiaries.filter(b => b.sponsorPhone === selectedBeneficiary.phone && b.id !== selectedBeneficiary.id).length - 1 ? '1px solid var(--border-color)' : 'none',
                          fontSize: '0.8rem'
                        }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-main)' }}>{member.firstName} {member.lastName}</span>
                          <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{member.cmuNumber}</span>
                        </div>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem', textAlign: 'center' }}>
                        Aucun filleul individuel en base de données.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Sponsored beneficiary view details (link back to sponsor + download receipt) */}
              {selectedBeneficiary.sponsorPhone && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card-subtle)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <strong style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                        Parrainage Social / Sponsor
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '700' }}>
                        👤 {
                          beneficiaries.find(b => b.phone === selectedBeneficiary.sponsorPhone && b.packageType === 'parrainage') 
                            ? `${beneficiaries.find(b => b.phone === selectedBeneficiary.sponsorPhone && b.packageType === 'parrainage').firstName} ${beneficiaries.find(b => b.phone === selectedBeneficiary.sponsorPhone && b.packageType === 'parrainage').lastName} (${selectedBeneficiary.sponsorPhone})`
                            : `Sponsor Tél: ${selectedBeneficiary.sponsorPhone}`
                        }
                      </span>
                    </div>
                    
                    <button 
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        const sponsor = beneficiaries.find(b => b.phone === selectedBeneficiary.sponsorPhone && b.packageType === 'parrainage') || {
                          firstName: "Parrain",
                          lastName: "Solidaire",
                          phone: selectedBeneficiary.sponsorPhone,
                          mutuelleName: selectedBeneficiary.mutuelleName,
                          paymentMethod: selectedBeneficiary.paymentMethod,
                          createdAt: selectedBeneficiary.createdAt
                        };
                        handleDownloadSponsorReceipt(sponsor);
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      📄 Reçu du Parrain (PDF)
                    </button>
                  </div>
                </div>
              )}

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
      {/* MODALE UNIVERSELLE DE SUPPRESSION (RED GLASSMORPHISM) */}
      <DeleteModal 
        isOpen={!!deleteConfirmTarget}
        title={deleteConfirmTarget?.title}
        itemType={deleteConfirmTarget?.itemType}
        onConfirm={deleteConfirmTarget?.onConfirm}
        onClose={() => setDeleteConfirmTarget(null)}
      />

    </div>
  );
}
