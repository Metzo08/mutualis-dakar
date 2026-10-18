/**
 * ═══════════════════════════════════════════════════════════════════════
 *  RÉPARATION LOT GRAND YOFF (LOT-2026-034) — rattachement des photos
 * ═══════════════════════════════════════════════════════════════════════
 *  Principe : les codes viennent TOUJOURS du fichier Excel (cartes déjà
 *  imprimées). Les photos sont nommées « Prénom Nom [née le] JJ-MM-AAAA ».
 *
 *  Actions :
 *   A. Re-codage : la fiche AWA CISSE (mal importée sous 2161.2) → 2251.2
 *   B. Insertion des 8 fiches du classeur absentes de la base
 *   C. Rattachement de 23 photos (date de naissance exacte + identité)
 *   D. Fusion du doublon DKR_260001.1 → 2270.2 (photo conservée)
 *
 *  Chaque UPDATE/INSERT est journalisé ; le script est idempotent
 *  (une photo n'est jamais écrasée, une fiche jamais dupliquée).
 *  Usage : node backend/reparer-yoff.cjs
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');
const { query, pool } = require('./db');

const DIR = 'C:/Users/hp/Downloads/MUTUALIS DAKAR/MSD de Grand Yoff';
const LOT = 'LOT-2026-034';

const clean = (v) => String(v === null || v === undefined ? '' : v).trim();
const toIso = (v) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = clean(v);
  let m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0, 10);
};
const dataUrl = (file) => {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${fs.readFileSync(path.join(DIR, file)).toString('base64')}`;
};

// ── Mapping validé (audit diag-date-match : date exacte + identité) ────
const RATTACHE = {
  'DKR-DKR-2026-2156.1': 'Gass Ndong née le 05-01-1984 à Kaolack adresse cité Sonatel 2.jpeg',
  'DKR-DKR-2026-2171.1': 'Abdou Karim Diouf né le 28-08-97 à Gossas adresse Conachap.jpeg',
  'DKR-DKR-2026-2172.1': 'Awa Lô née le 23-08-2008 à keur Massar à Sékou Mbalo.jpeg',
  'DKR-DKR-2026-2177.1': 'Codou Faye née le28-04-2001 à Dakar adresse Cité Mansour Gueye Liberté 6 extension.jpeg',
  'DKR-DKR-2026-2180.1': 'Ousmane Magueye Ndiaye né 10-02-2016 à Dakar Cité Conachap.jpeg',
  'DKR-DKR-2026-2186.1': 'Bineta Bâ née le 10-07-1992 à Medina Gounas Adresse Golf Sud.jpeg',
  'DKR-DKR-2026-2191.1': 'Ibrahima Sorry Ndiaye né le 07-02-1983 à Dakar adresse HLM grand yoff.jpeg',
  'DKR-DKR-2026-2193.1': 'Mouhamadou Ady Niang né le 10-03-1989 à Dakar adresse Arafat.jpeg',
  'DKR-DKR-2026-2202.1': 'Madické Diao né 11-12-1995 à Dakar adresse Bastos 2.jpeg',
  'DKR-DKR-2026-2205.1': 'Pape Cheikh Tidiane Diao né le 04-12-1987 à Dakar Adresse Bastos.jpeg',
  'DKR-DKR-2026-2209.1': 'Maréme Sarr née le 09-02-1978 à Dakar adresse HLM Patte d’oie.jpeg',
  'DKR-DKR-2026-2227.1': 'Elhadji Boubacar Mané ne le 08-05-1994 à Dakar adresse Khar Yallah.jpeg',
  'DKR-DKR-2026-2233.1': 'Aissata Oumar Anne né le 01011995 à  Bocké Mbayébé.jpeg',
  'DKR-DKR-2026-2257.1': 'Matias Mendy ne 24-02-1965 à Dakar adresse Darou Salam Khar Yallah membre stade 04.jpeg',
  'DKR-DKR-2026-2268.1': 'Amy Sow née le 27-01-1962 à Kayes Mali Adresse HLM grand yoff.jpeg',
  'DKR-DKR-2026-2285.1': 'Ndeye Fatou Fatou Badji née le 17-01-1981 à Sedhiou adresse Léona 770978924.jpeg',
  'DKR-DKR-2026-2272.1': 'Mame Penda Diao 08-08-1972 à Dakar adresse CSE.jpeg', // typo DIAO/DIAWO, date+prénom uniques
  'DKR-DKR-2026-2225.1': 'Diarry Samb née le 27-11-1974 à Thies Adresse Cité Millionnaire.jpeg', // faute DIARY/DIARRY, date 27 vs 28, prénom+nom uniques
  // Photos des fiches qui vont être insérées :
  'DKR-DKR-2026-2199.2': 'Nogaye Sow née 11-11-2005 à Fouta adresse Darou.jpeg',
  'DKR-DKR-2026-2245.2': 'Tacko Cissokho née le 10-01-2000 à Thies Adresse HLM Pattes d’oie Membre Seydou.jpeg',
  'DKR-DKR-2026-2245.3': 'Ndeye Bigué Sarr née le 26-12-2000 à Thies adresse HLM Patte d’oie Membres délégué Seydou.jpeg',
  'DKR-DKR-2026-2161.2': 'Astou Koïta née le 11-09-2016 à Dakar adresse Léona grand yoff.jpeg',
  'DKR-DKR-2026-2280.1': 'Ibrahima Gueye née 04-06-1998 à Sambaye-Karang adresse Khar Yallah.jpeg',
  'DKR-DKR-2026-2286.1': 'Alioune Gueye né 15-01-1977 à Sokone adresse Khar Yallah.jpeg',
};

// Fiches absentes de la base → à insérer depuis le classeur
const A_INSERER = [
  'DKR-DKR-2026-2199.2', 'DKR-DKR-2026-2245.2', 'DKR-DKR-2026-2245.3',
  'DKR-DKR-2026-2251.2', 'DKR-DKR-2026-2270.2', 'DKR-DKR-2026-2280.1',
  'DKR-DKR-2026-2286.1', 'DKR-DKR-2026-2287.1', 'DKR-DKR-2026-2161.2',
];

(async () => {
  // Classeur : première ligne par code
  const wb = XLSX.readFile(path.join(DIR, '..', 'MSD de Grand Yoff.xlsx'), { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
    .filter((r) => clean(r.CODE_BENEFICIAIRE));
  const excel = new Map();
  lignes.forEach((r) => {
    const c = clean(r.CODE_BENEFICIAIRE).toUpperCase();
    if (!excel.has(c)) excel.set(c, r);
  });

  const fichiers = new Set(fs.readdirSync(DIR));
  let stats = { recodees: 0, inserees: 0, photos: 0, fusions: 0, erreurs: 0 };

  // ── A. Re-codage 2161.2 AWA CISSE → 2251.2 ──────────────────────────
  const awa = await query(
    "SELECT id FROM beneficiaries WHERE cmu_number='DKR-DKR-2026-2161.2' AND merged_into IS NULL AND first_name='AWA' AND last_name='CISSE'"
  );
  if (awa.rows.length === 1) {
    const conflit = await query("SELECT id FROM beneficiaries WHERE cmu_number='DKR-DKR-2026-2251.2'");
    if (conflit.rows.length === 0) {
      await query(
        "UPDATE beneficiaries SET cmu_number='DKR-DKR-2026-2251.2', source_code='DKR-DKR-2026-2251.2' WHERE id=$1",
        [awa.rows[0].id]
      );
      stats.recodees++;
      console.log('A. Re-codage : AWA CISSE 2161.2 → 2251.2 (photo conservée)');
    } else {
      console.log('A. 2251.2 déjà occupée — re-codage ignoré');
    }
  }

  // ── B. Insertion des fiches manquantes ──────────────────────────────
  for (const code of A_INSERER) {
    const deja = await query('SELECT id FROM beneficiaries WHERE cmu_number=$1', [code]);
    if (deja.rows.length > 0) { console.log(`B. ${code} déjà présent — insertion sautée`); continue; }
    const e = excel.get(code);
    if (!e) { console.log(`B. ${code} introuvable dans le classeur — ERREUR`); stats.erreurs++; continue; }
    const adherent = clean(e.NUMERO_ADHERENT) || code.replace(/\.\d+$/, '');
    const photo = RATTACHE[code] && fichiers.has(RATTACHE[code]) ? dataUrl(RATTACHE[code]) : null;
    await query(
      `INSERT INTO beneficiaries
         (first_name, last_name, birth_date, birth_place, phone, email, address,
          mutuelle_name, package_type, payment_method, cmu_number, status, photo_url,
          gender, nin, numero_adherent, source_code, lot_code, msd_code, department)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'excel_import',$10,'active',$11,$12,$13,$14,$15,$16,'DKR','Dakar')`,
      [
        clean(e.PRENOM_BENEFICIAIRE).toUpperCase(), clean(e.NOM_BENEFICIAIRE).toUpperCase(),
        toIso(e.DATE_NAISSANCE), clean(e.LIEU_NAISSANCE).toUpperCase(),
        clean(e.CONTACT).replace(/\s/g, ''), clean(e.EMAIL),
        clean(e.ADRESSE).toUpperCase(),
        'MSD Dakar', 'individuel',
        code, photo,
        clean(e.SEXE).toUpperCase().startsWith('M') ? 'M' : 'F',
        clean(e.NIN), adherent, code, LOT,
      ]
    );
    stats.inserees++;
    console.log(`B. Insertion ${code} ${clean(e.PRENOM_BENEFICIAIRE)} ${clean(e.NOM_BENEFICIAIRE)} photo=${photo ? 'oui' : 'NON'}`);
  }

  // ── C. Rattachement des photos ──────────────────────────────────────
  for (const [code, file] of Object.entries(RATTACHE)) {
    if (!fichiers.has(file)) { console.log(`C. ${code} fichier introuvable : ${file} — ERREUR`); stats.erreurs++; continue; }
    const r = await query(
      "SELECT id, photo_url IS NOT NULL AND photo_url<>'' AS a_photo FROM beneficiaries WHERE cmu_number=$1 AND merged_into IS NULL",
      [code]
    );
    if (r.rows.length === 0) { console.log(`C. ${code} absente de la base — ERREUR`); stats.erreurs++; continue; }
    if (r.rows[0].a_photo) { console.log(`C. ${code} a déjà une photo — sautée`); continue; }
    await query('UPDATE beneficiaries SET photo_url=$1 WHERE id=$2', [dataUrl(file), r.rows[0].id]);
    stats.photos++;
    console.log(`C. Photo rattachée : ${code} ← ${file}`);
  }

  // ── D. Fusion du doublon DKR_260001.1 → 2270.2 ──────────────────────
  const dup = await query(
    "SELECT id, photo_url FROM beneficiaries WHERE cmu_number='DKR_260001.1' AND merged_into IS NULL"
  );
  if (dup.rows.length === 1) {
    const cible = await query("SELECT id FROM beneficiaries WHERE cmu_number='DKR-DKR-2026-2270.2' AND merged_into IS NULL");
    if (cible.rows.length === 1) {
      if (dup.rows[0].photo_url) {
        await query('UPDATE beneficiaries SET photo_url=$1 WHERE id=$2', [dup.rows[0].photo_url, cible.rows[0].id]);
      }
      await query("UPDATE beneficiaries SET merged_into='DKR-DKR-2026-2270.2' WHERE id=$1", [dup.rows[0].id]);
      stats.fusions++;
      console.log('D. Fusion DKR_260001.1 → 2270.2 (photo transférée)');
    }
  }

  // ── Contrôle final ──────────────────────────────────────────────────
  const ctrl = await query(
    "SELECT count(*) n, count(*) FILTER (WHERE photo_url IS NOT NULL AND photo_url<>'') ph FROM beneficiaries WHERE lot_code=$1 AND merged_into IS NULL",
    [LOT]
  );
  console.log(`\nLot ${LOT} : ${ctrl.rows[0].n} fiches actives, ${ctrl.rows[0].ph} avec photo`);
  console.log('Stats :', JSON.stringify(stats));
  await pool.end();
})().catch((e) => { console.error('ERREUR :', e.stack); pool.end().catch(() => {}); process.exit(1); });
