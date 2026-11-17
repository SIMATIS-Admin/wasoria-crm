import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/index.js';
import { creerAuth } from '../auth/service.js';
import { demarrerBase, JETON } from '../test/base.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
let cookieAv = '';
const MDP = 'un-mot-de-passe-solide';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const appel = (method: Method, url: string, payload?: object, cookie?: string) =>
  base.app.inject({
    method,
    url: `/api${url}`,
    payload,
    headers: cookie ? { cookie } : { authorization: `Bearer ${JETON}` },
  });
type Affaire = {
  id: string;
  pipelineId: string;
  etape: string;
  entrepriseId: string | null;
  origineAffaireId: string | null;
  titre: string;
};
const creer = async (url: string, payload: object) =>
  (await appel('POST', url, payload)).json<Affaire>();
const ids = async (pipeline: string) =>
  (await appel('GET', `/etapes?pipeline=${pipeline}`)).json<{ id: string }[]>().map((e) => e.id);

beforeAll(async () => {
  base = await demarrerBase();
  await creerAuth(createDb(base.pool)).creerUtilisateur({
    identifiant: 'cr',
    nom: 'CR',
    motDePasse: MDP,
    role: 'apres-vente',
  });
  const r = await base.app.inject({
    method: 'POST',
    url: '/api/connexion',
    payload: { identifiant: 'cr', motDePasse: MDP },
  });
  cookieAv = String(r.headers['set-cookie']).split(';')[0]!;
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

describe('pipes et étapes', () => {
  it('deux pipes, le pipe de vente par défaut', async () => {
    const p = (await appel('GET', '/pipelines')).json<{ id: string; label: string }[]>();
    expect(p.map((x) => x.id)).toEqual(['vente', 'apres-vente']);
    expect(await ids('vente')).toEqual([
      'detection',
      'prospection',
      'qualification',
      'proposition',
      'negociation',
    ]);
    expect(await ids('apres-vente')).toEqual([
      'installation',
      'mise-en-service',
      'suivi-mco',
      'renouvellement',
    ]);
    expect((await appel('GET', '/etapes')).json<unknown[]>()).toHaveLength(5);
    expect((await appel('GET', '/etapes?pipeline=tous')).json<unknown[]>()).toHaveLength(9);
    expect((await appel('GET', '/etapes?pipeline=inconnu')).statusCode).toBe(400);
  });

  it('un pipe se renomme, les administrateurs seuls', async () => {
    const r = await appel('PATCH', '/pipelines/apres-vente', { label: 'Suivi client' });
    expect(r.json()).toMatchObject({ id: 'apres-vente', label: 'Suivi client' });
    expect((await appel('PATCH', '/pipelines/inconnu', { label: 'X' })).statusCode).toBe(404);
    expect(
      (await appel('PATCH', '/pipelines/vente', { label: 'Vente' }, cookieAv)).statusCode,
    ).toBe(403);
  });

  it('ajoute, réordonne et supprime dans un pipe sans toucher l’autre', async () => {
    const nouvelle = (
      await appel('POST', '/etapes', { label: 'Garantie', pipeline: 'apres-vente' })
    ).json<{ id: string; ordre: number; pipelineId: string }>();
    expect(nouvelle).toMatchObject({ id: 'garantie', ordre: 5, pipelineId: 'apres-vente' });
    expect(await ids('vente')).toHaveLength(5);

    const inverse = [...(await ids('apres-vente'))].reverse();
    expect(
      (await appel('PUT', '/etapes/ordre', { pipeline: 'apres-vente', ids: inverse })).statusCode,
    ).toBe(200);
    expect(await ids('apres-vente')).toEqual(inverse);
    // les étapes de la vente ne se réordonnent pas dans l'après-vente
    expect(
      (await appel('PUT', '/etapes/ordre', { pipeline: 'apres-vente', ids: await ids('vente') }))
        .statusCode,
    ).toBe(400);

    expect((await appel('DELETE', '/etapes/garantie')).statusCode).toBe(200);
    expect(await ids('apres-vente')).toHaveLength(4);
  });

  it('une étape ne se vide que vers une étape du même pipe', async () => {
    const d = await creer('/affaires', {
      titre: 'Dossier',
      etape: 'installation',
      pipeline: 'apres-vente',
    });
    expect(d.pipelineId).toBe('apres-vente');
    const r = await appel('DELETE', '/etapes/installation?vers=detection');
    expect(r.statusCode).toBe(400);
    expect((await appel('DELETE', '/etapes/installation?vers=mise-en-service')).statusCode).toBe(
      200,
    );
    expect((await appel('GET', `/affaires/${d.id}`)).json<Affaire>().etape).toBe('mise-en-service');
  });
});

describe('affaires par pipe', () => {
  it('l’étape doit appartenir au pipe de l’affaire, et le pipe ne change plus', async () => {
    expect(
      (
        await appel('POST', '/affaires', {
          titre: 'X',
          etape: 'detection',
          pipeline: 'apres-vente',
        })
      ).statusCode,
    ).toBe(400);
    expect((await appel('POST', '/affaires', { titre: 'X', etape: 'suivi-mco' })).statusCode).toBe(
      400,
    );
    expect(
      (await appel('POST', '/affaires', { titre: 'X', etape: 'detection', pipeline: 'inconnu' }))
        .statusCode,
    ).toBe(400);
    const a = await creer('/affaires', { titre: 'Vente', etape: 'detection' });
    expect(a.pipelineId).toBe('vente');
    expect(
      (await appel('PATCH', `/affaires/${a.id}`, { pipeline: 'apres-vente' })).statusCode,
    ).toBe(400);
    expect((await appel('PATCH', `/affaires/${a.id}`, { etape: 'suivi-mco' })).statusCode).toBe(
      400,
    );
    expect((await appel('PATCH', `/affaires/${a.id}`, { etape: 'proposition' })).statusCode).toBe(
      200,
    );
  });

  it('la liste donne la vente par défaut, l’après-vente ou tout sur demande', async () => {
    const av = await creer('/affaires', {
      titre: 'Dossier liste',
      etape: 'suivi-mco',
      pipeline: 'apres-vente',
    });
    const titres = async (q: string) =>
      (await appel('GET', `/affaires${q}`)).json<Affaire[]>().map((x) => x.id);
    expect(await titres('')).not.toContain(av.id);
    expect(await titres('?pipeline=apres-vente')).toContain(av.id);
    expect(await titres('?pipeline=tous')).toContain(av.id);
  });
});

describe('dossier après-vente depuis une vente gagnée', () => {
  it('refuse une vente non gagnée, une affaire après-vente, et une fiche inconnue', async () => {
    const ouverte = await creer('/affaires', { titre: 'Ouverte', etape: 'detection' });
    expect((await appel('POST', `/affaires/${ouverte.id}/apres-vente`, {})).statusCode).toBe(409);
    const dossier = await creer('/affaires', {
      titre: 'Déjà après-vente',
      etape: 'mise-en-service',
      pipeline: 'apres-vente',
    });
    expect((await appel('POST', `/affaires/${dossier.id}/apres-vente`, {})).statusCode).toBe(409);
    expect(
      (await appel('POST', '/affaires/00000000-0000-4000-8000-000000000000/apres-vente', {}))
        .statusCode,
    ).toBe(404);
  });

  it('ouvre un dossier avec le compte et les contacts de la vente, une seule fois', async () => {
    const e = (await appel('POST', '/entreprises', { nom: 'Client gagné' })).json<{ id: string }>();
    const c = (await appel('POST', '/contacts', { nom: 'Alex Contact' })).json<{ id: string }>();
    const vente = await creer('/affaires', {
      titre: 'Contrat gagné',
      etape: 'negociation',
      entrepriseId: e.id,
      contactId: c.id,
    });
    await appel('PUT', `/affaires/${vente.id}/liens`, { contacts: [c.id], entreprises: [e.id] });
    await appel('PATCH', `/affaires/${vente.id}`, { clos: 'gagne' });

    const r = await appel('POST', `/affaires/${vente.id}/apres-vente`, { montant: 3000 });
    expect(r.statusCode).toBe(201);
    const dossier = r.json<Affaire & { montant: number }>();
    expect(dossier).toMatchObject({
      titre: 'Contrat gagné · après-vente',
      pipelineId: 'apres-vente',
      etape: (await ids('apres-vente'))[0],
      entrepriseId: e.id,
      origineAffaireId: vente.id,
      montant: 3000,
    });
    const { rows } = await base.pool.query<{ n: string }>(
      'select count(*) n from affaire_contacts where opportunite_id = $1',
      [dossier.id],
    );
    expect(Number(rows[0]!.n)).toBe(1);

    const encore = await appel('POST', `/affaires/${vente.id}/apres-vente`, {});
    expect(encore.statusCode).toBe(409);
    expect(encore.json()).toMatchObject({ id: dossier.id });
  });
});

describe('ce que voit l’OS et les indicateurs', () => {
  it('l’échange ne montre que la vente, étapes comprises', async () => {
    const av = await creer('/affaires', {
      titre: 'Invisible pour l’OS',
      etape: 'suivi-mco',
      pipeline: 'apres-vente',
    });
    const fiches = (await appel('GET', '/echange/affaire')).json<{ id: string }[]>();
    expect(fiches.map((f) => f.id)).not.toContain(av.id);
    const { etapes } = (await appel('GET', '/echange/etapes')).json<{ etapes: { id: string }[] }>();
    expect(etapes.map((e) => e.id)).toEqual(await ids('vente'));
  });

  it('les opportunités entrantes ne comptent que les ventes', async () => {
    const lire = async () =>
      (await appel('GET', '/indicateurs'))
        .json<{ indicateurs: { id: string; n: number }[] }>()
        .indicateurs.find((i) => i.id === 'entrants')!.n;
    const avant = await lire();
    await creer('/affaires', {
      titre: 'Dossier sans effet',
      etape: 'suivi-mco',
      pipeline: 'apres-vente',
    });
    expect(await lire()).toBe(avant);
    await creer('/affaires', { titre: 'Une vente de plus', etape: 'detection' });
    expect(await lire()).toBe(avant + 1);
  });
});

describe('rôle après-vente', () => {
  it('travaille sur l’après-vente, lit la vente, ne la modifie pas', async () => {
    const vente = await creer('/affaires', { titre: 'Vente du commercial', etape: 'detection' });
    const dossier = await appel(
      'POST',
      '/affaires',
      { titre: 'Dossier du CR', etape: 'mise-en-service', pipeline: 'apres-vente' },
      cookieAv,
    );
    expect(dossier.statusCode).toBe(201);
    const idDossier = dossier.json<{ id: string }>().id;

    expect(
      (await appel('PATCH', `/affaires/${idDossier}`, { etape: 'suivi-mco' }, cookieAv)).statusCode,
    ).toBe(200);
    expect((await appel('GET', `/affaires/${vente.id}`, undefined, cookieAv)).statusCode).toBe(200);
    expect(
      (await appel('POST', '/affaires', { titre: 'Vente interdite', etape: 'detection' }, cookieAv))
        .statusCode,
    ).toBe(403);
    expect(
      (await appel('PATCH', `/affaires/${vente.id}`, { titre: 'Modifiée' }, cookieAv)).statusCode,
    ).toBe(403);
    expect(
      (await appel('PUT', `/affaires/${vente.id}/liens`, { contacts: [] }, cookieAv)).statusCode,
    ).toBe(403);
    expect(
      (await appel('PUT', `/affaires/${idDossier}/liens`, { contacts: [] }, cookieAv)).statusCode,
    ).toBe(200);
  });

  it('crée des fiches et des tâches comme un commercial, sans supprimer ni régler', async () => {
    expect(
      (await appel('POST', '/entreprises', { nom: 'Compte du CR' }, cookieAv)).statusCode,
    ).toBe(201);
    expect(
      (await appel('POST', '/taches', { titre: 'Visite de suivi' }, cookieAv)).statusCode,
    ).toBe(201);
    expect(
      (await appel('POST', '/etapes', { label: 'X', pipeline: 'apres-vente' }, cookieAv))
        .statusCode,
    ).toBe(403);
    expect((await appel('GET', '/utilisateurs', undefined, cookieAv)).statusCode).toBe(403);
  });

  it('peut ouvrir un dossier après-vente depuis une vente gagnée', async () => {
    const vente = await creer('/affaires', { titre: 'Gagnée pour le CR', etape: 'negociation' });
    await appel('PATCH', `/affaires/${vente.id}`, { clos: 'gagne' });
    expect(
      (await appel('POST', `/affaires/${vente.id}/apres-vente`, {}, cookieAv)).statusCode,
    ).toBe(201);
  });
});
