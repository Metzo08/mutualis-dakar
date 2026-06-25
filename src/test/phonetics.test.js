// Tests des utilitaires phonétiques (logique pure, sans dépendance React)
import { describe, it, expect } from 'vitest';
import { isWolofText, convertWolofToFrenchPhonetics, cleanTextForTTS } from '../utils/phonetics';

describe('isWolofText', () => {
  it('retourne false pour un texte vide', () => {
    expect(isWolofText('')).toBe(false);
    expect(isWolofText(null)).toBe(false);
    expect(isWolofText(undefined)).toBe(false);
  });

  it('détecte le Wolof via les caractères spéciaux (ë, ñ)', () => {
    expect(isWolofText('Jërejëf')).toBe(true);
    expect(isWolofText('ñaar')).toBe(true);
  });

  it('détecte le Wolof via les mots connus', () => {
    expect(isWolofText('Nanga def')).toBe(true);
    expect(isWolofText('jamm rekk')).toBe(true);
  });

  it('ne confond pas avec le français', () => {
    expect(isWolofText('Bonjour comment allez-vous')).toBe(false);
    expect(isWolofText('La mutuelle de santé')).toBe(false);
  });
});

describe('cleanTextForTTS', () => {
  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(cleanTextForTTS('')).toBe('');
    expect(cleanTextForTTS(null)).toBe('');
  });

  it('supprime le markdown gras et les liens', () => {
    const result = cleanTextForTTS('Voici un **texte** et un [lien](http://example.com)');
    expect(result).not.toContain('**');
    expect(result).not.toContain('http://example.com');
    expect(result).toContain('texte');
    expect(result).toContain('lien');
  });

  it('nettoie les emojis', () => {
    const result = cleanTextForTTS('Bonjour 😊 ça va ?');
    expect(result).not.toContain('😊');
    expect(result).toContain('Bonjour');
  });

  it('standardise les sauts de ligne en pauses', () => {
    const result = cleanTextForTTS('Ligne 1\nLigne 2');
    expect(result).toContain('. ');
  });
});

describe('convertWolofToFrenchPhonetics', () => {
  it('retourne une chaîne', () => {
    const result = convertWolofToFrenchPhonetics('Nanga def');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('préserve les mots français bypassés', () => {
    const result = convertWolofToFrenchPhonetics('mutuelle');
    expect(result.toLowerCase()).toContain('mutuelle');
  });
});
