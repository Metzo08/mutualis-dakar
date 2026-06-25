// Middlewares d'authentification et de contrôle d'accès (RBAC) pour MUTUALIS DAKAR.
// Extraits de server.js pour être réutilisés par les fichiers de routes séparés (csuRoutes.js).
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';

// Normalisation des rôles : la DB utilise des libellés français ('Admin Régional', 'Super Admin')
// normalisés vers 'agent' / 'admin' pour la vérification des permissions.
function normalizeRole(role) {
  if (!role) return 'anonymous';
  const r = String(role).toLowerCase().trim();
  if (r === 'super admin' || r === 'admin' || r === 'superadmin') return 'admin';
  if (r === 'admin régional' || r === 'agent' || r === 'admin regional') return 'agent';
  if (r === 'citizen' || r === 'citoyen') return 'citizen';
  return r;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès refusé. Jeton manquant.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Jeton invalide ou expiré.' });
    req.user = user;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    const userRole = normalizeRole(req.user.role);
    const allowed = roles.map(normalizeRole);
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ error: 'Permissions insuffisantes pour cette action.' });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole, normalizeRole };
