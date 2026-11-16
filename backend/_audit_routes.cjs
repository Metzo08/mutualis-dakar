/* Inventaire des routes montées (audit Phase 2). Usage : node _audit_routes.cjs */
const fs = require('fs');
const files = ['additionalRoutes.js', 'dynamicRoutes.js', 'advancedRoutes.js', 'extendedRoutes.js', 'clinicalRoutes.js', 'kadevRoutes.js', 'csuRoutes.js', 'studioRoutes.js', 'cardLifecycleRoutes.js'];
for (const f of files) {
  const t = fs.readFileSync(__dirname + '/' + f, 'utf8');
  const m = [...t.matchAll(/router\.(get|post|put|delete)\((['"`])([^'"`]+)\2/g)];
  console.log('=== ' + f + ' : ' + m.length + ' routes ===');
  m.forEach(x => console.log('  ' + x[1].toUpperCase() + ' ' + x[3]));
}
