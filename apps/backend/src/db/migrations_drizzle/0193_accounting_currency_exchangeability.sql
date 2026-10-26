-- Migration 0193: IAS 21 lack of exchangeability (2025 amendment), FORCE RLS.
-- A row marks a currency as not exchangeable; rates for it must be estimates.

CREATE TABLE IF NOT EXISTS "accounting_currency_exchangeability" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "currency" varchar(3) NOT NULL,
  "assessed_on" varchar(10) NOT NULL,
  "estimation_method" text NOT NULL,
  "reason" text NOT NULL DEFAULT '',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text,
  PRIMARY KEY ("workspace_subdomain", "currency"),
  CONSTRAINT "accounting_currency_exchangeability_iso" CHECK ("currency" ~ '^[A-Z]{3}$')
);

ALTER TABLE "accounting_currency_exchangeability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_currency_exchangeability" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_currency_exchangeability";
CREATE POLICY tenant_isolation_policy ON "accounting_currency_exchangeability" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
