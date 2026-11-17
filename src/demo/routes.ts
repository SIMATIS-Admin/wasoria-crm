// TEMPORAIRE : le bouton « Démo ». Pour le retirer : supprimer ce fichier, `scenario.ts`, `defauts.ts`
// (et leurs tests), la ligne `registerDemo` de api/routes.ts, `DEMO_MODE` de config.ts et app.ts,
// `web/src/Demo.tsx` et son usage dans App.tsx.
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { chargerScenarioDemo } from './scenario.js';

export function registerDemo(app: FastifyInstance, db: Db, actif: boolean): void {
  // Le bouton ne s'affiche que si le mode démonstration est actif sur ce serveur.
  app.get('/demo', () => ({ actif }));

  // Efface les données de travail et recharge le scénario : administrateurs seulement (droits.ts), et
  // seulement quand le serveur a été lancé en mode démonstration (DEMO_MODE=on).
  app.post('/demo/charger', async (_request, reply) => {
    if (!actif) return reply.code(404).send({ erreur: 'Le mode démonstration n’est pas actif' });
    await chargerScenarioDemo(db);
    const { rows } = await db.execute<{ affaires: string; devis: string }>(
      sql`select (select count(*) from opportunites) as affaires, (select count(*) from devis) as devis`,
    );
    return {
      charge: true,
      affaires: Number(rows[0]?.affaires ?? 0),
      devis: Number(rows[0]?.devis ?? 0),
    };
  });
}
