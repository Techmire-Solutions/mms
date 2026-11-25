-- 0057_students_3nf_normalization.sql
-- Strictly normalize students domain: decompose custom_data into typed columns,
-- create student_enrolled_sessions child table, and enforce RLS.

-- 1. Add typed relational columns to students
ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "father_contact_id" text,
  ADD COLUMN IF NOT EXISTS "mother_contact_id" text,
  ADD COLUMN IF NOT EXISTS "guardian_contact_id" text,
  ADD COLUMN IF NOT EXISTS "father_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "mother_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "guardian_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "student_id" varchar(100),
  ADD COLUMN IF NOT EXISTS "registered_date" varchar(35),
  ADD COLUMN IF NOT EXISTS "enrollment_date" varchar(35),
  ADD COLUMN IF NOT EXISTS "discount_type" varchar(100),
  ADD COLUMN IF NOT EXISTS "discount_pct" numeric(5, 2),
  ADD COLUMN IF NOT EXISTS "registration_type" varchar(100),
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "created_by" text,
  ADD COLUMN IF NOT EXISTS "updated_by" text;

-- 2. Create student_enrolled_sessions child table
CREATE TABLE IF NOT EXISTS "student_enrolled_sessions" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "student_id" text NOT NULL,
  "session_id" varchar(100) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "student_id", "id"),
  CONSTRAINT "student_enrolled_sessions_student_fk" FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students"("workspace_subdomain", "id") ON DELETE CASCADE
);

-- 3. Backfill typed columns from custom_data (if custom_data column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'custom_data'
  ) THEN
    UPDATE "students"
    SET
      "father_contact_id" = COALESCE("father_contact_id", NULLIF(trim("custom_data"->>'fatherContactId'), '')),
      "mother_contact_id" = COALESCE("mother_contact_id", NULLIF(trim("custom_data"->>'motherContactId'), '')),
      "guardian_contact_id" = COALESCE("guardian_contact_id", NULLIF(trim("custom_data"->>'guardianContactId'), '')),
      "father_name" = COALESCE("father_name", NULLIF(trim("custom_data"->>'fatherName'), '')),
      "mother_name" = COALESCE("mother_name", NULLIF(trim("custom_data"->>'motherName'), '')),
      "guardian_name" = COALESCE("guardian_name", NULLIF(trim("custom_data"->>'guardianName'), '')),
      "student_id" = COALESCE("student_id", NULLIF(trim("custom_data"->>'studentId'), '')),
      "status" = COALESCE(NULLIF(trim("status"), ''), NULLIF(trim("custom_data"->>'status'), ''), 'active'),
      "gr_number" = COALESCE(NULLIF(trim("gr_number"), ''), NULLIF(trim("custom_data"->>'grNumber'), '')),
      "registered_date" = COALESCE("registered_date", NULLIF(trim("custom_data"->>'registeredDate'), '')),
      "enrollment_date" = COALESCE("enrollment_date", NULLIF(trim("custom_data"->>'enrollmentDate'), '')),
      "discount_type" = COALESCE("discount_type", NULLIF(trim("custom_data"->>'discountType'), '')),
      "discount_pct" = COALESCE("discount_pct", CASE WHEN ("custom_data"->>'discountPct') ~ '^[0-9]+(\.[0-9]+)?$' THEN ("custom_data"->>'discountPct')::numeric(5, 2) ELSE NULL END),
      "registration_type" = COALESCE("registration_type", NULLIF(trim("custom_data"->>'registrationType'), '')),
      "notes" = COALESCE("notes", NULLIF(trim("custom_data"->>'notes'), '')),
      "created_at" = COALESCE("created_at", CASE WHEN ("custom_data"->>'createdAt') IS NOT NULL AND ("custom_data"->>'createdAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN ("custom_data"->>'createdAt')::timestamptz ELSE now() END),
      "created_by" = COALESCE("created_by", NULLIF(trim("custom_data"->>'createdBy'), '')),
      "updated_by" = COALESCE("updated_by", NULLIF(trim("custom_data"->>'updatedBy'), ''));

    -- Backfill enrolled sessions from custom_data->'enrolledSessions'
    INSERT INTO "student_enrolled_sessions" ("id", "workspace_subdomain", "student_id", "session_id", "sort_order", "created_at")
    SELECT
      CONCAT(s."id", '_sess_', ord - 1, '_', SUBSTRING(trim(both '"' from elem::text) FROM 1 FOR 30)),
      s."workspace_subdomain",
      s."id",
      trim(both '"' from elem::text),
      ord - 1,
      now()
    FROM "students" s,
    jsonb_array_elements(s."custom_data"->'enrolledSessions') WITH ORDINALITY arr(elem, ord)
    WHERE s."custom_data" IS NOT NULL
      AND jsonb_typeof(s."custom_data"->'enrolledSessions') = 'array'
      AND trim(both '"' from elem::text) <> ''
    ON CONFLICT ("workspace_subdomain", "student_id", "id") DO NOTHING;

    -- Drop legacy custom_data column & GIN index
    DROP INDEX IF EXISTS "students_custom_data_gin_idx";
    ALTER TABLE "students" DROP COLUMN IF EXISTS "custom_data";
  END IF;
END $$;

-- 4. Alter column types to match Drizzle definition
ALTER TABLE "students"
  ALTER COLUMN "status" SET DATA TYPE varchar(50),
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "gr_number" SET DATA TYPE varchar(100);

-- 5. Foreign Key constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_father_contact_fk') THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_father_contact_fk" FOREIGN KEY ("workspace_subdomain", "father_contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_mother_contact_fk') THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_mother_contact_fk" FOREIGN KEY ("workspace_subdomain", "mother_contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_guardian_contact_fk') THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_guardian_contact_fk" FOREIGN KEY ("workspace_subdomain", "guardian_contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS "students_workspace_subdomain_idx" ON "students" ("workspace_subdomain");
CREATE INDEX IF NOT EXISTS "students_workspace_status_idx" ON "students" ("workspace_subdomain", "status");
CREATE INDEX IF NOT EXISTS "students_workspace_gr_number_idx" ON "students" ("workspace_subdomain", "gr_number");
CREATE INDEX IF NOT EXISTS "students_workspace_student_id_idx" ON "students" ("workspace_subdomain", "student_id");
CREATE INDEX IF NOT EXISTS "student_enrolled_sessions_workspace_student_idx" ON "student_enrolled_sessions" ("workspace_subdomain", "student_id");
CREATE INDEX IF NOT EXISTS "student_enrolled_sessions_workspace_session_idx" ON "student_enrolled_sessions" ("workspace_subdomain", "session_id");

-- 7. Row Level Security on student_enrolled_sessions
ALTER TABLE "student_enrolled_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_enrolled_sessions" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_enrolled_sessions_tenant_isolation" ON "student_enrolled_sessions";
CREATE POLICY "student_enrolled_sessions_tenant_isolation" ON "student_enrolled_sessions"
  AS RESTRICTIVE
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));
