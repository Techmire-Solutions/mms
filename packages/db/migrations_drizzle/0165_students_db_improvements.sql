-- MMS Forward-only Migration: 0165_students_db_improvements.sql
-- Students module data integrity, index hardening, and audit trail improvements:
--   1. Harden partial unique indexes on gr_number and student_id to exclude empty strings.
--   2. Add audit trail columns to student_lookups, student_field_configs, and student_module_preferences.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Upgrade partial unique indexes to guard against empty strings.
DROP INDEX IF EXISTS "students_workspace_gr_number_active_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_number_active_uidx"
  ON "students" ("workspace_subdomain", lower(btrim("gr_number")))
  WHERE "deleted_at" IS NULL AND "gr_number" IS NOT NULL AND btrim("gr_number") <> '';
--> statement-breakpoint

DROP INDEX IF EXISTS "students_workspace_student_id_active_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_student_id_active_uidx"
  ON "students" ("workspace_subdomain", lower(btrim("student_id")))
  WHERE "deleted_at" IS NULL AND "student_id" IS NOT NULL AND btrim("student_id") <> '';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "students_workspace_status_coalesce_updated_at_active_idx"
  ON "students" ("workspace_subdomain", (COALESCE("status", 'active')), "updated_at" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "students_workspace_contact_deleted_idx"
  ON "students" ("workspace_subdomain", "contact_id")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- 2. Add audit tracking columns to student_lookups.
DO $$ BEGIN
  ALTER TABLE "student_lookups" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "student_lookups" ADD COLUMN "created_by" text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "student_lookups" ADD COLUMN "updated_by" text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint

-- 3. Add updated_by to student_field_configs and student_module_preferences.
DO $$ BEGIN
  ALTER TABLE "student_field_configs" ADD COLUMN "updated_by" text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "student_module_preferences" ADD COLUMN "updated_by" text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint

-- 4. Add custom_fields jsonb column for user-defined Setup fields.
DO $$ BEGIN
  ALTER TABLE "students" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
