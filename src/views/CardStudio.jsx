import { calculateAge, getAgeLabel } from '../utils/csuFormatter';
import { getStoredMembers, saveStoredMembers, purgeDuplicateMembers } from '../utils/beneficiaryStore';
// Détection du format ANCIEN des cartes à purger (cf. handlePurgeLegacyCards).
// Importé depuis `cmuCode` et NON depuis `bulkImport` : ce dernier charge la
// librairie `xlsx` (≈ 350 Ko) et la ferait entrer dans le bundle initial.
import { isLegacyGeneratedCode, isOfficialCode } from '../utils/cmuCode';
import { detectLanIp, getCachedLanIp, isValidLanIp, clearLanIpCache } from '../utils/lanIp';
import {
  fetchSponsorsWithLogos,
  saveSponsorLogo,
  deleteSponsorLogo,
  readLogoFileOptimized,
  formatBytes,
  LOGO_MAX_DIMENSION,
  getLocalSponsorLogo,
  getCardSponsorAssignments,
  assignSponsorToCard,
  getCardLogo,
  setCardLogo,
  getCardsSponsoredBy,
  applySponsorLogoToAllCards,
  getLotLogo,
  setLotLogo,
  SPONSOR_LOGO_MAX_BYTES
} from '../utils/sponsorLogos';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import DeleteModal from '../components/DeleteModal';
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

/**
 * Style du FILIGRANE (logo du parrain / partenaire), partagé par TOUTES les
 * familles de cartes — classique, CMU-Élèves et CMU-Daara.
 *
 * Le logo n'est plus un petit picto figé dans un coin : il est piloté par
 * les réglages « Personnalisation complète de la carte »
 * (Position / Opacité / Taille du filigrane), qui n'existaient jusqu'ici
 * que pour les cartes scolaires. La carte classique les ignorait et
 * affichait une image de 20 px, décentrée, collée au texte « Mutuelle
 * d'origine » — d'où l'impression que le logo était « en bas ».
 *
 * @param {string|null} logo — data URL ou chemin public
 * @param {object} design — { watermarkPosition, watermarkOpacity, watermarkScale }
 * @returns {object|null} style CSS, ou null si aucun logo
 */
const buildWatermarkStyle = (logo, design = {}) => {
  if (!logo) return null;
  const position = design.watermarkPosition === 'TOP'
    ? 'center 24%'
    : design.watermarkPosition === 'BOTTOM'
      ? 'center 76%'
      : 'center 50%';
  const scale = Number(design.watermarkScale) || 56;
  const opacity = Number(design.watermarkOpacity);
  return {
    backgroundImage: `url(${logo})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: position,
    backgroundSize: `${scale}%`,
    // Plafond à 45 % : au-delà, le logo masquerait la photo et les données
    // de l'assuré. La valeur reste celle choisie dans le panneau.
    opacity: Math.min(0.45, Number.isFinite(opacity) ? opacity : 0.12)
  };
};

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
      {/* Aucun badge ni donnée annuelle ici : l'année scolaire et la classe
          vivent dans le QR code (voir academicQrData dans l'effet QR). */}
      <strong>{program.frontBanner}</strong>
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
        {/* Zone de silence (« quiet zone ») généreuse autour du QR : c'est
            la première cause d'échec sur les téléphones d'entrée de gamme.
            Aucun texte ni motif ne doit entourer le code. */}
        <div className="school-card-qr">{qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR code de vérification" /> : 'QR'}</div>
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

  // Registre des bénéficiaires. Source de vérité : la BASE (voir utils/
  // beneficiarySync). Au premier rendu on lit le registre local — il peut
  // être vide si le navigateur n'a jamais rien stocké — puis la synchronisation
  // avec le serveur le remplit et rafraîchit la liste.
  const initialMembers = getStoredMembers();

  const [members, setMembers] = useState(initialMembers);
  // `initialMembers[0].id` lèverait sur un registre vide (poste neuf, ou
  // après purge) : l'écran de carte resterait en blanc.
  const [selectedMemberId, setSelectedMemberId] = useState(
    initialMembers.length > 0 ? initialMembers[0].id : null
  );
  const [isSyncingRegister, setIsSyncingRegister] = useState(false);
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
  // Entrée de fichier dédiée à l'application d'un logo sur TOUT un lot.
  const lotLogoInputRef = useRef(null);
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
    if (isValidLanIp(cached)) return cached;
    // Si l'app est déjà ouverte via l'IP LAN, c'est la bonne
    if (typeof window !== 'undefined' && isValidLanIp(window.location.hostname)) {
      return window.location.hostname;
    }
    return getCachedLanIp() || '';
  });

  // Détection AUTOMATIQUE de l'IP LAN réelle du PC (backend /api/lan-ip).
  // `force: true` : au montage on ignore un cache issu d'un autre réseau
  // (le PC a pu changer de Wi-Fi entre deux sessions).
  useEffect(() => {
    let cancelled = false;
    detectLanIp({ force: true }).then((ip) => {
      if (cancelled || !ip) return;
      localStorage.setItem('cmu-wifi-ip', ip);
      // Ne pas écraser une IP saisie manuellement par l'utilisateur :
      // on ne remplace que si le champ est vide ou contient l'ancienne IP
      // mémorisée (donc non saisie).
      setCustomWifiIp((prev) => (isValidLanIp(prev) && prev !== ip ? prev : ip));
    });
    return () => { cancelled = true; };
  }, []);

  // ── Suppression d'une fiche (registre local + base) ──────────────────
  // Fiche(s) en attente de confirmation de suppression (tableau : 1 ou N).
  // Une fiche peut être erronée : mauvais appariement de photo, code
  // décalé, import raté. Elle doit pouvoir être retirée sans aller dans
  // la console du navigateur, et sans laisser de trace côté base.
  const [deleteTargets, setDeleteTargets] = useState([]);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Cases cochées dans le panneau de suppression multiple
  const [checkedIds, setCheckedIds] = useState(() => new Set());
  const [showMultiDelete, setShowMultiDelete] = useState(false);
  const [multiSearch, setMultiSearch] = useState('');

  /**
   * Action groupée sur la sélection : rattache les fiches à un LOT de
   * campagne, puis les recode au format officiel REGION-MSD-ANNEE-SEQUENCE.
   *
   * C'est la seule voie de recodage en masse, et elle passe par une
   * sélection EXPLICITE de l'agent : aucune carte déjà imprimée ne peut donc
   * être touchée par mégarde.
   *
   * @param {Array<object>} targets — fiches cochées dans le panneau
   * @param {string} [unionId] — MSD émettrice
   */
  const handleAssignLotAndRecode = async (targets, unionId = 'DKR') => {
    const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    if (list.length === 0) return;

    setDeleteBusy(true);
    try {
      const {
        createCampaignLot, buildStructuredCode, lastSequenceFor,
        regionCodeFor, currentCampaignYear
      } = await import('../utils/bulkImport');
      const { resolveUnion } = await import('../utils/cardPrograms');

      const lot = await createCampaignLot({
        label: `Recodage manuel — ${list.length} dossier(s)`,
        unionId,
        count: list.length
      });

      // 1. Isoler la sélection du reste du registre.
      const all = getStoredMembers();
      const ids = new Set(list.map((m) => m.id));
      const others = all.filter((m) => !ids.has(m.id));
      const selection = all.filter((m) => ids.has(m.id));

      // 2. Recenser les codes déjà pris (reste du registre inclus) pour
      //    qu'aucun matricule ne puisse être réattribué.
      const used = new Set();
      [...others, ...selection].forEach((m) => {
        if (m.cmuNumber) used.add(String(m.cmuNumber).toUpperCase());
        (m.dependents || []).forEach((d) => { if (d.cmuNumber) used.add(String(d.cmuNumber).toUpperCase()); });
      });

      const region = regionCodeFor(unionId);
      const union = resolveUnion(unionId).id;
      const year = currentCampaignYear();
      let seq = lastSequenceFor(used, { region, unionId: union, year });
      const nextCode = () => {
        for (let i = 1; i <= 20000; i++) {
          const c = buildStructuredCode({ region, unionId: union, year, seq: seq + i });
          if (!used.has(c)) { used.add(c); seq += i; return c; }
        }
        return null;
      };

      // Une fiche déjà au format officiel n'est PAS recodée une seconde fois.
      const OFFICIAL_RE = /^[A-Z]{3}-[A-Z]{3}-\d{4}-\d{4}$/;
      const reformat = (person) => {
        if (!person.cmuNumber) return person;
        if (OFFICIAL_RE.test(String(person.cmuNumber).toUpperCase())) return person;
        const c = nextCode();
        return c ? { ...person, cmuNumber: c, adherentCode: c } : person;
      };

      let recoded = 0;
      const recodedMembers = selection.map((m) => {
        const before = m.cmuNumber;
        const after = reformat(m);
        if (after.cmuNumber !== before) recoded++;
        return {
          ...after,
          lotCode: lot.code,
          dependents: (m.dependents || []).map((d) => {
            const db = d.cmuNumber;
            const da = reformat(d);
            if (da.cmuNumber !== db) recoded++;
            // L'ayant droit appartient au même lot que son titulaire.
            return { ...da, lotCode: lot.code };
          })
        };
      });

      const next = [...others, ...recodedMembers];
      const saved = saveStoredMembers(next);
      if (!saved.ok) {
        setBulkNotice({ type: 'error', text: `❌ ${saved.error} Aucune modification enregistrée.` });
        return;
      }
      setMembers(next);
      setCheckedIds(new Set());

      // Rattachement en base : le lot doit suivre les fiches dans PostgreSQL,
      // sinon un autre agent ne verra pas la provenance de ces cartes.
      const { assignCardsToLotOnServer } = await import('../utils/bulkImport');
      const serverCodes = [];
      recodedMembers.forEach((m) => {
        if (m.cmuNumber) serverCodes.push(m.cmuNumber);
        (m.dependents || []).forEach((d) => { if (d.cmuNumber) serverCodes.push(d.cmuNumber); });
      });
      const persisted = await assignCardsToLotOnServer(lot.code, serverCodes);

      setBulkNotice({
        type: 'success',
        text: `🔢 Lot ${lot.code} attribué · ${recoded} carte(s) recodée(s) au format REGION-MSD-ANNEE-SEQUENCE sur ${list.length} dossier(s).${persisted ? ' Provenance enregistrée en base.' : ' Base indisponible : provenance conservée sur ce poste uniquement.'}`
      });
    } catch (e) {
      setBulkNotice({ type: 'error', text: `❌ Recodage impossible : ${e.message}` });
    } finally {
      setDeleteBusy(false);
    }
  };

  /**
   * Fiches à purger avant réimport : celles issues d'un import Excel
   * (MSD de Grand Yoff) qui ne sont PAS encore au format officiel.
   *
   * Deux cas sont couverts, car Grand Yoff a été importé à deux époques :
   *  1. code provisoire généré  → `DKR-2600172` ;
   *  2. code repris du fichier   → `DKR_2600111` (import antérieur au
   *     générateur de matricules).
   *
   * ⚠️ Garde-fou ABSOLU : une fiche n'est retenue que si elle a été
   * *créée par un import* (`id` commençant par `IMP-` ou `SRV-`) ET qu'elle
   * n'est pas déjà au format officiel. Les cartes historiques du jeu
   * `msdDakarMembers` portent des identifiants `MEM-MSD-…` :
   *   - elles sont exclues par le test d'identifiant ;
   *   - et même si un jour on renumérotait leur id, leur code est
   *     volontairement conservé par la non-régression.
   */
  const isPurgeableImport = (m) => {
    if (!m || !m.cmuNumber) return false;
    // Déjà au format officiel : une carte migrée est sauvée (c'est le cas
    // du fichier ASS LONASE, qui ne doit PAS disappear).
    if (isOfficialCode(m.cmuNumber)) return false;
    const id = String(m.id || '');
    const createdByImport = id.startsWith('IMP-') || id.startsWith('SRV-');
    if (createdByImport) return true;
    // Code provisoire généré : signature unique de l'ancien générateur,
    // jamais présente sur une carte imprimée.
    return isLegacyGeneratedCode(m.cmuNumber);
  };

  const findLegacyGeneratedMembers = (list) => (list || []).filter(isPurgeableImport);

  /** Fiches concernées, ayants droit inclus (affichage du décompte). */
  const countLegacyCards = (list) => {
    const legacy = findLegacyGeneratedMembers(list);
    return legacy.reduce((n, m) => n + 1 + (m.dependents || []).length, 0);
  };

  const handlePurgeLegacyCards = async (targets) => {
    const list = (Array.isArray(targets) ? targets : [targets]).filter(Boolean);
    if (list.length === 0) return;
    setDeleteBusy(true);
    try {
      // 1. Base de données (uniquement les fiches réellement présentes).
      let serverDone = 0;
      try {
        const { apiFetch } = await import('../utils/api');
        for (const m of list) {
          const srvId = String(m.id || '').startsWith('SRV-') ? String(m.id).slice(4) : null;
          if (!srvId) continue;
          try {
            const res = await apiFetch(`/api/beneficiaries/${srvId}`, { method: 'DELETE' });
            if (res && res.ok) serverDone++;
          } catch { /* la fiche partira de toute façon du registre local */ }
        }
      } catch { /* API injoignable : purge locale uniquement */ }

      // 2. Registre local.
      const ids = new Set(list.map((m) => m.id));
      const remaining = getStoredMembers().filter((m) => !ids.has(m.id));
      const saved = saveStoredMembers(remaining);
      if (!saved.ok) {
        setBulkNotice({ type: 'error', text: `❌ ${saved.error} La purge n'a pas été enregistrée.` });
        return;
      }
      setMembers(remaining);
      setCheckedIds(new Set());
      if (remaining.length > 0) {
        const stillThere = remaining.some((m) => m.id === selectedMemberId);
        const nextSel = stillThere ? selectedMemberId : remaining[0].id;
        setSelectedMemberId(nextSel);
        setEditForm({ ...remaining.find((m) => m.id === nextSel) });
      }
      const people = list.reduce((n, m) => n + 1 + (m.dependents || []).length, 0);
      setBulkNotice({
        type: 'success',
        text: `🧹 ${list.length} dossier(s) / ${people} carte(s) purgé(s) à l'ancien format.${serverDone ? ` ${serverDone} retiré(s) de la base.` : ''} Réimportez le fichier Excel et le dossier de photos : toutes les cartes repartiront au format officiel REGION-MSD-ANNEE-SEQUENCE.`
      });
    } catch (e) {
      setBulkNotice({ type: 'error', text: `❌ Purge impossible : ${e.message}` });
    } finally {
      setDeleteBusy(false);
      setDeleteTargets([]);
    }
  };

  // Stratégie de codage du prochain lot importé. FILE par défaut : un
  // classeur qui porte un code décrit des cartes déjà imprimées, et ce code
  // ne doit JAMAIS être remplacé (cf. DEFAULT_CODE_STRATEGY).
  // Stratégie de codage du prochain lot importé.
  //
  // ⚠️ Elle est MÉMORISÉE : le rappel silencieux de « 📄 code du fichier » à
  // chaque rechargement a fait échouer plusieurs imports — les cartes
  // restaient en DKR_2600118 au lieu du matricule officiel, sans que rien ne
  // le signale. On se souvient donc du dernier choix.
  const [importCodeStrategy, setImportCodeStrategy] = useState(() => {
    try {
      return localStorage.getItem('unamusc_import_code_strategy') === 'SYSTEM' ? 'SYSTEM' : 'FILE';
    } catch { return 'FILE'; }
  });

  // Garde-fou : conserver les codes d'un fichier n'a de sens que pour un lot
  // DÉJÀ IMPRIMÉ. Sur un nouveau lot, cela produit des cartes sans matricule
  // officiel — la confirmation doit donc être explicite.
  const [printLotConfirmed, setPrintLotConfirmed] = useState(false);

  const chooseStrategy = (value) => {
    setImportCodeStrategy(value);
    try { localStorage.setItem('unamusc_import_code_strategy', value); } catch { /* sans stockage */ }
    if (value === 'SYSTEM') setPrintLotConfirmed(false);
  };

  // ── FILTRAGE PAR LOT DE CAMPAGNE ───────────────────────────────────────
  // Chaque import ouvre un lot (LOT-2026-001, LOT-2026-002…). Le filtre
  // permet de retrouver d'un coup d'œil les cartes d'une même campagne
  // d'enrôlement, et de n'agir que sur elle.
  const [lotFilter, setLotFilter] = useState('ALL');

  // Lots présents dans le registre, avec leur effectif réel (compte de
  // personnes, ayants droit compris).
  const lotList = useMemo(() => {
    const map = new Map();
    for (const m of members) {
      const code = m.lotCode || 'HORS-LOT';
      if (!map.has(code)) {
        map.set(code, { code, dossiers: 0, people: 0, fichiers: new Set() });
      }
      const e = map.get(code);
      e.dossiers += 1;
      e.people += 1 + (m.dependents || []).length;
      if (m.sourceCode) e.fichiers.add(String(m.sourceCode).split('_')[0]);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [members]);

  // Membres visibles après application du filtre de lot.
  const membersByLot = useMemo(
    () => (lotFilter === 'ALL' ? members : members.filter((m) => (m.lotCode || 'HORS-LOT') === lotFilter)),
    [members, lotFilter]
  );

  // La liste déroulante suit le filtre, sinon elle proposerait des fiches
  // invisibles à l'écran — et l'agent ne verrait pas d'où vient sa sélection.
  const memberOptions = useMemo(
    () => (lotFilter === 'ALL' ? members : membersByLot),
    [members, membersByLot, lotFilter]
  );

  // Fiches affichées dans le panneau de suppression multiple : on ne propose
  // QUE les fiches du lot sélectionné, pour qu'une suppression de masse ne
  // déborde jamais sur une autre campagne d'enrôlement.
  const multiFiltered = useMemo(() => {
    const q = (multiSearch || '').trim().toLowerCase();
    if (!q) return memberOptions;
    return memberOptions.filter((m) => `${m.firstName || ''} ${m.lastName || ''} ${m.cmuNumber || ''}`
      .toLowerCase().includes(q));
  }, [memberOptions, multiSearch]);

  /**
   * Applique un logo à TOUTES les fiches du lot affiché, en un clic.
   *
   * Le logo du parrain existe déjà par le circuit « parrain → logo » : il faut
   * attribuer le parrain carte par carte. Pour une campagne entière — le cas
   * de la MSD de Grand Yoff, dont les cartes ne sont pas encore imprimées —
   * on veut appliquer le logo au LOT entier sans 141 manipulations.
   */
  const handleApplyLogoToVisibleLot = async (file) => {
    if (!file || memberOptions.length === 0) return;
    setSponsorLogoBusy(true);
    try {
      const { readLogoFileOptimized } = await import('../utils/sponsorLogos');
      const { dataUrl, width, height, format } = await readLogoFileOptimized(file);
      if (!dataUrl) {
        setSponsorNotice({ type: 'error', text: '❌ Image illisible ou format non supporté.' });
        return;
      }

      // Le logo est identique pour tout le lot : on ne le stocke QU'UNE fois,
      // sous la clé du lot. L'écrire sur les 211 cartes consommerait plus de
      // 6 Mo en base64 et ferait échouer l'enregistrement (quota localStorage).
      const scope = lotFilter === 'ALL' ? 'tout le registre' : `le lot ${lotFilter}`;
      if (lotFilter === 'ALL') {
        // Aucun lot sélectionné : il n'y a pas de clé de regroupement, on
        // retombe sur un logo par carte.
        memberOptions.forEach((m) => {
          if (m.cmuNumber) setCardLogo(m.cmuNumber, dataUrl);
          (m.dependents || []).forEach((d) => { if (d.cmuNumber) setCardLogo(d.cmuNumber, dataUrl); });
        });
      } else {
        // setLotLogo renvoie false si le navigateur refuse l'écriture (quota
        // atteint) : mieux vaut le dire que laisser croire à un logo posé.
        if (!setLotLogo(lotFilter, dataUrl)) {
          setSponsorNotice({
            type: 'error',
            text: '❌ Stockage du navigateur saturé : le logo n\'a pas été enregistré. Libérez de l\'espace (purge d\'un autre lot) puis réessayez.'
          });
          return;
        }
      }

      // Le registre NE doit PAS porter le logo : la carte affichée le lit via
      // getCardLogo(cmuNumber) / getLotLogo(lot). Écrire le base64 dans les
      // 141 fiches ferait exploser le quota localStorage sans aucun effet.
      const touches = memberOptions.reduce((n, m) => n + 1 + (m.dependents || []).length, 0);
      setLotLogoRevision((r) => r + 1);
      setSponsorNotice({
        type: 'success',
        text: `🏷️ Logo appliqué à ${scope} : ${touches} carte(s) (${memberOptions.length} dossier(s)).${width ? ` ${width}×${height} px ${format}.` : ''} Le filigrane apparaît sur les cartes — réglez sa position et sa taille dans « 🎨 Personnalisation complète de la carte ».`
      });
    } catch (e) {
      setSponsorNotice({ type: 'error', text: `❌ Logo non appliqué : ${e.message}` });
    } finally {
      setSponsorLogoBusy(false);
      if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.value = '';
    }
  };

    /**
   * Retire le logo appliqué au lot affiché — le « bouton miroir ».
   *
   * On ne fait QUE ça : supprimer l'entrée de lot. Aucune fiche, aucune photo
   * et aucun code n'est touché, ce qui rend l'opération réversible — on peut
   * réappliquer un logo différents immédiatement après.
   */
  const handleRemoveLogoFromVisibleLot = () => {
    if (lotFilter === 'ALL') {
      // Aucun lot = aucun regroupement : il faut retirer le logo carte par carte.
      const codes = new Set();
      memberOptions.forEach((m) => {
        if (m.cmuNumber) codes.add(String(m.cmuNumber));
        (m.dependents || []).forEach((d) => { if (d.cmuNumber) codes.add(String(d.cmuNumber)); });
      });
      codes.forEach((c) => setCardLogo(c, ''));
      setLotLogoRevision((r) => r + 1);
      setSponsorNotice({ type: 'success', text: `🗑️ Logo retiré de ${codes.size} carte(s) du registre.` });
      return;
    }

    setLotLogo(lotFilter, '');
    setLotLogoRevision((r) => r + 1);
    const touches = memberOptions.reduce((n, m) => n + 1 + (m.dependents || []).length, 0);
    setSponsorNotice({
      type: 'success',
      text: `🗑️ Logo retiré du lot ${lotFilter} : ${touches} carte(s) retrouve(nt) leur apparence d'origine. Les fiches, photos et matricules sont intacts.`
    });
  };

  // Fiches portant un ancien code provisoire (DKR-2600172) : candidates
  // naturelles à la purge, puisqu'un réimport les régénère au bon format.
  const legacyList = useMemo(() => findLegacyGeneratedMembers(members), [members]);
  const legacyCount = useMemo(() => countLegacyCards(legacyList), [legacyList]);

  // La purge des cartes à l'ancien code passe par une confirmation dédiée :
  // elle est massive et non annulable comme une suppression classique.
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);

  /**
   * Vide ENTIÈREMENT le lot affiché, en un clic.
   *
   * ⚠️ Indispensable avant un réimport : la déduplication par identité saute
   * toute personne déjà présente. Sans cette purge, réimporter un fichier ne
   * change RIEN — les anciennes cartes, avec leurs anciens codes, restent en
   * place et le message affiche « déjà présent(s) ignoré(s) ». C'est ce qui
   * a produit plusieurs imports successifs sans effet.
   */
  const handlePurgeVisibleLot = async () => {
    const list = memberOptions;
    if (list.length === 0) return;
    setDeleteBusy(true);
    try {
      let serverDone = 0;
      try {
        const { apiFetch } = await import('../utils/api');
        for (const m of list) {
          const srvId = String(m.id || '').startsWith('SRV-') ? String(m.id).slice(4) : null;
          try {
            const res = srvId
              ? await apiFetch(`/api/beneficiaries/${srvId}`, { method: 'DELETE' })
              : (m.cmuNumber
                ? await apiFetch(`/api/beneficiaries/by-code/${encodeURIComponent(m.cmuNumber)}`, { method: 'DELETE' })
                : null);
            if (res && res.ok) serverDone++;
          } catch { /* la fiche part de toute façon du registre local */ }
        }
      } catch { /* API injoignable : purge locale uniquement */ }

      const ids = new Set(list.map((m) => m.id));
      const remaining = getStoredMembers().filter((m) => !ids.has(m.id));
      const saved = saveStoredMembers(remaining);
      if (!saved.ok) {
        setBulkNotice({ type: 'error', text: `❌ ${saved.error} Le lot n'a pas été vidé.` });
        return;
      }
      setMembers(remaining);
      setCheckedIds(new Set());
      setLotFilter('ALL');
      setSelectedMemberId(remaining.length > 0 ? remaining[0].id : '');
      const people = list.reduce((n, m) => n + 1 + (m.dependents || []).length, 0);
      setBulkNotice({
        type: 'success',
        text: `🧹 Lot ${lotFilter === 'ALL' ? '(tous)' : lotFilter} vidé : ${list.length} dossier(s) / ${people} carte(s) supprimés.${serverDone ? ` ${serverDone} retiré(s) de la base.` : ''} Vous pouvez maintenant réimporter le fichier : les matricules officiels seront appliqués.`
      });
    } catch (e) {
      setBulkNotice({ type: 'error', text: `❌ Purge impossible : ${e.message}` });
    } finally {
      setDeleteBusy(false);
    }
  };

  const toggleChecked = (id) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * Supprime une ou plusieurs fiches : registre local TOUJOURS, base de
   * données UNIQUEMENT pour les fiches qui y existent réellement (identifiant
   * « SRV-<id> »). On n'annonce jamais une suppression en base qui n'a pas
   * eu lieu.
   *
   * @param {Array<object>} list — fiches à retirer
   */
  const handleDeleteMembers = async (list) => {
    const targets = (Array.isArray(list) ? list : [list]).filter(Boolean);
    if (targets.length === 0) return;

    setDeleteBusy(true);
    let serverDone = 0;
    const serverFailed = [];

    // 1. Base de données.
    //
    // ⚠️ Deux voies, car les fiches importées portent un identifiant LOCAL
    // (`IMP-…`) et non serveur : sans suppression PAR CODE, la ligne
    // PostgreSQL subsisterait et la fusion du démarrage réinjecterait les
    // fiches supprimées — avec leurs mauvais codes — au rechargement.
    try {
      const { apiFetch } = await import('../utils/api');
      for (const member of targets) {
        const srvId = String(member.id || '').startsWith('SRV-')
          ? String(member.id).slice(4)
          : null;
        try {
          const res = srvId
            ? await apiFetch(`/api/beneficiaries/${srvId}`, { method: 'DELETE' })
            : (member.cmuNumber
              ? await apiFetch(`/api/beneficiaries/by-code/${encodeURIComponent(member.cmuNumber)}`, { method: 'DELETE' })
              : null);
          if (res && res.ok) serverDone++;
          else if (member.cmuNumber) serverFailed.push(member.cmuNumber);
        } catch {
          if (member.cmuNumber) serverFailed.push(member.cmuNumber);
        }
      }
    } catch {
      // API injoignable : rien n'est retiré de la base, on le signale.
    }

    // 2. Registre local (source d'affichage du studio)
    const idsToRemove = new Set(targets.map((m) => m.id));
    const remaining = getStoredMembers().filter((m) => !idsToRemove.has(m.id));
    saveStoredMembers(remaining);
    setMembers(remaining);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      idsToRemove.forEach((id) => next.delete(id));
      return next;
    });
    if (remaining.length > 0) {
      const stillThere = remaining.some((m) => m.id === selectedMemberId);
      const nextSel = stillThere ? selectedMemberId : remaining[0].id;
      setSelectedMemberId(nextSel);
      setEditForm({ ...remaining.find((m) => m.id === nextSel) });
    }

    const serverInfo = serverDone > 0
      ? ` ${serverDone} retirée(s) également de la base de données.`
      : ' Aucune n\'était présente en base de données (fiches importées localement).';
    const failInfo = serverFailed.length
      ? ` ⚠️ ${serverFailed.length} suppression(s) en base ont échoué : ${serverFailed.slice(0, 5).join(', ')}.`
      : '';

    setDeleteTargets([]);
    setDeleteBusy(false);
    setBulkNotice({
      type: 'success',
      text: `🗑️ ${targets.length} fiche(s) supprimée(s).${serverInfo}${failInfo} ${remaining.length} assuré(s) restant(s).`
    });
  };

  // Synchronisation avec la base de données (source de vérité)
  //
  // Le localStorage n'est qu'un cache : le vider fait perdre les fiches
  // importées. Au démarrage du Studio, on relit donc PostgreSQL et on
  // fusionne : les fiches serveur S'AJOUTENT au registre local, elle ne le
  // remplacent jamais (une édition faite au studio, avec photo personnalisée,
  // doit survivre). La base gagne sur les champs qu'elle connaît ; le local
  // garde ce qu'il seul possède (photo importée, design de carte,-logo).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ── 0. Recodage ASS LONASE, AVANT tout appel réseau ──────────────
      //    Indépendant du backend : si PostgreSQL est injoignable, le
      //    recodage doit tout de même avoir lieu, sinon les codes
      //    resteraient dans l'ancien format.
      let migrated = 0;
      let repaired = 0;
      try {
        const { migrateLegacyCodes, repairDependentCodeSuffix } = await import('../utils/bulkImport');
        if (!cancelled) {
          const { members: recoded, migrated: n } = migrateLegacyCodes(getStoredMembers(), { unionId: 'DKR' });
          migrated = n;
          // Réparation des rangs d'ayants droit : le codeSuffix doit
          // reproduire le rang du matricule, sinon la carte affiche
          // « …-2151.1.3 » au lieu de « …-2151.3 ».
          const { members: repares, repaired: r } = repairDependentCodeSuffix(recoded);
          repaired = r;
          if (n > 0 || r > 0) {
            saveStoredMembers(repares);
            setMembers(repares);
          }
        }
      } catch { /* migration sans effet : le registre reste utilisable */ }

      try {
        const { fetchServerBeneficiaries } = await import('../utils/bulkImport');
        const fromServer = await fetchServerBeneficiaries();
        if (cancelled || !fromServer || fromServer.length === 0) {
          if (migrated > 0) {
            setBulkNotice({
              type: 'success',
              text: `🔢 ${migrated} carte(s) ASS LONASE recodée(s) au format officiel REGION-MSD-ANNEE-SEQUENCE.`
            });
          }
          return;
        }

        setMembers(() => {
          const existing = getStoredMembers();
          const byCode = new Map();
          existing.forEach((m) => { if (m.cmuNumber) byCode.set(String(m.cmuNumber), m); });

          // Index d'IDENTITÉ en plus de l'index de code.
          //
          // ⚠️ Indispensable : après un recodage, la fiche locale porte
          // « DKR-DKR-2026-0001 » alors que PostgreSQL peut encore servir
          // « DKR-2600172 » pour la MÊME personne. Avec un simple index de
          // code, la ligne serveur était considérée comme inconnue et
          // réinjectée comme une carte supplémentaire : les anciens codes
          // « réapparaissaient » à côté des nouveaux, en doublon.
          //
          // On reconnaît donc la personne (NIN, sinon prénom + nom +
          // naissance), pas seulement son matricule.
          const byIdentity = new Map();
          const keyOf = (m) => {
            if (!m) return '';
            const nin = String(m.nin || '').trim();
            if (nin) return `n${nin.toUpperCase()}`;
            const first = String(m.firstName || '').toUpperCase().replace(/[^A-Z]/g, '');
            const last = String(m.lastName || '').toUpperCase().replace(/[^A-Z]/g, '');
            if (!first && !last) return '';
            return `${first}|${last}|${String(m.birthDate || '').slice(0, 10)}`;
          };
          existing.forEach((m) => { const k = keyOf(m); if (k && !byIdentity.has(k)) byIdentity.set(k, m); });

          let added = 0;
          let recodedFromServer = 0;
          let staleServerCodes = 0;
          fromServer.forEach((s) => {
            const key = String(s.cmuNumber);
            let local = byCode.get(key);
            let isNewIdentity = false;

            if (!local) {
              // Peut-on reconnaître la personne malgré un matricule différent ?
              const idKey = keyOf(s);
              local = idKey ? byIdentity.get(idKey) : null;
              if (local) isNewIdentity = true;
            }

            if (!local) {
              // Fiche absente du poste : on l'ajoute (elle vient de la base)
              existing.push(s);
              byCode.set(key, s);
              const idKey = keyOf(s);
              if (idKey && !byIdentity.has(idKey)) byIdentity.set(idKey, s);
              added++;
              return;
            }

            if (isNewIdentity) {
              // Même personne, matricule différent.
              //
              // ⚠️ LA BASE NE DOIT PAS ÉCRASER UN CODE DÉJÀ RECODÉ. Si elle
              // sert encore un ancien matricule (`DKR-2600172`), c'est
              // qu'elle n'a pas été migrée : la valeur locale, déjà au
              // format officiel, reste la bonne. Sans cette garde, le
              // recodage local était annulé à chaque rechargement — c'est
              // exactement le symptôme « ça ne change pas ».
              const serverCode = String(s.cmuNumber || '').toUpperCase();
              const serverIsLegacy = /^[A-Z]{3}-26\d{5}$/.test(serverCode);
              if (!serverIsLegacy) {
                local.cmuNumber = s.cmuNumber;
                local.adherentCode = s.cmuNumber;
                byCode.set(key, local);
                recodedFromServer++;
              } else {
                staleServerCodes++;
              }
            }

            if (!local.photoUrl && s.photoUrl) {
              // La base connaît une photo que le cache local n'a pas
              local.photoUrl = s.photoUrl;
              local.hasOfficialPhoto = true;
              local.photoStatus = 'OFFICIAL';
            }
          });

          if (added > 0 || migrated > 0 || recodedFromServer > 0 || staleServerCodes > 0) {
            saveStoredMembers(existing);
            // La base sert encore des matricules au format ancien : elle
            // doit être migrée (redémarrage du backend) pour que le
            // problème disparaisse définitivement.
            const staleInfo = staleServerCodes > 0
              ? ` ⚠️ ${staleServerCodes} matricule(s) périmés subsistent en base : redémarrez le backend pour appliquer la migration, sinon ils réapparaîtront au prochain rechargement.`
              : '';
            setBulkNotice({
              type: staleServerCodes > 0 ? 'warning' : 'success',
              text: `☁️ ${added} bénéficiaire(s) restauré(s) depuis la base de données.${migrated > 0 ? ` ${migrated} carte(s) recodée(s) au format officiel REGION-MSD-ANNEE-SEQUENCE.` : ''}${repaired > 0 ? ` 🔧 ${repaired} rang(s) d'ayant droit réparé(s) (les codes affichés ne portent plus de double suffixe).` : ''}${recodedFromServer > 0 ? ` ${recodedFromServer} code(s) recadré(s) sur la valeur de la base (aucun doublon créé).` : ''}${staleInfo}`
            });
          }
          return existing;
        });
      } catch {
        /* Backend injoignable : le registre local reste inchangé. */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Formulaire d'édition directe.
  //
  // ⚠️ Ne JAMAIS `useState(initialMembers[0])` : le registre est vide tant que la
  // synchronisation avec la base n'a pas répondu (poste neuf, purge, backend
  // éteint). `initialMembers[0]` valait alors `undefined`, `editForm` aussi, et
  // le premier accès `editForm.departmentUnionId` faisait tomber la vue sur
  // « TypeError: Cannot read properties of undefined ». On démarre donc sur un
  // objet vide, jamais sur `undefined`.
  const [editForm, setEditForm] = useState(() => ({ ...(initialMembers[0] || {}) }));

  const rectoRef = useRef(null);
  const versoRef = useRef(null);

  // Membre principal sélectionné.
  //
  // ⚠️ Doit TOUJOURS être un objet, même sans fiche : le registre est vide
  // tant que la synchronisation avec la base n'a pas répondu (poste neuf,
  // backend éteint, ou compte sans périmètre). `members[0]` valait alors
  // `undefined`, et le premier accès `currentMember.departmentUnionId` faisait
  // tomber toute la vue sur « TypeError: Cannot read properties of undefined ».
  // On garde donc un objet vide stable : les champs s'affichent vides, l'écran
  // reste lisible, et la fiche réelle arrive dès que la base répond.
  const EMPTY_MEMBER = useMemo(() => ({
    id: '', cmuNumber: '', firstName: '', lastName: '', dependents: [], mergedCodes: []
  }), []);
  const currentMember = members.find(m => m.id === selectedMemberId) || members[0] || EMPTY_MEMBER;

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

  // Synchronisation avec la base : le studio affiche le registre RÉELLEMENT
  // enregistré, pas un extrait figé. C'est ce qui manquait pour que les 1 003
  // bénéficiaires de la base soient imprimables en carte.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { syncBeneficiariesFromServer } = await import('../utils/beneficiarySync');
      const synced = await syncBeneficiariesFromServer();
      if (cancelled) return;

      if (!synced) {
        // Backend éteint ou session expirée : le registre local reste
        // affiché tel quel, sans jamais être vidé.
        if (getStoredMembers().length === 0) {
          setBulkNotice({
            type: 'warning',
            text: '⚠️ Aucun bénéficiaire disponible : le registre serveur est injoignable et aucune fiche n\'est enregistrée sur ce poste. Démarrez le backend et reconnectez-vous pour importer les 1 003 dossiers réels.'
          });
        }
        return;
      }

      setMembers(synced);
      setSelectedMemberId((prev) => {
        // Garde la fiche affichée si elle existe toujours, sinon première
        // fiche du registre réel.
        if (prev && synced.some((m) => m.id === prev)) return prev;
        return synced.length > 0 ? synced[0].id : null;
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // ⚠️ L'ancienne « hydratation ZÉRO PERTE » est supprimée.
  //
  // Elle relisait le fichier de secours et recréait des fiches en INVENTANT
  // des valeurs absentes des données réelles : groupe sanguin « O+ » et
  // commune « Dakar » pour tout le monde, package « UNAMUSC 80% ».
  // Sur une carte imprimée, un groupe sanguin inventé n'est pas anodin.
  // La synchronisation ci-dessus remonte la BASE, qui est la seule source
  // acceptable : champ vide à l'écran plutôt que valeur plausible et fausse.

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
  //
  // ⚠️ Un ayant droit IMPORTÉ porte son PROPRE matricule, déjà complet
  // (« DKR-DKR-2026-2151.3 »). Le recomposer à partir du code du parent
  // (« …-2151.1 ») + un suffixe produisait un double point :
  // « DKR-DKR-2026-2151.1.3 ». On n'utilise donc le calcul historique que
  // pour les fiches sans matricule propre (jeu de données d'origine).
  const cardCmuNumber = currentMajorDependent
    ? (currentMajorDependent.cmuNumber
      || `${(editForm.cmuNumber || currentMember.cmuNumber).replace(/\.0$/, '')}${currentMajorDependent.codeSuffix || ''}`)
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
  // Le logo du LOT précède le logo de carte : un logo de campagne prime sur un
  // réglage ponctuel, puis on retombe sur le logo du parrain / de la carte.
  // Relu via lotLogoRevision : appliquer un logo sur un lot doit rafraîchir
  // la carte affichée sans changer de dossier.
  const [lotLogoRevision, setLotLogoRevision] = useState(0);
  const lotLogo = useMemo(
    () => (currentMember ? getLotLogo(currentMember.lotCode) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMember, lotLogoRevision]
  );
  const effectiveSponsorLogo = currentSponsorLogo || lotLogo || cardLogo || (isSchoolCard ? '/logo_mairie_dakar.png' : null);
  // Filigrane de la carte CLASSIQUE : mêmes réglages (position / opacité /
  // taille) que les cartes Élèves et Daara. Sans ce calque, la carte
  // classique ignorait le panneau « Personnalisation complète de la carte »
  // et affichait un logo de 20 px en bas de la colonne de gauche.
  const classicWatermarkStyle = buildWatermarkStyle(effectiveSponsorLogo, cardDesign);
  // Tuteur (élève / talibé) : champ dédié du dossier, repli sur le parrain.
  const tuteurName = (editForm.tuteurName || currentMember.tuteurName) || null;
  const tuteurPhone = (editForm.tuteurPhone || currentMember.tuteurPhone) || null;

  // Données complètes calculées
  // ⚠️ Les fiches n'ont pas toutes la même forme :
  //  - le jeu de données historique (msdDakarMembers) stocke l'ayant droit
  //    sous `name` : « ASSI SECK » ;
  //  - l'import Excel stocke `firstName` / `lastName` en champs séparés.
  //
  // ⚠️ `currentMajorDependent` vaut NULL pour la carte du titulaire : ce
  // calcul doit donc être protégé (`?.`), sinon le rendu plante sur
  // « null.name » avant même d'atteindre le ternaire ci-dessous.
  const dependentFullName = ((currentMajorDependent
    && (currentMajorDependent.name
      || `${currentMajorDependent.firstName || ''} ${currentMajorDependent.lastName || ''}`.trim()))
    || '').toString().trim();

  const cardData = currentMajorDependent ? {
    isPrincipal: false,
    firstName: dependentFullName.split(' ')[0] || dependentFullName,
    lastName: dependentFullName.split(' ').slice(1).join(' ') || '',
    fullName: dependentFullName,
    cmuNumber: currentMajorDependent.cmuNumber
      || `${(editForm.cmuNumber || currentMember.cmuNumber).replace(/\.0$/, '')}${currentMajorDependent.codeSuffix || ''}`,
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
    minorDependents: (currentMember.dependents || []).filter(d => !d.isMajor),
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
    // IP retenue pour le QR : saisie par l'agent, sinon IP mémorisée, sinon
    // celle de l'URL courante si l'app est déjà ouverte via le LAN.
    // Aucune valeur par défaut : sans IP exploitable, on affiche l'URL
    // courante plutôt qu'une adresse fausse qui échouerait au scan.
    const storedIp = typeof window !== 'undefined' ? localStorage.getItem('cmu-wifi-ip') : null;
    const effectiveIp = [customWifiIp, storedIp, getCachedLanIp()]
      .find((candidate) => isValidLanIp(candidate)) || '';
    let origin = window.location.origin;

    // Si le PC navigue sur localhost/127.0.0.1, utiliser l'IP IPv4 réelle du PC
    if (effectiveIp && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
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
      // Sans IP exploitable, on retombe sur l'URL courante plutôt que d'encoder
      // une adresse inventée : le scan échouerait sur le téléphone.
      const wifiOrigin = effectiveIp ? `http://${effectiveIp}:${currentPort}` : origin;
      verifyUrl = `${wifiOrigin}/#/verify/${cardData.cmuNumber}?${academicQrData.toString()}`;
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

    // Générer l'image du QR Code avec NOIR PUR (#000000) et contraste ISO maximal.
    // Correction d'erreur « M » et non « H » : le niveau H ajoute ~30 % de
    // redondance, donc beaucoup plus de modules, donc des pixels plus fins —
    // illisibles sur les téléphones d'entrée de gamme. Le niveau M reste
    // très robuste (≈7 % de redondance) tout en scannant nettement mieux.
    QRCode.toDataURL(verifyUrl, {
      margin: 3,
      width: 720,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'M'
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
  //
  // AUCUNE règle de lecture ici : tout est délégué à src/utils/bulkImport.js
  // (source unique de vérité, testable hors navigateur). Une correction
  // apportée à la librairie s'applique immédiatement ici ET à tout import
  // réalisé ailleurs dans la plateforme.

  /**
   * Importe le classeur, apparie les photos (dossier sélectionné juste avant),
   * ajoute les fiches au store local du studio puis pousse le tout vers le
   * backend (mode secours fichier si la base est indisponible).
   */
  const handleBulkImport = async (excelFile) => {
    if (!excelFile) return;
    setBulkImporting(true);
    setBulkNotice({ type: 'info', text: '⏳ Lecture du fichier Excel et appariement des photos…' });
    try {
      // Pipeline UNIQUE (src/utils/bulkImport.js) : lecture du classeur,
      // appariement des photos (colonne PHOTO, nom, prénom, téléphone, code),
      // compression, puis construction des fiches. Aucune règle dupliquée ici.
      const { runExcelImport, createCampaignLot } = await import('../utils/bulkImport');
      // Chaque import ouvre un LOT de campagne : c'est la provenance de la
      // carte, la seule information qui dise si elle a déjà été imprimée.
      const lot = await createCampaignLot({
        sourceFile: excelFile.name || '',
        codeStrategy: importCodeStrategy,
        // Un lot qui conserve les codes du classeur décrit des cartes
        // DÉJÀ imprimées : il est marqué comme tel dès l'import.
        printed: importCodeStrategy === 'FILE',
        count: 0
      });
      // Les matricules déjà attribués sont transmis : les nouveaux codes sont
      // générés AU-DELÀ du dernier, jamais par-dessus un code existant.
      const alreadyCoded = getStoredMembers().map(m => (m.cmuNumber || '').toString());
      const { members, totalPeople, matchedPhotos, degradedPhotos, merged, dupGroups } = await runExcelImport(
        excelFile,
        pendingPhotosRef.current,
        alreadyCoded,
        { lotCode: lot.code, codeStrategy: importCodeStrategy }
      );

      // 1. Ajout au store local du studio (immédiatement imprimable).
      //    Un assuré déjà connu n'est JAMAIS réimporté : zéro doublon. La
      //    reconnaissance se fait sur l'IDENTITÉ (NIN, ou prénom + nom +
      //    naissance) et plus sur le matricule — celui-ci étant désormais
      //    généré par le système, il change à chaque import.
      const { collectIdentities, beneficiaryIdentity } = await import('../utils/bulkImport');
      const existing = getStoredMembers();
      const existingCodes = new Set(existing.map(m => (m.cmuNumber || '').toString()));
      const existingIds = collectIdentities(existing);
      const seenInFile = new Set();
      const fresh = [];
      let duplicates = 0;
      for (const m of members) {
        const key = beneficiaryIdentity(m);
        if ((key && (existingIds.has(key) || seenInFile.has(key)))
          || existingCodes.has((m.cmuNumber || '').toString())) {
          duplicates++;
          continue;
        }
        if (key) seenInFile.add(key);
        fresh.push(m);
      }
      // 1b. Écriture locale — SAISIR LE RÉSULTAT.
      // Une fiche affichée mais non écrite disparaît au rechargement : on
      // refuse donc d'annoncer un succès si l'enregistrement a échoué.
      let saved = { ok: true, quotaExceeded: false, bytes: 0 };
      if (fresh.length > 0) {
        const nextMembers = [...fresh, ...existing];
        saved = saveStoredMembers(nextMembers);
        setMembers(nextMembers);
      }
      // 2. Push backend — la BASE est la source de vérité : les photos
      //    y sont conservées, ce qui soulage le localStorage (plafonné à
      //    ~5 Mo) et fait survivre le registre au changement de poste.
      //    Envoi par lots : un corps de plusieurs mégaoctets se fait
      //    refuser par les proxys.
      let serverInfo = '';
      try {
        const { apiFetch } = await import('../utils/api');
        const BATCH = 40;
        let inserted = 0;
        let updated = 0;
        let failed = 0;
        for (let i = 0; i < fresh.length; i += BATCH) {
          const batch = fresh.slice(i, i + BATCH);
          const res = await apiFetch('/api/beneficiaries/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rows: batch.flatMap(m => [
                {
                  codeBeneficiaire: m.cmuNumber,
                  numeroAdherent: m.adherentCode,
                  sourceCode: m.sourceCode || null,
                  lotCode: m.lotCode || lot.code,
                  prenom: m.firstName,
                  nom: m.lastName,
                  birthDate: m.birthDate,
                  birthPlace: m.birthPlace,
                  nin: m.nin || null,
                  sexe: m.gender,
                  bloodGroup: m.bloodGroup,
                  telephone: m.phone,
                  address: m.address,
                  schoolName: m.schoolName || null,
                  photoUrl: m.photoUrl || null
                },
                // Les ayants droit sont des personnes à part entière : ils
                // ont leur PROPRE matricule et doivent être enregistrés
                // eux aussi, sinon le.scan de leur carte ne trouve rien.
                ...(m.dependents || []).map(d => ({
                  codeBeneficiaire: d.cmuNumber,
                  numeroAdherent: m.cmuNumber,
                  sourceCode: d.sourceCode || null,
                  lotCode: d.lotCode || m.lotCode || lot.code,
                  prenom: d.firstName,
                  nom: d.lastName,
                  birthDate: d.birthDate,
                  birthPlace: d.birthPlace,
                  nin: d.nin || null,
                  sexe: d.gender,
                  bloodGroup: d.bloodGroup,
                  telephone: d.phone,
                  address: d.address,
                  photoUrl: d.photoUrl || null
                }))
              ])
            })
          });
          if (!res || !res.ok) {
            failed++;
            // On ne casse pas la boucle : les lots suivants sont
            // indépendants et peuvent aboutir.
            continue;
          }
          const data = await res.json();
          inserted += Number(data.inserted) || 0;
          updated += Number(data.updated) || 0;
          if (data.mode === 'fallback-file') {
            serverInfo = ' · Base indisponible : conservés dans le fichier secours serveur (flush automatique à la reconnexion).';
          }
        }
        const failInfo = failed > 0 ? ` ⚠️ ${failed} lot(s) non enregistrés en base.` : '';
        serverInfo += ` · ${inserted} créé(s) et ${updated} mis à jour en base.${failInfo}`;
      } catch {
        serverInfo = ' · Backend injoignable : bénéficiaires conservés localement (store studio).';
      }

      const dupInfo = duplicates > 0
        ? ` ${duplicates} déjà présent(s) ignoré(s) — aucun doublon créé.`
        : '';
      const photoInfo = degradedPhotos > 0
        ? ` ${degradedPhotos} photo(s) ont été compressées plus fortement pour tenir dans l'espace de stockage du poste.`
        : '';
      // Doublons réellement fusionnés : l'agent doit savoir que des lignes de
      // son fichier ont été regroupées, et lesquelles.
      const mergedInfo = merged > 0
        ? ` 🔗 ${merged} doublon(s) fusionné(s) : ${dupGroups.map((g) => `${g.nom} (${g.code})`).join(', ')}.`
        : '';
      // La stratégie de codage APPLIQUÉE est rappelée explicitement : c'est
      // l'information qui manque quand une carte ne porte pas le code
      // attendu, et elle se lit mieux que le menu déroulant.
      const strategyInfo = importCodeStrategy === 'SYSTEM'
        ? ' 🔢 Codage : matricule officiel attribué (REGION-MSD-ANNEE-SEQUENCE).'
        : ' 📄 Codage : code du FICHIER conservé tel quel.';

      // ⚠️ L'import n'est annoncé « réussi » que s'il est RÉELLEMENT
      // enregistré. Sinon on dit exactement pourquoi — et ce qui se passe
      // au rechargement de la page.
      if (!saved.ok) {
        setBulkNotice({
          type: 'error',
          text: saved.quotaExceeded
            ? `⚠️ ${fresh.length} dossier(s) affichés mais NON enregistrés : ${saved.error} Les fiches disparîtront au rechargement de la page. Réimportez par lots plus petits, ou faites porter les photos par la base de données (POST /api/beneficiaries/bulk).${serverInfo}`
            : `⚠️ ${fresh.length} dossier(s) affichés mais NON enregistrés : ${saved.error} Les fiches disparîtront au rechargement de la page.${serverInfo}`
        });
        return;
      }

      setBulkNotice({
        type: importCodeStrategy === 'SYSTEM' ? 'success' : 'warning',
        text: `✅ ${fresh.length} dossier(s) importé(s) (${totalPeople} personnes au total, photos appariées : ${matchedPhotos}).${strategyInfo}${dupInfo}${mergedInfo}${photoInfo} Lot de campagne : ${lot.code}.${serverInfo} Sélectionnez-les dans la liste pour générer leurs cartes.`
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
      // Le logo est RÉDUIT et COMPRESSÉ avant stockage : un fichier de
      // plusieurs mégaoctets est accepté, il ne reste que quelques dizaines
      // de kilo-octets en base (localStorage comme backend).
      const optimized = await readLogoFileOptimized(file);
      const dataUrl = optimized.dataUrl;
      const saved = optimized.finalBytes < optimized.originalBytes
        ? ` (${formatBytes(optimized.originalBytes)} → ${formatBytes(optimized.finalBytes)} après compression)`
        : '';
      const dims = optimized.width ? ` · ${optimized.width}×${optimized.height} px ${optimized.format}` : ' · SVG';

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
            ? `${result.warning} Logo compressé${saved} et appliqué à cette carte.`
            : `✅ Logo enregistré${saved}${dims} et appliqué automatiquement à ses ${spread} carte(s), sans sélection individuelle.`
        });
      } else {
        setCardLogo(cardCmuNumber, dataUrl);
        setCardLogoState(dataUrl);
        setSponsorNotice({
          type: 'success',
          text: `Logo personnalisé apposé sur cette carte${saved}${dims}.`
        });
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
              Chargez le fichier MSD Dakar (ex : <strong>MSD de Grand Yoff.xlsx</strong>) puis le dossier de photos.
              Les photos sont appariées automatiquement par <strong>nom, code du fichier ou téléphone</strong>.
              Les colonnes <strong>NUMERO_ADHERENT</strong> et <strong>CODE_BENEFICIAIRE</strong> ne sont pas reprises comme matricule :
              chaque assuré reçoit un <strong>code unique généré par le système</strong> (aucun doublon possible).
              Les personnes partageant une même base de code dans le fichier sont regroupées : le chef reçoit ses ayants droit.
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
              onChange={(e) => {
                const f = e.target.files && e.target.files[0];
                if (!f) return;
                // Blocage explicite : en mode « code du fichier », on exige
                // une confirmation. C'est la cause des imports répétés avec
                // des cartes restées en DKR_2600118.
                if (importCodeStrategy === 'FILE' && !printLotConfirmed) {
                  setBulkNotice({
                    type: 'error',
                    text: '⛔ Import bloqué : le codage est réglé sur « Conserver le code du fichier ». Si ce lot est DÉJÀ IMPRIMÉ, cochez la confirmation ci-dessus. Sinon, choisissez « 🆕 Attribuer un matricule officiel » — c\'est le système qui génère désormais les codes.'
                  });
                  if (excelInputRef.current) excelInputRef.current.value = '';
                  return;
                }
                handleBulkImport(f);
              }}
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

          {/* Stratégie de codage du lot — décision EXPLICITE, jamais un hasard.
              Un lot déjà imprimé doit conserver les codes de son classeur :
              les remplacer détacherait chaque fiche du PVC correspondant. */}
          <div className="mt-3">
            <label className="form-label text-sub fw-extrabold" style={{ fontSize: '0.85rem' }}>
              🔢 Codage de ce lot d'import
            </label>
            <select
              className="form-select"
              value={importCodeStrategy}
              onChange={(e) => chooseStrategy(e.target.value)}
              disabled={bulkImporting}
              style={{
                background: 'var(--bg-card-subtle)', color: 'var(--text-main)',
                border: '1.5px solid var(--border-color)', borderRadius: '14px',
                fontSize: '0.86rem', fontWeight: '700', minHeight: '46px'
              }}
            >
              <option value="FILE">📄 Conserver le code du fichier — lot DÉJÀ IMPRIMÉ</option>
              <option value="SYSTEM">🆕 Attribuer un matricule officiel — nouveau lot</option>
            </select>
            <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem', lineHeight: 1.45 }}>
              {importCodeStrategy === 'FILE'
                ? 'Le code du classeur est conservé à l’identique (ex. DKR_2600040.1) : c’est celui imprimé sur la carte.'
                : 'Le système attribue un matricule REGION-MSD-ANNEE-SEQUENCE.RANG (ex. DKR-DKR-2026-0001.1). C’est le mode à utiliser pour un nouveau lot.'}
            </small>

            {/* Confirmation obligatoire pour le mode « code du fichier ».
                C'est cette absence qui a laissé passer plusieurs imports
                produisant des cartes en DKR_2600118 au lieu du matricule
                officiel, sans le moindre signal. */}
            {importCodeStrategy === 'FILE' && (
              <label
                className="d-flex align-items-start gap-2 mt-2 p-2"
                style={{ borderRadius: '12px', background: 'rgba(180,83,9,0.10)', border: '1.5px solid #f59e0b', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={printLotConfirmed}
                  onChange={(e) => setPrintLotConfirmed(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: '700', lineHeight: 1.45 }}>
                  Je confirme que les cartes de ce lot sont DÉJÀ IMPRIMÉES et que
                  leurs codes doivent être conservés à l’identique.
                  <span className="d-block text-muted" style={{ fontWeight: '600' }}>
                    Sans cette confirmation, l’import est refusé. Pour un lot dont
                    les cartes ne sont pas encore sorties, choisissez plutôt
                    « 🆕 Attribuer un matricule officiel ».
                  </span>
                </span>
              </label>
            )}
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
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm fw-extrabold px-3.5 py-2 shadow-sm hover-lift"
                  style={{ borderRadius: '12px', fontSize: '0.82rem', background: 'rgba(180,83,9,0.12)', color: '#b45309', border: '1.5px solid #f59e0b' }}
                  title="Fusionne les fiches identiques (même code CSU ou même nom + naissance) et conserve la plus complète"
                  onClick={() => {
                    const { members: cleaned, removed } = purgeDuplicateMembers();
                    setMembers(cleaned);
                    if (removed > 0) {
                      if (cleaned.some(m => m.id === selectedMemberId)) {
                        setSelectedMemberId(cleaned[0].id);
                      }
                      setBulkNotice({
                        type: 'success',
                        text: `🧹 ${removed} doublon(s) supprimé(s) — les fiches ont été fusionnées, aucune donnée perdue.`
                      });
                    } else {
                      setBulkNotice({ type: 'info', text: '✅ Aucun doublon détecté dans le studio.' });
                    }
                  }}
                >
                  🧹 Nettoyer les doublons
                </button>
                <button
                  type="button"
                  className="btn btn-sm text-white fw-extrabold px-3.5 py-2 shadow-sm hover-lift"
                  style={{ borderRadius: '12px', fontSize: '0.82rem', background: '#059669', border: '1.5px solid #10b981' }}
                  onClick={() => {
                    // RELIRE le registre, sans jamais l'écraser.
                    //
                    // ⚠️ Ce bouton appelait resetToDefaultMembers(), qui
                    // REMPLAÇAIT tout le store par les 41 profils par
                    // défaut : les 122 fiches importées du fichier
                    // ASS LONASE disparaissaient d'un clic. « Recharger »
                    // doit.reload, pas .reset — getStoredMembers() ne fait
                    // que lire le localStorage.
                    const stored = getStoredMembers();
                    setMembers(stored);
                    if (stored.length > 0) {
                      const stillThere = stored.some((m) => m.id === selectedMemberId);
                      if (!stillThere) setSelectedMemberId(stored[0].id);
                      else setEditForm({ ...stored.find((m) => m.id === selectedMemberId) });
                    }
                    setSponsorNotice({
                      type: 'success',
                      text: `✅ ${stored.length} assuré(s) rechargé(s) depuis le registre local.`
                    });
                  }}
                >
                  🔄 Recharger les {members.length} assurés
                </button>
                <button
                  type="button"
                  className="btn btn-sm text-white fw-extrabold px-3.5 py-2 shadow-sm hover-lift"
                  style={{ borderRadius: '12px', fontSize: '0.82rem', background: '#dc2626', border: '1.5px solid #ef4444' }}
                  onClick={() => setDeleteTargets([currentMember])}
                  title="Retirer définitivement la fiche affichée (registre local et base)"
                >
                  🗑️ Supprimer la fiche affichée
                </button>
                {legacyCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm text-white fw-extrabold px-3.5 py-2 shadow-sm hover-lift"
                    style={{ borderRadius: '12px', fontSize: '0.82rem', background: '#b45309', border: '1.5px solid #f59e0b' }}
                    onClick={() => setPurgeConfirmOpen(true)}
                    disabled={deleteBusy}
                    title="Retirer toutes les fiches porteuses d'un ancien code provisoire (DKR-2600172). Un réimport les recrée au format officiel. Les cartes déjà imprimées ne sont jamais concernées."
                  >
                    🧹 Purger les {legacyCount} cartes à l'ancien code
                  </button>
                )}
              </div>
            </div>

            {/* ── FILTRE PAR LOT DE CAMPAGNE ─────────────────────────────
                Retrouver d'un coup d'œil toutes les cartes d'un même import,
                et n'agir que sur elles. */}
            <div className="studio-form-group mb-3">
              {/* Titre de la zone : agrandi, elle regroupe les actions sensibles. */}
              <label className="form-label text-sub fw-extrabold d-flex align-items-center gap-2" style={{ fontSize: '1rem' }}>
                <span>📦 Lot de campagne d'enrôlement</span>
              </label>
              <select
                className="form-select py-2.5 px-3 fw-extrabold"
                value={lotFilter}
                onChange={(e) => setLotFilter(e.target.value)}
                style={{ background: 'var(--bg-card-subtle)', color: 'var(--text-main)', border: '1.5px solid #a7f3d0', borderRadius: '14px', fontSize: '0.95rem', minHeight: '52px' }}
              >
                <option value="ALL">🌐 Tous les lots ({members.length} dossier(s))</option>
                {lotList.map(l => (
                  <option key={l.code} value={l.code}>
                    {l.code} — {l.dossiers} dossier(s) / {l.people} personne(s)
                    {l.fichiers.size ? ` · ${[...l.fichiers].join(', ')}` : ''}
                  </option>
                ))}
              </select>
              <small className="text-muted d-block mt-1" style={{ fontSize: '0.82rem' }}>
                {lotFilter === 'ALL'
                  ? 'Chaque import ouvre un lot : il indique d’où vient chaque carte.'
                  : `Lot ${lotFilter} sélectionné — seules ses fiches sont proposées ci-dessous.`}
              </small>
              {/* Purge en un clic du lot affiché : obligatoire avant un
                  réimport, sinon la déduplication saute toutes les personnes
                  déjà présentes et le fichier n'est jamais réappliqué. */}
              <button
                type="button"
                className="btn btn-sm fw-extrabold mt-2 w-100"
                style={{
                  borderRadius: '12px', fontSize: '0.92rem', color: '#fff',
                  background: '#b91c1c', border: '1.5px solid #ef4444', minHeight: '50px'
                }}
                onClick={handlePurgeVisibleLot}
                disabled={memberOptions.length === 0 || deleteBusy}
                title="Supprime toutes les fiches affichées (registre local ET base) afin de pouvoir réimporter le fichier avec les matricules officiels"
              >
                🧹 Vider {lotFilter === 'ALL' ? 'tout le registre' : `le lot ${lotFilter}`} ({memberOptions.length})
              </button>
              {lotFilter === 'ALL' && memberOptions.length > 0 && (
                <small className="d-block mt-1" style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: '700' }}>
                  ⚠️ Voulez-vous retirer les cartes DÉJÀ IMPRIMÉES ? Choisissez d’abord leur lot dans la liste ci-dessus.
                </small>
              )}

              {/* Logo appliqué à tout le lot affiché. Utilisable SANS
                  parrain enregistré : utile pour une campagne dont les cartes
                  ne sont pas encore imprimées (MSD de Grand Yoff). */}
              <input
                ref={lotLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                className="d-none"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  if (f) handleApplyLogoToVisibleLot(f);
                }}
              />
              <button
                type="button"
                className="btn btn-sm fw-extrabold mt-2 w-100"
                style={{
                  borderRadius: '12px', fontSize: '0.92rem', color: '#fff',
                  background: '#0d9488', border: '1.5px solid #14b8a6', minHeight: '50px'
                }}
                onClick={() => lotLogoInputRef.current && lotLogoInputRef.current.click()}
                disabled={memberOptions.length === 0 || sponsorLogoBusy}
                title="Applique le logo en filigrane sur toutes les cartes du lot affiché"
              >
                🏷️ Appliquer un logo à {lotFilter === 'ALL' ? 'tout le registre' : `le lot ${lotFilter}`} ({memberOptions.length})
              </button>

              {/* Bouton miroir : annule le logo du lot. Indispensable quand le
                  placement ou la taille ne conviennent pas — on ne repart pas
                  de zéro, on retire le calque et on réessaie. */}
              <button
                type="button"
                className="btn btn-sm fw-extrabold mt-2 w-100"
                style={{
                  borderRadius: '12px', fontSize: '0.92rem', color: '#fff',
                  background: '#334155', border: '1.5px solid #64748b', minHeight: '50px'
                }}
                onClick={handleRemoveLogoFromVisibleLot}
                disabled={memberOptions.length === 0 || sponsorLogoBusy}
                title="Retire le logo appliqué à ce lot et restaure les cartes d'origine"
              >
                🗑️ Retirer le logo de {lotFilter === 'ALL' ? 'tout le registre' : `ce lot`}
              </button>
            </div>

            <div className="studio-form-group mb-4">
              <label className="form-label text-sub fw-extrabold" style={{ fontSize: '0.9rem' }}>
                🏛️ Sélectionner l'adhérent MSD Dakar ({memberOptions.length} dossier(s){lotFilter === 'ALL' ? '' : ` du lot ${lotFilter}`}) :
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
                {memberOptions.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.lotCode ? `[${m.lotCode}] ` : ''}{m.firstName} {m.lastName} ({m.cmuNumber}) — {m.mutuelleOrigine}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Suppression multiple ────────────────────────────────────
                Permet de retirer plusieurs fiches d'un coup, avec un filtre
                (par exemple tous les codes d'un import erroné). */}
            <div className="studio-form-group mb-4">
              <button
                type="button"
                className="btn btn-sm fw-extrabold px-3.5 py-2 shadow-sm hover-lift"
                style={{ borderRadius: '12px', fontSize: '0.82rem', background: showMultiDelete ? '#7f1d1d' : '#b91c1c', color: '#fff', border: '1.5px solid #ef4444' }}
                onClick={() => setShowMultiDelete(v => !v)}
              >
                {showMultiDelete ? '✖️ Fermer la sélection multiple' : '🗑️ Supprimer plusieurs fiches'}
              </button>

              {showMultiDelete && (
                <div className="mt-3 p-3" style={{ background: 'var(--bg-card-subtle)', border: '1.5px solid #ef4444', borderRadius: '16px' }}>
                  <input
                    type="text"
                    className="form-control mb-2"
                    placeholder="Filtrer par nom, prénom ou code…"
                    value={multiSearch}
                    onChange={(e) => setMultiSearch(e.target.value)}
                    style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1.5px solid var(--border-color)', borderRadius: '12px' }}
                  />
                  <div className="d-flex flex-wrap gap-2 mb-2">
                    <button type="button" className="btn btn-sm fw-bold" onClick={() => setCheckedIds(new Set(multiFiltered.map(m => m.id)))}>
                      ✅ Tout cocher ({multiFiltered.length})
                    </button>
                    <button type="button" className="btn btn-sm fw-bold" onClick={() => setCheckedIds(new Set())}>
                      ⬜ Tout décocher
                    </button>
                    <span className="align-self-center fw-extrabold" style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                      {checkedIds.size} sélectionnée(s)
                    </span>
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {multiFiltered.length === 0 && (
                      <p className="mb-0" style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>Aucune fiche ne correspond à ce filtre.</p>
                    )}
                    {multiFiltered.map(m => (
                      <label
                        key={m.id}
                        className="d-flex align-items-center gap-2 px-2 py-1"
                        style={{ borderRadius: '8px', cursor: 'pointer', fontSize: '0.82rem', background: checkedIds.has(m.id) ? 'rgba(220,38,38,0.12)' : 'transparent' }}
                      >
                        <input type="checkbox" checked={checkedIds.has(m.id)} onChange={() => toggleChecked(m.id)} />
                        <span className="fw-bold">{m.firstName} {m.lastName}</span>
                        <span className="text-muted">{m.cmuNumber}</span>
                        <span className="text-muted">· {(m.dependents || []).length} ayants droit</span>
                        {m.lotCode && (
                          <span className="badge" style={{ background: 'rgba(5,150,105,0.12)', color: '#047857', fontSize: '0.62rem' }}>
                            {m.lotCode}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="d-flex flex-wrap gap-2 mt-3">
                    <button
                      type="button"
                      className="btn btn-sm text-white fw-extrabold"
                      style={{ borderRadius: '12px', fontSize: '0.82rem', background: '#0d9488', border: '1.5px solid #14b8a6' }}
                      disabled={checkedIds.size === 0 || deleteBusy}
                      title="Rattache la sélection à un lot de campagne puis la recode au format REGION-MSD-ANNEE-SEQUENCE"
                      onClick={() => handleAssignLotAndRecode(members.filter(m => checkedIds.has(m.id)))}
                    >
                      🔢 Attribuer un lot + recoder ({checkedIds.size})
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm text-white fw-extrabold"
                      style={{ borderRadius: '12px', fontSize: '0.82rem', background: '#dc2626', border: '1.5px solid #ef4444' }}
                      disabled={checkedIds.size === 0 || deleteBusy}
                      onClick={() => setDeleteTargets(members.filter(m => checkedIds.has(m.id)))}
                    >
                      🗑️ Supprimer la sélection ({checkedIds.size})
                    </button>
                  </div>
                </div>
              )}
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
                    📶 Adresse IP Wi-Fi locale de votre PC ({customWifiIp || 'non détectée'}) :
                  </label>
                  <div className="d-flex gap-2.5 mb-2 flex-wrap">
                    <input
                      type="text"
                      className="form-control fw-mono fw-bold py-2.5 px-3 flex-grow-1"
                      placeholder="ex: 192.168.1.100"
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
                      title="Relire les interfaces réseau du PC (après un changement de Wi-Fi, de routeur ou de partage de connexion)"
                      onClick={() => {
                        // force=true : on repart d'une interrogation réelle du
                        // backend, le cache pouvant venir d'un autre réseau.
                        clearLanIpCache();
                        detectLanIp({ force: true }).then((ip) => {
                          if (!ip) return;
                          setCustomWifiIp(ip);
                          localStorage.setItem('cmu-wifi-ip', ip);
                        });
                      }}
                    >
                      ⚡ Actualiser IP
                    </button>
                  </div>
                  <small className="text-muted d-block mt-1" style={{ fontSize: '0.76rem' }}>
                    {isValidLanIp(customWifiIp) ? (
                      <>💡 Votre smartphone ouvrira directement <code>http://{customWifiIp}:{typeof window !== 'undefined' && window.location.port ? window.location.port : '5173'}/#/verify/{cardData.cmuNumber}</code> lorsqu'il est connecté au même réseau Wi-Fi !</>
                    ) : (
                      <>⚠️ Aucune IP Wi-Fi exploitable détectée : le QR encodera l'adresse courante du PC, qui <strong>ne sera pas joignable depuis un téléphone</strong>. Vérifiez que le backend est démarré, cliquez sur « ⚡ Actualiser IP », ou saisissez l'IP manuellement (tapez <code>ipconfig</code> sur le PC).</>
                    )}
                  </small>
                </div>
              )}

              <div className="alert alert-warning p-3.5 mt-3.5 mb-0 rounded-4 border-0" style={{ fontSize: '0.82rem', background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', lineHeight: '1.55' }}>
                <strong>💡 Pour scanner sur Wi-Fi local :</strong>
                <div className="mt-1">
                  Vérifiez que votre PC et votre smartphone sont sur le même réseau Wi-Fi avec l'IP <strong>{isValidLanIp(customWifiIp) ? customWifiIp : 'non détectée'}</strong>. Pour scanner depuis <strong>n'importe quel réseau Wi-Fi ou en 4G/5G</strong>, utilisez le mode <strong>🌐 URL web / Tunnel</strong> ci-dessus !
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
            <label>Logo du parrain (PNG/JPEG/SVG — {Math.round(SPONSOR_LOGO_MAX_BYTES / 1024)} Ko max après compression) :</label>
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
              💾 Toute taille de fichier est acceptée : le logo est automatiquement réduit à {LOGO_MAX_DIMENSION} px et compressé avant enregistrement, afin de ne pas alourdir la base. Le message de confirmation indique le poids final.
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
              {/* FILIGRANE — logo du parrain / partenaire, posé en fond et
                  piloté par « Personnalisation complète de la carte ». C'est
                  ce calque qui remplace l'ancien picto de 20 px affiché en
                  bas de la colonne de gauche. Le contenu passe au-dessus
                  (zIndex 1) : le filigrane ne peut donc pas masquer ni la
                  photo ni les données de l'assuré. */}
              {classicWatermarkStyle && (
                <div
                  data-sponsor-watermark
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: '0',
                    pointerEvents: 'none',
                    zIndex: 0,
                    ...classicWatermarkStyle
                  }}
                />
              )}
              {cardProgram !== 'CLASSIC' ? (
                <SchoolCardFront cardData={cardData} currentUnion={currentUnion} getMsdLogo={getMsdLogo} customLogo={currentSponsorLogo || cardLogo} />
              ) : (
                // Le contenu doit se superposer au filigrane (zIndex 0). Le
                // conteneur garde EXACTEMENT la hauteur de la zone imprimable :
                // le pied de carte est en position absolue, il doit donc
                // continuer de s'ancrer au bas de la carte, pas au bas du
                // contenu (qui est plus court).
                <div style={{ position: 'relative', zIndex: 1, height: '100%' }}>
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
                <div style={{ fontSize: '0.50rem', color: '#000000', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
                  UNAMUSC SENEGAL - CARTE NATIONALE D’ASSURANCE SANTÉ
                </div>
                <div style={{ fontSize: '0.48rem', color: '#64748b', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {`DÉLIVRÉE PAR LE MSD DE ${currentUnion.region.toUpperCase()}`}
                </div>
              </div>
                </div>
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

      {/* MODALE DE SUPPRESSION (1 ou N fiches : registre local + base) */}
      <DeleteModal
        isOpen={deleteTargets.length > 0}
        title={
          deleteTargets.length === 1
            ? `${deleteTargets[0].firstName || ''} ${deleteTargets[0].lastName || ''} (${deleteTargets[0].cmuNumber || deleteTargets[0].id})`.trim()
            : `${deleteTargets.length} fiches sélectionnées`
        }
        itemType={deleteTargets.length === 1 ? 'Fiche assuré CSU' : `Lot de ${deleteTargets.length} fiches assuré`}
        onConfirm={() => { if (!deleteBusy) handleDeleteMembers(deleteTargets); }}
        onClose={() => { if (!deleteBusy) setDeleteTargets([]); }}
      />

      {/* MODALE DE PURGE — fiches à l'ancien code provisoire.
          Message volontairement explicite : la purge est massive, et
          l'agent doit comprendre qu'un réimport s'IMPOSE ensuite. */}
      <DeleteModal
        isOpen={purgeConfirmOpen && legacyList.length > 0}
        title={`${legacyCount} carte(s) au format ancien (DKR-2600172)`}
        itemType={`Purge de ${legacyList.length} dossier(s) — à remplacer par un réimport`}
        onConfirm={() => {
          if (deleteBusy) return;
          setPurgeConfirmOpen(false);
          handlePurgeLegacyCards(legacyList);
        }}
        onClose={() => { if (!deleteBusy) setPurgeConfirmOpen(false); }}
      />

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
                        <div><strong>Né(e) le / à :</strong> {qrCodePayload.birthDate}{qrCodePayload.birthPlace ? ` à ${qrCodePayload.birthPlace}` : ''}</div>
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
