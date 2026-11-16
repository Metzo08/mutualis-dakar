/** Sonde 15 : le middleware du router réel isolé. */
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

// On prend la PREMIÈRE couche (middleware auth) et on l'exécute à la main.
const authLayer = router.stack[0];

const app = express();
app.use((req, res, next) => {
  console.log('exécution manuelle du middleware auth…');
  try {
    authLayer.handle(req, res, (e) => { console.log('middleware auth terminé, err =', e && e.message); next(e); });
  } catch (err) {
    console.log('EXCEPTION dans le middleware auth :', err.message);
    res.status(500).end();
  }
});
app.use((req, res) => { console.log('APRES — le middleware a passé la main'); res.status(404).end(); });

const token = jwt.sign({ id: 23, role: 'Super Admin', username: 'x' }, process.env.JWT_SECRET);
setTimeout(() => { console.log('GARDE'); process.exit(2); }, 8000);
(async () => {
  const res = await request(app).get('/api/security/alerts').set('Authorization', `Bearer ${token}`);
  console.log('status =', res.status);
  process.exit(0);
})();
