/**
 * ============================================================================
 *  MUTUALIS — CONNECTEUR STOCKAGE OBJET S3 / MINIO + COMPRESSION WEBP (SHARP)
 *  & ANNUAIRE WHATSAPP MULTI-MSD DÉPARTEMENTAL
 * ============================================================================
 *  Objectif (Scalabilité 1 Million → 5 Millions d'assurés sur VPS KVM 8) :
 *  1. Ne JAMAIS stocker d'images Base64 lourdes dans les colonnes TEXT de
 *     PostgreSQL (ordonnances, devis hospitaliers, photos d'identité CSU).
 *  2. Compresser automatiquement chaque image en WebP haute lisibilité
 *     (max 1400px, qualité 82 via `sharp`), réduisant une photo smartphone
 *     de 3,5 Mo à ~85 Ko (-97 % d'espace disque et de bande passante).
 *  3. Envoyer l'objet vers un bucket S3 compatible (MinIO local sur KVM 8,
 *     Cloudflare R2, AWS S3, Hostinger Object Storage) avec signature
 *     cryptographique AWS Signature V4 native (zéro dépendance externe).
 *  4. En développement local sans S3 actif, repli automatique transparent
 *     vers `backend/uploads/<folder>/<msd_code>/`, lu UNIQUEMENT via la route
 *     authentifiée `GET /api/documents/...` (jamais en statique public).
 *  ⚠️ Le bucket S3 doit rester PRIVÉ (pas de lecture anonyme) : ce sont des
 *     données de santé.
 * ============================================================================
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  // Repli gracieux si sharp n'est pas compilé sur l'architecture courante
}

const UPLOADS_ROOT = path.join(__dirname, 'uploads');

// Configuration S3 / MinIO lue depuis l'environnement (.env / docker-compose)
const getS3Config = () => ({
  endpoint: process.env.S3_ENDPOINT || '', // ex: http://minio:9000 ou https://<account>.r2.cloudflarestorage.com
  publicBaseUrl: process.env.S3_PUBLIC_URL || '', // ex: https://cdn.mutualis-dakar.sn/mutualis-csu
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'mutualis-csu',
  accessKeyId: process.env.S3_ACCESS_KEY || '',
  secretAccessKey: process.env.S3_SECRET_KEY || '',
});

const isS3Configured = () => {
  const cfg = getS3Config();
  return Boolean(cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey);
};

// ── Signature AWS Signature V4 native (compatible MinIO, R2, AWS S3) ─────────
function hmacSha256(key, data, encoding) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding);
}

function sha256Hex(bufferOrString) {
  return crypto.createHash('sha256').update(bufferOrString).digest('hex');
}

function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {
  const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, regionName);
  const kService = hmacSha256(kRegion, serviceName);
  return hmacSha256(kService, 'aws4_request');
}

/**
 * Téléverse un Buffer binaire vers S3 / MinIO via requête PUT signée AWSv4.
 */
async function putObjectS3({ key, bodyBuffer, contentType = 'image/webp' }) {
  const cfg = getS3Config();
  const baseEndpoint = cfg.endpoint.replace(/\/+$/, '');
  const targetUrl = new URL(`${baseEndpoint}/${cfg.bucket}/${key}`);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(bodyBuffer);

  const canonicalUri = targetUrl.pathname;
  const canonicalQueryString = '';
  const hostHeader = targetUrl.host;

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${hostHeader}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(cfg.secretAccessKey, dateStamp, cfg.region, 's3');
  const signature = hmacSha256(signingKey, stringToSign, 'hex');
  const authorizationHeader =
    `${algorithm} Credential=${cfg.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(targetUrl.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bodyBuffer.length),
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: authorizationHeader,
    },
    body: bodyBuffer,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`S3 PUT HTTP ${response.status}: ${errText.slice(0, 180)}`);
  }

  const publicUrl = cfg.publicBaseUrl
    ? `${cfg.publicBaseUrl.replace(/\/+$/, '')}/${key}`
    : `${baseEndpoint}/${cfg.bucket}/${key}`;

  return {
    url: publicUrl,
    key,
    storageDriver: 's3',
    sizeBytes: bodyBuffer.length,
    contentType,
  };
}

/**
 * Compresse et externalise une image (Base64 data URI ou Buffer) vers S3/MinIO
 * ou vers le disque local `/uploads` en repli.
 * Si l'entrée est déjà une URL HTTP/HTTPS ou `/uploads/...`, elle est renvoyée telle quelle.
 */
async function storeDocumentImage({
  dataInput,
  folder = 'prescriptions',
  msdCode = 'DKR',
  prefix = 'doc',
}) {
  if (!dataInput || typeof dataInput !== 'string') {
    return null;
  }
  const trimmed = dataInput.trim();
  if (!trimmed) return null;

  // Déjà une URL externe ou chemin d'upload : aucune réécriture nécessaire
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/api/documents/')
  ) {
    return {
      url: trimmed,
      key: trimmed,
      storageDriver: 'existing_url',
      sizeBytes: 0,
      contentType: 'image/webp',
    };
  }

  // Extraction du payload Base64
  const match = trimmed.match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
  const base64Payload = match ? match[2] : trimmed;
  let rawBuffer;
  try {
    rawBuffer = Buffer.from(base64Payload, 'base64');
  } catch {
    return null;
  }

  if (!rawBuffer || rawBuffer.length < 32) {
    return null;
  }

  // Compression WebP haute lisibilité via Sharp (idéal pour ordonnances, devis & photos CSU)
  let finalBuffer = rawBuffer;
  let contentType = match ? match[1] : 'image/jpeg';
  let ext = contentType.includes('png') ? 'png' : 'jpg';

  if (sharp) {
    try {
      finalBuffer = await sharp(rawBuffer)
        .rotate() // Respecte l'orientation EXIF des smartphones
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
      contentType = 'image/webp';
      ext = 'webp';
    } catch {
      // Si le buffer n'est pas une image standard (ex: PDF ou mock de test), on conserve le buffer brut
    }
  }

  const safeMsd = String(msdCode || 'DKR').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'DKR';
  const safeFolder = String(folder || 'documents').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  const uniqueId = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const objectKey = `${safeFolder}/${safeMsd}/${prefix}-${uniqueId}.${ext}`;

  // 1. Tentative d'envoi vers S3 / MinIO si configuré
  if (isS3Configured()) {
    try {
      return await putObjectS3({
        key: objectKey,
        bodyBuffer: finalBuffer,
        contentType,
      });
    } catch (err) {
      console.warn('[ObjectStorage] Repli sur stockage disque local après erreur S3:', err.message);
    }
  }

  // 2. Stockage disque local structuré par MSD (`backend/uploads/<folder>/<MSD>/...`)
  const targetDir = path.join(UPLOADS_ROOT, safeFolder, safeMsd);
  fs.mkdirSync(targetDir, { recursive: true });
  const filename = `${prefix}-${uniqueId}.${ext}`;
  const fullPath = path.join(targetDir, filename);
  fs.writeFileSync(fullPath, finalBuffer);

  return {
    url: `/api/documents/${safeFolder}/${safeMsd}/${filename}`,
    key: objectKey,
    storageDriver: 'local_fs',
    sizeBytes: finalBuffer.length,
    originalBytes: rawBuffer.length,
    contentType,
  };
}

// ── Annuaire officiel des Guichets WhatsApp par Département / MSD ────────────
const DEFAULT_MSD_WHATSAPP_MAP = {
  DKR: { msdCode: 'DKR', name: 'MSD Départementale de Dakar', region: 'Dakar', whatsapp: process.env.WHATSAPP_MSD_DKR || '+221 76 845 54 99', whatsappAlt: '+221 77 742 90 73' },
  PKN: { msdCode: 'PKN', name: 'MSD Départementale de Pikine', region: 'Dakar', whatsapp: process.env.WHATSAPP_MSD_PKN || null },
  GDW: { msdCode: 'GDW', name: 'MSD Départementale de Guédiawaye', region: 'Dakar', whatsapp: process.env.WHATSAPP_MSD_GDW || null },
  RFS: { msdCode: 'RFS', name: 'MSD Départementale de Rufisque', region: 'Dakar', whatsapp: process.env.WHATSAPP_MSD_RFS || null },
  THS: { msdCode: 'THS', name: 'MSD Départementale de Thiès', region: 'Thiès', whatsapp: process.env.WHATSAPP_MSD_THS || null },
  MBR: { msdCode: 'MBR', name: 'MSD Départementale de Mbour', region: 'Thiès', whatsapp: process.env.WHATSAPP_MSD_MBR || null },
  TVN: { msdCode: 'TVN', name: 'MSD Départementale de Tivaouane', region: 'Thiès', whatsapp: process.env.WHATSAPP_MSD_TVN || null },
  STL: { msdCode: 'STL', name: 'MSD Départementale de Saint-Louis', region: 'Saint-Louis', whatsapp: process.env.WHATSAPP_MSD_STL || null },
  KLC: { msdCode: 'KLC', name: 'MSD Départementale de Kaolack', region: 'Kaolack', whatsapp: process.env.WHATSAPP_MSD_KLC || null },
  ZGC: { msdCode: 'ZGC', name: 'MSD Départementale de Ziguinchor', region: 'Ziguinchor', whatsapp: process.env.WHATSAPP_MSD_ZGC || null },
  DRB: { msdCode: 'DRB', name: 'MSD Départementale de Diourbel', region: 'Diourbel', whatsapp: process.env.WHATSAPP_MSD_DRB || null },
  MBK: { msdCode: 'MBK', name: 'MSD Départementale de Mbacké (Touba)', region: 'Diourbel', whatsapp: process.env.WHATSAPP_MSD_MBK || null },
  LGA: { msdCode: 'LGA', name: 'MSD Départementale de Louga', region: 'Louga', whatsapp: process.env.WHATSAPP_MSD_LGA || null },
  TBA: { msdCode: 'TBA', name: 'MSD Départementale de Tambacounda', region: 'Tambacounda', whatsapp: process.env.WHATSAPP_MSD_TBA || null },
  KLD: { msdCode: 'KLD', name: 'MSD Départementale de Kolda', region: 'Kolda', whatsapp: process.env.WHATSAPP_MSD_KLD || null },
  MTM: { msdCode: 'MTM', name: 'MSD Départementale de Matam', region: 'Matam', whatsapp: process.env.WHATSAPP_MSD_MTM || null },
  FTK: { msdCode: 'FTK', name: 'MSD Départementale de Fatick', region: 'Fatick', whatsapp: process.env.WHATSAPP_MSD_FTK || null },
  KFR: { msdCode: 'KFR', name: 'MSD Départementale de Kaffrine', region: 'Kaffrine', whatsapp: process.env.WHATSAPP_MSD_KFR || null },
  KDG: { msdCode: 'KDG', name: 'MSD Départementale de Kédougou', region: 'Kédougou', whatsapp: process.env.WHATSAPP_MSD_KDG || null },
  SDH: { msdCode: 'SDH', name: 'MSD Départementale de Sédhiou', region: 'Sédhiou', whatsapp: process.env.WHATSAPP_MSD_SDH || null },
};

const runtimeMsdWhatsapp = {};

function updateMsdWhatsappCache(code, phone) {
  if (!code) return;
  runtimeMsdWhatsapp[String(code).toUpperCase()] = phone || null;
}

function getMsdWhatsappDirectoryBackend(extraMap = null) {
  const merged = { ...DEFAULT_MSD_WHATSAPP_MAP };
  if (process.env.MSD_WHATSAPP_JSON) {
    try {
      const custom = JSON.parse(process.env.MSD_WHATSAPP_JSON);
      for (const [code, val] of Object.entries(custom)) {
        const upper = code.toUpperCase();
        if (merged[upper]) {
          merged[upper] = {
            ...merged[upper],
            whatsapp: typeof val === 'string' ? val : (val.whatsapp || merged[upper].whatsapp),
          };
        }
      }
    } catch {
      // Ignore JSON invalide dans MSD_WHATSAPP_JSON
    }
  }

  // Appliquer les surcharges DB (extraMap) ou runtime
  const overrides = { ...runtimeMsdWhatsapp, ...(extraMap && typeof extraMap === 'object' ? extraMap : {}) };
  for (const [code, val] of Object.entries(overrides)) {
    const upper = code.toUpperCase();
    if (merged[upper]) {
      const cleanVal = typeof val === 'string' ? val : (val ? val.whatsapp || null : null);
      merged[upper] = {
        ...merged[upper],
        whatsapp: cleanVal,
      };
    }
  }

  // Une MSD sans numéro WhatsApp VÉRIFIÉ est routée vers le guichet central
  // (jamais vers un numéro inventé : on enverrait des données de santé à un
  // inconnu). `configured: false` permet à l'admin de repérer les MSD à compléter.
  const central = process.env.WHATSAPP_CENTRAL_DESK || DEFAULT_MSD_WHATSAPP_MAP.DKR.whatsapp;
  for (const code of Object.keys(merged)) {
    const configured = Boolean(merged[code].whatsapp);
    merged[code] = { ...merged[code], configured, whatsapp: merged[code].whatsapp || central };
  }
  return merged;
}

function getStorageStatus() {
  const cfg = getS3Config();
  return {
    s3Configured: isS3Configured(),
    activeDriver: isS3Configured() ? 's3_minio' : 'local_fs_fallback',
    bucket: cfg.bucket,
    endpoint: cfg.endpoint ? cfg.endpoint.replace(/\/\/.*@/, '//***@') : null,
    webpCompression: Boolean(sharp),
    uploadsDir: UPLOADS_ROOT,
  };
}

module.exports = {
  storeDocumentImage,
  getStorageStatus,
  isS3Configured,
  getMsdWhatsappDirectoryBackend,
  updateMsdWhatsappCache,
  UPLOADS_ROOT,
};
