-- Les comptes déjà créés l'ont été par la personne qui a installé le CRM : ils deviennent administrateurs.
UPDATE "utilisateurs" SET "role" = 'admin';
