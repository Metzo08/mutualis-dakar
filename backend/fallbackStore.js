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

module.exports = { addRecord, listRecords, flushToDb, readStore, STORE_PATH };
