-- Migration 0183: Create whatsapp_integrations table with FORCE ROW LEVEL SECURITY.
-- Exactly one active WhatsApp provider per tenant at the schema level.

CREATE TABLE IF NOT EXISTS "whatsapp_integrations" (
  "workspace_subdomain" text PRIMARY KEY REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "provider_id" varchar(40) NOT NULL DEFAULT 'meta',
  "account_id" varchar(255) NOT NULL DEFAULT '',
  "phone_number_id" varchar(255),
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

ALTER TABLE "whatsapp_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_integrations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "whatsapp_integrations";
CREATE POLICY tenant_isolation_policy ON "whatsapp_integrations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
