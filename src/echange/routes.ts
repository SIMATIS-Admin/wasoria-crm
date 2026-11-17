import { gte } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import { suppressions } from '../db/schema.js';
import { lireEtapes, lireFiches, OBJETS_ECHANGE } from './profil.js';

const depuis = z.iso.datetime({ offset: true }).optional();

// Ce que lit le connecteur de SIMATIS OS : le CRM dans les champs du profil crm/1, lisible depuis
// une date, par pages. Lecture seule ; les écritures de l'OS passent par les routes du CRM.
export function registerEchange(app: FastifyInstance, db: Db): void {
  app.get('/echange', () => ({
    profil: 'crm/1',
    objets: OBJETS_ECHANGE,
    horodatage: new Date().toISOString(),
  }));

  app.get('/echange/etapes', async () => ({ etapes: await lireEtapes(db) }));

  app.get('/echange/suppressions', async (request) => {
    const q = z.object({ depuis }).parse(request.query);
    const lignes = await db
      .select()
      .from(suppressions)
      .where(q.depuis ? gte(suppressions.supprimeLe, new Date(q.depuis)) : undefined)
      .orderBy(suppressions.supprimeLe);
    return lignes.map((l) => ({
      objet: l.objet,
      id: l.ficheId,
      supprime_le: l.supprimeLe.toISOString(),
    }));
  });

  app.get('/echange/:objet', async (request) => {
    const { objet } = z.object({ objet: z.enum(OBJETS_ECHANGE) }).parse(request.params);
    const q = z
      .object({
        depuis,
        limite: z.coerce.number().int().min(1).max(500).default(200),
        decalage: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);
    return lireFiches(db, objet, {
      depuis: q.depuis ? new Date(q.depuis) : null,
      limite: q.limite,
      decalage: q.decalage,
    });
  });
}
