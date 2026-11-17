import { eur, enRetard, jour, jourHeure, montantOuvert, niveau, score } from '../format';
import type { Affaire, Etape, RendezVous, Tache } from '../types';
import { useApi } from '../useApi';
import { Chargement, Kpi, Panel } from '../ui';

// Montant de chaque affaire × probabilité de son étape (ou la probabilité réglée sur l'affaire).
const ponderé = (affaires: Affaire[], etapes: Etape[]) =>
  Math.round(
    affaires.reduce(
      (s, a) =>
        s + ((a.montant ?? 0) * (etapes.find((e) => e.id === a.etape)?.probabilite ?? 0)) / 100,
      0,
    ),
  );

export function Accueil() {
  const affaires = useApi<Affaire[]>('/affaires?ouvertes=1&limite=200');
  const taches = useApi<Tache[]>('/taches?ouvertes=1&limite=200');
  const etapes = useApi<Etape[]>('/etapes');
  const rdv = useApi<RendezVous[]>(
    `/rendez-vous?statut=rdv&depuis=${encodeURIComponent(new Date().toISOString())}&limite=20`,
  );
  if (!affaires.donnees || !taches.donnees || !rdv.donnees || !etapes.donnees) {
    return <Chargement erreur={affaires.erreur ?? taches.erreur ?? rdv.erreur ?? etapes.erreur} />;
  }
  const retard = taches.donnees.filter((t) => enRetard(t.echeance));
  const chaudes = affaires.donnees.filter((a) => niveau(score(a.qualification)).classe === 'p-hot');
  const titreAffaire = (id: string | null) =>
    affaires.donnees?.find((a) => a.id === id)?.titre ?? '';

  return (
    <>
      <div className="grid g4">
        <Kpi
          titre="Pipe ouvert"
          valeur={eur(montantOuvert(affaires.donnees))}
          detail={`${affaires.donnees.length} affaires · pondéré ${eur(ponderé(affaires.donnees, etapes.donnees))}`}
        />
        <Kpi
          titre="Affaires chaudes"
          valeur={String(chaudes.length)}
          detail="qualification 12/15 ou plus"
        />
        <Kpi
          titre="Tâches en retard"
          valeur={String(retard.length)}
          detail={`sur ${taches.donnees.length} ouvertes`}
          alerte={retard.length > 0}
        />
        <Kpi
          titre="Rendez-vous à venir"
          valeur={String(rdv.donnees.length)}
          detail="rendez-vous confirmés"
        />
      </div>
      {retard.length > 0 && (
        <div className="alert">
          {retard.length} tâche{retard.length > 1 ? 's' : ''} en retard.{' '}
          <a className="link" href="#taches">
            Voir les tâches
          </a>
        </div>
      )}
      <div className="split">
        <Panel titre="Prochaines actions">
          <div className="tbl-wrap">
            <table>
              <tbody>
                {taches.donnees.slice(0, 6).map((t) => (
                  <tr key={t.id}>
                    <td
                      className={`num ${enRetard(t.echeance) ? 'late' : 'muted'}`}
                      style={{ width: 80 }}
                    >
                      {jour(t.echeance)}
                    </td>
                    <td>{t.titre}</td>
                    <td className="muted">
                      {t.opportuniteId ? (
                        <a className="link" href={`#affaire/${t.opportuniteId}`}>
                          {titreAffaire(t.opportuniteId)}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {taches.donnees.length === 0 && (
                  <tr>
                    <td className="muted">Aucune tâche ouverte.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel titre="Rendez-vous à venir">
          <div className="list">
            {rdv.donnees.map((r) => (
              <div className="item" key={r.id}>
                <b>{r.titre}</b>
                <span className="small muted">
                  {jourHeure(r.debut)}
                  {r.lieu ? ` · ${r.lieu}` : ''}
                </span>
              </div>
            ))}
            {rdv.donnees.length === 0 && <span className="muted">Aucun rendez-vous à venir.</span>}
          </div>
        </Panel>
      </div>
    </>
  );
}
