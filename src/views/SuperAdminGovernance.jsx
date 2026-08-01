export default function SuperAdminGovernance({ lang = 'fr', setView, agentUser, citizenUser, partnerUser }) {
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'requests', 'communications', 'audit'
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState('');

  // Sample data initialized from localStorage or defaults
  const [usersList, setUsersList] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [complaintsList, setComplaintsList] = useState([]);
  const [selectedUserEdit, setSelectedUserEdit] = useState(null);
  const [editRoleForm, setEditRoleForm] = useState({ role: '', status: 'active', note: '' });

  // Formulaire de création universelle de compte par le Super Admin
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    roleCode: 'ACC-01',
    udmsName: 'UDMS Dakar Plateau',
    mutuelleName: 'Mutuelle de la Médina'
  });

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = () => {
    // Load Users
    const defaultUsers = [
      { id: 1, type: 'citizen', name: 'Modou Diop', identifier: 'modou.diop@csu.sn', cmuNumber: 'SN-DK-MED-8472', role: 'Assuré individuel', status: 'Actif', mutuelle: 'UDMS Dakar Plateau' },
      { id: 2, type: 'citizen', name: 'Ibrahima Sarr', identifier: 'ibrahima.sarr@ucad.edu.sn', cmuNumber: 'SN-DK-UCAD-3012', role: 'Élève / Étudiant', status: 'Actif', mutuelle: 'UDMS Fann / UCAD' },
      { id: 3, type: 'citizen', name: 'Fatou Diallo', identifier: 'fatou.diallo@bsf.sn', cmuNumber: 'SN-DK-BSF-9901', role: 'Bénéficiaire BSF', status: 'Actif', mutuelle: 'UDMS Pikine' },
      { id: 4, type: 'partner', name: 'Dr. Cheikh Anta Diop', identifier: 'dr.diop@hopital-fann.sn', cmuNumber: 'PREST-MED-101', role: 'Médecin traitant', status: 'Actif & Agréé', mutuelle: 'Hôpital Abass Ndao' },
      { id: 5, type: 'partner', name: 'Aïssatou Sow', identifier: 'aissatou.sow@sante.sn', cmuNumber: 'PREST-SF-202', role: 'Infirmier / Sage-Femme', status: 'Actif & Agréé', mutuelle: 'Poste Médina' },
      { id: 6, type: 'partner', name: 'Dr. Fatou Sow', identifier: 'dr.fatou.sow@pharmacie-medina.sn', cmuNumber: 'PREST-PH-404', role: 'Pharmacien d\'officine', status: 'Actif & Agréé', mutuelle: 'Grande Pharmacie' },
      { id: 7, type: 'agent', name: 'Amadou Sall', identifier: 'amadou.sall@udms-dakar.sn', cmuNumber: 'AGENT-REG-01', role: 'Agent UDMS', status: 'Actif', mutuelle: 'UDMS Dakar Plateau' },
      { id: 8, type: 'superadmin', name: 'Dr. Mamadou Ba', identifier: 'superadmin@anacsu.sn', cmuNumber: 'SA-DKR-001', role: 'Super Admin', status: 'Superviseur Suprême', mutuelle: 'ANACSU Siège' }
    ];

    const storedUsers = localStorage.getItem('cmu-superadmin-users');
    if (storedUsers) {
      try {
        setUsersList(JSON.parse(storedUsers));
      } catch (e) {
        setUsersList(defaultUsers);
      }
    } else {
      setUsersList(defaultUsers);
      localStorage.setItem('cmu-superadmin-users', JSON.stringify(defaultUsers));
    }

    // Load Pending Account Requests
    const storedReqs = localStorage.getItem('cmu-pending-account-requests');
    if (storedReqs) {
      try {
        setPendingRequests(JSON.parse(storedReqs));
      } catch (e) {
        setPendingRequests([]);
      }
    }

    // Load complaints
    const storedComplaints = localStorage.getItem('cmu-complaints');
    if (storedComplaints) {
      try {
        setComplaintsList(JSON.parse(storedComplaints));
      } catch (e) {
        setComplaintsList([]);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Création directe d'un compte par le Super Admin pour n'importe quel rôle et n'importe quelle UDMS
  const handleSuperAdminCreateAccount = (e) => {
    e.preventDefault();
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      triggerToast('Veuillez compléter tous les champs requis.');
      return;
    }

    const cmuNum = `SN-DK-${createForm.udmsName.split(' ')[1]?.toUpperCase() || 'REG'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newAccount = {
      id: Date.now(),
      firstName: createForm.firstName,
      lastName: createForm.lastName,
      name: `${createForm.firstName} ${createForm.lastName}`,
      email: createForm.email,
      identifier: createForm.email,
      phone: createForm.phone || '770000000',
      password: createForm.password,
      role: createForm.roleCode,
      type: createForm.roleCode.startsWith('ACC-0') && parseInt(createForm.roleCode.slice(-2)) <= 3 ? 'citizen' : createForm.roleCode.startsWith('ACC-09') || createForm.roleCode.startsWith('ACC-10') || createForm.roleCode.startsWith('ACC-11') ? 'agent' : 'partner',
      udmsName: createForm.udmsName,
      mutuelle: createForm.udmsName,
      cmuNumber: cmuNum,
      status: 'Actif',
      createdAt: new Date().toISOString(),
      userObj: {
        id: Date.now(),
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phone: createForm.phone || '770000000',
        cmuNumber: cmuNum,
        mutuelleName: createForm.udmsName,
        status: 'active'
      }
    };

    // Save in all accounts registry
    const existingAll = JSON.parse(localStorage.getItem('cmu-all-accounts') || '[]');
    existingAll.push(newAccount);
    localStorage.setItem('cmu-all-accounts', JSON.stringify(existingAll));

    // Save in superadmin users list
    const updatedUsers = [...usersList, newAccount];
    setUsersList(updatedUsers);
    localStorage.setItem('cmu-superadmin-users', JSON.stringify(updatedUsers));

    setShowCreateModal(false);
    triggerToast(`⚡ Compte créé et activé avec succès pour « ${newAccount.name} » (${createForm.udmsName}) ! Identifiants e-mail : ${createForm.email}`);
    setCreateForm({ firstName: '', lastName: '', email: '', password: '', phone: '', roleCode: 'ACC-01', udmsName: 'UDMS Dakar Plateau', mutuelleName: 'Mutuelle de la Médina' });
  };

  // Accordation / Approbation d'une demande d'ouverture de compte entamée par l'assuré
  const handleApproveAccountRequest = (reqId) => {
    const req = pendingRequests.find(r => r.id === reqId);
    if (!req) return;

    const cmuNum = `SN-DK-${req.udmsName.split(' ')[1]?.toUpperCase() || 'REG'}-${Math.floor(1000 + Math.random() * 9000)}`;
    const approvedAccount = {
      id: Date.now(),
      firstName: req.firstName,
      lastName: req.lastName,
      name: `${req.firstName} ${req.lastName}`,
      email: req.email,
      identifier: req.email,
      phone: req.phone,
      password: req.password || 'Csu2026!',
      role: req.profileType,
      type: 'citizen',
      udmsName: req.udmsName,
      mutuelle: req.udmsName,
      cmuNumber: cmuNum,
      status: 'Actif & Approuvé',
      createdAt: new Date().toISOString(),
      userObj: {
        id: Date.now(),
        firstName: req.firstName,
        lastName: req.lastName,
        email: req.email,
        phone: req.phone,
        cmuNumber: cmuNum,
        mutuelleName: req.udmsName,
        packageType: 'individuel',
        status: 'active'
      }
    };

    // Update pending requests list
    const updatedReqs = pendingRequests.map(r => r.id === reqId ? { ...r, status: 'approved', cmuNumber: cmuNum } : r);
    setPendingRequests(updatedReqs);
    localStorage.setItem('cmu-pending-account-requests', JSON.stringify(updatedReqs));

    // Save in all accounts registry
    const existingAll = JSON.parse(localStorage.getItem('cmu-all-accounts') || '[]');
    existingAll.push(approvedAccount);
    localStorage.setItem('cmu-all-accounts', JSON.stringify(existingAll));

    // Save in users list
    const updatedUsers = [...usersList, approvedAccount];
    setUsersList(updatedUsers);
    localStorage.setItem('cmu-superadmin-users', JSON.stringify(updatedUsers));

    triggerToast(` Accès accordé et compte activé pour « ${req.firstName} ${req.lastName} » ! N° Carte CSU généré : ${cmuNum}`);
  };

  const handleRefuseAccountRequest = (reqId) => {
    const updatedReqs = pendingRequests.map(r => r.id === reqId ? { ...r, status: 'refused' } : r);
    setPendingRequests(updatedReqs);
    localStorage.setItem('cmu-pending-account-requests', JSON.stringify(updatedReqs));
    triggerToast(`❌ Demande d'ouverture de compte #${reqId} refusée.`);
  };

  const handleApplyUserCorrection = (userId) => {
    if (!editRoleForm.role) {
      triggerToast('Veuillez sélectionner un rôle valide.');
      return;
    }

    const updated = usersList.map(u => {
      if (u.id === userId) {
        return {
          ...u,
          role: editRoleForm.role,
          status: editRoleForm.status === 'active' ? 'Actif' : 'Suspendu'
        };
      }
      return u;
    });

    setUsersList(updated);
    localStorage.setItem('cmu-superadmin-users', JSON.stringify(updated));
    setSelectedUserEdit(null);
    triggerToast(`Correctif appliqué avec succès à l'utilisateur #${userId} !`);
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.identifier.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.cmuNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.type === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="superadmin-view fade-in-up" style={{ padding: '1rem 0' }}>
      {/* Super Admin Top Header Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid rgba(255, 255, 255, 0.15)'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.15)', padding: '0.35rem 0.85rem', borderRadius: '30px', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
              <span>👑</span>
              <span>SUPER ADMIN PLATFORME CMU</span>
            </div>
            <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '850', margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              Gouvernance & Supervision Intégrale
            </h1>
            <p style={{ color: '#c7d2fe', fontSize: '0.95rem', margin: '0.5rem 0 0 0', maxWidth: '650px' }}>
              Contrôle global des rôles, audit des communications privées prestataires et correction intelligente des comptes utilisateurs.
            </p>
          </div>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1rem 1.5rem', borderRadius: '16px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.2)', textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#a5b4fc' }}>Connecté en tant que</div>
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff' }}>Super Administrateur</div>
            <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 'bold', marginTop: '0.2rem' }}>● Accès Total Illimité</div>
          </div>
        </div>
      </section>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveTab('users')}
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '10px', fontSize: '0.88rem' }}
        >
          👥 Gestion des Utilisateurs ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '10px', fontSize: '0.88rem' }}
        >
          📝 Demandes d'Ouverture de Compte ({pendingRequests.filter(r => r.status === 'pending').length})
        </button>
        <button
          onClick={() => setActiveTab('communications')}
          className={`btn ${activeTab === 'communications' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '10px', fontSize: '0.88rem' }}
        >
          🔒 Communications Privées ({complaintsList.length})
        </button>
        <button
          onClick={() => setActiveTab('pages')}
          className={`btn ${activeTab === 'pages' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderRadius: '10px', fontSize: '0.88rem' }}
        >
          🗺️ Inspection des Pages (32)
        </button>
      </div>

      {/* Tab 1: Users & Roles Management */}
      {activeTab === 'users' && (
        <div className="card text-left" style={{ padding: '2rem', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
                👥 Annuaire Centralisé des Utilisateurs & Rôles
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                Gestion et émission de comptes pour les 13 profils d'accès sur toutes les Unions Départementales & Régionales
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className="btn btn-success" 
                style={{ borderRadius: '10px', fontWeight: '700', fontSize: '0.85rem' }}
                onClick={() => setShowCreateModal(true)}
              >
                ➕ Créer un compte universel (13 Profils & Unions)
              </button>

              <input
                type="text"
                className="form-control"
                placeholder="Rechercher par nom, e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ minWidth: '220px', fontSize: '0.85rem' }}
              />

              <select
                className="form-control"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="all">Tous les types de rôles</option>
                <option value="citizen">Citoyens Assurés</option>
                <option value="partner">Prestataires de Santé</option>
                <option value="agent">Agents CMU / UDMS</option>
                <option value="superadmin">Super Admins</option>
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="table-responsive">
            <table className="directory-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-card-subtle)' }}>
                  <th style={{ padding: '0.75rem' }}>ID</th>
                  <th style={{ padding: '0.75rem' }}>Nom / Structure</th>
                  <th style={{ padding: '0.75rem' }}>Identifiant / Email</th>
                  <th style={{ padding: '0.75rem' }}>Matricule CMU</th>
                  <th style={{ padding: '0.75rem' }}>Rôle Attribué</th>
                  <th style={{ padding: '0.75rem' }}>Statut</th>
                  <th style={{ padding: '0.75rem' }}>Actions Super Admin</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>#{user.id}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <strong>{user.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.mutuelle}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{user.identifier}</td>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{user.cmuNumber}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge ${
                        user.type === 'superadmin' ? 'badge-danger' :
                        user.type === 'agent' ? 'badge-primary' :
                        user.type === 'partner' ? 'badge-warning' : 'badge-success'
                      }`} style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: user.status.includes('Actif') ? 'var(--success)' : 'var(--danger)', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        ● {user.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setSelectedUserEdit(user);
                          setEditRoleForm({ role: user.role, status: user.status.includes('Actif') ? 'active' : 'suspended', note: '' });
                        }}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        ✏️ Éditer Rôle & Correctifs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit Modal Overlay */}
          {selectedUserEdit && (
            <div style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000
            }}>
              <div className="card text-left" style={{ width: '450px', padding: '2rem', borderRadius: '16px', background: 'var(--bg-card)' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary)' }}>
                  ✏️ Application de Correctif : {selectedUserEdit.name}
                </h4>

                <div className="form-group">
                  <label className="form-label">Rôle d'Accès Attribué</label>
                  <select
                    className="form-control"
                    value={editRoleForm.role}
                    onChange={(e) => setEditRoleForm({ ...editRoleForm, role: e.target.value })}
                  >
                    <option value="Citoyen Assuré">Citoyen Assuré (Accès Citoyen)</option>
                    <option value="Prestataire de Santé">Prestataire de Santé (Accès Privé Santé)</option>
                    <option value="Superviseur Régional">Superviseur Régional (Accès Agent)</option>
                    <option value="Super Admin">Super Admin (Accès Total)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Statut du Compte</label>
                  <select
                    className="form-control"
                    value={editRoleForm.status}
                    onChange={(e) => setEditRoleForm({ ...editRoleForm, status: e.target.value })}
                  >
                    <option value="active">Actif & Autorisé</option>
                    <option value="suspended">Suspendu pour révision</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelectedUserEdit(null)}>
                    Annuler
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApplyUserCorrection(selectedUserEdit.id)}>
                    💾 Enregistrer Correctif
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Communications Privées Prestataires */}
      {/* Tab 1.5: Pending Account Requests (Approval by Super Admin / Agent) */}
      {activeTab === 'requests' && (
        <div className="card text-left" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.5rem' }}>
            📝 Demandes d'Ouverture de Compte en Attente de Validation
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
            Examinez et accordez l'ouverture de compte pour les assurés et prestataires ayant entamé la procédure sur la plateforme.
          </p>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-4 text-muted" style={{ fontSize: '0.9rem' }}>
              Aucune demande d'ouverture de compte en attente pour le moment.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="directory-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-card-subtle)' }}>
                    <th style={{ padding: '0.75rem' }}>Demandeur</th>
                    <th style={{ padding: '0.75rem' }}>E-mail & Téléphone</th>
                    <th style={{ padding: '0.75rem' }}>Profil Souhaité</th>
                    <th style={{ padding: '0.75rem' }}>Union Départementale (UDMS)</th>
                    <th style={{ padding: '0.75rem' }}>Statut</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action Super Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((req) => (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                        {req.firstName} {req.lastName}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div>📧 {req.email}</div>
                        <small className="text-muted">📞 {req.phone}</small>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="badge badge-info" style={{ padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {req.profileType}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {req.udmsName}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className={`badge ${req.status === 'approved' ? 'badge-success' : req.status === 'refused' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {req.status === 'approved' ? ' Accordé & Actif' : req.status === 'refused' ? '❌ Refusé' : '⏳ En attente validation'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {req.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-success btn-sm"
                              style={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}
                              onClick={() => handleApproveAccountRequest(req.id)}
                            >
                              ✅ Accorder l'ouverture
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ borderRadius: '8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                              onClick={() => handleRefuseAccountRequest(req.id)}
                            >
                              ❌ Refuser
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                            {req.status === 'approved' ? `Carte: ${req.cmuNumber}` : 'Traité'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Communications Privées Prestataires */}
      {activeTab === 'communications' && (
        <div className="card text-left" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '1rem' }}>
            🔒 Registre Global des Communications Privées Prestataires
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
            En tant que Super Admin, vous disposez d'un droit de regard complet sur toutes les communications chiffrées/privées envoyées par les prestataires de santé aux destinataires spécifiés.
          </p>

          <div className="table-responsive">
            <table className="directory-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', background: 'var(--bg-card-subtle)' }}>
                  <th style={{ padding: '0.75rem' }}>Code</th>
                  <th style={{ padding: '0.75rem' }}>Expéditeur (Prestataire)</th>
                  <th style={{ padding: '0.75rem' }}>Destinataire Exclusif</th>
                  <th style={{ padding: '0.75rem' }}>Objet / Sujet</th>
                  <th style={{ padding: '0.75rem' }}>Message Privé</th>
                  <th style={{ padding: '0.75rem' }}>Date</th>
                  <th style={{ padding: '0.75rem' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {complaintsList.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', fontFamily: 'monospace' }}>{item.id}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>{item.sender}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{item.recipient}</td>
                    <td style={{ padding: '0.75rem' }}>{item.subject}</td>
                    <td style={{ padding: '0.75rem', maxWidth: '300px' }}>{item.message}</td>
                    <td style={{ padding: '0.75rem', whiteSpace: 'nowrap' }}>{item.date}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                        {item.status || 'Audité Super Admin'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Pages Inspection Navigator */}
      {activeTab === 'pages' && (
        <div className="card text-left" style={{ padding: '2rem', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '1rem' }}>
            🗺️ Navigateur d'Inspection de Toutes les Vues de la Plateforme
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
            Accédez directement à n'importe quelle page de l'application en mode super-utilisateur pour vérifier la conformité du design et des données.
          </p>

          <div className="grid grid-4" style={{ gap: '1rem' }}>
            {[
              { id: 'home', title: 'Tableau de Bord / Accueil', desc: 'Portail principal & KPIs' },
              { id: 'beneficiaries', title: 'Base des Assurés', desc: 'Gestion des bénéficiaires' },
              { id: 'partner', title: 'Portail Prestataire Privé', desc: 'Tiers-payant & prise en charge' },
              { id: 'partnership', title: 'Espace Partenariat Public', desc: 'Formulaire de collaboration RSE' },
              { id: 'complaints', title: 'Réclamations & Messagerie', desc: 'Flux de communication privés' },
              { id: 'depts', title: 'Unions & Statistiques', desc: 'Données régionales Dakar' },
              { id: 'medicaments', title: 'Médicaments Pris en Charge', desc: 'Annuaire pharmaceutique' },
              { id: 'audit-logs', title: 'Journal d\'Audit', desc: 'Registre de sécurité & traçabilité' },
              { id: 'map', title: 'Cartographie Sanitaire', desc: 'Carte des structures de soins' },
              { id: 'directory', title: 'Annuaire des Mutuelles', desc: 'Base nationale des mutuelles' },
              { id: 'blog-experts', title: 'Espace Blog & Paroles d\'Experts', desc: 'Articles & conseils santé' }
            ].map(p => (
              <div 
                key={p.id}
                onClick={() => setView(p.id)}
                style={{
                  padding: '1.25rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  background: 'var(--bg-card-subtle)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, border-color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                  {p.desc}
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                  Inspecter la vue →
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Création Universelle de Compte CSU par Super Admin */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div className="card fade-in-up" style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '24px',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
                ➕ Création Universelle de Compte CSU (13 Profils & Unions)
              </h3>
              <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(false)} style={{ borderRadius: '8px' }}>
                ✖️
              </button>
            </div>

            <form onSubmit={handleSuperAdminCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: '700' }}>Prénom *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ex: Mamadou"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: '700' }}>Nom *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="ex: Ndiaye"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: '700' }}>E-mail unique *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="ex: mamadou.ndiaye@csu.sn"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: '700' }}>Mot de passe unique *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="ex: Pass2026!"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: '700' }}>Rôle d'Accès (13 Profils) *</label>
                  <select
                    className="form-control"
                    value={createForm.roleCode}
                    onChange={(e) => setCreateForm({ ...createForm, roleCode: e.target.value })}
                  >
                    <option value="ACC-01">ACC-01 • Assuré individuel / famille</option>
                    <option value="ACC-02">ACC-02 • Élève / étudiant (CSU jeunes)</option>
                    <option value="ACC-03">ACC-03 • Bénéficiaire BSF (filet social)</option>
                    <option value="ACC-04">ACC-04 • Médecin / praticien traitant</option>
                    <option value="ACC-05">ACC-05 • Infirmier / sage-femme</option>
                    <option value="ACC-06">ACC-06 • Pharmacien d'officine</option>
                    <option value="ACC-07">ACC-07 • Biologie & radiologie</option>
                    <option value="ACC-08">ACC-08 • Direction EPS & gestion hôpital</option>
                    <option value="ACC-09">ACC-09 • Agent mutuelle UDMS</option>
                    <option value="ACC-10">ACC-10 • Superviseur régional URMSCD</option>
                    <option value="ACC-11">ACC-11 • Super admin ANACSU</option>
                    <option value="ACC-12">ACC-12 • Entreprise / employeur</option>
                    <option value="ACC-13">ACC-13 • Parrain solidaire RSE</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: '700' }}>Union Départementale / Régionale *</label>
                  <select
                    className="form-control"
                    value={createForm.udmsName}
                    onChange={(e) => setCreateForm({ ...createForm, udmsName: e.target.value })}
                  >
                    <option value="UDMS Dakar Plateau">UDMS Dakar Plateau</option>
                    <option value="UDMS Pikine Ouest">UDMS Pikine Ouest</option>
                    <option value="UDMS Guédiawaye">UDMS Guédiawaye</option>
                    <option value="UDMS Rufisque">UDMS Rufisque</option>
                    <option value="URMSCD Région de Dakar">URMSCD Région de Dakar</option>
                    <option value="ANACSU Siège National">ANACSU Siège National</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-success" style={{ flex: 1, fontWeight: '800' }}>
                  ⚡ Créer & Activer le Compte
                </button>
              </div>
            </form>
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
          backgroundColor: '#1e1b4b',
          color: '#fff',
          padding: '0.8rem 1.5rem',
          borderRadius: '30px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10000,
          fontWeight: 'bold',
          fontSize: '0.9rem',
          border: '1px solid #4338ca'
        }}>
          ✅ {toastMessage}
        </div>
      )}
    </div>
  );
}
