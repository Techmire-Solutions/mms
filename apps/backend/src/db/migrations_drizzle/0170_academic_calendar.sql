-- MMS Forward-only Migration: 0170_academic_calendar.sql
-- Phase 5 — Academic calendar (owned by the Attendance module):
--   1. academic_calendar_events: holidays, make-up days, exam periods and events, scoped to the
--      workspace, a session, a class or a section (narrowest scope wins).
--   2. session_working_days: optional per-session weekly teaching days (0 = Sunday); when a
--      session has none, the workspace attendance `workingDays` preference applies.
-- Both tables are new, so plain CREATE INDEX IF NOT EXISTS is lock-safe here.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── academic_calendar_events ─────────────────────────
CREATE TABLE IF NOT EXISTS "academic_calendar_events" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "title"                varchar(150)  NOT NULL,
  "kind"                 varchar(20)   NOT NULL,
  "start_on"             date          NOT NULL,
  "end_on"               date          NOT NULL,
  "scope"                varchar(20)   NOT NULL DEFAULT 'workspace',
  "session_id"           text,
  "class_id"             text,
  "section_id"           text,
  "notes"                text,
  "created_by"           text,
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "academic_calendar_events_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "academic_calendar_events_kind_check" CHECK ("kind" IN ('holiday', 'makeup_day', 'exam_period', 'event')),
  CONSTRAINT "academic_calendar_events_scope_check" CHECK ("scope" IN ('workspace', 'session', 'class', 'section')),
  CONSTRAINT "academic_calendar_events_period_check" CHECK ("end_on" >= "start_on"),
  CONSTRAINT "academic_calendar_events_title_not_blank_check" CHECK (btrim("title") <> ''),
  CONSTRAINT "academic_calendar_events_scope_refs_check" CHECK (
    ("scope" = 'workspace' AND "session_id" IS NULL AND "class_id" IS NULL AND "section_id" IS NULL)
    OR ("scope" = 'session' AND "session_id" IS NOT NULL AND "class_id" IS NULL AND "section_id" IS NULL)
    OR ("scope" = 'class' AND "session_id" IS NOT NULL AND "class_id" IS NOT NULL AND "section_id" IS NULL)
    OR ("scope" = 'section' AND "session_id" IS NOT NULL AND "class_id" IS NOT NULL AND "section_id" IS NOT NULL)
  ),
  CONSTRAINT "academic_calendar_events_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "academic_calendar_events_session_fk" FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "academic_calendar_events_class_fk" FOREIGN KEY ("workspace_subdomain", "session_id", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "session_id", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT "academic_calendar_events_section_fk" FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_range_active_idx" ON "academic_calendar_events" ("workspace_subdomain", "start_on", "end_on") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_session_idx" ON "academic_calendar_events" ("workspace_subdomain", "session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_class_idx" ON "academic_calendar_events" ("workspace_subdomain", "session_id", "class_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_section_idx" ON "academic_calendar_events" ("workspace_subdomain", "section_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_workspace_active_idx" ON "academic_calendar_events" ("workspace_subdomain") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_workspace_deleted_idx" ON "academic_calendar_events" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_calendar_events_deleted_records_idx" ON "academic_calendar_events" ("workspace_subdomain", "deleted_at") WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "academic_calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "academic_calendar_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "academic_calendar_events";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "academic_calendar_events"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
      AND ("deleted_at" IS NULL OR current_setting('app.include_deleted', true) = 'true')
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_academic_calendar_events_forbid_hard_delete" ON "academic_calendar_events";
--> statement-breakpoint
CREATE TRIGGER "trg_academic_calendar_events_forbid_hard_delete" BEFORE DELETE ON "academic_calendar_events" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_academic_calendar_events_updated_at" ON "academic_calendar_events";
--> statement-breakpoint
CREATE TRIGGER "update_academic_calendar_events_updated_at" BEFORE UPDATE ON "academic_calendar_events" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

-- ───────────────────────── session_working_days ─────────────────────────
CREATE TABLE IF NOT EXISTS "session_working_days" (
  "workspace_subdomain"  text          NOT NULL,
  "session_id"           text          NOT NULL,
  "weekday"              smallint      NOT NULL,
  CONSTRAINT "session_working_days_pk" PRIMARY KEY ("workspace_subdomain", "session_id", "weekday"),
  CONSTRAINT "session_working_days_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "session_working_days_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "session_working_days_session_fk" FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE "session_working_days" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_working_days" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_working_days";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_working_days"
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

-- ───────────── Preserve behaviour: weekdays already taught stay working days ─────────────
-- `workingDays` (default Mon–Fri) now drives the instructional-day guard and attendance rates.
-- Any weekday on which a workspace marked attendance in the last year is merged into its
-- working days, so existing schedules (e.g. Saturday classes) are not blocked. Idempotent.
WITH observed AS (
  SELECT a.workspace_subdomain AS ws,
         array_agg(DISTINCT lower(to_char(left(a.date, 10)::date, 'FMday'))) AS days
    FROM (
      SELECT workspace_subdomain, date FROM attendance
       WHERE deleted_at IS NULL
         AND date ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
         AND date >= to_char(CURRENT_DATE - 365, 'YYYY-MM-DD')
    ) a
   GROUP BY a.workspace_subdomain
),
merged AS (
  SELECT o.ws,
         (SELECT jsonb_agg(d ORDER BY d) FROM (
            SELECT DISTINCT d FROM unnest(o.days || CASE
              WHEN jsonb_typeof(p.preferences -> 'workingDays') = 'array'
                THEN ARRAY(SELECT jsonb_array_elements_text(p.preferences -> 'workingDays'))
              ELSE ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            END) AS d
            WHERE d IS NOT NULL
         ) u) AS days
    FROM observed o
    INNER JOIN workspaces w ON w.subdomain = o.ws
    LEFT JOIN attendance_module_preferences p ON p.workspace_subdomain = o.ws
)
INSERT INTO attendance_module_preferences (workspace_subdomain, preferences, updated_at)
SELECT ws, jsonb_build_object('workingDays', days), now() FROM merged
ON CONFLICT (workspace_subdomain) DO UPDATE
  SET preferences = jsonb_set(attendance_module_preferences.preferences, '{workingDays}', EXCLUDED.preferences -> 'workingDays'),
      updated_at = now();
