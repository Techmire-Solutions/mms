-- Migration 0072: Promote global_settings & granted_modules from objects store → workspaces table columns.
-- All columns nullable; defaults applied at data-migration time (migration 080).
-- enabledModules, grantedModules, and llmConfigs stored as jsonb.

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "language"            varchar(10),
  ADD COLUMN IF NOT EXISTS "timezone"            varchar(50),
  ADD COLUMN IF NOT EXISTS "date_format"         varchar(20),
  ADD COLUMN IF NOT EXISTS "email_notifications" boolean,
  ADD COLUMN IF NOT EXISTS "sms_notifications"   boolean,
  ADD COLUMN IF NOT EXISTS "two_factor"          boolean,
  ADD COLUMN IF NOT EXISTS "session_timeout"     varchar(20),
  ADD COLUMN IF NOT EXISTS "password_policy"     varchar(20),
  ADD COLUMN IF NOT EXISTS "theme"               varchar(20),
  ADD COLUMN IF NOT EXISTS "enabled_modules"     jsonb,
  ADD COLUMN IF NOT EXISTS "granted_modules"     jsonb,
  ADD COLUMN IF NOT EXISTS "llm_provider"        varchar(30),
  ADD COLUMN IF NOT EXISTS "llm_api_key"         text,
  ADD COLUMN IF NOT EXISTS "llm_configs"         jsonb;
