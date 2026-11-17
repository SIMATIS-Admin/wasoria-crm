import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { suppressions, type entreprises } from '../db/schema.js';
import type { ObjetEchange } from '../echange/profil.js';
import { idSchema, pagination } from './schemas.js';

type Ligne = Record<string, unknown>;

// Une requête refusée pour une raison métier : répond 400 avec le message.
export class ErreurRequete extends Error {}

type Cible = PgTable & { id: PgColumn };

export type Definition = {
  chemin: string;
  // Nom de l'objet dans le profil d'échange : sa suppression est alors journalisée pour l'OS.
  objet?: ObjetEchange;
  table: Cible;
  creation: z.ZodType<Ligne>;
  miseAJour: z.ZodType<Ligne>;
  // Filtres de liste propres à la ressource (en plus de la pagination).
  filtres?: z.ZodObject;
  ou?: (filtres: Record<string, unknown>) => (SQL | undefined)[];
  ordre: SQL[];
  // Transforme le corps reçu en valeurs prêtes pour la base ; `existant` = fiche avant mise à jour.
  avant?: (corps: Ligne, existant?: Ligne) => Ligne;
  // Contrôle asynchrone du corps reçu (ex. référence à une étape) ; lève ErreurRequete.
  verifier?: (corps: Ligne) => Promise<void>;
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
    await d.verifier?.(corps);
    const [fiche] = await db
      .insert(table)
      .values(avant(corps) as never)
      .returning();
    return reply.code(201).send(fiche);
  });

  app.patch(`${d.chemin}/:id`, async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const corps = d.miseAJour.parse(request.body);
    await d.verifier?.(corps);
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
    const supprimees = await db.transaction(async (tx) => {
      const lignes = await tx.delete(table).where(eq(table.id, id)).returning();
      if (lignes.length && d.objet) {
        await tx.insert(suppressions).values({ objet: d.objet, ficheId: id });
      }
      return lignes;
    });
    return supprimees.length ? reply.code(204).send() : reply.code(404).send(introuvable);
  });
}
