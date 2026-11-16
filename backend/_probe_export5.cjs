/** Sonde 5 : probe de l'authentification du router, étape par étape. */
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_for_testing_only_1234567890';
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_PIPER = '1';

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === './db' || request.endsWith('/db')) {
    return { query: async () => ({ rows: [] }), pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }) } };
  }
  return origLoad.apply(this, arguments);
};

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

const { authenticateToken } = require('./rbac');
console.log('[sonde] rbac chargé');

const app = express();
app.use(express.json());
app.use('/api/security', (req, res, next) => { console.log('[sonde] avant authenticateToken'); authenticateToken(req, res, (e) => { console.log('[sonde] après authenticateToken'); next(e); }); });
app.use('/api/security', (req, res) => { console.log('[sonde] handler final, role =', req.user && req.user.role); res.json({ ok: true }); });

const token = jwt.sign({ id: 23, role: 'Super Admin', username: 'super@cmu.sn' }, process.env.JWT_SECRET);

setTimeout(() => { console.log('GARDE 10 s'); process.exit(2); }, 10000);

(async () => {
  const res = await request(app).get('/api/security/test').set('Authorization', `Bearer ${token}`);
  console.log('status =', res.status, JSON.stringify(res.body));
  process.exit(0);
})();
