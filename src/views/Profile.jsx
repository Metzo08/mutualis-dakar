import React, { useState, useEffect } from 'react';
import CmuCard from '../components/CmuCard';

export default function Profile({ lang, portalMode, citizenUser, agentUser, partnerUser, setView, setViewTab }) {
  const dict = {
    fr: {
      titleCitizen: 'Mon compte assuré',
      titleAgent: 'Mon profil agent',
      subtitleCitizen: 'Consultez vos informations personnelles, le statut de votre couverture CMU et gérez vos ayants droit.',
      subtitleAgent: 'Détails de votre session professionnelle, rôle et statistiques d\'activité administrative.',
      cardPersonalInfo: 'Informations personnelles',
      cardCoverage: 'Statut de couverture',
      cardFamily: 'Ayants droit rattachés',
      cardMutuelle: 'Ma mutuelle de santé',
      cardStats: 'Statistiques d\'activité',
      nameLabel: 'Nom complet',
      phoneLabel: 'Numéro de téléphone',
      emailLabel: 'Adresse e-mail',
      birthLabel: 'Date de naissance',
      addressLabel: 'Adresse de résidence',
      cmuIdLabel: 'Numéro de carte CMU',
      statusActive: 'Couverture active',
      statusInactive: 'Couverture inactive',
      activeDesc: 'Vous bénéficiez du tiers-payant jusqu\'à 80% dans toutes les structures conventionnées.',
      inactiveDesc: 'Votre couverture est suspendue. Veuillez régulariser votre cotisation de 4 500 FCFA.',
      mutuelleNameLabel: 'Nom de la mutuelle',
      mutuelleRates: 'Tarif cotisation',
      mutuelleRatesVal: '4 500 FCFA / an',
      packageLabel: 'Formule souscrite',
      paymentLabel: 'Moyen de paiement',
      historyTitle: 'Historique des cotisations',
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
      titleCitizen: 'Sama compte assuré',
      titleAgent: 'Sama profil agent',
      subtitleCitizen: 'Xoolal say information, sa couverture CMU ak sa njabot.',
      subtitleAgent: 'Liggéey bi nga yore, sa rôle ak statistiques ci portal cmu.',
      cardPersonalInfo: 'Mbind yi ci yaw',
      cardCoverage: 'Statut couverture',
      cardFamily: 'Sa njabot gu bokk',
      cardMutuelle: 'Sa mutuelle wér-gi-yaram',
      cardStats: 'Chiffres liggéey',
      nameLabel: 'Tour ak sant',
      phoneLabel: 'Portable',
      emailLabel: 'Email',
      birthLabel: 'Date doudou',
      addressLabel: 'Dëkkway',
      cmuIdLabel: 'N° carte CMU',
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
          user.photoUrl = base64String; // optimistic UI update
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer définitivement votre compte et toutes vos données (Droit à l'oubli RGPD) ? Cette action est irréversible.")) {
      fetch(`http://localhost:5000/api/beneficiaries/${user.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('cmu-token')}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("Votre compte a été supprimé conformément au RGPD.");
          localStorage.removeItem('cmu-token');
          window.location.reload();
        } else {
          alert("Erreur lors de la suppression.");
        }
      })
      .catch(() => alert("Erreur serveur lors de la suppression."));
    }
  };

  if (!user) {
    return (
      <div className="card text-center" style={{ padding: '3rem', margin: '2rem auto', maxWidth: '500px' }}>
        <h2>🔒 Accès restreint</h2>
        <p>Veuillez vous connecter pour accéder à cette page.</p>
        <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setView('login')}>
          Se connecter
        </button>
      </div>
    );
  }

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

  // ── PARTENAIRE : vue dédiée ────────────────────────────────────────────
  if (portalMode === 'partner') {
    const p = partnerUser;
    return (
      <div className="profile-view fade-in-up">
        {/* Banner */}
        <section className="banner-mini" style={{
          background: 'linear-gradient(to right, rgba(5, 150, 105, 0.75), rgba(5, 150, 105, 0.45)), url("/csu_partner_hero.png") center/cover no-repeat',
          borderBottom: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          marginBottom: '2rem',
          color: '#fff',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
            <span className="badge badge-info" style={{ marginBottom: '0.75rem', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', display: 'inline-block' }}>
              🏥 ESPACE PRESTATAIRE
            </span>
            <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
              Mon profil prestataire
            </h1>
            <p style={{ color: '#f1f5f9', fontSize: '1rem', fontWeight: '500', textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
              {p ? `${p.structureName} — ${p.contactName}` : 'Structure de soins conventionnée'}
            </p>
          </div>
        </section>

        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
          {p ? (
            <div className="grid grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
              {/* Infos structure */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>🏥 Informations de la structure</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Nom du contact</div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{p.contactName}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Identifiant de connexion</div>
                    <div style={{ fontWeight: '600', fontFamily: 'monospace', color: 'var(--primary)' }}>{p.username}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Structure de soins</div>
                    <div style={{ fontWeight: '600' }}>{p.structureName}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Type de structure</div>
                    <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                      {p.structureType ? p.structureType.replace(/_/g, ' ') : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Couverture & tiers-payant */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>💳 Couverture & tiers-payant</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', fontSize: '0.9rem' }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Taux de prise en charge</div>
                    <div style={{ fontWeight: '800', fontSize: '2.2rem', color: 'var(--primary)', lineHeight: 1.1 }}>
                      {p.coverageRate !== undefined && p.coverageRate !== null ? `${p.coverageRate}%` : '—'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>prise en charge tiers-payant</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Statut de la convention</div>
                    <span className="badge badge-success" style={{ fontSize: '0.8rem' }}>✓ Conventionnée — active</span>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Accès tiers-payant</div>
                    <div style={{ fontWeight: '600', color: 'var(--success)' }}>✅ Autorisé pour les assurés CMU</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center" style={{ padding: '3rem', maxWidth: '500px', margin: '0 auto' }}>
              <h2>🔒 Non connecté</h2>
              <p>Veuillez vous connecter à l'espace partenaire pour accéder à votre profil.</p>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setView('partner')}>Se connecter</button>
            </div>
          )}
        </div>
      </div>
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="profile-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_profile_hero_real.png") center/cover no-repeat',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ textAlign: 'left', position: 'relative', zIndex: 2 }}>
          <span className="badge badge-info" style={{ marginBottom: '0.75rem', background: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}>
            👤 CMU DAKAR PROFILE
          </span>
          <h1 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {portalMode === 'citizen' ? t.titleCitizen : t.titleAgent}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', maxWidth: '800px', lineHeight: '1.5', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {portalMode === 'citizen' ? t.subtitleCitizen : t.subtitleAgent}
          </p>
        </div>
      </section>

      <div className="grid grid-3" style={{ alignItems: 'start', gap: '1.5rem' }}>
        
        {/* Carte CMU numérique (citoyen uniquement) */}
        {portalMode === 'citizen' && citizenUser && (
          <div className="card" style={{ padding: '1.5rem', gridColumn: 'span 3' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💳 Ma carte CMU numérique
            </h3>
            <CmuCard citizen={citizenUser} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
              {lang === 'fr'
                ? 'Présentez cette carte dans les structures conventionnées. Le QR code permet la vérification instantanée de votre couverture.'
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
              {portalMode === 'citizen' ? 'Assuré CMU' : user.role || 'Agent CMU'}
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

        {/* Column 2 & 3: Portal Specific Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', gridColumn: 'span 2' }}>
          
          {portalMode === 'citizen' ? (
            <>
              {/* Citizen Card 1: CMU Coverage Status */}
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

              {/* Citizen Card 2: Mutuelle */}
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

              {/* Citizen Card 3: Family Members */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>👨‍👩‍👧‍ {t.cardFamily}</h3>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-outline btn-xs" onClick={() => setViewTab('services', 'register', 'familial')}>
                      + Ajouter
                    </button>
                    <button className="btn btn-success btn-xs" style={{ backgroundColor: 'var(--success)', border: 'none', color: '#fff' }} onClick={() => setViewTab('parrainage-solidaire')}>
                      🤝 Parrainer
                    </button>
                  </div>
                </div>
                {user.familyMembers && user.familyMembers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {user.familyMembers.map((member, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}>
                        <span style={{ fontWeight: '700' }}>{member.name}</span>
                        <span style={{ color: 'var(--text-sub)' }}>
                          {member.relation === 'conjoint' ? 'Conjoint' : 'Enfant'} — {member.age} ans
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Aucun ayant droit rattaché à votre compte.
                  </p>
                )}
              </div>

              {/* Citizen Card 4: Adhésions & Parrainages en Masse */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>
                  📊 {lang === 'fr' ? 'Adhésions & parrainages en masse' : 'Mbindum Mboloo & Dimbalé'}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '1.5rem' }}>
                  {lang === 'fr' 
                    ? "Inscrivez plusieurs bénéficiaires à la fois (élèves de Daara, employés, membres d'association) ou parrainez des packs collectifs."
                    : "Duggalal mboloo (élèves walla talibé) walla parrainé packs collectifs ci sa compte."}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => setViewTab('services', 'register', 'adhesion_masse')}
                    style={{ flex: '1', minWidth: '150px', justifyContent: 'center' }}
                  >
                    📋 {lang === 'fr' ? 'Adhésion groupe / masse' : 'Mbindum Mboloo'}
                  </button>
                  <button 
                    className="btn btn-success btn-sm" 
                    onClick={() => setViewTab('parrainage-solidaire', 'register', 'collectif')}
                    style={{ flex: '1', minWidth: '150px', justifyContent: 'center', backgroundColor: 'var(--success)', border: 'none', color: '#fff' }}
                  >
                    🤝 {lang === 'fr' ? 'Parrainage de masse' : 'Dimbalé Packs'}
                  </button>
                </div>
              </div>

              {/* Citizen Card: Loyalty & Badges */}
              {loyaltyData && (
                <div className="card text-left" style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>⭐ Fidélité & badges</span>
                    <span className="badge badge-success" style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', textTransform: 'none' }}>
                      Niveau {loyaltyData.level}
                    </span>
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', backgroundColor: 'var(--bg-card-subtle)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', border: '1px solid var(--border-color)' }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #fbbf24 0%, #d97706 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.8rem',
                      color: '#fff',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      🌟
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>Solde actuel</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-main)' }}>{loyaltyData.totalPoints} points</div>
                    </div>
                  </div>

                  {loyaltyData.nextBadge && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                        <span>Prochain badge : {loyaltyData.nextBadge.name}</span>
                        <span>{loyaltyData.totalPoints} / {loyaltyData.nextBadge.threshold || 200} pts</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${loyaltyData.nextBadge.progress}%`, height: '100%', background: 'linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)' }}></div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Badges débloqués</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {loyaltyData.badges && loyaltyData.badges.map((badge, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.8rem',
                          borderRadius: '20px',
                          border: badge.unlocked ? '1px solid #10b981' : '1px dashed var(--border-color)',
                          backgroundColor: badge.unlocked ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-card-subtle)',
                          opacity: badge.unlocked ? 1 : 0.5,
                          fontSize: '0.8rem'
                        }} title={badge.description}>
                          <span>{badge.icon}</span>
                          <span style={{ fontWeight: badge.unlocked ? '600' : 'normal' }}>{badge.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Citizen Card 4: Cotisations History */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>📜 {t.historyTitle}</h3>
                <div className="directory-table-container">
                  <table className="directory-table">
                    <thead>
                      <tr>
                        <th>{t.thDate}</th>
                        <th>{t.thAmount}</th>
                        <th>{t.thMethod}</th>
                        <th>{t.thStatus}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                          {formatDate(new Date())}
                        </td>
                        <td style={{ fontWeight: '600' }}>
                          {user.packageType === 'individuel' ? '4 500 FCFA' : '18 500 FCFA'}
                        </td>
                        <td style={{ textTransform: 'uppercase' }}>{user.paymentMethod}</td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                            {t.paidStatus}
                          </span>
                        </td>
                      </tr>
                      {user.status === 'active' && (
                        <tr>
                          <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>
                            02/01/2025
                          </td>
                          <td style={{ fontWeight: '600' }}>4 500 FCFA</td>
                          <td>WAVE</td>
                          <td>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                              {t.paidStatus}
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              

            </>
          ) : (
            <>
              {/* Agent Card 1: Role and Professional info */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>💼 Renseignements professionnels</h3>
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
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Statut habilitation</div>
                    <div style={{ fontWeight: '600', color: 'var(--success)' }}>✓ Accès Superviseur</div>
                  </div>
                </div>
              </div>

              {/* Agent Card 2: Admin stats */}
              <div className="card text-left" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>📈 Habilitations administratives</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                  En tant que membre du bureau exécutif, vous êtes habilité à approuver les dossiers de pré-inscription, auditer les transactions financières et administrer le journal de sécurité régional.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setView('beneficiaries')}>👥 Valider pré-inscriptions</button>
                  {user.role === 'Super Admin' && (
                    <button className="btn btn-outline btn-sm" onClick={() => setView('audit-logs')}>🔒 Registre d'audit</button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => setView('complaints')}>📣 Réclamations</button>
                </div>
              </div>
            </>
          )}

          {/* Super Admin Section */}
          {portalMode === 'agent' && user.role === 'Super Admin' && (
            <div className="card text-left fade-in-up" style={{ padding: '1.5rem', borderTop: '4px solid var(--secondary)', marginTop: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>👑 Gestion de la plateforme (super admin)</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                Espace dédié au pilotage global. Création et attribution des niveaux d'accès hiérarchiques aux agents locaux.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prénom</label>
                  <input type="text" className="form-control" placeholder="Ex: Moussa" value={newAgent.firstName} onChange={(e) => setNewAgent({...newAgent, firstName: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nom</label>
                  <input type="text" className="form-control" placeholder="Ex: Diop" value={newAgent.lastName} onChange={(e) => setNewAgent({...newAgent, lastName: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email (Identifiant)</label>
                  <input type="email" className="form-control" placeholder="agent@cmu.sn" value={newAgent.username} onChange={(e) => setNewAgent({...newAgent, username: e.target.value})} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mot de passe temporaire</label>
                  <input type="text" className="form-control" placeholder="cmu2026" value={newAgent.password} onChange={(e) => setNewAgent({...newAgent, password: e.target.value})} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Niveau d'accès (Rôle)</label>
                  <select className="form-control" value={newAgent.role} onChange={(e) => setNewAgent({...newAgent, role: e.target.value})}>
                    <option value="Admin Régional">Administrateur Régional</option>
                    <option value="Admin Départemental">Administrateur Départemental</option>
                    <option value="Admin Communal">Administrateur Communal</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={handleCreateAgent} disabled={adminLoading}>
                {adminLoading ? 'Création en cours...' : '+ Créer le compte administrateur'}
              </button>
              {adminMsg && <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: adminMsg.includes('succès') ? 'var(--success)' : 'var(--danger)' }}>{adminMsg}</div>}
              
              <hr style={{ margin: '2rem 0', borderColor: 'var(--border-color)' }} />
              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Liste des Administrateurs</h4>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Identifiant</th>
                      <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Nom complet</th>
                      <th style={{ textAlign: 'left', paddingBottom: '0.5rem' }}>Rôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentList.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 0' }}>{a.username}</td>
                        <td style={{ padding: '0.75rem 0' }}>{a.first_name} {a.last_name}</td>
                        <td style={{ padding: '0.75rem 0' }}>
                          <span className="badge badge-info">{a.role}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Messaging Section (For all agents) */}
          {portalMode === 'agent' && (
            <div className="card text-left fade-in-up" style={{ padding: '1.5rem', marginTop: '0.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>✉️ Messagerie interne</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                Communiquez avec les autres administrateurs de la plateforme.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Envoyer à (Email/Identifiant) :</label>
                <input type="text" className="form-control" placeholder="Ex: admin@cmu.sn" value={newMessage.receiver} onChange={e => setNewMessage({...newMessage, receiver: e.target.value})} />
                
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sujet :</label>
                <input type="text" className="form-control" placeholder="Sujet de votre message" value={newMessage.subject} onChange={e => setNewMessage({...newMessage, subject: e.target.value})} />
                
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Message :</label>
                <textarea className="form-control" rows="3" placeholder="Tapez votre message ici..." value={newMessage.body} onChange={e => setNewMessage({...newMessage, body: e.target.value})}></textarea>
                
                <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start', marginTop: '0.5rem' }} onClick={handleSendMessage} disabled={msgLoading}>
                  {msgLoading ? 'Envoi...' : 'Envoyer le message'}
                </button>
              </div>

              <h4 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Boîte de réception ({messages.length})</h4>
              {messages.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Aucun message reçu.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {messages.map(m => (
                    <div key={m.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>De: {m.sender_username}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleString('fr-FR')}</span>
                      </div>
                      <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>Sujet : {m.subject}</div>
                      <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
