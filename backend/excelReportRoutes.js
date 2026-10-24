const express = require('express');
const { query } = require('./db');
const { authenticateToken, requireRole } = require('./rbac');
const XLSX = require('xlsx');

const router = express.Router();

const msdOfUser = (user) => {
  if (!user) return null;
  if (user.role === 'admin') return null; // Super Admin : tout
  return user.msdCode ? String(user.msdCode).toUpperCase() : undefined;
};

// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// RAPPORTS EXCEL — Export de données cloisonné par MSD
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
// GET /api/excel/report/:type — génère un fichier .xlsx (bénéficiaires | cartes | production | audit)
// ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
router.get('/api/excel/report/:type', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const user = req.user;
  const msd = msdOfUser(user);
  const type = String(req.params.type || '').toLowerCase();
  const allowed = ['beneficiaries', 'cards', 'production', 'audit', 'studio', 'security', 'lifecycle'];
  if (!allowed.includes(type)) {
    return res.status(400).json({ error: 'Type de rapport invalide.' });
  }

  // Rapports multi-feuilles : chaque feuille = { name, columns, rows }.
  // Journalisation de l'export (§5.7 : les exports sensibles sont tracés).
  const multi = type === 'studio' || type === 'security' || type === 'lifecycle';
  const sheets = multi ? [] : null;
  const neutralize = (v) => {
    // Neutralise les cellules qui pourraient être interprétées comme des
    // formules Excel (=, +, -, @) provenant de données utilisateur.
    if (typeof v === 'string' && /^[=+@\-].*/.test(v)) return "'" + v;
    return v;
  };
  const addSheet = (name, columns, rows) => {
    sheets.push({
      name: name.slice(0, 31),
      columns,
      rows: rows.map((r) => columns.map((c) => neutralize(r[c] === null || r[c] === undefined ? '' : r[c])))
    });
  };

  const msdFilter = msd ? `AND UPPER(b.msd_code) = $1` : '';
  const params = msd ? [msd] : [];

  let sql = '';
  let sheetName = 'Rapport';
  let columns = [];

  try {
    switch (type) {
      case 'beneficiaries':
        sheetName = 'Beneficiaires';
        columns = [
          'cmu_number', 'nom', 'prenom', 'date_naissance', 'sexe', 'telephone',
          'email', 'ville', 'quartier', 'msd_code', 'date_adhesion', 'statut',
        ];
        sql = `
          SELECT ${columns.join(', ')}
          FROM beneficiaries b
          WHERE 1=1 ${msdFilter}
          ORDER BY b.nom, b.prenom
        `;
        break;
      case 'cards':
        sheetName = 'Cartes';
        columns = [
          'cmu_number', 'card_number', 'card_status', 'issue_date', 'expiry_date',
          'blocked_at', 'unblocked_at', 'revoked_at', 'replaced_by', 'msd_code',
        ];
        sql = `
          SELECT ${columns.join(', ')}
          FROM beneficiaries b
          WHERE b.card_number IS NOT NULL ${msdFilter}
          ORDER BY b.card_number
        `;
        break;
      case 'production':
        sheetName = 'Production';
        columns = [
          'cmu_number', 'nom', 'prenom', 'card_status', 'issue_date', 'expiry_date', 'msd_code',
        ];
        sql = `
          SELECT ${columns.join(', ')}
          FROM beneficiaries b
          WHERE b.card_number IS NOT NULL ${msdFilter}
          ORDER BY b.issue_date DESC NULLS LAST
        `;
        break;
      case 'audit':
        sheetName = 'Audit';
        columns = ['id', 'action', 'actor', 'details', 'created_at'];
        sql = `
          SELECT ${columns.join(', ')}
          FROM audit_logs al
          WHERE 1=1 ${msd ? `AND al.details ILIKE $${params.length + 1}` : ''}
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT 10000
        `;
        if (msd) params.push(`%${msd}%`);
            break;
        }
        // ”€”€ Rapports multi-feuilles ”€”€
        if (type === 'studio') {
        // Feuille Synthèse — agrégats cohérents avec /api/studio/geo/overview.
        const m = msd ? 'AND UPPER(msd_code) = $1' : '';
        const g = await query(
          `SELECT
             (SELECT COUNT(DISTINCT NULLIF(region,'')) FROM beneficiaries WHERE 1=1 ${m}) AS regions,
             (SELECT COUNT(DISTINCT NULLIF(department,'')) FROM beneficiaries WHERE 1=1 ${m}) AS departements,
             (SELECT COUNT(DISTINCT msd_code) FROM beneficiaries WHERE 1=1 ${m}) AS msd,
             (SELECT COUNT(DISTINCT lot_code) FROM beneficiaries WHERE lot_code IS NOT NULL AND lot_code <> '' ${m}) AS adhesions,
             (SELECT COUNT(*) FROM beneficiaries WHERE 1=1 ${m}) AS adherents,
             (SELECT COUNT(*) FROM beneficiaries WHERE lot_code IS NOT NULL AND lot_code <> '' ${m}
                AND COALESCE(first_name,'') <> '' AND COALESCE(last_name,'') <> '' AND COALESCE(birth_date::text,'') <> '') AS conformes,
             (SELECT COUNT(*) FROM beneficiaries WHERE lot_code IS NOT NULL AND lot_code <> '' ${m} AND COALESCE(printed,false) = true) AS imprimees`,
          msd ? [msd] : []
        );
        const row = g.rows[0] || {};
        const prix = 350;
        const rev = Number(row.imprimees || 0) * prix;
        addSheet('Synthese', ['Indicateur', 'Valeur'], [
          { Indicateur: 'Regions', Valeur: row.regions || 0 },
          { Indicateur: 'Departements', Valeur: row.departements || 0 },
          { Indicateur: 'MSD', Valeur: row.msd || 0 },
          { Indicateur: 'Adhesions de masse', Valeur: row.adhesions || 0 },
          { Indicateur: 'Adherents', Valeur: row.adherents || 0 },
          { Indicateur: 'Dossiers conformes', Valeur: row.conformes || 0 },
          { Indicateur: 'Cartes imprimees', Valeur: row.imprimees || 0 },
          { Indicateur: 'Tarif unitaire (FCFA)', Valeur: prix },
          { Indicateur: 'Revenus Sen-E-Carte (FCFA)', Valeur: rev },
          { Indicateur: 'Date de generation', Valeur: new Date().toISOString() }
        ]);
        // Feuille Adhésions de masse — un lot par ligne.
        const lots = await query(
          `SELECT b.lot_code AS code,
                  MIN(b.msd_code) AS msd_code,
                  MIN(b.created_at)::date AS date_adhesion,
                  COUNT(*) AS adherents,
                  COUNT(*) FILTER (WHERE COALESCE(b.first_name,'') <> '' AND COALESCE(b.last_name,'') <> '' AND COALESCE(b.birth_date::text,'') <> '' AND COALESCE(b.photo_url::text,b.photo_path::text,'') <> '') AS conformes,
                  COUNT(*) FILTER (WHERE COALESCE(b.printed,false) = true) AS imprimees
             FROM beneficiaries b
            WHERE b.lot_code IS NOT NULL AND b.lot_code <> '' ${msd ? 'AND UPPER(b.msd_code) = $1' : ''}
            GROUP BY b.lot_code ORDER BY b.lot_code`,
          msd ? [msd] : []
        );
        addSheet('Adhesions de masse', ['code', 'msd_code', 'date_adhesion', 'adherents', 'conformes', 'non_conformes', 'cartes_imprimees', 'revenu_fcfa'],
          lots.rows.map((l) => ({
            code: l.code, msd_code: l.msd_code, date_adhesion: l.date_adhesion,
            adherents: Number(l.adherents || 0), conformes: Number(l.conformes || 0),
            non_conformes: Number(l.adherents || 0) - Number(l.conformes || 0),
            cartes_imprimees: Number(l.imprimees || 0),
            revenu_fcfa: Number(l.imprimees || 0) * prix
          })));
        // Feuille Revenus par MSD.
        const revs = await query(
          `SELECT b.msd_code,
                  COUNT(*) FILTER (WHERE COALESCE(b.printed,false) = true) AS imprimees
             FROM beneficiaries b
            WHERE b.lot_code IS NOT NULL AND b.lot_code <> '' ${msd ? 'AND UPPER(b.msd_code) = $1' : ''}
            GROUP BY b.msd_code ORDER BY b.msd_code`,
          msd ? [msd] : []
        );
        addSheet('Revenus Sen-E-Carte', ['msd_code', 'cartes_imprimees', 'tarif_fcfa', 'revenu_fcfa'],
          revs.rows.map((r) => ({
            msd_code: r.msd_code, cartes_imprimees: Number(r.imprimees || 0),
            tarif_fcfa: prix, revenu_fcfa: Number(r.imprimees || 0) * prix
          })));
    }
    if (type === 'lifecycle') {
        const byStatus = await query(
          `SELECT b.cmu_number, b.first_name, b.last_name, b.card_status, b.msd_code,
                  b.card_blocked_at, b.card_blocked_reason, b.card_revoked_at,
                  b.card_revoked_reason, b.card_replaced_by, b.created_at
             FROM beneficiaries b
            WHERE b.card_status IS NOT NULL AND b.card_status <> '' ${msd ? 'AND UPPER(b.msd_code) = $1' : ''}
            ORDER BY b.cmu_number`,
          msd ? [msd] : []
        );
        addSheet('Cartes', ['cmu_number', 'nom', 'prenom', 'statut', 'msd_code', 'bloquee_le', 'motif_blocage', 'revoquee_le', 'motif_revocation', 'remplacee_par', 'creee_le'],
          byStatus.rows.map((r) => ({
            cmu_number: r.cmu_number, nom: r.last_name, prenom: r.first_name,
            statut: r.card_status, msd_code: r.msd_code,
            bloquee_le: r.card_blocked_at, motif_blocage: r.card_blocked_reason,
            revoquee_le: r.card_revoked_at, motif_revocation: r.card_revoked_reason,
            remplacee_par: r.card_replaced_by, creee_le: r.created_at
          })));
        const evts = await query(
          `SELECT cle.cmu_number, cle.event, cle.reason, cle.details, cle.actor,
                  cle.msd_code, cle.request_ref, cle.replacement_cmu, cle.created_at
             FROM card_lifecycle_events cle
            WHERE 1=1 ${msd ? 'AND UPPER(cle.msd_code) = $1' : ''}
            ORDER BY cle.created_at DESC, cle.id DESC LIMIT 10000`,
          msd ? [msd] : []
        );
            addSheet('Evenements', ['cmu_number', 'evenement', 'motif', 'details', 'acteur', 'msd_code', 'reference_demande', 'remplacee_par', 'date'],
              evts.rows);
        }
        if (type === 'security') {
        const audit = await query(
          `SELECT al.id, al.action, al.actor, al.details, al.created_at
             FROM audit_logs al
            WHERE 1=1 ${msd ? 'AND al.details ILIKE $1' : ''}
            ORDER BY al.created_at DESC, al.id DESC LIMIT 10000`,
          msd ? [`%${msd}%`] : []
        );
        addSheet('Evenements securite', ['id', 'action', 'acteur', 'details', 'date'], audit.rows);
        // Demandes administratives en cours.
        const reqs = await query(
          `SELECT reference, cmu_number, operation_type, status, reason,
                  identity_verified, requested_by, msd_code, created_at, resolved_at
             FROM admin_requests
            WHERE 1=1 ${msd ? 'AND msd_code = $1' : ''}
            ORDER BY created_at DESC LIMIT 10000`,
          msd ? [msd] : []
        );
        addSheet('Demandes administratives', ['reference', 'cmu_number', 'operation', 'statut', 'motif', 'identite_verifiee', 'demande_par', 'msd_code', 'creee_le', 'resolue_le'],
          reqs.rows.map((r) => ({ ...r, identite_verifiee: r.identity_verified ? 'OUI' : 'NON' })));
    }

    // Construire le classeur XLSX — mono-feuille OU multi-feuilles.
    const wb = XLSX.utils.book_new();
    if (multi && sheets.length > 0) {
      for (const s of sheets) {
        const wsData = [s.columns, ...s.rows.map((r) => s.columns.map((c) => r[c] === null || r[c] === undefined ? '' : r[c]))];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, s.name);
      }
    } else {
      const result = await query(sql, params);
      const rows = result.rows || [];
      const wsData = [columns, ...rows.map((r) => columns.map((c) => neutralize(r[c] === null || r[c] === undefined ? '' : r[c])))];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mutualis-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('[Excel] report error:', err.message);
    res.status(500).json({ error: 'Indisponible.' });
  }
});

// ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
//  RAPPORTS COMPL‰MENTAIRES (§5.1 / §5.2 / §5.4 / §5.5)
//  Le format historique « /api/excel/report/:type » est conservé tel quel :
//  ces routes ajoutent des classeurs PLUS RICHES, sans rien remplacer.
// ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
const {
  buildTableSheet, buildKpiSheet, buildWorkbook, reportReference,
} = require('./excelWorkbook');
const { listCards } = require('./accountCardService');
const { securityOverview, securityAlerts } = require('./securityMonitor');
const { actorOf } = require('./auditTrail');
const { recordAudit } = require('./auditTrail');

/** Envoi commun d'un classeur XLSX — aucun fichier n'est servi d'une URL publique. */
function sendWorkbook(res, buffer, fileName) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}

const dateStamp = () => new Date().toISOString().slice(0, 10);

// ”€”€ §5.1 Rapport complet Studio Cartes ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/excel/studio/:scope', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const msd = msdOfUser(req.user);
  const target = String(req.params.scope || 'national').toLowerCase();
  if (msd && target !== 'national' && target.toUpperCase() !== msd) {
    return res.status(403).json({ error: 'Rapport hors de votre périmètre MSD.' });
  }
  const scope = msd || (target === 'national' ? null : target.toUpperCase());
  const ref = reportReference('STD');
  try {
    const filter = scope ? 'AND UPPER(b.msd_code) = $1' : '';
    const fl = scope ? 'AND UPPER(l.union_id) = $1' : '';
    const params = scope ? [scope] : [];

    const synth = await query(
      `SELECT
         (SELECT COUNT(DISTINCT region) FROM mutuelles) AS regions,
         (SELECT COUNT(DISTINCT commune) FROM mutuelles) AS departements,
         (SELECT COUNT(*) FROM mutuelles) AS msds,
         (SELECT COUNT(*) FROM campaign_lots l WHERE 1=1 ${fl}) AS adhesions,
         (SELECT COUNT(*) FROM beneficiaries b WHERE b.merged_into IS NULL ${filter}) AS adherents,
         (SELECT COUNT(*) FROM beneficiaries b WHERE b.card_status = 'active' ${filter}) AS cartes_valides,
         (SELECT COUNT(*) FROM beneficiaries b WHERE b.card_status = 'blocked' ${filter}) AS cartes_bloquees,
         (SELECT COUNT(*) FROM beneficiaries b WHERE b.card_status = 'revoked' ${filter}) AS cartes_revoquees,
         (SELECT COALESCE(SUM(pe.card_count),0) FROM production_events pe JOIN campaign_lots l ON l.code = pe.lot_code
           WHERE pe.event IN ('INITIAL','REPRINT','REPLACEMENT') ${fl}) AS cartes_imprimees,
         (SELECT COALESCE(SUM(pe.revenue_fcfa),0) FROM production_events pe JOIN campaign_lots l ON l.code = pe.lot_code
           WHERE pe.event IN ('INITIAL','REPRINT','REPLACEMENT') ${fl}) AS revenus`,
      params
    ).catch(() => ({ rows: [{}] }));
    const g = (synth.rows && synth.rows[0]) || {};

    const regions = await query(
      `SELECT m.region AS region, COUNT(DISTINCT m.commune) AS departements, COUNT(*) AS msds
         FROM mutuelles m GROUP BY m.region ORDER BY m.region`
    ).catch(() => ({ rows: [] }));
    const depts = await query(
      `SELECT m.region AS region, m.commune AS departement, COUNT(*) AS msds
         FROM mutuelles m GROUP BY m.region, m.commune ORDER BY m.region, m.commune`
    ).catch(() => ({ rows: [] }));
    const msdRows = await query(
      `SELECT m.name AS msd, m.region, m.commune AS departement, m.status,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS adherents
         FROM mutuelles m LEFT JOIN beneficiaries b ON b.mutuelle_name = m.name
        GROUP BY m.id ORDER BY m.name`
    ).catch(() => ({ rows: [] }));
    const lots = await query(
      `SELECT l.code AS reference, l.label AS titre, l.created_at AS date, l.union_id AS msd,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS adherents,
              l.printed AS imprime,
              COALESCE((SELECT SUM(pe.card_count) FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event IN ('INITIAL','REPRINT','REPLACEMENT')),0) AS cartes_imprimees,
              COALESCE((SELECT SUM(pe.revenue_fcfa) FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event IN ('INITIAL','REPRINT','REPLACEMENT')),0) AS revenu_fcfa
         FROM campaign_lots l LEFT JOIN beneficiaries b ON b.lot_code = l.code
        WHERE 1=1 ${fl}
        GROUP BY l.id ORDER BY l.created_at DESC`,
      params
    ).catch(() => ({ rows: [] }));
    const prod = await query(
      `SELECT pe.lot_code AS lot, pe.event AS type, pe.card_count AS cartes,
              pe.unit_price AS tarif_unitaire, pe.revenue_fcfa AS revenu, pe.actor AS acteur, pe.created_at AS date
         FROM production_events pe
         JOIN campaign_lots l ON l.code = pe.lot_code
        WHERE 1=1 ${fl} ORDER BY pe.created_at DESC`,
      params
    ).catch(() => ({ rows: [] }));

    const sheets = [
      {
        name: 'Synthese',
        sheet: buildKpiSheet([
          ['Périmètre', scope || 'National'],
          ['Référence du rapport', ref],
          ['Date de génération', new Date().toISOString()],
          ['Régions', Number(g.regions || 0)],
          ['Départements', Number(g.departements || 0)],
          ['MSD', Number(g.msds || 0)],
          ['Adhésions de masse', Number(g.adhesions || 0)],
          ['Adhérents', Number(g.adherents || 0)],
          ['Cartes validées (actives)', Number(g.cartes_valides || 0)],
          ['Cartes bloquées', Number(g.cartes_bloquees || 0)],
          ['Cartes révoquées', Number(g.cartes_revoquees || 0)],
          ['Cartes imprimées', Number(g.cartes_imprimees || 0)],
          ['Revenus Sen-E-Carte (FCFA)', Number(g.revenus || 0)],
          ['Tarif de référence (FCFA)', 350],
        ]),
      },
      { name: 'Regions', sheet: buildTableSheet(['region', 'departements', 'msds'], regions.rows || []) },
      { name: 'Departements', sheet: buildTableSheet(['region', 'departement', 'msds'], depts.rows || []) },
      { name: 'MSD', sheet: buildTableSheet(['msd', 'region', 'departement', 'status', 'adherents'], msdRows.rows || []) },
      {
        name: 'Adhesions de masse',
        sheet: buildTableSheet(['reference', 'titre', 'date', 'msd', 'adherents', 'imprime', 'cartes_imprimees', 'revenu_fcfa'], lots.rows || []),
      },
      {
        name: 'Production des cartes',
        sheet: buildTableSheet(['lot', 'type', 'cartes', 'tarif_unitaire', 'revenu', 'acteur', 'date'], prod.rows || []),
      },
      {
        name: 'Revenus Sen-E-Carte',
        sheet: buildTableSheet(['reference', 'msd', 'cartes_imprimees', 'revenu_fcfa'],
          (lots.rows || []).map((l) => ({ reference: l.reference, msd: l.msd, cartes_imprimees: Number(l.cartes_imprimees || 0), revenu_fcfa: Number(l.revenu_fcfa || 0) })),
          { summary: [`Revenu total : ${Number(g.revenus || 0).toLocaleString('fr-FR')} FCFA`] }),
      },
    ];
    const buffer = buildWorkbook(sheets);
    await recordAudit({
      action: 'EXPORT_RAPPORT', actor: actorOf(req.user),
      details: `Rapport Excel Studio Cartes ${ref} (${scope || 'national'}) — 7 feuilles.`,
      objectType: 'REPORT', objectRef: ref, msdCode: scope, result: 'SUCCESS', severity: 'WARNING',
    });
    sendWorkbook(res, buffer, `studio-cartes-${scope || 'national'}-${dateStamp()}.xlsx`);
  } catch (err) {
    console.error('[Excel] rapport studio impossible :', err.message);
    res.status(500).json({ error: 'Rapport Studio indisponible.' });
  }
});

// ”€”€ §5.2 Rapport d'une MSD ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/excel/msd/:code', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const msd = msdOfUser(req.user);
  const code = String(req.params.code || '').toUpperCase();
  if (msd && code !== msd) return res.status(403).json({ error: 'Rapport hors de votre périmètre MSD.' });
  const ref = reportReference('MSD');
  try {
    const lots = await query(
      `SELECT l.code AS reference, l.label AS titre, l.created_at AS date, l.printed AS imprime,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL) AS adherents,
              COUNT(b.id) FILTER (WHERE b.merged_into IS NULL AND NOT (
                b.photo_url IS NOT NULL AND b.photo_url <> '' AND COALESCE(b.first_name,'') <> ''
                AND COALESCE(b.last_name,'') <> '' AND COALESCE(b.birth_date,'') <> '')) AS a_corriger,
              COALESCE((SELECT SUM(pe.card_count) FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event IN ('INITIAL','REPRINT','REPLACEMENT')),0) AS cartes_imprimees,
              COALESCE((SELECT SUM(pe.revenue_fcfa) FROM production_events pe
                         WHERE pe.lot_code = l.code AND pe.event IN ('INITIAL','REPRINT','REPLACEMENT')),0) AS revenu_fcfa
         FROM campaign_lots l LEFT JOIN beneficiaries b ON b.lot_code = l.code
        WHERE UPPER(l.union_id) = $1
        GROUP BY l.id ORDER BY l.created_at DESC`,
      [code]
    ).catch(() => ({ rows: [] }));
    const cardsRows = await listCards(req.user, { msdCode: code, limit: 200 });
    const toTreat = (lots.rows || []).filter((l) => Number(l.a_corriger || 0) > 0);
    const totalRevenue = (lots.rows || []).reduce((s, l) => s + Number(l.revenu_fcfa || 0), 0);
    const sheets = [
      {
        name: 'Synthese',
        sheet: buildKpiSheet([
          ['MSD', code],
          ['Référence du rapport', ref],
          ['Date de génération', new Date().toISOString()],
          ['Adhésions de masse', (lots.rows || []).length],
          ['Adhérents', (lots.rows || []).reduce((s, l) => s + Number(l.adherents || 0), 0)],
          ['Cartes imprimées', (lots.rows || []).reduce((s, l) => s + Number(l.cartes_imprimees || 0), 0)],
          ['Revenus Sen-E-Carte (FCFA)', totalRevenue],
          ['Dossiers restant à traiter', toTreat.reduce((s, l) => s + Number(l.a_corriger || 0), 0)],
        ]),
      },
      { name: 'Adhesions de masse', sheet: buildTableSheet(['reference', 'titre', 'date', 'adherents', 'imprime', 'cartes_imprimees', 'revenu_fcfa'], lots.rows || []) },
      { name: 'Cartes imprimees', sheet: buildTableSheet(['cmu_number', 'first_name', 'last_name', 'card_status', 'card_blocked_at', 'card_revoked_at'], cardsRows.rows || []) },
      { name: 'Revenus', sheet: buildTableSheet(['reference', 'cartes_imprimees', 'revenu_fcfa'], lots.rows || [], { summary: [`Total : ${totalRevenue.toLocaleString('fr-FR')} FCFA`] }) },
      { name: 'A traiter', sheet: buildTableSheet(['reference', 'titre', 'adherents', 'a_corriger'], toTreat) },
    ];
    const buffer = buildWorkbook(sheets);
    await recordAudit({
      action: 'EXPORT_RAPPORT', actor: actorOf(req.user),
      details: `Rapport Excel MSD ${code} (${ref}) — 5 feuilles.`,
      objectType: 'REPORT', objectRef: ref, msdCode: code, result: 'SUCCESS', severity: 'WARNING',
    });
    sendWorkbook(res, buffer, `msd-${code}-${dateStamp()}.xlsx`);
  } catch (err) {
    console.error('[Excel] rapport MSD impossible :', err.message);
    res.status(500).json({ error: 'Rapport MSD indisponible.' });
  }
});

// ”€”€ §5.4 Rapport de gestion des cartes ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/excel/cards-report', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const ref = reportReference('CRD');
  try {
    const status = String(req.query.status || '').toLowerCase() || null;
    const cardsPage = await listCards(req.user, { status, limit: 200 });
    const msd = msdOfUser(req.user);
    const events = await query(
      `SELECT cle.cmu_number AS matricule, cle.event AS evenement, cle.reason AS motif,
              cle.actor AS agent, cle.request_ref AS reference_demande, cle.created_at AS date
         FROM card_lifecycle_events cle
        WHERE cle.created_at >= NOW() - INTERVAL '180 days'
          ${msd ? "AND UPPER(COALESCE(cle.msd_code,'')) = $1" : ''}
        ORDER BY cle.created_at DESC LIMIT 5000`,
      msd ? [msd] : []
    ).catch(() => ({ rows: [] }));
    const resets = await query(
      `SELECT pr.cmu_number AS matricule, pr.requested_by AS agent, pr.created_at AS demande_le,
              pr.expires_at AS expire_le, pr.used AS utilise
         FROM password_resets pr
        WHERE pr.created_at >= NOW() - INTERVAL '90 days'
          ${msd ? 'AND EXISTS (SELECT 1 FROM beneficiaries b WHERE b.cmu_number = pr.cmu_number AND UPPER(b.msd_code) = $1)' : ''}
        ORDER BY pr.created_at DESC LIMIT 5000`,
      msd ? [msd] : []
    ).catch(() => ({ rows: [] }));
    const byStatus = (s) => cardsPage.rows.filter((c) => (c.card_status || 'active') === s).length;
    const sheets = [
      {
        name: 'Synthese',
        sheet: buildKpiSheet([
          ['Périmètre', msd || 'TOUTES (Super Admin)'],
          ['Référence du rapport', ref],
          ['Date de génération', new Date().toISOString()],
          ['Cartes actives', byStatus('active')],
          ['Cartes bloquées', byStatus('blocked')],
          ['Cartes révoquées', byStatus('revoked')],
          ['Cartes remplacées', cardsPage.rows.filter((c) => c.card_replaced_by).length],
        ]),
      },
      {
        name: 'Cartes',
        sheet: buildTableSheet(
          ['cmu_number', 'last_name', 'first_name', 'msd_code', 'card_status', 'card_blocked_at', 'card_blocked_reason', 'card_revoked_at', 'card_revoked_reason', 'card_replaced_by'],
          cardsPage.rows,
          { labels: { cmu_number: 'Matricule', last_name: 'Nom', first_name: 'Prénom', msd_code: 'MSD', card_status: 'Statut', card_blocked_at: 'Bloquée le', card_blocked_reason: 'Motif blocage', card_revoked_at: 'Révoquée le', card_revoked_reason: 'Motif révocation', card_replaced_by: 'Remplacée par' } }
        ),
      },
      { name: 'Operations carte', sheet: buildTableSheet(['matricule', 'evenement', 'motif', 'agent', 'reference_demande', 'date'], events.rows || []) },
      { name: 'Reinitialisations', sheet: buildTableSheet(['matricule', 'agent', 'demande_le', 'expire_le', 'utilise'], resets.rows || []) },
    ];
    const buffer = buildWorkbook(sheets);
    await recordAudit({
      action: 'EXPORT_RAPPORT', actor: actorOf(req.user),
      details: `Rapport Excel de gestion des cartes ${ref} exporté.`,
      objectType: 'REPORT', objectRef: ref, msdCode: msd, result: 'SUCCESS', severity: 'WARNING',
    });
    sendWorkbook(res, buffer, `gestion-cartes-${dateStamp()}.xlsx`);
  } catch (err) {
    console.error('[Excel] rapport cartes impossible :', err.message);
    res.status(500).json({ error: 'Rapport de gestion des cartes indisponible.' });
  }
});

module.exports = router;
