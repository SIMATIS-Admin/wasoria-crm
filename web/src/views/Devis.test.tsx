// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleContext, type Role } from '../role';
import type { DevisDetail } from '../types';
import { Devis } from './Devis';
import { DevisListe } from './DevisListe';

type Appel = { url: string; methode: string; corps: unknown };

const ARTICLES = [
  {
    id: 'art1',
    reference: 'CAP',
    nom: 'Capteur (par point)',
    prix: 5000,
    recurrent: false,
    actif: true,
    ordre: 0,
  },
  {
    id: 'art2',
    reference: 'MAINT',
    nom: 'Maintenance (par capteur)',
    prix: 600,
    recurrent: true,
    actif: true,
    ordre: 1,
  },
];
const devis = (extra: Partial<DevisDetail> = {}): DevisDetail => ({
  id: 'q1',
  numero: 'D-2026-001',
  opportuniteId: 'a1',
  statut: 'brouillon',
  formule: 'achat',
  dureeMois: 48,
  tauxCentiemes: 400,
  intro: 'Notre proposition fictive',
  envoyeLe: null,
  decideLe: null,
  createdAt: '2026-06-01T10:00:00Z',
  lignes: [
    {
      articleId: 'art1',
      designation: 'Capteur (par point)',
      prixUnitaire: 5000,
      recurrent: false,
      quantite: 2,
    },
    {
      articleId: 'art2',
      designation: 'Maintenance (par capteur)',
      prixUnitaire: 600,
      recurrent: true,
      quantite: 2,
    },
  ],
  totaux: {
    investissement: 10000,
    servicesAnnuels: 1200,
    totalPremiereAnnee: 11200,
    mensualite: null,
    coutFinancement: null,
    totalSurDuree: null,
  },
  affaire: { id: 'a1', titre: 'Affaire fictive', pipelineId: 'vente' },
  entreprise: { id: 'e1', nom: 'Société fictive', ville: 'Ville-Test' },
  contact: { nom: 'Alex Exemple', fonction: 'Directeur' },
  ...extra,
});

function simuler(
  initial: DevisDetail,
  suite?: (url: string, corps: unknown) => DevisDetail | null,
) {
  const appels: Appel[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    const corps = init?.body ? (JSON.parse(init.body as string) as unknown) : undefined;
    appels.push({ url, methode, corps });
    let reponse: unknown = initial;
    if (url === '/api/articles') reponse = ARTICLES;
    else if (methode !== 'GET') reponse = suite?.(url, corps) ?? initial;
    return Promise.resolve(new Response(JSON.stringify(reponse), { status: 200 }));
  });
  return appels;
}
const avec = (role: Role, ui: React.ReactElement) => (
  <RoleContext.Provider value={role}>{ui}</RoleContext.Provider>
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Devis', () => {
  it('montre le devis à l’achat : lignes, totaux et aperçu avec le client', async () => {
    simuler(devis());
    render(avec('commercial', <Devis id="q1" />));
    const apercu = await screen.findByLabelText('Aperçu du devis');
    expect(within(apercu).getByText('Devis D-2026-001')).toBeTruthy();
    expect(within(apercu).getByText('Société fictive')).toBeTruthy();
    expect(within(apercu).getByText(/Alex Exemple, Directeur/)).toBeTruthy();
    expect(within(apercu).getByText('Total la première année')).toBeTruthy();
    expect(within(apercu).getAllByText(/11\s?200/).length).toBeGreaterThan(0);
  });

  it('ajoute un article du catalogue : envoie la liste complète des lignes', async () => {
    const appels = simuler(devis());
    render(avec('commercial', <Devis id="q1" />));
    fireEvent.change(await screen.findByLabelText('Ajouter un article'), {
      target: { value: 'art1' },
    });
    await waitFor(() => expect(appels.find((a) => a.methode === 'PUT')).toBeTruthy());
    const put = appels.find((a) => a.methode === 'PUT')!;
    expect(put.url).toBe('/api/devis/q1/lignes');
    expect((put.corps as { lignes: unknown[] }).lignes).toHaveLength(3);
  });

  it('change la quantité et retire une ligne', async () => {
    const appels = simuler(devis());
    render(avec('commercial', <Devis id="q1" />));
    const quantite = await screen.findByLabelText('Quantité de Capteur (par point)');
    fireEvent.change(quantite, { target: { value: '5' } });
    fireEvent.blur(quantite);
    await waitFor(() => expect(appels.some((a) => a.methode === 'PUT')).toBe(true));
    expect(
      (appels.find((a) => a.methode === 'PUT')!.corps as { lignes: { quantite: number }[] })
        .lignes[0]!.quantite,
    ).toBe(5);

    fireEvent.click(screen.getByRole('button', { name: 'Retirer Maintenance (par capteur)' }));
    await waitFor(() => expect(appels.filter((a) => a.methode === 'PUT')).toHaveLength(2));
    expect(
      (appels.filter((a) => a.methode === 'PUT')[1]!.corps as { lignes: unknown[] }).lignes,
    ).toHaveLength(1);
  });

  it('passe à l’abonnement et règle la durée', async () => {
    const appels = simuler(devis());
    render(avec('commercial', <Devis id="q1" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Abonnement' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'PATCH')?.corps).toEqual({ formule: 'abonnement' }),
    );
  });

  it('abonnement : la mensualité et la durée figurent sur le devis', async () => {
    simuler(
      devis({
        formule: 'abonnement',
        totaux: {
          investissement: 10000,
          servicesAnnuels: 1200,
          totalPremiereAnnee: 11200,
          mensualite: 325.79,
          coutFinancement: 837.92,
          totalSurDuree: 15637.92,
        },
      }),
    );
    render(avec('commercial', <Devis id="q1" />));
    const apercu = await screen.findByLabelText('Aperçu du devis');
    expect(within(apercu).getByText('Abonnement 48 mois')).toBeTruthy();
    expect(within(apercu).getByText(/325,79/)).toBeTruthy();
  });

  it('un devis envoyé est verrouillé ; ses boutons de décision apparaissent', async () => {
    const appels = simuler(devis({ statut: 'envoye' }));
    render(avec('commercial', <Devis id="q1" />));
    expect(await screen.findByText(/repassez-le en brouillon/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Achat' }).disabled).toBe(true);
    expect(screen.queryByLabelText('Ajouter un article')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accepté' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'PATCH')?.corps).toEqual({ statut: 'accepte' }),
    );
  });

  it('la lecture seule consulte et imprime, sans modifier', async () => {
    simuler(devis());
    render(avec('lecture', <Devis id="q1" />));
    await screen.findByLabelText('Aperçu du devis');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Abonnement' }).disabled).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Marquer comme envoyé' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Imprimer / PDF' })).toBeTruthy();
  });
});

describe('Liste des devis', () => {
  it('montre le numéro, le compte, le montant selon la formule et le statut', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          JSON.stringify([
            { ...devis(), affaire: 'Affaire fictive', entreprise: 'Société fictive' },
            {
              ...devis({
                id: 'q2',
                numero: 'D-2026-002',
                formule: 'abonnement',
                statut: 'accepte',
              }),
              affaire: 'Autre affaire',
              entreprise: null,
              totaux: {
                investissement: 1,
                servicesAnnuels: 0,
                totalPremiereAnnee: 1,
                mensualite: 120.5,
                coutFinancement: 0,
                totalSurDuree: 1,
              },
            },
          ]),
        ),
      ),
    );
    render(<DevisListe />);
    expect(await screen.findByText('D-2026-001')).toBeTruthy();
    expect(screen.getByText('Société fictive')).toBeTruthy();
    expect(screen.getByText('Brouillon')).toBeTruthy();
    expect(screen.getByText('Accepté')).toBeTruthy();
    expect(screen.getByText(/120,50/)).toBeTruthy();
  });
});
