import { useCallback, useEffect, useState } from 'react';
import { lire } from './api';

// Charge une ressource ; `recharger` la relit après une modification.
export function useApi<T>(chemin: string | null) {
  const [donnees, setDonnees] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (chemin === null) return;
    let actif = true;
    lire<T>(chemin).then(
      (d) => {
        if (!actif) return;
        setDonnees(d);
        setErreur(null);
      },
      (e: unknown) => {
        if (actif) setErreur(e instanceof Error ? e.message : 'Erreur');
      },
    );
    return () => {
      actif = false;
    };
  }, [chemin, version]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  return { donnees, erreur, recharger };
}
