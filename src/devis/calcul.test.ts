import { describe, expect, it } from 'vitest';
import { totaux, transitionPossible } from './calcul.js';

const lignes = [
  { prixUnitaire: 5000, quantite: 2, recurrent: false }, // 10 000
  { prixUnitaire: 600, quantite: 2, recurrent: true }, // 1 200 par an
];

describe('totaux d’un devis', () => {
  it('achat : l’investissement, les services annuels et le total de la première année', () => {
    expect(totaux(lignes, { formule: 'achat', dureeMois: 48, tauxCentiemes: 400 })).toEqual({
      investissement: 10000,
      servicesAnnuels: 1200,
      totalPremiereAnnee: 11200,
      mensualite: null,
      coutFinancement: null,
      totalSurDuree: null,
    });
  });

  it('abonnement : investissement financé à 4 % sur 48 mois, services lissés', () => {
    const t = totaux(lignes, { formule: 'abonnement', dureeMois: 48, tauxCentiemes: 400 });
    // 10 000 € à 4 % sur 48 mois : 225,79 € par mois ; 1 200 € par an : 100 € par mois
    expect(t.mensualite).toBeCloseTo(325.79, 2);
    expect(t.totalSurDuree).toBeCloseTo(325.79 * 48, 0);
    expect(t.coutFinancement).toBeCloseTo(225.79 * 48 - 10000, 0);
    expect(t.investissement).toBe(10000);
  });

  it('abonnement sans intérêt : l’investissement se divise par la durée', () => {
    const t = totaux(lignes, { formule: 'abonnement', dureeMois: 40, tauxCentiemes: 0 });
    expect(t.mensualite).toBe(350); // 250 + 100
    expect(t.coutFinancement).toBe(0);
    expect(t.totalSurDuree).toBe(14000);
  });

  it('plus la durée est longue, plus la mensualité baisse et le financement coûte', () => {
    const court = totaux(lignes, { formule: 'abonnement', dureeMois: 36, tauxCentiemes: 400 });
    const long = totaux(lignes, { formule: 'abonnement', dureeMois: 60, tauxCentiemes: 400 });
    expect(long.mensualite!).toBeLessThan(court.mensualite!);
    expect(long.coutFinancement!).toBeGreaterThan(court.coutFinancement!);
  });

  it('un devis vide vaut zéro, dans les deux formules', () => {
    expect(
      totaux([], { formule: 'achat', dureeMois: 48, tauxCentiemes: 400 }).totalPremiereAnnee,
    ).toBe(0);
    expect(
      totaux([], { formule: 'abonnement', dureeMois: 48, tauxCentiemes: 400 }).mensualite,
    ).toBe(0);
  });

  it('ne divise pas par zéro avec une durée nulle', () => {
    expect(
      totaux(lignes, { formule: 'abonnement', dureeMois: 0, tauxCentiemes: 400 }).mensualite,
    ).toBeNull();
  });
});

describe('cycle d’un devis', () => {
  it('brouillon → envoyé → accepté ou refusé, et on peut revenir en arrière d’un cran', () => {
    expect(transitionPossible('brouillon', 'envoye')).toBe(true);
    expect(transitionPossible('envoye', 'accepte')).toBe(true);
    expect(transitionPossible('envoye', 'refuse')).toBe(true);
    expect(transitionPossible('envoye', 'brouillon')).toBe(true);
    expect(transitionPossible('accepte', 'envoye')).toBe(true);
  });
  it('refuse les sauts : un brouillon n’est pas accepté sans avoir été envoyé', () => {
    expect(transitionPossible('brouillon', 'accepte')).toBe(false);
    expect(transitionPossible('brouillon', 'refuse')).toBe(false);
    expect(transitionPossible('accepte', 'brouillon')).toBe(false);
    expect(transitionPossible('refuse', 'accepte')).toBe(false);
  });
});
