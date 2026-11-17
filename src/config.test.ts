import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applique les valeurs par défaut, écritures réelles coupées', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://x' })).toEqual({
      databaseUrl: 'postgres://x',
      port: 4400,
      realWrites: false,
    });
  });
  it('refuse une configuration sans base', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
