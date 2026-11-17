import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { exigerJeton } from './api/auth.js';
import { registerRoutes } from './api/routes.js';
import type { Db } from './db/index.js';

export type Deps = {
  // Teste que la base répond ; injecté pour pouvoir le simuler en test.
  pingDb: () => Promise<void>;
  version: string;
  // Dossier de l'interface construite (vite build) ; absent, seule l'API est servie.
  webDir?: string;
  db: Db;
  apiToken: string;
};

export function buildApp({ pingDb, version, db, apiToken, webDir }: Deps): FastifyInstance {
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
  // L'API vit sous /api et exige le jeton ; /health et l'interface (fichiers statiques) restent ouverts.
  void app.register(
    (api, _options, done) => {
      exigerJeton(api, apiToken);
      registerRoutes(api, db);
      done();
    },
    { prefix: '/api' },
  );
  if (webDir && existsSync(webDir)) {
    void app.register(fastifyStatic, { root: webDir });
  }
  return app;
}
