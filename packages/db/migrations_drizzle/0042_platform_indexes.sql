CREATE INDEX IF NOT EXISTS "workspaces_enabled_idx" ON "workspaces" ("enabled");
CREATE INDEX IF NOT EXISTS "platform_activity_logs_action_created_at_idx" ON "platform_activity_logs" ("action", "created_at");
