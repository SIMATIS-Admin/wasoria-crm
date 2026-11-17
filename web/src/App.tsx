import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { appel, ErreurApi, lire } from './api';
import { Accueil } from './views/Accueil';
import { Affaire } from './views/Affaire';
import { Comptes } from './views/Comptes';
import { Etapes } from './views/Etapes';
import { Pipe } from './views/Pipe';
import { RendezVous } from './views/RendezVous';
import { Taches } from './views/Taches';

const VUES = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'pipe', label: 'Pipe' },
  { id: 'comptes', label: 'Comptes' },
  { id: 'taches', label: 'Tâches' },
  { id: 'rdv', label: 'Rendez-vous' },
  { id: 'etapes', label: 'Étapes' },
];

const TITRES: Record<string, [string, string]> = {
  accueil: ['Bonjour', 'Votre semaine commerciale'],
  pipe: ['Affaires', 'Pipe'],
  affaire: ['Affaire', 'Fiche affaire'],
  comptes: ['Clients et prospects', 'Comptes'],
  taches: ['À faire', 'Tâches'],
  rdv: ['Agenda', 'Rendez-vous'],
  etapes: ['Réglages', 'Étapes du pipe'],
};

// Route par ancre (#pipe, #affaire/<id>) : pas de serveur de routes à configurer.
export const lireRoute = (hash: string) => {
  const [vue = 'accueil', id] = hash.replace(/^#/, '').split('/');
  return { vue: vue || 'accueil', id };
};

type Moi = { utilisateur: { id: string; identifiant: string; nom: string } };

const texte = (d: FormData, nom: string) => {
  const v = d.get(nom);
  return typeof v === 'string' ? v : '';
};

// Connexion, ou création du premier compte tant qu'il n'y en a aucun (elle demande alors le jeton
// du serveur, celui de .env, pour prouver qu'on a la main sur l'installation).
function Connexion({
  installation,
  onConnecte,
}: {
  installation: boolean;
  onConnecte: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setEnvoi(true);
    setErreur(null);
    try {
      if (installation) {
        await appel('POST', '/installation', {
          jeton: texte(d, 'jeton'),
          identifiant: texte(d, 'identifiant'),
          nom: texte(d, 'nom'),
          motDePasse: texte(d, 'motDePasse'),
        });
      } else {
        await appel('POST', '/connexion', {
          identifiant: texte(d, 'identifiant'),
          motDePasse: texte(d, 'motDePasse'),
        });
      }
      onConnecte();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : 'Connexion impossible');
      setEnvoi(false);
    }
  }

  return (
    <main className="wrap connexion">
      <form className="panel dialogue" onSubmit={(e) => void envoyer(e)}>
        <div className="panel-h">
          <h2>{installation ? 'Créer le premier compte' : 'CRM Wasoria'}</h2>
        </div>
        <div className="panel-b form">
          {installation && (
            <>
              <p className="muted small">
                Aucun compte n’existe encore. Saisissez le jeton d’installation (la ligne API_TOKEN
                du fichier .env du serveur) et choisissez vos identifiants.
              </p>
              <label className="champ">
                <span className="lbl">Jeton d’installation</span>
                <input name="jeton" type="password" autoComplete="off" required />
              </label>
              <label className="champ">
                <span className="lbl">Nom affiché</span>
                <input name="nom" autoComplete="name" required />
              </label>
            </>
          )}
          <label className="champ">
            <span className="lbl">Identifiant</span>
            <input name="identifiant" autoComplete="username" required />
          </label>
          <label className="champ">
            <span className="lbl">Mot de passe</span>
            <input
              name="motDePasse"
              type="password"
              autoComplete={installation ? 'new-password' : 'current-password'}
              minLength={installation ? 12 : undefined}
              required
            />
          </label>
          {installation && <span className="muted small">12 caractères minimum.</span>}
          {erreur && <div className="alert">{erreur}</div>}
          <button className="cta" type="submit" disabled={envoi}>
            {installation ? 'Créer le compte' : 'Se connecter'}
          </button>
        </div>
      </form>
    </main>
  );
}

type Statut = 'chargement' | 'connexion' | 'installation' | 'connecte';

export function App() {
  const [statut, setStatut] = useState<Statut>('chargement');
  const [nom, setNom] = useState('');
  const [hash, setHash] = useState(window.location.hash);

  // Qui est connecté ? Sinon : faut-il créer le premier compte, ou se connecter ?
  const verifier = useCallback(async () => {
    try {
      const moi = await lire<Moi>('/moi');
      setNom(moi.utilisateur.nom);
      setStatut('connecte');
    } catch {
      try {
        const etat = await lire<{ installe: boolean }>('/etat');
        setStatut(etat.installe ? 'connexion' : 'installation');
      } catch {
        setStatut('connexion');
      }
    }
  }, []);

  useEffect(() => {
    void verifier();
    const surHash = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    const surExpiration = () => setStatut('connexion');
    window.addEventListener('hashchange', surHash);
    window.addEventListener('session-expiree', surExpiration);
    return () => {
      window.removeEventListener('hashchange', surHash);
      window.removeEventListener('session-expiree', surExpiration);
    };
  }, [verifier]);

  if (statut === 'chargement') return <p className="muted wrap">Chargement…</p>;
  if (statut !== 'connecte') {
    return (
      <Connexion installation={statut === 'installation'} onConnecte={() => void verifier()} />
    );
  }

  const { vue, id } = lireRoute(hash);
  const actuelle = TITRES[vue] ? vue : 'accueil';
  const [eyebrow, titre] = TITRES[actuelle]!;

  return (
    <>
      <header className="navbar">
        <div className="wrap">
          <nav className="pillnav" aria-label="Navigation">
            <a className="logo" href="#accueil">
              WASORIA
            </a>
            <div className="links">
              {VUES.map((v) => (
                <a
                  key={v.id}
                  href={`#${v.id}`}
                  className={
                    actuelle === v.id || (actuelle === 'affaire' && v.id === 'pipe') ? 'on' : ''
                  }
                >
                  {v.label}
                </a>
              ))}
            </div>
            <span className="muted small">{nom}</span>
            <button
              className="ghost"
              onClick={() => {
                void appel('POST', '/deconnexion').finally(() => setStatut('connexion'));
              }}
            >
              Se déconnecter
            </button>
          </nav>
        </div>
      </header>
      <main className="wrap">
        <div className="vhead">
          <div className="eyebrow">{eyebrow}</div>
          <h1>{titre}</h1>
        </div>
        <section className="view">
          {actuelle === 'accueil' && <Accueil />}
          {actuelle === 'pipe' && <Pipe />}
          {actuelle === 'affaire' && id && <Affaire key={id} id={id} />}
          {actuelle === 'comptes' && <Comptes />}
          {actuelle === 'taches' && <Taches />}
          {actuelle === 'rdv' && <RendezVous />}
          {actuelle === 'etapes' && <Etapes />}
        </section>
      </main>
    </>
  );
}
