/**
 * accountRoutes.js — Gestion des comptes et des cartes des assurés (Module 3).
 *
 *   GET   /api/accounts/search           — recherche multicritère sécurisée (3.1)
 *   POST  /api/accounts/search           — idem, numéro de pièce autorisé + journalisé
 *   GET   /api/accounts/:cmuNumber       — fiche structurée identité/compte/carte/historique (3.3)
 *   POST  /api/accounts/:cmuNumber/reset-password — réinitialisation sécurisée (3.4)
 *   PATCH /api/accounts/:cmuNumber       — modification administrative autorisée (3.5)
 *   POST  /api/accounts/:cmuNumber/verify-identity — vérification en présence d'un agent (3.2)
 *
 * PRINCIPES NON N‰GOCIABLES
 *   • La recherche par nom ne déverse jamais un annuaire : elle exige un
 *     critère et renvoie une page bornée.
 *   • La pièce d'identité n'est jamais renvoyée en clair ; la recherche par
 *     pièce est réservée aux agents habilités, limitée et journalisée.
 *   • Aucun mot de passe n'est lu, affiché ou défini : la réinitialisation
 *     émet un code à usage unique, l'agent ne connaît jamais le mot de passe.
 *   • Blocage/révocation/destruction ne touchent JAMAIS le dossier ni le compte.
 *   • Toute modification passe par le journal d'audit structuré.
 */

const express = require('express');
const { query } = require('./db');
const { normalizeRole } = require('./rbac');
const { authenticateToken } = require('./rbac');
const { recordAudit, actorOf } = require('./auditTrail');
const {
  scopeOf, canPerform, searchBeneficiaries, loadAccountCard, fingerprintFromRow,
} = require('./accountCardService');

/** Normalisation d'un numéro de pièce pour comparaison (espaces, tirets, casse). */
const normPiece = (v) => String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const router = express.Router();

// Authentification portée par le router, LIMIT‰E au préfixe du module :
// le router est monté à la racine avec des chemins complets ; un
// `router.use(authenticateToken)` global bloquerait toutes les routes de
// l'application (dont les routes publiques /api/csu/*).
router.use((req, res, next) => {
  if (!/^\/api\/accounts(\/|$)/.test(req.path)) return next();
  return authenticateToken(req, res, next);
});
const clean = (v) => String(v === null || v === undefined ? '' : v).trim();

/**
 * Limitation des tentatives par agent (§3.1). Fenêtre glissante en mémoire :
 * suffisante pour un déploiement mono-instance, et sans écriture en base pour
 * une simple recherche. Multi-instance : déplacer dans Redis (documenté).
 */
const SEARCH_WINDOW_MS = 10 * 60 * 1000;
const NIN_SEARCH_LIMIT = 10;
const searchHits = new Map();

function consumeSearchQuota(actor) {
  const now = Date.now();
  const key = String(actor);
  const hits = (searchHits.get(key) || []).filter((t) => now - t < SEARCH_WINDOW_MS);
  if (hits.length >= NIN_SEARCH_LIMIT) {
    searchHits.set(key, hits);
    return false;
  }
  hits.push(now);
  searchHits.set(key, hits);
  return true;
}

/** Garde commune : agent ou admin, rattaché à une MSD (sauf Super Admin).
 *  Renvoie la MSD (string) pour un agent, `null` pour un Super Admin (périmètre
 *  TOTAL — valeur légitime), ou `false` si la requête a déjà été refusée (403
 *  envoyé). Les routes testent `scope === false` : confondre `null` (Super
 *  Admin) avec une erreur laissait la requête SANS réponse (timeout client). */
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

// ”€”€ 3.1 Recherche ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
async function handleSearch(req, res) {
  const scope = guard(req, res);
  if (scope === false) return;
  const src = req.method === 'POST' ? (req.body || {}) : (req.query || {});
  const criteria = {
    cmuNumber: clean(src.cmuNumber || src.cmu),
    nom: clean(src.nom || src.lastName),
    prenom: clean(src.prenom || src.firstName),
    nin: clean(src.nin || src.piece),
    telephone: clean(src.telephone || src.phone),
    msdCode: clean(src.msdCode),
  };
  // La recherche par pièce d'identité est un acte sensible : quota + audit.
  if (criteria.nin) {
    if (!consumeSearchQuota(actorOf(req.user))) {
      await recordAudit({
        action: 'RECHERCHE_PIECE_LIMITEE', actor: actorOf(req.user),
        details: `Quota de recherches par pièce d'identité dépassé (${NIN_SEARCH_LIMIT} / 10 min).`,
        objectType: 'ACCOUNT', result: 'DENIED', msdCode: scope, severity: 'WARNING',
      });
      return res.status(429).json({ error: 'Trop de recherches par pièce d\'identité. Réessayez dans quelques minutes.' });
    }
  }
  try {
    const result = await searchBeneficiaries(criteria, req.user, { limit: src.limit || 20 });
    if (result.refused === 'CRITERE_INSUFFISANT') {
      return res.status(400).json({
        error: 'Précisez un critère : matricule, nom, prénom, téléphone ou numéro de pièce.',
        errorCode: 'CRITERE_INSUFFISANT',
      });
    }
    if (result.refused === 'MSD_HORS_PERIMETRE') {
      await recordAudit({
        action: 'MSD_HORS_PERIMETRE', actor: actorOf(req.user),
        details: `Recherche demandée sur la MSD ${criteria.msdCode} hors périmètre.`,
        objectType: 'ACCOUNT', result: 'DENIED', msdCode: scope, severity: 'WARNING',
      });
      return res.status(403).json({ error: 'MSD hors de votre périmètre.' });
    }
    if (result.refused) return res.status(403).json({ error: 'Recherche impossible.' });

    if (criteria.nin || result.total > 0) {
      await recordAudit({
        action: 'CONSULTATION_DOSSIER', actor: actorOf(req.user),
        details: `Recherche assuré (${criteria.nin ? 'numéro de pièce' : Object.keys(criteria).filter((k) => criteria[k]).join('+')}) — ${result.total} résultat(s).`,
        objectType: 'ACCOUNT', objectRef: criteria.cmuNumber || null,
        msdCode: scope, result: 'SUCCESS',
      });
    }
    return res.json({
      data: result.rows,
      pagination: { page: 1, limit: result.rows.length, total: result.total, totalPages: 1, hasNext: result.total > result.rows.length, hasPrev: false },
      notice: result.total > 1
        ? 'Plusieurs dossiers correspondent : précisez le matricule avant toute opération.'
        : undefined,
    });
  } catch (err) {
    console.error('[Accounts] recherche impossible :', err.message);
    return res.status(500).json({ error: 'Recherche indisponible.' });
  }
}

router.get('/api/accounts/search', handleSearch);
router.post('/api/accounts/search', handleSearch);

// ”€”€ 3.3 Fiche détaillée ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
router.get('/api/accounts/:cmuNumber', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  try {
    const result = await loadAccountCard(req.params.cmuNumber, req.user);
    if (!result.ok) return res.status(result.error).json({ error: result.message, errorCode: result.errorCode });
    await recordAudit({
      action: 'CONSULTATION_FICHE', actor: actorOf(req.user),
      details: `Consultation de la fiche ${result.fiche.identite.cmuNumber}.`,
      objectType: 'ACCOUNT', objectRef: result.fiche.identite.cmuNumber,
      msdCode: result.fiche.identite.msdCode || scope, result: 'SUCCESS',
    });
    return res.json(result.fiche);
  } catch (err) {
    console.error('[Accounts] fiche impossible :', err.message);
    return res.status(500).json({ error: 'Fiche indisponible.' });
  }
});

// ”€”€ 3.2 Vérification d'identité en présence d'un agent ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// Le nom et le numéro de pièce ne suffisent pas : l'agent HABILIT‰ atteste
// avoir contrôlé la pièce physique et que la personne déclarée correspond
// à la fiche. La déclaration est confrontée à la fiche en base (nom/prénom/
// pièce) via une empreinte : aucune donnée personnelle n'est rejouée en clair.
router.post('/api/accounts/:cmuNumber/verify-identity', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  const body = req.body || {};
  const method = clean(body.method).toUpperCase();
  const declared = {
    lastName: clean(body.declaredLastName),
    firstName: clean(body.declaredFirstName),
    nin: clean(body.declaredNin),
  };
  if (!['AGENT_HABILITE_PRESENT', 'PIECE_PLUS_VERIFICATION_MSD', 'TEMOIN_COMMUNAUTE'].includes(method)) {
    return res.status(400).json({ error: 'Méthode de vérification invalide.' });
  }
  if (!declared.lastName || !declared.nin) {
    return res.status(400).json({ error: 'Renseignez le nom et le numéro de pièce déclarés par le demandeur.' });
  }
  try {
    const result = await loadAccountCard(req.params.cmuNumber, req.user);
    if (!result.ok) return res.status(result.error).json({ error: result.message, errorCode: result.errorCode });
    const row = await query('SELECT first_name, last_name, nin, msd_code FROM beneficiaries WHERE cmu_number = $1 LIMIT 1', [result.fiche.identite.cmuNumber]);
    const fiche = (row.rows || [])[0] || {};
    // De1ux contrôles distincts : le NOM D‰CLAR‰ doit correspondre à la fiche,
    // et la PIˆCE D‰CLAR‰E doit correspondre à celle enregistrée. La pièce
    // n'étant jamais renvoyée en clair, seule une égalité stricte compte :
    // c'est l'agent habilité qui atteste avoir eu la pièce physique en main.
    const nameMatches = fingerprintFromRow({ last_name: fiche.last_name, first_name: fiche.first_name, nin: null })
      === fingerprintFromRow({ last_name: declared.lastName, first_name: declared.firstName, nin: null });
    const ninStored = clean(fiche.nin);
    const ninDeclared = clean(declared.nin);
    const ninMatches = ninStored ? normPiece(ninStored) === normPiece(ninDeclared) : false;
    const verified = nameMatches && ninMatches;

    await recordAudit({
      action: 'VERIFICATION_IDENTITE', actor: actorOf(req.user),
      details: `Vérification (${method}) pour ${result.fiche.identite.cmuNumber} — nom : ${nameMatches ? 'concorde' : 'ne concorde pas'}, pièce : ${ninMatches ? 'concorde' : 'ne concorde pas'}.`,
      objectType: 'ACCOUNT', objectRef: result.fiche.identite.cmuNumber,
      requestRef: clean(body.requestRef) || null,
      msdCode: result.fiche.identite.msdCode || scope,
      result: verified ? 'SUCCESS' : 'FAILURE',
      severity: verified ? 'INFO' : 'WARNING',
    });
    return res.json({
      success: verified,
      method,
      nameMatches,
      documentMatches: ninMatches,
      verifiedAt: verified ? new Date().toISOString() : null,
      message: verified
        ? 'Identité confirmée : les informations déclarées concordent avec le dossier.'
        : 'Les informations déclarées ne concordent pas avec le dossier : n\'exécutez aucune opération sensible.',
    });
  } catch (err) {
    console.error('[Accounts] vérification impossible :', err.message);
    return res.status(500).json({ error: 'Vérification impossible.' });
  }
});

// ”€”€ 3.4 Réinitialisation du mot de passe ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// Réutilise la génération éprouvée du module cartes : code à usage unique,
// haché, 15 minutes, sessions révoquées, aucun mot de passe connu de l'agent.
router.post('/api/accounts/:cmuNumber/reset-password', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  if (!canPerform('RESET_MOT_DE_PASSE', req.user)) {
    return res.status(403).json({ error: 'Réinitialisation non autorisée pour votre rôle.' });
  }
  const body = req.body || {};
  if (clean(body.currentPassword || body.password)) {
    return res.status(400).json({
      error: "Le mot de passe actuel de l'assuré ne doit jamais être transmis ni enregistré. Utilisez la procédure de vérification d'identité.",
    });
  }
  try {
    const result = await loadAccountCard(req.params.cmuNumber, req.user);
    if (!result.ok) return res.status(result.error).json({ error: result.message, errorCode: result.errorCode });
    const { issueResetCode } = require('./cardLifecycleRoutes');
    const { code, expiresAt } = await issueResetCode(result.fiche.identite.cmuNumber, actorOf(req.user));
    await recordAudit({
      action: 'PASSWORD_RESET', actor: actorOf(req.user),
      details: `Réinitialisation du compte ${result.fiche.identite.cmuNumber} — code à usage unique émis, sessions révoquées. Le secret n'est pas journalisé.`,
      objectType: 'ACCOUNT', objectRef: result.fiche.identite.cmuNumber,
      requestRef: clean(body.requestRef) || null,
      msdCode: result.fiche.identite.msdCode || scope, result: 'SUCCESS', severity: 'WARNING',
    });
    return res.json({
      success: true,
      oneTimeCode: code,
      expiresAt: expiresAt.toISOString(),
      sessionsRevoked: true,
      message: "Code temporaire à usage unique (15 minutes). Ne le stockez pas : remettez-le à l'assuré, qui devra choisir son propre mot de passe.",
    });
  } catch (err) {
    console.error('[Accounts] réinitialisation impossible :', err.message);
    return res.status(500).json({ error: 'Réinitialisation impossible.' });
  }
});

// ”€”€ 3.5 Modification administrative autorisée ”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€”€
// Champs autorisés, tous facultatifs ; tout changement d'identité ou de MSD
// est réservé à l'administrateur et exige un motif.
const EDITABLE_FIELDS = ['phone', 'email', 'address', 'birth_place', 'gender'];
const ADMIN_ONLY_FIELDS = ['first_name', 'last_name', 'nin', 'msd_code'];

router.patch('/api/accounts/:cmuNumber', async (req, res) => {
  const scope = guard(req, res);
  if (scope === false) return;
  const body = req.body || {};
  const reason = clean(body.reason);
  if (reason.length < 5) return res.status(400).json({ error: 'Motif de la modification obligatoire (5 caractères minimum).' });

  const changes = {};
  for (const f of [...EDITABLE_FIELDS, ...ADMIN_ONLY_FIELDS]) {
    if (body[f] !== undefined) changes[f] = clean(body[f]);
  }
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'Aucun champ modifiable fourni.' });

  const adminOnly = Object.keys(changes).filter((f) => ADMIN_ONLY_FIELDS.includes(f));
  if (adminOnly.length > 0 && normalizeRole(req.user.role) !== 'admin') {
    return res.status(403).json({ error: `Seul un administrateur peut modifier : ${adminOnly.join(', ')}.` });
  }
  if (!canPerform('MODIFICATION_FICHE', req.user)) {
    return res.status(403).json({ error: 'Modification non autorisée pour votre rôle.' });
  }

  try {
    const result = await loadAccountCard(req.params.cmuNumber, req.user);
    if (!result.ok) return res.status(result.error).json({ error: result.message, errorCode: result.errorCode });
    const cmu = result.fiche.identite.cmuNumber;

    // Changement de MSD : trace explicite et réservé à l'administrateur.
    if (changes.msd_code && changes.msd_code.toUpperCase() !== String(result.fiche.identite.msdCode || '').toUpperCase()) {
      await recordAudit({
        action: 'CHANGEMENT_MSD', actor: actorOf(req.user),
        details: `Dossier ${cmu} : MSD ${result.fiche.identite.msdCode || '—'} †’ ${changes.msd_code.toUpperCase()} (motif : ${reason}).`,
        objectType: 'BENEFICIARY', objectRef: cmu, msdCode: scope, result: 'SUCCESS', severity: 'CRITICAL',
      });
      changes.msd_code = changes.msd_code.toUpperCase();
    }
    if (changes.nin) {
      const clash = await query('SELECT cmu_number FROM beneficiaries WHERE nin = $1 AND cmu_number <> $2 LIMIT 1', [changes.nin, cmu]);
      if (clash.rows.length > 0) {
        return res.status(409).json({ error: `Numéro de pièce déjà rattaché au dossier ${clash.rows[0].cmu_number}.` });
      }
    }

    const cols = Object.keys(changes);
    const sets = cols.map((c, i) => `${c} = $${i + 2}`);
    const params = [cmu, ...cols.map((c) => changes[c] || null)];
    await query(`UPDATE beneficiaries SET ${sets.join(', ')} WHERE cmu_number = $1`, params);

    // La liste des champs modifiés est journalisée — jamais les valeurs
    // personnelles elles-mêmes au-delà du nécessaire.
    await recordAudit({
      action: 'MODIFICATION_FICHE', actor: actorOf(req.user),
      details: `Dossier ${cmu} modifié : ${cols.join(', ')} (motif : ${reason}).`,
      objectType: 'BENEFICIARY', objectRef: cmu, requestRef: clean(body.requestRef) || null,
      msdCode: scope, result: 'SUCCESS', severity: adminOnly.length ? 'WARNING' : 'INFO',
    });
    return res.json({ success: true, cmuNumber: cmu, fields: cols });
  } catch (err) {
    console.error('[Accounts] modification impossible :', err.message);
    return res.status(500).json({ error: 'Modification impossible.' });
  }
});

module.exports = { router, EDITABLE_FIELDS, ADMIN_ONLY_FIELDS };
