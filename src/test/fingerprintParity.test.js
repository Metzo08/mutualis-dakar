// Non-régression de l'empreinte cryptographique officielle UNAMUSC.
//
// Rôle : le PDF demeure la preuve légale opposable ; le Word (.docx) est
// destiné au remplissage et à l'annotation par les structures de santé.
// Les deux documents d'un même dossier DOIVENT impérativement porter la
// MÊME empreinte (meme algorithme, même seed, même nettoyage). Sinon la
// page de vérification mutualis.sn afficherait un statut différent selon le
// format consulté, et l'infalsabilité du Tiers-payant serait compromise.
//
// Les valeurs ci-dessous sont figées (« golden values ») et ont été obtenues
// une fois et pour une fois depuis le vrai code des deux générateurs :
// - computePdfFingerprint (pdfGenerator.js)
// - computeDocxFingerprint (docxGenerator.js)
//
// Toute modification de cleanPdfText / cleanDocText, du seed, de l'algorithme
// de hachage, ou de l'ordre des nettoyages, SAMMÉ DE FAIT échouerait ces
// tests. Ne jamais "réparer" un golden sans décision humaine explicite.
import { describe, it, expect } from 'vitest';
import { computePdfFingerprint } from '../utils/pdfGenerator';
import { computeDocxFingerprint } from '../utils/docxGenerator';

// [label, {referenceNo, cmuNumber, docType}, cleanRef, cleanCmu, cleanDoc, hash attendu]
const CASES = [
  [
    'valeurs par défaut (GAR-2026-8812)',
    { referenceNo: 'GAR-2026-8812', cmuNumber: 'CMU-DKR-2026-8812', docType: 'DOCUMENT OFFICIEL CERTIFIÉ' },
    'GAR-2026-8812',
    'CMU-DKR-2026-8812',
    'DOCUMENT OFFICIEL CERTIFIÉ',
    'SHA256-79587C90-UNAMUSC'
  ],
  [
    'typographie (apostrophe, cadratin, ellipsis)',
    { referenceNo: 'GAR’2026–8812', cmuNumber: 'CMU—DKR…2026', docType: 'ATTESTATION D’AVANCEMENT — ÉDITION…' },
    "GAR'2026-8812",
    'CMU-DKR...2026',
    "ATTESTATION D'AVANCEMENT - ÉDITION...",
    'SHA256-77A32FEC-UNAMUSC'
  ],
  [
    'emojis gérés de la même façon (remplacés / supprimés) dans les deux formats',
    { referenceNo: 'GAR-2026 🏥', cmuNumber: 'CMU-DKR-2026 ⚠️', docType: 'CERTIFICAT ✅ OFFICIEL 💡' },
    'GAR-2026',
    'CMU-DKR-2026 [Avis]',
    'CERTIFICAT [Validé]  OFFICIEL [Conseil]',
    'SHA256-2F285649-UNAMUSC'
  ],
  [
    'champs vides',
    { referenceNo: '', cmuNumber: '', docType: '' },
    '',
    '',
    '',
    'SHA256-7EC4A5C0-UNAMUSC'
  ],
  [
    'espaces de début / fin trims',
    { referenceNo: '  GAR 1  ', cmuNumber: ' CMU 1 ', docType: ' TYPE ' },
    'GAR 1',
    'CMU 1',
    'TYPE',
    'SHA256-658534AF-UNAMUSC'
  ]
];

describe('Empreinte PDF/Word : parité et non-régression', () => {
  it.each(CASES)(
    '%s : empreinte identique PDF et Word, valeur figée',
    (_label, { referenceNo, cmuNumber, docType }, cleanRef, cleanCmu, cleanDoc, expectedHash) => {
      const pdf = computePdfFingerprint({ referenceNo, cmuNumber, docType });
      const docx = computeDocxFingerprint({ referenceNo, cmuNumber, docType });

      // 1) Parité stricte entre le PDF et le Word d'un même document
      expect(pdf.cryptoHash).toBe(docx.cryptoHash);

      // 2) Valeur de référence figée : toute dérive des algorithmes est bloquée
      expect(pdf.cryptoHash).toBe(expectedHash);

      // 3) Format attendu : hachage SHA-256(32 bits hex) + UA + suffixe officiel
      expect(pdf.cryptoHash).toMatch(/^SHA256-[0-9A-F]{8}-UNAMUSC$/);

      // 4) Les textes nettoyés du seed sont exactement les mêmes des deux côtés
      expect(pdf.cleanRef).toBe(cleanRef);
      expect(pdf.cleanCmu).toBe(cleanCmu);
      expect(pdf.cleanDoc).toBe(cleanDoc);
    }
  );
});
