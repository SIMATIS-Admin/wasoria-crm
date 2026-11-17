// Les droits des comptes. Trois rôles, du plus restreint au plus large :
//  - lecture : consulte tout, ne modifie rien ;
//  - après-vente : comme un commercial, mais ne touche qu'aux affaires du pipe après-vente ;
//  - commercial : crée et modifie les fiches (comptes, contacts, affaires, tâches, rendez-vous, notes),
//    mais ne supprime pas, ne règle ni les étapes, ni les indicateurs, ni les intégrations ;
//  - admin : tout, y compris supprimer, régler le pipe et gérer les comptes.
export const ROLES = ['admin', 'commercial', 'apres-vente', 'lecture'] as const;
export type Role = (typeof ROLES)[number];

export const LIBELLES_ROLE: Record<Role, string> = {
  admin: 'Administrateur',
  commercial: 'Commercial',
  'apres-vente': 'Après-vente',
  lecture: 'Lecture seule',
};

// L'après-vente peut tout ce que peut un commercial, sauf modifier les affaires du pipe de vente
// (vérifié route par route, voir `peutModifierAffaire`).
const RANG: Record<Role, number> = { lecture: 0, 'apres-vente': 1, commercial: 1, admin: 2 };

// Qui peut créer ou modifier une affaire de ce pipe.
export const peutModifierAffaire = (role: Role, pipelineId: string): boolean =>
  role !== 'apres-vente' || pipelineId === 'apres-vente';

export const roleSuffit = (role: Role, requis: Role): boolean => RANG[role] >= RANG[requis];

// Chemin de l'API sans le préfixe /api ni la requête : `/api/affaires/12?x=1` → `/affaires/12`.
export const cheminApi = (url: string): string =>
  (url.split('?')[0] ?? '').replace(/^\/api(?=\/|$)/, '') || '/';

const sous = (chemin: string, base: string) => chemin === base || chemin.startsWith(`${base}/`);

// Le rôle minimal pour appeler cette route.
export function droitRequis(methode: string, chemin: string): Role {
  // Les comptes ne se gèrent qu'entre administrateurs, lecture comprise.
  if (sous(chemin, '/utilisateurs')) return 'admin';
  // Chacun gère sa propre session et son propre mot de passe.
  if (chemin === '/moi' || chemin === '/deconnexion' || chemin === '/moi/mot-de-passe')
    return 'lecture';
  if (methode === 'GET' || methode === 'HEAD') return 'lecture';
  // Réglages et intégrations : le pipe, les indicateurs, la synchro Odoo.
  if (
    sous(chemin, '/etapes') ||
    sous(chemin, '/articles') ||
    sous(chemin, '/demo') ||
    sous(chemin, '/pipelines') ||
    sous(chemin, '/indicateurs') ||
    sous(chemin, '/odoo')
  )
    return 'admin';
  // Supprimer une fiche se répercute sur les outils reliés : réservé aux administrateurs.
  if (methode === 'DELETE') return 'admin';
  return 'commercial';
}
