-- MMS Forward-only Migration: 0148_faculty_assignments_primary_covering_idx.sql
-- Covering partial index for primary active appointment lookups (list LATERAL / hydrate).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS faculty_assignments_primary_active_covering_idx
  ON faculty_assignments (workspace_subdomain, faculty_id, start_date DESC)
  INCLUDE (department_id, designation_id, position_id)
  WHERE deleted_at IS NULL AND is_primary = true AND status = 'active';
--> statement-breakpoint

-- Faster reverse lookup: position occupants for subordinate walks
CREATE INDEX IF NOT EXISTS faculty_assignments_position_primary_active_idx
  ON faculty_assignments (workspace_subdomain, position_id)
  WHERE deleted_at IS NULL AND is_primary = true AND status = 'active';
