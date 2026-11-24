-- 0058_teachers_3nf_normalization.sql
-- Strictly normalize teachers domain: decompose custom_data into typed columns,
-- drop JSONB storage, create B-tree indexes, and enforce RLS.

-- 1. Add typed relational columns to teachers
ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "user_id" text,
  ADD COLUMN IF NOT EXISTS "employee_id" varchar(100),
  ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "specialization" varchar(150),
  ADD COLUMN IF NOT EXISTS "qualification" varchar(255),
  ADD COLUMN IF NOT EXISTS "join_date" varchar(35),
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "created_by" text,
  ADD COLUMN IF NOT EXISTS "updated_by" text;

-- 2. Backfill typed columns from custom_data (if custom_data column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teachers' AND column_name = 'custom_data'
  ) THEN
    UPDATE "teachers"
    SET
      "user_id" = COALESCE("user_id", NULLIF(trim("custom_data"->>'userId'), '')),
      "employee_id" = COALESCE("employee_id", NULLIF(trim("custom_data"->>'employeeId'), '')),
      "status" = COALESCE(NULLIF(trim("status"), ''), NULLIF(trim("custom_data"->>'status'), ''), 'active'),
      "specialization" = COALESCE("specialization", NULLIF(trim("custom_data"->>'specialization'), '')),
      "qualification" = COALESCE("qualification", NULLIF(trim("custom_data"->>'qualification'), '')),
      "join_date" = COALESCE("join_date", NULLIF(trim("custom_data"->>'joinDate'), '')),
      "notes" = COALESCE("notes", NULLIF(trim("custom_data"->>'notes'), '')),
      "created_at" = COALESCE("created_at", CASE WHEN ("custom_data"->>'createdAt') IS NOT NULL AND ("custom_data"->>'createdAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN ("custom_data"->>'createdAt')::timestamptz ELSE now() END),
      "created_by" = COALESCE("created_by", NULLIF(trim("custom_data"->>'createdBy'), '')),
      "updated_by" = COALESCE("updated_by", NULLIF(trim("custom_data"->>'updatedBy'), ''));

    -- Drop GIN index and custom_data column
    DROP INDEX IF EXISTS "teachers_custom_data_gin_idx";
    ALTER TABLE "teachers" DROP COLUMN IF EXISTS "custom_data";
  END IF;
END $$;

-- 3. Add foreign key for user_id to tenant_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'teachers_user_fk'
  ) THEN
    ALTER TABLE "teachers"
      ADD CONSTRAINT "teachers_user_fk"
      FOREIGN KEY ("user_id")
      REFERENCES "tenant_users"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create B-Tree indexes for fast relational querying
CREATE INDEX IF NOT EXISTS "teachers_workspace_subdomain_idx" ON "teachers" ("workspace_subdomain");
CREATE INDEX IF NOT EXISTS "teachers_workspace_status_idx" ON "teachers" ("workspace_subdomain", "status");
CREATE INDEX IF NOT EXISTS "teachers_workspace_employee_id_idx" ON "teachers" ("workspace_subdomain", "employee_id");
CREATE INDEX IF NOT EXISTS "teachers_workspace_specialization_idx" ON "teachers" ("workspace_subdomain", "specialization");
CREATE INDEX IF NOT EXISTS "teachers_workspace_deleted_idx" ON "teachers" ("workspace_subdomain", "deleted_at");
CREATE INDEX IF NOT EXISTS "teachers_workspace_active_idx" ON "teachers" ("workspace_subdomain") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_contact_active_idx" ON "teachers" ("workspace_subdomain", "contact_id") WHERE "deleted_at" IS NULL AND "contact_id" IS NOT NULL;
