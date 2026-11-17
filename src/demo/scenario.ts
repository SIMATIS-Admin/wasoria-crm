import { sql } from 'drizzle-orm';
import type { Db } from '../db/index.js';
import { etapes, indicateurs } from '../db/schema.js';
import { ETAPES_DEFAUT, INDICATEURS_DEFAUT } from './defauts.js';
import { seedDemo } from './seed.js';

// Remet le CRM à l'état du scénario de démonstration : efface toutes les données de travail
// (entreprises, contacts, affaires, tâches, rendez-vous, devis, catalogue, historique), rétablit les
// étapes et les indicateurs de départ, puis recharge les données fictives. Les comptes, leurs sessions
// et les pipes sont conservés. À n'appeler qu'en mode démonstration.
export async function chargerScenarioDemo(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`TRUNCATE
      devis_lignes, devis, articles,
      rdv_contacts, rdv_entreprises, rdv_affaires,
      affaire_contacts, affaire_entreprises, contact_entreprises, contact_emails,
      activites, taches, rendez_vous, opportunites, contacts, entreprises,
      suppressions, synchronisations
      CASCADE`);
    await tx.delete(indicateurs);
    await tx.delete(etapes);
    await tx.insert(etapes).values(ETAPES_DEFAUT);
    await tx.insert(indicateurs).values(INDICATEURS_DEFAUT);
  });
  await seedDemo(db);
}
