import { useState } from 'react';
import { appel, ErreurApi } from '../api';
import { TYPES_TACHE, libelleType } from '../etapes';
import { CRITERES, eur, enRetard, jour, niveau, score } from '../format';
import type {
  Activite,
  Affaire as TAffaire,
  Contact,
  Entreprise,
  Etape,
  Qualification,
  Tache,
} from '../types';
import { useApi } from '../useApi';
import { useRole } from '../role';
import { Chargement, Formulaire, Panel, Pill } from '../ui';

type Onglet = 'suivi' | 'qualif' | 'contacts';

export function Affaire({ id }: { id: string }) {
  const affaire = useApi<TAffaire>(`/affaires/${id}`);
  const entreprise = useApi<Entreprise>(
    affaire.donnees?.entrepriseId ? `/entreprises/${affaire.donnees.entrepriseId}` : null,
  );
  const contacts = useApi<Contact[]>(
    affaire.donnees?.entrepriseId ? `/contacts?entrepriseId=${affaire.donnees.entrepriseId}` : null,
  );
  const etapes = useApi<Etape[]>(
    affaire.donnees ? `/etapes?pipeline=${affaire.donnees.pipelineId}` : null,
  );
  const taches = useApi<Tache[]>(`/taches?opportuniteId=${id}&limite=100`);
  const activites = useApi<Activite[]>(`/activites?opportuniteId=${id}`);
  const { peutEcrire, peutModifierAffaire } = useRole();
  const [message, setMessage] = useState<string | null>(null);
  const [onglet, setOnglet] = useState<Onglet>('suivi');
  const [creation, setCreation] = useState(false);

  const a = affaire.donnees;
  if (!a || !etapes.donnees) return <Chargement erreur={affaire.erreur ?? etapes.erreur} />;
  const editable = peutModifierAffaire(a.pipelineId);
  const indice = etapes.donnees.findIndex((e) => e.id === a.etape);
  const n = score(a.qualification);
  const niv = niveau(n);

  const modifier = async (corps: object) => {
    await appel('PATCH', `/affaires/${id}`, corps);
    affaire.recharger();
  };
  const terminer = async (tacheId: string) => {
    await appel('POST', `/taches/${tacheId}/terminer`);
    taches.recharger();
    affaire.recharger();
  };
  const noter = (cle: keyof Qualification, valeur: number) =>
    modifier({
      qualification: {
        besoin: 0,
        decideur: 0,
        budget: 0,
        timing: 0,
        engagement: 0,
        ...a.qualification,
        [cle]: valeur,
      },
    });

  // Une vente gagnée ouvre un dossier après-vente : on s'y rend, ou on y est déjà.
  const creerDossier = async () => {
    setMessage(null);
    try {
      const d = await appel<{ id: string }>('POST', `/affaires/${id}/apres-vente`, {});
      window.location.hash = `affaire/${d.id}`;
    } catch (e) {
      setMessage(e instanceof ErreurApi ? e.message : 'Création impossible');
    }
  };

  return (
    <>
      <div>
        <a className="link" href="#pipe">
          ← Pipe
        </a>
        <h2 className="titre-fiche">
          {a.titre} {a.pipelineId === 'apres-vente' && <Pill classe="p-acc">Après-vente</Pill>}{' '}
          {a.clos && (
            <Pill classe={a.clos === 'gagne' ? 'p-ok' : 'p-cold'}>
              {a.clos === 'gagne' ? 'Gagnée' : 'Perdue'}
            </Pill>
          )}
        </h2>
        {entreprise.donnees && (
          <a className="link" href="#comptes">
            {entreprise.donnees.nom}
          </a>
        )}
        {a.origineAffaireId && (
          <>
            {' · '}
            <a className="link" href={`#affaire/${a.origineAffaireId}`}>
              Vente d’origine
            </a>
          </>
        )}
      </div>
      <div className="stepper">
        {etapes.donnees.map((e, i) => (
          <button
            key={e.id}
            className={`step ${i < indice ? 'done' : i === indice ? 'cur' : ''}`}
            disabled={!editable}
            onClick={() => void modifier({ etape: e.id })}
          >
            {e.label}
          </button>
        ))}
      </div>
      <div className="split">
        <section className="panel">
          <div className="tabs" role="tablist">
            {(
              [
                ['suivi', 'Suivi'],
                ['qualif', 'Qualification'],
                ['contacts', 'Contacts'],
              ] as [Onglet, string][]
            ).map(([cle, label]) => (
              <button
                key={cle}
                role="tab"
                aria-selected={onglet === cle}
                className={`tab ${onglet === cle ? 'on' : ''}`}
                onClick={() => setOnglet(cle)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="panel-b">
            {onglet === 'suivi' && (
              <div className="list">
                {peutEcrire && (
                  <div>
                    <button className="ghost" onClick={() => setCreation(true)}>
                      Nouvelle tâche
                    </button>
                  </div>
                )}
                {taches.donnees?.map((t) => (
                  <div className="item ligne" key={t.id}>
                    <div>
                      <b className={t.faitAt ? 'fait' : ''}>{t.titre}</b>
                      <div
                        className={`small ${!t.faitAt && enRetard(t.echeance) ? 'late' : 'muted'}`}
                      >
                        {libelleType(t.type)} · {jour(t.echeance)}
                      </div>
                    </div>
                    {!t.faitAt && peutEcrire && (
                      <button className="ghost" onClick={() => void terminer(t.id)}>
                        Terminer
                      </button>
                    )}
                  </div>
                ))}
                {activites.donnees?.map((x) => (
                  <div className="item" key={x.id}>
                    <span className="small muted">{jour(x.at)}</span>
                    <span>
                      {x.titre}
                      {x.resume ? ` — ${x.resume}` : ''}
                    </span>
                  </div>
                ))}
                {taches.donnees?.length === 0 && activites.donnees?.length === 0 && (
                  <span className="muted">Aucun suivi pour le moment.</span>
                )}
              </div>
            )}
            {onglet === 'qualif' && (
              <>
                <div className="score">
                  <div className={`big ${niv.classe === 'p-hot' ? 'late' : ''}`}>
                    {n}
                    <span className="muted" style={{ fontSize: 16 }}>
                      /15
                    </span>
                  </div>
                  <Pill classe={niv.classe}>{niv.label}</Pill>
                </div>
                {CRITERES.map(([cle, label]) => (
                  <div className="q" key={cle}>
                    <label htmlFor={`q-${cle}`}>{label}</label>
                    <input
                      id={`q-${cle}`}
                      type="range"
                      min={0}
                      max={3}
                      value={a.qualification?.[cle] ?? 0}
                      disabled={!editable}
                      onChange={(e) => void noter(cle, Number(e.target.value))}
                    />
                    <b className="num">{a.qualification?.[cle] ?? 0}/3</b>
                  </div>
                ))}
              </>
            )}
            {onglet === 'contacts' && (
              <div className="list">
                {contacts.donnees?.map((c) => (
                  <div className="item" key={c.id}>
                    <b>{c.nom}</b>
                    <span className="small muted">
                      {[c.fonction, c.email].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
                {contacts.donnees?.length === 0 && <span className="muted">Aucun contact.</span>}
              </div>
            )}
          </div>
        </section>
        <div className="grid">
          <Panel>
            <div className="fields">
              <Champ label="Montant" valeur={eur(a.montant)} />
              <Champ label="Échéance" valeur={jour(a.echeance)} />
              <Champ label="Origine" valeur={a.origine ?? '—'} />
              <Champ label="Suivie par" valeur={a.proprietaire ?? '—'} />
              <Champ label="Prochaine action" valeur={a.prochaineEtape ?? '—'} />
            </div>
          </Panel>
          <div className="actions">
            {!editable ? null : a.clos ? (
              <button className="ghost" onClick={() => void modifier({ clos: null })}>
                Rouvrir
              </button>
            ) : (
              <>
                <button className="cta" onClick={() => void modifier({ clos: 'gagne' })}>
                  Marquer gagnée
                </button>
                <button className="ghost" onClick={() => void modifier({ clos: 'perdu' })}>
                  Marquer perdue
                </button>
              </>
            )}
          </div>
          {peutEcrire && a.pipelineId === 'vente' && a.clos === 'gagne' && (
            <div className="actions">
              <button className="cta" onClick={() => void creerDossier()}>
                Créer le dossier après-vente
              </button>
            </div>
          )}
          {message && <div className="alert">{message}</div>}
        </div>
      </div>
      {creation && (
        <Formulaire
          titre="Nouvelle tâche"
          chemin="/taches"
          initial={{ opportuniteId: id }}
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

const Champ = ({ label, valeur }: { label: string; valeur: string }) => (
  <div className="field">
    <span className="lbl">{label}</span>
    <span className="v">{valeur}</span>
  </div>
);
