import { asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ErreurRequete } from '../api/ressource.js';
import type { Db } from '../db/index.js';
import { etapes, indicateurs, opportunites } from '../db/schema.js';
import { calculer, GAGNE, PERDU, statut, type AffaireCalcul } from './calcul.js';

const UNITES = { delai: 'jours', conversion: '%', entrants: 'par semaine' } as const;

export function registerIndicateurs(app: FastifyInstance, db: Db): void {
  app.get('/indicateurs', async (request) => {
    const { jours } = z
      .object({ jours: z.coerce.number().int().min(7).max(730).default(90) })
      .parse(request.query);
    const [defs, lignes] = await Promise.all([
      db.select().from(indicateurs).orderBy(asc(indicateurs.ordre)),
      db
        .select({
          creeLe: opportunites.createdAt,
          etapesDates: opportunites.etapesDates,
          clos: opportunites.clos,
          closLe: opportunites.closLe,
        })
        .from(opportunites),
    ]);
    const affaires: AffaireCalcul[] = lignes;
    const maintenant = new Date();
    return {
      jours,
      indicateurs: defs.map((d) => {
        const r = calculer(d, affaires, { jours, maintenant });
        return {
          id: d.id,
          label: d.label,
          type: d.type,
          unite: UNITES[d.type],
          deEtape: d.deEtape,
          versEtape: d.versEtape,
          objectif: d.objectif,
          statut: statut(d, r),
          ...r,
        };
      }),
    };
  });

  // Libellé, objectif et étapes d'un indicateur. Les étapes doivent exister ; `@gagne` et `@perdu`
  // ne servent que d'arrivée.
  app.patch('/indicateurs/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const corps = z
      .strictObject({
        label: z.string().trim().min(1).max(80).optional(),
        objectif: z.number().int().min(0).max(100_000).nullable().optional(),
        deEtape: z.string().nullable().optional(),
        versEtape: z.string().nullable().optional(),
      })
      .parse(request.body);
    if (Object.keys(corps).length === 0) throw new ErreurRequete('Aucun champ à modifier');
    const [def] = await db.select().from(indicateurs).where(eq(indicateurs.id, id));
    if (!def) return reply.code(404).send({ erreur: 'Indicateur introuvable' });
    if (def.type === 'entrants' && (corps.deEtape !== undefined || corps.versEtape !== undefined)) {
      throw new ErreurRequete('Cet indicateur ne dépend d’aucune étape');
    }
    const ids = new Set((await db.select({ id: etapes.id }).from(etapes)).map((e) => e.id));
    if (corps.deEtape && !ids.has(corps.deEtape)) {
      throw new ErreurRequete(`Étape inconnue : ${corps.deEtape}`);
    }
    if (corps.versEtape && ![...ids, GAGNE, PERDU].includes(corps.versEtape)) {
      throw new ErreurRequete(`Étape inconnue : ${corps.versEtape}`);
    }
    const [maj] = await db.update(indicateurs).set(corps).where(eq(indicateurs.id, id)).returning();
    return maj;
  });
}
