import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('/health', () => {
  it('répond 200 quand la base répond', async () => {
    const app = buildApp({ pingDb: () => Promise.resolve(), version: '1.2.3' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', version: '1.2.3', database: 'ok' });
  });

  it('répond 503 quand la base ne répond pas', async () => {
    const app = buildApp({ pingDb: () => Promise.reject(new Error('down')), version: '1.2.3' });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({ status: 'degraded', database: 'error' });
  });
});
