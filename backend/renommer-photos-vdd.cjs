/**
 * ═══════════════════════════════════════════════════════════════════════
 *  RENOMMAGE RÉEL — PHOTOS VILLE DE DAKAR
 * ═══════════════════════════════════════════════════════════════════════
 *
 * OBJECTIF
 * Donner aux 124 photos le nom du modèle ASS LONASE (« DKR_260001.0 NOM
 * PRENOM.jpeg ») afin que l'import se fasse PAR CODE, donc sans risque
 * d'inversion. Voir RENOMMAGE-PHOTOS.xlsx pour la liste complète.
 *
 * SÉCURITÉ — AUCUN ÉCRASEMENT N'EST POSSIBLE
 *   1. Le renommage se fait dans un COPIE du dossier d'origine. Les fichiers
 *      sources ne sont jamais modifiés : une erreur resterait réversible.
 *   2. Si le nom cible existe déjà, le fichier est ignoré et signalé.
 *   3. Si deux sources produisent le même nom cible, les DEUX sont ignorés.
 *   4. Le compte de fichiers doit rester identique avant / après.
 *
 * Usage :
 *   node backend/renommer-photos-vdd.cjs            (simulation)
 *   node backend/renommer-photos-vdd.cjs --apply    (renommage réel)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');

const CLASSEUR_RENOM = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD DAKAR/RENOMMAGE-PHOTOS.xlsx';
const SOURCE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar';
const CIBLE = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES';

const APPLY = process.argv.includes('--apply');

const classeur = XLSX.readFile(CLASSEUR_RENOM);
const lignes = XLSX.utils.sheet_to_json(classeur.Sheets['1 VILLE DE DAKAR'], { defval: '' });

// La colonne CODE_BENEFICIAIRE est renseignée uniquement pour un renommage sûr :
// elle est vide pour tout ce qui doit rester à trancher.
const propositions = lignes.filter((r) => String(r['CODE_BENEFICIAIRE'] || '').trim());
console.log(`Propositions dans le classeur : ${propositions.length}`);

// ── Gardes : le nom cible ne doit pas déjà exister, ni être proposé 2 fois ─
const presents = new Set(fs.readdirSync(SOURCE).map((f) => f.toUpperCase()));
const cibles = new Map();        // nom cible -> [sources]
const retenus = [];
const ecartes = [];

propositions.forEach((r) => {
  const ancien = r['Ancien nom'];
  const nouveau = r['Nouveau nom'];
  if (!fs.existsSync(path.join(SOURCE, ancien))) {
    ecartes.push({ ancien, motif: 'source absente du dossier' });
    return;
  }
  // Un nom déjà pris par un AUTRE fichier : ne surtout pas écraser.
  if (presents.has(String(nouveau).toUpperCase()) && String(nouveau).toUpperCase() !== String(ancien).toUpperCase()) {
    ecartes.push({ ancien, motif: `le nom cible existe déjà : ${nouveau}` });
    return;
  }
  if (!cibles.has(nouveau)) cibles.set(nouveau, []);
  cibles.get(nouveau).push({ ancien, motif: 'deux fichiers proposed le même nom' });
});

// Un même nom proposé deux fois : rien n'est fait, l'agent tranche.
const doublons = new Set([...cibles.entries()].filter(([, l]) => l.length > 1).map(([n]) => n));
doublons.forEach((n) => {
  cibles.get(n).forEach((x) => ecartes.push({ ancien: x.ancien, motif: `nom cible en double : ${n}` }));
});

propositions.forEach((r) => {
  if (ecartes.some((e) => e.ancien === r['Ancien nom'])) return;
  retenus.push({ ancien: r['Ancien nom'], nouveau: r['Nouveau nom'], code: r['CODE_BENEFICIAIRE'] });
});

console.log(`  retenus  : ${retenus.length}`);
console.log(`  écartés  : ${ecartes.length}`);
ecartes.slice(0, 10).forEach((e) => console.log(`    ${e.ancien}  — ${e.motif}`));

const avant = fs.readdirSync(SOURCE).length;
console.log(`\nFichiers source : ${avant}`);
console.log(`Cible            : ${CIBLE}`);

if (!APPLY) {
  console.log('\nSIMULATION — aucun fichier renommé, aucune copie.');
  console.log('Relancez avec --apply.');
  return;
}

// ── Copie complète du dossier, puis renommage DANS la copie ──────────────
if (fs.existsSync(CIBLE)) {
  console.log('\nLa copie existe déjà : supprimez-la ou renommez-la avant de relancer.');
  process.exit(1);
}
fs.mkdirSync(CIBLE, { recursive: true });
fs.readdirSync(SOURCE).forEach((f) => fs.copyFileSync(path.join(SOURCE, f), path.join(CIBLE, f)));

let renommes = 0;
retenus.forEach(({ ancien, nouveau }) => {
  const de = path.join(CIBLE, ancien);
  const vers = path.join(CIBLE, nouveau);
  // Ultime filet : on ne renomme que si la destination est libre.
  if (fs.existsSync(vers)) return;
  fs.renameSync(de, vers);
  renommes += 1;
});

const apres = fs.readdirSync(CIBLE).length;
console.log(`\nFichiers renommés dans la copie : ${renommes}/${retenus.length}`);
console.log(`Fichiers dans la copie : ${apres} (source : ${avant})`);
console.log(`Intégrité : ${apres === avant ? 'OK — aucun fichier perdu' : 'ÉCHEC'}`);

if (apres !== avant) {
  console.log('\n⚠️  Le compte a changé : la copie est suspecte, ne l\'utilisez pas.');
} else {
  console.log(`\nDossier prêt : ${CIBLE}`);
  console.log('\nLes fichiers D\'ORIGINE sont intacts et inchangés.');
}
