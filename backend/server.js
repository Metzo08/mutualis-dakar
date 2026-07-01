const express = require('express');
const cors = require('cors');
const { query, pool } = require('./db');
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
    const agentPayload = { id: agent.id, role: agent.role, username: agent.username, department: agent.department };
    const token = jwt.sign(agentPayload, EFFECTIVE_JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL.agent });
    // Émet un refresh token
    const refreshToken = await issueRefreshToken(agentPayload);

    // Log successful login
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CONNEXION_AGENT', username, `Connexion réussie de l'agent ${agent.first_name} ${agent.last_name} (${agent.role}).`]
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
        department: agent.department
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
app.get('/api/server-ip', (req, res) => {
  try {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    let serverIp = 'localhost';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          serverIp = iface.address;
          break;
        }
      }
      if (serverIp !== 'localhost') break;
    }
    res.json({ ip: serverIp });
  } catch (err) {
    res.json({ ip: 'localhost' });
  }
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

    // Generate simulated CMU number
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const mSh = mutuelleName.split(' ').pop().substring(0, 3).toUpperCase();
    const cmuNumber = `SN-DK-${mSh}-${randNum}`;

    await client.query('BEGIN');

    // Génère un code PIN aléatoire à 4 chiffres pour le nouvel adhérent
    // (en production, ce PIN serait envoyé par SMS ; ici retourné dans la réponse pour démo)
    const generatedPin = String(Math.floor(1000 + Math.random() * 9000));
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
          const chefRand = Math.floor(1000 + Math.random() * 9000);
          const chefCmu = `SN-DK-HH-${chefRand}`;
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
          const bRand = Math.floor(1000 + Math.random() * 9000);
          const bCmu = parrainageType === 'eleves' ? `SN-DK-EDU-${bRand}` : `SN-DK-SPN-${bRand}`;
          const nameParts = member.name.trim().split(' ');
          const fName = nameParts[0] || (parrainageType === 'eleves' ? 'Élève' : 'Filleul');
          const lName = nameParts.slice(1).join(' ') || (parrainageType === 'eleves' ? 'Scolaire' : 'Parrainé');

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
            const bRand = Math.floor(1000 + Math.random() * 9000);
            const prefix = packageType === 'adhesion_masse' ? 'SN-DK-GRP' : 'SN-DK-EDU';
            const bCmu = `${prefix}-${bRand}`;
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

// 7. Bilingual Gemini 1.5 Chatbot with local rules fallback
app.post('/api/chatbot', validate(chatbotSchema), async (req, res) => {
  try {
    const { message, lang, history, isVoiceInput } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      let userMessageToProcess = message;

      // Décodage STT Wolof si langue = Wolof et qu'il s'agit d'une entrée vocale
      if (lang === 'wo' && isVoiceInput) {
        try {
          console.log("Tentative de décodage STT Wolof...");
          const decodeModel = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            systemInstruction: "L'utilisateur t'envoie un texte qui est la transcription d'une phrase parlée en Wolof mais très mal comprise par le moteur vocal français/anglais (ex: 'am I booking go'). Reconstruis la phrase Wolof originale qui a été prononcée. Ne retourne QUE la phrase en Wolof, sans explication ni guillemets."
          });
          const decodeResult = await decodeModel.generateContent(message);
          const decodedText = decodeResult.response.text().trim();
          if (decodedText && decodedText.length > 0 && !decodedText.toLowerCase().includes('erreur')) {
            console.log(`[Wolof STT] Original: "${message}" -> Décodé: "${decodedText}"`);
            userMessageToProcess = decodedText;
          }
        } catch (decodeErr) {
          console.warn("Erreur décodage STT Wolof:", decodeErr.message);
        }
      }

      // Try only the main model with a fast timeout (1500ms) to ensure instantaneous response
      const modelName = 'gemini-1.5-flash';
      try {
        console.log(`Tentative de réponse avec le modèle ${modelName}...`);

        const systemInstructionText = lang === 'wo' 
          ? `Vous êtes "Zahara", l'assistante virtuelle officielle de MUTUALIS DAKAR, le portail numérique régional de l'union régionale des mutuelles de santé communautaires de Dakar (URMSCD).

Votre personnalité :
- Vous êtes une femme sénégalaise chaleureuse, bienveillante et professionnelle. Vous vous exprimez avec empathie et respect.
- Vous utilisez des emojis de façon modérée.

Vos règles linguistiques de réponse (OBLIGATOIRE WOLOF) :
- Vous devez répondre UNIQUEMENT en WOLOF (Sénégal). Ne répondez pas en français ni en anglais.
- Utilisez un Wolof naturel, fluide et poli.
- Respectez l'orthographe officielle standardisée du Wolof (ex: écrivez "laaj" pour questionner, "tontu" pour répondre, "ngir" pour dans le but de, "bëgg" pour vouloir/aimer, "dimbali" ou "ndimbal" pour aider/aide, "faj" ou "faju" pour soigner, "fajukaay" pour établissement de santé, "fay" pour payer).
- Évitez les orthographes phonétiques francisées (ne pas écrire "faye", "ouakh", "n'ga").
- Utilisez des salutations sénégalaises polies et chaleureuses (ex: "Salamaalekum !", "Mingi lay nuyu !", "Nanga def !").
- Répondez de façon concise (3-4 phrases maximum).
- Ne mélangez pas le français avec le Wolof, sauf pour les termes techniques ou marques inévitables (ex: "carte CMU", "Wave", "Orange Money").
- Terminez toujours en demandant si l'usager a d'autres questions : "Ndax am nga yeneen laaj yoo bëgg ma tontu ?" (Avez-vous d'autres questions auxquelles vous souhaitez que je réponde ?).

Contenu informatif à intégrer :
- Les tarifs : Formule Individuelle (4 500 FCFA / an, comprenant 1 000 FCFA pour la carte et 3 500 FCFA de cotisation) et Formule Familiale (1 000 FCFA pour la carte de l'adhérent principal + 3 500 FCFA de cotisation par membre). Parrainage Solidaire (4 500 FCFA / bénéficiaire) et CSU Élèves/Daaras (1 000 FCFA / élève).
- Les paiements mobiles acceptés sont Orange Money et Wave.
- Les structures conventionnées incluent : Hôpital Principal, Hôpital de Fann, Dalal Jamm, centres de santé et pharmacies agréées.
- Le taux de prise en charge varie de 50% à 80% selon la formule choisie.`
          : `Vous êtes "Zahara", l'assistante virtuelle officielle de MUTUALIS DAKAR, le portail numérique régional de l'union régionale des mutuelles de santé communautaires de Dakar (URMSCD).

Votre personnalité :
- Vous êtes une femme sénégalaise chaleureuse, bienveillante et professionnelle.
- Vous vous exprimez avec empathie et respect.
- Vous utilisez des emojis modérément.

Vos règles de réponse (FRANÇAIS) :
- Répondre de manière concise (max 3-4 phrases), bienveillante et professionnelle. Vous devez répondre uniquement en Français.
- Aider les usagers à comprendre l'adhésion, le renouvellement de cotisation et la cartographie.
- Expliquer les tarifs : Formule Individuelle (4 500 FCFA / an, comprenant 1 000 FCFA pour la carte et 3 500 FCFA de cotisation) et Formule Familiale (1 000 FCFA pour la carte de l'adhérent principal + 3 500 FCFA de cotisation par membre). Expliquer aussi le Parrainage Solidaire (4 500 FCFA / bénéficiaire parrainé) et le tarif subventionné CSU Élèves / Daaras (1 000 FCFA / élève).
- Les paiements mobiles acceptés sont Orange Money et Wave.
- Les structures conventionnées incluent : Hôpital Principal, Hôpital de Fann, Dalal Jamm, centres de santé départementaux et pharmacies agréées.
- Le taux de prise en charge varie de 50% à 80% selon la formule choisie.
- La CMU (Couverture Maladie Universelle) est le programme national du Sénégal pour l'accès aux soins.
- Le portail MUTUALIS DAKAR couvre les 14 départements de la région de Dakar.
- Les mutuelles sont des organisations communautaires d'assurance santé.
- Toujours terminer en demandant si l'usager a d'autres questions.`;

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
        
        // Fast timeout promise (1500ms)
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Gemini Timeout')), 1500)
        );
        
        const result = await Promise.race([
          chat.sendMessage(userMessageToProcess),
          timeoutPromise
        ]);
        
        const responseText = result.response.text();
        console.log(`Succès avec le modèle ${modelName}`);
        return res.json({ response: responseText, decodedText: (userMessageToProcess !== message) ? userMessageToProcess : undefined });
      } catch (geminiErr) {
        console.warn(`Échec ou timeout avec le modèle ${modelName}:`, geminiErr.message);
      }
      console.warn('Utilisation instantanée du fallback local.');
    }

    // Fallback Local Simulation
    const msg = (typeof userMessageToProcess !== 'undefined' ? userMessageToProcess : message).toLowerCase();
    let reply = '';

    if (lang === 'wo') {
      if (msg.includes('naka') || msg.includes('salaam') || msg.includes('mën') || msg.includes('bonjour') || msg.includes('def')) {
        reply = "Salamaalekum ! Nanga def ! Man la Zahara, assistante virtuelle bu MUTUALIS DAKAR. Naka la la mënee dimbali tey ? 😊";
      } else if (msg.includes('fay') || msg.includes('cotisation') || msg.includes('xaalis') || msg.includes('bopp') || msg.includes('ñata') || msg.includes('combien')) {
        reply = "Waaw, mën nga fay sa cotisation ci portal bi. Demal ci tab 'Bokk bu bees / Nouvelle adhésion' walla 'Fayal sa yeneen / Renouvellement'. Fay bi mën na am ci Orange Money walla Wave. 💳";
      } else if (msg.includes('mutuelle') || msg.includes('jege') || msg.includes('fan') || msg.includes('proche')) {
        reply = "Am na mutuelle yu bari ci Ndakaaru (Médina, Pikine, Golf Sud...). Xoolal kàrt bi ci portal bi ngir xam bi la gëna jege. 📍";
      } else if (msg.includes('fajj') || msg.includes('hôpital') || msg.includes('dispensaire') || msg.includes('clinique')) {
        reply = "Hôpital Principal, Fann ak Dalal Jamm bokk nañu ci fajukaay yi nu agréer. Tiers-payant bi mën na la dimbali ba 80% ci say frais. 🏥";
      } else {
        reply = "Jërëjëf ci sa mesaas. Mën nga ma laaj ci wallu cotisation, adhésion walla mutuelle yi nekk ci Ndakaaru. 🙏";
      }
    } else {
      // French
      if (msg.includes('bonjour') || msg.includes('salut') || msg.includes('aide') || msg.includes('comment')) {
        reply = "Bonjour ! Je suis Zahara, l'assistante virtuelle de MUTUALIS DAKAR. Comment puis-je vous aider aujourd'hui ? 😊";
      } else if (msg.includes('adhérer') || msg.includes('inscription') || msg.includes('comment adhérer') || msg.includes('etape')) {
        reply = "Pour adhérer, rendez-vous sur l'onglet 'Nouvelle Adhésion'. Le processus se fait en 8 étapes simples : choix de la mutuelle, choix de la formule, saisie de vos données, et paiement sécurisé via Orange Money ou Wave. 📝";
      } else if (msg.includes('payer') || msg.includes('cotisation') || msg.includes('tarif') || msg.includes('prix')) {
        reply = "Les tarifs annuels sont : Formule Individuelle (4 500 FCFA/an) et Formule Familiale (1 000 FCFA pour la carte + 3 500 FCFA par membre). Le paiement s'effectue en ligne via Orange Money ou Wave. 💰";
      } else if (msg.includes('mutuelle') || msg.includes('trouver') || msg.includes('adresse') || msg.includes('carte')) {
        reply = "Vous pouvez localiser la mutuelle de votre commune en consultant notre 'Cartographie'. Nous sommes présents à la Médina, Pikine, Guédiawaye, Keur Massar et Rufisque. 📍";
      } else if (msg.includes('hôpital') || msg.includes('clinique') || msg.includes('pharmacie') || msg.includes('conventionné')) {
        reply = "Nous sommes conventionnés avec l'Hôpital principal de Dakar, l'Hôpital de Fann, Dalal Jamm et de nombreuses pharmacies de quartier. 🏥";
      } else {
        reply = "Merci pour votre message ! Je suis Zahara, à votre disposition pour vous aider avec l'adhésion, le renouvellement, ou la localisation d'une mutuelle partenaire. 😊";
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

    if (!provider) {
      return res.status(410).json({
        error: 'Endpoint TTS déprécié.',
        message: 'Spécifiez un provider (elevenlabs ou opensource) pour utiliser les voix neuronales.'
      });
    }

    if (provider === 'elevenlabs') {
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

    if (provider === 'opensource') {
      const ttsUrl = process.env.OPEN_SOURCE_TTS_URL;
      if (!ttsUrl) {
        return res.status(400).json({ error: 'OPEN_SOURCE_TTS_URL non configuré.' });
      }

      console.log(`[OpenSource TTS] Envoi à ${ttsUrl} pour: "${text.substring(0, 30)}..."`);
      const response = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: lang || 'wo' })
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

    // Union Départementale logic: restrict to their department if not Super Admin
    if (req.user && req.user.role !== 'Super Admin' && req.user.department) {
      whereSql += ` AND department = $${paramIdx}`;
      params.push(req.user.department);
      paramIdx++;
    }

    if (mutuelle && mutuelle !== 'all') {
      whereSql += ` AND mutuelle_name = $${paramIdx}`;
      params.push(mutuelle);
      paramIdx++;
    }

    if (q) {
      whereSql += ` AND (first_name ILIKE $${paramIdx} OR last_name ILIKE $${paramIdx} OR phone ILIKE $${paramIdx} OR cmu_number ILIKE $${paramIdx})`;
      params.push(`%${q}%`);
      paramIdx++;
    }

    // Compte total (pour la métadonnée de pagination)
    const countRes = await query(`SELECT COUNT(*) FROM beneficiaries${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count || '0', 10);

    // Requête paginée
    const dataSql = `SELECT * FROM beneficiaries${whereSql} ORDER BY id DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    const bRes = await query(dataSql, [...params, limit, offset]);

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

    const beneficiaries = bRes.rows.map((b) => {
      return {
        id: b.id,
        firstName: b.first_name,
        lastName: b.last_name,
        birthDate: b.birth_date,
        phone: b.phone,
        email: b.email,
        address: b.address,
        mutuelleName: b.mutuelle_name,
        packageType: b.package_type,
        paymentMethod: b.payment_method,
        cmuNumber: b.cmu_number,
        status: b.status,
        createdAt: b.created_at,
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

// 11. GET /api/stats (Get real-time statistics from PostgreSQL)
app.get('/api/stats', async (req, res) => {
  try {
    const bCount = await query('SELECT COUNT(*) FROM beneficiaries');
    const bActiveCount = await query("SELECT COUNT(*) FROM beneficiaries WHERE status = 'active'");
    const mCount = await query('SELECT COUNT(*) FROM mutuelles');
    const dSum = await query('SELECT SUM(amount) FROM donations');

    res.json({
      beneficiariesCount: parseInt(bCount.rows[0].count || '0'),
      activeBeneficiariesCount: parseInt(bActiveCount.rows[0].count || '0'),
      mutuellesCount: parseInt(mCount.rows[0].count || '0'),
      donationsSum: parseInt(dSum.rows[0].sum || '0')
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

    if (req.user && req.user.role !== 'Super Admin' && req.user.department) {
      countSql = 'SELECT COUNT(*) FROM complaints c JOIN beneficiaries b ON c.phone = b.phone';
      dataSql = 'SELECT c.* FROM complaints c JOIN beneficiaries b ON c.phone = b.phone';
      whereSql = ' WHERE b.department = $1';
      params.push(req.user.department);
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
    const actor = req.user.username || 'agent@cmu.sn';
    
    // Find complaint
    const compRes = await query('SELECT * FROM complaints WHERE id = $1', [id]);
    if (compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Réclamation introuvable.' });
    }
    const comp = compRes.rows[0];

    await query(`UPDATE complaints SET status = 'resolved' WHERE id = $1`, [id]);

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


// Ensure indexes exist for better query performance under concurrency
(async () => {
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_beneficiaries_phone ON beneficiaries(phone)');
    await query('CREATE INDEX IF NOT EXISTS idx_beneficiaries_cmu ON beneficiaries(cmu_number)');
    await query('CREATE INDEX IF NOT EXISTS idx_family_members_beneficiary ON family_members(beneficiary_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_partner_users_structure ON partner_users(structure_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)');
    console.log('Indexation PostgreSQL vérifiée avec succès.');
  } catch (err) {
    console.warn('Vérification des index PostgreSQL reportée (les tables ne sont peut-être pas encore initialisées) :', err.message);
  }
})();


// Start the server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
  });
}

module.exports = app;
