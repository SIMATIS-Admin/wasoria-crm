import { useState } from 'react';
import { appel } from '../api';
import { TYPES_TACHE, libelleType } from '../etapes';
import { enRetard, jourHeure } from '../format';
import type { Affaire, Tache } from '../types';
import { useApi } from '../useApi';
import { useRole } from '../role';
import { Chargement, Formulaire } from '../ui';

export function Taches() {
  const taches = useApi<Tache[]>('/taches?ouvertes=1&limite=200');
  const affaires = useApi<Affaire[]>('/affaires?limite=200');
  const { peutEcrire } = useRole();
  const [creation, setCreation] = useState(false);
  if (!taches.donnees) return <Chargement erreur={taches.erreur} />;
  const titre = (id: string | null) => affaires.donnees?.find((a) => a.id === id)?.titre;

  const terminer = async (id: string) => {
    await appel('POST', `/taches/${id}/terminer`);
    taches.recharger();
  };

  return (
    <>
      {peutEcrire && (
        <div>
          <button className="cta" onClick={() => setCreation(true)}>
            Nouvelle tâche
          </button>
        </div>
      )}
      <div className="panel">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Échéance</th>
                <th>Tâche</th>
                <th>Type</th>
                <th>Affaire</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {taches.donnees.map((t) => (
                <tr key={t.id}>
                  <td className={`num ${enRetard(t.echeance) ? 'late' : 'muted'}`}>
                    {jourHeure(t.echeance)}
                  </td>
                  <td>{t.titre}</td>
                  <td className="muted">{libelleType(t.type)}</td>
                  <td>
                    {t.opportuniteId && (
                      <a className="link" href={`#affaire/${t.opportuniteId}`}>
                        {titre(t.opportuniteId) ?? 'Affaire'}
                      </a>
                    )}
                  </td>
                  <td>
                    {peutEcrire && (
                      <button className="ghost" onClick={() => void terminer(t.id)}>
                        Terminer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {taches.donnees.length === 0 && (
                <tr>
                  <td className="muted">Aucune tâche ouverte.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {creation && (
        <Formulaire
          titre="Nouvelle tâche"
          chemin="/taches"
          champs={[
            { nom: 'titre', label: 'Titre', requis: true },
            {
              nom: 'type',
              label: 'Type',
              type: 'select',
              options: TYPES_TACHE.map((t) => ({ id: t.id, label: t.label })),
            },
            { nom: 'echeance', label: 'Échéance', type: 'datetime-local' },
          ]}
          termine={() => {
            setCreation(false);
            taches.recharger();
          }}
          annuler={() => setCreation(false)}
        />
      )}
    </>
  );
}
