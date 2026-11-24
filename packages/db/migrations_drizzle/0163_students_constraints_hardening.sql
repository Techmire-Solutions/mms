-- MMS Forward-only Migration: 0163_students_constraints_hardening.sql
-- Data integrity and constraint hardening for the students module:
--   1. Enforce 1:1 contact-to-student mapping with a PostgreSQL partial unique index on contact_id.
--   2. Add composite FK from student_enrolled_sessions to sessions(workspace_subdomain, id).
--   3. Replace uniqueIndex on student_lookups(workspace_subdomain, kind, sort_order) with non-unique index to prevent sort-order collisions.
--   4. Prune redundant status expression indexes on students superseded by plain partial status indexes.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Upgrade contact_id index to partial unique index (idempotent).
DROP INDEX IF EXISTS "students_workspace_contact_active_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_contact_active_uidx"
  ON "students" ("workspace_subdomain", "contact_id")
  WHERE "deleted_at" IS NULL AND "contact_id" IS NOT NULL;
--> statement-breakpoint

-- 2. Add foreign key from student_enrolled_sessions to sessions (idempotent).
DO $$ BEGIN
  ALTER TABLE "student_enrolled_sessions"
    ADD CONSTRAINT "student_enrolled_sessions_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id")
    ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 3. Replace sort_order unique index on student_lookups with non-unique index.
DROP INDEX IF EXISTS "student_lookups_workspace_kind_sort_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_lookups_workspace_kind_sort_idx"
  ON "student_lookups" ("workspace_subdomain", "kind", "sort_order");
--> statement-breakpoint

-- 4. Prune redundant status expression indexes on students.
DROP INDEX IF EXISTS "students_workspace_status_expr_updated_at_active_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_status_expr_id_active_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_status_idx";
--> statement-breakpoint

-- 5. Prune redundant prefix/duplicate indexes on students and student_lookups.
DROP INDEX IF EXISTS "students_workspace_active_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_deleted_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "student_lookups_workspace_kind_idx";
--> statement-breakpoint

-- 6. Upgrade gr_number and student_id unique indexes to case-insensitive functional indexes.
DROP INDEX IF EXISTS "students_workspace_gr_number_active_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_number_active_uidx"
  ON "students" ("workspace_subdomain", lower(btrim("gr_number")))
  WHERE "deleted_at" IS NULL AND "gr_number" IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_student_id_active_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_student_id_active_uidx"
  ON "students" ("workspace_subdomain", lower(btrim("student_id")))
  WHERE "deleted_at" IS NULL AND "student_id" IS NOT NULL;
--> statement-breakpoint

-- 7. Restrict deletion of contacts linked to active student profiles.
DO $$ BEGIN
  ALTER TABLE "students"
    DROP CONSTRAINT IF EXISTS "students_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk";
  ALTER TABLE "students"
    ADD CONSTRAINT "students_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id")
    REFERENCES "contacts" ("workspace_subdomain", "id")
    ON DELETE restrict;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

