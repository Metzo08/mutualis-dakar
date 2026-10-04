/**
 * Règle d'appariement photo <-> fiche bénéficiaire — version Node.
 *
 * DOIT rester strictement alignée sur `matchPhotosToRows()` de
 * src/utils/bulkImport.js (le navigateur). Toute divergence ici et là
 * produirait deux verdicts différents sur le même fichier, et l'agent
 * verrait « photo appariée » sur la carte mais « 0 photo » à l'audit.
 *
 * Deux formats de nom de fichier coexistent :
 *  • « 1.0 Adjaratou Ndeye DEME.jpeg »  (Ville de Dakar : rang + identité)
 *  • « DKR_2600040.1 PAPA IBRAHIMA SEYE.jpeg »  (ASS LONASE : code + identité)
 *
 * Le préfixe numérique « 1.0 » est le lot et le rang dans le ménage ;
 * le préfixe « DKR_2600040.1 » est le CODE BÉNÉFICIAIRE imprimé sur la carte.
 */

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

/** Minuscules, sans accents ni séparateurs. */
const normalizeName = (value) =>
  clean(value).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Chiffres uniquement. */
const normalizePhone = (value) => clean(value).replace(/[^0-9]/g, '');

/**
 * Retire le nom recopié dans le champ prénom : la fiche « MOUSTAPHA NDIONE »
 * / « NDIONE » doit pouvoir être retrouvée par « 1.0 Moustapha Ndione.jpeg ».
 */
const splitFullName = (prenom, nom) => {
  const p = clean(prenom).toUpperCase();
  const n = clean(nom).toUpperCase();
  if (!n) return { firstName: p, lastName: '' };
  if (p === n) return { firstName: p, lastName: n };
  if (p.endsWith(n)) {
    return { firstName: p.slice(0, p.length - n.length).trim(), lastName: n };
  }
  return { firstName: p, lastName: n };
};

/** Indexe les fichiers photo d'un dossier. */
const buildPhotoIndex = (names) =>
  names.map((name) => {
    const base = name.replace(/\.[^.]+$/, '');
    const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
    // Code en tête de nom : DKR_2600040.1, KLK_2600149.1, ZIG_2600155.1…
    const codeMatch = base.match(/^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/);
    return {
      name,
      base,
      personNorm: normalizeName(codeMatch ? base.slice(codeMatch[0].length) : sansRang),
      // Forme « code + suffixe » : dkr26000401 pour DKR_2600040.1
      codeNorm: codeMatch ? normalizeName(codeMatch[0]) : '',
      // Forme « code de base » : dkr2600040
      codeBaseNorm: codeMatch ? normalizeName(codeMatch[1] + codeMatch[2]) : '',
      phoneNorm: normalizePhone(base),
    };
  });

const pick = (index, used, test) => index.find((p) => !used.has(p.name) && test(p)) || null;

/**
 * Apparie chaque fiche à UN fichier photo, sans jamais réutiliser un fichier.
 * Ordre de confiance décroissant : code exact, identité exacte, identité en
 * préfixe, nom composé, prénom seul, téléphone, puis code de base.
 *
 * @param {Array<{code:string, prenom:string, nom:string, telephone?:string}>} records
 * @param {Array} index — sortie de buildPhotoIndex
 * @returns {{results: Array<{record, photo: string|null, rule: string}>, used: Set<string>}}
 */
const matchPhotos = (records, index) => {
  const used = new Set();
  const results = [];

  for (const record of records) {
    const codeNorm = normalizeName(record.code);
    const noms = splitFullName(record.prenom, record.nom);
    const nameNorm = normalizeName(`${noms.firstName}${noms.lastName}`);
    const firstNorm = normalizeName(noms.firstName);
    const lastNorm = normalizeName(noms.lastName);
    const phoneNorm = normalizePhone(record.telephone || '');

    let photo = null;
    let rule = '';

    // 1. CODE COMPLET : le nom de fichier porte le code imprimé sur la carte.
    //    C'est la règle la plus fiable — elle prime sur tout le reste.
    if (codeNorm) {
      photo = pick(index, used, (p) => p.codeNorm && p.codeNorm === codeNorm);
      if (photo) rule = 'code-complet';
    }
    // 2. Identité complète (prénom + nom), dossier Ville de Dakar.
    if (!photo && nameNorm.length >= 6) {
      photo = pick(index, used, (p) => p.personNorm && p.personNorm === nameNorm);
      if (photo) rule = 'identite-exacte';
    }
    // 3. Le nom de fichier commence par l'identité de la fiche.
    if (!photo && nameNorm.length >= 6) {
      photo = pick(index, used, (p) => p.personNorm && p.personNorm.startsWith(nameNorm));
      if (photo) rule = 'identite-prefixe';
    }
    // 4. Nom composé : le fichier porte un second prénom absent du classeur
    //    (« Adjaratou Ndeye DEME » pour ADJARATOU / DEME). On exige que le nom
    //    commence par le prénom ET finisse par le nom, et soit plus long que
    //    l'identité complète — sinon un homonyme proche serait capté.
    if (!photo && nameNorm.length >= 6 && lastNorm.length >= 2) {
      photo = pick(index, used, (p) =>
        p.personNorm &&
        p.personNorm.startsWith(firstNorm) &&
        p.personNorm.endsWith(lastNorm) &&
        p.personNorm.length > nameNorm.length);
      if (photo) rule = 'nom-compose';
    }
    // 5. La fiche porte un prénom composé absent du fichier.
    if (!photo && nameNorm.length >= 6) {
      photo = pick(index, used, (p) => p.personNorm && nameNorm.startsWith(p.personNorm) && p.personNorm.length >= 6);
      if (photo) rule = 'identite-etendue';
    }
    // 6. Prénom seul : le nom du fichier est vide ou différent.
    if (!photo) {
      photo = pick(index, used, (p) => p.personNorm && p.personNorm === firstNorm);
      if (photo) rule = 'prenom-seul';
    }
    // 7. Téléphone.
    if (!photo && phoneNorm) {
      photo = pick(index, used, (p) => p.phoneNorm && p.phoneNorm === phoneNorm);
      if (photo) rule = 'telephone';
    }
    // 8. Repli sur le code de base : le fichier MSD porte « DKR_2600011.0 »
    //    là où la fiche porte « DKR_2600011 ».
    if (!photo && codeNorm) {
      photo = pick(index, used, (p) => p.codeBaseNorm && p.codeBaseNorm === codeNorm);
      if (photo) rule = 'code-base';
    }

    if (photo) used.add(photo.name);
    results.push({ record, photo: photo ? photo.name : null, rule });
  }

  return { results, used };
};

module.exports = {
  clean,
  normalizeName,
  normalizePhone,
  splitFullName,
  buildPhotoIndex,
  matchPhotos,
};
