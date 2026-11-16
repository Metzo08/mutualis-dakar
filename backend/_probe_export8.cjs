/** Sonde 8 : invoque le router à la main, comme Express le ferait. */
process.env.JWT_SECRET = 'test_jwt_secret_at_least_32_characters_long_for_testing_only_1234567890';
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_PIPER = '1';

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === './db' || request.endsWith('/db')) {
    return {
      query: async (sql) => {
        console.log('[query]', String(sql).slice(0, 50).replace(/\s+/g, ')); return { rows: [] }; }, pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }) } };
  }
  return origLoad.apply(this, arguments);
    };

    const { router } = require('./securityCenterRoutes');

    // Fausses req/res express
    const express = require('express');
    const jwt = require('jsonwebtoken');

    setTimeout(() => { console.log('GARDE 5 s'); process.exit(2); }, 5000);

    const app = express();
    app.use((req, res, next) => { console.log('avant router, path =', req.url); next(); });
    app.use(router);
    app.use((req, res) => { console.log('APRES'); res.status(404).end(); });
    // handler d'erreur
    app.use((err, req, res, next) => { console.log('ERREUR Express :', err && err.message); res.status(500).end(); });

    const token = jwt.sign({ id: 23, role: 'Super Admin', username: 'x' }, process.env.JWT_SECRET);

    (async () => {
      const request = require('supertest');
      const res = await request(app).get('/api/security/alerts').set('Authorization', `Bearer ${token}`);
      console.log('status =', res.status);
      process.exit(0);
    })();
