-- Retire the legacy Teacher module database compatibility surface.
DROP VIEW IF EXISTS "teachers";
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "faculty" WHERE "contact_id" IS NULL) THEN
    RAISE EXCEPTION 'faculty.contact_id contains NULL values; link every faculty row to contacts before migration 0122';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "faculty" ALTER COLUMN "contact_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "faculty"
  DROP CONSTRAINT IF EXISTS "faculty_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk";
--> statement-breakpoint
ALTER TABLE "faculty"
  ADD CONSTRAINT "faculty_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk"
  FOREIGN KEY ("workspace_subdomain", "contact_id")
  REFERENCES "contacts" ("workspace_subdomain", "id")
  ON DELETE RESTRICT;
--> statement-breakpoint

ALTER TABLE "faculty"
  ADD CONSTRAINT "faculty_hierarchy_rank_positive_check"
  CHECK ("hierarchy_rank" > 0);
