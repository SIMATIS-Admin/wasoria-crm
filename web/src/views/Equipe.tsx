import { useState, type FormEvent } from 'react';
import { appel, ErreurApi } from '../api';
import { LIBELLES_ROLE, useRole, type Role } from '../role';
import { useApi } from '../useApi';
import { Chargement, Panel, Pill } from '../ui';

type Compte = {
  id: string;
  identifiant: string;
  nom: string;
  role: Role;
  actif: boolean;
  derniereConnexion: string | null;
};

const ROLES: Role[] = ['admin', 'commercial', 'lecture'];
const AIDE: Record<Role, string> = {
  admin: 'Tout : supprimer, régler le pipe et les indicateurs, gérer les comptes.',
  commercial: 'Crée et modifie les fiches ; ne supprime pas et ne règle rien.',
  lecture: 'Consulte tout, ne modifie rien.',
};

const jour = (s: string | null) => (s ? new Date(s).toLocaleDateString('fr-FR') : 'jamais');

export function Equipe() {
  const { estAdmin } = useRole();
  const liste = useApi<Compte[]>('/utilisateurs');
  const [erreur, setErreur] = useState<string | null>(null);
  const [mdp, setMdp] = useState<Compte | null>(null);
  if (!estAdmin) return <p className="muted">Réservé aux administrateurs.</p>;
  if (!liste.donnees) return <Chargement erreur={liste.erreur} />;

  // Une action sur un compte, puis on relit la liste ; un refus du serveur s'affiche tel quel.
  async function agir(action: () => Promise<unknown>) {
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(
        e instanceof ErreurApi ? [e.message, ...e.details].join(' — ') : 'Action impossible',
      );
    }
    liste.recharger();
  }

  function creer(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const d = new FormData(form);
    const champ = (n: string) => {
      const v = d.get(n);
      return typeof v === 'string' ? v : '';
    };
    void agir(async () => {
      await appel('POST', '/utilisateurs', {
        identifiant: champ('identifiant'),
        nom: champ('nom'),
        motDePasse: champ('motDePasse'),
        role: champ('role'),
      });
      form.reset();
    });
  }

  return (
    <>
      <p className="muted small">
        Les personnes qui peuvent se connecter, et ce qu’elles peuvent faire. Changer le rôle d’un
        compte ferme ses sessions : la personne se reconnecte avec ses nouveaux droits.
      </p>
      {erreur && <div className="alert">{erreur}</div>}
      <Panel titre="Comptes">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Rôle</th>
                <th>Dernière connexion</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.donnees.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.nom} {!c.actif && <Pill classe="p-cold">Désactivé</Pill>}
                  </td>
                  <td className="muted">{c.identifiant}</td>
                  <td>
                    <select
                      aria-label={`Rôle de ${c.nom}`}
                      value={c.role}
                      onChange={(e) =>
                        void agir(() =>
                          appel('PATCH', `/utilisateurs/${c.id}`, { role: e.target.value }),
                        )
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {LIBELLES_ROLE[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="muted">{jour(c.derniereConnexion)}</td>
                  <td className="actions-ligne">
                    <button
                      className="ghost"
                      aria-label={`Nouveau mot de passe pour ${c.nom}`}
                      onClick={() => setMdp(c)}
                    >
                      Mot de passe
                    </button>
                    <button
                      className="ghost"
                      aria-label={`${c.actif ? 'Désactiver' : 'Réactiver'} ${c.nom}`}
                      onClick={() =>
                        void agir(() =>
                          appel('PATCH', `/utilisateurs/${c.id}`, { actif: !c.actif }),
                        )
                      }
                    >
                      {c.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <form className="panel" onSubmit={creer}>
        <div className="panel-h">
          <h2>Nouveau compte</h2>
        </div>
        <div className="panel-b form">
          <div className="ligne-compte">
            <label className="champ">
              <span className="lbl">Nom affiché</span>
              <input name="nom" required />
            </label>
            <label className="champ">
              <span className="lbl">Identifiant</span>
              <input name="identifiant" autoComplete="off" required />
            </label>
            <label className="champ">
              <span className="lbl">Mot de passe (12 caractères minimum)</span>
              <input
                name="motDePasse"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
            <label className="champ">
              <span className="lbl">Rôle</span>
              <select name="role" defaultValue="commercial">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {LIBELLES_ROLE[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="muted small aide-roles">
            {ROLES.map((r) => (
              <li key={r}>
                <b>{LIBELLES_ROLE[r]}</b> : {AIDE[r]}
              </li>
            ))}
          </ul>
          <div>
            <button className="cta" type="submit">
              Créer le compte
            </button>
          </div>
        </div>
      </form>
      {mdp && (
        <NouveauMotDePasse compte={mdp} annuler={() => setMdp(null)} termine={() => setMdp(null)} />
      )}
    </>
  );
}

function NouveauMotDePasse({
  compte,
  annuler,
  termine,
}: {
  compte: Compte;
  annuler: () => void;
  termine: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget).get('motDePasse');
    try {
      await appel('POST', `/utilisateurs/${compte.id}/mot-de-passe`, {
        motDePasse: typeof v === 'string' ? v : '',
      });
      termine();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Changement impossible');
    }
  }

  return (
    <div
      className="voile"
      role="dialog"
      aria-modal="true"
      aria-label={`Mot de passe de ${compte.nom}`}
    >
      <form className="panel dialogue" onSubmit={(e) => void envoyer(e)}>
        <div className="panel-h">
          <h2>Mot de passe de {compte.nom}</h2>
        </div>
        <div className="panel-b form">
          <p className="muted small">Ses sessions ouvertes seront fermées.</p>
          <label className="champ">
            <span className="lbl">Nouveau mot de passe (12 caractères minimum)</span>
            <input
              name="motDePasse"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
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
