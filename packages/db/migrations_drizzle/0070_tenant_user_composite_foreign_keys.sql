-- Forward-only Migration: 0070_tenant_user_composite_foreign_keys
-- Upgrades background_jobs and teachers foreign keys to composite referencing tenant_users(workspace_subdomain, id).

DO $$ BEGIN
  ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_workspace_subdomain_id_uniq"
    UNIQUE ("workspace_subdomain", "id");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE "background_jobs" bj
SET "user_id" = NULL
WHERE "user_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "tenant_users" tu
  WHERE tu."workspace_subdomain" = bj."tenant_id" AND tu."id" = bj."user_id"
);

DO $$ BEGIN
  ALTER TABLE "background_jobs" DROP CONSTRAINT IF EXISTS "background_jobs_user_id_tenant_users_id_fk";
  ALTER TABLE "background_jobs" DROP CONSTRAINT IF EXISTS "background_jobs_user_fk";
  ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_fk"
    FOREIGN KEY ("tenant_id", "user_id") REFERENCES "tenant_users"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE "teachers" t
SET "user_id" = NULL
WHERE "user_id" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "tenant_users" tu
  WHERE tu."workspace_subdomain" = t."workspace_subdomain" AND tu."id" = t."user_id"
);

DO $$ BEGIN
  ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_user_id_tenant_users_id_fk";
  ALTER TABLE "teachers" DROP CONSTRAINT IF EXISTS "teachers_user_fk";
  ALTER TABLE "teachers" ADD CONSTRAINT "teachers_user_fk"
    FOREIGN KEY ("workspace_subdomain", "user_id") REFERENCES "tenant_users"("workspace_subdomain", "id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
