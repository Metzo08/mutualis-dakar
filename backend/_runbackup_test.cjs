/** Test ciblé : runBackup manuel, puis vérification de restauration du dump produit. */
process.env.DISABLE_BACKUP_SCHEDULER = '1';
require('dotenv').config();
const backupService = require('./backupService');

(async () => {
  const t0 = Date.now();
  const r = await backupService.runBackup({ verify: true, actor: 'test-manuel' });
  console.log('runBackup terminé en', Math.round((Date.now() - t0) / 1000), 's :', r.ok ? 'OK' : 'ÉCHEC');
  console.log(r.message || JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
})().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
