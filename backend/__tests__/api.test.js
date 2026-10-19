// Tests d'intégration de l'API MUTUALIS DAKAR.
// La DB PostgreSQL est mockée pour ne pas dépendre d'un serveur réel.
const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock du module db AVANT l'import de server.js
jest.mock('../db', () => {
  const mockQuery = jest.fn();
  const mockPool = { connect: jest.fn() };
  return { query: mockQuery, pool: mockPool };
});

// Mock de @google/generative-ai pour éviter les appels réseau
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn()
  }))
}));

const { query, pool } = require('../db');
const app = require('../server.js');

const JWT_SECRET = process.env.JWT_SECRET;

// Helpers : génère des jetons valides pour les tests
const citizenToken = jwt.sign({ id: 1, role: 'citizen', phone: '771234567' }, JWT_SECRET, { expiresIn: '1h' });
const agentToken = jwt.sign({ id: 10, role: 'agent', username: 'agent@cmu.sn' }, JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ id: 11, role: 'Super Admin', username: 'superadmin@cmu.sn' }, JWT_SECRET, { expiresIn: '1h' });
const authCitizen = { Authorization: `Bearer ${citizenToken}` };
const authAgent = { Authorization: `Bearer ${agentToken}` };
const authAdmin = { Authorization: `Bearer ${adminToken}` };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Sécurité & RBAC', () => {
  test('GET /api/beneficiaries sans jeton → 401', async () => {
    const res = await request(app).get('/api/beneficiaries');
    expect(res.status).toBe(401);
  });

  test('GET /api/beneficiaries avec jeton citoyen → 403 (RBAC)', async () => {
    const res = await request(app).get('/api/beneficiaries').set(authCitizen);
    expect(res.status).toBe(403);
  });

  test('GET /api/beneficiaries avec jeton agent → 200', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // COUNT
    query.mockResolvedValueOnce({ rows: [] }); // data
    const res = await request(app).get('/api/beneficiaries').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  test('POST /api/agents sans auth → 401', async () => {
    const res = await request(app).post('/api/agents').send({ username: 'x@y.z', password: '12345678', role: 'agent' });
    expect(res.status).toBe(401);
  });

  test('POST /api/agents avec agent (non admin) → 403', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set(authAgent)
      .send({ username: 'x@y.z', password: '12345678', role: 'agent' });
    expect(res.status).toBe(403);
  });

  test('GET /api/audit-logs sans jeton → 401', async () => {
    const res = await request(app).get('/api/audit-logs');
    expect(res.status).toBe(401);
  });

  test('GET /api/complaints sans jeton → 401', async () => {
    const res = await request(app).get('/api/complaints');
    expect(res.status).toBe(401);
  });
});

describe('Authentification : access + refresh tokens', () => {
  test('POST /api/auth/citizen/login avec PIN haché invalide → 401', async () => {
    // Mock : trouvons l'utilisateur (PIN haché bcrypt invalide)
    query.mockResolvedValueOnce({
      rows: [{
        id: 1, first_name: 'Modou', last_name: 'Diop', phone: '771234567',
        pin_code: '$2b$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUV123456789012345678901234567890',
        email: 'modou@example.com', address: 'Médina', mutuelle_name: 'Mutuelle Médina',
        package_type: 'individuel', payment_method: 'wave', cmu_number: 'SN-DK-MED-1',
        status: 'active', photo_url: null, birth_date: '1990-05-12'
      }]
    });
    // Les mocks suivants (family_members, audit_logs, refresh_tokens) ne sont pas consommés
    // car le login échoue avant ; on n'en positionne donc pas.

    const res = await request(app)
      .post('/api/auth/citizen/login')
      .send({ phone: '771234567', pinCode: '1234' });

    // Le PIN haché mock ne matche pas via bcrypt.compare → 401 attendu
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/refresh sans refresh token → 400', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/refresh avec token invalide → 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'invalid.token.here' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/refresh avec token valide → nouveaux jetons + rotation', async () => {
    // Génère un refresh token valide signé avec le secret de test
    const validRefresh = jwt.sign(
      { id: 1, role: 'citizen', kind: 'refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );
    // Mock verifyRefreshToken : SELECT refresh_tokens actif
    query.mockResolvedValueOnce({
      rows: [{ id: 99, token_hash: 'hash', user_id: 1, user_role: 'citizen', revoked: false }]
    });
    // Mock rotation : UPDATE revoked
    query.mockResolvedValueOnce({ rows: [] });
    // Mock issueRefreshToken : INSERT nouveau refresh
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: validRefresh });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  test('POST /api/auth/logout révoque le refresh token → 200', async () => {
    query.mockResolvedValue({ rows: [] }); // UPDATE revoked
    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: 'some.token.value' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/auth/logout sans refresh token → 200 (best-effort)', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

describe('Validation des entrées (zod)', () => {
  test('POST /api/auth/citizen/login avec PIN invalide → 400', async () => {
    const res = await request(app)
      .post('/api/auth/citizen/login')
      .send({ phone: '771234567', pinCode: '12' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST /api/auth/citizen/login avec téléphone invalide → 400', async () => {
    const res = await request(app)
      .post('/api/auth/citizen/login')
      .send({ phone: '123', pinCode: '1234' });
    expect(res.status).toBe(400);
  });

  test('POST /api/donations avec montant négatif → 400', async () => {
    const res = await request(app).post('/api/donations').send({ amount: -100 });
    expect(res.status).toBe(400);
  });

  test('POST /api/donations avec montant valide → 201', async () => {
    query.mockResolvedValue({ rows: [] });
    const res = await request(app).post('/api/donations').send({ amount: 5000, target: 'general' });
    expect(res.status).toBe(201);
  });

  test('POST /api/agents avec mot de passe trop court → 400', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set(authAdmin)
      .send({ username: 'x@y.z', password: '123', role: 'agent' });
    expect(res.status).toBe(400);
  });

  test('POST /api/complaints avec champs manquants → 400', async () => {
    const res = await request(app).post('/api/complaints').send({ beneficiaryName: 'Test' });
    expect(res.status).toBe(400);
  });

  test('POST /api/chatbot avec message vide → 400', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: '' });
    expect(res.status).toBe(400);
  });
});

describe('Pagination', () => {
  test('GET /api/beneficiaries renvoie une structure paginée', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: '25' }] }); // COUNT
    query.mockResolvedValueOnce({ rows: [] }); // data
    const res = await request(app).get('/api/beneficiaries?page=2&limit=10').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toMatchObject({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true
    });
  });

  test('GET /api/audit-logs plafonne la limit à 200', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/audit-logs?limit=9999').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(200);
  });
});

describe('Chatbot (fallback local)', () => {
  test('POST /api/chatbot sans clé Gemini → réponse fallback FR', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'bonjour', lang: 'fr' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('response');
    expect(typeof res.body.response).toBe('string');
  });

  test('POST /api/chatbot Wolof → réponse fallback WO', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'naka', lang: 'wo' });
    expect(res.status).toBe(200);
    // Le chatbot a été enrichi : la salutation peut être « nanga def », la
    // forme plus naturelle « naka nga defee », ou les salutations religieuses
    // « salamaalekum » / « asalaa maalekum » / « jàmm rekk » — toutes légitimes.
    const r = res.body.response.toLowerCase();
    const isWolofGreeting = r.includes('nanga def') || r.includes('naka nga def')
      || r.includes('salamaalekum') || r.includes('asalaa maalekum') || r.includes('jàmm rekk');
    expect(isWolofGreeting).toBe(true);
  });
});

describe('TTS', () => {
  test('GET /api/tts sans paramètre text → 400', async () => {
    // Le TTS n'a jamais été déprécié : la synthèse vocale (voix Piper en
    // open-source, repli navigateur) reste une fonctionnalité active du portail.
    // L'ancien test attendait un 410 « Gone » résiduel d'une dépréciation
    // annulée — il faisait échouer toute la suite.
    const res = await request(app).get('/api/tts');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('Routes publiques', () => {
  test('GET /api/mutuelles → 200', async () => {
    query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/mutuelles');
    expect(res.status).toBe(200);
  });

  test('GET /api/locations → 200', async () => {
    query.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(200);
  });

  test('GET /api/stats → 200', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ count: '4' }] })
      .mockResolvedValueOnce({ rows: [{ sum: '10000' }] });
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      beneficiariesCount: 5,
      activeBeneficiariesCount: 3,
      mutuellesCount: 4,
      donationsSum: 10000
    });
  });
});

describe('Routes CSU (programmes, claims, carte CMU, dashboard)', () => {
  test('GET /api/csu/programs → 200 (public)', async () => {
    query.mockResolvedValue({ rows: [{ slug: 'sesame', title_fr: 'Plan Sésame', is_active: true }] });
    const res = await request(app).get('/api/csu/programs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/csu/programs/:slug → 200', async () => {
    query.mockResolvedValueOnce({ rows: [{ slug: 'sesame', title_fr: 'Plan Sésame' }] });
    const res = await request(app).get('/api/csu/programs/sesame');
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('sesame');
  });

  test('GET /api/csu/programs/:slug introuvable → 404', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/csu/programs/inexistant');
    expect(res.status).toBe(404);
  });

  test('POST /api/csu/programs sans auth → 401', async () => {
    const res = await request(app).post('/api/csu/programs').send({ slug: 'test', titleFr: 'Test', descriptionFr: 'Desc' });
    expect(res.status).toBe(401);
  });

  test('POST /api/claims avec données valides → 201', async () => {
    // Mock : INSERT claim RETURNING
    query.mockResolvedValueOnce({ rows: [{ id: 42, reimbursed_amount: 8000 }] });
    // Mock : INSERT notification (best-effort)
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/claims')
      .send({
        beneficiaryName: 'Modou Diop',
        phone: '771234567',
        structureName: 'Hôpital Principal',
        careType: 'consultation',
        amount: 10000,
        coverageRate: 80
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.claimId).toBe(42);
    expect(res.body.reimbursedAmount).toBe(8000);
  });

  test('POST /api/claims avec type de soin invalide → 400', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({
        beneficiaryName: 'Test',
        phone: '771234567',
        structureName: 'Test',
        careType: 'invalide',
        amount: 1000
      });
    expect(res.status).toBe(400);
  });

  test('GET /api/claims sans auth → 401', async () => {
    const res = await request(app).get('/api/claims');
    expect(res.status).toBe(401);
  });

  test('GET /api/claims avec token agent → 200 (paginé)', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // COUNT
    query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending' }] }); // data
    const res = await request(app).get('/api/claims').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  test('GET /api/cmu-card/:cmuNumber → 200 (carte valide)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, first_name: 'Modou', last_name: 'Diop', status: 'active', cmu_number: 'SN-DK-MED-1', phone: '771234567', mutuelle_name: 'Médina', package_type: 'individuel', birth_date: '1990-05-12', photo_url: null }] });
    query.mockResolvedValueOnce({ rows: [] }); // family members
    const res = await request(app).get('/api/cmu-card/SN-DK-MED-1');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.firstName).toBe('Modou');
  });

  test('GET /api/cmu-card/:cmuNumber introuvable → 404', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/cmu-card/INEXISTANT');
    expect(res.status).toBe(404);
    expect(res.body.valid).toBe(false);
  });

  test('GET /api/dashboard/stats sans auth → 401', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });

  test('GET /api/dashboard/stats avec token agent → 200', async () => {
    // Mocks des multiples requêtes du dashboard
    query.mockResolvedValue({ rows: [{ count: '0', sum: '0' }] });
    const res = await request(app).get('/api/dashboard/stats').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('beneficiaries');
    expect(res.body).toHaveProperty('claims');
  });

  test('POST /api/notifications sans auth → 401', async () => {
    const res = await request(app)
      .post('/api/notifications')
      .send({ recipient: '771234567', type: 'rappel', body: 'Test' });
    expect(res.status).toBe(401);
  });

  test('POST /api/notifications avec token agent → 201', async () => {
    query.mockResolvedValue({ rows: [] }); // INSERT notification + audit
    const res = await request(app)
      .post('/api/notifications')
      .set(authAgent)
      .send({ recipient: '771234567', channel: 'sms', type: 'rappel', body: 'Rappel cotisation' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('Cotisations + rappels automatiques', () => {
  test('GET /api/cotisations sans auth → 401', async () => {
    const res = await request(app).get('/api/cotisations');
    expect(res.status).toBe(401);
  });

  test('GET /api/cotisations avec token agent → 200 (paginé)', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/cotisations').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  test('POST /api/cotisations/send-reminders sans auth → 401', async () => {
    const res = await request(app).post('/api/cotisations/send-reminders');
    expect(res.status).toBe(401);
  });

  test('POST /api/cotisations/send-reminders avec token agent → 200', async () => {
    // Mocks : SELECT expiring (vide), SELECT expired (vide)
    query.mockResolvedValueOnce({ rows: [] }); // expiring
    query.mockResolvedValueOnce({ rows: [] }); // expired
    // Mock du pool.connect() pour la transaction
    const mockClient = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    pool.connect.mockResolvedValueOnce(mockClient);
    query.mockResolvedValueOnce({ rows: [] }); // audit log
    const res = await request(app).post('/api/cotisations/send-reminders').set(authAgent);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('remindersSent');
  });
});

describe('Espace partenaire (structures de soins)', () => {
  test('POST /api/auth/partner/login avec identifiants invalides → 404', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // utilisateur introuvable
    const res = await request(app)
      .post('/api/auth/partner/login')
      .send({ username: 'inexistant@cmu.sn', password: 'test' });
    expect(res.status).toBe(404);
  });

  test('POST /api/auth/partner/login sans champs → 400', async () => {
    const res = await request(app).post('/api/auth/partner/login').send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/partner/verify-card sans token partenaire → 401', async () => {
    const res = await request(app).get('/api/partner/verify-card/SN-DK-MED-1');
    expect(res.status).toBe(401);
  });

  test('GET /api/partner/verify-card avec token agent (non partenaire) → 403', async () => {
    const res = await request(app).get('/api/partner/verify-card/SN-DK-MED-1').set(authAgent);
    expect(res.status).toBe(403);
  });

  test('GET /api/partners/structures sans auth → 401', async () => {
    const res = await request(app).get('/api/partners/structures');
    expect(res.status).toBe(401);
  });

  test('GET /api/partners/structures avec token agent (non admin) → 403', async () => {
    const res = await request(app).get('/api/partners/structures').set(authAgent);
    expect(res.status).toBe(403);
  });
});

describe('Statistiques inter-régions', () => {
  test('GET /api/dashboard/regional-comparison sans auth → 401', async () => {
    const res = await request(app).get('/api/dashboard/regional-comparison');
    expect(res.status).toBe(401);
  });

  test('GET /api/dashboard/regional-comparison avec token agent → 403', async () => {
    const res = await request(app).get('/api/dashboard/regional-comparison').set(authAgent);
    expect(res.status).toBe(403);
  });

  test('GET /api/dashboard/regional-comparison avec token admin → 200', async () => {
    query.mockResolvedValue({ rows: [] }); // toutes les requêtes d'agrégation
    const res = await request(app).get('/api/dashboard/regional-comparison').set(authAdmin);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byRegion');
    expect(res.body).toHaveProperty('claimsByRegion');
    expect(res.body).toHaveProperty('topMutuelles');
  });
});

describe('Fidélité assurés (points + badges)', () => {
  test('GET /api/loyalty/:id sans auth → 401', async () => {
    const res = await request(app).get('/api/loyalty/1');
    expect(res.status).toBe(401);
  });

  test('GET /api/loyalty/:id avec token citoyen (propre compte) → 200', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '100' }] }); // SUM points
    query.mockResolvedValueOnce({ rows: [] }); // history
    query.mockResolvedValueOnce({ rows: [] }); // badges
    const res = await request(app).get('/api/loyalty/1').set(authCitizen);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalPoints');
    expect(res.body).toHaveProperty('badges');
    expect(res.body).toHaveProperty('level');
  });

  test('GET /api/loyalty/:id avec citoyen (autre compte) → 403', async () => {
    const res = await request(app).get('/api/loyalty/999').set(authCitizen);
    expect(res.status).toBe(403);
  });

  test('GET /api/loyalty/leaderboard sans auth → 401', async () => {
    const res = await request(app).get('/api/loyalty/leaderboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/loyalty/leaderboard avec token agent → 200', async () => {
    query.mockResolvedValueOnce({ rows: [{ beneficiary_id: 1, first_name: 'Modou', total: '100' }] });
    const res = await request(app).get('/api/loyalty/leaderboard').set(authAgent);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Paiements Orange Money / Wave', () => {
  test('POST /api/payments/initiate avec données valides → 201', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, reference: 'OM-TEST-1' }] }); // INSERT payment
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({ phone: '771234567', provider: 'wave', amount: 4500, purpose: 'cotisation' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.reference).toBeTruthy();
  });

  test('POST /api/payments/initiate avec provider invalide → 400', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({ phone: '771234567', provider: 'invalide', amount: 4500, purpose: 'cotisation' });
    expect(res.status).toBe(400);
  });

  test('POST /api/payments/initiate avec montant négatif → 400', async () => {
    const res = await request(app)
      .post('/api/payments/initiate')
      .send({ phone: '771234567', provider: 'wave', amount: -100, purpose: 'cotisation' });
    expect(res.status).toBe(400);
  });

  test('GET /api/payments/:reference → 200', async () => {
    query.mockResolvedValueOnce({ rows: [{ reference: 'OM-TEST-1', status: 'initiated' }] });
    const res = await request(app).get('/api/payments/OM-TEST-1');
    expect(res.status).toBe(200);
    expect(res.body.reference).toBe('OM-TEST-1');
  });

  test('GET /api/payments/:reference introuvable → 404', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/payments/INEXISTANT');
    expect(res.status).toBe(404);
  });

  test('POST /api/payments/webhook/:provider avec référence manquante → 400', async () => {
    const res = await request(app).post('/api/payments/webhook/wave').send({});
    expect(res.status).toBe(400);
  });

  test('GET /api/payments sans auth → 401', async () => {
    const res = await request(app).get('/api/payments');
    expect(res.status).toBe(401);
  });

  test('GET /api/payments avec token citoyen → 200 (paginé)', async () => {
    query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/payments').set(authCitizen);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('Synchronisation hors-ligne', () => {
  test('POST /api/sync/queue sans auth → 401', async () => {
    const res = await request(app).post('/api/sync/queue').send({ action: 'donation', payload: {} });
    expect(res.status).toBe(401);
  });

  test('POST /api/sync/queue avec token citoyen → 201', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // INSERT sync_queue
    const res = await request(app)
      .post('/api/sync/queue')
      .set(authCitizen)
      .send({ action: 'donation', payload: { amount: 5000 } });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/sync/queue avec action invalide → 400', async () => {
    const res = await request(app)
      .post('/api/sync/queue')
      .set(authCitizen)
      .send({ action: 'invalide', payload: {} });
    expect(res.status).toBe(400);
  });

  test('POST /api/sync/process sans auth → 401', async () => {
    const res = await request(app).post('/api/sync/process');
    expect(res.status).toBe(401);
  });

  test('GET /api/sync/status sans auth → 401', async () => {
    const res = await request(app).get('/api/sync/status');
    expect(res.status).toBe(401);
  });
});

/**
 * Import en masse : c'est une ÉCRITURE, donc elle doit être authentifiée et
 * cloisonnée par MSD comme les autres.
 *
 * ⚠️ RÉGRESSION : la route était déclarée `app.post('/api/beneficiaries/bulk',
 * async (req, res) => …)` — sans `authenticateToken`, sans `requireRole` et
 * sans filtre `msd_code`. N'importe qui pouvait insérer ou modifier des
 * bénéficiaires en base, y compris ceux d'une autre MSD. Ces tests verrouillent
 * la fermeture.
 *
 * La DB est mockée : `pool.connect()` doit donc renvoyer un client avec
 * `query` et `release`. On helper pour éviter de réécrire le double mock.
 */
describe('POST /api/beneficiaries/bulk — écriture protégée et cloisonnée', () => {
  const LOT_DKR = [{
    codeBeneficiaire: 'DKR_260001.0',
    prenom: 'MOUSTAPHA',
    nom: 'NDIONE',
    birthDate: '1972-01-03',
    photoUrl: 'data:image/jpeg;base64,AAAA'
  }];

  /** Client SQL mocké : une réponse vide par requête. */
  const clientMock = () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn()
  });

  /** Jeton d'un agent rattaché à une MSD (PKN = Pikine). */
  const agentPknToken = () => jwt.sign(
    { id: 12, role: 'agent', username: 'agent@pkn.cmu.sn', msdCode: 'PKN' },
    JWT_SECRET, { expiresIn: '1h' }
  );

  beforeEach(() => {
    pool.connect.mockReset();
  });

  test('sans jeton → 401 (la route était ouverte à tous)', async () => {
    const res = await request(app).post('/api/beneficiaries/bulk').send({ rows: LOT_DKR });
    expect(res.status).toBe(401);
  });

  test('avec jeton citoyen → 403 (RBAC)', async () => {
    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set(authCitizen)
      .send({ rows: LOT_DKR });
    expect(res.status).toBe(403);
  });

  test('un agent DAKAR importe un code DKR → accepté et rattaché à sa MSD', async () => {
    const client = clientMock();
    // SELECT de détection : aucune fiche existante → INSERT.
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] });
    pool.connect.mockResolvedValue(client);

    const agentDkrToken = jwt.sign(
      { id: 13, role: 'agent', username: 'agent@dkr.cmu.sn', msdCode: 'DKR' },
      JWT_SECRET, { expiresIn: '1h' }
    );
    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentDkrToken}` })
      .send({ rows: LOT_DKR });

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(1);

    // L'INSERT doit porter msd_code : sans lui, la fiche créée est INVISIBLE
    // du filtre `b.msd_code` de GET /api/beneficiaries (elle n'apparaîtrait
    // que pour le Super Admin).
    const insert = client.query.mock.calls.find((c) => /INSERT INTO beneficiaries/i.test(c[0]));
    expect(insert).toBeDefined();
    expect(insert[0]).toMatch(/msd_code/i);
    expect(insert[1]).toContain('DKR');
  });

  test('un agent PKN ne peut PAS importer une fiche DKR (refus, pas doublon)', async () => {
    const client = clientMock();
    client.query.mockResolvedValue({ rows: [], rowCount: 0 });
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentPknToken()}` })
      .send({ rows: LOT_DKR });

    expect(res.status).toBe(201);
    // La ligne est refusée : ni créée, ni mise à jour.
    expect(res.body.inserted).toBe(0);
    expect(res.body.refused).toBe(1);
    // AUCUNE requête d'écriture : un refus ne doit rien laisser passer.
    expect(client.query.mock.calls.filter((c) => /^INSERT/i.test(c[0].trim()))).toHaveLength(0);
    expect(client.query.mock.calls.filter((c) => /^UPDATE/i.test(c[0].trim()))).toHaveLength(0);
  });

  test('un agent ne peut PAS modifier une fiche déjà rattachée à une autre MSD', async () => {
    const client = clientMock();
    // SELECT de détection : la fiche existe et appartient à DKR…
    client.query.mockResolvedValueOnce({ rows: [{ id: 77, msd_code: 'DKR' }] });
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentPknToken()}` })
      .send({ rows: LOT_DKR });

    expect(res.status).toBe(201);
    expect(res.body.updated).toBe(0);
    expect(res.body.refused).toBe(1);
    // Le refus porte BIEN sur la photo : aucune écriture de photo_url.
    expect(client.query.mock.calls.filter((c) => /^UPDATE/i.test(c[0].trim()))).toHaveLength(0);
  });

  test('le Super Admin (sans msdCode) n\'est PAS filtré', async () => {
    const client = clientMock();
    client.query.mockResolvedValue({ rows: [], rowCount: 1 });
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set(authAdmin)
      .send({ rows: LOT_DKR });

    expect(res.status).toBe(201);
    expect(res.body.inserted).toBe(1);
    expect(res.body.refused).toBe(0);
  });

  // ⚠️ FAIL-CLOSED : un compte agent dont `agents.msd_code` est vide n'est
  // pas traité comme un superviseur. Avant ce chantier, il passait les deux
  // barrières MSD (agentMsd === null) et pouvait importer dans TOUTES les MSD.
  test('un agent NON RATTACHÉ à une MSD → 403 (fail-closed)', async () => {
    const client = clientMock();
    client.query.mockResolvedValue({ rows: [], rowCount: 1 });
    pool.connect.mockResolvedValue(client);

    // `authAgent` = { role: 'agent', username: … } — AUCUN msdCode.
    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set(authAgent)
      .send({ rows: LOT_DKR });

    expect(res.status).toBe(403);
    // Le refus doit être explicite, sinon l'agent croira à une panne réseau.
    expect(res.body.errorCode).toBe('AGENT_NOT_LINKED_TO_MSD');
    expect(String(res.body.error)).toMatch(/MSD/i);
    // Aucune écriture, et pas d'appel base du tout.
    expect(pool.connect).not.toHaveBeenCalled();
  });

  // La même règle s'applique à la LECTURE du secours : sinon un agent non
  // rattaché verrait les NIN, adresses et photos de toutes les MSD.
  test('un agent NON RATTACHÉ ne peut pas lire le secours (403)', async () => {
    const res = await request(app).get('/api/beneficiaries/fallback').set(authAgent);
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('AGENT_NOT_LINKED_TO_MSD');
  });

  test('le contrat de réponse expose toujours inserted/updated/total', async () => {
    const client = clientMock();
    client.query.mockResolvedValue({ rows: [], rowCount: 1 });
    pool.connect.mockResolvedValue(client);

    // ⚠️ AMENDÉ : ce test utilisait `authAgent`, dont le jeton ne porte AUCUN
    // `msdCode`. Il encodait donc la FAILLE que ce chantier ferme — un agent non
    // rattaché à une MSD passait les deux barrières, parce que `agentMsd` valait
    // `null`, la signature du superviseur. Le 201 attendu ci-dessous ne pouvait
    // plus être obtenu par ce compte : c'est précisément l'objet du correctif.
    // Le compte de rattachement reste vérifié juste au-dessus, sur 6 tests.
    const agentDkrToken = jwt.sign(
      { id: 13, role: 'agent', username: 'agent@dkr.cmu.sn', msdCode: 'DKR' },
      JWT_SECRET, { expiresIn: '1h' }
    );
    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentDkrToken}` })
      .send({ rows: LOT_DKR });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, mode: 'database' });
    ['inserted', 'updated', 'skipped', 'total'].forEach((k) => {
      expect(res.body).toHaveProperty(k);
    });
    expect(res.body.total).toBe(1);
  });
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CONTRE-EXPERIENCE — ce que les tests « à jest.Mock » ne voirraient jamais
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les tests ci-dessus répondent toujours `{ rows: [] }` : ils prouvent le COMPTE
 * (inserted/refused), jamais ce qu'une vraie PostgreSQL aurait fait. Les cas
 * suivants sont précisément ceux qu'un `mockResolvedValue` ne peut pas détecter :
 * une correspondance croisée (matricule d'une MSD, NIN d'une autre), un
 * `LIMIT 1` sans `ORDER BY`, une transaction laissée ouverte, un journal
 * indisponible. Ils sont écrits contre la ROUTE, pas contre son squelette.
 */
describe('POST /api/beneficiaries/bulk — contre-expertise', () => {
  const fallbackStore = require('../fallbackStore');

  const clientMock = () => ({
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn()
  });

  const agentPknToken = () => jwt.sign(
    { id: 12, role: 'agent', username: 'agent@pkn.cmu.sn', msdCode: 'PKN' },
    JWT_SECRET, { expiresIn: '1h' }
  );

  /** Les requêtes envoyées au client, dans l'ordre. */
  const statements = (client) => client.query.mock.calls.map((c) => String(c[0]).trim());
  const updates = (client) => statements(client).filter((s) => /^UPDATE/i.test(s));
  const inserts = (client) => statements(client).filter((s) => /^INSERT/i.test(s));

  let addRecord;

  beforeEach(() => {
    pool.connect.mockReset();
    // Le repli fichier ne doit jamais toucher backend/data/store.json pendant
    // une suite de tests : on l'espionne (server.js appelle bien
    // `fallbackStore.addRecord(...)`, donc l'espion est vu par la route).
    jest.spyOn(fallbackStore, 'listRecords').mockReturnValue([]);
    addRecord = jest.spyOn(fallbackStore, 'addRecord').mockReturnValue({});
    jest.spyOn(fallbackStore, 'mergeRecord').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    query.mockReset();
  });

  test('un NIN d\'une AUTRE MSD ne permet pas de s\'approprier sa fiche', async () => {
    // Fiche DKR jamais rattachée (msd_code NULL) : c'est le SEUL cas que la
    // troisième clause de la barrière B laissait passer jusqu'ici, car le
    // préfixe invoqué était celui de la LIGNE IMPORTÉE (CMU-PKN-…), jamais
    // celui de la FICHE TROUVÉE (CMU-DKR-…).
    const client = clientMock();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })                              // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 20, msd_code: null, cmu_number: 'CMU-DKR-0000009' }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });                             // COMMIT
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentPknToken()}` })
      .send({
        rows: [{
          codeBeneficiaire: 'CMU-PKN-0000001',
          nin: 'NIN-DKR',
          prenom: 'PIRATE',
          photoUrl: 'data:image/jpeg;base64,AA'
        }]
      });

    expect(res.status).toBe(201);
    expect(res.body.updated).toBe(0);
    expect(res.body.refused).toBe(1);
    // Aucune écriture : ni le nom, ni la photo, ni le rattachement à PKN.
    expect(updates(client)).toHaveLength(0);
    expect(inserts(client)).toHaveLength(0);
  });

  test('la correspondance exacte par matricule prime sur le NIN', async () => {
    const client = clientMock();
    // Deux fiches correspondent : celle de DKR (par NIN) et celle de PKN (par
    // matricule). `LIMIT 1` sans `ORDER BY` laissait PostgreSQL rendre une
    // ligne ARBITRAIRE : l'import légitime de l'agent était alors refusé sans
    // motif, et le résultat changeait d'un import à l'autre.
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ id: 10, msd_code: 'PKN', cmu_number: 'CMU-PKN-0000001' }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentPknToken()}` })
      .send({ rows: [{ codeBeneficiaire: 'CMU-PKN-0000001', nin: 'NIN-DKR', photoUrl: 'PHOTO' }] });

    const select = client.query.mock.calls
      .map((c) => String(c[0]))
      .find((s) => /SELECT id, msd_code/i.test(s));
    expect(select).toBeDefined();
    expect(select).toMatch(/ORDER BY \(cmu_number = \$1\) DESC, id/i);

    expect(res.status).toBe(201);
    expect(res.body.updated).toBe(1);
    expect(res.body.refused).toBe(0);
    expect(updates(client)).toHaveLength(1);
    // L'écriture porte bien sur la fiche de l'agent (id 10), pas sur l'autre.
    expect(updates(client)[0]).toMatch(/WHERE id = \$1/);
    expect(client.query.mock.calls
      .find((c) => /^UPDATE/i.test(String(c[0]).trim()))[1][0]).toBe(10);
  });

  test('une erreur en cours d\'import ANNULE la transaction avant de rendre la connexion', async () => {
    const client = clientMock();
    client.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })            // BEGIN
      .mockRejectedValueOnce(new Error('connexion perdue'))        // SELECT de la boucle
      .mockResolvedValue({ rows: [], rowCount: 0 });              // ROLLBACK
    pool.connect.mockResolvedValue(client);

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentPknToken()}` })
      .send({ rows: [{ codeBeneficiaire: 'CMU-PKN-0000001', prenom: 'A' }] });

    const trace = statements(client);
    // Sans ROLLBACK, la connexion repartait au POOL avec une transaction
    // ouverte : les requêtes suivantes échouaient et un COMMIT tiers validait
    // les écritures partielles de l'import.
    expect(trace).toContain('ROLLBACK');
    expect(trace).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalled();
    // Le repli fichier a bien pris le relais (zéro perte).
    expect(res.body.mode).toBe('fallback-file');
    expect(res.body.inserted).toBe(1);
  });

  test('un journal d\'audit indisponible NE rejoue PAS l\'import dans le secours', async () => {
    const client = clientMock();
    client.query.mockResolvedValue({ rows: [], rowCount: 1 });
    pool.connect.mockResolvedValue(client);
    // Le COMMIT a réussi : les fiches SONT en base. Si l'écriture du journal
    // faisait tomber la route dans le repli, chaque fiche existerait deux fois
    // (base + store.json) et le secours finirait par être rejoué en base.
    query.mockImplementation(async (sql) => {
      if (/INSERT INTO audit_logs/i.test(String(sql))) throw new Error('audit_logs indisponible');
      return { rows: [], rowCount: 1 };
    });

    const res = await request(app)
      .post('/api/beneficiaries/bulk')
      .set({ Authorization: `Bearer ${agentPknToken()}` })
      .send({ rows: [{ codeBeneficiaire: 'CMU-PKN-0000001', prenom: 'A' }] });

    expect(res.status).toBe(201);
    expect(res.body.mode).toBe('database');
    expect(res.body.inserted).toBe(1);
    expect(inserts(client)).toHaveLength(1);
    expect(addRecord).not.toHaveBeenCalled();
  });
});

/**
 * Secours fichier : la MSD stockée en JSON doit survivre au rejeu en base, et
 * la fusion ne doit jamais effacer une valeur existante.
 *
 * `fs` est espionné : backend/data/store.json n'est ni lu ni écrit.
 */
describe('Secours fichier — mergeRecord et rejeu de la MSD', () => {
  const fs = require('fs');
  const fallbackStore = require('../fallbackStore');
  let contenuInitial;

  beforeEach(() => {
    contenuInitial = fs.readFileSync(fallbackStore.STORE_PATH, 'utf8');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'readFileSync').mockReturnValue(contenuInitial);
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Fabrique un store.json de test à partir d'une liste de bénéficiaires. */
  const storeJson = (beneficiaries) => JSON.stringify({
    adhesions: [], cotisations: [], donations: [], complaints: [], beneficiaries
  });

  test('une valeur VIDE n\'efface pas la fiche, _flushed et les champs absents survivent', () => {
    fs.readFileSync.mockReturnValue(storeJson([{
      cmuNumber: 'CMU-PKN-0000001', prenom: 'Amadou', nom: 'Sall',
      photoUrl: null, schoolName: 'Ecole Pikine', msdCode: 'PKN', _flushed: true
    }]));
    const fusion = fallbackStore.mergeRecord(
      'beneficiaries',
      (x) => x.cmuNumber === 'CMU-PKN-0000001',
      { prenom: '', nom: null, photoUrl: undefined, schoolName: '' }
    );
    expect(fusion.prenom).toBe('Amadou');
    expect(fusion._flushed).toBe(true);
    expect(fusion.schoolName).toBe('Ecole Pikine');
    expect(fusion.nom).toBe('Sall');
  });

  test('le rejeu en base conserve msd_code (cloisonnement)', async () => {
    // Fiche NON flushée : c'est elle que flushToDb rejoue.
    fs.readFileSync.mockReturnValue(storeJson([
      { cmuNumber: 'CMU-PKN-0000002', prenom: 'Fatou', msdCode: 'PKN' }
    ]));
    const requetes = [];
    await fallbackStore.flushToDb(async (sql, params) => {
      if (/^\s*INSERT/i.test(String(sql))) requetes.push({ sql, params });
      return { rows: [] };
    });

    const insert = requetes.find((r) => /INSERT INTO beneficiaries/i.test(r.sql));
    expect(insert).toBeDefined();
    const colonnes = insert.sql.slice(insert.sql.indexOf('(') + 1, insert.sql.indexOf(')'))
      .split(',').map((c) => c.trim());
    expect(colonnes).toContain('msd_code');
    // 14 colonnes = 14 placeholders : un décalage décalerait la valeur.
    const placeholders = [...insert.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(placeholders).toEqual(colonnes.map((_, i) => i + 1));
    expect(insert.params[colonnes.indexOf('msd_code')]).toBe('PKN');
  });
});

/**
 * Secours fichier — exposition HTTP du secours.
 *
 * Ces deux routes étaient ouvertes à TOUT le monde : `GET /api/beneficiaries/
 * fallback` renvoyait la totalité du secours (noms, téléphones, adresses, NIN,
 * photos base64) pour toutes les MSD, et déclenchait au passage des INSERT en
 * base. `GET /api/fallback-status` exposait le chemin du fichier de secours.
 *
 * ⚠️ backend/data/store.json est un fichier RÉEL du projet : il ne doit jamais
 * être modifié par une suite de tests. On n'espionne donc que les deux lectures
 * du module (`listRecords`, `readStore`) — `fs` n'est jamais appelé par ces
 * routes tant que les espions sont en place.
 */
describe('Secours fichier — routes d\'exposition', () => {
  const fallbackStore = require('../fallbackStore');

  const agentPknToken = () => jwt.sign(
    { id: 12, role: 'agent', username: 'agent@pkn.cmu.sn', msdCode: 'PKN' },
    JWT_SECRET, { expiresIn: '1h' }
  );
  const authAgentPkn = () => ({ Authorization: `Bearer ${agentPknToken()}` });

  // Fiches d'agents concurrents, toutes présentes sur le disque.
  const SECOURS = [
    { cmuNumber: 'CMU-PKN-0000001', prenom: 'Fatou', nom: 'Sall', msdCode: 'PKN' },
    // Pas de `msdCode` : MSD déduite du préfixe → PKN, la fiche reste visible.
    { cmuNumber: 'CMU-PKN-0000009', prenom: 'Moussa', nom: 'Ba' },
    // Autre MSD, rattachée : invisible pour l'agent PKN.
    { cmuNumber: 'CMU-DKR-0000004', prenom: 'Ibrahima', nom: 'Diop', msdCode: 'DKR' },
    // Autre MSD, sans rattachement, préfixe connu : également invisible.
    { cmuNumber: 'CMU-DKR-0000005', prenom: 'Awa', nom: 'Ndiaye' },
    // Ni `msdCode` ni préfixe reconnu : fail-closed → invisible (voir le
    // commentaire de `fallbackRecordMsd` dans server.js).
    { cmuNumber: 'ZZZ-XX-0000001', prenom: 'Inconnu', nom: 'Rattachement' }
  ];

  let flushToDb;

  beforeEach(() => {
    jest.spyOn(fallbackStore, 'listRecords').mockImplementation(
      (collection) => (collection === 'beneficiaries' ? SECOURS : [])
    );
    jest.spyOn(fallbackStore, 'readStore').mockReturnValue({
      adhesions: [], cotisations: [], donations: [], complaints: [],
      beneficiaries: SECOURS
    });
    flushToDb = jest.spyOn(fallbackStore, 'flushToDb')
      .mockResolvedValue({ flushed: 0, remaining: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    query.mockReset();
  });

  describe('GET /api/beneficiaries/fallback', () => {
    test('sans jeton → 401', async () => {
      const res = await request(app).get('/api/beneficiaries/fallback');
      expect(res.status).toBe(401);
      expect(flushToDb).not.toHaveBeenCalled();
    });

    test('avec jeton citoyen → 403', async () => {
      const res = await request(app).get('/api/beneficiaries/fallback').set(authCitizen);
      expect(res.status).toBe(403);
      expect(flushToDb).not.toHaveBeenCalled();
    });

    test('avec jeton agent PKN → 200, cloisonné sur SA MSD', async () => {
      const res = await request(app).get('/api/beneficiaries/fallback').set(authAgentPkn());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);

      const cmus = res.body.records.map((r) => r.cmuNumber);
      expect(cmus).toContain('CMU-PKN-0000001');   // msdCode explicite
      expect(cmus).toContain('CMU-PKN-0000009');   // MSD déduite du préfixe
      // Aucune fiche d'une autre MSD, rattachée ou non, ni à rattachement inconnu.
      expect(cmus).not.toContain('CMU-DKR-0000004');
      expect(cmus).not.toContain('CMU-DKR-0000005');
      expect(cmus).not.toContain('ZZZ-XX-0000001');

      // AUCUNE donnée d'une autre MSD ne fuit, pas même par un champ annexe.
      const corps = JSON.stringify(res.body);
      for (const nom of ['Ibrahima', 'Awa', 'Inconnu', 'Diop', 'Ndiaye']) {
        expect(corps).not.toContain(nom);
      }
    });

    test('le Super Admin supervise toutes les MSD, y compris les fiches non rattachées', async () => {
      const res = await request(app).get('/api/beneficiaries/fallback').set(authAdmin);
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(SECOURS.length);
    });

    test('un GET n\'écrit plus en base : le rejeu est une route POST', async () => {
      const res = await request(app).get('/api/beneficiaries/fallback').set(authAgentPkn());
      expect(res.status).toBe(200);
      expect(flushToDb).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/beneficiaries/fallback/flush', () => {
    test('sans jeton → 401', async () => {
      const res = await request(app).post('/api/beneficiaries/fallback/flush');
      expect(res.status).toBe(401);
      expect(flushToDb).not.toHaveBeenCalled();
    });

    test('avec jeton agent → 403 (le rejeu est transverse, pas par MSD)', async () => {
      const res = await request(app).post('/api/beneficiaries/fallback/flush').set(authAgentPkn());
      expect(res.status).toBe(403);
      expect(flushToDb).not.toHaveBeenCalled();
    });

    test('avec jeton admin → 200 et rejeu effectif', async () => {
      flushToDb.mockResolvedValue({ flushed: 3, remaining: 1 });
      const res = await request(app).post('/api/beneficiaries/fallback/flush').set(authAdmin);
      expect(res.status).toBe(200);
      expect(res.body.flushed).toBe(3);
      expect(res.body.remaining).toBe(1);
      expect(flushToDb).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/fallback-status', () => {
    test('sans jeton → 401', async () => {
      const res = await request(app).get('/api/fallback-status');
      expect(res.status).toBe(401);
    });

    test('avec jeton citoyen → 403', async () => {
      const res = await request(app).get('/api/fallback-status').set(authCitizen);
      expect(res.status).toBe(403);
    });

    test('avec jeton agent → 200 et compteurs (aucun enregistrement renvoyé)', async () => {
      const res = await request(app).get('/api/fallback-status').set(authAgentPkn());
      expect(res.status).toBe(200);
      expect(res.body.counts.beneficiaries).toBe(SECOURS.length);
      // Des compteurs, pas des fiches : aucun nom/NIN/photo dans le statut.
      expect(res.body.records).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('Fatou');
    });
  });
});
