/**
 * Deux défauts signalés sur la carte de MOUSTAPHA NDIONE :
 *  1. le prénom affiche « MOUSTAPHA NDIONE » — le nom est répété dans le champ
 *     prénom du classeur ;
 *  2. la photo ne s'affiche pas.
 *
 * On mesure sur les fichiers réels : combien de fiches portent ce doublon,
 * et combien de photos sont censées exister.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

const SOURCES = [
  { file: 'c:/Users/hp/Downloads/AMEVI.xlsx', label: 'Ville de Dakar (AMEVI)',
    photoDir: path.join('c:\\', 'Users', 'hp', 'Downloads', 'Photos ville de Dakar') },
  { file: 'c:/Users/hp/Downloads/ASS LONASE.xlsx', label: 'ASS LONASE',
    photoDir: path.join(__dirname, '..', 'ASS LONASE') },
  { file: 'c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx', label: 'MSD de Grand Yoff',
    photoDir: path.join(__dirname, '..', 'MSD de Grand Yoff') }
];

for (const s of SOURCES) {
  const wb = XLSX.readFile(s.file, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => clean(r.CODE_BENEFICIAIRE));

  // 1. Le prénom contient-il le nom ?
  const doublons = rows.filter((r) => {
    const p = norm(r.PRENOM_BENEFICIAIRE);
    const n = norm(r.NOM_BENEFICIAIRE);
    return n && p && p !== n && (p.endsWith(n) || p === n);
  });

  console.log(`\n=== ${s.label} ===`);
  console.log(`  fiches avec code            : ${rows.length}`);
  console.log(`  prenom contenant le nom     : ${doublons.length}`);
  doublons.slice(0, 6).forEach((r) => {
    console.log(`     PRENOM=${JSON.stringify(clean(r.PRENOM_BENEFICIAIRE))} NOM=${JSON.stringify(clean(r.NOM_BENEFICIAIRE))}`);
  });

  // 2. Photos : existe-t-il un fichier pour cette personne ?
  const files = s.photoDir && fs.existsSync(s.photoDir)
    ? fs.readdirSync(s.photoDir).filter((f) => /\.(jpe?g|png)$/i.test(f))
    : [];
  // Même normalisation que l'import (bulkImport.js) : retrait du préfixe de
  // RANG « 1.0 » et du nom répété dans le prénom.
  const normPhoto = (file) => norm(
    file.replace(/\.[^.]+$/, '').replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '')
  );
  const withPhoto = rows.filter((r) => {
    const p = norm(r.PRENOM_BENEFICIAIRE);
    const n = norm(r.NOM_BENEFICIAIRE);
    const first = (n && p !== n && p.endsWith(n)) ? p.slice(0, p.length - n.length) : p;
    const cible = first + n;
    return files.some((f) => normPhoto(f) === cible);
  });
  console.log(`  photos disponibles          : ${files.length}`);
  console.log(`  fiches Finds une photo      : ${withPhoto.length} / ${rows.length}`);

  const moustapha = rows.find((r) => clean(r.NOM_BENEFICIAIRE) === 'NDIONE');
  if (moustapha) {
    const nom = norm(`${clean(moustapha.PRENOM_BENEFICIAIRE)} ${clean(moustapha.NOM_BENEFICIAIRE)}`);
    const found = files.filter((f) => {
      const key = norm(f.replace(/\.(jpe?g|png)$/i, '').replace(/\s+(né|ne|née)\s+le.*$/i, '').replace(/\s+adresse.*$/i, ''));
      return key === nom || key.startsWith(nom) || norm(f).includes(nom);
    });
    console.log(`  NDIONE : recherche="${nom}" -> ${found.length} fichier(s)`);
    found.slice(0, 4).forEach((f) => console.log(`     ${f}`));
  }
}