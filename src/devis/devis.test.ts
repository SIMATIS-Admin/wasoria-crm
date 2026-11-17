import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { creerAuth } from '../auth/service.js';
import { createDb } from '../db/index.js';
import { demarrerBase, JETON } from '../test/base.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
const MDP = 'un-mot-de-passe-solide';
const cookies: Record<string, string> = {};

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
const appel = (method: Method, url: string, payload?: object, role?: string) =>
  base.app.inject({
    method,
    url: `/api${url}`,
    payload,
    headers: role ? { cookie: cookies[role]! } : { authorization: `Bearer ${JETON}` },
  });

type Article = { id: string; reference: string; prix: number };
type Devis = {
  id: string;
  numero: string;
  statut: string;
  formule: string;
  dureeMois: number;
  lignes: {
    designation: string;
    prixUnitaire: number;
    quantite: number;
    recurrent: boolean;
    articleId: string | null;
  }[];
  totaux: {
    investissement: number;
    servicesAnnuels: number;
    totalPremiereAnnee: number;
    mensualite: number | null;
  };
  envoyeLe: string | null;
  decideLe: string | null;
  entreprise: { nom: string } | null;
};
let capteur: Article;
let maintenance: Article;
let affaireId: string;

beforeAll(async () => {
  base = await demarrerBase();
  const auth = creerAuth(createDb(base.pool));
  for (const [identifiant, role] of [
    ['adm', 'admin'],
    ['com', 'commercial'],
    ['av', 'apres-vente'],
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
  capteur = (
    await appel('POST', '/articles', { reference: 'CAP', nom: 'Capteur (par point)', prix: 5000 })
  ).json<Article>();
  maintenance = (
    await appel('POST', '/articles', {
      reference: 'MAINT',
      nom: 'Maintenance (par capteur)',
      prix: 600,
      recurrent: true,
    })
  ).json<Article>();
  const e = (await appel('POST', '/entreprises', { nom: 'Société devis' })).json<{ id: string }>();
  affaireId = (
    await appel('POST', '/affaires', {
      titre: 'Affaire devis',
      etape: 'proposition',
      entrepriseId: e.id,
    })
  ).json<{ id: string }>().id;
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

describe('catalogue', () => {
  it('liste les articles actifs, tous sur demande, et refuse une référence en double', async () => {
    expect((await appel('GET', '/articles')).json<Article[]>().map((a) => a.reference)).toEqual([
      'CAP',
      'MAINT',
    ]);
    expect(
      (await appel('POST', '/articles', { reference: 'CAP', nom: 'Autre', prix: 1 })).statusCode,
    ).toBe(409);
    await appel('PATCH', `/articles/${maintenance.id}`, { actif: false });
    expect((await appel('GET', '/articles')).json<Article[]>().map((a) => a.reference)).toEqual([
      'CAP',
    ]);
    expect((await appel('GET', '/articles?tous=1')).json<Article[]>()).toHaveLength(2);
    await appel('PATCH', `/articles/${maintenance.id}`, { actif: true });
  });

  it('seuls les administrateurs modifient le catalogue ; chacun le lit', async () => {
    expect(
      (await appel('POST', '/articles', { reference: 'X', nom: 'X', prix: 1 }, 'commercial'))
        .statusCode,
    ).toBe(403);
    expect(
      (await appel('PATCH', `/articles/${capteur.id}`, { prix: 1 }, 'commercial')).statusCode,
    ).toBe(403);
    expect((await appel('GET', '/articles', undefined, 'lecture')).statusCode).toBe(200);
    expect(
      (await appel('POST', '/articles', { reference: 'NEG', nom: 'Prix négatif', prix: -5 }))
        .statusCode,
    ).toBe(400);
  });
});

describe('devis', () => {
  it('se crée en brouillon avec un numéro D-année-rang, qui se suivent', async () => {
    const a = (await appel('POST', '/devis', { affaireId })).json<Devis>();
    const b = (
      await appel('POST', '/devis', {
        affaireId,
        formule: 'abonnement',
        dureeMois: 60,
        tauxCentiemes: 350,
      })
    ).json<Devis>();
    const annee = new Date().getFullYear();
    expect(a).toMatchObject({
      numero: `D-${annee}-001`,
      statut: 'brouillon',
      formule: 'achat',
      dureeMois: 48,
    });
    expect(b).toMatchObject({
      numero: `D-${annee}-002`,
      formule: 'abonnement',
      dureeMois: 60,
      tauxCentiemes: 350,
    });
    expect(a.entreprise).toMatchObject({ nom: 'Société devis' });
    expect(
      (await appel('POST', '/devis', { affaireId: '00000000-0000-4000-8000-000000000000' }))
        .statusCode,
    ).toBe(404);
  });

  it('les lignes reprennent le nom et le prix de l’article, ou un prix négocié', async () => {
    const d = (await appel('POST', '/devis', { affaireId })).json<Devis>();
    const r = await appel('PUT', `/devis/${d.id}/lignes`, {
      lignes: [
        { articleId: capteur.id, quantite: 2 },
        { articleId: maintenance.id, quantite: 2, prixUnitaire: 500 },
        { designation: 'Prestation libre', prixUnitaire: 1000, quantite: 1 },
      ],
    });
    const devis = r.json<Devis>();
    expect(
      devis.lignes.map((l) => [l.designation, l.prixUnitaire, l.quantite, l.recurrent]),
    ).toEqual([
      ['Capteur (par point)', 5000, 2, false],
      ['Maintenance (par capteur)', 500, 2, true],
      ['Prestation libre', 1000, 1, false],
    ]);
    expect(devis.totaux).toMatchObject({
      investissement: 11000,
      servicesAnnuels: 1000,
      totalPremiereAnnee: 12000,
    });

    // un changement de prix du catalogue ne touche pas un devis déjà fait
    await appel('PATCH', `/articles/${capteur.id}`, { prix: 9999 });
    expect((await appel('GET', `/devis/${d.id}`)).json<Devis>().lignes[0]!.prixUnitaire).toBe(5000);
    await appel('PATCH', `/articles/${capteur.id}`, { prix: 5000 });
  });

  it('refuse une ligne sans article ni prix, un article inconnu et une quantité nulle', async () => {
    const d = (await appel('POST', '/devis', { affaireId })).json<Devis>();
    const put = (lignes: object[]) => appel('PUT', `/devis/${d.id}/lignes`, { lignes });
    expect((await put([{ designation: 'Sans prix', quantite: 1 }])).statusCode).toBe(400);
    expect(
      (await put([{ articleId: '00000000-0000-4000-8000-000000000000', quantite: 1 }])).statusCode,
    ).toBe(400);
    expect((await put([{ articleId: capteur.id, quantite: 0 }])).statusCode).toBe(400);
  });

  it('calcule l’abonnement : mensualité sur la durée choisie', async () => {
    const d = (
      await appel('POST', '/devis', {
        affaireId,
        formule: 'abonnement',
        dureeMois: 48,
        tauxCentiemes: 400,
      })
    ).json<Devis>();
    const r = (
      await appel('PUT', `/devis/${d.id}/lignes`, {
        lignes: [
          { articleId: capteur.id, quantite: 2 },
          { articleId: maintenance.id, quantite: 2 },
        ],
      })
    ).json<Devis>();
    expect(r.totaux.investissement).toBe(10000);
    expect(r.totaux.mensualite).toBeCloseTo(325.79, 2);
    const court = (await appel('PATCH', `/devis/${d.id}`, { dureeMois: 36 })).json<Devis>();
    expect(court.totaux.mensualite!).toBeGreaterThan(r.totaux.mensualite!);
  });

  it('suit son cycle, date l’envoi et la décision, et se verrouille une fois envoyé', async () => {
    const d = (await appel('POST', '/devis', { affaireId })).json<Devis>();
    await appel('PUT', `/devis/${d.id}/lignes`, {
      lignes: [{ articleId: capteur.id, quantite: 1 }],
    });
    expect((await appel('PATCH', `/devis/${d.id}`, { statut: 'accepte' })).statusCode).toBe(409);

    const envoye = (await appel('PATCH', `/devis/${d.id}`, { statut: 'envoye' })).json<Devis>();
    expect(envoye.statut).toBe('envoye');
    expect(envoye.envoyeLe).toBeTruthy();
    expect((await appel('PATCH', `/devis/${d.id}`, { formule: 'abonnement' })).statusCode).toBe(
      409,
    );
    expect((await appel('PUT', `/devis/${d.id}/lignes`, { lignes: [] })).statusCode).toBe(409);

    const accepte = (await appel('PATCH', `/devis/${d.id}`, { statut: 'accepte' })).json<Devis>();
    expect(accepte.decideLe).toBeTruthy();
    const rouvert = (await appel('PATCH', `/devis/${d.id}`, { statut: 'envoye' })).json<Devis>();
    expect(rouvert.decideLe).toBeNull();
    const brouillon = (
      await appel('PATCH', `/devis/${d.id}`, { statut: 'brouillon' })
    ).json<Devis>();
    expect(brouillon).toMatchObject({ statut: 'brouillon', envoyeLe: null });
    expect((await appel('PATCH', `/devis/${d.id}`, { formule: 'abonnement' })).statusCode).toBe(
      200,
    );
  });

  it('la liste donne les devis d’une affaire avec leurs totaux', async () => {
    const liste = (await appel('GET', `/devis?affaireId=${affaireId}`)).json<
      (Devis & { affaire: string })[]
    >();
    expect(liste.length).toBeGreaterThanOrEqual(4);
    expect(liste[0]).toMatchObject({ affaire: 'Affaire devis', entreprise: 'Société devis' });
    expect(liste[0]!.totaux).toHaveProperty('totalPremiereAnnee');
  });
});

describe('droits sur les devis', () => {
  it('le commercial prépare un devis, la lecture le consulte seulement', async () => {
    expect((await appel('POST', '/devis', { affaireId }, 'commercial')).statusCode).toBe(201);
    expect((await appel('POST', '/devis', { affaireId }, 'lecture')).statusCode).toBe(403);
    expect((await appel('GET', '/devis', undefined, 'lecture')).statusCode).toBe(200);
  });

  it('seul un administrateur supprime un devis', async () => {
    const d = (await appel('POST', '/devis', { affaireId })).json<Devis>();
    expect((await appel('DELETE', `/devis/${d.id}`, undefined, 'commercial')).statusCode).toBe(403);
    expect((await appel('DELETE', `/devis/${d.id}`, undefined, 'admin')).statusCode).toBe(204);
    expect((await appel('GET', `/devis/${d.id}`)).statusCode).toBe(404);
  });

  it('le rôle après-vente ne prépare pas de devis sur une vente, mais le peut sur un dossier après-vente', async () => {
    expect((await appel('POST', '/devis', { affaireId }, 'apres-vente')).statusCode).toBe(403);
    const dossier = (
      await appel('POST', '/affaires', {
        titre: 'Dossier',
        etape: 'installation',
        pipeline: 'apres-vente',
      })
    ).json<{ id: string }>();
    expect(
      (await appel('POST', '/devis', { affaireId: dossier.id }, 'apres-vente')).statusCode,
    ).toBe(201);
  });
});
