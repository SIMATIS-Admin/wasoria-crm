// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoutonDemo } from './Demo';
import { RoleContext, type Role } from './role';

type Appel = { url: string; methode: string };
function simuler(actif: boolean, refus = false) {
  const appels: Appel[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    appels.push({ url, methode });
    if (methode === 'POST' && refus) {
      return Promise.resolve(
        new Response(JSON.stringify({ erreur: 'Le mode démonstration n’est pas actif' }), {
          status: 404,
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(methode === 'GET' ? { actif } : { charge: true }), {
        status: 200,
      }),
    );
  });
  return appels;
}
const rendre = (role: Role, recharger = () => undefined) =>
  render(
    <RoleContext.Provider value={role}>
      <BoutonDemo recharger={recharger} />
    </RoleContext.Provider>,
  );

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Bouton Démo', () => {
  it('s’affiche pour un administrateur quand le mode démonstration est actif', async () => {
    simuler(true);
    rendre('admin');
    expect(await screen.findByRole('button', { name: 'Démo' })).toBeTruthy();
  });

  it('reste caché sur un serveur sans mode démonstration', async () => {
    const appels = simuler(false);
    rendre('admin');
    await waitFor(() => expect(appels.some((a) => a.url === '/api/demo')).toBe(true));
    expect(screen.queryByRole('button', { name: 'Démo' })).toBeNull();
  });

  it('reste caché, sans même interroger le serveur, pour qui n’est pas administrateur', async () => {
    const appels = simuler(true);
    rendre('commercial');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('button', { name: 'Démo' })).toBeNull();
    expect(appels).toHaveLength(0);
  });

  it('demande confirmation avant d’effacer, puis charge et recharge la page', async () => {
    const appels = simuler(true);
    const recharger = vi.fn();
    rendre('admin', recharger);
    fireEvent.click(await screen.findByRole('button', { name: 'Démo' }));
    expect(screen.getByText(/sont\s+remplacées par les données fictives/)).toBeTruthy();
    expect(appels.some((a) => a.methode === 'POST')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remplacer par le scénario' }));
    await waitFor(() => expect(recharger).toHaveBeenCalledTimes(1));
    expect(appels.find((a) => a.methode === 'POST')?.url).toBe('/api/demo/charger');
  });

  it('annuler ne charge rien', async () => {
    const appels = simuler(true);
    rendre('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Démo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(appels.some((a) => a.methode === 'POST')).toBe(false);
  });

  it('affiche le refus du serveur', async () => {
    simuler(true, true);
    rendre('admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Démo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remplacer par le scénario' }));
    expect(await screen.findByText('Le mode démonstration n’est pas actif')).toBeTruthy();
  });
});
