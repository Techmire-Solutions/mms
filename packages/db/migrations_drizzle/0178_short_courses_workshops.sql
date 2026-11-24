-- MMS Forward-only Migration: 0178_short_courses_workshops.sql
-- Phase 11 — Short courses & workshops.
--   sessions.min_attendance_pct / requires_exam_pass     — completion criteria (short courses).
--   enrollments.completion_status / completed_at / certificate_issued_at — evaluated completion.
--   workshop_events: capacity, registration deadline, fee, program / subject, soft-delete.
--   workshop_participants: soft-delete.
--   workshop_attendance — per-day check-in (participant × day).
-- All added columns are nullable or carry a constant default (metadata-only). New CHECKs on
-- populated tables are NOT VALID (every existing row is NULL anyway). Workshop tables are not in
-- the large-table list (reserved module, no surface yet) → plain CREATE INDEX IF NOT EXISTS.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "min_attendance_pct" smallint;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "requires_exam_pass" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_min_attendance_pct_check";
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_min_attendance_pct_check"
  CHECK ("min_attendance_pct" IS NULL OR "min_attendance_pct" BETWEEN 0 AND 100) NOT VALID;
--> statement-breakpoint

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "completion_status" varchar(20);
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "certificate_issued_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "enrollments" DROP CONSTRAINT IF EXISTS "enrollments_completion_status_check";
--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_completion_status_check"
  CHECK ("completion_status" IS NULL OR "completion_status" IN ('completed', 'not_completed')) NOT VALID;
--> statement-breakpoint

ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "capacity" integer;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "registration_deadline" timestamptz;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "fee" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "program_id" text;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "subject_id" text;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "deleted_by" text;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "deletion_reason" varchar(500);
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "restored_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "restored_by" text;
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_capacity_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_capacity_check"
  CHECK ("capacity" IS NULL OR "capacity" >= 0);
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_fee_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_fee_check"
  CHECK ("fee" IS NULL OR "fee" >= 0);
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_program_fk";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_program_fk"
  FOREIGN KEY ("workspace_subdomain", "program_id") REFERENCES "programs" ("workspace_subdomain", "id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_subject_fk";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_subject_fk"
  FOREIGN KEY ("workspace_subdomain", "subject_id") REFERENCES "subjects" ("workspace_subdomain", "id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_events_program_idx" ON "workshop_events" ("workspace_subdomain", "program_id") WHERE "program_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_events_subject_idx" ON "workshop_events" ("workspace_subdomain", "subject_id") WHERE "subject_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_events_workspace_deleted_idx" ON "workshop_events" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_events_workspace_active_idx" ON "workshop_events" ("workspace_subdomain") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_events_deleted_records_idx" ON "workshop_events" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_workshop_events_updated_at" ON "workshop_events";
--> statement-breakpoint
CREATE TRIGGER "update_workshop_events_updated_at" BEFORE UPDATE ON "workshop_events" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_workshop_events_forbid_hard_delete" ON "workshop_events";
--> statement-breakpoint
CREATE TRIGGER "trg_workshop_events_forbid_hard_delete" BEFORE DELETE ON "workshop_events" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "deleted_by" text;
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "deletion_reason" varchar(500);
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "restored_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "restored_by" text;
--> statement-breakpoint
ALTER TABLE "workshop_participants" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" boolean DEFAULT false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_participants_workspace_deleted_idx" ON "workshop_participants" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_participants_workspace_active_idx" ON "workshop_participants" ("workspace_subdomain") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_participants_deleted_records_idx" ON "workshop_participants" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workshop_participants_contact_uidx" ON "workshop_participants" ("workspace_subdomain", "workshop_id", "contact_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_workshop_participants_forbid_hard_delete" ON "workshop_participants";
--> statement-breakpoint
CREATE TRIGGER "trg_workshop_participants_forbid_hard_delete" BEFORE DELETE ON "workshop_participants" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "workshop_attendance" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "workshop_id"          text          NOT NULL,
  "participant_id"       text          NOT NULL,
  "day_on"               date          NOT NULL,
  "status"               varchar(20)   NOT NULL,
  "marked_by"            text,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "workshop_attendance_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "workshop_attendance_status_check" CHECK ("status" IN ('present', 'absent', 'late', 'excused')),
  CONSTRAINT "workshop_attendance_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "workshop_attendance_workshop_fk" FOREIGN KEY ("workspace_subdomain", "workshop_id")
    REFERENCES "workshop_events" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "workshop_attendance_participant_fk" FOREIGN KEY ("workspace_subdomain", "participant_id")
    REFERENCES "workshop_participants" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workshop_attendance_participant_day_uidx" ON "workshop_attendance" ("workspace_subdomain", "participant_id", "day_on");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workshop_attendance_workshop_day_idx" ON "workshop_attendance" ("workspace_subdomain", "workshop_id", "day_on");
--> statement-breakpoint
ALTER TABLE "workshop_attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workshop_attendance" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "workshop_attendance";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "workshop_attendance"
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
DROP TRIGGER IF EXISTS "update_workshop_attendance_updated_at" ON "workshop_attendance";
--> statement-breakpoint
CREATE TRIGGER "update_workshop_attendance_updated_at" BEFORE UPDATE ON "workshop_attendance" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
