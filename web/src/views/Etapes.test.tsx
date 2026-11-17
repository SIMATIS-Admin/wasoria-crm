// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleContext } from '../role';
import { Etapes } from './Etapes';

const admin = (ui: React.ReactElement) => (
  <RoleContext.Provider value="admin">{ui}</RoleContext.Provider>
);

type Appel = { url: string; methode: string; corps: unknown };

const ETAPES = [
  { id: 'a', label: 'Première', ordre: 1, probabilite: 10 },
  { id: 'b', label: 'Seconde', ordre: 2, probabilite: 50 },
];

function simuler(reponses: Record<string, () => Response> = {}) {
  const appels: Appel[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    appels.push({ url, methode, corps: init?.body ? JSON.parse(init.body as string) : undefined });
    const cle = `${methode} ${url}`;
    const r = reponses[cle]?.();
    return Promise.resolve(
      r ?? new Response(JSON.stringify(methode === 'GET' ? ETAPES : {}), { status: 200 }),
    );
  });
  return appels;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Étapes', () => {
  it('liste les étapes du serveur et renomme au départ du champ', async () => {
    const appels = simuler();
    render(admin(<Etapes />));
    const champ = await screen.findByLabelText('Nom de l’étape Première');
    fireEvent.change(champ, { target: { value: 'Premier contact' } });
    fireEvent.blur(champ);
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'PATCH')).toMatchObject({
        url: '/api/etapes/a',
        corps: { label: 'Premier contact' },
      }),
    );
  });

  it('envoie le nouvel ordre quand on descend une étape', async () => {
    const appels = simuler();
    render(admin(<Etapes />));
    fireEvent.click(await screen.findByRole('button', { name: 'Descendre Première' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'PUT')).toMatchObject({
        url: '/api/etapes/ordre',
        corps: { ids: ['b', 'a'] },
      }),
    );
  });

  it('demande où placer les affaires avant de supprimer une étape utilisée', async () => {
    const appels = simuler({
      'DELETE /api/etapes/a': () =>
        new Response(
          JSON.stringify({ erreur: '3 affaire(s) sont dans cette étape', affaires: 3 }),
          { status: 409 },
        ),
    });
    render(admin(<Etapes />));
    fireEvent.click(await screen.findByRole('button', { name: 'Supprimer Première' }));
    expect(await screen.findByText(/3 affaires sont dans cette étape/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Déplacer et supprimer' }));
    await waitFor(() =>
      expect(appels.filter((a) => a.methode === 'DELETE').at(-1)?.url).toBe('/api/etapes/a?vers=b'),
    );
  });

  it('ajoute une étape avec sa probabilité', async () => {
    const appels = simuler();
    render(admin(<Etapes />));
    fireEvent.change(await screen.findByLabelText('Nouvelle étape'), {
      target: { value: 'Signature' },
    });
    fireEvent.change(screen.getByLabelText('Probabilité (%)'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'POST')).toMatchObject({
        url: '/api/etapes',
        corps: { label: 'Signature', probabilite: 90 },
      }),
    );
  });
});
