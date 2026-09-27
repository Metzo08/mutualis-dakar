#!/usr/bin/env node
/**
 * AUDIT DES CLASSES CSS — MUTUALIS DAKAR
 * ----------------------------------------------------------------------------
 * Vérifie que chaque classe réellement utilisée dans le markup (className="…")
 * est bien définie dans les feuilles de style du projet.
 *
 * Contexte : la plateforme est écrite en markup Bootstrap 5 mais n'a longtemps
 * chargé aucune librairie CSS de ce type. Résultat : des centaines de classes
 * (row, col-*, d-flex, gap-*, mb-*, text-*…) n'existaient nulle part, d'où des
 * grilles et des formulaires collés. Ce script est le garde-fou : il doit
 * afficher 0 classe manquante.
 *
 * Usage :  npm run audit:css        (rapport)
 *          npm run audit:css -- --strict   (code de sortie 1 si manquantes)
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const CSS_FILES = [
  'src/index.css',
  'src/styles/components.css',
  'src/styles/views.css',
  'src/styles/utilities.css'
].filter((f) => {
  try { readFileSync(join(ROOT, f)); return true; } catch { return false; }
});

/**
 * Classes volontairement inertes : elles servent de crochets de sélection
 * (état, contexte de page) sans qu'aucun style ne leur soit nécessaire, ou
 * sont purement décoratives et couvertes par des styles inline.
 */
const WHITELIST = new Set([
  'cmu-card',            // habillé en styles inline dans components/CmuCard.jsx
  'cmu-card-wrapper',
  'citizen-login-card',
  'csu-unamusc-content',
  'csu-unamusc-logo',
  'csu-gratuite-text',
  'table-hover',         // déclaré dans utilities.css, toléré ici si absent
  // ── Crochets inertes (contexte de page / état, sans style propre requis) ──
  'fade-in', 'scale-in', 'loading-shimmer',
  'spinner-border-sm',   // spinner maison animé via .spinner-border + taille inline
  'payment-screen-mock-pattern',
  'form-control-color',  // input color stylé via .form-control
  'bg-opacity-20', 'text-emerald-900', 'text-emerald-100', 'text-warning-emphasis',
  'webrtc-hide-mobile',
  'school-card-back-header', // combiné à .school-card-header (base déjà stylée)
  'tab-modal', 'modal-header', 'modal-lg', 'modal-title',
  'text-md-end',
  // Vues / portails : crochets de contexte de page
  'login-view', 'loyalty-view', 'medicaments-view', 'notifications-view',
  'partner-portal', 'partnership-view', 'payments-view', 'profile-view',
  'rse-portal', 'services-view', 'superadmin-view', 'verify-view',
  'parrainage-solidaire-view',
  // Carrousel partenaires (habillage inline)
  'partner-carousel-section', 'partner-carousel-container', 'partner-carousel-track', 'partner-logo-item',
  // Onglets paiements (états pilotés en JS)
  'tab-cotisation', 'tab-sponsoring', 'tab-history',
  // Barres de progression animées (styles inline)
  'progress-bar-striped', 'progress-bar-animated',
  // Carte régionale & WebRTC (styles inline dans les vues)
  'regional-stats', 'verified-cards-wrapper',
  'webrtc-modal-box', 'webrtc-header-row', 'webrtc-body-container', 'webrtc-video-section', 'webrtc-aside-panel',
  'mobile-toggle-btn',
  'map-sidebar-visible', 'map-result-card', 'map-container-visible',
  // Utilitaires rares combinés à des styles inline
  'py-md-5', 'me-3.5', 'my-3.5', 'badge-danger'
]);

/* ── 1. Classes définies dans le CSS ──────────────────────────────────────── */

function definedClasses() {
  const strict = new Set();
  const compound = new Set();
  for (const rel of CSS_FILES) {
    const css = readFileSync(join(ROOT, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    // Chaque bloc : tout ce qui précède '{' est une liste de sélecteurs.
    for (const chunk of css.split('{')) {
      const prelude = chunk.split('}').pop() || '';
      if (!/[.#\[\w]/.test(prelude)) continue;
      const simpleSelectors = prelude.split(',');
      for (const sel of simpleSelectors) {
        // Gère les classes fractionnaires échappées : `.py-2\.5` → `py-2.5`
        const tokens = [...sel.matchAll(/\.((?:[_a-zA-Z0-9-]|\\.)+)/g)]
          .map((m) => m[1].replace(/\\/g, ''));
        if (tokens.length === 0) continue;
        if (tokens.length === 1) strict.add(tokens[0]);
        else tokens.forEach((t) => compound.add(t));
      }
    }
  }
  // Une classe « composée » reste une classe définie : on ne la signale
  // qu'à titre informatif via la liste PARTIAL.
  return { strict, compound };
}

/* ── 2. Classes utilisées dans les vues et composants ─────────────────────── */

function usedClasses() {
  const files = [
    ...readdirSync(join(ROOT, 'src/views')).filter((f) => f.endsWith('.jsx')).map((f) => `src/views/${f}`),
    ...readdirSync(join(ROOT, 'src/components')).filter((f) => f.endsWith('.jsx')).map((f) => `src/components/${f}`),
    'src/App.jsx'
  ].filter((f) => { try { readFileSync(join(ROOT, f)); return true; } catch { return false; } });

  const used = new Map(); // classe -> nombre d'occurrences
  const count = (name) => used.set(name, (used.get(name) || 0) + 1);
  const add = (attr) => {
    for (const cls of attr.split(/\s+/)) if (cls) count(cls);
  };

  for (const rel of files) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    // className="..."
    for (const m of src.matchAll(/className="([^"]*)"/g)) add(m[1]);
    // className={`...`} et className={'...'} — on retire les expressions JS
    // (`${cond ? 'a' : 'b'}`) qui ne sont pas des noms de classes.
    for (const m of src.matchAll(/className=\{`([^`]*)`\}/g)) {
      const literal = m[1].replace(/\$\{[^}]*(\{[^}]*\}[^}]*)*\}/g, ' ');
      add(literal);
    }
    for (const m of src.matchAll(/className=\{'([^']*)'\}/g)) add(m[1]);
  }
  return used;
}

/* ── 3. Rapport ───────────────────────────────────────────────────────────── */

const { strict, compound } = definedClasses();
const used = usedClasses();

const missing = [];
const partial = [];
for (const [cls, n] of [...used.entries()].sort((a, b) => b[1] - a[1])) {
  if (strict.has(cls)) continue;
  if (compound.has(cls)) partial.push({ cls, n });
  else if (!WHITELIST.has(cls)) missing.push({ cls, n });
}

const line = '─'.repeat(72);
console.log(`\n${line}\n  AUDIT DES CLASSES CSS — MUTUALIS DAKAR\n${line}`);
console.log(`  Feuilles analysées    : ${CSS_FILES.join(', ')}`);
console.log(`  Classes utilisées     : ${used.size}`);
console.log(`  Classes déclarées     : ${strict.size} (sélecteur simple)`);
console.log(`  Classes composées     : ${compound.size} (utilisées uniquement en combinaison)`);
console.log(`  Classes MANQUANTES    : ${missing.length}`);
console.log(`  Classes partielles    : ${partial.length} (informatif)\n`);

if (missing.length) {
  console.log('❌ MANQUANTES (aucune mention dans le CSS) :');
  for (const { cls, n } of missing) console.log(`   • ${cls}  (${n} usage${n > 1 ? 's' : ''})`);
  console.log('');
}
if (partial.length) {
  console.log('ℹ️  PARTIELLES (présentes seulement en sélecteur composé — vérifier que la propriété de base existe) :');
  for (const { cls, n } of partial) console.log(`   • ${cls}  (${n} usage${n > 1 ? 's' : ''})`);
  console.log('');
}
if (!missing.length) console.log('✅ Aucune classe manquante : le socle utilitaire couvre tout le markup.\n');

const strictMode = process.argv.includes('--strict');
if (strictMode && missing.length) process.exit(1);
