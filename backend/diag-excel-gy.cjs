/* Lit MSD de Grand Yoff.xlsx : colonnes disponibles pour l'appariement
   nom + naissance ↔ fiche en base. Lecture seule. */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const path = require('path');
const XLSX = require('xlsx');

(async () => {
  const wb = XLSX.readFile(path.join(__dirname, '..', 'MSD de Grand Yoff.xlsx'), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  console.log('Feuille :', wb.SheetNames[0]);
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log('Lignes :', rows.length);
  console.log('Colonnes :', Object.keys(rows[0]).join(' | '));
  console.log('\nÉchantillon 3 lignes :');
  rows.slice(0, 3).forEach((r) => console.log(JSON.stringify(r, null, 1).slice(0, 400)));

  // Exemple des 60 fiches concernées : retrouver une ligne par nom.
  const ex = rows.find((r) => /ADAMA WILLIER/i.test(Object.values(r).join(' ')));
  if (ex) console.log('\nLigne ADAMA WILLIER :', JSON.stringify(ex).slice(0, 400));
  await new Promise(() => { });
})();
