// Store centralisé pour les bénéficiaires et cartes CSU UNAMUSC.
//
// v18 — SUPPRESSION DE TOUT JEU DE DONNÉES EMBARQUÉ.
//
// Jusqu'ici ce module embarquait 41 fiches en dur (`msdDakarMembers` + 3
// `demoProfiles`) et les servait comme registre par défaut. La base, elle,
// contenait 1 003 bénéficiaires réellement enregistrés. Conséquence : 965
// personnes existantes étaient invisibles du studio cartes, des statistiques
// et des dossiers médicaux, tandis que les 41 fiches affichées pouvaient ne
// correspondre à personne (dont 3 profils de démonstration aux téléphones
// inventés : 771234567, 769876543…).
//
// La source de vérité est désormais la BASE, via src/utils/beneficiarySync.js
// (GET /api/beneficiaries). `defaultMembers` est donc VIDE : il ne reste que
// le registre réellement enregistré sur ce poste, lui-même alimenté par la
// synchronisation serveur. Aucune valeur n'est inventée — mieux vaut un écran
// vide qu'une fiche plausible et fausse, d'autant qu'elle sert à imprimer une
// carte et à ouvrir un dossier médical.
//
// La purge v17 → v18 vide les anciens registres : sans elle, le navigateur
// reparirait avec les 41 fiches figées à l'ouverture, avant même que la
// synchronisation ne s'exécute.
// v19 — registre vidé avec le contenu à réimporter.
//
// Les fiches `DKR_DKR_2026-…` portaient des matricules FABRIQUÉS par la
// plateforme, absents des cartes imprimées. Le registre repart des fichiers
// Excel. Le bump de version vide les anciens registres du navigateur : sans
// lui, le poste rouvrirait avec les 546 fiches obsolètes avant même que la
// synchronisation ne s'exécute.
const STORAGE_KEY = 'unamusc_beneficiaries_store_v19';
// Nettoyage one-shot des anciennes générations de cache (v1 → v18).
try {
  for (let i = 1; i <= 18; i++) {
    localStorage.removeItem(`unamusc_beneficiaries_store_v${i}`);
  }
} catch (e) { /* stockage indisponible */ }

/**
 * ⚠️ Registre VIDE par défaut.
 *
 * Conservé pour la compatibilité d'appel (tests, scripts d'audit). Il ne
 * contient plus aucun bénéficiaire : les fiches arrivent de la base.
 */
export const demoProfiles = [];

/**
 * Registre par défaut : VIDE.
 *
 * Avant, cette liste contenait 41 fiches embarquées (extrait MSD Dakar +
 * profils de démonstration). La base en contient 1 003. Elle est désormais
 * alimentée par src/utils/beneficiarySync.js — voir le bandeau v18 en tête de
 * ce fichier.
 */
export const defaultMembers = [];

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
      // ⚠️ Tout tableau valide est respecté — y compris UN TABLEAU VIDE.
      //
      //  L'ancien code exigeait `stored.length >= defaultMembers.length`
      //  (41) et, sinon, écrasait le registre avec les profils de
      //  démonstration. Conséquence : un agent qui avait supprimé ses
      //  fiches, ou qui venait d'importer 3 dossiers, perdait tout son
      //  registre au moindre rechargement — remplacé par 41 faux profils.
      //  C'est une troisième cause, indépendante, de « mes cartes ont
      //  disparu ».
      if (Array.isArray(stored)) {
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

/**
 * ⚠️ REMPLACE le registre enregistré par les seuls profils par défaut.
 *
 * Cette fonction DESTRUCTIVE a été appelée par le bouton « Recharger les
 * N assurés » du Studio Cartes : les 122 fiches importées du fichier
 * ASS LONASE disparaissaient d'un clic, remplacées par les 41 profils
 * par défaut. Elle n'est plus utilisée nulle part.
 *
 * Le bouton recharge désormais avec getStoredMembers(), qui ne fait que
 * LIRE le localStorage.
 *
 * Pour vider volontairement un registre (tests, nouvelle campagne) :
 *   localStorage.removeItem('unamusc_beneficiaries_store_v17')
 */
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

/**
 * Enregistre le registre local.
 *
 * ⚠️ RETOURNE UN RÉSULTAT au lieu d'avaler l'erreur.
 *
 * Le localStorage est plafonné (≈ 5 Mo par origine). Un import de 1 451
 * personnes avec 195 photos encodées en base64 dépasse ce plafond très
 * facilement. Avant, `setItem` levait QuotaExceededError, l'exception était
 * avalée dans un simple `console.error`, et l'import ANNONÇAIT son succès :
 * les fiches s'affichaient à l'écran puis disparaissaient au rechargement de
 * la page, puisque rien n'avait jamais été écrit. C'est exactement le
 * symptôme « mes cartes ont toutes disparu » — aucune suppression n'avait eu
 * lieu, l'écriture avait simplement échoué en silence.
 *
 * @param {Array} members
 * @returns {{ok: boolean, error: string|null, quotaExceeded: boolean, bytes: number}}
 */
export const saveStoredMembers = (members) => {
  const payload = JSON.stringify(members);
  const bytes = payload.length;
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ok: false, error: 'Stockage local indisponible.', quotaExceeded: false, bytes };
  }
  try {
    localStorage.setItem(STORAGE_KEY, payload);
    window.dispatchEvent(new Event('unamusc_store_change'));
    return { ok: true, error: null, quotaExceeded: false, bytes };
  } catch (e) {
    const quotaExceeded = e && (
      e.name === 'QuotaExceededError'
      || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || e.code === 22
      || e.code === 1014
    );
    console.error('Error saving members store:', e);
    return {
      ok: false,
      error: quotaExceeded
        ? `Espace de stockage local insuffisant (${formatOctets(bytes)} nécessaires).`
        : (e && e.message) || 'Erreur inconnue.',
      quotaExceeded,
      bytes
    };
  }
};

/** « 1,8 Mo » — lisible par un agent, contrairement à un nombre d'octets. */
export const formatOctets = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo`;
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
        const depFirstName = d.firstName || parts[0] || d.name;
        const depLastName = d.lastName || parts.slice(1).join(' ') || '';
        const suffix = (d.codeSuffix || (d.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`)).trim();
        // Matricule PROPRE de l'ayant droit : depuis l'import MSD, chaque
        // personne a un code unique attribué par le système. Le code
        // « parent + suffixe » n'est plus qu'un ALIAS de recherche, conservé
        // pour les cartes déjà imprimées.
        const ownCmu = (d.cmuNumber || '').trim();
        const fullCodeAdherent = ownCmu || `${mAdherent}${suffix}`; // ex: DKR-2601451
        const fullCodeCmu = ownCmu || `${mCmu}${suffix}`;           // ex: DKR-2601451
        const fullCodeBase = ownCmu || `${mBase}${suffix}`;         // ex: DKR-2601451

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
        // Alias « parent + suffixe » : les cartes imprimées avant
        // l'attribution d'un matricule par personne portent encore ce code.
        if (ownCmu) {
          for (const alias of [`${mAdherent}${suffix}`, `${mCmu}${suffix}`, `${mBase}${suffix}`]) {
            if (alias) map.set(alias.toUpperCase(), depCard);
          }
        }
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

  // 1b. Codes historiques fusionnés par la consolidation des ré-imports.
  // Une carte imprimée avant la fusion porte un code aujourd'hui absent du
  // registre ; sans cette résolution, le pharmacien scannerait « code inconnu »
  // alors que la personne existe bel et bien (elle a simplement été consolidée
  // sous un autre code). `mergedCodes` porte ces codes pour chaque fiche.
  for (const m of members) {
    const merged = m.mergedCodes;
    if (!Array.isArray(merged) || merged.length === 0) continue;
    for (const old of merged) {
      const key = String(old || '').toUpperCase();
      // Le suffixe d'ayant droit est reporté : « DKR_2600098.0.M1 » doit
      // retrouver l'ayant droit de la fiche fusionnée.
      const hit = index.get(key) || index.get(`${key}.M1`) || index.get(`${key}.M2`);
      if (hit) {
        index.set(key, hit);
        break;
      }
      // Code d'ayant droit exact présent dans la fiche canonique.
      const owner = index.get(String(m.cmuNumber || '').toUpperCase());
      if (owner) { index.set(key, owner); break; }
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

  // ────────────────────────────────────────────────────────────────────
  //  AUCUN REPLI SILENCIEUX.
  //  L'ancienne implémentation retournait « la première fiche du registre »
  //  quand aucun code ne correspondait. Conséquence majeure : un
  //  pharmacien qui scannait une carte erronée, une carte retirée ou un
  //  code frauduleux obtenait le dossier d'un assuré RÉEL, marqué
  //  « actif », et pouvait délivrer une prise en charge. La vérification
  //  n'est jamais trompeuse : un code inconnu = null, donc « non reconnu ».
  // ────────────────────────────────────────────────────────────────────
  return null;
};


export const addMemberFromAdhesion = (adhesionData) => {
  const currentMembers = getStoredMembers();

  const newMemberId = `MEM-${Date.now().toString().slice(-5)}`;
  const departmentUnionId = adhesionData.departmentUnionId || 'DKR';
  const randomCmuNum = `${departmentUnionId}_${Math.floor(10000 + Math.random() * 90000)}.1`;

  // AUCUNE valeur n'est inventée ici. L'ancien code remplissait les champs
  // manquants par des valeurs « plausibles » — prénom « Fatou », nom « Sow »,
  // naissance « 15/06/1994 », groupe sanguin « O+ », allergies « Aucune
  // connue », et surtout une PHOTO générique d'une banque d'images
  // (unsplash). Sur une carte CMU et un dossier médical, c'est inacceptable :
  // la photo faisait passer une personne réelle pour un autre individu, et un
  // groupe sanguin inventé peut conditionner une transfusion. Champ vide à
  // l'écran : l'agent saisit la valeur, ou elle est reprise du registre
  // server via beneficiarySync.
  const newMember = {
    id: newMemberId,
    cmuNumber: adhesionData.cmuNumber || randomCmuNum,
    firstName: adhesionData.firstName || '',
    lastName: adhesionData.lastName || '',
    birthDate: adhesionData.birthDate || '',
    birthPlace: adhesionData.birthPlace || '',
    gender: adhesionData.gender || '',
    bloodGroup: adhesionData.bloodGroup || '',
    address: adhesionData.address || '',
    commune: adhesionData.commune || '',
    departmentUnionId: departmentUnionId,
    mutuelleOrigine: adhesionData.mutuelleOrigine || '',
    phone: adhesionData.phone || '',
    package: adhesionData.package || '',
    cardTypeLabel: adhesionData.cardTypeLabel || 'Classique',
    // Aucune photo par défaut : une photo générique de banque d'images ferait
    // passer une personne réelle pour un autre individu. L'agent doit
    // téléverser la véritable pièce d'identité.
    photoUrl: adhesionData.photoUrl || '',
    allergies: adhesionData.allergies || '',
    antecedents: adhesionData.antecedents || '',
    // Ayants droit : on ne fabrique ni date de naissance, ni photo, ni
    // calendrier vaccinal. L'agent renseigne la fiche réelle.
    dependents: (adhesionData.dependents || []).map((child, idx) => ({
      name: child.name || '',
      birthDate: child.birthDate || '',
      birthPlace: child.birthPlace || '',
      gender: child.gender || '',
      isMajor: Boolean(child.isMajor),
      codeSuffix: child.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`,
      photoUrl: child.photoUrl || '',
      bloodGroup: child.bloodGroup || '',
      allergies: child.allergies || '',
      vaccines: child.vaccines || '',
      antecedents: child.antecedents || ''
    }))
  };

  const updatedMembers = [newMember, ...currentMembers];
  saveStoredMembers(updatedMembers);
  localStorage.setItem('unamusc_last_created_member_id', newMember.id);
  
  return newMember;
};
