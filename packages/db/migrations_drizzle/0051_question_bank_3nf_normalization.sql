-- 1. Add typed columns to questions
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "type" varchar(30) NOT NULL DEFAULT 'mcq';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "difficulty" varchar(20) NOT NULL DEFAULT 'medium';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "question_language" varchar(10) NOT NULL DEFAULT 'en';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "text" text NOT NULL DEFAULT '';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "answer" text NOT NULL DEFAULT '';
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "marks" integer NOT NULL DEFAULT 1;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to tests
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "category_id" varchar(64);
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "difficulty" varchar(20) NOT NULL DEFAULT 'mixed';
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "duration" integer NOT NULL DEFAULT 60;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "exam_class" varchar(120);
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "total_marks" integer;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "instructions" text;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Add typed columns to assessment_results
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "test_id" text NOT NULL DEFAULT '';
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "student_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "student_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "submitted_at" varchar(30) NOT NULL DEFAULT '';
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "assessment_results" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 4. Create child tables
CREATE TABLE IF NOT EXISTS "question_categories" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "question_id" text NOT NULL,
  "category_id" varchar(64) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "question_id", "category_id")
);

CREATE TABLE IF NOT EXISTS "question_options" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "question_id" text NOT NULL,
  "option_index" integer NOT NULL,
  "option_text" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "question_id", "id")
);

CREATE TABLE IF NOT EXISTS "question_tags" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "question_id" text NOT NULL,
  "tag" varchar(64) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "question_id", "tag")
);

CREATE TABLE IF NOT EXISTS "question_citations" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "question_id" text NOT NULL,
  "book_id" text NOT NULL,
  "citation" text NOT NULL DEFAULT '{}',
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "question_id", "id")
);

CREATE TABLE IF NOT EXISTS "test_questions" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "test_id" text NOT NULL,
  "question_id" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "test_id", "question_id")
);

CREATE TABLE IF NOT EXISTS "test_sections" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "test_id" text NOT NULL,
  "title" varchar(255) NOT NULL,
  "instructions" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "test_id", "id")
);

CREATE TABLE IF NOT EXISTS "test_section_questions" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "section_id" text NOT NULL,
  "question_id" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "section_id", "question_id")
);

CREATE TABLE IF NOT EXISTS "assessment_answers" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "result_id" text NOT NULL,
  "question_id" text NOT NULL,
  "student_answer" text NOT NULL DEFAULT '',
  "score" numeric(8, 2) NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "result_id", "question_id")
);

-- 5. Backfill from custom_data
DO $$
BEGIN
  -- Backfill questions and child tables
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'custom_data'
  ) THEN
    -- Backfill categories
    INSERT INTO "question_categories" ("workspace_subdomain", "question_id", "category_id")
    SELECT
      q."workspace_subdomain",
      q."id",
      cat.value::text
    FROM "questions" q,
         jsonb_array_elements_text(COALESCE(q."custom_data"->'categoryIds', '[]'::jsonb)) AS cat
    ON CONFLICT ("workspace_subdomain", "question_id", "category_id") DO NOTHING;

    -- Backfill options
    INSERT INTO "question_options" ("id", "workspace_subdomain", "question_id", "option_index", "option_text")
    SELECT
      q."id" || '_opt_' || (opt.idx - 1)::text,
      q."workspace_subdomain",
      q."id",
      (opt.idx - 1)::integer,
      opt.val::text
    FROM "questions" q,
         jsonb_array_elements_text(COALESCE(q."custom_data"->'options', '[]'::jsonb)) WITH ORDINALITY AS opt(val, idx)
    ON CONFLICT ("workspace_subdomain", "question_id", "id") DO NOTHING;

    -- Backfill tags
    INSERT INTO "question_tags" ("workspace_subdomain", "question_id", "tag")
    SELECT
      q."workspace_subdomain",
      q."id",
      tag.value::text
    FROM "questions" q,
         jsonb_array_elements_text(COALESCE(q."custom_data"->'tags', '[]'::jsonb)) AS tag
    ON CONFLICT ("workspace_subdomain", "question_id", "tag") DO NOTHING;

    -- Backfill citations
    INSERT INTO "question_citations" ("id", "workspace_subdomain", "question_id", "book_id", "citation")
    SELECT
      q."id" || '_cit_' || (cit.idx - 1)::text,
      q."workspace_subdomain",
      q."id",
      COALESCE(cit.val->>'bookId', ''),
      COALESCE((cit.val->'citation')::text, '{}')
    FROM "questions" q,
         jsonb_array_elements(COALESCE(q."custom_data"->'sourceCitations', '[]'::jsonb)) WITH ORDINALITY AS cit(val, idx)
    ON CONFLICT ("workspace_subdomain", "question_id", "id") DO NOTHING;

    -- Update parent question columns
    UPDATE "questions" SET
      "type" = COALESCE("custom_data"->>'type', 'mcq'),
      "difficulty" = COALESCE("custom_data"->>'difficulty', 'medium'),
      "question_language" = COALESCE("custom_data"->>'questionLanguage', 'en'),
      "text" = COALESCE("custom_data"->>'text', ''),
      "answer" = COALESCE("custom_data"->>'answer', ''),
      "marks" = COALESCE(("custom_data"->>'marks')::integer, 1),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "questions_custom_data_gin_idx";
    ALTER TABLE "questions" DROP COLUMN "custom_data";
  END IF;

  -- Backfill tests and child tables
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tests' AND column_name = 'custom_data'
  ) THEN
    -- Backfill test questions
    INSERT INTO "test_questions" ("workspace_subdomain", "test_id", "question_id", "sort_order")
    SELECT
      t."workspace_subdomain",
      t."id",
      tq.val::text,
      (tq.idx - 1)::integer
    FROM "tests" t,
         jsonb_array_elements_text(COALESCE(t."custom_data"->'questionIds', '[]'::jsonb)) WITH ORDINALITY AS tq(val, idx)
    ON CONFLICT ("workspace_subdomain", "test_id", "question_id") DO NOTHING;

    -- Update parent test columns
    UPDATE "tests" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "category_id" = "custom_data"->>'categoryId',
      "difficulty" = COALESCE("custom_data"->>'difficulty', 'mixed'),
      "duration" = COALESCE(("custom_data"->>'duration')::integer, 60),
      "exam_class" = "custom_data"->>'examClass',
      "total_marks" = ("custom_data"->>'totalMarks')::integer,
      "instructions" = "custom_data"->>'instructions',
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "tests_custom_data_gin_idx";
    ALTER TABLE "tests" DROP COLUMN "custom_data";
  END IF;

  -- Backfill assessment_results and child tables
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assessment_results' AND column_name = 'custom_data'
  ) THEN
    -- Backfill answers and scores
    INSERT INTO "assessment_answers" ("workspace_subdomain", "result_id", "question_id", "student_answer", "score")
    SELECT
      r."workspace_subdomain",
      r."id",
      kv.key,
      kv.value::text,
      COALESCE((r."custom_data"->'scores'->>kv.key)::numeric, 0)
    FROM "assessment_results" r,
         jsonb_each_text(COALESCE(r."custom_data"->'answers', '{}'::jsonb)) AS kv
    ON CONFLICT ("workspace_subdomain", "result_id", "question_id") DO NOTHING;

    -- Update parent result columns
    UPDATE "assessment_results" SET
      "test_id" = COALESCE("custom_data"->>'testId', ''),
      "student_id" = COALESCE("custom_data"->>'studentId', ''),
      "student_name" = COALESCE("custom_data"->>'studentName', ''),
      "submitted_at" = COALESCE("custom_data"->>'submittedAt', ''),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "assessment_results_custom_data_gin_idx";
    ALTER TABLE "assessment_results" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS "questions_workspace_type_idx" ON "questions" ("workspace_subdomain", "type");
CREATE INDEX IF NOT EXISTS "questions_workspace_difficulty_idx" ON "questions" ("workspace_subdomain", "difficulty");
CREATE INDEX IF NOT EXISTS "questions_workspace_deleted_idx" ON "questions" ("workspace_subdomain", "deleted_at");
CREATE INDEX IF NOT EXISTS "questions_workspace_active_idx" ON "questions" ("workspace_subdomain") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "question_categories_workspace_q_idx" ON "question_categories" ("workspace_subdomain", "question_id");
CREATE INDEX IF NOT EXISTS "question_categories_workspace_cat_idx" ON "question_categories" ("workspace_subdomain", "category_id");

CREATE INDEX IF NOT EXISTS "question_options_workspace_q_idx" ON "question_options" ("workspace_subdomain", "question_id");
CREATE INDEX IF NOT EXISTS "question_tags_workspace_q_idx" ON "question_tags" ("workspace_subdomain", "question_id");
CREATE INDEX IF NOT EXISTS "question_citations_workspace_q_idx" ON "question_citations" ("workspace_subdomain", "question_id");

CREATE INDEX IF NOT EXISTS "tests_workspace_category_idx" ON "tests" ("workspace_subdomain", "category_id");
CREATE INDEX IF NOT EXISTS "tests_workspace_deleted_idx" ON "tests" ("workspace_subdomain", "deleted_at");
CREATE INDEX IF NOT EXISTS "tests_workspace_active_idx" ON "tests" ("workspace_subdomain") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "test_questions_workspace_test_idx" ON "test_questions" ("workspace_subdomain", "test_id");
CREATE INDEX IF NOT EXISTS "test_sections_workspace_test_idx" ON "test_sections" ("workspace_subdomain", "test_id");
CREATE INDEX IF NOT EXISTS "test_section_questions_workspace_sec_idx" ON "test_section_questions" ("workspace_subdomain", "section_id");

CREATE INDEX IF NOT EXISTS "assessment_results_workspace_test_idx" ON "assessment_results" ("workspace_subdomain", "test_id");
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_student_idx" ON "assessment_results" ("workspace_subdomain", "student_id");
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_deleted_idx" ON "assessment_results" ("workspace_subdomain", "deleted_at");
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_active_idx" ON "assessment_results" ("workspace_subdomain") WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "assessment_answers_workspace_res_idx" ON "assessment_answers" ("workspace_subdomain", "result_id");

-- 7. Force RLS
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS questions_tenant_isolation ON "questions";
CREATE POLICY questions_tenant_isolation ON "questions" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "question_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_categories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_categories_tenant_isolation ON "question_categories";
CREATE POLICY question_categories_tenant_isolation ON "question_categories" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_options" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_options_tenant_isolation ON "question_options";
CREATE POLICY question_options_tenant_isolation ON "question_options" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "question_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_tags_tenant_isolation ON "question_tags";
CREATE POLICY question_tags_tenant_isolation ON "question_tags" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "question_citations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_citations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS question_citations_tenant_isolation ON "question_citations";
CREATE POLICY question_citations_tenant_isolation ON "question_citations" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tests_tenant_isolation ON "tests";
CREATE POLICY tests_tenant_isolation ON "tests" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "test_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_questions_tenant_isolation ON "test_questions";
CREATE POLICY test_questions_tenant_isolation ON "test_questions" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "test_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_sections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_sections_tenant_isolation ON "test_sections";
CREATE POLICY test_sections_tenant_isolation ON "test_sections" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "test_section_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_section_questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS test_section_questions_tenant_isolation ON "test_section_questions";
CREATE POLICY test_section_questions_tenant_isolation ON "test_section_questions" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "assessment_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_results" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assessment_results_tenant_isolation ON "assessment_results";
CREATE POLICY assessment_results_tenant_isolation ON "assessment_results" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "assessment_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_answers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assessment_answers_tenant_isolation ON "assessment_answers";
CREATE POLICY assessment_answers_tenant_isolation ON "assessment_answers" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
