-- Migration 0266: tasks notification channel + user-targeted notifications +
-- (workspace_subdomain, created_at DESC) directory index; drop the unused
-- task_assignees.completed_at column (round-2 review: M4, m14, m15).

SET LOCAL lock_timeout = '2s';--> statement-breakpoint
ALTER TABLE "tenant_notifications" ADD COLUMN "recipient_user_id" text;--> statement-breakpoint
ALTER TABLE "task_module_preferences" ADD COLUMN "notification_channel" varchar(32) DEFAULT 'in_app' NOT NULL;--> statement-breakpoint
CREATE INDEX "tenant_notifications_workspace_recipient_idx" ON "tenant_notifications" USING btree ("workspace_subdomain","recipient_user_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_created_active_idx" ON "tasks" USING btree ("workspace_subdomain","created_at" DESC) WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
ALTER TABLE "task_assignees" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "task_module_preferences" ADD CONSTRAINT "task_module_preferences_channel_check" CHECK ("task_module_preferences"."notification_channel" IN ('in_app', 'messaging', 'both'));