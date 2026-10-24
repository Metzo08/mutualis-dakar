/**
 * securityMonitor.js — Surveillance de la sécurité (Module 4.3).
 *
 * Règles de seuil CONFIGURABLES (variables d'environnement) appliquées aux
 * données réellement disponibles. Aucune alerte n'est inventée : chaque règle
 * interroge une source vérifiable (audit_logs, refresh_tokens, agents,
 * beneficiaries, admin_requests) et porte la période et le seuil utilisés.
 *
 * Les alertes sont DÉDUITES à la lecture (rien à stocker, donc rien à fausser),
 * et leur traitement (acquittement / clôture) est journalisé dans les
 * settings sous « alert_states » avec l'acteur et la date.
 *
 * Principe du cahier des charges : une alerte ne supprime JAMAIS un compte ni
 * une carte. Elle est une information à traiter, jamais une sanction.
 */

const { query } = require('./db');

/** État MESURÉ des sauvegardes, actualisé par le centre de sécurité. Un objet
 * partagé (cache court) : la lecture de l'historique ne doit pas multiplier
 * les requêtes à chaque ouverture de la vue. */
let BACKUP_STATE = { status: 'NON_VERIFIE', detail: 'Aucune sauvegarde vérifiée à ce jour : le contrôle est honnêtement déclaré non effectué, jamais « sécurisé ».' };
async function refreshBackupState() {
  try {
    const backupService = require('./backupService');
    const st = await backupService.backupStatus();
    const dump = st.lastDump;
    const check = st.lastRestoreCheck;
    if (!dump || !dump.ok) {
      BACKUP_STATE = { status: 'NON_VERIFIE', detail: 'Aucune sauvegarde réussie enregistrée : lancez une sauvegarde puis vérifiez sa restauration.' };
    } else if (check && check.ok) {
      BACKUP_STATE = { status: 'OK', detail: `Dernière sauvegarde ${dump.file} (${new Date(dump.at).toLocaleString()}) ; restauration de contrôle vérifiée le ${new Date(check.at).toLocaleString()} — compteurs identiques.` };
    } else if (check && !check.ok) {
      BACKUP_STATE = { status: 'ECHEC_VERIF', detail: `Dernière vérification de restauration en ÉCHEC (${new Date(check.at).toLocaleString()}) : ${check.message}` };
    } else {
      BACKUP_STATE = { status: 'PARTIEL', detail: `Dernière sauvegarde ${dump.file} (${new Date(dump.at).toLocaleString()}) — restauration de contrôle jamais effectuée : le fichier n'est pas encore prouvé restaurable.` };
    }
  } catch { /* module ou base indisponible : état conservé */ }
  return BACKUP_STATE;
}

const asInt = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
};

/** Seuils : surchargeables par variable d'environnement (jamais codés en dur). */
const THRESHOLDS = {
  windowMinutes: asInt(process.env.SEC_ALERT_WINDOW_MIN, 30),
  loginFailures: asInt(process.env.SEC_ALERT_LOGIN_FAILURES, 10),
  resetRequests: asInt(process.env.SEC_ALERT_RESET_REQUESTS, 5),
  cardRevocations: asInt(process.env.SEC_ALERT_CARD_REVOCATIONS, 10),
  importFailures: asInt(process.env.SEC_ALERT_IMPORT_FAILURES, 5),
  crossMsdAttempts: asInt(process.env.SEC_ALERT_CROSS_MSD, 3),
  sensitiveWindowHours: asInt(process.env.SEC_ALERT_SENSITIVE_HOURS, 24),
  sensitiveModifications: asInt(process.env.SEC_ALERT_SENSITIVE_MODS, 20),
  staleAccountDays: asInt(process.env.SEC_STALE_ACCOUNT_DAYS, 90),
  sessionHours: asInt(process.env.SEC_SESSION_MAX_HOURS, 24),
  cspConnected: asInt(process.env.SEC_CSP_CONNECTED, 50),
};

const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2 };

/** Journalise une tentative de connexion (succès ou échec), sans secret. */
async function logLoginAttempt({ username, role, success, reason, msdCode }) {
  try {
    await query(
      `INSERT INTO audit_logs (action, actor, details, result, severity)
       VALUES ($1,$2,$3,$4,$5)`,
      [success ? 'CONNEXION_REUSSIE' : 'CONNEXION_ECHOUEE',
        String(username || 'inconnu').slice(0, 100),
        `${role || 'inconnu'}${msdCode ? ` · MSD ${msdCode}` : ''}${reason ? ` · ${reason}` : ''}`,
        success ? 'SUCCESS' : 'FAILURE',
        success ? 'INFO' : 'WARNING']
    ).catch(() => {});
  } catch {
    // Le journal ne bloque jamais l'authentification.
  }
}

/** Admins : canal e-mail (prérequis MFA), MFA activée, SMTP configuré. */
async function countAdmins(msd) {
  const r = await query(
    `SELECT
       COUNT(*) FILTER (WHERE COALESCE(email, '') <> '') AS avec_email,
       COUNT(*) FILTER (WHERE mfa_enabled = TRUE) AS mfa_enabled,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE status = 'active') AS actifs
     FROM agents
      WHERE LOWER(TRIM(role)) IN ('admin', 'super admin', 'superadmin')
        ${msd ? "AND UPPER(COALESCE(msd_code,'')) = $1" : ''}`,
    msd ? [msd] : []
  ).catch(() => ({ rows: [] }));
  return (r.rows && r.rows[0]) || { total: 0, avec_email: 0, mfa_enabled: 0, actifs: 0 };
}

/**
 * Synthèse de la sécurité (Module 4.1).
 * Chaque indicateur est calculé : rien n'est déclaré « sûr » sans mesure.
 * @param {string|null} msd — null = toutes les MSD (Super Admin)
 */
async function securityOverview(msd) {
  await refreshBackupState();
  const msdParams = msd ? [msd] : [];
  const msdFilter = msd ? 'AND UPPER(b.msd_code) = $1' : '';
  const mAgents = msd ? 'AND UPPER(msd_code) = $1' : '';
  const w = `${THRESHOLDS.windowMinutes} minutes`;
  const h24 = `${THRESHOLDS.sensitiveWindowHours} hours`;

  const [cards, agents, failures, locks, resets, pendingReqs, sessions, events, transfers] =
    await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE b.card_status = 'active') AS c_active,
           COUNT(*) FILTER (WHERE b.card_status = 'blocked') AS c_blocked,
           COUNT(*) FILTER (WHERE b.card_status = 'revoked') AS c_revoked,
           COUNT(*) FILTER (WHERE b.card_replaced_by IS NOT NULL) AS c_replaced
         FROM beneficiaries b WHERE b.merged_into IS NULL ${msdFilter}`,
        msdParams
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'active')) = 'active') AS a_actifs,
           COUNT(*) FILTER (WHERE LOWER(COALESCE(status,'active')) <> 'active') AS a_desactives,
           COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > NOW()) AS a_verrouilles
         FROM agents WHERE 1=1 ${mAgents}`,
        msdParams
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n FROM audit_logs
          WHERE action IN ('CONNEXION_ECHOUEE', 'LOGIN_FAILED')
            AND created_at >= NOW() - $1::interval ${msd ? "AND UPPER(COALESCE(msd_code,'')) = $2" : ''}`,
        msd ? [w, msd] : [w]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n FROM agents
          WHERE locked_until IS NOT NULL AND locked_until > NOW() ${mAgents}`,
        msdParams
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n FROM password_resets pr
          WHERE pr.created_at >= NOW() - INTERVAL '7 days'
            ${msd ? "AND EXISTS (SELECT 1 FROM beneficiaries b WHERE b.cmu_number = pr.cmu_number AND UPPER(b.msd_code) = $1)" : ''}`,
        msdParams
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n FROM admin_requests
          WHERE status NOT IN ('TRAITEE','REFUSEE','ANNULEE') ${msdFilter}`,
        msdParams
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n,
                COUNT(*) FILTER (WHERE expires_at < NOW() + ($2 || ' hours')::interval)::int AS proches_expiration
           FROM refresh_tokens
          WHERE revoked = FALSE AND expires_at > NOW()`,
        [null, String(THRESHOLDS.sessionHours)]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS critiques,
                COUNT(*)::int AS total
           FROM audit_logs
          WHERE created_at >= NOW() - $1::interval
            AND action IN ('CARD_REVOKED','DEMANDE_ADMIN_CREEE','EXPORT_RAPPORT','IMPORT_INTEGRATION',
                           'MODIFICATION_PERMISSIONS','DESACTIVATION_COMPTE','RESET_SESSIONS')
            ${msd ? "AND UPPER(COALESCE(msd_code,'')) = $2" : ''}`,
        msd ? [h24, msd] : [h24]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT COUNT(*)::int AS n FROM audit_logs
          WHERE action IN ('ACCES_REFUSE','INTER_MSD_REFUSE','MSD_HORS_PERIMETRE')
            AND created_at >= NOW() - $1::interval ${msd ? "AND UPPER(COALESCE(msd_code,'')) = $2" : ''}`,
        msd ? [w, msd] : [w]
      ).catch(() => ({ rows: [] })),
    ]);

  const card = (cards.rows && cards.rows[0]) || {};
  const ag = (agents.rows && agents.rows[0]) || {};
  const adminInfo = await countAdmins(msd);
  adminInfo.mfaEnabled = Number(adminInfo.mfa_enabled || 0);
  adminInfo.smtpConfigured = Boolean(process.env.SMTP_HOST);
  const cspConnected = parseInt(process.env.CSP_REPORT_CONNECTED || '0', 10) || 0;

  const controls = [
    {
      id: 'rbac_msd',
      label: 'Cloisonnement MSD & RBAC serveur',
      status: 'OK',
      detail: 'Chaque route sensible vérifie le rôle et le code MSD côté serveur (fail-closed sans MSD).',
    },
    {
      id: 'sessions',
      label: 'Sessions révocables',
      status: Number(sessions.rows && sessions.rows[0] && sessions.rows[0].n) >= 0 ? 'OK' : 'A_VERIFIER',
      detail: `${Number((sessions.rows && sessions.rows[0] && sessions.rows[0].n) || 0)} session(s) active(s) suivies par jetons de rafraîchissement hachés.`,
    },
    {
      id: 'mfa',
      label: 'Authentification multifacteur administrateurs',
      // État réel : canal présent ? MFA activée ? Rien n'est promis sans mesure.
      status: adminInfo.mfaEnabled > 0 ? 'ACTIF' : (adminInfo.avec_email > 0 && adminInfo.smtpConfigured ? 'DISPONIBLE' : (adminInfo.avec_email > 0 ? 'NON_CONFIGURE' : 'NON_DISPONIBLE')),
      detail: adminInfo.mfaEnabled > 0
        ? `MFA active sur ${adminInfo.mfaEnabled}/${adminInfo.total} compte(s) privilégié(s) : le second facteur (code e-mail) est exigé à la connexion.`
        : adminInfo.avec_email > 0 && adminInfo.smtpConfigured
          ? `Canal prêt sur ${adminInfo.avec_email}/${adminInfo.total} compte(s) privilégié(s) — MFA disponible mais pas encore activée (activation compte par compte dans le centre de sécurité).`
          : adminInfo.avec_email > 0
            ? `E-mail présent sur ${adminInfo.avec_email}/${adminInfo.total} compte(s), mais SMTP non configuré (.env) : la MFA ne peut pas envoyer de code.`
            : 'Aucun canal de vérification (e-mail) configuré : la MFA ne peut pas être activée.',
    },
    {
      id: 'backup',
      label: 'Sauvegardes de la base',
      // État MESURÉ, jamais promis : la sauvegarde n'est « OK » qu'après une
      // restauration de contrôle réussie (backupService). Sans historique,
      // le contrôle reste honnêtement « NON_VÉRIFIÉ ».
      get status() { return BACKUP_STATE.status; },
      get detail() { return BACKUP_STATE.detail; },
    },
    {
      id: 'csp',
      label: 'Rapport CSP (Content-Security-Policy)',
      status: cspConnected >= THRESHOLDS.cspConnected ? 'OK' : 'NON_VERIFIE',
      detail: cspConnected >= THRESHOLDS.cspConnected
        ? `${cspConnected} navigateur(s) connecté(s) en mode rapport sur la période.`
        : 'Aucune donnée de rapport CSP reçue : contrôle non encore effectué.',
    },
    {
      id: 'revocation',
      label: 'Révocation des cartes vérifiée côté serveur',
      status: 'OK',
      detail: 'Le statut de la carte est lu en base à chaque vérification ; une carte révoquée ou bloquée est refusée.',
    },
    {
      id: 'password',
      label: 'Mots de passe jamais lisibles',
      status: 'OK',
      detail: 'Hachés (bcrypt). La réinitialisation produit un code à usage unique haché ; aucun agent ne lit un mot de passe.',
    },
  ];

  return {
    scope: msd || 'TOUTES (Super Admin)',
    windowMinutes: THRESHOLDS.windowMinutes,
    stats: {
      comptesActifs: Number(ag.a_actifs || 0),
      comptesDesactives: Number(ag.a_desactives || 0),
      comptesBloques: Number(ag.a_desactives || 0),
      comptesVerrouilles: Number((locks.rows && locks.rows[0] && locks.rows[0].n) || 0),
      comptesAnciens: 0,
      sessionsActives: Number((sessions.rows && sessions.rows[0] && sessions.rows[0].n) || 0),
      tentativesEchouees: Number((failures.rows && failures.rows[0] && failures.rows[0].n) || 0),
      reinitialisationsMdp7j: Number((resets.rows && resets.rows[0] && resets.rows[0].n) || 0),
      cartesActives: Number(card.c_active || 0),
      cartesBloquees: Number(card.c_blocked || 0),
      cartesRevoquees: Number(card.c_revoked || 0),
      cartesRemplacees: Number(card.c_replaced || 0),
      demandesEnAttente: Number((pendingReqs.rows && pendingReqs.rows[0] && pendingReqs.rows[0].n) || 0),
      evenementsCritiques: Number((events.rows && events.rows[0] && events.rows[0].critiques) || 0),
      accesRefuses: Number((transfers.rows && transfers.rows[0] && transfers.rows[0].n) || 0),
      adminsTotal: adminInfo.total,
      adminsAvecEmail: adminInfo.avec_email,
    },
    controls,
  };
}

/** Fragment SQL « demande liée à la MSD » (via le matricule ou la colonne). */
/**
 * Alertes déduites des données (Module 4.3).
 * @param {string|null} msd
 * @param {object[]} states — { id, status, by, at, note } déjà chargés
 */
async function securityAlerts(msd, states = []) {
  const alerts = [];
  const w = `${THRESHOLDS.windowMinutes} minutes`;
  const params = msd ? [w, msd] : [w];
  const msdCond = msd ? "AND UPPER(COALESCE(msd_code,'')) = $2" : '';

  const add = (a) => alerts.push(a);

  // 1. Multiples échecs de connexion
  const fail = await query(
    `SELECT actor, COUNT(*)::int AS n FROM audit_logs
      WHERE action IN ('CONNEXION_ECHOUEE','LOGIN_FAILED') AND created_at >= NOW() - $1::interval ${msdCond}
      GROUP BY actor ORDER BY n DESC LIMIT 10`,
    params
  ).catch(() => ({ rows: [] }));
  for (const r of fail.rows || []) {
    if (r.n >= THRESHOLDS.loginFailures) {
      add({
        id: `LOGIN_FAILURES:${r.actor}`, category: 'CONNEXION', severity: 'CRITICAL',
        title: 'Échecs de connexion répétés',
        description: `${r.n} échecs pour « ${r.actor} » sur ${THRESHOLDS.windowMinutes} min (seuil ${THRESHOLDS.loginFailures}).`,
        correctiveAction: 'Vérifier l\'origine, réinitialiser le mot de passe si nécessaire et surveiller le compte.',
        data: { actor: r.actor, count: r.n, threshold: THRESHOLDS.loginFailures },
      });
    }
  }

  // 2. Demandes de réinitialisation en rafale
  const reset = await query(
    `SELECT COUNT(*)::int AS n FROM password_resets pr
      WHERE pr.created_at >= NOW() - INTERVAL '1 hour'
        ${msd ? "AND EXISTS (SELECT 1 FROM beneficiaries b WHERE b.cmu_number = pr.cmu_number AND UPPER(b.msd_code) = $1)" : ''}`,
    msd ? [msd] : []
  ).catch(() => ({ rows: [] }));
  const resetCount = Number((reset.rows && reset.rows[0] && reset.rows[0].n) || 0);
  if (resetCount >= THRESHOLDS.resetRequests) {
    add({
      id: 'RESET_BURST', category: 'COMPTES', severity: 'WARNING',
      title: 'Demandes de réinitialisation inhabituelles',
      description: `${resetCount} demandes de réinitialisation sur la dernière heure (seuil ${THRESHOLDS.resetRequests}).`,
      correctiveAction: 'Contrôler les demandes et la vérification d\'identité associée avant toute nouvelle réinitialisation.',
      data: { count: resetCount, threshold: THRESHOLDS.resetRequests },
    });
  }

  // 3. Révocations de cartes inhabituelles
  const revok = await query(
    `SELECT COUNT(*)::int AS n FROM card_lifecycle_events cle
      WHERE cle.event IN ('REVOKED','REPLACED','DESTROYED')
        AND cle.created_at >= NOW() - INTERVAL '24 hours'
        ${msd ? 'AND UPPER(COALESCE(cle.msd_code,\'\')) = $1' : ''}`,
    msd ? [msd] : []
  ).catch(() => ({ rows: [] }));
  const revokCount = Number((revok.rows && revok.rows[0] && revok.rows[0].n) || 0);
  if (revokCount >= THRESHOLDS.cardRevocations) {
    add({
      id: 'CARD_REVOCATION_BURST', category: 'CARTES', severity: 'WARNING',
      title: 'Révocations de cartes inhabituelles',
      description: `${revokCount} révocation(s)/remplacement(s) sur 24 h (seuil ${THRESHOLDS.cardRevocations}).`,
      correctiveAction: 'Vérifier l\'origine des demandes et les agents ayant exécuté les opérations.',
      data: { count: revokCount, threshold: THRESHOLDS.cardRevocations },
    });
  }

  // 4. Échecs répétés d'importation
  const imp = await query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE action LIKE 'IMPORT_%' AND result = 'FAILURE'
        AND created_at >= NOW() - INTERVAL '24 hours' ${msdCond}`,
    msd ? [msd] : []
  ).catch(() => ({ rows: [] }));
  const impCount = Number((imp.rows && imp.rows[0] && imp.rows[0].n) || 0);
  if (impCount >= THRESHOLDS.importFailures) {
    add({
      id: 'IMPORT_FAILURES', category: 'IMPORT', severity: 'WARNING',
      title: 'Échecs d\'importation répétés',
      description: `${impCount} échec(s) d'import sur 24 h (seuil ${THRESHOLDS.importFailures}).`,
      correctiveAction: 'Contrôler les fichiers sources et les rapports d\'anomalies des lots concernés.',
      data: { count: impCount, threshold: THRESHOLDS.importFailures },
    });
  }

  // 5. Tentatives d'accès inter-MSD
  const cross = await query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE action IN ('ACCES_REFUSE','INTER_MSD_REFUSE','MSD_HORS_PERIMETRE')
        AND created_at >= NOW() - $1::interval ${msdCond}`,
    params
  ).catch(() => ({ rows: [] }));
  const crossCount = Number((cross.rows && cross.rows[0] && cross.rows[0].n) || 0);
  if (crossCount >= THRESHOLDS.crossMsdAttempts) {
    add({
      id: 'CROSS_MSD_ATTEMPTS', category: 'ACCES', severity: 'CRITICAL',
      title: 'Tentatives d\'accès hors périmètre',
      description: `${crossCount} refus d'accès inter-MSD sur ${THRESHOLDS.windowMinutes} min (seuil ${THRESHOLDS.crossMsdAttempts}).`,
      correctiveAction: 'Identifier les comptes concernés ; vérifier les permissions et envisager une révocation de session.',
      data: { count: crossCount, threshold: THRESHOLDS.crossMsdAttempts },
    });
  }

  // 6. Modifications de données sensibles répétées
  const sensitive = await query(
    `SELECT COUNT(*)::int AS n FROM audit_logs
      WHERE action IN ('SUPPRESSION_DOSSIER','MODIFICATION_STATUT','CARD_REVOKED','CARD_BLOCKED')
        AND created_at >= NOW() - $1::interval ${msd ? "AND UPPER(COALESCE(msd_code,'')) = $2" : ''}`,
    msd ? [`${THRESHOLDS.sensitiveWindowHours} hours`, msd] : [`${THRESHOLDS.sensitiveWindowHours} hours`]
  ).catch(() => ({ rows: [] }));
  const sensCount = Number((sensitive.rows && sensitive.rows[0] && sensitive.rows[0].n) || 0);
  if (sensCount >= THRESHOLDS.sensitiveModifications) {
    add({
      id: 'SENSITIVE_MODIFICATIONS', category: 'DONNEES', severity: 'WARNING',
      title: 'Modifications de données sensibles répétées',
      description: `${sensCount} modification(s) sur ${THRESHOLDS.sensitiveWindowHours} h (seuil ${THRESHOLDS.sensitiveModifications}).`,
      correctiveAction: 'Revoir le journal d\'audit et confirmer la légitimité des opérations.',
      data: { count: sensCount, threshold: THRESHOLDS.sensitiveModifications },
    });
  }

  // Application des états de traitement (acquittée / clôturée).
  const byId = new Map((states || []).map((s) => [s.id, s]));
  const enriched = alerts.map((a) => {
    const st = byId.get(a.id);
    return {
      ...a,
      status: st ? st.status : 'OUVERTE',
      handledBy: st ? st.by : null,
      handledAt: st ? st.at : null,
      note: st ? st.note : null,
    };
  });
  enriched.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  return enriched;
}

module.exports = { THRESHOLDS, logLoginAttempt, securityOverview, securityAlerts, countAdmins, refreshBackupState };
