-- MMS Forward-only Migration: 0160_faculty_drop_employment_mirrors.sql
-- Contract: drop faculty dual-write mirrors now owned by faculty_employments /
-- faculty_employ_designations. Catalog is_active/code retained (still written).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*)::int INTO missing_count
  FROM "faculty"
  WHERE "deleted_at" IS NULL
    AND ("employment_id" IS NULL OR btrim("employment_id") = '');
  IF missing_count > 0 THEN
    RAISE EXCEPTION
      '0160_faculty_drop_employment_mirrors: % active faculty row(s) missing employment_id',
      missing_count;
  END IF;
END $$;
--> statement-breakpoint

-- Drop indexes tied to mirror columns
DROP INDEX IF EXISTS "faculty_workspace_employee_id_active_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "faculty_workspace_contact_active_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "faculty_workspace_designation_active_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "faculty_workspace_status_expr_updated_at_active_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "faculty_workspace_status_expr_id_active_idx";
--> statement-breakpoint

-- Drop CHECKs that reference mirror columns
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_status_check";
--> statement-breakpoint
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_employment_period_check";
--> statement-breakpoint
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_designation_period_check";
--> statement-breakpoint

-- Drop FKs on mirror columns
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk";
--> statement-breakpoint
ALTER TABLE "faculty" DROP CONSTRAINT IF EXISTS "faculty_designation_fk";
--> statement-breakpoint
-- Drop mirror columns
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "contact_id";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "employee_id";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "status";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "employment_start_date";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "employment_end_date";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "designation_id";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "designation_start_date";
--> statement-breakpoint
ALTER TABLE "faculty" DROP COLUMN IF EXISTS "designation_end_date";
