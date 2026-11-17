import { useState } from 'react';
import { eur } from '../format';
import { libelleEtape } from '../etapes';
import type { Affaire, Contact, Entreprise, Etape } from '../types';
import { useApi } from '../useApi';
import { useRole } from '../role';
import { Chargement, Formulaire, Panel } from '../ui';

export function Comptes() {
  const { peutEcrire } = useRole();
  const [recherche, setRecherche] = useState('');
  const [choix, setChoix] = useState<string | null>(null);
  const [dialogue, setDialogue] = useState<'entreprise' | 'contact' | null>(null);
  const chemin = `/entreprises?limite=200${recherche ? `&q=${encodeURIComponent(recherche)}` : ''}`;
  const liste = useApi<Entreprise[]>(chemin);
  const etapes = useApi<Etape[]>('/etapes');
  const actif = choix ?? liste.donnees?.[0]?.id ?? null;
  const contacts = useApi<Contact[]>(actif ? `/contacts?entrepriseId=${actif}` : null);
  const affaires = useApi<Affaire[]>(actif ? `/affaires?entrepriseId=${actif}` : null);

  if (!liste.donnees) return <Chargement erreur={liste.erreur} />;
  const courant = liste.donnees.find((e) => e.id === actif);

  return (
    <>
      <div className="barre">
        <input
          className="recherche"
          placeholder="Rechercher une entreprise…"
          aria-label="Rechercher une entreprise"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        {peutEcrire && (
          <button className="cta" onClick={() => setDialogue('entreprise')}>
            Nouvelle entreprise
          </button>
        )}
      </div>
      <div className="split">
        <div className="panel">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Entreprise</th>
                  <th>Secteur</th>
                  <th>Ville</th>
                </tr>
              </thead>
              <tbody>
                {liste.donnees.map((e) => (
                  <tr
                    key={e.id}
                    className={`click ${e.id === actif ? 'sel' : ''}`}
                    onClick={() => setChoix(e.id)}
                  >
                    <td>{e.nom}</td>
                    <td className="muted">{e.secteur ?? '—'}</td>
                    <td className="muted">{e.ville ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {courant && (
          <Panel titre={courant.nom}>
            <div className="list">
              <div>
                <div className="lbl">Contacts</div>
                {contacts.donnees?.map((c) => (
                  <div key={c.id}>
                    {c.nom} <span className="muted small">· {c.fonction ?? '—'}</span>
                  </div>
                ))}
                {contacts.donnees?.length === 0 && <span className="muted">—</span>}
                {peutEcrire && (
                  <button className="ghost" onClick={() => setDialogue('contact')}>
                    Nouveau contact
                  </button>
                )}
              </div>
              <div>
                <div className="lbl">Affaires</div>
                {affaires.donnees?.map((a) => (
                  <div key={a.id}>
                    <a className="link" href={`#affaire/${a.id}`}>
                      {a.titre}
                    </a>{' '}
                    <span className="muted small">
                      · {libelleEtape(a.etape, etapes.donnees ?? [])} · {eur(a.montant)}
                    </span>
                  </div>
                ))}
                {affaires.donnees?.length === 0 && <span className="muted">—</span>}
              </div>
            </div>
          </Panel>
        )}
      </div>
      {dialogue === 'entreprise' && (
        <Formulaire
          titre="Nouvelle entreprise"
          chemin="/entreprises"
          champs={[
            { nom: 'nom', label: 'Nom', requis: true },
            { nom: 'secteur', label: 'Secteur' },
            { nom: 'ville', label: 'Ville' },
          ]}
          termine={() => {
            setDialogue(null);
            liste.recharger();
          }}
          annuler={() => setDialogue(null)}
        />
      )}
      {dialogue === 'contact' && actif && (
        <Formulaire
          titre="Nouveau contact"
          chemin="/contacts"
          initial={{ entrepriseId: actif }}
          champs={[
            { nom: 'nom', label: 'Nom', requis: true },
            { nom: 'fonction', label: 'Fonction' },
            { nom: 'email', label: 'Email', type: 'email' },
          ]}
          termine={() => {
            setDialogue(null);
            contacts.recharger();
          }}
          annuler={() => setDialogue(null)}
        />
      )}
    </>
  );
}
