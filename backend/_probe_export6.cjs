/** Sonde 6 : le module securityMonitor directement. */
process.env.JWT_SECRET = 'x';
process.env.NODE_ENV = 'test';
process.env.DISABLE_AUTO_PIPER = '1';

const Module = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  if (request === './db' || request.endsWith('/db')) {
    console.log('[sonde] db mocké pour', request);
    return { query: async (sql) => { console.log('[sonde] query appelée :', String(sql).slice(0, 60).replace(/\n/g, ' ')); return { rows: [] }; }, pool: { connect: async () => ({ query: async () => ({ rows: [] }), release: () => { } }) } };
  }
  return origLoad.apply(this, arguments);
};

const { securityAlerts } = require('./securityMonitor');
console.log('[sonde] securityMonitor chargé');

setTimeout(() => { console.log('GARDE 10 s'); process.exit(2); }, 10000);

(async () => {
  console.log('appel securityAlerts...');
  const alerts = await securityAlerts(null, []);
  console.log('alerts =', alerts.length);
  process.exit(0);
})();
