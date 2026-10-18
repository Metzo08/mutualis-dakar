/* Reproduction du test « repart au-dessus » pour voir le code réel reçu */
const path = require('path');
(async () => {
  process.chdir(path.join(__dirname, '..'));
  const { buildStudioMembers } = await import('../src/utils/bulkImport.js');
  const records = [
    { codeBeneficiaire: 'DKR-DKR-2026-2294.1', numeroAdherent: '', prenom: 'CLARICE', nom: 'BOCK', birthDate: '', birthPlace: '', nin: '', sexe: 'F', telephone: '', address: '', bloodGroup: '', schoolName: '', sponsorPhone: '', mutuelleName: '', packageType: '', photoHint: '', status: 'active' },
    { codeBeneficiaire: '', numeroAdherent: '', prenom: 'SANS', nom: 'CODE', birthDate: '', birthPlace: '', nin: '', sexe: 'M', telephone: '', address: '', bloodGroup: '', schoolName: '', sponsorPhone: '', mutuelleName: '', packageType: '', photoHint: '', status: 'active' },
  ];
  const members = await buildStudioMembers(records, { unionId: 'DKR', codeStrategy: 'SYSTEM' });
  console.log('MEMBRES :', members.length);
  members.forEach((m) => console.log('  ', m.cmuNumber, '|', m.firstName, m.lastName));
  process.exit(0);
})().catch((e) => { console.error(e.stack); process.exit(1); });
