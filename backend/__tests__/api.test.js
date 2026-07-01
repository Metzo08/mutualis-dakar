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
    expect(res.body.response.toLowerCase()).toContain('nanga def');
  });
});

describe('TTS déprécié', () => {
  test('GET /api/tts → 410 Gone', async () => {
    const res = await request(app).get('/api/tts?text=hello');
    expect(res.status).toBe(410);
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
