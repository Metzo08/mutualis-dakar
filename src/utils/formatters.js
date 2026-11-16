/**
 * Utilitaire de formatage monétaire et numérique déterministe pour MUTUALIS DAKAR 🇸🇳
 * Évite les artefacts de séparation de mille (ex: slashes '/' ou caractères spéciaux de locale).
 */

export const formatFCFA = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 FCFA';
  const num = Math.round(Number(amount));
  const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} FCFA`;
};

export const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const num = Math.round(Number(val));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};


/**
 * Met la première lettre en majuscule et le reste en minuscule.
 * Ex: "AMADOU" -> "Amadou", "chirurgie" -> "Chirurgie"
 */
export const formatCapitalizeFirst = (val) => {
  if (!val || typeof val !== 'string') return '';
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
};

/**
 * Met la première lettre de chaque mot en majuscule et le reste en minuscule.
 * Idéal pour les prénoms, noms, hôpitaux, pharmacies, structures de santé.
 * Ex: "amadou sow" -> "Amadou Sow", "HOPITAL PRINCIPAL" -> "Hopital Principal"
 */
export const formatTitleCase = (val) => {
  if (!val || typeof val !== 'string') return '';
  return val
    .split(/(\s+|-|')/)
    .map((part) => {
      if (!part || /^\s+$/.test(part) || part === '-' || part === "'") return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
};

/**
 * Formatage de texte / acte / prescription :
 * Première lettre en majuscule et reste en minuscules si tout est en majuscules.
 * Ex: "CHIRURGIE APPENDICITE" -> "Chirurgie appendicite", "insuline" -> "Insuline"
 */
export const formatSentenceCase = (val) => {
  if (!val || typeof val !== 'string') return '';
  if (val.length === 0) return '';
  const isAllUpper = val.length > 2 && val === val.toUpperCase() && /[A-Z]/.test(val);
  if (isAllUpper) {
    return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
  }
  return val.charAt(0).toUpperCase() + val.slice(1);
};
