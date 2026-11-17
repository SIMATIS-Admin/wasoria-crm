CREATE TABLE "indicateurs" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"type" text NOT NULL,
	"de_etape" text,
	"vers_etape" text,
	"objectif" integer,
	"ordre" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "opportunites" ADD COLUMN "clos_le" timestamp with time zone;