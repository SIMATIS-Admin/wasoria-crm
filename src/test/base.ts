import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { buildApp } from '../app.js';
import { createDb } from '../db/index.js';
import { runMigrations } from '../migrate.js';

export const JETON = 'jeton-de-test-0123456789abcdef';

// Un Postgres jetable, migré, et l'app branchée dessus.
export async function demarrerBase() {
  const conteneur = await new PostgreSqlContainer('postgres:17').start();
  const pool = new pg.Pool({ connectionString: conteneur.getConnectionUri() });
  await runMigrations(pool);
  const app = buildApp({
    db: createDb(pool),
    apiToken: JETON,
    version: 'test',
    pingDb: async () => {
      await pool.query('select 1');
    },
  });
  return {
    app,
    pool,
    arreter: async () => {
      await app.close();
      await pool.end();
      await conteneur.stop();
    },
  };
}
