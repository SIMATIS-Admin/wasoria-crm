import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const egal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Tout passe par un jeton, sauf /health. Le jeton vit dans .env, jamais dans le code.
export function exigerJeton(app: FastifyInstance, jeton: string): void {
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health') return;
    const recu = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (!recu || !egal(recu, jeton)) {
      return reply.code(401).send({ erreur: 'Jeton manquant ou invalide' });
    }
  });
}
