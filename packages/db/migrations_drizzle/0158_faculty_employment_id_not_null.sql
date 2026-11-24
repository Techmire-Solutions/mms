-- MMS Forward-only Migration: 0158_faculty_employment_id_not_null.sql
-- Contract step: require faculty.employment_id (SSOT link to faculty_employments).
-- Designation/employment column mirrors remain dual-written until a later drop migration
-- after all readers use fe_emp / employ_designations exclusively.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- Fail closed if any live faculty row is missing employment_id (0154 should have backfilled).
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
      '0158_faculty_employment_id_not_null: % active faculty row(s) missing employment_id — re-run 0154 backfill',
      missing_count;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "faculty" ALTER COLUMN "employment_id" SET NOT NULL;
