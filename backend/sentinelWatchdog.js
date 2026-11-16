/**
 * SENMUTUELLES — SENTINELLE PLATEFORME & CYBER-DÉFENSE 24/7
 * Développé par l'équipe de Ngone Cisse (SEN-E-AGENCE) — Agent : sene-platform-sentinel
 *
 * Rôles :
 *  1. Surveillance continue des interconnexions (API, PostgreSQL, Chatbot Zahara FR/Wolof, Frontend).
 *  2. Détection temps réel des connexions suspectes (brute-force, SQLi, XSS, scan de fichiers, rafales IP).
 *  3. Diagnostic clair en langage naturel + propositions de décisions sans nuire à la plateforme.
 *  4. Escalade directe vers l'équipe de Ngone Cisse + mode d'intervention autonome si l'équipe est inaccessible.
 *  5. Alerte immédiate vers Ahmed Tall (+221 77 602 67 83) via Webhook (n8n/WhatsApp/SMS) + journal persistant.
 */

const fs = require('fs');
const path = require('path');

const AHMED_TALL_CONTACT = process.env.ALERT_WHATSAPP_TO || '+221776026783';
const AHMED_TALL_DISPLAY = 'Ahmed Tall (77 602 67 83)';
const ESCALATION_TIMEOUT_MS = Number(process.env.SENTINEL_ESCALATION_MS || 120000);
const QUARANTINE_DURATION_MS = Number(process.env.SENTINEL_QUARANTINE_MS || 15 * 60 * 1000);
const HEALTH_CHECK_INTERVAL_MS = Number(process.env.SENTINEL_CHECK_INTERVAL_MS || 60000);
const INCIDENT_LOG_PATH = path.join(__dirname, 'data', 'sentinel-incidents.jsonl');

// Motifs d'attaques courants (SQLi, XSS, Traversal, scans CMS/secrets)
const SUSPICIOUS_PATTERNS = [
  { type: 'SQL_INJECTION', regex: /(\bUNION\b\s+\bSELECT\b|\bOR\b\s+1\s*=\s*1|;\s*DROP\s+TABLE|--\s*$|\bSLEEP\s*\()/i },
  { type: 'XSS_PROBE', regex: /(<\s*script\b|javascript:|onerror\s*=|onload\s*=)/i },
  { type: 'PATH_TRAVERSAL', regex: /(\.\.[/\\]\.\.|\/etc\/passwd|\/proc\/self|win\.ini)/i },
  { type: 'SENSITIVE_SCAN', regex: /(\/\.env|\/\.git\/|\/wp-login\.php|\/wp-admin|\/phpmyadmin|\/actuator\/env)/i },
];

class PlatformSentinel {
  constructor() {
    this.startedAt = new Date().toISOString();
    this.ipMetrics = new Map();       // ip -> { reqs: [ts], authFails: [ts], probes: [ts] }
    this.quarantinedIps = new Map();  // ip -> { until, reason, incidentId }
    this.recentIncidents = [];        // last 50 incidents in memory
    this.lastAlertByKey = new Map();  // anti-spam cooldown (5 min per incident key)
    this.healthState = {
      overall: 'OK',
      lastCheckAt: null,
      checks: {},
    };
    this._timer = null;
  }

  _ensureLogDir() {
    const dir = path.dirname(INCIDENT_LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _getClientIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  _isTrustedLoopback(ip) {
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }

  isQuarantined(ip) {
    const entry = this.quarantinedIps.get(ip);
    if (!entry) return null;
    if (Date.now() > entry.until) {
      this.quarantinedIps.delete(ip);
      return null;
    }
    return entry;
  }

  quarantineIp(ip, reason, incidentId) {
    if (!ip || ip === 'unknown' || this._isTrustedLoopback(ip)) return false;
    const until = Date.now() + QUARANTINE_DURATION_MS;
    this.quarantinedIps.set(ip, { until, reason, incidentId, quarantinedAt: new Date().toISOString() });
    return true;
  }

  releaseIp(ip) {
    return this.quarantinedIps.delete(ip);
  }

  /**
   * Construit un message en langage naturel clair pour Ahmed Tall et Ngone Cisse
   */
  formatNaturalLanguageAlert({ severity, title, plainExplanation, evidence, autoAction, proposals, teamStatus }) {
    return [
      `[SENMUTUELLES — SENTINELLE 24/7]`,
      `Gravité : ${severity}`,
      `Destinataire : ${AHMED_TALL_DISPLAY}`,
      `Équipe Ngone Cisse : ${teamStatus}`,
      ``,
      `1. CE QUI SE PASSE :`,
      `   ${plainExplanation}`,
      ``,
      `2. PREUVES CONSTATÉES :`,
      `   ${evidence}`,
      ``,
      `3. INTERVENTION IMMÉDIATE (sans couper la plateforme) :`,
      `   ${autoAction}`,
      ``,
      `4. DÉCISIONS PROPOSÉES À AHMED TALL :`,
      ...proposals.map((p, idx) => `   - Option ${idx + 1} : ${p}`),
    ].join('\n');
  }

  async _notifyWebhook(url, payload) {
    if (!url) return { sent: false, reason: 'not_configured' };
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 5000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      clearTimeout(t);
      return { sent: res.ok, status: res.status };
    } catch (err) {
      return { sent: false, reason: err.message };
    }
  }

  /**
   * Escalade :
   *  1) Tente de joindre l'équipe de Ngone Cisse (webhook/bus agence) avec diagnostic exact
   *  2) Si l'équipe est inaccessible (non joignable ou hors délai), passe en mode autonome
   *  3) Alerte Ahmed Tall (77 602 67 83) avec le récit en langage naturel et les décisions proposées
   */
  async raiseIncident(incident) {
    const now = Date.now();
    const dedupKey = `${incident.category}:${incident.ip || incident.component || 'global'}`;
    const lastTs = this.lastAlertByKey.get(dedupKey) || 0;
    if (now - lastTs < 5 * 60 * 1000) return null; // anti-doublon 5 min
    this.lastAlertByKey.set(dedupKey, now);

    const incidentId = `INC-${now}`;
    const ngoneWebhook = process.env.NGONE_TEAM_WEBHOOK || '';
    const ahmedWebhook = process.env.N8N_SENTINEL_WEBHOOK || process.env.ALERT_WEBHOOK_URL || '';

    // Étape 1 : Contacter l'équipe de Ngone Cisse
    const teamResult = await this._notifyWebhook(ngoneWebhook, {
      projet: 'senmutuelles',
      agent: 'sene-platform-sentinel',
      targetDirector: 'sene-agency-director (Ngone Cisse)',
      recommendedSpecialists: incident.specialists || ['sene-security', 'sene-devops'],
      incidentId,
      severity: incident.severity,
      title: incident.title,
      evidence: incident.evidence,
      plainExplanation: incident.plainExplanation,
    });

    const teamReachable = teamResult.sent === true;
    const teamStatus = teamReachable
      ? 'NOTIFIÉE (intervention coordonnée en cours)'
      : 'INACCESSIBLE — Mode d’intervention autonome activé par la Sentinelle';

    // Étape 2 : Si critique/attaque et équipe inaccessible (ou défense réflexe), action chirurgicale autonome
    let autoAction = incident.autoAction || 'Surveillance renforcée activée, aucune coupure de service.';
    if (!teamReachable && incident.autonomousFix) {
      try {
        const resultNote = await incident.autonomousFix(incidentId);
        if (resultNote) autoAction = resultNote;
      } catch (err) {
        autoAction = `Tentative d'action autonome partielle (${err.message}).`;
      }
    }

    const formattedAlert = this.formatNaturalLanguageAlert({
      severity: incident.severity,
      title: incident.title,
      plainExplanation: incident.plainExplanation,
      evidence: incident.evidence,
      autoAction,
      proposals: incident.proposals || [
        'Maintenir la protection automatique en place (recommandé, zéro impact utilisateur).',
        'Demander à Ngone Cisse un audit ciblé avec Ibrahima Ba (sene-security) et Malick Gueye (sene-devops).',
      ],
      teamStatus,
    });

    // Étape 3 : Alerter Ahmed Tall (77 602 67 83) via Webhook n8n + Telegram direct
    const ahmedDelivery = await this._notifyWebhook(ahmedWebhook, {
      contact: AHMED_TALL_CONTACT,
      recipientName: 'Ahmed Tall',
      project: 'SenMutuelles (senmutuelles.sn)',
      incidentId,
      severity: incident.severity,
      message: formattedAlert,
    });

    const tgToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const tgChatId = process.env.TELEGRAM_CHAT_ID || '';
    let telegramDelivered = false;
    if (tgToken && tgChatId) {
      const tgRes = await this._notifyWebhook(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        chat_id: tgChatId,
        text: formattedAlert,
      });
      telegramDelivered = tgRes.sent;
    }

    const record = {
      id: incidentId,
      timestamp: new Date(now).toISOString(),
      severity: incident.severity,
      category: incident.category,
      title: incident.title,
      ip: incident.ip || null,
      component: incident.component || null,
      plainExplanation: incident.plainExplanation,
      evidence: incident.evidence,
      autoAction,
      proposals: incident.proposals,
      teamReachable,
      ahmedContact: AHMED_TALL_CONTACT,
      ahmedWebhookDelivered: ahmedDelivery.sent,
      escalationTimeoutMs: ESCALATION_TIMEOUT_MS,
      formattedAlert,
    };

    this.recentIncidents.unshift(record);
    if (this.recentIncidents.length > 50) this.recentIncidents.pop();

    try {
      this._ensureLogDir();
      fs.appendFileSync(INCIDENT_LOG_PATH, JSON.stringify(record) + '\n', 'utf8');
    } catch {}

    console.warn(`\n${formattedAlert}\n`);
    return record;
  }

  /**
   * Middleware Express : inspecte chaque requête sans ralentir le trafic légitime
   */
  middleware() {
    return (req, res, next) => {
      const ip = this._getClientIp(req);

      // 1. Si l'IP est en quarantaine ciblée, bloquer uniquement cette IP
      const q = this.isQuarantined(ip);
      if (q) {
        return res.status(429).json({
          error: 'Accès temporairement restreint par la protection SenMutuelles.',
          incidentId: q.incidentId,
        });
      }

      const now = Date.now();
      let stats = this.ipMetrics.get(ip);
      if (!stats) {
        stats = { reqs: [], authFails: [], probes: [] };
        this.ipMetrics.set(ip, stats);
      }

      // Fenêtre glissante 60s pour rafales
      stats.reqs = stats.reqs.filter((t) => now - t < 60000);
      stats.reqs.push(now);

      // Inspection URL (décodée) + body léger pour sondes évidentes (hors loopback dev/tests)
      if (!this._isTrustedLoopback(ip)) {
        let decodedUrl = req.originalUrl || '';
        try { decodedUrl = decodeURIComponent(decodedUrl); } catch {}
        const inspectTarget = `${decodedUrl} ${typeof req.body === 'object' ? JSON.stringify(req.body).slice(0, 600) : ''}`;
        for (const rule of SUSPICIOUS_PATTERNS) {
          if (rule.regex.test(inspectTarget)) {
            stats.probes.push(now);
            stats.probes = stats.probes.filter((t) => now - t < 5 * 60000);
            this.raiseIncident({
              severity: 'CRITIQUE',
              category: rule.type,
              ip,
              title: `Tentative d'attaque détectée (${rule.type})`,
              plainExplanation: `Une adresse IP externe (${ip}) tente d'explorer ou d'attaquer la plateforme via "${req.path}" (motif suspect : ${rule.type}). Les utilisateurs normaux ne sont pas affectés.`,
              evidence: `Méthode=${req.method}, URL=${req.originalUrl}, IP=${ip}, UA=${req.headers['user-agent'] || 'inconnu'}`,
              specialists: ['sene-security', 'sene-devops'],
              autonomousFix: (incId) => {
                this.quarantineIp(ip, rule.type, incId);
                return `L'IP ${ip} a été placée automatiquement en quarantaine ciblée pour 15 minutes. Le reste de la plateforme continue à fonctionner normalement.`;
              },
              proposals: [
                `Laisser l'IP ${ip} bloquée 15 min puis réévaluer automatiquement (recommandé, zéro coupure).`,
                `Bannir définitivement l'IP ${ip} dans Nginx/pare-feu si les tentatives reprennent.`,
              ],
            });
            return res.status(403).json({ error: 'Requête bloquée par la protection de sécurité.' });
          }
        }

        // Détection rafale anormale (> 180 req/min sur une même IP)
        if (stats.reqs.length > 180) {
          this.raiseIncident({
            severity: 'ALERTE',
            category: 'TRAFFIC_BURST',
            ip,
            title: 'Pic de trafic anormal détecté sur une IP',
            plainExplanation: `L'adresse IP ${ip} a envoyé plus de ${stats.reqs.length} requêtes en moins d'une minute, ce qui ressemble à un script automatisé ou une tentative de saturation.`,
            evidence: `${stats.reqs.length} requêtes/min depuis ${ip} sur ${req.path}`,
            specialists: ['sene-devops', 'sene-security'],
            autonomousFix: (incId) => {
              this.quarantineIp(ip, 'TRAFFIC_BURST', incId);
              return `Limitation ciblée appliquée sur l'IP ${ip} pendant 15 minutes pour préserver la fluidité des autres usagers.`;
            },
            proposals: [
              `Maintenir la limitation sur ${ip} pendant 15 minutes (recommandé).`,
              `Si ${ip} correspond à un partenaire ou une campagne d'enrôlement connue, la retirer de la quarantaine.`,
            ],
          });
        }
      }

      // Observer la réponse (401/403 sur auth -> brute-force ; 5xx -> panne applicative)
      res.on('finish', () => {
        if (!this._isTrustedLoopback(ip) && req.path.startsWith('/api/auth/') && (res.statusCode === 401 || res.statusCode === 403)) {
          stats.authFails = stats.authFails.filter((t) => Date.now() - t < 5 * 60000);
          stats.authFails.push(Date.now());
          if (stats.authFails.length >= 10) {
            this.raiseIncident({
              severity: 'CRITIQUE',
              category: 'BRUTE_FORCE',
              ip,
              title: 'Tentative de brute-force sur la connexion',
              plainExplanation: `L'adresse IP ${ip} a échoué ${stats.authFails.length} connexions en moins de 5 minutes sur ${req.path}. Quelqu'un essaie probablement de deviner des mots de passe ou codes PIN.`,
              evidence: `${stats.authFails.length} échecs HTTP ${res.statusCode} sur ${req.path} depuis ${ip}`,
              specialists: ['sene-security', 'sene-backend-dev'],
              autonomousFix: (incId) => {
                this.quarantineIp(ip, 'BRUTE_FORCE', incId);
                return `L'IP ${ip} a été mise en quarantaine pour 15 minutes. Aucun compte légitime n'a été bloqué.`;
              },
              proposals: [
                `Garder la quarantaine temporaire de ${ip} et vérifier s'il s'agit d'un agent ayant oublié son mot de passe.`,
                `Activer la double authentification (MFA) obligatoire sur le compte ciblé.`,
              ],
            });
          }
        }
      });

      next();
    };
  }

  /**
   * Vérification périodique interne (DB, Chatbot FR/WO, mémoire)
   */
  async runSelfCheck(baseUrl) {
    const checks = {};
    let hasFailure = false;

    const endpoints = [
      { key: 'health', url: `${baseUrl}/health` },
      { key: 'healthReady', url: `${baseUrl}/health/ready` },
      { key: 'mutuelles', url: `${baseUrl}/api/mutuelles` },
      {
        key: 'chatbotFr',
        url: `${baseUrl}/api/chatbot`,
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Quel est le tarif annuel ?', lang: 'fr' }),
        },
      },
      {
        key: 'chatbotWo',
        url: `${baseUrl}/api/chatbot`,
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Nanga def Zahara ?', lang: 'wo' }),
        },
      },
    ];

    for (const ep of endpoints) {
      const t0 = Date.now();
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 5000);
        const res = await fetch(ep.url, { ...(ep.options || {}), signal: ac.signal });
        clearTimeout(timer);
        const ok = res.status >= 200 && res.status < 400;
        checks[ep.key] = { ok, status: res.status, ms: Date.now() - t0 };
        if (!ok) hasFailure = true;
      } catch (err) {
        checks[ep.key] = { ok: false, status: 0, ms: Date.now() - t0, error: err.message };
        hasFailure = true;
      }
    }

    this.healthState = {
      overall: hasFailure ? 'DEGRADED' : 'OK',
      lastCheckAt: new Date().toISOString(),
      checks,
    };

    if (hasFailure) {
      const failing = Object.entries(checks).filter(([, v]) => !v.ok).map(([k, v]) => `${k} (HTTP ${v.status || 'ERR'})`);
      await this.raiseIncident({
        severity: 'CRITIQUE',
        category: 'SERVICE_DEGRADED',
        component: failing.join(', '),
        title: 'Anomalie détectée sur un composant de la plateforme',
        plainExplanation: `Un contrôle automatique a détecté qu'un ou plusieurs services ne répondent plus normalement : ${failing.join(', ')}.`,
        evidence: JSON.stringify(checks),
        specialists: ['sene-devops', 'sene-backend-dev', 'sene-database-engineer'],
        autoAction: `Diagnostic complet généré et envoyé. Le trafic sain continue d'être servi sur les modules opérationnels.`,
        proposals: [
          `Vérifier les logs du service concerné (${failing.join(', ')}) et relancer uniquement ce conteneur si besoin.`,
          `Basculer temporairement sur la dernière sauvegarde vérifiée si la base PostgreSQL est en cause.`,
        ],
      });
    }

    return this.healthState;
  }

  startLoop(port) {
    if (this._timer) return;
    const baseUrl = `http://127.0.0.1:${port}`;
    // Premier check 15s après démarrage, puis toutes les HEALTH_CHECK_INTERVAL_MS
    setTimeout(() => {
      this.runSelfCheck(baseUrl).catch(() => {});
      this._timer = setInterval(() => {
        this.runSelfCheck(baseUrl).catch(() => {});
      }, HEALTH_CHECK_INTERVAL_MS);
      if (this._timer.unref) this._timer.unref();
    }, 15000).unref?.();
  }

  getStatusSnapshot() {
    return {
      agent: 'sene-platform-sentinel',
      maintainer: 'Equipe Ngone Cisse (SEN-E-AGENCE)',
      emergencyContact: AHMED_TALL_DISPLAY,
      startedAt: this.startedAt,
      health: this.healthState,
      quarantinedIps: Array.from(this.quarantinedIps.entries()).map(([ip, info]) => ({ ip, ...info })),
      recentIncidentsCount: this.recentIncidents.length,
      recentIncidents: this.recentIncidents.slice(0, 10),
    };
  }
}

const sentinel = new PlatformSentinel();

// Mode CLI autonome : node sentinelWatchdog.js --once http://127.0.0.1:5000
if (require.main === module) {
  const target = process.argv[3] || process.env.SERVER_PUBLIC_URL || 'http://127.0.0.1:5000';
  sentinel.runSelfCheck(target).then((res) => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(res.overall === 'OK' ? 0 : 1);
  });
}

module.exports = { PlatformSentinel, sentinel };
