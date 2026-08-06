import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';

// Design Premium Haut de Gamme — Carnet Maternité & Santé Enfant
export default function MaternalHealth({ lang = 'fr', citizenUser = null, agentUser = null, partnerUser = null, userRole = 'citizen', setView = null }) {
  // ═══════════════════════════════════════════════════════
  // TOUS LES HOOKS DOIVENT ÊTRE ICI — avant tout return conditionnel
  // (règle des hooks React : ne jamais appeler useState/useEffect après un return)
  // ═══════════════════════════════════════════════════════
  const [activeTab, setActiveTab] = useState('cpn'); // 'cpn', 'pev', 'advice'

  // Modales
  const [showGuaranteeModal, setShowGuaranteeModal] = useState(false);
  const [showRightsModal, setShowRightsModal] = useState(false);
  const [showAskMidwifeModal, setShowAskMidwifeModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedCpnForBooking, setSelectedCpnForBooking] = useState(null);

  // Modales conseils dynamiques
  const [selectedAdviceArticle, setSelectedAdviceArticle] = useState(null);
  const [showAddAdviceModal, setShowAddAdviceModal] = useState(false);
  const [newAdviceForm, setNewAdviceForm] = useState({
    icon: '💡',
    badge: 'Santé & Nutrition',
    title: '',
    subtitle: '',
    author: 'Sage-femme Fatou Diome',
    content: '',
    tips: ''
  });

  // Liste dynamique des fiches conseils avec images d'aliments réalistes
  const [adviceArticles, setAdviceArticles] = useState([
    {
      id: 'nutrition_t2',
      icon: '🥗',
      badge: 'Nutrition Maternelle',
      title: 'Les aliments clés du 2ème trimestre',
      subtitle: 'Recommandations nutritionnelles pour maman & bébé',
      image: '/maternal_nutrition_food.jpg',
      readTime: '3 min de lecture',
      author: 'Dr. Mariama Ba (Gynécologue)',
      content: [
        'Privilégiez les aliments riches en fer bio-disponible : viande rouge maigre, lentilles, épinards locaux et poisson frais.',
        'Renforcez votre apport en calcium et vitamine D : laitages fermentés (thiakry sans sucre excessif), petit lait et sardines.',
        'Hydratation constante : buvez au moins 2.5 litres d\'eau minérale ou filtrée par jour pour prévenir les infections urinaires.',
        'Évitez le sel excessif et les boissons gazeuses sucrées pour limiter le risque d\'hypertension artérielle gravidique.'
      ],
      tips: '💡 Astuce Sage-femme : Associez les graines d\'arraw avec de la vitamine C (citron/baobab) pour tripler l\'absorption du fer !'
    },
    {
      id: 'allaitement_exclusif',
      icon: '🍼',
      badge: 'Santé Nourrisson',
      title: 'Allaitement maternel exclusif 0-6 mois',
      subtitle: 'Techniques de mise au sein et alimentation équilibrée de la mère',
      image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
      readTime: '4 min de lecture',
      author: 'Sage-femme Fatou Diome',
      content: [
        'Le colostrum (premier lait jaunâtre) est le premier vaccin naturel riche en anticorps protecteurs.',
        'Mise au sein précoce : installez le nouveau-né en peau à peau dès la première heure suivant la naissance.',
        'Positionnement correct : la bouche de bébé doit englober l\'aréole entière et non le seul téton pour éviter les crevasses douloureuses.',
        'Allaitement à la demande : au moins 8 à 12 tétées par 24h sans eau ni tisane ajoutée jusqu\'à 6 mois révolus.'
      ],
      tips: '💡 Conseil d\'hygiène : Appliquez une goutte de votre propre lait maternel sur les mamelons après chaque tétée pour cicatriser naturellement.'
    },
    {
      id: 'fievre_pev',
      icon: '🌡️',
      badge: 'Vaccination PEV',
      title: 'Que faire en cas de fièvre après vaccin PEV ?',
      subtitle: 'Gestes simples et prise de paracétamol adapté',
      image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
      readTime: '2 min de lecture',
      author: 'Pédiatre CHU Fann',
      content: [
        'Une fièvre modérée (37.8°C - 38.5°C) est une réaction immunitaire normale provoquant la fabrication des anticorps dans les 24h à 48h.',
        'Déshabillez légèrement le bébé dans une pièce bien aérée sans courant d\'air froid.',
        'Administration de Paracétamol sirop pédiatrique : 15 mg/kg toutes les 6 heures uniquement en cas d\'inconfort ou > 38.5°C.',
        'Baignez bébé dans une eau tiède (1°C en dessous de sa température corporelle), jamais dans de l\'eau glacée.'
      ],
      tips: '⚠️ Signes d\'alerte : Si la fièvre dépasse 39°C ou persiste plus de 48h, consultez immédiatement au centre de santé le plus proche.'
    }
  ]);

  // Formulaire question sage-femme
  const [midwifeQuestion, setMidwifeQuestion] = useState('');
  const [midwifeAnswers, setMidwifeAnswers] = useState([
    {
      q: "Est-ce normal d'avoir des nausées légères au 2ème trimestre ?",
      a: "Bonjour Awa. Les nausées diminuent généralement au 2ème trimestre. Si elles persistent, nous vous recommandons des tisanes au gingembre et des repas fractionnés.",
      date: "Hier à 14:30",
      doctor: "Sage-femme Fatou Diome"
    }
  ]);

  // Données CPN
  const [cpnVisits, setCpnVisits] = useState([
    {
      id: 1,
      title: 'CPN 1 (1er trimestre - Datation & sérologies)',
      desc: 'Grossesse intra-utérine évolutive 8 SA. Bilan biologique initial normal, groupe O+.',
      date: '10/04/2026',
      doctor: 'Sage-femme Fatou Kiné Diop',
      status: 'CPN 1 - CONFIRMÉE',
      completed: true
    },
    {
      id: 2,
      title: 'CPN 2 (2ème trimestre - Morphologie & VAT 1)',
      desc: 'Hauteur utérine 21 cm. Bruit du cœur fœtal régulier (145 bpm). Injection VAT 1 réalisée.',
      date: '05/06/2026',
      doctor: 'Dr. Mariama Ba (Gynécologue)',
      status: 'CPN 2 - CONFIRMÉE',
      completed: true
    },
    {
      id: 3,
      title: 'CPN 3 (28-32 SA - Dépistage anémie & TPI-SP 1)',
      desc: 'Prévue : Contrôle hémoglobine, 1ère dose TPI-SP (Prévention Paludisme) & VAT 2.',
      date: '12/08/2026',
      doctor: 'Sage-femme Fatou Kiné Diop',
      status: 'CPN 3 - À VENIR',
      completed: false
    },
    {
      id: 4,
      title: 'CPN 4+ (36-38 SA - Préparation accouchement 100% gratuit)',
      desc: 'Prévue : Présentation céphalique, vérification bassin maternel & fiche de liaison.',
      date: '25/09/2026',
      doctor: 'Dr. Mariama Ba (Gynécologue)',
      status: 'CPN 4 - À VENIR',
      completed: false
    }
  ]);
  // Édition CPN (médecin / sage-femme / superadmin)
  const [editingCpnId, setEditingCpnId] = useState(null);
  const [editCpnForm, setEditCpnForm] = useState({ title: '', desc: '', date: '', doctor: '', status: '', completed: false });
  const [showAddCpnModal, setShowAddCpnModal] = useState(false);
  const [newCpnForm, setNewCpnForm] = useState({ title: '', desc: '', date: '', doctor: '', status: '', completed: false });
  // Édition fiche conseil
  const [editingAdviceId, setEditingAdviceId] = useState(null);
  const [editAdviceForm, setEditAdviceForm] = useState(null);
  // Réponse professionnel
  const [replyingToIdx, setReplyingToIdx] = useState(null);
  const [proReply, setProReply] = useState('');
  // ═══════════════════════════════════════════════════════
  // FIN DES HOOKS — les returns conditionnels peuvent maintenant suivre
  // ═══════════════════════════════════════════════════════

  // Détection du sexe masculin pour l'assuré connecté
  const isMale = () => {
    if (userRole === 'citizen' && citizenUser) {
      if (citizenUser.gender === 'M' || citizenUser.sexe === 'M') return true;
      const firstName = (citizenUser.firstName || citizenUser.first_name || '').toLowerCase();
      const maleNames = ['ibrahima', 'modou', 'amadou', 'moustapha', 'abdoulaye', 'cheikh', 'moussa', 'ousmane', 'mamadou', 'babacar', 'samba', 'aliou', 'boubacar', 'omar', 'pape'];
      if (maleNames.some(n => firstName.includes(n))) return true;
    }
    return false;
  };

  if (isMale()) {
    return (
      <div className="maternity-view fade-in-up" style={{ minHeight: '60vh', padding: '3rem 1rem' }}>
        <div className="card text-center" style={{ maxWidth: '650px', margin: '0 auto', padding: '3rem 2rem', borderRadius: '24px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>ℹ️</div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.75rem' }}>
            Accès au Carnet Maternité
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-sub)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Bonjour <strong>{citizenUser.firstName || citizenUser.first_name} {citizenUser.lastName || citizenUser.last_name}</strong>. Le Carnet Maternité est réservé au suivi de la santé maternelle et des ayants droit mères/enfants. Votre suivi médical personnel est disponible dans votre rubrique <strong>Dossier & radios</strong>.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setView ? setView('medical-profile') : (window.location.hash = '#/medical-profile')}>
              🩺 Consulter mon Dossier & radios
            </button>
            <button className="btn btn-outline" onClick={() => setView ? setView('profile') : (window.location.hash = '#/profile')}>
              👤 Mon compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Guard de confidentialité : si l'utilisateur n'est pas connecté, masquer les données de maternité
  if (!citizenUser && !agentUser && !partnerUser && userRole !== 'agent' && userRole !== 'partner') {
    return (
      <div className="maternity-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header Banner */}
          <div className="p-5 rounded-4 text-center text-white mb-4" style={{
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.82) 0%, rgba(4, 120, 87, 0.88) 100%), url("/csu_family_health.png") center/cover no-repeat',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🤱</div>
            <span className="badge mb-2" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>
              Programme national de santé maternelle & infantile
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#fff', fontSize: '2rem' }}>
              Carnet de maternité : 100% gratuit UNAMUSC
            </h2>
            <p className="small mb-4" style={{ color: '#fce7f3', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
              Afin de protéger le suivi prénatal, les rendez-vous CPN et le calendrier vaccinal des mères et des enfants, le carnet numérique est accessible exclusivement après authentification sécurisée.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-light fw-bold px-4 py-3" 
                style={{ borderRadius: '14px', color: '#9d174d', fontSize: '0.98rem', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                onClick={() => setView ? setView('login') : (window.location.hash = '#/login')}
              >
                🔐 Se connecter à mon carnet maternité
              </button>
            </div>
          </div>

          {/* Quick Search Card */}
          <div className="card p-4 p-md-5 mb-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '2.25rem 2rem' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.75rem' }}>
              🔎 Vérifier mes droits à la gratuité maternité (100% CSU)
            </h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-sub)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Saisissez le N° de votre carte CSU pour accéder à votre calendrier de consultations prénatales (CPN 1 à 4) et générer vos attestations d'accouchement gratuit.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input 
                type="text" 
                className="form-control fw-bold" 
                placeholder="Ex: SN-DK-MED-8472"
                style={{ flex: 1, minWidth: '240px', height: '52px', fontSize: '0.95rem', borderRadius: '12px' }}
              />
              <button 
                className="btn btn-success fw-bold px-4 py-3"
                style={{ borderRadius: '12px', background: '#be185d', borderColor: '#be185d', height: '52px', fontSize: '0.95rem' }}
                onClick={() => setView ? setView('login') : (window.location.hash = '#/login')}
              >
                🔍 Vérifier mes droits
              </button>
            </div>
          </div>

          {/* Key Advantages Grid */}
          <div className="grid grid-3" style={{ gap: '1.25rem' }}>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🩺</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>4 CPN 100% gratuites</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Consultations prénatales réglementaires, échographies et bilans sanguins entièrement pris en charge par l'UNAMUSC.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🏥</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Accouchement 0 FCFA</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Prise en charge intégrale des accouchements simples et césariennes d'urgence dans tous les centres publics.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>👶</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Vaccination PEV & pédiatrie</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Suivi vaccinal complet du programme PEV et soins gratuits pour les enfants jusqu'à l'âge de 5 ans.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const handleAddAdvice = (e) => {
    e.preventDefault();
    if (!newAdviceForm.title || !newAdviceForm.content) return;
    const newArticle = {
      id: `advice_${Date.now()}`,
      icon: newAdviceForm.icon || '💡',
      badge: newAdviceForm.badge || 'Conseil Médical',
      title: newAdviceForm.title,
      subtitle: newAdviceForm.subtitle || 'Fiche d\'information santé prénatale & infantile',
      image: '/csu_kids_real.png',
      readTime: '3 min de lecture',
      author: newAdviceForm.author || 'Sage-femme de garde UNAMUSC',
      content: newAdviceForm.content.split('\n').filter(line => line.trim() !== ''),
      tips: newAdviceForm.tips ? `💡 ${newAdviceForm.tips}` : '💡 Suivez les recommandations médicales de votre centre de santé de référence.'
    };
    setAdviceArticles([newArticle, ...adviceArticles]);
    setShowAddAdviceModal(false);
    setNewAdviceForm({ icon: '💡', badge: 'Santé & Nutrition', title: '', subtitle: '', author: 'Sage-femme Fatou Diome', content: '', tips: '' });
    alert("✅ La nouvelle fiche conseil a bien été ajoutée au carnet de maternité !");
  };

  // ─── Handlers (les hooks correspondants sont déclarés plus haut, avant les returns conditionnels) ───

  // Confirmer réservation CPN
  const handleConfirmBooking = (cpnId) => {
    setCpnVisits(cpnVisits.map(c => c.id === cpnId ? { ...c, completed: true, status: `CPN ${c.id} - CONFIRMÉE` } : c));
    setShowBookingModal(false);
    alert("✅ Rendez-vous CPN réservé et confirmé sous la prise en charge 100% UNAMUSC.");
  };

  // ─── ÉDITION CPN (médecin / sage-femme / superadmin) ───

  const openEditCpn = (cpn) => {
    setEditingCpnId(cpn.id);
    setEditCpnForm({ title: cpn.title, desc: cpn.desc, date: cpn.date, doctor: cpn.doctor, status: cpn.status, completed: cpn.completed });
  };

  const handleSaveEditCpn = (e) => {
    e.preventDefault();
    setCpnVisits(cpnVisits.map(c => c.id === editingCpnId ? { ...c, ...editCpnForm } : c));
    setEditingCpnId(null);
    alert("✅ Consultation CPN modifiée et certifiée.");
  };

  const handleDeleteCpn = (cpnId) => {
    if (window.confirm('Supprimer définitivement cette consultation CPN du carnet de maternité ?')) {
      setCpnVisits(cpnVisits.filter(c => c.id !== cpnId));
      alert("🗑 Consultation CPN supprimée.");
    }
  };

  const handleAddCpn = (e) => {
    e.preventDefault();
    if (!newCpnForm.title) return;
    const newCpn = { id: Date.now(), ...newCpnForm };
    setCpnVisits([...cpnVisits, newCpn]);
    setShowAddCpnModal(false);
    setNewCpnForm({ title: '', desc: '', date: '', doctor: '', status: '', completed: false });
    alert("✅ Nouvelle consultation CPN ajoutée au carnet de maternité.");
  };

  // ─── ÉDITION FICHE CONSEIL (médecin / sage-femme / superadmin) ───

  const openEditAdvice = (art) => {
    setEditingAdviceId(art.id);
    setEditAdviceForm({ ...art, content: Array.isArray(art.content) ? art.content.join('\n') : art.content });
  };

  const handleSaveEditAdvice = (e) => {
    e.preventDefault();
    const updated = { ...editAdviceForm, content: editAdviceForm.content.split('\n').filter(l => l.trim()) };
    setAdviceArticles(adviceArticles.map(a => a.id === editingAdviceId ? updated : a));
    setEditingAdviceId(null);
    setEditAdviceForm(null);
    alert("✅ Fiche conseil modifiée et publiée.");
  };

  const handleDeleteAdvice = (artId) => {
    if (window.confirm('Supprimer définitivement cette fiche conseil ?')) {
      setAdviceArticles(adviceArticles.filter(a => a.id !== artId));
      alert("🗑 Fiche conseil supprimée.");
    }
  };

  // ─── RÉPONSE PROFESSIONNEL (médecin / sage-femme) ───

  const handleProReply = (idx) => {
    if (!proReply.trim()) return;
    const updated = [...midwifeAnswers];
    updated[idx] = { ...updated[idx], a: proReply, date: "À l'instant", doctor: isMidwife ? 'Sage-femme (UNAMUSC)' : 'Médecin (UNAMUSC)' };
    setMidwifeAnswers(updated);
    setReplyingToIdx(null);
    setProReply('');
    alert("✅ Réponse publiée — l'assurée est notifiée.");
  };

  // Poser question à la sage-femme
  const handleSendQuestion = (e) => {
    e.preventDefault();
    if (!midwifeQuestion.trim()) return;
    const newQ = {
      q: midwifeQuestion,
      a: "Merci Awa. Votre question a été transmise à la sage-femme de garde Dr. Fatou Diome. Une réponse vous sera notifiée d'ici 15 minutes.",
      date: "À l'instant",
      doctor: "Sage-femme Fatou Diome"
    };
    setMidwifeAnswers([newQ, ...midwifeAnswers]);
    setMidwifeQuestion('');
    setShowAskMidwifeModal(false);
    alert("📩 Votre question a bien été envoyée à la sage-femme de garde !");
  };

  const handleDownloadCarnet = () => {
    generateOfficialPdf({
      filename: `carnet_sante_maternelle_${activeFirstName.toLowerCase()}_${activeLastName.toLowerCase()}.pdf`,
      docType: 'CARNET DE SANTÉ MATERNELLE ET PÉDIATRIQUE',
      title: 'Carnet Maternité & Suivi Enfant 100% Gratuit',
      referenceNo: 'CARNET-MAT-2026-8812',
      beneficiaryName: activeFullName,
      cmuNumber: activeCmuNumber,
      structureName: 'Hôpital Universitaire de Fann (Dakar)',
      details: [
        { label: 'Assurée', value: activeFullName },
        { label: 'Enfant rattaché', value: 'Moussa Ndiaye (Né le 14/05/2026)' },
        { label: 'Statut Consultations CPN', value: '75% complété (CPN 1 et CPN 2 validées)' },
        { label: 'Vaccinations PEV Enfant', value: 'BCG, VPO 0, VHB 0 et Penta 1 administrés' },
        { label: 'Garantie Accouchement', value: 'Prise en charge intégrale à 100% par UNAMUSC' }
      ],
      notes: 'Ce carnet numérique officiel garantit l\'accès gratuit aux soins de maternité et au programme élargi de vaccination (PEV) dans tous les établissements agréés du Sénégal.'
    });
  };

  const handleDownloadGuarantee = () => {
    generateOfficialPdf({
      filename: 'lettre_garantie_accouchement_100_unamusc.pdf',
      docType: 'LETTRE DE GARANTIE HOSPITALIÈRE INTEGRALE',
      title: 'Prise en Charge Accouchement 100% UNAMUSC',
      referenceNo: 'GAR-MAT-2026-9910',
      beneficiaryName: activeFullName,
      cmuNumber: activeCmuNumber,
      structureName: 'Centre Hospitalier Universitaire de Fann (Dakar)',
      details: [
        { label: 'Bénéficiaire', value: `${activeFullName} (${activeCmuNumber})` },
        { label: 'Établissement Récepteur', value: 'CHU de Fann (Dakar)' },
        { label: 'Taux de Couverture UNAMUSC', value: '100% Prise en Charge Totale' },
        { label: 'Actes Couverts', value: 'Accouchement simple, Césarienne d\'urgence & Soins néonataux' },
        { label: 'Montant à payer par l\'assuré', value: '0 FCFA (Tiers-Payant Intégral)' }
      ],
      notes: 'La présente lettre de garantie dispense l\'assurée de toute avance de frais d\'hospitalisation ou de bloc opératoire.'
    });
  };

  // Nom et identifiants de l'assurée connectée
  const activeFirstName = citizenUser?.firstName || citizenUser?.first_name || 'Fatou';
  const activeLastName = citizenUser?.lastName || citizenUser?.last_name || 'Diallo';
  const activeFullName = `${activeFirstName} ${activeLastName}`;
  const activeCmuNumber = citizenUser?.cmuNumber || citizenUser?.cmu_number || 'CSU-DKR-2026-8812';

  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles (cohérent avec MedicalProfile)
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isDoctor     = userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin'));
  const isMidwife    = userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage'));
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isSuperAdmin)) && !isSuperAdmin;
  const isPharmacist = userRole === 'pharmacist';
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isSuperAdmin && (!!citizenUser && (userRole === 'citizen' || userRole === 'citizen_suspended'));
  // Peut remplir/modifier le carnet de maternité
  const canEditMaternity = isDoctor || isMidwife || isSuperAdmin;
  // Vue administrative (statistiques)
  const isAdminStatsView = isAgent && !isSuperAdmin;
  // Alias rétro-compatibilité
  const isDoctorOrAgent = canEditMaternity || isAgent;
  const isSuspended = (
    userRole === 'citizen_suspended' ||
    citizenUser?.status === 'suspended' ||
    citizenUser?.status === 'inactif' ||
    citizenUser?.status === 'suspendu' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  // ── PHARMACIEN : non concerné par le carnet de maternité ──
  if (isPharmacist) {
    return (
      <div className="maternity-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div className="p-5 rounded-4 text-center text-white" style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>💊</div>
            <span className="badge mb-3 d-inline-block" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>Pharmacien Agréé UNAMUSC</span>
            <h2 className="fw-bold mb-3" style={{ color: '#fff', fontSize: '1.8rem' }}>Carnet de Maternité — Non concerné</h2>
            <p className="mb-4" style={{ color: '#d1fae5', lineHeight: '1.6', maxWidth: '500px', margin: '0 auto 1.5rem' }}>
              Le suivi de maternité est réservé aux assurées, médecins et sage-femmes. Votre espace pharmacien est dédié à la validation des bons de commande médicaments.
            </p>
            <button className="btn btn-light fw-bold px-4 py-3" style={{ borderRadius: '12px', color: '#047857' }} onClick={() => (window.location.hash = '#/purchase-orders')}>
              💊 Accéder à mes Bons de Commande
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── AGENT (non superadmin) : vue statistiques administratives uniquement ──
  if (isAdminStatsView) {
    return (
      <div className="maternity-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="p-4 rounded-4 mb-4 d-flex align-items-center gap-3" style={{ background: 'linear-gradient(90deg, #1e3a5f 0%, #1d4ed8 100%)', borderRadius: '18px', color: '#fff' }}>
            <span style={{ fontSize: '2.2rem' }}>🛡️</span>
            <div>
              <strong className="d-block" style={{ fontSize: '1.1rem' }}>Mode Agent Administratif — Statistiques Maternité UNAMUSC</strong>
              <small style={{ opacity: 0.8 }}>Vue agrégée : suivi épidémiologique et statistiques. Le détail clinique reste réservé aux professionnel(le)s de santé.</small>
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🤰</div>
                <h3 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>142</h3>
                <div className="small" style={{ color: 'var(--text-sub)' }}>Grossesses suivies (année)</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
                <h3 className="fw-bold mb-1 text-success">128</h3>
                <div className="small" style={{ color: 'var(--text-sub)' }}>Accouchements assistés</div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="p-4 rounded-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📊</div>
                <h3 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>98%</h3>
                <div className="small" style={{ color: 'var(--text-sub)' }}>Taux de réussite suivi</div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '18px' }}>
            <h5 className="fw-bold mb-3" style={{ color: 'var(--text-main)' }}>📋 Synthèse administrative</h5>
            <div className="p-3 rounded-3" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderLeft: '4px solid #3b82f6' }}>
              <strong className="d-block small text-primary">🔒 Détail clinique protégé</strong>
              <small style={{ color: 'var(--text-sub)' }}>Les données nominatives du carnet de maternité (consultations prénatales, échographies, accouchement) sont protégées par le secret médical et accessibles uniquement aux médecins et sage-femmes agréés.</small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isCitizen && isSuspended) {
    return (
      <div className="maternity-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès aux soins de maternité refusé — Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                CSU-DKR-2026-8812
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. Le calendrier CPN, la délivrance de lettres de garantie d'accouchement et le suivi vaccinal sont suspendus.
              <br />
              <strong className="d-block mt-2 text-danger">Veuillez régulariser votre cotisation et celui des membres de votre famille pour un montant de 10 500 FCFA.</strong>
            </p>

            <div className="d-flex justify-content-center gap-3">
              <button 
                type="button" 
                className="btn btn-emerald btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-2 shadow"
                style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', borderRadius: '16px', fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)' }}
                onClick={() => {
                  localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                    cmuNumber: 'CSU-DKR-2026-8812',
                    amount: 10500,
                    familyCount: 3,
                    firstName: citizenUser?.firstName || 'Awa',
                    lastName: citizenUser?.lastName || 'Ndiaye'
                  }));
                  if (setView) setView('payments');
                  else window.location.hash = '#payments';
                }}
              >
                💳 Renouveler ma cotisation (10 500 FCFA)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="maternity-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '0.85rem 2rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>UNAMUSC Sénégal 🇸🇳</h5>
            <span style={{ height: '14px', width: '1px', background: 'var(--border-color)' }} />
            <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600', padding: '0.3rem 0.85rem' }}>
              {activeFullName} : Mère éligible CSU
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Rechercher..." 
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '200px' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>

        {/* BANNIÈRE DE RÔLE — distincte selon le profil */}
        {(canEditMaternity || isSuperAdmin) && (
          <div className="mb-4 p-3 rounded-4 d-flex align-items-center gap-3" style={{
            borderRadius: '14px',
            background: isSuperAdmin ? 'linear-gradient(90deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)'
                     : 'linear-gradient(90deg, #0f766e 0%, #0d9488 100%)',
            color: isSuperAdmin ? '#92400e' : '#ffffff',
            border: isSuperAdmin ? '1px solid rgba(234,179,8,0.4)' : 'none'
          }}>
            <span style={{ fontSize: '1.6rem' }}>{isSuperAdmin ? '👑' : isMidwife ? '🤱' : '🩺'}</span>
            <div>
              <strong className="d-block" style={{ fontSize: '0.98rem' }}>
                {isSuperAdmin && 'Mode SuperAdmin — Accès total'}
                {isMidwife && 'Mode Sage-femme — Édition complète du carnet'}
                {isDoctor && 'Mode Médecin — Édition complète du carnet'}
              </strong>
              <small style={{ opacity: 0.85 }}>
                {isSuperAdmin ? 'Toutes les actions disponibles.' : 'Vous pouvez remplir les consultations prénatales, ajouter des fiches conseils et modifier le carnet.'}
              </small>
            </div>
          </div>
        )}
        {isCitizen && (
          <div className="mb-4 p-3.5 rounded-4 d-flex align-items-center gap-3" style={{
            borderRadius: '14px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.25)',
            color: 'var(--text-main)'
          }}>
            <span style={{ fontSize: '1.6rem' }}>📖</span>
            <div>
              <strong className="d-block mb-1" style={{ fontSize: '0.98rem' }}>Mode lecture seule : Espace assuré</strong>
              <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>Consultez votre carnet de maternité, téléchargez le PDF et posez vos questions à la sage-femme.</small>
            </div>
          </div>
        )}

        {/* Top Hero Banner Card */}
        <div 
          className="p-5 rounded-4 mb-5 text-white" 
          style={{ 
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_kids_real.png") center/cover no-repeat', 
            padding: '3.75rem 2.5rem',
            minHeight: '240px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.45)', 
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' 
          }}
        >
          <div className="row align-items-center g-4">
            <div className="col-lg-8">
              <span style={{ background: '#059669', color: '#ffffff', padding: '0.35rem 0.9rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.75rem', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                🇸🇳 Espace premium santé maternelle UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.35rem', letterSpacing: '-0.02em', textShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>Carnet de santé maternelle & suivi de l'enfant</h1>
              <p className="text-white-50 mb-4" style={{ fontSize: '1.05rem', maxWidth: '720px', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                Accédez en toute sécurité au suivi prénatal et au calendrier vaccinal PEV de votre enfant. Bénéficiez des garanties de prise en charge 100% CSU.
              </p>

              <div className="d-flex gap-3 flex-wrap">
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)', cursor: 'pointer' }} 
                  onClick={() => setShowGuaranteeModal(true)}
                >
                  📜 Générer lettre de garantie (100% UNAMUSC)
                </button>
                
                <button 
                  type="button"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }} 
                  onClick={handleDownloadCarnet}
                >
                  📥 Télécharger carnet officiel PDF (🇸🇳)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Pills */}
        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', padding: '0.4rem', borderRadius: '14px', display: 'inline-flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            style={{ 
              background: activeTab === 'cpn' ? '#10b981' : 'var(--bg-card)', 
              color: activeTab === 'cpn' ? '#ffffff' : 'var(--text-sub)', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '700', 
              fontSize: '0.85rem',
              cursor: 'pointer'
            }} 
            onClick={() => setActiveTab('cpn')}
          >
            1. Suivi prénatal (CPN 1-4+)
          </button>

          <button 
            type="button"
            style={{ 
              background: activeTab === 'pev' ? '#10b981' : 'var(--bg-card)', 
              color: activeTab === 'pev' ? '#ffffff' : 'var(--text-sub)', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '700', 
              fontSize: '0.85rem',
              cursor: 'pointer'
            }} 
            onClick={() => setActiveTab('pev')}
          >
            2. Croissance & vaccins (0-12 mois)
          </button>

          <button 
            type="button"
            style={{ 
              background: activeTab === 'advice' ? '#10b981' : 'var(--bg-card)', 
              color: activeTab === 'advice' ? '#ffffff' : 'var(--text-sub)', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '0.6rem 1.25rem', 
              fontWeight: '700', 
              fontSize: '0.85rem',
              cursor: 'pointer'
            }} 
            onClick={() => setActiveTab('advice')}
          >
            3. Conseils experts & échanges
          </button>
        </div>

        {/* TAB 1: CPN SUIVI PRÉNATAL */}
        {activeTab === 'cpn' && (
          <div className="row g-4 mb-4">
            
            {/* Main Left Column: CPN Timeline */}
            <div className="col-lg-8">
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Calendrier des consultations prénatales</h5>
                    <small style={{ color: 'var(--text-sub)' }}>Progression actuelle : <span className="text-success fw-bold">75% complété</span></small>
                  </div>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}>
                    ✔ À jour
                  </span>
                </div>

                {/* Timeline Items */}
                <div className="d-flex flex-column gap-3">
                  {cpnVisits.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-4 d-flex align-items-start gap-3" style={{ background: 'var(--bg-card-subtle)', border: editingCpnId === item.id ? '2px solid #10b981' : '1px solid var(--border-color)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: item.completed ? '#10b981' : 'var(--bg-card)', color: item.completed ? '#ffffff' : 'var(--text-sub)', border: item.completed ? 'none' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>
                        {item.completed ? '✓' : '⌛'}
                      </div>

                      {editingCpnId === item.id ? (
                        <form onSubmit={handleSaveEditCpn} className="flex-grow-1 d-flex flex-column gap-2">
                          <input type="text" className="form-control form-control-sm" placeholder="Titre CPN" value={editCpnForm.title} onChange={(e) => setEditCpnForm({ ...editCpnForm, title: e.target.value })} required />
                          <textarea className="form-control form-control-sm" rows={2} placeholder="Description / observations cliniques" value={editCpnForm.desc} onChange={(e) => setEditCpnForm({ ...editCpnForm, desc: e.target.value })} />
                          <div className="d-flex gap-2">
                            <input type="text" className="form-control form-control-sm" placeholder="Date (JJ/MM/AAAA)" value={editCpnForm.date} onChange={(e) => setEditCpnForm({ ...editCpnForm, date: e.target.value })} style={{ maxWidth: '140px' }} />
                            <input type="text" className="form-control form-control-sm" placeholder="Praticien" value={editCpnForm.doctor} onChange={(e) => setEditCpnForm({ ...editCpnForm, doctor: e.target.value })} />
                          </div>
                          <div className="d-flex gap-2">
                            <input type="text" className="form-control form-control-sm" placeholder="Statut" value={editCpnForm.status} onChange={(e) => setEditCpnForm({ ...editCpnForm, status: e.target.value })} />
                            <label className="d-flex align-items-center gap-1 small" style={{ color: 'var(--text-sub)' }}>
                              <input type="checkbox" checked={editCpnForm.completed} onChange={(e) => setEditCpnForm({ ...editCpnForm, completed: e.target.checked })} /> Terminée
                            </label>
                          </div>
                          <div className="d-flex gap-2">
                            <button type="submit" className="btn btn-sm btn-success fw-bold" style={{ borderRadius: '8px' }}>💾 Enregistrer</button>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingCpnId(null)}>Annuler</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700' }}>
                                {item.status}
                              </span>
                              <span style={{ background: 'var(--bg-card)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600' }}>
                                📅 {item.date}
                              </span>
                            </div>
                            <h6 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>{item.title}</h6>
                            <p className="small mb-1" style={{ color: 'var(--text-sub)', lineHeight: '1.5' }}>{item.desc}</p>
                            <small className="text-success fw-semibold" style={{ fontSize: '0.75rem' }}>👩‍⚕️ {item.doctor}</small>
                          </div>

                          <div className="d-flex flex-column gap-1.5">
                            {/* Assuré : réserver une CPN à venir */}
                            {isCitizen && !item.completed && (
                              <button
                                type="button"
                                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                                onClick={() => {
                                  setSelectedCpnForBooking(item);
                                  setShowBookingModal(true);
                                }}
                              >
                                Réserver CPN
                              </button>
                            )}
                            {/* Médecin / Sage-femme / SuperAdmin : éditer / supprimer */}
                            {canEditMaternity && (
                              <>
                                <button type="button" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '10px', padding: '0.4rem 0.7rem', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => openEditCpn(item)}>✏️ Modifier</button>
                                <button type="button" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '10px', padding: '0.4rem 0.7rem', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => handleDeleteCpn(item.id)}>🗑 Supprimer</button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bouton ajouter CPN — médecin / sage-femme / superadmin */}
                {canEditMaternity && (
                  <button type="button" className="mt-3" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '2px dashed #10b981', borderRadius: '12px', padding: '0.75rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }} onClick={() => setShowAddCpnModal(true)}>
                    ➕ Ajouter une consultation CPN ({isMidwife ? 'Sage-femme' : isSuperAdmin ? 'SuperAdmin' : 'Médecin'})
                  </button>
                )}

              </div>
            </div>

            {/* Right Sidebar Column */}
            <div className="col-lg-4">
              <div className="d-flex flex-column gap-4">
                
                {/* Card Constantes Vitales */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2 mb-3 text-success">
                    <span style={{ fontSize: '1.2rem' }}>📈</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Constantes vitales</h6>
                  </div>

                  <div className="row text-center g-2">
                    <div className="col-6">
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                        <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>Poids</small>
                        <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>64.5 kg</h4>
                        <small className="text-success" style={{ fontSize: '0.68rem' }}>+2.1kg / mois</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                        <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>Tension art.</small>
                        <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>12/8</h4>
                        <small className="text-success" style={{ fontSize: '0.68rem' }}>Normal</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Vos Avantages CSU */}
                <div className="p-4 rounded-4 text-white" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.1rem' }}>Vos avantages CSU</h6>
                    <span style={{ fontSize: '1.5rem' }}>🇸🇳</span>
                  </div>

                  <p className="small mb-3" style={{ opacity: 0.95, lineHeight: '1.5' }}>
                    Dans le cadre du programme UNAMUSC, vos frais de maternité sont couverts à 100%.
                  </p>

                  <div className="d-flex flex-column gap-2 mb-4 small fw-semibold">
                    <div className="d-flex align-items-center gap-2">
                      <span>✓</span> <span><strong>Zéro dépense :</strong> Consultations & examens biologiques.</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span>✓</span> <span><strong>Accouchement :</strong> Gratuité totale en structure publique.</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span>✓</span> <span><strong>Pédiatrie :</strong> Soins offerts jusqu'à 5 ans.</span>
                    </div>
                  </div>

                  <button 
                    type="button"
                    style={{ background: '#ffffff', color: '#047857', border: 'none', borderRadius: '12px', padding: '0.65rem 1rem', fontWeight: '800', width: '100%', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                    onClick={() => setShowRightsModal(true)}
                  >
                    En savoir plus sur mes droits
                  </button>
                </div>

                {/* Card Sage-femme de garde */}
                <div className="p-3.5 rounded-4 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-3">
                    <img src="/dr_fatou_diop.png" onError={(e) => { e.target.src = '/mariama_avatar.png'; }} alt="Dr. Fatou Diome" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>Sage-femme de garde</small>
                      <strong className="small d-block" style={{ color: 'var(--text-main)' }}>Dr. Fatou Diome</strong>
                    </div>
                  </div>

                  <button 
                    type="button"
                    style={{ background: 'var(--bg-card-subtle)', color: '#10b981', border: '1px solid #10b981', borderRadius: '10px', padding: '0.45rem 0.85rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                    onClick={() => setShowAskMidwifeModal(true)}
                  >
                    Poser une question
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CROISSANCE & VACCINS PEV */}
        {activeTab === 'pev' && (
          <div className="d-flex flex-column gap-4 mb-5">
            {/* KPI Summary Cards Header */}
            <div className="row g-3">
              <div className="col-md-4">
                <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    👶
                  </div>
                  <div>
                    <small className="d-block text-muted fw-bold" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bébé rattaché</small>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Moussa Ndiaye</strong>
                    <small className="d-block text-success fw-semibold" style={{ fontSize: '0.78rem' }}>Né le 14/05/2026 • 2 mois</small>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    💉
                  </div>
                  <div>
                    <small className="d-block text-muted fw-bold" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progression vaccinale</small>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>2 / 3 doses administrées</strong>
                    <small className="d-block text-primary fw-semibold" style={{ fontSize: '0.78rem' }}>66% du programme PEV accompli</small>
                  </div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    📅
                  </div>
                  <div>
                    <small className="d-block text-muted fw-bold" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prochaine échéance</small>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>10 Semaines (Juillet 2026)</strong>
                    <small className="d-block text-warning fw-semibold" style={{ fontSize: '0.78rem' }}>Centre de santé Pikine</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Vaccination Table Card */}
            <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
              <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-2.5">
                  <span style={{ fontSize: '1.5rem' }}>🛡️</span>
                  <div>
                    <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Programme élargi de vaccination (PEV Sénégal 0-12 mois)</h5>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>Prise en charge intégrale à 100% UNAMUSC dans tous les centres publics du Sénégal</small>
                  </div>
                </div>

                <button 
                  type="button"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                  onClick={handleDownloadCarnet}
                >
                  📥 Télécharger carnet vaccinal PDF
                </button>
              </div>

              <div className="table-responsive" style={{ borderRadius: '14px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                  <thead style={{ background: 'var(--bg-card-subtle)' }}>
                    <tr className="small" style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                      <th scope="col" style={{ padding: '1rem 1.25rem' }}>ÉCHÉANCE / ÂGE</th>
                      <th scope="col" style={{ padding: '1rem 1.25rem' }}>VACCINS OBLIGATOIRES</th>
                      <th scope="col" style={{ padding: '1rem 1.25rem' }}>MALADIES PROTÉGÉES</th>
                      <th scope="col" style={{ padding: '1rem 1.25rem' }}>STRUCTURE AGRÉÉE</th>
                      <th scope="col" className="text-end" style={{ padding: '1rem 1.25rem' }}>STATUT PEV</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Naissance</strong>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>J0 à J7</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <span className="text-success fw-bold" style={{ fontSize: '0.9rem' }}>BCG + VPO 0 + VHB 0</span>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>Dose initiale de maternité</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        Tuberculose, polio, hépatite B
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        🏥 Centre Gaspard Camara
                      </td>
                      <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.45rem 0.9rem', borderRadius: '30px', fontSize: '0.78rem', fontWeight: '800', boxShadow: '0 2px 6px rgba(16,185,129,0.1)' }}>
                          <span>✅</span> <span>Administré (100% CSU)</span>
                        </span>
                      </td>
                    </tr>

                    <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>6 Semaines</strong>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>1 mois & demi</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <span className="text-success fw-bold" style={{ fontSize: '0.9rem' }}>Penta 1 + VPO 1 + Rota 1 + Pneumo 1</span>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>4 vaccins combinés</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        Diphtérie, tétanos, coqueluche, méningite...
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        🏥 Dispensaire Point E
                      </td>
                      <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.45rem 0.9rem', borderRadius: '30px', fontSize: '0.78rem', fontWeight: '800', boxShadow: '0 2px 6px rgba(16,185,129,0.1)' }}>
                          <span>✅</span> <span>Administré (100% CSU)</span>
                        </span>
                      </td>
                    </tr>

                    <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>10 Semaines</strong>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>2 mois & demi</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <span className="text-warning fw-bold" style={{ fontSize: '0.9rem' }}>Penta 2 + VPO 2 + Rota 2 + Pneumo 2</span>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>Rappel de 2ème dose</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        Rappel des immunisations premières
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        🏥 Centre de santé Pikine
                      </td>
                      <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', padding: '0.45rem 0.9rem', borderRadius: '30px', fontSize: '0.78rem', fontWeight: '800' }}>
                          <span>⏳</span> <span>À venir (Juillet 2026)</span>
                        </span>
                      </td>
                    </tr>

                    <tr className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>14 Semaines</strong>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>3 mois & demi</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <span style={{ color: 'var(--text-sub)', fontWeight: '700', fontSize: '0.9rem' }}>Penta 3 + VPO 3 + VPI 1 + Pneumo 3</span>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>3ème dose & injectables</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        Immunisation complète 1er âge
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        🏥 CHU de Fann (Dakar)
                      </td>
                      <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.45rem 0.9rem', borderRadius: '30px', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>🗓️</span> <span>Programmé (Août 2026)</span>
                        </span>
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>9 Mois</strong>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>Échéance finale 1er an</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem' }}>
                        <span style={{ color: 'var(--text-sub)', fontWeight: '700', fontSize: '0.9rem' }}>RR 1 + VAA + Vitamine A</span>
                        <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>Rougeole, rubéole & fièvre jaune</small>
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        Fièvre jaune, rougeole & carences
                      </td>
                      <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                        🏥 Centre Gaspard Camara
                      </td>
                      <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.45rem 0.9rem', borderRadius: '30px', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>🗓️</span> <span>Programmé (Février 2027)</span>
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CONSEILS EXPERTS & Q&A */}
        {activeTab === 'advice' && (
          <div className="row g-4 mb-5">
            {/* Left Column: Questions List */}
            <div className="col-lg-7">
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                  <div>
                    <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>💬 Questions posées & réponses de la sage-femme</h5>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>Échanges sécurisés certifiés par le Conseil National de l'Ordre des Sages-Femmes</small>
                  </div>

                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.35rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                    ⚡ Service 24h/7 actif
                  </span>
                </div>

                <div className="d-flex flex-column gap-3 mb-4">
                  {midwifeAnswers.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                          ❓ Question citoyenne
                        </span>
                        <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>{item.date}</small>
                      </div>

                      <strong className="d-block mb-3" style={{ color: 'var(--text-main)', fontSize: '0.98rem', lineHeight: '1.5' }}>
                        {item.q}
                      </strong>

                      <div className="p-3.5 rounded-3 border-start border-4 border-success" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeftColor: '#10b981 !important' }}>
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <img src="/dr_fatou_diop.png" onError={(e) => { e.target.src = '/mariama_avatar.png'; }} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                          <div>
                            <strong className="d-block text-success" style={{ fontSize: '0.85rem' }}>{item.doctor}</strong>
                            <small className="text-muted" style={{ fontSize: '0.7rem' }}>Sage-femme d'État • CHU de Fann</small>
                          </div>
                        </div>
                        <p className="small mb-0" style={{ color: 'var(--text-sub)', lineHeight: '1.6', fontSize: '0.88rem' }}>
                          {item.a}
                        </p>
                      </div>

                      {/* Zone réponse professionnel (médecin / sage-femme / superadmin) */}
                      {canEditMaternity && (
                        <div className="mt-3 p-3 rounded-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)' }}>
                          {replyingToIdx === idx ? (
                            <div className="d-flex flex-column gap-2">
                              <textarea className="form-control form-control-sm" rows={3} placeholder="Saisissez votre réponse médicale..." value={proReply} onChange={(e) => setProReply(e.target.value)} style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px' }} />
                              <div className="d-flex gap-2">
                                <button type="button" className="btn btn-sm btn-success fw-bold" style={{ borderRadius: '8px' }} onClick={() => handleProReply(idx)}>📨 Publier la réponse</button>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setReplyingToIdx(null); setProReply(''); }}>Annuler</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-sm fw-bold w-100" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px' }} onClick={() => { setReplyingToIdx(idx); setProReply(item.a && !item.a.includes('Bonjour Awa') ? item.a : ''); }}>
                              💬 Répondre en tant que {isMidwife ? 'sage-femme' : isSuperAdmin ? 'SuperAdmin' : 'médecin'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Bouton poser question — réservé à l'assuré */}
                {isCitizen && (
                  <button
                    type="button"
                    style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.8rem 1.5rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', width: '100%', boxShadow: '0 4px 15px rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => setShowAskMidwifeModal(true)}
                  >
                    <span>➕</span> Poser une nouvelle question à la sage-femme
                  </button>
                )}
                {canEditMaternity && (
                  <div className="mt-2 text-center small" style={{ color: 'var(--text-sub)' }}>
                    🔒 En tant que professionnel, vous répondez aux questions (aucune action sur le bouton ci-dessus).
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Sage-femme profile & Advice Cards */}
            <div className="col-lg-5">
              <div className="d-flex flex-column gap-4">
                
                {/* Sage-femme de garde Card */}
                <div className="p-4 rounded-4 text-white" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)', boxShadow: '0 10px 25px rgba(6, 78, 59, 0.3)' }}>
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <img src="/dr_fatou_diop.png" onError={(e) => { e.target.src = '/mariama_avatar.png'; }} alt="Dr. Fatou Diome" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981' }} />
                    <div>
                      <span className="badge bg-success-subtle text-success mb-1" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700' }}>
                        ● EN GARDE AUJOURD'HUI
                      </span>
                      <h5 className="fw-bold mb-0" style={{ color: '#ffffff' }}>Dr. Fatou Diome</h5>
                      <small style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem' }}>Sage-femme de garde UNAMUSC</small>
                    </div>
                  </div>

                  <p className="small mb-3" style={{ color: 'rgba(255,255,255,0.88)', lineHeight: '1.5' }}>
                    Posez vos questions en toute confidentialité concernant vos symptômes de grossesse, la nutrition maternelle ou les soins du nouveau-né.
                  </p>

                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#6ee7b7' }}>
                    <span>⏱️</span> <span>Réponse moyenne notifiée en <strong>moins de 15 min</strong></span>
                  </div>
                </div>

                {/* FAQ Advice Articles Dynamiques — Espace réservé Infirmière / Sage-Femme */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <div>
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>💡 Fiches conseils prénatals & santé bébé</h6>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.68rem', fontWeight: '700' }}>
                          👩‍⚕️ Espace Sage-femme & Médecin
                        </span>
                      </div>
                      <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>Recommandations médicales certifiées par l'équipe soignante UNAMUSC</small>
                    </div>

                    {canEditMaternity && (
                      <button
                        type="button"
                        style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}
                        onClick={() => setShowAddAdviceModal(true)}
                      >
                        ➕ Ajouter une fiche ({isMidwife ? 'Sage-femme' : isSuperAdmin ? 'SuperAdmin' : 'Médecin'})
                      </button>
                    )}
                    {isCitizen && (
                      <span className="badge bg-secondary-subtle text-secondary border border-secondary px-2.5 py-1.5" style={{ borderRadius: '8px', fontSize: '0.74rem' }}>
                        🔒 Lecture seule — Modifications par votre sage-femme/médecin
                      </span>
                    )}
                  </div>
                  
                  <div className="d-flex flex-column gap-2.5">
                    {adviceArticles.map((art) => (
                      <div 
                        key={art.id} 
                        className="p-3.5 rounded-3 d-flex align-items-center gap-3" 
                        style={{ 
                          background: 'var(--bg-card-subtle)', 
                          border: '1px solid var(--border-color)', 
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          borderRadius: '14px'
                        }} 
                        onClick={() => setSelectedAdviceArticle(art)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#10b981'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      >
                        <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                          {art.icon}
                        </div>

                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-0.5">
                            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: '700' }}>
                              {art.badge}
                            </span>
                            <small className="text-muted" style={{ fontSize: '0.7rem' }}>• {art.readTime}</small>
                          </div>
                          <strong className="d-block" style={{ color: 'var(--text-main)', fontSize: '0.88rem', lineHeight: '1.3' }}>{art.title}</strong>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem', lineHeight: '1.4' }}>{art.subtitle}</small>
                        </div>

                        {canEditMaternity && (
                          <div className="d-flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <button type="button" title="Modifier la fiche" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '0.3rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => openEditAdvice(art)}>✏️</button>
                            <button type="button" title="Supprimer la fiche" style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', borderRadius: '8px', padding: '0.3rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => handleDeleteAdvice(art.id)}>🗑</button>
                          </div>
                        )}

                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem' }}>›</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* DETAILED ADVICE ARTICLE MODAL WITH REALISTIC DRAWING / PHOTO (React Portal — Centré) */}
      {selectedAdviceArticle && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '640px', width: '100%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: 0, border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto', position: 'relative' }}>
            
            {/* Header Image Header Banner */}
            <div style={{ position: 'relative', width: '100%', height: '220px', overflow: 'hidden', background: '#0f172a' }}>
              <img 
                src={selectedAdviceArticle.image || '/csu_kids_real.png'} 
                alt={selectedAdviceArticle.title}
                onError={(e) => { e.target.onerror = null; e.target.src = '/csu_kids_real.png'; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.5) 100%)' }} />
              
              <button 
                type="button"
                onClick={() => setSelectedAdviceArticle(null)}
                style={{ position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', zIndex: 10 }}
              >
                ✖
              </button>

              <div style={{ position: 'absolute', bottom: '15px', left: '20px', right: '20px', color: '#ffffff' }}>
                <span className="badge mb-1.5" style={{ background: '#10b981', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '700' }}>
                  {selectedAdviceArticle.icon} {selectedAdviceArticle.badge}
                </span>
                <h4 style={{ fontSize: '1.35rem', fontWeight: '850', color: '#ffffff', margin: 0, lineHeight: '1.3', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {selectedAdviceArticle.title}
                </h4>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '2rem 1.75rem' }}>
              <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>👨‍⚕️ Rédigé par : <strong>{selectedAdviceArticle.author}</strong></small>
                <small style={{ color: '#10b981', fontWeight: '700', fontSize: '0.8rem' }}>⏱️ {selectedAdviceArticle.readTime}</small>
              </div>

              <p style={{ color: 'var(--text-sub)', fontSize: '0.92rem', fontWeight: '600', marginBottom: '1.25rem', lineHeight: '1.5' }}>
                {selectedAdviceArticle.subtitle}
              </p>

              {/* Bullet Points */}
              <div className="d-flex flex-column gap-2.5 mb-4">
                {selectedAdviceArticle.content.map((point, i) => (
                  <div key={i} className="p-3 rounded-3 d-flex align-items-start gap-2.5" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.1rem', flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.6' }}>{point}</span>
                  </div>
                ))}
              </div>

              {/* Medical Tip Callout */}
              <div className="p-3.5 rounded-3 mb-4" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#047857' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: '700', lineHeight: '1.5', color: '#047857' }}>
                  {selectedAdviceArticle.tips}
                </div>
              </div>

              <div className="d-flex justify-content-end gap-3">
                <button 
                  type="button"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }} 
                  onClick={() => setSelectedAdviceArticle(null)}
                >
                  Fermer
                </button>
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.4rem', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} 
                  onClick={() => {
                    generateOfficialPdf({
                      filename: `fiche_conseil_${selectedAdviceArticle.id}.pdf`,
                      docType: 'FICHE CONSEIL MÉDICALE OFFICIELLE',
                      title: selectedAdviceArticle.title,
                      referenceNo: `CONSEIL-${Date.now().toString().slice(-6)}`,
                      beneficiaryName: citizenUser ? `${citizenUser.firstName || citizenUser.first_name || ''} ${citizenUser.lastName || citizenUser.last_name || ''}`.trim() || 'Awa Ndiaye' : 'Awa Ndiaye',
                      cmuNumber: 'SN-DK-MED-8472',
                      structureName: 'Conseil National de l\'Ordre des Sages-Femmes (UNAMUSC)',
                      details: [
                        { label: 'Catégorie & Thème', value: selectedAdviceArticle.badge },
                        { label: 'Rédacteur Médical', value: selectedAdviceArticle.author },
                        { label: 'Temps de lecture', value: selectedAdviceArticle.readTime },
                        ...selectedAdviceArticle.content.map((point, index) => ({
                          label: `Recommandation N°${index + 1}`,
                          value: point
                        })),
                        { label: 'Conseil / Astuce de l\'Expert', value: selectedAdviceArticle.tips }
                      ],
                      notes: 'Cette fiche conseil médicale officielle est délivrée dans le cadre du Programme National Santé Maternelle & Infantile UNAMUSC Sénégal (100% CSU).'
                    });
                  }}
                >
                  🖨️ Imprimer la fiche conseil PDF
                </button>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* CREATE NEW ADVICE ARTICLE DYNAMIC MODAL (React Portal — Centré) */}
      {showAddAdviceModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddAdvice} style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.5rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold text-success mb-1" style={{ fontSize: '1.15rem' }}>👩‍⚕️ Espace Infirmière / Sage-Femme</h5>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>Publier une nouvelle fiche conseil certifiée pour le carnet de maternité</small>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddAdviceModal(false)}></button>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-4">
                <label className="form-label fw-bold small">Icône *</label>
                <input type="text" className="form-control" value={newAdviceForm.icon} onChange={(e) => setNewAdviceForm({...newAdviceForm, icon: e.target.value})} placeholder="Ex: 🥗" required />
              </div>
              <div className="col-8">
                <label className="form-label fw-bold small">Catégorie / Badge *</label>
                <input type="text" className="form-control" value={newAdviceForm.badge} onChange={(e) => setNewAdviceForm({...newAdviceForm, badge: e.target.value})} placeholder="Ex: Nutrition Maternelle" required />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small">Titre de la fiche *</label>
              <input type="text" className="form-control" value={newAdviceForm.title} onChange={(e) => setNewAdviceForm({...newAdviceForm, title: e.target.value})} placeholder="Ex: Les 5 règles d'or de l'hydratation" required />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small">Sous-titre / Résumé</label>
              <input type="text" className="form-control" value={newAdviceForm.subtitle} onChange={(e) => setNewAdviceForm({...newAdviceForm, subtitle: e.target.value})} placeholder="Ex: Guide pratique pour la maman au 3ème trimestre" />
            </div>

            <div className="mb-3">
              <label className="form-label fw-bold small">Recommandations & Points clés (1 par ligne) *</label>
              <textarea className="form-control" rows={4} value={newAdviceForm.content} onChange={(e) => setNewAdviceForm({...newAdviceForm, content: e.target.value})} placeholder="Entrez chaque conseil sur une nouvelle ligne..." required />
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold small">Astuce de la sage-femme / Conseil d'expert</label>
              <input type="text" className="form-control" value={newAdviceForm.tips} onChange={(e) => setNewAdviceForm({...newAdviceForm, tips: e.target.value})} placeholder="Ex: Boire un verre d'eau au réveil et avant chaque repas." />
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" className="btn btn-outline" style={{ borderRadius: '12px' }} onClick={() => setShowAddAdviceModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold" style={{ borderRadius: '12px', background: '#10b981', borderColor: '#10b981' }}>✅ Enregistrer la fiche</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* GUARANTEE LETTER MODAL (React Portal — Centré sur l'écran) */}
      {showGuaranteeModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.5rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>📜 Lettre de garantie hospitalière (100% UNAMUSC 🇸🇳)</h5>
              <button className="btn-close" onClick={() => setShowGuaranteeModal(false)}></button>
            </div>

            <div className="p-4 rounded-3 mb-4 border border-success" style={{ background: 'var(--bg-card-subtle)' }}>
              <div className="d-flex justify-content-between mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Union nationale des mutuelles de santé (UNAMUSC)</strong>
                  <small className="text-success fw-bold">Prise en charge 100% maternité & accouchement</small>
                </div>
                <div className="text-end">
                  <small className="d-block mb-1" style={{ color: 'var(--text-sub)' }}>Date d'émission: {new Date().toLocaleDateString('fr-FR')}</small>
                  <small className="text-warning fw-bold">N° GAR-MAT-2026-9910</small>
                </div>
              </div>

              <p className="mb-3" style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <strong>Assurée :</strong> {activeFullName} ({activeCmuNumber})
              </p>
              <p className="mb-3" style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <strong>Établissement récepteur :</strong> Centre hospitalier universitaire de Fann (Dakar)
              </p>
              <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: '1.7' }}>
                <strong>Garantie accordée :</strong> Couverture intégrale (100%) des frais d'accouchement simple, césarienne d'urgence et soins néonataux sans aucune avance de frais.
              </p>
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: '600', fontSize: '0.88rem' }} onClick={() => setShowGuaranteeModal(false)}>Fermer</button>
              <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} onClick={handleDownloadGuarantee}>📥 Télécharger la lettre PDF certifiée (🇸🇳)</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ASK MIDWIFE MODAL (React Portal — Centré sur l'écran) */}
      {showAskMidwifeModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleSendQuestion} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.5rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>💬 Poser une question à la sage-femme de garde</h5>
              <button type="button" className="btn-close" onClick={() => setShowAskMidwifeModal(false)}></button>
            </div>
            
            <div className="mb-4">
              <label className="form-label fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Votre question ou symptôme *</label>
              <textarea 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.85rem 1rem', fontSize: '0.9rem', lineHeight: '1.6' }} 
                rows={5} 
                value={midwifeQuestion} 
                onChange={(e) => setMidwifeQuestion(e.target.value)}
                placeholder="Décrivez votre question concernant la grossesse, le bébé ou la nutrition..."
                required
              />
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: '600', fontSize: '0.88rem' }} onClick={() => setShowAskMidwifeModal(false)}>Annuler</button>
              <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>Envoyer la question</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* BOOKING CPN MODAL (React Portal — Centré sur l'écran) */}
      {showBookingModal && selectedCpnForBooking && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.5rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold text-success mb-0" style={{ fontSize: '1.15rem' }}>📅 Réserver {selectedCpnForBooking.title}</h5>
              <button type="button" className="btn-close" onClick={() => setShowBookingModal(false)}></button>
            </div>

            <p className="mb-4" style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: '1.7' }}>
              Sélectionnez la structure de santé agréée pour la consultation prénatale.
            </p>
            
            <div className="mb-4">
              <label className="form-label fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Structure de santé *</label>
              <select className="form-select" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.7rem 1rem', fontSize: '0.9rem' }}>
                <option value="1">Centre de Santé Gaspard Camara (Dakar)</option>
                <option value="2">Centre de Santé de Pikine</option>
                <option value="3">Hôpital Universitaire Fann</option>
              </select>
            </div>

            <div className="d-flex justify-content-end gap-3">
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.2rem', fontWeight: '600', fontSize: '0.88rem' }} onClick={() => setShowBookingModal(false)}>Annuler</button>
              <button type="button" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1.4rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} onClick={() => handleConfirmBooking(selectedCpnForBooking.id)}>Confirmer la réservation (0 FCFA)</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* RIGHTS & MATERNITY COVERAGE DEDICATED MODAL (React Portal — Centré) */}
      {showRightsModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '860px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '32px', padding: '2.75rem', border: '1px solid var(--border-color)', boxShadow: '0 35px 90px rgba(0,0,0,0.85)', margin: 'auto' }}>
            
            {/* Modal Header */}
            <div className="d-flex justify-content-between align-items-start mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3.5">
                <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', flexShrink: 0, boxShadow: '0 4px 14px rgba(16,185,129,0.2)' }}>
                  🛡️
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.25rem', lineHeight: '1.3' }}>
                    Charte des droits & garanties maternité (100% CSU UNAMUSC)
                  </h5>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.84rem' }}>
                    Convention nationale du tiers-payant sous tutelle du ministère de la santé du Sénégal
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowRightsModal(false)}></button>
            </div>

            {/* Presidential Banner */}
            <div className="p-4 rounded-4 mb-4" style={{ background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '22px' }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <span style={{ fontSize: '1.25rem' }}>🇸🇳</span>
                <strong style={{ fontSize: '0.98rem', color: '#047857' }}>Décret présidentiel & protocole UNAMUSC : zéro avance de frais</strong>
              </div>
              <p className="mb-0" style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.7', opacity: 0.92 }}>
                Chaque femme enceinte inscrite à la mutuelle bénéficie d'un panier complet de soins gratuits dans l'ensemble des postes de santé, dispensaires et hôpitaux publics agréés du Sénégal.
              </p>
            </div>

            <h6 className="fw-bold mb-4" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>
              📋 Détail complémentaire de vos prestations garanties :
            </h6>

            {/* Spacious 2-Column Grid Cards */}
            <div className="row g-3.5 mb-4">
              <div className="col-md-6">
                <div className="p-4 rounded-4 h-100" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <strong className="d-block text-success mb-2" style={{ fontSize: '0.95rem' }}>
                    1. Consultations prénatales (CPN 1 à CPN 4+)
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.86rem', lineHeight: '1.65' }}>
                    Prise en charge intégrale des examens cliniques mensuels, mesure de la hauteur utérine, écoute du cœur fœtal et conseils nutritionnels délivrés par les sages-femmes d'État.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-4 rounded-4 h-100" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <strong className="d-block text-success mb-2" style={{ fontSize: '0.95rem' }}>
                    2. Bilan biologique & échographies obstétricales
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.86rem', lineHeight: '1.65' }}>
                    Couverture à 100% des 3 échographies de contrôle (T1, T2, T3) et des bilans sanguins complets : groupe sanguin / rhésus, dépistage de l'anémie, protéinurie, glycémie et sérologies obligatoires.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-4 rounded-4 h-100" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <strong className="d-block text-success mb-2" style={{ fontSize: '0.95rem' }}>
                    3. Accouchement simple & césarienne d'urgence
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.86rem', lineHeight: '1.65' }}>
                    Gratuité totale lors de l'admission en salle de naissance, actes chirurgicaux de césarienne, produits d'anesthésie, bloc opératoire et séjour en hospitalisation maternité.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-4 rounded-4 h-100" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <strong className="d-block text-success mb-2" style={{ fontSize: '0.95rem' }}>
                    4. Kit de maternité & médicaments essentiels
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.86rem', lineHeight: '1.65' }}>
                    Supplémentation gratuite en fer / acide folique pendant toute la grossesse, moustiquaire imprégnée de longue durée d'action (MILDA) et kit stérile d'accouchement.
                  </p>
                </div>
              </div>

              <div className="col-12">
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <strong className="d-block text-success mb-2" style={{ fontSize: '0.95rem' }}>
                    5. Suivi néonatal & vaccins PEV (0 à 5 ans)
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.86rem', lineHeight: '1.65' }}>
                    Prise en charge intégrale de la santé du nourrisson : pesées, suivi de croissance, et l'intégralité du programme élargi de vaccination (BCG, polio, pentavalent, rougeole, fièvre jaune).
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="d-flex justify-content-end gap-3 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '0.75rem 1.6rem', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                onClick={() => setShowRightsModal(false)}
              >
                Fermer
              </button>

              <button 
                type="button" 
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '14px', padding: '0.75rem 1.8rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
                onClick={() => {
                  generateOfficialPdf({
                    filename: 'charte_droits_maternite_csu.pdf',
                    docType: 'CHARTE NATIONALE DE PRISE EN CHARGE MATERNITÉ 100% CSU',
                    title: 'Droits & garanties de prise en charge maternité UNAMUSC',
                    referenceNo: 'CHARTE-MAT-2026-100',
                    beneficiaryName: citizenUser ? `${citizenUser.firstName || citizenUser.first_name || ''} ${citizenUser.lastName || citizenUser.last_name || ''}`.trim() || 'Awa Ndiaye' : 'Awa Ndiaye',
                    cmuNumber: 'SN-DK-MED-8472',
                    structureName: 'Réseau national des mutuelles de santé (UNAMUSC Sénégal)',
                    details: [
                      { label: 'Consultations prénatales', value: 'Prise en charge 100% (CPN 1 à CPN 4+)' },
                      { label: 'Échographies & biologie', value: '3 Échographies + bilan sanguin complet gratuit' },
                      { label: 'Accouchement & césarienne', value: 'Gratuité totale sans avance de frais' },
                      { label: 'Médicaments & suppléments', value: 'Fer, acide folique et kit d\'accouchement stérile' },
                      { label: 'Vaccination PEV bébé', value: 'Programme élargi de vaccination 0-5 ans 100% couvert' }
                    ],
                    notes: 'En cas de contestation ou de refus de prise en charge dans une structure publique agréée, contactez immédiatement le numéro vert d\'urgence UNAMUSC.'
                  });
                }}
              >
                🖨️ Imprimer la charte des droits en PDF
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* MODALE AJOUT CPN (médecin / sage-femme / superadmin) */}
      {showAddCpnModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddCpn} style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '20px', padding: '2rem', border: '1px solid var(--border-color)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">➕ Ajouter une consultation CPN</h5>
              <button type="button" className="btn-close" onClick={() => setShowAddCpnModal(false)}></button>
            </div>
            <div className="mb-2">
              <label className="form-label small fw-bold">Titre *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={newCpnForm.title} onChange={(e) => setNewCpnForm({ ...newCpnForm, title: e.target.value })} placeholder="Ex: CPN 3 (28-32 SA)" required />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-bold">Observations cliniques</label>
              <textarea className="form-control" rows={3} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={newCpnForm.desc} onChange={(e) => setNewCpnForm({ ...newCpnForm, desc: e.target.value })} placeholder="Ex: Hauteur utérine, BCF, VAT, TPI-SP..." />
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label small fw-bold">Date</label>
                <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={newCpnForm.date} onChange={(e) => setNewCpnForm({ ...newCpnForm, date: e.target.value })} placeholder="JJ/MM/AAAA" />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold">Statut</label>
                <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={newCpnForm.status} onChange={(e) => setNewCpnForm({ ...newCpnForm, status: e.target.value })} placeholder="Ex: CPN 3 - À VENIR" />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label small fw-bold">Praticien</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={newCpnForm.doctor} onChange={(e) => setNewCpnForm({ ...newCpnForm, doctor: e.target.value })} placeholder="Ex: Dr. Mariama Ba" />
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddCpnModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold text-white">➕ Ajouter la CPN</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE ÉDITION FICHE CONSEIL (médecin / sage-femme / superadmin) */}
      {editingAdviceId && editAdviceForm && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleSaveEditAdvice} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '20px', padding: '2rem', border: '1px solid var(--border-color)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">✏️ Modifier la fiche conseil</h5>
              <button type="button" className="btn-close" onClick={() => { setEditingAdviceId(null); setEditAdviceForm(null); }}></button>
            </div>
            <div className="mb-2">
              <label className="form-label small fw-bold">Titre *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={editAdviceForm.title} onChange={(e) => setEditAdviceForm({ ...editAdviceForm, title: e.target.value })} required />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-bold">Sous-titre</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={editAdviceForm.subtitle || ''} onChange={(e) => setEditAdviceForm({ ...editAdviceForm, subtitle: e.target.value })} />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-bold">Contenu (une ligne par conseil)</label>
              <textarea className="form-control" rows={5} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={editAdviceForm.content} onChange={(e) => setEditAdviceForm({ ...editAdviceForm, content: e.target.value })} />
            </div>
            <div className="mb-2">
              <label className="form-label small fw-bold">Astuces ({'{'}'{'}'}conseil sage-femme)</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} value={editAdviceForm.tips || ''} onChange={(e) => setEditAdviceForm({ ...editAdviceForm, tips: e.target.value })} />
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => { setEditingAdviceId(null); setEditAdviceForm(null); }}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold text-white">💾 Enregistrer</button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
}
