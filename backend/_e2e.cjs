/**
 * Test de bout en bout (manuel, base réelle) :
 *   1. connexion Super Admin ;
 *   2. sauvegarde + vérification de restauration via l'API ;
 *   3. état des sauvegardes dans le centre de sécurité ;
 *   4. activation MFA sur un compte admin (sans SMTP : doit refuser proprement).
 */
process.env.DISABLE_BACKUP_SCHEDULER = '1';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_prod_min_32_chars';

const jwt = require('jsonwebtoken');
const request = require('supertest');

(async () => {
  process.stdout.write('chargement du serveur…\n');
  const app = require('./server.js');
  await new Promise((r) => setTimeout(r, 4000)); // laisse les migrations finir

  const token = jwt.sign({ id: 1, role: 'Super Admin', username: 'test-superadmin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

  process.stdout.write('\n[1] GET /api/security/backups\n');
  const st = await request(app).get('/api/security/backups').set('Authorization', `Bearer ${token}`);
  console.log('status', st.status, JSON.stringify(st.body).slice(0, 300));

  process.stdout.write('\n[2] POST /api/security/backups/run (avec vérification)\n');
  const run = await request(app).post('/api/security/backups/run').set('Authorization', `Bearer ${token}`).send({});
  console.log('status', run.status, JSON.stringify(run.body).slice(0, 400));

  process.stdout.write('\n[3] GET /api/security/overview (contrôles backup/MFA)\n');
  const ov = await request(app).get('/api/security/overview').set('Authorization', `Bearer ${token}`);
  const controls = (ov.body && ov.body.controls) || [];
  for (const c of controls.filter((x) => ['backup', 'mfa'].includes(x.id))) {
    console.log(`${c.id}: ${c.status} — ${c.detail}`);
  }

  process.stdout.write('\n[4] POST /api/security/mfa/1/enable (sans SMTP : refus attendu avec message clair)\n');
  const mfa = await request(app).post('/api/security/mfa/1/enable').set('Authorization', `Bearer ${token}`).send({});
  console.log('status', mfa.status, JSON.stringify(mfa.body).slice(0, 250));

  process.exit(0);
})().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
