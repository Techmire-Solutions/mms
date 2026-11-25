-- 1. Create platform_user_permissions child table
CREATE TABLE IF NOT EXISTS "platform_user_permissions" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "platform_user_id" text NOT NULL REFERENCES "platform_users"("id") ON DELETE CASCADE,
  "permission_key" varchar(40) NOT NULL,
  "is_granted" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_perms_user_key_uidx"
  ON "platform_user_permissions" ("platform_user_id", "permission_key");
CREATE INDEX IF NOT EXISTS "platform_user_perms_user_idx"
  ON "platform_user_permissions" ("platform_user_id");

-- 2. Backfill permissions from existing jsonb column if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'platform_users' 
      AND column_name = 'permissions'
  ) THEN
    INSERT INTO "platform_user_permissions" ("platform_user_id", "permission_key", "is_granted")
    SELECT id, 'workspaces', COALESCE((permissions->>'workspaces')::boolean, false)
    FROM "platform_users"
    ON CONFLICT ("platform_user_id", "permission_key") DO NOTHING;

    INSERT INTO "platform_user_permissions" ("platform_user_id", "permission_key", "is_granted")
    SELECT id, 'onboard', COALESCE((permissions->>'onboard')::boolean, false)
    FROM "platform_users"
    ON CONFLICT ("platform_user_id", "permission_key") DO NOTHING;

    ALTER TABLE "platform_users" DROP COLUMN "permissions";
  END IF;
END $$;

-- 3. Decompose platform_activity_logs.details into typed columns
ALTER TABLE "platform_activity_logs" ADD COLUMN IF NOT EXISTS "target_resource" varchar(120);
ALTER TABLE "platform_activity_logs" ADD COLUMN IF NOT EXISTS "target_id" varchar(64);
ALTER TABLE "platform_activity_logs" ADD COLUMN IF NOT EXISTS "metadata_message" varchar(500);

-- 4. Backfill from existing jsonb details if details column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'platform_activity_logs' 
      AND column_name = 'details'
  ) THEN
    UPDATE "platform_activity_logs" SET
      "target_resource" = CASE
        WHEN "action" IN ('toggle_workspace', 'delete_workspace', 'update_workspace_modules') THEN 'workspace'
        WHEN "action" IN ('create_admin', 'update_admin_permissions', 'disable_admin', 'enable_admin', 'delete_admin') THEN 'admin'
        WHEN "action" = 'update_settings' THEN 'settings'
        WHEN "action" = 'migrate_and_restart' THEN 'system'
        ELSE NULL
      END,
      "target_id" = COALESCE(
        "details"->>'subdomain',
        "details"->>'adminId',
        NULL
      ),
      "metadata_message" = LEFT("details"::text, 500)
    WHERE "details" IS NOT NULL;

    ALTER TABLE "platform_activity_logs" DROP COLUMN "details";
  END IF;
END $$;

-- 5. Add index on platform_activity_logs(user_id, created_at)
CREATE INDEX IF NOT EXISTS "platform_activity_logs_user_created_idx"
  ON "platform_activity_logs" ("user_id", "created_at");
