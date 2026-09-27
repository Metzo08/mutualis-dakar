import { describe, it, expect } from 'vitest';
import {
  CARD_PROGRAMS,
  resolveCardProgram,
  resolveSchoolProgram,
  buildContactLines,
  resolveUnion,
  DEPARTMENTAL_UNIONS,
  SOLUTION_PHONE
} from '../utils/cardPrograms';

/**
 * Ces tests verrouillent les règles métier des cartes scolaires :
 *  1. les libellés suivent le programme (ÉLÈVES ≠ DAARA) ;
 *  2. la carte CMU-Daara ne porte jamais le champ IA / IEF ;
 *  3. les coordonnées imprimées sont celles de la MSD émettrice ;
 *  4. les coordonnées d'une MSD ne fuitent jamais sur une autre carte.
 */
describe('Programmes de cartes scolaires', () => {
  it('distingue les deux variantes officielles', () => {
    expect(resolveCardProgram('CMU_ELEVES').label).toBe('CMU-Élèves');
    expect(resolveCardProgram('CMU_DAARA').label).toBe('CMU-Daara');
  });

  it('retombe sur CLASSIC pour un programme inconnu', () => {
    expect(resolveCardProgram('INCONNU').id).toBe('CLASSIC');
    expect(resolveCardProgram(undefined).id).toBe('CLASSIC');
  });

  it('ne considère que les deux programmes scolaires comme scolaires', () => {
    expect(resolveSchoolProgram('CMU_ELEVES').id).toBe('CMU_ELEVES');
    expect(resolveSchoolProgram('CMU_DAARA').id).toBe('CMU_DAARA');
    expect(resolveSchoolProgram('CLASSIC')).toBeNull();
  });

  it('a des libellés propres et distincts pour chaque programme', () => {
    const e = resolveCardProgram('CMU_ELEVES');
    const d = resolveCardProgram('CMU_DAARA');
    // Aucun libellé partagé : c'est le bug qui affichait « CMU-Élèves »
    // sur une carte de daara.
    expect(e.frontBanner).not.toBe(d.frontBanner);
    expect(e.frontFooter).not.toBe(d.frontFooter);
    expect(e.backBanner).not.toBe(d.backBanner);
    expect(e.backCodeLabel).not.toBe(d.backCodeLabel);
    expect(e.frontBanner).toContain('CMU-Élèves');
    expect(d.frontBanner).toContain('CMU-Daara');
  });

  it('affiche IA / IEF sur la carte élève et jamais sur la carte daara', () => {
    expect(resolveCardProgram('CMU_ELEVES').showIef).toBe(true);
    expect(resolveCardProgram('CMU_DAARA').showIef).toBe(false);
  });

  it('emploie le libellé scolaire adapté à chaque programme', () => {
    expect(resolveCardProgram('CMU_ELEVES').idLabel).toContain('INE');
    expect(resolveCardProgram('CMU_DAARA').idLabel).toContain('IEN');
    expect(resolveCardProgram('CMU_DAARA').schoolWord).toBe('Daara');
  });

  it("n'inscrit AUCUNE donnée annuelle dans le bandeau du recto", () => {
    // L'année scolaire et la classe changent chaque année : elles ne sont
    // imprimées que dans le QR code, jamais sur la carte.
    ['CMU_ELEVES', 'CMU_DAARA'].forEach((id) => {
      const printed = resolveCardProgram(id).frontBanner;
      expect(printed).not.toMatch(/\d{4}\s*-\s*\d{4}/); // pas « 2025-2026 »
      expect(printed).not.toMatch(/20\d{2}/);            // aucune année
      expect(printed).not.toMatch(/Année/i);
      expect(printed).not.toMatch(/Classe|Niveau/i);
    });
  });

  it("ne porte aucun badge secondaire dans le bandeau du recto", () => {
    // Le bandeau ne contient QUE le libellé du programme.
    ['CMU_ELEVES', 'CMU_DAARA'].forEach((id) => {
      expect(resolveCardProgram(id).frontBadge).toBeUndefined();
    });
  });
});

describe('Coordonnées par MSD', () => {
  it('renvoie l’union correspondant au code', () => {
    expect(resolveUnion('DRB').region).toBe('Diourbel');
    expect(resolveUnion('DKR').region).toBe('Dakar');
  });

  it('retombe sur Dakar pour un code inconnu', () => {
    expect(resolveUnion('ZZZ').id).toBe('DKR');
  });

  it("a une entrée par MSD avec un code d'union unique", () => {
    const codes = DEPARTMENTAL_UNIONS.map((u) => u.id);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('affiche la permanence de la MSD de Dakar sur ses cartes', () => {
    const lines = buildContactLines('DKR');
    const values = lines.map((l) => l.value).join(' ');
    expect(values).toContain('76 845 54 99');
    expect(values).toContain('33 820 21 11');
  });

  it('ne fait jamais fuiter les numéros de Dakar sur une autre MSD', () => {
    // Régression : la carte de Diourbel affichait les coordonnées de Dakar.
    for (const union of DEPARTMENTAL_UNIONS.filter((u) => u.id !== 'DKR')) {
      const values = buildContactLines(union.id).map((l) => l.value).join(' ');
      expect(values).not.toContain('76 845 54 99');
      expect(values).not.toContain('77 742 90 73');
      expect(values).not.toContain('33 820 21 11');
    }
  });

  it('affiche au minimum le SAMU national sur toute carte', () => {
    for (const union of DEPARTMENTAL_UNIONS) {
      const lines = buildContactLines(union.id);
      expect(lines.some((l) => l.kind === 'samu' && l.value === '15')).toBe(true);
    }
  });

  it('permet à une MSD de saisir ses propres coordonnées', () => {
    const lines = buildContactLines('DRB', { permanence: '30 000 00 00', permanenceAlt: '77 000 11 22' });
    const permanence = lines.find((l) => l.kind === 'permanence');
    expect(permanence.value).toBe('30 000 00 00 • 77 000 11 22');
  });

  it('donne la priorité aux coordonnées saisies sur celles par défaut', () => {
    const lines = buildContactLines('DKR', { permanence: '30 111 11 11' });
    const permanence = lines.find((l) => l.kind === 'permanence');
    expect(permanence.value).toContain('30 111 11 11');
    expect(permanence.value).not.toContain('76 845 54 99');
  });

  it('ignore une permanence vide et ne laisse pas de ligne orpheline', () => {
    const lines = buildContactLines('DRB', { permanence: '', permanenceAlt: '' });
    expect(lines.some((l) => l.kind === 'permanence')).toBe(false);
    expect(lines.every((l) => l.value && l.value.trim().length > 0)).toBe(true);
  });
});

describe('Intégrité du module', () => {
  it('expose un numéro de solution unique pour toutes les cartes', () => {
    expect(SOLUTION_PHONE).toMatch(/^\d{2} \d{3} \d{2} \d{2}$/);
  });

  it('donne un accent et un libellé à chaque programme', () => {
    Object.values(CARD_PROGRAMS).forEach((p) => {
      expect(p.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(p.label).toBeTruthy();
    });
  });
});
