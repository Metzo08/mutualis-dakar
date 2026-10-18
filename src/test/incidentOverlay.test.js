// ── Non-régression : le handler d'incident global ne doit JAMAIS toucher #root ──
//
// BUG RÉEL (15/10/2026, frontend_error.log) : `index.html` installait un
// `window.addEventListener('error')` qui écrasait `#root` via
// `div.innerHTML = ...` à la moindre erreur JS. Cela détruisait l'arbre React
// hors de son contrôle : le prochain commit levait « Failed to execute
// removeChild on 'Node' » et TOUTE l'application tombait sur l'écran
// « Une erreur inattendue est survenue » jusqu'au rechargement.
//
// Ce test verrouille la règle : le garde-fou d'incident s'affiche dans un
// calque APPENDÉ à document.body, jamais dans #root, et n'utilise jamais
// innerHTML (injection possible via le texte d'erreur).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'index.html'),
  'utf8'
);

describe("index.html — garde-fou d'incident global", () => {
  it("n'écrit JAMAIS dans #root (innerHTML interdit)", () => {
    expect(html).not.toMatch(/getElementById\(['"]root['"]\)[\s\S]{0,80}innerHTML/);
    expect(html).not.toMatch(/root['"]\)\s*\.\s*innerHTML/);
  });

  it("affiche l'incident dans un calque détaché de #root", () => {
    // Le calque est identifié et rattaché à document.body, pas à #root.
    expect(html).toContain('mutualis-incident-overlay');
    expect(html).toMatch(/document\.body\.appendChild\(overlay\)/);
  });

  it("n'injecte jamais le message d'erreur comme du markup (textContent only)", () => {
    expect(html).toMatch(/pre\.textContent\s*=\s*errText/);
    // Interdit la concaténation historique qui construisait du HTML.
    expect(html).not.toMatch(/'<pre[^']*'\s*\+\s*errText/);
  });

  it("reste consultable : le bandeau propose de continuer (pas de reload forcé)", () => {
    expect(html).toMatch(/Fermer \(continuer\)/);
  });
});
