/**
 * Utility de formatage des codes CSU Adhérent principal et Bénéficiaires (.1, .2, .3...)
 * Conforme aux spécifications CSU UNAMUSC Sénégal.
 */

// Formate le numéro Adhérent principal (ex: DKR_260001.0)
export function getAdherentCode(rawNumber = 'DKR_260001.0') {
  if (!rawNumber) return 'DKR_260001.0';
  let clean = String(rawNumber).trim();
  clean = clean.replace(/^CSU-+/i, '');
  return clean;
}

// Formate le numéro Bénéficiaire spécifique (ex: DKR_260001.0.41 ou DKR_260001.0)
export function getBeneficiaryCode(rawNumber = 'DKR_260001.0', index = null) {
  if (!rawNumber) return 'DKR_260001.0';
  let clean = String(rawNumber).trim().replace(/^CSU-+/i, '');
  if (index !== null && index !== undefined && !clean.includes('.') && index > 0) {
    return `${clean}.${index}`;
  }
  return clean;
}

// Formate l'objet bénéficiaire complet pour l'affichage dans les tableaux et fiches
export function getBeneficiaryInfo(personName = '', rawNumber = 'DKR_260001.0', defaultIndex = null) {
  const beneficiaryCode = getBeneficiaryCode(rawNumber, defaultIndex);
  const adherentCode = getAdherentCode(rawNumber);

  return {
    adherentCode,
    beneficiaryCode,
    displayString: `N° CSU Bénéficiaire : ${beneficiaryCode}`
  };
}

/**
 * Calcule l'âge exact en années (ou mois pour les nourrissons)
 * de manière 100% dynamique par rapport à la date du jour (new Date()).
 */
export function calculateAge(birthDateStr) {
  if (!birthDateStr) return { years: 0, months: 0, days: 0, formatted: '' };

  let birthDate = null;
  const str = String(birthDateStr).trim();

  // Format DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        birthDate = new Date(year, month, day);
      }
    }
  } else if (str.includes('-')) {
    // Format YYYY-MM-DD
    birthDate = new Date(str);
  } else {
    birthDate = new Date(str);
  }

  if (!birthDate || isNaN(birthDate.getTime())) {
    const yearMatch = str.match(/\b(19\d\d|20\d\d)\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      const nowYear = new Date().getFullYear();
      const ageYears = Math.max(0, nowYear - year);
      return { years: ageYears, months: 0, days: 0, formatted: `${ageYears} ans` };
    }
    return { years: 0, months: 0, days: 0, formatted: '' };
  }

  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  let months = today.getMonth() - birthDate.getMonth();
  let days = today.getDate() - birthDate.getDate();

  if (days < 0) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years === 0 && months > 0) {
    return { years: 0, months, days: Math.max(0, days), formatted: `${months} mois` };
  } else if (years === 0 && months === 0) {
    return { years: 0, months: 0, days: Math.max(0, days), formatted: `${Math.max(1, days)} jour(s)` };
  } else {
    return { years, months, days, formatted: `${years} ans` };
  }
}

export function getAgeLabel(birthDateStr) {
  const res = calculateAge(birthDateStr);
  return res.formatted;
}

