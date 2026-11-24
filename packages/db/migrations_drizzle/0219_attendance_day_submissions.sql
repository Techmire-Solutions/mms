-- MMS Forward-only Migration: 0219_attendance_day_submissions.sql
-- `lockAfterSubmit` had nothing to enforce it (docs/attendance-usecase-service-review-2026-11-08.md):
-- the marking grid kept the "submitted" flag in React state and wrote nothing durable, so a submitted
-- roster stayed editable forever. This table is that missing state.
--
-- A day is identified by (workspace, class, date). Submitting records who/when and locks it;
-- reopening records who/when/why and unlocks it. The newest of `submitted_at` / `reopened_at` wins,
-- so no second history table is needed.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` stays blocked by
-- the 0216/0217 snapshot-chain collision (docs/open-items.md). Idempotent throughout.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "attendance_day_submissions" (
  "workspace_subdomain"  text          NOT NULL,
  "class_id"             text          NOT NULL,
  "date_on"              date          NOT NULL,
  "submitted_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "submitted_by"         text,
  "reopened_at"          timestamp with time zone,
  "reopened_by"          text,
  "reopen_reason"        varchar(500),
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_day_submissions_pk" PRIMARY KEY ("workspace_subdomain", "class_id", "date_on"),
  CONSTRAINT "attendance_day_submissions_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  -- Same target as `attendance_class_fk`: a submission cannot outlive its class.
  CONSTRAINT "attendance_day_submissions_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "attendance_day_submissions_workspace_date_idx"
  ON "attendance_day_submissions" ("workspace_subdomain", "date_on");
--> statement-breakpoint

ALTER TABLE "attendance_day_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attendance_day_submissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "attendance_day_submissions";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "attendance_day_submissions"
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
DROP TRIGGER IF EXISTS "update_attendance_day_submissions_updated_at" ON "attendance_day_submissions";
--> statement-breakpoint
CREATE TRIGGER "update_attendance_day_submissions_updated_at"
  BEFORE UPDATE ON "attendance_day_submissions"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
