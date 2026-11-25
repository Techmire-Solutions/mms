-- MMS Forward-only Migration: 0141_faculty_assignment_dept_designation_uidx.sql
-- Allow the same designation in different departments (unique per dept+designation).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DROP INDEX IF EXISTS "faculty_assignments_active_designation_uidx";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "faculty_assignments_active_dept_designation_uidx"
  ON "faculty_assignments" ("workspace_subdomain", "faculty_id", "department_id", "designation_id")
  WHERE "deleted_at" IS NULL
    AND "status" = 'active'
    AND "end_date" IS NULL;
