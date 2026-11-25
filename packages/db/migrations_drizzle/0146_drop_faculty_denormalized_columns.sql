-- MMS Forward-only Migration: 0146_drop_faculty_denormalized_columns.sql
-- Drop denormalized department/designation/hierarchy_rank cache on faculty (FA SSOT).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DROP INDEX IF EXISTS faculty_workspace_hierarchy_rank_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS faculty_workspace_status_rank_idx;
--> statement-breakpoint

ALTER TABLE faculty DROP COLUMN IF EXISTS department;
--> statement-breakpoint
ALTER TABLE faculty DROP COLUMN IF EXISTS designation;
--> statement-breakpoint
ALTER TABLE faculty DROP COLUMN IF EXISTS hierarchy_rank;
