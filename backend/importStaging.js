/**
 * importStaging.js — Zone temporaire d'importation (Module 2 du cahier des
 * charges) : « aucune donnée ne doit être intégrée aux tables opérationnelles
 * avant la prévisualisation et la validation ».
 *
 * CYCLE DE VIE D'UN LOT D'IMPORT
 *   BROUILLON    lot créé, fichiers reçus            → contrôles automatiques
 *   A_CONTROLE   contrôles lancés                    → prévisualisation
 *   A_CORRIGER   au moins un dossier non conforme    → correction manuelle
 *   VALIDE       tous les dossiers conformes         → intégration autorisée
 *   PARTIEL      certains dossiers rejetés           → intégration des conformes
 *   INTEGRE      intégration effectuée (idempotente)
 *   ANNULE       abandonné, rien n'a été intégré
 *
 * RÈGLES APPLIQUÉES
 *   • Un dossier ne devient intégré QUE s'il est conforme. Les autres restent
 *     dans la zone temporaire jusqu'à correction (§2.2).
 *   • L'intégration est IDEMPOTENTE : un dossier déjà intégré n'est jamais
 *     réintégré (status INTEGRE), et la réintégration d'un lot rejoue
 *     uniquement les dossiers devenus conformes.
 *   • Les conflits avec les assurés existants (matricule ou NIN déjà pris par
 *     une AUTRE fiche) sont détectés à la prévisualisation, pas à l'écriture.
 *   • Les photos sont associées par une CLÉ STABLE : le matricule en tête du
 *     nom de fichier d'abord, jamais le seul nom/prénom (§2.2). Une photo qui
 *     correspondrait à deux dossiers est déclarée AMBIGUË, pas attribuée.
 *   • Aucune donnée personnelle inutile dans les journaux : les actions sont
 *     tracées par référence de lot, pas par contenu de dossier.
 */

const crypto = require('crypto');
const { query } = require('./db');
const { normalizeRole } = require('./rbac');

/** Statuts de dossier et de lot — source unique (routes, UI, exports). */
const LOT_STATUS = ['BROUILLON', 'A_CONTROLE', 'A_CORRIGER', 'VALIDE', 'PARTIEL', 'INTEGRE', 'ANNULE'];
const ROW_STATUS = ['CONFORME', 'A_CORRIGER', 'CONFLIT', 'REJETE', 'INTEGRE'];

const ANOMALY_TYPES = [
  'CHAMP_OBLIGATOIRE_MANQUANT',
  'IDENTIFIANT_INVALIDE',
  'DOUBLON_LOT',
  'DOUBLON_REGISTRE',
  'PHOTO_MANQUANTE',
  'PHOTO_AMBIGUE',
  'CONFLIT_MSD',
  'CONFLIT_IDENTITE',
  'FICHIER_INVALIDE',
];

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (v) => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** MSD de l'acteur — null (Super Admin), code, ou undefined (fail-closed). */
function scopeOf(user) {
  if (!user) return undefined;
  if (normalizeRole(user.role) === 'admin') return null;
  return user.msdCode ? String(user.msdCode).toUpperCase() : undefined;
}

/** MSD exprimée par un matricule (CMU-DKR-0000001, DKR_2600040.1, DKR-DKR-2026-0001). */
function msdOfCode(code) {
  const m = /^(?:(?:CMU|EDU|DARA|SPN|HH|COL|GRP)-)?([A-Z]{3})[-_.]/i.exec(clean(code).toUpperCase());
  return m ? m[1] : null;
}

/** Longueur maximale d'une photo (base64) acceptée par l'API d'aperçu. */
const MAX_PHOTO_CHARS = 400000; // ≈ 300 Ko

// ── Schéma (migration douce, idempotente) ────────────────────────────────────
async function ensureImportSchema() {
  await query(`CREATE TABLE IF NOT EXISTS import_batches (
    id SERIAL PRIMARY KEY,
    reference VARCHAR(40) UNIQUE NOT NULL,
    msd_code VARCHAR(10),
    lot_code VARCHAR(32),
    source_file VARCHAR(255),
    photo_count INTEGER NOT NULL DEFAULT 0,
    row_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'BROUILLON',
    created_by VARCHAR(100) NOT NULL,
    created_by_role VARCHAR(30),
    validated_by VARCHAR(100),
    validated_at TIMESTAMP,
    integrated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await query(`CREATE TABLE IF NOT EXISTS import_batch_rows (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    line_number INTEGER,
    cmu_number VARCHAR(60),
    first_name VARCHAR(150),
    last_name VARCHAR(150),
    nin VARCHAR(60),
    phone VARCHAR(40),
    birth_date VARCHAR(40),
    gender VARCHAR(10),
    address VARCHAR(255),
    photo_key VARCHAR(255),
    photo_data TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'A_CORRIGER',
    anomalies JSONB NOT NULL DEFAULT '[]'::jsonb,
    integrated_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await query('CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON import_batch_rows(batch_id, line_number)').catch(() => {});
  await query('CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status, created_at DESC)').catch(() => {});
}

/** Référence de lot lisible : IMP-AAAAMMJJ-HHMMSS-xxxx. */
function batchReference() {
  const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  return `IMP-${stamp}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/**
 * Extrait la clé de photo d'un nom de fichier.
 * « DKR_2600040.1 PAPA IBRAHIMA SEYE.jpg » → clé code « DKR_2600040 »
 * et clé nom « papa ibrahima seye ». Le CODE prime (imprimé sur la carte).
 */
function photoKeys(fileName) {
  const base = clean(fileName).replace(/\.[^.]+$/, '');
  const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
  const struct = /^([A-Za-z]{3}-[A-Za-z]{3}-\d{4}-\d{4})(\.\d+)?/.exec(sansRang)
    || /^([A-Za-z]{3}-[A-Za-z]{3}-\d{4}-\d{4})(\.\d+)?/.exec(base);
  const classic = /^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/.exec(sansRang)
    || /^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/.exec(base);
  let codeFull = '';
  let codeBase = '';
  let rest = sansRang;
  if (struct) {
    codeFull = norm(struct[1]);
    codeBase = norm(struct[1]);
    rest = sansRang.slice(struct[0].length);
  } else if (classic) {
    codeFull = norm(classic[1] + classic[2]);
    codeBase = codeFull;
    rest = sansRang.slice(classic[0].length);
  }
  return {
    fileName,
    codeFull,
    codeBase,
    personNorm: norm(rest),
    nameNorm: norm(sansRang),
  };
}

/** Clé canonique d'un matricule (sans suffixe d'ayant droit). */
function canonicalCmu(code) {
  return norm(clean(code).replace(/\.\d+$/, ''));
}

/**
 * Contrôle automatique d'un dossier (Module 2.2). Fonction PURE : aucun accès
 * base — les conflits externes sont ajoutés par `runControls`.
 * @returns {string[]} anomalies
 */
function inspectRow(row, ctx = {}) {
  const anomalies = [];
  const add = (type, correction) => anomalies.push({ type, correction });
  if (!clean(row.cmuNumber)) add('CHAMP_OBLIGATOIRE_MANQUANT', 'Renseigner le matricule (colonne code bénéficiaire).');
  else if (clean(row.cmuNumber).length < 6) add('IDENTIFIANT_INVALIDE', 'Matricule trop court : vérifier le code du fichier source.');
  if (!clean(row.lastName)) add('CHAMP_OBLIGATOIRE_MANQUANT', 'Renseigner le nom.');
  if (!clean(row.firstName)) add('CHAMP_OBLIGATOIRE_MANQUANT', 'Renseigner le prénom.');
  if (clean(row.birthDate) && !/^\d{4}-\d{2}-\d{2}$/.test(clean(row.birthDate))) {
    add('IDENTIFIANT_INVALIDE', 'Date de naissance invalide (format attendu AAAA-MM-JJ).');
  }
  if (!clean(row.photoKey) && !clean(row.photoData)) add('PHOTO_MANQUANTE', 'Fournir une photo nommée avec le matricule du dossier.');
  if (row.photoAmbiguous) add('PHOTO_AMBIGUE', 'Plusieurs photos correspondent : choisir explicitement la bonne photo.');
  if (ctx.effectif > 1) add('DOUBLON_LOT', 'Matricule présent plusieurs fois dans le lot : fusionner ou corriger.');
  if (!row.msdCode && ctx.agentMsd) add('CONFLIT_MSD', `Rattacher le dossier à la MSD ${ctx.agentMsd}.`);
  return anomalies;
}

/** Statut d'un lot à partir des compteurs de dossiers. */
function lotStatusFor(conformes, nonConformes) {
  if (conformes > 0 && nonConformes === 0) return 'VALIDE';
  return 'A_CORRIGER';
}

/**
 * Contrôle un lot COMPLET : doublons internes, photos ambiguës, conflits avec
 * le registre existant (matricule ou NIN appartenant à une autre fiche).
 */
async function runControls(batchId, user) {
  const scope = scopeOf(user);
  if (scope === undefined) return { ok: false, error: 403, message: "Votre compte n'est rattaché à aucune MSD." };
  const batch = await getBatch(batchId, user);
  if (!batch) return { ok: false, error: 404, message: 'Lot d\'import introuvable.' };

  const rowsRes = await query(
    `SELECT * FROM import_batch_rows WHERE batch_id = $1 ORDER BY line_number, id`,
    [batchId]
  );
  const rows = rowsRes.rows || [];

  // Doublons internes (matricule canonique OU même nom complet).
  const byCmu = new Map();
  const byIdentity = new Map();
  for (const r of rows) {
    const key = canonicalCmu(r.cmu_number);
    if (key) byCmu.set(key, (byCmu.get(key) || 0) + 1);
    const idKey = `${norm(r.last_name)}|${norm(r.first_name)}|${clean(r.birth_date)}`;
    if (norm(r.last_name) && norm(r.first_name)) byIdentity.set(idKey, (byIdentity.get(idKey) || 0) + 1);
  }

  // Photos : une même clé de photo utilisée pour deux lignes = ambiguïté.
  const byPhoto = new Map();
  for (const r of rows) {
    if (r.photo_key) byPhoto.set(r.photo_key, (byPhoto.get(r.photo_key) || 0) + 1);
  }

  // Conflits externes : une requête pour tous les matricules + NIN du lot.
  const cmus = [...new Set(rows.map((r) => clean(r.cmu_number)).filter(Boolean))];
  const nins = [...new Set(rows.map((r) => clean(r.nin)).filter(Boolean))];
  let existing = [];
  if (cmus.length || nins.length) {
    const exRes = await query(
      `SELECT cmu_number, nin, first_name, last_name, msd_code, merged_into
         FROM beneficiaries
        WHERE cmu_number = ANY($1::text[]) OR nin = ANY($2::text[])`,
      [cmus, nins]
    ).catch(() => ({ rows: [] }));
    existing = exRes.rows || [];
  }
  const existingByCmu = new Map(existing.map((e) => [clean(e.cmu_number).toUpperCase(), e]));
  const existingByNin = new Map(existing.filter((e) => clean(e.nin)).map((e) => [clean(e.nin), e]));

  let conformes = 0;
  let aCorriger = 0;
  let conflits = 0;
  const updates = [];

  for (const r of rows) {
    if (r.status === 'INTEGRE') { conformes += 0; continue; } // jamais réévalué
    const anomalies = [];
    const base = inspectRow({
      cmuNumber: r.cmu_number,
      firstName: r.first_name,
      lastName: r.last_name,
      birthDate: r.birth_date,
      photoKey: r.photo_key,
      photoData: r.photo_data,
      msdCode: r.msd_code || batch.msd_code,
    }, { agentMsd: scope || batch.msd_code, effectif: byCmu.get(canonicalCmu(r.cmu_number)) || 1 });

    for (const a of base) anomalies.push(a);

    if (r.photo_key && (byPhoto.get(r.photo_key) || 0) > 1) {
      anomalies.push({ type: 'PHOTO_AMBIGUE', correction: 'Photo partagée par plusieurs dossiers : renommer le fichier avec le matricule.' });
    }
    const msdRow = scope || String(r.msd_code || batch.msd_code || msdOfCode(r.cmu_number) || '').toUpperCase();
    if (scope && msdRow && msdRow !== scope) {
      anomalies.push({ type: 'CONFLIT_MSD', correction: `Ce dossier relève de la MSD ${msdRow}, hors de votre périmètre.` });
    }

    const exCmu = existingByCmu.get(clean(r.cmu_number).toUpperCase());
    const exNin = r.nin ? existingByNin.get(clean(r.nin)) : null;
    let conflict = false;
    if (exCmu) {
      const exMsd = String(exCmu.msd_code || '').toUpperCase();
      if (scope && exMsd && exMsd !== scope) {
        anomalies.push({ type: 'CONFLIT_MSD', correction: `Matricule déjà utilisé par une fiche de la MSD ${exMsd} : ne peut pas être réattribué.` });
        conflict = true;
      } else {
        anomalies.push({ type: 'DOUBLON_REGISTRE', correction: 'Fiche déjà présente : l\'intégration mettra à jour les champs fournis (aucun doublon créé).' });
      }
    }
    if (exNin && (!exCmu || clean(exNin.cmu_number).toUpperCase() !== clean(r.cmu_number).toUpperCase())) {
      anomalies.push({ type: 'CONFLIT_IDENTITE', correction: `Numéro de pièce déjà rattaché au dossier ${exNin.cmu_number}.` });
      conflict = true;
    }

    let status = 'CONFORME';
    if (conflict) status = 'CONFLIT';
    else if (anomalies.some((a) => a.type !== 'DOUBLON_REGISTRE')) status = 'A_CORRIGER';

    if (status === 'CONFORME') conformes += 1;
    else if (status === 'CONFLIT') conflits += 1;
    else aCorriger += 1;

    updates.push({ id: r.id, status, anomalies });
  }

  // Écriture des résultats (une transaction logique : requêtes simples, la
  // base reste la source de vérité ; un incident partiel est corrigeable par
  // un nouveau contrôle).
  for (const u of updates) {
    await query(
      `UPDATE import_batch_rows SET status = $2, anomalies = $3::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [u.id, u.status, JSON.stringify(u.anomalies)]
    );
  }

  const totalOpen = conformes + aCorriger + conflits;
  // Règle : le lot n'est VALIDE que si TOUS les dossiers sont conformes.
  // Sinon il reste A_CORRIGER — l'intégration des seuls conformes est
  // toujours possible (PARTIEL), mais le lot ne se dit jamais « valide »
  // tant qu'un dossier n'a pas été corrigé.
  const lotStatus = lotStatusFor(conformes, aCorriger + conflits);

  await query(
    `UPDATE import_batches SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [batchId, lotStatus]
  );

  return {
    ok: true,
    reference: batch.reference,
    status: lotStatus,
    summary: { total: rows.length, conformes, aCorriger, conflits },
  };
}

/** Charge un lot, cloisonné MSD. */
async function getBatch(batchId, user) {
  const scope = scopeOf(user);
  if (scope === undefined) return null;
  const r = await query('SELECT * FROM import_batches WHERE id = $1', [batchId]);
  const row = r.rows && r.rows[0];
  if (!row) return null;
  if (scope && String(row.msd_code || '').toUpperCase() !== scope) return null;
  return row;
}

/** Résumé pour l'interface et les rapports. */
async function getBatchSummary(batchId, user) {
  const batch = await getBatch(batchId, user);
  if (!batch) return { ok: false, error: 404, message: 'Lot introuvable.' };
  const counts = await query(
    `SELECT status, COUNT(*)::int AS n FROM import_batch_rows WHERE batch_id = $1 GROUP BY status`,
    [batchId]
  );
  const map = Object.fromEntries((counts.rows || []).map((c) => [c.status, c.n]));
  const total = Object.values(map).reduce((s, n) => s + Number(n || 0), 0);
  const photos = await query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE photo_key IS NOT NULL AND photo_key <> '') AS associees
       FROM import_batch_rows WHERE batch_id = $1`,
    [batchId]
  );
  return {
    ok: true,
    batch: {
      id: batch.id,
      reference: batch.reference,
      msdCode: batch.msd_code,
      lotCode: batch.lot_code,
      sourceFile: batch.source_file,
      status: batch.status,
      createdBy: batch.created_by,
      createdAt: batch.created_at,
      validatedAt: batch.validated_at,
      integratedAt: batch.integrated_at,
    },
    summary: {
      total,
      conformes: map.CONFORME || 0,
      aCorriger: map.A_CORRIGER || 0,
      conflits: map.CONFLIT || 0,
      rejetes: map.REJETE || 0,
      integres: map.INTEGRE || 0,
      photos: (photos.rows && photos.rows[0]) || { total: 0, associees: 0 },
    },
  };
}

/**
 * Intègre les dossiers CONFORMES d'un lot dans le registre opérationnel.
 * Idempotent : seuls les dossiers encore non intégrés et conformes passent.
 * @returns {Promise<object>}
 */
async function integrateBatch(batchId, user) {
  const scope = scopeOf(user);
  if (scope === undefined) return { ok: false, error: 403, message: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' };
  const batch = await getBatch(batchId, user);
  if (!batch) return { ok: false, error: 404, message: 'Lot d\'import introuvable.' };
  if (batch.status === 'ANNULE') return { ok: false, error: 409, message: 'Lot annulé : aucune intégration possible.' };

  await ensureImportSchema();
  const rowsRes = await query(
    `SELECT * FROM import_batch_rows
      WHERE batch_id = $1 AND status = 'CONFORME'
      ORDER BY line_number, id`,
    [batchId]
  );
  const rows = rowsRes.rows || [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (const r of rows) {
    const cmu = clean(r.cmu_number);
    if (!cmu) { skipped += 1; continue; }
    const msd = scope || String(r.msd_code || batch.msd_code || msdOfCode(cmu) || '').toUpperCase() || null;
    if (scope && msd !== scope) { skipped += 1; continue; }
    const photoUrl = clean(r.photo_data) || null;
    try {
      const ex = await query(
        `SELECT id, msd_code FROM beneficiaries WHERE cmu_number = $1 OR ($2::text IS NOT NULL AND nin = $2) LIMIT 1`,
        [cmu, clean(r.nin) || null]
      );
      if (ex.rows.length > 0) {
        const fiche = ex.rows[0];
        const ficheMsd = String(fiche.msd_code || '').toUpperCase();
        if (scope && ficheMsd && ficheMsd !== scope) { skipped += 1; continue; }
        await query(
          `UPDATE beneficiaries SET
              first_name = COALESCE(NULLIF($2,''), first_name),
              last_name = COALESCE(NULLIF($3,''), last_name),
              birth_date = COALESCE(NULLIF($4,''), birth_date),
              gender = COALESCE(NULLIF($5,''), gender),
              phone = COALESCE(NULLIF($6,''), phone),
              address = COALESCE(NULLIF($7,''), address),
              nin = COALESCE(nin, $8),
              photo_url = COALESCE($9, photo_url),
              lot_code = COALESCE(NULLIF($10,''), lot_code),
              msd_code = COALESCE(msd_code, $11)
            WHERE id = $1`,
          [fiche.id, clean(r.first_name), clean(r.last_name), clean(r.birth_date), clean(r.gender),
            clean(r.phone), clean(r.address), clean(r.nin) || null, photoUrl, clean(batch.lot_code) || null, msd]
        );
        updated += 1;
      } else {
        await query(
          `INSERT INTO beneficiaries
             (first_name, last_name, birth_date, gender, phone, address, cmu_number,
              nin, photo_url, status, package_type, payment_method, lot_code, msd_code)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active','individuel','excel_import',$10,$11)`,
          [clean(r.first_name), clean(r.last_name), clean(r.birth_date), clean(r.gender),
            clean(r.phone), clean(r.address), cmu, clean(r.nin) || null, photoUrl,
            clean(batch.lot_code) || null, msd]
        );
        inserted += 1;
      }
      await query(
        `UPDATE import_batch_rows SET status = 'INTEGRE', integrated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1`,
        [r.id]
      );
    } catch (err) {
      skipped += 1;
      errors.push({ line: r.line_number, cmu, message: err.message.slice(0, 200) });
    }
  }

  const remaining = await query(
    `SELECT COUNT(*)::int AS n FROM import_batch_rows WHERE batch_id = $1 AND status <> 'INTEGRE'`,
    [batchId]
  );
  const stillOpen = (remaining.rows && remaining.rows[0] && remaining.rows[0].n) || 0;
  const newStatus = stillOpen > 0 ? 'PARTIEL' : 'INTEGRE';
  await query(
    `UPDATE import_batches SET status = $2, integrated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [batchId, newStatus]
  );
  return { ok: true, reference: batch.reference, status: newStatus, inserted, updated, skipped, errors };
}

module.exports = {
  LOT_STATUS,
  ROW_STATUS,
  ANOMALY_TYPES,
  MAX_PHOTO_CHARS,
  ensureImportSchema,
  scopeOf,
  msdOfCode,
  batchReference,
  photoKeys,
  canonicalCmu,
  inspectRow,
  lotStatusFor,
  runControls,
  getBatch,
  getBatchSummary,
  integrateBatch,
};
