-- 1. Add typed columns to enrollments table
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "student_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "student_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "session_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "session_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "class_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "class_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "enrolled_date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "base_fee" numeric(12, 2) NOT NULL DEFAULT '0';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "discount_type" varchar(32) NOT NULL DEFAULT 'none';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "discount_label" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "discount_pct" numeric(5, 2) NOT NULL DEFAULT '0';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "discount_amt" numeric(12, 2) NOT NULL DEFAULT '0';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "final_fee" numeric(12, 2) NOT NULL DEFAULT '0';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "invoice_id" varchar(64);
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "payment_status" varchar(20) NOT NULL DEFAULT 'none';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "notes" text NOT NULL DEFAULT '';
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Create enrollment_timeline_events child table
CREATE TABLE IF NOT EXISTS "enrollment_timeline_events" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "enrollment_id" text NOT NULL,
  "event" varchar(120) NOT NULL,
  "by" varchar(120) NOT NULL,
  "ts" varchar(40) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- 3. Backfill typed columns and timeline events from custom_data if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'enrollments' 
      AND column_name = 'custom_data'
  ) THEN
    -- Backfill parent columns
    UPDATE "enrollments" SET
      "student_id" = COALESCE("custom_data"->>'studentId', ''),
      "student_name" = COALESCE("custom_data"->>'studentName', ''),
      "session_id" = COALESCE("custom_data"->>'sessionId', ''),
      "session_name" = COALESCE("custom_data"->>'sessionName', ''),
      "class_id" = COALESCE("custom_data"->>'classId', ''),
      "class_name" = COALESCE("custom_data"->>'className', ''),
      "enrolled_date" = COALESCE("custom_data"->>'enrolledDate', ''),
      "base_fee" = COALESCE(("custom_data"->>'baseFee')::numeric, 0),
      "discount_type" = COALESCE("custom_data"->>'discountType', 'none'),
      "discount_label" = COALESCE("custom_data"->>'discountLabel', ''),
      "discount_pct" = COALESCE(("custom_data"->>'discountPct')::numeric, 0),
      "discount_amt" = COALESCE(("custom_data"->>'discountAmt')::numeric, 0),
      "final_fee" = COALESCE(("custom_data"->>'finalFee')::numeric, 0),
      "status" = COALESCE("custom_data"->>'status', 'pending'),
      "invoice_id" = "custom_data"->>'invoiceId',
      "payment_status" = COALESCE("custom_data"->>'paymentStatus', 'none'),
      "notes" = COALESCE("custom_data"->>'notes', ''),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    -- Backfill timeline child table
    INSERT INTO "enrollment_timeline_events" ("workspace_subdomain", "enrollment_id", "event", "by", "ts")
    SELECT
      e.workspace_subdomain,
      e.id,
      COALESCE(t.value->>'event', ''),
      COALESCE(t.value->>'by', ''),
      COALESCE(t.value->>'ts', '')
    FROM enrollments e
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN jsonb_typeof(e.custom_data->'timeline') = 'array' 
        THEN e.custom_data->'timeline' 
        ELSE '[]'::jsonb 
      END
    ) AS t(value)
    WHERE e.custom_data IS NOT NULL;

    DROP INDEX IF EXISTS "enrollments_custom_data_gin_idx";
    ALTER TABLE "enrollments" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "enrollments_workspace_session_idx"
  ON "enrollments" ("workspace_subdomain", "session_id");

CREATE INDEX IF NOT EXISTS "enrollments_workspace_student_idx"
  ON "enrollments" ("workspace_subdomain", "student_id");

CREATE INDEX IF NOT EXISTS "enrollments_workspace_class_idx"
  ON "enrollments" ("workspace_subdomain", "class_id");

CREATE INDEX IF NOT EXISTS "enrollments_workspace_date_idx"
  ON "enrollments" ("workspace_subdomain", "enrolled_date");

CREATE INDEX IF NOT EXISTS "enrollments_workspace_status_idx"
  ON "enrollments" ("workspace_subdomain", "status");

CREATE INDEX IF NOT EXISTS "enrollments_workspace_deleted_idx"
  ON "enrollments" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "enrollments_workspace_active_idx"
  ON "enrollments" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "enrollment_timeline_enrollment_idx"
  ON "enrollment_timeline_events" ("workspace_subdomain", "enrollment_id");

-- 5. Force RLS
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enrollments_tenant_isolation ON "enrollments";
CREATE POLICY enrollments_tenant_isolation ON "enrollments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "enrollment_timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_timeline_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS enrollment_timeline_events_tenant_isolation ON "enrollment_timeline_events";
CREATE POLICY enrollment_timeline_events_tenant_isolation ON "enrollment_timeline_events"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
