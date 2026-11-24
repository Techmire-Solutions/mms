-- MMS Forward-only Migration: 0172_academic_date_columns.sql
-- Phase 7 — varchar → date for academic calendar-day columns on small tables
-- (mms-data-layer §8: calendar days are `date`, never text).
--   • `YYYY-MM-DD` keeps its value; `YYYY-MM-DDT…` keeps its date part; empty → NULL.
--   • Anything else is copied to `date_conversion_rejects` (table, column, row key, raw value)
--     before becoming NULL, so no value is lost. Run `pnpm --filter mms-backend audit:date-columns`
--     beforehand to see them.
--   • Converted columns are nullable (an unknown date is NULL, not '').
-- Large tables (attendance, enrollments, students) use expand/contract in 0173.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE OR REPLACE FUNCTION mms_try_date(raw text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR btrim(raw) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN
    RETURN NULL;
  END IF;
  RETURN left(btrim(raw), 10)::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "date_conversion_rejects" (
  "id"                  bigserial    PRIMARY KEY,
  "workspace_subdomain" text         NOT NULL,
  "table_name"          text         NOT NULL,
  "column_name"         text         NOT NULL,
  "row_id"              text         NOT NULL,
  "raw_value"           text         NOT NULL,
  "migration"           text         NOT NULL DEFAULT '0172',
  "created_at"          timestamptz  NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "date_conversion_rejects_workspace_idx" ON "date_conversion_rejects" ("workspace_subdomain", "table_name");
--> statement-breakpoint
ALTER TABLE "date_conversion_rejects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "date_conversion_rejects" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "date_conversion_rejects";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "date_conversion_rejects"
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

-- Record unparseable values before conversion (re-runs insert nothing: columns are already date).
INSERT INTO "date_conversion_rejects" ("workspace_subdomain", "table_name", "column_name", "row_id", "raw_value")
SELECT workspace_subdomain, 'sessions', 'start_date', id, start_date::text FROM sessions
 WHERE pg_typeof(start_date)::text <> 'date' AND btrim(coalesce(start_date::text, '')) <> '' AND mms_try_date(start_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'sessions', 'end_date', id, end_date::text FROM sessions
 WHERE pg_typeof(end_date)::text <> 'date' AND btrim(coalesce(end_date::text, '')) <> '' AND mms_try_date(end_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_classes', 'age_calc_date', id, age_calc_date::text FROM session_classes
 WHERE pg_typeof(age_calc_date)::text <> 'date' AND btrim(coalesce(age_calc_date::text, '')) <> '' AND mms_try_date(age_calc_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_schedules', 'start_date', id, start_date::text FROM session_class_schedules
 WHERE pg_typeof(start_date)::text <> 'date' AND btrim(coalesce(start_date::text, '')) <> '' AND mms_try_date(start_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_schedules', 'end_date', id, end_date::text FROM session_class_schedules
 WHERE pg_typeof(end_date)::text <> 'date' AND btrim(coalesce(end_date::text, '')) <> '' AND mms_try_date(end_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_discounts', 'start_date', id, start_date::text FROM session_class_discounts
 WHERE pg_typeof(start_date)::text <> 'date' AND btrim(coalesce(start_date::text, '')) <> '' AND mms_try_date(start_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_discounts', 'end_date', id, end_date::text FROM session_class_discounts
 WHERE pg_typeof(end_date)::text <> 'date' AND btrim(coalesce(end_date::text, '')) <> '' AND mms_try_date(end_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_scholarships', 'expiry_date', id, expiry_date::text FROM session_class_scholarships
 WHERE pg_typeof(expiry_date)::text <> 'date' AND btrim(coalesce(expiry_date::text, '')) <> '' AND mms_try_date(expiry_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_timetables', 'date', id, date::text FROM session_class_timetables
 WHERE pg_typeof(date)::text <> 'date' AND btrim(coalesce(date::text, '')) <> '' AND mms_try_date(date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'session_class_refreshments', 'date', id, date::text FROM session_class_refreshments
 WHERE pg_typeof(date)::text <> 'date' AND btrim(coalesce(date::text, '')) <> '' AND mms_try_date(date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'attendance_leaves', 'from_date', id, from_date::text FROM attendance_leaves
 WHERE pg_typeof(from_date)::text <> 'date' AND btrim(coalesce(from_date::text, '')) <> '' AND mms_try_date(from_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'attendance_leaves', 'to_date', id, to_date::text FROM attendance_leaves
 WHERE pg_typeof(to_date)::text <> 'date' AND btrim(coalesce(to_date::text, '')) <> '' AND mms_try_date(to_date::text) IS NULL
UNION ALL
SELECT workspace_subdomain, 'exams', 'date', id, date::text FROM exams
 WHERE pg_typeof(date)::text <> 'date' AND btrim(coalesce(date::text, '')) <> '' AND mms_try_date(date::text) IS NULL;
--> statement-breakpoint

ALTER TABLE "sessions" ALTER COLUMN "start_date" DROP DEFAULT, ALTER COLUMN "start_date" DROP NOT NULL,
  ALTER COLUMN "start_date" TYPE date USING mms_try_date("start_date"::text);
--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "end_date" DROP DEFAULT, ALTER COLUMN "end_date" DROP NOT NULL,
  ALTER COLUMN "end_date" TYPE date USING mms_try_date("end_date"::text);
--> statement-breakpoint
ALTER TABLE "session_classes" ALTER COLUMN "age_calc_date" DROP DEFAULT, ALTER COLUMN "age_calc_date" DROP NOT NULL,
  ALTER COLUMN "age_calc_date" TYPE date USING mms_try_date("age_calc_date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_schedules" ALTER COLUMN "start_date" DROP DEFAULT, ALTER COLUMN "start_date" DROP NOT NULL,
  ALTER COLUMN "start_date" TYPE date USING mms_try_date("start_date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_schedules" ALTER COLUMN "end_date" DROP DEFAULT, ALTER COLUMN "end_date" DROP NOT NULL,
  ALTER COLUMN "end_date" TYPE date USING mms_try_date("end_date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_discounts" ALTER COLUMN "start_date" DROP DEFAULT, ALTER COLUMN "start_date" DROP NOT NULL,
  ALTER COLUMN "start_date" TYPE date USING mms_try_date("start_date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_discounts" ALTER COLUMN "end_date" DROP DEFAULT, ALTER COLUMN "end_date" DROP NOT NULL,
  ALTER COLUMN "end_date" TYPE date USING mms_try_date("end_date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_scholarships" ALTER COLUMN "expiry_date" DROP DEFAULT, ALTER COLUMN "expiry_date" DROP NOT NULL,
  ALTER COLUMN "expiry_date" TYPE date USING mms_try_date("expiry_date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_timetables" ALTER COLUMN "date" DROP DEFAULT, ALTER COLUMN "date" DROP NOT NULL,
  ALTER COLUMN "date" TYPE date USING mms_try_date("date"::text);
--> statement-breakpoint
ALTER TABLE "session_class_refreshments" ALTER COLUMN "date" DROP DEFAULT, ALTER COLUMN "date" DROP NOT NULL,
  ALTER COLUMN "date" TYPE date USING mms_try_date("date"::text);
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ALTER COLUMN "from_date" DROP DEFAULT, ALTER COLUMN "from_date" DROP NOT NULL,
  ALTER COLUMN "from_date" TYPE date USING mms_try_date("from_date"::text);
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ALTER COLUMN "to_date" DROP DEFAULT, ALTER COLUMN "to_date" DROP NOT NULL,
  ALTER COLUMN "to_date" TYPE date USING mms_try_date("to_date"::text);
--> statement-breakpoint
ALTER TABLE "exams" ALTER COLUMN "date" DROP DEFAULT, ALTER COLUMN "date" DROP NOT NULL,
  ALTER COLUMN "date" TYPE date USING mms_try_date("date"::text);
--> statement-breakpoint

-- Ranges stay ordered where both ends are known.
DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_date_range_check"
    CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_date_range_check"
    CHECK ("from_date" IS NULL OR "to_date" IS NULL OR "to_date" >= "from_date") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
