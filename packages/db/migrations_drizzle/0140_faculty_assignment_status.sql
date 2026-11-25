-- MMS Forward-only Migration: 0140_faculty_assignment_status.sql
-- Per-assignment designation status (active/inactive) for multi-title faculty.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "faculty_assignments"
  ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active';
--> statement-breakpoint

ALTER TABLE "faculty_assignments"
  DROP CONSTRAINT IF EXISTS "faculty_assignments_status_check";
--> statement-breakpoint

ALTER TABLE "faculty_assignments"
  ADD CONSTRAINT "faculty_assignments_status_check"
  CHECK ("status" IN ('active', 'inactive'));
--> statement-breakpoint

-- One open active holding of a given designation per faculty member.
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_assignments_active_designation_uidx"
  ON "faculty_assignments" ("workspace_subdomain", "faculty_id", "designation_id")
  WHERE "deleted_at" IS NULL
    AND "status" = 'active'
    AND "end_date" IS NULL;
