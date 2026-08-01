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
