// ═══════════════════════════════════════════════════════════════════════════
// MODE MAINTENANCE — contrôle depuis le Super Admin
// ═══════════════════════════════════════════════════════════════════════════
//
// Un état global réparti sur plusieurs instances est le piège classique : le
// Super Admin active la maintenance sur l'instance A, le répartiteur envoie
// la requête suivante à l'instance B, qui ne sait rien — l'utilisateur voit
// un site à moitié fermé. L'état vit donc en base, partagé par toutes les
// instances, avec un cache local de 5 s pour ne pas interroger la base à
// chaque requête (le cache est l'unique concession : en multi-instance, une
// activation prend au plus 5 s à se propager).
//
// Ce qui reste accessible en maintenance : /health, /health/ready (sinon le
// répartiteur retirerait toutes les instances en croyant qu'elles sont mortes)
// et la consultation de l'état lui-même.
// ═══════════════════════════════════════════════════════════════════════════

const { query } = require('./db');

const CACHE_TTL_MS = 5000;
let cache = { enabled: false, message: null, readAt: 0 };

/**
 * Assure l'existence de la table des paramètres. Idempotent, appelé au
 * premier accès — sans jamais toucher aux autres tables.
 */
const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_by VARCHAR(150),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
};

/**
 * État courant de la maintenance.
 * @returns {Promise<{enabled: boolean, message: string|null}>}
 */
const getMaintenanceState = async () => {
  if (Date.now() - cache.readAt < CACHE_TTL_MS) return cache;
  try {
    const r = await query("SELECT value FROM platform_settings WHERE key = 'maintenance'");
    const value = r.rows[0] ? r.rows[0].value : null;
    cache = {
      enabled: Boolean(value && value.enabled),
      message: (value && value.message) || null,
      readAt: Date.now()
    };
  } catch (err) {
    // Table absente (premier démarrage) ou base injoignable : on ne bloque
    // JAMAIS le trafic sur un échec de lecture — c'est le comportement sûr.
    if (!cache.readAt) cache = { enabled: false, message: null, readAt: Date.now() };
  }
  return cache;
};

/** Invalide le cache après un changement — la propagation devient immédiate. */
const invalidateMaintenanceCache = () => { cache.readAt = 0; };

/**
 * Active ou désactive la maintenance.
 * @param {boolean} enabled
 * @param {string|null} message Message affiché aux utilisateurs.
 * @param {string} actor Identifiant de l'admin qui agit (audit).
 */
const setMaintenanceState = async (enabled, message, actor) => {
  await ensureTable();
  await query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ('maintenance', $1::jsonb, $2, NOW())
     ON CONFLICT (key) DO UPDATE
       SET value = $1::jsonb, updated_by = $2, updated_at = NOW()`,
    [JSON.stringify({ enabled, message: message || null }), actor]
  );
  invalidateMaintenanceCache();
};

/**
 * Middleware : bloque le trafic métier quand la maintenance est active.
 * Les routes de santé passent toujours — c'est vital pour le répartiteur.
 */
const maintenanceGate = async (req, res, next) => {
  // Les sondes de santé et la lecture d'état passent toujours.
  if (req.path === '/health' || req.path.startsWith('/health/')) return next();

  const state = await getMaintenanceState();
  if (!state.enabled) return next();

  // Un Super Admin authentifié peut continuer à naviguer pour vérifier l'état
  // du site et le désactiver — sinon il s'enfermerait dehors.
  if (req.user && String(req.user.role || '').toLowerCase().includes('super')) return next();

  res.status(503).json({
    error: 'MAINTENANCE',
    message: state.message || 'La plateforme est momentanément en maintenance. Revenez dans quelques instants.',
    retryAfter: 300
  });
};

module.exports = { getMaintenanceState, setMaintenanceState, maintenanceGate, invalidateMaintenanceCache };
