CREATE TABLE "pipelines" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"ordre" integer NOT NULL
);
--> statement-breakpoint
-- Deux pipes de départ ; les étapes existantes restent dans « vente » (valeur par défaut des colonnes).
INSERT INTO "pipelines" ("id", "label", "ordre") VALUES ('vente', 'Vente', 1), ('apres-vente', 'Après-vente', 2);--> statement-breakpoint
ALTER TABLE "etapes" ADD COLUMN "pipeline_id" text DEFAULT 'vente' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunites" ADD COLUMN "pipeline_id" text DEFAULT 'vente' NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunites" ADD COLUMN "origine_affaire_id" uuid;--> statement-breakpoint
ALTER TABLE "etapes" ADD CONSTRAINT "etapes_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunites" ADD CONSTRAINT "opportunites_pipeline_id_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunites" ADD CONSTRAINT "opportunites_origine_affaire_id_opportunites_id_fk" FOREIGN KEY ("origine_affaire_id") REFERENCES "public"."opportunites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Étapes de départ de l'après-vente (installation, maintien en conditions opérationnelles, suivi) :
-- à adapter dans l'écran Étapes.
INSERT INTO "etapes" ("id", "pipeline_id", "label", "ordre", "clos", "gagne", "probabilite") VALUES
  ('installation', 'apres-vente', 'Installation', 1, false, false, 100),
  ('mise-en-service', 'apres-vente', 'Mise en service', 2, false, false, 100),
  ('suivi-mco', 'apres-vente', 'Suivi et MCO', 3, false, false, 100),
  ('renouvellement', 'apres-vente', 'Renouvellement', 4, false, false, 100)
ON CONFLICT ("id") DO NOTHING;
