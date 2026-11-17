import { z } from 'zod';

// Champs que l'API accepte. `source`, `source_id`, l'id et les dates ne passent jamais par ici :
// une fiche créée par l'API est `natif`, les connecteurs écrivent le reste eux-mêmes.
const texte = z.string().trim().min(1).max(500);
const optTexte = texte.nullable().optional();
const date = z.iso.date();
const dateHeure = z.iso.datetime({ offset: true });
const id = z.uuid();

export const entreprise = z.strictObject({
  nom: texte,
  secteur: optTexte,
  ville: optTexte,
  taille: z.number().int().min(0).nullable().optional(),
  domaine: optTexte,
  siren: z
    .string()
    .regex(/^\d{9}$/)
    .nullable()
    .optional(),
});

export const contact = z.strictObject({
  entrepriseId: id.nullable().optional(),
  nom: texte,
  fonction: optTexte,
  email: z.email().nullable().optional(),
  telephone: optTexte,
  role: optTexte,
});

const note = z.number().int().min(0).max(3);
export const qualification = z.strictObject({
  besoin: note,
  decideur: note,
  budget: note,
  timing: note,
  engagement: note,
});

export const affaire = z.strictObject({
  entrepriseId: id.nullable().optional(),
  contactId: id.nullable().optional(),
  titre: texte,
  etape: texte,
  modeFacturation: z.enum(['spot', 'recurrent']).optional(),
  dureeEngagementMois: z.number().int().min(1).optional(),
  taciteReconduction: z.boolean().optional(),
  probabiliteManuelle: z.number().int().min(0).max(100).nullable().optional(),
  signatureEstimee: date.nullable().optional(),
  montant: z.number().int().min(0).nullable().optional(),
  echeance: date.nullable().optional(),
  clos: z.enum(['gagne', 'perdu']).nullable().optional(),
  motif: optTexte,
  proprietaire: optTexte,
  origine: optTexte,
  qualification: qualification.nullable().optional(),
  potentiel: optTexte,
  faisabilite: optTexte,
  prochaineEtape: optTexte,
});

export const TYPES_TACHE = ['appel', 'email', 'tache', 'reunion', 'echeance', 'dejeuner'] as const;

// `canal` se déduit du type, comme dans l'OS : il n'est pas saisi.
export const tache = z.strictObject({
  opportuniteId: id.nullable().optional(),
  contactId: id.nullable().optional(),
  entrepriseId: id.nullable().optional(),
  titre: texte,
  type: z.enum(TYPES_TACHE).optional(),
  echeance: dateHeure.nullable().optional(),
  avecHeure: z.boolean().optional(),
  dureeMinutes: z.number().int().min(1).nullable().optional(),
  occupe: z.boolean().optional(),
  prepare: z.boolean().optional(),
  notes: z.string().max(10_000).nullable().optional(),
});

export const rendezVous = z.strictObject({
  titre: z.string().trim().max(500).optional(),
  debut: dateHeure.nullable().optional(),
  fin: dateHeure.nullable().optional(),
  lieu: optTexte,
  participants: z.array(z.email()).optional(),
  statut: z.enum(['a_trier', 'rdv', 'ignore']).optional(),
  compteRendu: z.string().max(50_000).nullable().optional(),
});

export const pagination = z.object({
  limite: z.coerce.number().int().min(1).max(200).default(50),
  decalage: z.coerce.number().int().min(0).default(0),
});

export const creation = { entreprise, contact, affaire, tache, rendezVous };
// Mise à jour partielle : mêmes champs, tous facultatifs.
export const miseAJour = {
  entreprise: entreprise.partial(),
  contact: contact.partial(),
  affaire: affaire.partial(),
  tache: tache.partial(),
  rendezVous: rendezVous.partial(),
};
export { id as idSchema };
