-- 1. Add typed columns to obligation_types
ALTER TABLE "obligation_types" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "obligation_types" ADD COLUMN IF NOT EXISTS "quantity_based" boolean NOT NULL DEFAULT false;
ALTER TABLE "obligation_types" ADD COLUMN IF NOT EXISTS "designated_for" varchar(20) NOT NULL DEFAULT 'Both';
ALTER TABLE "obligation_types" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to mujtahids
ALTER TABLE "mujtahids" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "mujtahids" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Add typed columns to mujtahid_reps
ALTER TABLE "mujtahid_reps" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "mujtahid_reps" ADD COLUMN IF NOT EXISTS "mujtahid_id" text NOT NULL DEFAULT '';
ALTER TABLE "mujtahid_reps" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 4. Add typed columns to wakala_types
ALTER TABLE "wakala_types" ADD COLUMN IF NOT EXISTS "mujtahid_representative_id" text NOT NULL DEFAULT '';
ALTER TABLE "wakala_types" ADD COLUMN IF NOT EXISTS "obligation_type_id" text NOT NULL DEFAULT '';
ALTER TABLE "wakala_types" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 5. Add typed columns to obligation_distributions
ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "name" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "percentage" numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "wakala_type_id" text NOT NULL DEFAULT '';
ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "type" varchar(30) NOT NULL DEFAULT 'Liability';
ALTER TABLE "obligation_distributions" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 6. Add typed columns to obligation_collections
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "receipt_no" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "received_date" varchar(30) NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "sender_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "reference_id" varchar(120);
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "amount" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "currency_id" varchar(30) NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "payment_mode" varchar(30) NOT NULL DEFAULT 'Cash';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "obligation_type_id" text NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "mujtahid_representative_id" text NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "received_by" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "obligation_collections" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 7. Backfill from custom_data
DO $$
BEGIN
  -- Backfill obligation_types
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'obligation_types' AND column_name = 'custom_data'
  ) THEN
    UPDATE "obligation_types" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "quantity_based" = COALESCE(("custom_data"->>'quantity_based')::boolean, false),
      "designated_for" = COALESCE("custom_data"->>'designated_for', 'Both'),
      "created_at" = CASE 
        WHEN ("custom_data"->>'created_at') IS NOT NULL AND ("custom_data"->>'created_at') != '' 
        THEN ("custom_data"->>'created_at')::timestamp 
        ELSE now() 
      END,
      "updated_at" = CASE 
        WHEN ("custom_data"->>'updated_at') IS NOT NULL AND ("custom_data"->>'updated_at') != '' 
        THEN ("custom_data"->>'updated_at')::timestamp 
        ELSE now() 
      END
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "obligation_types_custom_data_gin_idx";
    ALTER TABLE "obligation_types" DROP COLUMN "custom_data";
  END IF;

  -- Backfill mujtahids
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'mujtahids' AND column_name = 'custom_data'
  ) THEN
    UPDATE "mujtahids" SET
      "name" = COALESCE("custom_data"->>'name', '')
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "mujtahids_custom_data_gin_idx";
    ALTER TABLE "mujtahids" DROP COLUMN "custom_data";
  END IF;

  -- Backfill mujtahid_reps
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'mujtahid_reps' AND column_name = 'custom_data'
  ) THEN
    UPDATE "mujtahid_reps" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "mujtahid_id" = COALESCE("custom_data"->>'mujtahid_id', '')
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "mujtahid_reps_custom_data_gin_idx";
    ALTER TABLE "mujtahid_reps" DROP COLUMN "custom_data";
  END IF;

  -- Backfill wakala_types
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'wakala_types' AND column_name = 'custom_data'
  ) THEN
    UPDATE "wakala_types" SET
      "mujtahid_representative_id" = COALESCE("custom_data"->>'mujtahid_representative_id', ''),
      "obligation_type_id" = COALESCE("custom_data"->>'obligation_type_id', '')
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "wakala_types_custom_data_gin_idx";
    ALTER TABLE "wakala_types" DROP COLUMN "custom_data";
  END IF;

  -- Backfill obligation_distributions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'obligation_distributions' AND column_name = 'custom_data'
  ) THEN
    UPDATE "obligation_distributions" SET
      "name" = COALESCE("custom_data"->>'name', ''),
      "percentage" = COALESCE(("custom_data"->>'percentage')::numeric, 0),
      "wakala_type_id" = COALESCE("custom_data"->>'wakala_type_id', ''),
      "type" = COALESCE("custom_data"->>'type', 'Liability')
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "obligation_distributions_custom_data_gin_idx";
    ALTER TABLE "obligation_distributions" DROP COLUMN "custom_data";
  END IF;

  -- Backfill obligation_collections
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'obligation_collections' AND column_name = 'custom_data'
  ) THEN
    UPDATE "obligation_collections" SET
      "receipt_no" = COALESCE("custom_data"->>'receipt_no', ''),
      "received_date" = COALESCE("custom_data"->>'received_date', ''),
      "sender_id" = COALESCE("custom_data"->>'sender_id', ''),
      "reference_id" = "custom_data"->>'reference_id',
      "amount" = COALESCE(("custom_data"->>'amount')::numeric, 0),
      "currency_id" = COALESCE("custom_data"->>'currency_id', ''),
      "payment_mode" = COALESCE("custom_data"->>'payment_mode', 'Cash'),
      "obligation_type_id" = COALESCE("custom_data"->>'obligation_type_id', ''),
      "mujtahid_representative_id" = COALESCE("custom_data"->>'mujtahid_representative_id', ''),
      "received_by" = COALESCE("custom_data"->>'received_by', ''),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason',
      "created_at" = CASE 
        WHEN ("custom_data"->>'created_at') IS NOT NULL AND ("custom_data"->>'created_at') != '' 
        THEN ("custom_data"->>'created_at')::timestamp 
        ELSE now() 
      END,
      "updated_at" = CASE 
        WHEN ("custom_data"->>'updated_at') IS NOT NULL AND ("custom_data"->>'updated_at') != '' 
        THEN ("custom_data"->>'updated_at')::timestamp 
        ELSE now() 
      END
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "obligation_collections_custom_data_gin_idx";
    ALTER TABLE "obligation_collections" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 8. Create Indexes
CREATE INDEX IF NOT EXISTS "obligation_types_workspace_name_idx" ON "obligation_types" ("workspace_subdomain", "name");
CREATE INDEX IF NOT EXISTS "mujtahids_workspace_name_idx" ON "mujtahids" ("workspace_subdomain", "name");
CREATE INDEX IF NOT EXISTS "mujtahid_reps_workspace_mujtahid_idx" ON "mujtahid_reps" ("workspace_subdomain", "mujtahid_id");
CREATE INDEX IF NOT EXISTS "wakala_types_workspace_rep_idx" ON "wakala_types" ("workspace_subdomain", "mujtahid_representative_id");
CREATE INDEX IF NOT EXISTS "wakala_types_workspace_type_idx" ON "wakala_types" ("workspace_subdomain", "obligation_type_id");
CREATE INDEX IF NOT EXISTS "obligation_distributions_workspace_wakala_idx" ON "obligation_distributions" ("workspace_subdomain", "wakala_type_id");

CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_receipt_idx" ON "obligation_collections" ("workspace_subdomain", "receipt_no");
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_sender_idx" ON "obligation_collections" ("workspace_subdomain", "sender_id");
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_type_idx" ON "obligation_collections" ("workspace_subdomain", "obligation_type_id");
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_rep_idx" ON "obligation_collections" ("workspace_subdomain", "mujtahid_representative_id");
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_deleted_idx" ON "obligation_collections" ("workspace_subdomain", "deleted_at");
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_active_idx" ON "obligation_collections" ("workspace_subdomain") WHERE "deleted_at" IS NULL;

-- 9. Force RLS
ALTER TABLE "obligation_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS obligation_types_tenant_isolation ON "obligation_types";
CREATE POLICY obligation_types_tenant_isolation ON "obligation_types" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "mujtahids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mujtahids" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mujtahids_tenant_isolation ON "mujtahids";
CREATE POLICY mujtahids_tenant_isolation ON "mujtahids" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "mujtahid_reps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mujtahid_reps" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mujtahid_reps_tenant_isolation ON "mujtahid_reps";
CREATE POLICY mujtahid_reps_tenant_isolation ON "mujtahid_reps" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "wakala_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wakala_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS wakala_types_tenant_isolation ON "wakala_types";
CREATE POLICY wakala_types_tenant_isolation ON "wakala_types" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "obligation_distributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_distributions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS obligation_distributions_tenant_isolation ON "obligation_distributions";
CREATE POLICY obligation_distributions_tenant_isolation ON "obligation_distributions" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "obligation_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_collections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS obligation_collections_tenant_isolation ON "obligation_collections";
CREATE POLICY obligation_collections_tenant_isolation ON "obligation_collections" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
