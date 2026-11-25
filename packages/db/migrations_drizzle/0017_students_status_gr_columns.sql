-- Typed status / gr_number expand (JSONB status / grNumber remain API SSOT).
-- Rebuild hot-path indexes onto typed columns (replaces 0014/0015 JSONB expressions).

ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "status" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "gr_number" text;--> statement-breakpoint

UPDATE "students"
SET
  "status" = lower(trim(COALESCE(NULLIF(trim("custom_data"->>'status'), ''), 'active'))),
  "gr_number" = NULLIF(trim("custom_data"->>'grNumber'), '');--> statement-breakpoint

DROP INDEX IF EXISTS "students_workspace_status_active_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_gr_active_uidx";--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_gr_active_idx";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "students_workspace_status_active_idx"
  ON "students" USING btree (
    "workspace_subdomain",
    (lower(trim(COALESCE("status", 'active'))))
  )
  WHERE "deleted_at" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_active_uidx"
  ON "students" (
    "workspace_subdomain",
    (lower(trim("gr_number")))
  )
  WHERE "deleted_at" IS NULL
    AND NULLIF(trim("gr_number"), '') IS NOT NULL;
