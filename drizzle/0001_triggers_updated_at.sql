-- Fait bouger updated_at à chaque modification, quel que soit le chemin (API, synchro Odoo, OS) :
-- c'est ce que lisent les synchronisations pour repérer ce qui a changé.
CREATE FUNCTION crm_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
-- Un lien modifié fait aussi bouger la fiche qu'il décrit.
CREATE FUNCTION crm_touch_parent() RETURNS trigger AS $$
DECLARE parent_id uuid;
BEGIN
  parent_id := (to_jsonb(COALESCE(NEW, OLD)) ->> TG_ARGV[1])::uuid;
  EXECUTE format('UPDATE %I SET updated_at = now() WHERE id = $1', TG_ARGV[0]) USING parent_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "entreprises_touch_trg" BEFORE UPDATE ON "entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "contacts_touch_trg" BEFORE UPDATE ON "contacts" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "opportunites_touch_trg" BEFORE UPDATE ON "opportunites" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "taches_touch_trg" BEFORE UPDATE ON "taches" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "rendez_vous_touch_trg" BEFORE UPDATE ON "rendez_vous" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "activites_touch_trg" BEFORE UPDATE ON "activites" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "affaire_contacts_touch_trg" BEFORE UPDATE ON "affaire_contacts" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "affaire_entreprises_touch_trg" BEFORE UPDATE ON "affaire_entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "contact_entreprises_touch_trg" BEFORE UPDATE ON "contact_entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "contact_emails_touch_trg" BEFORE UPDATE ON "contact_emails" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "rdv_contacts_touch_trg" BEFORE UPDATE ON "rdv_contacts" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "rdv_entreprises_touch_trg" BEFORE UPDATE ON "rdv_entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "rdv_affaires_touch_trg" BEFORE UPDATE ON "rdv_affaires" FOR EACH ROW EXECUTE FUNCTION "crm_touch_updated_at"();--> statement-breakpoint
CREATE TRIGGER "affaire_contacts_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "affaire_contacts" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('opportunites', 'opportunite_id');--> statement-breakpoint
CREATE TRIGGER "affaire_entreprises_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "affaire_entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('opportunites', 'opportunite_id');--> statement-breakpoint
CREATE TRIGGER "contact_entreprises_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "contact_entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('contacts', 'contact_id');--> statement-breakpoint
CREATE TRIGGER "contact_emails_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "contact_emails" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('contacts', 'contact_id');--> statement-breakpoint
CREATE TRIGGER "rdv_contacts_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "rdv_contacts" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('rendez_vous', 'rendez_vous_id');--> statement-breakpoint
CREATE TRIGGER "rdv_entreprises_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "rdv_entreprises" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('rendez_vous', 'rendez_vous_id');--> statement-breakpoint
CREATE TRIGGER "rdv_affaires_parent_trg" AFTER INSERT OR UPDATE OR DELETE ON "rdv_affaires" FOR EACH ROW EXECUTE FUNCTION "crm_touch_parent"('rendez_vous', 'rendez_vous_id');
