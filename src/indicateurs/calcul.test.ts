import { describe, expect, it } from 'vitest';
import {
  calculer,
  debutDeSemaine,
  mediane,
  statut,
  type AffaireCalcul,
  type Definition,
} from './calcul.js';

// Lundi 15 juin 2026, midi. Période de 90 jours : depuis le 17 mars.
const MAINTENANT = new Date('2026-06-15T12:00:00Z');
const OPTIONS = { jours: 90, maintenant: MAINTENANT };

const affaire = (
  etapesDates: Record<string, string>,
  extra: Partial<AffaireCalcul> = {},
): AffaireCalcul => ({
  creeLe: new Date('2026-05-01T08:00:00Z'),
  etapesDates,
  clos: null,
  closLe: null,
  ...extra,
});
const def = (d: Partial<Definition>): Definition => ({
  id: 'x',
  label: 'X',
  type: 'delai',
  deEtape: 'qualification',
  versEtape: 'proposition',
  objectif: null,
  ...d,
});

describe('médiane et semaine', () => {
  it('médiane d’un nombre pair ou impair de valeurs, vide sans valeur', () => {
    expect(mediane([])).toBeNull();
    expect(mediane([5, 1, 9])).toBe(5);
    expect(mediane([1, 2, 3, 10])).toBe(2.5);
  });
  it('une semaine commence le lundi', () => {
    expect(debutDeSemaine(new Date('2026-06-14T23:00:00Z')).toISOString()).toBe(
      '2026-06-08T00:00:00.000Z',
    );
    expect(debutDeSemaine(new Date('2026-06-15T00:30:00Z')).toISOString()).toBe(
      '2026-06-15T00:00:00.000Z',
    );
  });
});

describe('délai entre deux étapes', () => {
  const affaires = [
    affaire({ qualification: '2026-05-01T00:00:00Z', proposition: '2026-05-06T00:00:00Z' }), // 5 j
    affaire({ qualification: '2026-05-10T00:00:00Z', proposition: '2026-05-20T00:00:00Z' }), // 10 j
    affaire({ qualification: '2026-05-12T00:00:00Z', proposition: '2026-05-14T00:00:00Z' }), // 2 j
    affaire({ qualification: '2025-12-01T00:00:00Z', proposition: '2026-01-01T00:00:00Z' }), // hors période
    affaire({ qualification: '2026-05-20T00:00:00Z', proposition: '2026-05-10T00:00:00Z' }), // à l'envers
    affaire({ qualification: '2026-05-20T00:00:00Z' }), // pas encore de proposition
  ];

  it('donne la médiane, la moyenne et le nombre d’affaires qui ont fini le trajet', () => {
    expect(calculer(def({}), affaires, OPTIONS)).toEqual({ valeur: 5, moyenne: 5.7, n: 3 });
  });

  it('sans affaire, pas de valeur', () => {
    expect(calculer(def({}), [], OPTIONS)).toEqual({ valeur: null, moyenne: null, n: 0 });
  });

  it('sans étapes choisies, rien à calculer', () => {
    expect(calculer(def({ deEtape: null }), affaires, OPTIONS)).toEqual({ valeur: null, n: 0 });
  });

  it('mesure aussi jusqu’à la clôture gagnée', () => {
    const gagnee = affaire(
      { proposition: '2026-05-01T00:00:00Z' },
      { clos: 'gagne', closLe: new Date('2026-05-31T00:00:00Z') },
    );
    const sansDate = affaire({ proposition: '2026-05-01T00:00:00Z' }, { clos: 'gagne' });
    const r = calculer(
      def({ deEtape: 'proposition', versEtape: '@gagne' }),
      [gagnee, sansDate],
      OPTIONS,
    );
    expect(r).toMatchObject({ valeur: 30, n: 1 });
  });
});

describe('conversion', () => {
  it('part des affaires entrées dans l’étape qui ont atteint la suivante', () => {
    const affaires = [
      affaire({ prospection: '2026-05-01T00:00:00Z', qualification: '2026-05-05T00:00:00Z' }),
      affaire({ prospection: '2026-05-02T00:00:00Z' }),
      affaire({ prospection: '2026-05-03T00:00:00Z', qualification: '2026-06-01T00:00:00Z' }),
      affaire({ prospection: '2025-01-01T00:00:00Z', qualification: '2025-01-02T00:00:00Z' }), // hors période
    ];
    const r = calculer(
      def({ type: 'conversion', deEtape: 'prospection', versEtape: 'qualification' }),
      affaires,
      OPTIONS,
    );
    expect(r).toEqual({ valeur: 67, convertis: 2, n: 3 });
  });

  it('du devis à la commande : une affaire gagnée compte, même sans date de clôture', () => {
    const affaires = [
      affaire({ proposition: '2026-05-01T00:00:00Z' }, { clos: 'gagne' }),
      affaire(
        { proposition: '2026-05-02T00:00:00Z' },
        { clos: 'perdu', closLe: new Date('2026-05-30T00:00:00Z') },
      ),
      affaire({ proposition: '2026-05-03T00:00:00Z' }),
      affaire({ proposition: '2026-05-04T00:00:00Z' }),
    ];
    const r = calculer(
      def({ type: 'conversion', deEtape: 'proposition', versEtape: '@gagne' }),
      affaires,
      OPTIONS,
    );
    expect(r).toEqual({ valeur: 25, convertis: 1, n: 4 });
  });

  it('personne dans l’étape : pas de valeur', () => {
    expect(calculer(def({ type: 'conversion' }), [], OPTIONS)).toEqual({
      valeur: null,
      convertis: 0,
      n: 0,
    });
  });
});

describe('opportunités entrantes', () => {
  it('compte les affaires créées par semaine sur la période, la semaine en cours comprise', () => {
    const cree = (iso: string) => affaire({}, { creeLe: new Date(iso) });
    const affaires = [
      cree('2026-06-15T08:00:00Z'), // cette semaine
      cree('2026-06-10T08:00:00Z'), // la semaine du 8
      cree('2026-06-09T08:00:00Z'), // la semaine du 8
      cree('2026-03-24T08:00:00Z'), // première semaine de la fenêtre (du 23 mars)
      cree('2026-03-20T08:00:00Z'), // la semaine d'avant : hors fenêtre
      cree('2025-01-01T08:00:00Z'), // hors fenêtre
    ];
    const r = calculer(
      def({ type: 'entrants', deEtape: null, versEtape: null }),
      affaires,
      OPTIONS,
    );
    expect(r.n).toBe(4);
    expect(r.serie).toHaveLength(13);
    expect(r.serie?.at(-1)).toEqual({ semaine: '2026-06-15', n: 1 });
    expect(r.serie?.at(-2)).toEqual({ semaine: '2026-06-08', n: 2 });
    expect(r.serie?.[0]).toEqual({ semaine: '2026-03-23', n: 1 });
    expect(r.valeur).toBe(0.3);
  });
});

describe('statut', () => {
  const r = (valeur: number | null) => ({ valeur, n: 1 });
  it('un délai est bon quand il est sous l’objectif', () => {
    expect(statut(def({ objectif: 10 }), r(8))).toBe('ok');
    expect(statut(def({ objectif: 10 }), r(11))).toBe('hors-objectif');
  });
  it('une conversion est bonne quand elle atteint l’objectif', () => {
    const c = def({ type: 'conversion', objectif: 50 });
    expect(statut(c, r(50))).toBe('ok');
    expect(statut(c, r(40))).toBe('hors-objectif');
  });
  it('sans objectif, sans donnée, ou sans étapes choisies', () => {
    expect(statut(def({ objectif: null }), r(3))).toBe('sans-objectif');
    expect(statut(def({ objectif: 5 }), r(null))).toBe('sans-donnee');
    expect(statut(def({ deEtape: null }), r(3))).toBe('a-configurer');
    expect(
      statut(def({ type: 'entrants', deEtape: null, versEtape: null, objectif: 2 }), r(3)),
    ).toBe('ok');
  });
});
