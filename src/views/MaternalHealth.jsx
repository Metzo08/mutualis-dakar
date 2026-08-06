import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import DeleteModal from '../components/DeleteModal';

// Design Premium Haut de Gamme — Carnet Maternité & Santé Enfant
export default function MaternalHealth({ lang = 'fr', citizenUser = null, agentUser = null, partnerUser = null, userRole = 'citizen', setView = null }) {
  // ═══════════════════════════════════════════════════════
  // TOUS LES HOOKS DOIVENT ÊTRE ICI — avant tout return conditionnel
  // (règle des hooks React : ne jamais appeler useState/useEffect après un return)
  // ═══════════════════════════════════════════════════════
  const [activeTab, setActiveTab] = useState('cpn'); // 'cpn', 'pev', 'advice'

  // Modale universelle de suppression
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null); // { title, itemType, onConfirm }

  // Profil Bébé & Calcul Automatique d'Âge & Rappels SMS/WhatsApp
  const [babyProfile, setBabyProfile] = useState(() => {
    const saved = localStorage.getItem('maternity_baby_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      name: 'Moussa Ndiaye',
      birthDate: '2026-05-14',
      motherPhone: '+221 77 450 88 99',
      motherName: 'Fatou Diallo',
      reminderChannel: 'SMS & WhatsApp 💬',
      autoReminders: true,
      lastReminderSent: 'Il y a 2 jours'
    };
  });

  const [showBabyModal, setShowBabyModal] = useState(false);
  const [babyForm, setBabyForm] = useState(babyProfile);

  // Moteur de calcul dynamique de l'âge exact du bébé
  const calculateBabyAge = (birthDateStr) => {
    if (!birthDateStr) return 'Âge non renseigné';
    const birth = new Date(birthDateStr);
    const now = new Date();
    const diffMs = now - birth;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (isNaN(diffDays)) return 'Date invalide';
    if (diffDays < 0) return 'Naissance à venir';
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks > 0 ? `${diffDays} jours (${weeks} sem.)` : `${diffDays} jours`;
    }
    
    const diffMonths = Math.floor(diffDays / 30.4375);
    const remainingWeeks = Math.floor((diffDays % 30.4375) / 7);
    if (diffMonths < 12) {
      return `${diffMonths} mois` + (remainingWeeks > 0 ? ` (${remainingWeeks} sem.)` : '');
    }
    
    const years = Math.floor(diffMonths / 12);
    const remMonths = diffMonths % 12;
    return `${years} an${years > 1 ? 's' : ''}` + (remMonths > 0 ? ` ${remMonths} mois` : '');
  };

  const handleSaveBabyProfile = (e) => {
    e.preventDefault();
    setBabyProfile(babyForm);
    localStorage.setItem('maternity_baby_profile', JSON.stringify(babyForm));
    setShowBabyModal(false);
  };

  // 🗣️ Moteur de choix de langue vocale ('fr', 'wolof', 'pulaar')
  const [audioLang, setAudioLang] = useState('fr');

  // 🚨 Modale d'Urgence Maternité & Signes de Danger (SAMU 1515)
  const [showDangerSOSModal, setShowDangerSOSModal] = useState(false);
  const [selectedDangerSign, setSelectedDangerSign] = useState('Saignements vaginaux');

  // 💊 État Supplémentation Maternelle & TPI-SP Paludisme (PNLP Sénégal / UNAMUSC)
  const [maternalSupplements, setMaternalSupplements] = useState(() => {
    const saved = localStorage.getItem('maternity_supplements');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      ferFolateDaysTaken: 45,
      ferFolateTotalDays: 90,
      tpiDoses: [
        { id: 1, cpn: 'CPN 2 (16-20 sem)', date: '14/06/2026', given: true, status: 'Administré (Dose 1)' },
        { id: 2, cpn: 'CPN 3 (28-32 sem)', date: '12/08/2026', given: true, status: 'Administré (Dose 2)' },
        { id: 3, cpn: 'CPN 4 (36-38 sem)', date: 'À venir', given: false, status: 'Programmé (Dose 3)' }
      ],
      mildaNetDistributed: true,
      mildaDate: '15/05/2026'
    };
  });

  const [showSupplementsModal, setShowSupplementsModal] = useState(false);
  const [editSupplementsForm, setEditSupplementsForm] = useState(maternalSupplements);

  const handleSaveSupplements = (e) => {
    e.preventDefault();
    setMaternalSupplements(editSupplementsForm);
    localStorage.setItem('maternity_supplements', JSON.stringify(editSupplementsForm));
    setShowSupplementsModal(false);
  };

  // 📊 État Suivi de Croissance Bébé OMS (Percentiles 0-24 mois)
  const [babyGrowth, setBabyGrowth] = useState(() => {
    const saved = localStorage.getItem('maternity_baby_growth');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, month: 'Naissance (M0)', date: '14/05/2026', weight: 3.4, height: 50, head: 35, status: 'Harmonieuse (Percentile 50)' },
      { id: 2, month: '1er Mois (M1)', date: '14/06/2026', weight: 4.3, height: 54, head: 37, status: 'Harmonieuse (Percentile 50)' },
      { id: 3, month: '2ème Mois (M2)', date: '14/07/2026', weight: 5.2, height: 58, head: 39, status: 'Harmonieuse (Percentile 50)' }
    ];
  });

  const [showAddGrowthModal, setShowAddGrowthModal] = useState(false);
  const [newGrowthForm, setNewGrowthForm] = useState({
    month: '3ème Mois (M3)',
    date: '14/08/2026',
    weight: '6.0',
    height: '61',
    head: '40.5',
    status: 'Harmonieuse (Percentile 50)'
  });

  const handleAddGrowthEntry = (e) => {
    e.preventDefault();
    const entry = {
      id: Date.now(),
      month: newGrowthForm.month,
      date: newGrowthForm.date,
      weight: parseFloat(newGrowthForm.weight) || 5.5,
      height: parseFloat(newGrowthForm.height) || 59,
      head: parseFloat(newGrowthForm.head) || 39.5,
      status: newGrowthForm.status || 'Harmonieuse (Percentile 50)'
    };
    const updated = [...babyGrowth, entry];
    setBabyGrowth(updated);
    localStorage.setItem('maternity_baby_growth', JSON.stringify(updated));
    setShowAddGrowthModal(false);
  };

  // 📄 Générateur Officiel de Certificat d'Accouchement & Naissance 100% UNAMUSC
  const handleGenerateDeliveryCertificate = () => {
    generateOfficialPdf({
      filename: `certificat_accouchement_${babyProfile.name.replace(/\s+/g, '_')}.pdf`,
      docType: 'CERTIFICAT D\'ACCOUCHEMENT ET DE NAISSANCE',
      title: 'Attestation Officielle d\'Accouchement & Gratuité Maternité (100% UNAMUSC)',
      referenceNo: `ACC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      beneficiaryName: babyProfile.motherName,
      cmuNumber: 'SN-DK-BSF-9901',
      structureName: agentUser?.structure_name || 'Centre Hospitalier Abass Ndao (Dakar)',
      details: [
        { label: 'Accouchée (Mère)', value: `${babyProfile.motherName} (${babyProfile.motherPhone})` },
        { label: 'Nouveau-né (Bébé)', value: `${babyProfile.name} (Sexe masculin)` },
        { label: 'Date & Heure d\'Accouchement', value: '14/05/2026 à 04:15 AM' },
        { label: 'Type d\'Accouchement', value: 'Accouchement Eutocique Simple (Voie basse)' },
        { label: 'Poids & Taille à la naissance', value: '3.400 kg • 50 cm' },
        { label: 'Prise en charge UNAMUSC', value: '100% Gratuit (Accouchement + Soins néonataux)' },
        { label: 'Déclaration État Civil Mairie', value: 'CERTIFIÉ CONFORME POUR ACTE DE NAISSANCE' }
      ],
      notes: 'Certificat officiel délivré conformément au programme national de gratuité des soins de santé maternelle et néonatale (UNAMUSC). Dispense de toute avance de frais.'
    });
  };

  // Traitement d'envoi de relance/rappel immédiat avec synthèse vocale audible trilingue
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderToast, setReminderToast] = useState(null);

  // Moteur de synthèse vocale Web Speech & Web Audio chime
  const playSpeechAudio = (textToSpeak) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {}

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'fr-FR';
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const frVoice = voices.find(v => v.lang.includes('fr'));
      if (frVoice) utterance.voice = frVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  const triggerInstantReminder = (type = 'sms', langChoice = audioLang) => {
    setReminderSending(true);
    const nextPendingVaccine = vaccinations.find(v => !v.completed);
    const nextPendingCpn = cpnVisits.find(c => !c.completed);
    const targetPrestation = nextPendingVaccine ? `Vaccination PEV (${nextPendingVaccine.vaccines})` : (nextPendingCpn ? nextPendingCpn.title : 'Consultation de suivi post-natal');

    setTimeout(() => {
      setReminderSending(false);
      let msg = '';
      let spokenMsg = '';

      if (langChoice === 'wolof') {
        spokenMsg = `Nanga def ${babyProfile.motherName}! Nguir suñu waah UNAMUSC : Consultation ak vaccins bu bébé ${babyProfile.name} fajj na ci centre de santé. Fajj gi payewul dara, 100% gratuit la.`;
      } else if (langChoice === 'pulaar') {
        spokenMsg = `Jam waali ${babyProfile.motherName}! Degindagol UNAMUSC : Cellal mamin e bimbintagol fayɓe ${babyProfile.name} ina jogii miijo e nokkuur cellal. Ko ɗum yoɓetaake, gratuit 100%.`;
      } else {
        spokenMsg = `Bonjour ${babyProfile.motherName}! Rappel UNAMUSC : la consultation de suivi et la vaccination de votre bébé ${babyProfile.name} sont programmées au centre de santé. Prise en charge cent pour cent gratuite.`;
      }

      if (type === 'sms' || type === 'whatsapp') {
        msg = `📲 Notification SMS & WhatsApp délivrée à ${babyProfile.motherName} (${babyProfile.motherPhone}) : "${spokenMsg}"`;
        playSpeechAudio(`Notification envoyée avec succès à ${babyProfile.motherName}`);
      } else {
        msg = `🔊 Relance vocale (${langChoice.toUpperCase()}) en cours de lecture pour ${babyProfile.motherPhone} : "${spokenMsg}"`;
        playSpeechAudio(spokenMsg);
      }
      
      setReminderToast(msg);
      setBabyProfile(prev => ({ ...prev, lastReminderSent: "À l'instant" }));
      setTimeout(() => setReminderToast(null), 9500);
    }, 600);
  };

  // État Vaccinations PEV (Tab 2)
  const [vaccinations, setVaccinations] = useState([
    {
      id: 1,
      ageLabel: 'Naissance (J0 à J7)',
      vaccines: 'BCG + VPO 0 + VHB 0',
      subtext: 'Dose initiale de maternité',
      diseases: 'Tuberculose, polio, hépatite B',
      structure: 'Centre Gaspard Camara',
      status: 'Administré (100% CSU)',
      completed: true
    },
    {
      id: 2,
      ageLabel: '6 Semaines (1 mois & demi)',
      vaccines: 'Penta 1 + VPO 1 + Rota 1 + Pneumo 1',
      subtext: '4 vaccins combinés',
      diseases: 'Diphtérie, tétanos, coqueluche, méningite',
      structure: 'Dispensaire Point E',
      status: 'Administré (100% CSU)',
      completed: true
    },
    {
      id: 3,
      ageLabel: '10 Semaines (2 mois & demi)',
      vaccines: 'Penta 2 + VPO 2 + Rota 2 + Pneumo 2',
      subtext: 'Rappel de 2ème dose',
      diseases: 'Rappel des immunisations premières',
      structure: 'Centre de santé Pikine',
      status: 'À venir (Juillet 2026)',
      completed: false
    },
    {
      id: 4,
      ageLabel: '14 Semaines (3 mois & demi)',
      vaccines: 'Penta 3 + VPO 3 + VPI 1 + Pneumo 3',
      subtext: '3ème dose & injectables',
      diseases: 'Immunisation complète 1er âge',
      structure: 'CHU de Fann (Dakar)',
      status: 'Programmé (Août 2026)',
      completed: false
    },
    {
      id: 5,
      ageLabel: '9 Mois (Échéance finale 1er an)',
      vaccines: 'RR 1 + VAA + Vitamine A',
      subtext: 'Rougeole, rubéole & fièvre jaune',
      diseases: 'Fièvre jaune, rougeole & carences',
      structure: 'Centre Gaspard Camara',
      status: 'Programmé (Février 2027)',
      completed: false
    }
  ]);

  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);
  const [newVaccineForm, setNewVaccineForm] = useState({ ageLabel: '', vaccines: '', subtext: '', diseases: '', structure: 'Centre Hospitalier Abass Ndao', status: 'Administré (100% CSU)', completed: true });
  const [editingVaccineId, setEditingVaccineId] = useState(null);
  const [editVaccineForm, setEditVaccineForm] = useState(null);

  // Modales
  const [showGuaranteeModal, setShowGuaranteeModal] = useState(false);
  const [showRightsModal, setShowRightsModal] = useState(false);
  const [showAskMidwifeModal, setShowAskMidwifeModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedCpnForBooking, setSelectedCpnForBooking] = useState(null);
  const [bookingDate, setBookingDate] = useState('2026-08-15');

  // Dynamic Vitals State (Poids & Tension)
  const [vitals, setVitals] = useState(() => {
    const saved = localStorage.getItem('maternity_vitals');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      weight: '64.5 kg',
      weightGain: '+2.1kg / mois',
      bloodPressure: '12/8',
      bpStatus: 'Normal'
    };
  });

  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    weight: vitals.weight,
    weightGain: vitals.weightGain,
    bloodPressure: vitals.bloodPressure,
    bpStatus: vitals.bpStatus
  });

  const handleSaveVitals = (e) => {
    e.preventDefault();
    setVitals(vitalsForm);
    localStorage.setItem('maternity_vitals', JSON.stringify(vitalsForm));
    setShowVitalsModal(false);
    alert('✅ Constantes vitales mises à jour avec succès !');
  };

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

  const handleDeleteCpn = (cpn) => {
    setDeleteConfirmTarget({
      title: cpn.title || 'Consultation CPN',
      itemType: 'Consultation CPN Maternité',
      onConfirm: () => setCpnVisits(cpnVisits.filter(c => c.id !== cpn.id))
    });
  };

  const handleAddCpn = (e) => {
    e.preventDefault();
    if (!newCpnForm.title) return;
    const newCpn = { id: Date.now(), ...newCpnForm };
    setCpnVisits([...cpnVisits, newCpn]);
    setShowAddCpnModal(false);
    setNewCpnForm({ title: '', desc: '', date: '', doctor: '', status: '', completed: false });
  };

  // ─── GESTION DES VACCINATIONS PEV (médecin / sage-femme / superadmin) ───

  const handleAddVaccine = (e) => {
    e.preventDefault();
    if (!newVaccineForm.vaccines || !newVaccineForm.ageLabel) return;
    const newV = { id: Date.now(), ...newVaccineForm };
    setVaccinations([...vaccinations, newV]);
    setShowAddVaccineModal(false);
    setNewVaccineForm({ ageLabel: '', vaccines: '', subtext: '', diseases: '', structure: 'Centre Hospitalier Abass Ndao', status: 'Administré (100% CSU)', completed: true });
  };

  const openEditVaccine = (v) => {
    setEditingVaccineId(v.id);
    setEditVaccineForm({ ...v });
  };

  const handleSaveEditVaccine = (e) => {
    e.preventDefault();
    setVaccinations(vaccinations.map(v => v.id === editingVaccineId ? editVaccineForm : v));
    setEditingVaccineId(null);
    setEditVaccineForm(null);
  };

  const handleDeleteVaccine = (v) => {
    setDeleteConfirmTarget({
      title: v.vaccines,
      itemType: 'Dose Vaccinale PEV',
      onConfirm: () => setVaccinations(vaccinations.filter(x => x.id !== v.id))
    });
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
  };

  const handleDeleteAdvice = (art) => {
    setDeleteConfirmTarget({
      title: art.title,
      itemType: 'Fiche Conseil Médicale',
      onConfirm: () => setAdviceArticles(adviceArticles.filter(a => a.id !== art.id))
    });
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
            <div className="d-flex flex-column gap-1">
              <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'inherit', letterSpacing: '-0.01em' }}>
                {isSuperAdmin && 'Mode superadmin'}
                {isMidwife && 'Mode sage-femme'}
                {isDoctor && 'Mode médecin'}
              </h6>
              <span className="small" style={{ opacity: 0.9, fontSize: '0.88rem', lineHeight: '1.45' }}>
                {isSuperAdmin && 'Accès total : Toutes les actions et validations sont disponibles.'}
                {isMidwife && 'Édition complète : Vous pouvez remplir les consultations prénatales, ajouter des fiches conseils et modifier le carnet.'}
                {isDoctor && 'Édition complète : Vous pouvez remplir les consultations prénatales, ajouter des fiches conseils et modifier le carnet.'}
              </span>
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
            <div className="d-flex flex-column gap-1">
              <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                Mode lecture seule
              </h6>
              <span className="small" style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: '1.45' }}>
                Espace assuré : Consultez votre carnet de maternité, téléchargez le PDF et posez vos questions à la sage-femme.
              </span>
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
                  style={{ background: '#dc2626', color: '#ffffff', border: '1px solid #b91c1c', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '800', fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.45)', cursor: 'pointer' }} 
                  onClick={() => setShowDangerSOSModal(true)}
                >
                  🚨 Signes de danger & Urgence Maternité (SAMU 1515)
                </button>

                <button 
                  type="button"
                  style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', boxShadow: '0 4px 15px rgba(5, 150, 105, 0.4)', cursor: 'pointer' }} 
                  onClick={handleGenerateDeliveryCertificate}
                >
                  📜 Certificat d'accouchement PDF (100% UNAMUSC)
                </button>
                
                <button 
                  type="button"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }} 
                  onClick={handleDownloadCarnet}
                >
                  📥 Carnet officiel PDF (🇸🇳)
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
                
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                  {(() => {
                    const completedCount = cpnVisits.filter(c => c.completed).length;
                    const totalCount = cpnVisits.length;
                    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    return (
                      <div className="w-100">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Calendrier des consultations prénatales & post-natales</h5>
                          <span style={{ background: percentage === 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: percentage === 100 ? '#10b981' : '#3b82f6', border: `1px solid ${percentage === 100 ? '#10b981' : '#3b82f6'}`, borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}>
                            {percentage === 100 ? '✔ Toutes effectuées' : `⌛ En cours (${completedCount}/${totalCount})`}
                          </span>
                        </div>

                        <div className="d-flex align-items-center justify-content-between mt-1">
                          <small style={{ color: 'var(--text-sub)' }}>
                            Progression actuelle : <span className="text-success fw-extrabold" style={{ fontSize: '0.95rem' }}>{percentage}% complété</span> ({completedCount} sur {totalCount} consultations validées)
                          </small>
                        </div>

                        <div className="progress mt-2" style={{ height: '8px', background: 'var(--bg-card-subtle)', borderRadius: '10px' }}>
                          <div className="progress-bar bg-success" style={{ width: `${percentage}%`, borderRadius: '10px', transition: 'width 0.4s ease' }}></div>
                        </div>
                      </div>
                    );
                  })()}
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
                            <div className="input-group input-group-sm" style={{ maxWidth: '210px' }}>
                              <input type="text" className="form-control form-control-sm fw-bold" placeholder="Date (ex: 12/08/2026)" value={editCpnForm.date} onChange={(e) => setEditCpnForm({ ...editCpnForm, date: e.target.value })} />
                              <input 
                                type="date" 
                                id={`cpn-date-inline-${item.id}`} 
                                style={{ display: 'none' }} 
                                onChange={(e) => {
                                  if (e.target.value) {
                                    const parts = e.target.value.split('-');
                                    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                    setEditCpnForm({ ...editCpnForm, date: formatted });
                                  }
                                }} 
                              />
                              <button 
                                type="button" 
                                className="btn btn-sm btn-outline-success fw-bold"
                                onClick={() => {
                                  const picker = document.getElementById(`cpn-date-inline-${item.id}`);
                                  if (picker && picker.showPicker) picker.showPicker();
                                }}
                                title="Sélectionner sur le calendrier"
                              >
                                📅
                              </button>
                            </div>
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
                                <button type="button" style={{ background: '#dc2626', color: '#ffffff', border: '1px solid #b91c1c', borderRadius: '10px', padding: '0.4rem 0.75rem', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(220, 38, 38, 0.3)' }} onClick={() => handleDeleteCpn(item.id)}>🗑️ Supprimer</button>
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
                
                {/* Card 💊 Supplémentation Maternelle & TPI Paludisme (PNLP Sénégal / UNAMUSC) */}
                <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fs-5">💊</span>
                      <div>
                        <h6 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>Supplémentation & TPI Paludisme</h6>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Directives PNLP Sénégal & UNAMUSC</small>
                      </div>
                    </div>
                    {canEditMaternity && (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-success fw-bold"
                        style={{ borderRadius: '8px', fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => {
                          setEditSupplementsForm(maternalSupplements);
                          setShowSupplementsModal(true);
                        }}
                      >
                        ✏️ Modifier
                      </button>
                    )}
                  </div>

                  {/* Fer & Acide Folique */}
                  <div className="p-3 rounded-3 mb-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                    <div className="d-flex justify-content-between align-items-center mb-1.5">
                      <small className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>💊 Fer & Acide Folique (Anti-anémie)</small>
                      <span className="badge bg-success-subtle text-success fw-bold" style={{ fontSize: '0.72rem' }}>
                        {maternalSupplements.ferFolateDaysTaken} / {maternalSupplements.ferFolateTotalDays} jours
                      </span>
                    </div>
                    <div className="progress" style={{ height: '7px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                      <div className="progress-bar bg-success" style={{ width: `${Math.round((maternalSupplements.ferFolateDaysTaken / maternalSupplements.ferFolateTotalDays) * 100)}%`, borderRadius: '6px' }}></div>
                    </div>
                    <small className="d-block text-muted mt-1" style={{ fontSize: '0.72rem' }}>
                      1 comprimé par jour prescrit pendant toute la grossesse
                    </small>
                  </div>

                  {/* TPI Paludisme (SP) */}
                  <div className="mb-3">
                    <small className="d-block text-muted fw-bold mb-2" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🦟 TPI Paludisme (Sulfadoxine-Pyriméthamine)
                    </small>
                    <div className="d-flex flex-column gap-1.5">
                      {maternalSupplements.tpiDoses.map(dose => (
                        <div key={dose.id} className="d-flex align-items-center justify-content-between p-2 rounded-2" style={{ background: 'var(--bg-card-subtle)', fontSize: '0.78rem' }}>
                          <span className="fw-semibold" style={{ color: 'var(--text-main)' }}>{dose.cpn}</span>
                          <span className={`badge ${dose.given ? 'bg-success text-white' : 'bg-warning text-dark'} fw-bold`} style={{ borderRadius: '6px', fontSize: '0.7rem' }}>
                            {dose.given ? `✅ ${dose.status}` : `⏳ ${dose.status}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MILDA Moustiquaire */}
                  <div className="p-2.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div className="d-flex align-items-center gap-2">
                      <span>🛖</span>
                      <div>
                        <strong className="d-block" style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>Moustiquaire MILDA offerte</strong>
                        <small className="text-success fw-bold" style={{ fontSize: '0.7rem' }}>Remise certifiée CPN 1</small>
                      </div>
                    </div>
                    <span className="badge bg-success text-white fw-bold" style={{ borderRadius: '6px', fontSize: '0.7rem' }}>100% Gratuit</span>
                  </div>
                </div>

                {/* Card Constantes Vitales */}
                <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-2 text-success">
                      <span style={{ fontSize: '1.2rem' }}>📈</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Constantes vitales</h6>
                    </div>

                    {(canEditMaternity || isSuperAdmin) && (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-primary fw-bold"
                        style={{ borderRadius: '8px', fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => {
                          setVitalsForm(vitals);
                          setShowVitalsModal(true);
                        }}
                        title="Éditer les constantes vitales du patient"
                      >
                        ✏️ Modifier
                      </button>
                    )}
                  </div>

                  <div className="row text-center g-2">
                    <div className="col-6">
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                        <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>Poids</small>
                        <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{vitals.weight}</h4>
                        <small className="text-success" style={{ fontSize: '0.68rem' }}>{vitals.weightGain}</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                        <small className="d-block" style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>Tension art.</small>
                        <h4 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{vitals.bloodPressure}</h4>
                        <small className={vitals.bpStatus.includes('Élevée') ? 'text-danger fw-bold' : 'text-success'} style={{ fontSize: '0.68rem' }}>
                          {vitals.bpStatus}
                        </small>
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
            {/* KPI Summary Cards Header (100% DYNAMIQUE & CALCULÉ) */}
            <div className="row g-3 mb-2">
              <div className="col-md-4">
                <div className="p-3.5 rounded-4 d-flex align-items-center justify-content-between h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                      👶
                    </div>
                    <div>
                      <small className="d-block text-muted fw-bold" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bébé rattaché</small>
                      <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{babyProfile.name}</strong>
                      <small className="d-block text-success fw-bold" style={{ fontSize: '0.78rem' }}>
                        Né le {new Date(babyProfile.birthDate).toLocaleDateString('fr-FR')} • <span className="badge bg-success-subtle text-success border border-success">{calculateBabyAge(babyProfile.birthDate)}</span>
                      </small>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-success fw-bold ms-2"
                    style={{ borderRadius: '8px', fontSize: '0.75rem' }}
                    onClick={() => {
                      setBabyForm(babyProfile);
                      setShowBabyModal(true);
                    }}
                    title="Modifier le profil du bébé & contact assurée"
                  >
                    ✏️
                  </button>
                </div>
              </div>

              <div className="col-md-4">
                <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                    💉
                  </div>
                  <div>
                    <small className="d-block text-muted fw-bold" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progression vaccinale</small>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{vaccinations.filter(v => v.completed).length} / {vaccinations.length} doses administrées</strong>
                    <small className="d-block text-primary fw-semibold" style={{ fontSize: '0.78rem' }}>
                      {vaccinations.length > 0 ? Math.round((vaccinations.filter(v => v.completed).length / vaccinations.length) * 100) : 0}% du programme PEV accompli
                    </small>
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
                    {(() => {
                      const nextPending = vaccinations.find(v => !v.completed);
                      if (nextPending) {
                        return (
                          <>
                            <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{nextPending.ageLabel}</strong>
                            <small className="d-block text-warning fw-semibold" style={{ fontSize: '0.78rem' }}>🏥 {nextPending.structure}</small>
                          </>
                        );
                      }
                      return (
                        <>
                          <strong style={{ color: '#10b981', fontSize: '1rem' }}>Programme accompli 100%</strong>
                          <small className="d-block text-success fw-semibold" style={{ fontSize: '0.78rem' }}>✅ Vaccins 0-12 mois à jour</small>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* CARD CENTRE DE RAPPELS AUTOMATIQUES SMS / WHATSAPP / VOCAL (SENTENCE CASE STRICT & CONTRASTE MAX) */}
            <div className="p-4 rounded-4 text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 12px 35px rgba(0,0,0,0.35)' }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                <div className="d-flex align-items-center gap-2.5">
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                    🔔
                  </div>
                  <div>
                    <h6 className="fw-extrabold mb-0 text-white" style={{ fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                      Centre de rappels & relances automatiques (suivi mère & bébé)
                    </h6>
                    <small style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                      Assurée : <strong className="text-white">{babyProfile.motherName}</strong> ({babyProfile.motherPhone}) • Canal : <strong className="text-emerald-400">{babyProfile.reminderChannel}</strong>
                    </small>
                  </div>
                </div>

                <span className="badge px-3 py-2 rounded-pill fw-bold" style={{ background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)', fontSize: '0.78rem' }}>
                  🟢 Relances automatiques H-48 actives
                </span>
              </div>

              {reminderToast && (
                <div className="alert d-flex align-items-center p-3 mb-3 rounded-3 border-0 fade-in" style={{ background: 'rgba(5, 150, 105, 0.25)', color: '#a7f3d0', border: '1px solid #059669', boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)' }}>
                  <span className="me-2 fs-4">🔊</span>
                  <div className="small fw-bold" style={{ lineHeight: '1.45', fontSize: '0.88rem' }}>{reminderToast}</div>
                </div>
              )}

              <div className="d-flex gap-3 flex-wrap align-items-center justify-content-between pt-2 border-top" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="d-flex align-items-center gap-2">
                  <span className="small text-white-50" style={{ fontSize: '0.83rem' }}>Choix de la langue vocale :</span>
                  <div className="btn-group btn-group-sm" role="group">
                    <button type="button" className={`btn btn-sm ${audioLang === 'fr' ? 'btn-success fw-bold' : 'btn-outline-light text-white'}`} style={{ fontSize: '0.74rem' }} onClick={() => setAudioLang('fr')}>🗣️ FR</button>
                    <button type="button" className={`btn btn-sm ${audioLang === 'wolof' ? 'btn-success fw-bold' : 'btn-outline-light text-white'}`} style={{ fontSize: '0.74rem' }} onClick={() => setAudioLang('wolof')}>🗣️ Wolof</button>
                    <button type="button" className={`btn btn-sm ${audioLang === 'pulaar' ? 'btn-success fw-bold' : 'btn-outline-light text-white'}`} style={{ fontSize: '0.74rem' }} onClick={() => setAudioLang('pulaar')}>🗣️ Pulaar</button>
                  </div>
                </div>

                <div className="d-flex gap-2.5 flex-wrap">
                  <button 
                    type="button"
                    style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.55rem 1.1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)' }}
                    disabled={reminderSending}
                    onClick={() => triggerInstantReminder('sms', audioLang)}
                  >
                    <span>💬</span> {reminderSending ? 'Envoi...' : 'Envoyer un rappel SMS / WhatsApp immédiat'}
                  </button>

                  <button 
                    type="button"
                    style={{ background: '#1e3a8a', color: '#ffffff', border: '1px solid #3b82f6', borderRadius: '12px', padding: '0.55rem 1.1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)' }}
                    disabled={reminderSending}
                    onClick={() => triggerInstantReminder('voice', audioLang)}
                  >
                    <span>🔊</span> Relance vocale ({audioLang.toUpperCase()})
                  </button>

                  <button 
                    type="button"
                    style={{ background: '#1e293b', color: '#fbbf24', border: '1px solid #f59e0b', borderRadius: '12px', padding: '0.55rem 0.95rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}
                    onClick={() => {
                      setBabyForm(babyProfile);
                      setShowBabyModal(true);
                    }}
                  >
                    ⚙️ Configurer le contact
                  </button>
                </div>
              </div>
            </div>

            {/* 📊 CARD SUIVI & COURBE DE CROISSANCE OMS DU BÉBÉ (0-24 MOIS) */}
            <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px' }}>
              <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
                    📊
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Courbe de croissance & périmètre crânien OMS (0-24 mois)</h5>
                    <small className="text-muted" style={{ fontSize: '0.82rem' }}>Suivi pédiatrique certifié par les normes OMS de santé infantile</small>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-success-subtle text-success px-3 py-2 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                    🟢 Trajectoire OMS : Harmonieuse (P50)
                  </span>
                  {canEditMaternity && (
                    <button 
                      type="button" 
                      className="btn btn-sm btn-success fw-bold text-white shadow-sm"
                      style={{ borderRadius: '10px', padding: '0.45rem 0.9rem', fontSize: '0.82rem', background: '#059669', borderColor: '#059669' }}
                      onClick={() => setShowAddGrowthModal(true)}
                    >
                      ➕ Consigner une pesée (Pédiatre / Médecin)
                    </button>
                  )}
                </div>
              </div>

              {/* GRAPHIQUE VISUEL INTERACTIF SVG DE LA COURBE OMS */}
              <div className="p-3.5 rounded-4 mb-4 text-white position-relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <small className="fw-bold text-emerald-400" style={{ fontSize: '0.82rem' }}>📈 TRAJECTOIRE DE POIDS (KG) VS COULOIR VERT OMS (PERCENTILE 3 À 97)</small>
                  <small className="text-slate-400" style={{ fontSize: '0.78rem' }}>Dernière pesée : {babyGrowth[babyGrowth.length - 1]?.date} ({babyGrowth[babyGrowth.length - 1]?.weight} kg)</small>
                </div>

                <div style={{ width: '100%', height: '140px', position: 'relative' }}>
                  <svg width="100%" height="100%" viewBox="0 0 500 120" preserveAspectRatio="none">
                    {/* Zone verte OMS corridor */}
                    <path d="M 30 90 Q 250 55 470 20 L 470 45 Q 250 80 30 110 Z" fill="rgba(16, 185, 129, 0.18)" />
                    
                    {/* Ligne médiane OMS P50 */}
                    <path d="M 30 100 Q 250 67 470 32" fill="none" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="2" strokeDasharray="4 4" />

                    {/* Ligne pesée réelle bébé */}
                    <path 
                      d={`M ${babyGrowth.map((g, idx) => {
                        const x = 30 + (idx * 210);
                        const y = 100 - ((g.weight - 3) * 22);
                        return `${x} ${y}`;
                      }).join(' L ')}`} 
                      fill="none" 
                      stroke="#34d399" 
                      strokeWidth="3.5" 
                    />

                    {/* Points pesées */}
                    {babyGrowth.map((g, idx) => {
                      const x = 30 + (idx * 210);
                      const y = 100 - ((g.weight - 3) * 22);
                      return (
                        <g key={g.id}>
                          <circle cx={x} cy={y} r="6" fill="#059669" stroke="#ffffff" strokeWidth="2" />
                          <text x={x} y={y - 10} fill="#a7f3d0" fontSize="10" fontWeight="bold" textAnchor="middle">{g.weight} kg</text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* TABLEAU DES RELEVÉS MENSUELS BÉBÉ */}
              <div className="table-responsive" style={{ borderRadius: '14px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                  <thead style={{ background: 'var(--bg-card-subtle)' }}>
                    <tr className="small" style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                      <th>ÉCHÉANCE MENSUELLE</th>
                      <th>DATE PESÉE</th>
                      <th>POIDS (KG)</th>
                      <th>TAILLE (CM)</th>
                      <th>PÉRIMÈTRE CRÂNIEN</th>
                      <th className="text-end">STATUT OMS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {babyGrowth.map((g) => (
                      <tr key={g.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                        <td className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{g.month}</td>
                        <td style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>📅 {g.date}</td>
                        <td className="fw-extrabold text-success" style={{ fontSize: '0.95rem' }}>⚖️ {g.weight} kg</td>
                        <td className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>📏 {g.height} cm</td>
                        <td style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>🧠 {g.head} cm</td>
                        <td className="text-end">
                          <span className="badge bg-success-subtle text-success border border-success fw-bold px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.75rem' }}>
                            🟢 {g.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                      {canEditMaternity && <th scope="col" className="text-end" style={{ padding: '1rem 1.25rem' }}>ACTIONS MÉDICALES</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {vaccinations.map((item) => (
                      <tr key={item.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                        <td style={{ padding: '1.1rem 1.25rem' }}>
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{item.ageLabel}</strong>
                          <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>PEV Sénégal</small>
                        </td>
                        <td style={{ padding: '1.1rem 1.25rem' }}>
                          <span className={item.completed ? 'text-success fw-bold' : 'text-primary fw-bold'} style={{ fontSize: '0.9rem' }}>{item.vaccines}</span>
                          <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>{item.subtext}</small>
                        </td>
                        <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                          {item.diseases}
                        </td>
                        <td style={{ padding: '1.1rem 1.25rem', color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                          🏥 {item.structure}
                        </td>
                        <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                          <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '0.35rem', 
                            background: item.completed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)', 
                            color: item.completed ? '#10b981' : '#3b82f6', 
                            border: item.completed ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)', 
                            padding: '0.45rem 0.9rem', 
                            borderRadius: '30px', 
                            fontSize: '0.78rem', 
                            fontWeight: '800' 
                          }}>
                            <span>{item.completed ? '✅' : '🗓️'}</span> <span>{item.status}</span>
                          </span>
                        </td>
                        {canEditMaternity && (
                          <td className="text-end" style={{ padding: '1.1rem 1.25rem', whiteSpace: 'nowrap' }}>
                            <div className="d-flex justify-content-end gap-1.5">
                              <button 
                                type="button" 
                                style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', padding: '0.35rem 0.65rem', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer' }}
                                onClick={() => openEditVaccine(item)}
                              >
                                ✏️ Modifier
                              </button>
                              <button 
                                type="button" 
                                style={{ background: '#dc2626', color: '#ffffff', border: '1px solid #b91c1c', borderRadius: '10px', padding: '0.4rem 0.75rem', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', boxShadow: '0 3px 10px rgba(220, 38, 38, 0.3)' }}
                                onClick={() => handleDeleteVaccine(item)}
                              >
                                🗑️ Supprimer
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bouton Ajouter une vaccination PEV — Médecin / Sage-femme / SuperAdmin */}
              {canEditMaternity && (
                <button 
                  type="button" 
                  className="mt-3" 
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '2px dashed #10b981', borderRadius: '12px', padding: '0.85rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', width: '100%' }} 
                  onClick={() => setShowAddVaccineModal(true)}
                >
                  ➕ Enregistrer une nouvelle vaccination PEV ({isMidwife ? 'Sage-femme' : isSuperAdmin ? 'SuperAdmin' : 'Médecin'})
                </button>
              )}
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

                      <div className="p-4 rounded-3 border-start border-4 border-success shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeftColor: '#059669 !important', borderRadius: '16px' }}>
                        <div className="d-flex align-items-center gap-3 mb-3">
                          <img src="/dr_fatou_diop.png" onError={(e) => { e.target.src = '/mariama_avatar.png'; }} alt="Dr. Fatou Diome" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #059669' }} />
                          <div>
                            <div className="d-flex align-items-center gap-2 mb-0.5">
                              <strong className="d-block text-success fw-extrabold" style={{ fontSize: '0.94rem' }}>{item.doctor || 'Sage-femme Fatou Diome'}</strong>
                              <span className="badge bg-success-subtle text-success px-2 py-0.5 fw-bold" style={{ borderRadius: '6px', fontSize: '0.68rem' }}>🟢 Réponse certifiée</span>
                            </div>
                            <small className="text-muted d-block" style={{ fontSize: '0.76rem' }}>Sage-femme d'État • CHU de Fann</small>
                          </div>
                        </div>
                        <p className="small mb-0 text-secondary" style={{ lineHeight: '1.65', fontSize: '0.9rem' }}>
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
                  
                  <div className="d-flex flex-column gap-3.5">
                    {adviceArticles.map((art) => (
                      <div 
                        key={art.id} 
                        className="p-4 rounded-4 d-flex flex-column gap-3 shadow-sm" 
                        style={{ 
                          background: 'var(--bg-card-subtle)', 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '20px',
                          cursor: 'pointer',
                          transition: 'all 0.25 ease'
                        }} 
                        onClick={() => setSelectedAdviceArticle(art)}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                          <div className="d-flex align-items-center gap-3">
                            <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(5, 150, 105, 0.14)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0, border: '1px solid rgba(5, 150, 105, 0.25)' }}>
                              {art.icon}
                            </div>
                            <div>
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <span className="badge bg-success-subtle text-success fw-bold px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                  {art.badge}
                                </span>
                                <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>⏱️ {art.readTime}</small>
                              </div>
                              <h6 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.02rem', lineHeight: '1.35' }}>
                                {art.title}
                              </h6>
                            </div>
                          </div>

                          {/* Boutons d'action pour médecin / sage-femme / superadmin */}
                          {canEditMaternity && (
                            <div className="d-flex align-items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              <button 
                                type="button" 
                                className="btn btn-sm btn-outline-primary fw-bold d-inline-flex align-items-center gap-1" 
                                style={{ borderRadius: '10px', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }} 
                                onClick={() => openEditAdvice(art)}
                              >
                                ✏️ Modifier
                              </button>
                              <button 
                                type="button" 
                                className="btn btn-sm text-white fw-bold d-inline-flex align-items-center gap-1 shadow-sm" 
                                style={{ background: '#dc2626', borderColor: '#b91c1c', borderRadius: '10px', padding: '0.4rem 0.8rem', fontSize: '0.78rem' }} 
                                onClick={() => handleDeleteAdvice(art.id)}
                              >
                                🗑️ Supprimer
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="mb-0 text-muted small" style={{ fontSize: '0.86rem', lineHeight: '1.55' }}>
                          {art.subtitle}
                        </p>

                        <div className="pt-2.5 border-top d-flex align-items-center justify-content-between flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
                          <small className="text-success fw-bold d-inline-flex align-items-center gap-1.5" style={{ fontSize: '0.78rem' }}>
                            <span>🛡️</span> Recommandation médicale certifiée UNAMUSC
                          </small>

                          <button
                            type="button"
                            className="btn btn-sm btn-success text-white fw-bold d-inline-flex align-items-center gap-1.5 shadow-sm"
                            style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669', padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                            onClick={() => setSelectedAdviceArticle(art)}
                          >
                            <span>👉</span> Lire la fiche conseil <span style={{ fontSize: '1rem' }}>›</span>
                          </button>
                        </div>
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
            
            <div className="mb-3">
              <label className="form-label fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Structure de santé *</label>
              <select className="form-select fw-semibold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.7rem 1rem', fontSize: '0.9rem' }}>
                <option value="1">Centre de Santé Gaspard Camara (Dakar)</option>
                <option value="2">Centre de Santé de Pikine</option>
                <option value="3">Hôpital Universitaire Fann</option>
                <option value="4">Centre Hospitalier Abass Ndao</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="form-label fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>Date souhaitée pour la consultation *</label>
              <div className="input-group">
                <input 
                  type="date" 
                  className="form-control fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px 0 0 12px', padding: '0.7rem 1rem', fontSize: '0.95rem' }} 
                  value={bookingDate} 
                  onChange={(e) => setBookingDate(e.target.value)} 
                  required 
                />
                <button 
                  type="button" 
                  className="btn btn-outline-success fw-bold d-flex align-items-center gap-1.5 px-3"
                  style={{ borderRadius: '0 12px 12px 0' }}
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling;
                    if (input && input.showPicker) input.showPicker();
                  }}
                >
                  <span>📅</span> Calendrier
                </button>
              </div>
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
                <label className="form-label small fw-bold">Date de consultation *</label>
                <div className="input-group input-group-sm">
                  <input type="text" className="form-control fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px 0 0 10px' }} value={newCpnForm.date} onChange={(e) => setNewCpnForm({ ...newCpnForm, date: e.target.value })} placeholder="ex: 15/09/2026" required />
                  <input 
                    type="date" 
                    id="add-cpn-native-picker" 
                    style={{ display: 'none' }} 
                    onChange={(e) => {
                      if (e.target.value) {
                        const parts = e.target.value.split('-');
                        const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
                        setNewCpnForm({ ...newCpnForm, date: formatted });
                      }
                    }} 
                  />
                  <button 
                    type="button" 
                    className="btn btn-outline-success fw-bold"
                    style={{ borderRadius: '0 10px 10px 0' }}
                    onClick={() => {
                      const picker = document.getElementById('add-cpn-native-picker');
                      if (picker && picker.showPicker) picker.showPicker();
                    }}
                    title="Ouvrir le calendrier"
                  >
                    📅
                  </button>
                </div>
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

      {/* MODALE ÉDITION CONSTANTES VITALES (médecin / sage-femme / superadmin) */}
      {showVitalsModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <form onSubmit={handleSaveVitals} style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">📈 Mettre à jour les constantes vitales</h5>
              <button type="button" className="btn-close" onClick={() => setShowVitalsModal(false)}></button>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Poids (ex: 64.5 kg) *</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                value={vitalsForm.weight} 
                onChange={e => setVitalsForm({ ...vitalsForm, weight: e.target.value })} 
                required 
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Évolution mensuelle (ex: +2.1kg / mois) *</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                value={vitalsForm.weightGain} 
                onChange={e => setVitalsForm({ ...vitalsForm, weightGain: e.target.value })} 
                required 
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Tension artérielle (ex: 12/8) *</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                value={vitalsForm.bloodPressure} 
                onChange={e => setVitalsForm({ ...vitalsForm, bloodPressure: e.target.value })} 
                required 
              />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Statut tensionnel *</label>
              <select 
                className="form-select" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                value={vitalsForm.bpStatus} 
                onChange={e => setVitalsForm({ ...vitalsForm, bpStatus: e.target.value })}
              >
                <option value="Normal">Normal</option>
                <option value="À surveiller">À surveiller</option>
                <option value="Élevée (Hypertension)">Élevée (Hypertension)</option>
              </select>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowVitalsModal(false)}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold text-white">💾 Enregistrer les constantes</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE ENREGISTRER VACCINATION PEV (médecin / sage-femme / superadmin) */}
      {showAddVaccineModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <form onSubmit={handleAddVaccine} style={{ maxWidth: '620px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-4">💉</span>
                <div>
                  <h5 className="fw-extrabold text-success mb-0" style={{ fontSize: '1.2rem' }}>Enregistrer une vaccination PEV</h5>
                  <small className="text-muted" style={{ fontSize: '0.8rem' }}>Programme Élargi de Vaccination du Sénégal (0-12 mois)</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddVaccineModal(false)}></button>
            </div>

            {/* BANNIÈRE PROFIL BÉBÉ & CALCUL D'ÂGE AUTOMATIQUE (DESIGN ÉMERAUD & GLASSMORPHISM) */}
            <div className="p-3.5 rounded-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3" 
                 style={{ 
                   background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(15, 23, 42, 0.55) 100%)', 
                   border: '1.5px solid rgba(16, 185, 129, 0.4)', 
                   borderRadius: '20px',
                   boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                 }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)'
                }}>
                  👶
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 mb-0.5">
                    <span className="small text-muted fw-bold" style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bébé rattaché</span>
                    <span className="badge bg-success-subtle text-success px-2 py-0.5 fw-bold" style={{ borderRadius: '6px', fontSize: '0.7rem' }}>🟢 Profil certifié</span>
                  </div>
                  <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {babyProfile.name}
                  </h6>
                  <small className="text-muted" style={{ fontSize: '0.82rem' }}>
                    🗓️ Né le <strong className="text-success">{new Date(babyProfile.birthDate).toLocaleDateString('fr-FR')}</strong> (Date de naissance enregistrée)
                  </small>
                </div>
              </div>

              <div className="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-3 text-white fw-bold shadow-sm"
                   style={{ 
                     background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
                     borderRadius: '14px', 
                     fontSize: '0.85rem',
                     border: '1px solid rgba(255,255,255,0.2)'
                   }}>
                <span>⚡</span>
                <span>Âge calculé automatique : <strong>{calculateBabyAge(babyProfile.birthDate)}</strong></span>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold">Échéance vaccinale / Âge (calculé) *</label>
                <input type="text" className="form-control fw-semibold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newVaccineForm.ageLabel} onChange={e => setNewVaccineForm({ ...newVaccineForm, ageLabel: e.target.value })} required placeholder="ex: 10 Semaines (2 mois & demi)" />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold">Statut PEV *</label>
                <select className="form-select fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newVaccineForm.status} onChange={e => setNewVaccineForm({ ...newVaccineForm, status: e.target.value, completed: e.target.value.includes('Administré') })}>
                  <option value="Administré (100% CSU)">✅ Administré (100% CSU)</option>
                  <option value="À venir (Mois prochain)">⏳ À venir (Mois prochain)</option>
                  <option value="Programmé">🗓️ Programmé</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Vaccins administrés *</label>
              <input type="text" className="form-control fw-bold text-success" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newVaccineForm.vaccines} onChange={e => setNewVaccineForm({ ...newVaccineForm, vaccines: e.target.value })} required placeholder="ex: Penta 2 + VPO 2 + Rota 2 + Pneumo 2" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Sous-titre / Type de dose (ex: Rappel de 2ème dose)</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newVaccineForm.subtext || ''} onChange={e => setNewVaccineForm({ ...newVaccineForm, subtext: e.target.value })} placeholder="ex: Rappel de 2ème dose / 4 vaccins combinés" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Maladies protégées</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newVaccineForm.diseases || ''} onChange={e => setNewVaccineForm({ ...newVaccineForm, diseases: e.target.value })} placeholder="ex: Diphtérie, tétanos, coqueluche, méningite..." />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Structure de santé agréée *</label>
              <input type="text" className="form-control fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newVaccineForm.structure} onChange={e => setNewVaccineForm({ ...newVaccineForm, structure: e.target.value })} required placeholder="ex: Centre Hospitalier Abass Ndao" />
            </div>

            <div className="d-flex justify-content-end gap-2.5 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn px-4 py-2.5 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => setShowAddVaccineModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-2.5 fw-bold text-white shadow-sm" style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px', fontSize: '0.9rem' }}>💾 Enregistrer la vaccination</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE MODIFIER VACCINATION PEV */}
      {editingVaccineId && editVaccineForm && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <form onSubmit={handleSaveEditVaccine} style={{ maxWidth: '620px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-4">✏️</span>
                <div>
                  <h5 className="fw-extrabold text-success mb-0" style={{ fontSize: '1.2rem' }}>Modifier la dose de vaccination</h5>
                  <small className="text-muted" style={{ fontSize: '0.8rem' }}>Modification des informations de la fiche vaccinale PEV</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => { setEditingVaccineId(null); setEditVaccineForm(null); }}></button>
            </div>

            {/* BANNIÈRE PROFIL BÉBÉ & CALCUL D'ÂGE AUTOMATIQUE (DESIGN ÉMERAUD & GLASSMORPHISM) */}
            <div className="p-3.5 rounded-4 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3" 
                 style={{ 
                   background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(15, 23, 42, 0.55) 100%)', 
                   border: '1.5px solid rgba(16, 185, 129, 0.4)', 
                   borderRadius: '20px',
                   boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                 }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)'
                }}>
                  👶
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2 mb-0.5">
                    <span className="small text-muted fw-bold" style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bébé rattaché</span>
                    <span className="badge bg-success-subtle text-success px-2 py-0.5 fw-bold" style={{ borderRadius: '6px', fontSize: '0.7rem' }}>🟢 Profil certifié</span>
                  </div>
                  <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                    {babyProfile.name}
                  </h6>
                  <small className="text-muted" style={{ fontSize: '0.82rem' }}>
                    🗓️ Né le <strong className="text-success">{new Date(babyProfile.birthDate).toLocaleDateString('fr-FR')}</strong> (Date de naissance enregistrée)
                  </small>
                </div>
              </div>

              <div className="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-3 text-white fw-bold shadow-sm"
                   style={{ 
                     background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', 
                     borderRadius: '14px', 
                     fontSize: '0.85rem',
                     border: '1px solid rgba(255,255,255,0.2)'
                   }}>
                <span>⚡</span>
                <span>Âge calculé automatique : <strong>{calculateBabyAge(babyProfile.birthDate)}</strong></span>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold">Échéance / Âge *</label>
                <input type="text" className="form-control fw-semibold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={editVaccineForm.ageLabel} onChange={e => setEditVaccineForm({ ...editVaccineForm, ageLabel: e.target.value })} required />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold">Statut PEV *</label>
                <select className="form-select fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={editVaccineForm.status} onChange={e => setEditVaccineForm({ ...editVaccineForm, status: e.target.value, completed: e.target.value.includes('Administré') })}>
                  <option value="Administré (100% CSU)">✅ Administré (100% CSU)</option>
                  <option value="À venir (Mois prochain)">⏳ À venir (Mois prochain)</option>
                  <option value="Programmé">🗓️ Programmé</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Vaccins administrés *</label>
              <input type="text" className="form-control fw-bold text-success" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={editVaccineForm.vaccines} onChange={e => setEditVaccineForm({ ...editVaccineForm, vaccines: e.target.value })} required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Sous-titre / Type de dose (ex: Rappel de 2ème dose)</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={editVaccineForm.subtext || ''} onChange={e => setEditVaccineForm({ ...editVaccineForm, subtext: e.target.value })} placeholder="ex: Rappel de 2ème dose" />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Maladies protégées</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={editVaccineForm.diseases || ''} onChange={e => setEditVaccineForm({ ...editVaccineForm, diseases: e.target.value })} placeholder="ex: Diphtérie, tétanos, coqueluche..." />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Structure agréée *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={editVaccineForm.structure} onChange={e => setEditVaccineForm({ ...editVaccineForm, structure: e.target.value })} required />
            </div>

            <div className="d-flex justify-content-end gap-2.5 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn px-4 py-2.5 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => { setEditingVaccineId(null); setEditVaccineForm(null); }}>Annuler</button>
              <button type="submit" className="btn px-4 py-2.5 fw-bold text-white shadow-sm" style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px', fontSize: '0.9rem' }}>💾 Enregistrer les modifications</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 1: 🚨 URGENCE OBSTÉTRIQUALE & SIGNES DE DANGER (SAMU 1515) */}
      {showDangerSOSModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(14px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: '640px', width: '100%', background: '#0f172a', color: '#ffffff', borderRadius: '24px', padding: '2.25rem', border: '2px solid #ef4444', boxShadow: '0 25px 60px rgba(239, 68, 68, 0.45)', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(239,68,68,0.25)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
                  🚨
                </div>
                <div>
                  <h5 className="fw-extrabold text-white mb-0" style={{ fontSize: '1.25rem' }}>Protocole d'urgence & signes de danger</h5>
                  <small style={{ color: '#fca5a5', fontSize: '0.82rem' }}>Service d'Aide Médicale Urgente du Sénégal (SAMU 1515)</small>
                </div>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowDangerSOSModal(false)}></button>
            </div>

            <div className="p-3.5 rounded-3 mb-4" style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', fontSize: '0.88rem', lineHeight: '1.55' }}>
              <span className="fw-bold d-block text-white mb-1">⚠️ AVERTISSEMENT MÉDICAL URGENT :</span>
              Si la femme enceinte présente l'un des symptômes ci-dessous, elle doit se rendre immédiatement dans la maternité la plus proche. La prise en charge d'urgence est couverte à 100% par l'UNAMUSC.
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold text-white">Sélectionnez le signe de danger constaté :</label>
              <div className="d-flex flex-column gap-2">
                {[
                  '🔴 Saignements vaginaux pendant la grossesse',
                  '🔥 Fièvre élevée (> 38.5°C) ou frissons',
                  '🧠 Maux de tête intenses / Bourdonnements d\'oreilles / Mouches volantes',
                  '🌊 Rupture de la poche des eaux (Perte de liquide)',
                  '👶 Absence ou diminution des mouvements du bébé',
                  '⚡ Douleurs abdominales intenses ou contractions fréquentes'
                ].map((sign, idx) => (
                  <button 
                    key={idx} 
                    type="button" 
                    className="btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between"
                    style={{ 
                      background: selectedDangerSign === sign ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.06)', 
                      color: '#ffffff', 
                      border: selectedDangerSign === sign ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.12)',
                      fontSize: '0.88rem'
                    }}
                    onClick={() => setSelectedDangerSign(sign)}
                  >
                    <span>{sign}</span>
                    <span className="badge bg-danger text-white">{selectedDangerSign === sign ? 'Sélectionné' : 'Signaler'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="d-flex flex-column gap-2.5 pt-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
              <a 
                href="tel:1515" 
                className="btn btn-lg fw-extrabold text-white d-flex align-items-center justify-content-center gap-2 shadow"
                style={{ background: '#dc2626', borderColor: '#b91c1c', borderRadius: '14px', fontSize: '1.05rem', padding: '0.85rem' }}
              >
                <span>📞</span> APPLER LE SAMU SÉNÉGAL (1515) — APPEL GRATUIT
              </a>

              <div className="d-flex gap-2">
                <button 
                  type="button" 
                  className="btn btn-outline-light w-50 fw-bold d-flex align-items-center justify-content-center gap-1.5"
                  style={{ borderRadius: '12px', fontSize: '0.84rem' }}
                  onClick={() => {
                    const spokenMsg = `Alerte Urgence Maternité ! Signe constaté : ${selectedDangerSign}. VEUILLEZ VOUS RENDRE IMMÉDIATEMENT À LA MATERNITÉ DE L'HÔPITAL ABASS NDAO OU DU CHU DE FANN. Prise en charge cent pour cent gratuite UNAMUSC.`;
                    playSpeechAudio(spokenMsg);
                  }}
                >
                  <span>🔊</span> Consignes audio (Wolof / FR)
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary w-50"
                  style={{ borderRadius: '12px', fontSize: '0.84rem' }}
                  onClick={() => setShowDangerSOSModal(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE 2: 💊 MODIFIER SUPPLÉMENTATION MATERNELLE & TPI-SP PALUDISME */}
      {showSupplementsModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <form onSubmit={handleSaveSupplements} style={{ maxWidth: '580px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3.5 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-4">💊</span>
                <div>
                  <h5 className="fw-extrabold text-success mb-0" style={{ fontSize: '1.2rem' }}>Mettre à jour la supplémentation & TPI</h5>
                  <small className="text-muted" style={{ fontSize: '0.8rem' }}>Directives PNLP Sénégal & UNAMUSC</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowSupplementsModal(false)}></button>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Jours de Fer & Acide Folique pris *</label>
              <div className="input-group">
                <input 
                  type="number" 
                  className="form-control fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px 0 0 12px', padding: '0.65rem 0.9rem' }} 
                  value={editSupplementsForm.ferFolateDaysTaken} 
                  onChange={e => setEditSupplementsForm({ ...editSupplementsForm, ferFolateDaysTaken: parseInt(e.target.value) || 0 })} 
                  required 
                />
                <span className="input-group-text" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '0 12px 12px 0' }}>sur 90 jours requis</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-2">Statut des Doses TPI-SP Paludisme (Sulfadoxine-Pyriméthamine) :</label>
              {editSupplementsForm.tpiDoses.map((dose, idx) => (
                <div key={dose.id} className="p-2.5 rounded-3 mb-2 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <span className="small fw-bold" style={{ color: 'var(--text-main)' }}>{dose.cpn}</span>
                  <label className="d-flex align-items-center gap-2 small cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={dose.given} 
                      onChange={e => {
                        const newTpi = [...editSupplementsForm.tpiDoses];
                        newTpi[idx].given = e.target.checked;
                        newTpi[idx].status = e.target.checked ? `Administré (Dose ${idx + 1})` : `Programmé (Dose ${idx + 1})`;
                        setEditSupplementsForm({ ...editSupplementsForm, tpiDoses: newTpi });
                      }} 
                    />
                    <span className={dose.given ? 'text-success fw-bold' : 'text-warning fw-bold'}>
                      {dose.given ? '✅ Administré' : '⏳ Non administré'}
                    </span>
                  </label>
                </div>
              ))}
            </div>

            <div className="form-check form-switch mb-4">
              <input 
                className="form-check-input" 
                type="checkbox" 
                id="mildaCheck" 
                checked={editSupplementsForm.mildaNetDistributed} 
                onChange={e => setEditSupplementsForm({ ...editSupplementsForm, mildaNetDistributed: e.target.checked })} 
                style={{ width: '2.5rem', height: '1.25rem', cursor: 'pointer' }} 
              />
              <label className="form-check-label ms-2 small fw-bold" htmlFor="mildaCheck" style={{ color: 'var(--text-main)', cursor: 'pointer' }}>
                Moustiquaire MILDA remise à la mère au 1er trimestre (Gratuité 100% UNAMUSC)
              </label>
            </div>

            <div className="d-flex justify-content-end gap-2.5 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn px-4 py-2.5 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => setShowSupplementsModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-2.5 fw-bold text-white shadow-sm" style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px', fontSize: '0.9rem' }}>💾 Enregistrer la supplémentation</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 3: 📊 CONSIGNER UNE PESÉE / TAILLE BÉBÉ (COURBE OMS) */}
      {showAddGrowthModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <form onSubmit={handleAddGrowthEntry} style={{ maxWidth: '580px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3.5 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-4">📊</span>
                <div>
                  <h5 className="fw-extrabold text-success mb-0" style={{ fontSize: '1.2rem' }}>Consigner une pesée & taille (OMS)</h5>
                  <small className="text-muted" style={{ fontSize: '0.8rem' }}>Suivi de la courbe de croissance du bébé {babyProfile.name}</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddGrowthModal(false)}></button>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold">Échéance mensuelle *</label>
                <input type="text" className="form-control fw-semibold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newGrowthForm.month} onChange={e => setNewGrowthForm({ ...newGrowthForm, month: e.target.value })} required placeholder="ex: 3ème Mois (M3)" />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold">Date de la pesée *</label>
                <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newGrowthForm.date} onChange={e => setNewGrowthForm({ ...newGrowthForm, date: e.target.value })} required />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label small fw-bold">Poids (kg) *</label>
                <input type="number" step="0.1" className="form-control fw-bold text-success" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newGrowthForm.weight} onChange={e => setNewGrowthForm({ ...newGrowthForm, weight: e.target.value })} required placeholder="ex: 6.0" />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">Taille (cm) *</label>
                <input type="number" step="0.5" className="form-control fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newGrowthForm.height} onChange={e => setNewGrowthForm({ ...newGrowthForm, height: e.target.value })} required placeholder="ex: 61" />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold">Périmètre crânien *</label>
                <input type="number" step="0.5" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newGrowthForm.head} onChange={e => setNewGrowthForm({ ...newGrowthForm, head: e.target.value })} required placeholder="ex: 40.5" />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold">Statut de croissance OMS *</label>
              <select className="form-select fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={newGrowthForm.status} onChange={e => setNewGrowthForm({ ...newGrowthForm, status: e.target.value })}>
                <option value="Harmonieuse (Percentile 50)">🟢 Harmonieuse (Percentile 50)</option>
                <option value="Excellente (Percentile 75)">🟢 Excellente (Percentile 75)</option>
                <option value="À surveiller (Percentile 15)">⚠️ À surveiller (Percentile 15)</option>
              </select>
            </div>

            <div className="d-flex justify-content-end gap-2.5 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn px-4 py-2.5 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => setShowAddGrowthModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-2.5 fw-bold text-white shadow-sm" style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px', fontSize: '0.9rem' }}>💾 Enregistrer la pesée</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE UNIVERSELLE DE SUPPRESSION (RED GLASSMORPHISM) */}
      <DeleteModal 
        isOpen={!!deleteConfirmTarget}
        title={deleteConfirmTarget?.title}
        itemType={deleteConfirmTarget?.itemType}
        onConfirm={deleteConfirmTarget?.onConfirm}
        onClose={() => setDeleteConfirmTarget(null)}
      />

      {/* MODALE ÉDITION PROFIL BÉBÉ & CONFIGURATION CONTACT RAPPELS */}
      {showBabyModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <form onSubmit={handleSaveBabyProfile} style={{ maxWidth: '620px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3.5 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-2">
                <span className="fs-4">👶</span>
                <div>
                  <h5 className="fw-extrabold text-success mb-0" style={{ fontSize: '1.2rem' }}>Profil Bébé & Contact Assurée</h5>
                  <small className="text-muted" style={{ fontSize: '0.8rem' }}>Calcul automatique d'âge et système de rappels automatiques</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowBabyModal(false)}></button>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Nom complet du bébé *</label>
              <input type="text" className="form-control fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={babyForm.name} onChange={e => setBabyForm({ ...babyForm, name: e.target.value })} required />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Date de naissance du bébé *</label>
              <input type="date" className="form-control fw-semibold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={babyForm.birthDate} onChange={e => setBabyForm({ ...babyForm, birthDate: e.target.value })} required />
              
              <div className="mt-2 p-2.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <span className="small text-success fw-bold">⚡ Calcul automatique d'âge en temps réel :</span>
                <span className="badge bg-success text-white fw-bold px-3 py-1.5 fs-6">{calculateBabyAge(babyForm.birthDate)}</span>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold">Nom de la mère / assurée *</label>
                <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={babyForm.motherName} onChange={e => setBabyForm({ ...babyForm, motherName: e.target.value })} required />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold">N° Téléphone Rappels (SMS & WhatsApp) *</label>
                <input type="text" className="form-control fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={babyForm.motherPhone} onChange={e => setBabyForm({ ...babyForm, motherPhone: e.target.value })} required placeholder="+221 77 450 88 99" />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold">Canal de relance privilégié</label>
              <select className="form-select fw-semibold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 0.9rem' }} value={babyForm.reminderChannel} onChange={e => setBabyForm({ ...babyForm, reminderChannel: e.target.value })}>
                <option value="SMS & WhatsApp 💬">💬 SMS & WhatsApp (Recommandé)</option>
                <option value="SMS uniquement 📱">📱 SMS uniquement</option>
                <option value="Relance vocale Wolof 🔊">🔊 Relance vocale automatique (Wolof)</option>
                <option value="Relance vocale Français 🔊">🔊 Relance vocale automatique (Français)</option>
              </select>
            </div>

            <div className="form-check form-switch mb-4">
              <input className="form-check-input" type="checkbox" id="autoRemindersCheck" checked={babyForm.autoReminders} onChange={e => setBabyForm({ ...babyForm, autoReminders: e.target.checked })} style={{ width: '2.5rem', height: '1.25rem', cursor: 'pointer' }} />
              <label className="form-check-label ms-2 small fw-bold" htmlFor="autoRemindersCheck" style={{ color: 'var(--text-main)', cursor: 'pointer' }}>
                Activer les relances automatiques H-48 avant chaque RDV (Vaccins PEV & CPN)
              </label>
            </div>

            <div className="d-flex justify-content-end gap-2.5 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn px-4 py-2.5 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => setShowBabyModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-2.5 fw-bold text-white shadow-sm" style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px', fontSize: '0.9rem' }}>💾 Enregistrer le profil & rappels</button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
}
