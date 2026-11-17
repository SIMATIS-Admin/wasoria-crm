import { asc, desc, eq, inArray, like } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ErreurInterdit, ErreurRequete } from '../api/ressource.js';
import { idSchema } from '../api/schemas.js';
import { peutModifierAffaire } from '../auth/droits.js';
import type { Db } from '../db/index.js';
import {
  articles,
  contacts,
  devis,
  devisLignes,
  entreprises,
  opportunites,
  STATUTS_DEVIS,
} from '../db/schema.js';
import { totaux, transitionPossible } from './calcul.js';

const texte = z.string().trim().min(1).max(300);
const entierPositif = z.number().int().min(0).max(10_000_000);

const articleCreation = z.strictObject({
  reference: z.string().trim().min(1).max(40),
  nom: texte,
  prix: entierPositif,
  recurrent: z.boolean().optional(),
  ordre: z.number().int().min(0).max(10_000).optional(),
});

const reglages = z.strictObject({
  formule: z.enum(['achat', 'abonnement']).optional(),
  dureeMois: z.number().int().min(6).max(120).optional(),
  tauxCentiemes: z.number().int().min(0).max(2000).optional(),
  intro: z.string().max(5000).nullable().optional(),
});

const ligne = z.strictObject({
  articleId: idSchema.nullable().optional(),
  designation: texte.optional(),
  prixUnitaire: entierPositif.optional(),
  recurrent: z.boolean().optional(),
  quantite: z.number().int().min(1).max(9999),
});

export function registerDevis(app: FastifyInstance, db: Db): void {
  // ---------------------------------------------------------------- catalogue
  app.get('/articles', async (request) => {
    const { tous } = z.object({ tous: z.enum(['0', '1']).optional() }).parse(request.query);
    return db
      .select()
      .from(articles)
      .where(tous === '1' ? undefined : eq(articles.actif, true))
      .orderBy(asc(articles.ordre), asc(articles.nom));
  });

  app.post('/articles', async (request, reply) => {
    const corps = articleCreation.parse(request.body);
    const [a] = await db.insert(articles).values(corps).returning();
    return reply.code(201).send(a);
  });

  app.patch('/articles/:id', async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const corps = articleCreation
      .partial()
      .extend({ actif: z.boolean().optional() })
      .parse(request.body);
    if (Object.keys(corps).length === 0) throw new ErreurRequete('Aucun champ à modifier');
    const [a] = await db.update(articles).set(corps).where(eq(articles.id, id)).returning();
    return a ?? reply.code(404).send({ erreur: 'Article introuvable' });
  });

  // ---------------------------------------------------------------- devis
  async function detail(id: string) {
    const [d] = await db.select().from(devis).where(eq(devis.id, id));
    if (!d) return null;
    const lignes = await db
      .select()
      .from(devisLignes)
      .where(eq(devisLignes.devisId, id))
      .orderBy(asc(devisLignes.ordre));
    const [affaire] = await db
      .select()
      .from(opportunites)
      .where(eq(opportunites.id, d.opportuniteId));
    const [entreprise] = affaire?.entrepriseId
      ? await db.select().from(entreprises).where(eq(entreprises.id, affaire.entrepriseId))
      : [];
    const [contact] = affaire?.contactId
      ? await db.select().from(contacts).where(eq(contacts.id, affaire.contactId))
      : [];
    return {
      ...d,
      lignes,
      totaux: totaux(lignes, d),
      affaire: affaire
        ? { id: affaire.id, titre: affaire.titre, pipelineId: affaire.pipelineId }
        : null,
      entreprise: entreprise
        ? { id: entreprise.id, nom: entreprise.nom, ville: entreprise.ville }
        : null,
      contact: contact ? { nom: contact.nom, fonction: contact.fonction } : null,
    };
  }

  // Un devis suit les droits de son affaire : le rôle après-vente ne touche pas aux devis d'une vente.
  async function droitsSurAffaire(
    affaireId: string,
    utilisateur: { role: Parameters<typeof peutModifierAffaire>[0] } | null,
  ) {
    const [a] = await db
      .select({ pipelineId: opportunites.pipelineId })
      .from(opportunites)
      .where(eq(opportunites.id, affaireId));
    if (!a) return null;
    if (utilisateur && !peutModifierAffaire(utilisateur.role, a.pipelineId)) {
      throw new ErreurInterdit('Votre rôle ne modifie que les affaires du pipe après-vente');
    }
    return a;
  }

  app.get('/devis', async (request) => {
    const q = z
      .object({
        affaireId: idSchema.optional(),
        limite: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(request.query);
    const lignes = await db
      .select({
        d: devis,
        affaire: opportunites.titre,
        entreprise: entreprises.nom,
      })
      .from(devis)
      .innerJoin(opportunites, eq(devis.opportuniteId, opportunites.id))
      .leftJoin(entreprises, eq(opportunites.entrepriseId, entreprises.id))
      .where(q.affaireId ? eq(devis.opportuniteId, q.affaireId) : undefined)
      .orderBy(desc(devis.createdAt))
      .limit(q.limite);
    const ids = lignes.map((l) => l.d.id);
    const toutes = ids.length
      ? await db.select().from(devisLignes).where(inArray(devisLignes.devisId, ids))
      : [];
    return lignes.map(({ d, affaire, entreprise }) => ({
      ...d,
      affaire,
      entreprise,
      totaux: totaux(
        toutes.filter((l) => l.devisId === d.id),
        d,
      ),
    }));
  });

  app.get('/devis/:id', async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    return (await detail(id)) ?? reply.code(404).send({ erreur: 'Devis introuvable' });
  });

  // `D-2026-001` : l'année, puis le rang dans l'année. Une collision (deux devis créés au même
  // instant) fait réessayer avec le numéro suivant.
  async function creerAvecNumero(valeurs: Omit<typeof devis.$inferInsert, 'numero'>) {
    const annee = new Date().getFullYear();
    for (let essai = 0; essai < 5; essai++) {
      const [dernier] = await db
        .select({ numero: devis.numero })
        .from(devis)
        .where(like(devis.numero, `D-${annee}-%`))
        .orderBy(desc(devis.numero))
        .limit(1);
      const rang = dernier ? Number(dernier.numero.split('-')[2]) + 1 : 1;
      const numero = `D-${annee}-${String(rang).padStart(3, '0')}`;
      try {
        const [d] = await db
          .insert(devis)
          .values({ ...valeurs, numero })
          .returning();
        return d!;
      } catch (e) {
        const code =
          (e as { code?: string }).code ?? (e as { cause?: { code?: string } }).cause?.code;
        if (code !== '23505') throw e;
      }
    }
    throw new ErreurRequete('Numéro de devis indisponible, réessayez');
  }

  app.post('/devis', async (request, reply) => {
    const corps = reglages.extend({ affaireId: idSchema }).parse(request.body);
    if (!(await droitsSurAffaire(corps.affaireId, request.utilisateur))) {
      return reply.code(404).send({ erreur: 'Affaire introuvable' });
    }
    const { affaireId, ...autres } = corps;
    const d = await creerAvecNumero({ ...autres, opportuniteId: affaireId });
    return reply.code(201).send(await detail(d.id));
  });

  app.patch('/devis/:id', async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const corps = reglages.extend({ statut: z.enum(STATUTS_DEVIS).optional() }).parse(request.body);
    if (Object.keys(corps).length === 0) throw new ErreurRequete('Aucun champ à modifier');
    const [d] = await db.select().from(devis).where(eq(devis.id, id));
    if (!d) return reply.code(404).send({ erreur: 'Devis introuvable' });
    await droitsSurAffaire(d.opportuniteId, request.utilisateur);

    const { statut, ...modifs } = corps;
    // Un devis envoyé ne se modifie plus : on le repasse d'abord en brouillon.
    if (d.statut !== 'brouillon' && Object.keys(modifs).length > 0) {
      return reply
        .code(409)
        .send({ erreur: 'Devis envoyé : repassez-le en brouillon pour le modifier' });
    }
    const valeurs: Partial<typeof devis.$inferInsert> = { ...modifs };
    if (statut && statut !== d.statut) {
      if (!transitionPossible(d.statut, statut)) {
        return reply
          .code(409)
          .send({ erreur: `Un devis ${d.statut} ne peut pas passer à ${statut}` });
      }
      valeurs.statut = statut;
      if (statut === 'envoye') {
        valeurs.envoyeLe = new Date();
        valeurs.decideLe = null;
      } else if (statut === 'brouillon') {
        valeurs.envoyeLe = null;
        valeurs.decideLe = null;
      } else {
        valeurs.decideLe = new Date();
      }
    }
    if (Object.keys(valeurs).length > 0)
      await db.update(devis).set(valeurs).where(eq(devis.id, id));
    return detail(id);
  });

  // Remplace toutes les lignes (brouillon seulement). Une ligne qui cite un article en reprend le nom et
  // le prix, sauf si la ligne les précise (prix négocié).
  app.put('/devis/:id/lignes', async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const { lignes } = z.strictObject({ lignes: z.array(ligne).max(100) }).parse(request.body);
    const [d] = await db.select().from(devis).where(eq(devis.id, id));
    if (!d) return reply.code(404).send({ erreur: 'Devis introuvable' });
    await droitsSurAffaire(d.opportuniteId, request.utilisateur);
    if (d.statut !== 'brouillon') {
      return reply
        .code(409)
        .send({ erreur: 'Devis envoyé : repassez-le en brouillon pour le modifier' });
    }
    const idsArticles = [...new Set(lignes.flatMap((l) => (l.articleId ? [l.articleId] : [])))];
    const trouves = idsArticles.length
      ? await db.select().from(articles).where(inArray(articles.id, idsArticles))
      : [];
    const parId = new Map(trouves.map((a) => [a.id, a]));
    const valeurs = lignes.map((l, i) => {
      const a = l.articleId ? parId.get(l.articleId) : undefined;
      if (l.articleId && !a) throw new ErreurRequete(`Article inconnu : ${l.articleId}`);
      const designation = l.designation ?? a?.nom;
      const prixUnitaire = l.prixUnitaire ?? a?.prix;
      if (designation === undefined || prixUnitaire === undefined) {
        throw new ErreurRequete(
          'Chaque ligne cite un article, ou donne une désignation et un prix',
        );
      }
      return {
        devisId: id,
        articleId: l.articleId ?? null,
        designation,
        prixUnitaire,
        recurrent: l.recurrent ?? a?.recurrent ?? false,
        quantite: l.quantite,
        ordre: i,
      };
    });
    await db.transaction(async (tx) => {
      await tx.delete(devisLignes).where(eq(devisLignes.devisId, id));
      if (valeurs.length) await tx.insert(devisLignes).values(valeurs);
      await tx.update(devis).set({ updatedAt: new Date() }).where(eq(devis.id, id));
    });
    return detail(id);
  });

  // Supprimer un devis : réservé aux administrateurs (voir droits.ts).
  app.delete('/devis/:id', async (request, reply) => {
    const { id } = z.object({ id: idSchema }).parse(request.params);
    const supprimes = await db.delete(devis).where(eq(devis.id, id)).returning({ id: devis.id });
    return supprimes.length
      ? reply.code(204).send()
      : reply.code(404).send({ erreur: 'Devis introuvable' });
  });
}
