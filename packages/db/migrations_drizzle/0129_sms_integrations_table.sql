-- Migration 0128: Create sms_integrations table with FORCE ROW LEVEL SECURITY.
-- One row per tenant enforces "exactly one active SMS provider" at the schema level.

CREATE TABLE IF NOT EXISTS "sms_integrations" (
  "workspace_subdomain" text PRIMARY KEY REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
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

ALTER TABLE "sms_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sms_integrations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "sms_integrations";
CREATE POLICY tenant_isolation_policy ON "sms_integrations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
