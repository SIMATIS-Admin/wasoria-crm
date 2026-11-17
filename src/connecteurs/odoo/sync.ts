import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../db/index.js';
import { contactEntreprises, contacts, entreprises, synchronisations } from '../../db/schema.js';
import type { OdooConfig } from './config.js';
import { champsDemandes, dateModif, parentDe, versContact, versEntreprise } from './mapping.js';
import type { Domaine, Fiche, Transport } from './transport.js';

const SOURCE = 'odoo';
const TAILLE_LOT = 200;

export type Bilan = { crees: number; misAJour: number; ignores: number };
export type ResultatSynchro = { entreprises: Bilan; contacts: Bilan };

const vide = (): Bilan => ({ crees: 0, misAJour: 0, ignores: 0 });

async function lireCurseur(db: Db, objet: string): Promise<string | null> {
  const [l] = await db
    .select()
    .from(synchronisations)
    .where(and(eq(synchronisations.connecteur, SOURCE), eq(synchronisations.objet, objet)));
  return l?.curseur ?? null;
}

async function ecrireCurseur(db: Db, objet: string, curseur: string | null) {
  await db
    .insert(synchronisations)
    .values({ connecteur: SOURCE, objet, curseur, derniereExecution: new Date() })
    .onConflictDoUpdate({
      target: [synchronisations.connecteur, synchronisations.objet],
      set: { curseur, derniereExecution: new Date() },
    });
}

// Lit Odoo par lots, du plus ancien modifié au plus récent, et rend chaque lot à `traiter`.
// Retourne la date de modification la plus récente vue.
async function lireParLots(
  transport: Transport,
  domaine: Domaine,
  champs: string[],
  traiter: (lot: Fiche[]) => Promise<void>,
): Promise<string | null> {
  let decalage = 0;
  let plusRecente: string | null = null;
  for (;;) {
    const lot = await transport.searchRead('res.partner', {
      domaine,
      champs,
      limite: TAILLE_LOT,
      decalage,
      ordre: 'write_date asc, id asc',
    });
    if (lot.length === 0) break;
    await traiter(lot);
    for (const f of lot) {
      const d = dateModif(f);
      if (d && (!plusRecente || d > plusRecente)) plusRecente = d;
    }
    if (lot.length < TAILLE_LOT) break;
    decalage += TAILLE_LOT;
  }
  return plusRecente;
}

// Copie Odoo dans le CRM, sans jamais effacer : une fiche est retrouvée par (source, source_id),
// mise à jour et jamais dupliquée ; une fiche disparue d'Odoo reste ; les fiches natives ou venues
// d'ailleurs ne sont jamais touchées. Lecture seule : rien n'est écrit dans Odoo.
export async function synchroniserOdoo(
  db: Db,
  transport: Transport,
  config: Pick<OdooConfig, 'champsExclus'>,
  options: { complet?: boolean } = {},
): Promise<ResultatSynchro> {
  const resultat: ResultatSynchro = { entreprises: vide(), contacts: vide() };
  const exclus = config.champsExclus;

  const domaineDepuis = async (objet: string, base: Domaine): Promise<Domaine> => {
    const curseur = options.complet ? null : await lireCurseur(db, objet);
    return curseur ? [...base, ['write_date', '>=', curseur]] : base;
  };

  // 1. Les entreprises d'abord : les contacts s'y rattachent.
  const domE = await domaineDepuis('entreprise', [['is_company', '=', true]]);
  const finE = await lireParLots(
    transport,
    domE,
    champsDemandes('entreprise', exclus),
    async (lot) => {
      for (const p of lot) {
        const valeurs = versEntreprise(p, exclus);
        if (!valeurs || typeof p.id !== 'number') {
          resultat.entreprises.ignores++;
          continue;
        }
        const [r] = await db
          .insert(entreprises)
          .values({ ...valeurs, nom: valeurs.nom!, source: SOURCE, sourceId: String(p.id) })
          .onConflictDoUpdate({ target: [entreprises.source, entreprises.sourceId], set: valeurs })
          .returning({ cree: sql<boolean>`(xmax = 0)` });
        if (r?.cree) resultat.entreprises.crees++;
        else resultat.entreprises.misAJour++;
      }
    },
  );
  if (finE) await ecrireCurseur(db, 'entreprise', finE);

  // 2. Les contacts : personnes (pas les adresses de facturation ou de livraison).
  const domC = await domaineDepuis('contact', [
    ['is_company', '=', false],
    ['type', '=', 'contact'],
  ]);
  const finC = await lireParLots(
    transport,
    domC,
    champsDemandes('contact', exclus),
    async (lot) => {
      const parents = [...new Set(lot.map(parentDe).filter((x): x is number => x !== null))];
      const locales = parents.length
        ? await db
            .select({ id: entreprises.id, sourceId: entreprises.sourceId })
            .from(entreprises)
            .where(
              and(
                eq(entreprises.source, SOURCE),
                inArray(entreprises.sourceId, parents.map(String)),
              ),
            )
        : [];
      const parLocal = new Map(locales.map((e) => [e.sourceId, e.id]));

      for (const p of lot) {
        const valeurs = versContact(p, exclus);
        if (!valeurs || typeof p.id !== 'number') {
          resultat.contacts.ignores++;
          continue;
        }
        const parent = parentDe(p);
        const entrepriseId = parent === null ? null : (parLocal.get(String(parent)) ?? undefined);
        // Parent pas (encore) copié : on ne touche pas au lien existant.
        const ecrit = entrepriseId === undefined ? valeurs : { ...valeurs, entrepriseId };
        const [r] = await db
          .insert(contacts)
          .values({ ...ecrit, nom: valeurs.nom!, source: SOURCE, sourceId: String(p.id) })
          .onConflictDoUpdate({ target: [contacts.source, contacts.sourceId], set: ecrit })
          .returning({ id: contacts.id, cree: sql<boolean>`(xmax = 0)` });
        if (r?.cree) resultat.contacts.crees++;
        else resultat.contacts.misAJour++;
        if (r && entrepriseId) {
          await db
            .insert(contactEntreprises)
            .values({ contactId: r.id, entrepriseId, principal: true, source: SOURCE })
            .onConflictDoNothing();
        }
      }
    },
  );
  if (finC) await ecrireCurseur(db, 'contact', finC);

  return resultat;
}
