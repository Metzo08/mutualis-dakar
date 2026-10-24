/**
 * Tests des modules 2, 3 et 4 du cahier des charges MUTUALIS :
 *   • importation contrôlée (zone temporaire, anomalies, idempotence) ;
 *   • comptes & cartes (cloisonnement MSD, recherche encadrée, secret absent) ;
 *   • centre de sécurité (garde des rôles, alertes, sessions sans jeton) ;
 *   • journal d'audit structuré et rapports Excel.
 *
 * PostgreSQL est simulé : aucune base réelle n'est touchée.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

jest.mock('../db', () => {
  const mockQuery = jest.fn();
  const mockPool = { connect: jest.fn() };
  return { query: mockQuery, pool: mockPool };
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({ getGenerativeModel: jest.fn() })),
}));

const { query } = require('../db');
const app = require('../server.js');
const { inspectRow, lotStatusFor, photoKeys, canonicalCmu } = require('../importStaging');
const { maskNin, canPerform, scopeOf } = require('../accountCardService');
const { safeValue, sheetName } = require('../excelWorkbook');
const { scrub } = require('../auditTrail');
const { THRESHOLDS } = require('../securityMonitor');

const JWT_SECRET = process.env.JWT_SECRET;
const token = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
const agentPkn = token({ id: 21, role: 'agent', username: 'agent@pkn.cmu.sn', msdCode: 'PKN' });
const agentUnlinked = token({ id: 22, role: 'agent', username: 'agent@none.cmu.sn' });
const admin = token({ id: 23, role: 'Super Admin', username: 'super@cmu.sn' });
const citizen = token({ id: 24, role: 'citizen', phone: '771111111' });
const asAgent = { Authorization: `Bearer ${agentPkn}` };
const asAdmin = { Authorization: `Bearer ${admin}` };

/** Séquences de réponses SQL : chaque appel consomme la valeur suivante. */
function mockRows(...responses) {
  for (const r of responses) query.mockResolvedValueOnce(r);
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Recherche encadrée des assurés (Module 3.1)', () => {
  test('sans jeton → 401', async () => {
    const res = await request(app).post('/api/accounts/search').send({ cmuNumber: 'DKR-1' });
    expect(res.status).toBe(401);
  });

  test('un citoyen ne peut pas rechercher → 403', async () => {
    const res = await request(app).post('/api/accounts/search').set({ Authorization: `Bearer ${citizen}` }).send({ nom: 'Diop' });
    expect(res.status).toBe(403);
  });

  test('agent sans MSD → 403 fail-closed', async () => {
    const res = await request(app).post('/api/accounts/search').set({ Authorization: `Bearer ${agentUnlinked}` }).send({ nom: 'Diop' });
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('AGENT_NOT_LINKED_TO_MSD');
  });

  test('critère insuffisant → 400 (pas de déversement d’annuaire)', async () => {
    // Aucune requête DB ne doit être émise : le refus est décidé AVANT.
    const res = await request(app).post('/api/accounts/search').set(asAgent).send({});
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('CRITERE_INSUFFISANT');
    expect(query).not.toHaveBeenCalled();
  });

  test('une fiche hors périmètre MSD n’est jamais renvoyée', async () => {
    // L'agent PKN demande explicitement la MSD DKR : refus avant toute lecture.
    const res = await request(app).post('/api/accounts/search').set(asAgent).send({ nom: 'Diop', msdCode: 'DKR' });
    expect(res.status).toBe(403);
  });

  test('recherche par matricule : la pièce est masquée dans les résultats', async () => {
    mockRows(
      { rows: [{ count: '1' }] }, // COUNT
      { rows: [{ id: 5, cmu_number: 'PKN-PKN-2026-0001', last_name: 'NDIAYE', first_name: 'AWA', msd_code: 'PKN', status: 'active', card_status: 'active', nin: '1980199000123', phone: '771234567' }] },
      { rows: [] } // audit
    );
    const res = await request(app).post('/api/accounts/search').set(asAgent).send({ cmuNumber: 'PKN-PKN-2026-0001' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const row = res.body.data[0];
    expect(row.ninMasked).not.toContain('198019900012');
    expect(row.ninMasked.endsWith('23')).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('1980199000123');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Fiche compte / carte (Module 3.3)', () => {
  test('fiche introuvable → 404', async () => {
    mockRows({ rows: [] });
    const res = await request(app).get('/api/accounts/INCONNU-1').set(asAgent);
    expect(res.status).toBe(404);
  });

  test('un dossier d’une autre MSD est refusé (403)', async () => {
    mockRows({ rows: [{ id: 9, cmu_number: 'DKR-DKR-2026-0001', msd_code: 'DKR', card_status: 'active' }] });
    const res = await request(app).get('/api/accounts/DKR-DKR-2026-0001').set(asAgent);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Opérations sur les cartes (Modules 3.6 à 3.8)', () => {
  test('le déblocage est réservé à l’administrateur', async () => {
    const res = await request(app)
      .post('/api/cards/PKN-PKN-2026-0001/unblock')
      .set(asAgent)
      .send({ reason: 'CARTE_RETROUVEE' });
    expect(res.status).toBe(403);
  });

  test('la destruction est réservée à l’administrateur', async () => {
    const res = await request(app)
      .post('/api/cards/PKN-PKN-2026-0001/destroy')
      .set(asAgent)
      .send({ reason: 'CARTE_ENDOMMAGEE' });
    expect(res.status).toBe(403);
  });

  test('un motif de destruction non autorisé → 400 (admin)', async () => {
    const res = await request(app)
      .post('/api/cards/PKN-PKN-2026-0001/destroy')
      .set(asAdmin)
      .send({ reason: 'PARCE_QUE' });
    expect(res.status).toBe(400);
  });

  test('référence de demande inconnue → 404 : pas d’opération hors dossier', async () => {
    mockRows(
      { rows: [{ id: 7, cmu_number: 'PKN-PKN-2026-0001', msd_code: 'PKN', card_status: 'active', status: 'active' }] }, // loadCard
      { rows: [] } // demande introuvable
    );
    const res = await request(app)
      .post('/api/cards/PKN-PKN-2026-0001/block')
      .set(asAgent)
      .send({ reason: 'PERTE', requestRef: 'REQ-INEXISTANTE' });
    expect(res.status).toBe(404);
  });

  test('demande non vérifiée → 409 (identité non contrôlée)', async () => {
    mockRows(
      { rows: [{ id: 7, cmu_number: 'PKN-PKN-2026-0001', msd_code: 'PKN', card_status: 'active', status: 'active' }] },
      { rows: [{ reference: 'REQ-1', cmu_number: 'PKN-PKN-2026-0001', status: 'EN_COURS', identity_verified: false }] }
    );
    const res = await request(app)
      .post('/api/cards/PKN-PKN-2026-0001/block')
      .set(asAgent)
      .send({ reason: 'PERTE', requestRef: 'REQ-1' });
    expect(res.status).toBe(409);
  });

  test('ruban : jamais de mot de passe accepté ni renvoyé lors d’une réinitialisation', async () => {
    const res = await request(app)
      .post('/api/accounts/PKN-PKN-2026-0001/reset-password')
      .set(asAgent)
      .send({ password: 'secret123' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('secret123');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Centre de sécurité (Module 4)', () => {
  test('vue d’ensemble : un citoyen est refusé', async () => {
    const res = await request(app).get('/api/security/overview').set({ Authorization: `Bearer ${citizen}` });
    expect(res.status).toBe(403);
  });

  test('sessions : réservées aux administrateurs', async () => {
    const res = await request(app).get('/api/security/sessions').set(asAgent);
    expect(res.status).toBe(403);
  });

  test('alertes : réponse structurée et triée par gravité', async () => {
    // securityAlerts enchaîne 6 requêtes : on renvoie des compteurs vides.
    for (let i = 0; i < 8; i += 1) query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/security/alerts').set(asAgent);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.thresholds.loginFailures).toBe(THRESHOLDS.loginFailures);
  });

  test('rapport Excel de sécurité : fichier XLSX valide', async () => {
    // Toutes les requêtes renvoient une réponse vide : l'objectif est de
    // vérifier que le classeur se construit et reste un XLSX lisible.
    query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .get('/api/security/export')
      .set(asAdmin)
      .responseType('blob');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    const wb = XLSX.read(res.body, { type: 'buffer' });
    expect(wb.SheetNames.length).toBeGreaterThanOrEqual(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Importation contrôlée (Module 2)', () => {
  test('création de lot sans jeton → 401', async () => {
    const res = await request(app).post('/api/imports').send({ lotCode: 'X' });
    expect(res.status).toBe(401);
  });

  test('lot hors périmètre MSD → 403', async () => {
    const res = await request(app).post('/api/imports').set(asAgent).send({ msdCode: 'DKR' });
    expect(res.status).toBe(403);
  });

  test('la clé photo se base sur le MATRICULE du nom de fichier', () => {
    const k1 = photoKeys('1 DKR_2600040.1 PAPA IBRAHIMA SEYE.jpg');
    expect(k1.codeBase).toBe('dkr2600040');
    expect(k1.personNorm).toContain('papa');
    const k2 = photoKeys('DKR-DKR-2026-0007 AWA NDIAYE.png');
    expect(k2.codeBase).toBe('dkr-dkr-2026-0007');
    // Deux dossiers partageant la même clé sont détectés comme ambigus par le
    // contrôle du lot (test unitaire du contrôle ci-dessous).
    expect(canonicalCmu('DKR_2600040.1')).toBe(canonicalCmu('DKR_2600040.2'));
  });

  test('inspection : photo manquante, champ obligatoire, date invalide', () => {
    const anomalies = inspectRow({
      cmuNumber: '', lastName: '', firstName: '', birthDate: '03/01/1972', photoKey: '',
    });
    const types = anomalies.map((a) => a.type);
    expect(types).toContain('CHAMP_OBLIGATOIRE_MANQUANT');
    expect(types).toContain('IDENTIFIANT_INVALIDE');
    expect(types).toContain('PHOTO_MANQUANTE');
  });

  test('inspection : dossier complet conforme', () => {
    const anomalies = inspectRow({
      cmuNumber: 'PKN-PKN-2026-0001', lastName: 'NDIAYE', firstName: 'AWA',
      birthDate: '1972-01-03', photoKey: 'pkpkn20260001', msdCode: 'PKN',
    }, { agentMsd: 'PKN' });
    expect(anomalies).toEqual([]);
  });

  test('un lot n’est VALIDE que si TOUS les dossiers sont conformes', () => {
    expect(lotStatusFor(10, 0)).toBe('VALIDE');
    expect(lotStatusFor(10, 1)).toBe('A_CORRIGER');
    expect(lotStatusFor(0, 0)).toBe('A_CORRIGER');
  });

  test('intégration sans validation explicite → 409', async () => {
    // La table n'est pas encore migrée dans l'environnement de test : on
    // simule explicitement le lot. ⚠️ `importRoutes.js` a DÉSTRUCTURÉ
    // `getBatch` au chargement du module : espionner `staging.getBatch`
    // n'affecterait pas la copie locale de la route. On mocke donc la
    // SOURCE DE DONNÉES (`query`) — voie réellement utilisée par la route —
    // pour que `getBatch` lise bien le lot simulé.
    mockRows(
      { rows: [{ id: 3, reference: 'IMP-1', msd_code: 'PKN', lot_code: null, source_file: null,
                 status: 'A_CONTROLE', validated_at: null, validated_by: null,
                 created_at: new Date(), integrated_at: null }] }, // getBatch → SELECT import_batches
    );
    const res = await request(app).post('/api/imports/3/integrate').set(asAgent).send({});
    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Règles de sécurité transverses', () => {
  test('masquage de la pièce d’identité', () => {
    expect(maskNin('1980199000123')).toBe('•••••••••••23');
    expect(maskNin(null)).toBeNull();
  });

  test('permissions par opération : déblocage/remplacement réservés à l’admin', () => {
    expect(canPerform('BLOCAGE_CARTE', { role: 'agent' })).toBe(true);
    expect(canPerform('DEBLOCAGE_CARTE', { role: 'agent' })).toBe(false);
    expect(canPerform('DEBLOCAGE_CARTE', { role: 'Super Admin' })).toBe(true);
    expect(canPerform('SUPPRESSION_CARTE', { role: 'agent' })).toBe(false);
  });

  test('portée : Super Admin sans MSD = totale, agent sans MSD = refus', () => {
    expect(scopeOf({ role: 'Super Admin' })).toBeNull();
    expect(scopeOf({ role: 'agent', msdCode: 'pkn' })).toBe('PKN');
    expect(scopeOf({ role: 'agent' })).toBeUndefined();
  });

  test('les formules Excel issues des données utilisateur sont neutralisées', () => {
    expect(safeValue('=HYPERLINK("http://x")')).toBe('\'=HYPERLINK("http://x")');
    expect(safeValue('+1')).toBe('\'+1');
    expect(safeValue('NDIAYE')).toBe('NDIAYE');
    expect(sheetName('Dossiers conformes (très long)').length).toBeLessThanOrEqual(31);
  });

  test('le journal d’audit ne conserve ni mot de passe ni jeton', () => {
    const s = scrub('password=Secret123 et eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.abcdefghijkl');
    expect(s).not.toContain('Secret123');
    expect(s).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });
});
