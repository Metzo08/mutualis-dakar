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
 * Structure RÉELLE du fichier « Ville de Dakar » (AMEVI) : le code comporte
 * SIX chiffres (`DKR_260001.0`), là où Grand Yoff en porte SEPT
 * (`DKR_2600111.0`). Un parseur réglé sur 7 chiffres lit le premier et perd le
 * second : le code arrive vide, l'import bascule alors sur la génération d'un
 * matricule, et Moustapha NDIONE se retrouve avec `DKR-DKR-2026-0001.1` au
 * lieu de `DKR_260001.0` — un code absent de sa carte.
 */
describe('Import du fichier Ville de Dakar (AMEVI) — codes à 6 chiffres', () => {
  const lignes = parseRowsToRecords([
    { CODE_BENEFICIAIRE: 'DKR_260001.0', NUMERO_ADHERENT: 'DKR_260326', PRENOM: 'MOUSTAPHA NDIONE', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03' },
    { CODE_BENEFICIAIRE: 'DKR_260001.1', NUMERO_ADHERENT: 'DKR_260326', PRENOM: 'ASSI', NOM: 'SECK', DATE_NAISSANCE: '1976-11-24' },
    { CODE_BENEFICIAIRE: 'DKR_260001.2', NUMERO_ADHERENT: 'DKR_260326', PRENOM: 'FAMILLE', NOM: 'NDIONE', DATE_NAISSANCE: '2005-06-02' },
    { CODE_BENEFICIAIRE: 'DKR_260002.0', NUMERO_ADHERENT: 'DKR_260327', PRENOM: 'AWA', NOM: 'SECK', DATE_NAISSANCE: '1980-05-11' }
  ]);

  it('lit le code du fichier et ne fabrique aucun matricule', async () => {
    const members = await buildStudioMembers(lignes);
    const all = [];
    members.forEach((m) => {
      all.push(m.cmuNumber);
      (m.dependents || []).forEach((d) => all.push(d.cmuNumber || `${m.cmuNumber}${d.codeSuffix || ''}`));
    });
    // Aucun matricule calculé : c'est le symptôme du bug.
    expect(all.filter((c) => /DKR-DKR-/.test(c))).toEqual([]);
  });

  it('donne à MOUSTAPHA NDIONE le code de sa carte', async () => {
    const members = await buildStudioMembers(lignes);
    const moustapha = members.find((m) => m.firstName.includes('MOUSTAPHA'));
    expect(moustapha).toBeDefined();
    // `DKR_260001` : le « .0 » du chef est normalisé, la recherche par code
    // résout les deux écritures (scan du PVC compris).
    expect(moustapha.cmuNumber).toBe('DKR_260001.0');
    expect(moustapha.sourceCode).toBe('DKR_260001.0');
  });

  it('regroupe le ménage DKR_260001 avec ses ayants droit', async () => {
    const members = await buildStudioMembers(lignes);
    expect(members).toHaveLength(2);          // deux ménages
    const moustapha = members.find((m) => m.firstName.includes('MOUSTAPHA'));
    expect(moustapha.dependents).toHaveLength(2);
  });

  it('conserve le suffixe des ayants droit', async () => {
    const members = await buildStudioMembers(lignes);
    const moustapha = members.find((m) => m.firstName.includes('MOUSTAPHA'));
    const codes = moustapha.dependents.map((d) => d.cmuNumber);
    expect(codes).toContain('DKR_260001.1');
    expect(codes).toContain('DKR_260001.2');
  });
});

/**
 * Nom de famille recopié dans la colonne prénom.
 *
 * Sur le fichier « Ville de Dakar », deux lignes portent
 * PRENOM_BENEFICIAIRE = « MOUSTAPHA NDIONE » pour NOM_BENEFICIAIRE = « NDIONE ».
 * La carte affichait « Prénom(s) : MOUSTAPHA NDIONE » et « Nom : NDIONE ».
 *
 * Le code est celui du PVC : une saisie fautive ne doit pas se propager
 * jusqu'à la carte imprimée.
 */
describe('Prénom contenant le nom de famille', () => {
  const lignes = parseRowsToRecords([
    { CODE_BENEFICIAIRE: 'DKR_260001.0', PRENOM: 'MOUSTAPHA NDIONE', NOM: 'NDIONE', DATE_NAISSANCE: '1972-01-03' },
    { CODE_BENEFICIAIRE: 'DKR_260002.0', PRENOM: 'MOUHAMED YORO THIAM', NOM: 'THIAM', DATE_NAISSANCE: '1980-05-11' },
    { CODE_BENEFICIAIRE: 'DKR_260003.0', PRENOM: 'MOUSTAPHA', NOM: 'NDIONE', DATE_NAISSANCE: '1975-02-02' }
  ]);

  it('retire le nom répété et ne garde que le prénom', async () => {
    const members = await buildStudioMembers(lignes);
    const moustapha = members.find((m) => m.cmuNumber === 'DKR_260001.0');
    expect(moustapha.firstName).toBe('MOUSTAPHA');
    expect(moustapha.lastName).toBe('NDIONE');
  });

  it('conserve un prénom composé quand le nom ne le répète pas', async () => {
    const members = await buildStudioMembers(lignes);
    const thiam = members.find((m) => m.cmuNumber === 'DKR_260002.0');
    expect(thiam.firstName).toBe('MOUHAMED YORO');
    expect(thiam.lastName).toBe('THIAM');
  });

  it('laisse intact un prénom qui ne répète pas le nom', async () => {
    const members = await buildStudioMembers(lignes);
    const simple = members.find((m) => m.cmuNumber === 'DKR_260003.0');
    expect(simple.firstName).toBe('MOUSTAPHA');
    expect(simple.lastName).toBe('NDIONE');
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