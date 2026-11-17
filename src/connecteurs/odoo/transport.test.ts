import { describe, expect, it, vi } from 'vitest';
import type { OdooConfig } from './config.js';
import { ErreurOdoo, transportJson2, transportJsonRpc } from './transport.js';

const config = (p: Partial<OdooConfig> = {}): OdooConfig => ({
  url: 'https://exemple.test',
  protocole: 'json2',
  cle: 'cle-secrete',
  champsExclus: new Set(),
  ...p,
});
const json = (corps: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corps), { status }));
const options = {
  domaine: [['is_company', '=', true]],
  champs: ['name'],
  limite: 10,
  decalage: 0,
  ordre: 'id',
};

describe('transport JSON-2', () => {
  it('appelle search_read avec le jeton Bearer et la base', async () => {
    const f = vi.fn(() => json([{ id: 1, name: 'A' }]));
    const t = transportJson2(config({ base: 'ma-base' }), f);
    expect(await t.searchRead('res.partner', options)).toEqual([{ id: 1, name: 'A' }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://exemple.test/json/2/res.partner/search_read');
    expect(init.headers).toMatchObject({
      authorization: 'bearer cle-secrete',
      'x-odoo-database': 'ma-base',
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      domain: options.domaine,
      fields: ['name'],
      limit: 10,
    });
  });

  it('remonte le message d’Odoo sans la clé', async () => {
    const t = transportJson2(config(), () => json({ message: 'Accès refusé' }, 403));
    const e = await t.searchRead('res.partner', options).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurOdoo);
    expect((e as Error).message).toContain('Accès refusé');
    expect((e as Error).message).not.toContain('cle-secrete');
  });

  it('refuse une réponse illisible', async () => {
    const t = transportJson2(config(), () =>
      Promise.resolve(new Response('<html>', { status: 502 })),
    );
    await expect(t.verifier()).rejects.toThrow(/illisible/);
  });
});

describe('transport JSON-RPC', () => {
  const cfg = config({ protocole: 'jsonrpc', base: 'b', identifiant: 'moi@exemple.test' });

  it('s’authentifie une fois puis lit avec execute_kw', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => {
      const p = (JSON.parse(init.body as string) as { params: { method: string } }).params;
      return json({ result: p.method === 'authenticate' ? 7 : [{ id: 2 }] });
    });
    const t = transportJsonRpc(cfg, f as unknown as typeof fetch);
    await t.searchRead('res.partner', options);
    await t.searchRead('res.partner', options);
    expect(f).toHaveBeenCalledTimes(3);
    const lecture = JSON.parse(f.mock.calls[1]![1].body as string) as {
      params: { args: unknown[] };
    };
    expect(lecture.params.args.slice(0, 5)).toEqual([
      'b',
      7,
      'cle-secrete',
      'res.partner',
      'search_read',
    ]);
  });

  it('signale des identifiants refusés', async () => {
    const t = transportJsonRpc(cfg, () => json({ result: false }));
    await expect(t.verifier()).rejects.toThrow(/identifiants/);
  });

  it('remonte une erreur Odoo', async () => {
    const t = transportJsonRpc(cfg, () => json({ error: { data: { message: 'Boom' } } }));
    await expect(t.verifier()).rejects.toThrow(/Boom/);
  });
});
