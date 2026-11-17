import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applique les valeurs par défaut, écritures réelles coupées', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x', API_TOKEN: 'a'.repeat(24) })).toEqual({
      databaseUrl: 'postgres://x',
      apiToken: 'a'.repeat(24),
      trustProxy: false,
      port: 4400,
      realWrites: false,
    });
  });
  it('refuse un jeton trop court', () => {
    expect(() => loadConfig({ DATABASE_URL: 'postgres://x', API_TOKEN: 'court' })).toThrow(
      /API_TOKEN/,
    );
  });
  it('refuse une configuration sans base', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
