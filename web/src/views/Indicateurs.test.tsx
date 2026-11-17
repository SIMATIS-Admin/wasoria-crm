// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Indicateurs } from './Indicateurs';

const ETAPES = [
  { id: 'qualification', label: 'Qualification', ordre: 1, probabilite: 40 },
  { id: 'proposition', label: 'Proposition', ordre: 2, probabilite: 60 },
];
const INDICATEURS = [
  {
    id: 'delai-devis',
    label: 'Délai de remise du devis',
    type: 'delai',
    unite: 'jours',
    deEtape: 'qualification',
    versEtape: 'proposition',
    objectif: 10,
    valeur: 12.5,
    moyenne: 13,
    n: 4,
    statut: 'hors-objectif',
  },
  {
    id: 'contact-visite',
    label: 'Du contact à la visite',
    type: 'conversion',
    unite: '%',
    deEtape: 'qualification',
    versEtape: 'proposition',
    objectif: 50,
    valeur: 60,
    convertis: 3,
    n: 5,
    statut: 'ok',
  },
  {
    id: 'entrants',
    label: 'Opportunités entrantes par semaine',
    type: 'entrants',
    unite: 'par semaine',
    deEtape: null,
    versEtape: null,
    objectif: null,
    valeur: 1.5,
    n: 6,
    statut: 'sans-objectif',
    serie: [
      { semaine: '2026-06-08', n: 2 },
      { semaine: '2026-06-15', n: 4 },
    ],
  },
  {
    id: 'devis-commande',
    label: 'Du devis à la commande',
    type: 'conversion',
    unite: '%',
    deEtape: null,
    versEtape: null,
    objectif: null,
    valeur: null,
    n: 0,
    statut: 'a-configurer',
  },
];

function simuler() {
  const appels: { url: string; methode: string; corps: unknown }[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    appels.push({ url, methode, corps: init?.body ? JSON.parse(init.body as string) : undefined });
    const corps = url.startsWith('/api/indicateurs')
      ? { jours: 90, indicateurs: INDICATEURS }
      : url === '/api/etapes'
        ? ETAPES
        : {};
    return Promise.resolve(new Response(JSON.stringify(corps), { status: 200 }));
  });
  return appels;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Indicateurs', () => {
  it('montre chaque indicateur avec sa valeur, son objectif et son statut', async () => {
    simuler();
    render(<Indicateurs />);
    const delai = await screen.findByRole('region', { name: 'Délai de remise du devis' });
    expect(within(delai).getByText('12,5')).toBeTruthy();
    expect(within(delai).getByText('Hors objectif')).toBeTruthy();
    expect(within(delai).getByText(/Objectif : ≤ 10 jours/)).toBeTruthy();
    expect(within(delai).getByText(/De Qualification à Proposition/)).toBeTruthy();

    const conversion = screen.getByRole('region', { name: 'Du contact à la visite' });
    expect(within(conversion).getByText('Objectif tenu')).toBeTruthy();
    expect(within(conversion).getByText(/Objectif : ≥ 50 %/)).toBeTruthy();
    expect(within(conversion).getByText('3 sur 5 affaires')).toBeTruthy();

    const entrants = screen.getByRole('region', { name: 'Opportunités entrantes par semaine' });
    expect(within(entrants).getByRole('img', { name: 'Affaires créées par semaine' })).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'Du devis à la commande' })).getByText(
        'À configurer',
      ),
    ).toBeTruthy();
  });

  it('relit les indicateurs quand on change de période', async () => {
    const appels = simuler();
    render(<Indicateurs />);
    await screen.findByRole('region', { name: 'Délai de remise du devis' });
    fireEvent.click(screen.getByRole('button', { name: '180 jours' }));
    await waitFor(() =>
      expect(appels.some((a) => a.url === '/api/indicateurs?jours=180')).toBe(true),
    );
  });

  it('enregistre l’objectif et les étapes réglés', async () => {
    const appels = simuler();
    render(<Indicateurs />);
    const carte = await screen.findByRole('region', { name: 'Du devis à la commande' });
    fireEvent.click(within(carte).getByRole('button', { name: 'Régler' }));
    const dialogue = await screen.findByRole('dialog');
    fireEvent.change(within(dialogue).getByLabelText('Étape de départ'), {
      target: { value: 'proposition' },
    });
    fireEvent.change(within(dialogue).getByLabelText('Étape d’arrivée'), {
      target: { value: '@gagne' },
    });
    fireEvent.change(within(dialogue).getByLabelText(/Objectif/), { target: { value: '30' } });
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'PATCH')).toMatchObject({
        url: '/api/indicateurs/devis-commande',
        corps: { objectif: 30, deEtape: 'proposition', versEtape: '@gagne' },
      }),
    );
  });

  it('un indicateur sans étape n’en demande pas pour les entrants', async () => {
    simuler();
    render(<Indicateurs />);
    const carte = await screen.findByRole('region', { name: 'Opportunités entrantes par semaine' });
    fireEvent.click(within(carte).getByRole('button', { name: 'Régler' }));
    const dialogue = await screen.findByRole('dialog');
    expect(within(dialogue).queryByLabelText('Étape de départ')).toBeNull();
  });
});
