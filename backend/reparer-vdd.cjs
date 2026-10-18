/**
 * ═══════════════════════════════════════════════════════════════════════
 *  RÉPARATION LOT VILLE DE DAKAR (LOT-2026-030) — rattachement par IDENTITÉ
 * ═══════════════════════════════════════════════════════════════════════
 *  Les photos AMEVI sont nommées « X.M Prénom(s) Nom » (X = ménage local,
 *  M = membre). Le préfixe X.M du fichier n'est PAS un index fiable de
 *  correspondance directe avec les codes DKR_2600NNN.M : l'appariement se
 *  fait par IDENTITÉ.
 *
 *  Méthode (les codes et les cartes ne sont JAMAIS modifiés) :
 *   1. candidats = fichiers dont tous les mots appartiennent à l'identité
 *      de la fiche (troncatures acceptées, aucun mot étranger), nom de
 *      famille obligatoire ;
 *   2. rejet si le fichier porte une date de naissance différente ;
 *   3. homonymes résiduels : désambiguïsation par le ménage — le ménage
 *      réel de chaque fichier X est fixé par la fiche adhérent (X.0) déjà
 *      photographiée dont l'identité est unique ;
 *   4. exactement 1 candidat → rattachement.
 *
 *  Garde-fous : une fiche déjà pourvue n'est jamais touchée ; un fichier
 *  ne sert qu'une seule fiche ; aucune écriture sans plan validé.
 *  Usage : node backend/reparer-vdd.cjs [--apply]
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { query, pool } = require('./db');

const DIRS = [
  // RENOMMÉES en priorité : nommage le plus fiable (codes + index locaux complets)
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar RENOMMEES',
  'C:/Users/hp/Downloads/MUTUALIS DAKAR/Photos AMEVI ville de Dakar',
];
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

const extraireDates = (txt) => {
  const out = [];
  for (const m of txt.matchAll(/(\d{1,2})[-\/ ](\d{1,2})[-\/ ](\d{2,4})/g)) {
    let y = m[3]; if (y.length === 2) y = (Number(y) > 30 ? '19' : '20') + y;
    out.push(`${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  }
  return out;
};

(async () => {
  // ── 1. Index des fichiers ───────────────────────────────────────────
  // Trois formats : « N.M Prénom Nom » (index local de ménage),
  // « DKR_2600NNN.M Prénom Nom » (code complet — rattachement DIRECT),
  // « Prénom Nom » seul (identité seule).
  const fichiers = [];
  const vu = new Set();
  for (const dir of DIRS) {
    for (const f of fs.readdirSync(dir)) {
      if (!/\.(jpe?g|png|webp)$/i.test(f)) continue;
      const sansExt = f.replace(/\.(jpe?g|png|webp)$/i, '');
      const mc = sansExt.match(/^(DKR_2600\d+\.\d+)\s+(.+)$/i);          // code complet
      const mi = sansExt.match(/^(\d+)\.(\d+)\s+(.+)$/);                   // index local
      let cle, codeDirect = null, menage = null, membre = null, nomPart;
      if (mc) {
        cle = mc[1].toUpperCase();
        codeDirect = mc[1].toUpperCase();
        nomPart = mc[2];
      } else if (mi) {
        // ⚠️ clé locale DOIT inclure le nom : le même N.M existe dans les
        // deux dossiers avec des PERSONNES DIFFÉRENTES (renommage partiel).
        // La clé « LN.M » écraserait l'autre personne → clé = N.M + nom.
        menage = parseInt(mi[1], 10); membre = parseInt(mi[2], 10);
        nomPart = mi[3];
        cle = `L${menage}.${membre} ${norm(nomPart.replace(/\d{1,2}[-\/ ]\d{1,2}[-\/ ]\d{2,4}/g, ''))}`.trim();
      } else {
        continue; // sans préfixe : ignoré (une seule photo, déjà traitée)
      }
      if (vu.has(cle)) continue;
      vu.add(cle);
      const dates = extraireDates(nomPart);
      const mots = norm(nomPart.replace(/\d{1,2}[-\/ ]\d{1,2}[-\/ ]\d{2,4}/g, '')).split(' ').filter(Boolean);
      fichiers.push({ cle, codeDirect, menage, membre, dir, f, mots, dates });
    }
  }
  console.log('Fichiers indexés :', fichiers.length,
    '| code complet :', fichiers.filter((x) => x.codeDirect).length,
    '| index local :', fichiers.filter((x) => !x.codeDirect).length);
  const utilisePrecedent = new Set(); // rempli en section 3 (photos déjà écrites)

  // ── 2. Fiches LOT-2026-030 sans photo ───────────────────────────────
  const fiches = await query(
    `SELECT id, cmu_number, first_name, last_name, birth_date, numero_adherent
       FROM beneficiaries
      WHERE lot_code='LOT-2026-030' AND merged_into IS NULL
        AND (photo_url IS NULL OR photo_url='')
      ORDER BY cmu_number`
  );
  console.log('Fiches sans photo :', fiches.rows.length);

  // ── 3. Ménage réel de chaque fichier X : via les adhérents (X.0)
  //       déjà photographiés, appariés par identité unique ──────────────
  const avecPhoto = await query(
    `SELECT cmu_number, first_name, last_name, birth_date, numero_adherent, photo_url
       FROM beneficiaries
      WHERE lot_code='LOT-2026-030' AND merged_into IS NULL
        AND photo_url IS NOT NULL AND photo_url <> ''`
  );
  const normNomFiche = (b) => norm(`${b.first_name} ${b.last_name}`).split(' ').filter(Boolean);
  const menageFichier = new Map(); // menageLocal → code adhérent base
  // Contenus des photos DÉJÀ écrites (lot 030) : un fichier dont le contenu
  // est déjà en base ne peut jamais resservir (homonymes .6/.7 d'un ménage).
  for (const img of fichiers.filter((x) => x.membre === 0)) {
    const cands = avecPhoto.rows.filter((b) => {
      const motsF = normNomFiche(b);
      return !img.mots.some((w) => !motsF.some((mf) => mf.startsWith(w) || w.startsWith(mf)));
    });
    if (cands.length === 1) {
      menageFichier.set(img.menage, String(cands[0].numero_adherent || cands[0].cmu_number).replace(/\.\d+$/, ''));
    }
  }
  console.log('Ménages fichier→base identifiés :', menageFichier.size);
  // Marque comme consommés les fichiers dont le CONTENU (base64) existe
  // déjà en base pour une autre fiche du lot.
  const contenusEcrits = new Set(
    avecPhoto.rows.map((b) => {
      const m = String(b.photo_url).match(/^data:image\/[a-z]+;base64,(.+)$/s);
      return m ? m[1] : String(b.photo_url);
    })
  );
  let bloques = 0;
  for (const img of fichiers) {
    if (img.codeDirect) continue;
    try {
      const b64 = fs.readFileSync(path.join(img.dir, img.f)).toString('base64');
      if (contenusEcrits.has(b64)) {
        utilisePrecedent.add(img.cle);
        bloques++;
      }
    } catch { /* fichier illisible : ignoré */ }
  }
  console.log('Fichiers locaux déjà consommés (écrits antérieurs) :', bloques);

  // ── 4. Appariement des fiches sans photo ──────────────────────
  // Priorité absolue : le fichier porte le CODE COMPLET de la fiche
  // (ex. « DKR_2600010.11 AMINATA SOW.jpeg »). C'est le lien parfait,
  // le nom ne sert qu'à CONFIRMER (jamais à contredire seule).
  const plan = [];
  const ecart = [], reste = [];
  const utilise = new Set(utilisePrecedent); // fichiers déjà écrits antérieurement
  for (const fiche of fiches.rows) {
    const motsF = normNomFiche(fiche);
    const birth = String(fiche.birth_date || '');
    let cands = fichiers.filter((img) => {
      if (utilise.has(img.cle)) return false;
      // Un fichier portant un CODE COMPLET différent appartient à une autre
      // fiche : il ne peut jamais servir ici (les cartes sont déjà imprimées).
      if (img.codeDirect && img.codeDirect !== String(fiche.cmu_number).toUpperCase()) return false;
      if (img.mots.some((w) => !motsF.some((mf) => mf.startsWith(w) || w.startsWith(mf)))) return false;
      const nomFamille = motsF[motsF.length - 1];
      if (!img.mots.some((w) => w === nomFamille || nomFamille.startsWith(w) || w.startsWith(nomFamille))) return false;
      if (img.dates.length > 0 && img.dates.every((d) => d !== birth)) return false;
      return true;
    });
    // A. Rattachement DIRECT par code complet (meilleur candidat)
    const direct = cands.filter((c) => c.codeDirect === String(fiche.cmu_number).toUpperCase());
    if (direct.length === 1) {
      const img = direct[0];
      utilise.add(img.cle);
      plan.push({ fiche, img });
      console.log(`OK* ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] <- ${img.f} (code complet)`);
      continue;
    }
    if (direct.length > 1) { ecart.push([fiche, direct]); continue; }
    if (cands.length === 0) { reste.push([fiche, 'aucun candidat']); continue; }
    if (cands.length > 1) {
      const menageBase = String(fiche.numero_adherent || fiche.cmu_number).replace(/\.\d+$/, '');
      const candsM = cands.filter((c) => menageFichier.get(c.menage) === menageBase);
      if (candsM.length === 1) cands = candsM;
      else { ecart.push([fiche, cands]); continue; }
    }
    const img = cands[0];
    utilise.add(img.cle);
    plan.push({ fiche, img });
    console.log(`OK  ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} [${birth}] <- ${img.f}`);
  }

  // ── 4 bis. Troisième tour : typos d'identité (tolérance 1 caractère)
  //   Uniquement pour les fiches encore vides. Garde-fous renforcés :
  //   • nom de famille EXACT OU À 1 CARACTÈRE (ABOU/ABDOU, BOUBACAR/BABACAR) ;
  //   • aucun mot étranger du fichier (même tolérance) ;
  //   • le suffixe .M du fichier correspond au suffixe de la fiche ET
  //     l'adhérent du ménage fichier (menageFichier) pointe vers le
  //     ménage base de la fiche — si ce ménage fichier est connu.
  const lev = (a, b) => {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 9;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  };
  const proche = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && lev(a, b) <= 1);

  const resteApres1 = [];
  for (const [fiche, raison] of reste) {
    const motsF = normNomFiche(fiche);
    const nomFamille = motsF[motsF.length - 1];
    const menageBase = String(fiche.numero_adherent || fiche.cmu_number).replace(/\.\d+$/, '');
    const suffixeFiche = String(fiche.cmu_number).split('.').pop();
    let cands = fichiers.filter((img) => {
      if (utilise.has(img.cle)) return false;
      if (img.codeDirect && img.codeDirect !== String(fiche.cmu_number).toUpperCase()) return false;
      if (!img.mots.some((w) => proche(w, nomFamille))) return false;
      const etranger = img.mots.filter((w) => !motsF.some((mf) => proche(w, mf)));
      if (etranger.length > 0) return false;
      // suffixe membre : si connu (fichier local), doit correspondre
      if (img.membre !== null && Number(suffixeFiche) !== img.membre) return false;
      // ⚠️ PAS de contrainte de ménage ici : le préfixe « 1. » du dossier
      // AMEVI n'est pas un index de ménage fiable entre les deux dossiers
      // (renommage partiel). Les autres garde-fous (suffixe .M, nom proche,
      // contenu unique, date) suffisent.
      if (img.dates.length > 0 && img.dates.every((d) => d !== String(fiche.birth_date || ''))) return false;
      return true;
    });
    if (cands.length === 1) {
      const img = cands[0];
      utilise.add(img.cle);
      plan.push({ fiche, img });
      console.log(`OK~ ${fiche.cmu_number} ${fiche.first_name} ${fiche.last_name} <- ${img.f} (typo)`);
    } else {
      resteApres1.push([fiche, cands.length > 1 ? `ambigu : ${cands.map((c) => c.f).join(' | ')}` : raison]);
    }
  }

  console.log(`\n=== PLAN : ${plan.length} rattachables, ${ecart.length} homonymes, ${resteApres1.length} sans candidat ===`);
  ecart.forEach(([f, c]) => console.log(`HOMONYME ${f.cmu_number} ${f.first_name} ${f.last_name} : ${c.map((x) => x.f).join(' | ')}`));
  resteApres1.forEach(([f, r]) => console.log(`RESTE   ${f.cmu_number} ${f.first_name} ${f.last_name} → ${r}`));

  // ── 5. Application (optionnelle) ────────────────────────────────────
  if (process.argv.includes('--apply')) {
    let ecrits = 0;
    for (const { fiche, img } of plan) {
      const ext = path.extname(img.f).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const dataUrl = `data:${mime};base64,${fs.readFileSync(path.join(img.dir, img.f)).toString('base64')}`;
      const res = await query(
        `UPDATE beneficiaries SET photo_url=$1
          WHERE id=$2 AND (photo_url IS NULL OR photo_url='')`,
        [dataUrl, fiche.id]
      );
      if (res.rowCount === 1) ecrits++;
    }
    console.log(`\nÉcrits : ${ecrits}/${plan.length}`);
  }
  await pool.end();
})().catch((e) => { console.error('ERREUR :', e.stack); pool.end().catch(() => {}); process.exit(1); });
