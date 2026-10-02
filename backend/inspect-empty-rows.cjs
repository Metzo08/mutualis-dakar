/**
 * Contrôle des lignes SANS code CMU : des lignes de continuedotwel, ou des
 * personnes réelles dont la carte n'a pas encore de matricule ?
 * Une personne sans code ne peut pas être imprimée, mais elle ne doit pas
 * disparaître pour autant : il faut savoir ce qu'on laisse de côté.
 */
require('dotenv').config();
const { query, pool } = require('./db');

/** Colonnes de `beneficiaries` trop courtes pour les données des fichiers. */
(async () => {
  const r = await query(`
    select column_name, character_maximum_length as len
    from information_schema.columns
    where table_schema = 'public' and table_name = 'beneficiaries'
      and character_maximum_length is not null
    order by character_maximum_length
  `);
  console.log('=== COLONNES beneficiaries (largeur max) ===');
  r.rows.forEach((x) => console.log(`  ${String(x.len).padStart(6)}  ${x.column_name}`));

  const XLSX = require('xlsx');
  const wb = XLSX.readFile('c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx', { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const withCode = rows.filter((x) => String(x.CODE_BENEFICIAIRE || '').trim());
  console.log('\n=== LONGUEUR MAX RELEVE DANS LE FICHIER ===');
  for (const col of ['PRENOM_BENEFICIAIRE', 'NOM_BENEFICIAIRE', 'ADRESSE', 'CONTACT', 'EMAIL',
                     'NIN', 'NUMERO_ADHERENT', 'GROUPE_SANGUIN', 'LIEU_NAISSANCE']) {
    const max = withCode.reduce((n, r) => Math.max(n, String(r[col] || '').trim().length), 0);
    console.log(`  ${col.padEnd(22)} : ${max}`);
  }
  // Colonnes dont la largeur SQL est inférieure à la longueur max des données.
  const LIMITS = { blood_group: 10, gender: 10, msd_code: 20, academic_year: 20,
    student_type: 20, tutor_phone: 30, lot_code: 32, coverage_end: 50, birth_date: 50,
    phone: 50, package_type: 50, payment_method: 50, status: 50, sponsor_phone: 50,
    cotisation_date: 50, ine: 50, nin: 60, school_class: 100, first_name: 100,
    last_name: 100, ia_ief: 100, cmu_number: 100, numero_adherent: 100,
    department: 100, source_code: 120, tutor_name: 150, birth_place: 150,
    school_name: 255, email: 255, mutuelle_name: 255 };

  const FIELD_COL = {
    PRENOM_BENEFICIAIRE: 'first_name', NOM_BENEFICIAIRE: 'last_name',
    ADRESSE: 'address', CONTACT: 'phone', EMAIL: 'email', NIN: 'nin',
    NUMERO_ADHERENT: 'numero_adherent', GROUPE_SANGUIN: 'blood_group',
    LIEU_NAISSANCE: 'birth_place', DATE_NAISSANCE: 'birth_date',
    TYPE_CARTE: 'package_type', "MUTUELLE_D'ORIGINE": 'mutuelle_name'
  };

  const FILES = [
    ['Grand Yoff', 'c:/Users/hp/Downloads/MSD  de Grand Yoff.xlsx'],
    ['AMEVI', 'c:/Users/hp/Downloads/AMEVI.xlsx'],
    ['ASS LONASE', 'c:/Users/hp/Downloads/ASS LONASE.xlsx']
  ];

  console.log('\n=== DEBORDEMENTS POTENTIELS ===');
  for (const [label, file] of FILES) {
    const wb2 = XLSX.readFile(file, { cellDates: true });
    const rs = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { defval: '' })
      .filter((x) => String(x.CODE_BENEFICIAIRE || '').trim());
    for (const [field, col] of Object.entries(FIELD_COL)) {
      const max = rs.reduce((n, r) => Math.max(n, String(r[field] || '').trim().length), 0);
      const lim = LIMITS[col];
      if (lim && max > lim) {
        console.log(`  ${label.padEnd(12)} ${field.padEnd(22)} -> ${col} : ${max} > ${lim}  <<< DEBORDE`);
      }
    }
  }
  console.log('\n=== VALEURS BRUTES DES DATES ILLISIBLES ===');
  const CODES = ['DKR_2600069.1', 'DKR_2600085.1', 'DKR_2600201.0', 'DKR_2600202.0',
    'DKR_2600210.0', 'DKR_2600217.0', 'DKR_2600218.0', 'DKR_2600220.0', 'DKR_2600221.0'];
  for (const [label, file] of FILES) {
    const w = XLSX.readFile(file, { cellDates: true });
    const rs = XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], { defval: '' });
    for (const r of rs) {
      const code = String(r.CODE_BENEFICIAIRE || '').trim().toUpperCase();
      if (!CODES.includes(code)) continue;
      const v = r.DATE_NAISSANCE;
      console.log(`  ${code.padEnd(16)} ${label.padEnd(12)} type=${v instanceof Date ? 'Date' : typeof v} valeur=${JSON.stringify(v)}`);
    }
  }

  console.log('\n=== DERNIERES DATES NON PARSEES ===');
  const LAST = ['DKR_2600085.1', 'KRM_2600105.1', 'DKR_2600069.1'];
  for (const [label, file] of FILES) {
    const w = XLSX.readFile(file, { cellDates: true });
    const rs = XLSX.utils.sheet_to_json(w.Sheets[w.SheetNames[0]], { defval: '' });
    for (const r of rs) {
      const code = String(r.CODE_BENEFICIAIRE || '').trim().toUpperCase();
      if (!LAST.includes(code)) continue;
      const v = r.DATE_NAISSANCE;
      console.log(`  ${code.padEnd(16)} ${label.padEnd(12)} type=${v instanceof Date ? 'Date' : typeof v} valeur=${JSON.stringify(v)}`);
    }
  }

  await pool.end();
})();