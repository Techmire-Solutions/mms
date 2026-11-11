-- MMS Forward-only Migration: 0238_exams_persistence_integrity.sql
-- Examinations persistence round-2 (docs/examinations-schema-persistence-audit-2026-11-11-round2.md):
--   1. `tests` / `questions` / `assessment_answers` / `assessment_results` domain checks. The
--      paper-authoring and auto-grading tables had no range guards at all while their Zod DTOs
--      accept decimals, zero and — for `submitted_at` — malformed text that the reports cast to
--      `date` (22007/500).
--   2. `test_section_questions.section_id` had no FK to `test_sections`, so deleting a section
--      stranded its question links (the only other child link, `question_id`, is protected).
--   3. `assessment_results` had no natural-key uniqueness: two paper results for one student were
--      representable, while the marks analogue is protected by the 0222/0236 unique index.
--   4. Published exams are immutable in the app (`examWriteGuards.ts`) but the database accepted
--      trashing or re-weighting a published exam from any other write path (restore, legacy, SQL).
--   5. Index truth-up: `assessment_results_workspace_submitted_idx` is declared in schema.ts and
--      every Drizzle snapshot but no migration ever created it; `exams_workspace_unfinalized_idx`
--      (0207) and `assessment_results_workspace_test_active_idx` (0090) exist in the database but
--      are missing from the Drizzle schema. Declared and physical shapes must agree.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by
-- the 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0237 with this DDL
-- applied and the journal entry is appended in the same change.
--
-- Every check/FK is added NOT VALID and validated only when the existing data already satisfies
-- it (the 0171/0222/0236 pattern): a deploy must not fail on historical rows, but the guarantee
-- must not be silently absent either. The two new unique indexes fail loudly, because a silently
-- missing uniqueness guarantee is exactly the defect 0236 closed for marks.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. paper / question / answer domain checks ────────────────────────
DO $$ BEGIN
  ALTER TABLE "tests" ADD CONSTRAINT "tests_total_marks_positive_check"
    CHECK ("total_marks" IS NULL OR "total_marks" > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tests" ADD CONSTRAINT "tests_duration_positive_check"
    CHECK ("duration" > 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_marks_non_negative_check"
    CHECK ("marks" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assessment_answers" ADD CONSTRAINT "assessment_answers_score_non_negative_check"
    CHECK ("score" >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_submitted_at_check"
    CHECK ("submitted_at" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  violating bigint;
BEGIN
  SELECT count(*) INTO violating
    FROM "tests"
   WHERE ("total_marks" IS NOT NULL AND "total_marks" <= 0)
      OR "duration" <= 0;
  IF violating = 0 THEN
    ALTER TABLE "tests" VALIDATE CONSTRAINT "tests_total_marks_positive_check";
    ALTER TABLE "tests" VALIDATE CONSTRAINT "tests_duration_positive_check";
  ELSE
    RAISE WARNING
      'tests integrity checks left NOT VALID: % legacy row(s) violate them', violating;
  END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  violating bigint;
BEGIN
  SELECT count(*) INTO violating FROM "questions" WHERE "marks" < 0;
  IF violating = 0 THEN
    ALTER TABLE "questions" VALIDATE CONSTRAINT "questions_marks_non_negative_check";
  ELSE
    RAISE WARNING
      'questions_marks_non_negative_check left NOT VALID: % legacy row(s) have negative marks',
      violating;
  END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  violating bigint;
BEGIN
  SELECT count(*) INTO violating FROM "assessment_answers" WHERE "score" < 0;
  IF violating = 0 THEN
    ALTER TABLE "assessment_answers" VALIDATE CONSTRAINT "assessment_answers_score_non_negative_check";
  ELSE
    RAISE WARNING
      'assessment_answers_score_non_negative_check left NOT VALID: % legacy row(s) have a negative score',
      violating;
  END IF;
END $$;
--> statement-breakpoint

DO $$
DECLARE
  violating bigint;
BEGIN
  SELECT count(*) INTO violating
    FROM "assessment_results"
   WHERE "submitted_at" !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';
  IF violating = 0 THEN
    ALTER TABLE "assessment_results" VALIDATE CONSTRAINT "assessment_results_submitted_at_check";
  ELSE
    RAISE WARNING
      'assessment_results_submitted_at_check left NOT VALID: % legacy row(s) are not ISO-dated',
      violating;
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 2. section → question-link integrity ──────────────────────────────
-- `test_sections` is keyed (workspace, test_id, id), so a child FK needs a unique (workspace, id).
-- Fail loudly on duplicate ids: silently skipping the index is the 0222 defect 0236 removed.
DO $$
DECLARE
  duplicates bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'test_sections_ws_id_uidx'
  ) THEN
    SELECT count(*) INTO duplicates FROM (
      SELECT 1 FROM "test_sections"
       GROUP BY "workspace_subdomain", "id"
      HAVING count(*) > 1
    ) d;
    IF duplicates > 0 THEN
      RAISE EXCEPTION
        'test_sections has % duplicate (workspace_subdomain, id) group(s); merge them and re-run 0238',
        duplicates;
    END IF;
    CREATE UNIQUE INDEX "test_sections_ws_id_uidx"
      ON "test_sections" ("workspace_subdomain", "id");
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "test_section_questions" ADD CONSTRAINT "test_section_questions_section_fk"
    FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "test_sections" ("workspace_subdomain", "id")
    ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "test_section_questions" q
     WHERE NOT EXISTS (
       SELECT 1 FROM "test_sections" s
        WHERE s."workspace_subdomain" = q."workspace_subdomain"
          AND s."id" = q."section_id"
     )
  ) THEN
    ALTER TABLE "test_section_questions" VALIDATE CONSTRAINT "test_section_questions_section_fk";
  ELSE
    RAISE WARNING
      'test_section_questions_section_fk left NOT VALID: legacy question links reference a missing section';
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 3. one active paper result per (test, student) ────────────────────
-- Recyclable uniqueness: a trashed result must not block a fresh one, so the index is partial on
-- `deleted_at IS NULL`. No attempt column exists anywhere in the module, so duplicates are data
-- corruption rather than retakes.
DO $$
DECLARE
  duplicates bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'assessment_results_ws_test_student_uidx'
  ) THEN
    SELECT count(*) INTO duplicates FROM (
      SELECT 1 FROM "assessment_results"
       WHERE "deleted_at" IS NULL
       GROUP BY "workspace_subdomain", "test_id", "student_id"
      HAVING count(*) > 1
    ) d;
    IF duplicates > 0 THEN
      RAISE EXCEPTION
        'assessment_results has % duplicate active (test, student) group(s); merge them and re-run 0238',
        duplicates;
    END IF;
    CREATE UNIQUE INDEX "assessment_results_ws_test_student_uidx"
      ON "assessment_results" ("workspace_subdomain", "test_id", "student_id")
      WHERE "deleted_at" IS NULL;
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 4. `tests.class_id` FK is guaranteed ─────────────────────────────
-- 0171 adds `tests_class_fk`, but the Drizzle schema and every meta snapshot omitted it, so a
-- database rebuilt from the declared shape would silently lose the guard. Re-assert it.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'tests'::regclass AND conname = 'tests_class_fk'
  ) THEN
    ALTER TABLE "tests" ADD CONSTRAINT "tests_class_fk"
      FOREIGN KEY ("workspace_subdomain", "class_id")
      REFERENCES "session_classes" ("workspace_subdomain", "id")
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'tests'::regclass AND conname = 'tests_class_fk' AND NOT convalidated
  ) AND NOT EXISTS (
    SELECT 1 FROM "tests" t
     WHERE t."class_id" IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "session_classes" c
          WHERE c."workspace_subdomain" = t."workspace_subdomain"
            AND c."id" = t."class_id"
       )
  ) THEN
    ALTER TABLE "tests" VALIDATE CONSTRAINT "tests_class_fk";
  END IF;
END $$;
--> statement-breakpoint

-- ───────────────────────── 5. published exams are immutable at the database ─────────────────
-- Mirrors `assertPublishedExamImmutable` (examWriteGuards.ts): a published exam may not be
-- trashed, re-dated, re-weighted, re-subjected, re-durationed, renamed or have its status moved.
-- Two transitions stay legal: unpublishing (the stamp is cleared in the same UPDATE) and
-- restore-from-trash (`deleted_at` returns to NULL). Snapshot restore runs under
-- `app.allow_hard_purge` and bypasses the guard, as it must to reproduce history verbatim.
CREATE OR REPLACE FUNCTION exams_guard_published_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD."results_finalized_at" IS NULL
     OR NEW."results_finalized_at" IS DISTINCT FROM OLD."results_finalized_at"
     OR (OLD."deleted_at" IS NOT NULL AND NEW."deleted_at" IS NULL) THEN
    RETURN NEW;
  END IF;

  IF (OLD."deleted_at" IS NULL AND NEW."deleted_at" IS NOT NULL)
     OR NEW."name" IS DISTINCT FROM OLD."name"
     OR NEW."subject_id" IS DISTINCT FROM OLD."subject_id"
     OR NEW."total_marks" IS DISTINCT FROM OLD."total_marks"
     OR NEW."passing_marks" IS DISTINCT FROM OLD."passing_marks"
     OR NEW."date" IS DISTINCT FROM OLD."date"
     OR NEW."duration" IS DISTINCT FROM OLD."duration"
     OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION
      'exam % has published results — unpublish them before changing its schedule, subject, classes or marks',
      OLD."id"
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_exams_published_guard" ON "exams";
--> statement-breakpoint
CREATE TRIGGER "trg_exams_published_guard"
  BEFORE UPDATE ON "exams"
  FOR EACH ROW EXECUTE FUNCTION exams_guard_published_immutable();
--> statement-breakpoint

-- ───────────────────────── 6. declared ⇄ physical index truth-up ─────────────────────────────
-- Declared in schema.ts + every snapshot, but no migration created it (the report/DTO read path
-- orders by it). The other two are live but were missing from the declared shape.
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_submitted_idx"
  ON "assessment_results" ("workspace_subdomain", "submitted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_workspace_unfinalized_idx"
  ON "exams" ("workspace_subdomain", "status")
  WHERE "results_finalized_at" IS NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_test_active_idx"
  ON "assessment_results" ("workspace_subdomain", "test_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
