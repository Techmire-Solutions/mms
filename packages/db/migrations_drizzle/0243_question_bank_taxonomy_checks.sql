-- 0243: enforce the shared Question Bank taxonomy at the database.
--
-- `questions.type`, `difficulty` and `question_language` were free text: the API validated them, but
-- nothing stopped a bad write (import, backfill, hand fix). The value lists are the single source in
-- `packages/shared/src/examinations/questionTaxonomy.ts`; a shared test pins this file to them.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
DECLARE
  bad_types integer;
  bad_difficulties integer;
  bad_languages integer;
BEGIN
  SELECT count(*) INTO bad_types
    FROM "questions"
   WHERE "type" NOT IN ('mcq', 'true_false', 'short', 'fill_blank', 'matching', 'numeric', 'ordering');
  SELECT count(*) INTO bad_difficulties
    FROM "questions"
   WHERE "difficulty" NOT IN ('easy', 'medium', 'hard');
  SELECT count(*) INTO bad_languages
    FROM "questions"
   WHERE "question_language" NOT IN ('en', 'ar', 'ur', 'fa');

  IF bad_types > 0 OR bad_difficulties > 0 OR bad_languages > 0 THEN
    RAISE EXCEPTION
      'questions contains values outside the shared taxonomy (type=%, difficulty=%, language=%)',
      bad_types, bad_difficulties, bad_languages;
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_type_check"
    CHECK ("type" IN ('mcq', 'true_false', 'short', 'fill_blank', 'matching', 'numeric', 'ordering'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_difficulty_check"
    CHECK ("difficulty" IN ('easy', 'medium', 'hard'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_question_language_check"
    CHECK ("question_language" IN ('en', 'ar', 'ur', 'fa'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
