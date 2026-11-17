import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { creerAuth } from '../auth/service.js';
import { createDb } from '../db/index.js';
import { demarrerBase, JETON } from '../test/base.js';
import { ETAPES_DEFAUT, INDICATEURS_DEFAUT } from './defauts.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let inactif: Awaited<ReturnType<typeof demarrerBase>>;
const MDP = 'un-mot-de-passe-solide';
const cookies: Record<string, string> = {};
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const appel = (b: typeof base, method: Method, url: string, payload?: object, role?: string) =>
  b.app.inject({
    method,
    url: `/api${url}`,
    payload,
    headers: role ? { cookie: cookies[role]! } : { authorization: `Bearer ${JETON}` },
  });
const compte = async (table: string) =>
  Number((await base.pool.query<{ n: string }>(`select count(*) n from ${table}`)).rows[0]!.n);

beforeAll(async () => {
  base = await demarrerBase({ demo: true });
  inactif = await demarrerBase();
  const auth = creerAuth(createDb(base.pool));
  for (const [identifiant, role] of [
    ['adm', 'admin'],
    ['com', 'commercial'],
    ['lec', 'lecture'],
  ] as const) {
    await auth.creerUtilisateur({ identifiant, nom: identifiant, motDePasse: MDP, role });
    const r = await base.app.inject({
      method: 'POST',
      url: '/api/connexion',
      payload: { identifiant, motDePasse: MDP },
    });
    cookies[role] = String(r.headers['set-cookie']).split(';')[0]!;
  }
}, 180_000);
afterAll(async () => {
  await base.arreter();
  await inactif.arreter();
});

describe('états de départ', () => {
  it('correspondent exactement à ce que créent les migrations', async () => {
    const { rows: e } = await base.pool.query(
      'select id, pipeline_id as "pipelineId", label, ordre, probabilite from etapes order by pipeline_id desc, ordre',
    );
    expect(e).toEqual(
      [...ETAPES_DEFAUT].sort((a, b) =>
        a.pipelineId < b.pipelineId ? 1 : a.pipelineId > b.pipelineId ? -1 : a.ordre - b.ordre,
      ),
    );
    const { rows: i } = await base.pool.query(
      'select id, label, type, de_etape as "deEtape", vers_etape as "versEtape", objectif, ordre from indicateurs order by ordre',
    );
    expect(i).toEqual(INDICATEURS_DEFAUT);
  });
});

describe('bouton Démo', () => {
  it('reste inactif et refuse de charger tant que le mode démonstration n’est pas activé', async () => {
    expect((await appel(inactif, 'GET', '/demo')).json()).toEqual({ actif: false });
    const r = await appel(inactif, 'POST', '/demo/charger');
    expect(r.statusCode).toBe(404);
    await appel(inactif, 'POST', '/entreprises', { nom: 'Donnée à ne pas effacer' });
    await appel(inactif, 'POST', '/demo/charger');
    const { rows } = await inactif.pool.query('select 1 from entreprises');
    expect(rows).toHaveLength(1);
  });

  it('s’annonce actif en mode démonstration, pour tout compte connecté', async () => {
    expect((await appel(base, 'GET', '/demo', undefined, 'lecture')).json()).toEqual({
      actif: true,
    });
  });

  it('seuls les administrateurs peuvent charger le scénario', async () => {
    expect((await appel(base, 'POST', '/demo/charger', {}, 'commercial')).statusCode).toBe(403);
    expect((await appel(base, 'POST', '/demo/charger', {}, 'lecture')).statusCode).toBe(403);
    expect(await compte('entreprises')).toBe(0);
  });

  it('charge le scénario : données fictives, devis, catalogue, parcours daté', async () => {
    const r = await appel(base, 'POST', '/demo/charger', {}, 'admin');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ charge: true, affaires: 11, devis: 3 });
    expect(await compte('entreprises')).toBe(6);
    expect(await compte('articles')).toBe(6);
    expect(await compte('devis_lignes')).toBeGreaterThan(0);
  });

  it('efface ce qui a été fait depuis, remet les étapes et les indicateurs, garde les comptes', async () => {
    // on abîme tout : une fiche perso, une étape renommée et une supprimée, un objectif changé, un devis
    await appel(base, 'POST', '/entreprises', { nom: 'Fiche de test' });
    await appel(base, 'PATCH', '/etapes/detection', { label: 'Renommée' });
    await appel(base, 'POST', '/etapes', { label: 'Étape en trop' });
    await appel(base, 'PATCH', '/indicateurs/delai-devis', { objectif: 99 });
    await appel(
      base,
      'PATCH',
      '/articles/' + (await appel(base, 'GET', '/articles')).json<{ id: string }[]>()[0]!.id,
      { prix: 1 },
    );
    const comptes = await compte('utilisateurs');

    expect((await appel(base, 'POST', '/demo/charger', {}, 'admin')).statusCode).toBe(200);

    expect(await compte('entreprises')).toBe(6);
    const { rows: e } = await base.pool.query<{ id: string; label: string }>(
      "select id, label from etapes where pipeline_id = 'vente' order by ordre",
    );
    expect(e.map((x) => x.id)).toEqual([
      'detection',
      'prospection',
      'qualification',
      'proposition',
      'negociation',
    ]);
    expect(e[0]!.label).toBe('Détection');
    const { rows: o } = await base.pool.query<{ objectif: number }>(
      "select objectif from indicateurs where id = 'delai-devis'",
    );
    expect(o[0]!.objectif).toBe(10);
    const { rows: p } = await base.pool.query<{ prix: number }>(
      'select min(prix) prix from articles',
    );
    expect(p[0]!.prix).toBeGreaterThan(1);
    expect(await compte('utilisateurs')).toBe(comptes);
    // l'administrateur reste connecté
    expect((await appel(base, 'GET', '/moi', undefined, 'admin')).statusCode).toBe(200);
  });

  it('peut se recharger autant de fois qu’on veut, avec le même résultat', async () => {
    for (let i = 0; i < 2; i++) await appel(base, 'POST', '/demo/charger', {}, 'admin');
    expect(await compte('opportunites')).toBe(11);
    expect(await compte('devis')).toBe(3);
    expect(await compte('articles')).toBe(6);
  });
});
