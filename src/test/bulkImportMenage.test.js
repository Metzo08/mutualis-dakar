/**
 * Non-régression du BUG « ménage 0067 » (lot LOT-2026-034).
 *
 * Réel : 60 foyers distincts (60 téléphones, 35 adresses) ont été empilés
 * sous UNE seule séquence DKR-DKR-2026-0067.1 → .60, parce que leur
 * NUMERO_ADHERENT partageait une valeur unique (« DKR_010126.1 ») et que
 * la clé de ménage tombait dessus.
 *
 * Attendu désormais : une clé NUMERO_ADHERENT partagée par un effectif
 * invraisemblable (> 15) n'est PLUS une clé de foyer — chaque ligne
 * redevient un dossier indépendant avec sa propre séquence.
 */
import { describe, it, expect } from 'vitest';
import { parseRowsToRecords, buildStudioMembers } from '../utils/bulkImport';

const range = (n) => Array.from({ length: n }, (_, i) => i);

describe('Garde-fou anti-méga-ménage (bug « ménage 0067 »)', () => {
  it('60 foyers partageant le même NUMERO_ADHERENT ne forment PAS un ménage unique', async () => {
    // Reproduction du fichier Grand Yoff : lignes sans CODE_BENEFICIAIRE,
    // toutes avec le même NUMERO_ADHERENT, téléphones et adresses distincts.
    const records = parseRowsToRecords(range(60).map((i) => ({
      PRENOM: `Assuré${i + 1}`,
      NOM: 'GRANDYOFF',
      NUMERO_ADHERENT: 'DKR_010126.1',
      TELEPHONE: `7700000${String(i).padStart(2, '0')}`,
      ADRESSE: `Quartier ${i + 1}`
    })));

    const members = await buildStudioMembers(records, { codeStrategy: 'FILE' });
    // 60 dossiers indépendants, pas un ménage de 60.
    expect(members).toHaveLength(60);
    // Aucun ménage de plus de 15 ayants droit.
    members.forEach((m) => expect(m.dependents.length).toBeLessThanOrEqual(14));
    // Codes uniques.
    const codes = members.map((m) => m.cmuNumber);
    expect(new Set(codes).size).toBe(60);
  });

  it('un VRAI ménage (≤ 15 personnes, même NUMERO_ADHERENT) reste regroupé', async () => {
    const records = parseRowsToRecords([
      { PRENOM: 'Chef', NOM: 'DIOP', NUMERO_ADHERENT: 'DKR_000012.1', TELEPHONE: '771234567' },
      ...range(4).map((i) => ({
        PRENOM: `Membre${i + 1}`, NOM: 'DIOP',
        NUMERO_ADHERENT: 'DKR_000012.1', TELEPHONE: '771234567'
      }))
    ]);
    const members = await buildStudioMembers(records, { codeStrategy: 'FILE' });
    expect(members).toHaveLength(1);
    expect(members[0].dependents).toHaveLength(4);
  });

  it('des lignes AVEC code bénéficiaire restent regroupées par base de code (structure .0/.1/.2)', async () => {
    const records = parseRowsToRecords([
      { CODE_BENEFICIAIRE: 'DKR_2600111.0', PRENOM: 'Chef', NOM: 'NDIAYE' },
      { CODE_BENEFICIAIRE: 'DKR_2600111.1', PRENOM: 'Ayant1', NOM: 'NDIAYE' },
      { CODE_BENEFICIAIRE: 'DKR_2600111.2', PRENOM: 'Ayant2', NOM: 'NDIAYE' }
    ]);
    const members = await buildStudioMembers(records, { codeStrategy: 'FILE' });
    expect(members).toHaveLength(1);
    expect(members[0].dependents).toHaveLength(2);
  });
});
