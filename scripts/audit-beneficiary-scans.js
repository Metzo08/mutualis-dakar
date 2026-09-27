#!/usr/bin/env node
/**
 * AUDIT DES SCANS QR / BÉNÉFICIAIRES — MUTUALIS DAKAR
 * ----------------------------------------------------------------------------
 * Vérifie que chaque bénéficiaire du store frontend est scannable à 100% :
 *   1. Code CSU présent et bien formé (préfixe union + chiffres + suffixe optionnel)
 *   2. Code résolu de manière unique par l'index de vérification (aucune collision)
 *   3. Champs minimum requis pour la carte et la page /verify
 *      (nom, date de naissance, union départementale, téléphone valide)
 *   4. Photos officielles référencées présentes dans public/
 *   5. Codes d'ayants droit cohérents avec le code du garant (suffixes uniques)
 *
 * Usage :  npm run test:scans              (rapport)
 *          npm run test:scans -- --strict  (code de sortie 1 si erreurs)
 *
 * Le script n'exécute pas de navigateur : il reproduit fidèlement la logique
 * de src/utils/beneficiaryStore.js (index plat + getCardByCode) pour auditer
 * en ligne de commande l'exactitude des scans QR imprimés sur les cartes.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

// ── Chargement du store (module ESM du frontend, sans bundler) ──────────────
// beneficiaryStore.js est écrit pour le navigateur (localStorage) : on l'évalue
// dans un contexte minimal où window/localStorage sont absents, ce qui renvoie
// directement `defaultMembers`.
function loadDefaultMembers() {
  const dataSrc = readFileSync(join(ROOT, 'src/data/msdDakarMembers.js'), 'utf8')
    .replace('export const msdDakarMembers', 'const msdDakarMembers');
  const storeSrc = readFileSync(join(ROOT, 'src/utils/beneficiaryStore.js'), 'utf8')
    .replace(/import[\s\S]*?from[\s\S]*?;/, dataSrc)
    .replace(/export const defaultMembers/m, 'const defaultMembers')
    .replace(/export const demoProfiles/m, 'const demoProfiles')
    .replace(/export const (\w+)/g, 'const $1');
  const sandbox = new Function(`
    const window = undefined;
    const localStorage = undefined;
    ${storeSrc}
    ;return defaultMembers;
  `);
  return sandbox();
}

// ── Réplication de la logique d'index de beneficiaryStore.js ────────────────
const getValidPhone = (primary, secondary, fallback = '77 631 71 73') => {
  const isInvalid = (v) => !v || String(v).trim() === '' || String(v).trim() === '—' || String(v).trim() === '-';
  if (!isInvalid(primary)) return String(primary).trim();
  if (!isInvalid(secondary)) return String(secondary).trim();
  return fallback;
};

function buildBeneficiaryIndex(members) {
  const map = new Map();
  const collisions = [];
  for (const m of members) {
    if (!m) continue;
    const mCmu = (m.cmuNumber || '').trim();
    const mAdherent = (m.adherentCode || mCmu.replace('.0', '')).trim();
    const mBase = mCmu.replace('.0', '');
    const mId = (m.id || '').trim();
    const principalKeys = [mCmu, mAdherent, mBase, mId].filter(Boolean).map((k) => k.toUpperCase());

    for (const key of principalKeys) {
      if (map.has(key) && map.get(key).owner !== key) collisions.push(key);
      map.set(key, { owner: key, kind: 'PRINCIPAL', member: m });
    }

    for (const [idx, d] of (m.dependents || []).entries()) {
      if (!d) continue;
      const suffix = (d.codeSuffix || (d.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`)).trim();
      const depKeys = [...new Set([`${mAdherent}${suffix}`, `${mCmu}${suffix}`, `${mBase}${suffix}`])]
        .filter((k) => k && !k.startsWith('undefined'))
        .map((k) => k.toUpperCase());
      for (const key of depKeys) {
        if (map.has(key)) collisions.push(key);
        map.set(key, { owner: key, kind: d.isMajor ? 'MAJOR' : 'MINOR', member: m, dependent: d });
      }
    }
  }
  return { map, collisions };
}

// ── Reproduction fidèle de getCardByCode (résolution d'un scan QR) ──────────
function resolveScan(index, rawCode) {
  let clean = String(rawCode || '').trim().toUpperCase();
  if (clean.includes('/verify/')) {
    const m = clean.match(/\/verify\/([^?#]+)/i);
    if (m && m[1]) clean = decodeURIComponent(m[1].trim()).toUpperCase();
  }
  if (clean.includes('?')) clean = clean.split('?')[0].trim();
  if (index.has(clean)) return index.get(clean);

  const normalized = clean.replace(/[^A-Z0-9]/g, '');
  for (const [key, value] of index.entries()) {
    if (key.replace(/[^A-Z0-9]/g, '') === normalized) return value;
  }
  return null;
}

// ── Vérification de l'existence des photos officielles ──────────────────────
function checkPhoto(photoUrl) {
  if (!photoUrl) return { ok: true, note: 'aucune' };
  if (/^https?:\/\//i.test(photoUrl)) return { ok: true, note: 'URL distante' };
  if (photoUrl.startsWith('data:')) return { ok: true, note: 'data-URI' };
  const path = photoUrl.startsWith('/') ? photoUrl.slice(1) : photoUrl;
  const exists = existsSync(join(ROOT, 'public', path));
  return { ok: exists, note: exists ? 'fichier public OK' : `FICHIER ABSENT : public/${path}` };
}

// ── Format attendu du code CSU : PREFIXE_CHIFFRES(.suffixe) ────────────────
// Accepte aussi les codes scolaires officiels MSDD Dakar à deux segments
// (« EDU_DKR_26000163 », « EDU_MBK_26000164 » — cartes CMU-Élèves / CMU-Daara).
const CODE_FORMAT = /^[A-Z]{2,6}[-_][A-Z0-9][A-Z0-9_-]*\d{2,}(\.(0|[1-9][0-9]*|M[0-9]+|1[0-9]+))?$/;

// ── Audit ───────────────────────────────────────────────────────────────────
const members = loadDefaultMembers();
const { map: index, collisions } = buildBeneficiaryIndex(members);

const errors = [];
const warnings = [];
let totalDependents = 0;
let photosMissing = 0;

for (const m of members) {
  const label = `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.id;

  if (!m.cmuNumber) errors.push(`[${label}] Code CSU absent`);
  else if (!CODE_FORMAT.test(m.cmuNumber.toUpperCase()))
    warnings.push(`[${label}] Format de code inhabituel : ${m.cmuNumber}`);

  if (!m.firstName || !m.lastName) errors.push(`[${label}] Nom/Prénom manquant`);
  if (!m.birthDate) errors.push(`[${label}] Date de naissance manquante`);
  if (!m.departmentUnionId) warnings.push(`[${label}] Union départementale absente (repli DKR à la vérification)`);
  if (!getValidPhone(m.phone, null, '').replace(/\s/g, ''))
    warnings.push(`[${label}] Téléphone invalide (repli « 77 631 71 73 » à la vérification)`);

  const photo = checkPhoto(m.photoUrl);
  if (!photo.ok) {
    photosMissing++;
    errors.push(`[${label}] Photo officielle — ${photo.note}`);
  }

  // Unicité stricte du code du titulaire
  if (index.get((m.cmuNumber || '').toUpperCase())?.member !== m)
    warnings.push(`[${label}] Le code ${m.cmuNumber} n'est pas indexé sur ce titulaire`);

  for (const [idx, d] of (m.dependents || []).entries()) {
    totalDependents++;
    const depLabel = d.name || `ayant droit #${idx + 1}`;
    const suffix = d.codeSuffix || (d.isMajor ? `.1${idx + 1}` : `.M${idx + 1}`);
    const fullCode = `${(m.adherentCode || (m.cmuNumber || '').replace('.0', ''))}${suffix}`;

    const resolved = resolveScan(index, fullCode);
    if (!resolved) errors.push(`[${depLabel}] Scan QR introuvable pour le code ${fullCode}`);
    else if (resolved.dependent && resolved.dependent.name !== d.name)
      errors.push(`[${depLabel}] Collision : le code ${fullCode} résout vers « ${resolved.dependent.name} »`);
    else if (!resolved.dependent)
      warnings.push(`[${depLabel}] Le code ${fullCode} résout vers le titulaire plutôt que l'ayant droit`);

    const depPhoto = checkPhoto(d.photoUrl);
    if (!depPhoto.ok) {
      photosMissing++;
      warnings.push(`[${depLabel}] Photo — ${depPhoto.note}`);
    }
  }
}

// Contrôle de collision globale de l'index
const uniqueCollisions = [...new Set(collisions)];
for (const key of uniqueCollisions) errors.push(`Collision d'index : le code ${key} pointe vers plusieurs bénéficiaires`);

// ── Rapport ─────────────────────────────────────────────────────────────────
const line = '─'.repeat(72);
console.log(`\n${line}\n  AUDIT DES SCANS QR / BÉNÉFICIAIRES — MUTUALIS DAKAR\n${line}`);
console.log(`  Bénéficiaires titulaires  : ${members.length}`);
console.log(`  Ayants droit indexés      : ${totalDependents}`);
console.log(`  Clés d'index totales      : ${index.size}`);
console.log(`  Photos manquantes         : ${photosMissing}`);
console.log(`  Erreurs bloquantes        : ${errors.length}`);
console.log(`  Avertissements            : ${warnings.length}\n`);

if (errors.length) {
  console.log('❌ ERREURS :');
  for (const e of errors) console.log(`   • ${e}`);
  console.log('');
}
if (warnings.length) {
  console.log('⚠️  AVERTISSEMENTS :');
  for (const w of warnings) console.log(`   • ${w}`);
  console.log('');
}
if (!errors.length && !warnings.length) {
  console.log('✅ Tous les scans QR sont résolubles, uniques et complets.\n');
}

if (STRICT && errors.length) process.exit(1);
