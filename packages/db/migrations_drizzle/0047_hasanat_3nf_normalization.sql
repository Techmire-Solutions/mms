-- 1. Add typed columns to hasanat_denoms
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "name" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "points" integer NOT NULL DEFAULT 0;
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "color" varchar(64) NOT NULL DEFAULT 'emerald';
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "icon" varchar(64) NOT NULL DEFAULT 'Star';
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true;
ALTER TABLE "hasanat_denoms" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to hasanat_batches
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "denomination_id" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "denomination_name" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 0;
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "remaining" integer NOT NULL DEFAULT 0;
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "added_date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "added_by_user_id" text;
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "added_by" varchar(120);
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "note" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_batches" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Add typed columns to hasanat_distributions
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "batch_id" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "denomination_id" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "denomination_name" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "recipient_type" varchar(20) NOT NULL DEFAULT 'student';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "recipient_student_id" varchar(64);
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "recipient_teacher_id" varchar(64);
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "recipient_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "recipient_class" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "reason" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "issued_date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "issued_by_user_id" text;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "issued_by" varchar(120);
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'active';
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 4. Add typed columns to hasanat_redemptions
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "distribution_id" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "student_name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "reward" text NOT NULL DEFAULT '';
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "points_used" integer NOT NULL DEFAULT 0;
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "approved_by_user_id" text;
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "approved_by" varchar(120);
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 5. Backfill typed columns from custom_data
DO $$
BEGIN
  -- Backfill hasanat_denoms
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'hasanat_denoms' AND column_name = 'custom_data'
  ) THEN
    UPDATE "hasanat_denoms" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "points" = COALESCE(("custom_data"->>'points')::integer, 0),
      "color" = COALESCE("custom_data"->>'color', 'emerald'),
      "description" = COALESCE("custom_data"->>'description', ''),
      "icon" = COALESCE("custom_data"->>'icon', 'Star'),
      "active" = COALESCE(("custom_data"->>'active')::boolean, true)
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "hasanat_denoms_custom_data_gin_idx";
    ALTER TABLE "hasanat_denoms" DROP COLUMN "custom_data";
  END IF;

  -- Backfill hasanat_batches
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'hasanat_batches' AND column_name = 'custom_data'
  ) THEN
    UPDATE "hasanat_batches" SET
      "denomination_id" = COALESCE("custom_data"->>'denominationId', ''),
      "denomination_name" = COALESCE("custom_data"->>'denominationName', ''),
      "quantity" = COALESCE(("custom_data"->>'quantity')::integer, 0),
      "remaining" = COALESCE(("custom_data"->>'remaining')::integer, 0),
      "added_date" = COALESCE("custom_data"->>'addedDate', ''),
      "added_by_user_id" = "custom_data"->>'addedByUserId',
      "added_by" = "custom_data"->>'addedBy',
      "note" = COALESCE("custom_data"->>'note', '')
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "hasanat_batches_custom_data_gin_idx";
    ALTER TABLE "hasanat_batches" DROP COLUMN "custom_data";
  END IF;

  -- Backfill hasanat_distributions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'hasanat_distributions' AND column_name = 'custom_data'
  ) THEN
    UPDATE "hasanat_distributions" SET
      "batch_id" = COALESCE("custom_data"->>'batchId', ''),
      "denomination_id" = COALESCE("custom_data"->>'denominationId', ''),
      "denomination_name" = COALESCE("custom_data"->>'denominationName', ''),
      "recipient_type" = COALESCE("custom_data"->>'recipientType', 'student'),
      "recipient_student_id" = "custom_data"->>'recipientStudentId',
      "recipient_teacher_id" = "custom_data"->>'recipientTeacherId',
      "recipient_name" = COALESCE("custom_data"->>'recipientName', ''),
      "recipient_class" = COALESCE("custom_data"->>'recipientClass', ''),
      "quantity" = COALESCE(("custom_data"->>'quantity')::integer, 1),
      "reason" = COALESCE("custom_data"->>'reason', ''),
      "issued_date" = COALESCE("custom_data"->>'issuedDate', ''),
      "issued_by_user_id" = "custom_data"->>'issuedByUserId',
      "issued_by" = "custom_data"->>'issuedBy',
      "status" = COALESCE("custom_data"->>'status', 'active'),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "hasanat_distributions_custom_data_gin_idx";
    ALTER TABLE "hasanat_distributions" DROP COLUMN "custom_data";
  END IF;

  -- Backfill hasanat_redemptions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'hasanat_redemptions' AND column_name = 'custom_data'
  ) THEN
    UPDATE "hasanat_redemptions" SET
      "distribution_id" = COALESCE("custom_data"->>'distributionId', ''),
      "student_name" = COALESCE("custom_data"->>'studentName', ''),
      "reward" = COALESCE("custom_data"->>'reward', ''),
      "points_used" = COALESCE(("custom_data"->>'pointsUsed')::integer, 0),
      "date" = COALESCE("custom_data"->>'date', ''),
      "approved_by_user_id" = "custom_data"->>'approvedByUserId',
      "approved_by" = "custom_data"->>'approvedBy'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "hasanat_redemptions_custom_data_gin_idx";
    ALTER TABLE "hasanat_redemptions" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS "hasanat_denoms_workspace_active_idx"
  ON "hasanat_denoms" ("workspace_subdomain", "active");

CREATE INDEX IF NOT EXISTS "hasanat_batches_workspace_denom_idx"
  ON "hasanat_batches" ("workspace_subdomain", "denomination_id");

CREATE INDEX IF NOT EXISTS "hasanat_batches_workspace_added_date_idx"
  ON "hasanat_batches" ("workspace_subdomain", "added_date");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_student_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "recipient_student_id");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_batch_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "batch_id");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_denom_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "denomination_id");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_issued_date_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "issued_date");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_status_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "status");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_deleted_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_active_idx"
  ON "hasanat_distributions" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "hasanat_redemp_workspace_dist_idx"
  ON "hasanat_redemptions" ("workspace_subdomain", "distribution_id");

CREATE INDEX IF NOT EXISTS "hasanat_redemp_workspace_date_idx"
  ON "hasanat_redemptions" ("workspace_subdomain", "date");

-- 7. Force RLS on all 4 tables
ALTER TABLE "hasanat_denoms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_denoms" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hasanat_denoms_tenant_isolation ON "hasanat_denoms";
CREATE POLICY hasanat_denoms_tenant_isolation ON "hasanat_denoms"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "hasanat_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_batches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hasanat_batches_tenant_isolation ON "hasanat_batches";
CREATE POLICY hasanat_batches_tenant_isolation ON "hasanat_batches"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "hasanat_distributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_distributions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hasanat_distributions_tenant_isolation ON "hasanat_distributions";
CREATE POLICY hasanat_distributions_tenant_isolation ON "hasanat_distributions"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "hasanat_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_redemptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hasanat_redemptions_tenant_isolation ON "hasanat_redemptions";
CREATE POLICY hasanat_redemptions_tenant_isolation ON "hasanat_redemptions"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
