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
export type Affaire = {
  id: string;
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
