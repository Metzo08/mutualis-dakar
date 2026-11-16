// Fil de notifications RÉEL (cloche du bandeau supérieur) — MUTUALIS.
//
// Construit uniquement à partir des données réelles de la base, selon le
// profil connecté (le backend est l'autorité, jamais le frontend) :
//  - citoyen     : SES dossiers (beneficiary_id = req.user.id) — lettres de
//                  garantie, bons de commande, prises en charge, réclamations,
//                  échéance de cotisation, messages reçus ;
//  - agent MSD   : les dossiers à traiter de SA MSD (beneficiaries.msd_code) ;
//  - Super Admin : (rôle admin sans msdCode) supervision de toutes les MSD
//                  + alertes de sécurité.
// Côté agent, aucun détail médical (acte, médicaments) n'est exposé.
// Chaque source est isolée : une table absente n'empêche pas les autres.
const { query } = require('./db');
const { normalizeRole } = require('./rbac');

const FEED_LIMIT = 30;

async function feedRows(sql, params) {
  try {
    const r = await query(sql, params);
    return (r && Array.isArray(r.rows)) ? r.rows : [];
  } catch {
    return []; // table ou colonne absente : la source est ignorée
  }
}

const fullName = (r) => [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Assuré';
const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
const today = () => new Date().toISOString().slice(0, 10);

const GL_STATUS = { pending: 'en attente de validation', approved: 'validée', rejected: 'refusée', used: 'utilisée' };
const PO_STATUS = { pending_review: "en cours d'examen", active: 'valide', used: 'utilisé', expired: 'expiré', rejected: 'refusé' };
const CLAIM_STATUS = { pending: 'en attente', approved: 'approuvée', rejected: 'rejetée', paid: 'payée' };

async function buildCitizenFeed(userId) {
  const items = [];
  const benef = (await feedRows('SELECT id, phone FROM beneficiaries WHERE id = $1 LIMIT 1', [userId]))[0];
  if (!benef) return items;

  for (const n of await feedRows(
    `SELECT id, title, body, created_at FROM notifications
      WHERE beneficiary_id = $1 ORDER BY created_at DESC LIMIT 10`, [userId])) {
    items.push({ id: `msg-${n.id}`, type: 'message', title: n.title || 'Message de votre mutuelle',
      desc: String(n.body || '').slice(0, 180), at: n.created_at, view: 'notifications' });
  }
  for (const g of await feedRows(
    `SELECT id, validation_code, status, COALESCE(updated_at, created_at) AS at FROM guarantee_letters
      WHERE beneficiary_id = $1 ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 10`, [userId])) {
    items.push({ id: `gl-${g.id}-${g.status}`, type: 'guarantee', title: 'Lettre de garantie',
      desc: `Votre lettre ${g.validation_code || '#' + g.id} est ${GL_STATUS[g.status] || g.status}.`, at: g.at, view: 'guarantees' });
  }
  for (const p of await feedRows(
    `SELECT id, status, total_amount, COALESCE(used_at, created_at) AS at FROM purchase_orders
      WHERE beneficiary_id = $1 ORDER BY created_at DESC LIMIT 10`, [userId])) {
    items.push({ id: `po-${p.id}-${p.status}`, type: 'order', title: 'Bon de commande pharmacie',
      desc: `Votre bon ORD-${p.id} (${fcfa(p.total_amount)}) est ${PO_STATUS[p.status] || p.status}.`, at: p.at, view: 'purchase-orders' });
  }
  for (const c of await feedRows(
    `SELECT id, status, reimbursed_amount, COALESCE(processed_at, submitted_at) AS at FROM claims
      WHERE beneficiary_id = $1 ORDER BY COALESCE(processed_at, submitted_at) DESC LIMIT 5`, [userId])) {
    items.push({ id: `cl-${c.id}-${c.status}`, type: 'claim', title: 'Demande de prise en charge',
      desc: `Votre demande #${c.id} est ${CLAIM_STATUS[c.status] || c.status}${c.status === 'paid' ? ` (${fcfa(c.reimbursed_amount)})` : ''}.`,
      at: c.at, view: 'claims' });
  }
  if (benef.phone) {
    // Les réclamations sont rattachées au téléphone : celui de la fiche en
    // base (autorité), pas celui fourni par le client.
    for (const c of await feedRows(
      `SELECT id, title, status, created_at FROM complaints
        WHERE phone = $1 ORDER BY id DESC LIMIT 5`, [benef.phone])) {
      items.push({ id: `rec-${c.id}-${c.status}`, type: 'complaint', title: 'Suivi de réclamation',
        desc: `Votre réclamation #REC-${c.id} « ${String(c.title || '').slice(0, 60)} » est ${c.status === 'resolved' ? 'résolue' : 'en cours de traitement'}.`,
        at: c.created_at, view: 'profile' });
    }
  }
  const cot = (await feedRows(
    `SELECT period_end, (period_end - CURRENT_DATE) AS days_left FROM cotisations
      WHERE beneficiary_id = $1 ORDER BY period_end DESC LIMIT 1`, [userId]))[0];
  if (cot && cot.days_left !== null && cot.days_left !== undefined && Number(cot.days_left) <= 30) {
    const d = Number(cot.days_left);
    items.push({ id: `cot-${userId}-${today()}`, type: 'alert',
      title: d < 0 ? 'Cotisation expirée' : 'Cotisation bientôt expirée',
      desc: d < 0 ? 'Votre couverture a expiré : renouvelez votre cotisation pour rester couvert.'
        : `Votre cotisation expire dans ${d} jour(s). Pensez à la renouveler.`,
      at: new Date().toISOString(), view: 'cotisations' });
  }
  return items;
}

async function buildStaffFeed(msdCode, isSuper) {
  const items = [];
  // Cloisonnement par le CODE MSD (beneficiaries.msd_code) — AGENTS.md §4.
  const scope = isSuper ? '' : ' AND b.msd_code = $1';
  const p = isSuper ? [] : [msdCode];

  for (const c of await feedRows(
    `SELECT c.id, c.beneficiary_name, c.title, c.created_at FROM complaints c
       ${isSuper ? '' : 'JOIN beneficiaries b ON c.phone = b.phone'}
      WHERE c.status = 'open'${scope} ORDER BY c.id DESC LIMIT 8`, p)) {
    items.push({ id: `rec-${c.id}`, type: 'complaint', title: 'Réclamation à traiter',
      desc: `${c.beneficiary_name || 'Assuré'} : « ${String(c.title || '').slice(0, 70)} » (#REC-${c.id}).`, at: c.created_at, view: 'complaints' });
  }
  for (const g of await feedRows(
    `SELECT g.id, g.validation_code, g.created_at, b.first_name, b.last_name FROM guarantee_letters g
       JOIN beneficiaries b ON b.id = g.beneficiary_id
      WHERE g.status = 'pending'${scope} ORDER BY g.created_at DESC LIMIT 8`, p)) {
    items.push({ id: `gl-${g.id}`, type: 'guarantee', title: 'Lettre de garantie à valider',
      desc: `${fullName(g)} — ${g.validation_code || '#' + g.id}.`, at: g.created_at, view: 'guarantees' });
  }
  for (const o of await feedRows(
    `SELECT o.id, o.total_amount, o.created_at, b.first_name, b.last_name FROM purchase_orders o
       JOIN beneficiaries b ON b.id = o.beneficiary_id
      WHERE o.status = 'pending_review'${scope} ORDER BY o.created_at DESC LIMIT 8`, p)) {
    items.push({ id: `po-${o.id}`, type: 'order', title: 'Bon de commande à examiner',
      desc: `${fullName(o)} — ORD-${o.id} (${fcfa(o.total_amount)}).`, at: o.created_at, view: 'purchase-orders' });
  }
  for (const c of await feedRows(
    `SELECT c.id, c.amount, c.submitted_at, b.first_name, b.last_name FROM claims c
       JOIN beneficiaries b ON b.id = c.beneficiary_id
      WHERE c.status = 'pending'${scope} ORDER BY c.submitted_at DESC LIMIT 5`, p)) {
    items.push({ id: `cl-${c.id}`, type: 'claim', title: 'Prise en charge à traiter',
      desc: `${fullName(c)} — demande #${c.id} (${fcfa(c.amount)}).`, at: c.submitted_at, view: 'claims' });
  }
  const pend = (await feedRows(
    `SELECT COUNT(*) AS n, MAX(b.created_at) AS last_at FROM beneficiaries b
      WHERE b.status = 'pending'${scope}`, p))[0];
  if (pend && Number(pend.n) > 0) {
    items.push({ id: `adh-pending-${pend.n}`, type: 'adhesion', title: 'Adhésions en attente',
      desc: `${pend.n} dossier(s) d'adhésion attendent une validation.`, at: pend.last_at || new Date().toISOString(), view: 'beneficiaries' });
  }
  const cot = (await feedRows(
    `SELECT COUNT(DISTINCT c.beneficiary_id) AS n FROM cotisations c
       JOIN beneficiaries b ON b.id = c.beneficiary_id
      WHERE c.status = 'paid' AND c.period_end BETWEEN CURRENT_DATE AND CURRENT_DATE + 30${scope}`, p))[0];
  if (cot && Number(cot.n) > 0) {
    items.push({ id: `cot-exp-${cot.n}-${today()}`, type: 'alert', title: 'Cotisations à renouveler',
      desc: `${cot.n} assuré(s) voient leur cotisation expirer dans les 30 jours.`, at: new Date().toISOString(), view: 'cotisations' });
  }
  if (isSuper) {
    const sec = (await feedRows(
      `SELECT COUNT(*) AS n, MAX(created_at) AS last_at FROM audit_logs
        WHERE action = 'COMPTE_VERROUILLE' AND created_at > NOW() - INTERVAL '24 hours'`, []))[0];
    if (sec && Number(sec.n) > 0) {
      items.push({ id: `sec-lock-${sec.n}-${today()}`, type: 'security', title: 'Alerte sécurité',
        desc: `${sec.n} compte(s) agent verrouillé(s) après échecs de connexion (24h).`, at: sec.last_at, view: 'security-center' });
    }
  }
  return items;
}

// GET /api/notifications/feed → { data: [...], scope, generatedAt }
async function notificationFeedHandler(req, res) {
  try {
    const role = normalizeRole(req.user && req.user.role);
    let items;
    let scope;
    if (role === 'citizen') {
      scope = 'citizen';
      items = await buildCitizenFeed(req.user.id);
    } else if (role === 'agent' || role === 'admin') {
      const msdCode = req.user.msdCode || null;
      const isSuper = role === 'admin' && !msdCode;
      if (!isSuper && !msdCode) {
        // Agent sans MSD de rattachement : refus par défaut, aucune donnée.
        return res.json({ data: [], scope: 'none', generatedAt: new Date().toISOString() });
      }
      scope = isSuper ? 'all' : msdCode;
      items = await buildStaffFeed(msdCode, isSuper);
    } else {
      return res.status(403).json({ error: 'Profil non autorisé.' });
    }
    const data = items
      .filter((i) => i.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, FEED_LIMIT);
    res.json({ data, scope, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Erreur fil de notifications :', err.message);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}

module.exports = { notificationFeedHandler, buildCitizenFeed, buildStaffFeed };
