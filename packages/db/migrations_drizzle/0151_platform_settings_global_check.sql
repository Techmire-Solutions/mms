-- MMS Forward-only Migration: 0151_platform_settings_global_check.sql
-- Enforce platform_settings singleton identity (id must be 'global').

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "platform_settings"
    ADD CONSTRAINT "platform_settings_global_id_check"
    CHECK ("id" = 'global');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
