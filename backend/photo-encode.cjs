/**
 * Compression d'une photo de carte, alignée sur `fileToCompressedDataUrl()`
 * de src/utils/bulkImport.js.
 *
 * Côté navigateur, la compression se fait par <canvas>. Le backend n'a pas
 * de canvas : on utilise `sharp`, qui produit le même résultat visuel
 * (redimensionnement + ré-encodage JPEG) sans dépendance native fragile.
 *
 * Sans cette compression, 7 Mo de JPEG d'origine deviennent ~9,3 Mo de base64
 * en base — la page de liste du Studio chargerait alors plusieurs Mo pour
 * l'affichage de vignettes.
 */
const path = require('path');

let sharp = null;
try {
  // eslint-disable-next-line global-require
  sharp = require(path.join(__dirname, 'node_modules', 'sharp'));
} catch {
  sharp = null;
}

/** Paliers identiques à PHOTO_QUALITY_STEPS (bulkImport.js). */
const PHOTO_QUALITY_STEPS = [
  { maxDimension: 300, quality: 0.82 },
  { maxDimension: 240, quality: 0.72 },
  { maxDimension: 180, quality: 0.62 },
];

/**
 * Convertit une qualité « navigateur » (0–1) en qualité « sharp » (1–100).
 *
 * ⚠️ Les deux bibliothèques n'utilisent PAS la même échelle : le canvas du
 * navigateur prend 0.82, sharp exige un entier entre 1 et 100 et rejette
 * 0.82 par un message trompeur. Sans cette conversion, TOUTE la compression
 * échoue silencieusement (le `catch` renvoie une chaîne vide) et aucune photo
 * n'est écrite.
 */
const toSharpQuality = (quality) =>
  Math.max(1, Math.min(100, Math.round(Number(quality) * 100)));

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Encode un fichier image en data-URL, redimensionné.
 * @param {string} filePath
 * @param {{maxDimension?:number, quality?:number}} [opts]
 * @returns {Promise<string>} data-URL, chaîne vide si l'image est illisible
 */
const fileToCompressedDataUrl = async (filePath, opts = {}) => {
  if (!sharp) {
    throw new Error(
      'sharp est absent : la compression des photos est indisponible. Installez-le (npm install sharp dans backend/).'
    );
  }
  const { maxDimension = 300, quality = 0.82 } = opts;
  try {
    const buffer = await sharp(filePath)
      .rotate() // respecte l'orientation EXIF : une photo de carte est souvent prise de profil
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: toSharpQuality(quality) })
      .toBuffer();
    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (err) {
    // Une photo illisible ne doit pas interrompre toute la réparation : elle
    // est ignorée et listée dans le rapport, sans faire échouer le lot.
    console.warn(`[Photos] encodage impossible : ${filePath} — ${err.message}`);
    return '';
  }
};

/**
 * Encode une photo en data-URL, en dégradant la qualité tant que le budget
 * global n'est pas atteint — même stratégie que runExcelImport().
 * @param {string} filePath
 * @param {{budgetRestant:number, step:number}} state — état mutable du lot
 */
const encodeWithBudget = async (filePath, state) => {
  let step = state.step;
  let dataUrl = '';
  while (step < PHOTO_QUALITY_STEPS.length) {
    dataUrl = await fileToCompressedDataUrl(filePath, PHOTO_QUALITY_STEPS[step]);
    if (dataUrl && dataUrl.length <= state.budgetRestant) break;
    step += 1;
  }
  state.step = step;
  state.budgetRestant -= dataUrl ? dataUrl.length : 0;
  state.bytes += dataUrl ? dataUrl.length : 0;
  return dataUrl;
};

const isImage = (name) => /\.(jpe?g|png|webp)$/i.test(name);

module.exports = {
  sharp,
  PHOTO_QUALITY_STEPS,
  MIME_BY_EXT,
  toSharpQuality,
  fileToCompressedDataUrl,
  encodeWithBudget,
  isImage,
};
