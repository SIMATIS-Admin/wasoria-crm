// Données de démonstration : entièrement fictives (noms génériques, montants ronds).
// Ne jamais y recopier une vraie fiche, un vrai nom ou un vrai prix.
const jour = 86_400_000;
export const dansJours = (n: number, heure = 9) => {
  const d = new Date(Date.now() + n * jour);
  d.setUTCHours(heure, 0, 0, 0);
  return d;
};
const date = (n: number) => dansJours(n).toISOString().slice(0, 10);

export const ENTREPRISES = [
  { cle: 'a', nom: 'Entreprise Démo A', secteur: 'Industrie', ville: 'Ville-Alpha', taille: 120 },
  { cle: 'b', nom: 'Entreprise Démo B', secteur: 'Services', ville: 'Ville-Bêta', taille: 45 },
  { cle: 'c', nom: 'Entreprise Démo C', secteur: 'Transport', ville: 'Ville-Gamma', taille: 300 },
  { cle: 'd', nom: 'Entreprise Démo D', secteur: 'Énergie', ville: 'Ville-Delta', taille: 18 },
  { cle: 'e', nom: 'Entreprise Démo E', secteur: 'Industrie', ville: 'Ville-Epsilon', taille: 800 },
  { cle: 'f', nom: 'Entreprise Démo F', secteur: 'Services', ville: 'Ville-Zêta', taille: 7 },
];

export const CONTACTS = [
  {
    cle: 'a1',
    e: 'a',
    nom: 'Alex Exemple',
    fonction: 'Directeur général',
    email: 'alex@exemple.test',
  },
  {
    cle: 'a2',
    e: 'a',
    nom: 'Camille Modèle',
    fonction: 'Responsable technique',
    email: 'camille@exemple.test',
  },
  {
    cle: 'b1',
    e: 'b',
    nom: 'Dominique Test',
    fonction: 'Directrice',
    email: 'dominique@exemple.test',
  },
  {
    cle: 'c1',
    e: 'c',
    nom: 'Claude Démo',
    fonction: 'Responsable achats',
    email: 'claude@exemple.test',
  },
  { cle: 'd1', e: 'd', nom: 'Sacha Fictif', fonction: 'Gérant', email: 'sacha@exemple.test' },
  {
    cle: 'e1',
    e: 'e',
    nom: 'Morgan Factice',
    fonction: 'Directeur de site',
    email: 'morgan@exemple.test',
  },
  {
    cle: 'e2',
    e: 'e',
    nom: 'Robin Imaginaire',
    fonction: 'Responsable QSE',
    email: 'robin@exemple.test',
  },
  { cle: 'f1', e: 'f', nom: 'Jean Anonyme', fonction: 'Fondateur', email: 'jean@exemple.test' },
];

const q = (
  besoin: number,
  decideur: number,
  budget: number,
  timing: number,
  engagement: number,
) => ({
  besoin,
  decideur,
  budget,
  timing,
  engagement,
});

export const AFFAIRES: {
  cle: string;
  e: string;
  c: string;
  titre: string;
  etape: string;
  montant: number | null;
  echeance: string | null;
  proprietaire: string;
  origine: string;
  prochaineEtape: string;
  qualification: ReturnType<typeof q>;
  clos?: 'gagne' | 'perdu';
  // Un dossier après-vente : son pipe, et la vente gagnée dont il vient (sa clé).
  pipeline?: 'apres-vente';
  depuis?: string;
}[] = [
  {
    cle: 'x1',
    e: 'a',
    c: 'a1',
    titre: 'Démo A · projet 1',
    etape: 'proposition',
    montant: 60000,
    echeance: date(45),
    proprietaire: 'Pilote 1',
    origine: 'Salon',
    prochaineEtape: 'Relancer le devis',
    qualification: q(3, 3, 2, 3, 2),
  },
  {
    cle: 'x2',
    e: 'b',
    c: 'b1',
    titre: 'Démo B · extension',
    etape: 'qualification',
    montant: 40000,
    echeance: date(120),
    proprietaire: 'Pilote 2',
    origine: 'Réseau',
    prochaineEtape: 'Identifier le décideur',
    qualification: q(3, 1, 2, 1, 2),
  },
  {
    cle: 'x3',
    e: 'c',
    c: 'c1',
    titre: 'Démo C · second site',
    etape: 'negociation',
    montant: 28000,
    echeance: date(20),
    proprietaire: 'Pilote 1',
    origine: 'Client existant',
    prochaineEtape: 'Valider les conditions',
    qualification: q(3, 3, 3, 3, 2),
  },
  {
    cle: 'x4',
    e: 'd',
    c: 'd1',
    titre: 'Démo D · pilote 6 mois',
    etape: 'prospection',
    montant: 18000,
    echeance: date(90),
    proprietaire: 'Pilote 2',
    origine: 'LinkedIn',
    prochaineEtape: 'Obtenir une visite',
    qualification: q(2, 2, 0, 1, 0),
  },
  {
    cle: 'x5',
    e: 'e',
    c: 'e1',
    titre: 'Démo E · deux lignes',
    etape: 'proposition',
    montant: 14400,
    echeance: date(30),
    proprietaire: 'Pilote 1',
    origine: 'Client existant',
    prochaineEtape: 'Envoyer le devis',
    qualification: q(3, 3, 2, 2, 2),
  },
  {
    cle: 'x6',
    e: 'e',
    c: 'e2',
    titre: 'Démo E · appel d’offres',
    etape: 'detection',
    montant: 90000,
    echeance: date(300),
    proprietaire: 'Pilote 1',
    origine: 'Partenaire',
    prochaineEtape: 'Présentation',
    qualification: q(2, 0, 1, 1, 0),
  },
  {
    cle: 'x7',
    e: 'f',
    c: 'f1',
    titre: 'Démo F · premier contact',
    etape: 'detection',
    montant: null,
    echeance: null,
    proprietaire: 'Pilote 3',
    origine: 'Site web',
    prochaineEtape: 'Envoyer un cas client',
    qualification: q(1, 0, 0, 1, 1),
  },
  {
    cle: 'x8',
    e: 'c',
    c: 'c1',
    titre: 'Démo C · maintenance',
    etape: 'negociation',
    montant: 9600,
    echeance: date(35),
    proprietaire: 'Pilote 3',
    origine: 'Client existant',
    prochaineEtape: 'Point de suivi',
    qualification: q(3, 3, 2, 3, 1),
  },
  {
    cle: 'x9',
    e: 'a',
    c: 'a1',
    titre: 'Démo A · contrat signé',
    etape: 'negociation',
    montant: 22000,
    echeance: date(-10),
    proprietaire: 'Pilote 1',
    origine: 'Client existant',
    prochaineEtape: 'Planifier le démarrage',
    qualification: q(3, 3, 3, 3, 3),
    clos: 'gagne',
  },
  {
    cle: 'x10',
    e: 'a',
    c: 'a1',
    titre: 'Démo A · contrat signé · après-vente',
    etape: 'suivi-mco',
    montant: 4800,
    echeance: date(60),
    proprietaire: 'Pilote 4',
    origine: 'Vente gagnée',
    prochaineEtape: 'Visite de suivi',
    qualification: q(0, 0, 0, 0, 0),
    pipeline: 'apres-vente',
    depuis: 'x9',
  },
  {
    cle: 'x11',
    e: 'c',
    c: 'c1',
    titre: 'Démo C · second site · après-vente',
    etape: 'installation',
    montant: 2100,
    echeance: date(25),
    proprietaire: 'Pilote 4',
    origine: 'Vente gagnée',
    prochaineEtape: 'Planifier l’installation',
    qualification: q(0, 0, 0, 0, 0),
    pipeline: 'apres-vente',
  },
];

// jours depuis aujourd'hui : négatif = en retard
export const TACHES = [
  { a: 'x1', titre: 'Relancer le devis', type: 'email', jours: -2 },
  { a: 'x2', titre: 'Identifier le décideur', type: 'appel', jours: -5 },
  { a: 'x3', titre: 'Valider les conditions', type: 'appel', jours: 1 },
  { a: 'x4', titre: 'Obtenir une visite', type: 'email', jours: 3 },
  { a: 'x5', titre: 'Envoyer le devis', type: 'tache', jours: -9 },
  { a: 'x6', titre: 'Préparer la présentation', type: 'tache', jours: 10 },
  { a: 'x7', titre: 'Envoyer un cas client', type: 'email', jours: 2 },
  { a: 'x8', titre: 'Point de suivi', type: 'reunion', jours: 0 },
];

export const RENDEZ_VOUS = [
  { titre: 'Visite Entreprise Démo A', jours: 2, lieu: 'Sur site', statut: 'rdv' },
  { titre: 'Point Entreprise Démo C', jours: 5, lieu: 'Visio', statut: 'rdv' },
  { titre: 'Créneau à classer', jours: 7, lieu: null, statut: 'a_trier' },
];

export const SUIVI = [
  {
    a: 'x1',
    jours: -6,
    type: 'email',
    titre: 'Devis envoyé',
    resume: 'Devis envoyé après la visite.',
  },
  {
    a: 'x1',
    jours: -20,
    type: 'reunion',
    titre: 'Visite du site',
    resume: 'Échange sur les besoins et le calendrier de décision.',
  },
  {
    a: 'x3',
    jours: -3,
    type: 'appel',
    titre: 'Appel de cadrage',
    resume: 'Les conditions sont presque validées.',
  },
];

// Catalogue fictif : des noms et des prix génériques, rien qui vienne d'une vraie offre.
export const ARTICLES: { reference: string; nom: string; prix: number; recurrent: boolean }[] = [
  { reference: 'CAP', nom: 'Capteur de détection (par point)', prix: 5000, recurrent: false },
  { reference: 'INST', nom: 'Installation et calibration', prix: 1500, recurrent: false },
  { reference: 'FORM', nom: 'Formation des opérateurs', prix: 900, recurrent: false },
  { reference: 'PLAT', nom: 'Plateforme de suivi (par site)', prix: 2400, recurrent: true },
  { reference: 'ANAL', nom: 'Analyse des flux (par site)', prix: 1200, recurrent: true },
  { reference: 'MAINT', nom: 'Maintenance (par capteur)', prix: 600, recurrent: true },
];

// Devis de démonstration : l'affaire (sa clé), la formule, l'état, et les lignes (référence, quantité).
export const DEVIS_DEMO: {
  a: string;
  formule: 'achat' | 'abonnement';
  dureeMois: number;
  statut: 'brouillon' | 'envoye' | 'accepte';
  intro: string;
  lignes: [string, number][];
}[] = [
  {
    a: 'x1',
    formule: 'abonnement',
    dureeMois: 48,
    statut: 'envoye',
    intro:
      'Détecter les objets dangereux avant qu’ils ne chauffent, pour protéger vos opérateurs et la continuité de vos lignes.',
    lignes: [
      ['CAP', 4],
      ['INST', 1],
      ['FORM', 1],
      ['PLAT', 1],
      ['MAINT', 4],
    ],
  },
  {
    a: 'x5',
    formule: 'achat',
    dureeMois: 48,
    statut: 'brouillon',
    intro: 'Deux lignes équipées, avec formation et suivi.',
    lignes: [
      ['CAP', 2],
      ['INST', 1],
      ['MAINT', 2],
    ],
  },
  {
    a: 'x9',
    formule: 'achat',
    dureeMois: 48,
    statut: 'accepte',
    intro: 'Équipement du second site.',
    lignes: [
      ['CAP', 2],
      ['INST', 1],
      ['FORM', 1],
      ['ANAL', 1],
    ],
  },
];
