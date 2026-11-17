import { describe, expect, it } from 'vitest';
import { enRetard, montantOuvert, niveau, parEtape, score } from './format';
import type { Affaire } from './types';

const affaire = (etape: string, montant: number | null): Affaire => ({
  id: etape + String(montant),
  entrepriseId: null,
  contactId: null,
  titre: 'Test',
  etape,
  montant,
  echeance: null,
  clos: null,
  motif: null,
  proprietaire: null,
  origine: null,
  prochaineEtape: null,
  qualification: null,
});

describe('format', () => {
  it('additionne la qualification sur 15 et classe le niveau', () => {
    const q = { besoin: 3, decideur: 3, budget: 3, timing: 3, engagement: 0 };
    expect(score(q)).toBe(12);
    expect(score(null)).toBe(0);
    expect(niveau(12).label).toBe('Chaude');
    expect(niveau(8).label).toBe('Tiède');
    expect(niveau(7).label).toBe('Froide');
  });

  it('somme le pipe en ignorant les montants vides, et groupe par étape', () => {
    const l = [affaire('detection', 1000), affaire('detection', null), affaire('proposition', 500)];
    expect(montantOuvert(l)).toBe(1500);
    expect(parEtape(l, 'detection')).toHaveLength(2);
  });

  it('une échéance passée est en retard, une absente non', () => {
    const maintenant = new Date('2026-06-01T12:00:00Z');
    expect(enRetard('2026-05-31T09:00:00Z', maintenant)).toBe(true);
    expect(enRetard('2026-06-02T09:00:00Z', maintenant)).toBe(false);
    expect(enRetard(null, maintenant)).toBe(false);
  });
});
