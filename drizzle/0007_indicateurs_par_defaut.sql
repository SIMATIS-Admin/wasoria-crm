-- Indicateurs de départ ; les étapes et les objectifs se règlent ensuite dans l'interface.
INSERT INTO "indicateurs" ("id", "label", "type", "de_etape", "vers_etape", "objectif", "ordre") VALUES
  ('delai-devis', 'Délai de remise du devis', 'delai', 'qualification', 'proposition', 10, 1),
  ('delai-reponse', 'Délai de première réponse', 'delai', 'detection', 'prospection', NULL, 2),
  ('contact-visite', 'Du contact à la visite', 'conversion', 'prospection', 'qualification', 50, 3),
  ('devis-commande', 'Du devis à la commande', 'conversion', 'proposition', '@gagne', NULL, 4),
  ('entrants', 'Opportunités entrantes par semaine', 'entrants', NULL, NULL, NULL, 5);
