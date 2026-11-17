// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonCompte } from './MonCompte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Mon compte', () => {
  it('montre le rôle et change le mot de passe avec l’actuel', async () => {
    const fetchSimule = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fetchSimule);
    const fermer = vi.fn();
    render(<MonCompte nom="Marc" role="commercial" fermer={fermer} />);
    expect(screen.getByText('Rôle : Commercial')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), {
      target: { value: 'ancien-mot-de-passe-1' },
    });
    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/), {
      target: { value: 'nouveau-mot-de-passe-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByText(/Mot de passe changé/)).toBeTruthy();
    const [url, init] = fetchSimule.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/moi/mot-de-passe');
    expect(JSON.parse(init.body as string)).toEqual({
      actuel: 'ancien-mot-de-passe-1',
      nouveau: 'nouveau-mot-de-passe-2',
    });
  });

  it('affiche le refus quand le mot de passe actuel est faux', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(JSON.stringify({ erreur: 'Le mot de passe actuel est incorrect' }), {
          status: 401,
        }),
      ),
    );
    render(<MonCompte nom="Marc" role="lecture" fermer={() => undefined} />);
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), {
      target: { value: 'pas-le-bon-mot-de-passe' },
    });
    fireEvent.change(screen.getByLabelText(/Nouveau mot de passe/), {
      target: { value: 'nouveau-mot-de-passe-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    await waitFor(() =>
      expect(screen.getByText('Le mot de passe actuel est incorrect')).toBeTruthy(),
    );
  });
});
