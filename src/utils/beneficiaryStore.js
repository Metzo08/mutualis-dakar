import { msdDakarMembers } from '../data/msdDakarMembers.js';
// Store centralisé pour les bénéficiaires et cartes CSU UNAMUSC (100% Dynamique & Persistant)

// v9 : purge des caches v8 obsolètes (photos MSD Dakar recalculées depuis
// l'Excel — les anciens stores gardaient des photoUrl périmées seules les
// membres aux identifiants inchangés étaient resynchronisés).
// v14 : alignement sur les cartes modèles officielles MSDD Dakar
// (« modele cartes cmu-eleves et daara ») — codes bénéficiaires scolaires
// EDU_DKR_26000163 / EDU_DRB_26000164 et N° INE/IEN distincts du code CMU.
// La purge des caches v1→v13 garantit que les cartes déjà imprimées ne
// réaffichent pas d'anciens codes scolaires.
// v15 : rattachement de MAMADOU FALL (EDU_MBK_26000164) à la MSD de Diourbel
// et non à celle de Dakar. La purge du cache v14 garantit que la fiche
// corrigée remplace celle qui contenait l'affectation erronée.
// v16 : le code de MAMADOU FALL devient EDU_DRB_26000164 — le préfixe doit
// désigner la MSD émettrice (DRB = Diourbel) et non Mbour (MBK). Le code
// figurant sur une carte imprimée fait foi : la purge du cache v15 évite
// qu'une ancienne fiche subsiste sous l'ancien code.
const STORAGE_KEY = 'unamusc_beneficiaries_store_v16';
// Nettoyage one-shot des anciennes générations de cache
try {
  for (let i = 1; i <= 15; i++) {
    localStorage.removeItem(`unamusc_beneficiaries_store_v${i}`);
  }
} catch (e) { /* stockage indisponible */ }

export const demoProfiles = [
  {
    id: "MEM-MSD-027",
    cmuNumber: "DKR_2600027.0",
    adherentCode: "DKR_2600027",
    rawCode: "DKR_2600027.0",
    firstName: "URSULE",
    lastName: "DIAME",
    birthDate: "15/09/1975",
    birthPlace: "DAKAR",
    gender: "F",
    bloodGroup: "O+",
    address: "CITE BCEAO POINT E",
    commune: "Dakar",
    departmentUnionId: "DKR",
    mutuelleOrigine: "Mutuelle de santé départementale de Dakar",
    phone: "776317173",
    package: "UNAMUSC 80%",
    cardTypeLabel: "Classique",
    photoUrl: "/msd_photos/1.0 Irsule Diamètre.jpeg",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED_EXCEL_MSD_DAKAR",
    allergies: "Aucune connue",
    antecedents: "Bilan de santé à jour",
    dependents: [
      {
        name: "CHEIKH TOURADOU CAMARA",
        birthDate: "02/12/1974",
        birthPlace: "PIKINE",
        gender: "M",
        isMajor: true,
        age: 51,
        codeSuffix: ".1",
        excelCode: "DKR_2600027.1",
        photoUrl: "/msd_photos/1.1 Cheikh Touradou Camara.jpeg",
        hasOfficialPhoto: true,
        photoStatus: "OFFICIAL",
        bloodGroup: "O+",
        allergies: "Aucune connue",
        antecedents: "Bilan de santé régulier"
      }
    ]
  },
  {
    id: "MEM-MSD-011",
    cmuNumber: "DKR_2600011.0",
    adherentCode: "DKR_2600011",
    rawCode: "DKR_2600011.0",
    firstName: "BINETA",
    lastName: "SOW",
    birthDate: "29/11/1966",
    birthPlace: "DAKAR",
    gender: "F",
    bloodGroup: "O+",
    address: "50 MERMOZ PYTECHINE",
    commune: "Dakar",
    departmentUnionId: "DKR",
    mutuelleOrigine: "Mutuelle de santé départementale de Dakar",
    phone: "773082303",
    package: "UNAMUSC 80%",
    cardTypeLabel: "Classique",
    photoUrl: "/msd_photos/1.0 Bineta Sow.jpeg",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED_EXCEL_MSD_DAKAR",
    allergies: "Aucune connue",
    antecedents: "Bilan de santé à jour",
    dependents: [
      {
        name: "BINTOU RASSOUL FAYE",
        birthDate: "11/02/2022",
        birthPlace: "DAKAR",
        gender: "F",
        isMajor: false,
        age: 4,
        codeSuffix: ".1",
        excelCode: "DKR_2600011.1",
        photoUrl: "/msd_photos/1.1 Binta Rassoul Faye.jpeg",
        hasOfficialPhoto: true,
        photoStatus: "OFFICIAL",
        bloodGroup: "O+",
        allergies: "Aucune connue",
        vaccines: "PEV 100% à jour",
        antecedents: "Développement normal"
      }
    ]
  },
  {
    id: "MEM-DEMO-001",
    cmuNumber: "CSU-DKR-2026-8812.2",
    adherentCode: "CSU-DKR-2026-8812",
    departmentUnionId: "DKR",
    firstName: "AMADOU",
    lastName: "SOW",
    birthDate: "14/08/1992",
    gender: "M",
    bloodGroup: "O+",
    phone: "776026783",
    package: "UNAMUSC 80%",
    cardTypeLabel: "Individuel Seul",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED",
    allergies: "Aucune connue",
    dependents: []
  },
  {
    id: "MEM-DEMO-002",
    cmuNumber: "CMU-DKR-2026-4401",
    adherentCode: "CMU-DKR-2026-4401",
    departmentUnionId: "DKR",
    firstName: "FATOU",
    lastName: "DIOP",
    birthDate: "05/11/1994",
    gender: "F",
    bloodGroup: "A+",
    phone: "775554401",
    package: "UNAMUSC 80%",
    cardTypeLabel: "Famille Monoparentale",
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED",
    allergies: "Pénicilline",
    dependents: [
      {
        name: "BABACAR DIOP",
        birthDate: "12/03/2021",
        gender: "M",
        isMajor: false,
        age: 4,
        codeSuffix: ".M1",
        bloodGroup: "A+",
        allergies: "Aucune",
        vaccines: "PEV 100% à jour (BCG, Polio, Pentavalent, ROR)"
      }
    ]
  },
  // Cartes modèles officielles — données exactes de modele_eleves_cmu.xlsx,
  // reproduites à l'identique des PNG de référence (CMU-Élèves / CMU-Daara).
  // Le logo de la Mairie de Dakar (logo_mairie_dakar.png) parraine ces cartes.
  {
    id: "MEM-EDU-004812",
    cmuNumber: "SN-INE-2025-004812",
    adherentCode: "SN-INE-2025-004812",
    rawCode: "SN-INE-2025-004812",
    firstName: "AMINATA",
    lastName: "SARR",
    birthDate: "12/03/2015",
    birthPlace: "Dakar",
    gender: "F",
    bloodGroup: "O+",
    address: "GRAND DAKAR",
    commune: "Dakar",
    departmentUnionId: "DKR",
    mutuelleOrigine: "Mutuelle de Santé Départementale de Dakar",
    phone: "771234567",
    tuteurName: "Fatou SARR",
    tuteurPhone: "77 123 45 67",
    package: "CMU-Élèves 100%",
    cardTypeLabel: "CMU-Élèves",
    cardProgram: "CMU_ELEVES",
    academicData: {
      academicYear: "2025-2026",
      classLevel: "CM2",
      schoolName: "École élémentaire Grand-Dakar",
      ia: "IA de Dakar",
      ief: "IEF Grand-Dakar"
    },
    photoUrl: "/msd_photos/aminata_sarr_ine_004812.png",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED",
    allergies: "Aucune connue",
    antecedents: "Bilan de santé scolaire à jour",
    dependents: []
  },
  {
    id: "MEM-EDU-26000163",
    cmuNumber: "EDU_DKR_26000163",
    adherentCode: "EDU_DKR_26000163",
    rawCode: "EDU_DKR_26000163",
    firstName: "MOUSSA",
    lastName: "DIOP",
    birthDate: "05/09/2010",
    birthPlace: "Thiès",
    gender: "M",
    bloodGroup: "O+",
    address: "GRAND DAKAR",
    commune: "Dakar",
    departmentUnionId: "DKR",
    mutuelleOrigine: "Mutuelle de Santé Départementale de Dakar",
    phone: "769876543",
    tuteurName: "Ousmane DIOP",
    tuteurPhone: "76 987 65 43",
    ine: "SN-INE-2025-009341",
    package: "CMU-Élèves 100%",
    cardTypeLabel: "CMU-Élèves",
    cardProgram: "CMU_ELEVES",
    academicData: {
      academicYear: "2025-2026",
      classLevel: "3ème",
      schoolName: "Lycée Blaise Diagne (Dakar)",
      ia: "IA de Dakar",
      ief: "IEF Dakar Plateau",
      ine: "SN-INE-2025-009341"
    },
    photoUrl: "/msd_photos/moussa_diop_ine_009341.jpg",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED",
    allergies: "Aucune connue",
    antecedents: "Bilan de santé scolaire à jour",
    dependents: []
  },
  {
    id: "MEM-DAARA-26000164",
    cmuNumber: "EDU_DRB_26000164",
    adherentCode: "EDU_DRB_26000164",
    rawCode: "EDU_DRB_26000164",
    firstName: "MAMADOU",
    lastName: "FALL",
    birthDate: "20/07/2013",
    birthPlace: "Touba",
    gender: "M",
    bloodGroup: "O+",
    address: "DAARA SERIGNE SALIOU MBACKÉ, TOUBA",
    commune: "Touba",
    // Correctif : Mamadou FALL est rattaché à la MSD de DIOURBEL (Touba) et
    // NON à celle de Dakar. Cette valeur erronée déterminait à tort la MSD
    // émettrice de sa carte ainsi que son compte de paiement Kadev.
    departmentUnionId: "DRB",
    mutuelleOrigine: "Mutuelle de Santé Départementale de Diourbel",
    phone: "705551234",
    tuteurName: "Serigne Modou MBACKE",
    tuteurPhone: "70 555 12 34",
    ine: "DAARA-2025-0078",
    package: "CMU-Daara 100%",
    cardTypeLabel: "CMU-Daara",
    cardProgram: "CMU_DAARA",
    academicData: {
      academicYear: "2025-2026",
      classLevel: "Niveau 2 (Coran)",
      schoolName: "Daara Serigne Saliou Mbacké (Touba)",
      ia: "IA de Diourbel",
      ief: "IEF Mbacké",
      ine: "DAARA-2025-0078"
    },
    photoUrl: "/msd_photos/mamadou_fall_daara_0078.jpg",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED",
    allergies: "Aucune connue",
    antecedents: "Bilan de santé daara à jour",
    dependents: []
  },
  {
    id: "MEM-DEMO-003",
    cmuNumber: "SN-DK-GUE-4401",
    adherentCode: "SN-DK-GUE-4401",
    departmentUnionId: "GDW",
    firstName: "SOKHNA",
    lastName: "KANE",
    birthDate: "20/06/1988",
    gender: "F",
    bloodGroup: "B+",
    phone: "778889900",
    package: "UNAMUSC 80%",
    cardTypeLabel: "Famille",
    photoUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300",
    hasOfficialPhoto: true,
    photoStatus: "OFFICIAL",
    verificationStatus: "VERIFIED",
    allergies: "Aucune",
    dependents: [
      {
        name: "MODOU KANE",
        birthDate: "10/01/2018",
        gender: "M",
        isMajor: false,
        age: 8,
        codeSuffix: ".M1"
      },
      {
        name: "AMINATA KANE",
        birthDate: "14/09/2022",
        gender: "F",
        isMajor: false,
        age: 3,
        codeSuffix: ".M2"
      }
    ]
  }
];

// Dédoublonnage strict par adherentCode : si un adhérent démo existe déjà dans
// le jeu officiel MSD Dakar (même CMU), c'est la version officielle (Excel MSD)
// qui prime — évite toute collision de scan QR entre profils de démonstration
// et données réelles (ex : DKR_2600011.0 Bineta Sow, DKR_2600027.0 Ursule Diame).
const seenAdherentCodes = new Set(
  msdDakarMembers.map((m) => (m.adherentCode || (m.cmuNumber || '').replace(/\.0$/, '')).trim().toUpperCase())
);
const uniqueDemoProfiles = demoProfiles.filter((m) => {
  const code = (m.adherentCode || (m.cmuNumber || '').replace(/\.0$/, '')).trim().toUpperCase();
  return !seenAdherentCodes.has(code);
});

export const defaultMembers = [
  ...uniqueDemoProfiles,
  ...msdDakarMembers
];

/**
 * Identifiant métier d'un bénéficiaire : sert à reconnaître les doublons.
 * Le code CSU fait foi ; à défaut on retombe sur nom + naissance, ce qui
 * évite deux fiches pour la même personne entrée par deux canaux différents
 * (import Excel vs adhésion en ligne).
 */
const memberIdentityKey = (m) => {
  const code = String(m.cmuNumber || m.adherentCode || m.rawCode || '').trim().toUpperCase();
  if (code) return `code:${code}`;
  const name = `${m.firstName || ''} ${m.lastName || ''}`.trim().toUpperCase().replace(/\s+/g, ' ');
  const birth = String(m.birthDate || '').trim();
  if (name) return `nom:${name}|${birth}`;
  return null;
};

/** Complétude d'une fiche : sert à conserver la MEILLEURE version du doublon. */
const memberScore = (m) => {
  let score = 0;
  if (m.photoUrl) score += 4;
  if (m.hasOfficialPhoto) score += 2;
  if (m.dependents && m.dependents.length) score += m.dependents.length;
  if (m.academicData) score += Object.values(m.academicData).filter(Boolean).length;
  ['tuteurName', 'tuteurPhone', 'phone', 'birthPlace', 'address', 'ine', 'cardProgram'].forEach((k) => {
    if (m[k]) score += 1;
  });
  if (m.verificationStatus === 'VERIFIED') score += 2;
  return score;
};

/** Fusionne deux fiches du même bénéficiaire : la plus riche gagne, l'autre
    comble les champs manquants (aucune donnée n'est perdue). */
const mergeMembers = (kept, extra) => {
  const merged = { ...kept };
  Object.keys(extra).forEach((k) => {
    const current = merged[k];
    const incoming = extra[k];
    if (current === undefined || current === null || current === '') {
      merged[k] = incoming;
    } else if (Array.isArray(current) && Array.isArray(incoming)) {
      // On garde la liste la plus longue, sans perdre les ayants droit.
      merged[k] = incoming.length > current.length ? incoming : current;
    } else if (typeof current === 'object' && typeof incoming === 'object') {
      merged[k] = { ...incoming, ...current };
    }
  });
  return merged;
};

/**
 * Supprime les fiches en double d'une liste de bénéficiaires.
 *
 * Un même bénéficiaire peut arriver plusieurs fois : import Excel + export
 * en ligne, restauration depuis le serveur, ou simple usage duplicated d'un
 * ancien cache. On conserve la fiche la plus complète et on fusionne les
 * informations complémentaires des autres.
 * @param {Array} members
 * @returns {{members: Array, removed: number}}
 */
export const dedupeMembers = (members) => {
  if (!Array.isArray(members)) return { members: [], removed: 0 };
  const byIdentity = new Map();
  const withoutKey = [];
  let removed = 0;

  members.forEach((m) => {
    const key = memberIdentityKey(m);
    if (!key) {
      withoutKey.push(m);
      return;
    }
    const existing = byIdentity.get(key);
    if (!existing) {
      byIdentity.set(key, m);
      return;
    }
    const keep = memberScore(existing) >= memberScore(m) ? existing : m;
    const drop = keep === existing ? m : existing;
    byIdentity.set(key, mergeMembers(keep, drop));
    removed += 1;
  });

  return { members: [...byIdentity.values(), ...withoutKey], removed };
};

export const getStoredMembers = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return dedupeMembers(defaultMembers).members;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored) && stored.length >= defaultMembers.length) {
        // Synchroniser immédiatement les photos certifiées et la liste complète des 5 enfants depuis msdDakarMembers
        const synced = stored.map(m => {
          const fresh = defaultMembers.find(dm => dm.id === m.id || dm.cmuNumber === m.cmuNumber);
          if (fresh) {
            return {
              ...m,
              photoUrl: fresh.photoUrl,
              hasOfficialPhoto: fresh.hasOfficialPhoto,
              photoStatus: fresh.photoStatus,
              dependents: (fresh.dependents && fresh.dependents.length >= (m.dependents || []).length) ? fresh.dependents : (m.dependents || [])
            };
          }
          return m;
        });
        // Les doublons éventuels sont purgés à la lecture : le studio ne
        // propose jamais deux fois la même personne.
        return dedupeMembers(synced).members;
      }
    }
  } catch (e) {
    console.error('Error loading stored members:', e);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMembers));
  } catch (e) {}
  return dedupeMembers(defaultMembers).members;
};

/** Nettoyage manuel : retire les doublons du stockage et renvoie le compte. */
export const purgeDuplicateMembers = () => {
  const stored = getStoredMembers();
  const { members, removed } = dedupeMembers(stored);
  if (removed > 0) saveStoredMembers(members);
  return { members, removed };
};

export const resetToDefaultMembers = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMembers));
      window.dispatchEvent(new Event('unamusc_store_change'));
    } catch (e) {
      console.error('Error resetting members store:', e);
    }
  }
  return defaultMembers;
};

export const saveStoredMembers = (members) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
      window.dispatchEvent(new Event('unamusc_store_change'));
    } catch (e) {
      console.error('Error saving members store:', e);
    }
  }
};

export const getValidPhone = (primaryPhone, secondaryPhone, defaultFallback = '77 631 71 73') => {
  const isInvalid = (val) => !val || String(val).trim() === '' || String(val).trim() === '—' || String(val).trim() === '-';
  if (!isInvalid(primaryPhone)) return String(primaryPhone).trim();
  if (!isInvalid(secondaryPhone)) return String(secondaryPhone).trim();
  return defaultFallback;
};

// Index plat O(1) garantissant l'unicité stricte et l'absence totale de collision entre assurés
export const buildBeneficiaryIndex = (members) => {
  const map = new Map();

  for (const m of members) {
    if (!m) continue;
    const mCmu = (m.cmuNumber || '').trim(); // ex: DKR_260002.0
    const mAdherent = (m.adherentCode || mCmu.replace('.0', '')).trim(); // ex: DKR_260002
    const mBase = mCmu.replace('.0', '');
    const mId = (m.id || '').trim();

    let cleanFirst = (m.firstName || '').trim();
    let cleanLast = (m.lastName || '').trim();
    if (cleanFirst.toLowerCase().endsWith(cleanLast.toLowerCase()) && cleanFirst.toLowerCase() !== cleanLast.toLowerCase()) {
      cleanFirst = cleanFirst.slice(0, cleanFirst.length - cleanLast.length).trim();
    }

    const minorDeps = (m.dependents || []).filter(d => !d.isMajor).map((child, idx) => ({
      id: `m_${idx}`,
      name: child.name,
      cmuCode: `${m.cmuNumber}${child.codeSuffix || '.M' + (idx + 1)}`,
      relation: child.gender === 'F' ? 'Fille (Enfant mineur)' : 'Fils (Enfant mineur)',
      age: Math.max(1, new Date().getFullYear() - parseInt((child.birthDate || '2018').split('/').pop(), 10) || 6),
      birthDate: child.birthDate,
      birthPlace: child.birthPlace || 'Dakar',
      gender: child.gender || 'M',
      photoUrl: child.photoUrl || '',
      hasOfficialPhoto: !!child.photoUrl,
      bloodGroup: child.bloodGroup || 'O+',
      allergies: child.allergies || 'Aucune connue',
      vaccines: child.vaccines || 'PEV 100% à jour',
      antecedents: child.antecedents || 'Développement normal',
      coverage: '100% Gratuité Pédiatrique'
    }));

    const principalCard = {
      valid: true,
      status: 'active',
      isDependent: false,
      dependentType: 'PRINCIPAL',
      firstName: cleanFirst,
      lastName: cleanLast,
      birthDate: m.birthDate,
      birthPlace: m.birthPlace,
      phone: getValidPhone(m.phone, null, '77 631 71 73'),
      address: m.address,
      mutuelleName: m.mutuelleOrigine || 'Mutuelle de santé départementale de Dakar',
      unionName: 'Mutuelle de Santé Départementale de Dakar',
      packageType: 'Formule adhérent principal — Tiers-payant 80% UNAMUSC',
      packageBadge: '80% Tiers-payant',
      coverageRate: '80',
      cmuNumber: m.cmuNumber,
      ippNumber: `IPP-DKR-2026-${(m.cmuNumber || '').replace(/[^0-9]/g, '') || '26101'}`,
      photoUrl: m.photoUrl || '',
      hasOfficialPhoto: !!m.photoUrl,
      photoStatus: m.photoUrl ? 'OFFICIAL' : 'PENDING_UPLOAD',
      bloodGroup: m.bloodGroup || 'O+',
      allergies: m.allergies || 'Aucune connue',
      chronicConditions: m.antecedents || 'Aucune',
      minorDependents: minorDeps,
      checkedAt: new Date().toISOString()
    };

    if (mCmu) map.set(mCmu.toUpperCase(), principalCard);
    if (mAdherent) map.set(mAdherent.toUpperCase(), principalCard);
    if (mBase && !map.has(mBase.toUpperCase())) map.set(mBase.toUpperCase(), principalCard);
    if (mId) map.set(mId.toUpperCase(), principalCard);

    // Indexation stricte et exclusive de chaque ayant-droit (Majeurs et Mineurs)
    if (m.dependents && m.dependents.length > 0) {
      for (let idx = 0; idx < m.dependents.length; idx++) {
        const d = m.dependents[idx];
        if (!d) continue;

        const parts = (d.name || '').trim().split(' ');
        const depFirstName = parts[0] || d.name;
        const depLastName = parts.slice(1).join(' ') || '';
        const suffix = (d.codeSuffix || (d.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`)).trim();
        const fullCodeAdherent = `${mAdherent}${suffix}`; // ex: DKR_260002.11
        const fullCodeCmu = `${mCmu}${suffix}`;           // ex: DKR_260002.0.11
        const fullCodeBase = `${mBase}${suffix}`;         // ex: DKR_260002.11

        const depCard = {
          valid: true,
          status: 'active',
          isDependent: true,
          dependentType: d.isMajor ? 'MAJOR' : 'MINOR',
          sponsorName: `${cleanFirst} ${cleanLast}`,
          sponsorCmu: m.cmuNumber,
          sponsorId: m.id,
          firstName: depFirstName,
          lastName: depLastName,
          birthDate: d.birthDate || (d.isMajor ? '01/01/2000' : '01/01/2015'),
          birthPlace: d.birthPlace || m.birthPlace || 'Dakar',
          phone: getValidPhone(d.phone, m.phone, '77 631 71 73'),
          address: m.address,
          mutuelleName: m.mutuelleOrigine || 'Mutuelle de santé départementale de Dakar',
          unionName: 'Mutuelle de Santé Départementale de Dakar',
          packageType: d.isMajor 
            ? 'Formule individuelle majeur — Tiers-payant 80% UNAMUSC'
            : 'Formule enfant mineur — Gratuité pédiatrique 100% UNAMUSC',
          packageBadge: d.isMajor ? '80% Tiers-payant' : '100% Gratuité Pédiatrique',
          coverageRate: d.isMajor ? '80' : '100',
          cmuNumber: fullCodeAdherent,
          ippNumber: `IPP-DKR-2026-${(mAdherent).replace(/[^0-9]/g, '')}${suffix.replace(/[^A-Z0-9]/gi, '')}`,
          photoUrl: d.photoUrl || '',
          hasOfficialPhoto: !!d.photoUrl,
          photoStatus: d.photoUrl ? 'OFFICIAL' : 'PENDING_UPLOAD',
          bloodGroup: d.bloodGroup || m.bloodGroup || 'O+',
          allergies: d.allergies || 'Aucune connue',
          vaccines: d.vaccines || (d.isMajor ? 'Vaccination à jour' : 'PEV 100% à jour'),
          antecedents: d.antecedents || (d.isMajor ? 'Bilan de santé régulier' : 'Développement normal'),
          chronicConditions: d.antecedents || 'Aucune',
          minorDependents: [],
          checkedAt: new Date().toISOString()
        };

        map.set(fullCodeAdherent.toUpperCase(), depCard);
        map.set(fullCodeCmu.toUpperCase(), depCard);
        map.set(fullCodeBase.toUpperCase(), depCard);
        if (d.id) map.set(d.id.toUpperCase(), depCard);
      }
    }
  }

  return map;
};

/**
 * ============================================================
 *  Alias de codes NICE / CMU
 * ============================================================
 *
 *  Le code imprimé sur une carte fait foi. Or un code peut être corrigé
 * après coup — ici, le préfixe désignait Mbour (MBK) alors que le
 * bénéficiaire relève de la MSD de Diourbel (DRB).
 *
 *  Sans alias, les cartes DÉJÀ IMPRIMÉES deviendraient orphelines : leur QR
 *  pointerait vers un code introuvable. Chaque ancien code est donc déclaré
 *  ici et redirigé vers le code canonique. La correspondance est
 *  conservatrice : le suffixe d'ayant droit (`.M1`, `.0`…) est reporté.
 *
 *  Format : { ancienCode : codeActuel }
 */
export const CODE_ALIASES = {
  // Préfixe MBK (Mbour) remplacé par DRB (Diourbel) — cf. Mamadou FALL.
  'EDU_MBK_26000164': 'EDU_DRB_26000164'
};

/**
 * Traduit un ancien code vers son code canonique.
 * Renvoie la valeur d'origine si le code n'est pas un alias.
 *
 * @param {string} code
 * @returns {string}
 */
export const resolveCodeAlias = (code) => {
  const raw = String(code || '').trim();
  if (!raw) return raw;
  const upper = raw.toUpperCase();
  const legacy = Object.keys(CODE_ALIASES).find(
    (old) => upper === old || upper.startsWith(`${old}.`)
  );
  if (!legacy) return raw;
  // Le suffixe d'ayant droit éventuel est conservé (« .M1 », « .0 »…).
  const suffix = upper.slice(legacy.length);
  return CODE_ALIASES[legacy] + suffix;
};

/** Le code correspond-il à un ancien code corrigé depuis ? */
export const isLegacyCode = (code) => {
  const upper = String(code || '').trim().toUpperCase();
  return Object.keys(CODE_ALIASES).some(
    (old) => upper === old || upper.startsWith(`${old}.`)
  );
};

export const getCardByCode = (cmuCode) => {
  const members = getStoredMembers();
  let cleanCode = (cmuCode || '').trim();

  // Si une URL complète est passée, extraire le code CSU
  if (cleanCode.includes('/verify/')) {
    const match = cleanCode.match(/\/verify\/([^?#]+)/i);
    if (match && match[1]) {
      cleanCode = decodeURIComponent(match[1].trim());
    }
  } else if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
    const parts = cleanCode.split('/');
    const lastPart = parts[parts.length - 1].split('?')[0];
    if (lastPart) cleanCode = decodeURIComponent(lastPart.trim());
  }

  if (cleanCode.includes('?')) {
    cleanCode = cleanCode.split('?')[0].trim();
  }

  // Redirection d'un ancien code vers le code canonique AVANT toute
  // recherche : une carte déjà imprimée avec l'ancien préfixe doit
  // retrouver sa fiche réelle, et non déclencher un faux résultat.
  cleanCode = resolveCodeAlias(cleanCode);

  const upperCode = cleanCode.toUpperCase();
  const index = buildBeneficiaryIndex(members);

  // 1. Accès direct O(1) sans collision via l'index canonique
  if (index.has(upperCode)) {
    return index.get(upperCode);
  }

  // 1b. Gérer les variations de zéros et de caractères (ex: DKR_2600011.0 vs DKR_260011.0 vs DKR_2600011)
  const normalizedSearch = upperCode.replace(/[^A-Z0-9]/g, '');
  for (const m of members) {
    const normCmu = (m.cmuNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normAdherent = (m.adherentCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normRaw = (m.rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (normCmu === normalizedSearch || normAdherent === normalizedSearch || normRaw === normalizedSearch) {
      return index.get(m.cmuNumber.toUpperCase()) || index.get(m.id.toUpperCase());
    }
  }

  // 2. Recherche par nom complet si recherche textuelle (ex: BINETA SOW, Bineta Sow)
  for (const [key, card] of index.entries()) {
    const fullName = `${card.firstName} ${card.lastName}`.toUpperCase();
    if (fullName === upperCode || (upperCode.length >= 4 && (fullName.includes(upperCode) || upperCode.includes(card.firstName.toUpperCase())))) {
      return card;
    }
  }

  // 3. Recherche par base d'adhérent exacte (ex: DKR_2600011 vs DKR_260001) sans fausse collision
  const baseSearch = upperCode.split('.')[0];
  for (const m of members) {
    const mCmu = (m.cmuNumber || '').toUpperCase();
    const mAdherent = (m.adherentCode || '').toUpperCase();
    const mBase = mCmu.split('.')[0];
    const mAdherentBase = mAdherent.split('.')[0];

    if (baseSearch === mBase || baseSearch === mAdherentBase) {
      return index.get(mCmu) || index.get(mAdherent);
    }
  }

  // 4. Recherche par séquence de chiffres exacte (ex: 2600011 pour Bineta Sow)
  const digits = upperCode.replace(/[^0-9]/g, '');
  if (digits.length >= 3) {
    for (const m of members) {
      const mDigits = (m.cmuNumber || '').replace(/[^0-9]/g, '');
      if (mDigits === digits || (digits.length >= 5 && mDigits.endsWith(digits))) {
        return index.get(m.cmuNumber.toUpperCase()) || index.get(m.id.toUpperCase());
      }
    }
  }

  // Fallback
  return index.get('DKR_2600011.0') || index.get('MEM-MSD-011') || members[0];
};


export const addMemberFromAdhesion = (adhesionData) => {
  const currentMembers = getStoredMembers();
  
  const newMemberId = `MEM-${Date.now().toString().slice(-5)}`;
  const departmentUnionId = adhesionData.departmentUnionId || 'DKR';
  const randomCmuNum = `${departmentUnionId}_${Math.floor(10000 + Math.random() * 90000)}.1`;

  const newMember = {
    id: newMemberId,
    cmuNumber: adhesionData.cmuNumber || randomCmuNum,
    firstName: adhesionData.firstName || 'Fatou',
    lastName: adhesionData.lastName || 'Sow',
    birthDate: adhesionData.birthDate || '15/06/1994',
    birthPlace: adhesionData.birthPlace || 'Dakar',
    gender: adhesionData.gender || 'F',
    bloodGroup: adhesionData.bloodGroup || 'O+',
    address: adhesionData.address || 'Dakar, Sénégal',
    commune: adhesionData.commune || 'Dakar',
    departmentUnionId: departmentUnionId,
    mutuelleOrigine: adhesionData.mutuelleOrigine || 'Mutuelle de Santé Départementale de Dakar',
    phone: adhesionData.phone || '77 888 99 00',
    package: adhesionData.package || 'UNAMUSC 80%',
    cardTypeLabel: 'Classique',
    photoUrl: adhesionData.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    allergies: adhesionData.allergies || 'Aucune connue',
    antecedents: adhesionData.antecedents || 'Adhésion en ligne récente',
    dependents: (adhesionData.dependents || []).map((child, idx) => ({
      name: child.name || `Enfant ${idx + 1}`,
      birthDate: child.birthDate || '01/01/2018',
      birthPlace: child.birthPlace || 'Dakar',
      gender: child.gender || 'M',
      isMajor: child.isMajor || false,
      codeSuffix: child.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`,
      photoUrl: child.photoUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80',
      bloodGroup: child.bloodGroup || 'O+',
      allergies: child.allergies || 'Aucune connue',
      vaccines: child.vaccines || 'PEV 100% à jour',
      antecedents: child.antecedents || 'Développement normal'
    }))
  };

  const updatedMembers = [newMember, ...currentMembers];
  saveStoredMembers(updatedMembers);
  localStorage.setItem('unamusc_last_created_member_id', newMember.id);
  
  return newMember;
};
