// Tests de la résolution des ayants droit mineurs d'un adhérent.
// Couvre les DEUX formes de données rencontrées en production :
//  A. mineurs IMBRIQUÉS (import Excel) via `member.dependents` ;
//  B. mineurs PLATS « sœurs » (API) : fiches séparées même base de code.
// Règle métier : la minorité se déduit de l'âge (< 18 ans), jamais du rang
// du suffixe ; seul le chef de ménage prend les mineurs en charge.
import { describe, it, expect } from 'vitest';
import { resolveMinorDependents, collectAttachedMinorIds, householdBase, MINOR_AGE } from '../utils/householdMinors';

// Date de naissance d'un enfant de `age` ans ( borne basse pour rester mineur).
const birthDateAgo = (years) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};

describe('householdBase', () => {
  it('retire le suffixe de rang final', () => {
    expect(householdBase('DKR-DKR-2026-2251.2')).toBe('DKR-DKR-2026-2251');
    expect(householdBase('DKR_260002.0')).toBe('DKR_260002');
    expect(householdBase('DKR_260002')).toBe('DKR_260002');
  });

  it('renvoie une chaîne vide pour un code absent', () => {
    expect(householdBase(undefined)).toBe('');
    expect(householdBase('')).toBe('');
  });
});

describe('resolveMinorDependents — forme PLATE (fiches sœurs de l’API)', () => {
  it('rattache un enfant mineur à son adhérent (chef de ménage)', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2251.1', firstName: 'OUMY', lastName: 'SENE', birthDate: birthDateAgo(40) },
      { cmuNumber: 'DKR-DKR-2026-2251.2', firstName: 'AWA', lastName: 'CISSE', birthDate: birthDateAgo(17) },
    ];
    const chef = members[0];
    const mineurs = resolveMinorDependents(members, chef);
    expect(mineurs).toHaveLength(1);
    expect(mineurs[0].name).toBe('AWA CISSE');
    expect(mineurs[0].cmuNumber).toBe('DKR-DKR-2026-2251.2');
    expect(mineurs[0].age).toBeLessThan(MINOR_AGE);
    expect(mineurs[0].isMajor).toBe(false);
  });

  it('ignore une fiche sœur MAJEURE (âge ≥ 18) : elle a sa propre carte', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2151.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(60) },
      { cmuNumber: 'DKR-DKR-2026-2151.2', firstName: 'BATOR', lastName: 'SAMB', birthDate: birthDateAgo(47) },
    ];
    expect(resolveMinorDependents(members, members[0])).toHaveLength(0);
  });

  it('n’attribue PAS les mineurs à une fiche sœur qui n’est pas chef', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2251.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { cmuNumber: 'DKR-DKR-2026-2251.2', firstName: 'PARENT', lastName: 'Y', birthDate: birthDateAgo(30) },
      { cmuNumber: 'DKR-DKR-2026-2251.3', firstName: 'ENFANT', lastName: 'Y', birthDate: birthDateAgo(6) },
    ];
    // Le .2 (majeur) ne prend PAS en charge le .3 : seul le .1 est chef.
    expect(resolveMinorDependents(members, members[1])).toHaveLength(0);
    // Le chef .1 prend bien le .3 mineur en charge.
    expect(resolveMinorDependents(members, members[0])).toHaveLength(1);
  });

  it('respecte un ayant droit explicitement majeur même si âge < 18', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2300.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { cmuNumber: 'DKR-DKR-2026-2300.2', firstName: 'MAJEUR', lastName: 'Y', birthDate: birthDateAgo(16), isMajor: true },
    ];
    expect(resolveMinorDependents(members, members[0])).toHaveLength(0);
  });

  it('ne devine PAS un mineur sans date de naissance fiable', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2301.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { cmuNumber: 'DKR-DKR-2026-2301.2', firstName: 'SANS', lastName: 'DATE', birthDate: '' },
    ];
    expect(resolveMinorDependents(members, members[0])).toHaveLength(0);
  });

  it('compte plusieurs mineurs d’un même ménage', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2302.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { cmuNumber: 'DKR-DKR-2026-2302.2', firstName: 'ENF1', lastName: 'X', birthDate: birthDateAgo(10) },
      { cmuNumber: 'DKR-DKR-2026-2302.3', firstName: 'ENF2', lastName: 'X', birthDate: birthDateAgo(5) },
    ];
    expect(resolveMinorDependents(members, members[0])).toHaveLength(2);
  });

  it('compte un NOURRISSON de moins d’1 an (âge 0 mais date exploitable)', () => {
    const members = [
      { cmuNumber: 'DKR-DKR-2026-2303.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { cmuNumber: 'DKR-DKR-2026-2303.2', firstName: 'BEBE', lastName: 'X', birthDate: birthDateAgo(0) },
    ];
    const mineurs = resolveMinorDependents(members, members[0]);
    expect(mineurs).toHaveLength(1);
    expect(mineurs[0].age).toBe(0);
    expect(mineurs[0].isMajor).toBe(false);
  });
});

describe('resolveMinorDependents — forme IMBRIQUÉE (import Excel)', () => {
  it('lit les dependents non majeurs', () => {
    const chef = {
      cmuNumber: 'DKR_260001.0',
      firstName: 'CHEF',
      lastName: 'X',
      dependents: [
        { name: 'Enfant Mineur', isMajor: false, codeSuffix: '.1', birthDate: birthDateAgo(8) },
        { name: 'Ayant Majeur', isMajor: true, codeSuffix: '.2', birthDate: birthDateAgo(30) },
      ],
    };
    const mineurs = resolveMinorDependents([chef], chef);
    expect(mineurs).toHaveLength(1);
    expect(mineurs[0].name).toBe('Enfant Mineur');
    expect(mineurs[0].isMajor).toBe(false);
  });

  it('renvoie un tableau vide sans currentMember', () => {
    expect(resolveMinorDependents([], null)).toEqual([]);
    expect(resolveMinorDependents([], undefined)).toEqual([]);
  });
});

describe('collectAttachedMinorIds — exclusion des cartes imprimables', () => {
  it('retire les ids ET cmuNumbers des mineurs rattachés à un chef', () => {
    const members = [
      { id: 'A', cmuNumber: 'DKR-DKR-2026-2251.1', firstName: 'OUMY', lastName: 'SENE', birthDate: birthDateAgo(40) },
      { id: 'B', cmuNumber: 'DKR-DKR-2026-2251.2', firstName: 'AWA', lastName: 'CISSE', birthDate: birthDateAgo(17) },
    ];
    const ids = collectAttachedMinorIds(members);
    // La fiche mineure B est retirée (id + code), le chef A reste.
    expect(ids.has('B')).toBe(true);
    expect(ids.has('DKR-DKR-2026-2251.2')).toBe(true);
    expect(ids.has('A')).toBe(false);
    expect(ids.has('DKR-DKR-2026-2251.1')).toBe(false);
  });

  it('NE retire PAS un ayant droit majeur (il garde sa propre carte)', () => {
    const members = [
      { id: 'A', cmuNumber: 'DKR-DKR-2026-2151.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(60) },
      { id: 'B', cmuNumber: 'DKR-DKR-2026-2151.2', firstName: 'BATOR', lastName: 'SAMB', birthDate: birthDateAgo(47) },
    ];
    expect(collectAttachedMinorIds(members).size).toBe(0);
  });

  it('respecte un ayant droit explicitement majeur même si âge < 18', () => {
    const members = [
      { id: 'A', cmuNumber: 'DKR-DKR-2026-2300.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { id: 'B', cmuNumber: 'DKR-DKR-2026-2300.2', firstName: 'MAJEUR', lastName: 'Y', birthDate: birthDateAgo(16), isMajor: true },
    ];
    expect(collectAttachedMinorIds(members).size).toBe(0);
  });

  it('coordonné avec resolveMinorDependents : mêmes mineurs des deux côtés', () => {
    const members = [
      { id: 'A', cmuNumber: 'DKR-DKR-2026-2302.1', firstName: 'CHEF', lastName: 'X', birthDate: birthDateAgo(40) },
      { id: 'B', cmuNumber: 'DKR-DKR-2026-2302.2', firstName: 'ENF1', lastName: 'X', birthDate: birthDateAgo(10) },
      { id: 'C', cmuNumber: 'DKR-DKR-2026-2302.3', firstName: 'ENF2', lastName: 'X', birthDate: birthDateAgo(5) },
    ];
    const mineurs = resolveMinorDependents(members, members[0]);
    const ids = collectAttachedMinorIds(members);
    // Chaque mineur résolu pour le chef est bien retiré de la liste imprimable.
    expect(mineurs).toHaveLength(2);
    for (const m of mineurs) expect(ids.has(m.cmuNumber)).toBe(true);
    // Le chef, lui, reste imprimable.
    expect(ids.has('A')).toBe(false);
  });

  it('renvoie un set vide pour un registre vide ou sans ménage', () => {
    expect(collectAttachedMinorIds([]).size).toBe(0);
    expect(collectAttachedMinorIds(undefined).size).toBe(0);
    expect(collectAttachedMinorIds([{ id: 'A', cmuNumber: 'DKR-DKR-2026-9999.1', birthDate: birthDateAgo(40) }]).size).toBe(0);
  });
});

