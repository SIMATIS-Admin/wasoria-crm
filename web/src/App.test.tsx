// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, lireRoute } from './App';

const reponse = (corps: unknown) =>
  Promise.resolve(new Response(JSON.stringify(corps), { status: 200 }));

beforeEach(() => {
  window.scrollTo = () => undefined;
  sessionStorage.clear();
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

describe('App', () => {
  it('demande le jeton, puis affiche le pipe avec les affaires reçues', async () => {
    const fetchSimule = vi.fn((url: string) => {
      if (url.startsWith('/api/affaires')) {
        return reponse([
          {
            id: '1',
            titre: 'Affaire fictive',
            etape: 'proposition',
            montant: 5000,
            qualification: null,
          },
        ]);
      }
      return reponse([]);
    });
    vi.stubGlobal('fetch', fetchSimule);
    window.location.hash = '#pipe';

    render(<App />);
    fireEvent.change(screen.getByLabelText('Jeton d’accès'), { target: { value: 'un-jeton' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrer' }));

    await waitFor(() => expect(screen.getByText('Affaire fictive')).toBeTruthy());
    const [, options] = fetchSimule.mock.calls[0] as unknown as [string, RequestInit];
    expect((options.headers as Record<string, string>).authorization).toBe('Bearer un-jeton');
  });

  it('revient à la saisie du jeton quand l’API le refuse', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('{}', { status: 401 })));
    sessionStorage.setItem('wasoria-crm-jeton', 'faux');
    render(<App />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrer' })).toBeTruthy());
  });
});
