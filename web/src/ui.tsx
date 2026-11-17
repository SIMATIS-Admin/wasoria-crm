import { useState, type FormEvent, type ReactNode } from 'react';
import { appel, ErreurApi } from './api';

export const Pill = ({ classe, children }: { classe: string; children: ReactNode }) => (
  <span className={`pill ${classe}`}>{children}</span>
);

export const Panel = ({ titre, children }: { titre?: string; children: ReactNode }) => (
  <section className="panel">
    {titre && (
      <div className="panel-h">
        <h2>{titre}</h2>
      </div>
    )}
    <div className="panel-b">{children}</div>
  </section>
);

export const Kpi = ({
  titre,
  valeur,
  detail,
  alerte,
}: {
  titre: string;
  valeur: string;
  detail: string;
  alerte?: boolean;
}) => (
  <div className="panel kpi">
    <div className="t">{titre}</div>
    <div className={`v${alerte ? ' late' : ''}`}>{valeur}</div>
    <div className="d">{detail}</div>
  </div>
);

export const Chargement = ({ erreur }: { erreur: string | null }) =>
  erreur ? <div className="alert">{erreur}</div> : <p className="muted">Chargement…</p>;

export type Champ = {
  nom: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'datetime-local' | 'email' | 'select';
  options?: { id: string; label: string }[];
  requis?: boolean;
};

// Formulaire de création : envoie le corps à l'API, puis rappelle `termine`.
export function Formulaire({
  titre,
  chemin,
  champs,
  initial,
  termine,
  annuler,
}: {
  titre: string;
  chemin: string;
  champs: Champ[];
  initial?: Record<string, unknown>;
  termine: () => void;
  annuler: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget);
    const corps: Record<string, unknown> = { ...initial };
    for (const c of champs) {
      const valeur = donnees.get(c.nom);
      const brut = typeof valeur === 'string' ? valeur.trim() : '';
      if (!brut) continue;
      if (c.type === 'number') corps[c.nom] = Number(brut);
      else if (c.type === 'datetime-local') corps[c.nom] = new Date(brut).toISOString();
      else corps[c.nom] = brut;
    }
    setEnvoi(true);
    try {
      await appel('POST', chemin, corps);
      termine();
    } catch (err) {
      setErreur(
        err instanceof ErreurApi ? [err.message, ...err.details].join(' — ') : 'Échec de l’envoi',
      );
      setEnvoi(false);
    }
  }

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-label={titre}>
      <form className="panel dialogue" onSubmit={(e) => void envoyer(e)}>
        <div className="panel-h">
          <h2>{titre}</h2>
        </div>
        <div className="panel-b form">
          {champs.map((c) => (
            <label key={c.nom} className="champ">
              <span className="lbl">{c.label}</span>
              {c.type === 'select' ? (
                <select name={c.nom} required={c.requis} defaultValue={c.options?.[0]?.id}>
                  {c.options?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input name={c.nom} type={c.type ?? 'text'} required={c.requis} />
              )}
            </label>
          ))}
          {erreur && <div className="alert">{erreur}</div>}
          <div className="actions">
            <button type="button" className="ghost" onClick={annuler}>
              Annuler
            </button>
            <button type="submit" className="cta" disabled={envoi}>
              Créer
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
