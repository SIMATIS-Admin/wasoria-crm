import { useEffect, useState, type FormEvent } from 'react';
import { lireJeton, poserJeton } from './api';
import { Accueil } from './views/Accueil';
import { Affaire } from './views/Affaire';
import { Comptes } from './views/Comptes';
import { Pipe } from './views/Pipe';
import { RendezVous } from './views/RendezVous';
import { Taches } from './views/Taches';

const VUES = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'pipe', label: 'Pipe' },
  { id: 'comptes', label: 'Comptes' },
  { id: 'taches', label: 'Tâches' },
  { id: 'rdv', label: 'Rendez-vous' },
];

const TITRES: Record<string, [string, string]> = {
  accueil: ['Bonjour', 'Votre semaine commerciale'],
  pipe: ['Affaires', 'Pipe'],
  affaire: ['Affaire', 'Fiche affaire'],
  comptes: ['Clients et prospects', 'Comptes'],
  taches: ['À faire', 'Tâches'],
  rdv: ['Agenda', 'Rendez-vous'],
};

// Route par ancre (#pipe, #affaire/<id>) : pas de serveur de routes à configurer.
export const lireRoute = (hash: string) => {
  const [vue = 'accueil', id] = hash.replace(/^#/, '').split('/');
  return { vue: vue || 'accueil', id };
};

function Connexion({ onJeton }: { onJeton: () => void }) {
  function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const saisi = new FormData(e.currentTarget).get('jeton');
    const jeton = typeof saisi === 'string' ? saisi.trim() : '';
    if (!jeton) return;
    poserJeton(jeton);
    onJeton();
  }
  return (
    <main className="wrap connexion">
      <form className="panel dialogue" onSubmit={envoyer}>
        <div className="panel-h">
          <h2>CRM Wasoria</h2>
        </div>
        <div className="panel-b form">
          <label className="champ">
            <span className="lbl">Jeton d’accès</span>
            <input name="jeton" type="password" autoComplete="off" required />
          </label>
          <button className="cta" type="submit">
            Entrer
          </button>
        </div>
      </form>
    </main>
  );
}

export function App() {
  const [connecte, setConnecte] = useState(() => lireJeton() !== null);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const surHash = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    const surRefus = () => setConnecte(false);
    window.addEventListener('hashchange', surHash);
    window.addEventListener('jeton-refuse', surRefus);
    return () => {
      window.removeEventListener('hashchange', surHash);
      window.removeEventListener('jeton-refuse', surRefus);
    };
  }, []);

  if (!connecte) return <Connexion onJeton={() => setConnecte(true)} />;

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
            <button
              className="ghost"
              onClick={() => {
                poserJeton(null);
                setConnecte(false);
              }}
            >
              Quitter
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
        </section>
      </main>
    </>
  );
}
