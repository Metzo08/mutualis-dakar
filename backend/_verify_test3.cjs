/** Test ciblé : vérification de restauration sur le dump de test existant. */
process.env.DISABLE_BACKUP_SCHEDULER = '1';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const backupService = require('./backupService');

(async () => {
  const file = path.join(__dirname, '_testdump.dump');
  console.log('vérification de', path.basename(file), '(' + Math.round(fs.statSync(file).size / 1024) + ' Ko)…');
  const t0 = Date.now();
  const cfg = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || '5432',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    db: process.env.DB_NAME || 'MUTUALIS DAKAR',
  };
  const r = await backupService.verifyRestore(file, cfg, 'test-manuel');
  console.log('terminé en', Math.round((Date.now() - t0) / 1000), 's :', r.ok ? 'VÉRIFIÉE' : 'ÉCHEC');
  console.log(r.message);
  if (r.tables) console.log(JSON.stringify(r.tables));
  process.exit(0);
})().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
