/**
 * ═══════════════════════════════════════════════════════════════════════
 *  AUDIT D'APPARIEMENT — PHOTOS VILLE DE DAKAR
 * ═══════════════════════════════════════════════════════════════════════
 *
 * POURQUOI CE SCRIPT
 * Le dossier « Photos ville de Dakar » nomme ses fichiers
 * « 1.0 Adjaratou Ndeye DEME.jpeg » : il n'y a PAS de code bénéficiaire dans
 * le nom, seulement un rang (« lot.rang ») et une identité. L'appariement ne
 * peut donc se faire que par le NOM — nettement moins sûr que par code.
 *
 * Une photo placée sur la mauvaise carte fait passer une personne réelle pour
 * quelqu'un d'autre. Ce script simule l'appariement et liste :
 *   - les correspondances certaines ;
 *   - les photos qui.restent ambiguës ;
 *   - les fiches sans photo et les photos inutilisées.
 *
 * AUCUNE ÉCRITURE. La base n'est pas modifiée.
 *
 * Usage : node backend/audit-appariement-vdd.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { query, pool } = require('./db');

const PHOTO_DIR = 'C:/Users/hp/Downloads/Photos ville de Dakar';

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const normalizeName = (s) => clean(s).toUpperCase().replace(/[^A-Z]/g, '');

/**
 * Découpe un nom complet en prénom / nom, comme bulkImport.js.
 * Gère les prénoms composés : « MOUSTAPHA NDIONE » avec nom « NDIONE ».
 */
const splitFullName = (prenom, nom) => {
  const p = clean(prenom).toUpperCase();
  const n = clean(nom).toUpperCase();
  if (!p) return { firstName: '', lastName: n };
  if (!n) return { firstName: p, lastName: '' };
  // « MOUSTAPHA NDIONE » + « NDIONE » : le prénom répète le nom.
  if (p.endsWith(n) && p !== n) return { firstName: p.slice(0, -n.length).trim(), lastName: n };
  return { firstName: p, lastName: n };
};
(async () => {
  try {
    // ── 1. Les fiches de VILLE DE DAKAR en base ──────────────────────────────
    const { rows: fiches } = await query(`
      select cmu_number, first_name, last_name, phone, nin, birth_date
        from beneficiaries
       where merged_into is null and lot_code = 'LOT-2026-010'
       order by cmu_number`);
    console.log(`Fiches Ville de Dakar en base : ${fiches.length}`);

    // ── 2. Les photos du disque ────────────────────────────────────────────
    const fichiers = fs.existsSync(PHOTO_DIR)
      ? fs.readdirSync(PHOTO_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
      : [];
    console.log(`Photos dans le dossier : ${fichiers.length}`);
    if (fichiers.length === 0) {
      console.log('\nAucun fichier photo : verifiez le chemin.');
      await pool.end();
      return;
    }

    // ── 3. Index, mêmes règles que le navigateur (bulkImport.js) ───────────
    const index = fichiers.map((nomFichier) => {
      const base = nomFichier.replace(/\.[^.]+$/, '');
      const sansRang = base.replace(/^\d{1,3}(?:\.\d{1,3})?\s+/, '');
      const codeMatch = base.match(/^([A-Za-z]{2,4})[_\-\s](\d{4,8})(\.\d+)?/);
      return {
        fichier: nomFichier,
        aUnCode: Boolean(codeMatch),
        personNorm: normalizeName(codeMatch ? base.slice(codeMatch[0].length) : sansRang),
      };
    });
    const avecCode = index.filter((p) => p.aUnCode).length;
    console.log(`\nFormat des noms de fichiers :`);
    console.log(`  « 1.0 Prenom NOM.jpeg » (rang + identite) : ${index.length - avecCode}`);
    console.log(`  « CODE_… Prenom NOM.jpeg » (code + identite) : ${avecCode}`);

    // ── 4. Appariement par ordre de confiance ──────────────────────────────
    const used = new Set();
    const resultats = [];
    const parRegle = {};

    fiches.forEach((f) => {
      const noms = splitFullName(f.first_name, f.last_name);
      const nameNorm = normalizeName(`${noms.firstName}${noms.lastName}`);
      const lastNorm = normalizeName(noms.lastName);

      // 1) Nom complet exact.
      let m = index.find((p) => !used.has(p.fichier) && p.personNorm && p.personNorm === nameNorm);
      let regle = m ? 'nom complet' : '';

      // 2) Nom composé : le fichier porte un second prénom absent du classeur
      //    (« Adjaratou Ndeye DEME » pour ADJARATOU / DEME).
      if (!m && nameNorm.length >= 6 && lastNorm.length >= 2) {
        m = index.find((p) => !used.has(p.fichier) && p.personNorm &&
          p.personNorm.startsWith(nameNorm.slice(0, lastNorm.length)) &&
          p.personNorm.endsWith(lastNorm) &&
          p.personNorm.length > nameNorm.length);
        if (m) regle = 'nom compose';
      }

      if (m) { used.add(m.fichier); parRegle[regle] = (parRegle[regle] || 0) + 1; }
      resultats.push({ fiche: f, photo: m ? m.fichier : null, regle });
    });

    const apparies = resultats.filter((r) => r.photo);
    const sansPhoto = resultats.filter((r) => !r.photo);
    const inutilisees = index.filter((p) => !used.has(p.fichier));

    console.log('\n=== RESULTAT DE LA SIMULATION ===');
    console.log(`  fiches appariees   : ${apparies.length}/${fiches.length}`);
    Object.entries(parRegle).forEach(([k, v]) => console.log(`      ${k} : ${v}`));
    console.log(`  fiches SANS photo  : ${sansPhoto.length}`);
    console.log(`  photos NON utilisees: ${inutilisees.length}`);

    // ── 5. Photos partageant le même nom : risque d'inversion ──────────────
    const parNom = new Map();
    index.forEach((p) => {
      if (!parNom.has(p.personNorm)) parNom.set(p.personNorm, []);
      parNom.get(p.personNorm).push(p.fichier);
    });
    const homonymes = [...parNom.entries()].filter(([, l]) => l.length > 1);
    console.log(`\n=== MEME NOM POUR PLUSIEURS PHOTOS (a verifier) ===`);
    if (homonymes.length === 0) console.log('  (aucune)');
    homonymes.slice(0, 10).forEach(([nom, l]) => {
      console.log(`  ${nom}`);
      l.forEach((f) => {
        const c = apparies.find((r) => r.photo === f);
        console.log(`      ${f}  ->  ${c ? clean(c.fiche.cmu_number) + ' ' + c.fiche.first_name + ' ' + c.fiche.last_name : 'NON UTILISEE'}`);
      });
    });

    console.log('\n=== ECHANTILLON (12 premiers) ===');
    apparies.slice(0, 12).forEach((r) => {
      console.log(`  ${clean(r.fiche.cmu_number).padEnd(16)} ${clean(r.fiche.first_name)} ${clean(r.fiche.last_name)}`);
      console.log(`      <- ${r.photo}   [${r.regle}]`);
    });

    if (sansPhoto.length) {
      console.log(`\n=== FICHES SANS PHOTO (${sansPhoto.length}) ===`);
      sansPhoto.slice(0, 12).forEach((r) => console.log(
        `  ${clean(r.fiche.cmu_number).padEnd(16)} ${clean(r.fiche.first_name)} ${clean(r.fiche.last_name)}`));
      if (sansPhoto.length > 12) console.log(`  … +${sansPhoto.length - 12}`);
    }

    if (inutilisees.length) {
      console.log(`\n=== PHOTOS NON UTILISEES (${inutilisees.length}) ===`);
      inutilisees.slice(0, 12).forEach((p) => console.log(`  ${p.fichier}`));
      if (inutilisees.length > 12) console.log(`  … +${inutilisees.length - 12}`);
    }

    // ── 6. Le préfixe « 1.N » encode-t-il le code de la fiche ? ──────────────
    // Question décisive : si « 1.4 » recouvre toujours le rang .4 de la même
    // famille, l'appariement peut se faire PAR CODE — aussi sûr que pour
    // ASS LONASE — au lieu d'une simple comparaison de nom.
    console.log('\n=== TEST : le prefixe de fichier correspond-il au code ? ===');
    const parCode = new Map();
    fiches.forEach((f) => {
      const m = clean(f.cmu_number).match(/^(.*)\.(\d+)$/);
      if (!m) return;
      const [, base, rang] = m;
      if (!parCode.has(base)) parCode.set(base, new Set());
      parCode.get(base).add(rang);
    });
    console.log(`  familles de codes : ${parCode.size}`);

    let testables = 0;
    let coherents = 0;
    const discordants = [];
    index.forEach((p) => {
      const m = p.fichier.match(/^(\d+)\.(\d+)\s+/);
      if (!m) return;
      const [, famille, rang] = m;
      const candidats = [...parCode.entries()].filter(([base]) => {
        const n = base.replace(/\D/g, '');
        return n === famille || n.endsWith(famille);
      });
      if (candidats.length === 0) return;
      testables += 1;
      if (candidats.some(([, rangs]) => rangs.has(rang))) coherents += 1;
      else discordants.push(p.fichier);
    });
    console.log(`  photos testables            : ${testables}`);
    console.log(`  prefixe coherent avec un code: ${coherents}`);
    console.log(`  prefixe SANS code correspondant: ${discordants.length}`);
    discordants.slice(0, 8).forEach((f) => console.log(`      ${f}`));

    await pool.end();
  } catch (e) {
    console.error('ERREUR :', e.message);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();