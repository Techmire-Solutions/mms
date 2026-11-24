-- 1. Add typed columns to attendance table
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "class_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "student_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "student_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "roll_no" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'present';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "time_in" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "time_out" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT '';
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Backfill typed columns from custom_data if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'attendance' 
      AND column_name = 'custom_data'
  ) THEN
    UPDATE "attendance" SET
      "class_id" = COALESCE("custom_data"->>'classId', ''),
      "student_id" = COALESCE("custom_data"->>'studentId', ''),
      "student_name" = COALESCE("custom_data"->>'studentName', ''),
      "roll_no" = COALESCE("custom_data"->>'rollNo', ''),
      "date" = COALESCE("custom_data"->>'date', ''),
      "status" = COALESCE("custom_data"->>'status', 'present'),
      "time_in" = COALESCE("custom_data"->>'timeIn', ''),
      "time_out" = COALESCE("custom_data"->>'timeOut', ''),
      "notes" = COALESCE("custom_data"->>'notes', ''),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "attendance_custom_data_gin_idx";
    ALTER TABLE "attendance" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 3. Create attendance_leaves table
CREATE TABLE IF NOT EXISTS "attendance_leaves" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "student_id" varchar(64) NOT NULL,
  "from_date" varchar(10) NOT NULL,
  "to_date" varchar(10) NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "approved_by" text,
  "approved_at" timestamp,
  "notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id")
);

-- 4. Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_workspace_class_student_date_uidx"
  ON "attendance" ("workspace_subdomain", "class_id", "student_id", "date")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "attendance_workspace_active_idx"
  ON "attendance" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "attendance_workspace_date_idx"
  ON "attendance" ("workspace_subdomain", "date");

CREATE INDEX IF NOT EXISTS "attendance_workspace_class_date_idx"
  ON "attendance" ("workspace_subdomain", "class_id", "date");

CREATE INDEX IF NOT EXISTS "attendance_workspace_student_idx"
  ON "attendance" ("workspace_subdomain", "student_id");

CREATE INDEX IF NOT EXISTS "attendance_workspace_deleted_idx"
  ON "attendance" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "attendance_leaves_workspace_student_idx"
  ON "attendance_leaves" ("workspace_subdomain", "student_id");

CREATE INDEX IF NOT EXISTS "attendance_leaves_workspace_date_idx"
  ON "attendance_leaves" ("workspace_subdomain", "from_date", "to_date");

-- 5. Force RLS
ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_tenant_isolation ON "attendance";
CREATE POLICY attendance_tenant_isolation ON "attendance"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "attendance_leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_leaves" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_leaves_tenant_isolation ON "attendance_leaves";
CREATE POLICY attendance_leaves_tenant_isolation ON "attendance_leaves"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
