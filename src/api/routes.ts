import { asc, desc, eq, gte, ilike, isNull, lte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { ZodError, z } from 'zod';
import type { ServiceOdoo } from '../connecteurs/odoo/service.js';
import type { Db } from '../db/index.js';
import {
  activites,
  contacts,
  entreprises,
  opportunites,
  rendezVous,
  taches,
} from '../db/schema.js';
import { registerEchange } from '../echange/routes.js';
import { registerLiens } from '../echange/liens.js';
import { etapeExiste, registerEtapes } from './etapes.js';
import { enregistrer, ErreurRequete } from './ressource.js';
import { creation, idSchema, miseAJour, TYPES_TACHE } from './schemas.js';

const bool = z
  .enum(['0', '1', 'true', 'false'])
  .transform((v) => v === '1' || v === 'true')
  .optional();
const dateHeure = (v: unknown) => (typeof v === 'string' ? new Date(v) : v);
// Un champ envoyé à null vide la colonne ; absent, il ne change rien.
const convertir = (c: Record<string, unknown>, cles: string[]) =>
  Object.fromEntries(Object.entries(c).map(([k, v]) => [k, cles.includes(k) ? dateHeure(v) : v]));

// Comme dans l'OS, le canal d'une tâche se déduit de son type.
const canalDe = (type: string) => (type === 'appel' || type === 'email' ? type : 'tache');

export function registerRoutes(app: FastifyInstance, db: Db, odoo?: ServiceOdoo): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        erreur: 'Requête invalide',
        details: error.issues.map((i) => `${i.path.join('.') || 'corps'} : ${i.message}`),
      });
    }
    if (error instanceof ErreurRequete) return reply.code(400).send({ erreur: error.message });
    // Clé étrangère (fiche encore liée) ou doublon : un conflit, pas une panne.
    // Drizzle enveloppe l'erreur Postgres : le code est sur l'erreur ou sur sa cause.
    const code =
      (error as { code?: string }).code ?? (error as { cause?: { code?: string } }).cause?.code;
    if (code === '23503') {
      return reply
        .code(409)
        .send({ erreur: 'Fiche liée à d’autres fiches, ou lien vers une fiche inexistante' });
    }
    if (code === '23505') return reply.code(409).send({ erreur: 'Fiche déjà existante' });
    if ((error as { statusCode?: number }).statusCode === 400) {
      return reply.code(400).send({ erreur: 'Requête invalide' });
    }
    app.log.error(error);
    return reply.code(500).send({ erreur: 'Erreur interne' });
  });

  enregistrer(app, db, {
    chemin: '/entreprises',
    objet: 'entreprise',
    table: entreprises,
    creation: creation.entreprise,
    miseAJour: miseAJour.entreprise,
    filtres: z.object({ q: z.string().min(1).optional() }),
    ou: (f) => [typeof f.q === 'string' ? ilike(entreprises.nom, `%${f.q}%`) : undefined],
    ordre: [asc(entreprises.nom)],
  });

  enregistrer(app, db, {
    chemin: '/contacts',
    objet: 'contact',
    table: contacts,
    creation: creation.contact,
    miseAJour: miseAJour.contact,
    filtres: z.object({ entrepriseId: idSchema.optional() }),
    ou: (f) => [f.entrepriseId ? eq(contacts.entrepriseId, f.entrepriseId as string) : undefined],
    ordre: [asc(contacts.nom)],
  });

  // Une étape qui change est datée, comme dans l'OS (etapes_dates).
  enregistrer(app, db, {
    chemin: '/affaires',
    objet: 'affaire',
    table: opportunites,
    creation: creation.affaire,
    miseAJour: miseAJour.affaire,
    filtres: z.object({
      etape: z.string().min(1).optional(),
      entrepriseId: idSchema.optional(),
      ouvertes: bool,
    }),
    ou: (f) => [
      f.etape ? eq(opportunites.etape, f.etape as string) : undefined,
      f.entrepriseId ? eq(opportunites.entrepriseId, f.entrepriseId as string) : undefined,
      f.ouvertes ? isNull(opportunites.clos) : undefined,
    ],
    ordre: [desc(opportunites.updatedAt)],
    verifier: async (c) => {
      if (typeof c.etape === 'string' && !(await etapeExiste(db, c.etape))) {
        throw new ErreurRequete(`Étape inconnue : ${c.etape}`);
      }
    },
    avant: (corps, existant) => {
      const etape = corps.etape;
      if (typeof etape !== 'string' || etape === existant?.etape) return corps;
      const dates = (existant?.etapesDates ?? {}) as Record<string, string>;
      return { ...corps, etapesDates: { ...dates, [etape]: new Date().toISOString() } };
    },
  });

  enregistrer(app, db, {
    chemin: '/taches',
    objet: 'tache',
    table: taches,
    creation: creation.tache,
    miseAJour: miseAJour.tache,
    filtres: z.object({
      ouvertes: bool,
      avant: z.iso.datetime({ offset: true }).optional(),
      opportuniteId: idSchema.optional(),
      contactId: idSchema.optional(),
      entrepriseId: idSchema.optional(),
      type: z.enum(TYPES_TACHE).optional(),
    }),
    ou: (f) => [
      f.ouvertes ? isNull(taches.faitAt) : undefined,
      f.avant ? lte(taches.echeance, new Date(f.avant as string)) : undefined,
      f.opportuniteId ? eq(taches.opportuniteId, f.opportuniteId as string) : undefined,
      f.contactId ? eq(taches.contactId, f.contactId as string) : undefined,
      f.entrepriseId ? eq(taches.entrepriseId, f.entrepriseId as string) : undefined,
      f.type ? eq(taches.type, f.type as (typeof TYPES_TACHE)[number]) : undefined,
    ],
    ordre: [asc(taches.echeance), asc(taches.createdAt)],
    avant: (corps) => {
      const valeurs = convertir(corps, ['echeance']);
      return typeof corps.type === 'string'
        ? { ...valeurs, canal: canalDe(corps.type), typeChoisi: true }
        : { canal: 'tache', ...valeurs };
    },
  });

  // Terminer une tâche : date de réalisation, et dernière activité de l'affaire liée.
  app.post('/taches/:id/terminer', async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    return db.transaction(async (tx) => {
      const [tache] = await tx.select().from(taches).where(eq(taches.id, id));
      if (!tache) return reply.code(404).send({ erreur: 'Fiche introuvable' });
      if (tache.faitAt) return tache;
      const maintenant = new Date();
      const [faite] = await tx
        .update(taches)
        .set({ faitAt: maintenant })
        .where(eq(taches.id, id))
        .returning();
      if (tache.opportuniteId) {
        await tx
          .update(opportunites)
          .set({ derniereActivite: maintenant })
          .where(eq(opportunites.id, tache.opportuniteId));
      }
      return faite;
    });
  });

  enregistrer(app, db, {
    chemin: '/rendez-vous',
    objet: 'rendez_vous',
    table: rendezVous,
    creation: creation.rendezVous,
    miseAJour: miseAJour.rendezVous,
    filtres: z.object({
      statut: z.enum(['a_trier', 'rdv', 'ignore']).optional(),
      depuis: z.iso.datetime({ offset: true }).optional(),
      jusqua: z.iso.datetime({ offset: true }).optional(),
    }),
    ou: (f) => [
      f.statut ? eq(rendezVous.statut, f.statut as string) : undefined,
      f.depuis ? gte(rendezVous.debut, new Date(f.depuis as string)) : undefined,
      f.jusqua ? lte(rendezVous.debut, new Date(f.jusqua as string)) : undefined,
    ],
    ordre: [asc(rendezVous.debut)],
    avant: (corps) => {
      const valeurs = convertir(corps, ['debut', 'fin']);
      // Un choix fait ici n'est jamais écrasé par un classement automatique (tri = manuel).
      if ('statut' in corps) valeurs.tri = 'manuel';
      if ('compteRendu' in corps) valeurs.compteRenduAt = corps.compteRendu ? new Date() : null;
      return valeurs;
    },
  });

  // Historique d'un compte, d'un contact ou d'une affaire.
  enregistrer(app, db, {
    chemin: '/activites',
    objet: 'activite',
    table: activites,
    creation: creation.activite,
    miseAJour: miseAJour.activite,
    filtres: z.object({
      entrepriseId: idSchema.optional(),
      contactId: idSchema.optional(),
      opportuniteId: idSchema.optional(),
    }),
    ou: (f) => [
      f.entrepriseId ? eq(activites.entrepriseId, f.entrepriseId as string) : undefined,
      f.contactId ? eq(activites.contactId, f.contactId as string) : undefined,
      f.opportuniteId ? eq(activites.opportuniteId, f.opportuniteId as string) : undefined,
    ],
    ordre: [desc(activites.at)],
    avant: (corps) => convertir(corps, ['at']),
  });

  registerEtapes(app, db);
  registerLiens(app, db);
  registerEchange(app, db);

  // Synchronisation avec Odoo : lecture seule, une à la fois. Absente tant qu'Odoo n'est pas configuré.
  app.post('/odoo/synchro', async (request, reply) => {
    if (!odoo) return reply.code(404).send({ erreur: 'Odoo n’est pas configuré' });
    const { complet } = z.object({ complet: z.boolean().optional() }).parse(request.body ?? {});
    try {
      return await odoo.synchroniser({ complet });
    } catch (erreur) {
      const message = erreur instanceof Error ? erreur.message : 'Erreur';
      return reply.code(message.includes('déjà en cours') ? 409 : 502).send({ erreur: message });
    }
  });
}
