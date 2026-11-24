-- MMS Forward-only Migration: 0221_attendance_absence_alerts.sql
-- Chronic-absence escalation (docs/attendance-specialized-subsystems-audit-2026-11-09.md):
-- nothing in the product computed consecutive absences, so no defaulter could ever be identified.
-- This table is the audited result of the daily scan; the unique key makes a re-run idempotent.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "attendance_absence_alerts" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "class_id"             varchar(64)   NOT NULL,
  "student_id"           varchar(64)   NOT NULL,
  "streak_start"         date          NOT NULL,
  "streak_end"           date          NOT NULL,
  "streak_length"        integer       NOT NULL,
  "threshold"            integer       NOT NULL,
  "status"               varchar(20)   NOT NULL DEFAULT 'open',
  "notified_at"          timestamp with time zone,
  "resolved_at"          timestamp with time zone,
  "resolved_by"          text,
  "resolution_note"      varchar(500),
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "attendance_absence_alerts_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "attendance_absence_alerts_status_check"
    CHECK ("status" IN ('open', 'resolved', 'dismissed')),
  CONSTRAINT "attendance_absence_alerts_length_check" CHECK ("streak_length" >= 1),
  CONSTRAINT "attendance_absence_alerts_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "attendance_absence_alerts_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "attendance_absence_alerts_student_fk" FOREIGN KEY ("workspace_subdomain", "student_id")
    REFERENCES "students" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "attendance_absence_alerts_streak_uidx"
  ON "attendance_absence_alerts" ("workspace_subdomain", "class_id", "student_id", "streak_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_absence_alerts_workspace_status_idx"
  ON "attendance_absence_alerts" ("workspace_subdomain", "status", "streak_end");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_absence_alerts_workspace_student_idx"
  ON "attendance_absence_alerts" ("workspace_subdomain", "student_id");
--> statement-breakpoint

ALTER TABLE "attendance_absence_alerts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attendance_absence_alerts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "attendance_absence_alerts";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "attendance_absence_alerts"
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
DROP TRIGGER IF EXISTS "update_attendance_absence_alerts_updated_at" ON "attendance_absence_alerts";
--> statement-breakpoint
CREATE TRIGGER "update_attendance_absence_alerts_updated_at"
  BEFORE UPDATE ON "attendance_absence_alerts"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
