import { describe, expect, it } from 'vitest';
import { cheminApi, droitRequis, roleSuffit } from './droits.js';

describe('chemin de l’API', () => {
  it('retire le préfixe et la requête', () => {
    expect(cheminApi('/api/affaires/12?x=1')).toBe('/affaires/12');
    expect(cheminApi('/api')).toBe('/');
    expect(cheminApi('/api/etapes')).toBe('/etapes');
    expect(cheminApi('/apiary/x')).toBe('/apiary/x');
  });
});

describe('rôles', () => {
  it('un rôle plus large peut tout ce que peut un rôle plus restreint', () => {
    expect(roleSuffit('admin', 'commercial')).toBe(true);
    expect(roleSuffit('commercial', 'lecture')).toBe(true);
    expect(roleSuffit('lecture', 'commercial')).toBe(false);
    expect(roleSuffit('commercial', 'admin')).toBe(false);
  });
});

describe('droit requis par route', () => {
  const cas: [string, string, string][] = [
    // lecture : tout se consulte, sauf les comptes
    ['GET', '/affaires', 'lecture'],
    ['GET', '/indicateurs', 'lecture'],
    ['GET', '/echange/affaire', 'lecture'],
    ['GET', '/etapes', 'lecture'],
    // commercial : crée et modifie les fiches
    ['POST', '/affaires', 'commercial'],
    ['PATCH', '/affaires/1', 'commercial'],
    ['PUT', '/affaires/1/liens', 'commercial'],
    ['POST', '/taches/1/terminer', 'commercial'],
    ['PATCH', '/rendez-vous/1', 'commercial'],
    // admin : supprimer, régler le pipe et les indicateurs, intégrations, comptes
    ['DELETE', '/affaires/1', 'admin'],
    ['DELETE', '/contacts/1', 'admin'],
    ['POST', '/etapes', 'admin'],
    ['PUT', '/etapes/ordre', 'admin'],
    ['PATCH', '/etapes/detection', 'admin'],
    ['PATCH', '/indicateurs/delai-devis', 'admin'],
    ['POST', '/odoo/synchro', 'admin'],
    ['GET', '/utilisateurs', 'admin'],
    ['POST', '/utilisateurs', 'admin'],
    ['PATCH', '/utilisateurs/1', 'admin'],
    ['POST', '/utilisateurs/1/mot-de-passe', 'admin'],
    // chacun gère sa session et son mot de passe
    ['GET', '/moi', 'lecture'],
    ['POST', '/deconnexion', 'lecture'],
    ['POST', '/moi/mot-de-passe', 'lecture'],
  ];
  it.each(cas)('%s %s demande le rôle %s', (methode, chemin, attendu) => {
    expect(droitRequis(methode, chemin)).toBe(attendu);
  });
});
