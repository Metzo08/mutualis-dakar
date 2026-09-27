import { describe, it, expect, beforeEach } from 'vitest';
import { normalizePhoneKey, getCardsSponsoredBy, assignSponsorToCard } from '../utils/sponsorLogos';

/**
 * Régression : la clé d'identification d'un parrain ne doit jamais supprimer
 * les LETTRES. Avec un identifiant alphanumérique (« MAIRIE_DAKAR »), une
 * normalisation « chiffres uniquement » réduisait la clé à une chaîne vide :
 * le logo n'était ni retrouvé, ni propagé aux autres cartes du parrain.
 */
describe('Clé d\'identification des parrains', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('conserve un identifiant alphanumérique', () => {
    // Les LETTRES sont conservées : c'est tout l'intérêt de la correction.
    expect(normalizePhoneKey('MAIRIE_DAKAR')).toBe('MAIRIEDAKAR');
    expect(normalizePhoneKey('mairie_dakar')).toBe('MAIRIEDAKAR');
    expect(normalizePhoneKey('SONATEL')).toBe('SONATEL');
  });

  it('normalise un numéro avec ses séparateurs', () => {
    expect(normalizePhoneKey('77 555 12 34')).toBe('775551234');
    expect(normalizePhoneKey('77-555-12-34')).toBe('775551234');
    expect(normalizePhoneKey('(+221) 77.555.12.34')).toBe('+221775551234');
  });

  it('ne renvoie jamais une clé vide pour un identifiant valide', () => {
    expect(normalizePhoneKey('MAIRIE_DAKAR')).not.toBe('');
    expect(normalizePhoneKey('SONATEL')).not.toBe('');
  });

  it('tolère une valeur absente', () => {
    expect(normalizePhoneKey(null)).toBe('');
    expect(normalizePhoneKey(undefined)).toBe('');
  });

  it('retrouve les cartes d\'un parrain alphanumérique', () => {
    assignSponsorToCard('EDU_DKR_26000163', 'MAIRIE_DAKAR');
    assignSponsorToCard('EDU_DKR_26000164', 'MAIRIE_DAKAR');
    assignSponsorToCard('EDU_DKR_26000165', 'AUTRE_PARRAIN');
    const cards = getCardsSponsoredBy('MAIRIE_DAKAR');
    expect(cards).toContain('EDU_DKR_26000163');
    expect(cards).toContain('EDU_DKR_26000164');
    // Le logo doit se répercuter sur les DEUX cartes, pas sur la troisième.
    expect(cards).not.toContain('EDU_DKR_26000165');
    expect(cards.length).toBe(2);
  });

  it('tolère les variations de casse et de séparateurs', () => {
    assignSponsorToCard('CARD-X', 'Mairie_Dakar');
    // « MAIRIE DAKAR » et « Mairie_Dakar » désignent le même parrain.
    expect(getCardsSponsoredBy('MAIRIE DAKAR')).toEqual(['CARD-X']);
    expect(getCardsSponsoredBy('mairie_dakar')).toEqual(['CARD-X']);
  });
});
