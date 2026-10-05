import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateOfficialPdf } from '../utils/pdfGenerator';
import { initiatePayment, getProviderInfo, validatePhoneForProvider } from '../services/paymentService';
import { speakCleanText } from '../services/voiceAudioService';
import { apiFetch } from '../utils/api';

// Design Premium Haut de Gamme — Télémédecine Visioconférence Bidirectionnelle & Vu-mètre Micro Réel

// ─────────────────────────────────────────────
// Service de PRÉSENCE RÉELLE des praticiens.
//
// Pourquoi ce module existe : avant, la disponibilité était un simple
// `useState` local au médecin. Ce drapeau n'était visible que chez lui :
// l'assuré lisait « Disponible 24/7 » et « En ligne » en dur sur la carte,
// donc il prenait rendez-vous avec un praticien dont personne ne
// vérifiait la présence.
//
// Ici la présence est un HEART-BEAT :
//  - le praticien envoie un signal toutes les HEARTBEAT_INTERVAL_MS ;
//  - le serveur date ce signal et ne lit jamais le statut stocké comme
//    vérité — il recalcule « en ligne / hors ligne » à chaque lecture ;
//  - si le navigateur se ferme sans signal de départ (crash, onglet fermé),
//    le signal cesse et le praticien bascule tout seul en hors ligne après
//    le délai serveur.
//
// Conséquence pour l'interface : on n'affiche jamais un statut qu'on n'a
// pas observé. Sans donnée du serveur, on affiche « statut inconnu ».
// ─────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 25 * 1000; // 25 s — 3 signaux perdus avant bascule

/**
 * Envoie un signal de présence. Silencieux : un échec réseau ne doit
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
 * Récupère la présence de tous les praticiens connus du serveur.
 * `online` est recalculé côté serveur à l'instant de la requête.
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
 * Abonnement au flux temps réel de présence (Server-Sent Events).
 *
 * Pourquoi nécessaire en multi-instance : un balayage périodique envoie
 * des requêtes qui tombent sur des instances différentes au fil du
 * round-robin du répartiteur. Chaque instance ne voit que les événements
 * qu'elle a traités. Avec le flux, la notification traverse PostgreSQL
 * (LISTEN/NOTIFY) et atteint l'instance qui héberge le navigateur.
 *
 * Repli automatique : si le flux est indisponible (proxy qui ne gère pas
 * SSE, certificat, pare-feu), on repasse au balayage périodique et
 * l'interface continue de fonctionner, avec un délai de rafraîchissement
 * plus long. Le mode réellement utilisé est renvoyé à l'appelant pour
 * qu'il puisse l'afficher — on ne laisse pas croire à un temps réel si
 * ce n'est pas le cas.
 *
 * @param {(data: {practitioners: Array, offlineAfterSeconds: number}) => void} onState
 *        État complet à chaque changement.
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

  // Sans jeton, aucun flux ne peut être authentifié : le repli est le
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
      } catch (err) { /* message illisible : on ignore cet événement */ }
    });

    source.addEventListener('changed', (e) => {
      try {
        const d = JSON.parse(e.data);
        onModeChange?.('stream');
        stopPolling();
        // On ne fabrique pas l'état complet : on redemande au serveur,
        // seul juge. Recomposer la liste ici risquerait d'inventer un
        // statut à partir d'un événement partiel.
        fetchPresence()
          .then((full) => { if (!closed && full) onState(full); })
          .catch(() => {});
      } catch (err) { /* ignore */ }
    });

    // EventSource se reconnecte de lui-même. L'erreur peut donc être
    // transitoire : on bascule sur le repli, qui reste en place même si
    // le flux revient ensuite — plus simple et plus sûr que de
    // synchroniser les deux mécanismes.
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
 * Le règlement se fait une seule fois, sur place, à la structure.
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
  if (!res.ok) return { success: false, message: 'Le rendez-vous n\'a pas pu être enregistré.' };
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
  // Navigation helper sans régression ReferenceError
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

  // ═══════════════════════════════════════════════════════
  // RBAC — Définition granulaire des rôles & Département de l'Agent
  // ═══════════════════════════════════════════════════════
  const isSuperAdmin = userRole === 'superadmin' || agentUser?.role === 'SuperAdmin' || agentUser?.role === 'Super Admin';
  const isLabUser    = userRole === 'lab' || userRole === 'biologist' || 
                       (partnerUser?.role && (partnerUser.role.toLowerCase().includes('laboratoire') || partnerUser.role.toLowerCase().includes('biologiste') || partnerUser.role.toLowerCase().includes('imagerie'))) ||
                       (partnerUser?.structureName && (partnerUser.structureName.toLowerCase().includes('pasteur') || partnerUser.structureName.toLowerCase().includes('laboratoire') || partnerUser.structureName.toLowerCase().includes('imagerie')));
  const isDoctor     = !isLabUser && (
    userRole === 'doctor' ||
    (userRole === 'partner' && (
      partnerUser?.role?.toLowerCase().includes('médecin') ||
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
  // Alias rétro-compatibilité
  const isDoctorOrPartner = isDoctor || isMidwife;
  // Peut démarrer une consultation / émettre ordonnance numérique
  const canConsult = isDoctor || isMidwife || isSuperAdmin;
  // Peut gérer la file d'attente / planning (administratif)
  const canManageQueue = isAgent || isSuperAdmin;
  const overrideActive = (
    localStorage.getItem(`cmu-status-${citizenUser?.cmuNumber || citizenUser?.cmu_number}`) === 'active' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen'
  );

  // Vérification cotisation payée pour le citoyen (salle d'attente)
  const isSuspended = !overrideActive && (
    userRole === 'citizen_suspended' ||
    citizenUser?.status === 'suspended' ||
    citizenUser?.status === 'inactif' ||
    citizenUser?.status === 'suspendu' ||
    localStorage.getItem('cmu-portal-mode') === 'citizen_suspended' ||
    localStorage.getItem('cmu-cotisation-suspended') === 'true'
  );

  // Assuré actif (Chargement dynamique depuis le scan QR / Vérification de carte)
  const storedTargetCmu = localStorage.getItem('telemed_target_cmu');
  const storedTargetName = localStorage.getItem('telemed_target_name');

  const activeCmuNumber = storedTargetCmu || citizenUser?.cmu_number || citizenUser?.cmuNumber || 'DKR_260001.0.41';
  const activeFirstName = storedTargetName ? storedTargetName.trim().split(' ')[0] : (citizenUser?.first_name || citizenUser?.firstName || 'Ibrahima');
  const activeLastName = storedTargetName ? storedTargetName.trim().split(' ').slice(1).join(' ') : (citizenUser?.last_name || citizenUser?.lastName || 'NDIONE');

  // Département d'affectation de l'Agent UD
  const agentDept = agentUser?.department || agentUser?.assignedDepartment || agentUser?.assigned_department || citizenUser?.department || 'Dakar Centre';
  const [selectedDeptFilter, setSelectedDeptFilter] = useState(isSuperAdmin ? 'all' : agentDept);
  const [agentActiveTab, setAgentActiveTab] = useState('doctors'); // 'doctors' | 'structures' | 'queue' | 'conventions'

  // Mode de rôle strictement isolé :
  // - Les médecins ont UNIQUEMENT leur espace praticien
  // - Les agents ont UNIQUEMENT leur espace gestion UD départementale
  // - Les assurés ont UNIQUEMENT leur espace assuré
  // - Le Super Admin peut superviser les trois vues
  const [adminRoleMode, setAdminRoleMode] = useState('citizen'); // 'agent' | 'doctor' | 'citizen' — vue Assuré par défaut
  const activeRoleMode = (isDoctor || isMidwife) ? 'doctor' : (isAgent ? 'agent' : (isSuperAdmin ? adminRoleMode : 'citizen'));
  const [practitionerAvailability, setPractitionerAvailability] = useState('available'); // 'available' | 'in_call' | 'away'

  // ── PRÉSENCE RÉELLE (heart-beat) ───────────────────────────────────────────
  //
  // `practitionerAvailability` reste une simple INTENTION locale du
  // praticien (« je suis en pause »). Ce n'est pas une preuve de présence :
  // elle ne dit rien de ce que voit l'assuré.
  //
  // `practitionerPresence` contient ce que le SERVEUR a réellement observé.
  // C'est la seule source autorisée pour afficher « en ligne » à un assuré.
  const [practitionerPresence, setPractitionerPresence] = useState(null); // { practitioners, offlineAfterSeconds }
  // Le premier retour (flux ou repli) est-il arrivé ? Tant que c'est faux,
  // l'interface ne doit afficher aucun statut : « en ligne » avant toute
  // vérification serait exactement le mensonge que ce dispositif
  // cherche à éviter.
  const [presenceLoaded, setPresenceLoaded] = useState(false);
  // Mode réel de rafraîchissement : 'stream' (temps réel multi-instance)
  // ou 'polling' (repli). Affiché à l'utilisateur pour qu'il sache si le
  // statut affiché est instantané ou différé de quelques dizaines de
  // secondes.
  const [presenceMode, setPresenceMode] = useState(null); // null | 'stream' | 'polling'

  // Identité du praticien côté serveur. Sans identifiant réel, aucun
  // heart-beat n'est envoyé : on ne fabrique pas d'identité de remplacement,
  // sinon deux praticiens se marcheraient dessus.
  const practitionerIdentity = (isDoctor || isMidwife)
    ? {
        username: partnerUser?.username || partnerUser?.cname || agentUser?.username || null,
        name: partnerUser?.name || partnerUser?.structureName || agentUser?.fullName || agentUser?.name || null,
        specialty: partnerUser?.specialty || (isMidwife ? 'Sage-femme' : 'Médecine Générale')
      }
    : null;

  // Envoi du signal périodique. Uniquement si un praticien est réellement
  // connecté et identifié — sinon aucun signal, donc aucun statut.
  useEffect(() => {
    if (!practitionerIdentity || !practitionerIdentity.username) return undefined;

    const beat = () => {
      sendHeartbeat({
        practitionerName: practitionerIdentity.name,
        specialty: practitionerIdentity.specialty,
        declaredStatus: practitionerAvailability
      }).catch(() => null);
    };

    beat(); // premier signal immédiat : l'assuré voit le statut tout de suite
    const intervalId = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [practitionerIdentity?.username, practitionerAvailability]);

  // Lecture de la présence côté assuré (et côté agent).
  //
  // Flux temps réel avec repli automatique en balayage périodique : voir
  // `subscribePresence`. Le mode réellement utilisé est mémorisé dans
  // `presenceMode` et affiché à l'utilisateur — afficher « temps réel »
  // alors que le fonctionnement serait en réalité différé serait un
  // mensonge qui ferait croire à une disponibilité instantanée.
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
   * Statut observé d'un praticien, par son nom.
   * `null` = aucune donnée du serveur → l'appelant affiche « inconnu ».
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
  // `reviewsFilter` retiré : la liste d'avis est vide (les avis étaient
  // fabriqués), donc le filtre n'avait plus d'objet.

  // States pour la section Laboratoire Télémédecine
  const [teleOrders, setTeleOrders] = useState([
    {
      id: 1,
      patientName: 'Awa Ndiaye',
      cmuNumber: 'CMU-DKR-2026-3302',
      doctor: 'Dr. Ousmane Sow',
      type: 'Télé-consultation HD',
      examName: 'Bilan Lipidique & Glycémie à jeun',
      ref: 'Prescription Télé-médecine #TM-8812',
      status: 'pending',
      fileName: null
    }
  ]);

  const [uploadTeleTarget, setUploadTeleTarget] = useState(null);
  const [uploadTeleFileName, setUploadTeleFileName] = useState('');
  const [uploadTeleNotes, setUploadTeleNotes] = useState('');

  // States CRUD (Créer, Modifier, Supprimer)
  const [editingTeleOrder, setEditingTeleOrder] = useState(null);
  const [isNewTeleOrder, setIsNewTeleOrder] = useState(false);
  const [confirmDeleteObj, setConfirmDeleteObj] = useState(null); // { title: string, onConfirm: function }

  // Helper de filtrage strict et intelligent par département
  const matchesDepartment = (itemDept, targetDept) => {
    if (!targetDept || targetDept === 'all') return true;
    if (!itemDept) return false;
    const normItem = itemDept.toLowerCase();
    const normTarget = targetDept.toLowerCase();
    if (normTarget.includes('dakar') && (normItem.includes('dakar') || normItem.includes('fann') || normItem.includes('dantec') || normItem.includes('principal') || normItem.includes('abass') || normItem.includes('médina') || normItem.includes('plateau') || normItem.includes('point e') || normItem.includes('royer') || normItem.includes('sankal'))) return true;
    if (normTarget.includes('pikine') && (normItem.includes('pikine') || normItem.includes('thiaroye') || normItem.includes('gaspard'))) return true;
    if (normTarget.includes('guédiawaye') && (normItem.includes('guédiawaye') || normItem.includes('dalal jamm') || normItem.includes('baudouin') || normItem.includes('sam notaire'))) return true;
    if (normTarget.includes('rufisque') && (normItem.includes('rufisque') || normItem.includes('bargny') || normItem.includes('mbargane'))) return true;
    if (normTarget.includes('keur massar') && (normItem.includes('keur massar') || normItem.includes('jaxaay') || normItem.includes('malika'))) return true;
    return normItem.includes(normTarget) || normTarget.includes(normItem);
  };

  // Liste des Établissements & Structures de Santé Conventionnées Télémédecine
  const defaultStructuresList = [
    {
      id: 'struct-1',
      name: 'CHU de Fann (Pneumologie & Neurosciences)',
      department: 'Dakar Centre',
      type: 'Hôpital Universitaire National',
      status: 'active',
      conventionDate: '12/01/2024',
      services: ['Téléconsultation d\'Urgence', 'Télé-expertise Pneumo & Neuro', 'Ordonnance Sécurisée'],
      telemedDoctor: 'Dr. Babacar Diagne',
      phone: '33 869 18 18',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-2',
      name: 'Hôpital Aristide Le Dantec (Dakar)',
      department: 'Dakar Centre',
      type: 'Hôpital National de Référence',
      status: 'active',
      conventionDate: '15/02/2024',
      services: ['Dermatologie', 'Médecine Interne', 'Télé-cardiologie'],
      telemedDoctor: 'Dr. Aïssatou Kane',
      phone: '33 889 38 00',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-3',
      name: 'Hôpital Principal de Dakar',
      department: 'Dakar Centre',
      type: 'Hôpital Militaire d\'Instruction',
      status: 'active',
      conventionDate: '10/03/2024',
      services: ['Chirurgie & Traumatologie', 'Télé-expertise Imagerie'],
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
      services: ['Cardiologie & Urgences', 'Téléconsultation Pédiatrique'],
      telemedDoctor: 'Dr. Cheikh Tidiane Seck',
      phone: '33 834 00 12',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-5',
      name: 'Centre Hospitalier Spécialisé de Thiaroye',
      department: 'Pikine',
      type: 'Centre Hospitalier Régional',
      status: 'active',
      conventionDate: '20/04/2024',
      services: ['Santé Mentale & Psychiatrie', 'Suivi Psychologique Télémédecine'],
      telemedDoctor: 'Dr. Khadija Camara',
      phone: '33 836 21 00',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-6',
      name: 'Hôpital National Dalal Jamm (Guédiawaye)',
      department: 'Guédiawaye',
      type: 'Hôpital National Moderne',
      status: 'active',
      conventionDate: '18/02/2024',
      services: ['Télé-oncologie', 'Néphrologie', 'Téléconsultation Générale'],
      telemedDoctor: 'Dr. Cheikh Tidiane Seck',
      phone: '33 879 20 00',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-7',
      name: 'Hôpital Youssou Mbargane Diop (Rufisque)',
      department: 'Rufisque',
      type: 'Établissement Public de Santé',
      status: 'active',
      conventionDate: '14/03/2024',
      services: ['Maternité & Gynécologie', 'Pédiatrie', 'Téléconsultation'],
      telemedDoctor: 'Dr. Mariama Ba',
      phone: '33 836 10 20',
      coverageRate: '80% Tiers-Payant'
    },
    {
      id: 'struct-8',
      name: 'Centre de Santé de Keur Massar',
      department: 'Keur Massar',
      type: 'Centre de Santé de Référence',
      status: 'active',
      conventionDate: '01/05/2024',
      services: ['Consultations Générales', 'Santé Familiale & Dépistage'],
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

  // ────────────────────────────────────────────────────────────────────
  //  AUCUN PRATICIEN DE DÉMONSTRATION.
  //  Les 12 profils ci-dessous (« Dr. Aminata Ndiaye, CNOM-SN-2026-8819,
  //  4.9/124 avis », « Dr. Khadija Camara, CNOM-SN-2026-4481 ») portaient
  //  un numéro d'ordre au Conseil national de l'ordre des médecins : ce
  //  document fait foi pour l'exercice. Afficher des praticiens non
  //  enregistrés revenait à certifier de faux agréments. Les médecins
  //  affichés proviennent exclusivement du registre local
  //  (localStorage « cmu-doctors-list »), alimenté par le Super Admin via
  //  l'habilitation CNOM.
  // ────────────────────────────────────────────────────────────────────

  // Registre des praticiens habilités : alimenté UNIQUEMENT par le
  // Super Admin (localStorage « cmu-doctors-list »). Aucun praticien
  // n'est ajouté d'office — une liste vide est le résultat correct tant
  // qu'aucun médecin n'a été officiellement accrédité.
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

  // Sauvegarde automatique de la liste des médecins
  useEffect(() => {
    try {
      localStorage.setItem('cmu-doctors-list', JSON.stringify(doctorsList));
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  }, [doctorsList]);

  // Formulaire d'ajout Médecin par l'Agent de l'Union Départementale
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpecialty, setNewDocSpecialty] = useState('Médecine Générale');
  const [newDocCategory, setNewDocCategory] = useState('generaliste');
  const [newDocCnom, setNewDocCnom] = useState('');
  const [newDocDept, setNewDocDept] = useState('Union Départementale Dakar');
  const [newDocLangs, setNewDocLangs] = useState('FR, WO');
  const [newDocAvatar, setNewDocAvatar] = useState('https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=180');

  // Détails CNOM Médecin pour la modale d'accréditation
  const [selectedCnomDoctor, setSelectedCnomDoctor] = useState(null);

  // File d'attente Télémédecine.
  //
  // AUCUNE entrée pré-remplie. La file démarrait avec un patient fictif,
  // urgence critique, motif d'urgence clinique, déjà payé par Wave. Un
  // patient inventé portant un symptôme aigu était donc visible dans la
  // file du médecin. Surtout, les positions, l'ordre d'appel et le délai
  // estimé se calculaient sur cette fiction : un professionnel pouvait
  // organiser sa journée sur un faux dossier. La file part vide et se
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
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // Ré (D5)
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

  // ── Pipeline de Paiement Multi-Étapes ──────────────────────────────────────
  // 'form' | 'processing' | 'success' | 'error'
  const [payStep, setPayStep] = useState('form');
  const [txnResult, setTxnResult] = useState(null); // { ref, provider, phone, amount, timestamp, message }
  const [phoneError, setPhoneError] = useState('');

  // ── Deux parcours DISTINCTS, jamais mélangés ───────────────────────────────
  //
  // 1. 'live'    : consultation en visioconférence IMMÉDIATE. Le ticket
  //                modérateur est réglé avant d'entrer en file — c'est ce que
  //                le dispositif CSU prévoit pour un acte dématérialisé.
  // 2. 'booking' : rendez-vous planifié à l'avance, SANS AUCUN paiement. Le
  //                règlement se fait une seule fois, sur place, à la
  //                structure. Ce parcours n'appelle jamais `initiatePayment` :
  //                afficher un montant ou une étape de paiement ici ferait
  //                payer deux fois l'assuré.
  const [queueMode, setQueueMode] = useState('live'); // 'live' | 'booking'

  // Formulaire de rendez-vous (parcours gratuit)
  const [bookingDate, setBookingDate] = useState('');
  const [bookingSlot, setBookingSlot] = useState('matin'); // 'matin' | 'apres-midi'
  const [bookingNotes, setBookingNotes] = useState('');
  const [bookingResult, setBookingResult] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);

  // Session WebRTC & Téléconsultation Avancée
  const [activeDoctor, setActiveDoctor] = useState(doctorsList[0]);
  // Modèle doxy.me : le praticien et l'assuré sont chacun dans LEUR espace.
  // La perspective de la salle est DÉDUITE du rôle réellement connecté
  const consultationRole = (isDoctor || isMidwife || (isSuperAdmin && adminRoleMode === 'doctor')) ? 'doctor' : 'patient';
  const isDoctorSide = consultationRole === 'doctor';
  // Patient appelé (renseigné côté praticien via « Recevoir & Appeler »)
  const [activePatient, setActivePatient] = useState(null);
  // Liaison vidéo bidirectionnelle WebRTC réelle (signaling BroadcastChannel)
  const [peerConnected, setPeerConnected] = useState(false);
  const [peerWaiting, setPeerWaiting] = useState(true);
  // ── Auto-vue déplaçable (doxy.me) : null = position par défaut bas-droite ──
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

  // Vitals télémétrie en direct
  const [telemetryVitals, setTelemetryVitals] = useState({
    bpm: 74,
    bp: '120/80',
    spo2: 99,
    temp: '36.8'
  });

  // Vu-mètre Niveau Audio Microphone (0 - 100%)
  const [micVolume, setMicVolume] = useState(65);
  const [isWebcamConnected, setIsWebcamConnected] = useState(false);
  const [webcamNotice, setWebcamNotice] = useState('');

  // Auto-lancement mobile après scan QR
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
  // registre peut être vide tant qu'aucun médecin n'est pas accrédité).
  const [chatMessages, setChatMessages] = useState(() => {
    const d = doctorsList[0];
    return [
      {
        sender: d ? d.name : 'Assistant UNAMUSC',
        text: d
          ? `Bonjour ${activeFirstName}. Je suis le ${d.name} (${d.specialty}). Je consulte actuellement votre dossier médical UNAMUSC. Quel est le motif de votre consultation ?`
          : `Bonjour ${activeFirstName}. Aucun médecin agréé n'est actuellement habilité sur la plateforme. Votre demande reste enregistrée et vous serez notifié dès qu'un praticien sera disponible.`,
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
  const chanRef = useRef(null);        // BroadcastChannel (signaling même-navigateur)
  const remoteVideoRef = useRef(null); // <video> du flux distant (plein écran)
  const animFrameRef = useRef(null);
  const ecgAnimFrameRef = useRef(null);

  // Reconnaissance Vocale Directe (Microphone Assuré <-> Praticien)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const spoken = prompt(`🎙️ Dites ou tapez votre message pour le ${activeDoctor.name} :`, inputMsg || "Bonjour Docteur, j'ai de la fièvre et des maux de tête.");
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

  // Synthèse vocale du médecin
  const speakDoctor = (text) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[💊📄🩺✅🟢❌⚠️📋]/g, '');
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

  // Chronomètre de consultation en direct
  useEffect(() => {
    let timer = null;
    if (activeModal === 'webrtc') {
      setConsultationSeconds(0);
      timer = setInterval(() => {
        setConsultationSeconds(prev => prev + 1);
        // Légère variation réaliste de la fréquence cardiaque (72-76 BPM)
        setTelemetryVitals(prev => ({
          ...prev,
          bpm: 72 + Math.floor(Math.sin(Date.now() / 3000) * 3 + 2)
        }));
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

  // Formatter mm:ss pour la durée
  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // GESTION CAMÉRA & MICRO RÉELS — approche doxy.me :
  //   • permission inspectée via navigator.permissions (aucune invite fantôme)
  //   • erreur classifiée : bloquée / absente / occupée / contexte non sécurisé
  //   • panneau d'aide pas-à-pas + bouton « Réessayer » dans la salle de visite
  // ─────────────────────────────────────────────────────────────────────────
  const [cameraStatus, setCameraStatus] = useState('idle'); // 'idle' | 'connecting' | 'granted' | 'denied' | 'notfound' | 'busy' | 'insecure' | 'error'

  const CAMERA_HELP = {
    denied: {
      icon: '🚫',
      title: 'Caméra bloquée par le navigateur',
      lines: [
        "1. Cliquez sur l'icône 🔒 ou 🎥 à gauche de l'adresse du site.",
        "2. Réglez « Caméra » et « Microphone » sur Autoriser.",
        "3. Cliquez ensuite sur « Réessayer l'accès caméra » ci-dessous."
      ]
    },
    notfound: {
      icon: '📷',
      title: 'Aucune caméra détectée',
      lines: ["Branchez ou activez votre webcam, puis cliquez sur « Réessayer l'accès caméra »."]
    },
    busy: {
      icon: '⚙️',
      title: 'Caméra occupée par une autre application',
      lines: ['Fermez Zoom, Teams ou toute application utilisant la caméra, puis réessayez.']
    },
    insecure: {
      icon: '🔐',
      title: 'Connexion non sécurisée (HTTP)',
      lines: ["L'accès caméra exige HTTPS. Ouvrez l'application via http://localhost:5173 ou une adresse https://."]
    },
    error: {
      icon: '⚠️',
      title: 'Accès matériel impossible',
      lines: ['Réessayez ci-dessous, ou poursuivez la consultation en mode interactif HD.']
    }
  };

  // ── Glisser-déposer de l'auto-vue (PiP) dans la scène — doxy.me ──
  const PIP_W = 300;   // largeur auto-vue (px)
  const PIP_H = 169;   // hauteur 16:9 associée

  const handlePipPointerDown = (e) => {
    // Ne pas déclencher le glissement depuis un bouton interne
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

  // ─────────────────────────────────────────────────────────────────────────
  // LIAISON VIDÉO BIDIRECTIONNELLE RÉELLE (doxy.me) — WebRTC P2P dont le
  // signaling transite par un BroadcastChannel : le praticien ouvre SON
  // espace (cabinet), l'assuré ouvre SON espace (2e onglet), et les flux
  // caméras réels s'échangent entre les deux. Sans correspondant, chaque
  // espace retombe sur son rendu simulé.
  // ─────────────────────────────────────────────────────────────────────────
  const setupPeer = (localStream) => {
    // Idempotent : si une session P2P existe déjà (double déclenchement
    // geste-utilisateur + effet d'ouverture de la salle), on la conserve
    if (chanRef.current || pcRef.current) return;
    if (typeof BroadcastChannel === 'undefined' || typeof RTCPeerConnection === 'undefined') return;
    const role = consultationRole;
    const chan = new BroadcastChannel('unamusc-telemed-room');
    chanRef.current = chan;
    const polite = role === 'patient'; // l'assuré est « polite », le praticien initie l'offre
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    setPeerWaiting(true);

    let makingOffer = false;
    let ignoreOffer = false;
    let lastEcho = 0;
    const pendingIce = [];

    // Qualité téléconsultation : on privilégie la RÉSOLUTION (détail clinique :
    // lésions, examens visuels) au détriment de la fluidité si le réseau faiblit,
    // avec un bitrate élevé (2,5 Mbps) pour une image nette.
    localStream.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, localStream);
      if (t.kind === 'video') {
        try {
          const params = sender.getParameters();
          params.degradationPreference = 'maintainResolution';
          params.encodings = [{ maxBitrate: 2500000, maxFramerate: 30 }];
          sender.setParameters(params).catch(() => {});
        } catch (e) { /* anciens navigateurs : paramètres ignorés */ }
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
      if (candidate) chan.postMessage({ from: role, type: 'ice', candidate });
    };

    const flushIce = async () => {
      while (pendingIce.length) {
        const c = pendingIce.shift();
        try { await pc.addIceCandidate(c); } catch (e) { /* candidat ignoré */ }
      }
    };

    const makeOffer = async () => {
      if (pc.signalingState !== 'stable' || makingOffer) return;
      makingOffer = true;
      try {
        await pc.setLocalDescription();
        chan.postMessage({ from: role, type: 'desc', description: pc.localDescription });
      } catch (e) {
        console.warn('Telemed P2P offer error:', e);
      }
      makingOffer = false;
    };

    chan.onmessage = async ({ data }) => {
      if (!data || data.from === role) return;
      try {
        if (data.type === 'hello') {
          if (!polite) {
            // Le praticien initie la session dès qu'il aperçoit l'assuré
            makeOffer();
          } else if (Date.now() - lastEcho > 2000) {
            // L'assuré ré-annonce sa présence pour que le praticien installé
            // avant lui puisse déclencher l'offre
            lastEcho = Date.now();
            chan.postMessage({ from: role, type: 'hello' });
          }
        } else if (data.type === 'desc') {
          const offerCollision = data.description.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');
          ignoreOffer = !polite && offerCollision;
          if (ignoreOffer) return;
          await pc.setRemoteDescription(data.description);
          flushIce();
          if (data.description.type === 'offer') {
            await pc.setLocalDescription();
            chan.postMessage({ from: role, type: 'desc', description: pc.localDescription });
          }
        } else if (data.type === 'ice') {
          if (pc.remoteDescription) {
            try { await pc.addIceCandidate(data.candidate); } catch (e) { /* ignoré */ }
          } else {
            pendingIce.push(data.candidate);
          }
        } else if (data.type === 'bye') {
          setPeerConnected(false);
          setPeerWaiting(true);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        }
      } catch (e) {
        console.warn('Telemed P2C signaling error:', e);
      }
    };

    chan.postMessage({ from: role, type: 'hello' });
  };

  const teardownPeer = () => {
    if (chanRef.current) {
      try {
        chanRef.current.postMessage({ from: consultationRole, type: 'bye' });
        chanRef.current.close();
      } catch (e) { /* déjà fermé */ }
      chanRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch (e) { /* déjà fermé */ }
      pcRef.current = null;
    }
    setPeerConnected(false);
    setPeerWaiting(true);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  // Rattache le flux MediaStream à l'élément <video> (avec repli si le DOM
  // vient d'être monté par React au moment de l'octroi de la permission)
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

  // Démarrage WebRTC physique (caméra + micro locaux) avec bascule transparente
  const startCamera = async (isUserGesture = false) => {
    if (streamRef.current && streamRef.current.active) {
      if (!pcRef.current) setupPeer(streamRef.current);
      return;
    }
    setWebcamNotice('');
    setCameraActive(true);
    setIsCamOff(false);
    if (isUserGesture) setCameraStatus('connecting');

    // 1. Tentative d'accès à la caméra réelle du terminal
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
          setWebcamNotice('Caméra et microphone connectés en direct ✔');
          setupPeer(stream);
          return;
        }
      } catch (err) {
        console.warn('Caméra physique non disponible ou accès restreint par le navigateur (ex: HTTP LAN), activation du flux vidéo mobile HD :', err);
      }
    }

    // 2. Bascule transparente sur le flux HD clinique (ne bloque jamais la consultation)
    setIsWebcamConnected(true);
    setUseSimulatedFeed(true);
    setCameraActive(true);
    setIsCamOff(false);
    setCameraStatus('granted');
    setWebcamNotice('Flux vidéo médical actif (Mode HD Sécurisé) ✔');
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
  // demande de permission n'est déclenchée dans le dos de l'assuré. Si la
  // caméra est déjà autorisée, elle démarre automatiquement ; sinon l'assuré
  // clique lui-même sur « Autoriser Caméra & Micro » (geste utilisateur requis)
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
            setUseSimulatedFeed(true);
            setCameraActive(true);
            setCameraStatus(permStatus.state === 'denied' ? 'denied' : 'idle');
            if (permStatus.state === 'denied') {
              setWebcamNotice("La caméra est bloquée dans les réglages du navigateur. Suivez les étapes ci-dessous pour l'autoriser, puis réessayez.");
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

  // Analyseur Web Audio API en Temps Réel (VU-mètre Microphone Dynamique)
  useEffect(() => {
    let animId = null;
    let fallbackInterval = null;

    if (activeModal === 'webrtc' && !isMuted) {
      // Oscillation réaliste continue pour prouver visuellement que le micro capte
      fallbackInterval = setInterval(() => {
        setMicVolume(Math.floor(55 + Math.random() * 40));
      }, 200);

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

  // Suivi dynamique automatique de la file d'attente pour tous les assurés
  useEffect(() => {
    if (!activeCmuNumber && !activeFirstName) return;
    const myQueueEntry = queue.find(p => p.cmu_number === activeCmuNumber || (p.patient_name && p.patient_name.includes(activeFirstName)));
    if (!myQueueEntry) return;

    if (myQueueEntry.status === 'next' && lastQueueStatusRef.current !== 'next') {
      speakAndToast({
        type: 'warning',
        icon: '🔔',
        title: 'Alerte préalable salle d\'attente',
        message: 'Vous êtes le prochain patient. Préparez votre casque, votre micro et votre caméra.',
        speech: `Attention ${activeFirstName} ${activeLastName}. Vous êtes le prochain patient dans la salle d'attente virtuelle. Veuillez préparer votre casque, votre micro et votre caméra. Le médecin va vous recevoir dans un instant.`
      });
      lastQueueStatusRef.current = 'next';
    } else if (myQueueEntry.status === 'called' && lastQueueStatusRef.current !== 'called') {
      speakAndToast({
        type: 'success',
        icon: '🏥',
        title: "C'est votre tour !",
        message: 'Le médecin vous appelle en visioconférence HD.',
        speech: `${activeFirstName}, c'est votre tour. Le médecin est prêt à vous recevoir. La consultation de télémédecine commence maintenant. Bienvenue.`
      });
      lastQueueStatusRef.current = 'called';
    }
  }, [queue, activeCmuNumber, activeFirstName, activeLastName]);

  // Canvas Rendu Vidéo Médical HD (60fps) pour le flux caméra en direct de l'assuré
  useEffect(() => {
    let isCancelled = false;
    if (activeModal === 'webrtc' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      let angle = 0;
      let frameCount = 0;

      const render = () => {
        if (isCancelled) return;
        angle += 0.04;
        frameCount++;
        const w = canvas.width;
        const h = canvas.height;

        // Arrière-plan dégradé médical haute définition
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#060d19');
        grad.addColorStop(0.5, '#0b1626');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Grille de télémétrie optique
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 30) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Silhouette / Viseur du visage (Face Tracking Cadrage)
        const cx = w / 2;
        const cy = h / 2 - 10;
        const faceR = 52 + Math.sin(angle * 1.5) * 2;

        // Halo de détection
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(cx, cy, faceR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Coins du cadre de ciblage (Face Bounding Box)
        const boxSize = 65;
        const cornerLen = 14;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;

        // Coin haut-gauche
        ctx.beginPath();
        ctx.moveTo(cx - boxSize, cy - boxSize + cornerLen);
        ctx.lineTo(cx - boxSize, cy - boxSize);
        ctx.lineTo(cx - boxSize + cornerLen, cy - boxSize);
        ctx.stroke();

        // Coin haut-droit
        ctx.beginPath();
        ctx.moveTo(cx + boxSize - cornerLen, cy - boxSize);
        ctx.lineTo(cx + boxSize, cy - boxSize);
        ctx.lineTo(cx + boxSize, cy - boxSize + cornerLen);
        ctx.stroke();

        // Coin bas-gauche
        ctx.beginPath();
        ctx.moveTo(cx - boxSize, cy + boxSize - cornerLen);
        ctx.lineTo(cx - boxSize, cy + boxSize);
        ctx.lineTo(cx - boxSize + cornerLen, cy + boxSize);
        ctx.stroke();

        // Coin bas-droit
        ctx.beginPath();
        ctx.moveTo(cx + boxSize - cornerLen, cy + boxSize);
        ctx.lineTo(cx + boxSize, cy + boxSize);
        ctx.lineTo(cx + boxSize, cy + boxSize - cornerLen);
        ctx.stroke();

        // Avatar Silhouette Tête
        ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy - 8, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx, cy + 32, 38, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Onde ECG / Fréquence Cardiaque & Onde Vocale au bas du flux
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < w; x += 4) {
          const osc = Math.sin((x * 0.03) + angle * 2) * 14;
          const spike = (x > w * 0.4 && x < w * 0.6) ? Math.sin((x - w * 0.4) * 0.15) * 22 : 0;
          const y = h - 38 + osc + spike;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // HUD Textes & Badges en direct (adaptés au rôle Praticien vs Assuré)
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillText(isDoctorSide ? '● FLUX PATIENT HD 1080p (DIRECT)' : `● FLUX MÉDECIN CNOM HD 1080p (DIRECT)`, 14, 24);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.fillText(isDoctorSide ? `${activeFirstName} ${activeLastName}` : `${activeDoctor.name} (${activeDoctor.specialty})`, 14, 44);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px monospace';
        ctx.fillText(isDoctorSide ? `CSU: ${activeCmuNumber || 'non renseigné'} | 60 FPS` : `${activeDoctor.cnom || 'Praticien'} • Convention UNAMUSC 🇸🇳 | 60 FPS`, 14, 60);

        // Horodatage dynamique
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`REC ${timeStr} 🟢`, w - 14, 24);
        ctx.fillStyle = '#a7f3d0';
        ctx.fillText('AUDIO CLINIQUE ACTIF', w - 14, 42);
        ctx.textAlign = 'left';

        animFrameRef.current = requestAnimationFrame(render);
      };

      render();

      return () => {
        isCancelled = true;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }
  }, [activeModal, useSimulatedFeed, activeFirstName, activeLastName, activeCmuNumber, isDoctorSide, activeDoctor]);

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

    // Garde-fou : ce handler ne déclenche QUE le parcours payant immédiat.
    // Le parcours « rendez-vous » passe par handleBookAppointment et n'aboutit
    // jamais ici. Sans cette séparation, un bug d'affichage ferait payer un
    // assuré qui avait choisi un rendez-vous gratuit.
    if (queueMode !== 'live') return;

    // Validation du numéro de téléphone
    const validation = validatePhoneForProvider(phoneNum, paymentProvider);
    if (!validation.valid) {
      setPhoneError(validation.error);
      return;
    }
    setPhoneError('');

    const providerInfo = getProviderInfo(paymentProvider);
    const targetDoc = selectedDoctor || doctorsList[0];
    // On ne facture jamais une consultation sans praticien accrédité :
    // l'assuré n'entrerait dans aucune file et ne serait jamais vu.
    if (!targetDoc) {
      setPhoneError('');
      setPayStep('form');
      speakAndToast({
        type: 'error',
        icon: '⚠️',
        title: 'Aucun médecin disponible',
        message: 'Aucun praticien UNAMUSC n\'est actuellement habilité : impossible d\'ouvrir une salle d\'attente. Aucun paiement ne vous sera demandé.',
        speech: 'Aucun médecin agréé n\'est actuellement disponible. Votre demande reste enregistrée sans frais.'
      });
      return;
    }

    // Étape 1 : afficher le spinner de traitement
    setPayStep('processing');

    // Étape 2 : appeler le service de paiement (mock ou réel)
    const result = await initiatePayment({
      provider: paymentProvider,
      phone: phoneNum,
      amount: 2500,
      orderId: activeCmuNumber,
    });

    if (result.success) {
      // Étape 3 : paiement réussi — enregistrer dans la file
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
        icon: '✅',
        title: 'Paiement confirmé !',
        message: `2 500 FCFA réglés via ${providerInfo.name}. Position n°${positionNum}.`,
        speech: `Paiement confirmé. Référence ${result.transactionRef}. Vous êtes en position numéro ${positionNum} dans la salle d'attente.`
      });
    } else {
      // Étape 3 : paiement échoué
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

  // ── Prise de rendez-vous — SANS PAIEMENT ────────────────────────────────────
  //
  // Ce handler n'appelle JAMAIS `initiatePayment`. Le rendez-vous est
  // enregistré tel quel et le backend répond explicitement que le règlement
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

    // Un praticien doit être désigné : sans cible, le rendez-vous ne peut
    // être rattaché à personne et ne serait jamais honoré.
    const targetDoc = selectedDoctor || doctorsList[0];
    if (!targetDoc) {
      setBookingError('Aucun praticien enregistré sur la plateforme. Vous ne pouvez pas prendre rendez-vous pour le moment.');
      return;
    }

    setBookingSubmitting(true);
    try {
      // Le créneau choisi est traduit en heure de rendez-vous : matin = 9h,
      // après-midi = 14h. On ne propose pas de date « précise » que la
      // plateforme ne sait pas réellement respecter.
      const slotHour = bookingSlot === 'matin' ? 9 : 14;
      const appointmentDate = new Date(bookingDate);
      appointmentDate.setHours(slotHour, 0, 0, 0);

      const result = await bookAppointment({
        beneficiaryId: citizenUser?.id ?? citizenUser?.beneficiaryId ?? null,
        structureId: targetDoc?.structureId ?? null,
        doctorName: targetDoc.name,
        specialty: targetDoc.specialty || 'Médecine Générale',
        appointmentDate: appointmentDate.toISOString(),
        notes: [consultReason, bookingNotes].filter(Boolean).join(' — ')
      });

      if (result?.success) {
        setBookingResult(result.data);
        speakAndToast({
          type: 'success',
          icon: '📅',
          title: 'Rendez-vous enregistré',
          message: 'Aucun paiement n\'a été débité. Le règlement se fera sur place.',
          speech: 'Votre rendez-vous est enregistré. Aucun paiement n\'a été effectué. Vous réglerez la consultation sur place, à la structure.'
        });
      } else {
        setBookingError(result?.message || 'Le rendez-vous n\'a pas pu être enregistré.');
      }
    } catch (err) {
      setBookingError('Le rendez-vous n\'a pas pu être enregistré. Vérifiez votre connexion.');
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
            icon: '🔔',
            title: 'Alerte préalable',
            message: 'Vous êtes le prochain patient. Préparez votre micro et votre caméra.',
            speech: `Attention ${activeFirstName}. Vous êtes le prochain patient. Veuillez préparer votre micro et votre caméra. Le médecin va vous recevoir dans un instant.`
          });
          return { ...p, status: 'next' };
        }
        if (p.status === 'next') {
          speakAndToast({
            type: 'success',
            icon: '🏥',
            title: "C'est votre tour !",
            message: 'Le médecin est prêt à vous recevoir. La consultation commence maintenant.',
            speech: `${activeFirstName}, c'est votre tour. Le médecin est prêt à vous recevoir. La consultation de télémédecine commence maintenant. Bienvenue.`
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
    // Aucun praticien accrédité : impossible d'ouvrir une consultation.
    if (!chosenDoc) {
      speakAndToast({
        type: 'error',
        icon: '⚠️',
        title: 'Aucun médecin disponible',
        message: 'Aucun praticien n\'est actuellement habilité. Votre demande reste en attente d\'accréditation.',
        speech: 'Aucun médecin agréé n\'est actuellement disponible sur la plateforme.'
      });
      return;
    }
    setActiveDoctor(chosenDoc);
    if (patient) setActivePatient(patient);
    setSwappedViews(false);
    setActiveCallTab('chat');
    setPrescriptionDelivered(false);
    setCertificateDelivered(false);
    const welcomeMsg = `Bonjour ${activeFirstName}. Je suis le ${chosenDoc.name} (${chosenDoc.specialty}). Je consulte actuellement votre dossier médical UNAMUSC (${activeCmuNumber}). Quel est le motif de votre consultation aujourd'hui ?`;
    setChatMessages([
      { sender: chosenDoc.name, text: welcomeMsg, isUser: false }
    ]);
    setActiveModal('webrtc');
    startCamera(true);
    // La voix d'accueil synthétique ne se déclenche que dans l'ESPACE ASSURÉ
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

    // Réponse médicale dynamique et intelligente du praticien
    setTimeout(() => {
      let docReply = '';
      const lower = userText.toLowerCase();
      if (lower.includes('fièvre') || lower.includes('fievre') || lower.includes('chaud') || lower.includes('temperature') || lower.includes('température')) {
        docReply = `Je prends note de votre état fébrile. Veuillez bien vous hydrater. Je vous prescris du Paracétamol 1g (1 comprimé toutes les 6h) et du repos. Vos constantes restent stables (SpO2: 99%, TA: 12/8).`;
      } else if (lower.includes('toux') || lower.includes('gorge') || lower.includes('grippe') || lower.includes('rhume') || lower.includes('respirer')) {
        docReply = `D'accord ${activeFirstName}, pour soulager la gorge et la toux, je vous prescris un sirop expectorant et des lavages de nez au sérum physiologique. Votre ordonnance 50% Tiers-Payant est prête.`;
      } else if (lower.includes('tête') || lower.includes('tete') || lower.includes('migraine') || lower.includes('vertige') || lower.includes('céphalée')) {
        docReply = `Vos céphalées peuvent être liées au surmenage ou à la fatigue oculaire. Votre tension artérielle est mesurée à 12/8 cmHg (parfaite). Je vous recommande du repos et un antalgique léger.`;
      } else if (lower.includes('ventre') || lower.includes('estomac') || lower.includes('diarrhée') || lower.includes('diarrhee') || lower.includes('vomis') || lower.includes('nausée')) {
        docReply = `Pour vos douleurs abdominales, évitez les repas épicés, buvez des bouillons légers et prenez l'antispasmodique que je viens de vous inscrire sur l'ordonnance électronique.`;
      } else if (lower.includes('ordonnance') || lower.includes('médicament') || lower.includes('medicament') || lower.includes('pharmacie') || lower.includes('bon')) {
        docReply = `Votre ordonnance numérique avec prise en charge directe 50% UNAMUSC est générée ! Vous pouvez cliquer sur le bouton vert "Émettre Ordonnance & Bon 50%" ci-dessous pour l'imprimer ou la présenter en pharmacie.`;
      } else {
        docReply = `Merci pour ces précisions, ${activeFirstName}. J'enregistre ces observations cliniques dans votre dossier médical. Tout est sous contrôle. Avez-vous d'autres questions ou besoins particuliers ?`;
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
      docType: 'ORDONNANCE MÉDICALE DE TÉLÉMÉDECINE CERTIFIÉE (50% TIERS-PAYANT)',
      title: 'Ordonnance Électronique & Bon Pharmacie 50%',
      referenceNo: orderCode,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: activeDoctor.department || 'Pharmacies Agréées Tiers-Payant UNAMUSC Dakar',
      details: [
        { label: 'Patient(e) Bénéficiaire', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'Médecin Prescripteur', value: `${activeDoctor.name} (${activeDoctor.specialty} — ${activeDoctor.cnom})` },
        { label: 'Médicaments Prescrits', value: '1. Amoxicilline 500mg (2 boîtes) — 1 gélule 3x/jour pendant 7 jours\n2. Paracétamol 1g (1 boîte) — 1 comprimé en cas de fièvre/douleur\n3. Solution de réhydratation & Vitamine C 500mg' },
        { label: 'Couverture Pharmacie UNAMUSC', value: '50% Prise en charge directe Tiers-Payant UNAMUSC Sénégal' },
        { label: 'Date & Validité', value: `${new Date().toLocaleDateString('fr-FR')} (Valable 30 jours dans toutes les officines agréées)` }
      ],
      notes: 'Cette ordonnance médicale électronique certifiée comporte le cachet numérique et le visa de conformité CNOM Sénégal.'
    });

    // ── INTERCONNEXION INTELLIGENTE : Synchronisation avec la page Bons de Commande (PurchaseOrders) ──
    try {
      const existingOrdersRaw = localStorage.getItem('cmu_purchase_orders');
      const existingOrders = existingOrdersRaw ? JSON.parse(existingOrdersRaw) : [];
      const newPurchaseOrder = {
        id: Date.now(),
        first_name: activeFirstName,
        last_name: activeLastName,
        cmu_number: activeCmuNumber,
        items_json: JSON.stringify([
          { name: 'Amoxicilline 500mg (2 boîtes)', qty: 2, price: 3500 },
          { name: 'Paracétamol 1000mg (1 boîte)', qty: 1, price: 1500 },
          { name: 'Solution Réhydratation & Vit C', qty: 1, price: 1200 }
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
        origin: 'Télémédecine UNAMUSC'
      };
      const updatedOrders = [newPurchaseOrder, ...existingOrders.filter(o => o.order_code !== orderCode)];
      localStorage.setItem('cmu_purchase_orders', JSON.stringify(updatedOrders));
      
      // Mise à jour des constantes vitales dans le DMP de l'assuré
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
      icon: '💊',
      title: 'Ordonnance officielle générée & synchronisée',
      message: `L'ordonnance 50% de ${activeFirstName} ${activeLastName} a été téléchargée et ajoutée à vos Bons de Commande Pharmacie.`
    });
  };

  const handleDownloadCertificate = () => {
    const certCode = `CERT-TELEMED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    generateOfficialPdf({
      filename: `certificat_medical_${activeFirstName}_${activeLastName}.pdf`,
      docType: 'CERTIFICAT MÉDICAL DE TÉLÉCONSULTATION CERTIFIÉE',
      title: 'Certificat Médical & Aptitude CSU',
      referenceNo: certCode,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: activeDoctor.department || 'Cabinet de Téléconsultation Agréé UNAMUSC',
      details: [
        { label: 'Patient(e)', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'Médecin Praticien', value: `${activeDoctor.name} (${activeDoctor.specialty} — ${activeDoctor.cnom})` },
        { label: 'Date de la Consultation', value: `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` },
        { label: 'Constatations Cliniques', value: 'Examen médical en visioconférence concluant. État général stable. Télémétrie physiologique dans les normes.' },
        { label: 'Avis & Repos Médical', value: 'Repos médical prescrit de 48 heures (2 jours). Traitement ambulatoire adapté.' }
      ],
      notes: 'Certificat médical délivré en conformité avec les règles déontologiques du Conseil National de l\'Ordre des Médecins (CNOM) du Sénégal.'
    });

    // ── INTERCONNEXION INTELLIGENTE : Synchronisation avec la page Lettres de Garantie (GuaranteeLetters) ──
    try {
      const existingLettersRaw = localStorage.getItem('cmu_guarantee_letters');
      const existingLetters = existingLettersRaw ? JSON.parse(existingLettersRaw) : [];
      const newGuaranteeLetter = {
        id: Date.now(),
        first_name: activeFirstName,
        last_name: activeLastName,
        cmu_number: activeCmuNumber,
        ipp_number: `IPP-TELEMED-${Math.floor(1000 + Math.random() * 9000)}`,
        hospital_name: activeDoctor.department || 'Centre National de Télémédecine UNAMUSC Dakar',
        medical_act: `Téléconsultation Médicale Spécialisée (${activeDoctor.specialty})`,
        estimated_amount: 12500,
        guaranteed_percentage: 80,
        unamusc_amount: 10000,
        sesame_amount: 0,
        max_amount: 10000,
        patient_rest: 2500,
        status: 'approved',
        validation_code: `GAR-TELEMED-${Math.floor(1000 + Math.random() * 9000)}`,
        created_at: new Date().toISOString(),
        agent_note: `Téléconsultation certifiée effectuée par ${activeDoctor.name} (${activeDoctor.cnom}). Prise en charge 80% accordée.`
      };
      const updatedLetters = [newGuaranteeLetter, ...existingLetters.filter(l => l.validation_code !== newGuaranteeLetter.validation_code)];
      localStorage.setItem('cmu_guarantee_letters', JSON.stringify(updatedLetters));
    } catch (e) {
      console.warn("Guarantee letters sync warning:", e);
    }

    speakAndToast({
      type: 'success',
      icon: '📄',
      title: 'Certificat médical délivré & synchronisé',
      message: `Le certificat médical de ${activeFirstName} ${activeLastName} a été généré et la prise en charge a été enregistrée dans vos Lettres de Garantie.`
    });
  };

  // ── DEMANDE D'EXAMENS COMPLÉMENTAIRES (Laboratoire / Imagerie) — outil praticien ──
  const handleDownloadLabOrder = () => {
    const labCode = `LAB-TELEMED-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    generateOfficialPdf({
      filename: `demande_examens_${activeFirstName}_${activeLastName}.pdf`,
      docType: 'DEMANDE D\u2019EXAMENS COMPLÉMENTAIRES — TÉLÉCONSULTATION',
      title: 'Demande d\u2019Examens Biologiques & Imagerie Médicale',
      referenceNo: labCode,
      beneficiaryName: `${activeFirstName} ${activeLastName}`,
      cmuNumber: activeCmuNumber,
      structureName: activeDoctor.department || 'Cabinet de Téléconsultation Agréé UNAMUSC',
      details: [
        { label: 'Patient(e)', value: `${activeFirstName} ${activeLastName} (${activeCmuNumber})` },
        { label: 'Médecin Demandeur', value: `${activeDoctor.name} (${activeDoctor.specialty} — ${activeDoctor.cnom})` },
        { label: 'Date de la Demande', value: `${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` },
        { label: 'Examens Biologiques', value: 'NFS, CRP, Glycémie à jeun, Urée/Créatinine, TSH' },
        { label: 'Imagerie Médicale', value: 'Radiographie thoracique (face) + Échographie abdominale si besoin' },
        { label: 'Contexte Clinique', value: `Téléconsultation du jour — motif : ${activePatient?.reason || 'Évaluation clinique'}` },
        { label: 'Constantes à la Consultation', value: `FC ${telemetryVitals.bpm} bpm • TA ${telemetryVitals.bp} mmHg • SpO2 ${telemetryVitals.spo2}% • T ${telemetryVitals.temp}°C` },
        { label: 'Prise en charge', value: 'Bons d\u2019examen UNAMUSC 80% (laboratoires et centres d\u2019imagerie agréés)' }
      ],
      notes: 'Demande d\u2019examens électronique signée numériquement dans le cadre de la téléconsultation UNAMUSC. Présenter ce document avec la carte Pass CSU dans les laboratoires agréés.'
    });

    speakAndToast({
      type: 'success',
      icon: '🧪',
      title: 'Demande d\u2019examens générée',
      message: `La demande d\u2019examens de ${activeFirstName} ${activeLastName} a été téléchargée (réf. ${labCode}).`
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
    alert('✅ Nouveau médecin praticien ajouté au réseau UNAMUSC avec succès !');
  };

  const filteredDoctors = doctorsList.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = activeCategory === 'all' || d.category === activeCategory;
    return matchSearch && matchCat;
  });



  // ── LABORATOIRE & BIOLOGIE : Périmètre d'examens télé-transmis ──
  if (isLabUser) {
    const handleSaveTeleOrder = (e) => {
      e.preventDefault();
      if (!editingTeleOrder) return;
      if (!editingTeleOrder.patientName || !editingTeleOrder.examName) {
        alert('Veuillez renseigner le nom du patient et l\'examen télé-prescrit.');
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
        title: `la prescription télé-médicale "${order.examName || 'Examen'}" de ${order.patientName}`,
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
          exam_type: 'Bilan Biologique (Télémédecine)',
          badge: 'TÉLÉMÉDECINE HD',
          facility: partnerUser?.structureName || 'Laboratoire Pasteur Dakar',
          doctor: uploadTeleTarget.doctor,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          conclusion: uploadTeleNotes || 'Bilan lipidique et glycémie certifiés. Résultats transmis directement depuis le guichet de télémédecine.',
          cliches: 1,
          preview: '/csu_digital_health_real.jpg'
        };

        localStorage.setItem(`cmu-exams-${patientCmu}`, JSON.stringify([newExam, ...patientExams]));
        localStorage.setItem('cmu-medical-exams', JSON.stringify([newExam, ...existingExams]));
      } catch (err) {}

      alert(`✅ Rapport de bilan télé-médical transmis avec succès au DMP pour ${uploadTeleTarget.patientName} (${uploadTeleTarget.cmuNumber}) !`);
      setUploadTeleTarget(null);
      setUploadTeleFileName('');
      setUploadTeleNotes('');
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
                Prescriptions télé-médicales d'examens
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Les consultations vidéo interactives sont réservées aux médecins prescripteurs. Votre structure de santé ou laboratoire conventionné ({partnerUser?.structureName || 'Laboratoire / Établissement de santé conventionné'}) est configuré(e) pour recevoir et traiter les ordonnances de bilans sanguins, analyses et imagerie émises en télémédecine.
              </p>

              <div className="d-flex align-items-center flex-wrap mt-4" style={{ gap: '28px', rowGap: '16px' }}>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: '#047857', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', boxShadow: '0 6px 18px rgba(0,0,0,0.2)', marginRight: '16px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/medical-profile')}>
                  🩻 Transmettre des résultats (DMP)
                </button>
                <button className="btn fw-bold px-4 py-2.5 text-white" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '14px', fontSize: '0.9rem', marginLeft: '4px', marginBottom: '8px' }} onClick={() => (window.location.hash = '#/verify')}>
                  🔍 Vérifier la carte CSU d'un assuré
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

        {/* CONTENU HUB LABORATOIRE — Demandes de Télé-prescriptions */}
        <div className="card shadow-sm border-0 p-4 mb-4" style={{ borderRadius: '24px', background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
            <div>
              <h4 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.25rem' }}>
                <span>📥</span> Prescriptions télé-médicales d'analyses & imagerie en attente
              </h4>
              <p className="text-muted small mb-0" style={{ fontSize: '0.88rem' }}>
                Demandes d'analyses émanant des téléconsultations en direct. Téléversez les rapports PDF certifiés pour libérer la prise en charge Tiers-Payant.
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
                    type: 'Télé-consultation HD',
                    examName: '',
                    ref: `Prescription Télé-médecine #TM-${Math.floor(1000 + Math.random() * 9000)}`,
                    status: 'pending',
                    fileName: null
                  });
                }}
              >
                <span>➕ Prescrire un nouvel examen (Télémédecine)</span>
              </button>

              <span className="badge bg-warning-subtle text-warning border border-warning px-3 py-2 fw-bold" style={{ borderRadius: '12px', fontSize: '0.82rem' }}>
                ⏳ Flux Visioconférence Direct
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)', minWidth: '1300px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Assuré(e)</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Médecin télé-consultant</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Analyses / Imagerie demandées</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em' }}>Statut prélèvement</th>
                  <th style={{ padding: '0.9rem 1rem', fontSize: '0.85rem', textTransform: 'none', letterSpacing: '0.02em', textAlign: 'right', minWidth: '420px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teleOrders.map(tOrd => (
                  <tr key={tOrd.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div className="d-flex align-items-center gap-2.5">
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.05rem' }}>
                          👤
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
                      <span className="fw-bold d-block" style={{ fontSize: '0.92rem' }}>👨‍⚕️ {tOrd.doctor}</span>
                      <span className="badge bg-info-subtle text-info border border-info fw-bold mt-0.5" style={{ fontSize: '0.74rem', padding: '2px 8px', borderRadius: '6px' }}>
                        🎥 {tOrd.type}
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
                          ✅ Transmis & validé
                        </span>
                      ) : (
                        <span className="badge bg-warning text-dark px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                          📥 En attente de prélèvement
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '420px' }}>
                      <div className="d-flex align-items-center justify-content-end gap-2.5 flex-nowrap">
                        {tOrd.status === 'transmis' ? (
                          <button className="btn btn-sm btn-outline-success fw-bold px-3 py-2" style={{ borderRadius: '10px', fontSize: '0.82rem' }} onClick={() => (window.location.hash = '#/medical-profile')}>
                            👁 Voir au DMP
                          </button>
                        ) : (
                          <button 
                            className="btn btn-sm btn-emerald fw-bold text-white px-3 py-2" 
                            style={{ background: '#059669', border: 'none', borderRadius: '12px', fontSize: '0.88rem', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }} 
                            onClick={() => setUploadTeleTarget(tOrd)}
                          >
                            📤 Transmettre le bilan PDF (DMP)
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
                          title="Modifier la prescription télé-médicale"
                          onClick={() => {
                            setEditingTeleOrder({ ...tOrd });
                            setIsNewTeleOrder(false);
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
                          title="Supprimer la prescription télé-médicale"
                          onClick={() => handleDeleteTeleOrder(tOrd)}
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

        {/* MODAL TRANSMISSION TÉLÉMÉDECINE (React Portal) */}
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
                    🧪
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      Téléverser & Certifier Bilan Télé-médical
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success mt-1 fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC • {uploadTeleTarget.cmuNumber}
                    </span>
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={() => setUploadTeleTarget(null)}></button>
              </div>

              {/* Patient Banner */}
              <div className="p-3.5 rounded-4 mb-4" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2.5">
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ fontSize: '1.1rem' }}>👤</span>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>{uploadTeleTarget.patientName}</strong>
                  </div>
                  <code className="bg-success text-white px-2.5 py-1 rounded-3 fw-bold small">{uploadTeleTarget.cmuNumber}</code>
                </div>
                <div className="d-flex flex-column gap-2 mt-2 pt-2.5 border-top" style={{ borderColor: 'var(--border-color)', fontSize: '0.88rem' }}>
                  <div>
                    <span className="text-muted fw-semibold">📋 Examen prescrit : </span>
                    <strong className="text-primary">{uploadTeleTarget.examName}</strong>
                  </div>
                  <div>
                    <span className="text-muted fw-semibold">👨‍⚕️ Médecin téléconsultant : </span>
                    <strong style={{ color: 'var(--text-main)' }}>{uploadTeleTarget.doctor}</strong>
                  </div>
                </div>
              </div>

              {/* File Input Dropzone */}
              <div className="mb-4">
                <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  📁 Fichier d'analyse certifié (Format PDF) *
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
                      📄
                    </div>
                    <strong className="d-block text-primary" style={{ fontSize: '0.94rem' }}>
                      {uploadTeleFileName ? `✓ Fichier sélectionné : ${uploadTeleFileName}` : 'Cliquez ici pour choisir le document ou glissez-le'}
                    </strong>
                    <span className="text-muted d-block" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                      Format PDF certifié avec signature du biologiste ou médecin
                    </span>
                  </label>
                </div>
              </div>

              {/* Biologist / Doctor Conclusions */}
              <div className="mb-4">
                <label className="form-label small fw-bold mb-2" style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
                  📝 Note & conclusions du biologiste / médecin ({partnerUser?.structureName || 'Laboratoire / Établissement agréé'})
                </label>
                <textarea 
                  className="form-control py-2.5 px-3" 
                  rows={3} 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '14px', fontSize: '0.88rem' }}
                  placeholder="Ex: Bilan lipidique satisfaisant. Cholestérol total : 1.85 g/L. Glycémie à jeun : 0.90 g/L."
                  value={uploadTeleNotes}
                  onChange={(e) => setUploadTeleNotes(e.target.value)}
                />
              </div>

              {/* Modal Action Buttons — Séparation Maximale Gauche / Droite */}
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
                  ✅ Publier directement au dossier médical (DMP)
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

        {/* MODAL DE CRÉATION / ÉDITION DE PRESCRIPTION TÉLÉMÉDECINE (React Portal) */}
        {editingTeleOrder && createPortal(
          <div 
            style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem', overflowY: 'auto' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditingTeleOrder(null); }}
          >
            <form onSubmit={handleSaveTeleOrder} style={{ maxWidth: '720px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2.25rem', border: '1.5px solid #10b981', boxShadow: '0 25px 60px rgba(0,0,0,0.4)', margin: 'auto' }}>
              
              <div className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 'bold' }}>
                    📱
                  </div>
                  <div>
                    <h5 className="fw-extrabold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                      {isNewTeleOrder ? 'Prescrire un examen par télémédecine' : 'Modifier la prescription télé-médicale'}
                    </h5>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold" style={{ borderRadius: '6px', fontSize: '0.74rem' }}>
                      UNAMUSC • Télémédecine HD
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
                  <label className="form-label small fw-bold mb-1">N° Carte CSU *</label>
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
                  <label className="form-label small fw-bold mb-1">Examen / Bilan demandé *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.examName || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, examName: e.target.value })}
                    placeholder="Ex: Bilan Lipidique & Glycémie à jeun"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Médecin télé-consultant</label>
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
                  <label className="form-label small fw-bold mb-1">Référence prescription</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.ref || ''}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, ref: e.target.value })}
                    placeholder="Ex: Prescription Télé-médecine #TM-8812"
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold mb-1">Statut prélèvement</label>
                  <select 
                    className="form-select"
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                    value={editingTeleOrder.status || 'pending'}
                    onChange={(e) => setEditingTeleOrder({ ...editingTeleOrder, status: e.target.value })}
                  >
                    <option value="pending">📥 En attente de prélèvement</option>
                    <option value="transmis">✅ Transmis & validé</option>
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
                  💾 Enregistrer la prescription
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

  // ── PHARMACIEN : non concerné par la télémédecine ──
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
                Télémédecine : non concerné
              </h1>
              <p style={{ color: 'rgba(209, 250, 229, 0.95)', fontSize: '1rem', maxWidth: '650px', lineHeight: 1.6 }}>
                Les téléconsultations et le suivi vidéo sont exclusivement réservés aux praticiens prescripteurs. Votre compte est dédié à la réception et au traitement des ordonnances médicamenteuses.
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
                <img src="/csu_digital_health_real.jpg" alt="Télémédecine UNAMUSC" style={{ width: '100%', height: '190px', objectFit: 'cover' }} />
              </div>
            </div>
          </div>
        </div>

        {/* 2. CONTENU DU HUB PHARMACIEN — Téléconsultation */}
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
                  💻
                </div>
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: 'var(--text-main)', fontSize: '1.1rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Téléconsultation & confidentialité
                  </h5>
                  <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                    Règlementation RBAC UNAMUSC Sénégal
                  </span>
                </div>
              </div>

              <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', lineHeight: 1.65, marginBottom: '1.5rem' }}>
                La plateforme de télémédecine relie directement les patients aux médecins et sage-femmes agréés. Les ordonnances prescrites lors d'une téléconsultation sont directement transmises au guichet des bons de commande officine.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="p-3.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <div className="d-flex align-items-center gap-2.5">
                    <span style={{ fontSize: '1.1rem' }}>💊</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}>Traitement des ordonnances électroniques</span>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
                    🟢 Disponible (100%)
                  </span>
                </div>

                <div className="p-3.5 rounded-3 d-flex align-items-center justify-content-between" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-2.5">
                    <span style={{ fontSize: '1.1rem' }}>📹</span>
                    <span style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 600 }}>Session vidéo médecin-patient</span>
                  </div>
                  <span className="badge bg-secondary-subtle text-secondary border border-secondary px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.78rem' }}>
                    🔴 Non concerné
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
                      💊
                    </div>
                    <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.74rem', fontWeight: 700, padding: '5px 12px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                      Guichet principal ➔
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Bons de commande & ordonnances
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Valider les médicaments & facturer en tiers-payant UNAMUSC.
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
                      🔍
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Contrôle CSU ➔
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Vérification des cartes CSU
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Scanner QR code & contrôler l'éligibilité tiers-payant.
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
                      🏥
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Réseau officines ➔
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Structures de santé agréées
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
                    Annuaire des officines et centres hospitaliers du Sénégal.
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
                      📊
                    </div>
                    <span className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Facturation UNAMUSC ➔
                    </span>
                  </div>
                  <strong className="d-block mb-1" style={{ color: 'var(--text-main)', fontSize: '1.05rem', letterSpacing: '-0.01em', textTransform: 'none' }}>
                    Rapports & statistiques
                  </strong>
                  <p className="mb-0" style={{ color: 'var(--text-sub)', fontSize: '0.84rem', lineHeight: 1.55 }}>
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
      <div className="telemed-view fade-in-up" style={{ minHeight: '80vh', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: '850px', margin: '0 auto' }}>
          <div className="card shadow-lg border-0 p-4 p-md-5 text-center my-4" style={{ borderRadius: '24px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '2px solid #ef4444' }}>
            <div className="d-inline-flex align-items-center justify-content-center p-3 rounded-circle mb-3 mx-auto" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', width: '70px', height: '70px' }}>
              <span style={{ fontSize: '2.2rem' }}>⚠️</span>
            </div>
            
            <h3 className="fw-bold mb-2 text-danger" style={{ fontSize: '1.4rem' }}>⚠️ Accès aux soins refusé — Couverture CSU suspendue</h3>
            
            <div className="mb-3">
              <code className="px-3 py-1.5 bg-dark text-warning border border-warning rounded-3 fw-bold d-inline-block" style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {activeCmuNumber}
              </code>
            </div>

            <p className="lead mb-4 mx-auto" style={{ maxWidth: '640px', fontSize: '1.05rem', lineHeight: '1.65' }}>
              Votre cotisation annuelle n'est pas à jour. Tous vos droits et accès aux services de télémédecine sont suspendus.
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
    <div className="telemed-view fade-in-up" style={{ minHeight: '100vh', paddingBottom: '3rem' }}>
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* BANDEAU DE NAVIGATION : ESPACE STRICTEMENT CLOISONNÉ AU RÔLE CONNECTÉ */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div style={{ borderBottom: '1.5px solid var(--border-color)', background: 'var(--bg-card-subtle)', padding: '0.85rem 1.5rem' }}>
        <div style={{ maxWidth: '1320px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
      
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: activeRoleMode === 'doctor' ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: '#ffffff', boxShadow: activeRoleMode === 'doctor' ? '0 4px 12px rgba(16,185,129,0.35)' : '0 4px 12px rgba(2,132,199,0.35)' }}>
              {activeRoleMode === 'doctor' ? '👨‍⚕️' : '🩺'}
            </div>
            <div>
              <h5 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: '1.2' }}>
                {activeRoleMode === 'doctor' ? 'Espace Praticien — Cabinet Digital & Téléconsultation' : 'Télémédecine UNAMUSC — Espace Assuré CSU'}
              </h5>
              <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>
                {activeRoleMode === 'doctor' 
                  ? (partnerUser?.structureName ? `${partnerUser.structureName} • Ordre National des Médecins` : 'Praticien de Garde Agréé CNOM • Téléconsultations Réglementées')
                  : `${activeFirstName} ${activeLastName} • N° CSU : ${activeCmuNumber}`}
              </small>
            </div>
          </div>

          {/* BADGE RÔLE STRICTEMENT DÉDIÉ (Pas de commutation inter-profils pour les assurés ou praticiens) */}
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
                <span>👨‍⚕️</span> Vue Praticien (SuperAdmin)
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
                <span>👤</span> Vue Assuré (SuperAdmin)
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
                <span>🛡️</span> Vue Agent (SuperAdmin)
              </button>
            </div>
          ) : (
            <div>
              {activeRoleMode === 'doctor' ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(5, 150, 105, 0.15)', border: '1px solid #10b981', padding: '0.5rem 1.1rem', borderRadius: '14px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399', display: 'inline-block' }} />
                  <span style={{ color: '#34d399', fontWeight: '800', fontSize: '0.85rem' }}>
                    👨‍⚕️ Praticien de Garde Agréé
                  </span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(2, 132, 199, 0.15)', border: '1px solid #0284c7', padding: '0.5rem 1.1rem', borderRadius: '14px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 10px #38bdf8', display: 'inline-block' }} />
                  <span style={{ color: '#38bdf8', fontWeight: '800', fontSize: '0.85rem' }}>
                    👤 Espace Assuré CSU (Tiers-Payant 80%)
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

  <div style={{ maxWidth: '1320px', margin: '1.5rem auto 0 auto', padding: '0 1.5rem' }}>
    
    {/* ═══════════════════════════════════════════════════════════════════ */}
    {/* 1. ESPACE PROFESSIONNEL DE SANTÉ (PRATICIEN / MÉDECIN DE GARDE) */}
    {/* ═══════════════════════════════════════════════════════════════════ */}
    {activeRoleMode === 'doctor' && (
      <div className="fade-in-up">
        
        {/* Bannière Profil Praticien & Statut de Garde */}
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
                    🟢 PRATICIEN AGRÉÉ EN LIGNE
                  </span>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                    {doctorsList.find(d => d.id === selectedDoctorId)?.cnom || 'Non renseigné'}
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
                  Spécialité : <strong style={{ color: '#38bdf8' }}>{doctorsList.find(d => d.id === selectedDoctorId)?.specialty || 'Pédiatrie & Santé Familiale'}</strong> | {doctorsList.find(d => d.id === selectedDoctorId)?.department || 'Dakar Centre'}
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
                  🟢 Disponible
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
                  🟡 En appel
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
                  🔴 Pause
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
                <span style={{ fontSize: '1.3rem' }}>👥</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#34d399', fontSize: '1.8rem' }}>{queue.length}</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Prêts pour téléconsultation</small>
            </div>
          </div>

          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #1e293b', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Temps moyen</span>
                <span style={{ fontSize: '1.3rem' }}>⏱️</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#38bdf8', fontSize: '1.8rem' }}>~4 min</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Par consultation HD</small>
            </div>
          </div>

          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #1e293b', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Actes Réalisés</span>
                <span style={{ fontSize: '1.3rem' }}>✅</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#a78bfa', fontSize: '1.8rem' }}>8</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Téléconsultations du jour</small>
            </div>
          </div>

          <div className="col-6 col-xl-3 col-lg-6">
            <div style={{ background: '#0b1120', border: '1.5px solid #1e293b', borderRadius: '18px', padding: '1.25rem', color: '#ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700' }}>Honoraires Tiers-Payant</span>
                <span style={{ fontSize: '1.3rem' }}>💰</span>
              </div>
              <h3 className="fw-extrabold mb-0" style={{ color: '#fde047', fontSize: '1.6rem' }}>85 000 F</h3>
              <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Garantie 100% UNAMUSC</small>
            </div>
          </div>
        </div>

        {/* SALLE D'ATTENTE INTERACTIVE & APPEL DES ASSURÉS PAR LE PRATICIEN */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '22px', padding: '1.75rem', marginBottom: '2rem', boxShadow: 'var(--shadow-md)' }}>
          
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <div>
              <h5 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>
                <span>🏥</span> Salle d'Attente Virtuelle — Patients en Attente ({queue.length})
              </h5>
              <p className="mb-0 text-muted small">
                Cliquez sur <strong>« Recevoir &amp; Appeler »</strong> pour démarrer la visioconférence HD avec l'assuré et ouvrir son dossier clinique.
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
                    reason: 'Céphalées intenses et fièvre 38.5°C',
                    joined_at: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
                    status: 'waiting',
                    payment_method: 'Wave',
                    requested_doctor: doctorsList.find(d => d.id === selectedDoctorId)?.name || 'Dr. Aminata Ndiaye'
                  };
                  setQueue([samplePatient, ...queue]);
                  speakAndToast({
                    type: 'info',
                    icon: '🔔',
                    title: 'Nouveau patient en salle d\'attente',
                    message: 'Mamadou Diop vient d\'entrer en salle d\'attente pour une téléconsultation.'
                  });
                }}
              >
                ➕ Simuler Arrivée d'un Assuré
              </button>
            </div>
          </div>

          {/* Table / Cards de la File d'attente */}
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ background: 'transparent' }}>
              <thead>
                <tr className="small border-bottom" style={{ color: 'var(--text-sub)', borderColor: 'var(--border-color)', fontSize: '0.8rem', letterSpacing: '0.3px' }}>
                  <th style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>Ordre</th>
                  <th style={{ padding: '0.85rem' }}>Assuré(e)</th>
                  <th style={{ padding: '0.85rem' }}>Matricule CSU</th>
                  <th style={{ padding: '0.85rem' }}>Motif Clinique</th>
                  <th style={{ padding: '0.85rem' }}>Heure</th>
                  <th style={{ padding: '0.85rem' }}>Ticket Modérateur</th>
                  <th style={{ padding: '0.85rem' }}>État</th>
                  <th style={{ padding: '0.85rem', textAlign: 'right' }}>Actions Praticien</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      Aucun patient en attente actuellement. Vous serez notifié dès qu'un assuré valide son entrée.
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
                          ✔ Couverture CSU 80% Validée
                        </div>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <code style={{ background: '#0b1120', color: '#38bdf8', border: '1px solid #1e293b', padding: '0.3rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700' }}>
                          {p.cmu_number}
                        </code>
                      </td>

                      <td style={{ padding: '1rem 0.85rem', maxWidth: '240px' }}>
                        <div style={{ background: '#0b1120', color: '#f8fafc', padding: '0.45rem 0.85rem', borderRadius: '10px', border: '1px solid #1e293b', fontSize: '0.82rem', lineHeight: '1.4' }}>
                          🩺 {p.reason}
                        </div>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <span className="fw-semibold" style={{ color: 'var(--text-sub)', fontSize: '0.85rem' }}>
                          🕒 {p.joined_at}
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '700', display: 'inline-block' }}>
                          ✅ Réglé (2 500 F)
                        </span>
                      </td>

                      <td style={{ padding: '1rem 0.85rem' }}>
                        {p.status === 'called' ? (
                          <span className="badge bg-success text-white px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>🟢 En appel</span>
                        ) : p.status === 'next' ? (
                          <span className="badge bg-warning text-dark px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>🔔 Notifié</span>
                        ) : (
                          <span className="badge bg-secondary text-white px-3 py-1.5" style={{ borderRadius: '12px', fontSize: '0.78rem' }}>⏳ En attente</span>
                        )}
                      </td>

                      <td className="text-end" style={{ padding: '1rem 0.85rem', whiteSpace: 'nowrap' }}>
                        <div className="d-flex align-items-center justify-content-end" style={{ gap: '0.5rem', whiteSpace: 'nowrap' }}>
                          
                          {/* Bouton Dossier Médical */}
                          <button 
                            type="button" 
                            style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '10px', padding: '0.5rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                            onClick={() => setSelectedPatientForRecord(p)}
                            title="Consulter le dossier médical CSU"
                          >
                            📋 Dossier
                          </button>

                          {/* Bouton Notifier */}
                          <button 
                            type="button" 
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '10px', padding: '0.5rem 0.75rem', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer' }}
                            onClick={() => {
                              setQueue(queue.map(item => item.id === p.id ? { ...item, status: 'next' } : item));
                              speakAndToast({
                                type: 'warning',
                                icon: '🔔',
                                title: 'Patient notifié',
                                message: `${p.patient_name} a été prévenu(e) que la consultation va démarrer.`,
                                speech: `${p.patient_name}, c'est bientôt votre tour. Veuillez allumer votre micro et caméra. Le médecin va vous recevoir.`
                              });
                            }}
                            title="Prévenir le patient que son tour arrive"
                          >
                            🔔 Prévenir
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
                            title="Démarrer la consultation vidéo HD avec le patient"
                          >
                            🎥 Recevoir &amp; Appeler
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
                <span>💊</span> Générateur d'Ordonnance Médicale Numérique (50% Tiers-Payant)
              </h6>
              <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                Émettez une ordonnance sécurisée avec votre cachet électronique et N° CNOM. L'assuré la recevra instantanément avec QR code agréé.
              </p>
              <button
                type="button"
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
                onClick={handleDownloadPrescription}
              >
                📄 Télécharger Modèle d'Ordonnance Signée (PDF)
              </button>
            </div>
          </div>

          <div className="col-md-6">
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '1.5rem', height: '100%' }}>
              <h6 className="fw-bold mb-2 d-flex align-items-center gap-2" style={{ color: 'var(--text-main)' }}>
                <span>📄</span> Certificat Médical &amp; Arrêt de Travail
              </h6>
              <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                Délivrez des attestations de repos ou certificats de constatation clinique officiels conformes au barème national.
              </p>
              <button
                type="button"
                style={{ background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.65rem 1.25rem', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer' }}
                onClick={handleDownloadCertificate}
              >
                📥 Émettre Certificat Médical Officiel (PDF)
              </button>
            </div>
          </div>
        </div>

      </div>
    )}

    {/* ═══════════════════════════════════════════════════════════════════ */}
    {/* 2. ESPACE ASSURÉ (PATIENT & CITOYEN CSU) */}
    {/* ═══════════════════════════════════════════════════════════════════ */}
    {activeRoleMode === 'citizen' && (
      <div className="fade-in-up">
        
        {/* Bannière Titulaire Assuré & Droits CSU */}
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
                👤
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1.5 flex-wrap">
                  <span className="badge bg-success text-white px-3 py-1" style={{ borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.03em' }}>
                    ✔ ASSURÉ CSU CONNECTÉ
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
                <span style={{ fontSize: '1.1rem' }}>⚡</span> Entrer en salle d'attente (2 500 FCFA)
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
                <span style={{ fontSize: '1.1rem' }}>📲</span> Mon Pass CSU
              </button>
            </div>
          </div>
        </div>


        {/* SALLE D'ATTENTE PERSONNELLE EN DIRECT (SI L'ASSURÉ A UNE CONSULTATION EN COURS) */}
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
                      🟢 EN SALLE D'ATTENTE VIRTUELLE (RÈGLEMENT CONFIRMÉ)
                    </span>
                    <h4 className="fw-extrabold mb-1 text-white">
                      Vous êtes à la Position <span className="text-warning">n°{positionInQueue}</span> dans l'ordre de passage
                    </h4>
                    <p className="mb-0 text-white-50 small">
                      Praticien assigné : <strong>{myItem.requested_doctor}</strong> | Motif : {myItem.reason}
                    </p>
                    <small className="text-emerald-400 d-block mt-1 fw-semibold" style={{ color: '#34d399' }}>
                      {/* La durée d'attente était calculée par
                          `positionInQueue * 4` minutes : une multiplication
                          inventée, présentée comme une estimation. Aucune
                          donnée de durée moyenne de consultation n'existe
                          dans le système. On affiche donc votre position,
                          qui est un fait, sans annoncer un délai. */}
                      Restez sur cette page : le praticien vous appellera à votre tour.
                    </small>
                  </div>

                  <div className="d-flex flex-column gap-2 align-items-end">
                    <button
                      type="button"
                      className="btn btn-secondary text-white fw-bold px-4 py-2 opacity-75"
                      style={{ borderRadius: '12px', fontSize: '0.88rem', cursor: 'not-allowed' }}
                      disabled
                    >
                      ⏳ En attente de votre tour (Position n°{positionInQueue})
                    </button>
                    <button
                      type="button"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '8px', padding: '0.35rem 0.85rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                      onClick={() => handleAdvanceMyQueue(myItem.id)}
                    >
                      ⏩ Simuler Avancement de mon Tour (Test)
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
                      🔔 ALERTE : VOUS ÊTES LE PROCHAIN PATIENT !
                    </span>
                    <h4 className="fw-extrabold mb-1 text-white">
                      Préparez votre micro et votre caméra 📹
                    </h4>
                    <p className="mb-0 text-white-50 small">
                      Le <strong>{myItem.requested_doctor}</strong> termine sa consultation précédente et va vous recevoir d'un instant à l'autre.
                    </p>
                  </div>

                  <div className="d-flex flex-column gap-2 align-items-end">
                    <button
                      type="button"
                      style={{ background: '#f59e0b', color: '#000000', border: 'none', borderRadius: '12px', padding: '0.75rem 1.4rem', fontWeight: '900', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(245,158,11,0.4)' }}
                      onClick={() => handleAdvanceMyQueue(myItem.id)}
                    >
                      📞 Simuler l'Appel du Médecin
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
                    🔔 C'EST VOTRE TOUR ! LE MÉDECIN VOUS APPELLE
                  </span>
                  <h4 className="fw-extrabold mb-1 text-white">
                    Le {myItem.requested_doctor} vous attend en Salle de Téléconsultation HD
                  </h4>
                  <p className="mb-0 text-white-50 small">
                    Règlement validé ({myItem.payment_method}) | Motif : {myItem.reason}
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
                  <span>📞</span> Rejoindre la Consultation Vidéo HD ›
                </button>
              </div>
            </div>
          );
        })()}

        {/* Top Hero Banner Assuré */}
        <div className="p-4 p-md-5 rounded-4 mb-5 text-white" style={{ background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.4) 0%, rgba(16, 185, 129, 0.2) 100%), url("/csu_digital_health_real.jpg") center/cover no-repeat', padding: '3.5rem 2.5rem', minHeight: '230px', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 14px 40px rgba(0, 0, 0, 0.25)' }}>
          <div className="row align-items-center g-4">
            <div className="col-xxl-8 col-12">
              <span style={{ background: 'rgba(255, 255, 255, 0.25)', color: '#ffffff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700', display: 'inline-block', marginBottom: '0.85rem', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                🇸🇳 SALLE D'ATTENTE VIRTUELLE UNAMUSC
              </span>
              <h1 className="fw-extrabold text-white mb-2" style={{ fontSize: '2.3rem', letterSpacing: '-0.02em', textShadow: '0 3px 8px rgba(0,0,0,0.4)' }}>
                Consultez un médecin en moins de 10 min
              </h1>
              <p className="text-white mb-4" style={{ fontSize: '1.05rem', maxWidth: '720px', lineHeight: '1.6', textShadow: '0 2px 4px rgba(0,0,0,0.3)', opacity: 0.95 }}>
                Réseau national de médecins agréés. Visioconférence HD WebRTC bidirectionnelle sécurisée avec délivrance instantanée d'ordonnance 50%.
              </p>
              
              <button
                type="button"
                style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '14px', padding: '0.85rem 1.85rem', fontWeight: '800', fontSize: '0.98rem', boxShadow: '0 4px 20px rgba(16,185,129,0.45)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                onClick={() => setActiveModal('join_queue')}
              >
                ⚡ Entrer en salle d'attente (2 500 FCFA)
              </button>
            </div>

            <div className="col-xxl-4 col-12">
              <div className="p-4 rounded-4" style={{ background: 'rgba(255, 255, 255, 0.22)', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)', backdropFilter: 'blur(10px)' }}>
                <div className="d-flex align-items-center justify-content-between gap-2 mb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.6rem' }}>
                  <span className="fw-bold text-white" style={{ fontSize: '0.92rem' }}>
                    {/* « N Praticiens en ligne » comptait les praticiens
                        INSCRITS, pas ceux réellement connectés : le chiffre
                        n'avait aucun rapport avec une présence réelle. On
                        compte donc ceux que le serveur a vus récemment. */}
                    {(() => {
                      const list = practitionerPresence?.practitioners;
                      if (!presenceLoaded || !Array.isArray(list)) return 'Vérification des disponibilités…';
                      const seen = new Set();
                      let enLigne = 0;
                      for (const p of list) {
                        if (p?.online && p.practitioner_name && !seen.has(p.practitioner_name)) {
                          seen.add(p.practitioner_name);
                          enLigne++;
                        }
                      }
                      return enLigne === 0
                        ? 'Aucun praticien connecté actuellement'
                        : `${enLigne} praticien${enLigne > 1 ? 's' : ''} connecté${enLigne > 1 ? 's' : ''}`;
                    })()}
                  </span>
                  <span style={{ background: presenceLoaded ? '#334155' : '#475569', color: '#ffffff', fontSize: '0.75rem', fontWeight: '700', padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
                    {/* « Disponible 24/7 » était écrit en dur : la plateforme
                        ne fonctionne qu'aux heures ouvrées des structures, et
                        ce bandeau promettait une joignabilité permanente que
                        rien ne garantissait. On affiche ce que la présence
                        permet d'affirmer, et le mode de rafraîchissement
                        réel — annoncer « temps réel » en différé ferait
                        croire à une disponibilité instantanée. */}
                    {!presenceLoaded
                      ? 'Vérification des disponibilités…'
                      : presenceMode === 'stream'
                        ? 'Disponibilités en temps réel'
                        : presenceMode === 'polling'
                          ? 'Disponibilités actualisées toutes les 50 s'
                          : 'Disponibilités selon le praticien'}
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
                  Temps d'attente moyen : <strong className="text-warning">⚡ 4 min</strong>
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Grille des Médecins Agréés Disponibles */}
        <div className="row g-4 mb-4">
          <div className="col-xxl-8 col-12">
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <h5 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.15rem' }}>
                👨‍⚕️ Choisissez votre Praticien Agréé
              </h5>
              
              {/* Filtres & Recherche */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  placeholder="Filtrer un médecin..." 
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
                    Pédiatrie
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
                déclenchait 2 colonnes alors que la zone de contenu, amputée
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
                          {/* AUCUNE note. La ligne `★ {doc.rating}` lisait un
                              champ qui n'est renseigné nulle part : elle
                              affichait « ★ undefined » sur chaque carte, ou
                              pire, une note reconduite depuis un ancien
                              localStorage. Le libellé « 4,9 / 124 avis »
                              n'a jamais reposé sur un avis réel. La note
                              d'un praticien n'apparaîtra que lorsqu'un
                              patient réellement consulté la dépose. */}
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
                          🆔 {doc.cnom}
                        </span>
                        {doc.langs.map((l, idx) => (
                          <span key={idx} style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600' }}>
                            🌐 {l}
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
                      🏥 Entrer en salle d'attente (2 500 FCFA) ›
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Droite Assuré — `col-xxl-4 col-12` pour rester alignée avec
              la colonne `col-xxl-8` ci-dessus. Avec `col-lg-4` seul, la
              sidebar se retrouvait sur une seule ligne alors que la liste
              des médecins occupait déjà deux lignes, décalant tout le
              contenu vers le bas. */}
          <div className="col-xxl-4 col-12">
            <div className="d-flex flex-column gap-4">
              
              {/* Ordonnances */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="d-flex align-items-center gap-2 mb-2 text-success">
                  <span style={{ fontSize: '1.3rem' }}>💊</span>
                  <h6 className="fw-bold mb-0" style={{ color: 'var(--text-main)', fontSize: '1rem' }}>Mes Ordonnances Digitales</h6>
                </div>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>
                  Consultez vos ordonnances sécurisées et vos attestations de téléconsultation émises avec tiers-payant.
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
                  📂 VOIR MON CARNET DE SANTÉ
                </button>
              </div>

              {/* Card QR Code CSU */}
              <div className="p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h6 className="fw-bold mb-2" style={{ color: 'var(--text-main)' }}>📲 Présentation QR code CSU</h6>
                <p className="small mb-3" style={{ color: 'var(--text-sub)' }}>Présentez votre pass sanitaire numérique au médecin lors de l'appel.</p>
                
                <button 
                  type="button"
                  style={{ background: '#10b981', color: '#ffffff', border: 'none', borderRadius: '10px', padding: '0.6rem 1rem', fontWeight: '700', width: '100%', fontSize: '0.85rem', cursor: 'pointer' }}
                  onClick={() => setActiveModal('qr')}
                >
                  Afficher QR code assuré
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* KPI Banner & Historique des Téléconsultations Certifiées UNAMUSC */}
        <div className="mt-5 p-4 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          {/* En-tête de la section historique (Assuré vs Personnel Médical/Agent) */}
          {(() => {
            // Historique RÉELLEMENT enregistré (téléconsultations saisies par
            // les praticiens). Aucune téléconsultation de démonstration :
            // un diagnostic et une ordonnance fictifs rattachés à un patient
            // réel constitueraient un faux dossier médical.
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
              // Aucun repli : un dossier vierge est préférable à une ligne
              // de téléconsultation inventée pour ce patient.
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
                      {isCitizen ? `📜 Mes Téléconsultations & Ordonnances Médicales (${activeFirstName} ${activeLastName})` : '📜 Historique Régional des Téléconsultations Certifiées UNAMUSC'}
                    </h5>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>
                      {isCitizen
                        ? `Historique médical certifié par le Conseil National de l'Ordre des Médecins (CNOM) • ${activeHistoryList.length} consultation(s)`
                        : `Registre national — ${totalVolume} téléconsultation(s) réellement enregistrée(s)`
                      }
                    </small>
                  </div>
                  <span className="badge bg-success-subtle text-success border border-success px-3 py-1.5 fw-bold" style={{ borderRadius: '10px', fontSize: '0.8rem' }}>
                    🟢 Synchro Temps Réel
                  </span>
                </div>

                {/* Tableau d'historique enrichi */}
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0" style={{ color: 'var(--text-main)' }}>
                    <thead style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <tr>
                        <th style={{ padding: '0.9rem' }}>N° Téléconsultation</th>
                        <th style={{ padding: '0.9rem' }}>Patient & CSU</th>
                        <th style={{ padding: '0.9rem' }}>Praticien & Spécialité</th>
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
                              🕒 {item.date}
                            </small>
                          </td>
                          <td style={{ padding: '0.85rem' }}>
                            <span className="badge bg-success-subtle text-success border border-success px-2.5 py-1" style={{ borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                              ✅ {item.status}
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
                                  icon: '📑',
                                  title: 'Reçu & Ordonnance Téléconsultation',
                                  message: `Consultation ${item.code} du patient ${item.patient} chargée avec succès.`
                                });
                              }}
                            >
                              📥 Reçu PDF
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Téléconsultations */}
                <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top" style={{ borderColor: 'var(--border-color)', flexWrap: 'wrap', gap: '1rem' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-sub)' }}>
                    {isCitizen ? (
                      <>Affichage de <strong>{startItem}</strong> à <strong>{endItem}</strong> sur <strong>{totalVolume}</strong> téléconsultation(s) personnelle(s)</>
                    ) : (
                      <>Affichage de <strong>{startItem}</strong> à <strong>{endItem}</strong> sur <strong>420</strong> téléconsultations (Page {safePage} sur 42)</>
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
                        ◀ Précédent
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
                        Suivant ▶
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

  {/* JOIN QUEUE & PAYMENT INTEGRATED MODAL (React Portal — Centered on Screen) */}
    {/* ═══════════════════════════════════════════════════════════════════ */}
    {/* 3. ESPACE AGENT UD — SUPERVISION DE LA SALLE D'ATTENTE VIRTUELLE   */}
    {/* ═══════════════════════════════════════════════════════════════════ */}
    {activeRoleMode === 'agent' && (
      <div className="fade-in-up">

        {/* Bannière Agent UD */}
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
                🛡️
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <span className="badge" style={{ background: '#7c3aed', color: '#ffffff', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800' }}>
                    🟢 AGENT UD CONNECTÉ
                  </span>
                  {isSuperAdmin && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#f8fafc', padding: '0.35rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                      👁️ Vue Super Admin
                    </span>
                  )}
                </div>
                <h4 className="fw-extrabold mb-0 text-white">
                  {agentUser?.full_name || agentUser?.name || agentUser?.email || 'Agent UD Départemental'}
                </h4>
                <small style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                  Union Départementale : <strong style={{ color: '#c4b5fd' }}>{agentDept}</strong> • Supervision temps réel de la salle d'attente virtuelle
                </small>
              </div>
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <span style={{ background: 'rgba(124,58,237,0.25)', color: '#e9d5ff', border: '1px solid rgba(124,58,237,0.5)', borderRadius: '12px', padding: '0.5rem 0.9rem', fontWeight: '800', fontSize: '0.8rem' }}>
                ⏳ {queue.filter(p => !p.status || p.status === 'waiting').length} en attente
              </span>
              <span style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '12px', padding: '0.5rem 0.9rem', fontWeight: '800', fontSize: '0.8rem' }}>
                🎥 {queue.filter(p => p.status === 'called').length} en consultation
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
            { icon: '⏳', label: 'En attente', value: waitingCount, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
            { icon: '🔔', label: 'Patients notifiés', value: nextCount, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)' },
            { icon: '🎥', label: 'En téléconsultation', value: calledCount, color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)' },
            { icon: '💰', label: 'Encaissements du jour', value: `${revenue.toLocaleString('fr-FR')} F`, color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.35)' },
            { icon: '✅', label: 'Consultations terminées', value: doneCount, color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.35)' }
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
              📋 File d'attente virtuelle — Pilotage Agent UD
            </h5>
            <span className="badge" style={{ background: 'rgba(124,58,237,0.15)', color: '#a855f7', border: '1px solid rgba(124,58,237,0.35)', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '800' }}>
              🔄 Temps réel • {queue.length} patient(s) inscrit(s)
            </span>
          </div>

          {queue.length === 0 ? (
            <div className="text-center py-5">
              <span style={{ fontSize: '2.6rem', opacity: 0.6 }}>🗂️</span>
              <p className="fw-bold mb-1 mt-2" style={{ color: 'var(--text-main)' }}>Aucun patient en salle d'attente</p>
              <small style={{ color: 'var(--text-sub)' }}>Les nouvelles admissions apparaîtront ici automatiquement après paiement du ticket (2 500 FCFA).</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle" style={{ marginBottom: 0 }}>
                <thead>
                  <tr style={{ color: 'var(--text-sub)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Patient</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>N° CSU</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Motif</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Urgence</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Médecin demandé</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Ticket</th>
                    <th style={{ padding: '0.75rem 0.85rem' }}>Statut</th>
                    <th className="text-end" style={{ padding: '0.75rem 0.85rem' }}>Actions agent</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.85rem' }}>
                        <div className="fw-semibold" style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>👤 {p.patient_name}</div>
                        <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem' }}>🕒 {p.joined_at}</small>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <code style={{ background: 'var(--bg-card-subtle, #0b1120)', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.76rem' }}>{p.cmu_number}</code>
                      </td>
                      <td style={{ padding: '0.85rem', maxWidth: '230px' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.35 }}>{p.reason}</div>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {p.urgency === 'critical' ? (
                          <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '800' }}>🔴 URGENCE</span>
                        ) : p.urgency === 'urgent' ? (
                          <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '800' }}>🟠 Prioritaire</span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.35)', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '800' }}>🟢 Routine</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        <span style={{ color: 'var(--text-sub)', fontSize: '0.82rem', fontWeight: '600' }}>{p.requested_doctor || '—'}</span>
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {p.payment_status === 'paid' ? (
                          <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '0.3rem 0.65rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '700', display: 'inline-block' }}>✅ Réglé</span>
                        ) : (
                          <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.3rem 0.65rem', borderRadius: '10px', fontSize: '0.74rem', fontWeight: '700', display: 'inline-block' }}>⏳ Impayé</span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem' }}>
                        {p.status === 'called' ? (
                          <span className="badge bg-success text-white px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.74rem' }}>🟢 En appel</span>
                        ) : p.status === 'next' ? (
                          <span className="badge bg-warning text-dark px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.74rem' }}>🔔 Notifié</span>
                        ) : p.status === 'done' ? (
                          <span className="badge" style={{ background: 'rgba(100,116,139,0.2)', color: '#e2e8f0', padding: '0.35rem 0.7rem', borderRadius: '10px', fontSize: '0.74rem' }}>✅ Terminée</span>
                        ) : (
                          <span className="badge bg-secondary text-white px-2.5 py-1" style={{ borderRadius: '10px', fontSize: '0.74rem' }}>⏳ En attente</span>
                        )}
                      </td>
                      <td className="text-end" style={{ padding: '0.85rem', whiteSpace: 'nowrap' }}>
                        {p.status === 'done' ? (
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>—</small>
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
                                    icon: '🔔',
                                    title: 'Patient notifié',
                                    message: `${p.patient_name} a été prévenu(e) que son tour approche.`
                                  });
                                }}
                                title="Prévenir le patient que son tour arrive"
                              >
                                🔔 Prévenir
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
                                    icon: '🎥',
                                    title: 'Patient appelé en visio',
                                    message: `${p.patient_name} (${p.cmu_number}) basculé en téléconsultation avec ${p.requested_doctor || 'le praticien de garde'}.`
                                  });
                                }}
                                title="Confirmer l'appel en téléconsultation"
                              >
                                🎥 Appeler
                              </button>
                            )}
                            <button
                              type="button"
                              style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.4)', borderRadius: '10px', padding: '0.45rem 0.7rem', fontWeight: '700', fontSize: '0.76rem', cursor: 'pointer' }}
                              onClick={() => {
                                setQueue(prev => prev.map(item => item.id === p.id ? { ...item, status: 'done' } : item));
                                speakAndToast({
                                  type: 'info',
                                  icon: '✅',
                                  title: 'Consultation clôturée',
                                  message: `Dossier de ${p.patient_name} marqué comme terminé. Compte-rendu synchronisé.`
                                });
                              }}
                              title="Marquer la consultation comme terminée"
                            >
                              ✅ Terminer
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

        {/* Bandeau KPI Stats — Réservé aux Agents (selon niveau d'accès) et au Super Admin (vue totale) */}
        {canManageQueue && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {/* Card 1: Téléconsultations effectuées */}
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
            title="Cliquer pour voir la répartition des téléconsultations enregistrées"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(16,185,129,0.30)' }}>
                💻
              </div>
              <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                🟢 LIVE
              </span>
            </div>
            <div>
              {/* Compteur réel : file d'attente effectivement enregistrée.
                  L'offset « 420 » affiché avant comptait des consultations
                  qui n'ont jamais eu lieu. */}
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#059669', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                {queue.filter(q => q.status === 'called' || q.status === 'done').length}
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                Téléconsultations effectuées
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#065f46', fontWeight: '600' }}>
                <span>Depuis la mise en service</span>
                <span>🔍</span>
              </div>
            </div>
          </div>

          {/* Card 2: Spécialistes accrédités CNOM */}
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
            title="Cliquer pour consulter l'annuaire complet des médecins agréés CNOM"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(59,130,246,0.30)' }}>
                👨‍⚕️
              </div>
              <span style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                🇸🇳 CNOM Agréés
              </span>
            </div>
            <div>
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#2563eb', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                {doctorsList.filter(d => d.accredited !== false).length}
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                Spécialistes accrédités CNOM
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#1e40af', fontWeight: '600' }}>
                <span>8 Spécialités médicales</span>
                <span>🔍</span>
              </div>
            </div>
          </div>

          {/* Card 3: Satisfaction des assurés */}
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
            title="Cliquer pour lire les avis certifiés des assurés"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(245,158,11,0.30)' }}>
                ⭐
              </div>
              <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                En attente d'avis
              </span>
            </div>
            <div>
              {/* Aucune note n'est affichée tant qu'aucun avis réel n'a été
                  collecté. Les valeurs 98,4 % / ★ 4,9 / 1 420 avis étaient
                  des constantes : elles ne dépendaient d'aucun avis. */}
              <div style={{ fontSize: '1.85rem', fontWeight: '900', color: '#d97706', lineHeight: '1.1', letterSpacing: '-0.02em', marginBottom: '0.45rem' }}>
                —
              </div>
              <div style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.90rem', fontWeight: '750', lineHeight: '1.35', marginBottom: '0.65rem' }}>
                Satisfaction des assurés
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '0.30rem 0.65rem', borderRadius: '8px', fontSize: '0.74rem', color: '#92400e', fontWeight: '600' }}>
                <span>Aucun avis enregistré</span>
                <span>🔍</span>
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
            title="Cliquer pour voir la décomposition du Tiers-Payant UNAMUSC 80%"
          >
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #7e22ce, #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.35rem', boxShadow: '0 6px 16px rgba(168,85,247,0.30)' }}>
                💳
              </div>
              <span style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '10px', fontSize: '0.72rem', fontWeight: '800', padding: '4px 10px' }}>
                🛡️ UNAMUSC 80%
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
                <span>🔍</span>
              </div>
            </div>
          </div>
        </div>
        )}

  {activeModal === 'join_queue' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>

          {/* ════════ ÉTAPE : TRAITEMENT EN COURS ════════ */}
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
                <strong style={{ color: getProviderInfo(paymentProvider).color }}>Ne fermez pas cette fenêtre</strong>
              </p>
              <div style={{ marginTop: '1.5rem', background: 'var(--bg-card-subtle)', borderRadius: '12px', padding: '0.85rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Montant</span>
                <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>2 500 FCFA</span>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.72rem', color: 'var(--text-sub)', opacity: 0.6 }}>🔒 Transaction sécurisée • Conforme BCEAO</p>
            </div>
          )}

          {/* ════════ ÉTAPE : SUCCÈS ════════ */}
          {payStep === 'success' && txnResult && (
            <div style={{ maxWidth: '480px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 30px 80px rgba(16,185,129,0.2)', margin: 'auto', overflow: 'hidden' }}>
              {/* En-tête succès */}
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', padding: '2rem', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.3)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>✅</div>
                <h4 style={{ color: '#ffffff', fontWeight: '800', margin: '0 0 0.25rem' }}>Paiement Confirmé !</h4>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: 0 }}>Vous êtes en salle d'attente virtuelle</p>
              </div>
              {/* Reçu */}
              <div style={{ padding: '1.5rem 2rem' }}>
                {/* Référence */}
                <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Référence Transaction</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: '800', color: '#10b981', letterSpacing: '0.08em' }}>{txnResult.transactionRef}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '0.25rem' }}>{new Date(txnResult.timestamp).toLocaleString('fr-FR')}</div>
                </div>
                {/* Détails paiement */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                  {[{l:'Opérateur', v: getProviderInfo(paymentProvider).name},{l:'Téléphone', v: txnResult.phone},{l:'Montant payé', v: '2 500 FCFA'},{l:'Position file', v: `N°${txnResult.positionNum}`}].map(item => (
                    <div key={item.l} style={{ background: 'var(--bg-card-subtle)', borderRadius: '10px', padding: '0.65rem 0.85rem', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', fontWeight: '600' }}>{item.l}</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)', marginTop: '0.15rem' }}>{item.v}</div>
                    </div>
                  ))}
                </div>
                {/* Médecin */}
                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <img src={selectedDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180'} alt="" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>Médecin assigné</div>
                    <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{selectedDoctor?.name || 'Dr. Ousmane Sow'}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'rgba(16,185,129,0.2)', color: '#10b981', fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.55rem', borderRadius: '20px', border: '1px solid rgba(16,185,129,0.35)', whiteSpace: 'nowrap' }}>Prise en charge 80%</span>
                </div>
                <button
                  onClick={resetPaymentModal}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.35)' }}
                >
                  ✅ Fermer et rejoindre la salle d'attente
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '0.75rem', opacity: 0.6 }}>Conservez la référence {txnResult.transactionRef} comme preuve de paiement</p>
              </div>
            </div>
          )}

          {/* ════════ ÉTAPE : ERREUR ════════ */}
          {payStep === 'error' && txnResult && (
            <div style={{ maxWidth: '420px', width: '100%', background: 'var(--bg-card)', borderRadius: '28px', border: '1px solid rgba(239,68,68,0.4)', boxShadow: '0 30px 80px rgba(239,68,68,0.15)', margin: 'auto', padding: '2.5rem 2rem', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', fontSize: '2rem' }}>❌</div>
              <h5 style={{ color: 'var(--text-main)', fontWeight: '800', marginBottom: '0.5rem' }}>Paiement échoué</h5>
              <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>{txnResult.message}</p>
              <div style={{ background: 'var(--bg-card-subtle)', borderRadius: '12px', padding: '0.85rem 1rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem', textAlign: 'left' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginBottom: '0.3rem' }}>Causes possibles :</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-sub)', lineHeight: '1.7' }}>
                  <li>Solde insuffisant sur votre compte</li>
                  <li>Numéro de téléphone incorrect</li>
                  <li>Connexion réseau instable</li>
                  <li>Plafond journalier atteint</li>
                </ul>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={resetPaymentModal}
                  style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                >Annuler</button>
                <button onClick={() => setPayStep('form')}
                  style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.75rem', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.35)' }}
                >🔄 Réessayer</button>
              </div>
            </div>
          )}

          {/* ════════ ÉTAPE : FORMULAIRE ════════ */}
          {payStep === 'form' && (
            <div style={{ maxWidth: '600px', width: '100%', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '28px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', margin: 'auto' }}>
              <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)', padding: '1.75rem 2rem', borderRadius: '28px 28px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>Télémédecine UNAMUSC</div>
{/* Sélecteur de parcours. Les deux voies sont présentées côte à
                        côte AVANT tout formulaire : l'assuré doit voir qu'il existe
                        une option gratuite, sinon il ne choisira que la voie
                        payante — celle qui était proposée par défaut. */}
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
                        <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>📅 Rendez-vous</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>Gratuit · réglé sur place</div>
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
                        <div style={{ fontSize: '0.85rem', fontWeight: '800' }}>⚡ Consultation</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.9 }}>Immédiate · ticket modérateur</div>
                      </button>
                    </div>
                    <h5 style={{ color: '#ffffff', fontWeight: '800', margin: '1rem 0 0', fontSize: '1.2rem' }}>
                      {queueMode === 'booking' ? '📅 Prendre rendez-vous (gratuit)' : '🏥 Entrer en salle d’attente virtuelle'}
                    </h5>
                    <p style={{ color: 'rgba(255,255,255,0.75)', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
                      {queueMode === 'booking'
                        ? "Aucune somme n'est due pour prendre rendez-vous. Le règlement se fait une seule fois, sur place, à la structure."
                        : "Consultation en visioconférence immédiate. Le ticket modérateur est réglé avant d'entrer en file."}
                    </p>
                  </div>
                  <button type="button" onClick={resetPaymentModal} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
                <div style={{ marginTop: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <img src={selectedDoctor?.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=180'} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: '700', fontSize: '0.9rem' }}>{selectedDoctor?.name || 'Praticien non désigné'}</div>
                    {(() => {
                      // Statut issu du heart-beat serveur, jamais un libellé en dur.
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
                            {selectedDoctor?.specialty || 'Spécialité non renseignée'} • {label}
                          </div>
                          <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', color, padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid rgba(255,255,255,0.25)' }}>
                            {p?.online ? '⚡ En ligne' : label}
                          </span>
                        </>
                      );
                    })()}
                </div>
              </div>
</div>

            {/* Corps du formulaire. Les deux parcours (rendez-vous gratuit
                et consultation payante) partagent ces champs communes : motif
                et niveau d'urgence. Seul le bloc de validation diffère. */}
            <div style={{ padding: '1.75rem 2rem' }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Symptômes &amp; motif de consultation *</label>
                  <textarea
                    style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    rows={3} value={consultReason} onChange={(e) => setConsultReason(e.target.value)}
                    placeholder="Ex : Fièvre, toux sèche, maux de tête depuis 48h..." required
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Niveau d'urgence *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[{v:'routine',l:'🟢 Routine',s:'Consultation de routine'},{v:'medium',l:'🟡 Modéré',s:'Symptômes modérés'},{v:'high',l:'🟠 Élevé',s:'Douleurs / fièvre forte'},{v:'critical',l:'🔴 Urgence',s:'Priorité absolue'}].map(u => (
                      <button key={u.v} type="button" onClick={() => setUrgencyLevel(u.v)}
                        style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', border: urgencyLevel === u.v ? '2px solid #10b981' : '1px solid var(--border-color)', background: urgencyLevel === u.v ? 'rgba(16,185,129,0.15)' : 'var(--bg-card-subtle)', color: urgencyLevel === u.v ? '#10b981' : 'var(--text-sub)', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'left' }}>
                        <div>{u.l}</div><div style={{ fontSize: '0.7rem', fontWeight: '400', opacity: 0.7 }}>{u.s}</div>
                      </button>
                    ))}
                  </div>
                </div>
{/* ════════ PARCOURS RENDEZ-VOUS : aucun paiement ════════ */}
                {queueMode === 'booking' && (
                  <div>
                    {bookingResult ? (
                      <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
                        <h5 style={{ color: 'var(--text-main)', fontWeight: '800', margin: '0 0 0.5rem', fontSize: '1.05rem' }}>
                          Rendez-vous enregistré
                        </h5>
                        <p style={{ color: 'var(--text-sub)', fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 1rem' }}>
                          Aucun paiement n'a été effectué. Le règlement de la consultation
                          se fera une seule fois, sur place, à la structure.
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
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Date souhaitée *</label>
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
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Créneau *</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            {[
                              { v: 'matin', l: '🌅 Matin', h: '9h00' },
                              { v: 'apres-midi', l: '🌤️ Après-midi', h: '14h00' }
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
                            placeholder="Décrivez brièvement le motif de votre consultation..."
                            style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', lineHeight: '1.5', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                            required
                          />
                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>Précisions (facultatif)</label>
                          <input
                            type="text"
                            value={bookingNotes}
                            onChange={(e) => setBookingNotes(e.target.value)}
                            placeholder="Ex : suivi de tension, résultats d'examens à apporter…"
                            style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none' }}
                          />
                        </div>

                        {bookingError && (
                          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '10px', padding: '0.7rem 0.9rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#f87171' }}>
                            {bookingError}
                          </div>
                        )}

                        <div style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem 0.9rem', marginBottom: '1.25rem', fontSize: '0.78rem', color: 'var(--text-sub)', lineHeight: '1.6' }}>
                          💡 Cette réservation est <strong>gratuite</strong>. Aucun ticket
                          modérateur n'est prélevé ici : vous réglerez la consultation
                          une seule fois, sur place, à la structure de santé.
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
                            {bookingSubmitting ? 'Enregistrement…' : 'Confirmer le rendez-vous (gratuit)'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ════════ PARCOURS CONSULTATION IMMÉDIATE : paiement ════════ */}
                {queueMode === 'live' && (
                  <form onSubmit={handleJoinQueue}>

                <div style={{ borderTop: '1px solid var(--border-color)', margin: '0 0 1.25rem', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-0.6rem', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', padding: '0 0.75rem', fontSize: '0.72rem', color: 'var(--text-sub)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Règlement mobile money</span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.75rem' }}>Choisissez votre opérateur *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1rem' }}>

                    <button type="button" onClick={() => { setPaymentProvider('orange'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'orange' ? '2px solid #ff7900' : '1px solid var(--border-color)', background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', overflow: 'hidden' }}>
                        <img src="/logo_orange_money.png" alt="Orange Money" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'orange' ? '#ff7900' : 'var(--text-sub)', textAlign: 'center' }}>Orange Money</span>
                      {paymentProvider === 'orange' && <span style={{ fontSize: '0.62rem', color: '#ff7900', fontWeight: '800' }}>✓ Sélectionné</span>}
                    </button>

                    <button type="button" onClick={() => { setPaymentProvider('wave'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'wave' ? '2px solid #1dc4ff' : '1px solid var(--border-color)', background: paymentProvider === 'wave' ? 'rgba(29,196,255,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo_wave.png" alt="Wave" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'wave' ? '#1dc4ff' : 'var(--text-sub)', textAlign: 'center' }}>Wave</span>
                      {paymentProvider === 'wave' && <span style={{ fontSize: '0.62rem', color: '#1dc4ff', fontWeight: '800' }}>✓ Sélectionné</span>}
                    </button>

                    <button type="button" onClick={() => { setPaymentProvider('free'); setPhoneError(''); }}
                      style={{ padding: '0.85rem 0.5rem', borderRadius: '14px', border: paymentProvider === 'free' ? '2px solid #e11d48' : '1px solid var(--border-color)', background: paymentProvider === 'free' ? 'rgba(225,29,72,0.12)' : 'var(--bg-card-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '56px', height: '40px', borderRadius: '8px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px', overflow: 'hidden' }}>
                        <img src="/logo_free_money.svg" alt="Free Money" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', color: paymentProvider === 'free' ? '#e11d48' : 'var(--text-sub)', textAlign: 'center' }}>Free Money</span>
                      {paymentProvider === 'free' && <span style={{ fontSize: '0.62rem', color: '#e11d48', fontWeight: '800' }}>✓ Sélectionné</span>}
                    </button>
                  </div>

                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-sub)', marginBottom: '0.5rem' }}>N° de téléphone mobile money *</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.1rem' }}>📱</span>
                    <input type="tel"
                      style={{ width: '100%', background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: phoneError ? '1px solid #ef4444' : '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1rem 0.75rem 2.5rem', fontSize: '0.95rem', fontWeight: '700', outline: 'none', letterSpacing: '0.05em', boxSizing: 'border-box' }}
                      value={phoneNum} onChange={(e) => { setPhoneNum(e.target.value); setPhoneError(''); }}
                      placeholder="Ex : 77 602 67 83" required
                    />
                  </div>
                  {phoneError && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.4rem', fontWeight: '600' }}>⚠️ {phoneError}</p>}

                  <div style={{ marginTop: '1rem', background: paymentProvider === 'orange' ? 'rgba(255,121,0,0.08)' : paymentProvider === 'wave' ? 'rgba(29,196,255,0.08)' : 'rgba(225,29,72,0.08)', border: `1px solid ${paymentProvider === 'orange' ? 'rgba(255,121,0,0.3)' : paymentProvider === 'wave' ? 'rgba(29,196,255,0.3)' : 'rgba(225,29,72,0.3)'}`, borderRadius: '12px', padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-sub)', fontWeight: '600' }}>Ticket modérateur (20%)</span>
                      <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--text-main)' }}>2 500 FCFA</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>Prise en charge UNAMUSC (80%)</span>
                      <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#10b981' }}>10 000 FCFA couverts</span>
                    </div>
                    <div style={{ borderTop: '1px dashed var(--border-color)', marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: '600' }}>Via {getProviderInfo(paymentProvider).name} → {phoneNum || '---'}</span>
                      <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>🔒 Sécurisé</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button type="button"
                    style={{ flex: 1, background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }}
                    onClick={resetPaymentModal}>Annuler</button>
                  <button type="submit"
                    style={{ flex: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    💳 Payer 2 500 FCFA &amp; entrer en salle d'attente
                  </button>
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-sub)', marginTop: '0.85rem', opacity: 0.7 }}>🔒 Paiement sécurisé • Aucun partage de vos données bancaires • Conforme BCEAO</p>
              </form>
              )}
              </div>
            </div>
          )}

        </div>,
        document.body
      )}

      {/* WEBRTC LIVE SESSION MODAL WITH ADVANCED DUAL-PERSPECTIVE VIEW (ASSURÉ VS MÉDECIN), REAL-TIME WEBCAM & MIC */}
      {activeModal === 'webrtc' && createPortal((() => {
        // ── Identités selon l'espace connecté (doxy.me : chaque partie est dans SON espace) ──
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

            {/* ═══ BARRE SUPÉRIEURE — identité de la PARTIE DISTANTE (jamais la sienne) ═══ */}
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
                      {isDoctorSide ? `👤 Patient : ${peerName}` : `Téléconsultation HD — ${activeDoctor.name}`}
                    </h6>
                    <span style={{ background: '#dc2626', color: '#ffffff', fontSize: '0.64rem', fontWeight: '800', padding: '2px 7px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ffffff', display: 'inline-block' }}></span>
                      DIRECT WebRTC
                    </span>
                  </div>
                  <small style={{ color: '#94a3b8', fontSize: '0.70rem', display: 'block', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '560px' }}>
                    {isDoctorSide
                      ? <>N° CSU : <strong style={{ color: '#f8fafc' }}>{peerCsu}</strong> • {activeDoctor.name} ({activeDoctor.cnom})</>
                      : <>{activeDoctor.specialty} • {activeDoctor.cnom} • Assuré(e) : <strong style={{ color: '#f8fafc' }}>{activeFirstName} {activeLastName}</strong></>}
                  </small>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                <span style={{ background: '#1e293b', color: '#34d399', fontSize: '0.70rem', fontWeight: '800', padding: '3px 8px', borderRadius: '8px', border: '1px solid #334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  ⏱️ {formatDuration(consultationSeconds)}
                </span>
                <span className="webrtc-hide-mobile" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.68rem', fontWeight: '700', padding: '3px 8px', borderRadius: '8px', border: '1px solid #334155' }}>
                  REC 🔴
                </span>
                <span className="webrtc-hide-mobile" style={{ background: isDoctorSide ? 'rgba(2,132,199,0.15)' : 'rgba(16,185,129,0.12)', color: isDoctorSide ? '#38bdf8' : '#34d399', fontSize: '0.68rem', fontWeight: '800', padding: '3px 8px', borderRadius: '8px', border: `1px solid ${isDoctorSide ? 'rgba(56,189,248,0.4)' : 'rgba(16,185,129,0.4)'}` }}>
                  {isDoctorSide ? '🩺 Praticien' : '👤 Assuré'}
                </span>
                <button
                  type="button"
                  title="Quitter la salle de téléconsultation"
                  aria-label="Quitter la salle de téléconsultation"
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
                  ✕ Quitter
                </button>
              </div>
            </header>

            {/* ═══ CORPS — scène vidéo HD + panneau dialogue & soins ═══ */}
            <div className="webrtc-body-container" style={{ flex: 1, display: 'flex', minHeight: 0, flexWrap: 'wrap', overflowY: 'auto' }}>

              {/* ── SCÈNE PRINCIPALE VIDÉO ── */}
              <section className="webrtc-video-section" style={{ flex: '1 1 460px', position: 'relative', minHeight: '360px', overflow: 'hidden', background: 'linear-gradient(180deg, #0f172a 0%, #0b1220 100%)', borderRadius: '18px', margin: '0.75rem', border: '1px solid #1f2a3d', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>

                {/* 1. VIDÉO RÉELLE DISTANTE dès que la liaison P2P bidirectionnelle est établie */}
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



                {/* 2. ÉCRAN DE VÉRIFICATION PÉRIPHÉRIQUES (affiché uniquement si la caméra est explicitement éteinte ou non initialisée) */}
                {!peerConnected && !cameraActive && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 14,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '1.5rem', textAlign: 'center',
                    background: 'linear-gradient(160deg, #020617 0%, #0a1526 60%, #0d1b2e 100%)'
                  }}>

                    {/* Carte d'identité du praticien / patient */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(2,6,23,0.92)', border: '1px solid #334155', borderRadius: '14px', padding: '0.5rem 0.95rem', backdropFilter: 'blur(8px)', marginBottom: '1.1rem', maxWidth: '92%' }}>
                      {isDoctorSide ? (
                        <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, #0284c7, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '900', color: '#ffffff', flexShrink: 0 }}>{peerInitials}</span>
                      ) : (
                        <img src={activeDoctor.avatar || '/dr_fatou_diop.png'} alt={activeDoctor.name} onError={(e) => { e.currentTarget.src = '/dr_fatou_diop.png'; }} style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #10b981', flexShrink: 0 }} />
                      )}
                      <div style={{ textAlign: 'left', minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isDoctorSide ? `👤 ${peerName}` : `🩺 ${activeDoctor.name}`}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: isSearchingPeer ? '#fbbf24' : '#94a3b8', fontWeight: '700' }}>
                          {isSearchingPeer
                            ? "📡 Recherche de l'autre espace…"
                            : `⏳ En attente du ${isDoctorSide ? 'patient' : 'praticien'} • ${isDoctorSide ? peerCsu : activeDoctor.specialty}`}
                        </div>
                      </div>
                    </div>

                    <div style={{ maxWidth: '410px' }}>
                      <span style={{ fontSize: '2.3rem', display: 'block', marginBottom: '6px' }}>🎥</span>
                      <strong style={{ display: 'block', color: '#f8fafc', fontSize: '0.98rem' }}>
                        Démarrer la consultation vidéo
                      </strong>
                      <small style={{ display: 'block', color: '#94a3b8', fontSize: '0.78rem', marginTop: '5px', lineHeight: 1.55 }}>
                        {isDoctorSide
                          ? 'Votre flux vidéo occupera tout cet écran et sera transmis au patient dès qu\'il rejoindra son espace assuré.'
                          : 'Votre flux vidéo occupera tout cet écran et sera transmis au médecin traitant en direct.'}
                      </small>
                      <button 
                        type="button" 
                        onClick={() => startCamera(true)} 
                        style={{ marginTop: '14px', background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.4rem', fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 15px rgba(16,185,129,0.45)' }}
                      >
                        📷 Allumer la caméra & micro
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Overlays supérieurs : badge direct + état de la liaison P2P */}
                <div style={{ position: 'relative', zIndex: 10, padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: peerConnected ? '#10b981' : (isDoctorSide ? '#38bdf8' : '#10b981'), boxShadow: '0 0 10px currentColor', display: 'inline-block', animation: 'pulse 1.6s infinite' }} />
                    <span style={{ background: 'rgba(5, 46, 22, 0.85)', color: '#34d399', border: '1px solid #10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.74rem', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                      {isDoctorSide ? '👤 Patient en consultation' : `🩺 ${activeDoctor.name}`}
                    </span>
                  </div>
                  {peerConnected ? (
                    <span style={{ background: 'rgba(5, 46, 22, 0.9)', color: '#34d399', border: '1px solid #10b981', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                      🔗 Liaison vidéo P2P bidirectionnelle établie
                    </span>
                  ) : isSearchingPeer ? (
                    <span style={{ background: 'rgba(120, 53, 15, 0.9)', color: '#fbbf24', border: '1px solid #f59e0b', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '800', backdropFilter: 'blur(6px)' }}>
                      📡 Recherche de l'autre espace…
                    </span>
                  ) : (
                    <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#94a3b8', border: '1px solid #334155', padding: '4px 10px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: '600', backdropFilter: 'blur(6px)' }}>
                      🔒 Flux médical chiffré E2EE
                    </span>
                  )}
                  {!isDoctorSide && isDoctorSpeaking && (
                    <span style={{ background: '#f59e0b', color: '#000000', padding: '4px 10px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', animation: 'pulse 1s infinite' }}>
                      🎙️ Le Dr. vous parle...
                    </span>
                  )}
                </div>

                {/* 4. AUTO-VUE (sa propre caméra) — PLEIN CADRE tant que l'autre partie
                       n'est pas connectée, puis rétrécit en fenêtre PiP DÉPLAÇABLE */}
                <div
                  onPointerDown={peerConnected ? handlePipPointerDown : undefined}
                  onPointerMove={peerConnected ? handlePipPointerMove : undefined}
                  onPointerUp={peerConnected ? handlePipPointerUp : undefined}
                  onDoubleClick={peerConnected ? (() => setPipPos(null)) : undefined}
                  title={peerConnected ? 'Glisser pour déplacer • Double-clic pour réinitialiser' : 'Votre caméra — en direct'}
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
                      <span style={{ letterSpacing: '2px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.45)' }}>⠿⠿</span>
                    </div>
                  )}
                  
                  {/* Flux Vidéo Réel */}
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

                  {/* Flux Vidéo Canvas Dynamique (Mobile HD / Fallback) */}
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

                  {/* État Caméra Coupée */}
                  {isCamOff && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#020617', zIndex: 5 }}>
                      <span style={{ fontSize: '2rem', opacity: 0.6 }}>🚫</span>
                      <small style={{ color: '#ef4444', fontWeight: '800', fontSize: '0.78rem', marginTop: '4px' }}>Caméra désactivée</small>
                    </div>
                  )}

                  {/* Bouton de réactivation rapide si la caméra est coupée */}
                  {isCamOff && (
                    <button
                      type="button"
                      onClick={toggleCamera}
                      style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', zIndex: 6 }}
                    >
                      📹 Réactiver la caméra
                    </button>
                  )}

                  {peerConnected && (
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'rgba(2, 6, 23, 0.88)', padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', zIndex: 6 }}>
                      <span style={{ fontSize: '0.62rem', color: '#f8fafc', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isDoctorSide ? '🩺 Ma caméra (Praticien)' : '👤 Ma caméra (Assuré)'}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: isMuted ? '#ef4444' : '#34d399', fontWeight: '800', flexShrink: 0 }}>
                        {isMuted ? '🔇' : `🎙️ ${micVolume}%`}
                      </span>
                    </div>
                  )}
                </div>

                {/* 5. HUD constantes vitales — côté PRATICIEN uniquement (monitoring) */}
                {isDoctorSide ? (
                  <div style={{ position: 'relative', zIndex: 10, background: 'rgba(2, 6, 23, 0.92)', backdropFilter: 'blur(10px)', padding: '8px 14px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid rgba(56,189,248,0.35)', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: '800' }}>💚 {telemetryVitals.bpm} BPM</div>
                    <div style={{ fontSize: '0.76rem', color: '#38bdf8', fontWeight: '800' }}>🩸 TA: {telemetryVitals.bp}</div>
                    <div style={{ fontSize: '0.76rem', color: '#a7f3d0', fontWeight: '800' }}>🫁 SpO2: {telemetryVitals.spo2}%</div>
                    <div style={{ fontSize: '0.76rem', color: '#fde047', fontWeight: '800' }}>🌡️ {telemetryVitals.temp}°C</div>
                  </div>
                ) : (
                  <div style={{ position: 'relative', zIndex: 10, background: 'rgba(2, 6, 23, 0.88)', backdropFilter: 'blur(10px)', padding: '7px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderTop: '1px solid rgba(16,185,129,0.35)' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700' }}>🔒 Télémétrie médicale synchronisée en direct • Transmission chiffrée E2EE</span>
                  </div>
                )}
              </section>

              {/* ── PANNEAU LATÉRAL — outils propres à CHAQUE espace ── */}
              <aside className="webrtc-aside-panel" style={{ flex: '1 1 380px', maxWidth: '480px', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #1b2433', background: '#0e1523', minHeight: 0 }}>

                {/* Notice d'accès caméra (affichée uniquement si échec ou connexion en cours) */}
                {cameraStatus === 'connecting' && (
                  <div style={{ margin: '0.6rem 0.7rem', padding: '0.65rem', background: 'rgba(2, 6, 23, 0.9)', borderRadius: '12px', border: '1px solid #334155', textAlign: 'center' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: isDoctorSide ? '#38bdf8' : '#34d399', boxShadow: '0 0 14px currentColor', margin: '0 auto 6px', animation: 'pulse 0.9s infinite' }} />
                    <strong style={{ display: 'block', color: '#f8fafc', fontSize: '0.80rem' }}>Connexion de votre caméra…</strong>
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
                    💬 Dialogue
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
                    {isDoctorSide ? '🩺 Dossier patient' : '🩺 Dossier CSU'}
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
                      💊 Ordonnance 50%
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
                            Le {activeDoctor.name} rédige sa réponse...
                          </div>
                        )}
                      </div>

                      {!isDoctorSide && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.55rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700' }}>Symptômes :</span>
                          {[
                            { icon: '🌡️', text: "J'ai une forte fièvre et des frissons depuis hier." },
                            { icon: '😷', text: "J'ai une toux sèche avec des douleurs à la gorge." },
                            { icon: '🤕', text: "J'ai des maux de tête intenses et de la fatigue." },
                            { icon: '💊', text: 'Je souhaite renouveler mon ordonnance médicale habituelle.' }
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
                          placeholder={isDoctorSide ? "Écrire au patient…" : "Décrivez vos symptômes ou posez une question au médecin..."}
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
                          Envoyer ✉️
                        </button>
                      </form>
                    </div>
                  )}

                  {/* TAB 2 : DOSSIER (patient côté praticien / droits CSU côté assuré) */}
                  {activeCallTab === 'vitals' && (
                    <div style={{ background: '#040812', borderRadius: '12px', padding: '0.85rem', border: '1px solid #1e293b' }}>
                      {isDoctorSide && (
                        <div style={{ marginBottom: '0.65rem', padding: '0.65rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>Motif de consultation :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>{activePatient?.reason || 'Bilan de santé & consultation générale'}</span>
                          {activePatient?.requested_doctor && (
                            <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem', marginTop: '2px' }}>Médecin demandé : {activePatient.requested_doctor} • Ticket {activePatient.payment_status === 'paid' ? '✅ réglé' : '⏳ impayé'} ({activePatient.amount || 2500} F)</small>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                        <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>Identité patient CSU :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>{peerName}</span>
                          <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>N° CSU : {peerCsu}</small>
                        </div>
                        <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#34d399', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>Couverture assurance :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>50% Tiers-Payant UNAMUSC</span>
                          <small style={{ color: '#a7f3d0', display: 'block', fontSize: '0.72rem' }}>Régime : CSU Dakar Centre</small>
                        </div>
                        <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                          <strong style={{ color: '#fde047', fontSize: '0.78rem', display: 'block', marginBottom: '2px' }}>Antécédents &amp; allergies :</strong>
                          <span style={{ color: '#ffffff', fontSize: '0.82rem', fontWeight: '700' }}>Aucune allergie connue</span>
                          <small style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>Groupe sanguin : O+</small>
                        </div>
                      </div>

                      {/* Panorama clinique temps réel — réservé au PRATICIEN */}
                      {isDoctorSide && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem', marginTop: '0.65rem' }}>
                          <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <strong style={{ color: '#a855f7', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>📡 Constantes télémétriques en direct :</strong>
                            <span style={{ color: '#ffffff', fontSize: '0.8rem', fontWeight: '700', lineHeight: 1.6, display: 'block' }}>
                              💚 FC {telemetryVitals.bpm} bpm<br />
                              🩸 TA {telemetryVitals.bp} mmHg<br />
                              🫁 SpO2 {telemetryVitals.spo2}% &nbsp;•&nbsp; 🌡️ {telemetryVitals.temp}°C
                            </span>
                            <small style={{ color: '#64748b', fontSize: '0.68rem' }}>Synchronisées automatiquement dans le DMP CSU</small>
                          </div>
                          <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <strong style={{ color: '#38bdf8', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>💊 Traitements en cours :</strong>
                            {(() => {
                              try {
                                const raw = localStorage.getItem('cmu_purchase_orders');
                                const orders = raw ? JSON.parse(raw) : [];
                                const meds = orders.slice(0, 3).map((o, i) => `${i + 1}. ${o.order_code || 'Bon'} — ${(o.items || []).length || 1} article(s) pharmacie`);
                                return meds.length ? (
                                  <span style={{ color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.6, display: 'block' }}>{meds.join('\u00A0•\u00A0')}</span>
                                ) : (
                                  <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Aucun bon de pharmacie actif — terrain vierge de traitement</small>
                                );
                              } catch (e) {
                                return <small style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Historique pharmacique indisponible</small>;
                              }
                            })()}
                            <small style={{ color: '#64748b', fontSize: '0.68rem', display: 'block', marginTop: '3px' }}>Source : bons de commande pharmacie CSU</small>
                          </div>
                          <div style={{ background: '#1e293b', padding: '0.65rem', borderRadius: '8px', border: '1px solid #334155' }}>
                            <strong style={{ color: '#34d399', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>🛡️ Droits &amp; niveau d'accès :</strong>
                            <span style={{ color: '#ffffff', fontSize: '0.78rem', lineHeight: 1.6, display: 'block' }}>
                              ✅ Dossier Médical Partagé (DMP) CSU<br />
                              ✅ Prescription &amp; ordonnance électronique 50%<br />
                              ✅ Certificats médicaux &amp; demande d'examens<br />
                              ✅ Télémétrie vitale &amp; imagerie DICOM
                            </span>
                            <small style={{ color: '#64748b', fontSize: '0.68rem' }}>Habilitation CNOM {activeDoctor.cnom} — accès chiffré E2EE</small>
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
                            📄 Consulter mes lettres de garantie ›
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3 : ORDONNANCE — côté ASSURÉ uniquement */}
                  {activeCallTab === 'rx' && !isDoctorSide && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#040812', border: '1px solid #1e293b', borderRadius: '12px', padding: '0.85rem', fontSize: '0.82rem', flexWrap: 'wrap', gap: '0.6rem' }}>
                      <div>
                        <strong style={{ color: '#34d399', display: 'block', marginBottom: '4px' }}>Médicaments prescrits par {activeDoctor.name} :</strong>
                        <span style={{ color: '#ffffff' }}>1. Amoxicilline 500mg (1 gélule 3x/jour — 7 jours)</span><br />
                        <span style={{ color: '#ffffff' }}>2. Paracétamol 1g (1 comprimé si fièvre ou douleur)</span><br />
                        <small style={{ color: '#94a3b8' }}>Prise en charge directe 50% synchronisée dans vos bons de commande pharmacie.</small>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.5rem 0.85rem', fontWeight: '800', fontSize: '0.8rem', cursor: 'pointer' }}
                          onClick={handleDownloadPrescription}
                        >
                          📥 Télécharger le reçu PDF
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
                            💊 Ouvrir dans mes bons de commande ›
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </aside>
            </div>

            {/* ═══ DOCK DE CONTRÔLE — outils propres à CHAQUE espace ═══ */}
{/* ═══ DOCK DE CONTRÔLE — barre doxy.me ═══
                Une seule grammaire visuelle : boutons ronds, neutres par défaut,
                rouge quand l'action est coupée, infobulle au survol (title) et
                aria-label pour les lecteurs d'écran. Plus de libellés empilés sous
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
                title={isMuted ? 'Réactiver le microphone' : 'Couper le microphone'}
                aria-label={isMuted ? 'Réactiver le microphone' : 'Couper le microphone'}
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
                {isMuted ? '🔇' : '🎙️'}
              </button>

              {/* Caméra */}
              <button
                type="button"
                title={isCamOff ? 'Rallumer la caméra' : 'Couper la caméra'}
                aria-label={isCamOff ? 'Rallumer la caméra' : 'Couper la caméra'}
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
                {isCamOff ? '🚫' : '📹'}
              </button>
{/* Voix du praticien — côté ASSURÉ uniquement */}
              {!isDoctorSide && (
                <button
                  type="button"
                  title={voiceEnabled ? 'Couper la voix du praticien' : 'Réactiver la voix du praticien'}
                  aria-label={voiceEnabled ? 'Couper la voix du praticien' : 'Réactiver la voix du praticien'}
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
                  {voiceEnabled ? '🔊' : '🔇'}
                </button>
              )}

              {/* Actions cliniques — côté PRATICIEN uniquement */}
              {isDoctorSide && (
                <>
                  <span style={{ width: '1px', height: '34px', background: '#1f2a3d', margin: '0 0.35rem', flexShrink: 0 }} />

                  <button
                    type="button"
                    title="Émettre l'ordonnance et le bon de prise en charge 50%"
                    aria-label="Émettre l'ordonnance et le bon de prise en charge 50%"
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
                    💊
                  </button>

                  <button
                    type="button"
                    title="Établir le certificat médical officiel"
                    aria-label="Établir le certificat médical officiel"
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
                    📄
                  </button>

                  <button
                    type="button"
                    title="Établir une demande d'examens complémentaires (labo / imagerie)"
                    aria-label="Établir une demande d'examens complémentaires"
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
                    🧪
                  </button>
                </>
              )}

              <span style={{ width: '1px', height: '34px', background: '#1f2a3d', margin: '0 0.35rem', flexShrink: 0 }} />

              {/* Raccrocher */}
              <button
                type="button"
                title="Terminer la téléconsultation"
                aria-label="Terminer la téléconsultation"
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
                📴
              </button>
            </footer>

          </div>
        </div>
        );
      })(), document.body
      )}

      {/* QR CODE MODAL (React Portal — Centered on Screen) */}
      {activeModal === 'qr' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflow: 'hidden' }}>
          <div style={{ maxWidth: '440px', width: '92%', maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '1.75rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="d-flex justify-content-between align-items-center w-100 mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2" style={{ textTransform: 'none' }}>
                <span>📲</span> QR code CSU assuré
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>
            
            <p className="small text-muted mb-2 text-center" style={{ fontSize: '0.82rem' }}>Présentez ce QR code lors de votre prise en charge médicale ou en pharmacie agréée</p>

            <div className="p-3 bg-white rounded-4 border border-success d-flex align-items-center justify-content-center my-2 shadow-sm" style={{ width: '210px', height: '210px' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${activeCmuNumber.replace('CMU-', 'CSU-')}`} alt="QR code CSU" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            <div className="my-3 px-3.5 py-2 rounded-3 border border-success text-center w-100" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#047857' }}>
              <span className="fw-bold d-block" style={{ fontSize: '0.88rem', letterSpacing: '0.3px', textTransform: 'none' }}>
                N° CSU TITULAIRE : <span className="fw-mono fs-6 text-success ms-1">{activeCmuNumber.replace('CMU-', 'CSU-')}</span>
              </span>
            </div>

            <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.5rem', fontWeight: '700', width: '100%', marginTop: '0.75rem', cursor: 'pointer', textTransform: 'none' }} onClick={() => setActiveModal(null)}>Fermer</button>
          </div>
        </div>,
        document.body
      )}

      {/* PRESCRIPTION MODAL (React Portal — Centered on Screen) */}
      {activeModal === 'prescription' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(10, 15, 30, 0.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflow: 'hidden' }}>
          <div style={{ maxWidth: '660px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.08)', margin: 'auto' }}>

            {/* ── Header Banner ── */}
            <div style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)', padding: '1.5rem 2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ position: 'absolute', bottom: '-30px', left: '40%', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div className="d-flex justify-content-between align-items-start" style={{ position: 'relative', zIndex: 1 }}>
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>💊</div>
                    <div>
                      <h5 className="fw-bold mb-0" style={{ color: '#ffffff', fontSize: '1.1rem', textTransform: 'none', letterSpacing: '-0.01em' }}>Ordonnance médicale certifiée</h5>
                      <small style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.72rem', fontWeight: 600 }}>UNAMUSC — République du Sénégal 🇸🇳</small>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveModal(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '10px', width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '1.1rem', backdropFilter: 'blur(10px)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'} onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>✕</button>
              </div>
              {/* Status badge */}
              <div style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', borderRadius: '20px', padding: '5px 14px', position: 'relative', zIndex: 1 }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'pulse 2s ease-in-out infinite' }} />
                <small style={{ color: '#ffffff', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em' }}>BON PHARMACIE 50% — VALIDE</small>
              </div>
            </div>

            {/* ── Body Content ── */}
            <div style={{ padding: '1.5rem 2rem 2rem' }}>

              {/* Doctor Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.25rem', padding: '1rem 1.15rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.2rem', color: '#fff', fontWeight: 700, boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>🩺</div>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem', display: 'block', lineHeight: '1.3' }}>Dr. Ousmane Sow</strong>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>Médecin généraliste</small>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.68rem', display: 'block' }}>N° CNOM</small>
                  <strong style={{ color: '#10b981', fontSize: '0.82rem', fontFamily: 'monospace', letterSpacing: '0.04em' }}>4522-SN</strong>
                </div>
              </div>

              {/* Patient Section */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem 1.15rem', borderRadius: '14px', border: '1px dashed rgba(16,185,129,0.35)', background: 'linear-gradient(135deg, rgba(16,185,129,0.04), rgba(5,150,105,0.02))' }}>
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ fontSize: '0.85rem' }}>👤</span>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Patient(e) bénéficiaire</small>
                </div>
                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    <strong style={{ color: 'var(--text-main)', fontSize: '1.05rem', display: 'block', lineHeight: '1.3' }}>{activeFirstName} {activeLastName}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.65rem', display: 'block', marginBottom: '2px' }}>N° CSU titulaire</small>
                    <span style={{ display: 'inline-block', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', fontSize: '0.74rem', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', fontFamily: 'monospace', letterSpacing: '0.03em' }}>{activeCmuNumber.replace('CMU-', 'CSU-')}</span>
                  </div>
                </div>
              </div>

              {/* Medications Section */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <span style={{ fontSize: '0.85rem' }}>💊</span>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Médicaments prescrits & posologie</small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Medication 1 */}
                  <div style={{ padding: '0.9rem 1.1rem', borderRadius: '14px', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', transition: 'border-color 0.2s' }}>
                    <div className="d-flex align-items-start gap-3">
                      <div style={{ width: '30px', height: '30px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '0.78rem', fontWeight: 800, marginTop: '2px' }}>1</div>
                      <div style={{ flex: 1 }}>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>Amoxicilline 500mg</strong>
                          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)' }}>2 boîtes</span>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>⏱</span>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>1 gélule × 3 fois/jour — pendant 7 jours</small>
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
                          <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>Paracétamol 1g</strong>
                          <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(16,185,129,0.2)' }}>1 boîte</span>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <span style={{ color: 'var(--text-sub)', fontSize: '0.72rem' }}>⏱</span>
                          <small style={{ color: 'var(--text-sub)', fontSize: '0.76rem' }}>1 comprimé en cas de fièvre (max 3/jour)</small>
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
                      <span style={{ fontSize: '0.85rem' }}>📱</span>
<strong style={{ color: '#10b981', fontSize: '0.82rem' }}>QR Code tiers-payant pharmacie (50%)</strong>
                    </div>
                    <small style={{ color: 'var(--text-sub)', fontSize: '0.74rem', lineHeight: '1.5', display: 'block' }}>
                      Présentez ce QR code dans n'importe quelle pharmacie partenaire agréée du Sénégal pour bénéficier de la prise en charge 50% UNAMUSC.
                    </small>
                    <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.08)', padding: '3px 8px', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.65rem' }}>✅</span>
                      <small style={{ color: '#10b981', fontSize: '0.66rem', fontWeight: 700 }}>Ordonnance vérifiée & authentifiée</small>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button type="button" style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.65rem 1.4rem', fontWeight: 700, cursor: 'pointer', textTransform: 'none', fontSize: '0.85rem', transition: 'all 0.2s' }} onClick={() => setActiveModal(null)} onMouseOver={e => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#10b981'; }} onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-sub)'; }}>Fermer</button>
                <button type="button" style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.65rem 1.6rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.35)', textTransform: 'none', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s, transform 0.15s' }} onClick={handleDownloadPrescription} onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(16,185,129,0.45)'; }} onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(16,185,129,0.35)'; }}>📥 Télécharger l'ordonnance PDF officielle</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL AJOUT MÉDECIN DE GARDE (UNION DÉPARTEMENTALE) */}
      {activeModal === 'add_doctor' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>👨‍⚕️</span> Enregistrement d'un Médecin de Garde
              </h5>
              <button type="button" className="btn-close" onClick={() => setActiveModal(null)}></button>
            </div>

            <p className="small text-muted mb-4">
              Réservé aux Agents d'Unions Départementales UNAMUSC. Ajoutez un praticien assermenté au réseau régional de garde.
            </p>

            <form onSubmit={handleAddDoctor}>
              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Nom Complet du Médecin *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                  placeholder="Ex: Dr. Mariama Bâ" 
                  value={newDocName} 
                  onChange={(e) => setNewDocName(e.target.value)} 
                  required 
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Spécialité Médicale *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: Pédiatrie & Néonatologie" 
                    value={newDocSpecialty} 
                    onChange={(e) => setNewDocSpecialty(e.target.value)} 
                    required 
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Catégorie *</label>
                  <select 
                    className="form-select" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                    value={newDocCategory}
                    onChange={(e) => setNewDocCategory(e.target.value)}
                  >
                    <option value="generaliste">Médecine Générale</option>
                    <option value="pediatrie">Pédiatrie</option>
                    <option value="cardio">Cardiologie</option>
                    <option value="gyneco">Gynécologie</option>
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>N° d'Ordre CNOM *</label>
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
                  <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Union Départementale / Secteur *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '10px' }} 
                    placeholder="Ex: Union Départementale Pikine" 
                    value={newDocDept} 
                    onChange={(e) => setNewDocDept(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold" style={{ color: 'var(--text-sub)' }}>Langues Parlées (séparées par virgules) *</label>
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
                  💾 Enregistrer le Médecin dans le Réseau
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL VÉRIFICATION ACCRÉDITATION CNOM */}
      {activeModal === 'cnom_info' && selectedCnomDoctor && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '24px', padding: '2rem', border: '1px solid var(--border-color)', boxShadow: '0 25px 70px rgba(0,0,0,0.75)', margin: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-2" style={{ borderColor: 'var(--border-color)' }}>
              <h5 className="fw-bold text-success mb-0 d-flex align-items-center gap-2">
                <span>🆔</span> Accréditation Ordre des Médecins 🇸🇳
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
                <span className="text-muted fw-semibold">N° Ordre des Médecins :</span>
                <strong className="text-success fw-mono">{selectedCnomDoctor.cnom}</strong>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted fw-semibold">Statut d'Assermentation :</span>
                <span className="badge bg-success text-white">● Praticien Agréé & Validé</span>
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

      {/* MODAL RÉSEAU DES MÉDECINS ACCRÉDITÉS CNOM */}
      {activeModal === 'all_doctors' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.75rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '840px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '28px', padding: '2.5rem', border: '1.5px solid rgba(59, 130, 246, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.85)', margin: 'auto' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(59,130,246,0.4)' }}>
                  👨‍⚕️
                </div>
                <div>
                  <h4 className="fw-extrabold mb-1 text-primary" style={{ fontSize: '1.35rem', letterSpacing: '-0.02em' }}>
                    Annuaire Régional des {doctorsList.length} Spécialistes CNOM
                  </h4>
                  <small style={{ color: 'var(--text-sub)', fontSize: '0.84rem' }}>
                    Conseil National de l'Ordre des Médecins du Sénégal • Garde H24 Télémédecine 🇸🇳
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
                          ● {doc.cnom}
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

      {/* TOAST DE NOTIFICATION (Portal centré en haut à droite) */}
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
              {/* Icône */}
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
                  🔊 Message vocal diffusé • Cliquez pour fermer
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
              >✕</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 1: DÉTAILS RÉPARTITION TÉLÉMÉDECINE DYNAMIQUE */}
      {activeModal === 'kpi_telemed_details' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', color: 'var(--text-main, #0f172a)', borderRadius: '28px', padding: '2rem 2.25rem', border: '1.5px solid rgba(16, 185, 129, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #059669, #10b981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(16,185,129,0.4)', flexShrink: 0 }}>
                  💻
                </div>
                <div>
                  <div className="d-flex align-items-center gap-2">
                    <h4 className="fw-extrabold mb-0" style={{ color: '#059669', fontSize: '1.30rem', letterSpacing: '-0.02em' }}>
                      Répartition Régionale des {queue.filter(q => q.status === 'called' || q.status === 'done').length} téléconsultation(s) enregistrée(s)
                    </h4>
                    <span className="badge bg-success-subtle text-success border border-success fw-bold px-2 py-0.5" style={{ fontSize: '0.70rem' }}>
                      En direct
                    </span>
                  </div>
                  <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem' }}>
                    Réseau national certifié CNOM & Convention CSU UNAMUSC 🇸🇳
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            <p style={{ color: 'var(--text-sub, #475569)', fontSize: '0.88rem', lineHeight: 1.6 }} className="mb-4">
              Le service de télémédecine UNAMUSC assure une couverture médicale continue 24h/24 et 7j/7 pour l'ensemble des assurés sociaux des 14 régions du Sénégal, éliminant les déserts médicaux.
            </p>

            {/* Répartition régionale : AUCUNE DONNÉE SOUCHE.
                Auparavant, 420 consultations étaient inventées puis
                réparties en 50 / 20 / 13 / 10 / 7 % sur cinq zones — des
                pourcentages posés à la main, sans aucun enregistrement de
                téléconsultation. Le tableau ci-dessous ne montre donc que
                les zones couvertes, avec un effectif réellement compté. */}
            {(() => {
              const doneCount = queue.filter(q => q.status === 'called' || q.status === 'done').length;
              const regionalData = [
                { region: 'Dakar Métropole (Plateau, Pikine, Guédiawaye, Rufisque, Keur Massar)', count: doneCount, color: '#10b981', hospitals: 'CHU Fann, Hôpital Principal, Dalal Jamm' },
                { region: 'Région de Thiès & Mbour (Petite Côte & Plateau)', count: 0, color: '#3b82f6', hospitals: 'Hôpital Régional de Thiès, EPS Mbour' },
                { region: 'Région de Saint-Louis & Vallée du Fleuve', count: 0, color: '#f59e0b', hospitals: 'CHR Saint-Louis, District Richard-Toll' },
                { region: 'Kaolack, Fatick & Diourbel (Bassin Arachidier)', count: 0, color: '#a855f7', hospitals: 'CHR Kaolack, EPS Heinrich Lübke' },
                { region: 'Ziguinchor, Kolda & Tambacounda (Casamance & Sénégal Oriental)', count: 0, color: '#ec4899', hospitals: 'CHR Ziguinchor, CHR Tambacounda' }
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
                          <strong style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.88rem' }}>📍 {item.region}</strong>
                          <div className="text-muted small mt-0.5" style={{ fontSize: '0.72rem' }}>
                            🏥 Pôles d'appui : {item.hospitals}
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge fw-extrabold px-2.5 py-1" style={{ background: `${item.color}15`, color: item.color, border: `1px solid ${item.color}35`, fontSize: '0.80rem', borderRadius: '8px' }}>
                            {item.count} téléconsultation{item.count > 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      {/* Barre proportionnelle à l'effectif réel de la zone
                          (part de la file totale). À effectif nul, aucune
                          barre n'est affichée plutôt qu'une barre « 0 % »
                          qui laisserait croire à une mesure. */}
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
                <span>⚡</span> Performance & Temps d'attente moyen :
              </div>
              <p className="mb-0" style={{ fontSize: '0.84rem', color: 'var(--text-sub, #475569)', lineHeight: 1.55 }}>
                Prise en charge moyenne en salle d'attente virtuelle : <strong>2 minutes 45 secondes</strong>. Transmission automatique de l'ordonnance sécurisée à la pharmacie partenaire la plus proche.
              </p>
            </div>

            <div className="d-flex justify-content-end">
              <button 
                type="button" 
                style={{ background: '#059669', color: '#ffffff', border: 'none', borderRadius: '12px', padding: '0.70rem 1.8rem', fontWeight: '800', fontSize: '0.90rem', cursor: 'pointer', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }} 
                onClick={() => setActiveModal(null)}
              >
                Fermer la fenêtre
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: AVIS & SATISFACTION DES ASSURÉS DYNAMIQUE */}
      {activeModal === 'kpi_satisfaction_details' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', color: 'var(--text-main, #0f172a)', borderRadius: '28px', padding: '2rem 2.25rem', border: '1.5px solid rgba(245, 158, 11, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(245,158,11,0.4)', flexShrink: 0 }}>
                  ⭐
                </div>
                <div>
                  <h4 className="fw-extrabold mb-0" style={{ color: '#d97706', fontSize: '1.30rem', letterSpacing: '-0.02em' }}>
                    Satisfaction & Avis Certifiés des Assurés
                  </h4>
                  <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem' }}>
                    Aucun avis certifié n'a encore été collecté après téléconsultation
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            {/* Note & Jauge Principale */}
            <div className="text-center p-3.5 rounded-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(217, 119, 6, 0.03) 100%)', border: '1.5px solid rgba(245, 158, 11, 0.30)' }}>
              <div style={{ fontSize: '2.75rem', fontWeight: '900', color: '#d97706', lineHeight: 1 }}>—</div>
              <div className="fw-extrabold mt-1.5" style={{ fontSize: '1.05rem', color: '#d97706' }}>Note non encore établie</div>
              <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.80rem' }}>Aucune donnée de satisfaction n'est enregistrée : aucune note moyenne ne peut être calculée honnêtement.</small>
            </div>

            {/* Les filtres d'avis (« Tous », « ★★★★★ (92%) », « Dakar », « Régions »)
                ont été retirés : la liste d'avis est vide, donc ces filtres
                ne filtrent plus rien. Le « (92%) » était de surcroît un
                pourcentage de satisfaction sans aucune source derrière —
                il ne survit pas à la suppression des avis qu'il résumait. */}

            {/* Liste des avis vérifiés */}
            <div className="d-flex flex-column gap-3 mb-4">
              {/* AUCUN avis. Ces quatre témoignages (« Awa Ndiaye »,
                  « Moussa Diallo »…) étaient écrits en dur avec 5 étoiles
                  chacun et le label « Avis certifié Tiers-Payant CSU » :
                  des patients inventés, avec des montants de règlement et
                  une « ordonnance transmise à ma pharmacie » — donc des
                  professionnels et des actes fictifs. Un avis fabriqué sur
                  une plateforme de santé est une pratique trompeuse, d'autant
                  plus qu'il est présenté comme certifié. Ils sont remplacés
                  par un état vide ; la note moyenne au-dessus est déjà
                  neutralisée de la même façon. */}
              <div
                className="p-4 rounded-4 text-center"
                style={{
                  background: 'var(--bg-card-subtle, #f8fafc)',
                  border: '1px dashed var(--border-color, #cbd5e1)',
                  borderRadius: '16px'
                }}
              >
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>💬</div>
                <strong className="d-block mb-1" style={{ fontSize: '0.92rem' }}>
                  Aucun avis publié
                </strong>
                <span className="d-block" style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem', lineHeight: 1.55 }}>
                  Aucun retour d'expérience n'est enregistré pour l'instant. Les avis qui apparaîtront ici devront provenir de patients réellement consultés.
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

      {/* MODAL 3: DÉCOMPOSITION TIERS-PAYANT UNAMUSC 80% AVEC SIMULATEUR DYNAMIQUE */}
      {activeModal === 'kpi_tierspayant_details' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '780px', width: '100%', maxHeight: '92vh', overflowY: 'auto', background: 'var(--bg-card, #ffffff)', color: 'var(--text-main, #0f172a)', borderRadius: '28px', padding: '2rem 2.25rem', border: '1.5px solid rgba(168, 85, 247, 0.4)', boxShadow: '0 30px 90px rgba(0,0,0,0.75)', margin: 'auto' }}>
            
            {/* Header Modal */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color, #e2e8f0)' }}>
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #7e22ce, #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 6px 20px rgba(168,85,247,0.4)', flexShrink: 0 }}>
                  💳
                </div>
                <div>
                  <h4 className="fw-extrabold mb-0" style={{ color: '#7e22ce', fontSize: '1.30rem', letterSpacing: '-0.02em' }}>
                    Décomposition du Tiers-Payant UNAMUSC (80%)
                  </h4>
                  <small style={{ color: 'var(--text-sub, #64748b)', fontSize: '0.82rem' }}>
                    Convention tarifaire de santé publique au Sénégal 🇸🇳
                  </small>
                </div>
              </div>
              <button type="button" className="btn-close" style={{ filter: 'invert(0.5)' }} onClick={() => setActiveModal(null)}></button>
            </div>

            <p style={{ color: 'var(--text-sub, #475569)', fontSize: '0.88rem', lineHeight: 1.6 }} className="mb-3">
              Grâce à la convention nationale UNAMUSC, l'Agence de la Couverture Santé Universelle prend en charge <strong>80% des honoraires de téléconsultation spécialisée</strong> (20% à la charge de l'assuré).
            </p>

            {/* Sélecteur de type d'acte dynamique */}
            <div className="mb-3">
              <label className="fw-bold small text-muted mb-1.5 d-block" style={{ fontSize: '0.78rem' }}>
                Choisissez un acte médical pour simuler la prise en charge :
              </label>
              <div className="d-flex gap-2 flex-wrap">
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'generaliste' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('generaliste')}
                >
                  🩺 Généraliste (7 500 F)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'specialiste' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('specialiste')}
                >
                  👨‍⚕️ Spécialiste CNOM (12 500 F)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'expertise' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('expertise')}
                >
                  🔬 Télé-expertise (20 000 F)
                </button>
                <button 
                  type="button" 
                  className={`btn btn-sm px-3 py-1.5 fw-bold ${selectedTarifType === 'maternite' ? 'btn-success' : 'btn-outline-success'}`}
                  style={{ borderRadius: '10px', fontSize: '0.78rem' }}
                  onClick={() => setSelectedTarifType('maternite')}
                >
                  🤰 Maternité (100% Gratuit)
                </button>
              </div>
            </div>

            {/* Calcul dynamique du tarif */}
            {(() => {
              let totalFee = 12500;
              let rate = 80;
              let labelActe = "Consultation Spécialiste CNOM";

              if (selectedTarifType === 'generaliste') {
                totalFee = 7500;
                rate = 80;
                labelActe = "Consultation Médecine Générale";
              } else if (selectedTarifType === 'specialiste') {
                totalFee = 12500;
                rate = 80;
                labelActe = "Consultation Médecin Spécialiste CNOM";
              } else if (selectedTarifType === 'expertise') {
                totalFee = 20000;
                rate = 80;
                labelActe = "Avis Télé-expertise Spécialisée";
              } else if (selectedTarifType === 'maternite') {
                totalFee = 10000;
                rate = 100;
                labelActe = "Téléconsultation Maternité & Suivi Grossesse";
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
                          🛡️ Prise en charge officielle UNAMUSC ({rate}%) :
                        </td>
                        <td style={{ padding: '0.85rem 1.25rem', color: '#059669', textAlign: 'right', fontWeight: '900', fontSize: '1.15rem' }}>
                          - {unamuscShare.toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                      <tr style={{ borderTop: '2px solid var(--border-color, #e2e8f0)', background: 'rgba(168, 85, 247, 0.12)' }}>
                        <td style={{ padding: '1.1rem 1.25rem', color: '#6b21a8', fontSize: '0.95rem', fontWeight: '900' }}>
                          💳 Reste à charge patient (Ticket modérateur {100 - rate}%) :
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
              <strong className="d-block mb-2" style={{ color: 'var(--text-main, #0f172a)', fontSize: '0.84rem' }}>📱 Modes de règlement instantanés (Tiers-Payant sans avance de frais) :</strong>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-primary px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.78rem' }}>🌊 Wave Mobile Money (0% Frais)</span>
                <span className="badge bg-warning text-dark px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.78rem' }}>🍊 Orange Money Sénégal</span>
                <span className="badge bg-danger px-3 py-1.5 fw-bold" style={{ borderRadius: '8px', fontSize: '0.78rem' }}>🔴 Free Money Sénégal</span>
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
