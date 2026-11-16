/** Sonde 7 : la route complète avec db mocké, en remontant la pile étape par étape. */
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_for_testing_only_1234567890';
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_PIPER = '1';

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === './db' || request.endsWith('/db')) {
    return { query: async (sql) => { console.log('[query]', String(sql).slice(0, 50).replace(/\s+/g, ' ')); return { rows: [] }; }, pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }) } };
  }
  return origLoad.apply(this, arguments);
};

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { router } = require('./securityCenterRoutes');

const app = express();
app.use(express.json());
app.use(router);
app.use((req, res) => { console.log('APRES router'); res.status(404).json({}); });

const token = jwt.sign({ id: 23, role: 'Super Admin', username: 'super@cmu.sn' }, process.env.JWT_SECRET);

setTimeout(() => { console.log('GARDE 10 s'); process.exit(2); }, 10000);

(async () => {
  console.log('probe7 démarré');
  const res = await request(app).get('/api/security/alerts').set('Authorization', `Bearer ${token}`);
  console.log('status =', res.status, JSON.stringify(res.body).slice(0, 150));
  process.exit(0);
})();
