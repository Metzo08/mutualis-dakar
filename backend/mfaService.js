/**
 * mfaService.js — Authentification multifacteur des comptes privilégiés
 * (§4.4 du cahier des charges : « une authentification multifacteur pour les
 * administrateurs lorsque possible »).
 *
 * CANAL : code à 6 chiffres envoyé par E-MAIL (nodemailer, SMTP configurable
 * par .env). Le canal e-mail est le seul dont la plateforme peut disposer
 * sans dépendance externe ; le statut du centre de sécurité reflète la
 * disponibilité réelle (présence d'une adresse sur le compte + SMTP configuré).
 *
 * FLUX DE CONNEXION :
 *   1. POST /api/auth/agent/login  → si MFA activée pour ce compte, PAS de
 *      jeton : réponse { mfaRequired: true, challenge } (le mot de passe seul
 *      ne suffit plus).
 *   2. POST /api/auth/mfa/verify   → code + challenge → jetons + session.
 *
 * SÉCURITÉ :
 *   • le code est haché SHA-256 en base (jamais stocké en clair) ;
 *   • usage unique, expiration 10 minutes, maximum 5 tentatives ;
 *   • le challenge est un identifiant opaque aléatoire lié au compte ;
 *   • échec répété → même verrouillage temporaire que le mot de passe ;
 *   • toute l'opération est journalisée sans le code ni l'adresse complète.
 */

const crypto = require('crypto');
const { query } = require('./db');
const { recordAudit } = require('./auditTrail');
const { logLoginAttempt } = require('./securityMonitor');

const CODE_TTL_MIN = parseInt(process.env.MFA_CODE_TTL_MIN || '10', 10) || 10;
const MAX_ATTEMPTS = parseInt(process.env.MFA_MAX_ATTEMPTS || '5', 10) || 5;

/** Transporteur SMTP — créé paresseusement (les tests n'envoient rien). */
let transporter = null;
function mailer() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10) || 587,
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }
  return transporter;
}

/** MFA disponible pour un compte : e-mail présent ET canal SMTP configuré. */
function mfaAvailable(agent) {
  return Boolean(agent && String(agent.email || '').trim() && mailer());
}

/** MFA activée pour ce compte (colonne mfa_enabled, défaut FALSE). */
function mfaEnabled(agent) {
  return Boolean(agent && agent.mfa_enabled);
}

/** La migration douce des colonnes MFA (idempotente). */
async function ensureMfaSchema() {
  // Adresse e-mail du compte : canal du code de vérification. Absente du
  // schéma historique — ajoutée ici (aucune donnée existante touchée).
  await query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS email VARCHAR(190)`).catch(() => { });
  await query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE`).catch(() => { });
  await query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMP`).catch(() => { });
  await query(`CREATE TABLE IF NOT EXISTS mfa_challenges (
    id SERIAL PRIMARY KEY,
    challenge VARCHAR(64) NOT NULL UNIQUE,
    agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    code_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(() => { });
  await query('CREATE INDEX IF NOT EXISTS idx_mfa_challenges_challenge ON mfa_challenges(challenge)').catch(() => { });
}

async function sendMail(to, subject, text) {
  const t = mailer();
  if (!t) return false;
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || 'MUTUALIS <no-reply@mutualis.sn>',
      to, subject, text,
    });
    return true;
  } catch (err) {
    console.warn('[MFA] envoi e-mail impossible :', err.message);
    return false;
  }
}

/** Masque une adresse e-mail pour les journaux (jamais complète). */
function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at <= 0) return null;
  return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`;
}

/**
 * Étape 1 : après mot de passe correct, émet un challenge MFA.
 * @returns {Promise<{ok:boolean, challenge?:string, sent?:boolean, message?:string}>}
 */
async function issueChallenge(agent) {
  await ensureMfaSchema();
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  const challenge = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60000);
  await query(
    `INSERT INTO mfa_challenges (challenge, agent_id, code_hash, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [challenge, agent.id, hash, expiresAt]
  );
  const sent = await sendMail(
    agent.email,
    'Code de vérification MUTUALIS',
    `Votre code de vérification est : ${code}\n\nIl expire dans ${CODE_TTL_MIN} minutes et ne sert qu'une fois.\nSi vous n'êtes pas à l'origine de cette demande, contactez immédiatement l'administrateur.`
  );
  await recordAudit({
    action: 'MFA_DEFI_EMIS', actor: agent.username,
    details: `Code MFA envoyé à ${maskEmail(agent.email) || 'canal indisponible'} (expire dans ${CODE_TTL_MIN} min).`,
    objectType: 'ACCOUNT', objectRef: String(agent.id), result: sent ? 'SUCCESS' : 'FAILURE',
  });
  if (!sent) {
    return { ok: false, message: 'Impossible d\'envoyer le code par e-mail (SMTP non configuré ou en erreur). Contactez l\'administrateur.' };
  }
  return { ok: true, challenge, expiresInMinutes: CODE_TTL_MIN };
}

/**
 * Étape 2 : vérifie code + challenge, consomme le défi.
 * @returns {Promise<{ok:boolean, message?:string}>}
 */
async function verifyChallenge(challenge, code, username) {
  await ensureMfaSchema();
  const r = await query(
    `SELECT c.id, c.agent_id, c.code_hash, c.expires_at, c.attempts, c.used, a.username, a.email
       FROM mfa_challenges c JOIN agents a ON a.id = c.agent_id
      WHERE c.challenge = $1`,
    [String(challenge || '')]
  );
  const ch = r.rows && r.rows[0];
  if (!ch) {
    return { ok: false, message: 'Défi invalide ou expiré. Reconnectez-vous.' };
  }
  if (ch.used) return { ok: false, message: 'Ce défi a déjà été utilisé. Reconnectez-vous.' };
  if (new Date(ch.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'Code expiré. Reconnectez-vous pour en recevoir un nouveau.' };
  }
  if (ch.attempts >= MAX_ATTEMPTS) {
    await query('UPDATE mfa_challenges SET used = TRUE WHERE id = $1', [ch.id]);
    await logLoginAttempt({ username: ch.username, role: 'admin', success: false, reason: 'MFA : trop de tentatives' });
    return { ok: false, message: 'Trop de tentatives. Reconnectez-vous.' };
  }
  const hash = crypto.createHash('sha256').update(String(code || '')).digest('hex');
  if (hash !== ch.code_hash) {
    await query('UPDATE mfa_challenges SET attempts = attempts + 1 WHERE id = $1', [ch.id]);
    await logLoginAttempt({ username: ch.username, role: 'admin', success: false, reason: `MFA : code incorrect (tentative ${ch.attempts + 1})` });
    const left = Math.max(0, MAX_ATTEMPTS - ch.attempts - 1);
    return { ok: false, message: `Code incorrect. ${left} tentative(s) restante(s).` };
  }
  await query('UPDATE mfa_challenges SET used = TRUE WHERE id = $1', [ch.id]);
  await logLoginAttempt({ username: ch.username, role: 'admin', success: true, msdCode: null });
  await recordAudit({
    action: 'MFA_VERIFIE', actor: ch.username,
    details: 'Second facteur vérifié : connexion autorisée.',
    objectType: 'ACCOUNT', objectRef: String(ch.agent_id), result: 'SUCCESS',
  });
  return { ok: true, agentId: ch.agent_id, username: ch.username };
}

/**
 * Active la MFA d'un compte administrateur. Refus sans adresse e-mail :
 * le canal de vérification est un prérequis technique, pas une option.
 */
async function enableMfa(agentId, actor) {
  await ensureMfaSchema();
  const r = await query('SELECT id, username, email, role FROM agents WHERE id = $1', [agentId]);
  const agent = r.rows && r.rows[0];
  if (!agent) return { ok: false, status: 404, message: 'Compte introuvable.' };
  if (!String(agent.email || '').trim()) {
    return { ok: false, status: 400, message: 'Une adresse e-mail doit d\'abord être renseignée sur ce compte (canal du code de vérification).' };
  }
  await query('UPDATE agents SET mfa_enabled = TRUE, mfa_enrolled_at = CURRENT_TIMESTAMP WHERE id = $1', [agentId]);
  await recordAudit({
    action: 'MFA_ACTIVEE', actor,
    details: `MFA activée pour ${agent.username} (code par e-mail à ${maskEmail(agent.email)}).`,
    objectType: 'ACCOUNT', objectRef: String(agentId), result: 'SUCCESS',
  });
  return { ok: true, message: 'MFA activée : le prochain login exigera un code envoyé par e-mail.' };
}

/** Désactive la MFA (procédure de secours, toujours journalisée). */
async function disableMfa(agentId, actor, reason) {
  await ensureMfaSchema();
  const r = await query('SELECT id, username FROM agents WHERE id = $1', [agentId]);
  if (!r.rows || !r.rows[0]) return { ok: false, status: 404, message: 'Compte introuvable.' };
  await query('UPDATE agents SET mfa_enabled = FALSE WHERE id = $1', [agentId]);
  await recordAudit({
    action: 'MFA_DESACTIVEE', actor,
    details: `MFA désactivée pour ${r.rows[0].username}${reason ? ` — motif : ${reason}` : ''}.`,
    objectType: 'ACCOUNT', objectRef: String(agentId), result: 'SUCCESS', severity: 'WARNING',
  });
  return { ok: true, message: 'MFA désactivée (opération journalisée).' };
}

/** État MFA d'un compte (jamais de secret : uniquement des booléens). */
async function mfaState(agentId) {
  const r = await query('SELECT id, username, email, mfa_enabled, mfa_enrolled_at FROM agents WHERE id = $1', [agentId]);
  const a = r.rows && r.rows[0];
  if (!a) return null;
  return {
    id: a.id, username: a.username,
    emailPresent: Boolean(String(a.email || '').trim()),
    smtpConfigured: Boolean(mailer()),
    enabled: Boolean(a.mfa_enabled),
    enrolledAt: a.mfa_enrolled_at || null,
    available: Boolean(String(a.email || '').trim() && mailer()),
  };
}

module.exports = {
  ensureMfaSchema, issueChallenge, verifyChallenge,
  enableMfa, disableMfa, mfaState, mfaAvailable, mfaEnabled, maskEmail,
};
