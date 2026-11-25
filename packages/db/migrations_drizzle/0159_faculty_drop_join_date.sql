-- MMS Forward-only Migration: 0159_faculty_drop_join_date.sql
-- Contract: drop deprecated join_date mirror (employment_start_date is SSOT on employment + dual-write).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

UPDATE "faculty"
   SET "employment_start_date" = "join_date"
 WHERE "employment_start_date" IS NULL
   AND "join_date" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "faculty" DROP COLUMN IF EXISTS "join_date";
