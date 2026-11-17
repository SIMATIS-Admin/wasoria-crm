export const ETAPES = [
  { id: 'detection', label: 'Détection' },
  { id: 'prospection', label: 'Prospection' },
  { id: 'qualification', label: 'Qualification' },
  { id: 'proposition', label: 'Proposition' },
  { id: 'negociation', label: 'Négociation' },
] as const;

export const libelleEtape = (id: string) => ETAPES.find((e) => e.id === id)?.label ?? id;

export const TYPES_TACHE = [
  { id: 'tache', label: 'Tâche' },
  { id: 'appel', label: 'Appel' },
  { id: 'email', label: 'Email' },
  { id: 'reunion', label: 'Réunion' },
] as const;

export const libelleType = (id: string) => TYPES_TACHE.find((t) => t.id === id)?.label ?? id;
