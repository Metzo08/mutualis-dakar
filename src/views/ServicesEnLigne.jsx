import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { outboxAdd } from '../utils/offline';

export default function ServicesEnLigne({ lang, initialTab = 'register', initialPackage = 'individuel', setView, setViewTab }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  // Registration States
  const [regStep, setRegStep] = useState(1);
  const [selectedMutuelle, setSelectedMutuelle] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(initialPackage);

  useEffect(() => {
    if (initialPackage) {
      setSelectedPackage(initialPackage);
    }
  }, [initialPackage]);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', birthDate: '', phone: '', email: '', address: '', cni: null, photo: null
  });
  const [familyMembers, setFamilyMembers] = useState([]);
  const [newFamilyMember, setNewFamilyMember] = useState({ name: '', relation: 'enfant', age: '' });
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);
  const [sponsorPhone, setSponsorPhone] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [parrainageType, setParrainageType] = useState('individuel');
  const [sponsoredHouseholds, setSponsoredHouseholds] = useState([]);
  
  // Renewal States
  const [renewPhone, setRenewPhone] = useState('');
  const [renewLogged, setRenewLogged] = useState(false);
  const [renewStep, setRenewStep] = useState(1); // 1: login, 2: dues info, 3: pay, 4: done
  const [renewOtpSent, setRenewOtpSent] = useState(false);
  const [renewOtpCode, setRenewOtpCode] = useState('');
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, loading, success

  // Donation States
  const [donateAmount, setDonateAmount] = useState('5000');
  const [donateTarget, setDonateTarget] = useState('general');
  const [donateSuccess, setDonateSuccess] = useState(false);
  const [donateStep, setDonateStep] = useState(1); // 1: config, 2: choose method & phone, 3: OTP verify
  const [donatePaymentMethod, setDonatePaymentMethod] = useState('wave');
  const [donatePhone, setDonatePhone] = useState('');
  const [donateOtpSent, setDonateOtpSent] = useState(false);
  const [donateOtpCode, setDonateOtpCode] = useState('');

  const [donationTotals, setDonationTotals] = useState({
    general: 3450000,
    rufisque: 720000,
    keurmassar: 1125000
  });

  const donationGoals = {
    general: 5000000,
    rufisque: 1000000,
    keurmassar: 2500000
  };

  const fetchDonationStats = () => {
    fetch('http://localhost:5000/api/donations/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stats) {
          const newTotals = {
            general: 3450000,
            rufisque: 720000,
            keurmassar: 1125000
          };
          data.stats.forEach(item => {
            const tgt = item.target;
            const amt = parseInt(item.total || 0);
            if (newTotals[tgt] !== undefined) {
              newTotals[tgt] += amt;
            } else {
              newTotals[tgt] = amt;
            }
          });
          setDonationTotals(newTotals);
        }
      })
      .catch(err => console.warn('Failed to fetch donation stats:', err));
  };

  useEffect(() => {
    fetchDonationStats();
  }, [activeTab]);

  // Integration States
  const [generatedCmuNumber, setGeneratedCmuNumber] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [renewedBeneficiary, setRenewedBeneficiary] = useState(null);
  
  // Custom Error Banner State
  const [error, setError] = useState('');
  const showError = (msg) => {
    setError(msg);
    // Auto clear error after 6 seconds
    setTimeout(() => {
      setError(prev => prev === msg ? '' : prev);
    }, 6000);
  };

  // Reset errors on step/tab changes
  useEffect(() => {
    setError('');
  }, [activeTab, regStep, renewStep, donateStep]);

  // Liste dynamique des mutuelles chargée depuis l'API
  const [mutuellesList, setMutuellesList] = useState([]);

  // Chargement de la liste des mutuelles depuis l'API au montage du composant
  useEffect(() => {
    const fallbackList = [
      'Mutuelle de la Médina',
      'Mutuelle de Dakar Plateau',
      'Mutuelle de Pikine Ouest',
      'Mutuelle de Yeumbeul',
      'Mutuelle de Golf Sud (Guédiawaye)',
      'Mutuelle de Rufisque Est',
      'Mutuelle de Sangalkam',
      'Mutuelle de Keur Massar Nord'
    ];
    fetch('http://localhost:5000/api/mutuelles')
      .then(res => {
        if (!res.ok) throw new Error('Erreur API');
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          setMutuellesList(data.map(m => m.name));
        } else {
          setMutuellesList(fallbackList);
        }
      })
      .catch(() => {
        setMutuellesList(fallbackList);
      });
  }, []);

  useEffect(() => {
    if (generatedCmuNumber) {
      QRCode.toDataURL(generatedCmuNumber, {
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
  }, [generatedCmuNumber]);

  const dict = {
    fr: {
      tabRegister: 'Nouvelle adhésion',
      tabRenew: 'Renouvellement cotisation',
      tabDonate: 'Module de dons',
      btnNext: 'Continuer',
      btnPrev: 'Retour',
      step1Title: 'Choix du package de cotisation',
      step1Desc: 'Sélectionnez la formule la plus adaptée à vos besoins.',
      step2Title: 'Choix de votre mutuelle',
      step2Desc: 'Sélectionnez la mutuelle de santé locale de votre commune de résidence à Dakar.',
      step3Title: 'Informations personnelles',
      step3Desc: 'Remplissez vos coordonnées civiles et de contact.',
      step4Title: 'Ayants droit (famille)',
      step4Desc: 'Ajoutez les membres de votre famille qui bénéficieront également de la couverture maladie.',
      step5Title: 'Pièces justificatives',
      step5Desc: 'Téléchargez une copie de votre pièce d\'identité (CNI) et votre photo d\'identité.',
      step6Title: 'Vérification des données',
      step6Desc: 'Veuillez vérifier les informations ci-dessous avant de procéder au paiement.',
      step7Title: 'Paiement sécurisé',
      step7Desc: 'Réglez vos cotisations via Orange Money ou Wave.',
      step8Title: 'Adhésion validée !',
      step8Desc: 'Félicitations ! Votre adhésion a été validée. Voici votre carte QR de santé numérique.',
      packageIndiv: 'Formule individuelle',
      packageIndivPrice: '4 500 FCFA / an',
      packageFam: 'Formule familiale',
      packageFamPrice: '1 000 FCFA carte + 3 500 FCFA / membre (an)',
      addFamilyBtn: 'Ajouter un membre',
      verifyLabel: 'Récapitulatif',
      payBtn: 'Confirmer et payer',
      successCardTitle: 'Carte QR santé',
      downloadReceipt: 'Télécharger le reçu PDF',
      otpMessage: 'Un code OTP de vérification a été envoyé sur votre téléphone. Veuillez le saisir pour valider la transaction.',
      renewTitle: 'Espace de renouvellement',
      renewDesc: 'Connectez-vous pour consulter le solde de vos cotisations annuelles et renouveler vos droits.',
      renewLoginBtn: 'Se connecter',
      renewDuesTitle: 'Vos cotisations dues',
      renewSuccess: 'Votre cotisation a été renouvelée avec succès pour l\'année 2026 !',
      donateTitle: 'Faire un don à la mutualité',
      donateDesc: 'Soutenez les mutuelles de santé communautaires pour faciliter l\'accès aux soins des plus démunis.',
      donateAmountLabel: 'Montant du don (FCFA)',
      donateTargetLabel: 'Affectation du don',
      donateSuccessMsg: 'Merci pour votre générosité ! Votre don contribue directement à la solidarité sanitaire locale.'
    },
    wo: {
      tabRegister: 'Bokk bu bees',
      tabRenew: 'Fayal sa yéf',
      tabDonate: 'Dons / maye',
      btnNext: 'Kanaman',
      btnPrev: 'Delli',
      step1Title: 'Tann sa formule',
      step1Desc: 'Tannal package bi la gënë arr.',
      step2Title: 'Tann sa mutuelle',
      step2Desc: 'Tannal mutuelle bi nekk sa gox walla sa commune ci Ndakaaru.',
      step3Title: 'Mbindu tour ak sant',
      step3Desc: 'Bindal sa tour, sa sant ak sa portable.',
      step4Title: 'Sa njabot (famille)',
      step4Desc: 'Duggalal sa njabot ngir ñu bokk ci wér-gi-yaram bi.',
      step5Title: 'Mbind yi ci yoon',
      step5Desc: 'Duggalal sa carte d\'identité ak sa photo d\'identité.',
      step6Title: 'Saytu sa mbind yi',
      step6Desc: 'Saytul lépp li nga bind avant nga fay.',
      step7Title: 'Fayu sécurisé',
      step7Desc: 'Fayal sa cotisation ci Orange Money walla Wave.',
      step8Title: 'Bokk nga ci mutuelle bi !',
      step8Desc: 'Liguéy bi soti na ! Yore nga sa carte QR Santé tey.',
      packageIndiv: 'Individuel',
      packageIndivPrice: '4 500 FCFA / at',
      packageFam: 'Familial (sa njabot)',
      packageFamPrice: '1 000 FCFA carte + 3 500 FCFA par membre (at)',
      addFamilyBtn: 'Duggal sa bokk',
      verifyLabel: 'Récapitulatif',
      payBtn: 'Fay ko tey',
      successCardTitle: 'Sa carte QR cmu',
      downloadReceipt: 'Yóbbu reçu bi (PDF)',
      otpMessage: 'Dañu la yonné code OTP ci sa portable. Bindal ko fii ngir fay bi soti.',
      renewTitle: 'Espace fay sa yéf',
      renewDesc: 'Ubbil sa compte ngir xool cotisation yi nga wara fay.',
      renewLoginBtn: 'Ubbil',
      renewDuesTitle: 'Cotisation yi nga wara fay',
      renewSuccess: 'Fay nga sa cotisation bu atum 2026 ! Jërëjëf !',
      donateTitle: 'Mayé ci wér-gi-yaram',
      donateDesc: 'Japaleel mutuelle yi ngir ñu gënë mënë fajj ñi amul xaalis.',
      donateAmountLabel: 'Montant don bi (FCFA)',
      donateTargetLabel: 'Fan la don bi di dem',
      donateSuccessMsg: 'Jërëjëf ci sa liggéey ak sa jamm ! Sa maye dina dimbalé ñu bari.'
    }
  };

  const t = dict[lang];

  const calculateTotalCost = () => {
    if (selectedPackage === 'individuel') {
      return 4500;
    }
    if (selectedPackage === 'familial') {
      return 1000 + (familyMembers.length + 1) * 3500;
    }
    if (selectedPackage === 'parrainage') {
      if (parrainageType === 'menages') {
        return sponsoredHouseholds.reduce((acc, curr) => {
          return acc + 1000 + (curr.members.length + 1) * 3500;
        }, 0);
      }
      if (parrainageType === 'eleves') {
        return Math.max(1, familyMembers.length) * 1000;
      }
      return Math.max(1, familyMembers.length) * 4500;
    }
    if (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') {
      return Math.max(1, familyMembers.length) * 1000;
    }
    if (selectedPackage === 'adhesion_masse') {
      return Math.max(1, familyMembers.length) * 4500;
    }
    return 4500;
  };

  // Fonction de génération et téléchargement du reçu d'adhésion
  const handleDownloadReceipt = () => {
    const now = new Date();
    const receiptContent = [
      '═══════════════════════════════════════════════',
      '              MUTUALIS DAKAR',
      '        Reçu d\'adhésion / Cotisation',
      '═══════════════════════════════════════════════',
      '',
      `Date : ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR')}`,
      `N° Membre : ${generatedCmuNumber || 'MD-782410-DK'}`,
      '',
      '───────────────────────────────────────────────',
      '  Informations de l\'adhérent',
      '───────────────────────────────────────────────',
      `Prénom        : ${formData.firstName}`,
      `Nom           : ${formData.lastName}`,
      `Téléphone     : ${formData.phone}`,
      `Email         : ${formData.email || 'Non renseigné'}`,
      `Adresse       : ${formData.address || 'Non renseigné'}`,
      '',
      '───────────────────────────────────────────────',
      '  Détails de la cotisation',
      '───────────────────────────────────────────────',
      `Mutuelle      : ${selectedMutuelle}`,
      `Formule       : ${
        selectedPackage === 'individuel' ? 'Individuelle' : 
        selectedPackage === 'familial' ? 'Familiale' : 
        selectedPackage === 'parrainage' ? (
          parrainageType === 'menages' ? 'Parrainage Ménages' :
          parrainageType === 'eleves' ? 'Parrainage Élèves (École/Daara)' :
          'Parrainage Individuel'
        ) : 
        selectedPackage === 'csu_eleves' ? 'CSU Élèves' : selectedPackage === 'adhesion_masse' ? 'Adhésion Groupe / Masse' : 'CSU Daaras'
      }`,
      `Montant payé  : ${calculateTotalCost().toLocaleString('fr-FR')} FCFA`,
      `Moyen paiement: ${paymentMethod === 'wave' ? 'Wave' : 'Orange Money'}`,
      `Validité      : 12 / 2027`,
      schoolName ? (selectedPackage === 'adhesion_masse' ? `Organisation  : ${schoolName}` : `Établissement : ${schoolName}`) : '',
      sponsorPhone ? `Sponsor Tél   : ${sponsorPhone}` : '',
      '',
      familyMembers.length > 0 && selectedPackage !== 'parrainage' ? '───────────────────────────────────────────────' : '',
      familyMembers.length > 0 && selectedPackage !== 'parrainage' ? (
        (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? '  Liste des élèves / talibés' : selectedPackage === 'adhesion_masse' ? '  Liste des membres du groupe' : 
        '  Ayants droit'
      ) : '',
      familyMembers.length > 0 && selectedPackage !== 'parrainage' ? '───────────────────────────────────────────────' : '',
      ...(familyMembers.length > 0 && selectedPackage !== 'parrainage' ? familyMembers.map((m, i) => `  ${i + 1}. ${m.name} (${
        (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? `Classe/Niveau: ${m.relation}` : selectedPackage === 'adhesion_masse' ? `Rôle/Relation: ${m.relation}` : 
        m.relation
      }) - ${m.age} ans`) : []),
      selectedPackage === 'parrainage' ? '───────────────────────────────────────────────' : '',
      selectedPackage === 'parrainage' ? '  Détails du Parrainage' : '',
      selectedPackage === 'parrainage' ? '───────────────────────────────────────────────' : '',
      ...(selectedPackage === 'parrainage' ? (
        parrainageType === 'menages' ? sponsoredHouseholds.flatMap((hh, i) => [
          `  Ménage #${i + 1} : Chef ${hh.chefName} (${hh.chefPhone})`,
          ...hh.members.map(m => `    - ${m.name} (${m.relation}) - ${m.age} ans`),
          ''
        ]) : (
          parrainageType === 'eleves' ? [
            `  Établissement : ${schoolName}`,
            ...familyMembers.map((m, i) => `    ${i + 1}. ${m.name} (Classe/Niveau: ${m.relation}) - ${m.age} ans`)
          ] : familyMembers.map((m, i) => `    ${i + 1}. ${m.name} - ${m.age} ans`)
        )
      ) : []),
      '',
      '═══════════════════════════════════════════════',
      '  Ce reçu fait foi de votre adhésion.',
      '  Conservez-le précieusement.',
      '  Contact : support@mutualisdakar.sn',
      '═══════════════════════════════════════════════',
    ].filter(line => line !== undefined && line !== '').join('\n');

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu_adhesion_${generatedCmuNumber || 'MUTUALIS'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper: Next Step for Registration
  const newStepCount = 7;
  const nextStep = () => {
    if (regStep === 1 && !selectedPackage) {
      showError(lang === 'fr' ? 'Veuillez sélectionner une formule.' : 'Tannal sa formule.');
      return;
    }
    if (regStep === 2 && !selectedMutuelle) {
      showError(lang === 'fr' ? 'Veuillez sélectionner une mutuelle.' : 'Tannal sa mutuelle.');
      return;
    }
    if (regStep === 3) {
      if ((selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' || (selectedPackage === 'parrainage' && parrainageType === 'eleves')) && !schoolName) {
        showError(lang === 'fr' ? "Veuillez saisir le nom de l'organisation / établissement." : "Bindal tourou mboloo bi.");
        return;
      }
      if (!formData.firstName || !formData.lastName || !formData.phone) {
        showError(lang === 'fr' ? 'Veuillez remplir les champs obligatoires (Prénom, Nom, Téléphone).' : 'Bindal sa tour, sa sant ak sa portable.');
        return;
      }
    }
    if (regStep === 4) {
      if (selectedPackage === 'parrainage') {
        if (parrainageType === 'menages') {
          if (sponsoredHouseholds.length === 0) {
            showError(lang === 'fr' ? 'Veuillez ajouter au moins un ménage à parrainer.' : 'Duggalal njaboot bu bokk.');
            return;
          }
          for (let i = 0; i < sponsoredHouseholds.length; i++) {
            if (!sponsoredHouseholds[i].chefName || !sponsoredHouseholds[i].chefPhone) {
              showError(lang === 'fr' ? `Veuillez renseigner le nom et le téléphone du Chef pour le Ménage #${i+1}.` : `Bindal tour ak portable Chef bi ci njaboot #${i+1}.`);
              return;
            }
          }
        } else {
          if (familyMembers.length === 0) {
            showError(lang === 'fr' ? 'Veuillez ajouter au moins un filleul.' : 'Duggalal filleul bu bokk.');
            return;
          }
        }
      } else if (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse') {
        if (familyMembers.length === 0) {
          showError(lang === 'fr' ? 'Veuillez ajouter au moins un bénéficiaire.' : 'Duggalal kën bu bokk.');
          return;
        }
      }
    }
    setRegStep(prev => prev + 1);
  };

  // Helper: Prev Step
  const prevStep = () => setRegStep(prev => prev - 1);

  // Add Family Member
  const addFamily = () => {
    if (newFamilyMember.name && newFamilyMember.age) {
      setFamilyMembers(prev => [...prev, newFamilyMember]);
      setNewFamilyMember({ name: '', relation: 'enfant', age: '' });
    } else {
      showError(lang === 'fr' ? 'Veuillez saisir le nom et l\'âge.' : 'Bindal tour bi ak at mi.');
    }
  };

  // Remove Family Member
  const removeFamily = (idx) => {
    setFamilyMembers(prev => prev.filter((_, i) => i !== idx));
  };

  // Simulate Payment OTP
  const triggerOtp = () => {
    setOtpSent(true);
  };

  // Confirm Payment
  const handlePayment = (e) => {
    e.preventDefault();
    if (otpCode === '7842') {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        birthDate: formData.birthDate,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        mutuelleName: selectedMutuelle,
        packageType: selectedPackage,
        paymentMethod: paymentMethod,
        familyMembers: familyMembers,
        sponsorPhone: selectedPackage === 'parrainage' ? formData.phone : null,
        schoolName: (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || (selectedPackage === 'parrainage' && parrainageType === 'eleves')) ? schoolName : null,
        parrainageType: selectedPackage === 'parrainage' ? parrainageType : null,
        sponsoredHouseholds: (selectedPackage === 'parrainage' && parrainageType === 'menages') ? sponsoredHouseholds : null
      };

      if (!navigator.onLine) {
        outboxAdd('adhesion', payload)
          .then(() => {
            const randNum = Math.floor(1000 + Math.random() * 9000);
            const mSh = selectedMutuelle ? selectedMutuelle.split(' ').pop().substring(0, 3).toUpperCase() : 'CMU';
            setGeneratedCmuNumber(`SN-DK-${mSh}-${randNum}`);
            setPaymentSuccess(true);
            setRegStep(8);
            alert(lang === 'fr' 
              ? "Mode hors-ligne : Votre adhésion a été enregistrée localement et sera synchronisée dès le retour de la connexion."
              : "Hors-ligne mode : Sa adhésion enregistrer na localement te mungi lay xaar connexion bi ñëwaat."
            );
          })
          .catch(err => {
            console.error('Offline queuing failed:', err);
            setGeneratedCmuNumber('MD-OFFLINE-DK');
            setPaymentSuccess(true);
            setRegStep(8);
          });
        return;
      }

      fetch('http://localhost:5000/api/adhesions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setGeneratedCmuNumber(data.cmuNumber);
          setPaymentSuccess(true);
          setRegStep(8);
        } else {
          showError(lang === 'fr' ? 'Erreur lors de la validation : ' + (data.error || 'Erreur inconnue') : 'Erreur validation : ' + (data.error || 'Erreur inconnue'));
        }
      })
      .catch(err => {
        console.warn('Erreur API (utilisation du stockage hors-ligne) :', err);
        outboxAdd('adhesion', payload);
        setGeneratedCmuNumber('MD-782410-DK');
        setPaymentSuccess(true);
        setRegStep(8);
      });
    } else {
      showError(lang === 'fr' ? 'Code OTP incorrect. Veuillez réessayer (Indice : 7842)' : 'Code OTP bi baaxul. Repantal (Indice: 7842)');
    }
  };

  // Sync to QR Card platform handler
  const handleSync = () => {
    setSyncStatus('loading');
    setTimeout(() => {
      setSyncStatus('success');
    }, 2000);
  };

  // Renewal Payment verification handler
  const handleRenewPayment = (e) => {
    e.preventDefault();
    if (renewOtpCode === '7842') {
      setRenewStep(4);
      setRenewOtpSent(false);
      setRenewOtpCode('');
    } else {
      showError(lang === 'fr' ? 'Code OTP incorrect. Veuillez réessayer (Indice : 7842)' : 'Code OTP bi baaxul. Repantal (Indice: 7842)');
    }
  };

  // Renewal Authentication simulation
  const handleRenewLogin = (e) => {
    e.preventDefault();
    if (renewPhone) {
      const payload = {
        phone: renewPhone,
        amount: 4500,
        paymentMethod: 'wave',
        periodStart: new Date().toISOString().split('T')[0],
        periodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]
      };

      if (!navigator.onLine) {
        outboxAdd('cotisation', payload)
          .then(() => {
            setRenewedBeneficiary({
              firstName: 'Assuré',
              lastName: 'Hors Ligne',
              mutuelleName: 'Mutuelle de Rufisque Est',
              cmuNumber: 'MD-OFFLINE-DK',
              status: 'active'
            });
            setRenewLogged(true);
            setRenewStep(2);
            alert(lang === 'fr' 
              ? "Mode hors-ligne : Votre renouvellement a été enregistré localement et sera synchronisé dès le retour de la connexion."
              : "Hors-ligne mode : Sa renouvellement enregistrer na localement te mungi lay xaar connexion bi ñëwaat."
            );
          });
        return;
      }

      fetch('http://localhost:5000/api/cotisations/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: renewPhone })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.error || 'Erreur'); });
        }
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setRenewedBeneficiary(data.beneficiary);
          setRenewLogged(true);
          setRenewStep(2);
        }
      })
      .catch(err => {
        console.warn('Erreur API (utilisation du fallback local) :', err);
        outboxAdd('cotisation', payload);
        setRenewedBeneficiary({
          firstName: 'Moustapha',
          lastName: 'Ndiaye',
          mutuelleName: 'Mutuelle de Rufisque Est',
          cmuNumber: 'MD-782410-DK',
          status: 'active'
        });
        setRenewLogged(true);
        setRenewStep(2);
      });
    }
  };

  // Donation Steps Handlers
  const handleDonateInit = (e) => {
    e.preventDefault();
    if (parseInt(donateAmount) <= 0 || isNaN(parseInt(donateAmount))) {
      showError(lang === 'fr' ? 'Veuillez saisir un montant valide.' : 'Saisir montant bou baax.');
      return;
    }
    setDonateStep(2);
  };

  const triggerDonateOtp = () => {
    if (!donatePhone) {
      showError(lang === 'fr' ? 'Veuillez saisir votre numéro de téléphone.' : 'Dugalal sa portable.');
      return;
    }
    setDonateOtpSent(true);
    setDonateStep(3);
  };

  const handleDonateConfirm = (e) => {
    e.preventDefault();
    if (donateOtpCode === '7842') {
      const payload = { amount: donateAmount, target: donateTarget };

      if (!navigator.onLine) {
        outboxAdd('donation', payload)
          .then(() => {
            setDonateSuccess(true);
            setDonationTotals(prev => ({
              ...prev,
              [donateTarget]: prev[donateTarget] + parseInt(donateAmount)
            }));
            alert(lang === 'fr' 
              ? "Mode hors-ligne : Votre don a été enregistré localement et sera synchronisé dès le retour de la connexion."
              : "Hors-ligne mode : Sa don enregistrer na localement."
            );
          });
        return;
      }

      fetch('http://localhost:5000/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        setDonateSuccess(true);
        setDonationTotals(prev => ({
          ...prev,
          [donateTarget]: prev[donateTarget] + parseInt(donateAmount)
        }));
        fetchDonationStats();
      })
      .catch(err => {
        console.warn('Erreur API (utilisation du fallback local) :', err);
        outboxAdd('donation', payload);
        setDonateSuccess(true);
        setDonationTotals(prev => ({
          ...prev,
          [donateTarget]: prev[donateTarget] + parseInt(donateAmount)
        }));
      });
    } else {
      showError(lang === 'fr' ? 'Code OTP incorrect. Veuillez réessayer (Indice : 7842)' : 'Code OTP bi baaxul. Repantal (Indice: 7842)');
    }
  };

  return (
    <div className="services-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: `linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url(${activeTab === 'donate' ? '"/services_donate_real.png"' : '"/services_join_real.png"'}) center/cover no-repeat`,
        transition: 'background 0.3s ease',
        borderBottom: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>Services en ligne</h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '600px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{lang === 'fr' ? 'Adhésion en ligne, paiement sécurisé des cotisations et solidarité communautaire.' : 'Bokk, fay sa cotisation ak mayé ci wér-gi-yaram.'}</p>
        </div>
      </section>

      {/* Tabs Switcher */}
      <section className="container">
        <div className="services-switcher">
          <button className={`dept-tab-btn ${activeTab === 'register' ? 'active' : ''}`} onClick={() => setActiveTab('register')}>
            {t.tabRegister}
          </button>
          <button className={`dept-tab-btn ${activeTab === 'renew' ? 'active' : ''}`} onClick={() => setActiveTab('renew')}>
            {t.tabRenew}
          </button>
          <button className={`dept-tab-btn ${activeTab === 'donate' ? 'active' : ''}`} onClick={() => setActiveTab('donate')}>
            {t.tabDonate}
          </button>
        </div>

        {/* Dynamic Custom Error Banner */}
        {error && (
          <div className="fade-in-up" style={{
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            color: 'var(--danger)',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            fontSize: '0.9rem',
            fontWeight: '600',
            marginBottom: '2rem',
            borderLeft: '5px solid var(--danger)',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <span>⚠️ {error}</span>
            <button 
              onClick={() => setError('')} 
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '1rem',
                marginLeft: '1rem'
              }}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: New Registration */}
        {activeTab === 'register' && (
          <div>
            {/* Stepper progress headers */}
            {regStep < 8 && (
              <div className="stepper-header">
                {[1, 2, 3, 4, 5, 6, 7].map((s) => (
                  <div 
                    key={s} 
                    className={`step-indicator ${regStep === s ? 'active' : regStep > s ? 'completed' : ''}`}
                  >
                    {regStep > s ? '✓' : s}
                  </div>
                ))}
              </div>
            )}

            {/* Stepper Card */}
            <div className="card stepper-content-card">
              {/* Step 1: select package */}
              {regStep === 1 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.step1Title}</h2>
                  <p style={{ marginBottom: '2rem' }}>{t.step1Desc}</p>
                  
                  <div className="grid grid-2" style={{ gap: '1.5rem' }}>
                    {/* Individuel */}
                    <div 
                      className={`card text-center ${selectedPackage === 'individuel' ? 'active-border' : ''}`} 
                      onClick={() => setSelectedPackage('individuel')}
                      style={{ border: selectedPackage === 'individuel' ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer', padding: '1.5rem' }}
                    >
                      <div style={{ fontSize: '2rem' }}>👤</div>
                      <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{t.packageIndiv}</h3>
                      <div className="stat-number" style={{ fontSize: '1.5rem', margin: '0.5rem 0', color: 'var(--primary)' }}>4 500 FCFA / an</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? '1 000 FCFA pour la carte + 3 500 FCFA de cotisation.' : '1 000 FCFA carte bi + 3 500 FCFA de cotisation.'}</p>
                    </div>

                    {/* Familial */}
                    <div 
                      className={`card text-center ${selectedPackage === 'familial' ? 'active-border' : ''}`} 
                      onClick={() => setSelectedPackage('familial')}
                      style={{ border: selectedPackage === 'familial' ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer', padding: '1.5rem' }}
                    >
                      <div style={{ fontSize: '2rem' }}>👨‍👩‍👧‍👦</div>
                      <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{t.packageFam}</h3>
                      <div className="stat-number" style={{ fontSize: '1.5rem', margin: '0.5rem 0', color: 'var(--secondary)' }}>1 000 FCFA + 3 500 FCFA / pers.</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Une seule carte à 1 000 FCFA pour l\'adhérent, puis 3 500 FCFA par membre.' : 'Benn carte 1 000 FCFA ngir adhérent bi, ak 3 500 FCFA par bokk.'}</p>
                    </div>

                    {/* Parrainage solidaire */}
                    <div 
                      className={`card text-center ${selectedPackage === 'parrainage' ? 'active-border' : ''}`} 
                      onClick={() => {
                        if (setViewTab) {
                          setViewTab('parrainage-solidaire');
                        } else if (setView) {
                          setView('parrainage-solidaire');
                        } else {
                          setSelectedPackage('parrainage');
                        }
                      }}
                      style={{ border: selectedPackage === 'parrainage' ? '1px solid var(--border-color)' : '1px solid var(--border-color)', cursor: 'pointer', padding: '1.5rem' }}
                    >
                      <div style={{ fontSize: '2rem' }}>🤝</div>
                      <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{lang === 'fr' ? 'Parrainage solidaire' : 'Parrainage solidaire'}</h3>
                      <div className="stat-number" style={{ fontSize: '1.5rem', margin: '0.5rem 0', color: 'var(--success)' }}>4 500 FCFA / filleul</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Offrez la couverture maladie complète (carte + cotisation) à un ou plusieurs bénéficiaires.' : 'Mayé assurance wér-gi-yaram (carte + cotisation) ngir ñu bari.'}</p>
                    </div>

                    {/* CSU Eleves / Daaras */}
                    <div 
                      className={`card text-center ${selectedPackage === 'csu_eleves' ? 'active-border' : ''}`} 
                      onClick={() => setSelectedPackage('csu_eleves')}
                      style={{ border: selectedPackage === 'csu_eleves' ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer', padding: '1.5rem' }}
                    >
                      <div style={{ fontSize: '2rem' }}>🎓</div>
                      <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{lang === 'fr' ? 'CSU Élèves ou Daara' : 'CSU Élèves ak Daara'}</h3>
                      <div className="stat-number" style={{ fontSize: '1.5rem', margin: '0.5rem 0', color: 'var(--info)' }}>1 000 FCFA / élève</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Tarif collectif scolaire subventionné par l\'État pour les écoles et Daaras.' : 'Fay subventionné par État bi ngir daara yi ak écoles yi.'}</p>
                    </div>

                    {/* Adhésion Groupe / Masse */}
                    <div 
                      className={`card text-center ${selectedPackage === 'adhesion_masse' ? 'active-border' : ''}`} 
                      onClick={() => setSelectedPackage('adhesion_masse')}
                      style={{ border: selectedPackage === 'adhesion_masse' ? '2px solid var(--primary)' : '1px solid var(--border-color)', cursor: 'pointer', padding: '1.5rem' }}
                    >
                      <div style={{ fontSize: '2rem' }}>📊</div>
                      <h3 style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{lang === 'fr' ? 'Adhésion Groupe / Masse' : 'Mbindum Mboloo'}</h3>
                      <div className="stat-number" style={{ fontSize: '1.5rem', margin: '0.5rem 0', color: 'var(--primary)' }}>4 500 FCFA / pers.</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? 'Importez un fichier CSV ou saisissez une liste pour inscrire tout un groupe (carte + cotisation).' : 'Importé listou mboloo (carte + cotisation) ci CSV.'}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                    <button className="btn btn-primary" onClick={nextStep}>{t.btnNext}</button>
                  </div>
                </div>
              )}

              {/* Step 2: select mutual */}
              {regStep === 2 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.step2Title}</h2>
                  <p style={{ marginBottom: '2rem' }}>{t.step2Desc}</p>
                  
                  <div className="form-group">
                    <label className="form-label">{lang === 'fr' ? 'Mutuelles Disponibles' : 'Mutuelle yi nekk'}</label>
                    <select 
                      className="form-control" 
                      value={selectedMutuelle} 
                      onChange={(e) => setSelectedMutuelle(e.target.value)}
                    >
                      <option value="">-- {lang === 'fr' ? 'Sélectionner' : 'Tannal'} --</option>
                      {mutuellesList.map((m, i) => (
                        <option key={i} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                    <button className="btn btn-outline" onClick={prevStep}>{t.btnPrev}</button>
                    <button className="btn btn-primary" onClick={nextStep}>{t.btnNext}</button>
                  </div>
                </div>
              )}

              {/* Step 3: civil status info */}
              {regStep === 3 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {selectedPackage === 'parrainage' ? (lang === 'fr' ? 'Coordonnées du Parrain' : 'Mbindu Parrain bi') :
                     (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? (lang === 'fr' ? 'Informations Établissement' : 'Mbindu École/Daara') :
                     t.step3Title}
                  </h2>
                  <p style={{ marginBottom: '2rem' }}>
                    {selectedPackage === 'parrainage' ? (lang === 'fr' ? 'Veuillez renseigner vos coordonnées civiles de contact en tant que parrain.' : 'Bindal sa tour ak sa sant.') :
                     (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? (lang === 'fr' ? 'Veuillez saisir le nom de l\'école et le contact du directeur/responsable.' : 'Bindal tourou daara ak contact directeur bi.') :
                     t.step3Desc}
                  </p>

                  {selectedPackage === 'parrainage' && (
                    <div style={{ marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'var(--card-bg-subtle, #f8fafc)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <label className="form-label" style={{ fontWeight: 'bold', marginBottom: '1rem', display: 'block' }}>
                        {lang === 'fr' ? "Que souhaitez-vous parrainer ?" : "Lan nga beug parrainer ?"}
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="parrainageType" 
                            value="individuel" 
                            checked={parrainageType === 'individuel'} 
                            onChange={() => { setParrainageType('individuel'); setSchoolName(''); }} 
                          />
                          <div>
                            <strong>{lang === 'fr' ? "Filleuls Individuels" : "Filleuls Individuels"}</strong>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? "Parrainer des filleuls au tarif standard de 4 500 FCFA/an par personne." : "4 500 FCFA par filleul."}</div>
                          </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="parrainageType" 
                            value="menages" 
                            checked={parrainageType === 'menages'} 
                            onChange={() => { setParrainageType('menages'); setSchoolName(''); }} 
                          />
                          <div>
                            <strong>{lang === 'fr' ? "Ménages / Familles" : "Ménages / Familles"}</strong>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? "Parrainer un ou plusieurs ménages (1 000 FCFA la carte du chef + 3 500 FCFA/pers.)." : "Fayal ay njaboot."}</div>
                          </div>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                          <input 
                            type="radio" 
                            name="parrainageType" 
                            value="eleves" 
                            checked={parrainageType === 'eleves'} 
                            onChange={() => setParrainageType('eleves')} 
                          />
                          <div>
                            <strong>{lang === 'fr' ? "Élèves dans une école / Daara" : "Élèves dans une école / Daara"}</strong>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{lang === 'fr' ? "Parrainer des élèves d'un établissement de votre choix au tarif subventionné de 1 000 FCFA/élève." : "1 000 FCFA par élève."}</div>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {(selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' || (selectedPackage === 'parrainage' && parrainageType === 'eleves')) && (
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label" style={{ fontWeight: 'bold' }}>
                        {selectedPackage === 'adhesion_masse' 
                          ? (lang === 'fr' ? "Nom de l'Organisation / Association / Entreprise" : "Tourou Mboloo / Association bi")
                          : (lang === 'fr' ? "Nom de l'établissement (École ou Daara)" : "Tourou daara bi walla ecole bi")}
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder={selectedPackage === 'adhesion_masse' ? "Ex: Association des tailleurs de Dakar, GIE Gorgui" : "Ex: École élémentaire Grand-Dakar, Daara Serigne Saliou"}
                        required
                      />
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">
                        {selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' ? (lang === 'fr' ? 'Prénom du Responsable' : 'Tourou Responsable') : (lang === 'fr' ? 'Prénom' : 'Tour')}
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' ? (lang === 'fr' ? 'Nom du Responsable' : 'Santou Responsable') : (lang === 'fr' ? 'Nom' : 'Sant')}
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{lang === 'fr' ? 'Date de Naissance' : 'Juddu'}</label>
                      <input 
                        type="date" 
                        className="form-control" 
                        value={formData.birthDate}
                        onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{lang === 'fr' ? 'Téléphone' : 'Portable'}</label>
                      <input 
                        type="tel" 
                        className="form-control" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{lang === 'fr' ? 'Adresse' : 'Dëkk'}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                    <button className="btn btn-outline" onClick={prevStep}>{t.btnPrev}</button>
                    <button className="btn btn-primary" onClick={nextStep}>{t.btnNext}</button>
                  </div>
                </div>
              )}

              {/* Step 4: Ayants droit family list */}
              {regStep === 4 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {selectedPackage === 'parrainage' ? (
                      parrainageType === 'menages' ? (lang === 'fr' ? 'Composition des Ménages parrainés' : 'Njaboot yi parrainer') :
                      parrainageType === 'eleves' ? (lang === 'fr' ? 'Élèves parrainés dans l\'école' : 'Mbindu élèves/talibé') :
                      (lang === 'fr' ? 'Filleuls individuels parrainés' : 'Njabaat gnu parrainer')
                    ) :
                     (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse') ? (lang === 'fr' ? (selectedPackage === 'adhesion_masse' ? 'Liste des membres du groupe à inscrire' : 'Liste des élèves / talibés à inscrire') : 'Mbindu bénéficiaire/élève') :
                     t.step4Title}
                  </h2>
                  <p style={{ marginBottom: '2rem' }}>
                    {selectedPackage === 'parrainage' ? (
                      parrainageType === 'menages' ? (lang === 'fr' ? 'Déclarez les ménages et leurs membres à parrainer.' : 'Duggalal njaboot yi.') :
                      (lang === 'fr' ? 'Ajoutez les personnes pour qui vous financez l\'adhésion solidaire.' : 'Duggalal gni nga beug parrainer.')
                    ) :
                     (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse') ? (lang === 'fr' ? (selectedPackage === 'adhesion_masse' ? 'Saisissez la liste des membres ou importez-la ci-dessous.' : 'Saisissez la liste des élèves/talibés de votre établissement.') : 'Duggalal mboloo bénéficiaires yi.') :
                     t.step4Desc}
                  </p>
                  
                  {selectedPackage === 'parrainage' && parrainageType === 'menages' ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)' }}>
                          {lang === 'fr' ? `Ménages à parrainer (${sponsoredHouseholds.length})` : `Njaboot yi parrainer (${sponsoredHouseholds.length})`}
                        </h4>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setSponsoredHouseholds([...sponsoredHouseholds, { id: Date.now() + Math.random(), chefName: '', chefPhone: '', members: [] }])}
                        >
                          {lang === 'fr' ? '+ Ajouter un ménage' : '+ Dolli njaboot'}
                        </button>
                      </div>

                      {sponsoredHouseholds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', border: '2px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-sub)' }}>
                          {lang === 'fr' ? 'Aucun ménage ajouté. Cliquez sur le bouton ci-dessus pour ajouter un ménage à parrainer.' : 'Amul njaboot bu bokk. Bësal butoŋ bi ngir dolli.'}
                        </div>
                      ) : (
                        sponsoredHouseholds.map((hh, hhIdx) => (
                          <div key={hh.id} className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-color)', position: 'relative', background: 'var(--bg-card-subtle)' }}>
                            <button 
                              className="btn-text" 
                              style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--danger)', fontWeight: 'bold' }}
                              onClick={() => setSponsoredHouseholds(sponsoredHouseholds.filter((_, idx) => idx !== hhIdx))}
                            >
                              {lang === 'fr' ? 'Retirer ce ménage' : 'Dindi njaboot bi'}
                            </button>

                            <h5 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                              {lang === 'fr' ? `Ménage #${hhIdx + 1}` : `Njaboot #${hhIdx + 1}`}
                            </h5>

                            <div className="form-row" style={{ marginBottom: '1rem' }}>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.85rem' }}>{lang === 'fr' ? 'Prénom & Nom du Chef de ménage' : 'Tour ak Santou Chef'}</label>
                                <input 
                                  type="text" 
                                  className="form-control form-control-sm"
                                  value={hh.chefName}
                                  onChange={(e) => {
                                    const updated = [...sponsoredHouseholds];
                                    updated[hhIdx].chefName = e.target.value;
                                    setSponsoredHouseholds(updated);
                                  }}
                                  placeholder="Ex: Babacar Ndiaye"
                                  required
                                />
                              </div>
                              <div className="form-group">
                                <label className="form-label" style={{ fontSize: '0.85rem' }}>{lang === 'fr' ? 'Téléphone du Chef' : 'Portablou Chef bi'}</label>
                                <input 
                                  type="tel" 
                                  className="form-control form-control-sm"
                                  value={hh.chefPhone}
                                  onChange={(e) => {
                                    const updated = [...sponsoredHouseholds];
                                    updated[hhIdx].chefPhone = e.target.value;
                                    setSponsoredHouseholds(updated);
                                  }}
                                  placeholder="Ex: 77 987 65 43"
                                  required
                                />
                              </div>
                            </div>

                            {/* Sub-list of family members in this household */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                              <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.5rem', display: 'block' }}>
                                {lang === 'fr' ? `Membres rattachés au ménage (${hh.members.length})` : `Bokk yi (${hh.members.length})`}
                              </label>
                              
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                <input 
                                  type="text" 
                                  id={`hh-${hhIdx}-name`}
                                  className="form-control form-control-sm" 
                                  style={{ flex: '2', minWidth: '150px' }} 
                                  placeholder={lang === 'fr' ? 'Prénom & Nom' : 'Tour ak Sant'} 
                                />
                                <select 
                                  id={`hh-${hhIdx}-relation`}
                                  className="form-control form-control-sm" 
                                  style={{ flex: '1', minWidth: '100px' }}
                                >
                                  <option value="enfant">{lang === 'fr' ? 'Enfant' : 'Doom'}</option>
                                  <option value="conjoint">{lang === 'fr' ? 'Conjoint' : 'Jëkër/Jabar'}</option>
                                  <option value="parent">{lang === 'fr' ? 'Parent' : 'Waajur'}</option>
                                </select>
                                <input 
                                  type="number" 
                                  id={`hh-${hhIdx}-age`}
                                  className="form-control form-control-sm" 
                                  style={{ flex: '1', minWidth: '70px' }} 
                                  placeholder={lang === 'fr' ? 'Âge' : 'At'} 
                                />
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    const nameEl = document.getElementById(`hh-${hhIdx}-name`);
                                    const relationEl = document.getElementById(`hh-${hhIdx}-relation`);
                                    const ageEl = document.getElementById(`hh-${hhIdx}-age`);
                                    if (nameEl.value && ageEl.value) {
                                      const updated = [...sponsoredHouseholds];
                                      updated[hhIdx].members.push({
                                        name: nameEl.value,
                                        relation: relationEl.value,
                                        age: ageEl.value
                                      });
                                      setSponsoredHouseholds(updated);
                                      nameEl.value = '';
                                      relationEl.value = 'enfant';
                                      ageEl.value = '';
                                    } else {
                                      showError(lang === 'fr' ? 'Veuillez renseigner le nom et l\'âge du membre.' : 'Bindal tour bi ak at mi.');
                                    }
                                  }}
                                >
                                  +
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {hh.members.map((m, mIdx) => (
                                  <div key={mIdx} className="governance-item" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <strong>{m.name}</strong> ({m.relation}) - {m.age} ans
                                    </div>
                                    <button 
                                      className="btn-text" 
                                      style={{ color: 'var(--danger)', fontSize: '0.8rem' }}
                                      onClick={() => {
                                        const updated = [...sponsoredHouseholds];
                                        updated[hhIdx].members = updated[hhIdx].members.filter((_, idx) => idx !== mIdx);
                                        setSponsoredHouseholds(updated);
                                      }}
                                    >
                                      {lang === 'fr' ? 'Retirer' : 'Dindi'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div>
                      {/* CSV Import Module for Bulk Enrollments */}
                      {(selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' || (selectedPackage === 'parrainage' && parrainageType === 'eleves')) && (
                        <div style={{
                          border: '2px dashed var(--primary, #10b981)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          backgroundColor: 'var(--bg-card-subtle, rgba(16, 185, 129, 0.03))',
                          marginBottom: '1.5rem',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>📋</div>
                          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '700' }}>
                            {lang === 'fr' ? "Importation collective en masse" : "Mbindum mboloo (CSV)"}
                          </h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '1rem' }}>
                            {lang === 'fr' 
                              ? "Téléchargez notre modèle CSV, remplissez-le avec la liste de vos bénéficiaires et importez-le ci-dessous."
                              : "Télécharger modèle CSV, bindal liste bi te importé ko."}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button 
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                // Generate a template CSV for download
                                const headers = lang === 'fr' ? 'Prenom,Nom,Age,Classe_ou_Relation\nModou,Diop,12,6eme\nAwa,Ndiaye,10,CM2\n' : 'Prenom,Nom,Age,Classe_ou_Relation\nModou,Diop,12,6eme\n';
                                const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = 'mutualis_modele_import.csv';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                            >
                              📥 {lang === 'fr' ? 'Télécharger le modèle' : 'Modèle CSV'}
                            </button>
                            <label 
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', cursor: 'pointer', margin: 0 }}
                            >
                              📤 {lang === 'fr' ? 'Sélectionner le fichier CSV' : 'Choisir CSV'}
                              <input 
                                type="file" 
                                accept=".csv" 
                                style={{ display: 'none' }} 
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = (event) => {
                                    const text = event.target.result;
                                    const lines = text.split('\n');
                                    const newMembers = [];
                                    // Parse CSV (skip headers)
                                    for (let i = 1; i < lines.length; i++) {
                                      const line = lines[i].trim();
                                      if (!line) continue;
                                      // Split by comma or semicolon
                                      const cols = line.split(/[;,]/);
                                      if (cols.length >= 3) {
                                        newMembers.push({
                                          name: `${cols[0].trim()} ${cols[1].trim()}`,
                                          age: parseInt(cols[2].trim()) || 10,
                                          relation: cols[3] ? cols[3].trim() : 'Bénéficiaire'
                                        });
                                      }
                                    }
                                    if (newMembers.length > 0) {
                                      setFamilyMembers(prev => [...prev, ...newMembers]);
                                      alert(lang === 'fr' 
                                        ? `${newMembers.length} bénéficiaires importés avec succès !`
                                        : `${newMembers.length} bénéficiaires importés.`
                                      );
                                    } else {
                                      alert(lang === 'fr' ? 'Aucune ligne valide trouvée dans le CSV.' : 'CSV invalide.');
                                    }
                                  };
                                  reader.readAsText(file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Dynamic inputs */}
                      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <input 
                          type="text" 
                          className="form-control" 
                          style={{ flex: '2' }} 
                          placeholder={
                            selectedPackage === 'parrainage' ? (
                              parrainageType === 'eleves' ? (lang === 'fr' ? 'Prénom & Nom de l\'élève' : 'Tour ak Santou élève') :
                              (lang === 'fr' ? 'Prénom & Nom du filleul' : 'Tour ak Santou Filleul')
                            ) :
                            (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? (lang === 'fr' ? 'Prénom & Nom de l\'élève' : 'Tour ak Santou élève') :
                            selectedPackage === 'adhesion_masse' ? (lang === 'fr' ? 'Prénom & Nom du membre' : 'Tour ak Santou bokk') :
                            (lang === 'fr' ? 'Prénom & Nom' : 'Tour ak Sant')
                          }
                          value={newFamilyMember.name}
                          onChange={(e) => setNewFamilyMember({...newFamilyMember, name: e.target.value})}
                        />
                        
                        {(selectedPackage !== 'parrainage' || parrainageType === 'eleves') && (
                          selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' || parrainageType === 'eleves' ? (
                            <input 
                              type="text"
                              className="form-control"
                              style={{ flex: '1' }}
                              placeholder={
                                selectedPackage === 'adhesion_masse' 
                                  ? (lang === 'fr' ? 'Rôle / Relation' : 'Rôle')
                                  : (lang === 'fr' ? 'Classe / Niveau' : 'Classe')
                              }
                              value={newFamilyMember.relation}
                              onChange={(e) => setNewFamilyMember({...newFamilyMember, relation: e.target.value})}
                            />
                          ) : (
                            <select 
                              className="form-control" 
                              style={{ flex: '1' }}
                              value={newFamilyMember.relation}
                              onChange={(e) => setNewFamilyMember({...newFamilyMember, relation: e.target.value})}
                            >
                              <option value="enfant">{lang === 'fr' ? 'Enfant' : 'Doom'}</option>
                              <option value="conjoint">{lang === 'fr' ? 'Conjoint' : 'Jëkër/Jabar'}</option>
                              <option value="parent">{lang === 'fr' ? 'Parent' : 'Waajur'}</option>
                            </select>
                          )
                        )}

                        <input 
                          type="number" 
                          className="form-control" 
                          style={{ flex: '1' }} 
                          placeholder={lang === 'fr' ? 'Âge' : 'At'}
                          value={newFamilyMember.age}
                          onChange={(e) => setNewFamilyMember({...newFamilyMember, age: e.target.value})}
                        />
                        <button className="btn btn-secondary btn-sm" onClick={addFamily}>{t.addFamilyBtn}</button>
                      </div>

                      {/* List of family members */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {familyMembers.map((m, i) => (
                          <div key={i} className="governance-item">
                            <div>
                              <strong>{m.name}</strong> 
                              {selectedPackage === 'parrainage' ? (
                                parrainageType === 'eleves' ? ` (Élève - Classe/Niveau: ${m.relation}) ` : ` (Filleul) `
                              ) :
                               (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? ` (Classe/Niveau: ${m.relation}) ` :
                               selectedPackage === 'adhesion_masse' ? ` (Rôle/Relation: ${m.relation}) ` :
                               ` (${m.relation === 'conjoint' ? 'Conjoint' : m.relation === 'parent' ? 'Parent' : 'Enfant'}) `}
                              - {m.age} {lang === 'fr' ? 'ans' : 'at'}
                            </div>
                            <button className="btn-text" style={{ color: 'var(--danger)' }} onClick={() => removeFamily(i)}>{lang === 'fr' ? 'Retirer' : 'Dindi'}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                    <button className="btn btn-outline" onClick={prevStep}>{t.btnPrev}</button>
                    <button className="btn btn-primary" onClick={nextStep}>{t.btnNext}</button>
                  </div>
                </div>
              )}

              {/* Step 5: upload files */}
              {regStep === 5 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.step5Title}</h2>
                  <p style={{ marginBottom: '2rem' }}>{t.step5Desc}</p>
                  
                  <div className="form-group">
                    <label className="form-label">{lang === 'fr' ? 'Pièce d\'identité (CNI)' : 'Carte Identité (CNI)'}</label>
                    <input 
                      type="file" 
                      className="form-control" 
                      onChange={(e) => setFormData({...formData, cni: e.target.files[0]})}
                    />
                  </div>

                  <div className="form-group" style={{ marginTop: '1.5rem' }}>
                    <label className="form-label">{lang === 'fr' ? 'Photo d\'identité' : 'Photo d\'identité'}</label>
                    <input 
                      type="file" 
                      className="form-control" 
                      onChange={(e) => setFormData({...formData, photo: e.target.files[0]})}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem' }}>
                    <button className="btn btn-outline" onClick={prevStep}>{t.btnPrev}</button>
                    <button className="btn btn-primary" onClick={nextStep}>{t.btnNext}</button>
                  </div>
                </div>
              )}

              {/* Step 6: verification */}
              {regStep === 6 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.step6Title}</h2>
                  <p style={{ marginBottom: '2rem' }}>{t.step6Desc}</p>
                  
                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px' }}>
                    <div>
                      <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Mutuelle</span>
                      <div style={{ fontWeight: '700' }}>{selectedMutuelle}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Formule</span>
                      <div style={{ fontWeight: '700' }}>
                        {selectedPackage === 'individuel' ? t.packageIndiv : 
                         selectedPackage === 'familial' ? t.packageFam : 
                         selectedPackage === 'parrainage' ? (
                           parrainageType === 'menages' ? 'Parrainage de Ménages 🤝' :
                           parrainageType === 'eleves' ? 'Parrainage Élèves / Daara 🤝' :
                           'Parrainage Individuel 🤝'
                         ) : 
                          selectedPackage === 'csu_eleves' ? 'CSU Élèves 🎓' : selectedPackage === 'adhesion_masse' ? 'Adhésion Groupe / Masse 📊' : 'CSU Daaras 🎓'}
                      </div>
                    </div>
                    {schoolName && (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse' || (selectedPackage === 'parrainage' && parrainageType === 'eleves')) && (
                      <div>
                        <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>{selectedPackage === 'adhesion_masse' ? (lang === 'fr' ? 'Organisation' : 'Mboloo') : (lang === 'fr' ? 'Établissement' : 'Établissement')}</span>
                        <div style={{ fontWeight: '700' }}>{schoolName}</div>
                      </div>
                    )}
                    <div>
                      <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        {selectedPackage === 'parrainage' ? 'Parrain / Sponsor' : 
                          (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse') ? 'Responsable Groupe / Établissement' : 
                         'Adhérent Principal'}
                      </span>
                      <div style={{ fontWeight: '700' }}>{formData.firstName} {formData.lastName}</div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Téléphone</span>
                      <div style={{ fontWeight: '700' }}>{formData.phone}</div>
                    </div>
                    
                    {selectedPackage === 'parrainage' && parrainageType === 'menages' && sponsoredHouseholds.length > 0 && (
                      <div>
                        <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                          {lang === 'fr' ? `Ménages parrainés (${sponsoredHouseholds.length})` : `Njaboot yi parrainer (${sponsoredHouseholds.length})`}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                          {sponsoredHouseholds.map((hh, idx) => (
                            <div key={idx} style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem' }}>
                              <strong>{lang === 'fr' ? `Ménage #${idx + 1} : Chef ` : `Njaboot #${idx + 1} : Chef `}</strong>
                              <span style={{ fontWeight: '600' }}>{hh.chefName}</span> ({hh.chefPhone})
                              {hh.members.length > 0 && (
                                <ul style={{ margin: '0.25rem 0 0 1rem', paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                                  {hh.members.map((m, mIdx) => (
                                    <li key={mIdx}>{m.name} ({m.relation}) - {m.age} ans</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {familyMembers.length > 0 && (selectedPackage !== 'parrainage' || parrainageType !== 'menages') && (
                      <div>
                        <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                          {selectedPackage === 'parrainage' ? `Filleuls parrainés (${familyMembers.length})` : 
                            (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? `Élèves / Talibés inscrits (${familyMembers.length})` : selectedPackage === 'adhesion_masse' ? `Membres inscrits (${familyMembers.length})` : 
                           `Membres rattachés (${familyMembers.length})`}
                        </span>
                        <ul style={{ paddingLeft: '1.25rem', fontWeight: '600', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                          {familyMembers.map((m, i) => (
                            <li key={i}>
                              {m.name} 
                              {selectedPackage === 'parrainage' ? (
                                parrainageType === 'eleves' ? ` (Élève - Classe: ${m.relation})` : ' (Filleul)'
                              ) : 
                               (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? ` (Classe: ${m.relation})` : selectedPackage === 'adhesion_masse' ? ` (Rôle/Relation: ${m.relation})` : 
                               ` (${m.relation === 'conjoint' ? 'Conjoint' : m.relation === 'parent' ? 'Parent' : 'Enfant'})`} 
                              {` - ${m.age} ans`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cost Breakdown */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <span style={{ color: 'var(--neutral-gray)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Coût Total de l'adhésion</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--secondary)' }}>
                        {calculateTotalCost().toLocaleString('fr-FR')} FCFA
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>
                        {selectedPackage === 'individuel' && "Détail : 1 000 FCFA carte + 3 500 FCFA cotisation"}
                        {selectedPackage === 'familial' && `Détail : 1 000 FCFA carte + ${familyMembers.length + 1} personnes × 3 500 FCFA cotisation`}
                        {selectedPackage === 'parrainage' && (
                          parrainageType === 'menages'
                            ? `Détail : ${sponsoredHouseholds.length} ménage(s) [1 000 FCFA carte + 3 500 FCFA/pers. par ménage]`
                            : parrainageType === 'eleves'
                              ? `Détail : ${familyMembers.length} élève(s) × 1 000 FCFA (tarif subventionné)`
                              : `Détail : ${familyMembers.length} filleul(s) × 4 500 FCFA (1 000 carte + 3 500 cotisation)`
                        )}
                        {(selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') && `Détail : ${familyMembers.length} élèves × 1 000 FCFA (tarif subventionné)`}
                        {selectedPackage === 'adhesion_masse' && `Détail : ${familyMembers.length} membre(s) × 4 500 FCFA (1 000 FCFA carte + 3 500 FCFA cotisation)`}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: '1.5rem', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', backgroundColor: 'var(--card-bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <input type="checkbox" id="gdpr-consent" checked={gdprConsent} onChange={(e) => setGdprConsent(e.target.checked)} style={{ marginTop: '0.25rem', transform: 'scale(1.2)' }} />
                    <label htmlFor="gdpr-consent" style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: '1.4' }}>
                      J'accepte que mes données personnelles et médicales soient traitées dans le cadre de mon adhésion à la Couverture Maladie Universelle, conformément au Règlement Général sur la Protection des Données (RGPD) et aux normes sur les données de santé (HDS).
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                    <button className="btn btn-outline" onClick={prevStep}>{t.btnPrev}</button>
                    <button className="btn btn-primary" onClick={nextStep} disabled={!gdprConsent} title={!gdprConsent ? "Veuillez accepter les conditions RGPD" : ""}>{t.btnNext}</button>
                  </div>
                </div>
              )}

              {/* Step 7: payment security */}
              {regStep === 7 && (
                <div className="fade-in-up">
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{t.step7Title}</h2>
                  <p style={{ marginBottom: '2rem' }}>{t.step7Desc}</p>
                  
                  {/* Select Payment Method */}
                  <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                      <input 
                        type="radio" 
                        name="pay" 
                        value="wave" 
                        checked={paymentMethod === 'wave'} 
                        onChange={() => setPaymentMethod('wave')}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <img src="/logo_wave.png" alt="Wave" style={{ height: '16px', borderRadius: '2px' }} />
                        <span>Wave</span>
                      </div>
                    </label>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                      <input 
                        type="radio" 
                        name="pay" 
                        value="om" 
                        checked={paymentMethod === 'om'} 
                        onChange={() => setPaymentMethod('om')}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <img src="/logo_orange_money.png" alt="Orange Money" style={{ height: '16px', borderRadius: '2px' }} />
                        <span>Orange Money</span>
                      </div>
                    </label>
                  </div>

                  {/* Payment Form */}
                  {!otpSent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                      <div className="form-group" style={{ width: '100%', maxWidth: '300px' }}>
                        <label className="form-label">{lang === 'fr' ? 'Saisir votre numéro de téléphone' : 'Dugalal sa portable'}</label>
                        <input 
                          type="tel" 
                          className="form-control text-center" 
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <button className="btn btn-secondary" onClick={triggerOtp}>{lang === 'fr' ? 'Démarrer la transaction' : 'Fay tey'}</button>
                    </div>
                  ) : (
                    <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                      <p style={{ color: 'var(--secondary)', fontWeight: '600' }}>{t.otpMessage}</p>
                      
                      {/* Simulated phone mockup */}
                      <div className="payment-screen-mock">
                        <div className="payment-screen-mock-pattern"></div>
                        <div className="payment-screen-header">
                          {paymentMethod === 'wave' ? 'WAVE PAY' : 'ORANGE MONEY'}
                        </div>
                        <div style={{ fontSize: '0.75rem', marginBottom: '1.5rem', color: '#94a3b8' }}>
                          Montant : {calculateTotalCost().toLocaleString('fr-FR')} FCFA
                        </div>
                        <input 
                          type="text" 
                          className="payment-otp-field" 
                          maxLength="4" 
                          placeholder="••••"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                        />
                      </div>

                      {/* Custom Inline OTP Demo Hint */}
                      <div style={{
                        marginTop: '0.25rem',
                        padding: '0.75rem',
                        background: 'var(--bg-card-subtle)',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        color: 'var(--text-sub)',
                        border: '1px dashed var(--border-color)',
                        width: '100%',
                        maxWidth: '280px',
                        textAlign: 'center',
                        boxShadow: 'var(--shadow-sm)'
                      }}>
                        💡 {lang === 'fr' ? 'Indice démo : Saisissez le code OTP 7842' : 'Indice démo : Bindal code OTP 7842'}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOtpSent(false)}>{t.btnPrev}</button>
                        <button type="submit" className="btn btn-secondary btn-sm">{t.payBtn}</button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Step 8: Success Card and QR */}
              {regStep === 8 && (
                <div className="fade-in-up text-center">
                  <div style={{ fontSize: '4rem', color: 'var(--success)', marginBottom: '1rem' }}>🎉</div>
                  <h2 style={{ fontSize: '1.75rem', color: 'var(--success)', marginBottom: '0.5rem' }}>{t.step8Title}</h2>
                  <p style={{ marginBottom: '2rem' }}>{t.step8Desc}</p>
                  
                  {/* Digital Health Card Mock */}
                  <div className="digital-health-card">
                    <div className="digital-card-pattern"></div>
                    <div className="digital-card-logo">
                      <span style={{ fontWeight: '800', fontSize: '1.1rem', letterSpacing: '1px' }}>MUTUALIS DAKAR</span>
                      <div className="digital-card-chip"></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="digital-card-label">
                          {selectedPackage === 'parrainage' ? 'Parrain / Sponsor' : 
                           (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse') ? (selectedPackage === 'adhesion_masse' ? 'Organisation' : 'Établissement') : 
                           'Adhérent'}
                        </div>
                        <div className="digital-card-value" style={{ fontSize: '1.1rem' }}>
                          {selectedPackage === 'parrainage' && parrainageType === 'eleves'
                            ? schoolName
                            : (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse')
                              ? schoolName 
                              : `${formData.firstName} ${formData.lastName}`}
                        </div>
                        <div className="digital-card-label" style={{ marginTop: '0.75rem' }}>
                          {selectedPackage === 'parrainage' ? (
                            parrainageType === 'menages' 
                              ? `Ménages parrainés (${sponsoredHouseholds.length})` 
                              : `Filleuls parrainés (${familyMembers.length})`
                          ) : 
                           (selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara') ? `Élèves inscrits (${familyMembers.length})` : selectedPackage === 'adhesion_masse' ? `Membres inscrits (${familyMembers.length})` : 
                           'Mutuelle'}
                        </div>
                        <div className="digital-card-value">
                          {selectedPackage === 'parrainage' || selectedPackage === 'csu_eleves' || selectedPackage === 'csu_daara' || selectedPackage === 'adhesion_masse'
                            ? (lang === 'fr' ? 'Dossiers en cours de traitement' : 'Saytu dossiers yi')
                            : selectedMutuelle}
                        </div>
                      </div>
                      
                      {/* Mock QR Code */}
                      <div className="digital-card-qr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '4px', borderRadius: '6px', width: '74px', height: '74px' }}>
                        {qrCodeUrl ? (
                          <img src={qrCodeUrl} alt="QR Code CMU" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                        )}
                      </div>
                    </div>

                    <div className="digital-card-details">
                      <div>
                        <div className="digital-card-label">ID Membre</div>
                        <div className="digital-card-value">{generatedCmuNumber || 'MD-782410-DK'}</div>
                      </div>
                      <div>
                        <div className="digital-card-label">Validité</div>
                        <div className="digital-card-value">12 / 2027</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-outline" onClick={() => {
                      setRegStep(1);
                      setPaymentSuccess(false);
                      setOtpSent(false);
                      setOtpCode('');
                      setSyncStatus('idle');
                      setParrainageType('individuel');
                      setSponsoredHouseholds([]);
                      setFamilyMembers([]);
                      setSchoolName('');
                    }}>{lang === 'fr' ? 'Nouvelle Inscription' : 'Mbindu bu bees'}</button>
                    <button 
                      className={`btn ${syncStatus === 'success' ? 'btn-outline' : 'btn-primary'}`} 
                      onClick={handleSync}
                      disabled={syncStatus === 'loading'}
                    >
                      {syncStatus === 'idle' && (lang === 'fr' ? 'Synchroniser Carte' : 'Sync Carte')}
                      {syncStatus === 'loading' && (lang === 'fr' ? 'Synchronisation...' : 'Sync bu bari...')}
                      {syncStatus === 'success' && (lang === 'fr' ? '✓ Synchronisée !' : '✓ Sync !')}
                    </button>
                    <button className="btn btn-secondary" onClick={handleDownloadReceipt}>
                      {t.downloadReceipt}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Cotisation Renewal */}
        {activeTab === 'renew' && (
          <div className="card stepper-content-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>{t.renewTitle}</h2>
            <p style={{ marginBottom: '2rem', textAlign: 'center' }}>{t.renewDesc}</p>

            {renewStep === 1 && (
              <form onSubmit={handleRenewLogin} className="fade-in-up">
                <div className="form-group">
                  <label className="form-label">{lang === 'fr' ? 'Numéro de téléphone adhérent' : 'Portable adhérent'}</label>
                  <input 
                    type="tel" 
                    className="form-control" 
                    placeholder="e.g. 77 123 45 67" 
                    value={renewPhone}
                    onChange={(e) => setRenewPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">{lang === 'fr' ? 'Mot de passe' : 'Code secret'}</label>
                  <input type="password" className="form-control" placeholder="••••••" required />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>{t.renewLoginBtn}</button>
              </form>
            )}

            {renewStep === 2 && (
              <div className="fade-in-up">
                <h3 style={{ marginBottom: '1.25rem' }}>{t.renewDuesTitle}</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Adhérent :</span>
                    <strong>{renewedBeneficiary ? `${renewedBeneficiary.firstName} ${renewedBeneficiary.lastName}` : 'Moustapha Ndiaye'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Mutuelle :</span>
                    <strong>{renewedBeneficiary ? renewedBeneficiary.mutuelleName : 'Mutuelle de Rufisque Est'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)', fontWeight: 'bold' }}>
                    <span>Cotisation annuelle 2026 :</span>
                    <span>4 500 FCFA</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => setRenewStep(1)}>{t.btnPrev}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setRenewStep(3)}>{lang === 'fr' ? 'Procéder au paiement' : 'Fay ko tey'}</button>
                </div>
              </div>
            )}

            {renewStep === 3 && (
              <div className="fade-in-up text-center">
                {!renewOtpSent ? (
                  <>
                    <h3 style={{ marginBottom: '1.5rem' }}>{lang === 'fr' ? 'Sélectionnez le moyen de paiement' : 'Tannal pass fay bi'}</h3>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => {
                          setPaymentMethod('wave');
                          setRenewOtpSent(true);
                        }}
                      >
                        Wave 🌊
                      </button>
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => {
                          setPaymentMethod('om');
                          setRenewOtpSent(true);
                        }}
                      >
                        Orange Money 🍊
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleRenewPayment} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <p style={{ color: 'var(--secondary)', fontWeight: '600' }}>{t.otpMessage}</p>
                    
                    {/* Simulated phone mockup */}
                    <div className="payment-screen-mock">
                      <div className="payment-screen-header">
                        {paymentMethod === 'wave' ? 'WAVE PAY' : 'ORANGE MONEY'}
                      </div>
                      <div style={{ fontSize: '0.75rem', marginBottom: '1.5rem', color: '#94a3b8' }}>
                        Montant : 4 500 FCFA
                      </div>
                      <input 
                        type="text" 
                        className="payment-otp-field" 
                        maxLength="4" 
                        placeholder="••••"
                        value={renewOtpCode}
                        onChange={(e) => setRenewOtpCode(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {/* Custom Inline OTP Demo Hint */}
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.75rem',
                      background: 'var(--bg-card-subtle)',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      color: 'var(--text-sub)',
                      border: '1px dashed var(--border-color)',
                      width: '100%',
                      maxWidth: '280px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      💡 {lang === 'fr' ? 'Indice démo : Saisissez le code OTP 7842' : 'Indice démo : Bindal code OTP 7842'}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setRenewOtpSent(false)}>{t.btnPrev}</button>
                      <button type="submit" className="btn btn-secondary btn-sm">{t.payBtn}</button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {renewStep === 4 && (
              <div className="fade-in-up text-center">
                <div style={{ fontSize: '3rem', color: 'var(--success)', marginBottom: '1rem' }}>✓</div>
                <p style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '1.5rem' }}>{t.renewSuccess}</p>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setRenewStep(1);
                  setRenewPhone('');
                  setRenewLogged(false);
                }}>{lang === 'fr' ? 'Fermer la session' : 'Ubbil waxtu'}</button>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Donations */}
        {activeTab === 'donate' && (
          <div className="card stepper-content-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>{t.donateTitle}</h2>
            <p style={{ marginBottom: '2rem', textAlign: 'center' }}>{t.donateDesc}</p>

            {donateSuccess ? (
              <div className="fade-in-up text-center">
                <div style={{ fontSize: '4rem', color: 'var(--secondary)', marginBottom: '1rem' }}>❤️</div>
                <h3 style={{ color: 'var(--secondary)', marginBottom: '1rem' }}>Jërëjëf ! / Merci !</h3>
                <p style={{ fontWeight: '500' }}>{t.donateSuccessMsg}</p>
                <button 
                  className="btn btn-outline btn-sm" 
                  style={{ marginTop: '2rem' }}
                  onClick={() => {
                    setDonateSuccess(false);
                    setDonateStep(1);
                    setDonateAmount('5000');
                    setDonatePhone('');
                    setDonateOtpSent(false);
                    setDonateOtpCode('');
                  }}
                >
                  {lang === 'fr' ? 'Faire un autre don' : 'Mayé wat'}
                </button>
              </div>
            ) : (
              <>
                {/* Step 1: Donation configuration */}
                {donateStep === 1 && (
                  <form onSubmit={handleDonateInit} className="fade-in-up">
                    <div className="form-group">
                      <label className="form-label">{t.donateAmountLabel}</label>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={donateAmount}
                        onChange={(e) => setDonateAmount(e.target.value)}
                        required 
                      />
                    </div>

                    <div className="form-group" style={{ marginTop: '1.25rem' }}>
                      <label className="form-label">{t.donateTargetLabel}</label>
                      <select 
                        className="form-control" 
                        value={donateTarget}
                        onChange={(e) => setDonateTarget(e.target.value)}
                      >
                        <option value="general">{lang === 'fr' ? 'Fonds commun de solidarité régional' : 'Fonds commun régional'}</option>
                        <option value="rufisque">{lang === 'fr' ? 'Campagne Maternité de Rufisque' : 'Maternité Rufisque'}</option>
                        <option value="keurmassar">{lang === 'fr' ? 'Soutien aux étudiants de Keur Massar' : 'Ndaw Keur Massar'}</option>
                      </select>
                    </div>

                    {/* Dynamic Donation progress bar */}
                    <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>
                        <span>
                          {{
                            general: lang === 'fr' ? 'Fonds commun de solidarité régional' : 'Fonds commun régional',
                            rufisque: lang === 'fr' ? 'Campagne Maternité de Rufisque' : 'Maternité Rufisque',
                            keurmassar: lang === 'fr' ? 'Soutien aux étudiants de Keur Massar' : 'Ndaw Keur Massar'
                          }[donateTarget]}
                        </span>
                        <span>
                          {Math.min(100, Math.round((donationTotals[donateTarget] / donationGoals[donateTarget]) * 100))}% ({donationTotals[donateTarget].toLocaleString('fr-FR')} / {donationGoals[donateTarget].toLocaleString('fr-FR')} FCFA)
                        </span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, (donationTotals[donateTarget] / donationGoals[donateTarget]) * 100)}%`, height: '100%', backgroundColor: 'var(--secondary)' }}></div>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-secondary" style={{ width: '100%' }}>
                      {lang === 'fr' ? 'Procéder au paiement' : 'Poursuivre'}
                    </button>
                  </form>
                )}

                {/* Step 2: Select Payment Method & Phone */}
                {donateStep === 2 && (
                  <div className="fade-in-up">
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                      {lang === 'fr' ? 'Sélectionnez le moyen de paiement' : 'Tannal pass fay bi'}
                    </h3>
                    
                    {/* Payment methods choice */}
                    <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '2rem' }}>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <input 
                          type="radio" 
                          name="donatePay" 
                          value="wave" 
                          checked={donatePaymentMethod === 'wave'} 
                          onChange={() => setDonatePaymentMethod('wave')}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <img src="/logo_wave.png" alt="Wave" style={{ height: '16px', borderRadius: '2px' }} />
                          <span>Wave</span>
                        </div>
                      </label>
                      <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                        <input 
                          type="radio" 
                          name="donatePay" 
                          value="om" 
                          checked={donatePaymentMethod === 'om'} 
                          onChange={() => setDonatePaymentMethod('om')}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <img src="/logo_orange_money.png" alt="Orange Money" style={{ height: '16px', borderRadius: '2px' }} />
                          <span>Orange Money</span>
                        </div>
                      </label>
                    </div>

                    <div className="form-group" style={{ maxWidth: '320px', margin: '0 auto 1.5rem auto' }}>
                      <label className="form-label">{lang === 'fr' ? 'Numéro de téléphone' : 'Portable'}</label>
                      <input 
                        type="tel" 
                        className="form-control text-center" 
                        placeholder="e.g. 77 123 45 67"
                        value={donatePhone}
                        onChange={(e) => setDonatePhone(e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setDonateStep(1)}>{t.btnPrev}</button>
                      <button className="btn btn-secondary btn-sm" onClick={triggerDonateOtp}>
                        {lang === 'fr' ? 'Démarrer la transaction' : 'Fay tey'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: OTP confirmation */}
                {donateStep === 3 && (
                  <form onSubmit={handleDonateConfirm} className="fade-in-up text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <p style={{ color: 'var(--secondary)', fontWeight: '600' }}>{t.otpMessage}</p>
                    
                    {/* Simulated phone mockup */}
                    <div className="payment-screen-mock">
                      <div className="payment-screen-mock-pattern"></div>
                      <div className="payment-screen-header">
                        {donatePaymentMethod === 'wave' ? 'WAVE PAY' : 'ORANGE MONEY'}
                      </div>
                      <div style={{ fontSize: '0.75rem', marginBottom: '1.5rem', color: '#94a3b8' }}>
                        Donation : {parseInt(donateAmount).toLocaleString('fr-FR')} FCFA
                      </div>
                      <input 
                        type="text" 
                        className="payment-otp-field" 
                        maxLength="4" 
                        placeholder="••••"
                        value={donateOtpCode}
                        onChange={(e) => setDonateOtpCode(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {/* Custom Inline OTP Demo Hint */}
                    <div style={{
                      marginTop: '0.25rem',
                      padding: '0.75rem',
                      background: 'var(--bg-card-subtle)',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      color: 'var(--text-sub)',
                      border: '1px dashed var(--border-color)',
                      width: '100%',
                      maxWidth: '280px',
                      textAlign: 'center',
                      boxShadow: 'var(--shadow-sm)'
                    }}>
                      💡 {lang === 'fr' ? 'Indice démo : Saisissez le code OTP 7842' : 'Indice démo : Bindal code OTP 7842'}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setDonateOtpSent(false); setDonateStep(2); }}>{t.btnPrev}</button>
                      <button type="submit" className="btn btn-secondary btn-sm">{t.payBtn}</button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
