import pg from 'pg';
import { count } from 'drizzle-orm';
import { createDb, type Db } from '../db/index.js';
import {
  activites,
  contacts,
  entreprises,
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
  return true;
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
  const fait = await seedDemo(createDb(pool));
  console.log(fait ? 'Données de démonstration chargées.' : 'Base non vide : rien chargé.');
  await pool.end();
}
