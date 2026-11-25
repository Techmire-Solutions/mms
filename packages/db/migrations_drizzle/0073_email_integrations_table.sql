-- Migration 0073: Create email_integrations table with FORCE ROW LEVEL SECURITY.
-- Replaces document-store keys email_integration and email_integration_secrets.

CREATE TABLE IF NOT EXISTS "email_integrations" (
  "workspace_subdomain" text PRIMARY KEY REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "provider_id" varchar(40) NOT NULL DEFAULT 'gmail',
  "from_address" varchar(255) NOT NULL DEFAULT '',
  "from_name" varchar(255) NOT NULL DEFAULT 'Madrasa Management System',
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

ALTER TABLE "email_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_integrations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "email_integrations";
CREATE POLICY tenant_isolation_policy ON "email_integrations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
