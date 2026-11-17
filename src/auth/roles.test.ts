import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/index.js';
import { demarrerBase, JETON } from '../test/base.js';
import type { Role } from './droits.js';
import { creerAuth } from './service.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
const MDP = 'un-mot-de-passe-solide';
const cookies: Record<Role, string> = { admin: '', commercial: '', 'apres-vente': '', lecture: '' };
let auth: ReturnType<typeof creerAuth>;

const cookieDe = (set: string | string[] | undefined) =>
  String(Array.isArray(set) ? set[0] : set)
    .split(';')[0]!
    .trim();
const requete = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  options: { cookie?: string; payload?: object; jeton?: boolean } = {},
) =>
  base.app.inject({
    method,
    url: `/api${url}`,
    payload: options.payload,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.jeton ? { authorization: `Bearer ${JETON}` } : {}),
    },
  });
const connecter = async (identifiant: string, mdp = MDP) =>
  cookieDe(
    (await requete('POST', '/connexion', { payload: { identifiant, motDePasse: mdp } })).headers[
      'set-cookie'
    ],
  );

beforeAll(async () => {
  base = await demarrerBase();
  auth = creerAuth(createDb(base.pool));
  await auth.creerUtilisateur({ identifiant: 'chef', nom: 'Chef', motDePasse: MDP, role: 'admin' });
  await auth.creerUtilisateur({
    identifiant: 'vendeuse',
    nom: 'Vendeuse',
    motDePasse: MDP,
    role: 'commercial',
  });
  await auth.creerUtilisateur({
    identifiant: 'lecteur',
    nom: 'Lecteur',
    motDePasse: MDP,
    role: 'lecture',
  });
  cookies.admin = await connecter('chef');
  cookies.commercial = await connecter('vendeuse');
  cookies.lecture = await connecter('lecteur');
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

describe('droits par rôle', () => {
  it('la lecture consulte tout et ne modifie rien', async () => {
    const c = cookies.lecture;
    expect((await requete('GET', '/affaires', { cookie: c })).statusCode).toBe(200);
    expect((await requete('GET', '/indicateurs', { cookie: c })).statusCode).toBe(200);
    expect((await requete('GET', '/moi', { cookie: c })).json()).toMatchObject({
      utilisateur: { role: 'lecture' },
    });
    for (const [m, u, p] of [
      ['POST', '/entreprises', { nom: 'X' }],
      ['POST', '/affaires', { titre: 'X', etape: 'detection' }],
      ['POST', '/taches', { titre: 'X' }],
    ] as const) {
      const r = await requete(m, u, { cookie: c, payload: p });
      expect(r.statusCode).toBe(403);
      expect(r.json()).toEqual({ erreur: 'Droits insuffisants pour cette action' });
    }
    expect((await requete('GET', '/utilisateurs', { cookie: c })).statusCode).toBe(403);
  });

  it('le commercial crée et modifie, mais ne supprime pas ni ne règle le pipe', async () => {
    const c = cookies.commercial;
    const e = await requete('POST', '/entreprises', {
      cookie: c,
      payload: { nom: 'Société commerciale' },
    });
    expect(e.statusCode).toBe(201);
    const { id } = e.json<{ id: string }>();
    expect(
      (
        await requete('PATCH', `/entreprises/${id}`, {
          cookie: c,
          payload: { ville: 'Ville-Test' },
        })
      ).statusCode,
    ).toBe(200);
    expect((await requete('DELETE', `/entreprises/${id}`, { cookie: c })).statusCode).toBe(403);
    expect(
      (await requete('POST', '/etapes', { cookie: c, payload: { label: 'Autre' } })).statusCode,
    ).toBe(403);
    expect(
      (await requete('PATCH', '/indicateurs/delai-devis', { cookie: c, payload: { objectif: 3 } }))
        .statusCode,
    ).toBe(403);
    expect((await requete('POST', '/odoo/synchro', { cookie: c, payload: {} })).statusCode).toBe(
      403,
    );
    expect((await requete('GET', '/utilisateurs', { cookie: c })).statusCode).toBe(403);
    expect(
      (await requete('DELETE', `/entreprises/${id}`, { cookie: cookies.admin })).statusCode,
    ).toBe(204);
  });

  it('l’administrateur fait tout', async () => {
    const c = cookies.admin;
    expect(
      (await requete('POST', '/etapes', { cookie: c, payload: { label: 'Étape admin' } }))
        .statusCode,
    ).toBe(201);
    expect((await requete('DELETE', '/etapes/etape-admin', { cookie: c })).statusCode).toBe(200);
    expect(
      (await requete('PATCH', '/indicateurs/delai-devis', { cookie: c, payload: { objectif: 12 } }))
        .statusCode,
    ).toBe(200);
    expect((await requete('GET', '/utilisateurs', { cookie: c })).statusCode).toBe(200);
  });

  it('le jeton des intégrations lit et écrit les données, mais ne gère pas les comptes', async () => {
    expect((await requete('GET', '/affaires', { jeton: true })).statusCode).toBe(200);
    expect(
      (await requete('POST', '/entreprises', { jeton: true, payload: { nom: 'Via jeton' } }))
        .statusCode,
    ).toBe(201);
    expect((await requete('GET', '/utilisateurs', { jeton: true })).statusCode).toBe(403);
    expect((await requete('POST', '/utilisateurs', { jeton: true, payload: {} })).statusCode).toBe(
      403,
    );
  });

  it('chacun peut se déconnecter, même en lecture seule', async () => {
    const c = await connecter('lecteur');
    expect((await requete('POST', '/deconnexion', { cookie: c })).statusCode).toBe(204);
  });
});

describe('gestion des comptes', () => {
  it('l’administrateur crée un compte avec son rôle, qui se connecte avec ses droits', async () => {
    const r = await requete('POST', '/utilisateurs', {
      cookie: cookies.admin,
      payload: { identifiant: 'Nouvelle', nom: 'Nouvelle', motDePasse: MDP, role: 'lecture' },
    });
    expect(r.statusCode).toBe(201);
    expect(r.json()).toMatchObject({ identifiant: 'nouvelle', role: 'lecture' });
    const c = await connecter('nouvelle');
    expect(
      (await requete('POST', '/entreprises', { cookie: c, payload: { nom: 'X' } })).statusCode,
    ).toBe(403);
    const defaut = await requete('POST', '/utilisateurs', {
      cookie: cookies.admin,
      payload: { identifiant: 'par-defaut', nom: 'Par défaut', motDePasse: MDP },
    });
    expect(defaut.json()).toMatchObject({ role: 'commercial' });
  });

  it('refuse un rôle inconnu, un identifiant pris et un mot de passe trop court', async () => {
    const corps = { identifiant: 'x1', nom: 'X', motDePasse: MDP };
    expect(
      (
        await requete('POST', '/utilisateurs', {
          cookie: cookies.admin,
          payload: { ...corps, role: 'root' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await requete('POST', '/utilisateurs', {
          cookie: cookies.admin,
          payload: { ...corps, identifiant: 'chef' },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await requete('POST', '/utilisateurs', {
          cookie: cookies.admin,
          payload: { ...corps, motDePasse: 'court' },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('liste les comptes sans jamais montrer les mots de passe', async () => {
    const r = await requete('GET', '/utilisateurs', { cookie: cookies.admin });
    const liste = r.json<Record<string, unknown>[]>();
    expect(liste.map((u) => u.identifiant)).toEqual(
      expect.arrayContaining(['chef', 'vendeuse', 'lecteur']),
    );
    expect(JSON.stringify(liste)).not.toMatch(/scrypt|motDePasse|mot_de_passe/);
  });

  it('changer le rôle prend effet tout de suite : la session est rouverte avec les bons droits', async () => {
    const liste = (await requete('GET', '/utilisateurs', { cookie: cookies.admin })).json<
      { id: string; identifiant: string }[]
    >();
    const vendeuse = liste.find((u) => u.identifiant === 'vendeuse')!;
    const avant = await connecter('vendeuse');
    const r = await requete('PATCH', `/utilisateurs/${vendeuse.id}`, {
      cookie: cookies.admin,
      payload: { role: 'lecture' },
    });
    expect(r.json()).toMatchObject({ role: 'lecture' });
    expect((await requete('GET', '/affaires', { cookie: avant })).statusCode).toBe(401);
    const apres = await connecter('vendeuse');
    expect(
      (await requete('POST', '/entreprises', { cookie: apres, payload: { nom: 'X' } })).statusCode,
    ).toBe(403);
    await requete('PATCH', `/utilisateurs/${vendeuse.id}`, {
      cookie: cookies.admin,
      payload: { role: 'commercial' },
    });
  });

  it('garde toujours un administrateur actif, et on ne se désactive pas soi-même', async () => {
    const liste = (await requete('GET', '/utilisateurs', { cookie: cookies.admin })).json<
      { id: string; identifiant: string }[]
    >();
    const chef = liste.find((u) => u.identifiant === 'chef')!;
    const seul = await requete('PATCH', `/utilisateurs/${chef.id}`, {
      cookie: cookies.admin,
      payload: { role: 'commercial' },
    });
    expect(seul.statusCode).toBe(409);
    expect(seul.json()).toEqual({ erreur: 'Il doit rester au moins un administrateur actif' });
    expect(
      (
        await requete('PATCH', `/utilisateurs/${chef.id}`, {
          cookie: cookies.admin,
          payload: { actif: false },
        })
      ).statusCode,
    ).toBe(409);

    // avec un second administrateur, on peut rétrograder le premier
    const second = (
      await requete('POST', '/utilisateurs', {
        cookie: cookies.admin,
        payload: { identifiant: 'second-admin', nom: 'Second', motDePasse: MDP, role: 'admin' },
      })
    ).json<{ id: string }>();
    expect(
      (
        await requete('PATCH', `/utilisateurs/${chef.id}`, {
          cookie: cookies.admin,
          payload: { actif: false },
        })
      ).statusCode,
    ).toBe(409); // soi-même
    const c2 = await connecter('second-admin');
    expect(
      (
        await requete('PATCH', `/utilisateurs/${chef.id}`, {
          cookie: c2,
          payload: { role: 'commercial' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await requete('PATCH', `/utilisateurs/${second.id}`, {
          cookie: c2,
          payload: { actif: false },
        })
      ).statusCode,
    ).toBe(409);
    // remise en état pour la suite
    await auth.modifierCompte(chef.id, { role: 'admin' });
    cookies.admin = await connecter('chef');
    await auth.modifierCompte(second.id, { actif: false });
  });

  it('désactiver un compte coupe ses sessions et refuse sa connexion', async () => {
    const id = (
      await requete('POST', '/utilisateurs', {
        cookie: cookies.admin,
        payload: { identifiant: 'partie', nom: 'Partie', motDePasse: MDP },
      })
    ).json<{ id: string }>().id;
    const c = await connecter('partie');
    expect((await requete('GET', '/moi', { cookie: c })).statusCode).toBe(200);
    await requete('PATCH', `/utilisateurs/${id}`, {
      cookie: cookies.admin,
      payload: { actif: false },
    });
    expect((await requete('GET', '/moi', { cookie: c })).statusCode).toBe(401);
    expect(
      (await requete('POST', '/connexion', { payload: { identifiant: 'partie', motDePasse: MDP } }))
        .statusCode,
    ).toBe(401);
  });

  it('une réinitialisation par l’administrateur coupe les sessions du compte', async () => {
    const id = (
      await requete('POST', '/utilisateurs', {
        cookie: cookies.admin,
        payload: { identifiant: 'oubli', nom: 'Oubli', motDePasse: MDP },
      })
    ).json<{ id: string }>().id;
    const c = await connecter('oubli');
    const r = await requete('POST', `/utilisateurs/${id}/mot-de-passe`, {
      cookie: cookies.admin,
      payload: { motDePasse: 'un-tout-nouveau-mot-de-passe' },
    });
    expect(r.statusCode).toBe(204);
    expect((await requete('GET', '/moi', { cookie: c })).statusCode).toBe(401);
    expect(
      (
        await requete('POST', '/connexion', {
          payload: { identifiant: 'oubli', motDePasse: 'un-tout-nouveau-mot-de-passe' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await requete('POST', `/utilisateurs/${id}/mot-de-passe`, {
          cookie: cookies.admin,
          payload: { motDePasse: 'court' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await requete('POST', '/utilisateurs/00000000-0000-4000-8000-000000000000/mot-de-passe', {
          cookie: cookies.admin,
          payload: { motDePasse: MDP },
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('changer son propre mot de passe', () => {
  it('demande l’actuel, garde la session en cours et ferme les autres', async () => {
    await auth.creerUtilisateur({
      identifiant: 'moi-meme',
      nom: 'Moi',
      motDePasse: MDP,
      role: 'lecture',
    });
    const ici = await connecter('moi-meme');
    const ailleurs = await connecter('moi-meme');
    const faux = await requete('POST', '/moi/mot-de-passe', {
      cookie: ici,
      payload: { actuel: 'pas-le-bon-mot-de-passe', nouveau: 'nouveau-mot-de-passe-solide' },
    });
    expect(faux.statusCode).toBe(401);
    expect(
      (
        await requete('POST', '/moi/mot-de-passe', {
          cookie: ici,
          payload: { actuel: MDP, nouveau: 'court' },
        })
      ).statusCode,
    ).toBe(400);

    const ok = await requete('POST', '/moi/mot-de-passe', {
      cookie: ici,
      payload: { actuel: MDP, nouveau: 'nouveau-mot-de-passe-solide' },
    });
    expect(ok.statusCode).toBe(204);
    expect((await requete('GET', '/moi', { cookie: ici })).statusCode).toBe(200);
    expect((await requete('GET', '/moi', { cookie: ailleurs })).statusCode).toBe(401);
    expect(
      (
        await requete('POST', '/connexion', {
          payload: { identifiant: 'moi-meme', motDePasse: MDP },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await requete('POST', '/connexion', {
          payload: { identifiant: 'moi-meme', motDePasse: 'nouveau-mot-de-passe-solide' },
        })
      ).statusCode,
    ).toBe(200);
  });
});
