const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.js');
let content = fs.readFileSync(file, 'utf8');

const oldLine = "    const isWolof = (lang === 'wo' || lang === 'wolof' || /\\b(nanga|jamm|ndax|nak|wer-gi-yaram|waxtu|firi|dimbali|sant|bëgg|leeral|léegi)\\b/i.test(cleanText));";
const newLine = "    const isWolof = (lang === 'wo' || lang === 'wolof' || /(ngoon|nanga|j[aà]mm|naka|suba|guddi|ndax|wer-gi-yaram|waxtu|firi|dimbali|b[eë]gg|l[eé]egi|sant)/i.test(cleanText));";

if (content.includes(oldLine)) {
  content = content.replace(oldLine, newLine);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully updated isWolof in handleTtsRequest');
} else {
  console.warn('Old line not found');
}
