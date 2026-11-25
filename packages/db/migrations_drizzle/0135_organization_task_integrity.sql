SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;
UPDATE tasks SET status = 'completed', completed_at = COALESCE(completed_at, updated_at) WHERE status = 'done';
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'in_review', 'blocked', 'completed', 'cancelled'));
--> statement-breakpoint
ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_faculty_fk
  FOREIGN KEY (workspace_subdomain, faculty_id) REFERENCES faculty(workspace_subdomain, id) NOT VALID;
ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_assignment_fk
  FOREIGN KEY (workspace_subdomain, faculty_assignment_id) REFERENCES faculty_assignments(workspace_subdomain, id) NOT VALID;
ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_position_fk
  FOREIGN KEY (workspace_subdomain, position_id) REFERENCES organization_positions(workspace_subdomain, id) NOT VALID;
ALTER TABLE task_assignees ADD CONSTRAINT task_assignees_user_fk
  FOREIGN KEY (workspace_subdomain, user_id) REFERENCES tenant_users(workspace_subdomain, id) NOT VALID;
--> statement-breakpoint
CREATE TABLE task_module_preferences (
  workspace_subdomain text PRIMARY KEY REFERENCES workspaces(subdomain) ON DELETE CASCADE,
  delegation_scope varchar(32) NOT NULL DEFAULT 'descendants',
  allow_self_assignment boolean NOT NULL DEFAULT true,
  notify_on_assignment boolean NOT NULL DEFAULT true,
  notify_on_status_change boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_module_preferences_scope_check CHECK (delegation_scope IN ('descendants', 'direct_reports'))
);
ALTER TABLE task_module_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_module_preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON task_module_preferences FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), ''));
