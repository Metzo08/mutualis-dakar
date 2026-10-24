/**
 * accountCardService.js — Accès aux données « compte assuré / carte »
 * (Module 3 du cahier des charges), partagé par les routes et les exports.
 *
 * SÉPARATION STRICTE (exigée par le cahier des charges §3) :
 *   • le DOSSIER d'adhésion (table beneficiaries, statut `status`) ;
 *   • le COMPTE numérique (agent notes / smartphone, table beneficiary_accounts) ;
 *   • la CARTE (colonnes card_status — source de vérité de la vérification) ;
 *   • les DROITS (cotisation en cours, package).
 * Bloquer une carte ne touche NI le dossier NI le compte : aucune requête de ce
 * module ne modifie `beneficiaries.status`.
 *
 * SÉCURITÉ :
 *   • tout accès est filtré par le périmètre de l'acteur (`scopeOf`) ;
 *   • `resolved_identity` ne renvoie qu'une empreinte (sha256 tronqué) — jamais
 *     le nom, le téléphone ni le numéro de pièce en clair ;
 *   • les pièces d'identité sont masquées par défaut (`maskNin`).
 */

const crypto = require('crypto');
const { query } = require('./db');
const { normalizeRole } = require('./rbac');

/** Rôles autorisés par opération sensible (§4.4 — privilèges contrôlés côté serveur). */
const OPERATION_PERMISSIONS = {
  BLOCAGE_CARTE: ['admin', 'agent'],
  DEBLOCAGE_CARTE: ['admin'],
  REVOCATION_CARTE: ['admin', 'agent'],
  REMPLACEMENT_CARTE: ['admin'],
  SUPPRESSION_CARTE: ['admin'],
  RESET_MOT_DE_PASSE: ['admin', 'agent'],
  MODIFICATION_FICHE: ['admin', 'agent'],
  CHANGEMENT_MSD: ['admin'],
  AUTRE: ['admin'],
};

/** Périmètre de l'acteur : null = toutes les MSD (Super Admin), undefined = fail-closed. */
function scopeOf(user) {
  if (!user) return undefined;
  if (normalizeRole(user.role) === 'admin') return null;
  return user.msdCode ? String(user.msdCode).toUpperCase() : undefined;
}

/** L'acteur peut-il exécuter cette opération ? */
function canPerform(operationType, user) {
  const allowed = OPERATION_PERMISSIONS[String(operationType || '').toUpperCase()] || [];
  return allowed.includes(normalizeRole(user && user.role));
}

/** Rôles habilités à exécuter au moins une opération de la page. */
function canUseAccountsPage(user) {
  const role = normalizeRole(user && user.role);
  return role === 'admin' || role === 'agent';
}

/** Masque une pièce d'identité : ne laisse voir que les 2 derniers caractères. */
function maskNin(nin, reveal = false) {
  if (!nin) return null;
  const value = String(nin);
  if (reveal) return value;
  if (value.length <= 2) return '••';
  return '•'.repeat(Math.max(2, value.length - 2)) + value.slice(-2);
}

/** Empreinte d'identité non réversible (contrôle de la déclaration du guichet). */
function identityFingerprint(plan) {
  const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const raw = `${norm(plan.lastName)}|${norm(plan.firstName)}|${String(plan.lastName || '').trim().toLowerCase()}|${norm(plan.nin)}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

/** Empreinte de la même identité calculée depuis la FICHE EN BASE. */
function fingerprintFromRow(row) {
  return identityFingerprint({
    lastName: row && row.last_name,
    firstName: row && row.first_name,
    nin: row && row.nin,
  });
}

/**
 * Recherche bornée d'un assuré (Module 3.1).
 * Chaque critère est FOURNI EXPLICITEMENT : contrairement à /api/beneficiaries,
 * une saisie de deux lettres ne déverse pas la liste — il faut un matricule,
 * un nom, un téléphone ou un numéro de pièce, et les critères se combinent.
 *
 * @param {object} criteres { cmuNumber, nom, prenom, nin, telephone, msdCode }
 * @param {object} user
 * @returns {Promise<{rows: object[], total: number}>}
 */
async function searchBeneficiaries(criteres, user, opts = {}) {
  const scope = scopeOf(user);
  if (scope === undefined) return { rows: [], total: 0, refused: 'AGENT_NOT_LINKED_TO_MSD' };
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || 20, 1), 50);

  const conds = ['b.merged_into IS NULL'];
  const params = [];
  const add = (sql, val) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };

  if (scope) add('UPPER(b.msd_code) = ?', scope);
  const c = criteres || {};
  const cmu = String(c.cmuNumber || '').trim();
  const nom = String(c.nom || '').trim();
  const prenom = String(c.prenom || '').trim();
  const nin = String(c.nin || '').trim();
  const tel = String(c.telephone || '').replace(/[^0-9]/g, '');
  const msd = String(c.msdCode || '').trim().toUpperCase();

  // Au moins un critère « discriminant » est obligatoire (§3.1).
  if (!cmu && !nom && !prenom && !nin && tel.length < 6) {
    return { rows: [], total: 0, refused: 'CRITERE_INSUFFISANT' };
  }
  if (msd) {
    if (scope && msd !== scope) return { rows: [], total: 0, refused: 'MSD_HORS_PERIMETRE' };
    if (!scope) add('UPPER(b.msd_code) = ?', msd);
  }
  if (cmu) add('b.cmu_number ILIKE ?', `${cmu}%`);
  if (nom) add('b.last_name ILIKE ?', `%${nom}%`);
  if (prenom) add('b.first_name ILIKE ?', `%${prenom}%`);
  if (nin) add('b.nin = ?', nin);
  if (tel.length >= 6) add('regexp_replace(COALESCE(b.phone,\'\'), \'[^0-9]\', \'\', \'g\') LIKE ?', `%${tel}%`);

  const where = `WHERE ${conds.join(' AND ')}`;
  const countRes = await query(`SELECT COUNT(*) FROM beneficiaries b ${where}`, params);
  const total = parseInt((countRes.rows[0] && countRes.rows[0].count) || '0', 10) || 0;
  const rows = await query(
    `SELECT b.id, b.cmu_number, b.first_name, b.last_name, b.msd_code, b.mutuelle_name,
            b.department, b.status, b.card_status, b.lot_code, b.created_at, b.nin,
            b.phone, b.coverage_end, b.adhesion_paid
       FROM beneficiaries b ${where}
      ORDER BY b.last_name, b.first_name, b.id
      LIMIT $${params.length + 1}`,
    [...params, limit]
  );
  // La liste ne porte jamais la pièce en clair : empreinte + présence.
  return {
    rows: rows.rows.map((r) => ({
      id: r.id,
      cmuNumber: r.cmu_number,
      firstName: r.first_name,
      lastName: r.last_name,
      msdCode: r.msd_code,
      mutuelleName: r.mutuelle_name,
      department: r.department,
      dossierStatus: r.status,
      cardStatus: r.card_status || 'active',
      lotCode: r.lot_code,
      createdAt: r.created_at,
      hasNin: Boolean(r.nin),
      ninMasked: maskNin(r.nin),
      phoneMasked: r.phone ? String(r.phone).replace(/\d(?=\d{2})/g, '•') : null,
      coverageEnd: r.coverage_end,
      adhesionPaid: r.adhesion_paid,
    })),
    total,
  };
}

/** Crée (idempotemment) les tables propres au compte numérique. */
async function ensureAccountSchema() {
  await query(`CREATE TABLE IF NOT EXISTS beneficiary_accounts (
    id SERIAL PRIMARY KEY,
    beneficiary_id INTEGER UNIQUE NOT NULL,
    cmu_number VARCHAR(60) NOT NULL,
    account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIF',
    access_status VARCHAR(20) NOT NULL DEFAULT 'OUVERT',
    last_login_at TIMESTAMP,
    password_reset_pending BOOLEAN NOT NULL DEFAULT FALSE,
    last_reset_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => { });
  await query(`CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    cmu_number VARCHAR(60) NOT NULL,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    requested_by VARCHAR(100),
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => { });
}

/**
 * Fiche complète d'un assuré (Module 3.3), cloisonnée MSD.
 * @returns {Promise<{ok:true, fiche:object}|{ok:false, error:number, message:string}>}
 */
async function loadAccountCard(cmuNumber, user) {
  const scope = scopeOf(user);
  if (scope === undefined) return { ok: false, error: 403, message: "Votre compte n'est rattaché à aucune MSD.", errorCode: 'AGENT_NOT_LINKED_TO_MSD' };
  const cmu = String(cmuNumber || '').trim();
  if (!cmu) return { ok: false, error: 400, message: 'Matricule requis.' };

  const r = await query(
    `SELECT b.id, b.cmu_number, b.first_name, b.last_name, b.nin, b.msd_code, b.mutuelle_name,
            b.department, b.status, b.created_at, b.phone, b.coverage_end, b.adhesion_paid,
            b.package_type, b.lot_code, b.merged_into,
            b.card_status, b.card_blocked_at, b.card_blocked_reason, b.card_blocked_by,
            b.card_revoked_at, b.card_revoked_reason, b.card_revoked_by, b.card_replaced_by
       FROM beneficiaries b WHERE b.cmu_number = $1 LIMIT 1`,
    [cmu]
  );
  if (r.rows.length === 0) return { ok: false, error: 404, message: 'Aucun dossier ne correspond à ce matricule.' };
  const b = r.rows[0];
  if (scope && String(b.msd_code || '').toUpperCase() !== scope) {
    return { ok: false, error: 403, message: 'Dossier hors de votre périmètre MSD.' };
  }

  await ensureAccountSchema();
  const accRes = await query(
    `SELECT id, account_status, access_status, last_login_at, password_reset_pending,
            last_reset_at, created_at
       FROM beneficiary_accounts WHERE beneficiary_id = $1 LIMIT 1`,
    [b.id]
  ).catch(() => ({ rows: [] }));
  const acc = accRes.rows[0] || null;

  const resetRes = await query(
    `SELECT created_at, expires_at, used, requested_by
       FROM password_resets WHERE cmu_number = $1
      ORDER BY created_at DESC, id DESC LIMIT 5`,
    [b.cmu_number]
  ).catch(() => ({ rows: [] }));

  const events = await query(
    `SELECT event, reason, details, actor, actor_role, request_ref, replacement_cmu, created_at
       FROM card_lifecycle_events WHERE cmu_number = $1
      ORDER BY created_at DESC, id DESC LIMIT 50`,
    [b.cmu_number]
  ).catch(() => ({ rows: [] }));

  const pendingReqs = await query(
    `SELECT reference, operation_type, status, created_at
       FROM admin_requests WHERE cmu_number = $1
      ORDER BY created_at DESC, id DESC LIMIT 10`,
    [b.cmu_number]
  ).catch(() => ({ rows: [] }));

  const hasAccessToken = await query(
    `SELECT COUNT(*) FROM refresh_tokens WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()`,
    [b.id]
  ).catch(() => ({ rows: [{ count: '0' }] }));

  const now = Date.now();
  const lastReset = resetRes.rows[0] || null;
  const resetPending = Boolean(lastReset && !lastReset.used && new Date(lastReset.expires_at).getTime() > now);

  // Le statut de la carte est celui de la VÉRIFICATION serveur : une carte
  // révoquée n'est jamais présentée comme active, quel que soit l'écran.
  return {
    ok: true,
    fiche: {
      identite: {
        cmuNumber: b.cmu_number,
        firstName: b.first_name,
        lastName: b.last_name,
        msdCode: b.msd_code,
        mutuelleName: b.mutuelle_name,
        department: b.department,
        dossierStatus: b.status,
        createdAt: b.created_at,
        packageType: b.package_type,
        lotCode: b.lot_code,
        merged: Boolean(b.merged_into),
        // Pièce d'identité masquée par défaut (§3.3) — la valeur en clair
        // n'est JAMAIS renvoyée par cette route, quel que soit le rôle.
        ninMasked: maskNin(b.nin),
        hasNin: Boolean(b.nin),
        phoneMasked: b.phone ? String(b.phone).replace(/\d(?=\d{2})/g, '•') : null,
      },
      droits: {
        statut: b.status,
        coverageEnd: b.coverage_end,
        adhesionPaid: b.adhesion_paid,
      },
      compte: {
        exists: Boolean(acc),
        accountId: acc ? acc.id : null,
        accountStatus: acc ? acc.account_status : 'NON_CREE',
        accessStatus: acc ? acc.access_status : 'NON_CREE',
        createdAt: acc ? acc.created_at : null,
        lastLoginAt: acc ? acc.last_login_at : null,
        passwordResetPending: resetPending,
        lastResetAt: acc ? acc.last_reset_at : (lastReset ? lastReset.created_at : null),
        activeSessions: parseInt((hasAccessToken.rows[0] && hasAccessToken.rows[0].count) || '0', 10) || 0,
      },
      carte: {
        status: b.card_status || 'active',
        blockedAt: b.card_blocked_at,
        blockedReason: b.card_blocked_reason,
        blockedBy: b.card_blocked_by,
        revokedAt: b.card_revoked_at,
        revokedReason: b.card_revoked_reason,
        revokedBy: b.card_revoked_by,
        replacedBy: b.card_replaced_by,
        // Aucun mécanisme NFC n'est intégré à la plateforme : l'état est
        // annoncé « non applicable » plutôt qu'inventé (§3.7).
        qrState: b.card_status === 'revoked' ? 'INVALIDE' : (b.card_status === 'blocked' ? 'BLOQUE' : 'VALIDE'),
        nfcState: 'NON_APPLICABLE',
      },
      historique: {
        tool: (events.rows || []).map((e) => ({
          event: e.event,
          reason: e.reason,
          details: e.details,
          actor: e.actor,
          actorRole: e.actor_role,
          requestRef: e.request_ref,
          replacementCmu: e.replacement_cmu,
          date: e.created_at,
        })),
        resetDemandes: (resetRes.rows || []).map((x) => ({
          demandeLe: x.created_at,
          expireLe: x.expires_at,
          utilise: x.used,
          par: x.requested_by,
        })),
        demandes: pendingReqs.rows || [],
      },
    },
  };
}

/** Liste paginée des cartes d'un périmètre (pour la page et les exports). */
async function listCards(user, filters = {}) {
  const scope = scopeOf(user);
  if (scope === undefined) return { rows: [], total: 0 };
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
  const conds = ['b.merged_into IS NULL'];
  const params = [];
  const add = (sql, val) => { params.push(val); conds.push(sql.replace('?', `$${params.length}`)); };
  if (scope) add('UPPER(b.msd_code) = ?', scope);
  if (filters.status) add('b.card_status = ?', String(filters.status).toLowerCase());
  if (filters.msdCode) {
    if (scope && String(filters.msdCode).toUpperCase() !== scope) return { rows: [], total: 0 };
    add('UPPER(b.msd_code) = ?', String(filters.msdCode).toUpperCase());
  }
  const where = `WHERE ${conds.join(' AND ')}`;
  const countRes = await query(`SELECT COUNT(*) FROM beneficiaries b ${where}`, params);
  const total = parseInt((countRes.rows[0] && countRes.rows[0].count) || '0', 10) || 0;
  const rows = await query(
    `SELECT b.cmu_number, b.first_name, b.last_name, b.msd_code, b.card_status,
            b.card_blocked_at, b.card_blocked_reason, b.card_revoked_at,
            b.card_revoked_reason, b.card_replaced_by, b.created_at
       FROM beneficiaries b ${where}
      ORDER BY b.card_blocked_at DESC NULLS LAST, b.card_revoked_at DESC NULLS LAST, b.cmu_number
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );
  return { rows: rows.rows, total, page, limit };
}

module.exports = {
  OPERATION_PERMISSIONS,
  scopeOf,
  canPerform,
  canUseAccountsPage,
  maskNin,
  identityFingerprint,
  fingerprintFromRow,
  searchBeneficiaries,
  loadAccountCard,
  listCards,
  ensureAccountSchema,
};
