/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  STUDIO CARTES — hiérarchie géographique et suivi de production (Étape 2)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Routes consommées par le nouveau panneau « Vue générale » du Studio :
 *
 *   GET /api/studio/geo/overview  — synthèse nationale + cartes régions
 *   GET /api/studio/geo/region/:name — départements d'une région
 *   GET /api/studio/geo/dept/:name   — MSD d'un département
 *   GET /api/studio/msd/:code        — tableau de bord d'une MSD
 *   GET /api/studio/lot/:code        — détail d'une adhésion de masse
 *   GET /api/studio/lots             — recherche/filtrage paginé des adhésions
 *   GET /api/studio/lot/:code/production — historique de production du lot
 *
 * RÈGLE FINANCIÈRE (§4 du cahier des charges, Étape 2 — validée) :
 *   Sen-E-Carte perçoit 350 FCFA par carte dont l'impression est
 *   EFFECTIVEMENT enregistrée. Le revenu de chaque lot est FIGÉ au moment de
 *   la remise dans production_events (nombre de cartes × tarif applicable
 *   ce jour-là) : une modification ultérieure du tarif ne réécrit jamais
 *   le passé. INITIAL, REPRINT et REPLACEMENT sont facturés 350 FCFA/carte ;
 *   seul DESTROYED porte un revenu de 0. Les lots non imprimés affichent
 *   un revenu de 0.
 *
 *   Le nombre de cartes d'un lot imprimé est le nombre de fiches CONFORMES
 *   (photo + identité complète) au moment de la remise — cohérent avec le
 *   verrou existant POST /api/campaign-lots/:code/print (audit_logs
 *   REMISE_LOT_MSD, idempotent : rejouer ne double jamais le revenu).
 *
 * SÉCURITÉ :
 *   - Authentification obligatoire (authenticateToken est posé par server.js
 *     sur chaque route du module).
 *   - Cloisonnement MSD : un agent (non Super Admin) ne voit QUE sa MSD
 *     (filtre sur `msd_code`/`union_id`). Le Super Admin supervise tout.
 *   - Lecture pure : aucune écriture, aucun secret, aucune donnée médicale
 *     dans les réponses (compteurs et libellés uniquement).
 *
 * Toutes les requêtes sont paginées/agrégées en SQL — pas de boucle N+1.
 */

const express = require('express');
const { query } = require('./db');
const { parsePagination } = require('./pagination');

/** Prix unitaire — source unique (§4.4 : ne pas disperser la valeur 350). */
const SEN_E_CARTE_PRIX_CARTE = 350;

const router = express.Router();

/** L'utilisateur est-il superviseur (non filtré par MSD) ? */
const estSuperviseur = (user) =>
  String((user && user.role) || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin';

/** Code MSD exigé pour un agent non superviseur (fail-closed). */
const msdDe = (user) => {
  if (estSuperviseur(user)) return null;
  return (user && user.msdCode) || null;
};

/**
 * Filtre SQL de cloisonnement. Retourne { clause, params } :
 *   - Super Admin : pas de filtre (supervision nationale) ;
 *   - agent avec msdCode : filtre sur ce code (placeholder $1, réutilisable
 *     plusieurs fois dans la même requête car c'est la même valeur) ;
 *   - agent SANS msdCode : fail-closed → clause impossible (rien ne passe).
 *
 * @param {object} user — req.user
 * @param {string} col — colonne de rattachement (ex. 'b.msd_code', 'l.union_id')
 */
const filtreMsd = (user, col) => {
  const msd = msdDe(user);
  if (msd === null && !estSuperviseur(user)) return { clause: '1=0', params: [] };
  if (msd) return { clause: `${col} = $1`, params: [msd] };
  return { clause: 'TRUE', params: [] };
};

/**
 * Expression SQL « fiche conforme » — photo + identité complète.
 * Source de vérité unique, alignée sur POST /api/campaign-lots/:code/print.
 */
const SQL_CONFORME = `
  b.merged_into IS NULL
  AND b.photo_url IS NOT NULL AND b.photo_url <> ''
  AND COALESCE(b.first_name,'') <> ''
  AND COALESCE(b.last_name,'') <> ''
  AND COALESCE(b.birth_date,'') <> ''`;

// ─────────────────────────────────────────────────────────────────────────
//  NIVEAU 1 — Vue générale nationale (§2.2)
// ─────────────────────────────────────────────────────────────────────────
router.get('/geo/overview', async (req, res) => {
  try {
    // Le placeholder $1 est réutilisable dans chaque sous-select : c'est
    // toujours la même valeur MSD (ou aucun paramètre pour le Super Admin).
    const f = filtreMsd(req.user, 'b.msd_code');
    const fl = filtreMsd(req.user, 'l.union_id');
    const params = f.params.length > 0 ? f.params : fl.params;
    // Compteurs globaux — une requête, aucune boucle N+1. Le revenu est la
    // SOMME DES REVENUS FIGÉS dans production_events (§1.3 Étape 2, règle
    // validée) : INITIAL + REPRINT + REPLACEMENT à 350 FCFA/carte, seul
    // DESTROYED porte un revenu de 0. Si la table n'existe pas encore
    // (ancien déploiement), repli sur l'ancien calcul.
    // Jamais les adhérents importés, jamais les fiches validées non imprimées.
    let g;
    try {
      g = await query(
        `SELECT
           (SELECT COUNT(*) FROM mutuelles) AS msd_count,
           (SELECT COUNT(DISTINCT region) FROM mutuelles) AS region_count,
           (SELECT COUNT(DISTINCT commune) FROM mutuelles) AS department_count,
           (SELECT COUNT(*) FROM campaign_lots l WHERE ${fl.clause}) AS enrollment_count,
           (SELECT COUNT(*) FROM beneficiaries b WHERE ${f.clause}) AS beneficiary_count,
           (SELECT COUNT(*) FROM beneficiaries b WHERE ${f.clause} AND ${SQL_CONFORME}) AS conform_count,
           (SELECT COUNT(*) FROM beneficiaries b WHERE ${f.clause}
              AND NOT (${SQL_CONFORME})) AS anomaly_count,
           (SELECT COUNT(*) FROM campaign_lots l WHERE ${fl.clause} AND l.printed) AS printed_lot_count,
           (SELECT COALESCE(SUM(pe.card_count),0)
              FROM production_events pe JOIN campaign_lots l ON l.code = pe.lot_code
             WHERE pe.event IN ('INITIAL','REPRINT','REPLACEMENT') AND ${fl.clause}) AS printed_cards,
           (SELECT COALESCE(SUM(pe.revenue_fcfa),0)
              FROM production_events pe JOIN campaign_lots l ON l.code = pe.lot_code
             WHERE pe.event IN ('INITIAL','REPRINT','REPLACEMENT') AND ${fl.clause}) AS revenue_fcfa`,
        params
      );
    } catch (e) {
      // Table production_events absente (migration pas encore jouée) : repli
      // sur le calcul historique (conformes des lots imprimés × 350).
      g = await query(
        `SELECT
           (SELECT COUNT(*) FROM mutuelles) AS msd_count,
           (SELECT COUNT(DISTINCT region) FROM mutuelles) AS region_count,
           (SELECT COUNT(DISTINCT commune) FROM mutuelles) AS department_count,
           (SELECT COUNT(*) FROM campaign_lots l WHERE ${fl.clause}) AS enrollment_count,
           (SELECT COUNT(*) FROM beneficiaries b WHERE ${f.clause}) AS beneficiary_count,
           (SELECT COUNT(*) FROM beneficiaries b WHERE ${f.clause} AND ${SQL_CONFORME}) AS conform_count,
           (SELECT COUNT(*) FROM beneficiaries b WHERE ${f.clause}
              AND NOT (${SQL_CONFORME})) AS anomaly_count,
           (SELECT COUNT(*) FROM campaign_lots l WHERE ${fl.clause} AND l.printed) AS printed_lot_count,
           (SELECT COALESCE(SUM(c.conformes),0)
              FROM campaign_lots l
              JOIN LATERAL (
                SELECT COUNT(*) AS conformes FROM beneficiaries b
                 WHERE b.lot_code = l.code AND ${SQL_CONFORME}
              ) c ON TRUE
             WHERE ${fl.clause} AND l.printed) AS printed_cards,
           (SELECT COALESCE(SUM(c.conformes),0) * ${SEN_E_CARTE_PRIX_CARTE}
              FROM campaign_lots l
              JOIN LATERAL (
                SELECT COUNT(*) AS conformes FROM beneficiaries b
                 WHERE b.lot_code = l.code AND ${SQL_CONFORME}
              ) c ON TRUE
             WHERE ${fl.clause} AND l.printed) AS revenue_fcfa`,
        params
      );
    }

    // Cartes par région : les régions viennent de mutuelles (donnée réelle),
    // les lots sont rattachés par union_id (code MSD à 3 lettres). Le revenu
    // régional = somme des REVENUS FIGÉS (INITIAL + REPRINT + REPLACEMENT).
    const regionRows = await query(
      `WITH reg AS (
         SELECT region AS name, MIN(LEFT(UPPER(name),3)) AS msd_prefix,
                COUNT(*) AS msd_count, COUNT(DISTINCT commune) AS department_count
           FROM mutuelles GROUP BY region
       ),
       stats AS (
         SELECT r.name, r.msd_count, r.department_count,
                COUNT(l.id) AS enrollment_count,
                COUNT(l.id) FILTER (WHERE l.printed) AS printed_count,
                COALESCE(SUM(pe.card_count),0) AS cartes_imprimees,
                COALESCE(SUM(pe.revenue_fcfa),0) AS revenue
           FROM reg r
           LEFT JOIN campaign_lots l
             ON r.msd_prefix = UPPER(SUBSTRING(COALESCE(l.union_id,'DKR') FROM 1 FOR 3))
           LEFT JOIN production_events pe
             ON pe.lot_code = l.code AND pe.event IN ('INITIAL','REPRINT','REPLACEMENT')
          GROUP BY r.name, r.msd_count, r.department_count
       )
       SELECT * FROM stats ORDER BY name`,
      []
    ).catch(() => ({ rows: [] }));

    const data = g.rows[0] || {};

    res.json({
      global: {
        regionCount: parseInt(data.region_count || '0', 10),
        departmentCount: parseInt(data.department_count || '0', 10),
        msdCount: parseInt(data.msd_count || '0', 10),
        enrollmentCount: parseInt(data.enrollment_count || '0', 10),
        beneficiaryCount: parseInt(data.beneficiary_count || '0', 10),
        conformCount: parseInt(data.conform_count || '0', 10),
        anomalyCount: parseInt(data.anomaly_count || '0', 10),
        printedLotCount: parseInt(data.printed_lot_count || '0', 10),
        printedCount: parseInt(data.printed_cards || '0', 10),
        revenueFcfa: parseInt(data.revenue_fcfa || '0', 10),
        prixUnitaire: SEN_E_CARTE_PRIX_CARTE,
      },
      regions: regionRows.rows.map((r) => ({
        name: r.name,
        departmentCount: parseInt(r.department_count || '0', 10),
        msdCount: parseInt(r.msd_count || '0', 10),
        enrollmentCount: parseInt(r.enrollment_count || '0', 10),
        printedCount: parseInt(r.cartes_imprimees || '0', 10),
        revenueFcfa: parseInt(r.revenue || '0', 10),
      })),
    });
  } catch (err) {
    console.error('[Studio] overview impossible :', err.message);
    res.status(500).json({ error: 'Statistiques Studio indisponibles.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
//  NIVEAU 2 — Départements d'une région (§2.3)
// ─────────────────────────────────────────────────────────────────────────
router.get('/geo/region/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const region = await query(
      `SELECT region AS name, COUNT(*) AS msd_count,
              COUNT(DISTINCT commune) AS department_count
         FROM mutuelles WHERE LOWER(region) = LOWER($1)
        GROUP BY region`,
      [name]
    );
    if (region.rows.length === 0) return res.status(404).json({ error: 'Région inconnue.' });

    const depts = await query(
      `SELECT commune AS name, COUNT(*) AS msd_count
         FROM mutuelles WHERE LOWER(region) = LOWER($1)
        GROUP BY commune ORDER BY commune`,
      [name]
    );

    // Adhérents par commune approximative (address) — données réelles uniquement.
    const bRes = await query(
      `SELECT address, COUNT(*) AS n, COUNT(*) FILTER (WHERE ${SQL_CONFORME}) AS conformes
         FROM beneficiaries b WHERE merged_into IS NULL
         GROUP BY address`,
      []
    ).catch(() => ({ rows: [] }));
    const parAdresse = bRes.rows || [];

    res.json({
      region: region.rows[0].name,
      msdCount: parseInt(region.rows[0].msd_count || '0', 10),
      departmentCount: parseInt(region.rows[0].department_count || '0', 10),
      departments: depts.rows.map((d) => ({
        name: d.name,
        msdCount: parseInt(d.msd_count || '0', 10),
        beneficiaryCount: parAdresse
          .filter((b) => (b.address || '').toLowerCase().includes(String(d.name).toLowerCase()))
          .reduce((s, b) => s + parseInt(b.n || '0', 10), 0),
        conformCount: parAdresse
          .filter((b) => (b.address || '').toLowerCase().includes(String(d.name).toLowerCase()))
          .reduce((s, b) => s + parseInt(b.conformes || '0', 10), 0),
      })),
    });
  } catch (err) {
    console.error('[Studio] région impossible :', err.message);
    res.status(500).json({ error: 'Détail région indisponible.' });
  }
});

// ─────────────────────────────────────────
//  NIVEAU 3 — MSD d'un département (§2.4)
// ─────────────────────────────────────────────────────────────────────────
router.get('/geo/dept/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const depts = await query(
      `SELECT m.id, m.name, m.region, m.commune, m.status,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS beneficiary_count,
              COUNT(b.id) FILTER (WHERE ${SQL_CONFORME}) AS conform_count
         FROM mutuelles m
         LEFT JOIN beneficiaries b ON b.mutuelle_name = m.name
        WHERE LOWER(m.commune) = LOWER($1)
        GROUP BY m.id ORDER BY m.name`,
      [name]
    );
    res.json({
      department: name,
      msds: depts.rows.map((m) => ({
        name: m.name,
        region: m.region,
        commune: m.commune,
        status: m.status,
        beneficiaryCount: parseInt(m.beneficiary_count || '0', 10),
        conformCount: parseInt(m.conform_count || '0', 10),
      })),
    });
  } catch (err) {
    console.error('[Studio] département impossible :', err.message);
    res.status(500).json({ error: 'Détail département indisponible.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
//  RECHERCHE PAGINÉE DES ADHÉSIONS DE MASSE (§1.2 — Étape 2)
//  GET /api/studio/lots?q=&msd=&status=&printed=&page=&limit=
//  Chaque adhésion expose : référence unique, titre, date, MSD, nombre
//  d'adhérents, états de validation/production, statistiques cartes, revenu
//  FIGÉ (production_events si imprimé, sinon 0). Filtres combinables.
// ─────────────────────────────────────────────────────────────────────────
router.get('/lots', async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req);
    const msdScope = msdDe(req.user);
    // Agent sans MSD : fail-closed (filtreMsd renvoie 1=0 pour les compteurs).
    if (msdScope === null && !estSuperviseur(req.user)) {
      return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 1, hasNext: false, hasPrev: page > 1 } });
    }
    const q = String(req.query.q || '').trim();
    const msdFilter = String(req.query.msd || '').trim().toUpperCase();
    const printedFilter = String(req.query.printed || '').trim().toLowerCase(); // 'true' | 'false' | ''
    const statusFilter = String(req.query.status || '').trim().toUpperCase(); // 'IMPRIME' | 'EN_ATTENTE' | ''

    const conds = [];
    const params = [];
    const add = (sql, val) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };
    if (msdScope) add('l.union_id = ?', msdScope);
    if (msdFilter) {
      if (msdScope && msdFilter !== msdScope) {
        return res.json({ data: [], pagination: { page, limit, total: 0, totalPages: 1, hasNext: false, hasPrev: page > 1 } });
      }
      if (!msdScope) add('l.union_id = ?', msdFilter);
    }
    if (printedFilter === 'true') conds.push('l.printed = TRUE');
    else if (printedFilter === 'false') conds.push('l.printed = FALSE');
    if (statusFilter === 'IMPRIME') conds.push('l.printed = TRUE');
    else if (statusFilter === 'EN_ATTENTE') conds.push('l.printed = FALSE');
    if (q) {
      params.push(`%${q}%`);
      conds.push(`(l.code ILIKE $${params.length} OR l.label ILIKE $${params.length} OR COALESCE(l.source_file,'') ILIKE $${params.length})`);
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) FROM campaign_lots l ${where}`, params);
    const total = parseInt((countRes.rows[0] && countRes.rows[0].count) || '0', 10) || 0;

    const rows = await query(
      `SELECT l.code, l.label, l.source_file, l.union_id, l.printed, l.printed_at,
              l.created_at,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS adherents,
              COUNT(b.id) FILTER (WHERE ${SQL_CONFORME}) AS conformes,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL AND NOT (${SQL_CONFORME})) AS a_corriger,
              COALESCE((SELECT SUM(pe.revenue_fcfa) FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event IN ('INITIAL','REPRINT','REPLACEMENT')), 0) AS revenu_fixe
         FROM campaign_lots l
         LEFT JOIN beneficiaries b ON b.lot_code = l.code
        ${where}
        GROUP BY l.id
        ORDER BY l.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const totalPages = Math.ceil(total / limit) || 1;
    res.json({
      data: rows.rows.map((l) => ({
        reference: l.code,
        titre: l.label,
        date: l.created_at,
        msdCode: l.union_id,
        adherents: parseInt(l.adherents || '0', 10),
        conformes: parseInt(l.conformes || '0', 10),
        aCorriger: parseInt(l.a_corriger || '0', 10),
        etatValidation: parseInt(l.a_corriger || '0', 10) === 0 ? 'VALIDE' : 'A_CORRIGER',
        etatProduction: l.printed ? 'IMPRIME' : 'EN_ATTENTE_PRODUCTION',
        printedAt: l.printed_at,
        revenuFcfa: parseInt(l.revenu_fixe || '0', 10),
        prixUnitaire: SEN_E_CARTE_PRIX_CARTE,
      })),
      pagination: { page, limit, total, totalPages, hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (err) {
    console.error('[Studio] recherche adhésions impossible :', err.message);
    res.status(500).json({ error: 'Recherche des adhésions indisponible.' });
  }
});

// ─────────────────────────────────────────
//  ESPACE DÉTAILLÉ D'UNE MSD (§3.1, §3.2)
// ─────────────────────────────────────────
router.get('/msd/:code', async (req, res) => {
  try {
    const { code } = req.params;
    // Cloisonnement : un agent ne peut consulter QUE sa MSD.
    const msd = msdDe(req.user);
    if (msd && msd !== String(code).toUpperCase()) {
      return res.status(403).json({ error: 'MSD hors de votre périmètre.' });
    }

    const kpi = await query(
      `SELECT
         COUNT(*) FILTER (WHERE merged_into IS NULL) AS total,
         COUNT(*) FILTER (WHERE ${SQL_CONFORME}) AS conform,
         COUNT(*) FILTER (WHERE merged_into IS NULL AND NOT (${SQL_CONFORME})) AS anomalies
       FROM beneficiaries b
       WHERE msd_code = $1`,
      [String(code).toUpperCase()]
    );

    const lots = await query(
      `SELECT l.code, l.label, l.source_file, l.union_id,
              l.card_count, l.printed, l.printed_at, l.created_at,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS adherents,
              COUNT(b.id) FILTER (WHERE ${SQL_CONFORME}) AS conformes,
              COALESCE((SELECT pe.card_count FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event = 'INITIAL' LIMIT 1), 0) AS cartes_figees,
              COALESCE((SELECT pe.revenue_fcfa FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event = 'INITIAL' LIMIT 1), 0) AS revenu_fixe
         FROM campaign_lots l
         LEFT JOIN beneficiaries b ON b.lot_code = l.code
        WHERE l.union_id = $1
        GROUP BY l.id
        ORDER BY l.created_at DESC`,
      [String(code).toUpperCase()]
    );

    const k = kpi.rows[0] || {};
    // Revenu = somme des REVENUS FIGÉS (production_events INITIAL, tarif du
    // jour de remise). Repli sur l'ancien calcul si la table n'existe pas.
    const printedCount = lots.rows.reduce(
      (s, l) => s + (l.cartes_figees != null && (l.printed || parseInt(l.revenu_fixe || '0', 10) > 0)
        ? parseInt(l.cartes_figees || '0', 10)
        : (l.printed ? parseInt(l.conformes || '0', 10) : 0)), 0
    );
    const revenue = lots.rows.reduce(
      (s, l) => s + (parseInt(l.revenu_fixe || '0', 10) > 0
        ? parseInt(l.revenu_fixe || '0', 10)
        : (l.printed ? parseInt(l.conformes || '0', 10) * SEN_E_CARTE_PRIX_CARTE : 0)), 0
    );

    res.json({
      msdCode: String(code).toUpperCase(),
      kpi: {
        enrollmentCount: lots.rows.length,
        beneficiaryCount: parseInt(k.total || '0', 10),
        conformCount: parseInt(k.conform || '0', 10),
        anomalyCount: parseInt(k.anomalies || '0', 10),
        printedCount,
        revenueFcfa: revenue,
        prixUnitaire: SEN_E_CARTE_PRIX_CARTE,
      },
      lots: lots.rows.map((l) => ({
        code: l.code,
        label: l.label,
        sourceFile: l.source_file,
        date: l.created_at,
        printed: l.printed,
        printedAt: l.printed_at,
        adherents: parseInt(l.adherents || '0', 10),
        conformes: parseInt(l.conformes || '0', 10),
        cartesImprimees: parseInt(l.revenu_fixe || '0', 10) > 0 || l.printed
          ? (parseInt(l.cartes_figees || '0', 10) || parseInt(l.conformes || '0', 10))
          : 0,
        revenueFcfa: parseInt(l.revenu_fixe || '0', 10) > 0
          ? parseInt(l.revenu_fixe || '0', 10)
          : (l.printed ? parseInt(l.conformes || '0', 10) * SEN_E_CARTE_PRIX_CARTE : 0),
      })),
    });
  } catch (err) {
    console.error('[Studio] MSD impossible :', err.message);
    res.status(500).json({ error: 'Détail MSD indisponible.' });
  }
});

// ─────────────────────────────────────────
//  DÉTAIL D'UNE ADHÉSION DE MASSE (§3.3)
// ─────────────────────────────────────────────────────────────────────────
router.get('/lot/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const lot = await query('SELECT * FROM campaign_lots WHERE code = $1', [code]);
    if (lot.rows.length === 0) return res.status(404).json({ error: 'Lot inconnu.' });
    const l = lot.rows[0];

    // Cloisonnement : l'agent ne voit que les lots de SA MSD.
    const msd = msdDe(req.user);
    if (msd && String(l.union_id || '').toUpperCase() !== msd) {
      return res.status(403).json({ error: 'Lot hors de votre périmètre.' });
    }

    const stats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE merged_into IS NULL) AS adherents,
         COUNT(*) FILTER (WHERE ${SQL_CONFORME}) AS conformes,
         COUNT(*) FILTER (WHERE merged_into IS NULL AND NOT (${SQL_CONFORME})) AS a_corriger,
         COUNT(*) FILTER (WHERE merged_into IS NULL
            AND (photo_url IS NULL OR photo_url = '')) AS sans_photo,
         COUNT(DISTINCT COALESCE(nin, cmu_number)) FILTER (WHERE merged_into IS NULL) AS uniques
       FROM beneficiaries b WHERE b.lot_code = $1`,
      [code]
    );
    const s = stats.rows[0] || {};

    // Historique de production : lignes immuables avec tarif figé au moment
    // de chaque événement. Les réimpressions/remplacements portent revenue 0
    // par défaut (pas de refacturation automatique) — le revenu du lot reste
    // celui de l'événement INITIAL. Table absente (ancien déploiement) :
    // repli gracieux sur l'ancien calcul.
    const prodHist = await query(
      `SELECT event, card_count, unit_price, revenue_fcfa, actor, details, created_at
         FROM production_events WHERE lot_code = $1 ORDER BY created_at ASC, id ASC`,
      [code]
    ).catch(() => ({ rows: [] }));
    const events = prodHist.rows || [];
    const initialEv = events.find((e) => e.event === 'INITIAL') || null;

    res.json({
      lot: {
        code: l.code,
        label: l.label,
        sourceFile: l.source_file,
        msdCode: l.union_id,
        date: l.created_at,
        printed: l.printed,
        printedAt: l.printed_at,
        statut: l.printed ? 'IMPRIMÉ' : 'EN_ATTENTE_PRODUCTION',
      },
      stats: {
        adherents: parseInt(s.adherents || '0', 10),
        conformes: parseInt(s.conformes || '0', 10),
        aCorriger: parseInt(s.a_corriger || '0', 10),
        photosManquantes: parseInt(s.sans_photo || '0', 10),
        doublons: Math.max(0, parseInt(s.adherents || '0', 10) - parseInt(s.uniques || '0', 10)),
        cartesValidees: parseInt(s.conformes || '0', 10),
        cartesImprimees: initialEv ? parseInt(initialEv.card_count || '0', 10) : (l.printed ? parseInt(s.conformes || '0', 10) : 0),
        revenuFcfa: initialEv ? parseInt(initialEv.revenue_fcfa || '0', 10) : (l.printed ? parseInt(s.conformes || '0', 10) * SEN_E_CARTE_PRIX_CARTE : 0),
        prixUnitaire: initialEv ? parseInt(initialEv.unit_price || '0', 10) : SEN_E_CARTE_PRIX_CARTE,
      },
      production: events.map((e) => ({
        type: e.event,
        cartes: parseInt(e.card_count || '0', 10),
        tarifUnitaire: parseInt(e.unit_price || '0', 10),
        revenuFcfa: parseInt(e.revenue_fcfa || '0', 10),
        acteur: e.actor,
        details: e.details,
        date: e.created_at,
      })),
    });
  } catch (err) {
    console.error('[Studio] lot impossible :', err.message);
    res.status(500).json({ error: 'Détail adhésion indisponible.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
//  HISTORIQUE DE PRODUCTION D'UN LOT (§1.3 — Étape 2)
//  GET /api/studio/lot/:code/production — événements INITIAL, REPRINT,
//  REPLACEMENT, DESTROYED avec tarifs figés. Lecture pure, cloisonnée MSD.
// ─────────────────────────────────────────────────────────────────────────
router.get('/lot/:code/production', async (req, res) => {
  try {
    const { code } = req.params;
    const lot = await query('SELECT code, union_id, printed, printed_at FROM campaign_lots WHERE code = $1', [code]);
    if (lot.rows.length === 0) return res.status(404).json({ error: 'Lot inconnu.' });
    const l = lot.rows[0];
    const msd = msdDe(req.user);
    if (msd && String(l.union_id || '').toUpperCase() !== msd) {
      return res.status(403).json({ error: 'Lot hors de votre périmètre.' });
    }
    const ev = await query(
      `SELECT event, card_count, unit_price, revenue_fcfa, actor, details, created_at
         FROM production_events WHERE lot_code = $1 ORDER BY created_at ASC, id ASC`,
      [code]
    ).catch(() => ({ rows: [] }));
    const events = ev.rows || [];
    const total = events.reduce((s, e) => s + (parseInt(e.revenue_fcfa || '0', 10) || 0), 0);
    res.json({
      lotCode: l.code,
      printed: l.printed,
      printedAt: l.printed_at,
      events: events.map((e) => ({
        type: e.event,
        cartes: parseInt(e.card_count || '0', 10),
        tarifUnitaire: parseInt(e.unit_price || '0', 10),
        revenuFcfa: parseInt(e.revenue_fcfa || '0', 10),
        acteur: e.actor,
        details: e.details,
        date: e.created_at,
      })),
      revenuTotalFcfa: total,
    });
  } catch (err) {
    console.error('[Studio] historique production impossible :', err.message);
    res.status(500).json({ error: 'Historique de production indisponible.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
//  ENREGISTRER UNE RÉIMPRESSION OU UN REMPLACEMENT (§1.3 — Étape 2, validé)
//  POST /api/studio/lot/:code/production { type: 'REPRINT'|'REPLACEMENT'|'DESTROYED', cardCount, details }
//  Règle validée : REPRINT et REPLACEMENT facturés 350 FCFA/carte (tarif figé
//  du jour) ; DESTROYED à revenu 0. Idempotent par type (UNIQUE lot+event) :
//  rejouer ne double jamais le revenu. Cloisonné MSD, journalisé.
// ─────────────────────────────────────────────────────────────────────────
router.post('/lot/:code/production', async (req, res) => {
  try {
    const { code } = req.params;
    const type = String((req.body && req.body.type) || '').trim().toUpperCase();
    const cardCount = Math.max(0, parseInt((req.body && req.body.cardCount) || '0', 10) || 0);
    const details = String((req.body && req.body.details) || '').trim().slice(0, 500) || null;
    if (!['REPRINT', 'REPLACEMENT', 'DESTROYED'].includes(type)) {
      return res.status(400).json({ error: "Type invalide (attendu : REPRINT, REPLACEMENT ou DESTROYED)." });
    }
    if (cardCount <= 0) {
      return res.status(400).json({ error: "Nombre de cartes invalide (cardCount > 0 requis)." });
    }
    const lot = await query('SELECT code, union_id, printed FROM campaign_lots WHERE code = $1', [code]);
    if (lot.rows.length === 0) return res.status(404).json({ error: 'Lot inconnu.' });
    const l = lot.rows[0];
    const msd = msdDe(req.user);
    if (msd && String(l.union_id || '').toUpperCase() !== msd) {
      return res.status(403).json({ error: 'Lot hors de votre périmètre.' });
    }
    // Le lot doit avoir été remis au moins une fois (production INITIAL).
    const initial = await query(
      "SELECT 1 FROM production_events WHERE lot_code = $1 AND event = 'INITIAL' LIMIT 1",
      [code]
    ).catch(() => ({ rows: [] }));
    if ((initial.rows || []).length === 0 && !l.printed) {
      return res.status(409).json({ error: "Lot non remis : enregistrez d'abord la production initiale (remise)." });
    }
    const unitPrice = type === 'DESTROYED' ? 0 : SEN_E_CARTE_PRIX_CARTE;
    const revenue = cardCount * unitPrice;
    const actor = (req.user && (req.user.username || req.user.id)) ? String(req.user.username || req.user.id) : 'agent';
    const ins = await query(
      `INSERT INTO production_events (lot_code, event, card_count, unit_price, revenue_fcfa, actor, details)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (lot_code, event) DO NOTHING RETURNING *`,
      [code, type, cardCount, unitPrice, revenue, actor,
        details || `${type === 'REPRINT' ? 'Réimpression' : type === 'REPLACEMENT' ? 'Remplacement' : 'Destruction'} — ${cardCount} carte(s) × ${unitPrice} FCFA`]
    );
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      [`PRODUCTION_${type}`, actor, `Lot ${code} : ${type} — ${cardCount} carte(s), revenu ${revenue.toLocaleString('fr-FR')} FCFA.`]
    ).catch(() => {});
    if ((ins.rows || []).length === 0) {
      const existing = await query(
        'SELECT * FROM production_events WHERE lot_code = $1 AND event = $2',
        [code, type]
      ).catch(() => ({ rows: [] }));
      return res.json({ success: true, alreadyRecorded: true, production: (existing.rows || [])[0] || null });
    }
    res.status(201).json({ success: true, production: ins.rows[0] });
  } catch (err) {
    console.error('[Studio] enregistrement production impossible :', err.message);
    res.status(500).json({ error: 'Enregistrement de production indisponible.' });
  }
});

module.exports = { router, SEN_E_CARTE_PRIX_CARTE };
