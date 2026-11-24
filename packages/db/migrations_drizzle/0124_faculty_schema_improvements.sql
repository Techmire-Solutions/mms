-- Convert join_date to native DATE type, add self-reporting check constraint, and drop redundant index.

ALTER TABLE "faculty"
  ALTER COLUMN "join_date" TYPE date USING (
    CASE 
      WHEN "join_date" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN "join_date"::date
      ELSE NULL
    END
  );
--> statement-breakpoint

ALTER TABLE "faculty"
  DROP CONSTRAINT IF EXISTS "faculty_no_self_reporting_check";
--> statement-breakpoint

ALTER TABLE "faculty"
  ADD CONSTRAINT "faculty_no_self_reporting_check"
  CHECK ("reporting_faculty_id" IS NULL OR "reporting_faculty_id" <> "id");
--> statement-breakpoint

DROP INDEX IF EXISTS "faculty_workspace_employee_id_idx";
