-- 1. Add typed columns to user_activity_logs
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "user_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "action" varchar(50) NOT NULL DEFAULT 'create';
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "module" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "detail" text NOT NULL DEFAULT '';
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "ts" varchar(35) NOT NULL DEFAULT '';
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "ip" varchar(50) NOT NULL DEFAULT '';
ALTER TABLE "user_activity_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to audit_log_entries
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "at" varchar(35) NOT NULL DEFAULT '';
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "user_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "user_email" varchar(255);
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "tenant" varchar(100);
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "action" varchar(100) NOT NULL DEFAULT '';
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "entity_type" varchar(50) NOT NULL DEFAULT 'collection';
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "entity_id" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Backfill from custom_data
DO $$
BEGIN
  -- Backfill user_activity_logs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'user_activity_logs' AND column_name = 'custom_data'
  ) THEN
    UPDATE "user_activity_logs" SET
      "user_id" = COALESCE("custom_data"->>'userId', ''),
      "action" = COALESCE("custom_data"->>'action', 'create'),
      "module" = COALESCE("custom_data"->>'module', ''),
      "detail" = COALESCE("custom_data"->>'detail', ''),
      "ts" = COALESCE("custom_data"->>'ts', ''),
      "ip" = COALESCE("custom_data"->>'ip', ''),
      "created_at" = CASE 
        WHEN ("custom_data"->>'createdAt') IS NOT NULL AND ("custom_data"->>'createdAt') != '' 
        THEN ("custom_data"->>'createdAt')::timestamp 
        ELSE now() 
      END,
      "updated_at" = CASE 
        WHEN ("custom_data"->>'updatedAt') IS NOT NULL AND ("custom_data"->>'updatedAt') != '' 
        THEN ("custom_data"->>'updatedAt')::timestamp 
        ELSE now() 
      END
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "user_activity_logs_custom_data_gin_idx";
    ALTER TABLE "user_activity_logs" DROP COLUMN "custom_data";
  END IF;

  -- Backfill audit_log_entries
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'audit_log_entries' AND column_name = 'custom_data'
  ) THEN
    UPDATE "audit_log_entries" SET
      "at" = COALESCE("custom_data"->>'at', ''),
      "user_id" = COALESCE("custom_data"->>'userId', ''),
      "user_email" = "custom_data"->>'userEmail',
      "tenant" = "custom_data"->>'tenant',
      "action" = COALESCE("custom_data"->>'action', ''),
      "entity_type" = COALESCE("custom_data"->>'entityType', 'collection'),
      "entity_id" = COALESCE("custom_data"->>'entityId', ''),
      "summary" = "custom_data"->>'summary',
      "created_at" = CASE 
        WHEN ("custom_data"->>'createdAt') IS NOT NULL AND ("custom_data"->>'createdAt') != '' 
        THEN ("custom_data"->>'createdAt')::timestamp 
        ELSE now() 
      END,
      "updated_at" = CASE 
        WHEN ("custom_data"->>'updatedAt') IS NOT NULL AND ("custom_data"->>'updatedAt') != '' 
        THEN ("custom_data"->>'updatedAt')::timestamp 
        ELSE now() 
      END
    WHERE "custom_data" IS NOT NULL;

    DROP INDEX IF EXISTS "audit_log_entries_custom_data_gin_idx";
    ALTER TABLE "audit_log_entries" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "user_activity_logs_workspace_user_idx" ON "user_activity_logs" ("workspace_subdomain", "user_id");
CREATE INDEX IF NOT EXISTS "user_activity_logs_workspace_action_idx" ON "user_activity_logs" ("workspace_subdomain", "action");
CREATE INDEX IF NOT EXISTS "user_activity_logs_workspace_module_idx" ON "user_activity_logs" ("workspace_subdomain", "module");
CREATE INDEX IF NOT EXISTS "user_activity_logs_workspace_ts_idx" ON "user_activity_logs" ("workspace_subdomain", "ts");

CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_user_idx" ON "audit_log_entries" ("workspace_subdomain", "user_id");
CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_action_idx" ON "audit_log_entries" ("workspace_subdomain", "action");
CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_entity_type_idx" ON "audit_log_entries" ("workspace_subdomain", "entity_type");
CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_at_idx" ON "audit_log_entries" ("workspace_subdomain", "at");

-- 5. Force RLS
ALTER TABLE "user_activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_activity_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_activity_logs_tenant_isolation ON "user_activity_logs";
CREATE POLICY user_activity_logs_tenant_isolation ON "user_activity_logs" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "audit_log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_entries_tenant_isolation ON "audit_log_entries";
CREATE POLICY audit_log_entries_tenant_isolation ON "audit_log_entries" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
