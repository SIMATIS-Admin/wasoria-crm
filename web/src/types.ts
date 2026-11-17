export type Entreprise = {
  id: string;
  nom: string;
  secteur: string | null;
  ville: string | null;
  taille: number | null;
  domaine: string | null;
};
export type Contact = {
  id: string;
  entrepriseId: string | null;
  nom: string;
  fonction: string | null;
  email: string | null;
  telephone: string | null;
};
export type Qualification = {
  besoin: number;
  decideur: number;
  budget: number;
  timing: number;
  engagement: number;
};
export type Pipeline = { id: string; label: string; ordre: number };

export type Affaire = {
  id: string;
  pipelineId: string;
  origineAffaireId: string | null;
  entrepriseId: string | null;
  contactId: string | null;
  titre: string;
  etape: string;
  montant: number | null;
  echeance: string | null;
  clos: 'gagne' | 'perdu' | null;
  motif: string | null;
  proprietaire: string | null;
  origine: string | null;
  prochaineEtape: string | null;
  qualification: Qualification | null;
};
export type Tache = {
  id: string;
  opportuniteId: string | null;
  contactId: string | null;
  entrepriseId: string | null;
  titre: string;
  type: string;
  echeance: string | null;
  faitAt: string | null;
  notes: string | null;
};
export type RendezVous = {
  id: string;
  titre: string;
  debut: string | null;
  fin: string | null;
  lieu: string | null;
  statut: 'a_trier' | 'rdv' | 'ignore';
};
export type Activite = {
  id: string;
  type: string;
  titre: string | null;
  resume: string | null;
  at: string;
};
export type Etape = {
  id: string;
  pipelineId?: string;
  label: string;
  ordre: number;
  probabilite: number;
};

export type Indicateur = {
  id: string;
  label: string;
  type: 'delai' | 'conversion' | 'entrants';
  unite: string;
  deEtape: string | null;
  versEtape: string | null;
  objectif: number | null;
  valeur: number | null;
  moyenne?: number | null;
  convertis?: number;
  n: number;
  statut: 'ok' | 'hors-objectif' | 'sans-objectif' | 'sans-donnee' | 'a-configurer';
  serie?: { semaine: string; n: number }[];
};

export type Article = {
  id: string;
  reference: string;
  nom: string;
  prix: number;
  recurrent: boolean;
  actif: boolean;
  ordre: number;
};

export type LigneDevis = {
  articleId: string | null;
  designation: string;
  prixUnitaire: number;
  recurrent: boolean;
  quantite: number;
};

export type TotauxDevis = {
  investissement: number;
  servicesAnnuels: number;
  totalPremiereAnnee: number;
  mensualite: number | null;
  coutFinancement: number | null;
  totalSurDuree: number | null;
};

export type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'refuse';

export type DevisDetail = {
  id: string;
  numero: string;
  opportuniteId: string;
  statut: StatutDevis;
  formule: 'achat' | 'abonnement';
  dureeMois: number;
  tauxCentiemes: number;
  intro: string | null;
  envoyeLe: string | null;
  decideLe: string | null;
  createdAt: string;
  lignes: LigneDevis[];
  totaux: TotauxDevis;
  affaire: { id: string; titre: string; pipelineId: string } | null;
  entreprise: { id: string; nom: string; ville: string | null } | null;
  contact: { nom: string; fonction: string | null } | null;
};

export type DevisResume = {
  id: string;
  numero: string;
  statut: StatutDevis;
  formule: 'achat' | 'abonnement';
  opportuniteId: string;
  affaire: string;
  entreprise: string | null;
  totaux: TotauxDevis;
  createdAt: string;
};
