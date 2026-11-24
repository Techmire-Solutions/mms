-- MMS Forward-only Migration: 0156_faculty_employ_desig_concurrent.sql
-- Allow multiple concurrent active open-ended employ-designation tenures per employment
-- (different designation_id). Blocks duplicate (employment, designation) while both are
-- active + open-ended. Unblocks multi-designation forms and composite role union.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DROP INDEX IF EXISTS "faculty_employ_designations_employment_active_uidx";
--> statement-breakpoint

-- One active open tenure per (employment, designation); concurrent different designations OK.
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_employ_designations_emp_desig_active_uidx"
  ON "faculty_employ_designations" (
    "workspace_subdomain",
    "employment_id",
    "designation_id"
  )
  WHERE "deleted_at" IS NULL
    AND lower(btrim("status")) = 'active'
    AND "end_date" IS NULL;
