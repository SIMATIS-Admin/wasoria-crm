import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demarrerBase, JETON } from '../test/base.js';
import { identifiantDe } from './etapes.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
beforeAll(async () => {
  base = await demarrerBase();
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

const appel = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: object,
) =>
  base.app.inject({
    method,
    url: `/api${url}`,
    payload,
    headers: { authorization: `Bearer ${JETON}` },
  });

type Etape = { id: string; label: string; ordre: number; probabilite: number };
const etapes = async () => (await appel('GET', '/etapes')).json<Etape[]>();
const ids = async () => (await etapes()).map((e) => e.id);

describe('identifiant d’étape', () => {
  it('se déduit du libellé, sans accent ni signe', () => {
    expect(identifiantDe('Démo & Présentation !')).toBe('demo-presentation');
    expect(identifiantDe('???')).toBe('etape');
  });
});

describe('étapes du pipeline', () => {
  it('démarrent avec les cinq étapes par défaut, dans l’ordre', async () => {
    expect(await ids()).toEqual([
      'detection',
      'prospection',
      'qualification',
      'proposition',
      'negociation',
    ]);
    expect((await etapes()).map((e) => e.ordre)).toEqual([1, 2, 3, 4, 5]);
  });

  it('ajoute une étape à la fin, avec un identifiant unique', async () => {
    const a = await appel('POST', '/etapes', { label: 'Signature', probabilite: 90 });
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({ id: 'signature', ordre: 6, probabilite: 90 });
    const b = (await appel('POST', '/etapes', { label: 'Signature' })).json<Etape>();
    expect(b).toMatchObject({ id: 'signature-2', ordre: 7, probabilite: 50 });
    expect((await appel('POST', '/etapes', { label: '  ' })).statusCode).toBe(400);
    expect((await appel('POST', '/etapes', { label: 'X', probabilite: 150 })).statusCode).toBe(400);
  });

  it('renomme et règle la probabilité, sans changer l’identifiant', async () => {
    const r = await appel('PATCH', '/etapes/signature', {
      label: 'Signature du contrat',
      probabilite: 95,
    });
    expect(r.json()).toMatchObject({
      id: 'signature',
      label: 'Signature du contrat',
      probabilite: 95,
    });
    expect((await appel('PATCH', '/etapes/signature', {})).statusCode).toBe(400);
    expect((await appel('PATCH', '/etapes/inconnue', { label: 'X' })).statusCode).toBe(404);
    expect((await appel('PATCH', '/etapes/signature', { id: 'autre' })).statusCode).toBe(400);
  });

  it('réordonne, à condition de donner toutes les étapes une fois', async () => {
    const avant = await ids();
    const inverse = [...avant].reverse();
    expect((await appel('PUT', '/etapes/ordre', { ids: inverse })).statusCode).toBe(200);
    expect(await ids()).toEqual(inverse);
    expect((await appel('PUT', '/etapes/ordre', { ids: inverse.slice(1) })).statusCode).toBe(400);
    expect(
      (await appel('PUT', '/etapes/ordre', { ids: [...inverse.slice(1), inverse[1]!] })).statusCode,
    ).toBe(400);
    expect(
      (await appel('PUT', '/etapes/ordre', { ids: [...inverse.slice(1), 'fantome'] })).statusCode,
    ).toBe(400);
    await appel('PUT', '/etapes/ordre', { ids: avant });
    expect(await ids()).toEqual(avant);
  });

  it('une affaire ne peut être placée que dans une étape existante', async () => {
    expect((await appel('POST', '/affaires', { titre: 'A', etape: 'inventee' })).statusCode).toBe(
      400,
    );
    const a = (await appel('POST', '/affaires', { titre: 'A', etape: 'signature' })).json<{
      id: string;
    }>();
    expect((await appel('PATCH', `/affaires/${a.id}`, { etape: 'inventee' })).statusCode).toBe(400);
    expect((await appel('PATCH', `/affaires/${a.id}`, { titre: 'Autre titre' })).statusCode).toBe(
      200,
    );
  });

  it('refuse de supprimer une étape utilisée sans dire où placer ses affaires', async () => {
    const r = await appel('DELETE', '/etapes/signature');
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ affaires: 1 });
    expect(await ids()).toContain('signature');
  });

  it('déplace les affaires, date leur arrivée, et renumérote', async () => {
    const gagnee = (
      await appel('POST', '/affaires', { titre: 'Gagnée', etape: 'signature', clos: 'gagne' })
    ).json<{ id: string }>();
    expect((await appel('DELETE', '/etapes/signature?vers=signature')).statusCode).toBe(400);
    expect((await appel('DELETE', '/etapes/signature?vers=fantome')).statusCode).toBe(400);
    const r = await appel('DELETE', '/etapes/signature?vers=proposition');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ supprimee: 'signature', deplacees: 2 });
    const a = (await appel('GET', `/affaires/${gagnee.id}`)).json<{
      etape: string;
      clos: string;
      etapesDates: Record<string, string>;
    }>();
    expect(a).toMatchObject({ etape: 'proposition', clos: 'gagne' });
    expect(Object.keys(a.etapesDates).sort()).toEqual(['proposition', 'signature']);
    expect((await etapes()).map((e) => e.ordre)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('supprime une étape vide, et en garde toujours une', async () => {
    expect((await appel('DELETE', '/etapes/signature-2')).statusCode).toBe(200);
    expect((await appel('DELETE', '/etapes/inconnue')).statusCode).toBe(404);
    const restantes = await ids();
    for (const id of restantes.slice(0, -1)) {
      const sans = await appel('DELETE', `/etapes/${id}?vers=${restantes.at(-1)}`);
      expect(sans.statusCode).toBe(200);
    }
    const derniere = restantes.at(-1)!;
    expect((await appel('DELETE', `/etapes/${derniere}?vers=${derniere}`)).statusCode).toBe(409);
    expect(await ids()).toEqual([derniere]);
  });

  it('l’échange avec l’OS reflète les étapes modifiées', async () => {
    const { etapes: pourOs } = (await appel('GET', '/echange/etapes')).json<{ etapes: Etape[] }>();
    expect(pourOs.map((e) => e.id)).toEqual(await ids());
  });
});
