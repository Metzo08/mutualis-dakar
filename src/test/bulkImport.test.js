// Tests de l'import en masse des bénéficiaires (Excel MSD Dakar + photos).
// Couvre les cas RÉELS du classeur « Ville de Dakar msd Dakar.xlsx » :
// codes stockés en nombre (« DKR_2600011.0 »), dates en série Excel,
// colonne PHOTO, en-têtes avec/sans accents.
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  normalizeName,
  normalizePhone,
  canonicalCode,
  toIsoDate,
  pickColumn,
  parseRowsToRecords,
  filterValidRecords,
  matchPhotosToRows,
  parseExcelFile,
  generateUniqueCmuCode,
  beneficiaryIdentity,
  collectIdentities,
  buildStudioMembers,
  migrateLegacyCodes
} from '../utils/bulkImport';
import { isLegacyGeneratedCode, isOfficialCode } from '../utils/cmuCode';

/** Faux fichier : parseExcelFile n'utilise que .name et .arrayBuffer(). */
const fakeFile = (buffer, name = 'test.xlsx') => ({ name, arrayBuffer: async () => buffer });

describe('normalisations', () => {
  it('normalizeName supprime accents, espaces et casse', () => {
    expect(normalizeName('  Bineta  SOW ')).toBe('binetasow');
    expect(normalizeName('Mamadou FALL')).toBe('mamadoufall');
    expect(normalizeName(null)).toBe('');
  });

  it('normalizePhone ne garde que les chiffres', () => {
    expect(normalizePhone('(77) 631-71-73')).toBe('776317173');
    expect(normalizePhone('')).toBe('');
  });

  it('canonicalCode conserve le code tel quel et ne fait que le trimming', () => {
    // Le code imprimé sur la carte est repris AU CARACTÈRE PRÈS, suffixe « .0 »
    // compris : la fiche et le PVC ne peuvent pas diverger.
    expect(canonicalCode('DKR_2600011.0')).toBe('DKR_2600011.0');
    expect(canonicalCode('2600011.0')).toBe('2600011.0');
    expect(canonicalCode(' DAARA-2025-0078 ')).toBe('DAARA-2025-0078');
    expect(canonicalCode(null)).toBe('');
  });
});

describe('toIsoDate', () => {
  it('accepte un objet Date (option cellDates)', () => {
    expect(toIsoDate(new Date('2010-09-05T00:00:00Z'))).toBe('2010-09-05');
  });

  it('accepte ISO et JJ/MM/AAAA', () => {
    expect(toIsoDate('2010-09-05')).toBe('2010-09-05');
    expect(toIsoDate('05/09/2010')).toBe('2010-09-05');
    expect(toIsoDate('5/9/2010')).toBe('2010-09-05');
  });

  it('convertit la série Excel (jours depuis le 30/12/1899)', () => {
    // Valeurs de référence vérifiables dans Excel
    expect(toIsoDate('25569')).toBe('1970-01-01');
    expect(toIsoDate('36526')).toBe('2000-01-01');
    expect(toIsoDate(46023)).toBe('2026-01-01');
  });

  it('retourne une chaîne vide ou la valeur brute si non interprétable', () => {
    expect(toIsoDate('')).toBe('');
    expect(toIsoDate(null)).toBe('');
    expect(toIsoDate('inconnue')).toBe('inconnue');
  });
});

describe('parseRowsToRecords', () => {
  it('lit les en-têtes avec accents/underscores et canonise les codes', () => {
    const [r] = parseRowsToRecords([
      {
        CODE_BENEFICIAIRE: 'EDU_DKR_26000163.0',
        NUMERO_ADHERENT: 'EDU_DKR_26000163.0',
        PRENOM: 'Moussa',
        NOM_FAMILLE: 'DIOP',
        DATE_NAISSANCE: '40517', // série Excel
        SEXE: 'Masculin',
        TELEPHONE: '76 987 65 43',
        ADRESSE: 'Grand Dakar',
        ECOLE: 'Lycée Blaise Diagne',
        PHOTO: 'moussa_diop.jpg'
      }
    ]);
    expect(r.codeBeneficiaire).toBe('EDU_DKR_26000163.0');
    expect(r.numeroAdherent).toBe('EDU_DKR_26000163.0');
    expect(r.prenom).toBe('Moussa');
    expect(r.nom).toBe('DIOP');
    expect(r.birthDate).toBe(toIsoDate('40517'));
    expect(r.sexe).toBe('M');
    expect(r.telephone).toBe('76 987 65 43');
    expect(r.address).toBe('Grand Dakar');
    expect(r.schoolName).toBe('Lycée Blaise Diagne');
    expect(r.photoHint).toBe('moussa_diop.jpg');
  });

  it('découpe une colonne « NOM » unique en nom + prénom', () => {
    const [r] = parseRowsToRecords([{ CODE: 'DAARA-2025-0078', NOM: 'FALL Mamadou' }]);
    expect(r.nom).toBe('FALL');
    expect(r.prenom).toBe('Mamadou');
  });

  it('retombe sur des valeurs par défaut (mutuelle / forfait)', () => {
    const [r] = parseRowsToRecords([{ CODE: 'X-1', PRENOM: 'Awa' }]);
    expect(r.mutuelleName).toBe('MSD Dakar');
    expect(r.packageType).toBe('individuel');
    expect(r.status).toBe('active');
    expect(r.sexe).toBe('');
  });

  it('pickColumn retourne vide si aucune colonne ne correspond', () => {
    expect(pickColumn({ A: 1 }, ['code'])).toBe('');
    expect(pickColumn(null, ['code'])).toBe('');
  });

  it('filterValidRecords écarte seulement les lignes sans nom', () => {
    const rows = parseRowsToRecords([
      { CODE: 'A-1', PRENOM: 'Awa' },
      { CODE: '', PRENOM: 'Sans code' },   // plus filtrée : matricule généré
      { CODE: 'A-2', PRENOM: '' }           // aucun nom : inexploitable
    ]);
    expect(filterValidRecords(rows)).toHaveLength(2);
    expect(filterValidRecords(rows).map(r => r.prenom)).toEqual(['Awa', 'Sans code']);
  });
});

describe('generateUniqueCmuCode', () => {
  it('attribue un matricule REGION-MSD-ANNEE-SEQUENCE', () => {
    expect(generateUniqueCmuCode([], 'DKR', 2026)).toBe('DKR-DKR-2026-0001');
  });

  it('reprend la séquence au-dessus du maximum déjà attribué', () => {
    expect(generateUniqueCmuCode(['DKR-DKR-2026-0001', 'DKR-DKR-2026-0002'], 'DKR', 2026))
      .toBe('DKR-DKR-2026-0003');
  });

  it('ne réutilise jamais un code déjà pris', () => {
    const pris = new Set(['DKR-DKR-2026-0001', 'DKR-DKR-2026-0002', 'DKR-DKR-2026-0003']);
    expect(generateUniqueCmuCode(pris, 'DKR', 2026)).toBe('DKR-DKR-2026-0004');
  });

  it('démarre une nouvelle séquence à chaque année', () => {
    expect(generateUniqueCmuCode(['DKR-DKR-2026-0042'], 'DKR', 2027)).toBe('DKR-DKR-2027-0001');
  });

  it('encode la région ET le département de la MSD', () => {
    // Pikine est dans la région de Dakar : même région, département différent.
    expect(generateUniqueCmuCode([], 'PKN', 2026)).toBe('DKR-PKN-2026-0001');
  });
});

describe('migrateLegacyCodes — non-régression des cartes imprimées', () => {
  const registre = [
    // Carte DÉJÀ imprimée : ne doit JAMAIS bouger.
    { cmuNumber: 'DKR_2600027.0', adherentCode: 'DKR_2600027', firstName: 'URSULE', lastName: 'DIAME' },
    { cmuNumber: 'EDU_DKR_26000163.0', adherentCode: 'EDU_DKR_26000163.0', firstName: 'A', lastName: 'B' },
    // Fiches ASS LONASE : ancien motif généré → à migrer.
    {
      cmuNumber: 'DKR-2600001',
      adherentCode: 'DKR-2600001',
      firstName: 'PAPA IBRAHIMA',
      lastName: 'SEYE',
      dependents: [{ cmuNumber: 'DKR-2600002', firstName: 'E', lastName: 'SEYE' }]
    }
  ];

  it('ne touche pas aux cartes déjà imprimées', () => {
    const { members } = migrateLegacyCodes(registre, { unionId: 'DKR', year: 2026 });
    expect(members[0].cmuNumber).toBe('DKR_2600027.0');
    expect(members[1].cmuNumber).toBe('EDU_DKR_26000163.0');
  });

  it('recode les fiches ASS LONASE au format officiel', () => {
    const { members, migrated } = migrateLegacyCodes(registre, { unionId: 'DKR', year: 2026 });
    expect(migrated).toBe(2);                                   // le titre + son ayant droit
    expect(members[2].cmuNumber).toBe('DKR-DKR-2026-0001');
    expect(members[2].dependents[0].cmuNumber).toBe('DKR-DKR-2026-0002');
  });

  it('ne réattribue pas un code déjà pris', () => {
    const avecExistant = [
      ...registre,
      { cmuNumber: 'DKR-DKR-2026-0001', firstName: 'X', lastName: 'Y' }
    ];
    const { members } = migrateLegacyCodes(avecExistant, { unionId: 'DKR', year: 2026 });
    const nouveau = members[2].cmuNumber;
    expect(nouveau).not.toBe('DKR-DKR-2026-0001');
    expect(nouveau).toMatch(/^DKR-DKR-2026-\d{4}$/);
  });

  it('est idempotent : une seconde passe ne change plus rien', () => {
    const une = migrateLegacyCodes(registre, { unionId: 'DKR', year: 2026 });
    const deux = migrateLegacyCodes(une.members, { unionId: 'DKR', year: 2026 });
    expect(deux.migrated).toBe(0);
    expect(deux.members.map(m => m.cmuNumber)).toEqual(une.members.map(m => m.cmuNumber));
  });
});

describe('purge avant réimport (MSD de Grand Yoff)', () => {
  /** Reproduit le prédicat utilisé par le Studio (handlePurgeLegacyCards). */
  const purgeable = (m) => {
    if (!m || !m.cmuNumber) return false;
    if (isOfficialCode(m.cmuNumber)) return false;
    const id = String(m.id || '');
    if (id.startsWith('IMP-') || id.startsWith('SRV-')) return true;
    return isLegacyGeneratedCode(m.cmuNumber);
  };

  it('cible les imports Grand Yoff, quel que soit leur ancien format', () => {
    // Import avec code provisoire généré
    expect(purgeable({ id: 'IMP-a-0', cmuNumber: 'DKR-2600172' })).toBe(true);
    // Import avec le code repris du fichier
    expect(purgeable({ id: 'IMP-b-1', cmuNumber: 'DKR_2600111' })).toBe(true);
    // Fiche restaurée depuis la base
    expect(purgeable({ id: 'SRV-42', cmuNumber: 'DKR-2600999' })).toBe(true);
  });

  it('épargne les cartes DÉJÀ imprimées', () => {
    expect(purgeable({ id: 'MEM-MSD-001', cmuNumber: 'DKR_260001.0' })).toBe(false);
    expect(purgeable({ id: 'MEM-MSD-010', cmuNumber: 'EDU_DKR_26000163.0' })).toBe(false);
    expect(purgeable({ id: 'MEM-MSD-011', cmuNumber: 'DAARA-2025-0078' })).toBe(false);
  });

  it('épargne ASS LONASE, déjà migré au format officiel', () => {
    expect(purgeable({ id: 'IMP-c-0', cmuNumber: 'DKR-DKR-2026-0001' })).toBe(false);
    expect(purgeable({ id: 'IMP-c-1', cmuNumber: 'DKR-DKR-2026-0002' })).toBe(false);
  });
});

describe('identité stable (déduplication entre imports)', () => {
  it('reconnaît la même personne malgré un matricule différent', () => {
    const avant = { firstName: 'PAPA IBRAHIMA', lastName: 'SEYE', birthDate: '1970-01-01' };
    const apres = { firstName: 'papa ibrahima', lastName: 'Seye', birthDate: '1970-01-01', cmuNumber: 'DKR-2609999' };
    expect(beneficiaryIdentity(avant)).toBe(beneficiaryIdentity(apres));
  });

  it('distingue deux personnes différentes', () => {
    const a = { firstName: 'Awa', lastName: 'FALL', birthDate: '1990-01-01' };
    const b = { firstName: 'Awa', lastName: 'FALL', birthDate: '1991-01-01' };
    expect(beneficiaryIdentity(a)).not.toBe(beneficiaryIdentity(b));
  });

  it('privilégie le NIN quand il existe', () => {
    const a = { firstName: 'A', lastName: 'B', birthDate: '1990-01-01', nin: '123456789' };
    const b = { firstName: 'Z', lastName: 'Y', birthDate: '1975-05-05', nin: '123456789' };
    expect(beneficiaryIdentity(a)).toBe(beneficiaryIdentity(b));
  });

  it('collectIdentities indexe tout un registre', () => {
    const ids = collectIdentities([
      { firstName: 'Awa', lastName: 'FALL', birthDate: '1990-01-01' },
      { firstName: 'Moussa', lastName: 'DIOP', birthDate: '1985-02-02' }
    ]);
    expect(ids.size).toBe(2);
  });
});

/**
 * Import d'un lot DÉJÀ IMPRIMÉ : le code du fichier fait foi.
 *
 * Régression majeure. L'import appliquait par défaut la stratégie « SYSTEM »,
 * qui FABRIQUE un matricule (`DKR-DKR-2026-XXXX`) au lieu de reprendre celui du
 * classeur. Sur le lot ASS LONASE, les 122 cartes avaient alors reçu un code
 * qui ne figure sur aucun PVC — la carte devenait introuvable au scan, et le
 * code réel de la personne était perdu.
 *
 * La règle est donc inverse : tant que la carte existe, on conserve son code.
 * Un matricule n'est attribué que lorsqu'il n'y a RIEN à préserver (ligne sans
 * code dans le fichier).
 */
describe('buildStudioMembers — conservation du code du fichier', () => {
  const lignes = parseRowsToRecords([
    { CODE_BENEFICIAIRE: 'DKR_2600111.0', NUMERO_ADHERENT: 'DKR_010126', PRENOM: 'Chef', NOM: 'FALL', DATE_NAISSANCE: '1980-01-01' },
    { CODE_BENEFICIAIRE: 'DKR_2600111.1', NUMERO_ADHERENT: 'DKR_010126', PRENOM: 'Epouse', NOM: 'FALL', DATE_NAISSANCE: '1982-01-01' },
    { CODE_BENEFICIAIRE: 'DKR_2600111.2', NUMERO_ADHERENT: 'DKR_010126', PRENOM: 'Enfant', NOM: 'FALL', DATE_NAISSANCE: '2012-01-01' }
  ]);

  it('regroupe le ménage sur la base du code du FICHIER', async () => {
    const members = await buildStudioMembers(lignes);
    expect(members).toHaveLength(1);
    expect(members[0].dependents).toHaveLength(2);
  });

  it('reprend le code du fichier, suffixe compris', async () => {
    const [chef] = await buildStudioMembers(lignes);
    // Aucun matricule fabriqué : le préfixe est celui du fichier.
    expect(chef.cmuNumber).not.toMatch(/DKR-DKR-/);
    expect(chef.sourceCode).toBe('DKR_2600111.0');
    // Le « .0 » du chef est conservé : c'est exactement le code gravé sur le PVC.
    expect(chef.cmuNumber).toBe('DKR_2600111.0');
    // Les ayants droit gardent leur suffixe, et il correspond au rang RÉEL
    // dans le foyer — pas à la position dans la liste.
    expect(chef.dependents.map((d) => d.codeSuffix)).toEqual(['.1', '.2']);
    const dependents = chef.dependents.map((d) => d.cmuNumber);
    expect(dependents).toEqual(['DKR_2600111.1', 'DKR_2600111.2']);
  });

  it('attribue un code DISTINCT à chaque personne', async () => {
    const [chef] = await buildStudioMembers(lignes);
    const codes = [chef.cmuNumber, ...chef.dependents.map((d) => d.cmuNumber)];
    expect(new Set(codes).size).toBe(3);
  });

  it('conserve le code même lorsqu\'il entre en collision avec un autre lot', async () => {
    // Le code du PVC prime : c'est lui qui est présenté au guichet. On ne
    // remplace jamais le code d'une carte déjà imprimée par un matricule
    // calculé — la déduplication du registre traite le doublon à la lecture.
    const [chef] = await buildStudioMembers(lignes, { existingCodes: ['DKR_2600111'] });
    expect(chef.cmuNumber).toBe('DKR_2600111.0');
  });

  it('n\'attribue un matricule que si le fichier n\'en porte aucun', async () => {
    // Une personne sans code n'a rien à perdre : c'est le seul cas où la
    // génération d'un matricule est légitime.
    const [seul] = await buildStudioMembers(parseRowsToRecords([{ PRENOM: 'Sans', NOM: 'Code' }]));
    // Format « DKR-DKR-AAAA-NNNN », avec un éventuel suffixe d'ayant droit.
    expect(seul.cmuNumber).toMatch(/^DKR-DKR-\d{4}-\d{4}(\.\d+)?$/);
    expect(seul.dependents).toHaveLength(0);
  });

  it('ne confond pas deux homonymes de codes différents', async () => {
    const homonymes = parseRowsToRecords([
      { CODE_BENEFICIAIRE: 'DKR_2600001.0', PRENOM: 'Awa', NOM: 'FALL', DATE_NAISSANCE: '1990-01-01' },
      { CODE_BENEFICIAIRE: 'DKR_2600002.0', PRENOM: 'Awa', NOM: 'FALL', DATE_NAISSANCE: '1990-01-01' }
    ]);
    const members = await buildStudioMembers(homonymes);
    expect(members).toHaveLength(2);
    expect(members[0].cmuNumber).not.toBe(members[1].cmuNumber);
  });

  it('donne un champ `name` aux ayants droit (le Studio en dépend)', async () => {
    // Régression : le Studio faisait `currentMajorDependent.name.split(' ')`,
    // ce qui plantait au rendu sur toute fiche importée.
    const [chef] = await buildStudioMembers(lignes);
    for (const d of chef.dependents) {
      expect(typeof d.name).toBe('string');
      expect(d.name.length).toBeGreaterThan(0);
    }
    // L'import normalise les noms en majuscules (usage carte).
    expect(chef.dependents[0].name).toBe('EPOUSE FALL');
  });
});

describe('matchPhotosToRows', () => {
  const photos = [
    { name: 'Moussa DIOP.jpg', type: 'image/jpeg' },
    { name: '776317173.png', type: 'image/png' },
    { name: 'mamadou_fall_daara.jpg', type: 'image/jpeg' }
  ];

  it('apparie par prénom + nom normalisés', () => {
    const rows = [{ prenom: 'Moussa', nom: 'Diop', telephone: '', photoHint: '' }];
    const [r] = matchPhotosToRows(rows, photos);
    expect(r.photoUrl).toBe('Moussa DIOP.jpg');
  });

  it('une seule photo par personne malgré le même téléphone', () => {
    const rows = [
      { prenom: 'Inconnu', nom: 'X', telephone: '77 631 71 73', photoHint: '' },
      { prenom: 'Inconnu', nom: 'Y', telephone: '77 631 71 73', photoHint: '' }
    ];
    const matched = matchPhotosToRows(rows, photos);
    expect(matched[0].photoUrl).toBe('776317173.png');
    expect(matched[1].photoUrl).toBeUndefined();
  });

  it('priorise la colonne PHOTO du classeur', () => {
    const rows = [{ prenom: 'Moussa', nom: 'Diop', telephone: '', photoHint: 'mamadou_fall_daara.jpg' }];
    const [r] = matchPhotosToRows(rows, photos);
    expect(r.photoUrl).toBe('mamadou_fall_daara.jpg');
  });

  it("ne touche pas aux lignes déjà pourvues d'une photo", () => {
    const rows = [{ prenom: 'Moussa', nom: 'Diop', photoUrl: 'deja-la.jpg' }];
    const [r] = matchPhotosToRows(rows, photos);
    expect(r.photoUrl).toBe('deja-la.jpg');
  });

  it('retourne les lignes telles quelles sans photo fournie', () => {
    const rows = [{ prenom: 'Moussa', nom: 'Diop' }];
    expect(matchPhotosToRows(rows, [])).toBe(rows);
  });
});

describe("parseExcelFile (chaîne complète)", () => {
  it("extrait les bénéficiaires d'un vrai classeur .xlsx", async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { CODE_BENEFICIAIRE: 'EDU_DKR_26000163.0', PRENOM: 'Moussa', NOM_FAMILLE: 'DIOP', DATE_NAISSANCE: 40517 },
      { CODE_BENEFICIAIRE: 'EDU_DRB_26000164.0', PRENOM: 'Mamadou', NOM_FAMILLE: 'FALL', DATE_NAISSANCE: 41475 }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Beneficiaires');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = await parseExcelFile(fakeFile(buffer, 'eleves.xlsx'));
    expect(result.fileName).toBe('eleves.xlsx');
    expect(result.columns).toContain('CODE_BENEFICIAIRE');
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].codeBeneficiaire).toBe('EDU_DKR_26000163.0');
    expect(result.rows[0].prenom).toBe('Moussa');
    expect(result.rows[0].birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.rows[1].codeBeneficiaire).toBe('EDU_DRB_26000164.0');
  });
});
