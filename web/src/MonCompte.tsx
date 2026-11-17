import { useState, type FormEvent } from 'react';
import { appel, ErreurApi } from './api';
import { LIBELLES_ROLE, type Role } from './role';

// Le compte de la personne connectée : son rôle, et le changement de son mot de passe.
export function MonCompte({ nom, role, fermer }: { nom: string; role: Role; fermer: () => void }) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [fait, setFait] = useState(false);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const texte = (n: string) => {
      const v = d.get(n);
      return typeof v === 'string' ? v : '';
    };
    setErreur(null);
    try {
      await appel('POST', '/moi/mot-de-passe', {
        actuel: texte('actuel'),
        nouveau: texte('nouveau'),
      });
      setFait(true);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Changement impossible');
    }
  }

  return (
    <div className="voile" role="dialog" aria-modal="true" aria-label="Mon compte">
      <form className="panel dialogue" onSubmit={(e) => void envoyer(e)}>
        <div className="panel-h">
          <h2>{nom}</h2>
        </div>
        <div className="panel-b form">
          <p className="muted small">Rôle : {LIBELLES_ROLE[role]}</p>
          {fait ? (
            <p className="small">Mot de passe changé. Vos autres sessions ont été fermées.</p>
          ) : (
            <>
              <label className="champ">
                <span className="lbl">Mot de passe actuel</span>
                <input name="actuel" type="password" autoComplete="current-password" required />
              </label>
              <label className="champ">
                <span className="lbl">Nouveau mot de passe (12 caractères minimum)</span>
                <input
                  name="nouveau"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
              {erreur && <div className="alert">{erreur}</div>}
            </>
          )}
          <div className="actions">
            <button type="button" className="ghost" onClick={fermer}>
              Fermer
            </button>
            {!fait && (
              <button type="submit" className="cta">
                Changer le mot de passe
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
