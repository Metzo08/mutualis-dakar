/**
 * RÉPARATION ASS LONASE — insertion de la fiche manquante KHADY POUYE
 * (code DKR_2600059.1, absente de la base, photo présente dans le dossier)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const XLSX = require('xlsx');
const { query, pool } = require('./db');
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

(async () => {
  const CODE = 'DKR_2600059.1';
  const wb = XLSX.readFile('C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE.xlsx', { cellDates: true });
  const lignes = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const e = lignes.find((r) => clean(r.CODE_BENEFICIAIRE).toUpperCase() === CODE);
  if (!e) { console.error('Ligne classeur introuvable'); process.exit(1); }

  const deja = await query('SELECT id FROM beneficiaries WHERE cmu_number=$1', [CODE]);
  if (deja.rows.length) { console.log('déjà présent'); process.exit(0); }

  const f = fs.readdirSync('C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE').find((x) => x.toUpperCase().startsWith(CODE));
  const photo = f ? `data:image/jpeg;base64,${fs.readFileSync(path.join('C:/Users/hp/Downloads/MUTUALIS DAKAR/ASS LONASE', f)).toString('base64')}` : null;

  await query(
    `INSERT INTO beneficiaries
       (first_name, last_name, birth_date, birth_place, phone, email, address,
        mutuelle_name, package_type, payment_method, cmu_number, status, photo_url,
        gender, nin, numero_adherent, source_code, lot_code, msd_code, department)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'MSD Dakar','individuel','excel_import',$8,'active',$9,$10,$11,$12,$13,'LOT-2026-011','DKR','Dakar')`,
    [
      clean(e.PRENOM_BENEFICIAIRE).toUpperCase(), clean(e.NOM_BENEFICIAIRE).toUpperCase(),
      toIso(e.DATE_NAISSANCE), clean(e.LIEU_NAISSANCE).toUpperCase(),
      clean(e.CONTACT).replace(/\s/g, ''), clean(e.EMAIL), clean(e.ADRESSE).toUpperCase(),
      CODE, photo,
      clean(e.SEXE).toUpperCase().startsWith('M') ? 'M' : 'F',
      clean(e.NIN), clean(e.NUMERO_ADHERENT) || CODE, CODE,
    ]
  );
  console.log(`Insertion ${CODE} ${clean(e.PRENOM_BENEFICIAIRE)} ${clean(e.NOM_BENEFICIAIRE)} photo=${photo ? 'oui' : 'NON'}`);
  await pool.end();
})().catch((err) => { console.error(err.stack); pool.end().catch(() => {}); process.exit(1); });
