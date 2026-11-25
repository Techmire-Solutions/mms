-- 1. Add typed columns to exams
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "name" varchar(150) NOT NULL DEFAULT '';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "subject" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "total_marks" integer NOT NULL DEFAULT 100;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "passing_marks" integer NOT NULL DEFAULT 50;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "duration" integer NOT NULL DEFAULT 60;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'upcoming';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "exams" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Create exam_classes junction table
CREATE TABLE IF NOT EXISTS "exam_classes" (
  "exam_id" text NOT NULL,
  "class_id" varchar(64) NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "exam_classes_pkey" PRIMARY KEY ("workspace_subdomain", "exam_id", "class_id")
);

-- 3. Add typed columns to exam_results
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "exam_id" text NOT NULL DEFAULT '';
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "student_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "marks_obtained" integer NOT NULL DEFAULT 0;
ALTER TABLE "exam_results" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 4. Backfill from custom_data
DO $$
BEGIN
  -- Backfill exams
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'custom_data'
  ) THEN
    UPDATE "exams" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "subject" = COALESCE("custom_data"->>'subject', ''),
      "total_marks" = COALESCE(("custom_data"->>'totalMarks')::integer, 100),
      "passing_marks" = COALESCE(("custom_data"->>'passingMarks')::integer, 50),
      "date" = COALESCE("custom_data"->>'date', ''),
      "duration" = COALESCE(("custom_data"->>'duration')::integer, 60),
      "status" = COALESCE("custom_data"->>'status', 'upcoming'),
      "description" = COALESCE("custom_data"->>'description', ''),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    -- Backfill exam_classes from JSON array
    INSERT INTO "exam_classes" ("workspace_subdomain", "exam_id", "class_id")
    SELECT 
      e.workspace_subdomain,
      e.id,
      elem.value
    FROM "exams" e,
    LATERAL jsonb_array_elements_text(COALESCE(e.custom_data->'classIds', '[]'::jsonb)) elem(value)
    WHERE elem.value IS NOT NULL AND elem.value <> ''
    ON CONFLICT ("workspace_subdomain", "exam_id", "class_id") DO NOTHING;

    DROP INDEX IF EXISTS "exams_custom_data_gin_idx";
    ALTER TABLE "exams" DROP COLUMN "custom_data";
  END IF;

  -- Backfill exam_results
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exam_results' AND column_name = 'custom_data'
  ) THEN
    UPDATE "exam_results" SET
      "exam_id" = COALESCE("custom_data"->>'examId', ''),
      "student_id" = COALESCE("custom_data"->>'studentId', ''),
      "marks_obtained" = COALESCE(("custom_data"->>'marksObtained')::integer, 0)
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "exam_results_custom_data_gin_idx";
    ALTER TABLE "exam_results" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS "exams_workspace_date_idx"
  ON "exams" ("workspace_subdomain", "date");

CREATE INDEX IF NOT EXISTS "exams_workspace_status_idx"
  ON "exams" ("workspace_subdomain", "status");

CREATE INDEX IF NOT EXISTS "exams_workspace_deleted_idx"
  ON "exams" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "exams_workspace_active_idx"
  ON "exams" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "exam_classes_workspace_exam_idx"
  ON "exam_classes" ("workspace_subdomain", "exam_id");

CREATE INDEX IF NOT EXISTS "exam_classes_workspace_class_idx"
  ON "exam_classes" ("workspace_subdomain", "class_id");

CREATE INDEX IF NOT EXISTS "exam_results_workspace_exam_idx"
  ON "exam_results" ("workspace_subdomain", "exam_id");

CREATE INDEX IF NOT EXISTS "exam_results_workspace_student_idx"
  ON "exam_results" ("workspace_subdomain", "student_id");

-- 6. Force RLS
ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exams_tenant_isolation ON "exams";
CREATE POLICY exams_tenant_isolation ON "exams"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "exam_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_classes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_classes_tenant_isolation ON "exam_classes";
CREATE POLICY exam_classes_tenant_isolation ON "exam_classes"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "exam_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_results" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS exam_results_tenant_isolation ON "exam_results";
CREATE POLICY exam_results_tenant_isolation ON "exam_results"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
