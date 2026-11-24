-- 1. Add typed columns to accounting_accounts
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "code" varchar(50) NOT NULL DEFAULT '';
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "name" varchar(150) NOT NULL DEFAULT '';
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "type" varchar(50) NOT NULL DEFAULT 'Asset';
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "subtype" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "accounting_accounts" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to accounting_fiscal_years
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "label" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "start_date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "end_date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'upcoming';
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "accounting_fiscal_years" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Add typed columns to accounting_entries
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "date" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "ref" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'posted';
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "created_by" varchar(120) NOT NULL DEFAULT '';
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "fiscal_year" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "transaction_type" varchar(50);
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "reversed_ref" varchar(100);
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "simple_mode" boolean NOT NULL DEFAULT false;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "accounting_entries" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 4. Create child tables
CREATE TABLE IF NOT EXISTS "accounting_journal_lines" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "entry_id" text NOT NULL,
  "account_id" text NOT NULL,
  "debit" numeric(14, 2) NOT NULL DEFAULT 0,
  "credit" numeric(14, 2) NOT NULL DEFAULT 0,
  "description" text NOT NULL DEFAULT '',
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "entry_id", "id")
);

CREATE TABLE IF NOT EXISTS "accounting_entry_tags" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "entry_id" text NOT NULL,
  "tag" varchar(64) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "entry_id", "tag")
);

CREATE TABLE IF NOT EXISTS "accounting_entry_attachments" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "entry_id" text NOT NULL,
  "url" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "entry_id", "url")
);

-- 5. Backfill from custom_data
DO $$
BEGIN
  -- Backfill accounting_accounts
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'accounting_accounts' AND column_name = 'custom_data'
  ) THEN
    UPDATE "accounting_accounts" SET
      "code" = COALESCE("custom_data"->>'code', ''),
      "name" = COALESCE("custom_data"->>'name', ''),
      "type" = COALESCE("custom_data"->>'type', 'Asset'),
      "subtype" = COALESCE("custom_data"->>'subtype', ''),
      "description" = COALESCE("custom_data"->>'description', ''),
      "is_active" = COALESCE(("custom_data"->>'isActive')::boolean, true),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "accounting_accounts_custom_data_gin_idx";
    ALTER TABLE "accounting_accounts" DROP COLUMN "custom_data";
  END IF;

  -- Backfill accounting_fiscal_years
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'accounting_fiscal_years' AND column_name = 'custom_data'
  ) THEN
    UPDATE "accounting_fiscal_years" SET
      "label" = COALESCE("custom_data"->>'label', "custom_data"->>'name', ''),
      "start_date" = COALESCE("custom_data"->>'startDate', ''),
      "end_date" = COALESCE("custom_data"->>'endDate', ''),
      "status" = COALESCE("custom_data"->>'status', 'upcoming'),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "accounting_fiscal_years_custom_data_gin_idx";
    ALTER TABLE "accounting_fiscal_years" DROP COLUMN "custom_data";
  END IF;

  -- Backfill accounting_entries and child tables
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'accounting_entries' AND column_name = 'custom_data'
  ) THEN
    -- Backfill journal lines
    INSERT INTO "accounting_journal_lines" ("id", "workspace_subdomain", "entry_id", "account_id", "debit", "credit", "description")
    SELECT
      COALESCE(line->>'id', gen_random_uuid()::text),
      e."workspace_subdomain",
      e."id",
      COALESCE(line->>'account_id', line->>'accountId', ''),
      COALESCE((line->>'debit')::numeric, 0),
      COALESCE((line->>'credit')::numeric, 0),
      COALESCE(line->>'description', '')
    FROM "accounting_entries" e,
         jsonb_array_elements(COALESCE(e."custom_data"->'lines', '[]'::jsonb)) AS line
    ON CONFLICT ("workspace_subdomain", "entry_id", "id") DO NOTHING;

    -- Backfill tags
    INSERT INTO "accounting_entry_tags" ("workspace_subdomain", "entry_id", "tag")
    SELECT
      e."workspace_subdomain",
      e."id",
      tag.value::text
    FROM "accounting_entries" e,
         jsonb_array_elements_text(COALESCE(e."custom_data"->'tags', '[]'::jsonb)) AS tag
    ON CONFLICT ("workspace_subdomain", "entry_id", "tag") DO NOTHING;

    -- Backfill attachments
    INSERT INTO "accounting_entry_attachments" ("workspace_subdomain", "entry_id", "url")
    SELECT
      e."workspace_subdomain",
      e."id",
      att.value::text
    FROM "accounting_entries" e,
         jsonb_array_elements_text(COALESCE(e."custom_data"->'attachments', '[]'::jsonb)) AS att
    ON CONFLICT ("workspace_subdomain", "entry_id", "url") DO NOTHING;

    -- Update parent entry columns
    UPDATE "accounting_entries" SET
      "date" = COALESCE("custom_data"->>'date', ''),
      "ref" = COALESCE("custom_data"->>'ref', "custom_data"->>'reference', ''),
      "description" = COALESCE("custom_data"->>'description', ''),
      "status" = COALESCE("custom_data"->>'status', 'posted'),
      "created_by" = COALESCE("custom_data"->>'created_by', "custom_data"->>'createdBy', ''),
      "fiscal_year" = COALESCE("custom_data"->>'fiscal_year', "custom_data"->>'fiscalYear', ''),
      "transaction_type" = "custom_data"->>'transaction_type',
      "reversed_ref" = "custom_data"->>'reversed_ref',
      "simple_mode" = COALESCE(("custom_data"->>'simple_mode')::boolean, false),
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE NULL 
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason'
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "accounting_entries_custom_data_gin_idx";
    ALTER TABLE "accounting_entries" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 6. Create Indexes
CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_code_idx"
  ON "accounting_accounts" ("workspace_subdomain", "code");

CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_type_idx"
  ON "accounting_accounts" ("workspace_subdomain", "type");

CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_deleted_idx"
  ON "accounting_accounts" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_active_idx"
  ON "accounting_accounts" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_workspace_status_idx"
  ON "accounting_fiscal_years" ("workspace_subdomain", "status");

CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_workspace_deleted_idx"
  ON "accounting_fiscal_years" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_workspace_active_idx"
  ON "accounting_fiscal_years" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_date_idx"
  ON "accounting_entries" ("workspace_subdomain", "date");

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_status_idx"
  ON "accounting_entries" ("workspace_subdomain", "status");

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_fiscal_idx"
  ON "accounting_entries" ("workspace_subdomain", "fiscal_year");

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_deleted_idx"
  ON "accounting_entries" ("workspace_subdomain", "deleted_at");

CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_active_idx"
  ON "accounting_entries" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "accounting_lines_workspace_entry_idx"
  ON "accounting_journal_lines" ("workspace_subdomain", "entry_id");

CREATE INDEX IF NOT EXISTS "accounting_lines_workspace_account_idx"
  ON "accounting_journal_lines" ("workspace_subdomain", "account_id");

CREATE INDEX IF NOT EXISTS "accounting_entry_tags_workspace_entry_idx"
  ON "accounting_entry_tags" ("workspace_subdomain", "entry_id");

CREATE INDEX IF NOT EXISTS "accounting_entry_attachments_workspace_entry_idx"
  ON "accounting_entry_attachments" ("workspace_subdomain", "entry_id");

-- 7. Force RLS
ALTER TABLE "accounting_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_accounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_accounts_tenant_isolation ON "accounting_accounts";
CREATE POLICY accounting_accounts_tenant_isolation ON "accounting_accounts"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "accounting_fiscal_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_fiscal_years" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_fiscal_years_tenant_isolation ON "accounting_fiscal_years";
CREATE POLICY accounting_fiscal_years_tenant_isolation ON "accounting_fiscal_years"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "accounting_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_entries_tenant_isolation ON "accounting_entries";
CREATE POLICY accounting_entries_tenant_isolation ON "accounting_entries"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "accounting_journal_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_journal_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_journal_lines_tenant_isolation ON "accounting_journal_lines";
CREATE POLICY accounting_journal_lines_tenant_isolation ON "accounting_journal_lines"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "accounting_entry_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_entry_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_entry_tags_tenant_isolation ON "accounting_entry_tags";
CREATE POLICY accounting_entry_tags_tenant_isolation ON "accounting_entry_tags"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );

ALTER TABLE "accounting_entry_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_entry_attachments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounting_entry_attachments_tenant_isolation ON "accounting_entry_attachments";
CREATE POLICY accounting_entry_attachments_tenant_isolation ON "accounting_entry_attachments"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
