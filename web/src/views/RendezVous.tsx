import { useState } from 'react';
import { appel } from '../api';
import { jourHeure } from '../format';
import type { RendezVous as TRdv } from '../types';
import { useApi } from '../useApi';
import { Chargement, Formulaire } from '../ui';

const STATUTS = [
  { id: 'a_trier', label: 'À trier' },
  { id: 'rdv', label: 'Rendez-vous' },
  { id: 'ignore', label: 'Ignoré' },
];

export function RendezVous() {
  const liste = useApi<TRdv[]>('/rendez-vous?limite=200');
  const [creation, setCreation] = useState(false);
  if (!liste.donnees) return <Chargement erreur={liste.erreur} />;

  const classer = async (id: string, statut: string) => {
    await appel('PATCH', `/rendez-vous/${id}`, { statut });
    liste.recharger();
  };

  return (
    <>
      <div>
        <button className="cta" onClick={() => setCreation(true)}>
          Nouveau rendez-vous
        </button>
      </div>
      <div className="panel">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Quand</th>
                <th>Rendez-vous</th>
                <th>Lieu</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {liste.donnees.map((r) => (
                <tr key={r.id}>
                  <td className="num muted">{jourHeure(r.debut)}</td>
                  <td>{r.titre}</td>
                  <td className="muted">{r.lieu ?? '—'}</td>
                  <td>
                    <select
                      aria-label={`Statut de ${r.titre}`}
                      value={r.statut}
                      onChange={(e) => void classer(r.id, e.target.value)}
                    >
                      {STATUTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {creation && (
        <Formulaire
          titre="Nouveau rendez-vous"
          chemin="/rendez-vous"
          initial={{ statut: 'rdv' }}
          champs={[
            { nom: 'titre', label: 'Titre', requis: true },
            { nom: 'debut', label: 'Début', type: 'datetime-local', requis: true },
            { nom: 'fin', label: 'Fin', type: 'datetime-local' },
            { nom: 'lieu', label: 'Lieu' },
          ]}
          termine={() => {
            setCreation(false);
            liste.recharger();
          }}
          annuler={() => setCreation(false)}
        />
      )}
    </>
  );
}
