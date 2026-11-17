CREATE TABLE "synchronisations" (
	"connecteur" text NOT NULL,
	"objet" text NOT NULL,
	"curseur" text,
	"derniere_execution" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "synchronisations_pk_idx" ON "synchronisations" USING btree ("connecteur","objet");