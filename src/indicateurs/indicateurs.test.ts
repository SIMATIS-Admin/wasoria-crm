import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demarrerBase, JETON } from '../test/base.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
beforeAll(async () => {
  base = await demarrerBase();
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

const appel = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
  base.app.inject({
    method,
    url: `/api${url}`,
    payload,
    headers: { authorization: `Bearer ${JETON}` },
  });

type Indicateur = {
  id: string;
  type: string;
  unite: string;
  valeur: number | null;
  n: number;
  objectif: number | null;
  statut: string;
  deEtape: string | null;
  versEtape: string | null;
  serie?: unknown[];
};
const indicateurs = async (jours = 90) =>
  (await appel('GET', `/indicateurs?jours=${jours}`)).json<{ indicateurs: Indicateur[] }>()
    .indicateurs;
const un = async (id: string) => (await indicateurs()).find((i) => i.id === id)!;

const joursAvant = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
async function affaireDatee(
  titre: string,
  dates: Record<string, string>,
  creeIlYa = 20,
  clos?: string,
) {
  await base.pool.query(
    'insert into opportunites (titre, etape, etapes_dates, created_at, clos) values ($1, $2, $3, $4, $5)',
    [titre, Object.keys(dates).at(-1) ?? 'detection', dates, joursAvant(creeIlYa), clos ?? null],
  );
}

describe('indicateurs', () => {
  it('les cinq indicateurs de départ existent, sans donnée', async () => {
    const liste = await indicateurs();
    expect(liste.map((i) => i.id)).toEqual([
      'delai-devis',
      'delai-reponse',
      'contact-visite',
      'devis-commande',
      'entrants',
    ]);
    expect(liste.map((i) => i.unite)).toEqual(['jours', 'jours', '%', '%', 'par semaine']);
    expect((await un('delai-devis')).statut).toBe('sans-donnee');
    expect((await un('devis-commande')).statut).toBe('sans-donnee');
  });

  it('calcule délais, conversions et entrants sur les affaires', async () => {
    await affaireDatee('A', { qualification: joursAvant(30), proposition: joursAvant(24) }); // 6 j
    await affaireDatee('B', { qualification: joursAvant(20), proposition: joursAvant(8) }); // 12 j
    await affaireDatee('C', { prospection: joursAvant(40), qualification: joursAvant(35) });
    await affaireDatee('D', { prospection: joursAvant(25) });

    const devis = await un('delai-devis');
    expect(devis).toMatchObject({ valeur: 9, n: 2, objectif: 10, statut: 'ok' });

    const cv = await un('contact-visite');
    expect(cv).toMatchObject({ valeur: 50, objectif: 50, statut: 'ok' });

    const ent = await un('entrants');
    expect(ent.n).toBe(4);
    expect(ent.serie).toHaveLength(13);
    expect(ent.statut).toBe('sans-objectif');
  });

  it('la période se règle, et refuse une valeur absurde', async () => {
    expect((await indicateurs(7)).find((i) => i.id === 'entrants')!.serie).toHaveLength(1);
    expect((await appel('GET', '/indicateurs?jours=2')).statusCode).toBe(400);
    expect((await appel('GET', '/indicateurs?jours=9999')).statusCode).toBe(400);
  });

  it('une affaire clôturée est datée, et rouverte elle perd sa date', async () => {
    const a = (await appel('POST', '/affaires', { titre: 'Clôture', etape: 'proposition' })).json<{
      id: string;
      closLe: string | null;
    }>();
    expect(a.closLe).toBeNull();
    const gagnee = (await appel('PATCH', `/affaires/${a.id}`, { clos: 'gagne' })).json<{
      closLe: string | null;
    }>();
    expect(gagnee.closLe).toBeTruthy();
    const encore = (
      await appel('PATCH', `/affaires/${a.id}`, { clos: 'gagne', montant: 10 })
    ).json<{ closLe: string | null }>();
    expect(encore.closLe).toBe(gagnee.closLe);
    const rouverte = (await appel('PATCH', `/affaires/${a.id}`, { clos: null })).json<{
      closLe: string | null;
    }>();
    expect(rouverte.closLe).toBeNull();
    // l'affaire est entrée en proposition à sa création : elle entre dans la conversion devis → commande
    await appel('PATCH', `/affaires/${a.id}`, { clos: 'gagne' });
    expect((await un('devis-commande')).valeur).toBeGreaterThan(0);
  });

  it('règle l’objectif, le libellé et les étapes ; refuse une étape inconnue', async () => {
    const r = await appel('PATCH', '/indicateurs/delai-reponse', {
      objectif: 3,
      label: 'Réponse sous',
      deEtape: 'detection',
      versEtape: 'qualification',
    });
    expect(r.json()).toMatchObject({
      objectif: 3,
      label: 'Réponse sous',
      versEtape: 'qualification',
    });
    expect(
      (await appel('PATCH', '/indicateurs/delai-reponse', { versEtape: '@gagne' })).statusCode,
    ).toBe(200);
    expect(
      (await appel('PATCH', '/indicateurs/delai-reponse', { deEtape: '@gagne' })).statusCode,
    ).toBe(400);
    expect(
      (await appel('PATCH', '/indicateurs/delai-reponse', { versEtape: 'inventee' })).statusCode,
    ).toBe(400);
    expect(
      (await appel('PATCH', '/indicateurs/entrants', { deEtape: 'detection' })).statusCode,
    ).toBe(400);
    expect((await appel('PATCH', '/indicateurs/entrants', { objectif: 0 })).statusCode).toBe(200);
    expect((await appel('PATCH', '/indicateurs/delai-reponse', {})).statusCode).toBe(400);
    expect((await appel('PATCH', '/indicateurs/inconnu', { objectif: 1 })).statusCode).toBe(404);
    expect((await un('entrants')).statut).toBe('ok');
    await appel('PATCH', '/indicateurs/entrants', { objectif: 50 });
    expect((await un('entrants')).statut).toBe('hors-objectif');
  });

  it('supprimer une étape rend à reconfigurer les indicateurs qui s’y appuyaient', async () => {
    await appel('POST', '/etapes', { label: 'Visite' });
    await appel('PATCH', '/indicateurs/contact-visite', { versEtape: 'visite' });
    expect((await un('contact-visite')).versEtape).toBe('visite');
    expect((await appel('DELETE', '/etapes/visite')).statusCode).toBe(200);
    expect(await un('contact-visite')).toMatchObject({
      versEtape: null,
      statut: 'a-configurer',
      valeur: null,
    });
  });
});
