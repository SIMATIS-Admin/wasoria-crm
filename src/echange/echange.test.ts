import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demarrerBase, JETON } from '../test/base.js';

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

type Fiche = {
  id: string;
  source: string;
  source_id: string | null;
  modifie_le: string;
  champs: Record<string, unknown>;
  liens: Record<string, string | string[] | null>;
};
const creer = async (url: string, payload: object) =>
  (await appel('POST', url, payload)).json<{ id: string }>();
const lire = async (objet: string, requete = '') =>
  (await appel('GET', `/echange/${objet}${requete}`)).json<Fiche[]>();
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('échange avec l’OS : lecture', () => {
  it('exige le jeton, annonce le profil et refuse un objet inconnu', async () => {
    expect((await base.app.inject({ method: 'GET', url: '/api/echange' })).statusCode).toBe(401);
    const index = (await appel('GET', '/echange')).json<{ profil: string; objets: string[] }>();
    expect(index.profil).toBe('crm/1');
    expect(index.objets).toContain('rendez_vous');
    expect((await appel('GET', '/echange/inconnu')).statusCode).toBe(400);
  });

  it('sert les étapes du pipeline dans l’ordre', async () => {
    const { etapes } = (await appel('GET', '/echange/etapes')).json<{
      etapes: { id: string; ordre: number; probabilite: number; clos: boolean }[];
    }>();
    expect(etapes.map((e) => e.id)).toEqual([
      'detection',
      'prospection',
      'qualification',
      'proposition',
      'negociation',
    ]);
    expect(etapes.every((e) => !e.clos && e.probabilite > 0)).toBe(true);
  });

  it('donne une entreprise avec les seuls champs du profil', async () => {
    const e = await creer('/entreprises', {
      nom: 'Échange SA',
      ville: 'Ville-Test',
      taille: 10,
      siren: '123456789',
    });
    const [fiche] = (await lire('entreprise')).filter((f) => f.id === e.id);
    expect(fiche).toMatchObject({ source: 'natif', source_id: null });
    expect(fiche!.champs).toEqual({
      nom: 'Échange SA',
      secteur: null,
      ville: 'Ville-Test',
      taille: 10,
      domaine: null,
    });
    expect(fiche!.liens).toEqual({});
  });

  it('un contact porte ses emails (principal d’abord) et ses entreprises', async () => {
    const e1 = await creer('/entreprises', { nom: 'Contact E1' });
    const e2 = await creer('/entreprises', { nom: 'Contact E2' });
    const c = await creer('/contacts', {
      nom: 'Alex Échange',
      email: 'alex@exemple.test',
      entrepriseId: e1.id,
    });
    await appel('PUT', `/contacts/${c.id}/emails`, {
      emails: ['principal@exemple.test', 'autre@exemple.test'],
    });
    await appel('PUT', `/contacts/${c.id}/liens`, { entreprises: [e2.id, e1.id] });

    const fiche = (await lire('contact')).find((f) => f.id === c.id)!;
    expect(fiche.champs).toMatchObject({
      email: 'principal@exemple.test',
      emails: ['principal@exemple.test', 'autre@exemple.test'],
    });
    expect(fiche.liens.entreprises).toEqual([e2.id, e1.id]);
  });

  it('une affaire est en snake_case, avec ses liens, le principal d’abord', async () => {
    const e = await creer('/entreprises', { nom: 'Affaire E' });
    const c1 = await creer('/contacts', { nom: 'Premier' });
    const c2 = await creer('/contacts', { nom: 'Second' });
    const a = await creer('/affaires', {
      titre: 'Affaire échange',
      etape: 'detection',
      montant: 5000,
      echeance: '2027-01-15',
    });
    await appel('PUT', `/affaires/${a.id}/liens`, {
      contacts: [c2.id, c1.id],
      entreprises: [e.id],
    });

    const fiche = (await lire('affaire')).find((f) => f.id === a.id)!;
    expect(fiche.champs).toMatchObject({
      titre: 'Affaire échange',
      etape: 'detection',
      montant: 5000,
      echeance: '2027-01-15',
      mode_facturation: 'spot',
      prochaine_etape: null,
    });
    expect(Object.keys(fiche.champs['etapes_dates'] as object)).toEqual(['detection']);
    expect(fiche.liens).toEqual({ contacts: [c2.id, c1.id], entreprises: [e.id] });
    const seule = (await appel('GET', `/affaires/${a.id}`)).json<{
      contactId: string;
      entrepriseId: string;
    }>();
    expect(seule).toMatchObject({ contactId: c2.id, entrepriseId: e.id });
  });

  it('une liste de liens remplace l’ancienne ; absente, elle ne change rien', async () => {
    const c1 = await creer('/contacts', { nom: 'L1' });
    const c2 = await creer('/contacts', { nom: 'L2' });
    const a = await creer('/affaires', { titre: 'Liens', etape: 'detection' });
    await appel('PUT', `/affaires/${a.id}/liens`, { contacts: [c1.id, c2.id] });
    await appel('PUT', `/affaires/${a.id}/liens`, { contacts: [c2.id] });
    await appel('PUT', `/affaires/${a.id}/liens`, {});
    expect((await lire('affaire')).find((f) => f.id === a.id)!.liens.contacts).toEqual([c2.id]);
    await appel('PUT', `/affaires/${a.id}/liens`, { contacts: [] });
    expect((await lire('affaire')).find((f) => f.id === a.id)!.liens.contacts).toEqual([]);
  });

  it('refuse un lien vers une fiche inexistante (409) ou une fiche inconnue (404)', async () => {
    const a = await creer('/affaires', { titre: 'Erreurs', etape: 'detection' });
    const fantome = '00000000-0000-4000-8000-000000000000';
    expect(
      (await appel('PUT', `/affaires/${a.id}/liens`, { contacts: [fantome] })).statusCode,
    ).toBe(409);
    expect((await appel('PUT', `/affaires/${fantome}/liens`, { contacts: [] })).statusCode).toBe(
      404,
    );
    expect((await appel('PUT', `/affaires/${a.id}/liens`, { inconnu: [] })).statusCode).toBe(400);
  });

  it('lit depuis une date, et un lien modifié fait remonter la fiche', async () => {
    const c = await creer('/contacts', { nom: 'Incrémental' });
    const e = await creer('/entreprises', { nom: 'Incrémental E' });
    await attendre(30);
    const borne = new Date().toISOString();
    await attendre(30);
    expect(
      (await lire('contact', `?depuis=${encodeURIComponent(borne)}`)).some((f) => f.id === c.id),
    ).toBe(false);
    await appel('PUT', `/contacts/${c.id}/liens`, { entreprises: [e.id] });
    expect(
      (await lire('contact', `?depuis=${encodeURIComponent(borne)}`)).some((f) => f.id === c.id),
    ).toBe(true);
  });

  it('pagine du plus ancien au plus récent', async () => {
    for (const n of [1, 2, 3]) {
      await creer('/entreprises', { nom: `Page ${n}` });
      await attendre(15);
    }
    const toutes = (await lire('entreprise')).filter((f) =>
      String(f.champs.nom).startsWith('Page '),
    );
    const page = (await lire('entreprise', '?limite=1&decalage=0')).concat(
      await lire('entreprise', '?limite=1&decalage=1'),
    );
    expect(page).toHaveLength(2);
    expect(page[0]!.modifie_le <= page[1]!.modifie_le).toBe(true);
    expect(toutes.map((f) => f.champs.nom)).toEqual(['Page 1', 'Page 2', 'Page 3']);
  });

  it('tâche et activité ont des liens simples', async () => {
    const e = await creer('/entreprises', { nom: 'Tâche E' });
    const a = await creer('/affaires', { titre: 'Tâche A', etape: 'detection' });
    const t = await creer('/taches', {
      titre: 'Rappeler',
      type: 'appel',
      opportuniteId: a.id,
      entrepriseId: e.id,
    });
    const n = await creer('/activites', {
      type: 'note',
      at: '2026-03-01T10:00:00Z',
      titre: 'Note',
      resume: 'Texte',
      opportuniteId: a.id,
    });
    const tache = (await lire('tache')).find((f) => f.id === t.id)!;
    expect(tache.liens).toEqual({ contact: null, entreprise: e.id, affaire: a.id });
    expect(tache.champs).toMatchObject({ titre: 'Rappeler', type: 'appel', fait_at: null });
    const act = (await lire('activite')).find((f) => f.id === n.id)!;
    expect(act.champs).toMatchObject({
      type: 'note',
      at: '2026-03-01T10:00:00.000Z',
      resume: 'Texte',
    });
    expect(act.liens.affaire).toBe(a.id);
  });

  it('ne partage que les rendez-vous classés commerciaux, avec leurs liens', async () => {
    const c = await creer('/contacts', { nom: 'Participant' });
    const gardé = await creer('/rendez-vous', {
      titre: 'Partagé',
      debut: '2026-04-01T09:00:00Z',
      statut: 'rdv',
    });
    const trier = await creer('/rendez-vous', { titre: 'À trier', debut: '2026-04-02T09:00:00Z' });
    await appel('PUT', `/rendez-vous/${gardé.id}/liens`, { contacts: [c.id] });
    const ids = (await lire('rendez_vous')).map((f) => f.id);
    expect(ids).toContain(gardé.id);
    expect(ids).not.toContain(trier.id);
    expect((await lire('rendez_vous')).find((f) => f.id === gardé.id)!.liens.contacts).toEqual([
      c.id,
    ]);
  });

  it('journalise les suppressions, pas les liens en cascade', async () => {
    const c = await creer('/contacts', { nom: 'À supprimer' });
    const e = await creer('/entreprises', { nom: 'Reste' });
    await appel('PUT', `/contacts/${c.id}/liens`, { entreprises: [e.id] });
    const avant = new Date().toISOString();
    await attendre(20);
    expect((await appel('DELETE', `/contacts/${c.id}`)).statusCode).toBe(204);
    const journal = (
      await appel('GET', `/echange/suppressions?depuis=${encodeURIComponent(avant)}`)
    ).json<{ objet: string; id: string }[]>();
    expect(journal).toEqual([expect.objectContaining({ objet: 'contact', id: c.id })]);
  });
});
