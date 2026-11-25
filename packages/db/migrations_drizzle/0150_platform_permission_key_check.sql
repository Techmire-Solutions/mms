-- MMS Forward-only Migration: 0150_platform_permission_key_check.sql
-- Constrain platform_user_permissions.permission_key to the known grant set.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "platform_user_permissions"
    ADD CONSTRAINT "platform_user_perms_key_check"
    CHECK ("permission_key" IN ('workspaces', 'onboard', 'settings', 'admins', 'system'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
