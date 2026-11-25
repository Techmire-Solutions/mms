-- MMS Forward-only Migration: 0209_report_indexes_and_job_errors.sql
-- Row-level import errors (job API/UI) + workspace-day timetable reports.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "errors" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_class_timetables_workspace_date_idx"
  ON "session_class_timetables" ("workspace_subdomain", "date")
  WHERE "date" IS NOT NULL;
