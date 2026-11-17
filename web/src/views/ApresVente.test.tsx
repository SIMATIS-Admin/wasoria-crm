// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoleContext, type Role } from '../role';
import { Affaire } from './Affaire';
import { Pipe } from './Pipe';

type Appel = { url: string; methode: string; corps: unknown };

const PIPES = [
  { id: 'vente', label: 'Vente', ordre: 1 },
  { id: 'apres-vente', label: 'Après-vente', ordre: 2 },
];
const ETAPES: Record<string, object[]> = {
  vente: [
    { id: 'detection', label: 'Détection', ordre: 1, probabilite: 10, pipelineId: 'vente' },
    { id: 'negociation', label: 'Négociation', ordre: 2, probabilite: 80, pipelineId: 'vente' },
  ],
  'apres-vente': [
    {
      id: 'installation',
      label: 'Installation',
      ordre: 1,
      probabilite: 100,
      pipelineId: 'apres-vente',
    },
    {
      id: 'suivi-mco',
      label: 'Suivi et MCO',
      ordre: 2,
      probabilite: 100,
      pipelineId: 'apres-vente',
    },
  ],
};
const affaire = (extra: object = {}) => ({
  id: 'a1',
  pipelineId: 'vente',
  origineAffaireId: null,
  entrepriseId: null,
  contactId: null,
  titre: 'Contrat fictif',
  etape: 'negociation',
  montant: 5000,
  echeance: null,
  clos: null,
  motif: null,
  proprietaire: null,
  origine: null,
  prochaineEtape: null,
  qualification: null,
  ...extra,
});

function simuler(fiche: object = affaire()) {
  const appels: Appel[] = [];
  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET';
    appels.push({ url, methode, corps: init?.body ? JSON.parse(init.body as string) : undefined });
    let corps: unknown = [];
    if (url === '/api/pipelines') corps = PIPES;
    else if (url.startsWith('/api/etapes'))
      corps = ETAPES[new URL(url, 'http://x').searchParams.get('pipeline') ?? 'vente'] ?? [];
    else if (url === '/api/affaires/a1') corps = fiche;
    else if (url === '/api/affaires/a1/apres-vente') corps = { id: 'dossier-9' };
    else if (url.startsWith('/api/affaires')) {
      corps = url.includes('pipeline=apres-vente')
        ? [
            affaire({
              id: 'd1',
              pipelineId: 'apres-vente',
              titre: 'Dossier fictif',
              etape: 'suivi-mco',
            }),
          ]
        : [affaire()];
    }
    return Promise.resolve(
      new Response(JSON.stringify(corps), { status: methode === 'POST' ? 201 : 200 }),
    );
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

describe('Pipe : deux pipes', () => {
  it('montre le pipe de vente, puis celui de l’après-vente avec ses étapes et ses dossiers', async () => {
    const appels = simuler();
    render(avec('commercial', <Pipe />));
    expect(await screen.findByText('Contrat fictif')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Après-vente' }));
    expect(await screen.findByText('Dossier fictif')).toBeTruthy();
    expect(screen.getByText('Installation')).toBeTruthy();
    expect(appels.some((a) => a.url.includes('/api/etapes?pipeline=apres-vente'))).toBe(true);
    expect(
      appels.some(
        (a) => a.url.includes('/api/affaires?') && a.url.includes('pipeline=apres-vente'),
      ),
    ).toBe(true);
  });

  it('crée un dossier dans le pipe après-vente', async () => {
    const appels = simuler();
    render(avec('commercial', <Pipe />));
    fireEvent.click(await screen.findByRole('button', { name: 'Après-vente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau dossier' }));
    fireEvent.change(await screen.findByLabelText('Titre'), { target: { value: 'Nouveau suivi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Créer' }));
    await waitFor(() =>
      expect(appels.find((a) => a.methode === 'POST')).toMatchObject({
        url: '/api/affaires',
        corps: { pipeline: 'apres-vente', titre: 'Nouveau suivi', etape: 'installation' },
      }),
    );
  });

  it('le rôle après-vente ouvre son pipe, et ne crée pas de vente', async () => {
    simuler();
    render(avec('apres-vente', <Pipe />));
    expect(await screen.findByText('Dossier fictif')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nouveau dossier' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vente' }));
    expect(await screen.findByText('Contrat fictif')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nouvelle affaire' })).toBeNull();
  });
});

describe('Fiche affaire et après-vente', () => {
  it('une vente gagnée propose d’ouvrir un dossier après-vente', async () => {
    const appels = simuler(affaire({ clos: 'gagne' }));
    render(avec('commercial', <Affaire id="a1" />));
    fireEvent.click(await screen.findByRole('button', { name: 'Créer le dossier après-vente' }));
    await waitFor(() =>
      expect(appels.find((a) => a.url === '/api/affaires/a1/apres-vente')).toMatchObject({
        methode: 'POST',
      }),
    );
    await waitFor(() => expect(window.location.hash).toBe('#affaire/dossier-9'));
  });

  it('une vente non gagnée, ou un dossier, ne le propose pas', async () => {
    simuler(affaire());
    render(avec('commercial', <Affaire id="a1" />));
    await screen.findByText('Contrat fictif');
    expect(screen.queryByRole('button', { name: 'Créer le dossier après-vente' })).toBeNull();
  });

  it('un dossier après-vente montre son pipe, son étape et sa vente d’origine', async () => {
    simuler(
      affaire({
        pipelineId: 'apres-vente',
        etape: 'suivi-mco',
        origineAffaireId: 'v0',
        titre: 'Dossier fictif',
      }),
    );
    render(avec('commercial', <Affaire id="a1" />));
    expect(await screen.findByRole('button', { name: 'Suivi et MCO' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Installation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Détection' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Vente d’origine' }).getAttribute('href')).toBe(
      '#affaire/v0',
    );
  });

  it('le rôle après-vente ne peut pas déplacer une vente', async () => {
    simuler(affaire());
    render(avec('apres-vente', <Affaire id="a1" />));
    const etape = await screen.findByRole('button', { name: 'Détection' });
    expect((etape as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Marquer gagnée' })).toBeNull();
  });
});
