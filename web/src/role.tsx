import { createContext, useContext } from 'react';

export type Role = 'admin' | 'commercial' | 'lecture';

export const LIBELLES_ROLE: Record<Role, string> = {
  admin: 'Administrateur',
  commercial: 'Commercial',
  lecture: 'Lecture seule',
};

export const RoleContext = createContext<Role>('lecture');

// Ce que la personne connectée peut faire. L'interface masque les actions interdites, mais c'est le
// serveur qui décide : un appel interdit y reçoit de toute façon un refus.
export function useRole() {
  const role = useContext(RoleContext);
  return { role, peutEcrire: role !== 'lecture', estAdmin: role === 'admin' };
}
