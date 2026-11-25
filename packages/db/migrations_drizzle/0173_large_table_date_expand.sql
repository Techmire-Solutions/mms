-- MMS Forward-only Migration: 0173_large_table_date_expand.sql
-- Phase 7 — expand step of the varchar → date conversion for large tables
-- (mms-data-layer §7.4 expand / contract; no table rewrite, no long locks):
--   attendance.date              → attendance.date_on
--   enrollments.enrolled_date    → enrollments.enrolled_on
--   students.registered_date     → students.registered_on
--   students.enrollment_date     → students.enrollment_on
-- New nullable `date` columns are kept in sync by BEFORE INSERT/UPDATE triggers (mms_try_date from
-- 0172), so every write path dual-writes without code changes. History is filled by the resumable
--   pnpm --filter mms-backend backfill:date-columns
-- and indexes are built out of band with src/scripts/date_columns_concurrent_indexes.sql.
-- The contract step (switch reads, drop the varchar columns) ships in a later release.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "date_on" date;
--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "enrolled_on" date;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "registered_on" date;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "enrollment_on" date;
--> statement-breakpoint

-- Backfills set `app.preserve_updated_at = 'on'` so derived-column fills do not rewrite
-- updated_at (which drives sync deltas and "last updated" displays). Default behaviour is unchanged.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.preserve_updated_at', true) = 'on' THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION mms_sync_attendance_date_on() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.date_on := mms_try_date(NEW.date);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_sync_enrollments_enrolled_on() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.enrolled_on := mms_try_date(NEW.enrolled_date);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION mms_sync_students_date_on() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.registered_on := mms_try_date(NEW.registered_date);
  NEW.enrollment_on := mms_try_date(NEW.enrollment_date);
  RETURN NEW;
END $$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_attendance_sync_date_on" ON "attendance";
--> statement-breakpoint
CREATE TRIGGER "trg_attendance_sync_date_on" BEFORE INSERT OR UPDATE OF "date", "date_on" ON "attendance"
  FOR EACH ROW EXECUTE FUNCTION mms_sync_attendance_date_on();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_enrollments_sync_enrolled_on" ON "enrollments";
--> statement-breakpoint
CREATE TRIGGER "trg_enrollments_sync_enrolled_on" BEFORE INSERT OR UPDATE OF "enrolled_date", "enrolled_on" ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION mms_sync_enrollments_enrolled_on();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_students_sync_date_on" ON "students";
--> statement-breakpoint
CREATE TRIGGER "trg_students_sync_date_on" BEFORE INSERT OR UPDATE OF "registered_date", "enrollment_date", "registered_on", "enrollment_on" ON "students"
  FOR EACH ROW EXECUTE FUNCTION mms_sync_students_date_on();
