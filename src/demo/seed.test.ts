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
    expect(Number(rows[0]!.n)).toBe(11);
  });
});

describe('historique de démonstration', () => {
  it('date chaque étape franchie dans l’ordre de son pipe, et la clôture', async () => {
    const { rows } = await base.pool.query<{
      pipeline_id: string;
      etape: string;
      dates: Record<string, string>;
      clos: string | null;
      clos_le: Date | null;
    }>(
      "select pipeline_id, etape, etapes_dates as dates, clos, clos_le from opportunites where source = 'demo' order by titre",
    );
    const ordres: Record<string, string[]> = {
      vente: ['detection', 'prospection', 'qualification', 'proposition', 'negociation'],
      'apres-vente': ['installation', 'mise-en-service', 'suivi-mco', 'renouvellement'],
    };
    for (const r of rows) {
      const ordre = ordres[r.pipeline_id]!;
      const attendues = ordre.slice(0, ordre.indexOf(r.etape) + 1);
      expect(Object.keys(r.dates).sort()).toEqual([...attendues].sort());
      const temps = attendues.map((e) => new Date(r.dates[e]!).getTime());
      expect(temps).toEqual([...temps].sort((a, b) => a - b));
      expect(temps.at(-1)!).toBeLessThanOrEqual(Date.now());
      expect(r.clos_le !== null).toBe(r.clos !== null);
    }
  });

  it('les dossiers après-vente viennent d’une vente gagnée ou sont autonomes', async () => {
    const { rows } = await base.pool.query<{ titre: string; origine: string | null }>(
      "select a.titre, o.titre as origine from opportunites a left join opportunites o on o.id = a.origine_affaire_id where a.pipeline_id = 'apres-vente' order by a.titre",
    );
    expect(rows).toEqual([
      { titre: 'Démo A · contrat signé · après-vente', origine: 'Démo A · contrat signé' },
      { titre: 'Démo C · second site · après-vente', origine: null },
    ]);
  });

  it('se rejoue sans changer ce qui existe déjà : mêmes étapes datées', async () => {
    const db = createDb(base.pool);
    expect(await historiqueDemo(db)).toBe(11);
  });
});

describe('catalogue et devis de démonstration', () => {
  it('charge un catalogue fictif et trois devis qui se calculent', async () => {
    const { rows: a } = await base.pool.query<{ n: string }>(
      "select count(*) n from articles where source = 'demo'",
    );
    expect(Number(a[0]!.n)).toBe(6);
    const { rows } = await base.pool.query<{
      numero: string;
      statut: string;
      lignes: string;
      total: string;
    }>(
      'select d.numero, d.statut, count(l.id) lignes, sum(l.prix_unitaire * l.quantite) total from devis d join devis_lignes l on l.devis_id = d.id group by d.id order by d.numero',
    );
    expect(rows.map((r) => r.statut)).toEqual(['envoye', 'brouillon', 'accepte']);
    expect(rows.map((r) => Number(r.lignes))).toEqual([5, 3, 4]);
    expect(rows.every((r) => Number(r.total) > 0)).toBe(true);
  });
});
