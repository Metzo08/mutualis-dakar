import { describe, it, expect } from 'vitest';
import { parseRowsToRecords, buildStudioMembers } from '../utils/bulkImport';

/**
 * Le fichier ASS LONASE ne contient QUE des ayants droit : 122 lignes, toutes
 * suffixées (`.1`, `.2`…), et AUCUN titulaire (`.0`). Chaque personne est donc
 * le premier — et seul — membre de sa base de code.
 *
 * RISQUE ÉVIDENT
 * Si l'import Traits la première ligne d'une base comme « chef de ménage » et
 * lui retire son suffixe, la fiche passe de `DKR_2600040.1` à `DKR_2600040` :
 * un code qui n'est PAS celui gravé sur le PVC. La carte de cette personne
 * deviendrait introuvable au scan.
 *
 * Ces tests rejouent cette structure réelle et verrouillent le comportement.
 */
describe('Import d\'un fichier sans titulaire (structure ASS LONASE)', () => {
  // Trois bases distinctes, chacune avec un seul ayant droit, comme le fichier.
  const lignes = parseRowsToRecords([
    { CODE_BENEFICIAIRE: 'DKR_2600040.1', PRENOM: 'PAPA IBRAHIMA', NOM: 'SEYE', DATE_NAISSANCE: '1948-04-25' },
    { CODE_BENEFICIAIRE: 'DKR_2600041.1', PRENOM: 'ELHADJI MALICK', NOM: 'FALL', DATE_NAISSANCE: '1962-05-26' },
    { CODE_BENEFICIAIRE: 'KRM_2600105.1', PRENOM: 'MOR MBABA', NOM: 'NDIAYE', DATE_NAISSANCE: '1953-01-01' }
  ]);

  it('conserve le suffixe .1 : le code du PVC ne perd rien', async () => {
    const members = await buildStudioMembers(lignes);
    const codes = members.map((m) => m.cmuNumber);
    expect(codes).toContain('DKR_2600040.1');
    expect(codes).toContain('DKR_2600041.1');
    expect(codes).toContain('KRM_2600105.1');
  });

  it('n\'invente aucun matricule pour ces cartes déjà imprimées', async () => {
    const members = await buildStudioMembers(lignes);
    members.forEach((m) => {
      expect(m.cmuNumber).not.toMatch(/DKR-DKR-/);
    });
  });

  it('conserve le préfixe d\'autres MSD (KRM = Pikine, pas Dakar)', async () => {
    const members = await buildStudioMembers(lignes);
    // Chaque MSD reste identifiable par son préfixe : c'est ce qui cloisonne
    // les données par MSD après import.
    expect(members.find((m) => m.firstName === 'MOR MBABA').cmuNumber.startsWith('KRM_')).toBe(true);
  });

  it('crée une fiche par personne, sans les fusionner', async () => {
    const members = await buildStudioMembers(lignes);
    expect(members).toHaveLength(3);
  });
});

/**
 * Cas nominal : un ménage complet, chef `.0` et ayants `.1`/`.2`.
 * Le code du chef est normalisé (`.0` retiré) car la recherche par code résout
 * les deux écritures — mais les ayants droit gardent leur suffixe, qui est ce
 * qui les distingue sur la carte.
 */
describe('Import d\'un ménage complet (chef + ayants droit)', () => {
  const lignes = parseRowsToRecords([
    { CODE_BENEFICIAIRE: 'DKR_2600111.0', PRENOM: 'MAFOU', NOM: 'DIEDHIOU', DATE_NAISSANCE: '1975-01-05' },
    { CODE_BENEFICIAIRE: 'DKR_2600111.1', PRENOM: 'BATOR', NOM: 'SAMB', DATE_NAISSANCE: '1979-01-27' },
    { CODE_BENEFICIAIRE: 'DKR_2600111.2', PRENOM: 'ARONA', NOM: 'DIEDHIOU', DATE_NAISSANCE: '2001-03-14' }
  ]);

  it('regroupe les trois personnes sous un seul dossier', async () => {
    const members = await buildStudioMembers(lignes);
    expect(members).toHaveLength(1);
    expect(members[0].dependents).toHaveLength(2);
  });

  it('ne fabrique aucun matricule', async () => {
    const members = await buildStudioMembers(lignes);
    expect(members[0].cmuNumber).not.toMatch(/DKR-DKR-/);
    expect(members[0].dependents.every((d) => !/DKR-DKR-/.test(d.cmuNumber))).toBe(true);
  });

  it('donne un code distinct à chaque personne du ménage', async () => {
    const [chef] = await buildStudioMembers(lignes);
    const codes = [chef.cmuNumber, ...chef.dependents.map((d) => d.cmuNumber)];
    expect(new Set(codes).size).toBe(3);
  });
});