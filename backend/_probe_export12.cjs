/** Sonde 12 : le router réel, avec db MOCKÉ, en ciblant /api/security/alerts uniquement. */
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_for_testing_only_1234567890';
process.env.NODE_ENV = 'test';

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === './db' || request.endsWith('/db')) {
    return {
      query: async (sql) => { console.log('[query]', String(sql).slice(0, 60).replace(/\s+/g, ' ')); return { rows: [] }; },
      pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }) },
    };
  }
  return origLoad.apply(this, arguments);
};

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { router } = require('./securityCenterRoutes');

const app = express();
app.use(router);

const token = jwt.sign({ id: 23, role: 'Super Admin', username: 'x' }, process.env.JWT_SECRET);
setTimeout(() => { console.log('GARDE 8 s'); process.exit(2); }, 8000);
(async () => {
  console.log('probe12 démarré');
  const res = await request(app).get('/api/security/alerts').set('Authorization', `Bearer ${token}`);
  console.log('status =', res.status, JSON.stringify(res.body).slice(0, 200));
  process.exit(0);
})();
