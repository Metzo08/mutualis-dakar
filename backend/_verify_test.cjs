/** Test ciblé : vérification de restauration seule sur la sauvegarde existante. */
process.env.DISABLE_BACKUP_SCHEDULER = '1';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const backupService = require('./backupService');

(async () => {
  const dir = backupService.BACKUP_DIR;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.dump')).sort();
  if (files.length === 0) { console.log('aucune sauvegarde'); process.exit(1); }
  const file = path.join(dir, files[files.length - 1]);
  console.log('vérification de', files[files.length - 1], '(' + Math.round(fs.statSync(file).size / 1024) + ' Ko)…');
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
