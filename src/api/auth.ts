import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const egal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Toute l'API passe par un jeton. Le jeton vit dans .env, jamais dans le code.
export function exigerJeton(app: FastifyInstance, jeton: string): void {
  app.addHook('onRequest', async (request, reply) => {
    const recu = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (!recu || !egal(recu, jeton)) {
      return reply.code(401).send({ erreur: 'Jeton manquant ou invalide' });
    }
  });
}
