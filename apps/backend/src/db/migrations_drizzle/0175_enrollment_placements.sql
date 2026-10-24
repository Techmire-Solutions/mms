-- MMS Forward-only Migration: 0175_enrollment_placements.sql
-- Phase 9a — Mid-session operations are dated events, never overwrites.
--   enrollment_placements          — student × class × section over [start_on, end_on] (Ed-Fi
--                                    StudentSectionAssociation); enrollments.class_id/section_id
--                                    stay the *current* placement, kept in sync by the app.
--   enrollments.start_on/end_on    — enrollment window (late join / withdrawal); nullable, no
--                                    backfill on this large table (start_on falls back to enrolled_on).
--   enrollment_timeline_events     — typed, server-written events (actor, type, from/to, reason).
-- New table → plain CREATE INDEX IF NOT EXISTS is lock-safe. Columns added to populated tables are
-- nullable without defaults (metadata-only); the CHECK is added NOT VALID and validated separately.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "enrollment_placements" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "enrollment_id"        text          NOT NULL,
  "class_id"             text          NOT NULL,
  "section_id"           text,
  "start_on"             date          NOT NULL,
  "end_on"               date,
  "reason"               varchar(500),
  "created_by"           text,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "enrollment_placements_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "enrollment_placements_range_check" CHECK ("end_on" IS NULL OR "end_on" >= "start_on"),
  CONSTRAINT "enrollment_placements_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "enrollment_placements_enrollment_fk" FOREIGN KEY ("workspace_subdomain", "enrollment_id")
    REFERENCES "enrollments" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "enrollment_placements_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "enrollment_placements_section_fk" FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
-- At most one open placement per enrollment.
CREATE UNIQUE INDEX IF NOT EXISTS "enrollment_placements_open_uidx" ON "enrollment_placements" ("workspace_subdomain", "enrollment_id") WHERE "end_on" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollment_placements_enrollment_idx" ON "enrollment_placements" ("workspace_subdomain", "enrollment_id", "start_on");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollment_placements_class_idx" ON "enrollment_placements" ("workspace_subdomain", "class_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollment_placements_section_idx" ON "enrollment_placements" ("workspace_subdomain", "section_id");
--> statement-breakpoint
ALTER TABLE "enrollment_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_placements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "enrollment_placements";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "enrollment_placements"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

-- Backfill: one open placement per live enrollment whose class still exists (orphans are listed by
-- audit:class-references). Deterministic ids keep re-runs a no-op.
INSERT INTO "enrollment_placements" ("id", "workspace_subdomain", "enrollment_id", "class_id", "section_id", "start_on", "reason")
SELECT
  'plc-' || e."id",
  e."workspace_subdomain",
  e."id",
  e."class_id",
  s."id",
  COALESCE(e."enrolled_on", mms_try_date(e."enrolled_date"), e."created_at"::date),
  'Backfilled from the current enrollment (migration 0175)'
FROM "enrollments" e
JOIN "session_classes" c
  ON c."workspace_subdomain" = e."workspace_subdomain" AND c."id" = e."class_id"
LEFT JOIN "session_class_sections" s
  ON s."workspace_subdomain" = e."workspace_subdomain" AND s."id" = e."section_id"
WHERE e."deleted_at" IS NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "start_on" date;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "end_on" date;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "end_reason" varchar(500);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_window_check"
    CHECK ("end_on" IS NULL OR "start_on" IS NULL OR "end_on" >= "start_on") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "enrollments" VALIDATE CONSTRAINT "enrollments_window_check";
--> statement-breakpoint

ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "event_type" varchar(40);
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "occurred_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "effective_on" date;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "actor_user_id" text;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "from_class_id" text;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "to_class_id" text;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "from_section_id" text;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "to_section_id" text;
--> statement-breakpoint
ALTER TABLE "enrollment_timeline_events" ADD COLUMN IF NOT EXISTS "reason" varchar(500);
