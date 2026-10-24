/**
 * dbOptimize.js — Optimisations « scénario A » (conserver et optimiser
 * l'architecture actuelle, sans nouvelle technologie).
 *
 * 1. Migration idempotente des index manquants pour les requêtes réellement
 *    émises par la plateforme (recherche par nom/NIN/matricule, filtres MSD,
 *    statuts de cartes, jointures famille, jetons de session).
 * 2. Nettoyage statistique : ANALYZE sur les tables chaudes (le planificateur
 *    de PostgreSQL choisit de mauvais plans quand les statistiques datent).
 *
 * Lancé au démarrage du serveur (background, non bloquant) et disponible
 * en CLI : node dbOptimize.js [--report].
 *
 * --report : renvoie les compteurs utiles au suivi (tailles, index, cache hit
 * ratio) SANS exécuter de migration. Aucune donnée personnelle n'est lue :
 * uniquement des métadonnées système.
 */

const { query, pool } = require('./db');

/** Index applicatifs manquants fréquents (CREATE INDEX IF NOT EXISTS). */
const INDEXES = [
  // Recherche/filtres du registre (GET /api/beneficiaries, recherche encadrée)
  `CREATE INDEX IF NOT EXISTS idx_benef_msd_status ON beneficiaries(UPPER(msd_code), status)`,
  `CREATE INDEX IF NOT EXISTS idx_benef_last_first ON beneficiaries(UPPER(last_name), UPPER(first_name))`,
  `CREATE INDEX IF NOT EXISTS idx_benef_card_status_all ON beneficiaries(card_status)`,
  // Journal d'audit : les vues du centre de sécurité filtrent par action/acteur/severity
  `CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_logs(severity, created_at DESC)`,
  // Jetons de session : purge et révocation en masse à la réinitialisation
  `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, revoked)`,
  // Comptes assurés : état du compte (page comptes & cartes)
  `CREATE INDEX IF NOT EXISTS idx_benef_accounts_status ON beneficiary_accounts(account_status)`,
  // Demandes administratives en attente (tableau de suivi §3.9)
  `CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON admin_requests(status, created_at DESC)`,
  // Récupération de mot de passe : purge des codes expirés
  `CREATE INDEX IF NOT EXISTS idx_password_resets_expiry ON password_resets(expires_at)`,
];

/** ANALYZE des tables chaudes (statistiques fraîches = bons plans de requête). */
const ANALYZE_TABLES = [
  'beneficiaries', 'audit_logs', 'refresh_tokens', 'admin_requests',
  'card_lifecycle_events', 'beneficiary_accounts', 'password_resets',
];

async function applyOptimizations() {
  const applied = [];
  const failed = [];
  for (const sql of INDEXES) {
    const name = /idx_\w+/.exec(sql) ? /idx_\w+/.exec(sql)[0] : '?';
    try {
      await query(sql);
      applied.push(name);
    } catch (err) {
      // Table absente (module pas encore migré) : non bloquant, rejoué au
      // prochain démarrage.
      failed.push(`${name} (${err.message.slice(0, 80)})`);
    }
  }
  for (const t of ANALYZE_TABLES) {
    try { await query(`ANALYZE ${t}`); } catch { /* table absente */ }
  }
  return { applied, failed };
}

/** Rapport mesuré (aucune donnée personnelle : uniquement des métriques). */
async function report() {
  const out = {};
  try {
    const sizes = await query(`
      SELECT relname AS table, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r'
         AND relname IN ('beneficiaries','audit_logs','refresh_tokens','admin_requests')
       ORDER BY pg_total_relation_size(c.oid) DESC`);
    out.sizes = sizes.rows;
  } catch { /* base indisponible */ }
  try {
    const cache = await query(`
      SELECT ROUND(100.0 * sum(blks_hit) / nullif(sum(blks_hit) + sum(blks_read), 0), 1) AS hit_ratio
        FROM pg_statio_user_tables`);
    out.cacheHitRatio = cache.rows && cache.rows[0] && cache.rows[0].hit_ratio;
  } catch { /* non disponible */ }
  try {
    const poolState = { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount };
    out.pool = poolState;
  } catch { /* — */ }
  return out;
}

/** Point d'entrée CLI : node dbOptimize.js [--report] */
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    if (process.argv.includes('--report')) {
      console.log(JSON.stringify(await report(), null, 1));
    } else {
      const r = await applyOptimizations();
      console.log(`[Optim] index appliqués : ${r.applied.length}${r.failed.length ? ` — reportés : ${r.failed.join(', ')}` : ''}`);
    }
    const p = require('./db').pool;
    await p.end().catch(() => {});
    process.exit(0);
  })().catch((e) => { console.error('[Optim] échec :', e.message); process.exit(1); });
}

module.exports = { applyOptimizations, report };
