import { describe, it, expect } from 'vitest';
import { dedupeMembers } from '../utils/beneficiaryStore';

/**
 * Un même bénéficiaire peut entrer deux fois dans le studio (import Excel +
 * adhésion en ligne, restauration serveur, ancien cache). La déduplication
 * conserve la fiche la plus complète et fusionne les informations manquantes :
 * aucune donnée ne doit être perdue.
 */
describe('Déduplication des fiches bénéficiaires', () => {
  const base = {
    id: 'MEM-1',
    cmuNumber: 'EDU_MBK_26000164',
    firstName: 'MAMADOU',
    lastName: 'FALL',
    birthDate: '20/07/2013',
    photoUrl: '/msd_photos/mamadou.jpg',
    hasOfficialPhoto: true,
    verificationStatus: 'VERIFIED',
    dependents: []
  };

  it('laisse une liste sans doublon inchangée', () => {
    const { members, removed } = dedupeMembers([base, { ...base, id: 'MEM-2' }, { id: 'X', cmuNumber: 'EDU_DKR_1' }]);
    // MEM-1 et MEM-2 partagent le même code : un seul doit subsister.
    expect(removed).toBe(1);
    expect(members).toHaveLength(2);
  });

  it('fusionne deux fiches portant le même code CSU', () => {
    const copy = { ...base, id: 'MEM-DUP', photoUrl: '', hasOfficialPhoto: false };
    const { members, removed } = dedupeMembers([base, copy]);
    expect(removed).toBe(1);
    expect(members).toHaveLength(1);
    // La fiche la plus complète (avec photo) est conservée.
    expect(members[0].photoUrl).toBe(base.photoUrl);
  });

  it('reconnaît un doublon sans code, par nom + date de naissance', () => {
    const a = { id: 'A', cmuNumber: '', firstName: 'Awa', lastName: 'Ndiaye', birthDate: '01/02/2015' };
    const b = { id: 'B', cmuNumber: '', firstName: 'Awa', lastName: 'Ndiaye', birthDate: '01/02/2015' };
    const { members, removed } = dedupeMembers([a, b]);
    expect(removed).toBe(1);
    expect(members).toHaveLength(1);
  });

  it('ne confond pas deux personnes différentes', () => {
    const a = { id: 'A', cmuNumber: 'EDU_DKR_1', firstName: 'Mamadou', lastName: 'FALL' };
    const b = { id: 'B', cmuNumber: 'EDU_DKR_2', firstName: 'Mamadou', lastName: 'FALL' };
    const { members, removed } = dedupeMembers([a, b]);
    expect(removed).toBe(0);
    expect(members).toHaveLength(2);
  });

  it('complète les champs manquants depuis la fiche fusionnée', () => {
    const poor = { ...base, id: 'P', tuteurName: '', tuteurPhone: '' };
    const rich = { ...base, id: 'R', photoUrl: '', tuteurName: 'Serigne Modou MBACKE', tuteurPhone: '70 555 12 34' };
    const { members } = dedupeMembers([poor, rich]);
    const kept = members[0];
    // La photo vient de la première fiche, le tuteur de la seconde.
    expect(kept.photoUrl).toBe(base.photoUrl);
    expect(kept.tuteurName).toBe('Serigne Modou MBACKE');
    expect(kept.tuteurPhone).toBe('70 555 12 34');
  });

  it('conserve la liste d\'ayants droit la plus complète', () => {
    const withKids = { ...base, id: 'K', dependents: [{ name: 'A' }, { name: 'B' }] };
    const noKids = { ...base, id: 'N', dependents: [] };
    const { members } = dedupeMembers([noKids, withKids]);
    expect(members[0].dependents).toHaveLength(2);
  });

  it('tolère une entrée vide ou invalide', () => {
    expect(dedupeMembers(null).members).toEqual([]);
    expect(dedupeMembers(undefined).removed).toBe(0);
  });

  it('ne supprime PAS une fiche sans identité exploitable', () => {
    const orphan = { id: 'ORPHAN' };
    const { members, removed } = dedupeMembers([orphan, { id: 'ORPHAN2' }]);
    expect(removed).toBe(0);
    expect(members).toHaveLength(2);
  });
});
