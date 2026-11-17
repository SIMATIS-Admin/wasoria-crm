import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type pg from 'pg';

export async function runMigrations(pool: pg.Pool): Promise<void> {
  await migrate(drizzle(pool), {
    migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
  });
}
