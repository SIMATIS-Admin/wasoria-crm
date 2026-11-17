import { describe, expect, it } from 'vitest';
import { chargerConfigOdoo } from './config.js';

describe('chargerConfigOdoo', () => {
  it('renvoie null quand Odoo n’est pas configuré', () => {
    expect(chargerConfigOdoo({})).toBeNull();
    expect(chargerConfigOdoo({ ODOO_URL: '  ' })).toBeNull();
  });

  it('lit une configuration json2 minimale et les champs exclus', () => {
    const c = chargerConfigOdoo({
      ODOO_URL: 'https://exemple.test/web',
      ODOO_API_KEY: 'cle',
      ODOO_CHAMPS_EXCLUS: 'contact.telephone, contact.email',
    });
    expect(c).toMatchObject({ url: 'https://exemple.test', protocole: 'json2', cle: 'cle' });
    expect([...c!.champsExclus]).toEqual(['contact.telephone', 'contact.email']);
  });

  it('exige https, sauf en local', () => {
    expect(() => chargerConfigOdoo({ ODOO_URL: 'http://exemple.test', ODOO_API_KEY: 'c' })).toThrow(
      /https/,
    );
    expect(
      chargerConfigOdoo({ ODOO_URL: 'http://localhost:8069', ODOO_API_KEY: 'c' }),
    ).not.toBeNull();
  });

  it('exige la clé, et base et identifiant en jsonrpc', () => {
    expect(() => chargerConfigOdoo({ ODOO_URL: 'https://exemple.test' })).toThrow(/ODOO_API_KEY/);
    expect(() =>
      chargerConfigOdoo({
        ODOO_URL: 'https://exemple.test',
        ODOO_API_KEY: 'c',
        ODOO_PROTOCOL: 'jsonrpc',
      }),
    ).toThrow(/ODOO_DB/);
  });
});
