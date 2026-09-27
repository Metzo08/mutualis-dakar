// Import en masse des bénéficiaires depuis un fichier Excel (format MSD Dakar)
// et appariement automatique des photos par nom / code / téléphone.

import * as XLSX from 'xlsx';

/**
 * Normalise une chaîne pour l'appariement de noms :
 * « Achille » → "achille", sans accents, sans espaces parasites.
 */
export const normalizeName = (value) =>
  (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Normalise un téléphone : "(021) 123-456" → "021123456" */
export const normalizePhone = (value) =>
  (value || '').toString().replace(/[^0-9]/g, '');

/**
 * Code bénéficiaire / adhérent canonique.
 * Le classeur MSD Dakar contient des codes stockés en texte ou en nombre
 * (« DKR_2600011.0 », « 2600011.0 ») : on retire la décimale parasite pour
 * garantir UN SEUL code par personne (sinon les cartes sont dupliquées).
 */
export const canonicalCode = (code) =>
  (code === null || code === undefined ? '' : code.toString()).trim().replace(/\.\d+$/, '');

/**
 * Convertit une date de naissance en AAAA-MM-JJ.
 * Gère : objet Date (cellDates), « 1972-01-03 », « 03/01/1972 » et la
 * SÉRIE EXCEL (« 26604 » = jours écoulés depuis le 30/12/1899), cas réel
 * du fichier « Ville de Dakar msd Dakar.xlsx ».
 * @param {Date|string|number} value
 * @returns {string} date ISO ou chaîne d'origine si non interprétable
 */
export const toIsoDate = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = value.toString().trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, d, m, y] = fr;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Série Excel : uniquement une plage de dates plausible (1900 → 2119)
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const days = Math.floor(Number(s));
    if (days > 1 && days < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + days * 86400000);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  return s;
};

/**
 * Recherche souple d'une colonne : en-têtes avec/sans accents, majuscules,
 * espaces et underscores. Retourne '' si aucune correspondance.
 */
export const pickColumn = (row, patterns) => {
  if (!row) return '';
  for (const key of Object.keys(row)) {
    const k = normalizeName(key);
    for (const p of patterns) if (k.includes(p)) return row[key];
  }
  return '';
};

/**
 * Transforme les lignes brutes d'un classeur (résultat de sheet_to_json) en
 * bénéficiaires normalisés. Fonction PURE → testable sans navigateur, et
 * utilisée à la fois par parseExcelFile() et par le Studio des cartes afin
 * qu'une seule règle de lecture existe.
 * @param {Array<object>} rawRows
 * @returns {Array<object>} bénéficiaires normalisés
 */
export const parseRowsToRecords = (rawRows) =>
  (rawRows || []).map((row) => {
    let prenom = (pickColumn(row, ['prenom', 'firstname', 'first']) || '').toString().trim();
    let nom = (pickColumn(row, ['nomfamille', 'lastname', 'nomde', 'last']) || '').toString().trim();
    // Nom complet « Achille » dans une seule colonne → découpage
    if (!prenom || !nom) {
      const complet = (pickColumn(row, ['nomcomplet', 'nom', 'fullname']) || '').toString().trim();
      if (complet) {
        const parts = complet.split(/\s+/);
        nom = nom || parts[0] || '';
        prenom = prenom || parts.slice(1).join(' ') || '';
      }
    }

    const sexeRaw = (pickColumn(row, ['sexe', 'gender']) || '').toString().trim().toUpperCase();

    return {
      codeBeneficiaire: canonicalCode(pickColumn(row, ['codebeneficiaire', 'codebenef', 'code', 'cmu'])),
      numeroAdherent: canonicalCode(pickColumn(row, ['numeroadherent', 'adherent', 'numero'])),
      prenom,
      nom,
      birthDate: toIsoDate(pickColumn(row, ['datenaissance', 'birthdate', 'birth'])),
      sexe: sexeRaw.startsWith('F') ? 'F' : sexeRaw.startsWith('M') ? 'M' : '',
      telephone: (pickColumn(row, ['telephone', 'tel', 'phone', 'portable']) || '').toString().trim(),
      address: (pickColumn(row, ['adresse', 'address', 'quartier']) || '').toString().trim(),
      schoolName: (pickColumn(row, ['ecole', 'school', 'daara', 'etablissement']) || '').toString().trim(),
      sponsorPhone: (pickColumn(row, ['sponsor', 'parrain']) || '').toString().trim(),
      mutuelleName: (pickColumn(row, ['mutuelle']) || '').toString().trim() || 'MSD Dakar',
      packageType: (pickColumn(row, ['forfait', 'package']) || '').toString().trim() || 'individuel',
      // Colonne « PHOTO » du classeur MSD Dakar : nom de fichier attendu
      photoHint: (pickColumn(row, ['photo', 'image']) || '').toString().trim(),
      status: 'active'
    };
  });

/** Ne conserve que les lignes exploitables : un nom (ou prénom) ET un code. */
export const filterValidRecords = (records) =>
  (records || []).filter((r) => (r.prenom || r.nom) && r.codeBeneficiaire);

/**
 * Lit un fichier Excel et extrait les bénéficiaires.
 * Colonnes reconnues (en-têtes souples, avec ou sans accents) :
 *  - code bénéficiaire / code / cmu / n° adherent
 *  - prénom / nom / nom complet
 *  - date de naissance (Date, JJ/MM/AAAA, ISO ou série Excel) / sexe /
 *    téléphone / adresse
 *  - école / sponsor / parrain / mutuelle / forfait / colonne PHOTO
 * @param {File} file — fichier .xlsx/.xls/.csv
 * @returns {Promise<{rows: Array, columns: string[], fileName: string}>}
 */
export const parseExcelFile = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (raw.length === 0) return { rows: [], columns: [], fileName: file.name };

  const columns = Object.keys(raw[0]);

  // Lecture normalisée — règles UNIQUES partagées avec le Studio des cartes
  // (codes canoniques « DKR_2600011.0 » → « DKR_2600011 », dates sérielles
  // Excel → ISO), pour qu'un import n'aboutisse jamais à des doublons.
  const rows = parseRowsToRecords(raw);


  return { rows, columns, fileName: file.name };
};

/**
 * Apparie les photos d'un dossier aux bénéficiaires importés :
 * correspondance par prénom normalisé, puis par téléphone, puis code.
 * @param {Array} rows — bénéficiaires extraits de l'Excel
 * @param {FileList} photoFiles — fichiers image du dossier de photos
 * @returns {Array} rows enrichis de photoUrl
 */
export const matchPhotosToRows = (rows, photoFiles) => {
  const photos = Array.from(photoFiles || []).filter((f) => f.type.startsWith('image/'));
  if (photos.length === 0) return rows;

  // Index de photos : clé normalisée du nom de fichier sans extension
  const photoIndex = photos.map((f) => {
    const base = f.name.replace(/\.[^.]+$/, '');
    return { file: f, nameNorm: normalizeName(base), phoneNorm: normalizePhone(base) };
  });

  const used = new Set();
  return rows.map((r) => {
    if (r.photoUrl) return r;
    const nameNorm = normalizeName(`${r.prenom || ''}${r.nom || ''}`);
    const firstNorm = normalizeName(r.prenom || '');
    const phoneNorm = normalizePhone(r.telephone || '');
    const codeNorm = normalizeName(canonicalCode(r.codeBeneficiaire || ''));
    const hintNorm = normalizeName((r.photoHint || '').toString().replace(/\.[^.]+$/, ''));

    // 0) colonne « PHOTO » du classeur, 1) prénom+nom, 2) prénom seul,
    // 3) téléphone, 4) code bénéficiaire
    const match =
      (hintNorm && photoIndex.find((p) => !used.has(p.file.name) && p.nameNorm === hintNorm)) ||
      photoIndex.find((p) => !used.has(p.file.name) && p.nameNorm === nameNorm) ||
      photoIndex.find((p) => !used.has(p.file.name) && firstNorm && p.nameNorm === firstNorm) ||
      photoIndex.find((p) => !used.has(p.file.name) && phoneNorm && p.phoneNorm === phoneNorm) ||
      photoIndex.find((p) => !used.has(p.file.name) && codeNorm && p.nameNorm === codeNorm);

    if (match) {
      used.add(match.file.name);
      return { ...r, photoUrl: match.file.name };
    }
    return r;
  });
};

/**
 * Pousse les bénéficiaires vers le backend (POST /api/beneficiaries/bulk).
 * ZÉRO PERTE : si la base est indisponible, le backend bascule sur son fichier
 * secours (mode "fallback-file") et le flush sera rejoué automatiquement.
 * @param {Array} rows
 * @param {string} token — access token (optionnel)
 * @returns {Promise<{success: boolean, inserted: number, total: number, mode: string, message?: string}>}
 */
export const pushBeneficiariesToServer = async (rows, token) => {
  const res = await fetch('/api/beneficiaries/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ rows })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Import refusé (${res.status}).`);
  }
  return res.json();
};

/** Hydratation : récupère les bénéficiaires du fichier secours du backend. */
export const hydrateFromServerFallback = async (token) => {
  const res = await fetch('/api/beneficiaries/fallback', {
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {})
  });
  if (!res.ok) return { success: false, records: [] };
  return res.json();
};
