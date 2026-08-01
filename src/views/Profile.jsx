import React, { useState, useEffect } from 'react';
import CmuCard from '../components/CmuCard';

const formatBadgeName = (name) => {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

export default function Profile({ lang, portalMode, citizenUser, agentUser, partnerUser, setView, setViewTab, setPortalMode, setCitizenUser, setAgentUser, setPartnerUser }) {
  const dict = {
    fr: {
      titleCitizen: 'Mon compte assuré CSU',
      titleAgent: 'Mon profil agent CSU',
      subtitleCitizen: 'Consultez vos informations personnelles, le statut de votre couverture CSU et gérez vos ayants droit.',
      subtitleAgent: 'Détails de votre session professionnelle, rôle et statistiques d\'activité administrative.',
      cardPersonalInfo: 'Informations personnelles',
      cardCoverage: 'Statut de couverture CSU',
      cardFamily: 'Ayants droit rattachés',
      cardMutuelle: 'Ma mutuelle de santé CSU',
      cardStats: 'Statistiques d\'activité',
      nameLabel: 'Nom complet',
      phoneLabel: 'Numéro de téléphone',
      emailLabel: 'Adresse e-mail',
      birthLabel: 'Date de naissance',
      addressLabel: 'Adresse de résidence',
      cmuIdLabel: 'Numéro de carte CSU',
      statusActive: 'Couverture CSU active',
      statusInactive: 'Couverture CSU inactive',
      activeDesc: 'Vous bénéficiez du tiers-payant jusqu\'à 80% dans toutes les structures conventionnées.',
      inactiveDesc: 'Votre couverture est suspendue. Veuillez régulariser votre cotisation de 4 500 FCFA.',
      mutuelleNameLabel: 'Nom de la mutuelle',
      mutuelleRates: 'Tarif cotisation',
      mutuelleRatesVal: '4 500 FCFA / an',
      packageLabel: 'Formule souscrite',
      paymentLabel: 'Moyen de paiement',
      historyTitle: 'Historique des cotisations CSU',
      thDate: 'Date',
      thAmount: 'Montant',
      thMethod: 'Moyen',
      thStatus: 'Statut',
      paidStatus: 'Payé',
      btnRenew: 'Renouveler ma cotisation',
      btnAddFamily: 'Ajouter un ayant droit',
      agentRole: 'Rôle professionnel',
      agentId: 'Identifiant agent',
      agentLogCount: 'Total d\'actions enregistrées',
      agentRecentLogs: 'Vos dernières actions système'
    },
    wo: {
      titleCitizen: 'Sama compte assuré CSU',
      titleAgent: 'Sama profil agent CSU',
      subtitleCitizen: 'Xoolal say information, sa couverture CSU ak sa njabot.',
      subtitleAgent: 'Liggéey bi nga yore, sa rôle ak statistiques ci portal csu.',
      cardPersonalInfo: 'Mbind yi ci yaw',
      cardCoverage: 'Statut couverture CSU',
      cardFamily: 'Sa njabot gu bokk',
      cardMutuelle: 'Sa mutuelle wér-gi-yaram CSU',
      cardStats: 'Chiffres liggéey',
      nameLabel: 'Tour ak sant',
      phoneLabel: 'Portable',
      emailLabel: 'Email',
      birthLabel: 'Date doudou',
      addressLabel: 'Dëkkway',
      cmuIdLabel: 'N° carte CSU',
      statusActive: 'Wér-gi-yaram baax na',
      statusInactive: 'Wér-gi-yaram teye nanu ko',
      activeDesc: 'Mën nga fajjoo ba 80% ci fajukaay yi nu agréer.',
      inactiveDesc: 'Sa wér-gi-yaram teye nanu ko. Fayal sa cotisation annuel ngir réactiver.',
      mutuelleNameLabel: 'Touru mutuelle bi',
      mutuelleRates: 'Fay bi',
      mutuelleRatesVal: '4 500 FCFA / at',
      packageLabel: 'Formule bi',
      paymentLabel: 'Moyen de payement',
      historyTitle: 'Registre fay yi',
      thDate: 'Date',
      thAmount: 'Montant',
      thMethod: 'Moyen',
      thStatus: 'Statut',
      paidStatus: 'Fay na',
      btnRenew: 'Fayal sa cotisation',
      btnAddFamily: 'Duggal sa bokk',
      agentRole: 'Rôle',
      agentId: 'Identifiant agent',
      agentLogCount: 'Total actions yi',
      agentRecentLogs: 'Liggéey yi nga gënë mujje def'
    }
  };

  const t = dict[lang] || dict.fr;
  const user = portalMode === 'citizen' ? citizenUser : portalMode === 'partner' ? partnerUser : agentUser;

  // Liste exhaustive des 13 niveaux d'accès de la plateforme CSU Sénégal
  const accessLevelsList = [
    // Catégorie 1: Citoyens & assurés
    { id: 'citizen_std', code: 'ACC-01', title: '1. Assuré individuel / famille', cat: 'Citoyens & assurés', icon: '🇸🇳', color: '#059669', badge: 'Titulaire / ayant droit', desc: 'Accès au dossier médical, carte CSU numérique, renouvellement cotisations (Wave/OM) et historique des remboursements.' },
    { id: 'citizen_student', code: 'ACC-02', title: '2. Élève / étudiant (CSU jeunes)', cat: 'Citoyens & assurés', icon: '🎓', color: '#10b981', badge: 'Gratuité scolaire', desc: 'Prise en charge 100% des consultations en postes de santé et centres universitaires conventionnés.' },
    { id: 'citizen_bsf', code: 'ACC-03', title: '3. Bénéficiaire BSF (filet social)', cat: 'Citoyens & assurés', icon: '🌟', color: '#34d399', badge: 'Gratuité vulnérables', desc: 'Exonération intégrale des cotisations via la Bourse de Sécurité Familiale (BSF) du Gouvernement.' },

    // Catégorie 2: Soignants & plateau médical
    { id: 'doc_physician', code: 'ACC-04', title: '4. Médecin / praticien traitant', cat: 'Plateau médical', icon: '🩺', color: '#0284c7', badge: 'Ordre des médecins', desc: 'Prescription électronique d\'ordonnances, validation d\'actes de soins sous tiers-payant 80%, télé-expertise.' },
    { id: 'doc_nurse', code: 'ACC-05', title: '5. Infirmier / sage-femme', cat: 'Plateau médical', icon: '👩‍⚕️', color: '#38bdf8', badge: 'Poste & centre de santé', desc: 'Saisie rapide des bons de prise en charge, carnet de santé maternité et consultations de soins primaires.' },
    { id: 'doc_pharma', code: 'ACC-06', title: '6. Pharmacien d\'officine agréée', cat: 'Plateau médical', icon: '💊', color: '#7c3aed', badge: 'Officine conventionnée', desc: 'Vérification instantanée carte CSU, délivrance des médicaments du panier CSU et télé-transmission factures.' },
    { id: 'doc_lab', code: 'ACC-07', title: '7. Biologie & radiologie (laboratoire)', cat: 'Plateau médical', icon: '🔬', color: '#a855f7', badge: 'Examens complémentaires', desc: 'Transmission sécurisée des bilans d\'analyses, télé-imagerie médicale sous convention tiers-payant.' },
    { id: 'doc_eps', code: 'ACC-08', title: '8. Direction EPS & gestion hôpital', cat: 'Plateau médical', icon: '🏥', color: '#6366f1', badge: 'Gestion hôpital', desc: 'Télé-déclaration des factures de soins hospitaliers, suivi de convention et émission des lettres de garantie.' },

    // Catégorie 3: Mutuelles communautaires & agents
    { id: 'agent_field', code: 'ACC-09', title: '9. Agent mutuelle UDMS (terrain)', cat: 'Mutuelles communautaires', icon: '💼', color: '#d97706', badge: 'Enrôleur communal', desc: 'Enrôlement terrain des familles, encaissement physique des cotisations, impression/activation cartes CSU.' },
    { id: 'agent_supervisor', code: 'ACC-10', title: '10. Superviseur régional URMSCD', cat: 'Mutuelles communautaires', icon: '📊', color: '#f59e0b', badge: 'Audit & contrôle', desc: 'Contrôle financier et administratif des mutuelles de la région de Dakar, audit des factures litigieuses.' },

    // Catégorie 4: Gouvernance & tutelle
    { id: 'admin_national', code: 'ACC-11', title: '11. Super admin ANACSU & ministère', cat: 'Gouvernance nationale', icon: '👑', color: '#dc2626', badge: 'Tutelle nationale', desc: 'Pilotage stratégique national, révision des paniers de soins, régulation tarifaire et gouvernance globale.' },

    // Catégorie 5: Entreprises & mécènes
    { id: 'partner_company', code: 'ACC-12', title: '12. Entreprise / employeur privé', cat: 'Entreprises & mécènes', icon: '🏢', color: '#0891b2', badge: 'Souscription groupe', desc: 'Gestion de la couverture maladie collective des employés et versement des cotisations patronales groupe.' },
    { id: 'partner_rse', code: 'ACC-13', title: '13. Parrain solidaire & mécène RSE', cat: 'Entreprises & mécènes', icon: '🤝', color: '#06b6d4', badge: 'Parrainage solidaire', desc: 'Financement direct des adhésions pour les familles vulnérables de Dakar et suivi d\'impact social.' }
  ];

  const [toastMsg, setToastMsg] = useState('');

  // Action pour simuler la connexion au niveau d'accès sélectionné (13 profils distincts)
  const switchAccessPersona = (levelId) => {
    let targetView = 'profile';
    let profileName = '';

    if (levelId === 'citizen_std') {
      profileName = 'Assuré individuel / famille';
      const mockUser = {
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
        familyMembers: []
      };
      if (setCitizenUser) setCitizenUser(mockUser);
      if (setPortalMode) setPortalMode('citizen');
      localStorage.setItem('cmu-portal-mode', 'citizen');
      localStorage.setItem('cmu-citizen-user', JSON.stringify(mockUser));
      targetView = 'profile';
    } else if (levelId === 'citizen_student') {
      profileName = 'Élève / étudiant (CSU jeunes)';
      const mockStudent = {
        id: 3,
        firstName: 'Ibrahima',
        lastName: 'Sarr',
        birthDate: '2002-11-18',
        phone: '774567890',
        email: 'ibrahima.sarr@ucad.edu.sn',
        address: 'Campus Universitaire Fann, Dakar',
        mutuelleName: 'Mutuelle Étudiante UCAD Dakar',
        packageType: 'scolaire',
        paymentMethod: 'free',
        cmuNumber: 'SN-DK-UCAD-3012',
        status: 'active',
        familyMembers: []
      };
      if (setCitizenUser) setCitizenUser(mockStudent);
      if (setPortalMode) setPortalMode('citizen');
      localStorage.setItem('cmu-portal-mode', 'citizen');
      localStorage.setItem('cmu-citizen-user', JSON.stringify(mockStudent));
      targetView = 'profile';
    } else if (levelId === 'citizen_bsf') {
      profileName = 'Bénéficiaire BSF (filet social)';
      const mockBsf = {
        id: 4,
        firstName: 'Fatou',
        lastName: 'Diallo',
        birthDate: '1982-03-25',
        phone: '778901234',
        email: 'fatou.diallo@bsf.sn',
        address: 'Pikine Guinaw Rails, Dakar',
        mutuelleName: 'Mutuelle Communale de Pikine',
        packageType: 'gratuité',
        paymentMethod: 'gratuit_etat',
        cmuNumber: 'SN-DK-BSF-9901',
        status: 'active',
        familyMembers: [
          { id: 1, name: 'Aminata Diallo', relation: 'enfant', age: 6 },
          { id: 2, name: 'Ousmane Diallo', relation: 'enfant', age: 10 }
        ]
      };
      if (setCitizenUser) setCitizenUser(mockBsf);
      if (setPortalMode) setPortalMode('citizen');
      localStorage.setItem('cmu-portal-mode', 'citizen');
      localStorage.setItem('cmu-citizen-user', JSON.stringify(mockBsf));
      targetView = 'profile';
    } else if (levelId === 'doc_physician') {
      profileName = 'Médecin / praticien traitant';
      const mockDoc = {
        id: 10,
        username: 'docteur@csu.sn',
        contactName: 'Dr. Cheikh Anta Diop',
        structureName: 'Centre Hospitalier Abass Ndao',
        structureType: 'hopital',
        structureId: 1,
        coverageRate: 80,
        role: 'medecin'
      };
      if (setPartnerUser) setPartnerUser(mockDoc);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockDoc));
      targetView = 'telemedicine';
    } else if (levelId === 'doc_nurse') {
      profileName = 'Infirmier / sage-femme';
      const mockNurse = {
        id: 11,
        username: 'infirmiere@csu.sn',
        contactName: 'Aïssatou Sow (Sage-Femme)',
        structureName: 'Poste de Santé de la Médina',
        structureType: 'poste_sante',
        structureId: 2,
        coverageRate: 80,
        role: 'soignant'
      };
      if (setPartnerUser) setPartnerUser(mockNurse);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockNurse));
      targetView = 'maternity';
    } else if (levelId === 'doc_pharma') {
      profileName = 'Pharmacien d\'officine agréée';
      const mockPharma = {
        id: 12,
        username: 'pharmacie@csu.sn',
        contactName: 'Dr. Fatou Sow (Pharmacienne)',
        structureName: 'Grande Pharmacie de la Médina',
        structureType: 'pharmacie',
        structureId: 3,
        coverageRate: 80,
        role: 'pharmacien'
      };
      if (setPartnerUser) setPartnerUser(mockPharma);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockPharma));
      targetView = 'medicaments';
    } else if (levelId === 'doc_lab') {
      profileName = 'Biologie & radiologie (laboratoire)';
      const mockLab = {
        id: 13,
        username: 'laboratoire@csu.sn',
        contactName: 'Dr. Ousmane Kane (Biologiste)',
        structureName: 'Laboratoire de Biologie & Radiologie Pasteur',
        structureType: 'laboratoire',
        structureId: 4,
        coverageRate: 80,
        role: 'laboratoire'
      };
      if (setPartnerUser) setPartnerUser(mockLab);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockLab));
      targetView = 'partner';
    } else if (levelId === 'doc_eps') {
      profileName = 'Direction EPS & gestion hôpital';
      const mockEps = {
        id: 14,
        username: 'hopital@csu.sn',
        contactName: 'Direction de la Prise en Charge EPS',
        structureName: 'Hôpital Principal de Dakar (EPS 3)',
        structureType: 'hopital_eps',
        structureId: 5,
        coverageRate: 80,
        role: 'gestionnaire_eps'
      };
      if (setPartnerUser) setPartnerUser(mockEps);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockEps));
      targetView = 'guarantees';
    } else if (levelId === 'agent_field') {
      profileName = 'Agent mutuelle UDMS (terrain)';
      const mockFieldAgent = {
        id: 15,
        username: 'enroleur@csu.sn',
        firstName: 'Amadou',
        lastName: 'Sall',
        role: 'Agent d\'Enrôlement Terrain UDMS'
      };
      if (setAgentUser) setAgentUser(mockFieldAgent);
      if (setPortalMode) setPortalMode('agent');
      localStorage.setItem('cmu-portal-mode', 'agent');
      localStorage.setItem('cmu-agent-user', JSON.stringify(mockFieldAgent));
      targetView = 'beneficiaries';
    } else if (levelId === 'agent_supervisor') {
      profileName = 'Superviseur régional URMSCD';
      const mockSupervisor = {
        id: 16,
        username: 'agent@csu.sn',
        firstName: 'Mariama',
        lastName: 'Ba',
        role: 'Superviseur Régional URMSCD'
      };
      if (setAgentUser) setAgentUser(mockSupervisor);
      if (setPortalMode) setPortalMode('agent');
      localStorage.setItem('cmu-portal-mode', 'agent');
      localStorage.setItem('cmu-agent-user', JSON.stringify(mockSupervisor));
      targetView = 'dashboard';
    } else if (levelId === 'admin_national') {
      profileName = 'Super admin ANACSU & ministère';
      const mockSuper = {
        id: 99,
        username: 'superadmin@csu.sn',
        firstName: 'Dr. Mamadou',
        lastName: 'Ba',
        role: 'Super Admin'
      };
      if (setAgentUser) setAgentUser(mockSuper);
      if (setPortalMode) setPortalMode('agent');
      localStorage.setItem('cmu-portal-mode', 'agent');
      localStorage.setItem('cmu-agent-user', JSON.stringify(mockSuper));
      targetView = 'superadmin-governance';
    } else if (levelId === 'partner_company') {
      profileName = 'Entreprise / employeur privé';
      const mockCompany = {
        id: 20,
        username: 'entreprise@csu.sn',
        contactName: 'Direction RH Patisen',
        structureName: 'Groupe PATISEN SA',
        structureType: 'entreprise',
        coverageRate: 80,
        role: 'entreprise'
      };
      if (setPartnerUser) setPartnerUser(mockCompany);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockCompany));
      targetView = 'rse';
    } else if (levelId === 'partner_rse') {
      profileName = 'Parrain solidaire & mécène RSE';
      const mockRse = {
        id: 21,
        username: 'parrain@csu.sn',
        contactName: 'Fondation WAVE & Sonatel Mécénat',
        structureName: 'Parrain Solidaire Régional',
        structureType: 'fondation_rse',
        coverageRate: 100,
        role: 'parrain_rse'
      };
      if (setPartnerUser) setPartnerUser(mockRse);
      if (setPortalMode) setPortalMode('partner');
      localStorage.setItem('cmu-portal-mode', 'partner');
      localStorage.setItem('cmu-partner-user', JSON.stringify(mockRse));
      targetView = 'parrainage-solidaire';
    }

    setToastMsg(`⚡ Profil « ${profileName} » activé avec succès ! Redirection vers la page dédiée...`);
    if (setView) setView(targetView);
    setTimeout(() => {
      setToastMsg('');
    }, 2500);
  };

  // Super Admin Agent Creation State
  const [newAgent, setNewAgent] = useState({ firstName: '', lastName: '', username: '', password: '', role: 'Admin Régional' });
  const [agentList, setAgentList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMsg, setAdminMsg] = useState('');

  // Messages State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState({ receiver: '', subject: '', body: '' });
  const [msgLoading, setMsgLoading] = useState(false);

  // Loyalty State
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  // Fetch loyalty data for citizen
  useEffect(() => {
    if (portalMode === 'citizen' && citizenUser) {
      setLoyaltyLoading(true);
      const token = localStorage.getItem('cmu-token') || '';
      fetch(`http://localhost:5000/api/loyalty/${citizenUser.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch loyalty data');
          return res.json();
        })
        .then(data => {
          if (data) {
            setLoyaltyData(data);
          }
          setLoyaltyLoading(false);
        })
        .catch(err => {
          console.warn('Error fetching loyalty in profile:', err);
          setLoyaltyLoading(false);
        });
    }
  }, [citizenUser, portalMode]);

  // Fetch agents and messages on load if agent
  useEffect(() => {
    if (portalMode === 'agent' && user) {
      if (user.role === 'Super Admin') {
        fetch('http://localhost:5000/api/agents', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token')}` }
        })
          .then(res => res.json())
          .then(data => setAgentList(data))
          .catch(err => console.error(err));
      }
      fetch(`http://localhost:5000/api/messages/${user.username}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token')}` }
      })
        .then(res => res.json())
        .then(data => setMessages(data))
        .catch(err => console.error(err));
    }
  }, [portalMode, user]);

  const handleCreateAgent = () => {
    setAdminLoading(true);
    setAdminMsg('');
    fetch('http://localhost:5000/api/agents', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cmu-token')}`
      },
      body: JSON.stringify(newAgent)
    })
    .then(res => res.json())
    .then(data => {
      setAdminLoading(false);
      if (data.success) {
        setAdminMsg('Compte administrateur créé avec succès !');
        setAgentList([...agentList, data.agent]);
        setNewAgent({ firstName: '', lastName: '', username: '', password: '', role: 'Admin Régional' });
      } else {
        setAdminMsg('Erreur lors de la création : ' + (data.error || 'Inconnue'));
      }
    })
    .catch(() => {
      setAdminLoading(false);
      setAdminMsg('Erreur de connexion au serveur.');
    });
  };

  const handleSendMessage = () => {
    if (!newMessage.receiver || !newMessage.body) return;
    setMsgLoading(true);
    fetch('http://localhost:5000/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('cmu-token')}`
      },
      body: JSON.stringify({ sender: user.username, receiver: newMessage.receiver, subject: newMessage.subject, body: newMessage.body })
    })
    .then(res => res.json())
    .then(data => {
      setMsgLoading(false);
      if (data.success) {
        alert("Message envoyé !");
        setNewMessage({ receiver: '', subject: '', body: '' });
      }
    });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        fetch(`http://localhost:5000/api/agents/${user.id}/photo`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('cmu-token')}`
          },
          body: JSON.stringify({ photoUrl: base64String })
        })
        .then(() => {
          alert("Photo de profil mise à jour avec succès !");
          if (user) user.photoUrl = base64String;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="profile-view fade-in-up">
      {toastMsg && (
        <div style={{
          backgroundColor: '#059669',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '0.95rem',
          marginBottom: '1.5rem',
          boxShadow: '0 8px 24px rgba(5, 150, 105, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Banner Header */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.75), rgba(5, 150, 105, 0.45)), url("/csu_profile_hero_real.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
          <span className="badge badge-info" style={{ marginBottom: '0.75rem', background: 'rgba(255, 255, 255, 0.25)', color: '#fff', border: 'none' }}>
            👤 CSU DAKAR ACCOUNT & ACCESS GOVERNANCE
          </span>
          <h1 style={{ fontSize: '1.9rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {user ? (portalMode === 'citizen' ? t.titleCitizen : portalMode === 'partner' ? 'Mon profil prestataire CSU' : t.titleAgent) : 'Mon Compte & Niveaux d\'Accès CSU'}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', maxWidth: '850px', lineHeight: '1.5', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {user ? (portalMode === 'citizen' ? t.subtitleCitizen : t.subtitleAgent) : 'Gérez votre compte personnel et découvrez tous les niveaux d\'accès du système Couverture Santé Universelle.'}
          </p>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* SECTIONS PRINCIPALES SELON PROFIL CONNECTÉ OU VISITEUR                    */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {user ? (
        portalMode === 'partner' ? (
          /* VUE PRESTATAIRE / MÉDICAL / PHARMACIE / ENTREPRISE */
          <div style={{ maxWidth: '900px', margin: '0 auto 2.5rem auto' }}>
            <div className="grid grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>🏥 Informations de la structure</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Nom du responsable</div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{user.contactName}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Identifiant professionnel</div>
                    <div style={{ fontWeight: '600', fontFamily: 'monospace', color: 'var(--primary)' }}>{user.username}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Structure conventionnée</div>
                    <div style={{ fontWeight: '600' }}>{user.structureName}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Rôle d'accès</div>
                    <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                      <span className="badge badge-info">{user.role || 'Prestataire Sante'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>💳 Habilitations & Tiers-Payant CSU</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Taux de prise en charge</div>
                    <div style={{ fontWeight: '800', fontSize: '2.2rem', color: 'var(--primary)', lineHeight: 1.1 }}>
                      {user.coverageRate || 80}%
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Prise en charge directe CSU</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Statut conventionnement</div>
                    <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>✓ Homologué ANACSU & URMSCD</span>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Accès Tiers-Payant</div>
                    <div style={{ fontWeight: '600', color: 'var(--success)' }}>✅ Tiers-payant actif pour assurés CSU</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VUE CITOYEN OU AGENT */
          <div className="grid grid-3" style={{ alignItems: 'start', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {/* Carte CSU numérique (citoyen uniquement) */}
            {portalMode === 'citizen' && citizenUser && (
              <div className="card" style={{ padding: '1.5rem', gridColumn: 'span 3' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💳 Ma carte CSU numérique sécurisée
                </h3>
                <CmuCard citizen={citizenUser} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                  {lang === 'fr'
                    ? 'Présentez cette carte dans les hôpitaux et pharmacies agréés. Le QR code sécurisé garantit votre prise en charge immédiate.'
                    : 'Wonal ci kàrt bi ci fajukaay yi nu agréer. QR code bi mën nañu ko saytu ngir xam sa couverture.'}
                </p>
              </div>
            )}
            
            {/* Column 1: Avatar & Personal Info */}
            <div className="card text-left" style={{ padding: '1.5rem', gridColumn: 'span 1' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt="Profile" style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)', boxShadow: 'var(--shadow-md)' }} />
                  ) : (
                    <div style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem',
                      color: '#fff',
                      fontWeight: 'bold',
                      boxShadow: 'var(--shadow-md)'
                    }}>
                      {user.firstName ? user.firstName.charAt(0) : 'U'}
                    </div>
                  )}
                  <label 
                    title="Modifier la photo"
                    style={{ position: 'absolute', bottom: '0', right: '0', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: '1rem' }}>
                    📷
                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.25rem' }}>
                  {user.firstName} {user.lastName}
                </h2>
                <span className="badge badge-info">
                  {portalMode === 'citizen' ? 'Assuré CSU' : user.role || 'Agent CSU'}
                </span>
              </div>

              <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem' }}>📇 {t.cardPersonalInfo}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.9rem' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.nameLabel}</div>
                  <div style={{ fontWeight: '600' }}>{user.firstName} {user.lastName}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.phoneLabel}</div>
                  <div style={{ fontWeight: '600' }}>{user.phone || user.username}</div>
                </div>
                {user.email && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.emailLabel}</div>
                    <div style={{ fontWeight: '600', wordBreak: 'break-all' }}>{user.email}</div>
                  </div>
                )}
                {user.birthDate && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.birthLabel}</div>
                    <div style={{ fontWeight: '600' }}>{formatDate(user.birthDate)}</div>
                  </div>
                )}
                {user.address && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.addressLabel}</div>
                    <div style={{ fontWeight: '600' }}>{user.address}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2 & 3: Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', gridColumn: 'span 2' }}>
              {portalMode === 'citizen' ? (
                <>
                  <div className="card text-left" style={{ padding: '1.5rem', borderLeft: user.status === 'active' ? '6px solid var(--success)' : '6px solid var(--danger)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.1rem', color: user.status === 'active' ? 'var(--success)' : 'var(--danger)' }}>
                        {user.status === 'active' ? '✓ ' + t.statusActive : '⚠️ ' + t.statusInactive}
                      </h3>
                      <span className="badge badge-info" style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {user.cmuNumber}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
                      {user.status === 'active' ? t.activeDesc : t.inactiveDesc}
                    </p>
                    {user.status !== 'active' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => setView('services')}>
                        💳 {t.btnRenew}
                      </button>
                    )}
                  </div>

                  <div className="card text-left" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>🏥 {t.cardMutuelle}</h3>
                    <div className="grid grid-2" style={{ gap: '1rem', fontSize: '0.9rem' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.mutuelleNameLabel}</div>
                        <div style={{ fontWeight: '600' }}>{user.mutuelleName}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.mutuelleRates}</div>
                        <div style={{ fontWeight: '600' }}>{t.mutuelleRatesVal}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.packageLabel}</div>
                        <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>{user.packageType}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.paymentLabel}</div>
                        <div style={{ fontWeight: '600', textTransform: 'uppercase' }}>{user.paymentMethod}</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card text-left" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>💼 Renseignements professionnels CSU</h3>
                  <div className="grid grid-2" style={{ gap: '1rem', fontSize: '0.9rem' }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.agentRole}</div>
                      <div style={{ fontWeight: '600' }}>{user.role}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{t.agentId}</div>
                      <div style={{ fontWeight: '600' }}>{user.username}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Région administrative</div>
                      <div style={{ fontWeight: '600' }}>Dakar (URMSCD)</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Habilitation CSU</div>
                      <div style={{ fontWeight: '600', color: 'var(--success)' }}>✓ Valide</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      ) : null}

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* SECTION INTERACTIVE : CARTOGRAPHIE ET CASES DES 13 NIVEAUX D'ACCÈS CSU      */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <section className="card text-left" style={{ padding: '2rem 1.75rem', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', marginBottom: '3rem' }}>
        <div style={{ marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '0.5rem' }}>🌐 ARCHITECTURE SÉCURISÉE CSU SÉNÉGAL</span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
                Niveaux d'accès & points de connexion CSU (13 profils rôles)
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Explorez tous les points de connexion existants sur la plateforme et basculez instantanément de rôle pour tester les droits et fonctionnalités.
              </p>
            </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '1.1rem'
        }}>
          {accessLevelsList.map((lvl) => (
            <div key={lvl.id} style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderTop: `4px solid ${lvl.color}`,
              borderRadius: '16px',
              padding: '1.25rem 1.1rem',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between',
              gap: '0.8rem',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>{lvl.icon}</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    background: `${lvl.color}18`,
                    color: lvl.color,
                    padding: '0.2rem 0.5rem',
                    borderRadius: '8px'
                  }}>
                    {lvl.code} • {lvl.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  {lvl.title}
                </h3>
                <div style={{ fontSize: '0.72rem', fontWeight: '600', color: lvl.color, textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
                  {lvl.cat}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {lvl.desc}
                </p>
              </div>

              <div style={{ paddingTop: '0.5rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Droits : {lvl.cat.split(' ')[0]}</span>
                <button
                  className="btn btn-outline btn-xs"
                  onClick={() => switchAccessPersona(lvl.id)}
                  style={{ fontSize: '0.72rem', borderColor: lvl.color, color: lvl.color }}
                >
                  ⚡ Tester ce profil
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
