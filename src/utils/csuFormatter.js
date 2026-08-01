/**
 * Utility de formatage des codes CSU Adhérent principal et Bénéficiaires (.1, .2, .3...)
 * Conforme aux spécifications CSU UNAMUSC Sénégal.
 */

// Formate le numéro Adhérent principal (ex: CSU-DKR-2026-8812)
export function getAdherentCode(rawNumber = 'CSU-DKR-2026-8812') {
  if (!rawNumber) return 'CSU-DKR-2026-8812';
  let clean = rawNumber.trim().replace(/^(CMU|CSU)-?/i, 'CSU-');
  clean = clean.replace(/\.\d+$/, '');
  if (!clean.startsWith('CSU-')) {
    clean = `CSU-${clean}`;
  }
  return clean;
}

// Formate le numéro Bénéficiaire spécifique (ex: CSU-DKR-2026-8812.1, CSU-DKR-2026-8812.2, etc.)
export function getBeneficiaryCode(rawNumber = 'CSU-DKR-2026-8812', index = 1) {
  const base = getAdherentCode(rawNumber);
  return `${base}.${index}`;
}

// Formate l'objet bénéficiaire complet pour l'affichage dans les tableaux et fiches
export function getBeneficiaryInfo(personName = 'Awa Ndiaye', rawNumber = 'CSU-DKR-2026-8812', defaultIndex = 1) {
  let index = defaultIndex;
  const nameLower = (personName || '').toLowerCase();

  if (nameLower.includes('awa') || nameLower.includes('modou') || nameLower.includes('titulaire') || nameLower.includes('adherent')) {
    index = 1;
  } else if (nameLower.includes('amadou') || nameLower.includes('conjoint') || nameLower.includes('époux') || nameLower.includes('epouse')) {
    index = 2;
  } else if (nameLower.includes('fatou') || nameLower.includes('enfant 1') || nameLower.includes('bébé')) {
    index = 3;
  } else if (nameLower.includes('moussa') || nameLower.includes('ibrahima') || nameLower.includes('enfant 2')) {
    index = 4;
  }

  const adherentCode = getAdherentCode(rawNumber);
  const beneficiaryCode = `${adherentCode}.${index}`;

  return {
    adherentCode,
    beneficiaryCode,
    index,
    displayString: `N° CSU Bénéficiaire : ${beneficiaryCode}`
  };
}
