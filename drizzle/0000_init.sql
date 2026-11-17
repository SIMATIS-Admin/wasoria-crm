CREATE TABLE "activites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"contact_id" uuid,
	"entreprise_id" uuid,
	"opportunite_id" uuid,
	"titre" text,
	"at" timestamp with time zone NOT NULL,
	"resume" text
);
--> statement-breakpoint
CREATE TABLE "affaire_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opportunite_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affaire_entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opportunite_id" uuid NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_id" uuid NOT NULL,
	"email" text NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_id" uuid NOT NULL,
	"entreprise_id" uuid NOT NULL,
	"principal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entreprise_id" uuid,
	"nom" text NOT NULL,
	"fonction" text,
	"email" text,
	"telephone" text,
	"role" text
);
--> statement-breakpoint
CREATE TABLE "entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"nom" text NOT NULL,
	"secteur" text,
	"ville" text,
	"taille" integer,
	"domaine" text,
	"siren" text
);
--> statement-breakpoint
CREATE TABLE "opportunites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"entreprise_id" uuid,
	"contact_id" uuid,
	"titre" text NOT NULL,
	"etape" text NOT NULL,
	"mode_facturation" text DEFAULT 'spot' NOT NULL,
	"duree_engagement_mois" integer DEFAULT 12 NOT NULL,
	"tacite_reconduction" boolean DEFAULT true NOT NULL,
	"probabilite_manuelle" integer,
	"signature_estimee" date,
	"montant" integer,
	"echeance" date,
	"clos" text,
	"motif" text,
	"proprietaire" text,
	"origine" text,
	"qualification" jsonb,
	"potentiel" text,
	"faisabilite" text,
	"prochaine_etape" text,
	"derniere_activite" timestamp with time zone,
	"etapes_dates" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rdv_affaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rendez_vous_id" uuid NOT NULL,
	"opportunite_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rdv_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rendez_vous_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rdv_entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rendez_vous_id" uuid NOT NULL,
	"entreprise_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rendez_vous" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_id" text,
	"titre" text DEFAULT '' NOT NULL,
	"debut" timestamp with time zone,
	"fin" timestamp with time zone,
	"lieu" text,
	"participants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statut" text DEFAULT 'a_trier' NOT NULL,
	"tri" text DEFAULT 'aucun' NOT NULL,
	"compte_rendu" text,
	"compte_rendu_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "taches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text DEFAULT 'natif' NOT NULL,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opportunite_id" uuid,
	"contact_id" uuid,
	"entreprise_id" uuid,
	"lien_choisi" boolean DEFAULT false NOT NULL,
	"titre" text NOT NULL,
	"canal" text NOT NULL,
	"echeance" timestamp with time zone,
	"fait_at" timestamp with time zone,
	"prepare" boolean DEFAULT false NOT NULL,
	"notes" text,
	"type" text DEFAULT 'tache' NOT NULL,
	"type_choisi" boolean DEFAULT false NOT NULL,
	"avec_heure" boolean DEFAULT false NOT NULL,
	"duree_minutes" integer,
	"occupe" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activites" ADD CONSTRAINT "activites_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activites" ADD CONSTRAINT "activites_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activites" ADD CONSTRAINT "activites_opportunite_id_opportunites_id_fk" FOREIGN KEY ("opportunite_id") REFERENCES "public"."opportunites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affaire_contacts" ADD CONSTRAINT "affaire_contacts_opportunite_id_opportunites_id_fk" FOREIGN KEY ("opportunite_id") REFERENCES "public"."opportunites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affaire_contacts" ADD CONSTRAINT "affaire_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affaire_entreprises" ADD CONSTRAINT "affaire_entreprises_opportunite_id_opportunites_id_fk" FOREIGN KEY ("opportunite_id") REFERENCES "public"."opportunites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affaire_entreprises" ADD CONSTRAINT "affaire_entreprises_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_emails" ADD CONSTRAINT "contact_emails_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_entreprises" ADD CONSTRAINT "contact_entreprises_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_entreprises" ADD CONSTRAINT "contact_entreprises_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunites" ADD CONSTRAINT "opportunites_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunites" ADD CONSTRAINT "opportunites_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdv_affaires" ADD CONSTRAINT "rdv_affaires_rendez_vous_id_rendez_vous_id_fk" FOREIGN KEY ("rendez_vous_id") REFERENCES "public"."rendez_vous"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdv_affaires" ADD CONSTRAINT "rdv_affaires_opportunite_id_opportunites_id_fk" FOREIGN KEY ("opportunite_id") REFERENCES "public"."opportunites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdv_contacts" ADD CONSTRAINT "rdv_contacts_rendez_vous_id_rendez_vous_id_fk" FOREIGN KEY ("rendez_vous_id") REFERENCES "public"."rendez_vous"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdv_contacts" ADD CONSTRAINT "rdv_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdv_entreprises" ADD CONSTRAINT "rdv_entreprises_rendez_vous_id_rendez_vous_id_fk" FOREIGN KEY ("rendez_vous_id") REFERENCES "public"."rendez_vous"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rdv_entreprises" ADD CONSTRAINT "rdv_entreprises_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_opportunite_id_opportunites_id_fk" FOREIGN KEY ("opportunite_id") REFERENCES "public"."opportunites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taches" ADD CONSTRAINT "taches_entreprise_id_entreprises_id_fk" FOREIGN KEY ("entreprise_id") REFERENCES "public"."entreprises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activites_at_idx" ON "activites" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "activites_source_idx" ON "activites" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affaire_contacts_paire_idx" ON "affaire_contacts" USING btree ("opportunite_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "affaire_entreprises_paire_idx" ON "affaire_entreprises" USING btree ("opportunite_id","entreprise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_emails_paire_idx" ON "contact_emails" USING btree ("contact_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_entreprises_paire_idx" ON "contact_entreprises" USING btree ("contact_id","entreprise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_source_idx" ON "contacts" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entreprises_source_idx" ON "entreprises" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunites_source_idx" ON "opportunites" USING btree ("source","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rdv_affaires_paire_idx" ON "rdv_affaires" USING btree ("rendez_vous_id","opportunite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rdv_contacts_paire_idx" ON "rdv_contacts" USING btree ("rendez_vous_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rdv_entreprises_paire_idx" ON "rdv_entreprises" USING btree ("rendez_vous_id","entreprise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rendez_vous_event_idx" ON "rendez_vous" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "taches_echeance_idx" ON "taches" USING btree ("echeance");--> statement-breakpoint
CREATE UNIQUE INDEX "taches_source_idx" ON "taches" USING btree ("source","source_id");