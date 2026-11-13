-- MMS Forward-only Migration: 0237_exam_scoring_moderation.sql
-- Specialized-subsystem audit (docs/examinations-specialized-subsystems-audit-2026-11-11.md):
--   1. `exams.min_attendance_pct` was `smallint` while the API accepts decimals and attendance is
--      computed to one decimal. A configured 74.5 was silently stored as 75 — the audit row, the
--      screen and the gate disagreed. Widened to numeric(5,2).
--   2. Grace marks: an audited moderation adjustment that never rewrites the raw `marks_obtained`.
--      `grace_marks` + `moderation_reason`/`moderated_by`/`moderated_at` on `exam_results`.
--   3. The bounds trigger now checks the *effective* score (`marks_obtained + grace_marks`) against
--      the exam total, and fires on grace changes too.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by
-- the 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0236 with this DDL
-- applied and the journal entry appended in the same change.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. attendance threshold precision ────────────────────────────────
ALTER TABLE "exams"
  ALTER COLUMN "min_attendance_pct" TYPE numeric(5,2)
  USING "min_attendance_pct"::numeric(5,2);
--> statement-breakpoint

-- ───────────────────────── 2. moderation columns ────────────────────────────────────────────
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "grace_marks" numeric(6,2) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "moderation_reason" varchar(500);
--> statement-breakpoint
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "moderated_by" text;
--> statement-breakpoint
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "moderated_at" timestamp with time zone;
--> statement-breakpoint

-- ───────────────────────── 3. moderation checks ─────────────────────────────────────────────
ALTER TABLE "exam_results" DROP CONSTRAINT IF EXISTS "exam_results_grace_non_negative_check";
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_grace_non_negative_check"
  CHECK ("grace_marks" >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "exam_results" DROP CONSTRAINT IF EXISTS "exam_results_moderation_reason_check";
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_moderation_reason_check"
  CHECK ("grace_marks" = 0 OR btrim(COALESCE("moderation_reason", '')) <> '') NOT VALID;
--> statement-breakpoint

DO $$
DECLARE
  violating bigint;
BEGIN
  SELECT count(*) INTO violating
    FROM "exam_results"
   WHERE "grace_marks" < 0
      OR ("grace_marks" > 0 AND btrim(COALESCE("moderation_reason", '')) = '');
  IF violating = 0 THEN
    ALTER TABLE "exam_results" VALIDATE CONSTRAINT "exam_results_grace_non_negative_check";
    ALTER TABLE "exam_results" VALIDATE CONSTRAINT "exam_results_moderation_reason_check";
  ELSE
    RAISE WARNING
      'exam_results moderation checks left NOT VALID: % row(s) violate them',
      violating;
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 4. effective-score bounds trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION exam_results_enforce_exam_bounds()
RETURNS TRIGGER AS $$
DECLARE
  max_marks integer;
  effective numeric(8,2);
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN NEW;
  END IF;

  effective := NEW."marks_obtained" + COALESCE(NEW."grace_marks", 0);

  SELECT "total_marks" INTO max_marks
    FROM "exams"
   WHERE "workspace_subdomain" = NEW."workspace_subdomain"
     AND "id" = NEW."exam_id";

  -- Fail open only when the exam row is not visible (no tenant context); RLS keeps that scoped.
  IF max_marks IS NOT NULL AND effective > max_marks THEN
    RAISE EXCEPTION
      'exam_results effective marks (% + % grace) exceed exams.total_marks (%) for exam %',
      NEW."marks_obtained", COALESCE(NEW."grace_marks", 0), max_marks, NEW."exam_id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_exam_results_bounds" ON "exam_results";
--> statement-breakpoint
CREATE TRIGGER "trg_exam_results_bounds"
  BEFORE INSERT OR UPDATE OF "marks_obtained", "grace_marks", "exam_id" ON "exam_results"
  FOR EACH ROW EXECUTE FUNCTION exam_results_enforce_exam_bounds();
--> statement-breakpoint
