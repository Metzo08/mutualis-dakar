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
  parseExcelFile
} from '../utils/bulkImport';

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

  it('canonicalCode retire la décimale parasite des codes Excel', () => {
    expect(canonicalCode('DKR_2600011.0')).toBe('DKR_2600011');
    expect(canonicalCode('2600011.0')).toBe('2600011');
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
    expect(r.codeBeneficiaire).toBe('EDU_DKR_26000163');
    expect(r.numeroAdherent).toBe('EDU_DKR_26000163');
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

  it('filterValidRecords écarte les lignes sans nom ou sans code', () => {
    const rows = parseRowsToRecords([
      { CODE: 'A-1', PRENOM: 'Awa' },
      { CODE: '', PRENOM: 'Sans code' },
      { CODE: 'A-2', PRENOM: '' }
    ]);
    expect(filterValidRecords(rows)).toHaveLength(1);
    expect(filterValidRecords(rows)[0].codeBeneficiaire).toBe('A-1');
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
    expect(result.rows[0].codeBeneficiaire).toBe('EDU_DKR_26000163');
    expect(result.rows[0].prenom).toBe('Moussa');
    expect(result.rows[0].birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.rows[1].codeBeneficiaire).toBe('EDU_DRB_26000164');
  });
});
