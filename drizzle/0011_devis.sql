CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reference" text NOT NULL,
	"nom" text NOT NULL,
	"prix" integer NOT NULL,
	"recurrent" boolean DEFAULT false NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"numero" text NOT NULL,
	"opportunite_id" uuid NOT NULL,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"formule" text DEFAULT 'achat' NOT NULL,
	"duree_mois" integer DEFAULT 48 NOT NULL,
	"taux_centiemes" integer DEFAULT 400 NOT NULL,
	"intro" text,
	"envoye_le" timestamp with time zone,
	"decide_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devis_lignes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"devis_id" uuid NOT NULL,
	"article_id" uuid,
	"designation" text NOT NULL,
	"prix_unitaire" integer NOT NULL,
	"recurrent" boolean DEFAULT false NOT NULL,
	"quantite" integer DEFAULT 1 NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_opportunite_id_opportunites_id_fk" FOREIGN KEY ("opportunite_id") REFERENCES "public"."opportunites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis_lignes" ADD CONSTRAINT "devis_lignes_devis_id_devis_id_fk" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis_lignes" ADD CONSTRAINT "devis_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_reference_idx" ON "articles" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_source_idx" ON "articles" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devis_numero_idx" ON "devis" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "devis_opportunite_idx" ON "devis" USING btree ("opportunite_id");--> statement-breakpoint
CREATE INDEX "devis_lignes_devis_idx" ON "devis_lignes" USING btree ("devis_id");