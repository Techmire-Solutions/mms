-- MMS Forward-only Migration: 0144_faculty_child_soft_delete_and_status.sql
-- Child-table soft-delete index tiers, RLS soft-delete isolation, faculty autovacuum,
-- redundant contact index cleanup, and strict faculty employment status CHECK.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- Category A: (workspace_subdomain, deleted_at)
CREATE INDEX IF NOT EXISTS faculty_departments_workspace_deleted_idx
  ON faculty_departments (workspace_subdomain, deleted_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faculty_designations_workspace_deleted_idx
  ON faculty_designations (workspace_subdomain, deleted_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faculty_assignments_workspace_deleted_idx
  ON faculty_assignments (workspace_subdomain, deleted_at);
--> statement-breakpoint

-- Category B: active rows
CREATE INDEX IF NOT EXISTS faculty_departments_workspace_active_idx
  ON faculty_departments (workspace_subdomain)
  WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faculty_designations_workspace_active_idx
  ON faculty_designations (workspace_subdomain)
  WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS faculty_assignments_workspace_active_idx
  ON faculty_assignments (workspace_subdomain)
  WHERE deleted_at IS NULL;
--> statement-breakpoint

-- RLS: tenant_soft_delete_isolation (match faculty / teachers from 0108)
DROP POLICY IF EXISTS tenant_isolation_policy ON faculty_departments;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_soft_delete_isolation ON faculty_departments;
--> statement-breakpoint
CREATE POLICY tenant_soft_delete_isolation ON faculty_departments
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

DROP POLICY IF EXISTS tenant_isolation_policy ON faculty_designations;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_soft_delete_isolation ON faculty_designations;
--> statement-breakpoint
CREATE POLICY tenant_soft_delete_isolation ON faculty_designations
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

DROP POLICY IF EXISTS tenant_isolation_policy ON faculty_assignments;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_soft_delete_isolation ON faculty_assignments;
--> statement-breakpoint
CREATE POLICY tenant_soft_delete_isolation ON faculty_assignments
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
      AND (
        deleted_at IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

ALTER TABLE faculty SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

DROP INDEX IF EXISTS faculty_workspace_contact_active_idx;
--> statement-breakpoint

-- Status preflight: normalize aliases, then remap unknown custom labels to inactive.
UPDATE faculty SET status = 'on_leave'
  WHERE lower(btrim(status)) IN ('on leave', 'on-leave', 'onleave');
--> statement-breakpoint
UPDATE faculty SET status = 'active' WHERE lower(btrim(status)) = 'active';
--> statement-breakpoint
UPDATE faculty SET status = 'inactive' WHERE lower(btrim(status)) = 'inactive';
--> statement-breakpoint
UPDATE faculty SET status = 'inactive'
  WHERE lower(btrim(status)) NOT IN ('active', 'inactive', 'on_leave');
--> statement-breakpoint

ALTER TABLE faculty DROP CONSTRAINT IF EXISTS faculty_status_check;
--> statement-breakpoint
ALTER TABLE faculty ADD CONSTRAINT faculty_status_check
  CHECK (lower(btrim(status)) IN ('active', 'inactive', 'on_leave'))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE faculty VALIDATE CONSTRAINT faculty_status_check;
