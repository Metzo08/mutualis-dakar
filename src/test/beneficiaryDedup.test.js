import { describe, it, expect, beforeEach } from 'vitest';
import { dedupeMembers, getStoredMembers, saveStoredMembers } from '../utils/beneficiaryStore';
import { resolveUnion, resolveCardProgram } from '../utils/cardPrograms';

/**
 * MAMADOU FALL (carte CMU-Daara, EDU_DRB_26000164) est élève du daara de
 * Touba : il relève de la MSD de Diourbel. Il était à tort rattaché à celle
 * de Dakar, ce qui désignait la mauvaise MSD émettrice sur sa carte et le
 * mauvais compte de paiement Kadev.
 *
 * Le registre n'étant plus embarqué, la fiche est injectée dans le localStorage :
 * le test porte sur la LOGIQUE de rattachement, pas sur la présence d'une
 * ligne dans un fichier figé du dépôt.
 */
describe('Rattachement de MAMADOU FALL', () => {
  const FICHE = {
    id: 'MEM-TEST-164',
    cmuNumber: 'EDU_DRB_26000164',
    adherentCode: 'EDU_DRB_26000164',
    rawCode: 'EDU_DRB_26000164',
    firstName: 'MAMADOU',
    lastName: 'FALL',
    birthDate: '20/07/2013',
    departmentUnionId: 'DRB',
    mutuelleOrigine: 'Mutuelle de Santé Départementale de Diourbel',
    cardProgram: 'CMU_DAARA',
    dependents: []
  };

  beforeEach(() => {
    localStorage.clear();
    saveStoredMembers([FICHE]);
  });

  // ⚠️ La fiche est relue À CHAQUE TEST : elle était résolue une seule fois,
  // au chargement du module — donc avant le beforeEach, sur un registre vide.
  const getMamadou = () => getStoredMembers().find((m) => m.cmuNumber === 'EDU_DRB_26000164');

  it('la fiche est lisible depuis le registre', () => {
    expect(getMamadou()).toBeDefined();
  });

  it('est rattaché à la MSD de Diourbel et non à celle de Dakar', () => {
    expect(getMamadou().departmentUnionId).toBe('DRB');
    expect(getMamadou().departmentUnionId).not.toBe('DKR');
  });

  it('porte la bonne dénomination de mutuelle', () => {
    expect(getMamadou().mutuelleOrigine).toBe('Mutuelle de Santé Départementale de Diourbel');
  });

  it('sa MSD émettrice est bien Diourbel', () => {
    const union = resolveUnion(getMamadou().departmentUnionId);
    expect(union.id).toBe('DRB');
    expect(union.region).toBe('Diourbel');
  });

  it('reste une carte CMU-Daara (pas de circuit IA/IEF)', () => {
    const program = resolveCardProgram(getMamadou().cardProgram);
    expect(program.id).toBe('CMU_DAARA');
    expect(program.showIef).toBe(false);
  });

  it('ne contredit pas la règle d\'unicité des fiches', () => {
    const members = getStoredMembers();
    const occurrences = members.filter(
      (m) => String(m.cmuNumber || '').includes('26000164')
    );
    expect(occurrences).toHaveLength(1);
  });

  it('porte un code préfixé par le code de sa MSD émettrice', () => {
    // Le préfixe du code doit désigner la MSD : DRB pour Diourbel. Il ne doit
    // plus porter MBK (Mbour), incohérent avec l'union déclarée.
    const mamadou = getMamadou();
    expect(mamadou.cmuNumber).toBe('EDU_DRB_26000164');
    expect(mamadou.cmuNumber.startsWith(`EDU_${mamadou.departmentUnionId}_`)).toBe(true);
    expect(mamadou.cmuNumber).not.toContain('MBK');
  });

  it('aligne adherentCode et rawCode sur le nouveau code', () => {
    const mamadou = getMamadou();
    expect(mamadou.adherentCode).toBe(mamadou.cmuNumber);
    expect(mamadou.rawCode).toBe(mamadou.cmuNumber);
  });

  it('ne conserve aucune fiche sous l\'ancien code MBK', () => {
    const members = getStoredMembers();
    expect(members.some((m) => String(m.cmuNumber || '').includes('EDU_MBK'))).toBe(false);
  });
});

/**
 * Un même bénéficiaire peut entrer deux fois dans le studio (import Excel +
 * adhésion en ligne, restauration serveur, ancien cache). La déduplication
 * conserve la fiche la plus complète et fusionne les informations manquantes :
 * aucune donnée ne doit être perdue.
 */
describe('Déduplication des fiches bénéficiaires', () => {
  const base = {
    id: 'MEM-1',
    cmuNumber: 'EDU_DRB_26000164',
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

