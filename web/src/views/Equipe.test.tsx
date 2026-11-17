// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleContext } from '../role';
import { Equipe } from './Equipe';

const COMPTES = [
  {
    id: 'u1',
    identifiant: 'chef',
    nom: 'Chef',
    role: 'admin',
    actif: true,
    derniereConnexion: '2026-06-01T10:00:00Z',
  },
  {
    id: 'u2',
    identifiant: 'vendeuse',
    nom: 'Vendeuse',
    role: 'commercial',
    actif: true,
    derniereConnexion: null,
  },
  {
    id: 'u3',
    identifiant: 'parti',
    nom: 'Parti',
    role: 'lecture',
    actif: false,
    derniereConnexion: null,
  },
];

type Appel = { url: string; methode: string; corps: unknown };
function simuler(refus: Record<string, { status: number; erreur: string }> = {}) {
  const appels: Appel[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    appels.push({ url, methode, corps: init?.body ? JSON.parse(init.body as string) : undefined });
    const r = refus[`${methode} ${url}`];
    if (r)
      return Promise.resolve(
        new Response(JSON.stringify({ erreur: r.erreur }), { status: r.status }),
      );
    return Promise.resolve(
      new Response(JSON.stringify(methode === 'GET' ? COMPTES : {}), { status: 200 }),
    );
  });
  return appels;
}
const rendre = () =>
  render(
    <RoleContext.Provider value="admin">
      <Equipe />
    </RoleContext.Provider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Équipe', () => {
  it('liste les comptes avec leur rôle, et marque ceux qui sont désactivés', async () => {
    simuler();
    rendre();
    const select = await screen.findByLabelText('Rôle de Vendeuse');
    expect((select as HTMLSelectElement).value).toBe('commercial');
    expect(screen.getByText('Désactivé')).toBeTruthy();
    expect(screen.getAllByText('jamais')).toHaveLength(2);
  });

  it('change le rôle d’un compte', async () => {
    const appels = simuler();
    rendre();
    fireEvent.change(await screen.findByLabelText('Rôle de Vendeuse'), {
      target: { value: 'lecture' },
    });
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'PATCH')).toMatchObject({
        url: '/api/utilisateurs/u2',
        corps: { role: 'lecture' },
      }),
    );
  });

  it('désactive et réactive un compte', async () => {
    const appels = simuler();
    rendre();
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver Vendeuse' }));
    await waitFor(() =>
      expect(
        appels.some((a) => a.methode === 'PATCH' && JSON.stringify(a.corps) === '{"actif":false}'),
      ).toBe(true),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Réactiver Parti' }));
    await waitFor(() =>
      expect(
        appels.some(
          (a) => a.url === '/api/utilisateurs/u3' && JSON.stringify(a.corps) === '{"actif":true}',
        ),
      ).toBe(true),
    );
  });

  it('affiche le refus du serveur, par exemple pour le dernier administrateur', async () => {
    simuler({
      'PATCH /api/utilisateurs/u1': {
        status: 409,
        erreur: 'Il doit rester au moins un administrateur actif',
      },
    });
    rendre();
    fireEvent.change(await screen.findByLabelText('Rôle de Chef'), {
      target: { value: 'commercial' },
    });
    expect(await screen.findByText('Il doit rester au moins un administrateur actif')).toBeTruthy();
  });

  it('crée un compte avec son rôle', async () => {
    const appels = simuler();
    rendre();
    const formulaire = (await screen.findByRole('heading', { name: 'Nouveau compte' })).closest(
      'form',
    ) as HTMLElement;
    fireEvent.change(within(formulaire).getByLabelText('Nom affiché'), {
      target: { value: 'Nouvelle' },
    });
    fireEvent.change(within(formulaire).getByLabelText('Identifiant'), {
      target: { value: 'nouvelle' },
    });
    fireEvent.change(within(formulaire).getByLabelText(/Mot de passe/), {
      target: { value: 'un-mot-de-passe-solide' },
    });
    fireEvent.change(within(formulaire).getByLabelText('Rôle'), { target: { value: 'lecture' } });
    fireEvent.click(within(formulaire).getByRole('button', { name: 'Créer le compte' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'POST')).toMatchObject({
        url: '/api/utilisateurs',
        corps: {
          identifiant: 'nouvelle',
          nom: 'Nouvelle',
          motDePasse: 'un-mot-de-passe-solide',
          role: 'lecture',
        },
      }),
    );
  });

  it('réinitialise un mot de passe', async () => {
    const appels = simuler();
    rendre();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Nouveau mot de passe pour Vendeuse' }),
    );
    const dialogue = await screen.findByRole('dialog');
    fireEvent.change(within(dialogue).getByLabelText(/Nouveau mot de passe/), {
      target: { value: 'un-autre-mot-de-passe-solide' },
    });
    fireEvent.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(appels.find((a) => a.url === '/api/utilisateurs/u2/mot-de-passe')).toMatchObject({
        methode: 'POST',
        corps: { motDePasse: 'un-autre-mot-de-passe-solide' },
      }),
    );
  });
});
