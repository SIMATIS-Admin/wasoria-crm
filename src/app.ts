import Fastify, { type FastifyInstance } from 'fastify';

export type Deps = {
  // Teste que la base répond ; injecté pour pouvoir le simuler en test.
  pingDb: () => Promise<void>;
  version: string;
};

export function buildApp({ pingDb, version }: Deps): FastifyInstance {
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
  return app;
}
