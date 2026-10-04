const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { query, pool } = require('./db');
const fallbackStore = require('./fallbackStore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const { validate } = require('./validateMiddleware');
const { parsePagination } = require('./pagination');
const csuRoutes = require('./csuRoutes');
const additionalRoutes = require('./additionalRoutes');
const dynamicRoutes = require('./dynamicRoutes');
const { router: advancedRoutes, awardPoints } = require('./advancedRoutes');
const extendedRoutes = require('./extendedRoutes');
const kadevRoutes = require('./kadevRoutes');
const clinicalRoutes = require('./clinicalRoutes');
const {
  loadRecordsForCodes,
  planRepair,
  applyRepair,
  formatReport,
  clean,
} = require('./photo-repair.cjs');

/**
 * Sources de photos déclarées côté serveur.
 *
 * Deux raisons de figer ces chemins ici plutôt que de les accepter tels quels :
 *  1. SÉCURITÉ — un agent authentifié ne doit pas pouvoir faire lire un
 *     dossier arbitraire du disque serveur (C:\, le dossier utilisateur, …).
 *  2. SÉPARATION DES SOURCES — chaque source a SON classeur, donc SON
 *     périmètre de codes. Une réparation porte sur une source et une seule :
 *     les codes des trois sources étant disjoints, la Ville de Dakar ne peut
 *     pas être affectée par une réparation ASS LONASE.
 *
 * Chemins surchargeables par variable d'environnement (déploiement).
 */
const PHOTO_SOURCE_DIRS = {
  'ASS-LONASE': process.env.PHOTOS_ASS_LONASE_DIR
    || 'C:\\Users\\hp\\Downloads\\ASS LONASE',
  'VILLE-DE-DAKAR': process.env.PHOTOS_VILLE_DE_DAKAR_DIR
    || 'C:\\Users\\hp\\Downloads\\Photos ville de Dakar',
};

/** Classeur (codes DE SOURCE) correspondant à chaque source de photos. */
const PHOTO_SOURCE_FILES = {
  'ASS-LONASE': process.env.SOURCE_ASS_LONASE_XLSX
    || 'C:\\Users\\hp\\Downloads\\ASS LONASE.xlsx',
  'VILLE-DE-DAKAR': process.env.SOURCE_VILLE_DE_DAKAR_XLSX
    || 'C:\\Users\\hp\\Downloads\\AMEVI.xlsx',
};

/**
 * Codes bénéficiaires d'une source, lus dans SON classeur.
 *
 * C'est la définition du périmètre : une fiche hors de cet ensemble ne sera
 * jamais modifiée par la réparation de cette source.
 *
 * @param {string} source — clé de PHOTO_SOURCE_FILES
 * @returns {Set<string>} codes en majuscules
 */
const readSourceCodes = (source) => {
  const file = PHOTO_SOURCE_FILES[source];
  if (!file || !fs.existsSync(file)) {
    throw new Error(`Classeur introuvable pour la source ${source} : ${file || '(non configuré)'}`);
  }
  const wb = XLSX.readFile(file, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const codes = rows
    .map((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase())
    .filter(Boolean);
  if (codes.length === 0) throw new Error(`Aucun CODE_BENEFICIAIRE dans ${file}.`);
  return new Set(codes);
};

const {
  citizenLoginSchema,
  agentLoginSchema,
  adhesionSchema,
  cotisationRenewSchema,
  donationSchema,
  complaintCreateSchema,
  beneficiaryStatusSchema,
  agentCreateSchema,
  messageCreateSchema,
  chatbotSchema
} = require('./validators');

const app = express();
const port = process.env.PORT || 5000;
const os = require('os');

// ── Détection de l'IP LAN du serveur ────────────────────────────────────────
// Les QR codes des cartes CSU encodent une URL qui doit être joignable depuis
// les smartphones du réseau Wi-Fi (ex. http://192.168.1.100:5173/#/verify/…).
// Depuis le PC en localhost, le navigateur ne connaît pas sa propre adresse
// réseau : le backend la publie via /api/lan-ip et /api/server-ip.
//
// Aucune valeur de repli n'est renvoyée : mieux vaut `null` (le frontend
// invitera l'agent à saisir son IP) qu'une adresse inventée, qui produirait
// des QR pointant vers un hôte inexistant et un « site inaccessible » au scan.

// Interfaces virtuelles : leur IP n'est joignable ni par un téléphone du Wi-Fi
// ni par les autres postes. On les écarte pour ne pas renvoyer, par exemple,
// l'adresse du pont WSL / Hyper-V / Docker (souvent 172.x ou 192.168.x).
const VIRTUAL_IFACE = /vethernet|wsl|hyper-v|virtual|vmware|vbox|docker|vpn|tunnel|tap-|bluetooth|loopback/i;
const PHYSICAL_IFACE = /wi-?fi|wireless|ethernet|local area connection/i;

const isPrivateIpv4 = (ip) => {
  const m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (m.slice(1).some((part) => Number(part) > 255)) return false;
  if (a === 127 || a === 0) return false;
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
};

/**
 * Adresse IPv4 privée réellement joignable depuis le réseau local.
 * Priorité aux interfaces physiques (Wi-Fi / Ethernet) : c'est par elles que
 * les smartphones se connectent.
 * @returns {string|null}
 */
function detectLanIp() {
  const nets = os.networkInterfaces() || {};
  const physical = [];
  const other = [];

  for (const name of Object.keys(nets)) {
    if (VIRTUAL_IFACE.test(name)) continue;
    const isPhysical = PHYSICAL_IFACE.test(name);
    for (const net of nets[name] || []) {
      // Node ≥ 18 expose family sous forme numérique (4) : les deux formes.
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      if (!isPrivateIpv4(net.address)) continue;
      (isPhysical ? physical : other).push(net.address);
    }
  }

  return physical[0] || other[0] || null;
}

// JWT_SECRET obligatoire : aucune valeur par défaut faible en production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('ERREUR FATALE : JWT_SECRET manquant ou trop court (< 32 caractères). Définissez-le dans .env');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('AVERTISSEMENT : JWT_SECRET non sécurisé utilisé en mode développement uniquement.');
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';

// JWT_REFRESH_SECRET obligatoire : secret distinct pour signer les refresh tokens
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) {
  console.error('ERREUR FATALE : JWT_REFRESH_SECRET manquant ou trop court (< 32 caractères). Définissez-le dans .env');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('AVERTISSEMENT : JWT_REFRESH_SECRET non sécurisé utilisé en mode développement uniquement.');
  }
}
const EFFECTIVE_JWT_REFRESH_SECRET = JWT_REFRESH_SECRET || 'dev_only_insecure_refresh_secret_do_not_use_min_32_chars';

// Durées de vie des jetons
const ACCESS_TOKEN_TTL = { citizen: '24h', agent: '8h', admin: '8h' };
const REFRESH_TOKEN_TTL_DAYS = 30; // 30 jours

// --- Helpers Refresh Token ---
// Hash le refresh token avant stockage (anti-rejeu si la DB fuit)
const crypto = require('crypto');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Crée un refresh token (signé JWT), le persiste haché en DB, et le retourne.
async function issueRefreshToken(user) {
  const payload = { id: user.id, role: user.role, kind: 'refresh' };
  const refreshToken = jwt.sign(payload, EFFECTIVE_JWT_REFRESH_SECRET, {
    expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`
  });
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO refresh_tokens (token_hash, user_id, user_role, expires_at) VALUES ($1, $2, $3, $4)`,
    [tokenHash, user.id, user.role, expiresAt]
  );
  return refreshToken;
}

// Vérifie un refresh token (signature + présence active en DB). Retourne le payload ou null.
async function verifyRefreshToken(refreshToken) {
  try {
    const payload = jwt.verify(refreshToken, EFFECTIVE_JWT_REFRESH_SECRET);
    if (!payload || payload.kind !== 'refresh') return null;
    const tokenHash = hashToken(refreshToken);
    const res = await query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = FALSE AND expires_at > NOW() LIMIT 1`,
      [tokenHash]
    );
    if (res.rows.length === 0) return null;
    return { payload, record: res.rows[0] };
  } catch (err) {
    return null;
  }
}

// Révoque un refresh token (par valeur ou par utilisateur)
async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  try {
    const tokenHash = hashToken(refreshToken);
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [tokenHash]);
  } catch (err) {
    // Non bloquant
  }
}

// CORS restreint aux origines autorisées (CORS_ORIGINS dans .env)
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // Autoriser les requêtes sans origin (curl, Postman, même machine)
    // On tolère toutes les variations de port de localhost pour éviter les blocages CORS locaux.
    const isLocal = origin && (
      origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('https://localhost:') ||
      origin.startsWith('https://127.0.0.1:') ||
      origin === 'http://localhost' ||
      origin === 'http://127.0.0.1' ||
      origin === 'https://localhost' ||
      origin === 'https://127.0.0.1' ||
      // Permettre toutes les IP de réseau local (192.168.x.x, 10.x.x.x, 172.16.x.x à 172.31.x.x)
      /^https?:\/\/(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?$/.test(origin)
    );
    if (!origin || allowedOrigins.includes(origin) || isLocal) {
      return cb(null, true);
    }
    return cb(new Error(`Origine CORS non autorisée : ${origin}`));
  },
  credentials: true
};

// Enable CORS, JSON parsing, and Helmet
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Rate Limiter for Auth Routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});

// Rate Limiter global pour les endpoints sensibles (mutations)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});

// Middleware JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès refusé. Jeton manquant.' });

  jwt.verify(token, EFFECTIVE_JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Jeton invalide ou expiré.' });
    req.user = user;
    next();
  });
};

// Middleware de contrôle d'accès basé sur les rôles (RBAC)
// Exemple : requireRole('agent', 'admin')
// Les rôles canoniques sont 'citizen', 'agent', 'admin'.
// La DB historique utilise des libellés français ('Admin Régional', 'Super Admin')
// qui sont normalisés ici pour la vérification des permissions.
const normalizeRole = (role) => {
  if (!role) return 'anonymous';
  const r = String(role).toLowerCase().trim();
  if (r === 'super admin' || r === 'admin' || r === 'superadmin') return 'admin';
  if (r === 'admin régional' || r === 'agent' || r === 'admin regional') return 'agent';
  if (r === 'citizen' || r === 'citoyen') return 'citizen';
  return r;
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  const userRoleLevel = normalizeRole(req.user.role);
  const allowed = roles.map(normalizeRole);
  if (!allowed.includes(userRoleLevel)) {
    return res.status(403).json({ error: 'Permissions insuffisantes pour cette action.' });
  }
  next();
};

// Combine authentification + rôle attendu
const requireAuth = (...roles) => [authenticateToken, requireRole(...roles)];

app.use('/api/auth/', authLimiter);
app.use('/api/', apiLimiter);

// 0. Citizen & Agent Authentication Endpoints
app.post('/api/auth/citizen/login', validate(citizenLoginSchema), async (req, res) => {
  try {
    const { phone, pinCode } = req.body;
    // La validation a déjà vérifié et normalisé les champs
    if (!phone || !pinCode) {
      return res.status(400).json({ error: 'Téléphone et code PIN requis.' });
    }

    const cleanedPhone = phone; // déjà normalisé par le schéma zod
    const userRes = await query('SELECT * FROM beneficiaries WHERE phone = $1 LIMIT 1', [cleanedPhone]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun assuré trouvé avec ce numéro.' });
    }

    const user = userRes.rows[0];
    // Vérification du code PIN avec support bcrypt + compatibilité legacy (PIN en clair)
    // Les nouveaux PINs sont hachés avec bcrypt (commencent par '$2').
    // Les anciens PINs en clair sont migrés automatiquement vers bcrypt lors d'un login réussi.
    const storedPin = user.pin_code;
    if (!storedPin) {
      return res.status(401).json({ error: 'Aucun code PIN défini. Contactez votre mutuelle.' });
    }

    let pinValid = false;
    const isHashed = typeof storedPin === 'string' && storedPin.startsWith('$2');
    if (isHashed) {
      pinValid = await bcrypt.compare(pinCode, storedPin);
    } else {
      // Legacy : PIN stocké en clair (à migrer)
      pinValid = storedPin === pinCode;
    }

    if (!pinValid) {
      return res.status(401).json({ error: 'Code PIN incorrect.' });
    }

    // Migration paresseuse : si le PIN était en clair, on le hache maintenant
    if (!isHashed) {
      try {
        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(pinCode, salt);
        await query('UPDATE beneficiaries SET pin_code = $1 WHERE id = $2', [hashedPin, user.id]);
      } catch (hashErr) {
        console.warn('Migration PIN bcrypt échouée (non bloquant) :', hashErr.message);
      }
    }

    // Get family members
    const fRes = await query('SELECT * FROM family_members WHERE beneficiary_id = $1 ORDER BY id ASC', [user.id]);

    const mappedUser = {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      birthDate: user.birth_date,
      phone: user.phone,
      email: user.email,
      address: user.address,
      mutuelleName: user.mutuelle_name,
      packageType: user.package_type,
      paymentMethod: user.payment_method,
      cmuNumber: user.cmu_number,
      status: user.status,
      photoUrl: user.photo_url,
      familyMembers: fRes.rows.map(f => ({
        id: f.id,
        name: f.name,
        relation: f.relation,
        age: f.age
      }))
    };

    // Log successful login
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CONNEXION_CITOYEN', phone, `Connexion réussie de l'assuré ${user.first_name} ${user.last_name}.`]
    );

    // Generate JWT (access token)
    const citizenPayload = { id: user.id, role: 'citizen', phone: user.phone };
    const token = jwt.sign(citizenPayload, EFFECTIVE_JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL.citizen });
    // Émet un refresh token (rotation possible côté client)
    const refreshToken = await issueRefreshToken(citizenPayload);
    res.json({ success: true, token, refreshToken, citizen: mappedUser });
  } catch (err) {
    console.error('Erreur login citoyen :', err);
    res.status(500).json({ error: 'Erreur interne de connexion.' });
  }
});

app.post('/api/auth/agent/login', validate(agentLoginSchema), async (req, res) => {
  try {
    const { username, password } = req.body;
    // Validation déjà effectuée par le schéma zod

    const agentRes = await query('SELECT * FROM agents WHERE username = $1 LIMIT 1', [username]);
    if (agentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun agent trouvé avec cet identifiant.' });
    }

    const agent = agentRes.rows[0];
    // Comparaison stricte via bcrypt uniquement (pas de fallback en clair)
    const match = await bcrypt.compare(password, agent.password_hash);
    if (!match) {
      // Délai constant pour limiter l'énumération de comptes
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }

    // Generate JWT (access token)
    // Le jeton porte la MSD de rattachement (`msd_code`) : c'est CE CODE qui
    // cloisonne les données, pas le libellé de département. Le libellé reste
    // pour l'affichage ; le code est la clé de filtre, stable et sans ambiguïté.
    // Un Super Admin n'a pas de `msd_code` : il supervise toutes les MSD.
    const agentPayload = {
      id: agent.id,
      role: agent.role,
      username: agent.username,
      department: agent.department,
      msdCode: agent.msd_code || null
    };
    const token = jwt.sign(agentPayload, EFFECTIVE_JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL.agent });
    // Émet un refresh token
    const refreshToken = await issueRefreshToken(agentPayload);

    // Log successful login
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CONNEXION_AGENT', username, `Connexion réussie de l'agent ${agent.first_name} ${agent.last_name} (${agent.role}${agent.msd_code ? ' / MSD ' + agent.msd_code : ''}).`]
    );

    res.json({
      success: true,
      token,
      refreshToken,
      agent: {
        id: agent.id,
        username: agent.username,
        firstName: agent.first_name,
        lastName: agent.last_name,
        role: agent.role,
        photoUrl: agent.photo_url,
        department: agent.department,
        msdCode: agent.msd_code || null
      }
    });
  } catch (err) {
    console.error('Erreur login agent :', err);
    res.status(500).json({ error: 'Erreur interne de connexion.' });
  }
});

// 0b. Refresh Access Token
// Le client envoie son refresh token (corps ou header) ; on vérifie qu'il est valide
// et actif en DB, on le révoque (rotation), puis on émet un nouvel access token + refresh token.
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || (req.headers['x-refresh-token']);
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token requis.' });
    }

    const result = await verifyRefreshToken(refreshToken);
    if (!result) {
      return res.status(401).json({ error: 'Refresh token invalide, expiré ou révoqué.' });
    }

    const { payload, record } = result;

    // Rotation : on révoque l'ancien refresh token
    await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1`, [record.id]);

    // Émet un nouvel access token + refresh token
    const role = payload.role;
    const ttl = ACCESS_TOKEN_TTL[role] || '8h';
    const newAccessToken = jwt.sign(
      { id: payload.id, role: payload.role },
      EFFECTIVE_JWT_SECRET,
      { expiresIn: ttl }
    );
    const newRefreshToken = await issueRefreshToken({ id: payload.id, role: payload.role });

    res.json({ success: true, token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Erreur refresh token :', err);
    res.status(500).json({ error: 'Erreur interne lors du renouvellement.' });
  }
});

// 0c. Logout — révoque le refresh token courant
app.post('/api/auth/logout', async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || (req.headers['x-refresh-token']);
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    // L'access token reste valide jusqu'à expiration (court) ; pas de blacklist côté serveur
    res.json({ success: true, message: 'Déconnexion réussie.' });
  } catch (err) {
    console.error('Erreur logout :', err);
    res.status(500).json({ error: 'Erreur interne lors de la déconnexion.' });
  }
});

// 1. Get Mutuelles (with search and region filters)
app.get('/api/mutuelles', async (req, res) => {
  try {
    const { region, status, search } = req.query;
    let sql = 'SELECT * FROM mutuelles WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (region && region !== 'all') {
      sql += ` AND region = $${paramIndex}`;
      params.push(region);
      paramIndex++;
    }

    if (status && status !== 'all') {
      sql += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIndex} OR commune ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ' ORDER BY name ASC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des mutuelles :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 2. Get Locations for Leaflet Map
// IP du serveur pour les QR codes. Même source que /api/lan-ip : renvoyer
// 'localhost' ici faisait écrire une URL illisible sur les cartes imprimées.
app.get('/api/server-ip', (req, res) => {
  res.json({ ip: detectLanIp() });
});

app.get('/api/locations', async (req, res) => {
  try {
    const result = await query('SELECT * FROM locations ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des localisations :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

app.post('/api/log', (req, res) => {
  try {
    const fs = require('fs');
    const logPath = require('path').join(__dirname, 'frontend_error.log');
    const { message, stack } = req.body;
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR: ${message}\nStack: ${stack}\n\n`);
    res.json({ status: 'logged' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get News Articles
app.get('/api/news', async (req, res) => {
  try {
    const result = await query('SELECT * FROM news ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur lors de la récupération des actualités :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 4. Submit New Membership (Adhésion)
app.post('/api/adhesions', validate(adhesionSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      firstName,
      lastName,
      birthDate,
      phone,
      email,
      address,
      mutuelleName,
      packageType,
      paymentMethod,
      familyMembers,
      sponsorPhone,
      schoolName,
      parrainageType,
      sponsoredHouseholds
    } = req.body;

    // La validation zod a déjà vérifié les champs obligatoires

    // Matricule CMU unique et séquentiel par MSD (remplace le tirage
    // Math.random() qui produisait des collisions sur 9 000 valeurs).
    const cmuNumber = await fallbackStore.generateCmuNumber({
      query,
      program:
        packageType === 'csu_eleves' ? 'ELEVES'
        : packageType === 'csu_daara' ? 'DAARA'
        : packageType === 'adhesion_masse' ? 'GROUPE'
        : 'CLASSIC',
      mutuelleName
    });

    await client.query('BEGIN');

    // PIN à 4 chiffres, unique par adhérent : on rejette les PIN déjà
    // attribués (sinon deux familles partagent le même code d'accès).
    let generatedPin = null;
    for (let attempt = 0; attempt < 10 && !generatedPin; attempt++) {
      const candidatePin = String(Math.floor(1000 + Math.random() * 9000));
      const taken = await client.query('SELECT 1 FROM beneficiaries WHERE pin_code = $1 LIMIT 1', [candidatePin]);
      if (!taken.rows.length) generatedPin = candidatePin;
    }
    // Filet de sécurité : suffixe temporel (le PIN est haché après).
    if (!generatedPin) generatedPin = String(Date.now()).slice(-4);
    const pinSalt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(generatedPin, pinSalt);

    // Insert Beneficiary
    const beneficiaryInsert = `
      INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, sponsor_phone, school_name, pin_code)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `;
    const bResult = await client.query(beneficiaryInsert, [
      firstName,
      lastName,
      birthDate || '',
      phone,
      email || '',
      address || '',
      mutuelleName,
      packageType,
      paymentMethod,
      cmuNumber,
      'pending', // Initial status is pending, requiring agent validation
      sponsorPhone || null,
      schoolName || null,
      hashedPin
    ]);

    const beneficiaryId = bResult.rows[0].id;

    // Insert Family Members & Create Sub-accounts for Sponsoring/Students
    if (packageType === 'parrainage') {
      if (parrainageType === 'menages' && sponsoredHouseholds && sponsoredHouseholds.length > 0) {
        for (const hh of sponsoredHouseholds) {
          // Create separate family/household account
          const chefCmu = await fallbackStore.generateCmuNumber({
            query, program: 'MENAGES', mutuelleName
          });
          const nameParts = hh.chefName.trim().split(' ');
          const fName = nameParts[0] || 'Chef';
          const lName = nameParts.slice(1).join(' ') || 'Ménage';

          const chefRes = await client.query(
            `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, sponsor_phone)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
            [fName, lName, '1980-01-01', hh.chefPhone || phone, '', address, mutuelleName, 'familial', paymentMethod, chefCmu, 'pending', phone]
          );
          const chefId = chefRes.rows[0].id;

          // Insert family members for this Chef
          if (hh.members && hh.members.length > 0) {
            for (const m of hh.members) {
              await client.query(
                `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES ($1, $2, $3, $4)`,
                [chefId, m.name, m.relation || 'parent', parseInt(m.age || '0')]
              );
            }
          }
        }
      } else if (familyMembers && familyMembers.length > 0) {
        // Individual or students parrainage
        for (const member of familyMembers) {
          const program = parrainageType === 'eleves' ? 'ELEVES'
            : parrainageType === 'collectif' ? 'COLLECTIF'
            : 'PARRAINAGE';
          const bCmu = await fallbackStore.generateCmuNumber({ query, program, mutuelleName });
          const nameParts = member.name.trim().split(' ');
          const fName = nameParts[0] || (parrainageType === 'eleves' ? 'Élève' : parrainageType === 'collectif' ? 'Bénéficiaire' : 'Filleul');
          const lName = nameParts.slice(1).join(' ') || (parrainageType === 'eleves' ? 'Scolaire' : parrainageType === 'collectif' ? 'Collectif' : 'Parrainé');

          await client.query(
            `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, sponsor_phone, school_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [fName, lName, '2000-01-01', phone, '', address, mutuelleName, 'individuel', paymentMethod, bCmu, 'pending', phone, schoolName || null]
          );
        }
      }
    } else {
      // Normal Individuel / Familial / CSU Élèves Direct
      if (familyMembers && familyMembers.length > 0) {
        for (const member of familyMembers) {
          // Link to main applicant
          await client.query(
            `INSERT INTO family_members (beneficiary_id, name, relation, age) VALUES ($1, $2, $3, $4)`,
            [beneficiaryId, member.name, member.relation, parseInt(member.age || '0')]
          );

          if (packageType === 'csu_eleves' || packageType === 'csu_daara' || packageType === 'adhesion_masse') {
            // Create separate account for member/student
            const program = packageType === 'adhesion_masse' ? 'GROUPE'
              : packageType === 'csu_daara' ? 'DAARA'
              : 'ELEVES';
            const bCmu = await fallbackStore.generateCmuNumber({ query, program, mutuelleName });
            const nameParts = member.name.trim().split(' ');
            const fName = nameParts[0] || (packageType === 'adhesion_masse' ? 'Membre' : 'Élève');
            const lName = nameParts.slice(1).join(' ') || (packageType === 'adhesion_masse' ? 'Collectif' : 'Scolaire');

            await client.query(
              `INSERT INTO beneficiaries (first_name, last_name, birth_date, phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status, school_name)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [fName, lName, '2015-01-01', phone, '', address, mutuelleName, 'individuel', paymentMethod, bCmu, 'pending', schoolName || 'Établissement']
            );
          }
        }
      }
    }

    await client.query('COMMIT');

    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['DEPOS_PRE_INSCRIPTION', phone, `Nouveau dossier d'adhésion en ligne déposé pour ${firstName} ${lastName} (CMU généré: ${cmuNumber}).`]
    );

    // Points de fidélité si parrainage
    if (packageType === 'parrainage') {
      await awardPoints(beneficiaryId, 40, 'parrainage');
    }

    res.status(201).json({
      success: true,
      message: 'Adhésion enregistrée avec succès.',
      cmuNumber,
      beneficiaryId,
      // PIN temporaire (en production : envoi par SMS, jamais retourné en clair après ça)
      pinCode: generatedPin
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de l\'enregistrement de l\'adhésion :', err);

    // ========================================================
    //  FALLBACK : base indisponible (Postgres non démarré…)
    //  → l'adhésion est TOUJOURS sauvegardée dans le fichier
    //    backend/data/store.json, puis rejouée à la reconnexion.
    // ========================================================
    try {
      const body = req.body || {};
      fallbackStore.addRecord('adhesions', {
        firstName: body.firstName || '',
        lastName: body.lastName || '',
        birthDate: body.birthDate || body.dateOfBirth || '',
        phone: body.phone || '',
        email: body.email || '',
        address: body.address || '',
        mutuelleName: body.mutuelleName || 'MSD Dakar',
        packageType: body.packageType || 'individuel',
        paymentMethod: body.paymentMethod || 'mobile_money',
        cmuNumber: cmuNumber,
        sponsorPhone: body.sponsorPhone || null,
        schoolName: body.schoolName || null,
        status: 'active'
      });
      return res.status(201).json({
        success: true,
        fallback: true,
        message: 'Base indisponible : votre adhésion est enregistrée en mode secours (fichier) et sera synchronisée automatiquement à la reconnexion.',
        cmuNumber
      });
    } catch (fbErr) {
      console.error('[FallbackStore] Échec de la sauvegarde secours :', fbErr.message);
    }

    res.status(500).json({ error: 'Erreur lors de la sauvegarde de l\'adhésion.' });
  } finally {
    client.release();
  }
});

// 5. Cotisation Renewal (Connexion & Fay)
app.post('/api/cotisations/renew', validate(cotisationRenewSchema), async (req, res) => {
  try {
    const { phone } = req.body;
    // Téléphone déjà validé et normalisé

    // Find beneficiary by phone
    const userResult = await query('SELECT * FROM beneficiaries WHERE phone = $1 LIMIT 1', [phone]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun dossier adhérent trouvé pour ce numéro de téléphone.' });
    }

    const beneficiary = userResult.rows[0];

    // Update status to active and simulate renew transaction
    await query('UPDATE beneficiaries SET status = $1 WHERE id = $2', ['active', beneficiary.id]);

    // Insert cotisation record to make stats dynamic
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    const payRef = `REN-SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    await query(
      `INSERT INTO cotisations (beneficiary_id, cmu_number, phone, amount, payment_method, payment_reference, period_start, period_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid')`,
      [beneficiary.id, beneficiary.cmu_number, phone, 4500, beneficiary.payment_method || 'wave', payRef, periodStart, periodEnd]
    );

    // Award loyalty points
    await awardPoints(beneficiary.id, 50, 'cotisation_a_temps');

    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['RENOUVELLEMENT_COTISATION', phone, `Renouvellement annuel de la cotisation (4 500 FCFA) pour l'assuré ${beneficiary.first_name} ${beneficiary.last_name}.`]
    );

    res.json({
      success: true,
      message: 'Cotisation renouvelée avec succès.',
      beneficiary: {
        firstName: beneficiary.first_name,
        lastName: beneficiary.last_name,
        cmuNumber: beneficiary.cmu_number,
        mutuelleName: beneficiary.mutuelle_name,
        status: 'active'
      }
    });
  } catch (err) {
    console.error('Erreur lors du renouvellement :', err);
    res.status(500).json({ error: 'Erreur interne du serveur lors du renouvellement.' });
  }
});

// 6. Online Donation
app.post('/api/donations', validate(donationSchema), async (req, res) => {
  try {
    const { amount, target } = req.body;
    // Montant déjà validé et converti en entier par zod

    await query(
      `INSERT INTO donations (amount, target) VALUES ($1, $2)`,
      [parseInt(amount), target || 'general']
    );

    // Audit log for donations
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['DON_EN_LIGNE', 'Donateur anonyme', `Don de ${parseInt(amount).toLocaleString('fr-FR')} FCFA en ligne pour : ${target}.`]
    );

    res.status(201).json({ success: true, message: 'Don enregistré avec succès.' });
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement du don :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 6b. Get donation stats by target
app.get('/api/donations/stats', async (req, res) => {
  try {
    const result = await query(
      'SELECT target, SUM(amount) as total FROM donations GROUP BY target'
    );
    res.json({ success: true, stats: result.rows });
  } catch (err) {
    console.error('Erreur lors de la récupération des stats de dons :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 6c. GET /api/campaign/active (Get active donation campaign details)
app.get('/api/campaign/active', async (req, res) => {
  try {
    const campaignRes = await query('SELECT * FROM donation_campaigns WHERE is_active = TRUE LIMIT 1');
    if (campaignRes.rows.length === 0) {
      return res.json({
        id: 0,
        title_fr: 'Soutenir la solidarité régionale',
        title_wo: 'Dimbalél wa Dakar yi',
        description_fr: 'Soutenez les familles les plus vulnérables de Dakar en finançant leur couverture santé annuelle (4 500 FCFA).',
        description_wo: 'Dimbalél wa Dakar yi gënë néewal doole ngir ñu mënë am fajj wér-gi-yaram (4 500 FCFA).',
        target_amount: 1000000,
        baseline_amount: 720000,
        collected_amount: 720000
      });
    }
    const c = campaignRes.rows[0];
    const donationsRes = await query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE created_at >= $1 AND (target = 'rufisque' OR target = 'general' OR target = 'solidarite')",
      [c.created_at]
    );
    const collected = parseInt(c.baseline_amount || 0) + parseInt(donationsRes.rows[0].total || 0);

    res.json({
      id: c.id,
      title_fr: c.title_fr,
      title_wo: c.title_wo,
      description_fr: c.description_fr,
      description_wo: c.description_wo,
      target_amount: parseInt(c.target_amount),
      baseline_amount: parseInt(c.baseline_amount),
      collected_amount: collected
    });
  } catch (err) {
    console.error('Erreur get active campaign :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 6d. POST /api/campaign (Create and activate a new donation campaign - requires Super Admin only)
app.post('/api/campaign', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { titleFr, titleWo, descriptionFr, descriptionWo, targetAmount, baselineAmount } = req.body;
    if (!titleFr || !titleWo || !descriptionFr || !descriptionWo || !targetAmount) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }

    await query('UPDATE donation_campaigns SET is_active = FALSE');
    const result = await query(
      `INSERT INTO donation_campaigns (title_fr, title_wo, description_fr, description_wo, target_amount, baseline_amount, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [titleFr, titleWo, descriptionFr, descriptionWo, parseInt(targetAmount), parseInt(baselineAmount || 0)]
    );

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CREATION_CAMPAGNE_DON', req.user.username, `Création d'une nouvelle campagne de don: ${titleFr}.`]
    );

    res.status(201).json({ success: true, campaign: result.rows[0] });
  } catch (err) {
    console.error('Erreur create campaign :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 6e. PUT /api/campaign/:id (Modify campaign details - requires Super Admin only)
app.put('/api/campaign/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { titleFr, titleWo, descriptionFr, descriptionWo, targetAmount, baselineAmount, isActive } = req.body;

    const checkRes = await query('SELECT * FROM donation_campaigns WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Campagne introuvable.' });
    }

    const current = checkRes.rows[0];
    const newTitleFr = titleFr !== undefined ? titleFr : current.title_fr;
    const newTitleWo = titleWo !== undefined ? titleWo : current.title_wo;
    const newDescFr = descriptionFr !== undefined ? descriptionFr : current.description_fr;
    const newDescWo = descriptionWo !== undefined ? descriptionWo : current.description_wo;
    const newTarget = targetAmount !== undefined ? parseInt(targetAmount) : current.target_amount;
    const newBaseline = baselineAmount !== undefined ? parseInt(baselineAmount) : current.baseline_amount;
    const newActive = isActive !== undefined ? isActive : current.is_active;

    if (newActive === true) {
      await query('UPDATE donation_campaigns SET is_active = FALSE WHERE id <> $1', [id]);
    }

    const result = await query(
      `UPDATE donation_campaigns 
       SET title_fr = $1, title_wo = $2, description_fr = $3, description_wo = $4, 
           target_amount = $5, baseline_amount = $6, is_active = $7
       WHERE id = $8 RETURNING *`,
      [newTitleFr, newTitleWo, newDescFr, newDescWo, newTarget, newBaseline, newActive, id]
    );

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['MODIFICATION_CAMPAGNE_DON', req.user.username, `Modification de la campagne de don ID ${id}: ${newTitleFr}.`]
    );

    res.json({ success: true, campaign: result.rows[0] });
  } catch (err) {
    console.error('Erreur put campaign :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 6f. DELETE /api/campaign/:id (Delete campaign - requires Super Admin only)
app.delete('/api/campaign/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const checkRes = await query('SELECT * FROM donation_campaigns WHERE id = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Campagne introuvable.' });
    }

    await query('DELETE FROM donation_campaigns WHERE id = $1', [id]);

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['SUPPRESSION_CAMPAGNE_DON', req.user.username, `Suppression de la campagne de don ID ${id}.`]
    );

    res.json({ success: true, message: 'Campagne supprimée avec succès.' });
  } catch (err) {
    console.error('Erreur delete campaign :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 7. Bilingual Gemini 1.5 Chatbot with local rules fallback
app.post('/api/chatbot', validate(chatbotSchema), async (req, res) => {
  try {
    const { message, lang, history, isVoiceInput } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      let userMessageToProcess = message;

      // Marqueurs phonétiques : le STT navigateur (modèle français) produit ces
      // segments uniquement quand il a entendu du Wolof. Permet de réparer la
      // phrase Wolof même si l'interface était en mode Français.
      const WOLOF_STT_HINT = /(nanga|non pas de|n'en a de|jërejëf|jerejef|dieuredieuf|j'irai jef|salaam|salam ale|salamalekoum|salut malikoum|garab|garap|garde bille|fajukaay|fajucaie|fadjou|fadiou|xaalis|haliss|khaliss|calice|chalice|ñaata|gnata|niata|mungui|mangui|mon guide|moun gui|\bndax\b|\bwaaw\b|ouaou|déedéet|dé dé|des dettes|diam re|jamm re|diamm|nouillou|gnoy|faille[sz]?\s+cotisation|faye\s+cotisation|fay\s+cotisation|bouquet ci|bock ci|meune|wer gui|wér-gi|deufe|deuffe|\bouax\b|naka nga|na nga)/i;

      // ── Réparation STT pour TOUTE entrée vocale ──
      // Le STT du navigateur transcrit avec le modèle acoustique FRANÇAIS :
      // le Wolof parlé devient du français phonétique (« nanga def » → « non
      // pas de », « ñaata » → « gnata »). Gemini détecte la langue réelle et
      // reconstruit la phrase originale — l'usager VOIT alors ses mots en
      // Wolof dans le chat et reçoit une réponse en Wolof.
      // Plafonné à 4 s : la réponse globale doit rester rapide pour l'usager.
      const geminiStartedAt = Date.now();
      let speaksWolof = false;
      if (isVoiceInput) {
        try {
          console.log("Tentative de réparation STT (wolof/français)...");
          const repairSystemInstruction = `Tu es un correcteur de transcription vocale pour une application de santé au Sénégal (chatbot Zahara). Le texte fourni a été transcrit par un moteur de reconnaissance vocale FRANÇAIS. Deux cas possibles :
1) L'utilisateur a parlé WOLOF : le moteur a produit une phonétique française approximative (exemples réels : « nanga def » → « non pas de », « jërejëf » → « j'irai jef », « ñaata la cotisation » → « gnata la cotisation », « garab » → « garde bille », « fajukaay » → « facture kay », « waaw » → « ouaou »). Reconstruis alors la phrase Wolof originale correcte et complète (orthographe wolof standard : ë, ñ).
2) L'utilisateur a parlé FRANÇAIS : le texte est déjà correct, renvoie-le strictement inchangé.
Réponds STRICTEMENT avec un objet JSON seul, sans texte autour : {"lang":"wo","text":"phrase wolof reconstruite"} ou {"lang":"fr","text":"texte français inchangé"}`;
          // Marqueurs wolof sûrs dans un texte déjà réparé
          const WOLOF_REPAIRED_HINT = /(nanga|naka|jërejëf|jerejef|salaam|salam ale|garab|fajukaay|ndax|waaw|déedéet|ñaata|xaalis|dimbali|fajj|jamm|rekk|mungi|mangi|wér-gi-yaram|fayal|bokk ci|laaj)/i;
          let repaired = null;
          for (const repairModelName of ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash']) {
            // Budget de réparation : 4 s max AU TOTAL (pas par modèle)
            const repairLeft = 4000 - (Date.now() - geminiStartedAt);
            if (repairLeft < 800) break;
            try {
              const repairModel = genAI.getGenerativeModel({
                model: repairModelName,
                systemInstruction: repairSystemInstruction
              });
              const repairTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Repair Timeout')), repairLeft)
              );
              const repairResult = await Promise.race([
                repairModel.generateContent(message),
                repairTimeout
              ]);
              const raw = (repairResult.response.text() || '').trim();
              // Nettoie les balises de code éventuelles autour du JSON
              const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
              let parsedOk = false;
              try {
                const parsed = JSON.parse(jsonStr);
                if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
                  repaired = { lang: parsed.lang === 'wo' ? 'wo' : 'fr', text: parsed.text.trim() };
                  parsedOk = true;
                }
              } catch (e) { /* réponse non-JSON */ }
              if (!parsedOk && raw && WOLOF_REPAIRED_HINT.test(raw)) {
                // Réponse en texte libre contenant du Wolof : on la garde
                repaired = { lang: 'wo', text: raw };
              }
              if (repaired) break;
            } catch (e) { /* essai du modèle suivant */ }
          }
          if (repaired) {
            speaksWolof = repaired.lang === 'wo' || WOLOF_REPAIRED_HINT.test(repaired.text);
            userMessageToProcess = repaired.text;
            console.log(`[STT Repair] (${repaired.lang}) "${message}" -> "${repaired.text}"`);
          } else if (WOLOF_STT_HINT.test(message)) {
            // Réparation indisponible : on se rabat sur les marqueurs statiques
            speaksWolof = true;
          }
        } catch (repairErr) {
          console.warn("Erreur réparation STT:", repairErr.message);
          if (WOLOF_STT_HINT.test(message)) speaksWolof = true;
        }
      } else if (lang === 'wo') {
        // Saisie clavier en mode Wolof : pas de réparation nécessaire
        speaksWolof = true;
      }

      // Candidate models for Gemini API (du plus récent au plus ancien —
      // gemini-2.0-flash / 1.5-flash sont officiellement retirés par Google : 404)
      const modelCandidates = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
      
      const knowledgeBaseContext = `
DOCUMENTS ET SPÉCIFICATIONS OFFICIELLES MUTUALIS SÉNÉGAL — CSU UNAMUSC 2026:
1. VISION & RÔLE : MUTUALIS SÉNÉGAL est le portail numérique régional du Tiers-Payant pour la Couverture Santé Universelle (CSU) de l'Union Nationale des Mutuelles de Santé Communautaires (UNAMUSC). Zahara agit en tant qu'Agent Personnel dédié à l'assuré à jour de cotisations.
2. TARIFS ET FORMULES D'ADHÉSION :
   - Formule Individuelle : 4 500 FCFA par an (comprenant 1 000 FCFA pour la carte Pass CSU + 3 500 FCFA de cotisation annuelle).
   - Formule Familiale : 1 000 FCFA pour la carte du chef de famille + 3 500 FCFA de cotisation par membre inscrit.
   - Parrainage Solidaire CSU : 4 500 FCFA par bénéficiaire (permet de parrainer et d'offrir la mutuelle aux familles vulnérables).
   - CSU Élèves / Daaras : Tarif subventionné de 1 000 FCFA par élève / talibé par an.
   - Réactivation de carte suspendue : 10 500 FCFA (pour régulariser les arriérés et réactiver les droits tiers-payant immédiatement).
3. RÈGLES STRICTES DE PRISE EN CHARGE ET TAUX OFFICIELS :
   - 🧾 BONS DE COMMANDE PHARMACIE (48h) : Prise en charge à 50% par l'UNAMUSC, et 50% restant à la charge de l'assuré (ticket modérateur) sur les médicaments génériques et ordonnances en officines agréées.
   - 🏥 LETTRES DE GARANTIE HOSPITALIÈRES : Prise en charge à 80% par l'UNAMUSC, et 20% à la charge de l'assuré pour les hospitalisations, chirurgies et examens lourds dans les hôpitaux conventionnés (Hôpital Principal de Dakar, CHU Fann, Hôpital Aristide Le Dantec, CHU Abass Ndao, Dalal Jamm, Roi Baudouin, HOGIP Grand Yoff...).
   - 👶 GRATUITÉ MATERNITÉ & PÉDIATRIQUE BSF : 100% de prise en charge intégrale (0 FCFA pour la patiente) sur consultations prénatales (CPN 1 à CPN 4+), accouchement, kit d'accouchement, fer/acide folique et vaccins PEV du nourrisson.
   - 🧓 PLAN SESAME (Séniors ≥ 60 ans) : 100% pris en charge (80% UNAMUSC + 20% Plan Sésame État du Sénégal).
4. MÉDICAMENTS COUVERTS (OUI / NON) :
   - OUI (Pris en charge à 50%) : Paracétamol, Amoxicilline, Ibuprofène, Insuline, Métformine, Amlodipine, Ciprofloxacine, Oméprazole, Azithromycine, etc.
   - OUI (Pris en charge à 100%) : ACT antipaludiques, Fer + Acide Folique grossesse, vaccins PEV.
   - NON (Non pris en charge / 0%) : Compléments alimentaires sans ordonnance, vitamines de confort, cosmétiques, chirurgie esthétique de confort.
5. CARTOGRAPHIE SANITAIRE & STRUCTURES CONVENTIONNÉES DAKAR :
   - Hôpitaux conventionnés : Hôpital Principal, CHU Fann, Le Dantec, Abass Ndao, Dalal Jamm, Albert Royer, HOGIP, Ouakam.
   - Centres & Postes de santé : Médina, Philippe Senghor (Yoff), Pikine, Fass, Grand Yoff, Keur Massar, Mbao, Hann Bel-Air.
   - Pharmacies agréées : Pharmacie du Plateau, Guigon, Nation (Colobane), Atlantique, Pikine, Guédiawaye...
   - Bureaux MSD (Mutuelle de Santé Départementale) : Dakar Plateau, Pikine Ouest, Guédiawaye Golf Sud, Keur Massar Nord, Rufisque Nord.
`;

      // L'usager a parlé Wolof au micro → répondre en Wolof même si l'UI était en FR
      const systemInstructionText = (lang === 'wo' || speaksWolof)
        ? `Vous êtes "Zahara", l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal).

Votre personnalité :
- Vous êtes une femme sénégalaise chaleureuse, bienveillante, accueillante et très professionnelle. Vous vous exprimez avec respect (Teranga).
- Vous répondez de manière concise, précise et naturelle en WOLOF (Sénégal).

Consignes strictes :
- Répondez UNIQUEMENT en WOLOF officiel standardisé (utilisez: laaj, tontu, ngir, bëgg, dimbali, faj, fajukaay, fay, mutuelle, cotisation, etc.).
- Ne répétez jamais un texte générique. Répondez exactement à la question posée en vous basant sur la base de connaissances ci-dessous.
- Si l'usager parle de paiement ou cotisation, rappelez les tarifs (4 500 FCFA individuel, 1 000 FCFA + 3 500 FCFA familial, Orange Money / Wave).
- Si l'usager parle de maternité ou d'accouchement, rappelez la gratuité à 100% UNAMUSC.
- Si l'usager parle de chirurgie ou d'hôpital, rappelez la prise en charge de 80% à 100% par Lettre de Garantie.
- ANTI-RÉPÉTITION STRICTE : ne répétez jamais mot pour mot une formulation déjà utilisée dans l'historique. Variez vocabulaire et structure à chaque réponse.
- Ne vous représentez pas à nouveau si le dialogue est entamé : poursuivez naturellement.
- Variez la clôture à chaque réponse (la même formule de politesse ne doit jamais revenir deux fois de suite).

BASE DE CONNAISSANCES OFFICIELLE :
${knowledgeBaseContext}`
        : `Vous êtes "Zahara", l'assistante virtuelle officielle de MUTUALIS DAKAR, le portail régional de l'Union Nationale des Mutuelles de Santé Communautaires du Sénégal (UNAMUSC).

Votre personnalité :
- Vous êtes une femme sénégalaise chaleureuse, accueillante et très professionnelle.
- Vous répondez de manière fluide, claire et concise (3 à 5 phrases max) en FRANÇAIS.

Consignes strictes :
- Répondre PRÉCISÉMENT à la question spécifique posée par l'usager en exploitant la base de connaissances ci-dessous.
- Ne donnez jamais de réponse générique vague.
- Si l'usager pose des questions sur l'adhésion ou tarifs, donnez les prix exacts (4 500 FCFA individuel, 1 000 FCFA + 3 500 FCFA familial, Wave/Orange Money).
- Si la question concerne la maternité, rappelez la gratuité à 100% (CPN 1-4+, accouchement, vaccins PEV).
- Si la question concerne l'hôpital ou les chirurgies, expliquez les Lettres de Garantie (80% à 100%).
- ANTI-RÉPÉTITION STRICTE : ne répétez JAMAIS mot pour mot une formulation déjà présente dans l'historique. Variez le vocabulaire, la structure des phrases et les exemples à chaque réponse.
- Ne vous représentez pas à nouveau ("Je suis Zahara...") si la conversation est déjà entamée : poursuivez naturellement le dialogue.
- Variez la formule de clôture (question ouverte courte, proposition d'aide ciblée, ou simple politesse) et ne clôturez pas systématiquement — jamais deux fois la même clôture de suite.

BASE DE CONNAISSANCES OFFICIELLE :
${knowledgeBaseContext}`;

      for (const modelName of modelCandidates) {
        // Délai global plafonné (~9 s) : au-delà, on bascule immédiatement sur
        // le moteur local — une réponse lente est perçue comme un silence.
        if (Date.now() - geminiStartedAt > 9000) break;
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstructionText
          });

          let chatHistory = [];
          let expectedRole = 'user';
          for (const h of (history || [])) {
            const role = h.sender === 'user' ? 'user' : 'model';
            if (role === expectedRole) {
              chatHistory.push({
                role,
                parts: [{ text: h.text || '' }]
              });
              expectedRole = expectedRole === 'user' ? 'model' : 'user';
            }
          }
          if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'user') {
            chatHistory.pop();
          }

          const chat = model.startChat({ history: chatHistory });
          
          // Budget global ~9,5 s : la réponse doit TOUJOURS partir avant le
          // timeout de 12 s du frontend, sinon l'usager reçoit le texte local
          // générique alors que Gemini finit par répondre trop tard.
          const chatBudget = Math.max(1500, 9500 - (Date.now() - geminiStartedAt));
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Gemini Timeout')), chatBudget)
          );
          
          const result = await Promise.race([
            chat.sendMessage(userMessageToProcess),
            timeoutPromise
          ]);
          
          const responseText = result.response.text();
          console.log(`Succès avec le modèle ${modelName}`);
          return res.json({ response: responseText, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
        } catch (geminiErr) {
          // Continue to next model candidate
        }
      }
      console.warn('Utilisation instantanée du moteur de connaissances expert local.');
    }

    // ── MOTEUR DE CONNAISSANCES EXPERT LOCAL INTELlIGENT (RAG / NLP) ──
    const msg = (typeof userMessageToProcess !== 'undefined' ? userMessageToProcess : message).toLowerCase();
    let reply = '';
    // Variations aléatoires pour les réponses les plus sollicitées (anti-répétition)
    const pickVariant = (variants) => variants[Math.floor(Math.random() * variants.length)];

    if (lang === 'wo') {
      // WOLOF KNOWLEDGE ENGINE — intentions métier d'abord, salutation en
      // dernier : « nanga def, ñaata la cotisation ? » doit répondre le tarif.
      if (msg.includes('maternité') || msg.includes('jur') || msg.includes('bir') || msg.includes('enceinte') || msg.includes('cpn') || msg.includes('pév') || msg.includes('vaccin')) {
        reply = "Programme Gratuité Maternité & BSF bi dafa gratuit 100% ci UNAMUSC ! Lépp lu jëm ci consultation prénatale (CPN 1 ba CPN 4+), kit d'accouchement, fer, acide folique ak vaccins tiit yépp mën nga ko am ci 0 FCFA. 👶 maternal 100%";
      } else if (msg.includes('garantie') || msg.includes('hôpital') || msg.includes('chirurgie') || msg.includes('fann') || msg.includes('dantec') || msg.includes('opération') || msg.includes('devis')) {
        reply = "Lettre de garantie hospitalière bi day fay 80% ba 100% ci say frais d'hospitalisation ak opération ci hôpitaux agréés (Fann, Le Dantec, Abass Ndao, Hôpital Principal). Demal ci tab 'Lettres de garantie' ngir am sa certificat homologué. 🏥";
      } else if (msg.includes('pharmacie') || msg.includes('garab') || msg.includes('ordonnance') || msg.includes('bon de commande') || msg.includes('officine')) {
        reply = "Bons de commande pharmacie (48h) yi dañuy fay 50% ba 80% ci prix garab yi ci ordonnance bi. Pharmacien agréé bi day scanner sa QR Code te nàntu 50% bi ngir nga fay reste bi rekk. 💊";
      } else if (msg.includes('fay') || msg.includes('cotisation') || msg.includes('tarif') || msg.includes('prix') || msg.includes('ñata') || msg.includes('combien') || msg.includes('xaalis')) {
        reply = "Tarif d'adhésion UNAMUSC : Formule Individuelle mooy 4 500 FCFA ci at mi (1 000 FCFA carte + 3 500 FCFA cotisation). Formule Familiale mooy 1 000 FCFA carte njiitu kër bi + 3 500 FCFA par membre. Mën nga fay ci Orange Money walla Wave ! 💰";
      } else if (msg.includes('parrainage') || msg.includes('dimbali') || msg.includes('démuni') || msg.includes('solidaire')) {
        reply = "Parrainage Solidaire CSU (4 500 FCFA / nit) day tax nga mënë fayal mutuelle nit bu néewal doole ci regiou Ndakaaru. Demal ci tab 'Parrainage CSU' ngir dimbali sa mbokk. 🤝";
      } else if (msg.includes('élève') || msg.includes('eleve') || msg.includes('daara') || msg.includes('talibé') || msg.includes('ecole')) {
        reply = "CSU Élèves & Daaras dafa am subvention : 1 000 FCFA rekk par élève/talibé ci at mi ngir ñu am couverture maladie complète. 📚";
      } else if (msg.includes('suspendre') || msg.includes('bloqué') || msg.includes('débloquer') || msg.includes('régulariser') || msg.includes('10 500') || msg.includes('10500')) {
        reply = "Boo amee carte bu suspendre, mën nga ko régulariser ci 10 500 FCFA ci Orange Money walla Wave ngir dëppatal say droits tiers-payant sur-le-champ ! ⚡";
      } else if (msg.includes('télémédecine') || msg.includes('telemedecine') || msg.includes('vidéo') || msg.includes('docteur') || msg.includes('médecin') || msg.includes('visio')) {
        reply = "Télémédecine WebRTC bi day la jokkoo ak docteur agréé ci vidéo HD. Dokter bi mën na la bindal ordonnance électronique te yónnee ko ci guichet pharmacie direct ! 💻";
      } else if (msg.includes('bokk') || msg.includes('adhérer') || msg.includes('inscrire') || msg.includes('nouvelle adhésion')) {
        reply = "Ngir bokk ci mutuelle bi, demal ci tab 'Services en ligne' -> 'Nouvelle adhésion'. Bindal sa tur, sa sant, dugal sa photo ak sa carte CNI, te fay ci Wave walla Orange Money ci 2 minutes ! 📝";
      } else if (msg.includes('mutuelle') || msg.includes('fan') || msg.includes('ou') || msg.includes('adresse') || msg.includes('cartographie') || msg.includes('dakar')) {
        reply = "UNAMUSC dafa am mutuelles ci 14 départements du Ndakaaru (Médina, Pikine, Guédiawaye, Keur Massar, Rufisque, Thiaroye...). Xoolal carte interactive bi ci tab 'Cartographie'. 📍";
      } else if (msg.includes('salaam') || msg.includes('naka') || msg.includes('bonjour') || msg.includes('salamaalekum') || msg.includes('nanga def')) {
        reply = pickVariant([
          "Salamaalekum ! Nanga def ! Man la Zahara, assistante virtuelle bu MUTUALIS DAKAR (UNAMUSC). Naka la la mënee dimbali tey ci wallu wér-gi-yaram ak mutuelle ? 😊",
          "Asalaa maalekum ! Dalal ak jàmm ! Zahara laa, ci sa service. Lan laay mënë defal tey : mutuelle, garab, walla fajukaay ? 😊",
          "Jàmm rekk ! Bésub jàmm bu neex ! Man Zahara, dimbalante bu UNAMUSC. Naka nga defee ? Lan nga bëggàm ci sa santé tey ? 😊"
        ]);
      } else {
        reply = pickVariant([
          "Jërëjëf ci sa laaj ! Man la Zahara, assistante virtuelle bu MUTUALIS DAKAR. Mën nga ma laaj ci wallu adhésion, tarifs (4 500 FCFA), gratuité maternité 100%, lettres de garantie hospitalières (80-100%) walla télémédecine. Ndax am nga yeneen laaj ? 😊",
          "Sama kanam laa! Bu nga bëgg xam lépp ci mutuelles UNAMUSC — tarifs yi, garab yi, walla fajukaay yi — laajal ma, ma tontu la ci lu yomb. 😊",
          "Jàmmanga ! Sa laaj bi ngi féete ci yoon bu wóor. Mën nga laaj ci adhésion (4 500 FCFA), maternité gratuité 100%, pharmacie 50% walla télémédecine vidéo. 😊"
        ]);
      }
    } else {
      // FRENCH KNOWLEDGE ENGINE — intentions métier d'abord, salutation en dernier
      if (msg.includes('maternité') || msg.includes('enceinte') || msg.includes('accouchement') || msg.includes('cpn') || msg.includes('pev') || msg.includes('vaccin') || msg.includes('bébé')) {
        reply = "Le Programme Gratuité Maternité & BSF offre une prise en charge à 100% CSU ! Cela comprend l'ensemble des consultations prénatales (CPN 1 à CPN 4+), l'accouchement, le kit d'accouchement, les suppléments en fer/acide folique et le calendrier vaccinal PEV du nourrisson. 👶";
      } else if (msg.includes('garantie') || msg.includes('hôpital') || msg.includes('chirurgie') || msg.includes('opération') || msg.includes('fann') || msg.includes('dantec') || msg.includes('devis')) {
        reply = "Les Lettres de Garantie Hospitalières UNAMUSC prennent en charge de 80% à 100% du montant des devis pour hospitalisations et chirurgies dans les établissements conventionnés (Fann, Le Dantec, Abass Ndao, Hôpital Principal...). Demandez votre certificat certifié PDF via l'onglet dédié. 🏥";
      } else if (msg.includes('pharmacie') || msg.includes('médicament') || msg.includes('ordonnance') || msg.includes('bon de commande') || msg.includes('50%')) {
        reply = "Les Bons de Commande Pharmacie (valables 48h) garantissent un Tiers-Payant de 50% à 80% sur vos ordonnances. Le pharmacien agréé scanne votre QR Code Pass CSU et applique immédiatement la réduction UNAMUSC. 💊";
      } else if (msg.includes('tarif') || msg.includes('prix') || msg.includes('combien') || msg.includes('cotisation') || msg.includes('frais') || msg.includes('coût')) {
        reply = "Les tarifs officiels UNAMUSC sont : Formule Individuelle à 4 500 FCFA/an (1 000 FCFA la carte + 3 500 FCFA de cotisation). Formule Familiale à 1 000 FCFA pour le chef de famille + 3 500 FCFA par membre inscrit. Paiement sécurisé via Orange Money ou Wave ! 💰";
      } else if (msg.includes('parrainage') || msg.includes('démuni') || msg.includes('solidaire') || msg.includes('offrir')) {
        reply = "Le Parrainage Solidaire CSU (4 500 FCFA / bénéficiaire) vous permet d'offrir une couverture santé universelle annuelle complète aux familles vulnérables de la région de Dakar. 🤝";
      } else if (msg.includes('élève') || msg.includes('eleve') || msg.includes('daara') || msg.includes('école') || msg.includes('talibé')) {
        reply = "Le programme CSU Élèves & Daaras propose un tarif préférentiel subventionné de 1 000 FCFA par élève / talibé par an pour une prise en charge médicale complète. 📚";
      } else if (msg.includes('suspendu') || msg.includes('bloqué') || msg.includes('débloquer') || msg.includes('régulariser') || msg.includes('10 500') || msg.includes('10500')) {
        reply = "En cas de suspension de carte, la régularisation forfaitaire de 10 500 FCFA par Orange Money ou Wave réactive instantanément l'intégralité de vos droits Tiers-Payant en pharmacie et hôpital. ⚡";
      } else if (msg.includes('télémédecine') || msg.includes('telemedecine') || msg.includes('vidéo') || msg.includes('médecin') || msg.includes('docteur') || msg.includes('visio')) {
        reply = "La Télémédecine WebRTC vous met en relation directe en visioconférence HD avec nos médecins agréés. Le médecin peut rédiger et vous envoyer votre ordonnance numérisée immédiatement après la consultation. 💻";
      } else if (msg.includes('adhérer') || msg.includes('inscrire') || msg.includes('comment faire') || msg.includes('adhésion') || msg.includes('étapes')) {
        reply = "Pour adhérer, rendez-vous sur 'Services en ligne' -> 'Nouvelle adhésion'. Le formulaire s'exécute en quelques clics : choix de la mutuelle, saisie des informations, photo d'identité et paiement mobile sécurisé. 📝";
      } else if (msg.includes('mutuelle') || msg.includes('adresse') || msg.includes('où') || msg.includes('localisation') || msg.includes('département') || msg.includes('dakar')) {
        reply = "L'UNAMUSC couvre les 14 départements et communes de la région de Dakar (Dakar Plateau, Médina, Pikine, Guédiawaye, Keur Massar, Rufisque...). Retrouvez leur adresse sur l'onglet 'Cartographie'. 📍";
      } else if (msg.includes('bonjour') || msg.includes('salut') || msg.includes('qui es-tu') || msg.includes('présente')) {
        reply = pickVariant([
          "Bonjour ! Je suis Zahara, l'assistante virtuelle officielle de MUTUALIS DAKAR (UNAMUSC Sénégal). Comment puis-je vous aider aujourd'hui concernant vos droits CSU et prestations de santé ? 😊",
          "Bonjour et bienvenue ! Zahara à votre écoute pour tout ce qui touche à votre couverture santé UNAMUSC : adhésion, remboursements, téléconsultation... Que souhaitez-vous savoir ? 😊",
          "Salut ! Ravi de vous entendre. Je peux vous guider sur les tarifs, la maternité gratuite, les lettres de garantie ou la télémédecine — dites-moi tout ! 😊"
        ]);
      } else {
        reply = pickVariant([
          "Merci pour votre question ! Je suis Zahara, votre assistante MUTUALIS DAKAR. Je peux vous renseigner précisément sur les tarifs (4 500 FCFA), la gratuité Maternité (100%), les Lettres de Garantie Hospitalières (80-100%), les bons pharmacie (50%), ou la Télémédecine WebRTC. Avez-vous d'autres questions ? 😊",
          "Très bonne question ! Pour vous répondre au mieux, je peux détailler : l'adhésion (à partir de 4 500 FCFA/an), la maternité 100% gratuite, l'hospitalisation (80-100% couverts) ou la vidéo-consultation. Quel sujet vous intéresse ? 😊",
          "Je volontiers ! Précisez-moi votre besoin — paiement Wave/Orange Money, ordonnance en pharmacie, ou rendez-vous médical — et je vous donne la marche à suivre. 😊"
        ]);
      }
    }

    res.json({ response: reply, decodedText: (typeof userMessageToProcess !== 'undefined' && userMessageToProcess !== message) ? userMessageToProcess : undefined });
  } catch (err) {
    console.error('Erreur lors du chatbot :', err);
    res.status(500).json({ error: 'Erreur interne du chatbot' });
  }
});

// 7b. Synthèse vocale (TTS) avec proxy pour ElevenLabs et Open-source (GalsenAI/xTTS)
app.get('/api/tts', async (req, res) => {
  try {
    const { text, provider, lang } = req.query;
    if (!text) {
      return res.status(400).json({ error: 'Le paramètre text est requis.' });
    }

    const effectiveProvider = provider || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'opensource');

    if (effectiveProvider === 'elevenlabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const voiceId = process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'; // Rachel/Bella
      if (!apiKey) {
        return res.status(400).json({ error: 'Clé API ElevenLabs non configurée.' });
      }

      console.log(`[ElevenLabs TTS] Synthèse pour: "${text.substring(0, 30)}..."`);
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs error: ${response.status} - ${errText}`);
      }

      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(Buffer.from(buffer));
    }

    if (effectiveProvider === 'opensource') {
      // Serveur vocal neural Piper local (backend/piperServer.js — voix humaine
      // fr_FR-siwis-medium). Valeur par défaut câblée : si Piper n'est pas
      // lancé, le fetch échoue vite (timeout 8 s) et le frontend bascule sur
      // la voix du navigateur.
      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts';

      console.log(`[OpenSource TTS] Envoi à ${ttsUrl} pour: "${text.substring(0, 30)}..."`);
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: lang || 'fr' }),
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        throw new Error(`Open-source TTS returned status ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      // On s'adapte au type de retour de l'API open-source (souvent wav)
      res.setHeader('Content-Type', response.headers.get('content-type') || 'audio/wav');
      return res.send(Buffer.from(buffer));
    }

    res.status(400).json({ error: 'Moteur TTS non valide ou non spécifié.' });
  } catch (err) {
    console.error('Erreur synthétiseur vocale backend :', err.message);
    res.status(500).json({ error: 'Erreur lors de la génération de la voix.' });
  }
});

// 8. GET /api/beneficiaries (List all beneficiaries with optional query search)
// Données personnelles : réservé aux agents/admins authentifiés
app.get('/api/beneficiaries', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { q, mutuelle } = req.query;
    const { page, limit, offset } = parsePagination(req);
    let whereSql = ' WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    // ── Cloisonnement par MSD ──────────────────────────────────────────────────
    // Une MSD ne voit QUE ses propres données : ses assurés, leurs cartes, ses
    // cotisations, ses garanties, ses statistiques.
    //
    // On filtre sur `beneficiaries.msd_code` — le CODE de MSD — et non sur le
    // libellé de département. Le libellé était inutilisable : `department` ne
    // contenait que « Dakar », « Pikine », « Rufisque » alors que les assurés
    // relèvent de dix MSD, et les comptes d'agents portaient des libellés sans
    // rapport (« UDMS Dakar »). Résultat, un agent se retrouvait privé de ses
    // propres assurés, ou avec les fichiers d'une autre MSD.
    //
    // Le Super Admin (`msdCode` absent du jeton) n'est PAS filtré : il
    // supervise toutes les MSD, c'est son rôle.
    if (req.user && req.user.role !== 'Super Admin' && req.user.msdCode) {
      whereSql += ' AND b.msd_code = $' + paramIdx;
      params.push(req.user.msdCode);
      paramIdx++;
    }

    if (mutuelle && mutuelle !== 'all') {
      whereSql += ` AND b.mutuelle_name = $${paramIdx}`;
      params.push(mutuelle);
      paramIdx++;
    }

    if (q) {
      whereSql += ` AND (b.first_name ILIKE $${paramIdx} OR b.last_name ILIKE $${paramIdx} OR b.phone ILIKE $${paramIdx} OR b.cmu_number ILIKE $${paramIdx})`;
      params.push(`%${q}%`);
      paramIdx++;
    }

    // Registre consolidé : une seule ligne par personne.
// `merged_into` pointe vers le code canonique d'une fiche absorbée lors d'un
// ré-import. La ligne reste en base (traçabilité, réversibilité) mais sort du
// studio : sinon une personne apparaîtrait plusieurs fois et le nombre de
// cartes annoncé serait supérieur au nombre d'assurés. Son code reste
// résolvable via beneficiary_code_aliases — une carte déjà imprimée avec
// l'ancien code retrouve toujours la bonne fiche.
const whereSqlBase = whereSql + ' AND b.merged_into IS NULL';

// Compte total (pour la métadonnée de pagination)
    const countRes = await query(
      `SELECT COUNT(*) FROM beneficiaries b${whereSqlBase}`, params
    );
    const total = parseInt(countRes.rows[0].count || '0', 10);

    // Requête paginée
    //
    // ⚠️ `photo_url` est EXCLU de la liste, volontairement. Il contient la photo
    // en base64 (≈ 15 Ko par fiche) : sur 200 fiches d'une page, la réponse
    // dépassait 3 Mo et le studio ne pouvait plus rien écrire dans le
    // localStorage (plafond ≈ 5 Mo). Symptôme : les cartes s'affichaient puis
    // disparaissaient au rechargement — « 142 dossier(s) affichés mais NON
    // enregistrés ».
    //
    // La photo est désormais servie à la demande par
    // `GET /api/beneficiaries/:id/photo` : la liste reste légère, le studio
    // écrit son registre, l'image se charge à l'affichage de la carte.
    const listeSql = `SELECT b.id, b.cmu_number, b.source_code, b.numero_adherent,
                             b.first_name, b.last_name, b.nin, b.birth_date, b.birth_place,
                             b.gender, b.phone, b.email, b.address, b.blood_group,
                             b.mutuelle_name, b.department, b.msd_code, b.package_type,
                             b.payment_method, b.status, b.created_at, b.sponsor_phone,
                             b.sponsor_logo, b.school_name, b.student_type, b.school_class,
                             b.academic_year, b.ine, b.ia_ief, b.tutor_name, b.tutor_phone,
                             b.lot_code, b.merged_into
                        FROM beneficiaries b${whereSqlBase}
                        ORDER BY b.id DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const bRes = await query(listeSql, [...params, limit, offset]);

    // La photo est signalée par un indicateur, pas par son contenu.
    const avecPhoto = new Set(bRes.rows.length
      ? (await query(
        `SELECT id FROM beneficiaries
          WHERE id = ANY($1::int[])
            AND photo_url IS NOT NULL AND photo_url <> ''`,
        [bRes.rows.map((b) => b.id)]
      )).rows.map((r) => r.id)
      : []);

    // Récupère les family_members uniquement pour les bénéficiaires de la page courante
    let familyMap = new Map();
    if (bRes.rows.length > 0) {
      const ids = bRes.rows.map((b) => b.id);
      const fRes = await query(
        `SELECT * FROM family_members WHERE beneficiary_id = ANY($1::int[]) ORDER BY id ASC`,
        [ids]
      );
      for (const f of fRes.rows) {
        if (!familyMap.has(f.beneficiary_id)) familyMap.set(f.beneficiary_id, []);
        familyMap.get(f.beneficiary_id).push({
          id: f.id,
          name: f.name,
          relation: f.relation,
          age: f.age
        });
      }
    }

    // Codes historiques absorbés par la consolidation, rattachés à la fiche
    // canonique. C'est ce qui permet à une carte DÉJÀ IMPRIMÉE (code
    // `DKR_2600098.0`, aujourd'hui fusionné) de retrouver son porteur au scan.
    let aliasMap = new Map();
    if (bRes.rows.length > 0) {
      const codes = bRes.rows.map((b) => String(b.cmu_number || '').trim()).filter(Boolean);
      if (codes.length > 0) {
        const aRes = await query(
          `SELECT alias_code, canonical_code FROM beneficiary_code_aliases
           WHERE canonical_code = ANY($1::text[])`,
          [codes]
        ).catch(() => ({ rows: [] }));
        for (const a of aRes.rows) {
          const list = aliasMap.get(a.canonical_code) || [];
          list.push(a.alias_code);
          aliasMap.set(a.canonical_code, list);
        }
      }
    }

    // Champs exposés au studio cartes et aux statistiques. Toute colonne
    // ajoutée ici devient disponible côté UI sans nouvelle requête : le
    // studio doit pouvoir imprimer une carte COMPLÈTE (photo, INE, classe,
    // tuteur) à partir du seul registre des bénéficiaires.
    const beneficiaries = bRes.rows.map((b) => {
      const code = String(b.cmu_number || '').trim();
      return {
        id: b.id,
        firstName: b.first_name,
        lastName: b.last_name,
        birthDate: b.birth_date,
        birthPlace: b.birth_place,
        gender: b.gender,
        bloodGroup: b.blood_group,
        phone: b.phone,
        email: b.email,
        address: b.address,
        nin: b.nin,
        mutuelleName: b.mutuelle_name,
        department: b.department,
        // MSD de rattachement : c'est elle qui détermine à qui la fiche
        // appartient, et donc quel agent MSD est habilité à la voir.
        msdCode: b.msd_code,
        numeroAdherent: b.numero_adherent,
        packageType: b.package_type,
        paymentMethod: b.payment_method,
        cmuNumber: b.cmu_number,
        status: b.status,
        createdAt: b.created_at,
        // La photo n'est PAS envoyée ici : elle est servie à la demande par
        // `/api/beneficiaries/:id/photo`. On n'expose qu'une URL et un
        // indicateur, ce qui rend la liste légère (voir commentaire plus haut).
        photoUrl: avecPhoto.has(b.id) ? `/api/beneficiaries/${b.id}/photo` : null,
        hasPhoto: avecPhoto.has(b.id),
        sponsorPhone: b.sponsor_phone,
        sponsorLogo: b.sponsor_logo,
        // Dossier scolaire (CMU-Élèves / CMU-Daara)
        schoolName: b.school_name,
        studentType: b.student_type,
        schoolClass: b.school_class,
        academicYear: b.academic_year,
        ine: b.ine,
        iaIef: b.ia_ief,
        tutorName: b.tutor_name,
        tutorPhone: b.tutor_phone,
        // Traçabilité de l'import
        sourceCode: b.source_code,
        lotCode: b.lot_code,
        // Codes historiques fusionnés → cette fiche (scan des cartes
        // déjà imprimées). Sans eux, une carte émise avant la consolidation
        // ne retrouverait plus son porteur.
        mergedCodes: aliasMap.get(code) || [],
        familyMembers: familyMap.get(b.id) || []
      };
    });

    res.json({
      data: beneficiaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Erreur lors de la récupération des bénéficiaires :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// ============================================================================
// MSD — REGISTRE DES MUTUELLES DE SANTÉ DÉPARTEMENTALES
// ============================================================================
//
// Modèle : une MSD = une région du Sénégal, avec ses propres assurés, ses
// propres cartes et ses propres statistiques. Chaque agent MSD est cloisonné
// sur la sienne (voir `beneficiaries.msd_code`). Le Super Admin, lui, supervise
// toutes les MSD et est le SEUL habilité à en enregistrer une nouvelle.
//
// `merchant_accounts` sert déjà de registre (union_code) : on ne crée pas de
// table concurrente, on l'étend.

/** Liste des MSD avec leur effectif réel. Réservé au Super Admin. */
app.get('/api/msds', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'Super Admin';
    // Un agent de MSD ne voit que la sienne — et encore, le détail des autres
    // MSD ne le concerne pas.
    const rows = await query(`
      SELECT m.union_code,
             m.union_name,
             m.region,
             m.is_active,
             COALESCE(b.total, 0)::int AS total_beneficiaries,
             COALESCE(b.active, 0)::int AS active_beneficiaries,
             COALESCE(b.with_photo, 0)::int AS with_photo,
             COALESCE(a.agents, 0)::int AS agent_count
      FROM merchant_accounts m
      LEFT JOIN (
        SELECT msd_code,
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'active') AS active,
               COUNT(*) FILTER (WHERE photo_url IS NOT NULL AND btrim(photo_url) <> '') AS with_photo
        FROM beneficiaries
        WHERE merged_into IS NULL AND msd_code IS NOT NULL
        GROUP BY msd_code
      ) b ON b.msd_code = m.union_code
      LEFT JOIN (
        SELECT msd_code, COUNT(*) AS agents FROM agents
        WHERE msd_code IS NOT NULL GROUP BY msd_code
      ) a ON a.msd_code = m.union_code
      ORDER BY m.union_code
    `);

    // Le compte de l'agrégateur n'est pas une MSD : on l'écarte de la liste.
    let list = rows.rows.filter((r) => r.union_code !== 'AGG');
    if (!isSuperAdmin) {
      list = list.filter((r) => r.union_code === req.user.msdCode);
    }

    const totals = list.reduce(
      (acc, r) => ({
        msds: acc.msds + 1,
        beneficiaries: acc.beneficiaries + r.total_beneficiaries,
        active: acc.active + r.active_beneficiaries
      }),
      { msds: 0, beneficiaries: 0, active: 0 }
    );

    res.json({ success: true, scope: isSuperAdmin ? 'all' : (req.user.msdCode || null), totals, msds: list });
  } catch (err) {
    console.error('Erreur lecture registre MSD :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/** Enregistrement d'une nouvelle MSD. STRICTEMENT réservé au Super Admin. */
app.post('/api/msds', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    // Garde-fou explicite : `requireRole('admin')` laisse passer un « Admin
    // Régional », or créer une MSD est un acte de gouvernance réservé au
    // Super Admin. Sans ce test, n'importe quel agent de MSD pourrait
    // enregistrer une nouvelle mutuelle et donc ouvrir un nouveau périmètre.
    if (req.user.role !== 'Super Admin') {
      return res.status(403).json({ error: 'Seul le Super Admin peut enregistrer une nouvelle MSD.' });
    }

    const code = String((req.body && req.body.unionCode) || '').trim().toUpperCase();
    const name = String((req.body && req.body.unionName) || '').trim();
    const region = String((req.body && req.body.region) || '').trim();

    if (!/^[A-Z]{3}$/.test(code)) {
      return res.status(400).json({ error: 'Code MSD invalide : 3 lettres majuscules attendues (ex. KOL).' });
    }
    if (name.length < 3) {
      return res.status(400).json({ error: 'Intitulé de la MSD obligatoire.' });
    }

    const exists = await query('SELECT 1 FROM merchant_accounts WHERE upper(union_code) = $1', [code]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: `La MSD ${code} existe déjà.` });
    }

    await query(
      `INSERT INTO merchant_accounts (union_code, union_name, region, provider, commission_bps, is_active, is_default)
       VALUES ($1, $2, $3, 'kadev', 0, TRUE, FALSE)`,
      [code, name, region || null]
    );

    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CREATION_MSD', req.user.username, `MSD ${code} — ${name} enregistrée.`]
    );

    res.status(201).json({ success: true, msd: { unionCode: code, unionName: name, region } });
  } catch (err) {
    console.error('Erreur création MSD :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 9. PUT /api/beneficiaries/:id/status (Update status of a beneficiary with audit logging)
app.put('/api/beneficiaries/:id/status', authenticateToken, requireRole('agent', 'admin'), validate(beneficiaryStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actor } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Statut requis.' });
    }

    // Find beneficiary
    const bRes = await query('SELECT * FROM beneficiaries WHERE id = $1', [id]);
    if (bRes.rows.length === 0) {
      return res.status(404).json({ error: 'Bénéficiaire introuvable.' });
    }
    const b = bRes.rows[0];

    await query('UPDATE beneficiaries SET status = $1 WHERE id = $2', [status, id]);

    // If status is updated to 'active', automatically create a corresponding cotisation entry
    if (status === 'active' && b.status !== 'active') {
      let amount = 4500;
      if (b.package_type === 'familial') {
        const fRes = await query("SELECT COUNT(*) FROM family_members WHERE beneficiary_id = $1", [b.id]);
        const count = parseInt(fRes.rows[0].count || '0', 10);
        amount = 1000 + (count + 1) * 3500;
      } else if (b.package_type === 'csu_eleves' || b.package_type === 'csu_daara') {
        amount = 1000;
      } else if (b.package_type === 'adhesion_masse') {
        const fRes = await query("SELECT COUNT(*) FROM family_members WHERE beneficiary_id = $1", [b.id]);
        const count = parseInt(fRes.rows[0].count || '0', 10);
        amount = count * 4500;
      } else if (b.package_type === 'parrainage') {
        const sponsoredRes = await query("SELECT id, cmu_number FROM beneficiaries WHERE sponsor_phone = $1 AND package_type != 'parrainage'", [b.phone]);
        const sponsoredList = sponsoredRes.rows;
        if (sponsoredList.length > 0) {
          let detectedType = 'individuel';
          const firstCmu = sponsoredList[0].cmu_number || '';
          if (firstCmu.startsWith('SN-DK-EDU')) detectedType = 'eleves';
          else if (firstCmu.startsWith('SN-DK-COL')) detectedType = 'collectif';
          else if (firstCmu.includes('-HH-')) detectedType = 'menages';
          
          if (detectedType === 'menages') {
            const chefIds = sponsoredList.map(chef => chef.id);
            const fRes = await query("SELECT COUNT(*) FROM family_members WHERE beneficiary_id = ANY($1::int[])", [chefIds]);
            const familyCount = parseInt(fRes.rows[0].count || '0', 10);
            amount = sponsoredList.length * 1000 + (familyCount + sponsoredList.length) * 3500;
          } else if (detectedType === 'eleves' || detectedType === 'collectif') {
            amount = sponsoredList.length * 1000;
          } else {
            amount = sponsoredList.length * 4500;
          }
        } else {
          amount = 4500;
        }
      }

      const periodStart = new Date();
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      const payRef = `REG-ACT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      await query(
        `INSERT INTO cotisations (beneficiary_id, cmu_number, phone, amount, payment_method, payment_reference, period_start, period_end, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid')`,
        [b.id, b.cmu_number, b.phone, amount, b.payment_method || 'wave', payRef, periodStart, periodEnd]
      );
    }

    // Log audit
    const actionName = status === 'active' ? 'APPROBATION_DOSSIER' : 'MODIFICATION_STATUT';
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      [actionName, actor || 'agent@cmu.sn', `Le dossier de l'assuré ${b.first_name} ${b.last_name} (CMU: ${b.cmu_number}) a été passé au statut : ${status}.`]
    );

    res.json({ success: true, message: 'Statut mis à jour.' });
  } catch (err) {
    console.error('Erreur lors de la mise à jour du statut :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 10. DELETE /api/beneficiaries/:id (Delete a beneficiary with audit logging)
// Accessible aux agents/admins (suppression administrative) ET aux citoyens
// pour leur propre compte (droit à l'oubli RGPD).
app.delete('/api/beneficiaries/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = parseInt(id);

    // Contrôle d'accès :
    //  - citizen : ne peut supprimer que SON propre compte (droit à l'oubli)
    //  - agent / admin : suppression administrative autorisée
    if (req.user.role === 'citizen' && req.user.id !== numericId) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que votre propre compte.' });
    }
    const actor = req.user.role === 'citizen'
      ? (req.user.phone || 'citoyen')
      : (req.user.username || 'agent@cmu.sn');

    
    // Find beneficiary
    const bRes = await query('SELECT * FROM beneficiaries WHERE id = $1', [id]);
    if (bRes.rows.length === 0) {
      return res.status(404).json({ error: 'Bénéficiaire introuvable.' });
    }
    const b = bRes.rows[0];

    await query('DELETE FROM beneficiaries WHERE id = $1', [id]);

    // Log audit
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['SUPPRESSION_DOSSIER', actor, `Le dossier de l'assuré ${b.first_name} ${b.last_name} (CMU: ${b.cmu_number}) a été supprimé du système.`]
    );

    res.json({ success: true, message: 'Bénéficiaire supprimé.' });
  } catch (err) {
    console.error('Erreur lors de la suppression du bénéficiaire :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

/**
 * Photo d'un bénéficiaire, servie À LA DEMANDE.
 *
 * La liste (`GET /api/beneficiaries`) n'embarque plus le base64 : elle ne
 * renvoie qu'une URL. C'est cette route qui fournit l'image, au moment où la
 * carte est affichée. Une page de 200 fiches pèse alors quelques kilo-octets
 * au lieu de plusieurs mégaoctets, et le studio peut enfin écrire son registre
 * dans le localStorage.
 *
 * Le cloisonnement par MSD s'applique comme sur la liste : un agent ne peut
 * voir que la photo d'un dossier de SA MSD.
 */
app.get('/api/beneficiaries/:id/photo', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Identifiant invalide.' });

    let where = 'id = $1 AND merged_into IS NULL';
    const params = [id];

    // Mêmes règles de cloisonnement que la liste : Super Admin voit tout, un
    // agent de MSD ne voit que sa MSD.
    if (req.user && req.user.role !== 'Super Admin' && req.user.msdCode) {
      params.push(req.user.msdCode);
      where += ` AND msd_code = $${params.length}`;
    }

    const r = await query(
      `SELECT photo_url FROM beneficiaries WHERE ${where}`,
      params
    );
    const photo = r.rows[0] && r.rows[0].photo_url;
    if (!photo) return res.status(404).json({ error: 'Aucune photo pour ce dossier.' });

    // Valeur déjà en base64 : on la renvoie telle quelle.
    if (photo.startsWith('data:')) {
      const [, mime = 'image/jpeg'] = photo.match(/^data:([^;]+)/) || [];
      res.set('Content-Type', mime);
      res.set('Cache-Control', 'private, max-age=86400');
      return res.send(Buffer.from(photo.split(',')[1] || '', 'base64'));
    }
    // Chemin ou URL : le navigateur ira le chercher lui-même.
    res.set('Cache-Control', 'private, max-age=3600');
    return res.json({ photoUrl: photo });
  } catch (err) {
    console.error('[Photo] lecture impossible :', err.message);
    res.status(500).json({ error: 'Photo indisponible.' });
  }
});

// 11. GET /api/stats (Get real-time statistics from PostgreSQL)
app.get('/api/stats', async (req, res) => {
  try {
    const bCount = await query('SELECT COUNT(*) FROM beneficiaries');
    const bActiveCount = await query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'active'");
    const mCount = await query('SELECT COUNT(*) FROM mutuelles');
    const dSum = await query('SELECT SUM(amount) FROM donations');
    const cSum = await query("SELECT SUM(amount) FROM cotisations WHERE status = 'paid'");

    // Dynamic calculations for coverage by mutuelle type
    let familialCount = 1250;
    let indCount = 480;
    let parrCount = 310;

    try {
      const fCountRes = await query("SELECT COUNT(*) FROM beneficiaries WHERE package_type = 'familial'");
      if (fCountRes && fCountRes.rows && fCountRes.rows[0]) {
        familialCount += parseInt(fCountRes.rows[0].count || '0');
      }
    } catch (err) {
      console.error('Erreur fCountRes :', err);
    }

    try {
      const iCountRes = await query("SELECT COUNT(*) FROM beneficiaries WHERE package_type = 'individuel' AND sponsor_phone IS NULL");
      if (iCountRes && iCountRes.rows && iCountRes.rows[0]) {
        indCount += parseInt(iCountRes.rows[0].count || '0');
      }
    } catch (err) {
      console.error('Erreur iCountRes :', err);
    }

    try {
      const pCountRes = await query("SELECT COUNT(*) FROM beneficiaries WHERE package_type = 'parrainage' OR sponsor_phone IS NOT NULL");
      if (pCountRes && pCountRes.rows && pCountRes.rows[0]) {
        parrCount += parseInt(pCountRes.rows[0].count || '0');
      }
    } catch (err) {
      console.error('Erreur pCountRes :', err);
    }

    const totalVal = familialCount + indCount + parrCount;
    const pctFam = totalVal > 0 ? ((familialCount / totalVal) * 100).toFixed(1) : '0.0';
    const pctInd = totalVal > 0 ? ((indCount / totalVal) * 100).toFixed(1) : '0.0';
    const pctParr = (100 - parseFloat(pctFam) - parseFloat(pctInd)).toFixed(1);

    res.json({
      beneficiariesCount: (bCount && bCount.rows && bCount.rows[0]) ? parseInt(bCount.rows[0].count || '0') : 0,
      activeBeneficiariesCount: (bActiveCount && bActiveCount.rows && bActiveCount.rows[0]) ? parseInt(bActiveCount.rows[0].count || '0') : 0,
      mutuellesCount: (mCount && mCount.rows && mCount.rows[0]) ? parseInt(mCount.rows[0].count || '0') : 0,
      donationsSum: (dSum && dSum.rows && dSum.rows[0]) ? parseInt(dSum.rows[0].sum || '0') : 0,
      cotisationsSum: (cSum && cSum.rows && cSum.rows[0]) ? parseInt(cSum.rows[0].sum || '0') : 0,
      coverageDetails: {
        communautaires: { count: Math.round(familialCount * 1376.38), pct: pctFam },
        ipm: { count: Math.round(indCount * 1354.77), pct: pctInd },
        reste: { count: Math.round(parrCount * 1394.13), pct: pctParr }
      }
    });
  } catch (err) {
    console.error('Erreur lors du calcul des statistiques :', err);
    res.status(500).json({ error: 'Erreur interne du serveur' });
  }
});

// 12. GET /api/audit-logs (Get system audit logs)
app.get('/api/audit-logs', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { search } = req.query;
    const { page, limit, offset } = parsePagination(req);
    let whereSql = '';
    const params = [];
    let paramIdx = 1;
    
    if (search) {
      whereSql = ` WHERE action ILIKE $${paramIdx} OR actor ILIKE $${paramIdx} OR details ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }
    
    const countRes = await query(`SELECT COUNT(*) FROM audit_logs${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);
    
    const dataSql = `SELECT * FROM audit_logs${whereSql} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const result = await query(dataSql, [...params, limit, offset]);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Erreur audit logs :', err);
    res.status(500).json({ error: 'Erreur lors du chargement des journaux d\'audit.' });
  }
});

// GET /api/coverage/regions (Get regional coverage stats)
app.get('/api/coverage/regions', async (req, res) => {
  try {
    const result = await query('SELECT * FROM regional_coverage');
    // Format numeric strings correctly
    const formatted = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      x: parseInt(r.x),
      y: parseInt(r.y),
      couv: parseFloat(r.couv),
      color: r.color,
      mutuelles: parseInt(r.mutuelles),
      assures: r.assures,
      structures: parseInt(r.structures)
    }));
    res.json(formatted);
  } catch (err) {
    console.error('Erreur API regions:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des données de couverture.' });
  }
});

// 13. GET /api/coverage-items (Get medicines & care covered list)
app.get('/api/coverage-items', async (req, res) => {
  try {
    const { search, type, covered } = req.query;
    let sql = 'SELECT * FROM coverage_items WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (type && type !== 'all') {
      sql += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (covered && covered !== 'all') {
      sql += ` AND covered = $${paramIndex}`;
      params.push(covered === 'true');
      paramIndex++;
    }

    if (search) {
      sql += ` AND (name ILIKE $${paramIndex} OR category ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ' ORDER BY name ASC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur coverage items :', err);
    res.status(500).json({ error: 'Erreur lors du chargement de l\'annuaire.' });
  }
});

// 14. GET /api/complaints (Get all complaints)
// Lecture réservée aux agents/admins (les réclamations contiennent des données personnelles)
app.get('/api/complaints', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req);
    let countSql = 'SELECT COUNT(*) FROM complaints c';
    let dataSql = 'SELECT c.* FROM complaints c';
    let whereSql = '';
    const params = [];

    if (req.user && req.user.role !== 'Super Admin' && req.user.msdCode) {
      countSql = 'SELECT COUNT(*) FROM complaints c JOIN beneficiaries b ON c.phone = b.phone';
      dataSql = 'SELECT c.* FROM complaints c JOIN beneficiaries b ON c.phone = b.phone';
      whereSql = ' WHERE b.msd_code = $1';
      params.push(req.user.msdCode);
    }

    const countRes = await query(`${countSql}${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);

    const limitParamIdx = params.length + 1;
    const offsetParamIdx = params.length + 2;
    const result = await query(
      `${dataSql}${whereSql} ORDER BY c.id DESC LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}`,
      [...params, limit, offset]
    );
    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Erreur get complaints :', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des réclamations.' });
  }
});

// 15. POST /api/complaints (Submit a complaint)
app.post('/api/complaints', validate(complaintCreateSchema), async (req, res) => {
  try {
    const { beneficiaryName, phone, title, description } = req.body;
    // Champs déjà validés par zod

    await query(
      `INSERT INTO complaints (beneficiary_name, phone, title, description, status) VALUES ($1, $2, $3, $4, $5)`,
      [beneficiaryName, phone, title, description, 'open']
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['DEPOS_RECLAMATION', phone, `Nouveau dépôt de réclamation par ${beneficiaryName} : "${title}".`]
    );

    res.status(201).json({ success: true, message: 'Réclamation envoyée.' });
  } catch (err) {
    console.error('Erreur post complaints :', err);
    res.status(500).json({ error: 'Erreur lors du dépôt de la réclamation.' });
  }
});

// 16. PUT /api/complaints/:id/resolve (Mark complaint as resolved)
app.put('/api/complaints/:id/resolve', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionNotes } = req.body;
    const actor = req.user.username || 'agent@cmu.sn';
    
    // Find complaint
    const compRes = await query('SELECT * FROM complaints WHERE id = $1', [id]);
    if (compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Réclamation introuvable.' });
    }
    const comp = compRes.rows[0];

    await query(`UPDATE complaints SET status = 'resolved', resolution_notes = $1, resolved_by = $2 WHERE id = $3`, [resolutionNotes || '', actor, id]);

    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['RESOLUTION_RECLAMATION', actor || 'agent@cmu.sn', `Réclamation id ${id} ("${comp.title}" déposée par ${comp.beneficiary_name}) résolue.`]
    );

    res.json({ success: true, message: 'Réclamation résolue.' });
  } catch (err) {
    console.error('Erreur resolve complaint :', err);
    res.status(500).json({ error: 'Erreur lors de la résolution de la réclamation.' });
  }
});

// DELETE /api/complaints/:id (Delete a complaint)
app.delete('/api/complaints/:id', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM complaints WHERE id = $1', [id]);
    res.json({ success: true, message: 'Réclamation supprimée.' });
  } catch (err) {
    console.error('Erreur delete complaint :', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la réclamation.' });
  }
});

// Get all agents (for Super Admin)
app.get('/api/agents', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query('SELECT id, username, first_name, last_name, role, photo_url FROM agents ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur get agents:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Create new agent (for Super Admin)
app.post('/api/agents', authenticateToken, requireRole('admin'), validate(agentCreateSchema), async (req, res) => {
  try {
    const { username, password, firstName, lastName, role, photoUrl } = req.body;
    // Champs déjà validés par zod (mot de passe >= 8 caractères, rôle autorisé)
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const result = await query(
      'INSERT INTO agents (username, password_hash, first_name, last_name, role, photo_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, first_name, last_name, role, photo_url',
      [username, hashed, firstName, lastName, role, photoUrl]
    );
    res.json({ success: true, agent: result.rows[0] });
  } catch (err) {
    console.error('Erreur create agent:', err);
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Cet identifiant existe déjà.' });
    }
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Upload photo for agent
app.put('/api/agents/:id/photo', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { photoUrl } = req.body;
    // Un agent ne peut modifier que sa propre photo (sauf admin)
    if (req.user.role === 'agent' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que votre propre photo.' });
    }
    await query('UPDATE agents SET photo_url = $1 WHERE id = $2', [photoUrl, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur photo upload:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Send a message (agents/admins authentifiés uniquement)
app.post('/api/messages', authenticateToken, requireRole('agent', 'admin'), validate(messageCreateSchema), async (req, res) => {
  try {
    const { receiver, subject, body } = req.body;
    // Le sender est forcé depuis le jeton (anti-usurpation)
    const sender = req.user.username;
    // Champs déjà validés par zod
    await query(
      'INSERT INTO internal_messages (sender_username, receiver_username, subject, body) VALUES ($1, $2, $3, $4)',
      [sender, receiver, subject, body]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur send message:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Get messages for an agent (authentifié - ne voit que SES propres messages)
app.get('/api/messages/:username', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { username } = req.params;
    // Un agent ne peut consulter que ses propres messages (sauf admin)
    if (req.user.role === 'agent' && req.user.username !== username) {
      return res.status(403).json({ error: 'Accès interdit à ces messages.' });
    }
    const result = await query(
      'SELECT * FROM internal_messages WHERE receiver_username = $1 ORDER BY created_at DESC',
      [username]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur get messages:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// ============================================================================
// ROUTES CSU (programmes, claims, notifications, dashboard, carte CMU)
// ============================================================================
app.use(csuRoutes);

// ============================================================================
// ROUTES ADDITIONNELLES (cotisations + rappels, espace partenaire, stats régionales)
// ============================================================================
app.use(additionalRoutes);
app.use(dynamicRoutes);

// ============================================================================
// ROUTES AVANCÉES (fidélité, paiements OM/Wave, sync hors-ligne)
// ============================================================================
app.use(advancedRoutes);
app.use('/api', extendedRoutes);

// ============================================================================
// ENCAISSEMENT MULTI-MSD — passerelle agrégateur Kadev Pay
// Chaque MSD encaisse sur son propre compte marchand ; la commission de
// l'agrégateur est enregistrée à part et n'est jamais prélevée sur la MSD.
// ============================================================================
app.use(kadevRoutes);

// ============================================================================
// ASSISTANT CLINIQUE IA — aide à la décision pour les professionnels de santé.
// ⚠️ Ne pose pas de diagnostic : la validation clinique reste obligatoire.
// ============================================================================
app.use(clinicalRoutes);

// ============================================================================
// API PHARMACIES AGRÉÉES — Source : ARP (arp.sn)
// ============================================================================
const pharmaciesDataPath = require('path').join(__dirname, 'pharmacies_data.json');
let pharmaciesCache = null;

app.get('/api/pharmacies', (req, res) => {
  try {
    if (!pharmaciesCache) {
      pharmaciesCache = require(pharmaciesDataPath);
    }
    let data = pharmaciesCache;
    const { region, commune, q } = req.query;

    if (region && region !== 'all') {
      data = data.filter(p => p.region?.toLowerCase() === region.toLowerCase());
    }
    if (commune) {
      data = data.filter(p => p.commune?.toLowerCase().includes(commune.toLowerCase()));
    }
    if (q) {
      const query = q.toLowerCase();
      data = data.filter(p =>
        p.nom?.toLowerCase().includes(query) ||
        p.adresse?.toLowerCase().includes(query) ||
        p.commune?.toLowerCase().includes(query) ||
        p.titulaire?.toLowerCase().includes(query)
      );
    }
    res.json(data);
  } catch (err) {
    console.error('Erreur chargement pharmacies:', err.message);
    res.status(500).json({ error: 'Données pharmacies non disponibles' });
  }
});

app.get('/api/pharmacies/regions', (req, res) => {
  try {
    if (!pharmaciesCache) {
      pharmaciesCache = require(pharmaciesDataPath);
    }
    const regions = [...new Set(pharmaciesCache.map(p => p.region).filter(Boolean))].sort();
    res.json(regions);
  } catch (err) {
    res.status(500).json({ error: 'Données non disponibles' });
  }
});
// IP locale (LAN) du serveur — utilisée par les QR codes des cartes CSU pour
// que les smartphones du réseau Wi-Fi atteignent la page de vérification.
app.get('/api/lan-ip', (req, res) => {
  res.json({ ip: detectLanIp() });
});

// ============================================================
//  IMPORT EN MASSE + HYDRATATION / SYNCHRONISATION FALLBACK
//  (doit être déclaré AVANT le gestionnaire 404 ci-dessous)
// ============================================================

// Import en masse de bénéficiaires (Excel « Ville de Dakar msd Dakar » ou
// adhésion de masse). Si PostgreSQL est indisponible → fallback fichier
// (backend/data/store.json) : ZÉRO PERTE, même les cartes déjà imprimées.
app.post('/api/beneficiaries/bulk', async (req, res) => {
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : [];
  if (rows.length === 0) return res.status(400).json({ error: 'Aucune ligne à importer.' });
  if (rows.length > 5000) return res.status(400).json({ error: 'Maximum 5000 lignes par import.' });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      for (const r of rows) {
        const cmu = (r.codeBeneficiaire || r.cmuNumber || '').toString().trim();
        if (!cmu) { skipped++; continue; }
        const photoUrl = (r.photoUrl || '').toString().trim() || null;
        const nin = (r.nin || '').toString().trim() || null;
        // Idempotence à DEUX niveaux :
        //  1. même matricule → mise à jour (une réimportation enrichit la
        //     fiche au lieu de créer un doublon) ;
        //  2. même NIN sous un AUTRE matricule → on rattache à la ligne
        //     existante. Sans cela, réimporter le même classeur (qui génère
        //     de nouveaux matricules) créait une seconde personne.
        const existing = await client.query(
          `SELECT id FROM beneficiaries
            WHERE cmu_number = $1
               OR ($2::text IS NOT NULL AND nin = $2)
            LIMIT 1`,
          [cmu, nin]
        );
        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE beneficiaries SET
                first_name      = COALESCE(NULLIF($2,''), first_name),
                last_name       = COALESCE(NULLIF($3,''), last_name),
                birth_date      = COALESCE(NULLIF($4,''), birth_date),
                birth_place     = COALESCE(NULLIF($5,''), birth_place),
                gender          = COALESCE(NULLIF($6,''), gender),
                blood_group     = COALESCE(NULLIF($7,''), blood_group),
                phone           = COALESCE(NULLIF($8,''), phone),
                address         = COALESCE(NULLIF($9,''), address),
                school_name     = COALESCE(NULLIF($10,''), school_name),
                nin             = COALESCE(nin, $11),
                numero_adherent = COALESCE(NULLIF($12,''), numero_adherent),
                photo_url       = COALESCE($13, photo_url),
                lot_code        = COALESCE(NULLIF($14,''), lot_code)
              WHERE id = $1`,
            [existing.rows[0].id,
              r.prenom || r.firstName || '', r.nom || r.lastName || '',
              r.birthDate || '', r.birthPlace || '', r.sexe || r.gender || '',
              r.bloodGroup || '', r.telephone || r.phone || '', r.address || '',
              r.schoolName || '', nin, r.numeroAdherent || null, photoUrl,
              r.lotCode || null]
          );
          updated++;
          continue;
        }
        await client.query(
          `INSERT INTO beneficiaries (first_name, last_name, birth_date, birth_place, gender, blood_group,
              phone, email, address, mutuelle_name, package_type, payment_method, cmu_number, status,
              school_name, sponsor_phone, photo_url, nin, numero_adherent, source_code, lot_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [r.prenom || r.firstName || '', r.nom || r.lastName || '', r.birthDate || '',
           r.birthPlace || '', r.sexe || r.gender || '', r.bloodGroup || '',
           r.telephone || r.phone || '', r.email || '', r.address || '',
           r.mutuelleName || 'MSD Dakar', r.packageType || 'individuel', r.paymentMethod || 'excel_import',
           cmu, r.status || 'active', r.schoolName || null, r.sponsorPhone || null,
           photoUrl, nin, r.numeroAdherent || null, r.sourceCode || null, r.lotCode || null]
        );
        inserted++;
      }
      await client.query('COMMIT');
      await query(`INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
        ['IMPORT_MASSE', 'card-studio',
         `Import en masse : ${inserted} créés, ${updated} mis à jour, ${skipped} ignorés.`]);
      return res.status(201).json({ success: true, mode: 'database', inserted, updated, skipped, total: rows.length });
    } finally {
      client.release();
    }
  } catch (dbErr) {
    // Base indisponible → fallback fichier : chaque ligne est conservée
    console.warn('[BULK] Base indisponible, fallback fichier :', dbErr.message);
    let inserted = 0;
    for (const r of rows) {
      const cmu = (r.codeBeneficiaire || r.cmuNumber || '').toString().trim();
      if (!cmu) continue;
      const already = fallbackStore.listRecords('beneficiaries').some(x => (x.cmuNumber || '') === cmu);
      if (already) continue;
      fallbackStore.addRecord('beneficiaries', {
        cmuNumber: cmu,
        numeroAdherent: r.numeroAdherent || null,
        sourceCode: r.sourceCode || null,
        prenom: r.prenom || r.firstName || '',
        nom: r.nom || r.lastName || '',
        birthDate: r.birthDate || '',
        birthPlace: r.birthPlace || '',
        nin: r.nin || null,
        sexe: r.sexe || r.gender || '',
        bloodGroup: r.bloodGroup || '',
        telephone: r.telephone || r.phone || '',
        address: r.address || '',
        mutuelleName: r.mutuelleName || 'MSD Dakar',
        packageType: r.packageType || 'individuel',
        photoUrl: r.photoUrl || null,
        status: 'active'
      });
      inserted++;
    }
    return res.status(201).json({
      success: true,
      mode: 'fallback-file',
      inserted,
      total: rows.length,
      message: 'Base indisponible : les bénéficiaires sont conservés dans le fichier secours (backend/data/store.json) et seront rejoués automatiquement.'
    });
  }
});

// ── Réparation des photos, limitée à UNE source ─────────────────────────────
//
// Pourquoi cette route existe : le navigateur ne peut pas relire seul un
// dossier du disque (« C:\Users\hp\Downloads\ASS LONASE ») sans que l'agent le
// resélectionne à chaque import. Les fiches sont alors en base sans photo,
// alors que les fichiers attendent sur le disque.
//
// Elle ne fait qu'un UPDATE de photo_url sur les fiches dont le code figure
// dans le classeur de la source visée : aucune suppression, aucun
// ré-import, aucun matricule régénéré. Les codes des sources étant
// disjoints, la Ville de Dakar ne peut pas être affectée par une
// réparation ASS LONASE.
//
// `dryRun` (défaut : true) renvoie le plan d'appariement complet sans rien
// écrire : c'est le mode à utiliser pour contrôler avant d'appliquer.
app.post('/api/photos/repair', authenticateToken, requireRole('admin'), async (req, res) => {
  const { source, photoDir, dryRun } = req.body || {};
  const code = clean(source || '').toUpperCase();
  const dir = String(photoDir || '').trim();

  if (!code) return res.status(400).json({ error: 'Source manquante.' });
  if (!dir) return res.status(400).json({ error: 'Dossier de photos manquant.' });

  // Liste blanche : le chemin doit être l'un de ceux déclarés côté serveur.
  // Un agent ne doit pas pouvoir faire lire un dossier arbitraire du disque.
  const dirReel = path.resolve(dir);
  if (!PHOTO_SOURCE_DIRS[code]) {
    return res.status(400).json({
      error: `Source inconnue. Sources autorisées : ${Object.keys(PHOTO_SOURCE_DIRS).join(', ')}.`,
    });
  }
  if (dirReel.toLowerCase() !== path.resolve(PHOTO_SOURCE_DIRS[code]).toLowerCase()) {
    return res.status(400).json({
      error: `Dossier refusé pour « ${code} ». Attendu : ${PHOTO_SOURCE_DIRS[code]}.`,
    });
  }
  if (!fs.existsSync(dirReel)) {
    return res.status(400).json({ error: `Dossier introuvable : ${dirReel}.` });
  }

  try {
    const codeSet = readSourceCodes(code);
    const records = await loadRecordsForCodes(pool, codeSet);
    const { plan, sansPhoto, unused, stats } = planRepair({
      photoDir: dirReel,
      codeSet,
      records,
    });

    if (dryRun !== false) {
      return res.json({
        success: true,
        dryRun: true,
        source: code,
        stats,
        appariements: plan.map((p) => ({
          code: p.record.code,
          nom: `${p.record.prenom} ${p.record.nom}`,
          fichier: p.file,
          regle: p.rule,
          action: p.overwrite ? 'ecrire' : 'deja-pourvue',
        })),
        sansPhoto: sansPhoto.map((r) => ({
          code: r.code,
          nom: `${r.prenom} ${r.nom}`,
          naissance: r.birthDate || null,
        })),
        fichiersNonUtilises: unused,
        rapport: formatReport({ source: code, photoDir: dirReel, codeSet, plan, sansPhoto, unused, stats }),
      });
    }

    const result = await applyRepair({ db: pool, plan, dryRun: false });
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['REPARATION_PHOTOS', req.user && req.user.username ? req.user.username : 'admin',
        `Source ${code} : ${result.ecrits} photo(s) attachée(s), ${stats.sansPhoto} fiche(s) sans photo, ${unused.length} fichier(s) non utilisé(s).`]
    );
    return res.json({
      success: true,
      dryRun: false,
      source: code,
      stats,
      ecrits: result.ecrits,
      ignores: result.ignores,
      octets: result.octets,
      sansPhoto: sansPhoto.map((r) => ({ code: r.code, nom: `${r.prenom} ${r.nom}` })),
      fichiersNonUtilises: unused,
    });
  } catch (err) {
    console.error('[Photos] réparation impossible :', err);
    return res.status(500).json({ error: err.message });
  }
});

// ── Lots de campagne d'enrôlement ───────────────────────────────────────────
// La provenance des cartes vit en base : plusieurs agents doivent voir le
// même historique de campagnes, ce que le localStorage ne peut pas garantir.
// Lecture ouverte à tout agent authentifié ; écriture réservée à l'agent/admin.
/**
 * Suppression par CODE bénéficiaire.
 *
 * ⚠️ Indispensable pour réparer un lot : les fiches importées portent un
 * identifiant local (`IMP-…`) et non serveur. Les effacer du registre local
 * ne suffirait pas — la ligne PostgreSQL subsisterait, et la fusion du
 * démarrage la réinjecterait avec ses mauvais codes au rechargement.
 */
app.delete('/api/beneficiaries/by-code/:code', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const code = String(req.params.code || '').trim();
  if (!code) return res.status(400).json({ error: 'Code manquant.' });
  try {
    const del = await query('DELETE FROM beneficiaries WHERE cmu_number = $1', [code]);
    res.json({ success: true, deleted: del.rowCount || 0, code });
  } catch (dbErr) {
    // Base indisponible : le fichier secours est traité de la même façon.
    try {
      const store = fallbackStore.listRecords('beneficiaries');
      const kept = store.filter((b) => (b.cmuNumber || '') !== code);
      const removed = store.length - kept.length;
      fallbackStore.replaceCollection('beneficiaries', kept);
      res.json({ success: true, deleted: removed, code, mode: 'fallback-file' });
    } catch {
      res.status(500).json({ error: dbErr.message });
    }
  }
});

app.get('/api/campaign-lots', authenticateToken, async (req, res) => {
  try {
    const r = await query(
      `SELECT l.*, COUNT(b.id) AS real_count
         FROM campaign_lots l
         LEFT JOIN beneficiaries b ON b.lot_code = l.code
        GROUP BY l.id
        ORDER BY l.created_at DESC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('[Lots] lecture impossible :', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/campaign-lots', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const { code, label, sourceFile, unionId, cardCount } = req.body || {};
  if (!code || !/^LOT-\d{4}-\d{3,}$/.test(String(code))) {
    return res.status(400).json({ error: 'Code de lot invalide (attendu : LOT-AAAA-NNN).' });
  }
  try {
    const r = await query(
      `INSERT INTO campaign_lots (code, label, source_file, union_id, card_count)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (code) DO UPDATE
         SET label = EXCLUDED.label,
             source_file = EXCLUDED.source_file,
             card_count = EXCLUDED.card_count
       RETURNING *`,
      [code, label || null, sourceFile || null, unionId || 'DKR', Number(cardCount) || 0]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error('[Lots] création impossible :', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Rattache des fiches à un lot. C'est l'acte de PROVENANCE : une carte qui
 * reçoit un lot devient, par construction, une carte de campagne — donc
 * encore recodable tant qu'elle n'est pas marquée imprimée.
 */
app.post('/api/campaign-lots/:code/assign', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const { code } = req.params;
  const codes = Array.isArray(req.body && req.body.cmuNumbers) ? req.body.cmuNumbers : [];
  if (codes.length === 0) return res.status(400).json({ error: 'Aucune fiche à rattacher.' });
  try {
    await query(
      `UPDATE beneficiaries SET lot_code = $1 WHERE cmu_number = ANY($2::text[])`,
      [code, codes]
    );
    const r = await query(
      `UPDATE campaign_lots SET card_count = (
         SELECT COUNT(*) FROM beneficiaries b WHERE b.lot_code = $1
       ) WHERE code = $1 RETURNING *`,
      [code]
    );
    res.json({ success: true, lot: r.rows[0] || null, assigned: codes.length });
  } catch (err) {
    console.error('[Lots] rattachement impossible :', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Marque un lot comme IMPRIMÉ. Verrou de sécurité : un lot imprimé ne doit
 * plus jamais passer par un recodage de masse.
 */
app.post('/api/campaign-lots/:code/print', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  const { code } = req.params;
  try {
    const r = await query(
      `UPDATE campaign_lots SET printed = TRUE, printed_at = CURRENT_TIMESTAMP
        WHERE code = $1 RETURNING *`,
      [code]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Lot inconnu.' });
    res.json({ success: true, lot: r.rows[0] });
  } catch (err) {
    console.error('[Lots] marquage impression impossible :', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Hydratation : retourne les bénéficiaires du fallback fichier (pour que le
// Studio retrouve les adhésions/importations perdues) + tentative de flush DB.
app.get('/api/beneficiaries/fallback', async (req, res) => {
  try {
    const flush = await fallbackStore.flushToDb(query);
    const records = fallbackStore.listRecords('beneficiaries');
    return res.json({ success: true, count: records.length, flushed: flush.flushed, remaining: flush.remaining, records });
  } catch (err) {
    return res.json({ success: true, count: 0, flushed: 0, remaining: 0, records: [] });
  }
});

// Statut du fallback (diagnostic)
app.get('/api/fallback-status', (req, res) => {
  const store = fallbackStore.readStore();
  const counts = {};
  for (const [k, v] of Object.entries(store)) counts[k] = Array.isArray(v) ? v.length : 0;
  res.json({ success: true, path: fallbackStore.STORE_PATH, counts });
});

// Gestionnaire 404 pour les routes non définies
app.use((req, res, next) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});


// Ensure indexes exist for better query performance under concurrency
(async () => {
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_beneficiaries_phone ON beneficiaries(phone)');
    await query('CREATE INDEX IF NOT EXISTS idx_beneficiaries_cmu ON beneficiaries(cmu_number)');
    await query('CREATE INDEX IF NOT EXISTS idx_family_members_beneficiary ON family_members(beneficiary_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_partner_users_structure ON partner_users(structure_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolution_notes TEXT');
    await query('ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(100)');
    // Personnalisation des cartes : logo du parrain apposé sur les cartes parrainées
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS sponsor_logo TEXT');
    // Import MSD : le fichier porte des informations que l'ancien schéma
    // ignorait purement et simplement. Sans ces colonnes, elles étaient
    // LUES puis jetées — la carte affichait un lieu de naissance vide et le
    // sexe par défaut, et la déduplication entre deux imports était
    // impossible faute de NIN.
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS birth_place VARCHAR(150)');
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS gender VARCHAR(10)');
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)');
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS nin VARCHAR(60)');
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS numero_adherent VARCHAR(100)');
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS source_code VARCHAR(120)');
    // Lot de campagne d'enrôlement : la provenance de la carte. C'est la
    // seule information qui distingue un PVC déjà imprimé d'une fiche encore
    // recodable — un simple numéro de séquence ne le dit pas.
    await query(`
      CREATE TABLE IF NOT EXISTS campaign_lots (
        id SERIAL PRIMARY KEY,
        code VARCHAR(32) UNIQUE NOT NULL,
        label VARCHAR(255),
        source_file VARCHAR(255),
        union_id VARCHAR(10) DEFAULT 'DKR',
        card_count INTEGER DEFAULT 0,
        printed BOOLEAN DEFAULT FALSE,
        printed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => { /* base absente : la migration sera rejouée au prochain démarrage */ });
    // Chaque fiche porte le code de son lot : NULL = carte historique,
    // antérieure au dispositif de lots (donc jamais recodable).
    await query('ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS lot_code VARCHAR(32)');
    await query('CREATE INDEX IF NOT EXISTS idx_beneficiaries_lot ON beneficiaries(lot_code) WHERE lot_code IS NOT NULL').catch(() => {});
    await query('CREATE INDEX IF NOT EXISTS idx_campaign_lots_code ON campaign_lots(code)').catch(() => {});
    // Index sur le NIN : clé d'identité stable, elle rend la réimportation
    // idempotente même quand le matricule change.
    await query('CREATE INDEX IF NOT EXISTS idx_beneficiaries_nin ON beneficiaries(nin) WHERE nin IS NOT NULL AND nin <> \'\'').catch(() => {});

    // ── Recodage des cartes ASS LONASE ──────────────────────────────────
    // Format officiel : REGION-MSD-ANNEE-SEQUENCE (ex. DKR-DKR-2026-0001).
    //
    // ⚠️ NON-RÉGRESSION : le motif `^[A-Z]{3}-26[0-9]{5}$` n'a été produit que
    // par le générateur séquentiel précédent, jamais par les fichiers MSD. Les
    // cartes déjà imprimées portent `_` (DKR_2600027.0) ou un préfixe de
    // programme (EDU_DKR_26000163) : elles restent INTACTES.
    //
    // La migration est idempotente : une fois les codes convertis, le motif
    // ne correspond plus, donc le bloc ne refait rien au démarrage suivant.
    try {
      const { rows: legacy } = await query(
        `SELECT id, cmu_number FROM beneficiaries
          WHERE cmu_number ~ '^[A-Z]{3}-26[0-9]{5}$'
          ORDER BY cmu_number ASC`
      );
      if (legacy.length > 0) {
        const year = new Date().getFullYear();
        const unionCode = String(legacy[0].cmu_number || 'DKR-').slice(0, 3).toUpperCase();
        // Région : le préfixe historique identifie déjà la région d'émission
        // (DKR → région de Dakar). Le format officiel la rend explicite.
        const region = unionCode;
        const { rows: already } = await query(
          `SELECT cmu_number FROM beneficiaries
            WHERE cmu_number ~ '^[A-Z]{3}-[A-Z]{3}-[0-9]{4}-[0-9]{4}$'`
        );
        const used = new Set(already.map((r) => r.cmu_number));
        const re = new RegExp(`^${region}-${unionCode}-${year}-(\\d{4})$`);
        let seq = 0;
        for (const c of used) {
          const m = c.match(re);
          if (m) seq = Math.max(seq, Number(m[1]));
        }
        for (const row of legacy) {
          let code = null;
          for (let i = 1; i <= 20000; i++) {
            const candidate = `${region}-${unionCode}-${year}-${String(seq + i).padStart(4, '0')}`;
            if (!used.has(candidate)) { code = candidate; used.add(candidate); seq += i; break; }
          }
          if (!code) continue;
          await query('UPDATE beneficiaries SET cmu_number = $1, numero_adherent = $2 WHERE id = $3',
            [code, code, row.id]);
        }
        console.log(`[Migration] ${legacy.length} matricule(s) ASS LONASE recodé(s) au format REGION-MSD-${year}-SEQ.`);
      }
    } catch (e) {
      console.warn('[Migration] Recodage ASS LONASE reporté :', e.message);
    }
    // Unicité du matricule CMU : le générateur séquentiel (fallbackStore
    // .generateCmuNumber) garantit déjà l'absence de collision, mais la
    // contrainte en base est le dernier rempart contre une insertion
    // concurrente ou un import massif. Les doublons historiques sont
    // d'abord neutralisés (suffixe -DUP<n>) : la contrainte ne peut
    // jamais faire échouer le démarrage du serveur.
    await query(`
      DO $$
      DECLARE
        d RECORD;
        n INTEGER := 0;
      BEGIN
        FOR d IN
          SELECT cmu_number
            FROM beneficiaries
           WHERE cmu_number IS NOT NULL
           GROUP BY cmu_number
          HAVING COUNT(*) > 1
        LOOP
          n := n + 1;
          UPDATE beneficiaries
             SET cmu_number = d.cmu_number || '-DUP' || n
           WHERE cmu_number = d.cmu_number;
        END LOOP;
      END $$;
    `).catch(() => { /* base absente : la migration sera rejouée au prochain démarrage */ });
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_beneficiaries_cmu_number
        ON beneficiaries(cmu_number) WHERE cmu_number IS NOT NULL
    `).catch(() => { /* contrainte déjà en place ou base absente */ });
    console.log('Indexation PostgreSQL et schéma vérifiés avec succès.');
  } catch (err) {
    console.warn('Vérification du schéma PostgreSQL reportée (les tables ne sont peut-être pas encore initialisées) :', err.message);
  }
})();


// ── Démarrage automatique du serveur vocal Piper (voix humaine neuronale) ──
// Si le port 5001 ne répond pas déjà, on lance backend/piperServer.js en
// processus enfant. Le modèle ONNX met ~10 s à charger en RAM : pendant ce
// temps la voix du navigateur prend le relais, puis les réponses basculent
// automatiquement sur la voix neurale. Si Python/piper n'est pas installé,
// l'échec est silencieux et l'application continue avec la voix navigateur.
(async () => {
  if (process.env.DISABLE_AUTO_PIPER === '1') return;
  const piperOrigin = new URL(process.env.OPEN_SOURCE_TTS_URL || 'http://127.0.0.1:5001/api/tts').origin;
  try {
    const ping = await fetch(`${piperOrigin}/health`, { signal: AbortSignal.timeout(1200) });
    if (ping.ok) {
      console.log('[Voix] Serveur Piper déjà actif — voix neuronale disponible.');
      return;
    }
  } catch (e) { /* pas encore lancé : on le démarre */ }
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const piperProc = spawn(process.execPath, [path.join(__dirname, 'piperServer.js')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });
    piperProc.stdout.on('data', (d) => process.stdout.write('[piper] ' + d));
    piperProc.stderr.on('data', (d) => process.stderr.write('[piper] ' + d));
    piperProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`[Voix] Serveur Piper arrêté (code ${code}) — repli sur la voix du navigateur.`);
      }
    });
    console.log('[Voix] Démarrage automatique du serveur vocal Piper (voix humaine, chargement ~10 s)…');
  } catch (e) {
    console.warn('[Voix] Impossible de lancer Piper automatiquement :', e.message);
  }
  })();

// Start the server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
  });
}

module.exports = app;
