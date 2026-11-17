import { useState, type FormEvent } from 'react';
import { appel, ErreurApi } from '../api';
import type { Etape } from '../types';
import { useApi } from '../useApi';
import { useRole } from '../role';
import { Chargement, Panel } from '../ui';

type Suppression = { etape: Etape; affaires: number };

export function Etapes() {
  const { estAdmin } = useRole();
  const liste = useApi<Etape[]>('/etapes');
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<Suppression | null>(null);
  if (!estAdmin) return <p className="muted">Réservé aux administrateurs.</p>;
  if (!liste.donnees) return <Chargement erreur={liste.erreur} />;
  const etapes = liste.donnees;

  // Une action sur le serveur, puis on relit la liste ; un refus s'affiche tel quel.
  async function agir(action: () => Promise<unknown>) {
    setErreur(null);
    try {
      await action();
      liste.recharger();
    } catch (e) {
      setErreur(
        e instanceof ErreurApi ? [e.message, ...e.details].join(' — ') : 'Action impossible',
      );
      liste.recharger();
    }
  }

  const deplacer = (i: number, sens: -1 | 1) => {
    const ids = etapes.map((e) => e.id);
    const j = i + sens;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void agir(() => appel('PUT', '/etapes/ordre', { ids }));
  };

  async function supprimer(e: Etape, vers?: string) {
    setErreur(null);
    try {
      await appel('DELETE', `/etapes/${e.id}${vers ? `?vers=${encodeURIComponent(vers)}` : ''}`);
      setSuppression(null);
      liste.recharger();
    } catch (err) {
      if (err instanceof ErreurApi && err.statut === 409 && !vers) {
        const n = Number(/^(\d+)/.exec(err.message)?.[1] ?? 0);
        if (n > 0) {
          setSuppression({ etape: e, affaires: n });
          return;
        }
      }
      setErreur(err instanceof ErreurApi ? err.message : 'Suppression impossible');
    }
  }

  function ajouter(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const d = new FormData(form);
    const label = d.get('label');
    const prob = d.get('probabilite');
    if (typeof label !== 'string' || !label.trim()) return;
    void agir(async () => {
      await appel('POST', '/etapes', {
        label: label.trim(),
        ...(typeof prob === 'string' && prob !== '' ? { probabilite: Number(prob) } : {}),
      });
      form.reset();
    });
  }

  return (
    <>
      <p className="muted small">
        Les colonnes du pipe, dans l’ordre. La probabilité sert au montant pondéré de l’accueil. Une
        étape garde son identifiant quand on la renomme.
      </p>
      {erreur && <div className="alert">{erreur}</div>}
      <Panel titre="Étapes du pipe">
        <div className="list">
          {etapes.map((e, i) => (
            <div className="ligne-etape" key={e.id}>
              <span className="num muted">{i + 1}</span>
              <input
                aria-label={`Nom de l’étape ${e.label}`}
                defaultValue={e.label}
                maxLength={60}
                onBlur={(ev) => {
                  const v = ev.target.value.trim();
                  if (v && v !== e.label)
                    void agir(() => appel('PATCH', `/etapes/${e.id}`, { label: v }));
                  else ev.target.value = e.label;
                }}
              />
              <label className="prob">
                <input
                  aria-label={`Probabilité de ${e.label}`}
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={e.probabilite}
                  onBlur={(ev) => {
                    const v = Number(ev.target.value);
                    if (ev.target.value !== '' && v !== e.probabilite) {
                      void agir(() => appel('PATCH', `/etapes/${e.id}`, { probabilite: v }));
                    }
                  }}
                />
                <span className="muted">%</span>
              </label>
              <button
                className="ghost"
                aria-label={`Monter ${e.label}`}
                disabled={i === 0}
                onClick={() => deplacer(i, -1)}
              >
                ↑
              </button>
              <button
                className="ghost"
                aria-label={`Descendre ${e.label}`}
                disabled={i === etapes.length - 1}
                onClick={() => deplacer(i, 1)}
              >
                ↓
              </button>
              <button
                className="ghost"
                aria-label={`Supprimer ${e.label}`}
                onClick={() => void supprimer(e)}
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </Panel>
      <form className="panel" onSubmit={ajouter}>
        <div className="panel-b ligne-ajout">
          <label className="champ">
            <span className="lbl">Nouvelle étape</span>
            <input name="label" maxLength={60} required />
          </label>
          <label className="champ">
            <span className="lbl">Probabilité (%)</span>
            <input name="probabilite" type="number" min={0} max={100} placeholder="50" />
          </label>
          <button className="cta" type="submit">
            Ajouter
          </button>
        </div>
      </form>
      {suppression && (
        <div className="voile" role="dialog" aria-modal="true" aria-label="Supprimer une étape">
          <form
            className="panel dialogue"
            onSubmit={(ev) => {
              ev.preventDefault();
              const vers = new FormData(ev.currentTarget).get('vers');
              if (typeof vers === 'string' && vers) void supprimer(suppression.etape, vers);
            }}
          >
            <div className="panel-h">
              <h2>Supprimer « {suppression.etape.label} »</h2>
            </div>
            <div className="panel-b form">
              <p className="small">
                {suppression.affaires} affaire{suppression.affaires > 1 ? 's sont' : ' est'} dans
                cette étape. Où les placer ?
              </p>
              <label className="champ">
                <span className="lbl">Étape d’arrivée</span>
                <select
                  name="vers"
                  defaultValue={etapes.find((x) => x.id !== suppression.etape.id)?.id}
                >
                  {etapes
                    .filter((x) => x.id !== suppression.etape.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                </select>
              </label>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => setSuppression(null)}>
                  Annuler
                </button>
                <button type="submit" className="cta">
                  Déplacer et supprimer
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
