-- MMS Forward-only Migration: 0182_academic_contract_drop.sql
-- Phase 12, release B: drops everything release A (0181) kept alive for the previous release.
-- THIS MIGRATION IS NOT REVERSIBLE. Run it only once release A is live everywhere.
--
-- Required before this runs (all are verified by the guard in section 0, which aborts the
-- migration rather than losing data):
--   1. pnpm --filter mms-backend audit:academic-contract          (every count must be 0)
--   2. pnpm --filter mms-backend index:concurrent --file src/scripts/date_columns_concurrent_indexes.sql
--   3. pnpm --filter mms-backend index:concurrent --file src/scripts/academic_contract_concurrent_indexes.sql
-- Or run the whole gate in order with: bash scripts/admin-phase12-release-b.sh
--
-- Rolling back to release A is safe at the schema level only in the sense that release A already
-- uses the `*_on` names; the dropped columns themselves cannot be recovered except from a backup.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ── 0. Guard: refuse to drop anything while a precondition is unmet ───────────────────────────
DO $$
DECLARE
  unconverted bigint;
  duplicates  bigint;
  missing     text;
  populated   boolean;
BEGIN
  -- Dates that never converted would lose their only value when the varchar column goes.
  SELECT count(*) INTO unconverted FROM attendance WHERE date_on IS NULL;
  IF unconverted > 0 THEN
    RAISE EXCEPTION
      'release B aborted: % attendance row(s) still have date_on IS NULL. Run backfill:date-columns, then audit:date-columns.',
      unconverted;
  END IF;

  SELECT count(*) INTO unconverted FROM enrollments
   WHERE enrolled_on IS NULL AND btrim(COALESCE(enrolled_date, '')) <> '';
  IF unconverted > 0 THEN
    RAISE EXCEPTION
      'release B aborted: % enrollment(s) have an unconverted enrolled_date. Run backfill:date-columns.',
      unconverted;
  END IF;

  SELECT count(*) INTO unconverted FROM students
   WHERE (registered_on IS NULL AND btrim(COALESCE(registered_date, '')) <> '')
      OR (enrollment_on IS NULL AND btrim(COALESCE(enrollment_date, '')) <> '');
  IF unconverted > 0 THEN
    RAISE EXCEPTION
      'release B aborted: % student(s) have an unconverted registered/enrollment date. Run backfill:date-columns.',
      unconverted;
  END IF;

  -- The varchar unique index is about to go; its date_on replacement must already hold.
  SELECT count(*) INTO duplicates FROM (
    SELECT 1 FROM attendance WHERE date_on IS NOT NULL
     GROUP BY workspace_subdomain, class_id, student_id, date_on HAVING count(*) > 1) d;
  IF duplicates > 0 THEN
    RAISE EXCEPTION
      'release B aborted: % duplicate attendance mark(s) on (class, student, day). Merge them first.',
      duplicates;
  END IF;

  -- Is this a database where a plain index build would be a write outage? The probes stop at
  -- the threshold, so they cost nothing on a small table and never scan a large one.
  SELECT (SELECT count(*) FROM (SELECT 1 FROM attendance  LIMIT 50000) t) >= 50000
      OR (SELECT count(*) FROM (SELECT 1 FROM enrollments LIMIT 50000) t) >= 50000
      OR (SELECT count(*) FROM (SELECT 1 FROM students    LIMIT 50000) t) >= 50000
    INTO populated;

  IF NOT populated THEN
    -- Fresh or small database: CI, a newly provisioned environment, a dev box. Release A never
    -- created these, and the CONCURRENTLY scripts are an operator step for populated databases
    -- only, so without this branch a brand-new database could never get past this migration.
    -- Building them here is safe precisely because the table is small: the write lock is held
    -- for microseconds. `attendance` is deliberately the only table built this way — see the
    -- note on `enrollments` / `students` below.
    CREATE UNIQUE INDEX IF NOT EXISTS "attendance_workspace_class_student_date_on_uidx"
      ON "attendance" ("workspace_subdomain", "class_id", "student_id", "date_on") WHERE "deleted_at" IS NULL;
    CREATE INDEX IF NOT EXISTS "attendance_workspace_class_date_on_active_idx"
      ON "attendance" ("workspace_subdomain", "class_id", "date_on") WHERE "deleted_at" IS NULL;
    CREATE INDEX IF NOT EXISTS "attendance_workspace_class_date_on_status_active_idx"
      ON "attendance" ("workspace_subdomain", "class_id", "date_on", "status") WHERE "deleted_at" IS NULL;
    CREATE INDEX IF NOT EXISTS "attendance_workspace_date_on_idx"
      ON "attendance" ("workspace_subdomain", "date_on");
  END IF;

  -- Replacement indexes must exist AND be valid: a CONCURRENTLY build that failed leaves an
  -- invalid index behind, which the planner ignores and which enforces no uniqueness. The
  -- attendance set is always required — the unique one is the only thing keeping one mark per
  -- student, class and day once the varchar unique index is dropped. The two purely-performance
  -- indexes on `enrollments` and `students` are required only on a populated database: both of
  -- those tables are in the large-table list of scripts/check-migration-indexes.mjs, so this
  -- migration must not build them, and on a small database their absence costs nothing. The
  -- per-environment runbook step (`index:concurrent`, date_columns_concurrent_indexes.sql)
  -- creates them as the data grows.
  SELECT string_agg(expected.name, ', ' ORDER BY expected.name) INTO missing
    FROM (
      SELECT unnest(ARRAY[
        'attendance_workspace_class_student_date_on_uidx',
        'attendance_workspace_class_date_on_active_idx',
        'attendance_workspace_class_date_on_status_active_idx',
        'attendance_workspace_date_on_idx'
      ]) AS name
      UNION ALL
      SELECT unnest(ARRAY[
        'enrollments_workspace_enrolled_on_idx',
        'students_workspace_registered_on_idx'
      ]) AS name WHERE populated
    ) AS expected
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_class c
       JOIN pg_index i ON i.indexrelid = c.oid
      WHERE c.relname = expected.name AND i.indisvalid);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION
      'release B aborted: replacement index(es) missing or invalid: %. Run both index:concurrent scripts first.',
      missing;
  END IF;
END $$;
--> statement-breakpoint

-- ── 1. Self-heal memberships: capture any pair added since release A backfilled ────────────────
-- Release A copied the pairs that no enrollment can derive into the legacy table. An instance of
-- the previous release still writing directly to `student_enrolled_sessions` could have added more
-- since, so the same insert runs again here; without it those pairs vanish with the table.
INSERT INTO "student_enrolled_sessions_legacy" ("id", "workspace_subdomain", "student_id", "session_id", "sort_order", "created_at")
SELECT s."id", s."workspace_subdomain", s."student_id", s."session_id", s."sort_order", s."created_at"
  FROM "student_enrolled_sessions" s
 WHERE NOT EXISTS (
   SELECT 1 FROM "enrollments" e
    WHERE e."workspace_subdomain" = s."workspace_subdomain"
      AND e."student_id" = s."student_id" AND e."session_id" = s."session_id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint

-- ── 2. Triggers: stop maintaining the old shapes ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS "trg_sessions_type_snapshot" ON "sessions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_periods_subject_snapshot" ON "session_class_timetable_periods";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_exams_subject_snapshot" ON "exams";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_attendance_sync_date_on" ON "attendance";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_enrollments_sync_enrolled_on" ON "enrollments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_students_sync_date_on" ON "students";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_enrollments_mirror_enrolled_sessions" ON "enrollments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_legacy_mirror_enrolled_sessions" ON "student_enrolled_sessions_legacy";
--> statement-breakpoint

-- ── 3. Trigger functions ──────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS mms_sessions_type_snapshot();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_subject_snapshot();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_sync_attendance_date_on();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_sync_enrollments_enrolled_on();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_sync_students_date_on();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_mirror_enrolled_sessions_from_enrollment();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_mirror_enrolled_sessions_from_legacy();
--> statement-breakpoint
DROP FUNCTION IF EXISTS mms_mirror_enrolled_session(text, text, text);
--> statement-breakpoint
-- Only the dropped varchar columns were ever parsed with this; `backfill:date-columns` and its
-- integration coverage retire with it.
DROP FUNCTION IF EXISTS mms_try_date(text);
--> statement-breakpoint

-- ── 4. Catalog text snapshots → ids are now the only source ───────────────────────────────────
DROP INDEX IF EXISTS "sessions_workspace_type_idx";
--> statement-breakpoint
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "type";
--> statement-breakpoint
ALTER TABLE "session_class_timetable_periods" DROP COLUMN IF EXISTS "subject";
--> statement-breakpoint
ALTER TABLE "exams" DROP COLUMN IF EXISTS "subject";
--> statement-breakpoint

-- ── 5. Varchar dates → the `date` columns are now the only source ─────────────────────────────
-- Each DROP COLUMN also drops the indexes built on it; the date_on replacements were verified
-- valid by the guard above.
DROP INDEX IF EXISTS "attendance_workspace_date_idx";
--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "date";
--> statement-breakpoint
ALTER TABLE "enrollments" DROP COLUMN IF EXISTS "enrolled_date";
--> statement-breakpoint
DROP INDEX IF EXISTS "students_workspace_registered_date_active_idx";
--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN IF EXISTS "registered_date";
--> statement-breakpoint
ALTER TABLE "students" DROP COLUMN IF EXISTS "enrollment_date";
--> statement-breakpoint

-- ── 6. Session `types` lookup: programs own this now (release A migrated the labels) ──────────
DELETE FROM "session_lookups" WHERE "kind" = 'types';
--> statement-breakpoint

-- ── 7. The mirrored membership table: `student_session_memberships` is the only reader now ────
-- The view reads enrollments + student_enrolled_sessions_legacy, so it does not depend on this
-- table and keeps working. Section 1 moved anything not derivable into the legacy table.
DROP TABLE IF EXISTS "student_enrolled_sessions";
