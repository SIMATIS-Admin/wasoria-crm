import { useState, type FormEvent } from 'react';
import { appel, ErreurApi } from '../api';
import { eur } from '../format';
import { useRole } from '../role';
import type { Article } from '../types';
import { useApi } from '../useApi';
import { Chargement, Panel, Pill } from '../ui';

// Le catalogue qui alimente les devis. Les devis déjà faits gardent leur propre copie du nom et du prix.
export function Articles() {
  const { estAdmin } = useRole();
  const liste = useApi<Article[]>('/articles?tous=1');
  const [erreur, setErreur] = useState<string | null>(null);
  if (!estAdmin) return <p className="muted">Réservé aux administrateurs.</p>;
  if (!liste.donnees) return <Chargement erreur={liste.erreur} />;

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

  function ajouter(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = ev.currentTarget;
    const d = new FormData(form);
    const texte = (n: string) => {
      const v = d.get(n);
      return typeof v === 'string' ? v.trim() : '';
    };
    void agir(async () => {
      await appel('POST', '/articles', {
        reference: texte('reference'),
        nom: texte('nom'),
        prix: Number(texte('prix')),
        recurrent: d.get('recurrent') === 'on',
      });
      form.reset();
    });
  }

  return (
    <>
      <p className="muted small">
        Les articles proposés dans les devis, prix en euros HT. Un article « annuel » est facturé
        chaque année (maintenance, abonnement à un service) ; les autres sont payés une fois.
        Désactiver un article le retire des devis à venir.
      </p>
      {erreur && <div className="alert">{erreur}</div>}
      <Panel titre="Catalogue">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Nom</th>
                <th>Prix HT</th>
                <th>Facturation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.donnees.map((a) => (
                <tr key={a.id}>
                  <td className="muted">{a.reference}</td>
                  <td>
                    <input
                      className="champ-ligne"
                      aria-label={`Nom de ${a.reference}`}
                      defaultValue={a.nom}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== a.nom)
                          void agir(() => appel('PATCH', `/articles/${a.id}`, { nom: v }));
                      }}
                    />
                  </td>
                  <td>
                    <input
                      className="champ-ligne court"
                      type="number"
                      min={0}
                      aria-label={`Prix de ${a.reference}`}
                      defaultValue={a.prix}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (e.target.value !== '' && v !== a.prix) {
                          void agir(() => appel('PATCH', `/articles/${a.id}`, { prix: v }));
                        }
                      }}
                    />{' '}
                    <span className="muted small">{eur(a.prix)}</span>
                  </td>
                  <td>
                    <button
                      className="ghost"
                      aria-label={`Facturation de ${a.reference}`}
                      onClick={() =>
                        void agir(() =>
                          appel('PATCH', `/articles/${a.id}`, { recurrent: !a.recurrent }),
                        )
                      }
                    >
                      {a.recurrent ? 'Chaque année' : 'Une fois'}
                    </button>
                  </td>
                  <td className="actions-ligne">
                    {!a.actif && <Pill classe="p-cold">Désactivé</Pill>}
                    <button
                      className="ghost"
                      aria-label={`${a.actif ? 'Désactiver' : 'Réactiver'} ${a.reference}`}
                      onClick={() =>
                        void agir(() => appel('PATCH', `/articles/${a.id}`, { actif: !a.actif }))
                      }
                    >
                      {a.actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <form className="panel" onSubmit={ajouter}>
        <div className="panel-h">
          <h2>Nouvel article</h2>
        </div>
        <div className="panel-b form">
          <div className="ligne-article">
            <label className="champ">
              <span className="lbl">Référence</span>
              <input name="reference" maxLength={40} required />
            </label>
            <label className="champ">
              <span className="lbl">Nom</span>
              <input name="nom" maxLength={300} required />
            </label>
            <label className="champ">
              <span className="lbl">Prix HT (€)</span>
              <input name="prix" type="number" min={0} required />
            </label>
            <label className="case">
              <input name="recurrent" type="checkbox" /> Facturé chaque année
            </label>
          </div>
          <div>
            <button className="cta" type="submit">
              Ajouter l’article
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
