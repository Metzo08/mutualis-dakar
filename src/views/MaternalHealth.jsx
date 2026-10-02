import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import DeleteModal from '../components/DeleteModal';
import { playHybridVoiceReminder, playEmergencyVoiceInstruction, speakCleanText } from '../services/voiceAudioService';

// Design Premium Haut de Gamme — Carnet Maternité & Santé Enfant

// 🧠 Moteur d'Intelligence Médicale : Sélection Dynamique d'Image de Fond selon la Pathologie de l'Assuré
const getMedicalHeroStyle = (patient) => {
  if (!patient) {
    return {
      bgImage: '/csu_digital_health_real.jpg',
      heroBg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat',
      badgeColor: '#059669',
      badgeText: '🇸🇳 Espace prise en charge 100% CSU',
      imageTag: '🏥 Imagerie médicale - général',
      icon: '🏥'
    };
  }

  const path = (patient.pathology || '').toLowerCase();
  const cat = (patient.category || '').toLowerCase();

  // 🦴 1. Traumatologie, Fracture, Fémur, Orthopédie, Chirurgie, Os
  if (path.includes('fracture') || path.includes('trauma') || path.includes('fémur') || path.includes('os') || path.includes('orthopéd') || cat === 'surgery') {
    return {
      bgImage: '/dicom_bone_fracture.jpg',
      heroBg: 'linear-gradient(135deg, rgba(180, 83, 9, 0.88) 0%, rgba(15, 23, 42, 0.92) 100%), url("/dicom_bone_fracture.jpg") center/cover no-repeat',
      badgeColor: '#d97706',
      badgeText: '🇸🇳 Espace traumatologie & chirurgie orthopédique UNAMUSC',
      imageTag: '🦴 Imagerie scanner / radiographie osseuse (traumatologie - fracture fémur)',
      icon: '🩹'
    };
  }

  // 🫁 2. Pneumologie, BPCO, Broncho-Pneumopathie, Poumon
  if (path.includes('pneumo') || path.includes('bpco') || path.includes('broncho') || path.includes('poumon')) {
    return {
      bgImage: '/dicom_chest_xray.jpg',
      heroBg: 'linear-gradient(135deg, rgba(14, 116, 144, 0.88) 0%, rgba(15, 23, 42, 0.92) 100%), url("/dicom_chest_xray.jpg") center/cover no-repeat',
      badgeColor: '#0891b2',
      badgeText: '🇸🇳 Espace pneumologie & affections respiratoires ALD',
      imageTag: '🫁 Imagerie radiographie pulmonaire (pneumologie - BPCO)',
      icon: '🫁'
    };
  }

  // 🫀 3. HTA, Cardiologie, Tension, Cœur
  if (path.includes('hta') && !path.includes('diabète')) {
    return {
      bgImage: '/bg_health_heart.png',
      heroBg: 'linear-gradient(135deg, rgba(220, 38, 38, 0.88) 0%, rgba(15, 23, 42, 0.92) 100%), url("/bg_health_heart.png") center/cover no-repeat',
      badgeColor: '#dc2626',
      badgeText: '🇸🇳 Espace cardiologie & hypertension artérielle (ALD 100%)',
      imageTag: '🫀 Bilan cardiovasculaire & électrocardiogramme ECG',
      icon: '🫀'
    };
  }

  // 🩸 4. Diabète, Glycémie, HbA1c (Seul ou combiné HTA)
  if (path.includes('diabète') || path.includes('glycém') || path.includes('hba1c') || cat === 'chronic') {
    return {
      bgImage: '/dicom_blood_test.jpg',
      heroBg: 'linear-gradient(135deg, rgba(185, 28, 28, 0.88) 0%, rgba(15, 23, 42, 0.92) 100%), url("/dicom_blood_test.jpg") center/cover no-repeat',
      badgeColor: '#dc2626',
      badgeText: '🇸🇳 Espace prise en charge 100% CSU — Affection de longue durée (ALD)',
      imageTag: '🩸 Bilan biologique semestriel (HbA1c & glycémie à jeun)',
      icon: '🩸'
    };
  }

  // 👶 5. Pédiatrie, Enfant, PEV, Vaccination
  if (cat === 'pediatric' || path.includes('pédiatr') || path.includes('enfant') || path.includes('pev')) {
    return {
      bgImage: '/csu_kids_real.png',
      heroBg: 'linear-gradient(135deg, rgba(29, 78, 216, 0.88) 0%, rgba(16, 185, 129, 0.25) 100%), url("/csu_kids_real.png") center/cover no-repeat',
      badgeColor: '#2563eb',
      badgeText: '🇸🇳 Espace pédiatrique & programme élargi de vaccination (PEV)',
      imageTag: '👶 Carnet de santé pédiatrique & vaccins 0-5 ans',
      icon: '👶'
    };
  }

  // 🤰 6. Maternité, Grossesse, CPN
  return {
    bgImage: '/maternal_nutrition_food.jpg',
    heroBg: 'linear-gradient(135deg, rgba(5, 150, 105, 0.85) 0%, rgba(15, 23, 42, 0.9) 100%), url("/maternal_nutrition_food.jpg") center/cover no-repeat',
    badgeColor: '#059669',
    badgeText: '🇸🇳 Espace premium santé maternelle UNAMUSC',
    imageTag: '🤰 Suivi prénatal CPN & échographie obstétrique',
    icon: '🤰'
  };
};


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

  // 🛡️ État Surveillance ALD (Diabète/HTA) — CRUD complet (Créer / Modifier / Supprimer)
  const [aldSurveillanceItems, setAldSurveillanceItems] = useState(() => {
    const saved = localStorage.getItem('maternity_ald_surveillance');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, title: "👁️ Fond d'œil annuel (rétinopathie)", status: "✅ Normal", date: "10/04/2026" },
      { id: 2, title: "👣 Examen pied diabétique (monofilament)", status: "✅ Pas de lésion", date: "10/04/2026" },
      { id: 3, title: "🫀 ECG & fonction rénale (microalbuminurie)", status: "✅ Effectué", date: "12/05/2026" }
    ];
  });

  const [showAldModal, setShowAldModal] = useState(false);
  const [editingAldItem, setEditingAldItem] = useState(null);

  const handleSaveAldItem = (e) => {
    e.preventDefault();
    if (!editingAldItem || !editingAldItem.title) return;
    let updated;
    if (editingAldItem.id) {
      updated = aldSurveillanceItems.map(item => item.id === editingAldItem.id ? editingAldItem : item);
    } else {
      updated = [...aldSurveillanceItems, { ...editingAldItem, id: Date.now() }];
    }
    setAldSurveillanceItems(updated);
    localStorage.setItem('maternity_ald_surveillance', JSON.stringify(updated));
    setShowAldModal(false);
    setEditingAldItem(null);
  };

  const handleDeleteAldItem = (id) => {
    setConfirmDeleteObj({
      title: "cet examen de surveillance ALD",
      onConfirm: () => {
        const updated = aldSurveillanceItems.filter(item => item.id !== id);
        setAldSurveillanceItems(updated);
        localStorage.setItem('maternity_ald_surveillance', JSON.stringify(updated));
      }
    });
  };

  // 🩹 État Protocole Post-Opératoire (Chirurgie/Orthopédie) — CRUD complet (Créer / Modifier / Supprimer)
  const [postOpProtocolItems, setPostOpProtocolItems] = useState(() => {
    const saved = localStorage.getItem('maternity_postop_protocol');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, title: "🩹 Pansements stériles J+3 à J+14", status: "✅ Fait", date: "25/05/2026" },
      { id: 2, title: "🧵 Ablation des fils / agrafes J+14", status: "✅ Ablation faite", date: "03/06/2026" },
      { id: 3, title: "🩼 Rééducation & Appui soulagé", status: "⏳ En cours (Session 3/10)", date: "15/06/2026" }
    ];
  });

  const [showPostOpModal, setShowPostOpModal] = useState(false);
  const [editingPostOpItem, setEditingPostOpItem] = useState(null);

  const handleSavePostOpItem = (e) => {
    e.preventDefault();
    if (!editingPostOpItem || !editingPostOpItem.title) return;
    let updated;
    if (editingPostOpItem.id) {
      updated = postOpProtocolItems.map(item => item.id === editingPostOpItem.id ? editingPostOpItem : item);
    } else {
      updated = [...postOpProtocolItems, { ...editingPostOpItem, id: Date.now() }];
    }
    setPostOpProtocolItems(updated);
    localStorage.setItem('maternity_postop_protocol', JSON.stringify(updated));
    setShowPostOpModal(false);
    setEditingPostOpItem(null);
  };

  const handleDeletePostOpItem = (id) => {
    setConfirmDeleteObj({
      title: "cet élément du protocole post-opératoire",
      onConfirm: () => {
        const updated = postOpProtocolItems.filter(item => item.id !== id);
        setPostOpProtocolItems(updated);
        localStorage.setItem('maternity_postop_protocol', JSON.stringify(updated));
      }
    });
  };

  // 💊 État Ordonnances ALD (Diabète/HTA) — CRUD complet (Créer / Modifier / Supprimer)
  const [aldPrescriptions, setAldPrescriptions] = useState(() => {
    const saved = localStorage.getItem('maternity_ald_prescriptions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, name: 'Metformine 1000 mg', form: 'Comprimés sécables', specialty: '🩸 Diabétologie', dosage: '1 comprimé matin et soir au milieu des repas', coverage: '✅ 100% CSU Gratuit' },
      { id: 2, name: 'Amlodipine 10 mg', form: 'Gélules quotidiennes', specialty: '🫀 Cardiologie / HTA', dosage: '1 comprimé le matin au réveil', coverage: '✅ 100% CSU Gratuit' },
      { id: 3, name: 'Glimepiride 2 mg', form: 'Sulfamide hypoglycémiant', specialty: '🩸 Diabétologie', dosage: '1 comprimé avant le petit-déjeuner', coverage: '✅ 100% CSU Gratuit' },
      { id: 4, name: 'Lecteur & Bandelettes Glycémiques', form: 'Auto-surveillance à domicile', specialty: '🔬 Auto-Contrôle', dosage: '100 bandelettes + lancettes par mois', coverage: '✅ 100% CSU Gratuit' }
    ];
  });

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState(null);

  const handleSavePrescription = (e) => {
    e.preventDefault();
    if (!editingPrescription || !editingPrescription.name) return;
    let updated;
    if (editingPrescription.id) {
      updated = aldPrescriptions.map(p => p.id === editingPrescription.id ? editingPrescription : p);
    } else {
      updated = [...aldPrescriptions, { ...editingPrescription, id: Date.now() }];
    }
    setAldPrescriptions(updated);
    localStorage.setItem('maternity_ald_prescriptions', JSON.stringify(updated));
    setShowPrescriptionModal(false);
    setEditingPrescription(null);
  };

  const handleDeletePrescription = (id) => {
    setConfirmDeleteObj({
      title: "cette prescription de traitement ALD",
      onConfirm: () => {
        const updated = aldPrescriptions.filter(p => p.id !== id);
        setAldPrescriptions(updated);
        localStorage.setItem('maternity_ald_prescriptions', JSON.stringify(updated));
      }
    });
  };

  // 📈 État Constantes Vitales & Régime ALD — CRUD complet (Créer / Modifier / Supprimer)
  const [aldVitals, setAldVitals] = useState(() => {
    const saved = localStorage.getItem('maternity_ald_vitals');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, type: 'Glycémie à jeun', value: '1.25 g/L', target: 'Objectif < 1.26 g/L', date: '10/06/2026', status: '🟢 Dans la cible' },
      { id: 2, type: 'Tension Artérielle', value: '135 / 85 mmHg', target: 'Objectif < 140/90', date: '10/06/2026', status: '🟢 Contrôlée' },
      { id: 3, type: 'Poids / IMC', value: '74 kg (IMC 25.1)', target: 'Poids stable', date: '10/06/2026', status: '🟢 Conforme' },
      { id: 4, type: 'HbA1c Glyquée', value: '6.9%', target: 'Objectif < 7.0%', date: '12/05/2026', status: '🟢 Optimal' }
    ];
  });

  const [aldDietDirectives, setAldDietDirectives] = useState(() => {
    const saved = localStorage.getItem('maternity_ald_diet');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: 1, title: '🥗 Régime Hyposodé (< 5g sel/jour)', desc: 'Réduction de l\'apport en sel pour la protection vasculaire et la tension artérielle.', status: '✅ Actif' },
      { id: 2, title: '🍏 Régime Hypoglucidique ALD', desc: 'Gestion des sucres rapides et répartition des glucides complexes sur 3 repas.', status: '✅ Actif' },
      { id: 3, title: '🚶 Marche Quotidienne 30 min', desc: 'Activité physique adaptée 5 jours par semaine pour la sensibilité à l\'insuline.', status: '✅ Actif' }
    ];
  });

  const [showAldVitalModal, setShowAldVitalModal] = useState(false);
  const [editingAldVital, setEditingAldVital] = useState(null);

  const handleSaveAldVital = (e) => {
    e.preventDefault();
    if (!editingAldVital || !editingAldVital.type) return;
    let updated;
    if (editingAldVital.id) {
      updated = aldVitals.map(v => v.id === editingAldVital.id ? editingAldVital : v);
    } else {
      updated = [...aldVitals, { ...editingAldVital, id: Date.now() }];
    }
    setAldVitals(updated);
    localStorage.setItem('maternity_ald_vitals', JSON.stringify(updated));
    setShowAldVitalModal(false);
    setEditingAldVital(null);
  };

  const handleDeleteAldVital = (id) => {
    setConfirmDeleteObj({
      title: "cette constante vitale ALD",
      onConfirm: () => {
        const updated = aldVitals.filter(v => v.id !== id);
        setAldVitals(updated);
        localStorage.setItem('maternity_ald_vitals', JSON.stringify(updated));
      }
    });
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
      title: 'Attestation officielle d\'accouchement & gratuité maternité (100% UNAMUSC)',
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

  // Nettoyage strict du texte pour la synthèse vocale (évite la lecture de symboles, émojis et parenthèses)
  const cleanSpeechText = (rawText) => {
    if (!rawText) return '';
    let str = String(rawText);
    str = str.replace(/100%/g, 'cent pour cent')
             .replace(/%/g, ' pour cent')
             .replace(/[\(\)\[\]\{\}]/g, ' ')
             .replace(/[!?,;:\-\—•]/g, ' ')
             .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
             .replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ']/gi, ' ');
    return str.replace(/\s+/g, ' ').trim();
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

    // Voix naturelle via backend TTS (ElevenLabs/Open-Source) avec repli speechSynthesis
    speakCleanText(textToSpeak, audioLang || 'fr');
  };

  const triggerInstantReminder = (type = 'sms', langChoice = audioLang) => {
    setReminderSending(true);
    const nextPendingVaccine = vaccinations.find(v => !v.completed);
    const nextPendingCpn = cpnVisits.find(c => !c.completed);
    const targetPrestation = nextPendingVaccine ? `Vaccination PEV (${nextPendingVaccine.vaccines})` : (nextPendingCpn ? nextPendingCpn.title : 'Consultation de suivi post-natal');

    setTimeout(() => {
      setReminderSending(false);
      let msg = '';

      if (type === 'sms' || type === 'whatsapp') {
        msg = `📲 Notification SMS & WhatsApp délivrée à ${babyProfile.motherName} (${babyProfile.motherPhone}) : "Bonjour ${babyProfile.motherName}, rappel UNAMUSC : la prestation ${targetPrestation} pour votre bébé ${babyProfile.name} est programmée. Prise en charge 100% gratuite."`;
        playHybridVoiceReminder({
          lang: langChoice,
          motherName: babyProfile.motherName,
          babyName: babyProfile.name,
          customMessage: `Notification envoyée avec succès à ${babyProfile.motherName}`
        });
      } else {
        msg = `🔊 Relance vocale hybride (${langChoice.toUpperCase()}) en cours de lecture pour ${babyProfile.motherPhone}...`;
        playHybridVoiceReminder({
          lang: langChoice,
          motherName: babyProfile.motherName,
          babyName: babyProfile.name,
          prestation: targetPrestation
        });
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

  // ────────────────────────────────────────────────────────────────────
  //  AUCUN SUIVI DE GROSSESSE FABRIQUÉ.
  //  Ces 4 CPN annonçaient pour une patiente réelle : grossesse
  //  « évolutive 8 SA », hauteur utérine 21 cm, « bruit du cœur fœtal
  //  régulier 145 bpm », VAT 1 « réalisée », signées « Sage-femme Fatou
  //  Kiné Diop » et « Dr. Mariama Ba ». Ces examens de suivi n'ont jamais
  //  eu lieu. Un dossier de suivi généré depuis un prénom générique était lu
  //  comme un suivi réel, et les CPN « à venir » produisaient des rappels
  //  pour des dates arbitraires. Le calendrier de CPN se saisit ; il ne se
  //  pré-remplit pas.
  // ────────────────────────────────────────────────────────────────────
  const [cpnVisits, setCpnVisits] = useState([]);
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

  // Détection du sexe de l'assuré connecté (Femme vs Homme)
  const isMaleUser = (() => {
    if (citizenUser) {
      const g = (citizenUser.gender || citizenUser.sexe || '').toUpperCase();
      if (g === 'M' || g === 'HOMME' || g === 'MASCULIN') return true;
      if (g === 'F' || g === 'FEMME' || g === 'FEMININ') return false;
      const firstName = (citizenUser.firstName || citizenUser.first_name || '').toLowerCase();
      const maleNames = ['ibrahima', 'modou', 'amadou', 'moustapha', 'abdoulaye', 'cheikh', 'moussa', 'ousmane', 'mamadou', 'babacar', 'samba', 'aliou', 'boubacar', 'omar', 'pape', 'saliou', 'papa', 'el hadji', 'lamine'];
      return maleNames.some(n => firstName.includes(n));
    }
    return false;
  })();

  const [citizenSpecialtyTab, setCitizenSpecialtyTab] = useState(isMaleUser ? 'chronic' : 'maternity');

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
  const isLabUser    = userRole === 'lab' || userRole === 'biologist' || 
                       (partnerUser?.role && (partnerUser.role.toLowerCase().includes('laboratoire') || partnerUser.role.toLowerCase().includes('biologiste') || partnerUser.role.toLowerCase().includes('imagerie'))) ||
                       (partnerUser?.structureName && (partnerUser.structureName.toLowerCase().includes('pasteur') || partnerUser.structureName.toLowerCase().includes('laboratoire') || partnerUser.structureName.toLowerCase().includes('imagerie')));
  const isDoctor     = !isLabUser && (userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin')));
  const isMidwife    = !isLabUser && (userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage')));
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isSuperAdmin)) && !isSuperAdmin;
  const isPharmacist = !isLabUser && userRole === 'pharmacist';
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isLabUser && !isSuperAdmin && (!!citizenUser && (userRole === 'citizen' || userRole === 'citizen_suspended'));
  // Peut remplir/modifier le carnet de maternité
  const canEditMaternity = (isDoctor || isMidwife || isSuperAdmin) && !isLabUser;
  // Vue administrative (statistiques)
  const isAdminStatsView = isAgent && !isSuperAdmin;
  // Alias rétro-compatibilité
  const isDoctorOrAgent = canEditMaternity || isAgent;
  const overrideActive = (
    localStorage.getItem(`cmu-status-${citizenUser?.cmuNumber || citizenUser?.cmu_number}`) === 'active' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen'
  );

  const isSuspended = !overrideActive && (
    userRole === 'citizen_suspended' ||
    citizenUser?.status === 'suspended' ||
    citizenUser?.status === 'inactif' ||
    citizenUser?.status === 'suspendu' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  const [registryPage, setRegistryPage] = useState(1);

  // ═══════════════════════════════════════════════════════
  // Registre de maternité — grossesses RÉELLEMENT suivies
  // ═══════════════════════════════════════════════════════
  // Aucune grossesse n'est inventée. Le registre ne contient que les
  // suivis prénatals réellement créés par une sage-femme ou un médecin
  // (persistés dans le poste). Un registre vide est un registre honnête :
  // afficher des grossesses, termes et dates d'accouchement fictifs pour
  // des patientes réelles serait un risque sanitaire majeur.
  const MATERNAL_STORE_KEY = 'cmu-maternal-registry';
  const [maternalRegistry, setMaternalRegistry] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(MATERNAL_STORE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  });

  // Registre des Patients & Dossiers Médicaux de l'Établissement (Hôpital Principal / Établissement de Santé)

  const [selectedMotherId, setSelectedMotherId] = useState(1);
  const dmpSectionRef = useRef(null);

  const handleSelectMother = (motherId) => {
    setSelectedMotherId(motherId);
    setTimeout(() => {
      if (dmpSectionRef.current) {
        dmpSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };
  const [searchMotherQuery, setSearchMotherQuery] = useState('');
  const [registryCategoryFilter, setRegistryCategoryFilter] = useState('all'); // 'all', 'maternity', 'chronic', 'pediatric', 'surgery'
  const [editingMother, setEditingMother] = useState(null);
  const [isNewMother, setIsNewMother] = useState(false);

  // Dossier de la patiente / patient connecté.
  // Aucune pathologie, aucun praticien, aucune date ne sont inventés : on
  // affiche les données réellement connues (identité issues du compte) et on
  // laisse le champ clinique vide tant qu'aucun suivi n'a été saisi.
  const activeMother = (isCitizen && citizenUser) ? {
    id: 999,
    name: activeFullName,
    gender: isMaleUser ? 'M' : 'F',
    age: citizenUser?.age || '—',
    phone: citizenUser?.phone || '—',
    cmuNumber: activeCmuNumber || '—',
    category: citizenSpecialtyTab,
    pathology: 'Aucun suivi enregistré',
    edd: '—',
    facility: citizenUser?.mutuelleName || '—',
    doctorRef: '—',
    status: 'none',
    lastConsultation: '—'
  } : (maternalRegistry.find(m => m.id === selectedMotherId)
    // Aucun registre réel pour cette patiente : on ne fabrique NI patiente NI
    // grossesse. Le dossier reste vide — afficher « 32 SA / CPN 3 » ou
    // « Dr. Ousmane Sow » pour une patiente réelle serait un faux dossier.
    || {
      name: activeFullName || 'Patiente non enregistrée',
      cmuNumber: activeCmuNumber || '—',
      gestationalAge: 'Aucune grossesse suivie',
      phone: citizenUser?.phone || '—',
      pathology: 'Aucun suivi enregistré',
      edd: '—',
      facility: '—',
      doctorRef: '—',
      status: 'none',
      lastConsultation: '—'
    });

  const handleSaveMother = (e) => {
    e.preventDefault();
    if (!editingMother) return;
    if (!editingMother.name || !editingMother.cmuNumber) {
      alert('Veuillez renseigner le nom de la maman et le N° carte CSU.');
      return;
    }

    let updated;
    if (isNewMother) {
      const newObj = {
        ...editingMother,
        id: Date.now(),
        facility: partnerUser?.structureName || partnerUser?.name || 'Hôpital Principal de Dakar',
        status: editingMother.status || 'active',
        lastConsultation: new Date().toLocaleDateString('fr-FR')
      };
      updated = [newObj, ...maternalRegistry];
      setSelectedMotherId(newObj.id);
    } else {
      updated = maternalRegistry.map(m => m.id === editingMother.id ? editingMother : m);
    }
    setMaternalRegistry(updated);
    setEditingMother(null);
    setIsNewMother(false);
  };

  const handleDeleteMother = (mother) => {
    setConfirmDeleteObj({
      title: `la maman "${mother.name}" (${mother.cmuNumber}) du registre de l'établissement`,
      onConfirm: () => {
        const updated = maternalRegistry.filter(m => m.id !== mother.id);
        setMaternalRegistry(updated);
        if (selectedMotherId === mother.id && updated.length > 0) {
          setSelectedMotherId(updated[0].id);
        }
      }
    });
  };

  // States pour la section Laboratoire CPN (déclarés au niveau supérieur selon les règles des Hooks React)
  // AUCUNE prescription CPN pré-remplie : ni sage-femme, ni examens, ni
  // statut ne sont inventés. Les ordres sont réellement prescrits par la
  // sage-femme ou le médecin via le formulaire ci-dessous.
  const [cpnOrders, setCpnOrders] = useState([]);

  const [uploadCpnTarget, setUploadCpnTarget] = useState(null);
  const [uploadCpnFileName, setUploadCpnFileName] = useState('');
  const [uploadCpnNotes, setUploadCpnNotes] = useState('');

  // States CRUD (Créer, Modifier, Supprimer)
  const [editingCpnOrder, setEditingCpnOrder] = useState(null);
  const [isNewCpnOrder, setIsNewCpnOrder] = useState(false);
  const [confirmDeleteObj, setConfirmDeleteObj] = useState(null); // { title: string, onConfirm: function }

  // ── LABORATOIRE & BIOLOGIE : non concerné par la consultation CPN clinique ──
  if (isLabUser) {
    const handleSaveCpnOrder = (e) => {
      e.preventDefault();
      if (!editingCpnOrder) return;
      if (!editingCpnOrder.period || !editingCpnOrder.exams) {
        alert('Veuillez renseigner la période CPN et les examens biologiques requis.');
        return;
      }

      let updated;
      if (isNewCpnOrder) {
        const newObj = {
          ...editingCpnOrder,
          id: Date.now(),
          status: editingCpnOrder.status || 'pending'
        };
        updated = [newObj, ...cpnOrders];
      } else {
        updated = cpnOrders.map(o => o.id === editingCpnOrder.id ? editingCpnOrder : o);
      }
      setCpnOrders(updated);
      setEditingCpnOrder(null);
      setIsNewCpnOrder(false);
    };

    const handleDeleteCpnOrder = (order) => {
      setConfirmDeleteObj({
        title: `le bilan prénatal "${order.period}" (${order.exams})`,
        onConfirm: () => {
          const updated = cpnOrders.filter(o => o.id !== order.id);
          setCpnOrders(updated);
        }
      });
    };

    const handleConfirmCpnUpload = (e) => {
      e.preventDefault();
      if (!uploadCpnTarget) return;

      const updated = cpnOrders.map(o => o.id === uploadCpnTarget.id ? { ...o, status: 'transmis' } : o);
      setCpnOrders(updated);

      // Add to DMP exams list in localStorage (Global & Patient-specific)
      try {
        const patientCmu = 'CMU-DKR-2026-4401'; // Fatou Diop
        const existingExams = JSON.parse(localStorage.getItem('cmu-medical-exams') || '[]');
        const patientExams = JSON.parse(localStorage.getItem(`cmu-exams-${patientCmu}`) || '[]');

        const newExam = {
          id: Date.now(),
          title: `Bilan Biologique Prénatal (${uploadCpnTarget.period})`,
          exam_type: 'Sérologies & Bilan Sanguin Maternité',
          badge: 'GRATUITÉ MATERNITÉ 100%',
          facility: partnerUser?.structureName || 'Laboratoire Pasteur Dakar',
          doctor: uploadCpnTarget.midwife,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          conclusion: uploadCpnNotes || 'Bilan prénatal complet : Sérologies Toxoplasmose & Rubéole négatives. Groupe A+. Glycémie 0.88 g/L.',
          cliches: 1,
          preview: '/csu_bsf_real.png'
        };

        localStorage.setItem(`cmu-exams-${patientCmu}`, JSON.stringify([newExam, ...patientExams]));
        localStorage.setItem('cmu-medical-exams', JSON.stringify([newExam, ...existingExams]));
      } catch (err) {}

      alert(`✅ Bilan prénatal certifié transmis avec succès au dossier maternité (${uploadCpnTarget.period}) !`);
      setUploadCpnTarget(null);
      setUploadCpnFileName('');
      setUploadCpnNotes('');
    };

    return (
      <div className="container-fluid px-4 py-4 fade-in-up">
        {/* HERO BANNER - ESPACE LABORATOIRE & BIOLOGIE (VERT ÉMERAUDE) */}
        <div className="position-relative overflow-hidden mb-4" style={{
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
          padding: '2.5rem 2.5rem',
          color: '#ffffff',
          boxShadow: '0 20px 45px -10px rgba(5, 150, 105, 0.45)',
          border: '1.5px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-50px', left: '30%', width: '180px', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div className="row align-items-center position-relative" style={{ zIndex: 2 }}>
            <div className="col-lg-8">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', color: '#ffffff', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                  🧪 Structure de santé & laboratoire conventionné UNAMUSC 🇸🇳
                </span>
              </div>

              <h1 className="fw-extrabold mb-2" style={{ color: '#ffffff', fontSize: '2.1rem', letterSpacing: '-0.02em', textTransform: 'none' }}>
                Pôle Spécialités Médicales, Pathologies & Prévention
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Les suivis CPN cliniques sont réservés aux sages-femmes et gynécologues. Votre laboratoire conventionné ({partnerUser?.structureName || 'Laboratoire / Établissement de santé conventionné'}) est configuré pour transmettre les bilans sanguins prénatals, sérologies et échographies.
              </p>
              <div className="d-flex align-items-center flex-wrap mt-4" style={{ gap: '28px', rowGap: '16px' }}>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: '#047857', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', marginRight: '16px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/medical-profile')}>
                  🩻 Transmettre des résultats (DMP)
                </button>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', marginLeft: '4px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/verify')}>
                  🔍 Vérifier la carte CSU d'une bénéficiaire
                </button>
              </div>
            </div>

            <div className="col-lg-4 d-none d-lg-block text-center">
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>
                <img src="/csu_bsf_real.png" alt="Laboratoire Maternité" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {/* CONTENU HUB LABORATOIRE — Bilans Sanguins Maternité */}
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h4 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                <span>🧪</span> Bilans sanguins & sérologies prénatales (100% CSU UNAMUSC)
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '0.88rem' }}>
                Résultats de bilans biologiques prénatals prescrits lors des consultations CPN 1 à CPN 4+.
              </p>
            </div>
            
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button 
                type="button" 
                className="btn btn-emerald fw-bold text-white px-3.5 py-2 d-inline-flex align-items-center gap-2 shadow-sm" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem' }}
                onClick={() => {
                  setIsNewCpnOrder(true);
                  setEditingCpnOrder({
                    period: '',
                    periodDetail: '',
                    exams: '',
                    examDetail: '',
                    midwife: '',
                    coverage: '100% CSU Gratuit',
                    status: 'pending'
                  });
                }}
              >
                <span>➕ Prescrire un nouvel examen CPN</span>
              </button>

              <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px', fontSize: '0.82rem' }}>
                💖 Program Gratuité Maternité
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)', minWidth: '1300px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Période CPN</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Examens biologiques requis</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Prescripteur / Sage-femme</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Prise en charge</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em', textAlign: 'right', minWidth: '450px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cpnOrders.map(cOrd => (
                  <tr key={cOrd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div className="d-block text-primary fw-bold mb-1" style={{ fontSize: '0.96rem' }}>
                        {cOrd.period}
                      </div>
                      <div className="text-muted small d-block" style={{ fontSize: '0.82rem', lineHeight: '1.35' }}>
                        {cOrd.periodDetail}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div className="fw-bold text-main mb-1" style={{ fontSize: '0.92rem' }}>
                        {cOrd.exams}
                      </div>
                      {cOrd.examDetail && (
                        <div className="text-success small fw-semibold" style={{ fontSize: '0.82rem', lineHeight: '1.35' }}>
                          {cOrd.examDetail}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="fw-semibold d-block" style={{ fontSize: '0.9rem' }}>👩‍⚕️ {cOrd.midwife}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="badge bg-success text-white px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>{cOrd.coverage}</span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '450px' }}>
                      <div className="d-flex align-items-center justify-content-end gap-2.5 flex-nowrap">
                        {cOrd.status === 'transmis' ? (
                          <span className="badge bg-success text-white px-3 py-2 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                            ✅ Certifié & transmis
                          </span>
                        ) : (
                          <button 
                            className="btn btn-sm btn-emerald fw-bold text-white px-3 py-2" 
                            style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }} 
                            onClick={() => setUploadCpnTarget(cOrd)}
                          >
                            📤 Téléverser le bilan PDF (CPN)
                          </button>
                        )}

                        {/* Bouton MODIFIER */}
                        <button
                          type="button"
                          className="btn btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1.5"
                          style={{
                            background: 'rgba(59, 130, 246, 0.18)',
                            color: '#60a5fa',
                            border: '1.5px solid #3b82f6',
                            borderRadius: '10px',
                            fontSize: '0.84rem',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                          }}
                          title="Modifier l'examen prénatal CPN"
                          onClick={() => {
                            setEditingCpnOrder({ ...cOrd });
                            setIsNewCpnOrder(false);
                          }}
                        >
                          ✏️ Modifier
                        </button>

                        {/* Bouton SUPPRIMER */}
                        <button
                          type="button"
                          className="btn btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1.5"
                          style={{
                            background: 'rgba(239, 68, 68, 0.18)',
                            color: '#f87171',
                            border: '1.5px solid #ef4444',
                            borderRadius: '10px',
                            fontSize: '0.84rem',
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                          }}
                          title="Supprimer la demande de bilan CPN"
                          onClick={() => handleDeleteCpnOrder(cOrd)}
                        >
                          🗑️ Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL TRANSMISSION CPN (React Portal) */}
        {uploadCpnTarget && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setUploadCpnTarget(null); }}
          >
            <form onSubmit={handleConfirmCpnUpload} style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold', boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)' }}>
                    🧪
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      Transmettre Bilan Prénatal PDF
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success mt-1 fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC • {uploadCpnTarget.period}
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setUploadCpnTarget(null)}></button>
              </div>

              {/* Info Banner */}
              <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-start gap-3">
                  <div className="fs-3">📑</div>
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>{uploadCpnTarget.exams}</strong>
                    <p className="text-muted small mb-0 mt-1" style={{ fontSize: '0.85rem' }}>
                      Prescrit par {uploadCpnTarget.midwife}. Prise en charge 100% CSU Gratuité Maternité.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form Controls */}
              <div className="mb-3">
                <label className="form-label small fw-bold mb-1">Nom du fichier PDF *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={uploadCpnFileName}
                  onChange={(e) => setUploadCpnFileName(e.target.value)}
                  placeholder="Ex: Bilan_Prenatal_CPN1_Fatou_Diop.pdf"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold mb-1">Résultats certifiés & conclusions biologiques</label>
                <textarea 
                  className="form-control" 
                  rows={3}
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  placeholder="Résultats biologiques, sérologies toxoplasmose, rubéole, groupe sanguin..."
                  value={uploadCpnNotes}
                  onChange={(e) => setUploadCpnNotes(e.target.value)}
                />
              </div>

              <div className="d-flex justify-content-end gap-2.5 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
                <button type="button" className="btn px-4 py-2.5 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => setUploadCpnTarget(null)}>
                  Annuler
                </button>
                <button type="submit" className="btn px-4 py-2.5 fw-bold text-white" style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
                  ✅ Publier au Carnet Maternité (DMP)
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

        {/* MODAL DE CRÉATION / ÉDITION DE BILAN CPN (React Portal) */}
        {editingCpnOrder && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditingCpnOrder(null); }}
          >
            <form onSubmit={handleSaveCpnOrder} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    🤰
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      {isNewCpnOrder ? 'Prescrire un nouvel examen CPN' : 'Modifier l\'examen prénatal CPN'}
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC • Carnet Maternité
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setEditingCpnOrder(null)}></button>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Période CPN *</label>
                  <select 
                    className="form-select"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingCpnOrder.period || 'CPN 1er trimestre'}
                    onChange={(e) => setEditingCpnOrder({ ...editingCpnOrder, period: e.target.value })}
                  >
                    <option value="CPN 1er trimestre">CPN 1er trimestre</option>
                    <option value="CPN 2ème trimestre">CPN 2ème trimestre</option>
                    <option value="CPN 3ème trimestre">CPN 3ème trimestre</option>
                    <option value="CPN 4ème trimestre">CPN 4ème trimestre</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Intitulé période</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingCpnOrder.periodDetail || ''}
                    onChange={(e) => setEditingCpnOrder({ ...editingCpnOrder, periodDetail: e.target.value })}
                    placeholder="Ex: Datation & Sérologies"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold mb-1">Examens biologiques requis *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingCpnOrder.exams || ''}
                  onChange={(e) => setEditingCpnOrder({ ...editingCpnOrder, exams: e.target.value })}
                  placeholder="Ex: Groupe sanguin, Rhésus, BW, Toxoplasmose, Rubéole"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold mb-1">Détail des analyses complémentaires</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingCpnOrder.examDetail || ''}
                  onChange={(e) => setEditingCpnOrder({ ...editingCpnOrder, examDetail: e.target.value })}
                  placeholder="Ex: NFS complet + Glycémie à jeun"
                />
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Prescripteur / Sage-femme</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingCpnOrder.midwife || ''}
                    onChange={(e) => setEditingCpnOrder({ ...editingCpnOrder, midwife: e.target.value })}
                    placeholder="Ex: Sage-femme Mme Fatou Diop"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Prise en charge</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingCpnOrder.coverage || '100% CSU Gratuit'}
                    onChange={(e) => setEditingCpnOrder({ ...editingCpnOrder, coverage: e.target.value })}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn px-4 py-2.5 fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                  onClick={() => setEditingCpnOrder(null)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn px-4.5 py-2.5 fw-bold text-white" 
                  style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                >
                  💾 Enregistrer le bilan CPN
                </button>
              </div>

            </form>
          </div>,
          document.body
        )}

        {/* MODAL / POP-UP DE CONFIRMATION DE SUPPRESSION (React Portal) */}
        {confirmDeleteObj && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteObj(null); }}
          >
            <div 
              className="shadow-2xl text-center" 
              style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-card, #1e293b)', color: 'var(--text-main, #ffffff)', borderRadius: '24px', padding: '2.25rem 1.75rem', border: '1.5px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 25px 70px rgba(239, 68, 68, 0.25), 0 10px 30px rgba(0, 0, 0, 0.5)', margin: 'auto' }}
            >
              <div 
                style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.35) 100%)', border: '2px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto 1.25rem auto', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)' }}
              >
                🗑️
              </div>

              <h4 className="fw-extrabold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                Confirmer la suppression
              </h4>

              <p className="mb-4" style={{ color: 'var(--text-sub, #94a3b8)', fontSize: '0.92rem', lineHeight: '1.55' }}>
                Voulez-vous vraiment supprimer définitivement <strong style={{ color: '#ef4444' }}>{confirmDeleteObj.title}</strong> ?
                <br />
                <small className="text-muted d-block mt-1">Cette action est irréversible dans le système UNAMUSC.</small>
              </p>

              <div className="d-flex justify-content-center gap-3 pt-2">
                <button
                  type="button"
                  className="btn px-4 py-2.5 fw-bold"
                  style={{ background: 'var(--bg-card-subtle, #334155)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--border-color, #475569)', borderRadius: '12px', fontSize: '0.88rem' }}
                  onClick={() => setConfirmDeleteObj(null)}
                >
                  Annuler
                </button>

                <button
                  type="button"
                  className="btn px-4 py-2.5 fw-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', border: 'none', borderRadius: '12px', fontSize: '0.88rem', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)' }}
                  onClick={() => {
                    confirmDeleteObj.onConfirm();
                    setConfirmDeleteObj(null);
                  }}
                >
                  🗑️ Supprimer définitivement
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ── PHARMACIEN : non concerné par le carnet de maternité ──
  if (isPharmacist) {
    return (
      <div className="container-fluid px-4 py-4 fade-in-up">
        {/* HERO BANNER - ESPACE PHARMACIEN */}
        <div className="position-relative overflow-hidden mb-4" style={{
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
          padding: '2.5rem 2.5rem',
          color: '#ffffff',
          boxShadow: '0 20px 45px -10px rgba(5, 150, 105, 0.45)',
          border: '1.5px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '220px', height: '220px', background: 'rgba(255,255,255,0.08)', borderRadius: '50%', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-50px', left: '30%', width: '180px', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', pointerEvents: 'none' }} />

          <div className="row align-items-center position-relative" style={{ zIndex: 2 }}>
            <div className="col-lg-8">
              <div className="d-flex align-items-center gap-2 mb-3">
                <span style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', color: '#ffffff', padding: '6px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                  Pharmacien agréé UNAMUSC 🇸🇳
                </span>
              </div>

              <h1 className="fw-extrabold mb-2" style={{ color: '#ffffff', fontSize: '2.1rem', letterSpacing: '-0.02em', textTransform: 'none' }}>
                Carnet de maternité : non concerné
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Le suivi des consultations prénatales et néonatales est géré par les sage-femmes et gynécologues. Votre espace officine traite les bons de commande de produits et vitamines de maternité.
              </p>
              <div className="d-flex align-items-center flex-wrap mt-4" style={{ gap: '28px', rowGap: '16px' }}>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: '#047857', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', marginRight: '16px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/purchase-orders')}>
                  💊 Accéder au guichet des bons de commande
                </button>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', marginLeft: '4px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/verify')}>
                  🔍 Vérifier la carte CSU d'un assuré
                </button>
              </div>
            </div>

            <div className="col-lg-4 d-none d-lg-block text-center">
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>
                <img src="/csu_bsf_real.png" alt="Maternité & Santé de la Mère UNAMUSC" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. CONTENU DU HUB PHARMACIEN */}
        <div className="row g-4 mb-4">
          {/* Panneau d'information des droits RBAC */}
          <div className="col-lg-5">
            <div className="p-4 rounded-4 h-100 position-relative overflow-hidden" style={{
              background: 'var(--bg-card)',
              border: '1.5px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '24px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)'
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div className="d-flex align-items-center gap-3 mb-3">
                <div style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  fontSize: '1.4rem',
                  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.15)'
                }}>
                  👶
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.08rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Programme gratuité maternité & BSF
                  </h5>
                  <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Directives UNAMUSC & Agence CSU
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                Les kits et médicaments prescrits aux mères bénéficiaires (fer, acide folique, kits d'accouchement) s'exécutent au niveau des bons de commande avec prise en charge intégrale UNAMUSC.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1rem' }}>💊</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Délivrance kit maternité en pharmacie</span>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                    🟢 Gratuité 100%
                  </span>
                </div>

                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1rem' }}>🩺</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Saisie des consultations obstétriques</span>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary border border-secondary px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                    🔴 Sage-femmes
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RACCOURCIS PHARMACIE */}
          <div className="col-lg-7">
            <div className="row g-3">
              <div className="col-md-6">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1.5px solid rgba(16, 185, 129, 0.4)', 
                    borderRadius: '22px', 
                    boxShadow: '0 8px 24px rgba(5, 150, 105, 0.12)' 
                  }} 
                  onClick={() => (window.location.hash = '#/purchase-orders')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(5,150,105,0.35)' }}>
                      💊
                    </div>
                    <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      Guichet principal
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.02rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Bons de commande & ordonnances
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Valider les médicaments & facturer en tiers-payant UNAMUSC.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '22px' 
                  }} 
                  onClick={() => (window.location.hash = '#/verify')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      🔍
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      Contrôle CSU
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.02rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Vérification des cartes CSU
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Scanner QR code & contrôler l'éligibilité tiers-payant.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '22px' 
                  }} 
                  onClick={() => (window.location.hash = '#/health-structures')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                      🏥
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      Réseau officines
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.02rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Structures de santé agréées
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Annuaire des officines et centres hospitaliers du Sénégal.
                  </p>
                </div>
              </div>

              <div className="col-md-6">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '22px' 
                  }} 
                  onClick={() => (window.location.hash = '#/statistics')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '48px', height: '48px', borderRadius: '15px', background: 'rgba(217, 119, 6, 0.15)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', border: '1px solid rgba(217, 119, 6, 0.3)' }}>
                      📊
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                      Facturation UNAMUSC
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.02rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Rapports & statistiques
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                    Suivi des délivrances et états de remboursement officine.
                  </p>
                </div>
              </div>
            </div>
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
              {isCitizen ? `${activeFullName} : Mère éligible CSU` : `🏥 ${partnerUser?.structureName || partnerUser?.name || 'Hôpital Principal de Dakar'} • Registre Maternité (${maternalRegistry.length} mères suivies)`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Rechercher maman..." 
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '200px' }} 
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1320px', margin: '1.75rem auto 0 auto', padding: '0 1.5rem' }}>

        {/* REGISTRE DES PATIENTS & DOSSIERS MÉDICAUX DE L'ÉTABLISSEMENT — Multi-Pathologies */}
        {!isCitizen && (
          <div className="card shadow-lg border-0 mb-4 overflow-hidden" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', boxShadow: '0 20px 45px rgba(0,0,0,0.25)' }}>
            
            {/* En-tête avec Titre, Statistique & Recherche — Spacieux & Aéré */}
            <div className="card-header bg-transparent border-0" style={{ padding: '1.75rem 2rem 1.25rem 2rem', borderBottom: '1px solid var(--border-color)' }}>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-4">
                
                {/* Gauche: Titre et Statut Dossier Actif */}
                <div className="d-flex align-items-start gap-3.5" style={{ flex: '1 1 500px' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '20px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.85rem', fontWeight: 'bold', boxShadow: '0 8px 22px rgba(16,185,129,0.38)', flexShrink: 0 }}>
                    🏥
                  </div>
                  <div>
                    <h4 className="fw-extrabold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.35rem', letterSpacing: '-0.015em', lineHeight: '1.3' }}>
                      Registre général des patients & dossiers médicaux — {partnerUser?.structureName || partnerUser?.name || 'Hôpital Principal de Dakar'}
                    </h4>
                    
                    {/* Statistique Aérée */}
                    <div className="d-flex align-items-center gap-2.5 flex-wrap mt-2" style={{ fontSize: '0.88rem' }}>
                      <span className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.28)', color: '#10b981', fontWeight: '700' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        {maternalRegistry.length} assurés suivis (Toutes pathologies)
                      </span>
                      
                      <span className="text-muted">•</span>

                      <span className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.84rem' }}>
                        <span>Dossier actif :</span>
                        <strong className="text-success" style={{ letterSpacing: '0.01em' }}>👤 {activeMother.name} ({activeMother.cmuNumber})</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Droite: Recherche & Bouton d'Inscription — Aéré Verticalement et Horizontalement */}
                <div className="d-flex align-items-center flex-wrap" style={{ gap: '1rem', rowGap: '1.25rem', columnGap: '1rem' }}>
                  <div className="position-relative" style={{ marginBottom: '0.4rem' }}>
                    <input 
                      type="text" 
                      className="form-control"
                      style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', width: '300px', padding: '0.7rem 1rem 0.7rem 2.6rem', fontSize: '0.88rem' }}
                      placeholder="Rechercher patient, N° CSU, soin..."
                      value={searchMotherQuery}
                      onChange={(e) => setSearchMotherQuery(e.target.value)}
                    />
                    <span style={{ position: 'absolute', left: '0.95rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.65, fontSize: '0.95rem' }}>🔍</span>
                  </div>

                  <button 
                    type="button" 
                    className="btn btn-emerald fw-bold text-white px-4 d-inline-flex align-items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none', borderRadius: '14px', fontSize: '0.92rem', padding: '0.7rem 1.4rem', boxShadow: '0 6px 20px rgba(16,185,129,0.38)', marginBottom: '0.4rem', cursor: 'pointer' }}
                    onClick={() => {
                      setIsNewMother(true);
                      setEditingMother({
                        name: '',
                        gender: 'F',
                        age: '',
                        phone: '',
                        cmuNumber: `CMU-DKR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
                        category: 'maternity',
                        pathology: '🤰 Suivi Grossesse',
                        edd: '',
                        doctorRef: 'Dr. Ousmane Sow'
                      });
                    }}
                  >
                    ➕ Inscrire un nouvel assuré
                  </button>
                </div>

              </div>
            </div>

            {/* Panneau d'Organisation des Spécialités Médicales — Isolé avec Marge & Espacement Généreux */}
            <div className="mx-4 my-4 p-4 rounded-4" style={{ border: '1.5px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.45)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.1)' }}>
              
              {/* En-tête du Panneau de Filtre */}
              <div className="d-flex align-items-center justify-content-between mb-3.5 flex-wrap gap-3 pb-2 border-bottom" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className="d-flex align-items-center gap-2.5">
                  <span style={{ fontSize: '1.25rem' }}>📂</span>
                  <span className="fw-extrabold" style={{ fontSize: '0.85rem', color: 'var(--text-sub)', letterSpacing: '0.04em' }}>
                    Filtrer le registre par spécialité & service médical :
                  </span>
                </div>
                
                {registryCategoryFilter !== 'all' && (
                  <button 
                    type="button" 
                    className="btn btn-sm btn-link text-success fw-bold p-0 text-decoration-none d-inline-flex align-items-center gap-1.5"
                    style={{ fontSize: '0.85rem' }}
                    onClick={() => setRegistryCategoryFilter('all')}
                  >
                    🔄 Réinitialiser tous les filtres
                  </button>
                )}
              </div>

              {/* Grille des Boutons de Spécialités — Espacement Vertical & Horizontal Généreux */}
              <div 
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem', 
                  rowGap: '1rem', 
                  columnGap: '1rem',
                  paddingTop: '0.4rem',
                  paddingBottom: '0.2rem'
                }}
              >
                {[
                  { id: 'all', label: 'Tous les services', icon: '🌐', count: maternalRegistry.length, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
                  { id: 'maternity', label: 'Gynécologie & maternité (CPN)', icon: '🤰', count: maternalRegistry.filter(m => m.category === 'maternity').length, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
                  { id: 'chronic', label: 'Cardiologie & diabétologie (ALD)', icon: '🩸', count: maternalRegistry.filter(m => m.category === 'chronic').length, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
                  { id: 'pediatric', label: 'Pédiatrie & PEV (0-5 ans)', icon: '👶', count: maternalRegistry.filter(m => m.category === 'pediatric').length, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
                  { id: 'surgery', label: 'Chirurgie & traumatologie', icon: '🩹', count: maternalRegistry.filter(m => m.category === 'surgery').length, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
                ].map(tab => {
                  const isActive = registryCategoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className="btn btn-sm fw-bold d-inline-flex align-items-center gap-2.5 shadow-sm hover-lift"
                      style={{
                        background: isActive ? tab.color : 'var(--bg-card-subtle)',
                        color: isActive ? '#ffffff' : 'var(--text-main)',
                        border: isActive ? `2px solid ${tab.color}` : '1.5px solid var(--border-color)',
                        borderRadius: '16px',
                        fontSize: '0.88rem',
                        padding: '0.75rem 1.25rem',
                        boxShadow: isActive ? `0 8px 22px ${tab.color}45` : '0 2px 8px rgba(0,0,0,0.1)',
                        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer'
                      }}
                      onClick={() => setRegistryCategoryFilter(tab.id)}
                    >
                      <span style={{ fontSize: '1.15rem' }}>{tab.icon}</span>
                      <span className="me-1">{tab.label}</span>
                      <span 
                        className="badge rounded-pill"
                        style={{ 
                          background: isActive ? 'rgba(255,255,255,0.32)' : tab.bg, 
                          color: isActive ? '#ffffff' : tab.color,
                          fontSize: '0.8rem',
                          padding: '5px 11px',
                          border: isActive ? 'none' : `1px solid ${tab.color}40`
                        }}
                      >
                        {tab.count} {tab.count > 1 ? 'patients' : 'patient'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tableau du Registre Médical Optimisé */}
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)', minWidth: '1280px' }}>
                  <thead style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', fontSize: '0.78rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: '800' }}>
                    <tr>
                      <th style={{ padding: '1.2rem 1.4rem', width: '280px' }}>Assuré bénéficiaire</th>
                      <th style={{ padding: '1.2rem', width: '190px' }}>N° Carte CSU</th>
                      <th style={{ padding: '1.2rem', width: '270px' }}>Pathologie & motif</th>
                      <th style={{ padding: '1.2rem', width: '200px' }}>Suivi / échéance</th>
                      <th style={{ padding: '1.2rem', width: '220px' }}>Médecin référent</th>
                      <th style={{ padding: '1.2rem 1.4rem', textAlign: 'right', minWidth: '380px' }}>Actions dossier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maternalRegistry
                      .filter(m => registryCategoryFilter === 'all' || m.category === registryCategoryFilter)
                      .filter(m => !searchMotherQuery || m.name.toLowerCase().includes(searchMotherQuery.toLowerCase()) || m.cmuNumber.toLowerCase().includes(searchMotherQuery.toLowerCase()) || m.pathology.toLowerCase().includes(searchMotherQuery.toLowerCase()) || m.phone.includes(searchMotherQuery))
                      .map((mother) => {
                        const isSelected = mother.id === selectedMotherId;
                        const icon = mother.category === 'maternity' ? '🤰' : mother.category === 'chronic' ? '🩸' : mother.category === 'pediatric' ? '👶' : mother.category === 'surgery' ? '🩹' : '👤';
                        const categoryBadgeBg = mother.category === 'chronic' ? 'rgba(239, 68, 68, 0.18)' : mother.category === 'maternity' ? 'rgba(236, 72, 153, 0.18)' : mother.category === 'pediatric' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(245, 158, 11, 0.18)';
                        const categoryBadgeColor = mother.category === 'chronic' ? '#f87171' : mother.category === 'maternity' ? '#f472b6' : mother.category === 'pediatric' ? '#60a5fa' : '#fbbf24';
                        const categoryBadgeBorder = mother.category === 'chronic' ? '#ef4444' : mother.category === 'maternity' ? '#ec4899' : mother.category === 'pediatric' ? '#3b82f6' : '#f59e0b';

                        return (
                          <tr key={mother.id} style={{ background: isSelected ? 'rgba(16, 185, 129, 0.09)' : 'transparent', borderLeft: isSelected ? '4px solid #10b981' : '4px solid transparent', transition: 'all 0.15s ease' }}>
                            {/* Col 1: Patient Name & Contact */}
                            <td style={{ padding: '1.15rem 1.4rem' }}>
                              <div className="d-flex align-items-center gap-3">
                                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: isSelected ? 'rgba(16, 185, 129, 0.22)' : 'var(--bg-card-subtle)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.3rem', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                  {icon}
                                </div>
                                <div>
                                  <strong className="d-block" style={{ fontSize: '0.98rem', color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                                    {mother.name}
                                  </strong>
                                  <div className="d-flex align-items-center gap-2 mt-0.5">
                                    <span className="badge bg-secondary-subtle text-sub border border-secondary" style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '6px' }}>
                                      {mother.gender === 'M' ? 'Homme' : 'Femme'}, {mother.age} ans
                                    </span>
                                    <span className="text-muted small" style={{ fontSize: '0.78rem' }}>📞 {mother.phone}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Col 2: N° CSU */}
                            <td style={{ padding: '1.15rem 1rem' }}>
                              <code className="bg-success text-white px-2.5 py-1 rounded-3 fw-bold small d-inline-block" style={{ fontSize: '0.85rem' }}>{mother.cmuNumber}</code>
                              <span className="d-block text-emerald small fw-semibold mt-1" style={{ color: '#10b981', fontSize: '0.76rem' }}>✓ 100% Prise en charge</span>
                            </td>

                            {/* Col 3: Pathologie */}
                            <td style={{ padding: '1.15rem 1rem' }}>
                              <span className="badge fw-bold px-3 py-1.8 d-inline-flex align-items-center gap-1.5" style={{ background: categoryBadgeBg, color: categoryBadgeColor, border: `1px solid ${categoryBadgeBorder}`, borderRadius: '10px', fontSize: '0.82rem', whiteSpace: 'normal', textAlign: 'left', lineHeight: '1.35' }}>
                                {mother.pathology}
                              </span>
                            </td>

                            {/* Col 4: Échéance */}
                            <td style={{ padding: '1.15rem 1rem' }}>
                              <span className="fw-bold d-block" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>📅 {mother.edd}</span>
                              <small className="text-muted d-block mt-0.5" style={{ fontSize: '0.76rem' }}>Dernier soin: {mother.lastConsultation}</small>
                            </td>

                            {/* Col 5: Praticien */}
                            <td style={{ padding: '1.15rem 1rem' }}>
                              <span className="text-muted small fw-semibold d-block" style={{ fontSize: '0.84rem' }}>👨‍⚕️ {mother.doctorRef}</span>
                            </td>

                            {/* Col 6: Actions */}
                            <td style={{ padding: '1.15rem 1.4rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', rowGap: '0.75rem', flexWrap: 'wrap' }}>
                                {/* Bouton CONSULTER DMP */}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-emerald fw-bold text-white px-3.5 py-2 d-inline-flex align-items-center gap-1.5 hover-lift"
                                  style={{ background: isSelected ? '#059669' : '#10b981', border: 'none', borderRadius: '10px', fontSize: '0.84rem', boxShadow: '0 3px 10px rgba(16,185,129,0.3)' }}
                                  onClick={() => {
                                    handleSelectMother(mother.id);
                                    dmpSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                >
                                  {isSelected ? '✓ Dossier ouvert' : '👁️ Consulter DMP'}
                                </button>

                                {/* Bouton MODIFIER */}
                                <button
                                  type="button"
                                  className="btn btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1.5 hover-lift"
                                  style={{
                                    background: 'rgba(59, 130, 246, 0.18)',
                                    color: '#60a5fa',
                                    border: '1.5px solid #3b82f6',
                                    borderRadius: '10px',
                                    fontSize: '0.84rem',
                                    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
                                  }}
                                  onClick={() => {
                                    setEditingMother({ ...mother });
                                    setIsNewMother(false);
                                  }}
                                >
                                  ✏️ Modifier
                                </button>

                                {/* Bouton SUPPRIMER */}
                                <button
                                  type="button"
                                  className="btn btn-sm fw-bold px-3 py-2 d-inline-flex align-items-center gap-1.5 hover-lift"
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.18)',
                                    color: '#f87171',
                                    border: '1.5px solid #ef4444',
                                    borderRadius: '10px',
                                    fontSize: '0.84rem',
                                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)'
                                  }}
                                  onClick={() => handleDeleteMother(mother)}
                                >
                                  🗑️ Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Registre Spécialités & Pathologies */}
              <div className="d-flex align-items-center justify-content-between p-3.5 border-top" style={{ borderColor: 'var(--border-color)', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-card-subtle)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                  Affichage de <strong>1</strong> à <strong>{Math.min(10, maternalRegistry.length)}</strong> sur <strong>{maternalRegistry.length}</strong> dossiers médicaux réellement enregistrés (Page {registryPage} sur {Math.max(1, Math.ceil(maternalRegistry.length / 10))})
                </span>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary hover-lift"
                    disabled={registryPage === 1}
                    onClick={() => setRegistryPage(prev => Math.max(1, prev - 1))}
                    style={{ borderRadius: '10px', padding: '0.35rem 0.85rem' }}
                  >
                    ◀ Précédent
                  </button>
                  {[1, 2, 3, 4, 5, '...', 145].map((p, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      className={`btn btn-sm hover-lift ${registryPage === p ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                      onClick={() => typeof p === 'number' && setRegistryPage(p)}
                      style={{ borderRadius: '10px', minWidth: '36px', fontWeight: registryPage === p ? '800' : 'normal' }}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary hover-lift"
                    disabled={registryPage === 145}
                    onClick={() => setRegistryPage(prev => Math.min(145, prev + 1))}
                    style={{ borderRadius: '10px', padding: '0.35rem 0.85rem' }}
                  >
                    Suivant ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANCRE DE DÉFILEMENT AUTOMATIQUE AU CLIC SUR "CONSULTER DMP" & BANNIÈRE DE RÔLE ADAPTATIVE */}
        <div ref={dmpSectionRef} style={{ scrollMarginTop: '90px' }}>
          {(canEditMaternity || isSuperAdmin) && (
            <div className="mb-4 p-3.5 rounded-4 d-flex align-items-center gap-3" style={{
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
                  {isMidwife && 'Mode sage-femme / soignant'}
                  {isDoctor && 'Mode médecin'}
                </h6>
                <span className="small" style={{ opacity: 0.9, fontSize: '0.88rem', lineHeight: '1.45' }}>
                  {(() => {
                    const cat = activeMother.category || 'maternity';
                    if (cat === 'chronic') {
                      return isSuperAdmin 
                        ? 'Accès total ALD : Validation des ordonnances renouvelables, bilans biologiques et gestion intégrale du DMP ALD.'
                        : isMidwife
                        ? 'Édition soignant / IDE : Consignation des constantes vitales, suivis de tension/glycémie et visites ALD.'
                        : 'Édition complète Médecin : Vous pouvez ajouter les consultations ALD, valider les traitements renouvelables et contrôler le bilan glycémique/HTA.';
                    } else if (cat === 'surgery') {
                      return isSuperAdmin
                        ? 'Accès total Chirurgie : Gestion du suivi post-opératoire, de l\'imagerie DICOM et de la traumatologie.'
                        : isMidwife
                        ? 'Édition soignant / IDE : Consignation des soins de pansements et suivi des séances de rééducation.'
                        : 'Édition complète Médecin : Vous pouvez consigner les comptes-rendus opératoires, prescrire la kinésithérapie et joindre les radios DICOM.';
                    } else {
                      return isSuperAdmin
                        ? 'Accès total Maternité : Validations prénatales (CPN), délivrance des certificats et suivi pédiatrique.'
                        : isMidwife
                        ? 'Édition complète Sage-Femme : Vous pouvez remplir les consultations prénatales (CPN 1-4+), ajouter des conseils et valider le carnet.'
                        : 'Édition complète Médecin : Vous pouvez remplir les consultations prénatales, ajouter des fiches conseils et modifier le carnet.';
                    }
                  })()}
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
                  {(() => {
                    const cat = activeMother.category || 'maternity';
                    if (cat === 'chronic') {
                      return 'Espace assuré ALD : Consultez votre dossier médical partagé, vos ordonnances 100% CSU et le bilan de vos constantes vitales.';
                    } else if (cat === 'surgery') {
                      return 'Espace assuré Chirurgie : Consultez vos examens radiologiques DICOM, vos séances de rééducation et vos soins post-opératoires.';
                    } else {
                      return 'Espace assuré Maternité & Pédiatrie : Consultez votre carnet de santé, téléchargez le PDF et suivez la vaccination PEV de votre enfant.';
                    }
                  })()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SÉLECTEUR DE PÔLE SELON LE SEXE DE L'ASSURÉ CONNECTÉ */}
        {isCitizen && !isMaleUser && (
          <div className="d-flex justify-content-center align-items-center flex-wrap mb-5 w-100" style={{ gap: '1.75rem', rowGap: '1.25rem', padding: '0.75rem 0' }}>
            <button
              type="button"
              className="hover-lift"
              style={{
                background: citizenSpecialtyTab === 'maternity' ? 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)' : 'var(--bg-card)',
                color: citizenSpecialtyTab === 'maternity' ? '#ffffff' : 'var(--text-main)',
                border: citizenSpecialtyTab === 'maternity' ? '2.5px solid #ffffff' : '1.5px solid var(--border-color)',
                borderRadius: '20px',
                padding: '1.2rem 2.4rem',
                fontWeight: '800',
                fontSize: '1.05rem',
                boxShadow: citizenSpecialtyTab === 'maternity' ? '0 10px 30px rgba(219, 39, 119, 0.45)' : 'var(--shadow-sm)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.85rem',
                minWidth: '320px',
                justifyContent: 'center',
                transition: 'all 0.25s ease'
              }}
              onClick={() => { setCitizenSpecialtyTab('maternity'); setActiveTab('cpn'); }}
            >
              <span style={{ fontSize: '1.5rem' }}>🤰</span> 1. Carnet Maternité & Grossesse (100% CSU)
            </button>

            <button
              type="button"
              className="hover-lift"
              style={{
                background: citizenSpecialtyTab === 'chronic' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'var(--bg-card)',
                color: citizenSpecialtyTab === 'chronic' ? '#ffffff' : 'var(--text-main)',
                border: citizenSpecialtyTab === 'chronic' ? '2.5px solid #ffffff' : '1.5px solid var(--border-color)',
                borderRadius: '20px',
                padding: '1.2rem 2.4rem',
                fontWeight: '800',
                fontSize: '1.05rem',
                boxShadow: citizenSpecialtyTab === 'chronic' ? '0 10px 30px rgba(5, 150, 105, 0.45)' : 'var(--shadow-sm)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.85rem',
                minWidth: '320px',
                justifyContent: 'center',
                transition: 'all 0.25s ease'
              }}
              onClick={() => { setCitizenSpecialtyTab('chronic'); setActiveTab('cpn'); }}
            >
              <span style={{ fontSize: '1.5rem' }}>🩺</span> 2. Spécialités & Pathologies (ALD)
            </button>
          </div>
        )}

        {isCitizen && isMaleUser && (
          <div className="d-flex justify-content-center align-items-center mb-5 w-100">
            <div style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(16, 185, 129, 0.18) 100%)', border: '1.5px solid rgba(5, 150, 105, 0.4)', borderRadius: '22px', padding: '1.15rem 2.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.85rem', boxShadow: '0 8px 25px rgba(5, 150, 105, 0.12)' }}>
              <span style={{ fontSize: '1.5rem' }}>🩺</span>
              <span style={{ color: 'var(--text-main)', fontWeight: '800', fontSize: '1.08rem' }}>
                Pôle Spécialités Médicales & Suivi Pathologies Chroniques (ALD 100% / Tiers-Payant UNAMUSC)
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DOSSIER MÉDICAL PARTAGÉ (DMP) DYNAMIQUE ADAPTÉ À LA PATHOLOGIE DU PATIENT */}
        {/* ========================================================================= */}
        {(() => {
          const cat = activeMother.category || 'maternity';
          const heroStyle = getMedicalHeroStyle(activeMother);

          const heroTitle = cat === 'chronic'
            ? `Dossier médical partagé (ALD) — ${activeMother.name}`
            : cat === 'surgery'
            ? `Dossier traumatologie & chirurgie — ${activeMother.name}`
            : cat === 'pediatric'
            ? `Carnet de santé pédiatrique & PEV — ${activeMother.name}`
            : `Carnet de santé maternelle & suivi de l'enfant`;

          const heroSubtitle = cat === 'chronic'
            ? `Suivi thérapeutique & biologique pour ${activeMother.pathology}. Patient (${activeMother.gender === 'M' ? 'Homme' : 'Femme'}, ${activeMother.age} ans) • N° Carte CSU : ${activeMother.cmuNumber}.`
            : cat === 'surgery'
            ? `Suivi post-opératoire, rééducation & radiographies pour ${activeMother.pathology}. Patient (${activeMother.gender === 'M' ? 'Homme' : 'Femme'}, ${activeMother.age} ans) • N° Carte CSU : ${activeMother.cmuNumber}.`
            : cat === 'pediatric'
            ? `Suivi de croissance OMS & calendrier vaccinal 0-5 ans pour ${activeMother.name} (${activeMother.age} ans). Prise en charge 100% CSU.`
            : `Accédez en toute sécurité au suivi prénatal et au calendrier vaccinal PEV de votre enfant. Bénéficiez des garanties de prise en charge 100% CSU.`;

          return (
            <div className="p-5 rounded-4 mb-5 text-white" style={{ background: heroStyle.heroBg, padding: '3.5rem 2.5rem', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.35)', boxShadow: '0 16px 45px rgba(0, 0, 0, 0.35)', transition: 'background 0.4s ease' }}>
              <div className="row align-items-center g-4">
                <div className="col-lg-9">
                  <div className="d-flex align-items-center flex-wrap mb-3" style={{ gap: '0.85rem', rowGap: '0.85rem' }}>
                    <span style={{ background: heroStyle.badgeColor, color: '#ffffff', padding: '0.45rem 1.15rem', borderRadius: '20px', fontSize: '0.86rem', fontWeight: '800', display: 'inline-block', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                      {heroStyle.badgeText}
                    </span>
                    <span style={{ background: 'rgba(15, 23, 42, 0.75)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)', backdropFilter: 'blur(10px)', padding: '0.45rem 1.05rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      📸 {heroStyle.imageTag}
                    </span>
                  </div>

                  <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.25rem', letterSpacing: '-0.02em', textShadow: '0 3px 8px rgba(0,0,0,0.5)' }}>{heroTitle}</h1>
                  <p className="text-white-50 mb-4" style={{ fontSize: '1.05rem', maxWidth: '780px', lineHeight: '1.6', textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                    {heroSubtitle}
                  </p>

                  <div className="d-flex gap-3 flex-wrap align-items-center" style={{ rowGap: '1.15rem', columnGap: '1.25rem', marginTop: '1.75rem' }}>
                    <button 
                      type="button"
                      className="hover-lift"
                      style={{ background: '#dc2626', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: '16px', padding: '1rem 1.75rem', fontWeight: '800', fontSize: '0.94rem', boxShadow: '0 8px 24px rgba(220, 38, 38, 0.45)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }} 
                      onClick={() => setShowDangerSOSModal(true)}
                    >
                      {cat === 'chronic' ? '🚨 Protocole urgence ALD (SAMU 1515)' : cat === 'surgery' ? '🚨 Alerte complication / urgence (SAMU 1515)' : cat === 'pediatric' ? '🚨 SOS urgence pédiatrique (SAMU 1515)' : '🚨 Signes de danger & urgence maternité (SAMU 1515)'}
                    </button>

                    <button 
                      type="button"
                      className="hover-lift"
                      style={{ background: '#059669', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: '16px', padding: '1rem 1.75rem', fontWeight: '800', fontSize: '0.94rem', boxShadow: '0 8px 24px rgba(5, 150, 105, 0.45)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }} 
                      onClick={handleGenerateDeliveryCertificate}
                    >
                      {cat === 'chronic' ? '📜 Attestation ALD prise en charge 100% PDF' : cat === 'surgery' ? '📜 Compte-rendu opératoire PDF' : cat === 'pediatric' ? '📜 Attestation de vaccination PEV PDF' : '📜 Certificat d\'accouchement PDF (100% UNAMUSC)'}
                    </button>
                    
                    <button 
                      type="button"
                      className="hover-lift"
                      style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#ffffff', border: '1.5px solid rgba(255, 255, 255, 0.35)', borderRadius: '16px', padding: '1rem 1.75rem', fontWeight: '800', fontSize: '0.94rem', cursor: 'pointer', backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }} 
                      onClick={handleDownloadCarnet}
                    >
                      📥 Exporter DMP officiel PDF (🇸🇳)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tab Navigation Pills — Aéré, Espacé & Adaptatif au Patient */}
        {(() => {
          const cat = activeMother.category || 'maternity';
          const tab1Label = cat === 'chronic' ? '1. 🩸 Consultations ALD & suivi diabète/HTA' : cat === 'surgery' ? '1. 🩹 Consultations post-opératoires & radio' : cat === 'pediatric' ? '1. 💉 Calendrier vaccinal PEV (0-5 ans)' : '1. 🤰 Suivi prénatal (CPN 1-4+)';
          const tab2Label = cat === 'chronic' ? '2. 💊 Ordonnances ALD & traitements' : cat === 'surgery' ? '2. 🦴 Imagerie radiologique & antalgiques' : cat === 'pediatric' ? '2. ⚖️ Courbe de croissance OMS' : '2. 🍼 Croissance & vaccins (0-12 mois)';
          const tab3Label = cat === 'chronic' ? '3. 📈 Constantes vitales & régime ALD' : cat === 'surgery' ? '3. ♿ Protocole rééducation kinésithérapie' : cat === 'pediatric' ? '3. 🩺 Consultations pédiatriques & vitamine A' : '3. 💡 Conseils experts & échanges';

          const activeColor = cat === 'chronic' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : cat === 'surgery' ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : cat === 'pediatric' ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)' : 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)';

          return (
            <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', padding: '0.85rem', borderRadius: '22px', display: 'flex', flexWrap: 'wrap', gap: '1.25rem', rowGap: '1rem', marginBottom: '2.5rem', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
              <button 
                type="button"
                className="hover-lift"
                style={{ 
                  background: activeTab === 'cpn' ? activeColor : 'var(--bg-card-subtle)', 
                  color: activeTab === 'cpn' ? '#ffffff' : 'var(--text-main)', 
                  border: activeTab === 'cpn' ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '1rem 1.85rem', 
                  fontWeight: '800', 
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'cpn' ? '0 6px 20px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                  flex: '1 1 auto',
                  textAlign: 'center'
                }} 
                onClick={() => setActiveTab('cpn')}
              >
                {tab1Label}
              </button>

              <button 
                type="button"
                className="hover-lift"
                style={{ 
                  background: activeTab === 'pev' ? activeColor : 'var(--bg-card-subtle)', 
                  color: activeTab === 'pev' ? '#ffffff' : 'var(--text-main)', 
                  border: activeTab === 'pev' ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '1rem 1.85rem', 
                  fontWeight: '800', 
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'pev' ? '0 6px 20px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                  flex: '1 1 auto',
                  textAlign: 'center'
                }} 
                onClick={() => setActiveTab('pev')}
              >
                {tab2Label}
              </button>

              <button 
                type="button"
                className="hover-lift"
                style={{ 
                  background: activeTab === 'advice' ? activeColor : 'var(--bg-card-subtle)', 
                  color: activeTab === 'advice' ? '#ffffff' : 'var(--text-main)', 
                  border: activeTab === 'advice' ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '1rem 1.85rem', 
                  fontWeight: '800', 
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'advice' ? '0 6px 20px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease',
                  flex: '1 1 auto',
                  textAlign: 'center'
                }} 
                onClick={() => setActiveTab('advice')}
              >
                {tab3Label}
              </button>
            </div>
          );
        })()}

        {/* TAB 1: CPN SUIVI PRÉNATAL */}
        {activeTab === 'cpn' && (
          <div className="row g-4 mb-4">
            
            {/* Main Left Column: CPN Timeline */}
            <div className="col-lg-8">
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                  {(() => {
                    const cat = activeMother.category || 'maternity';
                    const activeConsultationsList = cat === 'chronic' ? [
                      { id: 101, title: 'Consultation cardiologie & évaluation HTA sévère', desc: 'Tension 15/9 mmHg. Fond d\'œil réalisé (stade 0). Ajustement Amlodipine 10mg & régime hyposodé.', date: '10/04/2026', doctor: activeMother.doctorRef || 'Dr. Ousmane Sow (Cardiologie)', status: 'Consultation ALD validée', completed: true },
                      { id: 102, title: 'Bilan diabétologie & HbA1c semestriel', desc: 'HbA1c mesurée à 6.9%. Glycémie à jeun 1.25 g/L. Prescription Metformine 1000mg & contrôle podologique.', date: '05/06/2026', doctor: 'Dr. Cheikh Diop (Diabétologue)', status: 'Bilan biologique validé', completed: true },
                      { id: 103, title: 'Bilan rénal, microalbuminurie & fond d\'œil', desc: 'Prévue : Bilan lipidique (Cholestérol/Triglycérides), créatininémie & électrocardiogramme ECG.', date: '12/08/2026', doctor: activeMother.doctorRef || 'Dr. Ousmane Sow (Cardiologie)', status: 'RDV ALD à venir', completed: false },
                      { id: 104, title: 'Consultation étape semestrielle & adaptation traitement', desc: 'Prévue : Contrôle annuel 100% CSU, renouvellement ordonnance 6 mois & bilan cardiovasculaire.', date: '25/09/2026', doctor: 'Dr. Cheikh Diop (Diabétologue)', status: 'Programmé CSU 100%', completed: false }
                    ] : cat === 'surgery' ? [
                      { id: 201, title: 'Chirurgie orthopédique & réduction de fracture', desc: 'Intervention sous rachi-anesthésie. Réduction fracture fémur droite avec matériel d\'ostéosynthèse. Pose plâtre.', date: '20/05/2026', doctor: activeMother.doctorRef || 'Dr. Babacar Kane (Orthopédiste)', status: 'Intervention réalisée', completed: true },
                      { id: 202, title: 'Radiographie de contrôle J+30 & ablation fils', desc: 'Alignement osseux satisfaisant. Cal osseux en formation. Ablation des agrafes & réfection résine.', date: '20/06/2026', doctor: activeMother.doctorRef || 'Dr. Babacar Kane (Orthopédiste)', status: 'Radio contrôle validée', completed: true },
                      { id: 203, title: 'Ablation plâtre & début kinésithérapie', desc: 'Prévue : Ablation résine, examen mobilité genou/hanche & démarrage 10 séances de rééducation fonctionnelle.', date: '20/07/2026', doctor: activeMother.doctorRef || 'Dr. Babacar Kane (Orthopédiste)', status: 'Suivi post-op à venir', completed: false },
                      { id: 204, title: 'Bilan d\'autonomie & décharge matériel', desc: 'Prévue : Évaluation de la marche sans appui, radio de consolidation définitive à 4 mois.', date: '20/09/2026', doctor: 'Dr. Babacar Kane (Orthopédiste)', status: 'Programmé CSU 100%', completed: false }
                    ] : cat === 'pediatric' ? [
                      { id: 301, title: 'Consultation 1er mois & pesée pédiatrique', desc: 'Développement psychomoteur normal. Poids 4.3 kg. Vaccination BCG + VPO 0 validée.', date: '14/06/2026', doctor: activeMother.doctorRef || 'Dr. Mariama Seck (Pédiatre)', status: 'Pédiatrie validée', completed: true },
                      { id: 302, title: 'Visite 9ème mois & rappel PEV', desc: 'Vaccin RR 1 + Fièvre Jaune. Supplémentation en Vitamine A & Déparasitation à l\'Albendazole.', date: '14/07/2026', doctor: activeMother.doctorRef || 'Dr. Mariama Seck (Pédiatre)', status: 'Suivi PEV validé', completed: true },
                      { id: 303, title: 'Contrôle croissance 2 ans & dépistage anémie', desc: 'Prévue : Évaluation du langage, courbe de croissance OMS & dépistage malnutrition aiguë.', date: '14/08/2026', doctor: activeMother.doctorRef || 'Dr. Mariama Seck (Pédiatre)', status: 'Pédiatrie à venir', completed: false }
                    ] : cpnVisits;

                    const completedCount = activeConsultationsList.filter(c => c.completed).length;
                    const totalCount = activeConsultationsList.length;
                    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    const titleText = cat === 'chronic' ? 'Calendrier des consultations ALD & bilans réguliers (diabète / HTA)' : cat === 'surgery' ? 'Calendrier du suivi post-opératoire & rééducation orthopédique' : cat === 'pediatric' ? 'Calendrier des consultations pédiatriques & PEV (0-5 ans)' : 'Calendrier des consultations prénatales & post-natales';

                    return (
                      <div className="w-100">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>{titleText}</h5>
                          <span style={{ background: percentage === 100 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: percentage === 100 ? '#10b981' : '#3b82f6', border: `1px solid ${percentage === 100 ? '#10b981' : '#3b82f6'}`, borderRadius: '20px', padding: '0.35rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}>
                            {percentage === 100 ? '✔ Toutes effectuées' : `⌛ En cours (${completedCount}/${totalCount})`}
                          </span>
                        </div>

                        <div className="d-flex align-items-center justify-content-between mt-1">
                          <small style={{ color: 'var(--text-sub)' }}>
                            Progression globale du suivi : <span className="text-success fw-extrabold" style={{ fontSize: '0.95rem' }}>{percentage}% complété</span> ({completedCount} sur {totalCount} consultations validées)
                          </small>
                        </div>

                        <div className="progress mt-2" style={{ height: '8px', background: 'var(--bg-card-subtle)', borderRadius: '10px' }}>
                          <div className="progress-bar bg-success" style={{ width: `${percentage}%`, borderRadius: '10px', transition: 'width 0.4s ease' }}></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Timeline Items Dynamiques */}
                <div className="d-flex flex-column gap-3.5">
                  {(() => {
                    const cat = activeMother.category || 'maternity';
                    const list = cat === 'chronic' ? [
                      { id: 101, title: 'Consultation cardiologie & évaluation HTA sévère', desc: 'Tension 15/9 mmHg. Fond d\'œil réalisé (stade 0). Ajustement Amlodipine 10mg & régime hyposodé.', date: '10/04/2026', doctor: activeMother.doctorRef || 'Dr. Ousmane Sow (Cardiologie)', status: 'Consultation ALD validée', completed: true },
                      { id: 102, title: 'Bilan diabétologie & HbA1c semestriel', desc: 'HbA1c mesurée à 6.9%. Glycémie à jeun 1.25 g/L. Prescription Metformine 1000mg & contrôle podologique.', date: '05/06/2026', doctor: 'Dr. Cheikh Diop (Diabétologue)', status: 'Bilan biologique validé', completed: true },
                      { id: 103, title: 'Bilan rénal, microalbuminurie & fond d\'œil', desc: 'Prévue : Bilan lipidique (Cholestérol/Triglycérides), créatininémie & électrocardiogramme ECG.', date: '12/08/2026', doctor: activeMother.doctorRef || 'Dr. Ousmane Sow (Cardiologie)', status: 'RDV ALD à venir', completed: false },
                      { id: 104, title: 'Consultation étape semestrielle & adaptation traitement', desc: 'Prévue : Contrôle annuel 100% CSU, renouvellement ordonnance 6 mois & bilan cardiovasculaire.', date: '25/09/2026', doctor: 'Dr. Cheikh Diop (Diabétologue)', status: 'Programmé CSU 100%', completed: false }
                    ] : cat === 'surgery' ? [
                      { id: 201, title: 'Chirurgie orthopédique & réduction de fracture', desc: 'Intervention sous rachi-anesthésie. Réduction fracture fémur droite avec matériel d\'ostéosynthèse. Pose plâtre.', date: '20/05/2026', doctor: activeMother.doctorRef || 'Dr. Babacar Kane (Orthopédiste)', status: 'Intervention réalisée', completed: true },
                      { id: 202, title: 'Radiographie de contrôle J+30 & ablation fils', desc: 'Alignement osseux satisfaisant. Cal osseux en formation. Ablation des agrafes & réfection résine.', date: '20/06/2026', doctor: activeMother.doctorRef || 'Dr. Babacar Kane (Orthopédiste)', status: 'Radio contrôle validée', completed: true },
                      { id: 203, title: 'Ablation plâtre & début kinésithérapie', desc: 'Prévue : Ablation résine, examen mobilité genou/hanche & démarrage 10 séances de rééducation fonctionnelle.', date: '20/07/2026', doctor: activeMother.doctorRef || 'Dr. Babacar Kane (Orthopédiste)', status: 'Suivi post-op à venir', completed: false },
                      { id: 204, title: 'Bilan d\'autonomie & décharge matériel', desc: 'Prévue : Évaluation de la marche sans appui, radio de consolidation définitive à 4 mois.', date: '20/09/2026', doctor: 'Dr. Babacar Kane (Orthopédiste)', status: 'Programmé CSU 100%', completed: false }
                    ] : cat === 'pediatric' ? [
                      { id: 301, title: 'Consultation 1er mois & pesée pédiatrique', desc: 'Développement psychomoteur normal. Poids 4.3 kg. Vaccination BCG + VPO 0 validée.', date: '14/06/2026', doctor: activeMother.doctorRef || 'Dr. Mariama Seck (Pédiatre)', status: 'Pédiatrie validée', completed: true },
                      { id: 302, title: 'Visite 9ème mois & rappel PEV', desc: 'Vaccin RR 1 + Fièvre Jaune. Supplémentation en Vitamine A & Déparasitation à l\'Albendazole.', date: '14/07/2026', doctor: activeMother.doctorRef || 'Dr. Mariama Seck (Pédiatre)', status: 'Suivi PEV validé', completed: true },
                      { id: 303, title: 'Contrôle croissance 2 ans & dépistage anémie', desc: 'Prévue : Évaluation du langage, courbe de croissance OMS & dépistage malnutrition aiguë.', date: '14/08/2026', doctor: activeMother.doctorRef || 'Dr. Mariama Seck (Pédiatre)', status: 'Pédiatrie à venir', completed: false }
                    ] : cpnVisits;

                    return list.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-4 rounded-4 shadow-sm" 
                        style={{ 
                          background: 'var(--bg-card-subtle)', 
                          border: editingCpnId === item.id ? '2px solid #10b981' : '1px solid var(--border-color)',
                          borderRadius: '18px',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {editingCpnId === item.id ? (
                          <form onSubmit={handleSaveEditCpn} className="d-flex flex-column gap-3">
                            <div className="d-flex justify-content-between align-items-center pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                              <strong className="text-success" style={{ fontSize: '0.95rem' }}>✏️ Modification de la consultation</strong>
                              <button type="button" className="btn btn-sm btn-close" onClick={() => setEditingCpnId(null)} />
                            </div>
                            <div>
                              <label className="form-label small fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Titre de la consultation</label>
                              <input type="text" className="form-control" placeholder="Titre consultation" value={editCpnForm.title} onChange={(e) => setEditCpnForm({ ...editCpnForm, title: e.target.value })} required style={{ borderRadius: '10px' }} />
                            </div>
                            <div>
                              <label className="form-label small fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Observations cliniques & actes</label>
                              <textarea className="form-control" rows={3} placeholder="Description / observations cliniques" value={editCpnForm.desc} onChange={(e) => setEditCpnForm({ ...editCpnForm, desc: e.target.value })} style={{ borderRadius: '10px' }} />
                            </div>
                            <div className="row g-2">
                              <div className="col-md-6">
                                <label className="form-label small fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Date</label>
                                <input type="text" className="form-control fw-bold" placeholder="Date (ex: 12/08/2026)" value={editCpnForm.date} onChange={(e) => setEditCpnForm({ ...editCpnForm, date: e.target.value })} style={{ borderRadius: '10px' }} />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small fw-bold mb-1" style={{ color: 'var(--text-main)' }}>Praticien référent</label>
                                <input type="text" className="form-control" placeholder="Praticien" value={editCpnForm.doctor} onChange={(e) => setEditCpnForm({ ...editCpnForm, doctor: e.target.value })} style={{ borderRadius: '10px' }} />
                              </div>
                            </div>
                            <div className="d-flex align-items-center gap-2.5 mt-2">
                              <button type="submit" className="btn btn-success fw-bold px-4 py-2 hover-lift" style={{ borderRadius: '10px', background: '#059669', borderColor: '#059669' }}>💾 Enregistrer</button>
                              <button type="button" className="btn btn-secondary px-3 py-2 hover-lift" style={{ borderRadius: '10px' }} onClick={() => setEditingCpnId(null)}>Annuler</button>
                            </div>
                          </form>
                        ) : (
                          <div className="d-flex flex-column gap-2.5">
                            {/* Header: Icon, Badges & Actions */}
                            <div 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                flexWrap: 'wrap', 
                                gap: '1rem', 
                                rowGap: '0.85rem', 
                                paddingBottom: '0.85rem', 
                                marginBottom: '0.5rem',
                                borderBottom: '1px solid rgba(255,255,255,0.08)' 
                              }}
                            >
                              {/* Groupe 1 (Gauche) : Indicateur + Statut CPN + Date */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', rowGap: '0.65rem', flexWrap: 'wrap' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: item.completed ? '#10b981' : 'var(--bg-card)', color: item.completed ? '#ffffff' : 'var(--text-sub)', border: item.completed ? 'none' : '1.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', flexShrink: 0 }}>
                                  {item.completed ? '✓' : '⌛'}
                                </div>
                                <span style={{ 
                                  background: item.completed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', 
                                  color: item.completed ? '#10b981' : '#fbbf24', 
                                  border: `1.5px solid ${item.completed ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                                  padding: '0.45rem 0.95rem', 
                                  borderRadius: '10px', 
                                  fontSize: '0.82rem', 
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {item.status}
                                </span>
                                <span style={{ 
                                  background: 'var(--bg-card)', 
                                  color: 'var(--text-sub)', 
                                  border: '1.5px solid var(--border-color)', 
                                  padding: '0.45rem 0.95rem', 
                                  borderRadius: '10px', 
                                  fontSize: '0.82rem', 
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.6rem',
                                  whiteSpace: 'nowrap'
                                }}>
                                  📅 {item.date}
                                </span>
                              </div>

                              {/* Groupe 2 (Droite) : Boutons Modifier & Supprimer */}
                              {canEditMaternity && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', rowGap: '0.65rem', flexWrap: 'wrap' }}>
                                  <button 
                                    type="button" 
                                    className="hover-lift" 
                                    style={{ 
                                      background: 'rgba(59,130,246,0.15)', 
                                      color: '#60a5fa', 
                                      border: '1.5px solid #3b82f6', 
                                      borderRadius: '10px', 
                                      padding: '0.45rem 1rem', 
                                      fontWeight: '700', 
                                      fontSize: '0.82rem', 
                                      cursor: 'pointer', 
                                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.6rem',
                                      whiteSpace: 'nowrap'
                                    }} 
                                    onClick={() => openEditCpn(item)}
                                  >
                                    ✏️ Modifier
                                  </button>
                                  <button 
                                    type="button" 
                                    className="hover-lift" 
                                    style={{ 
                                      background: 'rgba(239,68,68,0.15)', 
                                      color: '#f87171', 
                                      border: '1.5px solid #ef4444', 
                                      borderRadius: '10px', 
                                      padding: '0.45rem 1rem', 
                                      fontWeight: '700', 
                                      fontSize: '0.82rem', 
                                      cursor: 'pointer', 
                                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.6rem',
                                      whiteSpace: 'nowrap'
                                    }} 
                                    onClick={() => handleDeleteCpn(item)}
                                  >
                                    🗑️ Supprimer
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Body: Title, Description, Doctor */}
                            <div className="pt-1">
                              <h6 className="fw-bold mb-1.5" style={{ color: 'var(--text-main)', fontSize: '1.02rem', lineHeight: '1.4' }}>{item.title}</h6>
                              <p className="mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: '1.55' }}>{item.desc}</p>
                              <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-success-subtle text-success border border-success px-2.5 py-1" style={{ fontSize: '0.76rem', borderRadius: '8px' }}>
                                  👨‍⚕️ {item.doctor}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ));
                  })()}
                </div>

                {/* Bouton ajouter consultation — médecin / sage-femme / superadmin */}
                {canEditMaternity && (
                  <button type="button" className="mt-3.5 hover-lift" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '2px dashed #10b981', borderRadius: '14px', padding: '0.85rem', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', width: '100%' }} onClick={() => setShowAddCpnModal(true)}>
                    ➕ Ajouter une consultation de suivi ({activeMother.category === 'chronic' ? 'Cardiologie / ALD' : activeMother.category === 'surgery' ? 'Traumatologie' : 'Médecin / Praticien'})
                  </button>
                )}

              </div>
            </div>

            {/* Right Sidebar Column */}
            <div className="col-lg-4">
              <div className="d-flex flex-column gap-4">
                {activeMother.category === 'chronic' ? (
                  /* 🩸 SEMAINE / PROTOCOLE SURVEILLANCE ALD (PATIENT CHRONIQUE) */
                  <div className="p-0 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
                    {/* Header avec bande dégradée émeraude & accents */}
                    <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)', padding: '1.25rem 1.5rem' }}>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="d-flex align-items-center gap-2.5">
                          <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>🛡️</div>
                          <div>
                            <h6 className="fw-extrabold mb-0" style={{ color: '#fff', fontSize: '1rem' }}>Surveillance & prévention ALD</h6>
                            <small style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.78rem' }}>Protocoles diabète & HTA UNAMUSC</small>
                          </div>
                        </div>
                        {canEditMaternity && (
                          <button
                            type="button"
                            className="hover-lift"
                            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '12px', fontSize: '0.78rem', padding: '0.45rem 0.85rem', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s ease' }}
                            onClick={() => {
                              setEditingAldItem({ title: '', status: '✅ Normal', date: new Date().toLocaleDateString('fr-FR') });
                              setShowAldModal(true);
                            }}
                          >
                            ➕ Ajouter
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                      {/* Observance Traitement - redesigned */}
                      <div className="p-3.5 rounded-4 mb-3" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)', border: '1.5px solid rgba(16,185,129,0.25)', borderRadius: '18px' }}>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div className="d-flex align-items-center gap-2.5">
                            <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0 }}>💊</div>
                            <div>
                              <span className="fw-extrabold d-block" style={{ color: 'var(--text-main)', fontSize: '0.88rem', lineHeight: 1.3 }}>Observance thérapeutique ALD</span>
                              <small style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>Traitement quotidien à vie pris régulièrement</small>
                            </div>
                          </div>
                          <span style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 800, fontSize: '0.75rem', padding: '0.35rem 0.75rem', borderRadius: '10px', whiteSpace: 'nowrap' }}>180 / 180 j</span>
                        </div>
                        <div style={{ height: '8px', background: 'rgba(16,185,129,0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '6px', boxShadow: '0 0 12px rgba(16,185,129,0.4)' }}></div>
                        </div>
                      </div>

                      {/* Section Title - Bilan */}
                      <div className="d-flex align-items-center gap-2 mb-2.5" style={{ paddingBottom: '0.45rem', borderBottom: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '0.9rem' }}>🩺</span>
                        <small className="fw-bold" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Bilan prévention complications ALD
                        </small>
                      </div>

                      {/* Liste Dynamique des Examens ALD - redesigned */}
                      <div className="d-flex flex-column gap-2.5 mb-3.5">
                        {aldSurveillanceItems.map(item => {
                          const iconMap = { '👁️': { bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', icon: '👁️' }, '👣': { bg: 'linear-gradient(135deg, #f59e0b, #d97706)', icon: '👣' }, '🫀': { bg: 'linear-gradient(135deg, #ef4444, #dc2626)', icon: '🫀' } };
                          const firstEmoji = item.title.match(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
                          const emojiKey = firstEmoji ? firstEmoji[0] : null;
                          const iconStyle = iconMap[emojiKey] || { bg: 'linear-gradient(135deg, #6366f1, #4f46e5)', icon: '🩺' };
                          const cleanTitle = item.title.replace(/^(\p{Emoji_Presentation}|\p{Extended_Pictographic})\s*/u, '');
                          
                          return (
                            <div key={item.id} className="p-2.5 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '16px', transition: 'all 0.2s ease' }}>
                              <div className="d-flex align-items-center gap-2.5">
                                {/* Icône circulaire colorée */}
                                <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: iconStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem', flexShrink: 0, boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }}>
                                  {emojiKey || iconStyle.icon}
                                </div>
                                
                                {/* Contenu principal */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <span className="fw-bold d-block" style={{ color: 'var(--text-main)', fontSize: '0.84rem', lineHeight: 1.35 }}>{cleanTitle}</span>
                                  <div className="d-flex align-items-center gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                                    <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>📅 {item.date}</span>
                                    <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: '8px' }}>{item.status}</span>
                                  </div>
                                </div>

                                {/* Boutons CRUD */}
                                {canEditMaternity && (
                                  <div className="d-flex gap-1.5" style={{ flexShrink: 0 }}>
                                    <button
                                      type="button"
                                      className="btn btn-sm fw-bold d-inline-flex align-items-center gap-1 hover-lift"
                                      title="Modifier"
                                      style={{
                                        background: 'rgba(59, 130, 246, 0.18)',
                                        color: '#60a5fa',
                                        border: '1.5px solid #3b82f6',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        padding: '0.35rem 0.6rem',
                                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => { setEditingAldItem(item); setShowAldModal(true); }}
                                    >✏️</button>
                                    <button
                                      type="button"
                                      className="btn btn-sm fw-bold d-inline-flex align-items-center gap-1 hover-lift"
                                      title="Supprimer"
                                      style={{
                                        background: 'rgba(239, 68, 68, 0.18)',
                                        color: '#f87171',
                                        border: '1.5px solid #ef4444',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        padding: '0.35rem 0.6rem',
                                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => handleDeleteAldItem(item.id)}
                                    >🗑️</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Matériel Auto-surveillance - redesigned */}
                      <div className="p-3.5 rounded-4" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.08) 100%)', border: '1.5px solid rgba(16,185,129,0.3)', borderRadius: '18px' }}>
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center gap-2.5">
                            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>🔬</div>
                            <div>
                              <strong className="d-block" style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>Kit glycémique & bandelettes</strong>
                              <small style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>Renouvellement mensuel gratuit</small>
                            </div>
                          </div>
                          <span style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 800, fontSize: '0.72rem', padding: '0.4rem 0.8rem', borderRadius: '10px', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}>100% Gratuit</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : activeMother.category === 'surgery' ? (
                  /* 🦴 SEMAINE / PROTOCOLE POST-OPÉRATOIRE (PATIENT CHIRURGIE) */
                  <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <span className="fs-4">🩹</span>
                        <div>
                          <h6 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>Protocole Post-Opératoire</h6>
                          <small className="text-muted d-block" style={{ fontSize: '0.76rem' }}>Chirurgie & Orthopédie UNAMUSC</small>
                        </div>
                      </div>
                      {canEditMaternity && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary fw-bold hover-lift"
                          style={{ borderRadius: '8px', fontSize: '0.74rem', padding: '0.25rem 0.6rem' }}
                          onClick={() => {
                            setEditingPostOpItem({ title: '', status: '✅ Fait', date: new Date().toLocaleDateString('fr-FR') });
                            setShowPostOpModal(true);
                          }}
                        >
                          ➕ Ajouter
                        </button>
                      )}
                    </div>

                    {/* Thromboprophylaxie Lovenox */}
                    <div className="p-3 rounded-3 mb-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1.5">
                        <small className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>💉 Anti-thrombotique (Lovenox 0.4ml)</small>
                        <span className="badge bg-success-subtle text-success fw-bold px-2 py-1" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>30 / 30 jours</span>
                      </div>
                      <div className="progress mb-1" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                        <div className="progress-bar bg-success" style={{ width: '100%', borderRadius: '6px' }}></div>
                      </div>
                      <small className="d-block text-muted" style={{ fontSize: '0.72rem', lineHeight: '1.35' }}>
                        Injections sous-cutanées quotidiennes accomplies avec succès
                      </small>
                    </div>

                    {/* Liste Dynamique Post-Op */}
                    <div className="mb-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <small className="text-muted fw-bold" style={{ fontSize: '0.75rem' }}>
                          🩺 Soins de cicatrisation & pansements
                        </small>
                      </div>

                      <div className="d-flex flex-column gap-2">
                        {postOpProtocolItems.map(item => (
                          <div key={item.id} className="p-2.5 rounded-3 d-flex align-items-center justify-content-between gap-2" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            <div className="d-flex flex-column">
                              <span className="fw-semibold" style={{ color: 'var(--text-main)' }}>{item.title}</span>
                              <small className="text-muted" style={{ fontSize: '0.72rem' }}>📅 {item.date}</small>
                            </div>

                            <div className="d-flex align-items-center gap-1.5">
                              <span className="badge bg-primary text-white fw-bold px-2 py-1" style={{ borderRadius: '6px', fontSize: '0.72rem' }}>{item.status}</span>
                              {canEditMaternity && (
                                <div className="d-flex gap-1.5">
                                  <button
                                    type="button"
                                    className="btn btn-sm fw-bold d-inline-flex align-items-center gap-1 hover-lift"
                                    title="Modifier"
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.18)',
                                      color: '#60a5fa',
                                      border: '1.5px solid #3b82f6',
                                      borderRadius: '10px',
                                      fontSize: '0.72rem',
                                      padding: '0.3rem 0.55rem',
                                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => { setEditingPostOpItem(item); setShowPostOpModal(true); }}
                                  >✏️</button>
                                  <button
                                    type="button"
                                    className="btn btn-sm fw-bold d-inline-flex align-items-center gap-1 hover-lift"
                                    title="Supprimer"
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.18)',
                                      color: '#f87171',
                                      border: '1.5px solid #ef4444',
                                      borderRadius: '10px',
                                      fontSize: '0.72rem',
                                      padding: '0.3rem 0.55rem',
                                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => handleDeletePostOpItem(item.id)}
                                  >🗑️</button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Attelle & Matériel Orthopédique */}
                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(59, 130, 246, 0.12)', border: '1px solid rgba(59, 130, 246, 0.35)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <span className="fs-5">🩼</span>
                        <div>
                          <strong className="d-block" style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>Attelle & canne anglaise</strong>
                          <small className="text-primary fw-bold" style={{ fontSize: '0.74rem' }}>Prise en charge matériel 100% CSU</small>
                        </div>
                      </div>
                      <span className="badge bg-primary text-white fw-bold px-2.5 py-1" style={{ borderRadius: '6px', fontSize: '0.72rem' }}>100% Gratuit</span>
                    </div>
                  </div>
                ) : (
                  /* 🤰 CARD SUPPLÉMENTATION MATERNELLE & TPI PALUDISME (PNLP SÉNÉGAL / UNAMUSC) */
                  <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-2.5">
                        <span className="fs-4">💊</span>
                        <div>
                          <h6 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '0.98rem' }}>Supplémentation & TPI paludisme</h6>
                          <small className="text-muted d-block" style={{ fontSize: '0.76rem' }}>Directives PNLP Sénégal & UNAMUSC</small>
                        </div>
                      </div>
                      {canEditMaternity && (
                        <button 
                          type="button" 
                          className="btn btn-sm btn-outline-success fw-bold hover-lift"
                          style={{ borderRadius: '10px', fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
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
                        <small className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>💊 Fer & acide folique (anti-anémie)</small>
                        <span className="badge bg-success-subtle text-success fw-bold px-2 py-1" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>
                          {maternalSupplements.ferFolateDaysTaken} / {maternalSupplements.ferFolateTotalDays} jours
                        </span>
                      </div>
                      <div className="progress mb-1" style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
                        <div className="progress-bar bg-success" style={{ width: `${Math.round((maternalSupplements.ferFolateDaysTaken / maternalSupplements.ferFolateTotalDays) * 100)}%`, borderRadius: '6px' }}></div>
                      </div>
                      <small className="d-block text-muted" style={{ fontSize: '0.72rem', lineHeight: '1.35' }}>
                        1 comprimé par jour prescrit pendant toute la grossesse
                      </small>
                    </div>

                    {/* TPI Paludisme (SP) */}
                    <div className="mb-3">
                      <small className="d-block text-muted fw-bold mb-2" style={{ fontSize: '0.75rem' }}>
                        🦟 TPI paludisme (Sulfadoxine-pyriméthamine)
                      </small>
                      <div className="d-flex flex-column gap-2">
                        {maternalSupplements.tpiDoses.map(dose => (
                          <div key={dose.id} className="d-flex align-items-center justify-content-between p-2.5 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            <span className="fw-semibold" style={{ color: 'var(--text-main)' }}>{dose.cpn}</span>
                            <span className={`badge ${dose.given ? 'bg-success text-white' : 'bg-warning text-dark'} fw-bold px-2.5 py-1`} style={{ borderRadius: '6px', fontSize: '0.72rem' }}>
                              {dose.given ? `✅ Administré` : `⏳ Programmé`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* MILDA Moustiquaire */}
                    <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <span className="fs-5">🛖</span>
                        <div>
                          <strong className="d-block" style={{ fontSize: '0.82rem', color: 'var(--text-main)' }}>Moustiquaire MILDA offerte</strong>
                          <small className="text-success fw-bold" style={{ fontSize: '0.74rem' }}>Remise certifiée CPN 1</small>
                        </div>
                      </div>
                      <span className="badge bg-success text-white fw-bold px-2.5 py-1" style={{ borderRadius: '6px', fontSize: '0.72rem' }}>100% Gratuit</span>
                    </div>
                  </div>
                )}

                {/* Card Vos Avantages CSU — Adaptatif selon la catégorie médicale */}
                <div className="p-4 rounded-4 text-white" style={{ 
                  background: activeMother.category === 'chronic' 
                    ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' 
                    : activeMother.category === 'surgery'
                    ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)' 
                }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.1rem' }}>
                      {activeMother.category === 'chronic' ? 'Vos garanties ALD 100% CSU' : activeMother.category === 'surgery' ? 'Vos garanties Chirurgie 100% CSU' : 'Vos avantages CSU'}
                    </h6>
                    <span style={{ fontSize: '1.5rem' }}>🇸🇳</span>
                  </div>

                  <p className="small mb-3" style={{ opacity: 0.95, lineHeight: '1.5' }}>
                    {activeMother.category === 'chronic' 
                      ? 'Dans le cadre du programme UNAMUSC, la prise en charge de votre affection de longue durée est exonérée à 100%.'
                      : activeMother.category === 'surgery'
                      ? 'Prise en charge intégrale UNAMUSC pour votre intervention orthopédique et vos soins de rééducation.'
                      : 'Dans le cadre du programme UNAMUSC, vos frais de maternité sont couverts à 100%.'}
                  </p>

                  <div className="d-flex flex-column gap-2 mb-4 small fw-semibold">
                    {activeMother.category === 'chronic' ? (
                      <>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Zéro ticket modérateur :</strong> Consultations spécialisées & bilans glycémiques.</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Médicaments ALD :</strong> Antidiabétiques & antihypertenseurs 100% gratuits.</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Auto-surveillance :</strong> Kit lecteur & 100 bandelettes offertes par mois.</span>
                        </div>
                      </>
                    ) : activeMother.category === 'surgery' ? (
                      <>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Chirurgie & bloc :</strong> Gratuité des frais d'opérations et d'hospitalisation.</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Radiologie DICOM :</strong> Radiographies, scanners et IRM 100% couverts.</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Kinésithérapie :</strong> 10 séances de rééducation et orthèses offertes.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Zéro dépense :</strong> Consultations & examens biologiques.</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Accouchement :</strong> Gratuité totale en structure publique.</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span>✓</span> <span><strong>Pédiatrie :</strong> Soins offerts jusqu'à 5 ans.</span>
                        </div>
                      </>
                    )}
                  </div>

                  <button 
                    type="button"
                    className="hover-lift"
                    style={{ background: 'rgba(255, 255, 255, 0.22)', backdropFilter: 'blur(10px)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.4)', borderRadius: '12px', padding: '0.7rem 1rem', fontWeight: '800', width: '100%', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.15)', transition: 'all 0.2s ease' }}
                    onClick={() => setShowRightsModal(true)}
                  >
                    En savoir plus sur mes droits
                  </button>
                </div>

                {/* Card Médecin / Praticien de garde — Adaptatif */}
                <div className="p-3.5 rounded-4 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-3">
                    <img src={activeMother.category === 'chronic' ? '/mariama_avatar.png' : activeMother.category === 'surgery' ? '/mariama_avatar.png' : '/dr_fatou_diop.png'} onError={(e) => { e.target.src = '/mariama_avatar.png'; }} alt="Praticien" style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <small className="d-block text-muted" style={{ fontSize: '0.72rem' }}>
                        {activeMother.category === 'chronic' ? 'Médecin référent ALD / diabétologue' : activeMother.category === 'surgery' ? 'Chirurgien orthopédiste de garde' : 'Sage-femme de garde'}
                      </small>
                      <strong className="small d-block" style={{ color: 'var(--text-main)' }}>
                        {activeMother.category === 'chronic' ? 'Dr. Ousmane Sow' : activeMother.category === 'surgery' ? 'Dr. Babacar Kane' : 'Dr. Fatou Diome'}
                      </strong>
                    </div>
                  </div>

                  <button 
                    type="button"
                    className="hover-lift"
                    style={{ background: 'var(--bg-card-subtle)', color: '#10b981', border: '1px solid #10b981', borderRadius: '10px', padding: '0.45rem 0.85rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                    onClick={() => setShowAskMidwifeModal(true)}
                  >
                    {activeMother.category === 'chronic' ? '💬 Contacter le médecin' : activeMother.category === 'surgery' ? '🚨 Signaler une douleur' : 'Poser une question'}
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CROISSANCE & VACCINS PEV / PHARMACIE ALD / IMAGERIE SURGERY */}
        {activeTab === 'pev' && (
          <>
            {/* Cas 1: PATIENT CHRONIQUE (Diabète / HTA / ALD) */}
            {activeMother.category === 'chronic' ? (
              <div className="d-flex flex-column gap-4 mb-5">
                {/* KPI Cards Summary ALD */}
                <div className="row g-3 mb-2">
                  <div className="col-md-4">
                    <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        💊
                      </div>
                      <div>
                        <small className="d-block text-muted fw-bold" style={{ fontSize: '0.74rem' }}>Traitement ALD actif</small>
                        <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{aldPrescriptions.length} médicaments prescrits</strong>
                        <small className="d-block text-danger fw-bold" style={{ fontSize: '0.78rem' }}>✓ Renouvellement 6 mois CSU</small>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        🧪
                      </div>
                      <div>
                        <small className="d-block text-muted fw-bold" style={{ fontSize: '0.74rem' }}>Bilan biologique récent</small>
                        <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>HbA1c : 6.9% (Objectif &lt; 7%)</strong>
                        <small className="d-block text-success fw-bold" style={{ fontSize: '0.78rem' }}>Glycémie à jeun : 1.25 g/L</small>
                      </div>
                    </div>
                  </div>

                  <div className="col-md-4">
                    <div className="p-3.5 rounded-4 d-flex align-items-center gap-3 h-100" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
                        🛡️
                      </div>
                      <div>
                        <small className="d-block text-muted fw-bold" style={{ fontSize: '0.74rem' }}>Prise en charge ALD</small>
                        <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>100% Intégrale UNAMUSC</strong>
                        <small className="d-block text-primary fw-bold" style={{ fontSize: '0.78rem' }}>Exonération du ticket modérateur</small>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ordonnances & Pharmacie ALD Table Card DYNAMIQUE ET AVEC CRUD COMPLET */}
                <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                    <div>
                      <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>💊 Ordonnance thérapeutique & traitement ALD permanent</h5>
                      <small className="text-muted" style={{ fontSize: '0.82rem' }}>Délivrance gratuite en pharmacie agréée UNAMUSC sur présentation de la carte CSU N° {activeMother.cmuNumber}</small>
                    </div>
                    <div className="d-flex gap-2">
                      {canEditMaternity && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger fw-bold hover-lift"
                          style={{ borderRadius: '10px', padding: '0.45rem 0.9rem' }}
                          onClick={() => {
                            setEditingPrescription({ name: '', form: '', specialty: '🩸 Diabétologie', dosage: '', coverage: '✅ 100% CSU Gratuit' });
                            setShowPrescriptionModal(true);
                          }}
                        >
                          ➕ Prescrire un médicament
                        </button>
                      )}
                      <button type="button" className="btn btn-sm btn-danger fw-bold hover-lift" style={{ borderRadius: '10px', padding: '0.45rem 0.9rem' }} onClick={handleGenerateDeliveryCertificate}>
                        📜 Imprimer l'ordonnance ALD 100% PDF
                      </button>
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table align-middle" style={{ minWidth: '750px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                          <th>Médicament prescrit</th>
                          <th>Spécialité & motif</th>
                          <th>Posologie quotidienne</th>
                          <th>Statut prise en charge</th>
                          {canEditMaternity && <th style={{ textAlign: 'right' }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {aldPrescriptions.map(p => (
                          <tr key={p.id}>
                            <td>
                              <strong className="text-primary">{p.name}</strong>
                              <br/><small className="text-muted">{p.form}</small>
                            </td>
                            <td>
                              <span className="badge bg-danger-subtle text-danger border border-danger">{p.specialty}</span>
                            </td>
                            <td>{p.dosage}</td>
                            <td><span className="badge bg-success text-white">{p.coverage}</span></td>
                            {canEditMaternity && (
                              <td style={{ textAlign: 'right' }}>
                                <div className="d-flex justify-content-end gap-1.5">
                                  <button type="button" className="btn btn-sm btn-outline-primary py-1 px-2 hover-lift" style={{ fontSize: '0.75rem', borderRadius: '6px' }} onClick={() => { setEditingPrescription(p); setShowPrescriptionModal(true); }}>✏️</button>
                                  <button type="button" className="btn btn-sm btn-outline-danger py-1 px-2 hover-lift" style={{ fontSize: '0.75rem', borderRadius: '6px' }} onClick={() => handleDeletePrescription(p.id)}>🗑️</button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeMother.category === 'surgery' ? (
              /* Cas 2: PATIENT CHIRURGIE / TRAUMATOLOGIE */
              <div className="d-flex flex-column gap-4 mb-5">
                <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                    <div>
                      <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>🦴 Galerie d'imagerie radiologique DICOM & examens osseux</h5>
                      <small className="text-muted" style={{ fontSize: '0.82rem' }}>Radio numérique de contrôle post-opératoire et scanners d'ostéosynthèse</small>
                    </div>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="p-3.5 rounded-4 border d-flex flex-column gap-2" style={{ background: 'var(--bg-card-subtle)' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <strong className="text-warning">🦴 Radio fémur droit (face & profil J+30)</strong>
                          <span className="badge bg-success text-white">Archive DICOM</span>
                        </div>
                        <img src="/csu_dicom_xray.jpg" alt="Radio Fémur DICOM" style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '12px', border: '1px solid var(--border-color)' }} />
                        <small className="text-muted">Observation : Cal osseux régulier en cours de formation. Plaque d'ostéosynthèse parfaitement alignée.</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="p-3.5 rounded-4 border d-flex flex-column gap-2" style={{ background: 'var(--bg-card-subtle)' }}>
                        <div className="d-flex justify-content-between align-items-center">
                          <strong className="text-primary">💊 Ordonnance antalgique & anticoagulant</strong>
                          <span className="badge bg-success text-white">100% CSU</span>
                        </div>
                        <div className="p-3 rounded-3 border" style={{ background: 'var(--bg-card)' }}>
                          <strong className="d-block text-primary small">Lovenox 0.4 ml (Injections HBPM)</strong>
                          <small className="text-muted d-block">1 injection sous-cutanée par jour pendant 30 jours (prévention phlébite).</small>
                          <strong className="d-block text-danger small mt-2">Paracétamol codeiné 500mg/30mg</strong>
                          <small className="text-muted d-block">1 gélule toutes les 6 heures si douleur importante.</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Cas 3: MATERNITÉ / PÉDIATRIE (Code existant pour PEV & Croissance Enfant) */
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
                          <small className="d-block text-muted fw-bold" style={{ fontSize: '0.74rem' }}>Bébé rattaché</small>
                          <strong style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{babyProfile.name}</strong>
                          <small className="d-block text-success fw-bold" style={{ fontSize: '0.78rem' }}>
                            Né le {new Date(babyProfile.birthDate).toLocaleDateString('fr-FR')} • <span className="badge bg-success-subtle text-success border border-success">{calculateBabyAge(babyProfile.birthDate)}</span>
                          </small>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-success fw-bold ms-2 hover-lift"
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
                        <small className="d-block text-muted fw-bold" style={{ fontSize: '0.74rem' }}>Progression vaccinale</small>
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
                        <small className="d-block text-muted fw-bold" style={{ fontSize: '0.74rem' }}>Prochaine échéance</small>
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
                      <span className="small text-white-50 fw-bold" style={{ fontSize: '0.83rem' }}>Choix de la langue vocale :</span>
                      <div className="btn-group btn-group-sm" role="group">
                        <button 
                          type="button" 
                          style={{ 
                            background: audioLang === 'fr' ? '#059669' : 'rgba(30, 41, 59, 0.9)', 
                            color: '#ffffff', 
                            border: audioLang === 'fr' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)', 
                            borderRadius: '8px 0 0 8px', 
                            padding: '0.35rem 0.75rem', 
                            fontSize: '0.78rem', 
                            fontWeight: '700',
                            cursor: 'pointer'
                          }} 
                          onClick={() => setAudioLang('fr')}
                        >
                          🗣️ Français
                        </button>
                        <button 
                          type="button" 
                          style={{ 
                            background: audioLang === 'wolof' ? '#059669' : 'rgba(30, 41, 59, 0.9)', 
                            color: '#ffffff', 
                            border: audioLang === 'wolof' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)', 
                            padding: '0.35rem 0.75rem', 
                            fontSize: '0.78rem', 
                            fontWeight: '700',
                            cursor: 'pointer'
                          }} 
                          onClick={() => setAudioLang('wolof')}
                        >
                          🗣️ Wolof
                        </button>
                        <button 
                          type="button" 
                          style={{ 
                            background: audioLang === 'pulaar' ? '#059669' : 'rgba(30, 41, 59, 0.9)', 
                            color: '#ffffff', 
                            border: audioLang === 'pulaar' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.2)', 
                            borderRadius: '0 8px 8px 0', 
                            padding: '0.35rem 0.75rem', 
                            fontSize: '0.78rem', 
                            fontWeight: '700',
                            cursor: 'pointer'
                          }} 
                          onClick={() => setAudioLang('pulaar')}
                        >
                          🗣️ Pulaar
                        </button>
                      </div>
                    </div>

                    <div className="d-flex gap-2.5 flex-wrap">
                      <button 
                        type="button"
                        className="hover-lift"
                        style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.55rem 1.1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)' }}
                        disabled={reminderSending}
                        onClick={() => triggerInstantReminder('sms', audioLang)}
                      >
                        <span>💬</span> {reminderSending ? 'Envoi...' : 'Envoyer un rappel SMS / WhatsApp immédiat'}
                      </button>

                      <button 
                        type="button"
                        className="hover-lift"
                        style={{ background: '#1e3a8a', color: '#ffffff', border: '1px solid #3b82f6', borderRadius: '12px', padding: '0.55rem 1.1rem', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)' }}
                        disabled={reminderSending}
                        onClick={() => triggerInstantReminder('voice', audioLang)}
                      >
                        <span>🔊</span> Relance vocale ({audioLang.toUpperCase()})
                      </button>

                      <button 
                        type="button"
                        className="hover-lift"
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
                          className="btn btn-sm btn-success fw-bold text-white shadow-sm hover-lift"
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
                      <small className="fw-bold text-emerald-400" style={{ fontSize: '0.82rem' }}>📈 Trajectoire de poids (kg) vs couloir vert OMS (percentile 3 à 97)</small>
                      <small className="text-slate-400" style={{ fontSize: '0.78rem' }}>Dernière pesée : {babyGrowth[babyGrowth.length - 1]?.date} ({babyGrowth[babyGrowth.length - 1]?.weight} kg)</small>
                    </div>

                    <div style={{ width: '100%', height: '140px', position: 'relative' }}>
                      <svg width="100%" height="100%" viewBox="0 0 500 120" preserveAspectRatio="none">
                        <path d="M 30 90 Q 250 55 470 20 L 470 45 Q 250 80 30 110 Z" fill="rgba(16, 185, 129, 0.18)" />
                        <path d="M 30 100 Q 250 67 470 32" fill="none" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="2" strokeDasharray="4 4" />
                        <path d="M 30 95 Q 250 60 470 25" fill="none" stroke="#10b981" strokeWidth="3.5" />
                        {babyGrowth.map((g, idx) => {
                          const x = 30 + (idx / Math.max(1, babyGrowth.length - 1)) * 440;
                          const y = 95 - (idx * 23);
                          return (
                            <g key={g.id}>
                              <circle cx={x} cy={y} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                              <text x={x} y={y - 10} fill="#ffffff" fontSize="10" fontWeight="bold" textAnchor="middle">{g.weight} kg</text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* TABLEAU HISTORIQUE DE PESÉE OMS */}
                  <div className="table-responsive">
                    <table className="table align-middle mb-0" style={{ minWidth: '750px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                          <th>Échéance mensuelle</th>
                          <th>Date pesée</th>
                          <th>Poids (kg)</th>
                          <th>Taille (cm)</th>
                          <th>Périmètre crânien</th>
                          <th>Statut OMS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {babyGrowth.map((row) => (
                          <tr key={row.id}>
                            <td><strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{row.month}</strong></td>
                            <td><span style={{ color: 'var(--text-sub)', fontSize: '0.84rem' }}>📅 {row.date}</span></td>
                            <td><span className="fw-bold text-success" style={{ fontSize: '0.92rem' }}>⚖️ {row.weight} kg</span></td>
                            <td><span style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>📏 {row.height} cm</span></td>
                            <td><span style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>🧠 {row.head} cm</span></td>
                            <td>
                              <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '8px', padding: '0.35rem 0.7rem', fontSize: '0.76rem' }}>
                                🟢 {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 🛡️ PROGRAMME ÉLARGI DE VACCINATION PEV (SÉNÉGAL 0-12 MOIS) */}
                <div className="p-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px' }}>
                  <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-3">
                      <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
                        🛡️
                      </div>
                      <div>
                        <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Programme élargi de vaccination (PEV Sénégal 0-12 mois)</h5>
                        <small className="text-muted" style={{ fontSize: '0.82rem' }}>Prise en charge intégrale à 100% UNAMUSC dans tous les centres publics du Sénégal</small>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline-success fw-bold hover-lift"
                      style={{ borderRadius: '10px', padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                      onClick={handleGenerateDeliveryCertificate}
                    >
                      📥 Télécharger carnet vaccinal PDF
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="table align-middle" style={{ minWidth: '850px' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', fontSize: '0.78rem' }}>
                          <th>Échéance / âge</th>
                          <th>Vaccins obligatoires</th>
                          <th>Maladies protégées</th>
                          <th>Structure agréée</th>
                          <th>Statut PEV</th>
                          <th>Actions médicales</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vaccinations.map((vac) => (
                          <tr key={vac.id}>
                            <td>
                              <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{vac.ageLabel}</strong>
                              <small className="d-block text-muted" style={{ fontSize: '0.74rem' }}>PEV Sénégal</small>
                            </td>
                            <td>
                              <strong className="text-primary d-block" style={{ fontSize: '0.88rem' }}>{vac.vaccines}</strong>
                              <small className="text-muted" style={{ fontSize: '0.74rem' }}>{vac.subtext}</small>
                            </td>
                            <td><span style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>{vac.diseases}</span></td>
                            <td><span style={{ color: 'var(--text-main)', fontSize: '0.82rem' }}>🏥 {vac.structure}</span></td>
                            <td>
                              <span className={`badge ${vac.completed ? 'bg-success text-white' : 'bg-warning-subtle text-warning border border-warning'}`} style={{ borderRadius: '8px', padding: '0.35rem 0.7rem', fontSize: '0.76rem' }}>
                                {vac.completed ? '✅ Administré (100% CSU)' : `🗓️ ${vac.status}`}
                              </span>
                            </td>
                            <td>
                              {canEditMaternity && (
                                <div className="d-flex gap-2">
                                  <button type="button" className="btn btn-sm btn-outline-primary" style={{ borderRadius: '6px', fontSize: '0.72rem' }}>✏️ Modifier</button>
                                  <button type="button" className="btn btn-sm btn-outline-danger" style={{ borderRadius: '6px', fontSize: '0.72rem' }}>🗑️ Supprimer</button>
                                </div>
                              )}
                            </td>
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
          </>
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
                    <span className="small text-muted fw-bold" style={{ fontSize: '0.76rem' }}>Bébé rattaché</span>
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
              <button type="button" className="btn px-4 py-2.5 fw-bold hover-lift" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} onClick={() => setShowAddVaccineModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-2.5 fw-bold text-white shadow-sm hover-lift" style={{ background: '#059669', borderColor: '#059669', borderRadius: '12px', fontSize: '0.9rem' }}>💾 Enregistrer la vaccination</button>
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
                    <span className="small text-muted fw-bold" style={{ fontSize: '0.76rem' }}>Bébé rattaché</span>
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
                    playEmergencyVoiceInstruction(selectedDangerSign, audioLang);
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

      {/* MODAL DE CRÉATION / ÉDITION MÈRE RÉGISTRE ÉTABLISSEMENT (React Portal) */}
      {editingMother && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingMother(null); }}
        >
          <form onSubmit={handleSaveMother} style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  🏥
                </div>
                <div>
                  <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                    {isNewMother ? 'Inscrire un nouvel assuré dans l\'établissement' : 'Modifier le dossier patient du registre'}
                  </h5>
                  <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                    {partnerUser?.structureName || partnerUser?.name || 'Hôpital Principal de Dakar'}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setEditingMother(null)}></button>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Nom & Prénom de l'assuré *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.name || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, name: e.target.value })}
                  placeholder="Ex: Mamadou Ndiaye"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">N° Carte CSU *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.cmuNumber || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, cmuNumber: e.target.value })}
                  placeholder="Ex: CMU-DKR-2026-5541"
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Sexe / Genre</label>
                <select 
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.gender || 'F'}
                  onChange={(e) => setEditingMother({ ...editingMother, gender: e.target.value })}
                >
                  <option value="F">Femme (F)</option>
                  <option value="M">Homme (M)</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Âge (Ans)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.age || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, age: e.target.value })}
                  placeholder="Ex: 54"
                />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Téléphone de contact</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.phone || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, phone: e.target.value })}
                  placeholder="Ex: +221 77 612 88 11"
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Catégorie Médicale</label>
                <select 
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.category || 'maternity'}
                  onChange={(e) => setEditingMother({ ...editingMother, category: e.target.value })}
                >
                  <option value="maternity">🤰 Maternité & CPN</option>
                  <option value="chronic">🩸 Maladies Chroniques (Diabète/HTA)</option>
                  <option value="pediatric">👶 Pédiatrie (0-5 ans)</option>
                  <option value="surgery">🩹 Traumatologie & Chirurgie</option>
                </select>
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Pathologie / Diagnostique</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.pathology || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, pathology: e.target.value })}
                  placeholder="Ex: Diabète Type 2 & HTA Sévère"
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Prochain RDV / Échéance</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.edd || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, edd: e.target.value })}
                  placeholder="Ex: 15/10/2026 ou Suivi mensuel"
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Praticien référent</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingMother.doctorRef || ''}
                  onChange={(e) => setEditingMother({ ...editingMother, doctorRef: e.target.value })}
                  placeholder="Ex: Dr. Ousmane Sow (Cardiologie)"
                />
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn px-4 py-2.5 fw-bold" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                onClick={() => setEditingMother(null)}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn px-4.5 py-2.5 fw-bold text-white" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
              >
                💾 Enregistrer au registre
              </button>
            </div>

          </form>
        </div>,
        document.body
      )}

      {/* MODALE D'ÉDITION ET D'AJOUT D'EXAMEN DE SURVEILLANCE ALD */}
      {showAldModal && editingAldItem && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: '500px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)' }}>
            <h5 className="fw-extrabold mb-3 text-danger">🛡️ {editingAldItem.id ? "Modifier un bilan ALD" : "Ajouter un examen de surveillance ALD"}</h5>
            <form onSubmit={handleSaveAldItem} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small fw-bold mb-1">Intitulé de l'examen / bilan *</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldItem.title || ''}
                  onChange={(e) => setEditingAldItem({ ...editingAldItem, title: e.target.value })}
                  placeholder="Ex: 👁️ Fond d'œil annuel (Rétinopathie)"
                  required
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Date de réalisation</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldItem.date || ''}
                  onChange={(e) => setEditingAldItem({ ...editingAldItem, date: e.target.value })}
                  placeholder="Ex: 10/04/2026"
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Résultat / Statut médical</label>
                <select
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldItem.status || '✅ Normal'}
                  onChange={(e) => setEditingAldItem({ ...editingAldItem, status: e.target.value })}
                >
                  <option value="✅ Normal">✅ Normal</option>
                  <option value="✅ Pas de lésion">✅ Pas de lésion</option>
                  <option value="✅ Effectué">✅ Effectué</option>
                  <option value="⏳ Programmé">⏳ Programmé / À venir</option>
                  <option value="⚠️ À surveiller">⚠️ À surveiller</option>
                </select>
              </div>
              <div className="d-flex justify-content-end gap-2 pt-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setShowAldModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-danger rounded-3 fw-bold text-white">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE D'ÉDITION ET D'AJOUT D'ÉLÉMENT POST-OPÉRATOIRE */}
      {showPostOpModal && editingPostOpItem && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: '500px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)' }}>
            <h5 className="fw-extrabold mb-3 text-primary">🩹 {editingPostOpItem.id ? "Modifier un soin Post-Op" : "Ajouter un élément de suivi Post-Op"}</h5>
            <form onSubmit={handleSavePostOpItem} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small fw-bold mb-1">Intitulé du soin / intervention *</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPostOpItem.title || ''}
                  onChange={(e) => setEditingPostOpItem({ ...editingPostOpItem, title: e.target.value })}
                  placeholder="Ex: 🩹 Pansements stériles J+3 à J+14"
                  required
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Date</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPostOpItem.date || ''}
                  onChange={(e) => setEditingPostOpItem({ ...editingPostOpItem, date: e.target.value })}
                  placeholder="Ex: 25/05/2026"
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Statut du soin</label>
                <select
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPostOpItem.status || '✅ Fait'}
                  onChange={(e) => setEditingPostOpItem({ ...editingPostOpItem, status: e.target.value })}
                >
                  <option value="✅ Fait">✅ Fait</option>
                  <option value="✅ Ablation faite">✅ Ablation faite</option>
                  <option value="⏳ En cours">⏳ En cours</option>
                  <option value="📅 Programmé">📅 Programmé</option>
                </select>
              </div>
              <div className="d-flex justify-content-end gap-2 pt-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setShowPostOpModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary rounded-3 fw-bold text-white">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE DE PRESCRIPTION ALD (CRÉATION / MODIFICATION) */}
      {showPrescriptionModal && editingPrescription && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)' }}>
            <h5 className="fw-extrabold mb-3 text-danger">💊 {editingPrescription.id ? "Modifier la prescription ALD" : "Prescrire un nouveau traitement ALD"}</h5>
            <form onSubmit={handleSavePrescription} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small fw-bold mb-1">Nom du médicament & Dosage *</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPrescription.name || ''}
                  onChange={(e) => setEditingPrescription({ ...editingPrescription, name: e.target.value })}
                  placeholder="Ex: Metformine 1000 mg"
                  required
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Forme galénique</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPrescription.form || ''}
                  onChange={(e) => setEditingPrescription({ ...editingPrescription, form: e.target.value })}
                  placeholder="Ex: Comprimés sécables"
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Spécialité & Motif médical</label>
                <select
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPrescription.specialty || '🩸 Diabétologie'}
                  onChange={(e) => setEditingPrescription({ ...editingPrescription, specialty: e.target.value })}
                >
                  <option value="🩸 Diabétologie">🩸 Diabétologie</option>
                  <option value="🫀 Cardiologie / HTA">🫀 Cardiologie / HTA</option>
                  <option value="🔬 Auto-Contrôle">🔬 Auto-Contrôle (Kit & Bandelettes)</option>
                  <option value="🧠 Neurologie">🧠 Neurologie</option>
                  <option value="🩺 Médecine Générale">🩺 Médecine Générale</option>
                </select>
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Posologie Quotidienne</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPrescription.dosage || ''}
                  onChange={(e) => setEditingPrescription({ ...editingPrescription, dosage: e.target.value })}
                  placeholder="Ex: 1 comprimé matin et soir au milieu des repas"
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Prise en charge CSU</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingPrescription.coverage || '✅ 100% CSU Gratuit'}
                  onChange={(e) => setEditingPrescription({ ...editingPrescription, coverage: e.target.value })}
                />
              </div>
              <div className="d-flex justify-content-end gap-2 pt-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setShowPrescriptionModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-danger rounded-3 fw-bold text-white">💾 Enregistrer la prescription</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE DES CONSTANTES VITALES ALD (CRÉATION / MODIFICATION) */}
      {showAldVitalModal && editingAldVital && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ maxWidth: '500px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)' }}>
            <h5 className="fw-extrabold mb-3 text-success">📈 {editingAldVital.id ? "Modifier la constante vitale" : "Consigner une constante vitale ALD"}</h5>
            <form onSubmit={handleSaveAldVital} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label small fw-bold mb-1">Type de constante *</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldVital.type || ''}
                  onChange={(e) => setEditingAldVital({ ...editingAldVital, type: e.target.value })}
                  placeholder="Ex: Glycémie à jeun, Tension Artérielle"
                  required
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Valeur Mesurée *</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldVital.value || ''}
                  onChange={(e) => setEditingAldVital({ ...editingAldVital, value: e.target.value })}
                  placeholder="Ex: 1.25 g/L ou 135/85 mmHg"
                  required
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Objectif thérapeutique</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldVital.target || ''}
                  onChange={(e) => setEditingAldVital({ ...editingAldVital, target: e.target.value })}
                  placeholder="Ex: Objectif < 1.26 g/L"
                />
              </div>
              <div>
                <label className="form-label small fw-bold mb-1">Statut Médical</label>
                <select
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingAldVital.status || '🟢 Dans la cible'}
                  onChange={(e) => setEditingAldVital({ ...editingAldVital, status: e.target.value })}
                >
                  <option value="🟢 Dans la cible">🟢 Dans la cible</option>
                  <option value="🟢 Contrôlée">🟢 Contrôlée</option>
                  <option value="🟢 Optimal">🟢 Optimal</option>
                  <option value="⚠️ À surveiller">⚠️ À surveiller</option>
                  <option value="🔴 Élevée">🔴 Élevée / Attention</option>
                </select>
              </div>
              <div className="d-flex justify-content-end gap-2 pt-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setShowAldVitalModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-success rounded-3 fw-bold text-white">💾 Enregistrer constante</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL / POP-UP DE CONFIRMATION DE SUPPRESSION UNIVERSEL (React Portal) */}
      {confirmDeleteObj && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.82)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 9999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteObj(null); }}
        >
          <div 
            className="shadow-2xl text-center" 
            style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-card, #1e293b)', color: 'var(--text-main, #ffffff)', borderRadius: '24px', padding: '2.25rem 1.75rem', border: '1.5px solid rgba(239, 68, 68, 0.4)', boxShadow: '0 25px 70px rgba(239, 68, 68, 0.25), 0 10px 30px rgba(0, 0, 0, 0.5)', margin: 'auto' }}
          >
            <div 
              style={{ width: '72px', height: '72px', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.35) 100%)', border: '2px solid #ef4444', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', margin: '0 auto 1.25rem auto', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)' }}
            >
              🗑️
            </div>

            <h4 className="fw-extrabold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
              Confirmer la suppression
            </h4>

            <p className="mb-4" style={{ color: 'var(--text-sub, #94a3b8)', fontSize: '0.92rem', lineHeight: '1.55' }}>
              Voulez-vous vraiment supprimer définitivement <strong style={{ color: '#ef4444' }}>{confirmDeleteObj.title}</strong> ?
              <br />
              <small className="text-muted d-block mt-1">Cette action est irréversible dans le système UNAMUSC.</small>
            </p>

            <div className="d-flex justify-content-center gap-3 pt-2">
              <button
                type="button"
                className="btn px-4 py-2.5 fw-bold"
                style={{ background: 'var(--bg-card-subtle, #334155)', color: 'var(--text-main, #ffffff)', border: '1px solid var(--border-color, #475569)', borderRadius: '12px', fontSize: '0.88rem' }}
                onClick={() => setConfirmDeleteObj(null)}
              >
                Annuler
              </button>

              <button
                type="button"
                className="btn px-4 py-2.5 fw-bold text-white"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)', border: 'none', borderRadius: '12px', fontSize: '0.88rem', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)' }}
                onClick={() => {
                  confirmDeleteObj.onConfirm();
                  setConfirmDeleteObj(null);
                }}
              >
                🗑️ Supprimer définitivement
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
