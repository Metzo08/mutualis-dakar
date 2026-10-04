/**
 * ═══════════════════════════════════════════════════════════════════════
 *  APPARIEMENT VILLE DE DAKAR PAR PREFIXE DE FICHIER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * PROBLÈME
 * Les fichiers du dossier « Photos ville de Dakar » ne portent pas de code
 * bénéficiaire, seulement un rang : « 1.0 Anta Lo.jpeg ». L'appariement par nom
 * ne couvrait que 89 fiches sur 136 — 47 cartes restaient sans photo.
 *
 * PISTE RETENUE
 * Le préfixe « A.B » encodes la FAMILLE (A) et le RANG (B) de la fiche. Une
 * vérification précédente montre que 156 photos sur 166 ont un préfixe
 * cohérent avec un code existant. Reste à prouver que A.B désigne bien la
 * fiche « …A.B » — et non un homonyme d'une autre famille.
 *
 * MÉTHODE
 * On compare, pour chaque photo, le nom qu'elle porte au nom de la fiche visée
 * par le préfixe. On ne suppose rien : on compte.
 *
 * AUCUNE ÉCRITURE.
 *
 * Usage : node backend/audit-prefixe-vdd.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { query, pool } = require('./db');

const PHOTO_DIR = 'C:/Users/hp/Downloads/Photos ville de Dakar';
const CLASSEUR = 'C:/Users/hp/Downloads/AMEVI.xlsx';

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const normalizeName = (s) => clean(s).toUpperCase().replace(/[^A-Z]/g, '');

const splitFullName = (prenom, nom) => {
  const p = clean(prenom).toUpperCase();
  const n = clean(nom).toUpperCase();
  if (!p) return { firstName: '', lastName: n };
  if (!n) return { firstName: p, lastName: '' };
  if (p.endsWith(n) && p !== n) return { firstName: p.slice(0, -n.length).trim(), lastName: n };
  return { firstName: p, lastName: n };
};
(async () => {
  try {
    const XLSX = require('xlsx');

    // Toutes les lignes du CLASSEUR, pas seulement celles en base : le préfixe
    // doit se vérifier contre la source de vérité.
    const wb = XLSX.readFile(CLASSEUR, { cellDates: true });
    const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      .filter((r) => clean(r.CODE_BENEFICIAIRE));
    console.log(`Lignes du classeur AMEVI : ${lignes.length}`);

    const parCode = new Map();
    const richesse = (x) => Object.values(x || {}).filter((v) => clean(v)).length;
    lignes.forEach((r) => {
      const code = clean(r.CODE_BENEFICIAIRE).toUpperCase();
      const m = code.match(/^(.*)\.(\d+)$/);
      if (!m) return;
      const [, famille, rang] = m;
      if (!parCode.has(famille)) parCode.set(famille, new Map());
      // Code en double : on garde la ligne la plus riche, comme bulkImport.
      const existant = parCode.get(famille).get(rang);
      if (!existant || richesse(r) > richesse(existant)) parCode.get(famille).set(rang, r);
    });
    console.log(`Familles de codes : ${parCode.size}`);

    const fichiers = fs.existsSync(PHOTO_DIR)
      ? fs.readdirSync(PHOTO_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
      : [];
    console.log(`Photos : ${fichiers.length}\n`);

    // ── Que désigne réellement le préfixe de chaque photo ? ────────────────
    const confirmes = [];
    const differents = [];
    const introuvables = [];

    fichiers.forEach((fichier) => {
      const m = fichier.match(/^(\d+)\.(\d+)\s+(.+)\.[^.]+$/);
      if (!m) { introuvables.push({ fichier, raison: 'nom illisible' }); return; }
      const [, famille, rang, nomFichier] = m;
      const nomPhoto = normalizeName(nomFichier);

      // Quelle famille de codes finit par ce nombre ?
      const cibles = [];
      parCode.forEach((rangs, base) => {
        const n = base.replace(/\D/g, '');
        if (n !== famille && !n.endsWith(famille)) return;
        const l = rangs.get(rang);
        if (l) cibles.push({ base, l });
      });
      if (cibles.length === 0) { introuvables.push({ fichier, raison: 'aucun code pour ce prefixe' }); return; }

      // Le nom de la photo correspond-il à UNE des fiches désignées ?
      const concordantes = cibles.filter(({ l }) => {
        const n = splitFullName(l.PRENOM_BENEFICIAIRE, l.NOM_BENEFICIAIRE);
        return normalizeName(`${n.firstName}${n.lastName}`) === nomPhoto;
      });

      if (concordantes.length === 1) {
        const l = concordantes[0].l;
        confirmes.push({
          fichier,
          code: clean(l.CODE_BENEFICIAIRE),
          nom: `${clean(l.PRENOM_BENEFICIAIRE)} ${clean(l.NOM_BENEFICIAIRE)}`,
        });
      } else if (concordantes.length > 1) {
        differents.push({
          fichier,
          raison: `plusieurs fiches portent ce nom (${concordantes.length})`,
          noms: concordantes.map(({ l }) => clean(l.CODE_BENEFICIAIRE)),
        });
      } else {
        differents.push({
          fichier,
          raison: 'le nom de la photo ne correspond pas',
          noms: cibles.map(({ l }) => `${clean(l.CODE_BENEFICIAIRE)} ${clean(l.PRENOM_BENEFICIAIRE)} ${clean(l.NOM_BENEFICIAIRE)}`),
        });
      }
    });

    console.log('=== RESULTAT ===');
    console.log(`  prefixe CONFIRME par le nom : ${confirmes.length}`);
    console.log(`  prefixe NON confirme        : ${differents.length}`);
    console.log(`  photo inexploitable         : ${introuvables.length}`);
    const codes = new Set(confirmes.map((c) => c.code));
    console.log(`  fiches distinctes couvertes : ${codes.size}`);

    console.log('\n=== NON CONFIRMEES (echantillon) ===');
    differents.slice(0, 20).forEach((d) => {
      console.log(`  ${d.fichier}`);
      console.log(`      ${d.raison}`);
      (d.noms || []).slice(0, 3).forEach((n) => console.log(`        cible : ${n}`));
    });
    if (differents.length > 20) console.log(`  … +${differents.length - 20}`);

    console.log('\n=== INEXPLOITABLES ===');
    introuvables.slice(0, 12).forEach((d) => console.log(`  ${d.fichier}  (${d.raison})`));

    await pool.end();
  } catch (e) {
    console.error('ERREUR :', e.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();