const fs = require('fs');
const p = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/src/views/Partnership.jsx';
let content = fs.readFileSync(p, 'utf8');
const oldTarget = "{ name: 'PATISEN', logo: '/logo_partner_patisen.png', isImage: true },";
const newTarget = `{ name: 'PATISEN', logo: '/logo_partner_patisen.png', isImage: true },
  { name: 'OLA ENERGY', logo: '/logo_ola_energy.png', isImage: true },
  { name: 'SOCOTEC', logo: '/logo_socotec.png', isImage: true },`;
content = content.replace(oldTarget, newTarget);
fs.writeFileSync(p, content, 'utf8');
console.log('Partnership updated:', content.includes('OLA ENERGY'));
