// ── Regression : le quota local ne doit plus dependre des photos ──────────────
// Symptome signale : « 142 dossier(s) affiches mais NON enregistres : Espace de
// stockage local insuffisant (4,71 Mo necessaires) ». 154 fiches photos ->
// base64 ecrit en local -> plafond (~5 Mo) depasse -> RIEN n'est ecrit, et les
// fiches disparaissent au rechargement.

import { describe, it, expect, beforeEach } from 'vitest';
import { saveStoredMembers, formatOctets } from '../utils/beneficiaryStore';

describe('Import Grand Yoff : le quota local ne depend plus des photos', () => {
  let store;
  let budget;

  beforeEach(() => {
    store = new Map();
    budget = 5 * 1024 * 1024; // plafond Chrome
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: {
        setItem: (k, v) => {
          const prev = store.get(k);
          const size = (v ? v.length : 0) - (prev ? prev.length : 0);
          if (size > budget) {
            const err = new Error('quota');
            err.name = 'QuotaExceededError';
            throw err;
          }
          budget -= size;
          store.set(k, v);
        },
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        removeItem: (k) => { store.delete(k); },
      },
    });
  });

  // 154 fiches avec photo ~20 Ko en base64 = le volume fautif.
  const photo = 'data:image/jpeg;base64,' + 'A'.repeat(20 * 1024);
  const members = Array.from({ length: 154 }, (_, i) => ({
    cmuNumber: `DKR-DKR-2026-${2151 + i}.1`,
    firstName: 'MAFOU',
    lastName: 'DIEDHIOU',
    photoUrl: photo,
    dependents: [
      { cmuNumber: `DKR-DKR-2026-${2151 + i}.2`, photoUrl: photo },
    ],
  }));

  it('enregistre les 154 fiches au lieu d echouer sur le quota', () => {
    const res = saveStoredMembers(members);

    expect(res.ok).toBe(true);
    expect(res.quotaExceeded).toBe(false);
    expect(res.error).toBe(null);

    const apres = JSON.parse(store.get('unamusc_beneficiaries_store_v21'));
    expect(apres).toHaveLength(154);
  });

  it('retire les photos embarquees, fiche ET ayants droit', () => {
    saveStoredMembers(members);

    const apres = JSON.parse(store.get('unamusc_beneficiaries_store_v21'));
    expect(apres[0].photoUrl).toBe('');
    expect(apres[0].dependents[0].photoUrl).toBe('');
  });

  it('reduit le volume ecrit de plusieurs Mo a quelques Ko', () => {
    const res = saveStoredMembers(members);

    // Sans ce nettoyage : ~6 Mo, donc refus systematique.
    expect(res.bytes).toBeLessThan(500 * 1024);
    console.log(`       (avant: ${formatOctets(JSON.stringify(members).length)} / ecrit: ${formatOctets(res.bytes)})`);
  });
});