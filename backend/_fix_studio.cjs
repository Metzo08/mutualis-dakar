/* Réparation ponctuelle de studioRoutes.js : mojibake résiduel (— é — « » etc.) */
const fs = require('fs');
const p = process.argv[2] || 'backend/studioRoutes.js';
let t = fs.readFileSync(p, 'utf8');
const pairs = [
  ['Ã ', 'à'],
  ['â€”', '—'],
  ['â†’', '→'],
  ['Â«', '«'],
  ['Â»', '»'],
  ['Â§', '§'],
  ['â”€', '─'],
  ['â•', '═'],
];
for (const [bad, good] of pairs) t = t.split(bad).join(good);
fs.writeFileSync(p, t, 'utf8');
const reste = (t.match(/[ÃÂâ][^\x00-\x7F]/g) || []).length;
console.log('mojibake restants :', reste);
