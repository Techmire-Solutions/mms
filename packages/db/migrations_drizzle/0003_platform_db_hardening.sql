-- Platform DB hardening: audit longevity, role check, auth_artifact lookup columns.
ALTER TABLE "platform_activity_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_activity_logs" DROP CONSTRAINT IF EXISTS "platform_activity_logs_user_id_platform_users_id_fk";--> statement-breakpoint
ALTER TABLE "platform_activity_logs" ADD CONSTRAINT "platform_activity_logs_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_activity_logs_created_at_idx" ON "platform_activity_logs" USING btree ("created_at");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_role_check" CHECK ("role" IN ('super_user', 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "auth_artifacts" ADD COLUMN IF NOT EXISTS "lookup_key" text;--> statement-breakpoint
ALTER TABLE "auth_artifacts" ADD COLUMN IF NOT EXISTS "scope_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "auth_artifacts_lookup_key_uidx" ON "auth_artifacts" USING btree ("lookup_key") WHERE "lookup_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_artifacts_scope_key_idx" ON "auth_artifacts" USING btree ("scope_key") WHERE "scope_key" IS NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "auth_artifacts" ADD CONSTRAINT "auth_artifacts_kind_check" CHECK ("kind" IN (
    'handoff',
    'two_factor_challenge',
    'refresh_token',
    'platform_setup',
    'platform_password_reset',
    'login_email_change'
  ));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
-- Backfill refresh-token lookup/scope keys from existing JSON payloads.
UPDATE "auth_artifacts"
SET
  "lookup_key" = NULLIF(payload->>'tokenHash', ''),
  "scope_key" = CASE
    WHEN payload->>'userId' IS NOT NULL AND length(trim(payload->>'userId')) > 0
      THEN 'user:' || trim(payload->>'userId')
    ELSE "scope_key"
  END
WHERE "kind" = 'refresh_token'
  AND ("lookup_key" IS NULL OR "scope_key" IS NULL);--> statement-breakpoint
UPDATE "auth_artifacts"
SET "scope_key" = CASE
  WHEN payload->>'workspaceSubdomain' IS NOT NULL AND length(trim(payload->>'workspaceSubdomain')) > 0
    THEN 'ws:' || lower(trim(payload->>'workspaceSubdomain'))
  WHEN payload->>'subdomain' IS NOT NULL AND length(trim(payload->>'subdomain')) > 0
    THEN 'ws:' || lower(trim(payload->>'subdomain'))
  WHEN payload->'user'->>'workspaceSubdomain' IS NOT NULL AND length(trim(payload->'user'->>'workspaceSubdomain')) > 0
    THEN 'ws:' || lower(trim(payload->'user'->>'workspaceSubdomain'))
  ELSE "scope_key"
END
WHERE "scope_key" IS NULL
  AND (
    payload ? 'workspaceSubdomain'
    OR payload ? 'subdomain'
    OR (payload ? 'user' AND payload->'user' ? 'workspaceSubdomain')
  );
