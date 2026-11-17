import pg from 'pg';
import { asc, count, eq } from 'drizzle-orm';
import { createDb, type Db } from '../db/index.js';
import {
  activites,
  contacts,
  entreprises,
  etapes,
  opportunites,
  rendezVous,
  taches,
} from '../db/schema.js';
import { runMigrations } from '../migrate.js';
import {
  AFFAIRES,
  CONTACTS,
  ENTREPRISES,
  RENDEZ_VOUS,
  SUIVI,
  TACHES,
  dansJours,
} from './donnees.js';

// Charge les données fictives, uniquement dans une base vide. `source = 'demo'` les distingue.
export async function seedDemo(db: Db): Promise<boolean> {
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(entreprises);
  if (n > 0) return false;
  await db.transaction(async (tx) => {
    const e = new Map<string, string>();
    for (const x of ENTREPRISES) {
      const [r] = await tx
        .insert(entreprises)
        .values({
          nom: x.nom,
          secteur: x.secteur,
          ville: x.ville,
          taille: x.taille,
          source: 'demo',
        })
        .returning({ id: entreprises.id });
      e.set(x.cle, r!.id);
    }
    const c = new Map<string, string>();
    for (const x of CONTACTS) {
      const [r] = await tx
        .insert(contacts)
        .values({
          entrepriseId: e.get(x.e)!,
          nom: x.nom,
          fonction: x.fonction,
          email: x.email,
          source: 'demo',
        })
        .returning({ id: contacts.id });
      c.set(x.cle, r!.id);
    }
    const a = new Map<string, string>();
    for (const x of AFFAIRES) {
      const [r] = await tx
        .insert(opportunites)
        .values({
          entrepriseId: e.get(x.e)!,
          contactId: c.get(x.c)!,
          titre: x.titre,
          etape: x.etape,
          montant: x.montant,
          echeance: x.echeance,
          proprietaire: x.proprietaire,
          origine: x.origine,
          prochaineEtape: x.prochaineEtape,
          qualification: x.qualification,
          etapesDates: { [x.etape]: new Date().toISOString() },
          clos: x.clos ?? null,
          closLe: x.clos ? new Date() : null,
          source: 'demo',
        })
        .returning({ id: opportunites.id });
      a.set(x.cle, r!.id);
    }
    for (const t of TACHES) {
      const type = t.type as 'appel' | 'email' | 'tache' | 'reunion';
      await tx.insert(taches).values({
        opportuniteId: a.get(t.a)!,
        titre: t.titre,
        type,
        canal: type === 'appel' || type === 'email' ? type : 'tache',
        echeance: dansJours(t.jours),
        source: 'demo',
      });
    }
    for (const r of RENDEZ_VOUS) {
      await tx.insert(rendezVous).values({
        titre: r.titre,
        debut: dansJours(r.jours, 10),
        fin: dansJours(r.jours, 11),
        lieu: r.lieu,
        statut: r.statut,
        tri: r.statut === 'rdv' ? 'manuel' : 'aucun',
        source: 'demo',
      });
    }
    for (const s of SUIVI) {
      await tx.insert(activites).values({
        opportuniteId: a.get(s.a)!,
        type: s.type,
        titre: s.titre,
        resume: s.resume,
        at: dansJours(s.jours),
        source: 'demo',
      });
    }
  });
  await historiqueDemo(db);
  return true;
}

// Donne aux affaires de démonstration un parcours daté, étape par étape, pour que les indicateurs aient
// de quoi calculer. Les délais varient de 8 à 16 jours selon l'affaire et l'étape. Sans effet sur les
// fiches qui ne viennent pas de la démonstration.
export async function historiqueDemo(db: Db): Promise<number> {
  const ordre = (await db.select({ id: etapes.id }).from(etapes).orderBy(asc(etapes.ordre))).map(
    (e) => e.id,
  );
  const affaires = await db
    .select({ id: opportunites.id, etape: opportunites.etape, clos: opportunites.clos })
    .from(opportunites)
    .where(eq(opportunites.source, 'demo'))
    .orderBy(asc(opportunites.titre));
  const maintenant = Date.now();
  const jour = 86_400_000;
  for (const [j, a] of affaires.entries()) {
    const dernier = Math.max(0, ordre.indexOf(a.etape));
    let t = maintenant - (120 - 5 * j) * jour;
    const creee = new Date(t);
    const dates: Record<string, string> = {};
    for (const [k, id] of ordre.slice(0, dernier + 1).entries()) {
      if (k > 0) t += (8 + ((j * 3 + k * 5) % 9)) * jour;
      dates[id] = new Date(t).toISOString();
    }
    await db
      .update(opportunites)
      .set({
        etapesDates: dates,
        createdAt: creee,
        closLe: a.clos ? new Date(Math.min(t + 10 * jour, maintenant)) : null,
      })
      .where(eq(opportunites.id, a.id));
  }
  return affaires.length;
}

// Lancé en ligne de commande : npm run demo:seed
if (process.argv[1]?.endsWith('seed.ts')) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL est obligatoire');
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: url });
  await runMigrations(pool);
  const db = createDb(pool);
  if (process.argv.includes('--historique')) {
    console.log(`Parcours daté ajouté à ${await historiqueDemo(db)} affaire(s) de démonstration.`);
  } else {
    const fait = await seedDemo(db);
    console.log(fait ? 'Données de démonstration chargées.' : 'Base non vide : rien chargé.');
  }
  await pool.end();
}
