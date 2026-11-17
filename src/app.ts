import Fastify, { type FastifyInstance } from 'fastify';
import { exigerJeton } from './api/auth.js';
import { registerRoutes } from './api/routes.js';
import type { Db } from './db/index.js';

export type Deps = {
  // Teste que la base répond ; injecté pour pouvoir le simuler en test.
  pingDb: () => Promise<void>;
  version: string;
  db: Db;
  apiToken: string;
};

export function buildApp({ pingDb, version, db, apiToken }: Deps): FastifyInstance {
  const app = Fastify({ logger: false });
  app.get('/health', async (_request, reply) => {
    const databaseOk = await pingDb().then(
      () => true,
      () => false,
    );
    return reply.code(databaseOk ? 200 : 503).send({
      status: databaseOk ? 'ok' : 'degraded',
      version,
      database: databaseOk ? 'ok' : 'error',
    });
  });
  exigerJeton(app, apiToken);
  registerRoutes(app, db);
  return app;
}
