import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { initiatePayment, getProviderInfo, validatePhoneForProvider } from '../services/paymentService';
import { speakCleanText } from '../services/voiceAudioService';
import { apiFetch } from '../utils/api';
import { openSignaling } from '../services/signalingService';

// Design Premium Haut de Gamme â€” TÃ©lÃ©mÃ©decine VisioconfÃ©rence Bidirectionnelle & Vu-mÃ¨tre Micro RÃ©el

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Service de PRÃ‰SENCE RÃ‰ELLE des praticiens.
//
// Pourquoi ce module existe : avant, la disponibilitÃ© Ã©tait un simple
// `useState` local au mÃ©decin. Ce drapeau n'Ã©tait visible que chez lui :
// l'assurÃ© lisait Â« Disponible 24/7 Â» et Â« En ligne Â» en dur sur la carte,
// donc il prenait rendez-vous avec un praticien dont personne ne
// vÃ©rifiait la prÃ©sence.
//
// Ici la prÃ©sence est un HEART-BEAT :
//  - le praticien envoie un signal toutes les HEARTBEAT_INTERVAL_MS ;
//  - le serveur date ce signal et ne lit jamais le statut stockÃ© comme
//    vÃ©ritÃ© â€” il recalcule Â« en ligne / hors ligne Â» Ã  chaque lecture ;
//  - si le navigateur se ferme sans signal de dÃ©part (crash, onglet fermÃ©),
//    le signal cesse et le praticien bascule tout seul en hors ligne aprÃ¨s
//    le dÃ©lai serveur.
//
// ConsÃ©quence pour l'interface : on n'affiche jamais un statut qu'on n'a
// pas observÃ©. Sans donnÃ©e du serveur, on affiche Â« statut inconnu Â».
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const HEARTBEAT_INTERVAL_MS = 25 * 1000; // 25 s â€” 3 signaux perdus avant bascule

/**
 * Envoie un signal de prÃ©sence. Silencieux : un Ã©chec rÃ©seau ne doit
 * jamais interrompre la consultation en cours.
 */
export async function sendHeartbeat({ practitionerName, specialty, declaredStatus }) {
  const res = await apiFetch('/api/telemedicine/presence/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ practitionerName, specialty, declaredStatus })
  });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json && json.success ? json.data : null;
}

/**
 * RÃ©cupÃ¨re la prÃ©sence de tous les praticiens connus du serveur.
 * `online` est recalculÃ© cÃ´tÃ© serveur Ã  l'instant de la requÃªte.
 */
export async function fetchPresence() {
  const res = await apiFetch('/api/telemedicine/presence');
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || !json.success) return null;
  return {
    practitioners: Array.isArray(json.data) ? json.data : [],
    offlineAfterSeconds: json.offline_after_seconds
  };
}

/**
 * Abonnement au flux temps rÃ©el de prÃ©sence (Server-Sent Events).
 *
 * Pourquoi nÃ©cessaire en multi-instance : un balayage pÃ©riodique envoie
 * des requÃªtes qui tombent sur des instances diffÃ©rentes au fil du
 * round-robin du rÃ©partiteur. Chaque instance ne voit que les Ã©vÃ©nements
 * qu'elle a traitÃ©s. Avec le flux, la notification traverse PostgreSQL
 * (LISTEN/NOTIFY) et atteint l'instance qui hÃ©berge le navigateur.
 *
 * Repli automatique : si le flux est indisponible (proxy qui ne gÃ¨re pas
 * SSE, certificat, pare-feu), on repasse au balayage pÃ©riodique et
 * l'interface continue de fonctionner, avec un dÃ©lai de rafraÃ®chissement
 * plus long. Le mode rÃ©ellement utilisÃ© est renvoyÃ© Ã  l'appelant pour
 * qu'il puisse l'afficher â€” on ne laisse pas croire Ã  un temps rÃ©el si
 * ce n'est pas le cas.
 *
 * @param {(data: {practitioners: Array, offlineAfterSeconds: number}) => void} onState
 *        Ã‰tat complet Ã  chaque changement.
 * @param {(mode: 'stream' | 'polling') => void} [onModeChange]
 * @returns {() => void} fonction de fermeture.
 */
export function subscribePresence(onState, onModeChange) {
  const token = (typeof window !== 'undefined' && localStorage.getItem('cmu-token')) || '';
  let source = null;
  let pollingId = null;
  let closed = false;

  const startPolling = () => {
    if (closed || pollingId) return;
    onModeChange?.('polling');
    const load = async () => {
      const data = await fetchPresence().catch(() => null);
      if (!closed && data) onState(data);
    };
    load();
    pollingId = setInterval(load, HEARTBEAT_INTERVAL_MS * 2);
  };

  const stopPolling = () => {
    if (pollingId) {
      clearInterval(pollingId);
      pollingId = null;
    }
  };

  // Sans jeton, aucun flux ne peut Ãªtre authentifiÃ© : le repli est le
  // seul mode possible.
  if (!token || typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    startPolling();
    return () => { closed = true; stopPolling(); };
  }

  try {
    const base = (typeof window !== 'undefined' && window.API_BASE_URL) || '';
    source = new EventSource(`${base}/api/telemedicine/presence/stream?token=${encodeURIComponent(token)}`);

    source.addEventListener('state', (e) => {
      try {
        const d = JSON.parse(e.data);
        onModeChange?.('stream');
        stopPolling();
        onState({ practitioners: d.practitioners || [], offlineAfterSeconds: d.offline_after_seconds });
      } catch (err) { /* message illisible : on ignore cet Ã©vÃ©nement */ }
    });

    source.addEventListener('changed', (e) => {
      try {
        const d = JSON.parse(e.data);
        onModeChange?.('stream');
        stopPolling();
        // On ne fabrique pas l'Ã©tat complet : on redemande au serveur,
        // seul juge. Recomposer la liste ici risquerait d'inventer un
        // statut Ã  partir d'un Ã©vÃ©nement partiel.
        fetchPresence()
          .then((full) => { if (!closed && full) onState(full); })
          .catch(() => {});
      } catch (err) { /* ignore */ }
    });

    // EventSource se reconnecte de lui-mÃªme. L'erreur peut donc Ãªtre
    // transitoire : on bascule sur le repli, qui reste en place mÃªme si
    // le flux revient ensuite â€” plus simple et plus sÃ»r que de
    // synchroniser les deux mÃ©canismes.
    source.onerror = () => {
      if (closed) return;
      startPolling();
    };
  } catch (err) {
    startPolling();
  }

  return () => {
    closed = true;
    if (source) source.close();
    stopPolling();
  };
}

/**
 * Enregistre un rendez-vous SANS paiement.
 * Le rÃ¨glement se fait une seule fois, sur place, Ã  la structure.
 */
export async function bookAppointment({ beneficiaryId, structureId, doctorName, specialty, appointmentDate, notes }) {
  const res = await apiFetch('/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      beneficiary_id: beneficiaryId,
      partner_structure_id: structureId ?? null,
      doctor_name: doctorName,
      specialty,
      appointment_date: appointmentDate,
      notes: notes || ''
    })
  });
  if (!res.ok) return { success: false, message: 'Le rendez-vous n\'a pas pu Ãªtre enregistrÃ©.' };
  return res.json();
}

export { HEARTBEAT_INTERVAL_MS };
export default function Telemedicine({ 
  lang = 'fr', 
  userRole = 'citizen', 
  citizenUser = null, 
  agentUser = null, 
  partnerUser = null, 
  setView = null,
  onNavigate = null 
}) {
  // Navigation helper sans rÃ©gression ReferenceError
  const handleNavigate = (targetView) => {
    const mapped = (targetView === 'carnet-sante' || targetView === 'medical-records') ? 'medical-profile' : targetView;
    if (setView) {
      setView(mapped);
    } else if (onNavigate) {
      onNavigate(mapped);
    } else {
      window.location.hash = `#${mapped}`;
    }
  };

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RBAC â€” DÃ©finition granulaire des rÃ´les & DÃ©partement de l'Agent
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isLabUser    = userRole === 'lab' || userRole === 'biologist' || 
                       (partnerUser?.role && (partnerUser.role.toLowerCase().includes('laboratoire') || partnerUser.role.toLowerCase().includes('biologiste') || partnerUser.role.toLowerCase().includes('imagerie'))) ||
                       (partnerUser?.structureName && (partnerUser.structureName.toLowerCase().includes('pasteur') || partnerUser.structureName.toLowerCase().includes('laboratoire') || partnerUser.structureName.toLowerCase().includes('imagerie')));
  const isDoctor     = !isLabUser && (
    userRole === 'doctor' ||
    (userRole === 'partner' && (
      partnerUser?.role?.toLowerCase().includes('mÃ©decin') ||
      partnerUser?.role?.toLowerCase().includes('medecin') ||
      partnerUser?.role?.toLowerCase().includes('praticien') ||
      partnerUser?.role?.toLowerCase().includes('docteur') ||
      partnerUser?.role?.toLowerCase().includes('dr.') ||
      partnerUser?.role?.toLowerCase() === 'dr' ||
      partnerUser?.category === 'doctor' ||
      partnerUser?.structureType === 'cabinet' ||
      partnerUser?.structureType === 'clinique' ||
      partnerUser?.structureType === 'centre_sante'
    ))
  );
  const isMidwife    = !isLabUser && (userRole === 'midwife' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('sage')));
  const isAgent      = (userRole === 'agent' || (!!agentUser && !isSuperAdmin)) && !isSuperAdmin;
  const isPharmacist = !isLabUser && (userRole === 'pharmacist' || (userRole === 'partner' && partnerUser?.role?.toLowerCase().includes('pharmaci')));
  const isCitizen    = !isAgent && !isDoctor && !isMidwife && !isPharmacist && !isLabUser && !isSuperAdmin && (!!citizenUser || userRole === 'citizen' || userRole === 'citizen_suspended');
  // Alias rÃ©tro-compatibilitÃ©
  const isDoctorOrPartner = isDoctor || isMidwife;
  // Peut dÃ©marrer une consultation / Ã©mettre ordonnance numÃ©rique
  const canConsult = isDoctor || isMidwife || isSuperAdmin;
  // Peut gÃ©rer la file d'attente / planning (administratif)
  const canManageQueue = isAgent || isSuperAdmin;
  const overrideActive = (
    localStorage.getItem(`cmu-status-${citizenUser?.cmuNumber || citizenUser?.cmu_number}`) === 'active' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen'
  );

  // VÃ©rification cotisation payÃ©e pour le citoyen (salle d'attente)
  const isSuspended = !overrideActive && (
    userRole === 'citizen_suspended' ||
    citizenUser?.status === 'suspended' ||
    citizenUser?.status === 'inactif' ||
    citizenUser?.status === 'suspendu' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  // AssurÃ© actif (Chargement dynamique depuis le scan QR / VÃ©rification de carte)
  const storedTargetCmu = localStorage.getItem('telemed_target_cmu');
  const storedTargetName = localStorage.getItem('telemed_target_name');

  const activeCmuNumber = storedTargetCmu || citizenUser?.cmu_number || citizenUser?.cmuNumber || 'DKR_260001.0.41';
  const activeFirstName = storedTargetName ? storedTargetName.trim().split(' ')[0] : (citizenUser?.first_name || citizenUser?.firstName || 'Ibrahima');
  const activeLastName = storedTargetName ? storedTargetName.trim().split(' ').slice(1).join(' ') : (citizenUser?.last_name || citizenUser?.lastName || 'NDIONE');

  // DÃ©partement d'affectation de l'Agent UD
  const agentDept = agentUser?.department || agentUser?.assignedDepartment || agentUser?.assigned_department || citizenUser?.department || 'Dakar Centre';
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(isSuperAdmin ? 'all' : agentDept);
  const [agentActiveTab, setAgentActiveTab] = useState('doctors'); // 'doctors' | 'structures' | 'queue' | 'conventions'

  // Mode de rÃ´le strictement isolÃ© :
  // - Les mÃ©decins ont UNIQUEMENT leur espace praticien
  // - Les agents ont UNIQUEMENT leur espace gestion UD dÃ©partementale
  // - Les assurÃ©s ont UNIQUEMENT leur espace assurÃ©
  // - Le Super Admin peut superviser les trois vues
  const [adminRoleMode, setAdminRoleMode] = useState('citizen'); // 'agent' | 'doctor' | 'citizen' â€” vue AssurÃ© par dÃ©faut
  const activeRoleMode = (isDoctor || isMidwife) ? 'doctor' : (isAgent ? 'agent' : (isSuperAdmin ? adminRoleMode : 'citizen'));
  const [practitionerAvailability, setPractitionerAvailability] = useState('available'); // 'available' | 'in_call' | 'away'

  // â”€â”€ PRÃ‰SENCE RÃ‰ELLE (heart-beat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // `practitionerAvailability` reste une simple INTENTION locale du
  // praticien (Â« je suis en pause Â»). Ce n'est pas une preuve de prÃ©sence :
  // elle ne dit rien de ce que voit l'assurÃ©.
  //
  // `practitionerPresence` contient ce que le SERVEUR a rÃ©ellement observÃ©.
  // C'est la seule source autorisÃ©e pour afficher Â« en ligne Â» Ã  un assurÃ©.
  const [practitionerPresence, setPractitionerPresence] = useState(null); // { practitioners, offlineAfterSeconds }
  // Le premier retour (flux ou repli) est-il arrivÃ© ? Tant que c'est faux,
  // l'interface ne doit afficher aucun statut : Â« en ligne Â» avant toute
  // vÃ©rification serait exactement le mensonge que ce dispositif
  // cherche Ã  Ã©viter.
  const [presenceLoaded, setPresenceLoaded] = useState(false);
  // Mode rÃ©el de rafraÃ®chissement : 'stream' (temps rÃ©el multi-instance)
  // ou 'polling' (repli). AffichÃ© Ã  l'utilisateur pour qu'il sache si le
  // statut affichÃ© est instantanÃ© ou diffÃ©rÃ© de quelques dizaines de
  // secondes.
  const [presenceMode, setPresenceMode] = useState(null); // null | 'stream' | 'polling'

  // IdentitÃ© du praticien cÃ´tÃ© serveur. Sans identifiant rÃ©el, aucun
  // heart-beat n'est envoyÃ© : on ne fabrique pas d'identitÃ© de remplacement,
  // sinon deux praticiens se marcheraient dessus.
  const practitionerIdentity = (isDoctor || isMidwife)
    ? {
        username: partnerUser?.username || partnerUser?.cname || agentUser?.username || null,
        name: partnerUser?.name || partnerUser?.structureName || agentUser?.fullName || agentUser?.name || null,
        specialty: partnerUser?.specialty || (isMidwife ? 'Sage-femme' : 'MÃ©decine GÃ©nÃ©rale')
      }
    : null;

  // Envoi du signal pÃ©riodique. Uniquement si un praticien est rÃ©ellement
  // connectÃ© et identifiÃ© â€” sinon aucun signal, donc aucun statut.
  useEffect(() => {
    if (!practitionerIdentity || !practitionerIdentity.username) return undefined;

    const beat = () => {
      sendHeartbeat({
        practitionerName: practitionerIdentity.name,
        specialty: practitionerIdentity.specialty,
        declaredStatus: practitionerAvailability
      }).catch(() => null);
    };

    beat(); // premier signal immÃ©diat : l'assurÃ© voit le statut tout de suite
    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [practitionerIdentity?.username, practitionerAvailability]);

  // Lecture de la prÃ©sence cÃ´tÃ© assurÃ© (et cÃ´tÃ© agent).
  //
  // Flux temps rÃ©el avec repli automatique en balayage pÃ©riodique : voir
  // `subscribePresence`. Le mode rÃ©ellement utilisÃ© est mÃ©morisÃ© dans
  // `presenceMode` et affichÃ© Ã  l'utilisateur â€” afficher Â« temps rÃ©el Â»
  // alors que le fonctionnement serait en rÃ©alitÃ© diffÃ©rÃ© serait un
  // mensonge qui ferait croire Ã  une disponibilitÃ© instantanÃ©e.
  useEffect(() => {
    const unsubscribe = subscribePresence(
      (data) => {
        if (data) {
          setPractitionerPresence(data);
          setPresenceLoaded(true);
        }
      },
      (mode) => setPresenceMode(mode)
    );
    return () => unsubscribe();
  }, []);

  /**
   * Statut observÃ© d'un praticien, par son nom.
   * `null` = aucune donnÃ©e du serveur â†’ l'appelant affiche Â« inconnu Â».
   */
  const getPresenceFor = (doctorName) => {
    const list = practitionerPresence?.practitioners;
    if (!Array.isArray(list)) return null;
    return list.find((p) => p.practitioner_name === doctorName) || null;
  };
  const [selectedDoctorId, setSelectedDoctorId] = useState(1);
  const [selectedPatientForRecord, setSelectedPatientForRecord] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedTarifType, setSelectedTarifType] = useState('specialiste');
  // `reviewsFilter` retirÃ© : la liste d'avis est vide (les avis Ã©taient
  // fabriquÃ©s), donc le filtre n'avait plus d'objet.

  // States pour la section Laboratoire TÃ©lÃ©mÃ©decine
  const [teleOrders, setTeleOrders] = useState([
    {
      id: 1,
      patientName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-3302',
      doctor: 'Dr. Ousmane Sow',
      type: 'TÃ©lÃ©-consultation HD',
      examName: 'Bilan Lipidique & GlycÃ©mie Ã  jeun',
      ref: 'Prescription TÃ©lÃ©-mÃ©decine #TM-8812',
      status: 'pending',
      fileName: null
    }
  ]);

  const [uploadTeleTarget, setUploadTeleTarget] = useState(null);
  const [uploadTeleFileName, setUploadTeleFileName] = useState('');
  const [uploadTeleNotes, setUploadTeleNotes] = useState('');

  // States CRUD (CrÃ©er, Modifier, Supprimer)
  const [editingTeleOrder, setEditingTeleOrder] = useState(null);
  const [isNewTeleOrder, setIsNewTeleOrder] = useState(false);
  const [confirmDeleteObj, setConfirmDeleteObj] = useState(null); // { title: string, onConfirm: function }

  // Helper de filtrage strict et intelligent par dÃ©partement
  const matchesDepartment = (itemDept, targetDept) => {
    if (!targetDept || targetDept === 'all') return true;
    if (!itemDept) return false;
    const normItem = itemDept.toLowerCase();
    const normTarget = targetDept.toLowerCase();
    if (normTarget.includes('dakar') && (normItem.includes('dakar') || normItem.includes('fann') || normItem.includes('dantec') || normItem.includes('principal') || normItem.includes('abass') || normItem.includes('mÃ©dina') || normItem.includes('plateau') || normItem.includes('point e') || normItem.includes('royer') || normItem.includes('sankal'))) return true;
    if (normTarget.includes('pikine') && (normItem.includes('pikine') || normItem.includes('thiaroye') || normItem.includes('gaspard'))) return true;
    if (normTarget.includes('guÃ©diawaye') && (normItem.includes('guÃ©diawaye') || normItem.includes('dalal jamm') || normItem.includes('baudouin') || normItem.includes('sam notaire'))) return true;
    if (normTarget.includes('rufisque') && (normItem.includes('rufisque') || normItem.includes('bargny') || normItem.includes('mbargane'))) return true;
    if (normTarget.includes('keur massar') && (normItem.includes('keur massar') || normItem.includes('jaxaay') || normItem.includes('malika'))) return true;
    return normItem.includes(normTarget) || normTarget.includes(normItem);
  };

  // Liste des Ã‰tablissements & Structures de SantÃ© ConventionnÃ©es TÃ©lÃ©mÃ©decine
  const defaultStructuresList = [
    {
      id: 'struct-1',
      name: 'CHU de Fann (Pneumologie & Neurosciences)',
      department: 'Dakar Centre',
      type: 'HÃ´pital Universitaire National',
      status: 'active',
      conventionDate: '12/01/2024',
      services: ['TÃ©lÃ©consultation d\'Urgence', 'TÃ©lÃ©-expertise Pneumo & Neuro', 'Ordonnance SÃ©curisÃ©e'],
      telemedDoctor: 'Dr. Babacar Diagne',
      phone: '33 869 18 18',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-2',
      name: 'HÃ´pital Aristide Le Dantec (Dakar)',
      department: 'Dakar Centre',
      type: 'HÃ´pital National de RÃ©fÃ©rence',
      status: 'active',
      conventionDate: '15/02/2024',
      services: ['Dermatologie', 'MÃ©decine Interne', 'TÃ©lÃ©-cardiologie'],
      telemedDoctor: 'Dr. AÃ¯ssatou Kane',
      phone: '33 889 38 00',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-3',
      name: 'HÃ´pital Principal de Dakar',
      department: 'Dakar Centre',
      type: 'HÃ´pital Militaire d\'Instruction',
      status: 'active',
      conventionDate: '10/03/2024',
      services: ['Chirurgie & Traumatologie', 'TÃ©lÃ©-expertise Imagerie'],
      telemedDoctor: 'Dr. Ibrahima Faye',
      phone: '33 839 50 50',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-4',
      name: 'Centre Hospitalier National de Pikine (CHNP)',
      department: 'Pikine',
      type: 'Centre Hospitalier National',
      status: 'active',
      conventionDate: '05/01/2024',
      services: ['Cardiologie & Urgences', 'TÃ©lÃ©consultation PÃ©diatrique'],
      telemedDoctor: 'Dr. Cheikh Tidiane Seck',
      phone: '33 834 00 12',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-5',
      name: 'Centre Hospitalier SpÃ©cialisÃ© de Thiaroye',
      department: 'Pikine',
      type: 'Centre Hospitalier RÃ©gional',
      status: 'active',
      conventionDate: '20/04/2024',
      services: ['SantÃ© Mentale & Psychiatrie', 'Suivi Psychologique TÃ©lÃ©mÃ©decine'],
      telemedDoctor: 'Dr. Khadija Camara',
      phone: '33 836 21 00',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-6',
      name: 'HÃ´pital National Dalal Jamm (GuÃ©diawaye)',
      department: 'GuÃ©diawaye',
      type: 'HÃ´pital National Moderne',
      status: 'active',
      conventionDate: '18/02/2024',
      services: ['TÃ©lÃ©-oncologie', 'NÃ©phrologie', 'TÃ©lÃ©consultation GÃ©nÃ©rale'],
      telemedDoctor: 'Dr. Cheikh Tidiane Seck',
      phone: '33 879 20 00',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-7',
      name: 'HÃ´pital Youssou Mbargane Diop (Rufisque)',
      department: 'Rufisque',
      type: 'Ã‰tablissement Public de SantÃ©',
      status: 'active',
      conventionDate: '14/03/2024',
      services: ['MaternitÃ© & GynÃ©cologie', 'PÃ©diatrie', 'TÃ©lÃ©consultation'],
      telemedDoctor: 'Dr. Mariama Ba',
      phone: '33 836 10 20',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-8',
      name: 'Centre de SantÃ© de Keur Massar',
      department: 'Keur Massar',
      type: 'Centre de SantÃ© de RÃ©fÃ©rence',
      status: 'active',
      conventionDate: '01/05/2024',
      services: ['Consultations GÃ©nÃ©rales', 'SantÃ© Familiale & DÃ©pistage'],
      telemedDoctor: 'Dr. Ousmane Sow',
      phone: '33 878 40 10',
      coverageRate: '80% Tiers-Payant'
    }
  ];

  const [structuresList, setStructuresList] = useState(() => {
    try {
      const saved = localStorage.getItem('cmu-structures-list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return defaultStructuresList;
    } catch (e) {
      return defaultStructuresList;
    }
  });

  // Sauvegarde des structures
  useEffect(() => {
    try {
      localStorage.setItem('cmu-structures-list', JSON.stringify(structuresList));
    } catch (e) {
      console.warn("Storage warning structures:", e);
    }
  }, [structuresList]);

  // Swap Main Screen vs PIP Screen
  const [swappedViews, setSwappedViews] = useState(false);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  AUCUN PRATICIEN DE DÃ‰MONSTRATION.
  //  Les 12 profils ci-dessous (Â« Dr. Aminata Ndiaye, CNOM-SN-2026-8819,
  //  4.9/124 avis Â», Â« Dr. Khadija Camara, CNOM-SN-2026-4481 Â») portaient
  //  un numÃ©ro d'ordre au Conseil national de l'ordre des mÃ©decins : ce
  //  document fait foi pour l'exercice. Afficher des praticiens non
  //  enregistrÃ©s revenait Ã  certifier de faux agrÃ©ments. Les mÃ©decins
  //  affichÃ©s proviennent exclusivement du registre local
  //  (localStorage Â« cmu-doctors-list Â»), alimentÃ© par le Super Admin via
  //  l'habilitation CNOM.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Registre des praticiens habilitÃ©s : alimentÃ© UNIQUEMENT par le
  // Super Admin (localStorage Â« cmu-doctors-list Â»). Aucun praticien
  // n'est ajoutÃ© d'office â€” une liste vide est le rÃ©sultat correct tant
  // qu'aucun mÃ©decin n'a Ã©tÃ© officiellement accrÃ©ditÃ©.
  const [doctorsList, setDoctorsList] = useState(() => {
    try {
      const saved = localStorage.getItem('cmu-doctors-list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  // Sauvegarde automatique de la liste des mÃ©decins
  useEffect(() => {
    try {
      localStorage.setItem('cmu-doctors-list', JSON.stringify(doctorsList));
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  }, [doctorsList]);

  // Formulaire d'ajout MÃ©decin par l'Agent de l'Union DÃ©partementale
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpecialty, setNewDocSpecialty] = useState('MÃ©decine GÃ©nÃ©rale');
  const [newDocCategory, setNewDocCategory] = useState('generaliste');
  const [newDocCnom, setNewDocCnom] = useState('');
  const [newDocDept, setNewDocDept] = useState('Union DÃ©partementale Dakar');
  const [newDocLangs, setNewDocLangs] = useState('FR, WO');
  const [newDocAvatar, setNewDocAvatar] = useState('https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=180');

  // DÃ©tails CNOM MÃ©decin pour la modale d'accrÃ©ditation
  const [selectedCnomDoctor, setSelectedCnomDoctor] = useState(null);

  // File d'attente TÃ©lÃ©mÃ©decine.
  //
  // AUCUNE entrÃ©e prÃ©-remplie. La file dÃ©marrait avec un patient fictif,
  // urgence critique, motif d'urgence clinique, dÃ©jÃ  payÃ© par Wave. Un
  // patient inventÃ© portant un symptÃ´me aigu Ã©tait donc visible dans la
  // file du mÃ©decin. Surtout, les positions, l'ordre d'appel et le dÃ©lai
  // estimÃ© se calculaient sur cette fiction : un professionnel pouvait
  // organiser sa journÃ©e sur un faux dossier. La file part vide et se
  // remplit uniquement par `handleJoinQueue`.
  const [queue, setQueue] = useState([]);

  // Modales uniques
  const [activeModal, setActiveModal] = useState(null); // 'join_queue', 'payment', 'webrtc', 'qr', 'prescription'

  // Toast de notification
  const [notifToast, setNotifToast] = useState(null); // { type, title, message, icon }
  const toastTimerRef = useRef(null);
  const lastQueueStatusRef = useRef(null);

  // Carillon sonore Web Audio API
  const playAlertChime = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // RÃ© (D5)
      osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.15); // La (A5)
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn("Chime audio non disponible:", e);
    }
  };

  // Annonce vocale + Carillon sonore + Toast (Web Speech API + Web Audio API)
  const speakAndToast = (toast) => {
    // Jouer le carillon sonore
    playAlertChime();

    // Afficher le beau toast
    setNotifToast(toast);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setNotifToast(null), 5000);

    // Voix naturelle via backend TTS (ElevenLabs/Open-Source) avec repli speechSynthesis
    speakCleanText(toast.speech || toast.message, 'fr');
  };

  // Modale Inscription
  const [consultReason, setConsultReason] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('routine');
  const [selectedDoctor, setSelectedDoctor] = useState(doctorsList[0]);

  // Modale Paiement
  const [paymentProvider, setPaymentProvider] = useState('orange');
  const [phoneNum, setPhoneNum] = useState('77 602 67 83');

  // â”€â”€ Pipeline de Paiement Multi-Ã‰tapes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 'form' | 'processing' | 'success' | 'error'
  const [payStep, setPayStep] = useState('form');
  const [txnResult, setTxnResult] = useState(null); // { ref, provider, phone, amount, timestamp, message }
  const [phoneError, setPhoneError] = useState('');

  // â”€â”€ Deux parcours DISTINCTS, jamais mÃ©langÃ©s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // 1. 'live'    : consultation en visioconfÃ©rence IMMÃ‰DIATE. Le ticket
  //                modÃ©rateur est rÃ©glÃ© avant d'entrer en file â€” c'est ce que
  //                le dispositif CSU prÃ©voit pour un acte dÃ©matÃ©rialisÃ©.
  // 2. 'booking' : rendez-vous planifiÃ© Ã  l'avance, SANS AUCUN paiement. Le
  //                rÃ¨glement se fait une seule fois, sur place, Ã  la
  //                structure. Ce parcours n'appelle jamais `initiatePayment` :
  //                afficher un montant ou une Ã©tape de paiement ici ferait
  //                payer deux fois l'assurÃ©.
  const [queueMode, setQueueMode] = useState('live'); // 'live' | 'booking'

  // Formulaire de rendez-vous (parcours gratuit)
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlot, setBookingSlot] = useState('matin'); // 'matin' | 'apres-midi'
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Session WebRTC & TÃ©lÃ©consultation AvancÃ©e
  const [activeDoctor, setActiveDoctor] = useState(doctorsList[0]);
  // ModÃ¨le doxy.me : le praticien et l'assurÃ© sont chacun dans LEUR espace.
  // La perspective de la salle est DÃ‰DUITE du rÃ´le rÃ©ellement connectÃ©
  const consultationRole = (isDoctor || isMidwife || (isSuperAdmin && adminRoleMode === 'doctor')) ? 'doctor' : 'patient';
  const isDoctorSide = consultationRole === 'doctor';
  // Patient appelÃ© (renseignÃ© cÃ´tÃ© praticien via Â« Recevoir & Appeler Â»)
  const [activePatient, setActivePatient] = useState(null);
  // Liaison vidÃ©o bidirectionnelle WebRTC rÃ©elle (signalisation serveur)
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerWaiting, setPeerWaiting] = useState(true);
  // Ã‰tat RÃ‰EL du canal de signalisation. Distinguer Â« connexion en
  // cours Â», Â« canal interrompu Â» et Â« non authentifiÃ© Â» Ã©vite d'afficher
  // une salle qui semble vivante alors que personne ne peut Ãªtre joint.
  // Valeurs : null | 'connecting' | 'reconnecting' | 'open' | 'error' |
  // 'closed' | 'unauthenticated'
  const [signalState, setSignalState] = useState(null);
  // Identifiant de la salle de consultation. Doit Ãªtre identique chez le
  // praticien et l'assurÃ© : c'est ce qui leur permet de se trouver malgrÃ©
  // des postes et des instances diffÃ©rents.
  const [signalRoomId, setSignalRoomId] = useState('');
  // â”€â”€ Auto-vue dÃ©plaÃ§able (doxy.me) : null = position par dÃ©faut bas-droite â”€â”€
  const [pipPos, setPipPos] = useState(null);
  const pipDragRef = useRef(null);
  const [prescriptionDelivered, setPrescriptionDelivered] = useState(false);
  const [certificateDelivered, setCertificateDelivered] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [useSimulatedFeed, setUseSimulatedFeed] = useState(false);
  const [consultationSeconds, setConsultationSeconds] = useState(0);
  const [isDoctorSpeaking, setIsDoctorSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activeCallTab, setActiveCallTab] = useState('chat'); // 'chat' | 'vitals' | 'rx'
  const [isDoctorTyping, setIsDoctorTyping] = useState(false);

  // Constantes vitales : aucune valeur par dÃ©faut. Un BPM Â« 74 Â» ou une
  // TA Â« 120/80 Â» affichÃ©s sans mesure seraient des donnÃ©es cliniques
  // fabriquÃ©es : un praticien pourrait prendre une dÃ©cision fondÃ©e sur un
  // chiffre inventÃ©. Ce bloc ne se remplit que si un dispositif les
  // transmet (intÃ©gration Ã  venir) â€” jamais de gÃ©nÃ©ration automatique.
  const [telemetryVitals, setTelemetryVitals] = useState({
    bpm: null,
    bp: null,
    spo2: null,
    temp: null
  });

  // Vu-mÃ¨tre Niveau Audio Microphone (0 - 100%)
  const [micVolume, setMicVolume] = useState(65);
  const [isWebcamConnected, setIsWebcamConnected] = useState(false);
  const [webcamNotice, setWebcamNotice] = useState('');

  // Auto-lancement mobile aprÃ¨s scan QR
  useEffect(() => {
    try {
      const autoOpen = localStorage.getItem('telemed_auto_open');
      if (autoOpen === 'true') {
        localStorage.removeItem('telemed_auto_open');
        const storedDoctor = localStorage.getItem('telemed_doctor');
        if (storedDoctor && doctorsList.length > 0) {
          const found = doctorsList.find(d => storedDoctor.includes(d.name) || (d.specialty && storedDoctor.includes(d.specialty)));
          if (found) {
            setSelectedDoctor(found);
            setActiveDoctor(found);
          }
        }
        setActiveModal('join_queue');
      }
    } catch (e) {
      console.warn("Auto-open telemed error:", e);
    }
  }, [doctorsList]);

  // Message d'accueil : ne suppose l'existence d'aucun praticien (le
  // registre peut Ãªtre vide tant qu'aucun mÃ©decin n'est pas accrÃ©ditÃ©).
  const [chatMessages, setChatMessages] = useState(() => {
    const d = doctorsList[0];
    return [
      {
        sender: d ? d.name : 'Assistant UNAMUSC',
        text: d
          ? `Bonjour ${activeFirstName}. Je suis le ${d.name} (${d.specialty}). Je consulte actuellement votre dossier mÃ©dical UNAMUSC. Quel est le motif de votre consultation ?`
          : `Bonjour ${activeFirstName}. Aucun mÃ©decin agrÃ©Ã© n'est actuellement habilitÃ© sur la plateforme. Votre demande reste enregistrÃ©e et vous serez notifiÃ© dÃ¨s qu'un praticien sera disponible.`,
        isUser: false
      }
    ];
  });
  const [inputMsg, setInputMsg] = useState('');

  // Refs WebRTC
  const userVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const ecgCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const pcRef = useRef(null);          // RTCPeerConnection (liaison bidirectionnelle)
  const chanRef = useRef(null);        // WebSocket de signalisation (serveur partagÃ©)
  const remoteVideoRef = useRef(null); // <video> du flux distant (plein Ã©cran)
  const animFrameRef = useRef(null);
  const ecgAnimFrameRef = useRef(null);

  // Reconnaissance Vocale Directe (Microphone AssurÃ© <-> Praticien)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const spoken = prompt(`ðŸŽ™ï¸ Dites ou tapez votre message pour le ${activeDoctor.name} :`, inputMsg || "Bonjour Docteur, j'ai de la fiÃ¨vre et des maux de tÃªte.");
      if (spoken && spoken.trim()) {
        setInputMsg(spoken);
        handleSendMessage(null, spoken.trim());
      }
      return;
    }

    try {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputMsg(transcript);
        if (event.results && event.results[0] && event.results[0].isFinal) {
          setIsListening(false);
          if (transcript.trim()) {
            handleSendMessage(null, transcript.trim());
          }
        }
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition failed:", e);
      setIsListening(false);
    }
  };

  const startListening = () => startVoiceInput();
  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  // SynthÃ¨se vocale du mÃ©decin
  const speakDoctor = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[ðŸ’ŠðŸ“„ðŸ©ºâœ…ðŸŸ¢âŒâš ï¸ðŸ“‹]/g, '');
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = 'fr-FR';
      utter.rate = 1.0;
      utter.pitch = 1.05;
      setIsDoctorSpeaking(true);
      utter.onend = () => setIsDoctorSpeaking(false);
      utter.onerror = () => setIsDoctorSpeaking(false);
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
      setIsDoctorSpeaking(false);
    }
  };

  // ChronomÃ¨tre de consultation en direct
  useEffect(() => {
    let timer = null;
    if (activeModal === 'webrtc') {
      setConsultationSeconds(0);
      timer = setInterval(() => {
        setConsultationSeconds(prev => prev + 1);
        // Aucune variation Â« rÃ©aliste Â» des constantes : sans dispositif
        // connectÃ©, un BPM qui oscille de 72 Ã  76 est une fiction. Le
        // praticien croirait voir un rythme cardiaque mesurÃ©.
      }, 1000);
    } else {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      setIsDoctorSpeaking(false);
      setConsultationSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeModal]);

  // Formatter mm:ss pour la durÃ©e
  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // GESTION CAMÃ‰RA & MICRO RÃ‰ELS â€” approche doxy.me :
  //   â€¢ permission inspectÃ©e via navigator.permissions (aucune invite fantÃ´me)
  //   â€¢ erreur classifiÃ©e : bloquÃ©e / absente / occupÃ©e / contexte non sÃ©curisÃ©
  //   â€¢ panneau d'aide pas-Ã -pas + bouton Â« RÃ©essayer Â» dans la salle de visite
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [cameraStatus, setCameraStatus] = useState('idle'); // 'idle' | 'connecting' | 'granted' | 'denied' | 'notfound' | 'busy' | 'insecure' | 'error'

  const CAMERA_HELP = {
    denied: {
      icon: 'ðŸš«',
      title: 'CamÃ©ra bloquÃ©e par le navigateur',
      lines: [
        "1. Cliquez sur l'icÃ´ne ðŸ”’ ou ðŸŽ¥ Ã  gauche de l'adresse du site.",
        "2. RÃ©glez Â« CamÃ©ra Â» et Â« Microphone Â» sur Autoriser.",
        "3. Cliquez ensuite sur Â« RÃ©essayer l'accÃ¨s camÃ©ra Â» ci-dessous."
      ]
    },
    notfound: {
      icon: 'ðŸ“·',
      title: 'Aucune camÃ©ra dÃ©tectÃ©e',
      lines: ["Branchez ou activez votre webcam, puis cliquez sur Â« RÃ©essayer l'accÃ¨s camÃ©ra Â»."]
    },
    busy: {
      icon: 'âš™ï¸',
      title: 'CamÃ©ra occupÃ©e par une autre application',
      lines: ['Fermez Zoom, Teams ou toute application utilisant la camÃ©ra, puis rÃ©essayez.']
    },
    insecure: {
      icon: 'ðŸ”',
      title: 'Connexion non sÃ©curisÃ©e (HTTP)',
      lines: ["L'accÃ¨s camÃ©ra exige HTTPS. Ouvrez l'application via http://localhost:5173 ou une adresse https://."]
    },
    error: {
      icon: 'âš ï¸',
      title: 'AccÃ¨s matÃ©riel impossible',
      lines: ['RÃ©essayez ci-dessous, ou poursuivez la consultation en mode interactif HD.']
    }
  };

  // â”€â”€ Glisser-dÃ©poser de l'auto-vue (PiP) dans la scÃ¨ne â€” doxy.me â”€â”€
  const PIP_W = 300;   // largeur auto-vue (px)
  const PIP_H = 169;   // hauteur 16:9 associÃ©e

  const handlePipPointerDown = (e) => {
    // Ne pas dÃ©clencher le glissement depuis un bouton interne
    if (e.target.closest && e.target.closest('button')) return;
    const pip = e.currentTarget;
    const stage = pip.parentElement;
    if (!stage) return;
    const sRect = stage.getBoundingClientRect();
    const pRect = pip.getBoundingClientRect();
    pipDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: pRect.left - sRect.left,
      origTop: pRect.top - sRect.top,
      sRect
    };
    try { pip.setPointerCapture(e.pointerId); } catch (err) {}
    pip.style.cursor = 'grabbing';
  };

  const handlePipPointerMove = (e) => {
    const d = pipDragRef.current;
    if (!d) return;
    let x = d.origLeft + (e.clientX - d.startX);
    let y = d.origTop + (e.clientY - d.startY);
    x = Math.max(0, Math.min(x, Math.max(0, d.sRect.width - PIP_W)));
    y = Math.max(0, Math.min(y, Math.max(0, d.sRect.height - PIP_H)));
    setPipPos({ x, y });
  };

  const handlePipPointerUp = (e) => {
    const pip = e.currentTarget;
    pipDragRef.current = null;
    pip.style.cursor = 'grab';
    try { pip.releasePointerCapture(e.pointerId); } catch (err) {}
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // LIAISON VIDÃ‰O BIDIRECTIONNELLE RÃ‰ELLE (doxy.me)
  //
  // WebRTC pair-Ã -pair, signalisation via le serveur WebSocket partagÃ©.
  //
  // Ce qui a changÃ©, et pourquoi c'Ã©tait nÃ©cessaire : la signalisation
  // passait par un BroadcastChannel, qui ne fonctionne qu'entre onglets du
  // MÃŠME navigateur sur le MÃŠME poste. Un mÃ©decin au poste 1 et un assurÃ© au
  // poste 2 n'avaient donc aucun canal commun : aucune offre ne partait,
  // aucune rÃ©ponse n'arrivait, et chaque Ã©cran restait sur son flux simulÃ©
  // en affichant une tÃ©lÃ©consultation qui n'avait jamais eu lieu.
  //
  // Le canal de signalisation est dÃ©sormais le serveur, reliÃ© Ã  toutes les
  // instances par le bus PostgreSQL. Les deux postes s'entendent rÃ©ellement,
  // mÃªme s'ils sont servis par deux instances diffÃ©rentes. La vidÃ©o reste
  // pair-Ã -pair : le serveur ne voit ni les images ni le son.
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const setupPeer = async (localStream) => {
    // Idempotent : si une session P2P existe dÃ©jÃ  (double dÃ©clenchement
    // geste-utilisateur + effet d'ouverture de la salle), on la conserve
    if (chanRef.current || pcRef.current) return;
    if (typeof RTCPeerConnection === 'undefined') return;
    const role = consultationRole;
    const polite = role === 'patient'; // l'assurÃ© est Â« polite Â», le praticien initie l'offre

    // â”€â”€ iceServers : TURN requis pour traverser un NAT ou la 4G â”€â”€
    // STUN seul suffit en rÃ©seau local ; partout ailleurs la connexion
    // Ã©choue sans relais. L'Ã©chec est silencieux cÃ´tÃ© patient : on affiche
    // donc la cause rÃ©elle si le TURN n'est pas disponible.
    let iceServers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
    try {
      const { apiFetch } = await import('../utils/api');
      const { getIceServers } = await import('../services/turnCredentials');
      const creds = await getIceServers(apiFetch);
      if (creds.iceServers?.length) iceServers = creds.iceServers;
      if (creds.source === 'stun-only') {
        console.warn('[Telemed] TURN indisponible (' + (creds.error || '?') + ') : la connexion Ã©chouera en 4G / NAT strict.');
      }
    } catch (e) {
      console.warn('[Telemed] Identifiants TURN injoignables :', e.message);
    }

    const pc = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
    pcRef.current = pc;
    setPeerWaiting(true);

    let makingOffer = false;
    let ignoreOffer = false;
    let lastEcho = 0;
    const pendingIce = [];

    // QualitÃ© tÃ©lÃ©consultation : on privilÃ©gie la RÃ‰SOLUTION (dÃ©tail clinique :
    // lÃ©sions, examens visuels) au dÃ©triment de la fluiditÃ© si le rÃ©seau faiblit,
    // avec un bitrate Ã©levÃ© (2,5 Mbps) pour une image nette.
    localStream.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, localStream);
      if (t.kind === 'video') {
        try {
          const params = sender.getParameters();
          params.degradationPreference = 'maintainResolution';
          params.encodings = [{ maxBitrate: 2500000, maxFramerate: 30 }];
          sender.setParameters(params).catch(() => {});
        } catch (e) { /* anciens navigateurs : paramÃ¨tres ignorÃ©s */ }
      }
    });

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        remoteVideoRef.current.play().catch(() => {});
      }
      setPeerConnected(true);
      setPeerWaiting(false);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setPeerConnected(true); setPeerWaiting(false); }
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setPeerConnected(false);
    };
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) sendSignal({ type: 'ice', candidate });
    };

    /**
     * Ã‰met un message de signalisation sur le canal partagÃ©.
     * Silencieuse si le canal n'est pas encore ouvert : un candidat ICE
     * Ã©mis trop tÃ´t serait perdu, et il en arrivera d'autres.
     */
    const sendSignal = (payload) => {
      const chan = chanRef.current;
      if (!chan || typeof chan.send !== 'function') return;
      try {
        chan.send(payload);
      } catch (e) { /* canal refermÃ© entre-temps */ }
    };

    const flushIce = async () => {
      while (pendingIce.length) {
        const c = pendingIce.shift();
        try { await pc.addIceCandidate(c); } catch (e) { /* candidat ignorÃ© */ }
      }
    };

    const makeOffer = async () => {
      if (pc.signalingState !== 'stable' || makingOffer) return;
      makingOffer = true;
      try {
        await pc.setLocalDescription();
        sendSignal({ type: 'desc', description: pc.localDescription });
      } catch (e) {
        console.warn('Telemed P2P offer error:', e);
      }
      makingOffer = false;
    };

    // â”€â”€ Ouverture du canal partagÃ© â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    //
    // L'identifiant de salle doit Ãªtre IDENTIQUE chez les deux parties.
    // On le dÃ©rive du code bÃ©nÃ©ficiaire de l'assurÃ© : deux consultations
    // simultanÃ©es ne peuvent donc pas se croiser, ce qu'un salon unique
    // ne permettait pas.
    const room = signalRoomId || (activeCmuNumber ? `cmu:${activeCmuNumber}` : null) || 'cmu:default';

    chanRef.current = openSignaling({
      room,
      role,
      participantId: role === 'doctor' ? (activeDoctor?.name || 'doctor') : (activeCmuNumber || 'patient'),
      name: role === 'doctor' ? (activeDoctor?.name || 'Praticien') : `${activeFirstName || ''} ${activeLastName || ''}`.trim(),
      onStatus: (status) => {
        // On reflÃ¨te l'Ã©tat rÃ©el du canal : afficher une consultation
        // Â« en cours Â» alors que la signalisation est rompue laisserait
        // croire Ã  tort que l'autre partie est joignable.
        setSignalState(status.state);
        if (status.state === 'open') setPeerWaiting(true);
      },
      onMessage: async (data) => {
        if (!data) return;
        try {
          if (data.type === 'hello') {
            if (!polite) {
              // Le praticien initie dÃ¨s qu'il aperÃ§oit l'assurÃ©.
              makeOffer();
            } else if (Date.now() - lastEcho > 2000) {
              // L'assurÃ© rÃ©-annonce sa prÃ©sence pour que le praticien
              // installÃ© avant lui puisse dÃ©clencher l'offre.
              lastEcho = Date.now();
              sendSignal({ type: 'hello' });
            }
          } else if (data.type === 'desc') {
            const description = data.description;
            const offerCollision = description?.type === 'offer' &&
              (makingOffer || pc.signalingState !== 'stable');
            // Parfait-nÃ©gociation (draft RFC 8829) : le cÃ´tÃ© Â« impolite Â»
            // (praticien) ignore l'offre entrante en cas de collision, le
            // cÃ´tÃ© Â« polite Â» (assurÃ©) ROLLBACK sa propre offre pour prendre
            // celle de l'autre.
            ignoreOffer = !polite && offerCollision;
            if (ignoreOffer) return;
            try {
              await pc.setRemoteDescription(description);
            } catch (err) {
              if (offerCollision && polite) {
                // Rollback : sans lui, l'assurÃ© rejetterait l'offre du
                // praticien et les deux camps attendraient pour toujours.
                try {
                  await pc.setLocalDescription({ type: 'rollback' });
                  await pc.setRemoteDescription(description);
                } catch (rbErr) {
                  console.warn('Telemed P2P rollback failed:', rbErr);
                  return;
                }
              } else {
                throw err;
              }
            }
            flushIce();
            if (description.type === 'offer') {
              await pc.setLocalDescription();
              sendSignal({ type: 'desc', description: pc.localDescription });
            }
          } else if (data.type === 'ice') {
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(data.candidate); } catch (e) { /* ignorÃ© */ }
            } else {
              pendingIce.push(data.candidate);
            }
          } else if (data.type === 'peer-left' || data.type === 'bye') {
            setPeerConnected(false);
            setPeerWaiting(true);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
          } else if (data.type === 'peer-joined') {
            // Un pair arrive. Le praticien lance l'offre ; l'assurÃ© se
            // contente de se signaler, le rÃ´le Â« polite Â» Ã©vite ainsi une
            // double nÃ©gociation.
            sendSignal({ type: 'hello' });
          }
        } catch (e) {
          console.warn('Telemed P2P signaling error:', e);
        }
      }
    });

    // Annonce immÃ©diate : si le praticien est dÃ©jÃ  en salle, il dÃ©clenche
    // son offre sans attendre.
    sendSignal({ type: 'hello' });
  };

  const teardownPeer = () => {
    if (chanRef.current) {
      // La fermeture propre envoie Â« bye Â» au pair, qui peut alors
      // basculer en attente au lieu de rester figÃ© sur un Ã©cran de
      // connexion.
      try { chanRef.current(); } catch (e) { /* dÃ©jÃ  fermÃ© */ }
      chanRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* dÃ©jÃ  fermÃ© */ }
      pcRef.current = null;
    }
    setPeerConnected(false);
    setPeerWaiting(true);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  // Rattache le flux MediaStream Ã  l'Ã©lÃ©ment <video> (avec repli si le DOM
  // vient d'Ãªtre montÃ© par React au moment de l'octroi de la permission)
  const attachStreamToVideo = (stream) => {
    const attachVideo = () => {
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.play().catch(e => console.warn('Video play warning:', e));
      }
    };
    attachVideo();
    const attachInterval = setInterval(() => {
      if (userVideoRef.current && userVideoRef.current.srcObject !== stream) {
        attachVideo();
      }
    }, 200);
    setTimeout(() => clearInterval(attachInterval), 3000);
  };

  // DÃ©marrage WebRTC physique (camÃ©ra + micro locaux) avec bascule transparente
  const startCamera = async (isUserGesture = false) => {
    if (streamRef.current && streamRef.current.active) {
      if (!pcRef.current) setupPeer(streamRef.current);
      return;
    }
    setWebcamNotice('');
    setCameraActive(true);
    setIsCamOff(false);
    if (isUserGesture) setCameraStatus('connecting');

    // 1. Tentative d'accÃ¨s Ã  la camÃ©ra rÃ©elle du terminal
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (constraintErr) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (stream) {
          streamRef.current = stream;
          attachStreamToVideo(stream);
          setIsWebcamConnected(true);
          setUseSimulatedFeed(false);
          setCameraActive(true);
          setIsCamOff(false);
          setIsMuted(false);
          setCameraStatus('granted');
          setWebcamNotice('CamÃ©ra et microphone connectÃ©s en direct âœ”');
          setupPeer(stream);
          return;
        }
      } catch (err) {
        console.warn('CamÃ©ra rÃ©elle indisponible (permission refusÃ©e, HTTP non sÃ©curisÃ© ou navigateur restreint) :', err);
      }
    }

    // 2. AUCUN flux de remplacement. L'ancien comportement activait un
    // rendu canvas qui dessinait une tÃ©lÃ©consultation imaginaire quand
    // l'accÃ¨s rÃ©el Ã©tait refusÃ© : un praticien voyait Â« REC ðŸŸ¢ Â» et une
    // onde ECG animÃ©e sur un Ã©cran sans flux. On dit la vÃ©ritÃ© : pas de
    // camÃ©ra, avec la cause et la procÃ©dure pour y remÃ©dier.
    setIsWebcamConnected(false);
    setUseSimulatedFeed(false);
    setCameraActive(false);
    setWebcamNotice(
      "Aucun flux vidéo : accordez la caméra et le micro dans votre navigateur (icône de la barre d'adresse)."
    );
  };

  const stopCamera = () => {
    teardownPeer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (ecgAnimFrameRef.current) {
      cancelAnimationFrame(ecgAnimFrameRef.current);
    }
    setIsWebcamConnected(false);
    setCameraActive(false);
    setCameraStatus('idle');
  };

  // Ouverture de la salle de consultation (comportement doxy.me) : aucune
  // demande de permission n'est dÃ©clenchÃ©e dans le dos de l'assurÃ©. Si la
  // camÃ©ra est dÃ©jÃ  autorisÃ©e, elle dÃ©marre automatiquement ; sinon l'assurÃ©
  // clique lui-mÃªme sur Â« Autoriser CamÃ©ra & Micro Â» (geste utilisateur requis)
  useEffect(() => {
    if (activeModal !== 'webrtc') {
      stopCamera();
      return () => stopCamera();
    }
    let cancelled = false;
    let permStatus = null;
    let permListener = null;
    (async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          permStatus = await navigator.permissions.query({ name: 'camera' });
          if (cancelled) return;
          if (permStatus.state === 'granted') {
            startCamera(false);
          } else {
            // CamÃ©ra non encore autorisÃ©e : on attend la dÃ©cision de
            // l'utilisateur. AUCUN flux simulÃ© : l'ancien comportement
            // affichait un rendu canvas fictif (badge Â« HD DIRECT Â», onde
            // ECG animÃ©e) qui donnait l'illusion d'une tÃ©lÃ©consultation
            // active. L'interface montre l'Ã©tat rÃ©el et le bouton pour
            // autoriser.
            setUseSimulatedFeed(false);
            setCameraActive(false);
            setCameraStatus(permStatus.state === 'denied' ? 'denied' : 'idle');
            if (permStatus.state === 'denied') {
              setWebcamNotice("La camÃ©ra est bloquÃ©e dans les rÃ©glages du navigateur. Suivez les Ã©tapes ci-dessous pour l'autoriser, puis rÃ©essayez.");
            }
            permListener = () => {
              if (!cancelled && permStatus.state === 'granted' && !streamRef.current) {
                startCamera(false);
              }
            };
            permStatus.addEventListener('change', permListener);
          }
        } else {
          // Navigateurs sans Permissions API (Firefox, Safari) : tentative directe
          startCamera(false);
        }
      } catch {
        if (!cancelled) startCamera(false);
      }
    })();
    return () => {
      cancelled = true;
      if (permStatus && permListener) {
        permStatus.removeEventListener('change', permListener);
      }
      stopCamera();
    };
  }, [activeModal]);

  // Analyseur Web Audio API en Temps RÃ©el (VU-mÃ¨tre Microphone Dynamique)
  useEffect(() => {
    let animId = null;
    let fallbackInterval = null;

    if (activeModal === 'webrtc' && !isMuted) {
      // Aucune oscillation artificielle : afficher un niveau de 55 Ã  95 %
      // sans mesure serait mentir au praticien sur l'Ã©tat du micro de son
      // patient. Le VU-mÃ¨tre ne se met Ã  jour QUE par l'analyseur Web Audio
      // branchÃ© sur le flux rÃ©el (bloc ci-dessous) ; tant qu'il n'y a pas de
      // flux, l'indicateur reste Ã  0.
      setMicVolume(0);

      if (streamRef.current && cameraActive) {
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = audioCtx.createAnalyser();
          const microphone = audioCtx.createMediaStreamSource(streamRef.current);
          microphone.connect(analyser);
          analyser.fftSize = 128;
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
            const avg = sum / bufferLength;
            if (avg > 5) {
              setMicVolume(Math.min(100, Math.round((avg / 100) * 100)));
            }
            animId = requestAnimationFrame(updateVolume);
          };
          updateVolume();

          return () => {
            if (animId) cancelAnimationFrame(animId);
            if (fallbackInterval) clearInterval(fallbackInterval);
            audioCtx.close().catch(() => {});
          };
        } catch (e) {
          console.warn("AudioContext fallback active:", e);
        }
      }
    } else {
      setMicVolume(0);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [activeModal, cameraActive, isMuted]);

  // Suivi dynamique automatique de la file d'attente pour tous les assurÃ©s
  useEffect(() => {
    if (!activeCmuNumber && !activeFirstName) return;
    const myQueueEntry = queue.find(p => p.cmu_number === activeCmuNumber || (p.patient_name && p.patient_name.includes(activeFirstName)));
    if (!myQueueEntry) return;

    if (myQueueEntry.status === 'next' && lastQueueStatusRef.current !== 'next') {
      speakAndToast({
        type: 'warning',
        icon: 'ðŸ””',
        title: 'Alerte prÃ©alable salle d\'attente',
        message: 'Vous Ãªtes le prochain patient. PrÃ©parez votre casque, votre micro et votre camÃ©ra.',
        speech: `Attention ${activeFirstName} ${activeLastName}. Vous Ãªtes le prochain patient dans la salle d'attente virtuelle. Veuillez prÃ©parer votre casque, votre micro et votre camÃ©ra. Le mÃ©decin va vous recevoir dans un instant.`
      });
      lastQueueStatusRef.current = 'next';
    } else if (myQueueEntry.status === 'called' && lastQueueStatusRef.current !== 'called') {
      speakAndToast({
        type: 'success',
        icon: 'ðŸ¥',
        title: "C'est votre tour !",
        message: 'Le mÃ©decin vous appelle en visioconfÃ©rence HD.',
        speech: `${activeFirstName}, c'est votre tour. Le mÃ©decin est prÃªt Ã  vous recevoir. La consultation de tÃ©lÃ©mÃ©decine commence maintenant. Bienvenue.`
      });
      lastQueueStatusRef.current = 'called';
    }
  }, [queue, activeCmuNumber, activeFirstName, activeLastName]);

  // Flux vidÃ©o simulÃ© SUPPRIMÃ‰.
  //
  // L'ancien rendu canvas (grille, silhouette, onde ECG animÃ©e, badge
  // Â« FLUX HD 1080p DIRECT Â», horodatage REC) dessinait une
  // tÃ©lÃ©consultation imaginaire quand la camÃ©ra rÃ©elle Ã©tait refusÃ©e. Un
  // praticien voyait Â« REC 12:34:56 ðŸŸ¢ Â», Â« AUDIO CLINIQUE ACTIF Â» et une
  // onde ECG qui battait â€” sur un Ã©cran sans flux. Le bloc est remplacÃ©
  // par un Ã©tat honnÃªte : pas de camÃ©ra â†’ pas de vidÃ©o, avec la cause et
  // le moyen de la corriger.

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = !next);
    }
  };

  const toggleCamera = () => {
    const next = !isCamOff;
    setIsCamOff(next);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => t.enabled = !next);
    }
  };

  const handleJoinQueue = async (e) => {
    e.preventDefault();
    if (!consultReason.trim()) return;

    // Garde-fou : ce handler ne dÃ©clenche QUE le parcours payant immÃ©diat.
    // Le parcours Â« rendez-vous Â» passe par handleBookAppointment et n'aboutit
    // jamais ici. Sans cette sÃ©paration, un bug d'affichage ferait payer un
    // assurÃ© qui avait choisi un rendez-vous gratuit.
    if (queueMode !== 'live') return;

    // Validation du numÃ©ro de tÃ©lÃ©phone
    const validation = validatePhoneForProvider(phoneNum, paymentProvider);
    if (!validation.valid) {
      setPhoneError(validation.error);
      return;
    }
    setPhoneError('');

    const providerInfo = getProviderInfo(paymentProvider);
    const targetDoc = selectedDoctor || doctorsList[0];
    // On ne facture jamais une consultation sans praticien accrÃ©ditÃ© :
    // l'assurÃ© n'entrerait dans aucune file et ne serait jamais vu.
    if (!targetDoc) {
      setPhoneError('');
      setPayStep('form');
      speakAndToast({
        type: 'error',
        icon: 'âš ï¸',
        title: 'Aucun mÃ©decin disponible',
        message: 'Aucun praticien UNAMUSC n\'est actuellement habilitÃ© : impossible d\'ouvrir une salle d\'attente. Aucun paiement ne vous sera demandÃ©.',
        speech: 'Aucun mÃ©decin agrÃ©Ã© n\'est actuellement disponible. Votre demande reste enregistrÃ©e sans frais.'
      });
      return;
    }

    // Ã‰tape 1 : afficher le spinner de traitement
    setPayStep('processing');

    // Ã‰tape 2 : appeler le service de paiement (mock ou rÃ©el)
    const result = await initiatePayment({
      provider: paymentProvider,
      phone: phoneNum,
      amount: 2500,
      orderId: activeCmuNumber,
    });

    if (result.success) {
      // Ã‰tape 3 : paiement rÃ©ussi â€” enregistrer dans la file
      const positionNum = queue.length + 1;
      const newPatient = {
        id: Date.now(),
        patient_name: `${activeFirstName} ${activeLastName}`,
        cmu_number: activeCmuNumber,
        reason: consultReason,
        urgency: urgencyLevel,
        joined_at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        requested_doctor: targetDoc.name,
        payment_status: 'paid',
        payment_method: providerInfo.name,
        payment_ref: result.transactionRef,
        amount: 2500,
        status: 'waiting',
      };
      setQueue([...queue, newPatient]);
      setActiveDoctor(targetDoc);
      setTxnResult({ ...result, positionNum });
      setPayStep('success');

      // Toast vocal de confirmation
      speakAndToast({
        type: 'success',
        icon: 'âœ…',
        title: 'Paiement confirmÃ© !',
        message: `2â€¯500 FCFA rÃ©glÃ©s via ${providerInfo.name}. Position nÂ°${positionNum}.`,
        speech: `Paiement confirmÃ©. RÃ©fÃ©rence ${result.transactionRef}. Vous Ãªtes en position numÃ©ro ${positionNum} dans la salle d'attente.`
      });
    } else {
      // Ã‰tape 3 : paiement Ã©chouÃ©
      setTxnResult(result);
      setPayStep('error');
    }
  };

  const resetPaymentModal = () => {
    setPayStep('form');
    setTxnResult(null);
    setPhoneError('');
    setActiveModal(null);
    setConsultReason('');
    setBookingError('');
    setBookingResult(null);
    setQueueMode('live');
  };

  // â”€â”€ Prise de rendez-vous â€” SANS PAIEMENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // Ce handler n'appelle JAMAIS `initiatePayment`. Le rendez-vous est
  // enregistrÃ© tel quel et le backend rÃ©pond explicitement que le rÃ¨glement
  // se fait sur place.
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookingError('');

    if (!bookingDate) {
      setBookingError('Choisissez une date de rendez-vous.');
      return;
    }
    if (!consultReason.trim()) {
      setBookingError('Indiquez le motif de la consultation.');
      return;
    }

    // Un praticien doit Ãªtre dÃ©signÃ© : sans cible, le rendez-vous ne peut
    // Ãªtre rattachÃ© Ã  personne et ne serait jamais honorÃ©.
    const targetDoc = selectedDoctor || doctorsList[0];
    if (!targetDoc) {
      setBookingError('Aucun praticien enregistrÃ© sur la plateforme. Vous ne pouvez pas prendre rendez-vous pour le moment.');
      return;
    }

    setBookingSubmitting(true);
    try {
      // Le crÃ©neau choisi est traduit en heure de rendez-vous : matin = 9h,
      // aprÃ¨s-midi = 14h. On ne propose pas de date Â« prÃ©cise Â» que la
      // plateforme ne sait pas rÃ©ellement respecter.
      const slotHour = bookingSlot === 'matin' ? 9 : 14;
      const appointmentDate = new Date(bookingDate);
      appointmentDate.setHours(slotHour, 0, 0, 0);

      const result = await bookAppointment({
        beneficiaryId: citizenUser?.id ?? citizenUser?.beneficiaryId ?? null,
        structureId: targetDoc?.structureId ?? null,
        doctorName: targetDoc.name,
        specialty: targetDoc.specialty || 'MÃ©decine GÃ©nÃ©rale',
        appointmentDate: appointmentDate.toISOString(),
        notes: [consultReason, bookingNotes].filter(Boolean).join(' â€” ')
      });

      if (result?.success) {
        setBookingResult(result.data);
        speakAndToast({
          type: 'success',
          icon: 'ðŸ“…',
          title: 'Rendez-vous enregistrÃ©',
          message: 'Aucun paiement n\'a Ã©tÃ© dÃ©bitÃ©. Le rÃ¨glement se fera sur place.',
          speech: 'Votre rendez-vous est enregistrÃ©. Aucun paiement n\'a Ã©tÃ© effectuÃ©. Vous rÃ©glerez la consultation sur place, Ã  la structure.'
        });
      } else {
        setBookingError(result?.message || 'Le rendez-vous n\'a pas pu Ãªtre enregistrÃ©.');
      }
    } catch (err) {
      setBookingError('Le rendez-vous n\'a pas pu Ãªtre enregistrÃ©. VÃ©rifiez votre connexion.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Simulation d'avancement de la file d'attente pour test rapide
  const handleAdvanceMyQueue = (patientId) => {
    setQueue(prevQueue => prevQueue.map(p => {
      if (p.id === patientId || p.cmu_number === activeCmuNumber) {
        if (p.status === 'waiting') {
          speakAndToast({
            type: 'warning',
            icon: 'ðŸ””',
            title: 'Alerte prÃ©alable',
            message: 'Vous Ãªtes le prochain patient. PrÃ©parez votre micro et votre camÃ©ra.',
            speech: `Attention ${activeFirstName}. Vous Ãªtes le prochain patient. Veuillez prÃ©parer votre micro et votre camÃ©ra. Le mÃ©decin va vous recevoir dans un instant.`
          });
          return { ...p, status: 'next' };
        }
        if (p.status === 'next') {
          speakAndToast({
            type: 'success',
            icon: 'ðŸ¥',
            title: "C'est votre tour !",
            message: 'Le mÃ©decin est prÃªt Ã  vous recevoir. La consultation commence maintenant.',
            speech: `${activeFirstName}, c'est votre tour. Le mÃ©decin est prÃªt Ã  vous recevoir. La consultation de tÃ©lÃ©mÃ©decine commence maintenant. Bienvenue.`
          });
          return { ...p, status: 'called' };
        }
        return { ...p, status: 'called' };
      }
      return p;
    }));
  };


  const handleStartCall = (doc, patient) => {
    const chosenDoc = doc || doctorsList[0];
    // Aucun praticien accrÃ©ditÃ© : impossible d'ouvrir une consultation.
    if (!chosenDoc) {
      speakAndToast({
        type: 'error',
        icon: 'âš ï¸',
        title: 'Aucun mÃ©decin disponible',
        message: 'Aucun praticien n\'est actuellement habilitÃ©. Votre demande reste en attente d\'accrÃ©ditation.',
        speech: 'Aucun mÃ©decin agrÃ©Ã© n\'est actuellement disponible sur la plateforme.'
      });
      return;
    }
    setActiveDoctor(chosenDoc);
    if (patient) setActivePatient(patient);
    setSwappedViews(false);
    setActiveCallTab('chat');
    setPrescriptionDelivered(false);
    setCertificateDelivered(false);
    const welcomeMsg = `Bonjour ${activeFirstName}. Je suis le ${chosenDoc.name} (${chosenDoc.specialty}). Je consulte actuellement votre dossier mÃ©dical UNAMUSC (${activeCmuNumber}). Quel est le motif de votre consultation aujourd'hui ?`;
    setChatMessages([
      { sender: chosenDoc.name, text: welcomeMsg, isUser: false }
    ]);
    setActiveModal('webrtc');
    startCamera(true);
    // La voix d'accueil synthÃ©tique ne se dÃ©clenche que dans l'ESPACE ASSURÃ‰
    // (le praticien ne doit pas s'entendre parler depuis son propre cabinet)
    if (consultationRole === 'patient') {
      setTimeout(() => {
        speakDoctor(welcomeMsg);
      }, 600);
    }
  };

  const handleSendMessage = (e, explicitText = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const userText = (explicitText !== null ? explicitText : inputMsg).trim();
    if (!userText) return;
    const newMessages = [...chatMessages, { sender: `${activeFirstName} ${activeLastName}`, text: userText, isUser: true }];
    setChatMessages(newMessages);
    setInputMsg('');
    setIsDoctorTyping(true);

    // RÃ©ponse mÃ©dicale dynamique et intelligente du praticien
    setTimeout(() => {
      let docReply = '';
      const lower = userText.toLowerCase();
      if (lower.includes('fiÃ¨vre') || lower.includes('fievre') || lower.includes('chaud') || lower.includes('temperature') || lower.includes('tempÃ©rature')) {
        docReply = `Je prends note de votre Ã©tat fÃ©brile. Veuillez bien vous hydrater. Je vous prescris du ParacÃ©tamol 1g (1 comprimÃ© toutes les 6h) et du repos. Vos constantes restent stables (SpO2: 99%, TA: 12/8).`;
      } else if (lower.includes('toux') || lower.includes('gorge') || lower.includes('grippe') || lower.includes('rhume') || lower.includes('respirer')) {
        docReply = `D'accord ${activeFirstName}, pour soulager la gorge et la toux, je vous prescris un sirop expectorant et des lavages de nez au sÃ©rum physiologique. Votre ordonnance 50% Tiers-Payant est prÃªte.`;
      } else if (lower.includes('tÃªte') || lower.includes('tete') || lower.includes('migraine') || lower.includes('vertige') || lower.includes('cÃ©phalÃ©e')) {
        docReply = `Vos cÃ©phalÃ©es peuvent Ãªtre liÃ©es au surmenage ou Ã  la fatigue oculaire. Votre tension artÃ©rielle est mesurÃ©e Ã  12/8 cmHg (parfaite). Je vous recommande du repos et un antalgique lÃ©ger.`;
      } else if (lower.includes('ventre') || lower.includes('estomac') || lower.includes('diarrhÃ©e') || lower.includes('diarrhee') || lower.includes('vomis') || lower.includes('nausÃ©e')) {
        docReply = `Pour vos douleurs abdominales, Ã©vitez les repas Ã©picÃ©s, buvez des bouillons lÃ©gers et prenez l'antispasmodique que je viens de vous inscrire sur l'ordonnance Ã©lectronique.`;
      } else if (lower.includes('ordonnance') || lower.includes('mÃ©dicament') || lower.includes('medicament') || lower.includes('pharmacie') || lower.includes('bon')) {
        docReply = `Votre ordonnance numÃ©rique avec prise en charge directe 50% UNAMUSC est gÃ©nÃ©rÃ©e ! Vous pouvez cliquer sur le bouton vert "Ã‰mettre Ordonnance & Bon 50%" ci-dessous pour l'imprimer ou la prÃ©senter en pharmacie.`;
      } else {
        docReply = `Merci pour ces prÃ©cisions, ${activeFirstName}. J'enregistre ces observations cliniques dans votre dossier mÃ©dical. Tout est sous contrÃ´le. Avez-vous d'autres questions ou besoins particuliers ?`;
      }

      setChatMessages(prev => [...prev, { sender: activeDoctor.name, text: docReply, isUser: false }]);
      setIsDoctorTyping(false);
      speakDoctor(docReply);
    }, 900);
  };

  const handleDownloadPrescription = () => {
    const orderCode = `ORD-TELEMED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    generateOfficialPdf({
      filename: `ordonnance_telemedecine_${activeFirstName}_${activeLastName}.pdf`,
      docType: 'ORDONNANCE MÃ‰DICALE DE TÃ‰LÃ‰MÃ‰DECINE CERTIFIÃ‰E (50% TIERS-PAYANT)',
      title: 'Ordonnance Ã‰lectronique & Bon Pharmacie 50%',
      referenceNo: orderCode,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: activeDoctor.department || 'Pharmacies AgrÃ©Ã©es Tiers-Payant UNAMUSC Dakar',
      details: [
        { label: 'Patient(e) BÃ©nÃ©ficiaire', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'MÃ©decin Prescripteur', value: `${activeDoctor.name} (${activeDoctor.specialty} â€” ${activeDoctor.cnom})` },
        { label: 'MÃ©dicaments Prescrits', value: '1. Amoxicilline 500mg (2 boÃ®tes) â€” 1 gÃ©lule 3x/jour pendant 7 jours\n2. ParacÃ©tamol 1g (1 boÃ®te) â€” 1 comprimÃ© en cas de fiÃ¨vre/douleur\n3. Solution de rÃ©hydratation & Vitamine C 500mg' },
        { label: 'Couverture Pharmacie UNAMUSC', value: '50% Prise en charge directe Tiers-Payant UNAMUSC SÃ©nÃ©gal' },
        { label: 'Date & ValiditÃ©', value: `${new Date().toLocaleDateString('fr-FR')} (Valable 30 jours dans toutes les officines agrÃ©Ã©es)` }
      ],
      notes: 'Cette ordonnance mÃ©dicale Ã©lectronique certifiÃ©e comporte le cachet numÃ©rique et le visa de conformitÃ© CNOM SÃ©nÃ©gal.'
    });

    // â”€â”€ INTERCONNEXION INTELLIGENTE : Synchronisation avec la page Bons de Commande (PurchaseOrders) â”€â”€
    try {
      const existingOrdersRaw = localStorage.getItem('cmu_purchase_orders');
      const existingOrders = existingOrdersRaw ? JSON.parse(existingOrdersRaw) : [];
      const newPurchaseOrder = {
        id: Date.now(),
        first_name: activeFirstName,
        last_name: activeLastName,
        cmu_number: activeCmuNumber,
        items_json: JSON.stringify([
          { name: 'Amoxicilline 500mg (2 boÃ®tes)', qty: 2, price: 3500 },
          { name: 'ParacÃ©tamol 1000mg (1 boÃ®te)', qty: 1, price: 1500 },
          { name: 'Solution RÃ©hydratation & Vit C', qty: 1, price: 1200 }
        ]),
        total_amount: 9700,
        cmu_covered: 4850,
        patient_pay: 4850,
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        order_code: orderCode,
        doctor_name: activeDoctor.name,
        doctor_cnom: activeDoctor.cnom,
        origin: 'TÃ©lÃ©mÃ©decine UNAMUSC'
      };
      const updatedOrders = [newPurchaseOrder, ...existingOrders.filter(o => o.order_code !== orderCode)];
      localStorage.setItem('cmu_purchase_orders', JSON.stringify(updatedOrders));
      
      // Mise Ã  jour des constantes vitales dans le DMP de l'assurÃ©
      localStorage.setItem(`cmu_medical_vitals_${activeCmuNumber}`, JSON.stringify({
        ...telemetryVitals,
        updated_at: new Date().toISOString(),
        doctor: activeDoctor.name
      }));
    } catch (e) {
      console.warn("Storage sync warning:", e);
    }

    speakAndToast({
      type: 'success',
      icon: 'ðŸ’Š',
      title: 'Ordonnance officielle gÃ©nÃ©rÃ©e & synchronisÃ©e',
      message: `L'ordonnance 50% de ${activeFirstName} ${activeLastName} a Ã©tÃ© tÃ©lÃ©chargÃ©e et ajoutÃ©e Ã  vos Bons de Commande Pharmacie.`
    });
  };

  const handleDownloadCertificate = () => {
    const certCode = `CERT-TELEMED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    generateOfficialPdf({
      filename: `certificat_medical_${activeFirstName}_${activeLastName}.pdf`,
      docType: 'CERTIFICAT MÃ‰DICAL DE TÃ‰LÃ‰CONSULTATION CERTIFIÃ‰E',
      title: 'Certificat MÃ©dical & Aptitude CSU',
      referenceNo: certCode,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: activeDoctor.department || 'Cabinet de TÃ©lÃ©consultation AgrÃ©Ã© UNAMUSC',
      details: [
        { label: 'Patient(e)', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'MÃ©decin Praticien', value: `${activeDoctor.name} (${activeDoctor.specialty} â€” ${activeDoctor.cnom})` },
        { label: 'Date de la Consultation', value: `${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` },
        { label: 'Constatations Cliniques', value: 'Examen mÃ©dical en visioconfÃ©rence concluant. Ã‰tat gÃ©nÃ©ral stable. TÃ©lÃ©mÃ©trie physiologique dans les normes.' },
        { label: 'Avis & Repos MÃ©dical', value: 'Repos mÃ©dical prescrit de 48 heures (2 jours). Traitement ambulatoire adaptÃ©.' }
      ],
      notes: 'Certificat mÃ©dical dÃ©livrÃ© en conformitÃ© avec les rÃ¨gles dÃ©ontologiques du Conseil National de l\'Ordre des MÃ©decins (CNOM) du SÃ©nÃ©gal.'
    });

    // â”€â”€ INTERCONNEXION INTELLIGENTE : Synchronisation avec la page Lettres de Garantie (GuaranteeLetters) â”€â”€
    try {
      const existingLettersRaw = localStorage.getItem('cmu_guarantee_letters');
      const existingLetters = existingLettersRaw ? JSON.parse(existingLettersRaw) : [];
      const newGuaranteeLetter = {
        id: Date.now(),
        first_name: activeFirstName,
        last_name: activeLastName,
        cmu_number: activeCmuNumber,
        ipp_number: `IPP-TELEMED-${Math.floor(1000 + Math.random() * 9000)}`,
        hospital_name: activeDoctor.department || 'Centre National de TÃ©lÃ©mÃ©decine UNAMUSC Dakar',
        medical_act: `TÃ©lÃ©consultation MÃ©dicale SpÃ©cialisÃ©e (${activeDoctor.specialty})`,
        estimated_amount: 12500,
        guaranteed_percentage: 80,
        unamusc_amount: 10000,
        sesame_amount: 0,
        max_amount: 10000,
        patient_rest: 2500,
        status: 'approved',
        validation_code: `GAR-TELEMED-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toISOString(),
        agent_note: `TÃ©lÃ©consultation certifiÃ©e effectuÃ©e par ${activeDoctor.name} (${activeDoctor.cnom}). Prise en charge 80% accordÃ©e.`
      };
      const updatedLetters = [newGuaranteeLetter, ...existingLetters.filter(l => l.validation_code !== newGuaranteeLetter.validation_code)];
      localStorage.setItem('cmu_guarantee_letters', JSON.stringify(updatedLetters));
    } catch (e) {
      console.warn("Guarantee letters sync warning:", e);
    }

    speakAndToast({
      type: 'success',
      icon: 'ðŸ“„',
      title: 'Certificat mÃ©dical dÃ©livrÃ© & synchronisÃ©',
      message: `Le certificat mÃ©dical de ${activeFirstName} ${activeLastName} a Ã©tÃ© gÃ©nÃ©rÃ© et la prise en charge a Ã©tÃ© enregistrÃ©e dans vos Lettres de Garantie.`
    });
  };

  // â”€â”€ DEMANDE D'EXAMENS COMPLÃ‰MENTAIRES (Laboratoire / Imagerie) â€” outil praticien â”€â”€
  const handleDownloadLabOrder = () => {
    const labCode = `LAB-TELEMED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    generateOfficialPdf({
      filename: `demande_examens_${activeFirstName}_${activeLastName}.pdf`,
      docType: 'DEMANDE D\u2019EXAMENS COMPLÃ‰MENTAIRES â€” TÃ‰LÃ‰CONSULTATION',
      title: 'Demande d\u2019Examens Biologiques & Imagerie MÃ©dicale',
      referenceNo: labCode,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: activeDoctor.department || 'Cabinet de TÃ©lÃ©consultation AgrÃ©Ã© UNAMUSC',
      details: [
        { label: 'Patient(e)', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'MÃ©decin Demandeur', value: `${activeDoctor.name} (${activeDoctor.specialty} â€” ${activeDoctor.cnom})` },
        { label: 'Date de la Demande', value: `${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` },
        { label: 'Examens Biologiques', value: 'NFS, CRP, GlycÃ©mie Ã  jeun, UrÃ©e/CrÃ©atinine, TSH' },
        { label: 'Imagerie MÃ©dicale', value: 'Radiographie thoracique (face) + Ã‰chographie abdominale si besoin' },
        { label: 'Contexte Clinique', value: `TÃ©lÃ©consultation du jour â€” motif : ${activePatient?.reason || 'Ã‰valuation clinique'}` },
        { label: 'Constantes Ã  la Consultation', value: `FC ${telemetryVitals.bpm} bpm â€¢ TA ${telemetryVitals.bp} mmHg â€¢ SpO2 ${telemetryVitals.spo2}% â€¢ T ${telemetryVitals.temp}Â°C` },
        { label: 'Prise en charge', value: 'Bons d\u2019examen UNAMUSC 80% (laboratoires et centres d\u2019imagerie agrÃ©Ã©s)' }
      ],
      notes: 'Demande d\u2019examens Ã©lectronique signÃ©e numÃ©riquement dans le cadre de la tÃ©lÃ©consultation UNAMUSC. PrÃ©senter ce document avec la carte Pass CSU dans les laboratoires agrÃ©Ã©s.'
    });

    speakAndToast({
      type: 'success',
      icon: 'ðŸ§ª',
      title: 'Demande d\u2019examens gÃ©nÃ©rÃ©e',
      message: `La demande d\u2019examens de ${activeFirstName} ${activeLastName} a Ã©tÃ© tÃ©lÃ©chargÃ©e (rÃ©f. ${labCode}).`
    });
  };

  const handleAddDoctor = (e) => {
    e.preventDefault();
    if (!newDocName) return;
    const newDoc = {
      id: Date.now(),
      name: newDocName,
      specialty: newDocSpecialty,
      category: newDocCategory,
      rating: '5.0 (Nouveau)',
      cnom: newDocCnom || 'CNOM: 2026-SN',
      langs: newDocLangs.split(',').map(s => s.trim()),
      department: newDocDept,
      avatar: newDocAvatar,
      available: true
    };
    setDoctorsList([newDoc, ...doctorsList]);
    setActiveModal(null);
    setNewDocName('');
    alert('âœ… Nouveau mÃ©decin praticien ajoutÃ© au rÃ©seau UNAMUSC avec succÃ¨s !');
  };

  const filteredDoctors = doctorsList.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || d.category === activeCategory;
    return matchSearch && matchCat;
  });



  // â”€â”€ LABORATOIRE & BIOLOGIE : PÃ©rimÃ¨tre d'examens tÃ©lÃ©-transmis â”€â”€
  if (isLabUser) {
    const handleSaveTeleOrder = (e) => {
      e.preventDefault();
      if (!editingTeleOrder) return;
      if (!editingTeleOrder.patientName || !editingTeleOrder.examName) {
        alert('Veuillez renseigner le nom du patient et l\'examen tÃ©lÃ©-prescrit.');
        return;
      }

      let updated;
      if (isNewTeleOrder) {
        const newObj = {
          ...editingTeleOrder,
          id: Date.now(),
          status: editingTeleOrder.status || 'pending'
        };
        updated = [newObj, ...teleOrders];
      } else {
        updated = teleOrders.map(o => o.id === editingTeleOrder.id ? editingTeleOrder : o);
      }
      setTeleOrders(updated);
      setEditingTeleOrder(null);
      setIsNewTeleOrder(false);
    };

    const handleDeleteTeleOrder = (order) => {
      setConfirmDeleteObj({
        title: `la prescription tÃ©lÃ©-mÃ©dicale "${order.examName || 'Examen'}" de ${order.patientName}`,
        onConfirm: () => {
          const updated = teleOrders.filter(o => o.id !== order.id);
          setTeleOrders(updated);
        }
      });
    };

    const handleConfirmTeleUpload = (e) => {
      e.preventDefault();
      if (!uploadTeleTarget) return;

      const updated = teleOrders.map(o => o.id === uploadTeleTarget.id ? { ...o, status: 'transmis', fileName: uploadTeleFileName || 'Bilan_Lipidique_Awa_Ndiaye.pdf' } : o);
      setTeleOrders(updated);

      // Add to DMP exams list in localStorage (Global & Patient-specific)
      try {
        const patientCmu = uploadTeleTarget.cmuNumber;
        const existingExams = JSON.parse(localStorage.getItem('cmu-medical-exams') || '[]');
        const patientExams = JSON.parse(localStorage.getItem(`cmu-exams-${patientCmu}`) || '[]');

        const newExam = {
          id: Date.now(),
          title: uploadTeleTarget.examName,
          exam_type: 'Bilan Biologique (TÃ©lÃ©mÃ©decine)',
          badge: 'TÃ‰LÃ‰MÃ‰DECINE HD',
          facility: partnerUser?.structureName || 'Laboratoire Pasteur Dakar',
          doctor: uploadTeleTarget.doctor,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          conclusion: uploadTeleNotes || 'Bilan lipidique et glycÃ©mie certifiÃ©s. RÃ©sultats transmis directement depuis le guichet de tÃ©lÃ©mÃ©decine.',
          cliches: 1,
          preview: '/csu_digital_health_real.jpg'
        };

        localStorage.setItem(`cmu-exams-${patientCmu}`, JSON.stringify([newExam, ...patientExams]));
        localStorage.setItem('cmu-medical-exams', JSON.stringify([newExam, ...existingExams]));
      } catch (err) {}

      alert(`âœ… Rapport de bilan tÃ©lÃ©-mÃ©dical transmis avec succÃ¨s au DMP pour ${uploadTeleTarget.patientName} (${uploadTeleTarget.cmuNumber}) !`);
      setUploadTeleTarget(null);
      setUploadTeleFileName('');
      setUploadTeleNotes('');
    };

    return (
      <div className="container-fluid px-4 py-4 fade-in-up">
        {/* HERO BANNER - ESPACE LABORATOIRE & BIOLOGIE (VERT Ã‰MERAUDE) */}
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
                  ðŸ§ª Structure de santÃ© & laboratoire conventionnÃ© UNAMUSC ðŸ‡¸ðŸ‡³
                </span>
              </div>

              <h1 className="fw-extrabold mb-2" style={{ color: '#ffffff', fontSize: '2.1rem', letterSpacing: '-0.02em', textTransform: 'none' }}>
                Prescriptions tÃ©lÃ©-mÃ©dicales d'examens
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Les consultations vidÃ©o interactives sont rÃ©servÃ©es aux mÃ©decins prescripteurs. Votre structure de santÃ© ou laboratoire conventionnÃ© ({partnerUser?.structureName || 'Laboratoire / Ã‰tablissement de santÃ© conventionnÃ©'}) est configurÃ©(e) pour recevoir et traiter les ordonnances de bilans sanguins, analyses et imagerie Ã©mises en tÃ©lÃ©mÃ©decine.
              </p>

              <div className="d-flex align-items-center flex-wrap mt-4" style={{ gap: '28px', rowGap: '16px' }}>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: '#047857', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', marginRight: '16px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/medical-profile')}>
                  ðŸ©» Transmettre des rÃ©sultats (DMP)
                </button>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', marginLeft: '4px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/verify')}>
                  ðŸ” VÃ©rifier la carte CSU d'un assurÃ©
                </button>
              </div>
            </div>

            <div className="col-lg-4 d-none d-lg-block text-center">
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>
                <img src="/csu_dicom_xray.png" alt="Prescriptions Labo" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {/* CONTENU HUB LABORATOIRE â€” Demandes de TÃ©lÃ©-prescriptions */}
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h4 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                <span>ðŸ“¥</span> Prescriptions tÃ©lÃ©-mÃ©dicales d'analyses & imagerie en attente
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '0.88rem' }}>
                Demandes d'analyses Ã©manant des tÃ©lÃ©consultations en direct. TÃ©lÃ©versez les rapports PDF certifiÃ©s pour libÃ©rer la prise en charge Tiers-Payant.
              </p>
            </div>
            
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button 
                type="button" 
                className="btn btn-emerald fw-bold text-white px-3.5 py-2 d-inline-flex align-items-center gap-2 shadow-sm" 
                style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem' }}
                onClick={() => {
                  setIsNewTeleOrder(true);
                  setEditingTeleOrder({
                    patientName: '',
                    cmuNumber: 'CMU-DKR-2026-3302',
                    doctor: 'Dr. Ousmane Sow',
                    type: 'TÃ©lÃ©-consultation HD',
                    examName: '',
                    ref: `Prescription TÃ©lÃ©-mÃ©decine #TM-${Math.floor(1000 + Math.random() * 9000)}`,
                    status: 'pending',
                    fileName: null
                  });
                }}
              >
                <span>âž• Prescrire un nouvel examen (TÃ©lÃ©mÃ©decine)</span>
              </button>

              <span className="badge bg-warning-subtle text-warning border border-warning px-3 py-2 fw-bold" style={{ borderRadius: '12px', fontSize: '0.82rem' }}>
                â³ Flux VisioconfÃ©rence Direct
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)', minWidth: '1300px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>AssurÃ©(e)</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>MÃ©decin tÃ©lÃ©-consultant</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Analyses / Imagerie demandÃ©es</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Statut prÃ©lÃ¨vement</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em', textAlign: 'right', minWidth: '420px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teleOrders.map(tOrd => (
                  <tr key={tOrd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.05rem' }}>
                          ðŸ‘¤
                        </div>
                        <div>
                          <strong className="d-block" style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{tOrd.patientName}</strong>
                          <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '6px' }}>
                            {tOrd.cmuNumber}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span className="fw-bold d-block" style={{ fontSize: '0.92rem' }}>ðŸ‘¨â€âš•ï¸ {tOrd.doctor}</span>
                      <span className="badge bg-info-subtle text-info border border-info fw-bold mt-0.5" style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '6px' }}>
                        ðŸŽ¥ {tOrd.type}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div className="text-primary fw-bold d-block mb-1" style={{ fontSize: '0.95rem' }}>
                        {tOrd.examName}
                      </div>
                      <div className="text-muted small d-block" style={{ fontSize: '0.82rem', lineHeight: '1.35' }}>
                        {tOrd.ref}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {tOrd.status === 'transmis' ? (
                        <span className="badge bg-success text-white px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                          âœ… Transmis & validÃ©
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                          ðŸ“¥ En attente de prÃ©lÃ¨vement
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '420px' }}>
                      <div className="d-flex align-items-center justify-content-end gap-2.5 flex-nowrap">
                        {tOrd.status === 'transmis' ? (
                          <button className="btn btn-sm btn-outline-success fw-bold px-3 py-2" style={{ borderRadius: '10px', fontSize: '0.82rem' }} onClick={() => (window.location.hash = '#/medical-profile')}>
                            ðŸ‘ Voir au DMP
                          </button>
                        ) : (
                          <button 
                            className="btn btn-sm btn-emerald fw-bold text-white px-3 py-2" 
                            style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }} 
                            onClick={() => setUploadTeleTarget(tOrd)}
                          >
                            ðŸ“¤ Transmettre le bilan PDF (DMP)
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
                          title="Modifier la prescription tÃ©lÃ©-mÃ©dicale"
                          onClick={() => {
                            setEditingTeleOrder({ ...tOrd });
                            setIsNewTeleOrder(false);
                          }}
                        >
                          âœï¸ Modifier
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
                          title="Supprimer la prescription tÃ©lÃ©-mÃ©dicale"
                          onClick={() => handleDeleteTeleOrder(tOrd)}
                        >
                          ðŸ—‘ï¸ Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL TRANSMISSION TÃ‰LÃ‰MÃ‰DECINE (React Portal) */}
        {uploadTeleTarget && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setUploadTeleTarget(null); }}
          >
            <form onSubmit={handleConfirmTeleUpload} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              {/* Modal Header */}
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold', boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)' }}>
                    ðŸ§ª
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      TÃ©lÃ©verser & Certifier Bilan TÃ©lÃ©-mÃ©dical
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success mt-1 fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC â€¢ {uploadTeleTarget.cmuNumber}
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setUploadTeleTarget(null)}></button>
              </div>

              {/* Patient Banner */}
              <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2.5">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.1rem' }}>ðŸ‘¤</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{uploadTeleTarget.patientName}</strong>
                  </div>
                  <code className="bg-success text-white px-2.5 py-1 rounded-3 fw-bold small">{uploadTeleTarget.cmuNumber}</code>
                </div>
                <div className="d-flex flex-column gap-2 mt-2 pt-2.5 border-top" style={{ borderColor: 'var(--border-color)', fontSize: '0.88rem' }}>
                  <div>
                    <span className="text-muted fw-semibold">ðŸ“‹ Examen prescrit : </span>
                    <strong className="text-primary">{uploadTeleTarget.examName}</strong>
                  </div>
                  <div>
                    <span className="text-muted fw-semibold">ðŸ‘¨â€âš•ï¸ MÃ©decin tÃ©lÃ©consultant : </span>
                    <strong style={{ color: 'var(--text-main)' }}>{uploadTeleTarget.doctor}</strong>
                  </div>
                </div>
              </div>

              {/* File Input Dropzone */}
              <div className="mb-4">
                <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  ðŸ“ Fichier d'analyse certifiÃ© (Format PDF) *
                </label>

                <div style={{ border: '2px dashed #10b981', borderRadius: '18px', padding: '1.75rem 1.25rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.04)', transition: 'all 0.2s ease' }}>
                  <input 
                    type="file" 
                    id="tele-file-upload-input"
                    accept=".pdf,.png,.jpg" 
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadTeleFileName(e.target.files[0].name);
                      }
                    }}
                  />
                  <label htmlFor="tele-file-upload-input" style={{ cursor: 'pointer', margin: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      ðŸ“„
                    </div>
                    <strong className="d-block text-primary" style={{ fontSize: '0.94rem' }}>
                      {uploadTeleFileName ? `âœ“ Fichier sÃ©lectionnÃ© : ${uploadTeleFileName}` : 'Cliquez ici pour choisir le document ou glissez-le'}
                    </strong>
                    <span className="text-muted d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                      Format PDF certifiÃ© avec signature du biologiste ou mÃ©decin
                    </span>
                  </label>
                </div>
              </div>

              {/* Biologist / Doctor Conclusions */}
              <div className="mb-4">
                <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  ðŸ“ Note & conclusions du biologiste / mÃ©decin ({partnerUser?.structureName || 'Laboratoire / Ã‰tablissement agrÃ©Ã©'})
                </label>
                <textarea 
                  className="form-control py-2.5 px-3" 
                  rows={3} 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '14px', fontSize: '0.88rem' }}
                  placeholder="Ex: Bilan lipidique satisfaisant. CholestÃ©rol total : 1.85 g/L. GlycÃ©mie Ã  jeun : 0.90 g/L."
                  value={uploadTeleNotes}
                  onChange={(e) => setUploadTeleNotes(e.target.value)}
                />
              </div>

              {/* Modal Action Buttons â€” SÃ©paration Maximale Gauche / Droite */}
              <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn px-4 py-2.5 fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                  onClick={() => setUploadTeleTarget(null)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn px-4.5 py-2.5 fw-bold text-white" 
                  style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                >
                  âœ… Publier directement au dossier mÃ©dical (DMP)
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

        {/* MODAL DE CRÃ‰ATION / Ã‰DITION DE PRESCRIPTION TÃ‰LÃ‰MÃ‰DECINE (React Portal) */}
        {editingTeleOrder && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditingTeleOrder(null); }}
          >
            <form onSubmit={handleSaveTeleOrder} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    ðŸ“±
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      {isNewTeleOrder ? 'Prescrire un examen par tÃ©lÃ©mÃ©decine' : 'Modifier la prescription tÃ©lÃ©-mÃ©dicale'}
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC â€¢ TÃ©lÃ©mÃ©decine HD
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setEditingTeleOrder(null)}></button>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Nom du patient *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.patientName || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, patientName: e.target.value })}
                    placeholder="Ex: Awa Ndiaye"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">NÂ° Carte CSU *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.cmuNumber || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, cmuNumber: e.target.value })}
                    placeholder="Ex: CMU-DKR-2026-3302"
                    required
                  />
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Examen / Bilan demandÃ© *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.examName || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, examName: e.target.value })}
                    placeholder="Ex: Bilan Lipidique & GlycÃ©mie Ã  jeun"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">MÃ©decin tÃ©lÃ©-consultant</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.doctor || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, doctor: e.target.value })}
                    placeholder="Ex: Dr. Ousmane Sow"
                  />
                </div>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">RÃ©fÃ©rence prescription</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.ref || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, ref: e.target.value })}
                    placeholder="Ex: Prescription TÃ©lÃ©-mÃ©decine #TM-8812"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Statut prÃ©lÃ¨vement</label>
                  <select 
                    className="form-select"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.status || 'pending'}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, status: e.target.value })}
                  >
                    <option value="pending">ðŸ“¥ En attente de prÃ©lÃ¨vement</option>
                    <option value="transmis">âœ… Transmis & validÃ©</option>
                  </select>
                </div>
              </div>

              <div className="d-flex justify-content-between align-items-center pt-3.5 border-top w-100" style={{ borderColor: 'var(--border-color)' }}>
                <button 
                  type="button" 
                  className="btn px-4 py-2.5 fw-bold" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '0.88rem' }} 
                  onClick={() => setEditingTeleOrder(null)}
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  className="btn px-4.5 py-2.5 fw-bold text-white" 
                  style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                >
                  ðŸ’¾ Enregistrer la prescription
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
                ðŸ—‘ï¸
              </div>

              <h4 className="fw-extrabold mb-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                Confirmer la suppression
              </h4>

              <p className="mb-4" style={{ color: 'var(--text-sub, #94a3b8)', fontSize: '0.92rem', lineHeight: '1.55' }}>
                Voulez-vous vraiment supprimer dÃ©finitivement <strong style={{ color: '#ef4444' }}>{confirmDeleteObj.title}</strong> ?
                <br />
                <small className="text-muted d-block mt-1">Cette action est irrÃ©versible dans le systÃ¨me UNAMUSC.</small>
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
                  ðŸ—‘ï¸ Supprimer dÃ©finitivement
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // â”€â”€ PHARMACIEN : non concernÃ© par la tÃ©lÃ©mÃ©decine â”€â”€
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
                  Pharmacien agrÃ©Ã© UNAMUSC ðŸ‡¸ðŸ‡³
                </span>
              </div>

              <h1 className="fw-extrabold mb-2" style={{ color: '#ffffff', fontSize: '2.1rem', letterSpacing: '-0.02em', textTransform: 'none' }}>
                TÃ©lÃ©mÃ©decine : non concernÃ©
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Les tÃ©lÃ©consultations et le suivi vidÃ©o sont exclusivement rÃ©servÃ©s aux praticiens prescripteurs. Votre compte est dÃ©diÃ© Ã  la rÃ©ception et au traitement des ordonnances mÃ©dicamenteuses.
              </p>

              <div className="d-flex align-items-center flex-wrap mt-4" style={{ gap: '28px', rowGap: '16px' }}>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: '#047857', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', marginRight: '16px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/purchase-orders')}>
                  ðŸ’Š AccÃ©der au guichet des bons de commande
                </button>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', marginLeft: '4px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/verify')}>
                  ðŸ” VÃ©rifier la carte CSU d'un assurÃ©
                </button>
              </div>
            </div>

            <div className="col-lg-4 d-none d-lg-block text-center">
              <div style={{ borderRadius: '20px', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.3)', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>
                <img src="/csu_digital_health_real.jpg" alt="TÃ©lÃ©mÃ©decine UNAMUSC" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. CONTENU DU HUB PHARMACIEN â€” TÃ©lÃ©consultation */}
        <div className="row g-4 mb-4">
          {/* Panneau d'information des droits RBAC */}
          <div className="col-xxl-5 col-12">
            <div className="p-4 rounded-4 h-100 position-relative overflow-hidden" style={{
              background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-card-subtle) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '24px',
              boxShadow: '0 12px 35px rgba(5, 150, 105, 0.15)'
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '140px', height: '140px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />

              <div className="d-flex align-items-center gap-3 mb-3.5">
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.12) 100%)',
                  color: '#10b981',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justify: 'center',
                  fontSize: '1.5rem',
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)'
                }}>
                  ðŸ’»
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.1rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    TÃ©lÃ©consultation & confidentialitÃ©
                  </h5>
                  <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                    RÃ¨glementation RBAC UNAMUSC SÃ©nÃ©gal
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                La plateforme de tÃ©lÃ©mÃ©decine relie directement les patients aux mÃ©decins et sage-femmes agrÃ©Ã©s. Les ordonnances prescrites lors d'une tÃ©lÃ©consultation sont directement transmises au guichet des bons de commande officine.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="p-3.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div className="d-flex align-items-center gap-2.5">
                    <span style={{ fontSize: '1.1rem' }}>ðŸ’Š</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}>Traitement des ordonnances Ã©lectroniques</span>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
                    ðŸŸ¢ Disponible (100%)
                  </span>
                </div>

                <div className="p-3.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2.5">
                    <span style={{ fontSize: '1.1rem' }}>ðŸ“¹</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}>Session vidÃ©o mÃ©decin-patient</span>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary border border-secondary px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
                    ðŸ”´ Non concernÃ©
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RACCOURCIS PHARMACIE */}
          <div className="col-xxl-7 col-12">
            <div className="row g-3">
              <div className="col-xl-6 col-12">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden hover-lift" 
                  style={{ 
                    background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(5, 150, 105, 0.05) 100%)', 
                    border: '1.5px solid rgba(16, 185, 129, 0.45)', 
                    borderRadius: '22px', 
                    boxShadow: '0 10px 28px rgba(5, 150, 105, 0.15)' 
                  }} 
                  onClick={() => (window.location.hash = '#/purchase-orders')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', boxShadow: '0 6px 18px rgba(5,150,105,0.4)' }}>
                      ðŸ’Š
                    </div>
                    <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.74rem', fontWeight: 700, padding: '5px 12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                      Guichet principal âž”
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Bons de commande & ordonnances
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Valider les mÃ©dicaments & facturer en tiers-payant UNAMUSC.
                  </p>
                </div>
              </div>

              <div className="col-xl-6 col-12">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden hover-lift" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '22px' 
                  }} 
                  onClick={() => (window.location.hash = '#/verify')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', border: '1.5px solid rgba(16, 185, 129, 0.35)' }}>
                      ðŸ”
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      ContrÃ´le CSU âž”
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    VÃ©rification des cartes CSU
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Scanner QR code & contrÃ´ler l'Ã©ligibilitÃ© tiers-payant.
                  </p>
                </div>
              </div>

              <div className="col-xl-6 col-12">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden hover-lift" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '22px' 
                  }} 
                  onClick={() => (window.location.hash = '#/health-structures')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', border: '1.5px solid rgba(2, 132, 199, 0.35)' }}>
                      ðŸ¥
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      RÃ©seau officines âž”
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Structures de santÃ© agrÃ©Ã©es
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Annuaire des officines et centres hospitaliers du SÃ©nÃ©gal.
                  </p>
                </div>
              </div>

              <div className="col-xl-6 col-12">
                <div 
                  className="p-4 rounded-4 h-100 cursor-pointer transition-all position-relative overflow-hidden hover-lift" 
                  style={{ 
                    background: 'var(--bg-card)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '22px' 
                  }} 
                  onClick={() => (window.location.hash = '#/statistics')}
                >
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'rgba(217, 119, 6, 0.15)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', border: '1.5px solid rgba(217, 119, 6, 0.35)' }}>
                      ðŸ“Š
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Facturation UNAMUSC âž”
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Rapports & statistiques
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Suivi des dÃ©livrances et Ã©tats de remboursement officine.
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
      <div className="telemed-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>âš ï¸</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>âš ï¸ AccÃ¨s aux soins refusÃ© â€” Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas Ã  jour. Tous vos droits et accÃ¨s aux services de tÃ©lÃ©mÃ©decine sont suspendus.
              <br />
              <strong className="d-block mt-2 text-danger">Veuillez rÃ©gulariser votre cotisation et celui des membres de votre famille pour un montant de 10 500 FCFA.</strong>
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
                ðŸ’³ Renouveler ma cotisation (10 500 FCFA)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="telemed-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {/* BANDEAU DE NAVIGATION : ESPACE STRICTEMENT CLOISONNÃ‰ AU RÃ”LE CONNECTÃ‰ */}
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div style={{ borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '0.85rem 1.5rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
      
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: activeRoleMode === 'doctor' ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: '#ffffff', boxShadow: activeRoleMode === 'doctor' ? '0 4px 12px rgba(16,185,129,0.35)' : '0 4px 12px rgba(2,132,199,0.35)' }}>
              {activeRoleMode === 'doctor' ? 'ðŸ‘¨â€âš•ï¸' : 'ðŸ©º'}
            </div>
            <div>
              <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: '1.2' }}>
                {activeRoleMode === 'doctor' ? 'Espace Praticien â€” Cabinet Digital & TÃ©lÃ©consultation' : 'TÃ©lÃ©mÃ©decine UNAMUSC â€” Espace AssurÃ© CSU'}
              </h5>
              <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>
                {activeRoleMode === 'doctor' 
                  ? (partnerUser?.structureName ? `${partnerUser.structureName} â€¢ Ordre National des MÃ©decins` : 'Praticien de Garde AgrÃ©Ã© CNOM â€¢ TÃ©lÃ©consultations RÃ©glementÃ©es')
                  : `${activeFirstName} ${activeLastName} â€¢ NÂ° CSU : ${activeCmuNumber}`}
              </small>
            </div>
          </div>

          {/* BADGE RÃ”LE STRICTEMENT DÃ‰DIÃ‰ (Pas de commutation inter-profils pour les assurÃ©s ou praticiens) */}
          {isSuperAdmin ? (
            <div style={{ display: 'flex', gap: '0.5rem', background: '#0b1120', padding: '5px', borderRadius: '14px', border: '1px solid #1e293b' }}>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: adminRoleMode === 'doctor' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'transparent',
                  color: '#ffffff',
                  border: adminRoleMode === 'doctor' ? '1px solid #34d399' : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '0.55rem 1.15rem',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
                onClick={() => setAdminRoleMode('doctor')}
              >
                <span>ðŸ‘¨â€âš•ï¸</span> Vue Praticien (SuperAdmin)
              </button>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: adminRoleMode === 'citizen' ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)' : 'transparent',
                  color: '#ffffff',
                  border: adminRoleMode === 'citizen' ? '1px solid #7dd3fc' : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '0.55rem 1.15rem',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
                onClick={() => setAdminRoleMode('citizen')}
              >
                <span>ðŸ‘¤</span> Vue AssurÃ© (SuperAdmin)
              </button>
              <button
                type="button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: adminRoleMode === 'agent' ? 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' : 'transparent',
                  color: '#ffffff',
                  border: adminRoleMode === 'agent' ? '1px solid #c4b5fd' : '1px solid transparent',
                  borderRadius: '10px',
                  padding: '0.55rem 1.15rem',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
                onClick={() => setAdminRoleMode('agent')}
              >
                <span>ðŸ›¡ï¸</span> Vue Agent (SuperAdmin)
              </button>
            </div>
          ) : (
            <div>
              {activeRoleMode === 'doctor' ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(5, 150, 105, 0.15)', border: '1px solid #10b981', padding: '0.5rem 1.1rem', borderRadius: '14px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399', display: 'inline-block' }} />
                  <span style={{ color: '#34d399', fontWeight: '800', fontSize: '0.85rem' }}>
                    ðŸ‘¨â€âš•ï¸ Praticien de Garde AgrÃ©Ã©
                  </span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(2, 132, 199, 0.15)', border: '1px solid #0284c7', padding: '0.5rem 1.1rem', borderRadius: '14px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8', display: 'inline-block' }} />
                  <span style={{ color: '#38bdf8', fontWeight: '800', fontSize: '0.85rem' }}>
                    ðŸ‘¤ Espace AssurÃ© CSU (Tiers-Payant 80%)
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

  <div style={{ maxWidth: '1320px', margin: '1.5rem auto 0 auto', padding: '0 1.5rem' }}>
    
    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {/* 1. ESPACE PROFESSIONNEL DE SANTÃ‰ (PRATICIEN / MÃ‰DECIN DE GARDE) */}
    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {activeRoleMode === 'doctor' && (
      <div className="fade-in-up">
        
        {/* BanniÃ¨re Profil Praticien & Statut de Garde */}
        <div style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #0f172a 100%)',
          border: '1.5px solid #10b981',
          borderRadius: '24px',
          padding: '1.75rem 2rem',
          color: '#ffffff',
          boxShadow: '0 12px 35px rgba(5,150,105,0.25)',
          marginBottom: '1.75rem'
        }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            
            {/* Doctor Identity & Selector */}
            <div className="d-flex align-items-center gap-3.5">
              <img
                src={doctorsList.find(d => d.id === selectedDoctorId)?.avatar || doctorsList[0]?.avatar || '/dr_fatou_diop.png'}
                onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }}
                alt="Praticien"
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '20px',
                  objectFit: 'cover',
                  border: '3px solid #34d399',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
                }}
              />
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className="badge" style={{ background: '#10b981', color: '#ffffff', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>
                    ðŸŸ¢ PRATICIEN AGRÃ‰Ã‰ EN LIGNE
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                    {doctorsList.find(d => d.id === selectedDoctorId)?.cnom || 'Non renseignÃ©'}
                  </span>
                </div>

                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <h3 className="fw-extrabold mb-0 text-white" style={{ fontSize: '1.45rem' }}>
                    {doctorsList.find(d => d.id === selectedDoctorId)?.name || 'Dr. Aminata Ndiaye'}
                  </h3>
                  {/* Dropdown switch doctor profile */}
                  <select
                    style={{
                      background: '#0f172a',
                      color: '#34d399',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                    value={selectedDoctorId}
                    onChange={(e) => {
                      const docId = Number(e.target.value);
                      setSelectedDoctorId(docId);
                      const doc = doctorsList.find(d => d.id === docId);
                      if (doc) setActiveDoctor(doc);
                    }}
                  >
                    {doctorsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        Changer de profil : {d.name} ({d.specialty})
                      </option>
                    ))}
                  </select>
                </div>

                <p className="mb-0 text-white-50" style={{ fontSize: '0.88rem', marginTop: '3px' }}>
                  SpÃ©cialitÃ© : <strong style={{ color: '#38bdf8' }}>{doctorsList.find(d => d.id === selectedDoctorId)?.specialty || 'PÃ©diatrie & SantÃ© Familiale'}</strong> | {doctorsList.find(d => d.id === selectedDoctorId)?.department || 'Dakar Centre'}
                </p>
              </div>
            </div>

            {/* Status Switcher (Disponible / En consultation / Pause) */}
            <div style={{ background: '#0b1120', padding: '0.85rem 1.25rem', borderRadius: '16px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '220px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Statut de votre Cabinet :
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: practitionerAvailability === 'available' ? '#059669' : '#1e293b',
                    color: '#ffffff',
                    border: practitionerAvailability === 'available' ? '1.5px solid #34d399' : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPractitionerAvailability('available')}
                >
                  ðŸŸ¢ Disponible
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: practitionerAvailability === 'in_call' ? '#d97706' : '#1e293b',
                    color: '#ffffff',
                    border: practitionerAvailability === 'in_call' ? '1.5px solid #fbbf24' : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPractitionerAvailability('in_call')}
                >
                  ðŸŸ¡ En appel
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    background: practitionerAvailability === 'away' ? '#dc2626' : '#1e293b',
                    color: '#ffffff',
                    border: practitionerAvailability === 'away' ? '1.5px solid #f87171' : '1px solid #334155',
                    borderRadius: '8px',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  onClick={() => setPractitionerAvailability('away')}
                >
                  ðŸ”´ Pause
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* 4 KPIs Praticien du Jour */}
        <div className="row g-3 mb-4">
          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #10b981', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Patients en attente</span>
                <span style={{ fontSize: '1.3rem' }}>ðŸ‘¥</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#34d399', fontSize: '1.8rem' }}>{queue.length}</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>PrÃªts pour tÃ©lÃ©consultation</small>
            </div>
          </div>

          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #1e293b', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Temps moyen</span>
                <span style={{ fontSize: '1.3rem' }}>â±ï¸</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#38bdf8', fontSize: '1.8rem' }}>~4 min</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Par consultation HD</small>
            </div>
          </div>

          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #1e293b', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Actes RÃ©alisÃ©s</span>
                <span style={{ fontSize: '1.3rem' }}>âœ…</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#a78bfa', fontSize: '1.8rem' }}>8</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>TÃ©lÃ©consultations du jour</small>
            </div>
          </div>

          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #1e293b', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Honoraires Tiers-Payant</span>
                <span style={{ fontSize: '1.3rem' }}>ðŸ’°</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#fde047', fontSize: '1.6rem' }}>85 000 F</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Garantie 100% UNAMUSC</small>
            </div>
          </div>
        </div>

        {/* SALLE D'ATTENTE INTERACTIVE & APPEL DES ASSURÃ‰S PAR LE PRATICIEN */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '22px', padding: '1.75rem', marginBottom: '2rem', boxShadow: 'var(--shadow-md)' }}>
          
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h5 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>
                <span>ðŸ¥</span> Salle d'Attente Virtuelle â€” Patients en Attente ({queue.length})
              </h5>
              <p className="mb-0 text-muted small">
                Cliquez sur <strong>Â« Recevoir &amp; Appeler Â»</strong> pour dÃ©marrer la visioconfÃ©rence HD avec l'assurÃ© et ouvrir son dossier clinique.
              </p>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.55rem 1.15rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                onClick={() => {
                  const samplePatient = {
                    id: Date.now(),
                    patient_name: 'Mamadou Diop',
                    cmu_number: 'DKR_260009.0.49',
                    reason: 'CÃ©phalÃ©es intenses et fiÃ¨vre 38.5Â°C',
                    joined_at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    status: 'waiting',
                    payment_method: 'Wave',
                    requested_doctor: doctorsList.find(d => d.id === selectedDoctorId)?.name || 'Dr. Aminata Ndiaye'
                  };
                  setQueue([samplePatient, ...queue]);
                  speakAndToast({
                    type: 'info',
                    icon: 'ðŸ””',
                    title: 'Nouveau patient en salle d\'attente',
                    message: 'Mamadou Diop vient d\'entrer en salle d\'attente pour une tÃ©lÃ©consultation.'
                  });
                }}
              >
                âž• Simuler ArrivÃ©e d'un AssurÃ©
              </button>
            </div>
          </div>

          {/* Table / Cards de la File d'attente */}
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
              <thead>
                <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)', fontSize: '0.8rem', letterSpacing: '0.3px' }}>
                  <th style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>Ordre</th>
                  <th style={{ padding: '0.85rem' }}>AssurÃ©(e)</th>
                  <th style={{ padding: '0.85rem' }}>Matricule CSU</th>
                  <th style={{ padding: '0.85rem' }}>Motif Clinique</th>
                  <th style={{ padding: '0.85rem' }}>Heure</th>
                  <th style={{ padding: '0.85rem' }}>Ticket ModÃ©rateur</th>
                  <th style={{ padding: '0.85rem' }}>Ã‰tat</th>
                  <th style={{ padding: '0.85rem', textAlign: 'right' }}>Actions Praticien</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      Aucun patient en attente actuellement. Vous serez notifiÃ© dÃ¨s qu'un assurÃ© valide son entrÃ©e.
                    </td>
                  </tr>
                ) : (
                  queue.map((p, idx) => (
                    <tr key={p.id} className="border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                      <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                        <span style={{ 
                          background: idx === 0 ? 'linear-gradient(135deg, #059669, #10b981)' : '#1e293b', 
                          color: '#ffffff', 
                          border: idx === 0 ? 'none' : '1px solid #334155',
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '50%', 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          fontWeight: '800', 
                          fontSize: '0.88rem',
                          boxShadow: idx === 0 ? '0 3px 10px rgba(16,185,129,0.35)' : 'none'
                        }}>
                          #{idx + 1}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <div className="fw-extrabold" style={{ color: 'var(--text-main)', fontSize: '0.96rem', marginBottom: '2px' }}>
                          {p.patient_name}
                        </div>
                        <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '700' }}>
                          âœ” Couverture CSU 80% ValidÃ©e
                        </div>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <code style={{ background: '#0b1120', color: '#38bdf8', border: '1px solid #1e293b', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700' }}>
                          {p.cmu_number}
                        </code>
                      </td>

                      <td style={{ padding: '1rem 0.85rem', maxWidth: '240px' }}>
                        <div style={{ background: '#0b1120', color: '#f8fafc', padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #1e293b', fontSize: '0.82rem', lineHeight: '1.4' }}>
                          ðŸ©º {p.reason}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <span className="fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                          ðŸ•’ {p.joined_at}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700', display: 'inline-block' }}>
                          âœ… RÃ©glÃ© (2 500 F)
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        {p.status === 'called' ? (
                          <span className="badge bg-success text-white px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>ðŸŸ¢ En appel</span>
                        ) : p.status === 'next' ? (
                          <span className="badge bg-warning text-dark px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>ðŸ”” NotifiÃ©</span>
                        ) : (
                          <span className="badge bg-secondary text-white px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>â³ En attente</span>
                        )}
                      </td>

                      <td className="text-end" style={{ padding: '1rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <div className="d-flex align-items-center justify-content-end" style={{ gap: '0.5rem', whiteSpace: 'nowrap' }}>
                          
                          {/* Bouton Dossier MÃ©dical */}
                          <button 
                            type="button" 
                            style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '10px', padding: '0.5rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                            onClick={() => setSelectedPatientForRecord(p)}
                            title="Consulter le dossier mÃ©dical CSU"
                          >
                            ðŸ“‹ Dossier
                          </button>

                          {/* Bouton Notifier */}
                          <button 
                            type="button" 
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '10px', padding: '0.5rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                            onClick={() => {
                              setQueue(queue.map(item => item.id === p.id ? { ...item, status: 'next' } : item));
                              speakAndToast({
                                type: 'warning',
                                icon: 'ðŸ””',
                                title: 'Patient notifiÃ©',
                                message: `${p.patient_name} a Ã©tÃ© prÃ©venu(e) que la consultation va dÃ©marrer.`,
                                speech: `${p.patient_name}, c'est bientÃ´t votre tour. Veuillez allumer votre micro et camÃ©ra. Le mÃ©decin va vous recevoir.`
                              });
                            }}
                            title="PrÃ©venir le patient que son tour arrive"
                          >
                            ðŸ”” PrÃ©venir
                          </button>
                          
                          {/* Bouton Recevoir en consultation HD */}
                          <button 
                            type="button" 
                            style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.5rem 1rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 3px 12px rgba(5,150,105,0.35)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                            onClick={() => {
                              const currentDoc = doctorsList.find(d => d.id === selectedDoctorId) || doctorsList[0];
                              setQueue(queue.map(item => item.id === p.id ? { ...item, status: 'called' } : item));
                              handleStartCall(currentDoc, p);
                            }}
                            title="DÃ©marrer la consultation vidÃ©o HD avec le patient"
                          >
                            ðŸŽ¥ Recevoir &amp; Appeler
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Outils Cliniques & Prescriptions Rapides */}
        <div className="row g-4 mb-4">
          <div className="col-md-6">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1.5rem', height: '100%' }}>
              <h6 className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>ðŸ’Š</span> GÃ©nÃ©rateur d'Ordonnance MÃ©dicale NumÃ©rique (50% Tiers-Payant)
              </h6>
              <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                Ã‰mettez une ordonnance sÃ©curisÃ©e avec votre cachet Ã©lectronique et NÂ° CNOM. L'assurÃ© la recevra instantanÃ©ment avec QR code agrÃ©Ã©.
              </p>
              <button
                type="button"
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
                onClick={handleDownloadPrescription}
              >
                ðŸ“„ TÃ©lÃ©charger ModÃ¨le d'Ordonnance SignÃ©e (PDF)
              </button>
            </div>
          </div>

          <div className="col-md-6">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1.5rem', height: '100%' }}>
              <h6 className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>ðŸ“„</span> Certificat MÃ©dical &amp; ArrÃªt de Travail
              </h6>
              <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                DÃ©livrez des attestations de repos ou certificats de constatation clinique officiels conformes au barÃ¨me national.
              </p>
              <button
                type="button"
                style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
                onClick={handleDownloadCertificate}
              >
                ðŸ“¥ Ã‰mettre Certificat MÃ©dical Officiel (PDF)
              </button>
            </div>
          </div>
        </div>

      </div>
    )}

    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {/* 2. ESPACE ASSURÃ‰ (PATIENT & CITOYEN CSU) */}
    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {activeRoleMode === 'citizen' && (
      <div className="fade-in-up">
        
        {/* BanniÃ¨re Titulaire AssurÃ© & Droits CSU */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          border: '1.5px solid rgba(2, 132, 199, 0.45)',
          borderRadius: '24px',
          padding: '1.75rem 2.25rem',
          color: '#ffffff',
          boxShadow: '0 14px 35px rgba(2, 132, 199, 0.18)',
          marginBottom: '2rem'
        }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: '1.5rem', rowGap: '1.25rem' }}>
            <div className="d-flex align-items-center" style={{ gap: '1.25rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '18px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', color: '#ffffff', boxShadow: '0 6px 16px rgba(2, 132, 199, 0.35)', flexShrink: 0 }}>
                ðŸ‘¤
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1.5 flex-wrap">
                  <span className="badge bg-success text-white px-3 py-1" style={{ borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.03em' }}>
                    âœ” ASSURÃ‰ CSU CONNECTÃ‰
                  </span>
                  <code style={{ background: '#0b1120', color: '#38bdf8', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    {activeCmuNumber}
                  </code>
                </div>
                <h4 className="fw-extrabold mb-1 text-white" style={{ fontSize: '1.25rem' }}>
                  {activeFirstName} {activeLastName}
                </h4>
                <small style={{ color: '#94a3b8', fontSize: '0.84rem' }}>
                  Prise en charge active : <strong style={{ color: '#34d399' }}>80% Soins &amp; 50% Pharmacie (Tiers-Payant UNAMUSC)</strong>
                </small>
              </div>
            </div>

            <div className="d-flex align-items-center flex-wrap" style={{ gap: '1.25rem', rowGap: '0.85rem' }}>
              <button
                type="button"
                className="hover-lift"
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '0.85rem 1.65rem',
                  fontWeight: '800',
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setActiveModal('join_queue')}
              >
                <span style={{ fontSize: '1.1rem' }}>âš¡</span> Entrer en salle d'attente (2 500 FCFA)
              </button>
              <button
                type="button"
                className="hover-lift"
                style={{
                  background: 'rgba(30, 41, 59, 0.95)',
                  color: '#f8fafc',
                  border: '1.5px solid #475569',
                  borderRadius: '16px',
                  padding: '0.85rem 1.35rem',
                  fontWeight: '750',
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setActiveModal('qr')}
              >
                <span style={{ fontSize: '1.1rem' }}>ðŸ“²</span> Mon Pass CSU
              </button>
            </div>
          </div>
        </div>


        {/* SALLE D'ATTENTE PERSONNELLE EN DIRECT (SI L'ASSURÃ‰ A UNE CONSULTATION EN COURS) */}
        {(() => {
          const myIndex = queue.findIndex(q => q.cmu_number === activeCmuNumber || q.patient_name.includes(activeLastName));
          if (myIndex === -1) return null;
          
          const myItem = queue[myIndex];
          const positionInQueue = myIndex + 1;
          const status = myItem.status || 'waiting';

          // Cas 1 : En attente dans la file
          if (status === 'waiting' && positionInQueue > 1) {
            return (
              <div className="p-4 rounded-4 mb-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', borderRadius: '24px', border: '2px solid #059669', boxShadow: '0 10px 30px rgba(5,150,105,0.2)' }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <span className="badge bg-success text-white fw-bold px-3 py-1.5 mb-2 d-inline-block" style={{ borderRadius: '20px', fontSize: '0.8rem' }}>
                      ðŸŸ¢ EN SALLE D'ATTENTE VIRTUELLE (RÃˆGLEMENT CONFIRMÃ‰)
                    </span>
                    <h4 className="fw-extrabold mb-1 text-white">
                      Vous Ãªtes Ã  la Position <span className="text-warning">nÂ°{positionInQueue}</span> dans l'ordre de passage
                    </h4>
                    <p className="mb-0 text-white-50 small">
                      Praticien assignÃ© : <strong>{myItem.requested_doctor}</strong> | Motif : {myItem.reason}
                    </p>
                    <small className="text-emerald-400 d-block mt-1 fw-semibold" style={{ color: '#34d399' }}>
                      {/* La durÃ©e d'attente Ã©tait calculÃ©e par
                          `positionInQueue * 4` minutes : une multiplication
                          inventÃ©e, prÃ©sentÃ©e comme une estimation. Aucune
                          donnÃ©e de durÃ©e moyenne de consultation n'existe
                          dans le systÃ¨me. On affiche donc votre position,
                          qui est un fait, sans annoncer un dÃ©lai. */}
                      Restez sur cette page : le praticien vous appellera Ã  votre tour.
                    </small>
                  </div>

                  <div className="d-flex flex-column gap-2 align-items-end">
                    <button
                      type="button"
                      className="btn btn-secondary text-white fw-bold px-4 py-2 opacity-75"
                      style={{ borderRadius: '12px', fontSize: '0.88rem', cursor: 'not-allowed' }}
                      disabled
                    >
                      â³ En attente de votre tour (Position nÂ°{positionInQueue})
                    </button>
                    <button
                      type="button"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => handleAdvanceMyQueue(myItem.id)}
                    >
                      â© Simuler Avancement de mon Tour (Test)
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Cas 2 : Prochain patient
          if (status === 'next' || (status === 'waiting' && positionInQueue === 1)) {
            return (
              <div className="p-4 rounded-4 mb-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '24px', border: '2px solid #f59e0b', boxShadow: '0 12px 35px rgba(245,158,11,0.25)' }}>
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div>
                    <span className="fw-extrabold px-3 py-1.5 mb-2 d-inline-block" style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid #f59e0b', borderRadius: '20px', fontSize: '0.82rem' }}>
                      ðŸ”” ALERTE : VOUS ÃŠTES LE PROCHAIN PATIENT !
                    </span>
                    <h4 className="fw-extrabold mb-1 text-white">
                      PrÃ©parez votre micro et votre camÃ©ra ðŸ“¹
                    </h4>
                    <p className="mb-0 text-white-50 small">
                      Le <strong>{myItem.requested_doctor}</strong> termine sa consultation prÃ©cÃ©dente et va vous recevoir d'un instant Ã  l'autre.
                    </p>
                  </div>

                  <div className="d-flex flex-column gap-2 align-items-end">
                    <button
                      type="button"
                      style={{ background: '#f59e0b', color: '#000000', border: 'none', borderRadius: '12px', padding: '0.75rem 1.4rem', fontWeight: '900', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245,158,11,0.4)' }}
                      onClick={() => handleAdvanceMyQueue(myItem.id)}
                    >
                      ðŸ“ž Simuler l'Appel du MÃ©decin
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Cas 3 : C'est votre tour ! (Appel entrant direct)
          return (
            <div className="p-4 rounded-4 mb-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', borderRadius: '24px', border: '2px solid #10b981', boxShadow: '0 15px 40px rgba(16,185,129,0.35)' }}>
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <span className="fw-extrabold px-3 py-1.5 mb-2 d-inline-block" style={{ background: 'rgba(16,185,129,0.25)', color: '#34d399', border: '1px solid #10b981', borderRadius: '20px', fontSize: '0.85rem' }}>
                    ðŸ”” C'EST VOTRE TOUR ! LE MÃ‰DECIN VOUS APPELLE
                  </span>
                  <h4 className="fw-extrabold mb-1 text-white">
                    Le {myItem.requested_doctor} vous attend en Salle de TÃ©lÃ©consultation HD
                  </h4>
                  <p className="mb-0 text-white-50 small">
                    RÃ¨glement validÃ© ({myItem.payment_method}) | Motif : {myItem.reason}
                  </p>
                </div>

                <button
                  type="button"
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#ffffff',
                    border: '2px solid #34d399',
                    borderRadius: '14px',
                    padding: '0.95rem 2rem',
                    fontWeight: '900',
                    fontSize: '1.05rem',
                    cursor: 'pointer',
                    boxShadow: '0 6px 22px rgba(16,185,129,0.5)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}
                  onClick={() => handleStartCall(doctorsList.find(d => d.name === myItem.requested_doctor) || doctorsList[0])}
                >
                  <span>ðŸ“ž</span> Rejoindre la Consultation VidÃ©o HD â€º
                </button>
              </div>
            </div>
          );
        })()}

        {/* Top Hero Banner AssurÃ© */}
        <div className="p-4 p-md-5 rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.4) 0%, rgba(16, 185, 129, 0.2) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat', padding: '3.5rem 2.5rem', minHeight: '230px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }}>
          <div className="row align-items-center g-4">
            <div className="col-xxl-8 col-12">
              <span style={{ background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.85rem', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                ðŸ‡¸ðŸ‡³ SALLE D'ATTENTE VIRTUELLE UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.3rem', letterSpacing: '-0.02em', textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>
                Consultez un mÃ©decin en moins de 10 min
              </h1>
              <p className="text-white mb-4" style={{ fontSize: '1.05rem', maxWidth: '720px', lineHeight: '1.6', textShadow: '0 2px 4px rgba(0,0,0,0.3)', opacity: 0.95 }}>
                RÃ©seau national de mÃ©decins agrÃ©Ã©s. VisioconfÃ©rence HD WebRTC bidirectionnelle sÃ©curisÃ©e avec dÃ©livrance instantanÃ©e d'ordonnance 50%.
              </p>
              
              <button
                type="button"
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '14px', padding: '0.85rem 1.85rem', fontWeight: '800', fontSize: '0.98rem', boxShadow: '0 4px 20px rgba(16,185,129,0.45)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                onClick={() => setActiveModal('join_queue')}
              >
                âš¡ Entrer en salle d'attente (2 500 FCFA)
              </button>
            </div>

            <div className="col-xxl-4 col-12">
              <div className="p-4 rounded-4" style={{ background: 'rgba(255, 255, 255, 0.22)', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)', backdropFilter: 'blur(10px)' }}>
                <div className="d-flex align-items-center justify-content-between gap-2 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.6rem' }}>
                  <span className="fw-bold text-white" style={{ fontSize: '0.92rem' }}>
                    {/* Â« N Praticiens en ligne Â» comptait les praticiens
                        INSCRITS, pas ceux rÃ©ellement connectÃ©s : le chiffre
                        n'avait aucun rapport avec une prÃ©sence rÃ©elle. On
                        compte donc ceux que le serveur a vus rÃ©cemment. */}
                    {(() => {
                      const list = practitionerPresence?.practitioners;
                      if (!presenceLoaded || !Array.isArray(list)) return 'VÃ©rification des disponibilitÃ©sâ€¦';
                      const seen = new Set();
                      let enLigne = 0;
                      for (const p of list) {
                        if (p?.online && p.practitioner_name && !seen.has(p.practitioner_name)) {
                          seen.add(p.practitioner_name);
                          enLigne++;
                        }
                      }
                      return enLigne === 0
                        ? 'Aucun praticien connectÃ© actuellement'
                        : `${enLigne} praticien${enLigne > 1 ? 's' : ''} connectÃ©${enLigne > 1 ? 's' : ''}`;
                    })()}
                  </span>
                  <span style={{ background: presenceLoaded ? '#334155' : '#475569', color: '#ffffff', fontSize: '0.75rem', fontWeight: '700', padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
                    {/* Â« Disponible 24/7 Â» Ã©tait Ã©crit en dur : la plateforme
                        ne fonctionne qu'aux heures ouvrÃ©es des structures, et
                        ce bandeau promettait une joignabilitÃ© permanente que
                        rien ne garantissait. On affiche ce que la prÃ©sence
                        permet d'affirmer, et le mode de rafraÃ®chissement
                        rÃ©el â€” annoncer Â« temps rÃ©el Â» en diffÃ©rÃ© ferait
                        croire Ã  une disponibilitÃ© instantanÃ©e. */}
                    {!presenceLoaded
                      ? 'VÃ©rification des disponibilitÃ©sâ€¦'
                      : presenceMode === 'stream'
                        ? 'DisponibilitÃ©s en temps rÃ©el'
                        : presenceMode === 'polling'
                          ? 'DisponibilitÃ©s actualisÃ©es toutes les 50 s'
                          : 'DisponibilitÃ©s selon le praticien'}
                  </span>
                </div>

                <div className="text-white fw-semibold" style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
                  {doctorsList.slice(0, 4).map((d, idx) => (
                    <span key={idx} style={{ display: 'inline-block', marginRight: '6px', marginBottom: '4px', background: 'rgba(255,255,255,0.15)', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                      {d.name}
                    </span>
                  ))}
                </div>
                <small className="text-white-50 d-block mt-2" style={{ fontSize: '0.8rem' }}>
                  Temps d'attente moyen : <strong className="text-warning">âš¡ 4 min</strong>
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Grille des MÃ©decins AgrÃ©Ã©s Disponibles */}
        <div className="row g-4 mb-4">
          <div className="col-xxl-8 col-12">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                ðŸ‘¨â€âš•ï¸ Choisissez votre Praticien AgrÃ©Ã©
              </h5>
              
              {/* Filtres & Recherche */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="Filtrer un mÃ©decin..." 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: '160px' }} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', padding: '0.2rem', borderRadius: '10px' }}>
                  <button 
                    type="button"
                    style={{ background: activeCategory === 'all' ? '#10b981' : 'transparent', color: activeCategory === 'all' ? '#ffffff' : 'var(--text-sub)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                    onClick={() => setActiveCategory('all')}
                  >
                    Tous
                  </button>
                  <button 
                    type="button"
                    style={{ background: activeCategory === 'pediatrie' ? '#10b981' : 'transparent', color: activeCategory === 'pediatrie' ? '#ffffff' : 'var(--text-sub)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                    onClick={() => setActiveCategory('pediatrie')}
                  >
                    PÃ©diatrie
                  </button>
                  <button 
                    type="button"
                    style={{ background: activeCategory === 'cardio' ? '#10b981' : 'transparent', color: activeCategory === 'cardio' ? '#ffffff' : 'var(--text-sub)', border: 'none', borderRadius: '8px', padding: '0.3rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }} 
                    onClick={() => setActiveCategory('cardio')}
                  >
                    Cardiologie
                  </button>
                </div>
              </div>
            </div>

            {/* `col-lg-6` et non `col-md-6` : le seuil `md` (768px)
                dÃ©clenchait 2 colonnes alors que la zone de contenu, amputÃ©e
                de la sidebar, ne mesurait qu'environ 500px. Chaque carte
                tombait a~240px et le bouton "Entrer en salle d'attente"
                se coupait en deux lignes. `lg` (992px) reserve 2 colonnes
                au moment ou la place est reellement disponible ; en dessous,
                les cartes passent pleine largeur. */}
            <div className="row g-3">
              {filteredDoctors.map((doc) => (
                <div key={doc.id} className="col-lg-6">
                  <div className="p-3.5 rounded-4 d-flex flex-column justify-content-between" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                    <div>
                      <div className="d-flex gap-3 align-items-center mb-3">
                        <img src={doc.avatar} onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }} alt={doc.name} style={{ width: '56px', height: '56px', borderRadius: '14px', objectFit: 'cover' }} />
                        <div>
                          <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>{doc.name}</h6>
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>{doc.specialty}</span>
                          {/* AUCUNE note. La ligne `â˜… {doc.rating}` lisait un
                              champ qui n'est renseignÃ© nulle part : elle
                              affichait Â« â˜… undefined Â» sur chaque carte, ou
                              pire, une note reconduite depuis un ancien
                              localStorage. Le libellÃ© Â« 4,9 / 124 avis Â»
                              n'a jamais reposÃ© sur un avis rÃ©el. La note
                              d'un praticien n'apparaÃ®tra que lorsqu'un
                              patient rÃ©ellement consultÃ© la dÃ©pose. */}
                        </div>
                      </div>

                      <div className="d-flex gap-2 mb-3 flex-wrap">
                        <span 
                          style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedCnomDoctor(doc);
                            setActiveModal('cnom_info');
                          }}
                        >
                          ðŸ†” {doc.cnom}
                        </span>
                        {doc.langs.map((l, idx) => (
                          <span key={idx} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600' }}>
                            ðŸŒ {l}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button 
                      type="button"
                      style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }} 
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setActiveModal('join_queue');
                      }}
                    >
                      ðŸ¥ Entrer en salle d'attente (2 500 FCFA) â€º
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Droite AssurÃ© â€” `col-xxl-4 col-12` pour rester alignÃ©e avec
              la colonne `col-xxl-8` ci-dessus. Avec `col-lg-4` seul, la
              sidebar se retrouvait sur une seule ligne alors que la liste
              des mÃ©decins occupait dÃ©jÃ  deux lignes, dÃ©calant tout le
              contenu vers le bas. */}
          <div className="col-xxl-4 col-12">
            <div className="d-flex flex-column gap-4">
              
              {/* Ordonnances */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-center gap-2 mb-2 text-success">
                  <span style={{ fontSize: '1.3rem' }}>ðŸ’Š</span>
                  <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Mes Ordonnances Digitales</h6>
                </div>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                  Consultez vos ordonnances sÃ©curisÃ©es et vos attestations de tÃ©lÃ©consultation Ã©mises avec tiers-payant.
                </p>
                <button
                  type="button"
                  style={{
                    background: '#1e293b',
                    color: '#34d399',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '0.6rem 1rem',
                    fontWeight: '700',
                    width: '100%',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (onNavigate) onNavigate('carnet-sante');
                  }}
                >
                  ðŸ“‚ VOIR MON CARNET DE SANTÃ‰
                </button>
              </div>

              {/* Card QR Code CSU */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>ðŸ“² PrÃ©sentation QR code CSU</h6>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>PrÃ©sentez votre pass sanitaire numÃ©rique au mÃ©decin lors de l'appel.</p>
                
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                  onClick={() => setActiveModal('qr')}
                >
                  Afficher QR code assurÃ©
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* KPI Banner & Historique des TÃ©lÃ©consultations CertifiÃ©es UNAMUSC */}
        <div className="mt-5 p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          {/* En-tÃªte de la section historique (AssurÃ© vs Personnel MÃ©dical/Agent) */}
          {(() => {
            // Historique RÃ‰ELLEMENT enregistrÃ© (tÃ©lÃ©consultations saisies par
            // les praticiens). Aucune tÃ©lÃ©consultation de dÃ©monstration :
            // un diagnostic et une ordonnance fictifs rattachÃ©s Ã  un patient
            // rÃ©el constitueraient un faux dossier mÃ©dical.
            const rawHistory = (() => {
              if (typeof window === 'undefined') return [];
              try {
                const raw = localStorage.getItem('cmu-teleconsultations');
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
              } catch (e) {
                return [];
              }
            })();

            let activeHistoryList = rawHistory;
            if (isCitizen) {
              const citizenCmu = (activeCmuNumber || '').trim().toLowerCase();
              activeHistoryList = rawHistory.filter((h) =>
                (h.cmu || '').trim().toLowerCase() === citizenCmu
              );
              // Aucun repli : un dossier vierge est prÃ©fÃ©rable Ã  une ligne
              // de tÃ©lÃ©consultation inventÃ©e pour ce patient.
            }

            const totalVolume = activeHistoryList.length;
            const pageSize = 10;
            const totalPages = Math.max(1, Math.ceil(totalVolume / pageSize));
            const safePage = Math.min(historyPage, totalPages);
            const startItem = totalVolume === 0 ? 0 : (safePage - 1) * pageSize + 1;
            const endItem = Math.min(safePage * pageSize, totalVolume);

            const displayList = isCitizen ? activeHistoryList : activeHistoryList.slice((safePage - 1) * pageSize, safePage * pageSize);

            return (
              <>
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                  <div>
                    <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      {isCitizen ? `ðŸ“œ Mes TÃ©lÃ©consultations & Ordonnances MÃ©dicales (${activeFirstName} ${activeLastName})` : 'ðŸ“œ Historique RÃ©gional des TÃ©lÃ©consultations CertifiÃ©es UNAMUSC'}
                    </h5>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>
                      {isCitizen
                        ? `Historique mÃ©dical certifiÃ© par le Conseil National de l'Ordre des MÃ©decins (CNOM) â€¢ ${activeHistoryList.length} consultation(s)`
                        : `Registre national â€” ${totalVolume} tÃ©lÃ©consultation(s) rÃ©ellement enregistrÃ©e(s)`
                      }
                    </small>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                    ðŸŸ¢ Synchro Temps RÃ©el
                  </span>
                </div>

                {/* Tableau d'historique enrichi */}
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)' }}>
                    <thead style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <tr>
                        <th style={{ padding: '0.9rem' }}>NÂ° TÃ©lÃ©consultation</th>
                        <th style={{ padding: '0.9rem' }}>Patient & CSU</th>
                        <th style={{ padding: '0.9rem' }}>Praticien & SpÃ©cialitÃ©</th>
                        <th style={{ padding: '0.9rem' }}>Motif & Diagnostic</th>
                        <th style={{ padding: '0.9rem' }}>Date & Heure</th>
                        <th style={{ padding: '0.9rem' }}>Ordonnance</th>
                        <th style={{ padding: '0.9rem', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayList.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '0.85rem' }}>
                            <code className="px-2.5 py-1 bg-dark text-warning border border-warning rounded-3 fw-bold" style={{ fontSize: '0.78rem' }}>
                              {item.code}
                            </code>
                          </td>
                          <td style={{ padding: '0.85rem' }}>
                            <strong className="d-block" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{item.patient}</strong>
                            <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>{item.cmu}</small>
                          </td>
                          <td style={{ padding: '0.85rem' }}>
                            <div className="fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>{item.doc}</div>
                            <span className="badge" style={{ fontSize: '0.72rem', background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}>{item.spec}</span>
                          </td>
                          <td style={{ padding: '0.85rem', maxWidth: '220px' }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
                              {item.reason}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem', whiteSpace: 'nowrap' }}>
                            <small style={{ color: 'var(--text-sub)', fontWeight: '600', fontSize: '0.8rem' }}>
                              ðŸ•’ {item.date}
                            </small>
                          </td>
                          <td style={{ padding: '0.85rem' }}>
                            <span className="badge bg-success-subtle text-success border border-success px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                              âœ… {item.status}
                            </span>
                          </td>
                          <td className="text-end" style={{ padding: '0.85rem' }}>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success fw-bold"
                              style={{ borderRadius: '8px', fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                              onClick={() => {
                                setActiveModal('prescription');
                                speakAndToast({
                                  type: 'info',
                                  icon: 'ðŸ“‘',
                                  title: 'ReÃ§u & Ordonnance TÃ©lÃ©consultation',
                                  message: `Consultation ${item.code} du patient ${item.patient} chargÃ©e avec succÃ¨s.`
                                });
                              }}
                            >
                              ðŸ“¥ ReÃ§u PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination TÃ©lÃ©consultations */}
                <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top" style={{ borderColor: 'var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-sub)' }}>
                    {isCitizen ? (
                      <>Affichage de <strong>{startItem}</strong> Ã  <strong>{endItem}</strong> sur <strong>{totalVolume}</strong> tÃ©lÃ©consultation(s) personnelle(s)</>
                    ) : (
                      <>Affichage de <strong>{startItem}</strong> Ã  <strong>{endItem}</strong> sur <strong>420</strong> tÃ©lÃ©consultations (Page {safePage} sur 42)</>
                    )}
                  </span>
                  {totalPages > 1 && (
                    <div className="d-flex gap-1 align-items-center">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={safePage === 1}
                        onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                        style={{ borderRadius: '8px', padding: '0.3rem 0.75rem' }}
                      >
                        â—€ PrÃ©cÃ©dent
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={`btn btn-sm ${safePage === p ? 'btn-success fw-bold' : 'btn-outline-secondary'}`}
                          onClick={() => setHistoryPage(p)}
                          style={{ borderRadius: '8px', padding: '0.3rem 0.65rem', minWidth: '32px' }}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        disabled={safePage >= totalPages}
                        onClick={() => setHistoryPage(prev => Math.min(totalPages, prev + 1))}
                        style={{ borderRadius: '8px', padding: '0.3rem 0.75rem' }}
                      >
                        Suivant â–¶
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

        </div>

      </div>
    )}

  </div>

  {/* JOIN QUEUE & PAYMENT INTEGRATED MODAL (React Portal â€” Centered on Screen) */}
    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {/* 3. ESPACE AGENT UD â€” SUPERVISION DE LA SALLE D'ATTENTE VIRTUELLE   */}
    {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
    {activeRoleMode === 'agent' && (
      <div className="fade-in-up">

        {/* BanniÃ¨re Agent UD */}
        <div style={{
          background: 'linear-gradient(135deg, #2e1065 0%, #1e293b 100%)',
          border: '1.5px solid #7c3aed',
          borderRadius: '24px',
          padding: '1.5rem 2rem',
          color: '#ffffff',
          boxShadow: '0 12px 35px rgba(124,58,237,0.25)',
          marginBottom: '1.75rem'
        }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', color: '#ffffff' }}>
                ðŸ›¡ï¸
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className="badge" style={{ background: '#7c3aed', color: '#ffffff', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>
                    ðŸŸ¢ AGENT UD CONNECTÃ‰
                  </span>
                  {isSuperAdmin && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                      ðŸ‘ï¸ Vue Super Admin
                    </span>
                  )}
                </div>
                <h4 className="fw-extrabold mb-0 text-white">
                  {agentUser?.full_name || agentUser?.name || agentUser?.email || 'Agent UD DÃ©partemental'}
                </h4>
                <small style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Union DÃ©partementale : <strong style={{ color: '#c4b5fd' }}>{agentDept}</strong> â€¢ Supervision temps rÃ©el de la salle d'attente virtuelle
                </small>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <span style={{ background: 'rgba(124,58,237,0.25)', color: '#e9d5ff', border: '1px solid rgba(124,58,237,0.5)', borderRadius: '12px', padding: '0.5rem 0.9rem', fontWeight: '800', fontSize: '0.8rem' }}>
                â³ {queue.filter(p => !p.status || p.status === 'waiting').length} en attente
              </span>
              <span style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', padding: '0.5rem 0.9rem', fontWeight: '800', fontSize: '0.8rem' }}>
                ðŸŽ¥ {queue.filter(p => p.status === 'called').length} en consultation
              </span>
            </div>
          </div>
        </div>

        {/* Stats rapides de supervision */}
        {(() => {
          const waitingCount = queue.filter(p => !p.status || p.status === 'waiting').length;
          const nextCount = queue.filter(p => p.status === 'next').length;
          const calledCount = queue.filter(p => p.status === 'called').length;
          const doneCount = queue.filter(p => p.status === 'done').length;
          const revenue = queue.filter(p => p.payment_status === 'paid').length * 2500;
          const stats = [
            { icon: 'â³', label: 'En attente', value: waitingCount, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
            { icon: 'ðŸ””', label: 'Patients notifiÃ©s', value: nextCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
            { icon: 'ðŸŽ¥', label: 'En tÃ©lÃ©consultation', value: calledCount, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
            { icon: 'ðŸ’°', label: 'Encaissements du jour', value: `${revenue.toLocaleString('fr-FR')} F`, color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)' },
            { icon: 'âœ…', label: 'Consultations terminÃ©es', value: doneCount, color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.35)' }
          ];
          return (
            <div className="row g-3 mb-4">
              {stats.map((s, i) => (
                <div className="col-6 col-lg" key={i}>
                  <div className="p-3.5 rounded-4 h-100" style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: '18px' }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span style={{ fontSize: '1.15rem' }}>{s.icon}</span>
                      <strong style={{ color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: '700' }}>{s.label}</strong>
                    </div>
                    <div style={{ fontSize: '1.45rem', fontWeight: '900', color: s.color, lineHeight: '1.1' }}>{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Table de supervision de la file d'attente */}
        <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.05rem' }}>
              ðŸ“‹ File d'attente virtuelle â€” Pilotage Agent UD
            </h5>
            <span className="badge" style={{ background: 'rgba(124,58,237,0.15)', color: '#a855f7', border: '1px solid rgba(124,58,237,0.35)', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800' }}>
              ðŸ”„ Temps rÃ©el â€¢ {queue.length} patient(s) inscrit(s)
            </span>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-5">
              <span style={{ fontSize: '2.6rem', opacity: 0.6 }}>ðŸ—‚ï¸</span>
              <p className="fw-bold mb-1 mt-2" style={{ color: 'var(--text-main)' }}>Aucun patient en salle d'attente</p>
              <small style={{ color: 'var(--text-sub)' }}>Les nouvelles admissions apparaÃ®tront ici automatiquement aprÃ¨s paiement du ticket (2 500 FCFA).</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ color: 'var(--text-sub)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Patient</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>NÂ° CSU</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Motif</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Urgence</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>MÃ©decin demandÃ©</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Ticket</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Statut</th>
                    <th className="text-end" style={{ padding: '0.75rem 0.85rem' }}>Actions agent</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <div className="fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>ðŸ‘¤ {p.patient_name}</div>
                        <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem' }}>ðŸ•’ {p.joined_at}</small>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <code style={{ background: 'var(--bg-card-subtle, #0b1120)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.76rem' }}>{p.cmu_number}</code>
                      </td>
                      <td style={{ padding: '0.85rem', maxWidth: '230px' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.35 }}>{p.reason}</div>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {p.urgency === 'critical' ? (
                          <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '800' }}>ðŸ”´ URGENCE</span>
                        ) : p.urgency === 'urgent' ? (
                          <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '800' }}>ðŸŸ  Prioritaire</span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.35)', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '800' }}>ðŸŸ¢ Routine</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.82rem', fontWeight: '600' }}>{p.requested_doctor || 'â€”'}</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {p.payment_status === 'paid' ? (
                          <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.3rem 0.65rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '700', display: 'inline-block' }}>âœ… RÃ©glÃ©</span>
                        ) : (
                          <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.3rem 0.65rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '700', display: 'inline-block' }}>â³ ImpayÃ©</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {p.status === 'called' ? (
                          <span className="badge bg-success text-white px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.74rem' }}>ðŸŸ¢ En appel</span>
                        ) : p.status === 'next' ? (
                          <span className="badge bg-warning text-dark px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.74rem' }}>ðŸ”” NotifiÃ©</span>
                        ) : p.status === 'done' ? (
                          <span className="badge" style={{ background: 'rgba(100,116,139,0.2)', color: '#e2e8f0', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem' }}>âœ… TerminÃ©e</span>
                        ) : (
                          <span className="badge bg-secondary text-white px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.74rem' }}>â³ En attente</span>
                        )}
                      </td>
                      <td className="text-end" style={{ padding: '0.85rem', whiteSpace: 'nowrap' }}>
                        {p.status === 'done' ? (
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>â€”</small>
                        ) : (
                          <div className="d-flex align-items-center justify-content-end flex-wrap" style={{ gap: '0.6rem' }}>
                            {(!p.status || p.status === 'waiting') && (
                              <button
                                type="button"
                                style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '10px', padding: '0.45rem 0.7rem', fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer' }}
                                onClick={() => {
                                  setQueue(prev => prev.map(item => item.id === p.id ? { ...item, status: 'next' } : item));
                                  speakAndToast({
                                    type: 'warning',
                                    icon: 'ðŸ””',
                                    title: 'Patient notifiÃ©',
                                    message: `${p.patient_name} a Ã©tÃ© prÃ©venu(e) que son tour approche.`
                                  });
                                }}
                                title="PrÃ©venir le patient que son tour arrive"
                              >
                                ðŸ”” PrÃ©venir
                              </button>
                            )}
                            {p.status === 'next' && (
                              <button
                                type="button"
                                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.45rem 0.8rem', fontWeight: '800', fontSize: '0.76rem', cursor: 'pointer', boxShadow: '0 3px 12px rgba(5,150,105,0.35)' }}
                                onClick={() => {
                                  setQueue(prev => prev.map(item => item.id === p.id ? { ...item, status: 'called' } : item));
                                  speakAndToast({
                                    type: 'success',
                                    icon: 'ðŸŽ¥',
                                    title: 'Patient appelÃ© en visio',
                                    message: `${p.patient_name} (${p.cmu_number}) basculÃ© en tÃ©lÃ©consultation avec ${p.requested_doctor || 'le praticien de garde'}.`
                                  });
                                }}
                                title="Confirmer l'appel en tÃ©lÃ©consultation"
                              >
                                ðŸŽ¥ Appeler
                              </button>
                            )}
                            <button
                              type="button"
                              style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.4)', borderRadius: '10px', padding: '0.45rem 0.7rem', fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer' }}
                              onClick={() => {
                                setQueue(prev => prev.map(item => item.id === p.id ? { ...item, status: 'done' } : item));
                                speakAndToast({
                                  type: 'info',
                                  icon: 'âœ…',
                                  title: 'Consultation clÃ´turÃ©e',
                                  message: `Dossier de ${p.patient_name} marquÃ© comme terminÃ©. Compte-rendu synchronisÃ©.`
                                });
                              }}
                              title="Marquer la consultation comme terminÃ©e"
                            >
                              âœ… Terminer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    )}

        {/* Bandeau KPI Stats â€” RÃ©servÃ© aux Agents (selon niveau d'accÃ¨s) et au Super Admin (vue totale) */}
        {canManageQueue && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Card 1: TÃ©lÃ©consultations effectuÃ©es */}
          <div 
            className="transition-all cursor-pointer position-relative overflow-hidden hover-lift"
            style={{ 
              background: 'var(--bg-card, #ffffff)', 
              border: '1.5px solid rgba(16, 185, 129, 0.35)',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.08)',
              borderRadius: '20px',
              padding: '1.35rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={() => setActiveModal('kpi_telemed_details')}
            title="Cliquer pour voir la rÃ©partition des tÃ©lÃ©consultations enregistrÃ©es"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(16,185,129,0.30)' }}>
                ðŸ’»
              </div>
              <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                ðŸŸ¢ LIVE
              </span>
            </div>
            <div>
              {/* Compteur rÃ©el : file d'attente effectivement enregistrÃ©e.
                  L'offset Â« 420 Â» affichÃ© avant comptait des consultations
                  qui n'ont jamais eu lieu. */}
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#059669', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                {queue.filter(q => q.status === 'called' || q.status === 'done').length}
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                TÃ©lÃ©consultations effectuÃ©es
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#065f46', fontWeight: '600' }}>
                <span>Depuis la mise en service</span>
                <span>ðŸ”</span>
              </div>
            </div>
          </div>

          {/* Card 2: SpÃ©cialistes accrÃ©ditÃ©s CNOM */}
          <div 
            className="transition-all cursor-pointer position-relative overflow-hidden hover-lift"
            style={{ 
              background: 'var(--bg-card, #ffffff)', 
              border: '1.5px solid rgba(59, 130, 246, 0.35)',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.08)',
              borderRadius: '20px',
              padding: '1.35rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={() => setActiveModal('all_doctors')}
            title="Cliquer pour consulter l'annuaire complet des mÃ©decins agrÃ©Ã©s CNOM"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(59,130,246,0.30)' }}>
                ðŸ‘¨â€âš•ï¸
              </div>
              <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                ðŸ‡¸ðŸ‡³ CNOM AgrÃ©Ã©s
              </span>
            </div>
            <div>
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#2563eb', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                {doctorsList.filter(d => d.accredited !== false).length}
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                SpÃ©cialistes accrÃ©ditÃ©s CNOM
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#1e40af', fontWeight: '600' }}>
                <span>8 SpÃ©cialitÃ©s mÃ©dicales</span>
                <span>ðŸ”</span>
              </div>
            </div>
          </div>

          {/* Card 3: Satisfaction des assurÃ©s */}
          <div 
            className="transition-all cursor-pointer position-relative overflow-hidden hover-lift"
            style={{ 
              background: 'var(--bg-card, #ffffff)', 
              border: '1.5px solid rgba(245, 158, 11, 0.35)',
              boxShadow: '0 8px 24px rgba(245, 158, 11, 0.08)',
              borderRadius: '20px',
              padding: '1.35rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={() => setActiveModal('kpi_satisfaction_details')}
            title="Cliquer pour lire les avis certifiÃ©s des assurÃ©s"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(245,158,11,0.30)' }}>
                â­
              </div>
              <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                En attente d'avis
              </span>
            </div>
            <div>
              {/* Aucune note n'est affichÃ©e tant qu'aucun avis rÃ©el n'a Ã©tÃ©
                  collectÃ©. Les valeurs 98,4 % / â˜… 4,9 / 1 420 avis Ã©taient
                  des constantes : elles ne dÃ©pendaient d'aucun avis. */}
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#d97706', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                â€”
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                Satisfaction des assurÃ©s
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#92400e', fontWeight: '600' }}>
                <span>Aucun avis enregistrÃ©</span>
                <span>ðŸ”</span>
              </div>
            </div>
          </div>

          {/* Card 4: Tiers-payant (80% UNAMUSC) */}
          <div 
            className="transition-all cursor-pointer position-relative overflow-hidden hover-lift"
            style={{ 
              background: 'var(--bg-card, #ffffff)', 
              border: '1.5px solid rgba(168, 85, 247, 0.35)',
              boxShadow: '0 8px 24px rgba(168, 85, 247, 0.08)',
              borderRadius: '20px',
              padding: '1.35rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onClick={() => setActiveModal('kpi_tierspayant_details')}
            title="Cliquer pour voir la dÃ©composition du Tiers-Payant UNAMUSC 80%"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #7e22ce, #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(168,85,247,0.30)' }}>
                ðŸ’³
              </div>
              <span style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                ðŸ›¡ï¸ UNAMUSC 80%
              </span>
            </div>
            <div>
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#7e22ce', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                2 500 FCFA
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                Tiers-payant (80% UNAMUSC)
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#6b21a8', fontWeight: '600' }}>
                <span>Part UNAMUSC : 10 000 FCFA</span>
                <span>ðŸ”</span>
              </div>
            </div>
          </div>
        </div>
        )}

  {activeModal === 'join_queue' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>

          {/* â•â•â•â•â•â•â•â• Ã‰TAPE : TRAITEMENT EN COURS â•â•â•â•â•â•â•â• */}
          {payStep === 'processing' && (
            <div style={{ maxWidth: '420px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', margin: 'auto', padding: '3rem 2rem', textAlign: 'center' }}>
              <style>{`
                @keyframes spinPay { to { transform: rotate(360deg); } }
                @keyframes pulsePay { 0%,100%{opacity:1} 50%{opacity:0.4} }
              `}</style>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `${getProviderInfo(paymentProvider).bgColor}`, border: `3px solid ${getProviderInfo(paymentProvider).color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', position: 'relative' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: `3px solid transparent`, borderTopColor: getProviderInfo(paymentProvider).color, position: 'absolute', top: '-3px', left: '-3px', animation: 'spinPay 1s linear infinite' }} />
                <img src={getProviderInfo(paymentProvider).logo} alt="" style={{ width: '44px', height: '32px', objectFit: 'contain' }} />
              </div>
              <h5 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem' }}>Traitement en cours...</h5>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', animation: 'pulsePay 1.5s ease-in-out infinite' }}>
                En attente de confirmation {getProviderInfo(paymentProvider).name}<br/>
                <strong style={{ color: getProviderInfo(paymentProvider).color }}>Ne fermez pas cette fenÃªtre</strong>
              </p>
              <div style={{ marginTop: '1.5rem', background: 'var(--bg-card-subtle)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Montant</span>
                <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>2â€¯500 FCFA</span>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-sub)', opacity: 0.6 }}>ðŸ”’ Transaction sÃ©curisÃ©e â€¢ Conforme BCEAO</p>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â• Ã‰TAPE : SUCCÃˆS â•â•â•â•â•â•â•â• */}
          {payStep === 'success' && txnResult && (
            <div style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 30px 80px rgba(16,185,129,0.2)', margin: 'auto', overflow: 'hidden' }}>
              {/* En-tÃªte succÃ¨s */}
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', padding: '2rem', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.3)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>âœ…</div>
                <h4 style={{ color: '#ffffff', fontWeight: '800', margin: '0 0 0.25rem' }}>Paiement ConfirmÃ© !</h4>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: 0 }}>Vous Ãªtes en salle d'attente virtuelle</p>
              </div>
              {/* ReÃ§u */}
              <div style={{ padding: '1.5rem 2rem' }}>
                {/* RÃ©fÃ©rence */}
                <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>RÃ©fÃ©rence Transaction</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '800', color: '#10b981', letterSpacing: '0.08em' }}>{txnResult.transactionRef}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>{new Date(txnResult.timestamp).toLocaleString('fr-FR')}</div>
                </div>
                {/* DÃ©tails paiement */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                  {[{l:'OpÃ©rateur', v: getProviderInfo(paymentProvider).name},{l:'TÃ©lÃ©phone', v: txnResult.phone},{l:'Montant payÃ©', v: '2â€¯500 FCFA'},{l:'Position file', v: `NÂ°${txnResult.positionNum}`}].map(item => (
                    <div key={item.l} style={{ background: 'var(--bg-card-subtle)', borderRadius: '10px', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: '600' }}>{item.l}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.15rem' }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                {/* MÃ©decin */}
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <img src={selectedDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180'} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>MÃ©decin assignÃ©</div>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{selectedDoctor?.name || 'Dr. Ousmane Sow'}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.55rem', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.35)', whiteSpace: 'nowrap' }}>Prise en charge 80%</span>
                </div>
                <button
                  onClick={resetPaymentModal}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}
                >
                  âœ… Fermer et rejoindre la salle d'attente
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '0.75rem', opacity: 0.6 }}>Conservez la rÃ©fÃ©rence {txnResult.transactionRef} comme preuve de paiement</p>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â• Ã‰TAPE : ERREUR â•â•â•â•â•â•â•â• */}
          {payStep === 'error' && txnResult && (
            <div style={{ maxWidth: '420px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 30px 80px rgba(239,68,68,0.15)', margin: 'auto', padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem' }}>âŒ</div>
              <h5 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem' }}>Paiement Ã©chouÃ©</h5>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{txnResult.message}</p>
              <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Causes possibles :</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.7' }}>
                  <li>Solde insuffisant sur votre compte</li>
                  <li>NumÃ©ro de tÃ©lÃ©phone incorrect</li>
                  <li>Connexion rÃ©seau instable</li>
                  <li>Plafond journalier atteint</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={resetPaymentModal}
                  style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >Annuler</button>
                <button onClick={() => setPayStep('form')}
                  style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.35)' }}
                >ðŸ”„ RÃ©essayer</button>
              </div>
            </div>
          )}

          {/* â•â•â•â•â•â•â•â• Ã‰TAPE : FORMULAIRE â•â•â•â•â•â•â•â• */}
          {payStep === 'form' && (
            <div style={{ maxWidth: '600px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', margin: 'auto' }}>
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', padding: '1.75rem 2rem', borderRadius: '28px 28px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>TÃ©lÃ©mÃ©decine UNAMUSC</div>
{/* SÃ©lecteur de parcours. Les deux voies sont prÃ©sentÃ©es cÃ´te Ã 
                        cÃ´te AVANT tout formulaire : l'assurÃ© doit voir qu'il existe
                        une option gratuite, sinon il ne choisira que la voie
                        payante â€” celle qui Ã©tait proposÃ©e par dÃ©faut. */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setQueueMode('booking')}
                        style={{
                          textAlign: 'left', padding: '0.7rem 0.85rem', borderRadius: '12px', cursor: 'pointer',
                          border: queueMode === 'booking' ? '2px solid #6ee7b7' : '1px solid rgba(255,255,255,0.25)',
                          background: queueMode === 'booking' ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.08)',
                          color: '#ffffff'
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>ðŸ“… Rendez-vous</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>Gratuit Â· rÃ©glÃ© sur place</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQueueMode('live')}
                        style={{
                          textAlign: 'left', padding: '0.7rem 0.85rem', borderRadius: '12px', cursor: 'pointer',
                          border: queueMode === 'live' ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.25)',
                          background: queueMode === 'live' ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)',
                          color: '#ffffff'
                        }}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>âš¡ Consultation</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>ImmÃ©diate Â· ticket modÃ©rateur</div>
                      </button>
                    </div>
                    <h5 style={{ color: '#ffffff', fontWeight: '800', margin: '1rem 0 0', fontSize: '1.2rem' }}>
                      {queueMode === 'booking' ? 'ðŸ“… Prendre rendez-vous (gratuit)' : 'ðŸ¥ Entrer en salle dâ€™attente virtuelle'}
                    </h5>
                    <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
                      {queueMode === 'booking'
                        ? "Aucune somme n'est due pour prendre rendez-vous. Le rÃ¨glement se fait une seule fois, sur place, Ã  la structure."
                        : "Consultation en visioconfÃ©rence immÃ©diate. Le ticket modÃ©rateur est rÃ©glÃ© avant d'entrer en file."}
                    </p>
                  </div>
                  <button type="button" onClick={resetPaymentModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Ã—</button>
                </div>
                <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <img src={selectedDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180'} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.9rem' }}>{selectedDoctor?.name || 'Praticien non dÃ©signÃ©'}</div>
                    {(() => {
                      // Statut issu du heart-beat serveur, jamais un libellÃ© en dur.
                      const p = getPresenceFor(selectedDoctor?.name);
                      const label = !p
                        ? 'Statut inconnu'
                        : p.online
                          ? 'En ligne'
                          : p.declared_status === 'away'
                            ? 'En pause'
                            : 'Hors ligne';
                      const color = !p ? '#94a3b8' : p.online ? '#6ee7b7' : '#fca5a5';
                      return (
                        <>
                          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
                            {selectedDoctor?.specialty || 'SpÃ©cialitÃ© non renseignÃ©e'} â€¢ {label}
                          </div>
                          <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', color, padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid rgba(255,255,255,0.25)' }}>
                            {p?.online ? 'âš¡ En ligne' : label}
                          </span>
                        </>
                      );
                    })()}
                </div>
              </div>
</div>

            {/* Corps du formulaire. Les deux parcours (rendez-vous gratuit
                et consultation payante) partagent ces champs communes : motif
                et niveau d'urgence. Seul le bloc de validation diffÃ¨re. */}
            <div style={{ padding: '1.75rem 2rem' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>SymptÃ´mes &amp; motif de consultation *</label>
                  <textarea
                    style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    rows={3} value={consultReason} onChange={(e) => setConsultReason(e.target.value)}
                    placeholder="ExÂ : FiÃ¨vre, toux sÃ¨che, maux de tÃªte depuis 48h..." required
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Niveau d'urgence *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[{v:'routine',l:'ðŸŸ¢ Routine',s:'Consultation de routine'},{v:'medium',l:'ðŸŸ¡ ModÃ©rÃ©',s:'SymptÃ´mes modÃ©rÃ©s'},{v:'high',l:'ðŸŸ  Ã‰levÃ©',s:'Douleurs / fiÃ¨vre forte'},{v:'critical',l:'ðŸ”´ Urgence',s:'PrioritÃ© absolue'}].map(u => (
                      <button key={u.v} type="button" onClick={() => setUrgencyLevel(u.v)}
                        style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', border: urgencyLevel === u.v ? '2px solid #10b981' : '1px solid var(--border-color)', background: urgencyLevel === u.v ? 'rgba(16,185,129,0.15)' : 'var(--bg-card-subtle)', color: urgencyLevel === u.v ? '#10b981' : 'var(--text-sub)', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
                        <div>{u.l}</div><div style={{ fontSize: '0.7rem', fontWeight: '400', opacity: 0.7 }}>{u.s}</div>
                      </button>
                    ))}
                  </div>
                </div>
{/* â•â•â•â•â•â•â•â• PARCOURS RENDEZ-VOUS : aucun paiement â•â•â•â•â•â•â•â• */}
                {queueMode === 'booking' && (
                  <div>
                    {bookingResult ? (
                      <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>ðŸ“…</div>
                        <h5 style={{ color: 'var(--text-main)', fontWeight: '800', margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
                          Rendez-vous enregistrÃ©
                        </h5>
                        <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 1rem' }}>
                          Aucun paiement n'a Ã©tÃ© effectuÃ©. Le rÃ¨glement de la consultation
                          se fera une seule fois, sur place, Ã  la structure.
                        </p>
                        {bookingResult.appointment_date && (
                          <p style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: '700', margin: '0 0 0.5rem' }}>
                            {new Date(bookingResult.appointment_date).toLocaleString('fr-FR', {
                              dateStyle: 'full', timeStyle: 'short'
                            })}
                          </p>
                        )}
                        {bookingResult.qr_access_code && (
                          <p style={{ color: 'var(--text-sub)', fontSize: '0.78rem', margin: 0 }}>
                            Code de rendez-vous : <strong>{bookingResult.qr_access_code}</strong>
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={resetPaymentModal}
                          style={{ marginTop: '1.25rem', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.6rem 1.25rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          Fermer
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleBookAppointment}>
                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Date souhaitÃ©e *</label>
                          <input
                            type="date"
                            value={bookingDate}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setBookingDate(e.target.value)}
                            style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none' }}
                            required
                          />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>CrÃ©neau *</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {[
                              { v: 'matin', l: 'ðŸŒ… Matin', h: '9h00' },
                              { v: 'apres-midi', l: 'ðŸŒ¤ï¸ AprÃ¨s-midi', h: '14h00' }
                            ].map(slot => (
                              <button
                                key={slot.v}
                                type="button"
                                onClick={() => setBookingSlot(slot.v)}
                                style={{
                                  padding: '0.7rem 0.75rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                                  border: bookingSlot === slot.v ? '2px solid #10b981' : '1px solid var(--border-color)',
                                  background: bookingSlot === slot.v ? 'rgba(16,185,129,0.15)' : 'var(--bg-card-subtle)',
                                  color: bookingSlot === slot.v ? '#10b981' : 'var(--text-sub)'
                                }}
                              >
                                <div style={{ fontSize: '0.82rem', fontWeight: '700' }}>{slot.l}</div>
                                <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>{slot.h}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Motif de la consultation *</label>
                          <textarea
                            rows={3}
                            value={consultReason}
                            onChange={(e) => setConsultReason(e.target.value)}
                            placeholder="DÃ©crivez briÃ¨vement le motif de votre consultation..."
                            style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                            required
                          />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>PrÃ©cisions (facultatif)</label>
                          <input
                            type="text"
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            placeholder="Ex : suivi de tension, rÃ©sultats d'examens Ã  apporterâ€¦"
                            style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>

                        {bookingError && (
                          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', padding: '0.7rem 0.9rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#f87171' }}>
                            {bookingError}
                          </div>
                        )}

                        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.78rem', color: 'var(--text-sub)', lineHeight: '1.6' }}>
                          ðŸ’¡ Cette rÃ©servation est <strong>gratuite</strong>. Aucun ticket
                          modÃ©rateur n'est prÃ©levÃ© ici : vous rÃ©glerez la consultation
                          une seule fois, sur place, Ã  la structure de santÃ©.
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={resetPaymentModal}
                            style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.8rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                          >
                            Annuler
                          </button>
                          <button
                            type="submit"
                            disabled={bookingSubmitting}
                            style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.8rem', fontWeight: '700', fontSize: '0.88rem', cursor: bookingSubmitting ? 'wait' : 'pointer', opacity: bookingSubmitting ? 0.7 : 1, boxShadow: '0 4px 15px rgba(16,185,129,0.35)' }}
                          >
                            {bookingSubmitting ? 'Enregistrementâ€¦' : 'Confirmer le rendez-vous (gratuit)'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* â•â•â•â•â•â•â•â• PARCOURS CONSULTATION IMMÃ‰DIATE : paiement â•â•â•â•â•â•â•â• */}
                {queueMode === 'live' && (
                  <form onSubmit={handleJoinQueue}>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '0 0 1.25rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-0.6rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', padding: '0 0.75rem', fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>RÃ¨glement mobile money</span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.75rem' }}>Choisissez votre opÃ©rateur *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>

                    <button type="button" onClick={() => { setPaymentProvider('orange'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'orange' ? '2px solid #ff7900' : '1px solid var(--border-color)', background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', overflow: 'hidden' }}>
                        <img src="/logo_orange_money.png" alt="Orange Money" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'orange' ? '#ff7900' : 'var(--text-sub)', textAlign: 'center' }}>Orange Money</span>
                      {paymentProvider === 'orange' && <span style={{ fontSize: '0.62rem', color: '#ff7900', fontWeight: '800' }}>âœ“ SÃ©lectionnÃ©</span>}
                    </button>

                    <button type="button" onClick={() => { setPaymentProvider('wave'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'wave' ? '2px solid #1dc4ff' : '1px solid var(--border-color)', background: paymentProvider === 'wave' ? 'rgba(29,196,255,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo_wave.png" alt="Wave" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'wave' ? '#1dc4ff' : 'var(--text-sub)', textAlign: 'center' }}>Wave</span>
                      {paymentProvider === 'wave' && <span style={{ fontSize: '0.62rem', color: '#1dc4ff', fontWeight: '800' }}>âœ“ SÃ©lectionnÃ©</span>}
                    </button>

                    <button type="button" onClick={() => { setPaymentProvider('free'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'free' ? '2px solid #e11d48' : '1px solid var(--border-color)', background: paymentProvider === 'free' ? 'rgba(225,29,72,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', overflow: 'hidden' }}>
                        <img src="/logo_free_money.svg" alt="Free Money" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'free' ? '#e11d48' : 'var(--text-sub)', textAlign: 'center' }}>Free Money</span>
                      {paymentProvider === 'free' && <span style={{ fontSize: '0.62rem', color: '#e11d48', fontWeight: '800' }}>âœ“ SÃ©lectionnÃ©</span>}
                    </button>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>NÂ° de tÃ©lÃ©phone mobile money *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>ðŸ“±</span>
                    <input type="tel"
                      style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: phoneError ? '1px solid #ef4444' : '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.5rem', fontSize: '0.95rem', fontWeight: '700', outline: 'none', letterSpacing: '0.05em', boxSizing: 'border-box' }}
                      value={phoneNum} onChange={(e) => { setPhoneNum(e.target.value); setPhoneError(''); }}
                      placeholder="ExÂ : 77 602 67 83" required
                    />
                  </div>
                  {phoneError && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: '600' }}>âš ï¸ {phoneError}</p>}

                  <div style={{ marginTop: '1rem', background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.08)' : paymentProvider === 'wave' ? 'rgba(29,196,255,0.08)' : 'rgba(225,29,72,0.08)', border: `1px solid ${paymentProvider === 'orange' ? 'rgba(255,121,0,0.3)' : paymentProvider === 'wave' ? 'rgba(29,196,255,0.3)' : 'rgba(225,29,72,0.3)'}`, borderRadius: '12px', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)', fontWeight: '600' }}>Ticket modÃ©rateur (20%)</span>
                      <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)' }}>2â€¯500 FCFA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>Prise en charge UNAMUSC (80%)</span>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#10b981' }}>10â€¯000 FCFA couverts</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: '600' }}>Via {getProviderInfo(paymentProvider).name} â†’ {phoneNum || '---'}</span>
                      <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>ðŸ”’ SÃ©curisÃ©</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button"
                    style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }}
                    onClick={resetPaymentModal}>Annuler</button>
                  <button type="submit"
                    style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    ðŸ’³ Payer 2â€¯500 FCFA &amp; entrer en salle d'attente
                  </button>
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-sub)', marginTop: '0.85rem', opacity: 0.7 }}>ðŸ”’ Paiement sÃ©curisÃ© â€¢ Aucun partage de vos donnÃ©es bancaires â€¢ Conforme BCEAO</p>
              </form>
              )}
              </div>
            </div>
          )}

        </div>,
        document.body
      )}

      {/* WEBRTC LIVE SESSION MODAL WITH ADVANCED DUAL-PERSPECTIVE VIEW (ASSURÃ‰ VS MÃ‰DECIN), REAL-TIME WEBCAM & MIC */}
      {activeModal === 'webrtc' && createPortal((() => {
        // â”€â”€ IdentitÃ©s selon l'espace connectÃ© (doxy.me : chaque partie est dans SON espace) â”€â”€
        const isDoctorSide = consultationRole === 'doctor';
        const peerName = isDoctorSide
          ? (activePatient?.patient_name || `${activeFirstName} ${activeLastName}`)
          : activeDoctor.name;
        const peerCsu = activePatient?.cmu_number || activeCmuNumber;
        const peerInitials = (peerName || 'Patient CSU').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
        const isSearchingPeer = !peerConnected && peerWaiting && consultationSeconds < 6;

        return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(3, 7, 18, 0.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}>
          <style>{`
            @media (min-width: 769px) {
              .webrtc-modal-box {
                height: calc(100vh - 2rem) !important;
                border-radius: 20px !important;
                box-shadow: 0 30px 90px rgba(0,0,0,0.9) !important;
              }
            }
            @media (max-width: 768px) {
              .webrtc-body-container {
                flex-direction: column !important;
                flex-wrap: nowrap !important;
                overflow-y: hidden !important;
              }
              .webrtc-video-section {
                flex: 0 0 210px !important;
                min-height: 210px !important;
                max-height: 210px !important;
              }
              .webrtc-aside-panel {
                flex: 1 1 auto !important;
                max-width: 100% !important;
                border-left: none !important;
                border-top: 1px solid #1b2433 !important;
                min-height: 0 !important;
                overflow-y: hidden !important;
              }
              .webrtc-hide-mobile {
                display: none !important;
              }
              .webrtc-header-row {
                padding: 0.45rem 0.75rem !important;
              }
            }
          `}</style>
          <div className="webrtc-modal-box" style={{ maxWidth: '1320px', width: '100%', height: '100vh', background: '#0b0f17', color: '#ffffff', border: '1px solid #1b2433', display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 'auto' }}>

            {/* â•â•â• BARRE SUPÃ‰RIEURE â€” identitÃ© de la PARTIE DISTANTE (jamais la sienne) â•â•â• */}
            <header className="webrtc-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '1px solid #1b2433', background: 'linear-gradient(180deg, #0e1523 0%, #0b0f17 100%)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                {isDoctorSide ? (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.90rem', fontWeight: '900', color: '#ffffff', flexShrink: 0 }}>
                    {peerInitials}
                  </div>
                ) : (
                  <img
                    src={activeDoctor.avatar || '/dr_fatou_diop.png'}
                    alt={activeDoctor.name}
                    onError={(e) => { e.currentTarget.src = '/dr_fatou_diop.png'; }}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981', boxShadow: '0 0 14px rgba(16,185,129,0.45)', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <h6 style={{ margin: 0, fontWeight: '800', color: '#f8fafc', fontSize: '0.92rem', letterSpacing: '-0.01em' }}>
                      {isDoctorSide ? `ðŸ‘¤ Patient : ${peerName}` : `TÃ©lÃ©consultation HD â€” ${activeDoctor.name}`}
                    </h6>
                    <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '0.64rem', fontWeight: '800', padding: '2px 7px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }}></span>
                      DIRECT WebRTC
                    </span>
                  </div>
                  <small style={{ color: '#94a3b8', fontSize: '0.70rem', display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '560px' }}>
                    {isDoctorSide
                      ? <>NÂ° CSU : <strong style={{ color: '#f8fafc' }}>{peerCsu}</strong> â€¢ {activeDoctor.name} ({activeDoctor.cnom})</>
                      : <>{activeDoctor.specialty} â€¢ {activeDoctor.cnom} â€¢ AssurÃ©(e) : <strong style={{ color: '#f8fafc' }}>{activeFirstName} {activeLastName}</strong></>}
                  </small>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                <span style={{ background: '#1e293b', color: '#34d399', fontSize: '0.70rem', fontWeight: '800', padding: '3px 8px', borderRadius: '8px', border: '1px solid #334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  â±ï¸ {formatDuration(consultationSeconds)}
                </span>
                <span className="webrtc-hide-mobile" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.68rem', fontWeight: '700', padding: '3px 8px', borderRadius: '8px', border: '1px solid #334155' }}>
                  REC ðŸ”´
                </span>
                <span className="webrtc-hide-mobile" style={{ background: isDoctorSide ? 'rgba(2,132,199,0.15)' : 'rgba(16,185,129,0.12)', color: isDoctorSide ? '#38bdf8' : '#34d399', fontSize: '0.68rem', fontWeight: '800', padding: '3px 8px', borderRadius: '8px', border: `1px solid ${isDoctorSide ? 'rgba(56,189,248,0.4)' : 'rgba(16,185,129,0.4)'}` }}>
                  {isDoctorSide ? 'ðŸ©º Praticien' : 'ðŸ‘¤ AssurÃ©'}
                </span>
                <button
                  type="button"
                  title="Quitter la salle de tÃ©lÃ©consultation"
                  aria-label="Quitter la salle de tÃ©lÃ©consultation"
                  style={{
                    background: 'rgba(220,38,38,0.12)',
                    color: '#fca5a5',
                    border: '1.5px solid rgba(220,38,38,0.45)',
                    borderRadius: '10px',
                    padding: '0.45rem 0.9rem',
                    fontWeight: '800',
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    stopCamera();
                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                    setActiveModal(null);
                  }}
                >
                  âœ• Quitter
                </button>
              </div>
            </header>

            {/* â•â•â• CORPS â€” scÃ¨ne vidÃ©o HD + panneau dialogue & soins â•â•â• */}
            <div className="webrtc-body-container" style={{ flex: 1, display: 'flex', minHeight: 0, flexWrap: 'wrap', overflowY: 'auto' }}>

              {/* â”€â”€ SCÃˆNE PRINCIPALE VIDÃ‰O â”€â”€ */}
              <section className="webrtc-video-section" style={{ flex: '1 1 460px', position: 'relative', minHeight: '360px', overflow: 'hidden', background: 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)', borderRadius: '18px', margin: '0.75rem', border: '1px solid #1f2a3d', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

                {/* 1. VIDÃ‰O RÃ‰ELLE DISTANTE dÃ¨s que la liaison P2P bidirectionnelle est Ã©tablie */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#040d1a',
                    display: peerConnected ? 'block' : 'none',
                    zIndex: 3
                  }}
                />



                {/* 2. Ã‰CRAN DE VÃ‰RIFICATION PÃ‰RIPHÃ‰RIQUES (affichÃ© uniquement si la camÃ©ra est explicitement Ã©teinte ou non initialisÃ©e) */}
                {!peerConnected && !cameraActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 14,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '1.5rem', textAlign: 'center',
                    background: 'linear-gradient(160deg, #020617 0%, #0a1526 60%, #0d1b2e 100%)'
                  }}>

                    {/* Carte d'identitÃ© du praticien / patient */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(2,6,23,0.92)', border: '1px solid #334155', borderRadius: '14px', padding: '0.5rem 0.95rem', backdropFilter: 'blur(8px)', marginBottom: '1.1rem', maxWidth: '92%' }}>
                      {isDoctorSide ? (
                        <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '900', color: '#ffffff', flexShrink: 0 }}>{peerInitials}</span>
                      ) : (
                        <img src={activeDoctor.avatar || '/dr_fatou_diop.png'} alt={activeDoctor.name} onError={(e) => { e.currentTarget.src = '/dr_fatou_diop.png'; }} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981', flexShrink: 0 }} />
                      )}
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isDoctorSide ? `ðŸ‘¤ ${peerName}` : `ðŸ©º ${activeDoctor.name}`}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isSearchingPeer ? '#fbbf24' : '#94a3b8', fontWeight: '700' }}>
                          {isSearchingPeer
                            ? "ðŸ“¡ Recherche de l'autre espaceâ€¦"
                            : `â³ En attente du ${isDoctorSide ? 'patient' : 'praticien'} â€¢ ${isDoctorSide ? peerCsu : activeDoctor.specialty}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ maxWidth: '410px' }}>
                      <span style={{ fontSize: '2.3rem', display: 'block', marginBottom: '6px' }}>ðŸŽ¥</span>
                      <strong style={{ display: 'block', color: '#f8fafc', fontSize: '0.98rem' }}>
                        DÃ©marrer la consultation vidÃ©o
                      </strong>
                      <small style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginTop: '5px', lineHeight: 1.55 }}>
                        {isDoctorSide
                          ? 'Votre flux vidÃ©o occupera tout cet Ã©cran et sera transmis au patient dÃ¨s qu\'il rejoindra son espace assurÃ©.'
                          : 'Votre flux vidÃ©o occupera tout cet Ã©cran et sera transmis au mÃ©decin traitant en direct.'}
                      </small>
                      <button 
                        type="button" 
                        onClick={() => startCamera(true)} 
                        style={{ marginTop: '14px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.4rem', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.45)' }}
                      >
                        ðŸ“· Allumer la camÃ©ra & micro
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Overlays supÃ©rieurs : badge direct + Ã©tat de la liaison P2P */}
                <div style={{ position: 'relative', zIndex: 10, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: peerConnected ? '#10b981' : (isDoctorSide ? '#38bdf8' : '#10b981'), boxShadow: '0 0 10px currentColor', display: 'inline-block', animation: 'pulse 1.6s infinite' }} />
                    <span style={{ background: 'rgba(5, 46, 22, 0.85)', color: '#34d399', border: '1px solid #10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                      {isDoctorSide ? 'ðŸ‘¤ Patient en consultation' : `ðŸ©º ${activeDoctor.name}`}
                    </span>
                  </div>
                  {peerConnected ? (
                    <span style={{ background: 'rgba(5, 46, 22, 0.9)', color: '#34d399', border: '1px solid #10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                      ðŸ”— Liaison vidÃ©o P2P bidirectionnelle Ã©tablie
                    </span>
                  ) : isSearchingPeer ? (
                    <span style={{ background: 'rgba(120, 53, 15, 0.9)', color: '#fbbf24', border: '1px solid #f59e0b', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                      ðŸ“¡ Recherche de l'autre espaceâ€¦
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#94a3b8', border: '1px solid #334155', padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '600', backdropFilter: 'blur(6px)' }}>
                      ðŸ”’ Flux mÃ©dical chiffrÃ© E2EE
                    </span>
                  )}
                  {!isDoctorSide && isDoctorSpeaking && (
                    <span style={{ background: '#f59e0b', color: '#000000', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', animation: 'pulse 1s infinite' }}>
                      ðŸŽ™ï¸ Le Dr. vous parle...
                    </span>
                  )}
                </div>

                {/* 4. AUTO-VUE (sa propre camÃ©ra) â€” PLEIN CADRE tant que l'autre partie
                       n'est pas connectÃ©e, puis rÃ©trÃ©cit en fenÃªtre PiP DÃ‰PLAÃ‡ABLE */}
                <div
                  onPointerDown={peerConnected ? handlePipPointerDown : undefined}
                  onPointerMove={peerConnected ? handlePipPointerMove : undefined}
                  onPointerUp={peerConnected ? handlePipPointerUp : undefined}
                  onDoubleClick={peerConnected ? (() => setPipPos(null)) : undefined}
                  title={peerConnected ? 'Glisser pour dÃ©placer â€¢ Double-clic pour rÃ©initialiser' : 'Votre camÃ©ra â€” en direct'}
                  style={{
                    position: 'absolute', zIndex: peerConnected ? 12 : 2,
                    overflow: 'hidden', background: '#020617', touchAction: 'none', userSelect: 'none',
                    ...(peerConnected
                      ? {
                          ...(pipPos ? { left: `${pipPos.x}px`, top: `${pipPos.y}px` } : { right: '14px', bottom: isDoctorSide ? '60px' : '14px' }),
                          width: `${PIP_W}px`, aspectRatio: '16 / 9',
                          borderRadius: '14px',
                          border: `2px solid ${isDoctorSide ? '#38bdf8' : '#10b981'}`,
                          boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
                          cursor: 'grab'
                        }
                      : {
                          top: 0, left: 0, width: '100%', height: '100%',
                          borderRadius: 0, border: 'none', boxShadow: 'none',
                          cursor: 'default'
                        })
                  }}
                >
                  {peerConnected && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4, display: 'flex', justifyContent: 'center', padding: '3px 0', background: 'linear-gradient(180deg, rgba(2,6,23,0.75) 0%, transparent 100%)', pointerEvents: 'none' }}>
                      <span style={{ letterSpacing: '2px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)' }}>â ¿â ¿</span>
                    </div>
                  )}
                  
                  {/* Flux VidÃ©o RÃ©el */}
                  <video
                    ref={userVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      objectFit: 'cover', transform: 'scaleX(-1)',
                      display: (isWebcamConnected && !useSimulatedFeed && !isCamOff) ? 'block' : 'none'
                    }}
                  />

                  {/* Flux VidÃ©o Canvas Dynamique (Mobile HD / Fallback) */}
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={360}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      objectFit: 'cover',
                      display: (useSimulatedFeed && !isCamOff) ? 'block' : 'none'
                    }}
                  />

                  {/* Ã‰tat CamÃ©ra CoupÃ©e */}
                  {isCamOff && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#020617', zIndex: 5 }}>
                      <span style={{ fontSize: '2rem', opacity: 0.6 }}>ðŸš«</span>
                      <small style={{ color: '#ef4444', fontWeight: '800', fontSize: '0.78rem', marginTop: '4px' }}>CamÃ©ra dÃ©sactivÃ©e</small>
                    </div>
                  )}

                  {/* Bouton de rÃ©activation rapide si la camÃ©ra est coupÃ©e */}
                  {isCamOff && (
                    <button
                      type="button"
                      onClick={toggleCamera}
                      style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', zIndex: 6 }}
                    >
                      ðŸ“¹ RÃ©activer la camÃ©ra
                    </button>
                  )}

                  {peerConnected && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(2, 6, 23, 0.88)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', zIndex: 6 }}>
                      <span style={{ fontSize: '0.62rem', color: '#f8fafc', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isDoctorSide ? 'ðŸ©º Ma camÃ©ra (Praticien)' : 'ðŸ‘¤ Ma camÃ©ra (AssurÃ©)'}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: isMuted ? '#ef4444' : '#34d399', fontWeight: '800', flexShrink: 0 }}>
                        {isMuted ? 'ðŸ”‡' : `ðŸŽ™ï¸ ${micVolume}%`}
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. HUD constantes vitales â€” cÃ´tÃ© PRATICIEN uniquement (monitoring) */}
                {isDoctorSide ? (
                  <div style={{ position: 'relative', zIndex: 10, background: 'rgba(2, 6, 23, 0.92)', backdropFilter: 'blur(10px)', padding: '8px 14px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid rgba(56,189,248,0.35)', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {telemetryVitals.bpm == null && telemetryVitals.bp == null && telemetryVitals.spo2 == null && telemetryVitals.temp == null ? (
                      <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '700' }}>
                        ðŸ“‰ Aucune constante transmise â€” les valeurs n'apparaissent ici que si un dispositif de mesure les envoie
                      </span>
                    ) : (
                      <>
                        {telemetryVitals.bpm != null && <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: '800' }}>ðŸ’š {telemetryVitals.bpm} BPM</div>}
                        {telemetryVitals.bp != null && <div style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: '800' }}>ðŸ©¸ TA: {telemetryVitals.bp}</div>}
                        {telemetryVitals.spo2 != null && <div style={{ fontSize: '0.76rem', color: '#a7f3d0', fontWeight: '800' }}>ðŸ« SpO2: {telemetryVitals.spo2}%</div>}
                        {telemetryVitals.temp != null && <div style={{ fontSize: '0.76rem', color: '#fde047', fontWeight: '800' }}>ðŸŒ¡ï¸ {telemetryVitals.temp}Â°C</div>}
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative', zIndex: 10, background: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(10px)', padding: '7px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid rgba(16,185,129,0.35)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700' }}>ðŸ”’ TÃ©lÃ©mÃ©trie mÃ©dicale synchronisÃ©e en direct â€¢ Transmission chiffrÃ©e E2EE</span>
                  </div>
                )}
              </section>

              {/* â”€â”€ PANNEAU LATÃ‰RAL â€” outils propres Ã  CHAQUE espace â”€â”€ */}
              <aside className="webrtc-aside-panel" style={{ flex: '1 1 380px', maxWidth: '480px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1b2433', background: '#0e1523', minHeight: 0 }}>

                {/* Notice d'accÃ¨s camÃ©ra (affichÃ©e uniquement si Ã©chec ou connexion en cours) */}
                {cameraStatus === 'connecting' && (
                  <div style={{ margin: '0.6rem 0.7rem', padding: '0.65rem', background: 'rgba(2, 6, 23, 0.9)', borderRadius: '12px', border: '1px solid #334155', textAlign: 'center' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isDoctorSide ? '#38bdf8' : '#34d399', boxShadow: '0 0 14px currentColor', margin: '0 auto 6px', animation: 'pulse 0.9s infinite' }} />
                    <strong style={{ display: 'block', color: '#f8fafc', fontSize: '0.80rem' }}>Connexion de votre camÃ©raâ€¦</strong>
                  </div>
                )}

                {/* Onglets de consultation */}
                <div style={{ display: 'flex', gap: '0.6rem', padding: '0.6rem 0.7rem 0', flexWrap: 'wrap', borderBottom: '1px solid #1b2433' }}>
                  <button
                    type="button"
                    style={{
                      background: activeCallTab === 'chat' ? '#059669' : '#1e293b',
                      color: '#ffffff',
                      border: activeCallTab === 'chat' ? '1.5px solid #10b981' : '1px solid #334155',
                      borderRadius: '8px', padding: '0.4rem 0.8rem', fontWeight: '800', fontSize: '0.74rem', cursor: 'pointer'
                    }}
                    onClick={() => setActiveCallTab('chat')}
                  >
                    ðŸ’¬ Dialogue
                  </button>
                  <button
                    type="button"
                    style={{
                      background: activeCallTab === 'vitals' ? '#059669' : '#1e293b',
                      color: '#ffffff',
                      border: activeCallTab === 'vitals' ? '1.5px solid #10b981' : '1px solid #334155',
                      borderRadius: '8px', padding: '0.4rem 0.8rem', fontWeight: '800', fontSize: '0.74rem', cursor: 'pointer'
                    }}
                    onClick={() => setActiveCallTab('vitals')}
                  >
                    {isDoctorSide ? 'ðŸ©º Dossier patient' : 'ðŸ©º Dossier CSU'}
                  </button>
                  {!isDoctorSide && (
                    <button
                      type="button"
                      style={{
                        background: activeCallTab === 'rx' ? '#059669' : '#1e293b',
                        color: '#ffffff',
                        border: activeCallTab === 'rx' ? '1.5px solid #10b981' : '1px solid #334155',
                        borderRadius: '8px', padding: '0.4rem 0.8rem', fontWeight: '800', fontSize: '0.74rem', cursor: 'pointer'
                      }}
                      onClick={() => setActiveCallTab('rx')}
                    >
                      ðŸ’Š Ordonnance 50%
                    </button>
                  )}
                </div>

                {/* Contenu des onglets */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.7rem' }}>

                  {/* TAB 1 : DIALOGUE */}
                  {activeCallTab === 'chat' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ flex: 1, minHeight: '150px', overflowY: 'auto', background: '#040812', borderRadius: '12px', padding: '0.75rem', border: '1px solid #1e293b', marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {chatMessages.map((msg, i) => (
                          <div
                            key={i}
                            style={{
                              alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                              maxWidth: '82%',
                              background: msg.isUser ? '#0284c7' : '#1e293b',
                              color: '#ffffff',
                              borderRadius: msg.isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              padding: '0.55rem 0.85rem',
                              fontSize: '0.82rem',
                              border: msg.isUser ? '1px solid #38bdf8' : '1px solid #334155'
                            }}
                          >
                            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: msg.isUser ? '#bae6fd' : '#34d399', marginBottom: '2px' }}>
                              {msg.sender}
                            </div>
                            <div style={{ lineHeight: '1.35' }}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {isDoctorTyping && (
                          <div style={{ alignSelf: 'flex-start', background: '#1e293b', color: '#94a3b8', borderRadius: '12px', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontStyle: 'italic', border: '1px solid #334155' }}>
                            Le {activeDoctor.name} rÃ©dige sa rÃ©ponse...
                          </div>
                        )}
                      </div>

                      {!isDoctorSide && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700' }}>SymptÃ´mes :</span>
                          {[
                            { icon: 'ðŸŒ¡ï¸', text: "J'ai une forte fiÃ¨vre et des frissons depuis hier." },
                            { icon: 'ðŸ˜·', text: "J'ai une toux sÃ¨che avec des douleurs Ã  la gorge." },
                            { icon: 'ðŸ¤•', text: "J'ai des maux de tÃªte intenses et de la fatigue." },
                            { icon: 'ðŸ’Š', text: 'Je souhaite renouveler mon ordonnance mÃ©dicale habituelle.' }
                          ].map((symptom, idx) => (
                            <button
                              key={idx}
                              type="button"
                              style={{
                                background: '#1e293b', color: '#ffffff', border: '1px solid #475569',
                                borderRadius: '16px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: '700',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.borderColor = '#10b981'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.borderColor = '#475569'; }}
                              onClick={() => handleSendMessage(null, symptom.text)}
                            >
                              <span>{symptom.icon}</span>
                              <span>{symptom.text.split(' ')[2] || symptom.text.substring(0, 18)}...</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder={isDoctorSide ? "Ã‰crire au patientâ€¦" : "DÃ©crivez vos symptÃ´mes ou posez une question au mÃ©decin..."}
                          value={inputMsg}
                          onChange={(e) => setInputMsg(e.target.value)}
                          style={{
                            flex: 1, minWidth: 0, background: '#040812', color: '#ffffff',
                            border: '1.5px solid #334155', borderRadius: '10px', padding: '0.55rem 0.95rem',
                            fontSize: '0.82rem', outline: 'none'
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#10b981'; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = '#334155'; }}
                        />
                        <button
                          type="submit"
                          style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.55rem 1.2rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Envoyer âœ‰ï¸
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 2 : DOSSIER (patient cÃ´tÃ© praticien / droits CSU cÃ´tÃ© assurÃ©) */}
                  {activeCallTab === 'vitals' && (
                    <div style={{ background: '#040812', borderRadius: '12px', padding: '0.85rem', border: '1px solid #1e293b' }}>
                      {isDoctorSide && (
                        <div style={{ marginBottom: '0.65rem', padding: '0.65rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>Motif de consultation :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>{activePatient?.reason || 'Bilan de santÃ© & consultation gÃ©nÃ©rale'}</span>
                          {activePatient?.requested_doctor && (
                            <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', marginTop: '2px' }}>MÃ©decin demandÃ© : {activePatient.requested_doctor} â€¢ Ticket {activePatient.payment_status === 'paid' ? 'âœ… rÃ©glÃ©' : 'â³ impayÃ©'} ({activePatient.amount || 2500} F)</small>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                        <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>IdentitÃ© patient CSU :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>{peerName}</span>
                          <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>NÂ° CSU : {peerCsu}</small>
                        </div>
                        <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#34d399', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>Couverture assurance :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>50% Tiers-Payant UNAMUSC</span>
                          <small style={{ color: '#a7f3d0', display: 'block', fontSize: '0.72rem' }}>RÃ©gime : CSU Dakar Centre</small>
                        </div>
                        <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#fde047', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>AntÃ©cÃ©dents &amp; allergies :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>Aucune allergie connue</span>
                          <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>Groupe sanguin : O+</small>
                        </div>
                      </div>

                      {/* Panorama clinique temps rÃ©el â€” rÃ©servÃ© au PRATICIEN */}
                      {isDoctorSide && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', marginTop: '0.65rem' }}>
                          <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <strong style={{ color: '#a855f7', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>ðŸ“¡ Constantes tÃ©lÃ©mÃ©triques en direct :</strong>
                            <span style={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: '700', lineHeight: 1.6, display: 'block' }}>
                              ðŸ’š FC {telemetryVitals.bpm} bpm<br />
                              ðŸ©¸ TA {telemetryVitals.bp} mmHg<br />
                              ðŸ« SpO2 {telemetryVitals.spo2}% &nbsp;â€¢&nbsp; ðŸŒ¡ï¸ {telemetryVitals.temp}Â°C
                            </span>
                            <small style={{ color: '#64748b', fontSize: '0.68rem' }}>SynchronisÃ©es automatiquement dans le DMP CSU</small>
                          </div>
                          <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <strong style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>ðŸ’Š Traitements en cours :</strong>
                            {(() => {
                              try {
                                const raw = localStorage.getItem('cmu_purchase_orders');
                                const orders = raw ? JSON.parse(raw) : [];
                                const meds = orders.slice(0, 3).map((o, i) => `${i + 1}. ${o.order_code || 'Bon'} â€” ${(o.items || []).length || 1} article(s) pharmacie`);
                                return meds.length ? (
                                  <span style={{ color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.6, display: 'block' }}>{meds.join('\u00A0â€¢\u00A0')}</span>
                                ) : (
                                  <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Aucun bon de pharmacie actif â€” terrain vierge de traitement</small>
                                );
                              } catch (e) {
                                return <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Historique pharmacique indisponible</small>;
                              }
                            })()}
                            <small style={{ color: '#64748b', fontSize: '0.68rem', display: 'block', marginTop: '3px' }}>Source : bons de commande pharmacie CSU</small>
                          </div>
                          <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <strong style={{ color: '#34d399', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>ðŸ›¡ï¸ Droits &amp; niveau d'accÃ¨s :</strong>
                            <span style={{ color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.6, display: 'block' }}>
                              âœ… Dossier MÃ©dical PartagÃ© (DMP) CSU<br />
                              âœ… Prescription &amp; ordonnance Ã©lectronique 50%<br />
                              âœ… Certificats mÃ©dicaux &amp; demande d'examens<br />
                              âœ… TÃ©lÃ©mÃ©trie vitale &amp; imagerie DICOM
                            </span>
                            <small style={{ color: '#64748b', fontSize: '0.68rem' }}>Habilitation CNOM {activeDoctor.cnom} â€” accÃ¨s chiffrÃ© E2EE</small>
                          </div>
                        </div>
                      )}

                      {!isDoctorSide && setView && (
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                          <button
                            type="button"
                            style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer' }}
                            onClick={() => {
                              setActiveModal(null);
                              setView('guarantee_letters');
                            }}
                          >
                            ðŸ“„ Consulter mes lettres de garantie â€º
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3 : ORDONNANCE â€” cÃ´tÃ© ASSURÃ‰ uniquement */}
                  {activeCallTab === 'rx' && !isDoctorSide && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#040812', border: '1px solid #1e293b', borderRadius: '12px', padding: '0.85rem', fontSize: '0.82rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <div>
                        <strong style={{ color: '#34d399', display: 'block', marginBottom: '4px' }}>MÃ©dicaments prescrits par {activeDoctor.name} :</strong>
                        <span style={{ color: '#ffffff' }}>1. Amoxicilline 500mg (1 gÃ©lule 3x/jour â€” 7 jours)</span><br />
                        <span style={{ color: '#ffffff' }}>2. ParacÃ©tamol 1g (1 comprimÃ© si fiÃ¨vre ou douleur)</span><br />
                        <small style={{ color: '#94a3b8' }}>Prise en charge directe 50% synchronisÃ©e dans vos bons de commande pharmacie.</small>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.5rem 0.85rem', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                          onClick={handleDownloadPrescription}
                        >
                          ðŸ“¥ TÃ©lÃ©charger le reÃ§u PDF
                        </button>
                        {setView && (
                          <button
                            type="button"
                            style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.5rem 0.85rem', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                            onClick={() => {
                              setActiveModal(null);
                              setView('purchase_orders');
                            }}
                          >
                            ðŸ’Š Ouvrir dans mes bons de commande â€º
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </aside>
            </div>

            {/* â•â•â• DOCK DE CONTRÃ”LE â€” outils propres Ã  CHAQUE espace â•â•â• */}
{/* â•â•â• DOCK DE CONTRÃ”LE â€” barre doxy.me â•â•â•
                Une seule grammaire visuelle : boutons ronds, neutres par dÃ©faut,
                rouge quand l'action est coupÃ©e, infobulle au survol (title) et
                aria-label pour les lecteurs d'Ã©cran. Plus de libellÃ©s empilÃ©s sous
                chaque bouton qui surchargeaient la barre. */}
            <footer
              style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: '0.6rem', flexWrap: 'wrap',
                padding: '0.9rem 1rem',
                background: '#0b1220',
                borderTop: '1px solid #1f2a3d'
              }}
            >
              {/* Micro */}
              <button
                type="button"
                title={isMuted ? 'RÃ©activer le microphone' : 'Couper le microphone'}
                aria-label={isMuted ? 'RÃ©activer le microphone' : 'Couper le microphone'}
                onClick={toggleMute}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: isMuted ? '#dc2626' : '#1e293b',
                  color: '#ffffff',
                  border: isMuted ? '2px solid #ef4444' : '2px solid #334155',
                  fontSize: '1.25rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isMuted ? '0 6px 18px rgba(220,38,38,0.4)' : '0 6px 18px rgba(2,6,23,0.6)',
                  flexShrink: 0
                }}
              >
                {isMuted ? 'ðŸ”‡' : 'ðŸŽ™ï¸'}
              </button>

              {/* CamÃ©ra */}
              <button
                type="button"
                title={isCamOff ? 'Rallumer la camÃ©ra' : 'Couper la camÃ©ra'}
                aria-label={isCamOff ? 'Rallumer la camÃ©ra' : 'Couper la camÃ©ra'}
                onClick={toggleCamera}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: isCamOff ? '#dc2626' : '#1e293b',
                  color: '#ffffff',
                  border: isCamOff ? '2px solid #ef4444' : '2px solid #334155',
                  fontSize: '1.25rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isCamOff ? '0 6px 18px rgba(220,38,38,0.4)' : '0 6px 18px rgba(2,6,23,0.6)',
                  flexShrink: 0
                }}
              >
                {isCamOff ? 'ðŸš«' : 'ðŸ“¹'}
              </button>
{/* Voix du praticien â€” cÃ´tÃ© ASSURÃ‰ uniquement */}
              {!isDoctorSide && (
                <button
                  type="button"
                  title={voiceEnabled ? 'Couper la voix du praticien' : 'RÃ©activer la voix du praticien'}
                  aria-label={voiceEnabled ? 'Couper la voix du praticien' : 'RÃ©activer la voix du praticien'}
                  onClick={() => {
                    const next = !voiceEnabled;
                    setVoiceEnabled(next);
                    if (!next && 'speechSynthesis' in window) window.speechSynthesis.cancel();
                  }}
                  style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: voiceEnabled ? '#1e293b' : '#0f172a',
                    color: voiceEnabled ? '#34d399' : '#64748b',
                    border: '2px solid #334155',
                    fontSize: '1.25rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
                    flexShrink: 0
                  }}
                >
                  {voiceEnabled ? 'ðŸ”Š' : 'ðŸ”‡'}
                </button>
              )}

              {/* Actions cliniques â€” cÃ´tÃ© PRATICIEN uniquement */}
              {isDoctorSide && (
                <>
                  <span style={{ width: '1px', height: '34px', background: '#1f2a3d', margin: '0 0.35rem', flexShrink: 0 }} />

                  <button
                    type="button"
                    title="Ã‰mettre l'ordonnance et le bon de prise en charge 50%"
                    aria-label="Ã‰mettre l'ordonnance et le bon de prise en charge 50%"
                    onClick={() => {
                      handleDownloadPrescription();
                      setPrescriptionDelivered(true);
                    }}
                    style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: '#1e293b', color: '#10b981', border: '2px solid #334155',
                      fontSize: '1.25rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
                      flexShrink: 0
                    }}
                  >
                    ðŸ’Š
                  </button>

                  <button
                    type="button"
                    title="Ã‰tablir le certificat mÃ©dical officiel"
                    aria-label="Ã‰tablir le certificat mÃ©dical officiel"
                    onClick={() => {
                      handleDownloadCertificate();
                      setCertificateDelivered(true);
                    }}
                    style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: '#1e293b', color: '#38bdf8', border: '2px solid #334155',
                      fontSize: '1.25rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
                      flexShrink: 0
                    }}
                  >
                    ðŸ“„
                  </button>

                  <button
                    type="button"
                    title="Ã‰tablir une demande d'examens complÃ©mentaires (labo / imagerie)"
                    aria-label="Ã‰tablir une demande d'examens complÃ©mentaires"
                    onClick={handleDownloadLabOrder}
                    style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: '#1e293b', color: '#c084fc', border: '2px solid #334155',
                      fontSize: '1.25rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 6px 18px rgba(2,6,23,0.6)',
                      flexShrink: 0
                    }}
                  >
                    ðŸ§ª
                  </button>
                </>
              )}

              <span style={{ width: '1px', height: '34px', background: '#1f2a3d', margin: '0 0.35rem', flexShrink: 0 }} />

              {/* Raccrocher */}
              <button
                type="button"
                title="Terminer la tÃ©lÃ©consultation"
                aria-label="Terminer la tÃ©lÃ©consultation"
                onClick={() => {
                  stopCamera();
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                  setActiveModal(null);
                }}
                style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: '#dc2626', color: '#ffffff', border: 'none',
                  fontSize: '1.35rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(220,38,38,0.45)',
                  flexShrink: 0
                }}
              >
                ðŸ“´
              </button>
            </footer>

          </div>
        </div>
        );
      })(), document.body
      )}

      {/* QR CODE MODAL (React Portal â€” Centered on Screen) */}
      {activeModal === 'qr' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflow: 'hidden' }}>
          <div style={{ maxWidth: '440px', width: '92%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="d-flex justify-content-between align-items-center w-100 mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2" style={{ textTransform: 'none' }}>
                <span>ðŸ“²</span> QR code CSU assurÃ©
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>
            
            <p className="small text-muted mb-2 text-center" style={{ fontSize: '0.82rem' }}>PrÃ©sentez ce QR code lors de votre prise en charge mÃ©dicale ou en pharmacie agrÃ©Ã©e</p>

            <div className="p-3 bg-white rounded-4 border border-success d-flex align-items-center justify-content-center my-2 shadow-sm" style={{ width: '210px', height: '210px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${activeCmuNumber.replace('CMU-', 'CSU-')}`} alt="QR code CSU" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div className="my-3 px-3.5 py-2 rounded-3 border border-success text-center w-100" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
              <span className="fw-bold d-block" style={{ fontSize: '0.88rem', letterSpacing: '0.3px', textTransform: 'none' }}>
                NÂ° CSU TITULAIRE : <span className="fw-mono fs-6 text-success ms-1">{activeCmuNumber.replace('CMU-', 'CSU-')}</span>
              </span>
            </div>

            <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700', width: '100%', marginTop: '0.75rem', cursor: 'pointer', textTransform: 'none' }} onClick={() => setActiveModal(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}

      {/* PRESCRIPTION MODAL (React Portal â€” Centered on Screen) */}
      {activeModal === 'prescription' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(10, 15, 30, 0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflow: 'hidden' }}>
          <div style={{ maxWidth: '660px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.08)', margin: 'auto' }}>

            {/* â”€â”€ Header Banner â”€â”€ */}
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)', padding: '1.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', bottom: '-30px', left: '40%', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div className="d-flex justify-content-between align-items-start" style={{ position: 'relative', zIndex: 1 }}>
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>ðŸ’Š</div>
                    <div>
                      <h5 className="fw-bold mb-0" style={{ color: '#ffffff', fontSize: '1.1rem', textTransform: 'none', letterSpacing: '-0.01em' }}>Ordonnance mÃ©dicale certifiÃ©e</h5>
                      <small style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.72rem', fontWeight: 600 }}>UNAMUSC â€” RÃ©publique du SÃ©nÃ©gal ðŸ‡¸ðŸ‡³</small>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveModal(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.1rem', backdropFilter: 'blur(10px)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>âœ•</button>
              </div>
              {/* Status badge */}
              <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '5px 14px', position: 'relative', zIndex: 1 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
                <small style={{ color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em' }}>BON PHARMACIE 50% â€” VALIDE</small>
              </div>
            </div>

            {/* â”€â”€ Body Content â”€â”€ */}
            <div style={{ padding: '1.5rem 2rem 2rem' }}>

              {/* Doctor Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.25rem', padding: '1rem 1.15rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 700, boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>ðŸ©º</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', display: 'block', lineHeight: '1.3' }}>Dr. Ousmane Sow</strong>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>MÃ©decin gÃ©nÃ©raliste</small>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.68rem', display: 'block' }}>NÂ° CNOM</small>
                  <strong style={{ color: '#10b981', fontSize: '0.82rem', fontFamily: 'monospace', letterSpacing: '0.04em' }}>4522-SN</strong>
                </div>
              </div>

              {/* Patient Section */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem 1.15rem', borderRadius: '14px', border: '1px dashed rgba(16,185,129,0.35)', background: 'linear-gradient(135deg, rgba(16,185,129,0.04), rgba(5,150,105,0.02))' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '0.85rem' }}>ðŸ‘¤</span>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient(e) bÃ©nÃ©ficiaire</small>
                </div>
                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem', display: 'block', lineHeight: '1.3' }}>{activeFirstName} {activeLastName}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.65rem', display: 'block', marginBottom: '2px' }}>NÂ° CSU titulaire</small>
                    <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{activeCmuNumber.replace('CMU-', 'CSU-')}</span>
                  </div>
                </div>
              </div>

              {/* Medications Section */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span style={{ fontSize: '0.85rem' }}>ðŸ’Š</span>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>MÃ©dicaments prescrits & posologie</small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Medication 1 */}
                  <div style={{ padding: '0.9rem 1.1rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', transition: 'border-color 0.2s' }}>
                    <div className="d-flex align-items-start gap-3">
                      <div style={{ width: '30px', height: '30px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '0.78rem', fontWeight: 800, marginTop: '2px' }}>1</div>
                      <div style={{ flex: 1 }}>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>Amoxicilline 500mg</strong>
                          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)' }}>2 boÃ®tes</span>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>â±</span>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>1 gÃ©lule Ã— 3 fois/jour â€” pendant 7 jours</small>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Medication 2 */}
                  <div style={{ padding: '0.9rem 1.1rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', transition: 'border-color 0.2s' }}>
                    <div className="d-flex align-items-start gap-3">
                      <div style={{ width: '30px', height: '30px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '0.78rem', fontWeight: 800, marginTop: '2px' }}>2</div>
                      <div style={{ flex: 1 }}>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>ParacÃ©tamol 1g</strong>
                          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)' }}>1 boÃ®te</span>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>â±</span>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>1 comprimÃ© en cas de fiÃ¨vre (max 3/jour)</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <div style={{ padding: '1.15rem', borderRadius: '14px', border: '2px dashed rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.03), rgba(5,150,105,0.01))', marginBottom: '1.5rem' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ flexShrink: 0, padding: '8px', background: 'var(--bg-card-subtle)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('ORD-TELEMED-2026-9912')}&color=10b981&bgcolor=1e293b`} alt="QR Code Ordonnance" style={{ width: '76px', height: '76px', display: 'block', borderRadius: '6px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span style={{ fontSize: '0.85rem' }}>ðŸ“±</span>
<strong style={{ color: '#10b981', fontSize: '0.82rem' }}>QR Code tiers-payant pharmacie (50%)</strong>
                    </div>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem', lineHeight: '1.5', display: 'block' }}>
                      PrÃ©sentez ce QR code dans n'importe quelle pharmacie partenaire agrÃ©Ã©e du SÃ©nÃ©gal pour bÃ©nÃ©ficier de la prise en charge 50% UNAMUSC.
                    </small>
                    <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.65rem' }}>âœ…</span>
                      <small style={{ color: '#10b981', fontSize: '0.66rem', fontWeight: 700 }}>Ordonnance vÃ©rifiÃ©e & authentifiÃ©e</small>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.4rem', fontWeight: 700, cursor: 'pointer', textTransform: 'none', fontSize: '0.85rem', transition: 'all 0.2s' }} onClick={() => setActiveModal(null)} onMouseOver={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; }} onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-sub)'; }}>Fermer</button>
                <button type="button" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.6rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.35)', textTransform: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s, transform 0.15s' }} onClick={handleDownloadPrescription} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.45)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.35)'; }}>ðŸ“¥ TÃ©lÃ©charger l'ordonnance PDF officielle</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL AJOUT MÃ‰DECIN DE GARDE (UNION DÃ‰PARTEMENTALE) */}
      {activeModal === 'add_doctor' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>ðŸ‘¨â€âš•ï¸</span> Enregistrement d'un MÃ©decin de Garde
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-4">
              RÃ©servÃ© aux Agents d'Unions DÃ©partementales UNAMUSC. Ajoutez un praticien assermentÃ© au rÃ©seau rÃ©gional de garde.
            </p>

            <form onSubmit={handleAddDoctor}>
              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Nom Complet du MÃ©decin *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  placeholder="Ex: Dr. Mariama BÃ¢" 
                  value={newDocName} 
                  onChange={(e) => setNewDocName(e.target.value)} 
                  required 
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>SpÃ©cialitÃ© MÃ©dicale *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: PÃ©diatrie & NÃ©onatologie" 
                    value={newDocSpecialty} 
                    onChange={(e) => setNewDocSpecialty(e.target.value)} 
                    required 
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>CatÃ©gorie *</label>
                  <select 
                    className="form-select" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                  >
                    <option value="generaliste">MÃ©decine GÃ©nÃ©rale</option>
                    <option value="pediatrie">PÃ©diatrie</option>
                    <option value="cardio">Cardiologie</option>
                    <option value="gyneco">GynÃ©cologie</option>
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>NÂ° d'Ordre CNOM *</label>
                  <input 
                    type="text" 
                    className="form-control fw-mono" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: CNOM: 7812-SN" 
                    value={newDocCnom} 
                    onChange={(e) => setNewDocCnom(e.target.value)} 
                    required 
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Union DÃ©partementale / Secteur *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: Union DÃ©partementale Pikine" 
                    value={newDocDept} 
                    onChange={(e) => setNewDocDept(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Langues ParlÃ©es (sÃ©parÃ©es par virgules) *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  placeholder="Ex: FR, WO, PULAAR" 
                  value={newDocLangs} 
                  onChange={(e) => setNewDocLangs(e.target.value)} 
                  required 
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.65rem 1.25rem' }} onClick={() => setActiveModal(null)}>Annuler</button>
                <button type="submit" style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.5rem', fontWeight: '800' }}>
                  ðŸ’¾ Enregistrer le MÃ©decin dans le RÃ©seau
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL VÃ‰RIFICATION ACCRÃ‰DITATION CNOM */}
      {activeModal === 'cnom_info' && selectedCnomDoctor && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>ðŸ†”</span> AccrÃ©ditation Ordre des MÃ©decins ðŸ‡¸ðŸ‡³
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="text-center my-3">
              <img src={selectedCnomDoctor.avatar} onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }} alt={selectedCnomDoctor.name} style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'cover', border: '3px solid #10b981' }} />
              <h5 className="fw-bold mt-2 mb-0" style={{ color: 'var(--text-main)' }}>{selectedCnomDoctor.name}</h5>
              <span className="badge bg-success-subtle text-success border border-success px-3 py-1 mt-1" style={{ borderRadius: '12px' }}>
                {selectedCnomDoctor.specialty}
              </span>
            </div>

            <div className="p-3 rounded-4 mb-3 border border-success" style={{ background: 'var(--bg-card-subtle)', fontSize: '0.85rem' }}>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">NÂ° Ordre des MÃ©decins :</span>
                <strong className="text-success fw-mono">{selectedCnomDoctor.cnom}</strong>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">Statut d'Assermentation :</span>
                <span className="badge bg-success text-white">â— Praticien AgrÃ©Ã© & ValidÃ©</span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">Secteur / Union :</span>
                <strong>{selectedCnomDoctor.department || 'Dakar Centre'}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted fw-semibold">Langues de Consultation :</span>
                <strong>{selectedCnomDoctor.langs.join(', ')}</strong>
              </div>
            </div>

            <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700', width: '100%', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL RÃ‰SEAU DES MÃ‰DECINS ACCRÃ‰DITÃ‰S CNOM */}
      {activeModal === 'all_doctors' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.75rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '840px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '28px', padding: '2.5rem', border: '1.5px solid rgba(59, 130, 246, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.85)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(59,130,246,0.4)' }}>
                  ðŸ‘¨â€âš•ï¸
                </div>
                <div>
                  <h4 className="fw-extrabold mb-1 text-primary" style={{ fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
                    Annuaire RÃ©gional des {doctorsList.length} SpÃ©cialistes CNOM
                  </h4>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.84rem' }}>
                    Conseil National de l'Ordre des MÃ©decins du SÃ©nÃ©gal â€¢ Garde H24 TÃ©lÃ©mÃ©decine ðŸ‡¸ðŸ‡³
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            <div className="row g-3 my-2">
              {doctorsList.map((doc) => (
                <div key={doc.id} className="col-md-6">
                  <div className="p-3.5 rounded-4 border transition-all d-flex align-items-center justify-content-between gap-2" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)' }}>
                    <div className="d-flex align-items-center gap-3">
                      <img src={doc.avatar} onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }} alt={doc.name} style={{ width: '54px', height: '54px', borderRadius: '16px', objectFit: 'cover', border: '2px solid #3b82f6' }} />
                      <div>
                        <strong className="d-block text-primary" style={{ fontSize: '0.96rem' }}>{doc.name}</strong>
                        <small className="text-muted d-block fw-semibold" style={{ fontSize: '0.78rem' }}>{doc.specialty}</small>
                        <span className="badge bg-success-subtle text-success border border-success mt-1" style={{ fontSize: '0.68rem', borderRadius: '6px' }}>
                          â— {doc.cnom}
                        </span>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      style={{ background: '#3b82f6', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.55rem 1rem', fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setActiveModal('join_queue');
                      }}
                    >
                      Consulter
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="d-flex justify-content-end mt-4 pt-2 border-top" style={{ borderColor: 'var(--border-color)' }}>
              <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 2rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => setActiveModal(null)}>
                Fermer l'annuaire
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOAST DE NOTIFICATION (Portal centrÃ© en haut Ã  droite) */}
      {notifToast && createPortal(
        <div
          onClick={() => setNotifToast(null)}
          style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999999,
            maxWidth: '400px', width: '100%',
            animation: 'slideInToast 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards',
            cursor: 'pointer'
          }}
        >
          <style>{`
            @keyframes slideInToast {
              from { opacity: 0; transform: translateX(120%) scale(0.85); }
              to   { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes toastProgress {
              from { width: 100%; }
              to   { width: 0%; }
            }
          `}</style>
          <div style={{
            background: notifToast.type === 'success'
              ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
              : 'linear-gradient(135deg, #78350f 0%, #92400e 100%)',
            borderRadius: '20px',
            padding: '1.25rem 1.5rem 0.75rem 1.5rem',
            boxShadow: notifToast.type === 'success'
              ? '0 20px 60px rgba(16,185,129,0.45), 0 4px 20px rgba(0,0,0,0.4)'
              : '0 20px 60px rgba(245,158,11,0.4), 0 4px 20px rgba(0,0,0,0.4)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Barre de progression */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: '3px',
              background: notifToast.type === 'success' ? '#10b981' : '#f59e0b',
              borderRadius: '0 0 20px 20px',
              animation: 'toastProgress 5s linear forwards'
            }} />

            {/* Contenu */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
              {/* IcÃ´ne */}
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
                background: notifToast.type === 'success'
                  ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.6rem', border: notifToast.type === 'success'
                  ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(245,158,11,0.4)'
              }}>
                {notifToast.icon}
              </div>
              {/* Texte */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: '800', fontSize: '1rem', color: '#ffffff',
                  marginBottom: '0.3rem', letterSpacing: '-0.01em'
                }}>
                  {notifToast.title}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5' }}>
                  {notifToast.message}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.4rem' }}>
                  ðŸ”Š Message vocal diffusÃ© â€¢ Cliquez pour fermer
                </div>
              </div>
              {/* Bouton fermer */}
              <button
                onClick={(e) => { e.stopPropagation(); setNotifToast(null); }}
                style={{
                  background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                  borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer',
                  fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >âœ•</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 1: DÃ‰TAILS RÃ‰PARTITION TÃ‰LÃ‰MÃ‰DECINE DYNAMIQUE */}
      {activeModal === 'kpi_telemed_details' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', color: 'var(--text-main, #0f172a)', borderRadius: '28px', padding: '2rem 2.25rem', border: '1.5px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', flexShrink: 0 }}>
                  ðŸ’»
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h4 className="fw-extrabold mb-0" style={{ color: '#059669', fontSize: '1.30rem', letterSpacing: '-0.02em' }}>
                      RÃ©partition RÃ©gionale des {queue.filter(q => q.status === 'called' || q.status === 'done').length} tÃ©lÃ©consultation(s) enregistrÃ©e(s)
                    </h4>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold px-2 py-0.5" style={{ fontSize: '0.70rem' }}>
                      En direct
                    </span>
                  </div>
                  <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem' }}>
                    RÃ©seau national certifiÃ© CNOM & Convention CSU UNAMUSC ðŸ‡¸ðŸ‡³
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            <p style={{ color: 'var(--text-sub, #475569)', fontSize: '0.88rem', lineHeight: 1.6 }} className="mb-4">
              Le service de tÃ©lÃ©mÃ©decine UNAMUSC assure une couverture mÃ©dicale continue 24h/24 et 7j/7 pour l'ensemble des assurÃ©s sociaux des 14 rÃ©gions du SÃ©nÃ©gal, Ã©liminant les dÃ©serts mÃ©dicaux.
            </p>

            {/* RÃ©partition rÃ©gionale : AUCUNE DONNÃ‰E SOUCHE.
                Auparavant, 420 consultations Ã©taient inventÃ©es puis
                rÃ©parties en 50 / 20 / 13 / 10 / 7 % sur cinq zones â€” des
                pourcentages posÃ©s Ã  la main, sans aucun enregistrement de
                tÃ©lÃ©consultation. Le tableau ci-dessous ne montre donc que
                les zones couvertes, avec un effectif rÃ©ellement comptÃ©. */}
            {(() => {
              const doneCount = queue.filter(q => q.status === 'called' || q.status === 'done').length;
              const regionalData = [
                { region: 'Dakar MÃ©tropole (Plateau, Pikine, GuÃ©diawaye, Rufisque, Keur Massar)', count: doneCount, color: '#10b981', hospitals: 'CHU Fann, HÃ´pital Principal, Dalal Jamm' },
                { region: 'RÃ©gion de ThiÃ¨s & Mbour (Petite CÃ´te & Plateau)', count: 0, color: '#3b82f6', hospitals: 'HÃ´pital RÃ©gional de ThiÃ¨s, EPS Mbour' },
                { region: 'RÃ©gion de Saint-Louis & VallÃ©e du Fleuve', count: 0, color: '#f59e0b', hospitals: 'CHR Saint-Louis, District Richard-Toll' },
                { region: 'Kaolack, Fatick & Diourbel (Bassin Arachidier)', count: 0, color: '#a855f7', hospitals: 'CHR Kaolack, EPS Heinrich LÃ¼bke' },
                { region: 'Ziguinchor, Kolda & Tambacounda (Casamance & SÃ©nÃ©gal Oriental)', count: 0, color: '#ec4899', hospitals: 'CHR Ziguinchor, CHR Tambacounda' }
              ];

              return (
                <div className="d-flex flex-column gap-3 mb-4">
                  {regionalData.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-4 transition-all"
                      style={{
                        background: 'var(--bg-card-subtle, #f8fafc)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderLeft: `4px solid ${item.color}`
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start mb-2 flex-wrap gap-2">
                        <div>
                          <strong style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.88rem' }}>ðŸ“ {item.region}</strong>
                          <div className="text-muted small mt-0.5" style={{ fontSize: '0.72rem' }}>
                            ðŸ¥ PÃ´les d'appui : {item.hospitals}
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge fw-extrabold px-2.5 py-1" style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}35`, fontSize: '0.80rem', borderRadius: '8px' }}>
                            {item.count} tÃ©lÃ©consultation{item.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {/* Barre proportionnelle Ã  l'effectif rÃ©el de la zone
                          (part de la file totale). Ã€ effectif nul, aucune
                          barre n'est affichÃ©e plutÃ´t qu'une barre Â« 0 % Â»
                          qui laisserait croire Ã  une mesure. */}
                      {item.count > 0 && (
                        <div className="progress" style={{ height: '7px', borderRadius: '6px', background: 'rgba(0,0,0,0.06)' }}>
                          <div className="progress-bar" style={{ width: `${Math.min(100, Math.round((item.count / Math.max(1, doneCount)) * 100))}%`, background: item.color, borderRadius: '6px' }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Performance & Box info */}
            <div className="p-3.5 rounded-4 mb-4 border" style={{ background: 'rgba(16, 185, 129, 0.06)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div className="d-flex align-items-center gap-2 text-success fw-extrabold mb-1" style={{ fontSize: '0.90rem' }}>
                <span>âš¡</span> Performance & Temps d'attente moyen :
              </div>
              <p className="mb-0" style={{ fontSize: '0.84rem', color: 'var(--text-sub, #475569)', lineHeight: 1.55 }}>
                Prise en charge moyenne en salle d'attente virtuelle : <strong>2 minutes 45 secondes</strong>. Transmission automatique de l'ordonnance sÃ©curisÃ©e Ã  la pharmacie partenaire la plus proche.
              </p>
            </div>

            <div className="d-flex justify-content-end">
              <button 
                type="button" 
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.70rem 1.8rem', fontWeight: '800', fontSize: '0.90rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }} 
                onClick={() => setActiveModal(null)}
              >
                Fermer la fenÃªtre
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: AVIS & SATISFACTION DES ASSURÃ‰S DYNAMIQUE */}
      {activeModal === 'kpi_satisfaction_details' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', color: 'var(--text-main, #0f172a)', borderRadius: '28px', padding: '2rem 2.25rem', border: '1.5px solid rgba(245, 158, 11, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(245,158,11,0.4)', flexShrink: 0 }}>
                  â­
                </div>
                <div>
                  <h4 className="fw-extrabold mb-0" style={{ color: '#d97706', fontSize: '1.30rem', letterSpacing: '-0.02em' }}>
                    Satisfaction & Avis CertifiÃ©s des AssurÃ©s
                  </h4>
                  <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem' }}>
                    Aucun avis certifiÃ© n'a encore Ã©tÃ© collectÃ© aprÃ¨s tÃ©lÃ©consultation
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            {/* Note & Jauge Principale */}
            <div className="text-center p-3.5 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(217, 119, 6, 0.03) 100%)', border: '1.5px solid rgba(245, 158, 11, 0.30)' }}>
              <div style={{ fontSize: '2.75rem', fontWeight: '900', color: '#d97706', lineHeight: 1 }}>â€”</div>
              <div className="fw-extrabold mt-1.5" style={{ fontSize: '1.05rem', color: '#d97706' }}>Note non encore Ã©tablie</div>
              <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.80rem' }}>Aucune donnÃ©e de satisfaction n'est enregistrÃ©e : aucune note moyenne ne peut Ãªtre calculÃ©e honnÃªtement.</small>
            </div>

            {/* Les filtres d'avis (Â« Tous Â», Â« â˜…â˜…â˜…â˜…â˜… (92%) Â», Â« Dakar Â», Â« RÃ©gions Â»)
                ont Ã©tÃ© retirÃ©s : la liste d'avis est vide, donc ces filtres
                ne filtrent plus rien. Le Â« (92%) Â» Ã©tait de surcroÃ®t un
                pourcentage de satisfaction sans aucune source derriÃ¨re â€”
                il ne survit pas Ã  la suppression des avis qu'il rÃ©sumait. */}

            {/* Liste des avis vÃ©rifiÃ©s */}
            <div className="d-flex flex-column gap-3 mb-4">
              {/* AUCUN avis. Ces quatre tÃ©moignages (Â« Awa Ndiaye Â»,
                  Â« Moussa Diallo Â»â€¦) Ã©taient Ã©crits en dur avec 5 Ã©toiles
                  chacun et le label Â« Avis certifiÃ© Tiers-Payant CSU Â» :
                  des patients inventÃ©s, avec des montants de rÃ¨glement et
                  une Â« ordonnance transmise Ã  ma pharmacie Â» â€” donc des
                  professionnels et des actes fictifs. Un avis fabriquÃ© sur
                  une plateforme de santÃ© est une pratique trompeuse, d'autant
                  plus qu'il est prÃ©sentÃ© comme certifiÃ©. Ils sont remplacÃ©s
                  par un Ã©tat vide ; la note moyenne au-dessus est dÃ©jÃ 
                  neutralisÃ©e de la mÃªme faÃ§on. */}
              <div
                className="p-4 rounded-4 text-center"
                style={{
                  background: 'var(--bg-card-subtle, #f8fafc)',
                  border: '1px dashed var(--border-color, #cbd5e1)',
                  borderRadius: '16px'
                }}
              >
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>ðŸ’¬</div>
                <strong className="d-block mb-1" style={{ fontSize: '0.92rem' }}>
                  Aucun avis publiÃ©
                </strong>
                <span className="d-block" style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                  Aucun retour d'expÃ©rience n'est enregistrÃ© pour l'instant. Les avis qui apparaÃ®tront ici devront provenir de patients rÃ©ellement consultÃ©s.
                </span>
              </div>
            </div>

            <div className="d-flex justify-content-end">
              <button 
                type="button" 
                style={{ background: '#d97706', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.70rem 1.8rem', fontWeight: '800', fontSize: '0.90rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(217,119,6,0.30)' }} 
                onClick={() => setActiveModal(null)}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: DÃ‰COMPOSITION TIERS-PAYANT UNAMUSC 80% AVEC SIMULATEUR DYNAMIQUE */}
      {activeModal === 'kpi_tierspayant_details' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', color: 'var(--text-main, #0f172a)', borderRadius: '28px', padding: '2rem 2.25rem', border: '1.5px solid rgba(168, 85, 247, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #7e22ce, #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(168,85,247,0.4)', flexShrink: 0 }}>
                  ðŸ’³
                </div>
                <div>
                  <h4 className="fw-extrabold mb-0" style={{ color: '#7e22ce', fontSize: '1.30rem', letterSpacing: '-0.02em' }}>
                    DÃ©composition du Tiers-Payant UNAMUSC (80%)
                  </h4>
                  <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem' }}>
                    Convention tarifaire de santÃ© publique au SÃ©nÃ©gal ðŸ‡¸ðŸ‡³
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            <p style={{ color: 'var(--text-sub, #475569)', fontSize: '0.88rem', lineHeight: 1.6 }} className="mb-3">
              GrÃ¢ce Ã  la convention nationale UNAMUSC, l'Agence de la Couverture SantÃ© Universelle prend en charge <strong>80% des honoraires de tÃ©lÃ©consultation spÃ©cialisÃ©e</strong> (20% Ã  la charge de l'assurÃ©).
            </p>

            {/* SÃ©lecteur de type d'acte dynamique */}
            <div className="mb-3">
              <label className="fw-bold small text-muted mb-1.5 d-block" style={{ fontSize: '0.78rem' }}>
                Choisissez un acte mÃ©dical pour simuler la prise en charge :
              </label>
              <div className="d-flex gap-2 flex-wrap">
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'generaliste' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('generaliste')}
                >
                  ðŸ©º GÃ©nÃ©raliste (7 500 F)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'specialiste' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('specialiste')}
                >
                  ðŸ‘¨â€âš•ï¸ SpÃ©cialiste CNOM (12 500 F)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'expertise' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('expertise')}
                >
                  ðŸ”¬ TÃ©lÃ©-expertise (20 000 F)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'maternite' ? 'btn-success' : 'btn-outline-success'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('maternite')}
                >
                  ðŸ¤° MaternitÃ© (100% Gratuit)
                </button>
              </div>
            </div>

            {/* Calcul dynamique du tarif */}
            {(() => {
              let totalFee = 12500;
              let rate = 80;
              let labelActe = "Consultation SpÃ©cialiste CNOM";

              if (selectedTarifType === 'generaliste') {
                totalFee = 7500;
                rate = 80;
                labelActe = "Consultation MÃ©decine GÃ©nÃ©rale";
              } else if (selectedTarifType === 'specialiste') {
                totalFee = 12500;
                rate = 80;
                labelActe = "Consultation MÃ©decin SpÃ©cialiste CNOM";
              } else if (selectedTarifType === 'expertise') {
                totalFee = 20000;
                rate = 80;
                labelActe = "Avis TÃ©lÃ©-expertise SpÃ©cialisÃ©e";
              } else if (selectedTarifType === 'maternite') {
                totalFee = 10000;
                rate = 100;
                labelActe = "TÃ©lÃ©consultation MaternitÃ© & Suivi Grossesse";
              }

              const unamuscShare = Math.round(totalFee * (rate / 100));
              const patientShare = totalFee - unamuscShare;

              return (
                <div className="table-responsive mb-4">
                  <table className="table align-middle" style={{ background: 'var(--bg-card-subtle, #f8fafc)', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)', overflow: 'hidden' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-sub, #475569)', fontSize: '0.88rem' }}>
                          Honoraires officiels ({labelActe}) :
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', textDecoration: 'line-through', color: 'var(--text-sub, #64748b)', textAlign: 'right', fontWeight: '700', fontSize: '0.95rem' }}>
                          {totalFee.toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#059669', fontSize: '0.90rem', fontWeight: '750' }}>
                          ðŸ›¡ï¸ Prise en charge officielle UNAMUSC ({rate}%) :
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#059669', textAlign: 'right', fontWeight: '900', fontSize: '1.15rem' }}>
                          - {unamuscShare.toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                      <tr style={{ borderTop: '2px solid var(--border-color, #e2e8f0)', background: 'rgba(168, 85, 247, 0.12)' }}>
                        <td style={{ padding: '1.1rem 1.25rem', color: '#6b21a8', fontSize: '0.95rem', fontWeight: '900' }}>
                          ðŸ’³ Reste Ã  charge patient (Ticket modÃ©rateur {100 - rate}%) :
                        </td>
                        <td style={{ padding: '1.1rem 1.25rem', color: '#6b21a8', textAlign: 'right', fontWeight: '900', fontSize: '1.40rem' }}>
                          {patientShare === 0 ? '0 FCFA (Gratuit)' : `${patientShare.toLocaleString('fr-FR')} FCFA`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
              <strong className="d-block mb-2" style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.84rem' }}>ðŸ“± Modes de rÃ¨glement instantanÃ©s (Tiers-Payant sans avance de frais) :</strong>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-primary px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.78rem' }}>ðŸŒŠ Wave Mobile Money (0% Frais)</span>
                <span className="badge bg-warning text-dark px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.78rem' }}>ðŸŠ Orange Money SÃ©nÃ©gal</span>
                <span className="badge bg-danger px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.78rem' }}>ðŸ”´ Free Money SÃ©nÃ©gal</span>
              </div>
            </div>

            <div className="d-flex justify-content-end">
              <button 
                type="button" 
                style={{ background: '#7e22ce', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.70rem 1.8rem', fontWeight: '800', fontSize: '0.90rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(126,34,206,0.30)' }} 
                onClick={() => setActiveModal(null)}
              >
                Compris, fermer
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
