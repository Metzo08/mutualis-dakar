/* Répare les accents (double encodage UTF-8) d'un fichier texte. Usage : node _fix_mojibake.cjs <fichier> */
const fs = require('fs');
const p = process.argv[2];
if (!p) { console.error('usage: node _fix_mojibake.cjs <fichier>'); process.exit(1); }
let t = fs.readFileSync(p, 'utf8');

// Double encodage : chaque caractère accentué a été lu latin-1 puis réécrit UTF-8.
// Séquence de remplacements (les paires UTF-8 lues comme latin-1 → le vrai caractère).
const pairs = [
  ['ÃƒÂ©', 'é'], ['ÃƒÂ¨', 'è'], ['ÃƒÂª', 'ê'], ['ÃƒÂ ', 'à'], ['ÃƒÂ¢', 'â'],
  ['ÃƒÂ®', 'î'], ['ÃƒÂ¯', 'ï'], ['ÃƒÂ´', 'ô'], ['ÃƒÂ»', 'û'], ['ÃƒÂ¹', 'ù'],
  ['ÃƒÂ§', 'ç'], ['Ãƒ\u2030', 'É'], ['Ãƒ\u2039', 'Ë'],
  ['Ã¢‚¬', '—'], ['Ã¢â‚¬â€\x9d', '”'], ['Ã¢â‚¬Å“', '“'], ['Ã¢â‚¬â„¢', '’'],
  ['Ãƒ\u0161', 'û'],
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ãª', 'ê'], ['Ã ', 'à'], ['Ã¢', 'â'],
  ['Ã®', 'î'], ['Ã¯', 'ï'], ['Ã´', 'ô'], ['Ã»', 'û'], ['Ã¹', 'ù'],
  ['Ã§', 'ç'], ['Ã\u2030', 'É'], ['Ã\u2039', 'Ë'], ['Ã\u2030', 'É'],
  ['Ã\u2013', 'Ö'],
];
for (const [bad, good] of pairs) t = t.split(bad).join(good);

fs.writeFileSync(p, t, 'utf8');
const reste = (t.match(/Ã[^\x00-\x7F]/g) || []).length;
console.log('mojibake restants :', reste);
