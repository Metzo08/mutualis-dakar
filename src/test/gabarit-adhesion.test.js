import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildStudioMembers, CODE_STRATEGY } from '../utils/bulkImport.js';

describe('Gabarit adhésion en masse — codes générés automatiquement', () => {
  it('lire le gabarit et vérifier la génération automatique des codes', async () => {
    const wb = XLSX.readFile('GABARIT-ADHESION-MASSE-DKR-2026.xlsx');
    const raw = XLSX.utils.sheet_to_json(wb.Sheets['Adhésion en masse'], { defval: '' })
      .filter((r) => String(r.PRENOM_BENEFICIAIRE).trim() && String(r.NOM_BENEFICIAIRE).trim());

    const records = raw.map((r) => ({
      codeBeneficiaire: String(r.CODE_BENEFICIAIRE || '').trim(),
      numeroAdherent: String(r.NUMERO_ADHERENT || '').trim(),
      prenom: String(r.PRENOM_BENEFICIAIRE).trim(),
      nom: String(r.NOM_BENEFICIAIRE).trim(),
      birthDate: String(r.DATE_NAISSANCE || '').trim(),
      birthPlace: String(r.LIEU_NAISSANCE || '').trim(),
      nin: String(r.NIN || '').trim(),
      sexe: String(r.SEXE || '').trim().toUpperCase().startsWith('M') ? 'M' : 'F',
      telephone: String(r.CONTACT || '').trim(),
      address: String(r.ADRESSE || '').trim(),
      bloodGroup: String(r.GROUPE_SANGUIN || '').trim(),
      schoolName: '', sponsorPhone: '',
      mutuelleName: String(r.NOM_ORGANISATION || '').trim(),
      packageType: String(r.TYPE_CARTE || '').trim() || 'individuel',
      photoHint: String(r.PHOTO || '').trim(),
      status: 'active',
    }));

    const members = await buildStudioMembers(records, {
      unionId: 'DKR',
      codeStrategy: CODE_STRATEGY.SYSTEM,
      existingCodes: [],
    });

    console.log(`Gabarit : ${records.length} lignes → ${members.length} fiche(s)`);
    members.forEach((m) => {
      console.log(`  ${m.cmuNumber} | ${m.firstName} ${m.lastName} | ${m.isMajor ? 'MAJEUR' : 'MINEUR (pris en charge)'}`);
    });

    // Les codes générés suivent le format officiel RÉGION-DÉPARTEMENT-ANNÉE-SÉQUENCE
    for (const m of members) {
      expect(m.cmuNumber).toMatch(/^DKR-DKR-\d{4}-\d{4}(\.\d+)?$/);
    }
    // Unicité stricte
    const codes = members.map((m) => m.cmuNumber);
    expect(new Set(codes).size).toBe(codes.length);
    // Le mineur du gabarit est bien un ayant droit pris en charge
    const mineur = members.flatMap((m) => m.dependents || []).find((d) => d.name?.includes('ABDOULAYE') || d.name?.includes('FALL'));
    expect(mineur).toBeTruthy();
  });
});
