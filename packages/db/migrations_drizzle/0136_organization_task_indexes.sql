-- MMS Forward-only Migration: 0136_organization_task_indexes.sql
-- Aligns task_assignees unique occupancy index with Drizzle schema and validates FKs from 0135.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "task_assignees_recipient_active_uidx"
  ON "task_assignees" ("workspace_subdomain", "task_id", "user_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

ALTER TABLE "task_assignees" VALIDATE CONSTRAINT "task_assignees_faculty_fk";
--> statement-breakpoint
ALTER TABLE "task_assignees" VALIDATE CONSTRAINT "task_assignees_assignment_fk";
--> statement-breakpoint
ALTER TABLE "task_assignees" VALIDATE CONSTRAINT "task_assignees_position_fk";
--> statement-breakpoint
ALTER TABLE "task_assignees" VALIDATE CONSTRAINT "task_assignees_user_fk";
