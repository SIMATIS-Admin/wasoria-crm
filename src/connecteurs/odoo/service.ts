import type { Db } from '../../db/index.js';
import type { OdooConfig } from './config.js';
import { synchroniserOdoo, type ResultatSynchro } from './sync.js';
import { creerTransport, type Transport } from './transport.js';

export type ServiceOdoo = {
  verifier: () => Promise<string>;
  synchroniser: (options?: { complet?: boolean }) => Promise<ResultatSynchro>;
};

// Une seule synchro à la fois : deux lancements en parallèle se marcheraient dessus.
export function creerServiceOdoo(
  db: Db,
  config: OdooConfig,
  transport: Transport = creerTransport(config),
): ServiceOdoo {
  let enCours = false;
  return {
    verifier: () => transport.verifier(),
    async synchroniser(options) {
      if (enCours) throw new Error('Une synchronisation Odoo est déjà en cours');
      enCours = true;
      try {
        return await synchroniserOdoo(db, transport, config, options);
      } finally {
        enCours = false;
      }
    },
  };
}
