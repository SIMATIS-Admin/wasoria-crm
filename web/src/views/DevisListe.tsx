import { eur, eur2, jour } from '../format';
import type { DevisResume, StatutDevis } from '../types';
import { useApi } from '../useApi';
import { Chargement, Panel, Pill } from '../ui';

export const STATUTS: Record<StatutDevis, { label: string; classe: string }> = {
  brouillon: { label: 'Brouillon', classe: 'p-cold' },
  envoye: { label: 'Envoyé', classe: 'p-acc' },
  accepte: { label: 'Accepté', classe: 'p-ok' },
  refuse: { label: 'Refusé', classe: 'p-hot' },
};

export const montantDe = (d: Pick<DevisResume, 'formule' | 'totaux'>) =>
  d.formule === 'abonnement'
    ? `${eur2(d.totaux.mensualite)} / mois`
    : eur(d.totaux.totalPremiereAnnee);

export function DevisListe() {
  const liste = useApi<DevisResume[]>('/devis?limite=200');
  if (!liste.donnees) return <Chargement erreur={liste.erreur} />;
  return (
    <Panel>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Devis</th>
              <th>Affaire</th>
              <th>Compte</th>
              <th>Formule</th>
              <th>Montant HT</th>
              <th>Statut</th>
              <th>Créé le</th>
            </tr>
          </thead>
          <tbody>
            {liste.donnees.map((d) => (
              <tr
                key={d.id}
                className="click"
                onClick={() => (window.location.hash = `devis/${d.id}`)}
              >
                <td>
                  <a className="link" href={`#devis/${d.id}`}>
                    {d.numero}
                  </a>
                </td>
                <td>{d.affaire}</td>
                <td className="muted">{d.entreprise ?? '—'}</td>
                <td className="muted">{d.formule === 'abonnement' ? 'Abonnement' : 'Achat'}</td>
                <td className="num">{montantDe(d)}</td>
                <td>
                  <Pill classe={STATUTS[d.statut].classe}>{STATUTS[d.statut].label}</Pill>
                </td>
                <td className="muted">{jour(d.createdAt)}</td>
              </tr>
            ))}
            {liste.donnees.length === 0 && (
              <tr>
                <td className="muted">
                  Aucun devis. Préparez-en un depuis la fiche d’une affaire.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
