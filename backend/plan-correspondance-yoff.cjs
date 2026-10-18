/**
 * PLAN DE CORRESPONDANCE LOT GRAND YOFF (LOT-2026-034) — LECTURE SEULE.
 *
 * Croise les photos du dossier avec les fiches du lot SANS photo, avec une
 * similarite TOLERANTE (fautes de frappe, decalage de date +-3 j). Produit
 * des propositions classees pour validation humaine (Ahmed Tall) :
 *   SUR    : correspondance quasi certaine (nom>=0.90, date<=3j, marge franche)
 *   MOYEN  : plausible, a verifier
 *   AMBIGU : plusieurs candidats proches, jamais auto-applique
 *   AUCUN  : aucune photo candidate
 *
 * N'ecrit RIEN en base. Usage : node backend/plan-correspondance-yoff.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');

const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD de Grand Yoff';
const LOT = 'LOT-2026-034';

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const norm = (v) => clean(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : clean(d).slice(0, 10));
const days = (a, b) => {
  if (!a || !b) return 999;
  const da = Date.parse(a); const db = Date.parse(b);
  if (isNaN(da) || isNaN(db)) return 999;
  return Math.abs(Math.round((da - db) / 86400000));
};

// Distance de Levenshtein puis similarite 0..1.
const lev = (a, b) => {
  const m = a.length; const n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};
const similaire = (a, b) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return Math.max(0, 1 - lev(a, b) / Math.max(a.length, b.length));
};

const parsePhoto = (name) => {
  const base = name.replace(/\.[^.]+$/, '');
  let m = base.match(/(\d{1,2})\s*[- ]\s*(\d{1,2})\s*[- ]\s*(\d{2,4})/);
  let date = null;
  if (m) {
    let y = m[3];
    if (y.length === 2) y = (Number(y) > 30 ? '19' : '20') + y;
    date = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  let ident = base;
  const idxNe = ident.search(/\b(n[ée]e?|né)\b/i);
  if (idxNe > 0) ident = ident.slice(0, idxNe);
  ident = ident.split(/\d{1,2}\s*[- ]\s*\d{1,2}/)[0].trim();
  return { name, date, identNorm: norm(ident) };
};


(async () => {
  try {
    const res = await query(
      `SELECT cmu_number, first_name, last_name, birth_date,
              (photo_url IS NOT NULL AND photo_url<>'') AS a_photo
         FROM beneficiaries
        WHERE lot_code=$1 AND merged_into IS NULL
        ORDER BY cmu_number`,
      [LOT]
    );
    const fiches = res.rows.map((f) => ({
      cmu_number: f.cmu_number,
      a_photo: f.a_photo,
      nom: `${clean(f.first_name)} ${clean(f.last_name)}`,
      ident: norm(`${clean(f.first_name)} ${clean(f.last_name)}`),
      identInv: norm(`${clean(f.last_name)} ${clean(f.first_name)}`),
      date: iso(f.birth_date),
    }));

    const fichiers = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    const photos = fichiers.map(parsePhoto);

    const sansPhoto = fiches.filter((f) => !f.a_photo);
    const avecPhoto = fiches.filter((f) => f.a_photo);

    // Une photo est deja pourvue si une fiche AVEC photo du lot la couvre.
    const dejaPour = (p) =>
      avecPhoto.find((f) => (f.date === p.date && similaire(p.identNorm, f.ident) > 0.85) || similaire(p.identNorm, f.ident) > 0.95);

    const plan = [];
    const photosUtilisees = new Set();
    for (const f of sansPhoto) {
      const candidats = photos
        .filter((p) => !photosUtilisees.has(p.name) && p.identNorm && !dejaPour(p))
        .map((p) => {
          const sNom = Math.max(similaire(p.identNorm, f.ident), similaire(p.identNorm, f.identInv));
          const dJours = days(p.date, f.date);
          const sDate = dJours <= 3 ? 1 : dJours <= 31 ? 0.4 : dJours <= 366 ? 0.15 : 0;
          return { photo: p, sNom, dJours, score: 0.75 * sNom + 0.25 * sDate };
        })
        .filter((c) => c.sNom >= 0.6)
        .sort((a, b) => b.score - a.score);

      if (!candidats.length) { plan.push({ cmu_number: f.cmu_number, nom: f.nom, dateFiche: f.date, niveau: 'AUCUN', best: null, alternates: [] }); continue; }
      const best = candidats[0];
      const marge = candidats[1] ? best.score - candidats[1].score : 1;
      let niveau = 'MOYEN';
      if (best.sNom >= 0.9 && best.dJours <= 3 && marge > 0.15) niveau = 'SUR';
      else if (candidats.length > 1 && marge < 0.08) niveau = 'AMBIGU';
      if (niveau !== 'AMBIGU') photosUtilisees.add(best.photo.name);
      plan.push({ cmu_number: f.cmu_number, nom: f.nom, dateFiche: f.date, niveau, best, alternates: candidats.slice(1, 3) });
    }

    const ordre = { SUR: 0, MOYEN: 1, AMBIGU: 2, AUCUN: 3 };
    plan.sort((a, b) => ordre[a.niveau] - ordre[b.niveau] || (b.best?.score || 0) - (a.best?.score || 0));

    console.log(`=== PLAN CORRESPONDANCE ${LOT} (lecture seule) ===`);
    console.log(`  fiches sans photo : ${sansPhoto.length}`);
    console.log('');
    const L = [];
    for (const p of plan) {
      if (p.niveau === 'AUCUN') { L.push(`AUCUN   ${p.cmu_number}  ${p.nom} (${p.dateFiche})  — aucune photo candidate`); continue; }
      const b = p.best;
      L.push(`${p.niveau.padEnd(6)}  ${p.cmu_number}  ${p.nom} (${p.dateFiche})  <= ${b.photo.name}`);
      L.push(`          score=${b.score.toFixed(2)} nom=${b.sNom.toFixed(2)} ecart_date=${b.dJours}j`);
      (p.alternates || []).forEach((a) => L.push(`          alt: ${a.photo.name} (score ${a.score.toFixed(2)})`));
    }
    console.log(L.join('\n'));

    const c = (n) => plan.filter((p) => p.niveau === n).length;
    console.log('');
    console.log(`=== BILAN : SUR=${c('SUR')}  MOYEN=${c('MOYEN')}  AMBIGU=${c('AMBIGU')}  AUCUN=${c('AUCUN')} ===`);

    await pool.end();
  } catch (e) {
    console.error('ERREUR :', e.stack);
    try { await pool.end(); } catch { /* ignore */ }
    process.exit(1);
  }
})();
