import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../migrate.js';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;
let pool: pg.Pool;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17').start();
  pool = new pg.Pool({ connectionString: container.getConnectionUri() });
  await runMigrations(pool);
}, 120_000);

afterAll(async () => {
  await pool.end();
  await container.stop();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('schéma CRM', () => {
  it('crée les objets du CRM de SIMATIS OS', async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    const noms = rows.map((r) => r.table_name);
    for (const t of [
      'entreprises',
      'contacts',
      'opportunites',
      'taches',
      'rendez_vous',
      'activites',
    ]) {
      expect(noms).toContain(t);
    }
  });

  it('une fiche se retrouve par (source, source_id) : pas de doublon', async () => {
    await pool.query("insert into entreprises (nom, source, source_id) values ('A', 'odoo', '42')");
    await expect(
      pool.query("insert into entreprises (nom, source, source_id) values ('B', 'odoo', '42')"),
    ).rejects.toThrow();
  });

  it('une modification fait bouger updated_at', async () => {
    const { rows } = await pool.query<{ id: string; updated_at: Date }>(
      "insert into entreprises (nom) values ('C') returning id, updated_at",
    );
    const { id, updated_at } = rows[0]!;
    await sleep(20);
    const maj = await pool.query<{ updated_at: Date }>(
      "update entreprises set ville = 'Lyon' where id = $1 returning updated_at",
      [id],
    );
    expect(maj.rows[0]!.updated_at.getTime()).toBeGreaterThan(updated_at.getTime());
  });

  it("un lien modifié fait bouger la fiche qu'il décrit", async () => {
    const c = await pool.query<{ id: string; updated_at: Date }>(
      "insert into contacts (nom) values ('Alice') returning id, updated_at",
    );
    const e = await pool.query<{ id: string }>(
      "insert into entreprises (nom) values ('D') returning id",
    );
    const contact = c.rows[0]!;
    await sleep(20);
    await pool.query(
      'insert into contact_entreprises (contact_id, entreprise_id) values ($1, $2)',
      [contact.id, e.rows[0]!.id],
    );
    const apres = await pool.query<{ updated_at: Date }>(
      'select updated_at from contacts where id = $1',
      [contact.id],
    );
    expect(apres.rows[0]!.updated_at.getTime()).toBeGreaterThan(contact.updated_at.getTime());
  });
});
