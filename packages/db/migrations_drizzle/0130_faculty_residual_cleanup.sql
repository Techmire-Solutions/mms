-- Faculty domain residual cleanup: retire the last legacy "teacher" database objects.
-- The table/column/index/constraint rename shipped in 0112/0119/0120/0122; this migration
-- renames the surviving updated_at trigger and drops the remaining compatibility views.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_teachers_updated_at'
      AND c.relname = 'faculty'
      AND NOT t.tgisinternal
  ) THEN
    ALTER TRIGGER update_teachers_updated_at ON "faculty" RENAME TO update_faculty_updated_at;
  END IF;
END $$;
--> statement-breakpoint

DROP VIEW IF EXISTS teacher_lookups;
--> statement-breakpoint

DROP VIEW IF EXISTS teacher_field_configs;
--> statement-breakpoint

DROP VIEW IF EXISTS teacher_module_preferences;
--> statement-breakpoint

DROP VIEW IF EXISTS teacher_setup_config;
--> statement-breakpoint

-- Re-assert the 0122 hardening idempotently. Environments whose faculty table was
-- rebuilt from the Drizzle schema after 0122 was recorded (e.g. a stray schema push)
-- drifted back to nullable contact_id + ON DELETE SET NULL; forward-only re-apply.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "faculty" WHERE "contact_id" IS NULL) THEN
    RAISE EXCEPTION 'faculty.contact_id contains NULL values; link every faculty row to contacts before migration 0130';
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
