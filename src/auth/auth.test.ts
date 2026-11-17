import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/index.js';
import { demarrerBase, JETON } from '../test/base.js';
import { hacher, verifier } from './mot-de-passe.js';
import { creerAuth } from './service.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
beforeAll(async () => {
  base = await demarrerBase();
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

const MDP = 'un-mot-de-passe-solide';
const cookieDe = (set: string | string[] | undefined) =>
  String(Array.isArray(set) ? set[0] : set)
    .split(';')[0]!
    .trim();

const post = (url: string, payload: object, entetes: Record<string, string> = {}) =>
  base.app.inject({ method: 'POST', url: `/api${url}`, payload, headers: entetes });
const get = (url: string, cookie?: string) =>
  base.app.inject({ method: 'GET', url: `/api${url}`, headers: cookie ? { cookie } : {} });

describe('mots de passe', () => {
  it('stockent une empreinte salée, vérifiable, jamais le mot de passe', async () => {
    const a = await hacher(MDP);
    const b = await hacher(MDP);
    expect(a).not.toContain(MDP);
    expect(a).not.toBe(b);
    expect(await verifier(MDP, a)).toBe(true);
    expect(await verifier('autre-mot-de-passe', a)).toBe(false);
    expect(await verifier(MDP, 'n-importe-quoi')).toBe(false);
  });
});

describe('installation du premier compte', () => {
  it('n’est possible qu’avec le jeton du serveur, une fois', async () => {
    expect((await get('/etat')).json()).toEqual({ installe: false });
    const corps = { identifiant: 'Marc', nom: 'Marc', motDePasse: MDP };

    expect((await post('/installation', { ...corps, jeton: 'faux' })).statusCode).toBe(401);
    expect(
      (await post('/installation', { ...corps, jeton: JETON, motDePasse: 'court' })).statusCode,
    ).toBe(400);
    expect(
      (await post('/installation', { ...corps, jeton: JETON, identifiant: 'a b' })).statusCode,
    ).toBe(400);

    const ok = await post('/installation', { ...corps, jeton: JETON });
    expect(ok.statusCode).toBe(201);
    const cookie = String(ok.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).not.toMatch(/Secure/);

    expect(
      (await post('/installation', { ...corps, jeton: JETON, identifiant: 'autre' })).statusCode,
    ).toBe(409);
    expect((await get('/etat')).json()).toEqual({ installe: true });

    const { rows } = await base.pool.query<{ identifiant: string; mot_de_passe: string }>(
      'select * from utilisateurs',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.identifiant).toBe('marc');
    expect(rows[0]!.mot_de_passe.startsWith('scrypt$')).toBe(true);
    expect(rows[0]!.mot_de_passe).not.toContain(MDP);
  });
});

describe('connexion et session', () => {
  it('refuse sans session, accepte le cookie, et le jeton des intégrations reste valable', async () => {
    expect((await get('/entreprises')).statusCode).toBe(401);
    expect((await get('/moi')).statusCode).toBe(401);
    const bearer = await base.app.inject({
      method: 'GET',
      url: '/api/entreprises',
      headers: { authorization: `Bearer ${JETON}` },
    });
    expect(bearer.statusCode).toBe(200);

    const r = await post('/connexion', { identifiant: ' MARC ', motDePasse: MDP });
    expect(r.statusCode).toBe(200);
    const cookie = cookieDe(r.headers['set-cookie']);
    expect((await get('/entreprises', cookie)).statusCode).toBe(200);
    expect((await get('/moi', cookie)).json()).toMatchObject({
      utilisateur: { identifiant: 'marc', nom: 'Marc' },
    });
  });

  it('ne stocke que l’empreinte du jeton de session', async () => {
    const r = await post('/connexion', { identifiant: 'marc', motDePasse: MDP });
    const jeton = cookieDe(r.headers['set-cookie']).split('=')[1]!;
    const { rows } = await base.pool.query<{ id: string }>('select id from sessions');
    expect(rows.map((x) => x.id)).not.toContain(jeton);
  });

  it('répond pareil pour un mauvais mot de passe et un identifiant inconnu', async () => {
    const a = await post('/connexion', { identifiant: 'marc', motDePasse: 'mauvais-mot-de-passe' });
    const b = await post('/connexion', {
      identifiant: 'inconnu',
      motDePasse: 'mauvais-mot-de-passe',
    });
    expect(a.statusCode).toBe(401);
    expect(b.statusCode).toBe(401);
    expect(a.json()).toEqual(b.json());
    expect(a.headers['set-cookie']).toBeUndefined();
  });

  it('se déconnecte : le cookie ne vaut plus rien', async () => {
    const cookie = cookieDe(
      (await post('/connexion', { identifiant: 'marc', motDePasse: MDP })).headers['set-cookie'],
    );
    const sortie = await base.app.inject({
      method: 'POST',
      url: '/api/deconnexion',
      headers: { cookie },
    });
    expect(sortie.statusCode).toBe(204);
    expect(String(sortie.headers['set-cookie'])).toMatch(/Max-Age=0/);
    expect((await get('/entreprises', cookie)).statusCode).toBe(401);
  });

  it('refuse une session échue', async () => {
    const cookie = cookieDe(
      (await post('/connexion', { identifiant: 'marc', motDePasse: MDP })).headers['set-cookie'],
    );
    await base.pool.query("update sessions set expire_le = now() - interval '1 minute'");
    expect((await get('/entreprises', cookie)).statusCode).toBe(401);
  });

  it('refuse une modification venue d’une autre origine', async () => {
    const cookie = cookieDe(
      (await post('/connexion', { identifiant: 'marc', motDePasse: MDP })).headers['set-cookie'],
    );
    const envoi = (origin: string) =>
      base.app.inject({
        method: 'POST',
        url: '/api/entreprises',
        payload: { nom: 'Origine' },
        headers: { cookie, origin, host: 'crm.exemple.test' },
      });
    expect((await envoi('https://pirate.test')).statusCode).toBe(403);
    expect((await envoi('https://crm.exemple.test')).statusCode).toBe(201);
  });

  it('ignore x-forwarded-proto tant que le proxy n’est pas déclaré de confiance', async () => {
    const r = await post(
      '/connexion',
      { identifiant: 'marc', motDePasse: MDP },
      { 'x-forwarded-proto': 'https' },
    );
    expect(String(r.headers['set-cookie'])).not.toMatch(/Secure/); // proxy non approuvé : en-tête ignoré
  });

  it('un compte désactivé ne se connecte plus et perd ses sessions', async () => {
    const auth = creerAuth(createDb(base.pool));
    await auth.creerUtilisateur({ identifiant: 'second', nom: 'Second', motDePasse: MDP });
    const cookie = cookieDe(
      (await post('/connexion', { identifiant: 'second', motDePasse: MDP })).headers['set-cookie'],
    );
    await auth.activer('second', false);
    expect((await get('/moi', cookie)).statusCode).toBe(401);
    expect((await post('/connexion', { identifiant: 'second', motDePasse: MDP })).statusCode).toBe(
      401,
    );
  });

  it('changer le mot de passe ferme les sessions ouvertes', async () => {
    const auth = creerAuth(createDb(base.pool));
    await auth.creerUtilisateur({ identifiant: 'troisieme', nom: 'Troisième', motDePasse: MDP });
    const cookie = cookieDe(
      (await post('/connexion', { identifiant: 'troisieme', motDePasse: MDP })).headers[
        'set-cookie'
      ],
    );
    await auth.changerMotDePasse('troisieme', 'un-autre-mot-de-passe');
    expect((await get('/moi', cookie)).statusCode).toBe(401);
    expect(
      (await post('/connexion', { identifiant: 'troisieme', motDePasse: 'un-autre-mot-de-passe' }))
        .statusCode,
    ).toBe(200);
  });

  it('bloque après cinq échecs, même avec le bon mot de passe', async () => {
    const auth = creerAuth(createDb(base.pool));
    await auth.creerUtilisateur({ identifiant: 'bloque', nom: 'Bloqué', motDePasse: MDP });
    for (let i = 0; i < 5; i++) {
      expect(
        (await post('/connexion', { identifiant: 'bloque', motDePasse: 'mauvais-mot-de-passe' }))
          .statusCode,
      ).toBe(401);
    }
    expect((await post('/connexion', { identifiant: 'bloque', motDePasse: MDP })).statusCode).toBe(
      429,
    );
    // un autre compte, depuis la même adresse, n'est pas touché
    expect((await post('/connexion', { identifiant: 'marc', motDePasse: MDP })).statusCode).toBe(
      200,
    );
  });
});
