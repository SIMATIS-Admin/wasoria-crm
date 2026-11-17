import pg from 'pg';
import { buildApp } from './app.js';
import { loadConfig, type Config } from './config.js';
import { runMigrations } from './migrate.js';

let config: Config;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.databaseUrl });
await runMigrations(pool);

const app = buildApp({
  pingDb: async () => {
    await pool.query('select 1');
  },
  version: process.env.npm_package_version ?? '0.0.0',
});
await app.listen({ host: '0.0.0.0', port: config.port });
