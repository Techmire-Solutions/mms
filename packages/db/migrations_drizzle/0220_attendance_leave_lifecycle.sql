-- MMS Forward-only Migration: 0220_attendance_leave_lifecycle.sql
-- Excuse / medical-leave workflow (docs/attendance-specialized-subsystems-audit-2026-11-09.md):
-- the table existed with pending/approved/rejected statuses but **no code could create a pending
-- request**, there was no reviewer decision record, no document reference, and approving leave never
-- touched the historical marks it was supposed to excuse.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is still blocked
-- by the 0216/0217 snapshot-chain collision (docs/open-items.md). Idempotent throughout.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. lifecycle columns ────────────────────────────────────────────────
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "leave_type" varchar(20) NOT NULL DEFAULT 'other';
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "submitted_by" text;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "reviewed_by" text;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "review_note" varchar(500);
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "cancelled_by" text;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD COLUMN IF NOT EXISTS "document_ref" text;
--> statement-breakpoint

-- ───────────────────────── 2. backfill the decision record ─────────────────────────────────────
-- Legacy rows were only ever written as approved (enrollment suspension). Copy the old pair into the
-- new decision columns so the approval-attribution check below can be validated instead of skipped.
UPDATE "attendance_leaves"
   SET "reviewed_by" = COALESCE("reviewed_by", "approved_by"),
       "reviewed_at" = COALESCE("reviewed_at", "approved_at", "created_at")
 WHERE "status" = 'approved'
   AND "reviewed_at" IS NULL;
--> statement-breakpoint
UPDATE "attendance_leaves"
   SET "submitted_at" = COALESCE("submitted_at", "created_at")
 WHERE "submitted_at" IS NULL;
--> statement-breakpoint

-- ───────────────────────── 3. status domain + attribution ──────────────────────────────────────
-- Normalise casing first: the CHECK is enforced for every future INSERT/UPDATE, and updating a
-- legacy 'Approved' row would otherwise fail even when the new value is valid.
UPDATE "attendance_leaves"
   SET "status" = lower(btrim("status"))
 WHERE "status" <> lower(btrim("status"));
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "attendance_leaves"
     WHERE "status" NOT IN ('pending', 'approved', 'rejected', 'cancelled')
  ) THEN
    RAISE WARNING
      'attendance_leaves_status_check skipped: unrecognised status values exist; audit them and add the constraint manually';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'attendance_leaves'::regclass AND conname = 'attendance_leaves_status_check'
  ) THEN
    ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_status_check"
      CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled'));
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'attendance_leaves'::regclass AND conname = 'attendance_leaves_type_check'
  ) THEN
    ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_type_check"
      CHECK ("leave_type" IN ('medical', 'personal', 'family', 'other'));
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'attendance_leaves'::regclass
       AND conname = 'attendance_leaves_approved_reviewed_check'
  ) THEN
    ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_approved_reviewed_check"
      CHECK ("status" <> 'approved' OR "reviewed_at" IS NOT NULL) NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "attendance_leaves" VALIDATE CONSTRAINT "attendance_leaves_approved_reviewed_check";
--> statement-breakpoint

-- ───────────────────────── 4. review queue ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "attendance_leaves_workspace_status_date_idx"
  ON "attendance_leaves" ("workspace_subdomain", "status", "from_date");
--> statement-breakpoint

-- ───────────────────────── 5. notification kinds ────────────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE "tenant_notifications" DROP CONSTRAINT IF EXISTS "tenant_notifications_kind_check";
  ALTER TABLE "tenant_notifications" ADD CONSTRAINT "tenant_notifications_kind_check"
    CHECK ("kind" IN ('waitlist_seat_offered', 'attendance_leave_decided', 'attendance_chronic_absence'));
END $$;
