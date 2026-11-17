// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, lireRoute } from './App';

beforeEach(() => {
  window.scrollTo = () => undefined;
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('lit la vue et l’identifiant dans l’ancre', () => {
    expect(lireRoute('')).toEqual({ vue: 'accueil', id: undefined });
    expect(lireRoute('#pipe')).toEqual({ vue: 'pipe', id: undefined });
    expect(lireRoute('#affaire/abc')).toEqual({ vue: 'affaire', id: 'abc' });
  });
});

const json = (corps: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corps), { status }));

describe('App', () => {
  it('propose de créer le premier compte tant qu’il n’y en a aucun', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url === '/api/etat' ? json({ installe: false }) : json({ erreur: 'Connexion requise' }, 401),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByText('Créer le premier compte')).toBeTruthy());
    expect(screen.getByLabelText('Jeton d’installation')).toBeTruthy();
  });

  it('se connecte par identifiant et mot de passe, puis affiche le pipe', async () => {
    let connecte = false;
    const fetchSimule = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/moi') {
        return connecte
          ? json({ utilisateur: { id: '1', identifiant: 'marc', nom: 'Marc' } })
          : json({ erreur: 'Connexion requise' }, 401);
      }
      if (url === '/api/etat') return json({ installe: true });
      if (url === '/api/connexion') {
        connecte = true;
        return json({ utilisateur: { id: '1', identifiant: 'marc', nom: 'Marc' } });
      }
      if (url.startsWith('/api/affaires')) {
        return json([
          {
            id: '1',
            titre: 'Affaire fictive',
            etape: 'proposition',
            montant: 5000,
            qualification: null,
          },
        ]);
      }
      void init;
      return json([]);
    });
    vi.stubGlobal('fetch', fetchSimule);
    window.location.hash = '#pipe';

    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'marc' } });
    fireEvent.change(screen.getByLabelText('Mot de passe'), {
      target: { value: 'un-mot-de-passe-solide' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => expect(screen.getByText('Affaire fictive')).toBeTruthy());
    const appelConnexion = fetchSimule.mock.calls.find((c) => c[0] === '/api/connexion')!;
    expect(JSON.parse(appelConnexion[1]!.body as string)).toEqual({
      identifiant: 'marc',
      motDePasse: 'un-mot-de-passe-solide',
    });
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeTruthy();
  });

  it('revient à la connexion quand la session expire', async () => {
    vi.stubGlobal('fetch', (url: string) =>
      url === '/api/moi'
        ? json({ erreur: 'x' }, 401)
        : url === '/api/etat'
          ? json({ installe: true })
          : json([]),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Se connecter' })).toBeTruthy());
  });
});
