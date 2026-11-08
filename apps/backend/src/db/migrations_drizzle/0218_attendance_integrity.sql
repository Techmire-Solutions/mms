-- MMS Forward-only Migration: 0218_attendance_integrity.sql
-- Attendance persistence hardening (docs/attendance-schema-persistence-audit-2026-11-08.md):
--   1. Soft-delete sextuple: `0108` added `restored_at` / `restored_by` / `deleted_with_cascade`,
--      but the Drizzle table never declared them, so they are missing from every snapshot and the
--      ORM could not read or write restore provenance.
--   2. `version`: optimistic-concurrency token (mirrors `sessions.version` / `session_classes.version`
--      from 0206), so two instructors editing one roster get a 409 instead of a silent overwrite.
--   3. `attendance_status_check`: the status domain had no DB constraint, which is why the reports
--      defensively `lower(trim(status))` the column.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by a
-- pre-existing snapshot-chain collision (docs/open-items.md). Every statement is idempotent so this
-- is a no-op on a database that already has the columns from 0108, and the accompanying
-- `meta/0218_attendance_integrity_snapshot.json` is a patched copy of 0217.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. soft-delete sextuple (already on disk via 0108) ───────────────────
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "restored_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "restored_by" text;
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_with_cascade" boolean DEFAULT false;
--> statement-breakpoint

-- ───────────────────────── 2. optimistic-concurrency token ──────────────────────────────────────
-- Fast default on PostgreSQL 11+: metadata-only, no rewrite of the table.
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- ───────────────────────── 3. status domain ────────────────────────────────────────────────────
-- Normalize casing first: the constraint is enforced for every future INSERT/UPDATE, and an UPDATE
-- of a legacy 'Present' row would otherwise fail even when the new value is valid.
UPDATE "attendance"
   SET "status" = lower(btrim("status"))
 WHERE "status" <> lower(btrim("status"));
--> statement-breakpoint

-- Skip (with a warning) rather than block the deploy when a tenant carries a status value outside
-- the shared set — the 0207 precedent. Re-run this constraint by hand once the audit below is clean:
--   SELECT "status", count(*) FROM "attendance"
--    WHERE "status" NOT IN ('present','absent','late','excused') GROUP BY 1;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "attendance"
     WHERE "status" NOT IN ('present', 'absent', 'late', 'excused')
  ) THEN
    RAISE WARNING
      'attendance_status_check skipped: unrecognised status values exist; audit them and add the constraint manually';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'attendance'::regclass AND conname = 'attendance_status_check'
  ) THEN
    ALTER TABLE "attendance" ADD CONSTRAINT "attendance_status_check"
      CHECK ("status" IN ('present', 'absent', 'late', 'excused'));
  END IF;
END $$;
--> statement-breakpoint

-- Trashed rows that were written with an explicit NULL cascade flag (the ORM could not see the
-- column, so any caller could send `deletedWithCascade: null` straight through) become explicit:
-- `false` means "archived on its own". On PostgreSQL 11+ `ADD COLUMN … DEFAULT false` already makes
-- historical rows read as `false`, so this normally updates nothing.
UPDATE "attendance"
   SET "deleted_with_cascade" = false
 WHERE "deleted_at" IS NOT NULL
   AND "deleted_with_cascade" IS NULL;
