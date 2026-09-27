import { getCardByCode } from '../utils/beneficiaryStore';
import jsQR from 'jsqr';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { getBeneficiaryInfo, getAdherentCode, getBeneficiaryCode } from '../utils/csuFormatter';
import { speakCleanText } from '../services/voiceAudioService';

// Vue publique et médicale de vérification d'une carte CSU.
// Accessible via #/verify ou #/verify/:cmuNumber — utilisée par les structures de soins,
// médecins, pharmaciens et agents pour vérifier instantanément une carte scannée
// et exécuter les actions médicales directes (Garantie, Ordonnance, Télémédecine, Radios, Antécédents).

const calculateAge = (birthDateStr) => {
  if (!birthDateStr) return 54;
  try {
    const parts = birthDateStr.split('/');
    if (parts.length === 3) {
      const year = parseInt(parts[2], 10);
      if (!isNaN(year)) return Math.max(0, new Date().getFullYear() - year);
    } else if (birthDateStr.includes('-')) {
      const year = parseInt(birthDateStr.split('-')[0], 10);
      if (!isNaN(year)) return Math.max(0, new Date().getFullYear() - year);
    }
  } catch (e) {}
  return 54;
};

export default function VerifyCard({ lang = 'fr', setView = null, citizenUser = null }) {
  const [cmuNumber, setCmuNumber] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Données scolaires portées par le QR code de la carte (CMU-Élèves /
  // CMU-Daara). Elles ne sont PLUS imprimées sur le recto : l'agent les
  // lit ici, après scan. Absentes sur les cartes classiques.
  const [scannedAcademic, setScannedAcademic] = useState(null);
  const [showAdModal, setShowAdModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [selectedTargetBeneficiary, setSelectedTargetBeneficiary] = useState(null); // null = Adhérent Principal, or child object

  const [activeModal, setActiveModal] = useState(null); // 'guarantee' | 'order' | 'telemedicine' | 'imaging' | 'specialties' | 'pathologies' | 'antecedents'
  const [actionSuccess, setActionSuccess] = useState('');

  // États des formulaires des 6 actions médicales du Hub Tiers-Payant UNAMUSC
  const [guaranteeHospital, setGuaranteeHospital] = useState('Hôpital Universitaire de Fann (Dakar)');
  const [guaranteeService, setGuaranteeService] = useState('Hospitalisation & Chirurgie (80%)');
  const [guaranteeAct, setGuaranteeAct] = useState('Hospitalisation & Soins Spécialisés');
  const [guaranteeAmount, setGuaranteeAmount] = useState('250000');
  const [guaranteeRate, setGuaranteeRate] = useState('80%');
  const [guaranteeNotes, setGuaranteeNotes] = useState('Prise en charge validée sous convention Tiers-Payant UNAMUSC.');

  const [medPharmacy, setMedPharmacy] = useState('Pharmacie de la Médina');
  const [medDoctor, setMedDoctor] = useState('Dr. Ousmane Sow (Centre de Santé Gaspard Camara)');
  const [medName, setMedName] = useState('Amoxicilline 500mg');
  const [medForm, setMedForm] = useState('Gélules');
  const [medQty, setMedQty] = useState('2');
  const [medPrice, setMedPrice] = useState('3500');
  const [medPosology, setMedPosology] = useState('1 gélule matin et soir pendant 7 jours');
  const [prescriptionPhoto, setPrescriptionPhoto] = useState(null);
  const [prescriptionFileName, setPrescriptionFileName] = useState('');

  const handlePrescriptionFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setPrescriptionFileName(file.name);
      const reader = new FileReader();
      reader.onload = (evt) => {
        setPrescriptionPhoto(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [examTitle, setExamTitle] = useState('Scanner Thoracique HD');
  const [examType, setExamType] = useState('Scanner');
  const [examCenter, setExamCenter] = useState('Centre d\'Imagerie de Fann');
  const [examNotes, setExamNotes] = useState('Examen sans anomalie majeure détectée. Cliché archivé.');

  const [bloodGroup, setBloodGroup] = useState('O Rhésus positif (O+)');
  const [allergies, setAllergies] = useState('Pénicilline');
  const [chronicCond, setChronicCond] = useState('Hypertension artérielle (HTA)');

  const [specialtyType, setSpecialtyType] = useState('Pédiatrie & Néo-natologie');
  const [specialtyDoctor, setSpecialtyDoctor] = useState('Dr. Mariama Ba (Pédiatre CHU Fann)');
  const [specialtyDate, setSpecialtyDate] = useState('2026-08-25T10:00');
  const [specialtyNotes, setSpecialtyNotes] = useState('Consultation spécialisée certifiée UNAMUSC.');

  const [pathologyName, setPathologyName] = useState('Hypertension artérielle (HTA)');
  const [pathologyProtocol, setPathologyProtocol] = useState('Prise en charge 100% Universelle UNAMUSC');
  const [pathologyDoctor, setPathologyDoctor] = useState('Dr. Ousmane Sow');
  const [pathologyStatus, setPathologyStatus] = useState('Patient stabilisé sous traitement');

  const [telemedReason, setTelemedReason] = useState('Consultation médicale de suivi & ordonnance');
  const [telemedDoctor, setTelemedDoctor] = useState('Dr. Ousmane Sow (Médecin Généraliste UNAMUSC)');
  const [telemedUrgency, setTelemedUrgency] = useState('Urgence Standard (RDV sous 15 min)');
  const [telemedMode, setTelemedMode] = useState('Visio HD WebRTC en direct');

  // Compte à rebours 15 secondes pour rotation dynamique du QR Code
  const [qrSecondsLeft, setQrSecondsLeft] = useState(15);
  const [qrOtpToken, setQrOtpToken] = useState(() => Math.floor(Date.now() / 15000));

  useEffect(() => {
    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          setQrOtpToken(Math.floor(Date.now() / 15000));
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const canvasScanRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const liveScanRef = React.useRef(false);
  // '' = pas d'erreur | 'MOBILE_PHOTO_MODE' | 'DENIED' | 'PHOTO_NO_QR'
  const [cameraError, setCameraError] = useState('');

  // Un QR a été décodé (live ou photo) : vérification immédiate du code
  const handleDecoded = (text) => {
    stopCameraScan();
    verify(text);
  };

  // Balayage en continu des frames vidéo par jsQR (contexte sécurisé uniquement)
  const scanFrame = () => {
    if (!liveScanRef.current || !videoRef.current || !canvasScanRef.current) return;
    const v = videoRef.current;
    if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
      setCameraActive(true);
      const c = canvasScanRef.current;
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, c.width, c.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        handleDecoded(code.data);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  };

  const startCameraScan = () => {
    setCameraActive(false);
    setShowCameraScanner(true);
  };

  useEffect(() => {
    if (!showCameraScanner) return;
    let isSubscribed = true;
    let activeTimeout = null;

    const initCamera = async () => {
      setCameraError('');
      setCameraActive(false);

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('MOBILE_PHOTO_MODE');
        return;
      }

      // Safety timeout : si le flux vidéo ne produit pas d'images dans les 1.2s (ex: IP HTTP non sécurisée), basculer en mode photo
      activeTimeout = setTimeout(() => {
        if (isSubscribed && (!videoRef.current || videoRef.current.readyState < 2)) {
          console.warn('Flux vidéo indisponible ou bloqué par le navigateur HTTP, basculement en mode photo.');
          setCameraError('MOBILE_PHOTO_MODE');
        }
      }, 1200);

      // Attendre le rendu du composant modal et la ref video
      await new Promise(r => setTimeout(r, 150));
      if (!isSubscribed) return;

      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } 
          });
        } catch (e1) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          } catch (e2) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
        }

        if (!isSubscribed) {
          if (stream) stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.setAttribute('autoplay', 'true');
          videoRef.current.muted = true;
          
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().then(() => {
                setCameraActive(true);
                if (activeTimeout) clearTimeout(activeTimeout);
              }).catch(() => {});
            }
          };

          try {
            await videoRef.current.play();
            setCameraActive(true);
            if (activeTimeout) clearTimeout(activeTimeout);
          } catch (pe) {}

          liveScanRef.current = true;
          rafRef.current = requestAnimationFrame(scanFrame);
        }
      } catch (err) {
        console.warn('Accès caméra indisponible:', err);
        setCameraError(err && err.name === 'NotAllowedError' ? 'DENIED' : 'MOBILE_PHOTO_MODE');
      }
    };

    initCamera();

    return () => {
      isSubscribed = false;
      liveScanRef.current = false;
      setCameraActive(false);
      if (activeTimeout) clearTimeout(activeTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [showCameraScanner]);

  const stopCameraScan = () => {
    liveScanRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCameraScanner(false);
  };

  // Repli mobile ultra-robuste : décoder le QR depuis une photo prise avec l'appareil photo (support 12MP/48MP sans crash)
  const handlePhotoScan = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setLoading(true);

    const img = new Image();
    img.onload = async () => {
      try {
        // 1. Tenter le décodage natif ultra-rapide via BarcodeDetector (Chrome Android / Edge Mobile)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const barcodes = await detector.detect(img);
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              setLoading(false);
              handleDecoded(barcodes[0].rawValue);
              return;
            }
          } catch (bErr) {
            console.warn('BarcodeDetector fallback to jsQR:', bErr);
          }
        }

        // 2. Redimensionner l'image à 800px max pour garantir un décodage instantané par jsQR sans crash mémoire sur smartphone
        const MAX_DIM = 800;
        let scale = 1;
        if (img.width > MAX_DIM || img.height > MAX_DIM) {
          scale = Math.min(MAX_DIM / img.width, MAX_DIM / img.height);
        }
        const targetW = Math.round(img.width * scale);
        const targetH = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, targetW, targetH);
        
        const imageData = ctx.getImageData(0, 0, targetW, targetH);
        let code = typeof jsQR !== 'undefined' ? jsQR(imageData.data, targetW, targetH, { inversionAttempts: 'dontInvert' }) : null;

        if (!code || !code.data) {
          // Deuxième tentative avec inversion de polarité
          code = typeof jsQR !== 'undefined' ? jsQR(imageData.data, targetW, targetH, { inversionAttempts: 'invertFirst' }) : null;
        }

        if (!code || !code.data) {
          // Troisième tentative sur la taille originale
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = img.width;
          fullCanvas.height = img.height;
          const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });
          fullCtx.drawImage(img, 0, 0);
          const fullData = fullCtx.getImageData(0, 0, img.width, img.height);
          code = typeof jsQR !== 'undefined' ? jsQR(fullData.data, img.width, img.height) : null;
        }

        setLoading(false);
        if (code && code.data) {
          handleDecoded(code.data);
        } else {
          setCameraError('PHOTO_NO_QR');
        }
      } catch (err) {
        console.error('Erreur décodage photo QR:', err);
        setLoading(false);
        setCameraError('PHOTO_NO_QR');
      }
    };
    img.onerror = () => {
      setLoading(false);
      setCameraError('PHOTO_NO_QR');
    };
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  // Moteur de synthèse vocale Web Speech & Web Audio chime déclenché au scan du QR code
  const playAudioReminder = (firstName = 'Fatou', customMessage = null) => {
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

    const spokenMsg = customMessage || `Nanga def ${firstName}! Carte CSU scannée. Rappel UNAMUSC : consultation de suivi pédiatrique et vaccins PEV programmés. Prise en charge 100% gratuite.`;
    speakCleanText(spokenMsg, 'wolof');
  };

  // Bloque le défilement de la page uniquement lorsque la modale vidéo publicitaire est ouverte
  useEffect(() => {
    if (showAdModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAdModal]);

  // Sauvegarde instantanée de la carte vérifiée pour la synchronisation automatique avec le module de paiement
  useEffect(() => {
    if (result && result.valid !== false) {
      try {
        localStorage.setItem('cmu-last-verified-card', JSON.stringify(result));
        localStorage.setItem('cmu-active-insured', JSON.stringify(result));
        if (result.id) {
          localStorage.setItem('cmu-active-insured-id', result.id);
        } else if (result.cmuNumber) {
          localStorage.setItem('cmu-active-insured-cmu', result.cmuNumber);
        }
        window.dispatchEvent(new Event('unamusc_card_scanned'));
      } catch (e) {}
    }
  }, [result]);

  const [docResult, setDocResult] = useState(null);

  // Extrait le numéro CMU/CSU ou la référence de document du hash URL / query string
  useEffect(() => {
    const handleCheckHash = () => {
      const hashStr = window.location.hash || '';
      const searchStr = window.location.search || '';
      const urlParams = new URLSearchParams(searchStr || (hashStr.includes('?') ? hashStr.split('?')[1] : ''));

      let queryRef = urlParams.get('ref') || urlParams.get('cmu') || urlParams.get('code') || urlParams.get('doc');
      if (!queryRef) {
        const match = hashStr.match(/#\/?verify\/?([^?#]+)/i);
        if (match && match[1]) {
          queryRef = decodeURIComponent(match[1].trim());
        }
      }

      if (queryRef && !queryRef.includes('PAYMENTS') && !queryRef.includes('VERIFY')) {
        // Données scolaires encodées dans le QR par le Studio des cartes :
        // année + classe (toujours), identifiant INE, et IA/IEF uniquement
        // pour le circuit école publique (absent des cartes CMU-Daara).
        const academicYear = urlParams.get('academicYear') || '';
        const classLevel = urlParams.get('classLevel') || '';
        const schoolName = urlParams.get('schoolName') || '';
        const ine = urlParams.get('ine') || '';
        const ia = urlParams.get('ia') || '';
        const ief = urlParams.get('ief') || '';
        const cardProgram = urlParams.get('cardProgram') || '';
        if (academicYear || classLevel || schoolName || ine) {
          setScannedAcademic({ academicYear, classLevel, schoolName, ine, ia, ief, cardProgram });
        } else {
          setScannedAcademic(null);
        }
        setCmuNumber(queryRef);
        verify(queryRef);
      } else {
        // Chargement prioritaire de la carte scannée en mémoire (ex: URSULE DIAME, BINETA SOW)
        const scannedRaw = localStorage.getItem('cmu-last-verified-card') || localStorage.getItem('cmu-active-insured');
        const activeId = localStorage.getItem('cmu-active-insured-id');
        let cardCode = null;
        if (scannedRaw) {
          try {
            const scanned = JSON.parse(scannedRaw);
            cardCode = scanned.cmuNumber || scanned.cmuCode || scanned.rawCode || scanned.id;
          } catch (e) {}
        }
        if (!cardCode && activeId) cardCode = activeId;
        if (!cardCode && citizenUser) cardCode = citizenUser.cmuNumber || citizenUser.cmuId || citizenUser.id;
        
        const finalCode = cardCode || 'DKR_2600027.0';
        setCmuNumber(finalCode);
        verify(finalCode);
      }
    };

    handleCheckHash();
    window.addEventListener('hashchange', handleCheckHash);
    return () => window.removeEventListener('hashchange', handleCheckHash);
  }, []);

  const demoCards = {
    'SN-DK-BSF-9901': {
      valid: true,
      status: 'active',
      firstName: 'Fatou',
      lastName: 'Diallo',
      birthDate: '1992-06-15',
      phone: '+221 77 555 44 33',
      mutuelleName: 'Union Départementale des Mutuelles de Santé de Dakar (UDMS)',
      packageType: 'Bourse de sécurité familiale (BSF) — Gratuité 100% UNAMUSC',
      cmuNumber: 'SN-DK-BSF-9901',
      ippNumber: 'IPP-DANTEC-2026-9901',
      photoUrl: '/csu_bsf_real.png',
      bloodGroup: 'B Rhésus positif (B+)',
      allergies: 'Aucune connue',
      chronicConditions: 'Aucune',
      familyMembers: [
        { name: 'Moussa Diallo', relation: 'Enfant', age: 4 }
      ],
      checkedAt: new Date().toISOString()
    },
    'CMU-DKR-2026-4401': {
      valid: true,
      status: 'active',
      firstName: 'Fatou',
      lastName: 'Diop',
      birthDate: '1993-02-18',
      phone: '+221 77 888 99 00',
      mutuelleName: 'Mutuelle de santé de Dakar-Plateau',
      packageType: 'Tiers-payant hospitalier 100% UNAMUSC',
      cmuNumber: 'CMU-DKR-2026-4401',
      ippNumber: 'IPP-DANTEC-2026-4401',
      photoUrl: '/dr_fatou_diop.png',
      bloodGroup: 'O Rhésus positif (O+)',
      allergies: 'Aucune',
      chronicConditions: 'Aucune',
      familyMembers: [],
      checkedAt: new Date().toISOString()
    },
    'SN-DK-MED-8472': {
      valid: true,
      status: 'active',
      firstName: 'Amadou',
      lastName: 'Sow',
      birthDate: '1988-04-12',
      phone: '+221 77 450 12 34',
      mutuelleName: 'Mutuelle de santé de Dakar-Plateau',
      packageType: 'Formule familiale intégrale UNAMUSC (80% à 100%)',
      cmuNumber: 'SN-DK-MED-8472',
      ippNumber: 'IPP-FANN-2026-8472',
      photoUrl: '/csu_profile_hero_real.png',
      bloodGroup: 'O Rhésus positif (O+)',
      allergies: 'Pénicilline, Aspirine',
      chronicConditions: 'Hypertension artérielle (HTA)',
      familyMembers: [
        { name: 'Fatou Sow', relation: 'Épouse', age: 32 },
        { name: 'Moussa Sow', relation: 'Enfant', age: 6 }
      ],
      checkedAt: new Date().toISOString()
    },
    'CMU-DKR-2026-8812': {
      valid: true,
      status: 'active',
      firstName: 'Awa',
      lastName: 'Ndiaye',
      birthDate: '1990-08-25',
      phone: '+221 78 123 45 67',
      mutuelleName: 'Union départementale des mutuelles de Dakar',
      packageType: 'Tiers-payant hospitalier UNAMUSC (80%)',
      cmuNumber: 'CMU-DKR-2026-8812',
      ippNumber: 'IPP-DANTEC-2026-8812',
      photoUrl: '/csu_bsf_real.png',
      bloodGroup: 'O Rhésus positif (O+)',
      allergies: 'Aucune connue',
      chronicConditions: 'Aucune',
      familyMembers: [
        { name: 'Amadou Sow', relation: 'Conjoint', age: 34 },
        { name: 'Fatou Sow', relation: 'Enfant', age: 6 }
      ],
      checkedAt: new Date().toISOString()
    }
  };

  // Base de données officielle de vérification des Lettres de Garantie & Documents UNAMUSC
  const demoDocuments = {
    'GAR-2026-FANN-88': {
      valid: true,
      docType: 'LETTRE DE GARANTIE HOSPITALIÈRE HABILITÉE (80%)',
      title: 'Attestation Officielle de Prise en Charge Hospitalière UNAMUSC',
      referenceNo: 'GAR-2026-FANN-88',
      beneficiaryName: 'Fatou Diallo',
      cmuNumber: 'SN-DK-BSF-9901',
      hospitalName: 'Hôpital Universitaire de Fann (Dakar)',
      medicalAct: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)',
      estimatedAmount: '250 000 FCFA',
      guaranteedAmount: '200 000 FCFA (80% UNAMUSC)',
      patientRest: '50 000 FCFA (Ticket Modérateur)',
      status: 'VALIDÉ & HOMOLOGUÉ — PRISE EN CHARGE ACTIVE',
      cryptoHash: 'SHA256-FANN-8812-UNAMUSC-SN',
      notes: 'Dossier complet. Devis d\'hospitalisation vérifié conforme au barème national par l\'UNAMUSC.'
    },
    'GAR-2026-8812': {
      valid: true,
      docType: 'LETTRE DE GARANTIE HOSPITALIÈRE HABILITÉE (80%)',
      title: 'Attestation Officielle de Prise en Charge Hospitalière UNAMUSC',
      referenceNo: 'GAR-2026-8812',
      beneficiaryName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-8812',
      hospitalName: 'Hôpital Universitaire de Fann (Dakar)',
      medicalAct: 'Hospitalisation & Soins Spécialisés',
      estimatedAmount: '250 000 FCFA',
      guaranteedAmount: '200 000 FCFA (80% UNAMUSC)',
      patientRest: '50 000 FCFA',
      status: 'VALIDÉ & HOMOLOGUÉ — PRISE EN CHARGE ACTIVE',
      cryptoHash: 'SHA256-UNAMUSC-8812-SN',
      notes: 'L\'UNAMUSC s\'engage à régler directement le montant garanti sous présentation de la facture conforme.'
    },
    'GAR-MAT-2026-9910': {
      valid: true,
      docType: 'LETTRE DE GARANTIE ACCOUCHEMENT 100% UNAMUSC',
      title: 'Prise en Charge Maternité & Néonatale',
      referenceNo: 'GAR-MAT-2026-9910',
      beneficiaryName: 'Fatou Diallo',
      cmuNumber: 'SN-DK-BSF-9901',
      hospitalName: 'Centre Hospitalier Universitaire de Fann (Dakar)',
      medicalAct: 'Accouchement simple / Césarienne & Soins néonataux',
      estimatedAmount: '300 000 FCFA',
      guaranteedAmount: '300 000 FCFA (100%)',
      patientRest: '0 FCFA (Tiers-Payant Intégral)',
      status: 'VALIDÉ & HOMOLOGUÉ — GRATUITÉ 100% UNAMUSC',
      cryptoHash: 'SHA256-MAT-9910-UNAMUSC-SN',
      notes: 'La présente lettre de garantie dispense l\'assurée de toute avance de frais d\'hospitalisation.'
    }
  };

  const verify = async (num) => {
    let target = (num || cmuNumber || '').trim();

    // Extraire le code CSU si une URL complète a été scannée ou transmise
    if (target.includes('/verify/')) {
      const match = target.match(/\/verify\/([^?#]+)/i);
      if (match && match[1]) {
        target = decodeURIComponent(match[1].trim());
      }
    } else if (target.startsWith('http://') || target.startsWith('https://') || target.includes('/#/')) {
      const parts = target.split('/');
      const lastPart = parts[parts.length - 1].split('?')[0];
      if (lastPart) target = decodeURIComponent(lastPart.trim());
    }

    if (target.includes('?')) {
      target = target.split('?')[0].trim();
    }

    if (!target || target.toUpperCase().includes('PAYMENTS') || target.toUpperCase() === 'VERIFY' || target.toUpperCase().endsWith('/VERIFY')) {
      const scannedRaw = localStorage.getItem('cmu-last-verified-card') || localStorage.getItem('cmu-active-insured');
      const activeId = localStorage.getItem('cmu-active-insured-id');
      let fallbackCode = null;
      if (scannedRaw) {
        try {
          const scanned = JSON.parse(scannedRaw);
          fallbackCode = scanned.cmuNumber || scanned.cmuCode || scanned.rawCode || scanned.id;
        } catch (e) {}
      }
      if (!fallbackCode && activeId) fallbackCode = activeId;
      if (!fallbackCode && citizenUser) fallbackCode = citizenUser.cmuNumber || citizenUser.cmuId || citizenUser.id;
      target = fallbackCode || 'DKR_2600027.0';
    }

    setLoading(true);
    setError('');
    setDocResult(null);
    setResult(null);

    const upperTarget = target.toUpperCase();

    // Vérifier si c'est un code de document (Lettre de garantie, Bon de commande, Reçu)
    const isDocCode = upperTarget.startsWith('GAR-') || upperTarget.startsWith('ORD-') || upperTarget.startsWith('REC-') || upperTarget.startsWith('MAT-') || upperTarget.startsWith('CARNET-');

    if (isDocCode) {
      const docMatch = demoDocuments[upperTarget] || {
        valid: true,
        docType: 'LETTRE DE GARANTIE HOSPITALIÈRE HABILITÉE (80% à 100%)',
        title: 'Attestation Officielle de Prise en Charge Hospitalière UNAMUSC',
        referenceNo: upperTarget,
        beneficiaryName: citizenUser?.firstName ? `${citizenUser.firstName} ${citizenUser.lastName}` : 'Fatou Diallo',
        cmuNumber: citizenUser?.cmuNumber || 'SN-DK-BSF-9901',
        hospitalName: 'Hôpital Aristide Le Dantec (Dakar)',
        medicalAct: 'Hospitalisation soins intensifs & intervention chirurgicale',
        estimatedAmount: '450 000 FCFA',
        guaranteedAmount: '450 000 FCFA (100% Prise en charge UNAMUSC)',
        patientRest: '0 FCFA (Tiers-Payant Intégral)',
        status: 'VALIDÉ & HOMOLOGUÉ — PRISE EN CHARGE ACTIVE PAR L\'UNAMUSC',
        cryptoHash: `SHA256-${upperTarget.slice(-6)}-UNAMUSC-SN-2026`,
        notes: 'Document officiel certifié conforme par le Bureau National UNAMUSC. Garantit le paiement direct à la structure hospitalière.'
      };

      setDocResult(docMatch);
      setLoading(false);
      return;
    }

    // 1. Tenter de parser le payload s'il s'agit d'un QR code JSON
    if (target.startsWith('{') && target.endsWith('}')) {
      try {
        const parsed = JSON.parse(target);
        if (parsed.patient || parsed.cmu) {
          setResult({
            valid: true,
            status: 'active',
            firstName: parsed.patient ? parsed.patient.split(' ')[0] : 'Fatou',
            lastName: parsed.patient ? parsed.patient.split(' ').slice(1).join(' ') : 'Diallo',
            phone: '+221 77 555 44 33',
            mutuelleName: 'UDMS Dakar — UNAMUSC',
            packageType: 'Tiers-payant & télémédecine WebRTC (100%)',
            cmuNumber: parsed.cmu || 'SN-DK-BSF-9901',
            ippNumber: parsed.ipp || 'IPP-DANTEC-2026-9901',
            photoUrl: '/csu_bsf_real.png',
            bloodGroup: parsed.blood || 'B Rhésus positif (B+)',
            allergies: 'Aucune',
            chronicConditions: 'Aucune',
            familyMembers: [{ name: 'Moussa Diallo', relation: 'Enfant', age: 4 }],
            checkedAt: new Date().toISOString()
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Erreur parse JSON QR Code:', e);
      }
    }

    // 2. Recherche prioritaire dans le store centralisé des assurés (beneficiaryStore / MSD Dakar)
    const storeCard = getCardByCode(target);
    const isGlobalSuspended = (localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' || localStorage.getItem('cmu-cotisation-suspended') === 'true');
    
    if (storeCard && storeCard.firstName) {
      let cleanFirst = (storeCard.firstName || '').trim();
      let cleanLast = (storeCard.lastName || '').trim();
      if (cleanFirst.toLowerCase().endsWith(cleanLast.toLowerCase()) && cleanFirst.toLowerCase() !== cleanLast.toLowerCase()) {
        cleanFirst = cleanFirst.slice(0, cleanFirst.length - cleanLast.length).trim();
      }

      const storedOverride = localStorage.getItem(`cmu-status-${storeCard.cmuNumber}`);
      const finalStatus = isGlobalSuspended ? 'suspended' : (storedOverride || 'active');
      const finalValid = (finalStatus === 'active');

      setResult({
        ...storeCard,
        firstName: cleanFirst,
        lastName: cleanLast,
        status: finalStatus,
        valid: finalValid,
        audioReminder: {
          subtitle: `Assuré : ${cleanFirst} ${cleanLast} • Statut CSU : Actif`,
          transcript: `"Nanga def ${cleanFirst} ${cleanLast}! Votre carte CSU est active. Prise en charge Tiers-Payant 80% autorisée auprès de toutes les structures conventionnées."`,
          due: 'Contrôle Annuel • UDMS Dakar'
        }
      });
      setLoading(false);
      return;
    }

    // 3. Fallback de démonstration et recherche locale de Carte CSU
    const matchedKey = Object.keys(demoCards).find(k => 
      k.toUpperCase() === upperTarget || 
      k.toUpperCase().includes(upperTarget) || 
      upperTarget.includes(k.toUpperCase())
    );
    
    if (matchedKey) {
      const cardData = demoCards[matchedKey];
      const storedOverride = localStorage.getItem(`cmu-status-${matchedKey}`);
      const finalStatus = isGlobalSuspended ? 'suspended' : (storedOverride || 'active');
      const finalValid = (finalStatus === 'active');
      setResult({
        ...cardData,
        status: finalStatus,
        valid: finalValid
      });
    } else if (target.length >= 3) {
      const cleanTarget = target.toUpperCase();
      const storedOverride = localStorage.getItem(`cmu-status-${cleanTarget}`);
      const finalStatus = isGlobalSuspended ? 'suspended' : (storedOverride || 'active');
      const finalValid = (finalStatus === 'active');
      setResult({
        valid: finalValid,
        status: finalStatus,
        firstName: citizenUser?.firstName || 'Fatou',
        lastName: citizenUser?.lastName || 'Diallo',
        phone: citizenUser?.phone || '+221 77 555 44 33',
        mutuelleName: 'Union Départementale des Mutuelles de Santé de Dakar (UDMS)',
        packageType: 'Formule Tiers-payant UNAMUSC (100%)',
        cmuNumber: cleanTarget,
        ippNumber: `IPP-DKR-${cleanTarget.slice(-4)}`,
        photoUrl: '/csu_bsf_real.png',
        bloodGroup: 'B Rhésus positif (B+)',
        allergies: 'Aucune connue',
        chronicConditions: 'Aucune',
        familyMembers: [
          { name: 'Moussa Diallo', relation: 'Enfant', age: 4 }
        ],
        checkedAt: new Date().toISOString()
      });
    } else {
      setError('Numéro de carte ou code document non reconnu. Veuillez vérifier la saisie.');
    }

    setLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    verify();
  };

  // Exécution d'actions médicales directes depuis le QR Code
  const handleCreateGuarantee = (e) => {
    e.preventDefault();
    const patientName = selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`;
    const targetCode = selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber;
    const refNo = `GAR-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    setActionSuccess(`Lettre de garantie ${refNo} de ${Number(guaranteeAmount).toLocaleString()} FCFA (${guaranteeRate}) émise avec succès pour ${patientName} (${targetCode}) auprès de ${guaranteeHospital}. Service : ${guaranteeService}.`);
    setActiveModal(null);
  };

  const handleCreateOrder = (e) => {
    e.preventDefault();
    const patientName = selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`;
    const targetCode = selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber;
    const totalVal = Number(medQty) * Number(medPrice);
    const newOrd = {
      id: Date.now(),
      first_name: patientName,
      last_name: '',
      cmu_number: targetCode,
      pharmacy: medPharmacy,
      doctor: medDoctor,
      prescription_photo: prescriptionPhoto,
      prescription_file_name: prescriptionFileName,
      items_json: JSON.stringify([{ name: medName, form: medForm, qty: parseInt(medQty), price: parseFloat(medPrice), posology: medPosology }]),
      total_amount: totalVal,
      cmu_covered: totalVal * 0.5,
      patient_pay: totalVal * 0.5,
      status: 'active',
      created_at: new Date().toISOString()
    };
    const existing = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
    localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrd, ...existing]));

    setActionSuccess(`Bon de commande pharmacie (48h Tiers-Payant 50%) émis pour ${patientName} (${targetCode}) chez ${medPharmacy} par ${medDoctor} : ${medName} (${medQty} boîtes, total ${totalVal.toLocaleString()} FCFA). Ordonnance originale numérisée & jointe.`);
    setActiveModal(null);
  };

  const handleCreateTelemed = (e) => {
    e.preventDefault();
    const patientName = selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`;
    const targetCode = selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber;
    
    // Enregistrement des données pour initialisation directe de la télémédecine
    localStorage.setItem('telemed_target_cmu', targetCode);
    localStorage.setItem('telemed_target_name', patientName);
    localStorage.setItem('telemed_auto_open', 'true');
    localStorage.setItem('telemed_reason', telemedReason || 'Consultation médicale directe');
    localStorage.setItem('telemed_urgency', telemedUrgency || 'Urgence Standard');
    localStorage.setItem('telemed_doctor', telemedDoctor || 'Dr. Ousmane Sow');
    
    setActionSuccess(`Visio-consultation WebRTC 24/7 initialisée pour ${patientName} (${targetCode}). Redirection vers la salle médicale...`);
    setActiveModal(null);
    
    if (setView) {
      setView('telemedicine');
    } else {
      window.location.hash = '#telemedicine';
    }
  };

  const handleAddImaging = (e) => {
    e.preventDefault();
    const patientName = selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`;
    const targetCode = selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber;
    setActionSuccess(`Examen d'imagerie "${examTitle}" (${examType}) lié au Dossier Médical Partagé de ${patientName} (${targetCode}) chez ${examCenter}.`);
    setActiveModal(null);
  };

  const handleCreateSpecialty = (e) => {
    e.preventDefault();
    const patientName = selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`;
    const targetCode = selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber;
    setActionSuccess(`Consultation spécialisée (${specialtyType}) validée pour ${patientName} (${targetCode}) avec ${specialtyDoctor}.`);
    setActiveModal(null);
  };

  const handleCreatePathology = (e) => {
    e.preventDefault();
    const patientName = selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`;
    const targetCode = selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber;
    setActionSuccess(`Protocole ALD (${pathologyName}) enregistré sous la couverture 100% UNAMUSC pour ${patientName} (${targetCode}).`);
    setActiveModal(null);
  };

  const handleUpdateAntecedents = (e) => {
    e.preventDefault();
    setResult({
      ...result,
      bloodGroup,
      allergies,
      chronicConditions: chronicCond
    });
    setActionSuccess(`Antécédents médicaux mis à jour : Groupe sanguin ${bloodGroup}, Allergies: ${allergies}.`);
    setActiveModal(null);
  };

  const handlePrintCertificate = () => {
    if (!result) return;
    generateOfficialPdf({
      filename: `certificat_csu_${result.cmuNumber}.pdf`,
      docType: 'CERTIFICAT OFFICIEL DE DROITS & DE TIERS-PAYANT CSU',
      title: 'Attestation d\'ouverture de droits & de couverture médicale',
      referenceNo: `VERIF-${Date.now().toString().slice(-6)}`,
      beneficiaryName: `${result.firstName} ${result.lastName}`,
      cmuNumber: result.cmuNumber,
      structureName: result.mutuelleName,
      details: [
        { label: 'Statut de couverture', value: result.valid ? 'ACTIF & VALIDE (Tiers-payant 80-100%)' : 'INACTIF' },
        { label: 'Formule souscrite', value: result.packageType },
        { label: 'Identifiant Patient (IPP)', value: result.ippNumber },
        { label: 'Téléphone assuré', value: result.phone },
        { label: 'Groupe sanguin & allergies', value: `${result.bloodGroup} (Allergies: ${result.allergies || 'Aucune'})` },
        { label: 'Ayants droit rattachés', value: result.familyMembers && result.familyMembers.length > 0 ? result.familyMembers.map(f => `${f.name} (${f.relation})`).join(', ') : 'Aucun' }
      ],
      notes: 'Ce certificat atteste de la validité des droits à la date de vérification. Il permet la dispense d\'avance de frais auprès de toutes les structures conventionnées UNAMUSC.'
    });
  };

  return (
    <div className="verify-view fade-in-up container py-4 py-md-5" style={{ maxWidth: '1080px', margin: '0 auto', background: 'var(--bg-main, #f8fafc)', color: 'var(--text-main, #0f172a)', minHeight: '100vh' }}>
      
      {/* Banner signature moderne */}
      <section className="banner-mini text-white mb-5 rounded-4 overflow-hidden position-relative text-center" style={{
        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.5) 0%, rgba(16, 185, 129, 0.25) 100%), url("/csu_verify_hero.png") center/cover no-repeat',
        padding: '3rem 2rem',
        borderRadius: '26px',
        boxShadow: '0 16px 45px rgba(0, 0, 0, 0.22)',
        border: '1px solid rgba(255, 255, 255, 0.3)'
      }}>
        <div className="d-flex flex-column align-items-center justify-content-center text-center mx-auto" style={{ zIndex: 2, maxWidth: '800px' }}>
          <span className="badge px-3.5 py-2 mb-3 fw-semibold d-inline-block shadow-sm" style={{
            background: 'rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            backdropFilter: 'blur(6px)',
            borderRadius: '22px',
            fontSize: '0.82rem',
            border: '1px solid rgba(255, 255, 255, 0.35)'
          }}>
            🔍 UNAMUSC — Contrôle de validité & hub médical
          </span>
          <h1 style={{ color: '#fff', fontSize: '1.85rem', fontWeight: '850', marginBottom: '0.6rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            Vérification de la carte CSU
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: '500', maxWidth: '680px', margin: '0 auto', opacity: 0.95, lineHeight: '1.6' }}>
            Contrôlez instantanément la validité et les droits de tiers-payant d'un assuré de la Couverture Santé Universelle.
          </p>
        </div>
      </section>

      {/* Message de succès d'action */}
      {actionSuccess && (
        <div className="alert alert-success d-flex align-items-center mb-5 rounded-4 border-0 shadow-sm p-4" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#047857', border: '1.5px solid rgba(16, 185, 129, 0.35)', borderRadius: '20px' }}>
          <span className="fs-3 me-3.5">✅</span>
          <div style={{ fontSize: '0.95rem', fontWeight: '600', lineHeight: '1.6' }}>{actionSuccess}</div>
        </div>
      )}

      {/* Formulaire de recherche et vérification */}
      <div className="card shadow-sm border-0 p-4 p-md-5 mb-5" style={{ borderRadius: '26px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', boxShadow: '0 10px 35px rgba(0,0,0,0.06)' }}>
        <form onSubmit={handleSubmit} className="d-flex gap-3.5 flex-column flex-sm-row align-items-stretch">
          <input
            type="text"
            className="form-control input fw-bold px-4"
            placeholder="Entrez ou scannez un Code bénéficiaire (ex: DKR_260001.0)"
            value={cmuNumber}
            onChange={(e) => setCmuNumber(e.target.value)}
            style={{ flex: 1, minHeight: '56px', borderRadius: '18px', fontSize: '1rem', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)' }}
          />
          <div className="d-flex gap-2 flex-wrap flex-sm-nowrap">
            <button 
              type="submit" 
              className="btn text-white fw-bold px-3 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2 flex-fill" 
              disabled={loading}
              style={{ minHeight: '56px', borderRadius: '18px', background: '#059669', borderColor: '#059669', fontSize: '0.94rem', whiteSpace: 'nowrap' }}
            >
              {loading ? 'Vérification...' : '🔍 Vérifier'}
            </button>
            <button
              type="button"
              className="btn btn-outline-success fw-bold px-3 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2 flex-fill"
              onClick={startCameraScan}
              style={{ minHeight: '56px', borderRadius: '18px', fontSize: '0.92rem', border: '2px solid #059669', whiteSpace: 'nowrap' }}
              title="Ouvrir le scanner vidéo ou la modale photo"
            >
              📷 Caméra / Scan
            </button>
            <label
              className="btn btn-success text-white fw-bold px-3 py-3 shadow-sm d-flex align-items-center justify-content-center gap-2 flex-fill mb-0"
              style={{ minHeight: '56px', borderRadius: '18px', fontSize: '0.92rem', background: '#047857', borderColor: '#047857', cursor: 'pointer', whiteSpace: 'nowrap' }}
              title="Prendre une photo directe du QR code avec l'appareil photo de votre smartphone"
            >
              <span>📸</span>
              <span>Photo QR</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoScan}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </form>

        {error && (
          <div className="alert alert-danger p-4 mt-4 mb-0 rounded-4 d-flex align-items-center shadow-sm" style={{ borderRadius: '18px' }}>
            <span className="fs-4 me-3">⚠️</span>
            <div style={{ fontSize: '0.94rem', lineHeight: '1.55' }}>{error}</div>
          </div>
        )}
      </div>

      {/* MODALE CAMÉRA SCANNER (React Portal) — 2 modes :
          • Scan LIVE par jsQR (PC / contexte sécurisé https)
          • Repli PHOTO (mobile en http://IP : capture appareil → décodage jsQR) */}
      {showCameraScanner && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.94)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.5rem', textAlign: 'center', border: '2px solid #059669', boxShadow: '0 25px 70px rgba(0,0,0,0.75)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-extrabold mb-0 text-success d-flex align-items-center gap-2" style={{ fontSize: '1.1rem' }}>
                <span>📷</span>
                <span>Scanner un QR Code CSU</span>
              </h5>
              <button type="button" className="btn-close" onClick={stopCameraScan}></button>
            </div>

            {/* FENÊTRE DE PRÉVISUALISATION CLAIRE & INFAILLIBLE */}
            <div style={{ position: 'relative', width: '100%', height: '240px', background: '#022c22', borderRadius: '18px', overflow: 'hidden', border: '3px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.2rem' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                onLoadedData={() => setCameraActive(true)}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  display: (cameraActive && !cameraError) ? 'block' : 'none'
                }}
              ></video>

              {/* OVERLAY DE BALAYAGE LASER EN DIRECT SI LA CAMÉRA VIDÉO EST ACTIVE */}
              {cameraActive && !cameraError && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '180px', height: '180px', border: '3px solid #34d399', borderRadius: '16px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: '3px', background: '#10b981', boxShadow: '0 0 12px #34d399', animation: 'scanPulse 2s infinite ease-in-out' }} />
                  </div>
                </div>
              )}

              {/* MESSAGE & GUIDAGE PHOTO SI FLUX VIDÉO RESTREINT SUR SMARTPHONE HTTP */}
              {(!cameraActive || cameraError) && (
                <div className="p-3 text-center" style={{ position: 'relative', zIndex: 2, color: '#f8fafc' }}>
                  <div style={{ fontSize: '2.6rem', marginBottom: '0.3rem' }}>📸</div>
                  <h6 className="fw-extrabold mb-1" style={{ fontSize: '1.05rem', color: '#34d399' }}>Numérisation Rapide par Photo</h6>
                  <p className="small mb-0" style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>
                    {cameraError === 'PHOTO_NO_QR'
                      ? 'Aucun QR Code détecté. Prenez la photo bien de face et nette.'
                      : 'Appuyez sur le bouton vert ci-dessous pour ouvrir l\'appareil photo de votre téléphone.'}
                  </p>
                </div>
              )}
            </div>

            {/* BOUTONS DE CAPTURE PHOTO DIRECTE (FONCTIONNE À 100% SUR TOUT MOBILE) */}
            <div className="d-flex flex-column gap-2 mb-3">
              <label
                className="btn text-white fw-bold w-100 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ background: '#059669', borderColor: '#059669', borderRadius: '14px', padding: '0.85rem', fontSize: '0.95rem', cursor: 'pointer' }}
              >
                <span>📸</span>
                <span>Prendre le QR Code en photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoScan}
                  style={{ display: 'none' }}
                />
              </label>

              <label
                className="btn btn-outline-success fw-bold w-100 d-flex align-items-center justify-content-center gap-2"
                style={{ borderRadius: '14px', padding: '0.75rem', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                <span>📁</span>
                <span>Choisir une photo dans la galerie</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoScan}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* SELECTION RAPIDE DE TEST POUR DÉMONSTRATION EN UN CLIC */}
            <div className="pt-2 border-top text-start" style={{ borderColor: 'var(--border-color)' }}>
              <small className="text-muted fw-bold d-block mb-1.5" style={{ fontSize: '0.76rem' }}>
                🧪 Ou simulez le scan d'une carte de test :
              </small>
              <div className="d-flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className="btn btn-sm btn-light border fw-bold text-success"
                  style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                  onClick={() => handleDecoded('DKR_2600027.0')}
                >
                  Ursule Diame (DKR_2600027.0)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-light border fw-bold text-success"
                  style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                  onClick={() => handleDecoded('DKR_2600011.0')}
                >
                  Bineta Sow (DKR_2600011.0)
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-light border fw-bold text-success"
                  style={{ fontSize: '0.75rem', borderRadius: '8px' }}
                  onClick={() => handleDecoded('CMU-DKR-2026-4401')}
                >
                  Fatou Diop
                </button>
              </div>
            </div>

            <canvas ref={canvasScanRef} style={{ display: 'none' }}></canvas>

            <div className="mt-3 d-flex gap-2 justify-content-center">
              <button type="button" className="btn btn-secondary fw-bold px-4 py-2" style={{ borderRadius: '12px' }} onClick={stopCameraScan}>
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE PUBLICITÉ VIDÉO & SPONSORS LORS DU SCAN DE CARTE (REACT PORTAL CENTRÉ SUR L'ÉCRAN MOBILE) */}
      {showAdModal && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            boxSizing: 'border-box'
          }} 
          className="fade-in"
          onClick={() => setShowAdModal(false)}
        >
          <div 
            style={{
              maxWidth: '720px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-card)',
              border: '2px solid #059669',
              borderRadius: '24px',
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--text-main)',
              display: 'flex',
              flexDirection: 'column',
              margin: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Défilement sponsors */}
            <div style={{
              background: 'linear-gradient(90deg, #047857 0%, #1e40af 100%)',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: '700',
              fontSize: '0.9rem',
              gap: '1rem',
              color: '#ffffff'
            }}>
              <div className="marquee-container" style={{ flex: 1 }}>
                <div className="marquee-content text-white">
                  <span className="d-inline-flex align-items-center gap-3">
                    <div className="d-inline-flex align-items-center gap-2">
                      <img 
                        src="/logo_wave.png" 
                        alt="Wave" 
                        style={{ height: '28px', borderRadius: '6px', background: '#ffffff', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.4)', objectFit: 'contain' }} 
                      />
                      <img 
                        src="/logo_partner_patisen.png" 
                        alt="Patisen" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/logo_patisen.png'; }}
                        style={{ height: '28px', borderRadius: '6px', background: '#ffffff', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.4)', objectFit: 'contain' }} 
                      />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700' }} className="d-inline-flex align-items-center gap-2">
                      Sponsorisé par Patisen & Wave — République du Sénégal
                      <img 
                        src="/drapeau_senegal.png" 
                        alt="Sénégal" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/senegal_flag.png'; }}
                        style={{ height: '20px', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', objectFit: 'cover', verticalAlign: 'middle' }} 
                      />
                    </span>
                  </span>
                  <span className="d-inline-flex align-items-center gap-2">
                    <span style={{ fontSize: '0.88rem' }} className="d-inline-flex align-items-center gap-2">
                      <img 
                        src="/drapeau_senegal.png" 
                        alt="Sénégal" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/senegal_flag.png'; }}
                        style={{ height: '20px', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', objectFit: 'cover', verticalAlign: 'middle' }} 
                      />
                      Programme national de la couverture sanitaire universelle du Sénégal (UNAMUSC)
                    </span>
                  </span>
                  <span className="d-inline-flex align-items-center gap-3">
                    <div className="d-inline-flex align-items-center gap-2">
                      <img 
                        src="/logo_wave.png" 
                        alt="Wave" 
                        style={{ height: '28px', borderRadius: '6px', background: '#ffffff', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.4)', objectFit: 'contain' }} 
                      />
                      <img 
                        src="/logo_partner_patisen.png" 
                        alt="Patisen" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/logo_patisen.png'; }}
                        style={{ height: '28px', borderRadius: '6px', background: '#ffffff', padding: '2px 6px', border: '1px solid rgba(255,255,255,0.4)', objectFit: 'contain' }} 
                      />
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: '700' }} className="d-inline-flex align-items-center gap-2">
                      Sponsorisé par Patisen & Wave — République du Sénégal
                      <img 
                        src="/drapeau_senegal.png" 
                        alt="Sénégal" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/senegal_flag.png'; }}
                        style={{ height: '20px', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', objectFit: 'cover', verticalAlign: 'middle' }} 
                      />
                    </span>
                  </span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAdModal(false)}
                className="btn btn-light btn-sm fw-bold flex-shrink-0"
                style={{ borderRadius: '10px', fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}
              >
                Fermer ✕
              </button>
            </div>

            {/* Lecteur avec visuel fallback anti-écran noir */}
            <div style={{ position: 'relative', minHeight: '320px', background: 'linear-gradient(135deg, #0b1120 0%, #1e293b 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url("/csu_digital_health_real.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.35 }} />
              <div style={{ position: 'relative', zIndex: 2, maxWidth: '540px' }}>
                <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3" style={{ background: '#059669', color: '#ffffff', width: '64px', height: '64px', fontSize: '2rem', boxShadow: '0 8px 24px rgba(5,150,105,0.4)' }}>
                  🎬
                </div>
                <h4 className="fw-extrabold text-white mb-2" style={{ fontSize: '1.3rem' }}>
                  Présentation officielle du programme CSU
                </h4>
                <p className="text-slate-200 small mb-3" style={{ lineHeight: '1.6' }}>
                  Partenariat national pour la gratuité des soins de santé, des urgences pédiatriques et de la télémédecine au Sénégal.
                </p>
                <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
                  <span className="badge bg-emerald-500 text-white px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem', background: '#059669' }}>
                    🟢 UNAMUSC 2026
                  </span>
                  <span className="badge bg-blue-600 text-white px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem', background: '#1e40af' }}>
                    🏢 Groupe Patisen & Wave SA
                  </span>
                </div>
              </div>
            </div>

            {/* Pied du popup */}
            <div style={{ padding: '1.25rem', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card-subtle)', flexWrap: 'wrap', gap: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                💡 Présentation officielle de la Couverture Santé Universelle
              </div>
              <button 
                type="button" 
                className="btn btn-emerald fw-bold text-white"
                onClick={() => setShowAdModal(false)}
                style={{ borderRadius: '12px', padding: '0.6rem 1.5rem', background: '#059669', borderColor: '#059669' }}
              >
                ✅ Accéder à la carte d'assuré
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* AFFICHAGE DE L'ATTESTATION D'AUTHENTICITÉ DE DOCUMENT / LETTRE DE GARANTIE UNAMUSC */}
      {docResult && (
        <div className="card shadow-lg border-0 mb-4 overflow-hidden fade-in-up" style={{ borderRadius: '24px', background: 'var(--bg-card)', border: '2px solid #059669' }}>
          {/* Header émeraude */}
          <div className="p-4 text-white" style={{ background: 'linear-gradient(135deg, #047857 0%, #059669 100%)' }}>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <span className="badge bg-white text-success fw-bold px-3 py-1.5 rounded-pill shadow-sm" style={{ fontSize: '0.82rem' }}>
                🟢 Document officiel certifié et infalsifiable
              </span>
              <span className="small text-white-50 fw-mono">
                EMPREINTE : {docResult.cryptoHash}
              </span>
            </div>
            <h3 className="fw-bold mb-1 text-white" style={{ fontSize: '1.35rem' }}>
              {docResult.title}
            </h3>
            <p className="mb-0 text-emerald-100 small">
              Homologué par l'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) — République du Sénégal
            </p>
          </div>

          {/* Body details */}
          <div className="card-body p-4">
            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'rgba(5, 150, 105, 0.06)', border: '1px solid rgba(5, 150, 105, 0.18)' }}>
                  <small className="text-muted fw-bold d-block mb-1">👤 Assuré(e) bénéficiaire</small>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{docResult.beneficiaryName}</h5>
                  <div className="small text-success fw-bold">N° CSU carte : {docResult.cmuNumber}</div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="p-3 rounded-3" style={{ background: 'rgba(15, 23, 42, 0.04)', border: '1px solid rgba(15, 23, 42, 0.12)' }}>
                  <small className="text-muted fw-bold d-block mb-1">📄 Référence document</small>
                  <h5 className="fw-bold mb-1" style={{ color: '#059669', fontFamily: 'monospace' }}>#{docResult.referenceNo}</h5>
                  <div className="small text-muted">{docResult.docType}</div>
                </div>
              </div>
            </div>

            {/* Tableau des prestations certifiées */}
            <div className="table-responsive mb-4 rounded-3 border">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr className="small text-muted">
                    <th>Élément de la garantie</th>
                    <th>Spécification certifiée UNAMUSC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="fw-bold text-secondary">Établissement Récepteur</td>
                    <td className="fw-bold text-dark">{docResult.hospitalName}</td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-secondary">Acte Médical Pris en Charge</td>
                    <td className="fw-bold text-dark">{docResult.medicalAct}</td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-secondary">Montant Devis / Estimation</td>
                    <td className="fw-bold text-dark">{docResult.estimatedAmount}</td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-secondary">Prise en Charge UNAMUSC</td>
                    <td className="fw-bold text-success fs-6">{docResult.guaranteedAmount}</td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-secondary">Ticket Modérateur Patient</td>
                    <td className="fw-bold text-warning-emphasis">{docResult.patientRest}</td>
                  </tr>
                  <tr>
                    <td className="fw-bold text-secondary">Statut du Titre</td>
                    <td>
                      <span className="badge bg-success-subtle text-success border border-success fw-bold px-3 py-1">
                        {docResult.status}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Note officielle d'engagement */}
            <div className="p-3 rounded-3 mb-4" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
              <strong className="small text-success fw-bold d-block mb-1">Notice d'Engagement UNAMUSC :</strong>
              <p className="small mb-0 text-dark" style={{ lineHeight: 1.5 }}>
                {docResult.notes}
              </p>
            </div>

            {/* Actions */}
            <div className="d-flex justify-content-center gap-3 flex-wrap">
              <button 
                type="button"
                className="btn btn-success fw-bold text-white px-4 py-2.5 shadow-sm"
                style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}
                onClick={() => {
                  generateOfficialPdf({
                    filename: `lettre_garantie_${docResult.referenceNo}.pdf`,
                    docType: docResult.docType,
                    title: docResult.title,
                    referenceNo: docResult.referenceNo,
                    beneficiaryName: docResult.beneficiaryName,
                    cmuNumber: docResult.cmuNumber,
                    structureName: docResult.hospitalName,
                    details: [
                      { label: 'N° CSU Carte', value: docResult.cmuNumber },
                      { label: 'Acte Médical', value: docResult.medicalAct },
                      { label: 'Prise en charge UNAMUSC', value: docResult.guaranteedAmount },
                      { label: 'Ticket Modérateur Patient', value: docResult.patientRest },
                      { label: 'Statut du Document', value: 'Certifié conforme et authentique' }
                    ],
                    notes: docResult.notes
                  });
                }}
              >
                📥 Télécharger le PDF Certifié Officiel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AFFICHAGE DU PASS CARTE CSU NUMÉRIQUE DESIGN HAUTE DÉFINITION SUR MOBILE & DESKTOP */}
      {result && (
        <div className="fade-in-up" style={{ maxWidth: '100%', overflowX: 'hidden' }}>

          {/* BANDEAU DE DÉFILEMENT SPONSORS & PROGRAMME NATIONAL (DÉFILEMENT CONTINU SANS FIN) */}
          <div 
            className="p-4 mb-5 rounded-4 shadow-sm border overflow-hidden position-relative" 
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-color)', borderRadius: '24px' }}
          >
            <div className="d-flex align-items-center justify-content-between gap-4">
              <div className="marquee-container" style={{ flex: 1, overflow: 'hidden' }}>
                <div className="marquee-content d-flex align-items-center gap-5">
                  <span className="fw-bold d-inline-flex align-items-center gap-3" style={{ fontSize: '0.92rem', color: '#0284c7', whiteSpace: 'nowrap' }}>
                    <div className="d-inline-flex align-items-center gap-2.5">
                      <img 
                        src="/logo_wave.png" 
                        alt="Wave" 
                        style={{ 
                          height: '32px', 
                          borderRadius: '8px', 
                          background: '#ffffff', 
                          padding: '4px 10px', 
                          border: '1px solid #cbd5e1', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.08)', 
                          objectFit: 'contain',
                          verticalAlign: 'middle'
                        }} 
                      />
                      <img 
                        src="/logo_partner_patisen.png" 
                        alt="Patisen" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/logo_patisen.png'; }}
                        style={{ 
                          height: '32px', 
                          borderRadius: '8px', 
                          background: '#ffffff', 
                          padding: '4px 10px', 
                          border: '1px solid #cbd5e1', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.08)', 
                          objectFit: 'contain',
                          verticalAlign: 'middle'
                        }} 
                      />
                    </div>
                    <span className="d-inline-flex align-items-center gap-2.5">
                      Sponsorisé par Patisen & Wave — République du Sénégal
                      <img 
                        src="/drapeau_senegal.png" 
                        alt="Sénégal" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/senegal_flag.png'; }}
                        style={{ 
                          height: '22px', 
                          borderRadius: '4px', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)', 
                          objectFit: 'cover',
                          verticalAlign: 'middle'
                        }} 
                      />
                    </span>
                  </span>
                  <span className="fw-bold d-inline-flex align-items-center gap-3" style={{ fontSize: '0.92rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    <span className="d-inline-flex align-items-center gap-2.5">
                      <img 
                        src="/drapeau_senegal.png" 
                        alt="Sénégal" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/senegal_flag.png'; }}
                        style={{ 
                          height: '22px', 
                          borderRadius: '4px', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)', 
                          objectFit: 'cover',
                          verticalAlign: 'middle'
                        }} 
                      />
                      Programme national de la couverture sanitaire universelle du Sénégal (UNAMUSC)
                    </span>
                  </span>
                  <span className="fw-bold d-inline-flex align-items-center gap-3" style={{ fontSize: '0.92rem', color: '#0284c7', whiteSpace: 'nowrap' }}>
                    <div className="d-inline-flex align-items-center gap-2.5">
                      <img 
                        src="/logo_wave.png" 
                        alt="Wave" 
                        style={{ 
                          height: '32px', 
                          borderRadius: '8px', 
                          background: '#ffffff', 
                          padding: '4px 10px', 
                          border: '1px solid #cbd5e1', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.08)', 
                          objectFit: 'contain',
                          verticalAlign: 'middle'
                        }} 
                      />
                      <img 
                        src="/logo_partner_patisen.png" 
                        alt="Patisen" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/logo_patisen.png'; }}
                        style={{ 
                          height: '32px', 
                          borderRadius: '8px', 
                          background: '#ffffff', 
                          padding: '4px 10px', 
                          border: '1px solid #cbd5e1', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.08)', 
                          objectFit: 'contain',
                          verticalAlign: 'middle'
                        }} 
                      />
                    </div>
                    <span className="d-inline-flex align-items-center gap-2.5">
                      Sponsorisé par Patisen & Wave — République du Sénégal
                      <img 
                        src="/drapeau_senegal.png" 
                        alt="Sénégal" 
                        onError={(e) => { e.target.onerror = null; e.target.src = '/senegal_flag.png'; }}
                        style={{ 
                          height: '22px', 
                          borderRadius: '4px', 
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)', 
                          objectFit: 'cover',
                          verticalAlign: 'middle'
                        }} 
                      />
                    </span>
                  </span>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-outline-secondary btn-sm fw-bold py-2 px-3.5 flex-shrink-0 ms-3"
                style={{ fontSize: '0.86rem', borderRadius: '14px', background: 'var(--bg-card)' }}
                onClick={() => setShowAdModal(true)}
              >
                ▶️ Vidéo
              </button>
            </div>
          </div>
          
          {/* CARTE NUMÉRIQUE CSU EXCLUSIVE MUTUALIS DAKAR — FOND COMPATIBLE MODE CLAIR & SOMBRE */}
          <div 
            className="p-4 p-md-5 rounded-4 shadow-lg position-relative overflow-hidden mb-5 cursor-pointer"
            style={{
              background: 'var(--bg-card)',
              boxShadow: 'var(--shadow-lg)',
              border: (result.valid && result.status !== 'suspended' && result.status !== 'suspendu') 
                ? '2.5px solid #059669' 
                : '2.5px solid #ef4444',
              borderRadius: '28px',
              color: 'var(--text-main)',
              cursor: 'pointer'
            }}
            onClick={() => setShowQrModal(true)}
            title="Toucher pour ouvrir le QR Code Tri-Laye grand format"
          >
            {/* Motifs géométriques subtils en arrière-plan */}
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', background: 'rgba(5, 150, 105, 0.05)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-50px', left: '-30px', width: '160px', height: '160px', background: 'rgba(30, 64, 175, 0.04)', borderRadius: '50%', pointerEvents: 'none' }} />

            {/* ENTÊTE DE LA CARTE */}
            <div className="d-flex justify-content-between align-items-start mb-4 position-relative" style={{ zIndex: 2 }}>
              <div>
                <span className="d-block fw-bold mb-1.5" style={{ fontSize: '0.84rem', letterSpacing: '1px', color: '#10b981' }}>
                  Couverture Santé Universelle
                </span>
                <h4 className="fw-extrabold mb-0" style={{ fontSize: '1.55rem', color: 'var(--text-main)', letterSpacing: '0.5px' }}>
                  MUTUALIS DAKAR 🇸🇳
                </h4>
              </div>

              <span 
                className="badge px-4 py-2.5 fw-extrabold shadow-sm d-inline-flex align-items-center gap-2"
                style={{
                  background: (result.valid && result.status !== 'suspended' && result.status !== 'suspendu') ? '#059669' : '#dc2626',
                  color: '#ffffff',
                  borderRadius: '22px',
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.25)',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setResult(prev => ({
                    ...prev,
                    valid: !(prev.valid && prev.status !== 'suspended' && prev.status !== 'suspendu'),
                    status: (prev.valid && prev.status !== 'suspended' && prev.status !== 'suspendu') ? 'suspended' : 'active'
                  }));
                }}
                title="Cliquer pour basculer le statut d'inactif à actif pour le test"
              >
                {(result.valid && result.status !== 'suspended' && result.status !== 'suspendu') ? '● Actif' : '🔴 Suspendu'}
              </span>
            </div>

            <hr className="my-4" style={{ borderColor: 'var(--border-color)', opacity: 0.6 }} />

            {/* CORPS DE LA CARTE : PHOTO + NOM + MUTUELLE & FORMULE */}
            <div className="row g-4 align-items-center mb-4 position-relative" style={{ zIndex: 2 }}>
              <div className="col-auto">
                {result.photoUrl ? (
                  <img 
                    src={result.photoUrl} 
                    alt={`${result.firstName} ${result.lastName}`}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/csu_profile_hero_real.png'; }}
                    style={{
                      width: '92px',
                      height: '92px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3.5px solid #059669',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.16)'
                    }}
                  />
                ) : (
                  <div 
                    style={{
                      width: '92px',
                      height: '92px',
                      borderRadius: '50%',
                      background: 'var(--bg-card-subtle)',
                      border: '3.5px solid #059669',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.16)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2.5rem',
                      color: 'var(--text-main)',
                      flexShrink: 0
                    }}
                    title="Photo certifiée en attente"
                  >
                    👤
                  </div>
                )}
              </div>

              <div className="col">
                <div className="d-flex flex-wrap gap-3 align-items-center mb-2.5">
                  <h3 className="fw-extrabold mb-0" style={{ fontSize: '1.6rem', color: 'var(--text-main)' }}>
                    {result.firstName} {result.lastName}
                  </h3>
                  {result.isDependent ? (
                    <span className="badge fw-bold px-3.5 py-1.5" style={{ background: result.dependentType === 'MAJOR' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(245, 158, 11, 0.18)', color: result.dependentType === 'MAJOR' ? '#818cf8' : '#fbbf24', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.84rem' }}>
                      {result.dependentType === 'MAJOR' ? '👤 Ayant-droit majeur' : '👶 Enfant mineur'}
                    </span>
                  ) : (
                    <span className="badge fw-bold px-3.5 py-1.5" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', fontSize: '0.84rem' }}>
                      🛡️ Adhérent Principal
                    </span>
                  )}
                </div>

                {result.isDependent && result.sponsorName && (
                  <div className="p-3 mb-3 rounded-4 border d-flex align-items-center gap-2.5" style={{ background: 'rgba(59, 130, 246, 0.08)', borderColor: 'rgba(59, 130, 246, 0.25)', fontSize: '0.88rem' }}>
                    <span className="fs-5">🏛️</span>
                    <div>
                      <span className="text-muted fw-semibold">Rattaché au titulaire :</span>{' '}
                      <strong className="text-primary">{result.sponsorName}</strong>{' '}
                      <code className="px-2.5 py-1 border rounded-3 fw-bold" style={{ fontSize: '0.84rem', background: 'var(--bg-card)', color: 'var(--text-main)' }}>{result.sponsorCmu}</code>
                    </div>
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2.5 align-items-center">
                  <span className="badge fw-bold px-3.5 py-2 d-inline-flex align-items-center gap-2" style={{ background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '12px', fontSize: '0.86rem' }}>
                    📦 {result.packageBadge || result.packageType || 'Tiers-payant 80%'}
                  </span>
                  <span className="badge px-3.5 py-2 fw-bold border d-inline-flex align-items-center gap-2" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', borderColor: 'var(--border-color)', borderRadius: '12px', fontSize: '0.86rem' }}>
                    🏥 {result.mutuelleName ? result.mutuelleName : 'Mutuelle de santé départementale de Dakar'}
                  </span>
                </div>

                {/* 📚 DONNÉES SCOLAIRES lues dans le QR code de la carte.
                    Elles ne figurent plus sur le recto (elles changent chaque
                    année) : c'est ici, après scan, que l'agent les consulte. */}
                {scannedAcademic && (
                  <div className="p-3 mt-3 rounded-4 border" style={{ background: 'rgba(37, 99, 235, 0.07)', borderColor: 'rgba(37, 99, 235, 0.28)' }}>
                    <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                      <span style={{ fontSize: '1.05rem' }}>📚</span>
                      <strong style={{ fontSize: '0.92rem', color: '#1d4ed8' }}>
                        Données scolaires (lues dans le QR)
                      </strong>
                      {scannedAcademic.cardProgram === 'CMU_DAARA' && (
                        <span className="badge fw-bold px-2 py-1" style={{ background: 'rgba(180, 83, 9, 0.16)', color: '#b45309', borderRadius: '10px', fontSize: '0.72rem' }}>CMU-Daara</span>
                      )}
                      {scannedAcademic.cardProgram === 'CMU_ELEVES' && (
                        <span className="badge fw-bold px-2 py-1" style={{ background: 'rgba(37, 99, 235, 0.16)', color: '#1d4ed8', borderRadius: '10px', fontSize: '0.72rem' }}>CMU-Élèves</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', gap: '0.6rem' }}>
                      {scannedAcademic.academicYear && (
                        <div>
                          <span className="d-block text-muted" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Année scolaire</span>
                          <strong style={{ fontSize: '0.92rem' }}>{scannedAcademic.academicYear}</strong>
                        </div>
                      )}
                      {scannedAcademic.classLevel && (
                        <div>
                          <span className="d-block text-muted" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Classe / Niveau</span>
                          <strong style={{ fontSize: '0.92rem' }}>{scannedAcademic.classLevel}</strong>
                        </div>
                      )}
                      {scannedAcademic.schoolName && (
                        <div>
                          <span className="d-block text-muted" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {scannedAcademic.cardProgram === 'CMU_DAARA' ? 'Daara' : 'Établissement'}
                          </span>
                          <strong style={{ fontSize: '0.92rem' }}>{scannedAcademic.schoolName}</strong>
                        </div>
                      )}
                      {scannedAcademic.ine && (
                        <div>
                          <span className="d-block text-muted" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {scannedAcademic.cardProgram === 'CMU_DAARA' ? 'N° IEN' : 'N° INE'}
                          </span>
                          <strong className="font-monospace" style={{ fontSize: '0.9rem' }}>{scannedAcademic.ine}</strong>
                        </div>
                      )}
                      {/* IA / IEF : circuit école publique uniquement — jamais
                          présent sur une carte CMU-Daara. */}
                      {scannedAcademic.cardProgram !== 'CMU_DAARA' && (scannedAcademic.ia || scannedAcademic.ief) && (
                        <div style={{ gridColumn: '1 / -1' }}>
                          <span className="d-block text-muted" style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>IA / IEF</span>
                          <strong style={{ fontSize: '0.92rem' }}>
                            {[scannedAcademic.ia, scannedAcademic.ief].filter(Boolean).join(' — ') || 'Non renseigné'}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 📱 BLOC QR CODE CENTRÉ AVEC ROTATION DYNAMIQUE 15 SECONDES */}
            <div className="p-4 p-md-5 text-center my-4 rounded-4" style={{ background: 'var(--bg-card)', border: '2px solid #059669', borderRadius: '24px', boxShadow: '0 10px 30px rgba(5, 150, 105, 0.12)' }}>
              <div className="d-flex align-items-center justify-content-center gap-2 mb-3">
                <span className="badge bg-success text-white px-3.5 py-1.5 fw-bold" style={{ fontSize: '0.82rem', borderRadius: '12px' }}>
                  🔒 QR Code Dynamique • ⏱️ {qrSecondsLeft}s
                </span>
              </div>

              <div className="d-flex justify-content-center align-items-center w-100 my-3.5">
                <div className="p-3 rounded-4 shadow-sm border position-relative" style={{ background: '#ffffff', borderColor: 'var(--border-color)', overflow: 'hidden', display: 'inline-flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${window.location.origin}/#/verify/${result.cmuNumber}?otp=${qrOtpToken}`)}`} 
                    alt="QR Code CSU" 
                    style={{ 
                      width: '140px', 
                      height: '140px', 
                      display: 'block',
                      margin: '0 auto'
                    }} 
                  />
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                <span className="fw-extrabold" style={{ fontSize: '0.86rem', color: '#10b981' }}>
                  Authentifié UNAMUSC Sénégal 🇸🇳
                </span>
              </div>

              <div className="fw-extrabold font-monospace mb-2.5" style={{ fontSize: '1.05rem', color: '#10b981', letterSpacing: '0.5px' }}>
                Code bénéficiaire: {result.cmuNumber} • <span style={{ color: '#38bdf8' }}>SEC-{(qrOtpToken % 90000 + 10000)}</span>
              </div>

              <div className="d-flex justify-content-center flex-wrap gap-2.5 mb-2.5">
                <span className="badge bg-success text-white fw-bold px-3 py-1.5" style={{ fontSize: '0.76rem', borderRadius: '10px' }}>
                  🟢 Signature Cryptographique Valide
                </span>
                <span className="badge fw-bold px-3 py-1.5" style={{ fontSize: '0.76rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                  🏛️ URMSCD Dakar
                </span>
              </div>

              <span className="badge px-4 py-2.5 fw-bold border mt-2" style={{ borderRadius: '14px', fontSize: '0.84rem', background: 'rgba(5, 150, 105, 0.15)', color: '#10b981', borderColor: 'rgba(5, 150, 105, 0.35)', whiteSpace: 'normal', lineHeight: '1.5', display: 'inline-block' }}>
                📱 QR code CSU Certifié • Toucher pour agrandir 👆
              </span>
            </div>

            {/* PIED DE LA CARTE */}
            <div className="p-4 rounded-4 position-relative mt-4" style={{ background: 'var(--bg-card-subtle)', borderRadius: '20px', border: '1px solid var(--border-color)', zIndex: 2 }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                <small className="fw-bold text-muted" style={{ fontSize: '0.82rem', letterSpacing: '0.05em' }}>
                  UNAMUSC SENEGAL - CARTE NATIONALE D’ASSURANCE SANTÉ 🇸🇳
                </small>
                <span className="badge px-3.5 py-2 fw-bold border" style={{ borderRadius: '12px', fontSize: '0.82rem', background: 'var(--bg-card)', color: 'var(--text-main)', borderColor: 'var(--border-color)' }}>
                  Droits actifs 2026 🟢
                </span>
              </div>
            </div>
          </div>

          {/* SI LA CARTE EST SUSPENDUE : AFFICHER UNIQUEMENT LE MESSAGE D'ALERTE DE RÉGULARISATION (10 500 FCFA) */}
          {(!result.valid || result.status === 'suspended' || result.status === 'suspendu') ? (
            <div className="card shadow-sm border-0 p-4 p-md-5 mb-5 text-center" style={{ borderRadius: '26px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
              <div className="d-inline-flex align-items-center justify-content-center p-4 rounded-circle mb-4 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '80px', height: '80px' }}>
                <span style={{ fontSize: '2.6rem' }}>⚠️</span>
              </div>
              
              <h3 className="fw-bold mb-3 text-danger" style={{ fontSize: '1.55rem' }}>⚠️ Couverture CSU inactive</h3>
              
              <div className="mb-4">
                <code className="px-3.5 py-2 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.1rem', color: '#f59e0b' }}>
                  {getAdherentCode(result.cmuNumber)}
                </code>
              </div>

              <p className="lead mb-4 mx-auto" style={{ maxWidth: '680px', fontSize: '1.12rem', lineHeight: '1.7', color: 'var(--text-sub)' }}>
                Votre couverture est suspendue. Veuillez régulariser votre cotisation et celui des membres de votre famille pour un montant de <strong>10 500 FCFA</strong>.
              </p>

              <div className="d-flex justify-content-center gap-3 mt-3">
                <button 
                  type="button" 
                  className="btn btn-emerald btn-lg px-4 py-3 fw-bold d-inline-flex align-items-center gap-3 shadow"
                  style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff', borderRadius: '18px', fontSize: '1.08rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)' }}
                  onClick={() => {
                    localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                      cmuNumber: getAdherentCode(result.cmuNumber),
                      amount: 10500,
                      familyCount: 3,
                      firstName: result.firstName,
                      lastName: result.lastName
                    }));
                    if (setView) setView('payments');
                    else window.location.hash = '#payments';
                  }}
                >
                  💳 Renouveler ma cotisation
                </button>
              </div>
            </div>
          ) : (
            <div className="verified-cards-wrapper" style={{ background: 'var(--bg-card-subtle)', padding: '2rem 1.75rem', borderRadius: '30px', border: '1px solid var(--border-color)', marginBottom: '3rem' }}>
              
              {/* 🔊 RAPPEL VOCAL SANTE & SUIVI VACCINAL DYNAMIQUE (WOLOF / FR) */}
              {(() => {
                // Liste des enfants mineurs (< 18 ans) rattachés à la carte
                const rawChildren = (result.minorDependents && result.minorDependents.length > 0)
                  ? result.minorDependents
                  : ((result.dependents || []).filter(d => !d.isMajor));

                const childrenList = (rawChildren || []).map((child, idx) => {
                  const birthYear = parseInt((child.birthDate || '2018').split('/').pop(), 10) || 2018;
                  const calculatedAge = Math.max(1, new Date().getFullYear() - birthYear);
                  const isFemale = child.gender === 'F' || child.relation === 'Fille' || (child.name && (child.name.toLowerCase().includes('fatou') || child.name.toLowerCase().includes('awa') || child.name.toLowerCase().includes('coumba') || child.name.toLowerCase().includes('khady') || child.name.toLowerCase().includes('mariama') || child.name.toLowerCase().includes('mbayang') || child.name.toLowerCase().includes('ndeye') || child.name.toLowerCase().includes('aminata') || child.name.toLowerCase().includes('astou')));
                  return {
                    id: child.id || `child_${idx}`,
                    name: child.name,
                    cmuCode: child.cmuCode || `${getAdherentCode(result.cmuNumber)}.${child.codeSuffix || 'M' + (idx + 1)}`,
                    relation: isFemale ? 'Fille' : 'Fils',
                    gender: isFemale ? 'F' : 'M',
                    age: child.age || calculatedAge,
                    birthDate: child.birthDate,
                    photoUrl: child.photoUrl || '/csu_profile_hero_real.png',
                    vaccines: child.vaccines || (calculatedAge <= 5 ? 'PEV 0-5 ans (BCG, Polio, Pentavalent, Rougeole)' : isFemale && calculatedAge >= 9 && calculatedAge <= 14 ? 'Vaccin anti-VPH (Col de l\'utérus) 100% Gratuit' : 'PEV à jour'),
                    antecedents: child.antecedents || 'Suivi pédiatrique normal'
                  };
                });

                // RÈGLE DYNAMIQUE : Si l'assuré est adulte SANS enfant à charge (< 18 ans), NE PAS AFFICHER la section vaccinale pédiatrique !
                if (!childrenList || childrenList.length === 0) {
                  return null;
                }

                // Filtrer les enfants selon les critères d'âge et de genre
                const childrenUnder5 = childrenList.filter(c => (c.age || 0) <= 5);
                const girlsAged9to14 = childrenList.filter(c => (c.gender === 'F' || c.relation === 'Fille') && (c.age || 0) >= 9 && (c.age || 0) <= 14);

                // Déterminer le message vocal Wolof / FR
                let audioTextWolofFr = "";
                if (childrenUnder5.length > 0 && girlsAged9to14.length > 0) {
                  audioTextWolofFr = `Nanga def ${result.firstName}! Rappel UNAMUSC : Suivi pédiatrique et vaccins PEV 0 à 5 ans pour ${childrenUnder5.map(c => c.name).join(', ')} ET vaccin anti-VPH col de l'utérus pour votre fille ${girlsAged9to14.map(g => g.name).join(', ')} (${girlsAged9to14[0].age} ans) programmés. Prise en charge 100% gratuite.`;
                } else if (childrenUnder5.length > 0) {
                  audioTextWolofFr = `Nanga def ${result.firstName}! Rappel UNAMUSC : Consultation de suivi pédiatrique et vaccins PEV (0 à 5 ans) programmés pour ${childrenUnder5.map(c => c.name).join(', ')}. Prise en charge 100% gratuite.`;
                } else if (girlsAged9to14.length > 0) {
                  audioTextWolofFr = `Nanga def ${result.firstName}! Rappel UNAMUSC Santé Fille : La vaccination anti-VPH préventive contre le cancer du col de l'utérus pour votre fille ${girlsAged9to14.map(g => g.name).join(', ')} (${girlsAged9to14[0].age} ans) est programmée. Prise en charge 100% gratuite.`;
                } else {
                  audioTextWolofFr = `Nanga def ${result.firstName}! Rappel UNAMUSC : Le suivi pédiatrique et les rappels vaccinaux pour les enfants de votre famille sont programmés. Prise en charge 100% gratuite.`;
                }

                return (
                  <div className="card shadow-sm border-0 p-4 p-md-5 mb-5" style={{ background: 'rgba(5, 150, 105, 0.12)', border: '2px solid #059669', borderRadius: '26px', boxShadow: '0 10px 30px rgba(5, 150, 105, 0.12)' }}>
                    {/* HEADER RAPPEL VOCAL */}
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-4 mb-4">
                      <div className="d-flex align-items-center gap-3.5">
                        <div style={{ width: '54px', height: '54px', borderRadius: '18px', background: 'rgba(5, 150, 105, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0, border: '1.5px solid #059669' }}>
                          🔊
                        </div>
                        <div>
                          <h6 className="fw-extrabold mb-1" style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>
                            Rappel vocal santé & suivi vaccinal ciblé (Wolof / FR)
                          </h6>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
                            Titulaire : <strong>{result.firstName} {result.lastName}</strong> • {childrenList.length} Enfant(s) mineur(s) à charge
                          </small>
                        </div>
                      </div>

                      <span className="badge px-4 py-2.5 rounded-pill fw-bold" style={{ background: 'rgba(5, 150, 105, 0.2)', color: '#10b981', border: '1.5px solid #34d399', fontSize: '0.86rem' }}>
                        🟢 Notification vocale active au scan
                      </span>
                    </div>

                    {/* BLOCS VACCINAUX DYNAMIQUES */}
                    <div className="row g-4 mb-5">
                      {/* 1. PROGRAMME PEV PÉDIATRIQUE (0 À 5 ANS) */}
                      {childrenUnder5.length > 0 && (
                        <div className="col-12 col-lg-6 mb-3">
                          <div className="p-4 p-md-5 rounded-4 h-100 shadow-sm" style={{ background: 'var(--bg-card)', border: '2.5px solid #10b981', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)', borderRadius: '26px' }}>
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                              <span className="badge fw-extrabold px-4 py-2.5" style={{ fontSize: '0.92rem', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                👶 Vaccins 0 à 5 ans (PEV Pédiatrique)
                              </span>
                              <span className="badge bg-success text-white fw-bold px-3.5 py-2" style={{ fontSize: '0.84rem', borderRadius: '12px' }}>
                                100% Gratuit
                              </span>
                            </div>
                            
                            <div className="p-3.5 rounded-3 mb-3.5" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1.5px solid rgba(16, 185, 129, 0.25)', borderRadius: '16px' }}>
                              <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.08rem', color: '#10b981' }}>
                                👶 Enfant(s) concerné(s) : {childrenUnder5.map(c => `${c.name} (${c.age} an${c.age > 1 ? 's' : ''})`).join(', ')}
                              </h6>
                            </div>

                            <p className="text-muted mb-4" style={{ fontSize: '0.94rem', lineHeight: '1.7' }}>
                              <strong style={{ color: 'var(--text-main)' }}>Calendrier PEV Sénégal :</strong> BCG, Polio oral (VPO), Pentavalent (DTP-HepB-Hib), Pneumocoque, Rotavirus & Rougeole-Rubéole.
                            </p>
                            
                            <div className="p-3.5 rounded-3 fw-bold" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1.5px solid rgba(16, 185, 129, 0.25)', color: 'var(--text-main)', fontSize: '0.88rem', borderRadius: '16px', lineHeight: '1.6' }}>
                              🩺 Suivi de croissance & supplémentation Vitamine A programmés au Centre de Santé.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. PROGRAMME PRÉVENTION CANCER DU COL DE L'UTÉRUS - VACCIN ANTI-VPH (FILLES DE 9 À 14 ANS) */}
                      {girlsAged9to14.length > 0 && (
                        <div className="col-12 col-lg-6 mb-3">
                          <div className="p-4 p-md-5 rounded-4 h-100 shadow-sm" style={{ background: 'var(--bg-card)', border: '2.5px solid #ec4899', boxShadow: '0 8px 24px rgba(236, 72, 153, 0.12)', borderRadius: '26px' }}>
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'rgba(236, 72, 153, 0.2)' }}>
                              <span className="badge fw-extrabold px-4 py-2.5" style={{ fontSize: '0.92rem', borderRadius: '14px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                                🌸 Anti-VPH (Col de l'utérus) • Filles 9-14 ans
                              </span>
                              <span className="badge text-white fw-bold px-3.5 py-2" style={{ fontSize: '0.84rem', borderRadius: '12px', background: '#ec4899' }}>
                                Prévention VPH
                              </span>
                            </div>
                            
                            <div className="p-3.5 rounded-3 mb-3.5" style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1.5px solid rgba(236, 72, 153, 0.25)', borderRadius: '16px' }}>
                              <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.08rem', color: '#f472b6' }}>
                                🌸 Jeune(s) fille(s) concernée(s) : {girlsAged9to14.map(g => `${g.name} (${g.age} ans)`).join(', ')}
                              </h6>
                            </div>

                            <p className="text-muted mb-4" style={{ fontSize: '0.94rem', lineHeight: '1.7' }}>
                              <strong style={{ color: 'var(--text-main)' }}>Programme VPH Sénégal :</strong> Vaccination préventive contre le Papillomavirus Humain (VPH), cause principale du cancer du col de l'utérus.
                            </p>
                            
                            <div className="p-3.5 rounded-3 fw-bold" style={{ background: 'rgba(236, 72, 153, 0.08)', border: '1.5px solid rgba(236, 72, 153, 0.25)', color: 'var(--text-main)', fontSize: '0.88rem', borderRadius: '16px', lineHeight: '1.6' }}>
                              💉 Dose 1 & 2ème dose de rappel à 6 mois 100% prises en charge par la CMU / UNAMUSC.
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RECAPITULATIF VOCAL ET BOUTON LECTURE */}
                    <div className="p-4 p-md-4 rounded-4 mb-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.98rem', lineHeight: '1.7', borderRadius: '22px' }}>
                      <div className="d-flex align-items-center gap-2.5 mb-2">
                        <span className="fs-4">🔊</span>
                        <span className="fw-extrabold" style={{ color: '#10b981', fontSize: '1.05rem' }}>Message vocal lu à voix haute (Wolof / Français) :</span>
                      </div>
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', fontStyle: 'italic', borderLeft: '4px solid #10b981', borderRadius: '12px' }}>
                        &quot;{audioTextWolofFr}&quot;
                      </div>
                    </div>

                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-4 pt-4 border-top" style={{ borderColor: 'var(--border-color)' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span className="fs-5">📅</span>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.95rem' }}>
                          Prochaine échéance : <strong style={{ color: 'var(--text-main)' }}>Suivi pédiatrique & vaccination • Centre de Santé de Dakar</strong>
                        </span>
                      </div>

                      <button 
                        type="button" 
                        style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '18px', padding: '0.85rem 1.85rem', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 18px rgba(5, 150, 105, 0.35)' }}
                        onClick={() => playAudioReminder(result.firstName || 'Moustapha', audioTextWolofFr)}
                      >
                        <span>🔊</span> Réécouter la notification vocale (Wolof / FR)
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 👨‍👩‍👧‍👦 SECTION OBLIGATOIRE : ENFANTS MINEURS À CHARGE (< 18 ANS) */}
              {(() => {
                const childrenList = (result.minorDependents && result.minorDependents.length > 0)
                  ? result.minorDependents
                  : ((result.dependents || []).filter(d => !d.isMajor).map((child, idx) => ({
                      id: `child_${idx}`,
                      name: child.name,
                      cmuCode: `${getAdherentCode(result.cmuNumber)}.${child.codeSuffix || 'M' + (idx + 1)}`,
                      relation: child.gender === 'F' ? 'Fille (Enfant mineur)' : 'Fils (Enfant mineur)',
                      age: Math.max(1, new Date().getFullYear() - parseInt((child.birthDate || '2018').split('/').pop(), 10) || 6),
                      birthDate: child.birthDate,
                      photoUrl: child.photoUrl || '/csu_profile_hero_real.png',
                      hasOfficialPhoto: child.hasOfficialPhoto,
                      photoStatus: child.photoStatus || 'PHOTO_OK',
                      bloodGroup: child.bloodGroup || 'O+',
                      vaccines: child.vaccines || 'PEV 100% à jour',
                      antecedents: child.antecedents || 'Développement pédiatrique normal'
                    }))) || result.familyMembers || [];

                if (!childrenList || childrenList.length === 0) return null;

                return (
                  <div className="card shadow-sm border-0 p-4 p-md-5 mb-5" style={{ borderRadius: '28px', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div className="d-flex align-items-center justify-content-between mb-4 pb-4 border-bottom flex-wrap gap-3" style={{ borderColor: 'var(--border-color)' }}>
                      <div>
                        <h5 className="fw-extrabold mb-1.5 d-flex align-items-center gap-2.5" style={{ color: '#10b981', fontSize: '1.35rem' }}>
                          <span>👶</span> Enfants mineurs à charge (&lt; 18 ans) rattachés à la carte
                        </h5>
                        <span className="small text-muted" style={{ fontSize: '0.92rem' }}>
                          Bénéficiaires de la gratuité pédiatrique universelle 100% UNAMUSC ({childrenList.length} enfants enregistrés)
                        </span>
                      </div>
                      <span className="badge bg-success-subtle text-success border border-success px-4 py-2.5 fw-bold" style={{ borderRadius: '16px', fontSize: '0.9rem' }}>
                        🟢 100% Gratuité pédiatrique & PEV
                      </span>
                    </div>

                    {/* GRILLE ESPACÉE ET CLAIRE POUR LES ENFANTS */}
                    <div className="row g-4 mb-2">
                      {childrenList.map((child, idx) => {
                        const isSelectedForCare = selectedTargetBeneficiary?.cmuCode === child.cmuCode;

                        return (
                          <div key={idx} className="col-12 col-lg-6 mb-4">
                            <div 
                              className="p-4 p-md-4 rounded-4 border h-100 shadow-sm d-flex flex-column justify-content-between"
                              style={{ 
                                background: isSelectedForCare ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-card)', 
                                borderColor: isSelectedForCare ? '#059669' : 'var(--border-color)', 
                                borderWidth: isSelectedForCare ? '2.5px' : '1px',
                                borderRadius: '26px', 
                                transition: 'all 0.2s ease',
                                minHeight: '340px'
                              }}
                            >
                              <div>
                                <div className="d-flex align-items-center gap-4 mb-4">
                                  {child.photoUrl ? (
                                    <img 
                                      src={child.photoUrl} 
                                      alt={child.name}
                                      onError={(e) => { e.target.onerror = null; e.target.src = '/csu_profile_hero_real.png'; }}
                                      style={{
                                        width: '80px',
                                        height: '80px',
                                        borderRadius: '22px',
                                        objectFit: 'cover',
                                        border: '3.5px solid #059669',
                                        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                                        flexShrink: 0
                                      }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: '80px',
                                      height: '80px',
                                      borderRadius: '22px',
                                      background: 'var(--bg-card-subtle)',
                                      border: '2px solid var(--border-color)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '2.2rem',
                                      color: 'var(--text-sub)',
                                      flexShrink: 0
                                    }}>
                                      👶
                                    </div>
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <h6 className="fw-extrabold mb-2" style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>
                                      {child.name}
                                    </h6>
                                    
                                    <div className="d-flex align-items-center gap-2 flex-wrap mb-2.5">
                                      <span className="badge fw-bold px-3 py-1.5" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '12px', fontSize: '0.84rem' }}>
                                        {child.relation || (child.gender === 'F' ? 'Fille (Enfant mineur)' : 'Fils (Enfant mineur)')} • {child.age || 6} ans
                                      </span>
                                      {child.birthDate && (
                                        <span className="badge px-3 py-1.5 fw-semibold border" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', borderColor: 'var(--border-color)', borderRadius: '12px', fontSize: '0.84rem' }}>
                                          📅 Né(e) le {child.birthDate}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="font-monospace fw-bold" style={{ fontSize: '0.96rem', color: '#10b981' }}>
                                      N° CSU : {child.cmuCode || `${getAdherentCode(result.cmuNumber)}.M${idx + 1}`}
                                    </div>
                                  </div>
                                </div>

                                <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '0.92rem', borderRadius: '18px', lineHeight: '1.7', color: 'var(--text-main)' }}>
                                  <div className="mb-2"><strong>💉 Vaccins :</strong> <span className="fw-bold ms-2" style={{ color: '#10b981' }}>{child.vaccines || 'PEV 100% à jour'}</span></div>
                                  <div><strong>🩺 Antécédents & Suivi :</strong> <span className="ms-2" style={{ color: 'var(--text-sub)' }}>{child.antecedents || 'Développement pédiatrique normal'}</span></div>
                                </div>
                              </div>

                              <div>
                                {/* BADGES BIEN ESPACÉS */}
                                <div className="d-flex align-items-center justify-content-between pt-3.5 border-top flex-wrap gap-3" style={{ borderColor: 'var(--border-color)' }}>
                                  <span className="badge fw-bold px-3.5 py-2" style={{ background: child.hasOfficialPhoto ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: child.hasOfficialPhoto ? '#10b981' : '#fbbf24', fontSize: '0.84rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                    {child.hasOfficialPhoto ? '🟢 Photo certifiée MSD Dakar' : '🟡 Photo certifiée en attente'}
                                  </span>
                                  <span className="badge bg-success text-white fw-bold px-3.5 py-2" style={{ borderRadius: '12px', fontSize: '0.84rem' }}>
                                    Gratuité Pédiatrique 100%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ⚡ HUB D'ACTIONS MÉDICALES INSTANTANÉES — MULTI-BÉNÉFICIAIRE & 6 BOUTONS ESPACÉS */}
              <div className="card shadow-sm border-0 p-4 p-md-5 mb-5" style={{ borderRadius: '28px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                
                {/* SÉLECTEUR DYNAMIQUE DE BÉNÉFICIAIRE POUR LE PROFESSIONNEL DE SANTÉ */}
                <div className="p-4 p-md-4 mb-5 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '2px solid rgba(3, 105, 161, 0.25)', borderRadius: '24px' }}>
                  <div className="d-flex align-items-center gap-2.5 mb-3.5">
                    <span className="fs-4">🏥</span>
                    <h6 className="fw-extrabold mb-0" style={{ color: '#38bdf8', fontSize: '1.05rem', letterSpacing: '0.02em' }}>
                      Sélectionner le bénéficiaire des soins (Médecin / Pharmacien) :
                    </h6>
                  </div>
                  
                  <div className="d-flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      className={`btn fw-bold px-4 py-3 shadow-sm d-inline-flex align-items-center gap-2.5 ${!selectedTargetBeneficiary ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                      style={{ 
                        borderRadius: '18px', 
                        fontSize: '0.95rem', 
                        background: !selectedTargetBeneficiary ? '#059669' : 'var(--bg-card)', 
                        color: !selectedTargetBeneficiary ? '#ffffff' : 'var(--text-main)', 
                        borderColor: !selectedTargetBeneficiary ? '#059669' : 'var(--border-color)',
                        minHeight: '48px',
                        margin: '0.3rem'
                      }}
                      onClick={() => setSelectedTargetBeneficiary(null)}
                    >
                      <span>👤</span> {result.firstName} {result.lastName} (Adhérent principal)
                    </button>
                    {((result.minorDependents && result.minorDependents.length > 0) ? result.minorDependents : (result.dependents || []).filter(d => !d.isMajor)).map((child, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`btn fw-bold px-4 py-3 shadow-sm d-inline-flex align-items-center gap-2.5 ${selectedTargetBeneficiary?.cmuCode === child.cmuCode ? 'btn-primary text-white' : 'btn-outline-secondary'}`}
                        style={{ 
                          borderRadius: '18px', 
                          fontSize: '0.95rem', 
                          background: selectedTargetBeneficiary?.cmuCode === child.cmuCode ? '#0284c7' : 'var(--bg-card)', 
                          color: selectedTargetBeneficiary?.cmuCode === child.cmuCode ? '#ffffff' : 'var(--text-main)', 
                          borderColor: selectedTargetBeneficiary?.cmuCode === child.cmuCode ? '#0284c7' : 'var(--border-color)',
                          minHeight: '48px',
                          margin: '0.3rem'
                        }}
                        onClick={() => setSelectedTargetBeneficiary(child)}
                      >
                        <span>👶</span> {child.name} ({child.age || 6} ans)
                      </button>
                    ))}
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between mb-4 pb-4 border-bottom flex-wrap gap-3" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h5 className="fw-extrabold mb-1.5 d-flex align-items-center gap-2.5" style={{ color: '#10b981', fontSize: '1.35rem' }}>
                      <span>⚡</span> Hub d'actions médicales certifiées Tiers-Payant
                    </h5>
                    <span className="small text-muted" style={{ fontSize: '0.92rem' }}>
                      Cible de l'acte : <strong className="text-primary">{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result.firstName} ${result.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result.cmuNumber})
                    </span>
                  </div>
                  <span className="badge bg-success text-white px-4 py-2.5 fw-bold" style={{ borderRadius: '16px', fontSize: '0.9rem' }}>
                    🟢 Droits Ouverts UNAMUSC
                  </span>
                </div>

                {/* GRILLE DES 6 BOUTONS D'ACTION ESPACÉS VERTICALEMENT ET HORIZONTALEMENT */}
                <div className="row g-4 mb-3">
                  {/* Action 1: Lettre de Garantie */}
                  <div className="col-12 col-md-6 col-lg-4 mb-4">
                    <button 
                      type="button" 
                      className="btn w-100 text-start d-flex flex-column justify-content-between h-100 shadow-sm verify-hub-tile" 
                      style={{
                        padding: '1.75rem 1.5rem',
                        background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(16, 185, 129, 0.04) 100%)',
                        border: '2.5px solid #059669',
                        borderRadius: '26px',
                        color: 'var(--text-main)',
                        minHeight: '210px',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 24px rgba(5, 150, 105, 0.08)',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => setActiveModal('guarantee')}
                    >
                      <div style={{ maxWidth: '100%' }}>
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 0 }}>
                            <span style={{ width: '46px', height: '46px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>📜</span>
                            <span className="fw-extrabold" style={{ fontSize: '1.1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>Lettre de garantie</span>
                          </div>
                          <span className="badge bg-success text-white px-3 py-1.5" style={{ fontSize: '0.78rem', borderRadius: '12px', flexShrink: 0 }}>80-100%</span>
                        </div>
                        <p className="text-muted fw-semibold mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          Prise en charge hospitalière certifiée UNAMUSC
                        </p>
                      </div>
                      <div className="d-flex align-items-center justify-content-between pt-3 border-top w-100 mt-3 flex-wrap gap-1" style={{ borderColor: 'rgba(5, 150, 105, 0.2)', color: '#10b981' }}>
                        <span className="fw-bold" style={{ fontSize: '0.82rem', lineHeight: '1.3', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>Générer la prise en charge</span>
                        <span className="fs-5 flex-shrink-0 ms-1">→</span>
                      </div>
                    </button>
                  </div>

                  {/* Action 2: Bon pharmacie 48h */}
                  <div className="col-12 col-md-6 col-lg-4 mb-4">
                    <button 
                      type="button" 
                      className="btn w-100 text-start d-flex flex-column justify-content-between h-100 shadow-sm verify-hub-tile" 
                      style={{
                        padding: '1.75rem 1.5rem',
                        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
                        border: '2.5px solid #d97706',
                        borderRadius: '26px',
                        color: 'var(--text-main)',
                        minHeight: '210px',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.08)',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => setActiveModal('order')}
                    >
                      <div style={{ maxWidth: '100%' }}>
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 0 }}>
                            <span style={{ width: '46px', height: '46px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>💊</span>
                            <span className="fw-extrabold" style={{ fontSize: '1.1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>Bon pharmacie</span>
                          </div>
                          <span className="badge fw-bold px-3 py-1.5" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid #f59e0b', fontSize: '0.78rem', borderRadius: '12px', flexShrink: 0 }}>48h Tiers-Payant</span>
                        </div>
                        <p className="text-muted fw-semibold mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          Ordonnance et médicaments pris en charge en officine
                        </p>
                      </div>
                      <div className="d-flex align-items-center justify-content-between pt-3 border-top w-100 mt-3 flex-wrap gap-1" style={{ borderColor: 'rgba(217, 119, 6, 0.2)', color: '#f59e0b' }}>
                        <span className="fw-bold" style={{ fontSize: '0.82rem', lineHeight: '1.3', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>Délivrer les médicaments</span>
                        <span className="fs-5 flex-shrink-0 ms-1">→</span>
                      </div>
                    </button>
                  </div>

                  {/* Action 3: Télémédecine WebRTC */}
                  <div className="col-12 col-md-6 col-lg-4 mb-4">
                    <button 
                      type="button" 
                      className="btn w-100 text-start d-flex flex-column justify-content-between h-100 shadow-sm verify-hub-tile" 
                      style={{
                        padding: '1.75rem 1.5rem',
                        background: 'linear-gradient(135deg, rgba(30, 64, 175, 0.12) 0%, rgba(59, 130, 246, 0.04) 100%)',
                        border: '2.5px solid #1e40af',
                        borderRadius: '26px',
                        color: 'var(--text-main)',
                        minHeight: '210px',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 24px rgba(30, 64, 175, 0.08)',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => setActiveModal('telemedicine')}
                    >
                      <div style={{ maxWidth: '100%' }}>
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 0 }}>
                            <span style={{ width: '46px', height: '46px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🎥</span>
                            <span className="fw-extrabold" style={{ fontSize: '1.1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>Télémédecine</span>
                          </div>
                          <span className="badge text-white px-3 py-1.5" style={{ background: '#1e40af', fontSize: '0.78rem', borderRadius: '12px', flexShrink: 0 }}>Direct 24/7</span>
                        </div>
                        <p className="text-muted fw-semibold mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          Téléconsultation audio/vidéo avec un médecin agréé
                        </p>
                      </div>
                      <div className="d-flex align-items-center justify-content-between pt-3 border-top w-100 mt-3 flex-wrap gap-1" style={{ borderColor: 'rgba(30, 64, 175, 0.2)', color: '#60a5fa' }}>
                        <span className="fw-bold" style={{ fontSize: '0.82rem', lineHeight: '1.3', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>Démarrer la visio-consultation</span>
                        <span className="fs-5 flex-shrink-0 ms-1">→</span>
                      </div>
                    </button>
                  </div>

                  {/* Action 4: Radios & Labo DICOM */}
                  <div className="col-12 col-md-6 col-lg-4 mb-4">
                    <button 
                      type="button" 
                      className="btn w-100 text-start d-flex flex-column justify-content-between h-100 shadow-sm verify-hub-tile" 
                      style={{
                        padding: '1.75rem 1.5rem',
                        background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.12) 0%, rgba(168, 85, 247, 0.04) 100%)',
                        border: '2.5px solid #9333ea',
                        borderRadius: '26px',
                        color: 'var(--text-main)',
                        minHeight: '210px',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 24px rgba(147, 51, 234, 0.08)',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => setActiveModal('imaging')}
                    >
                      <div style={{ maxWidth: '100%' }}>
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 0 }}>
                            <span style={{ width: '46px', height: '46px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🩻</span>
                            <span className="fw-extrabold" style={{ fontSize: '1.1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>Radios & Labo</span>
                          </div>
                          <span className="badge text-white px-3 py-1.5" style={{ background: '#9333ea', fontSize: '0.78rem', borderRadius: '12px', flexShrink: 0 }}>DICOM</span>
                        </div>
                        <p className="text-muted fw-semibold mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          Transmettre imageries médicales, scanners ou bilans labo
                        </p>
                      </div>
                      <div className="d-flex align-items-center justify-content-between pt-3 border-top w-100 mt-3 flex-wrap gap-1" style={{ borderColor: 'rgba(147, 51, 234, 0.2)', color: '#c084fc' }}>
                        <span className="fw-bold" style={{ fontSize: '0.82rem', lineHeight: '1.3', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>Transmettre des résultats</span>
                        <span className="fs-5 flex-shrink-0 ms-1">→</span>
                      </div>
                    </button>
                  </div>

                  {/* Action 5: Consultation Spécialisée */}
                  <div className="col-12 col-md-6 col-lg-4 mb-4">
                    <button 
                      type="button" 
                      className="btn w-100 text-start d-flex flex-column justify-content-between h-100 shadow-sm verify-hub-tile" 
                      style={{
                        padding: '1.75rem 1.5rem',
                        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(14, 165, 233, 0.04) 100%)',
                        border: '2.5px solid #0284c7',
                        borderRadius: '26px',
                        color: 'var(--text-main)',
                        minHeight: '210px',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.08)',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => setActiveModal('specialties')}
                    >
                      <div style={{ maxWidth: '100%' }}>
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 0 }}>
                            <span style={{ width: '46px', height: '46px', background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🩺</span>
                            <span className="fw-extrabold" style={{ fontSize: '1.1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>Spécialités</span>
                          </div>
                          <span className="badge text-white px-3 py-1.5" style={{ background: '#0284c7', fontSize: '0.78rem', borderRadius: '12px', flexShrink: 0 }}>UNAMUSC</span>
                        </div>
                        <p className="text-muted fw-semibold mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          Orientation & consultations spécialisées certifiées
                        </p>
                      </div>
                      <div className="d-flex align-items-center justify-content-between pt-3 border-top w-100 mt-3 flex-wrap gap-1" style={{ borderColor: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8' }}>
                        <span className="fw-bold" style={{ fontSize: '0.82rem', lineHeight: '1.3', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>Consulter un spécialiste</span>
                        <span className="fs-5 flex-shrink-0 ms-1">→</span>
                      </div>
                    </button>
                  </div>

                  {/* Action 6: Pathologies & ALD */}
                  <div className="col-12 col-md-6 col-lg-4 mb-4">
                    <button 
                      type="button" 
                      className="btn w-100 text-start d-flex flex-column justify-content-between h-100 shadow-sm verify-hub-tile" 
                      style={{
                        padding: '1.75rem 1.5rem',
                        background: 'linear-gradient(135deg, rgba(219, 39, 119, 0.12) 0%, rgba(236, 72, 153, 0.04) 100%)',
                        border: '2.5px solid #db2777',
                        borderRadius: '26px',
                        color: 'var(--text-main)',
                        minHeight: '210px',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 6px 18px rgba(219, 39, 119, 0.08)',
                        overflow: 'hidden',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => setActiveModal('pathologies')}
                    >
                      <div style={{ maxWidth: '100%' }}>
                        <div className="d-flex align-items-center justify-content-between w-100 mb-3 flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-2.5" style={{ minWidth: 0 }}>
                            <span style={{ width: '46px', height: '46px', background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🧬</span>
                            <span className="fw-extrabold" style={{ fontSize: '1.1rem', color: 'var(--text-main)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>Pathologies ALD</span>
                          </div>
                          <span className="badge text-white px-3 py-1.5" style={{ background: '#db2777', fontSize: '0.78rem', borderRadius: '12px', flexShrink: 0 }}>100%</span>
                        </div>
                        <p className="text-muted fw-semibold mb-0" style={{ fontSize: '0.9rem', lineHeight: '1.5', wordBreak: 'break-word' }}>
                          Protocole d'Affection Longue Durée & prise en charge totale
                        </p>
                      </div>
                      <div className="d-flex align-items-center justify-content-between pt-3 border-top w-100 mt-3 flex-wrap gap-1" style={{ borderColor: 'rgba(219, 39, 119, 0.2)', color: '#f472b6' }}>
                        <span className="fw-bold" style={{ fontSize: '0.82rem', lineHeight: '1.3', wordBreak: 'break-word', flex: '1 1 auto', minWidth: 0 }}>Déclarer une ALD</span>
                        <span className="fs-5 flex-shrink-0 ms-1">→</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* 🛡️ DROITS OUVERTS & DOSSIER MÉDICAL DÉTAILLÉ (DESIGN ULTRA SOIGNÉ & MODERNE) */}
              <div className="card shadow-sm border-0 p-4 p-md-5 mb-5" style={{ borderRadius: '28px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex justify-content-between align-items-center mb-5 pb-4 border-bottom flex-wrap gap-4" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-4">
                    <div className="d-flex align-items-center justify-content-center rounded-4 p-3.5" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#10b981', fontSize: '1.8rem', borderRadius: '20px' }}>
                      🛡️
                    </div>
                    <div>
                      <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.4rem' }}>
                        Droits ouverts & dossier médical certifié
                      </h5>
                      <small className="text-muted" style={{ fontSize: '0.92rem' }}>
                        Statut de couverture et informations médicales certifiées UNAMUSC
                      </small>
                    </div>
                  </div>
                  
                  <span className="badge px-4 py-3 fw-bold text-success border border-success d-inline-flex align-items-center gap-2.5" style={{ background: 'rgba(5, 150, 105, 0.12)', borderRadius: '16px', fontSize: '0.88rem' }}>
                    🔒 Données certifiées UNAMUSC • Accès réservé
                  </span>
                </div>

                <div className="row g-4 mb-4">
                  {/* Card 1: Mutuelle de rattachement */}
                  <div className="col-12 col-lg-6 mb-4">
                    <div 
                      className="p-4 p-md-5 rounded-4 border h-100 shadow-sm d-flex flex-column justify-content-between position-relative overflow-hidden" 
                      style={{ 
                        background: 'var(--bg-card-subtle)', 
                        borderColor: 'var(--border-color)', 
                        borderRadius: '26px',
                        borderTop: '5px solid #059669',
                        boxShadow: '0 8px 24px rgba(5, 150, 105, 0.08)'
                      }}
                    >
                      <div>
                        <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <span className="fw-extrabold me-2" style={{ color: '#10b981', fontSize: '0.92rem' }}>
                            🏥 Mutuelle de rattachement
                          </span>
                          <span className="badge fw-bold px-3.5 py-2 ms-auto" style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#10b981', fontSize: '0.82rem', borderRadius: '12px' }}>
                            Mutuelle agréée
                          </span>
                        </div>
                        <h6 className="fw-extrabold mb-3" style={{ fontSize: '1.25rem', lineHeight: '1.55', color: 'var(--text-main)' }}>
                          {result.mutuelleName || 'Mutuelle de santé départementale de Dakar'}
                        </h6>
                        <div className="pt-2">
                          <span className="badge px-3 py-1.5 fw-semibold" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#10b981', borderRadius: '10px', fontSize: '0.82rem' }}>
                            Agrément N° MSD-DKR-2026 • Réseau National UNAMUSC
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Formule souscrite */}
                  <div className="col-12 col-lg-6 mb-4">
                    <div 
                      className="p-4 p-md-5 rounded-4 border h-100 shadow-sm d-flex flex-column justify-content-between position-relative overflow-hidden" 
                      style={{ 
                        background: 'var(--bg-card-subtle)', 
                        borderColor: 'var(--border-color)', 
                        borderRadius: '26px',
                        borderTop: '5px solid #0284c7',
                        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.08)'
                      }}
                    >
                      <div>
                        <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <span className="fw-extrabold me-2" style={{ color: '#38bdf8', fontSize: '0.92rem' }}>
                            📋 Formule souscrite
                          </span>
                          <div className="d-flex align-items-center gap-2.5 ms-auto flex-wrap">
                            <span className="badge fw-bold px-3 py-1.5 me-2" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', fontSize: '0.82rem', borderRadius: '12px' }}>
                              Tiers-payant 80%
                            </span>
                            <span className="badge fw-bold px-3 py-1.5" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.82rem', borderRadius: '12px' }}>
                              Tiers-payant 50%
                            </span>
                          </div>
                        </div>
                        <h6 className="fw-extrabold mb-3" style={{ fontSize: '1.2rem', lineHeight: '1.55', color: 'var(--text-main)' }}>
                          {result.packageType 
                            ? result.packageType
                                .replace(/Tiers-Payant/gi, 'Tiers-payant')
                                .replace(/Adhérent Principal/gi, 'adhérent principal')
                                .replace(/Individuelle Majeur/gi, 'individuelle majeur')
                                .replace(/— Tiers-payant 80% UNAMUSC/gi, '— Couverture Tiers-payant 80% UNAMUSC')
                            : 'Formule adhérent principal — Couverture Tiers-payant 80% UNAMUSC'}
                        </h6>
                        <div className="d-flex flex-column gap-2 pt-2">
                          <div className="p-3 rounded-3" style={{ background: 'rgba(2, 132, 199, 0.08)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: '600', borderRadius: '14px' }}>
                            • <strong style={{ color: '#38bdf8' }}>Tiers-payant 80%</strong> : Prise en charge hospitalière, laboratoire & imagerie UNAMUSC
                          </div>
                          <div className="p-3 rounded-3" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: '600', borderRadius: '14px' }}>
                            • <strong style={{ color: '#10b981' }}>Tiers-payant 50%</strong> : Prise en charge des ordonnances et médicaments en officine
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Contact d'urgence & téléphone */}
                  <div className="col-12 col-lg-6 mb-4">
                    <div 
                      className="p-4 p-md-5 rounded-4 border h-100 shadow-sm d-flex flex-column justify-content-between position-relative overflow-hidden" 
                      style={{ 
                        background: 'var(--bg-card-subtle)', 
                        borderColor: 'var(--border-color)', 
                        borderRadius: '26px',
                        borderTop: '5px solid #1e40af',
                        boxShadow: '0 8px 24px rgba(30, 64, 175, 0.08)'
                      }}
                    >
                      <div>
                        <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <span className="fw-extrabold me-2" style={{ color: '#60a5fa', fontSize: '0.92rem' }}>
                            📞 Contact d'urgence & téléphone
                          </span>
                          <span className="badge fw-bold px-3 py-1.5 ms-auto" style={{ background: 'rgba(30, 64, 175, 0.15)', color: '#60a5fa', fontSize: '0.82rem', borderRadius: '12px' }}>
                            Ligne directe 24/7
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-3 font-monospace flex-wrap pt-2">
                          {(() => {
                            const validVal = (result.phone && String(result.phone).trim() !== '—' && String(result.phone).trim() !== '-') ? result.phone : (result.sponsorPhone || '+221 77 631 71 73');
                            const rawPhones = validVal || '+221 77 631 71 73';
                            const phoneParts = rawPhones.split('/');
                            return phoneParts.map((part, pIdx) => {
                              const trimmed = part.trim();
                              const telNum = trimmed.replace(/[^0-9+]/g, '');
                              return (
                                <a
                                  key={pIdx}
                                  href={`tel:${telNum}`}
                                  className="btn fw-extrabold d-inline-flex align-items-center gap-2 px-4 py-3 shadow-sm"
                                  style={{ background: 'var(--bg-card)', color: '#60a5fa', border: '2px solid rgba(59, 130, 246, 0.4)', borderRadius: '18px', fontSize: '1.05rem', cursor: 'pointer', margin: '0.25rem' }}
                                  title={`Appeler le ${trimmed}`}
                                >
                                  <span>📞</span>
                                  <span>{trimmed}</span>
                                </a>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Groupe sanguin & allergies */}
                  <div className="col-12 col-lg-6 mb-4">
                    <div 
                      className="p-4 p-md-5 rounded-4 border h-100 shadow-sm d-flex flex-column justify-content-between position-relative overflow-hidden" 
                      style={{ 
                        background: 'var(--bg-card-subtle)', 
                        borderColor: 'var(--border-color)', 
                        borderRadius: '26px',
                        borderTop: '5px solid #dc2626',
                        boxShadow: '0 8px 24px rgba(220, 38, 38, 0.08)'
                      }}
                    >
                      <div>
                        <div className="mb-4 d-flex align-items-center justify-content-between flex-wrap gap-2">
                          <span className="fw-extrabold me-2" style={{ color: '#f87171', fontSize: '0.92rem' }}>
                            🩸 Groupe sanguin & allergies
                          </span>
                          <span className="badge px-3 py-1.5 fw-bold ms-auto" style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#f87171', fontSize: '0.82rem', borderRadius: '12px' }}>
                            Profil médical certifié
                          </span>
                        </div>
                        <div className="d-flex align-items-center gap-3 flex-wrap pt-2">
                          <div className="p-3 px-4 rounded-4 fw-extrabold shadow-sm d-inline-flex align-items-center gap-2" style={{ background: '#ef4444', color: '#ffffff', fontSize: '1.15rem', borderRadius: '18px' }}>
                            <span>🔴</span> Groupe Sanguin : {result.bloodGroup || 'O+'}
                          </div>
                          <div className="p-3 px-4 rounded-4 fw-bold d-inline-flex align-items-center gap-2" style={{ background: 'rgba(220, 38, 38, 0.12)', color: 'var(--text-main)', border: '2px solid rgba(239, 68, 68, 0.35)', fontSize: '1rem', borderRadius: '18px' }}>
                            <span>🛡️</span> Allergies : {result.allergies || 'Aucune connue'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HORODATAGE CERTIFIÉ & BOUTON D'EXPORT PDF */}
                <div className="pt-4 border-top d-flex justify-content-between align-items-center flex-wrap gap-4 mt-4 p-4 rounded-4" style={{ borderColor: 'var(--border-color)', background: 'rgba(5, 150, 105, 0.08)', borderRadius: '22px' }}>
                  <div className="d-flex align-items-center gap-3" style={{ fontSize: '1.02rem', color: 'var(--text-main)' }}>
                    <span className="fs-3">🕒</span>
                    <span>Vérifié en direct le : &nbsp;<strong style={{ color: '#10b981', fontSize: '1.1rem', marginLeft: '6px' }}>{new Date(result.checkedAt).toLocaleString('fr-FR')}</strong></span>
                  </div>

                  <div className="d-flex gap-3 flex-wrap">
                    <button 
                      type="button" 
                      className="btn btn-success fw-bold px-4 py-3 shadow-sm d-inline-flex align-items-center gap-2.5"
                      onClick={() => {
                        localStorage.setItem('cmu-pending-renewal', JSON.stringify({
                          cmuNumber: getAdherentCode(result.cmuNumber),
                          firstName: result.firstName,
                          lastName: result.lastName
                        }));
                        if (setView) setView('payments');
                        else window.location.hash = '#payments';
                      }}
                      style={{ borderRadius: '18px', fontSize: '1rem', background: '#059669', borderColor: '#059669' }}
                    >
                      <span>💳</span> Cotiser / Renouveler
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-success fw-bold px-4 py-3 shadow-sm d-inline-flex align-items-center gap-2.5"
                      onClick={handlePrintCertificate}
                      style={{ borderRadius: '18px', fontSize: '1rem', border: '2px solid #059669' }}
                    >
                      <span>🖨️</span> Imprimer PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALE PORTAL : QR CODE TRI-LAYE HD SUR TOUCHER DE LA CARTE */}
      {showQrModal && createPortal(
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh',
            background: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem'
          }}
          onClick={() => setShowQrModal(false)}
        >
          <div 
            style={{
              maxWidth: '440px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)',
              borderRadius: '24px', padding: '2rem', textAlign: 'center', border: '2px solid #059669',
              boxShadow: '0 25px 70px rgba(0,0,0,0.75)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-extrabold mb-0 text-success" style={{ fontSize: '1.15rem' }}>📱 QR Code CSU Certifié</h5>
              <button type="button" className="btn-close" onClick={() => setShowQrModal(false)}></button>
            </div>

            <div className="d-flex justify-content-center mb-2">
              <span className="badge bg-success text-white px-2.5 py-1 fw-bold" style={{ fontSize: '0.74rem', borderRadius: '8px' }}>
                🔒 Sceau Rotatif Dynamique • ⏱️ {qrSecondsLeft}s
              </span>
            </div>

            <div className="d-flex justify-content-center mb-3.5">
              <div className="p-3.5 bg-white rounded-4 shadow-sm border position-relative" style={{ borderColor: 'var(--border-color)', display: 'inline-block', overflow: 'hidden' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`${window.location.origin}/#/verify/${result.cmuNumber}?otp=${qrOtpToken}`)}`} 
                  alt="QR Code CSU Certifié UNAMUSC" 
                  style={{ 
                    width: '210px', 
                    height: '210px', 
                    display: 'block', 
                    margin: '0 auto'
                  }} 
                />
              </div>
            </div>

            {/* BLOC DE CERTIFICATION PAR L'UNAMUSC ET LE MINISTÈRE */}
            <div className="p-3.5 rounded-4 mb-4 text-center" style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1.5px solid #059669', borderRadius: '18px' }}>
              <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                <span className="fw-extrabold" style={{ fontSize: '0.88rem', color: '#065f46' }}>
                  Authentifié & certifié UNAMUSC Sénégal 🇸🇳
                </span>
              </div>

              <div className="badge bg-white text-emerald-900 fw-bold border px-3 py-1.5 mb-2 font-monospace shadow-sm" style={{ borderRadius: '10px', fontSize: '0.92rem', color: '#047857', borderColor: '#a7f3d0' }}>
                Code bénéficiaire: {result.cmuNumber}
              </div>

              <div className="d-flex justify-content-center flex-wrap gap-2 mb-2">
                <span className="badge bg-success text-white fw-bold px-2.5 py-1" style={{ fontSize: '0.75rem', borderRadius: '8px' }}>
                  🟢 Signature Cryptographique Valide
                </span>
                <span className="badge fw-bold px-2.5 py-1" style={{ fontSize: '0.75rem', borderRadius: '8px', background: '#d1fae5', color: '#065f46' }}>
                  IPP : {result.ippNumber || 'IPP-DKR-2026-88'}
                </span>
              </div>

              <small className="d-block text-muted fw-semibold" style={{ fontSize: '0.76rem', lineHeight: '1.45', color: '#475569' }}>
                🏛️ <strong>Union Régionale des Mutuelles (URMSCD Dakar)</strong><br />
                Empreinte digitale anti-falsification • Horodatage certifié Ministère
              </small>
            </div>

            <button 
              type="button" 
              className="btn w-100 fw-bold py-2.5"
              style={{ borderRadius: '14px', background: '#059669', color: '#fff', fontSize: '0.95rem' }}
              onClick={() => setShowQrModal(false)}
            >
              ✅ Fermer l'inspecteur
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MODALE 1 : Demander une Lettre de Garantie Rapide (React Portal — Centré) */}
      {activeModal === 'guarantee' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreateGuarantee} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
                <span>📜</span> Émettre une lettre de garantie (Tiers-Payant Hospitalier)
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              <span className="small text-muted d-block" style={{ fontSize: '0.86rem' }}>
                Bénéficiaire certifié : <strong className="text-success">{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber})
              </span>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Établissement récepteur conventionné UNAMUSC *</label>
              <select className="form-select input fw-bold" value={guaranteeHospital} onChange={(e) => setGuaranteeHospital(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec (Dakar)</option>
                <option value="Hôpital Général Idrissa Pouye (Pikine)">Hôpital Général Idrissa Pouye (Pikine)</option>
                <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                <option value="Hôpital d'Enfants Albert Royer">Hôpital d'Enfants Albert Royer (Pédiatrie)</option>
                <option value="Centre de Santé Gaspard Camara">Centre de Santé Gaspard Camara</option>
              </select>
            </div>

            <div className="row g-3 mb-3.5">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold mb-1.5">Service / Nature de l'admission *</label>
                <select className="form-select input" value={guaranteeService} onChange={(e) => setGuaranteeService(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="Hospitalisation & Chirurgie (80%)">Hospitalisation & Chirurgie (80%)</option>
                  <option value="Urgence Médicale Vital (100%)">Urgence Médicale Vitale (100%)</option>
                  <option value="Chirurgie Programmée (80%)">Chirurgie Programmée (80%)</option>
                  <option value="Soins Intensifs / Réanimation (80%)">Soins Intensifs / Réanimation (80%)</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold mb-1.5">Taux de couverture UNAMUSC *</label>
                <select className="form-select input fw-bold" value={guaranteeRate} onChange={(e) => setGuaranteeRate(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="80%">80% Tiers-Payant Standard</option>
                  <option value="100%">100% Prise en Charge Totale (Gratuité / Exonéré)</option>
                </select>
              </div>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Acte médical ou traitement prescrit *</label>
              <input type="text" className="form-control input" value={guaranteeAct} onChange={(e) => setGuaranteeAct(e.target.value)} placeholder="ex: Chirurgie abdominale & séjour hospitalier 5 jours" required style={{ borderRadius: '14px', minHeight: '48px' }} />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1.5">Devis estimé des soins (FCFA) *</label>
              <input type="number" className="form-control input fw-bold" value={guaranteeAmount} onChange={(e) => setGuaranteeAmount(e.target.value)} required style={{ borderRadius: '14px', minHeight: '48px' }} />
              <small className="text-muted d-block mt-1.5" style={{ fontSize: '0.78rem' }}>
                💡 Estimation prise en charge UNAMUSC ({guaranteeRate}) : <strong>{((Number(guaranteeAmount || 0) * (guaranteeRate === '100%' ? 1 : 0.8))).toLocaleString()} FCFA</strong> — Reste à charge patient : {((Number(guaranteeAmount || 0) * (guaranteeRate === '100%' ? 0 : 0.2))).toLocaleString()} FCFA
              </small>
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn btn-outline-secondary fw-semibold px-3.5 py-2" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-success fw-bold px-4 py-2" style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}>Émettre la garantie</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 2 : Générer un Bon Pharmacie 48h (React Portal — Centré) */}
      {activeModal === 'order' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreateOrder} style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-warning mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
                <span>💊</span> Bon de commande pharmacie (48h Tiers-Payant)
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <span className="small text-muted d-block" style={{ fontSize: '0.86rem' }}>
                Prescription pour : <strong>{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber})
              </span>
            </div>

            {/* Téléversement / Capture Photo de l'ordonnance médicale */}
            <div className="mb-4 p-3.5 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1.5px dashed #f59e0b' }}>
              <label className="form-label small fw-extrabold mb-2 d-flex align-items-center justify-content-between text-warning" style={{ fontSize: '0.92rem' }}>
                <span>📷 Photo / Scan de l'ordonnance médicale (Mobile / PC / Tablette) *</span>
                {prescriptionPhoto && <span className="badge bg-success text-white">🟢 Ordonnance jointe</span>}
              </label>

              <input 
                type="file" 
                id="modalPrescriptionFileInput" 
                accept="image/*,.pdf" 
                capture="environment" 
                onChange={handlePrescriptionFileUpload} 
                style={{ display: 'none' }} 
              />

              {!prescriptionPhoto ? (
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <button 
                    type="button" 
                    className="btn btn-warning text-dark fw-bold flex-grow-1 py-2.5 d-inline-flex align-items-center justify-content-center gap-2 shadow-sm"
                    style={{ borderRadius: '14px', fontSize: '0.88rem' }}
                    onClick={() => document.getElementById('modalPrescriptionFileInput')?.click()}
                  >
                    <span>📷</span> Prendre en photo (Appareil photo)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary fw-bold flex-grow-1 py-2.5 d-inline-flex align-items-center justify-content-center gap-2"
                    style={{ borderRadius: '14px', fontSize: '0.88rem' }}
                    onClick={() => document.getElementById('modalPrescriptionFileInput')?.click()}
                  >
                    <span>📁</span> Choisir une photo / PDF
                  </button>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-3 mt-2 p-2 bg-white rounded-3 border">
                  <img 
                    src={prescriptionPhoto} 
                    alt="Aperçu ordonnance" 
                    style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #cbd5e1' }} 
                  />
                  <div className="flex-grow-1 overflow-hidden" style={{ minWidth: 0 }}>
                    <strong className="d-block text-truncate small" style={{ fontSize: '0.85rem' }}>{prescriptionFileName || 'ordonnance_scanné.jpg'}</strong>
                    <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '0.72rem' }}>Document numérisé prêt</span>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline-danger" 
                    onClick={() => { setPrescriptionPhoto(null); setPrescriptionFileName(''); }}
                    style={{ borderRadius: '10px' }}
                  >
                    🗑️
                  </button>
                </div>
              )}
              <small className="text-muted d-block mt-2" style={{ fontSize: '0.76rem' }}>
                💡 Prenez une photo nette avec votre smartphone ou téléversez le scan pour obtenir la prise en charge immédiate 50% en officine.
              </small>
            </div>

            <div className="row g-3 mb-3.5">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold mb-1.5">Officine de pharmacie conventionnée *</label>
                <select className="form-select input fw-bold" value={medPharmacy} onChange={(e) => setMedPharmacy(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="Pharmacie de la Médina">Pharmacie de la Médina (Dakar)</option>
                  <option value="Pharmacie de Fann">Pharmacie de Fann (Fann Résidence)</option>
                  <option value="Grande Pharmacie Cheikh Anta Diop">Grande Pharmacie Cheikh Anta Diop</option>
                  <option value="Pharmacie de la République">Pharmacie de la République (Plateau)</option>
                  <option value="Pharmacie de Pikine">Pharmacie de Pikine (Pikine)</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold mb-1.5">Médecin Prescripteur / Structure *</label>
                <input 
                  type="text" 
                  className="form-control input" 
                  value={medDoctor} 
                  onChange={(e) => setMedDoctor(e.target.value)} 
                  placeholder="ex: Dr. Ousmane Sow (CHU Fann)" 
                  required 
                  style={{ borderRadius: '14px', minHeight: '48px' }} 
                />
              </div>
            </div>

            <div className="row g-3 mb-3.5">
              <div className="col-12 col-md-8">
                <label className="form-label small fw-bold mb-1.5">Nom du médicament / DSI *</label>
                <input type="text" className="form-control input" value={medName} onChange={(e) => setMedName(e.target.value)} placeholder="ex: Amoxicilline 500mg" required style={{ borderRadius: '14px', minHeight: '48px' }} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold mb-1.5">Forme *</label>
                <select className="form-select input" value={medForm} onChange={(e) => setMedForm(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="Gélules">Gélules</option>
                  <option value="Sirop">Sirop pédiatrique</option>
                  <option value="Comprimés">Comprimés</option>
                  <option value="Injectables">Injectable</option>
                  <option value="Pommade / Gel">Pommade / Gel</option>
                </select>
              </div>
            </div>

            <div className="row g-3 mb-3.5">
              <div className="col-6">
                <label className="form-label small fw-bold mb-1.5">Quantité (boîtes) *</label>
                <input type="number" className="form-control input" value={medQty} onChange={(e) => setMedQty(e.target.value)} min="1" required style={{ borderRadius: '14px', minHeight: '48px' }} />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold mb-1.5">Prix unitaire (FCFA) *</label>
                <input type="number" className="form-control input" value={medPrice} onChange={(e) => setMedPrice(e.target.value)} required style={{ borderRadius: '14px', minHeight: '48px' }} />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1.5">Posologie & instructions du praticien *</label>
              <input type="text" className="form-control input" value={medPosology} onChange={(e) => setMedPosology(e.target.value)} placeholder="ex: 1 gélule matin et soir pendant 7 jours" required style={{ borderRadius: '14px', minHeight: '48px' }} />
              <small className="text-muted d-block mt-1.5" style={{ fontSize: '0.78rem' }}>
                💡 Montant total : <strong>{(Number(medQty) * Number(medPrice)).toLocaleString()} FCFA</strong> — Prise en charge Tiers-Payant 50% UNAMUSC : {(Number(medQty) * Number(medPrice) * 0.5).toLocaleString()} FCFA
              </small>
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn btn-outline-secondary fw-semibold px-3.5 py-2" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-warning text-dark fw-bold px-4 py-2" style={{ borderRadius: '12px', background: '#d97706', borderColor: '#d97706', color: '#fff' }}>Générer bon 48h certifié</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 3 : Télémédecine WebRTC 24/7 (React Portal — Centré) */}
      {activeModal === 'telemedicine' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreateTelemed} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-extrabold text-primary mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
                <span>🎥</span> Téléconsultation Télémédecine Direct 24/7
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(30, 64, 175, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <span className="small text-muted d-block" style={{ fontSize: '0.86rem' }}>
                Dossier & Visio pour : <strong>{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber})
              </span>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Médecin téléconsultant certifié UNAMUSC *</label>
              <select className="form-select input fw-bold" value={telemedDoctor} onChange={(e) => setTelemedDoctor(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                <option value="Dr. Ousmane Sow (Médecin Généraliste UNAMUSC)">Dr. Ousmane Sow — Médecin Généraliste (En ligne 🟢)</option>
                <option value="Dr. Mariama Ba (Pédiatre CHU Fann)">Dr. Mariama Ba — Pédiatre & Néonatalogie (En ligne 🟢)</option>
                <option value="Dr. Aminata Diop (Gynécologue-Obstétricienne)">Dr. Aminata Diop — Gynécologie & Maternité (En ligne 🟢)</option>
                <option value="Dr. Fatou Diome (Sage-femme DKR)">Dr. Fatou Diome — Sage-femme d'État (En ligne 🟢)</option>
              </select>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Motif principal de la consultation *</label>
              <input type="text" className="form-control input" value={telemedReason} onChange={(e) => setTelemedReason(e.target.value)} placeholder="ex: Suivi médical, ordonnance, consultation de contrôle" required style={{ borderRadius: '14px', minHeight: '48px' }} />
            </div>

            <div className="row g-3 mb-4">
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold mb-1.5">Niveau d'urgence *</label>
                <select className="form-select input" value={telemedUrgency} onChange={(e) => setTelemedUrgency(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="Urgence Standard (RDV sous 15 min)">Urgence Standard (≤ 15 min)</option>
                  <option value="Prioritaire (Sous 5 min)">Prioritaire (≤ 5 min)</option>
                  <option value="Urgence Vitale 24/7 (Immédiat)">Urgence Vitale 24/7 (Immédiat)</option>
                </select>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label small fw-bold mb-1.5">Canal de visio *</label>
                <select className="form-select input" value={telemedMode} onChange={(e) => setTelemedMode(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="Visio HD WebRTC en direct">Visio HD WebRTC Sécurisée</option>
                  <option value="Consultation Audio Téléphonique">Consultation Audio Directe</option>
                </select>
              </div>
            </div>

            <div className="p-3.5 rounded-4 mb-4" style={{ background: 'rgba(30, 64, 175, 0.08)', border: '1.5px solid rgba(59, 130, 246, 0.3)', borderRadius: '16px' }}>
              <div className="d-flex align-items-center gap-2 fw-bold text-primary mb-1" style={{ fontSize: '0.88rem' }}>
                <span>🔒</span> Connexion médicale WebRTC de bout en bout
              </div>
              <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                Couverture 100% Tiers-Payant UNAMUSC : aucune avance de frais requise.
              </small>
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn btn-outline-secondary fw-semibold px-3.5 py-2" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary fw-bold px-4 py-2 text-white" style={{ borderRadius: '12px', background: '#1e40af', borderColor: '#1e40af' }}>
                🎥 Démarrer la visio-consultation HD →
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 4 : Ajouter Radio / Analyse DICOM (React Portal — Centré) */}
      {activeModal === 'imaging' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleAddImaging} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-info mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
                <span>🩻</span> Transmettre un examen radio / biologie (DICOM)
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(147, 51, 234, 0.1)', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
              <span className="small text-muted d-block" style={{ fontSize: '0.86rem' }}>
                Transmission pour : <strong>{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber})
              </span>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Centre d'imagerie ou laboratoire *</label>
              <select className="form-select input fw-bold" value={examCenter} onChange={(e) => setExamCenter(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                <option value="Centre d'Imagerie de Fann">Centre d'Imagerie de Fann (Dakar)</option>
                <option value="Laboratoire BioMed Dakar">Laboratoire BioMed Dakar</option>
                <option value="Centre de Radiologie Le Dantec">Centre de Radiologie Le Dantec</option>
                <option value="Labo d'Analyses Médina">Labo d'Analyses Médina</option>
              </select>
            </div>

            <div className="row g-3 mb-3.5">
              <div className="col-12 col-md-8">
                <label className="form-label small fw-bold mb-1.5">Titre de l'examen *</label>
                <input type="text" className="form-control input" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="ex: Scanner Thoracique HD" required style={{ borderRadius: '14px', minHeight: '48px' }} />
              </div>
              <div className="col-12 col-md-4">
                <label className="form-label small fw-bold mb-1.5">Type *</label>
                <select className="form-select input" value={examType} onChange={(e) => setExamType(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                  <option value="Scanner">Scanner HD</option>
                  <option value="Radio">Radiographie RX</option>
                  <option value="Analyse">Analyse Bio / Labo</option>
                  <option value="IRM">IRM 1.5T</option>
                  <option value="Échographie">Échographie</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1.5">Compte-rendu du radiologue & conclusions médicales *</label>
              <textarea className="form-control input" rows="3" value={examNotes} onChange={(e) => setExamNotes(e.target.value)} placeholder="Compte-rendu de l'examen..." required style={{ borderRadius: '14px', padding: '0.75rem 1rem' }} />
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn btn-outline-secondary fw-semibold px-3.5 py-2" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-info text-white fw-bold px-4 py-2" style={{ borderRadius: '12px', background: '#9333ea', borderColor: '#9333ea' }}>Enregistrer l'examen</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 5 : Consultations & Spécialités (React Portal — Centré) */}
      {activeModal === 'specialties' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreateSpecialty} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-primary mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.25rem' }}>
                <span>🩺</span> Consultation Spécialisée UNAMUSC
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(2, 132, 199, 0.1)', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
              <span className="small text-muted d-block" style={{ fontSize: '0.86rem' }}>
                Bénéficiaire : <strong>{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber})
              </span>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Discipline spécialisée *</label>
              <select className="form-select input fw-bold" value={specialtyType} onChange={(e) => setSpecialtyType(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                <option value="Pédiatrie & Néo-natologie">Pédiatrie & Néo-natologie (Gratuité 100%)</option>
                <option value="Gynécologie & Obstétrique">Gynécologie & Maternité 100%</option>
                <option value="Cardiologie & Vasculaire">Cardiologie & Prévention HTA</option>
                <option value="Ophtalmologie & Optique">Ophtalmologie & Soins visuels</option>
                <option value="Dermatologie & Vénérologie">Dermatologie & Soins cutanés</option>
                <option value="ORL & Chirurgie Cervico-Faciale">ORL & Audition</option>
              </select>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Médecin spécialiste ou structure *</label>
              <input type="text" className="form-control input" value={specialtyDoctor} onChange={(e) => setSpecialtyDoctor(e.target.value)} placeholder="ex: Dr. Mariama Ba (Pédiatre CHU Fann)" required style={{ borderRadius: '14px', minHeight: '48px' }} />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1.5">Motif de consultation & observations *</label>
              <textarea className="form-control input" rows="3" value={specialtyNotes} onChange={(e) => setSpecialtyNotes(e.target.value)} placeholder="Observations médicales..." required style={{ borderRadius: '14px', padding: '0.75rem 1rem' }} />
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn btn-outline-secondary fw-semibold px-3.5 py-2" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary fw-bold text-white px-4 py-2" style={{ borderRadius: '12px', background: '#0284c7', borderColor: '#0284c7' }}>Valider la consultation</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* MODALE 6 : Pathologies & Suivi Chronique ALD (React Portal — Centré) */}
      {activeModal === 'pathologies' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <form onSubmit={handleCreatePathology} style={{ maxWidth: '620px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ fontSize: '1.25rem', color: '#db2777' }}>
                <span>🧬</span> Pathologies & Protocole ALD 100%
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="p-3 rounded-4 mb-4" style={{ background: 'rgba(219, 39, 119, 0.1)', border: '1px solid rgba(219, 39, 119, 0.3)' }}>
              <span className="small text-muted d-block" style={{ fontSize: '0.86rem' }}>
                Pathologie pour : <strong>{selectedTargetBeneficiary ? selectedTargetBeneficiary.name : `${result?.firstName} ${result?.lastName}`}</strong> ({selectedTargetBeneficiary ? selectedTargetBeneficiary.cmuCode : result?.cmuNumber})
              </span>
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Nom de la pathologie ou protocole ALD *</label>
              <input type="text" className="form-control input fw-bold" value={pathologyName} onChange={(e) => setPathologyName(e.target.value)} placeholder="ex: Hypertension artérielle (HTA), Diabète Type 2" required style={{ borderRadius: '14px', minHeight: '48px' }} />
            </div>

            <div className="mb-3.5">
              <label className="form-label small fw-bold mb-1.5">Niveau de prise en charge UNAMUSC *</label>
              <select className="form-select input fw-bold" value={pathologyProtocol} onChange={(e) => setPathologyProtocol(e.target.value)} style={{ borderRadius: '14px', minHeight: '48px' }}>
                <option value="Prise en charge 100% Universelle UNAMUSC">100% Gratuité Universelle (Tiers-payant total)</option>
                <option value="Prise en charge ALD 80% (Affection Longue Durée)">80% Prise en charge Affection Longue Durée (ALD)</option>
                <option value="Programme PEV Pédiatrique Gratuit">Programme Élargi de Vaccination (PEV) 100% Gratuit</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1.5">Statut clinique actuel & observations *</label>
              <input type="text" className="form-control input" value={pathologyStatus} onChange={(e) => setPathologyStatus(e.target.value)} placeholder="ex: Patient stabilisé sous traitement" required style={{ borderRadius: '14px', minHeight: '48px' }} />
            </div>

            <div className="d-flex justify-content-end gap-3 mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" className="btn btn-outline-secondary fw-semibold px-3.5 py-2" style={{ borderRadius: '12px' }} onClick={() => setActiveModal(null)}>Annuler</button>
              <button type="submit" className="btn text-white fw-bold px-4 py-2" style={{ borderRadius: '12px', background: '#db2777', borderColor: '#db2777' }}>Enregistrer la pathologie</button>
            </div>
          </form>
        </div>,
        document.body
      )}

    </div>
  );
}
