CREATE TABLE "etapes" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"ordre" integer NOT NULL,
	"clos" boolean DEFAULT false NOT NULL,
	"gagne" boolean DEFAULT false NOT NULL,
	"probabilite" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objet" text NOT NULL,
	"fiche_id" uuid NOT NULL,
	"supprime_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "suppressions_le_idx" ON "suppressions" USING btree ("supprime_le");