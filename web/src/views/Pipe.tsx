import { useState } from 'react';
import { eur, enRetard, jour, montantOuvert, niveau, parEtape, score } from '../format';
import type { Affaire, Entreprise, Etape, Pipeline } from '../types';
import { useApi } from '../useApi';
import { useRole } from '../role';
import { Chargement, Formulaire, Pill } from '../ui';

export function Pipe() {
  const { role, peutModifierAffaire } = useRole();
  // Le rôle après-vente ouvre directement son pipe.
  const [pipe, setPipe] = useState(role === 'apres-vente' ? 'apres-vente' : 'vente');
  const pipelines = useApi<Pipeline[]>('/pipelines');
  const affaires = useApi<Affaire[]>(`/affaires?ouvertes=1&limite=200&pipeline=${pipe}`);
  const entreprises = useApi<Entreprise[]>('/entreprises?limite=200');
  const etapes = useApi<Etape[]>(`/etapes?pipeline=${pipe}`);
  const peutEcrire = peutModifierAffaire(pipe);
  const [creation, setCreation] = useState(false);
  if (!affaires.donnees || !entreprises.donnees || !etapes.donnees) {
    return <Chargement erreur={affaires.erreur ?? entreprises.erreur ?? etapes.erreur} />;
  }
  const nom = (id: string | null) => entreprises.donnees?.find((e) => e.id === id)?.nom ?? '';

  return (
    <>
      <div className="periode">
        {pipelines.donnees && pipelines.donnees.length > 1 && (
          <div className="seg" role="group" aria-label="Pipe">
            {pipelines.donnees.map((p) => (
              <button
                key={p.id}
                className={pipe === p.id ? 'on' : ''}
                onClick={() => setPipe(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
        {peutEcrire && (
          <button className="cta" onClick={() => setCreation(true)}>
            {pipe === 'vente' ? 'Nouvelle affaire' : 'Nouveau dossier'}
          </button>
        )}
      </div>
      <div className="board-wrap">
        <div className="board" style={{ ['--n' as string]: etapes.donnees.length }}>
          {etapes.donnees.map((etape) => {
            const liste = parEtape(affaires.donnees ?? [], etape.id);
            return (
              <div className="col" key={etape.id}>
                <div className="col-h">
                  <b>{etape.label}</b>
                  <span className="num">{eur(montantOuvert(liste))}</span>
                </div>
                {liste.map((a) => {
                  const n = score(a.qualification);
                  const niv = niveau(n);
                  return (
                    <a className="card" key={a.id} href={`#affaire/${a.id}`}>
                      <div className="t">{a.titre}</div>
                      <div className="small muted">{nom(a.entrepriseId)}</div>
                      <div className="row">
                        <span className="num">{eur(a.montant)}</span>
                        <Pill classe={niv.classe}>{n}/15</Pill>
                      </div>
                      <div className="small muted">{a.prochaineEtape ?? '—'}</div>
                      {a.echeance && (
                        <div className={`small ${enRetard(a.echeance) ? 'late' : 'muted'}`}>
                          Clôture prévue {jour(a.echeance)}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {creation && (
        <Formulaire
          titre={pipe === 'vente' ? 'Nouvelle affaire' : 'Nouveau dossier'}
          chemin="/affaires"
          initial={{ pipeline: pipe }}
          champs={[
            { nom: 'titre', label: 'Titre', requis: true },
            {
              nom: 'etape',
              label: 'Étape',
              type: 'select',
              requis: true,
              options: etapes.donnees.map((e) => ({ id: e.id, label: e.label })),
            },
            {
              nom: 'entrepriseId',
              label: 'Entreprise',
              type: 'select',
              options: [
                { id: '', label: '—' },
                ...entreprises.donnees.map((e) => ({ id: e.id, label: e.nom })),
              ],
            },
            { nom: 'montant', label: 'Montant (€)', type: 'number' },
            { nom: 'echeance', label: 'Échéance', type: 'date' },
          ]}
          termine={() => {
            setCreation(false);
            affaires.recharger();
          }}
          annuler={() => setCreation(false)}
        />
      )}
    </>
  );
}
