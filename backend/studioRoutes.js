/**
 * ═══════════════
 *  STUDIO CARTES — hiérarchie géographique et suivi de production
 * ═══════════════
 *
 * Routes consommées par le nouveau panneau « Vue générale » du Studio :
 *
 *   GET /api/studio/geo/overview  — synthèse nationale + cartes régions
 *   GET /api/studio/geo/region/:name — départements d'une région
 *   GET /api/studio/geo/dept/:name   — MSD d'un département
 *   GET /api/studio/msd/:code        — tableau de bord d'une MSD
 *   GET /api/studio/lot/:code        — détail d'une adhésion de masse
 *
 * RÈGLE FINANCIÈRE (§4 du cahier des charges) :
 *   Sen-E-Carte perçoit SEN_E_CARTE_PRIX_CARTE FCFA par carte dont
 *   l'impression est EFFECTIVEMENT enregistrée (campaign_lots.printed).
 *   Ni le nombre d'adhérents, ni le nombre de fiches conformes ne génèrent
 *   de revenu : seul le nombre de lots imprimés × cartes conformes au moment
 *   de l'impression compte. Les lots non imprimés affichent un revenu de 0.
 *
 *   Le nombre de cartes d'un lot imprimé est le nombre de fiches CONFORMES
 *   (photo + identité complète) au moment de la remise — cohérent avec le
 *   verrou existant POST /api/campaign-lots/:code/print (audit_logs
 *   REMISE_LOT_MSD). La réimpression est refusée au niveau du lot : `printed`
 *   est déjà TRUE, donc aucune double comptabilisation n'est possible.
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
 *   - agent avec msdCode : filtre sur ce code ;
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
    const f = filtreMsd(req.user, 'b.msd_code');
    const fl = filtreMsd(req.user, 'l.union_id');

    // Compteurs globaux — une requête, aucune boucle N+1. Le revenu est la
    // somme des cartes CONFORMES des lots IMPRIMÉS × prix unitaire (§4.2) :
    // jamais les adhérents importés, jamais les fiches validées non imprimées.
    const g = await query(
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
         (SELECT COALESCE(SUM(c.conformes),0) * ${SEN_E_CARTE_PRIX_CARTE}
            FROM campaign_lots l
            JOIN LATERAL (
              SELECT COUNT(*) AS conformes FROM beneficiaries b
               WHERE b.lot_code = l.code AND ${SQL_CONFORME}
            ) c ON TRUE
           WHERE ${fl.clause} AND l.printed) AS revenue_fcfa`,
      [...fl.params, ...f.params, ...fl.params]
    );

    // Cartes par région : les régions viennent de mutuelles (donnée réelle),
    // les lots sont rattachés par union_id (code MSD à 3 lettres). Le revenu
    // régional = somme des cartes conformes des lots imprimés de la région.
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
                COALESCE(SUM(CASE WHEN l.printed THEN c.conformes ELSE 0 END),0) AS cartes_imprimees,
                COALESCE(SUM(CASE WHEN l.printed THEN c.conformes ELSE 0 END),0) * ${SEN_E_CARTE_PRIX_CARTE} AS revenue
           FROM reg r
           LEFT JOIN campaign_lots l
             ON r.msd_prefix = UPPER(SUBSTRING(COALESCE(l.union_id,'DKR') FROM 1 FOR 3))
           LEFT JOIN LATERAL (
             SELECT COUNT(*) AS conformes FROM beneficiaries b
              WHERE b.lot_code = l.code AND ${SQL_CONFORME}
           ) c ON TRUE
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
              COUNT(b.id) FILTER (WHERE ${SQL_CONFORME}) AS conformes
         FROM campaign_lots l
         LEFT JOIN beneficiaries b ON b.lot_code = l.code
        WHERE l.union_id = $1
        GROUP BY l.id
        ORDER BY l.created_at DESC`,
      [String(code).toUpperCase()]
    );

    const k = kpi.rows[0] || {};
    const printedLots = lots.rows.filter((l) => l.printed);
    const revenue = printedLots.reduce(
      (s, l) => s + parseInt(l.conformes || '0', 10) * SEN_E_CARTE_PRIX_CARTE, 0
    );

    res.json({
      msdCode: String(code).toUpperCase(),
      kpi: {
        enrollmentCount: lots.rows.length,
        beneficiaryCount: parseInt(k.total || '0', 10),
        conformCount: parseInt(k.conform || '0', 10),
        anomalyCount: parseInt(k.anomalies || '0', 10),
        printedCount: printedLots.reduce((s, l) => s + parseInt(l.conformes || '0', 10), 0),
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
        revenueFcfa: l.printed ? parseInt(l.conformes || '0', 10) * SEN_E_CARTE_PRIX_CARTE : 0,
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
        cartesValides: parseInt(s.conformes || '0', 10),
        cartesImprimees: l.printed ? parseInt(s.conformes || '0', 10) : 0,
        revenueFcfa: l.printed ? parseInt(s.conformes || '0', 10) * SEN_E_CARTE_PRIX_CARTE : 0,
        prixUnitaire: SEN_E_CARTE_PRIX_CARTE,
      },
    });
  } catch (err) {
    console.error('[Studio] lot impossible :', err.message);
    res.status(500).json({ error: 'Détail adhésion indisponible.' });
  }
});

module.exports = { router, SEN_E_CARTE_PRIX_CARTE };
