import type { Etape } from './types';

// Les étapes viennent du serveur (modifiables dans l'écran Étapes) ; une étape retirée entre-temps
// s'affiche par son identifiant.
export const libelleEtape = (id: string, etapes: Etape[]) =>
  etapes.find((e) => e.id === id)?.label ?? id;

export const TYPES_TACHE = [
  { id: 'tache', label: 'Tâche' },
  { id: 'appel', label: 'Appel' },
  { id: 'email', label: 'Email' },
  { id: 'reunion', label: 'Réunion' },
] as const;

export const libelleType = (id: string) => TYPES_TACHE.find((t) => t.id === id)?.label ?? id;
