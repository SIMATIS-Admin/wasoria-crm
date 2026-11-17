import type { Affaire, Qualification } from './types';

export const eur = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
      }).format(n);

export const jour = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—';

export const jourHeure = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString('fr-FR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

// Une échéance sans heure ("2026-11-20") n'est en retard qu'à partir du lendemain.
export const enRetard = (s: string | null | undefined, maintenant = new Date()) =>
  s != null && new Date(s) < maintenant;

export const CRITERES: [keyof Qualification, string][] = [
  ['besoin', 'Besoin'],
  ['decideur', 'Décideur'],
  ['budget', 'Budget'],
  ['timing', 'Échéance'],
  ['engagement', 'Enjeux'],
];

export const score = (q: Qualification | null) =>
  q ? q.besoin + q.decideur + q.budget + q.timing + q.engagement : 0;

export const niveau = (n: number): { label: string; classe: string } =>
  n >= 12
    ? { label: 'Chaude', classe: 'p-hot' }
    : n >= 8
      ? { label: 'Tiède', classe: 'p-warm' }
      : { label: 'Froide', classe: 'p-cold' };

export const montantOuvert = (affaires: Affaire[]) =>
  affaires.reduce((s, a) => s + (a.montant ?? 0), 0);

export const parEtape = (affaires: Affaire[], etape: string) =>
  affaires.filter((a) => a.etape === etape);
