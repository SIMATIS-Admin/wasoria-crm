import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { exigerAuth, routesConnectees, routesPubliques } from './auth/routes.js';
import { creerAuth } from './auth/service.js';
import { registerRoutes } from './api/routes.js';
import type { ServiceOdoo } from './connecteurs/odoo/service.js';
import type { Db } from './db/index.js';

export type Deps = {
  // Teste que la base répond ; injecté pour pouvoir le simuler en test.
  pingDb: () => Promise<void>;
  version: string;
  // Dossier de l'interface construite (vite build) ; absent, seule l'API est servie.
  webDir?: string;
  db: Db;
  // Jeton des intégrations (OS, scripts) ; sert aussi à créer le premier compte.
  apiToken: string;
  // Derrière un proxy https : fait confiance à ses en-têtes (adresse du client, https).
  trustProxy?: boolean;
  // Présent seulement quand Odoo est configuré.
  odoo?: ServiceOdoo;
};

export function buildApp({
  pingDb,
  version,
  db,
  apiToken,
  webDir,
  odoo,
  trustProxy,
}: Deps): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: trustProxy ?? false });
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
  // L'API vit sous /api : les routes de connexion sont ouvertes, tout le reste exige une session
  // (ou le jeton des intégrations). /health et l'interface (fichiers statiques) restent ouverts.
  const auth = creerAuth(db);
  void app.register(
    async (api) => {
      await api.register((ouvert, _o, fin) => {
        routesPubliques(ouvert, auth, apiToken);
        fin();
      });
      await api.register((protege, _o, fin) => {
        exigerAuth(protege, auth, apiToken);
        routesConnectees(protege, auth);
        registerRoutes(protege, db, odoo);
        fin();
      });
    },
    { prefix: '/api' },
  );
  if (webDir && existsSync(webDir)) {
    void app.register(fastifyStatic, { root: webDir });
  }
  return app;
}
