-- Étapes de départ, modifiables ensuite : un pipeline commercial générique en cinq étapes.
INSERT INTO "etapes" ("id", "label", "ordre", "clos", "gagne", "probabilite") VALUES
  ('detection', 'Détection', 1, false, false, 10),
  ('prospection', 'Prospection', 2, false, false, 20),
  ('qualification', 'Qualification', 3, false, false, 40),
  ('proposition', 'Proposition', 4, false, false, 60),
  ('negociation', 'Négociation', 5, false, false, 80);
