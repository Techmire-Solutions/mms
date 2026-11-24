-- Hot message_logs list/metrics paths — expression/partial indexes for JSONB soft-archive + sentAt sort.
CREATE INDEX IF NOT EXISTS "message_logs_workspace_active_idx"
  ON "message_logs" USING btree ("workspace_subdomain")
  WHERE (custom_data->>'deletedAt') IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_logs_workspace_sent_at_active_idx"
  ON "message_logs" USING btree ("workspace_subdomain", ((custom_data->>'sentAt')) DESC NULLS LAST)
  WHERE (custom_data->>'deletedAt') IS NULL;
