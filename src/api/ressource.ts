import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import type { entreprises } from '../db/schema.js';
import { idSchema, pagination } from './schemas.js';

type Ligne = Record<string, unknown>;

type Cible = PgTable & { id: PgColumn };

export type Definition = {
  chemin: string;
  table: Cible;
  creation: z.ZodType<Ligne>;
  miseAJour: z.ZodType<Ligne>;
  // Filtres de liste propres à la ressource (en plus de la pagination).
  filtres?: z.ZodObject;
  ou?: (filtres: Record<string, unknown>) => (SQL | undefined)[];
  ordre: SQL[];
  // Transforme le corps reçu en valeurs prêtes pour la base ; `existant` = fiche avant mise à jour.
  avant?: (corps: Ligne, existant?: Ligne) => Ligne;
};

const introuvable = { erreur: 'Fiche introuvable' };

// CRUD commun aux objets du CRM : lister, lire, créer, modifier, supprimer.
export function enregistrer(app: FastifyInstance, db: Db, d: Definition): void {
  // Le typage fin de Drizzle ne se généralise pas à une table quelconque : on s'appuie sur la forme
  // commune (colonne id) et les schémas Zod valident les champs.
  const table = d.table as unknown as typeof entreprises;
  const requete = pagination.extend(d.filtres?.shape ?? {});
  const avant = d.avant ?? ((c: Ligne) => c);

  app.get(d.chemin, async (request) => {
    const { limite, decalage, ...filtres } = requete.parse(request.query) as {
      limite: number;
      decalage: number;
    } & Record<string, unknown>;
    return db
      .select()
      .from(table)
      .where(and(...(d.ou?.(filtres) ?? [])))
      .orderBy(...d.ordre)
      .limit(limite)
      .offset(decalage);
  });

  app.get(`${d.chemin}/:id`, async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const [fiche] = await db.select().from(table).where(eq(table.id, id));
    return fiche ?? reply.code(404).send(introuvable);
  });

  app.post(d.chemin, async (request, reply) => {
    const corps = d.creation.parse(request.body);
    const [fiche] = await db
      .insert(table)
      .values(avant(corps) as never)
      .returning();
    return reply.code(201).send(fiche);
  });

  app.patch(`${d.chemin}/:id`, async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const corps = d.miseAJour.parse(request.body);
    const [existant] = await db.select().from(table).where(eq(table.id, id));
    if (!existant) return reply.code(404).send(introuvable);
    const valeurs = avant(corps, existant);
    if (Object.keys(valeurs).length === 0) return existant;
    const [fiche] = await db
      .update(table)
      .set(valeurs as never)
      .where(eq(table.id, id))
      .returning();
    return fiche;
  });

  app.delete(`${d.chemin}/:id`, async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const supprimees = await db.delete(table).where(eq(table.id, id)).returning();
    return supprimees.length ? reply.code(204).send() : reply.code(404).send(introuvable);
  });
}
