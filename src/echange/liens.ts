import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Db } from '../db/index.js';
import {
  affaireContacts,
  affaireEntreprises,
  contactEmails,
  contactEntreprises,
  contacts,
  opportunites,
  rdvAffaires,
  rdvContacts,
  rdvEntreprises,
  rendezVous,
} from '../db/schema.js';
import { idSchema } from '../api/schemas.js';
import { peutModifierAffaire } from '../auth/droits.js';

// Les liens plusieurs-à-plusieurs, comme dans le profil crm/1 : on envoie la liste complète d'un
// lien, qui remplace l'ancienne. Le premier de la liste est le principal. Une liste absente du
// corps ne change rien. Une fiche liée qui n'existe pas répond 409.
const liste = z.array(idSchema).max(500).optional();
const id = z.object({ id: idSchema });
const unique = <T>(l: T[] | undefined) => (l ? [...new Set(l)] : undefined);
const introuvable = { erreur: 'Fiche introuvable' };

export function registerLiens(app: FastifyInstance, db: Db): void {
  app.put('/affaires/:id/liens', async (request, reply) => {
    const { id: affaireId } = id.parse(request.params);
    const corps = z.strictObject({ contacts: liste, entreprises: liste }).parse(request.body);
    const cts = unique(corps.contacts);
    const ents = unique(corps.entreprises);
    return db.transaction(async (tx) => {
      const [a] = await tx
        .select({ id: opportunites.id, pipelineId: opportunites.pipelineId })
        .from(opportunites)
        .where(eq(opportunites.id, affaireId));
      if (!a) return reply.code(404).send(introuvable);
      if (request.utilisateur && !peutModifierAffaire(request.utilisateur.role, a.pipelineId)) {
        return reply
          .code(403)
          .send({ erreur: 'Votre rôle ne modifie que les affaires du pipe après-vente' });
      }
      if (cts) {
        await tx.delete(affaireContacts).where(eq(affaireContacts.opportuniteId, affaireId));
        if (cts.length) {
          await tx.insert(affaireContacts).values(
            cts.map((contactId, i) => ({
              opportuniteId: affaireId,
              contactId,
              principal: i === 0,
            })),
          );
        }
        await tx
          .update(opportunites)
          .set({ contactId: cts[0] ?? null })
          .where(eq(opportunites.id, affaireId));
      }
      if (ents) {
        await tx.delete(affaireEntreprises).where(eq(affaireEntreprises.opportuniteId, affaireId));
        if (ents.length) {
          await tx.insert(affaireEntreprises).values(
            ents.map((entrepriseId, i) => ({
              opportuniteId: affaireId,
              entrepriseId,
              principal: i === 0,
            })),
          );
        }
        await tx
          .update(opportunites)
          .set({ entrepriseId: ents[0] ?? null })
          .where(eq(opportunites.id, affaireId));
      }
      return { contacts: cts, entreprises: ents };
    });
  });

  app.put('/contacts/:id/liens', async (request, reply) => {
    const { id: contactId } = id.parse(request.params);
    const corps = z.strictObject({ entreprises: liste }).parse(request.body);
    const ents = unique(corps.entreprises);
    return db.transaction(async (tx) => {
      const [c] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.id, contactId));
      if (!c) return reply.code(404).send(introuvable);
      if (ents) {
        await tx.delete(contactEntreprises).where(eq(contactEntreprises.contactId, contactId));
        if (ents.length) {
          await tx
            .insert(contactEntreprises)
            .values(
              ents.map((entrepriseId, i) => ({ contactId, entrepriseId, principal: i === 0 })),
            );
        }
        await tx
          .update(contacts)
          .set({ entrepriseId: ents[0] ?? null })
          .where(eq(contacts.id, contactId));
      }
      return { entreprises: ents };
    });
  });

  // Toutes les adresses d'un contact : la première est la principale, aussi dans `contacts.email`.
  app.put('/contacts/:id/emails', async (request, reply) => {
    const { id: contactId } = id.parse(request.params);
    const { emails } = z.strictObject({ emails: z.array(z.email()).max(50) }).parse(request.body);
    const adresses = [...new Set(emails.map((e) => e.toLowerCase()))];
    return db.transaction(async (tx) => {
      const [c] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.id, contactId));
      if (!c) return reply.code(404).send(introuvable);
      await tx.delete(contactEmails).where(eq(contactEmails.contactId, contactId));
      if (adresses.length) {
        await tx
          .insert(contactEmails)
          .values(adresses.map((email, i) => ({ contactId, email, principal: i === 0 })));
      }
      await tx
        .update(contacts)
        .set({ email: adresses[0] ?? null })
        .where(eq(contacts.id, contactId));
      return { emails: adresses };
    });
  });

  app.put('/rendez-vous/:id/liens', async (request, reply) => {
    const { id: rdvId } = id.parse(request.params);
    const corps = z
      .strictObject({ contacts: liste, entreprises: liste, affaires: liste })
      .parse(request.body);
    const cts = unique(corps.contacts);
    const ents = unique(corps.entreprises);
    const aff = unique(corps.affaires);
    return db.transaction(async (tx) => {
      const [r] = await tx
        .select({ id: rendezVous.id })
        .from(rendezVous)
        .where(eq(rendezVous.id, rdvId));
      if (!r) return reply.code(404).send(introuvable);
      if (cts) {
        await tx.delete(rdvContacts).where(eq(rdvContacts.rendezVousId, rdvId));
        if (cts.length)
          await tx
            .insert(rdvContacts)
            .values(cts.map((contactId) => ({ rendezVousId: rdvId, contactId })));
      }
      if (ents) {
        await tx.delete(rdvEntreprises).where(eq(rdvEntreprises.rendezVousId, rdvId));
        if (ents.length)
          await tx
            .insert(rdvEntreprises)
            .values(ents.map((entrepriseId) => ({ rendezVousId: rdvId, entrepriseId })));
      }
      if (aff) {
        await tx.delete(rdvAffaires).where(eq(rdvAffaires.rendezVousId, rdvId));
        if (aff.length)
          await tx
            .insert(rdvAffaires)
            .values(aff.map((opportuniteId) => ({ rendezVousId: rdvId, opportuniteId })));
      }
      return { contacts: cts, entreprises: ents, affaires: aff };
    });
  });
}
