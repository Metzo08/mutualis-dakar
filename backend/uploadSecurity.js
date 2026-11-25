'use strict';

const crypto = require('crypto');

/**
 * ============================================================
 *  SenMutuelles — Défense Uploads & Images Piégées
 *  (Skill SEN-E-AGENCE : secure-file-upload-defense)
 * ============================================================
 *  Applique les 4 protections obligatoires côté serveur :
 *   1. Vérification des MAGIC BYTES binaires réels (JPEG / PNG / WebP / GIF)
 *      — rejette tout script PHP/JS/HTML/SVG renommé en .jpg ou forgé en data-URL.
 *   2. Limite stricte de taille binaire (2 Mo pour photos de profil / 5 Mo pièces).
 *   3. Génération d'un nom de fichier aléatoire cryptographique (UUID + ext vérifiée).
 *   4. En-têtes HTTP anti-exécution (X-Content-Type-Options: nosniff + CSP sandbox).
 */

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2 Mo pour photo d'identité

const DANGEROUS_PATTERNS = [
  /<\?php/i,
  /<script\b/i,
  /<svg\b/i,
  /<!doctype\s+html/i,
  /<html\b/i,
  /onerror\s*=/i,
  /onload\s*=/i,
  /javascript:/i
];

/**
 * Détecte le vrai type MIME d'un buffer à partir de ses magic bytes binaires.
 * @param {Buffer} buf
 * @returns {{ mime: string, ext: string } | null}
 */
function detectImageFromMagicBytes(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  // JPEG : FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  // WebP : RIFF .... WEBP
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // GIF : GIF87a ou GIF89a
  const gifSig = buf.toString('ascii', 0, 6);
  if (gifSig === 'GIF87a' || gifSig === 'GIF89a') {
    return { mime: 'image/gif', ext: 'gif' };
  }

  return null;
}

/**
 * Génère un nom de fichier aléatoire sûr (jamais le nom fourni par le client).
 * @param {string} ext
 * @returns {string}
 */
function generateSafeFilename(ext = 'webp') {
  const safeExt = ['jpg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
  return `${crypto.randomUUID()}.${safeExt}`;
}

/**
 * Valide une photo soumise (data-URL image base64 ou chemin/URL interne sûr).
 * Rejette toute image piégée (script déguisé, SVG, payload HTML, taille excessive).
 *
 * @param {string} input
 * @param {{ maxBytes?: number }} [opts]
 * @returns {{ ok: boolean, error?: string, normalizedUrl?: string, mime?: string, ext?: string, safeFilename?: string, byteSize?: number }}
 */
function validateUploadedImage(input, opts = {}) {
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
  const raw = String(input || '').trim();
  if (!raw) {
    return { ok: false, error: 'Photo manquante.' };
  }

  // Chemin relatif interne déjà contrôlé (ex: /photos/..., /api/beneficiaries/123/photo)
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('..')) {
    if (/\.(php|js|html|htm|svg|exe|sh)(\?|$)/i.test(raw)) {
      return { ok: false, error: 'Type de fichier interne non autorisé.' };
    }
    return { ok: true, normalizedUrl: raw, mime: 'image/jpeg', ext: 'jpg', safeFilename: generateSafeFilename('jpg'), byteSize: 0 };
  }

  // URL HTTPS externe sûre (uniquement sans extension exécutable)
  if (raw.startsWith('https://')) {
    if (/\.(php|js|html|htm|svg|exe|sh)(\?|$)/i.test(raw)) {
      return { ok: false, error: 'URL de fichier exécutable refusée.' };
    }
    return { ok: true, normalizedUrl: raw, mime: 'image/jpeg', ext: 'jpg', safeFilename: generateSafeFilename('jpg'), byteSize: 0 };
  }

  // Data-URL base64 : inspection binaire stricte (magic bytes + anti-polyglot)
  const match = raw.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    return { ok: false, error: 'Format de photo invalide. Seules les images JPEG, PNG ou WebP sont acceptées.' };
  }

  const declaredMime = match[1].toLowerCase().trim();
  if (declaredMime.includes('svg') || declaredMime.includes('html') || declaredMime.includes('javascript')) {
    return { ok: false, error: 'Format actif (SVG/HTML/JS) interdit pour des raisons de sécurité.' };
  }

  const b64Clean = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(b64Clean, 'base64');

  if (buffer.length > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(1);
    return { ok: false, error: `Image trop volumineuse (${(buffer.length / (1024 * 1024)).toFixed(2)} Mo). Limite maximale : ${maxMb} Mo.` };
  }

  // Protection 1 : vérification réelle des MAGIC BYTES
  const detected = detectImageFromMagicBytes(buffer);
  if (!detected) {
    return { ok: false, error: 'Image piégée ou corrompue détectée : la signature binaire réelle ne correspond pas à une image JPEG, PNG, WebP ou GIF valide.' };
  }

  // Anti-polyglot : inspecte les 4 premiers Ko en ASCII/UTF-8 pour détecter un script embarqué
  const headText = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('latin1');
  for (const pat of DANGEROUS_PATTERNS) {
    if (pat.test(headText)) {
      return { ok: false, error: 'Contenu actif suspect détecté dans le fichier image (rejeté par la protection anti-polyglot).' };
    }
  }

  // Reconstruit la data-URL avec le MIME réellement détecté par magic bytes
  const normalizedUrl = `data:${detected.mime};base64,${b64Clean}`;
  return {
    ok: true,
    normalizedUrl,
    mime: detected.mime,
    ext: detected.ext,
    safeFilename: generateSafeFilename(detected.ext),
    byteSize: buffer.length
  };
}

/**
 * Applique les en-têtes HTTP anti-exécution sur toute réponse servant un média uploadé.
 */
function applySafeMediaHeaders(res, mime = 'image/jpeg') {
  res.set('Content-Type', mime);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('Cross-Origin-Resource-Policy', 'same-site');
}

module.exports = {
  detectImageFromMagicBytes,
  generateSafeFilename,
  validateUploadedImage,
  applySafeMediaHeaders,
  DEFAULT_MAX_BYTES
};
