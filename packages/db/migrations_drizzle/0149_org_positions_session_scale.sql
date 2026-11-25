-- MMS Forward-only Migration: 0149_org_positions_session_scale.sql
-- Soft-delete index/RLS parity for organization_positions; timetable faculty_id index.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS organization_positions_workspace_deleted_idx
  ON organization_positions (workspace_subdomain, deleted_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organization_positions_workspace_active_idx
  ON organization_positions (workspace_subdomain)
  WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organization_positions_designation_active_idx
  ON organization_positions (workspace_subdomain, designation_id)
  WHERE deleted_at IS NULL;
--> statement-breakpoint

DROP POLICY IF EXISTS tenant_isolation_policy ON organization_positions;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_soft_delete_isolation ON organization_positions;
--> statement-breakpoint
CREATE POLICY tenant_soft_delete_isolation ON organization_positions
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

CREATE INDEX IF NOT EXISTS session_class_timetable_periods_workspace_faculty_idx
  ON session_class_timetable_periods (workspace_subdomain, faculty_id);
