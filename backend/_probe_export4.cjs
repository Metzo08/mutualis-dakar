/** Sonde 4 : teste les middlewares du router étape par étape. */
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_for_testing_only_1234567890';
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_PIPER = '1';

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === './db' || request.endsWith('/db')) {
    console.log('[sonde] db mocké');
    return { query: async () => ({ rows: [] }), pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }) } };
  }
  return origLoad.apply(this, arguments);
};

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { router } = require('./securityCenterRoutes');
console.log('[sonde] router chargé, type =', typeof router, '— stack ?');

const app = express();
app.use(express.json());
app.use((req, res, next) => { console.log('[sonde] avant router'); next(); });
app.use(router);
app.use((req, res) => { console.log('[sonde] APRES router — 404'); res.status(404).json({ error: 'pas de route' }); });

const token = jwt.sign({ id: 23, role: 'Super Admin', username: 'super@cmu.sn' }, process.env.JWT_SECRET);

setTimeout(() => { console.log('GARDE 10 s'); process.exit(2); }, 10000);

(async () => {
  console.log('probe4 démarré');
  const t0 = Date.now();
  try {
    const res = await request(app).get('/api/security/alerts').set('Authorization', `Bearer ${token}`);
    console.log('status =', res.status, 'en', Date.now() - t0, 'ms', JSON.stringify(res.body).slice(0, 150));
  } catch (e) { console.log('ERR', e.message); }
  process.exit(0);
})();
