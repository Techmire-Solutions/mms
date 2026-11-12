-- MMS Forward-only Migration: 0241_question_bank_lifecycle_and_marks.sql
-- Question Bank domain/lifecycle audit (docs/question-bank-domain-lifecycle-audit-2026-11-11.md):
--
--   1. Questions had no authoring lifecycle at all: the bulk PUT was a free-form upsert, so
--      "draft / under review / approved / retired" could not be expressed and every question was
--      equally eligible for a paper. The column, its CHECK and the status filter index are added
--      here; the transition table lives in `@mms/shared` (`questionLifecycle.ts`).
--   2. `marks` allowed 0 while the brief requires a positive award; the non-negative check is
--      replaced by a positive one after repairing the zeros.
--   3. Historical exam integrity: 0240 blocked edits of questions referenced by a paper that already
--      has results. A paper that is published *before* grading had no signal, so it gained
--      `published_at`/`published_by` and a frozen `question_snapshot` per link, and the guard now
--      treats a published paper as evidence too.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0240 with this DDL applied and
-- the journal entry appended in the same change.
--
-- Every backfill is idempotent: re-running this file after it was applied must not re-flip statuses.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. authoring lifecycle ─────────────────────────────────────────────
-- Added nullable, backfilled, then defaulted so a re-run is a no-op: existing questions are already
-- in use and become `approved`; every new row starts as `draft`.
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "status" varchar(20);
--> statement-breakpoint

UPDATE "questions" SET "status" = 'approved' WHERE "status" IS NULL;
--> statement-breakpoint

ALTER TABLE "questions" ALTER COLUMN "status" SET DEFAULT 'draft';
--> statement-breakpoint

DO $$ BEGIN
  UPDATE "questions" SET "status" = 'draft' WHERE "status" IS NULL;
  ALTER TABLE "questions" ALTER COLUMN "status" SET NOT NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_status_check"
    CHECK ("status" IN ('draft', 'under_review', 'approved', 'retired'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "questions_ws_active_status_updated_idx"
  ON "questions" USING btree ("workspace_subdomain", "status", "updated_at" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- ───────────────────────── 2. marks must be a positive award ──────────────────────────────────
UPDATE "questions" SET "marks" = 1 WHERE "marks" <= 0;
--> statement-breakpoint

ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_marks_non_negative_check";
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_marks_positive_check" CHECK ("marks" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── 3. paper publication + frozen question snapshot ────────────────────
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "published_by" text;
--> statement-breakpoint

ALTER TABLE "test_questions" ADD COLUMN IF NOT EXISTS "question_snapshot" jsonb;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "tests" ADD CONSTRAINT "tests_published_pair_check"
    CHECK (("published_at" IS NULL) = ("published_by" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── 4. the guard now treats a published paper as evidence ──────────────
-- Same shape as 0240, plus `tests.published_at IS NOT NULL`: a paper frozen for delivery protects
-- its questions even before any result exists. `app.allow_hard_purge` still exempts module purge.
CREATE OR REPLACE FUNCTION question_bank_guard_referenced_question()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.allow_hard_purge', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF NEW."text" IS DISTINCT FROM OLD."text"
     OR NEW."answer" IS DISTINCT FROM OLD."answer"
     OR NEW."marks" IS DISTINCT FROM OLD."marks"
     OR NEW."type" IS DISTINCT FROM OLD."type"
     OR NEW."difficulty" IS DISTINCT FROM OLD."difficulty"
     OR (OLD."deleted_at" IS NULL AND NEW."deleted_at" IS NOT NULL) THEN
    IF EXISTS (
         SELECT 1
           FROM "test_questions" tq
           JOIN "assessment_results" ar
             ON ar."workspace_subdomain" = tq."workspace_subdomain"
            AND ar."test_id" = tq."test_id"
          WHERE tq."workspace_subdomain" = OLD."workspace_subdomain"
            AND tq."question_id" = OLD."id"
       )
       OR EXISTS (
         SELECT 1
           FROM "test_section_questions" tsq
           JOIN "test_sections" ts
             ON ts."workspace_subdomain" = tsq."workspace_subdomain"
            AND ts."id" = tsq."section_id"
           JOIN "assessment_results" ar
             ON ar."workspace_subdomain" = ts."workspace_subdomain"
            AND ar."test_id" = ts."test_id"
          WHERE tsq."workspace_subdomain" = OLD."workspace_subdomain"
            AND tsq."question_id" = OLD."id"
       )
       OR EXISTS (
         SELECT 1
           FROM "test_questions" tq
           JOIN "tests" t
             ON t."workspace_subdomain" = tq."workspace_subdomain"
            AND t."id" = tq."test_id"
          WHERE tq."workspace_subdomain" = OLD."workspace_subdomain"
            AND tq."question_id" = OLD."id"
            AND t."published_at" IS NOT NULL
       )
       OR EXISTS (
         SELECT 1
           FROM "test_section_questions" tsq
           JOIN "test_sections" ts
             ON ts."workspace_subdomain" = tsq."workspace_subdomain"
            AND ts."id" = tsq."section_id"
           JOIN "tests" t
             ON t."workspace_subdomain" = ts."workspace_subdomain"
            AND t."id" = ts."test_id"
          WHERE tsq."workspace_subdomain" = OLD."workspace_subdomain"
            AND tsq."question_id" = OLD."id"
            AND t."published_at" IS NOT NULL
       ) THEN
      RAISE EXCEPTION
        'question % is referenced by a delivered paper; create a new revision instead of editing or trashing it',
        OLD."id"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
