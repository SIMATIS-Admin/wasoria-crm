import { describe, expect, it } from 'vitest';
import { champsDemandes, domaineDe, versContact, versEntreprise } from './mapping.js';

describe('mapping Odoo', () => {
  it('extrait le domaine d’un site web', () => {
    expect(domaineDe('https://www.exemple.test/accueil')).toBe('exemple.test');
    expect(domaineDe('exemple.test')).toBe('exemple.test');
    expect(domaineDe(false)).toBeNull();
  });

  it('traduit un partenaire société, false devenant null', () => {
    expect(
      versEntreprise(
        {
          name: ' Société Test ',
          city: false,
          website: 'https://exemple.test',
          industry_id: [3, 'Industrie'],
        },
        new Set(),
      ),
    ).toEqual({ nom: 'Société Test', ville: null, domaine: 'exemple.test', secteur: 'Industrie' });
    expect(versEntreprise({ name: false }, new Set())).toBeNull();
  });

  it('traduit un contact, le mobile remplaçant un téléphone vide', () => {
    expect(
      versContact(
        {
          name: 'Alex',
          function: 'DG',
          email: 'a@exemple.test',
          phone: false,
          mobile: '0600000000',
        },
        new Set(),
      ),
    ).toEqual({ nom: 'Alex', fonction: 'DG', email: 'a@exemple.test', telephone: '0600000000' });
  });

  it('un champ exclu n’est ni demandé ni écrit', () => {
    const exclus = new Set(['contact.telephone']);
    expect(champsDemandes('contact', exclus)).not.toContain('phone');
    expect(champsDemandes('contact', exclus)).not.toContain('mobile');
    expect(versContact({ name: 'A', phone: '1' }, exclus)).not.toHaveProperty('telephone');
    expect(champsDemandes('contact', new Set())).toContain('phone');
  });
});
