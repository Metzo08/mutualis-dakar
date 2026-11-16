// Tests du fil de notifications réel (GET /api/notifications/feed).
// Vérifie qu'aucune donnée fictive n'est servie et que le cloisonnement
// citoyen / MSD / Super Admin est appliqué côté backend.
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../db', () => {
  const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
  const mockPool = { connect: jest.fn().mockResolvedValue({ query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() }) };
  return { query: mockQuery, pool: mockPool };
});
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: jest.fn() }))
}));

const { query } = require('../db');
const app = require('../server.js');

const SECRET = process.env.JWT_SECRET;
const bearer = (payload) => ({ Authorization: `Bearer ${jwt.sign(payload, SECRET, { expiresIn: '1h' })}` });

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
});

describe('GET /api/notifications/feed', () => {
  test('sans jeton → 401', async () => {
    const res = await request(app).get('/api/notifications/feed');
    expect(res.status).toBe(401);
  });

  test('base vide → liste vide (aucune donnée fictive)', async () => {
    const res = await request(app).get('/api/notifications/feed').set(bearer({ id: 1, role: 'citizen' }));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('citoyen : toutes les requêtes portent sur SON identifiant', async () => {
    query.mockImplementation(async (sql) => {
      if (/FROM beneficiaries WHERE id = \$1/.test(sql)) return { rows: [{ id: 42, phone: '770000042' }] };
      if (/FROM guarantee_letters/.test(sql)) {
        return { rows: [{ id: 7, validation_code: 'GAR-7', status: 'approved', at: new Date().toISOString() }] };
      }
      return { rows: [] };
    });
    const res = await request(app).get('/api/notifications/feed').set(bearer({ id: 42, role: 'citizen', phone: '779999999' }));
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('citizen');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].desc).toContain('GAR-7');
    expect(res.body.data[0].desc).toContain('validée');
    for (const [sql, params] of query.mock.calls) {
      if (/notifications|guarantee_letters|purchase_orders|claims|cotisations|FROM beneficiaries/.test(sql)) {
        expect(params).toEqual([42]);
      }
      // Réclamations : téléphone de la fiche en base, jamais celui du jeton
      if (/FROM complaints/.test(sql)) expect(params).toEqual(['770000042']);
    }
  });

  test('agent MSD : filtre sur msd_code de son jeton', async () => {
    const res = await request(app)
      .get('/api/notifications/feed')
      .set(bearer({ id: 10, role: 'Admin Régional', msdCode: 'THS' }));
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('THS');
    const staffCalls = query.mock.calls.filter(([sql]) => /b\.msd_code = \$1/.test(sql));
    expect(staffCalls.length).toBeGreaterThan(0);
    staffCalls.forEach(([, params]) => expect(params).toEqual(['THS']));
    // Pas d'alerte sécurité globale pour un agent MSD
    expect(query.mock.calls.some(([sql]) => /COMPTE_VERROUILLE/.test(sql))).toBe(false);
  });

  test('agent sans MSD de rattachement → aucune donnée (refus par défaut)', async () => {
    const res = await request(app).get('/api/notifications/feed').set(bearer({ id: 10, role: 'agent' }));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.scope).toBe('none');
    expect(query).not.toHaveBeenCalledWith(expect.stringMatching(/guarantee_letters/), expect.anything());
  });

  test('Super Admin : supervision globale + sécurité', async () => {
    query.mockImplementation(async (sql) => {
      if (/COMPTE_VERROUILLE/.test(sql)) return { rows: [{ n: '2', last_at: new Date().toISOString() }] };
      return { rows: [] };
    });
    const res = await request(app).get('/api/notifications/feed').set(bearer({ id: 11, role: 'Super Admin' }));
    expect(res.status).toBe(200);
    expect(res.body.scope).toBe('all');
    expect(res.body.data.some((n) => n.type === 'security')).toBe(true);
  });
});
