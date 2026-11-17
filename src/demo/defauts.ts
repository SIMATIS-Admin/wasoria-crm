// L'état de départ du pipe et des indicateurs, tel que les migrations le créent. Sert à remettre un CRM
// de démonstration à zéro (un test vérifie que ces valeurs restent identiques à celles des migrations).
export const ETAPES_DEFAUT = [
  { id: 'detection', pipelineId: 'vente', label: 'Détection', ordre: 1, probabilite: 10 },
  { id: 'prospection', pipelineId: 'vente', label: 'Prospection', ordre: 2, probabilite: 20 },
  { id: 'qualification', pipelineId: 'vente', label: 'Qualification', ordre: 3, probabilite: 40 },
  { id: 'proposition', pipelineId: 'vente', label: 'Proposition', ordre: 4, probabilite: 60 },
  { id: 'negociation', pipelineId: 'vente', label: 'Négociation', ordre: 5, probabilite: 80 },
  {
    id: 'installation',
    pipelineId: 'apres-vente',
    label: 'Installation',
    ordre: 1,
    probabilite: 100,
  },
  {
    id: 'mise-en-service',
    pipelineId: 'apres-vente',
    label: 'Mise en service',
    ordre: 2,
    probabilite: 100,
  },
  { id: 'suivi-mco', pipelineId: 'apres-vente', label: 'Suivi et MCO', ordre: 3, probabilite: 100 },
  {
    id: 'renouvellement',
    pipelineId: 'apres-vente',
    label: 'Renouvellement',
    ordre: 4,
    probabilite: 100,
  },
];

export const INDICATEURS_DEFAUT = [
  {
    id: 'delai-devis',
    label: 'Délai de remise du devis',
    type: 'delai' as const,
    deEtape: 'qualification',
    versEtape: 'proposition',
    objectif: 10,
    ordre: 1,
  },
  {
    id: 'delai-reponse',
    label: 'Délai de première réponse',
    type: 'delai' as const,
    deEtape: 'detection',
    versEtape: 'prospection',
    objectif: null,
    ordre: 2,
  },
  {
    id: 'contact-visite',
    label: 'Du contact à la visite',
    type: 'conversion' as const,
    deEtape: 'prospection',
    versEtape: 'qualification',
    objectif: 50,
    ordre: 3,
  },
  {
    id: 'devis-commande',
    label: 'Du devis à la commande',
    type: 'conversion' as const,
    deEtape: 'proposition',
    versEtape: '@gagne',
    objectif: null,
    ordre: 4,
  },
  {
    id: 'entrants',
    label: 'Opportunités entrantes par semaine',
    type: 'entrants' as const,
    deEtape: null,
    versEtape: null,
    objectif: null,
    ordre: 5,
  },
];
