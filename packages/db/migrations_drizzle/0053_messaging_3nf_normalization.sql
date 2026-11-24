-- 1. Add typed columns to message_templates
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "label" varchar(255) NOT NULL DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "label_key" varchar(255);
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "body" text NOT NULL DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "category" varchar(50) NOT NULL DEFAULT 'general';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "channel" varchar(50) NOT NULL DEFAULT 'all';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 2. Add typed columns to message_logs
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "user_id" text NOT NULL DEFAULT '';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "contact_id" varchar(64) NOT NULL DEFAULT '';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "channel" varchar(30) NOT NULL DEFAULT 'sms';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "body" text NOT NULL DEFAULT '';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "sent_at" varchar(35) NOT NULL DEFAULT '';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "status" varchar(30) NOT NULL DEFAULT 'sent';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "subject" varchar(500);
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "category" varchar(50) NOT NULL DEFAULT 'general';
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "error_message" varchar(1000);
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deleted_by" text;
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "deletion_reason" text;
ALTER TABLE "message_logs" ADD COLUMN IF NOT EXISTS "created_at" timestamp NOT NULL DEFAULT now();

-- 3. Backfill from custom_data
DO $$
BEGIN
  -- Backfill message_templates
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'message_templates' AND column_name = 'custom_data'
  ) THEN
    UPDATE "message_templates" SET
      "label" = COALESCE("custom_data"->>'label', ''),
      "label_key" = "custom_data"->>'labelKey',
      "body" = COALESCE("custom_data"->>'body', ''),
      "category" = COALESCE("custom_data"->>'category', 'general'),
      "channel" = COALESCE("custom_data"->>'channel', 'all'),
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

    DROP INDEX IF EXISTS "message_templates_custom_data_gin_idx";
    ALTER TABLE "message_templates" DROP COLUMN "custom_data";
  END IF;

  -- Backfill message_logs
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'message_logs' AND column_name = 'custom_data'
  ) THEN
    UPDATE "message_logs" SET
      "user_id" = COALESCE("custom_data"->>'userId', ''),
      "contact_id" = COALESCE("custom_data"->>'contactId', ''),
      "channel" = COALESCE("custom_data"->>'channel', 'sms'),
      "body" = COALESCE("custom_data"->>'body', ''),
      "sent_at" = COALESCE("custom_data"->>'sentAt', ''),
      "status" = COALESCE("custom_data"->>'status', 'sent'),
      "subject" = "custom_data"->>'subject',
      "category" = COALESCE("custom_data"->>'category', 'general'),
      "error_message" = "custom_data"->>'errorMessage',
      "deleted_at" = CASE 
        WHEN ("custom_data"->>'deletedAt') IS NOT NULL AND ("custom_data"->>'deletedAt') != '' 
        THEN ("custom_data"->>'deletedAt')::timestamp 
        ELSE "deleted_at"
      END,
      "deleted_by" = "custom_data"->>'deletedBy',
      "deletion_reason" = "custom_data"->>'deletionReason',
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

    DROP INDEX IF EXISTS "message_logs_custom_data_gin_idx";
    DROP INDEX IF EXISTS "message_logs_workspace_sent_at_active_idx";
    ALTER TABLE "message_logs" DROP COLUMN "custom_data";
  END IF;
END $$;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS "message_templates_workspace_category_idx" ON "message_templates" ("workspace_subdomain", "category");
CREATE INDEX IF NOT EXISTS "message_templates_workspace_channel_idx" ON "message_templates" ("workspace_subdomain", "channel");

CREATE INDEX IF NOT EXISTS "message_logs_workspace_channel_idx" ON "message_logs" ("workspace_subdomain", "channel");
CREATE INDEX IF NOT EXISTS "message_logs_workspace_category_idx" ON "message_logs" ("workspace_subdomain", "category");
CREATE INDEX IF NOT EXISTS "message_logs_workspace_status_idx" ON "message_logs" ("workspace_subdomain", "status");
CREATE INDEX IF NOT EXISTS "message_logs_workspace_contact_idx" ON "message_logs" ("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "message_logs_workspace_sent_at_idx" ON "message_logs" ("workspace_subdomain", "sent_at");
CREATE INDEX IF NOT EXISTS "message_logs_workspace_sent_at_active_idx" ON "message_logs" ("workspace_subdomain", "sent_at") WHERE "deleted_at" IS NULL;

-- 5. Force RLS
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_templates_tenant_isolation ON "message_templates";
CREATE POLICY message_templates_tenant_isolation ON "message_templates" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));

ALTER TABLE "message_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS message_logs_tenant_isolation ON "message_logs";
CREATE POLICY message_logs_tenant_isolation ON "message_logs" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
