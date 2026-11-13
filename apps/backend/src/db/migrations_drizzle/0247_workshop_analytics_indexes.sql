-- 0247_workshop_analytics_indexes.sql
-- Forward-only. Covering partial indexes for the Workshops metrics/report aggregations.
--
-- The metrics/report scans filter live rows by status and date, and count only seated participants;
-- the original indexes omitted those predicates, so every aggregate did a heap fetch per row.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workshop_events_ws_status_dates_active_idx"
  ON "workshop_events" ("workspace_subdomain", "status", "start_date", "end_date")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workshop_participants_ws_active_workshop_idx"
  ON "workshop_participants" ("workspace_subdomain", "workshop_id")
  WHERE "deleted_at" IS NULL AND "waitlisted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workshop_participants_ws_active_status_idx"
  ON "workshop_participants" ("workspace_subdomain", "workshop_id", "status")
  WHERE "deleted_at" IS NULL AND "waitlisted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workshop_attendance_ws_workshop_day_status_idx"
  ON "workshop_attendance" ("workspace_subdomain", "workshop_id", "day_on", "status");
