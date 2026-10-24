/**
 * excelWorkbook.js — Fabrique de classeurs XLSX professionnels (§5.6 du
 * cahier des charges : « Qualité des fichiers Excel »).
 *
 * Source unique pour tous les exports MUTUALIS :
 *   • neutralisation des formules Excel (CSV/Formula injection) ;
 *   • en-têtes clairs, figés, filtres automatiques, largeurs calculées ;
 *   • respect des types : les nombres restent numériques, les dates restent
 *     des dates (jamais du texte trié alphabétiquement) ;
 *   • ligne de synthèse, date de génération, référence de rapport et filtres
 *     appliqués — exigés par le cahier des charges ;
 *   • nommage court des feuilles (31 caractères max, aucun caractère interdit).
 *
 * AUCUN calcul métier ici : les montants sont calculés côté serveur (routes)
 * et le classeur ne fait que les présenter. Le fichier Excel n'est jamais la
 * source de vérité des revenus (§5.6).
 */

const XLSX = require('xlsx');

/** Caractères interdits par Excel dans un nom d'onglet. */
const SHEET_FORBIDDEN = /[\\/?*[\]:]/g;

/** Normalise un nom de feuille (31 car. max, sans caractères interdits). */
function sheetName(name, fallback = 'Feuille') {
  const clean = String(name || fallback).replace(SHEET_FORBIDDEN, '-').trim();
  return (clean || fallback).slice(0, 31);
}

/**
 * Neutralise une valeur utilisateur susceptible d'être interprétée comme une
 * formule Excel (=, +, -, @, tabulation, retour chariot en tête). La valeur
 * reste lisible : on préfixe par une apostrophe, convention Excel.
 */
function safeValue(v) {
  if (typeof v !== 'string') return v;
  if (/^[=+@\-\t\r]/.test(v)) return `'${v}`;
  return v;
}

/** Convertit une valeur de base en type Excel préservable. */
function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  return safeValue(String(v));
}

/**
 * Largeur de colonne estimée (8 → 60 caractères), sur l'en-tête ET sur les
 * 200 premières valeurs : un identifiant long n'est jamais tronqué à l'aveugle.
 */
function computeWidths(columns, rows) {
  return columns.map((c) => {
    let width = String(c || '').length;
    for (let i = 0; i < Math.min(rows.length, 200); i += 1) {
      const val = rows[i] ? rows[i][c] : '';
      const len = val instanceof Date ? 12 : String(val === null || val === undefined ? '' : val).length;
      if (len > width) width = len;
    }
    return { wch: Math.max(10, Math.min(60, width + 2)) };
  });
}

/**
 * Construit une feuille « tableau ».
 * @param {string[]} columns — clés des lignes (ordre d'affichage)
 * @param {object[]} rows — objets à projeter
 * @param {object} [opts]
 * @param {object} [opts.labels] — libellés d'en-tête lisibles (clé → libellé)
 * @param {number} [opts.titleRows] — nb de lignes de titre au-dessus du tableau
 * @param {string[]} [opts.summary] — ligne de synthèse sous le tableau
 */
function buildTableSheet(columns, rows, opts = {}) {
  const labels = opts.labels || {};
  const titleRows = opts.titleRows || 0;
  const header = columns.map((c) => labels[c] || c);
  const body = (rows || []).map((r) => columns.map((c) => cellValue(r ? r[c] : '')));
  const summary = (opts.summary || []).map((line) => [String(line)]);
  const aoa = [
    ...Array.from({ length: titleRows }, () => []),
    header,
    ...body,
    ...(summary.length ? [[], ...summary] : []),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = computeWidths(columns, rows || []);
  if (body.length > 0) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: titleRows, c: 0 },
        e: { r: titleRows + body.length, c: columns.length - 1 },
      }),
    };
  }
  ws['!freeze'] = { xSplit: 0, ySplit: titleRows + 1 };
  return ws;
}

/**
 * Construit une feuille « indicateurs » (deux colonnes libellé / valeur),
 * utilisée pour les synthèses — le type de la valeur est conservé (nombre).
 */
function buildKpiSheet(pairs, opts = {}) {
  const titleRows = opts.titleRows || 0;
  const aoa = [
    ...Array.from({ length: titleRows }, () => []),
    [opts.labelHeader || 'Indicateur', opts.valueHeader || 'Valeur'],
    ...pairs.map(([k, v]) => [String(k), cellValue(v)]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const longest = pairs.reduce((m, p) => Math.max(m, String(p[0] || '').length), 12);
  ws['!cols'] = [{ wch: Math.max(24, Math.min(60, longest + 2)) }, { wch: 26 }];
  ws['!freeze'] = { xSplit: 0, ySplit: titleRows + 1 };
  return ws;
}

/**
 * Entête de rapport réutilisable (3 lignes) : titre, contexte filtres/réf.
 * @returns {{ titleRows: number, lines: string[] }}
 */
function reportHeader({ title, reference, filters }) {
  return {
    title,
    reference,
    filterLine: filters && filters.length ? `Filtres : ${filters.join(' · ')}` : 'Filtres : aucun (périmètre complet autorisé)',
  };
}

/**
 * Assemble un classeur.
 * @param {Array<{name:string, sheet:object}>} sheets
 * @returns {Buffer}
 */
function buildWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set();
  for (const s of sheets || []) {
    let name = sheetName(s.name);
    let i = 2;
    while (usedNames.has(name)) {
      const suffix = ` (${i})`;
      name = sheetName(s.name).slice(0, 31 - suffix.length) + suffix;
      i += 1;
    }
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, s.sheet, name);
  }
  wb.Props = { Title: 'Rapport MUTUALIS', Author: 'MUTUALIS / Sen-E-Carte' };
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/** Référence de rapport lisible et horodatée : RPT-AAAAMMJJ-HHMMSS-xxxx. */
function reportReference(prefix = 'RPT') {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

module.exports = {
  XLSX,
  sheetName,
  safeValue,
  cellValue,
  buildTableSheet,
  buildKpiSheet,
  buildWorkbook,
  reportHeader,
  reportReference,
};
