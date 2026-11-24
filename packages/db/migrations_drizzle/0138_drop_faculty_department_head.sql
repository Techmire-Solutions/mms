-- MMS Forward-only Migration: 0138_drop_faculty_department_head.sql
-- Drop department head reference (product: contact/org reporting replaces dept head).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "faculty_departments"
  DROP CONSTRAINT IF EXISTS "faculty_departments_head_faculty_fk";
--> statement-breakpoint

DROP INDEX IF EXISTS "faculty_departments_head_faculty_idx";
--> statement-breakpoint

ALTER TABLE "faculty_departments"
  DROP COLUMN IF EXISTS "head_faculty_id";
