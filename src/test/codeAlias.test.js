import { describe, it, expect, beforeEach } from 'vitest';
import {
  CODE_ALIASES,
  resolveCodeAlias,
  isLegacyCode,
  getCardByCode,
  saveStoredMembers
} from '../utils/beneficiaryStore';

/**
 * Le code imprimé sur une carte fait foi. Lorsqu'un code est corrigé après
 * impression (MBK/Mbour → DRB/Diourbel), l'ancien code doit continuer de
 * retrouver sa fiche, faute de quoi les cartes déjà imprimées deviennent
 * orphelines et affichent un faux bénéficiaire.
 *
 * Le registre n'est plus embarqué dans le bundle : il vient de la base. Les
 * tests qui vérifient la *recherche par code* injectent donc une fiche
 * témoin dans le localStorage, plutôt que de dépendre d'un jeu figé — sinon
 * le test dirait « fiche introuvable » alors que la logique est correcte.
 */
describe('Alias de codes (cartes déjà imprimées)', () => {
  /** Fiche témoin : c'est elle que l'ancien code doit retrouver. */
  const MAMADOU = {
    id: 'MEM-TEST-164',
    cmuNumber: 'EDU_DRB_26000164',
    adherentCode: 'EDU_DRB_26000164',
    rawCode: 'EDU_DRB_26000164',
    firstName: 'MAMADOU',
    lastName: 'FALL',
    dependents: []
  };

  beforeEach(() => {
    localStorage.clear();
    saveStoredMembers([MAMADOU]);
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

  /**
   * Règle de sûreté : un code qui n'appartient à personne ne doit JAMAIS
   * être complété par une autre fiche. C'était le défaut le plus grave
   * corrigé — le repli retournait « la première fiche du registre », si
   * bien qu'une carte erronée présentait le dossier d'un assuré réel,
   * marqué actif, et ouvrait le hub de prise en charge.
   */
  it('refuse un code totalement inconnu au lieu de renvoyer un dossier réel', () => {
    expect(getCardByCode('CODE-INVENTE-12345')).toBeNull();
    expect(getCardByCode('SN-DK-BSF-9901')).toBeNull();
    expect(getCardByCode('XXXX-999-0000')).toBeNull();
  });

  it('refuse une saisie vide ou illisible', () => {
    expect(getCardByCode('')).toBeNull();
    expect(getCardByCode(null)).toBeNull();
    expect(getCardByCode('   ')).toBeNull();
  });
});
