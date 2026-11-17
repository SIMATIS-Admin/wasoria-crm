import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/index.js';
import { demarrerBase } from '../test/base.js';
import { seedDemo } from './seed.js';

let base: Awaited<ReturnType<typeof demarrerBase>>;
beforeAll(async () => {
  base = await demarrerBase();
}, 120_000);
afterAll(async () => {
  await base.arreter();
});

describe('données de démonstration', () => {
  it('se chargent une fois, dans une base vide, marquées demo', async () => {
    const db = createDb(base.pool);
    expect(await seedDemo(db)).toBe(true);
    expect(await seedDemo(db)).toBe(false);
    const { rows } = await base.pool.query<{ n: string }>(
      "select count(*) n from opportunites where source = 'demo'",
    );
    expect(Number(rows[0]!.n)).toBe(8);
  });
});
