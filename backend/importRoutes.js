/**
 * importRoutes.js — Importation contrôlée (Module 2 du cahier des charges).
 *
 *   POST /api/imports                       — créer un lot BROUILLON (métadonnées)
 *   POST /api/imports/:id/rows              — déposer les lignes + photos (zone temporaire)
 *   POST /api/imports/:id/controls          — relancer les contrôles automatiques
 *   GET  /api/imports/:id                   — prévisualisation (dossiers + anomalies)
 *   PATCH /api/imports/:id/rows/:rowId      — correction manuelle (re-contrôle immédiat)
 *   POST /api/imports/:id/validate          — validation explicite du lot
 *   POST /api/imports/:id/integrate         — intégration des SEULS dossiers conformes
 *   GET  /api/imports                       — historique paginé et cloisonné
 *   GET  /api/imports/:id/report            — rapport Excel de l'importation (§2.3)
 *
 * Aucune de ces routes n'écrit dans `beneficiaries` avant l'intégration
 * explicite. Cloisonnement MSD et journalisation sur chaque écriture.
 */

const express = require('express');
const crypto = require('crypto');
const { query } = require('./db');
const { normalizeRole, authenticateToken } = require('./rbac');
const { parsePagination } = require('./pagination');
const {
  ensureImportSchema, scopeOf, msdOfCode, photoKeys, canonicalCmu,
  getBatch, getBatchSummary, runControls, integrateBatch, MAX_PHOTO_CHARS,
} = require('./importStaging');
const { recordAudit, actorOf } = require('./auditTrail');
const {
  buildKpiSheet, buildTableSheet, buildWorkbook, reportReference,
} = require('./excelWorkbook');

const router = express.Router();

// Authentification portée par le router, LIMIT‰E aux préfixes du module :
// le router est monté à la racine et contient des chemins complets ; un
// `router.use(authenticateToken)` global bloquerait toutes les routes de
// l'application (dont les routes publiques /api/csu/*).
const MODULE_PREFIXES = /^\/api\/(imports|studio|excel|security|accounts|cards|admin-requests)(\/|$)/;
router.use((req, res, next) => {
  if (!MODULE_PREFIXES.test(req.path)) return next();
  return authenticateToken(req, res, next);
});

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

/** Garde commune : agent/admin authentifié ET rattaché à une MSD (sauf Super Admin).
 *  Renvoie la MSD (string), `null` pour un Super Admin (périmètre TOTAL — valeur
 *  légitime), ou `false` si la requête a déjà été refusée (403 envoyé). */
function guard(req, res) {
  const role = normalizeRole(req.user && req.user.role);
  if (role !== 'agent' && role !== 'admin') {
    res.status(403).json({ error: 'Réservé aux agents et administrateurs habilités.' });
    return false;
  }
  const scope = scopeOf(req.user);
  if (scope === undefined) {
    res.status(403).json({ error: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' });
    return false;
  }
  return scope;
}

// ”€”€ Créer un lot ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.post('/api/imports', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  const body = req.body || {};
  const msd = scope || clean(body.msdCode).toUpperCase() || null;
  if (scope && clean(body.msdCode) && clean(body.msdCode).toUpperCase() !== scope) {
    return res.status(403).json({ error: 'Import hors de votre périmètre MSD.' });
  }
  try {
    await ensureImportSchema();
    const stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const reference = `IMP-${stamp}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const lotCode = clean(body.lotCode) || null;
    const sourceFile = clean(body.sourceFile).slice(0, 255) || null;
    const photoCount = Math.max(0, parseInt(body.photoCount, 10) || 0);
    const ins = await query(
      `INSERT INTO import_batches (reference, msd_code, lot_code, source_file, photo_count, status, created_by, created_by_role)
       VALUES ($1,$2,$3,$4,$5,'BROUILLON',$6,$7) RETURNING id, reference, status`,
      [reference, msd, lotCode, sourceFile, photoCount, actorOf(req.user), normalizeRole(req.user.role)]
    );
    await recordAudit({
      action: 'IMPORT_LOT_CREE', actor: actorOf(req.user),
      details: `Lot ${reference} créé (${photoCount} photo(s), fichier ${sourceFile || 'n/a'}) — aucune donnée intégrée.`,
      objectType: 'IMPORT', objectRef: reference, msdCode: msd, result: 'SUCCESS',
    });
    return res.status(201).json({ success: true, ...ins.rows[0] });
  } catch (err) {
    console.error('[Import] création impossible :', err.message);
    return res.status(500).json({ error: 'Création du lot impossible.' });
  }
});

// ”€”€ Déposer les lignes (zone temporaire) ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.post('/api/imports/:id/rows', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  const batch = await getBatch(parseInt(req.params.id, 10), req.user).catch(() => null);
  if (!batch) return res.status(404).json({ error: "Lot d'import introuvable." });
  if (batch.status === 'ANNULE' || batch.status === 'INTEGRE') {
    return res.status(409).json({ error: `Lot ${batch.status} : dépôt de lignes impossible.` });
  }
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'Aucune ligne déposée.' });
  if (rows.length > 3000) return res.status(413).json({ error: 'Maximum 3000 lignes par lot d\'import.' });
  try {
    await ensureImportSchema();
    let inserted = 0;
    let rejected = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i] || {};
      const photoData = clean(r.photoData);
      if (photoData.length > MAX_PHOTO_CHARS) { rejected += 1; continue; }
      const cmu = clean(r.cmuNumber || r.codeBeneficiaire);
      const msdRow = String(clean(r.msdCode) || batch.msd_code || msdOfCode(cmu) || '').toUpperCase() || null;
      if (scope && msdRow && msdRow !== scope) { rejected += 1; continue; }
      await query(
        `INSERT INTO import_batch_rows
           (batch_id, line_number, cmu_number, first_name, last_name, nin, phone,
            birth_date, gender, address, photo_key, photo_data, status, anomalies)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'A_CORRIGER','[]'::jsonb)`,
        [batch.id, parseInt(r.lineNumber, 10) || (i + 1), cmu || null,
          clean(r.firstName).slice(0, 150) || null, clean(r.lastName).slice(0, 150) || null,
          clean(r.nin).slice(0, 60) || null, clean(r.phone).slice(0, 40) || null,
          clean(r.birthDate).slice(0, 40) || null, clean(r.gender).slice(0, 10) || null,
          clean(r.address).slice(0, 255) || null, clean(r.photoKey).slice(0, 255) || null,
          photoData || null]
      );
      inserted += 1;
    }
    await query(
      `UPDATE import_batches SET row_count = (SELECT COUNT(*) FROM import_batch_rows WHERE batch_id = $1),
              updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [batch.id]
    );
    await recordAudit({
      action: 'IMPORT_LIGNES_DEPOSEES', actor: actorOf(req.user),
      details: `Lot ${batch.reference} : ${inserted} ligne(s) déposée(s) en zone temporaire, ${rejected} refusée(s).`,
      objectType: 'IMPORT', objectRef: batch.reference, msdCode: batch.msd_code, result: 'SUCCESS',
    });
    return res.json({ success: true, reference: batch.reference, inserted, rejected });
  } catch (err) {
    console.error('[Import] dépôt impossible :', err.message);
    return res.status(500).json({ error: 'Dépôt des lignes impossible.' });
  }
});

// ”€”€ Relancer les contrôles ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.post('/api/imports/:id/controls', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const result = await runControls(parseInt(req.params.id, 10), req.user);
    if (!result.ok) return res.status(result.error || 400).json({ error: result.message });
    await recordAudit({
      action: 'IMPORT_CONTROLE', actor: actorOf(req.user),
      details: `Lot ${result.reference} contrôlé : ${result.summary.conformes} conforme(s), ${result.summary.aCorriger} à corriger, ${result.summary.conflits} conflit(s).`,
      objectType: 'IMPORT', objectRef: result.reference, msdCode: scope, result: 'SUCCESS',
    });
    return res.json(result);
  } catch (err) {
    console.error('[Import] contrôle impossible :', err.message);
    return res.status(500).json({ error: 'Contrôle du lot impossible.' });
  }
});

// ”€”€ Prévisualisation ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/imports/:id', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const summary = await getBatchSummary(parseInt(req.params.id, 10), req.user);
    if (!summary.ok) return res.status(summary.error || 404).json({ error: summary.message });
    const { page, limit, offset } = parsePagination(req);
    const status = clean(req.query.status).toUpperCase();
    const params = [summary.batch.id];
    let where = 'WHERE batch_id = $1';
    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    const rows = await query(
      `SELECT id, line_number, cmu_number, first_name, last_name, nin, phone, birth_date,
              gender, address, photo_key, status, anomalies,
              (photo_data IS NOT NULL AND photo_data <> '') AS has_photo
         FROM import_batch_rows ${where}
        ORDER BY line_number, id
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const countRes = await query(`SELECT COUNT(*) FROM import_batch_rows ${where}`, params);
    const total = parseInt((countRes.rows[0] && countRes.rows[0].count) || '0', 10) || 0;
    return res.json({
      ...summary,
      rows: rows.rows.map((r) => ({
        id: r.id,
        lineNumber: r.line_number,
        cmuNumber: r.cmu_number,
        firstName: r.first_name,
        lastName: r.last_name,
        // La pièce est masquée dans la prévisualisation (données personnelles).
        ninMasked: r.nin ? '•'.repeat(Math.max(2, String(r.nin).length - 2)) + String(r.nin).slice(-2) : null,
        birthDate: r.birth_date,
        gender: r.gender,
        photoKey: r.photo_key,
        hasPhoto: Boolean(r.has_photo),
        status: r.status,
        anomalies: Array.isArray(r.anomalies) ? r.anomalies : [],
      })),
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error('[Import] lecture impossible :', err.message);
    return res.status(500).json({ error: 'Lecture du lot impossible.' });
  }
});

// ”€”€ Correction manuelle d'un dossier ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.patch('/api/imports/:id/rows/:rowId', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  const batch = await getBatch(parseInt(req.params.id, 10), req.user).catch(() => null);
  if (!batch) return res.status(404).json({ error: "Lot d'import introuvable." });
  if (['INTEGRE', 'ANNULE'].includes(batch.status)) {
    return res.status(409).json({ error: `Lot ${batch.status} : correction impossible.` });
  }
  const rowId = parseInt(req.params.rowId, 10);
  const b = req.body || {};
  const fields = {
    cmu_number: clean(b.cmuNumber), first_name: clean(b.firstName), last_name: clean(b.lastName),
    nin: clean(b.nin), phone: clean(b.phone), birth_date: clean(b.birthDate),
    gender: clean(b.gender), address: clean(b.address), photo_key: clean(b.photoKey),
  };
  try {
    const own = await query('SELECT id FROM import_batch_rows WHERE id = $1 AND batch_id = $2', [rowId, batch.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Dossier introuvable dans ce lot.' });

    const sets = [];
    const params = [];
    for (const [col, val] of Object.entries(fields)) {
      if (val) { params.push(val.slice(0, col === 'address' ? 255 : 150)); sets.push(`${col} = $${params.length}`); }
      else if (b.clear && Array.isArray(b.clear) && b.clear.includes(col)) { sets.push(`${col} = NULL`); }
    }
    // La photo peut être JOINTe explicitement (correction d'une association
    // ambiguë) : c'est l'appariement manuel prévu au §2.2.
    if (clean(b.photoData) && clean(b.photoData).length <= MAX_PHOTO_CHARS) {
      params.push(clean(b.photoData)); sets.push(`photo_data = $${params.length}`);
    }
    if (sets.length > 0) {
      params.push(rowId);
      await query(`UPDATE import_batch_rows SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${params.length}`, params);
    }
    // Re-contrôle IMM‰DIAT (§2.2) : toute correction est réexaminée.
    const ctrl = await runControls(batch.id, req.user);
    let updatedRow = null;
    try {
      const rr = await query(
        `SELECT id, line_number, cmu_number, first_name, last_name, photo_key, status, anomalies
           FROM import_batch_rows WHERE id = $1`,
        [rowId]
      );
      updatedRow = (rr.rows || [])[0] || null;
    } catch { /* lecture non bloquante */ }
    await recordAudit({
      action: 'IMPORT_DOSSIER_CORRIGE', actor: actorOf(req.user),
      details: `Lot ${batch.reference} · dossier ligne ${(updatedRow && updatedRow.line_number) || rowId} corrigé puis re-contrôlé.`,
      objectType: 'IMPORT', objectRef: batch.reference, msdCode: batch.msd_code, result: 'SUCCESS',
    });
    return res.json({ success: true, row: updatedRow, controls: ctrl.summary, lotStatus: ctrl.status });
  } catch (err) {
    console.error('[Import] correction impossible :', err.message);
    return res.status(500).json({ error: 'Correction impossible.' });
  }
});

// ”€”€ Validation explicite ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.post('/api/imports/:id/validate', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const summary = await getBatchSummary(parseInt(req.params.id, 10), req.user);
    if (!summary.ok) return res.status(summary.error || 404).json({ error: summary.message });
    const { conformes, aCorriger, conflits } = summary.summary;
    if (conformes === 0) {
      return res.status(409).json({ error: 'Aucun dossier conforme : le lot ne peut pas être validé.' });
    }
    // La validation autorise l'intégration des conformes ; elle ne remplace
    // pas la correction des dossiers en anomalie (§2.1 étape 7).
    await query(
      `UPDATE import_batches SET status = $2, validated_by = $3, validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [summary.batch.id, aCorriger + conflits > 0 ? 'A_CORRIGER' : 'VALIDE', actorOf(req.user)]
    );
    await recordAudit({
      action: 'IMPORT_VALIDE', actor: actorOf(req.user),
      details: `Lot ${summary.batch.reference} validé explicitement : ${conformes} conforme(s), ${aCorriger} à corriger, ${conflits} conflit(s).`,
      objectType: 'IMPORT', objectRef: summary.batch.reference, msdCode: summary.batch.msdCode, result: 'SUCCESS',
    });
    return res.json({
      success: true,
      reference: summary.batch.reference,
      integrable: conformes,
      restantATraiter: aCorriger + conflits,
    });
  } catch (err) {
    console.error('[Import] validation impossible :', err.message);
    return res.status(500).json({ error: 'Validation impossible.' });
  }
});

// ”€”€ Intégration ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.post('/api/imports/:id/integrate', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const batch = await getBatch(parseInt(req.params.id, 10), req.user);
    if (!batch) return res.status(404).json({ error: "Lot d'import introuvable." });
    if (!batch.validated_at) {
      return res.status(409).json({ error: 'Le lot doit d\'abord être validé explicitement (étape « Valider le lot »).' });
    }
    const result = await integrateBatch(batch.id, req.user);
    if (!result.ok) return res.status(result.error || 400).json({ error: result.message });
    await recordAudit({
      action: 'IMPORT_INTEGRATION', actor: actorOf(req.user),
      details: `Lot ${result.reference} intégré : ${result.inserted} créé(s), ${result.updated} mis à jour, ${result.skipped} ignoré(s).`,
      objectType: 'IMPORT', objectRef: result.reference, msdCode: batch.msd_code, result: 'SUCCESS',
    });
    return res.json(result);
  } catch (err) {
    console.error('[Import] intégration impossible :', err.message);
    return res.status(500).json({ error: 'Intégration impossible.' });
  }
});

// ”€”€ Historique des lots ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/imports', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    await ensureImportSchema();
    const { page, limit, offset } = parsePagination(req);
    const params = [];
    let where = 'WHERE 1=1';
    if (scope) { params.push(scope); where += ` AND msd_code = $${params.length}`; }
    if (clean(req.query.status)) { params.push(clean(req.query.status).toUpperCase()); where += ` AND status = $${params.length}`; }
    if (clean(req.query.q)) { params.push(`%${clean(req.query.q)}%`); where += ` AND (reference ILIKE $${params.length} OR source_file ILIKE $${params.length})`; }
    const countRes = await query(`SELECT COUNT(*) FROM import_batches ${where}`, params);
    const total = parseInt((countRes.rows[0] && countRes.rows[0].count) || '0', 10) || 0;
    const rows = await query(
      `SELECT id, reference, msd_code, lot_code, source_file, row_count, photo_count, status,
              created_by, created_at, validated_at, integrated_at
         FROM import_batches ${where}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return res.json({
      data: rows.rows.map((r) => ({
        id: r.id, reference: r.reference, msdCode: r.msd_code, lotCode: r.lot_code,
        sourceFile: r.source_file, rowCount: r.row_count, photoCount: r.photo_count,
        status: r.status, createdBy: r.created_by, createdAt: r.created_at,
        validatedAt: r.validated_at, integratedAt: r.integrated_at,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (err) {
    console.error('[Import] historique impossible :', err.message);
    return res.status(500).json({ error: 'Historique des imports indisponible.' });
  }
});

// ”€”€ Rapport Excel de l'importation (§2.3 / §5.3) ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/imports/:id/report', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const summary = await getBatchSummary(parseInt(req.params.id, 10), req.user);
    if (!summary.ok) return res.status(summary.error || 404).json({ error: summary.message });
    const rowsRes = await query(
      `SELECT line_number, cmu_number, first_name, last_name, photo_key, status, anomalies,
              integrated_at, birth_date
         FROM import_batch_rows WHERE batch_id = $1 ORDER BY line_number, id`,
      [summary.batch.id]
    );
    const rows = rowsRes.rows || [];
    const ref = reportReference('IMP');
    const anomalyLines = [];
    const photosLibres = [];
    const doublons = [];
    const conformes = [];
    const integres = [];
    const rejetes = [];
    for (const r of rows) {
      const anomalies = Array.isArray(r.anomalies) ? r.anomalies : [];
      const label = {
        line_number: r.line_number,
        cmu_number: r.cmu_number,
        nom: r.last_name,
        prenom: r.first_name,
        photo: r.photo_key || '—',
        statut: r.status,
        integre_le: r.integrated_at,
      };
      if (r.status === 'CONFORME' || (r.status === 'INTEGRE' && anomalies.length === 0)) conformes.push(label);
      if (r.status === 'INTEGRE') integres.push(label);
      if (r.status === 'CONFLIT' || r.status === 'REJETE') rejetes.push(label);
      for (const a of anomalies) {
        if (a.type === 'PHOTO_MANQUANTE' || a.type === 'PHOTO_AMBIGUE') photosLibres.push({ ...label, type: a.type });
        if (a.type === 'DOUBLON_LOT' || a.type === 'DOUBLON_REGISTRE' || a.type === 'CONFLIT_IDENTITE' || a.type === 'CONFLIT_MSD') doublons.push({ ...label, type: a.type });
        anomalyLines.push({
          reference: r.cmu_number, ligne: r.line_number, type: a.type,
          correction: a.correction, statut: r.status,
        });
      }
    }
    const s = summary.summary;
    const sheets = [
      {
        name: 'Synthese',
        sheet: buildKpiSheet([
          ['Référence du lot', summary.batch.reference],
          ['MSD', summary.batch.msdCode || 'Toutes'],
          ['Fichier source', summary.batch.sourceFile || 'n/a'],
          ['Statut du lot', summary.batch.status],
          ['Généré par', actorOf(req.user)],
          ['Référence du rapport', ref],
          ['Date de génération', new Date().toISOString()],
          ['Lignes du lot', s.total],
          ['Dossiers conformes', s.conformes],
          ['Dossiers intégrés', s.integres],
          ['Dossiers à corriger', s.aCorriger],
          ['Conflits', s.conflits],
          ['Photos associées', s.photos.associees || 0],
          ['Photos attendues', s.photos.total || 0],
        ]),
      },
      {
        name: 'Dossiers conformes',
        sheet: buildTableSheet(['line_number', 'cmu_number', 'nom', 'prenom', 'photo', 'statut'],
          conformes, { labels: { line_number: 'Ligne', cmu_number: 'Matricule', nom: 'Nom', prenom: 'Prénom', photo: 'Photo', statut: 'Statut' } }),
      },
      {
        name: 'Anomalies',
        sheet: buildTableSheet(['reference', 'ligne', 'type', 'correction', 'statut'],
          anomalyLines, { labels: { reference: 'Dossier', ligne: 'Ligne source', type: 'Type d\'erreur', correction: 'Correction attendue', statut: 'Statut' } }),
      },
      {
        name: 'Photos non associees',
        sheet: buildTableSheet(['line_number', 'cmu_number', 'nom', 'prenom', 'type'],
          photosLibres, { labels: { line_number: 'Ligne', cmu_number: 'Matricule', nom: 'Nom', prenom: 'Prénom', type: 'Problème photo' } }),
      },
      {
        name: 'Doublons et conflits',
        sheet: buildTableSheet(['line_number', 'cmu_number', 'nom', 'prenom', 'type'],
          doublons, { labels: { line_number: 'Ligne', cmu_number: 'Matricule', nom: 'Nom', prenom: 'Prénom', type: 'Conflit' } }),
      },
      {
        name: 'Resultat integration',
        sheet: buildTableSheet(['line_number', 'cmu_number', 'nom', 'prenom', 'statut', 'integre_le'],
          [...integres, ...rejetes],
          { labels: { line_number: 'Ligne', cmu_number: 'Matricule', nom: 'Nom', prenom: 'Prénom', statut: 'Résultat', integre_le: 'Intégré le' } }),
      },
    ];
    const buffer = buildWorkbook(sheets);
    await recordAudit({
      action: 'EXPORT_RAPPORT_IMPORT', actor: actorOf(req.user),
      details: `Rapport Excel du lot ${summary.batch.reference} exporté (6 feuilles).`,
      objectType: 'REPORT', objectRef: ref, msdCode: summary.batch.msdCode, result: 'SUCCESS',
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="import-${summary.batch.reference}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    console.error('[Import] rapport impossible :', err.message);
    return res.status(500).json({ error: 'Rapport d\'importation indisponible.' });
  }
});

module.exports = { router, photoKeys, canonicalCmu };
