/* Simule l'import du Studio sur le gabarit : les codes sont-ils générés ? */
const path = require('path');
process.chdir(path.join(__dirname, '..'));
(async () => {
  const { buildStudioMembers, CODE_STRATEGY } = await import('../src/utils/bulkImport.js');
  const XLSX = await import('xlsx');

  const wb = XLSX.readFile('GABARIT-ADHESION-MASSE-DKR-2026.xlsx');
  const raw = XLSX.utils.sheet_to_json(wb.Sheets['Adhésion en masse'], { defval: '' })
    .filter((r) => String(r.PRENOM_BENEFICIAIRE).trim() && String(r.NOM_BENEFICIAIRE).trim());

  const records = raw.map((r) => ({
    codeBeneficiaire: String(r.CODE_BENEFICIAIRE || '').trim(),
    numeroAdherent: String(r.NUMERO_ADHERENT || '').trim(),
    prenom: String(r.PRENOM_BENEFICIAIRE).trim(),
    nom: String(r.NOM_BENEFICIAIRE).trim(),
    birthDate: String(r.DATE_NAISSANCE || '').trim(),
    birthPlace: String(r.LIEU_NAISSANCE || '').trim(),
    nin: String(r.NIN || '').trim(),
    sexe: String(r.SEXE || '').trim().toUpperCase().startsWith('M') ? 'M' : 'F',
    telephone: String(r.CONTACT || '').trim(),
    address: String(r.ADRESSE || '').trim(),
    bloodGroup: String(r.GROUPE_SANGUIN || '').trim(),
    schoolName: '', sponsorPhone: '', mutuelleName: String(r.NOM_ORGANISATION || '').trim(),
    packageType: String(r.TYPE_CARTE || '').trim() || 'individuel',
    photoHint: String(r.PHOTO || '').trim(),
    status: 'active',
  }));

  const members = await buildStudioMembers(records, {
    unionId: 'DKR',
    codeStrategy: CODE_STRATEGY.SYSTEM, // défaut : génération automatique
    existingCodes: [],
  });

  console.log(`Import simulé : ${records.length} lignes → ${members.length} fiche(s)`);
  const afficher = (m, indent = '  ') => {
    console.log(`${indent}${m.cmuNumber} | ${m.firstName} ${m.lastName} | ${m.birthDate} | ${m.isMajor ? 'MAJEUR (carte)' : 'MINEUR (pris en charge)'}`);
    (m.dependents || []).forEach((d) => afficher(d, indent + '    '));
  };
  members.forEach(afficher);
  process.exit(0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
