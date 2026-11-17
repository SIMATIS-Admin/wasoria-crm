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
type Fiche = {
  id: string;
  source: string;
  sourceId: string | null;
  etapesDates: Record<string, string>;
  derniereActivite: string | null;
  faitAt: string | null;
  canal: string;
  compteRenduAt: string | null;
};
const creer = async (url: string, payload: object) =>
  (await appel('POST', url, payload)).json<Fiche>();

describe('accès', () => {
  it('refuse sans jeton ou avec un mauvais jeton ; /health reste ouvert', async () => {
    expect((await base.app.inject({ method: 'GET', url: '/api/entreprises' })).statusCode).toBe(
      401,
    );
    const mauvais = await base.app.inject({
      method: 'GET',
      url: '/api/entreprises',
      headers: { authorization: 'Bearer faux' },
    });
    expect(mauvais.statusCode).toBe(401);
    expect((await base.app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
  });
});

describe('entreprises et contacts', () => {
  it('crée, lit, modifie, filtre et supprime', async () => {
    const e = await creer('/entreprises', { nom: 'Société Exemple', ville: 'Ville-Test' });
    expect(e).toMatchObject({ nom: 'Société Exemple', source: 'natif', sourceId: null });

    const maj = await appel('PATCH', `/entreprises/${e.id}`, { ville: null, taille: 12 });
    expect(maj.json()).toMatchObject({ ville: null, taille: 12 });

    const liste = await appel('GET', '/entreprises?q=exemple');
    expect(liste.json<unknown[]>()).toHaveLength(1);

    expect((await appel('DELETE', `/entreprises/${e.id}`)).statusCode).toBe(204);
    expect((await appel('GET', `/entreprises/${e.id}`)).statusCode).toBe(404);
  });

  it('refuse un champ inconnu, dont source : une fiche créée ici est native', async () => {
    const r = await appel('POST', '/entreprises', { nom: 'X', source: 'odoo', sourceId: '1' });
    expect(r.statusCode).toBe(400);
    expect(r.json<{ erreur: string }>().erreur).toBe('Requête invalide');
  });

  it('valide les champs et les identifiants', async () => {
    expect((await appel('POST', '/contacts', { nom: 'A', email: 'pas-un-mail' })).statusCode).toBe(
      400,
    );
    expect((await appel('GET', '/contacts/pas-un-uuid')).statusCode).toBe(400);
    expect((await appel('GET', '/entreprises?limite=9999')).statusCode).toBe(400);
  });

  it('refuse de supprimer une entreprise qui a encore des contacts (409)', async () => {
    const e = await creer('/entreprises', { nom: 'Avec contact' });
    const c = await creer('/contacts', { nom: 'Alice Exemple', entrepriseId: e.id });
    expect((await appel('DELETE', `/entreprises/${e.id}`)).statusCode).toBe(409);
    expect((await appel('GET', `/contacts?entrepriseId=${e.id}`)).json<unknown[]>()).toHaveLength(
      1,
    );
    await appel('DELETE', `/contacts/${c.id}`);
    expect((await appel('DELETE', `/entreprises/${e.id}`)).statusCode).toBe(204);
  });

  it('refuse un lien vers une entreprise inexistante (409)', async () => {
    const r = await appel('POST', '/contacts', {
      nom: 'B',
      entrepriseId: '00000000-0000-4000-8000-000000000000',
    });
    expect(r.statusCode).toBe(409);
  });

  it('pagine', async () => {
    for (const n of ['P1', 'P2', 'P3']) await creer('/entreprises', { nom: `Pagination ${n}` });
    const page = await appel('GET', '/entreprises?q=Pagination&limite=2&decalage=2');
    expect(page.json<{ nom: string }[]>().map((x) => x.nom)).toEqual(['Pagination P3']);
  });
});

describe('affaires', () => {
  it('date chaque étape quand elle change et filtre les affaires ouvertes', async () => {
    const a = await creer('/affaires', { titre: 'Affaire A', etape: 'detection', montant: 1000 });
    expect(Object.keys(a.etapesDates)).toEqual(['detection']);

    const apres = (
      await appel('PATCH', `/affaires/${a.id}`, { etape: 'proposition' })
    ).json<Fiche>();
    expect(Object.keys(apres.etapesDates).sort()).toEqual(['detection', 'proposition']);

    const sansChangement = (
      await appel('PATCH', `/affaires/${a.id}`, { etape: 'proposition' })
    ).json<Fiche>();
    expect(sansChangement.etapesDates.proposition).toBe(apres.etapesDates.proposition);

    await appel('PATCH', `/affaires/${a.id}`, { clos: 'gagne' });
    const ouvertes = await appel('GET', '/affaires?ouvertes=1');
    expect(ouvertes.json<{ id: string }[]>().some((x) => x.id === a.id)).toBe(false);
  });

  it('valide la qualification (0 à 3 par critère)', async () => {
    const trop = await appel('POST', '/affaires', {
      titre: 'Q',
      etape: 'detection',
      qualification: { besoin: 4, decideur: 0, budget: 0, timing: 0, engagement: 0 },
    });
    expect(trop.statusCode).toBe(400);
  });
});

describe('tâches', () => {
  it('déduit le canal du type', async () => {
    expect((await creer('/taches', { titre: 'Appeler', type: 'appel' })).canal).toBe('appel');
    expect((await creer('/taches', { titre: 'Écrire', type: 'email' })).canal).toBe('email');
    const reunion = await creer('/taches', { titre: 'Point', type: 'reunion' });
    expect(reunion).toMatchObject({ canal: 'tache', typeChoisi: true });
    expect(await creer('/taches', { titre: 'Simple' })).toMatchObject({
      canal: 'tache',
      type: 'tache',
    });
  });

  it("terminer marque la tâche faite et met à jour la dernière activité de l'affaire", async () => {
    const a = await creer('/affaires', { titre: 'Affaire T', etape: 'detection' });
    const t = await creer('/taches', {
      titre: 'Relancer',
      opportuniteId: a.id,
      echeance: '2026-01-10T09:00:00Z',
    });
    const faite = (await appel('POST', `/taches/${t.id}/terminer`)).json<Fiche>();
    expect(faite.faitAt).toBeTruthy();
    const affaire = (await appel('GET', `/affaires/${a.id}`)).json<Fiche>();
    expect(affaire.derniereActivite).toBe(faite.faitAt);

    const encore = (await appel('POST', `/taches/${t.id}/terminer`)).json<Fiche>();
    expect(encore.faitAt).toBe(faite.faitAt);
    expect(
      (await appel('POST', '/taches/00000000-0000-4000-8000-000000000000/terminer')).statusCode,
    ).toBe(404);
  });

  it('liste les tâches ouvertes échues, les plus anciennes d’abord', async () => {
    const vieille = await creer('/taches', { titre: 'Échue 1', echeance: '2020-01-01T08:00:00Z' });
    const recente = await creer('/taches', { titre: 'Échue 2', echeance: '2020-06-01T08:00:00Z' });
    await creer('/taches', { titre: 'Future', echeance: '2099-01-01T08:00:00Z' });
    const liste = (await appel('GET', '/taches?ouvertes=1&avant=2021-01-01T00:00:00Z')).json<
      { id: string }[]
    >();
    expect(liste.map((x) => x.id)).toEqual([vieille.id, recente.id]);
  });
});

describe('rendez-vous', () => {
  it('un tri fait ici est manuel, et le compte rendu est daté', async () => {
    const r = await creer('/rendez-vous', {
      titre: 'Visite',
      debut: '2026-03-01T09:00:00Z',
      fin: '2026-03-01T10:00:00Z',
    });
    expect(r).toMatchObject({ statut: 'a_trier', tri: 'aucun', compteRenduAt: null });
    const maj = (
      await appel('PATCH', `/rendez-vous/${r.id}`, { statut: 'rdv', compteRendu: 'Résumé fictif' })
    ).json<Fiche>();
    expect(maj).toMatchObject({ statut: 'rdv', tri: 'manuel' });
    expect(maj.compteRenduAt).toBeTruthy();
    const filtre = await appel('GET', '/rendez-vous?statut=rdv&depuis=2026-02-01T00:00:00Z');
    expect(filtre.json<{ id: string }[]>().map((x) => x.id)).toContain(r.id);
  });

  it('refuse un statut inconnu', async () => {
    expect((await appel('POST', '/rendez-vous', { statut: 'autre' })).statusCode).toBe(400);
  });
});

describe('activités', () => {
  it("liste l'historique d'une fiche", async () => {
    const e = await creer('/entreprises', { nom: 'Historique' });
    await base.pool.query(
      "insert into activites (type, entreprise_id, at, titre) values ('note', $1, now(), 'Note fictive')",
      [e.id],
    );
    const liste = await appel('GET', `/activites?entrepriseId=${e.id}`);
    expect(liste.json<{ titre: string }[]>().map((x) => x.titre)).toEqual(['Note fictive']);
  });
});

describe('Odoo', () => {
  it('répond 404 tant qu’Odoo n’est pas configuré', async () => {
    expect((await appel('POST', '/odoo/synchro', {})).statusCode).toBe(404);
  });
});
