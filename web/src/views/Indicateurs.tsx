import { useState, type FormEvent } from 'react';
import { appel, ErreurApi } from '../api';
import type { Etape, Indicateur } from '../types';
import { useApi } from '../useApi';
import { Chargement, Pill } from '../ui';

const PERIODES = [30, 90, 180, 365];
const GAGNE = '@gagne';
const PERDU = '@perdu';

const STATUTS: Record<Indicateur['statut'], { label: string; classe: string }> = {
  ok: { label: 'Objectif tenu', classe: 'p-ok' },
  'hors-objectif': { label: 'Hors objectif', classe: 'p-hot' },
  'sans-objectif': { label: 'Sans objectif', classe: 'p-cold' },
  'sans-donnee': { label: 'Pas encore de données', classe: 'p-cold' },
  'a-configurer': { label: 'À configurer', classe: 'p-warm' },
};

const nombre = (n: number) =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export function Indicateurs() {
  const [jours, setJours] = useState(90);
  const donnees = useApi<{ indicateurs: Indicateur[] }>(`/indicateurs?jours=${jours}`);
  const etapes = useApi<Etape[]>('/etapes');
  const [edition, setEdition] = useState<Indicateur | null>(null);
  if (!donnees.donnees || !etapes.donnees)
    return <Chargement erreur={donnees.erreur ?? etapes.erreur} />;

  const nomEtape = (id: string | null) =>
    id === GAGNE
      ? 'Gagnée'
      : id === PERDU
        ? 'Perdue'
        : (etapes.donnees?.find((e) => e.id === id)?.label ?? id ?? '—');

  return (
    <>
      <div className="periode">
        <span className="muted small">Période</span>
        <div className="seg" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <button key={p} className={jours === p ? 'on' : ''} onClick={() => setJours(p)}>
              {p} jours
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">
        Calculés sur les dates d’arrivée des affaires dans chaque étape, enregistrées
        automatiquement à chaque changement d’étape. Les étapes de départ et d’arrivée et les
        objectifs se règlent par indicateur.
      </p>
      <div className="grid g3">
        {donnees.donnees.indicateurs.map((i) => {
          const s = STATUTS[i.statut];
          return (
            <section className="panel indic" key={i.id} aria-label={i.label}>
              <div className="tete">
                <div className="t">{i.label}</div>
                <Pill classe={s.classe}>{s.label}</Pill>
              </div>
              <div className="v num">
                {i.valeur === null ? '—' : nombre(i.valeur)}
                <small>{i.unite}</small>
              </div>
              {i.type !== 'entrants' && (
                <div className="small muted">
                  {i.deEtape && i.versEtape
                    ? `De ${nomEtape(i.deEtape)} à ${nomEtape(i.versEtape)}`
                    : 'Étapes à choisir'}
                </div>
              )}
              {i.type === 'delai' && i.valeur !== null && (
                <div className="small muted">
                  Médiane sur {i.n} affaire{i.n > 1 ? 's' : ''}
                  {i.moyenne != null ? ` · moyenne ${nombre(i.moyenne)} jours` : ''}
                </div>
              )}
              {i.type === 'conversion' && i.valeur !== null && (
                <div className="small muted">
                  {i.convertis} sur {i.n} affaire{i.n > 1 ? 's' : ''}
                </div>
              )}
              {i.type === 'entrants' && i.serie && (
                <div className="barres" role="img" aria-label="Affaires créées par semaine">
                  {i.serie.map((p) => {
                    const max = Math.max(1, ...(i.serie ?? []).map((x) => x.n));
                    return (
                      <span
                        key={p.semaine}
                        title={`Semaine du ${p.semaine} : ${p.n}`}
                        style={{ height: `${(p.n / max) * 100}%` }}
                      />
                    );
                  })}
                </div>
              )}
              <div className="small muted">
                {i.objectif === null
                  ? 'Pas d’objectif fixé'
                  : `Objectif : ${i.type === 'delai' ? '≤' : '≥'} ${nombre(i.objectif)} ${i.unite}`}
              </div>
              <div>
                <button className="ghost" onClick={() => setEdition(i)}>
                  Régler
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {edition && (
        <Reglage
          indicateur={edition}
          etapes={etapes.donnees}
          annuler={() => setEdition(null)}
          termine={() => {
            setEdition(null);
            donnees.recharger();
          }}
        />
      )}
    </>
  );
}

function Reglage({
  indicateur: i,
  etapes,
  annuler,
  termine,
}: {
  indicateur: Indicateur;
  etapes: Etape[];
  annuler: () => void;
  termine: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const aEtapes = i.type !== 'entrants';

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const obj = d.get('objectif');
    const de = d.get('de');
    const vers = d.get('vers');
    try {
      await appel('PATCH', `/indicateurs/${i.id}`, {
        objectif: typeof obj === 'string' && obj.trim() !== '' ? Number(obj) : null,
        ...(aEtapes && typeof de === 'string' && typeof vers === 'string'
          ? { deEtape: de || null, versEtape: vers || null }
          : {}),
      });
      termine();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Enregistrement impossible');
    }
  }

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-label={`Régler ${i.label}`}>
      <form className="panel dialogue" onSubmit={(e) => void envoyer(e)}>
        <div className="panel-h">
          <h2>{i.label}</h2>
        </div>
        <div className="panel-b form">
          {aEtapes && (
            <>
              <label className="champ">
                <span className="lbl">
                  {i.type === 'delai' ? 'Départ du délai' : 'Étape de départ'}
                </span>
                <select name="de" defaultValue={i.deEtape ?? ''}>
                  <option value="">— à choisir —</option>
                  {etapes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="champ">
                <span className="lbl">
                  {i.type === 'delai' ? 'Fin du délai' : 'Étape d’arrivée'}
                </span>
                <select name="vers" defaultValue={i.versEtape ?? ''}>
                  <option value="">— à choisir —</option>
                  {etapes.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                  <option value={GAGNE}>Gagnée (commande)</option>
                  <option value={PERDU}>Perdue</option>
                </select>
              </label>
            </>
          )}
          <label className="champ">
            <span className="lbl">
              Objectif ({i.unite}, {i.type === 'delai' ? 'à ne pas dépasser' : 'à atteindre'})
            </span>
            <input
              name="objectif"
              type="number"
              min={0}
              defaultValue={i.objectif ?? ''}
              placeholder="Aucun"
            />
          </label>
          {erreur && <div className="alert">{erreur}</div>}
          <div className="actions">
            <button type="button" className="ghost" onClick={annuler}>
              Annuler
            </button>
            <button type="submit" className="cta">
              Enregistrer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
