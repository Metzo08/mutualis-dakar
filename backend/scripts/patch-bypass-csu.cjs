const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', '..', 'src', 'utils', 'phonetics.js');
let content = fs.readFileSync(file, 'utf8');

content = content.replace("'cmu', 'couverture'", "'cmu', 'csu', 'couverture'");

// Prononciation orale naturelle de CSU
const startFn = "export const convertWolofToFrenchPhonetics = (text) => {";
const addPronounce = `export const convertWolofToFrenchPhonetics = (text) => {
  if (!text) return '';
  text = String(text)
    .replace(/\\bCSU\\b/gi, 'cé ess ou')
    .replace(/\\bUNAMUSC\\b/gi, 'ounamousk')
    .replace(/\\bFCFA\\b/gi, 'francs cfa');`;

if (content.includes(startFn)) {
  content = content.replace(startFn, addPronounce);
  fs.writeFileSync(file, content, 'utf8');
  console.log('CSU phonetics updated in phonetics.js');
} else {
  console.warn('startFn not found');
}
