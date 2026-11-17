import { and, asc, count, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { etapes, indicateurs, opportunites, pipelines } from '../db/schema.js';
import { ErreurRequete } from './ressource.js';

// Les étapes de chaque pipe (vente, après-vente), modifiables. L'identifiant d'une étape ne change
// jamais (l'OS et les affaires s'y réfèrent) : on renomme le libellé, on réordonne, on ajoute, on
// supprime. Les identifiants sont uniques tous pipes confondus.
const libelle = z.string().trim().min(1).max(60);
const probabilite = z.number().int().min(0).max(100);
export const PIPE_PAR_DEFAUT = 'vente';

export const identifiantDe = (texte: string): string =>
  texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'etape';

// Cette étape existe-t-elle, et appartient-elle à ce pipe ?
export async function etapeExiste(
  db: Db,
  id: string,
  pipelineId = PIPE_PAR_DEFAUT,
): Promise<boolean> {
  const [e] = await db
    .select({ id: etapes.id })
    .from(etapes)
    .where(and(eq(etapes.id, id), eq(etapes.pipelineId, pipelineId)));
  return !!e;
}

export async function pipeExiste(db: Db, id: string): Promise<boolean> {
  const [p] = await db.select({ id: pipelines.id }).from(pipelines).where(eq(pipelines.id, id));
  return !!p;
}

async function pipeConnu(db: Db, id: string): Promise<string> {
  if (!(await pipeExiste(db, id))) throw new ErreurRequete(`Pipe inconnu : ${id}`);
  return id;
}

export function registerEtapes(app: FastifyInstance, db: Db): void {
  const liste = (pipelineId: string) =>
    db.select().from(etapes).where(eq(etapes.pipelineId, pipelineId)).orderBy(asc(etapes.ordre));

  app.get('/pipelines', () => db.select().from(pipelines).orderBy(asc(pipelines.ordre)));

  app.patch('/pipelines/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const corps = z.strictObject({ label: libelle }).parse(request.body);
    const [p] = await db.update(pipelines).set(corps).where(eq(pipelines.id, id)).returning();
    return p ?? reply.code(404).send({ erreur: 'Pipe introuvable' });
  });

  // `?pipeline=vente` (par défaut), `apres-vente`, ou `tous` (toutes les étapes, pipe par pipe).
  app.get('/etapes', async (request) => {
    const { pipeline } = z
      .object({ pipeline: z.string().default(PIPE_PAR_DEFAUT) })
      .parse(request.query);
    if (pipeline === 'tous') {
      return db.select().from(etapes).orderBy(asc(etapes.pipelineId), asc(etapes.ordre));
    }
    return liste(await pipeConnu(db, pipeline));
  });

  app.post('/etapes', async (request, reply) => {
    const corps = z
      .strictObject({
        label: libelle,
        probabilite: probabilite.default(50),
        pipeline: z.string().default(PIPE_PAR_DEFAUT),
      })
      .parse(request.body);
    const pipelineId = await pipeConnu(db, corps.pipeline);
    const creee = await db.transaction(async (tx) => {
      const existantes = await tx
        .select({ id: etapes.id, ordre: etapes.ordre, pipelineId: etapes.pipelineId })
        .from(etapes);
      const pris = new Set(existantes.map((e) => e.id));
      const base = identifiantDe(corps.label);
      let id = base;
      for (let n = 2; pris.has(id); n++) id = `${base}-${n}`;
      const ordre =
        Math.max(0, ...existantes.filter((e) => e.pipelineId === pipelineId).map((e) => e.ordre)) +
        1;
      const [e] = await tx
        .insert(etapes)
        .values({ id, pipelineId, label: corps.label, ordre, probabilite: corps.probabilite })
        .returning();
      return e;
    });
    return reply.code(201).send(creee);
  });

  // La liste complète des identifiants d'un pipe, dans le nouvel ordre.
  app.put('/etapes/ordre', async (request) => {
    const { ids, pipeline } = z
      .strictObject({ ids: z.array(z.string()), pipeline: z.string().default(PIPE_PAR_DEFAUT) })
      .parse(request.body);
    const pipelineId = await pipeConnu(db, pipeline);
    await db.transaction(async (tx) => {
      const actuelles = (
        await tx.select({ id: etapes.id }).from(etapes).where(eq(etapes.pipelineId, pipelineId))
      ).map((e) => e.id);
      const voulues = new Set(ids);
      if (
        voulues.size !== ids.length ||
        ids.length !== actuelles.length ||
        !actuelles.every((id) => voulues.has(id))
      ) {
        throw new ErreurRequete(
          'La liste doit contenir toutes les étapes du pipe, une fois chacune',
        );
      }
      for (const [i, id] of ids.entries()) {
        await tx
          .update(etapes)
          .set({ ordre: i + 1 })
          .where(eq(etapes.id, id));
      }
    });
    return liste(pipelineId);
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

  // Supprimer une étape utilisée : ses affaires passent d'abord dans l'étape `vers`, du même pipe.
  app.delete('/etapes/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const { vers } = z.object({ vers: z.string().optional() }).parse(request.query);
    return db.transaction(async (tx) => {
      const [cible] = await tx.select().from(etapes).where(eq(etapes.id, id));
      if (!cible) return reply.code(404).send({ erreur: 'Étape introuvable' });
      const toutes = await tx
        .select()
        .from(etapes)
        .where(eq(etapes.pipelineId, cible.pipelineId))
        .orderBy(asc(etapes.ordre));
      if (toutes.length === 1) {
        return reply.code(409).send({ erreur: 'Il faut garder au moins une étape dans ce pipe' });
      }
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
          throw new ErreurRequete('L’étape d’arrivée doit être une autre étape du même pipe');
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
