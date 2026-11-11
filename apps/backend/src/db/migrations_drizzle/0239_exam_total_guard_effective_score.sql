-- MMS Forward-only Migration: 0239_exam_total_guard_effective_score.sql
-- Recalculation integrity (docs/examinations-specialized-subsystems-audit-2026-11-11-round2.md):
--
--   `exams_guard_total_marks` (0236) compared `max(marks_obtained)` only. A moderated mark stores
--   its adjustment in `grace_marks`, and `trg_exam_results_bounds` (0237) checks the effective score
--   only when the mark/grace/exam_id changes — not when the exam's total changes. So lowering an
--   exam's total below `marks_obtained + grace_marks` was accepted, leaving an effective score above
--   the total; every percentage read then clamped to 100 and the grade/rank were inflated. The guard
--   now compares the effective score and its message names grace, so the recalculation invariant
--   holds for every write path (bulk save, legacy, direct SQL), with the restore-path bypass intact.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by
-- the 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0238 with this DDL
-- applied and the journal entry appended in the same change.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

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

  -- Effective score: the moderated adjustment counts, because that is what every consumer scores.
  SELECT max("marks_obtained" + COALESCE("grace_marks", 0)) INTO highest
    FROM "exam_results"
   WHERE "workspace_subdomain" = NEW."workspace_subdomain"
     AND "exam_id" = NEW."id";

  IF highest IS NOT NULL AND highest > NEW."total_marks" THEN
    RAISE EXCEPTION
      'exams.total_marks (%) cannot fall below the highest effective score (%) for exam % (grace included); correct the marks or moderation first',
      NEW."total_marks", highest, NEW."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
