-- MMS Forward-only Migration: 0162_students_integrity.sql
-- Phase 1 data-integrity fixes for the students module:
--   1. UNIQUE constraint on student_enrolled_sessions (workspace_subdomain, student_id, session_id)
--      — prevents duplicate enrolment rows from concurrent bulk-enroll races.
--   2. CHECK constraint enforcing allowed student status values at DB level.
--   3. CHECK constraint bounding discount_pct to [0, 100].

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Unique constraint on session enrollments (idempotent).
DO $$ BEGIN
  ALTER TABLE "student_enrolled_sessions"
    ADD CONSTRAINT "student_enrolled_sessions_workspace_student_session_uidx"
    UNIQUE ("workspace_subdomain", "student_id", "session_id");
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table  THEN NULL;
END $$;
--> statement-breakpoint

-- 2. Status check constraint (idempotent).
DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_status_check"
    CHECK (
      lower(trim(COALESCE("status", 'active'))) IN (
        'active', 'inactive', 'suspended', 'graduated', 'transferred'
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 3. Discount percentage range check (idempotent).
DO $$ BEGIN
  ALTER TABLE "students"
    ADD CONSTRAINT "students_discount_pct_range_check"
    CHECK ("discount_pct" IS NULL OR ("discount_pct" >= 0 AND "discount_pct" <= 100));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
