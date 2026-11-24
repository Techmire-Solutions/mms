-- Migration 0152: Platform-level email/SMS notification settings.
-- Adds a phone field to platform admins (only source of a real SMS target), two
-- toggle columns on platform_settings, and singleton provider-config tables
-- mirroring the tenant email_integrations/sms_integrations shape. Apex-only data
-- with no tenant column, so no RLS policy applies here (consistent with the
-- existing platform_settings table).

ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "phone" text;

ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "email_notifications" boolean NOT NULL DEFAULT true;
ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "sms_notifications" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "platform_email_integrations" (
  "id" text PRIMARY KEY DEFAULT 'global',
  "provider_id" varchar(40) NOT NULL DEFAULT 'gmail',
  "from_address" varchar(255) NOT NULL DEFAULT '',
  "from_name" varchar(255) NOT NULL DEFAULT 'MMS Platform',
  "smtp_username" varchar(255) NOT NULL DEFAULT '',
  "smtp_host" varchar(255),
  "smtp_port" integer,
  "smtp_secure" boolean,
  "smtp_password" text,
  "connected" boolean NOT NULL DEFAULT false,
  "has_credentials" boolean NOT NULL DEFAULT false,
  "last_test_at" timestamp with time zone,
  "last_test_ok" boolean,
  "last_error" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "platform_sms_integrations" (
  "id" text PRIMARY KEY DEFAULT 'global',
  "provider_id" varchar(40) NOT NULL DEFAULT 'twilio',
  "account_id" varchar(255) NOT NULL DEFAULT '',
  "sender_id" varchar(255) NOT NULL DEFAULT '',
  "api_base_url" varchar(255),
  "account_secret" text,
  "connected" boolean NOT NULL DEFAULT false,
  "has_credentials" boolean NOT NULL DEFAULT false,
  "last_test_at" timestamp with time zone,
  "last_test_ok" boolean,
  "last_error" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
