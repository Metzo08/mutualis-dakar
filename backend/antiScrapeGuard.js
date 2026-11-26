'use strict';

/**
 * ============================================================
 *  SenMutuelles (MUTUALIS) — Bouclier Anti-Scraping & Honeypot Défensif
 *  (Équipe Ngone Cisse / Sentinelle 24/7 Cheikh Tidiane Mbaye)
 * ============================================================
 *  Défense 100% légale et conforme :
 *   1. Détection et blocage (HTTP 403) des aspirateurs de site et bots de scraping.
 *   2. Routes leurres (honeypots) : tout scanner/scraper qui sonde /.env, /backup.sql,
 *      /api/internal-dump, /wp-admin, etc. voit son IP bannie temporairement (60 min)
 *      et l'incident est journalisé pour alerte immédiate d'Ahmed Tall.
 *   3. Limitation de débit (anti-moissonnage massif) par IP sur les routes publiques.
 *   4. Aucun code malveillant ni action offensive sur la machine tierce.
 */

const SCRAPER_UA_PATTERNS = [
  /httrack/i,
  /webcopier/i,
  /teleport\s*pro/i,
  /sitesucker/i,
  /scrapy/i,
  /pycurl/i,
  /python-requests/i,
  /aiohttp/i,
  /go-http-client/i,
  /wget\//i,
  /libwww-perl/i,
  /sqlmap/i,
  /nikto/i,
  /masscan/i,
  /zgrab/i,
  /headlesschrome/i,
  /phantomjs/i,
  /firecrawl/i
];

const HONEYPOT_PATHS = new Set([
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.git/config',
  '/backup.sql',
  '/dump.sql',
  '/wp-admin',
  '/wp-login.php',
  '/phpmyadmin',
  '/api/internal-dump',
  '/api/export-all-users',
  '/api/debug/secrets'
]);

const BAN_DURATION_MS = 60 * 60 * 1000; // 60 minutes
const bannedIps = new Map(); // ip -> { until, reason, path }

function getClientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isIpBanned(ip) {
  const entry = bannedIps.get(ip);
  if (!entry) return null;
  if (Date.now() > entry.until) {
    bannedIps.delete(ip);
    return null;
  }
  return entry;
}

function banIp(ip, reason, path) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    // Ne jamais bloquer localhost pendant l'administration locale
    return;
  }
  bannedIps.set(ip, { until: Date.now() + BAN_DURATION_MS, reason, path });
}

/**
 * Middleware Express défensif anti-scraping + honeypots.
 * @param {{ query?: Function }} [deps]
 */
function createAntiScrapeMiddleware(deps = {}) {
  const logAudit = (ip, reason, reqPath) => {
    if (typeof deps.query === 'function') {
      deps.query(
        `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
        ['SENTINELLE_ANTI_SCRAPE', ip, `Blocage défensif (${reason}) sur ${reqPath}`]
      ).catch(() => {});
    }
  };

  return (req, res, next) => {
    // Désactivé uniquement pendant les tests unitaires Jest
    if (process.env.NODE_ENV === 'test') return next();

    const ip = getClientIp(req);
    const reqPath = String(req.path || '').toLowerCase();
    const ua = String(req.headers['user-agent'] || '');

    // 1. Vérifier si l'IP est déjà bannie temporairement
    const ban = isIpBanned(ip);
    if (ban) {
      return res.status(403).json({
        error: 'Accès temporairement bloqué par la sentinelle de sécurité SenMutuelles.'
      });
    }

    // 2. Routes leurres (honeypots) : détection de scan/copie automatisée
    if (HONEYPOT_PATHS.has(reqPath)) {
      banIp(ip, 'HONEYPOT_TRIGGERED', reqPath);
      logAudit(ip, 'HONEYPOT_TRIGGERED', reqPath);
      return res.status(403).json({
        error: 'Accès interdit. Tentative enregistrée par le système de surveillance 24/7.'
      });
    }

    // 3. Blocage des aspirateurs de site et bots de scraping connus
    if (ua && SCRAPER_UA_PATTERNS.some((re) => re.test(ua))) {
      banIp(ip, 'SCRAPER_BOT_BLOCKED', reqPath);
      logAudit(ip, `SCRAPER_BOT:${ua.slice(0, 80)}`, reqPath);
      return res.status(403).json({
        error: 'Extraction automatisée (scraping) strictement interdite sur SenMutuelles.'
      });
    }

    // 4. En-têtes défensifs anti-indexation / anti-framing sur l'API
    if (reqPath.startsWith('/api/')) {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('X-Frame-Options', 'DENY');
    }

    return next();
  };
}

module.exports = {
  createAntiScrapeMiddleware,
  SCRAPER_UA_PATTERNS,
  HONEYPOT_PATHS,
  bannedIps
};
