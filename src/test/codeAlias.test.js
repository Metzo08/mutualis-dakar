import { describe, it, expect, beforeEach } from 'vitest';
import { CODE_ALIASES, resolveCodeAlias, isLegacyCode, getCardByCode } from '../utils/beneficiaryStore';

/**
 * Le code imprimé sur une carte fait foi. Lorsqu'un code est corrigé après
 * impression (MBK/Mbour → DRB/Diourbel), l'ancien code doit continuer de
 * retrouver sa fiche, faute de quoi les cartes déjà imprimées deviennent
 * orphelines et affichent un faux bénéficiaire.
 */
describe('Alias de codes (cartes déjà imprimées)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('déclare le couple ancien code → code actuel', () => {
    expect(CODE_ALIASES['EDU_MBK_26000164']).toBe('EDU_DRB_26000164');
  });

  it('redirige l\'ancien code vers le code actuel', () => {
    expect(resolveCodeAlias('EDU_MBK_26000164')).toBe('EDU_DRB_26000164');
  });

  it('est insensible à la casse et aux espaces', () => {
    expect(resolveCodeAlias('edu_mbk_26000164')).toBe('EDU_DRB_26000164');
    expect(resolveCodeAlias('  EDU_MBK_26000164  ')).toBe('EDU_DRB_26000164');
  });

  it('conserve le suffixe d\'ayant droit', () => {
    expect(resolveCodeAlias('EDU_MBK_26000164.M1')).toBe('EDU_DRB_26000164.M1');
    expect(resolveCodeAlias('EDU_MBK_26000164.0')).toBe('EDU_DRB_26000164.0');
  });

  it('laisse intact un code qui n\'est pas un alias', () => {
    expect(resolveCodeAlias('EDU_DKR_26000163')).toBe('EDU_DKR_26000163');
    expect(resolveCodeAlias('SN-DK-GUE-4401')).toBe('SN-DK-GUE-4401');
    expect(resolveCodeAlias('')).toBe('');
  });

  it('identifie les codes hérités', () => {
    expect(isLegacyCode('EDU_MBK_26000164')).toBe(true);
    expect(isLegacyCode('EDU_MBK_26000164.M2')).toBe(true);
    expect(isLegacyCode('EDU_DRB_26000164')).toBe(false);
  });

  it('retrouve la VRAIE fiche depuis l\'ancien code', () => {
    const card = getCardByCode('EDU_MBK_26000164');
    expect(card).toBeTruthy();
    expect(card.firstName).toBe('MAMADOU');
    expect(card.lastName).toBe('FALL');
    // Le code retourné est bien le canonique.
    expect(card.cmuNumber).toBe('EDU_DRB_26000164');
  });

  it('retrouve la même fiche par les deux codes', () => {
    const viaAncien = getCardByCode('EDU_MBK_26000164');
    const viaActuel = getCardByCode('EDU_DRB_26000164');
    expect(viaAncien.id).toBe(viaActuel.id);
  });

  it('reste cohérent après un import d\'URL de vérification', () => {
    const card = getCardByCode('https://mutualis.sn/#/verify/EDU_MBK_26000164?otp=1');
    expect(card).toBeTruthy();
    expect(card.cmuNumber).toBe('EDU_DRB_26000164');
  });
});
