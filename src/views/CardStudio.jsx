import { calculateAge, getAgeLabel } from '../utils/csuFormatter';
import { getStoredMembers, saveStoredMembers, resetToDefaultMembers } from '../utils/beneficiaryStore';
import { detectLanIp, getCachedLanIp } from '../utils/lanIp';
import {
  fetchSponsorsWithLogos,
  saveSponsorLogo,
  deleteSponsorLogo,
  readImageFileAsDataUrl,
  getLocalSponsorLogo,
  getCardSponsorAssignments,
  assignSponsorToCard,
  getCardLogo,
  setCardLogo,
  getCardsSponsoredBy,
  applySponsorLogoToAllCards,
  SPONSOR_LOGO_MAX_BYTES
} from '../utils/sponsorLogos';
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
// Armoiries vectorielles de la Ville de Dakar (filigrane des cartes scolaires)
import DakarCoatOfArms from '../components/DakarCoatOfArms';
// Programmes de cartes + coordonnées par MSD (source de vérité des libellés)
import {
  CARD_PROGRAMS,
  DEPARTMENTAL_UNIONS,
  buildContactLines,
  resolveCardProgram,
  resolveUnion,
  SOLUTION_PHONE
} from '../utils/cardPrograms';

// Vecteur SVG officiel du Drapeau du Sénégal (Vert, Jaune avec étoile verte, Rouge)
const SenegalFlagSvg = ({ style }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 900 600" 
    style={{ 
      width: '34px', 
      height: '22px', 
      borderRadius: '3px', 
      border: '1px solid #cbd5e1', 
      boxShadow: '0 1px 3px rgba(0,0,0,0.15)', 
      flexShrink: 0,
      ...style 
    }}
  >
    <rect width="300" height="600" fill="#00853f"/>
    <rect x="300" width="300" height="600" fill="#fdef42"/>
    <rect x="600" width="300" height="600" fill="#e31b23"/>
    <polygon points="450,210 476,290 560,290 492,340 518,420 450,370 382,420 408,340 340,290 424,290" fill="#00853f"/>
  </svg>
);

const getDefaultAcademicYear = () => {
  const year = new Date().getFullYear();
  return `${year}-${year + 1}`;
};

const getStoredCardDesign = (cardNumber) => {
  try {
    const allDesigns = JSON.parse(localStorage.getItem('cmu-card-designs') || '{}');
    return allDesigns[cardNumber] || {};
  } catch {
    return {};
  }
};

const saveCardDesign = (cardNumber, design) => {
  try {
    const allDesigns = JSON.parse(localStorage.getItem('cmu-card-designs') || '{}');
    localStorage.setItem('cmu-card-designs', JSON.stringify({ ...allDesigns, [cardNumber]: design }));
  } catch {
    /* La personnalisation reste active pour la session si le stockage est indisponible. */
  }
};

function SchoolCardFront({ cardData, currentUnion, getMsdLogo, customLogo = null }) {
  // Les libellés proviennent du programme de la carte (CMU-Élèves ou
  // CMU-Daara) : une carte Daara ne peut donc plus afficher « CMU-Élèves ».
  const program = resolveCardProgram(cardData.cardProgram);
  const showIef = Boolean(program.showIef);
  const idValue = cardData.academicData.ine || cardData.cmuNumber;
  // Filigrane : logo du parrain / de la carte s'il a été choisi, sinon les
  // armoiries de la Ville de Dakar (comme sur les cartes modèles).
  const watermarkStyle = customLogo ? {
    backgroundImage: `url(${customLogo})`,
    opacity: cardData.cardDesign.watermarkOpacity,
    backgroundSize: `${cardData.cardDesign.watermarkScale}%`,
    backgroundPosition: cardData.cardDesign.watermarkPosition === 'TOP' ? 'center 26%' : cardData.cardDesign.watermarkPosition === 'BOTTOM' ? 'center 74%' : 'center'
  } : { opacity: Math.min(0.9, Number(cardData.cardDesign.watermarkOpacity || 0.12) * 2.6) };
  const labelStyle = { color: '#64748b', fontSize: '0.53rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.1 };
  const valueStyle = { color: '#0f172a', fontSize: '0.86rem', fontWeight: '900', lineHeight: 1.1, overflowWrap: 'anywhere' };

  return <>
    <div className="school-card-watermark" style={watermarkStyle} aria-hidden="true">
      {!customLogo && <DakarCoatOfArms className="school-card-watermark-emblem" />}
    </div>
    <div className="school-card-header">
      <img src={getMsdLogo(cardData.unionCode)} alt="MSD" className="school-card-brand" />
      <div className="school-card-government">
        <SenegalFlagSvg style={{ width: '28px', height: '18px', marginBottom: '2px' }} />
        <strong>République du Sénégal</strong>
        <strong>Ministère de l'Éducation nationale</strong>
        <b>{cardData.unionName}</b>
      </div>
      <img src="/sencsu_logo.png" alt="SEN-CSU" className="school-card-brand" onError={(e) => { e.currentTarget.src = '/logo_csu_official.png'; }} />
    </div>
    <div className="school-card-tricolor" />
    <div className="school-card-program-bar" style={{ borderColor: `${cardData.cardDesign.accentColor}55` }}>
      {/* L'année scolaire et la classe ne figurent PAS sur le recto : ces
          données changent chaque année. Elles sont portées par le QR code
          (scannable par l'agent) — voir academicQrData dans l'effet QR. */}
      <strong>{program.frontBanner}</strong>
      <span>{program.frontBadge}</span>
    </div>
    <div className="school-card-front-content">
      <div className="school-card-details">
        <div><span style={labelStyle}>Prénom(s)</span><strong style={valueStyle}>{cardData.firstName}</strong></div>
        <div><span style={labelStyle}>Nom</span><strong style={valueStyle}>{cardData.lastName}</strong></div>
        <div className="school-card-wide"><span style={labelStyle}>🎂 Né(e) le & Lieu • Sexe</span><strong style={valueStyle}>{cardData.birthDate} à {cardData.birthPlace} • {cardData.gender === 'F' ? 'Féminin' : 'Masculin'}</strong></div>
        <div className="school-card-wide"><span style={labelStyle}>{program.idLabel}</span><strong style={valueStyle}>{idValue}</strong></div>
        <div className="school-card-wide"><span style={labelStyle}>{program.schoolWord}</span><strong style={valueStyle}>{cardData.academicData.schoolName || cardData.mutuelleOrigine}</strong></div>
        {/* IA / IEF : uniquement pour les élèves de l'école publique.
            Les daaras ne relèvent pas de ce circuit — le champ est masqué
            et ne doit pas laisser de trou sur la carte. */}
        {showIef && (
          <div className="school-card-wide"><span style={labelStyle}>IA / IEF</span><strong style={valueStyle}>{cardData.academicData.ia || 'IA à renseigner'} — {cardData.academicData.ief || 'IEF à renseigner'}</strong></div>
        )}
        <div className="school-card-wide"><span style={labelStyle}>👤 {program.referralLabel}</span><strong style={valueStyle}>{cardData.tuteurName || cardData.sponsorName || cardData.fullName} • {cardData.tuteurPhone || cardData.phone || 'téléphone à renseigner'}</strong></div>
      </div>
      <div className="school-card-photo">
        {cardData.photoUrl ? <img src={cardData.photoUrl} alt={cardData.fullName} /> : <span>Photo<br />à importer</span>}
      </div>
    </div>
    <div className="school-card-footer"><span>{program.frontFooter}</span><span>DÉLIVRÉE PAR LA MSD DE {currentUnion.region.toUpperCase()}</span></div>
  </>;
}

function SchoolCardBack({ cardData, qrCodeDataUrl, customLogo = null }) {
  const program = resolveCardProgram(cardData.cardProgram);
  // Coordonnées de la MSD émettrice uniquement : une carte de la MSD de
  // Diourbel ne doit jamais afficher les numéros du siège de Dakar.
  const contactLines = buildContactLines(cardData.unionCode, cardData.msdContacts);
  const watermarkStyle = customLogo ? {
    backgroundImage: `url(${customLogo})`,
    opacity: cardData.cardDesign.watermarkOpacity,
    backgroundSize: `${cardData.cardDesign.watermarkScale}%`,
    backgroundPosition: cardData.cardDesign.watermarkPosition === 'TOP' ? 'center 26%' : cardData.cardDesign.watermarkPosition === 'BOTTOM' ? 'center 74%' : 'center'
  } : { opacity: Math.min(0.9, Number(cardData.cardDesign.watermarkOpacity || 0.12) * 2.6) };
  return <>
    <div className="school-card-watermark" style={watermarkStyle} aria-hidden="true">
      {!customLogo && <DakarCoatOfArms className="school-card-watermark-emblem" />}
    </div>
    <div className="school-card-header school-card-back-header">
      <img src="/logo_unamusc.png" alt="UNAMUSC" className="school-card-brand" />
      <div className="school-card-government"><SenegalFlagSvg style={{ width: '28px', height: '18px', marginBottom: '2px' }} /><strong>Couverture Sanitaire Universelle</strong><b>{program.backBanner}</b></div>
      <img src="/sencsu_logo.png" alt="SEN-CSU" className="school-card-brand" onError={(e) => { e.currentTarget.src = '/logo_csu_official.png'; }} />
    </div>
    <div className="school-card-tricolor" />
    <div className="school-card-back-content">
      <div className="school-card-qr-block">
        <div className="school-card-qr">{qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR code de vérification" /> : 'QR'}</div>
        <span className="school-card-qr-caption">🧮 Scannez pour ouvrir le carnet de santé de l'enfant</span>
      </div>
      <div className="school-card-back-info">
        <span>Bénéficiaire</span><strong>{cardData.fullName}</strong>
        <span>{program.backCodeLabel}</span><b>{cardData.cmuNumber}</b>
        <span>Mutuelle de santé</span><strong>{cardData.unionName}</strong>
        <div className="school-card-health-box">
          {contactLines.map((line) => (
            <b key={line.kind} className={`school-card-contact school-card-contact-${line.kind}`}>
              {line.label} : <em>{line.value}</em>
            </b>
          ))}
        </div>
      </div>
    </div>
    <div className="school-card-footer school-card-back-footer"><span>Solution développée par <b>Sen-E-Carte : {SOLUTION_PHONE}</b></span></div>
  </>;
}


export default function CardStudio({ lang = 'fr', setView = null }) {
  // Système d'Audit & Filtres des Cartes et Photos Officielles (137/137)
  const [auditFilter, setAuditFilter] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'PHOTO_PENDING'

  // Import en masse (Excel MSD Dakar + dossier de photos appariées)
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkNotice, setBulkNotice] = useState(null); // { type, text }
  const excelInputRef = useRef(null);
  const photosInputRef = useRef(null);
  const pendingPhotosRef = useRef(null); // FileList gardée entre les 2 sélections
  // Unions Départementales des Mutuelles de Santé du Sénégal (UNAMUSC)
  // Source de vérité + coordonnées : src/utils/cardPrograms.js
  const departmentalUnions = DEPARTMENTAL_UNIONS;

  // Logos officiels des Mutuelles de Santé Départementales (MSD) émettrices.
  // Chaque MSD délivre SES cartes : le logo du recto s'adapte automatiquement
  // à l'union départementale du bénéficiaire (repli logo UNAMUSC si le logo
  // départemental n'a pas encore été fourni).
  const msdLogos = {
    DKR: '/logo_msdd_officiel.jpg' // MSD Dakar — logo officiel (mains + famille + croix rouge)
  };
  const getMsdLogo = (unionId) => msdLogos[unionId] || '/logo_unamusc.png';

  // Liste des membres exemples réels UNAMUSC
  const initialMembers = getStoredMembers();

  const [members, setMembers] = useState(initialMembers);
  const [selectedMemberId, setSelectedMemberId] = useState(initialMembers[0].id);
  const [selectedCardType, setSelectedCardType] = useState('PRINCIPAL');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [qrCodePayload, setQrCodePayload] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showQrInspector, setShowQrInspector] = useState(false);

  // Personnalisation « parrain / Mairie » : logos des sponsors solidaires apposés
  // sur les cartes. Les logos sont stockés dans beneficiaries.sponsor_logo via
  // /api/parrainages/sponsors/:phone/logo, avec repli localStorage (hors-ligne).
  const [sponsors, setSponsors] = useState([]);
  const [sponsorsSource, setSponsorsSource] = useState('empty');
  const [sponsorAssignments, setSponsorAssignments] = useState(() => getCardSponsorAssignments());
  const [sponsorLogoBusy, setSponsorLogoBusy] = useState(false);
  const [sponsorNotice, setSponsorNotice] = useState(null); // { type: 'success'|'warning'|'error', text }
  const sponsorLogoInputRef = useRef(null);
  const [cardProgram, setCardProgram] = useState('CLASSIC');
  const [academicData, setAcademicData] = useState({
    academicYear: getDefaultAcademicYear(),
    classLevel: '',
    schoolName: '',
    ia: '',
    ief: '',
    ine: ''
  });
  const [cardDesign, setCardDesign] = useState({
    accentColor: '#059669',
    borderColor: '#059669',
    watermarkOpacity: 0.12,
    watermarkScale: 56,
    watermarkPosition: 'CENTER'
  });

  // Rotation dynamique 15s du QR code dans CardStudio
  const [qrStudioSeconds, setQrStudioSeconds] = useState(15);
  const [studioOtp, setStudioOtp] = useState(() => Math.floor(Date.now() / 15000));

  useEffect(() => {
    const timer = setInterval(() => {
      setQrStudioSeconds((prev) => {
        if (prev <= 1) {
          setStudioOtp(Math.floor(Date.now() / 15000));
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Mode de cible pour le QR Code (IP local Wi-Fi pour redirection directe mobile, HTTPS officiel/public, ou Code CSU brut)
  const [qrTargetMode, setQrTargetMode] = useState('WIFI_IP'); // 'WIFI_IP' par défaut : ouvre immédiatement la page web de l'assuré au scan !
  const [customPublicUrl, setCustomPublicUrl] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('cmu-public-url')) || '';
  });
  const [customWifiIp, setCustomWifiIp] = useState(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('cmu-wifi-ip') : null;
    if (cached && cached !== '192.168.1.13' && cached !== '192.168.1.5' && cached !== '192.168.1.64') return cached;
    // Si l'app est déjà ouverte via l'IP LAN, c'est la bonne
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.hostname;
    }
    return getCachedLanIp() || '192.168.1.42';
  });

  // Détection AUTOMATIQUE de l'IP LAN réelle du PC (backend /api/lan-ip)
  useEffect(() => {
    let cancelled = false;
    detectLanIp().then((ip) => {
      if (cancelled || !ip) return;
      localStorage.setItem('cmu-wifi-ip', ip);
      // Ne pas écraser une IP saisie manuellement par l'utilisateur
      setCustomWifiIp((prev) => (prev && prev !== '192.168.1.5' && prev !== '192.168.1.13' && prev !== '192.168.1.64' ? prev : ip));
    });
    return () => { cancelled = true; };
  }, []);

  // Formulaire d'édition directe
  const [editForm, setEditForm] = useState(initialMembers[0]);

  const rectoRef = useRef(null);
  const versoRef = useRef(null);

  // Membre principal sélectionné
  const currentMember = members.find(m => m.id === selectedMemberId) || members[0];

  // Sélection automatique d'un nouveau membre généré depuis l'Adhésion en ligne
  useEffect(() => {
    const handleAutoSelectNew = () => {
      const updatedMembers = getStoredMembers();
      setMembers(updatedMembers);
      const lastId = localStorage.getItem('unamusc_last_created_member_id');
      if (lastId) {
        const found = updatedMembers.find(m => m.id === lastId);
        if (found) {
          setSelectedMemberId(found.id);
          setSelectedCardType('PRINCIPAL');
        }
      }
    };

    handleAutoSelectNew();
    window.addEventListener('unamusc_store_change', handleAutoSelectNew);
    return () => window.removeEventListener('unamusc_store_change', handleAutoSelectNew);
  }, []);

  // Chargement de la liste des parrains solidaires + de leurs logos personnalisés
  // (backend en priorité, cache localStorage en repli hors-ligne).
  useEffect(() => {
    let cancelled = false;
    fetchSponsorsWithLogos()
      .then(({ sponsors: list, source }) => {
        if (cancelled) return;
        // Repli officiel : quand aucun parrain n'est disponible (backend éteint,
        // base vide…), la Mairie de Dakar reste toujours sélectionnable avec
        // son logo officiel — le parrainage ne bloque jamais la personnalisation.
        const effective = (list && list.length > 0) ? list : [{
          id: null,
          firstName: 'Mairie',
          lastName: 'de Dakar',
          name: 'Mairie de Dakar (logo officiel)',
          phone: 'MAIRIE_DAKAR',
          cmuNumber: '',
          mutuelleName: '',
          filleulCount: 0,
          sponsorLogo: '/logo_mairie_dakar.png'
        }];
        setSponsors(effective);
        setSponsorsSource(source === 'empty' ? 'local-official' : source);
      })
      .catch(() => {
        if (!cancelled) setSponsorsSource('empty');
      });
    return () => { cancelled = true; };
  }, []);

  // Hydratation ZÉRO PERTE : récupère au démarrage les bénéficiaires conservés
  // côté serveur (fichier secours backend/data/store.json quand PostgreSQL est
  // éteint) et les fusionne dans le store du studio — les adhésions importées,
  // en ligne ou en masse, et les cartes déjà imprimées ne sont jamais perdues.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { hydrateFromServerFallback } = await import('../utils/bulkImport');
        const { apiFetch } = await import('../utils/api');
        const res = await apiFetch('/api/beneficiaries/fallback');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const records = (data && data.records) || [];
        if (records.length === 0 || cancelled) return;
        const existing = getStoredMembers();
        const existingCodes = new Set(existing.map(m => (m.cmuNumber || '').toString()));
        const missing = records
          .filter(r => r.cmuNumber && !existingCodes.has(r.cmuNumber.toString()))
          .map((r, i) => ({
            id: `FB-${Date.now().toString(36)}-${i}`,
            cmuNumber: r.cmuNumber,
            adherentCode: r.numeroAdherent || String(r.cmuNumber).replace(/\.\d+$/, ''),
            firstName: String(r.prenom || r.firstName || '').toUpperCase(),
            lastName: String(r.nom || r.lastName || '').toUpperCase(),
            birthDate: r.birthDate || '',
            birthPlace: '',
            gender: (r.sexe || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
            bloodGroup: 'O+',
            address: r.address || 'Dakar',
            commune: 'Dakar',
            departmentUnionId: 'DKR',
            mutuelleOrigine: r.mutuelleName || 'Mutuelle de santé départementale de Dakar',
            phone: r.telephone || r.phone || '',
            package: 'UNAMUSC 80%',
            cardTypeLabel: 'Import Excel',
            photoUrl: r.photoUrl || '',
            hasOfficialPhoto: !!r.photoUrl,
            photoStatus: r.photoUrl ? 'OFFICIAL' : 'PENDING_UPLOAD',
            verificationStatus: 'FALLBACK_HYDRATION',
            allergies: 'Aucune connue',
            antecedents: 'À compléter',
            dependents: []
          }));
        if (missing.length > 0 && !cancelled) {
          const next = [...missing, ...existing];
          saveStoredMembers(next);
          setMembers(next);
          setBulkNotice({
            type: 'success',
            text: `☁️ ${missing.length} bénéficiaire(s) conservé(s) côté serveur ont été restaurés automatiquement dans le studio (adhésions/importations précédentes jamais perdues).`
          });
        }
      } catch {
        /* backend injoignable : le store local actuel reste la source */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Synchroniser le formulaire d'édition
  useEffect(() => {
    setEditForm({ ...currentMember });
  }, [selectedMemberId]);

  // Si une personne à charge majeure est sélectionnée
  const isMajorDependentSelected = selectedCardType.startsWith('MAJOR_');
  const majorDependentIndex = isMajorDependentSelected ? parseInt(selectedCardType.replace('MAJOR_', ''), 10) : null;
  const currentMajorDependent = isMajorDependentSelected ? currentMember.dependents.filter(d => d.isMajor)[majorDependentIndex] : null;

  // Obtenir l'Union Départementale courante
  const currentUnion = resolveUnion(editForm.departmentUnionId || currentMember.departmentUnionId);

  const getValidPhone = (primaryPhone, secondaryPhone, defaultFallback = '77 631 71 73') => {
    const isInvalid = (val) => !val || String(val).trim() === '' || String(val).trim() === '—' || String(val).trim() === '-';
    if (!isInvalid(primaryPhone)) return String(primaryPhone).trim();
    if (!isInvalid(secondaryPhone)) return String(secondaryPhone).trim();
    return defaultFallback;
  };

  // Formatage téléphone sénégalais pour la carte : « 776415295/762717677 »
  // devient « 77 641 52 95 / 76 271 76 77 » — permet le retour à la ligne et
  // évite tout chevauchement avec le pied de carte.
  const formatPhoneCard = (raw) => {
    const valid = getValidPhone(raw, currentMember?.phone, '77 631 71 73');
    const parts = String(valid).split(/[\/;,]+/).map(p => p.trim()).filter(Boolean);
    return parts.map(p => {
      const d = p.replace(/\D/g, '');
      if (d.length === 9) return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
      return d.replace(/(\d{2})(?=\d)/g, '$1 ') || p;
    }).join(' / ');
  };

  // --- Personnalisation parrain : logo apposé sur la carte en cours ---------
  // Numéro CSU de la carte affichée (titulaire ou ayant droit majeur sélectionné)
  const cardCmuNumber = currentMajorDependent
    ? `${(editForm.cmuNumber || currentMember.cmuNumber).replace(/\.0$/, '')}${currentMajorDependent.codeSuffix}`
    : (editForm.cmuNumber || currentMember.cmuNumber);

  // Coordonnées de la MSD émettrice (permanence, standard) : elles suivent
  // l'union départementale du bénéficiaire et ne sont jamais partagées
  // d'une MSD à l'autre. Saisies MSD stockées par carte (design persisté).
  // ⚠️ Calculé APRÈS cardCmuNumber : le lire plus tôt déclencherait une
  // erreur de zone morte temporelle (ReferenceError) au rendu.
  const msdContacts = (getStoredCardDesign(cardCmuNumber) || {}).msdContacts || null;

  // Parrain explicitement attribué à cette carte (persisté par numéro de carte)
  const currentSponsorPhone = sponsorAssignments[cardCmuNumber] || '';
  const currentSponsor = sponsors.find(s => s.phone === currentSponsorPhone) || null;
  const currentSponsorLogo = (currentSponsor && currentSponsor.sponsorLogo)
    || (currentSponsorPhone ? getLocalSponsorLogo(currentSponsorPhone) : null);
  const currentSponsorName = (currentSponsor && currentSponsor.name)
    || (currentSponsorPhone ? `Parrain ${currentSponsorPhone}` : '');

  useEffect(() => {
    const storedDesign = getStoredCardDesign(cardCmuNumber);
    // Programme par défaut : celui stocké pour cette carte, sinon le programme
    // pré-assigné au membre (cartes modèles CMU-Élèves / CMU-Daara), sinon CLASSIC.
    const memberProgram = currentMember && currentMember.cardProgram;
    const nextProgram = storedDesign.cardProgram || memberProgram || 'CLASSIC';
    setCardProgram(nextProgram);
    const memberAcademic = (currentMember && currentMember.academicData) || {};
    setAcademicData({
      academicYear: storedDesign.academicYear || memberAcademic.academicYear || getDefaultAcademicYear(),
      classLevel: storedDesign.classLevel || memberAcademic.classLevel || '',
      schoolName: storedDesign.schoolName || memberAcademic.schoolName || '',
      ia: storedDesign.ia || memberAcademic.ia || '',
      ief: storedDesign.ief || memberAcademic.ief || '',
      ine: storedDesign.ine || memberAcademic.ine || currentMember.ine || ''
    });
    setCardDesign({
      accentColor: storedDesign.accentColor || CARD_PROGRAMS[nextProgram].accent,
      borderColor: storedDesign.borderColor || CARD_PROGRAMS[nextProgram].accent,
      watermarkOpacity: Number(storedDesign.watermarkOpacity ?? 0.12),
      watermarkScale: Number(storedDesign.watermarkScale ?? 56),
      watermarkPosition: storedDesign.watermarkPosition || 'CENTER'
    });
  }, [cardCmuNumber]);

  const updateCardDesign = (patch) => {
    const next = { ...cardDesign, ...patch };
    setCardDesign(next);
    saveCardDesign(cardCmuNumber, { ...next, ...academicData, cardProgram });
  };

  const updateAcademicData = (patch) => {
    const next = { ...academicData, ...patch };
    setAcademicData(next);
    saveCardDesign(cardCmuNumber, { ...cardDesign, ...next, cardProgram });
  };

  const updateCardProgram = (program) => {
    setCardProgram(program);
    const accent = CARD_PROGRAMS[program].accent;
    const nextDesign = { ...cardDesign, accentColor: accent, borderColor: accent };
    setCardDesign(nextDesign);
    saveCardDesign(cardCmuNumber, { ...nextDesign, ...academicData, cardProgram: program });
  };

  // Parrainage par défaut : les cartes CMU-Élèves / CMU-Daara sont parrainées
  // par la Mairie de Dakar (logo officiel) tant qu'aucun autre parrain n'est
  // explicitement attribué à la carte.
  const isSchoolCard = cardProgram !== 'CLASSIC';
  // Logo personnalisé par carte (fonctionne même sans parrain enregistré)
  const [cardLogo, setCardLogoState] = useState(() => getCardLogo(cardCmuNumber));
  useEffect(() => {
    setCardLogoState(getCardLogo(cardCmuNumber));
  }, [cardCmuNumber]);
  const effectiveSponsorLogo = currentSponsorLogo || cardLogo || (isSchoolCard ? '/logo_mairie_dakar.png' : null);
  // Tuteur (élève / talibé) : champ dédié du dossier, repli sur le parrain.
  const tuteurName = (editForm.tuteurName || currentMember.tuteurName) || null;
  const tuteurPhone = (editForm.tuteurPhone || currentMember.tuteurPhone) || null;

  // Données complètes calculées
  const cardData = currentMajorDependent ? {
    isPrincipal: false,
    firstName: currentMajorDependent.name.split(' ')[0] || currentMajorDependent.name,
    lastName: currentMajorDependent.name.split(' ').slice(1).join(' ') || '',
    fullName: currentMajorDependent.name,
    cmuNumber: `${(editForm.cmuNumber || currentMember.cmuNumber).replace(/\.0$/, '')}${currentMajorDependent.codeSuffix}`,
    birthDate: currentMajorDependent.birthDate,
    birthPlace: currentMajorDependent.birthPlace || editForm.birthPlace || 'Dakar',
    gender: currentMajorDependent.gender,
    bloodGroup: editForm.bloodGroup || currentMember.bloodGroup,
    address: editForm.address || currentMember.address,
    mutuelleOrigine: editForm.mutuelleOrigine || currentMember.mutuelleOrigine,
    sponsorName: tuteurName || `${editForm.firstName || currentMember.firstName} ${editForm.lastName || currentMember.lastName}`,
    sponsorCmu: editForm.cmuNumber || currentMember.cmuNumber,
    sponsorPhone: currentSponsorPhone,
    sponsorLogo: effectiveSponsorLogo,
    phone: getValidPhone(currentMajorDependent.phone, editForm.phone || currentMember.phone, '77 631 71 73'),
    package: editForm.package || currentMember.package,
    cardTypeLabel: editForm.cardTypeLabel || currentMember.cardTypeLabel,
    photoUrl: currentMajorDependent.photoUrl || '',
    minorDependents: [],
    unionName: currentUnion.name,
    unionCode: currentUnion.id,
    cardProgram,
    academicData,
    cardDesign
  } : {
    isPrincipal: true,
    firstName: editForm.firstName || currentMember.firstName,
    lastName: editForm.lastName || currentMember.lastName,
    fullName: `${editForm.firstName || currentMember.firstName} ${editForm.lastName || currentMember.lastName}`,
    cmuNumber: editForm.cmuNumber || currentMember.cmuNumber,
    birthDate: editForm.birthDate || currentMember.birthDate,
    birthPlace: editForm.birthPlace || currentMember.birthPlace,
    gender: editForm.gender || currentMember.gender,
    bloodGroup: editForm.bloodGroup || currentMember.bloodGroup,
    address: editForm.address || currentMember.address,
    mutuelleOrigine: editForm.mutuelleOrigine || currentMember.mutuelleOrigine,
    sponsorName: tuteurName || (isSchoolCard ? 'Mairie de Dakar' : null),
    sponsorCmu: null,
    sponsorPhone: currentSponsorPhone,
    sponsorLogo: effectiveSponsorLogo,
    tuteurName,
    tuteurPhone,
    phone: getValidPhone(editForm.phone, currentMember.phone, '77 631 71 73'),
    package: editForm.package || currentMember.package,
    cardTypeLabel: editForm.cardTypeLabel || currentMember.cardTypeLabel,
    photoUrl: editForm.photoUrl || currentMember.photoUrl,
    minorDependents: currentMember.dependents.filter(d => !d.isMajor),
    unionName: currentUnion.name,
    unionCode: currentUnion.id,
    msdContacts,
    cardProgram,
    academicData,
    cardDesign
  };

  // Encodage dynamique du QR Code scannable à 100% (Supporte l'URL courante, HTTPS/Public, IP Local Wi-Fi et Code Brut)
  useEffect(() => {
    const currentPort = (typeof window !== 'undefined' && window.location.port) ? window.location.port : '5173';
    let effectiveIp = customWifiIp || (typeof window !== 'undefined' ? localStorage.getItem('cmu-wifi-ip') : null) || getCachedLanIp() || '192.168.1.42';
    if (effectiveIp === '192.168.1.3' || effectiveIp === '192.168.1.5' || effectiveIp === '192.168.1.13' || effectiveIp === '192.168.1.64') {
      effectiveIp = '192.168.1.42';
    }
    let origin = window.location.origin;

    // Si le PC navigue sur localhost/127.0.0.1, utiliser l'IP IPv4 réelle du PC (192.168.1.42)
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      origin = `http://${effectiveIp}:${currentPort}`;
    }

    // Le QR porte TOUJOURS l'année scolaire et la classe : ces deux données
    // changent chaque année et doivent rester lisibles par un agent (contrôle
    // de scolarité) même si la page web est inaccessible.
    const academicQrData = new URLSearchParams({
      otp: String(studioOtp),
      cardProgram: cardData.cardProgram,
      academicYear: cardData.academicData.academicYear || '',
      classLevel: cardData.academicData.classLevel || '',
      schoolName: cardData.academicData.schoolName || ''
    });
    if (cardData.academicData.ine) academicQrData.set('ine', cardData.academicData.ine);
    // IA / IEF : circuit de l'école publique uniquement (absent sur CMU-Daara).
    if (resolveCardProgram(cardData.cardProgram).showIef) {
      academicQrData.set('ia', cardData.academicData.ia || '');
      academicQrData.set('ief', cardData.academicData.ief || '');
    }
    let verifyUrl = `${origin}/#/verify/${cardData.cmuNumber}?${academicQrData.toString()}`;

    if (qrTargetMode === 'HTTPS') {
      const publicBase = (customPublicUrl || (typeof window !== 'undefined' ? localStorage.getItem('cmu-public-url') : '') || 'https://mutualis.sn').replace(/\/$/, '');
      verifyUrl = `${publicBase}/#/verify/${cardData.cmuNumber}?${academicQrData.toString()}`;
    } else if (qrTargetMode === 'WIFI_IP') {
      if (customWifiIp) localStorage.setItem('cmu-wifi-ip', customWifiIp);
      verifyUrl = `http://${effectiveIp}:${currentPort}/#/verify/${cardData.cmuNumber}?${academicQrData.toString()}`;
    } else if (qrTargetMode === 'RAW_CODE') {
      verifyUrl = cardData.cmuNumber;
    }

    const payloadObj = {
      title: 'Carte CSU numérique sécurisée',
      cmuNumber: cardData.cmuNumber,
      fullName: cardData.fullName,
      firstName: cardData.firstName,
      lastName: cardData.lastName,
      birthDate: cardData.birthDate,
      birthPlace: cardData.birthPlace,
      bloodGroup: cardData.bloodGroup,
      address: cardData.address,
      phone: cardData.phone,
      unionDepartementale: cardData.unionName,
      mutuelleOrigine: cardData.mutuelleOrigine,
      package: cardData.package,
      status: 'ACTIF_80_PERCENT',
      sponsorCmu: cardData.sponsorCmu || 'N/A',
      sponsorName: cardData.sponsorName || currentSponsorName || 'N/A',
      cardProgram: cardData.cardProgram,
      academicYear: cardData.academicData.academicYear || 'N/A',
      classLevel: cardData.academicData.classLevel || 'N/A',
      schoolName: cardData.academicData.schoolName || 'N/A',
      // IA / IEF : seulement pour le circuit école publique.
      ...(resolveCardProgram(cardData.cardProgram).showIef
        ? {
          ia: cardData.academicData.ia || 'N/A',
          ief: cardData.academicData.ief || 'N/A'
        }
        : {}),
      ine: cardData.academicData.ine || 'N/A',
      minorDependents: cardData.minorDependents.map(d => ({
        code: `${cardData.cmuNumber.replace(/\.0$/, '')}${d.codeSuffix}`,
        name: d.name,
        birthDate: d.birthDate,
        birthPlace: d.birthPlace || 'Dakar'
      })),
      verifyUrl: verifyUrl,
      securityHash: `SHA256-${cardData.cmuNumber.replace(/[^A-Z0-9]/g, '')}-UNAMUSC-99120`
    };

    setQrCodePayload(payloadObj);

    // Générer l'image du QR Code avec NOIR PUR (#000000) et contraste ISO maximal
    QRCode.toDataURL(verifyUrl, {
      margin: 2,
      width: 480,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'H'
    })
      .then(url => setQrCodeDataUrl(url))
      .catch((err) => console.error('Erreur génération QR Code:', err));
  }, [
    cardData.cmuNumber,
    cardData.fullName,
    cardData.firstName,
    cardData.lastName,
    cardData.birthDate,
    cardData.birthPlace,
    cardData.bloodGroup,
    cardData.address,
    cardData.phone,
    cardData.unionName,
    cardData.unionCode,
    cardData.mutuelleOrigine,
    cardData.sponsorCmu,
    cardData.sponsorName,
    cardData.cardProgram,
    cardData.academicData,
    currentSponsorName,
    cardData.minorDependents,
    qrTargetMode,
    customWifiIp,
    studioOtp
  ]);

  const handleEditChange = (field, value) => {
    const updated = { ...editForm, [field]: value };
    setEditForm(updated);
    setMembers(prev => {
      const nextMembers = prev.map(m => m.id === selectedMemberId ? updated : m);
      saveStoredMembers(nextMembers);
      return nextMembers;
    });
  };

  // --- Import en masse : Excel MSD Dakar + appariement photos ---------------

  /** Normalisation identique à bulkImport.js (accents/espaces supprimés) */
  const norm = (v) => (v || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  /**
   * Importe le fichier Excel, apparie les photos (dossier sélectionné juste
   * avant ou à cette étape), ajoute les bénéficiaires au store local du studio
   * puis pousse le tout vers le backend (mode secours fichier si base off).
   */
  const handleBulkImport = async (excelFile) => {
    if (!excelFile) return;
    setBulkImporting(true);
    setBulkNotice({ type: 'info', text: '⏳ Lecture du fichier Excel en cours…' });
    try {
      const XLSX = await import('xlsx');
      const buffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (raw.length === 0) throw new Error('Aucune ligne trouvée dans le fichier.');

      // Lecture UNIQUE et normalisée : mêmes règles que src/utils/bulkImport.js.
      // → codes canoniques sans décimale parasite (« DKR_2600011.0 » devient
      //   « DKR_2600011 » : plus aucun doublon de carte ni collision de scan) ;
      // → dates de naissance sérielles Excel converties en AAAA-MM-JJ ;
      // → colonne « PHOTO » du classeur exploitée pour l'appariement.
      const { parseRowsToRecords } = await import('../utils/bulkImport');
      const records = parseRowsToRecords(raw);

      const photoFiles = Array.from(pendingPhotosRef.current || []).filter(f => f.type.startsWith('image/'));
      const photoIndex = photoFiles.map(f => {
        const base = f.name.replace(/\.[^.]+$/, '');
        return { file: f, nameNorm: norm(base), phoneNorm: (base || '').replace(/[^0-9]/g, '') };
      });
      const usedPhotos = new Set();
      const findPhoto = (r) => {
        const hint = norm(String(r.photoHint || '').replace(/\.[^.]+$/, ''));
        const fullName = norm(`${r.prenom || ''}${r.nom || ''}`);
        const first = norm(r.prenom || '');
        const phone = (r.telephone || '').toString().replace(/[^0-9]/g, '');
        const code = norm(r.codeBeneficiaire || '');
        return (hint && photoIndex.find(p => !usedPhotos.has(p.file.name) && p.nameNorm === hint))
          || photoIndex.find(p => !usedPhotos.has(p.file.name) && p.nameNorm === fullName)
          || photoIndex.find(p => !usedPhotos.has(p.file.name) && first && p.nameNorm === first)
          || photoIndex.find(p => !usedPhotos.has(p.file.name) && phone && p.phoneNorm === phone)
          || photoIndex.find(p => !usedPhotos.has(p.file.name) && code && p.nameNorm === code);
      };

      // Détection des membres du même ménage (NUMERO_ADHERENT partagé)
      const household = {};
      const members = [];
      for (const r of records) {
        if (!r.prenom && !r.nom) continue; // ligne vide
        r.sexe = r.sexe || 'M';

        // Photo appariée → lecture en data-URL (max 500 Ko compressés en 300px)
        const photo = findPhoto(r);
        let photoUrl = '';
        if (photo) {
          usedPhotos.add(photo.file.name);
          photoUrl = await new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = () => {
              img.onload = () => {
                const max = 300;
                const scale = Math.min(1, max / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
              };
              img.onerror = () => resolve('');
              img.src = reader.result;
            };
            reader.readAsDataURL(photo.file);
          });
        }

        const age = r.birthDate ? new Date().getFullYear() - parseInt(r.birthDate.slice(0, 4), 10) : 30;

        members.push({
          id: `IMP-${Date.now().toString(36)}-${members.length}`,
          cmuNumber: r.codeBeneficiaire || r.numeroAdherent,
          adherentCode: r.numeroAdherent || (r.codeBeneficiaire || '').replace(/\.\d+$/, ''),
          rawCode: r.codeBeneficiaire,
          firstName: (r.prenom || '').toUpperCase(),
          lastName: (r.nom || '').toUpperCase(),
          birthDate: r.birthDate || '',
          birthPlace: '',
          gender: r.sexe,
          bloodGroup: 'O+',
          address: r.address || 'Dakar',
          commune: 'Dakar',
          departmentUnionId: 'DKR',
          mutuelleOrigine: 'Mutuelle de santé départementale de Dakar',
          phone: r.telephone || '',
          package: 'UNAMUSC 80%',
          cardTypeLabel: 'Import Excel',
          photoUrl,
          hasOfficialPhoto: !!photoUrl,
          photoStatus: photoUrl ? 'OFFICIAL' : 'PENDING_UPLOAD',
          verificationStatus: 'IMPORT_EXCEL_MSD_DAKAR',
          allergies: 'Aucune connue',
          antecedents: 'À compléter',
          isMajor: age >= 18,
          dependents: []
        });

        // Regroupement par ménage : les membres partageant NUMERO_ADHERENT
        // deviennent ayant-droit du chef de ménage (lignes 1 = chef).
        if (r.numeroAdherent) {
          if (!household[r.numeroAdherent]) household[r.numeroAdherent] = [];
          household[r.numeroAdherent].push(members[members.length - 1]);
        }
      }

      // Les membres du même ménage au-delà du 1er deviennent dependents du chef
      const principals = [];
      for (const group of Object.values(household)) {
        const [chef, ...deps] = group;
        chef.dependents = deps.map((d, i) => ({
          ...d,
          isMajor: true,
          codeSuffix: `.${i + 1}`,
          bloodGroup: d.bloodGroup || 'O+',
          allergies: d.allergies || 'Aucune connue',
          vaccines: d.vaccines || 'Vaccination à jour',
          antecedents: d.antecedents || 'À compléter'
        }));
        principals.push(chef);
      }
      // Membres sans numéro d'adhérent → principaux individuels
      for (const m of members) {
        if (!household[m.adherentCode]) principals.push(m);
      }

      if (principals.length === 0) throw new Error('Aucun bénéficiaire exploitable trouvé dans le fichier.');

      // 1. Ajout au store local du studio (immédiatement imprimable)
      const existing = getStoredMembers();
      const existingCodes = new Set(existing.map(m => (m.cmuNumber || '').toString()));
      const fresh = principals.filter(m => !existingCodes.has((m.cmuNumber || '').toString()));
      const nextMembers = [...fresh, ...existing];
      saveStoredMembers(nextMembers);
      setMembers(nextMembers);

      // 2. Push backend (mode secours fichier automatique si base off)
      let serverInfo = '';
      try {
        const { apiFetch } = await import('../utils/api');
        const res = await apiFetch('/api/beneficiaries/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: fresh.map(m => ({
            codeBeneficiaire: m.cmuNumber,
            numeroAdherent: m.adherentCode,
            prenom: m.firstName,
            nom: m.lastName,
            birthDate: m.birthDate,
            sexe: m.gender,
            telephone: m.phone,
            address: m.address,
            schoolName: m.schoolName || null
          })) })
        });
        if (res.ok) {
          const data = await res.json();
          serverInfo = data.mode === 'fallback-file'
            ? ' · Base indisponible : conservés dans le fichier secours serveur (flush automatique à la reconnexion).'
            : ` · ${data.inserted} enregistrés en base de données.`;
        }
      } catch {
        serverInfo = ' · Backend injoignable : bénéficiaires conservés localement (store studio).';
      }

      setBulkNotice({
        type: 'success',
        text: `✅ ${fresh.length} bénéficiaires importés (${members.length} personnes au total, photos appariées : ${usedPhotos.size}).${serverInfo} Sélectionnez-les dans la liste ci-dessus pour générer leurs cartes.`
      });
      if (fresh.length > 0) setSelectedMemberId(fresh[0].id);
    } catch (err) {
      console.error('[BulkImport] Erreur :', err);
      setBulkNotice({ type: 'error', text: `❌ Import impossible : ${err.message}` });
    } finally {
      setBulkImporting(false);
      pendingPhotosRef.current = null;
      if (excelInputRef.current) excelInputRef.current.value = '';
      if (photosInputRef.current) photosInputRef.current.value = '';
    }
  };

  /** L'utilisateur choisit d'abord le dossier de photos (webkitdirectory) */
  const handlePhotosFolderPick = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      pendingPhotosRef.current = files;
      setBulkNotice({ type: 'info', text: `📁 ${files.length} fichiers de photos chargés — sélectionnez maintenant le fichier Excel à importer.` });
      if (excelInputRef.current) excelInputRef.current.click();
    }
  };

  // --- Personnalisation parrain / Mairie : actions du panneau dédié ---------

  // Attribuer (ou retirer avec une chaîne vide) un parrain à la carte affichée
  const handleAssignSponsor = (phone) => {
    assignSponsorToCard(cardCmuNumber, phone);
    setSponsorAssignments(prev => {
      const next = { ...prev };
      if (phone) next[cardCmuNumber] = phone;
      else delete next[cardCmuNumber];
      return next;
    });
    setSponsorNotice(
      phone
        ? { type: 'success', text: 'Parrain attribué à cette carte.' }
        : { type: 'success', text: 'Parrain retiré de cette carte.' }
    );
  };

  // Téléverser un logo (500 Ko max, image uniquement) :
  //  - si un parrain est sélectionné → logo du parrain (backend + cache local)
  //  - sinon → logo personnalisé de CETTE carte (cache local, toujours possible)
  const handleSponsorLogoFile = async (file) => {
    setSponsorLogoBusy(true);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      if (currentSponsorPhone) {
        const result = await saveSponsorLogo(currentSponsorPhone, dataUrl);
        setSponsors(prev => prev.map(s => (s.phone === currentSponsorPhone ? { ...s, sponsorLogo: result.sponsorLogo } : s)));
        // Le logo d'un parrain doit apparaître sur TOUTES les cartes qu'il
        // parraine : on le réplique ici, sans ouvrir chaque carte une à une.
        const logo = result.sponsorLogo || dataUrl;
        const spread = applySponsorLogoToAllCards(currentSponsorPhone, logo);
        if (spread > 0) setCardLogoState(logo);
        setSponsorNotice({
          type: result.warning ? 'warning' : 'success',
          text: result.warning
            ? `${result.warning} Le logo est néanmoins apposé sur ${spread || 1} carte(s).`
            : `✅ Logo du parrain enregistré et appliqué automatiquement à ses ${spread} carte(s) sans sélection individuelle.`
        });
      } else {
        setCardLogo(cardCmuNumber, dataUrl);
        setCardLogoState(dataUrl);
        setSponsorNotice({ type: 'success', text: 'Logo personnalisé apposé sur cette carte (stocké localement, disponible hors-ligne).' });
      }
    } catch (err) {
      setSponsorNotice({ type: 'error', text: err.message || 'Import du logo impossible.' });
    } finally {
      setSponsorLogoBusy(false);
      if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.value = '';
    }
  };

  // Nombre de cartes déjà parrainées par le parrain sélectionné — affiché
  // dans le panneau pour rendre visible la portée du logo.
  const sponsoredCardCount = currentSponsorPhone ? getCardsSponsoredBy(currentSponsorPhone).length : 0;

  // Supprimer le logo du parrain sélectionné
  const handleRemoveSponsorLogo = async () => {
    if (!currentSponsorPhone) return;
    setSponsorLogoBusy(true);
    try {
      await deleteSponsorLogo(currentSponsorPhone);
      setSponsors(prev => prev.map(s => (s.phone === currentSponsorPhone ? { ...s, sponsorLogo: null } : s)));
      setSponsorNotice({ type: 'success', text: 'Logo du parrain retiré de la carte.' });
    } finally {
      setSponsorLogoBusy(false);
    }
  };

  const handleAddMinorChild = () => {
    const newChild = {
      name: 'Nouvel Enfant',
      birthDate: '01/01/2020',
      birthPlace: editForm.birthPlace || 'Dakar',
      gender: 'M',
      isMajor: false,
      codeSuffix: `.M${(editForm.dependents ? editForm.dependents.filter(d => !d.isMajor).length : 0) + 1}`,
      photoUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80',
      bloodGroup: editForm.bloodGroup || 'O+',
      allergies: 'Aucune connue',
      vaccines: 'PEV 100% à jour',
      antecedents: 'Antécédents normaux'
    };
    const updatedDeps = [...(editForm.dependents || []), newChild];
    handleEditChange('dependents', updatedDeps);
  };

  const handleUpdateChildField = (childIndex, field, value) => {
    const minorIndices = [];
    (editForm.dependents || []).forEach((d, idx) => { if (!d.isMajor) minorIndices.push(idx); });
    const realIdx = minorIndices[childIndex];
    if (realIdx !== undefined) {
      const updatedDeps = [...(editForm.dependents || [])];
      updatedDeps[realIdx] = { ...updatedDeps[realIdx], [field]: value };
      handleEditChange('dependents', updatedDeps);
    }
  };

  // Gestionnaire de téléversement de fichier photo (Base64)
  const handlePhotoFileUpload = (e, callback) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          callback(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveChild = (childIndex) => {
    const minorIndices = [];
    (editForm.dependents || []).forEach((d, idx) => { if (!d.isMajor) minorIndices.push(idx); });
    const realIdx = minorIndices[childIndex];
    if (realIdx !== undefined) {
      const updatedDeps = (editForm.dependents || []).filter((_, idx) => idx !== realIdx);
      handleEditChange('dependents', updatedDeps);
    }
  };

  // Redirection directe vers la page de vérification (#/verify/:cmuNumber)
  const handleTestVerifyClick = () => {
    window.location.hash = `#/verify/${cardData.cmuNumber}`;
    if (setView) {
      setView('verify');
    }
  };

  // Téléchargement PNG Ultra-Haute Définition (600 DPI pour imprimante PVC Epson L8050)
  const handleDownloadPng = async (side = 'BOTH') => {
    if (!rectoRef.current || !versoRef.current) {
      alert('⚠️ Veuillez patienter pendant le chargement des aperçus recto et verso de la carte.');
      return;
    }
    setIsGeneratingPdf(true);

    try {
      const safeName = (cardData.fullName || 'adherent').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const cmuCode = cardData.cmuNumber || 'cni';

      if (side === 'RECTO' || side === 'BOTH') {
        const canvasRecto = await html2canvas(rectoRef.current, {
          scale: 5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          windowWidth: 1200
        });
        const linkRecto = document.createElement('a');
        linkRecto.download = `carte_csu_recto_${cmuCode}_${safeName}_600dpi.png`;
        linkRecto.href = canvasRecto.toDataURL('image/png', 1.0);
        linkRecto.click();
      }

      if (side === 'VERSO' || side === 'BOTH') {
        // Petit délai si téléchargement des deux pour éviter les blocages de téléchargement multiple
        if (side === 'BOTH') {
          await new Promise(resolve => setTimeout(resolve, 600));
        }

        const canvasVerso = await html2canvas(versoRef.current, {
          scale: 5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
          imageTimeout: 15000,
          windowWidth: 1200
        });
        const linkVerso = document.createElement('a');
        linkVerso.download = `carte_csu_verso_${cmuCode}_${safeName}_600dpi.png`;
        linkVerso.href = canvasVerso.toDataURL('image/png', 1.0);
        linkVerso.click();
      }
    } catch (err) {
      console.error('Erreur lors de la génération PNG HD:', err);
      alert('Erreur lors de la génération PNG : ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Exportation PDF HD (2 pages distinctes CNI 85.6mm x 53.98mm pour bac PVC Epson L8050)
  const handlePrintPdf = async (singleSide = null) => {
    if (!rectoRef.current || !versoRef.current) {
      alert('⚠️ Veuillez patienter pendant le chargement des aperçus recto et verso de la carte.');
      return;
    }
    setIsGeneratingPdf(true);

    try {
      // Capture haute résolution Recto
      const canvasRecto = await html2canvas(rectoRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        windowWidth: 1200
      });

      // Capture haute résolution Verso
      const canvasVerso = await html2canvas(versoRef.current, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
        windowWidth: 1200
      });

      const imgRecto = canvasRecto.toDataURL('image/png', 1.0);
      const imgVerso = canvasVerso.toDataURL('image/png', 1.0);
      const safeName = (cardData.fullName || 'adherent').toLowerCase().replace(/[^a-z0-9]/g, '_');
      const cmuCode = cardData.cmuNumber || 'cni';

      if (singleSide === 'RECTO') {
        const pdfRecto = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98], compress: true });
        pdfRecto.addImage(imgRecto, 'PNG', 0, 0, 85.6, 53.98, undefined, 'FAST');
        pdfRecto.save(`carte_csu_recto_${cmuCode}_${safeName}.pdf`);
      } else if (singleSide === 'VERSO') {
        const pdfVerso = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 53.98], compress: true });
        pdfVerso.addImage(imgVerso, 'PNG', 0, 0, 85.6, 53.98, undefined, 'FAST');
        pdfVerso.save(`carte_csu_verso_${cmuCode}_${safeName}.pdf`);
      } else {
        // Document PDF officiel 2 pages distinctes (Page 1 = Recto, Page 2 = Verso)
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [85.6, 53.98],
          compress: true
        });

        // Page 1: Recto officiel
        pdf.addImage(imgRecto, 'PNG', 0, 0, 85.6, 53.98, undefined, 'FAST');

        // Page 2: Verso officiel
        pdf.addPage([85.6, 53.98], 'landscape');
        pdf.addImage(imgVerso, 'PNG', 0, 0, 85.6, 53.98, undefined, 'FAST');

        pdf.save(`carte_csu_${cmuCode}_${safeName}_recto_verso.pdf`);
      }

    } catch (err) {
      console.error('Erreur lors de la génération de la carte PDF:', err);
      alert('Une erreur est survenue lors de la création du fichier PDF : ' + err.message);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="card-studio-view fade-in-up container-fluid py-4 px-3 px-md-4" style={{ maxWidth: '1440px', margin: '0 auto' }}>

      {/* Banner Super Admin */}
      <section className="banner-mini mb-5" style={{
        background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.96) 0%, rgba(4, 120, 87, 0.9) 100%), url("/bg_audit_stock.jpg") center/cover no-repeat',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        borderRadius: '26px',
        padding: '2.5rem 2.8rem',
        color: '#fff',
        boxShadow: '0 16px 45px rgba(0, 0, 0, 0.35)'
      }}>
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-4" style={{ position: 'relative', zIndex: 2 }}>
          <div>
            <div className="d-flex align-items-center gap-2.5 mb-3 flex-wrap">
              <span className="badge" style={{ backgroundColor: '#064e3b', color: '#ffffff', border: '1px solid #10b981', padding: '0.5rem 1.2rem', fontSize: '0.86rem', fontWeight: '800', borderRadius: '20px' }}>
                🪪 Studio national de conception des cartes UNAMUSC / SEN-CSU
              </span>
              <span className="badge fw-extrabold px-3.5 py-2" style={{ borderRadius: '20px', fontSize: '0.82rem', backgroundColor: '#78350f', color: '#fef3c7', border: '1px solid #f59e0b' }}>
                👑 Restreint super admin
              </span>
              <span className="badge fw-extrabold px-3.5 py-2" style={{ borderRadius: '20px', fontSize: '0.82rem', backgroundColor: '#0369a1', color: '#e0f2fe', border: '1px solid #38bdf8' }}>
                🖨️ Calibré PVC Epson L8050
              </span>
            </div>
            <h2 style={{ fontSize: '2.2rem', color: '#fff', marginBottom: '0.5rem', fontWeight: '900', textShadow: '0 3px 6px rgba(0,0,0,0.5)', letterSpacing: '-0.02em' }}>
              Conception des cartes UNAMUSC (format CNI 85.6mm × 53.98mm)
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '1rem', maxWidth: '880px', lineHeight: '1.55', textShadow: '0 1px 3px rgba(0,0,0,0.4)', marginBottom: 0 }}>
              Design épuré et lisse sans aucun trait parasite. QR code 100% centré au verso et entièrement scannable via Wi-Fi ou HTTPS officiel.
            </p>
          </div>

          <div className="d-flex align-items-center gap-3 flex-wrap">
            <button
              type="button"
              className="btn fw-extrabold px-4 py-3 d-flex align-items-center gap-2 shadow-sm hover-lift"
              style={{ borderRadius: '16px', fontSize: '0.92rem', background: '#0f172a', color: '#ffffff', border: '1.5px solid #10b981', minHeight: '48px' }}
              onClick={handleTestVerifyClick}
            >
              <span>📲</span> Tester la vérification (#/verify)
            </button>

            {/* Téléchargement PNG HD (Recto & Verso) */}
            <button
              type="button"
              className="btn fw-extrabold px-4 py-3 shadow-lg hover-lift d-flex align-items-center gap-2"
              style={{ borderRadius: '16px', fontSize: '0.94rem', cursor: 'pointer', background: '#0284c7', color: '#ffffff', border: 'none', minHeight: '48px' }}
              onClick={() => handleDownloadPng('BOTH')}
              disabled={isGeneratingPdf}
              title="Télécharger les fichiers PNG 600 DPI pour le bac d'impression PVC Epson L8050"
            >
              {isGeneratingPdf ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Génération PNG HD...
                </>
              ) : (
                <>
                  🖼️ Télécharger Recto & Verso (PNG HD)
                </>
              )}
            </button>

            {/* Téléchargement PDF 2 pages CNI */}
            <button
              type="button"
              className="btn fw-extrabold px-4 py-3 shadow-lg hover-lift d-flex align-items-center gap-2"
              style={{ borderRadius: '16px', fontSize: '0.94rem', cursor: 'pointer', background: '#d97706', color: '#ffffff', border: 'none', minHeight: '48px' }}
              onClick={() => handlePrintPdf(null)}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Génération PDF HD...
                </>
              ) : (
                <>
                  🖨️ Imprimer la carte officielle PDF (2 pages)
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 0. SECTION IMPORT EN MASSE (EXCEL MSD DAKAR + PHOTOS APPARIÉES) */}
      <div className="card p-4 p-md-5 rounded-4 mb-5 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-3">
          <div>
            <h5 className="fw-extrabold mb-1 text-success d-flex align-items-center gap-2.5" style={{ fontSize: '1.25rem' }}>
              <span>📥</span> 0. Import en masse — création de cartes à partir d'un fichier Excel
            </h5>
            <p className="text-sub small mb-0" style={{ fontSize: '0.88rem' }}>
              Chargez le fichier MSD Dakar (ex : <strong>Ville de Dakar msd Dakar.xlsx</strong>) puis le dossier de photos.
              Les photos sont appariées automatiquement par <strong>nom, code bénéficiaire ou téléphone</strong>.
              Chaque ménage (même NUMERO_ADHERENT) est regroupé : le chef reçoit les ayants droit.
            </p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <input
              ref={photosInputRef}
              type="file"
              multiple
              accept="image/*"
              className="d-none"
              onChange={handlePhotosFolderPick}
            />
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="d-none"
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handleBulkImport(f); }}
            />
            <button
              type="button"
              className="btn fw-extrabold px-4 py-3 hover-lift d-flex align-items-center gap-2"
              style={{ borderRadius: '14px', fontSize: '0.88rem', background: '#0369a1', color: '#fff', border: '1.5px solid #38bdf8', minHeight: '48px' }}
              disabled={bulkImporting}
              onClick={() => { if (photosInputRef.current) photosInputRef.current.click(); }}
            >
              🗂️ 1️⃣ Dossier de photos…
            </button>
            <button
              type="button"
              className="btn fw-extrabold px-4 py-3 hover-lift d-flex align-items-center gap-2"
              style={{ borderRadius: '14px', fontSize: '0.88rem', background: bulkImporting ? '#94a3b8' : '#059669', color: '#fff', border: '1.5px solid #10b981', minHeight: '48px' }}
              disabled={bulkImporting}
              onClick={() => { if (excelInputRef.current) excelInputRef.current.click(); }}
            >
              {bulkImporting ? (
                <><span className="spinner-border spinner-border-sm" role="status"></span> Import en cours…</>
              ) : (
                <>📊 2️⃣ Importer le fichier Excel…</>
              )}
            </button>
          </div>
        </div>

        {bulkNotice && (
          <div
            className="alert mb-0 rounded-4 border-0 py-3 px-3.5"
            style={{
              fontSize: '0.86rem',
              fontWeight: '700',
              background: bulkNotice.type === 'error' ? 'rgba(220,38,38,0.12)' : bulkNotice.type === 'success' ? 'rgba(5,150,105,0.12)' : 'rgba(2,132,199,0.1)',
              color: bulkNotice.type === 'error' ? '#b91c1c' : bulkNotice.type === 'success' ? '#047857' : '#0369a1',
              lineHeight: 1.5
            }}
          >
            {bulkNotice.text}
          </div>
        )}

        <small className="text-muted d-block mt-2" style={{ fontSize: '0.76rem' }}>
          💾 Zéro perte : les bénéficiaires importés sont enregistrés dans le store du studio ET poussés vers le backend.
          Si PostgreSQL est indisponible, le serveur les conserve dans son fichier secours
          (<code>backend/data/store.json</code>) et les rejoue automatiquement à la reconnexion de la base.
        </small>
      </div>

      {/* 1. SECTION SÉLECTION DU DOSSIER & CARTE À ÉDITER */}
      <div className="studio-grid-2">
        {/* Sélecteur de l'Adhérent Principal */}
        <div>
          <div className="card p-4 p-md-5 rounded-4 h-100 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
              <h5 className="fw-extrabold mb-0 text-success d-flex align-items-center gap-2.5" style={{ fontSize: '1.25rem' }}>
                <span>👤</span> 1. Dossier adhérent principal
              </h5>
              <button
                type="button"
                className="btn btn-sm text-white fw-extrabold px-3.5 py-2 shadow-sm hover-lift"
                style={{ borderRadius: '12px', fontSize: '0.82rem', background: '#059669', border: '1.5px solid #10b981' }}
                onClick={() => {
                  const fresh = resetToDefaultMembers();
                  setMembers(fresh);
                  if (fresh.length > 0) setSelectedMemberId(fresh[0].id);
                }}
              >
                🔄 Recharger les 36 assurés
              </button>
            </div>

            <div className="studio-form-group mb-4">
              <label className="form-label text-sub fw-extrabold" style={{ fontSize: '0.9rem' }}>
                🏛️ Sélectionner l'adhérent MSD Dakar ({members.length} familles au total) :
              </label>
              <select
                className="form-select py-3 px-3.5 fw-extrabold"
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '16px', fontSize: '0.95rem', minHeight: '52px' }}
                value={selectedMemberId}
                onChange={(e) => {
                  setSelectedMemberId(e.target.value);
                  setSelectedCardType('PRINCIPAL');
                }}
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} ({m.cmuNumber}) — {m.mutuelleOrigine}
                  </option>
                ))}
              </select>
            </div>

            {/* Cible du QR Code pour test scan mobile Wi-Fi */}
            <div className="p-4 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '20px' }}>
              <label className="form-label text-sub fw-extrabold mb-3.5 d-block" style={{ fontSize: '0.88rem' }}>
                📡 Mode de destination du QR code :
              </label>

              <div className="d-flex flex-wrap gap-3.5 mb-4">
                <button
                  type="button"
                  className="btn btn-sm fw-extrabold px-4 py-2.5 shadow-sm hover-lift"
                  style={{
                    borderRadius: '14px',
                    fontSize: '0.86rem',
                    minHeight: '48px',
                    background: qrTargetMode === 'HTTPS' ? '#059669' : 'var(--bg-card)',
                    color: qrTargetMode === 'HTTPS' ? '#ffffff' : 'var(--text-main)',
                    border: qrTargetMode === 'HTTPS' ? '1.5px solid #10b981' : '1.5px solid var(--border-color)'
                  }}
                  onClick={() => setQrTargetMode('HTTPS')}
                >
                  🌐 URL web (https://mutualis.sn)
                </button>

                <button
                  type="button"
                  className="btn btn-sm fw-extrabold px-4 py-2.5 shadow-sm hover-lift"
                  style={{
                    borderRadius: '14px',
                    fontSize: '0.86rem',
                    minHeight: '48px',
                    background: qrTargetMode === 'WIFI_IP' ? '#059669' : 'var(--bg-card)',
                    color: qrTargetMode === 'WIFI_IP' ? '#ffffff' : 'var(--text-main)',
                    border: qrTargetMode === 'WIFI_IP' ? '1.5px solid #10b981' : '1.5px solid var(--border-color)'
                  }}
                  onClick={() => setQrTargetMode('WIFI_IP')}
                >
                  📶 IP Wi-Fi PC (192.168.x.x)
                </button>

                <button
                  type="button"
                  className="btn btn-sm fw-extrabold px-4 py-2.5 shadow-sm hover-lift"
                  style={{
                    borderRadius: '14px',
                    fontSize: '0.86rem',
                    minHeight: '48px',
                    background: qrTargetMode === 'RAW_CODE' ? '#059669' : 'var(--bg-card)',
                    color: qrTargetMode === 'RAW_CODE' ? '#ffffff' : 'var(--text-main)',
                    border: qrTargetMode === 'RAW_CODE' ? '1.5px solid #10b981' : '1.5px solid var(--border-color)'
                  }}
                  onClick={() => setQrTargetMode('RAW_CODE')}
                >
                  📋 Code brut ({cardData.cmuNumber})
                </button>
              </div>

              {qrTargetMode === 'HTTPS' && (
                <div className="mt-3.5 pt-1">
                  <label className="form-label text-sub fw-bold mb-2.5 d-block" style={{ fontSize: '0.82rem' }}>
                    🌐 URL Publique / Tunnel / En Ligne (Accessible depuis TOUT Wi-Fi & 4G/5G) :
                  </label>
                  <div className="d-flex gap-2.5 mb-2 flex-wrap">
                    <input
                      type="text"
                      className="form-control fw-mono fw-bold py-2.5 px-3 flex-grow-1"
                      placeholder="https://mutualis.sn ou https://votre-tunnel.loca.lt"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', minHeight: '46px', minWidth: '220px' }}
                      value={customPublicUrl}
                      onChange={(e) => {
                        setCustomPublicUrl(e.target.value);
                        localStorage.setItem('cmu-public-url', e.target.value);
                      }}
                    />
                  </div>
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.76rem' }}>
                    🚀 <strong>Accès Universel</strong> : Ce mode encode une URL accessible depuis <strong>n'importe quel smartphone, sur n'importe quel réseau Wi-Fi ou connexion mobile 4G/5G</strong> dans le monde !
                  </small>
                </div>
              )}

              {qrTargetMode === 'WIFI_IP' && (
                <div className="mt-3.5 pt-1">
                  <label className="form-label text-sub fw-bold mb-2.5 d-block" style={{ fontSize: '0.82rem' }}>
                    📶 Adresse IP Wi-Fi locale de votre PC ({customWifiIp || '192.168.1.42'}) :
                  </label>
                  <div className="d-flex gap-2.5 mb-2 flex-wrap">
                    <input
                      type="text"
                      className="form-control fw-mono fw-bold py-2.5 px-3 flex-grow-1"
                      placeholder="ex: 192.168.1.42"
                      style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', minHeight: '46px', minWidth: '180px' }}
                      value={customWifiIp}
                      onChange={(e) => {
                        setCustomWifiIp(e.target.value);
                        localStorage.setItem('cmu-wifi-ip', e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary fw-bold px-3.5 py-2.5 hover-lift"
                      style={{ borderRadius: '12px', fontSize: '0.82rem', minHeight: '46px' }}
                      onClick={() => {
                        detectLanIp().then((ip) => {
                          const detected = ip || '192.168.1.42';
                          setCustomWifiIp(detected);
                          localStorage.setItem('cmu-wifi-ip', detected);
                        });
                      }}
                    >
                      ⚡ Actualiser IP
                    </button>
                  </div>
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.76rem' }}>
                    💡 Votre smartphone ouvrira directement <code>http://{customWifiIp || '192.168.1.42'}:{typeof window !== 'undefined' && window.location.port ? window.location.port : '5173'}/#/verify/{cardData.cmuNumber}</code> lorsqu'il est connecté au même réseau Wi-Fi !
                  </small>
                </div>
              )}

              <div className="alert alert-warning p-3.5 mt-3.5 mb-0 rounded-4 border-0" style={{ fontSize: '0.82rem', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', lineHeight: '1.55' }}>
                <strong>💡 Pour scanner sur Wi-Fi local :</strong>
                <div className="mt-1">
                  Vérifiez que votre PC et votre smartphone sont sur le même réseau Wi-Fi avec l'IP <strong>{customWifiIp || '192.168.1.42'}</strong>. Pour scanner depuis <strong>n'importe quel réseau Wi-Fi ou en 4G/5G</strong>, utilisez le mode <strong>🌐 URL web / Tunnel</strong> ci-dessus !
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Choix de la Carte Individuelle à Générer (Titulaire vs Ayants Droit Majeurs) */}
        <div>
          <div className="card p-4 p-md-5 rounded-4 h-100 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
            <h5 className="fw-extrabold mb-3 text-emerald d-flex align-items-center gap-2.5" style={{ fontSize: '1.25rem' }}>
              <span>🪪</span> 2. Sélectionner la carte individuelle à générer
            </h5>
            <p className="text-sub small mb-4" style={{ fontSize: '0.88rem' }}>
              Chaque adulte bénéficie d'une carte plastique CNI 85.6mm × 53.98mm avec photo et QR code individuel :
            </p>

            <div className="d-flex flex-column gap-3.5">
              {/* Carte Titulaire */}
              <button
                type="button"
                className="btn text-start p-4 fw-extrabold d-flex align-items-center justify-content-between hover-lift"
                style={{
                  borderRadius: '20px',
                  fontSize: '0.96rem',
                  minHeight: '76px',
                  background: selectedCardType === 'PRINCIPAL' ? '#059669' : 'var(--bg-card-subtle)',
                  color: selectedCardType === 'PRINCIPAL' ? '#ffffff' : 'var(--text-main)',
                  border: selectedCardType === 'PRINCIPAL' ? '2.5px solid #10b981' : '1.5px solid var(--border-color)',
                  boxShadow: selectedCardType === 'PRINCIPAL' ? '0 8px 24px rgba(5,150,105,0.35)' : 'none'
                }}
                onClick={() => setSelectedCardType('PRINCIPAL')}
              >
                <div className="d-flex align-items-center gap-3">
                  <span style={{ fontSize: '1.4rem' }}>🪪</span>
                  <div>
                    <div className="fw-black" style={{ fontSize: '1.02rem' }}>
                      Carte titulaire principal ({currentMember.firstName} {currentMember.lastName})
                    </div>
                    <small style={{ opacity: 0.85, fontSize: '0.82rem' }}>
                      Adulte responsable • {currentMember.mutuelleOrigine}
                    </small>
                  </div>
                </div>
                <span className="badge fw-extrabold px-3.5 py-2 font-monospace" style={{ background: '#064e3b', color: '#ffffff', border: '1px solid #10b981', borderRadius: '12px', fontSize: '0.88rem' }}>
                  {currentMember.cmuNumber}
                </span>
              </button>

              {/* Cartes Ayants Droit Majeurs */}
              {currentMember.dependents.filter(d => d.isMajor).map((dep, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="btn text-start p-4 fw-extrabold d-flex align-items-center justify-content-between hover-lift"
                  style={{
                    borderRadius: '20px',
                    fontSize: '0.96rem',
                    minHeight: '76px',
                    background: selectedCardType === `MAJOR_${idx}` ? '#059669' : 'var(--bg-card-subtle)',
                    color: selectedCardType === `MAJOR_${idx}` ? '#ffffff' : 'var(--text-main)',
                    border: selectedCardType === `MAJOR_${idx}` ? '2.5px solid #10b981' : '1.5px solid var(--border-color)',
                    boxShadow: selectedCardType === `MAJOR_${idx}` ? '0 8px 24px rgba(5,150,105,0.35)' : 'none'
                  }}
                  onClick={() => setSelectedCardType(`MAJOR_${idx}`)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <span style={{ fontSize: '1.4rem' }}>👤</span>
                    <div>
                      <div className="fw-black" style={{ fontSize: '1.02rem' }}>
                        Carte ayant droit majeur ({dep.name})
                      </div>
                      <small style={{ opacity: 0.85, fontSize: '0.82rem' }}>
                        Adulte à charge (≥ 18 ans) • Rattaché à {currentMember.firstName}
                      </small>
                    </div>
                  </div>
                  <span className="badge fw-extrabold px-3.5 py-2 font-monospace" style={{ background: '#064e3b', color: '#ffffff', border: '1px solid #10b981', borderRadius: '12px', fontSize: '0.88rem' }}>
                    {currentMember.cmuNumber.replace(/\.0$/, '')}{dep.codeSuffix}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SECTION ÉDITION DES PARAMÈTRES & PHOTOS DES BÉNÉFICIAIRES */}
      <div className="studio-grid-2">
        {/* Photo et Identité Titulaire */}
        <div>
          <div className="card p-4 p-md-5 rounded-4 h-100 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h5 className="fw-extrabold mb-0 text-emerald d-flex align-items-center gap-2.5" style={{ fontSize: '1.2rem' }}>
                <span>📸</span> Photo & identité de l'assuré
              </h5>
              <span className="badge bg-success-subtle text-success fw-bold px-3 py-1.5" style={{ fontSize: '0.82rem', borderRadius: '10px' }}>
                Adulte adhérent
              </span>
            </div>

            {/* Cadre Photo & Upload */}
            <div className="d-flex align-items-center gap-4 mb-4 p-4 rounded-4 bg-body border" style={{ borderColor: 'var(--border-color)', borderRadius: '20px' }}>
              {editForm.photoUrl || cardData.photoUrl ? (
                <img
                  src={editForm.photoUrl || cardData.photoUrl}
                  alt="Photo Adhérent"
                  style={{ width: '76px', height: '76px', borderRadius: '50%', objectFit: 'cover', border: '3.5px solid #10b981', boxShadow: '0 6px 18px rgba(16,185,129,0.25)', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'var(--bg-card-subtle)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', color: 'var(--text-sub)', flexShrink: 0 }}>
                  👤
                </div>
              )}
              <div className="flex-grow-1">
                <label className="form-label text-sub fw-bold mb-2.5 d-block" style={{ fontSize: '0.84rem' }}>
                  Téléverser une photo d'identité (fichier local ou URL) :
                </label>
                <div className="d-flex gap-3 align-items-center flex-wrap">
                  <label className="btn text-white fw-extrabold px-3.5 py-2.5 shadow-sm hover-lift" style={{ borderRadius: '14px', cursor: 'pointer', fontSize: '0.86rem', background: '#059669', border: '1.5px solid #10b981', minHeight: '46px', display: 'inline-flex', alignItems: 'center' }}>
                    📁 Importer une photo...
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handlePhotoFileUpload(e, (dataUrl) => handleEditChange('photoUrl', dataUrl))}
                    />
                  </label>
                  <input
                    type="text"
                    className="form-control fw-bold flex-grow-1 py-2.5 px-3"
                    placeholder="Ou collez l'URL de la photo..."
                    style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '14px', fontSize: '0.86rem', minHeight: '46px', minWidth: '180px' }}
                    value={editForm.photoUrl || ''}
                    onChange={(e) => handleEditChange('photoUrl', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Champs Prénom, Nom, Né le, Lieu */}
            <div className="studio-form-grid-2">
              <div className="studio-form-group">
                <label>Prénom :</label>
                <input
                  type="text"
                  className="form-control fw-bold"
                  value={editForm.firstName || ''}
                  onChange={(e) => handleEditChange('firstName', e.target.value)}
                />
              </div>

              <div className="studio-form-group">
                <label>Nom :</label>
                <input
                  type="text"
                  className="form-control fw-bold"
                  value={editForm.lastName || ''}
                  onChange={(e) => handleEditChange('lastName', e.target.value)}
                />
              </div>

              <div className="studio-form-group">
                <label>
                  <span>Né(e) le :</span>
                  {editForm.birthDate && (
                    <span className="badge bg-emerald text-white fw-extrabold" style={{ fontSize: '0.76rem' }}>
                      🎂 {getAgeLabel(editForm.birthDate)}
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  className="form-control fw-bold"
                  placeholder="JJ/MM/AAAA"
                  value={editForm.birthDate || ''}
                  onChange={(e) => handleEditChange('birthDate', e.target.value)}
                />
              </div>

              <div className="studio-form-group">
                <label>Lieu de naissance :</label>
                <input
                  type="text"
                  className="form-control fw-bold"
                  placeholder="ex: Dakar Plateau"
                  value={editForm.birthPlace || ''}
                  onChange={(e) => handleEditChange('birthPlace', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Couverture & Santé Titulaire */}
        <div>
          <div className="card p-4 p-md-5 rounded-4 h-100 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
            <h5 className="fw-extrabold mb-4 text-emerald d-flex align-items-center gap-2.5" style={{ fontSize: '1.2rem' }}>
              <span>🏥</span> Couverture & paramètres santé
            </h5>

            <div className="studio-form-grid-2">
              <div className="studio-form-group">
                <label>Union départementale :</label>
                <select
                  className="form-select fw-bold"
                  value={editForm.departmentUnionId || 'DKR'}
                  onChange={(e) => handleEditChange('departmentUnionId', e.target.value)}
                >
                  {departmentalUnions.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div className="studio-form-group">
                <label>Mutuelle d'origine :</label>
                <input
                  type="text"
                  className="form-control fw-bold"
                  value={editForm.mutuelleOrigine || ''}
                  onChange={(e) => handleEditChange('mutuelleOrigine', e.target.value)}
                />
              </div>

              <div className="studio-form-group">
                <label>🩸 Groupe sanguin :</label>
                <select
                  className="form-select fw-bold"
                  value={editForm.bloodGroup || 'O+'}
                  onChange={(e) => handleEditChange('bloodGroup', e.target.value)}
                >
                  <option value="O+">O Rh+ (O+)</option>
                  <option value="O-">O Rh- (O-)</option>
                  <option value="A+">A Rh+ (A+)</option>
                  <option value="A-">A Rh- (A-)</option>
                  <option value="B+">B Rh+ (B+)</option>
                  <option value="B-">B Rh- (B-)</option>
                  <option value="AB+">AB Rh+ (AB+)</option>
                  <option value="AB-">AB Rh- (AB-)</option>
                </select>
              </div>

              <div className="studio-form-group">
                <label>N° CSU / Matricule :</label>
                <input
                  type="text"
                  className="form-control fw-bold font-monospace"
                  value={editForm.cmuNumber || ''}
                  onChange={(e) => handleEditChange('cmuNumber', e.target.value)}
                />
              </div>
            </div>

            <div className="studio-form-group">
              <label>Téléphone adhérent :</label>
              <input
                type="text"
                className="form-control fw-bold"
                placeholder="ex: 77 000 00 00"
                value={editForm.phone || ''}
                onChange={(e) => handleEditChange('phone', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2.b PROGRAMME DE CARTE ET DONNÉES SCOLAIRES */}
      <div className="card p-4 p-md-5 rounded-4 mb-5 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
        <div className="mb-4">
          <h5 className="fw-extrabold mb-1 text-emerald d-flex align-items-center gap-2.5" style={{ fontSize: '1.3rem' }}><span>🪪</span> Type et données de la carte</h5>
          <p className="text-sub small mb-0">Choisissez le gabarit à générer. Les données annuelles sont sauvegardées pour cette carte et encodées dans le QR code.</p>
        </div>
        <div className="d-flex flex-wrap gap-3 mb-4">
          {Object.entries(CARD_PROGRAMS).map(([key, program]) => <button key={key} type="button" className="btn fw-extrabold px-4 py-3" onClick={() => updateCardProgram(key)} style={{ borderRadius: '14px', background: cardProgram === key ? program.accent : 'var(--bg-card-subtle)', color: cardProgram === key ? '#fff' : 'var(--text-main)', border: `2px solid ${cardProgram === key ? program.accent : 'var(--border-color)'}` }}>{key === 'CLASSIC' ? '🩺' : key === 'CMU_ELEVES' ? '🎓' : '📖'} {program.label}</button>)}
        </div>
        {cardProgram !== 'CLASSIC' && <div className="studio-form-grid-3 mb-0">
          <div className="studio-form-group"><label>Année scolaire *</label><input className="form-control fw-bold" value={academicData.academicYear} onChange={(e) => updateAcademicData({ academicYear: e.target.value })} placeholder="2026-2027" /></div>
          <div className="studio-form-group"><label>Classe / niveau *</label><input className="form-control fw-bold" value={academicData.classLevel} onChange={(e) => updateAcademicData({ classLevel: e.target.value })} placeholder={cardProgram === 'CMU_DAARA' ? 'Niveau 2 (Coran)' : '3ème'} /></div>
          <div className="studio-form-group"><label>{cardProgram === 'CMU_DAARA' ? 'Daara' : 'Établissement'} *</label><input className="form-control fw-bold" value={academicData.schoolName} onChange={(e) => updateAcademicData({ schoolName: e.target.value })} placeholder={cardProgram === 'CMU_DAARA' ? 'Daara Serigne...' : 'Lycée / école...'} /></div>
          {/* N° INE / IEN : identifiant scolaire imprimé au recto (il peut différer
              du code bénéficiaire CMU porté au verso, ex. SN-INE-2025-009341). */}
          <div className="studio-form-group"><label>{resolveCardProgram(cardProgram).idLabel}</label><input className="form-control fw-bold" value={academicData.ine} onChange={(e) => updateAcademicData({ ine: e.target.value })} placeholder={cardProgram === 'CMU_DAARA' ? 'DAARA-2025-0078' : 'SN-INE-2025-009341'} /></div>
          {/* IA / IEF : circuit de l'école publique. Les daaras ne relèvent
              pas de ce réseau — les champs sont retirés du formulaire pour
              éviter de saisir une donnée qui ne sera jamais imprimée. */}
          {resolveCardProgram(cardProgram).showIef && (
            <>
              <div className="studio-form-group"><label>IA</label><input className="form-control fw-bold" value={academicData.ia} onChange={(e) => updateAcademicData({ ia: e.target.value })} placeholder="IA de Dakar" /></div>
              <div className="studio-form-group"><label>IEF</label><input className="form-control fw-bold" value={academicData.ief} onChange={(e) => updateAcademicData({ ief: e.target.value })} placeholder="IEF Dakar Plateau" /></div>
            </>
          )}
        </div>}
      </div>

      {/* 2.c PERSONNALISATION VISUELLE ET PARRAIN */}
      <div className="card p-4 p-md-5 rounded-4 mb-5 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h5 className="fw-extrabold mb-1 text-emerald d-flex align-items-center gap-2.5" style={{ fontSize: '1.3rem' }}>
              <span>🎨</span> Personnalisation complète de la carte
            </h5>
            <p className="text-sub small mb-0" style={{ fontSize: '0.86rem' }}>
              Personnalisez le logo en filigrane, les couleurs et les contours de la carte <strong className="font-monospace">{cardCmuNumber}</strong>.
            </p>
          </div>
          <span
            className="badge fw-extrabold px-3 py-2"
            style={{
              borderRadius: '12px',
              fontSize: '0.76rem',
              background: sponsorsSource === 'server' ? 'rgba(5,150,105,0.15)' : 'rgba(245,158,11,0.18)',
              color: sponsorsSource === 'server' ? '#047857' : '#b45309'
            }}
          >
            {sponsorsSource === 'server' ? '☁️ Synchronisé serveur' : sponsorsSource === 'local' || sponsorsSource === 'local-official' ? '💾 Mode hors-ligne (cache local)' : '⚠️ Aucun parrain trouvé'}
          </span>
        </div>

        <div className="studio-form-grid-3 mt-4 pt-4 border-top" style={{ borderColor: 'var(--border-color)' }}>
          <div className="studio-form-group"><label>Couleur principale</label><input type="color" className="form-control form-control-color" value={cardDesign.accentColor} onChange={(e) => updateCardDesign({ accentColor: e.target.value })} /></div>
          <div className="studio-form-group"><label>Couleur du contour</label><input type="color" className="form-control form-control-color" value={cardDesign.borderColor} onChange={(e) => updateCardDesign({ borderColor: e.target.value })} /></div>
          <div className="studio-form-group"><label>Position du filigrane</label><select className="form-select fw-bold" value={cardDesign.watermarkPosition} onChange={(e) => updateCardDesign({ watermarkPosition: e.target.value })}><option value="TOP">En haut</option><option value="CENTER">Au centre</option><option value="BOTTOM">En bas</option></select></div>
          <div className="studio-form-group"><label>Opacité du filigrane : {Math.round(cardDesign.watermarkOpacity * 100)}%</label><input type="range" min="0.04" max="0.3" step="0.01" value={cardDesign.watermarkOpacity} onChange={(e) => updateCardDesign({ watermarkOpacity: Number(e.target.value) })} /></div>
          <div className="studio-form-group"><label>Taille du filigrane : {cardDesign.watermarkScale}%</label><input type="range" min="25" max="90" step="1" value={cardDesign.watermarkScale} onChange={(e) => updateCardDesign({ watermarkScale: Number(e.target.value) })} /></div>
        </div>

        <div className="studio-grid-2">
          {/* Sélection du parrain attribué à la carte affichée */}
          <div className="studio-form-group">
            <label>Parrain / Partenaire pour cette carte :</label>
            <select
              className="form-control fw-bold"
              value={currentSponsorPhone}
              onChange={(e) => handleAssignSponsor(e.target.value)}
            >
              <option value="">— Aucun parrain (carte non personnalisée) —</option>
              {!!currentSponsorPhone && !sponsors.some(s => s.phone === currentSponsorPhone) && (
                <option value={currentSponsorPhone}>{currentSponsorName}</option>
              )}
              {sponsors.map((s) => (
                <option key={s.phone} value={s.phone}>
                  {s.name}
                  {s.mutuelleName ? ` • ${s.mutuelleName}` : ''}
                  {s.filleulCount > 0 ? ` (${s.filleulCount} filleul${s.filleulCount > 1 ? 's' : ''})` : ''}
                </option>
              ))}
            </select>
            <small className="text-muted d-block mt-2" style={{ fontSize: '0.76rem' }}>
              Le parrain sélectionné est mémorisé pour cette carte précise et réappliqué automatiquement à la prochaine ouverture du studio.
            </small>
          </div>

          {/* Logo du parrain : aperçu + téléversement + retrait */}
          <div className="studio-form-group">
            <label>Logo du parrain (PNG/JPEG/SVG — {Math.round(SPONSOR_LOGO_MAX_BYTES / 1024)} Ko max) :</label>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              <div style={{ width: '120px', height: '66px', borderRadius: '12px', border: '1.5px dashed var(--border-color)', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {currentSponsorLogo ? (
                  <img
                    src={currentSponsorLogo}
                    alt={currentSponsorName || 'Logo du parrain'}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700' }}>Aucun logo</span>
                )}
              </div>

              <div className="d-flex flex-column gap-2">
                <input
                  ref={sponsorLogoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="d-none"
                  onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) handleSponsorLogoFile(f); }}
                />
                <button
                  type="button"
                  className="btn btn-sm fw-extrabold px-3 py-2 hover-lift"
                  style={{ borderRadius: '12px', background: '#059669', color: '#ffffff', minHeight: '44px' }}
                  disabled={sponsorLogoBusy}
                  onClick={() => { if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.click(); }}
                >
                  {sponsorLogoBusy ? '⏳ Traitement…' : (currentSponsorPhone ? '⬆️ Logo du parrain' : '⬆️ Logo de cette carte')}
                </button>
                <button
                  type="button"
                  className="btn btn-sm fw-extrabold px-3 py-2 text-danger border border-danger hover-lift"
                  style={{ borderRadius: '12px', minHeight: '44px', background: 'rgba(220,38,38,0.06)' }}
                  disabled={sponsorLogoBusy || !(cardLogo || (currentSponsorPhone && currentSponsorLogo))}
                  onClick={() => {
                    if (currentSponsorPhone && currentSponsorLogo) handleRemoveSponsorLogo();
                    else if (cardLogo) { setCardLogo(cardCmuNumber, null); setCardLogoState(null); setSponsorNotice({ type: 'success', text: 'Logo personnalisé retiré de cette carte.' }); }
                  }}
                >
                  🗑️ Retirer le logo
                </button>
              </div>
            </div>
            <small className="text-muted d-block mt-2" style={{ fontSize: '0.76rem' }}>
              {currentSponsorPhone
                ? `✅ Le logo s'applique automatiquement à ses ${sponsoredCardCount} carte(s) : plus besoin de les ouvrir une par une.`
                : 'Sélectionnez un parrain ci-dessus pour que son logo se réplique automatiquement sur toutes ses cartes.'}
            </small>
            <small className="text-muted d-block mt-1" style={{ fontSize: '0.76rem' }}>
              Le logo est enregistré dans la base (colonne <code>beneficiaries.sponsor_logo</code>) et mis en cache localement : il reste disponible même sans connexion.
            </small>
          </div>
        </div>

        {sponsorNotice && (
          <div
            className="alert mt-4 mb-0 rounded-4 border-0 py-3 px-3.5"
            style={{
              fontSize: '0.84rem',
              fontWeight: '700',
              background: sponsorNotice.type === 'error' ? 'rgba(220,38,38,0.12)' : sponsorNotice.type === 'warning' ? 'rgba(245,158,11,0.15)' : 'rgba(5,150,105,0.12)',
              color: sponsorNotice.type === 'error' ? '#b91c1c' : sponsorNotice.type === 'warning' ? '#b45309' : '#047857'
            }}
          >
            {sponsorNotice.text}
          </div>
        )}
      </div>

      {/* 3. SECTION ENFANTS MINEURS RACCROCHÉS AVEC PHOTOS INDIVIDUELLES TÉLÉVERSABLES */}
      <div className="card p-4 p-md-5 rounded-4 mb-5 shadow-sm" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
          <div>
            <h5 className="fw-extrabold mb-1 text-emerald d-flex align-items-center gap-2.5" style={{ fontSize: '1.3rem' }}>
              <span>👶</span> 3. Enfants mineurs à charge (&lt; 18 ans)
            </h5>
            <p className="text-sub small mb-0" style={{ fontSize: '0.86rem' }}>
              Rattachés directement au garant avec photo propre, carnet vaccinal PEV et antécédents médicaux enregistrés :
            </p>
          </div>

          <button 
            type="button" 
            className="btn text-white fw-extrabold py-3 px-4 shadow-sm hover-lift d-flex align-items-center gap-2"
            style={{ borderRadius: '16px', fontSize: '0.92rem', background: '#059669', border: '1.5px solid #10b981' }}
            onClick={handleAddMinorChild}
          >
            <span>➕</span> Ajouter un enfant mineur
          </button>
        </div>

        {((editForm.dependents || []).filter(d => !d.isMajor)).length > 0 ? (
          <div className="d-flex flex-column gap-5">
            {((editForm.dependents || []).filter(d => !d.isMajor)).map((child, cIdx) => (
              <div key={cIdx} className="p-4 p-md-5 rounded-4 border bg-body shadow-sm" style={{ borderColor: 'var(--border-color)', borderRadius: '24px' }}>
                
                {/* En-tête Enfant */}
                <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom flex-wrap gap-3" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="d-flex align-items-center gap-3">
                    <span className="badge bg-emerald text-white fw-extrabold px-3.5 py-2" style={{ fontSize: '0.88rem', borderRadius: '12px' }}>
                      Enfant #{cIdx + 1}
                    </span>
                    <code style={{ fontSize: '0.9rem', color: '#059669', fontWeight: '800' }}>
                      Suffixe : {child.codeSuffix || `.M${cIdx + 1}`}
                    </code>
                  </div>

                  <button 
                    type="button" 
                    className="btn fw-bold px-3.5 py-2 shadow-sm hover-lift"
                    style={{ fontSize: '0.84rem', borderRadius: '12px', background: '#991b1b', color: '#ffffff', border: '1px solid #ef4444' }}
                    onClick={() => handleRemoveChild(cIdx)}
                  >
                    🗑️ Supprimer cet enfant
                  </button>
                </div>

                {/* Photo d'identité de l'enfant téléversable */}
                <div className="d-flex align-items-center gap-4 mb-4 p-4 rounded-4" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid var(--border-color)', borderRadius: '20px' }}>
                  <img 
                    src={child.photoUrl || '/dr_fatou_diop.png'} 
                    alt={child.name} 
                    style={{ width: '68px', height: '68px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #10b981', boxShadow: '0 4px 12px rgba(16,185,129,0.25)', flexShrink: 0 }}
                    onError={(e) => { e.target.src = '/dr_fatou_diop.png'; }}
                  />
                  <div className="flex-grow-1">
                    <label className="form-label text-sub fw-bold mb-2.5 d-block" style={{ fontSize: '0.84rem' }}>
                      Photo d'identité enfant (téléverser un fichier local) :
                    </label>
                    <div className="d-flex gap-3 align-items-center flex-wrap">
                      <label className="btn text-white fw-extrabold px-3.5 py-2 shadow-sm hover-lift" style={{ borderRadius: '12px', cursor: 'pointer', fontSize: '0.84rem', background: '#059669', border: '1.5px solid #10b981', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
                        📸 Importer une photo enfant...
                        <input 
                          type="file" 
                          accept="image/*" 
                          style={{ display: 'none' }}
                          onChange={(e) => handlePhotoFileUpload(e, (dataUrl) => handleUpdateChildField(cIdx, 'photoUrl', dataUrl))}
                        />
                      </label>
                      <input 
                        type="text" 
                        className="form-control fw-bold flex-grow-1 py-2 px-3" 
                        placeholder="URL de la photo enfant..."
                        value={child.photoUrl || ''}
                        onChange={(e) => handleUpdateChildField(cIdx, 'photoUrl', e.target.value)}
                        style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px', fontSize: '0.84rem', minHeight: '44px', minWidth: '180px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Champs Identité & Santé Enfant (Formulaire Enrichi & Spacieux) */}
                <div className="studio-form-grid-2">
                  {/* Nom & Prénom Enfant */}
                  <div className="studio-form-group">
                    <label>
                      <span>Nom & prénom enfant :</span>
                      {child.birthDate && (
                        <span className="badge bg-success-subtle text-success fw-extrabold px-2.5 py-1" style={{ fontSize: '0.78rem', borderRadius: '8px' }}>
                          🎂 {getAgeLabel(child.birthDate)} ans
                        </span>
                      )}
                    </label>
                    <input 
                      type="text" 
                      className="form-control fw-extrabold" 
                      value={child.name || ''}
                      onChange={(e) => handleUpdateChildField(cIdx, 'name', e.target.value)}
                      placeholder="ex: Aïssatou Ndione"
                    />
                  </div>

                  {/* Date de naissance */}
                  <div className="studio-form-group">
                    <label>Né(e) le (JJ/MM/AAAA) :</label>
                    <input 
                      type="text" 
                      className="form-control fw-bold" 
                      value={child.birthDate || ''}
                      onChange={(e) => handleUpdateChildField(cIdx, 'birthDate', e.target.value)}
                      placeholder="12/04/2018"
                    />
                  </div>

                  {/* Ligne 2 : Sexe (Fille / Garçon) */}
                  <div className="studio-form-group">
                    <label>Sexe de l'enfant :</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                      <button 
                        type="button" 
                        className="btn fw-extrabold py-3 px-3 shadow-sm hover-lift"
                        style={{ 
                          fontSize: '0.92rem', 
                          minHeight: '52px',
                          borderRadius: '16px',
                          background: child.gender === 'F' ? '#ec4899' : 'var(--bg-card)',
                          color: child.gender === 'F' ? '#ffffff' : 'var(--text-main)',
                          border: child.gender === 'F' ? '2px solid #db2777' : '1.5px solid var(--border-color)',
                          boxShadow: child.gender === 'F' ? '0 4px 14px rgba(236,72,153,0.35)' : 'none'
                        }}
                        onClick={() => handleUpdateChildField(cIdx, 'gender', 'F')}
                      >
                        👧 Fille
                      </button>
                      <button 
                        type="button" 
                        className="btn fw-extrabold py-3 px-3 shadow-sm hover-lift"
                        style={{ 
                          fontSize: '0.92rem', 
                          minHeight: '52px',
                          borderRadius: '16px',
                          background: child.gender === 'M' ? '#0284c7' : 'var(--bg-card)',
                          color: child.gender === 'M' ? '#ffffff' : 'var(--text-main)',
                          border: child.gender === 'M' ? '2px solid #0369a1' : '1.5px solid var(--border-color)',
                          boxShadow: child.gender === 'M' ? '0 4px 14px rgba(2,132,199,0.35)' : 'none'
                        }}
                        onClick={() => handleUpdateChildField(cIdx, 'gender', 'M')}
                      >
                        👦 Garçon
                      </button>
                    </div>
                  </div>

                  {/* Groupe Sanguin Selecteur Smart */}
                  <div className="studio-form-group">
                    <label>🩸 Groupe sanguin :</label>
                    <select 
                      className="form-select fw-bold"
                      value={child.bloodGroup || 'O+'}
                      onChange={(e) => handleUpdateChildField(cIdx, 'bloodGroup', e.target.value)}
                    >
                      <option value="O+">O Rh+ (O+)</option>
                      <option value="O-">O Rh- (O-)</option>
                      <option value="A+">A Rh+ (A+)</option>
                      <option value="A-">A Rh- (A-)</option>
                      <option value="B+">B Rh+ (B+)</option>
                      <option value="B-">B Rh- (B-)</option>
                      <option value="AB+">AB Rh+ (AB+)</option>
                      <option value="AB-">AB Rh- (AB-)</option>
                    </select>
                  </div>

                  {/* Allergies & Intolérances */}
                  <div className="studio-form-group">
                    <label>⚠️ Allergies :</label>
                    <input 
                      type="text" 
                      className="form-control fw-bold" 
                      value={child.allergies || 'Aucune connue'}
                      onChange={(e) => handleUpdateChildField(cIdx, 'allergies', e.target.value)}
                      placeholder="ex: Intolérance AINS..."
                    />
                  </div>

                  {/* Statut Vaccinal PEV */}
                  <div className="studio-form-group">
                    <label>💉 PEV / carnet vaccinal :</label>
                    <input 
                      type="text" 
                      className="form-control fw-bold" 
                      value={child.vaccines || 'PEV 100% à jour (Penta 3, Rota 2, VAR)'}
                      onChange={(e) => handleUpdateChildField(cIdx, 'vaccines', e.target.value)}
                      placeholder="ex: PEV 100% à jour"
                    />
                  </div>
                </div>

                {/* Ligne 4 : Antécédents Médicaux & Suivi Pédiatrique + 3 Raccourcis ultra-aérés */}
                <div className="studio-form-group mt-2">
                  <label>
                    <span>🏥 Antécédents médicaux & suivi pédiatrique :</span>
                    <span className="text-emerald fw-bold" style={{ fontSize: '0.82rem' }}>Saisie libre ou pré-remplie</span>
                  </label>
                  <textarea 
                    rows="2"
                    className="form-control fw-bold" 
                    value={child.antecedents || 'Développement et courbe de croissance normaux. Aucun traitement en cours.'}
                    onChange={(e) => handleUpdateChildField(cIdx, 'antecedents', e.target.value)}
                    placeholder="Antécédents médicaux, asthme, allergies, chirurgie pédiatrique..."
                  />
                  
                  {/* Les 3 Raccourcis de pré-remplissage avec grand espacement horizontal et vertical */}
                  <div className="d-flex flex-wrap gap-3 mt-3 pt-1">
                    <button 
                      type="button" 
                      className="btn fw-extrabold text-success border border-success px-4 py-2.5 shadow-sm hover-lift"
                      style={{ borderRadius: '14px', fontSize: '0.86rem', background: 'rgba(16,185,129,0.12)', minHeight: '46px' }}
                      onClick={() => handleUpdateChildField(cIdx, 'antecedents', 'Développement et courbe de croissance normaux. Aucun traitement en cours.')}
                    >
                      ✅ Normal / 100% sain
                    </button>
                    <button 
                      type="button" 
                      className="btn fw-extrabold text-warning border border-warning px-4 py-2.5 shadow-sm hover-lift"
                      style={{ borderRadius: '14px', fontSize: '0.86rem', background: 'rgba(245,158,11,0.12)', minHeight: '46px' }}
                      onClick={() => handleUpdateChildField(cIdx, 'antecedents', 'Asthme saisonnier léger (traitement inhalé ponctuel).')}
                    >
                      🫁 Asthme saisonnier
                    </button>
                    <button 
                      type="button" 
                      className="btn fw-extrabold text-info border border-info px-4 py-2.5 shadow-sm hover-lift"
                      style={{ borderRadius: '14px', fontSize: '0.86rem', background: 'rgba(2,132,199,0.12)', minHeight: '46px' }}
                      onClick={() => handleUpdateChildField(cIdx, 'antecedents', 'Suivi pédiatrique annuel régulier. Carnet PEV à jour.')}
                    >
                      👶 Suivi annuel PEV
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 p-md-5 rounded-4 border text-muted text-center" style={{ background: 'var(--bg-card-subtle)', borderColor: 'var(--border-color)', fontSize: '0.9rem', borderRadius: '20px' }}>
            ℹ️ Aucun enfant mineur rattaché à cet adhérent principal. Cliquez sur <strong>"➕ Ajouter un enfant mineur"</strong> ci-dessus pour rattacher un enfant.
          </div>
        )}
      </div>

      {/* PRÉVISUALISATION HD DES CARTES (DESIGN ÉPURÉ LISSE SANS TRAITS PARASITES, VERSO QR CODE 100% CENTRÉ) */}
      <div className="card p-4 p-md-5 rounded-4 mb-5 shadow-lg" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: '28px' }}>
        
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 mb-4 pb-3 border-bottom" style={{ borderColor: 'var(--border-color)' }}>
          <div>
            <h4 className="fw-extrabold mb-1 text-success" style={{ fontSize: '1.4rem' }}>
              Aperçu numérique HD — Format CNI standard (85.6mm × 53.98mm)
            </h4>
            <small style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
              Carte imprimable pour l'Union : <strong className="text-emerald">{cardData.unionName}</strong> • Bénéficiaire : <strong>{cardData.fullName}</strong>
            </small>
          </div>

          <div className="d-flex align-items-center gap-2.5 flex-wrap">
            <span className="badge bg-success-subtle text-success border border-success px-3 py-2 fw-bold" style={{ borderRadius: '12px', fontSize: '0.82rem' }}>
              🛈 Format CNI 85.6 × 53.98mm
            </span>
            
            {/* Télécharger PNG Recto & Verso */}
            <button 
              type="button" 
              className="btn fw-extrabold px-3.5 py-2 shadow-sm hover-lift d-flex align-items-center gap-1.5"
              style={{ borderRadius: '12px', fontSize: '0.86rem', background: '#0284c7', color: '#ffffff', border: 'none' }}
              onClick={() => handleDownloadPng('BOTH')}
              disabled={isGeneratingPdf}
              title="Télécharger les fichiers PNG 600 DPI pour le bac d'impression PVC Epson L8050"
            >
              🖼️ PNG Recto/Verso (600 DPI)
            </button>

            {/* Télécharger PDF 2 Pages */}
            <button 
              type="button" 
              className="btn fw-extrabold px-3.5 py-2 shadow-sm hover-lift d-flex align-items-center gap-1.5"
              style={{ borderRadius: '12px', fontSize: '0.86rem', background: '#d97706', color: '#ffffff', border: 'none' }}
              onClick={() => handlePrintPdf(null)}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  Génération...
                </>
              ) : (
                <>
                  🖨️ PDF 2 Pages (Recto/Verso)
                </>
              )}
            </button>
          </div>
        </div>

        {/* CARTES RECTO ET VERSO UNAMUSC */}
        {/* RECTO AU-DESSUS, VERSO EN DESSOUS (disposition verticale — cartes pleine taille 520px lisibles) */}
        <div className="d-flex flex-column align-items-center gap-5">

          {/* RECTO (PAGE 1 DU PDF) — PHOTO À DROITE, ÉPURÉ SANS AUCUN TRAIT NI ENCADRÉ PARASITE */}
          <div className="d-flex flex-column align-items-center w-100">
            <div className="d-flex align-items-center justify-content-between w-100 mb-3 px-2 flex-wrap gap-2" style={{ maxWidth: '520px' }}>
              <h6 className="fw-extrabold text-sub mb-0" style={{ fontSize: '0.95rem' }}>📄 Recto (page 1 du PDF / Face PVC)</h6>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm fw-bold px-2.5 py-1 text-primary border border-primary hover-lift"
                  style={{ borderRadius: '8px', fontSize: '0.78rem', background: 'rgba(2,132,199,0.08)' }}
                  onClick={() => handleDownloadPng('RECTO')}
                  disabled={isGeneratingPdf}
                  title="Télécharger le Recto en PNG Ultra HD 600 DPI"
                >
                  🖼️ PNG Recto (600 DPI)
                </button>
                <button
                  type="button"
                  className="btn btn-sm fw-bold px-2.5 py-1 text-warning border border-warning hover-lift"
                  style={{ borderRadius: '8px', fontSize: '0.78rem', background: 'rgba(217,119,6,0.08)' }}
                  onClick={() => handlePrintPdf('RECTO')}
                  disabled={isGeneratingPdf}
                  title="Télécharger le Recto seul en PDF 1 page CNI"
                >
                  📄 PDF Recto
                </button>
              </div>
            </div>

            <div
              ref={rectoRef}
              className="cni-physical-card-preview studio-card-surface"
              style={{
                width: '520px',
                height: '328px',
                borderRadius: '18px',
                background: '#ffffff', // FOND BLANC PUR EXIGÉ EN MODE CLAIR ET SOMBRE
                color: '#0f172a',
                padding: '12px 16px',
                position: 'relative',
                boxShadow: '0 16px 45px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                border: '2.5px solid #059669', // Bordure émeraude nette
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box'
              }}
            >
              {cardProgram !== 'CLASSIC' ? (
                <SchoolCardFront cardData={cardData} currentUnion={currentUnion} getMsdLogo={getMsdLogo} customLogo={currentSponsorLogo || cardLogo} />
              ) : (
                <>
              {/* En-tête Officiel Recto : Logo MSD ÉMETTRICE (GAUCHE, dynamique) | Drapeau + République du Sénégal + Union (CENTRE) | Logo SEN-CSU (DROITE) */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px', minHeight: '38px' }}>
                {/* Bloc GAUCHE : Logo de la MSD émettrice (dynamique selon le département du bénéficiaire) */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <img
                    src={getMsdLogo(cardData.unionCode)}
                    onError={(e) => { e.target.onerror = null; e.target.src = '/logo_unamusc.png'; }}
                    alt={cardData.unionName}
                    style={{ height: '36px', width: 'auto', objectFit: 'contain', display: 'block' }}
                  />
                </div>

                {/* Bloc CENTRE : Drapeau du Sénégal au-dessus + Texte République du Sénégal juste en-dessous */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, padding: '0 8px', minWidth: 0 }}>
                  <SenegalFlagSvg style={{ height: '14px', width: '22px', marginBottom: '2px', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.48rem', fontWeight: '900', letterSpacing: '0.04em', color: '#064e3b', textTransform: 'uppercase', lineHeight: 1 }}>
                    République du Sénégal
                  </div>
                  <div style={{ fontSize: '0.74rem', fontWeight: '900', color: '#047857', letterSpacing: '-0.01em', textTransform: 'uppercase', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {cardData.unionName}
                  </div>
                </div>

                {/* Bloc DROITE : Logo SEN-CSU Officiel (au-dessus de CARTE NATIONALE CSU) */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <img
                    src="/sencsu_logo.png"
                    onError={(e) => { e.target.onerror = null; e.target.src = '/logo_csu_official.png'; }}
                    alt="Logo SEN-CSU Sénégal"
                    style={{ height: '36px', width: 'auto', objectFit: 'contain', display: 'block' }}
                  />
                </div>
              </div>

              {/* Ruban Tricolore Sénégalais (Vert, Jaune, Rouge) */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00853f 0%, #fdef42 50%, #e31b23 100%)', borderRadius: '2px', marginBottom: '5px' }}></div>

              {/* Ligne Code bénéficiaire: & CARTE NATIONALE CSU (Code Bénéficiaire Centré & Agrandie) */}
              <div style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ fontSize: '0.54rem', color: '#64748b', fontWeight: '800', whiteSpace: 'nowrap' }}>
                  Code bénéficiaire:
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    background: '#f0fdf4',
                    padding: '2px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #059669',
                    color: '#047857',
                    fontSize: '1.10rem',
                    fontWeight: '900',
                    letterSpacing: '0.04em',
                    fontFamily: 'monospace, sans-serif',
                    boxShadow: '0 2px 5px rgba(5, 150, 105, 0.12)',
                    textAlign: 'center'
                  }}>
                    {cardData.cmuNumber}
                  </span>
                </div>
                <div style={{ fontSize: '0.58rem', color: '#047857', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                  CARTE NATIONALE CSU
                </div>
              </div>

              {/* Contenu Principal Recto (Textes à gauche, Photo à DROITE, REMPLISSAGE PARFAIT DE L'ESPACE) */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between', gap: '16px' }}>

                {/* Colonne Gauche (Données de l'assuré - Équilibrées, Aérées et Parfaitement Lisibles) */}
                <div style={{ flex: 1, minWidth: 0, paddingBottom: '0px' }}>

                  {/* Prénom & Nom */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                    <div>
                      <span style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Prénom(s)</span>
                      <strong style={{ fontSize: '0.88rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', lineHeight: 1.15 }}>
                        {cardData.firstName}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Nom</span>
                      <strong style={{ fontSize: '0.88rem', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', lineHeight: 1.15 }}>
                        {cardData.lastName}
                      </strong>
                    </div>
                  </div>

                  {/* Date & Lieu de Naissance */}
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.48rem', color: '#047857', fontWeight: '900', display: 'block', textTransform: 'uppercase', lineHeight: 1 }}>📅 Né(e) le & Lieu de naissance</span>
                    <strong style={{ fontSize: '0.80rem', fontWeight: '900', color: '#064e3b', lineHeight: 1.15, display: 'block', marginTop: '1px' }}>
                      {cardData.birthDate} {cardData.birthPlace ? `à ${cardData.birthPlace}` : ''}
                    </strong>
                  </div>

                  {/* Adresse */}
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Adresse</span>
                    <strong style={{ fontSize: '0.72rem', fontWeight: '800', color: '#334155', lineHeight: 1.15, display: 'block' }}>
                      {cardData.address}
                    </strong>
                  </div>

                  {/* Mutuelle d'origine */}
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Mutuelle d'origine</span>
                    <strong style={{ fontSize: '0.72rem', fontWeight: '800', color: '#047857', lineHeight: 1.15, display: 'block' }}>
                      {cardData.mutuelleOrigine}
                    </strong>
                  </div>

                  {!cardData.isPrincipal && (
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Adhérent garant</span>
                      <strong style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0284c7', lineHeight: 1.15, display: 'block' }}>
                        {cardData.sponsorName}
                      </strong>
                    </div>
                  )}

                  {/* Logo du parrain / Mairie apposé sur le recto (toutes les familles de cartes) */}
                  {cardData.sponsorLogo && (
                    <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <img
                        src={cardData.sponsorLogo}
                        alt="Logo du parrain"
                        style={{ height: '20px', width: 'auto', maxWidth: '72px', objectFit: 'contain', display: 'block', flexShrink: 0 }}
                        onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '0.44rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Parrainé par</span>
                        <strong style={{ fontSize: '0.60rem', fontWeight: '900', color: '#047857', display: 'block', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cardData.sponsorName || currentSponsorName}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Téléphone — formaté + 100% visible et dégagé au-dessus du pied de carte */}
                  <div style={{ marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '800', display: 'block', lineHeight: 1, textTransform: 'uppercase' }}>Téléphone</span>
                    <strong style={{ fontSize: '0.74rem', fontWeight: '800', color: '#0f172a', display: 'block', lineHeight: 1.2, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {formatPhoneCard(cardData.phone)}
                    </strong>
                  </div>

                </div>

                {/* Colonne Droite (PHOTO ID OFFICIELLE 100px x 126px) */}
                <div style={{ width: '104px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
                  <div style={{ width: '100px', height: '126px', borderRadius: '10px', overflow: 'hidden', border: '2px solid #059669', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: '#f1f5f9', position: 'relative' }}>
                    {cardData.photoUrl ? (
                      <img
                        src={cardData.photoUrl}
                        alt={cardData.fullName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', textAlign: 'center', padding: '4px' }}>
                        <span style={{ fontSize: '2.4rem', lineHeight: 1, marginBottom: '4px' }}>👤</span>
                        <span style={{ fontSize: '0.45rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.02em' }}>PHOTO EN ATTENTE</span>
                        <span style={{ fontSize: '0.38rem', fontWeight: '700', color: '#059669', marginTop: '2px' }}>UNAMUSC SÉNÉGAL</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Pied de Carte Officiel — émettrice MSD dynamique (chaque MSD délivre ses cartes).
                  Fond blanc opaque + zIndex : aucun champ (téléphone, adresse…) ne peut
                  jamais se superposer aux textes du pied, quelle que soit la carte. */}
              <div style={{ position: 'absolute', bottom: '8px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '5px', borderTop: '1px dashed #cbd5e1', background: '#ffffff', zIndex: 6 }}>
                <div style={{ fontSize: '0.50rem', color: '#064e3b', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
                  UNAMUSC SENEGAL - CARTE NATIONALE D’ASSURANCE SANTÉ
                </div>
                <div style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {`DÉLIVRÉE PAR LE MSD DE ${currentUnion.region.toUpperCase()}`}
                </div>
              </div>
                </>
              )}
            </div>
          </div>

          {/* VERSO (PAGE 2 DU PDF) — DESIGN ÉPURÉ LISSE SANS ROCNAGE NI DÉBORDEMENT */}
          <div className="d-flex flex-column align-items-center w-100">
            <div className="d-flex align-items-center justify-content-between w-100 mb-3 px-2 flex-wrap gap-2" style={{ maxWidth: '520px' }}>
              <h6 className="fw-extrabold text-sub mb-0" style={{ fontSize: '0.95rem' }}>📄 Verso (page 2 du PDF / Face PVC)</h6>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm fw-bold px-2.5 py-1 text-primary border border-primary hover-lift"
                  style={{ borderRadius: '8px', fontSize: '0.78rem', background: 'rgba(2,132,199,0.08)' }}
                  onClick={() => handleDownloadPng('VERSO')}
                  disabled={isGeneratingPdf}
                  title="Télécharger le Verso en PNG Ultra HD 600 DPI"
                >
                  🖼️ PNG Verso (600 DPI)
                </button>
                <button
                  type="button"
                  className="btn btn-sm fw-bold px-2.5 py-1 text-warning border border-warning hover-lift"
                  style={{ borderRadius: '8px', fontSize: '0.78rem', background: 'rgba(217,119,6,0.08)' }}
                  onClick={() => handlePrintPdf('VERSO')}
                  disabled={isGeneratingPdf}
                  title="Télécharger le Verso seul en PDF 1 page CNI"
                >
                  📄 PDF Verso
                </button>
              </div>
            </div>
            
            <div 
              ref={versoRef}
              className="cni-physical-card-preview studio-card-surface"
              style={{
                width: '520px',
                height: '328px',
                borderRadius: '18px',
                background: '#ffffff', // FOND BLANC PUR EXIGÉ EN MODE CLAIR ET SOMBRE
                color: '#0f172a',
                padding: '10px 14px',
                position: 'relative',
                boxShadow: '0 16px 45px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                border: '2.5px solid #059669', // Bordure émeraude nette
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxSizing: 'border-box'
              }}
            >
              {cardProgram !== 'CLASSIC' ? (
                <SchoolCardBack cardData={cardData} qrCodeDataUrl={qrCodeDataUrl} customLogo={currentSponsorLogo || cardLogo} />
              ) : (
                <>
              {/* En-tête Verso : Logo UNAMUSC (GAUCHE) | Drapeau + Couverture Sanitaire (CENTRE) | Logo SEN-CSU (DROITE) */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px', minHeight: '38px' }}>
                {/* Bloc GAUCHE : Logo UNAMUSC */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <img 
                    src="/logo_unamusc.png" 
                    onError={(e) => { e.target.onerror = null; e.target.src = '/unamusc_logo.png'; }}
                    alt="UNAMUSC Sénégal" 
                    style={{ height: '34px', width: 'auto', objectFit: 'contain', display: 'block' }}
                  />
                </div>

                {/* Bloc CENTRE : Drapeau du Sénégal au-dessus + Texte Couverture Sanitaire Universelle */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', flex: 1, padding: '0 8px', minWidth: 0 }}>
                  <SenegalFlagSvg style={{ height: '14px', width: '22px', marginBottom: '2px', flexShrink: 0 }} />
                  <div style={{ fontSize: '0.62rem', fontWeight: '900', color: '#064e3b', textTransform: 'uppercase', letterSpacing: '0.02em', lineHeight: 1.1 }}>
                    Couverture Sanitaire Universelle
                  </div>
                  <div style={{ fontSize: '0.58rem', fontWeight: '900', color: '#059669', lineHeight: 1.1, whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>
                    UNAMUSC • CARTE NUMÉRIQUE SÉCURISÉE
                  </div>
                </div>

                {/* Bloc DROITE : Logo SEN-CSU Officiel */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <img 
                    src="/sencsu_logo.png" 
                    onError={(e) => { e.target.onerror = null; e.target.src = '/logo_csu_official.png'; }}
                    alt="Logo SEN-CSU Sénégal" 
                    style={{ height: '34px', width: 'auto', objectFit: 'contain', display: 'block' }}
                  />
                </div>
              </div>

              {/* Ruban Tricolore Sénégalais */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #00853f 0%, #fdef42 50%, #e31b23 100%)', borderRadius: '2px', marginBottom: '6px' }}></div>

              {/* CONTENU CENTRAL VERSO : QR CODE RIGOUROUSEMENT CENTRÉ SANS TEXTE PARASITE */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }}>
                
                {/* Cadre du QR Code Noir Pur HD Centré (80px x 80px) */}
                <div style={{ padding: '3px', background: '#ffffff', border: '2px solid #0f172a', borderRadius: '9px', boxShadow: '0 4px 10px rgba(0,0,0,0.08)', display: 'inline-block', margin: '0 auto 4px auto', position: 'relative', overflow: 'hidden' }}>
                  {qrCodeDataUrl ? (
                    <img 
                      src={qrCodeDataUrl} 
                      alt="QR Code CSU" 
                      style={{ 
                        width: '80px', 
                        height: '80px', 
                        display: 'block',
                        margin: '0 auto'
                      }} 
                    />
                  ) : (
                    <div style={{ width: '80px', height: '80px', background: '#f1f5f9', borderRadius: '8px' }}></div>
                  )}
                </div>

                {/* BANDEAU OFFICIEL COUPON DE GARANTIE (Compact, Lisible & 100% Contenu) */}
                <div style={{ width: '100%', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '9px', padding: '6px 10px', boxSizing: 'border-box', textAlign: 'left', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  
                  {/* Titre du Coupon de Garantie */}
                  <div style={{ fontSize: '0.54rem', color: '#047857', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                    <span>📜</span> COUPON DE GARANTIE
                  </div>

                  {/* Texte Officiel Dynamique (Ajusté au nombre d'ayants droit à charge) */}
                  <div style={{ fontSize: '0.52rem', color: '#0f172a', fontWeight: '600', lineHeight: 1.32, marginBottom: '4px' }}>
                    {(() => {
                      const union = cardData.unionName || 'Dakar';
                      let clean = union.trim()
                        .replace(/Mutuelle de santé départementale de /i, "MSD de ")
                        .replace(/Mutuelle de Santé Départementale de /i, "MSD de ")
                        .replace(/Union départementale de /i, "MSD de ")
                        .replace(/Union Départementale de /i, "MSD de ");
                      let msdStr = clean;
                      if (clean.startsWith("MSD")) msdStr = `la ${clean}`;
                      else if (!clean.toLowerCase().startsWith("la ") && !clean.toLowerCase().startsWith("l'")) msdStr = `la ${clean}`;
                      
                      const minorCount = cardData.minorDependents ? cardData.minorDependents.length : 0;
                      let benText = "le bénéficiaire identifié au recto.";
                      if (minorCount === 1) {
                        benText = "le titulaire ainsi que son 1 ayant droit mineur à charge rattaché au recto (soit 2 bénéficiaires).";
                      } else if (minorCount > 1) {
                        benText = `le titulaire ainsi que ses ${minorCount} ayants droit mineurs à charge rattachés au recto (soit ${minorCount + 1} bénéficiaires).`;
                      }

                      return `Conformément à la convention signée entre votre structure et ${msdStr}, je vous prie de prendre en charge ${benText}`;
                    })()}
                  </div>

                  {/* Pied du Bandeau : Organisé en 2 Lignes Aérées et 100% Antidebordement */}
                  <div style={{ paddingTop: '4px', borderTop: '1px solid #a7f3d0', marginTop: '3px', width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    
                    {/* Ligne 1 : Ayants Droit Mineurs & Samu 15 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      
                      {/* Badge Ayants Droit Mineurs */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#ffffff', padding: '1px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '0.48rem' }}>👶</span>
                        <span style={{ fontSize: '0.44rem', color: '#047857', fontWeight: '800' }}>
                          Ayants droit mineurs :
                        </span>
                        <strong style={{ fontSize: '0.44rem', color: '#065f46', fontWeight: '900', background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px', border: '1px solid #a7f3d0' }}>
                          {cardData.minorDependents ? cardData.minorDependents.length : 0} enfant(s)
                        </strong>
                      </div>

                      {/* Badge Samu Urgence */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#ffffff', padding: '1px 6px', borderRadius: '5px', border: '1px solid #fecaca', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '0.44rem', color: '#334155', fontWeight: '800' }}>
                          🚑 Samu :
                        </span>
                        <strong style={{ fontSize: '0.44rem', color: '#dc2626', fontWeight: '900', background: '#fef2f2', padding: '1px 4px', borderRadius: '3px', border: '1px solid #fecaca' }}>
                          15
                        </strong>
                      </div>

                    </div>

                    {/* Ligne 2 : Contact Mutuelle (3 Hotlines : 76 845 54 99 • 77 742 90 73 • 33 820 21 11) */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '2px 6px', borderRadius: '5px', border: '1px solid #bbf7d0', width: '100%', boxSizing: 'border-box' }}>
                      <span style={{ fontSize: '0.44rem', color: '#047857', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                        📞 Mutuelle :
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: '0.43rem', color: '#047857', fontWeight: '900', background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px', border: '1px solid #a7f3d0', fontFamily: 'monospace, sans-serif' }}>
                          76 845 54 99
                        </strong>
                        <span style={{ color: '#059669', fontWeight: '900', fontSize: '0.42rem' }}>•</span>
                        <strong style={{ fontSize: '0.43rem', color: '#047857', fontWeight: '900', background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px', border: '1px solid #a7f3d0', fontFamily: 'monospace, sans-serif' }}>
                          77 742 90 73
                        </strong>
                        <span style={{ color: '#059669', fontWeight: '900', fontSize: '0.42rem' }}>•</span>
                        <strong style={{ fontSize: '0.43rem', color: '#047857', fontWeight: '900', background: '#ecfdf5', padding: '1px 4px', borderRadius: '3px', border: '1px solid #a7f3d0', fontFamily: 'monospace, sans-serif' }}>
                          33 820 21 11
                        </strong>
                      </div>
                    </div>

                  </div>

                </div>

              </div>

              {/* Pied de Carte Verso (FOND BLANC SUR LA CARTE) : Mention Développeur Officielle */}
              <div style={{ position: 'absolute', bottom: '6px', left: '16px', right: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '3px', borderTop: '1px dashed #cbd5e1', background: '#ffffff', zIndex: 6 }}>
                <div style={{ fontSize: '0.46rem', color: '#475569', fontWeight: '800', whiteSpace: 'nowrap' }}>
                  Solution développée par <strong style={{ color: '#047857', fontWeight: '900' }}>Sen-E-Carte : 77 602 67 83</strong>
                </div>
              </div>
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* MODALE D'INSPECTION DU QR CODE */}
      {showQrInspector && qrCodePayload && (
        <div className="modal-backdrop fade show" style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1050 }}>
          <div className="modal d-block tab-modal" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                <div className="modal-header border-bottom" style={{ borderColor: 'var(--border-color)' }}>
                  <h5 className="modal-title fw-extrabold text-success d-flex align-items-center gap-2">
                    <span>🔍</span> Inspection des données du QR code (format Mon compte scannable)
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setShowQrInspector(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)' }}>
                    Ce QR code pointe directement vers l'URL HTTPS universelle scannable du membre (identique au QR code de la page Mon compte) :
                  </p>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <div><strong>URL encodée :</strong> <code className="text-emerald">{qrCodePayload.verifyUrl}</code></div>
                        <div><strong>Code CSU :</strong> <code>{qrCodePayload.cmuNumber}</code></div>
                        <div><strong>Bénéficiaire :</strong> {qrCodePayload.fullName}</div>
                        <div><strong>Né(e) le / à :</strong> {qrCodePayload.birthDate} à {qrCodePayload.birthPlace}</div>
                        <div><strong>Union départementale :</strong> {qrCodePayload.unionDepartementale}</div>
                        <div><strong>Mutuelle origine :</strong> {qrCodePayload.mutuelleOrigine}</div>
                        <div><strong>Groupe sanguin :</strong> <span className="badge bg-danger">{qrCodePayload.bloodGroup}</span></div>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="p-3 rounded-3" style={{ background: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <div><strong>Formule :</strong> {qrCodePayload.package}</div>
                        <div><strong>Statut plateforme :</strong> <span className="badge bg-success">{qrCodePayload.status}</span></div>
                        <div><strong>Sponsor parrain :</strong> {qrCodePayload.sponsorCmu}</div>
                        <div><strong>Téléphone :</strong> {qrCodePayload.phone}</div>
                        <div><strong>Enfants mineurs rattachés :</strong> {qrCodePayload.minorDependents.length}</div>
                        <div className="text-truncate"><strong>Hash sécurité :</strong> <small className="fw-mono text-emerald">{qrCodePayload.securityHash}</small></div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold text-sub" style={{ fontSize: '0.8rem' }}>Payload JSON brut encodé sur la plateforme :</label>
                    <pre className="p-3 rounded-3 fw-mono" style={{ background: '#0f172a', color: '#10b981', fontSize: '0.78rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {JSON.stringify(qrCodePayload, null, 2)}
                    </pre>
                  </div>
                </div>
                <div className="modal-footer border-top" style={{ borderColor: 'var(--border-color)' }}>
                  <button type="button" className="btn btn-secondary px-4 fw-bold" style={{ borderRadius: '10px' }} onClick={() => setShowQrInspector(false)}>
                    Fermer l'inspecteur
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
