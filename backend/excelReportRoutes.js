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

// ════════════════════════════════════════════════════════════════════════════════
// RAPPORTS EXCEL — Export de données cloisonné par MSD
// ════════════════════════════════════════════════════════════════════════════════
// GET /api/excel/report/:type — génère un fichier .xlsx (bénéficiaires | cartes | production | audit)
// ════════════════════════════════════════════════════════════════════════════════
router.get('/api/excel/report/:type', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const user = req.user;
  const msd = msdOfUser(user);
  const type = String(req.params.type || '').toLowerCase();
  const allowed = ['beneficiaries', 'cards', 'production', 'audit'];
  if (!allowed.includes(type)) {
    return res.status(400).json({ error: 'Type de rapport invalide.' });
  }

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

    const result = await query(sql, params);
    const rows = result.rows || [];

    // Construire le classeur XLSX
    const wb = XLSX.utils.book_new();
    const wsData = [columns, ...rows.map((r) => columns.map((c) => r[c] === null || r[c] === undefined ? '' : r[c]))];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mutualis-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('[Excel] report error:', err.message);
    res.status(500).json({ error: 'Indisponible.' });
  }
});

module.exports = router;