-- MMS Forward-only Migration: 0157_faculty_index_prune.sql
-- Drop overlapping faculty indexes superseded by partial/expression variants used by Work list.
-- Trigram GIN search indexes are intentionally NOT added here (add only after proven slow search).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- Non-partial specialization index superseded by faculty_workspace_specialization_active_idx
DROP INDEX IF EXISTS "faculty_workspace_specialization_idx";
--> statement-breakpoint

-- Non-partial status index superseded by expression/partial status indexes
DROP INDEX IF EXISTS "faculty_workspace_status_idx";
--> statement-breakpoint

-- Plain status+updated_at superseded by status_expr_updated_at_active_idx (list metrics)
DROP INDEX IF EXISTS "faculty_workspace_status_updated_at_active_idx";
--> statement-breakpoint

-- Plain status+id superseded by status_expr_id_active_idx
DROP INDEX IF EXISTS "faculty_workspace_status_id_active_idx";
--> statement-breakpoint

-- Hot-table autovacuum (same factor as new employment tables)
ALTER TABLE "faculty" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint
ALTER TABLE "faculty_assignments" SET (autovacuum_vacuum_scale_factor = 0.05);
