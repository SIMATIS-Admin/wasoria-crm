// TEMPORAIRE : le bouton « Démo », qui recharge le scénario de démonstration. À retirer avec
// src/demo/routes.ts (voir le commentaire de ce fichier) et son usage dans App.tsx.
import { useState } from 'react';
import { appel, ErreurApi } from './api';
import { useRole } from './role';
import { useApi } from './useApi';

export function BoutonDemo({
  recharger = () => window.location.reload(),
}: {
  recharger?: () => void;
}) {
  const { estAdmin } = useRole();
  // Seulement sur un serveur lancé en mode démonstration, et pour les administrateurs.
  const etat = useApi<{ actif: boolean }>(estAdmin ? '/demo' : null);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  if (!estAdmin || !etat.donnees?.actif) return null;

  async function charger() {
    setEnvoi(true);
    setErreur(null);
    try {
      await appel('POST', '/demo/charger', {});
      recharger();
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Chargement impossible');
      setEnvoi(false);
    }
  }

  return (
    <>
      <button className="ghost bouton-demo" onClick={() => setOuvert(true)}>
        Démo
      </button>
      {ouvert && (
        <div
          className="voile"
          role="dialog"
          aria-modal="true"
          aria-label="Charger le scénario de démonstration"
        >
          <div className="panel dialogue">
            <div className="panel-h">
              <h2>Charger le scénario de démonstration</h2>
            </div>
            <div className="panel-b form">
              <p className="small">
                Toutes les données (comptes clients, contacts, affaires, tâches, rendez-vous, devis,
                catalogue) sont remplacées par les données fictives du scénario, et les étapes et
                indicateurs reviennent à leur état de départ. Les comptes utilisateurs sont
                conservés.
              </p>
              {erreur && <div className="alert">{erreur}</div>}
              <div className="actions">
                <button className="ghost" onClick={() => setOuvert(false)} disabled={envoi}>
                  Annuler
                </button>
                <button className="cta" onClick={() => void charger()} disabled={envoi}>
                  {envoi ? 'Chargement…' : 'Remplacer par le scénario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
