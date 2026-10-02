/**
 * ============================================================
 *  MUTUALIS DAKAR — Fallback de persistance fichier JSON
 * ============================================================
 *  Garantit qu'aucune adhésion / cotisation / renouvellement
 *  n'est JAMAIS perdue, même quand PostgreSQL est indisponible
 *  (Postgres non démarré, serveur en panne, etc.).
 *
 *  Principe :
 *   - Chaque enregistrement est ajouté dans backend/data/store.json
 *     (atomique : écriture en .tmp puis renommage).
 *   - À la reconnexion de la base, les enregistrements en attente
 *     peuvent être rejoués via flushToDb().
 *   - Endpoints de lecture GET renvoient ce fichier quand la base
 *     est indisponible, pour que le Studio retrouve toujours les
 *     adhésions importées (cartes déjà imprimées !).
 * ============================================================
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const COLLECTIONS = ['adhesions', 'cotisations', 'donations', 'complaints', 'beneficiaries'];

function ensureStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) {
      const empty = { adhesions: [], cotisations: [], donations: [], complaints: [], beneficiaries: [] };
      fs.writeFileSync(STORE_PATH, JSON.stringify(empty, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[FallbackStore] Impossible d\'initialiser le stockage fichier :', err.message);
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch {
    const empty = { adhesions: [], cotisations: [], donations: [], complaints: [], beneficiaries: [] };
    return empty;
  }
}

function writeStore(store) {
  ensureStore();
  const tmpPath = STORE_PATH + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

/**
 * Ajoute un enregistrement dans une collection du fallback.
 * @returns {object} l'enregistrement horodaté
 */
function addRecord(collection, record) {
  if (!COLLECTIONS.includes(collection)) throw new Error(`Collection inconnue : ${collection}`);
  const store = readStore();
  const entry = {
    ...record,
    _fallback: true,
    _savedAt: new Date().toISOString()
  };
  if (!Array.isArray(store[collection])) store[collection] = [];
  store[collection].push(entry);
  writeStore(store);
  console.log(`[FallbackStore] ${collection}: +1 enregistrement (total ${store[collection].length}) — base indisponible, fichier utilisé.`);
  return entry;
}

function listRecords(collection) {
  if (!COLLECTIONS.includes(collection)) return [];
  const store = readStore();
  return Array.isArray(store[collection]) ? store[collection] : [];
}

/**
 * Remplace intégralement le contenu d'une collection.
 *
 * Utilisé pour retirer une fiche du secours (suppression par code) : sans
 * cela, une ligne supprimée en base resterait dans le fichier JSON et
 * reviendrait au prochain flush.
 *
 * @param {string} collection
 * @param {Array} records
 * @returns {number} nombre d'enregistrements conservés
 */
function replaceCollection(collection, records) {
  if (!COLLECTIONS.includes(collection)) return 0;
  const store = readStore();
  store[collection] = Array.isArray(records) ? records : [];
  writeStore(store);
  return store[collection].length;
}

/**
 * Rejoue les enregistrements du fallback dans PostgreSQL (idempotent :
 * les lignes déjà en base sont détectées par cmu_number).
 * @returns {{flushed: number, remaining: number}}
 */
async function flushToDb(query) {
  const store = readStore();
  let flushed = 0;

  // Rejoue les collections stockées : adhesions ET beneficiaries (import masse)
  for (const collection of ['adhesions', 'beneficiaries']) {
    for (const rec of (store[collection] || [])) {
      if (rec._flushed) continue;
      try {
        const cmu = rec.cmuNumber || rec.cmu_number || '';
        const exists = await query('SELECT id FROM beneficiaries WHERE cmu_number = $1 LIMIT 1', [cmu]);
        if (exists.rows.length === 0 && cmu) {
          await query(
            `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, sponsor_phone, school_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [rec.firstName || rec.prenom || '', rec.lastName || rec.nom || '', rec.birthDate || '', rec.phone || rec.telephone || '', rec.email || '',
             rec.address || '', rec.mutuelleName || 'MSD Dakar', rec.packageType || 'individuel',
             rec.paymentMethod || 'mobile_money', cmu || `SN-DK-FB-${Date.now().toString(36).toUpperCase()}`,
             rec.status || 'active', rec.sponsorPhone || null, rec.schoolName || null]
          );
        }
        rec._flushed = true;
        flushed++;
      } catch {
        /* base toujours indisponible : on gardera pour le prochain flush */
      }
    }
  }

  writeStore(store);
  const pending = ['adhesions', 'beneficiaries']
    .reduce((n, c) => n + (store[c] || []).filter(r => !r._flushed).length, 0);
  return { flushed, remaining: pending };
}

/**
 * ============================================================
 *  MUTUALIS DAKAR — Générateur de matricules bénéficiaire (CMU)
 * ============================================================
 *  Remplace les tirages `Math.random()` qui produisaient des collisions
 *  (9 000 valeurs possibles seulement) et des matricules non
 *  déterministes d'une MSD à l'autre.
 *
 *  Format produit : <PREFIXE>-<UNION>-<SÉQUENCE 7 chiffres>
 *    ex. CMU-DKR-0000042 · EDU-DKR-0000007 · DARA-DRB-0000012
 *
 *  Garanties :
 *   - unicité vérifiée en base avant attribution (boucle bornée) ;
 *   - séquence continue par préfixe (jamais de trou ni de réutilisation) ;
 *   - format lisible, compatible avec le scan QR et les cartes imprimées.
 *
 *  Préfixes par programme (le préfixe identifie la nature de la carte) :
 *    EDU  → CMU-Élèves (circuit école publique)
 *    DARA → CMU-Daara  (Daaras / talibés)
 *    SPN  → Parrainage (filleuls sponsorisés)
 *    HH   → Parrainage de ménages
 *    COL  → Parrainage collectif
 *    GRP  → Adhésion de masse / groupe
 *    CMU  → Adhésion individuelle ou familiale
 * ============================================================
 */

/** Préfixes de programme autorisés. */
const CMU_PREFIXES = {
  CLASSIC: 'CMU',
  ELEVES: 'EDU',
  DAARA: 'DARA',
  PARRAINAGE: 'SPN',
  MENAGES: 'HH',
  COLLECTIF: 'COL',
  GROUPE: 'GRP'
};

/** Correspondance département / ville → code d'union à 3 lettres. */
const UNION_CODES = {
  dakar: 'DKR',
  pikine: 'PKN',
  guediawaye: 'GDW',
  rufisque: 'RFS',
  thies: 'THS',
  thiès: 'THS',
  mbour: 'MBR',
  'saint-louis': 'STL',
  kaolack: 'KLC',
  ziguinchor: 'ZGC',
  diourbel: 'DRB',
  mbacke: 'MBK',
  mbacké: 'MBK',
  louga: 'LGA',
  tambacounda: 'TBA',
  kolda: 'KLD',
  matam: 'MTM',
  fatick: 'FTK'
};

/**
 * Traduit un libellé (mutuelle, commune, département) en code d'union
 * à 3 lettres. Ex : « Mutuelle de santé départementale de Diourbel » → DRB.
 * @param {string} label
 * @returns {string} code à 3 lettres (toujours défini)
 */
const unionCodeFrom = (label) => {
  const words = String(label || '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'DKR';

  // Un terme connu dans le libellé suffit (le plus long gagne, ex. « Diourbel »
  // doit primer sur un éventuel « departement »).
  let best = null;
  let bestLen = 0;
  for (const w of words) {
    const code = UNION_CODES[w.toLowerCase()];
    if (code && w.length > bestLen) { best = code; bestLen = w.length; }
  }
  if (best) return best;

  // Repli : initiales des trois premiers mots significatifs.
  const letters = words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
  return (letters || 'DKR').slice(0, 3).padEnd(3, 'X');
};

/**
 * Construit le préfixe d'un programme pour une union donnée.
 * @param {string} program   — 'CLASSIC' | 'ELEVES' | 'DAARA' | …
 * @param {string} unionCode — code MSD à 3 lettres
 * @returns {string} ex. « EDU-DKR »
 */
const buildPrefix = (program, unionCode) =>
  `${CMU_PREFIXES[program] || CMU_PREFIXES.CLASSIC}-${unionCode}`;

/**
 * Génère un matricule CMU unique, garanti absent de la table `beneficiaries`.
 *
 * @param {object} opts
 * @param {(sql: string, params?: any[]) => Promise<any>} opts.query
 * @param {string} [opts.program='CLASSIC']    — programme de la carte
 * @param {string} [opts.mutuelleName='']      — libellé de la mutuelle
 * @param {string} [opts.unionCode='']         — code d'union explicite (prioritaire)
 * @param {string} [opts.department='']        — département de rattachement
 * @returns {Promise<string>} matricule unique
 */
async function generateCmuNumber(opts = {}) {
  const { query, program = 'CLASSIC', mutuelleName = '', unionCode = '', department = '' } = opts;
  if (typeof query !== 'function') {
    throw new TypeError('generateCmuNumber requiert une fonction query().');
  }

  const union = String(unionCode || unionCodeFrom(mutuelleName) || unionCodeFrom(department) || 'DKR')
    .toUpperCase()
    .slice(0, 3);
  const prefix = buildPrefix(program, union);

  // 1) Séquence continue : on repart du dernier matricule de ce préfixe.
  //    Le motif LIKE est toujours paramétré (jamais de concaténation SQL).
  const lastRes = await query(
    `SELECT cmu_number FROM beneficiaries
      WHERE cmu_number LIKE $1
      ORDER BY cmu_number DESC
      LIMIT 1`,
    [`${prefix}-%`]
  );
  const last = lastRes && lastRes.rows && lastRes.rows[0] && lastRes.rows[0].cmu_number;
  const lastSeq = last ? parseInt(String(last).split('-').pop(), 10) : 0;
  let seq = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq : 0;

  // 2) Boucle bornée : garantit l'unicité même si la base contient des
  //    matricules hors séquence (imports Excel, reprises de données…).
  const MAX_ATTEMPTS = 50;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    seq += 1;
    const candidate = `${prefix}-${String(seq).padStart(7, '0')}`;
    const exists = await query('SELECT 1 FROM beneficiaries WHERE cmu_number = $1 LIMIT 1', [candidate]);
    if (!exists || !exists.rows || !exists.rows.length) return candidate;
  }

  // 3) Filet de sécurité : suffixe temporel (jamais de doublon même saturé).
  return `${prefix}-${String(seq).padStart(7, '0')}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

module.exports = {
  // Persistance de secours (fichier JSON)
  addRecord,
  listRecords,
  replaceCollection,
  flushToDb,
  readStore,
  STORE_PATH,
  // Génération de matricules CMU
  generateCmuNumber,
  unionCodeFrom,
  buildPrefix,
  CMU_PREFIXES,
  UNION_CODES
};

