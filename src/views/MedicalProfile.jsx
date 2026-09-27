import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { getStoredMembers } from '../utils/beneficiaryStore';
import DeleteModal from '../components/DeleteModal';

// Design Premium Haut de Gamme — Dossier Médical & Radiographies Certifiées
export default function MedicalProfile({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isAgent      = (userRole === 'agent' || !!agentUser) && !isSuperAdmin;
  const isLabUser    = userRole === 'lab' || userRole === 'biologist' || 
                       (partnerUser?.role && (partnerUser.role.toLowerCase().includes('laboratoire') || partnerUser.role.toLowerCase().includes('biologiste') || partnerUser.role.toLowerCase().includes('imagerie'))) ||
                       (partnerUser?.structureName && (partnerUser.structureName.toLowerCase().includes('pasteur') || partnerUser.structureName.toLowerCase().includes('laboratoire') || partnerUser.structureName.toLowerCase().includes('imagerie')));
  const isDoctor     = !isLabUser && (userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin')));
  const isMidwife    = !isLabUser && (userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage')));
  const isPharmacist = !isLabUser && userRole === 'pharmacist';
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isLabUser && !isSuperAdmin && !!citizenUser;

  // Droits d'édition clinique : uniquement médecin, sage-femme et superadmin
  const canEditMedical  = (isDoctor || isMidwife || isSuperAdmin) && !isLabUser;
  // Droits d'ajout d'examens labo/radios : médecin, sage-femme, superadmin et laboratoire
  const canAddLabExam   = isDoctor || isMidwife || isSuperAdmin || isLabUser;
  // Vue administrative (sans accès au contenu médical détaillé)
  const isAdminView     = isAgent && !isSuperAdmin;
  // Accès total
  const hasFullAccess   = canEditMedical || isSuperAdmin;
  // Ancien alias pour rétro-compatibilité des blocs existants
  const isDoctorOrAgent = canEditMedical || isSuperAdmin;

  // ═══════════════════════════════════════════════════════
  // Registre des patients — données RÉELLES uniquement
  // ═══════════════════════════════════════════════════════
  // Aucun patient n'est inventé. Le registre croise les bénéficiaires
  // réellement enregistrés (store local, synchronisé serveur) avec les
  // examens RÉELLEMENT saisis par les praticiens (localStorage).
  // Un patient sans examen n'apparaît pas : un dossier médical fictif
  // (diagnostic, médecin, date) est un risque sanitaire et juridique.
  const [realMembers, setRealMembers] = useState([]);

  useEffect(() => {
    const load = () => {
      try {
        setRealMembers(getStoredMembers());
      } catch (e) {
        setRealMembers([]);
      }
    };
    load();
    window.addEventListener('unamusc_store_change', load);
    return () => window.removeEventListener('unamusc_store_change', load);
  }, []);

  /** Examens réellement saisis pour un bénéficiaire. */
  const getRealExams = (cmuNumber) => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(`cmu-exams-${cmuNumber}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  };

  const facilityPatients = useMemo(
    () =>
      realMembers
        .map((m) => {
          const exams = getRealExams(m.cmuNumber);
          if (exams.length === 0) return null;
          const last = exams[exams.length - 1] || {};
          return {
            cmuNumber: m.cmuNumber,
            firstName: m.firstName,
            lastName: m.lastName,
            packageType: m.package || '—',
            examCount: exams.length,
            lastExam: last.type || last.examType || 'Examen',
            doctor: last.doctor || last.doctorName || '—',
            location: last.facility || last.location || '—'
          };
        })
        .filter(Boolean),
    [realMembers]
  );

  // Liste des dossiers patients suivis dans la structure / établissement

  const [selectedPatientCmu, setSelectedPatientCmu] = useState(() => {
    if (isCitizen && (citizenUser?.cmuNumber || citizenUser?.cmu_number)) {
      return citizenUser.cmuNumber || citizenUser.cmu_number;
    }
    try {
      const hash = window.location.hash;
      if (hash.includes('cmu=')) {
        const cmuParam = hash.split('cmu=')[1].split('&')[0];
        if (cmuParam && !isCitizen) return decodeURIComponent(cmuParam);
      }
    } catch (e) {}
    if (citizenUser?.cmuNumber || citizenUser?.cmu_number) {
      return citizenUser.cmuNumber || citizenUser.cmu_number;
    }
    return 'CMU-DKR-2026-4401'; // Default for Lab/Doctor is Fatou Diop
  });

  const [showPatientDirectoryModal, setShowPatientDirectoryModal] = useState(false);

  // Résolution dynamique du patient actif (Verrouillage strict si citoyen connecté)
  const currentPatientObj = isCitizen && citizenUser ? {
    firstName: citizenUser.firstName || citizenUser.first_name || 'Ibrahima',
    lastName: citizenUser.lastName || citizenUser.last_name || 'Sarr',
    cmuNumber: citizenUser.cmuNumber || citizenUser.cmu_number || 'SN-DK-UCAD-1012',
    packageType: citizenUser.packageType || 'Scolaire / Étudiant UCAD',
    doctor: citizenUser.doctor || 'Dr. Ousmane Sow (Centre COUD / Fann)',
    location: citizenUser.mutuelleName || 'Mutuelle UCAD Dakar',
    examCount: 5,
    lastExam: 'Bilan de santé & consultation de suivi'
  } : (facilityPatients.find(p => p.cmuNumber === selectedPatientCmu) || {
    firstName: citizenUser?.firstName || citizenUser?.first_name || 'Fatou',
    lastName: citizenUser?.lastName || citizenUser?.last_name || 'Diop',
    cmuNumber: selectedPatientCmu
  });

  const activeFirstName = currentPatientObj.firstName;
  const activeLastName = currentPatientObj.lastName;
  const activeCmuNumber = currentPatientObj.cmuNumber;

  const isStudent = (currentPatientObj.packageType === 'Scolaire / Student UCAD' || (activeFirstName || '').toLowerCase().includes('ibrahima'));
  const isBsf = (currentPatientObj.packageType === '100% Gratuité' || (activeFirstName || '').toLowerCase().includes('fatou'));

  // Détection du sexe de l'assuré (Femme vs Homme)
  const isFemalePatient = (() => {
    const gender = (citizenUser?.gender || citizenUser?.sexe || currentPatientObj?.gender || currentPatientObj?.sexe || '').toUpperCase();
    if (gender === 'F' || gender === 'FEMME' || gender === 'FEMININ') return true;
    if (gender === 'M' || gender === 'HOMME' || gender === 'MASCULIN') return false;
    const name = (activeFirstName || '').toLowerCase().trim();
    const femaleNames = ['fatou', 'awa', 'ndeye', 'ndèye', 'astou', 'khadija', 'sokhna', 'aminata', 'mariama', 'seynabou', 'mame', 'coumba', 'adja', 'oumou', 'binta', 'aida', 'rokhaya', 'khadidiatou', 'fama', 'diarra', 'antou', 'ramatoulaye', 'safiatou', 'aissatou', 'aïssatou', 'daba', 'amy', 'tina'];
    return femaleNames.some(fn => name.includes(fn));
  })();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'history', 'lab', 'maternity', 'maternity_pathology'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modales
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAddExamModal, setShowAddExamModal] = useState(false);
  const [editingExamTarget, setEditingExamTarget] = useState(null);
  const [editingAntecedents, setEditingAntecedents] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  
  // OTP dynamique 24h persistant par assuré
  const [otpData, setOtpData] = useState(() => {
    try {
      const stored = localStorage.getItem(`unamusc_otp_${activeCmuNumber}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
          return parsed;
        }
      }
    } catch (e) {}
    const newCode = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const newData = { code: newCode, expiresAt: newExpiresAt, createdAt: Date.now() };
    try { localStorage.setItem(`unamusc_otp_${activeCmuNumber}`, JSON.stringify(newData)); } catch (e) {}
    return newData;
  });

  const generateNewOtp = () => {
    const newCode = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    const newExpiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const newData = { code: newCode, expiresAt: newExpiresAt, createdAt: Date.now() };
    setOtpData(newData);
    try { localStorage.setItem(`unamusc_otp_${activeCmuNumber}`, JSON.stringify(newData)); } catch (e) {}
  };

  const isOtpExpired = Date.now() >= otpData.expiresAt;

  const getRemainingTime = () => {
    const diffMs = otpData.expiresAt - Date.now();
    if (diffMs <= 0) return 'Expiré';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const handleCopyShareLink = () => {
    const shareUrl = `https://mutualis.sn/dossier-partage/${activeCmuNumber}?otp=${otpData.code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleShareWhatsApp = (e) => {
    if (e) e.preventDefault();
    const shareText = `Bonjour Docteur, voici l'accès sécurisé temporaire (24h) au dossier médical certifié UNAMUSC de ${activeFirstName} ${activeLastName} (${activeCmuNumber}) :\n\n🔑 Code OTP : ${otpData.code}\n🔗 Lien : https://mutualis.sn/dossier-partage/${activeCmuNumber}?otp=${otpData.code}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Dossier Médical UNAMUSC',
        text: shareText,
        url: `https://mutualis.sn/dossier-partage/${activeCmuNumber}?otp=${otpData.code}`
      }).catch(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      });
    } else {
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Générateurs de données médicales propres et distinctes à chaque assuré
  const getAntecedentsForUser = (cmuNum, isStud, isBsfUser, fName) => {
    const name = (fName || '').toLowerCase();
    if (name.includes('amadou') || cmuNum === 'CSU-DKR-2026-8812.2') {
      return {
        bloodGroup: 'A+',
        rhesus: 'positif',
        allergies: 'Aucune allergie médicamenteuse connue',
        chronicConditions: 'Traumatisme osseux membre inférieur droit (Facture tibia)',
        surgeries: 'Ostéosynthèse / Pose de plâtre (2026)',
        emergencyContact: 'Aminata Sow (Épouse) : +221 77 555 12 34'
      };
    }
    if (name.includes('awa') || cmuNum === 'CMU-DKR-2026-3302') {
      return {
        bloodGroup: 'O+',
        rhesus: 'positif',
        allergies: 'Aspirine (Légère urticaire)',
        chronicConditions: 'Suivi préventif bilan lipidique & sénologie',
        surgeries: 'Aucune chirurgie antérieure',
        emergencyContact: 'Cheikh Ndiaye (Frère) : +221 77 444 88 99'
      };
    }
    if (name.includes('ibrahima') || cmuNum === 'CSU-UCAD-2026-9012' || isStud) {
      return {
        bloodGroup: 'O+',
        rhesus: 'positif',
        allergies: 'Aucune allergie connue (Bilan médical UCAD 2026)',
        chronicConditions: 'Aucune affection de longue durée : Aptitude sportive UCAD validée',
        surgeries: 'Aucune chirurgie antérieure',
        emergencyContact: 'Papa Sarr (Père) : +221 77 654 32 10'
      };
    }
    if (name.includes('fatou') || cmuNum === 'CMU-DKR-2026-4401' || isBsfUser) {
      return {
        bloodGroup: 'B+',
        rhesus: 'positif',
        allergies: 'Pénicilline (Modérée)',
        chronicConditions: 'Hypertension artérielle (Suivi programme gratuité BSF)',
        surgeries: 'Césarienne (2018)',
        emergencyContact: 'Mamadou Diallo (Époux) : +221 77 123 99 88'
      };
    }
    return {
      bloodGroup: 'AB+',
      rhesus: 'positif',
      allergies: 'Pollen de graminées (Médina)',
      chronicConditions: 'Discopathie lombo-sacrée L4-L5',
      surgeries: 'Appendicectomie (2021)',
      emergencyContact: 'Sokhna Diop (Épouse) : +221 77 987 65 43'
    };
  };

  const getExamsForUser = (cmuNum, isStud, isBsfUser, fName) => {
    const name = (fName || '').toLowerCase();

    // 1. Amadou Sow : Fracture Os Cassé, Bilan Sanguin, IRM Rachis, Radio Thorax, Echocardiographie
    if (name.includes('amadou') || cmuNum === 'CSU-DKR-2026-8812.2') {
      return [
        {
          id: 801,
          title: 'Radiographie osseuse d\'urgence (Fracture tibia / Os cassé)',
          exam_type: 'Radiographie',
          badge: '🦴 ORTHOPÉDIE - OS CASSÉ',
          facility: 'Hôpital Abass Ndao (Dakar)',
          doctor: 'Dr. Cheikh Anta Diop | Service Traumatologie',
          date: '04 Fév 2026',
          conclusion: 'Radiographie montrant une fracture nette du tiers inférieur du tibia droit. Immobilisation plâtrée réalisée avec succès. Contrôle clinique et radiologique prévu à J+21.',
          cliches: 4,
          preview: '/dicom_bone_fracture.jpg'
        },
        {
          id: 802,
          title: 'Bilan sanguin complet & Sérologies certifiées',
          exam_type: 'Analyse Biologique',
          badge: '🧪 BILAN SANGUIN COMPLET',
          facility: 'Laboratoire Pasteur Dakar',
          doctor: 'Dr. Cheikh Anta Diop | Biologiste',
          date: '01 Fév 2026',
          conclusion: 'Numération Formule Sanguine (NFS) normale. Glycémie à jeun : 0.92 g/L. Bilan hépatique et rénal satisfaisants. Sérologies virales négatives.',
          cliches: 2,
          preview: '/dicom_blood_test.jpg'
        },
        {
          id: 803,
          title: 'Scanner IRM du rachis lombaire & bassin',
          exam_type: 'Scanner IRM',
          badge: '🦴 SCANNER RACHIS HD',
          facility: 'Polyclinique de la Médina',
          doctor: 'Dr. Ibrahima Faye | Radiologue',
          date: '20 Janv 2026',
          conclusion: 'Alignement vertébral conservé. Absence de hernie discale synchrone. Espace lombo-sacré L4-L5 sans conflit disco-radiculaire.',
          cliches: 4,
          preview: '/dicom_spine_xray.jpg'
        },
        {
          id: 804,
          title: 'Radiographie thoracique de contrôle pulmonaire',
          exam_type: 'Radiographie',
          badge: '🫁 BILAN PULMONAIRE',
          facility: 'Hôpital Principal de Dakar',
          doctor: 'Dr. Ousmane Sow | Pneumologue',
          date: '10 Janv 2026',
          conclusion: 'Transparence pulmonaire normale. Silhouette cardiaque de taille habituelle. Absence d\'épanchement pleural.',
          cliches: 2,
          preview: '/dicom_chest_xray.jpg'
        },
        {
          id: 805,
          title: 'Échocardiographie Doppler pré-opératoire',
          exam_type: 'Échographie',
          badge: '❤️ CARDIOLOGIE',
          facility: 'Hôpital Universitaire de Fann',
          doctor: 'Dr. Cheikh Tidiane Seck | Cardiologue',
          date: '05 Janv 2026',
          conclusion: 'Cavités cardiaques non dilatées. Fraction d\'éjection (FE = 68%). Contractilité globale et segmentaire conservée.',
          cliches: 3,
          preview: '/dicom_ultrasound_pelvic.jpg'
        },
        {
          id: 806,
          title: 'Bilan lipidique & contrôle métabolique complet',
          exam_type: 'Analyse Biologique',
          badge: '🧪 LABORATOIRE PASTEUR',
          facility: 'Laboratoire Pasteur Dakar',
          doctor: 'Dr. Papa Mamadou Kane',
          date: '28 Déc 2025',
          conclusion: 'Cholestérol HDL : 0.52 g/L, LDL : 1.10 g/L. Glycémie : 0.89 g/L. Bilan lipidique et métabolique parfaitement équilibré.',
          cliches: 2,
          preview: '/dicom_blood_test.jpg'
        }
      ];
    }

    // 2. Awa Ndiaye : Bilan Lipidique, Mammographie Sénologie, Échographie Pelvienne, Radio Thorax
    if (name.includes('awa') || cmuNum === 'CMU-DKR-2026-3302') {
      return [
        {
          id: 901,
          title: 'Bilan lipidique & Glycémie à jeun (Télémédecine)',
          exam_type: 'Analyse Biologique',
          badge: '🧪 TÉLÉMÉDECINE #TM-8812',
          facility: 'Laboratoire Examen Plus Dakar',
          doctor: 'Dr. Ousmane Sow | Prescripteur Télémédecine',
          date: '06 Fév 2026',
          conclusion: 'Cholestérol total : 1.85 g/L (Val normal < 2.00 g/L). Glycémie : 0.88 g/L. Bilan lipidique satisfaisant sous traitement préventif.',
          cliches: 2,
          preview: '/dicom_blood_test.jpg'
        },
        {
          id: 902,
          title: 'Mammographie & Échographie mammaire DICOM',
          exam_type: 'Mammographie',
          badge: '🩻 SÉNOLOGIE DICOM',
          facility: 'Centre d\'Imagerie Médicale Dakar',
          doctor: 'Dr. Aïssatou Kane | Radiologue',
          date: '20 Déc 2025',
          conclusion: 'Examen sénologique bilatéral classé ACR-1. Densité mammaire normale sans opacité ni microcalcification suspecte.',
          cliches: 4,
          preview: '/dicom_mammography.jpg'
        },
        {
          id: 903,
          title: 'Échographie pelvienne & gynécologique HD',
          exam_type: 'Échographie',
          badge: '🤰 GYNÉCOLOGIE DICOM',
          facility: 'Hôpital Aristide Le Dantec',
          doctor: 'Dr. Mariama Ba | Gynécologue',
          date: '15 Nov 2025',
          conclusion: 'Utérus de taille et morphologie normales. Ovaires d\'aspect physiologique sans kyste ni masse suspecte.',
          cliches: 3,
          preview: '/dicom_ultrasound_pelvic.jpg'
        },
        {
          id: 904,
          title: 'Radiographie pulmonaire de contrôle systématique',
          exam_type: 'Radiographie',
          badge: '🫁 IMAGERIE PULMONAIRE',
          facility: 'Polyclinique de la Médina',
          doctor: 'Dr. Saliou Wade | Pneumologue',
          date: '02 Oct 2025',
          conclusion: 'Cliché pulmonaire de face normal. Parenchyme pulmonaire bilatéralement clair sans syndome interstitiel.',
          cliches: 2,
          preview: '/dicom_chest_xray.jpg'
        },
        {
          id: 905,
          title: 'Frottis cervico-vaginal & Bilan cytologique',
          exam_type: 'Analyse Biologique',
          badge: '🔬 CYTOLOGIE PRÉVENTIVE',
          facility: 'Laboratoire Pasteur Dakar',
          doctor: 'Dr. Fatou Diop | Biologiste',
          date: '10 Août 2025',
          conclusion: 'Absence de cellule atypique ou de lésion intra-épithéliale. Frottis normal classé sous schéma négatif (Bethesda).',
          cliches: 2,
          preview: '/dicom_blood_test.jpg'
        }
      ];
    }

    // 3. Ibrahima Sarr : Étudiant UCAD - Radio Thoracique, Échographie Abdominale, Radio Genou, Bilan Sanguin
    if (name.includes('ibrahima') || cmuNum === 'CSU-UCAD-2026-9012' || isStud) {
      return [
        {
          id: 601,
          title: 'Radiographie thoracique d\'incorporation UCAD',
          exam_type: 'Radiographie',
          badge: '🫁 BILAN SANTÉ UCAD',
          facility: 'Centre Médical Universitaire (Fann)',
          doctor: 'Dr. Ousmane Sow | Pavillon Santé UCAD',
          date: '02 Fév 2026',
          conclusion: 'Cliché pulmonaire de face normal. Parenchyme clair sans foyer évolutif. Aptitude physique et sportive universitaire 100% validée.',
          cliches: 2,
          preview: '/dicom_chest_xray.jpg'
        },
        {
          id: 602,
          title: 'Échographie abdominale de contrôle sportif',
          exam_type: 'Échographie',
          badge: '⚽ SPORTS MED',
          facility: 'Hôpital Universitaire de Fann',
          doctor: 'Dr. Cheikh Anta Diop',
          date: '10 Janv 2026',
          conclusion: 'Organes abdominaux de morphologie et d\'écho-structure normales. Bilan fonctionnel satisfaisant.',
          cliches: 3,
          preview: '/dicom_ultrasound_pelvic.jpg'
        },
        {
          id: 603,
          title: 'Radiographie du genou droit & Cheville (Trauma du sport)',
          exam_type: 'Radiographie',
          badge: '🦴 TRAUMATOLOGIE SPORT',
          facility: 'Hôpital Principal de Dakar',
          doctor: 'Dr. Ibrahima Faye | Orthopédiste',
          date: '18 Déc 2025',
          conclusion: 'Absence de fracture osseuse ou d\'arrachement osseux. Entorse bénigne du ligament latéral externe du genou.',
          cliches: 4,
          preview: '/dicom_bone_fracture.jpg'
        },
        {
          id: 604,
          title: 'Bilan biologique d\'incorporation universitaire UCAD',
          exam_type: 'Analyse Biologique',
          badge: '🧪 BIOLOGIE ÉTUDIANTS',
          facility: 'Centre Médical UCAD',
          doctor: 'Dr. Cheikh Anta Diop | Biologiste',
          date: '05 Oct 2025',
          conclusion: 'Bilan sanguin complet, sérologies HBsAg et profil immunitaire en parfaite conformité avec les exigences de la CSU UCAD.',
          cliches: 2,
          preview: '/dicom_blood_test.jpg'
        }
      ];
    }

    // 4. Fatou Diop : Radio Pulmonaire, Échographie Maternelle BSF, Scanner Rachis, Bilan Biologique
    if (name.includes('fatou') || cmuNum === 'CMU-DKR-2026-4401' || isBsfUser) {
      return [
        {
          id: 701,
          title: 'Radiographie pulmonaire & Scanner DICOM',
          exam_type: 'Radiographie',
          badge: '🩻 IMAGERIE THORACIQUE HD',
          facility: 'Hôpital Fann (Dakar)',
          doctor: 'Dr. Ousmane Sow | Radiologue agréé',
          date: '05 Fév 2026',
          conclusion: 'Radiographie pulmonaire de contrôle satisfaisante. Absence de foyer parenchymateux évolutif ou d\'épanchement pleural. Transmis à l\'UNAMUSC.',
          cliches: 3,
          preview: '/dicom_chest_xray.jpg'
        },
        {
          id: 702,
          title: 'Échographie maternelle & pelvienne BSF (32 SA)',
          exam_type: 'Échographie',
          badge: '🤰 GRATUITÉ 100% BSF',
          facility: 'Hôpital Aristide Le Dantec (Dakar)',
          doctor: 'Dr. Mariama Ba | Service Maternité',
          date: '14 Janv 2026',
          conclusion: 'Examen gynécologique et pelvien satisfaisant. Croissance fœtale harmonieuse au 50ème percentile. Prise en charge intégrale BSF.',
          cliches: 3,
          preview: '/dicom_ultrasound_pelvic.jpg'
        },
        {
          id: 703,
          title: 'Bilan prénatal biologique prématernité CPN 3',
          exam_type: 'Analyse Biologique',
          badge: '🧪 PRÉNATAL GRATUIT',
          facility: 'Laboratoire Pasteur Dakar',
          doctor: 'Dr. Fatou Bintou Ndiaye',
          date: '08 Janv 2026',
          conclusion: 'Taux d\'hémoglobine : 11.8 g/dL (Normal). Glycémie : 0.84 g/L. Test RAI négatif.',
          cliches: 2,
          preview: '/dicom_blood_test.jpg'
        },
        {
          id: 704,
          title: 'Scanner lombaire de contrôle post-gravidique',
          exam_type: 'Scanner IRM',
          badge: '🦴 IMAGERIE RACHIS',
          facility: 'Polyclinique de la Médina',
          doctor: 'Dr. Cheikh Anta Diop',
          date: '12 Nov 2025',
          conclusion: 'Structure osseuse et espaces intervertébraux normaux. Absence de hernie discale.',
          cliches: 3,
          preview: '/dicom_spine_xray.jpg'
        }
      ];
    }

    // 5. Modou Diop & Défaut : Suite complète de 6 examens radiologiques et biologiques
    return [
      {
        id: 501,
        title: 'Radiographie lombaire & Scanner IRM du rachis',
        exam_type: 'Scanner IRM',
        badge: '🦴 RACHIS & LOMBAIRE',
        facility: 'Polyclinique de la Médina',
        doctor: 'Dr. Cheikh Anta Diop | Abass Ndao',
        date: '12 Mars 2026',
        conclusion: 'Discopathie lombo-sacrée L4-L5 modérée sans hernie discale exclue. Traitement antalgique adapté et kinésithérapie recommandée.',
        cliches: 4,
        preview: '/dicom_spine_xray.jpg'
      },
      {
        id: 502,
        title: 'Échocardiographie Doppler de contrôle',
        exam_type: 'Échographie',
        badge: '❤️ CARDIOLOGIE',
        facility: 'Centre Médical SOS Médina',
        doctor: 'Dr. Sy | Cardiologue',
        date: '15 Janv 2026',
        conclusion: 'Fonction ventriculaire gauche et droite conservées. Fraction d\'éjection (FE = 65%). Examen cardio-vasculaire rassurant.',
        cliches: 3,
        preview: '/dicom_ultrasound_pelvic.jpg'
      },
      {
        id: 503,
        title: 'Radiographie thoracique de contrôle pulmonaire',
        exam_type: 'Radiographie',
        badge: '🩻 IMAGERIE THORACIQUE HD',
        facility: 'Hôpital Universitaire de Fann',
        doctor: 'Dr. Ousmane Sow | Radiologue',
        date: '10 Janv 2026',
        conclusion: 'Transparence pulmonaire normale. Silhouette cardiaque de taille et de configuration habituelles. Pas d\'anomalie pleuro-parenchymateuse.',
        cliches: 2,
        preview: '/dicom_chest_xray.jpg'
      },
      {
        id: 504,
        title: 'Bilan biologique complet & Glycémie à jeun',
        exam_type: 'Analyse Biologique',
        badge: '🧪 BILAN BIOLOGIQUE',
        facility: 'Laboratoire Pasteur Dakar',
        doctor: 'Dr. Cheikh Anta Diop | Biologiste',
        date: '08 Janv 2026',
        conclusion: 'NFS sans particularité. HbA1c : 5.8% (Diabète équilibré). Bilan rénal (Créatininémie : 9.2 mg/L) satisfaisant.',
        cliches: 2,
        preview: '/dicom_blood_test.jpg'
      },
      {
        id: 505,
        title: 'Mammographie & Sénologie de dépistage',
        exam_type: 'Mammographie',
        badge: '🩻 SÉNOLOGIE DICOM',
        facility: 'Centre d\'Imagerie Dakar',
        doctor: 'Dr. Aïssatou Kane | Radiologue',
        date: '18 Déc 2025',
        conclusion: 'Incidence crânio-caudale et oblique externe bilatérale. Parenchyme bilatéral symétrique classé ACR-1.',
        cliches: 4,
        preview: '/dicom_mammography.jpg'
      },
      {
        id: 506,
        title: 'Radiographie osseuse tibia & membre inférieur',
        exam_type: 'Radiographie',
        badge: '🦴 TRAUMATOLOGIE HD',
        facility: 'Hôpital Abass Ndao',
        doctor: 'Dr. Ibrahima Faye | Orthopédiste',
        date: '02 Déc 2025',
        conclusion: 'Alignement osseux satisfaisant. Cal osseux de bonne qualité en voie de consolidation.',
        cliches: 3,
        preview: '/dicom_bone_fracture.jpg'
      }
    ];
  };

  const getHistoryForUser = (cmuNum, isStud, isBsfUser, fName) => {
    const name = (fName || '').toLowerCase();
    if (name.includes('amadou') || cmuNum === 'CSU-DKR-2026-8812.2') {
      return [
        { id: 1, date: '04/02/2026', acte: 'Urgence Orthopédie & Radiographie Tibia', praticien: 'Dr. Cheikh Anta Diop (Abass Ndao)', conclusion: 'Pose de plâtre pour fracture tibia sans déplacement.' },
        { id: 2, date: '01/02/2026', acte: 'Prise de Sang & Bilan Biologique Complet', praticien: 'Laboratoire Pasteur Dakar', conclusion: 'Examen hématologique et sérologique normal.' },
        { id: 3, date: '18/01/2026', acte: 'Consultation Télé-médecine Cardiologie', praticien: 'Dr. Cheikh Tidiane Seck', conclusion: 'Bilan tensionnel satisfaisant (120/80 mmHg).' },
        { id: 4, date: '05/01/2026', acte: 'Visite de Contrôle Médecine Générale', praticien: 'Dr. Ousmane Sow', conclusion: 'Aptitude physique générale confirmée.' }
      ];
    }
    if (name.includes('awa') || cmuNum === 'CMU-DKR-2026-3302') {
      return [
        { id: 1, date: '06/02/2026', acte: 'Télé-consultation Bilan Lipidique #TM-8812', praticien: 'Dr. Ousmane Sow (Télémédecine)', conclusion: 'Bilan lipidique rassurant et conseils hygiéno-diététiques.' },
        { id: 2, date: '20/12/2025', acte: 'Mammographie de Dépistage Systématique', praticien: 'Dr. Aïssatou Kane (Imagerie Dakar)', conclusion: 'Examen sénologique classé ACR-1.' },
        { id: 3, date: '10/11/2025', acte: 'Consultation Gynécologie & Prévention', praticien: 'Dr. Mariama Ba (Le Dantec)', conclusion: 'Frottis cervico-vaginal normal.' },
        { id: 4, date: '15/09/2025', acte: 'Examen de laboratoire (Bilan lipidique)', praticien: 'Laboratoire Examen Plus Dakar', conclusion: 'Cholestérol dans les limites de référence.' }
      ];
    }
    if (name.includes('ibrahima') || cmuNum === 'CSU-UCAD-2026-9012' || isStud) {
      return [
        { id: 1, date: '02/02/2026', acte: 'Bilan de Santé Universitaire & Aptitude', praticien: 'Dr. Ousmane Sow (Pavillon Santé UCAD)', conclusion: 'Aptitude physique & sportive confirmée.' },
        { id: 2, date: '10/01/2026', acte: 'Consultation Médecine du Sport UCAD', praticien: 'Dr. Cheikh Anta Diop', conclusion: 'Examen clinique sans anomalie.' },
        { id: 3, date: '15/12/2025', acte: 'Contrôle Ophtalmologique Étudiant UCAD', praticien: 'Dr. Ndèye Khady Cissé', conclusion: 'Acuité visuelle 10/10 aux deux yeux.' },
        { id: 4, date: '02/10/2025', acte: 'Vaccination Rappel Tétanos (PEV UCAD)', praticien: 'Service Médical UCAD', conclusion: 'Carnet de vaccination à jour.' }
      ];
    }
    if (name.includes('fatou') || cmuNum === 'CMU-DKR-2026-4401' || isBsfUser) {
      return [
        { id: 1, date: '05/02/2026', acte: 'Radiographie Pulmonaire de Contrôle', praticien: 'Dr. Ousmane Sow (Hôpital Fann)', conclusion: 'Imagerie pulmonaire satisfaisante.' },
        { id: 2, date: '14/04/2026', acte: 'Consultation Suivi Filet Social BSF', praticien: 'Dr. Mariama Ba (Le Dantec)', conclusion: 'Examen gynécologique et ordonnance gratuite émise.' },
        { id: 3, date: '12/02/2026', acte: 'Consultation Pédiatrique (Nouveau-Né PEV)', praticien: 'Dr. Aminata Ndiaye (Albert Royer)', conclusion: 'Vaccins BCG + Pentavalent 1 administrés.' },
        { id: 4, date: '08/01/2026', acte: 'Bilan Sanguin Prénatal CPN 3', praticien: 'Laboratoire Pasteur Dakar', conclusion: 'Taux d\'hémoglobine : 11.8 g/dL (Normal).' }
      ];
    }
    return [
      { id: 1, date: '12/03/2026', acte: 'Consultation Spécialisée Rachis & Scanner', praticien: 'Dr. Cheikh Anta Diop (Polyclinique Médina)', conclusion: 'Traitement antalgique pour discopathie.' },
      { id: 2, date: '15/01/2026', acte: 'Échocardiographie de Contrôle', praticien: 'Dr. Sy (Cardiologue SOS Médina)', conclusion: 'Fonction ventriculaire conservée.' },
      { id: 3, date: '10/01/2026', acte: 'Consultation Diabétologie & HbA1c', praticien: 'Dr. Salimata Thiam', conclusion: 'Équilibre glycémique satisfaisant (HbA1c = 5.8%).' },
      { id: 4, date: '02/12/2025', acte: 'Bilan lipidique & Créatininémie', praticien: 'Laboratoire Pasteur Dakar', conclusion: 'Fonction rénale et bilan lipidique normaux.' }
    ];
  };

  const [antecedents, setAntecedents] = useState(() => getAntecedentsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
  const [exams, setExams] = useState(() => getExamsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
  const [historyEntries, setHistoryEntries] = useState(() => getHistoryForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));

  useEffect(() => {
    try {
      const savedAnt = localStorage.getItem(`cmu-antecedents-${activeCmuNumber}`);
      setAntecedents(savedAnt ? JSON.parse(savedAnt) : getAntecedentsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));

      const savedExams = localStorage.getItem(`cmu-exams-${activeCmuNumber}`);
      const defaultExams = getExamsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName);
      setExams(savedExams ? JSON.parse(savedExams) : defaultExams);

      const savedHist = localStorage.getItem(`cmu-history-${activeCmuNumber}`);
      setHistoryEntries(savedHist ? JSON.parse(savedHist) : getHistoryForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
    } catch (e) {
      console.warn("Storage load error:", e);
    }
  }, [activeCmuNumber, activeFirstName, isStudent, isBsf]);

  const handleUpdateAntecedents = (updated) => {
    setAntecedents(updated);
    try {
      localStorage.setItem(`cmu-antecedents-${activeCmuNumber}`, JSON.stringify(updated));
    } catch (e) {}
  };

  const handleUpdateExams = (updatedExams) => {
    setExams(updatedExams);
    try {
      localStorage.setItem(`cmu-exams-${activeCmuNumber}`, JSON.stringify(updatedExams));
    } catch (e) {}
  };

  const handleUpdateHistory = (updatedHistory) => {
    setHistoryEntries(updatedHistory);
    try {
      localStorage.setItem(`cmu-history-${activeCmuNumber}`, JSON.stringify(updatedHistory));
    } catch (e) {}
  };

  // Modale Visionneuse DICOM
  const [viewingExam, setViewingExam] = useState(null);
  const [dicomZoom, setDicomZoom] = useState(1);
  const [dicomInvert, setDicomInvert] = useState(false);
  const [activeCliche, setActiveCliche] = useState(1);

  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamType, setNewExamType] = useState('Scanner');
  const [newExamFacility, setNewExamFacility] = useState('Laboratoire Pasteur Dakar');
  const [newExamDoctor, setNewExamDoctor] = useState('');
  const [newExamConclusion, setNewExamConclusion] = useState('');
  const [newExamCliches, setNewExamCliches] = useState(3);
  const [newExamFilePreview, setNewExamFilePreview] = useState('');
  const [newExamFileName, setNewExamFileName] = useState('');

  const handleDICOMFileUpload = (e, setPreview, setFileName) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => setPreview(event.target.result);
      reader.readAsDataURL(file);
    } else {
      const objUrl = URL.createObjectURL(file);
      setPreview(objUrl);
    }
  };

  const [showAddHistoryModal, setShowAddHistoryModal] = useState(false);
  const [newHistoryActe, setNewHistoryActe] = useState('');
  const [newHistoryPraticien, setNewHistoryPraticien] = useState('');
  const [newHistoryConclusion, setNewHistoryConclusion] = useState('');

  const handleAddHistory = (e) => {
    e.preventDefault();
    if (!newHistoryActe) return;
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('fr-FR'),
      acte: newHistoryActe,
      praticien: newHistoryPraticien || 'Non spécifié',
      conclusion: newHistoryConclusion || 'En attente de conclusions.'
    };
    handleUpdateHistory([newEntry, ...historyEntries]);
    setShowAddHistoryModal(false);
    setNewHistoryActe(''); setNewHistoryPraticien(''); setNewHistoryConclusion('');
    alert('✅ Entrée ajoutée à l\'historique médical !');
  };

  // Résultats Laboratoire Persistés & Isolés par assuré
  const getLabResultsForUser = (cmuNum, isStud, isBsfUser, fName) => {
    const name = (fName || '').toLowerCase();
    if (name.includes('amadou') || cmuNum === 'CSU-DKR-2026-8812.2') {
      return [
        { id: 1, examen: 'Hémoglobine & NFS (Bilan fracture)', resultat: '14.2 g/dL', reference: '12.0 - 16.5 g/dL', statut: 'Normal' },
        { id: 2, examen: 'Glycémie à jeun', resultat: '0.92 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' },
        { id: 3, examen: 'Vitesse de sédimentation (VS)', resultat: '8 mm', reference: '< 15 mm', statut: 'Normal' }
      ];
    }
    if (name.includes('awa') || cmuNum === 'CMU-DKR-2026-3302') {
      return [
        { id: 1, examen: 'Cholestérol total (Télémédecine)', resultat: '1.85 g/L', reference: '< 2.00 g/L', statut: 'Normal' },
        { id: 2, examen: 'Triglycérides', resultat: '1.10 g/L', reference: '< 1.50 g/L', statut: 'Normal' },
        { id: 3, examen: 'Glycémie à jeun', resultat: '0.88 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' }
      ];
    }
    if (name.includes('ibrahima') || cmuNum === 'CSU-UCAD-2026-9012' || isStud) {
      return [
        { id: 1, examen: 'Bilan sanguin de santé UCAD', resultat: '14.8 g/dL', reference: '12.0 - 16.0 g/dL', statut: 'Normal (UCAD)' },
        { id: 2, examen: 'Glycémie à jeun', resultat: '0.90 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' }
      ];
    }
    if (name.includes('fatou') || cmuNum === 'CMU-DKR-2026-4401' || isBsfUser) {
      return [
        { id: 1, examen: 'Glycémie à jeun BSF', resultat: '0.98 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' },
        { id: 2, examen: 'Profil lipidique & BSF', resultat: '1.80 g/L', reference: '< 2.00 g/L', statut: 'Normal' }
      ];
    }
    return [
      { id: 1, examen: 'Créatininémie', resultat: '9.2 mg/L', reference: '6.0 - 12.0 mg/L', statut: 'Normal' },
      { id: 2, examen: 'Glycémie à jeun', resultat: '0.95 g/L', reference: '0.70 - 1.10 g/L', statut: 'Normal' }
    ];
  };

  const [labResults, setLabResults] = useState(() => getLabResultsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));

  useEffect(() => {
    try {
      const savedLab = localStorage.getItem(`cmu-lab-${activeCmuNumber}`);
      setLabResults(savedLab ? JSON.parse(savedLab) : getLabResultsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
    } catch (e) {
      setLabResults(getLabResultsForUser(activeCmuNumber, isStudent, isBsf, activeFirstName));
    }
  }, [activeCmuNumber, activeFirstName, isStudent, isBsf]);

  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [newLabExamen, setNewLabExamen] = useState('');
  const [newLabResultat, setNewLabResultat] = useState('');
  const [newLabReference, setNewLabReference] = useState('');
  const [newLabStatut, setNewLabStatut] = useState('Normal');

  const handleAddExam = (e) => {
    e.preventDefault();
    if (!newExamTitle) return;
    const added = {
      id: Date.now(),
      title: newExamTitle,
      exam_type: newExamType,
      badge: (newExamType === 'Scanner' || newExamType === 'IRM' || newExamType === 'Radio') ? 'HD DICOM' : 'LABORATOIRE',
      facility: newExamFacility || partnerUser?.structureName || 'Laboratoire / Établissement de santé conventionné',
      doctor: newExamDoctor || 'Dr. Ousmane Kane (Biologiste)',
      date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
      conclusion: newExamConclusion || 'Examen DICOM certifié et conforme.',
      cliches: parseInt(newExamCliches) || 3,
      preview: newExamFilePreview || '/csu_dicom_xray.png'
    };
    const updated = [added, ...exams];
    handleUpdateExams(updated);
    
    // Global sync
    try {
      const globalExams = JSON.parse(localStorage.getItem('cmu-medical-exams') || '[]');
      localStorage.setItem('cmu-medical-exams', JSON.stringify([added, ...globalExams]));
    } catch (err) {}

    setShowAddExamModal(false);
    setNewExamTitle('');
    setNewExamDoctor('');
    setNewExamConclusion('');
    setNewExamFilePreview('');
    setNewExamFileName('');
    alert('✅ Examen certifié / Cliché DICOM créé avec succès !');
  };

  const handleSaveAntecedents = (e) => {
    e.preventDefault();
    setEditingAntecedents(false);
    alert("✅ Antécédents médicaux mis à jour et certifiés !");
  };

  const handleDownloadFullBooklet = () => {
    generateOfficialPdf({
      filename: `dossier_medical_partage_${activeLastName.toLowerCase()}.pdf`,
      docType: 'DOSSIER MÉDICAL PARTAGÉ CERTIFIÉ',
      title: 'Carnet de Santé Numérique & Bilan Médical',
      referenceNo: `DOSSIER-MED-${activeCmuNumber}`,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: 'Réseau Établissements Agréés Sénégal',
      details: [
        { label: 'Assurée Bénéficiaire', value: `${activeFirstName} ${activeLastName}` },
        { label: 'Groupe sanguin', value: `${antecedents.bloodGroup} (Rhésus positif)` },
        { label: 'Allergies & Alertes', value: antecedents.allergies },
        { label: 'Affections Longue Durée (ALD)', value: antecedents.chronicConditions },
        { label: 'Interventions Chirurgicales', value: antecedents.surgeries },
        { label: 'Examens DICOM Enregistrés', value: `${exams.length} examens certifiés (Scanner thoracique, IRM Cérébrale, Échocardiographie)` }
      ],
      notes: 'Ce dossier médical numérique est conforme aux normes d\'interopérabilité sanitaire du Sénégal (DHIS2 & CNOM).'
    });
  };

  const handleDownloadExam = (ex) => {
    generateOfficialPdf({
      filename: `examen_dicom_${ex.id}.pdf`,
      docType: 'COMPTE-RENDU D\'IMAGERIE RADIOLOGIQUE DICOM',
      title: `Rapport Radiologique Certifié — ${ex.title}`,
      referenceNo: `EXAM-DICOM-#${ex.id}`,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: ex.facility,
      details: [
        { label: 'Intitulé de l\'Examen', value: ex.title },
        { label: 'Établissement Emetteur', value: ex.facility },
        { label: 'Praticien Radiologue', value: ex.doctor },
        { label: 'Date de réalisation', value: ex.date },
        { label: 'Nombre de clichés HD', value: `${ex.cliches} clichés téléchargeables` },
        { label: 'Conclusion Diagnostique', value: ex.conclusion }
      ],
      notes: 'Rapport validé électroniquement sous le standard DICOM 3.0 HD par le médecin radiologue agréé.'
    });
  };

  // ── PHARMACIEN : accès refusé au dossier médical ──
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
                Dossier médical : accès non autorisé
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Pour des motifs de confidentialité médicale et de protection des données de santé du patient, l'accès au dossier médical complet est réservé aux médecins et soignants traitants.
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
                <img src="/csu_profile_hero_real.png" alt="Dossier médical patient UNAMUSC" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
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
                  🔒
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.08rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Confidentialité du dossier médical
                  </h5>
                  <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Loi N° 2008-12 sur les données personnelles
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                En tant que pharmacien d'officine, vos informations d'accès vous permettent d'inspecter les ordonnances prescrites et le taux de prise en charge CSU sans accéder aux antécédents médicaux confidentiels.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1rem' }}>💊</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Consultation des ordonnances</span>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                    🟢 Autorisé
                  </span>
                </div>

                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1rem' }}>📄</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Consultation des comptes-rendus & diagnostics</span>
                  </div>
                  <span className="badge bg-danger-subtle text-danger border border-danger px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                    🔴 Accès restreint
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

  // ── AGENT (non superadmin) : vue administrative uniquement ──
  if (isAdminView) {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          {/* ── Hero Banner Agent ── */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #1d4ed8 100%)', borderRadius: '20px', padding: '2rem 2.25rem', marginBottom: '1.75rem', position: 'relative', overflow: 'hidden', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(59,130,246,0.08)' }} />
            <div style={{ position: 'absolute', bottom: '-60px', left: '30%', width: '220px', height: '220px', borderRadius: '50%', background: 'rgba(59,130,246,0.05)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '0.75rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', boxShadow: '0 4px 14px rgba(59,130,246,0.3)' }}>🛡️</div>
                <div>
                  <h5 className="fw-bold mb-0" style={{ color: '#ffffff', fontSize: '1.15rem', letterSpacing: '-0.01em' }}>Mode agent administratif UNAMUSC</h5>
                  <small style={{ color: 'rgba(191,219,254,0.85)', fontSize: '0.78rem' }}>Contrôle administratif · Accès restreint au suivi</small>
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '5px 14px', marginTop: '0.25rem' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
                <small style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em' }}>SECRET MÉDICAL PROTÉGÉ</small>
              </div>
            </div>
          </div>

          {/* ── KPI Stat Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
            {/* Card 1: Dossier → Bénéficiaires */}
            <div onClick={() => setView ? setView('beneficiaries') : (window.location.hash = '#/beneficiaries')} style={{ background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-color)', padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = '#3b82f6'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(29,78,216,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid rgba(59,130,246,0.2)' }}>📂</div>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dossier CSU</small>
                </div>
                <span style={{ color: '#3b82f6', fontSize: '1.1rem', opacity: 0.6 }}>→</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.76rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  ACTIF
                </span>
              </div>
              <div style={{ marginTop: '0.75rem', padding: '6px 10px', background: 'var(--bg-card-subtle)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.68rem' }}>Réf: </small>
                  <code style={{ color: '#3b82f6', fontSize: '0.76rem', fontWeight: 700 }}>{activeCmuNumber}</code>
                </div>
                <small style={{ color: '#3b82f6', fontSize: '0.65rem', fontWeight: 600 }}>Voir le dossier ›</small>
              </div>
            </div>

            {/* Card 2: Examens → Structures de santé / vérification */}
            <div onClick={() => setView ? setView('verify') : (window.location.hash = '#/verify')} style={{ background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-color)', padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = '#10b981'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #10b981, #059669)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid rgba(16,185,129,0.2)' }}>🏥</div>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Examens médicaux</small>
                </div>
                <span style={{ color: '#10b981', fontSize: '1.1rem', opacity: 0.6 }}>→</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{exams.length}</span>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.72rem', fontWeight: 600 }}>certifiés</small>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.68rem' }}>Validés CNOM / UNAMUSC</small>
                <small style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 600 }}>Consulter ›</small>
              </div>
            </div>

            {/* Card 3: Historique → Tableau de bord */}
            <div onClick={() => setView ? setView('dashboard') : (window.location.hash = '#/dashboard')} style={{ background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-color)', padding: '1.5rem', position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s' }} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.2)'; e.currentTarget.style.borderColor = '#f59e0b'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid rgba(245,158,11,0.2)' }}>📊</div>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historique</small>
                </div>
                <span style={{ color: '#f59e0b', fontSize: '1.1rem', opacity: 0.6 }}>→</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{historyEntries.length}</span>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.72rem', fontWeight: 600 }}>consultations</small>
              </div>
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <small style={{ color: 'var(--text-sub)', fontSize: '0.68rem' }}>Enregistrées au système</small>
                <small style={{ color: '#f59e0b', fontSize: '0.65rem', fontWeight: 600 }}>Voir tout ›</small>
              </div>
            </div>
          </div>

          {/* ── Informations administratives assuré ── */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {/* Section Header */}
            <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1rem' }}>📄</span>
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Informations administratives de l'assuré</h5>
            </div>

            <div style={{ padding: '1.5rem 1.75rem' }}>
              {/* Patient identity row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '1.5rem', padding: '1.15rem 1.25rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 800, boxShadow: '0 4px 12px rgba(59,130,246,0.25)' }}>
                  {(activeFirstName || 'M')[0]}{(activeLastName || 'D')[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem', display: 'block', lineHeight: 1.3 }}>{activeFirstName} {activeLastName}</strong>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>Assuré social CSU — UNAMUSC Sénégal</small>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.65rem', display: 'block', marginBottom: '4px' }}>N° Carte CSU</small>
                  <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontSize: '0.76rem', fontWeight: 700, padding: '4px 12px', borderRadius: '8px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{activeCmuNumber}</span>
                </div>
              </div>

              {/* Security notice */}
              <div style={{ padding: '1rem 1.25rem', borderRadius: '14px', border: '1px solid rgba(59,130,246,0.2)', background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(29,78,216,0.03))', borderLeft: '4px solid #3b82f6' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem', marginTop: '2px' }}>🔒</div>
                  <div>
                    <strong style={{ color: '#60a5fa', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>Contenu médical protégé par le secret médical</strong>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem', lineHeight: '1.55', display: 'block' }}>
                      Le groupe sanguin, les allergies, les radiographies DICOM et résultats de laboratoire sont protégés par le secret médical. Seuls les professionnels de santé habilités (médecins, sages-femmes) peuvent y accéder.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── NON CONNECTÉ : écran d'accès sécurisé ──
  if (!citizenUser && !agentUser && !partnerUser && userRole !== 'agent' && userRole !== 'partner' && userRole !== 'doctor' && userRole !== 'midwife' && userRole !== 'superadmin') {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Header Banner */}
          <div className="p-5 rounded-4 text-center text-white mb-4" style={{
            background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.82) 0%, rgba(4, 120, 87, 0.88) 100%), url("/csu_profile_hero_real.png") center/cover no-repeat',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🩺</div>
            <span className="badge mb-2" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 'bold' }}>
              Dossier médical partagé & radiographies DICOM
            </span>
            <h2 className="fw-bold mb-2" style={{ color: '#fff', fontSize: '2rem' }}>
              Espace confidentialité — données médicales protégées
            </h2>
            <p className="small mb-4" style={{ color: '#ecfdf5', maxWidth: '680px', margin: '0 auto', lineHeight: '1.6', fontSize: '0.95rem' }}>
              Les données contenues dans le dossier médical partagé (groupe sanguin, allergies, radiographies certifiées, examens de laboratoire) sont protégées par le secret médical. Veuillez vous connecter ou saisir votre code d'accès sécurisé.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-light fw-bold px-4 py-3" 
                style={{ borderRadius: '14px', color: '#047857', fontSize: '0.98rem', boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }}
                onClick={() => (window.location.hash = '#/login')}
              >
                🔐 Se connecter à mon dossier médical
              </button>
            </div>
          </div>

          {/* Quick OTP / CMU Card Verification */}
          <div className="card p-4 p-md-5 mb-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '2.25rem 2rem' }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.75rem' }}>
              🔑 Accès praticien avec code OTP 24h ou n° CMU
            </h4>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-sub)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
              Si un patient vous a transmis un code de partage temporaire, saisissez son matricule d'assuré et le jeton OTP pour accéder à ses examens.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input 
                type="text" 
                className="form-control fw-bold" 
                placeholder="N° CMU (ex: CMU-DKR-2026-8812)"
                style={{ flex: 1, minWidth: '220px', height: '52px', fontSize: '0.95rem', borderRadius: '12px' }}
              />
              <input 
                type="text" 
                className="form-control fw-bold" 
                placeholder="Code OTP (ex: 849-201)"
                style={{ width: '180px', height: '52px', fontSize: '0.95rem', borderRadius: '12px' }}
              />
              <button 
                className="btn btn-success fw-bold px-4 py-3"
                style={{ borderRadius: '12px', background: '#059669', height: '52px', fontSize: '0.95rem' }}
                onClick={() => (window.location.hash = '#/login')}
              >
                🔓 Déverrouiller le dossier
              </button>
            </div>
          </div>

          {/* Standards & Certifications Grid */}
          <div className="grid grid-3" style={{ gap: '1.25rem' }}>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📁</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Interopérabilité DHIS2</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Dossier synchronisé avec le Système National d'Information Sanitaire du Ministère de la Santé du Sénégal.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🩻</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Clichés HD DICOM 3.0</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Visualisation haute définition des scanners, IRM et radiographies certifiées par des praticiens agréés.</p>
            </div>
            <div className="card p-3 text-left" style={{ borderRadius: '16px', background: 'var(--bg-card-subtle)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🛡️</div>
              <h5 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.25rem' }}>Chiffrement AES-256</h5>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', margin: 0 }}>Vos données personnelles de santé sont cryptées et inaccessibles sans votre autorisation préalable.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

  if (isCitizen && isSuspended) {
    return (
      <div className="medical-profile-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès au dossier restreint : Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. La consultation de votre dossier médical partagé et la délivrance d'actes sont suspendues.
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
                    cmuNumber: activeCmuNumber,
                    amount: 10500,
                    familyCount: 3,
                    firstName: activeFirstName,
                    lastName: activeLastName
                  }));
                  window.location.hash = '#payments';
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
    <div className="medical-profile-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* Subnav Header Bar */}
      <div style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '1.25rem 2.5rem', marginBottom: '1rem' }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.75rem', rowGap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Dossier médical partagé 🇸🇳</h5>
            <span className="d-none d-md-inline-block" style={{ height: '24px', width: '1.5px', background: 'var(--border-color)' }} />
            
            <div className="d-flex align-items-center flex-wrap" style={{ gap: '1rem', rowGap: '1rem', background: 'var(--bg-card)', padding: '0.65rem 0.95rem', borderRadius: '20px', border: '1.5px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
              <button 
                type="button"
                className="hover-lift"
                style={{ 
                  background: activeTab === 'overview' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent', 
                  color: activeTab === 'overview' ? '#ffffff' : 'var(--text-sub)', 
                  border: 'none', 
                  borderRadius: '14px', 
                  padding: '0.7rem 1.55rem', 
                  fontWeight: '750', 
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  margin: 0,
                  boxShadow: activeTab === 'overview' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }} 
                onClick={() => setActiveTab('overview')}
              >
                Vue d'ensemble
              </button>

              <button 
                type="button"
                className="hover-lift"
                style={{ 
                  background: activeTab === 'history' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent', 
                  color: activeTab === 'history' ? '#ffffff' : 'var(--text-sub)', 
                  border: 'none', 
                  borderRadius: '14px', 
                  padding: '0.7rem 1.55rem', 
                  fontWeight: '750', 
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  margin: 0,
                  boxShadow: activeTab === 'history' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }} 
                onClick={() => setActiveTab('history')}
              >
                Historique
              </button>

              <button 
                type="button"
                className="hover-lift"
                style={{ 
                  background: activeTab === 'lab' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent', 
                  color: activeTab === 'lab' ? '#ffffff' : 'var(--text-sub)', 
                  border: 'none', 
                  borderRadius: '14px', 
                  padding: '0.7rem 1.55rem', 
                  fontWeight: '750', 
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  margin: 0,
                  boxShadow: activeTab === 'lab' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }} 
                onClick={() => setActiveTab('lab')}
              >
                Laboratoire
              </button>

              {/* Boutons adaptés selon le sexe du patient */}
              {isFemalePatient ? (
                <>
                  <button 
                    type="button"
                    className="hover-lift"
                    style={{ 
                      background: activeTab === 'maternity' ? 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)' : 'transparent', 
                      color: activeTab === 'maternity' ? '#ffffff' : 'var(--text-sub)', 
                      border: 'none', 
                      borderRadius: '14px', 
                      padding: '0.7rem 1.45rem', 
                      fontWeight: '750', 
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      margin: 0,
                      boxShadow: activeTab === 'maternity' ? '0 4px 14px rgba(219, 39, 119, 0.4)' : 'none',
                      transition: 'all 0.2s ease'
                    }} 
                    onClick={() => setActiveTab('maternity')}
                  >
                    🤰 Maternité & Grossesse
                  </button>

                  <button 
                    type="button"
                    className="hover-lift"
                    style={{ 
                      background: activeTab === 'maternity_pathology' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent', 
                      color: activeTab === 'maternity_pathology' ? '#ffffff' : 'var(--text-sub)', 
                      border: 'none', 
                      borderRadius: '14px', 
                      padding: '0.7rem 1.45rem', 
                      fontWeight: '750', 
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      margin: 0,
                      boxShadow: activeTab === 'maternity_pathology' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                      transition: 'all 0.2s ease'
                    }} 
                    onClick={() => setActiveTab('maternity_pathology')}
                  >
                    🩺 Pathologies & Spécialités
                  </button>
                </>
              ) : (
                <button 
                  type="button"
                  className="hover-lift"
                  style={{ 
                    background: activeTab === 'maternity_pathology' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent', 
                    color: activeTab === 'maternity_pathology' ? '#ffffff' : 'var(--text-sub)', 
                    border: 'none', 
                    borderRadius: '14px', 
                    padding: '0.7rem 1.55rem', 
                    fontWeight: '750', 
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    margin: 0,
                    boxShadow: activeTab === 'maternity_pathology' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                    transition: 'all 0.2s ease'
                  }} 
                  onClick={() => setActiveTab('maternity_pathology')}
                >
                  🩺 Spécialités & pathologies suivies
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Rechercher un examen..." 
              style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', padding: '0.75rem 1.25rem', fontSize: '0.9rem', width: '260px' }} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1440px', margin: '2.5rem auto 0 auto', padding: '0 2rem' }}>
        
        {/* Barre de Sélection / Répertoire multi-patients pour les professionnels & laboratoire */}
        {!isCitizen && (
          <div className="rounded-4 mb-5" style={{ background: 'var(--bg-card)', border: '1.5px solid #10b981', borderRadius: '26px', padding: '2rem 2.25rem', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
            <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: '1.75rem', rowGap: '1.75rem' }}>
              <div className="d-flex align-items-center gap-4">
                <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.55rem', fontWeight: 'bold', flexShrink: 0, boxShadow: '0 4px 14px rgba(16,185,129,0.22)' }}>
                  📂
                </div>
                <div>
                  <h6 className="fw-extrabold mb-1.5" style={{ color: 'var(--text-main)', fontSize: '1.15rem', lineHeight: '1.4' }}>
                    Dossier assuré sélectionné : <span className="text-primary">{activeFirstName} {activeLastName}</span> ({activeCmuNumber})
                  </h6>
                  <small className="text-muted d-block" style={{ fontSize: '0.88rem' }}>
                    {currentPatientObj.packageType || '80% UNAMUSC'} • {currentPatientObj.doctor || 'Médecin référent'}
                  </small>
                </div>
              </div>

              <div className="d-flex align-items-center flex-wrap" style={{ gap: '1.25rem', rowGap: '1.25rem' }}>
                <select 
                  className="form-select fw-bold py-3 px-4" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid #10b981', borderRadius: '14px', fontSize: '0.92rem', minWidth: '350px', maxWidth: '100%' }}
                  value={selectedPatientCmu}
                  onChange={(e) => setSelectedPatientCmu(e.target.value)}
                >
                  {facilityPatients.map(p => (
                    <option key={p.cmuNumber} value={p.cmuNumber}>
                      👤 {p.firstName} {p.lastName} ({p.cmuNumber}) — {p.lastExam}
                    </option>
                  ))}
                </select>

                <button 
                  type="button"
                  className="btn fw-bold text-white px-4 py-3 hover-lift" 
                  style={{ background: '#059669', border: 'none', borderRadius: '14px', fontSize: '0.92rem', boxShadow: '0 4px 15px rgba(5,150,105,0.3)', whiteSpace: 'nowrap', margin: 0 }}
                  onClick={() => setShowPatientDirectoryModal(true)}
                >
                  📋 Voir tout le répertoire ({facilityPatients.length} assurés)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Hero Card Banner */}
        <div className="rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.42) 0%, rgba(16, 185, 129, 0.24) 100%), url("/csu_profile_hero_real.png") center/cover no-repeat', padding: '3.5rem 3rem', minHeight: '240px', borderRadius: '28px', border: '1.5px solid rgba(255, 255, 255, 0.3)', boxShadow: '0 18px 50px rgba(0, 0, 0, 0.22)', overflow: 'hidden' }}>
          <div className="d-flex flex-wrap gap-4" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 320px' }}>
              <span style={{ background: 'rgba(255, 255, 255, 0.22)', color: '#ffffff', padding: '0.5rem 1.15rem', borderRadius: '20px', fontSize: '0.88rem', fontWeight: '750', display: 'inline-block', marginBottom: '1.15rem', border: '1px solid rgba(255,255,255,0.35)' }}>
                🇸🇳 Certifié CNOM & UNAMUSC Sénégal
              </span>
              <h1 className="fw-extrabold text-white mb-3" style={{ fontSize: '2.3rem', letterSpacing: '-0.015em' }}>Dossier médical & radiographies certifiées</h1>
              <p className="text-white mb-0" style={{ fontSize: '1.08rem', maxWidth: '780px', lineHeight: '1.75', opacity: 0.95 }}>
                {isCitizen && 'Accédez en toute sécurité à vos antécédents, vos résultats de radiologie et téléchargez votre carnet de santé numérique certifié.'}
                {(isDoctor || isMidwife) && `Mode ${isDoctor ? 'médecin prescripteur' : 'sage-femme'} : Vous pouvez consulter, annoter et enrichir le dossier de votre patient.`}
                {isLabUser && 'Mode Laboratoire & Biologie : Téléversement et certification des comptes-rendus d\'analyses (PDF) et clichés d\'imagerie (DICOM).'}
                {isSuperAdmin && 'SuperAdmin : Accès total et contrôle complet du dossier médical partagé UNAMUSC.'}
              </p>
            </div>

            {/* Boutons d'action selon le rôle */}
            <div className="d-flex flex-column gap-4 w-100 mt-4" style={{ flex: '1 1 100%' }}>
              <div className="d-flex flex-wrap align-items-center" style={{ gap: '1.5rem', rowGap: '1.25rem' }}>
                {/* Télécharger PDF — disponible à tous les profils autorisés */}
                <button
                  type="button"
                  className="hover-lift"
                  style={{ background: '#ffffff', color: '#047857', border: 'none', borderRadius: '14px', padding: '1rem 1.75rem', fontWeight: '800', fontSize: '0.94rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0, 0, 0, 0.18)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}
                  onClick={handleDownloadFullBooklet}
                >
                  📥 Télécharger le carnet PDF
                </button>

                {/* Partager avec mon médecin — exclusivement réservé à l'assuré (Citoyen) */}
                {isCitizen && (
                  <button
                    type="button"
                    className="hover-lift"
                    style={{ background: 'rgba(255,255,255,0.22)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '14px', padding: '1rem 1.75rem', fontWeight: '750', fontSize: '0.94rem', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}
                    onClick={() => setShowShareModal(true)}
                  >
                    🔗 Partager avec mon médecin
                  </button>
                )}

                {/* Ajouter un examen — médecin, laboratoire, sage-femme, superadmin */}
                {canAddLabExam && (
                  <button
                    type="button"
                    className="hover-lift"
                    style={{ background: 'rgba(255,255,255,0.22)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '14px', padding: '1rem 1.75rem', fontWeight: '800', fontSize: '0.94rem', cursor: 'pointer', backdropFilter: 'blur(6px)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}
                    onClick={() => setShowAddExamModal(true)}
                  >
                    ➕ Ajouter un examen DICOM / rapport PDF
                  </button>
                )}

                {/* Badge de rôle */}
                {isCitizen && (
                  <span style={{ background: 'rgba(0,0,0,0.35)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '14px', padding: '0.8rem 1.35rem', fontSize: '0.88rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    🔒 Lecture seule : modifications par votre médecin
                  </span>
                )}

                {isLabUser && (
                  <span style={{ background: 'rgba(2, 132, 199, 0.35)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '14px', padding: '0.8rem 1.35rem', fontSize: '0.88rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    🧪 Mode Laboratoire & Biologie : Édition des examens & DICOM
                  </span>
                )}

                {(isDoctor || isMidwife) && (
                  <span style={{ background: 'rgba(0,0,0,0.3)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.35)', borderRadius: '14px', padding: '0.8rem 1.35rem', fontSize: '0.88rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    📝 Mode {isDoctor ? 'médecin prescripteur' : 'sage-femme'} : édition autorisée
                  </span>
                )}

                {isSuperAdmin && (
                  <span style={{ background: 'rgba(234,179,8,0.35)', color: '#fef08a', border: '1px solid rgba(234,179,8,0.5)', borderRadius: '14px', padding: '0.8rem 1.35rem', fontSize: '0.88rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    👑 SuperAdmin : accès total
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* TAB 1: VUE D'ENSEMBLE */}
        {activeTab === 'overview' && (
          <div className="row g-4 mb-5" style={{ rowGap: '3rem' }}>
            
            {/* Left Column Cards */}
            <div className="col-lg-4 col-12">
              <div className="d-flex flex-column" style={{ gap: '2.75rem' }}>
                
                {/* Groupe sanguin Card */}
                <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '26px', padding: '2.25rem 2rem', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="d-flex align-items-center gap-3 text-danger">
                      <span style={{ fontSize: '1.6rem' }}>🩸</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Groupe sanguin</h6>
                    </div>
                    <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1.5px solid rgba(239, 68, 68, 0.35)', padding: '0.45rem 1rem', borderRadius: '14px', fontSize: '0.82rem', fontWeight: '800' }}>Urgent</span>
                  </div>

                  <div className="d-flex align-items-center justify-content-center gap-4 my-4 p-4 rounded-4" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid rgba(239, 68, 68, 0.22)', borderRadius: '22px', padding: '1.75rem' }}>
                    <h1 className="fw-black text-danger mb-0" style={{ fontSize: '3.8rem', letterSpacing: '-0.03em', lineHeight: 1 }}>{antecedents.bloodGroup}</h1>
                    <div>
                      <div className="fw-bold" style={{ color: 'var(--text-main)', fontSize: '1.15rem', marginBottom: '0.4rem' }}>Rhésus {antecedents.rhesus}</div>
                      <small style={{ color: 'var(--text-sub)', fontSize: '0.88rem', fontWeight: '600' }}>Groupe sanguin certifié</small>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-3 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
                    <span style={{ fontSize: '1.3rem' }}>🏥</span>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                      Certifié par : <strong style={{ color: 'var(--text-main)' }}>Laboratoire Bio24, Dakar</strong>
                    </small>
                  </div>
                </div>

                {/* Allergies & alertes Card */}
                <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '26px', padding: '2.25rem 2rem', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="d-flex align-items-center gap-3 text-warning">
                      <span style={{ fontSize: '1.6rem' }}>⚠️</span>
                      <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Allergies & alertes</h6>
                    </div>
                    {isDoctorOrAgent ? (
                      <button 
                        type="button" 
                        className="btn btn-sm btn-outline-success fw-bold px-4 py-2.5 hover-lift"
                        style={{ borderRadius: '14px', fontSize: '0.86rem' }}
                        onClick={() => setEditingAntecedents(!editingAntecedents)}
                      >
                        {editingAntecedents ? '✕ Fermer' : '✏️ Éditer (Médecin)'}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--text-sub)', fontSize: '0.84rem', fontStyle: 'italic' }}>
                        🔒 Mis à jour par le médecin
                      </span>
                    )}
                  </div>

                  {editingAntecedents ? (
                    <form onSubmit={handleSaveAntecedents} className="d-flex flex-column" style={{ gap: '1.5rem' }}>
                      <div>
                        <label className="small fw-bold d-block mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>⚠️ Allergies (médicaments, aliments, environnement) :</label>
                        <textarea className="form-control" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.94rem', padding: '0.95rem 1.2rem' }} value={antecedents.allergies} onChange={(e) => setAntecedents({ ...antecedents, allergies: e.target.value })} placeholder="Ex: Pénicilline (sévère), Pollen, Arachide..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>🏥 Affections longue durée (ALD) :</label>
                        <textarea className="form-control" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.94rem', padding: '0.95rem 1.2rem' }} value={antecedents.chronicConditions} onChange={(e) => setAntecedents({ ...antecedents, chronicConditions: e.target.value })} placeholder="Ex: HTA, Diabète type 2, Drépanocytose..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>🔧 Interventions chirurgicales :</label>
                        <textarea className="form-control" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.94rem', padding: '0.95rem 1.2rem' }} value={antecedents.surgeries || ''} onChange={(e) => setAntecedents({ ...antecedents, surgeries: e.target.value })} placeholder="Ex: Appendicectomie (2021), Césarienne (2018)..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>💊 Traitement en cours :</label>
                        <textarea className="form-control" rows={2} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.94rem', padding: '0.95rem 1.2rem' }} value={antecedents.currentTreatment || ''} onChange={(e) => setAntecedents({ ...antecedents, currentTreatment: e.target.value })} placeholder="Ex: Amlodipine 5mg (HTA), Metformine 500mg..." />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>💉 Vaccinations à jour :</label>
                        <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.94rem', padding: '0.95rem 1.2rem' }} value={antecedents.vaccinations || ''} onChange={(e) => setAntecedents({ ...antecedents, vaccinations: e.target.value })} placeholder="Ex: VAT à jour, Grippe 2025, COVID-3 doses" />
                      </div>
                      <div>
                        <label className="small fw-bold d-block mb-2.5" style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>📞 Contact d'urgence :</label>
                        <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.94rem', padding: '0.95rem 1.2rem' }} value={antecedents.emergencyContact || ''} onChange={(e) => setAntecedents({ ...antecedents, emergencyContact: e.target.value })} placeholder="Ex: Sokhna Diop (Épouse) : +221 77 987 65 43" />
                      </div>
                      <button type="submit" className="btn btn-emerald text-white fw-bold py-3.5 mt-2 hover-lift" style={{ background: '#10b981', border: 'none', borderRadius: '16px', fontSize: '0.96rem', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>💾 Sauvegarder et certifier</button>
                    </form>
                  ) : (
                    <div className="d-flex flex-column" style={{ gap: '1.35rem' }}>
                      {antecedents.allergies.split(',').map((alg, idx) => (
                        <div key={`alg-${idx}`} className="p-3.5 d-flex align-items-center gap-3" style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1.5px solid rgba(245, 158, 11, 0.25)', borderRadius: '18px', padding: '1.2rem 1.45rem' }}>
                          <span className="text-warning font-monospace" style={{ fontSize: '1.35rem' }}>●</span>
                          <span className="fw-bold small" style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>{alg.trim()}</span>
                        </div>
                      ))}
                      {antecedents.chronicConditions && (
                        <div className="p-3.5" style={{ background: 'rgba(220, 38, 38, 0.06)', border: '1.5px solid rgba(220, 38, 38, 0.2)', borderRadius: '18px', padding: '1.2rem 1.45rem' }}>
                          <span className="fw-bold text-danger d-inline-block me-2" style={{ fontSize: '0.9rem' }}>🩺 Affection longue durée (ALD) : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>{antecedents.chronicConditions}</span>
                        </div>
                      )}
                      {antecedents.surgeries && (
                        <div className="p-3.5" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '18px', padding: '1.2rem 1.45rem' }}>
                          <span className="fw-bold text-secondary d-inline-block me-2" style={{ fontSize: '0.9rem' }}>🔧 Interventions chirurgicales : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>{antecedents.surgeries}</span>
                        </div>
                      )}
                      {antecedents.currentTreatment && (
                        <div className="p-3.5" style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1.5px solid rgba(59, 130, 246, 0.2)', borderRadius: '18px', padding: '1.2rem 1.45rem' }}>
                          <span className="fw-bold text-primary d-inline-block me-2" style={{ fontSize: '0.9rem' }}>💊 Traitements en cours : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>{antecedents.currentTreatment}</span>
                        </div>
                      )}
                      {antecedents.vaccinations && (
                        <div className="p-3.5" style={{ background: 'rgba(16, 185, 129, 0.06)', border: '1.5px solid rgba(16, 185, 129, 0.2)', borderRadius: '18px', padding: '1.2rem 1.45rem' }}>
                          <span className="fw-bold text-success d-inline-block me-2" style={{ fontSize: '0.9rem' }}>💉 Statut vaccinal : </span>
                          <span className="small fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>{antecedents.vaccinations}</span>
                        </div>
                      )}
                      {antecedents.emergencyContact && (
                        <div className="p-3.5 d-flex align-items-center gap-3.5" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid rgba(239, 68, 68, 0.3)', borderRadius: '20px', padding: '1.3rem 1.5rem' }}>
                          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: '#ef4444', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.45rem', flexShrink: 0, boxShadow: '0 4px 15px rgba(239,68,68,0.35)' }}>
                            📞
                          </div>
                          <div>
                            <small className="fw-extrabold text-danger d-block mb-1" style={{ fontSize: '0.85rem' }}>
                              Contact d'urgence :
                            </small>
                            <span className="small fw-bold d-block" style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: '1.45' }}>
                              {antecedents.emergencyContact}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Interopérabilité Card */}
                <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '26px', padding: '2.25rem 2rem', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
                  <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                    <span style={{ fontSize: '1.6rem' }}>🌐</span>
                    <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>Interopérabilité DHIS2</h6>
                  </div>

                  <div className="d-flex flex-column" style={{ gap: '1.5rem' }}>
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '20px', padding: '1.35rem 1.5rem' }}>
                      <div className="d-flex align-items-center gap-3.5">
                        <div style={{ width: '46px', height: '46px', background: '#059669', color: '#ffffff', fontWeight: '800', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}>F</div>
                        <div>
                          <strong className="d-block text-main fw-bold" style={{ color: 'var(--text-main)', fontSize: '1.02rem', marginBottom: '0.3rem' }}>Hôpital Fann</strong>
                          <span className="fw-semibold text-muted d-block" style={{ fontSize: '0.86rem' }}>ID DHIS2 : FANN-77291</span>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.35)', borderRadius: '12px', padding: '0.5rem 1.1rem', fontSize: '0.84rem', fontWeight: '800' }}>✓ Synchronisé</span>
                    </div>

                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '20px', padding: '1.35rem 1.5rem' }}>
                      <div className="d-flex align-items-center gap-3.5">
                        <div style={{ width: '46px', height: '46px', background: '#dc2626', color: '#ffffff', fontWeight: '800', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0, boxShadow: '0 4px 14px rgba(220,38,38,0.35)' }}>LD</div>
                        <div>
                          <strong className="d-block text-main fw-bold" style={{ color: 'var(--text-main)', fontSize: '1.02rem', marginBottom: '0.3rem' }}>Le Dantec</strong>
                          <span className="fw-semibold text-muted d-block" style={{ fontSize: '0.86rem' }}>ID DHIS2 : LD-091823</span>
                        </div>
                      </div>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1.5px solid rgba(16,185,129,0.35)', borderRadius: '12px', padding: '0.5rem 1.1rem', fontSize: '0.84rem', fontWeight: '800' }}>✓ Synchronisé</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Radiographies & examens certifiés Grid */}
            <div className="col-lg-8 col-12">
              <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px', padding: '2.5rem 2.25rem', boxShadow: '0 12px 35px rgba(0,0,0,0.08)' }}>
                
                <div className="d-flex justify-content-between align-items-center mb-4 pb-3.5 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-3.5">
                    <span style={{ fontSize: '1.75rem' }}>🩻</span>
                    <div>
                      <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.35rem' }}>Radiographies & examens certifiés</h5>
                      <small className="text-muted" style={{ fontSize: '0.88rem' }}>Imagerie médicale HD, examens DICOM 3.0 & comptes-rendus certifiés</small>
                    </div>
                  </div>
                </div>

                {/* Exam Cards Grid */}
                <div className="row g-4" style={{ rowGap: '2.5rem' }}>
                  {exams.filter(ex => {
                    if (!searchTerm.trim()) return true;
                    const q = searchTerm.toLowerCase();
                    return ex.title.toLowerCase().includes(q) || ex.exam_type.toLowerCase().includes(q) || ex.facility.toLowerCase().includes(q) || (ex.doctor && ex.doctor.toLowerCase().includes(q));
                  }).map(ex => (
                    <div key={ex.id} className="col-md-6 mb-4">
                      <div className="h-100 d-flex flex-column justify-content-between hover-lift shadow-sm" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '26px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', transition: 'all 0.25s ease' }}>
                        
                        {/* Image Thumbnail Banner */}
                        <div style={{ height: '210px', position: 'relative', overflow: 'hidden', background: '#0b1120' }}>
                          <img src={ex.preview} alt={ex.title} onError={(e) => { e.target.src = '/csu_digital_health_real.jpg'; }} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)', pointerEvents: 'none' }} />
                          <span style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', border: '1.5px solid rgba(255,255,255,0.4)', padding: '0.5rem 1.15rem', borderRadius: '16px', fontSize: '0.82rem', fontWeight: '800', position: 'absolute', top: '14px', right: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.4)' }}>
                            {ex.badge}
                          </span>
                          <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', backdropFilter: 'blur(8px)', padding: '0.4rem 0.95rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '750', position: 'absolute', bottom: '14px', left: '14px' }}>
                            📅 {ex.date}
                          </span>
                        </div>

                        <div className="p-4 flex-grow-1" style={{ padding: '2rem 1.75rem' }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)', padding: '0.35rem 0.85rem', borderRadius: '10px', fontSize: '0.76rem', fontWeight: '750' }}>
                              {ex.exam_type}
                            </span>
                            <small className="text-muted fw-bold" style={{ fontSize: '0.8rem' }}>{ex.cliches} cliché{ex.cliches > 1 ? 's' : ''} HD</small>
                          </div>
                          <h6 className="fw-extrabold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.2rem', lineHeight: '1.45' }}>{ex.title}</h6>
                          <small className="text-muted d-block mb-3.5" style={{ fontSize: '0.88rem' }}>🏥 {ex.facility} • 🩺 {ex.doctor}</small>
                          <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '18px', padding: '1.25rem 1.45rem' }}>
                            <small className="fw-bold text-muted d-block mb-1" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Conclusion clinique certifiée :</small>
                            <p className="mb-0 fw-semibold" style={{ fontSize: '0.92rem', lineHeight: '1.65', color: 'var(--text-main)' }}>{ex.conclusion}</p>
                          </div>
                        </div>

                        <div className="border-top d-flex align-items-center justify-content-between flex-wrap" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)', padding: '1.35rem 1.75rem', gap: '1rem', rowGap: '0.85rem' }}>
                          <div className="d-flex align-items-center flex-wrap" style={{ gap: '0.85rem' }}>
                            <button 
                              type="button" 
                              className="btn fw-bold hover-lift text-white"
                              style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none', borderRadius: '14px', fontSize: '0.88rem', padding: '0.75rem 1.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)' }}
                              onClick={() => setViewingExam(ex)}
                            >
                              🩻 Visionner Cliché DICOM
                            </button>
                            
                            <button 
                              type="button" 
                              className="btn fw-bold hover-lift"
                              style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', padding: '0.75rem 1.25rem', fontSize: '0.88rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                              onClick={() => handleDownloadExam(ex)}
                              title="Télécharger le rapport certifié PDF (🇸🇳)"
                            >
                              📥 Rapport PDF
                            </button>
                          </div>

                          {canAddLabExam && (
                            <div className="d-flex align-items-center" style={{ gap: '0.65rem' }}>
                              <button 
                                type="button" 
                                className="btn btn-sm btn-outline-primary fw-bold hover-lift"
                                style={{ borderRadius: '12px', fontSize: '0.84rem', padding: '0.6rem 0.95rem' }}
                                onClick={() => setEditingExamTarget({ ...ex })}
                                title="Modifier l'examen / DICOM"
                              >
                                ✏️ Éditer
                              </button>
                              
                              <button 
                                type="button" 
                                className="btn btn-sm fw-bold hover-lift"
                                style={{ 
                                  background: 'rgba(239, 68, 68, 0.12)', 
                                  color: '#ef4444', 
                                  border: '1.5px solid rgba(239, 68, 68, 0.35)', 
                                  borderRadius: '12px', 
                                  padding: '0.6rem 0.95rem', 
                                  fontSize: '0.84rem', 
                                  cursor: 'pointer'
                                }}
                                onClick={() => setDeleteConfirmTarget({
                                  title: ex.title,
                                  itemType: "l'examen certifié / cliché DICOM",
                                  onConfirm: () => {
                                    const updated = exams.filter(e => e.id !== ex.id);
                                    setExams(updated);
                                    try { localStorage.setItem('cmu-medical-exams', JSON.stringify(updated)); } catch (err) {}
                                    setDeleteConfirmTarget(null);
                                  }
                                })}
                                title="Supprimer cet examen"
                              >
                                🗑️ Supprimer
                              </button>
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  ))}

                  {/* Add New Exam Card — Médecin, Laborantin, Sage-femme, SuperAdmin */}
                  {canAddLabExam && (
                    <div className="col-md-6 mb-3">
                      <div 
                        className="h-100 d-flex flex-column align-items-center justify-content-center text-center hover-lift"
                        style={{ 
                          background: 'var(--bg-card-subtle)', 
                          border: '2.5px dashed #10b981', 
                          borderRadius: '24px',
                          cursor: 'pointer',
                          minHeight: '300px',
                          padding: '3.25rem 2rem',
                          gap: '1.5rem',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => setShowAddExamModal(true)}
                      >
                        <div style={{ width: '68px', height: '68px', borderRadius: '22px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', fontWeight: '700', boxShadow: '0 6px 20px rgba(16,185,129,0.25)' }}>
                          ➕
                        </div>
                        <div className="d-flex flex-column align-items-center gap-2 text-center">
                          <strong className="fw-extrabold d-block" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>
                            Ajouter un examen DICOM / rapport PDF
                          </strong>
                          <span className="small text-muted d-block fw-semibold" style={{ fontSize: '0.94rem' }}>
                            (Cliché radio, IRM, scanner ou bilan labo)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            </div>

          </div>
        )}

        {/* TAB 2: HISTORIQUE MÉDICAL */}
        {activeTab === 'history' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>📜 Historique médical complet</h5>
              {canEditMedical && (
                <button 
                  type="button" 
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                  onClick={() => setShowAddHistoryModal(true)}
                >
                  ➕ Ajouter une entrée
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Date</th>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Acte / Consultation</th>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Praticien / Structure</th>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Conclusion</th>
                    {canEditMedical && <th className="text-end" style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.map(h => (
                    <tr key={h.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ color: 'var(--text-sub)' }}>{h.date}</td>
                      <td className="fw-bold" style={{ color: 'var(--text-main)' }}>{h.acte}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{h.praticien}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{h.conclusion}</td>
                      {canEditMedical && (
                        <td className="text-end">
                          <button 
                            type="button" 
                            style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => {
                              setDeleteConfirmTarget({
                                title: h.acte,
                                itemType: 'Historique médical',
                                onConfirm: () => setHistoryEntries(historyEntries.filter(item => item.id !== h.id))
                              });
                            }}
                          >
                            🗑️ Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {historyEntries.length === 0 && (
                    <tr><td colSpan={canEditMedical ? 5 : 4} className="text-center py-4" style={{ color: 'var(--text-sub)' }}>Aucune entrée dans l'historique médical.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: LABORATOIRE */}
        {activeTab === 'lab' && (
          <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>🧪 Résultats d'analyses biologiques</h5>
              {canEditMedical && (
                <button 
                  type="button" 
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer' }}
                  onClick={() => setShowAddLabModal(true)}
                >
                  ➕ Ajouter un résultat
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
                <thead>
                  <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Examen</th>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Résultat</th>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Valeurs de référence</th>
                    <th style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Statut</th>
                    {canEditMedical && <th className="text-end" style={{ textTransform: 'none', letterSpacing: '0.02em' }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {labResults.map(lr => (
                    <tr key={lr.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="fw-bold" style={{ color: 'var(--text-main)' }}>{lr.examen}</td>
                      <td className={lr.statut === 'Normal' ? 'text-success fw-bold' : 'text-danger fw-bold'}>{lr.resultat}</td>
                      <td style={{ color: 'var(--text-sub)' }}>{lr.reference}</td>
                      <td>
                        <span style={{ 
                          background: lr.statut === 'Normal' ? 'rgba(16,185,129,0.2)' : lr.statut === 'Élevé' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', 
                          color: lr.statut === 'Normal' ? '#10b981' : lr.statut === 'Élevé' ? '#ef4444' : '#f59e0b', 
                          padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' 
                        }}>
                          {lr.statut}
                        </span>
                      </td>
                      {canEditMedical && (
                        <td className="text-end">
                          <button 
                            type="button" 
                            style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '0.35rem 0.75rem', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => {
                              setDeleteConfirmTarget({
                                title: lr.examen,
                                itemType: 'Résultat d\'analyse laboratoire',
                                onConfirm: () => setLabResults(labResults.filter(item => item.id !== lr.id))
                              });
                            }}
                          >
                            🗑️ Supprimer
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {labResults.length === 0 && (
                    <tr><td colSpan={canEditMedical ? 5 : 4} className="text-center py-4" style={{ color: 'var(--text-sub)' }}>Aucun résultat d'analyse enregistré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* TAB 4A: MATERNITÉ & GROSSESSE (Uniquement pour les femmes) */}
      {activeTab === 'maternity' && isFemalePatient && (
        <div className="card text-left p-4 fade-in-up" style={{ borderRadius: '24px', background: 'var(--bg-card)', border: '1.5px solid rgba(219, 39, 119, 0.35)', margin: '1.5rem auto', maxWidth: '1320px', boxShadow: '0 12px 35px rgba(219, 39, 119, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <div className="d-flex align-items-center gap-3">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(219, 39, 119, 0.2) 0%, rgba(236, 72, 153, 0.15) 100%)', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', border: '1px solid rgba(219, 39, 119, 0.3)' }}>
                🤰
              </div>
              <div>
                <h4 style={{ fontSize: '1.3rem', fontWeight: '850', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Suivi Maternité, Grossesse & Santé Maternelle
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: '0.25rem 0 0 0' }}>
                  Prise en charge à 100% CSU UNAMUSC Sénégal pour l'assurée {activeFirstName} {activeLastName} ({activeCmuNumber})
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm fw-bold px-4 py-2.5 hover-lift text-white"
              style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #db2777 0%, #ec4899 100%)', border: 'none', boxShadow: '0 4px 15px rgba(219, 39, 119, 0.35)', fontSize: '0.9rem' }}
              onClick={() => setView ? setView('maternity') : (window.location.hash = '#/maternity')}
            >
              📖 Accéder au Carnet Maternité Complet
            </button>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-4 col-md-6">
              <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(219, 39, 119, 0.06)', border: '1.5px solid rgba(219, 39, 119, 0.25)', height: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span style={{ fontSize: '1.6rem' }}>🗓️</span>
                  <span className="badge" style={{ background: '#db2777', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>100% Gratuit CSU</span>
                </div>
                <strong style={{ color: '#db2777', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>Consultations Prénatales (4 CPN)</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.55', marginBottom: '0.75rem' }}>
                  CPN 1 (T1) & CPN 2 (T2) validées. Suivi obstétrical rigoureux, dépistage de l'anémie, prise de tension et calcul de la DPA.
                </p>
                <div className="d-flex align-items-center gap-2">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  <small style={{ color: '#10b981', fontWeight: '750', fontSize: '0.82rem' }}>CPN 3 programmée pour ce mois</small>
                </div>
              </div>
            </div>

            <div className="col-lg-4 col-md-6">
              <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(14, 165, 233, 0.06)', border: '1.5px solid rgba(14, 165, 233, 0.25)', height: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span style={{ fontSize: '1.6rem' }}>🩻</span>
                  <span className="badge" style={{ background: '#0ea5e9', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>Échographies HD</span>
                </div>
                <strong style={{ color: '#0ea5e9', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>Échographies Obstétricales</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.55', marginBottom: '0.75rem' }}>
                  Échographie T1 morphologique et T2 effectuées à l'Hôpital Abass Ndao. Développement foetal harmonieux et biométrie conforme.
                </p>
                <small className="text-muted d-block" style={{ fontSize: '0.82rem' }}>Rapports et clichés consultables dans l'onglet Radios.</small>
              </div>
            </div>

            <div className="col-lg-4 col-md-6">
              <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.06)', border: '1.5px solid rgba(16, 185, 129, 0.25)', height: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span style={{ fontSize: '1.6rem' }}>💊</span>
                  <span className="badge" style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>Pharmacie 100%</span>
                </div>
                <strong style={{ color: '#10b981', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>Kit Maternité & Supplémentation</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.55', marginBottom: '0.75rem' }}>
                  Délivrance de Fer + Acide Folique, Moustiquaire imprégnée (MILDA), TPI paludisme et Kit d'accouchement propre sans reste à charge.
                </p>
                <small className="text-success fw-bold d-block" style={{ fontSize: '0.82rem' }}>Prise en charge intégrale UNAMUSC</small>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4B: SPÉCIALITÉS MÉDICALES & PATHOLOGIES (Adapté Homme / Femme) */}
      {activeTab === 'maternity_pathology' && (
        <div className="card text-left p-4 fade-in-up" style={{ borderRadius: '24px', background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', margin: '1.5rem auto', maxWidth: '1320px', boxShadow: '0 12px 35px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <div className="d-flex align-items-center gap-3">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.2) 0%, rgba(16, 185, 129, 0.15) 100%)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', border: '1px solid rgba(5, 150, 105, 0.3)' }}>
                🩺
              </div>
              <div>
                <h4 style={{ fontSize: '1.3rem', fontWeight: '850', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isFemalePatient ? 'Pathologies & Spécialités Médicales' : 'Spécialités Médicales & Pathologies Suivies'}
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: '0.25rem 0 0 0' }}>
                  Suivi clinique spécialisé (Cardiologie, Diabète, Pneumologie, Chirurgie & ALD) pour {activeFirstName} {activeLastName} ({activeCmuNumber})
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm fw-bold px-4 py-2.5 hover-lift text-white"
              style={{ borderRadius: '14px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', border: 'none', boxShadow: '0 4px 15px rgba(5,150,105,0.3)', fontSize: '0.9rem' }}
              onClick={() => setView ? setView('maternity') : (window.location.hash = '#/maternity')}
            >
              📖 Consulter les Protocoles ALD
            </button>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-lg-4 col-md-6">
              <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(14, 165, 233, 0.06)', border: '1.5px solid rgba(14, 165, 233, 0.25)', height: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span style={{ fontSize: '1.6rem' }}>🩸</span>
                  <span className="badge" style={{ background: '#0ea5e9', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>ALD 80% / 100%</span>
                </div>
                <strong style={{ color: '#0ea5e9', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>Pathologies Chroniques (ALD)</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.55', marginBottom: '0.75rem' }}>
                  Diabète Type 2 & HTA d'effort • Suivi trimestriel avec délivrance de bandelettes et ordonnances sécurisées sous le tiers-payant.
                </p>
                <div className="d-flex align-items-center gap-2">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0ea5e9', display: 'inline-block' }}></span>
                  <small style={{ color: '#0ea5e9', fontWeight: '750', fontSize: '0.82rem' }}>Protocole d'affection longue durée actif</small>
                </div>
              </div>
            </div>

            <div className="col-lg-4 col-md-6">
              <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(245, 158, 11, 0.06)', border: '1.5px solid rgba(245, 158, 11, 0.25)', height: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span style={{ fontSize: '1.6rem' }}>❤️</span>
                  <span className="badge" style={{ background: '#f59e0b', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>Cardiologie</span>
                </div>
                <strong style={{ color: '#f59e0b', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>Cardiologie & Santé Vasculaire</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.55', marginBottom: '0.75rem' }}>
                  ECG de repos annuel, échocardiographie Doppler et surveillance tensionnelle auprès des cardiologues conventionnés UNAMUSC.
                </p>
                <small className="text-warning fw-bold d-block" style={{ fontSize: '0.82rem' }}>Prise en charge consultation & bilans à 80%</small>
              </div>
            </div>

            <div className="col-lg-4 col-md-6">
              <div style={{ padding: '1.5rem', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.06)', border: '1.5px solid rgba(16, 185, 129, 0.25)', height: '100%' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span style={{ fontSize: '1.6rem' }}>👶</span>
                  <span className="badge" style={{ background: '#10b981', color: '#fff', fontSize: '0.75rem', fontWeight: '800' }}>100% Gratuit PEV</span>
                </div>
                <strong style={{ color: '#10b981', fontSize: '1.05rem', display: 'block', marginBottom: '0.35rem' }}>Santé Infantile & PEV (Ayants Droit)</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', lineHeight: '1.55', marginBottom: '0.75rem' }}>
                  Programme Élargi de Vaccination (BCG, Pentavalent 1 à 3, Rougeole-Rubéole), carnet pédiatrique et suivi de croissance des enfants.
                </p>
                <small className="text-success fw-bold d-block" style={{ fontSize: '0.82rem' }}>Gratuité totale pour les enfants de 0 à 5 ans</small>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>

      {/* DICOM VIEWING MODAL (React Portal — Centered on Screen) */}
      {viewingExam && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1100px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold text-success mb-0">🩻 Visionneuse DICOM 3.0 HD — {viewingExam.title}</h5>
              <button type="button" className="btn-close" onClick={() => setViewingExam(null)}></button>
            </div>

            <div className="row g-4">
              <div className="col-lg-8">
                <div className="rounded-4 p-3 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: '420px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
                  <img 
                    src={viewingExam.preview} 
                    alt={viewingExam.title} 
                    style={{ 
                      maxHeight: '100%', 
                      maxWidth: '100%', 
                      objectFit: 'contain',
                      transform: `scale(${dicomZoom})`,
                      filter: dicomInvert ? 'invert(100%)' : 'none'
                    }} 
                  />
                  <div className="position-absolute bottom-0 start-0 m-3 p-2 rounded-3 small" style={{ background: 'var(--bg-card)', color: 'var(--text-sub)', border: '1px solid var(--border-color)' }}>
                    Cliché {activeCliche} / {viewingExam.cliches}
                  </div>
                </div>

                <div className="d-flex justify-content-center flex-wrap gap-2 mt-3 p-2.5 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', rowGap: '0.65rem', columnGap: '0.65rem' }}>
                  <button type="button" className="hover-lift" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.95rem', fontSize: '0.84rem', fontWeight: '600' }} onClick={() => setDicomZoom(dicomZoom + 0.2)}>🔍 Zoom +</button>
                  <button type="button" className="hover-lift" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.95rem', fontSize: '0.84rem', fontWeight: '600' }} onClick={() => setDicomZoom(1)}>🔄 Réinitialiser</button>
                  <button type="button" className="hover-lift" style={{ background: dicomInvert ? '#f59e0b' : 'var(--bg-card)', color: dicomInvert ? '#ffffff' : 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.5rem 0.95rem', fontSize: '0.84rem', fontWeight: '600' }} onClick={() => setDicomInvert(!dicomInvert)}>🌗 Négatif</button>
                  <button type="button" className="hover-lift" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontSize: '0.84rem', fontWeight: '700', boxShadow: '0 4px 10px rgba(16,185,129,0.25)' }} onClick={() => setActiveCliche(prev => (prev >= viewingExam.cliches ? 1 : prev + 1))}>🖼 Cliché suivant</button>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="p-4 rounded-4 h-100 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <h6 className="fw-bold text-success mb-2">📋 Conclusion diagnostique</h6>
                    <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>{viewingExam.conclusion}</p>
                    <small className="d-block border-top pt-2" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)' }}>Prescrit par : <strong style={{ color: 'var(--text-main)' }}>{viewingExam.doctor}</strong></small>
                  </div>

                  <div className="d-flex flex-column gap-3 mt-4">
                    <button type="button" className="hover-lift" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }} onClick={() => handleDownloadExam(viewingExam)}>📥 Télécharger rapport PDF certifié (🇸🇳)</button>
                    <button type="button" className="hover-lift" style={{ background: 'var(--bg-card)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.88rem' }} onClick={() => setViewingExam(null)}>Fermer</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* SHARE MODAL (React Portal — Centered on Screen) */}
      {showShareModal && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}
        >
          <div style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', margin: 'auto' }}>
            
            {/* Modal Header */}
            <div className="d-flex justify-content-between align-items-start mb-3">
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  🔗
                </div>
                <div>
                  <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Partager mon dossier médical</h5>
                  <p className="small mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>UNAMUSC & DHIS2 — Accès temporaire sécurisé (24h)</p>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowShareModal(false)}></button>
            </div>

            <p className="small mb-4" style={{ color: 'var(--text-sub)', lineHeight: '1.5', fontSize: '0.86rem' }}>
              Générez un jeton d'accès sécurisé temporaire pour autoriser votre médecin ou établissement partenaire à consulter vos antécédents et vos clichés d'imagerie.
            </p>

            {/* Code OTP Card */}
            <div className="p-4 rounded-4 mb-4 text-center border" style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.15) 100%)', borderColor: isOtpExpired ? '#ef4444' : 'rgba(16, 185, 129, 0.3)' }}>
              <span className="small text-muted fw-bold d-block mb-1" style={{ fontSize: '0.76rem' }}>Code d'accès temporaire sécurisé (OTP 24h) :</span>
              <div className="fw-black text-warning my-2" style={{ fontSize: '2.4rem', letterSpacing: '0.12em', textShadow: '0 2px 8px rgba(245, 158, 11, 0.25)' }}>{otpData.code}</div>
              
              <div className="d-flex align-items-center justify-content-center gap-2 flex-wrap mt-2">
                <span className={`badge ${isOtpExpired ? 'bg-danger' : 'bg-success'} bg-opacity-20 ${isOtpExpired ? 'text-danger' : 'text-success'} fw-bold px-3 py-1.5 rounded-pill`} style={{ fontSize: '0.75rem' }}>
                  {isOtpExpired ? '🔴 Code OTP expiré' : `⏳ Valable encore ${getRemainingTime()}`}
                </span>
                <span className="badge bg-secondary bg-opacity-20 text-white fw-bold px-3 py-1.5 rounded-pill" style={{ fontSize: '0.75rem' }}>
                  🔒 Chiffrement de bout en bout DHIS2 & UNAMUSC
                </span>
              </div>

              {isOtpExpired && (
                <button 
                  type="button" 
                  className="btn btn-sm btn-warning fw-bold mt-3 px-3 py-2 rounded-3 text-dark"
                  onClick={generateNewOtp}
                >
                  🔄 Générer un nouveau code OTP (Valable 24h)
                </button>
              )}
            </div>

            {/* QR Code Card */}
            <div className="d-flex align-items-center gap-3 p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
              <div className="p-2 bg-white rounded-3 border flex-shrink-0" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(`https://mutualis.sn/dossier-partage/${activeCmuNumber}?otp=${otpData.code}`)}`} alt="QR Code Partage" style={{ width: '84px', height: '84px', display: 'block' }} />
              </div>
              <div>
                <strong className="d-block text-success small fw-bold mb-1" style={{ fontSize: '0.88rem' }}>Scan QR code en consultation :</strong>
                <p className="small mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.78rem', lineHeight: '1.45' }}>
                  Votre médecin peut scanner ce code directement avec son smartphone pour ouvrir instantanément votre dossier médical certifié (OTP: {otpData.code}).
                </p>
              </div>
            </div>

            {copiedLink && (
              <div className="alert alert-success py-2.5 px-3 small fw-bold mb-3 rounded-3 text-center d-flex align-items-center justify-content-center gap-2" style={{ fontSize: '0.85rem' }}>
                ✅ Lien d'accès au dossier médical copié dans le presse-papier !
              </div>
            )}

            {/* Actions Buttons */}
            <div className="d-flex flex-column" style={{ gap: '1.15rem', marginTop: '1.25rem' }}>
              <button 
                type="button" 
                className="btn w-100 fw-bold py-3.5 px-4 d-flex align-items-center justify-content-center gap-2.5 hover-lift"
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '16px', fontSize: '0.94rem', boxShadow: '0 4px 16px rgba(5,150,105,0.3)' }} 
                onClick={handleCopyShareLink}
              >
                📋 Copier le lien sécurisé (OTP: {otpData.code})
              </button>

              <button 
                type="button" 
                className="btn w-100 fw-bold py-3.5 px-4 d-flex align-items-center justify-content-center gap-2.5 hover-lift"
                style={{ background: '#25D366', color: '#ffffff', border: 'none', borderRadius: '16px', fontSize: '0.94rem', boxShadow: '0 4px 16px rgba(37,211,102,0.3)' }}
                onClick={handleShareWhatsApp}
              >
                💬 Partager directement via WhatsApp au médecin
              </button>

              <button 
                type="button" 
                className="btn w-100 fw-bold py-3 px-4 mt-1 hover-lift"
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1.5px solid var(--border-color)', borderRadius: '16px', fontSize: '0.9rem' }} 
                onClick={() => setShowShareModal(false)}
              >
                Fermer
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ADD EXAM MODAL (React Portal — Centered on Screen) */}
      {showAddExamModal && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddExamModal(false); }}
        >
          <form onSubmit={handleAddExam} style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '26px', padding: '2.25rem 2rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', fontWeight: 'bold' }}>
                  ➕
                </div>
                <div>
                  <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Ajouter un examen certifié :</h5>
                  <small className="text-muted" style={{ fontSize: '0.82rem' }}>(Cliché DICOM, Scanner, Radio ou Rapport PDF)</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddExamModal(false)}></button>
            </div>
            
            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Titre de l'examen *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newExamTitle} onChange={(e) => setNewExamTitle(e.target.value)} placeholder="Ex: Radiographie pulmonaire & Scanner DICOM" required />
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Type d'imagerie / Analyse *</label>
                <select className="form-select" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newExamType} onChange={(e) => setNewExamType(e.target.value)}>
                  <option value="Scanner">Scanner (DICOM)</option>
                  <option value="IRM">IRM (DICOM)</option>
                  <option value="Radio">Radiographie</option>
                  <option value="Échographie">Échographie</option>
                  <option value="Analyse">Bilan biologique</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Nombre de clichés DICOM</label>
                <input type="number" min="1" max="50" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newExamCliches} onChange={(e) => setNewExamCliches(e.target.value)} />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Établissement / Structure de santé *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newExamFacility} onChange={(e) => setNewExamFacility(e.target.value)} placeholder="Ex: Polyclinique de la Médina" required />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Médecin ou Biologiste prescripteur</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newExamDoctor} onChange={(e) => setNewExamDoctor(e.target.value)} placeholder="Ex: Dr. Ousmane Sow (Hôpital Fann)" />
            </div>

            {/* File Selector Dropzone */}
            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>📁 Fichier cliché DICOM / PDF (.DCM, .ZIP, .PDF, image)</label>
              <div style={{ border: '2px dashed #10b981', borderRadius: '16px', padding: '1.35rem', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>
                <input 
                  type="file" 
                  id="add-exam-file-input"
                  accept=".dcm,.dicom,.zip,.pdf,.png,.jpg,.jpeg,.webp" 
                  style={{ display: 'none' }}
                  onChange={(e) => handleDICOMFileUpload(e, setNewExamFilePreview, setNewExamFileName)}
                />
                <label htmlFor="add-exam-file-input" style={{ cursor: 'pointer', margin: 0, width: '100%' }}>
                  <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>🩻</div>
                  <span className="fw-bold d-block text-primary" style={{ fontSize: '0.92rem' }}>
                    {newExamFileName ? `✓ Fichier sélectionné : ${newExamFileName}` : 'Cliquez pour sélectionner le fichier DICOM / Image'}
                  </span>
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.78rem' }}>Formats acceptés: .DCM, .ZIP, .PDF, PNG, JPG</small>
                </label>
              </div>
              {newExamFilePreview && (
                <div className="mt-3 text-center">
                  <small className="text-success fw-bold d-block mb-1.5">Aperçu du cliché / fichier :</small>
                  <img src={newExamFilePreview} alt="Aperçu DICOM" style={{ maxHeight: '120px', borderRadius: '12px', border: '1.5px solid var(--border-color)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div className="mb-4.5">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Conclusions & Compte-rendu diagnostique</label>
              <textarea className="form-control" rows={3} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newExamConclusion} onChange={(e) => setNewExamConclusion(e.target.value)} placeholder="Ex: Imagerie thoracique de contrôle satisfaisante. Absence de foyer parenchymateux évolutif." />
            </div>

            <div className="d-flex justify-content-between align-items-center pt-4 border-top w-100" style={{ borderColor: 'var(--border-color)', gap: '1.25rem' }}>
              <button type="button" className="btn px-4 py-3 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.9rem' }} onClick={() => setShowAddExamModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-3 fw-bold text-white hover-lift" style={{ background: '#059669', border: 'none', borderRadius: '14px', fontSize: '0.92rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>➕ Créer l'examen DICOM</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* EDIT EXAM MODAL (React Portal) */}
      {editingExamTarget && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingExamTarget(null); }}
        >
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const updated = exams.map(eItem => eItem.id === editingExamTarget.id ? editingExamTarget : eItem);
              handleUpdateExams(updated);

              try {
                const globalExams = JSON.parse(localStorage.getItem('cmu-medical-exams') || '[]');
                const updatedGlobal = globalExams.map(g => g.id === editingExamTarget.id ? editingExamTarget : g);
                localStorage.setItem('cmu-medical-exams', JSON.stringify(updatedGlobal));
              } catch (err) {}

              setEditingExamTarget(null);
              alert('✅ Examen certifié / Cliché DICOM mis à jour avec succès !');
            }} 
            style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '26px', padding: '2.25rem 2rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', margin: 'auto' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', fontWeight: 'bold' }}>
                  ✏️
                </div>
                <div>
                  <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Modifier l'examen / DICOM :</h5>
                  <small className="text-muted" style={{ fontSize: '0.82rem' }}>{editingExamTarget.title}</small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setEditingExamTarget(null)}></button>
            </div>
            
            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Titre de l'examen *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={editingExamTarget.title || ''} onChange={(e) => setEditingExamTarget({ ...editingExamTarget, title: e.target.value })} required />
            </div>

            <div className="row g-3 mb-4">
              <div className="col-md-6">
                <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Établissement / Laboratoire *</label>
                <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={editingExamTarget.facility || ''} onChange={(e) => setEditingExamTarget({ ...editingExamTarget, facility: e.target.value })} required />
              </div>
              <div className="col-md-6">
                <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Badge de certification</label>
                <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={editingExamTarget.badge || 'HD DICOM'} onChange={(e) => setEditingExamTarget({ ...editingExamTarget, badge: e.target.value })} />
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Praticien / Biologiste responsable</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={editingExamTarget.doctor || ''} onChange={(e) => setEditingExamTarget({ ...editingExamTarget, doctor: e.target.value })} />
            </div>

            {/* Replace File Picker */}
            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>📁 Remplacer le fichier DICOM / Image</label>
              <div style={{ border: '2px dashed #10b981', borderRadius: '16px', padding: '1.15rem', textAlign: 'center', background: 'var(--bg-card-subtle)' }}>
                <input 
                  type="file" 
                  id="edit-exam-file-input"
                  accept=".dcm,.dicom,.zip,.pdf,.png,.jpg,.jpeg,.webp" 
                  style={{ display: 'none' }}
                  onChange={(e) => handleDICOMFileUpload(e, (p) => setEditingExamTarget({ ...editingExamTarget, preview: p }), (fName) => setEditingExamTarget({ ...editingExamTarget, fileName: fName }))}
                />
                <label htmlFor="edit-exam-file-input" style={{ cursor: 'pointer', margin: 0, width: '100%' }}>
                  <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>
                    {editingExamTarget.fileName ? `✓ Nouveau fichier : ${editingExamTarget.fileName}` : 'Changer de fichier DICOM ou d\'image'}
                  </span>
                </label>
              </div>
              {editingExamTarget.preview && (
                <div className="mt-3 text-center">
                  <img src={editingExamTarget.preview} alt="Preview" style={{ maxHeight: '110px', borderRadius: '12px', border: '1.5px solid var(--border-color)' }} onError={(e) => { e.target.style.display = 'none'; }} />
                </div>
              )}
            </div>

            <div className="mb-4.5">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Conclusions & Compte-rendu *</label>
              <textarea className="form-control" rows={3} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={editingExamTarget.conclusion || ''} onChange={(e) => setEditingExamTarget({ ...editingExamTarget, conclusion: e.target.value })} required />
            </div>

            <div className="d-flex justify-content-between align-items-center pt-4 border-top w-100" style={{ borderColor: 'var(--border-color)', gap: '1.25rem' }}>
              <button type="button" className="btn px-4 py-3 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.9rem' }} onClick={() => setEditingExamTarget(null)}>Annuler</button>
              <button type="submit" className="btn px-4 py-3 fw-bold text-white hover-lift" style={{ background: '#059669', border: 'none', borderRadius: '14px', fontSize: '0.92rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>💾 Enregistrer les modifications</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ADD HISTORY MODAL (React Portal) */}
      {showAddHistoryModal && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddHistoryModal(false); }}
        >
          <form onSubmit={handleAddHistory} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '26px', padding: '2.25rem 2rem', border: '1.5px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', fontWeight: 'bold' }}>
                  🩺
                </div>
                <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Ajouter une consultation</h5>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddHistoryModal(false)}></button>
            </div>
            
            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Acte / Consultation *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newHistoryActe} onChange={(e) => setNewHistoryActe(e.target.value)} placeholder="Ex: Consultation généraliste" required />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Praticien / Structure</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newHistoryPraticien} onChange={(e) => setNewHistoryPraticien(e.target.value)} placeholder="Ex: Dr. Ousmane Sow" />
            </div>

            <div className="mb-4.5">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Conclusion diagnostique</label>
              <textarea className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} rows={3} value={newHistoryConclusion} onChange={(e) => setNewHistoryConclusion(e.target.value)} placeholder="Ex: Bilan normal. Ordonnance émise." />
            </div>

            <div className="d-flex justify-content-between align-items-center pt-4 border-top w-100" style={{ borderColor: 'var(--border-color)', gap: '1.25rem' }}>
              <button type="button" className="btn px-4 py-3 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.9rem' }} onClick={() => setShowAddHistoryModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-3 fw-bold text-white hover-lift" style={{ background: '#059669', border: 'none', borderRadius: '14px', fontSize: '0.92rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>Ajouter la consultation</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* ADD LAB RESULT MODAL (React Portal) */}
      {showAddLabModal && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddLabModal(false); }}
        >
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!newLabExamen) return;
            setLabResults([{ id: Date.now(), examen: newLabExamen, resultat: newLabResultat, reference: newLabReference, statut: newLabStatut }, ...labResults]);
            setShowAddLabModal(false);
            setNewLabExamen(''); setNewLabResultat(''); setNewLabReference(''); setNewLabStatut('Normal');
            alert('✅ Résultat d\'analyse ajouté avec succès !');
          }} style={{ maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '26px', padding: '2.25rem 2rem', border: '1.5px solid var(--border-color)', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', fontWeight: 'bold' }}>
                  🧪
                </div>
                <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>Ajouter un résultat d'analyse</h5>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowAddLabModal(false)}></button>
            </div>
            
            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Nom de l'examen *</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newLabExamen} onChange={(e) => setNewLabExamen(e.target.value)} placeholder="Ex: Créatinine, Cholestérol..." required />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Résultat</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newLabResultat} onChange={(e) => setNewLabResultat(e.target.value)} placeholder="Ex: 0.95 g/L" />
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Valeurs de référence</label>
              <input type="text" className="form-control" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newLabReference} onChange={(e) => setNewLabReference(e.target.value)} placeholder="Ex: 0.70 - 1.10 g/L" />
            </div>

            <div className="mb-4.5">
              <label className="form-label small fw-bold d-block mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>Statut</label>
              <select className="form-select" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.15rem' }} value={newLabStatut} onChange={(e) => setNewLabStatut(e.target.value)}>
                <option value="Normal">🟢 Normal</option>
                <option value="Élevé">🔴 Élevé</option>
                <option value="Bas">🟡 Bas</option>
              </select>
            </div>

            <div className="d-flex justify-content-between align-items-center pt-4 border-top w-100" style={{ borderColor: 'var(--border-color)', gap: '1.25rem' }}>
              <button type="button" className="btn px-4 py-3 fw-bold" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.9rem' }} onClick={() => setShowAddLabModal(false)}>Annuler</button>
              <button type="submit" className="btn px-4 py-3 fw-bold text-white hover-lift" style={{ background: '#059669', border: 'none', borderRadius: '14px', fontSize: '0.92rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>Ajouter l'analyse</button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* REPERTOIRE PATIENTS MODAL (React Portal) */}
      {showPatientDirectoryModal && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPatientDirectoryModal(false); }}
        >
          <div style={{ maxWidth: '850px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.35)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  🏥
                </div>
                <div>
                  <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>
                    Répertoire des assurés & examens DICOM de l'établissement
                  </h5>
                  <small className="text-muted" style={{ fontSize: '0.84rem' }}>
                    {partnerUser?.structureName || 'Laboratoire / Établissement de santé conventionné'} ({facilityPatients.length} dossiers actifs au Sénégal)
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setShowPatientDirectoryModal(false)}></button>
            </div>

            {/* Barre de Recherche rapide dans le répertoire */}
            <div className="mb-4">
              <div className="input-group">
                <span className="input-group-text" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', color: 'var(--text-sub)' }}>🔍</span>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Rechercher par nom, numéro CSU, commune, médecin ou type d'examen..."
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '0 12px 12px 0' }}
                  value={directorySearchQuery}
                  onChange={(e) => setDirectorySearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="row g-3">
              {facilityPatients
                .filter(pat => {
                  if (!directorySearchQuery) return true;
                  const q = directorySearchQuery.toLowerCase();
                  return (
                    pat.firstName.toLowerCase().includes(q) ||
                    pat.lastName.toLowerCase().includes(q) ||
                    pat.cmuNumber.toLowerCase().includes(q) ||
                    (pat.location && pat.location.toLowerCase().includes(q)) ||
                    (pat.lastExam && pat.lastExam.toLowerCase().includes(q)) ||
                    (pat.doctor && pat.doctor.toLowerCase().includes(q))
                  );
                })
                .map(pat => (
                <div key={pat.cmuNumber} className="col-md-6">
                  <div 
                    className="p-3.5 rounded-4 h-100 d-flex flex-column justify-content-between transition-all"
                    style={{ 
                      background: pat.cmuNumber === selectedPatientCmu ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card-subtle)', 
                      border: pat.cmuNumber === selectedPatientCmu ? '2px solid #10b981' : '1px solid var(--border-color)',
                      borderRadius: '18px'
                    }}
                  >
                    <div>
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            👤
                          </div>
                          <div>
                            <strong className="d-block" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                              {pat.firstName} {pat.lastName}
                            </strong>
                            <div className="d-flex align-items-center gap-2">
                              <code className="text-emerald-600 fw-bold" style={{ fontSize: '0.78rem', color: '#10b981' }}>
                                {pat.cmuNumber}
                              </code>
                              {pat.location && (
                                <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem' }}>
                                  📍 {pat.location}
                                </small>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '8px', fontSize: '0.75rem' }}>
                          {pat.packageType}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-3 mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                        <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>Dernier examen / bilan prescrit :</small>
                        <strong className="d-block text-primary" style={{ fontSize: '0.85rem' }}>{pat.lastExam}</strong>
                        <small className="text-secondary d-block mt-0.5" style={{ fontSize: '0.75rem' }}>👨‍⚕️ {pat.doctor}</small>
                      </div>
                    </div>

                    <button 
                      type="button"
                      className="btn btn-sm w-100 fw-bold text-white py-2"
                      style={{ background: pat.cmuNumber === selectedPatientCmu ? '#059669' : '#047857', border: 'none', borderRadius: '10px', fontSize: '0.84rem', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedPatientCmu(pat.cmuNumber);
                        setShowPatientDirectoryModal(false);
                      }}
                    >
                      {pat.cmuNumber === selectedPatientCmu ? '✓ Dossier actuellement ouvert' : '👁 Ouvrir le dossier & examens DICOM'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-end mt-4 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn px-4 py-2 fw-bold" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.85rem' }} 
                onClick={() => setShowPatientDirectoryModal(false)}
              >
                Fermer le répertoire
              </button>
            </div>

          </div>
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

    </div>
  );
}
