import { useState, type FormEvent } from 'react';
import { Logo } from '../Logo';
import { appel, ErreurApi } from '../api';
import { eur, eur2, jourLong } from '../format';
import { useRole } from '../role';
import type { Article, DevisDetail, LigneDevis, StatutDevis } from '../types';
import { useApi } from '../useApi';
import { Chargement, Pill } from '../ui';
import { STATUTS } from './DevisListe';

const DUREES = [36, 48, 60];

export function Devis({ id }: { id: string }) {
  const { peutEcrire, peutModifierAffaire } = useRole();
  const charge = useApi<DevisDetail>(`/devis/${id}`);
  const articles = useApi<Article[]>('/articles');
  const [erreur, setErreur] = useState<string | null>(null);
  const [maj, setMaj] = useState<DevisDetail | null>(null);

  // La dernière version reçue du serveur l'emporte : chaque modification renvoie le devis complet.
  const d = maj ?? charge.donnees;
  if (!d || !articles.donnees) return <Chargement erreur={charge.erreur ?? articles.erreur} />;

  const droit = peutEcrire && peutModifierAffaire(d.affaire?.pipelineId ?? 'vente');
  const modifiable = droit && d.statut === 'brouillon';

  async function envoyer(action: () => Promise<DevisDetail>) {
    setErreur(null);
    try {
      setMaj(await action());
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Enregistrement impossible');
    }
  }
  const patch = (corps: object) =>
    envoyer(() => appel<DevisDetail>('PATCH', `/devis/${id}`, corps));
  const lignes = (l: LigneDevis[]) =>
    envoyer(() => appel<DevisDetail>('PUT', `/devis/${id}/lignes`, { lignes: l }));

  const ajouter = (e: FormEvent<HTMLSelectElement>) => {
    const articleId = e.currentTarget.value;
    if (!articleId) return;
    const a = articles.donnees?.find((x) => x.id === articleId);
    if (!a) return;
    void lignes([
      ...d.lignes,
      {
        articleId: a.id,
        designation: a.nom,
        prixUnitaire: a.prix,
        recurrent: a.recurrent,
        quantite: 1,
      },
    ]);
    e.currentTarget.value = '';
  };
  const changer = (i: number, partie: Partial<LigneDevis>) =>
    void lignes(d.lignes.map((l, j) => (j === i ? { ...l, ...partie } : l)));
  const retirer = (i: number) => void lignes(d.lignes.filter((_, j) => j !== i));

  const abo = d.formule === 'abonnement';
  const t = d.totaux;
  const STATUT_SUIVANTS: Record<StatutDevis, { vers: StatutDevis; label: string }[]> = {
    brouillon: [{ vers: 'envoye', label: 'Marquer comme envoyé' }],
    envoye: [
      { vers: 'accepte', label: 'Accepté' },
      { vers: 'refuse', label: 'Refusé' },
      { vers: 'brouillon', label: 'Repasser en brouillon' },
    ],
    accepte: [{ vers: 'envoye', label: 'Rouvrir' }],
    refuse: [{ vers: 'envoye', label: 'Rouvrir' }],
  };

  return (
    <>
      <div className="ne-pas-imprimer">
        <a className="link" href={d.affaire ? `#affaire/${d.affaire.id}` : '#devis'}>
          ← {d.affaire ? d.affaire.titre : 'Devis'}
        </a>
        <h2 className="titre-fiche">
          {d.numero} <Pill classe={STATUTS[d.statut].classe}>{STATUTS[d.statut].label}</Pill>
        </h2>
      </div>
      {erreur && <div className="alert ne-pas-imprimer">{erreur}</div>}
      <div className="dv">
        <div className="panel ne-pas-imprimer">
          <div className="panel-b grid">
            {!modifiable && droit && (
              <p className="muted small">
                Devis {STATUTS[d.statut].label.toLowerCase()} : repassez-le en brouillon pour le
                modifier.
              </p>
            )}
            <div className="barre-choix">
              <div className="seg" role="group" aria-label="Formule">
                {(['achat', 'abonnement'] as const).map((f) => (
                  <button
                    key={f}
                    className={d.formule === f ? 'on' : ''}
                    disabled={!modifiable}
                    onClick={() => void patch({ formule: f })}
                  >
                    {f === 'achat' ? 'Achat' : 'Abonnement'}
                  </button>
                ))}
              </div>
              {abo && (
                <div className="seg" role="group" aria-label="Durée">
                  {DUREES.map((m) => (
                    <button
                      key={m}
                      className={d.dureeMois === m ? 'on' : ''}
                      disabled={!modifiable}
                      onClick={() => void patch({ dureeMois: m })}
                    >
                      {m} mois
                    </button>
                  ))}
                </div>
              )}
              {abo && (
                <label className="taux">
                  <span className="lbl">Taux (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.1}
                    disabled={!modifiable}
                    aria-label="Taux de financement en pourcent"
                    defaultValue={d.tauxCentiemes / 100}
                    key={d.tauxCentiemes}
                    onBlur={(e) => {
                      const v = Math.round(Number(e.target.value) * 100);
                      if (e.target.value !== '' && v !== d.tauxCentiemes)
                        void patch({ tauxCentiemes: v });
                    }}
                  />
                </label>
              )}
            </div>

            <div className="tbl-wrap">
              <table className="lines">
                <tbody>
                  {d.lignes.map((l, i) => (
                    <tr key={`${i}-${l.articleId ?? l.designation}`}>
                      <td>{l.designation}</td>
                      <td>
                        <input
                          type="number"
                          min={1}
                          aria-label={`Quantité de ${l.designation}`}
                          disabled={!modifiable}
                          defaultValue={l.quantite}
                          onBlur={(e) => {
                            const v = Math.max(1, Math.round(Number(e.target.value)));
                            if (v !== l.quantite) changer(i, { quantite: v });
                          }}
                        />
                      </td>
                      <td className="num droite">
                        {eur(l.prixUnitaire * l.quantite)}
                        {l.recurrent && <span className="muted"> /an</span>}
                      </td>
                      <td>
                        {modifiable && (
                          <button
                            className="x"
                            aria-label={`Retirer ${l.designation}`}
                            onClick={() => retirer(i)}
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {d.lignes.length === 0 && (
                    <tr>
                      <td className="muted">Aucune ligne : ajoutez un article.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {modifiable && (
              <label className="champ">
                <span className="lbl">Ajouter un article</span>
                <select aria-label="Ajouter un article" defaultValue="" onChange={ajouter}>
                  <option value="">+ Choisir dans le catalogue</option>
                  {articles.donnees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nom} · {eur(a.prix)}
                      {a.recurrent ? ' /an' : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="champ">
              <span className="lbl">Notre proposition (texte du devis)</span>
              <textarea
                rows={3}
                disabled={!modifiable}
                aria-label="Texte de la proposition"
                defaultValue={d.intro ?? ''}
                key={d.statut}
                onBlur={(e) => {
                  if (e.target.value !== (d.intro ?? ''))
                    void patch({ intro: e.target.value || null });
                }}
              />
            </label>

            <div className="total">
              <span className="muted">
                {abo ? `Abonnement ${d.dureeMois} mois` : 'Total première année'}
              </span>
              <span className="v num">
                {abo ? `${eur2(t.mensualite)} / mois` : eur(t.totalPremiereAnnee)}
              </span>
            </div>
            <div className="actions">
              {droit &&
                STATUT_SUIVANTS[d.statut].map((s) => (
                  <button
                    key={s.vers}
                    className={s.vers === 'envoye' || s.vers === 'accepte' ? 'cta' : 'ghost'}
                    onClick={() => void patch({ statut: s.vers })}
                  >
                    {s.label}
                  </button>
                ))}
              <button className="ghost" onClick={() => window.print()}>
                Imprimer / PDF
              </button>
            </div>
          </div>
        </div>

        <div className="paper" aria-label="Aperçu du devis">
          <div className="ph">
            <div className="logo-devis">
              <Logo />
            </div>
            <div className="droite">
              <b>Devis {d.numero}</b>
              <br />
              {jourLong(d.envoyeLe ?? d.createdAt)}
            </div>
          </div>
          <div>
            <b>{d.entreprise?.nom ?? 'Client'}</b>
            <br />
            {d.contact && (
              <>
                {d.contact.nom}
                {d.contact.fonction ? `, ${d.contact.fonction}` : ''}
                <br />
              </>
            )}
            {d.entreprise?.ville}
          </div>
          {d.intro && (
            <div className="blk">
              <b>Notre proposition</b>
              {d.intro}
            </div>
          )}
          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Désignation</th>
                <th>Qté</th>
                <th className="droite">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              {d.lignes.map((l, i) => (
                <tr key={i}>
                  <td>{l.designation}</td>
                  <td className="num">{l.quantite}</td>
                  <td className="num droite">
                    {eur(l.prixUnitaire * l.quantite)}
                    {l.recurrent ? ' /an' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tot">
            {abo ? (
              <>
                <div className="g">
                  <span>Abonnement {d.dureeMois} mois</span>
                  <span className="num">{eur2(t.mensualite)} / mois</span>
                </div>
                <div className="discret">
                  <span>Investissement financé ({d.tauxCentiemes / 100} %)</span>
                  <span className="num">{eur(t.investissement)}</span>
                </div>
                <div className="discret">
                  <span>Services annuels inclus</span>
                  <span className="num">{eur(t.servicesAnnuels)} /an</span>
                </div>
                <div className="discret">
                  <span>Total sur {d.dureeMois} mois</span>
                  <span className="num">{eur(t.totalSurDuree)}</span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>Investissement</span>
                  <span className="num">{eur(t.investissement)}</span>
                </div>
                <div>
                  <span>Services annuels</span>
                  <span className="num">{eur(t.servicesAnnuels)}</span>
                </div>
                <div className="g">
                  <span>Total la première année</span>
                  <span className="num">{eur(t.totalPremiereAnnee)}</span>
                </div>
              </>
            )}
          </div>
          <p className="mentions">Montants en euros, hors taxes.</p>
        </div>
      </div>
    </>
  );
}
