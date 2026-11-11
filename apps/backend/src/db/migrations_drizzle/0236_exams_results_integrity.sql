-- MMS Forward-only Migration: 0236_exams_results_integrity.sql
-- Examinations marks integrity (docs/examinations-schema-persistence-audit-2026-11-11.md):
--   1. `exam_results.marks_obtained` integer → numeric(8,2). The entry grid asks for decimals
--      (`inputMode="decimal"`) and the DTO accepts any number, so "85.5" used to reach an integer
--      column and fail with 22P02 (a 500). Matches `assessment_answers.score numeric(8,2)`.
--   2. `exam_results.version` — the optimistic-concurrency token the upsert compares. Two examiners
--      grading the same roster previously overwrote each other silently (last write wins).
--   3. `exams` range/domain checks: positive total, passing ≤ total, positive duration, status enum.
--      Previously the only check was `min_attendance_pct`.
--   4. Triggers that make the marks invariants true for EVERY write path (bulk route, legacy
--      migration, dbSync restore) rather than only for the request that ran the app guard:
--      a mark may not exceed its exam's total, and an exam's total may not fall below a recorded mark.
--   5. The 0222 unique index is asserted to exist. It was created inside a DO block that only
--      RAISEd a WARNING when duplicates were present, so a database that had duplicate groups was
--      left without the constraint and nothing since has checked. This migration fails loudly
--      instead, so the integrity guarantee cannot be silently absent.
--   6. `exam_results_workspace_exam_idx` dropped: exact prefix duplicate of the unique index.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by
-- the 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0235 with this DDL
-- applied, and the journal entry is appended in the same change.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. marks precision ─────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "exam_results" WHERE "marks_obtained" > 999999.99) THEN
    RAISE EXCEPTION
      'exam_results.marks_obtained holds a value above numeric(8,2) range; normalize the data before applying 0236';
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "exam_results"
  ALTER COLUMN "marks_obtained" TYPE numeric(8,2) USING "marks_obtained"::numeric(8,2);
--> statement-breakpoint

-- ───────────────────────── 2. optimistic-concurrency token ─────────────────────────────────────
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- ───────────────────────── 3. exam range / domain checks ──────────────────────────────────────
-- Added NOT VALID so historical rows cannot block the deploy; validated below only when the
-- existing data already satisfies them (the 0222 guard style).
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_total_marks_positive_check";
ALTER TABLE "exams" ADD CONSTRAINT "exams_total_marks_positive_check"
  CHECK ("total_marks" > 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_passing_marks_range_check";
ALTER TABLE "exams" ADD CONSTRAINT "exams_passing_marks_range_check"
  CHECK ("passing_marks" >= 0 AND "passing_marks" <= "total_marks") NOT VALID;
--> statement-breakpoint
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_duration_positive_check";
ALTER TABLE "exams" ADD CONSTRAINT "exams_duration_positive_check"
  CHECK ("duration" > 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "exams" DROP CONSTRAINT IF EXISTS "exams_status_check";
ALTER TABLE "exams" ADD CONSTRAINT "exams_status_check"
  CHECK ("status" IN ('upcoming', 'scheduled', 'ongoing', 'completed', 'cancelled')) NOT VALID;
--> statement-breakpoint

DO $$
DECLARE
  violating bigint;
BEGIN
  SELECT count(*) INTO violating
    FROM "exams"
   WHERE "total_marks" <= 0
      OR "passing_marks" < 0
      OR "passing_marks" > "total_marks"
      OR "duration" <= 0
      OR "status" NOT IN ('upcoming', 'scheduled', 'ongoing', 'completed', 'cancelled');

  IF violating = 0 THEN
    ALTER TABLE "exams" VALIDATE CONSTRAINT "exams_total_marks_positive_check";
    ALTER TABLE "exams" VALIDATE CONSTRAINT "exams_passing_marks_range_check";
    ALTER TABLE "exams" VALIDATE CONSTRAINT "exams_duration_positive_check";
    ALTER TABLE "exams" VALIDATE CONSTRAINT "exams_status_check";
  ELSE
    RAISE WARNING
      'exams integrity checks left NOT VALID: % legacy row(s) violate them; repair the data and re-run VALIDATE',
      violating;
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 4a. a mark may not exceed its exam's total ─────────────────────────
CREATE OR REPLACE FUNCTION exam_results_enforce_exam_bounds()
RETURNS TRIGGER AS $$
DECLARE
  max_marks integer;
BEGIN
  -- Restore/import paths (dbSync, backup restore) legitimately replay historical rows under this
  -- flag; they must not be wedged by a total that has since been corrected.
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT "total_marks" INTO max_marks
    FROM "exams"
   WHERE "workspace_subdomain" = NEW."workspace_subdomain"
     AND "id" = NEW."exam_id";

  -- Fail open only when the exam row is not visible (no tenant context); RLS keeps that scoped.
  IF max_marks IS NOT NULL AND NEW."marks_obtained" > max_marks THEN
    RAISE EXCEPTION
      'exam_results.marks_obtained (%) exceeds exams.total_marks (%) for exam %',
      NEW."marks_obtained", max_marks, NEW."exam_id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_exam_results_bounds" ON "exam_results";
--> statement-breakpoint
CREATE TRIGGER "trg_exam_results_bounds"
  BEFORE INSERT OR UPDATE OF "marks_obtained", "exam_id" ON "exam_results"
  FOR EACH ROW EXECUTE FUNCTION exam_results_enforce_exam_bounds();
--> statement-breakpoint

-- ───────────────────────── 4b. an exam total may not fall below a recorded mark ───────────────
CREATE OR REPLACE FUNCTION exams_guard_total_marks()
RETURNS TRIGGER AS $$
DECLARE
  highest numeric(8,2);
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF NEW."total_marks" >= OLD."total_marks" THEN
    RETURN NEW;
  END IF;

  SELECT max("marks_obtained") INTO highest
    FROM "exam_results"
   WHERE "workspace_subdomain" = NEW."workspace_subdomain"
     AND "exam_id" = NEW."id";

  IF highest IS NOT NULL AND highest > NEW."total_marks" THEN
    RAISE EXCEPTION
      'exams.total_marks (%) cannot fall below the highest recorded mark (%) for exam %; correct the marks first',
      NEW."total_marks", highest, NEW."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_exams_total_marks_guard" ON "exams";
--> statement-breakpoint
CREATE TRIGGER "trg_exams_total_marks_guard"
  BEFORE UPDATE OF "total_marks" ON "exams"
  FOR EACH ROW EXECUTE FUNCTION exams_guard_total_marks();
--> statement-breakpoint

-- ───────────────────────── 5. one row per (exam, student) is guaranteed ───────────────────────
-- 0222 only warned when duplicates existed, which left those databases unprotected. Fail loudly,
-- because every OCC write below arbitrates on this index.
DO $$
DECLARE
  duplicates bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'exam_results_workspace_exam_student_uidx'
  ) THEN
    SELECT count(*) INTO duplicates FROM (
      SELECT 1 FROM "exam_results"
       GROUP BY "workspace_subdomain", "exam_id", "student_id"
      HAVING count(*) > 1
    ) d;
    IF duplicates > 0 THEN
      RAISE EXCEPTION
        'exam_results workspace/exam/student unique index cannot be built: % duplicate group(s) exist; merge them and re-run 0236',
        duplicates;
    END IF;
    CREATE UNIQUE INDEX "exam_results_workspace_exam_student_uidx"
      ON "exam_results" ("workspace_subdomain", "exam_id", "student_id");
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 6. redundant index ────────────────────────────────────────────────
-- Exact prefix of `exam_results_workspace_exam_student_uidx` (ensure step above ran first).
DROP INDEX IF EXISTS "exam_results_workspace_exam_idx";
--> statement-breakpoint
