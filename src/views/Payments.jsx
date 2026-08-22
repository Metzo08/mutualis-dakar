import React, { useState, useEffect } from 'react';
import { getStoredMembers, saveStoredMembers, getCardByCode } from '../utils/beneficiaryStore.js';
import { getAdherentCode } from '../utils/csuFormatter';
import { generateOfficialPdf } from '../utils/pdfGenerator';

/**
 * Met la première lettre de chaque mot en majuscule et le reste en minuscule
 * Préserve les acronymes spécifiques (CSU, UNAMUSC, FCFA, etc.)
 */
function formatProperCase(str) {
  if (!str) return '';
  const acronyms = ['CSU', 'UNAMUSC', 'FCFA', 'URMSCD', 'DKR', 'OM', 'WV', 'IPP', 'PEV', 'BSF', 'RNU', 'DICOM', 'ALD', 'MSD'];
  return String(str)
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (!word) return '';
      const upper = word.toUpperCase();
      if (acronyms.includes(upper)) {
        return upper;
      }
      return word
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('-');
    })
    .join(' ');
}

/**
 * Portail de Paiement & Solidarité CSU UNAMUSC
 * Permet à l'assuré de :
 * 1. Cotiser et renouveler ses droits pour lui-même et pour tous les membres de sa famille
 * 2. Effectuer des dons et parrainages solidaires CSU (Talibés, Daaras, Familles vulnérables BSF)
 * 3. Consulter et télécharger exclusivement SES reçus et son historique personnel de paiements
 */
export default function Payments({ 
  lang = 'fr', 
  citizenUser = null, 
  agentUser = null, 
  portalMode = 'citizen', 
  setView = null 
}) {
  const [activeTab, setActiveTab] = useState('cotisation'); // 'cotisation' | 'sponsoring' | 'history'
  
  // 1. Déterminer si l'utilisateur est un Agent / SuperAdmin (qui a accès à tous les dossiers)
  const isAgentOrAdmin = portalMode === 'agent' || portalMode === 'superadmin' || Boolean(agentUser);

  const [allMembers, setAllMembers] = useState(getStoredMembers());

  // Détection dynamique de la carte scannée ou de l'assuré actif en session
  const initialMemberId = React.useMemo(() => {
    const pending = localStorage.getItem('cmu-pending-renewal');
    if (pending) {
      try {
        const parsed = JSON.parse(pending);
        const found = allMembers.find(m => m.cmuNumber?.startsWith(parsed.cmuNumber) || m.adherentCode === parsed.cmuNumber);
        if (found) return found.id;
      } catch (e) {}
    }
    const activeId = localStorage.getItem('cmu-active-insured-id');
    if (activeId) {
      const found = allMembers.find(m => m.id === activeId);
      if (found) return found.id;
    }
    const scannedRaw = localStorage.getItem('cmu-last-verified-card') || localStorage.getItem('cmu-active-insured');
    if (scannedRaw) {
      try {
        const scanned = JSON.parse(scannedRaw);
        const cmu = (scanned.cmuNumber || scanned.cmuCode || scanned.rawCode || '').trim();
        const scId = scanned.id || '';
        const normCmu = cmu.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const found = allMembers.find(m => {
          if (scId && m.id === scId) return true;
          const mNormCmu = (m.cmuNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          const mNormAdherent = (m.adherentCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (normCmu && (mNormCmu === normCmu || mNormAdherent === normCmu)) return true;
          if (scanned.firstName && `${m.firstName} ${m.lastName}`.toLowerCase() === `${scanned.firstName} ${scanned.lastName}`.toLowerCase()) return true;
          return false;
        });
        if (found) return found.id;
      } catch (e) {}
    }
    if (citizenUser) {
      const cmu = citizenUser.cmuNumber || citizenUser.cmuId || '';
      const found = allMembers.find(m => (cmu && (m.cmuNumber === cmu || m.adherentCode === cmu)) || (citizenUser.id && m.id === citizenUser.id));
      if (found) return found.id;
    }
    return allMembers[0]?.id || 'MEM-MSD-011';
  }, [citizenUser, allMembers]);

  const [selectedMemberId, setSelectedMemberId] = useState(initialMemberId);

  useEffect(() => {
    if (initialMemberId) {
      setSelectedMemberId(initialMemberId);
    }
  }, [initialMemberId]);

  // Écouter les événements de scan de carte QR code pour actualiser instantanément l'assuré actif
  useEffect(() => {
    const handleCardScan = () => {
      const activeId = localStorage.getItem('cmu-active-insured-id');
      if (activeId) {
        const found = allMembers.find(m => m.id === activeId);
        if (found) {
          setSelectedMemberId(found.id);
          return;
        }
      }
      const scannedRaw = localStorage.getItem('cmu-last-verified-card') || localStorage.getItem('cmu-active-insured');
      if (scannedRaw) {
        try {
          const scanned = JSON.parse(scannedRaw);
          const cmu = (scanned.cmuNumber || scanned.cmuCode || scanned.rawCode || '').trim();
          const scId = scanned.id || '';
          const found = allMembers.find(m => 
            (scId && m.id === scId) ||
            (cmu && (m.cmuNumber?.toLowerCase() === cmu.toLowerCase() || m.adherentCode?.toLowerCase() === cmu.toLowerCase()))
          );
          if (found) setSelectedMemberId(found.id);
        } catch (e) {}
      }
    };

    window.addEventListener('unamusc_card_scanned', handleCardScan);
    return () => window.removeEventListener('unamusc_card_scanned', handleCardScan);
  }, [allMembers]);

  const activeMember = React.useMemo(() => {
    return allMembers.find(m => m.id === selectedMemberId) || allMembers[0];
  }, [allMembers, selectedMemberId]);

  // Liste des membres du foyer (Titulaire + Ayants droit) avec mise en forme propre des noms
  const familyList = React.useMemo(() => {
    if (!activeMember) return [];
    const titulaire = {
      id: 'titulaire',
      name: formatProperCase(`${activeMember.firstName} ${activeMember.lastName}`),
      relation: 'Adhérent principal (Titulaire)',
      code: activeMember.cmuNumber,
      isMajor: true,
      isTitulaire: true,
      photoUrl: activeMember.photoUrl,
      status: activeMember.photoStatus === 'OFFICIAL' ? 'Actif' : 'À jour',
      coverage: '80% Tiers-payant'
    };

    const deps = (activeMember.dependents || []).map((d, idx) => {
      const suffix = d.codeSuffix || (d.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`);
      const depCode = `${activeMember.adherentCode || activeMember.cmuNumber.replace('.0', '')}${suffix}`;
      return {
        id: `dep_${idx}`,
        name: formatProperCase(d.name),
        relation: d.isMajor ? 'Ayant droit majeur' : (d.gender === 'F' ? 'Enfant mineur (Fille)' : 'Enfant mineur (Fils)'),
        code: depCode,
        isMajor: d.isMajor,
        isTitulaire: false,
        photoUrl: d.photoUrl,
        status: d.isMajor ? '80% Tiers-payant' : '100% Pédiatrie gratuite',
        coverage: d.isMajor ? '80% Tiers-payant' : '100% Gratuité'
      };
    });

    return [titulaire, ...deps];
  }, [activeMember]);

  // Sélection interactive des membres pour la cotisation
  const [selectedMemberIds, setSelectedMemberIds] = useState(() => familyList.map(m => m.id));
  const [cotisationDuration, setCotisationDuration] = useState('1'); // '1' = 1 an (3500 FCFA), '2' = 2 ans (7000 FCFA), '3' = 3 ans (10500 FCFA)

  // Recalculer la sélection si la famille change
  useEffect(() => {
    setSelectedMemberIds(familyList.map(m => m.id));
  }, [activeMember?.id]);

  const COTISATION_BASE = 3500;
  const rateMultiplier = parseFloat(cotisationDuration) || 1;
  const pricePerPerson = Math.round(COTISATION_BASE * rateMultiplier);
  const totalCotisationAmount = selectedMemberIds.length * pricePerPerson;

  // Mode de paiement & Formulaire
  const [provider, setProvider] = useState('wave'); // 'wave' | 'orange_money'
  const [phone, setPhone] = useState(activeMember?.phone || '77 602 67 83');
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(null);
  const [showUssdModal, setShowUssdModal] = useState(false);
  const [ussdTimer, setUssdTimer] = useState(10);

  // Parrainage / Dons solidaires
  const [sponsoringPreset, setSponsoringPreset] = useState('talibe_1'); // 'talibe_1' | 'famille_1' | 'daara_10' | 'custom'
  const [sponsoringAmount, setSponsoringAmount] = useState(3500);
  const [sponsoringCause, setSponsoringCause] = useState('🎒 1 Enfant talibé / daara');
  const [sponsoringDonorName, setSponsoringDonorName] = useState(formatProperCase(`${activeMember?.firstName || ''} ${activeMember?.lastName || ''}`));

  // Gestion des reçus & historique personnel de l'assuré (LocalStorage isolé par famille)
  const historyStorageKey = `cmu_payments_${activeMember?.cmuNumber || 'default'}`;
  const [personalPayments, setPersonalPayments] = useState(() => {
    try {
      const stored = localStorage.getItem(historyStorageKey);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [
      {
        id: `REC-${activeMember?.cmuNumber?.replace(/[^0-9]/g, '') || '260001'}-01`,
        date: '10/01/2026',
        type: 'Cotisation annuelle famille (UNAMUSC 80%)',
        beneficiaries: `${formatProperCase(activeMember?.firstName)} ${formatProperCase(activeMember?.lastName)} + ${(activeMember?.dependents || []).length} ayant(s) droit`,
        amount: (1 + (activeMember?.dependents || []).length) * 3500,
        provider: 'wave',
        reference: `WV-2026-${Math.floor(100000 + Math.random() * 900000)}`,
        status: 'Validé & homologué',
        cmuNumber: activeMember?.cmuNumber,
        unionName: 'Mutuelle de santé départementale de Dakar'
      }
    ];
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(historyStorageKey);
      if (stored) {
        setPersonalPayments(JSON.parse(stored));
      } else {
        const initial = [
          {
            id: `REC-${activeMember?.cmuNumber?.replace(/[^0-9]/g, '') || '260001'}-01`,
            date: '10/01/2026',
            type: 'Cotisation annuelle famille (UNAMUSC 80%)',
            beneficiaries: `${formatProperCase(activeMember?.firstName)} ${formatProperCase(activeMember?.lastName)} + ${(activeMember?.dependents || []).length} ayant(s) droit`,
            amount: (1 + (activeMember?.dependents || []).length) * 3500,
            provider: 'wave',
            reference: `WV-2026-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'Validé & homologué',
            cmuNumber: activeMember?.cmuNumber,
            unionName: 'Mutuelle de santé départementale de Dakar'
          }
        ];
        setPersonalPayments(initial);
      }
    } catch (e) {}
  }, [activeMember?.id]);

  // Sauvegarder dans l'historique
  const savePaymentToHistory = (newPayment) => {
    const updated = [newPayment, ...personalPayments];
    setPersonalPayments(updated);
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(updated));
      window.dispatchEvent(new Event('unamusc_payment_created'));
    } catch (e) {}
  };

  // Basculer la sélection d'un membre
  const toggleMemberSelection = (id) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Sélectionner / désélectionner tout
  const selectAll = () => setSelectedMemberIds(familyList.map(m => m.id));
  const deselectAll = () => setSelectedMemberIds([]);

  // Modal d'ajout rapide d'ayant droit
  const [showAddDependentModal, setShowAddDependentModal] = useState(false);
  const [newDepName, setNewDepName] = useState('');
  const [newDepBirthDate, setNewDepBirthDate] = useState('15/05/2019');
  const [newDepGender, setNewDepGender] = useState('M');
  const [newDepIsMajor, setNewDepIsMajor] = useState(false);

  const handleAddDependent = (e) => {
    e.preventDefault();
    if (!newDepName.trim()) return;

    const currentDeps = activeMember.dependents || [];
    const nextIdx = currentDeps.length + 1;
    const newSuffix = newDepIsMajor ? `.1${nextIdx}` : `.M${nextIdx}`;

    const newDep = {
      name: formatProperCase(newDepName.trim()),
      birthDate: newDepBirthDate,
      birthPlace: 'Dakar',
      gender: newDepGender,
      isMajor: newDepIsMajor,
      codeSuffix: newSuffix,
      photoUrl: '',
      hasOfficialPhoto: false,
      photoStatus: 'PENDING_UPLOAD',
      bloodGroup: activeMember.bloodGroup || 'O+',
      allergies: 'Aucune connue',
      vaccines: newDepIsMajor ? 'Vaccination à jour' : 'PEV 100% à jour',
      antecedents: newDepIsMajor ? 'Bilan régulier' : 'Développement normal'
    };

    const updatedMembers = allMembers.map(m => {
      if (m.id === activeMember.id) {
        return {
          ...m,
          dependents: [...(m.dependents || []), newDep]
        };
      }
      return m;
    });

    saveStoredMembers(updatedMembers);
    setAllMembers(updatedMembers);
    setShowAddDependentModal(false);
    setNewDepName('');
  };

  // Déclencher le paiement
  const handleInitiatePayment = (type = 'cotisation') => {
    setLoading(true);
    setPaymentSuccess(null);
    setShowUssdModal(true);
    setUssdTimer(10);

    const isCotisation = (type === 'cotisation');
    const finalAmount = isCotisation ? totalCotisationAmount : parseInt(sponsoringAmount, 10);
    const selectedNames = isCotisation 
      ? familyList.filter(f => selectedMemberIds.includes(f.id)).map(f => f.name).join(', ')
      : sponsoringCause;

    const newRef = `${provider === 'wave' ? 'WV' : 'OM'}-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const interval = setInterval(() => {
      setUssdTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setLoading(false);
          setShowUssdModal(false);

          const successRecord = {
            id: `REC-${Date.now().toString().slice(-6)}`,
            date: new Date().toLocaleDateString('fr-FR'),
            type: isCotisation 
              ? `Cotisation famille (${selectedMemberIds.length} pers. • ${cotisationDuration === '1' ? '1 an' : cotisationDuration + ' ans'})` 
              : `Don & parrainage solidaire (${sponsoringCause})`,
            beneficiaries: selectedNames,
            amount: finalAmount,
            provider: provider,
            reference: newRef,
            status: 'Validé & homologué',
            cmuNumber: activeMember.cmuNumber,
            unionName: activeMember.mutuelleOrigine || 'Mutuelle de santé départementale de Dakar'
          };

          setPaymentSuccess(successRecord);
          savePaymentToHistory(successRecord);

          // Réactiver immédiatement et globalement tous les droits de santé de l'adhérent et de son foyer
          localStorage.setItem('cmu-portal-mode', 'citizen');
          localStorage.removeItem('cmu-pending-renewal');
          localStorage.removeItem('cmu-cotisation-suspended');
          localStorage.setItem(`cmu-status-${activeMember.cmuNumber}`, 'active');
          if (activeMember.adherentCode) {
            localStorage.setItem(`cmu-status-${activeMember.adherentCode}`, 'active');
          }

          // Réactiver chaque ayant droit rattaché
          (activeMember.dependents || []).forEach((d, idx) => {
            const suffix = d.codeSuffix || (d.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`);
            const depCode = `${activeMember.adherentCode || activeMember.cmuNumber?.replace('.0', '')}${suffix}`;
            localStorage.setItem(`cmu-status-${depCode}`, 'active');
          });

          // Mettre à jour l'objet citoyen en session locale
          try {
            const storedCitizen = localStorage.getItem('cmu-citizen-user');
            if (storedCitizen) {
              const parsed = JSON.parse(storedCitizen);
              parsed.status = 'active';
              parsed.photoStatus = 'OFFICIAL';
              localStorage.setItem('cmu-citizen-user', JSON.stringify(parsed));
            }
          } catch (e) {}

          // Mettre à jour le store centralisé
          try {
            const members = getStoredMembers();
            const updated = members.map(m => {
              if (m.id === activeMember.id || m.cmuNumber === activeMember.cmuNumber) {
                return { ...m, status: 'active', photoStatus: 'OFFICIAL' };
              }
              return m;
            });
            saveStoredMembers(updated);
            setAllMembers(updated);
          } catch (e) {}

          // Déclencher un événement global pour actualiser instantanément tous les composants montés
          window.dispatchEvent(new CustomEvent('cmu-rights-restored', { 
            detail: { cmuNumber: activeMember.cmuNumber, status: 'active' } 
          }));

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Télécharger le reçu officiel certifié UNAMUSC en PDF
  const handleDownloadReceipt = (payment) => {
    generateOfficialPdf({
      filename: `recu_cotisation_${payment.reference}.pdf`,
      docType: 'QUITTANCE OFFICIELLE DE COTISATION CSU / UNAMUSC',
      title: 'Attestation de paiement & quittance de cotisation mutualiste',
      referenceNo: payment.reference,
      beneficiaryName: formatProperCase(`${activeMember.firstName} ${activeMember.lastName}`),
      cmuNumber: payment.cmuNumber || activeMember.cmuNumber,
      structureName: payment.unionName || 'Mutuelle de santé départementale de Dakar',
      details: [
        { label: 'Objet du versement', value: payment.type },
        { label: 'Montant total réglé', value: `${payment.amount.toLocaleString('fr-FR')} FCFA (Tiers-payant & prise en charge activés)` },
        { label: 'Moyen de paiement', value: payment.provider === 'wave' ? 'Wave Mobile Money Sénégal' : 'Orange Money Sénégal' },
        { label: 'Bénéficiaires couverts', value: payment.beneficiaries },
        { label: 'Date de validation', value: payment.date },
        { label: 'Statut de conformité', value: 'Validé & homologué par l\'URMSCD Dakar' }
      ],
      notes: 'Ce reçu officiel certifie l\'ouverture intégrale des droits de tiers-payant (80% à 100%) auprès de tous les hôpitaux, centres de santé et pharmacies conventionnés.'
    });
  };

  const formattedHeadName = formatProperCase(`${activeMember?.firstName} ${activeMember?.lastName}`);

  return (
    <div className="payments-view fade-in-up" style={{ paddingBottom: '5rem' }}>
      
      {/* BANNIÈRE SUPÉRIEURE D'ACCUEIL */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.94) 0%, rgba(16, 185, 129, 0.88) 100%), url("/csu_payments_hero.png") center/cover no-repeat',
        borderRadius: '24px',
        padding: '2.5rem 1.5rem',
        marginBottom: '2.5rem',
        color: '#fff',
        boxShadow: '0 12px 36px rgba(6, 78, 59, 0.25)',
        textAlign: 'center',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="d-inline-flex align-items-center gap-2 px-3.5 py-1.5 mb-3 rounded-pill" style={{ background: 'rgba(255, 255, 255, 0.22)', fontSize: '0.84rem', fontWeight: '700' }}>
            🇸🇳 Mutuelle de santé départementale de Dakar • Tiers-payant UNAMUSC
          </div>
          
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            💳 Paiements, cotisations & solidarité CSU
          </h1>
          
          <p style={{ color: '#ecfdf5', fontSize: '0.94rem', margin: '0 auto 1.5rem auto', maxWidth: '650px', lineHeight: '1.6' }}>
            Gérez en toute autonomie les cotisations de votre foyer familial, parrainez des bénéficiaires vulnérables et téléchargez vos reçus officiels instantanément.
          </p>

          {/* ZONE D'IDENTIFICATION & SÉCURITÉ STRICTE DES ACCÈS (CONFIDENTIALITÉ DES DONNÉES DE L'ASSURÉ) */}
          {isAgentOrAdmin ? (
            /* SÉLECTEUR D'ASSURÉ RÉSERVÉ EXCLUSIVEMENT AUX AGENTS ET SUPER ADMINS */
            <div 
              className="mt-3.5 p-3 rounded-4 shadow-sm" 
              style={{ 
                background: '#ffffff', 
                color: '#0f172a', 
                maxWidth: '540px', 
                width: '100%', 
                margin: '0 auto', 
                boxSizing: 'border-box',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.6)'
              }}
            >
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <span className="badge bg-primary text-white" style={{ fontSize: '0.76rem', borderRadius: '8px', padding: '5px 10px', fontWeight: '700' }}>
                  👨‍💼 Espace Agent / Super Admin
                </span>
                <span className="text-muted fw-bold" style={{ fontSize: '0.82rem' }}>
                  Foyer actif : <strong style={{ color: '#065f46' }}>{activeMember?.cmuNumber}</strong>
                </span>
              </div>

              <div style={{ width: '100%', overflow: 'hidden' }}>
                <select 
                  value={selectedMemberId} 
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                    try { localStorage.setItem('cmu-active-insured-id', e.target.value); } catch (err) {}
                  }}
                  className="form-select fw-extrabold border"
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    fontSize: '0.88rem',
                    color: '#065f46',
                    backgroundColor: '#f0fdf4',
                    borderColor: '#a7f3d0',
                    borderRadius: '12px',
                    padding: '0.65rem 0.85rem',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  {allMembers.map(m => {
                    const depCount = (m.dependents || []).length;
                    const typeLabel = depCount === 0 ? 'Assuré Seul (0 ayant droit)' : `${depCount} ayant(s) droit à charge`;
                    return (
                      <option key={m.id} value={m.id}>
                        {formatProperCase(`${m.firstName} ${m.lastName}`)} ({m.cmuNumber}) — {typeLabel}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          ) : (
            /* BADGE DE CONFIDENTIALITÉ STRICT & SÉCURISÉ POUR L'ASSURÉ CONNECTÉ / SCANNÉ (ACCÈS PERSONNEL EXCLUSIF SANS AUCUN MENU DÉROULANT) */
            <div 
              className="mt-3.5 p-3 rounded-4 shadow-sm text-start" 
              style={{ 
                background: '#ffffff', 
                color: '#0f172a', 
                maxWidth: '540px', 
                width: '100%', 
                margin: '0 auto', 
                boxSizing: 'border-box',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.7)'
              }}
            >
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                <span className="badge" style={{ background: '#059669', color: '#ffffff', fontSize: '0.76rem', borderRadius: '8px', padding: '5px 10px', fontWeight: '700' }}>
                  🔒 Espace Privé Assuré • Données Sécurisées
                </span>
                <span className="badge" style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontSize: '0.76rem', borderRadius: '8px', padding: '4px 8px', fontWeight: '700' }}>
                  {(activeMember?.dependents || []).length === 0 ? '👤 Assuré Seul (0 ayant droit)' : `👨‍👩‍👧‍👦 Foyer (${1 + (activeMember?.dependents || []).length} pers.)`}
                </span>
              </div>

              <div className="d-flex align-items-center gap-3 p-2.5 rounded-3" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
                {activeMember?.photoUrl ? (
                  <img 
                    src={activeMember.photoUrl} 
                    alt={formattedHeadName} 
                    onError={(e) => { e.target.onerror = null; e.target.src = '/csu_profile_hero_real.png'; }}
                    style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #059669', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.2rem', flexShrink: 0 }}>
                    {formattedHeadName.charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fw-extrabold text-truncate" style={{ fontSize: '1.02rem', color: '#065f46' }}>
                    {formattedHeadName}
                  </div>
                  <div className="text-muted small d-flex align-items-center gap-2 flex-wrap" style={{ fontSize: '0.82rem' }}>
                    <span>Code bénéficiaire: <strong>{activeMember?.cmuNumber}</strong></span>
                    <span>•</span>
                    <span>Tél : <strong>{activeMember?.phone || '77 308 23 03'}</strong></span>
                  </div>
                </div>
                <span className="badge bg-success" style={{ fontSize: '0.72rem', borderRadius: '6px' }}>
                  Droits Actifs
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <div style={{ maxWidth: '920px', margin: '0 auto', padding: '0 1rem' }}>
        
        {/* ONGLETS DE NAVIGATION RESPONSIVE (PLEINE LARGEUR SUR MOBILE, HORIZONTAL SUR DESKTOP) */}
        <div className="d-flex flex-column flex-md-row p-2 mb-4 rounded-4 shadow-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn d-flex align-items-center justify-content-center gap-2 py-3 fw-bold flex-fill"
            style={{
              borderRadius: '14px',
              border: 'none',
              background: activeTab === 'cotisation' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'cotisation' ? '#ffffff' : 'var(--text-main)',
              boxShadow: activeTab === 'cotisation' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
              fontSize: '0.92rem',
              minHeight: '48px'
            }}
            onClick={() => setActiveTab('cotisation')}
          >
            <span>👨‍👩‍👧</span>
            <span>Cotisation famille</span>
            <span className="badge" style={{ background: activeTab === 'cotisation' ? 'rgba(255,255,255,0.3)' : '#e2e8f0', color: activeTab === 'cotisation' ? '#fff' : '#334155', borderRadius: '10px', fontSize: '0.74rem' }}>
              {selectedMemberIds.length}/{familyList.length}
            </span>
          </button>

          <button
            type="button"
            className="btn d-flex align-items-center justify-content-center gap-2 py-3 fw-bold flex-fill"
            style={{
              borderRadius: '14px',
              border: 'none',
              background: activeTab === 'sponsoring' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'sponsoring' ? '#ffffff' : 'var(--text-main)',
              boxShadow: activeTab === 'sponsoring' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
              fontSize: '0.92rem',
              minHeight: '48px'
            }}
            onClick={() => setActiveTab('sponsoring')}
          >
            <span>🤝</span>
            <span>Don & parrainage CSU</span>
          </button>

          <button
            type="button"
            className="btn d-flex align-items-center justify-content-center gap-2 py-3 fw-bold flex-fill"
            style={{
              borderRadius: '14px',
              border: 'none',
              background: activeTab === 'history' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'history' ? '#ffffff' : 'var(--text-main)',
              boxShadow: activeTab === 'history' ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
              fontSize: '0.92rem',
              minHeight: '48px'
            }}
            onClick={() => setActiveTab('history')}
          >
            <span>📜</span>
            <span>Mes reçus ({personalPayments.length})</span>
          </button>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ONGLET 1 : COTISATIONS FAMILLE (SÉLECTION DES MEMBRES DU FOYER)    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'cotisation' && (
          <div className="tab-cotisation fade-in">
            <div className="card shadow-sm p-4 p-md-5 mb-5 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              
              {/* EN-TÊTE DU FOYER / ASSURÉ + BOUTONS D'ACTION */}
              <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div style={{ flex: 1 }}>
                  <h3 className="fw-extrabold mb-1 d-flex align-items-center gap-2" style={{ fontSize: '1.35rem', color: 'var(--text-main)' }}>
                    <span>{(activeMember?.dependents || []).length === 0 ? '👤' : '👨‍👩‍👧‍👦'}</span>
                    <span>{(activeMember?.dependents || []).length === 0 ? `Dossier de ${formattedHeadName}` : `Foyer de ${formattedHeadName}`}</span>
                  </h3>
                  <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                    {(activeMember?.dependents || []).length === 0 
                      ? 'Adhérent titulaire individuel (souscription 1 personne, 0 ayant droit à charge).' 
                      : `Sélectionnez les membres à cotiser ou à renouveler pour l'année 2026 (${familyList.length} personnes au total).`}
                  </p>
                </div>

                {/* BOUTONS D'ACTIONS DU HAUT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '380px' }}>
                  {(activeMember?.dependents || []).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary btn-sm fw-bold" 
                        style={{ borderRadius: '12px', fontSize: '0.84rem', padding: '10px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                        onClick={selectAll}
                      >
                        Tout cocher
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-outline-secondary btn-sm fw-bold" 
                        style={{ borderRadius: '12px', fontSize: '0.84rem', padding: '10px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                        onClick={deselectAll}
                      >
                        Tout décocher
                      </button>
                    </div>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-success btn-sm fw-bold shadow-sm" 
                    style={{ borderRadius: '12px', fontSize: '0.86rem', background: '#059669', borderColor: '#059669', padding: '10px 16px', height: '44px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    onClick={() => setShowAddDependentModal(true)}
                  >
                    <span>➕</span>
                    <span>Rattacher un enfant / ayant droit</span>
                  </button>
                </div>
              </div>

              {(activeMember?.dependents || []).length === 0 && (
                <div className="p-3.5 rounded-4 mb-4 d-flex align-items-center gap-3" style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <span style={{ fontSize: '1.4rem' }}>ℹ️</span>
                  <div className="small text-emerald-900" style={{ fontSize: '0.86rem' }}>
                    <strong>Souscription individuelle active :</strong> Cet assuré ne comporte actuellement aucun enfant mineur ni ayant droit à sa charge. Seule la cotisation du titulaire (3 500 FCFA / an) s'applique. Vous pouvez utiliser le bouton ci-dessus pour rattacher un enfant ou ayant droit.
                  </div>
                </div>
              )}

              {/* LISTE DES CASES DES ASSURÉS — ESPACEMENT TOTAL DE 20PX ET STRUCTURE SANS AUCUN CHEVAUCHEMENT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '2.5rem' }}>
                {familyList.map((m) => {
                  const isChecked = selectedMemberIds.includes(m.id);
                  return (
                    <div 
                      key={m.id}
                      onClick={() => toggleMemberSelection(m.id)}
                      style={{
                        background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card-subtle)',
                        border: isChecked ? '2px solid #10b981' : '1px solid var(--border-color)',
                        borderRadius: '20px',
                        padding: '1.25rem 1.5rem',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isChecked ? '0 4px 16px rgba(16, 185, 129, 0.12)' : '0 2px 8px rgba(0,0,0,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        
                        {/* PARTIE GAUCHE : CHECKBOX + AVATAR + INFOS BÉNÉFICIAIRE */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 280px', minWidth: '220px' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => {}} 
                            style={{ width: '22px', height: '22px', accentColor: '#10b981', cursor: 'pointer', flexShrink: 0 }}
                          />
                          
                          <div style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            background: m.isTitulaire ? '#065f46' : (m.isMajor ? '#3b82f6' : '#f59e0b'),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            overflow: 'hidden',
                            flexShrink: 0,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}>
                            {m.photoUrl ? (
                              <img src={m.photoUrl} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>{m.isTitulaire ? '🛡️' : (m.isMajor ? '👤' : '👶')}</span>
                            )}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                              <span style={{ fontWeight: '800', fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                {m.name}
                              </span>
                              <span style={{
                                background: m.isTitulaire ? '#d1fae5' : (m.isMajor ? '#e0e7ff' : '#fef3c7'),
                                color: m.isTitulaire ? '#065f46' : (m.isMajor ? '#3730a3' : '#92400e'),
                                fontSize: '0.74rem',
                                padding: '3px 8px',
                                borderRadius: '8px',
                                fontWeight: '700'
                              }}>
                                {m.relation}
                              </span>
                            </div>

                            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <code style={{ color: 'var(--text-main)', background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                                N° CSU : {m.code}
                              </code>
                              <span>•</span>
                              <span>{m.coverage}</span>
                            </div>
                          </div>
                        </div>

                        {/* PARTIE DROITE : MONTANT ET DURÉE DÉDIÉS SANS AUCUN CHEVAUCHEMENT */}
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'auto', paddingLeft: '1rem' }}>
                          <span style={{ fontSize: '1.2rem', fontWeight: '800', color: isChecked ? '#059669' : 'var(--text-sub)', display: 'block', marginBottom: '3px' }}>
                            {pricePerPerson.toLocaleString('fr-FR')} FCFA
                          </span>
                          <span style={{ fontSize: '0.76rem', color: 'var(--text-sub)', fontWeight: '600', display: 'block' }}>
                            {cotisationDuration === '1' ? 'Cotisation 1 an' : cotisationDuration === '2' ? 'Pluriannuel (2 ans)' : 'Pluriannuel (3 ans)'}
                          </span>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SÉLECTEUR DE DURÉE & TOTAL DYNAMIQUE (PARFAITEMENT ADAPTÉ MOBILE SANS DÉBORDEMENT) */}
              <div className="p-3.5 p-md-4 rounded-4 mb-5 shadow-sm" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '20px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* HAUT : LIBELLÉ ET LISTE DES BOUTONS DE PÉRIODE 100% CONTAINED */}
                  <div style={{ width: '100%' }}>
                    <label className="fw-bold text-muted mb-2.5 d-block" style={{ fontSize: '0.82rem' }}>
                      Période de couverture :
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                      {[
                        { val: '1', label: '1 An — Recommandé (3 500 FCFA / pers.)' },
                        { val: '2', label: '2 Ans (7 000 FCFA / pers.)' },
                        { val: '3', label: '3 Ans (10 500 FCFA / pers.)' }
                      ].map(dur => (
                        <button
                          key={dur.val}
                          type="button"
                          className="btn fw-bold text-center"
                          style={{
                            borderRadius: '14px',
                            padding: '12px 14px',
                            background: cotisationDuration === dur.val ? '#065f46' : 'var(--bg-card)',
                            color: cotisationDuration === dur.val ? '#ffffff' : 'var(--text-main)',
                            border: cotisationDuration === dur.val ? '2px solid #059669' : '1px solid var(--border-color)',
                            fontSize: '0.88rem',
                            minHeight: '48px',
                            boxShadow: cotisationDuration === dur.val ? '0 4px 12px rgba(6, 95, 70, 0.25)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            width: '100%',
                            boxSizing: 'border-box'
                          }}
                          onClick={() => setCotisationDuration(dur.val)}
                        >
                          {dur.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* BAS : TOTAL DYNAMIQUE AVEC LIGNE DE SÉPARATION NETTE */}
                  <div className="pt-3 border-top d-flex justify-content-between align-items-center flex-wrap gap-2" style={{ borderColor: 'var(--border-color)' }}>
                    <span className="text-muted fw-bold" style={{ fontSize: '0.9rem' }}>
                      Total ({selectedMemberIds.length} personne{selectedMemberIds.length > 1 ? 's' : ''}) :
                    </span>
                    <h2 className="fw-extrabold mb-0" style={{ color: '#059669', fontSize: '1.85rem' }}>
                      {totalCotisationAmount.toLocaleString('fr-FR')} FCFA
                    </h2>
                  </div>

                </div>
              </div>

              {/* SECTION PAIEMENT MOBILE SÉCURISÉ (ESPACEMENT SOIGNÉ ET BOUTONS NETS) */}
              <div className="pt-4 border-top" style={{ borderColor: 'var(--border-color)' }}>
                <label className="fw-bold mb-3 d-block" style={{ fontSize: '0.92rem' }}>
                  📱 Mode de paiement mobile :
                </label>

                {/* BOUTONS DES OPÉRATEURS CLAIRS & BIEN DISTINGUÉS (GRILLE RESPONSIVE) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setProvider('wave')}
                    style={{
                      border: provider === 'wave' ? '2.5px solid #00b2fe' : '1px solid var(--border-color)',
                      background: provider === 'wave' ? 'rgba(0, 178, 254, 0.08)' : 'var(--bg-card)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      padding: '1.1rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      minHeight: '64px',
                      boxShadow: provider === 'wave' ? '0 4px 14px rgba(0, 178, 254, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img src="/logo_wave.png" alt="Wave" style={{ height: '28px', borderRadius: '4px' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: provider === 'wave' ? '#0084ba' : 'var(--text-main)' }}>
                      Wave
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('orange_money')}
                    style={{
                      border: provider === 'orange_money' ? '2.5px solid #ff7900' : '1px solid var(--border-color)',
                      background: provider === 'orange_money' ? 'rgba(255, 121, 0, 0.08)' : 'var(--bg-card)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      padding: '1.1rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      minHeight: '64px',
                      boxShadow: provider === 'orange_money' ? '0 4px 14px rgba(255, 121, 0, 0.25)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <img src="/logo_orange_money.png" alt="Orange Money" style={{ height: '28px', borderRadius: '4px' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: provider === 'orange_money' ? '#d96500' : 'var(--text-main)' }}>
                      Orange Money
                    </span>
                  </button>
                </div>

                {/* CHAMP NUMÉRO DE TÉLÉPHONE */}
                <div className="mb-4">
                  <label className="fw-bold mb-2 d-block" style={{ fontSize: '0.88rem' }}>
                    Numéro de téléphone pour la validation :
                  </label>
                  <input 
                    type="tel" 
                    className="form-control form-control-lg fw-bold" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex : 77 602 67 83 ou 76 271 76 77"
                    style={{ borderRadius: '14px', fontSize: '1rem', padding: '0.9rem 1.2rem' }}
                  />
                  <small className="text-muted d-block mt-2" style={{ fontSize: '0.78rem', lineHeight: '1.5' }}>
                    Une notification de débit sécurisée sans frais sera envoyée sur ce numéro.
                  </small>
                </div>

                {/* BOUTON DE VALIDATION FINAL */}
                <button
                  type="button"
                  disabled={loading || selectedMemberIds.length === 0}
                  className="btn btn-success btn-lg w-100 py-3.5 fw-extrabold shadow d-flex align-items-center justify-content-center gap-2"
                  style={{
                    borderRadius: '18px',
                    background: '#059669',
                    borderColor: '#059669',
                    fontSize: '1.1rem',
                    boxShadow: '0 8px 24px rgba(5, 150, 105, 0.3)'
                  }}
                  onClick={() => handleInitiatePayment('cotisation')}
                >
                  <span>🔒</span>
                  <span>Régler {totalCotisationAmount.toLocaleString('fr-FR')} FCFA via {provider === 'wave' ? 'Wave' : 'Orange Money'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ONGLET 2 : DONS ET PARRAINAGE SOLIDAIRE CSU                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'sponsoring' && (
          <div className="tab-sponsoring fade-in">
            <div className="card shadow-sm p-4 p-md-5 mb-5 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              
              {/* EN-TÊTE DU PARRAINAGE */}
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div className="d-flex align-items-center gap-3">
                  <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'rgba(5, 150, 105, 0.12)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>
                    🤝
                  </div>
                  <div>
                    <h3 className="fw-extrabold mb-1" style={{ fontSize: '1.35rem', color: 'var(--text-main)' }}>
                      Programme de parrainage & don solidaire CSU
                    </h3>
                    <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                      Offrez une couverture médicale 100% gratuite aux enfants démunis, talibés et familles vulnérables de Dakar.
                    </p>
                  </div>
                </div>
                <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669', fontWeight: '700', padding: '6px 14px', borderRadius: '10px', fontSize: '0.82rem' }}>
                  🛡️ Initiative solidaire UNAMUSC Dakar
                </span>
              </div>

              {/* GRILLE DES FORMULES DE PARRAINAGE SÉLECTIONNABLES */}
              <label className="fw-bold mb-2.5 d-block" style={{ fontSize: '0.92rem' }}>
                1. Choisissez une formule d'action solidaire :
              </label>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '2rem' }}>
                {[
                  { id: 'talibe_1', title: '🎒 1 Enfant talibé / daara', price: 3500, label: '3 500 FCFA', desc: '1 an de consultations, soins pédiatriques et pharmacie 100% gratuits', tag: 'Formule recommandée' },
                  { id: 'famille_1', title: '👨‍👩‍👧 1 Famille vulnérable (3 pers.)', price: 10500, label: '10 500 FCFA', desc: 'Prise en charge intégrale mère et enfants pour toute l\'année 2026', tag: 'Impact familial direct' },
                  { id: 'daara_10', title: '🕌 Daara complet (10 enfants)', price: 35000, label: '35 000 FCFA', desc: 'Couverture sanitaire pédiatrique complète pour tout un daara de Dakar', tag: 'Grand parrainage' },
                  { id: 'custom', title: '💖 Don libre solidarité', price: 50000, label: 'Montant au choix', desc: 'Fonds d\'urgence hospitalière, dialyse & pharmacie UNAMUSC Dakar', tag: 'Montant libre' }
                ].map((item) => {
                  const isSel = sponsoringPreset === item.id;
                  return (
                    <div 
                      key={item.id}
                      onClick={() => { 
                        setSponsoringPreset(item.id); 
                        setSponsoringAmount(item.price); 
                        setSponsoringCause(item.title); 
                      }}
                      style={{
                        background: isSel ? 'rgba(5, 150, 105, 0.08)' : 'var(--bg-card-subtle)',
                        border: isSel ? '2px solid #059669' : '1px solid var(--border-color)',
                        borderRadius: '20px',
                        padding: '1.25rem 1.35rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSel ? '0 4px 18px rgba(5, 150, 105, 0.15)' : '0 2px 6px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <span className="badge" style={{ background: isSel ? '#059669' : 'rgba(0,0,0,0.06)', color: isSel ? '#fff' : 'var(--text-sub)', fontSize: '0.72rem', fontWeight: '700', borderRadius: '8px', padding: '3px 8px' }}>
                            {item.tag}
                          </span>
                          <span style={{ fontSize: '1.2rem' }}>{isSel ? '🟢' : '⚪'}</span>
                        </div>
                        <h5 className="fw-extrabold mb-1.5" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                          {item.title}
                        </h5>
                        <p className="text-muted mb-3" style={{ fontSize: '0.8rem', lineHeight: '1.45' }}>
                          {item.desc}
                        </p>
                      </div>

                      <div className="pt-2 border-top d-flex justify-content-between align-items-center" style={{ borderColor: isSel ? 'rgba(5, 150, 105, 0.2)' : 'var(--border-color)' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-sub)', fontWeight: '600' }}>Engagement :</span>
                        <span className="fw-extrabold" style={{ color: '#059669', fontSize: '1.15rem' }}>
                          {item.id === 'custom' && isSel ? `${Number(sponsoringAmount).toLocaleString('fr-FR')} FCFA` : item.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MONTANT PERSONNALISÉ SI DON LIBRE */}
              {sponsoringPreset === 'custom' && (
                <div className="p-4 rounded-4 mb-4 shadow-sm" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                  <label className="fw-bold mb-2.5 d-block" style={{ fontSize: '0.88rem' }}>
                    Saisissez votre montant de don personnalisé (FCFA) :
                  </label>
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {[5000, 15000, 25000, 50000, 100000].map(val => (
                      <button
                        key={val}
                        type="button"
                        className="btn btn-sm fw-bold"
                        style={{
                          borderRadius: '10px',
                          background: Number(sponsoringAmount) === val ? '#065f46' : 'var(--bg-card)',
                          color: Number(sponsoringAmount) === val ? '#ffffff' : 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.82rem',
                          padding: '6px 14px'
                        }}
                        onClick={() => setSponsoringAmount(val)}
                      >
                        {val.toLocaleString('fr-FR')} FCFA
                      </button>
                    ))}
                  </div>
                  <input 
                    type="number" 
                    className="form-control form-control-lg fw-extrabold text-success"
                    value={sponsoringAmount}
                    onChange={(e) => setSponsoringAmount(Number(e.target.value))}
                    min="1000"
                    step="1000"
                    style={{ borderRadius: '14px', padding: '0.85rem 1.2rem', fontSize: '1.2rem' }}
                  />
                </div>
              )}

              {/* INFORMATIONS SUR L'AFFECTATION DU PARRAINAGE */}
              <div className="mb-4">
                <label className="fw-bold mb-2 d-block" style={{ fontSize: '0.88rem' }}>
                  2. Affectation ou structure bénéficiaire ciblée :
                </label>
                <select 
                  className="form-control mb-2"
                  value={sponsoringCause}
                  onChange={(e) => setSponsoringCause(e.target.value)}
                  style={{ borderRadius: '14px', fontSize: '0.92rem', padding: '0.85rem 1.2rem' }}
                >
                  <option value="Daara Serigne Fallou Fann Hock (10 talibés pris en charge)">🕌 Daara Serigne Fallou Fann Hock (10 talibés pris en charge)</option>
                  <option value="Orphelinat de la Médina (Enfants vulnérables)">👶 Orphelinat de la Médina (Enfants vulnérables)</option>
                  <option value="Centre pédiatrique & Foyer social de Pikine">🏥 Centre pédiatrique & Foyer social de Pikine</option>
                  <option value="Daara Thiaroye Gare & Yeumbeul Nord">🕌 Daara Thiaroye Gare & Yeumbeul Nord</option>
                  <option value="Fonds d'urgence hospitalière & dialyse UNAMUSC Dakar">💖 Fonds d'urgence hospitalière & dialyse UNAMUSC Dakar</option>
                  <option value="Attribution prioritaire aux familles les plus démunies de Dakar">🤝 Attribution prioritaire aux familles les plus démunies de Dakar</option>
                </select>
              </div>

              {/* NOM DU DONATEUR POUR LA QUITTANCE OFFICIELLE */}
              <div className="mb-4">
                <label className="fw-bold mb-2 d-block" style={{ fontSize: '0.88rem' }}>
                  3. Nom du parrain / donateur pour le reçu fiscal & attestation officielle :
                </label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={sponsoringDonorName}
                  onChange={(e) => setSponsoringDonorName(e.target.value)}
                  style={{ borderRadius: '14px', fontSize: '0.95rem', padding: '0.85rem 1.2rem' }}
                  placeholder={`Ex : ${formattedHeadName}`}
                />
              </div>

              {/* MODE DE PAIEMENT MOBILE SÉCURISÉ POUR LE DON */}
              <div className="p-4 rounded-4 mb-4 shadow-sm" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '20px' }}>
                <label className="fw-bold mb-3 d-block" style={{ fontSize: '0.88rem' }}>
                  4. Mode de paiement pour le don solidaire :
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setProvider('wave')}
                    className="btn fw-bold p-3"
                    style={{
                      borderRadius: '16px',
                      background: provider === 'wave' ? 'rgba(29, 161, 242, 0.1)' : 'var(--bg-card)',
                      border: provider === 'wave' ? '2px solid #1da1f2' : '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      minHeight: '56px'
                    }}
                  >
                    <img src="/logo_wave.png" alt="Wave" style={{ height: '24px' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: provider === 'wave' ? '#0077b6' : 'var(--text-main)' }}>
                      Wave Mobile
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProvider('orange_money')}
                    className="btn fw-bold p-3"
                    style={{
                      borderRadius: '16px',
                      background: provider === 'orange_money' ? 'rgba(255, 121, 0, 0.1)' : 'var(--bg-card)',
                      border: provider === 'orange_money' ? '2px solid #ff7900' : '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      minHeight: '56px'
                    }}
                  >
                    <img src="/logo_orange_money.png" alt="Orange Money" style={{ height: '24px', borderRadius: '4px' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: '800', color: provider === 'orange_money' ? '#d96500' : 'var(--text-main)' }}>
                      Orange Money
                    </span>
                  </button>
                </div>

                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-3 border-top" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="text-muted fw-bold" style={{ fontSize: '0.88rem' }}>
                    Montant total du don solidaire :
                  </span>
                  <h3 className="fw-extrabold mb-0" style={{ color: '#059669', fontSize: '1.6rem' }}>
                    {Number(sponsoringAmount || 0).toLocaleString('fr-FR')} FCFA
                  </h3>
                </div>
              </div>

              {/* BOUTON DE VALIDATION FINAL */}
              <button
                type="button"
                disabled={loading || !sponsoringAmount}
                className="btn btn-success btn-lg w-100 py-3.5 fw-extrabold shadow d-flex align-items-center justify-content-center gap-2"
                style={{ background: '#059669', borderColor: '#059669', borderRadius: '18px', fontSize: '1.05rem', boxShadow: '0 8px 24px rgba(5, 150, 105, 0.3)' }}
                onClick={() => handleInitiatePayment('sponsoring')}
              >
                <span>💖</span>
                <span>Valider le don solidaire de {Number(sponsoringAmount || 0).toLocaleString('fr-FR')} FCFA via {provider === 'wave' ? 'Wave' : 'Orange Money'}</span>
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ONGLET 3 : MES REÇUS & HISTORIQUE PERSONNEL (DESIGN OFFICIEL PRO)   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="tab-history fade-in">
            <div className="card shadow-sm p-4 p-md-5 mb-5 rounded-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              
              {/* EN-TÊTE REÇUS AVEC STATISTIQUES RÉCAPITULATIVES */}
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <div>
                  <h3 className="fw-extrabold mb-1" style={{ fontSize: '1.35rem', color: 'var(--text-main)' }}>
                    📜 Reçus & quittances de {formattedHeadName}
                  </h3>
                  <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                    Historique officiel certifié de vos cotisations et attestations de droits CSU.
                  </p>
                </div>

                <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669', fontWeight: '700', padding: '6px 14px', borderRadius: '10px', fontSize: '0.84rem' }}>
                  {personalPayments.length} Quittance{personalPayments.length > 1 ? 's' : ''} certifiée{personalPayments.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* BANDEAU RÉCAPITULATIF DE SYNTHÈSE */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '2rem' }}>
                <div className="p-3.5 rounded-4 shadow-sm" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <span className="text-muted fw-bold d-block mb-1" style={{ fontSize: '0.78rem' }}>Total cotisé & homologué :</span>
                  <h4 className="fw-extrabold mb-0" style={{ color: '#059669', fontSize: '1.4rem' }}>
                    {personalPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0).toLocaleString('fr-FR')} FCFA
                  </h4>
                </div>
                <div className="p-3.5 rounded-4 shadow-sm" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <span className="text-muted fw-bold d-block mb-1" style={{ fontSize: '0.78rem' }}>Couverture médicale :</span>
                  <h4 className="fw-extrabold mb-0" style={{ color: '#10b981', fontSize: '1.2rem' }}>
                    🛡️ Tiers-payant 80% Actif
                  </h4>
                </div>
                <div className="p-3.5 rounded-4 shadow-sm" style={{ background: 'var(--bg-body)', border: '1px solid var(--border-color)' }}>
                  <span className="text-muted fw-bold d-block mb-1" style={{ fontSize: '0.78rem' }}>Échéance de validité :</span>
                  <h4 className="fw-extrabold mb-0" style={{ color: 'var(--text-main)', fontSize: '1.2rem' }}>
                    📅 31 Décembre 2026
                  </h4>
                </div>
              </div>

              {/* LISTE DES QUITTANCES */}
              {personalPayments.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <span style={{ fontSize: '3rem' }}>📭</span>
                  <h5 className="mt-3 mb-1 fw-bold" style={{ color: 'var(--text-main)' }}>Aucun reçu enregistré</h5>
                  <p className="mb-3 text-muted" style={{ fontSize: '0.88rem' }}>Vous n'avez pas encore effectué de paiement pour cet assuré.</p>
                  <button 
                    type="button" 
                    className="btn btn-success btn-sm fw-bold px-4 py-2.5"
                    style={{ borderRadius: '12px', background: '#059669', borderColor: '#059669' }}
                    onClick={() => setActiveTab('cotisation')}
                  >
                    💳 Régler une première cotisation
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {personalPayments.map((p) => (
                    <div 
                      key={p.id}
                      className="p-4 rounded-4 shadow-sm"
                      style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', borderRadius: '20px' }}
                    >
                      {/* Ligne 1 : Opérateur + Titre + Référence + Statut */}
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="d-flex align-items-center gap-3">
                          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: p.provider === 'wave' ? 'rgba(29, 161, 242, 0.12)' : 'rgba(255, 121, 0, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <img src={p.provider === 'wave' ? '/logo_wave.png' : '/logo_orange_money.png'} alt={p.provider} style={{ height: '22px' }} />
                          </div>
                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <h5 className="fw-bold mb-0" style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                                {p.type}
                              </h5>
                              <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.12)', color: '#059669', fontSize: '0.74rem', fontWeight: '700', borderRadius: '8px', padding: '4px 8px' }}>
                                ✅ Validé & Homologué
                              </span>
                            </div>
                            <div className="text-muted mt-1" style={{ fontSize: '0.8rem' }}>
                              Quittance N° <code className="fw-bold" style={{ color: 'var(--text-main)', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{p.reference}</code> • Validée le {p.date}
                            </div>
                          </div>
                        </div>

                        <span className="badge" style={{ background: 'var(--bg-body)', color: 'var(--text-sub)', border: '1px solid var(--border-color)', fontSize: '0.76rem', padding: '4px 10px', borderRadius: '8px' }}>
                          🏢 {p.unionName || 'Mutuelle de santé départementale de Dakar'}
                        </span>
                      </div>

                      {/* Ligne 2 : Détails bénéficiaires & Montant clairement isolé */}
                      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                        <div style={{ minWidth: '220px', flex: 1 }}>
                          <span className="text-muted fw-semibold d-block mb-1" style={{ fontSize: '0.78rem' }}>
                            Personnes prises en charge :
                          </span>
                          <p className="fw-bold mb-0" style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            👥 {p.beneficiaries}
                          </p>
                        </div>

                        <div className="d-flex align-items-center gap-3 ms-auto">
                          <div className="text-end" style={{ paddingRight: '0.5rem' }}>
                            <span className="text-muted fw-semibold d-block" style={{ fontSize: '0.74rem' }}>
                              Montant total acquitté
                            </span>
                            <span className="fw-extrabold" style={{ fontSize: '1.35rem', color: '#059669' }}>
                              {Number(p.amount).toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>

                          <button
                            type="button"
                            className="btn btn-success fw-bold px-3.5 py-2.5 d-inline-flex align-items-center gap-2 shadow-sm"
                            style={{ borderRadius: '14px', fontSize: '0.86rem', background: '#059669', borderColor: '#059669', whiteSpace: 'nowrap' }}
                            onClick={() => handleDownloadReceipt(p)}
                          >
                            <span>📄</span>
                            <span>Télécharger reçu PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODALE POPUP DE SUCCÈS IMMÉDIAT DU PAIEMENT */}
        {paymentSuccess && (
          <div className="card shadow-lg p-4 p-md-5 mb-4 rounded-4 border-2 border-success fade-in" style={{ background: 'rgba(16, 185, 129, 0.06)', borderRadius: '24px' }}>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-4">
              <div className="d-flex align-items-center gap-3.5">
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', flexShrink: 0 }}>
                  ✓
                </div>
                <div>
                  <h4 className="fw-extrabold text-success mb-1" style={{ fontSize: '1.3rem' }}>
                    🎉 Paiement validé & homologué avec succès !
                  </h4>
                  <p className="text-muted mb-0" style={{ fontSize: '0.88rem' }}>
                    Montant de <strong>{paymentSuccess.amount.toLocaleString('fr-FR')} FCFA</strong> réglé pour <strong>{paymentSuccess.beneficiaries}</strong>.
                  </p>
                </div>
              </div>

              <div className="d-flex gap-2.5">
                <button
                  type="button"
                  className="btn btn-success fw-bold px-4 py-3 shadow d-inline-flex align-items-center gap-2"
                  style={{ borderRadius: '16px', background: '#059669', borderColor: '#059669', fontSize: '0.95rem' }}
                  onClick={() => handleDownloadReceipt(paymentSuccess)}
                >
                  <span>📄</span>
                  <span>Télécharger le reçu PDF</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-bold px-3.5 py-3"
                  style={{ borderRadius: '16px', fontSize: '0.95rem' }}
                  onClick={() => setPaymentSuccess(null)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODALE SIMULATION PUSH USSD MOBILE MONEY */}
        {showUssdModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1rem' }}>
            <div className="card shadow-lg p-4 p-md-5 text-center rounded-4 fade-in" style={{ maxWidth: '460px', width: '100%', background: '#ffffff', borderRadius: '24px' }}>
              <div className="mb-3">
                <img src={provider === 'wave' ? '/logo_wave.png' : '/logo_orange_money.png'} alt={provider} style={{ height: '42px', borderRadius: '6px' }} />
              </div>
              <h4 className="fw-bold mb-2 text-dark" style={{ fontSize: '1.25rem' }}>
                Confirmation {provider === 'wave' ? 'Wave' : 'Orange Money'} sur mobile
              </h4>
              <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                Veuillez valider la demande de débit de <strong>{(activeTab === 'cotisation' ? totalCotisationAmount : parseInt(sponsoringAmount, 10)).toLocaleString('fr-FR')} FCFA</strong> sur votre téléphone ({phone}).
              </p>

              <div className="my-3 py-2.5 px-4 rounded-pill bg-light text-success fw-bold font-monospace" style={{ fontSize: '1.3rem', display: 'inline-block' }}>
                ⏱️ 00:{ussdTimer < 10 ? `0${ussdTimer}` : ussdTimer}
              </div>

              <div className="progress mb-3" style={{ height: '8px', borderRadius: '10px' }}>
                <div className="progress-bar progress-bar-striped progress-bar-animated bg-success" style={{ width: `${(ussdTimer / 10) * 100}%` }}></div>
              </div>

              <small className="text-muted d-block mb-4" style={{ fontSize: '0.78rem' }}>
                Simulation automatique en cours... Vous allez être redirigé dès validation.
              </small>

              <button type="button" className="btn btn-outline-secondary btn-sm fw-bold px-4 py-2" style={{ borderRadius: '14px' }} onClick={() => { setShowUssdModal(false); setLoading(false); }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* MODALE D'AJOUT RAPIDE D'ENFANT / AYANT DROIT */}
        {showAddDependentModal && (
          <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ background: 'rgba(0,0,0,0.65)', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1rem' }}>
            <div className="card shadow-lg p-4 p-md-5 rounded-4 fade-in" style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-card)', borderRadius: '24px' }}>
              <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                <h4 className="fw-bold mb-0" style={{ fontSize: '1.2rem' }}>➕ Ajouter un ayant droit à charge</h4>
                <button type="button" className="btn-close" onClick={() => setShowAddDependentModal(false)}></button>
              </div>

              <form onSubmit={handleAddDependent}>
                <div className="mb-3.5">
                  <label className="fw-bold mb-1.5 d-block" style={{ fontSize: '0.86rem' }}>Nom et prénom :</label>
                  <input 
                    type="text" 
                    required 
                    className="form-control" 
                    value={newDepName} 
                    onChange={(e) => setNewDepName(e.target.value)}
                    placeholder="Ex : Babacar, Aminata, Cheikh..."
                    style={{ borderRadius: '14px', padding: '0.8rem 1.1rem' }}
                  />
                </div>

                <div className="row g-3 mb-3.5">
                  <div className="col-6">
                    <label className="fw-bold mb-1.5 d-block" style={{ fontSize: '0.86rem' }}>Date de naissance :</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={newDepBirthDate} 
                      onChange={(e) => setNewDepBirthDate(e.target.value)}
                      placeholder="JJ/MM/AAAA"
                      style={{ borderRadius: '14px', padding: '0.8rem 1.1rem' }}
                    />
                  </div>
                  <div className="col-6">
                    <label className="fw-bold mb-1.5 d-block" style={{ fontSize: '0.86rem' }}>Genre :</label>
                    <select 
                      className="form-select" 
                      value={newDepGender} 
                      onChange={(e) => setNewDepGender(e.target.value)}
                      style={{ borderRadius: '14px', padding: '0.8rem 1.1rem' }}
                    >
                      <option value="M">Masculin (Garçon / Homme)</option>
                      <option value="F">Féminin (Fille / Femme)</option>
                    </select>
                  </div>
                </div>

                <div className="form-check mb-4 p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
                  <input 
                    type="checkbox" 
                    className="form-check-input" 
                    id="isMajorCheck"
                    checked={newDepIsMajor} 
                    onChange={(e) => setNewDepIsMajor(e.target.checked)}
                    style={{ accentColor: '#10b981', marginTop: '0.2rem' }}
                  />
                  <label className="form-check-label fw-bold ms-2" htmlFor="isMajorCheck" style={{ fontSize: '0.88rem' }}>
                    Ayant droit majeur (+18 ans) — Formule individuelle 80%
                  </label>
                  <small className="d-block text-muted ms-2 mt-1" style={{ fontSize: '0.76rem' }}>
                    Si non coché, l'enfant bénéficie de la gratuité pédiatrique à 100%.
                  </small>
                </div>

                <div className="d-flex gap-2.5">
                  <button type="submit" className="btn btn-success flex-fill fw-bold py-3" style={{ borderRadius: '16px', background: '#059669', borderColor: '#059669' }}>
                    Enregistrer l'ayant droit
                  </button>
                  <button type="button" className="btn btn-secondary px-4 py-3" style={{ borderRadius: '16px' }} onClick={() => setShowAddDependentModal(false)}>
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
