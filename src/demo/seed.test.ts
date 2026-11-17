import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../db/index.js';
import { demarrerBase } from '../test/base.js';
import { historiqueDemo, seedDemo } from './seed.js';

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
    expect(Number(rows[0]!.n)).toBe(9);
  });
});

describe('historique de démonstration', () => {
  it('date chaque étape franchie et la clôture, dans l’ordre', async () => {
    const { rows } = await base.pool.query<{
      titre: string;
      etape: string;
      dates: Record<string, string>;
      clos: string | null;
      clos_le: Date | null;
    }>(
      "select titre, etape, etapes_dates as dates, clos, clos_le from opportunites where source = 'demo' order by titre",
    );
    const ordre = ['detection', 'prospection', 'qualification', 'proposition', 'negociation'];
    for (const r of rows) {
      const attendues = ordre.slice(0, ordre.indexOf(r.etape) + 1);
      expect(Object.keys(r.dates).sort()).toEqual([...attendues].sort());
      const temps = attendues.map((e) => new Date(r.dates[e]!).getTime());
      expect(temps).toEqual([...temps].sort((a, b) => a - b));
      expect(temps.at(-1)!).toBeLessThanOrEqual(Date.now());
      expect(r.clos_le !== null).toBe(r.clos !== null);
    }
  });

  it('se rejoue sans changer ce qui existe déjà : mêmes étapes datées', async () => {
    const db = createDb(base.pool);
    expect(await historiqueDemo(db)).toBe(9);
  });
});
