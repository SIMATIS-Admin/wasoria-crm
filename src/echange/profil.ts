import { and, asc, desc, eq, gte, inArray, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db } from '../db/index.js';
import {
  activites,
  affaireContacts,
  affaireEntreprises,
  contactEmails,
  contactEntreprises,
  contacts,
  entreprises,
  etapes,
  opportunites,
  rdvAffaires,
  rdvContacts,
  rdvEntreprises,
  rendezVous,
  taches,
} from '../db/schema.js';

// Les fiches du CRM dans les champs du profil crm/1 de SIMATIS OS (kit os-agents-relay) : mêmes
// noms (snake_case), mêmes liens. Ce que lit le connecteur de l'OS.

export const OBJETS_ECHANGE = [
  'entreprise',
  'contact',
  'affaire',
  'tache',
  'rendez_vous',
  'activite',
] as const;
export type ObjetEchange = (typeof OBJETS_ECHANGE)[number];

export type Lien = string | string[] | null;
export type FicheEchange = {
  id: string;
  source: string;
  source_id: string | null;
  modifie_le: string;
  champs: Record<string, unknown>;
  liens: Record<string, Lien>;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
// Le lien principal d'abord, puis les autres, sans doublon.
const unique = (principal: string | null, autres: string[] = []) => [
  ...new Set([principal, ...autres].filter((x): x is string => !!x)),
];

type Colonnes = {
  proprio: AnyPgColumn;
  cible: AnyPgColumn;
  principal?: AnyPgColumn;
  creeLe: AnyPgColumn;
};

// Liens plusieurs-à-plusieurs d'un lot de fiches : proprio → cibles, principale d'abord.
async function liensDe(db: Db, table: PgTable, c: Colonnes, ids: string[]) {
  const parProprio = new Map<string, string[]>();
  if (ids.length === 0) return parProprio;
  const lignes = (await db
    .select({ proprio: c.proprio, cible: c.cible })
    .from(table)
    .where(inArray(c.proprio, ids))
    .orderBy(...(c.principal ? [desc(c.principal)] : []), asc(c.creeLe))) as {
    proprio: string;
    cible: string;
  }[];
  for (const l of lignes)
    parProprio.set(l.proprio, [...(parProprio.get(l.proprio) ?? []), l.cible]);
  return parProprio;
}

const fenetre = (
  t: { updatedAt: AnyPgColumn; id: AnyPgColumn },
  depuis: Date | null,
): SQL | undefined => (depuis ? gte(t.updatedAt, depuis) : undefined);

export type Page = { depuis: Date | null; limite: number; decalage: number };

// Du plus anciennement modifié au plus récent : une page se lit dans l'ordre et se reprend à son
// dernier `modifie_le`. `depuis` inclut sa borne : relire une fiche deux fois est sans effet.
export async function lireFiches(db: Db, objet: ObjetEchange, page: Page): Promise<FicheEchange[]> {
  const { depuis, limite, decalage } = page;
  switch (objet) {
    case 'entreprise': {
      const rows = await db
        .select()
        .from(entreprises)
        .where(fenetre(entreprises, depuis))
        .orderBy(asc(entreprises.updatedAt), asc(entreprises.id))
        .limit(limite)
        .offset(decalage);
      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        source_id: r.sourceId,
        modifie_le: r.updatedAt.toISOString(),
        champs: {
          nom: r.nom,
          secteur: r.secteur,
          ville: r.ville,
          taille: r.taille,
          domaine: r.domaine,
        },
        liens: {},
      }));
    }
    case 'contact': {
      const rows = await db
        .select()
        .from(contacts)
        .where(fenetre(contacts, depuis))
        .orderBy(asc(contacts.updatedAt), asc(contacts.id))
        .limit(limite)
        .offset(decalage);
      const ids = rows.map((r) => r.id);
      const ents = await liensDe(
        db,
        contactEntreprises,
        {
          proprio: contactEntreprises.contactId,
          cible: contactEntreprises.entrepriseId,
          principal: contactEntreprises.principal,
          creeLe: contactEntreprises.createdAt,
        },
        ids,
      );
      const mails = await liensDe(
        db,
        contactEmails,
        {
          proprio: contactEmails.contactId,
          cible: contactEmails.email,
          principal: contactEmails.principal,
          creeLe: contactEmails.createdAt,
        },
        ids,
      );
      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        source_id: r.sourceId,
        modifie_le: r.updatedAt.toISOString(),
        champs: {
          nom: r.nom,
          fonction: r.fonction,
          email: r.email,
          emails: unique(r.email, mails.get(r.id)),
          telephone: r.telephone,
          role: r.role,
        },
        liens: { entreprises: unique(r.entrepriseId, ents.get(r.id)) },
      }));
    }
    case 'affaire': {
      const rows = await db
        .select()
        .from(opportunites)
        .where(fenetre(opportunites, depuis))
        .orderBy(asc(opportunites.updatedAt), asc(opportunites.id))
        .limit(limite)
        .offset(decalage);
      const ids = rows.map((r) => r.id);
      const cts = await liensDe(
        db,
        affaireContacts,
        {
          proprio: affaireContacts.opportuniteId,
          cible: affaireContacts.contactId,
          principal: affaireContacts.principal,
          creeLe: affaireContacts.createdAt,
        },
        ids,
      );
      const ents = await liensDe(
        db,
        affaireEntreprises,
        {
          proprio: affaireEntreprises.opportuniteId,
          cible: affaireEntreprises.entrepriseId,
          principal: affaireEntreprises.principal,
          creeLe: affaireEntreprises.createdAt,
        },
        ids,
      );
      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        source_id: r.sourceId,
        modifie_le: r.updatedAt.toISOString(),
        champs: {
          titre: r.titre,
          etape: r.etape,
          montant: r.montant,
          echeance: r.echeance,
          clos: r.clos,
          motif: r.motif,
          proprietaire: r.proprietaire,
          origine: r.origine,
          prochaine_etape: r.prochaineEtape,
          mode_facturation: r.modeFacturation,
          duree_engagement_mois: r.dureeEngagementMois,
          tacite_reconduction: r.taciteReconduction,
          probabilite_manuelle: r.probabiliteManuelle,
          derniere_activite: iso(r.derniereActivite),
          etapes_dates: r.etapesDates,
          qualification: r.qualification,
          potentiel: r.potentiel,
          faisabilite: r.faisabilite,
        },
        liens: {
          contacts: unique(r.contactId, cts.get(r.id)),
          entreprises: unique(r.entrepriseId, ents.get(r.id)),
        },
      }));
    }
    case 'tache': {
      const rows = await db
        .select()
        .from(taches)
        .where(fenetre(taches, depuis))
        .orderBy(asc(taches.updatedAt), asc(taches.id))
        .limit(limite)
        .offset(decalage);
      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        source_id: r.sourceId,
        modifie_le: r.updatedAt.toISOString(),
        champs: {
          titre: r.titre,
          type: r.type,
          echeance: iso(r.echeance),
          avec_heure: r.avecHeure,
          duree_minutes: r.dureeMinutes,
          occupe: r.occupe,
          fait_at: iso(r.faitAt),
          notes: r.notes,
        },
        liens: { contact: r.contactId, entreprise: r.entrepriseId, affaire: r.opportuniteId },
      }));
    }
    case 'rendez_vous': {
      // Seuls les rendez-vous classés commerciaux, avec un début, sont partagés.
      const rows = await db
        .select()
        .from(rendezVous)
        .where(and(fenetre(rendezVous, depuis), eq(rendezVous.statut, 'rdv')))
        .orderBy(asc(rendezVous.updatedAt), asc(rendezVous.id))
        .limit(limite)
        .offset(decalage);
      const ids = rows.map((r) => r.id);
      const lien = (
        table: PgTable,
        cible: AnyPgColumn,
        proprio: AnyPgColumn,
        creeLe: AnyPgColumn,
      ) => liensDe(db, table, { proprio, cible, creeLe }, ids);
      const [cts, ents, aff] = await Promise.all([
        lien(rdvContacts, rdvContacts.contactId, rdvContacts.rendezVousId, rdvContacts.createdAt),
        lien(
          rdvEntreprises,
          rdvEntreprises.entrepriseId,
          rdvEntreprises.rendezVousId,
          rdvEntreprises.createdAt,
        ),
        lien(
          rdvAffaires,
          rdvAffaires.opportuniteId,
          rdvAffaires.rendezVousId,
          rdvAffaires.createdAt,
        ),
      ]);
      return rows
        .filter((r) => r.debut)
        .map((r) => ({
          id: r.id,
          source: r.source,
          source_id: r.sourceId,
          modifie_le: r.updatedAt.toISOString(),
          champs: {
            titre: r.titre,
            debut: iso(r.debut),
            fin: iso(r.fin),
            lieu: r.lieu,
            compte_rendu: r.compteRendu,
            compte_rendu_at: iso(r.compteRenduAt),
          },
          liens: {
            contacts: cts.get(r.id) ?? [],
            entreprises: ents.get(r.id) ?? [],
            affaires: aff.get(r.id) ?? [],
          },
        }));
    }
    case 'activite': {
      const rows = await db
        .select()
        .from(activites)
        .where(fenetre(activites, depuis))
        .orderBy(asc(activites.updatedAt), asc(activites.id))
        .limit(limite)
        .offset(decalage);
      return rows.map((r) => ({
        id: r.id,
        source: r.source,
        source_id: r.sourceId,
        modifie_le: r.updatedAt.toISOString(),
        champs: { type: r.type, at: r.at.toISOString(), titre: r.titre, resume: r.resume },
        liens: { contact: r.contactId, entreprise: r.entrepriseId, affaire: r.opportuniteId },
      }));
    }
  }
}

export async function lireEtapes(db: Db) {
  return db.select().from(etapes).orderBy(asc(etapes.ordre));
}
