import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { getBeneficiaryInfo, getAdherentCode, getBeneficiaryCode } from '../utils/csuFormatter';

/**
 * Détermine le contexte temporel de délivrance d'une Lettre de Garantie :
 * - Période de Garde / Nuit (17h00 - 07h59 en semaine) -> Délivrance d'urgence directe par la structure de santé
 * - Week-end (Samedi & Dimanche - 24h/24) -> Délivrance d'urgence permanente 24h/24
 * - Journée ouvrable (08h00 - 16h59) -> Service standard d'instruction
 */
export function getEmergencyIssuanceStatus() {
  const now = new Date();
  const day = now.getDay(); // 0 = Dimanche, 6 = Samedi
  const hour = now.getHours();
  const isWeekend = (day === 0 || day === 6);
  const isNightDuty = (!isWeekend && (hour >= 17 || hour < 8));

  if (isWeekend) {
    return {
      isEmergency: true,
      period: 'weekend',
      label: '🏥 Permanence Week-End (24h/24)',
      badgeColor: '#7c3aed',
      badgeBg: 'rgba(124, 58, 237, 0.12)',
      deliveryText: 'Délivrée d\'urgence 24h/24 par la structure de santé • Prise en charge immédiate des soins • Régularisation administrative par l\'agent le lundi dès 08h00.',
      regularizationDue: 'Lundi dès 08h00'
    };
  } else if (isNightDuty) {
    return {
      isEmergency: true,
      period: 'night',
      label: '🌙 Permanence de Garde (17h00 - 07h59)',
      badgeColor: '#d97706',
      badgeBg: 'rgba(217, 119, 6, 0.12)',
      deliveryText: 'Délivrée d\'urgence par la structure sanitaire conventionnée • Prise en charge immédiate • Régularisation administrative par l\'agent le prochain jour ouvrable dès 08h00.',
      regularizationDue: 'Prochain jour ouvrable dès 08h00'
    };
  } else {
    return {
      isEmergency: false,
      period: 'standard',
      label: '☀️ Service Standard UNAMUSC (08h00 - 16h59)',
      badgeColor: '#059669',
      badgeBg: 'rgba(5, 150, 105, 0.12)',
      deliveryText: 'Instruction et homologation régulières en agence mutualiste.',
      regularizationDue: 'Immédiat'
    };
  }
}

export default function GuaranteeLetters({ lang = 'fr', userRole = 'citizen', citizenUser = null, agentUser = null, partnerUser = null, setView = null }) {
  const defaultLetters = [
    { id: 201, first_name: 'Amadou', last_name: 'Sow', cmu_number: 'CSU-DKR-2026-8812.2', ipp_number: 'IPP-FANN-2026-8812', hospital_name: 'Hôpital Universitaire de Fann (Dakar)', medical_act: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)', estimated_amount: 250000, guaranteed_percentage: 80, unamusc_amount: 200000, sesame_amount: 0, max_amount: 200000, patient_rest: 50000, status: 'pending', validation_code: 'GAR-2026-FANN-88', created_at: new Date().toISOString(), agent_note: 'Dossier complet. Devis d\'hospitalisation vérifié conforme au barème national UNAMUSC (80% mutuelle, 20% ticket modérateur).' },
    { id: 202, first_name: 'Fatou', last_name: 'Diop', cmu_number: 'CMU-DKR-2026-4401', ipp_number: 'IPP-DANTEC-2026-4401', hospital_name: 'Hôpital Aristide Le Dantec', medical_act: 'Hospitalisation soins intensifs 5 jours — (Hôpital Aristide Le Dantec)', estimated_amount: 450000, guaranteed_percentage: 100, unamusc_amount: 450000, sesame_amount: 0, max_amount: 450000, patient_rest: 0, status: 'approved', validation_code: 'GAR-2026-DANTEC-12', created_at: new Date(Date.now() - 86400000 * 2).toISOString(), agent_note: 'Accordé à 100% au titre de la gratuité hospitalière maternité & soins d\'urgence (UNAMUSC).' },
    { id: 203, first_name: 'Moustapha', last_name: 'Ndiaye', cmu_number: 'SN-DK-PIK-9021', ipp_number: 'IPP-PRINC-2026-9021', hospital_name: 'Hôpital Principal de Dakar', medical_act: 'Chirurgie orthopédique d’urgence & Rééducation', estimated_amount: 320000, guaranteed_percentage: 80, unamusc_amount: 256000, sesame_amount: 0, max_amount: 256000, patient_rest: 64000, status: 'approved', validation_code: 'GAR-2026-PRINC-44', created_at: new Date(Date.now() - 86400000 * 3).toISOString(), agent_note: 'Homologué par le médecin conseil UNAMUSC.' },
    { id: 204, first_name: 'Khadija', last_name: 'Ndiaye', cmu_number: 'SN-DK-MED-1001.2', ipp_number: 'IPP-MED-2026-1001', hospital_name: 'Centre Hospitalier Abass Ndao', medical_act: 'Suivi prénatal & Accouchement césarienne', estimated_amount: 180000, guaranteed_percentage: 100, unamusc_amount: 180000, sesame_amount: 0, max_amount: 180000, patient_rest: 0, status: 'approved', validation_code: 'GAR-2026-ABASS-09', created_at: new Date(Date.now() - 86400000 * 4).toISOString(), agent_note: 'Programme Maternité Gratuité Régionale.' },
    { id: 205, first_name: 'Abdoulaye', last_name: 'Ndiaye', cmu_number: 'SN-DK-PIK-9001.3', ipp_number: 'IPP-ROYER-2026-9001', hospital_name: 'Hôpital d’Enfants Albert Royer', medical_act: 'Soins pédiatriques intensifs (72h)', estimated_amount: 150000, guaranteed_percentage: 80, unamusc_amount: 120000, sesame_amount: 0, max_amount: 120000, patient_rest: 30000, status: 'approved', validation_code: 'GAR-2026-ROYER-17', created_at: new Date(Date.now() - 86400000 * 5).toISOString(), agent_note: 'Prise en charge validée.' },
    { id: 206, first_name: 'Ibrahima', last_name: 'Sarr', cmu_number: 'SN-DK-UCAD-1012', ipp_number: 'IPP-DALAL-2026-1012', hospital_name: 'Hôpital Dalal Jamm (Guédiawaye)', medical_act: 'Examen IRM Cérébral & Neurologie', estimated_amount: 140000, guaranteed_percentage: 80, unamusc_amount: 112000, sesame_amount: 0, max_amount: 112000, patient_rest: 28000, status: 'pending', validation_code: 'GAR-2026-DALAL-55', created_at: new Date(Date.now() - 86400000 * 6).toISOString(), agent_note: 'En cours d’instruction par l’agent.' },
    { id: 207, first_name: 'Sokhna', last_name: 'Kane', cmu_number: 'SN-DK-GUE-4401', ipp_number: 'IPP-BAUD-2026-4401', hospital_name: 'Hôpital Roi Baudouin de Guédiawaye', medical_act: 'Soins néonataux & couveuse 5 jours', estimated_amount: 220000, guaranteed_percentage: 100, unamusc_amount: 220000, sesame_amount: 0, max_amount: 220000, patient_rest: 0, status: 'approved', validation_code: 'GAR-2026-BAUD-81', created_at: new Date(Date.now() - 86400000 * 7).toISOString(), agent_note: 'Gratuité totale Nouveau-Né.' },
    { id: 208, first_name: 'Modou', last_name: 'Diop', cmu_number: 'SN-DK-MED-1001.1', ipp_number: 'IPP-MED-2026-1002', hospital_name: 'Polyclinique de la Médina', medical_act: 'Chirurgie Herniaire & Anesthésie', estimated_amount: 210000, guaranteed_percentage: 80, unamusc_amount: 168000, sesame_amount: 0, max_amount: 168000, patient_rest: 42000, status: 'approved', validation_code: 'GAR-2026-MED-92', created_at: new Date(Date.now() - 86400000 * 8).toISOString(), agent_note: 'Accordé à 80% UNAMUSC.' },
    { id: 209, first_name: 'Ousmane', last_name: 'Ba', cmu_number: 'SN-DK-RUF-2024', ipp_number: 'IPP-RUF-2026-2024', hospital_name: 'Centre Hospitalier de Rufisque', medical_act: 'Hospitalisation Pneumologie & Oxygénothérapie', estimated_amount: 195000, guaranteed_percentage: 80, unamusc_amount: 156000, sesame_amount: 0, max_amount: 156000, patient_rest: 39000, status: 'approved', validation_code: 'GAR-2026-RUF-04', created_at: new Date(Date.now() - 86400000 * 9).toISOString(), agent_note: 'Validation du devis.' },
    { id: 210, first_name: 'Aminata', last_name: 'Fall', cmu_number: 'SN-DK-YEU-3100', ipp_number: 'IPP-YEU-2026-3100', hospital_name: 'Hôpital de Pikine (Camp Thiaroye)', medical_act: 'Soins Cardiologie & Échographie Trans-œsophagienne', estimated_amount: 280000, guaranteed_percentage: 80, unamusc_amount: 224000, sesame_amount: 0, max_amount: 224000, patient_rest: 56000, status: 'pending', validation_code: 'GAR-2026-YEU-11', created_at: new Date(Date.now() - 86400000 * 10).toISOString(), agent_note: 'Instruction en cours par la mutuelle.' },
    // Cas 1 : Personne âgée de 60 ans et plus (Plan SESAME — 100% prise en charge avec 80% UNAMUSC + 20% SESAME)
    { 
      id: 211, 
      first_name: 'Moussa', 
      last_name: 'Diagne', 
      cmu_number: 'SN-DK-MED-2600.1', 
      ipp_number: 'IPP-PRINC-2026-2600', 
      hospital_name: 'Hôpital Général Idrissa Pouye (Grand Yoff)', 
      medical_act: 'Chirurgie de la cataracte & Bilan gériatrique complet', 
      estimated_amount: 280000, 
      guaranteed_percentage: 100, 
      unamusc_percentage: 80, 
      sesame_percentage: 20, 
      unamusc_amount: 224000, 
      sesame_amount: 56000, 
      max_amount: 280000, 
      patient_rest: 0, 
      is_sesame: true, 
      is_senior: true, 
      status: 'approved', 
      validation_code: 'GAR-2026-SESAME-60', 
      created_at: new Date().toISOString(), 
      agent_note: '🧓 Bénéficiaire Plan SESAME (60 ans et +). Prise en charge intégrale UNAMUSC (224 000 FCFA / 80%) + Contrepartie Plan SESAME État du Sénégal (56 000 FCFA / 20%). Reste à charge patient : 0 FCFA.' 
    },
    // Cas 2 : Lettre délivrée d'urgence pendant les heures de garde / week-end (Continuité 7j/7)
    { 
      id: 212, 
      first_name: 'Awa', 
      last_name: 'Seck', 
      cmu_number: 'SN-DK-PIK-2600.2', 
      ipp_number: 'IPP-BAUD-2026-2600', 
      hospital_name: 'Hôpital Roi Baudouin de Guédiawaye', 
      medical_act: 'Soins d\'urgences médicales de garde & Perfusion', 
      estimated_amount: 140000, 
      guaranteed_percentage: 80, 
      unamusc_percentage: 80, 
      sesame_percentage: 0, 
      unamusc_amount: 112000, 
      sesame_amount: 0, 
      max_amount: 112000, 
      patient_rest: 28000, 
      is_emergency_issuance: true, 
      emergency_period: 'night', 
      status: 'emergency_issued', 
      validation_code: 'GAR-2026-URG-89', 
      created_at: new Date().toISOString(), 
      agent_note: '🌙 Délivrée d\'urgence par la structure sanitaire conventionnée en permanence de garde (17h00 - 07h59). Soins autorisés immédiatement. En attente de régularisation par l\'agent le prochain jour ouvrable dès 08h00.' 
    }
  ];

  const [letterPage, setLetterPage] = useState(1);

  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles (cohérent avec MedicalProfile)
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isLabUser    = userRole === 'lab' || userRole === 'biologist' || 
                       (partnerUser?.role && (partnerUser.role.toLowerCase().includes('laboratoire') || partnerUser.role.toLowerCase().includes('biologiste') || partnerUser.role.toLowerCase().includes('imagerie'))) ||
                       (partnerUser?.structureName && (partnerUser.structureName.toLowerCase().includes('pasteur') || partnerUser.structureName.toLowerCase().includes('laboratoire') || partnerUser.structureName.toLowerCase().includes('imagerie')));
  const isDoctor     = !isLabUser && (userRole === 'doctor' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('médecin')));
  const isMidwife    = !isLabUser && (userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage')));
  const isPharmacist = !isLabUser && userRole === 'pharmacist';
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isSuperAdmin)) && !isSuperAdmin;
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isLabUser && !isSuperAdmin && (!!citizenUser && (userRole === 'citizen' || userRole === 'citizen_suspended'));
  const isPublic     = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isLabUser && !isSuperAdmin && !isCitizen;
  const isStaff      = isDoctor || isMidwife || isAgent || isPharmacist || isLabUser || isSuperAdmin;
  // Droits d'instruction : agent gérant ou superadmin
  const canInstruire = isAgent || isSuperAdmin;
  // Peut consulter les dossiers liés à ses patients (médecin/sage-femme) ou tous (agent/superadmin)
  const canViewAllLetters = isAgent || isSuperAdmin || isDoctor || isMidwife || isLabUser;

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

  const [publicSearchCmu, setPublicSearchCmu] = useState('');
  const [requestCategory, setRequestCategory] = useState('hospital'); // 'hospital' | 'pharmacy'

  const sanitizeOrderList = (list) => {
    return list.map(o => {
      let name = o.examName || '';
      let detail = o.examDetail || '';
      if (name.includes('DICOMImagerie')) {
        name = 'Radiographie pulmonaire & Scanner DICOM';
        detail = 'Imagerie thoracique de contrôle';
      }
      if (name.includes('SérologiesNFS')) {
        name = 'Bilan sanguin complet & Sérologies';
        detail = 'NFS, Glycémie, Bilan hépatique';
      }
      return { ...o, examName: name, examDetail: detail };
    });
  };

  // State pour le hub laboratoire (Bilans & Radios)
  const [labOrdersState, setLabOrdersState] = useState(() => {
    const defaults = [
      {
        id: 1,
        patientName: 'Amadou Sow',
        cmuNumber: 'CSU-DKR-2026-8812.2',
        examName: 'Bilan sanguin complet & Sérologies',
        examDetail: 'NFS, Glycémie, Bilan hépatique',
        doctor: 'Dr. Cheikh Anta Diop (Abass Ndao)',
        coverage: '80% UNAMUSC',
        status: 'prescrit',
        fileName: null,
        notes: ''
      },
      {
        id: 2,
        patientName: 'Fatou Diop',
        cmuNumber: 'CMU-DKR-2026-4401',
        examName: 'Radiographie pulmonaire & Scanner DICOM',
        examDetail: 'Imagerie thoracique de contrôle',
        doctor: 'Dr. Ousmane Sow (Hôpital Fann)',
        coverage: '100% Gratuité',
        status: 'prescrit',
        fileName: null,
        notes: ''
      }
    ];
    try {
      const saved = localStorage.getItem('unamusc_lab_orders');
      if (saved) return sanitizeOrderList(JSON.parse(saved));
    } catch (e) {}
    return defaults;
  });
  const [uploadLabTargetOrder, setUploadLabTargetOrder] = useState(null);
  const [uploadLabFileName, setUploadLabFileName] = useState('');
  const [uploadLabNotes, setUploadLabNotes] = useState('');

  // ── States & handlers pour CRUD complet (Créer, Modifier, Supprimer) des prescriptions labo ──
  const [editingLabOrder, setEditingLabOrder] = useState(null);
  const [isNewLabOrder, setIsNewLabOrder] = useState(false);
  const [confirmDeleteObj, setConfirmDeleteObj] = useState(null); // { title: string, onConfirm: function }

  const handleSaveLabOrder = (e) => {
    e.preventDefault();
    if (!editingLabOrder) return;
    if (!editingLabOrder.patientName || !editingLabOrder.examName) {
      alert('Veuillez renseigner le nom du patient et l\'examen prescrit.');
      return;
    }

    let updated;
    if (isNewLabOrder) {
      const newObj = {
        ...editingLabOrder,
        id: Date.now(),
        status: editingLabOrder.status || 'prescrit'
      };
      updated = [newObj, ...labOrdersState];
    } else {
      updated = labOrdersState.map(o => o.id === editingLabOrder.id ? editingLabOrder : o);
    }
    setLabOrdersState(updated);
    localStorage.setItem('unamusc_lab_orders', JSON.stringify(updated));
    setEditingLabOrder(null);
    setIsNewLabOrder(false);
  };

  const handleDeleteLabOrder = (order) => {
    setConfirmDeleteObj({
      title: `la prescription "${order.examName || 'Examen'}" de ${order.patientName}`,
      onConfirm: () => {
        const updated = labOrdersState.filter(o => o.id !== order.id);
        setLabOrdersState(updated);
        localStorage.setItem('unamusc_lab_orders', JSON.stringify(updated));
      }
    });
  };

  // ── States & handlers pour CRUD complet (Créer, Modifier, Supprimer) des Lettres de Garantie ──
  const [editingLetterObj, setEditingLetterObj] = useState(null);
  const [isNewLetterObj, setIsNewLetterObj] = useState(false);

  const handleSaveLetterObj = (e) => {
    e.preventDefault();
    if (!editingLetterObj) return;
    if (!editingLetterObj.first_name || !editingLetterObj.medical_act) {
      alert('Veuillez renseigner le nom du bénéficiaire et l\'acte médical.');
      return;
    }

    const estNum = parseFloat(editingLetterObj.estimated_amount) || 0;
    const pctNum = parseFloat(editingLetterObj.guaranteed_percentage) || 80;
    const maxAmt = Math.round(estNum * (pctNum / 100));
    const restAmt = Math.max(0, estNum - maxAmt);

    const letterToSave = {
      ...editingLetterObj,
      id: editingLetterObj.id || Date.now(),
      estimated_amount: estNum,
      guaranteed_percentage: pctNum,
      max_amount: maxAmt,
      patient_rest: restAmt,
      validation_code: editingLetterObj.validation_code || `GAR-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      created_at: editingLetterObj.created_at || new Date().toISOString()
    };

    let updated;
    if (isNewLetterObj) {
      updated = [letterToSave, ...letters];
    } else {
      updated = letters.map(item => item.id === letterToSave.id ? letterToSave : item);
    }

    setLetters(updated);
    try {
      localStorage.setItem('unamusc_guarantee_letters', JSON.stringify(updated));
    } catch(err) {}

    setEditingLetterObj(null);
    setIsNewLetterObj(false);
  };

  const handleDeleteLetterObj = (item) => {
    setConfirmDeleteObj({
      title: `la lettre de garantie "${item.medical_act || 'Garantie'}" de ${item.first_name} ${item.last_name}`,
      onConfirm: () => {
        const updated = letters.filter(l => l.id !== item.id);
        setLetters(updated);
        try {
          localStorage.setItem('unamusc_guarantee_letters', JSON.stringify(updated));
        } catch(err) {}
      }
    });
  };

  // State pour le simulateur public de devis UNAMUSC
  const [simAmount, setSimAmount] = useState(250000);
  const [simType, setSimType] = useState('hospital'); // 'hospital' | 'pharmacy'

  // Informations assuré actif
  const activeCmuNumber = citizenUser?.cmu_number || citizenUser?.cmuNumber || localStorage.getItem('cmu-active-number') || 'SN-DK-MED-8472';
  const activeFirstName = citizenUser?.first_name || citizenUser?.firstName || 'Modou';
  const activeLastName = citizenUser?.last_name || citizenUser?.lastName || 'Diop';

  const isStudent = (citizenUser?.packageType === 'scolaire' || (citizenUser?.firstName || '').toLowerCase().includes('ibrahima'));
  const isBsf = (citizenUser?.packageType === 'gratuité' || (citizenUser?.firstName || '').toLowerCase().includes('fatou'));

  const userLetters = [
    {
      id: 101,
      first_name: activeFirstName,
      last_name: activeLastName,
      cmu_number: getBeneficiaryCode(activeCmuNumber, 1),
      ipp_number: `IPP-DKR-${getAdherentCode(activeCmuNumber).slice(-4)}`,
      hospital_name: isStudent ? 'Centre Médical Universitaire UCAD / Hôpital Fann' : isBsf ? 'Hôpital Aristide Le Dantec (Dakar)' : 'Polyclinique de la Médina',
      medical_act: isStudent ? 'Consultation & soins de santé étudiants — (Gratuité CSU Jeunes)' : isBsf ? 'Prise en charge d\'urgence & soins généraux — (Bourse Sécurité Familiale)' : 'Intervention chirurgicale ORL & consultation spécialisée',
      estimated_amount: isStudent ? 120000 : isBsf ? 350000 : 250000,
      guaranteed_percentage: isStudent ? 100 : isBsf ? 100 : 80,
      max_amount: isStudent ? 120000 : isBsf ? 350000 : 200000,
      patient_rest: isStudent ? 0 : isBsf ? 0 : 50000,
      status: 'approved',
      validation_code: `GAR-2026-${getAdherentCode(activeCmuNumber).slice(-4)}`,
      created_at: new Date().toISOString(),
      agent_note: isStudent 
        ? 'Prise en charge 100% accordée au titre de la gratuité CSU Jeunes & Étudiants (UNAMUSC).' 
        : isBsf 
        ? 'Prise en charge 100% accordée au titre du filet social Bourse de Sécurité Familiale (BSF).' 
        : 'Prise en charge 80% validée sous le système de Tiers-payant UNAMUSC Dakar.'
    },
    {
      id: 102,
      first_name: 'Amadou',
      last_name: 'Sow',
      cmu_number: getBeneficiaryCode(activeCmuNumber, 2),
      ipp_number: `IPP-FANN-${getAdherentCode(activeCmuNumber).slice(-4)}`,
      hospital_name: 'Hôpital Universitaire de Fann (Dakar)',
      medical_act: 'Intervention chirurgicale ORL — (Hôpital Universitaire de Fann)',
      estimated_amount: 250000,
      guaranteed_percentage: 80,
      max_amount: 200000,
      patient_rest: 50000,
      status: 'pending',
      validation_code: `GAR-2026-FANN-88`,
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      agent_note: 'Dossier en cours d\'instruction par l\'agent UNAMUSC.'
    },
    ...defaultLetters
  ];

  const [letters, setLetters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'new'

  // Formulaire de demande (Assuré ou Structure Sanitaire Conventionnée)
  const [applicantFirstName, setApplicantFirstName] = useState(activeFirstName);
  const [applicantLastName, setApplicantLastName] = useState(activeLastName);
  const [applicantCmu, setApplicantCmu] = useState(activeCmuNumber);
  const [medicalAct, setMedicalAct] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [structureName, setStructureName] = useState('Hôpital Universitaire de Fann (Dakar)');
  const [isSeniorSesame, setIsSeniorSesame] = useState(false); // Plan SESAME 60 ans et plus
  const [emergencyTimeInfo, setEmergencyTimeInfo] = useState(getEmergencyIssuanceStatus());
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [prescriptionPhoto, setPrescriptionPhoto] = useState('');
  const [prescriptionPreview, setPrescriptionPreview] = useState('');

  // Actualise le contexte horaire (Garde 17h-7h59 / Week-end 24h/24)
  useEffect(() => {
    setEmergencyTimeInfo(getEmergencyIssuanceStatus());
  }, [activeTab]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPrescriptionPhoto(reader.result);
        setPrescriptionPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Instruction Agent & Modal
  const [selectedLetter, setSelectedLetter] = useState(null);
  const [modalTab, setModalTab] = useState('instruction'); // 'instruction' | 'certificate'
  const [guaranteedPct, setGuaranteedPct] = useState(80);
  const [maxAmount, setMaxAmount] = useState('');
  const [agentNote, setAgentNote] = useState('Prise en charge validée par l\'agent UNAMUSC sous le système de Tiers-payant UNAMUSC.');

  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guarantees');
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setLetters(json.data);
      } else {
        setLetters(citizenUser ? userLetters : defaultLetters);
      }
    } catch (err) {
      console.warn('Utilisation des garanties de démonstration:', err);
      setLetters(citizenUser ? userLetters : defaultLetters);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  // Fonction dédiée de génération et d'impression / téléchargement PDF A4 de la Lettre de Garantie
  const generateAndPrintPDFWindow = (letterToPrint = selectedLetter) => {
    const letter = letterToPrint || selectedLetter || letters[0];
    if (!letter) return;

    const guaranteeAmt = letter.guaranteed_amount || letter.max_amount || (letter.estimated_amount * ((letter.guaranteed_percentage || 80) / 100));
    const patientRest = Math.max(0, letter.estimated_amount - guaranteeAmt);
    const bInfo = getBeneficiaryInfo(`${letter.first_name} ${letter.last_name}`, letter.cmu_number || activeCmuNumber);

    const printWin = window.open('', '_blank', 'width=980,height=1150');
    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Attestation_Prise_En_Charge_UNAMUSC_${letter.validation_code}.pdf</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { background: #ffffff !important; color: #0f172a !important; font-family: 'Inter', Arial, sans-serif; padding: 1.5rem; }
            .cert-box { border: 2.5px solid #047857; border-radius: 16px; padding: 2rem; background: #ffffff; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .no-print { margin-bottom: 1.5rem; text-align: center; }
            @media print {
              .no-print { display: none !important; }
              body { padding: 0 !important; }
              .cert-box { border-width: 2px !important; box-shadow: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" class="btn btn-success fw-bold px-4 py-2 me-2" style="background: #059669; border-color: #059669;">🖨️ Imprimer / Télécharger le PDF A4</button>
            <button onclick="window.close()" class="btn btn-secondary fw-bold px-3 py-2">Fermer la fenêtre</button>
          </div>

          <div class="cert-box">
            <!-- Entête Officiel Sénégal & UNAMUSC -->
            <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style="border-color: #cbd5e1 !important;">
              <div class="d-flex align-items-center gap-3">
                <img src="/senegal_flag.png" alt="Drapeau du Sénégal" style="width: 54px; height: 36px; object-fit: cover; border-radius: 4px; border: 1.5px solid #d97706;" />
                <div>
                  <h6 class="fw-bold mb-0 text-uppercase" style="color: #047857; letter-spacing: 0.5px;">RÉPUBLIQUE DU SÉNÉGAL</h6>
                  <small class="text-muted fw-semibold" style="font-size: 0.75rem;">Un Peuple - Un But - Une Foi</small><br />
                  <strong class="small text-uppercase" style="color: #0f172a; font-size: 0.82rem;">UNION NATIONALE DES MUTUELLES DE SANTÉ COMMUNAUTAIRES (UNAMUSC)</strong><br />
                  <span class="badge bg-success-subtle text-success border border-success fw-semibold" style="font-size: 0.72rem;">PROGRAMME NATIONAL DE LA COUVERTURE SANITAIRE DU SÉNÉGAL</span>
                </div>
              </div>
              <div class="text-end">
                <img src="/unamusc_logo.png" alt="UNAMUSC Sénégal" style="width: 85px; height: auto; object-fit: contain;" />
              </div>
            </div>

            <!-- Titre de l'Attestation -->
            <div class="text-center my-4 p-4 rounded-3" style="background: linear-gradient(135deg, rgba(5, 150, 105, 0.85) 0%, rgba(4, 120, 87, 0.9) 100%), url("/csu_claims_hero.png") center/cover no-repeat; border: 1px solid rgba(255,255,255,0.3); color: #fff;">
              <h4 class="fw-bold mb-1" style="color: #ffffff; letter-spacing: 0.3px;">Attestation officielle de prise en charge hospitalière</h4>
              <small style="color: rgba(255,255,255,0.9); font-weight: 600;">Émise sous le système de tiers-payant UNAMUSC : programme national de la couverture sanitaire du Sénégal</small><br />
              <code class="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6">Code homologation : #${letter.validation_code}</code>
            </div>

            <!-- Grille des caractéristiques & prise en charge -->
            <div class="row g-4 mb-4 p-4 rounded-3" style="background: #f8fafc; border: 1.5px solid #cbd5e1;">
              <div class="col-6">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">👤 BÉNÉFICIAIRE ASSURÉ(E) :</span>
                <h5 class="fw-bold mb-1" style="color: #0f172a;">${letter.first_name} ${letter.last_name}</h5>
                <div class="small mb-1" style="color: #334155;">
                  <strong>N° CSU Bénéficiaire :</strong> <span style="color: #047857; font-weight: bold; font-family: monospace;">${bInfo.beneficiaryCode}</span> <span class="badge bg-success-subtle text-success border border-success" style="font-size: 0.68rem;">${bInfo.index === 1 ? 'Titulaire .1' : 'Ayant droit .' + bInfo.index}</span>
                </div>
                <div class="small" style="color: #475569;">
                  <strong>Code Adhérent principal :</strong> <span style="font-weight: bold; font-family: monospace;">${bInfo.adherentCode}</span> | IPP : <strong>${letter.ipp_number || 'IPP-FANN-2026-8812'}</strong>
                </div>
                <small class="text-success fw-bold d-block mt-1.5">Organisme Émetteur : Tiers-payant UNAMUSC Sénégal</small>
              </div>

              <div class="col-6">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">🏥 STRUCTURE HOSPITALIÈRE D'ACCUEIL :</span>
                <h6 class="fw-bold mb-1" style="color: #047857; font-size: 1rem;">${letter.hospital_name || letter.medical_act}</h6>
                <div class="small" style="color: #334155;">Conventionné Tiers-payant UNAMUSC (Validation 100% Humaine)</div>
              </div>

              <div class="col-6 border-top pt-3" style="border-color: #e2e8f0 !important;">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">📋 ACTE MÉDICAL : HOSPITALISATION PRESCRITE :</span>
                <strong class="d-block" style="color: #0f172a; font-size: 0.95rem;">${letter.medical_act}</strong>
              </div>

              <div class="col-6 border-top pt-3" style="border-color: #e2e8f0 !important;">
                <span class="small fw-bold d-block mb-1 text-muted text-uppercase">💰 MONTANT ESTIMÉ & ACCORD DE PRISE EN CHARGE :</span>
                <div class="small" style="color: #334155;">
                  Devis Soumis : <strong>${Number(letter.estimated_amount).toLocaleString()} FCFA</strong><br />
                  ${letter.is_sesame || letter.is_senior ? `
                    <span class="badge bg-warning text-dark fw-bold mb-1">🧓 Bénéficiaire Plan SESAME (60 ans et +)</span><br />
                    Prise en charge UNAMUSC (80%) : <strong style="color: #047857;">${Number(letter.unamusc_amount || letter.estimated_amount * 0.8).toLocaleString()} FCFA</strong><br />
                    Contrepartie Plan SESAME État (20%) : <strong style="color: #d97706;">${Number(letter.sesame_amount || letter.estimated_amount * 0.2).toLocaleString()} FCFA</strong><br />
                    <span style="color: #059669; font-weight: bold; font-size: 1rem;">Reste à payer assuré senior : 0 FCFA (Prise en charge 100%)</span>
                  ` : `
                    Prise en charge UNAMUSC (${letter.guaranteed_percentage || 80}%) : <strong style="color: #047857; font-size: 1.05rem;">${Number(guaranteeAmt).toLocaleString()} FCFA</strong><br />
                    <span style="color: #b45309; font-weight: bold;">Reste à charge patient (Ticket Modérateur 20%) : ${Number(patientRest).toLocaleString()} FCFA</span>
                  `}
                </div>
              </div>
            </div>

            <!-- Engagement Financier UNAMUSC & Tampon Numérique QR Code -->
            <div class="row align-items-center p-3 rounded-3" style="background: #f1f5f9; border: 1px solid #cbd5e1;">
              <div class="col-8">
                <span class="small fw-bold text-uppercase d-block mb-1" style="color: #047857;">Clause officielle d'engagement financier UNAMUSC :</span>
                <p class="small mb-0 text-secondary" style="font-size: 0.78rem; line-height: 1.45;">
                  ${letter.agent_note || 'L\'UNAMUSC s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture conforme.'}
                </p>
                ${letter.is_emergency_issuance ? `
                  <div class="mt-2 text-primary fw-bold" style="font-size: 0.76rem;">
                    🚨 Délivrance d'Urgence Permanente : ${letter.emergency_period === 'weekend' ? 'Week-End (24h/24)' : 'Garde de Nuit (17h00 - 07h59)'} • Soins garantis 7j/7.
                  </div>
                ` : ''}
              </div>

              <div class="col-4 text-center">
                <div class="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-2">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://mutualis.sn/#/verify/${letter.validation_code}`)}" alt="QR Code Validation" style="width: 80px; height: 80px;" />
                </div>
                <div class="small fw-bold text-success">Tampon Numérique Officiel UNAMUSC</div>
                <small class="text-muted d-block" style="font-size: 0.72rem;">Homologué par l'UNAMUSC : Signature Agent Habilité</small>
              </div>
            </div>
          </div>

          <script>
            setTimeout(() => { window.print(); }, 400);
          </script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  const handlePrintCertificate = () => {
    generateAndPrintPDFWindow(selectedLetter);
  };

  const handleDownloadPDF = (letterToPrint = selectedLetter) => {
    const letter = letterToPrint || selectedLetter || letters[0];
    if (!letter) return;
    const guaranteeAmt = letter.guaranteed_amount || letter.max_amount || (letter.estimated_amount * ((letter.guaranteed_percentage || 80) / 100));
    const bInfo = getBeneficiaryInfo(`${letter.first_name} ${letter.last_name}`, letter.cmu_number || activeCmuNumber);
    const isSenior = letter.is_sesame || letter.is_senior;

    generateOfficialPdf({
      filename: `lettre_garantie_${letter.validation_code}.pdf`,
      docType: isSenior 
        ? 'LETTRE DE GARANTIE HOSPITALIÈRE — CONVENTION PLAN SESAME (100%)' 
        : 'LETTRE DE GARANTIE HOSPITALIÈRE HABILITÉE (80%)',
      title: 'Attestation de Prise en Charge Hospitalière',
      referenceNo: letter.validation_code,
      beneficiaryName: `${letter.first_name} ${letter.last_name}`,
      cmuNumber: bInfo.beneficiaryCode,
      structureName: letter.hospital_name || 'Hôpital Universitaire de Fann (Dakar)',
      details: isSenior ? [
        { label: 'N° CSU Bénéficiaire', value: `${bInfo.beneficiaryCode} (${bInfo.index === 1 ? 'Titulaire .1' : 'Ayant droit .' + bInfo.index})` },
        { label: 'Régime Spécial', value: 'Plan SESAME (Personne âgée de 60 ans et plus)' },
        { label: 'Acte Médical / Intervention', value: letter.medical_act },
        { label: 'Établissement Récepteur', value: letter.hospital_name || 'Hôpital Universitaire de Fann' },
        { label: 'Montant Devis Soumis', value: `${Number(letter.estimated_amount).toLocaleString()} FCFA` },
        { label: 'Prise en Charge UNAMUSC (80%)', value: `${Number(letter.unamusc_amount || letter.estimated_amount * 0.8).toLocaleString()} FCFA` },
        { label: 'Contrepartie Plan SESAME État (20%)', value: `${Number(letter.sesame_amount || letter.estimated_amount * 0.2).toLocaleString()} FCFA` },
        { label: 'Reste à charge Patient Senior', value: '0 FCFA (Prise en charge intégrale à 100%)' }
      ] : [
        { label: 'N° CSU Bénéficiaire', value: `${bInfo.beneficiaryCode} (${bInfo.index === 1 ? 'Titulaire .1' : 'Ayant droit .' + bInfo.index})` },
        { label: 'Code Adhérent principal', value: bInfo.adherentCode },
        { label: 'Acte Médical / Intervention', value: letter.medical_act },
        { label: 'Établissement Récepteur', value: letter.hospital_name || 'Hôpital Universitaire de Fann' },
        { label: 'Montant Devis Soumis', value: `${Number(letter.estimated_amount).toLocaleString()} FCFA` },
        { label: 'Prise en Charge UNAMUSC (80%)', value: `${Number(guaranteeAmt).toLocaleString()} FCFA (${letter.guaranteed_percentage || 80}%)` },
        { label: 'Ticket Modérateur Patient (20%)', value: `${Number(Math.max(0, letter.estimated_amount - guaranteeAmt)).toLocaleString()} FCFA` }
      ],
      notes: letter.agent_note || 'L\'UNAMUSC s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture conforme.'
    });
  };

  // Filtrage strict selon le rôle (RBAC) & Confidentialité des données de santé
  const visibleLetters = letters.filter((item) => {
    // SuperAdmin, agent (instruction), médecin/sage-femme (consultation patients) : voient tous les dossiers
    if (isSuperAdmin || isAgent) return true;
    if (isDoctor || isMidwife) return true; // Consultation des dossiers liés aux patients
    if (isPharmacist) return false; // Pharmacien : non concerné par les lettres de garantie
    if (isCitizen) {
      // L'assuré connecté ne voit STRICTEMENT QUE SES PROPRES DEMANDES
      const cmuMatch = (item.cmu_number || '').trim().toLowerCase() === activeCmuNumber.trim().toLowerCase();
      const nameMatch = (item.first_name || '').trim().toLowerCase() === activeFirstName.trim().toLowerCase() &&
                        (item.last_name || '').trim().toLowerCase() === activeLastName.trim().toLowerCase();
      return cmuMatch || nameMatch;
    }
    // Visiteur public non connecté : masquage strict des dossiers d'autrui
    if (publicSearchCmu.trim()) {
      return item.cmu_number.toLowerCase().includes(publicSearchCmu.trim().toLowerCase());
    }
    return false;
  });

  const handleRegularizeEmergency = (letterItem) => {
    const updatedLetters = letters.map(l => {
      if (l.id === letterItem.id) {
        return {
          ...l,
          status: 'approved',
          regularized_at: new Date().toISOString(),
          agent_note: `${l.agent_note || ''} [✅ Régularisé et homologué par l'agent mutualiste UNAMUSC le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}].`
        };
      }
      return l;
    });
    setLetters(updatedLetters);
    try {
      localStorage.setItem('unamusc_guarantee_letters', JSON.stringify(updatedLetters));
    } catch (e) {}
    alert(`✅ La prise en charge d'urgence #${letterItem.validation_code} pour ${letterItem.first_name} ${letterItem.last_name} a été régularisée et homologuée avec succès !`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!medicalAct || !estimatedAmount) return;
    setSubmitting(true);
    setSuccessMsg('');

    const estVal = parseFloat(estimatedAmount) || 0;
    const timeStatus = emergencyTimeInfo || getEmergencyIssuanceStatus();

    if (requestCategory === 'hospital') {
      // 1. Calcul des taux selon le profil (Senior Plan SESAME 60 ans+ vs Standard 80/20)
      const isSenior = Boolean(isSeniorSesame);
      const gPct = isSenior ? 100 : 80;
      const unamuscAmt = estVal * 0.8;
      const sesameAmt = isSenior ? estVal * 0.2 : 0;
      const maxAmt = isSenior ? estVal : unamuscAmt;
      const patientRest = isSenior ? 0 : estVal * 0.2;

      // 2. Continuité 7j/7 : statut d'urgence immédiat si émise en garde (17h-7h59) ou week-end (24h/24)
      const isEmerg = timeStatus.isEmergency;
      const initialStatus = isEmerg ? 'emergency_issued' : 'pending';

      const newLetter = {
        id: Date.now(),
        first_name: applicantFirstName || activeFirstName,
        last_name: applicantLastName || activeLastName,
        cmu_number: applicantCmu || activeCmuNumber,
        ipp_number: `IPP-DKR-${Date.now().toString().slice(-4)}`,
        hospital_name: structureName,
        medical_act: `${medicalAct} — (${structureName})`,
        estimated_amount: estVal,
        guaranteed_percentage: gPct,
        unamusc_percentage: 80,
        sesame_percentage: isSenior ? 20 : 0,
        unamusc_amount: unamuscAmt,
        sesame_amount: sesameAmt,
        max_amount: maxAmt,
        patient_rest: patientRest,
        is_sesame: isSenior,
        is_senior: isSenior,
        is_emergency_issuance: isEmerg,
        emergency_period: timeStatus.period,
        status: initialStatus,
        validation_code: `GAR-2026-${isSenior ? 'SESAME' : isEmerg ? 'URG' : 'FANN'}-${Math.floor(100 + Math.random() * 900)}`,
        created_at: new Date().toISOString(),
        prescription_photo: prescriptionPhoto || '/ordonnance_demo.jpg',
        agent_note: isSenior
          ? `🧓 Bénéficiaire Plan SESAME (60 ans et +). Prise en charge intégrale 100% sans reste à charge : UNAMUSC (${unamuscAmt.toLocaleString()} FCFA / 80%) + Contrepartie Plan SESAME État du Sénégal (${sesameAmt.toLocaleString()} FCFA / 20%).`
          : isEmerg
          ? `🌙 Délivrée d'urgence par la structure sanitaire conventionnée en ${timeStatus.label}. Soins immédiats autorisés 7j/7. En attente de régularisation administrative par l'agent le ${timeStatus.regularizationDue}.`
          : 'Demande soumise sous le Tiers-payant UNAMUSC (80% mutuelle, 20% ticket modérateur assuré).'
      };

      try {
        await fetch('/api/guarantees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beneficiary_id: 1,
            medical_act: newLetter.medical_act,
            estimated_amount: newLetter.estimated_amount,
            prescription_photo: newLetter.prescription_photo
          })
        });
      } catch (err) {
        console.warn(err);
      }

      setLetters([newLetter, ...letters]);
      setSuccessMsg(lang === 'wo' 
        ? 'Demande bi yónnee nañu ko ak jamm. Fajukaay bi mën na la fajj léegi.' 
        : isEmerg 
        ? '🚨 Prise en charge d\'urgence délivrée avec succès ! Les soins sont immédiatement autorisés à l\'hôpital. L\'agent mutualiste régularisera le dossier.' 
        : 'Votre demande de lettre de garantie hospitalière a été soumise avec succès !');
    } else {
      // Création d'un Bon de Commande de Médicaments (Pharmacie Tiers-payant 50% / 50%)
      const pharmCovered = estVal * 0.5;
      const pharmRest = estVal * 0.5;
      const newOrder = {
        id: Date.now(),
        first_name: applicantFirstName || activeFirstName,
        last_name: applicantLastName || activeLastName,
        cmu_number: applicantCmu || activeCmuNumber,
        items_json: JSON.stringify([
          { name: medicalAct, qty: 1, price: estVal }
        ]),
        total_amount: estVal,
        cmu_covered: pharmCovered,
        patient_pay: pharmRest,
        status: prescriptionPhoto ? 'pending_review' : 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        prescription_photo: prescriptionPhoto || '/ordonnance_demo.jpg',
        order_code: `ORD-2026-PHARM-${Math.floor(100 + Math.random() * 900)}`
      };

      const currentOrders = JSON.parse(localStorage.getItem('cmu_purchase_orders') || '[]');
      localStorage.setItem('cmu_purchase_orders', JSON.stringify([newOrder, ...currentOrders]));

      setSuccessMsg(prescriptionPhoto 
        ? `Votre Bon de Commande Pharmacie (${newOrder.order_code}) et votre ordonnance ont été soumis. Le gérant UNAMUSC vérifiera l'ordonnance avant d'activer votre bon (Tiers-payant 50%). Vous serez notifié dès validation.`
        : `Votre Bon de Commande Pharmacie (${newOrder.order_code}) a été généré (Prise en charge UNAMUSC 50%). Valable 48h dans toute pharmacie agréée UNAMUSC.`);
    }

    setMedicalAct('');
    setEstimatedAmount('');
    setActiveTab('list');
    setSubmitting(false);
  };

  const handleValidateAgent = async (status) => {
    if (!selectedLetter) return;
    const finalGuarantee = maxAmount !== '' ? (parseFloat(maxAmount) || 0) : (selectedLetter.estimated_amount * (guaranteedPct / 100));
    const finalPct = selectedLetter.estimated_amount > 0 
      ? Math.min(100, Math.max(0, Math.round((finalGuarantee / selectedLetter.estimated_amount) * 100))) 
      : parseFloat(guaranteedPct);
    const finalRest = Math.max(0, selectedLetter.estimated_amount - finalGuarantee);

    const updatedLetter = {
      ...selectedLetter,
      status,
      guaranteed_percentage: finalPct,
      max_amount: finalGuarantee,
      patient_rest: finalRest,
      agent_note: agentNote || (status === 'approved' ? 'Prise en charge accordée par l\'UNAMUSC.' : 'Demande rejetée.')
    };

    const updated = letters.map(l => l.id === selectedLetter.id ? updatedLetter : l);
    setLetters(updated);

    try {
      await fetch(`/api/guarantees/${selectedLetter.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          guaranteed_percentage: finalPct,
          max_amount: finalGuarantee,
          agent_note: agentNote
        })
      });
    } catch (err) {
      console.warn(err);
    }

    // Basculer sur l'onglet certificat si approuvé
    if (status === 'approved') {
      setSelectedLetter(updatedLetter);
      setModalTab('certificate');
    } else {
      setSelectedLetter(null);
    }
  };

  const handlePctChange = (val) => {
    const pct = parseFloat(val) || 0;
    setGuaranteedPct(pct);
    if (selectedLetter && selectedLetter.estimated_amount > 0) {
      const calculatedMax = Math.round(selectedLetter.estimated_amount * (pct / 100));
      setMaxAmount(calculatedMax);
    }
  };

  const handleMaxAmountChange = (val) => {
    setMaxAmount(val);
    if (selectedLetter && selectedLetter.estimated_amount > 0) {
      const numericVal = parseFloat(val);
      if (!isNaN(numericVal)) {
        const calculatedPct = Math.min(100, Math.max(0, Math.round((numericVal / selectedLetter.estimated_amount) * 100)));
        setGuaranteedPct(calculatedPct);
      }
    }
  };

  const openInstructionModal = (item) => {
    setSelectedLetter(item);
    const initialMax = item.max_amount !== undefined ? item.max_amount : (item.estimated_amount * 0.8);
    const initialPct = item.guaranteed_percentage !== undefined 
      ? item.guaranteed_percentage 
      : (item.estimated_amount > 0 ? Math.round((initialMax / item.estimated_amount) * 100) : 80);

    setGuaranteedPct(initialPct);
    setMaxAmount(initialMax);
    setAgentNote(item.agent_note || 'Devis et dossier médical vérifiés conformes par l\'UNAMUSC.');
    setModalTab('instruction');
  };

  // KPIs
  const totalPending = letters.filter(l => l.status === 'pending').length;
  const totalApproved = letters.filter(l => l.status === 'approved').length;
  const totalGuaranteedSum = letters.filter(l => l.status === 'approved').reduce((acc, l) => acc + (l.max_amount || 0), 0);

  // ── LABORATOIRE & BIOLOGIE : Périmètre d'imagerie et d'analyses ──
  if (isLabUser) {
    const handleConfirmUpload = (e) => {
      e.preventDefault();
      if (!uploadLabTargetOrder) return;
      const updated = labOrdersState.map(o => {
        if (o.id === uploadLabTargetOrder.id) {
          return {
            ...o,
            status: 'transmis',
            fileName: uploadLabFileName || (uploadLabTargetOrder.id === 1 ? 'Bilan_Sanguin_Amadou_Sow.pdf' : 'Radio_Thorax_DICOM_Fatou_Diop.dcm'),
            notes: uploadLabNotes || 'Résultats validés par le Dr. Ousmane Kane (Biologiste).'
          };
        }
        return o;
      });
      setLabOrdersState(updated);
      try { localStorage.setItem('unamusc_lab_orders', JSON.stringify(updated)); } catch (err) {}

      // Add to DMP exams list in localStorage (Global & Patient-specific)
      try {
        const patientCmu = uploadLabTargetOrder.cmuNumber;
        const existingExams = JSON.parse(localStorage.getItem('cmu-medical-exams') || '[]');
        const patientExams = JSON.parse(localStorage.getItem(`cmu-exams-${patientCmu}`) || '[]');
        
        const newExam = {
          id: Date.now(),
          title: uploadLabTargetOrder.examName,
          exam_type: uploadLabTargetOrder.id === 2 ? 'Radiographie DICOM' : 'Bilan Biologique',
          badge: uploadLabTargetOrder.id === 2 ? 'HD DICOM' : 'LABORATOIRE',
          facility: partnerUser?.structureName || 'Laboratoire Pasteur Dakar',
          doctor: uploadLabTargetOrder.doctor,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          conclusion: uploadLabNotes || (uploadLabTargetOrder.id === 2 ? 'Série DICOM transmise au DMP. Examen de contrôle pulmonaire satisfaisant.' : 'Bilan sanguin complet dans les normes. Glycémie à jeun : 0.94 g/L.'),
          cliches: uploadLabTargetOrder.id === 2 ? 5 : 1,
          preview: uploadLabTargetOrder.id === 2 ? '/csu_dicom_xray.png' : '/csu_digital_health_real.jpg'
        };

        localStorage.setItem(`cmu-exams-${patientCmu}`, JSON.stringify([newExam, ...patientExams]));
        localStorage.setItem('cmu-medical-exams', JSON.stringify([newExam, ...existingExams]));
      } catch (e) {}

      alert(`✅ Fichier et compte-rendu certifiés transmis au Dossier Médical Partagé (DMP) pour ${uploadLabTargetOrder.patientName} (${uploadLabTargetOrder.cmuNumber}) !`);
      setUploadLabTargetOrder(null);
      setUploadLabFileName('');
      setUploadLabNotes('');
    };

    return (
      <div className="container-fluid px-4 py-4 fade-in-up">
        {/* HERO BANNER - ESPACE LABORATOIRE & IMAGERIE (VERT ÉMERAUDE) */}
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
                Périmètre de votre profil laboratoire
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Conformément aux directives du Ministère de la Santé, la gestion des lettres de garantie hospitalières est attribuée aux établissements récepteurs. Votre compte ({partnerUser?.structureName || 'Laboratoire / Établissement de santé conventionné'}) est dédié aux bilans biologiques, analyses sanguines et clichés radiologiques.
              </p>

              <div className="d-flex align-items-center flex-wrap mt-4" style={{ gap: '28px', rowGap: '16px' }}>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: '#047857', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', marginRight: '16px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/medical-profile')}>
                  🩻 Accéder au dossier & radios DICOM
                </button>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', marginLeft: '4px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/verify')}>
                  🔍 Vérifier la carte CSU d'un assuré
                </button>
              </div>
            </div>

            <div className="col-lg-4 d-none d-lg-block text-center">
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>
                <img src="/csu_dicom_xray.png" alt="Laboratoire & Imagerie UNAMUSC" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {/* CONTENU DU HUB LABORATOIRE — Bilans d'examens prescrits */}
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4">
            <div>
              <h4 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                <span>🧪</span> Bilans sanguins & Examens d'imagerie prescrits
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '0.88rem' }}>
                Demandes d'analyses et de clichés d'imagerie transmises par les médecins conventionnés (Tiers-payant UNAMUSC 80% - 100%).
              </p>
            </div>
            
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button 
                type="button" 
                className="btn btn-emerald fw-bold text-white px-3.5 py-2 d-inline-flex align-items-center gap-2 shadow-sm" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem' }}
                onClick={() => {
                  setIsNewLabOrder(true);
                  setEditingLabOrder({
                    patientName: '',
                    cmuNumber: 'CSU-DKR-2026-8812.2',
                    examName: '',
                    examDetail: '',
                    doctor: 'Dr. Cheikh Anta Diop (Abass Ndao)',
                    coverage: '80% UNAMUSC',
                    status: 'prescrit',
                    fileName: null,
                    notes: ''
                  });
                }}
              >
                <span>➕ Prescrire un nouvel examen / bilan</span>
              </button>

              <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px', fontSize: '0.82rem' }}>
                🟢 Tiers-payant Actif
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)', minWidth: '1500px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Assuré & N° CSU</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Examen / Bilan prescrit</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Médecin prescripteur</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Prise en charge</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em', textAlign: 'right', minWidth: '450px' }}>Actions & Laboratoire</th>
                </tr>
              </thead>
              <tbody>
                {labOrdersState.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.05rem' }}>
                          👤
                        </div>
                        <div>
                          <strong className="d-block" style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{order.patientName}</strong>
                          <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '6px' }}>
                            {order.cmuNumber}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div className="fw-bold text-primary d-block mb-1" style={{ fontSize: '0.95rem' }}>
                        {order.examName || (order.id === 2 ? 'Radiographie pulmonaire & Scanner DICOM' : 'Bilan sanguin complet & sérologies')}
                      </div>
                      <div className="text-muted small d-block" style={{ fontSize: '0.82rem', lineHeight: '1.35' }}>
                        {order.examDetail || (order.id === 2 ? 'Imagerie thoracique de contrôle' : 'NFS, glycémie, bilan hépatique')}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="fw-semibold d-block" style={{ fontSize: '0.9rem' }}>👨‍⚕️ {order.doctor}</span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${order.coverage?.includes('100%') ? 'bg-success' : 'bg-emerald-600'} text-white px-3 py-1.5 fw-bold`} style={{ borderRadius: '10px', fontSize: '0.8rem', background: '#059669' }}>
                        {order.coverage}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', minWidth: '450px', whiteSpace: 'nowrap' }}>
                      <div className="d-flex align-items-center justify-content-end gap-3 flex-nowrap">
                        {order.status === 'transmis' ? (
                          <span className="badge bg-success text-white px-3 py-2 fw-bold" style={{ borderRadius: '10px', fontSize: '0.82rem' }}>
                            ✅ Transmis au DMP
                          </span>
                        ) : (
                          <button 
                            className="btn btn-sm btn-emerald fw-bold text-white px-3 py-2" 
                            style={{ background: '#059669', border: 'none', borderRadius: '10px', fontSize: '0.84rem', boxShadow: '0 4px 12px rgba(5,150,105,0.25)' }}
                            onClick={() => setUploadLabTargetOrder(order)}
                          >
                            {order.examName?.toLowerCase().includes('radio') || order.examName?.toLowerCase().includes('dicom') || order.id === 2 ? '🩻 Joindre DICOM' : '📤 Transmettre PDF'}
                          </button>
                        )}

                        {/* Bouton MODIFIER Examen */}
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
                          title="Modifier les informations de l'examen"
                          onClick={() => {
                            setEditingLabOrder({ ...order });
                            setIsNewLabOrder(false);
                          }}
                        >
                          ✏️ Modifier
                        </button>

                        {/* Bouton SUPPRIMER Examen */}
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
                          title="Supprimer la prescription"
                          onClick={() => handleDeleteLabOrder(order)}
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

        {/* MODAL DE TÉLÉVERSEMENT EXAMEN POUR ASSURÉ SPÉCIFIQUE (React Portal) */}
        {uploadLabTargetOrder && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setUploadLabTargetOrder(null); }}
          >
            <form onSubmit={handleConfirmUpload} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              {/* Modal Header */}
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold', boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)' }}>
                    {uploadLabTargetOrder.id === 2 ? '🩻' : '🧪'}
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      {uploadLabTargetOrder.id === 2 ? 'Transmettre le cliché DICOM' : 'Téléverser le bilan biologique PDF'}
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC • Tiers-payant {uploadLabTargetOrder.coverage}
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setUploadLabTargetOrder(null)}></button>
              </div>

              {/* Patient Info Card Banner */}
              <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2.5">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.1rem' }}>👤</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{uploadLabTargetOrder.patientName}</strong>
                  </div>
                  <code className="bg-success text-white px-2.5 py-1 rounded-3 fw-bold small">{uploadLabTargetOrder.cmuNumber}</code>
                </div>

                <div className="d-flex flex-column gap-2 mt-2 pt-2.5 border-top" style={{ borderColor: 'var(--border-color)', fontSize: '0.88rem' }}>
                  <div>
                    <span className="text-muted fw-semibold">📋 Examen prescrit : </span>
                    <strong className="text-primary">{uploadLabTargetOrder.examName}</strong>
                  </div>
                  <div>
                    <span className="text-muted fw-semibold">👨‍⚕️ Médecin prescripteur : </span>
                    <strong style={{ color: 'var(--text-main)' }}>{uploadLabTargetOrder.doctor}</strong>
                  </div>
                </div>
              </div>

              {/* File Selector Zone */}
              <div className="mb-4">
                <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  📁 Sélectionner le fichier ({uploadLabTargetOrder.id === 2 ? 'Format .DCM, .ZIP ou cliché radiologique' : 'Document PDF d\'analyses certifié'}) *
                </label>

                <div style={{ border: '2px dashed #10b981', borderRadius: '18px', padding: '1.75rem 1.25rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.04)', transition: 'all 0.2s ease' }}>
                  <input 
                    type="file" 
                    id="lab-file-upload-input"
                    accept={uploadLabTargetOrder.id === 2 ? ".dcm,.zip,.png,.jpg" : ".pdf,.png,.jpg"} 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadLabFileName(e.target.files[0].name);
                      }
                    }}
                  />
                  <label htmlFor="lab-file-upload-input" style={{ cursor: 'pointer', margin: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      {uploadLabTargetOrder.id === 2 ? '🩻' : '📄'}
                    </div>
                    <strong className="d-block text-primary" style={{ fontSize: '0.94rem' }}>
                      {uploadLabFileName ? `✓ Fichier sélectionné : ${uploadLabFileName}` : 'Cliquez ici pour choisir le document ou glissez-le'}
                    </strong>
                    <span className="text-muted d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                      {uploadLabTargetOrder.id === 2 ? 'Supports DICOM, PACS & Imagerie 3D' : 'Format PDF certifié avec signature du biologiste'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Biologist Notes */}
              <div className="mb-4">
                <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  📝 Conclusions du biologiste & valeurs clés (DMP)
                </label>
                <textarea 
                  className="form-control py-2.5 px-3" 
                  rows={3} 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '14px', fontSize: '0.88rem' }}
                  placeholder={uploadLabTargetOrder.id === 2 ? "Ex: Radiographie pulmonaire de contrôle satisfaisante. Absence de foyer parenchymateux évolutif." : "Ex: NFS normale. Glycémie à jeun : 0.92 g/L. Bilan hépatique satisfaisant."}
                  value={uploadLabNotes}
                  onChange={(e) => setUploadLabNotes(e.target.value)}
                />
              </div>

              {/* Modal Buttons — Séparation Maximale Gauche / Droite */}
              <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn px-4 py-2.5 fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                  onClick={() => setUploadLabTargetOrder(null)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn px-4.5 py-2.5 fw-bold text-white" 
                  style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                >
                  ✅ Valider & transmettre au DMP
                </button>
              </div>

            </form>
          </div>,
          document.body
        )}

        {/* MODAL DE CRÉATION / ÉDITION DE PRESCRIPTION LABO (React Portal) */}
        {editingLabOrder && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditingLabOrder(null); }}
          >
            <form onSubmit={handleSaveLabOrder} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    🧪
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      {isNewLabOrder ? 'Prescrire un nouvel examen / bilan labo' : 'Modifier la prescription d\'examen'}
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC • Hub Laboratoire & Imagerie
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setEditingLabOrder(null)}></button>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Nom complet du patient *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingLabOrder.patientName || ''}
                    onChange={(e) => setEditingLabOrder({ ...editingLabOrder, patientName: e.target.value })}
                    placeholder="Ex: Amadou Sow"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">N° de Carte CSU *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingLabOrder.cmuNumber || ''}
                    onChange={(e) => setEditingLabOrder({ ...editingLabOrder, cmuNumber: e.target.value })}
                    placeholder="Ex: CSU-DKR-2026-8812.2"
                    required
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-7">
                  <label className="form-label small fw-bold mb-1">Examen / Bilan prescrit *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingLabOrder.examName || ''}
                    onChange={(e) => setEditingLabOrder({ ...editingLabOrder, examName: e.target.value })}
                    placeholder="Ex: Bilan sanguin complet & Sérologies"
                    required
                  />
                </div>

                <div className="col-md-5">
                  <label className="form-label small fw-bold mb-1">Médecin prescripteur *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingLabOrder.doctor || ''}
                    onChange={(e) => setEditingLabOrder({ ...editingLabOrder, doctor: e.target.value })}
                    placeholder="Ex: Dr. Cheikh Anta Diop"
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold mb-1">Détails de l'analyse & instructions</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLabOrder.examDetail || ''}
                  onChange={(e) => setEditingLabOrder({ ...editingLabOrder, examDetail: e.target.value })}
                  placeholder="Ex: NFS, Glycémie à jeun, Bilan hépatique complet"
                />
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Taux de couverture UNAMUSC</label>
                  <select 
                    className="form-select"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingLabOrder.coverage || '80% UNAMUSC'}
                    onChange={(e) => setEditingLabOrder({ ...editingLabOrder, coverage: e.target.value })}
                  >
                    <option value="80% UNAMUSC">80% UNAMUSC (Tiers-payant)</option>
                    <option value="100% Gratuité">100% Gratuité (BSF / Maternité)</option>
                    <option value="50% Officine">50% Tiers-payant</option>
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Statut de la prescription</label>
                  <select 
                    className="form-select"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingLabOrder.status || 'prescrit'}
                    onChange={(e) => setEditingLabOrder({ ...editingLabOrder, status: e.target.value })}
                  >
                    <option value="prescrit">⏳ Prescrit (En attente de résultats)</option>
                    <option value="transmis">✅ Transmis au DMP</option>
                  </select>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn px-4 py-2.5 fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                  onClick={() => setEditingLabOrder(null)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn px-4.5 py-2.5 fw-bold text-white" 
                  style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                >
                  💾 Enregistrer la prescription
                </button>
              </div>

            </form>
          </div>,
          document.body
        )}

        {/* MODAL / POP-UP DE CONFIRMATION DE SUPPRESSION POUR HUB LABO (React Portal) */}
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

  // ── PHARMACIEN : non concerné par les lettres de garantie ──
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
                Lettres de garantie : non concerné
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Les lettres de garantie sont réservées aux prises en charge hospitalières et interventions chirurgicales. Votre guichet officine est spécialement configuré pour la validation des bons de commande et la délivrance de médicaments.
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
                <img src="/csu_verify_hero.png" alt="Lettres de garantie hospitalières" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
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
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  boxShadow: '0 6px 16px rgba(16, 185, 129, 0.15)'
                }}>
                  🛡️
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.08rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Périmètre de votre profil officine
                  </h5>
                  <span style={{ color: 'var(--text-sub)', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                    Règlementation RBAC UNAMUSC Sénégal
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                Conformément aux directives du Ministère de la Santé, la gestion des lettres de garantie est attribuée aux établissements hospitaliers récepteurs (Hôpital Aristide Le Dantec, Fann, CHU Abass Ndao, etc.).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1rem' }}>💊</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Délivrance de médicaments (50% / 80%)</span>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                    🟢 Autorisé
                  </span>
                </div>

                <div className="p-3 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1rem' }}>🏥</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.85rem', fontWeight: 600 }}>Prise en charge hospitalière</span>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary border border-secondary px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.76rem' }}>
                    🔴 Non concerné
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

  if (isCitizen && isSuspended) {
    return (
      <div className="container py-5 fade-in-up">
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès aux garanties refusé : Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. La demande et le téléchargement des lettres de garantie hospitalières sont suspendus.
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
                  if (setView) setView('payments');
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
    <div className="container py-4 fade-in-up">
      {/* Banner signature de la plateforme */}
      <section 
        className="banner-mini text-white mb-5 rounded-4 overflow-hidden position-relative text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.38) 0%, rgba(16, 185, 129, 0.18) 100%), url("/csu_bsf_real.png") center/cover no-repeat',
          padding: '3.75rem 2.5rem',
          minHeight: '240px',
          borderRadius: '24px',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.45)'
        }}
      >
        <div className="d-flex flex-column align-items-center justify-content-center position-relative text-center mx-auto" style={{ zIndex: 2, maxWidth: '900px' }}>
          <span 
            className="badge px-3.5 py-1.5 mb-3 fw-bold d-inline-block text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.22)',
              color: '#ffffff',
              backdropFilter: 'blur(6px)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              border: '1px solid rgba(255, 255, 255, 0.35)'
            }}
          >
            🇸🇳 UNAMUSC Sénégal : Lettres de garantie (80%) | bons pharmacie (50%)
          </span>
          <h1 className="fw-extrabold mb-2 text-white text-center" style={{ fontSize: '2.35rem', letterSpacing: '-0.02em', textShadow: '0 3px 6px rgba(0,0,0,0.4)' }}>
            {lang === 'wo' ? 'Bons de commande ak bataaxal u garansi' : 'Bons de commande : lettres de garantie'}
          </h1>
          <p className="mb-4 text-white-50 text-center mx-auto" style={{ fontSize: '1.05rem', lineHeight: '1.6', textShadow: '0 1px 3px rgba(0,0,0,0.3)', maxWidth: '780px' }}>
            {lang === 'wo'
              ? 'Yónnee sa demande ngir joto prise en charge d\'hospitalisation wala chirurgie.'
              : 'Demandez votre lettre de garantie hospitalière (80%) ou bon de commande pharmacie (50%) en ligne sous le Tiers-payant UNAMUSC.'}
          </p>

          <div className="d-flex justify-content-center align-items-center flex-wrap mt-4 w-100" style={{ gap: '1.75rem', rowGap: '1.25rem', padding: '0.75rem 0' }}>
            <button
              type="button"
              className="hover-lift"
              style={{
                background: activeTab === 'list' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: activeTab === 'list' ? '2.5px solid #ffffff' : '1.5px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '18px',
                fontSize: '1rem',
                fontWeight: '800',
                lineHeight: '1.4',
                padding: '1.1rem 2.2rem',
                boxShadow: activeTab === 'list' ? '0 8px 25px rgba(5, 150, 105, 0.6)' : '0 4px 15px rgba(0,0,0,0.2)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                flex: '0 1 auto',
                minWidth: '290px',
                minHeight: '56px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
              onClick={() => setActiveTab('list')}
            >
              <span style={{ fontSize: '1.2rem' }}>📋</span> {canInstruire ? `Instructions agent (${letters.length})` : (isDoctor || isMidwife) ? `Dossiers patients (${visibleLetters.length})` : `Mes dossiers : attestations (${visibleLetters.length})`}
            </button>

            {(isCitizen || isSuperAdmin) && (
              <button
                type="button"
                className="hover-lift"
                style={{
                  background: activeTab === 'new' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  border: activeTab === 'new' ? '2.5px solid #ffffff' : '1.5px solid rgba(255, 255, 255, 0.4)',
                  borderRadius: '18px',
                  fontSize: '1rem',
                  fontWeight: '800',
                  lineHeight: '1.4',
                  padding: '1.1rem 2.2rem',
                  boxShadow: activeTab === 'new' ? '0 8px 25px rgba(5, 150, 105, 0.6)' : '0 4px 15px rgba(0,0,0,0.2)',
                  transition: 'all 0.25s ease',
                  cursor: 'pointer',
                  flex: '0 1 auto',
                  minWidth: '290px',
                  minHeight: '56px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem'
                }}
                onClick={() => setActiveTab('new')}
              >
                <span style={{ fontSize: '1.2rem' }}>➕</span> {lang === 'wo' ? 'Demande bu bees' : 'Nouvelle demande (garantie / bon)'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* RANGÉE KPIS EXÉCUTIF GARANTIES (Rôle Assuré vs Agent/SuperAdmin) */}
      {(() => {
        const citizenPendingCount = visibleLetters.filter(l => l.status === 'pending').length;
        const citizenApprovedCount = visibleLetters.filter(l => l.status === 'approved' || l.status === 'emergency_issued').length;
        const citizenTotalAmount = visibleLetters.reduce((sum, l) => sum + (Number(l.max_amount || l.unamusc_amount || (l.estimated_amount * 0.8)) || 0), 0);

        if (isCitizen) {
          return (
            <div className="row g-4 mb-5">
              <div className="col-lg-3 col-sm-6 col-12">
                <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>Mes demandes déposées</span>
                    <span style={{ fontSize: '1.4rem' }}>📁</span>
                  </div>
                  <h3 className="fw-extrabold mb-1 text-primary" style={{ fontSize: '2.1rem', letterSpacing: '-0.02em' }}>{visibleLetters.length}</h3>
                  <small className="text-muted d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>Pour moi & mes ayants droit</small>
                </div>
              </div>
              <div className="col-lg-3 col-sm-6 col-12">
                <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>En instruction agent</span>
                    <span style={{ fontSize: '1.4rem' }}>⏳</span>
                  </div>
                  <h3 className="fw-extrabold mb-1 text-warning" style={{ fontSize: '2.1rem', letterSpacing: '-0.02em' }}>{citizenPendingCount}</h3>
                  <small className="text-warning fw-bold d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>Dossiers sous 48h</small>
                </div>
              </div>
              <div className="col-lg-3 col-sm-6 col-12">
                <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>Prises en charge accordées</span>
                    <span style={{ fontSize: '1.4rem' }}>✅</span>
                  </div>
                  <h3 className="fw-extrabold mb-1 text-success" style={{ fontSize: '2.1rem', letterSpacing: '-0.02em' }}>{citizenApprovedCount}</h3>
                  <small className="text-success fw-bold d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>Validées à l'hôpital</small>
                </div>
              </div>
              <div className="col-lg-3 col-sm-6 col-12">
                <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>Montant pris en charge</span>
                    <span style={{ fontSize: '1.4rem' }}>💰</span>
                  </div>
                  <h3 className="fw-extrabold mb-1 text-success" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>{citizenTotalAmount.toLocaleString('fr-FR')} FCFA</h3>
                  <small className="text-success fw-bold d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>Couverture mutuelle UNAMUSC</small>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="row g-4 mb-5">
            <div className="col-lg-3 col-sm-6 col-12">
              <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>Demandes reçues (Région)</span>
                  <span style={{ fontSize: '1.4rem' }}>📊</span>
                </div>
                <h3 className="fw-extrabold mb-1 text-primary" style={{ fontSize: '2.1rem' }}>1 840</h3>
                <small className="text-muted d-block" style={{ fontSize: '0.8rem' }}>Sur les 24 mutuelles de Dakar</small>
              </div>
            </div>
            <div className="col-lg-3 col-sm-6 col-12">
              <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>En instruction agent</span>
                  <span style={{ fontSize: '1.4rem' }}>⏳</span>
                </div>
                <h3 className="fw-extrabold mb-1 text-warning" style={{ fontSize: '2.1rem' }}>310</h3>
                <small className="text-warning fw-bold d-block" style={{ fontSize: '0.8rem' }}>Dossiers sous 48h</small>
              </div>
            </div>
            <div className="col-lg-3 col-sm-6 col-12">
              <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>Lettres accordées</span>
                  <span style={{ fontSize: '1.4rem' }}>✅</span>
                </div>
                <h3 className="fw-extrabold mb-1 text-success" style={{ fontSize: '2.1rem' }}>1 420</h3>
                <small className="text-success fw-bold d-block" style={{ fontSize: '0.8rem' }}>Homologuées 80% / 100%</small>
              </div>
            </div>
            <div className="col-lg-3 col-sm-6 col-12">
              <div className="card shadow-sm border-0 p-4 rounded-4 h-100" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '20px' }}>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small text-muted fw-bold text-uppercase" style={{ letterSpacing: '0.04em', fontSize: '0.78rem' }}>Total garanti UNAMUSC</span>
                  <span style={{ fontSize: '1.4rem' }}>💰</span>
                </div>
                <h3 className="fw-extrabold mb-1 text-success" style={{ fontSize: '1.75rem' }}>16 640 000 FCFA</h3>
                <small className="text-success fw-bold d-block" style={{ fontSize: '0.8rem' }}>Engagements certifiés</small>
              </div>
            </div>
          </div>
        );
      })()}

      {successMsg && (
        <div className="alert alert-success d-flex align-items-center mb-4 rounded-3 border-0 shadow-sm">
          <span className="fs-4 me-2">✅</span>
          <div style={{ color: 'var(--text-main)' }}>{successMsg}</div>
        </div>
      )}

      {/* FORMULAIRE NOUVELLE DEMANDE (React Portal : Centered on Screen) */}
      {activeTab === 'new' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div className="card shadow-lg border-0 p-4" style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto', borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--primary)' }}>
                <span>➕</span> Nouvelle demande sous le Tiers-payant UNAMUSC
              </h4>
              <button type="button" className="btn-close" onClick={() => setActiveTab('list')}></button>
            </div>

            {/* BANDEAU CONTEXTE HORAIRE & DÉLIVRANCE 24/7 */}
            <div className="p-3.5 rounded-4 mb-4 d-flex align-items-center gap-3" style={{ background: emergencyTimeInfo.badgeBg, border: `1.5px solid ${emergencyTimeInfo.badgeColor}` }}>
              <div style={{ fontSize: '1.8rem' }}>{emergencyTimeInfo.period === 'weekend' ? '🏥' : emergencyTimeInfo.period === 'night' ? '🌙' : '☀️'}</div>
              <div>
                <strong className="d-block" style={{ color: emergencyTimeInfo.badgeColor, fontSize: '0.94rem', fontWeight: '800' }}>
                  {emergencyTimeInfo.label} — Continuité des soins 7j/7
                </strong>
                <p className="small mb-0" style={{ color: 'var(--text-main)', fontSize: '0.82rem', lineHeight: '1.45' }}>
                  {emergencyTimeInfo.deliveryText}
                </p>
              </div>
            </div>

            {/* SÉLECTEUR CATEGORIE : GARANTIE HOSPITALIÈRE OU BON PHARMACIE */}
            <div className="d-flex flex-wrap mb-4" style={{ gap: '20px' }}>
              <button 
                type="button" 
                className={`btn flex-fill py-2.5 fw-bold ${requestCategory === 'hospital' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setRequestCategory('hospital')}
                style={{ borderRadius: '12px', marginRight: '6px' }}
              >
                🏥 Lettre de Garantie Hospitalière (80% / Plan SESAME 100%)
              </button>
              <button 
                type="button" 
                className={`btn flex-fill py-2.5 fw-bold ${requestCategory === 'pharmacy' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setRequestCategory('pharmacy')}
                style={{ borderRadius: '12px', marginLeft: '6px' }}
              >
                💊 Bon de Commande Pharmacie (50% / 50%)
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Prénom de l'assuré *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold" 
                    value={applicantFirstName} 
                    onChange={(e) => setApplicantFirstName(e.target.value)} 
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Nom de l'assuré *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold" 
                    value={applicantLastName} 
                    onChange={(e) => setApplicantLastName(e.target.value)} 
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label small fw-semibold">N° Carte CSU Assuré *</label>
                  <input 
                    type="text" 
                    className="form-control input fw-bold text-success" 
                    value={applicantCmu} 
                    onChange={(e) => setApplicantCmu(e.target.value)} 
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>
              </div>

              {/* OPTION PLAN SESAME POUR LES PERSONNES ÂGÉES DE 60 ANS ET PLUS (Hospitalisation) */}
              {requestCategory === 'hospital' && (
                <div className="p-3 mb-3 rounded-3" style={{ background: 'rgba(245, 158, 11, 0.09)', border: '1.5px solid #f59e0b', borderRadius: '14px' }}>
                  <div className="form-check form-switch d-flex align-items-center gap-3">
                    <input 
                      className="form-check-input" 
                      type="checkbox" 
                      id="sesameSwitch" 
                      checked={isSeniorSesame}
                      onChange={(e) => setIsSeniorSesame(e.target.checked)}
                      style={{ cursor: 'pointer', width: '2.5rem', height: '1.35rem', backgroundColor: isSeniorSesame ? '#059669' : undefined }}
                    />
                    <label className="form-check-label fw-bold cursor-pointer" htmlFor="sesameSwitch" style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      🧓 Assuré âgé de 60 ans ou plus — Bénéficiaire du Plan SESAME (Sénégal)
                    </label>
                  </div>
                  <small className="d-block text-muted mt-1.5" style={{ fontSize: '0.78rem', marginLeft: '3.6rem', lineHeight: '1.4' }}>
                    Prise en charge intégrale à 100% : <strong>80% UNAMUSC</strong> + <strong>20% Contrepartie Plan SESAME (État du Sénégal)</strong>. Aucun reste à payer pour le senior (0 FCFA).
                  </small>
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    {requestCategory === 'hospital' ? 'Établissement d\'accueil récepteur *' : 'Pharmacie partenaire agréée UNAMUSC *'}
                  </label>
                  <select 
                    className="form-select input fw-bold" 
                    value={structureName} 
                    onChange={(e) => setStructureName(e.target.value)}
                    style={{ borderRadius: '10px' }}
                  >
                    {requestCategory === 'hospital' ? (
                      <>
                        <option value="Hôpital Universitaire de Fann (Dakar)">Hôpital Universitaire de Fann (Dakar)</option>
                        <option value="Hôpital Aristide Le Dantec">Hôpital Aristide Le Dantec</option>
                        <option value="Hôpital Général Idrissa Pouye (Grand Yoff / Pikine)">Hôpital Général Idrissa Pouye (Grand Yoff / Pikine)</option>
                        <option value="Centre Hospitalier Abass Ndao">Centre Hospitalier Abass Ndao</option>
                        <option value="Hôpital d'Enfants Albert Royer">Hôpital d'Enfants Albert Royer</option>
                        <option value="Hôpital Roi Baudouin de Guédiawaye">Hôpital Roi Baudouin de Guédiawaye</option>
                        <option value="Centre Hospitalier de Rufisque">Centre Hospitalier de Rufisque</option>
                      </>
                    ) : (
                      <>
                        <option value="Pharmacie de la Nation (Dakar)">Pharmacie de la Nation (Dakar)</option>
                        <option value="Pharmacie Cheikh Anta Diop">Pharmacie Cheikh Anta Diop</option>
                        <option value="Pharmacie Universelle Pikine">Pharmacie Universelle Pikine</option>
                        <option value="Pharmacie Populaire Guédiawaye">Pharmacie Populaire Guédiawaye</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Devis estimatif soumis (FCFA) *</label>
                  <input 
                    type="number" 
                    className="form-control input fw-bold"
                    placeholder="Ex: 250000"
                    value={estimatedAmount}
                    onChange={(e) => setEstimatedAmount(e.target.value)}
                    style={{ borderRadius: '10px' }}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-semibold">
                  {requestCategory === 'hospital' 
                    ? 'Description de l\'acte médical : hospitalisation prescrite *' 
                    : 'Liste des médicaments prescrits (Ordonnance) *'}
                </label>
                <textarea 
                  className="form-control input" 
                  rows="3" 
                  placeholder={requestCategory === 'hospital' 
                    ? 'Ex: Intervention chirurgicale ORL, hospitalisation 5 jours en médecine interne...' 
                    : 'Ex: Amoxicilline 500mg (2 boîtes), Paracétamol 1g (1 boîte), Spasfon...'}
                  value={medicalAct}
                  onChange={(e) => setMedicalAct(e.target.value)}
                  style={{ borderRadius: '10px' }}
                  required
                />
              </div>

              {/* SECTION TÉLÉVERSEMENT ORDONNANCE (Pharmacie uniquement) */}
              {requestCategory === 'pharmacy' && (
                <div className="mb-4 p-4 rounded-3" style={{ background: 'rgba(5,150,105,0.07)', border: '2px dashed #059669', borderRadius: '16px' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span style={{ fontSize: '1.4rem' }}>📋</span>
                    <div>
                      <strong className="d-block fw-bold" style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>Téléverser l'ordonnance médicale *</strong>
                      <small className="text-muted">Prenez en photo l'ordonnance prescrite par votre médecin et téléversez-la. Le gérant UNAMUSC vérifiera l'ordonnance avant d'accorder le bon de commande.</small>
                    </div>
                  </div>

                  <label
                    htmlFor="prescriptionUpload"
                    className="d-flex flex-column align-items-center justify-content-center p-3 rounded-3 mt-2 cursor-pointer"
                    style={{
                      border: '2px solid #059669',
                      background: 'var(--bg-body)',
                      borderRadius: '12px',
                      minHeight: '110px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    {prescriptionPreview ? (
                      <div className="text-center">
                        <img
                          src={prescriptionPreview}
                          alt="Aperçu ordonnance"
                          style={{ maxHeight: '160px', maxWidth: '100%', borderRadius: '8px', objectFit: 'contain', marginBottom: '0.5rem' }}
                        />
                        <small className="text-success fw-bold d-block">✅ Ordonnance chargée : Cliquer pour modifier</small>
                      </div>
                    ) : (
                      <div className="text-center text-muted">
                        <div style={{ fontSize: '2.5rem', marginBottom: '0.4rem' }}>📷</div>
                        <span className="fw-semibold d-block" style={{ fontSize: '0.9rem' }}>Cliquer pour prendre/sélectionner la photo de l'ordonnance</span>
                        <small>Formats acceptés : JPG, PNG, HEIC (Max 10 Mo)</small>
                      </div>
                    )}
                    <input
                      id="prescriptionUpload"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhotoUpload}
                      style={{ display: 'none' }}
                    />
                  </label>

                  {!prescriptionPreview && (
                    <small className="d-block text-warning fw-semibold mt-2">
                      ⚠️ Aucune ordonnance téléversée. Le bon ne sera accordé qu'après vérification par le gérant UNAMUSC.
                    </small>
                  )}
                </div>
              )}

              {/* CADRE ESTIMATIF DE PRISE EN CHARGE ET RÉPARTITION FINANCIÈRE */}
              {(() => {
                const isPharm = requestCategory === 'pharmacy';
                const estNum = parseFloat(estimatedAmount) || 0;

                if (isPharm) {
                  const coveredVal = estNum * 0.5;
                  const restVal = estNum * 0.5;
                  return (
                    <div className="p-3.5 rounded-3 border mb-4" style={{ background: 'var(--card-bg)', borderColor: '#059669', borderLeft: '5px solid #059669' }}>
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                        <div>
                          <strong className="d-block small text-success fw-bold">
                            Tiers-Payant Pharmacie UNAMUSC (50% / 50%) :
                          </strong>
                          <span className="small text-muted d-block">
                            Prise en charge 50% mutuelle UNAMUSC et 50% ticket modérateur assuré.
                          </span>
                          {estNum > 0 && (
                            <small className="text-warning fw-bold d-block mt-1">
                              Ticket modérateur assuré (50%) : {restVal.toLocaleString()} FCFA
                            </small>
                          )}
                        </div>
                        <div className="text-end">
                          <span className="small text-muted d-block fw-semibold">Montant pris en charge UNAMUSC (50%) :</span>
                          <h4 className="fw-bold text-success mb-0">
                            {coveredVal.toLocaleString()} FCFA
                          </h4>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Hospitalisation
                if (isSeniorSesame) {
                  const unamuscVal = estNum * 0.8;
                  const sesameVal = estNum * 0.2;
                  return (
                    <div className="p-3.5 rounded-3 border mb-4" style={{ background: 'rgba(5, 150, 105, 0.08)', borderColor: '#059669', borderLeft: '5px solid #d97706' }}>
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                        <div>
                          <span className="badge px-2.5 py-1 mb-1 fw-bold" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', fontSize: '0.78rem' }}>
                            🧓 Plan SESAME (60 ans et +) • 100% de Prise en Charge
                          </span>
                          <strong className="d-block small text-success fw-bold">
                            Prise en charge intégrale conjointe : UNAMUSC (80%) + Plan SESAME (20%)
                          </strong>
                          <span className="small text-muted d-block">
                            Part UNAMUSC : <strong>{unamuscVal.toLocaleString()} FCFA</strong> • Contrepartie Plan SESAME : <strong>{sesameVal.toLocaleString()} FCFA</strong>
                          </span>
                          <small className="text-success fw-bold d-block mt-1">
                            🎉 Reste à charge patient : 0 FCFA (Prise en charge intégrale)
                          </small>
                        </div>
                        <div className="text-end">
                          <span className="small text-muted d-block fw-semibold">Total garanti hôpital (100%) :</span>
                          <h4 className="fw-bold text-success mb-0">
                            {estNum.toLocaleString()} FCFA
                          </h4>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Standard hospital 80% / 20%
                const unamuscVal = estNum * 0.8;
                const restVal = estNum * 0.2;
                return (
                  <div className="p-3.5 rounded-3 border mb-4" style={{ background: 'var(--card-bg)', borderColor: '#059669', borderLeft: '5px solid #059669' }}>
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                      <div>
                        <strong className="d-block small text-success fw-bold">
                          Prise en charge UNAMUSC standard (80%) :
                        </strong>
                        <span className="small text-muted d-block">
                          Prise en charge directe 80% sur Lettre de Garantie Hospitalière (Tiers-payant UNAMUSC).
                        </span>
                        {estNum > 0 && (
                          <small className="text-warning fw-bold d-block mt-1">
                            Ticket modérateur patient (20%) : {restVal.toLocaleString()} FCFA
                          </small>
                        )}
                      </div>
                      <div className="text-end">
                        <span className="small text-muted d-block fw-semibold">Montant garanti UNAMUSC (80%) :</span>
                        <h4 className="fw-bold text-success mb-0">
                          {unamuscVal.toLocaleString()} FCFA
                        </h4>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>Annuler</button>
                <button type="submit" className="btn btn-success text-white fw-bold px-4" disabled={submitting} style={{ borderRadius: '10px' }}>
                  {submitting 
                    ? 'Transmission...' 
                    : requestCategory === 'pharmacy' 
                    ? '📷 Soumettre ordonnance : demander bon pharmacie' 
                    : emergencyTimeInfo.isEmergency
                    ? `🚨 Émettre la Lettre d'Urgence (${emergencyTimeInfo.label})`
                    : '📤 Soumettre la demande à l\'UNAMUSC'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* EXPERIENCE PORTAIL UNIFIEE POUR LES VISITEURS NON CONNECTÉS (Remplaçant l'ancien bloc restreint) */}
      {isPublic && !publicSearchCmu && activeTab === 'list' && (
        <div className="fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* CARTE CENTRALE DE RECHERCHE : AUTHENTIFICATION */}
          <div className="card shadow-lg border-0 p-4 p-md-5 rounded-4 text-left" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderTop: '6px solid #059669', boxShadow: 'var(--shadow-lg)', padding: '2.75rem 2.25rem' }}>
            <div className="d-flex align-items-center gap-3.5 mb-4">
              <div style={{ background: 'rgba(5, 150, 105, 0.15)', color: '#059669', padding: '0.85rem 1rem', borderRadius: '18px', fontSize: '2rem' }}>
                🔒
              </div>
              <div>
                <h3 className="fw-extrabold mb-1.5" style={{ color: 'var(--primary)', fontSize: '1.45rem' }}>
                  Accès sécurisé : consultation des attestations UNAMUSC
                </h3>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                  Afin de préserver la confidentialité des données médicales des citoyens, la liste globale des garanties est réservée aux agents habilités. Saisissez votre N° de Carte CSU ou votre code de garantie pour consulter votre dossier.
                </p>
              </div>
            </div>

            {/* Barre de recherche avec exemples et bouton */}
            <div className="p-4 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
              <label className="form-label small fw-bold mb-2.5" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>
                🔎 Rechercher directement mon dossier avec mon n° de carte CMU ou code d'homologation :
              </label>
              <div className="input-group mb-3">
                <input 
                  type="text" 
                  className="form-control fw-bold input" 
                  placeholder="Ex: CMU-DKR-2026-8812 ou GAR-2026-FANN-88" 
                  value={publicSearchCmu} 
                  onChange={(e) => setPublicSearchCmu(e.target.value)} 
                  style={{ borderRadius: '14px 0 0 14px', height: '54px', fontSize: '1.05rem', paddingLeft: '1.25rem' }}
                />
                <button 
                  className="btn btn-success fw-bold px-4" 
                  style={{ borderRadius: '0 14px 14px 0', background: '#059669', fontSize: '1rem', height: '54px' }}
                >
                  🔍 Consulter mon dossier
                </button>
              </div>

              {/* Suggestions rapides */}
              <div className="d-flex align-items-center flex-wrap gap-3 mt-3 pt-1">
                <span className="small text-muted fw-bold me-2" style={{ fontSize: '0.85rem' }}>Exemples de démonstration :</span>
                <div className="d-flex flex-wrap gap-3">
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary py-2 px-3.5 fw-bold"
                    style={{ fontSize: '0.82rem', borderRadius: '10px' }}
                    onClick={() => setPublicSearchCmu('CMU-DKR-2026-8812')}
                  >
                    CMU-DKR-2026-8812 (Amadou Sow)
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline-secondary py-2 px-3.5 fw-bold"
                    style={{ fontSize: '0.82rem', borderRadius: '10px' }}
                    onClick={() => setPublicSearchCmu('CMU-DKR-2026-4401')}
                  >
                    CMU-DKR-2026-4401 (Fatou Diop)
                  </button>
                </div>
              </div>
            </div>

            {/* Boutons d'action rapide avec espacement propre */}
            <div className="d-flex flex-column flex-sm-row pt-3" style={{ marginTop: '0.75rem', gap: '24px', rowGap: '1rem' }}>
              {setView && (
                <button 
                  className="btn btn-success fw-bold px-4 py-3" 
                  onClick={() => setView('login')} 
                  style={{ borderRadius: '14px', background: '#059669', fontSize: '0.98rem', boxShadow: '0 6px 16px rgba(5,150,105,0.35)', minHeight: '52px', marginRight: '10px' }}
                >
                  🔐 Se connecter à mon espace assuré : agent
                </button>
              )}
              <button 
                className="btn btn-outline-success fw-bold px-4 py-3" 
                onClick={() => setActiveTab('new')} 
                style={{ borderRadius: '14px', fontSize: '0.98rem', minHeight: '52px', marginLeft: '10px' }}
              >
                ➕ Soumettre une demande de prise en charge (80%)
              </button>
            </div>
          </div>

          {/* SIMULATEUR INTERACTIF DE PRISE EN CHARGE CMU */}
          <div className="card shadow-md border-0 p-4 p-md-5 rounded-4 text-left" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2.75rem 2.25rem' }}>
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 pb-2">
              <div>
                <span className="badge bg-success-subtle text-success border border-success px-3.5 py-1.5 fw-bold mb-2.5 d-inline-block" style={{ borderRadius: '20px', fontSize: '0.82rem' }}>
                  🧮 Simulateur de devis : calculateur UNAMUSC
                </span>
                <h3 className="fw-extrabold mb-1.5" style={{ color: 'var(--primary)', fontSize: '1.45rem' }}>
                  Simulez la prise en charge de vos soins hospitaliers : médicaments
                </h3>
                <p className="text-muted mb-0" style={{ fontSize: '0.95rem' }}>
                  Estimez instantanément la part couverte par l'UNAMUSC et le ticket modérateur restant à votre charge.
                </p>
              </div>
            </div>

            <div className="row g-4 g-xl-5 align-items-center">
              <div className="col-lg-6">
                <div className="form-group mb-4">
                  <label className="form-label small fw-bold mb-2" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>Type de prestation sanitaire :</label>
                  <div className="d-flex gap-2.5">
                    <button 
                      type="button" 
                      className={`btn flex-fill fw-bold py-2.5 px-3 ${simType === 'hospital' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSimType('hospital')}
                      style={{ borderRadius: '12px', fontSize: '0.9rem', height: '48px' }}
                    >
                      🏥 Hospitalisation : chirurgie (80%)
                    </button>
                    <button 
                      type="button" 
                      className={`btn flex-fill fw-bold py-2.5 px-3 ${simType === 'pharmacy' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                      onClick={() => setSimType('pharmacy')}
                      style={{ borderRadius: '12px', fontSize: '0.9rem', height: '48px' }}
                    >
                      💊 Ordonnance pharmacie (50%)
                    </button>
                  </div>
                </div>

                <div className="form-group mb-0">
                  <label className="form-label small fw-bold mb-2" style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>Montant estimatif du devis soumis (FCFA) :</label>
                  <input 
                    type="number" 
                    className="form-control input fw-bold text-success fs-5 mb-2"
                    value={simAmount}
                    onChange={(e) => setSimAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ borderRadius: '12px', height: '54px', paddingLeft: '1.25rem' }}
                    step={5000}
                  />
                  <small className="text-muted d-block" style={{ fontSize: '0.82rem' }}>Exemples : 100 000 FCFA (radiologies), 250 000 FCFA (chirurgie Fann), 500 000 FCFA (hospitalisation 10j)</small>
                </div>
              </div>

              <div className="col-lg-6">
                {(() => {
                  const pct = simType === 'hospital' ? 80 : 50;
                  const cmuPart = simAmount * (pct / 100);
                  const patientPart = simAmount - cmuPart;

                  return (
                    <div className="p-4 p-md-4.5 rounded-4 shadow-sm" style={{ background: 'var(--bg-card-subtle)', border: '2px solid #059669', padding: '1.75rem 1.5rem' }}>
                      <div className="d-flex justify-content-between align-items-center mb-3.5 border-bottom pb-3" style={{ borderColor: 'var(--border-color)' }}>
                        <span className="fw-bold fs-6" style={{ color: 'var(--text-main)' }}>Taux de garantie UNAMUSC :</span>
                        <span className="badge bg-success fs-6 fw-bold px-3.5 py-1.5" style={{ borderRadius: '12px' }}>{pct}% prise en charge</span>
                      </div>

                      <div className="row g-3 my-2">
                        <div className="col-6">
                          <span className="small text-muted d-block fw-bold mb-1" style={{ fontSize: '0.82rem' }}>Part payée par l'UNAMUSC ({pct}%) :</span>
                          <h3 className="fw-extrabold text-success mb-1" style={{ fontSize: '1.75rem' }}>{cmuPart.toLocaleString()} FCFA</h3>
                          <small className="text-success fw-bold" style={{ fontSize: '0.78rem' }}>Règlement direct à l'établissement</small>
                        </div>

                        <div className="col-6 border-start ps-3.5" style={{ borderColor: 'var(--border-color)' }}>
                          <span className="small text-muted d-block fw-bold mb-1" style={{ fontSize: '0.82rem' }}>Ticket modérateur patient ({100 - pct}%) :</span>
                          <h3 className="fw-extrabold text-warning mb-1" style={{ fontSize: '1.75rem' }}>{patientPart.toLocaleString()} FCFA</h3>
                          <small className="text-warning fw-bold" style={{ fontSize: '0.78rem' }}>À payer par l'assuré au guichet</small>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-top text-center" style={{ borderColor: 'var(--border-color)' }}>
                        <button 
                          className="btn btn-success fw-bold w-100 py-3" 
                          style={{ borderRadius: '12px', background: '#059669', height: '52px', fontSize: '1.02rem' }}
                          onClick={() => setActiveTab('new')}
                        >
                          📋 Demander cette prise en charge officielle
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* GRILLE DES 4 ENGAGEMENTS TIERS-PAYANT UNAMUSC */}
          <div className="grid grid-4" style={{ gap: '1.5rem' }}>
            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>🏥</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Hospitalisation : chirurgie</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Prise en charge à 80% des frais de bloc, séjour et soins intégraux dans tous les centres hospitaliers régionaux.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>💊</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Bons de commande pharmacie</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Délivrance directe des médicaments essentiels prescrits avec 50% de réduction immédiate en officine conventionnée.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>⚡</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Instruction rapide 48h</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Validation et homologation par l'Agent Régional mutualiste sous 48 heures ouvrées avec notification SMS.
              </p>
            </div>

            <div className="card p-4 text-left shadow-sm" style={{ borderRadius: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '1.75rem 1.5rem' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '0.75rem' }}>📜</div>
              <h5 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>Attestation QR code officielle</h5>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.6' }}>
                Tampon numérique infalsifiable imprimable ou téléchargeable en PDF A4 officiel pour les admissions d'urgence.
              </p>
            </div>
          </div>

          {/* RÉSEAU HOSPITALIER CONVENTIONNÉ SÉNÉGAL */}
          <div className="card shadow-sm border-0 p-4 p-md-5 rounded-4 text-left" style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '2.5rem 2rem' }}>
            <h4 className="fw-bold mb-4 d-flex align-items-center gap-2.5" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
              <span>🏛️</span> Établissements Hospitaliers Référents Conventionnés Tiers-Payant UNAMUSC
            </h4>

            <div className="grid grid-3" style={{ gap: '1.25rem' }}>
              {[
                { name: 'Hôpital Universitaire de Fann', dept: 'Dakar Fann | Point E', badge: 'Centre Régional Habilité' },
                { name: 'Hôpital Aristide Le Dantec', dept: 'Dakar Plateau', badge: 'Chirurgie | Oncologie' },
                { name: 'Hôpital Général Idrissa Pouye', dept: 'Pikine | Guédiawaye', badge: 'Urgences 24h/7' },
                { name: 'Centre Hospitalier Abass Ndao', dept: 'Médina | Fass', badge: 'Maternité | Diabétologie' },
                { name: 'Hôpital d\'Enfants Albert Royer', dept: 'Fann | Pédiatrie', badge: 'Pédiatrie 100% CMU' },
                { name: 'Clinique Pasteur & Polycliniques', dept: 'Dakar Métropole', badge: 'Tiers-Payant Privé' }
              ].map((h, idx) => (
                <div key={idx} className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', padding: '1.25rem 1.1rem' }}>
                  <span className="badge bg-success-subtle text-success border border-success mb-2" style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: '8px' }}>{h.badge}</span>
                  <h6 className="fw-bold mb-1" style={{ color: 'var(--primary)', fontSize: '0.98rem' }}>{h.name}</h6>
                  <small className="text-muted d-block" style={{ fontSize: '0.82rem' }}>{h.dept}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LISTE DES DEMANDES DE GARANTIE ACCESSIBLES SELON LE RÔLE */}
      {activeTab === 'list' && (isStaff || isCitizen || (isPublic && publicSearchCmu)) && (
        <div className="card shadow-sm border-0 p-4" style={{ borderRadius: '20px', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
          {/* Bannière de rôle distincte */}
          {isStaff && (
            <div className="mb-3 p-3 rounded-4 d-flex align-items-center gap-3" style={{
              borderRadius: '14px',
              background: isSuperAdmin ? 'linear-gradient(90deg, rgba(234,179,8,0.15) 0%, rgba(234,179,8,0.05) 100%)'
                       : isAgent   ? 'linear-gradient(90deg, #1e3a5f 0%, #1d4ed8 100%)'
                       : 'linear-gradient(90deg, #0f766e 0%, #0d9488 100%)',
              color: isSuperAdmin ? '#92400e' : '#ffffff',
              border: isSuperAdmin ? '1px solid rgba(234,179,8,0.4)' : 'none'
            }}>
              <span style={{ fontSize: '1.6rem' }}>
                {isSuperAdmin ? '👑' : isAgent ? '🛡️' : '🩺'}
              </span>
              <div className="d-flex flex-column gap-1">
                <h6 className="fw-extrabold mb-0" style={{ fontSize: '1.05rem', color: 'inherit', letterSpacing: '-0.01em' }}>
                  {isSuperAdmin && 'Mode superadmin'}
                  {isAgent && 'Mode agent UNAMUSC'}
                  {(isDoctor || isMidwife) && `Mode ${isDoctor ? 'médecin' : 'sage-femme'}`}
                  {isCitizen && 'Mode lecture seule'}
                </h6>
                <span className="small" style={{ opacity: 0.9, fontSize: '0.88rem', lineHeight: '1.45' }}>
                  {isSuperAdmin && 'Accès total : Tous les dossiers et toutes les actions sont disponibles.'}
                  {isAgent && 'Instruction & homologation : Validez, définissez le taux et le plafond, ou rejetez avec note.'}
                  {(isDoctor || isMidwife) && 'Consultation des dossiers : Consultez les garanties liées à vos patients (lecture + PDF).'}
                  {isCitizen && 'Espace assuré : Consultez vos lettres de garantie et téléchargez vos attestations certifiées.'}
                </span>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
            <h4 className="fw-bold mb-0 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
              <span>📋</span> {canInstruire ? 'Gestion & instruction des lettres de garantie UNAMUSC' : (isDoctor || isMidwife) ? 'Dossiers patients — lettres de garantie' : 'Mes lettres de garantie & attestations habilitées'}
            </h4>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              {(canInstruire || isSuperAdmin) && (
                <button 
                  type="button" 
                  className="btn btn-emerald fw-bold text-white px-3.5 py-2 d-inline-flex align-items-center gap-2 shadow-sm" 
                  style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem' }}
                  onClick={() => {
                    setIsNewLetterObj(true);
                    setEditingLetterObj({
                      first_name: '',
                      last_name: '',
                      cmu_number: activeCmuNumber,
                      ipp_number: 'IPP-DANTEC-2026-8812',
                      hospital_name: 'Hôpital Universitaire de Fann (Dakar)',
                      medical_act: '',
                      estimated_amount: 250000,
                      guaranteed_percentage: 80,
                      status: 'approved',
                      agent_note: 'Demande créée et homologuée directement par l\'agent UNAMUSC.'
                    });
                  }}
                >
                  <span>➕ Émettre une nouvelle lettre de garantie</span>
                </button>
              )}

              {isCitizen && (
                <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px' }}>
                  👤 Assuré connecté : {activeFirstName} {activeLastName} ({activeCmuNumber})
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Chargement des dossiers de garantie...</div>
          ) : visibleLetters.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {isCitizen 
                ? 'Aucune demande de garantie enregistrée pour votre compte assuré.' 
                : 'Aucun dossier ne correspond à ce N° de Carte CSU.'}
            </div>
          ) : (
            <div className="table-responsive rounded-4 border" style={{ borderColor: 'rgba(255, 255, 255, 0.25)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
              <table className="table align-middle mb-0" style={{ color: 'var(--text-main)', borderCollapse: 'collapse', minWidth: '1500px' }}>
                <thead>
                  <tr style={{ background: 'var(--card-bg)' }}>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Assuré / bénéficiaire</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Acte médical & établissement</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Devis soumis</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Prise en charge accordée</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Statut & homologation</th>
                    <th style={{ padding: '1.1rem 1rem', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal' }}>Code garantie</th>
                    <th style={{ padding: '1.1rem 1rem', textAlign: 'right', fontSize: '0.85rem', fontWeight: '800', border: '1px solid rgba(255, 255, 255, 0.25)', textTransform: 'none', letterSpacing: 'normal', minWidth: '450px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLetters.map((item, idx) => {
                    const bInfo = getBeneficiaryInfo(`${item.first_name} ${item.last_name}`, item.cmu_number || activeCmuNumber);
                    return (
                      <tr 
                        key={item.id} 
                        style={{ 
                          background: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.03)' : 'transparent' 
                        }}
                      >
                        {/* 1. Assuré / bénéficiaire */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <div className="d-flex flex-column" style={{ gap: '0.45rem' }}>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <strong style={{ color: 'var(--text-main)', fontSize: '0.98rem', fontWeight: '800' }}>
                                {item.first_name} {item.last_name}
                              </strong>
                              {bInfo.index === 1 ? (
                                <span className="badge bg-success-subtle text-success border border-success px-2 py-0.5" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>
                                  Titulaire .1
                                </span>
                              ) : (
                                <span className="badge bg-warning-subtle text-warning border border-warning px-2 py-0.5" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>
                                  Ayant droit .{bInfo.index}
                                </span>
                              )}
                            </div>

                            <div className="text-muted" style={{ fontSize: '0.82rem' }}>
                              <span className="fw-semibold">N° CSU : </span>
                              <code className="px-2 py-0.5 bg-dark text-success border border-success rounded-2 fw-bold" style={{ fontSize: '0.8rem' }}>
                                {bInfo.beneficiaryCode}
                              </code>
                            </div>

                            <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                              <span className="fw-semibold">Code adhérent : </span>
                              <span className="fw-bold" style={{ color: 'var(--text-main)' }}>{bInfo.adherentCode}</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Acte médical & établissement */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top', maxWidth: '280px' }}>
                          <div className="d-flex flex-column gap-1.5">
                            <strong className="d-block" style={{ color: 'var(--text-main)', fontSize: '0.94rem', lineHeight: '1.4' }}>
                              {item.medical_act}
                            </strong>
                            {item.hospital_name && (
                              <small className="text-muted d-block" style={{ fontSize: '0.82rem' }}>
                                🏥 {item.hospital_name}
                              </small>
                            )}
                          </div>
                        </td>

                        {/* 3. Devis soumis */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <div className="d-flex flex-column gap-1">
                            <div style={{ color: 'var(--text-main)', fontSize: '0.92rem', fontWeight: '800' }}>
                              Devis estimé: {Number(item.estimated_amount).toLocaleString('fr-FR')} FCFA
                            </div>
                          </div>
                        </td>

                        {/* 4. Prise en charge accordée */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <div className="d-flex flex-column gap-1">
                            {item.is_sesame || item.is_senior ? (
                              <>
                                <div className="text-success" style={{ fontSize: '0.94rem', fontWeight: '800' }}>
                                  Accord 100% : {Number(item.max_amount || item.estimated_amount).toLocaleString('fr-FR')} FCFA
                                </div>
                                <div>
                                  <span className="badge px-2 py-0.5 fw-bold" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b', fontSize: '0.72rem', borderRadius: '6px' }}>
                                    🧓 Plan SESAME (60 ans +) • 100%
                                  </span>
                                </div>
                                <small className="text-muted" style={{ fontSize: '0.74rem' }}>
                                  UNAMUSC: 80% ({((item.estimated_amount || 0) * 0.8).toLocaleString()} FCFA) + SESAME: 20%
                                </small>
                                <small className="text-success fw-bold" style={{ fontSize: '0.75rem' }}>
                                  Reste patient : 0 FCFA
                                </small>
                              </>
                            ) : (
                              <>
                                <div className="text-success" style={{ fontSize: '0.94rem', fontWeight: '800' }}>
                                  Accord UNAMUSC: {Number(item.max_amount || (item.estimated_amount * ((item.guaranteed_percentage || 80) / 100))).toLocaleString('fr-FR')} FCFA
                                </div>
                                <div>
                                  <span className="badge bg-success-subtle text-success border border-success px-2 py-0.5 fw-bold" style={{ fontSize: '0.74rem', borderRadius: '6px' }}>
                                    Taux : {item.guaranteed_percentage || 80}%
                                  </span>
                                </div>
                                <small className="text-warning fw-bold" style={{ fontSize: '0.74rem' }}>
                                  Ticket modérateur (20%) : {Number(item.patient_rest || (item.estimated_amount * 0.2)).toLocaleString()} FCFA
                                </small>
                              </>
                            )}
                          </div>
                        </td>

                        {/* 5. Statut & homologation */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          {item.status === 'approved' && (
                            <span className="badge bg-success px-3 py-2 text-white fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', fontSize: '0.8rem' }}>
                              ✅ Validée UNAMUSC
                            </span>
                          )}
                          {item.status === 'emergency_issued' && (
                            <div className="d-flex flex-column gap-1">
                              <span className="badge px-3 py-1.5 text-white fw-bold d-inline-block shadow-sm" style={{ background: '#7c3aed', borderRadius: '10px', fontSize: '0.78rem' }}>
                                🚨 Délivrée d'urgence (7j/7)
                              </span>
                              <small className="text-muted fw-semibold" style={{ fontSize: '0.72rem' }}>
                                ⏳ Régularisation agent due
                              </small>
                            </div>
                          )}
                          {item.status === 'pending' && (
                            <span className="badge bg-warning text-dark px-3 py-2 fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', fontSize: '0.8rem' }}>
                              ⏳ En instruction agent
                            </span>
                          )}
                          {item.status === 'rejected' && (
                            <span className="badge bg-danger text-white px-3 py-2 fw-bold d-inline-block shadow-sm" style={{ borderRadius: '12px', fontSize: '0.8rem' }}>
                              ❌ Rejetée
                            </span>
                          )}
                        </td>

                        {/* 6. Code garantie */}
                        <td style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top' }}>
                          <code className="px-3 py-1.5 bg-dark text-success border border-success rounded-3 fw-bold d-inline-block shadow-sm" style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>
                            {item.validation_code}
                          </code>
                        </td>

                        {/* 7. Actions */}
                        <td className="text-end" style={{ padding: '1.1rem 1rem', border: '1px solid rgba(255, 255, 255, 0.2)', verticalAlign: 'top', whiteSpace: 'nowrap', minWidth: '450px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {/* Rôle Agent / SuperAdmin : Bouton Instruire / Valider */}
                            {canInstruire || isSuperAdmin ? (
                              <button
                                type="button"
                                className="btn btn-sm text-white fw-bold px-3 py-2 shadow-sm hover-lift"
                                onClick={() => openInstructionModal(item)}
                                style={{ background: isSuperAdmin ? '#92400e' : '#059669', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.84rem' }}
                              >
                                {isSuperAdmin ? '👑' : '🛡️'} {item.status === 'approved' ? '📄 Certificat PDF' : '⚙️ Instruire'}
                              </button>
                            ) : isDoctor || isMidwife ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success fw-bold px-3 py-2 hover-lift"
                                  onClick={() => openInstructionModal(item)}
                                  title="Consultation du dossier patient (lecture)"
                                  style={{ borderRadius: '10px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                  🩺 Voir dossier
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm text-white fw-bold px-3 py-2 hover-lift"
                                  onClick={() => generateAndPrintPDFWindow(item)}
                                  style={{ background: '#059669', border: 'none', borderRadius: '10px', fontSize: '0.84rem', boxShadow: '0 3px 10px rgba(5,150,105,0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                  🖨️ PDF
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm text-white fw-bold px-3 py-2 shadow-sm hover-lift"
                                onClick={() => generateAndPrintPDFWindow(item)}
                                style={{ background: '#059669', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '0.84rem' }}
                              >
                                🖨️ Certificat PDF
                              </button>
                            )}

                            {/* Bouton MODIFIER la garantie */}
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
                              title="Modifier la lettre de garantie"
                              onClick={() => {
                                setEditingLetterObj({ ...item });
                                setIsNewLetterObj(false);
                              }}
                            >
                              ✏️ Modifier
                            </button>

                            {/* Bouton SUPPRIMER la garantie */}
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
                              title="Supprimer la garantie"
                              onClick={() => handleDeleteLetterObj(item)}
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
          )}

        {/* Pagination Controls */}
        {(() => {
          const pageSize = 10;
          const citizenTotalAmount = visibleLetters.reduce((sum, l) => sum + (Number(l.max_amount || l.unamusc_amount || (l.estimated_amount * 0.8)) || 0), 0);
          const totalVolume = isCitizen ? visibleLetters.length : 1840;
          const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
          const safePage = Math.min(letterPage, totalPages);
          const startItem = totalVolume === 0 ? 0 : (safePage - 1) * pageSize + 1;
          const endItem = Math.min(safePage * pageSize, totalVolume);

          const getVisiblePages = () => {
            const pages = [1];
            if (safePage > 3) pages.push('...');
            for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) {
              if (!pages.includes(p)) pages.push(p);
            }
            if (safePage < totalPages - 2) pages.push('...');
            if (!pages.includes(totalPages)) pages.push(totalPages);
            return pages;
          };

          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                {isCitizen ? (
                  <>
                    Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem}</strong> sur <strong style={{ color: '#059669' }}>{totalVolume} demande(s) de garantie</strong> ({citizenTotalAmount.toLocaleString('fr-FR')} FCFA garantis)
                  </>
                ) : (
                  <>
                    Affichage de <strong style={{ color: 'var(--text-main)' }}>{startItem.toLocaleString('fr-FR')}</strong> à <strong style={{ color: 'var(--text-main)' }}>{endItem.toLocaleString('fr-FR')}</strong> sur <strong style={{ color: '#059669' }}>1 840 demandes de garantie</strong> (16 640 000 FCFA garantis)
                  </>
                )}
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-outline btn-sm hover-lift"
                    disabled={safePage <= 1}
                    onClick={() => setLetterPage(prev => Math.max(1, prev - 1))}
                    style={{ borderRadius: '10px' }}
                  >
                    ⬅️ Précédent
                  </button>

                  {getVisiblePages().map((p, idx) => {
                    if (p === '...') return <span key={`dots-${idx}`} style={{ padding: '0 0.2rem', color: 'var(--text-sub)' }}>...</span>;
                    return (
                      <button
                        key={p}
                        className={`btn btn-sm ${safePage === p ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setLetterPage(p)}
                        style={{ minWidth: '36px', fontWeight: safePage === p ? '800' : 'normal', borderRadius: '8px' }}
                      >
                        {p}
                      </button>
                    );
                  })}

                  <button
                    className="btn btn-outline btn-sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setLetterPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Suivant ➡️
                  </button>
                </div>
              )}
            </div>
          );
        })()}
        </div>
      )}

      {/* DECK D'INSTRUCTION ET CERTIFICAT OFFICIEL (React Portal — Centered on Screen) */}
      {selectedLetter && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.2rem', overflow: 'hidden' }}>
          <div className="modal-content border-0" style={{ maxWidth: '1080px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            {/* Entête Modal Officielle UNAMUSC */}
            <div 
              className="modal-header p-4 text-white position-relative"
              style={{
                background: selectedLetter.status === 'approved' 
                  ? 'linear-gradient(135deg, #059669 0%, #064e3b 100%)' 
                  : 'linear-gradient(135deg, #d97706 0%, #78350f 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.2)',
                flexShrink: 0
              }}
            >
              <div>
                <span className="badge px-3 py-1 mb-2 fw-bold text-white d-inline-block" style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '20px' }}>
                  🇸🇳 UNAMUSC — Dossier de prise en charge #{selectedLetter.validation_code}
                </span>
                <h4 className="fw-bold mb-1 text-white" style={{ textTransform: 'none' }}>
                  📄 Instruction & attestation de garantie : {selectedLetter.first_name} {selectedLetter.last_name}
                </h4>
                <small className="text-white-50">
                  Homologation 100% humaine par l'agent habilité de l'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC).
                </small>
              </div>
              <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedLetter(null)}></button>
            </div>

            {/* Navigation Onglets Interne au Modal */}
            <div className="d-flex border-bottom p-3 gap-2 flex-wrap" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', flexShrink: 0 }}>
              <button 
                type="button" 
                className="btn fw-bold px-4 py-2.5"
                style={{
                  background: modalTab === 'instruction' ? '#059669' : 'var(--bg-card)',
                  color: modalTab === 'instruction' ? '#ffffff' : 'var(--text-sub)',
                  border: modalTab === 'instruction' ? '2px solid #ffffff' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: modalTab === 'instruction' ? '0 4px 12px rgba(5, 150, 105, 0.4)' : 'none',
                  textTransform: 'none'
                }}
                onClick={() => setModalTab('instruction')}
              >
                ⚙️ 1. Instruction & décision agent UNAMUSC
              </button>
              <button 
                type="button" 
                className="btn fw-bold px-4 py-2.5"
                style={{
                  background: modalTab === 'certificate' ? '#059669' : 'var(--bg-card)',
                  color: modalTab === 'certificate' ? '#ffffff' : 'var(--text-sub)',
                  border: modalTab === 'certificate' ? '2px solid #ffffff' : '1px solid var(--border-color)',
                  borderRadius: '10px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: modalTab === 'certificate' ? '0 4px 12px rgba(5, 150, 105, 0.4)' : 'none',
                  textTransform: 'none'
                }}
                onClick={() => setModalTab('certificate')}
              >
                📄 2. Certificat officiel & prise en charge PDF
              </button>
            </div>

            <div className="modal-body p-4" style={{ flex: 1, overflowY: 'auto' }}>
              {/* ONGLET 1 : INSTRUCTION & CALCUL DE PRISE EN CHARGE */}
              {modalTab === 'instruction' && (
                <div className="fade-in-up">
                  <div className="row g-4 mb-4">
                    {/* Carte Bénéficiaire */}
                    <div className="col-md-6">
                      <div className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                        <span className="small text-muted d-block mb-1">👤 Assuré bénéficiaire :</span>
                        <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h5>
                        <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
                          <code className="px-2.5 py-1 bg-dark text-success border border-success rounded-3 fw-bold">
                            N° {selectedLetter.cmu_number}
                          </code>
                          <span className="badge bg-secondary">
                            {selectedLetter.ipp_number || 'IPP-FANN-2026-8812'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Carte Établissement & Acte */}
                    <div className="col-md-6">
                      <div className="p-3.5 rounded-4 border" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                        <span className="small text-muted d-block mb-1">🏥 Acte & établissement récepteur :</span>
                        <h6 className="fw-bold mb-1 text-success">{selectedLetter.medical_act}</h6>
                        <small className="text-muted d-block mt-1">Devis d'hospitalisation soumis : <strong>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong></small>
                      </div>
                    </div>
                  </div>

                  {/* SECTION ORDONNANCE MÉDICALE : AFFICHAGE POUR LE GÉRANT */}
                  {selectedLetter.prescription_photo && selectedLetter.prescription_photo !== '/ordonnance_demo.jpg' && (
                    <div className="mb-4 p-3 rounded-3" style={{ background: 'rgba(5,150,105,0.07)', border: '2px dashed #059669', borderRadius: '14px' }}>
                      <strong className="d-block mb-2 fw-bold text-success" style={{ fontSize: '0.9rem' }}>
                        📋 Ordonnance médicale téléversée par l'assuré : à vérifier avant accord :
                      </strong>
                      <img
                        src={selectedLetter.prescription_photo}
                        alt="Ordonnance médicale"
                        style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '10px', objectFit: 'contain', border: '1.5px solid #059669', background: '#fff' }}
                      />
                      <div className="d-flex gap-2 mt-3 flex-wrap">
                        <span className="badge px-3 py-2 fw-bold" style={{ background: '#f59e0b', color: '#0f172a', borderRadius: '10px', fontSize: '0.82rem' }}>
                          ⏳ En attente de validation du gérant
                        </span>
                        <span className="badge bg-white text-dark border px-3 py-2 fw-bold" style={{ borderRadius: '10px', fontSize: '0.82rem' }}>
                          🔍 Vérifiez lisibilité, signature & tampon médecin
                        </span>
                      </div>
                    </div>
                  )}

                  {/* CALCULATEUR EXÉCUTIF DE COUVERTURE & RESTES À CHARGE */}
                  <div className="card p-4 rounded-4 border-0 mb-4 shadow-sm" style={{ background: 'rgba(5, 150, 105, 0.06)', borderLeft: '5px solid var(--primary)' }}>
                    <h5 className="fw-bold mb-3 text-success d-flex align-items-center gap-2" style={{ textTransform: 'none' }}>
                      <span>⚙️</span> Calculateur UNAMUSC de prise en charge & plafond tiers-payant
                    </h5>

                    <div className="row g-4 align-items-center mb-4">
                      <div className="col-md-6">
                        <label className="form-label fw-bold small">Taux de couverture accordé par l'UNAMUSC (%)</label>
                        <div className="d-flex align-items-center gap-2">
                          <input 
                            type="range" 
                            className="form-range flex-grow-1"
                            min="10"
                            max="100"
                            step="5"
                            value={guaranteedPct}
                            onChange={(e) => handlePctChange(e.target.value)}
                          />
                          <span className="badge bg-success fs-6 px-3 py-2 fw-bold">{guaranteedPct}%</span>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <label className="form-label fw-bold small">Plafond maximum garanti ajusté (FCFA)</label>
                        <input 
                          type="number" 
                          className="form-control input fw-bold"
                          value={maxAmount}
                          onChange={(e) => handleMaxAmountChange(e.target.value)}
                          style={{ borderRadius: '10px' }}
                        />
                      </div>
                    </div>

                    {/* Bilan financier dynamique */}
                    {(() => {
                      const estVal = parseFloat(selectedLetter.estimated_amount) || 0;
                      const calcGuarantee = maxAmount !== '' ? (parseFloat(maxAmount) || 0) : (estVal * (parseFloat(guaranteedPct) / 100));
                      const calcRest = Math.max(0, estVal - calcGuarantee);

                      return (
                        <div className="p-3.5 rounded-3 border border-success" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)' }}>
                          <div className="row g-3 text-center">
                            <div className="col-md-4">
                              <span className="small d-block mb-1" style={{ color: 'var(--text-sub)' }}>Montant devis soumis</span>
                              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)' }}>{Number(estVal).toLocaleString()} FCFA</h5>
                            </div>
                            <div className="col-md-4 border-start border-end" style={{ borderColor: 'var(--border-color)' }}>
                              <span className="text-success small d-block mb-1">Prise en charge UNAMUSC/CSU</span>
                              <h4 className="fw-bold mb-0 text-success">{Number(calcGuarantee).toLocaleString()} FCFA ({guaranteedPct}%)</h4>
                            </div>
                            <div className="col-md-4">
                              <span className="text-warning small d-block mb-1">Reste à charge patient (ticket modérateur)</span>
                              <h5 className="fw-bold mb-0 text-warning">{Number(calcRest).toLocaleString()} FCFA</h5>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="mt-4">
                      <label className="form-label fw-bold small">Note d'instruction & observations de l'agent habilité UNAMUSC *</label>
                      <textarea 
                        className="form-control input" 
                        rows="3"
                        value={agentNote}
                        onChange={(e) => setAgentNote(e.target.value)}
                        placeholder="Saisissez ici le motif d'acceptation, d'ajustement du plafond ou de réserve..."
                        style={{ borderRadius: '10px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ONGLET 2 : CERTIFICAT OFFICIEL HAUTE DÉFINITION (STYLE VOUCHER IMPRIMABLE) */}
              {modalTab === 'certificate' && (
                <div className="fade-in-up">
                  <div 
                    id="printable-certificate"
                    className="p-5 rounded-4 border shadow-sm position-relative overflow-hidden mb-4"
                    style={{ 
                      background: '#ffffff', 
                      color: '#0f172a',
                      fontFamily: 'Inter, Arial, sans-serif',
                      border: '2px solid #047857'
                    }}
                  >
                    {/* Entête Officiel Sénégal avec Drapeau 🇸🇳 et Logo Officiel UNAMUSC */}
                    <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-4" style={{ borderColor: '#cbd5e1' }}>
                      <div className="d-flex align-items-center gap-3">
                        <img 
                          src="/senegal_flag.png" 
                          alt="Drapeau du Sénégal 🇸🇳" 
                          style={{ width: '58px', height: '38px', objectFit: 'cover', borderRadius: '4px', border: '1.5px solid #d97706', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }} 
                        />
                        <div>
                          <h6 className="fw-bold mb-0" style={{ color: '#047857', letterSpacing: '0.2px', fontSize: '0.92rem' }}>
                            République du Sénégal
                          </h6>
                          <small className="text-muted fw-semibold" style={{ fontSize: '0.75rem' }}>Un Peuple — Un But — Une Foi</small><br />
                          <strong className="small" style={{ color: '#0f172a', fontSize: '0.82rem' }}>
                            Union nationale des mutuelles de santé communautaires (UNAMUSC)
                          </strong><br />
                           <span className="badge bg-success-subtle text-success border border-success fw-semibold" style={{ fontSize: '0.72rem' }}>
                              Programme national de la couverture sanitaire du Sénégal
                           </span>
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-3 text-end">
                        <img 
                          src="/unamusc_logo.png" 
                          alt="Logo Officiel UNAMUSC" 
                          style={{ width: '75px', height: '75px', objectFit: 'contain' }} 
                        />
                      </div>
                    </div>

                    <div className="text-center my-4 p-4 rounded-3" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.88) 0%, rgba(4, 120, 87, 0.92) 100%), url("/csu_claims_hero.png") center/cover no-repeat', border: '1px solid rgba(255,255,255,0.3)', position: 'relative', color: '#fff' }}>
                      <h4 className="fw-bold mb-1" style={{ color: '#ffffff', letterSpacing: '0.3px' }}>
                        Attestation officielle de prise en charge hospitalière
                      </h4>
                      <small style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>Émise sous le système de tiers-payant UNAMUSC — Programme national de la couverture sanitaire du Sénégal</small><br />
                      <code className="mt-2 d-inline-block px-3 py-1 bg-white text-success border border-success rounded-3 fw-bold fs-6" style={{ position: 'relative', zIndex: 1 }}>
                        Code homologation : #{selectedLetter.validation_code}
                      </code>
                    </div>

                    {/* Grille des caractéristiques — Haute Lisibilité et Contraste Explicite */}
                    <div className="row g-4 mb-4 p-4 rounded-3" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: 'inset 0 0 0 1px #f1f5f9' }}>
                      <div className="col-md-6">
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'none', letterSpacing: 'normal' }}>
                          👤 Bénéficiaire assuré :
                        </span>
                        <h5 className="fw-bold mb-1" style={{ color: '#0f172a' }}>{selectedLetter.first_name} {selectedLetter.last_name}</h5>
                        <div className="small" style={{ color: '#334155' }}>
                          N° Carte CSU : <strong style={{ color: '#0f172a' }}>{selectedLetter.cmu_number}</strong> | IPP : <strong style={{ color: '#0f172a' }}>{selectedLetter.ipp_number || 'IPP-FANN-2026-8812'}</strong>
                        </div>
                        <small className="text-success fw-bold d-block mt-1">
                          Organisme émetteur : Tiers-payant UNAMUSC Sénégal
                        </small>
                      </div>

                      <div className="col-md-6">
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'none', letterSpacing: 'normal' }}>
                          🏥 Structure hospitalière d'accueil :
                        </span>
                        <h6 className="fw-bold mb-1" style={{ color: '#047857', fontSize: '1rem' }}>
                          {selectedLetter.hospital_name || selectedLetter.medical_act}
                        </h6>
                        <div className="small" style={{ color: '#334155' }}>
                          Conventionné tiers-payant UNAMUSC (validation 100% humaine)
                        </div>
                      </div>

                      <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'none', letterSpacing: 'normal' }}>
                          📋 Acte médical / hospitalisation prescrite :
                        </span>
                        <strong className="d-block" style={{ color: '#0f172a', fontSize: '0.95rem' }}>{selectedLetter.medical_act}</strong>
                      </div>

                      <div className="col-md-6 border-top pt-3" style={{ borderColor: '#e2e8f0' }}>
                        <span className="small fw-bold d-block mb-1" style={{ color: '#475569', textTransform: 'none', letterSpacing: 'normal' }}>
                          💰 Montant estimé & accord de prise en charge :
                        </span>
                        <div className="small" style={{ color: '#334155' }}>
                          Devis soumis : <strong style={{ color: '#0f172a' }}>{Number(selectedLetter.estimated_amount).toLocaleString()} FCFA</strong><br />
                          {selectedLetter.is_sesame || selectedLetter.is_senior ? (
                            <>
                              <span className="badge bg-warning text-dark fw-bold mb-1">🧓 Bénéficiaire Plan SESAME (60 ans et +)</span><br />
                              Prise en charge UNAMUSC (80%) : <strong style={{ color: '#047857' }}>{Number(selectedLetter.unamusc_amount || selectedLetter.estimated_amount * 0.8).toLocaleString()} FCFA</strong><br />
                              Contrepartie Plan SESAME État (20%) : <strong style={{ color: '#d97706' }}>{Number(selectedLetter.sesame_amount || selectedLetter.estimated_amount * 0.2).toLocaleString()} FCFA</strong><br />
                              <span style={{ color: '#059669', fontWeight: 'bold' }}>Reste à charge patient senior : 0 FCFA (Prise en charge 100%)</span>
                            </>
                          ) : (
                            <>
                              Prise en charge UNAMUSC ({selectedLetter.guaranteed_percentage || 80}%) : <strong style={{ color: '#047857', fontSize: '1.05rem' }}>{Number(selectedLetter.guaranteed_amount || selectedLetter.max_amount || (selectedLetter.estimated_amount * 0.8)).toLocaleString()} FCFA</strong><br />
                              <span style={{ color: '#b45309', fontWeight: 'bold' }}>Reste à charge patient (ticket modérateur 20%) : {Number(selectedLetter.estimated_amount - (selectedLetter.guaranteed_amount || selectedLetter.max_amount || (selectedLetter.estimated_amount * 0.8))).toLocaleString()} FCFA</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Engagement Financier Officiel UNAMUSC & Tampon Numérique */}
                    <div className="row g-4 align-items-center">
                      <div className="col-md-8">
                        <div className="p-3 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
                          <strong className="small d-block text-success mb-1 fw-bold">Clause officielle d'engagement financier UNAMUSC :</strong>
                          <p className="small mb-0 text-dark" style={{ lineHeight: '1.5', color: '#0f172a' }}>
                            {selectedLetter.agent_note || 'L\'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC) s\'engage sous le Programme National de la Couverture Sanitaire du Sénégal à régler directement à l\'établissement hospitalier le montant garanti sous présentation de la facture finale conforme.'}
                          </p>
                          {selectedLetter.is_emergency_issuance && (
                            <div className="mt-2 text-primary fw-bold" style={{ fontSize: '0.78rem' }}>
                              🚨 Délivrance d'Urgence Permanente : {selectedLetter.emergency_period === 'weekend' ? 'Permanence Week-End (24h/24)' : 'Permanence de Garde (17h00 - 07h59)'} • Soins garantis 7j/7.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-md-4 text-center">
                        <div className="p-2 bg-white rounded-3 shadow-sm d-inline-block border mb-2">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`https://mutualis.sn/#/verify/${selectedLetter.validation_code}`)}`} 
                            alt="QR Code Validation" 
                            style={{ width: '80px', height: '80px' }} 
                          />
                        </div>
                        <div className="small fw-bold text-success">Tampon numérique officiel UNAMUSC</div>
                        <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Homologué par l'UNAMUSC — Signature agent habilité</small>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-center gap-3 flex-wrap">
                    <button 
                      type="button" 
                      className="btn btn-success fw-bold text-white px-4 py-2.5 shadow-sm"
                      onClick={handleDownloadPDF}
                      style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669', textTransform: 'none' }}
                    >
                      📥 Télécharger le certificat PDF officiel
                    </button>

                    <button 
                      type="button" 
                      className="btn btn-outline-success fw-bold px-4 py-2.5 shadow-sm"
                      onClick={() => {
                        setSelectedLetter(null);
                        if (setView) setView('verify');
                        window.location.hash = `#/verify/${selectedLetter.validation_code}`;
                      }}
                      style={{ borderRadius: '12px', textTransform: 'none' }}
                    >
                      🔍 Tester la vérification instantanée (#/verify)
                    </button>

                    <button 
                      type="button" 
                      className="btn fw-bold px-4 py-2.5 shadow-sm"
                      onClick={handlePrintCertificate}
                      style={{ borderRadius: '12px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', color: 'var(--text-main)', textTransform: 'none' }}
                    >
                      🖨️ Imprimer la lettre de garantie
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pied de Modale & Boutons de validation finale */}
            <div className="modal-footer border-top p-3 d-flex justify-content-between" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn text-white fw-bold px-4" 
                onClick={() => setSelectedLetter(null)} 
                style={{ background: '#334155', border: '1px solid #475569', borderRadius: '10px', color: '#ffffff', textTransform: 'none' }}
              >
                Fermer
              </button>

              {modalTab === 'instruction' && (
                <div className="d-flex gap-3">
                  <button 
                    type="button" 
                    className="btn btn-danger fw-bold px-3 py-2 text-white" 
                    onClick={() => handleValidateAgent('rejected')}
                    style={{ borderRadius: '10px', textTransform: 'none' }}
                  >
                    ❌ Rejeter la demande
                  </button>

                  <button 
                    type="button" 
                    className="btn btn-success fw-bold px-4 py-2 text-white" 
                    onClick={() => handleValidateAgent('approved')}
                    style={{ background: '#059669', borderColor: '#059669', borderRadius: '10px' }}
                  >
                    ✅ Émettre & Certifier la Garantie à 100% / 80%
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}
      {/* MODAL DE CRÉATION / ÉDITION DE LETTRE DE GARANTIE (React Portal) */}
      {editingLetterObj && createPortal(
        <div 
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingLetterObj(null); }}
        >
          <form onSubmit={handleSaveLetterObj} style={{ maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #059669', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                  📜
                </div>
                <div>
                  <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                    {isNewLetterObj ? 'Émettre une nouvelle lettre de garantie UNAMUSC' : 'Modifier la lettre de garantie'}
                  </h5>
                  <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                    UNAMUSC • Couverture Hospitalière & Tiers-payant
                  </span>
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setEditingLetterObj(null)}></button>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Prénom du bénéficiaire *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.first_name || ''}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, first_name: e.target.value })}
                  placeholder="Ex: Amadou"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Nom du bénéficiaire *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.last_name || ''}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, last_name: e.target.value })}
                  placeholder="Ex: Sow"
                  required
                />
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">N° de Carte CSU *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.cmu_number || ''}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, cmu_number: e.target.value })}
                  placeholder="Ex: CSU-DKR-2026-8812.2"
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label small fw-bold mb-1">Code IPP Patient *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.ipp_number || ''}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, ipp_number: e.target.value })}
                  placeholder="Ex: IPP-FANN-2026-8812"
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Établissement hospitalier d'accueil *</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                value={editingLetterObj.hospital_name || ''}
                onChange={(e) => setEditingLetterObj({ ...editingLetterObj, hospital_name: e.target.value })}
                placeholder="Ex: Hôpital Universitaire de Fann (Dakar)"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Acte médical / intervention prescrite *</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                value={editingLetterObj.medical_act || ''}
                onChange={(e) => setEditingLetterObj({ ...editingLetterObj, medical_act: e.target.value })}
                placeholder="Ex: Intervention chirurgicale ORL, 5 jours d'hospitalisation"
                required
              />
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Devis estimé (FCFA) *</label>
                <input 
                  type="number" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.estimated_amount || ''}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, estimated_amount: e.target.value })}
                  placeholder="Ex: 250000"
                  required
                />
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Taux garanti (%) *</label>
                <select 
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.guaranteed_percentage || 80}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, guaranteed_percentage: e.target.value })}
                >
                  <option value={80}>80% Tiers-payant UNAMUSC</option>
                  <option value={100}>100% Gratuité Intégrale (Maternité/BSF)</option>
                  <option value={50}>50% Tiers-payant</option>
                </select>
              </div>

              <div className="col-md-4">
                <label className="form-label small fw-bold mb-1">Statut du dossier *</label>
                <select 
                  className="form-select"
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                  value={editingLetterObj.status || 'approved'}
                  onChange={(e) => setEditingLetterObj({ ...editingLetterObj, status: e.target.value })}
                >
                  <option value="approved">✅ Validée (Homologuée)</option>
                  <option value="pending">⏳ En instruction agent</option>
                  <option value="rejected">❌ Rejetée</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label small fw-bold mb-1">Note de l'agent UNAMUSC</label>
              <textarea 
                className="form-control" 
                rows={2}
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                value={editingLetterObj.agent_note || ''}
                onChange={(e) => setEditingLetterObj({ ...editingLetterObj, agent_note: e.target.value })}
                placeholder="Ex: Prise en charge 80% validée sous le système de Tiers-payant UNAMUSC Dakar."
              />
            </div>

            <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
              <button 
                type="button" 
                className="btn px-4 py-2.5 fw-bold" 
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                onClick={() => setEditingLetterObj(null)}
              >
                Annuler
              </button>
              <button 
                type="submit" 
                className="btn px-4.5 py-2.5 fw-bold text-white" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
              >
                💾 Enregistrer la lettre de garantie
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
