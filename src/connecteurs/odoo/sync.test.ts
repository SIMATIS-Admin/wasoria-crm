import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../../db/index.js';
import { contactEntreprises, contacts, entreprises } from '../../db/schema.js';
import { demarrerBase } from '../../test/base.js';
import { synchroniserOdoo } from './sync.js';
import type { Domaine, Fiche, Transport } from './transport.js';

// Un faux Odoo en mémoire : filtre, trie et pagine comme search_read.
function fauxOdoo(partenaires: Fiche[]): Transport & { appels: number; partenaires: Fiche[] } {
  const faux = {
    appels: 0,
    partenaires,
    searchRead(_modele: string, o: { domaine: Domaine; limite: number; decalage: number }) {
      faux.appels++;
      const garde = faux.partenaires.filter((p) =>
        o.domaine.every(([champ, op, valeur]) => {
          const v = p[champ as string];
          return op === '=' ? v === valeur : String(v) >= String(valeur);
        }),
      );
      garde.sort(
        (a, b) =>
          String(a.write_date).localeCompare(String(b.write_date)) || Number(a.id) - Number(b.id),
      );
      return Promise.resolve(garde.slice(o.decalage, o.decalage + o.limite));
    },
    verifier: () => Promise.resolve('faux'),
  };
  return faux;
}

const societe = (id: number, name: string, write_date: string, extra: Fiche = {}): Fiche => ({
  id,
  name,
  is_company: true,
  type: 'contact',
  parent_id: false,
  write_date,
  city: false,
  website: false,
  industry_id: false,
  ...extra,
});
const personne = (
  id: number,
  name: string,
  parent: number | false,
  write_date: string,
  extra: Fiche = {},
): Fiche => ({
  id,
  name,
  is_company: false,
  type: 'contact',
  write_date,
  parent_id: parent === false ? false : [parent, 'x'],
  function: false,
  email: false,
  phone: false,
  mobile: false,
  ...extra,
});

let base: Awaited<ReturnType<typeof demarrerBase>>;
beforeAll(async () => {
  base = await demarrerBase();
}, 120_000);
afterAll(async () => {
  await base.arreter();
});
const db = () => createDb(base.pool);
const sans = { champsExclus: new Set<string>() };

describe('synchro Odoo → CRM', () => {
  it('copie entreprises et contacts, rattache les contacts, sans doublon au second passage', async () => {
    const odoo = fauxOdoo([
      societe(1, 'Société Un', '2026-01-01 10:00:00', {
        city: 'Ville-Test',
        website: 'https://www.un.test',
        industry_id: [1, 'Industrie'],
      }),
      personne(10, 'Alex Exemple', 1, '2026-01-02 10:00:00', {
        function: 'DG',
        email: 'alex@un.test',
      }),
      { ...personne(11, 'Adresse de facturation', 1, '2026-01-02 11:00:00'), type: 'invoice' },
    ]);
    const un = await synchroniserOdoo(db(), odoo, sans);
    expect(un.entreprises).toEqual({ crees: 1, misAJour: 0, ignores: 0 });
    expect(un.contacts).toEqual({ crees: 1, misAJour: 0, ignores: 0 });

    const [e] = await db().select().from(entreprises).where(eq(entreprises.sourceId, '1'));
    expect(e).toMatchObject({
      nom: 'Société Un',
      ville: 'Ville-Test',
      domaine: 'un.test',
      secteur: 'Industrie',
      source: 'odoo',
    });
    const [c] = await db().select().from(contacts).where(eq(contacts.sourceId, '10'));
    expect(c).toMatchObject({ nom: 'Alex Exemple', entrepriseId: e!.id, fonction: 'DG' });
    expect(
      await db().select().from(contactEntreprises).where(eq(contactEntreprises.contactId, c!.id)),
    ).toHaveLength(1);

    const deux = await synchroniserOdoo(db(), odoo, sans, { complet: true });
    expect(deux.entreprises.crees + deux.contacts.crees).toBe(0);
    expect(
      await db().select().from(entreprises).where(eq(entreprises.source, 'odoo')),
    ).toHaveLength(1);
  });

  it('ne relit que ce qui a changé, et un champ vidé dans Odoo vide la copie', async () => {
    const odoo = fauxOdoo([
      societe(20, 'Société Deux', '2026-02-01 10:00:00', { city: 'Ville-A' }),
    ]);
    await synchroniserOdoo(db(), odoo, sans);
    odoo.partenaires = [societe(20, 'Société Deux bis', '2026-02-05 10:00:00', { city: false })];
    const r = await synchroniserOdoo(db(), odoo, sans);
    expect(r.entreprises.misAJour).toBe(1);
    const [e] = await db().select().from(entreprises).where(eq(entreprises.sourceId, '20'));
    expect(e).toMatchObject({ nom: 'Société Deux bis', ville: null });

    odoo.partenaires = [societe(20, 'Ne doit pas passer', '2026-02-03 10:00:00')];
    const vide = await synchroniserOdoo(db(), odoo, sans);
    expect(vide.entreprises).toEqual({ crees: 0, misAJour: 0, ignores: 0 });
  });

  it('n’efface jamais : une fiche disparue d’Odoo reste', async () => {
    const odoo = fauxOdoo([societe(30, 'Société Trois', '2026-03-01 10:00:00')]);
    await synchroniserOdoo(db(), odoo, sans);
    odoo.partenaires = [];
    await synchroniserOdoo(db(), odoo, sans, { complet: true });
    expect(
      await db().select().from(entreprises).where(eq(entreprises.sourceId, '30')),
    ).toHaveLength(1);
  });

  it('ne touche pas aux fiches natives, même de même nom', async () => {
    const [natif] = await db()
      .insert(entreprises)
      .values({ nom: 'Société Quatre', ville: 'Locale' })
      .returning();
    await synchroniserOdoo(
      db(),
      fauxOdoo([societe(40, 'Société Quatre', '2026-04-01 10:00:00', { city: 'Odoo' })]),
      sans,
    );
    const [apres] = await db().select().from(entreprises).where(eq(entreprises.id, natif!.id));
    expect(apres).toMatchObject({ source: 'natif', ville: 'Locale' });
  });

  it('un champ exclu garde sa valeur locale', async () => {
    const odoo = fauxOdoo([
      societe(50, 'Société Cinq', '2026-05-01 10:00:00'),
      personne(51, 'Sacha Test', 50, '2026-05-01 10:00:00', { phone: '0100000000' }),
    ]);
    const exclus = { champsExclus: new Set(['contact.telephone']) };
    await synchroniserOdoo(db(), odoo, exclus);
    await db().update(contacts).set({ telephone: 'saisi ici' }).where(eq(contacts.sourceId, '51'));
    odoo.partenaires = [
      personne(51, 'Sacha Test', 50, '2026-05-02 10:00:00', { phone: '0200000000' }),
    ];
    await synchroniserOdoo(db(), odoo, exclus);
    const [c] = await db().select().from(contacts).where(eq(contacts.sourceId, '51'));
    expect(c!.telephone).toBe('saisi ici');
  });

  it('un contact dont la société n’est pas copiée garde son lien, un contact sans société le perd', async () => {
    const odoo = fauxOdoo([
      societe(60, 'Société Six', '2026-06-01 10:00:00'),
      personne(61, 'Robin Test', 60, '2026-06-01 10:00:00'),
    ]);
    await synchroniserOdoo(db(), odoo, sans);
    odoo.partenaires = [personne(61, 'Robin Test', 999, '2026-06-02 10:00:00')];
    await synchroniserOdoo(db(), odoo, sans);
    const [c] = await db().select().from(contacts).where(eq(contacts.sourceId, '61'));
    expect(c!.entrepriseId).not.toBeNull();
    odoo.partenaires = [personne(61, 'Robin Test', false, '2026-06-03 10:00:00')];
    await synchroniserOdoo(db(), odoo, sans);
    const [libre] = await db().select().from(contacts).where(eq(contacts.sourceId, '61'));
    expect(libre!.entrepriseId).toBeNull();
  });

  it('lit par lots : plus de 200 fiches', async () => {
    const odoo = fauxOdoo(
      Array.from({ length: 450 }, (_, i) =>
        societe(
          1000 + i,
          `Lot ${i}`,
          `2027-01-01 10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
        ),
      ),
    );
    const r = await synchroniserOdoo(db(), odoo, sans, { complet: true });
    expect(r.entreprises.crees).toBe(450);
    expect(odoo.appels).toBeGreaterThanOrEqual(3);
  });
});
