/** Test complet : sauvegarde + vérification de restauration (base réelle). */
process.env.DISABLE_BACKUP_SCHEDULER = '1';
require('dotenv').config();
const backupService = require('./backupService');

(async () => {
  console.log('sauvegarde + vérification en cours…');
  const t0 = Date.now();
  const r = await backupService.runBackup({ verify: true, actor: 'test-manuel' });
  console.log('terminé en', Math.round((Date.now() - t0) / 1000), 's');
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})().catch((e) => { console.error('ECHEC :', e.message); process.exit(1); });
