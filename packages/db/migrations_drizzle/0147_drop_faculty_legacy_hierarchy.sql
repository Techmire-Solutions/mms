-- MMS Forward-only Migration: 0147_drop_faculty_legacy_hierarchy.sql
-- Drop person-level and assignment-level legacy reporting columns.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DROP INDEX IF EXISTS faculty_workspace_reporting_faculty_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS faculty_assignments_reports_to_active_idx;
--> statement-breakpoint

ALTER TABLE faculty DROP COLUMN IF EXISTS reporting_faculty_id CASCADE;
--> statement-breakpoint

ALTER TABLE faculty_assignments DROP COLUMN IF EXISTS reports_to_assignment_id CASCADE;
