/** Colonnes du classeur AMEVI : existe-t-il un lien vers le fichier photo ? */
const XLSX = require('xlsx');

const wb = XLSX.readFile('C:/Users/hp/Downloads/AMEVI.xlsx', { cellDates: true });
console.log('Feuilles :', wb.SheetNames.join(', '));
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
console.log(`Lignes : ${rows.length}\n`);
console.log('=== COLONNES ===');
Object.keys(rows[0] || {}).forEach((c) => console.log(`  ${c}`));

console.log('\n=== 2 LIGNES COMPLETES ===');
rows.slice(0, 2).forEach((r) => {
  Object.entries(r).forEach(([k, v]) => {
    if (String(v || '').trim()) console.log(`  ${String(k).padEnd(26)} = ${v}`);
  });
  console.log('  ---');
});

// ── La colonne PHOTO est-elle le lien vers le fichier image ? ────────────
const avecPhoto = rows.filter((r) => String(r.PHOTO || '').trim());
console.log(`\n=== COLONNE PHOTO : ${avecPhoto.length} lignes renseignees sur ${rows.length} ===`);
console.log('\nExemples :');
avecPhoto.slice(0, 12).forEach((r) => {
  console.log(`  ${String(r.CODE_BENEFICIAIRE).padEnd(16)} ${String(r.PHOTO).slice(0, 70)}`);
});

/* Extraction des noms de fichiers à partir de la valeur PHOTO
   (cellule Excel : chemin, ou nom de fichier seul). */
const nomsPhoto = avecPhoto.map((r) => {
  const v = String(r.PHOTO).trim();
  const base = v.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  return { code: String(r.CODE_BENEFICIAIRE).trim(), nomFichier: base };
});

console.log('\n=== VERIFICATION : le nom de PHOTO existe-t-il dans le dossier ? ===');
const fs = require('fs');
const dossier = 'C:/Users/hp/Downloads/Photos ville de Dakar';
const surDisque = fs.existsSync(dossier)
  ? fs.readdirSync(dossier).map((f) => f.replace(/\.[^.]+$/, ''))
  : [];
console.log(`fichiers sur disque : ${surDisque.length}`);

const normaliser = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const disqueNorm = new Set(surDisque.map(normaliser));
let trouves = 0;
const absents = [];
nomsPhoto.forEach(({ code, nomFichier }) => {
  if (disqueNorm.has(normaliser(nomFichier))) trouves += 1;
  else absents.push({ code, nomFichier });
});
console.log(`  nom retrouve sur disque : ${trouves}/${nomsPhoto.length}`);
console.log(`  nom ABSENT du dossier   : ${absents.length}`);
absents.slice(0, 10).forEach((a) => console.log(`      ${a.code.padEnd(16)} « ${a.nomFichier} »`));

// ── PISTE : le nom du fichier est-il une ABRÉVIATION du nom du classeur ? ──
// « 1.0 Ibrahima Dior Y Fall.jpeg » vs « IBRAHIMA DIOR YANDE FALL ».
// On teste si les INITIALES des mots se correspondent, dans le même ordre.
const fichiers = fs.readdirSync('C:/Users/hp/Downloads/Photos ville de Dakar')
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

/** Signature d'un nom : initiales des mots, dans l'ordre. */
const signature = (s) => String(s).toUpperCase()
  .replace(/[^A-Z ]/g, ' ')
  .split(/\s+/).filter(Boolean).map((m) => m[0]).join('');

const parSignature = new Map();
rows.forEach((r) => {
  const sig = signature(`${r.PRENOM_BENEFICIAIRE} ${r.NOM_BENEFICIAIRE}`);
  if (!sig) return;
  if (!parSignature.has(sig)) parSignature.set(sig, []);
  parSignature.get(sig).push(r);
});

console.log(`\n=== PISTE INITIALES : ${parSignature.size} signatures dans le classeur ===`);
let parSig = 0;
let parSigUnique = 0;
let aucune = 0;
const multi = [];
fichiers.forEach((f) => {
  const m = f.match(/^[\d.]+\s+(.+)\.[^.]+$/);
  if (!m) return;
  const sig = signature(m[1]);
  const hits = parSignature.get(sig) || [];
  if (hits.length === 0) { aucune += 1; return; }
  parSig += 1;
  if (hits.length === 1) parSigUnique += 1;
  else multi.push({ fichier: f, sig, codes: hits.slice(0, 4).map((h) => String(h.CODE_BENEFICIAIRE).trim()) });
});

console.log(`  photo dont les initiales existent au classeur : ${parSig}/${fichiers.length}`);
console.log(`      ... et désignent UNE SEULE fiche           : ${parSigUnique}`);
console.log(`      ... et désignent plusieurs fiches (risque)  : ${multi.length}`);
console.log(`  photo sans correspondance d'initiales         : ${aucune}`);

console.log('\n=== INITIALES AMBIGUES (a ne PAS apparier automatiquement) ===');
multi.slice(0, 12).forEach((x) => {
  console.log(`  ${x.fichier}  [${x.sig}]  -> ${x.codes.join(', ')}`);
});