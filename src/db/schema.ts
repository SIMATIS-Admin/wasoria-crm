import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Même modèle que le CRM de SIMATIS OS (noms de tables et de colonnes identiques), pour que les
// deux communiquent. Différence : un seul client (WASORIA), donc pas d'instance_id ni de RLS.

// `source` dit d'où vient la fiche : 'natif' (créée ici), 'odoo', 'os' (SIMATIS OS)…
// `source_id` est son identifiant chez cette source : une synchro met la fiche à jour, sans doublon.
const metierColumns = () => ({
  source: text('source').notNull().default('natif'),
  sourceId: text('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const entreprises = pgTable(
  'entreprises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    nom: text('nom').notNull(),
    secteur: text('secteur'),
    ville: text('ville'),
    taille: integer('taille'),
    domaine: text('domaine'),
    siren: text('siren'),
  },
  (t) => [uniqueIndex('entreprises_source_idx').on(t.source, t.sourceId)],
);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    entrepriseId: uuid('entreprise_id').references(() => entreprises.id),
    nom: text('nom').notNull(),
    fonction: text('fonction'),
    email: text('email'),
    telephone: text('telephone'),
    role: text('role'),
  },
  (t) => [uniqueIndex('contacts_source_idx').on(t.source, t.sourceId)],
);

export type Qualification = {
  besoin: number;
  decideur: number;
  budget: number;
  timing: number;
  engagement: number;
};

// « Affaire » dans l'interface, `opportunites` en base comme dans l'OS.
export const opportunites = pgTable(
  'opportunites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    entrepriseId: uuid('entreprise_id').references(() => entreprises.id),
    contactId: uuid('contact_id').references(() => contacts.id),
    titre: text('titre').notNull(),
    etape: text('etape').notNull(),
    modeFacturation: text('mode_facturation', { enum: ['spot', 'recurrent'] })
      .notNull()
      .default('spot'),
    dureeEngagementMois: integer('duree_engagement_mois').notNull().default(12),
    taciteReconduction: boolean('tacite_reconduction').notNull().default(true),
    probabiliteManuelle: integer('probabilite_manuelle'),
    signatureEstimee: date('signature_estimee'),
    montant: integer('montant'),
    echeance: date('echeance'),
    clos: text('clos', { enum: ['gagne', 'perdu'] }),
    motif: text('motif'),
    proprietaire: text('proprietaire'),
    origine: text('origine'),
    qualification: jsonb('qualification').$type<Qualification>(),
    potentiel: text('potentiel'),
    faisabilite: text('faisabilite'),
    prochaineEtape: text('prochaine_etape'),
    derniereActivite: timestamp('derniere_activite', { withTimezone: true }),
    etapesDates: jsonb('etapes_dates').$type<Record<string, string>>().notNull().default({}),
  },
  (t) => [uniqueIndex('opportunites_source_idx').on(t.source, t.sourceId)],
);

export const taches = pgTable(
  'taches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    opportuniteId: uuid('opportunite_id').references(() => opportunites.id),
    contactId: uuid('contact_id').references(() => contacts.id),
    entrepriseId: uuid('entreprise_id').references(() => entreprises.id),
    lienChoisi: boolean('lien_choisi').notNull().default(false),
    titre: text('titre').notNull(),
    canal: text('canal', { enum: ['email', 'appel', 'tache'] }).notNull(),
    echeance: timestamp('echeance', { withTimezone: true }),
    faitAt: timestamp('fait_at', { withTimezone: true }),
    prepare: boolean('prepare').notNull().default(false),
    notes: text('notes'),
    type: text('type', {
      enum: ['appel', 'email', 'tache', 'reunion', 'echeance', 'dejeuner'],
    })
      .notNull()
      .default('tache'),
    typeChoisi: boolean('type_choisi').notNull().default(false),
    avecHeure: boolean('avec_heure').notNull().default(false),
    dureeMinutes: integer('duree_minutes'),
    occupe: boolean('occupe').notNull().default(false),
  },
  (t) => [
    index('taches_echeance_idx').on(t.echeance),
    uniqueIndex('taches_source_idx').on(t.source, t.sourceId),
  ],
);

export const rendezVous = pgTable(
  'rendez_vous',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    // Identifiant de l'événement d'agenda quand le RDV en vient ; vide pour un RDV créé ici.
    eventId: text('event_id'),
    titre: text('titre').notNull().default(''),
    debut: timestamp('debut', { withTimezone: true }),
    fin: timestamp('fin', { withTimezone: true }),
    lieu: text('lieu'),
    participants: jsonb('participants').$type<string[]>().notNull().default([]),
    statut: text('statut').notNull().default('a_trier'),
    tri: text('tri').notNull().default('aucun'),
    compteRendu: text('compte_rendu'),
    compteRenduAt: timestamp('compte_rendu_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('rendez_vous_event_idx').on(t.eventId)],
);

export const activites = pgTable(
  'activites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    type: text('type').notNull(),
    contactId: uuid('contact_id').references(() => contacts.id),
    entrepriseId: uuid('entreprise_id').references(() => entreprises.id),
    opportuniteId: uuid('opportunite_id').references(() => opportunites.id),
    titre: text('titre'),
    at: timestamp('at', { withTimezone: true }).notNull(),
    resume: text('resume'),
  },
  (t) => [
    index('activites_at_idx').on(t.at),
    uniqueIndex('activites_source_idx').on(t.source, t.sourceId),
  ],
);

// Liens plusieurs-à-plusieurs. Les colonnes à lien unique (opportunites.contact_id…) restent le
// lien principal que lisent le pipe et les fiches.

export const affaireContacts = pgTable(
  'affaire_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    opportuniteId: uuid('opportunite_id')
      .notNull()
      .references(() => opportunites.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => [uniqueIndex('affaire_contacts_paire_idx').on(t.opportuniteId, t.contactId)],
);

export const affaireEntreprises = pgTable(
  'affaire_entreprises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    opportuniteId: uuid('opportunite_id')
      .notNull()
      .references(() => opportunites.id, { onDelete: 'cascade' }),
    entrepriseId: uuid('entreprise_id')
      .notNull()
      .references(() => entreprises.id, { onDelete: 'cascade' }),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => [uniqueIndex('affaire_entreprises_paire_idx').on(t.opportuniteId, t.entrepriseId)],
);

export const contactEntreprises = pgTable(
  'contact_entreprises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    entrepriseId: uuid('entreprise_id')
      .notNull()
      .references(() => entreprises.id, { onDelete: 'cascade' }),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => [uniqueIndex('contact_entreprises_paire_idx').on(t.contactId, t.entrepriseId)],
);

export const contactEmails = pgTable(
  'contact_emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    principal: boolean('principal').notNull().default(false),
  },
  (t) => [uniqueIndex('contact_emails_paire_idx').on(t.contactId, t.email)],
);

export const rdvContacts = pgTable(
  'rdv_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    rendezVousId: uuid('rendez_vous_id')
      .notNull()
      .references(() => rendezVous.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => contacts.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('rdv_contacts_paire_idx').on(t.rendezVousId, t.contactId)],
);

export const rdvEntreprises = pgTable(
  'rdv_entreprises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    rendezVousId: uuid('rendez_vous_id')
      .notNull()
      .references(() => rendezVous.id, { onDelete: 'cascade' }),
    entrepriseId: uuid('entreprise_id')
      .notNull()
      .references(() => entreprises.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('rdv_entreprises_paire_idx').on(t.rendezVousId, t.entrepriseId)],
);

export const rdvAffaires = pgTable(
  'rdv_affaires',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ...metierColumns(),
    rendezVousId: uuid('rendez_vous_id')
      .notNull()
      .references(() => rendezVous.id, { onDelete: 'cascade' }),
    opportuniteId: uuid('opportunite_id')
      .notNull()
      .references(() => opportunites.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('rdv_affaires_paire_idx').on(t.rendezVousId, t.opportuniteId)],
);

// Où en est chaque synchronisation avec un outil tiers : le curseur est la date de dernière
// modification déjà copiée, pour ne relire que ce qui a changé.
export const synchronisations = pgTable(
  'synchronisations',
  {
    connecteur: text('connecteur').notNull(),
    objet: text('objet').notNull(),
    curseur: text('curseur'),
    derniereExecution: timestamp('derniere_execution', { withTimezone: true }),
  },
  (t) => [uniqueIndex('synchronisations_pk_idx').on(t.connecteur, t.objet)],
);

// Les étapes du pipeline, partagées avec l'OS (même forme que ses étapes : id, libellé, ordre,
// étape de clôture, gagnée, probabilité de gain en %). L'affaire garde son étape et, à part, `clos`.
export const etapes = pgTable('etapes', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  ordre: integer('ordre').notNull(),
  clos: boolean('clos').notNull().default(false),
  gagne: boolean('gagne').notNull().default(false),
  probabilite: integer('probabilite').notNull(),
});

// Journal des fiches supprimées ici : l'OS ne les efface jamais de lui-même, il les signale.
export const suppressions = pgTable(
  'suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    objet: text('objet').notNull(),
    ficheId: uuid('fiche_id').notNull(),
    supprimeLe: timestamp('supprime_le', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('suppressions_le_idx').on(t.supprimeLe)],
);
