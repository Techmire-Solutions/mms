SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE faculty_designations
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by text,
  ADD COLUMN deletion_reason varchar(500),
  ADD COLUMN restored_at timestamptz,
  ADD COLUMN restored_by text,
  ADD COLUMN deleted_with_cascade boolean DEFAULT false;
--> statement-breakpoint
-- Designations are a small tenant setup catalog. Keep uniqueness during replacement.
CREATE UNIQUE INDEX IF NOT EXISTS faculty_designations_ws_code_active_uidx
  ON faculty_designations (workspace_subdomain, code) WHERE deleted_at IS NULL;
--> statement-breakpoint
ALTER TABLE faculty_designations DROP CONSTRAINT faculty_designations_workspace_code_uidx;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faculty_designations_active_rank_idx
  ON faculty_designations (workspace_subdomain, hierarchy_rank) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faculty_designations_deleted_idx
  ON faculty_designations (workspace_subdomain, deleted_at) WHERE deleted_at IS NOT NULL;
--> statement-breakpoint
ALTER TABLE faculty_departments ADD CONSTRAINT faculty_departments_head_faculty_fk
  FOREIGN KEY (workspace_subdomain, head_faculty_id)
  REFERENCES faculty (workspace_subdomain, id) ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED NOT VALID;
--> statement-breakpoint
ALTER TABLE faculty_departments VALIDATE CONSTRAINT faculty_departments_head_faculty_fk;
--> statement-breakpoint
-- SET NULL on a composite key would also null the non-null tenant column.
ALTER TABLE faculty_assignments DROP CONSTRAINT faculty_assignments_reports_to_fk;
ALTER TABLE faculty_assignments ADD CONSTRAINT faculty_assignments_reports_to_fk
  FOREIGN KEY (workspace_subdomain, reports_to_assignment_id)
  REFERENCES faculty_assignments (workspace_subdomain, id) ON DELETE RESTRICT NOT VALID;
--> statement-breakpoint
ALTER TABLE faculty_assignments VALIDATE CONSTRAINT faculty_assignments_reports_to_fk;
--> statement-breakpoint
ALTER TABLE faculty_designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_designations FORCE ROW LEVEL SECURITY;
ALTER TABLE faculty_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_departments FORCE ROW LEVEL SECURITY;
ALTER TABLE faculty_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE faculty_assignments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE TRIGGER trg_faculty_designations_forbid_hard_delete
  BEFORE DELETE ON faculty_designations FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
CREATE TRIGGER trg_faculty_departments_forbid_hard_delete
  BEFORE DELETE ON faculty_departments FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
CREATE TRIGGER trg_faculty_assignments_forbid_hard_delete
  BEFORE DELETE ON faculty_assignments FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
ALTER TABLE faculty_designations SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE faculty_departments SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE faculty_assignments SET (autovacuum_vacuum_scale_factor = 0.05);
