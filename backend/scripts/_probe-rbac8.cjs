  /* Espionne guard() réellement exécuté : quel req.user voit-il ? */
process.env.PORT = '5068';
require('dotenv').config();
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server.js');
const svc = require('../accountCardService');

// Remplace temporairement canUseAccountsPage pour tracer ses appels.
const orig = svc.canUseAccountsPage;
let calls = 0;
svc.canUseAccountsPage = function traced(user) {
  calls += 1;
  console.log('canUseAccountsPage appelé avec', JSON.stringify(user));
  return orig(user);
};

const t = jwt.sign({ id: 1, role: 'agent', username: 'probe', msdCode: 'PKN' }, process.env.JWT_SECRET, { expiresIn: '1h' });

(async () => {
  const r = await request(app).post('/api/accounts/search').set({ Authorization: `Bearer ${t}` }).send({ nom: 'X' });
  console.log('final', r.status, '| appels tracés :', calls);
  process.exit(0);
})();
