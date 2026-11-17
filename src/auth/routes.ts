import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { cheminApi, droitRequis, roleSuffit, ROLES } from './droits.js';
import { DUREE_SESSION_MS, ErreurAuth, type Auth, type Utilisateur } from './service.js';

declare module 'fastify' {
  interface FastifyRequest {
    // Renseigné par le garde : la personne connectée, ou null pour un appel d'intégration (jeton).
    utilisateur: Utilisateur | null;
  }
}

const COOKIE = 'wasoria_session';

const egal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function lireCookie(request: FastifyRequest): string | null {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [nom, ...reste] = part.trim().split('=');
    if (nom === COOKIE) return reste.join('=') || null;
  }
  return null;
}

function poserCookie(request: FastifyRequest, reply: FastifyReply, jeton: string | null) {
  const attributs = [
    `${COOKIE}=${jeton ?? ''}`,
    'HttpOnly',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${jeton ? Math.floor(DUREE_SESSION_MS / 1000) : 0}`,
    ...(request.protocol === 'https' ? ['Secure'] : []),
  ];
  void reply.header('set-cookie', attributs.join('; '));
}

// Une requête qui modifie quelque chose doit venir de cette même adresse : SameSite=Strict
// protège déjà, ceci ferme la porte aux navigateurs qui l'ignoreraient.
function origineAcceptee(request: FastifyRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origine = request.headers.origin;
  if (!origine) return true;
  try {
    return new URL(origine).host === request.headers.host;
  } catch {
    return false;
  }
}

const erreur = (reply: FastifyReply, e: unknown) => {
  if (e instanceof ErreurAuth) {
    const statut = {
      identifiants: 401,
      bloque: 429,
      invalide: 400,
      'deja-installe': 409,
      existe: 409,
      conflit: 409,
      introuvable: 404,
    }[e.code];
    return reply.code(statut).send({ erreur: e.message });
  }
  if (e instanceof z.ZodError) return reply.code(400).send({ erreur: 'Requête invalide' });
  throw e;
};

// Routes ouvertes : savoir s'il faut créer le premier compte, créer ce compte, se connecter.
export function routesPubliques(app: FastifyInstance, auth: Auth, jetonInstallation: string): void {
  app.get('/etat', async () => ({ installe: await auth.installe() }));

  app.post('/installation', async (request, reply) => {
    try {
      if (!origineAcceptee(request))
        return await reply.code(403).send({ erreur: 'Origine refusée' });
      const corps = z
        .strictObject({
          jeton: z.string(),
          identifiant: z.string(),
          nom: z.string(),
          motDePasse: z.string(),
        })
        .parse(request.body);
      // Le jeton du serveur (.env) prouve qu'on a la main sur l'installation.
      if (!egal(corps.jeton, jetonInstallation)) {
        return await reply.code(401).send({ erreur: 'Jeton d’installation incorrect' });
      }
      const u = await auth.installer(corps);
      const { jeton } = await auth.connecter(request.ip, u.identifiant, corps.motDePasse);
      poserCookie(request, reply, jeton);
      return await reply.code(201).send({ utilisateur: u });
    } catch (e) {
      return erreur(reply, e);
    }
  });

  app.post('/connexion', async (request, reply) => {
    try {
      if (!origineAcceptee(request))
        return await reply.code(403).send({ erreur: 'Origine refusée' });
      const corps = z
        .strictObject({ identifiant: z.string(), motDePasse: z.string() })
        .parse(request.body);
      const { jeton, utilisateur } = await auth.connecter(
        request.ip,
        corps.identifiant,
        corps.motDePasse,
      );
      poserCookie(request, reply, jeton);
      return { utilisateur };
    } catch (e) {
      return erreur(reply, e);
    }
  });
}

// Garde de tout le reste de l'API : une session ouverte, ou le jeton des intégrations (OS, scripts).
export function exigerAuth(app: FastifyInstance, auth: Auth, jetonIntegration: string): void {
  app.decorateRequest('utilisateur', null);
  app.addHook('onRequest', async (request, reply) => {
    const chemin = cheminApi(request.url);
    const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1];
    if (bearer && egal(bearer, jetonIntegration)) {
      // Le jeton des intégrations (OS, scripts) lit et écrit les données, mais ne gère pas les comptes.
      if (droitRequis(request.method, chemin) === 'admin' && chemin.startsWith('/utilisateurs')) {
        return reply.code(403).send({ erreur: 'Droits insuffisants' });
      }
      return;
    }
    const cookie = lireCookie(request);
    const utilisateur = cookie ? await auth.lireSession(cookie) : null;
    if (!utilisateur) return reply.code(401).send({ erreur: 'Connexion requise' });
    if (!origineAcceptee(request)) return reply.code(403).send({ erreur: 'Origine refusée' });
    if (!roleSuffit(utilisateur.role, droitRequis(request.method, chemin))) {
      return reply.code(403).send({ erreur: 'Droits insuffisants pour cette action' });
    }
    request.utilisateur = utilisateur;
  });
}

export function routesConnectees(app: FastifyInstance, auth: Auth): void {
  app.get('/moi', async (request, reply) =>
    request.utilisateur
      ? { utilisateur: request.utilisateur }
      : reply.code(404).send({ erreur: 'Pas de session' }),
  );

  app.post('/deconnexion', async (request, reply) => {
    const cookie = lireCookie(request);
    if (cookie) await auth.deconnecter(cookie);
    poserCookie(request, reply, null);
    return reply.code(204).send();
  });

  // Changer son propre mot de passe : il faut le mot de passe actuel.
  app.post('/moi/mot-de-passe', async (request, reply) => {
    try {
      if (!request.utilisateur) return await reply.code(404).send({ erreur: 'Pas de session' });
      const corps = z.strictObject({ actuel: z.string(), nouveau: z.string() }).parse(request.body);
      await auth.changerSonMotDePasse(
        request.utilisateur.id,
        corps.actuel,
        corps.nouveau,
        lireCookie(request),
      );
      return await reply.code(204).send();
    } catch (e) {
      return erreur(reply, e);
    }
  });

  // Gestion des comptes, réservée aux administrateurs (le garde s'en charge).
  app.get('/utilisateurs', () => auth.lister());

  app.post('/utilisateurs', async (request, reply) => {
    try {
      const corps = z
        .strictObject({
          identifiant: z.string(),
          nom: z.string(),
          motDePasse: z.string(),
          role: z.enum(ROLES).default('commercial'),
        })
        .parse(request.body);
      return await reply.code(201).send(await auth.creerUtilisateur(corps));
    } catch (e) {
      return erreur(reply, e);
    }
  });

  app.patch('/utilisateurs/:id', async (request, reply) => {
    try {
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      const corps = z
        .strictObject({
          nom: z.string().optional(),
          role: z.enum(ROLES).optional(),
          actif: z.boolean().optional(),
        })
        .parse(request.body);
      return await auth.modifierCompte(id, corps, request.utilisateur?.id);
    } catch (e) {
      return erreur(reply, e);
    }
  });

  app.post('/utilisateurs/:id/mot-de-passe', async (request, reply) => {
    try {
      const { id } = z.object({ id: z.uuid() }).parse(request.params);
      const corps = z.strictObject({ motDePasse: z.string() }).parse(request.body);
      await auth.reinitialiserMotDePasse(id, corps.motDePasse);
      return await reply.code(204).send();
    } catch (e) {
      return erreur(reply, e);
    }
  });
}
