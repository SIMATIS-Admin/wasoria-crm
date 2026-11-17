import { asc, count, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { etapes, indicateurs, opportunites } from '../db/schema.js';
import { ErreurRequete } from './ressource.js';

// Les étapes du pipeline, modifiables. L'identifiant d'une étape ne change jamais (l'OS et les
// affaires s'y réfèrent) : on renomme le libellé, on réordonne, on ajoute, on supprime.
const libelle = z.string().trim().min(1).max(60);
const probabilite = z.number().int().min(0).max(100);

export const identifiantDe = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'etape';

export async function etapeExiste(db: Db, id: string): Promise<boolean> {
  const [e] = await db.select({ id: etapes.id }).from(etapes).where(eq(etapes.id, id));
  return !!e;
}

export function registerEtapes(app: FastifyInstance, db: Db): void {
  const liste = () => db.select().from(etapes).orderBy(asc(etapes.ordre));

  app.get('/etapes', () => liste());

  app.post('/etapes', async (request, reply) => {
    const corps = z
      .strictObject({ label: libelle, probabilite: probabilite.default(50) })
      .parse(request.body);
    const creee = await db.transaction(async (tx) => {
      const existantes = await tx.select({ id: etapes.id, ordre: etapes.ordre }).from(etapes);
      const pris = new Set(existantes.map((e) => e.id));
      const base = identifiantDe(corps.label);
      let id = base;
      for (let n = 2; pris.has(id); n++) id = `${base}-${n}`;
      const ordre = Math.max(0, ...existantes.map((e) => e.ordre)) + 1;
      const [e] = await tx
        .insert(etapes)
        .values({ id, label: corps.label, ordre, probabilite: corps.probabilite })
        .returning();
      return e;
    });
    return reply.code(201).send(creee);
  });

  // La liste complète des identifiants, dans le nouvel ordre.
  app.put('/etapes/ordre', async (request) => {
    const { ids } = z.strictObject({ ids: z.array(z.string()) }).parse(request.body);
    await db.transaction(async (tx) => {
      const actuelles = (await tx.select({ id: etapes.id }).from(etapes)).map((e) => e.id);
      const voulues = new Set(ids);
      if (
        voulues.size !== ids.length ||
        ids.length !== actuelles.length ||
        !actuelles.every((id) => voulues.has(id))
      ) {
        throw new ErreurRequete('La liste doit contenir toutes les étapes, une fois chacune');
      }
      for (const [i, id] of ids.entries()) {
        await tx
          .update(etapes)
          .set({ ordre: i + 1 })
          .where(eq(etapes.id, id));
      }
    });
    return liste();
  });

  app.patch('/etapes/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const corps = z
      .strictObject({ label: libelle.optional(), probabilite: probabilite.optional() })
      .parse(request.body);
    if (Object.keys(corps).length === 0) throw new ErreurRequete('Aucun champ à modifier');
    const [e] = await db.update(etapes).set(corps).where(eq(etapes.id, id)).returning();
    return e ?? reply.code(404).send({ erreur: 'Étape introuvable' });
  });

  // Supprimer une étape utilisée : ses affaires passent d'abord dans l'étape `vers`.
  app.delete('/etapes/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { vers } = z.object({ vers: z.string().optional() }).parse(request.query);
    return db.transaction(async (tx) => {
      const toutes = await tx.select().from(etapes).orderBy(asc(etapes.ordre));
      if (!toutes.some((e) => e.id === id))
        return reply.code(404).send({ erreur: 'Étape introuvable' });
      if (toutes.length === 1)
        return reply.code(409).send({ erreur: 'Il faut garder au moins une étape' });
      const [{ n } = { n: 0 }] = await tx
        .select({ n: count() })
        .from(opportunites)
        .where(eq(opportunites.etape, id));
      let deplacees = 0;
      if (n > 0) {
        if (!vers) {
          return reply.code(409).send({
            erreur: `${n} affaire(s) sont dans cette étape : indiquez l’étape où les placer (vers)`,
            affaires: n,
          });
        }
        if (vers === id || !toutes.some((e) => e.id === vers)) {
          throw new ErreurRequete('L’étape d’arrivée doit être une autre étape existante');
        }
        // Chaque affaire déplacée date son arrivée dans la nouvelle étape, comme un changement d'étape.
        const maintenant = new Date().toISOString();
        const r = await tx
          .update(opportunites)
          .set({
            etape: vers,
            etapesDates: sql`coalesce(${opportunites.etapesDates}, '{}'::jsonb) || jsonb_build_object(${vers}::text, ${maintenant}::text)`,
          })
          .where(eq(opportunites.etape, id))
          .returning({ id: opportunites.id });
        deplacees = r.length;
      }
      // Un indicateur qui s'appuyait sur cette étape est à reconfigurer.
      await tx.update(indicateurs).set({ deEtape: null }).where(eq(indicateurs.deEtape, id));
      await tx.update(indicateurs).set({ versEtape: null }).where(eq(indicateurs.versEtape, id));
      await tx.delete(etapes).where(eq(etapes.id, id));
      for (const [i, e] of toutes.filter((x) => x.id !== id).entries()) {
        await tx
          .update(etapes)
          .set({ ordre: i + 1 })
          .where(eq(etapes.id, e.id));
      }
      return { supprimee: id, deplacees };
    });
  });
}
