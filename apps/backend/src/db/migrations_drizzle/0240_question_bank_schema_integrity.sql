-- MMS Forward-only Migration: 0240_question_bank_schema_integrity.sql
-- Question Bank persistence audit (docs/question-bank-schema-persistence-audit-2026-11-11.md):
--
--   1. `question_options` had no uniqueness on its ordering column. Option ids are derived
--      (`<question>_opt_<index>`), so the current writer cannot duplicate a slot — but the column was
--      only a convention, and any import/future writer could emit two "first" options. The unique
--      index also replaces `question_options_workspace_q_idx`, whose columns are the leading prefix
--      of this key.
--   2. Nothing protected a question that an exam paper already grades. The paper and answer FKs are
--      `ON DELETE CASCADE`; hard delete is blocked by `trg_questions_forbid_hard_delete` (0108), but
--      editing `text`/`answer`/`marks` or trashing the row silently rewrote the content and the answer
--      key of a delivered paper. The trigger below refuses both while the question is referenced by a
--      paper that already has results, and the two reverse-lookup indexes make that check an index
--      probe instead of two sequential scans.
--   3. Question writes were last-write-wins: `questions` had no version token, so a concurrent edit
--      overwrote the other one silently (the `exam_results` OCC pattern is mirrored here).
--   4. Index truth-up for the list/blueprint filter set and the default `updated_at DESC` sort, and
--      removal of four indexes that only duplicate a PK prefix (write amplification, no reader).
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision. The meta snapshot is copied from 0239 with this DDL applied and
-- the journal entry is appended in the same change.
--
-- The `questions` trigram index cannot live here (`CONCURRENTLY` is rejected inside Drizzle's
-- migration transaction). It ships out of band:
--   pnpm --filter mms-backend index:concurrent -- \
--     --file scripts/sql/0240_question_bank_indexes_concurrent.sql

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── 1. option ordering is a constraint, not a convention ───────────────
-- Fail loudly on legacy duplicates rather than silently skipping the guarantee (0238 precedent).
DO $$
DECLARE
  duplicates bigint;
BEGIN
  SELECT count(*) INTO duplicates FROM (
    SELECT 1
      FROM "question_options"
     GROUP BY "workspace_subdomain", "question_id", "option_index"
    HAVING count(*) > 1
  ) d;
  IF duplicates > 0 THEN
    RAISE EXCEPTION
      'question_options has % duplicated (question, option_index) slots; dedupe them before 0240',
      duplicates;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "question_options_ws_q_index_uidx"
  ON "question_options" USING btree ("workspace_subdomain", "question_id", "option_index");
--> statement-breakpoint

-- ───────────────────────── 2. reverse lookups for the referenced-question guard ───────────────
-- `test_questions` is keyed (workspace, test_id, question_id) and `test_section_questions`
-- (workspace, section_id, question_id); neither could answer "which papers use question X" from an
-- index, because `question_id` is not a leading column of either PK.
CREATE INDEX IF NOT EXISTS "test_questions_workspace_question_idx"
  ON "test_questions" USING btree ("workspace_subdomain", "question_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "test_section_questions_workspace_question_idx"
  ON "test_section_questions" USING btree ("workspace_subdomain", "question_id");
--> statement-breakpoint

-- ───────────────────────── 3. list / blueprint filter coverage ────────────────────────────────
-- The list filter set is `workspace + deleted_at IS NULL + difficulty IN (…) (+ type for blueprint
-- selection)`; today only the single-column difficulty index existed. Subject/status are not modelled
-- yet (deferred in the audit), so this is the representable subset of the brief's compound key.
CREATE INDEX IF NOT EXISTS "questions_ws_active_difficulty_type_idx"
  ON "questions" USING btree ("workspace_subdomain", "difficulty", "type")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Default list order is `updated_at DESC`; without this every page top-N-sorts the tenant's questions.
CREATE INDEX IF NOT EXISTS "questions_ws_updated_active_idx"
  ON "questions" USING btree ("workspace_subdomain", "updated_at" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- ───────────────────────── 4. pessimistic-free OCC token ──────────────────────────────────────
-- Backwards compatible: existing rows become version 1, and a save that carries no token keeps the
-- legacy last-write-wins behaviour (import/restore paths) while still bumping the token.
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;
--> statement-breakpoint

-- Every existing row took the DEFAULT 1, so this validates immediately — no NOT VALID dance.
DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_version_positive_check"
    CHECK ("version" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── 5. referenced-question immutability guard ──────────────────────────
-- "Active or completed exam" is expressed as "the paper that references this question already has an
-- assessment_result row" — that is the only completion signal the paper model has (`tests` carries no
-- status/published flag yet; see the audit's deferred DDL). Trashed results still count: a restorable
-- result must not resolve to a mutated question.
CREATE OR REPLACE FUNCTION question_bank_guard_referenced_question()
RETURNS TRIGGER AS $$
BEGIN
  -- Module purge / teardown is the only legitimate destructive path, and it opts in explicitly.
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
       ) THEN
      RAISE EXCEPTION
        'question % is referenced by a graded paper; create a new revision instead of editing or trashing it',
        OLD."id"
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END $$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_questions_referenced_guard" ON "questions";
--> statement-breakpoint

CREATE TRIGGER "trg_questions_referenced_guard"
  BEFORE UPDATE ON "questions"
  FOR EACH ROW EXECUTE FUNCTION question_bank_guard_referenced_question();
--> statement-breakpoint

-- ───────────────────────── 6. drop indexes that only repeat a PK prefix ──────────────────────
-- Each of these is a strict leading prefix of its table's primary key, so the PK already serves the
-- same access path (and the new `question_options_ws_q_index_uidx` supersedes the options one).
DROP INDEX IF EXISTS "question_options_workspace_q_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "question_tags_workspace_q_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "question_citations_workspace_q_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "question_categories_workspace_q_idx";
--> statement-breakpoint
